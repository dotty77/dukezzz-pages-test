// A ranking weight only: special connections have no verified walking length.
export const CONDITIONAL_LINK_PENALTY = 100;
export const EXACT_TARGET_LIMIT = 17;
export const ASSAULT_BEAM_WIDTH = 256;
const RULES = '优先覆盖更多矿怪与钥匙房，再缩短实际有向路线总分；每处待确认特殊连接仅加100排序权重，非步行距离；等分按输入顺序；核验所选终点返程；不预测实际收益';
const CANCELLED = Symbol('assault-plan-cancelled');
const TARGET_KINDS = new Set(['ore_boss', 'keyroom']);
const yieldTask = () => new Promise(resolve => setTimeout(resolve, 0));

function coordinates(point) {
  const p = point?.worldPosition;
  const values = Array.isArray(p) ? p : p && [p.x, p.y, p.z];
  return values?.length === 3 && values.every(Number.isFinite) ? values : null;
}
function targetId(target) {
  const id = target?.id;
  if (typeof id === 'number') return Number.isFinite(id) ? String(id) : null;
  return typeof id === 'string' && id.trim() ? id : null;
}
function routeMetrics(result, allowConditional) {
  if (result?.status === 'complete' && Number.isFinite(result.distance) && result.distance >= 0) {
    return {walking: result.distance, conditional: 0, score: result.distance};
  }
  if (result?.status !== 'conditional' || !allowConditional ||
      !Number.isFinite(result.walkingDistance) || result.walkingDistance < 0 ||
      !Array.isArray(result.segments)) return null;
  const count = result.segments.filter(segment => segment?.kind === 'special').length;
  if (!count) return null;
  const score = result.walkingDistance + count * CONDITIONAL_LINK_PENALTY;
  return Number.isFinite(score) ? {walking: result.walkingDistance, conditional: count, score} : null;
}
function routeIssue(result, allowConditional) {
  if (result?.status === 'conditional' && !allowConditional) return '需要尚未确认的特殊通路';
  if (result?.status === 'off_mesh') return '起点或目标尚未接入已知道路';
  if (result?.status === 'unreachable') return '现有路线数据未找到允许的路径';
  return '路线资料不完整或暂时无法计算';
}
function compareOrder(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}

// dp[mask, first]: cheapest directed path visiting exactly mask, starting at
// first and ending at the optional finish. Next indices preserve lexicographic
// ties without encoding long index sequences in imprecise numeric ranks.
async function exactOrder(n, startScores, scores, homeScores, limit, checkpoint) {
  const masks = 1 << n, costs = new Float64Array(masks * n); costs.fill(Infinity);
  const next = new Int8Array(masks * n); next.fill(-1);
  const counts = new Uint8Array(masks);
  let bestCount = 0, bestScore = Infinity, bestOrder = [];
  const restore = (mask, first) => {
    const order = [];
    while (first >= 0) {
      order.push(first);
      const following = next[mask * n + first];
      mask ^= 1 << first; first = following;
    }
    return order;
  };
  for (let mask = 1; mask < masks; mask++) {
    if (mask % 1024 === 0) await checkpoint(false);
    const count = counts[mask] = counts[mask >>> 1] + (mask & 1);
    if (count > limit) continue;
    for (let bits = mask; bits; bits &= bits - 1) {
      const first = 31 - Math.clz32(bits & -bits), rest = mask ^ (1 << first), index = mask * n + first;
      if (!rest) { costs[index] = homeScores[first]; continue; }
      let value = Infinity, chosen = -1;
      for (let remaining = rest; remaining; remaining &= remaining - 1) {
        const j = 31 - Math.clz32(remaining & -remaining);
        const candidate = scores[first * n + j] + costs[rest * n + j];
        if (candidate < value) { value = candidate; chosen = j; }
      }
      costs[index] = value; next[index] = chosen;
    }
    if (count < bestCount) continue;
    for (let bits = mask; bits; bits &= bits - 1) {
      const first = 31 - Math.clz32(bits & -bits);
      const score = startScores[first] + costs[mask * n + first];
      if (!Number.isFinite(score) || (count === bestCount && score > bestScore)) continue;
      const order = restore(mask, first);
      if (count > bestCount || score < bestScore || compareOrder(order, bestOrder) < 0) {
        bestCount = count; bestScore = score; bestOrder = order;
      }
    }
  }
  return bestOrder;
}

// Beyond 17 targets use a declared bounded search, retaining all inputs.
// Reachability only ranks states: no transitive closure edge becomes a leg.
async function boundedOrder(n, startScores, scores, homeScores, limit, checkpoint) {
  const bits = Array.from({length: n}, (_, i) => 1n << BigInt(i));
  const reachable = bits.map((bit, i) => {
    let value = bit;
    for (let j = 0; j < n; j++) if (Number.isFinite(scores[i * n + j])) value |= bits[j];
    return value;
  });
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) if (reachable[i] & bits[k]) reachable[i] |= reachable[k];
    if (k % 16 === 15) await checkpoint();
  }
  const remainingCount = value => {let count = 0; for (; value; value &= value - 1n) count++; return count;};
  let frontier = [{mask: 0n, last: -1, score: 0, order: []}], best = null, work = 0;
  for (let depth = 0; depth < limit && frontier.length; depth++) {
    const candidates = new Map();
    for (const state of frontier) for (let j = 0; j < n; j++) {
      if (++work % 2048 === 0) await checkpoint(false);
      if (state.mask & bits[j]) continue;
      const edge = state.last < 0 ? startScores[j] : scores[state.last * n + j];
      const score = state.score + edge;
      if (!Number.isFinite(score)) continue;
      const mask = state.mask | bits[j], order = [...state.order, j];
      const candidate = {mask, last: j, score, order, bound: Math.min(limit, order.length + remainingCount(reachable[j] & ~mask))};
      const key = mask.toString() + ':' + j, previous = candidates.get(key);
      if (!previous || score < previous.score || (score === previous.score && compareOrder(order, previous.order) < 0)) candidates.set(key, candidate);
      const total = score + homeScores[j];
      if (Number.isFinite(total) && (!best || order.length > best.order.length ||
          (order.length === best.order.length && (total < best.total || (total === best.total && compareOrder(order, best.order) < 0))))) best = {order, total};
    }
    frontier = [...candidates.values()].sort((a, b) => b.bound - a.bound || a.score - b.score || compareOrder(a.order, b.order)).slice(0, ASSAULT_BEAM_WIDTH);
    await checkpoint();
  }
  return best?.order || [];
}

/**
 * Maximize coverage, then minimize the total directed route score. Up to 17
 * eligible targets use exact subset DP over supplied route results; larger
 * inputs use a declared bounded search. There is no default target count cap.
 * Explicit maxStops limits targets, not finish. Inputs and route objects are
 * unchanged. No itinerary is committed until optimization completes.
 */
export async function planAssault({
  start, targets, route, maxStops = Infinity, finish = null,
  allowConditional = true, isCancelled = () => false,
} = {}) {
  const result = {
    status: 'empty', stops: [], legs: [], skipped: [], walkingDistance: 0,
    conditionalCount: 0, finishReached: false, algorithm: '候选与已有路由内的覆盖优先子集动态规划；' + RULES,
  };
  const stopLimit = Number.isFinite(maxStops) ? Math.max(1, Math.floor(maxStops)) : Infinity;
  const cache = new Map(), skipped = new Set();
  const checkCancelled = () => { if (isCancelled()) throw CANCELLED; };
  let lastYield = 0;
  const checkpoint = async (force = true) => {
    checkCancelled();
    if (force || Date.now() - lastYield >= 8) {await yieldTask(); lastYield = Date.now(); checkCancelled();}
  };
  let calls = 0, unresolved = false;
  const skip = (entry, reason, incomplete = true) => {
    if (skipped.has(entry)) return;
    skipped.add(entry); result.skipped.push({target: entry.target, reason});
    if (incomplete) unresolved = true;
  };
  async function getRoute(from, to) {
    checkCancelled();
    const key = JSON.stringify([coordinates(from), coordinates(to)]);
    if (cache.has(key)) return cache.get(key);
    if (calls && calls % 8 === 0) await checkpoint();
    calls++;
    let value;
    try { value = await route(from.worldPosition, to.worldPosition); }
    catch (error) { checkCancelled(); value = {status: 'unavailable'}; }
    checkCancelled(); cache.set(key, value); return value;
  }
  const edge = async (from, to) => {const value = await getRoute(from, to); return {value, metrics: routeMetrics(value, allowConditional)};};
  function addLeg(from, to, value, metrics, omitSamePosition = false) {
    const identical = JSON.stringify(coordinates(from)) === JSON.stringify(coordinates(to));
    if (!(omitSamePosition && identical && !metrics.conditional && metrics.walking === 0)) result.legs.push({from, to, route: value});
    result.walkingDistance += metrics.walking; result.conditionalCount += metrics.conditional;
  }
  try {
    checkCancelled();
    const ids = new Set(), pending = [];
    for (const target of Array.isArray(targets) ? targets : []) {
      checkCancelled();
      const entry = {target};
      if (!TARGET_KINDS.has(target?.kind)) { skip(entry, '不属于矿怪或钥匙房目标', false); continue; }
      const id = targetId(target);
      if (id === null) { skip(entry, '目标缺少有效编号'); continue; }
      if (!coordinates(target)) { skip(entry, '目标缺少有效世界坐标'); continue; }
      if (ids.has(id)) { skip(entry, '重复目标，保留首次记录', false); continue; }
      ids.add(id); pending.push(entry);
    }
    if (!coordinates(start) || typeof route !== 'function' || (finish && !coordinates(finish))) {
      const reason = !coordinates(start) ? '起点缺少有效世界坐标' : typeof route !== 'function' ? '路线计算不可用' : '终点缺少有效世界坐标，未安排目标';
      pending.forEach(entry => skip(entry, reason)); return result;
    }
    const entries = [];
    for (const entry of pending) {
      entry.start = await edge(start, entry.target);
      if (finish) {
        entry.home = await edge(entry.target, finish);
        if (!entry.home.metrics) {
          skip(entry, '未找到从此目标前往所选撤离点的已知连接：' + routeIssue(entry.home.value, allowConditional));
          continue;
        }
      }
      entries.push(entry);
    }
    const n = entries.length;
    if (!n) return result;
    const limit = Math.min(stopLimit, n), edges = new Array(n * n);
    const scores = new Float64Array(n * n); scores.fill(Infinity);
    const startScores = Float64Array.from(entries, e => e.start.metrics?.score ?? Infinity);
    const homeScores = Float64Array.from(entries, e => e.home?.metrics.score ?? 0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const item = edges[i * n + j] = await edge(entries[i].target, entries[j].target);
      scores[i * n + j] = item.metrics?.score ?? Infinity;
    }
    await checkpoint();
    if (n > EXACT_TARGET_LIMIT) result.algorithm = '超过' + EXACT_TARGET_LIMIT + '个候选，采用宽度' + ASSAULT_BEAM_WIDTH + '的有界覆盖搜索，不保证全局最优；' + RULES;
    const order = await (n <= EXACT_TARGET_LIMIT ? exactOrder : boundedOrder)(n, startScores, scores, homeScores, limit, checkpoint);
    checkCancelled();
    const selected = new Set(order), reachable = new Set(), queue = [];
    for (let i = 0; i < n; i++) if (Number.isFinite(startScores[i])) {reachable.add(i); queue.push(i);}
    for (let i = 0; i < queue.length; i++) for (let j = 0; j < n; j++) {
      if (!reachable.has(j) && Number.isFinite(scores[queue[i] * n + j])) {reachable.add(j); queue.push(j);}
    }
    for (let i = 0; i < n; i++) if (!selected.has(i)) {
      if (!reachable.has(i)) skip(entries[i], routeIssue(entries[i].start.value, allowConditional));
      else if (order.length === limit && limit < n) skip(entries[i], '超过本次目标数量上限', false);
      else skip(entries[i], n <= EXACT_TARGET_LIMIT ? '现有有向连接无法将此目标与已安排目标全部串入同一行程' : '本次有界搜索未能将此目标接入同一行程，未补接未知道路');
    }
    let current = start, previous = -1;
    for (const i of order) {
      const item = previous < 0 ? entries[i].start : edges[previous * n + i];
      addLeg(current, entries[i].target, item.value, item.metrics, true);
      result.stops.push(entries[i].target); current = entries[i].target; previous = i;
    }
    if (finish && order.length) {
      const home = entries[previous].home;
      addLeg(current, finish, home.value, home.metrics); result.finishReached = true;
    }
    result.status = !order.length ? 'empty' : unresolved || result.conditionalCount ? 'partial' : 'complete';
    return result;
  } catch (error) {
    if (error !== CANCELLED) throw error;
    result.status = 'cancelled'; return result;
  }
}

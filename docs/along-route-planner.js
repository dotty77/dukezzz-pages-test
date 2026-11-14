// Special connections add a ranking weight only, never metres/time/fare.
const SPECIAL_LINK_WEIGHT = 100;
const KINDS = new Set(['keyroom', 'ore_boss', 'electronic']);
const CANCELLED = Symbol('along-route-cancelled');
const pause = () => new Promise(resolve => setTimeout(resolve, 0));

function coordinates(point) {
  const value = point?.worldPosition;
  const xyz = Array.isArray(value) ? value : value && [value.x, value.y, value.z];
  return xyz?.length === 3 && xyz.every(Number.isFinite) ? xyz : null;
}
function targetId(point) {
  const id = point?.id;
  if (typeof id === 'number') return Number.isFinite(id) ? String(id) : null;
  return typeof id === 'string' && id.trim() ? id : null;
}
function metrics(result, allowConditional) {
  if (result?.status === 'complete' && Number.isFinite(result.distance) && result.distance >= 0 &&
      !result.segments?.some(segment => segment?.kind === 'special')) {
    return {walking: result.distance, conditional: 0};
  }
  if (result?.status !== 'conditional' || !allowConditional ||
      !Number.isFinite(result.walkingDistance) || result.walkingDistance < 0 ||
      !Array.isArray(result.segments)) return null;
  const count = result.segments.filter(segment => segment?.kind === 'special').length;
  return count ? {walking: result.walkingDistance, conditional: count} : null;
}
function better(candidate, best) {
  return !best || candidate.score < best.score ||
    (candidate.score === best.score && (candidate.extra < best.extra ||
      (candidate.extra === best.extra && (candidate.entry.index < best.entry.index ||
        (candidate.entry.index === best.entry.index && candidate.gap < best.gap)))));
}

/**
 * Plan optional stops around start→requiredStops (input order)→finish.
 * Required stops must match a selected targets entry by ID, kind and exact XYZ;
 * matching copies resolve to the original target object. Never invent a target.
 * The verified required itinerary fixes the walking budget. directDistance is
 * informational and may be null even when all required legs are reachable.
 * Optional stageOf must return finite numeric stages. Missing/invalid stages on
 * endpoints or required stops fail explicitly; optional unknown stages are
 * skipped. A gap admits only leftStage <= candidateStage <= rightStage.
 * Equal stages allow local reordering; initial required stages must not descend.
 * maxExtraDistance optionally caps extra walking above the required baseline.
 * Query only actual adjacent-leg insertions, never prebuild an N×N target matrix.
 * This greedy heuristic does not promise maximum coverage or a global optimum.
 * canInsert and stageOf must be synchronous and side-effect-free. canInsert is
 * checked on each required prefix before routing, then against all chosen stops.
 */
export async function planAlongRoute({
  start, finish, targets = [], route, detourRatio = .35, maxExtraDistance = Infinity,
  allowConditional = true, isCancelled = () => false, canInsert = () => true,
  requiredStops = [], stageOf,
} = {}) {
  if (!Number.isFinite(detourRatio) || detourRatio < 0 ||
      !(maxExtraDistance === Infinity || Number.isFinite(maxExtraDistance) && maxExtraDistance >= 0)) {
    throw new RangeError('绕路比例和额外步行上限必须为非负有效数值。');
  }
  if (typeof isCancelled !== 'function' || typeof canInsert !== 'function') {
    throw new TypeError('isCancelled 和 canInsert 必须是函数。');
  }
  if (!Array.isArray(requiredStops) || stageOf != null && typeof stageOf !== 'function') {
    throw new TypeError('requiredStops 必须是数组，stageOf 必须是函数。');
  }
  const result = {status: 'empty', stops: [], legs: [], skipped: [], walkingDistance: 0,
    conditionalCount: 0, finishReached: false, baselineDistance: null, detourDistance: 0,
    budgetDistance: null, directDistance: null, requiredStops: [...requiredStops],
    algorithm: '出生经已选必经目标至撤离的有向基础路线 + 按需最小增量插入；按指定分区顺序和步行预算筛选；特殊通路每处100排序权重，非距离；不保证全局最优，不预测耗时或收益'};
  const cache = new Map(), omissions = [], pending = [], ids = new Set();
  const requiredIds = new Set(requiredStops.map(targetId).filter(id => id !== null));
  const stages = new Map();
  let lastYield = Date.now(), checks = 0;
  const checkCancelled = () => {if (isCancelled()) throw CANCELLED;};
  async function checkpoint() {
    checkCancelled();
    if (Date.now() - lastYield >= 12) {await pause(); lastYield = Date.now(); checkCancelled();}
  }
  function skip(entry, code, reason) {omissions.push({index: entry.index, target: entry.target, code, reason});}
  function publishOmissions() {
    result.skipped = omissions.sort((a, b) => a.index - b.index).map(({index, ...item}) => item);
  }
  function fail(code, reason, details = {}) {
    Object.assign(result, {status: 'unreachable', code, reason}, details);
    for (const entry of pending) if (!requiredIds.has(targetId(entry.target))) skip(entry, code, reason);
    publishOmissions(); return result;
  }
  async function edge(from, to) {
    checkCancelled();
    const key = JSON.stringify([coordinates(from), coordinates(to)]);
    if (cache.has(key)) return cache.get(key);
    await checkpoint();
    let value;
    try {value = await route(from.worldPosition, to.worldPosition);}
    catch (error) {checkCancelled(); value = {status: 'unavailable'};}
    checkCancelled();
    const item = {value, metrics: metrics(value, allowConditional)};
    cache.set(key, item); return item;
  }
  try {
    checkCancelled();
    for (const [index, target] of (Array.isArray(targets) ? targets : []).entries()) {
      const entry = {index, target};
      if (!KINDS.has(target?.kind)) {skip(entry, 'unsupported_kind', '不属于本次搜索类型'); continue;}
      const id = targetId(target);
      if (id === null || !coordinates(target)) {skip(entry, 'invalid_target', '目标位置资料不完整'); continue;}
      if (ids.has(id)) {skip(entry, 'duplicate_target', '重复目标'); continue;}
      ids.add(id); pending.push(entry);
    }
    if (!coordinates(start) || !coordinates(finish) || typeof route !== 'function') {
      return fail('invalid_endpoint', '请选择有效的出生点和撤离点');
    }
    const selectedById = new Map(pending.map(entry => [targetId(entry.target), entry.target]));
    const required = [], requiredSeen = new Set();
    for (const requested of requiredStops) {
      checkCancelled();
      const id = targetId(requested), target = selectedById.get(id);
      if (!target || target.kind !== requested.kind || requiredSeen.has(id) ||
          JSON.stringify(coordinates(target)) !== JSON.stringify(coordinates(requested))) {
        return fail('invalid_required_target', '必经目标必须是已选目标，且不能重复或改动位置', {failedRequiredStop: requested});
      }
      requiredSeen.add(id); required.push(target);
    }
    result.requiredStops = [...required];
    for (let index = 0; index < required.length; index++) {
      checkCancelled();
      if (!canInsert(required.slice(0, index), required[index])) {
        return fail('required_condition_conflict', '必经目标的刷新条件互斥', {failedRequiredStop: required[index]});
      }
    }
    const points = [start, ...required, finish], legs = [];
    if (stageOf) {
      for (const point of points) {
        checkCancelled();
        const stage = stageOf(point);
        if (!Number.isFinite(stage)) return fail('unknown_stage', '出生点、撤离点或必经目标缺少有效分区顺序', {failedStagePoint: point});
        stages.set(point, stage);
      }
      for (let index = 1; index < points.length; index++) {
        if (stages.get(points[index - 1]) > stages.get(points[index])) {
          return fail('required_stage_order', '必经目标顺序与所选分区顺序不一致', {failedStagePoint: points[index]});
        }
      }
    }
    const direct = await edge(start, finish);
    result.directDistance = direct.metrics?.walking ?? null;
    result.directStatus = direct.value?.status || 'unavailable';
    for (let index = 0; index < points.length - 1; index++) {
      const leg = required.length ? await edge(points[index], points[index + 1]) : direct;
      if (!leg.metrics) {
        const closed = !allowConditional && leg.value?.status === 'conditional';
        return fail(required.length ? 'required_leg_unreachable' : 'baseline_unreachable',
          required.length ? (closed ? '必经路段需要已关闭的特殊通路' : '必经路段暂缺道路连接') :
            (closed ? '撤离路线需要已关闭的特殊通路' : '暂缺出生点到撤离点的道路连接'),
          {baselineStatus: leg.value?.status || 'unavailable', failedLeg: {from: points[index], to: points[index + 1], route: leg.value}});
      }
      legs.push(leg);
    }
    const baselineDistance = legs.reduce((sum, item) => sum + item.metrics.walking, 0);
    const extraBudget = Math.min(baselineDistance * detourRatio, maxExtraDistance);
    const budget = baselineDistance + extraBudget;
    if (!Number.isFinite(budget)) throw new RangeError('绕路预算超出数值范围。');
    result.baselineDistance = baselineDistance; result.budgetDistance = budget;
    const tolerance = Math.max(1, budget) * 1e-9;
    for (let index = pending.length - 1; index >= 0; index--) {
      const entry = pending[index];
      if (requiredIds.has(targetId(entry.target))) {pending.splice(index, 1); continue;}
      if (stageOf) {
        checkCancelled();
        const stage = stageOf(entry.target);
        if (!Number.isFinite(stage)) {skip(entry, 'unknown_stage', '未确定目标所属分区'); pending.splice(index, 1);}
        else stages.set(entry.target, stage);
      }
    }
    let walking = baselineDistance;
    while (pending.length) {
      await checkpoint();
      let best = null;
      const stops = points.slice(1, -1);
      for (const entry of pending) {
        entry.connected = false;
        entry.stageGap = false;
        checkCancelled();
        entry.conflict = !canInsert(stops, entry.target);
        if (entry.conflict) continue;
        for (let gap = 0; gap < legs.length; gap++) {
          if (++checks % 64 === 0) await checkpoint();
          if (stageOf && !(stages.get(points[gap]) <= stages.get(entry.target) && stages.get(entry.target) <= stages.get(points[gap + 1]))) continue;
          entry.stageGap = true;
          const left = await edge(points[gap], entry.target);
          if (!left.metrics) continue;
          const right = await edge(entry.target, points[gap + 1]);
          if (!right.metrics) continue;
          const extra = left.metrics.walking + right.metrics.walking - legs[gap].metrics.walking;
          const nextWalking = walking + extra;
          if (!Number.isFinite(nextWalking)) continue;
          entry.connected = true;
          if (nextWalking > budget + tolerance) continue;
          const conditional = left.metrics.conditional + right.metrics.conditional - legs[gap].metrics.conditional;
          const candidate = {entry, gap, left, right, extra, nextWalking, score: extra + conditional * SPECIAL_LINK_WEIGHT};
          if (Number.isFinite(candidate.score) && better(candidate, best)) best = candidate;
        }
      }
      if (!best) break;
      checkCancelled();
      points.splice(best.gap + 1, 0, best.entry.target);
      legs.splice(best.gap, 1, best.left, best.right);
      walking = best.nextWalking;
      pending.splice(pending.indexOf(best.entry), 1);
    }
    checkCancelled();
    for (const entry of pending) {
      if (entry.conflict) skip(entry, 'condition_conflict', '刷新条件互斥');
      else if (stageOf && !entry.stageGap) skip(entry, 'stage_order', '不在所选分区顺序内');
      else if (entry.connected) skip(entry, 'detour_budget', '超出绕路范围');
      else skip(entry, 'unreachable', '暂缺道路连接');
    }
    // Publish a complete verified itinerary atomically, including the direct
    // baseline leg when zero optional stops were accepted.
    result.stops = points.slice(1, -1);
    result.legs = legs.map((item, index) => ({from: points[index], to: points[index + 1], route: item.value}));
    result.walkingDistance = legs.reduce((sum, item) => sum + item.metrics.walking, 0);
    result.conditionalCount = legs.reduce((sum, item) => sum + item.metrics.conditional, 0);
    result.detourDistance = Math.max(0, result.walkingDistance - baselineDistance);
    result.finishReached = true;
    publishOmissions();
    const incomplete = result.skipped.some(item => ['invalid_target', 'unreachable', 'unknown_stage'].includes(item.code));
    result.status = result.conditionalCount || incomplete ? 'partial' : 'complete';
    return result;
  } catch (error) {
    if (error !== CANCELLED) throw error;
    result.status = 'cancelled'; publishOmissions(); return result;
  }
}

// Keep in step with assault-planner: 100 is a ranking weight, never metres,
// seconds or a fare. Only explicitly enabled, sourced directed links are used.
const SPECIAL_LINK_WEIGHT = 100;
const CACHE_LIMIT = 512;
const CACHE_POINT_LIMIT = 50000;
const TRANSIT_TYPES = new Set(['hollow_portal', 'billy_elevator']);
const DIRECTION = 'source-start-to-end-only';

function position(value) {
  const xyz = Array.isArray(value) ? value : value && [value.x, value.y, value.z];
  return xyz?.length === 3 && xyz.every(Number.isFinite)
    ? {x: xyz[0], y: xyz[1], z: xyz[2]} : null;
}
function sourcedLinks(links) {
  if (!Array.isArray(links)) throw new TypeError('交通连接必须是数组。');
  const ids = new Set();
  return links.map((link, index) => {
    const start = position(link?.start), end = position(link?.end), source = link?.source;
    if (typeof link?.id !== 'string' || !link.id.trim() || ids.has(link.id) ||
        !TRANSIT_TYPES.has(link.type) || !start || !end || link.direction !== DIRECTION ||
        typeof source?.path !== 'string' || !source.path.trim() ||
        !/^[a-f0-9]{64}$/i.test(source.sha256 || '') ||
        typeof source.jsonPath !== 'string' || !source.jsonPath.trim()) {
      throw new TypeError(`交通连接 ${index} 缺少有效编号、原始坐标、方向或来源。`);
    }
    ids.add(link.id);
    return {...link, start, end, source: {...source}};
  });
}

// Unknown option types (signals, callbacks, symbols, cycles, etc.) bypass the
// shared cache. Do not silently omit an option that could affect base.route.
function optionKey(options) {
  const seen = new Set();
  function encode(value) {
    if (value === null) return ['null'];
    if (value === undefined) return ['undefined'];
    if (typeof value === 'string' || typeof value === 'boolean') return [typeof value, value];
    if (typeof value === 'number' && Number.isFinite(value)) return ['number', Object.is(value, -0) ? '-0' : value];
    if (typeof value !== 'object' || seen.has(value)) throw new Error('uncacheable');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) throw new Error('uncacheable');
    if (Object.getOwnPropertySymbols(value).length) throw new Error('uncacheable');
    seen.add(value);
    const properties = Object.getOwnPropertyNames(value).sort().map(key => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!Object.hasOwn(descriptor, 'value')) throw new Error('uncacheable');
      return [key, encode(descriptor.value)];
    });
    const encoded = [array ? 'array' : 'object', properties];
    seen.delete(value);
    return encoded;
  }
  try {
    const key = JSON.stringify(encode(options));
    return key.length <= 4096 ? key : null;
  } catch { return null; }
}
function metrics(result) {
  if (result?.status === 'complete' && Number.isFinite(result.distance) && result.distance >= 0 &&
      !result.segments?.some(segment => segment?.kind === 'special')) {
    return {walking: result.distance, specials: 0, score: result.distance};
  }
  if (result?.status !== 'conditional' || !Number.isFinite(result.walkingDistance) ||
      result.walkingDistance < 0 || !Array.isArray(result.segments)) return null;
  const specials = result.segments.filter(segment => segment?.kind === 'special').length;
  if (!specials) return null;
  const score = result.walkingDistance + specials * SPECIAL_LINK_WEIGHT;
  return Number.isFinite(score) ? {walking: result.walkingDistance, specials, score} : null;
}
function withoutSpecials(result) {
  if (result?.status !== 'conditional' && !result?.segments?.some(segment => segment?.kind === 'special')) return result;
  const {distance, walkingDistance, segments, specialLinkCount, usedTransitIds, ...rest} = result;
  return {...rest, status: 'unreachable', reason: '本次仅允许步行；已有路线需要特殊通路。',
    baseStatus: result.status, baseReason: result.reason, points: [], polygonPath: [],
    warnings: [...(result.warnings || []), '已关闭全部特殊通路，包括原始场景连接与手动确认的交通连接。']};
}
function pointCount(result) {
  return (result.points?.length || 0) + (result.segments || []).reduce((sum, segment) => sum + (segment.points?.length || 0), 0);
}

/**
 * Wrap a synchronous source-world router. Link endpoints are used verbatim;
 * only base.route can supply a walking edge. No proximity/component matching
 * or reverse link is inferred. getEnabled is read afresh for every request.
 */
export function createTransitRouter(base, {links = [], getEnabled = () => []} = {}) {
  if (typeof base?.route !== 'function' || typeof base?.nearest !== 'function' || typeof getEnabled !== 'function') {
    throw new TypeError('交通路由需要基础 route/nearest 和 getEnabled 函数。');
  }
  const references = sourcedLinks(links), legCache = new Map();
  let cachedPoints = 0;
  function cachedLeg(from, to, options, optionsKey) {
    if (optionsKey === null) return base.route(from, to, options);
    const key = JSON.stringify([from.x, from.y, from.z, to.x, to.y, to.z, optionsKey]);
    if (legCache.has(key)) {
      const entry = legCache.get(key); legCache.delete(key); legCache.set(key, entry);
      return entry.result;
    }
    const result = base.route(from, to, options), points = pointCount(result);
    if (points <= CACHE_POINT_LIMIT) {
      legCache.set(key, {result, points}); cachedPoints += points;
      while (legCache.size > CACHE_LIMIT || cachedPoints > CACHE_POINT_LIMIT) {
        const oldest = legCache.keys().next().value;
        cachedPoints -= legCache.get(oldest).points; legCache.delete(oldest);
      }
    }
    return result;
  }
  function route(start, end, options = {}) {
    const direct = base.route(start, end, options);
    if (options.allowConditional === false) return withoutSpecials(direct);
    const enabled = getEnabled();
    const ids = new Set(Array.isArray(enabled) || enabled instanceof Set ? enabled : []);
    const selected = references.filter(link => ids.has(link.id));
    // Preserve the base result, including failures and identity, when disabled.
    // A transport cannot rescue query endpoints outside the navigation surface.
    if (!selected.length || direct.status === 'off_mesh') return direct;
    const startPoint = position(start), endPoint = position(end);
    if (!startPoint || !endPoint) return direct;
    const vertices = [startPoint, endPoint], specialEdges = new Map();
    for (const link of selected) {
      const from = vertices.length;
      vertices.push(link.start, link.end);
      specialEdges.set(from, {to: from + 1, link});
    }
    const count = vertices.length, target = count + 1;
    // Two layers distinguish paths that really use an enabled transport from
    // incidental subdivision of a base walk at a transport endpoint.
    const scores = new Float64Array(count * 2); scores.fill(Infinity);
    const closed = new Uint8Array(count * 2), previous = new Array(count * 2);
    scores[0] = 0;
    const directMetrics = metrics(direct);
    if (directMetrics) { scores[target] = directMetrics.score; previous[target] = {direct: true}; }
    const optionsKey = optionKey(options), localRoutes = new Map();
    function baseEdge(from, to) {
      const key = from * count + to;
      if (!localRoutes.has(key)) {
        // Share query↔transport legs across target-pair requests as well as
        // transport↔transport legs. The original direct request stays uncached.
        const result = from >= 2 || to >= 2
          ? cachedLeg(vertices[from], vertices[to], options, optionsKey)
          : base.route(vertices[from], vertices[to], options);
        localRoutes.set(key, {kind: 'base', result, metrics: metrics(result)});
      }
      return localRoutes.get(key);
    }
    function relax(from, to, edge, weight) {
      const score = scores[from] + weight;
      if (!closed[to] && score < scores[to]) {scores[to] = score; previous[to] = {from, edge};}
    }
    for (;;) {
      let current = -1;
      for (let i = 0; i < scores.length; i++) {
        if (!closed[i] && Number.isFinite(scores[i]) && (current < 0 || scores[i] < scores[current])) current = i;
      }
      if (current < 0 || current === target) break;
      closed[current] = 1;
      const node = current % count, usedTransit = current >= count;
      const special = specialEdges.get(node);
      if (special) relax(current, count + special.to, {kind: 'transit', link: special.link}, SPECIAL_LINK_WEIGHT);
      for (let to = 1; to < count; to++) {
        if (to === node || (to === 1 && !usedTransit)) continue;
        const next = to + (usedTransit ? count : 0);
        if (closed[next]) continue;
        const edge = baseEdge(node, to);
        if (edge.metrics) relax(current, next, edge, edge.metrics.score);
      }
    }
    if (!previous[target] || previous[target].direct) return direct;
    const edges = [];
    for (let state = target; state !== 0;) {
      const step = previous[state]; edges.push(step.edge); state = step.from;
    }
    edges.reverse();
    const segments = [], usedTransitIds = [], routeWarnings = [], seenIds = new Set();
    let walkingDistance = 0, specialLinkCount = 0;
    for (const edge of edges) {
      if (edge.kind === 'base') {
        walkingDistance += edge.metrics.walking; specialLinkCount += edge.metrics.specials;
        if (edge.result.status === 'conditional') segments.push(...edge.result.segments);
        else segments.push({...edge.result, kind: 'walking'});
        routeWarnings.push(...(edge.result.warnings || []));
      } else {
        const link = edge.link; specialLinkCount++;
        segments.push({kind: 'special', id: link.id, type: link.type,
          label: link.label, labelEn: link.labelEn, source: {...link.source},
          start: {...link.start}, end: {...link.end}, points: [{...link.start}, {...link.end}],
          direction: DIRECTION, runtimeAvailability: 'user-confirmed-only'});
        if (!seenIds.has(link.id)) {seenIds.add(link.id); usedTransitIds.push(link.id);}
        if (Array.isArray(link.warnings)) routeWarnings.push(...link.warnings);
      }
    }
    const {distance, walkingDistance: oldWalking, segments: oldSegments,
      specialLinkCount: oldCount, usedTransitIds: oldIds, visited, ...common} = direct;
    return {...common, coordinateSpace: 'source-world', status: 'conditional',
      mode: 'static_navmesh_with_user_confirmed_transit',
      reason: '路线含已手动确认的交通连接；原始场景特殊通路仍需核对开放条件。',
      points: [], polygonPath: [], segments, walkingDistance, specialLinkCount, usedTransitIds,
      warnings: [...new Set([...routeWarnings,
        '已选交通连接仅按原始 start→end 方向使用；本局可用性由用户确认，不推定反向或固定刷新。',
        '特殊通路每处仅加100排序权重，不代表步行距离、耗时或费用；步行距离不含传送线。'])],
      rankingScore: scores[target],
      algorithm: '有向端点图 Dijkstra；基础路线步行长度 + 每处特殊通路100排序权重'};
  }
  return {...base, route, nearest: (...args) => base.nearest(...args), stats: base.stats};
}

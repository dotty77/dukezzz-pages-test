// Display only: keep every original walking/special segment, including their
// direction and evidence. A gap between legs is never repaired with a line.
export function assaultMarkers(plan, start, finish) {
  const markers = [{...start, kind: 'start'}, ...plan.stops.map((point, i) => ({...point, number: i + 1}))];
  if (finish && plan.finishReached) markers.push({...finish, kind: 'exit'});
  for (const {target, reason} of plan.skipped) {
    // Along-route omissions are expected, not map errors. Keep the map focused
    // on the chosen route; the optional list contains every omitted candidate.
    if (plan.algorithm?.includes('along') || Number.isFinite(plan.baselineDistance)) continue;
    if (target?.worldPosition && !markers.some(point => point.id === target.id)) {
      markers.push({...target, kind: 'skipped', reason});
    }
  }
  return markers;
}

export function assaultOverview(plan, start, finish) {
  if (!plan?.legs.length) return null;
  const segments = plan.legs.flatMap((leg, legIndex) => {
    const pieces = leg.route.status === 'conditional' ? leg.route.segments : [{...leg.route, kind: 'walking'}];
    return pieces.map(segment => ({...segment, legIndex}));
  });
  const specialLinkCount = segments.filter(segment => segment.kind === 'special').length;
  return {
    strategy: 'assault', overview: true, coordinateSpace: 'source-world',
    status: specialLinkCount ? 'conditional' : 'complete', segments,
    // Fit-only; render the original segments independently.
    points: segments.flatMap(segment => segment.points),
    polygonPath: segments.flatMap(segment => segment.polygonPath || []),
    distance: plan.walkingDistance, walkingDistance: plan.walkingDistance,
    specialLinkCount, targetCount: plan.stops.length, legCount: plan.legs.length,
    assaultMarkers: assaultMarkers(plan, start, finish),
  };
}

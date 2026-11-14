// Search locations, not guaranteed loot. Preserve height and all source variants.
const excluded = new Set(['excluded_from_default_suite_draw', 'no_default_difficulty_rule', 'unreferenced_v2_member', 'unresolved_default_suite_rule']);
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
export function electronicTargets(choices, nav) {
  const locations=[];
  for(const point of choices) {
    if(point.type!=='electronic'||excluded.has(point.refreshCondition?.classification)||!nav.nearest(point.worldPosition))continue;
    let location=locations.find(p=>distance(p.worldPosition,point.worldPosition)<=.01);
    if(!location){location={...point,kind:'electronic',variants:[],runtimePresenceConfirmed:false};locations.push(location);}
    location.variants.push(point);
  }
  return locations.map((point,index)=>({...point,label:`电子箱 ${String(index+1).padStart(2,'0')}`,planningNote:'沿途检查，刷新以本局为准'}));
}

// A physical location may have several source entities (OR). Within a known
// default-difficulty group, every chosen entity must share at least one suite
// (AND). Checking pairs is insufficient for e.g. {4,5},{4,6},{5,6}.
// This is a configuration consistency filter, never a claim of live presence.
export function compatibleSearchLocations(stops, candidate) {
  const constraints=[...stops,candidate].filter(p=>p?.kind==='electronic').map(point=>
    (point.variants||[point]).map(p=>({group:p.groupId,suites:p.highRiskDefaultSuitePresence?.find(row=>row.difficultyId===213)?.memberSuites||[]}))
  ).filter(options=>options.length&&!options.some(o=>!o.suites.length));
  constraints.sort((a,b)=>a.length-b.length);
  function choose(index,groups){
    if(index===constraints.length)return true;
    for(const option of constraints[index]){
      const previous=groups.get(option.group),allowed=previous?option.suites.filter(x=>previous.includes(x)):option.suites;
      if(!allowed.length)continue;
      groups.set(option.group,allowed);
      if(choose(index+1,groups))return true;
      if(previous)groups.set(option.group,previous);else groups.delete(option.group);
    }
    return false;
  }
  return choose(0,new Map());
}

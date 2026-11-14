/** Personal planning leaves teammates unspecified; it is not a solo-combat
 * simulation. Only explicitly reviewed exclusions can remove a target.
 */
export function applyPlanningScope({scope='team',rows=[],context={}}={}){
  const planningScope=scope==='solo'?'solo':'team',exclusions=new Map();
  for(const entry of context.excludedTargets||[]){
    const key=typeof entry==='string'?entry:entry?.key;
    if(key!=null)exclusions.set(String(key),typeof entry==='string'?{}:entry);
  }
  for(const key of context.excludedTargetKeys||[])if(!exclusions.has(String(key)))exclusions.set(String(key),{});
  const mapped=rows.map(row=>{
    const next={...row};
    // A fresh team evaluation must also clear a prior personal annotation.
    delete next.scopeExcluded;delete next.scopeExclusionReason;delete next.scopeExclusionSource;
    const exclusion=planningScope==='solo'?exclusions.get(String(row.key)):undefined;
    if(exclusion){
      next.scopeExcluded=true;
      next.scopeExclusionReason=exclusion.reason||'该目标依赖本次未绑定的特定队伍条件，个人配装中单列参考。';
      if(exclusion.source)next.scopeExclusionSource=exclusion.source;
    }
    return next;
  });
  return {scope:planningScope,rows:mapped,excludedRows:mapped.filter(row=>row.scopeExcluded)};
}

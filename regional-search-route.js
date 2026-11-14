import {planAlongRoute} from './along-route-planner.js?v=20260919-site-refresh-1';

// These are editorial search areas. Region membership never adds a road edge,
// moves an endpoint, changes its floor, or confirms this run's loot.
export function createRegionLookup(policy) {
  const points=new Map((policy?.points||[]).map(point=>[String(point.id),point]));
  return point=>{
    const row=points.get(String(point?.id));
    return row&&['x','y','z'].every(axis=>Number.isFinite(point.worldPosition?.[axis])&&point.worldPosition[axis]===row.worldPosition?.[axis])?row.region:null;
  };
}

export function preferredSearchOrder(policy,start,finish) {
  const rule=policy?.preferredOrders?.find(row=>row.startIds.includes(start?.id)&&row.finishIds.includes(finish?.id));
  return rule?[...rule.regions]:null;
}

function travel(result,allowConditional) {
  if(result?.status==='complete'&&Number.isFinite(result.distance)&&result.distance>=0&&!result.segments?.some(s=>s.kind==='special'))return {walking:result.distance,special:0};
  if(result?.status!=='conditional'||!allowConditional||!Number.isFinite(result.walkingDistance)||result.walkingDistance<0||!Array.isArray(result.segments))return null;
  const special=result.segments.filter(s=>s.kind==='special').length;
  return special?{walking:result.walkingDistance,special}:null;
}

export async function planRegionalSearch({start,finish,targets,order,regionOf,route,allowConditional=true,isCancelled=()=>false,canInsert=()=>true,...options}) {
  const failed=reason=>({status:'unreachable',reason,stops:[],legs:[],skipped:[],finishReached:false,walkingDistance:0,conditionalCount:0,regionOrder:[...order]});
  if(!order.length||order[0]!==regionOf(start)||order.at(-1)!==regionOf(finish))return failed('当前起终点与搜图区域不一致，请重新选择出生点。');
  const targetRegions=new Map(targets.map(point=>[point.id,regionOf(point)]));
  const pending=[],unmapped=[];
  for(const target of targets){
    const region=targetRegions.get(target.id);
    if(!region)unmapped.push({target,code:'unknown_region',reason:'搜图区域尚未核对，可在沿撤离方向模式中规划'});
    else if(!order.includes(region))unmapped.push({target,code:'previous_region',reason:'不在剩余搜图区域内'});
    else if(!canInsert([],target))unmapped.push({target,code:'condition_conflict',reason:'与已搜索目标的刷新条件互斥'});
    else pending.push(target);
  }
  const stages=order.slice(0,-1).map(region=>pending.filter(point=>targetRegions.get(point.id)===region)).filter(points=>points.length);
  const cache=new Map();let lastYield=Date.now(),best=null;
  const cancelled=Symbol('cancelled');
  async function checkpoint(){if(isCancelled())throw cancelled;if(Date.now()-lastYield>=12){await new Promise(resolve=>setTimeout(resolve,0));lastYield=Date.now();if(isCancelled())throw cancelled;}}
  async function leg(from,to){
    await checkpoint();const key=JSON.stringify([from.worldPosition,to.worldPosition]);
    if(!cache.has(key)){let result;try{result=await route(from.worldPosition,to.worldPosition);}catch{result=null;}cache.set(key,{result,cost:travel(result,allowConditional)});}
    return cache.get(key);
  }
  async function visit(index,chain,walking,special){
    await checkpoint();const from=chain.at(-1)||start;
    if(index===stages.length){
      const last=await leg(from,finish);if(!last.cost)return;
      const totalWalking=walking+last.cost.walking,totalSpecial=special+last.cost.special,score=totalWalking+100*totalSpecial;
      if(!best||score<best.score||(score===best.score&&totalWalking<best.walking))best={chain:[...chain],score,walking:totalWalking};
      return;
    }
    for(const target of stages[index]){
      if(!canInsert(chain,target))continue;
      const next=await leg(from,target);if(!next.cost)continue;
      await visit(index+1,[...chain,target],walking+next.cost.walking,special+next.cost.special);
    }
  }
  try{
    await visit(0,[],0,0);
    if(!best)return failed('这些搜图区域尚未接通；可调整目标或改为沿撤离方向。');
    const result=await planAlongRoute({start,finish,targets:pending,...options,allowConditional,isCancelled,canInsert,
      requiredStops:best.chain,stageOf:point=>order.indexOf(regionOf(point)),
      route:async(a,b)=>{const key=JSON.stringify([a,b]);if(cache.has(key))return cache.get(key).result;return route(a,b);}});
    result.regionOrder=[...order];
    result.skipped.push(...unmapped);
    if(unmapped.some(row=>row.code==='unknown_region')&&result.status==='complete')result.status='partial';
    return result;
  }catch(error){if(error!==cancelled)throw error;return {status:'cancelled',stops:[],legs:[],skipped:[],finishReached:false,regionOrder:[...order]};}
}

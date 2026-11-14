import {loadNavRouter} from './nav-route.js?v=20260919-site-refresh-1';
import {pointPositionIssue} from './native-point-policy.js?v=20260910-map-counts-1';
import {loadOreMonsters} from './ore-monsters.js?v=20260919-site-refresh-1';
import {createTransitRouter} from './transit-route.js?v=20260919-transit-1';

export function routeFailureMessage(result,{hasAlternativeCandidates=false}={}){
  if(result?.status==='unreachable'&&result.specialLinksUnavailable)return '特殊通路资料读取失败，暂时无法判断跨区域路线，请重新生成路线。';
  if(result?.status==='unreachable'){
    const separate=result.snappedStart&&result.snappedEnd&&result.snappedStart.component!==result.snappedEnd.component;
    return separate?'当前路线数据尚未连接这两处，暂时无法生成完整路线。跨区域、跳跃或传送通路仍需补全；这不代表游戏中无法通行。':'本次未能找到完整路线，请更换目标或稍后重试。';
  }
  if(result?.status==='off_mesh')return '起点或终点尚未接入已知道路，暂时无法生成路线。'+(hasAlternativeCandidates?'如果选错了实际位置，可更换对应候选。':'可以先查看起终点位置，参照游戏内地图通行。');
  return '位置选择已改变，请重新生成路线。';
}
export const isDisplayRoute=result=>['complete','conditional'].includes(result?.status);
export const routeSummary=result=>result?.strategy==='transit-preview'?'通路位置示意 · 不代表本局已经开放':result?.overview?`完整路线 · ${result.targetCount} 个目标 · 约 ${Math.round(result.walkingDistance)} 游戏单位`:result?.status==='conditional'?`分段参考 · ${result.segments.filter(s=>s.kind==='special').length} 处特殊通路 · 步行约 ${Math.round(result.walkingDistance)} 游戏单位`:`路线已生成 · 约 ${Math.round(result.distance)} 游戏单位`;
export const conditionalRouteNote='绿色实线：已知普通路段。橙色虚线：传送或特殊通路的两端示意，不是实际移动轨迹。裂隙仅按所选方向使用；其他特殊通路仍需在局内确认。';

// Route state belongs to the 2D map and has no model/viewer dependencies.
export function createRouteUI(){
  if(window.navRouteUI)return window.navRouteUI;
  const states=new Map(),routers=new Map(),orePoints=new Map(),enabledTransit=new Map();
  let gameplay=null,locations=null,nativeLinkRequest=null,buildingLinkRequest=null,transitData=null,transitError='',mapId=window.atlas?.state.map||'janus',run=0;
  const transitLinks=id=>id==='suburbs'?(transitData?.links||[]):[];
  const enabled=id=>{if(!enabledTransit.has(id))enabledTransit.set(id,new Set());return enabledTransit.get(id);};
  const transitEndpoints=id=>transitLinks(id).flatMap(link=>['start','end'].map(role=>({id:`transit:${link.id}:${role}`,map:id,type:'transit_endpoint',label:link.label+(role==='start'?' · 入口':' · 落点'),worldPosition:{...link[role]},transitId:link.id})));
  const getState=id=>{if(!states.has(id))states.set(id,{start:'',end:'',result:null});return states.get(id);};
  const validPoint=p=>p?.worldPosition&&['x','y','z'].every(k=>Number.isFinite(p.worldPosition[k]));
  const sourceMap=id=>gameplay?.maps.find(m=>m.map===id);
  const locationMap=id=>locations?.maps.find(m=>m.map===id);
  const exitLabel=p=>p.configConfirmedHighRiskCandidate?p.label:`${p.label}（高危待核实）`;
  const choices=id=>{
    const m=sourceMap(id);if(!m)return [];
    const exits=(locationMap(id)?.candidates||[]).filter(p=>p.type==='evacuation_anchor').map(p=>({...p,label:exitLabel(p)}));
    // One endpoint per fixed exit location, including the NPC chosen by its high-risk suite.
    // Raw evacuation gadgets include difficulty variants and an unlocated return rift.
    return [...(m.configuredHighRiskEntryCandidates||[]),...exits,...(m.objects||[]).filter(p=>p.type!=='evacuation_device'),...(orePoints.get(id)||[]),...transitEndpoints(id)].filter(p=>validPoint(p)&&!pointPositionIssue(id,p));
  };
  function resolve(id,selection){
    const keys=typeof selection==='object'&&selection!==null?[selection.id,selection.sourceId]:[selection];
    const match=points=>keys.filter(k=>k!==undefined&&k!==null).map(k=>points.find(p=>String(p.id)===String(k))).find(Boolean);
    const chosen=match(choices(id));if(chosen)return chosen;
    // Saved endpoints and personal notes may still refer to an original entity ID.
    // Keep its original coordinates instead of silently snapping it to another variant.
    const original=match(sourceMap(id)?.objects||[]);if(validPoint(original)&&!pointPositionIssue(id,original))return original;
    for(const location of locationMap(id)?.candidates||[]){
      const variant=match(location.variants||[]);
      if(validPoint(variant))return {...location,...variant,label:exitLabel(location),locationId:location.id};
    }
  }
  function emit(id){const s=getState(id);window.dispatchEvent(new CustomEvent('navroutechange',{detail:{map:id,result:s.result,start:resolve(id,s.start)||null,end:resolve(id,s.end)||null}}));}
  const router=id=>{
    if(!routers.has(id))routers.set(id,(async()=>{
      let nativeLinks=[],specialLinksUnavailable=false;
      try{
        nativeLinkRequest ||= load('./research/native-route-links.json?v=20260909-version-3-2-1').catch(e=>{nativeLinkRequest=null;throw e;});
        const links=await nativeLinkRequest;
        if(links.coordinateSpace!=='source-world'||links.directionPolicy!=='source-start-to-end-only'||!Array.isArray(links.maps?.[id]?.links))throw Error('特殊通路资料格式无效');
        nativeLinks=links.maps[id].links;
      }catch{nativeLinkRequest=null;specialLinksUnavailable=true;}
      if(id==='janus'){
        try{
          buildingLinkRequest ||= load('./research/lumina-elevator-links.json?v=20260919-site-refresh-1').catch(error=>{buildingLinkRequest=null;throw error;});
          const building=await buildingLinkRequest;
          if(building.coordinateSpace!=='source-world'||!Array.isArray(building.links))throw Error('楼层连接资料格式无效');
          nativeLinks=[...nativeLinks,...building.links];
        }catch{buildingLinkRequest=null;specialLinksUnavailable=true;}
      }
      const base=await loadNavRouter(new URL(`./extraction/navmesh-research/${id}-navmesh.json`,import.meta.url),{nativeLinks});
      const nav=transitLinks(id).length?createTransitRouter(base,{links:transitLinks(id),getEnabled:()=>enabled(id)}):base;
      if(specialLinksUnavailable){routers.delete(id);return {...nav,route(...args){return {...nav.route(...args),specialLinksUnavailable:true};}};}
      return nav;
    })().catch(e=>{routers.delete(id);throw e;}));
    return routers.get(id);
  };
  function onMapChanged(id){
    if(!['janus','suburbs'].includes(id))throw Error('未知地图');
    mapId=id;run++;const s=getState(id);if(!s.start)s.start=String(choices(id)[0]?.id||'');emit(id);
  }
  function clear(){run++;getState(mapId).result=null;emit(mapId);}
  function setTransitEnabled(id,ids){
    if(id!=='suburbs')throw Error('本图没有已核对的裂隙连接');
    const requested=[...ids],known=new Set(transitLinks(id).map(link=>link.id));
    if(requested.some(key=>!known.has(key)))throw Error('未知通路，未修改本局设置');
    enabledTransit.set(id,new Set(requested));run++;getState(id).result=null;emit(id);
    window.dispatchEvent(new CustomEvent('navtransitchange',{detail:{map:id,enabled:[...enabled(id)]}}));
  }
  async function setEndpoint(id,selection,role){
    await api.ready;if(!['start','end'].includes(role))throw Error('路线端点类型无效');
    const p=resolve(id,selection);if(!p)throw Error('端点不在本图的世界坐标候选中');
    if(id!==mapId)onMapChanged(id);
    getState(id)[role]=String(p.id);clear();return api.getSelection();
  }
  async function plan(id,startSelection,endSelection){
    await api.ready;const start=resolve(id,startSelection),end=resolve(id,endSelection);
    if(!start||!end)throw Error('请选择起点和终点');
    if(id!==mapId)onMapChanged(id);
    const s=getState(id),token=++run;s.start=String(start.id);s.end=String(end.id);s.result=null;emit(id);
    const nav=await router(id);if(token!==run)return null;
    s.result=nav.route(start.worldPosition,end.worldPosition);emit(id);return s.result;
  }
  async function showResult(id,startSelection,endSelection,result,{shouldApply=()=>true}={}){
    await api.ready;if(!shouldApply())return null;const start=resolve(id,startSelection),end=resolve(id,endSelection);
    if(!start||!end||!isDisplayRoute(result))throw Error('路线或端点无效');
    // Publish a precomputed leg atomically; a transient empty-map event would
    // look like a manual clear and cancel the pending strategy display.
    mapId=id;
    run++;const s=getState(id);s.start=String(start.id);s.end=String(end.id);s.result=result;emit(id);return result;
  }
  const api={plan,clear,setEndpoint,onMapChanged,showResult,setTransitEnabled,getTransits:(id=mapId)=>transitLinks(id),getEnabledTransits:(id=mapId)=>[...enabled(id)],getTransitError:()=>transitError,getRouter:async id=>{await api.ready;if(!['janus','suburbs'].includes(id))throw Error('未知地图');return router(id);},getSelection:()=>({...getState(mapId),map:mapId}),getChoices:(id=mapId)=>choices(id)};
  window.navRouteUI=api;
  const load=path=>fetch(new URL(path,import.meta.url)).then(r=>{if(!r.ok)throw Error(`HTTP ${r.status}: ${path}`);return r.json();});
  // The optional layer has a bounded loader; a missing/invalid/timed-out layer
  // must leave all original endpoints and navigation data available.
  const optionalOre=Promise.all(['janus','suburbs'].map(async id=>{
    try{orePoints.set(id,(await loadOreMonsters(id)).filter(validPoint));}
    catch{orePoints.set(id,[]);}
  }));
  const optionalTransit=(async()=>{
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
    try{
      const response=await fetch(new URL('./research/suburbs-transit-links.json?v=20260919-transit-1',import.meta.url),{signal:controller.signal});
      if(!response.ok)throw Error('通路资料读取失败');
      const data=await response.json();
      if(data.schemaVersion!==1||data.coordinateSpace!=='source-world'||!Array.isArray(data.links))throw Error('通路资料格式无效');
      // Reuse the router's source/endpoint validation before exposing checkboxes.
      createTransitRouter({route(){},nearest(){},stats:{}},{links:data.links});
      transitData=data;
    }catch{transitError='裂隙资料暂时读取失败，请刷新页面重试；现有步行路线仍可使用。';}
    finally{clearTimeout(timeout);}
  })();
  api.ready=Promise.all([load('./gameplay-points-compact.json?v=20261021-map-launch-1'),load('./research/spawn-exit-locations.json?v=20260909-version-3-2-1'),optionalOre,optionalTransit]).then(([data,research])=>{gameplay=data;locations=research;onMapChanged(window.atlas?.state.map||mapId);return data;});
  api.ready.catch(()=>{});
  return api;
}

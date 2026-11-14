import {createRouteUI,routeFailureMessage,routeSummary,conditionalRouteNote} from './route-ui.js?v=20261021-map-launch-1';
import {loadSourceProjection} from './source-route-projection.js?v=20260912-map-panel-1';

// Source-map route controls share the existing world route service. All state
// here is transient and per map; personal notes and visit lists are untouched.
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const states=new Map(),projections=new Map(),mappings=new Map();
let shared,readyPromise,panel,loadError='';
const atlas=()=>window.atlas;
const currentMap=()=>atlas()?.state.map||'janus';
const sourceActive=()=>atlas()?.state.source2d==='source';
function state(map=currentMap()){
 if(!states.has(map))states.set(map,{map,start:null,end:null,startChoice:'',endChoice:'',route:null,status:'',message:'选择出生位置，再选择要去的点位。',planning:false,revision:0,search:''});
 return states.get(map);
}
// Client configuration candidates remain references until field verification.
const routeEligible=point=>point?.sourceLayer!=='client33';
const sourcePoints=()=>(atlas()?.allPoints()||[]).filter(routeEligible);
const mapping=(map,point)=>{
 if(!point||!routeEligible(point))return null;
 // These source markers are projections of an already identified world point.
 // Route to that same source ID and XYZ, never invert image coordinates or infer Y.
 if(point.type==='ore_boss'&&point.map===map&&point.worldPosition&&['x','y','z'].every(k=>Number.isFinite(point.worldPosition[k])))return {
  sourcePointId:String(point.id),choices:[{id:String(point.id),label:point.label,worldPosition:{...point.worldPosition},evidence:[{kind:'configured_ore_boss_world_position',source:'research/ore-monsters.json?v=20260918-suburbs-shard-fix-1'}]}]
 };
 return mappings.get(map)?.get(String(point.id));
};
const choices=(s,role)=>mapping(s.map,s[role])?.choices||[];
const chosen=(s,role)=>choices(s,role).find(c=>String(c.id)===s[role+'Choice']);
function initializeMap(){
 const s=state();if(!s.start){const spawn=sourcePoints().find(p=>p.type==='spawn');if(spawn)assignEndpoint(s,spawn,'start');}
 if(s.start&&!s.startChoice&&choices(s,'start').length===1)s.startChoice=String(choices(s,'start')[0].id);
 return s;
}
function assignEndpoint(s,point,role){
 s.externalLeg=null;
 s[role]=point||null;
 const list=choices(s,role);
 s[role+'Choice']=list.length===1?String(list[0].id):'';
 s.route=null;s.status='';s.revision++;s.message='';s.planning=false;
}
function message(s){
 if(s.externalLeg)return s.externalLeg.route.strategy==='transit-preview'?'当前显示通路入口与落点，不代表本局已经开放。':s.externalLeg.route.overview?'当前显示完整猛攻路线；编号对应上方目标顺序，灰色问号为未接入目标。':'当前显示猛攻路线的一段；可在上方切回完整路线。';
 if(loadError)return loadError;
 if(!mappings.has(s.map))return '正在读取路线位置…';
 if(s.planning)return '正在生成路线…';
 for(const role of ['start','end']){
  if(!s[role])return role==='start'?'请选择出发位置。':'请选择要去的点位。';
  const list=choices(s,role),label=role==='start'?'出发位置':'目标位置';
  if(!list.length)return `${label}尚未可靠定位，暂时无法生成路线。`;
  if(!chosen(s,role))return `${label}在原图对应多处候选，请先选择实际位置。`;
 }
 return s.message||'起终点已选，可以生成路线。';
}
function option(point){const region=atlas()?.regionName?.(point.region);const label=point.type==='spawn'?`${region?region+' · ':''}${point.label}`:point.type==='exit'?point.label:`${point.label} · ${point.id}`;return `<option value="${esc(point.id)}">${esc(label)}</option>`;}
function renderCandidates(s,role){
 const list=choices(s,role),holder=$(`source-route-${role}-ambiguity`),select=$(`source-route-${role}-choice`);
 holder.hidden=list.length<2;
 const ys=list.map(c=>c.worldPosition.y),min=Math.min(...ys),max=Math.max(...ys);
 select.innerHTML='<option value="">请选择位置候选</option>'+list.map((c,i)=>{
  const relative=max-min>1?(c.worldPosition.y-min<.5?'较低位置':max-c.worldPosition.y<.5?'较高位置':'中间高度'):'位置候选';
  const excluded=c.evidence?.some(e=>e.refreshCondition?.classification==='excluded_from_default_suite_draw');
  return `<option value="${esc(c.id)}">${String.fromCharCode(65+i)} · ${relative}${excluded?' · 高危默认未启用':''}</option>`;
 }).join('');
 select.value=s[role+'Choice'];
 $(`source-route-${role}-candidate-note`).textContent=list.length>1?`原图对应 ${list.length} 处候选。高度表示相对位置，不能直接当作官方楼层。`:'';
}
function render(){
 if(!panel||!atlas()?.state.ready)return;
 const s=initializeMap(),points=sourcePoints(),spawns=points.filter(p=>p.type==='spawn'),others=points.filter(p=>p.type!=='spawn');
 const displayed=s.externalLeg||s,route=displayed.route;
 $('source-route-start').innerHTML='<option value="">请选择出发位置</option>'+`<optgroup label="出生位置">${spawns.map(option).join('')}</optgroup><optgroup label="其他资料图点位">${others.map(option).join('')}</optgroup>`;
 $('source-route-start').value=s.start?.id||'';
 const query=s.search.trim().toLowerCase(),matches=points.filter(p=>`${p.label} ${p.id} ${p.type} ${p.region||''}`.toLowerCase().includes(query));
 if(s.end&&!matches.some(p=>p.id===s.end.id))matches.unshift(s.end);
 $('source-route-target').innerHTML='<option value="">搜索或选择目标点位</option>'+matches.map(option).join('');
 $('source-route-target').value=s.end?.id||'';
 if($('source-route-search').value!==s.search)$('source-route-search').value=s.search;
 renderCandidates(s,'start');renderCandidates(s,'end');
 $('source-route-plan').disabled=!!loadError||s.planning||!chosen(s,'start')||!chosen(s,'end');
 $('source-route-fit').disabled=!route&&!(displayed.start&&displayed.end);
 $('source-route-fit').textContent=route?.status==='conditional'?'查看分段参考':route?'查看全程':'查看起终点';
 $('source-route-clear').disabled=!s.externalLeg&&!s.route&&!s.end;
 $('source-route-status').textContent=message(s);
 $('source-route-status').dataset.status=displayed.status;
 const specials=route?.segments?.filter(segment=>segment.kind==='special')||[];
 $('source-route-legend').hidden=!specials.length;
 $('source-route-specials').hidden=!specials.length;
 $('source-route-specials').innerHTML=specials.map((segment,i)=>`<button type="button" data-special-index="${i}" ${segment.labelEn?`data-i18n-en="${esc(segment.labelEn)}"`:''}>${esc(segment.label||`查看特殊通路 ${i+1}`)}</button>`).join('');
 $('source-route-specials').querySelectorAll('button').forEach(button=>button.onclick=()=>{atlas().fitPoints?.(specials[Number(button.dataset.specialIndex)].points);document.body.classList.remove('filters-open');});
 const range=route?.heightRange;
 $('source-route-height').textContent=range&&range.maxY-range.minY>1?'路线包含不同高度的位置；平面重叠处请留意上行和下行。':'';
 $('source-route-evidence').textContent=route?`配准来源：${route.registrationEvidence.file}。路线保留 ${route.points.length} 个原始位置，高度范围 ${range.minY.toFixed(1)}～${range.maxY.toFixed(1)}。`:'资料图标记通过地标配准对应游戏位置。无法唯一对应时，需要选择位置候选。';
 if(specials.length)$('source-route-evidence').textContent+=' 特殊连接依据：'+specials.map(segment=>`${segment.id}（${segment.source.path} · ${segment.source.jsonPath}）`).join('；')+'。仅采用原始起终点顺序，未读取本局开放状态。';
 atlas().draw?.();
}
function openManual(){
 const holder=panel?.closest('details.assault-manual');if(holder)holder.open=true;
}
function manualIntent(){
 const s=state();s.revision++;s.externalLeg=null;openManual();
 window.dispatchEvent(new CustomEvent('manualrouteintent',{detail:{map:s.map}}));
 return s.map;
}
function revealControls(){
 openManual();
 atlas()?.showSide?.('routes');
 if(window.matchMedia('(max-width:570px)').matches)document.body.classList.add('filters-open');
 panel?.scrollIntoView({block:'nearest'});
}
async function setEndpoint(point,role,{reveal=true}={}){
 if(!['start','end'].includes(role))throw Error('无效路线端点');
 const requested=typeof point==='object'?point:atlas()?.allPoints().find(p=>String(p.id)===String(point));
 if(requested&&!routeEligible(requested))throw Error('配置候选暂不支持路线规划');
 const map=manualIntent();await ready();if(currentMap()!==map)return getState();
 const actual=point?sourcePoints().find(p=>String(p.id)===String(typeof point==='object'?point.id:point)):null;
 if(point&&!actual)throw Error('当前地图没有此资料点位');
 const s=state();assignEndpoint(s,actual,role);render();if(reveal)revealControls();
 return getState();
}
async function chooseCandidate(role,id){
 if(!['start','end'].includes(role))throw Error('无效路线端点');
 const map=manualIntent();await ready();if(currentMap()!==map)return getState();
 const s=state(),list=choices(s,role);s.externalLeg=null;
 if(id&&!list.some(c=>String(c.id)===String(id)))throw Error('候选位置不属于这个端点');
 s[role+'Choice']=id?String(id):'';s.route=null;s.status='';s.message='';s.planning=false;s.revision++;render();return getState();
}
function fit(){
 const s=getState();if(!s.route&&!(s.start&&s.end))return false;
 atlas()?.fitPoints?.([...(s.route?.points||[]),...(s.route?.assaultMarkers||[]),...[s.start,s.end].filter(Boolean)]);return true;
}
function clear(){
 manualIntent();
 const s=state();s.revision++;s.externalLeg=null;s.route=null;s.status='';s.message='路线已清除。';s.planning=false;render();return getState();
}
async function plan(){
 const requestedMap=manualIntent();await ready();if(currentMap()!==requestedMap)return null;
 const s=state(),start=chosen(s,'start'),end=chosen(s,'end');s.externalLeg=null;
 s.route=null;s.status='';atlas().draw?.();
 if(!start||!end){render();revealControls();return null;}
 const map=s.map,revision=++s.revision;s.planning=true;s.message='';render();
 try{
  const result=await shared.plan(map,start.id,end.id);
  if(s.revision!==revision||currentMap()!==map)return null;
  s.status=result?.status||'';
  s.route=projections.get(map).projectRoute(result);
  if(s.route){
   s.message=routeSummary(result);
   render();fit();if(result.status==='complete')document.body.classList.remove('filters-open');document.body.classList.add('detail-collapsed');
  }else{
   s.message=routeFailureMessage(result,{hasAlternativeCandidates:choices(s,'start').length>1||choices(s,'end').length>1});
  }
  return s.route;
 }catch(error){
  if(s.revision===revision){s.route=null;s.status='error';s.message='路线暂时不可用：'+error.message;}
  return null;
 }finally{if(s.revision===revision)s.planning=false;if(currentMap()===map)render();}
}
function getState(){
 const s=state(),projection=projections.get(s.map),choiceMarkers=[];
 if(s.externalLeg)return {map:s.map,...s.externalLeg,choiceMarkers:[],planning:false,message:message(s)};
 if(projection)for(const role of ['start','end']){
  const list=choices(s,role);
  if(list.length>1)list.forEach((choice,i)=>choiceMarkers.push({id:String(choice.id),...projection.project(choice.worldPosition),role,label:String.fromCharCode(65+i),selected:s[role+'Choice']===String(choice.id)}));
 }
 return {map:s.map,route:s.route,status:s.status,start:s.start,end:s.end,choiceMarkers,planning:s.planning,message:message(s),startChoice:s.startChoice,endChoice:s.endChoice};
}
function attachDetail(point){
 $('source-route-detail-actions')?.remove();if(!sourceActive()||!point||!routeEligible(point)||!$('detail'))return;
 const controls=document.createElement('div');controls.id='source-route-detail-actions';controls.className='detail-buttons source-route-detail-actions';
 controls.innerHTML='<h3>路线规划</h3><button id="source-route-detail-start">从这里出发</button><button id="source-route-detail-end">到这里去</button><button id="source-route-detail-go" class="primary-button">规划到这里</button>';
 const anchor=$('detail').querySelector('.detail-buttons');if(anchor)anchor.before(controls);else $('detail').append(controls);
 const action=(role,go)=>async()=>{try{await setEndpoint(point,role,{reveal:!go});atlas().showSide?.('routes');if(go)await plan();}catch(error){state().message=error.message;render();revealControls();}};
 $('source-route-detail-start').onclick=action('start',false);$('source-route-detail-end').onclick=action('end',false);$('source-route-detail-go').onclick=action('end',true);
}
function createPanel(){
 if(panel)return;panel=document.createElement('section');panel.id='source-route-panel';
 panel.innerHTML=`<div class="section-label">资料图路线</div><label for="source-route-start" class="small muted">从哪里出发</label><select id="source-route-start" aria-label="资料图路线起点"></select><div id="source-route-start-ambiguity" hidden><label for="source-route-start-choice" class="small">选择出发位置候选</label><select id="source-route-start-choice"></select><p id="source-route-start-candidate-note" class="small muted"></p></div><label for="source-route-search" class="small muted">去哪里</label><input id="source-route-search" type="search" placeholder="搜索箱子、撤离点或编号" aria-label="搜索路线目标"><select id="source-route-target" aria-label="资料图路线终点"></select><div id="source-route-end-ambiguity" hidden><label for="source-route-end-choice" class="small">选择目标位置候选</label><select id="source-route-end-choice"></select><p id="source-route-end-candidate-note" class="small muted"></p></div><div class="source-route-actions"><button id="source-route-plan" class="primary-button" disabled>生成路线</button><button id="source-route-fit" disabled>查看全程</button><button id="source-route-clear" disabled>清除路线</button></div><p id="source-route-status" class="small" role="status">正在读取路线位置…</p><p id="source-route-height" class="small muted"></p><details class="route-evidence"><summary>路线依据与限制</summary><p id="source-route-evidence" class="small muted"></p><p class="small muted">按已知道路连接，未应用本局门禁和动态障碍。资料图配准存在位置误差；不自动补接传送、跳跃或不相连的道路。</p></details>`;
 $('side-routes')?.prepend(panel);
 const coverage=document.createElement('p');coverage.className='small muted';coverage.id='source-route-coverage';
 coverage.textContent='路线功能测试中：普通路段与特殊通路分开展示，部分跨区域通路仍待补全。';
 panel.querySelector('.section-label').after(coverage);
 const legend=document.createElement('p');legend.id='source-route-legend';legend.className='small';legend.hidden=true;legend.textContent=conditionalRouteNote;
 const specialControls=document.createElement('div');specialControls.id='source-route-specials';specialControls.className='nearby-list';specialControls.hidden=true;
 $('source-route-status').after(legend,specialControls);
 const selectRole=role=>event=>setEndpoint(event.target.value,role,{reveal:false}).catch(error=>{state().message=error.message;render();});
 $('source-route-start').onchange=selectRole('start');$('source-route-target').onchange=selectRole('end');
 $('source-route-search').oninput=event=>{state().search=event.target.value;render();};
 for(const role of ['start','end'])$(`source-route-${role}-choice`).onchange=event=>chooseCandidate(role,event.target.value).catch(error=>{state().message=error.message;render();});
 $('source-route-plan').onclick=()=>plan().catch(error=>{state().message=error.message;render();});
 $('source-route-fit').onclick=()=>{if(fit())document.body.classList.remove('filters-open');};$('source-route-clear').onclick=clear;
}
function ready(){
 if(!readyPromise)readyPromise=(async()=>{
  createPanel();shared=createRouteUI();
  const request=fetch(new URL('./research/source-route-endpoints.json?v=20261021-map-launch-1',import.meta.url)).then(r=>{if(!r.ok)throw Error(`位置资料读取失败（${r.status}）`);return r.json();});
  const [data,,janus,suburbs]=await Promise.all([request,shared.ready,loadSourceProjection('janus'),loadSourceProjection('suburbs')]);
  for(const map of data.maps)mappings.set(map.map,new Map(map.points.map(p=>[String(p.sourcePointId),p])));
  projections.set('janus',janus);projections.set('suburbs',suburbs);
  if(!mappings.has('janus')||!mappings.has('suburbs'))throw Error('缺少地图的位置对应资料');
  render();if(atlas()?.state.selected)attachDetail(sourcePoints().find(p=>p.id===atlas().state.selected));return api;
 })().catch(error=>{loadError='路线位置尚未读取：'+error.message;render();throw error;});
 return readyPromise;
}
async function showWorldLeg(map,leg,{shouldApply=()=>true}={}){
 if(!routeEligible(leg?.from)||!routeEligible(leg?.to))return false;
 if(currentMap()!==map||!shouldApply())return false;
 initializeMap();
 const s=state(map),revision=++s.revision;
 await ready();if(currentMap()!==map||s.revision!==revision||!shouldApply())return false;
 const projection=projections.get(map),route=projection.projectRoute(leg.route);
 if(!route)return false;
 s.planning=false;s.externalLeg={route,status:route.status,start:{...leg.from,...projection.project(leg.from.worldPosition)},end:{...leg.to,...projection.project(leg.to.worldPosition)}};
 render();fit();return true;
}
const api={getState,fit,clear,plan,setEndpoint,chooseCandidate,ready,showWorldLeg,clearWorldLeg(){const s=state();s.revision++;s.externalLeg=null;render();},open(){revealControls();}};
window.sourceRoute2D=api;
window.addEventListener('atlasready',()=>ready().catch(()=>{}));
window.addEventListener('atlasmapchange',()=>{
 for(const s of states.values()){s.revision++;s.planning=false;}
 $('source-route-detail-actions')?.remove();render();
});
window.addEventListener('atlasselection',event=>attachDetail(event.detail?.point));
window.addEventListener('navtransitchange',event=>{
 const s=states.get(event.detail?.map);if(!s)return;
 s.revision++;s.planning=false;s.route=null;s.externalLeg=null;s.status='';s.message='本局通路已调整，请重新生成路线。';render();
});
window.addEventListener('atlassourcechange',()=>{if(!sourceActive())$('source-route-detail-actions')?.remove();else if(atlas()?.state.selected)attachDetail(sourcePoints().find(p=>p.id===atlas().state.selected));render();});
if(atlas()?.state.ready)ready().catch(()=>{});

export {api as sourceRoute2D};

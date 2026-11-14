import {createRouteUI} from './route-ui.js?v=20261021-map-launch-1';
import {loadOreMonsters} from './ore-monsters.js?v=20260919-site-refresh-1';
import {planAlongRoute} from './along-route-planner.js?v=20260919-site-refresh-1';
import {createRegionLookup,preferredSearchOrder,planRegionalSearch} from './regional-search-route.js?v=20260919-site-refresh-1';
import {electronicTargets,compatibleSearchLocations} from './along-route-targets.js?v=20260919-site-refresh-1';
import {assaultOverview} from './assault-route-display.js?v=20260919-site-refresh-1';
import {bossCommunityDetails} from './boss-community-guide.js?v=20260919-site-refresh-1';

const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const states=new Map(),data=new Map(),shared=createRouteUI();
let panel,readyRequest,revision=0,displayRevision=0,loadError='',managingDisplay=false;
let regionPolicy=null,regionOf=()=>null;
const regionLabels={construction:['白鸽工地','Dove Street Construction Site'],street:['六昏街','Six Dusk Street'],lumina:['光映中心','Lumina Central']};
const atlas=()=>window.atlas,mapId=()=>atlas()?.state.map||'janus';
function state(){const map=mapId();if(!states.has(map))states.set(map,{start:'',finish:'',selected:new Set(),visited:new Set(),kinds:new Set(['keyroom','ore_boss','electronic']),detourRatio:.35,allowConditional:true,plan:null,busy:false,activeLeg:-1,message:''});return states.get(map);}
const info=()=>data.get(mapId());
const hasExcludedRooms=(s,d)=>d.targets.some(p=>p.kind==='keyroom'&&!s.selected.has(p.id));
// Current container data has no verified box→locked-room join. In missing-key
// mode, do not silently send the player to an unknown locked-room container.
const selectedTargets=(s,d)=>d.targets.filter(p=>s.selected.has(p.id)&&!s.visited.has(p.id)&&s.kinds.has(p.kind)&&!(p.kind==='electronic'&&hasExcludedRooms(s,d)));
function searchOrder(s,d){
 if(mapId()!=='janus'||!regionPolicy)return null;
 const start=[...d.starts,...d.targets,...d.exits].find(p=>p.id===s.start),finish=d.exits.find(p=>p.id===s.finish);
 if(!regionOf(start)||!regionOf(finish))return null;
 return s.regionOrder?.length?[...s.regionOrder]:preferredSearchOrder(regionPolicy,start,finish);
}
function setBilingual(node,zh,en){node.dataset.i18nEn=en;node.textContent=zh;}
const option=p=>`<option value="${esc(p.id)}">${esc(p.label)}</option>`;
function clearDisplay(){displayRevision++;managingDisplay=true;try{window.sourceRoute2D?.clearWorldLeg();if(shared.getSelection().result?.strategy==='assault')shared.clear();}finally{managingDisplay=false;}}
function stopAssaultDisplay(clearShared=false){if(managingDisplay)return;revision++;const s=state();s.activeLeg=-1;s.displayMode=null;s.busy=false;if(clearShared)clearDisplay();else window.sourceRoute2D?.clearWorldLeg();render();}
function invalidate(){revision++;const s=state();s.plan=null;s.busy=false;s.activeLeg=-1;s.displayMode=null;s.message='目标已调整，请重新生成。';clearDisplay();}
function mount(){
 const native=atlas()?.state.source2d==='native',host=$(native?'native-map-controls':'side-routes');
 if(host&&panel&&host.firstElementChild!==panel)host.prepend(panel);
 for(const id of ['source-route-panel','native2d-route-panel']){const manual=$(id);if(!manual||manual.parentElement.classList.contains('assault-manual'))continue;
  const details=document.createElement('details');details.className='assault-manual';const summary=document.createElement('summary');summary.textContent='指定起点与终点 · 单段路线';details.append(summary);manual.before(details);details.append(manual);
 }
}
function render(){
 if(!panel)return;mount();const s=state(),d=info();
 $('assault-status').textContent=loadError||s.message||'';
 $('assault-status').hidden=!$('assault-status').textContent;
 $('assault-retry').hidden=!loadError;$('assault-form').hidden=!!loadError||!d;
 if(!d)return;
 const all=[...d.starts,...d.targets,...d.exits],current=all.find(p=>p.id===s.start);
 $('assault-start').innerHTML=`<option value="">选择出生点</option><optgroup label="出生位置">${d.starts.map(option).join('')}</optgroup>${current&&!d.starts.some(p=>p.id===current.id)?`<optgroup label="当前出发目标">${option(current)}</optgroup>`:''}`;
 $('assault-start').value=s.start;
 $('assault-finish').innerHTML='<option value="">选择本局已开放的撤离点</option>'+d.exits.map(option).join('');$('assault-finish').value=s.finish;
 $('assault-special').checked=s.allowConditional;$('assault-detour').value=String(s.detourRatio);
 const order=searchOrder(s,d),regional=!!order&&s.searchMode!=='along';
 $('assault-search-mode').value=regional?'regional':'along';$('assault-search-mode').querySelector('[value="regional"]').disabled=!order;
 $('assault-mode-row').hidden=!order;
 $('assault-region-order').hidden=!regional;
 if(regional)setBilingual($('assault-region-order'),order.map(id=>regionLabels[id][0]).join(' → '),order.map(id=>regionLabels[id][1]).join(' → '));
 setBilingual($('assault-detour-label'),regional?'额外绕路':'绕路范围',regional?'Extra detours':'Detour limit');
 for(const input of panel.querySelectorAll('[data-kind]')){input.checked=s.kinds.has(input.dataset.kind);input.disabled=!d.targets.some(p=>p.kind===input.dataset.kind)||(input.dataset.kind==='electronic'&&hasExcludedRooms(s,d));if(input.disabled)input.checked=false;}
 $('assault-card-caution').hidden=!hasExcludedRooms(s,d);
 $('assault-missing-enemies').hidden=d.targets.some(p=>p.kind==='ore_boss');
 $('assault-boss-community').innerHTML=bossCommunityDetails(mapId());
 $('assault-transit').hidden=mapId()!=='suburbs';
 const transit=shared.getTransits(mapId()),enabled=new Set(shared.getEnabledTransits(mapId()));
 $('assault-transit-error').textContent=shared.getTransitError();
 $('assault-transit-options').innerHTML=transit.map(link=>`<div class="transit-option"><label class="assault-target"><input type="checkbox" data-transit="${esc(link.id)}" ${enabled.has(link.id)?'checked':''}><span><b data-i18n-en="${esc(link.labelEn)}">${esc(link.label)}</b></span></label><button type="button" data-transit-view="${esc(link.id)}">查看入口与落点</button></div>`).join('');
 $('assault-transit-count').textContent=`本局已确认 ${enabled.size} 条传送通路`;
 for(const kind of ['ore_boss','keyroom','electronic']){
  const targets=d.targets.filter(p=>p.kind===kind);
  $('assault-'+kind).innerHTML=targets.map(p=>`<label class="assault-target"><input type="checkbox" data-target="${esc(p.id)}" ${s.selected.has(p.id)?'checked':''}><span><b>${esc(p.label)}</b>${kind==='ore_boss'?'<small>刷新与掉落以本局为准</small>':''}</span></label>`).join('')||'<p class="small muted">暂无可用于导航的目标。</p>';
 }
 $('assault-counts').textContent=`${d.targets.filter(p=>p.kind==='keyroom'&&s.selected.has(p.id)).length} 个卡房可参与规划`;
 $('assault-unmapped').hidden=!d.unmapped.length;$('assault-unmapped-list').innerHTML=d.unmapped.map(p=>`<li>${esc(p.label)}：${esc(p.reason)}</li>`).join('');
 $('assault-generate').disabled=s.busy||!s.start||!s.finish;$('assault-generate').textContent=s.busy?'正在规划…':'生成顺路路线';
 $('assault-cancel').hidden=!s.busy;$('assault-clear').disabled=!s.plan&&!s.busy;
 const plan=s.plan;$('assault-result').hidden=!plan;if(!plan)return;
 const count=kind=>plan.stops.filter(p=>p.kind===kind).length;
 $('assault-result-summary').textContent=`${count('keyroom')} 个卡房 · ${count('ore_boss')} 个敌人候选 · ${count('electronic')} 个电子箱检查点`;
 $('assault-coverage').textContent=plan.finishReached?`路线已安排 · ${plan.stops.length} 个沿途目标`:'暂未接通到撤离点';
 $('assault-coverage').classList.toggle('incomplete',!plan.finishReached);
 if(plan.finishReached&&plan.regionOrder)setBilingual($('assault-distance'),`已知步行约 ${Math.round(plan.walkingDistance)} · 搜图基础路线外增加 ${Math.round(Math.max(0,plan.detourDistance||0))} 游戏单位`,`Known walking distance ≈ ${Math.round(plan.walkingDistance)} · ${Math.round(Math.max(0,plan.detourDistance||0))} game units beyond the regional baseline`);
 else{delete $('assault-distance').dataset.i18nEn;$('assault-distance').textContent=plan.finishReached?`已知步行约 ${Math.round(plan.walkingDistance)} · 比直达多走 ${Math.round(Math.max(0,plan.detourDistance||0))} 游戏单位`:'';}
 $('assault-overview').disabled=!plan.legs.length;
 $('assault-overview').textContent=s.displayMode==='overview'?'正在显示整条路线':'显示整条路线';
 $('assault-display-note').textContent=s.displayMode==='leg'?`当前显示第 ${s.activeLeg+1} 段`:'';
 $('assault-exit-note').textContent=plan.finishReached?'撤离开放状态以本局为准。':'资料暂缺连接，可先在地图上查看两端位置。';
 $('assault-conditional-note').hidden=!plan.conditionalCount;$('assault-conditional-note').textContent='橙色虚线为电梯或特殊通路，请按局内开放状态通行。';
 $('assault-steps').innerHTML=plan.legs.map((leg,i)=>`<li class="${s.activeLeg===i?'active':''}"><b>${i+1}. ${esc(leg.to.label)}</b><small>${Math.round(leg.route.status==='conditional'?leg.route.walkingDistance:leg.route.distance)} 游戏单位${leg.to.kind==='electronic'?' · 沿途检查':''}</small>${(leg.route.segments||[]).filter(segment=>segment.kind==='special'&&segment.label).map(segment=>`<small class="transit-leg" data-i18n-en="${esc(segment.labelEn||'Special passage')}">${esc(segment.label)}</small>`).join('')}<div><button type="button" data-leg="${i}">查看这段</button>${leg.to.kind==='exit'?'':`<button type="button" data-continue="${i}">从这里继续</button>`}</div></li>`).join('');
 $('assault-skipped').hidden=!plan.skipped.length;$('assault-skipped-count').textContent=`未安排的目标（${plan.skipped.length}）`;
 $('assault-skipped-list').innerHTML=plan.skipped.map(row=>`<li data-skipped="${esc(row.target.id)}"><b>${esc(row.target.label)}</b><br>${esc(row.reason)}</li>`).join('');
}
async function showOverview(){
 const s=state(),plan=s.plan,d=info(),map=mapId(),token=revision,displayToken=++displayRevision;
 if(!plan?.legs.length)return;
 const start=[...d.starts,...d.targets,...d.exits].find(point=>point.id===s.start),finish=d.exits.find(point=>point.id===s.finish);
 const result=assaultOverview(plan,start,finish),last=plan.legs.at(-1).to;
 const shouldApply=()=>token===revision&&displayToken===displayRevision&&mapId()===map;
 await shared.showResult(map,start,last,result,{shouldApply});if(!shouldApply())return;
 await window.sourceRoute2D?.showWorldLeg(map,{from:start,to:last,route:result},{shouldApply});if(!shouldApply())return;
 if(atlas().state.source2d==='native')window.nativeMap2D?.fitRoute();
 s.activeLeg=-1;s.displayMode='overview';render();document.body.classList.add('detail-collapsed');
 if(window.matchMedia('(max-width:570px)').matches)document.body.classList.remove('filters-open');
}
async function showLeg(index){
 const s=state(),plan=s.plan,leg=plan?.legs[index],map=mapId(),token=revision,displayToken=++displayRevision;if(!leg)return;
 const shouldApply=()=>token===revision&&displayToken===displayRevision&&mapId()===map;
 const result={...leg.route,strategy:'assault'};
 await shared.showResult(map,leg.from,leg.to,result,{shouldApply});if(!shouldApply())return;
 await window.sourceRoute2D?.showWorldLeg(map,{...leg,route:result},{shouldApply});if(!shouldApply())return;
 if(atlas().state.source2d==='native')window.nativeMap2D?.fitRoute();
 s.activeLeg=index;s.displayMode='leg';render();document.body.classList.add('detail-collapsed');
 if(window.matchMedia('(max-width:570px)').matches)document.body.classList.remove('filters-open');
}
async function generate(){
 await ready();const s=state(),d=info(),map=mapId(),token=++revision;
 const all=[...d.starts,...d.targets,...d.exits],start=all.find(p=>p.id===s.start),finish=d.exits.find(p=>p.id===s.finish);
 if(!start||!finish)return;
 const order=searchOrder(s,d),regional=!!order&&s.searchMode!=='along';
 s.busy=true;s.plan=null;s.activeLeg=-1;s.displayMode=null;s.message=regional?'正在按区域顺序安排目标…':'正在沿撤离方向安排目标…';clearDisplay();render();
 try{
  const nav=await shared.getRouter(map);if(token!==revision||mapId()!==map)return;
  const visited=d.targets.filter(p=>s.visited.has(p.id)),options={start,finish,targets:selectedTargets(s,d),detourRatio:s.detourRatio,canInsert:(stops,candidate)=>compatibleSearchLocations([...visited,...stops],candidate),route:(a,b)=>nav.route(a,b,{allowConditional:s.allowConditional}),allowConditional:s.allowConditional,isCancelled:()=>token!==revision||mapId()!==map};
  const plan=regional?await planRegionalSearch({...options,order,regionOf}):await planAlongRoute(options);
  if(token!==revision||mapId()!==map||plan.status==='cancelled')return;
  s.plan=plan;s.message=plan.finishReached?'':plan.reason||'暂缺到所选撤离点的连接，请查看路线详情。';
  if(plan.legs.length)await showOverview();
 }catch(error){if(token===revision)s.message='路线暂时无法生成：'+error.message;}
 finally{if(token===revision){s.busy=false;render();}}
}
function createPanel(){
 if(panel)return;panel=document.createElement('section');panel.id='assault-route-panel';
 panel.innerHTML=`
 <div class="assault-heading"><span>路线规划</span><b>顺路搜索</b></div>
 <p class="small muted assault-intro">选好起终点，沿途搜房、打怪、开箱。</p>
 <div id="assault-form" hidden>
  <label for="assault-start" class="assault-label"><i>1</i> 出生点</label><select id="assault-start"></select>
  <label for="assault-finish" class="assault-label"><i>2</i> 撤离点</label><select id="assault-finish"></select>
  <div id="assault-mode-row" hidden><label for="assault-search-mode" class="assault-label" data-i18n-en="Search style">搜图方式</label><select id="assault-search-mode"><option value="regional" data-i18n-en="Search by area">分区搜图</option><option value="along" data-i18n-en="Along the extraction route">沿撤离方向</option></select><p id="assault-region-order" class="assault-region-order" hidden></p></div>
  <fieldset class="assault-kinds"><legend>沿途想搜什么</legend>
   <label><input type="checkbox" data-kind="keyroom" checked><span>卡房</span></label>
   <label><input type="checkbox" data-kind="ore_boss" checked><span>碎片怪</span></label>
   <label><input type="checkbox" data-kind="electronic" checked><span>电子箱</span></label>
  </fieldset>
  <p id="assault-missing-enemies" class="small muted" hidden>本图碎片怪仅有资料图标注，导航位置待核对。</p>
  <p id="assault-card-caution" class="small muted" hidden>部分卡房已排除；电子箱门禁归属待核对，暂不自动安排。</p>
  <div class="assault-detour-row"><label id="assault-detour-label" for="assault-detour">绕路范围</label><select id="assault-detour"><option value="0.15">少绕路 · +15%</option><option value="0.35" selected>顺路搜 · +35%</option><option value="0.75">多搜一点 · +75%</option></select></div>
  <div class="assault-actions"><button type="button" id="assault-generate" class="primary-button">生成顺路路线</button><button type="button" id="assault-cancel" hidden>取消计算</button><button type="button" id="assault-clear">清除</button></div>
  <details class="assault-settings"><summary>房卡与路线设置</summary>
   <p class="small muted">卡房默认参与规划；缺卡的房间取消勾选。</p><div id="assault-keyroom" class="assault-targets"></div><p id="assault-counts" class="small"></p>
   <button type="button" id="assault-select-all">恢复默认目标</button>
   <details id="assault-transit" hidden><summary>本局可用的传送</summary><p class="small muted">只勾选本局已确认开放的方向。</p><div id="assault-transit-options"></div><p id="assault-transit-count" class="small"></p><p id="assault-transit-error" class="small" role="status"></p><button type="button" id="assault-transit-reset">清空通路选择</button><p id="assault-billy-note" class="small muted">比利大电梯的精确端点仍在核对。</p></details>
   <details><summary>选择敌人候选</summary><p class="small muted">候选不代表必刷或必掉碎片。</p><div id="assault-ore_boss" class="assault-targets"></div></details>
   <details><summary>选择电子箱检查点</summary><p class="small muted">按沿途位置安排检查，刷新以本局为准。</p><div id="assault-electronic" class="assault-targets"></div></details>
   <label class="assault-target assault-special"><input type="checkbox" id="assault-special"><span>使用电梯与特殊通路<small>橙色虚线标出，开放条件以本局为准。</small></span></label>
   <button type="button" id="assault-use-current">使用当前单段路线起点</button>
   <details id="assault-unmapped" hidden><summary>待补充入口的房间</summary><ul id="assault-unmapped-list" class="small"></ul></details>
  </details>
 </div>
 <p id="assault-status" class="small" role="status">正在读取路线目标…</p><button type="button" id="assault-retry" hidden>重新读取目标</button>
 <section id="assault-result" hidden>
  <p id="assault-coverage" role="status"></p><b id="assault-result-summary"></b><p id="assault-distance" class="small muted"></p>
  <button type="button" id="assault-overview">显示整条路线</button><p id="assault-display-note" class="small muted"></p><ol id="assault-steps"></ol>
  <p id="assault-exit-note" class="small muted"></p><p id="assault-conditional-note" class="small muted" hidden></p>
  <details id="assault-skipped" hidden><summary id="assault-skipped-count">未安排的目标</summary><ul id="assault-skipped-list" class="small"></ul></details>
 </section>
 <details class="assault-rules"><summary>规划依据与说明</summary>
  <p data-i18n-en="Search by area visits the selected areas in order, then extracts. Its baseline passes through a selected reachable target in each non-final area that has candidates. A stop order does not prevent the connecting paths from passing through another area.">分区搜图先按区域顺序搜索，再撤离；有候选的前序区域各选一个已勾选、可达目标作为基础路线。顺序约束的是搜取目标，连接路段仍可能经过其他区域。</p>
  <p data-i18n-en="In regional mode, extra walking is limited relative to the regional baseline; along-route mode uses direct extraction as its baseline. All key rooms are candidates, not mandatory visits. Routing uses known directed paths and does not promise full coverage, optimal loot or travel time.">分区模式按搜图基础路线计算额外绕路范围；沿撤离方向模式按直达撤离路线计算。卡房都是候选，不要求全部搜完。路径使用已知有向道路，不保证全覆盖、最优收益或实际耗时。</p>
  <p>电子箱是沿途检查点，不是必刷数量。同位置配置合并、不同高度分开；已知互斥的默认刷新配置不会同时选入。敌人候选不代表必掉赭石碎片。</p>
  <p>玩家地图与游戏配置交叉参考；当前不读取本局刷新、房卡或撤离状态。特殊通路以橙色虚线标出。</p>
  <div id="assault-boss-community"></div>
  <div class="assault-sources"><a href="https://www.miyoushe.com/zzz/article/78167993" target="_blank" rel="noreferrer">玩家顺路搜索参考 ↗</a><a href="https://forum.gamer.com.tw/Co.php?bsn=74860&sn=59491" target="_blank" rel="noreferrer">光映中心楼层参考 ↗</a><a href="research/assault-keyrooms.json?v=20260912-map-panel-1" target="_blank" rel="noreferrer">房卡与入口依据 ↗</a></div>
 </details>`;
 mount();
 panel.addEventListener('change',event=>{const t=event.target,s=state();if(t.dataset.transit){const ids=new Set(shared.getEnabledTransits(mapId()));if(t.checked)ids.add(t.dataset.transit);else ids.delete(t.dataset.transit);shared.setTransitEnabled(mapId(),ids);return;}if(t.dataset.kind){if(t.checked)s.kinds.add(t.dataset.kind);else s.kinds.delete(t.dataset.kind);}else if(t.id==='assault-search-mode')s.searchMode=t.value;else if(t.id==='assault-detour')s.detourRatio=Number(t.value);else if(t.dataset.target){s.visited.delete(t.dataset.target);if(t.checked)s.selected.add(t.dataset.target);else s.selected.delete(t.dataset.target);}else if(t.id==='assault-start'){s.start=t.value;s.visited.clear();s.regionOrder=null;}else if(t.id==='assault-finish'){s.finish=t.value;s.regionOrder=null;}else if(t.id==='assault-special')s.allowConditional=t.checked;else return;invalidate();render();});
 panel.addEventListener('click',async event=>{const b=event.target.closest('button');if(!b)return;
  try{
   if(b.id==='assault-transit-reset'){shared.setTransitEnabled(mapId(),[]);return;}
   if(b.dataset.transitView){
    const map=mapId(),link=shared.getTransits(map).find(row=>row.id===b.dataset.transitView);if(!link)return;
    const token=++displayRevision,from=shared.getChoices(map).find(row=>row.id===`transit:${link.id}:start`),to=shared.getChoices(map).find(row=>row.id===`transit:${link.id}:end`);
    const shouldApply=()=>mapId()===map&&token===displayRevision;
    const route={coordinateSpace:'source-world',strategy:'transit-preview',status:'conditional',points:[],polygonPath:[],walkingDistance:0,specialLinkCount:1,warnings:['仅查看通路两端位置，不代表本局已经开放。'],segments:[{...link,kind:'special',points:[link.start,link.end]}]};
    await shared.showResult(map,from,to,route,{shouldApply});if(!shouldApply())return;
    await window.sourceRoute2D?.showWorldLeg(map,{from,to,route},{shouldApply});if(!shouldApply())return;
    if(atlas().state.source2d==='native')window.nativeMap2D?.fitRoute();
    state().message='已显示通路入口与落点；是否开放请以本局为准。';render();return;
   }
   if(b.id==='assault-generate')return await generate();
   if(b.id==='assault-overview')return await showOverview();
   if(b.id==='assault-select-all'){state().visited.clear();state().selected=new Set(info().targets.filter(p=>p.defaultSelected!==false).map(p=>p.id));invalidate();render();return;}
   if(b.id==='assault-cancel'){invalidate();state().message='计算已取消。';render();}
   if(b.id==='assault-clear'){invalidate();state().message='路线已清除。';render();}
   if(b.id==='assault-retry'){readyRequest=null;loadError='';await ready();}
   if(b.id==='assault-use-current'){const source=atlas().state.source2d==='source',selected=source?window.sourceRoute2D?.getState():shared.getSelection(),id=source?(selected?.startChoice||(selected?.route?.strategy==='assault'?selected.start?.id:'')):selected?.start,p=shared.getChoices(mapId()).find(p=>p.id===id);if(selected?.map===mapId()&&p){const d=info();if(![...d.starts,...d.targets,...d.exits].some(x=>x.id===p.id))d.starts.push(p);state().start=p.id;state().visited.clear();state().regionOrder=null;invalidate();render();}else{state().message='请先在单段路线中选择起点；有多个位置候选时须选定实际位置。';render();}}
   if(b.dataset.leg!==undefined)await showLeg(Number(b.dataset.leg));
   if(b.dataset.continue!==undefined){const s=state(),i=Number(b.dataset.continue),leg=s.plan?.legs[i];if(!leg)return;if(s.plan.regionOrder){const stage=s.plan.regionOrder.indexOf(regionOf(leg.to));s.regionOrder=s.plan.regionOrder.slice(Math.max(0,stage));}for(const step of s.plan.legs.slice(0,i+1))s.visited.add(step.to.id);s.start=leg.to.id;invalidate();await generate();}
  }catch(error){state().message=error.message;render();}
 });
}
async function ready(){
 if(!readyRequest)readyRequest=(async()=>{
  createPanel();await shared.ready;
  const response=await fetch(new URL('./research/assault-keyrooms.json?v=20260912-map-panel-1',import.meta.url));if(!response.ok)throw Error('门禁房资料读取失败');const rooms=await response.json();if(rooms.schemaVersion!==1||!Array.isArray(rooms.maps))throw Error('门禁房资料格式无效');
  try{const response=await fetch(new URL('./research/janus-search-regions.json?v=20260919-site-refresh-1',import.meta.url));if(!response.ok)throw Error('区域资料读取失败');const policy=await response.json();if(policy.schemaVersion!==1||policy.map!=='janus'||!Array.isArray(policy.points)||!Array.isArray(policy.preferredOrders))throw Error('区域资料格式无效');regionPolicy=policy;regionOf=createRegionLookup(policy);}catch{regionPolicy=null;regionOf=()=>null;}
  for(const map of ['janus','suburbs']){
   const choices=shared.getChoices(map),ids=new Set(choices.map(p=>p.id)),layer=rooms.maps.find(m=>m.map===map);if(!layer)throw Error('缺少地图的门禁房资料');
   const bosses=(await loadOreMonsters(map)).filter(p=>ids.has(p.id)).map((p,i)=>({...p,label:`${p.label} · 候选 ${String(i+1).padStart(2,'0')}`})),nav=await shared.getRouter(map),unmapped=[...(layer.unmapped||[])],keyrooms=[];
   for(const room of layer.points){
    let point=choices.find(p=>p.id===room.id);if(!point){unmapped.push({label:room.label,reason:'入口尚未可靠定位'});continue;}
    let endpointKind='reader';
    if(!nav.nearest(point.worldPosition)&&room.doorId){const door=choices.find(p=>p.id===room.doorId);if(door&&nav.nearest(door.worldPosition)){point=door;endpointKind='door';}}
    if(!nav.nearest(point.worldPosition)){unmapped.push({label:room.label,reason:'原始门与读卡处位置尚未接入已知道路'});continue;}
    keyrooms.push({...room,id:point.id,worldPosition:{...point.worldPosition},kind:'keyroom',endpointKind});
   }
   const starts=choices.filter(p=>p.configConfirmedHighRiskEntryCandidate).map(p=>({...p,label:p.label.replace('高危入口候选','出生位置')}));
   const exits=choices.filter(p=>p.type==='evacuation_anchor'&&p.configConfirmedHighRiskCandidate).map(p=>({...p,label:p.label.replace('撤离锚点·','')+' · '+p.id.split('-').at(-1),kind:'exit'}));
   const electronics=electronicTargets(choices,nav);
   data.set(map,{starts,exits,targets:[...bosses,...keyrooms,...electronics],unmapped});
   if(!states.has(map))states.set(map,{start:starts[0]?.id||'',finish:'',selected:new Set([...keyrooms,...bosses.filter(p=>p.defaultSelected!==false),...electronics].map(p=>p.id)),visited:new Set(),kinds:new Set(['keyroom','ore_boss','electronic']),detourRatio:.35,allowConditional:true,plan:null,busy:false,activeLeg:-1,message:''});
   else if(!states.get(map).start){states.get(map).start=starts[0]?.id||'';states.get(map).selected=new Set([...keyrooms,...bosses.filter(p=>p.defaultSelected!==false),...electronics].map(p=>p.id));}
  }
  loadError='';render();if(new URLSearchParams(location.search).get('route')==='along')api.open();return api;
 })().catch(error=>{loadError='路线资料暂时不可用：'+error.message;render();throw error;});
 return readyRequest;
}
function focusMarker(id){
 const s=state();api.open();const skipped=s.plan?.skipped.find(row=>row.target.id===id);
 if(skipped){$('assault-skipped').hidden=false;$('assault-skipped').open=true;const row=[...$('assault-skipped-list').children].find(node=>node.dataset.skipped===id);row?.scrollIntoView({block:'center',behavior:'smooth'});return;}
 const index=s.plan?.legs.findIndex(leg=>leg.to.id===id);
 if(index>=0){const row=$('assault-steps').children[index];row?.scrollIntoView({block:'center',behavior:'smooth'});row?.animate([{outline:'2px solid #ffc66e'},{outline:'2px solid transparent'}],{duration:1200});}
 else $('assault-result').scrollIntoView({block:'start'});
}
const api={ready,generate,getState:()=>state(),getTargets:()=>info(),open(){mount();if(atlas()?.state.source2d==='source')atlas().showSide('routes');if(window.matchMedia('(max-width:570px)').matches)document.body.classList.add('filters-open');panel?.scrollIntoView({block:'start'});},showLeg,showOverview,focusMarker};
window.assaultRoutes=api;
window.addEventListener('atlasready',()=>ready().catch(()=>{}));
window.addEventListener('atlasmapchange',()=>{revision++;for(const s of states.values())s.busy=false;render();});
window.addEventListener('navtransitchange',event=>{if(event.detail?.map!==mapId())return;invalidate();state().message='本局通路已调整，请重新生成路线。';render();});
window.addEventListener('atlassourcechange',()=>{render();const s=state();if(shared.getSelection().result?.strategy==='assault'){if(s.displayMode==='overview')showOverview().catch(()=>{});else if(s.plan?.legs[s.activeLeg])showLeg(s.activeLeg).catch(()=>{});}});
window.addEventListener('manualrouteintent',event=>{if(event.detail?.map===mapId())stopAssaultDisplay(true);});
window.addEventListener('navroutechange',event=>{const s=state();if(event.detail?.map===mapId()&&event.detail.result?.strategy!=='assault'&&(s.displayMode||s.activeLeg>=0||s.busy))stopAssaultDisplay(false);});
if(atlas()?.state.ready)ready().catch(()=>{});

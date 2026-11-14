import {createRouteUI,routeFailureMessage,isDisplayRoute,routeSummary,conditionalRouteNote} from './route-ui.js?v=20261021-map-launch-1';

// Endpoints and routes stay in the 2D map's per-map state.
export function initNativeRoute2D(nativeMap){
 const $=id=>document.getElementById(id),html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const panel=document.createElement('section');panel.id='native2d-route-panel';
 panel.innerHTML=`<div class="section-label">路线规划</div><label class="small muted" for="native2d-route-start">从哪里出发</label><select id="native2d-route-start" aria-label="2D 路线起点"></select><label class="small muted" for="native2d-route-target-search">去哪里</label><input id="native2d-route-target-search" type="search" placeholder="搜索目标箱子、装置或编号" autocomplete="off"><select id="native2d-route-target" aria-label="2D 路线终点"></select><p id="native2d-route-end" class="small muted">也可点击地图点位设置终点。</p><div class="native2d-route-actions"><button id="native2d-route-plan" disabled>规划路线</button><button id="native2d-route-fit" disabled>查看全程</button><button id="native2d-route-clear">清除</button></div><p id="native2d-route-status" class="small" role="status">读取路线工具…</p><details class="route-evidence"><summary>路线依据与限制</summary><p id="native2d-route-evidence" class="small muted"></p><p id="native2d-route-warnings" class="small muted">沿静态导航面连接；未应用本局门禁与动态状态。</p></details>`;
 $('native-map-controls').prepend(panel);
 const coverage=document.createElement('p');coverage.className='small muted';
 coverage.textContent='路线功能测试中：普通路段与特殊通路分开展示，部分跨区域通路仍待补全。';
 panel.querySelector('.section-label').after(coverage);
 const legend=document.createElement('p');legend.id='native2d-route-legend';legend.className='small';legend.hidden=true;legend.textContent=conditionalRouteNote;$('native2d-route-status').after(legend);
 let shared,ready,planning=false,current='janus';
 const state=()=>nativeMap.getState(),point=id=>state().points.find(p=>String(p.id)===String(id));
 function manualIntent(){
  const holder=panel.closest('details.assault-manual');if(holder)holder.open=true;
  const map=state().map;window.dispatchEvent(new CustomEvent('manualrouteintent',{detail:{map}}));return map;
 }
 const init=()=>ready ||= (async()=>{shared=window.navRouteUI||createRouteUI();await shared.ready;return shared;})();
 function renderTargets(){
  if(!shared)return;const s=shared.getSelection(),query=$('native2d-route-target-search').value.trim().toLowerCase();
  const matches=state().points.filter(p=>`${p.label} ${p.id} ${p.kind}`.toLowerCase().includes(query));
  const selected=point(s.end),displayed=matches.slice(0,60);
  if(selected&&!displayed.some(p=>p.id===selected.id))displayed.unshift(selected);
  $('native2d-route-target').innerHTML=`<option value="">${query?`匹配 ${matches.length} 个，显示前 60 个`:'搜索或选择目标点位'}</option>`+displayed.map(p=>`<option value="${html(p.id)}">${html(p.label)} · ${html(p.id)}</option>`).join('');
  $('native2d-route-target').value=s.end||'';
 }
 function sync(){
  if(!shared)return;const s=shared.getSelection();if(s.map!==state().map)return;
  const items=state().points.filter(p=>p.kind==='spawn'),custom=point(s.start);
  if(custom&&!items.some(p=>p.id===custom.id))items.push(custom);
  $('native2d-route-start').innerHTML='<option value="">在详情中选择起点</option>'+items.map(p=>`<option value="${html(p.id)}">${html(p.label)} · Y ${p.worldPosition.y.toFixed(1)}</option>`).join('');
  $('native2d-route-start').value=s.start||'';
  renderTargets();
  const end=point(s.end);$('native2d-route-end').textContent=s.end?`终点：${end?.label||s.end}${end?` · Y ${end.worldPosition.y.toFixed(1)}`:''}`:'点击地图点位设置终点。';
  $('native2d-route-plan').disabled=planning||!s.start||!s.end;$('native2d-route-fit').disabled=!isDisplayRoute(s.result);
  $('native2d-route-fit').textContent=s.result?.status==='conditional'?'查看分段参考':'查看全程';
  legend.hidden=s.result?.status!=='conditional';
  const r=s.result,status=$('native2d-route-status');status.dataset.status=r?.status||'';
  if(planning)status.textContent='沿原生多边形邻接规划中…';
  else if(isDisplayRoute(r))status.textContent=routeSummary(r);
  else if(r)status.textContent=routeFailureMessage(r);
  else status.textContent=s.end?'起终点已选，可规划静态路线。':'选择入口，再点击目标箱子设为终点。';
  $('native2d-route-evidence').textContent=r?.overview?`全程 ${r.legCount} 段；保留每段原始导航道路，未接入目标不连线。`:r?.status==='complete'?`${r.polygonPath.length} 个导航多边形；起点贴合偏差 ${r.snappedStart.distance.toFixed(3)}、终点 ${r.snappedEnd.distance.toFixed(3)} 游戏单位。`:'';
  if(r?.status==='conditional')$('native2d-route-evidence').textContent='特殊连接依据：'+r.segments.filter(segment=>segment.kind==='special').map(segment=>`${segment.id}（${segment.source.path} · ${segment.source.jsonPath}）`).join('；')+'。仅普通路段距离合计 '+Math.round(r.walkingDistance)+' 游戏单位，特殊连接不计作步行距离。';
  $('native2d-route-warnings').textContent=r?[...(r.warnings||[]),r.status==='complete'?'路线按当前高度范围显示；“查看全程”会调整高度。路径不是最短平滑路线。':''].filter(Boolean).join(' '):'沿静态导航面连接；未应用本局门禁与动态状态。不自动补接传送或跳跃。';
 }
 async function setEndpoint(p,role){const map=manualIntent();await init();if(state().map!==map)return;if(shared.getSelection().map!==map)shared.onMapChanged(map);await shared.setEndpoint(map,p,role);sync();}
 async function plan(){let failure=null;
   const map=manualIntent();
   try{await init();if(state().map!==map)return;const s=shared.getSelection();if(s.map!==map||!s.start||!s.end)return;planning=true;sync();const result=await shared.plan(s.map,s.start,s.end);if(state().map===map&&isDisplayRoute(result)){nativeMap.fitRoute();if(result.status==='complete')document.body.classList.remove('filters-open');}}
  catch(e){failure=e;}
  finally{planning=false;sync();if(failure)showError(new Error('静态路线规划失败：'+failure.message));}
 }
 function attachDetail(p){
  if(!state().active||!p||$('native2d-detail-start'))return;
  const controls=document.createElement('div');controls.className='detail-buttons native2d-detail-route';
  controls.innerHTML='<h3>静态导航</h3><button id="native2d-detail-start">设为路线起点</button><button id="native2d-detail-end">设为路线终点</button><button id="native2d-detail-go" class="primary-button">从已选起点规划到此处</button>';
  $('detail').querySelector('.detail-buttons')?.after(controls);
  $('native2d-detail-start').onclick=()=>setEndpoint(p,'start').catch(showError);
  $('native2d-detail-end').onclick=()=>setEndpoint(p,'end').catch(showError);
  $('native2d-detail-go').onclick=async()=>{try{await setEndpoint(p,'end');await plan();}catch(e){showError(e)}};
 }
 function showError(e){$('native2d-route-status').textContent=e.message;$('native2d-route-status').dataset.status='error';}
 async function onMapChanged(map){
  current=map;$('native2d-route-target-search').value='';nativeMap.setRoute(null);await init();if(current!==map)return;
  if(shared.getSelection().map!==map)shared.onMapChanged(map);sync();
  const s=shared.getSelection();nativeMap.setRoute(isDisplayRoute(s.result)?s.result:null);if(s.result?.strategy==='assault'&&isDisplayRoute(s.result))nativeMap.fitRoute();if(state().selected)attachDetail(point(state().selected));
 }
 $('native2d-route-start').onchange=e=>{const p=point(e.target.value);if(p)setEndpoint(p,'start').catch(showError);};
 $('native2d-route-target-search').oninput=renderTargets;
 $('native2d-route-target').onchange=e=>{const p=point(e.target.value);if(p)setEndpoint(p,'end').catch(showError);};
 $('native2d-route-plan').onclick=plan;$('native2d-route-clear').onclick=async()=>{const map=manualIntent();await init();if(state().map!==map)return;if(shared.getSelection().map!==map)shared.onMapChanged(map);shared.clear();sync();};
 $('native2d-route-fit').onclick=()=>{nativeMap.fitRoute();document.body.classList.remove('filters-open');};
 window.addEventListener('navroutechange',e=>{const d=e.detail;if(d?.map!==state().map)return;nativeMap.setRoute(isDisplayRoute(d.result)?d.result:null);sync();});
 window.addEventListener('navrouteendpoint',()=>queueMicrotask(sync));
 window.addEventListener('nativemapselect',e=>attachDetail(e.detail?.point));
 window.nativeRoute2D={onMapChanged,plan,setEndpoint,getSelection:()=>shared?.getSelection()||null};
 init().then(()=>sync()).catch(showError);
 return window.nativeRoute2D;
}

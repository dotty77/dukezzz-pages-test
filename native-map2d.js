// A separate Unity X/Z map. Community-image coordinates and personal bindings
// are never read or changed by this view.
import {initNativeRoute2D} from './native-map-route2d.js?v=20261021-map-launch-1';
import {createTerrainCache} from './native-terrain-cache.js?v=20260911-community-update-1';
import {isDisplayRoute} from './route-ui.js?v=20261021-map-launch-1';
import {pointPositionIssue} from './native-point-policy.js?v=20260910-map-counts-1';
import './world-point-notes.js?v=20260909-version-3-2-1';
import {loadOreMonsters,oreMonsterDetails} from './ore-monsters.js?v=20260919-site-refresh-1';
const $ = id => document.getElementById(id);
const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TYPES = {
 ore_boss:['赭石碎片敌人 · 候选','赭','#dca252','enemy'],
 mechanical:['机械保险箱','机','#efab73','safe'], electronic:['电子保险箱','电','#b9a1f0','safe'],
 gear:['武备箱','武','#eaf2e5','gear'], medical:['医疗站','医','#f17b85','medical'],
 container:['其他容器','箱','#c6b596','container'], container_untranslated:['未译容器','箱','#c6b596','container'], briefcase:['公文包','包','#cba166','container'], trash:['垃圾桶','桶','#78a6ed','container'],
 spawn:['固定出生位置','生','#d9f775','spawn'], door:['门体','门','#c5cfd2','door'], card_reader:['读卡器','卡','#e3d66b','door'],
 evacuation_anchor:['固定撤离位置','撤','#68eeb2','evacuation'], revive_device:['复苏装置','复','#a3c6ea','revive'], portal:['传送装置','传','#62d6cf','portal'],lift_component:['升降组件','升','#8bcec7','lift']
};
const GROUPS = {enemy:'赭石碎片敌人（待核实）',safe:'机械 / 电子保险箱',gear:'武备箱',container:'其他可搜容器',medical:'医疗站',spawn:'固定出生位置',evacuation:'固定撤离位置',revive:'复苏装置',door:'门体 / 读卡器组件',portal:'传送装置候选',lift:'升降装置组件'};
const DEFAULT_GROUPS = ['safe','gear','container','medical','spawn','evacuation'];
const UNCERTAIN = new Set(['no_default_difficulty_rule','unreferenced_v2_member','unresolved_default_suite_rule']);
const state={active:false,map:'janus',loadedMap:null,data:null,points:[],triangles:[],polygons:[],bounds:null,mainY:null,minY:0,maxY:100,groups:new Set(DEFAULT_GROUPS),includeExcluded:false,includeUncertain:false,search:'',labels:false,selected:null,zoom:1,panX:0,panY:0,width:0,height:0,scale:1,hits:[],loading:0,visible:[],drawPending:false};
const cache=new Map();let gameplayPromise,locationsPromise;const canvas=$('native-map-canvas'),ctx=window.DUKE_I18N.canvasContext(canvas.getContext('2d'));
const terrain=createTerrainCache(requestDraw);
// Both maps' landmark registrations have X pointing left and Z pointing down.
// Rotate only the view; route and item coordinates remain untouched.
const orientations=new Map([['janus','source'],['suburbs','source']]);
state.viewOrientation='source';state.viewSign=-1;state.rotation=0;
function rotateVector(x,y,a=state.rotation){return {x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a)}}
function setRotation(a){const q=rotateVector(state.panX,state.panY,a-state.rotation);state.rotation=a;state.panX=q.x;state.panY=q.y;state.fitMode=null;syncOrientation();requestDraw();window.mapTools?.sync()}

const orientationButton=document.createElement('button');
orientationButton.id='native-orientation-toggle';orientationButton.type='button';orientationButton.hidden=true;
orientationButton.setAttribute('aria-label','与资料图同向');
$('native-map-stage').append(orientationButton);
function bearingDegrees(){return ((state.rotation*180/Math.PI%360)+540)%360-180;}
function axisLabel(){const bearing=bearingDegrees();return Math.abs(bearing)>.01?`视图旋转 ${Math.round(bearing)}°`:state.viewSign===-1?'X ← / Z ↓':'X → / Z ↑';}
function orientationDescription(){const bearing=bearingDegrees();if(Math.abs(bearing)>.01)return `视图已旋转 ${Math.round(bearing)}°，游戏坐标保持不变；Y 表示高度。点击工具栏角度可恢复默认朝向。`;return state.viewSign===-1?'当前朝向与资料图一致，左侧为 +X，下方为 +Z；Y 表示高度。':'当前为原始坐标方向，右侧为 +X，上方为 +Z；Y 表示高度。';}
function syncOrientation(){
 const supported=orientations.has(state.map)&&state.loadedMap===state.map;orientationButton.hidden=!supported;
 $('native-map-stage').classList.toggle('has-orientation-control',supported);
 orientationButton.textContent=state.viewSign===-1?'资料图方向 ⟳':'坐标方向 ⟳';
 orientationButton.setAttribute('aria-pressed',String(state.viewSign===-1));
 orientationButton.title=state.viewSign===-1?'切换到原始坐标方向':'切换为与资料图同向';
 const note=$('native-axis-note');if(note)note.textContent=orientationDescription();
 if(state.active)$('cursor-position').textContent=`游戏坐标 · ${axisLabel()}`;
}
orientationButton.addEventListener('click',()=>{
 if(!orientations.has(state.map)||state.loadedMap!==state.map)return;
 const oldSign=state.viewSign;
 state.viewOrientation=state.viewOrientation==='source'?'world':'source';
 orientations.set(state.map,state.viewOrientation);
 state.viewSign=state.viewOrientation==='source'?-1:1;
 // Preserve the viewed world center, current zoom, filters and planned route.
 state.panX*=state.viewSign/oldSign;state.panY*=state.viewSign/oldSign;
 $('native-tooltip').hidden=true;syncOrientation();requestDraw();
});
function setText(id,value){const el=$(id);if(el.textContent!==value)el.textContent=value;}
const isLocation=p=>p.kind==='spawn'||p.kind==='evacuation_anchor';
const nativeCountNote=document.createElement('div');nativeCountNote.id='native-count-note';nativeCountNote.className='callout';
nativeCountNote.innerHTML='<b>游戏配置候选数量</b><p>数字为「筛选后 / 全部配置」，随高度、刷新分类和搜索变化。勾选只控制显示。同一地点可能有多套条件配置；候选数不等于本局出现数，也不等于资料图标注数。门体、读卡器和升降组件分别按配置记录计数。</p>';
$('native-types').before(nativeCountNote);
const unlocatedPanel=document.createElement('details');unlocatedPanel.id='native-unlocated-points';unlocatedPanel.className='route-evidence';$('native-types').after(unlocatedPanel);
state.refreshFilter='all';
const refreshControls=document.createElement('section');refreshControls.id='native-refresh-controls';
refreshControls.innerHTML='<div class="section-label">箱子刷新分类</div><div class="chips"><button data-refresh="all" class="active">全部</button><button data-refresh="fixed">条件固定</button><button data-refresh="random">随机候选</button></div>';
$('native-types').after(refreshControls);
refreshControls.addEventListener('click',e=>{const b=e.target.closest('[data-refresh]');if(!b)return;state.refreshFilter=b.dataset.refresh;refreshControls.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));requestDraw();});
const fetchJson=async url=>{const r=await fetch(url);if(!r.ok)throw new Error(`${url}: ${r.status}`);return r.json()};
function isFinitePosition(p){return p&&['x','y','z'].every(k=>Number.isFinite(p[k]));}
function parseNav(nav){
 if(nav.coordinateSpace!=='source-world')throw new Error('导航数据坐标系未确认');
 const triangles=[],polygons=[];
 for(const tile of nav.tiles){
  tile.polygons.forEach((poly,pi)=>{
   const vertices=poly.vertices.map(i=>tile.vertices[i]);if(vertices.length<3)return;
   polygons.push({vertices,minY:Math.min(...vertices.map(v=>v[1])),maxY:Math.max(...vertices.map(v=>v[1]))});
   const detail=tile.detailMeshes[pi];if(!detail)throw new Error('导航多边形缺少原生 detailMesh');
   const [vertexBase,triBase,,triCount]=detail;
   for(let ti=triBase;ti<triBase+triCount;ti++){
    const indices=tile.detailTriangles[ti];
    const v=indices.slice(0,3).map(i=>i<vertices.length?vertices[i]:tile.detailVertices[vertexBase+i-vertices.length]);
    if(v.some(p=>!p||p.some(n=>!Number.isFinite(n))))throw new Error('导航 detailTriangle 顶点无效');
    triangles.push({v,minY:Math.min(...v.map(p=>p[1])),maxY:Math.max(...v.map(p=>p[1])),meanY:v.reduce((s,p)=>s+p[1],0)/3});
   }
  });
 }
 if(triangles.length!==nav.counts.detailTriangles)throw new Error('导航三角形数量校验失败');
 return {triangles,polygons};
}
function mainHeightRange(points){
 const ys=points.map(p=>p.worldPosition.y).sort((a,b)=>a-b);if(!ys.length)return [0,100];
 // Disconnected debug/auxiliary geometry lies hundreds of units below the map.
 // Keep the largest height cluster; all source heights remain available.
 const clusters=[];let c=[];
 for(const y of ys){if(c.length&&y-c.at(-1)>100){clusters.push(c);c=[];}c.push(y);}clusters.push(c);clusters.sort((a,b)=>b.length-a.length);
 return [Math.floor(clusters[0][0]/10)*10-5,Math.ceil(clusters[0].at(-1)/10)*10+5];
}
async function load(map){
 if(!cache.has(map))cache.set(map,(async()=>{
  gameplayPromise ||= fetchJson('gameplay-points-compact.json?v=20261021-map-launch-1');
  locationsPromise ||= fetchJson('research/spawn-exit-locations.json?v=20260909-version-3-2-1');
  const [gameplay,nav,locations,ore]=await Promise.all([gameplayPromise,fetchJson(`extraction/navmesh-research/${map}-navmesh.json`),locationsPromise,loadOreMonsters(map).then(points=>({points})).catch(error=>({points:[],error:error.message}))]);
  const gm=gameplay.maps.find(m=>m.map===map);if(!gm)throw new Error('缺少世界点位数据');
  const lm=locations.maps.find(m=>m.map===map);if(!lm)throw new Error('缺少出生与撤离位置依据');
  const candidates=[...ore.points,...gm.objects.filter(o=>TYPES[o.type]).map(o=>({...o,kind:o.type})),...lm.candidates.map(o=>({...o,kind:o.type==='player_spawn'?'spawn':'evacuation_anchor',label:o.type==='player_spawn'?`出生位置 ${o.id.split('-').at(-1)}`:`${o.label.replace('撤离锚点·','')} · 撤 ${o.id.split('-').at(-1)}${o.configConfirmedHighRiskCandidate?'':'（高危待核实）'}`}))].filter(o=>isFinitePosition(o.worldPosition));
  const unlocatedPoints=candidates.filter(p=>pointPositionIssue(map,p)).map(p=>({...p,positionIssue:pointPositionIssue(map,p)}));
  const points=candidates.filter(p=>!pointPositionIssue(map,p));
  return {nav,points,unlocatedPoints,oreError:ore.error||'',locations:lm,...parseNav(nav),mainY:mainHeightRange(points)};
 })());
 try{return await cache.get(map)}catch(e){cache.delete(map);throw e}
}
function worldToScreen(p){const unit=state.scale*state.zoom*state.viewSign,q=rotateVector((p.x-state.bounds.cx)*unit,-(p.z-state.bounds.cz)*unit);return {x:state.width/2+state.panX+q.x,y:state.height/2+state.panY+q.y};}
function screenToWorld(x,y){const unit=state.scale*state.zoom*state.viewSign,q=rotateVector(x-state.width/2-state.panX,y-state.height/2-state.panY,-state.rotation);return {x:q.x/unit+state.bounds.cx,z:-q.y/unit+state.bounds.cz};}
function matchesNativeFilters(p){
 const y=p.worldPosition.y,c=p.refreshCondition?.classification;
 if(p.kind==='ore_boss')return y>=state.minY&&y<=state.maxY&&(!state.search||window.DUKE_I18N.matches(`${p.id} ${p.label} 赭石碎片 首领 残响容器`,state.search));
 if(isLocation(p))return y>=state.minY&&y<=state.maxY&&(p.configConfirmedHighRiskCandidate||state.includeUncertain)&&(!state.search||window.DUKE_I18N.matches(`${p.id} ${p.label} ${p.pointName||''}`,state.search));
 if(p.refreshCondition&&state.refreshFilter!=='all'&&!(state.refreshFilter==='fixed'?c?.startsWith('conditional_fixed'):c==='random_default_suite_candidate'))return false;
 return y>=state.minY&&y<=state.maxY&&(state.includeExcluded||c!=='excluded_from_default_suite_draw')&&(state.includeUncertain||!UNCERTAIN.has(c))&&(!state.search||window.DUKE_I18N.matches(`${p.id} ${p.label} ${p.kind} ${p.pointName||''} ${p.groupId||''}`,state.search));
}
function visiblePoints(){if(window.mapTools?.clean)return [];return state.points.filter(p=>state.groups.has(TYPES[p.kind][3])&&matchesNativeFilters(p));}
function syncNativeCounts(){
 for(const el of $('native-types').querySelectorAll('[data-count-group]')){
  const group=el.dataset.countGroup,points=state.points.filter(p=>TYPES[p.kind][3]===group),unlocated=(state.data?.unlocatedPoints||[]).filter(p=>TYPES[p.kind][3]===group).length,count=points.filter(matchesNativeFilters).length,total=points.length+unlocated,value=`${count} / ${total}`;
  if(el.textContent!==value)el.textContent=value;
  el.title=`当前筛选可显示 ${count} 条；共 ${total} 条${['spawn','evacuation'].includes(group)?'位置':'配置'}记录。${unlocated?`其中 ${unlocated} 条未确认实际位置，不标点。`:''}`;
 }
}
function setBounds(){
 const vs=state.triangles.filter(t=>t.maxY>=state.minY&&t.minY<=state.maxY).flatMap(t=>t.v);
 const ps=visiblePoints().map(p=>[p.worldPosition.x,p.worldPosition.y,p.worldPosition.z]);vs.push(...ps);
 if(!vs.length)return;
 const xs=vs.map(v=>v[0]),zs=vs.map(v=>v[2]);const minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
 state.bounds={minX,maxX,minZ,maxZ,cx:(minX+maxX)/2,cz:(minZ+maxZ)/2};
 state.scale=Math.min((state.width-80)/Math.max(maxX-minX,1),(state.height-100)/Math.max(maxZ-minZ,1));state.scale=Math.max(.05,state.scale);
}
function resize(){if(!state.active)return;const r=$('native-map-stage').getBoundingClientRect();if(!r.width||!r.height)return;const previousScale=state.scale;state.width=r.width;state.height=r.height;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);if(state.bounds){state.scale=Math.max(.05,Math.min((r.width-80)/Math.max(state.bounds.maxX-state.bounds.minX,1),(r.height-100)/Math.max(state.bounds.maxZ-state.bounds.minZ,1)));if(previousScale>0){state.panX*=state.scale/previousScale;state.panY*=state.scale/previousScale;}}if(state.fitMode==='route'&&isDisplayRoute(state.route))fitRoute();else requestDraw();}
function requestDraw(){if(!state.active||state.drawPending)return;state.drawPending=true;requestAnimationFrame(()=>{state.drawPending=false;draw()});}
function draw(){
 if(!state.active||!state.bounds)return;
 syncNativeCounts();
 ctx.clearRect(0,0,state.width,state.height);ctx.fillStyle='#101b22';ctx.fillRect(0,0,state.width,state.height);
 const corners=[[0,0],[0,state.height],[state.width,0],[state.width,state.height]].map(p=>screenToWorld(...p)),near={x:Math.min(...corners.map(p=>p.x)),z:Math.min(...corners.map(p=>p.z))},far={x:Math.max(...corners.map(p=>p.x)),z:Math.max(...corners.map(p=>p.z))};const px=state.scale*state.zoom;const step=px>7?10:px>2?25:px>.6?50:100;
 ctx.lineWidth=1;ctx.strokeStyle='#557b871f';ctx.font='9px monospace';ctx.fillStyle='#6e9394';ctx.textAlign='left';
 for(let x=Math.floor(near.x/step)*step;x<far.x;x+=step){const a=worldToScreen({x,z:near.z}),b=worldToScreen({x,z:far.z});ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
 for(let z=Math.floor(near.z/step)*step;z<far.z;z+=step){const a=worldToScreen({x:near.x,z}),b=worldToScreen({x:far.x,z});ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
 terrain.draw(ctx,state);
 state.assaultHits=[];
 if(!window.mapTools?.clean)drawRoute();else {state.routeSpecialLabels=[];state.routeVisibleSegments=0;}
 const hasSketch=window.mapSketch?.draw(ctx,worldToScreen,'native');
 const pts=visiblePoints().sort((a,b)=>Number(a.id===state.selected)-Number(b.id===state.selected)||Number(a.kind==='spawn')-Number(b.kind==='spawn'));
 state.visible=pts;state.hits=[];
 for(const p of pts){const q=worldToScreen(p.worldPosition);if(q.x<-20||q.y<-20||q.x>state.width+20||q.y>state.height+20)continue;const type=TYPES[p.kind],selected=p.id===state.selected,r=p.kind==='spawn'?11:8;state.hits.push({point:p,x:q.x,y:q.y,r:r+4});
  ctx.fillStyle='#0b151deb';ctx.strokeStyle=type[2];ctx.lineWidth=selected?2.7:1.5;ctx.setLineDash(p.refreshCondition?.classification==='random_default_suite_candidate'?[3,2]:[]);ctx.beginPath();if(p.kind==='spawn'){ctx.moveTo(q.x,q.y-r-2);ctx.lineTo(q.x+r+2,q.y);ctx.lineTo(q.x,q.y+r+2);ctx.lineTo(q.x-r-2,q.y);ctx.closePath();}else ctx.roundRect(q.x-r,q.y-r,2*r,2*r,3);ctx.fill();ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=type[2];ctx.font=`bold ${p.kind==='spawn'?12:10}px "Microsoft YaHei",sans-serif`;ctx.textAlign='center';ctx.fillText(type[1],q.x,q.y+3.5);
  if(selected){ctx.beginPath();ctx.arc(q.x,q.y,19,0,Math.PI*2);ctx.strokeStyle='#e9ffae';ctx.lineWidth=1;ctx.stroke();}
  if(state.labels||selected||isLocation(p)){const label=isLocation(p)||p.kind==='ore_boss'?p.label:`${p.groupId}:${p.configId}`;ctx.font='10px "Microsoft YaHei",sans-serif';const w=ctx.measureText(label).width;ctx.fillStyle='#0d181ff2';ctx.fillRect(q.x-w/2-4,q.y+r+6,w+8,15);ctx.fillStyle=p.configConfirmedHighRiskCandidate===false?'#ffc88e':'#e2eee5';ctx.fillText(label,q.x,q.y+r+17);}
 }
 ctx.font='bold 11px Microsoft YaHei';ctx.textAlign='center';
 for(const marker of state.routeSpecialLabels||[]){
  if(marker.x<0||marker.y<0||marker.x>state.width||marker.y>state.height)continue;
  const width=ctx.measureText(marker.label).width+12,x=Math.max(width/2+4,Math.min(state.width-width/2-4,marker.x)),y=Math.max(18,Math.min(state.height-9,marker.y-25));
  ctx.fillStyle='#282016';ctx.fillRect(x-width/2,y-14,width,21);ctx.fillStyle='#ffd596';ctx.fillText(marker.label,x,y+1);
 }
 if(!window.mapTools?.clean)drawAssaultMarkers();
 window.mapTools?.drawNative(ctx,worldToScreen,state);
 setText('native-map-count',`${pts.length} 条可见配置 · 原生导航面`);
 const empty=$('native-map-empty'),hasContent=!!window.mapTools?.clean||pts.length>0||!!state.personalHits?.length||!!state.assaultHits?.length||!!hasSketch;
 if(empty.hidden!==hasContent)empty.hidden=hasContent;
 setText('native-map-layer',`Y ${state.minY.toFixed(0)} ～ ${state.maxY.toFixed(0)} · ${axisLabel()}`);
 setText('count-summary',`${state.data.locations.summary.fixedSpawnCandidateCount} 个出生位置 · ${state.data.locations.summary.locationsWithHighRiskEvidence} 个高危撤离配置地点`);
 const unit=state.scale*state.zoom,scaleLength=step,line=$('native-scale-line'),width=`${Math.round(scaleLength*unit)}px`;if(line.style.width!==width)line.style.width=width;setText('native-scale-label',`${scaleLength} 世界单位`);
}
function reset(){state.fitMode='map';state.zoom=1;state.panX=0;state.panY=0;setBounds();if(state.bounds){const c=Math.abs(Math.cos(state.rotation)),s=Math.abs(Math.sin(state.rotation)),w=state.bounds.maxX-state.bounds.minX,h=state.bounds.maxZ-state.bounds.minZ;state.zoom=Math.min((state.width-80)/Math.max(1,w*c+h*s),(state.height-100)/Math.max(1,w*s+h*c))/state.scale;}requestDraw();}
function focus(position){if(!state.bounds)return;state.fitMode=null;state.zoom=Math.max(2,state.zoom);state.panX=0;state.panY=0;const q=worldToScreen(position);state.panX=state.width/2-q.x;state.panY=state.height/2-q.y;requestDraw();}
function zoomAt(f,x=state.width/2,y=state.height/2){if(!state.bounds)return;state.fitMode=null;const p=screenToWorld(x,y);state.zoom=Math.min(24,Math.max(.45,state.zoom*f));const q=worldToScreen(p);state.panX+=x-q.x;state.panY+=y-q.y;requestDraw();}
function clippedRouteSegment(a,b){
 const d=b.y-a.y;let lo=0,hi=1;
 if(Math.abs(d)<1e-9){if(a.y<state.minY||a.y>state.maxY)return null;}
 else{let t0=(state.minY-a.y)/d,t1=(state.maxY-a.y)/d;if(t0>t1)[t0,t1]=[t1,t0];lo=Math.max(lo,t0);hi=Math.min(hi,t1);if(lo>hi)return null;}
 const at=t=>({x:a.x+(b.x-a.x)*t,y:a.y+d*t,z:a.z+(b.z-a.z)*t});return [at(lo),at(hi)];
}
function drawRoute(){
 state.routeSpecialLabels=[];
 state.routeVisibleSegments=0;const r=state.route;if(!isDisplayRoute(r)||r.coordinateSpace!=='source-world')return;
 const legs=r.status==='conditional'||r.overview&&Array.isArray(r.segments)?r.segments:[{kind:'walking',points:r.points}];
 const segments=[];for(const leg of legs.filter(s=>s.kind==='walking'))for(let i=1;i<leg.points.length;i++){const s=clippedRouteSegment(leg.points[i-1],leg.points[i]);if(s)segments.push(s.map(worldToScreen));}
 state.routeVisibleSegments=segments.length;ctx.lineJoin='round';ctx.lineCap='round';ctx.setLineDash([]);
 for(const [color,width] of [['#062a31',7],['#6ffff0',3]]){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();for(const [a,b] of segments){ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);}ctx.stroke();}
 let specialIndex=0;
 for(const leg of legs.filter(s=>s.kind==='special')){
  specialIndex++;const clipped=clippedRouteSegment(...leg.points);if(!clipped)continue;const [a,b]=clipped.map(worldToScreen);ctx.setLineDash([7,7]);ctx.strokeStyle='#ffc470';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);
  state.routeSpecialLabels.push({label:leg.label||`特殊通路 ${specialIndex} · 待确认`,x:(a.x+b.x)/2,y:(a.y+b.y)/2});
 }
 const preview=r.strategy==='transit-preview'?r.segments[0]:null;
 if(!Array.isArray(r.assaultMarkers))for(const [p,label,color] of [[r.snappedStart?.position||preview?.start,'起','#baf47c'],[r.snappedEnd?.position||preview?.end,'终','#ffb381']]){if(!p||p.y<state.minY||p.y>state.maxY)continue;const q=worldToScreen(p);ctx.beginPath();ctx.arc(q.x,q.y,16,0,Math.PI*2);ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#0b1f25';ctx.fillRect(q.x+15,q.y-16,18,16);ctx.font='10px Microsoft YaHei';ctx.textAlign='left';ctx.fillStyle=color;ctx.fillText(label,q.x+18,q.y-4);}
 ctx.lineCap='butt';
}
function layoutAssaultPins(pins,width,height){
 const placed=[];
 for(const pin of pins){
  const clamp=q=>({x:Math.max(pin.r+5,Math.min(width-pin.r-5,q.x)),y:Math.max(pin.r+5,Math.min(height-pin.r-5,q.y))});
  const candidates=[clamp(pin.anchor)];
  for(const distance of [40,56,76,100,132,172])for(let i=0;i<16;i++){const angle=-Math.PI/2+i*Math.PI/8;candidates.push(clamp({x:pin.anchor.x+Math.cos(angle)*distance,y:pin.anchor.y+Math.sin(angle)*distance}));}
  const free=q=>placed.every(other=>Math.hypot(q.x-other.q.x,q.y-other.q.y)>=pin.r+other.r+8);
  let q=candidates.find(free);
  if(!q){const grid=[];for(let y=pin.r+5;y<=height-pin.r-5;y+=pin.r*2+8)for(let x=pin.r+5;x<=width-pin.r-5;x+=pin.r*2+8)if(free({x,y}))grid.push({x,y});grid.sort((a,b)=>Math.hypot(a.x-pin.anchor.x,a.y-pin.anchor.y)-Math.hypot(b.x-pin.anchor.x,b.y-pin.anchor.y));q=grid[0];}
  placed.push({...pin,q:q||candidates[0]});
 }
 return placed;
}
function drawAssaultMarkers(){
 const route=state.route;if(!isDisplayRoute(route)||route.coordinateSpace!=='source-world'||!Array.isArray(route.assaultMarkers))return;
 let targetNumber=0;const pins=[];
 // Itinerary markers remain visible independently of type/search/height filters.
 for(const marker of route.assaultMarkers){
  if(!marker||!['start','ore_boss','keyroom','exit','skipped'].includes(marker.kind)||!isFinitePosition(marker.worldPosition))continue;
  const target=marker.kind==='ore_boss'||marker.kind==='keyroom';if(target)targetNumber++;
  const number=Number.isInteger(marker.number)&&marker.number>0?marker.number:targetNumber;
  const badge=marker.kind==='start'?'起':marker.kind==='exit'?'撤':marker.kind==='skipped'?'?':String(number);
  const color={start:'#d9f775',ore_boss:'#ffba73',keyroom:'#c8b6ff',exit:'#72edc0',skipped:'#a8b4c3'}[marker.kind],anchor=worldToScreen(marker.worldPosition),r=marker.kind==='skipped'?13:16;
  if(anchor.x<-r||anchor.y<-r||anchor.x>state.width+r||anchor.y>state.height+r)continue;
  pins.push({marker,badge,color,anchor,r});
 }
 const placed=layoutAssaultPins(pins,state.width,state.height);
 // Badge displacement never changes world XYZ or any route segment.
 for(const {anchor,q,color} of placed)if(Math.hypot(q.x-anchor.x,q.y-anchor.y)>1){ctx.save();ctx.globalAlpha=.75;ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=1;ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(anchor.x,anchor.y);ctx.lineTo(q.x,q.y);ctx.stroke();ctx.beginPath();ctx.arc(anchor.x,anchor.y,2.5,0,Math.PI*2);ctx.fill();ctx.restore();}
 for(const {marker,badge,color,anchor,q,r} of placed){
  ctx.save();ctx.globalAlpha=marker.kind==='skipped'?0.68:1;ctx.shadowColor='#000b';ctx.shadowBlur=5;ctx.fillStyle='#111d2bef';ctx.strokeStyle=color;ctx.lineWidth=2.5;ctx.setLineDash(marker.kind==='skipped'?[3,3]:[]);ctx.beginPath();ctx.arc(q.x,q.y,r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.setLineDash([]);ctx.fillStyle=color;ctx.font='bold 13px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(badge,q.x,q.y+.5);ctx.restore();
  const prefix=marker.kind==='start'?'起点':marker.kind==='exit'?'撤离位置':marker.kind==='skipped'?'未纳入路线':`目标 ${badge} · ${marker.kind==='ore_boss'?'碎片怪':'门禁房'}`;
  state.assaultHits.push({id:marker.id,x:q.x,y:q.y,anchor,r:r+3,label:`${prefix}：${marker.label||marker.id} · Y ${marker.worldPosition.y.toFixed(2)}${marker.reason?' · '+marker.reason:''}`});
 }
}
function setRoute(result){state.route=isDisplayRoute(result)&&result.coordinateSpace==='source-world'?result:null;state.assaultHits=[];requestDraw();}
function locationDetail(p){
 const spawn=p.kind==='spawn';
 return `<p class="detail-note">${spawn?'这是高危入口配置引用的固定出生位置；本局从配置位置中选择，选择概率未实测。':'这是合并同地点配置变体后的撤离位置。'+(p.configConfirmedHighRiskCandidate?'已找到高危难度的组 / Suite 引用；':'尚未确认高危难度启用；')+'开启时间、提交物品或战斗条件请以局内显示为准。'}</p>${spawn?`<dl class="detail-meta"><dt>入口记录</dt><dd>${p.entryConfigId}</dd><dt>场景点</dt><dd>${escapeHtml(p.pointName)}</dd></dl>`:`<dl class="detail-meta"><dt>高危配置</dt><dd>${p.configConfirmedHighRiskCandidate?'有引用依据':'待核实'}</dd><dt>本局开放状态</dt><dd>未读取</dd><dt>合并配置变体</dt><dd>${p.variantCount} 条</dd></dl>${p.deduplicationStatus==='inferred_same_location'?'<p class="small muted">此地点包含相距不足 1 世界单位的配置变体，按同地点推断合并；原坐标保留在依据中。</p>':''}<details class="route-evidence"><summary>查看地点与启用条件依据</summary><pre class="candidate-evidence">${escapeHtml(JSON.stringify(p.variants.map(v=>({id:v.id,memberType:v.memberType,worldPosition:v.worldPosition,highRiskSuites:v.suites.filter(s=>s.selectedByDifficulty213),defaults:v.evacuationDefaults,memberOverrides:v.memberOverrides,evidence:v.evidence})),null,2))}</pre></details>`}`;
}
async function showLocationKind(kind,selectedId=null){
 if(!['spawn','exit'].includes(kind))throw new Error('未知位置类别');
 const map=window.atlas?.state.map||state.map;await setActive(true,map);
 if(!state.active||state.loadedMap!==map)throw new Error('位置数据尚未加载成功');
 state.groups=new Set([kind==='spawn'?'spawn':'evacuation']);state.search='';state.refreshFilter='all';state.includeUncertain=false;
 refreshControls.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.refresh==='all'));
 setHeight(...state.mainY,'main');renderControls();
 if(selectedId){const p=state.points.find(p=>p.id===selectedId);if(!p)throw new Error('没有找到对应的游戏坐标点位');if(!p.configConfirmedHighRiskCandidate){state.includeUncertain=true;renderControls()}if(p.worldPosition.y<state.minY||p.worldPosition.y>state.maxY)setHeight(p.worldPosition.y-5,p.worldPosition.y+5);select(p.id,true)}
 else showLocationOverview(kind);
 requestDraw();
}
function showLocationOverview(kind){
 state.selected=null;document.body.classList.remove('detail-collapsed');$('mobile-detail').hidden=false;document.querySelector('.right-panel').scrollTop=0;
 const ps=state.points.filter(p=>kind==='spawn'?p.kind==='spawn':p.kind==='evacuation_anchor');
 $('detail').innerHTML=`<div class="detail-panel-header"><p class="eyebrow">${kind==='spawn'?'SPAWN LOCATIONS':'EVACUATION LOCATIONS'}</p><button id="native-close-detail" class="detail-close-button" type="button" aria-label="关闭位置列表" title="关闭，返回地图工具"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg><span>关闭</span></button></div><h2>${kind==='spawn'?'固定出生位置':'固定撤离位置'}</h2><p class="small muted">${kind==='spawn'?'本局从固定配置位置中选择出生点，点选下方位置可规划路线。':'地点固定，本局开放状态与撤离条件另行决定。默认显示有高危配置依据的地点；待核实项点选后单独查看。'}</p><div class="nearby-list">${ps.map(p=>`<button data-location-id="${p.id}">${escapeHtml(p.label)}<br><small>Y ${p.worldPosition.y.toFixed(1)} · ${p.configConfirmedHighRiskCandidate?'高危配置有据':'高危启用待核实'}</small></button>`).join('')}</div><p class="small muted">${kind==='exit'?'这里列普通撤离锚点；首领传送入口与复苏装置另属其他类型。':''}</p>`;
 $('native-close-detail').onclick=showOverview;
 document.querySelectorAll('[data-location-id]').forEach(b=>b.onclick=()=>{const p=state.points.find(p=>p.id===b.dataset.locationId);if(!p.configConfirmedHighRiskCandidate){state.includeUncertain=true;renderControls()}if(p.worldPosition.y<state.minY||p.worldPosition.y>state.maxY)setHeight(p.worldPosition.y-5,p.worldPosition.y+5);select(p.id,true)});
}
function fitRoute(){
 // The overview can arrive before the first native map load establishes bounds.
 // onMapChanged restores and fits the shared route after setActive finishes.
 if(!state.active||state.loadedMap!==state.map||state.map!==window.atlas?.state.map||!state.bounds||!state.width||!state.height)return;
 const routePoints=state.route?.status==='conditional'?state.route.segments.flatMap(segment=>segment.points):state.route?.points;if(!routePoints?.length)return;const ps=[...routePoints,...(state.route.assaultMarkers||[]).map(marker=>marker.worldPosition)],ys=ps.map(p=>p.y);
 const minY=Math.min(...ys),maxY=Math.max(...ys);if(minY<state.minY||maxY>state.maxY)setHeight(Math.floor(minY)-2,Math.ceil(maxY)+2);state.fitMode='route';
 const rp=ps.map(p=>rotateVector((p.x-state.bounds.cx)*state.viewSign,-(p.z-state.bounds.cz)*state.viewSign)),xs=rp.map(p=>p.x),screenYs=rp.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minYScreen=Math.min(...screenYs),maxYScreen=Math.max(...screenYs);
 state.zoom=Math.max(.45,Math.min(24,Math.min((state.width-95)/Math.max(20,maxX-minX),(state.height-115)/Math.max(20,maxYScreen-minYScreen))/state.scale));
 state.panX=-(minX+maxX)/2*state.scale*state.zoom;state.panY=-(minYScreen+maxYScreen)/2*state.scale*state.zoom;requestDraw();
}
function showOverview(){
 if(!state.active)return;state.selected=null;$('mobile-detail').hidden=true;document.body.classList.remove('detail-collapsed');document.querySelector('.right-panel').scrollTop=0;
 const summary=state.data?.locations?.summary;
 $('detail').innerHTML=window.bagelOverview.render({native:true,axisNote:orientationDescription(),metrics:[
  [state.points.length,'可定位配置'],[state.points.filter(p=>p.kind==='mechanical'||p.kind==='electronic').length,'保险箱配置'],
  [summary?.fixedSpawnCandidateCount??'—','出生位置'],[summary?.locationsWithHighRiskEvidence??'—','高危撤离地点']
 ]});syncOrientation();requestDraw();
}
function select(id,pan=false){
 const p=state.points.find(p=>p.id===id);if(!p)return;state.selected=id;document.body.classList.remove('detail-collapsed','filters-open');$('mobile-detail').hidden=false;document.querySelector('.right-panel').scrollTop=0;const info=TYPES[p.kind],pos=p.worldPosition,c=p.refreshCondition,near=state.points.filter(n=>n.id!==id&&Math.hypot(n.worldPosition.x-pos.x,n.worldPosition.z-pos.z)<3&&Math.abs(n.worldPosition.y-pos.y)<8).slice(0,12);
 $('detail').innerHTML=`<div class="detail-panel-header"><div class="detail-eyebrow"><span class="type-symbol" style="background:${info[2]}">${info[1]}</span><span class="detail-context-label">游戏世界坐标</span></div><button id="native-close-detail" class="detail-close-button" type="button" aria-label="关闭点位详情" title="关闭，返回地图工具"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg><span>关闭</span></button></div><h2 class="detail-title">${escapeHtml(p.label||info[0])}</h2><span class="detail-status conditional">${p.kind==='ore_boss'?'赭石碎片候选 · 非必掉':isLocation(p)?(p.configConfirmedHighRiskCandidate?'固定位置 · 高危配置有据':'固定位置 · 高危启用待核实'):escapeHtml(c?.classificationLabel||'交互配置候选')}</span><dl class="detail-meta"><dt>点位编号</dt><dd>${escapeHtml(p.id)}</dd><dt>世界 X</dt><dd>${pos.x.toFixed(2)}</dd><dt>高度 Y</dt><dd>${pos.y.toFixed(2)}</dd><dt>世界 Z</dt><dd>${pos.z.toFixed(2)}</dd>${p.groupId?`<dt>Group / 成员</dt><dd>${p.groupId} / ${p.configId}</dd>`:''}</dl>${p.kind==='ore_boss'?oreMonsterDetails(p):isLocation(p)?locationDetail(p):`<p class="detail-note">${escapeHtml(c?.interpretation||'原始配置候选；是否启用取决于本局状态。')}</p>${c?`<details class="route-evidence"><summary>查看刷新条件依据</summary><pre class="candidate-evidence">${escapeHtml(c.conditionalExpression)}</pre></details><p class="small muted">全局刷新：未知。固定引用只在对应组 / Suite 条件成立后有效。</p>${c.groupScriptMutationTypes?.length?`<p class="small muted">组脚本还包含状态修改：${escapeHtml(c.groupScriptMutationTypes.join('、'))}。节点存在不等于此容器必然被修改。</p>`:''}`:''}`}
 <div class="detail-buttons"><button id="native-focus-point">居中查看此点</button><button id="native-slice-point">只看附近高度（± 5）</button></div>${near.length?`<h3>附近或重叠候选</h3><div class="nearby-list">${near.map(n=>`<button data-native-point="${escapeHtml(n.id)}">${escapeHtml(n.label||n.id)} · Y ${n.worldPosition.y.toFixed(1)}</button>`).join('')}</div>`:''}<details><summary class="small muted">配置来源</summary><pre class="candidate-evidence">${escapeHtml(JSON.stringify(p.evidence||p.sourceChain||{file:p.source,memberIndex:p.sourceMemberIndex,viewObjectId:p.viewObjectId},null,2))}</pre></details>`;
 $('native-close-detail').onclick=showOverview;$('native-focus-point').onclick=()=>focus(pos);$('native-slice-point').onclick=()=>setHeight(pos.y-5,pos.y+5,'custom');document.querySelectorAll('[data-native-point]').forEach(b=>b.onclick=()=>select(b.dataset.nativePoint));if(pan)focus(pos);window.dispatchEvent(new CustomEvent('nativemapselect',{detail:{map:state.map,point:p}}));requestDraw();
}
function renderControls(){

 syncOrientation();
 syncTypeToggle();
 $('native-types').innerHTML=Object.entries(GROUPS).map(([key,label])=>`<label class="type-row ${key==='enemy'?'enemy-filter-row':''}"><input type="checkbox" value="${key}" ${state.groups.has(key)?'checked':''}><span>${label}</span><span class="n" data-count-group="${key}"></span></label>`).join('');syncNativeCounts();
 const unlocated=state.data?.unlocatedPoints||[];unlocatedPanel.hidden=!unlocated.length;
 unlocatedPanel.innerHTML=`<summary>${unlocated.length} 条传送配置尚未定位，不标点</summary><p class="small muted">以下为未确认实际入口的原始参考坐标，不纳入地图标记或路线目标。配置与原有个人记录仍保留；这不表示游戏中没有这些装置。</p><div class="nearby-list">${unlocated.map(p=>`<button type="button" data-unlocated-id="${escapeHtml(p.id)}">${escapeHtml(p.id)} · 查看依据</button>`).join('')}</div>`;
 unlocatedPanel.querySelectorAll('[data-unlocated-id]').forEach(button=>button.onclick=()=>showUnlocated(button.dataset.unlocatedId));
 const range=state.mainY;let options=`<option value="main">主图高度 Y ${range[0]} ～ ${range[1]}</option><option value="all">全部高度（含离散层）</option>`;
 for(let y=Math.floor(range[0]/10)*10;y<range[1];y+=10)options+=`<option value="${y}">Y ${y} ～ ${y+10}</option>`;
 $('native-height-preset').innerHTML=options+'<option value="custom">自定义高度范围</option>';$('native-height-preset').value=state.minY===state.mainY[0]&&state.maxY===state.mainY[1]?'main':'custom';$('native-height-min').value=state.minY;$('native-height-max').value=state.maxY;
 $('native-include-excluded').checked=state.includeExcluded;$('native-include-uncertain').checked=state.includeUncertain;$('native-search').value=state.search;
 const excluded=state.points.filter(p=>p.refreshCondition?.classification==='excluded_from_default_suite_draw').length,uncertain=state.points.filter(p=>UNCERTAIN.has(p.refreshCondition?.classification)||p.configConfirmedHighRiskCandidate===false).length;
 $('native-excluded-count').textContent=excluded;$('native-uncertain-count').textContent=uncertain;
}
function showUnlocated(id){
 const p=state.data?.unlocatedPoints?.find(p=>p.id===id);if(!p)return;
 state.selected=null;document.body.classList.remove('detail-collapsed','filters-open');$('mobile-detail').hidden=false;
 const pos=p.worldPosition;
 $('detail').innerHTML=`<div class="detail-panel-header"><p class="eyebrow">位置待核实</p><button id="native-close-detail" class="detail-close-button" type="button">关闭</button></div><h2>传送配置 · 未定位</h2><p class="detail-note">${escapeHtml(p.positionIssue.reason)}</p><p class="small muted">${escapeHtml(p.positionIssue.scope)}</p><dl class="detail-meta"><dt>配置编号</dt><dd>${escapeHtml(p.id)}</dd><dt>原始参考坐标</dt><dd>${pos.x} / ${pos.y} / ${pos.z}</dd><dt>来源</dt><dd>${escapeHtml(p.source)}</dd></dl>`;
 $('native-close-detail').onclick=showOverview;window.worldPointNotes?.attach(p,state.map);requestDraw();
}
function setHeight(min,max,preset='custom'){if(!Number.isFinite(min)||!Number.isFinite(max)||max<min)return;state.minY=min;state.maxY=max;$('native-height-min').value=Math.round(min*10)/10;$('native-height-max').value=Math.round(max*10)/10;$('native-height-preset').value=preset;reset();}
async function setActive(active,map=state.map){
 state.active=active;if(!active){state.loading++;return;}resize();
 if(state.loadedMap===map){state.loading++;$('native-map-loading').hidden=true;state.map=map;window.nativeRoute2D?.onMapChanged(map);showOverview();requestDraw();return;}
 const token=++state.loading;state.map=map;syncOrientation();setRoute(null);$('native-map-loading').hidden=false;$('native-map-loading').textContent='正在读取原生导航面与世界点位…';
 try{const d=await load(map);if(token!==state.loading)return;Object.assign(state,{data:d,points:d.points,triangles:d.triangles,polygons:d.polygons,mainY:d.mainY,minY:d.mainY[0],maxY:d.mainY[1],loadedMap:map,viewOrientation:orientations.get(map)||'source',viewSign:orientations.get(map)==='world'?1:-1,selected:null,groups:new Set(DEFAULT_GROUPS),search:''});renderControls();resize();reset();showOverview();window.nativeRoute2D?.onMapChanged(map);$('native-map-loading').hidden=true;}catch(e){$('native-map-loading').textContent=`游戏坐标图加载失败：${e.message}`;console.error(e);}
}
let drag=null;
canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;state.fitMode=null;drag={x:e.offsetX,y:e.offsetY,px:state.panX,py:state.panY,moved:false};canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{if(!state.bounds)return;if(drag){if(Math.hypot(e.offsetX-drag.x,e.offsetY-drag.y)>4)drag.moved=true;state.panX=drag.px+e.offsetX-drag.x;state.panY=drag.py+e.offsetY-drag.y;requestDraw();$('native-tooltip').hidden=true;return;}const p=screenToWorld(e.offsetX,e.offsetY);$('cursor-position').textContent=`Unity X ${p.x.toFixed(2)} · Z ${p.z.toFixed(2)} · Y 见点位`;const hit=[...(state.assaultHits||[])].reverse().find(h=>Math.hypot(h.x-e.offsetX,h.y-e.offsetY)<h.r)||[...state.hits].reverse().find(h=>Math.hypot(h.x-e.offsetX,h.y-e.offsetY)<h.r);canvas.style.cursor=hit?'pointer':'grab';const tip=$('native-tooltip');tip.hidden=!hit;if(hit){tip.textContent=hit.point?`${hit.point.label} · Y ${hit.point.worldPosition.y.toFixed(2)}`:hit.label;tip.style.left=`${Math.max(8,Math.min(e.offsetX+15,state.width-230))}px`;tip.style.top=`${Math.min(e.offsetY+18,state.height-55)}px`;}});
canvas.addEventListener('pointerup',e=>{if(e.button!==0)return;const moved=drag?.moved;drag=null;if(!moved){const own=window.mapToolAdapters?.native?.hit(e.offsetX,e.offsetY);if(own){window.mapTools.edit(own);return;}const routeHit=[...(state.assaultHits||[])].reverse().find(h=>Math.hypot(h.x-e.offsetX,h.y-e.offsetY)<h.r);if(routeHit){window.assaultRoutes?.focusMarker?.(routeHit.id);return;}const hit=[...state.hits].reverse().find(h=>Math.hypot(h.x-e.offsetX,h.y-e.offsetY)<h.r);if(hit)select(hit.point.id)}});
canvas.addEventListener('pointercancel',()=>drag=null);canvas.addEventListener('pointerleave',()=>$('native-tooltip').hidden=true);canvas.addEventListener('wheel',e=>{e.preventDefault();zoomAt(Math.exp(-e.deltaY*.0015),e.offsetX,e.offsetY)},{passive:false});
function syncTypeToggle(){const all=Object.keys(GROUPS).every(k=>state.groups.has(k));$('native-types-all').textContent=all?'取消全选':'全选';$('native-types-all').setAttribute('aria-pressed',String(all));}
$('native-types').onchange=e=>{e.target.checked?state.groups.add(e.target.value):state.groups.delete(e.target.value);syncTypeToggle();requestDraw()};
$('native-types-all').onclick=()=>{const keys=Object.keys(GROUPS);state.groups=keys.every(k=>state.groups.has(k))?new Set():new Set(keys);renderControls();requestDraw()};
$('native-search').oninput=e=>{state.search=e.target.value.toLowerCase();requestDraw()};
$('native-include-excluded').onchange=e=>{state.includeExcluded=e.target.checked;requestDraw()};$('native-include-uncertain').onchange=e=>{state.includeUncertain=e.target.checked;requestDraw()};
$('native-height-preset').onchange=e=>{const v=e.target.value;if(v==='main')setHeight(...state.mainY,'main');else if(v==='all'){const ys=[...state.triangles.flatMap(t=>[t.minY,t.maxY]),...state.points.map(p=>p.worldPosition.y)];setHeight(Math.floor(Math.min(...ys))-1,Math.ceil(Math.max(...ys))+1,'all')}else if(v!=='custom')setHeight(Number(v),Number(v)+10,v)};
for(const id of ['native-height-min','native-height-max'])$(id).onchange=()=>setHeight(Number($('native-height-min').value),Number($('native-height-max').value));
$('native-zoom-in').onclick=()=>zoomAt(1.35);$('native-zoom-out').onclick=()=>zoomAt(1/1.35);
new ResizeObserver(resize).observe($('native-map-stage'));
window.nativeMap2D={setActive,showLocationKind,resize,reset,draw:requestDraw,select,focus,setRoute,fitRoute,toggleLabels(){state.labels=!state.labels;requestDraw();return state.labels},getState(){return {map:state.map,active:state.active,loadedMap:state.loadedMap,viewOrientation:state.viewOrientation,viewSign:state.viewSign,route:state.route||null,routeVisibleSegments:state.routeVisibleSegments||0,visibleCount:state.visible.length,totalPoints:state.points.length,triangles:state.triangles.length,selected:state.selected,labels:state.labels,groups:[...state.groups],terrainCache:{...terrain.stats},height:[state.minY,state.maxY],visibleIds:state.visible.map(p=>p.id),points:state.points,unlocatedPoints:state.data?.unlocatedPoints||[],screenPoints:state.hits.map(h=>({id:h.point.id,x:h.x,y:h.y})),assaultScreenPoints:(state.assaultHits||[]).map(h=>({id:h.id,x:h.x,y:h.y,label:h.label})),coordinateSpace:'source-world',rotation:state.rotation,personalPoints:state.personalHits?.map(h=>({id:h.p.id,x:h.x,y:h.y}))||[]}},showOverview};
initNativeRoute2D(window.nativeMap2D);
if(window.atlas?.state.mode==='2d'&&window.atlas.state.source2d==='native')setActive(true,window.atlas.state.map);

window.mapToolAdapters ||= {};window.mapToolAdapters.native={canvas,state,map:()=>state.map,project:worldToScreen,unproject:screenToWorld,resize,draw:requestDraw,rotation:()=>state.rotation,setRotation,focus,reset,ready:()=>!!state.bounds&&state.loadedMap===window.atlas.state.map,hit:(x,y)=>[...(state.personalHits||[])].reverse().find(h=>Math.hypot(h.x-x,h.y-y)<16)?.p};window.mapTools?.attach('native');

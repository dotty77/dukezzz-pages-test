import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadMapScene } from './map-3d-loader.js?v=20261031-optimization-launch-1';
import { createNavigation } from './map-3d-navigation.js?v=20261022-map3d-launch-1';
import { createRoamController } from './map-3d-roam.js?v=20261022-map3d-left-drag-launch-1';

const VERSION = '20261111-refresh-launch-1';
const MAPS = {
  suburbs:{id:'suburbs',name:['城郊幻境','Suburbs Illusion'],pointsTitle:['城郊点位','Suburbs markers'],apiName:'dukeSuburbs3D'},
  janus:{id:'janus',name:['雅努斯幻境','Janus Illusion'],pointsTitle:['雅努斯点位','Janus markers'],apiName:'dukeJanus3D'}
};
const MAP = MAPS[document.body.dataset.map] || MAPS.suburbs;
const DATA_ROOT = `./assets/maps3d/${MAP.id}/`;
const FILTER_KEY = `duke-${MAP.id}-3d-filters-v1`;
const NAV_URL = `./extraction/navmesh-research/${MAP.id}-navmesh.json`;
const LANGUAGE_KEY = 'duke-language-v1';
const DEFAULT_MAX_POLAR_ANGLE = Math.PI*.495;
const $ = id => document.getElementById(id);
const UI = {
  roamEnter:["漫游", "Roam"],
  roamControls:["漫游控制", "Roam controls"],
  roamRun:["跑步", "Run"],
  roamFly:["飞行", "Fly"],
  roamExit:["退出", "Exit"],
  roamHelp:["操作说明", "Controls"],
  roamDesktopHelp:["WASD 移动 · 左键拖动环视", "WASD to move · Left-drag to look"],
  roamFlyHelp:["Space 上升 · C 下降 · 点按 Shift 切换加速。Ctrl+W 会关闭网页。", "Space to rise · C to descend · Tap Shift to toggle speed. Ctrl+W closes the tab."],
  roamTouchHelp:["方向键移动 · 拖动环视 · ↑/↓ 升降 · 点按加速", "Arrows to move · Drag to look · ↑/↓ to fly · Tap Faster"],
  roamMoveControls:["移动方向", "Movement controls"],
  roamForward:["向前移动", "Move forward"],
  roamBackward:["向后移动", "Move backward"],
  roamLeft:["向左移动", "Move left"],
  roamRight:["向右移动", "Move right"],
  roamUp:["上升", "Rise"],
  roamDown:["下降", "Descend"],
  roamFast:["加速", "Faster"],
  roamRunStatus:["第三人称 · 跑步", "Third person · Run"],
  roamFlyStatus:["第三人称 · 飞行", "Third person · Fly"],
  roamLoading:["准备漫游…", "Preparing roam…"],
  roamLoadFailed:["漫游暂时未能载入，请重试。", "Roaming could not load. Please retry."],
  roamNoGround:["请飞到地面附近，再切换跑步。", "Fly close to the ground before switching to Run."],
  roamNoSpawn:["附近没有可跑动位置，请换一个区域再试。", "No running start is available. Try another area."],
  qualityClear:['清晰','Clear'], qualityFast:['流畅','Fast'], quality:['画质','Quality'], switchQuality:['切换为','Switch to'],
  title:MAP.name, back2d:['返回 2D 地图','Back to 2D'], operation:['OPERATION BAGEL','OPERATION BAGEL'], pointsTitle:MAP.pointsTitle, resetFilters:['重置筛选','Reset filters'], types:['点位类型','Marker types'], selectAll:['全选','All'], clearAll:['清空','None'], statuses:['刷新分类','Spawn conditions'], multiSelect:['可多选','Multi-select'], sourcesFloors:['图层来源与楼层','Sources & floors'], floor:['楼层标记','Floor label'], allFloors:['全部楼层','All floors'], unknownFloor:['楼层未注明','Unspecified floor'], searchResults:['搜索结果','Search results'], readMap:['地图说明','Map notes'], pointCaveat:['标记不保证每局刷新或掉落。','Markers do not guarantee spawns or drops.'], heightCaveat:['配准位置与高度仅供参考，未标楼层仍待核验。','Registered positions and heights are approximate; unlabelled floors remain unverified.'], sourceCaveat:['不同来源可能重复标注同一敌人。','Different sources may mark the same enemy.'], personalCaveat:['读取本浏览器的 2D 个人点位，筛选选择单独保存。','Personal 2D markers from this browser are included. These filters are saved separately.'], sourceCredit:['资料标点：@KELZERO / 社区资料 / 客户端配置','Markers: @KELZERO / community sources / client configuration'], saved:['筛选自动保存在本机','Filters saved in this browser'], filters:['筛选','Filters'], mapTitle:[`${MAP.name[0]} · 全区域`,`${MAP.name[1]} · Full map`], switchMap:['切换地图','Switch map'], labels:['编号','IDs'], top:['俯视','Top'], overview:['总览','Overview'], perspective:['自由视角','Orbit view'], retry:['重新加载','Reload'], noPoints:['没有符合筛选的点位','No matching markers'], mapUp:['2D 上方','2D map up'], controls:['左键旋转 · 右键平移 · 滚轮缩放','Drag to orbit · Right-drag to pan · Scroll to zoom'], touchControls:['单指旋转 · 双指缩放 / 平移','One finger to orbit · Two fingers to zoom / pan'], legend:['○ 随机　◇ 条件　? 待核验','○ Random　◇ Conditional　? Unverified'], searchPlaceholder:['搜索名称、编号、备注','Search names, IDs, notes'], loadingTitle:[`正在打开${MAP.name[0]}`,`Opening ${MAP.name[1]}`], loadingData:['读取场景与点位…','Loading scene and markers…'], loadingGeometry:['读取地图模型…','Loading map geometry…'], loadingMaterials:['正在载入贴图','Loading textures'], loadingComplete:['整理场景…','Preparing scene…'], loadFailed:['地图未能完整加载','Map could not finish loading'], webglFailed:['浏览器无法启动 3D 渲染。请启用硬件加速，或返回 2D 地图。','3D rendering is unavailable. Enable browser hardware acceleration or return to the 2D map.'], networkFailed:['资源读取失败，请重试。','An asset could not be loaded. Please retry.'], contextLost:['3D 渲染已中断，请重新加载地图。','The 3D graphics context was lost. Please reload the map.'], shown:['显示','Shown'], total:['共','Total'], pointUnit:['个点位','markers'], onScreen:['当前视野','In view'], allSelected:['已显示全部类型','All types shown'], noneSelected:['已隐藏全部类型','All types hidden'], filterSaved:['筛选已保存','Filters saved'], storageFailed:['浏览器暂时无法保存，当前选择仍然有效。','Browser storage is unavailable. Your current selections still work.'], unknown:['待核验','Unverified'], candidate:['配置候选','Configuration candidate'], approximate:['参考位置','Approximate position'], source:['来源','Source'], floorLabel:['楼层','Floor'], position:['位置','Position'], originalPosition:['原始游戏坐标','Original game coordinates'], estimatedHeight:['导航面参考高度','Estimated navigation height'], unresolvedHeight:['高度待核验','Unverified elevation'], sourceRegistered:['资料图配准','Registered from source map'], focus:['定位到这里','Focus here'], notPositioned:['该点位缺少可靠坐标，暂列在清单中。','This marker has no reliable position and is listed without a map pin.'], conditionalNote:['按本局条件开启，不保证刷新。','Availability depends on the current run.'], randomNote:['随机刷新，不保证物资种类或掉落。','Random spawn; item types and drops are not guaranteed.'], candidateNote:['候选位置与楼层仅供参考，刷新未实测；不参与导航。','Candidate position and floor are references. Spawns are unverified; excluded from navigation.'], fixedNote:['原图固定标注不等于每局开启，也不保证掉落。','A fixed source-map marker does not guarantee availability or a drop.'], unknownNote:['该点的刷新条件仍待核验。','The spawn conditions for this location remain unverified.'], sourceDetails:['点位与来源说明','Marker details & sources'], personal:['个人标记','Personal markers'], personalSource:['本浏览器的 2D 个人标记','Personal 2D markers in this browser'], close:['关闭','Close'], theme:['切换主题','Toggle theme'], search:['搜索点位','Search markers'], topLabel:['俯视 · 与 2D 同向','Top · 2D orientation'], hiddenByFilter:['已关闭所选点位详情','Selected marker hidden'], noSearch:['没有搜索结果','No search results'], unresolvedCount:['个点位待定位','markers need positioning'], unplacedTitle:['待定位点位','Markers awaiting placement'], unresolvedPosition:['位置待核验','Unverified position'], sourceLink:['查看来源 ↗','View source ↗'], materialWarning:['部分贴图未能加载，当前画面尚不完整。','Some textures failed to load. The scene is incomplete.'], loadingPoints:['读取点位中…','Loading markers…'], downloaded:['已读取','Downloaded'], loaded:['已载入','Loaded']
};
const SYMBOLS = {
  electronic:'M-5-5H5V5H-5Z M-5-2H5 M-2 1H2 M0-1V3', mechanical:'M-5-4H5V5H-5Z M-5-1H5 M-2-4V-6H2V-4 M-1 1H1V3H-1Z', gear:'M-6-3H6V5H-6Z M-3-3V-5H3V-3 M-6 0H6 M-2 0V2H2V0', medical:'M-2-6H2V-2H6V2H2V6H-2V2H-6V-2H-2Z', briefcase:'M-6-3H6V5H-6Z M-2-3V-5H2V-3 M-6 0H6', trash:'M-4-3H4L3 6H-3Z M-6-5H6 M-2-5V-7H2V-5 M-1-1V3 M2-1V3', keyroom:'M-1 0H6 M3 0V3 M6 0V2', spawn:'M0-6L5 5L0 2L-5 5Z', exit:'M0-6H-5V6H0 M-1 0H7 M4-3L7 0L4 3', portal:'M-2-6L5-2L2 5L-5 2Z', custom:'M0-6V6 M-6 0H6', gem_enemy:'M0-6L4-2L3 4L0 6L-3 4L-4-2Z M-4-2H4 M0-6V6', trial_table:'M-5-4H5V2H-5Z M-3 2L-4 6 M3 2L4 6 M-2-1H2 M0-3V1', spooky_box:'M-5-4H5V5H-5Z M-5-1H5 M-2 2H-1 M1 2H2 M-2-4L0-6L2-4', withdraw_beacon:'M-4 6V-6L5-4L1-1L-4-2 M-6 6H-1', enemy:'M-6-5L-2-3H2L6-5V5H-6Z M-4-1L-1 1 M4-1L1 1', phantom:'M0-7L7 0L0 7L-7 0Z M-3-1V2 M3-1V2'
};
const CANDIDATE_TYPES = new Set(['gem_enemy','trial_table','spooky_box','withdraw_beacon']);
const state = { data:null, points:[], filtered:[], filteredMarkers:[], filteredPlaced:0, markerRevision:0, markers:new Map(), types:new Set(), statuses:new Set(), layers:new Set(), query:'', floor:'all', labels:false, quality:null, selected:null, language:'zh-CN', sceneReady:false, ready:false, modelStats:null, textureFailures:[], top:false, onScreen:0, renderRequested:false, pointPositions:new Map(), loading:{kind:'loadingData'}, error:null };
let roam=null,roamBusy=false,roamGeneration=0,lastFrameTime=0;
let savedFilters = null;
try { savedFilters = JSON.parse(localStorage.getItem(FILTER_KEY) || 'null'); } catch { /* Invalid saved filters use defaults. */ }
state.quality=['clear','fast'].includes(savedFilters?.quality)?savedFilters.quality:innerWidth>=900?'clear':'fast';
try { state.language = localStorage.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'zh-CN'; } catch { /* Defaults remain usable. */ }
const requestedLanguage = new URLSearchParams(location.search).get('lang');
if (requestedLanguage === 'en' || requestedLanguage === 'zh-CN') state.language = requestedLanguage;
const t = key => (UI[key] || [key,key])[state.language === 'en' ? 1 : 0];
const localized = (record, key='label') => {const raw=String(record?.[key]||'');return state.language==='en'?String(record?.[`${key}En`]||(record?.personal?raw:window.DUKE_I18N?.english(raw)||raw)):raw;};
const node = (tag, className, text) => { const element=document.createElement(tag); if(className)element.className=className; if(text !== undefined)element.textContent=text; return element; };
const validPosition = p => Array.isArray(p) && p.length===3 && p.every(Number.isFinite);
const isCandidate = p => CANDIDATE_TYPES.has(p.type) || /candidate|client33/.test(p.layer || '') || p.status==='candidate';
const pointName = p => localized(p,'name') || localized(p,'label') || p.id;
const pointId = p => p.personal ? p.sourceId || p.id : p.id;
const typeInfo = id => state.data?.types.find(item=>item.id===id) || {id,label:id,labelEn:id,color:'#b4c6ce'};
const statusInfo = id => state.data?.statuses.find(item=>item.id===id) || {id,label:id,labelEn:id};
const layerInfo = id => state.data?.layers.find(item=>item.id===id) || {id,label:id,labelEn:id};
const pointColor = p => /^#[0-9a-fA-F]{3,8}$/.test(p.color || '') ? p.color : typeInfo(p.type).color || '#b4c6ce';
function icon(type,color) {
  const ns='http://www.w3.org/2000/svg', svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','-9 -9 18 18'); svg.setAttribute('aria-hidden','true'); svg.setAttribute('fill','none'); svg.setAttribute('stroke',color||'#b4c6ce'); svg.setAttribute('stroke-width','1.8'); svg.setAttribute('stroke-linecap','round'); svg.setAttribute('stroke-linejoin','round');
  const path=document.createElementNS(ns,'path'); path.setAttribute('d',SYMBOLS[type==='ore_boss'?'enemy':type]||SYMBOLS.custom); svg.append(path);
  if(type==='keyroom'||type==='portal'){const circle=document.createElementNS(ns,'circle');circle.setAttribute('r',type==='keyroom'?'3':'2');circle.setAttribute('cx',type==='keyroom'?'-3':'0');svg.append(circle);}
  return svg;
}
function toast(message) { $('toast').textContent=message; $('toast').hidden=false; clearTimeout(toast.timer); toast.timer=setTimeout(()=>$('toast').hidden=true,3200); }
function saveFilters() {
  try { const values=state.data?{version:1,types:[...state.types],statuses:[...state.statuses],layers:[...state.layers],floor:state.floor,labels:state.labels,quality:state.quality}:{...savedFilters,version:1,labels:state.labels,quality:state.quality};localStorage.setItem(FILTER_KEY,JSON.stringify(values)); }
  catch { toast(t('storageFailed')); }
}
function applyLanguage() {
  document.documentElement.lang=state.language; document.documentElement.dataset.language=state.language;
  document.title=`${t('title')} · 3D ${state.language==='en'?'Map':'地图'} — DUKE`;
  for(const element of document.querySelectorAll('[data-ui]')) element.textContent=t(element.dataset.ui);
  for(const element of document.querySelectorAll('[data-ui-aria]'))element.ariaLabel=t(element.dataset.uiAria);
  $('language-toggle').textContent=state.language==='en'?'中文':'EN'; $('language-toggle').ariaLabel=state.language==='en'?'切换为中文':'Switch to English';
  $('point-search').placeholder=t('searchPlaceholder'); $('point-search').ariaLabel=t('search');
  for(const id of ['close-filters','close-detail','sidebar-shade']) $(id).ariaLabel=t('close');
  document.querySelector('[data-theme-toggle]').ariaLabel=t('theme');
  $('view-label').textContent=t(state.top?'topLabel':'perspective');
  $('scene-canvas').ariaLabel=state.language==='en'?`Interactive 3D map of ${MAP.name[1]}`:`可旋转、缩放的${MAP.name[0]}三维地图`;
  $('map-selector').ariaLabel=t('switchMap');for(const option of $('map-selector').options)option.textContent=MAPS[option.value].name[state.language==='en'?1:0];
  $('filter-panel').ariaLabel=t('filters'); $('point-detail').ariaLabel=state.language==='en'?'Marker details':'点位详情';
  $('zoom-in').ariaLabel=state.language==='en'?'Zoom in':'放大'; $('zoom-out').ariaLabel=state.language==='en'?'Zoom out':'缩小';
  updateQuality();
  if(state.data){buildFilters(); updateFiltered(false); if(state.selected)showDetail(state.selected);}
  updateLoadingText();renderRoamUi();
}
function checkboxRow(info,group,className) {
  const label=node('label',className), input=node('input'); input.type='checkbox';input.value=info.id;input.checked=state[group].has(info.id);input.dataset.filter=group;
  label.append(input);
  if(group==='types'){const symbol=node('span','type-symbol');symbol.append(icon(info.id,info.color));label.append(symbol);}
  label.append(node('span',group==='types'?'type-name':'',localized(info)));
  if(group==='types'){const count=node('span','type-count');count.dataset.countType=info.id;label.append(count);}
  input.addEventListener('change',()=>{input.checked?state[group].add(info.id):state[group].delete(info.id);updateFiltered();});
  return label;
}
function buildFilters() {
  $('type-filters').replaceChildren(...state.data.types.map(info=>checkboxRow(info,'types','type-row')));
  $('status-filters').replaceChildren(...state.data.statuses.map(info=>checkboxRow(info,'statuses','chip')));
  $('layer-filters').replaceChildren(...state.data.layers.map(info=>checkboxRow(info,'layers','layer-row')));
  $('floor-filter').value=state.floor; $('toggle-labels').setAttribute('aria-pressed',String(state.labels));
}
function matches(p,ignoreType=false) {
  if(!ignoreType&&!state.types.has(p.type))return false;
  if(!state.statuses.has(p.status)||!state.layers.has(p.layer))return false;
  if(state.floor==='unknown'&&p.floors?.length)return false;
  if(!['all','unknown'].includes(state.floor)&&!p.floors?.some(f=>String(f)===state.floor))return false;
  if(state.query){const haystack=[p.id,p.sourceId,p.name,p.nameEn,p.label,p.labelEn,p.note,p.noteEn,p.region,p.regionEn,localized(typeInfo(p.type)),localized(layerInfo(p.layer))].filter(Boolean).join(' ').toLocaleLowerCase();if(!haystack.includes(state.query.toLocaleLowerCase()))return false;}
  return true;
}
function resetFilters() {
  state.types=new Set(state.data.types.map(item=>item.id));state.statuses=new Set(state.data.statuses.map(item=>item.id));state.layers=new Set(state.data.layers.map(item=>item.id));state.floor='all';state.query='';$('point-search').value='';buildFilters();updateFiltered();
}
function updateFiltered(persist=true) {
  state.filtered=state.points.filter(p=>matches(p));const selectedIds=new Set(state.filtered.map(p=>p.id));
  state.filteredMarkers=state.filtered.flatMap(p=>{const marker=state.markers.get(p.id);return marker?[{point:p,marker,position:state.pointPositions.get(p.id)}]:[];});
  state.filteredPlaced=state.filteredMarkers.length;state.markerRevision++;
  for(const [id,marker] of state.markers){const filtered=selectedIds.has(id),name=pointName(marker.point);if(!filtered&&!marker.hidden)marker.hidden=true;marker.dataset.filtered=String(filtered);marker.ariaLabel=name;marker.title=`${name} · ${localized(statusInfo(marker.point.status))}`;const label=marker.querySelector('.marker-label'),text=state.selected?.id===id?name:pointId(marker.point);if(label.textContent!==text)label.textContent=text;}
  if(state.selected&&!selectedIds.has(state.selected.id))closeDetail();
  for(const element of document.querySelectorAll('[data-count-type]')){const id=element.dataset.countType,total=state.points.filter(p=>p.type===id).length,shown=state.filtered.filter(p=>p.type===id).length;element.textContent=`${shown} / ${total}`;}
  $('filter-count').textContent=state.language==='en'?`${state.filtered.length} / ${state.points.length} markers`:`${state.filtered.length} / ${state.points.length} 个点位`;
  $('empty-points').hidden=state.filtered.length!==0||!state.sceneReady;
  $('marker-layer').classList.toggle('show-labels',state.labels);
  const unresolved=state.filtered.filter(p=>!validPosition(p.position));$('results-section').hidden=!state.query&&!unresolved.length;$('results-title').textContent=t(state.query?'searchResults':'unplacedTitle');
  const results=state.query?state.filtered.slice(0,100):unresolved;$('result-count').textContent=String(state.query?state.filtered.length:unresolved.length);
  $('search-results').replaceChildren(...results.map(p=>{const button=node('button','search-result');button.type='button';button.append(node('span','',pointName(p)),node('small','',`${localized(typeInfo(p.type))} · ${pointId(p)}${!validPosition(p.position)?` · ${t('unresolvedPosition')}`:''}`));button.addEventListener('click',()=>selectPoint(p,true));return button;}));
  if(state.query&&!results.length)$('search-results').append(node('p','muted',t('noSearch')));
  if(persist)saveFilters();requestRender();updateCounter();
}
function makeMarkers() {
  $('marker-layer').replaceChildren();state.markers.clear();state.pointPositions.clear();const fragment=document.createDocumentFragment();
  for(const p of state.points){
    if(!validPosition(p.position))continue;
    const marker=node('button','map-marker');marker.type='button';marker.dataset.pointId=p.id;marker.point=p;marker.style.setProperty('--point-color',pointColor(p));marker.hidden=true;
    if(p.status==='random_source'||p.status==='random')marker.classList.add('random');if(isCandidate(p))marker.classList.add('candidate');
    const symbol=node('span','marker-icon');symbol.append(icon(p.type,pointColor(p)));marker.append(symbol);
    const badge=p.status==='conditional'?'◇':p.status==='random_source'||p.status==='random'?'○':p.status==='unknown'||isCandidate(p)?'?':'';if(badge)marker.append(node('span','point-status',badge));
    marker.append(node('span','marker-label',pointId(p)));marker.addEventListener('click',event=>{event.stopPropagation();selectPoint(p,false);});
    marker.addEventListener('focus',()=>marker.classList.add('keyboard-focus'));marker.addEventListener('blur',()=>marker.classList.remove('keyboard-focus'));
    fragment.append(marker);state.markers.set(p.id,marker);state.pointPositions.set(p.id,new THREE.Vector3(...p.position));
  }
  $('marker-layer').append(fragment);
}
function clearSelectedMarker() {const marker=state.selected&&state.markers.get(state.selected.id);if(!marker)return;marker.classList.remove('selected');const label=marker.querySelector('.marker-label'),text=pointId(marker.point);if(label.textContent!==text)label.textContent=text;}
function closeDetail() { clearSelectedMarker();state.selected=null;state.markerRevision++;$('point-detail').hidden=true;requestRender(); }
function selectPoint(p,focus=false) {
  clearSelectedMarker();state.selected=p;state.markerRevision++;const marker=state.markers.get(p.id);marker?.classList.add('selected');if(marker)marker.querySelector('.marker-label').textContent=pointName(p);showDetail(p);
  if(focus){focusPoint(p);setFiltersOpen(false);}requestRender();
}
function detailMeta(label,value) {const wrapper=node('div');wrapper.append(node('dt','',label),node('dd','',value));return wrapper;}
function showDetail(p) {
  const content=$('detail-content');content.replaceChildren();const type=node('div','detail-type'),symbol=node('span','type-symbol');symbol.append(icon(p.type,pointColor(p)));type.append(symbol,node('span','',localized(typeInfo(p.type))));content.append(type,node('h2','',pointName(p)),node('div','detail-id',pointId(p)));
  const badges=node('div','detail-badges');badges.append(node('span','',localized(statusInfo(p.status))));if(isCandidate(p))badges.append(node('span','candidate-badge',t('candidate')));if(p.approximate)badges.append(node('span','',t('approximate')));content.append(badges);
  const sourceNotes=node('details','room-details point-source-details');sourceNotes.append(node('summary','',t('sourceDetails')));const note=localized(p,'note');if(note)sourceNotes.append(node('p','detail-note',note));
  if(p.conditions?.length){const conditions=node('div','detail-conditions');conditions.append(node('strong','',state.language==='en'?'Conditions':'刷新条件'));for(const condition of p.conditions){const text=typeof condition==='string'?localized({label:condition}):localized(condition,'description')||localized(condition);conditions.append(node('p','',text));}content.append(conditions);}
  const floorMeta=node('dl','detail-meta');floorMeta.append(detailMeta(t('floorLabel'),p.floors?.length?p.floors.map(f=>Number(f)===-1?'B1':`${f}F`).join(' / '):t('unknownFloor')));content.append(floorMeta);const meta=node('dl','detail-meta');meta.append(detailMeta(t('source'),localized(layerInfo(p.layer))));
  const posLabel=!validPosition(p.position)?t('unresolvedPosition'):p.positionStatus==='original-world'?t('originalPosition'):t('sourceRegistered');const heightLabel=p.heightStatus==='original-world'?'':p.heightStatus==='landmark-correspondence'?(state.language==='en'?'Matched landmark elevation':'地标对应高度'):/estimated|sampled/.test(p.heightStatus||'')?t('estimatedHeight'):t('unresolvedHeight');meta.append(detailMeta(t('position'),[posLabel,heightLabel].filter(Boolean).join(' · ')));sourceNotes.append(meta);
  const caveat=isCandidate(p)?'candidateNote':p.status==='conditional'?'conditionalNote':/random/.test(p.status)?'randomNote':p.status==='fixed_source'?'fixedNote':'unknownNote';content.append(node('p','detail-caveat',t(caveat)));
  if(p.room){const room=node('details','room-details');room.append(node('summary','',state.language==='en'?'Key room source record':'门禁房原图记录'));const lines=[`${state.language==='en'?'Card tier':'门卡等级'}: ${p.room.cardTier}`,`${state.language==='en'?'Listed cost':'图示价格'}: ${Number(p.room.listedCost).toLocaleString()}`,...Object.entries(p.room.contents||{}).map(([type,count])=>`${localized(typeInfo(type))} × ${count}`)];room.append(node('p','',lines.join('\n')),node('p','',localized({note:p.room.note},'note')));content.append(room);}
  const sourceUrl=p.sourceUrl||p.source?.url;if(sourceUrl){try{const url=new URL(sourceUrl,location.href);if(['https:','http:'].includes(url.protocol)){const link=node('a','',t('sourceLink'));link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';sourceNotes.append(link);}}catch{/* Invalid source URLs are not linked. */}}
  content.append(sourceNotes);if(validPosition(p.position)){const focus=node('button','focus-point',t('focus'));focus.type='button';focus.addEventListener('click',()=>{focusPoint(p);setFiltersOpen(false);});content.append(focus);}else content.append(node('p','detail-caveat',t('notPositioned')));
  $('point-detail').hidden=false;
}
function setFiltersOpen(open) {document.querySelector('.map-layout').classList.toggle('filters-open',open);$('sidebar-shade').hidden=!open;$('open-filters').setAttribute('aria-expanded',String(open));}

let renderer, scene, camera, controls, model, manifest, resizeObserver;
let viewChosen = false;
const projected=new THREE.Vector3();const screenUp=new THREE.Vector3();let lastWidth=0,lastHeight=0,frameHandle=0;
const projectedCamera=new Float64Array(32);
let projectedRevision=-1,projectedWidth=0,projectedHeight=0,projectedReady=false,groundAxes=null,groundAxesData=null,compassTransform='';
function requestRender() {if(state.renderRequested||!renderer)return;state.renderRequested=true;frameHandle=requestAnimationFrame(renderFrame);}
function renderFrame(now=performance.now()) {
  state.renderRequested=false;if(!renderer||document.hidden){lastFrameTime=0;return;}
  const dt=lastFrameTime?Math.min(.05,Math.max(0,(now-lastFrameTime)/1000)):1/60;lastFrameTime=now;
  const changed=roam?.active?roam.update(dt):controls.update();renderer.render(scene,camera);projectMarkers();if(changed)requestRender();
}
function projectMarkers() {
  if(!camera)return;camera.updateMatrixWorld();const width=lastWidth,height=lastHeight,view=camera.matrixWorldInverse.elements,projection=camera.projectionMatrix.elements;
  let changed=projectedRevision!==state.markerRevision||projectedWidth!==width||projectedHeight!==height||projectedReady!==state.sceneReady;
  for(let i=0;i<16&&!changed;i++)changed=projectedCamera[i]!==view[i]||projectedCamera[i+16]!==projection[i];
  // Texture uploads may redraw a stationary scene without changing a single pin.
  if(!changed)return;
  projectedCamera.set(view);projectedCamera.set(projection,16);projectedRevision=state.markerRevision;projectedWidth=width;projectedHeight=height;projectedReady=state.sceneReady;
  let onScreen=0;
  // Markers remain visible over buildings; source floor labels still distinguish stacked locations.
  for(const {point:p,marker,position} of state.filteredMarkers){
    projected.copy(position);projected.y+=1.4;projected.project(camera);
    const visible=state.sceneReady&&projected.z>=-1&&projected.z<=1&&Math.abs(projected.x)<=1.05&&Math.abs(projected.y)<=1.07;
    if(marker.hidden===visible)marker.hidden=!visible;if(!visible)continue;onScreen++;
    const x=(projected.x+1)*width*.5-14,y=(1-projected.y)*height*.5-14,transform=`translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`,zIndex=state.selected?.id===p.id?'15':String(Math.max(1,Math.min(8,Math.round((1-projected.z)*1000))));
    if(marker.projectedTransform!==transform){marker.style.transform=transform;marker.projectedTransform=transform;}if(marker.projectedZIndex!==zIndex){marker.style.zIndex=zIndex;marker.projectedZIndex=zIndex;}
  }
  state.onScreen=onScreen;updateCounter();
  screenUp.copy(mapGroundAxes().down).negate().transformDirection(camera.matrixWorldInverse);const angle=Math.atan2(screenUp.x,screenUp.y),transform=`rotate(${angle}rad)`;if(compassTransform!==transform){$('compass-arrow').style.transform=transform;compassTransform=transform;}
}
function updateCounter() {
  const counter=$('visible-count');if(!state.data){const text=t('loadingPoints');if(counter.textContent!==text)counter.textContent=text;return;}
  const placed=state.filteredPlaced,unplaced=state.filtered.length-placed;
  const text=state.language==='en'?(unplaced?`${placed} placed · ${unplaced} awaiting placement · ${state.onScreen} in view`:`${placed} markers · ${state.onScreen} in view`):(unplaced?`已定位 ${placed} · 待定位 ${unplaced} · 视野内 ${state.onScreen}`:`${placed} 个点位 · 视野内 ${state.onScreen}`);
  if(counter.textContent!==text)counter.textContent=text;
}
function qualityRatio(){return state.quality==='clear'?(innerWidth>=900?2:1.5):1;}
function updateQuality(){const clear=state.quality==='clear',current=t(clear?'qualityClear':'qualityFast'),next=t(clear?'qualityFast':'qualityClear'),button=$('quality-toggle');button.textContent=current;button.setAttribute('aria-pressed',String(clear));button.ariaLabel=`${t('quality')}: ${current} (${qualityRatio()}×). ${t('switchQuality')} ${next}`;button.title=button.ariaLabel;if(renderer&&renderer.getPixelRatio()!==qualityRatio())renderer.setPixelRatio(qualityRatio());requestRender();}
function resize() {const stage=$('map-stage');lastWidth=stage.clientWidth;lastHeight=stage.clientHeight;if(!renderer||!lastWidth||!lastHeight)return;updateQuality();renderer.setSize(lastWidth,lastHeight,false);camera.aspect=lastWidth/lastHeight;camera.updateProjectionMatrix();requestRender();}
function setupRenderer() {
  try{renderer=new THREE.WebGLRenderer({canvas:$('scene-canvas'),antialias:true,powerPreference:'high-performance'});}catch(error){throw new Error(t('webglFailed'),{cause:error});}
  renderer.setPixelRatio(qualityRatio());renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1.2;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene=new THREE.Scene();scene.background=new THREE.Color('#b7bec9');
  const environmentScene=new THREE.Scene();environmentScene.background=new THREE.Color(.35,.35,.35);const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(environmentScene,0,.1,100).texture;scene.environmentIntensity=.4;pmrem.dispose();
  camera=new THREE.PerspectiveCamera(45,1,.5,8000);camera.position.set(480,610,620);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.12;controls.minDistance=8;controls.maxDistance=2200;controls.maxPolarAngle=DEFAULT_MAX_POLAR_ANGLE;controls.target.set(15,10,-5);controls.screenSpacePanning=true;controls.addEventListener('change',requestRender);controls.addEventListener('start',()=>{if(roamBusy)stopRoam();viewChosen=true;state.top=false;$('top-view').setAttribute('aria-pressed','false');$('view-label').textContent=t('perspective');});
  scene.add(new THREE.HemisphereLight(0xf5f3ef,0x9f9280,.6));const sun=new THREE.DirectionalLight(0xfff2dc,2.5);sun.name='Preview sunlight';sun.position.set(-220,480,280);sun.target.position.set(15,45,-5);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);sun.shadow.camera.near=1;sun.shadow.camera.far=1600;sun.shadow.camera.left=-370;sun.shadow.camera.right=370;sun.shadow.camera.top=370;sun.shadow.camera.bottom=-370;sun.shadow.bias=-.0004;sun.shadow.normalBias=.25;sun.shadow.autoUpdate=false;sun.shadow.needsUpdate=true;scene.add(sun,sun.target);
  resizeObserver=new ResizeObserver(resize);resizeObserver.observe($('map-stage'));resize();
  $('scene-canvas').addEventListener('webglcontextlost',event=>{event.preventDefault();state.sceneReady=false;showError(new Error(t('contextLost')));});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)requestRender();});
}
function setCamera(position,target,fov) {if(!controls)return;viewChosen=true;if(Number.isFinite(fov)&&fov>=10&&fov<=120){camera.fov=fov;camera.updateProjectionMatrix();}controls.enableDamping=false;camera.position.fromArray(position);controls.target.fromArray(target);camera.up.set(0,1,0);camera.lookAt(controls.target);controls.update();controls.enableDamping=true;requestRender();}
function playableBounds(){const points=state.points.filter(p=>!p.personal&&validPosition(p.position));if(!points.length)return null;const bounds=new THREE.Box3().setFromPoints(points.map(p=>new THREE.Vector3(...p.position)));bounds.expandByVector(new THREE.Vector3(45,35,45));return bounds;}
function mapGroundAxes(){
  if(groundAxes&&groundAxesData===state.data)return groundAxes;
  const matrix=state.data?.coordinateSystem?.sourceImageToThreeXZ;
  // The registration includes slight shear: align the view to source-image up.
  const down=matrix?.length===3&&Number.isFinite(matrix[1]?.[0])&&Number.isFinite(matrix[1]?.[1])?new THREE.Vector3(matrix[1][0],0,matrix[1][1]).normalize():new THREE.Vector3(0,0,1);
  groundAxesData=state.data;groundAxes={right:new THREE.Vector3(down.z,0,-down.x),down};return groundAxes;
}
function configureMapLighting(){
  // Keep the approved Suburbs rig; center the same neutral rig over Janus.
  if(MAP.id!=='janus')return;const bounds=playableBounds();if(!bounds)return;
  const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3()),radius=Math.max(size.x,size.z)*.6;
  const sun=scene.children.find(light=>light.isDirectionalLight);if(!sun)return;
  sun.target.position.copy(center);sun.position.copy(center).add(new THREE.Vector3(-235,435,285));
  Object.assign(sun.shadow.camera,{left:-radius,right:radius,top:radius,bottom:-radius});sun.shadow.camera.updateProjectionMatrix();sun.shadow.needsUpdate=true;renderer.shadowMap.needsUpdate=true;
}
function perspectiveState(){state.top=false;$('top-view').setAttribute('aria-pressed','false');$('view-label').textContent=t('perspective');}
function overview() {
  stopRoam();if(!controls)return;controls.maxPolarAngle=DEFAULT_MAX_POLAR_ANGLE;camera.fov=45;camera.updateProjectionMatrix();const bounds=playableBounds();if(!bounds){const view=manifest?.overview||{position:[480,610,620],target:[15,45,-5]};setCamera(view.position,view.target);perspectiveState();return;}
  const axes=mapGroundAxes(),target=bounds.getCenter(new THREE.Vector3()),direction=new THREE.Vector3(0,.78,0).addScaledVector(axes.right,.10).addScaledVector(axes.down,.62).normalize(),right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right),tanV=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),tanH=tanV*camera.aspect;let distance=100;
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){const corner=new THREE.Vector3(x,y,z).sub(target),depth=corner.dot(direction);distance=Math.max(distance,Math.abs(corner.dot(right))/tanH+depth,Math.abs(corner.dot(up))/tanV+depth);}
  setCamera(target.clone().addScaledVector(direction,distance*1.08).toArray(),target.toArray());perspectiveState();
}
function topView() {
  stopRoam();if(!controls)return;controls.maxPolarAngle=DEFAULT_MAX_POLAR_ANGLE;camera.fov=45;camera.updateProjectionMatrix();const playable=playableBounds(),bounds=playable?{min:playable.min.toArray(),max:playable.max.toArray()}:manifest?.focusBounds;let center=[15,45,-5],height=900;
  if(bounds?.min&&bounds?.max){center=bounds.min.map((v,i)=>(v+bounds.max[i])/2);const width=bounds.max[0]-bounds.min[0],depth=bounds.max[2]-bounds.min[2];height=Math.max(depth,width/Math.max(camera.aspect,.3))/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))*1.12;}
  const down=mapGroundAxes().down;setCamera([center[0]+down.x*.05,center[1]+height,center[2]+down.z*.05],center);state.top=true;$('top-view').setAttribute('aria-pressed','true');$('view-label').textContent=t('topLabel');
}
function closeView() {
  stopRoam();if(!controls||!validPosition(manifest?.camera?.position)||!validPosition(manifest?.camera?.target))return;
  const view=manifest.camera,offset=view.position.map((value,index)=>value-view.target[index]),distance=Math.hypot(...offset);
  const polar=distance?Math.acos(Math.max(-1,Math.min(1,offset[1]/distance))):0;
  // A source street-level camera may look upward; retain that precise angle.
  // Ordinary overview/top navigation restores the original ground-facing limit.
  controls.maxPolarAngle=Math.max(DEFAULT_MAX_POLAR_ANGLE,Math.min(Math.PI-.00001,polar+.00001));
  setCamera(view.position,view.target,view.fov);perspectiveState();
}
function focusPoint(p) {if(!validPosition(p.position)||!controls)return;stopRoam();const target=new THREE.Vector3(...p.position);const offset=camera.position.clone().sub(controls.target).normalize().multiplyScalar(64);if(offset.y<20)offset.y=35;setCamera(target.clone().add(offset).toArray(),target.toArray());state.top=false;$('top-view').setAttribute('aria-pressed','false');$('view-label').textContent=t('perspective');}
function zoom(factor){if(!controls)return;if(roamBusy)stopRoam();viewChosen=true;const offset=camera.position.clone().sub(controls.target);offset.multiplyScalar(factor);offset.clampLength(controls.minDistance,controls.maxDistance);camera.position.copy(controls.target).add(offset);controls.update();requestRender();}
function updateLoadingText() {
  if(state.error){$('loading-title').textContent=t('loadFailed');$('loading-detail').textContent=state.error;return;}
  $('loading-title').textContent=t('loadingTitle');const info=state.loading;
  if(info.kind==='textures'){$('loading-detail').textContent=`${t('loadingMaterials')} ${info.done} / ${info.total}`;}
  else if(info.kind==='geometry'){$('loading-detail').textContent=`${t('loadingGeometry')} ${info.bytes?`${(info.bytes/1048576).toFixed(1)} MB`:''}`;}
  else $('loading-detail').textContent=t(info.kind||'loadingData');
}
function progress(info) {state.loading=info;updateLoadingText();if(Number.isFinite(info.percent))$('loading-progress').value=info.percent;else $('loading-progress').removeAttribute('value');if(info.kind==='textures'&&model)$('loading-panel').classList.add('compact');}
function showError(error) {state.sceneReady=false;state.ready=false;state.error=error?.message||t('networkFailed');stopRoam();$('loading-panel').hidden=false;$('loading-panel').classList.add('error');$('loading-title').textContent=t('loadFailed');$('loading-detail').textContent=state.error;$('retry-load').hidden=false;console.error(`[${MAP.id}-3d]`,error);}
async function readJson(url) {const response=await fetch(url);if(!response.ok)throw new Error(`${t('networkFailed')} (${response.status})`);return response.json();}
async function loadPoints() {
  const data=await readJson(`${DATA_ROOT}points.json?v=20261107-refresh-launch-1`);if(data.map!==MAP.id||!Array.isArray(data.points)||!Array.isArray(data.types)||!Array.isArray(data.layers)||!Array.isArray(data.statuses))throw new Error('Invalid marker data');
  state.data=data;state.points=data.points.map(p=>({...p,type:p.type==='enemy'&&p.enemyClass==='phantom'?'phantom':p.type}));
  await importPersonalPoints();
  for(const group of ['types','statuses','layers']){const allowed=new Set(data[group].map(item=>item.id));const stored=savedFilters?.[group];state[group]=Array.isArray(stored)?new Set(stored.filter(id=>allowed.has(id))):allowed;}
  state.floor=['all','unknown','1','2','3','-1'].includes(savedFilters?.floor)?savedFilters.floor:'all';state.labels=Boolean(savedFilters?.labels);makeMarkers();buildFilters();updateFiltered(false);
}
async function importPersonalPoints() {
  let personal;try{personal=JSON.parse(localStorage.getItem(state.data.personalStorage?.key||'bagel-atlas-local-v1')||'{}');}catch{return;}
  const items=Array.isArray(personal.custom)?personal.custom.filter(p=>p.map===MAP.id):[];if(!items.length)return;
  if(!state.data.layers.some(l=>l.id==='personal'))state.data.layers.push({id:'personal',label:'个人标记',labelEn:'Personal markers'});
  if(!state.data.types.some(type=>type.id==='custom'))state.data.types.push({id:'custom',label:'个人标记',labelEn:'Personal markers',color:'#a7b5fa'});
  if(!state.data.statuses.some(status=>status.id==='unknown'))state.data.statuses.push({id:'unknown',label:'待核验',labelEn:'Unverified'});
  const matrix=state.data.coordinateSystem?.sourceImageToThreeXZ||state.data.sourceImageToThreeXZ;
  let nav=null;try{if(items.some(p=>!validPosition([p.worldPosition?.x,p.worldPosition?.y,p.worldPosition?.z])))nav=await readJson(NAV_URL);}catch{/* Personal markers remain listed when height data cannot be read. */}
  const ids=new Set(state.points.map(p=>p.id));
  for(const item of items){
    const id=`personal:${item.id}`;if(ids.has(id))continue;ids.add(id);const world=item.worldPosition;let position=null,heightStatus='unresolved';
    if(item.coordinateSpace==='source-world'&&validPosition([world?.x,world?.y,world?.z])){position=[-world.x,world.y,world.z];heightStatus='original-world';}
    else if(Number.isFinite(item.x)&&Number.isFinite(item.y)&&matrix?.length===3){const x=item.x*matrix[0][0]+item.y*matrix[1][0]+matrix[2][0],z=item.x*matrix[0][1]+item.y*matrix[1][1]+matrix[2][1];const y=sampleNavigationHeight(nav,x,z);if(Number.isFinite(y)){position=[x,y,z];heightStatus='navmesh-estimated';}}
    state.points.push({id,sourceId:String(item.id||''),name:String(item.label||item.name||'个人标记'),nameEn:String(item.label||item.name||'Personal marker'),type:state.data.types.some(type=>type.id===item.type)?item.type:'custom',layer:'personal',status:'unknown',floors:Array.isArray(item.floors)?item.floors:[],position,heightStatus,positionStatus:heightStatus==='original-world'?'original-world':'registered-image',approximate:heightStatus!=='original-world',note:String(personal.notes?.[item.id]||item.note||''),noteEn:String(personal.notes?.[item.id]||item.note||''),color:item.color,personal:true});
  }
}
function sampleNavigationHeight(nav,x,z) {
  if(!Array.isArray(nav?.tiles))return null;
  let hint=null,hintDistance=Infinity;for(const p of state.points){if(!validPosition(p.position))continue;const distance=(p.position[0]-x)**2+(p.position[2]-z)**2;if(distance<hintDistance){hintDistance=distance;hint=p.position[1];}}
  const px=-x,pz=z,hits=[];let nearest=null;
  for(const tile of nav.tiles)for(let index=0;index<(tile.polygons||[]).length;index++){
    const polygon=tile.polygons[index],detail=tile.detailMeshes?.[index];if(!detail)continue;
    const [vertexBase,triangleBase,vertexCount,triangleCount]=detail,pool=polygon.vertices.map(i=>tile.vertices[i]).concat(tile.detailVertices.slice(vertexBase,vertexBase+vertexCount));
    for(let j=triangleBase;j<triangleBase+triangleCount;j++){
      const triangle=tile.detailTriangles[j],a=pool[triangle[0]],b=pool[triangle[1]],c=pool[triangle[2]];if(!a||!b||!c)continue;
      const determinant=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(determinant)>1e-8){const u=((b[2]-c[2])*(px-c[0])+(c[0]-b[0])*(pz-c[2]))/determinant,v=((c[2]-a[2])*(px-c[0])+(a[0]-c[0])*(pz-c[2]))/determinant,w=1-u-v;if(u>=-.00001&&v>=-.00001&&w>=-.00001)hits.push(u*a[1]+v*b[1]+w*c[1]);}
      if(!hits.length)for(const [start,end]of [[a,b],[b,c],[c,a]]){const dx=end[0]-start[0],dz=end[2]-start[2],length=dx*dx+dz*dz;const f=length?Math.max(0,Math.min(1,((px-start[0])*dx+(pz-start[2])*dz)/length)):0;const distance=(px-start[0]-f*dx)**2+(pz-start[2]-f*dz)**2;if(!nearest||distance<nearest.distance)nearest={distance,y:start[1]+f*(end[1]-start[1])};}
    }
  }
  if(hits.length)return hits.sort((a,b)=>Math.abs(a-(hint??a))-Math.abs(b-(hint??b)))[0];
  return nearest&&nearest.distance<=2500?nearest.y:null;
}
async function start() {
  applyLanguage();
  try {
    if(state.language==='en'&&window.DUKE_I18N)await window.DUKE_I18N.load();
    setupRenderer();
    let pointsReady = false;
    function enableScene() {
      if (!pointsReady || !model || state.sceneReady || state.error) return;
      state.sceneReady = true;
      configureMapLighting();
      if (!viewChosen) {
        overview();
        void beginRoam();
      }
      $('empty-points').hidden = state.filtered.length !== 0;
      $('loading-panel').classList.add('compact');
      renderRoamUi();
      requestRender();
    }
    const pointsPromise = loadPoints().then(() => {
      pointsReady = true;
      enableScene();
    });
    const mapPromise = loadMapScene(`${DATA_ROOT}scene.json?v=${VERSION}`, {
      renderer, onProgress: progress, onRender: requestRender,
      onGeometry(group, metadata) {
        model = group;
        manifest = metadata;
        scene.add(group);
        enableScene();
        requestRender();
      }
    });
    const [, loaded] = await Promise.all([pointsPromise, mapPromise]);
    if (state.error) return;
    state.modelStats = loaded.stats;
    state.textureFailures = loaded.failedTextures || [];
    progress({kind:'loadingComplete',percent:99});
    await renderer.compileAsync(scene, camera);
    if (state.error) return;
    for (const light of scene.children) if (light.isDirectionalLight) light.shadow.needsUpdate = true;
    renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
    state.ready = true;
    $('loading-panel').hidden=true;state.loading={kind:'loadingComplete'};
    if(loaded.failedTextures?.length){const warning=$('load-warning');warning.append(node('span','',`${t('materialWarning')} (${loaded.failedTextures.length})`));const retry=node('button','',t('retry'));retry.addEventListener('click',()=>location.reload());warning.append(retry);warning.hidden=Boolean(roam?.active);}
    updateFiltered(false);requestRender();
  } catch(error) {showError(error);}
}

function renderRoamUi() {
  const current=roam?.getState(),active=Boolean(current?.active),flying=current?.mode==='fly';
  const setText=(element,text)=>{if(element.textContent!==text)element.textContent=text;};
  const setPressed=(id,pressed)=>{const element=$(id),value=String(pressed);if(element.getAttribute('aria-pressed')!==value)element.setAttribute('aria-pressed',value);};
  $('roam-toggle').disabled=!state.sceneReady||roamBusy;setText($('roam-toggle'),t(roamBusy?'roamLoading':'roamEnter'));setPressed('roam-toggle',active);
  // The compact progress panel shares the space used by the roaming controls.
  if (!state.ready && !state.error) $('loading-panel').hidden = active;
  if (state.ready && state.textureFailures.length) $('load-warning').hidden = active;
  $('roam-panel').hidden=!active;$('roam-touch').hidden=!active;$('roam-height-controls').hidden=!active||!flying;
  if(document.body.dataset.roaming!==String(active))document.body.dataset.roaming=String(active);
  setPressed('roam-mode-run',!flying);setPressed('roam-mode-fly',flying);
  $('roam-flight-fast').hidden=!active||!flying;setPressed('roam-flight-fast',Boolean(current?.fastFlight));
  setText($('roam-status'),t(flying?'roamFlyStatus':'roamRunStatus'));
  setText($('view-label'),t(active?(flying?'roamFlyStatus':'roamRunStatus'):(state.top?'topLabel':'perspective')));
  for(const element of document.querySelectorAll('.mouse-help'))setText(element,t(active?'roamDesktopHelp':'controls'));
  for(const element of document.querySelectorAll('.touch-help'))setText(element,t(active?'roamTouchHelp':'touchControls'));
}
async function beginRoam() {
  if(!state.sceneReady||roamBusy)return false;
  if(roam?.getState().active)return true;
  const generation=++roamGeneration;roamBusy=true;renderRoamUi();
  try {
    if(!roam){
      const data=await readJson(`${DATA_ROOT}navigation.json?v=${VERSION}`);
      if(generation!==roamGeneration)return false;
      const navigation=createNavigation(data);
      roam=createRoamController({scene,camera,canvas:$('scene-canvas'),controls,navigation,collisionMeshes:model.children,requestRender,onChange:renderRoamUi,onError:reason=>{if(reason!=='no-ground')toast(t('roamLoadFailed'));}});
    }
    if(generation!==roamGeneration)return false;
    const preferred=validPosition(state.selected?.position)?state.selected.position:manifest?.camera?.target;
    closeDetail();setFiltersOpen(false);lastFrameTime=0;
    const result=roam.enter({mode:'run',position:preferred});
    if(result?.ok===false){toast(t('roamNoSpawn'));return false;}
    requestRender();return true;
  }catch(error){console.warn('[map-3d] roaming unavailable',error);toast(t('roamLoadFailed'));return false;}
  finally{if(generation===roamGeneration){roamBusy=false;renderRoamUi();}}
}
function stopRoam() {
  roamGeneration++;roamBusy=false;
  if(roam?.getState().active)roam.exit();
  resetRoamTouch();
  lastFrameTime=0;renderRoamUi();
}
function resetRoamTouch() {
  for(const element of document.querySelectorAll('[data-roam-input]')){
    const captured=[...(element.roamPointers||[])];element.roamPointers?.clear();
    for(const id of captured)try{if(element.hasPointerCapture(id))element.releasePointerCapture(id);}catch{/* The browser may have already released capture. */}
    roam?.setInput(element.dataset.roamInput,false);if(element.getAttribute('aria-pressed')==='true')element.setAttribute('aria-pressed','false');
  }
}
function setRoamMode(mode) {
  if(!roam?.getState().active)return false;
  const result=roam.setMode(mode);if(result?.ok===false)toast(t(result.reason==='no-ground'?'roamNoGround':'roamLoadFailed'));else{roam.clearInput();resetRoamTouch();}renderRoamUi();requestRender();return result;
}
window.addEventListener('blur',resetRoamTouch);
document.addEventListener('visibilitychange',()=>{if(document.hidden)resetRoamTouch();});
$('roam-toggle').addEventListener('click',()=>{if(roam?.getState().active)stopRoam();else beginRoam();});
$('roam-mode-run').addEventListener('click',()=>setRoamMode('run'));
$('roam-mode-fly').addEventListener('click',()=>setRoamMode('fly'));
$('roam-exit').addEventListener('click',stopRoam);
$('roam-flight-fast').addEventListener('click',()=>{if(roam?.getState().mode==='fly')roam.setInput('fast',!roam.getState().fastFlight);});
$('roam-flight-fast').addEventListener('keydown',event=>{if(event.code==='Space'||event.code==='Enter'){event.preventDefault();if(!event.repeat)event.currentTarget.click();}});
$('roam-flight-fast').addEventListener('keyup',event=>{if(event.code==='Space'||event.code==='Enter')event.preventDefault();});
for(const button of document.querySelectorAll('[data-roam-input]')) {
  const pointers=new Set();button.roamPointers=pointers;
  const release=event=>{pointers.delete(event.pointerId);roam?.setInput(button.dataset.roamInput,pointers.size>0);button.setAttribute('aria-pressed',String(pointers.size>0));};
  button.addEventListener('pointerdown',event=>{if(!roam?.getState().active)return;event.preventDefault();pointers.add(event.pointerId);button.setPointerCapture(event.pointerId);roam.setInput(button.dataset.roamInput,true);button.setAttribute('aria-pressed','true');});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,release);
  button.addEventListener('keydown',event=>{if(event.code==='Space'||event.code==='Enter'){event.preventDefault();roam?.setInput(button.dataset.roamInput,true);button.setAttribute('aria-pressed','true');}});
  button.addEventListener('keyup',event=>{if(event.code==='Space'||event.code==='Enter'){event.preventDefault();roam?.setInput(button.dataset.roamInput,false);button.setAttribute('aria-pressed','false');}});
  button.addEventListener('blur',()=>{pointers.clear();roam?.setInput(button.dataset.roamInput,false);button.setAttribute('aria-pressed','false');});
}


$('point-search').addEventListener('input',()=>{state.query=$('point-search').value.trim();if(state.data)updateFiltered(false);});
$('floor-filter').addEventListener('change',()=>{state.floor=$('floor-filter').value;updateFiltered();});
$('types-all').addEventListener('click',()=>{if(!state.data)return;state.types=new Set(state.data.types.map(type=>type.id));buildFilters();updateFiltered();});
$('types-none').addEventListener('click',()=>{if(!state.data)return;state.types.clear();buildFilters();updateFiltered();});
for(const id of ['reset-filters','empty-reset'])$(id).addEventListener('click',()=>{if(state.data)resetFilters();});
$('toggle-labels').addEventListener('click',()=>{state.labels=!state.labels;$('toggle-labels').setAttribute('aria-pressed',String(state.labels));$('marker-layer').classList.toggle('show-labels',state.labels);saveFilters();});
$('quality-toggle').addEventListener('click',()=>{state.quality=state.quality==='clear'?'fast':'clear';updateQuality();saveFilters();});
$('reset-view').addEventListener('click',overview);$('top-view').addEventListener('click',topView);$('zoom-in').addEventListener('click',()=>zoom(.78));$('zoom-out').addEventListener('click',()=>zoom(1.28));
$('close-detail').addEventListener('click',closeDetail);$('open-filters').addEventListener('click',()=>setFiltersOpen(true));for(const id of ['close-filters','sidebar-shade'])$(id).addEventListener('click',()=>setFiltersOpen(false));
$('retry-load').addEventListener('click',()=>location.reload());
$('language-toggle').addEventListener('click',async()=>{const next=state.language==='en'?'zh-CN':'en';if(window.DUKE_I18N){const success=await window.DUKE_I18N.setLanguage(next);if(!success)return;}state.language=next;try{localStorage.setItem(LANGUAGE_KEY,state.language);}catch{/* This tab can still switch languages. */}applyLanguage();});
window.addEventListener('storage',event=>{if(event.key===LANGUAGE_KEY){state.language=event.newValue==='en'?'en':'zh-CN';applyLanguage();}});
window.addEventListener('keydown',event=>{if(event.key==='Escape'){stopRoam();closeDetail();setFiltersOpen(false);}});
const mapApi={getState:()=>({mapId:MAP.id,placedCount:state.points.filter(p=>validPosition(p.position)).length,unplacedCount:state.points.filter(p=>!validPosition(p.position)).length,ready:state.ready,loadingStage:state.loading.kind,quality:state.quality,pixelRatio:renderer?.getPixelRatio()||0,totalPoints:state.points.length,filteredCount:state.filtered.length,renderedMarkerCount:state.onScreen,selectedId:state.selected?.id||null,typeCounts:Object.fromEntries((state.data?.types||[]).map(type=>[type.id,{total:state.points.filter(p=>p.type===type.id).length,shown:state.filtered.filter(p=>p.type===type.id).length}])),enabledTypes:[...state.types],statusFilters:[...state.statuses],enabledLayers:[...state.layers],roam:roam?.getState()||{active:false,mode:'run'},model:{meshes:model?.children.length||0,triangles:renderer?.info.render.triangles||0,drawCalls:renderer?.info.render.calls||0,textureCount:state.modelStats?.textures||0},cameraPosition:camera?.position.toArray(),target:controls?.target.toArray(),errors:[...(state.error?[state.error]:[]),...state.textureFailures]}),enterRoam:beginRoam,exitRoam:stopRoam,setRoamMode,getPoint:id=>state.points.find(p=>p.id===id),focusPoint:id=>{const p=state.points.find(p=>p.id===id);if(p)selectPoint(p,true);},setView:view=>{if(view==='top')topView();else if(['close','beach'].includes(view)&&validPosition(manifest?.camera?.position)&&validPosition(manifest?.camera?.target)){closeView();}else overview();}};
window.dukeMap3D=mapApi;window[MAP.apiName]=mapApi;
$('map-selector').value=MAP.id;$('map-selector').addEventListener('change',()=>{const next=$('map-selector').value;if(MAPS[next]&&next!==MAP.id)location.href=`./${next}-3d.html?v=20261107-refresh-launch-1`;});
start();

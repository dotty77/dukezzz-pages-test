/* User-provided maps are retained unchanged; all interaction is a separate data layer. */
const $ = id => document.getElementById(id);
const TYPES = {
 spawn:['出生点位','生','#b9f17a'],exit:['撤离点位','撤','#8cf0bb'],
 electronic:['电子保险箱','电','#b9a1f0'], mechanical:['机械保险箱','机','#efab73'], gear:['武备箱','装','#eaf2e5'], medical:['医疗站','医','#f17b85'],
 briefcase:['公文包','包','#cba166'],trash:['垃圾桶','桶','#78a6ed'],enemy:['敌人点位','敌','#f26674'],phantom:['幻影巡逻','幻','#58b6f0'],keyroom:['门禁房','卡','#e3d66b'],portal:['传送门','传','#62d6cf'],custom:['个人标记','点','#b4c6ce'],ore_boss:['赭石碎片敌人 · 候选','赭','#dca252'],gem_enemy:['单质奖励敌人','晶','#b796f5'],trial_table:['古怪战术台','台','#a89bf2'],spooky_box:['古怪卜卜箱','箱','#e9ae6a'],withdraw_beacon:['弃考信标','旗','#64c9c4']
};
const CLIENT33_TYPES={gem_enemy:['单质奖励敌人','Mimic Substance enemies'],trial_table:['古怪战术台','Spookies Tactics Tables'],spooky_box:['古怪卜卜箱','Spookies Carrot Containers'],withdraw_beacon:['弃考信标','Abandoned Exam Beacons']};
const isClient33=p=>p?.sourceLayer==='client33';
const STATUS = {fixed_source:'原图固定',random_source:'随机',conditional:'条件点',unknown:'待核验'};
const DEFAULT_TYPES=['electronic','mechanical','gear','medical','spawn','exit','enemy','phantom','keyroom'];
const LAYERS={overview:DEFAULT_TYPES,containers:['electronic','mechanical','gear','briefcase','trash','medical','spawn','exit'],enemies:['enemy','phantom','spawn','exit'],rooms:['keyroom','portal','spawn','exit']};
const DEFAULT_STATUSES=['fixed_source','conditional'];
const MAPS = {
 janus:{name:'雅努斯幻境',base:7,source:[1,3,5,7],bounds:[.2,.02,.99,.99],regions:[['construction','白鸽工地',.51,.35,.34],['street','六昏街',.78,.22,.4],['lumina','光映中心',.44,.80,.4]],spawns:['六昏街出生区域','白鸽工地出生区域'],routes:[['从六昏街开始',['street','construction','lumina']],['从工地开始',['construction','street','lumina']]]},
 suburbs:{name:'城郊幻境',base:8,source:[2,4,6,8],bounds:[.05,.08,.94,.98],regions:[['highway','风蚀公路',.28,.47,.4],['town','野人镇',.72,.31,.37],['warehouse','巴哈姆特仓库',.81,.75,.33],['beach','绮梦沙滩',.45,.76,.4]],spawns:['风蚀公路出生区域','餐厅出生区域','野人镇出生区域','仓库区出生区域'],routes:[['区域搜索顺序',['highway','town','warehouse','beach']],['沙滩内优先检查',['beach']]]}
};
const SOURCE_LABELS = {1:'雅努斯 · 容器 / 医疗 / 传送',2:'城郊 · 容器 / 医疗 / 传送',3:'雅努斯 · 公文包 / 垃圾桶 / 敌人',4:'城郊 · 公文包 / 垃圾桶 / 敌人',5:'雅努斯 · 门禁房',6:'城郊 · 门禁房',7:'雅努斯 · 底图',8:'城郊 · 底图'};
const STORAGE_KEY='bagel-atlas-local-v1';
let personal;try{personal=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}catch{personal={}}
personal.custom ||= [];personal.notes ||= {};personal.observations ||= {};personal.routes ||= {janus:[],suburbs:[]};
const state={map:'janus',data:{},sourceLocations:{},oreSource:{},communityBoss:{},kelzeroSource:{},authorSources:[],images:{},types:new Set(DEFAULT_TYPES),statuses:new Set(DEFAULT_STATUSES),floor:'all',query:'',selected:null,labels:false,mode:'2d',source2d:'source',zoom:1,tx:0,ty:0,baseScale:1,w:0,h:0,hit:[],routeHits:[],hover:null,routeVisible:false,sourceRouteFit:false,adding:false,pending:null};
const canvas=$('map-canvas'),ctx=window.DUKE_I18N.canvasContext(canvas.getContext('2d'));
state.rotation=0;
state.enemySource='configured';
state.candidateData={maps:{}};state.candidatesEnabled=false;state.candidateTypes=new Set(Object.keys(CLIENT33_TYPES));
function rotateVector(x,y,a=state.rotation){return {x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a)}}
function setRotation(a){const delta=a-state.rotation,q=rotateVector(state.tx,state.ty,delta);state.rotation=a;state.tx=q.x;state.ty=q.y;state.sourceRouteFit=false;draw();window.mapTools?.sync()}

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(personal));return true}catch{toast('本机存储不可用，请导出数据保存。');return false}}
function toast(s){$('toast').textContent=s;$('toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('show'),3300)}
function allPoints(){return [...(state.data[state.map]?.points||[]),...(state.sourceLocations[state.map]?.points||[]),...(state.oreSource[state.map]||[]),...(state.communityBoss[state.map]||[]),...(state.kelzeroSource[state.map]||[]),...(state.candidateData.maps[state.map]?.points||[]),...personal.custom.filter(p=>p.map===state.map&&p.coordinateSpace!=='source-world')]}
// Rendering groups never replace source IDs, world positions or route target kinds.
const filterType=p=>p.type==='enemy'&&p.enemyClass==='phantom'?'phantom':p.type==='ore_boss'?'enemy':p.type;
const isEnemy=p=>p.type==='enemy'||p.type==='ore_boss';
const enemyPool=p=>p.sourceKind==='kelzero'?'kelzero':p.sourceKind==='community_boss'?'community':p.type==='ore_boss'?'configured':'source';
function matchesEnemySource(p){return p.personal||!isEnemy(p)||enemyPool(p)===state.enemySource;}
function sourceDisplayPoints(){return allPoints().filter(p=>matchesEnemySource(p)&&(!isClient33(p)||state.candidatesEnabled));}
function availableTypes(){return [...new Set(sourceDisplayPoints().filter(p=>!isClient33(p)).map(filterType))].filter(type=>TYPES[type]);}
function syncTypeToggle(){const types=availableTypes(),all=types.length>0&&types.every(type=>state.types.has(type));$('types-all').textContent=all?'取消全选':'全选';$('types-all').setAttribute('aria-pressed',String(all));}
async function loadSourceLocations(map) {
  const response = await fetch('research/' + map + '-source-locations.json');
  if (!response.ok) throw Error(MAPS[map].name + ' 出生 / 撤离图层读取失败');
  const layer = await response.json();
  if (layer.map !== map || !Array.isArray(layer.points)) throw Error('资料图点位格式不正确');
  for (const p of layer.points) {
    if (!['spawn','exit'].includes(p.type) || !Number.isFinite(p.x) || !Number.isFinite(p.y) ||
        p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) throw Error('资料图位置无效：' + p.id);
  }
  state.sourceLocations[map] = {...layer, points:layer.points.map(p => ({
    ...p, map, label:(p.type === 'spawn' ? '出生位置 ' : p.label.replace('撤离锚点·','') + ' · 撤 ') + p.id.split('-').at(-1),
    sourceLocation:true, sourceImage:null, floors:p.floors || [],
    note:p.note || '固定配置位置经地标配准标在资料图上；本局是否选中或开放仍由对局决定。'
  }))};
}
async function loadSourceOre(map) {
  const module = await import('./ore-monsters.js?v=20260919-site-refresh-1');
  state.oreSource[map] = await module.loadSourceOreMonsters(map);
}
let communityBossModule;
async function loadCommunityBoss(){
 communityBossModule=await import('./community-boss-points.js?v=20260919-site-refresh-1');
 state.communityBoss=await communityBossModule.loadCommunityBossPoints();
}
async function loadAuthorUpdate(){
 const [manifest,layer]=await Promise.all(['research/kelzero-20261011.json?v=20261111-refresh-launch-1','research/kelzero-enemies-20261011.json?v=20261021-map-launch-1'].map(async path=>{const r=await fetch(path);if(!r.ok)throw Error('新版作者地图读取失败');return r.json()}));
 state.authorSources=manifest.images;
 for(const map of ['janus','suburbs']){
  const points=layer.maps[map].points;
  if(points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>1||p.y<0||p.y>1))throw Error('新版敌人标注位置无效');
  state.kelzeroSource[map]=points;
 }
}
async function loadClient33Candidates(){
 const r=await fetch('research/map-candidates-3.3.json?v=20261111-refresh-launch-1');if(!r.ok)throw Error('配置候选暂未加载，请刷新重试');
 const layer=await r.json(),ids=new Set();
 for(const map of ['janus','suburbs']){
  if(!Array.isArray(layer.maps?.[map]?.points))throw Error('配置候选格式无效');
  for(const p of layer.maps[map].points){
   if(!p.id||ids.has(p.id)||p.map!==map||!CLIENT33_TYPES[p.type]||!isClient33(p)||p.configurationOnly!==true||p.routeEligible!==false||!Array.isArray(p.floors)||!STATUS[p.status]||![p.x,p.y].every(n=>Number.isFinite(n)&&n>=0&&n<=1))throw Error('配置候选格式无效');ids.add(p.id);
  }
 }
 state.candidateData=layer;
}
function client33Details(p){
 const evidence=p.evidence||{},world=p.worldPosition||{},radius=p.approximationRadiusPixels;
 return `<section class="client33-detail-note"><b data-i18n-en="Configuration candidate">配置候选</b><p data-i18n-en="Reference position; spawns are unverified. Excluded from navigation.">位置仅供参考，刷新未实测；不参与导航。</p></section><details class="atlas-detail-more"><summary data-i18n-en="Marker details & evidence">点位说明与依据</summary><p class="detail-note" ${p.noteEn?`data-i18n-en="${esc(p.noteEn)}"`:""}>${esc(p.note||'')}</p><dl class="detail-meta"><dt data-i18n-en="World X / Y / Z">世界 X / Y / Z</dt><dd>${['x','y','z'].map(k=>Number(world[k]).toFixed(2)).join(' / ')}</dd><dt data-i18n-en="Configuration group">配置组</dt><dd>${esc(evidence.groupId)}</dd><dt data-i18n-en="Position tolerance reference">位置容差参考</dt><dd data-i18n-en="${esc(radius)} source-image pixels (not a guaranteed bound)">原图 ${esc(radius)} 像素（非误差上限）</dd></dl><p class="small muted" data-i18n-en="The world height and client map ID do not establish a building floor. This candidate is excluded from route planning.">世界高度与客户端地图编号不能直接确定楼层，此候选暂不参与路线规划。</p><a href="research/map-candidates-3.3.json?v=20261111-refresh-launch-1" target="_blank" rel="noreferrer" data-i18n-en="View candidate evidence ↗">查看候选点证据 ↗</a></details>`;
}
function sourceLocationDetails(p){
 if(isClient33(p))return client33Details(p);
 if(p.sourceKind==='kelzero')return `<section class="author-enemy-note"><b>KELZERO · ${esc(p.sourceDate || '2026-09-23')}</b><p data-i18n-en="Enemy markers do not guarantee spawns or shard drops.">敌人标记不保证刷新或掉落碎片。</p>${p.cacophonyDisappears?'<p data-i18n-en="The author marks these as likely to disappear in Cacophony Zones; some may be replaced by Ulidim Phantoms.">作者标注：喧响区内很可能消失，部分位置可能被 Ulidim Phantom 替换。</p>':''}${p.cacophonyOnly?'<p data-i18n-en="Conditional patrol reference: Cacophony Zones only; no verified navigation endpoint.">喧响区条件巡逻参考，尚无已验证的导航端点。</p>':''}${p.gradeChange?`<p>${p.gradeChange==='upgrade'?'可能升级为首领':'可能降为精英'}</p>`:''}</section>`;
 if(p.sourceKind==='community_boss')return communityBossModule?.communityBossDetails(p)||'';
 if(p.type==='enemy')return '<p class="small muted" data-i18n-en="Author marker; its game configuration and shard drops remain unverified.">作者标记；对应配置及碎片掉落仍待核验。</p>';
 if(p.type==='ore_boss')return window.oreMonsters?.details(p,{source:true})||'';
 if(!p.sourceLocation)return '';
 return `<p class="small muted" data-i18n-en="Registered reference position; spawns and exits depend on the current run.">配准位置仅供参考，出生与撤离以本局条件为准。</p><dl class="detail-meta"><dt>世界 X / Y / Z</dt><dd>${['x','y','z'].map(k=>p.worldPosition[k].toFixed(2)).join(' / ')}</dd></dl><details class="route-evidence"><summary>位置配准依据</summary><pre class="candidate-evidence">${esc(JSON.stringify(p.registrationEvidence||state.sourceLocations[state.map].registration||{},null,2))}</pre><a href="research/${state.map}-source-registration.json" target="_blank" rel="noreferrer">查看地标与误差记录 ↗</a></details>`;
}
function regionName(id){if(id==='unknown')return '区域待核验';if(id==='patrol-reference')return '作者巡逻参考';if(id==='ore-config')return '奖励候选位置';return MAPS[state.map].regions.find(r=>r[0]===id)?.[1]||'个人位置'}
function floorName(p){return p.floors?.length?p.floors.map(f=>f===-1?'B1':f+'F').join(' / '):isClient33(p)?'楼层待核验':'原图未注明'}
function matchesQuery(p){return !state.query||window.DUKE_I18N.matches([p.id,p.label,p.labelEn,p.note,p.noteEn,CLIENT33_TYPES[p.type]?.[1],regionName(p.region),TYPES[p.type]?.[0],TYPES[filterType(p)]?.[0],p.enemyClass==='phantom'?'Phantom patrols':'',personal.notes[p.id]],state.query)}
function matchesSourceFilters(p){return (!isClient33(p)||state.candidatesEnabled)&&matchesEnemySource(p)&&state.statuses.has(p.status)&&(state.floor==='all'||state.floor==='unknown'&&!p.floors?.length||p.floors?.includes(Number(state.floor)))&&matchesQuery(p)}
function visible(){return allPoints().filter(p=>p.personal ? window.mapTools?.showPersonal!==false : !window.mapTools?.clean&&(isClient33(p)?state.candidateTypes.has(p.type):state.types.has(filterType(p)))&&matchesSourceFilters(p))}
const sourceCountNote=document.createElement('div');sourceCountNote.id='source-count-note';sourceCountNote.className='callout';
sourceCountNote.innerHTML='<span data-i18n-en="Shown / total">显示 / 总数</span>';sourceCountNote.title='数量随刷新分类、楼层和搜索变化';
$('type-filters').before(sourceCountNote);
const enemySourceControls=document.createElement('section');enemySourceControls.id='enemy-source-controls';enemySourceControls.className='callout';
enemySourceControls.innerHTML='<b data-i18n-en="Enemy marker sources">敌人资料来源</b><div class="chips" role="group" aria-label="Enemy marker sources"><button type="button" data-enemy-source="kelzero"><span data-i18n-en="KELZERO markers">作者图标记</span> <small data-enemy-count="kelzero"></small></button><button type="button" data-enemy-source="community"><span data-i18n-en="Player boss map">玩家首领图</span> <small data-enemy-count="community"></small></button><button type="button" data-enemy-source="configured"><span data-i18n-en="Game configuration">游戏配置</span> <small data-enemy-count="configured"></small></button><button type="button" data-enemy-source="source"><span data-i18n-en="Original markers">原图标注</span> <small data-enemy-count="source"></small></button></div><p id="enemy-source-summary" class="small" hidden></p><p class="small muted" data-i18n-en="One source is shown at a time. Counts do not guarantee spawns in the current run.">每次显示一种来源；数量不表示本局必刷。</p>';
$('type-filters').after(enemySourceControls);
function enemySourceCounts(){return {kelzero:state.kelzeroSource[state.map]?.length||0,configured:state.oreSource[state.map]?.length||0,source:(state.data[state.map]?.points||[]).filter(p=>p.type==='enemy').length,community:state.communityBoss[state.map]?.length||0};}
function defaultEnemySource(){
 const counts=enemySourceCounts();return counts.kelzero?'kelzero':counts.community?'community':counts.configured?'configured':counts.source?'source':'configured';
}
function renderEnemySourceControls(){
 const counts=enemySourceCounts();enemySourceControls.hidden=!Object.values(counts).some(Boolean);
 enemySourceControls.querySelectorAll('[data-enemy-source]').forEach(button=>{const key=button.dataset.enemySource,active=key===state.enemySource;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));button.disabled=!counts[key];button.querySelector('small').textContent=String(counts[key]);});
 let legend=enemySourceControls.querySelector('.atlas-enemy-legend');if(!legend){legend=document.createElement('div');legend.className='atlas-enemy-legend';legend.innerHTML='<span data-i18n-en="Bosses / elites / mimics / phantoms">首领 / 精英 / 拟态 / 幻影</span><span><i></i><span data-i18n-en="May disappear in Cacophony">喧响区可能消失</span></span>';enemySourceControls.append(legend)}legend.hidden=state.enemySource!=='kelzero';
}
function setEnemySource(source){
 if(!['kelzero','community','configured','source'].includes(source)||!enemySourceCounts()[source])return;
 state.enemySourceTouched=true;state.enemySource=source;state.types.add('enemy');if(source==='kelzero')state.types.add('phantom');
 const selected=allPoints().find(p=>p.id===state.selected);if(selected&&!matchesEnemySource(selected))overview();
 renderFilters();draw();
}
enemySourceControls.addEventListener('click',event=>{const button=event.target.closest('[data-enemy-source]');if(button)setEnemySource(button.dataset.enemySource);});
const client33Controls=document.createElement('section');client33Controls.id='client33-controls';
client33Controls.innerHTML=`<div class="client33-heading"><b data-i18n-en="3.3 candidates">3.3 配置候选</b><span data-i18n-en="Shown / total">显示 / 总数</span></div><label class="client33-master"><input type="checkbox" id="client33-toggle"><span data-i18n-en="Show candidate layer">显示候选点图层</span></label><div id="client33-types">${Object.entries(CLIENT33_TYPES).map(([key,label])=>`<label class="client33-type"><input type="checkbox" value="${key}" checked><span class="atlas-type-symbol">${window.DUKEMapSymbols.svg(key)}</span><span data-i18n-en="${label[1]}">${label[0]}</span><span class="n" data-candidate-count="${key}"></span></label>`).join('')}</div><p class="small muted" id="client33-hint" data-i18n-en="Estimated positions; check individual floor references. Activation remains unverified.">位置近似配准；楼层按点位依据标注，启用条件待核实。</p><p id="client33-error" class="small" hidden data-i18n-en="Candidates could not load. Refresh to retry.">配置候选暂未加载，请刷新重试。</p>`;
$('spawn-filter-panel').after(client33Controls);
function renderCandidateControls(){
 const failed=!!state.candidateLayerError,points=state.candidateData.maps[state.map]?.points||[],shown=visible().filter(isClient33);
 $('client33-toggle').checked=state.candidatesEnabled;$('client33-toggle').disabled=failed||!points.length;
 $('client33-error').hidden=!failed;$('client33-hint').hidden=failed;
 client33Controls.classList.toggle('enabled',state.candidatesEnabled);
 for(const input of $('client33-types').querySelectorAll('input')){input.checked=state.candidateTypes.has(input.value);input.disabled=failed||!state.candidatesEnabled;}
 for(const el of client33Controls.querySelectorAll('[data-candidate-count]')){const key=el.dataset.candidateCount,value=`${shown.filter(p=>p.type===key).length} / ${points.filter(p=>p.type===key).length}`;if(el.textContent!==value)el.textContent=value;}
 const credit=state.candidatesEnabled?'底图 © 游戏权利方 · 作者标点 @KELZERO · 配置候选 3.3':'底图 © 游戏权利方 · 标点 @KELZERO';
 if($('map-credit-note')?.textContent!==window.DUKE_I18N.t(credit))$('map-credit-note').textContent=window.DUKE_I18N.t(credit);
}
function applyCandidateSelection(){
 const selected=allPoints().find(p=>p.id===state.selected);
 if(isClient33(selected)&&(!state.candidatesEnabled||!state.candidateTypes.has(selected.type)))overview();
 renderFilters();draw();
}
$('client33-toggle').onchange=e=>{state.candidatesEnabled=e.target.checked;applyCandidateSelection();};
$('client33-types').onchange=e=>{if(!CLIENT33_TYPES[e.target.value])return;e.target.checked?state.candidateTypes.add(e.target.value):state.candidateTypes.delete(e.target.value);applyCandidateSelection();};
function syncSourceCounts(){
 renderCandidateControls();
 const points=sourceDisplayPoints(),shown=visible();
 for(const el of $('type-filters').querySelectorAll('[data-count-type]')){
  const type=el.dataset.countType,total=points.filter(p=>filterType(p)===type).length,count=shown.filter(p=>filterType(p)===type).length,value=`${count} / ${total}`;
  if(el.textContent!==value)el.textContent=value;
  el.title=`当前筛选可显示 ${count} 个；资料图共 ${total} 个标注。`;
 }
}
function renderSearchResults(){
 const panel=$('search-results');panel.hidden=!state.query;$('search-clear').hidden=!$('search').value;
 if(!state.query)return;const results=visible();
 const signature=JSON.stringify([state.map,state.query,state.selected,results.map(p=>[p.id,p.label,p.type,p.region,p.floors,p.note,personal.notes[p.id]])]);
 if(signature===renderSearchResults.signature)return;renderSearchResults.signature=signature;
 $('search-summary').textContent=results.length?`找到 ${results.length} 个点位 · 点击定位`:'没有匹配点位，请调整类型、楼层或关键词。';
 $('search-results-list').innerHTML=results.map(p=>`<button class="search-result ${p.id===state.selected?'active':''}" data-point="${esc(p.id)}"><span ${p.personal?'data-i18n-skip':p.labelEn?`data-i18n-en="${esc(p.labelEn)}"`:''}>${esc(p.label)}</span><small class="search-result-meta">${esc(p.id)} · ${esc(regionName(p.region))} · ${esc(floorName(p))}</small></button>`).join('')
}
function routePoints(){return (personal.routes[state.map]||[]).map(id=>allPoints().find(p=>p.id===id)).filter(p=>p&&!isClient33(p))}
function resize(){if(!state.images[MAPS[state.map].base])return;const r=$('map-stage').getBoundingClientRect();if(r.width&&r.height){const previousScale=state.baseScale;state.w=r.width;state.h=r.height;const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);state.baseScale=Math.min(state.w/state.images[MAPS[state.map].base].width,state.h/state.images[MAPS[state.map].base].height)*.98;if(previousScale>0){state.tx*=state.baseScale/previousScale;state.ty*=state.baseScale/previousScale;}if(state.sourceRouteFit&&window.sourceRoute2D?.getState().route)window.sourceRoute2D.fit();else draw()}}
function project(p){const img=state.images[MAPS[state.map].base],s=state.baseScale*state.zoom,q=rotateVector((p.x-.5)*img.width*s,(p.y-.5)*img.height*s);return {x:state.w/2+state.tx+q.x,y:state.h/2+state.ty+q.y}}
function baseReady(){return !!state.images[MAPS[state.map].base]}
function unproject(x,y){const img=state.images[MAPS[state.map].base],s=state.baseScale*state.zoom,q=rotateVector(x-state.w/2-state.tx,y-state.h/2-state.ty,-state.rotation);return {x:q.x/(img.width*s)+.5,y:q.y/(img.height*s)+.5}}
function resetView(){if(!baseReady())return;state.sourceRouteFit=false;const img=state.images[MAPS[state.map].base],c=Math.abs(Math.cos(state.rotation)),s=Math.abs(Math.sin(state.rotation));state.zoom=Math.min(state.w/(img.width*c+img.height*s),state.h/(img.width*s+img.height*c))*.98/state.baseScale;state.tx=0;state.ty=0;draw()}
function focusPoint(p,z=2.6){state.sourceRouteFit=false;state.zoom=z;state.tx=0;state.ty=0;const q=project(p);state.tx=state.w/2-q.x;state.ty=state.h/2-q.y;draw()}
function zoomAt(factor,x=state.w/2,y=state.h/2){if(!baseReady())return;state.sourceRouteFit=false;const before=unproject(x,y);state.zoom=Math.max(.55,Math.min(12,state.zoom*factor));const after=project(before);state.tx+=x-after.x;state.ty+=y-after.y;draw()}
function fitPoints(points){
 if(state.source2d!=='source'||!state.w||!state.h)return;
 const ps=points.filter(p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y));if(!ps.length)return;
 const img=state.images[MAPS[state.map].base];if(!img)return;
 const rotated=ps.map(p=>rotateVector((p.x-.5)*img.width,(p.y-.5)*img.height));
 const xs=rotated.map(p=>p.x),ys=rotated.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const scale=Math.min(Math.max(50,state.w-100)/Math.max(35,maxX-minX),Math.max(50,state.h-120)/Math.max(35,maxY-minY));
 state.zoom=Math.max(.55,Math.min(12,scale/state.baseScale));state.tx=-(minX+maxX)/2*state.baseScale*state.zoom;state.ty=-(minY+maxY)/2*state.baseScale*state.zoom;state.sourceRouteFit=true;draw();
}
function showSide(side){
 if(!['points','routes','sources'].includes(side))return;
 document.querySelectorAll('[data-side]').forEach(b=>b.classList.toggle('active',b.dataset.side===side));
 for(const id of ['points','routes','sources'])$('side-'+id).hidden=id!==side;
 if(side==='routes')$('side-routes').scrollIntoView({block:'nearest'});
}
function roundRect(x,y,w,h,r=4){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}
function markerPath(p,q,r){ctx.beginPath();if(p.type==='spawn'){ctx.moveTo(q.x,q.y-r-2);ctx.lineTo(q.x+r+2,q.y);ctx.lineTo(q.x,q.y+r+2);ctx.lineTo(q.x-r-2,q.y);ctx.closePath()}else if(p.type==='exit')ctx.arc(q.x,q.y,r+1,0,Math.PI*2);else ctx.roundRect(q.x-r,q.y-r,2*r,2*r,4)}
function sourceNavigation(){const s=window.sourceRoute2D?.getState();return s?.map===state.map?s:null}
function drawNavigationPath(render){
 const {ctx,state,project}=render;
 state.routeSpecialLabels=[];
 const route=sourceNavigation()?.route;if(!['complete','conditional'].includes(route?.status)||route.coordinateSpace!=='source-image-normalized'||!route.points.length)return;
 const segments=route.status==='conditional'||route.overview&&Array.isArray(route.segments)?route.segments:[{kind:'walking',points:route.points}];let specialIndex=0;
 for(const segment of segments){
 const points=segment.points.map(project);ctx.save();ctx.lineJoin='round';ctx.lineCap='round';ctx.setLineDash([]);
 if(segment.kind==='special'){
  // This joins source link endpoints as a reference; it is not a traversable ground path.
  const [a,b]=points;ctx.strokeStyle='#ffc470';ctx.lineWidth=3;ctx.setLineDash([7,7]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);
  specialIndex++;state.routeSpecialLabels.push({label:segment.label||`特殊通路 ${specialIndex} · 待确认`,x:(a.x+b.x)/2,y:(a.y+b.y)/2});ctx.restore();continue;
 }
 for(const [color,width] of [['#092c32',8],['#65ffde',3.5]]){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke()}
 // Arrows express the route direction, using the original connected path only.
 let until=60;ctx.strokeStyle='#e4fff7';ctx.lineWidth=2;
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d<.001)continue;
  const ux=dx/d,uy=dy/d;
  while(until<d){const x=a.x+ux*until,y=a.y+uy*until;if(x>-10&&y>-10&&x<state.w+10&&y<state.h+10){ctx.beginPath();ctx.moveTo(x-ux*5-uy*4,y-uy*5+ux*4);ctx.lineTo(x,y);ctx.lineTo(x-ux*5+uy*4,y-uy*5-ux*4);ctx.stroke()}until+=90}
  until-=d;
 }
 ctx.restore();
 }
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
function drawNavigationPins(render){
 const {ctx,state,project}=render;
 state.routeHits=[];const s=sourceNavigation();if(!s)return;ctx.save();ctx.setLineDash([]);ctx.font='bold 11px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.lineWidth=2;
 const hasAssaultMarkers=Array.isArray(s.route?.assaultMarkers);
 if(!hasAssaultMarkers&&['complete','conditional'].includes(s.route?.status)&&s.route.coordinateSpace==='source-image-normalized'){
  const ps=s.route.points;
  for(const [p,label,color,source] of [[ps[0],'起','#d9f775',s.start],[ps.at(-1),'终','#ffb480',s.end]]){
   if(!p)continue;const q=project(p);ctx.fillStyle='#132a24';ctx.strokeStyle=color;ctx.beginPath();ctx.arc(q.x,q.y,16,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=color;ctx.fillText(label,q.x,q.y+4);
   if(source?.id)state.routeHits.push({id:source.id,q,r:18,label:`${label==='起'?'起点':'终点'}：${source.label}`,source:true});
  }
 }
 for(const marker of s.choiceMarkers||[]){
  if(!Number.isFinite(marker.x)||!Number.isFinite(marker.y))continue;const q=project(marker);if(q.x<-20||q.y<-20||q.x>state.w+20||q.y>state.h+20)continue;
  const label=marker.shortLabel||marker.label||'?';ctx.beginPath();ctx.arc(q.x,q.y,13,0,Math.PI*2);ctx.fillStyle='#333018';ctx.strokeStyle='#fff083';ctx.fill();ctx.stroke();ctx.fillStyle='#fff4a7';ctx.fillText(label.length>3?String.fromCharCode(65+(s.choiceMarkers||[]).indexOf(marker)):label,q.x,q.y+4);
  state.routeHits.push({id:marker.id,role:marker.role,q,r:16,label:`候选位置 ${label}`,source:false});
 }
 ctx.font='bold 11px "Microsoft YaHei",sans-serif';ctx.textAlign='center';
 for(const marker of state.routeSpecialLabels||[]){
  if(marker.x<0||marker.y<0||marker.x>state.w||marker.y>state.h)continue;
  const width=ctx.measureText(marker.label).width+12,x=Math.max(width/2+4,Math.min(state.w-width/2-4,marker.x)),y=Math.max(18,Math.min(state.h-9,marker.y-25));
  ctx.fillStyle='#282016';ctx.fillRect(x-width/2,y-14,width,21);ctx.fillStyle='#ffd596';ctx.fillText(marker.label,x,y+1);
 }
 if(hasAssaultMarkers&&['complete','conditional'].includes(s.route?.status)&&s.route.coordinateSpace==='source-image-normalized'){
  let targetNumber=0;const pins=[];
  // These are itinerary overlays, not members of the user's filtered point set.
  for(const marker of s.route.assaultMarkers){
   if(!marker||!['start','ore_boss','keyroom','exit','skipped'].includes(marker.kind)||!Number.isFinite(marker.x)||!Number.isFinite(marker.y))continue;
   const target=marker.kind==='ore_boss'||marker.kind==='keyroom';if(target)targetNumber++;
   const number=Number.isInteger(marker.number)&&marker.number>0?marker.number:targetNumber;
   const badge=marker.kind==='start'?'起':marker.kind==='exit'?'撤':marker.kind==='skipped'?'?':String(number);
   const color={start:'#d9f775',ore_boss:'#ffba73',keyroom:'#c8b6ff',exit:'#72edc0',skipped:'#a8b4c3'}[marker.kind],anchor=project(marker),r=marker.kind==='skipped'?13:16;
   if(anchor.x<-r||anchor.y<-r||anchor.x>state.w+r||anchor.y>state.h+r)continue;
   pins.push({marker,badge,color,anchor,r});
  }
  const placed=layoutAssaultPins(pins,state.w,state.h);
  // Only the badge moves on screen; a thin leader retains the real map anchor.
  for(const {anchor,q,color} of placed)if(Math.hypot(q.x-anchor.x,q.y-anchor.y)>1){ctx.save();ctx.globalAlpha=.75;ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=1;ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(anchor.x,anchor.y);ctx.lineTo(q.x,q.y);ctx.stroke();ctx.beginPath();ctx.arc(anchor.x,anchor.y,2.5,0,Math.PI*2);ctx.fill();ctx.restore();}
  for(const {marker,badge,color,anchor,q,r} of placed){
   ctx.save();ctx.globalAlpha=marker.kind==='skipped'?0.68:1;ctx.shadowColor='#000b';ctx.shadowBlur=5;ctx.fillStyle='#111d2bef';ctx.strokeStyle=color;ctx.lineWidth=2.5;ctx.setLineDash(marker.kind==='skipped'?[3,3]:[]);ctx.beginPath();ctx.arc(q.x,q.y,r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.setLineDash([]);ctx.fillStyle=color;ctx.font='bold 13px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(badge,q.x,q.y+.5);ctx.restore();
   const prefix=marker.kind==='start'?'起点':marker.kind==='exit'?'撤离位置':marker.kind==='skipped'?'未纳入路线':`目标 ${badge} · ${marker.kind==='ore_boss'?'碎片怪':'门禁房'}`;
   state.routeHits.push({id:marker.id,q,anchor,r:r+3,assault:true,label:`${prefix}：${marker.label||marker.id}${marker.reason?' · '+marker.reason:''}`});
  }
 }
 ctx.restore();
}
function renderMap(ctx,state,project,{exporting=false}={}){const img=state.images[MAPS[state.map].base],scale=state.baseScale*state.zoom;ctx.save();ctx.globalAlpha=.94;ctx.translate(state.w/2+state.tx,state.h/2+state.ty);ctx.rotate(state.rotation);ctx.drawImage(img,-img.width*scale/2,-img.height*scale/2,img.width*scale,img.height*scale);ctx.restore();
 if(state.routeVisible&&!window.mapTools?.clean){const route=routePoints();ctx.strokeStyle='#b9fd72';ctx.lineWidth=3;ctx.setLineDash([9,6]);ctx.beginPath();route.forEach((p,i)=>{const q=project(p);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)});ctx.stroke();ctx.setLineDash([]);route.forEach((p,i)=>{const q=project(p);ctx.beginPath();ctx.arc(q.x+12,q.y-13,10,0,Math.PI*2);ctx.fillStyle='#23301b';ctx.fill();ctx.fillStyle='#e7ffb9';ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.fillText(i+1,q.x+12,q.y-9)})}
 if(!window.mapTools?.clean)drawNavigationPath({ctx,state,project});
 const hasSketch=window.mapSketch?.draw(ctx,project,'source',{exporting});
 state.hit=[];const points=visible().sort((a,b)=>(a.id===state.selected?1:0)-(b.id===state.selected?1:0));
 window.DUKEMapSymbols.draw(ctx,points,{project,state,literal:window.DUKE_I18N.canvasLiteral});
 if(!window.mapTools?.clean)drawNavigationPins({ctx,state,project});else state.routeHits=[];
 return {points,hasSketch};
}
function draw(){syncSourceCounts();renderSearchResults();if(!state.images[MAPS[state.map].base])return;ctx.clearRect(0,0,state.w,state.h);const {points,hasSketch}=renderMap(ctx,state,project);
 $('visible-count').textContent=`显示 ${points.length} / ${sourceDisplayPoints().length} 个点位`;$('empty-message').hidden=!!window.mapTools?.clean||points.length>0||!!hasSketch||['complete','conditional'].includes(sourceNavigation()?.route?.status);
}
function renderFullMapImage(){
 const img=state.images[MAPS[state.map].base];if(!img)throw Error('地图尚未加载完成');
 // Fixed logical size makes symbols, labels and strokes independent of viewport,
 // zoom, pan and devicePixelRatio. The live canvas/state are never resized.
 const baseScale=1200/Math.max(img.width,img.height),rotation=state.rotation,cos=Math.cos(rotation),sin=Math.sin(rotation),margin=24,footer=66;
 const w=Math.ceil((img.width*Math.abs(cos)+img.height*Math.abs(sin))*baseScale)+margin*2;
 const h=Math.ceil((img.width*Math.abs(sin)+img.height*Math.abs(cos))*baseScale)+margin*2;
 const density=4096/Math.max(w,h+footer),out=document.createElement('canvas');
 out.width=Math.round(w*density);out.height=Math.round((h+footer)*density);
 const raw=out.getContext('2d');if(!raw)throw Error('无法创建高清图片');
 const context=window.DUKE_I18N.canvasContext(raw),dark=document.documentElement.dataset.theme==='dark';
 context.setTransform(density,0,0,density,0,0);context.fillStyle=dark?'#242734':'#f4f5fb';context.fillRect(0,0,w,h+footer);
 context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
 const renderState={...state,w,h,baseScale,zoom:1,tx:0,ty:0,selected:null,hover:null,hit:[],routeHits:[],routeSpecialLabels:[]};
 const projectPoint=p=>{const x=(p.x-.5)*img.width*baseScale,y=(p.y-.5)*img.height*baseScale;return {x:w/2+x*cos-y*sin,y:h/2+x*sin+y*cos}};
 context.save();context.beginPath();context.rect(0,0,w,h);context.clip();renderMap(context,renderState,projectPoint,{exporting:true});context.restore();
 const name=MAPS[state.map].name,en=window.DUKE_I18N.language==='en',englishName=state.map==='janus'?'Janus Illusion':'Suburbs Illusion';
 context.fillStyle=dark?'#1b1d2a':'#fff';context.fillRect(0,h,w,footer);
 context.strokeStyle=dark?'#41485d':'#d8ddec';context.lineWidth=1;context.beginPath();context.moveTo(0,h);context.lineTo(w,h);context.stroke();
 context.textAlign='left';context.textBaseline='alphabetic';context.fillStyle=dark?'#edf1ff':'#34416a';context.font='bold 17px "Segoe UI","Microsoft YaHei",sans-serif';
 context.fillText(en?`${englishName} · Full map · dukezzz.com`:`${name} · 高清全图 · dukezzz.com`,24,h+26);
 context.fillStyle=dark?'#b7c1dd':'#63718d';context.font='12px "Segoe UI","Microsoft YaHei",sans-serif';
 const candidatesShown=visible().some(isClient33);
 context.fillText(candidatesShown?(en?'Game imagery © owners · Author markers @KELZERO · 3.3 estimated candidates':'底图 © 游戏权利方 · 作者标点 @KELZERO · 3.3 配置候选（估计位置）'):(en?'Game imagery © respective owners · Map annotations @KELZERO · Current filters and drawings':'底图 © 游戏权利方 · 标点 @KELZERO · 保留当前筛选与手绘'),24,h+49);
 return {canvas:out,map:state.map,name,geometry:{w,h,footer,density,rotation,baseScale,imageWidth:img.width,imageHeight:img.height},markerCount:renderState.hit.length};
}
function renderFilters(){syncLayerButtons();const points=sourceDisplayPoints();$('type-filters').innerHTML=Object.entries(TYPES).filter(([k])=>k!=='ore_boss'&&!CLIENT33_TYPES[k]&&points.some(p=>filterType(p)===k)).map(([k,t])=>`<label class="type-row ${['enemy','phantom'].includes(k)?'enemy-filter-row':''}"><input type="checkbox" value="${k}" ${state.types.has(k)?'checked':''}><span class="type-symbol atlas-type-symbol">${window.DUKEMapSymbols.svg(k)}</span><span ${k==='enemy'?'data-i18n-en="Enemies"':k==='phantom'?'data-i18n-en="Phantom patrols"':''}>${t[0]}</span><span class="n" data-count-type="${k}"></span></label>`).join('');$('status-filters').innerHTML=Object.entries(STATUS).map(([k,v])=>`<button type="button" data-status="${k}" aria-pressed="${state.statuses.has(k)}" class="${state.statuses.has(k)?'active':''}"><span class="status-check" aria-hidden="true"></span><span>${v}</span></button>`).join('');$('count-summary').innerHTML=`<span data-i18n-en="${points.filter(p=>!isClient33(p)).length} map markers">${points.filter(p=>!isClient33(p)).length} 个资料图标记</span>`;$('regions').innerHTML=MAPS[state.map].regions.map(([id,name])=>`<button class="region-btn" data-region="${id}">${name}<span>↗</span></button>`).join('');renderLocationLinks();syncTypeToggle();syncSourceCounts();renderEnemySourceControls()}
let configuredLocationSummaries=null,locationCountsFailed=false;
function renderLocationLinks(){
 const summary=configuredLocationSummaries?.[state.map],pending=locationCountsFailed?'暂未读取':'读取中…';
 $('configured-spawn-count').textContent=summary?`出生配置位置 · ${summary.fixedSpawnCandidateCount} 处`:`出生配置位置 · ${pending}`;
 if(summary){const uncertain=Math.max(0,summary.evacuationLocationCandidateCount-summary.locationsWithHighRiskEvidence);$('configured-exit-count').textContent=uncertain?`撤离高危配置地点 · ${summary.locationsWithHighRiskEvidence} 处，另 ${uncertain} 处待核实`:`撤离配置地点 · ${summary.locationsWithHighRiskEvidence} 处`}else $('configured-exit-count').textContent=`撤离配置地点 · ${pending}`;
}
async function loadLocationCounts(){try{const response=await fetch('research/spawn-exit-locations.json?v=20260909-version-3-2-1');if(!response.ok)throw Error('配置位置读取失败');const data=await response.json();configuredLocationSummaries=Object.fromEntries(data.maps.map(map=>[map.map,map.summary]));renderLocationLinks()}catch(error){locationCountsFailed=true;renderLocationLinks();console.error(error)}}
async function showConfiguredLocations(kind){
 const button=$('show-configured-'+kind);button.disabled=true;
 try{
  {
   const map = state.map;
   await mapLayers(map).locations;
   if (map !== state.map) return;
   if (!state.sourceLocations[map]) throw Error('出生 / 撤离图层暂未加载，请刷新重试');
   const type=kind==='spawn'?'spawn':'exit',points=allPoints().filter(p=>p.type===type);
   state.types=new Set([type]);state.statuses=new Set(DEFAULT_STATUSES);state.query='';state.floor='all';state.selected=null;$('search').value='';$('floor').value='all';renderFilters();resetView();
   $('detail').innerHTML=`<div class="detail-panel-header"><p class="eyebrow">SOURCE MAP LOCATIONS</p><button id="close-detail" class="detail-close-button" type="button" aria-label="关闭位置列表" title="关闭，返回地图工具"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg><span>关闭</span></button></div><h2>${type==='spawn'?'出生点位':'撤离点位'}</h2><p class="small muted">已补充到资料图。点击下方位置可定位并查看依据；待核验点默认隐藏，点选可单独展开。</p><div class="nearby-list">${points.map(p=>`<button data-point="${esc(p.id)}">${esc(p.label)}${p.status==='unknown'?' · 待核验':''}</button>`).join('')}</div>`;
   document.body.classList.remove('detail-collapsed');$('mobile-detail').hidden=false;document.querySelector('.right-panel').scrollTop=0;
  }
  document.body.classList.remove('filters-open');
 }catch(error){toast(error.message||'位置加载失败，请重试')}finally{button.disabled=false}
}
function renderRoutes(){$('spawn-info').innerHTML=MAPS[state.map].spawns.map(n=>`<div class="spawn-item">${n}<small>攻略中的起跑区域；精确配置位置见左侧“出生 / 撤离位置”</small></div>`).join('');$('route-presets').innerHTML=MAPS[state.map].routes.map(([name,order])=>`<div class="route-preset callout"><b>${name}</b><small>${order.map(regionName).join(' → ')}</small></div>`).join('');$('route-list').innerHTML=routePoints().map(p=>`<li><button data-point="${p.id}" ${p.personal?'data-i18n-skip':''}>${esc(p.label)}</button></li>`).join('');$('route-toggle').classList.toggle('active',state.routeVisible);$('route-toggle').textContent=state.routeVisible?'隐藏访问连线':'显示访问连线'}
function renderSources(){
 const current=state.authorSources.filter(s=>s.map===state.map&&!s.archived);const archived=state.authorSources.filter(s=>s.map===state.map&&s.archived);
 $('source-links').innerHTML=current.map(s=>`<button class="source-button" data-source="${s.id}" ${s.titleEn?`data-i18n-en="${esc(s.titleEn)}"`:''}>${esc(s.title)} ↗</button>`).join('')+`<details class="atlas-filter-more"><summary data-i18n-en="Earlier source maps">早期资料图</summary>${archived.map(s=>`<button class="source-button" data-source="${s.id}" data-i18n-en="${esc(s.titleEn)} · ${esc(s.date)}">${esc(s.title)} · ${esc(s.date)} ↗</button>`).join('')}${MAPS[state.map].source.map(i=>`<button class="source-button" data-source="${i}">${esc(SOURCE_LABELS[i])} ↗</button>`).join('')}</details>`;
}
function showSource(i){const source=state.authorSources.find(s=>s.id===i);$('source-title').textContent=source?source.title+' · @KELZERO · '+source.date:'资料图 '+i+' · '+SOURCE_LABELS[i];if(source?.titleEn)$('source-title').setAttribute('data-i18n-en',source.titleEn+' · @KELZERO · '+source.date);else $('source-title').removeAttribute('data-i18n-en');$('source-image').src=source?source.path:`assets/source-${i}.png`;$('source-dialog').showModal()}

function overviewMetrics(){
 const points=allPoints(),boxes=points.filter(p=>['electronic','mechanical','gear'].includes(p.type));
 return [
  [boxes.length,'图上箱子标记'],[boxes.filter(p=>p.status==='random_source').length,'随机箱子标记'],
  [points.filter(p=>p.type==='keyroom').length,'门禁房'],[points.filter(p=>p.floors?.length).length,'明确楼层点位']
 ];
}
function overview(){
 state.selected=null;$('mobile-detail').hidden=true;document.querySelector('.right-panel').scrollTop=0;
 $('detail').innerHTML=window.bagelOverview.render({metrics:overviewMetrics()});draw();
}
function pointNote(p){
 if(isClient33(p))return '';
 const text=`<p class="detail-note" ${p.noteEn?`data-i18n-en="${esc(p.noteEn)}"`:""}>${esc(p.note||'个人记录，未独立核验。')}</p>`;
 return p.type==='briefcase'?`<details class="atlas-detail-more"><summary data-i18n-en="Marker details & sources">点位与来源说明</summary>${text}</details>`:text;
}
function selectPoint(id,focus=false){const p=allPoints().find(p=>p.id===id);if(!p)return;if(p.personal&&window.mapTools){if(focus)focusPoint(p);window.mapTools.edit(p);return;}if(state.source2d!=='source')set2DSource('source');if(isClient33(p)){state.candidatesEnabled=true;state.candidateTypes.add(p.type);}if(isEnemy(p)){state.enemySourceTouched=true;state.enemySource=enemyPool(p);renderFilters();}state.selected=id;document.body.classList.remove('detail-collapsed','filters-open');$('mobile-detail').hidden=false;document.querySelector('.right-panel').scrollTop=0;const type=TYPES[p.enemyClass==='phantom'?'phantom':p.type]||TYPES.custom;const room=state.data[state.map]?.rooms?.find(r=>r.id===id||r.pointId===id);const ob=personal.observations[id]||{present:0,absent:0};const near=sourceDisplayPoints().filter(n=>n.id!==id&&Math.hypot(n.x-p.x,n.y-p.y)<.026);$('detail').innerHTML=`<div class="detail-panel-header"><div class="detail-eyebrow"><span class="type-symbol${p.enemyClass==='phantom'||isClient33(p)?' atlas-type-symbol':''}" style="${p.enemyClass==='phantom'||isClient33(p)?'':'background:'+type[2]}">${p.enemyClass==='phantom'||isClient33(p)?window.DUKEMapSymbols.svg(isClient33(p)?p.type:'phantom'):type[1]}</span><span class="detail-context-label">${esc(p.id)}</span></div><button id="close-detail" class="detail-close-button" type="button" aria-label="关闭点位详情" title="关闭，返回地图工具"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg><span>关闭</span></button></div><h2 class="detail-title" ${p.labelEn?`data-i18n-en="${esc(p.labelEn)}"`:""}>${esc(p.label)}</h2><span class="detail-status ${esc(p.status)}">${STATUS[p.status]||'待核验'}</span><dl class="detail-meta"><dt>区域</dt><dd>${esc(regionName(p.region))}</dd><dt>楼层</dt><dd>${esc(floorName(p))}</dd><dt>图像位置</dt><dd>${(p.x*100).toFixed(2)}%, ${(p.y*100).toFixed(2)}%</dd></dl>${pointNote(p)}${p.status==='fixed_source'?'<p class="small muted" data-i18n-en="A fixed marker does not guarantee a spawn or drop.">固定标记不保证本局刷新或掉落。</p>':''}${room?renderRoom(room):''}${sourceLocationDetails(p)}<div class="detail-buttons">${isClient33(p)?'':`<button class="primary-button" id="add-to-route">${(personal.routes[state.map]||[]).includes(id)?'已在清单 · 点击移除':'＋ 加入访问清单'}</button>`}${p.sourceImage?`<button class="secondary-button" data-source="${p.sourceImage}">查看原图证据 ↗</button>`:''}${p.currentReviewImage&&p.currentReviewImage!==p.sourceImage?`<button class="secondary-button" data-source="${p.currentReviewImage}" data-i18n-en="Compare the new map ↗">查看新版对照 ↗</button>`:''}</div><details class="atlas-detail-more"><summary data-i18n-en="My notes and observations">个人备注与观察</summary><h3>个人备注</h3><textarea id="point-note" placeholder="路线、门禁、出生情况…">${esc(personal.notes[id]||'')}</textarea><button id="save-note" class="text-btn" style="margin-top:8px">保存备注</button><h3>个人观察记录</h3><div class="observation-buttons"><button data-observe="present">本局见到 ＋1</button><button data-observe="absent">本局未见 ＋1</button></div><p class="observation-count">见到 ${ob.present} 次 · 未见 ${ob.absent} 次 <button class="text-btn" id="undo-observe">撤销上次</button></p><p class="small muted">手动记录，仅供个人对照，不自动推算必刷。</p></details>${near.length?`<h3>附近 / 重叠点位</h3><div class="nearby-list">${near.map(n=>isClient33(n)?`<button data-point="${esc(n.id)}"><span class="atlas-type-symbol">${window.DUKEMapSymbols.svg(n.type)}</span><span data-i18n-en="${esc(n.labelEn)}">${esc(n.label)}</span><small>${esc(n.id)}</small></button>`:`<button data-point="${n.id}">${n.id} · ${TYPES[n.type]?.[1]||'点'}</button>`).join('')}</div>`:''}${p.personal?'<button id="delete-personal" class="wide-button" style="margin-top:20px">删除此个人点位</button>':''}`;
 window.dispatchEvent(new CustomEvent('atlasselection',{detail:{map:state.map,point:p}}));
 if(focus){if(isClient33(p))state.candidateTypes.add(p.type);else state.types.add(filterType(p));state.statuses.add(p.status);state.floor='all';if(!matchesQuery(p)){state.query='';$('search').value=''}$('floor').value='all';renderFilters();focusPoint(p)}else draw()
}
function renderRoom(room){const contents=room.contents||room.chests||{};return `<h3>门禁房资料</h3><p class="small muted">${esc(room.englishName||room.sourceEnglishName||room.name||'')}<br>${room.cardTier?'门卡等级 '+esc(room.cardTier):''} ${(room.listedCost||room.sourceListedPrice)?'· 图上标价 '+Number(room.listedCost||room.sourceListedPrice).toLocaleString():''}</p><div class="room-contents">${Object.entries(contents).map(([k,v])=>`<div><span>${TYPES[k]?.[0]||esc(k)}</span><b>× ${esc(v)}</b></div>`).join('')}</div><p class="small muted">房间内数量汇总，不能作为每个箱子的精确坐标。${esc(room.note||'')}</p>`}
const pointFiles = new Map(), baseImages = new Map(), extraLayers = new Map();
let mapRequest = 0, sharedLayers, pendingLayerFrame = 0;
function loadMapPoints(id) {
  if (!pointFiles.has(id)) {
    const request = fetch(id + '-data.json?v=20261107-refresh-launch-1').then(async response => {
      if (!response.ok) throw Error('点位文件读取失败');
      const data = await response.json();
      if (data.map !== id || !Array.isArray(data.points)) throw Error('点位文件格式有误');
      state.data[id] = data;
    }).catch(error => { pointFiles.delete(id); throw error; });
    pointFiles.set(id, request);
  }
  return pointFiles.get(id);
}
function loadBaseImage(id) {
  if (!baseImages.has(id)) {
    const request = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(Error('底图读取失败'));
      image.src = 'assets/source-' + MAPS[id].base + '.png';
    }).catch(error => { baseImages.delete(id); throw error; });
    baseImages.set(id, request);
  }
  return baseImages.get(id);
}
function refreshLoadedLayers() {
  if (!state.ready || pendingLayerFrame) return;
  pendingLayerFrame = requestAnimationFrame(() => {
    pendingLayerFrame = 0;
    if (!state.enemySourceTouched && !state.selected) state.enemySource = defaultEnemySource();
    renderFilters();
    renderRoutes();
    if ($('detail').querySelector('.map-overview')) {
      const metrics = overviewMetrics();
      $('detail').querySelectorAll('.overview-metrics dd').forEach((node,i) => {node.textContent=metrics[i][0];});
    }
    draw();
    window.dispatchEvent(new CustomEvent('atlaspointschange'));
  });
}
function loadLayer(request, onFailure) {
  return request.catch(onFailure).then(refreshLoadedLayers);
}
function mapLayers(id) {
  if (!extraLayers.has(id)) {
    const locations = loadLayer(loadSourceLocations(id), error => console.warn(error.message));
    const ore = loadLayer(loadSourceOre(id), error => console.warn(error.message));
    extraLayers.set(id, {locations, ore});
  }
  return extraLayers.get(id);
}
function mapLoadStatus(id, failed) {
  const panel = $('map-error');
  const name = MAPS[id].name, english = id === 'janus' ? 'Janus Illusion' : 'Suburbs Illusion';
  const message = document.createElement('span');
  message.textContent = failed ? name + '暂时无法加载。' : '正在加载' + name + '…';
  message.dataset.i18nEn = failed ? 'Could not load ' + english + '. ' : 'Loading ' + english + '…';
  panel.replaceChildren(message);
  if (failed) {
    const retry = document.createElement('button');
    retry.type = 'button'; retry.className = 'text-btn';
    retry.textContent = '重新加载'; retry.dataset.i18nEn = 'Retry';
    retry.onclick = () => setMap(id);
    panel.append(retry);
  }
  panel.hidden = false;
}
async function setMap(id) {
  if (!Object.hasOwn(MAPS,id)) return false;
  const request = ++mapRequest;
  if (!state.images[MAPS[id].base]) mapLoadStatus(id,false);
  let image;
  try {
    [image] = await Promise.all([loadBaseImage(id), loadMapPoints(id)]);
  } catch (error) {
    if (request === mapRequest) mapLoadStatus(id,true);
    return false;
  }
  if (request !== mapRequest) return false;
  const firstView = !state.ready;
  state.images[MAPS[id].base] = image;
  $('map-error').hidden = true;
  state.map = id; state.enemySourceTouched = false; state.enemySource = defaultEnemySource();
  state.selected = null; state.hover = null; state.floor = 'all'; state.query = '';
  state.types = new Set(DEFAULT_TYPES);
  if (state.enemySource === 'source') state.types.add('enemy');
  state.statuses = new Set(DEFAULT_STATUSES);
  state.zoom = 1; state.tx = 0; state.ty = 0;
  state.routeVisible = false; state.sourceRouteFit = false; state.adding = false;
  canvas.classList.remove('adding'); $('search').value = ''; $('floor').value = 'all';
  $('map-name').textContent = MAPS[id].name;
  document.querySelectorAll('[data-map]').forEach(b => b.classList.toggle('active', b.dataset.map === id));
  renderFilters(); renderSources(); renderRoutes(); overview(); resize();
  state.ready = true;
  window.dispatchEvent(new CustomEvent('atlasmapchange',{detail:{map:id}}));
  if (firstView) window.dispatchEvent(new CustomEvent('atlasready'));
  mapLayers(id);
  return true;
}
function sync2DSource(){
 $('map-stage').hidden=false;document.body.classList.remove('native2d-active');
 $('view-note').textContent='滚轮缩放 · 拖动平移 · 点击点位';
 $('cursor-position').textContent='图像坐标 · 非世界坐标';
 $('map-legend-note').innerHTML='<span data-i18n-en="○ Random · ◇ Conditional · ? Unverified">○ 随机 · ◇ 条件 · ? 待核验</span>';
 $('map-credit-note').textContent='底图 © 游戏权利方 · 标点 @KELZERO';
 $('toggle-labels').classList.toggle('active',state.labels);
}
// Retain the shared route API; all callers now stay on the reference map.
function set2DSource(){state.adding=false;canvas.classList.remove('adding');state.source2d='source';state.selected=null;$('mobile-detail').hidden=true;sync2DSource();renderFilters();overview();resize();window.dispatchEvent(new CustomEvent('atlassourcechange',{detail:{source:'source'}}))}
function setMode(){state.mode='2d';set2DSource(state.source2d)}
$('mobile-filters').onclick=()=>document.body.classList.toggle('filters-open');$('close-filters').onclick=()=>document.body.classList.remove('filters-open');$('mobile-detail').onclick=()=>document.body.classList.toggle('detail-collapsed');
let drag=null;
canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;state.sourceRouteFit=false;drag={x:e.offsetX,y:e.offsetY,tx:state.tx,ty:state.ty,moved:false};canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{if(drag){if(Math.hypot(e.offsetX-drag.x,e.offsetY-drag.y)>4)drag.moved=true;state.tx=drag.tx+e.offsetX-drag.x;state.ty=drag.ty+e.offsetY-drag.y;draw();$('tooltip').hidden=true;return}if(!baseReady())return;const p=unproject(e.offsetX,e.offsetY);$('cursor-position').textContent=`图像坐标 ${(p.x*100).toFixed(1)}%, ${(p.y*100).toFixed(1)}%`;const navHit=[...state.routeHits].reverse().find(h=>Math.hypot(h.q.x-e.offsetX,h.q.y-e.offsetY)<h.r);if(navHit){canvas.style.cursor='pointer';$('tooltip').textContent=navHit.label;$('tooltip').style.left=Math.max(8,Math.min(e.offsetX+18,state.w-220))+'px';$('tooltip').style.top=Math.min(e.offsetY+18,state.h-60)+'px';$('tooltip').hidden=false;return}const h=[...state.hit].reverse().find(h=>Math.abs(h.q.x-e.offsetX)<h.r+3&&Math.abs(h.q.y-e.offsetY)<h.r+3);canvas.style.cursor=state.adding?'crosshair':h?'pointer':'grab';if(state.hover!==(h?.p.id||null)){state.hover=h?.p.id||null;draw()}if(h){$('tooltip').innerHTML=esc(h.p.id)+' · <span '+(h.p.personal?'data-i18n-skip':'')+'>'+esc(h.p.label)+'</span> · '+esc(STATUS[h.p.status]);$('tooltip').style.left=Math.max(8,Math.min(e.offsetX+18,state.w-270))+'px';$('tooltip').style.top=Math.min(e.offsetY+18,state.h-55)+'px';$('tooltip').hidden=false}else $('tooltip').hidden=true});
canvas.addEventListener('pointerup',e=>{if(e.button!==0)return;const moved=drag?.moved;drag=null;if(moved||!baseReady())return;if(state.adding||e.shiftKey){const p=unproject(e.offsetX,e.offsetY);if(p.x<0||p.x>1||p.y<0||p.y>1){toast('请在底图范围内选择位置');return}state.pending=p;$('new-point-dialog').showModal();return}const navHit=[...state.routeHits].reverse().find(h=>Math.hypot(h.q.x-e.offsetX,h.q.y-e.offsetY)<h.r);if(navHit){if(navHit.assault)window.assaultRoutes?.focusMarker?.(navHit.id);else if(navHit.source)selectPoint(navHit.id);else window.sourceRoute2D?.chooseCandidate?.(navHit.role,navHit.id);return}const h=[...state.hit].reverse().find(h=>Math.abs(h.q.x-e.offsetX)<h.r+3&&Math.abs(h.q.y-e.offsetY)<h.r+3);if(h)selectPoint(h.p.id)});
canvas.addEventListener('pointercancel',()=>drag=null);canvas.addEventListener('pointerleave',()=>{$('tooltip').hidden=true;if(state.hover){state.hover=null;draw()}});canvas.addEventListener('wheel',e=>{e.preventDefault();zoomAt(Math.exp(-e.deltaY*.0015),e.offsetX,e.offsetY)},{passive:false});
$('zoom-in').onclick=()=>zoomAt(1.35);$('zoom-out').onclick=()=>zoomAt(1/1.35);$('reset-view').onclick=resetView;$('toggle-labels').onclick=()=>{state.labels=!state.labels;$('toggle-labels').classList.toggle('active',state.labels);$('toggle-labels').setAttribute('aria-pressed',String(state.labels));draw()};
$('source-route-open').onclick=()=>{showSide('routes');(window.assaultRoutes||window.sourceRoute2D)?.open();if(window.matchMedia('(max-width:570px)').matches)document.body.classList.add('filters-open')};
$('show-configured-spawn').onclick=()=>showConfiguredLocations('spawn');$('show-configured-exit').onclick=()=>showConfiguredLocations('exit');
$('detail').addEventListener('click',e=>{
 const tool=e.target.closest('[data-overview-action]');if(!tool)return;
 const action=tool.dataset.overviewAction;
 if(action==='spawn'||action==='exit'){$('show-configured-'+action).click();return;}
 if(action==='sources'){showSide('sources');document.body.classList.add('filters-open');$('side-sources').scrollIntoView({block:'nearest'});return;}
 if(action==='route'){$('source-route-open').click();return;}
 if(action==='search')showSide('points');
 document.body.classList.add('filters-open');
 const field=$('search');
 field?.focus({preventScroll:true});field?.scrollIntoView({block:'nearest'});
});
function syncLayerButtons(){
 document.querySelectorAll('[data-atlas-layer]').forEach(b=>{const ts=LAYERS[b.dataset.atlasLayer];const active=ts.length===state.types.size&&ts.every(t=>state.types.has(t));b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});
}
document.querySelectorAll('[data-atlas-layer]').forEach(button=>button.onclick=()=>{state.types=new Set(LAYERS[button.dataset.atlasLayer]);renderFilters();draw()});
document.querySelectorAll('[data-map]').forEach(b=>b.onclick=()=>setMap(b.dataset.map));document.querySelectorAll('[data-side]').forEach(b=>b.onclick=()=>showSide(b.dataset.side));
$('search').oninput=e=>{state.query=e.target.value.trim();draw()};$('search-clear').onclick=()=>{state.query='';$('search').value='';draw();$('search').focus()};$('search').onkeydown=e=>{if(e.key==='Escape'){$('search-clear').click();e.stopPropagation()}else if(e.key==='Enter'&&state.query){const p=visible()[0];if(p){e.preventDefault();selectPoint(p.id,true)}}};$('floor').onchange=e=>{state.floor=e.target.value;draw()};$('type-filters').onchange=e=>{if(e.target.checked)state.types.add(e.target.value);else state.types.delete(e.target.value);syncTypeToggle();syncLayerButtons();draw()};$('types-all').onclick=()=>{const types=availableTypes();state.types=types.every(type=>state.types.has(type))?new Set():new Set(types);renderFilters();draw()};$('status-filters').onclick=e=>{const b=e.target.closest('[data-status]');if(!b)return;const s=b.dataset.status;state.statuses.has(s)?state.statuses.delete(s):state.statuses.add(s);b.classList.toggle('active',state.statuses.has(s));b.setAttribute('aria-pressed',String(state.statuses.has(s)));draw()};
$('regions').onclick=e=>{const b=e.target.closest('[data-region]');if(!b)return;const r=MAPS[state.map].regions.find(r=>r[0]===b.dataset.region);if(state.source2d!=='source')set2DSource('source');focusPoint({x:r[2],y:r[3]},2.1)};
document.addEventListener('click',e=>{const source=e.target.closest('[data-source]');if(source)showSource(Number(source.dataset.source));const point=e.target.closest('[data-point]');if(point)selectPoint(point.dataset.point,true)});
$('detail').addEventListener('click',e=>{const p=allPoints().find(p=>p.id===state.selected);if(e.target.closest('#close-detail')){overview();return}if(!p)return;const id=p.id;
 if(e.target.id==='add-to-route'&&!isClient33(p)){let r=personal.routes[state.map]||=[];if(r.includes(id))personal.routes[state.map]=r.filter(x=>x!==id);else r.push(id);save();renderRoutes();selectPoint(id);draw()}
 if(e.target.id==='save-note'){personal.notes[id]=$('point-note').value;save();draw();toast('备注已保存')}
 if(e.target.dataset.observe){const key=e.target.dataset.observe;const ob=personal.observations[id]||={present:0,absent:0,history:[]};ob[key]++;(ob.history||=[]).push(key);save();selectPoint(id)}
 if(e.target.id==='undo-observe'){const ob=personal.observations[id],key=ob?.history?.pop();if(key){ob[key]=Math.max(0,ob[key]-1);save();selectPoint(id)}}
 if(e.target.id==='delete-personal'){personal.custom=personal.custom.filter(x=>x.id!==id);personal.routes[state.map]=(personal.routes[state.map]||[]).filter(x=>x!==id);delete personal.notes[id];save();renderFilters();renderRoutes();overview()}
});
$('clear-route').onclick=()=>{personal.routes[state.map]=[];save();renderRoutes();draw()};$('route-toggle').onclick=()=>{state.routeVisible=!state.routeVisible;renderRoutes();draw();if(state.routeVisible)toast('连线表示访问顺序，不表示实际可通行道路')};
$('add-point').onclick=()=>{if(state.source2d!=='source')set2DSource('source');state.adding=!state.adding;canvas.classList.toggle('adding',state.adding);toast(state.adding?'点击底图，添加个人点位':'已取消添加')};$('cancel-new').onclick=()=>{$('new-point-dialog').close();state.adding=false;canvas.classList.remove('adding')};$('new-point-form').onsubmit=e=>{e.preventDefault();const type=$('new-type').value,f=$('new-floor').value;const p={id:'U-'+Date.now().toString(36).toUpperCase(),map:state.map,type,x:state.pending.x,y:state.pending.y,label:$('new-label').value.trim(),floors:f?[Number(f)]:[],floorEvidence:f?'user':'unlabelled',status:'unknown',sourceImage:null,note:'个人添加的位置，未独立核验。',personal:true};personal.custom.push(p);state.types.add(type);state.statuses.add('unknown');state.floor='all';state.query='';$('floor').value='all';$('search').value='';save();$('new-point-dialog').close();$('new-point-form').reset();state.adding=false;canvas.classList.remove('adding');renderFilters();selectPoint(p.id);toast('个人点位已保存')};
$('close-source').onclick=()=>$('source-dialog').close();$('source-dialog').onclick=e=>{if(e.target===$('source-dialog'))$('source-dialog').close()};
$('export').onclick=async()=>{
 const button=$('export');button.disabled=true;
 try {
  await Promise.all([sharedLayers, ...Object.keys(MAPS).flatMap(id=>[loadMapPoints(id),mapLayers(id).locations])]);
  if (Object.keys(MAPS).some(id=>!state.sourceLocations[id]) || state.authorLayerError || state.candidateLayerError) throw Error('图层未完整载入');
  const payload={schemaVersion:1,exportedAt:new Date().toISOString(),scope:'User supplied source maps, not complete verified game dataset',maps:state.data,sourceLocations:state.sourceLocations,authorEnemies:state.kelzeroSource,authorSources:state.authorSources,client33Candidates:state.candidateData,personal};const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='DUKE-点位与个人记录.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已导出两张地图的点位与个人记录');
 } catch {toast(window.DUKE_I18N.language==='en'?'Map data is incomplete. Refresh and try exporting again.':'地图资料尚未完整载入，请刷新后重新导出。');}
 finally {button.disabled=false;}
};
window.atlas={state,personal,renderFullMapImage,save,toast,renderFilters,renderRoutes,resize,unproject,setRotation,focusPoint,allPoints,visible,selectPoint,setMap,setMode,set2DSource,setEnemySource,showSource,resetView,draw,project,fitPoints,showSide,regionName};
function init() {
  new ResizeObserver(resize).observe($('map-stage'));
  window.addEventListener('resize',resize);
  window.addEventListener('keydown',event => {
    if (event.key === 'Escape') {state.adding=false; canvas.classList.remove('adding');}
  });
  setMap(state.map);
  sharedLayers = Promise.all([
    loadLayer(loadAuthorUpdate().then(() => {if (state.ready) renderSources();}), error => {state.authorLayerError=error.message;}),
    loadLayer(loadClient33Candidates(), error => {state.candidateLayerError=error.message;}),
    loadLayer(loadCommunityBoss(), error => {state.communityBossError=error.message;})
  ]);
}
const pageUrl=new URL(location.href);if(pageUrl.searchParams.get('view')==='exploration'){pageUrl.searchParams.delete('view');history.replaceState(null,'',pageUrl.pathname+pageUrl.search+pageUrl.hash)}
const requestedMap=pageUrl.searchParams.get('map');if(Object.hasOwn(MAPS,requestedMap))state.map=requestedMap;
loadLocationCounts();init();

window.mapToolAdapters ||= {};window.mapToolAdapters.source={canvas,state,map:()=>state.map,project,unproject,resize,draw,rotation:()=>state.rotation,setRotation,focus:focusPoint,reset:resetView,ready:()=>!!state.images[MAPS[state.map].base],hit:(x,y)=>[...state.hit].reverse().find(h=>h.p.personal&&Math.hypot(h.q.x-x,h.q.y-y)<h.r+4)?.p};

$('atlas-source-latest').onclick=()=>{showSide('sources');if(window.matchMedia('(max-width:570px)').matches)document.body.classList.add('filters-open')};

document.querySelectorAll('[data-atlas-layer] .atlas-layer-icon').forEach(el=>{el.innerHTML=DUKEMapSymbols.svg({overview:'spawn',containers:'mechanical',enemies:'enemy',rooms:'keyroom'}[el.parentElement.dataset.atlasLayer])});

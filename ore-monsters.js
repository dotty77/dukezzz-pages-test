import {loadSourceProjection} from './source-route-projection.js?v=20260912-map-panel-1';
import {bossCommunityDetails} from './boss-community-guide.js?v=20260919-site-refresh-1';

const MAPS=new Set(['janus','suburbs']);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let pending;

export function validateOreLayer(data){
 if(data?.schemaVersion!==1||data.item?.id!==4360046||!Array.isArray(data.maps))throw Error('赭石碎片点位资料格式无效');
 const mapIds=new Set(),pointIds=new Set();
 for(const map of data.maps){
  if(!MAPS.has(map.map)||mapIds.has(map.map)||!Array.isArray(map.points))throw Error('赭石碎片点位地图无效');
  mapIds.add(map.map);
  for(const p of map.points){
   if(typeof p.id!=='string'||!/^ore-[\w-]+$/.test(p.id)||pointIds.has(p.id)||!p.label||!p.evidence||!p.worldPosition||!['x','y','z'].every(k=>Number.isFinite(p.worldPosition[k])))throw Error('赭石碎片点位缺少坐标或依据');
   if(p.positionAlternatives&&(!Array.isArray(p.positionAlternatives)||!p.positionAlternatives.every(a=>a.label&&a.worldPosition&&['x','y','z'].every(k=>Number.isFinite(a.worldPosition[k])))))throw Error('随机遭遇的备选坐标无效');
   pointIds.add(p.id);
  }
 }
 if(mapIds.size!==2)throw Error('赭石碎片资料缺少地图');
 return data;
}

async function loadData(){
 if(!pending){
  const controller=new AbortController();let timer;
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('赭石碎片图层读取超时，可刷新重试'));},5000);});
  pending=Promise.race([fetch(new URL('./research/ore-monsters.json?v=20260918-suburbs-shard-fix-1',import.meta.url),{signal:controller.signal})
   .then(r=>{if(!r.ok)throw Error(`赭石碎片图层读取失败：HTTP ${r.status}`);return r.json();}).then(validateOreLayer),deadline])
   .catch(e=>{pending=null;throw e;}).finally(()=>clearTimeout(timer));
 }
 return pending;
}

export async function loadOreMonsters(map){
 if(!MAPS.has(map))throw Error('未知地图');
 const data=await loadData(),layer=data.maps.find(m=>m.map===map);
 return layer.points.map(p=>({...p,map,type:'ore_boss',kind:'ore_boss',status:'conditional',itemId:4360046,region:'ore-config',
  note:p.note||data.note,conditions:p.conditions||data.conditions||[],sources:p.sources||data.sources||[],rewardGuide:data.rewardGuide,
  coordinateSpace:'source-world',floors:[],floorEvidence:'unlabelled'}));
}

export async function loadSourceOreMonsters(map){
 let timer;
 try{
  const [points,projection]=await Promise.race([Promise.all([loadOreMonsters(map),loadSourceProjection(map)]),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('首领位置配准读取超时')),5500);})]);
  return points.map(p=>({...p,...projection.project(p.worldPosition),coordinateSpace:'source-image-normalized',
   positionStatus:'estimated_source_image_position',registrationEvidence:projection.registrationEvidence}))
   .filter(p=>p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1);
 }finally{clearTimeout(timer);}
}

function rewardGuideDetails(guide){
 if(!guide?.sections?.length)return '';
 return `<details class="ore-reward-guide"><summary>奖励条件、数量与资料来源</summary>${guide.sections.map(s=>`<p><b>${escape(s.title)}</b><br>${escape(s.text)}${s.url&&/^https:\/\//.test(s.url)?` <a href="${escape(s.url)}" target="_blank" rel="noreferrer">查看来源 ↗</a>`:''}</p>`).join('')}<p class="small muted">核对日期：${escape(guide.reviewedAt)}。旧版本实测与当前配置分别标注。</p></details>`;
}

function alternativePositions(p){
 if(!p.positionAlternatives?.length)return '';
 return `<details class="ore-reward-guide"><summary>随机遭遇的原始坐标</summary><p class="small muted">两种怪物属于同组不同选项；标记采用其中一个原始坐标，未取中点或修改原始位置。</p>${p.positionAlternatives.map(a=>`<p><b>${escape(a.label)}</b><br>X / Y / Z：${['x','y','z'].map(k=>a.worldPosition[k].toFixed(2)).join(' / ')}</p>`).join('')}</details>`;
}

export function oreMonsterDetails(p,{source=false}={}){
 if(p.type!=='ore_boss'&&p.kind!=='ore_boss')return '';
 const links=(p.sources||[]).filter(s=>{try{return ['https:','http:'].includes(new URL(s.url).protocol)}catch{return false}});
 const positions=alternativePositions(p);
 return `<section class="callout ore-monster-detail"><b>赭石碎片候选</b><p>${escape(p.note)}</p>${p.conditions?.length?`<ul>${p.conditions.map(c=>`<li>${escape(c)}</li>`).join('')}</ul>`:''}<p class="small muted">数量表示有奖励线索的敌人位置，不代表一局必刷或击杀必掉。资料图的「赭石碎片敌人（待核实）」分类可切换游戏配置与原图标注，两种来源不同时显示。</p>${positions}${rewardGuideDetails(p.rewardGuide)}</section>${source?`<p class="small muted">资料图位置由世界坐标配准估算，楼层以原始高度 Y 为准。</p><dl class="detail-meta"><dt>世界 X / Y / Z</dt><dd>${['x','y','z'].map(k=>p.worldPosition[k].toFixed(2)).join(' / ')}</dd></dl>`:''}<details class="route-evidence"><summary>怪物与掉落依据</summary><p class="small muted">${escape(p.evidenceSummary||'位置与奖励容器来自游戏配置；赭石碎片获取条件需与本局投资和实际奖励核对。')}</p>${links.map(s=>`<p><a href="${escape(s.url)}" target="_blank" rel="noreferrer">${escape(s.label)} ↗</a></p>`).join('')}<pre class="candidate-evidence">${escape(JSON.stringify(p.evidence,null,2))}</pre>${source?`<a href="research/${escape(p.map)}-source-registration.json" target="_blank" rel="noreferrer">查看位置配准与误差 ↗</a>`:''}</details>`;
}

function showOreLayer(view){
 const atlas=window.atlas;
 if(window.mapTools?.clean)document.getElementById('map-clean').click();
 if(view==='source'){
  const hasConfigured=!!atlas.state.oreSource[atlas.state.map]?.length,source=hasConfigured?'configured':'source';
  atlas.setEnemySource(source);
  Object.assign(atlas.state,{types:new Set(['enemy']),enemySource:source,statuses:new Set(hasConfigured?['conditional']:['fixed_source','random_source','conditional','unknown']),floor:'all',query:''});
  document.getElementById('search').value='';document.getElementById('floor').value='all';
  atlas.renderFilters();atlas.resetView();
 }else{
  const adapter=window.mapToolAdapters?.native;if(!adapter?.ready())return;
  const s=adapter.state,ys=s.points.filter(p=>p.kind==='ore_boss').map(p=>p.worldPosition.y);
  const minY=Math.min(s.mainY[0],...ys.map(y=>y-5)),maxY=Math.max(s.mainY[1],...ys.map(y=>y+5));
  Object.assign(s,{groups:new Set(['enemy']),refreshFilter:'all',search:'',minY,maxY});
  document.getElementById('native-search').value='';document.getElementById('native-height-preset').value=minY===s.mainY[0]&&maxY===s.mainY[1]?'main':'custom';
  document.getElementById('native-height-min').value=s.minY;document.getElementById('native-height-max').value=s.maxY;
  document.querySelectorAll('#native-types input').forEach(el=>el.checked=el.value==='enemy');
  document.querySelectorAll('#native-refresh-controls [data-refresh]').forEach(el=>el.classList.toggle('active',el.dataset.refresh==='all'));
  document.getElementById('native-types-all').textContent='全选';document.getElementById('native-types-all').setAttribute('aria-pressed','false');adapter.reset();
 }
}

function mountShortcut(view,points,error=''){
 const id=`${view}-ore-shortcut`;let card=document.getElementById(id);
 if(!card){
  card=document.createElement('section');card.id=id;card.className='callout';
  card.style.borderColor='#b58a50';
  card.innerHTML='<b>赭石碎片敌人（待核实）</b><p class="ore-layer-count"></p><p class="small muted" data-i18n-en="View enemy locations from the available records. Open a marker for its source and drop verification details.">按已收录资料查看敌人位置；来源和掉落确认情况请见点位详情。</p><button type="button" class="wide-button">只看赭石碎片候选</button><div class="ore-guide-slot"></div>';
  if(view==='source')document.getElementById('source-count-note').before(card);else document.getElementById('native-map-controls').prepend(card);
  card.querySelector('button').onclick=()=>showOreLayer(view);
 }
 const count=card.querySelector('.ore-layer-count');
 if(!error&&!points.length)count.dataset.i18nEn='No Hematite Shard enemy candidates are listed for this map.';else delete count.dataset.i18nEn;
 count.textContent=error?`图层暂未加载：${error}`:!points.length?'本图暂无赭石碎片候选点。':`本图已整理 ${points.length} 处，仍有待核实点位。需高危调查与大富豪投资；有奖励容器不等于必出碎片。`;
 card.querySelector('.ore-guide-slot').innerHTML=rewardGuideDetails(points[0]?.rewardGuide)+bossCommunityDetails(window.atlas?.state.map);
 const button=card.querySelector('button');
 delete button.dataset.i18nEn;button.textContent='只看赭石碎片候选';
 button.disabled=!!error||!points.length;
 const sourceCount=(window.atlas?.state.data[window.atlas.state.map]?.points||[]).filter(p=>p.type==='enemy').length;
 if(view==='source'&&!points.length&&sourceCount){
  count.dataset.i18nEn=`This map retains ${sourceCount} enemy markers from the reference map. Hematite Shard drop conditions are unverified.`;
  count.textContent=`本图保留 ${sourceCount} 处资料图敌人标注，碎片掉落条件待核实。`;
  button.dataset.i18nEn='Show reference-map enemy markers';button.textContent='查看资料图敌人标注';button.disabled=false;
 }

}

if(typeof window!=='undefined')window.oreMonsters={loadOreMonsters,loadSourceOreMonsters,details:oreMonsterDetails,mountShortcut,showLayer:showOreLayer};

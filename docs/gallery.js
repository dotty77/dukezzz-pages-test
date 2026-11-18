import {createSpritePlayer, prefetchAnimation} from './gallery-media.js?v=20260909-version-3-2-1';
import {renderItemSources} from './item-sources.js?v=20261021-map-launch-1';

const $ = id => document.getElementById(id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plain = value => String(value ?? '').replace(/<[^>]*>/g, '').replace(/\\n/g, '\n').trim();
const number = value => Number(value).toLocaleString('zh-CN');
const qualities = {1:{name:'C',color:'#35835e'},2:{name:'B',color:'#4178c1'},3:{name:'A',color:'#9463c0'},4:{name:'S',color:'#a97819'},5:{name:'Z',color:'#cf343a'}};
// Site display categories; keep the original client taxonomy in the catalog data.
const categoryOverrides = {'4360046':'贵重物品'};
const state = {items:[], media:{}, metadata:{}, category:'all', rarity:'all', motion:'all', search:'', sort:'quality', favoritesOnly:false, shown:72, selected:null, filtered:[], ready:false};
const favoritesKey = 'bagel-gallery-favorites-v1';
let favorites = new Set(), storageAvailable = true;
try { const saved = JSON.parse(localStorage.getItem(favoritesKey) || '[]'); if (Array.isArray(saved)) favorites = new Set(saved.map(String)); } catch { storageAvailable = false; }
let player = null, mediaGeneration = 0, currentMedia = 'static', mediaAbort = null;
let intentTimer = 0;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function quality(item) { return qualities[item.rarity] || {name:item.rarityLabel || '—',color:'#aebaa7'}; }
function media(item) { return state.media[item.id] || item.media || {}; }
function animation(item) { const a = media(item).animation; return a?.src && a.status !== 'pending' ? a : null; }
function motionStatus(item) { return animation(item) ? 'animated' : media(item).animation?.status === 'pending' || item.hasAnimation || item.displayResource ? 'pending' : 'static'; }
function icon(item) { const m = media(item); return m.icon || m.thumbnail || item.icon || null; }
function normalize(item) {
  const originalCategory=plain(item.category || item.categoryName || '其他物资');
  return {...item, id:String(item.id), name:plain(item.name || `物资 ${item.id}`), description:plain(item.description || item.desc), originalCategory, category:categoryOverrides[String(item.id)] || originalCategory, rarity:Number(item.rarity), price:item.price ?? item.value ?? null};
}
function imageMarkup(item, eager = false) {
  return icon(item) ? `<img src="${escape(icon(item))}" alt="${escape(item.name)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" width="160" height="160">` : '<span class="missing-art">图像暂缺</span>';
}
function handleImageErrors(container) {
  container.querySelectorAll('img').forEach(img => img.addEventListener('error', () => { const fallback = document.createElement('span'); fallback.className='missing-art';fallback.textContent='图像读取失败';img.replaceWith(fallback); }, {once:true}));
}
function priceText(item) { return item.price !== null ? number(item.price) : '—'; }
function categories() { const order=['贵重物品','门禁卡','战术棱镜','抗蚀器','背包','异体刃','骸影','战术道具','材料','蓝图','迷宫造物','活动物品','任务道具','货币','特殊物品'];return [...new Set(state.items.map(i=>i.category))].sort((a,b)=>order.indexOf(a)-order.indexOf(b)); }
function categoryMatches(item,category) { return category==='all'||category===item.category; }
function renderCategories() {
  $('category-tabs').innerHTML = ['all',...categories()].map(category => `<button type="button" data-category="${escape(category)}" aria-pressed="${state.category === category}">${escape(category === 'all' ? '全部物资' : category)}<span>${state.items.filter(i=>categoryMatches(i,category)).length}</span></button>`).join('');
}
function updateFilters() {
  state.filtered = state.items.filter(item =>
    categoryMatches(item,state.category) &&
    (state.rarity === 'all' || String(item.rarity) === state.rarity) &&
    (state.motion === 'all' || motionStatus(item) === state.motion) &&
    (!state.favoritesOnly || favorites.has(item.id)) &&
    (!state.search || window.DUKE_I18N.matches([item.name,item.description,item.id,item.category,...(item.tags||[])],state.search))
  );
  const byName = (a,b) => window.DUKE_I18N.t(a.name).localeCompare(window.DUKE_I18N.t(b.name),window.DUKE_I18N.language) || a.id.localeCompare(b.id);
  state.filtered.sort(state.sort === 'name' ? byName : state.sort === 'price-desc' ? (a,b) => (b.price ?? -1) - (a.price ?? -1) || byName(a,b) : state.sort === 'price-asc' ? (a,b) => (a.price ?? Infinity) - (b.price ?? Infinity) || byName(a,b) : (a,b) => b.rarity - a.rarity || (b.price ?? -1) - (a.price ?? -1) || byName(a,b));
  renderGrid();
}
function renderGrid() {
  const visible = state.filtered.slice(0,state.shown);
  $('item-grid').innerHTML = visible.map(item => {
    const q = quality(item), motion = motionStatus(item);
    return `<button class="item-card" type="button" data-id="${escape(item.id)}" data-rarity="${escape(item.rarity)}" style="--quality:${q.color}" aria-label="查看${escape(item.name)}${motion === 'animated' ? '，含动态展示' : ''}"><div class="card-art"><span class="game-item-tile">${imageMarkup(item)}</span>${favorites.has(item.id)?'<span class="card-favorite" aria-label="已收藏">★</span>':''}${motion === 'animated'?'<span class="card-motion">▷ 动态</span>':''}</div><div class="card-copy"><span class="card-meta"><span class="card-rarity">${escape(q.name)} 级</span><span class="card-category">${escape(item.category)}</span></span><b class="card-name">${escape(item.name)}</b><span class="card-price"><span>${priceText(item)}</span><small>${item.price !== null ? '配置价值' : '未标价值'}</small></span></div></button>`;
  }).join('');
  handleImageErrors($('item-grid'));
  $('result-count').textContent = `找到 ${state.filtered.length} 件物资${state.filtered.length > visible.length ? ` · 已展示 ${visible.length} 件` : ''}`;
  $('empty-state').hidden = state.filtered.length > 0;
  $('load-more').hidden = visible.length >= state.filtered.length;
  $('load-more').textContent = `继续浏览 · 还有 ${state.filtered.length - visible.length} 件 ↓`;
  $('clear-filters').hidden = state.category === 'all' && state.rarity === 'all' && state.motion === 'all' && !state.search && !state.favoritesOnly;
  $('favorites-only').setAttribute('aria-pressed', String(state.favoritesOnly));
  $('favorites-only').textContent = `${state.favoritesOnly ? '★' : '☆'} 收藏${state.favoritesOnly ? ` ${favorites.size}` : ''}`;
}
function resetFilters() {
  Object.assign(state, {category:'all',rarity:'all',motion:'all',search:'',favoritesOnly:false,shown:72});
  $('item-search').value='';$('rarity-filter').value='all';$('motion-filter').value='all';renderCategories();updateFilters();
}
function renderFeatured() {
  const pool = state.items.filter(item => animation(item) && icon(item));
  const item = pool.find(i => /王下一桶/.test(i.name)) || pool.sort((a,b) => (b.price ?? 0) - (a.price ?? 0))[0] || state.items.find(i => icon(i));
  if (!item) { $('featured-name').textContent='物资档案';return; }
  $('featured').disabled=false;$('featured').dataset.id=item.id;$('featured').setAttribute('aria-label',`查看${item.name}`);
  $('featured').style.setProperty('--quality',quality(item).color);
  $('featured').dataset.rarity=String(item.rarity);
  $('featured-art').innerHTML=`<span class="game-item-tile">${imageMarkup(item,true)}</span>`;handleImageErrors($('featured-art'));
  $('featured-name').textContent=item.name;$('featured-category').textContent=item.category;$('featured-rarity').textContent=quality(item).name;
}
function fact(label,value,className='') { return value !== null && value !== undefined && value !== '' ? `<dt>${escape(label)}</dt><dd class="${className}">${escape(value)}</dd>` : ''; }
function renderItemRules(item) {
  let element=$('item-tutorial-rules');
  if(!element){element=document.createElement('details');element.id='item-tutorial-rules';element.className='drop-more';}
  $('item-description').after(element);
  const rules=item.tutorialRules;element.hidden=!rules;element.open=false;
  element.innerHTML=rules?`<summary>${escape(rules.title)}</summary>${rules.paragraphs.map(text=>`<p class="drop-note">${escape(text)}</p>`).join('')}<p class="drop-footnote"><a href="${escape(rules.sourceUrl)}" target="_blank" rel="noreferrer">${escape(rules.sourceLabel)} ↗</a></p>`:'';
}
function renderFacts(item) {
  const fields = [fact('配置价值', item.price !== null ? `${number(item.price)} 齿轮硬币` : '未标明', 'fact-price')];
  if(item.stackMax != null)fields.push(fact('叠加上限',number(item.stackMax)));
  if(item.level != null)fields.push(fact('等级',item.level));
  if(item.size)fields.push(fact('占用空间',typeof item.size === 'object' ? `${item.size.width} × ${item.size.height}` : item.size));
  if(item.useDescription)fields.push(fact('用途',plain(item.useDescription)));
  if(item.obtainDescription)fields.push(fact('获取说明',plain(item.obtainDescription)));
  if(item.introducedVersion)fields.push(fact('新增版本',item.introducedVersion));
  if(item.availabilityLabel)fields.push(fact('收录状态',item.availabilityLabel));
  fields.push(fact('物资编号',item.id));
  $('item-facts').innerHTML=fields.join('');
}
function sourceMarkup(item) {
  const m=media(item), a=animation(item), lines = [];
  lines.push(`客户端版本：${state.metadata.version || '版本待核对'}。物资数值与资源名来自本地配置，中文按配置键与公开文本缓存对应。配置价值不等同于交易报价。`);
  if (item.source)lines.push(typeof item.source === 'string' ? item.source : JSON.stringify(item.source));
  if (m.evidence)lines.push(typeof m.evidence === 'string' ? m.evidence : JSON.stringify(m.evidence));
  if (a)lines.push(`动画：${a.frameCount || a.frames?.length || (a.columns || 8) * (a.rows || 8)} 帧。${a.fpsVerified ? `原配置播放速度 ${a.fps} 帧/秒。` : `网页浏览速度 ${a.fps || 24} 帧/秒；原作播放速度尚待核对。`}序列帧来自客户端原始图集。起始方向和循环方式采用网页浏览设置，尚未恢复原作参数。`);
  if (item.evidence)lines.push(`配置记录：物品 ${item.evidence.globalItem?.rowId || item.id}；模式表 ${item.evidence.modeItem?.table || '见原始资料'}。`);
  return lines.map(line=>`<p>${escape(line)}</p>`).join('');
}
function saveFavorites() { try { localStorage.setItem(favoritesKey, JSON.stringify([...favorites]));return true; } catch { storageAvailable=false;return false; } }
function renderFavorite() { const selected = favorites.has(state.selected?.id);$('favorite-item').textContent=selected?'★ 已收藏':'☆ 收藏物资';$('favorite-item').setAttribute('aria-pressed',String(selected)); }
function showItem(id, {updateURL=true} = {}) {
  const item=state.items.find(item=>item.id===String(id));if(!item)return;
  if (updateURL) {
    const url = new URL(location.href);
    url.hash = 'item=' + encodeURIComponent(item.id);
    if ($('item-dialog').open) history.replaceState(history.state, '', url);
    else history.pushState({...history.state, galleryFromList:true}, '', url);
  }
  state.selected=item;$('item-dialog').style.setProperty('--quality',quality(item).color);
  $('item-dialog').dataset.rarity=String(item.rarity);
  $('item-number').textContent=`物资档案 / ${item.id}`;$('item-title').textContent=item.name;$('item-rarity').textContent=`${quality(item).name} 级`;$('item-category').textContent=item.category;
  const descriptions=[item.description,item.detailDescription,item.researchDescription].filter(Boolean);
  if(!descriptions.length)descriptions.push('当前配置未提供物资说明。');
  $('item-description').replaceChildren(...descriptions.flatMap((text,index)=>{const part=document.createElement('span');part.textContent=text;return index?['\n\n',part]:[part];}));
  let sources=$('item-drop-sources');if(!sources){sources=document.createElement('section');sources.id='item-drop-sources';sources.className='item-drop-sources';sources.setAttribute('aria-label','物资产出来源');$('item-description').after(sources);}sources.hidden=!(item.originalCategory==='门禁卡'||item.originalCategory==='贵重物品'||[13012,14701].includes(item.categoryId)||item.id==='4311022');if(!sources.hidden)renderItemSources(item,sources);else{sources.dataset.item='';sources.replaceChildren();}
  renderItemRules(item);renderFacts(item);renderFavorite();renderTvLink(item);$('item-action-status').textContent='';$('item-evidence').innerHTML=sourceMarkup(item);
  $('item-evidence').parentElement.open=false;
  $('exhibit-stage').classList.remove('enlarged');$('media-enlarge').setAttribute('aria-pressed','false');$('media-enlarge').textContent='放大查看';
  $('media-dynamic').hidden=!animation(item);
  if(!$('item-dialog').open)$('item-dialog').showModal();
  $('item-dialog').scrollTop=0;
  setMedia(animation(item) ? 'dynamic' : 'static');
  updatePreviousNext();
}
// Valuables with a TV channel link to it; the wall's manifest loads the first time one is opened.
let tvChannels=null;
function tvChannelMap() {
  tvChannels??=fetch('assets/tv-wall/manifest.json?v=20261021-v33-launch-1').then(response=>{if(!response.ok)throw Error(`TV manifest ${response.status}`);return response.json();})
    .then(records=>new Map(records.filter(record=>record.itemId).map(record=>[String(record.itemId),record.code]))).catch(()=>{tvChannels=null;return new Map();});
  return tvChannels;
}
function renderTvLink(item) {
  const button=$('item-tv-link');button.hidden=true;
  if(item.originalCategory!=='贵重物品')return;
  tvChannelMap().then(channels=>{if(state.selected?.id===item.id)button.hidden=!channels.has(item.id);});
}
function selectedList() { if(state.filtered.some(i=>i.id===state.selected?.id))return state.filtered;return state.favoritesOnly ? [state.selected,...state.filtered].filter(Boolean) : state.items; }
function updatePreviousNext() { const list=selectedList();$('previous-item').disabled=list.length<2;$('next-item').disabled=list.length<2; }
function stepItem(delta) { const list=selectedList(),index=list.findIndex(i=>i.id===state.selected?.id);if(list.length)showItem(list[(index+delta+list.length)%list.length].id); }
function disposeMedia() { mediaGeneration++;mediaAbort?.abort();mediaAbort=null;player?.dispose();player=null;$('media-play').hidden=true;$('exhibit-stage').replaceChildren(); }
function playbackControls() { $('media-play').textContent=player?.playing ? '暂停' : '播放'; }
async function setMedia(kind) {
  disposeMedia();const generation=mediaGeneration,item=state.selected;if(!item)return;
  currentMedia=kind;$('media-static').setAttribute('aria-pressed',String(kind==='static'));$('media-dynamic').setAttribute('aria-pressed',String(kind==='dynamic'));
  const stage=$('exhibit-stage'), a=animation(item);
  if(kind==='static'||!a){stage.innerHTML=imageMarkup(item,true);handleImageErrors(stage);$('media-note').textContent=motionStatus(item)==='pending'?'该物资配置了展示资源，动态尚待接入核实。':'客户端原始物资图标';return;}
  $('media-note').textContent='正在加载原始动画…';
  stage.innerHTML=imageMarkup(item,true);handleImageErrors(stage);
  const canvas=document.createElement('canvas');canvas.hidden=true;canvas.setAttribute('aria-label',`${item.name}的原始序列帧动画`);stage.append(canvas);
  mediaAbort=new AbortController();
  let waiting=false, playbackError=false;
  const updateNote=()=>{
    if(generation!==mediaGeneration||!player)return;
    $('media-note').textContent=playbackError?'后续动画暂未加载成功，点击播放重试。':waiting?'正在缓冲后续画面…':`原始物资动画 · ${player.count} 帧${a.fpsVerified ? '' : ` · 浏览速度 ${player.fps} 帧/秒（原速待核对）`}${reducedMotion.matches&&!player.playing ? ' · 点击播放' : ''}`;
  };
  try {
    const created=await createSpritePlayer(canvas,a,{
      signal:mediaAbort.signal,
      onFrame:()=>{if(playbackError||waiting){playbackError=false;waiting=false;updateNote();}},
      onBuffering:value=>{waiting=value;updateNote();},
      onError:()=>{playbackError=true;updateNote();playbackControls();}
    });
    if(generation!==mediaGeneration||!$('item-dialog').open){created.dispose();return;}
    stage.replaceChildren(canvas);canvas.hidden=false;
    player=created;
    if(!reducedMotion.matches)player.play();
    $('media-play').hidden=false;playbackControls();
    updateNote();
  } catch(error) {
    if(generation!==mediaGeneration)return;
    stage.innerHTML=imageMarkup(item,true);handleImageErrors(stage);$('media-note').textContent=`动画读取失败，已显示原始图标。${error.message}`;
  }
}
function renderAbout() {
  const meta=state.metadata, animated=state.items.filter(i=>animation(i)).length, missing=state.items.filter(i=>!icon(i)).length;
  const notes=meta.notes || meta.coverageNotes || [];
  $('about-content').innerHTML=`<dl>${fact('客户端版本',meta.version || '3.1.0')}${fact('收录物资',`${state.items.length} 件`)}${fact('可播放原始动画',`${animated} 件`)}${fact('图像暂缺',`${missing} 件`)}</dl><h3>收录依据</h3><p>${escape(meta.scope || '以当前正式客户端的迷宫诡域物品配置为依据。不同品质、等级及任务变体保留独立条目。')}</p>${(Array.isArray(notes)?notes:[notes]).map(n=>`<p>${escape(n)}</p>`).join('')}<h3>动态展示</h3><p>标有「动态」的物资使用客户端原始序列帧，点击物资后按需加载。未核实的播放速度会在详情中注明。开启系统「减少动态效果」时，动画由你手动播放。</p><h3>收藏与价值</h3><p>收藏仅保存在当前浏览器。物资数值是客户端的配置价值，实际出售或换取数量以游戏为准。</p><p><a href="research/item-public-sources.md?v=20261021-v33-launch-1" target="_blank" rel="noreferrer">查看公开资料核验 ↗</a> · <a href="research/item-catalog.json?v=20261021-v33-launch-1" target="_blank" rel="noreferrer">查看物资配置记录 ↗</a></p>`;
}
async function init() {
  state.ready=false;$('load-error').hidden=true;
  try {
    const [catalogResponse,mediaResponse]=await Promise.all([fetch('item-catalog.json?v=20261021-v33-launch-1'),fetch('assets/items/manifest.json?v=20261117-team-lazy-beta-launch-1')]);
    if(!catalogResponse.ok)throw new Error('物资清单读取失败');
    if(!mediaResponse.ok)throw new Error('物资媒体索引读取失败');
    const catalog=await catalogResponse.json(),mediaData=await mediaResponse.json();
    state.items=catalog.items.map(normalize);state.metadata=catalog.metadata || catalog.meta || {};state.media=mediaData.items || mediaData;
    if(Array.isArray(state.media))state.media=Object.fromEntries(state.media.map(i=>[String(i.id),i]));
    $('version').textContent=`${state.metadata.version || '版本待核对'} · 古怪试炼`;$('total-count').textContent=String(state.items.length);
    const animated=state.items.filter(i=>animation(i)).length;
    $('coverage').dataset.i18nEn=`${state.items.length} items · ${animated} animations`;$('coverage').textContent=`${state.items.length} 件物资 · ${animated} 件动画`;
    $('rarity-filter').innerHTML='<option value="all">全部品质</option>'+[...new Set(state.items.map(i=>i.rarity))].sort((a,b)=>b-a).map(r=>`<option value="${r}">${escape(quality({rarity:r}).name)} 级</option>`).join('');
    renderCategories();updateFilters();renderFeatured();renderAbout();state.ready=true;
    syncItemFromURL();
  } catch(error) { $('load-error').hidden=false;$('load-error-message').textContent=error.message;$('coverage').textContent='物资档案暂未载入';$('result-count').textContent='读取失败'; }
}

$('category-tabs').addEventListener('click',event=>{const b=event.target.closest('[data-category]');if(b){state.category=b.dataset.category;state.shown=72;renderCategories();updateFilters();}});
$('item-grid').addEventListener('click',event=>{const b=event.target.closest('[data-id]');if(b)showItem(b.dataset.id);});
$('featured').addEventListener('click',()=>showItem($('featured').dataset.id));
function warmItem(id) {
  const item=state.items.find(item=>item.id===String(id));
  if(item)prefetchAnimation(animation(item));
}
function intentTarget(event) { return event.target.closest('[data-id]'); }
for(const id of ['item-grid','featured']) {
  const container=$(id);
  container.addEventListener('pointerover',event=>{
    const target=intentTarget(event);if(!target||target.contains(event.relatedTarget)||event.pointerType==='touch')return;
    clearTimeout(intentTimer);intentTimer=setTimeout(()=>warmItem(target.dataset.id),180);
  });
  container.addEventListener('pointerout',event=>{const target=intentTarget(event);if(target&&!target.contains(event.relatedTarget))clearTimeout(intentTimer);});
  container.addEventListener('focusin',event=>{const target=intentTarget(event);if(target)warmItem(target.dataset.id);});
  container.addEventListener('pointerdown',event=>{const target=intentTarget(event);if(target){clearTimeout(intentTimer);warmItem(target.dataset.id);}}, {passive:true});
}
for(const [id,delta] of [['previous-item',-1],['next-item',1]]) {
  const warmNext=()=>{const list=selectedList(),index=list.findIndex(item=>item.id===state.selected?.id);if(index>=0&&list.length>1)warmItem(list[(index+delta+list.length)%list.length].id);};
  $(id).addEventListener('pointerenter',()=>{clearTimeout(intentTimer);intentTimer=setTimeout(warmNext,180);});
  $(id).addEventListener('pointerleave',()=>clearTimeout(intentTimer));
  $(id).addEventListener('focus',warmNext);
}
$('item-search').addEventListener('input',()=>{state.search=$('item-search').value.trim();state.shown=72;updateFilters();});
for(const [id,key] of [['rarity-filter','rarity'],['motion-filter','motion'],['sort-order','sort']])$(id).addEventListener('change',()=>{state[key]=$(id).value;state.shown=72;updateFilters();});
$('favorites-only').addEventListener('click',()=>{state.favoritesOnly=!state.favoritesOnly;state.shown=72;updateFilters();});
$('clear-filters').addEventListener('click',resetFilters);$('reset-empty').addEventListener('click',resetFilters);
$('load-more').addEventListener('click',()=>{state.shown+=72;renderGrid();});
$('favorite-item').addEventListener('click',()=>{const id=state.selected?.id;if(!id)return;if(favorites.has(id))favorites.delete(id);else favorites.add(id);const saved=saveFavorites();renderFavorite();updateFilters();updatePreviousNext();$('item-action-status').textContent=saved?(favorites.has(id)?'已加入本机收藏。':'已取消收藏。'):'浏览器无法保存，收藏仅在本次页面有效。';});
$('copy-item-link').addEventListener('click',async()=>{const url=new URL(location.href);url.hash=`item=${encodeURIComponent(state.selected.id)}`;try{await navigator.clipboard.writeText(url.href);$('item-action-status').textContent='已复制这件物资的链接。';}catch{$('item-action-status').textContent=`可以复制地址栏链接：${url.href}`;}});
$('item-tv-link').addEventListener('click',()=>{const url=new URL('tv-wall.html?v=20261117-disc-panel-launch-1',location.href),lang=new URLSearchParams(location.search).get('lang');if(lang)url.searchParams.set('lang',lang);url.hash=`item=${encodeURIComponent(state.selected.id)}`;location.href=url.pathname+url.search+url.hash;});
$('previous-item').addEventListener('click',()=>stepItem(-1));$('next-item').addEventListener('click',()=>stepItem(1));
$('close-item').addEventListener('click',()=>$('item-dialog').close());
$('item-dialog').addEventListener('close', () => {
  if ($('item-dialog').open) return;
  const closedId = state.selected?.id;
  disposeMedia();
  state.selected = null;
  const url = new URL(location.href);
  if (new URLSearchParams(url.hash.slice(1)).get('item') !== closedId) return;
  if (history.state?.galleryFromList) history.back();
  else {
    // A shared item link has no gallery list entry to go back to.
    url.hash = '';
    history.replaceState(history.state, '', url);
  }
});
$('media-static').addEventListener('click',()=>setMedia('static'));$('media-dynamic').addEventListener('click',()=>setMedia('dynamic'));
$('media-play').addEventListener('click',()=>{if(player?.playing)player.pause();else player?.play();playbackControls();});
$('media-enlarge').addEventListener('click',()=>{const enlarged=$('exhibit-stage').classList.toggle('enlarged');$('media-enlarge').setAttribute('aria-pressed',String(enlarged));$('media-enlarge').textContent=enlarged?'适合窗口':'放大查看';});
$('about-open').addEventListener('click',()=>$('about-dialog').showModal());$('about-close').addEventListener('click',()=>$('about-dialog').close());
for(const id of ['item-dialog','about-dialog'])$(id).addEventListener('click',event=>{if(event.target!==$(id))return;const r=$(id).getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$(id).close();});
reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches){player?.pause();playbackControls();}});
window.addEventListener('pagehide',disposeMedia);
window.addEventListener('dukelanguagechange',()=>{if(state.ready){updateFilters();updatePreviousNext();}});
window.addEventListener('pageshow',event=>{if(event.persisted&&$('item-dialog').open&&state.selected)setMedia(currentMedia);});
function syncItemFromURL() {
  if (!state.ready) return;
  const id = new URLSearchParams(location.hash.slice(1)).get('item');
  if (id && state.items.some(item => item.id === id)) {
    if (!$('item-dialog').open || state.selected?.id !== id) showItem(id, {updateURL:false});
  } else if ($('item-dialog').open) $('item-dialog').close();
}
window.addEventListener('hashchange', syncItemFromURL);
$('retry-load').addEventListener('click',init);
window.itemGallery={state,showItem,getPlayback:()=>player?{playing:player.playing,frame:player.frame,count:player.count,fps:player.fps}:null};
init();

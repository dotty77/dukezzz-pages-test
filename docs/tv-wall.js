/* The TV dimensions use client catalog prices. Video frames are unchanged. */
const $ = id => document.getElementById(id);
const room = $('wall-room'), stage = $('wall-stage'), grid = $('wall-grid'), surface = $('wall-surface');
const dialog = $('wall-dialog'), focusVideo = $('wall-focus-video');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const state = { records: [], units: new Map(), visible: [], zoom: 1, worldWidth: 0, worldHeight: 0,
  paused: reduceMotion.matches, loading: true, error: false, active: null, mode: 'loading', pending: 0, viewportTimer: 0, overview: false };
const words = {
  atlas:['物资图鉴','Item Archive'],tvWall:['电视墙','TV Wall'],location:['奥蒙德研究站 · 仓储枢纽','Omond Research Station · Depot Hub'],
  headline:['收获，正在放映。','Your finds. Now showing.'],description:['金额越高，屏幕越大。','Higher value, bigger screen.'],
  channels:['个频道','channels'],original:['游戏原始动画','Original game animations'],allPrices:['全部金额','All values'],
  million:['100 万及以上','1,000,000 and above'],gold:['50 万至 100 万','500,000–999,999'],other:['50 万以下','Below 500,000'],
  pause:['暂停','Pause'],play:['播放','Play'],overview:['看全墙','View all'],closeView:['返回近景','Close-up'],fullscreen:['全屏','Fullscreen'],exitFullscreen:['退出全屏','Exit fullscreen'],
  loading:['正在接通信号…','Connecting the signals…'],loadingNote:['电视即将亮起','Your screens will light up shortly.'],retry:['重新连接','Reconnect'],
  browseHint:['滚动或拖动浏览 · 点击电视放大','Scroll or drag to explore · Click a TV to enlarge'],reset:['复位','Reset'],
  sizingNote:['电视大小按图鉴金额递增展示，非面积等比例。','TV sizes increase with catalog value; screen area is not proportional to price.'],
  sourceTitle:['关于这些画面','About these screens'],sourceNote:['来自游戏客户端的电视宣传序列帧，保留原画面中的文字、金额与转场。预览按 24 帧/秒循环，游戏原始播放速度尚未确认。界面名称和金额采用物资图鉴数据。','TV promotional frames from the game client, retaining the original text, prices and transitions. Loops play at 24 fps for this presentation; the in-game playback rate has not been confirmed. Interface names and values come from the Item Atlas.'],
  fanTool:['玩家自制工具','Fan-made tool'],viewItem:['查看物资档案 ↗','View item details ↗'],search:['搜索一个频道…','Find a channel…'],searchLabel:['搜索物资名称或编号','Search item name or ID'],
  priceLabel:['筛选金额','Filter by value'],stageLabel:['电视墙，滚动或拖动浏览','TV wall. Scroll or drag to explore.'],roomLabel:['动态电视墙','Animated TV wall'],zoomLabel:['电视墙缩放','TV wall zoom'],
  smaller:['缩小','Zoom out'],larger:['放大','Zoom in'],close:['关闭','Close'],noSignal:['暂时没有接通信号','Could not connect'],
  errorNote:['请检查网络后重新连接。','Check your connection and try again.'],empty:['没有找到这个频道','No matching channels'],emptyNote:['试试其他名称，或切回全部金额。','Try another name or select all values.'],
  standby:['待展示屏幕','Standby screen'],blocked:['点按播放继续观看','Press Play to continue'],videoError:['画面暂不可用，请稍后重试。','This video is unavailable. Please try again later.'],
  videoNote:['原始画面 · 静音循环','Original frames · Silent loop'],
  prevChannel:['上一个频道','Previous channel'],nextChannel:['下一个频道','Next channel'],
  copyLink:['复制链接','Copy link'],linkCopied:['已复制链接','Link copied'],copyFailed:['请复制地址栏链接','Copy the address bar link']
};
const english = () => window.DUKE_I18N?.language === 'en';
const t = key => words[key]?.[english() ? 1 : 0] ?? key;
const nameOf = record => english() ? record.nameEn || record.name : record.name;
const money = value => value == null ? t('standby') : new Intl.NumberFormat(english() ? 'en-US' : 'zh-CN').format(value);
function copy(element, key) { element.textContent = t(key); }
function linkLanguage(href) { const url = new URL(href, location.href); if (english() || new URLSearchParams(location.search).has('lang')) url.searchParams.set('lang', english() ? 'en' : 'zh-CN'); return url.pathname + url.search + url.hash; }

function renderLanguage() {
  document.querySelectorAll('[data-copy]').forEach(node => copy(node, node.dataset.copy));
  document.title = `${t('tvWall')} · DUKE`;
  $('wall-search').placeholder = t('search');
  for (const [id, key] of [['wall-search','searchLabel'],['wall-price','priceLabel'],['wall-stage','stageLabel'],['wall-room','roomLabel'],['wall-zoom','zoomLabel'],['wall-minus','smaller'],['wall-plus','larger'],['wall-dialog-close','close'],['wall-prev','prevChannel'],['wall-next','nextChannel']]) $(id).setAttribute('aria-label',t(key));
  document.querySelector('.wall-breadcrumb a').href = linkLanguage('gallery.html?v=20261117-team-lazy-beta-launch-1');
  for (const [code, unit] of state.units) {
    const record = state.records.find(record => record.code === code);
    unit.querySelector('.tv-name').textContent = nameOf(record);
    unit.querySelector('.tv-price').textContent = record.price == null ? '—' : money(record.price);
    // The standby screen has no value; its name alone avoids reading "standby" twice.
    const label = record.price == null ? nameOf(record) : `${nameOf(record)} · ${money(record.price)}`;
    unit.setAttribute('aria-label',label); unit.title = label;
  }
  renderButtons(); renderStatus();
  if (state.active) renderFocus(state.active);
  if (!state.loading && !state.error) applyFilters(false);
}

function renderButtons() {
  // The label already names the action, so the button carries no aria-pressed state as well.
  const play = $('wall-play'); play.dataset.state = state.paused ? 'paused' : 'playing';
  copy(play.querySelector('span'),state.paused ? 'play' : 'pause');
  copy($('wall-fullscreen').querySelector('span'), document.fullscreenElement ? 'exitFullscreen' : 'fullscreen');
  copy($('wall-fit').querySelector('span'), state.overview ? 'closeView' : 'overview');
}
function renderStatus() {
  const mode = state.loading ? 'loading' : state.error ? 'error' : state.visible.length ? 'ready' : 'empty';
  state.mode = mode;
  const panel = $('wall-state'); panel.dataset.mode = mode; panel.hidden = mode === 'ready';
  stage.classList.toggle('has-empty',mode === 'empty');
  if (mode !== 'ready') {
    copy(panel.querySelector('h2'),mode === 'loading' ? 'loading' : mode === 'error' ? 'noSignal' : 'empty');
    copy(panel.querySelector('p'),mode === 'loading' ? 'loadingNote' : mode === 'error' ? 'errorNote' : 'emptyNote');
  }
  $('wall-retry').hidden = mode !== 'error';
  $('wall-count').textContent = state.records.length ? `${state.visible.length} / ${state.records.length}` : '— / —';
  $('channel-total').textContent = state.records.length || '—';
  for (const id of ['wall-fit','wall-plus','wall-minus','wall-reset']) $(id).disabled = mode !== 'ready';
}

function makeUnit(record) {
  const unit = document.createElement('button'); unit.type = 'button'; unit.className = 'tv-unit';
  unit.dataset.code = record.code; unit.dataset.price = record.price ?? '';
  unit.dataset.case = Number(record.code) % 4;
  unit.dataset.tier = record.price >= 3000000 ? 'top' : record.price >= 500000 ? 'high' : 'normal';
  unit.dataset.antenna = Number(record.code) % 7 === 3;
  unit.innerHTML = '<span class="tv-antenna" aria-hidden="true"></span><span class="tv-chassis"><span class="crt-screen"><video muted playsinline loop preload="none" aria-hidden="true"></video><span class="screen-vignette" aria-hidden="true"></span></span><span class="tv-controls" aria-hidden="true"><span class="tv-dial"></span><span class="tv-dial"></span><span class="tv-speaker"></span><span class="tv-power"></span></span><i class="tv-screw" aria-hidden="true"></i><i class="tv-screw" aria-hidden="true"></i><i class="tv-screw" aria-hidden="true"></i><span class="tv-stencil" aria-hidden="true"></span><span class="tv-feet" aria-hidden="true"></span></span><span class="tv-caption"><span class="tv-name"></span><span class="tv-price"></span></span>';
  unit.querySelector('.tv-stencil').textContent = `DUKE  /  CH.${record.code}`;
  // Posters load with the playback window (syncPlayback), not all 63 at once.
  const video = unit.querySelector('video'); video.muted = true;
  video.addEventListener('loadedmetadata',() => {
    if (!video.duration || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.min(video.duration - .04, unit.resumeAt ?? (Number(record.code) * 1.731) % video.duration);
  });
  video.addEventListener('playing',() => { unit.classList.add('is-playing'); unit.classList.remove('has-error'); });
  video.addEventListener('pause',() => unit.classList.remove('is-playing'));
  video.addEventListener('error',() => { if (video.getAttribute('src')) unit.classList.add('has-error'); });
  unit.addEventListener('click',() => openFocus(record));
  unit.record = record;
  return unit;
}

// Bottom-left skyline packing, with the largest screen centered. Every price
// uses the same strictly increasing width function, including under filters.
// Phone-width walls give the top screen most of the width and fill from the left,
// so screens below about 500,000 sit two to a row and the wall only scrolls vertically.
const NARROW_WALL = 600;
function pack(records, width) {
  const narrow = width < NARROW_WALL;
  const pad = narrow ? 12 : 26, gap = narrow ? 12 : 19, usable = width - pad * 2;
  const peak = narrow ? usable * .9 : Math.min(680,usable * .39);
  const placed = [];
  for (const [index, record] of records.entries()) {
    const relative = record.price == null ? .27 : .28 + .72 * Math.sqrt(record.price / 3000000);
    const w = peak * relative, h = w * .71 + 35;
    const candidates = new Set([pad, width - pad - w, (width - w) / 2]);
    for (const box of placed) { candidates.add(box.x); candidates.add(box.x + box.w + gap); candidates.add(box.x - w - gap); }
    let best = null;
    for (const x of candidates) {
      if (x < pad - .01 || x + w > width - pad + .01) continue;
      let y = 34;
      for (const box of placed) {
        if (x < box.x + box.w + gap - .1 && x + w + gap > box.x + .1) y = Math.max(y,box.y + box.h + gap);
      }
      const score = narrow ? y * 10000 + x : y * 10000 + Math.abs(x + w / 2 - width / 2) + (index % 2 ? x * .001 : -x * .001);
      if (!best || score < best.score) best = {x,y,w,h,code:record.code,score};
    }
    if (!best) throw Error('Unable to place TV');
    placed.push(best);
  }
  return {boxes: placed,height: Math.max(420,...placed.map(box=>box.y+box.h+42))};
}
function applyFilters(resetPosition = true) {
  const query = $('wall-search').value.trim().toLocaleLowerCase();
  const filter = $('wall-price').value;
  state.visible = state.records.filter(record => {
    const searchText = `${record.name} ${record.nameEn} ${record.code} ${record.itemId || ''}`.toLocaleLowerCase();
    return (!query || searchText.includes(query)) && (filter === 'all' || record.price != null &&
      (filter === 'million' ? record.price >= 1000000 : filter === 'gold' ? record.price >= 500000 && record.price < 1000000 : record.price < 500000));
  }).sort((a,b)=>(b.price ?? -1) - (a.price ?? -1) || a.code.localeCompare(b.code));
  const showing = new Set(state.visible.map(record=>record.code));
  for (const [code,unit] of state.units) { unit.hidden = !showing.has(code); if (unit.hidden) release(unit); }
  layout(resetPosition); renderStatus();
}
function layout(resetPosition = false) {
  // The wall is laid out at the stage's real width, so phones and tablets never scroll sideways.
  const width = Math.max(200,stage.clientWidth);
  const layout = pack(state.visible,width);
  const changedWidth = state.worldWidth && Math.abs(state.worldWidth-width)>1;
  state.worldWidth = width; state.worldHeight = layout.height;
  grid.style.width = `${width}px`; grid.style.height = `${layout.height}px`;
  grid.dataset.layout = width < NARROW_WALL ? 'narrow' : 'wide';
  for (const box of layout.boxes) {
    const unit = state.units.get(box.code);
    Object.assign(unit.style,{left:`${box.x}px`,top:`${box.y}px`,width:`${box.w}px`,height:`${box.h}px`});
    unit.box = box;
  }
  // Keep keyboard order equal to the visual order (largest first, top to bottom).
  const order = state.visible.map(record=>state.units.get(record.code));
  const current = [...grid.children].filter(node=>node.classList.contains('tv-unit')&&!node.hidden);
  if (order.some((unit,index)=>current[index]!==unit)) grid.append(...order);
  if (state.overview) state.zoom = Math.min(1,stage.clientWidth / width,stage.clientHeight / layout.height);
  applyZoom(resetPosition || changedWidth);
}
function applyZoom(resetPosition = false) {
  const z = state.zoom, previous = Number(surface.dataset.zoom) || z;
  const center = {x:(stage.scrollLeft + stage.clientWidth / 2)/previous,y:(stage.scrollTop + stage.clientHeight / 2)/previous};
  grid.style.transform = `scale(${z})`; grid.style.setProperty('--z', z); surface.style.width = `${state.worldWidth*z}px`; surface.style.height = `${state.worldHeight*z}px`; surface.dataset.zoom = z;
  if (resetPosition) { stage.scrollTop = 0; stage.scrollLeft = Math.max(0,(state.worldWidth*z-stage.clientWidth)/2); }
  else { stage.scrollLeft = center.x*z-stage.clientWidth/2; stage.scrollTop = center.y*z-stage.clientHeight/2; }
  $('wall-zoom').value = z; $('wall-zoom').setAttribute('aria-valuetext',`${Math.round(z*100)}%`); $('wall-zoom-value').textContent = `${Math.round(z*100)}%`;
  renderButtons(); schedulePlayback();
}
function setZoom(zoom) { state.overview=false;state.zoom=Math.min(1.4,Math.max(.05,zoom));applyZoom(); }
function resetView() { state.overview=false;state.zoom=1;applyZoom(true); }

function release(unit) {
  const video = unit.querySelector('video');
  video.pause();
  if (!video.getAttribute('src')) return;
  unit.resumeAt = video.currentTime || unit.resumeAt;
  video.removeAttribute('src'); video.load(); unit.classList.remove('is-playing');
}
function schedulePlayback() { clearTimeout(state.viewportTimer); state.viewportTimer=setTimeout(syncPlayback,80); }
// Thumbnail-sized TVs (whole-wall view) keep their poster, and only the screens nearest the
// middle of the view play, so zooming out never starts dozens of downloads and decoders.
const MIN_PLAY_WIDTH=60, MAX_PLAYING=12;
function syncPlayback() {
  if (state.loading || state.error) return;
  const boundary=stage.getBoundingClientRect();
  const top=Math.max(boundary.top,0),bottom=Math.min(boundary.bottom,innerHeight),left=Math.max(boundary.left,0),right=Math.min(boundary.right,innerWidth);
  const centerX=(left+right)/2,centerY=(top+bottom)/2;
  const running=!state.paused&&!document.hidden&&!dialog.open;
  const measurements=state.visible.map(record=>{const unit=state.units.get(record.code);return {unit,box:unit.getBoundingClientRect()};});
  const candidates=[];
  for (const {unit,box} of measurements) {
    const onScreen=box.bottom>top+8&&box.top<bottom-8&&box.right>left+8&&box.left<right-8&&bottom>top;
    const nearby=box.bottom>top-240&&box.top<bottom+240&&box.right>left-180&&box.left<right+180;
    const video=unit.querySelector('video');
    if (nearby && !unit.hidden && !video.getAttribute('poster')) video.poster=unit.record.poster;
    if (!nearby || unit.hidden || state.overview || box.width<MIN_PLAY_WIDTH) { release(unit); continue; }
    if (!running||!onScreen) { video.pause();continue; }
    candidates.push({unit,video,distance:Math.hypot(box.left+box.width/2-centerX,box.top+box.height/2-centerY)});
  }
  candidates.sort((a,b)=>a.distance-b.distance);
  for (const [index,{unit,video}] of candidates.entries()) {
    if (index>=MAX_PLAYING) { video.pause();continue; }
    if (!video.getAttribute('src')) { video.src=unit.record.video; video.load(); }
    if (video.paused) video.play().catch(error=>{
      if (error.name==='NotAllowedError') { state.paused=true;renderButtons();syncPlayback(); }
    });
  }
}

function renderFocus(record) {
  $('wall-dialog-title').textContent=nameOf(record);$('wall-dialog-price').textContent=record.price==null ? '' : money(record.price);
  $('wall-dialog-channel').textContent=`DUKE / CHANNEL ${record.code}`;
  const link=$('wall-item-link');link.hidden=!record.itemId;link.href=linkLanguage(`gallery.html?v=20261114-refresh-launch-1#item=${record.itemId || ''}`);
  copy($('wall-dialog-status'),'videoNote');
  // Some promo frames print another item's caption; the note says so instead of changing the catalog data.
  const note=$('wall-dialog-note'),frameText=record.frameTextNote;
  note.hidden=!frameText;note.textContent=frameText ? (english() ? frameText.en : frameText.zh) : '';
  copy($('wall-copy-link'),'copyLink');
}
// #item=<itemId> matches the item archive's links; the standby screen (no item) uses #ch=<code>.
const hashFor = record => record.itemId ? `item=${record.itemId}` : `ch=${record.code}`;
function writeHash(record) {
  const url=new URL(location.href);url.hash=record ? hashFor(record) : '';
  history.replaceState(history.state,'',record ? url : url.pathname+url.search);
}
function recordFromHash() {
  const params=new URLSearchParams(location.hash.slice(1)),item=params.get('item'),channel=params.get('ch');
  return state.records.find(record=>item&&String(record.itemId)===item||channel&&record.code===channel) || null;
}
function openFocus(record) {
  state.active=record;renderFocus(record);focusVideo.poster=record.poster;focusVideo.src=record.video;focusVideo.muted=true;
  if (!dialog.open) { dialog.showModal();syncPlayback(); }
  focusHidePaused=false;
  if (!state.paused) playFocus();
  writeHash(record);
}
// Previous/next follow the wall's current order, search and value filter included, and wrap around.
function stepFocus(delta) {
  const list=state.visible.length ? state.visible : state.records;
  const index=list.findIndex(record=>record.code===state.active?.code);
  // A channel opened by link may sit outside the filter; step into the list from its nearest end.
  const next=index<0 ? list[delta>0 ? 0 : list.length-1] : list[(index+delta+list.length)%list.length];
  if (next && next!==state.active) openFocus(next);
}
// A failed video reports through its error event; only an autoplay block asks for a tap.
function playFocus() { focusVideo.play().catch(error=>{if(error.name==='NotAllowedError')copy($('wall-dialog-status'),'blocked');}); }
// Hiding the tab pauses the close-up; only that pause is undone on return, not one the viewer chose.
let focusHidePaused=false;
function pauseFocusForHide() { if(!focusVideo.paused){focusHidePaused=true;focusVideo.pause();} }
function resumeFocus() {
  if(document.hidden)return;
  if(focusHidePaused&&dialog.open&&!state.paused&&focusVideo.getAttribute('src')&&focusVideo.paused)playFocus();
  focusHidePaused=false;
}
function closeFocus() { dialog.close(); }
dialog.addEventListener('close',()=>{focusVideo.pause();focusVideo.removeAttribute('src');focusVideo.load();state.active=null;writeHash(null);schedulePlayback();});
focusVideo.addEventListener('error',()=>{if(focusVideo.getAttribute('src'))copy($('wall-dialog-status'),'videoError');});
$('wall-dialog-close').addEventListener('click',closeFocus);
dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeFocus();});
$('wall-prev').addEventListener('click',()=>stepFocus(-1));$('wall-next').addEventListener('click',()=>stepFocus(1));
// ←/→ and PageUp/PageDown change channel; the native video controls keep their own arrow keys.
dialog.addEventListener('keydown',event=>{
  if(event.target===focusVideo||event.altKey||event.ctrlKey||event.metaKey)return;
  const delta={ArrowLeft:-1,PageUp:-1,ArrowRight:1,PageDown:1}[event.key];
  if(delta){event.preventDefault();stepFocus(delta);}
});
// A horizontal swipe across the screen changes channel on touch devices.
let swipe=null;
// The bottom strip is left to the native timeline, so scrubbing never changes channel.
$('wall-focus-screen').addEventListener('pointerdown',event=>{const r=event.currentTarget.getBoundingClientRect();if(event.pointerType==='touch'&&event.clientY<r.bottom-56)swipe={x:event.clientX,y:event.clientY};});
$('wall-focus-screen').addEventListener('pointerup',event=>{
  if(!swipe)return;const dx=event.clientX-swipe.x,dy=event.clientY-swipe.y;swipe=null;
  if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.5)stepFocus(dx<0?1:-1);
});
$('wall-focus-screen').addEventListener('pointercancel',()=>{swipe=null;});
$('wall-copy-link').addEventListener('click',async()=>{
  const button=$('wall-copy-link'),url=location.href;let copied=false;
  try{await navigator.clipboard.writeText(url);copied=true;}catch{
    const field=document.createElement('textarea');field.value=url;field.setAttribute('readonly','');field.style.position='fixed';field.style.opacity='0';
    dialog.append(field);field.select();try{copied=document.execCommand('copy');}catch{/* fall through to the hint */}field.remove();button.focus({preventScroll:true});
  }
  copy(button,copied?'linkCopied':'copyFailed');setTimeout(()=>copy(button,'copyLink'),1600);
});
window.addEventListener('hashchange',()=>{
  if(state.loading||state.error)return;
  const record=recordFromHash();
  if(record&&record!==state.active)openFocus(record);else if(!record&&dialog.open)closeFocus();
});

async function load() {
  const request=++state.pending;state.loading=true;state.error=false;renderStatus();
  try {
    const response=await fetch('assets/tv-wall/manifest.json?v=20261021-v33-launch-1');
    if(!response.ok)throw Error(`Manifest ${response.status}`);
    const records=await response.json();
    if(!Array.isArray(records)||!records.length||records.some(record=>!/^\d{3}$/.test(record.code)||!record.video?.startsWith('assets/tv-wall/')||!record.poster?.startsWith('assets/tv-wall/')||record.price!=null&&(!Number.isFinite(record.price)||record.price<0)))throw Error('Invalid TV catalog');
    if(request!==state.pending)return;
    for(const unit of state.units.values()){release(unit);unit.remove();}state.units.clear();state.records=records;
    const fragment=document.createDocumentFragment();for(const record of records){const unit=makeUnit(record);state.units.set(record.code,unit);fragment.append(unit);}grid.append(fragment);
    state.loading=false;applyFilters(true);renderLanguage();stage.dataset.ready='true';
    const shared=recordFromHash();if(shared)openFocus(shared);
  } catch(error) { if(request!==state.pending)return;state.loading=false;state.error=true;renderStatus();console.error('TV wall could not load',error); }
}

$('wall-search').addEventListener('input',()=>applyFilters());$('wall-price').addEventListener('change',()=>applyFilters());
$('wall-retry').addEventListener('click',load);
$('wall-play').addEventListener('click',()=>{state.paused=!state.paused;renderButtons();syncPlayback();});
$('wall-zoom').addEventListener('input',event=>setZoom(Number(event.target.value)));
$('wall-minus').addEventListener('click',()=>setZoom(state.zoom-.1));$('wall-plus').addEventListener('click',()=>setZoom(state.zoom+.1));$('wall-reset').addEventListener('click',resetView);
$('wall-fit').addEventListener('click',()=>{if(state.overview){resetView();return;}state.overview=true;state.zoom=Math.min(1,stage.clientWidth/state.worldWidth,stage.clientHeight/state.worldHeight);applyZoom(true);});
$('wall-fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(room.requestFullscreen)await room.requestFullscreen();}catch{/* Some embedded browsers do not expose fullscreen; the wall remains usable. */}});
if(!room.requestFullscreen)$('wall-fullscreen').hidden=true;
// Only the wall's own fullscreen re-lays out the wall; the close-up video's native fullscreen keeps the dialog.
// Track the room's state, because a single Esc that leaves nested fullscreen only notifies the innermost element.
let roomFullscreen=false;
document.addEventListener('fullscreenchange',()=>{
  renderButtons();
  const now=document.fullscreenElement===room||roomFullscreen&&!!document.fullscreenElement;
  if(now===roomFullscreen)return;
  roomFullscreen=now;if(dialog.open)closeFocus();requestAnimationFrame(()=>{layout(true);renderButtons();});
});
stage.addEventListener('scroll',schedulePlayback,{passive:true});window.addEventListener('scroll',schedulePlayback,{passive:true});
// Zoom animates the surface width; rank the screens again once it has settled.
surface.addEventListener('transitionend',event=>{if(event.target===surface)schedulePlayback();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseFocusForHide();else resumeFocus();syncPlayback();});
window.addEventListener('pagehide',()=>{for(const unit of state.units.values())release(unit);pauseFocusForHide();});
window.addEventListener('pageshow',()=>{resumeFocus();schedulePlayback();});
reduceMotion.addEventListener('change',event=>{if(event.matches){state.paused=true;renderButtons();syncPlayback();}});
window.addEventListener('dukelanguagechange',renderLanguage);window.addEventListener('dukelanguageready',renderLanguage);
// While the close-up video is fullscreen the page scrollbar disappears; keep the wall where it was.
new ResizeObserver(()=>{clearTimeout(state.resizeTimer);state.resizeTimer=setTimeout(()=>{if(!state.loading&&!state.error&&!(document.fullscreenElement&&document.fullscreenElement!==room))layout();},100);}).observe(stage);

// Desktop drag-to-pan leaves touch scrolling and keyboard button activation native.
let drag=null,suppressClick=false;
stage.addEventListener('pointerdown',event=>{if(event.pointerType!=='mouse'||event.button!==0)return;drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:stage.scrollLeft,top:stage.scrollTop,moved:false};});
stage.addEventListener('pointermove',event=>{
  if(!drag)return;
  // The button was released outside the wall before the drag captured the pointer.
  if(!(event.buttons&1)){finishDrag();return;}
  const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
  if(!drag.moved&&Math.hypot(dx,dy)>5){drag.moved=true;stage.setPointerCapture(drag.id);stage.classList.add('is-dragging');}
  if(drag.moved){event.preventDefault();stage.scrollLeft=drag.left-dx;stage.scrollTop=drag.top-dy;}
});
const finishDrag=()=>{if(!drag)return;suppressClick=drag.moved;if(stage.hasPointerCapture(drag.id))stage.releasePointerCapture(drag.id);stage.classList.remove('is-dragging');drag=null;setTimeout(()=>suppressClick=false,0);};
stage.addEventListener('pointerup',finishDrag);stage.addEventListener('pointercancel',finishDrag);stage.addEventListener('lostpointercapture',finishDrag);
stage.addEventListener('click',event=>{if(suppressClick){event.preventDefault();event.stopPropagation();}},{capture:true});
renderLanguage();load();

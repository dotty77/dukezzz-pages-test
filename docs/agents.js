import portraitAssets from './agent-card-portraits.js?v=20261107-refresh-launch-1';
import {renderGraduation} from './agent-graduation.js?v=20261107-refresh-launch-1';
import {betaTabsFor,renderBetaTab} from './agent-beta.js?v=20261114-refresh-launch-1';
const $ = id => document.getElementById(id);
const el = (tag, cls = '', text = '') => { const node = document.createElement(tag); node.className = cls; node.textContent = text; return node; };
const tabs = [['intro','角色介绍'],['graduation','毕业面板'],['skills','技能'],['cinema','影画'],['engine','专属音擎'],['discs','驱动盘']];
const agentTabs = agent => [...(agent.officialPreview ? [tabs[0]] : tabs),...(agent.beta ? betaTabsFor(agent.beta) : [])];
const rankLabel = agent => agent.rank ? `${agent.rank} 级` : '';
const filterRank = agent => agent.rank || agent.beta?.rank || '';
const previewFilter = 'official-preview';
const betaFilter = 'beta';
const betaVersion = agent => String(agent.beta?.source?.version || '').match(/\d+\.\d+/)?.[0] || '';
const betaLabel = agent => `${betaVersion(agent) ? betaVersion(agent)+' ' : ''}${agent.beta?.kind==='changes' ? '测试服变化' : '测试服资料'}`;
const bilingual = (tag,cls,zh,en) => {const node=el(tag,cls,zh);node.dataset.i18nEn=en;return node;};
// Archive links use X.Y.0, while preview dossiers may store X.Y.
function debutVersion(value) {
  const match = /^(\d+\.\d+)(?:\.\d+)?$/.exec(value || '');
  return match ? match[1] + '.0' : '';
}
function matchesVersion(agent,value) {
  if(!value)return true;
  if(value==='released')return !agent.officialPreview;
  if(value===previewFilter)return !!agent.officialPreview;
  if(value===betaFilter)return !!agent.beta;
  return debutVersion(agent.introducedVersion) === value;
}
const colors = {物理:'#b59b64',火:'#d97657',冰:'#63acbc',电:'#9578c4',以太:'#b677a8',烈霜:'#67a1bd',玄墨:'#8266b3',风:'#67ad91',流明:'#c5a56a'};
let roster = [], equipment = {}, builds = {}, catalog = {}, selected = null, selectedTab = 'intro', opener = null;
let version = '', graduation = {}, detailsBytes = 0, detailGeneration = 0;
const assets = {
  directory:'agent-previews.json?v=20261119-v34-preview-launch-1',
  details:'agent-details.json?v=20261111-refresh-launch-1',
  equipment:'agent-equipment.json?v=20261111-refresh-launch-1',
  builds:'agent-builds.json?v=20261111-refresh-launch-1',
  graduation:'agent-graduation.json?v=20261027-agents-launch-1',
  beta:'agent-beta.json?v=20261117-team-lazy-beta-launch-1',
};
const downloads = new Map(), failures = new Set();
const dialog = $('agent-dialog');
const text = value => typeof value === 'string' ? value : value == null ? '' : String(value);
const color = agent => colors[agent.element?.replace('属性','')] || '#8791c9';
function localized(tag,cls,zh,en) {
  const node=el(tag,cls);setLocalizedText(node,zh,en);return node;
}
function setLocalizedText(node,zh,en) {
  if(typeof en==='string' && en.trim())node.dataset.i18nEn=en;else delete node.dataset.i18nEn;
  node.textContent=text(zh);
}
const prose = (value,valueEn) => localized('p','agent-prose',text(value),valueEn);
function sourceLink(source) {
  const link=localized('a','agent-beta-link','查看 Gachabase 原文 ↗','View Gachabase source ↗');
  for(const [key,value] of [['sourceZh',source?.url],['sourceEn',source?.urlEn]]) {
    try{const url=new URL(value);if(url.protocol==='https:' && url.hostname==='zzz.gachabase.net')link.dataset[key]=url.href;}catch{}
  }
  if(!link.dataset.sourceZh)return new DocumentFragment();
  link.href=window.DUKE_I18N.language==='en' && link.dataset.sourceEn ? link.dataset.sourceEn : link.dataset.sourceZh;
  link.target='_blank';link.rel='noopener noreferrer';return link;
}
function releaseSource(source) {
  const box=el('div','agent-release-source');
  if(source?.provider!=='Gachabase')return box;
  box.append(localized('strong','',`Gachabase · ${source.version} 正式服`,`Gachabase · ${source.version} release`));
  const revision=`${source.version} · D ${source.revision} / R ${source.resourceRevision}`;
  const details=el('details','agent-source-fold');details.append(localized('summary','','来源与修订','Source and revision'),localized('p','agent-source-note',`${revision} · 核对：${source.checkedAt}`,`${revision} · Checked: ${source.checkedAt}`),sourceLink(source));box.append(details);
  return box;
}
const note = value => el('p', 'agent-section-note', value);
const values = value => Array.isArray(value) ? value : value ? [value] : [];
// Lossless preview assets: byte ranges are verified before becoming browser URLs.
let previewBundles = null;
const packedPictures = new Map(), packedImageCache = new Map();
let packedImageBytes = 0;
const packedImageLimit = 24 * 1024 * 1024;
const packedImageObserver = new IntersectionObserver(entries => {
  for(const entry of entries)if(entry.isIntersecting){
    packedImageObserver.unobserve(entry.target);
    packedPictures.get(entry.target)?.start();
  }
}, {rootMargin:'120px'});
function installPreviewBundles(index) {
  index={version:index?.version??1,bundles:[...(index?.bundles||[]),...portraitAssets.bundles],assets:{...(index?.assets||{}),...portraitAssets.assets}};
  const validHash=value=>/^[a-f0-9]{64}$/.test(value || '');
  if(index.version!==1 || !Array.isArray(index.bundles) || !index.assets || typeof index.assets!=='object')throw new Error('Invalid media index');
  const packs=new Map();
  for(const pack of index.bundles){
    if(!/^assets\/agent-previews\/bundles\/[\w-]+\.bin$/.test(pack.path || '') || packs.has(pack.path) || !Number.isSafeInteger(pack.bytes) || pack.bytes<=0 || pack.bytes>24*1024*1024 || !validHash(pack.sha256))throw new Error('Invalid media container');
    packs.set(pack.path,pack);
  }
  for(const [path,asset] of Object.entries(index.assets)){
    if(!/^assets\/agent-previews\/[\w/-]+\.(?:png|jpe?g|webp|gif|mp4)$/.test(path) || !Number.isSafeInteger(asset.bytes) || asset.bytes<=0 || asset.bytes>64*1024*1024 || !validHash(asset.sha256) || !Array.isArray(asset.parts) || !asset.parts.length || !['image/png','image/jpeg','image/webp','image/gif','video/mp4'].includes(asset.mimeType))throw new Error('Invalid media asset');
    let size=0;
    for(const part of asset.parts){
      const pack=packs.get(part.bundle);
      if(!pack || !Number.isSafeInteger(part.offset) || part.offset<0 || !Number.isSafeInteger(part.length) || part.length<=0 || part.offset+part.length>pack.bytes || !validHash(part.sha256))throw new Error('Invalid media range');
      size+=part.length;
    }
    if(size!==asset.bytes)throw new Error('Invalid media size');
  }
  previewBundles={...index,packs};
}
async function mediaHash(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
}
async function fetchMediaPart(part,signal) {
  const pack=previewBundles.packs.get(part.bundle),end=part.offset+part.length-1;
  const response=await fetch(part.bundle,{headers:{Range:`bytes=${part.offset}-${end}`},signal});
  const partial=response.status===206;
  const reject=async message=>{await response.body?.cancel().catch(()=>{});throw new Error(message);};
  if(!partial && response.status!==200)return reject('Media request failed');
  if(partial && response.headers.get('Content-Range')!==`bytes ${part.offset}-${end}/${pack.bytes}`)return reject('Unexpected media range');
  const expectedBody=partial ? part.length : pack.bytes,declared=response.headers.get('Content-Length');
  if(declared!==null && Number(declared)!==expectedBody)return reject('Unexpected media length');
  if(!response.body)throw new Error('Missing media stream');
  const reader=response.body.getReader(),bytes=new Uint8Array(part.length),start=partial ? 0 : part.offset,stop=start+part.length;
  let cursor=0,written=0;
  try {
    while(true){
      signal?.throwIfAborted();
      const {done,value}=await reader.read();
      if(done)break;
      const next=cursor+value.byteLength;
      if(next>expectedBody)throw new Error('Oversized media response');
      const from=Math.max(cursor,start),to=Math.min(next,stop);
      if(to>from){bytes.set(value.subarray(from-cursor,to-cursor),written);written+=to-from;}
      cursor=next;
      // A server ignoring Range may send a whole pack. Stop at the requested
      // segment instead of reading later videos while displaying an image.
      if(!partial && cursor>=stop){await reader.cancel();break;}
    }
    if(written!==part.length || (partial && cursor!==part.length))throw new Error('Truncated media response');
  } finally {await reader.cancel().catch(()=>{});reader.releaseLock();}
  signal?.throwIfAborted();
  if(await mediaHash(bytes)!==part.sha256)throw new Error('Media range verification failed');
  signal?.throwIfAborted();
  return bytes;
}
async function loadPackedMedia(path,signal) {
  const asset=previewBundles?.assets[path];
  if(!asset)throw new Error('Media asset is not indexed');
  const cached=packedImageCache.get(path);
  if(cached){packedImageCache.delete(path);packedImageCache.set(path,cached);signal?.throwIfAborted();return cached;}
  const bytes=new Uint8Array(asset.bytes);let offset=0;
  for(const part of asset.parts){const chunk=await fetchMediaPart(part,signal);bytes.set(chunk,offset);offset+=chunk.length;}
  if(await mediaHash(bytes)!==asset.sha256)throw new Error('Media verification failed');
  signal?.throwIfAborted();
  const blob=new Blob([bytes],{type:asset.mimeType});
  if(asset.mimeType.startsWith('image/') && blob.size<=packedImageLimit){
    const old=packedImageCache.get(path);if(old)packedImageBytes-=old.size;
    packedImageCache.delete(path);packedImageCache.set(path,blob);packedImageBytes+=blob.size;
    while(packedImageBytes>packedImageLimit || packedImageCache.size>8){const [key,value]=packedImageCache.entries().next().value;packedImageCache.delete(key);packedImageBytes-=value.size;}
  }
  return blob;
}
function releasePackedPicture(node) {
  const state=packedPictures.get(node);if(!state)return;
  packedPictures.delete(node);packedImageObserver.unobserve(node);state.controller.abort();
  if(state.url)URL.revokeObjectURL(state.url);
  node.removeAttribute(state.property);
}
function releasePackedPicturesIn(container) {
  for(const node of packedPictures.keys())if(node===container || container.contains(node))releasePackedPicture(node);
}
function setPictureSource(node,path,property='src') {
  releasePackedPicture(node);
  if(!/^assets\/[\w/-]+\.(?:webp|png|jpe?g|gif)$/.test(path || '')){node.removeAttribute(property);return;}
  if(!previewBundles?.assets[path]){node[property]=path;return;}
  node.removeAttribute(property);node.hidden=false;
  const state={controller:new AbortController(),url:null,property,started:false};
  state.start=async()=>{
    if(state.started || packedPictures.get(node)!==state)return;
    state.started=true;
    try {
      const blob=await loadPackedMedia(path,state.controller.signal);
      if(packedPictures.get(node)!==state || !node.isConnected)return;
      state.url=URL.createObjectURL(blob);node[property]=state.url;
    } catch(error){if(error.name!=='AbortError' && packedPictures.get(node)===state){if(property==='src')node.hidden=true;}}
  };
  packedPictures.set(node,state);
  requestAnimationFrame(()=>{
    if(packedPictures.get(node)!==state)return;
    if(!node.isConnected){releasePackedPicture(node);return;}
    if(node.tagName==='IMG' && node.loading==='lazy')packedImageObserver.observe(node);else state.start();
  });
}

function picture(path, name = '', cls = '') {
  const image = el('img', cls); image.alt = name; image.decoding = 'async';
  setPictureSource(image,path);
  image.addEventListener('error', () => { image.hidden = true; }, {once:true});
  return image;
}
function portrait(agent, cls) {
  const card=cls==='agent-card-portrait',square=portraitAssets.agents[agent.id];
  const frame=el('span',`${cls} agent-portrait-frame${square ? '' : ' agent-portrait-fallback'}`);
  const img=picture(square || agent.icon);img.loading=card ? 'lazy' : 'eager';
  img.width=512;img.height=512;
  frame.append(img);return frame;
}
function normalizeAgentSearch(value) {
  return String(value || '').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[\s’'·-]+/g,'');
}
const filterIds = ['agent-element','agent-specialty','agent-rank','agent-version'];
let directoryResults = [];
function renderGrid() {
  releasePackedPicturesIn($('agent-grid'));
  const query = normalizeAgentSearch($('agent-search').value);
  const filtered = roster.filter(a => (!query || a.searchWords.some(word=>word.includes(query)))
    && (!$('agent-element').value || a.element === $('agent-element').value)
    && (!$('agent-specialty').value || a.specialty === $('agent-specialty').value)
    && (!$('agent-rank').value || filterRank(a) === $('agent-rank').value)
    && matchesVersion(a,$('agent-version').value));
  const previewCount=roster.filter(a=>a.officialPreview).length;
  directoryResults = filtered;
  const activeCount = filterIds.filter(id => $(id).value).length;
  const searching = !!$('agent-search').value;
  const count = $('agent-filter-toggle').querySelector('.filter-count');
  count.textContent = activeCount;
  count.hidden = !activeCount;
  $('agent-filter-reset').hidden = !activeCount && !searching;
  if (activeCount || searching) {
    setLocalizedText($('agent-results'), `显示 ${filtered.length} / ${roster.length} 位代理人`, `Showing ${filtered.length} of ${roster.length} agents`);
  } else {
    const released = roster.length - previewCount;
    setLocalizedText($('agent-results'), `${released} 位正式代理人 · ${previewCount} 位官方预告`, `${released} released agents · ${previewCount} official previews`);
  }
  $('agent-grid').replaceChildren(...filtered.map(agent => {
    const card = el('a',`agent-card${agent.officialPreview ? ' agent-preview-card' : ''}`); card.href = `${location.pathname}${location.search}#agent=${encodeURIComponent(agent.id)}`; card.dataset.rank = filterRank(agent);
    card.style.setProperty('--agent-color', color(agent)); card.setAttribute('aria-label', `查看${agent.name}的资料`);
    const img = portrait(agent,'agent-card-portrait');
    if(filterRank(agent)){const rank=el('span','agent-card-rank',filterRank(agent));if(!agent.rank)rank.title='稀有度来自测试服数据';card.append(rank);}
    card.append(img,localized('h3','',agent.name,agent.nameEn),el('p','',[agent.element,agent.specialty].filter(Boolean).join(' · ') || '战斗资料待公布'),el('p','agent-card-faction',agent.faction || '代理人档案'));
    const badges = el('div','archive-card-badges');
    if(agent.officialPreview)badges.append(el('span','agent-version-badge agent-preview-badge',agent.availability?.badge || '官方预告 · 资料先览'));
    else if(agent.introducedVersion==='3.3.0')badges.append(el('span','agent-version-badge',agent.availability?.status==='announced' ? '3.3 下期 · 11月11日开放' : '3.3 新增'));
    else if(agent.introducedVersion==='3.2.0')badges.append(el('span','agent-version-badge',agent.availability?.status==='announced' ? '3.2 下期 · 资料先览' : '3.2 新增'));
    if(agent.beta)badges.append(bilingual('span','agent-version-badge agent-beta-badge',betaLabel(agent),`${betaVersion(agent)} ${agent.beta?.kind==='changes' ? 'Beta changes' : 'Beta data'}`.trim()));
    if(badges.childElementCount)card.append(badges);
    card.addEventListener('click', e => { if(!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button===0){e.preventDefault();opener=card;history.pushState(null,'',card.href);openAgent(agent.id);} });
    return card;
  }));
  $('agents-status').hidden = filtered.length > 0;
  if(!filtered.length) $('agents-status').textContent = roster.length ? '没有符合条件的代理人，试试调整筛选。' : '代理人目录读取失败，请刷新页面重试。';
}
function setFilters() {
  for(const [id,key] of [['agent-element','element'],['agent-specialty','specialty']]) {
    const entries = [...new Set(roster.map(a=>a[key]).filter(Boolean))];
    for(const entry of entries){const option=el('option','',entry);option.value=entry;$(id).append(option);}
  }
  const releases = new Map();
  for (const agent of roster) {
    const key = debutVersion(agent.introducedVersion);
    if (key) releases.set(key, releases.get(key) || !agent.officialPreview);
  }
  const latestFirst = (a, b) => b.localeCompare(a, 'en', {numeric:true});
  for (const key of [...releases.keys()].sort(latestFirst)) {
    const label = key.slice(0, -2);
    const released = releases.get(key);
    const option = bilingual('option', '', released ? label + ' 新增' : label + ' 预告', released ? 'Added in ' + label : label + ' preview');
    option.value = key;
    $('agent-version').append(option);
  }
  $('agent-search').addEventListener('input',renderGrid);
  for(const id of filterIds) $(id).addEventListener('change',renderGrid);
  $('agent-filter-reset').onclick = () => {
    for(const id of ['agent-search',...filterIds]) $(id).value='';
    renderGrid();
    $('agent-search').focus();
  };
  const toggle = $('agent-filter-toggle');
  toggle.onclick = () => toggle.setAttribute('aria-expanded',String(toggle.getAttribute('aria-expanded')!=='true'));
}
function releasePreviewMedia() {
  for(const video of $('agent-detail-content').querySelectorAll('video.agent-preview-video')){if(video.releasePreviewMedia)video.releasePreviewMedia();else {video.pause();video.removeAttribute('src');video.load();}}
  releasePackedPicturesIn($('agent-detail-content'));
}
function closeAgent() {
  detailGeneration++;
  releasePreviewMedia();
  if(dialog.open) dialog.close();
  if(new URLSearchParams(location.hash.slice(1)).has('agent')) history.replaceState(null,'',location.pathname+location.search);
  selected=null;opener?.focus({preventScroll:true});
}
function archiveLink(id, tab) {
  const url = new URL(location.href);
  const params = new URLSearchParams({agent:id});
  if (tab !== 'intro') params.set('tab', tab);
  url.hash = params.toString();
  return url;
}
function selectTab(tab) {
  selectedTab = tab;
  history.replaceState(null, '', archiveLink(selected.id, tab));
  renderDetail();
}
function showNeighbor(step) {
  const index = directoryResults.findIndex(agent => agent.id === selected?.id);
  const neighbor = directoryResults[index + step];
  if (index < 0 || !neighbor) return;
  const sameTab = agentTabs(neighbor).some(([key]) => key === selectedTab);
  history.replaceState(null, '', archiveLink(neighbor.id, sameTab ? selectedTab : 'intro'));
  opener = $('agent-grid').children[index + step];
  openAgent(neighbor.id);
  if (step < 0 && $('agent-prev').disabled) $('agent-next').focus({preventScroll:true});
  if (step > 0 && $('agent-next').disabled) $('agent-prev').focus({preventScroll:true});
}
$('agent-prev').onclick = () => showNeighbor(-1);
$('agent-next').onclick = () => showNeighbor(1);
function openAgent(id) {
  id=({'phoenix-reffaella':'1641','severian-lowell':'1631'})[id] || id;
  const agent=roster.find(a=>a.id===String(id)); if(!agent) return;
  const index = directoryResults.findIndex(result => result.id === agent.id);
  $('archive-neighbors').hidden = index < 0 || directoryResults.length < 2;
  $('agent-prev').disabled = index <= 0;
  $('agent-next').disabled = index < 0 || index >= directoryResults.length - 1;
  selected=agent;selectedTab=new URLSearchParams(location.hash.slice(1)).get('tab') || 'intro';
  const currentTabs=agentTabs(agent);
  if(!currentTabs.some(([key])=>key===selectedTab))selectedTab='intro';
  const hero=$('agent-dialog-hero');hero.style.setProperty('--agent-color',color(agent));
  const info=el('div'); const title=localized('h2','',agent.name,agent.nameEn);title.id='agent-detail-name';
  const meta=el('div','agent-meta');
  for(const value of [rankLabel(agent),agent.element,agent.specialty].filter(Boolean))meta.append(el('span','',value));
  info.append(el('p','agent-detail-kicker',agent.faction||'新艾利都 · 代理人档案'),title,meta);
  if(agent.officialPreview){meta.append(el('span','agent-version-label agent-preview-badge','官方预告'));if(agent.beta)meta.append(bilingual('span','agent-version-label agent-beta-badge',betaLabel(agent),`${betaVersion(agent)} ${agent.beta?.kind==='changes' ? 'Beta changes' : 'Beta data'}`.trim()));}
  else if(agent.introducedVersion==='3.3.0')meta.append(el('span','agent-version-label',agent.availability?.label || '3.3 新增'));
  else if(agent.introducedVersion==='3.2.0')meta.append(el('span','agent-version-label',agent.availability?.label || '3.2 新增'));
  releasePackedPicturesIn(hero);
  hero.replaceChildren(portrait(agent,'agent-detail-portrait'),info);
  if(agent.portrait)hero.append(picture(agent.portrait,'','agent-detail-art'));
  $('agent-detail-tabs').replaceChildren(...currentTabs.map(([key,label])=>{
    const button=el('button','',label);button.type='button';button.id=`agent-tab-${key}`;button.dataset.tab=key;button.setAttribute('role','tab');button.setAttribute('aria-controls','agent-detail-content');
    button.onclick=()=>selectTab(key);
    button.onkeydown=e=>{
      const index=currentTabs.findIndex(([k])=>k===key);
      let next;
      if(e.key==='ArrowRight')next=(index+1)%currentTabs.length;
      else if(e.key==='ArrowLeft')next=(index+currentTabs.length-1)%currentTabs.length;
      else if(e.key==='Home')next=0;
      else if(e.key==='End')next=currentTabs.length-1;
      else return;
      e.preventDefault();selectTab(currentTabs[next][0]);$(`agent-tab-${selectedTab}`).focus();
    };
    return button;
  }));
  renderDetail();
  if(!dialog.open){dialog.showModal();$('agent-close').focus({preventScroll:true});}
  dialog.scrollTop=0;
}
function sectionTitle(title,description) {const fragment=new DocumentFragment();fragment.append(el('h3','',title));if(description)fragment.append(note(description));return fragment;}
function officialArtPath(agent) {return window.DUKE_I18N.language==='en' && agent.officialArtEn ? agent.officialArtEn : agent.officialArt;}
function renderPreviewArtwork(agent) {
  const box=el('section','agent-preview-artwork'),figure=el('figure'),image=picture(agent.artwork || agent.media?.[0]?.poster,`${agent.name}${agent.portraitLayout==='poster' ? '官方角色图' : '官方立绘'}`);
  image.loading='eager';image.width=970;image.height=545;
  figure.append(image,el('figcaption','',agent.artworkCaption || '官方立绘 · © miHoYo / HoYoverse'));box.append(figure);
  const names=el('ul','agent-preview-members');
  for(const member of agent.members || []){
    const item=el('li'),link=el('a','agent-preview-member-art');
    if(/^assets\/[\w/-]+\.(?:webp|png|jpe?g|gif)$/.test(member.poster || '')){link.href=member.poster;link.target='_blank';link.rel='noopener noreferrer';const image=picture(member.poster,member.name);image.width=1080;image.height=1920;image.loading='lazy';link.append(image,el('span','','查看完整立绘 ↗'));item.append(link);}
    item.append(el('strong','',member.name),el('span','agent-preview-member-en',member.englishName || ''));names.append(item);
  }
  if(names.children.length)box.append(names);return box;
}
function renderPreviewMedia(agent) {
  const clips=(agent.media || []).filter(clip=>/^assets\/[\w/-]+\.mp4$/.test(clip.src || ''));
  if(!clips.length)return new DocumentFragment();
  const box=el('section','agent-preview-media'),heading=el('h4','','官方短片'),stage=el('div','agent-preview-video-stage'),video=el('video','agent-preview-video');
  heading.id='agent-preview-media-heading';box.setAttribute('aria-labelledby',heading.id);
  video.controls=true;video.preload='none';video.playsInline=true;video.setAttribute('aria-label','官方短片');
  const loadButton=localized('button','agent-preview-load','加载并播放','Load and play');loadButton.type='button';loadButton.hidden=true;
  stage.append(video,loadButton);
  const choices=el('div','agent-preview-clips');choices.setAttribute('role','group');choices.setAttribute('aria-label','选择短片');
  const caption=el('div','agent-preview-media-caption'),currentTitle=el('p','agent-preview-current-title'),source=el('a','','在官方原文观看 ↗');
  source.target='_blank';source.rel='noopener noreferrer';caption.append(currentTitle,source);
  const error=localized('p','agent-preview-media-error','短片暂时无法播放，请前往官方原文观看。','This video is temporarily unavailable. Watch it on the official page.');error.hidden=true;error.setAttribute('role','status');
  let active=0,generation=0,controller=null,objectUrl=null;
  const release=()=>{
    generation++;controller?.abort();controller=null;
    video.pause();video.removeAttribute('src');video.load();
    if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null;}
  };
  video.releasePreviewMedia=release;
  const choose=index=>{
    release();active=index;const clip=clips[index];error.hidden=true;
    setPictureSource(video,clip.poster,'poster');
    const packed=!!previewBundles?.assets[clip.src];video.dataset.bundled=String(packed);
    loadButton.hidden=!packed;loadButton.disabled=false;setLocalizedText(loadButton,'加载并播放','Load and play');
    if(!packed)video.src=clip.src;
    video.width=Number(clip.width)||1440;video.height=Number(clip.height)||1080;
    setLocalizedText(currentTitle,clip.title,clip.titleEn);
    source.hidden=true;source.removeAttribute('href');
    try{const url=new URL(clip.sourceUrl);if(url.protocol==='https:'){source.dataset.sourceZh=url.href;delete source.dataset.sourceEn;if(clip.sourceUrlEn){const en=new URL(clip.sourceUrlEn);if(en.protocol==='https:')source.dataset.sourceEn=en.href;}source.href=window.DUKE_I18N.language==='en' && source.dataset.sourceEn ? source.dataset.sourceEn : url.href;source.hidden=false;}}catch{}
    [...choices.children].forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
  };
  loadButton.onclick=async()=>{
    const clip=clips[active],token=generation;
    controller?.abort();controller=new AbortController();const request=controller;
    loadButton.disabled=true;setLocalizedText(loadButton,'正在加载…','Loading…');error.hidden=true;
    try {
      const blob=await loadPackedMedia(clip.src,request.signal);
      if(generation!==token || request.signal.aborted || !video.isConnected)return;
      objectUrl=URL.createObjectURL(blob);video.src=objectUrl;loadButton.hidden=true;
      video.play().catch(()=>{});
    } catch(failure){
      if(generation===token && !request.signal.aborted){error.hidden=false;loadButton.disabled=false;setLocalizedText(loadButton,'重试播放','Retry video');}
    }
  };
  clips.forEach((clip,index)=>{
    const button=el('button','agent-preview-clip');button.type='button';button.dataset.clip=clip.id;
    const cover=picture(clip.poster);cover.loading='lazy';cover.width=96;cover.height=72;
    button.append(cover,localized('span','',clip.title,clip.titleEn));button.onclick=()=>choose(index);
    button.onkeydown=e=>{let next;if(e.key==='ArrowRight')next=(index+1)%clips.length;else if(e.key==='ArrowLeft')next=(index+clips.length-1)%clips.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=clips.length-1;else return;e.preventDefault();choose(next);choices.children[next].focus();};
    choices.append(button);
  });
  video.addEventListener('error',()=>{if(video.getAttribute('src'))error.hidden=false;});
  video.addEventListener('playing',()=>{error.hidden=true;});
  box.append(heading,stage,caption,choices,error);choose(0);return box;
}
function renderIntro(agent) {
  const frag=new DocumentFragment();
  if(agent.officialPreview && agent.artwork)frag.append(renderPreviewArtwork(agent));
  frag.append(sectionTitle('角色介绍',agent.fullName && agent.fullName!==agent.name ? agent.fullName : ''));
  const card=el('div','agent-prose-card');card.append(prose(agent.description || '这位代理人的介绍资料暂未收录。',agent.descriptionEn));frag.append(card);
  if(agent.descriptionSource)frag.append(localized('p','agent-source-note',agent.descriptionSource,agent.descriptionSourceEn));
  const facts=el('dl','agent-facts');
  for(const [key,value] of [['所属阵营',agent.faction],['身份',agent.role],['英文名',agent.englishName],['属性',agent.element],['特性',agent.specialty],['稀有度',rankLabel(agent)],['收录版本',agent.introducedVersion],['开放说明',agent.availability?.label],['中文配音',agent.voiceActors?.zh],['日文配音',agent.voiceActors?.ja],['生日',agent.birthday],['身高',agent.height],['性别',agent.gender]]) {
    if(!value)continue;const item=el('div');item.append(el('dt','',key),el('dd','',text(value)));facts.append(item);
  }
  frag.append(facts);
  if(agent.officialPreview){
    const status=el('div','agent-preview-notice');
    status.append(el('h4','','官方已公开资料'),prose(agent.previewNote));
    const featured=(agent.sources || []).filter(source=>source.featured);
    if(featured.length)status.append(officialSources(featured));


    if(agent.roleTags?.length){const list=el('ul','agent-role-tags');for(const tag of agent.roleTags)list.append(el('li','',tag));status.append(el('h5','agent-role-title','官方定位'),list);}
    if(agent.signatureEngine){const e=agent.signatureEngine;status.append(el('p','agent-role-engine',`专属音擎：${e.name} · ${e.rank}级 · ${e.specialty}`));}
    // Official team suggestions come from the mechanics post; they are a recommendation, not a game rule.
    if(agent.officialTeams?.length){const list=el('ul','agent-role-teams');for(const team of agent.officialTeams){const row=el('li');[agent.name,...team.map(id=>catalog[id]?.name||id)].forEach((name,index)=>{if(index)row.append(' + ');row.append(el('span','',name));});list.append(row);}status.append(el('h5','agent-role-title','官方推荐配队'),list);}
    if(agent.beta){const button=bilingual('button','agent-beta-open',`查看 ${betaLabel(agent)}`,`View ${betaVersion(agent)} beta data`);button.type='button';button.onclick=()=>{selectTab('beta');$('agent-tab-beta').focus();};status.append(button);}
    frag.append(status);
    if(agent.media?.length)frag.append(renderPreviewMedia(agent));
    if(agent.officialArt){
      const fold=el('details','agent-official-art-fold'),figure=el('figure','agent-official-art');
      const img=picture(officialArtPath(agent),`${agent.name}官方角色档案图`);img.loading='lazy';img.dataset.agentOfficialArt='';
      figure.append(img,el('figcaption','',agent.artCaption || '官方角色档案图 · © miHoYo / HoYoverse'));
      fold.append(el('summary','','查看官方完整档案图'),figure);frag.append(fold);
    }
    const links=officialSources((agent.sources || []).filter(source=>!source.featured));
    const sources=el('details','agent-source-fold');sources.append(localized('summary','','官方来源','Official sources'),links,localized('p','agent-source-note',`核对：${agent.updatedAt} · 开放时间以官方公告为准。`,`Checked: ${agent.updatedAt} · Availability follows official announcements.`));frag.append(sources);
    return frag;
  }
  if(agent.officialDossier)frag.append(renderOfficialDossier(agent));
  if(agent.profile) for(const item of values(agent.profile).filter(item=>!['entity.profile.height','entity.profile.birthday','entity.profile.gender'].includes(item?.sourceField))){if(typeof item==='string')frag.append(prose(item));else {if(item.name||item.title)frag.append(localized('h4','',item.name||item.title,item.nameEn||item.titleEn));frag.append(prose(item.description||item.text,item.descriptionEn||item.textEn));}}

  return frag;
}
function officialSources(sources) {
  const links=el('div','agent-official-sources');
  for(const source of sources){
    try{
      const url=new URL(source.url);if(url.protocol!=='https:')continue;
      const suffix=source.date ? ' · '+source.date+' ↗' : ' ↗';
      const link=localized('a','',source.title+suffix,source.titleEn ? source.titleEn+suffix : undefined);
      link.dataset.sourceZh=url.href;
      if(source.urlEn){const en=new URL(source.urlEn);if(en.protocol==='https:')link.dataset.sourceEn=en.href;}
      link.href=window.DUKE_I18N.language==='en' && link.dataset.sourceEn ? link.dataset.sourceEn : url.href;
      link.target='_blank';link.rel='noopener noreferrer';links.append(link);
    }catch{}
  }
  return links;
}
function renderOfficialDossier(agent) {
  const dossier=agent.officialDossier,box=el('details','agent-official-art-fold');
  box.dataset.officialDossier=agent.id;
  box.append(localized('summary','','官方资料','Official media and sources'));
  let built=false;
  box.addEventListener('toggle',()=>{
    if(!box.open || built)return;
    built=true;
    const body=el('div','agent-preview-notice');
    if(dossier.role)body.append(prose(dossier.role,dossier.roleEn));
    if(dossier.roleTags?.length){const list=el('ul','agent-role-tags');for(const [i,tag] of dossier.roleTags.entries())list.append(localized('li','',tag,dossier.roleTagsEn?.[i]));body.append(el('h5','agent-role-title','官方定位'),list);}
    if(dossier.officialTeams?.length){const list=el('ul','agent-role-teams');for(const team of dossier.officialTeams){const row=el('li');[agent,...team.map(id=>catalog[id]||{name:id})].forEach((member,index)=>{if(index)row.append(' + ');row.append(localized('span','',member.name,member.nameEn));});list.append(row);}body.append(el('h5','agent-role-title','官方推荐配队'),list);}
    const voices=el('dl','agent-facts');for(const [key,value] of [['中文配音',dossier.voiceActors?.zh],['日文配音',dossier.voiceActors?.ja]])if(value){const row=el('div');row.append(el('dt','',key),el('dd','',value));voices.append(row);}body.append(voices);

    if(dossier.media?.length){body.append(renderPreviewMedia(dossier));if(dossier.mediaNote)body.append(prose(dossier.mediaNote,dossier.mediaNoteEn));}
    for(const group of dossier.artworkGroups || []){
      const fold=el('details','agent-official-art-fold');fold.dataset.officialGallery=group.id;
      fold.append(localized('summary','',group.title,group.titleEn));
      let imagesBuilt=false;
      fold.addEventListener('toggle',()=>{
        if(!fold.open || imagesBuilt)return;
        imagesBuilt=true;
        const hasOriginals=group.pages?.some(page=>page.originalUrl);
        const grid=hasOriginals ? el('div','agent-wallpaper-grid') : fold;
        if(hasOriginals)fold.append(grid);
        for(const page of group.pages || []){
          const english=window.DUKE_I18N.language==='en';
          const figure=el('figure','agent-official-art'),img=picture(english && page.srcEn ? page.srcEn : page.src,page.caption);
          img.loading='lazy';img.dataset.officialImageZh=page.src;if(page.srcEn)img.dataset.officialImageEn=page.srcEn;
          img.width=Number(english ? page.widthEn || page.width : page.width)||1080;
          img.height=Number(english ? page.heightEn || page.height : page.height)||2160;
          figure.append(img,localized('figcaption','',page.caption,page.captionEn));
          if(page.originalUrl && new URL(page.originalUrl).protocol==='https:'){
            const link=el('a');link.href=page.originalUrl;link.target='_blank';link.rel='noopener noreferrer';
            img.alt='';link.append(figure);grid.append(link);
          }else grid.append(figure);
        }
      });
      body.append(fold);
    }
    body.append(officialSources(dossier.sources || []));box.append(body);
  });
  return box;
}

function renderSkills(agent) {
  const frag=new DocumentFragment();frag.append(sectionTitle('技能详情'));
  const cultivation=agent.skillCultivationRecommendation;
  if(cultivation?.groups?.length){
    const guide=el('div','agent-prose-card');guide.append(el('h4','','培养建议分组'),note('按本版游戏配置列出推荐组；同一组内不表示严格升级顺序。'));
    const groups=el('div');
    const renderGroups=entry=>{groups.replaceChildren();for(const group of entry.groups||[]){const zh=`第 ${group.order} 组：${(group.skillNames||[]).join(' · ')}`,en=group.skillNamesEn ? `Group ${group.order}: ${group.skillNamesEn.join(' · ')}` : undefined;groups.append(prose(zh,en));}};
    if(cultivation.variants?.length>1){const label=el('label','agent-skill-level'),select=el('select');label.append(localized('span','','推荐适用影画','Applicable Mindscapes'));
      for(const [index,entry] of cultivation.variants.entries()){const levels=(entry.applicableMindscapes||[]).join(' / '),option=localized('option','',`影画 ${levels}`,`Mindscapes ${levels}`);option.value=String(index);select.append(option);}
      select.onchange=()=>renderGroups(cultivation.variants[Number(select.value)]);label.append(select);guide.append(label);select.onchange();
    }else renderGroups(cultivation);
    guide.append(groups);
    frag.append(guide);
  }
  const skills=agent.skills || [];
  if(!skills.length){frag.append(note('这位代理人的技能资料暂未收录。'));return frag;}
  for(const [index,skill] of skills.entries()){
    const item=el('details','agent-skill');item.open=index===0;
    const summary=el('summary');if(skill.category)summary.append(localized('span','agent-skill-label',text(skill.category),skill.categoryEn));summary.append(localized('span','',skill.name || '技能',skill.nameEn));
    const body=el('div','agent-skill-body');const description=prose(skill.description,skill.descriptionEn);
    if(skill.levels?.length){
      const label=el('label','agent-skill-level','技能等级');const select=el('select');select.setAttribute('aria-label',`${skill.name}的技能等级`);
      for(const [i,level] of skill.levels.entries()){const option=localized('option','',text(level.label || `Lv. ${level.level}`),level.labelEn);option.value=i;select.append(option);}
      const update=()=>{const level=skill.levels[Number(select.value)];setLocalizedText(description,level?.description || skill.description || '该等级暂无文本。',level?.descriptionEn || skill.descriptionEn);};
      select.onchange=update;label.append(select);body.append(label);update();
    }
    body.append(description);
    if(skill.condition?.label)body.prepend(localized('p','agent-section-note',`生效条件：${skill.condition.label}`,skill.condition.labelEn ? `Condition: ${skill.condition.labelEn}` : undefined));
    for(const variant of skill.variants||[]){
      const alternate=el('details','agent-skill-variant'),effect=prose(variant.description,variant.descriptionEn);
      alternate.append(localized('summary','agent-source-note',variant.condition?.label||'潜能觉醒效果',variant.condition?.labelEn));
      if(variant.levels?.length){
        const label=el('label','agent-variant-level','核心强化'),select=el('select');select.setAttribute('aria-label',`${variant.name}潜能觉醒效果的核心强化`);
        for(const [index,level] of variant.levels.entries()){const option=localized('option','',level.label||`Lv. ${level.level}`,level.labelEn);option.value=index;select.append(option);}
        select.onchange=()=>{const level=variant.levels[Number(select.value)];setLocalizedText(effect,level.description,level.descriptionEn);};label.append(select);alternate.append(label);select.onchange();
      }
      alternate.append(effect);body.append(alternate);
    }
    if(skill.note)body.append(localized('p','agent-source-note',skill.note,skill.noteEn));
    item.append(summary,body);frag.append(item);
  }
  return frag;
}
function renderCinema(agent) {
  const frag=new DocumentFragment();frag.append(sectionTitle('影画'));
  const entries=agent.cinema || [];
  if(!entries.length){frag.append(note('这位代理人的影画资料暂未收录。'));return frag;}
  const grid=el('div','agent-cinema-grid');
  for(const [i,entry] of entries.entries()){
    const card=el('article','agent-cinema'),heading=el('div','agent-cinema-heading');
    heading.append(el('span','agent-cinema-index',String(entry.index||i+1).padStart(2,'0')),localized('h4','',entry.name||`影画 ${i+1}`,entry.nameEn));card.append(heading,prose(entry.description,entry.descriptionEn));
    if(entry.story){const story=el('details');story.append(el('summary','agent-source-note','影画故事'),prose(entry.story,entry.storyEn));card.append(story);}
    grid.append(card);
  }
  frag.append(grid);return frag;
}
function renderEngine(agent) {
  const frag=new DocumentFragment();const binding=equipment.agents?.[agent.id];
  const id=String(binding?.signatureEngineId || agent.signatureEngineId || '');
  const engine=equipment.engines?.[id];
  frag.append(sectionTitle('专属音擎','查看与该代理人对应的音擎属性和技能效果。'));
  if(!engine){frag.append(note('专属音擎对应资料暂未收录。'));return frag;}
  const card=el('article','agent-equipment-card'),heading=el('div','agent-equipment-head'),info=el('div');
  info.append(el('p','',`${catalog[id]?.rank || engine.rank || ''} 级音擎`),localized('h4','',engine.name,engine.nameEn),localized('p','',engine.profession || agent.specialty,engine.professionEn || agent.specialtyEn));
  if(engine.availability?.label)info.append(el('p','agent-source-note',engine.availability.label));
  heading.append(picture(engine.icon || catalog[id]?.icon),info);card.append(heading);
  const stats=el('div','agent-engine-stats');
  const entries=Array.isArray(engine.stats)?engine.stats:Object.entries(engine.stats||{}).map(([name,value])=>({name,value}));
  for(const entry of entries){const item=el('div');item.append(localized('span','',entry.name,entry.nameEn));item.append(el('strong','',text(entry.value)));stats.append(item);}
  if(entries.length)card.append(stats);
  card.append(localized('h4','',engine.skillName||'音擎效果',engine.skillNameEn),prose(engine.skillDescription || engine.description || '音擎技能资料暂未收录。',engine.skillDescriptionEn || engine.descriptionEn));
  if(engine.refinements?.length){
    const label=el('label','agent-skill-level','叠影等级'),select=el('select');const effect=card.lastElementChild;
    for(const [index,level] of engine.refinements.entries()){const option=el('option','',`${level.level || index+1} 阶`);option.value=index;select.append(option);}
    select.onchange=()=>{const level=engine.refinements[Number(select.value)];setLocalizedText(effect,level?.description||engine.skillDescription,level?.descriptionEn||engine.skillDescriptionEn);};label.append(select);card.insertBefore(label,effect);select.onchange();
  }
  if(engine.skillRequirement)card.append(localized('p','agent-source-note',engine.skillRequirement,engine.skillRequirementEn));
  if(engine.note || engine.statsLabel)card.append(localized('p','agent-source-note',engine.note || engine.statsLabel,engine.noteEn || engine.statsLabelEn));
  if(engine.description && engine.description!==engine.skillDescription){const lore=el('details');lore.append(el('summary','agent-source-note','音擎介绍'),prose(engine.description,engine.descriptionEn));card.append(lore);}
  frag.append(card);return frag;
}
function discCard(id,pieces,reason) {
  const disc=equipment.discs?.[String(id)],card=el('article','agent-disc'),heading=el('div','agent-disc-heading');
  if(disc?.icon)heading.append(picture(disc.icon));
  heading.append(localized('h4','',disc?.name || `套装资料待补充`,disc?.nameEn),el('span','',`${pieces} 件`));card.append(heading);
  if(disc){card.append(prose(`2 件套：${disc.twoPiece || '效果待补充'}`,disc.twoPieceEn ? `2-Piece: ${disc.twoPieceEn}` : undefined));if(pieces===4)card.append(prose(`4 件套：${disc.fourPiece || '效果待补充'}`,disc.fourPieceEn ? `4-Piece: ${disc.fourPieceEn}` : undefined));if(disc.source?.provider==='Gachabase')card.append(sourceLink(disc.source));}
  if(reason)card.append(el('p','agent-disc-reason',reason));return card;
}
function renderDiscs(agent) {
  const frag=new DocumentFragment(),build=builds.agents?.[agent.id] || equipment.agents?.[agent.id]?.build;
  frag.append(sectionTitle('驱动盘搭配','收益随队伍与词条变化。'));
  if(!build){frag.append(note('这位代理人的驱动盘搭配尚待核对。'));return frag;}
  const planner=el('a','agent-source-note','逐号位规划驱动盘与调律材料 ↗');planner.href=`disc-planner.html?agent=${encodeURIComponent(agent.id)}&v=20260916-english-2`;frag.append(planner);
  frag.append(el('span','agent-recommend-label','机制搭配参考'));
  for(const reason of values(build.reasons || build.notes))frag.append(prose(reason));
  const plans=build.sets || [],planArea=el('div','agent-build-sets');
  const renderPlan=index=>{
    planArea.replaceChildren();const plan=plans[index];if(!plan)return;
    if(plan.fourPieceId){
      planArea.append(discCard(plan.fourPieceId,4,plan.reason));
      if(plan.conditions?.length)planArea.append(note('生效条件：'+plan.conditions.join('；')));
      const choices=values(plan.twoPieceIds);
      if(choices.length)planArea.append(el('h4','',choices.length>1?'二件套备选 · 选择其中一组':'搭配二件套'));
      for(const id of choices)planArea.append(discCard(id,2));
    }else if(plan.discId)planArea.append(discCard(plan.discId,plan.pieces||4,plan.reason));
  };
  if(plans.length>1){const label=el('label','agent-skill-level','搭配方案'),select=el('select');for(const [i,plan] of plans.entries()){const option=el('option','',plan.label || equipment.discs?.[String(plan.fourPieceId)]?.name || `方案 ${i+1}`);option.value=i;select.append(option);}select.onchange=()=>renderPlan(Number(select.value));label.append(select);frag.append(label);}
  renderPlan(0);frag.append(planArea,el('h4','','主词条参考'));
  const table=el('table','agent-stats-table'),head=el('thead'),row=el('tr');row.append(el('th','','位置'),el('th','','推荐主词条'));head.append(row);table.append(head);const body=el('tbody');
  const main=Array.isArray(build.mainStats)?build.mainStats:Object.entries(build.mainStats||{}).map(([slot,value])=>({slot,value:values(value).join(' / ')}));
  for(const entry of main){const r=el('tr'),cell=el('td','',text(entry.value));if(entry.reason)cell.append(el('small','',entry.reason));r.append(el('td','',`${entry.slot} 号位`),cell);body.append(r);}table.append(body);frag.append(table);
  if(build.subStats?.length){const card=el('div','agent-substats');card.append(el('strong','','副词条参考'),document.createTextNode(build.subStats.join(' · ')));frag.append(card);}
  for(const caution of values(build.cautions))frag.append(el('p','agent-source-note',caution));
  if(build.evidence?.length){const proof=el('details');proof.append(el('summary','agent-source-note','搭配依据'));for(const evidence of build.evidence){if(evidence.name)proof.append(el('h4','',evidence.name));proof.append(prose(evidence.text,evidence.textEn));}frag.append(proof);}
  return frag;
}
function cachedRead(key,read) {
  if(!downloads.has(key)){
    const request=read().then(result=>{
      failures.delete(key);
      return result;
    }).catch(error=>{
      downloads.delete(key);
      failures.add(key);
      throw error;
    });
    downloads.set(key,request);
  }
  return downloads.get(key);
}
function loadArchive(key) {
  return cachedRead(key,async()=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),20000);
    try{
      const response=await fetch(assets[key],{signal:controller.signal});
      if(!response.ok)throw new Error('Could not load '+assets[key]);
      return await response.json();
    }finally{clearTimeout(timer);}
  });
}
async function loadDetailRecord(agent) {
  if(!agent.detailRange)return {};
  const [start,length,designRevision,resourceRevision,expectedHash]=agent.detailRange;
  const end=start+length-1;
  function matches(record){
    return String(record?.id)===agent.id && record.source?.revision===designRevision && record.source.resourceRevision===resourceRevision;
  }
  async function fromWhole(response){
    const key='whole-details';
    if(response && downloads.has(key))await response.body?.cancel();
    const records=await cachedRead(key,async()=>{
      const result=response || await fetch(assets.details);
      if(result.status!==200)throw new Error('Complete agent archive unavailable');
      const raw=await result.arrayBuffer();
      return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw)).agents;
    });
    if(!matches(records?.[agent.id])){
      downloads.delete(key);
      throw new Error('Agent record revision mismatch');
    }
    return records[agent.id];
  }
  return cachedRead('agent-'+agent.id,async()=>{
    if(downloads.has('whole-details'))return fromWhole();
    const response=await fetch(assets.details,{headers:{Range:`bytes=${start}-${end}`}});
    if(response.status===200)return fromWhole(response);
    if(response.status===206 && response.headers.get('Content-Range')===`bytes ${start}-${end}/${detailsBytes}`){
      try{
        const bytes=await response.arrayBuffer();
        if(bytes.byteLength===length && (!crypto.subtle || await mediaHash(bytes)===expectedHash)){
          const record=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
          if(matches(record))return record;
        }
      }catch{/* A transformed or stale range can still be read as a whole document. */}
    }else{
      await response.body?.cancel();
      if(response.status!==206 && response.status!==416){
        throw new Error('Could not load agent detail');
      }
    }
    return fromWhole();
  });
}
async function prepareTab(agent,tab) {
  if(tab.startsWith('beta')){
    const beta=(await loadArchive('beta')).agents[agent.id];
    if(!beta)throw new Error('Beta record missing');
    return {...agent,beta};
  }
  if(agent.officialPreview)return agent;
  if(tab==='engine'){
    equipment=await loadArchive('equipment');
    return agent;
  }
  if(tab==='discs'){
    [builds,equipment]=await Promise.all([loadArchive('builds'),loadArchive('equipment')]);
    return agent;
  }
  let record;
  if(tab==='graduation'){
    [record,graduation,equipment]=await Promise.all([loadDetailRecord(agent),loadArchive('graduation'),loadArchive('equipment')]);
  }else{
    record=await loadDetailRecord(agent);
  }
  return {...agent,...record};
}
async function renderDetail() {
  if(!selected)return;
  const generation=++detailGeneration,tab=selectedTab;
  for(const button of $('agent-detail-tabs').children){const active=button.dataset.tab===selectedTab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;}
  const content=$('agent-detail-content');content.setAttribute('aria-labelledby',`agent-tab-${selectedTab}`);
  const renderers={intro:renderIntro,skills:renderSkills,cinema:renderCinema,engine:renderEngine,discs:renderDiscs,graduation:a=>renderGraduation(a,graduation.agents?.[a.id],equipment)};
  releasePreviewMedia();
  content.setAttribute('aria-busy','true');
  content.replaceChildren(localized('p','agent-section-note','正在读取资料…','Loading details…'));
  try{
    const agent=await prepareTab(selected,tab);
    if(generation!==detailGeneration || !dialog.open)return;
    content.replaceChildren(tab.startsWith('beta') && agent.beta ? renderBetaTab(agent.beta,tab) : (renderers[tab] || renderIntro)(agent));
    if(!agent.officialPreview && ['intro','skills','cinema','engine'].includes(tab)){
      const source=tab==='engine' ? equipment.engines?.[equipment.agents?.[agent.id]?.signatureEngineId]?.source : agent.source;
      if(source?.provider==='Gachabase')content.prepend(releaseSource(source));
    }
  }catch{
    if(generation!==detailGeneration || !dialog.open)return;
    const retry=localized('button','','重试','Retry');retry.type='button';retry.onclick=renderDetail;
    content.replaceChildren(localized('p','agent-section-note','这页资料暂时无法读取。','These details could not be loaded.'),retry);
  }finally{
    if(generation===detailGeneration)content.removeAttribute('aria-busy');
  }
}
function readHash() {const requested=new URLSearchParams(location.hash.slice(1)).get('agent');const id=({'phoenix-reffaella':'1641','severian-lowell':'1631'})[requested] || requested;if(id && roster.some(a=>a.id===id)){openAgent(id);}else if(dialog.open)closeAgent();}
$('agent-close').onclick=closeAgent;
dialog.addEventListener('close',()=>{if(!dialog.open){releasePreviewMedia();releasePackedPicturesIn($('agent-dialog-hero'));}});
window.addEventListener('pagehide',()=>{detailGeneration++;releasePreviewMedia();releasePackedPicturesIn(document);packedImageCache.clear();packedImageBytes=0;});
window.addEventListener('pageshow',event=>{if(event.persisted){renderGrid();if(selected && dialog.open){const tab=selectedTab;openAgent(selected.id);selectedTab=tab;renderDetail();}}});
window.addEventListener('dukelanguagechange',()=>{const img=$('agent-detail-content').querySelector('[data-agent-official-art]');if(img && selected)setPictureSource(img,officialArtPath(selected));for(const img of document.querySelectorAll('img[data-official-image-zh]'))setPictureSource(img,window.DUKE_I18N.language==='en' && img.dataset.officialImageEn ? img.dataset.officialImageEn : img.dataset.officialImageZh);for(const a of document.querySelectorAll('a[data-source-zh]'))a.href=window.DUKE_I18N.language==='en' && a.dataset.sourceEn ? a.dataset.sourceEn : a.dataset.sourceZh;});
dialog.addEventListener('cancel',e=>{e.preventDefault();closeAgent();});
dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const box=dialog.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)closeAgent();});
window.addEventListener('hashchange',readHash);
try {
  const previewData=await loadArchive('directory'),directory=previewData.directory;
  if(directory?.version!==1 || !Array.isArray(directory.agents))throw new Error('Directory unavailable');
  installPreviewBundles(previewData.assetBundles);
  const dossiers=previewData.agents,previews=dossiers.filter(p=>!p.supersededBy);
  version=directory.gameVersion;detailsBytes=directory.detailsBytes;
  roster=directory.agents.map(agent=>({...agent,beta:directory.beta[agent.id],officialDossier:dossiers.find(p=>p.supersededBy===agent.id)}));
  catalog=Object.fromEntries(roster.map(agent=>[agent.id,agent]));
  for(const agent of previews){
    if(!roster.some(a=>a.id===agent.id || a.name===agent.name || (a.fullName && a.fullName===agent.fullName))){
      roster.push({...agent,officialPreview:true,factionEn:agent.factionEn || directory.previewFactionsEn[agent.id],
        thumbnail:directory.thumbnails[agent.id],beta:directory.beta[agent.id]});
    }
  }
  for(const agent of roster){
    const words=[agent.name,agent.nameEn,agent.fullName,agent.fullNameEn,agent.englishName,agent.faction,agent.factionEn,
      ...(agent.aliases || []),...(agent.members || []).flatMap(member=>[member.name,member.englishName])];
    agent.searchWords=words.filter(Boolean).map(normalizeAgentSearch);
  }
  roster.sort((a,b)=>Number(!!b.officialPreview)-Number(!!a.officialPreview)||(a.officialPreview&&b.officialPreview ? b.updatedAt.localeCompare(a.updatedAt) : (a.rank===b.rank?0:a.rank==='S'?-1:1)||Number(b.id)-Number(a.id)));
  setFilters();
  const requestedVersion=new URL(location.href).searchParams.get('version');
  const selectedVersion = debutVersion(requestedVersion) || requestedVersion;
  if (Array.from($('agent-version').options).some(option => option.value === selectedVersion)) {
    $('agent-version').value = selectedVersion;
  }
  renderGrid();
  readHash();
  window.agentArchive={getState:()=>({ready:true,count:roster.length,detailCount:directory.agents.filter(a=>a.detailRange).length,previewCount:previews.length,betaCount:roster.filter(a=>a.officialPreview&&a.beta).length,betaChangesCount:roster.filter(a=>!a.officialPreview&&a.beta).length,selected:selected?.id,tab:selectedTab,failures:[...failures]})};
}catch(error){$('agents-status').hidden=false;$('agents-status').textContent='资料加载失败，请刷新页面重试。';}

import {POOL_META, IMPORT_LIMITS, parseImport, mergeAccounts, analyzeAccount, exportBackup, exportUIGF, exportCSV} from './tuning-core.js?v=20260914-duke-brand-1';
import {openStorage, readAccounts, readImportState, updateAccounts, persistent} from './tuning-storage.js?v=20260910-tuning-incremental-1';
import {rateLuck} from './tuning-rating.js?v=20260914-duke-brand-1';
import {setupLinkImport} from './tuning-link.js?v=20260914-duke-brand-1';
import {renderOverview, renderGuarantee, loadBannerData, signalOutcomes} from './tuning-summary.js?v=20261111-refresh-launch-1';
import {mountExpectation,mountUpPairs,renderUpPairs} from './tuning-targets.js?v=20261111-refresh-launch-1';
import {cloneData} from './tuning-compat.js?v=20260909-tuning-win11-1';
import {fetchTuningJSON} from './tuning-resources.js?v=20260909-tuning-win11-1';
import {isRngBackup} from './tuning-rng.js?v=20260911-community-update-1';
import {mountRngMigration,reviewRngMigration} from './tuning-rng-ui.js?v=20260914-duke-brand-1';
import {mountPersonalBudget} from './tuning-personal-budget.js?v=20261111-refresh-launch-1';
import {mountTuningWorkspace} from './tuning-simple.js?v=20260919-site-refresh-1';

const $ = id => document.getElementById(id);
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};
const nf = new Intl.NumberFormat('zh-CN');
const number = n => nf.format(n || 0);
const labels = {'2':'独家频段','3':'音擎频段','1':'常驻频段','5':'邦布频段','102':'复刻角色','103':'复刻音擎',up:'角色与专武',agents:'代理人总览',engines:'音擎总览'};
const poolOrder = ['2','3','1','5','102','103'];
const PAGE_SIZE = 10;
let accounts = [], selectedUid = '', selectedTab = '2', demo = null, stats = null, page = 0, busy = false;
let collectionLimit = 48;
let personalBudget,tuningWorkspace;
let refreshPending = false;
let catalog = {}, names = new Map(), catalogError = false;
let channel;
try { channel = new BroadcastChannel('bagel-tuning-records'); } catch { /* A single tab still works. */ }

function announce(message, kind = 'info') {
  $('status-message').textContent = message;
  $('status-message').dataset.kind = kind;
}
const activeAccounts = () => demo ? [demo] : accounts;
const active = () => activeAccounts().find(a => a.uid === selectedUid) || activeAccounts()[0];
window.addEventListener('dukelanguagechange',()=>{if(window.tuningAnalysis&&active()&&['agents','engines'].includes(selectedTab))renderCollection(active());});
async function syncAccounts() {
  if(busy) { refreshPending=true; return; }
  refreshPending=false;
  // A queued cross-tab refresh must not hide a rejected import/preview explanation.
  try { accounts=await readAccounts(); render(); if(!demo&&$('status-message').dataset.kind!=='error')announce('已同步其他标签页中的本地记录。'); }
  catch(error) { announce(`本地记录同步失败：${error.message}。当前显示的记录仍在。`,'warning'); }
}
function finishUpdate() { busy=false; render(); if(refreshPending)void syncAccounts(); }
const metadata = record => catalog[record.itemId] || names.get(record.name);
const itemName = record => metadata(record)?.name || record.name || `物品 ${record.itemId || '未知'}`;
function itemType(record) {
  const known = metadata(record)?.type;
  if (known) return known;
  const value = String(record.itemType || '').toLowerCase();
  if (/代理人|角色|agent|character|avatar/.test(value)) return 'agent';
  if (/音擎|weapon|w.engine/.test(value)) return 'engine';
  if (/邦布|bangboo|buddy/.test(value)) return 'bangboo';
  return 'unknown';
}
function avatar(record) {
  const wrap = el('span', 'item-avatar');
  wrap.dataset.rank = record.rank || 'unknown';
  const known = metadata(record);
  // The catalog is shipped with the app; record files never provide image URLs.
  if (known?.icon && /^assets\/tuning\/[a-zA-Z0-9_./-]+\.(webp|png)$/.test(known.icon)) {
    const img = document.createElement('img');
    img.src = known.icon; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
    img.addEventListener('error', () => { img.remove(); wrap.textContent = itemName(record).slice(0, 1); wrap.title = '图标暂缺'; }, {once:true});
    wrap.append(img);
  } else {
    wrap.textContent = itemName(record).slice(0, 1);
    wrap.title = '尚未匹配到图标';
  }
  return wrap;
}
function badge(rank) {
  const node = el('span', 'rank-badge', rank ? `${rank} 级` : '未知');
  node.dataset.rank = rank || 'unknown'; return node;
}
function aggregates(account, kind) {
  const groups = new Map();
  for (const r of account.records) {
    if (itemType(r) !== kind) continue;
    const known = metadata(r), key = known?.id || r.itemId || r.name;
    if (!groups.has(key)) groups.set(key, {...r, name:itemName(r), count:0, rankCounts:{S:0,A:0,B:0,unknown:0}, qualities:new Set(), pools:new Set(), first:r.time, last:r.time});
    const row = groups.get(key); row.count++; row.pools.add(r.pool); row.rankCounts[r.rank || 'unknown']++;
    if(r.rank) row.qualities.add(r.rank);
    if (r.time < row.first) row.first = r.time;
    if (r.time > row.last) row.last = r.time;
  }
  return [...groups.values()].map(row=>({...row,rank:metadata(row)?.rank || (row.qualities.size===1?[...row.qualities][0]:null)}));
}

function summary(values) {
  $('summary-cards').replaceChildren(...values.map(([label, value, note]) => {
    const card = el('article', 'stat-card');
    card.append(el('span', 'stat-label', label), el('strong', 'stat-value', value), el('span', 'stat-meta', note));
    return card;
  }));
}
function renderTabs(account) {
  const unknown = stats.pools.map(p => p.id).filter(id => !poolOrder.includes(id));
  const tabs = ['up', ...poolOrder, ...unknown, 'agents', 'engines'];
  if (!tabs.includes(selectedTab)) selectedTab = '2';
  $('pool-tabs').replaceChildren(...tabs.map(id => {
    const count = id==='up' ? account.records.filter(r=>r.rank==='S'&&['2','3','102','103'].includes(r.pool)).length : id === 'agents' || id === 'engines'
      ? account.records.filter(r => itemType(r) === (id === 'agents' ? 'agent' : 'engine')).length
      : stats.pools.find(p => p.id === id)?.count || 0;
    const button = el('button', 'pool-tab'); button.type = 'button'; button.dataset.pool = id;
    button.setAttribute('aria-pressed', String(id === selectedTab));
    const label=labels[id] || `其他池 ${id}`,unit=id==='up'?'次 S 级获取':id==='agents'||id==='engines'?'次获取':'抽';
    button.setAttribute('aria-label',`${label}，${number(count)} ${unit}`);
    const countLabel=el('span','tab-amount');countLabel.append(el('strong','tab-count',number(count)),el('small','tab-unit',unit));
    const selectedMark=el('span','tab-selected-mark','✓');selectedMark.setAttribute('aria-hidden','true');
    button.append(el('span','tab-label',label),countLabel,selectedMark);
    button.onclick = () => { const restoreFocus=document.activeElement===button; selectedTab = id; page = 0; collectionLimit = 48; $('record-search').value = ''; $('rank-filter').value = 'all'; render(); if(restoreFocus)[...$('pool-tabs').children].find(tab=>tab.dataset.pool===id)?.focus({preventScroll:true}); };
    return button;
  }));
}
function renderGuaranteeHub(account) {
  const cards=$('guarantee-cards');cards.replaceChildren();cards.hidden=!account;
  $('guarantee-empty').hidden=!!account;
  $('guarantee-account').textContent=account ? demo ? '虚构示例 · 最新已导入记录' : `UID ${String(account.uid).slice(0,2)}***${String(account.uid).slice(-4)} · 最新记录` : '导入后显示你的状态';
  if(!account)return;
  for(const id of ['2','3']){
    const article=el('article','guarantee-pool');article.dataset.guaranteePool=id;
    article.append(el('h3','',id==='2'?'独家频段 · 代理人':'音擎频段 · 限定音擎'));
    const pool=stats.pools.find(p=>p.id===id)||POOL_META[id];
    renderGuarantee(article,account,pool,{catalog,includeGuide:false,includeScope:false});cards.append(article);
  }
}
function renderPity(pool, account) {
  const card = el('div', 'pity-card');
  if (!pool?.count) {
    card.append(el('h3', 'pity-heading', '这个频段还没有记录'), el('p', 'pity-note', '导入包含此频段的文件后，可以查看 S 级间隔和已记录垫抽。'));
  $('pity-panel').replaceChildren(card); $('gold-list').replaceChildren(el('p', 'muted', '尚无 S 级记录。')); return;
  }
  const known = pool.currentPityKnown;
  card.append(el('div', 'pity-heading', '距上次 S 级 · 已记录'));
  const progress = el('div', 'pity-progress');
  progress.append(el('strong', '', known ? `${number(pool.currentPity)} 抽` : '暂无法确定'));
  if (pool.hardPity) progress.append(el('span', '', `本频段规则上限 ${pool.hardPity} 抽`));
  card.append(progress);
  if (known && pool.hardPity) {
    const track = el('div', 'pity-track');
    const fill = el('span'); fill.style.width = `${Math.min(100, pool.currentPity / pool.hardPity * 100)}%`;
    track.append(fill); card.append(track);
  }
  if (!known) card.append(el('p', 'pity-note', '记录里还没有 S 级，或之后有品质未知的记录，暂时算不出已垫抽数。'));
  const avg = pool.averageSInterval;
  card.append(el('p', 'pity-average', avg == null ? '平均多少抽出 S 级：样本不足' : `平均 ${avg.toFixed(1)} 抽出一次 S 级`));
  if (['102','103'].includes(selectedTab)) card.append(el('p', 'pity-note', '独家重映单独计算抽数，不和普通频段合并。'));
  for (const warning of pool.warnings || []) card.append(el('p', 'analysis-warning', warning));
  $('pity-panel').replaceChildren(card);
  const history = pool.sHistory || pool.sRecords || [];
  const outcomes = signalOutcomes(account, pool.id, catalog);
  $('gold-list').replaceChildren(...history.slice().reverse().slice(0, 60).map(r => {
    const node = el('article', 'gold-card'), info = el('div', 'gold-info'), name = el('b', '', itemName(r));
    const outcome = outcomes.get(String(r.id));
    if (outcome) name.append(el('span', `gold-tag ${outcome}`, outcome === 'up' ? 'UP' : '歪'));
    info.append(name, el('time', '', r.time));
    const complete = r.complete ?? r.known ?? r.interval !== null;
    node.append(avatar({...r, rank:'S'}), info, el('span', 'gold-count', complete ? `${number(r.interval)} 抽` : '前段未知'));
    return node;
  }));
  if (!history.length) $('gold-list').append(el('p', 'muted', '已导入记录中还没有 S 级。'));
  if (history.length > 60) $('gold-list').append(el('p', 'muted', '此处展示最近 60 次 S 级，全部记录可在下方筛选或导出。'));
}
function renderHistory(account) {
  const query = $('record-search').value.trim().toLowerCase(), rank = $('rank-filter').value;
  const rows = account.records.filter(r => r.pool === selectedTab && (rank === 'all' || (rank === 'unknown' ? !r.rank : r.rank === rank)) && (!query || window.DUKE_I18N.matches([itemName(r),r.name,r.itemId,r.time],query))).slice().reverse();
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  page = Math.min(page, totalPages - 1);
  $('history-body').replaceChildren(...rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(r => {
    const tr = el('tr'), name = el('td'), nameRow = el('div', 'record-item');
    nameRow.append(avatar(r), el('span', 'record-name', itemName(r))); name.append(nameRow);
    const quality = el('td'); quality.append(badge(r.rank));
    tr.append(name, quality, el('td', '', labels[r.pool] || r.pool), el('td', 'record-time', r.time)); return tr;
  }));
  $('history-count').textContent = `${number(rows.length)} 条记录 · 每页 ${PAGE_SIZE} 条 · 第 ${page + 1} / ${totalPages} 页`;
  $('history-empty').hidden = !!rows.length;
  $('history-prev').disabled = page === 0; $('history-next').disabled = page + 1 >= totalPages;
}
function renderCollection(account) {
  const kind = selectedTab === 'agents' ? 'agent' : 'engine', all = aggregates(account, kind);
  $('collection-title').textContent = labels[selectedTab];
  $('collection-panel').querySelector('.section-subtle').textContent = `${demo ? '虚构示例 · ' : ''}按对象汇总各频段的获取次数。`;
  const total = all.reduce((n, r) => n + r.count, 0), counts = {S:0,A:0,B:0,unknown:0};
  for(const row of all) for(const rank of Object.keys(counts)) counts[rank]+=row.rankCounts[rank];
  summary([
    [kind === 'agent' ? '代理人总获取' : '音擎总获取', number(total), '汇总此账号所有已导入频段'],
    ['已获得种类', number(all.length), '同名同物品合并，重复获取仍计数'],
    ['S 级获取', number(counts.S), `${all.filter(r => r.rankCounts.S>0).length} 种已记录 S 级`],
    ['A / B 级获取', `${number(counts.A)} / ${number(counts.B)}`, counts.unknown ? `另有 ${number(counts.unknown)} 条未知品质，未算入 S / A / B` : '逐条按导入记录品质统计']
  ]);
  const query = $('collection-search').value.trim().toLowerCase(), sort = $('collection-sort').value;
  const rows = all.filter(r => !query || window.DUKE_I18N.matches([r.name,r.itemId],query));
  rows.sort((a,b) => sort === 'name' ? window.DUKE_I18N.t(a.name).localeCompare(window.DUKE_I18N.t(b.name),window.DUKE_I18N.language) : sort === 'recent' ? b.last.localeCompare(a.last) : sort === 'count' ? b.count-a.count || window.DUKE_I18N.t(a.name).localeCompare(window.DUKE_I18N.t(b.name),window.DUKE_I18N.language) : ({S:0,A:1,B:2}[a.rank]??3)-({S:0,A:1,B:2}[b.rank]??3) || b.count-a.count);
  $('collection-grid').replaceChildren(...rows.slice(0, collectionLimit).map(r => {
    const card = el('article', 'collection-card'), info = el('div', 'collection-info');
    info.append(el('h3', '', r.name), badge(r.rank), el('p', '', [...r.pools].map(p => labels[p] || `其他池 ${p}`).join(' · ')), el('small', '', `最近获取 ${r.last.slice(0,10)}`));
    if(kind === 'agent' && metadata(r)?.id) { const link=el('a','collection-agent-link','查看角色资料 ↗'); link.href=`agents.html?v=20261114-refresh-launch-1#agent=${metadata(r).id}`; info.append(link); }
    card.append(avatar(r), info, el('strong', 'collection-count', `×${number(r.count)}`)); return card;
  }));
  if (!rows.length) $('collection-grid').append(el('p', 'collection-empty', query ? '没有找到匹配的记录。' : `还没有可识别的${kind === 'agent' ? '代理人' : '音擎'}记录。请导入带 item_id 或 item_type 的文件。`));
  $('collection-more').hidden = rows.length <= collectionLimit;
  $('collection-more').textContent = `继续查看 · 已展示 ${Math.min(rows.length,collectionLimit)} / ${rows.length} 种`;
  const unclassified = account.records.filter(r => itemType(r) === 'unknown').length;
  $('collection-note').textContent = `这里只汇总调频所得，游戏赠送、商店兑换等不包含在内。获取次数不等同于当前影画或叠影等级。${unclassified ? ` 有 ${number(unclassified)} 条物品类型暂未识别，未计入总览。` : ''}`;
}
function renderRating(account) {
  const rating = rateLuck(account, ['agents','engines'].includes(selectedTab) ? {kind:selectedTab==='agents'?'agent':'engine',resolveType:itemType} : {poolId:selectedTab});
  const result = el('div','luck-result'), grade = el('strong','luck-grade',rating.grade || '—');
  grade.dataset.grade = rating.grade || 'pending';
  result.append(el('span','luck-kicker','本站娱乐评级'), grade, el('h3','luck-title',rating.title), el('span','luck-sample',rating.sampleCount ? `${rating.sampleCount} 个有效区间${rating.provisional ? ' · 样本较少，暂定评级' : ''}` : '等待更多记录'));
  const details = el('div','luck-details'), reasons = el('ul','luck-reasons');
  details.append(el('h3','','为什么是这个评级？'));
  for(const reason of rating.reasons.slice(0,3)) reasons.append(el('li','',reason));
  details.append(reasons);
  const basis = el('details','luck-basis'); basis.append(el('summary','','查看六档判断依据与样本说明'));
  if(rating.reasons.length>3) {const rest=el('ul','luck-reasons');for(const reason of rating.reasons.slice(3)) rest.append(el('li','',reason));basis.append(rest);}
  const table = el('table','luck-bands'), head = el('thead'), headRow = el('tr');
  for(const label of ['评级','中文称号','判断区间']) {const cell=el('th','',label);cell.scope='col';headRow.append(cell);}
  head.append(headRow); table.append(head);
  const body=el('tbody');
  for(const band of rating.bands) {const row=el('tr');if(band.grade===rating.grade)row.dataset.current='true';row.append(el('td','',band.grade),el('td','',band.title),el('td','',band.description));body.append(row);}
  table.append(body);basis.append(table);details.append(basis,el('p','luck-note',rating.note));
  $('luck-panel').replaceChildren(result,details);
}
function render() {
  const account = active();
  tuningWorkspace?.sync({account,pairs:selectedTab==='up'});
  $('demo-banner').hidden = !demo; $('demo-exit').hidden = !demo;
  $('empty-state').hidden = !!account; $('dashboard').hidden = !account;
  $('account-controls').hidden = !account;
  $('account-select').replaceChildren(...activeAccounts().map(a => {
    const option = el('option', '', demo ? '示例账号 · 虚构记录' : `UID ${a.uid} · ${number(a.records.length)} 抽`); option.value = a.uid; return option;
  }));
  if (account) { selectedUid = account.uid; $('account-select').value = account.uid; }
  for (const id of ['export-json','export-csv','export-uigf','timezone-open','clear-account','account-select']) $(id).disabled = !account || busy || (!!demo && ['clear-account','timezone-open'].includes(id));
  $('import-open').disabled = busy; $('demo-open').disabled = busy; $('import-file').disabled = busy;
  if($('rng-import-open'))$('rng-import-open').disabled=busy;
  if($('link-open')) $('link-open').disabled=busy;
  if (!account) { stats = null; personalBudget?.updateContext({account:null,stats:null,catalog,demo:false}); renderGuaranteeHub(null); void renderUpPairs(null,{catalog,avatar}); return; }
  stats = analyzeAccount(account);
  personalBudget?.updateContext({account,stats,catalog,demo:!!demo});
  renderGuaranteeHub(account);
  renderTabs(account);
  renderOverview($('tuning-overview'), account, {stats, catalog, itemType, itemName, avatar, demo:!!demo});
  const collection = ['agents','engines'].includes(selectedTab);
  const pairs = selectedTab==='up';
  $('up-pair-panel').hidden=!pairs;
  $('summary-cards').hidden=pairs;$('luck-panel').hidden=pairs;
  if(pairs){
    $('selected-guarantee').replaceChildren();$('selected-guarantee').hidden=true;
    $('pool-panel').hidden=true;$('collection-panel').hidden=true;
    $('pool-title').textContent='角色与专武';
    $('pool-description').textContent=`${demo?'虚构示例':'当前账号'} · 分别查看逐次出金、已知 UP 花费和欧非评价`;
    void renderUpPairs(account,{catalog,avatar});return;
  }
  const selectedGuarantee=$('selected-guarantee');selectedGuarantee.replaceChildren();selectedGuarantee.hidden=collection;
  if(!collection){
    if(['2','3'].includes(selectedTab)){
      const shortcut=el('a','guarantee-shortcut','查看上方大小保底判断与解释 ↑');shortcut.href='#guarantee-hub';selectedGuarantee.append(shortcut);
    }else renderGuarantee(selectedGuarantee,account,stats.pools.find(p=>p.id===selectedTab)||POOL_META[selectedTab]||{id:selectedTab},{catalog,includeGuide:false});
  }
  $('pool-panel').hidden = collection; $('collection-panel').hidden = !collection;
  $('pool-title').textContent = labels[selectedTab] || `其他池 ${selectedTab}`;
  $('pool-description').textContent = `${demo ? '虚构示例' : '此账号'}共收录 ${number(account.records.length)} 抽 · ${account.timezone == null ? '原记录时区未设置' : `原记录时区 UTC${account.timezone >= 0 ? '+' : ''}${account.timezone}`} · 时间保持原文`;
  renderRating(account);
  if (collection) { renderCollection(account); return; }
  const pool = stats.pools.find(p => p.id === selectedTab), counts = pool?.rankCounts || {S:0,A:0,B:0,unknown:0}, total = pool?.count || 0;
  summary([
    ['已导入抽数',number(total),counts.unknown ? `含 ${number(counts.unknown)} 条未知品质` : '当前频段 · 所选账号'],
    ...[['S 级获取',counts.S],['A 级获取',counts.A],['B 级获取',counts.B]].map(([label,count]) => [label,number(count),total ? `占 ${(count / total * 100).toFixed(1)}%` : '等待导入记录'])
  ]);
  renderPity(pool, account); renderHistory(account);
}

async function acceptRecords(incoming,{linkCheckpoint,expectedRevision,expectedAccounts}={}) {
    const result = await updateAccounts(current => ({...mergeAccounts(current, incoming.accounts),...(linkCheckpoint?{linkCheckpoint}:{})}),{expectedRevision,expectedAccounts});
    accounts = result.accounts; demo = null; selectedUid = incoming.accounts[0]?.uid || selectedUid;
    tuningWorkspace?.select('records');
    const next = accounts.find(a => a.uid === selectedUid);
    if (next && !['up','agents','engines'].includes(selectedTab) && !next.records.some(r => r.pool === selectedTab)) selectedTab = poolOrder.find(p => next.records.some(r => r.pool === p)) || next.records[0]?.pool || '2';
    page = 0;
    channel?.postMessage('changed');
    const warnings = [...new Set([...incoming.warnings,...result.warnings])];
    announce(`已导入：新增 ${number(result.added)} 条，重复 ${number(result.duplicates)} 条。${persistent ? '记录已保存在此浏览器。' : '此浏览器无法保存记录，当前仅临时显示，请及时导出完整备份。'}${warnings.length ? ` ${warnings.join(' ')}` : ''}`, warnings.length || !persistent ? 'warning' : 'success');
    // Refreshing a demo entry after a real import should show the real archive.
    try {if(new URL(location.href).searchParams.has('demo')) {const url=new URL(location.href);url.searchParams.delete('demo');history.replaceState(null,'',url);}}catch { /* A restricted history API does not undo a saved import. */ }
    return {...result,persistent};
}
async function importFile(file) {
  if (busy || !file) return;
  busy = true; render();
  announce(`正在读取 ${file.name}…`);
  try {
    if (file.size > IMPORT_LIMITS.bytes) throw new Error('文件超过 20 MB，请拆分后导入。');
    const text=await file.text();let data=null;
    if(text.replace(/^\uFEFF/,'').trimStart().startsWith('{')){try{data=JSON.parse(text.replace(/^\uFEFF/,''));}catch{/* parseImport gives the standard malformed-file error. */}}
    if(isRngBackup(data)){
      const snapshot=await readImportState();
      const incoming=await reviewRngMigration(text,file.name,snapshot,catalog);
      if(incoming)await acceptRecords(incoming,{expectedRevision:snapshot.revision,expectedAccounts:snapshot.accounts});
      else announce('已取消迁入，本地档案保持不变。');
    }else await acceptRecords(parseImport(text, file.name));
  } catch (error) {
    announce(`导入未完成：${error.message} 原有记录已保留。`, 'error');
  } finally { $('import-file').value = ''; finishUpdate(); }
}
function download(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], {type}));
  const anchor = el('a'); anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function safeFilename(uid) { return String(uid).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,80); }
function exportFile(kind) {
  const account = active(); if (!account) return;
  try {
    const prefix = demo ? '示例-' : '', date = new Date().toISOString().slice(0,10);
    if (kind === 'csv') download(exportCSV(account), `${prefix}调频记录-${safeFilename(account.uid)}-${date}.csv`, 'text/csv;charset=utf-8');
    else download(JSON.stringify(kind === 'uigf' ? exportUIGF(activeAccounts()) : exportBackup(activeAccounts())), `${prefix}${kind === 'uigf' ? 'UIGF' : 'DUKE 调频完整备份'}-${date}.json`, 'application/json;charset=utf-8');
    announce(kind === 'csv' ? '已导出所选账号 CSV。建议同时保存完整备份，避免表格软件改写长数字 ID。' : `已导出${demo ? '示例记录' : '所有本地账号'}${kind === 'uigf' ? '的 UIGF 文件' : '的完整备份'}。`, 'success');
  } catch (error) { announce(error.message, 'error'); }
}
function createDemo() {
  const list = Object.values(catalog), by = (type, rank) => list.filter(i => i.type === type && i.rank === rank);
  const fallback = {
    agent:{S:{id:'1021',name:'猫又',type:'agent',rank:'S'},A:{id:'1011',name:'安比',type:'agent',rank:'A'}},
    engine:{S:{id:'14102',name:'钢铁肉垫',type:'engine',rank:'S'},A:{id:'13101',name:'德玛拉电池Ⅱ型',type:'engine',rank:'A'},B:{id:'12001',name:'「月相」-朔',type:'engine',rank:'B'}},
    bangboo:{S:{id:'50001',name:'鲨牙布',type:'bangboo',rank:'S'},A:{id:'50002',name:'纸袋布',type:'bangboo',rank:'A'},B:{id:'demo-b',name:'邦布调频 B 级物品',type:'material',rank:'B'}}
  };
  const specs = [{pool:'2',n:238,golds:[34,71,110,168,213]},{pool:'3',n:156,golds:[28,63,103,144]},{pool:'1',n:103,golds:[42,89]},{pool:'5',n:92,golds:[65]},{pool:'102',n:99,golds:[78]},{pool:'103',n:94,golds:[67]}];
  const records = []; let counter = 0;
  for (const spec of specs) {
    let lastA = 0;
    for (let i=1;i<=spec.n;i++) {
      const rank = spec.golds.includes(i) ? 'S' : i-lastA >= 9 ? 'A' : 'B';
      if (rank !== 'B') lastA = i;
      const type = spec.pool === '5' && rank !== 'B' ? 'bangboo' : rank === 'B' || ['3','103'].includes(spec.pool) || spec.pool === '1' && i%2 === 0 && !spec.golds.includes(i) ? 'engine' : 'agent';
      const candidates = by(type, rank);
      let item = candidates[(i*7+counter) % (candidates.length || 1)] || fallback[type]?.[rank] || {id:'demo-material',name:'邦布调频材料（示例）',rank:'B'};
      // Fictional, but use valid UP/off outcomes for this sample's August banner
      // so the demo can also explain ordinary small/guaranteed pity states.
      if(rank==='S' && spec.pool==='2') item=catalog[['1581','1021','1581','1581','1021'][spec.golds.indexOf(i)]]||item;
      if(rank==='S' && spec.pool==='3') item=catalog[['14158','14102','14158','14158'][spec.golds.indexOf(i)]]||item;
      records.push({uid:'DEMO',id:String(9000000000000000000n + BigInt(++counter)),pool:spec.pool,name:item.name,itemId:item.id,rank,itemType:{agent:'代理人',engine:'音擎',bangboo:'邦布'}[type]||'材料',time:new Date(Date.UTC(2026,7,1,10,counter)).toISOString().slice(0,19).replace('T',' ')});
    }
  }
  return {uid:'DEMO',timezone:8,lang:'zh-cn',records};
}
function setup() {
  $('import-open').onclick = () => $('import-file').click();
  $('import-file').onchange = () => importFile($('import-file').files[0]);
  $('demo-open').onclick = () => { demo = createDemo(); selectedUid = demo.uid; selectedTab = '2'; page = 0; render(); announce(''); }; // the demo banner already explains this
  $('demo-exit').onclick = () => { demo = null; selectedUid = accounts[0]?.uid || ''; page=0; render(); announce('已退出示例，回到你的本地记录。'); };
  $('account-select').onchange = () => { selectedUid = $('account-select').value; page=0; render(); };
  $('export-json').onclick = () => exportFile('backup'); $('export-csv').onclick = () => exportFile('csv'); $('export-uigf').onclick = () => exportFile('uigf');
  $('record-search').oninput = $('rank-filter').onchange = () => { page=0; renderHistory(active()); };
  $('collection-search').oninput = $('collection-sort').onchange = () => { collectionLimit=48; renderCollection(active()); };
  $('collection-more').onclick = () => { collectionLimit+=48; renderCollection(active()); };
  $('history-prev').onclick = () => { page--; renderHistory(active()); };
  $('history-next').onclick = () => { page++; renderHistory(active()); };
  $('download-template').onclick = () => download('\uFEFFuid,id,gacha_type,time,rank_type,name,item_id,item_type,timezone,lang\r\n100000001,9000000000000000001,2,2026-08-01 12:00:00,3,安比,1011,代理人,8,zh-cn\r\n', '调频CSV格式示例-请替换为真实记录.csv','text/csv;charset=utf-8');
  $('clear-account').onclick = async () => {
    const account = active(); if (!account || demo || busy) return;
    if (!window.confirm(`清除本浏览器中 UID ${account.uid} 的 ${account.records.length} 条记录？请先导出完整备份。其他账号不受影响。`)) return;
    busy=true; render();
    try { accounts = (await updateAccounts(current => ({accounts:current.filter(a => a.uid !== account.uid)}))).accounts; selectedUid = accounts[0]?.uid || ''; channel?.postMessage('changed'); announce('已清除所选账号的本地记录。'); }
    catch (error) { announce(`清除失败：${error.message}`, 'error'); }
    finally { finishUpdate(); }
  };
  const unknownZone = el('option','','请选择记录所属时区'); unknownZone.value=''; $('timezone-select').append(unknownZone);
  for(let z=-12;z<=14;z++) { const option=el('option','',`UTC${z>=0?'+':''}${z}${z===8?'（中国标准时间）':''}`); option.value=String(z); $('timezone-select').append(option); }
  $('timezone-open').onclick = () => { $('timezone-select').value = active()?.timezone == null ? '' : String(active().timezone); $('timezone-dialog').showModal(); };
  $('timezone-close').onclick = () => $('timezone-dialog').close();
  $('timezone-save').onclick = async () => {
    const account = active(); const value = $('timezone-select').value; if(!account||demo||busy) return;
    if(value==='') { $('timezone-select').focus(); announce('请选择原始记录所属的时区。', 'warning'); return; }
    busy=true;
    try {
      accounts=(await updateAccounts(current=>{const next=current.map(a=>a.uid===account.uid?{...a,timezone:Number(value)}:a);exportBackup(next);return {accounts:next};})).accounts;
      channel?.postMessage('changed'); $('timezone-dialog').close(); announce('已标注记录所属时区。时间文字保持原样，没有转换时间。');
    } catch(error) { announce(`保存时区失败：${error.message}`, 'error'); }
    finally { finishUpdate(); }
  };
  const zone=$('drop-zone'); let depth=0;
  zone.addEventListener('dragenter',e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();depth++;zone.dataset.dragging='true';}});
  zone.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault();});
  zone.addEventListener('dragleave',()=>{if(--depth<=0){depth=0;delete zone.dataset.dragging;}});
  zone.addEventListener('drop',e=>{e.preventDefault();depth=0;delete zone.dataset.dragging;if(e.dataTransfer.files.length!==1){announce('请一次拖入一个 JSON 或 CSV 文件。','warning');return;}importFile(e.dataTransfer.files[0]);});
  // Keep dropped files outside the drop zone from navigating away from the page.
  document.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault();});
  document.addEventListener('drop',e=>{if(e.dataTransfer.files.length)e.preventDefault();});
  channel?.addEventListener('message',syncAccounts);
}

async function initialize(){
try {
  announce('正在加载调频工具…');
  const results = await Promise.allSettled([openStorage(), fetchTuningJSON('tuning-catalog.json?v=20261111-refresh-launch-1'), loadBannerData()]);
  accounts = results[0].status === 'fulfilled' ? results[0].value : [];
  if(results[1].status==='fulfilled') {
    catalog = results[1].value.items || {};
    for(const item of Object.values(catalog)) {
      if(item.name) names.set(item.name,item);
      for(const alias of item.aliases||[]) if(!names.has(alias)) names.set(alias,item);
    }
  } else catalogError=true;
  if(!$('collection-note')) { const note=el('p','collection-note'); note.id='collection-note'; $('collection-panel').append(note); }
  const more=el('button','secondary-button'); more.id='collection-more'; more.type='button'; more.hidden=true; $('collection-note').before(more);
   mountExpectation();mountUpPairs();mountRngMigration({chooseFile:()=>$('import-file').click()});personalBudget=mountPersonalBudget($('personal-budget'));window.tuningPersonalBudget=personalBudget;setup();
  setupLinkImport({getImportState:readImportState,onRecords:(data,options)=>acceptRecords(parseImport(JSON.stringify(data),'official-history.json'),{...options,linkCheckpoint:data.linkCheckpoint}),onBusy:value=>{if(value){busy=true;render();}else finishUpdate();},onMessage:announce});
  tuningWorkspace=mountTuningWorkspace();
  render();
  const notices=[];
  if(!persistent)notices.push('浏览器本地存储不可用。可以临时分析，但离开前请导出完整备份。');
  if(catalogError)notices.push('图标目录暂未加载，仍可导入记录和查看基础统计。');
  if(results[2].status==='rejected')notices.push('卡池资料暂未加载，大小保底与 UP 身份暂无法核实；可以先查看基础统计，网络恢复后刷新重试。');
  announce(notices.join(' ')||'记录仅保存在本浏览器。可以导入文件，或先体验示例。',notices.length?'warning':'info');
  window.tuningAnalysis = {getState:()=>({ready:true,demo:!!demo,uid:active()?.uid,tab:selectedTab,persistent,total:active()?.records.length||0,accountCount:accounts.length,stats:stats?cloneData(stats):null,catalogCount:Object.keys(catalog).length})};
  if(new URL(location.href).searchParams.get('demo')==='1') $('demo-open').click();
  tuningWorkspace.applyLocation();
  const revealPairs=()=>{if(location.hash==='#up-pair-panel'&&active()){tuningWorkspace.select('records');$('pool-tabs').querySelector('[data-pool="up"]')?.click();requestAnimationFrame(()=>$('up-pair-panel').scrollIntoView({block:'start'}));}};
  addEventListener('hashchange',revealPairs);revealPairs();
} catch(error) { announce(`页面初始化失败：${error.message}。请刷新重试。`,'error'); }
}
void initialize();

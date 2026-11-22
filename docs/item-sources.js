const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const maps={janus:'雅努斯幻境',suburbs:'城郊幻境',both:'两张地图',unknown:'地图未核实'};
const containers={electronic:'电子保险箱',mechanical:'机械保险箱',gear:'武备箱',briefcase:'公文包',trash:'垃圾桶',enemy:'敌人掉落',scattered:'场景散落物',loose:'场景散落物',keyroom:'门禁房',unknown:'容器类型未核实',medical:'医疗站',golden_bangboo:'黄金邦布',boss:'首领掉落',large_strongbox:'大型保险箱（类型未注明）',small_strongbox:'小型保险箱（类型未注明）',shadow_enemy:'黑影人形敌人掉落'};
const difficulties={'high-risk':'高危',hard:'困难',normal:'普通',all:'未限定难度',unknown:'难度未标明'};
const evidenceLabels={client_config:'配置候选',observed_video:'其他玩家实机记录',guide:'其他玩家记录',uncertain:'待核实'};
let pending;
function load(){return pending ||= fetch('item-sources.json?v=20261021-map-launch-1').then(async r=>{if(!r.ok)throw Error('产出资料暂未加载');return r.json();}).catch(error=>{pending=null;throw error;});}
function safeLink(link) { try{const u=new URL(link.url);return ['https:','http:'].includes(u.protocol)?`<a href="${escape(u.href)}" target="_blank" rel="noreferrer">${escape(link.title||'查看依据')} ↗</a>`:'';}catch{return '';} }
function sourceRow(source) {
  const map=maps[source.map]||source.mapLabel||'地图未核实';
  const types=source.containerTypes?.length?source.containerTypes.map(type=>containers[type]||type):['容器类型未核实'];
  const status=evidenceLabels[source.evidenceKind]||source.evidenceLabel||'来源记录';
  return `<article class="drop-source-row"><div class="drop-source-heading"><b>${escape(map)}</b><span>${escape(status)}</span></div><div class="drop-container-tags">${types.map(t=>`<span>${escape(t)}</span>`).join('')}</div><p class="drop-difficulty">${escape(difficulties[source.difficulty]||source.difficultyLabel||'难度未标明')}</p>${source.note?`<p class="drop-note">${escape(source.note)}</p>`:''}${source.links?.length?`<div class="drop-links">${source.links.map(safeLink).join('')}</div>`:''}</article>`;
}
function communityMapMarkup(info) {
  const rows=(info.mapEvidence||[]).filter(row=>!row.excludeFromMapSummary), guide=info.guideReference;
  const validMap=id=>id==='suburbs'||id==='janus';
  const recordedMaps=[...new Set(rows.map(row=>row.map).filter(validMap))];
  const guideMaps=(guide?.excludeFromMapSummary?[]:guide?.maps||[]).filter(validMap);
  const mapIds=[...new Set([...recordedMaps,...guideMaps])];
  const hasGuideOnlyMap=mapIds.some(id=>!recordedMaps.includes(id));
  const rank={observed_named:0,observed_icon:1,player_report:2,user_report:3};
  const hasReports=rows.some(row=>['player_report','user_report'].includes(row.kind));
  const title=mapIds.length===2?(hasGuideOnlyMap?'攻略汇总：两张地图均可出':'两张地图均有来源记录'):mapIds.length===1?maps[mapIds[0]]:'产出地图待核实';
  const note=info.summaryNote||(hasGuideOnlyMap?'攻略中的地图说法与具体取得记录分别标注，尚未逐件补齐两图实机。':mapIds.length===1?'目前收录这张地图的来源；另一张尚未核实，不代表仅限此图。':mapIds.length===2?'两图的证据等级分别标注；来源记录不代表每局必出。':'已收录物品资料，现有线索尚不足以确定产出地图。');
  const requirement=info.acquisitionRequirement;
  const requirementMarkup=requirement?`<section class="drop-map-summary drop-acquisition-requirement" aria-label="特殊获取条件"><span class="drop-map-kicker">获取条件 · ${escape(requirement.label)}</span><h4>${escape(requirement.title)}</h4><p>${escape(requirement.note)}</p><p class="drop-footnote">${escape(requirement.limitation)}</p></section>`:'';
  return `${requirementMarkup}<div class="drop-map-summary" data-map-status="${rows.length?'community':guideMaps.length?'community_guide':'pending'}"><span class="drop-map-kicker">产出地图 · ${escape(info.checkedVersion)} 资料整理</span><h4>${escape(title)}</h4><div class="drop-map-evidence">${mapIds.map(id=>{const row=rows.filter(r=>r.map===id).sort((a,b)=>(rank[a.kind]??9)-(rank[b.kind]??9))[0];return `<div class="drop-map-evidence-row" data-evidence-kind="${escape(row?.kind||'community_guide')}"><strong>${escape(maps[id])}</strong><span>${escape(row?.label||`攻略说法 · ${guide.author}`)}</span>${row?'':'<span>尚未补到具体取得记录</span>'}</div>`;}).join('')}</div>${hasReports?'<p>含玩家报告或用户补充，具体依据见下方。</p>':''}<p class="drop-footnote">${escape(note)}</p><p class="drop-footnote">仅统计局内获取，不含撤离后的随机奖励。</p></div>`;
}
function communityGuideMarkup(guide) {
  if(!guide)return '';
  const moreOften=maps[guide.reportedMoreOftenMap];
  return `<section class="drop-guide-reference" aria-label="视频与评论地图补充"><h4>${guide.excludeFromMapSummary?'有争议的攻略说法':'攻略汇总'} · ${escape(guide.author)}</h4><p>${escape(guide.note)}</p>${moreOften&&!guide.excludeFromMapSummary?`<p class="drop-guide-experience">作者个人经验：更常在${escape(moreOften)}遇到。<span>未统计掉率，不代表另一图不能出。</span></p>`:''}<div class="drop-links">${(guide.links||[]).map(safeLink).join('')}</div><details class="drop-more"><summary>这条攻略的依据与适用范围</summary><p>${escape(guide.limitation||'社区攻略说法，尚无逐件双图实机记录或完整掉落配置证明。')}</p><p>整理版本：${escape(guide.version)}；本次核对：${escape(guide.updatedAt)}。评论仅核对了公开可读的 7 条评论及预览，未读完全部评论。</p></details></section>`;
}
function communityEvidenceRow(row) {
  const difficulty=row.difficulty&&row.difficulty!=='unknown'?` · ${difficulties[row.difficulty]||row.difficulty}`:'';
  const attribution=[row.author,row.publishedAt?.slice(0,10)].filter(Boolean).join(' · ');
  return `<article class="drop-source-row drop-community-row"><div class="drop-source-heading"><b>${escape(maps[row.map]||'地图未核实')}${escape(difficulty)}</b><span>${escape(row.label)}</span></div>${attribution?`<p class="drop-note">${escape(attribution)}</p>`:''}<p class="drop-note">${escape(row.note)}</p>${row.links?.length?`<div class="drop-links">${row.links.map(safeLink).join('')}</div>`:''}</article>`;
}
function communityEvidenceMarkup(info) {
  const rows=info.mapEvidence||[],leads=info.leads||[];
  return `${communityGuideMarkup(info.guideReference)}<details class="drop-more drop-community-evidence"><summary>查看具体取得记录与原始来源${rows.length?` · ${rows.length} 条`:''}</summary><p class="drop-note">实机观察、玩家报告和用户补充按各自依据标注，均为本站整理。公开视频可能包含剪辑；收藏或仓库截图仅证明持有，地图来源仍是作者自述。</p>${!rows.length&&info.guideReference?'<p class="drop-note">暂未收录具体取得记录，当前地图信息来自上方攻略汇总。</p>':''}<div class="drop-source-list">${rows.map(communityEvidenceRow).join('')}</div>${leads.length?`<details class="drop-more"><summary>待核实线索 · ${leads.length} 条</summary><p class="drop-note">以下线索尚未纳入上方地图结论。</p><div class="drop-source-list">${leads.map(communityEvidenceRow).join('')}</div></details>`:''}<div class="drop-links"><a href="research/item-map-community-3.2.json?v=20260919-transit-1" target="_blank" rel="noreferrer">本次地图资料与证据分级 ↗</a></div></details>`;
}
function officialMapMarkup(info) {
  const mapIds=(info.officialMaps||[]).filter(id=>maps[id]);
  const conflict=info.status==='conflicting_evidence';
  const title=conflict?'获取地图存在冲突':mapIds.length===2?'任意空洞':mapIds.length===1?maps[mapIds[0]]:'按玩法获取';
  const previous=(info.configuredMaps||[]).map(id=>maps[id]||id).join(' / ');
  return `<div class="drop-map-summary" data-map-status="${escape(info.status)}"><span class="drop-map-kicker">${escape(info.checkedVersion)} · <span>游戏内获取说明</span></span><h4>${escape(title)}</h4><p>${escape(info.description)}</p>${conflict?`<p><span>获取说明：</span><span>${escape(mapIds.map(id=>maps[id]).join(' / '))}</span></p><p><span data-i18n-en="Current client configuration:">当前客户端配置：</span> <span>${escape(info.configuredMapsVersion||'')} · </span><span>${escape(previous)}</span></p><p class="drop-footnote"${info.conflictNoteEn?` data-i18n-en="${escape(info.conflictNoteEn)}"`:""}>${escape(info.conflictNote)}</p>`:''}<p class="drop-footnote">${escape(info.limitation)}</p></div>`;
}
function mapAvailabilityMarkup(record) {
  if(record?.mapAvailability?.evidenceKind==='client_obtain_description')return officialMapMarkup(record.mapAvailability);
  if(record?.communityAvailability)return communityMapMarkup(record.communityAvailability);
  const info=record?.mapAvailability;
  const known=['configured_candidate','observed'].includes(info?.status);
  const mapIds=known?[...new Set((info.maps||[]).filter(id=>id==='suburbs'||id==='janus'))]:[];
  const title=mapIds.length===2?'两张地图均有产出记录':mapIds.length===1?(info?.status==='configured_candidate'?`已找到${maps[mapIds[0]]}配置记录`:maps[mapIds[0]]):'产出地图待核实';
  const basis=info?.status==='configured_candidate'?`${info.checkedVersion||'当前版本'} 游戏客户端配置 · 待实机核对`:info?.status==='observed'?'其他玩家实机记录':'尚未取得完整地图依据';
  const difficulty=info?.difficultyLabel || (info?.difficulties?.length?info.difficulties.map(id=>difficulties[id]||id).join(' / '):info?.difficulty&&info.difficulty!=='unknown'?difficulties[info.difficulty]||info.difficulty:'');
  const limitation=info?.limitation || (mapIds.length===1?'已确认这张地图的来源，另一张地图尚未核实；不代表仅限此图。':mapIds.length===2?'表示存在产出来源，不代表每局必出。':'已收录物品资料；目前不能据此认定只在某张地图、或两张地图都会产出。');
  return `<div class="drop-map-summary" data-map-status="${escape(info?.status||'pending')}"><span class="drop-map-kicker">产出地图</span><h4>${escape(info?.status==='configured_candidate'&&mapIds.length===2?'两张地图均有产出配置':title)}</h4><div class="drop-map-tags">${mapIds.map(id=>`<span>${escape(maps[id])}</span>`).join('')}</div><p>${escape(basis)}</p>${difficulty?`<p>获取说明提及：${escape(difficulty)}</p>`:''}<p class="drop-footnote">${escape(limitation)}</p></div>`;
}
function discussionMarkup(discussion) {
  if(!discussion)return '';
  const sources=discussion.sources||[];
  return `<div class="drop-discussion"><p>${escape(discussion.note)}</p>${sources.length?`<p class="drop-footnote">${escape(discussion.accessNote)}</p>${sources.map(source=>`<details class="drop-more drop-discussion-source" data-source-id="${escape(source.id)}"><summary>${escape(source.platform)} · ${escape(source.label)} · 站内摘要</summary><p><strong>${escape(source.title)}</strong><br>${escape(source.author)} · ${escape(source.publishedAt)}${source.updatedAt?` · 更新于 ${escape(source.updatedAt)}`:''}</p><p>${escape(source.summary)}</p><p class="drop-footnote">${escape(source.limitation)}</p><div class="drop-links">${(source.links||[]).map(safeLink).join('')}</div></details>`).join('')}`:`<div class="drop-links">${(discussion.links||[]).map(safeLink).join('')}</div>`}</div>`;
}
function communityTableMarkup(reference) {
  if(!reference)return '';
  const mapIds=[...new Set((reference.maps||[]).filter(id=>id==='suburbs'||id==='janus'))];
  if(!mapIds.length)return '';
  const compatible=reference.crossCheck==='compatible_with_config';
  const claim=mapIds.length===2?'表中列为两张地图':`表中列为${maps[mapIds[0]]}`;
  const status=compatible?'地图分组与现有配置相符；来源仍按各自依据标注。':'已收录社区地图线索；仍需完整配置或实机记录佐证。';
  const discussion=reference.discussion;
  const reports=reference.relatedReports||[];
  return `<section class="drop-map-summary drop-table-reference" data-table-crosscheck="${escape(reference.crossCheck)}" aria-label="社区地图参考"><span class="drop-map-kicker">社区地图参考</span><h4>${escape(claim)}</h4><p>${escape(status)}</p><p>这张表不作为地图独占或每局必出的依据。</p><details class="drop-more"><summary>来源与适用范围</summary><p>原表作者：${escape(reference.originalAuthor)}；视频整理：${escape(reference.videoAuthor)}。</p><p>原评论日期：${escape(reference.originalCommentDate)}。已有物资的地图记录继续适用；表格覆盖部分已有贵重物品，3.2 新增物资另行收录。</p><p>原作者注明概率供参考、不确定；本站未采用表内比例作为掉率。</p><div class="drop-links">${(reference.links||[]).map(safeLink).join('')}<a href="research/item-map-community-table-3.1.json?v=20260912-community-sources-1" target="_blank" rel="noreferrer">本表物品与核对记录 ↗</a></div>${discussionMarkup(discussion)}</details>${reports.length?`<details class="drop-more drop-table-reports"><summary>米游社 / HoYoLAB 补充记录 · ${reports.length} 条</summary><p>各条记录分别标注版本与证据范围；玩家自述和配图不代表官方确认。</p><div class="drop-source-list">${reports.map(communityEvidenceRow).join('')}</div></details>`:''}</section>`;
}
function currentConfigurationMarkup(record) {
  const info=record?.currentConfiguredMapAvailability;
  if(!info)return '';
  const mapIds=(info.maps||[]).filter(id=>maps[id]);
  const title=mapIds.length?'配置候选地图':'地图配置链尚未闭合';
  const en=mapIds.length?'Candidate maps in client configuration':'Map configuration chain unresolved';
  return `<details class="drop-more drop-current-config" data-config-version="${escape(info.checkedVersion)}"><summary data-i18n-en="Current 3.3 client configuration review">当前 3.3 客户端配置复核</summary><div class="drop-map-summary" data-map-status="${escape(info.status)}"><span class="drop-map-kicker">${escape(info.checkedVersion)} · ${escape(info.sourceClientBuild)}</span><h4 data-i18n-en="${en}">${title}</h4>${mapIds.length?`<div class="drop-map-tags">${mapIds.map(id=>`<span>${escape(maps[id])}</span>`).join('')}</div>`:''}<p class="drop-footnote" data-i18n-en="${escape(info.limitationEn)}">${escape(info.limitation)}</p><div class="drop-links"><a href="research/map-drop-chain-3.3.json?v=20261021-map-launch-1" target="_blank" rel="noreferrer" data-i18n-en="Current configuration evidence ↗">当前配置核对记录 ↗</a></div></div></details>`;
}
function renderMapSources(record) {
  const official=record?.mapAvailability?.evidenceKind==='client_obtain_description';
  const title=official?'3.3 获取说明与配置复核':'按地图查询 · 非官方掉落表';
  const summary=`<div class="drop-title"><h3>在哪里能出</h3><span>${title}</span></div>${mapAvailabilityMarkup(record)}${currentConfigurationMarkup(record)}`;
  if(official)return summary;
  const community=record?.communityAvailability;
  return summary+(community?communityEvidenceMarkup(community):'')+communityTableMarkup(record?.communityTableReference);
}
export async function renderItemSources(item, element) {
  element.dataset.item=String(item.id);
  element.innerHTML='<h3>产出来源</h3><p class="drop-note">正在读取产出地图…</p>';
  try {
    const data=await load();if(element.dataset.item!==String(item.id))return;
    const record=data.items?.[item.id], rows=record?.sources || [];
    if(item.category==='贵重物品'||[13012,14701].includes(item.categoryId)||String(item.id)==='4311022'){
      element.innerHTML=renderMapSources(record);return;
    }
    const categoryRows=item.category==='门禁卡' ? data.categorySources?.keys || [] : [];
    const hasPlayerSources=[...rows,...categoryRows,...(record?.leads || [])].some(source=>['guide','observed_video'].includes(source.evidenceKind));
    element.innerHTML=`<div class="drop-title"><h3>产出来源</h3><span>地图 · 容器类别</span></div>${hasPlayerSources?'<p class="drop-footnote">玩家记录由其他玩家提供，本站仅整理；原作者见来源链接。</p>':''}${record?.summary?`<p class="drop-note">${escape(record.summary)}</p>`:''}${rows.length?`<div class="drop-source-list">${rows.map(sourceRow).join('')}</div><p class="drop-footnote">来源记录表示可能产出，不代表每个容器必出。未列出的来源仍可能存在。</p>`:`<p class="drop-note">${escape(record?.note || '暂未核实这件物资的地图与容器来源。')}</p>`}${record?.unverifiedNote?`<p class="drop-footnote">${escape(record.unverifiedNote)}</p>`:''}${categoryRows.length?`<details class="drop-more"><summary>房卡类别参考 · 未逐卡核实</summary><p class="drop-note">以下记录只说明“房卡类物资”的来源，不能直接当作这张房卡的产出保证。</p><div class="drop-source-list">${categoryRows.map(sourceRow).join('')}</div></details>`:''}${record?.leads?.length?`<details class="drop-more"><summary>待核对的其他玩家线索</summary><p class="drop-note">物资名称或容器类型尚未完整核对，以下保留为查证线索。</p><div class="drop-source-list">${record.leads.map(sourceRow).join('')}</div></details>`:''}<details class="drop-more"><summary>来源核验说明</summary><p class="drop-note">高危、困难和未标明难度的资料分别保留。配置候选不代表已经确认本局会产出。</p><div class="drop-links"><a href="research/item-drop-sources.json" target="_blank" rel="noreferrer">本地奖励池证据 ↗</a><a href="research/item-drop-public-evidence.md" target="_blank" rel="noreferrer">其他玩家原始资料与核验范围 ↗</a></div></details>`;
  } catch(error) { if(element.dataset.item===String(item.id))element.innerHTML=`<h3>产出来源</h3><p class="drop-note">${escape(error.message)}</p>`; }
}

import {analyzeUpPairs,UP_CHANNELS} from './tuning-up-core.js?v=20261001-planner-tuning-1';
import {classifySignal} from './tuning-summary.js?v=20261111-refresh-launch-1';
import {fetchTuningJSON} from './tuning-resources.js?v=20260909-tuning-win11-1';
import {estimateTarget,EXPECTATION_RULES,EXPECTATION_METHOD,EXPECTATION_SOURCES} from './tuning-expectation.js?v=20260909-version-3-2-1';

const $=id=>document.getElementById(id);
const el=(tag,cls='',text='')=>{const n=document.createElement(tag);n.className=cls;n.textContent=text;return n;};
const number=n=>n==null?'—':new Intl.NumberFormat('zh-CN',{maximumFractionDigits:1,minimumFractionDigits:0}).format(n);
const route=[[0,0],[0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[6,2],[6,3],[6,4],[6,5]];
let referencePromise,renderVersion=0,current=null,limit=12;
let hiddenHistoryState={uid:null,open:false,limit:30,reviewedEntries:new Set()};
const annotations=new Map();
const annotationKey=(uid,pool,id)=>JSON.stringify([uid,String(pool),String(id)]);
const labelOutcome={up:'当期 UP',off:'非 UP · 歪了',unknown:'UP 身份待核实'};
// Presentation only, per the requested analysis scope: the six standard agents
// plus Caesar, Yanagi and Zhu Yuan from the verified 3.1 custom-search candidates.
// This is not an UP/off classifier and does not exclude any record from cost.
const hiddenAnalysisAgents=new Set(['1021','1041','1071','1101','1141','1181','1211','1221','1241']);

export function mountExpectation(){
  const host=$('target-expectation');
  host.innerHTML=`<summary class="target-tool-summary"><span><span class="target-tool-icon" aria-hidden="true">＋</span><span><strong>抽数期望</strong><small>0+0 到 6+5 · 不用导入记录</small></span></span><span class="target-open-hint">展开查看 ⌄</span></summary>
    <div class="expectation-content"><p class="target-intro">想抽到什么配置？这里分别列出平均期望和最坏保底上限。</p>
      <div id="expectation-route" class="expectation-route" aria-label="常用目标档位"></div>
      <div class="expectation-hero"><div class="expectation-primary"><span class="target-eyebrow">从零开始 · 总抽数期望</span><h3><span id="expectation-target">0+1</span><span aria-hidden="true"> → </span><span class="expectation-approx">约</span> <strong id="expectation-total"></strong><small> 抽</small></h3><p id="expectation-detail"></p></div><div class="expectation-ceiling"><span>最坏保底上限</span><strong><span id="expectation-max"></span><small> 抽</small></strong><span>每次都歪，且每次都到硬保底</span></div></div>
      <div class="expectation-controls"><span>也可自由选择目标</span><label>角色影画<select id="expectation-mindscape" aria-label="目标角色影画"></select></label><label>专武叠影<select id="expectation-refinement" aria-label="目标专武叠影"></select></label><span id="expectation-copies"></span></div>
      <p class="expectation-scope">角色池、音擎池均从 <strong>0 垫抽、小保底</strong>开始；尚未拥有目标。期望是平均值，不是抽到的保证。</p>
      <div class="expectation-table-wrap" tabindex="0" role="region" aria-label="常用配置期望表"><table class="expectation-table"><thead><tr><th scope="col">目标配置</th><th scope="col">总期望抽数</th><th scope="col">比上一档增加</th><th scope="col">最坏上限</th></tr></thead><tbody id="expectation-route-body"></tbody></table></div>
      <details class="target-basis"><summary>怎么算的？查看规则与依据</summary><div id="expectation-basis"></div></details>
    </div>`;
  for(let i=0;i<=6;i++){const option=el('option','',`${i} 影 · ${i+1} 个角色`);option.value=i;$('expectation-mindscape').append(option);}
  for(let i=0;i<=5;i++){const option=el('option','',i?`${i} 叠 · ${i} 把专武`:'无专武');option.value=i;$('expectation-refinement').append(option);}
  let prior=null;
  for(const [mindscape,refinement] of route){
    const target=estimateTarget({mindscape,refinement});
    const button=el('button','',target.label);button.type='button';button.dataset.target=target.label;
    button.onclick=()=>select(mindscape,refinement);$('expectation-route').append(button);
    const row=el('tr');row.dataset.target=target.label;
    const name=el('th','',target.label);name.scope='row';
    row.append(name,el('td','',`约 ${number(target.totalExpected)} 抽`),el('td','',prior?`+${number(target.totalExpected-prior.totalExpected)} 抽`:'起点'),el('td','',`${number(target.maxPulls)} 抽`));
    $('expectation-route-body').append(row);prior=target;
  }
  const basis=$('expectation-basis');
  basis.append(el('p','',EXPECTATION_METHOD.notation),el('p','',EXPECTATION_METHOD.formula));
  const list=el('ul');
  for(const [key,title] of [['character','角色'],['weapon','专武']]){const rule=EXPECTATION_RULES[key];list.append(el('li','',`${title}：S 级综合概率 ${number(rule.sConsolidated*100)}%，小保底 UP 概率 ${number(rule.featuredSChance*100)}%；每个目标 UP 约 ${number(rule.expectedPerFeatured)} 抽。`));}
  list.append(...EXPECTATION_METHOD.assumptions.map(text=>el('li','',text)));basis.append(list,el('p','',EXPECTATION_METHOD.scope),el('p','',EXPECTATION_METHOD.precision));
  const sources=el('p','target-sources','概率依据：');for(const source of EXPECTATION_SOURCES.slice(0,2)){const a=el('a','',source.label+' ↗');a.href=source.url;a.target='_blank';a.rel='noreferrer';sources.append(a);}basis.append(sources);
  function select(mindscape,refinement){
    const result=estimateTarget({mindscape,refinement});
    $('expectation-mindscape').value=mindscape;$('expectation-refinement').value=refinement;
    $('expectation-target').textContent=result.label;$('expectation-total').textContent=number(result.totalExpected);$('expectation-max').textContent=number(result.maxPulls);
    $('expectation-detail').textContent=`角色约 ${number(result.characterExpected)} 抽 ＋ 专武约 ${number(result.weaponExpected)} 抽`;
    $('expectation-copies').textContent=`共 ${result.characterCopies} 个角色本体、${result.weaponCopies} 把专武`;
    for(const button of $('expectation-route').children)button.setAttribute('aria-pressed',String(button.dataset.target===result.label));
    for(const row of $('expectation-route-body').children)row.dataset.selected=String(row.dataset.target===result.label);
  }
  $('expectation-mindscape').onchange=$('expectation-refinement').onchange=()=>select(Number($('expectation-mindscape').value),Number($('expectation-refinement').value));
  select(0,1);
  function reveal(){if(location.hash==='#target-expectation'){host.open=true;requestAnimationFrame(()=>host.scrollIntoView({block:'start'}));}}
  addEventListener('hashchange',reveal);reveal();
}

export function mountUpPairs(){
  $('up-pair-panel').innerHTML=`<div class="up-pair-heading"><div><p class="target-eyebrow">角色与专属音擎，一起看</p><h3>每一次相遇，花了多少抽？</h3><p class="target-intro">按实际卡池分别查看获取记录。普通池统计含歪的 UP 花费，复刻池单独查看出金表现。</p></div><a href="#target-expectation">查看 0+0—6+5 抽数期望 ↗</a></div>
    <div id="up-pair-totals" class="up-pair-totals"></div>
    <div id="up-pair-ledger" class="up-ledger" aria-label="普通卡池抽数对账"></div>
    <div class="up-pair-controls"><label><span class="sr-only">搜索角色或专武</span><input type="search" id="up-pair-search" placeholder="搜索角色或专武" autocomplete="off"></label><label><span class="sr-only">排序</span><select id="up-pair-sort"><option value="recent">最近获取</option><option value="cost">已知 UP 花费</option><option value="count">获取次数</option><option value="name">角色名称</option></select></label><button id="up-pair-reset-annotations" class="quiet-button" type="button" hidden>清除本次标注</button><span id="up-pair-count" role="status"></span></div>
    <p id="up-pair-status" class="target-intro" role="status"></p><div id="up-pair-grid" class="up-pair-grid"></div><button id="up-pair-more" class="secondary-button" type="button" hidden>继续查看</button>
    <details class="target-basis"><summary>抽数口径与欧非判断依据</summary><div id="up-pair-basis"></div></details>`;
  $('up-pair-search').oninput=$('up-pair-sort').onchange=()=>{limit=12;drawPairs();};
  $('up-pair-more').onclick=()=>{limit+=12;drawPairs();};
  $('up-pair-reset-annotations').onclick=()=>{if(!current)return;for(const key of annotations.keys())if(JSON.parse(key)[0]===current.account.uid)annotations.delete(key);current.analysis=null;drawPairs();};
}

function references(){
  if(!referencePromise)referencePromise=Promise.all(['tuning-up-pairs.json?v=20261021-v33-launch-1','tuning-banners.json?v=20261111-refresh-launch-1'].map(file=>fetchTuningJSON(file))).then(([mapping,rules])=>({pairs:mapping.pairs,rules})).catch(error=>{referencePromise=null;throw error;});
  return referencePromise;
}

export async function renderUpPairs(account,{catalog,avatar}){
  const version=++renderVersion;
  if(!account){current=null;hiddenHistoryState={uid:null,open:false,limit:30,reviewedEntries:new Set()};for(const id of ['up-pair-grid','up-pair-totals','up-pair-ledger'])$(id).replaceChildren();return;}
  if(hiddenHistoryState.uid!==account.uid)hiddenHistoryState={uid:account.uid,open:false,limit:30,reviewedEntries:new Set()};
  if(current?.account.uid!==account.uid){limit=12;$('up-pair-search').value='';for(const id of ['up-pair-grid','up-pair-totals','up-pair-ledger'])$(id).replaceChildren();}
  current=null;$('up-pair-status').textContent='正在整理角色和专武记录…';
  try{
    const reference=await references();if(version!==renderVersion)return;
    current={account,catalog,avatar,...reference};drawPairs();
  }catch(error){if(version!==renderVersion)return;for(const id of ['up-pair-grid','up-pair-totals','up-pair-ledger'])$(id).replaceChildren();$('up-pair-more').hidden=true;$('up-pair-status').textContent=error.message;}
}

function rateBadge(rating,label){
  const node=el('div','up-luck');node.dataset.grade=rating?.grade||'pending';
  node.append(el('span','',label),el('strong','',rating?.grade||'—'),el('span','',rating?`${rating.title}${rating.provisional?' · 暂定':''}`:'样本不足，暂不评级'));
  return node;
}

function outcomeControl(record,onChange){
  if(!['2','3'].includes(String(record.pool)))return el('span','up-history-rerun','复刻 · 特殊保底');
  const uid=current.account.uid,key=annotationKey(uid,record.pool,record.id);
  const original=classifySignal(record,current.account,current.catalog,current.rules),select=el('select');
  select.dataset.outcomeId=record.id;select.dataset.outcomePool=record.pool;
  select.setAttribute('aria-label',`${record.name} ${record.time} 的 UP 身份`);
  for(const [value,label] of [['',`自动：${labelOutcome[original]}`],['up','手动：是 UP'],['off','手动：歪了']]){
    const option=el('option','',label);option.value=value;select.append(option);
  }
  select.value=annotations.get(key)||'';
  select.onchange=()=>{
    if(!current||current.account.uid!==uid)return;
    if(select.value)annotations.set(key,select.value);else annotations.delete(key);
    current.analysis=null;onChange();
  };
  return select;
}

function partSummary(summary,{name,itemId},kind){
  const box=el('section','up-part');box.dataset.kind=kind;
  const heading=el('div','up-part-heading');heading.append(current.avatar({itemId,name,rank:'S'}),el('div','',kind==='agent'?'代理人':name));box.append(heading);
  if(!summary.sCount){box.append(el('p','up-part-empty',kind==='agent'?'还没有这个角色的限定频段记录':'还没有这把专武的限定频段记录'));return box;}
  for(const channel of summary.channels){
    const section=el('section','up-channel');section.dataset.pool=channel.pool;
    section.dataset.mode=channel.mode;
    section.append(el('h5','up-channel-heading',channel.label));
    const metrics=el('dl','up-part-metrics');
    const values=channel.mode==='ordinary'
      ?[['平均每 UP · 含歪',channel.averageUpPulls,'抽',true],['已知 UP 花费 · 含歪',channel.completeUpCount?channel.totalUpPulls:null,'抽',true],['获取次数',channel.sCount,'次'],['平均出金',channel.averageSInterval,'抽']]
      :[['获取次数',channel.sCount,'次'],['平均出金',channel.averageSInterval,'抽']];
    for(const [label,value,unit,primary] of values){
      const row=el('div',primary?'up-metric-primary':''),amount=el('dd','',number(value));if(value!=null)amount.append(el('small','',unit));row.append(el('dt','',label),amount);metrics.append(row);
      if(primary)row.append(el('small','up-metric-scope',label.startsWith('平均')?`仅 ${channel.completeUpCount} 个完整周期`:'仅已核算部分合计'));
    }
    section.append(metrics);
    if(channel.mode==='ordinary'){
      const missing=channel.confirmedUpCount-channel.completeUpCount,coverage=el('div','up-cost-coverage');
      coverage.dataset.partial=String(missing>0||channel.unverifiedCount>0);
      coverage.append(el('strong','',`已核算 ${channel.completeUpCount} / ${channel.confirmedUpCount} 次 UP`));
      if(channel.completeUpCount)coverage.append(el('p','',`${number(channel.totalUpPulls)} 抽 ÷ ${channel.completeUpCount} 个完整周期 ＝ ${number(channel.averageUpPulls)} 抽；均值包含周期内歪出的抽数。`));
      if(missing){
        const reasons=new Map();
        for(const a of channel.acquisitions.filter(a=>a.outcome==='up'&&a.fullUpCost===null))reasons.set(a.exclusion,(reasons.get(a.exclusion)||0)+1);
        coverage.append(el('p','',`另有 ${missing} 次 UP 未计入花费：`+[...reasons].map(([reason,count])=>`${reason||'记录不完整'}（${count} 次）`).join('；')+'。'));
      }
      if(channel.unverifiedCount)coverage.append(el('p','',`另有 ${channel.unverifiedCount} 次 S 的 UP 身份待核实，也未纳入 UP 样本。`));
      if(missing||channel.unverifiedCount)coverage.append(el('p','up-coverage-limit','以下 UP 评级只评价已核算样本，不能代表全部投入。'));
      section.append(coverage,rateBadge(channel.rating,'UP 样本欧非 · 包含歪'));
      const verified=`${channel.confirmedUpCount} 次已确认 UP · ${channel.completeUpCount} 个完整 UP 周期`;
      section.append(el('p','up-part-note',verified+(channel.unverifiedCount?` · ${channel.unverifiedCount} 次待核实`:'')));
      if(!channel.completeUpCount)section.append(el('p','up-cost-incomplete','暂无法核算：缺少完整、身份已确认的 UP 周期。'));
      section.append(rateBadge(channel.sRating,'出金欧非 · 不含歪'));
      section.append(el('p','up-part-note',`出金均值和出金评价仅用 ${channel.knownSCount} 个完整 S 间隔，不含此前歪出的 S。`));
    }else{
      const note=el('p','up-rerun-note');
      note.append(el('strong','','复刻特殊保底'),document.createTextNode('此频段单独统计出金，不参与普通 UP 花费与 UP 欧非。'));
      section.append(rateBadge(channel.sRating,'复刻出金欧非'),note);
    }
    box.append(section);
  }
  return box;
}

function acquisitionRows(entry){
  const detail=el('details','up-history');detail.append(el('summary','','逐次抽数与 UP 身份 · 查看含歪明细'));
  detail.append(el('p','up-part-note','“出金”从同频段上次 S 之后计数；普通池“UP 花费”从上次已确认 UP 之后计数。复刻池单独显示来源，不套用普通 UP 评价。普通池身份可手动补充，标注仅在本次页面生效。'));
  const wrap=el('div','up-history-scroll'),table=el('table');const head=el('thead'),hr=el('tr');for(const title of ['获取对象 / 时间','出金','UP 花费','当期身份']){const th=el('th','',title);th.scope='col';hr.append(th);}head.append(hr);table.append(head);
  const body=el('tbody');let shown=0;
  const acquisitions=[...entry.agent.acquisitions.map(a=>({...a,kind:'角色'})),...entry.weapon.acquisitions.map(a=>({...a,kind:'专武'}))].sort((a,b)=>b.record.time.localeCompare(a.record.time)||b.record.id.length-a.record.id.length||b.record.id.localeCompare(a.record.id));
  const more=el('button','quiet-button','继续查看获取记录');more.type='button';
  const append=()=>{
    for(const item of acquisitions.slice(shown,shown+30)){
      const r=item.record,row=el('tr'),identity=el('td');row.dataset.pool=item.pool;
      identity.append(el('strong','',`${item.kind} · ${r.name}`),el('small','up-history-channel',UP_CHANNELS[item.pool].label),el('small','',r.time));if(item.exclusion)identity.append(el('small','up-history-reason',item.exclusion));
      const sDraws=el('td','',item.sInterval==null?(item.observedSPulls?`≥${item.observedSPulls} 抽`:'未知'):`${item.sInterval} 抽`);
      if(item.sInterval==null&&item.observedSPulls)sDraws.append(el('small','','仅已记录'));
      const cost=el('td','up-history-cost',UP_CHANNELS[item.pool].mode==='rerun'?'不适用':item.fullUpCost==null?'未知':`${item.fullUpCost} 抽`);
      if(item.upCostParts){
        const parts=item.upCostParts,breakdown=el('div','up-cost-breakdown');
        const terms=parts.offSignals.map(off=>`歪 · ${off.record.name||'未识别对象'} ${number(off.pulls)}`);
        terms.push(`本次 UP · ${r.name} ${number(parts.finalSPulls)}`);
        breakdown.textContent=terms.join(' ＋ ')+` ＝ ${number(parts.total)} 抽`;
        cost.append(breakdown);
      }
      row.append(identity,sDraws,cost);
      const outcome=el('td');
      outcome.append(outcomeControl(r,()=>drawPairs(entry.agentId,{id:r.id,pool:r.pool,area:'cards'})));
      row.append(outcome);body.append(row);
    }
    shown=Math.min(shown+30,acquisitions.length);more.hidden=shown>=acquisitions.length;more.textContent=`继续查看 · ${shown} / ${acquisitions.length}`;
  };
  more.onclick=append;append();table.append(body);wrap.append(table);detail.append(wrap,more);return detail;
}

function drawReconciliation(data){
  const host=$('up-pair-ledger');host.replaceChildren();
  const pools=data.pools.filter(pool=>pool.reconciliation);if(!pools.length)return;
  host.append(el('h4','','抽数对账'));
  for(const pool of pools){
    const r=pool.reconciliation,section=el('section','up-ledger-pool');section.dataset.pool=pool.id;
    section.append(el('h5','',UP_CHANNELS[pool.id].label));
    const equation=el('p','up-ledger-equation');
    equation.append(el('span','',`总记录 ${number(r.total)}`),document.createTextNode(' ＝ '),el('strong','',`已核算 UP 花费 ${number(r.countedUpPulls)}`),document.createTextNode(' ＋ '),el('span','',`未归入完整周期 ${number(r.unassignedPulls)} 抽`));
    section.append(equation);
    const subsets=[];
    if(r.alreadyRecordedBeforeFirstS!=null)subsets.push(`首段已记录 ${number(r.alreadyRecordedBeforeFirstS)} 抽`);
    if(r.currentPity!=null)subsets.push(`最后出金后垫抽 ${number(r.currentPity)} 抽`);
    if(subsets.length)section.append(el('p','up-part-note',subsets.join(' · ')+'，均已包含在未归入抽数中。'));
    host.append(section);
  }
  host.append(el('p','up-part-note','未归入的记录仍保留在总数中，包括首段边界不明、当期身份待核实及尚未抽到下一次 UP 的区间。已知 UP 花费仅统计能确认的完整周期，不代表全部投入。'));
}

function drawHiddenHistory(entries){
  const unique=new Map();
  for(const entry of entries)for(const [summary,kind] of [[entry.agent,'角色'],[entry.weapon,'音擎']])for(const acquisition of summary.acquisitions){
    const key=JSON.stringify([String(acquisition.pool),String(acquisition.record.id)]);
    if(!unique.has(key))unique.set(key,{...acquisition,kind});
  }
  const acquisitions=[...unique.values()].sort((a,b)=>b.record.time.localeCompare(a.record.time)||b.record.id.length-a.record.id.length||b.record.id.localeCompare(a.record.id));
  if(!acquisitions.length)return;
  const state=hiddenHistoryState,detail=el('details','up-history');detail.id='up-hidden-history';detail.open=state.open;
  detail.append(el('summary','',`核对未单独分析的记录 · ${number(acquisitions.length)} 条`),
    el('p','up-part-note','这里保留未单列卡片的获取记录与歪出核对记录，原始记录和歪出的花费仍参与核算。普通池身份不明时可在这里补充；仅本次页面生效，复刻不套用普通 UP 判断。'));
  detail.addEventListener('toggle',()=>{if(detail.isConnected&&hiddenHistoryState===state)state.open=detail.open;});
  const wrap=el('div','up-history-scroll'),table=el('table'),head=el('thead'),heading=el('tr');
  for(const title of ['对象','实际频段','时间','当期身份']){const th=el('th','',title);th.scope='col';heading.append(th);}
  head.append(heading);table.append(head);
  const body=el('tbody'),more=el('button','quiet-button','继续查看核对记录');more.type='button';let shown=0;
  const append=()=>{
    for(const item of acquisitions.slice(shown,state.limit)){
      const r=item.record,row=el('tr');row.dataset.pool=item.pool;
      const outcome=el('td');outcome.append(outcomeControl(r,()=>{
        state.open=true;drawPairs(null,{id:r.id,pool:r.pool,area:'hidden'});
      }));
      row.append(el('td','',`${item.kind} · ${r.name||current.catalog[r.itemId]?.name||'未识别对象'}`),
        el('td','',UP_CHANNELS[item.pool].label),el('td','',r.time),outcome);body.append(row);
    }
    shown=Math.min(state.limit,acquisitions.length);more.hidden=shown>=acquisitions.length;
    more.textContent=`继续查看核对记录 · ${shown} / ${acquisitions.length}`;
  };
  more.onclick=()=>{state.limit+=30;append();};append();table.append(body);wrap.append(table);detail.append(wrap,more);
  $('up-pair-ledger').append(detail);
}

function drawPairs(openAgent=null,focus=null){
  if(!current)return;
  const {account,catalog,pairs,rules}=current;
  const previousHiddenHistory=$('up-hidden-history');if(previousHiddenHistory)hiddenHistoryState.open=previousHiddenHistory.open;
  const data=current.analysis||(current.analysis=analyzeUpPairs(account,{catalog,pairs,rules,classify:(record,a,c,r)=>annotations.get(annotationKey(a.uid,record.pool,record.id))||classifySignal(record,a,c,r)}));
  // A record proven to be off-banner is still part of the underlying history,
  // but an entirely off-banner pair isn't presented as an obtained UP target.
  const hasManual=entry=>[entry.agent,entry.weapon].some(s=>s.acquisitions.some(a=>annotations.has(annotationKey(account.uid,a.pool,a.record.id))));
  const hiddenGroups=data.entries.filter(entry=>hiddenAnalysisAgents.has(String(entry.agentId)));
  const eligible=data.entries.filter(entry=>!hiddenAnalysisAgents.has(String(entry.agentId)));
  const entries=eligible.filter(entry=>hasManual(entry)||[entry.agent,entry.weapon].some(s=>s.confirmedUpCount||s.unverifiedCount||s.rerunCount));
  const pureOffEntries=eligible.filter(entry=>!entries.includes(entry)),pureOff=pureOffEntries.length;
  // Keep a reviewed off-only pair in this compact drawer after correcting it
  // to UP, so the focused control does not disappear during the correction.
  for(const entry of pureOffEntries)hiddenHistoryState.reviewedEntries.add(String(entry.agentId));
  const reviewedEntries=eligible.filter(entry=>hiddenHistoryState.reviewedEntries.has(String(entry.agentId)));
  const totals=$('up-pair-totals');totals.replaceChildren();
  for(const [label,value] of [['角色组合',entries.length],['普通池已确认 UP',data.totals.confirmedUp],['普通池完整 UP 周期',data.totals.completeUpCycles],['普通池已知 UP 花费 · 含歪',data.totals.completeUpCycles?data.totals.completeUpPulls:null]]){const card=el('div');card.append(el('strong','',number(value)),el('span','',label));totals.append(card);}
  drawReconciliation(data);
  drawHiddenHistory([...hiddenGroups,...reviewedEntries]);
  const query=$('up-pair-search').value.trim().toLocaleLowerCase();let rows=entries.filter(e=>window.DUKE_I18N.matches([e.agentName,e.weaponName],query));
  const recent=e=>[...e.agent.acquisitions,...e.weapon.acquisitions].reduce((last,a)=>a.record.time>last?a.record.time:last,'');
  const count=e=>e.agent.sCount+e.weapon.sCount,cost=e=>e.agent.totalUpPulls+e.weapon.totalUpPulls;
  rows.sort((a,b)=>{switch($('up-pair-sort').value){case 'name':return a.agentName.localeCompare(b.agentName,'zh-CN');case 'cost':return cost(b)-cost(a)||recent(b).localeCompare(recent(a));case 'count':return count(b)-count(a)||recent(b).localeCompare(recent(a));default:return recent(b).localeCompare(recent(a));}});
  $('up-pair-count').textContent=`${rows.length} 组角色与专武`;
  const manualCount=[...annotations.keys()].filter(key=>JSON.parse(key)[0]===account.uid).length;
  $('up-pair-reset-annotations').hidden=!manualCount;
  const ordinaryUnverified=data.totals.unverifiedS-data.totals.rerunS;
  $('up-pair-status').textContent=`${manualCount?`已手动补充 ${manualCount} 次身份，花费判断包含这些标注，仅本次页面有效。 `:''}${ordinaryUnverified?`${ordinaryUnverified} 次普通池 S 级的当期 UP 身份待核实：可在逐次记录或上方核对入口补充。`:''}${data.totals.rerunS?` ${data.totals.rerunS} 次复刻 S 级已按独家重映 / 音擎回响分别保留，不参与普通 UP 评价。`:''}${hiddenGroups.length?` 已隐藏 ${hiddenGroups.length} 组常驻及定制调频候选角色与对应音擎的分析卡片，原始记录和歪出花费仍参与核算。`:''}${pureOff?` 另有 ${pureOff} 组仅确认歪出的对象不单列卡片，可在上方核对记录。`:''}${data.totals.unmatchedS?` ${data.totals.unmatchedS} 次 S 级暂未匹配到角色与专武资料。`:''}`;
  const cards=rows.slice(0,limit).map(entry=>{
    const card=el('article','up-pair-card');card.dataset.agentId=entry.agentId;
    const heading=el('header','up-pair-card-heading'),title=el('div');title.append(el('h4','',entry.agentName),el('p','',`专属音擎 · ${entry.weaponName||'资料待补充'}`));
    const badges=el('div','up-source-badges');
    for(const pool of new Set([...entry.agent.channels,...entry.weapon.channels].map(channel=>channel.pool))){const badge=el('span','',UP_CHANNELS[pool].label);badge.dataset.mode=UP_CHANNELS[pool].mode;badges.append(badge);}
    title.append(badges);heading.append(current.avatar({itemId:entry.agentId,name:entry.agentName,rank:'S'}),title);card.append(heading);
    const parts=el('div','up-pair-parts');parts.append(partSummary(entry.agent,{name:entry.agentName,itemId:entry.agentId},'agent'),partSummary(entry.weapon,{name:entry.weaponName,itemId:entry.weaponId},'weapon'));
    const history=acquisitionRows(entry);history.open=String(entry.agentId)===String(openAgent);card.append(parts,history);return card;
  });
  $('up-pair-grid').replaceChildren(...cards);
  if(!rows.length)$('up-pair-grid').append(el('p','up-empty',query?'没有匹配的角色或专武。':data.entries.length?'当前记录中没有需要单独展示的限定角色或专武，可展开上方记录核对抽数。':'还没有可展示的限定角色或专武记录；导入后会按角色配对显示。'));
  $('up-pair-more').hidden=rows.length<=limit;$('up-pair-more').textContent=`继续查看 · ${Math.min(limit,rows.length)} / ${rows.length} 组`;
  const basis=$('up-pair-basis');basis.replaceChildren();
  const notes=[
    '仅汇总独家、音擎及两类复刻频段的 S 级获取。常驻、赠送、商店兑换不计入，获取次数不代表当前影画或叠影。',
    '常驻六组以及定制调频候选朱鸢、凯撒、柳，连同对应音擎均不单独展示分析卡片，包括在普通和复刻频段获得的记录。在限定频段歪出的抽数仍计入后续可确认的完整 UP 花费。可展开“核对未单独分析的记录”补充身份；展示名单不用于判断任何历史记录是否为 UP。',
    '卡池以每条记录的实际频段为准，不按角色名字固定分类。同一角色或专武在普通池和复刻池获得时，次数、平均出金与评价分别展示。旧角色在普通独家频段返场时仍按该普通频段统计。',
    '出金抽数＝同频段相邻 S 之间的记录数；出金欧非不包含上一枚 S 已花的抽数。',
    'UP 花费＝从同频段上一次已确认 UP 到本次 UP 的记录数，包含中途歪与跨期垫抽；花费归到本次获得的对象，不等同于在该角色卡池期间投入的全部抽数。',
    '逐次含歪明细会列出每次歪出的对象与抽数，再加上本次 UP 的出金间隔。例如先歪 67 抽，再用 29 抽抽到 UP，实际花费是 96 抽。平均每 UP 以这些完整花费求平均。',
    '首段缺失、身份未核实、未知品质或保底矛盾时，不把不完整的区间当作准确花费；没有完整区间就不评级。独家重映 / 音擎回响有当期福利保底与常规保底，复刻只展示出金表现，不套用普通 UP 花费与欧非。',
    '这里统计实际调频次数。复刻首次十连即使享受八折，记录仍是 10 抽，不等于消耗的母带数量。',
    '出金评价沿用本页原有规则：完整 S 间隔 ÷ 该频段 S 硬保底。UP 评价则用平均每 UP 花费 ÷ 理论平均（角色 93.75 抽、音擎 62.5 抽）；低于平均更欧，高于平均更非。少于 3 个区间为暂定。',
    '本站自定义娱乐评价，不代表全服排名或下次出货概率。数据缺页也可能使观察抽数偏小。'
  ];const list=el('ul');for(const text of notes)list.append(el('li','',text));basis.append(list);
  basis.append(el('p','','UP 欧非：平均花费占理论平均的比例（100% 为理论平均水平）'));
  const upBands=el('div','up-rating-bands');for(const [grade,range] of [['SS','≤35%'],['S','35%—65%'],['A+','65%—90%'],['A-','90%—110%'],['B+','110%—145%'],['B-','>145%']])upBands.append(el('span','',`${grade} · ${range}`));basis.append(upBands);
  basis.append(el('p','','出金欧非：完整 S 间隔占硬保底的比例'));
  const bands=el('div','up-rating-bands');for(const [grade,range] of [['SS','≤25%'],['S','25%—45%'],['A+','45%—60%'],['A-','60%—75%'],['B+','75%—90%'],['B-','>90%']])bands.append(el('span','',`${grade} · ${range}`));basis.append(bands,el('p','','临界值归入“不超过”的较高档；阈值为本站定义，不是概率分位。'));
  if(focus)requestAnimationFrame(()=>{
    const host=focus.area==='hidden'?$('up-hidden-history'):$('up-pair-grid');
    for(const select of host?.querySelectorAll('select[data-outcome-id]')||[])if(select.dataset.outcomeId===String(focus.id)&&select.dataset.outcomePool===String(focus.pool)){select.focus({preventScroll:true});break;}
  });
}

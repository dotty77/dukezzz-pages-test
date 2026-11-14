import {rateLuck} from './tuning-rating.js?v=20260914-duke-brand-1';
import {analyzeAccount} from './tuning-core.js?v=20260914-duke-brand-1';
import {compareSignalRecords,classifyBannerSignal,analyzeGuaranteeHistory} from './tuning-guarantee-core.js?v=20261001-planner-tuning-1';
import {analyzeUpPairs} from './tuning-up-core.js?v=20261001-planner-tuning-1';
import {fetchTuningJSON} from './tuning-resources.js?v=20260909-tuning-win11-1';

let bannerData={windows:[]};
const manualGuarantees=new Map();
export async function loadBannerData(){
  const data=await fetchTuningJSON('tuning-banners.json?v=20261111-refresh-launch-1');
  if(!data||!Array.isArray(data.windows))throw new Error('卡池资料格式异常，请刷新重试。');
  bannerData=data;
}
const el=(tag,cls='',text='')=>{const node=document.createElement(tag);node.className=cls;node.textContent=text;return node;};
const format=n=>n==null?'—':new Intl.NumberFormat('zh-CN',{maximumFractionDigits:1}).format(n);
const compare=(a,b)=>a.time.localeCompare(b.time)||compareSignalRecords(a,b);
export function classifySignal(record,account,catalog={},rules=bannerData){
  return classifyBannerSignal(record,account,catalog,rules).outcome;
}
// Plain-language result first; how it was decided goes into a folded "怎么判断的".
const METHOD={
  'verified-banner':'对照当期官方卡池名单判断。',
  'standard-pool':'按常驻池判断：歪的时候只会出常驻 S 级（如猫又、11号），限定 S 级只会以 UP 出现。',
  'inferred-by-guarantee':'上一次已确认歪了，按保底规则这一次必定是 UP。'
};
const UNRESOLVED_ITEM=['unknown-item-name','ambiguous-item-name','missing-item'];
const upChance=id=>id==='3'||id==='103'?'75%':'50%';
const lastName=(record,catalog)=>catalog[record?.itemId]?.name||record?.name||'';
export const bigReason=name=>`上次 S 级「${name}」歪了，下次 S 级必定是 UP。`;
export const smallReason=(name,id)=>`上次 S 级「${name}」是 UP，下次 S 级有 ${upChance(id)} 是 UP。`;
export function guaranteeState(account,pool,catalog={},rules=bannerData){
  const id=String(pool?.id||'');
  if(id==='1')return {state:'none',label:'常驻频段 · 没有大小保底',reason:'常驻频段没有限定 UP，不区分大小保底。'};
  if(id==='5')return {state:'none',label:'邦布频段 · 必出所选邦布',reason:'S 级必定是你选择的邦布，不存在歪。'};
  if(!['2','3','102','103'].includes(id))return {state:'unknown',label:'暂不能判断',reason:'这个频段的保底规则还没有核对。'};
  const h=analyzeGuaranteeHistory(account,id,catalog,rules),special=['102','103'].includes(id),name=lastName(h.lastS,catalog);
  const base={lastS:h.lastS,scope:'按已导入的记录判断；之后又抽过或记录缺页，结果可能变化。',evidence:h.lastSignal?.basis,method:METHOD[h.lastSignal?.basis]||'',regularState:h.state,welfare:h.special?.welfare};
  const unknown=(reason,extra={})=>({...base,state:'unknown',label:'暂不能判断',reason,...extra});
  const issues=[...(h.contradictions||[])];
  if(pool.recordOrderConsistent===false)issues.push('记录 ID 与时间顺序矛盾');
  if(pool.currentPityKnown&&pool.hardPity&&pool.currentPity>=pool.hardPity)issues.push('已记录垫抽达到硬保底但没有 S 级');
  if(issues.length)return unknown('记录有缺漏或前后矛盾，暂不判断。',{method:[...new Set(issues)].join('；')+'。'});
  if(h.unknownAfterLastS)return unknown('上次 S 级之后有品质未知的记录，可能漏了一次出金，暂不判断。');
  if(special){
    const welfareUsed='本期福利保底已用完，之后按常规大小保底计算。';
    if(h.special?.welfare==='available')return {...base,state:h.state,label:'福利保底',reason:'本期第一个 S 级必定是你选择的 UP。',method:'独家重映每期第一个 S 级必为所选 UP，不影响常规大小保底。'};
    if(h.state==='big')return {...base,state:'big',label:'大保底',reason:bigReason(name),method:welfareUsed};
    if(h.state==='small')return {...base,state:'small',label:'小保底',reason:smallReason(name,id),method:welfareUsed};
    return unknown('还不能确定本期福利保底是否已用。',{method:'独家重映的福利保底和常规保底分开计算，现有记录不足以分清。'});
  }
  if(!h.lastS)return unknown('记录里还没有 S 级，无法知道之前有没有歪过。',{method:''});
  if(h.state==='big')return {...base,state:'big',label:'大保底',reason:bigReason(name)};
  if(h.state==='small')return {...base,state:'small',label:'小保底',reason:smallReason(name,id)};
  const code=h.lastSignal?.reasonCode;
  return unknown(`还不能确定上次 S 级「${name}」是不是 UP。`,{canAnnotate:true,
    method:UNRESOLVED_ITEM.includes(code)?'记录里的物品名称无法识别。'
      :['item-not-covered','ambiguous-window','up-off-overlap'].includes(code)?'这个 S 级和当期官方名单对不上，可能是记录或资料有误。'
      :'这个 S 级后来进入了常驻池，歪和 UP 都可能出现，需要当期卡池名单才能判断，而那一期的名单还没有收录。'});
}
export function upStatistics(account,pool,catalog={},rules=bannerData){
  const id=String(pool),h=analyzeGuaranteeHistory(account,id,catalog,rules);
  const rows=(account.records||[]).filter(r=>String(r.pool)===id);
  const ledger=analyzeUpPairs(account,{catalog,rules,pairs:{}}).pools.find(p=>p.id===id);
  const blank={small:0,wins:0,rate:null,average:null,intervalCount:0,unverified:rows.filter(r=>r.rank==='S').length};
  if(!['2','3'].includes(id)||h.contradictions?.length||ledger?.contradictions?.length)return blank;
  let small=0,wins=0,unverified=0;
  for(const signal of h.signals||[]){
    if(signal.outcome==='unknown'){unverified++;continue;}
    if(signal.beforeState==='small'){small++;if(signal.outcome==='up')wins++;}
  }
  const intervalCount=ledger?.completeUpCycles||0;
  return {small,wins,rate:small?wins/small:null,average:intervalCount?ledger.completeUpPulls/intervalCount:null,intervalCount,unverified};
}
/** Record id -> 'up' | 'off' for each S-Rank whose identity is known or follows from the guarantee rule. */
export function signalOutcomes(account,poolId,catalog={},rules=bannerData){
  const outcomes=new Map(),id=String(poolId);
  if(!account||!['2','3','102','103'].includes(id))return outcomes;
  const h=analyzeGuaranteeHistory(account,id,catalog,rules);
  if(h.contradictions?.length)return outcomes;
  for(const signal of h.signals){
    const outcome=signal.outcome==='unknown'?signal.inferredOutcome:signal.outcome;
    if(outcome==='up'||outcome==='off')outcomes.set(String(signal.record.id),outcome);
  }
  return outcomes;
}
export function renderGuarantee(container,account,pool,{catalog={},includeGuide=true,includeScope=true}={}){
  let result=guaranteeState(account,pool,catalog);
  const key=JSON.stringify([account.uid,account.timezone,pool?.id,result.lastS?.id,result.lastS?.time,result.lastS?.itemId]);
  const manual=result.canAnnotate?manualGuarantees.get(key):null;
  const name=lastName(result.lastS,catalog);
  if(manual)result={...result,state:manual==='off'?'big':'small',label:manual==='off'?'大保底':'小保底',
    reason:manual==='off'?bigReason(name):smallReason(name,String(pool?.id)),method:'按你的手动标记判断，只在本页面生效，不修改记录。'};
  const box=el('div','guarantee-box');box.dataset.state=result.state;
  box.append(el('strong','',result.label),el('p','',result.reason));
  // The pity count belongs next to the guarantee: it is the other half of "when and who".
  if(['2','3','102','103'].includes(String(pool?.id))&&pool?.count){
    const pity=pool.currentPityKnown&&pool.hardPity
      ?`已垫 ${pool.currentPity} 抽 · 最多再 ${Math.max(0,pool.hardPity-pool.currentPity)} 抽必出 S 级`:'已垫抽数暂不能确定';
    box.append(el('p','guarantee-pity',pity));
  }
  if(result.canAnnotate){
    const label=el('label','guarantee-manual','如果你记得，可以手动标记上次 S 级：'),select=el('select');
    for(const [value,text] of [['','不确定'],['up','是 UP'],['off','歪了']]){const option=el('option','',text);option.value=value;select.append(option);}
    select.value=manual||'';select.onchange=()=>{if(select.value)manualGuarantees.set(key,select.value);else manualGuarantees.delete(key);box.remove();renderGuarantee(container,account,pool,{catalog,includeGuide,includeScope});};
    label.append(select);box.append(label);
  }
  const notes=[result.method,result.lastS?`上次 S 级：${name} · ${result.lastS.time}`:'',includeScope?result.scope:''].filter(Boolean);
  if(notes.length){
    const why=el('details','guarantee-why');why.append(el('summary','','怎么判断的'));
    for(const text of notes)why.append(el('p','',text));
    box.append(why);
  }
  if(!includeGuide){container.append(box);return;}
  const guide=el('details','guarantee-guide');guide.append(el('summary','','什么是大保底、小保底？'));
  const list=el('dl');
  for(const [title,description] of [
    ['小保底','普通独家频段每次获得 S 级时，基础有 50% 概率是当期 UP 代理人；普通音擎频段为 75%。未出 UP 通常叫“歪”。'],
    ['大保底','如果上一次 S 级不是 UP，下一次获得的 S 级保证是对应频段 UP。获得 UP 后回到小保底。'],
    ['与 90 / 80 抽的区别','大小保底决定出金时“是谁”，硬保底决定“最多多少抽出 S”。角色普通池至多 90 抽、音擎普通池至多 80 抽；大保底不等于下一抽就出金。'],
    ['继承范围','同类普通频段跨期、并行页面共享抽数与大小保底；角色池、音擎池、常驻、邦布和特殊复刻频段彼此分开。'],
    ['复刻福利保证','独家重映/音擎重映的本期首次 S 级福利与常规保底独立。福利出 UP 不会清除已继承的大保底；不能把所有“复刻角色”一概视作特殊频段，应按每条记录所属频段判断。']
  ]){list.append(el('dt','',title),el('dd','',description));}
  guide.append(list);box.append(guide);container.append(box);
}
export function renderOverview(container,account,{stats=analyzeAccount(account),catalog={},itemType,itemName,avatar,demo=false}){
  const rating=rateLuck(account,{resolveType:itemType}),agentUp=upStatistics(account,'2',catalog),engineUp=upStatistics(account,'3',catalog);
  const latest=account.records.filter(r=>r.rank==='S'&&['2','102'].includes(r.pool)&&itemType(r)==='agent').sort(compare).slice(-1)[0];
  const top=el('div','overview-top'),identity=el('span','overview-uid',demo?'示例 UID · 虚构记录':`UID: ${String(account.uid).slice(0,2)}${'*'.repeat(Math.max(3,String(account.uid).length-6))}${String(account.uid).slice(-4)}`);
  top.append(identity,el('span','overview-scope','已导入记录 · 全频段汇总'));
  const main=el('div','overview-main'),copy=el('div','overview-copy'),title=el('h2','',rating.title.replace(' · ',''));
  const grade=el('span','overview-grade',rating.grade||'待定');grade.title='本站自定义娱乐评级';copy.append(el('p','overview-kicker','我的调频报告'),title);
  const metrics=el('dl','overview-metrics');
  for(const [label,value,unit] of [['总抽卡数',stats.total,'抽'],['平均每金',rating.averagePulls,'抽'],['S 级总数',stats.rankCounts.S,'金']]){const row=el('div'),valueNode=el('dd','',format(value));valueNode.append(el('small','',unit));row.append(el('dt','',label),valueNode);metrics.append(row);}
  copy.append(metrics);const portrait=el('div','overview-latest');
  if(latest){portrait.append(avatar(latest),el('strong','',itemName(latest)),el('span','','限定角色池最新 S'));}else portrait.append(el('span','overview-empty-avatar','✦'),el('span','','等待角色池 S 级记录'));
  portrait.append(grade);main.append(copy,portrait);
  const badges=el('div','overview-badges');
  badges.append(el('span','',`${rating.sampleCount} 个有效出金区间`),el('span','',rating.provisional?'样本较少 · 暂定评级':'按已收录区间评级'));
  const intervals=stats.pools.flatMap(p=>p.sIntervals||[]);if(intervals.length)badges.append(el('span','',`最快 ${intervals.reduce((a,b)=>Math.min(a,b),Infinity)} 抽再遇 S`));
  const bottom=el('div','overview-bottom');
  for(const [label,value,suffix] of [['角色小保底不歪',agentUp.rate==null?null:agentUp.rate*100,'%'],['独家每 UP 角色',agentUp.average,'抽'],['音擎每 UP',engineUp.average,'抽'],['常驻每金',stats.pools.find(p=>p.id==='1')?.averageSInterval,'抽'],['邦布每金',stats.pools.find(p=>p.id==='5')?.averageSInterval,'抽']]){const cell=el('div'),strong=el('strong','',format(value));if(value!=null)strong.append(el('small','',suffix));cell.append(strong,el('span','',label));bottom.append(cell);}
  const basis=el('details','overview-basis');basis.append(el('summary','','统计口径与判断依据'));
  basis.append(el('p','',`平均每金只取同频段完整 S 到 S 区间，共 ${rating.sampleCount} 个；不把首段缺失记录算成完整周期。UP 指标仅纳入已核对期次：角色小保底样本 ${agentUp.small} 次，其中不歪 ${agentUp.wins} 次；角色/音擎每 UP 分别有 ${agentUp.intervalCount} / ${engineUp.intervalCount} 个完整 UP 到 UP 区间。破折号表示资料或样本不足。`));
  const rules=el('ul');for(const reason of rating.reasons.slice(0,3))rules.append(el('li','',reason));basis.append(rules,el('p','',rating.note));
  container.replaceChildren(top,main,badges,bottom,basis);
}

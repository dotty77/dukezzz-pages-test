import {analyzeAccount,POOL_META} from './tuning-core.js?v=20260914-duke-brand-1';

const BANDS=Object.freeze([
  {grade:'SS',title:'万里挑一 · 至尊欧皇',maxRatio:0.25,description:'标准化均值不超过硬保底的 25%'},
  {grade:'S',title:'欧气满满 · 幸运之星',maxRatio:0.45,description:'标准化均值超过 25%，不超过 45%'},
  {grade:'A+',title:'好运常伴 · 小欧皇',maxRatio:0.60,description:'标准化均值超过 45%，不超过 60%'},
  {grade:'A-',title:'平稳随缘 · 平常心玩家',maxRatio:0.75,description:'标准化均值超过 60%，不超过 75%'},
  {grade:'B+',title:'欧气偏淡 · 随缘玩家',maxRatio:0.90,description:'标准化均值超过 75%，不超过 90%'},
  {grade:'B-',title:'欧气不足 · 小非酋',maxRatio:1,description:'标准化均值超过 90%，不超过 100%'}
]);
const NOTE='这是按自定义区间给出的娱乐称号，不代表真实万分之一概率、全服排名或未来出货情况；抽卡随机性不会因本次评级改变。';
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const gcd=(a,b)=>b?gcd(b,a%b):a;

function defaultType(record) {
  const value=String(record?.itemType||'').toLowerCase().replace(/[\s_-]/g,'');
  if(['代理人','角色','agent','agents','character','characters'].includes(value))return 'agent';
  if(['音擎','武器','wengine','wengines','weapon','weapons'].includes(value))return 'engine';
  return 'unknown';
}
function kindOf(value) {
  if(['agent','agents','character','代理人','角色'].includes(value))return 'agent';
  if(['engine','engines','weapon','音擎','武器'].includes(value))return 'engine';
  return 'unknown';
}

export function rateLuck(account,{poolId,kind,resolveType=defaultType}={}) {
  if(kind!==undefined&&!['agent','engine'].includes(kind))throw new Error('评级类别应为 agent 或 engine');
  if(typeof resolveType!=='function')throw new Error('resolveType 必须是函数');
  const analysis=analyzeAccount(account),lookup=new Map(account.records.map(r=>[r.id,r]));
  const samples=[],reasons=[],usedPools=new Map();let incomplete=0,filteredTypes=0,unknownTypes=0;
  for(const p of analysis.pools) {
    if(poolId!==undefined&&p.id!==String(poolId))continue;
    const hardCap=own(POOL_META,p.id)?POOL_META[p.id].hardPity:null;
    if(!Number.isInteger(hardCap)||hardCap<=0){reasons.push(`${p.label}未确认硬保底，未参与评级。`);continue;}
    const contradictions=!p.recordOrderConsistent||p.sHistory.some(h=>h.complete&&(h.interval<1||h.interval>hardCap))||(p.currentPityKnown&&p.currentPity>=hardCap);
    if(contradictions){reasons.push(`${p.label}记录出现超过硬保底或时间顺序矛盾，该频段全部区间已排除。`);continue;}
    for(const h of p.sHistory) {
      if(!h.complete||h.interval===null){incomplete++;continue;}
      if(kind){const type=kindOf(resolveType(lookup.get(h.id)||h));if(type!==kind){if(type==='unknown')unknownTypes++;else filteredTypes++;continue;}}
      samples.push({pulls:h.interval,hardCap,pool:p.id});usedPools.set(p.id,{label:p.label,hardCap});
    }
  }
  const sampleCount=samples.length,provisional=sampleCount<3;
  if(incomplete)reasons.push(`排除 ${incomplete} 个首个可见 S 或跨越未知品质的区间；未把历史起点当成第 1 抽。`);
  if(kind)reasons.push(`按每个完整周期终点的 S 级物品类型筛选${kind==='agent'?'代理人':'音擎'}；排除其他类型 ${filteredTypes} 个、类型未知 ${unknownTypes} 个周期，同池周期分别计算。`);
  reasons.push('仅依据导入的可见记录，无法验证中间是否缺页；缺页可能让观察到的间隔偏小，评级只描述现有样本。');
  const bands=BANDS.map(b=>({...b}));
  if(!sampleCount)return {grade:null,title:'记录不足 · 暂不评级',sampleCount:0,provisional:true,scoreRatio:null,averagePulls:null,reasons:['还没有可用于评级的完整 S 到 S 区间。',...reasons],bands,note:NOTE};

  // Exact integer comparison avoids floating-point ambiguity at published boundaries.
  const denominator=samples.reduce((d,s)=>d/gcd(d,s.hardCap)*s.hardCap,1);
  const units=samples.reduce((n,s)=>n+s.pulls*(denominator/s.hardCap),0);
  const totalUnits=denominator*sampleCount,scoreRatio=units/totalUnits;
  const band=BANDS.find(b=>units*100<=Math.round(b.maxRatio*100)*totalUnits)||BANDS[BANDS.length-1];
  const averagePulls=samples.reduce((n,s)=>n+s.pulls,0)/sampleCount;
  reasons.unshift(`计算方式：每个完整 S 级间隔 ÷ 所在频段硬保底，再对 ${sampleCount} 个区间取平均。`,
    `实际平均 ${averagePulls.toFixed(2)} 抽；标准化均值 ${(scoreRatio*100).toFixed(2)}%。对应规则：${[...usedPools.values()].map(p=>`${p.label} ${p.hardCap} 抽`).join('，')}。`,
    `本次为 ${band.grade}：${band.description}。边界值归入“不超过”这一档；这些阈值是本站自定义，不是概率分位。`);
  if(usedPools.size>1)reasons.push('不同频段这里只按硬保底统一刻度，实际出货分布可能不同；这个平均值不是经过概率校准的跨池排名。');
  reasons.push(provisional?`只有 ${sampleCount} 个完整区间，先给暂定评级；样本少，不能代表长期情况。`:`共有 ${sampleCount} 个完整区间，达到本站 3 个区间的展示门槛；这仍不代表统计显著性或长期结论。`);
  return {grade:band.grade,title:band.title,sampleCount,provisional,scoreRatio,averagePulls,reasons,bands,note:NOTE};
}

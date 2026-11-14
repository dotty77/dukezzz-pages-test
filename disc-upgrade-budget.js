import {costFor, attempts, coreCraftEquivalent, validateTargets} from './disc-budget.js?v=20260913-disc-planner-1';
import {calculatePanel, formatProperty} from './disc-planner-core.js?v=20261107-refresh-launch-1';

export const UPGRADE_MODES={random:'随机号位',slot:'指定号位',main:'指定主属性',sub1:'主属性 + 1条副属性',sub2:'主属性 + 2条副属性'};
const KEYS=['hiFi','calibrators','cores','dennies'];
const clamp=p=>Math.min(1,Math.max(0,p));
const whole=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
const id=x=>String(x.id??x.propertyId);
const combination=(n,k)=>{if(k<0||k>n)return 0;let v=1;for(let i=1;i<=k;i++)v=v*(n-i+1)/i;return v;};
const enhancementCache=new Map();

/** All requested lines must reach their shares, not just an aggregate score.
 * All lines are present after the fourth is added. A share includes first appearance.
 */
export function enhancementProbability({initialSubstats,targetRolls,assumption}={}){
  if(assumption!=='uniform-4')throw new RangeError('必须明确采用四条独立等概率强化假设');
  if(!whole(initialSubstats,3,4)||!Array.isArray(targetRolls)||targetRolls.length>4||targetRolls.some(n=>!whole(n,1,6)))throw new RangeError('初始条数或目标份数无效');
  const need=targetRolls.map(n=>n-1).sort((a,b)=>a-b),draws=initialSubstats===3?4:5;
  if(need.reduce((s,n)=>s+n,0)>draws)return 0;
  if(need.every(n=>n===0))return 1;
  const cacheKey=`${draws}:${need.join(',')}`;
  if(enhancementCache.has(cacheKey))return enhancementCache.get(cacheKey);
  let states=new Map([[need.map(()=>0).join(','),1]]);
  for(let step=0;step<draws;step++){
    const next=new Map(),add=(key,p)=>next.set(key,(next.get(key)||0)+p);
    for(const[key,p]of states){
      const hits=key.split(',').map(Number);
      add(key,p*(4-need.length)/4);
      for(let i=0;i<need.length;i++){const copy=hits.slice();copy[i]=Math.min(need[i],copy[i]+1);add(copy.join(','),p/4);}
    }
    states=next;
  }
  const result=clamp(states.get(need.join(','))||0);enhancementCache.set(cacheKey,result);return result;
}

/** Optional full uniform generation scenario, never a verified game drop rate.
 * Targeted modes guarantee the first k requested types; unspecified types are free.
 * For uniform draws the two explicit directed-generation assumptions coincide.
 */
export function fullGenerationProbability({slot,mainId,targetSubs=[],mode='slot',rules,initialFourProbability,directedGeneration,assumption}={}){
  if(assumption!=='uniform-generation')throw new RangeError('完整生成模型必须由用户明确启用');
  if(typeof initialFourProbability!=='number'||!Number.isFinite(initialFourProbability)||initialFourProbability<0||initialFourProbability>1)throw new RangeError('请填写初始四条占比，范围为0–100%');
  if(!Object.hasOwn(UPGRADE_MODES,mode))throw new RangeError('调律方式无效');
  const validation=validateTargets({slot,mainId,targetSubs,rules});
  if(!validation.valid)throw new RangeError(validation.errors.join('；'));
  if(targetSubs.length>4)throw new RangeError('一张目标盘最多指定四条副属性');
  const k=mode==='sub1'?1:mode==='sub2'?2:0;
  if(k>targetSubs.length)throw new RangeError('目标副属性不足，不能比较该定向方式');
  if(k&&!['forced-first','condition-final-four'].includes(directedGeneration))throw new RangeError('请明确选择副定向生成假设');
  const legal=rules.substats.filter(s=>id(s)!==String(mainId));
  const n=legal.length,t=targetSubs.length;
  if(n<4)throw new RangeError('合法副属性资料不足');
  const appearanceProbability=combination(n-t,4-t)/combination(n-k,4-k);
  const targetRolls=targetSubs.map(s=>Number(s.rolls??1));
  const initial3=enhancementProbability({initialSubstats:3,targetRolls,assumption:'uniform-4'});
  const initial4=enhancementProbability({initialSubstats:4,targetRolls,assumption:'uniform-4'});
  const slotFactor=mode==='random'?1/6:1;
  const mainFactor=['random','slot'].includes(mode)?1/rules.mainStatsBySlot[String(slot)].length:1;
  const qualityFactor=rules.tuning.sRankProbability,setFactor=rules.tuning.chosenSetProbability;
  if([qualityFactor,setFactor].some(p=>typeof p!=='number'||!Number.isFinite(p)||p<0||p>1))throw new RangeError('缺少已核实的高级调律品质或指定套装概率');
  return {probability:clamp(qualityFactor*setFactor*slotFactor*mainFactor*appearanceProbability*((1-initialFourProbability)*initial3+initialFourProbability*initial4)),
    initial3,initial4,appearanceProbability,slotFactor,mainFactor,qualityFactor,setFactor,directedIds:targetSubs.slice(0,k).map(id),
    assumptions:{id:'uniform-generation',initialFourProbability,directedGeneration:k?directedGeneration:null,notObservedDropRate:true}};
}

function multiplyCost(cost,n){
  const scale=values=>Object.fromEntries(KEYS.map(k=>[k,values[k]===0?0:values[k]*n]));
  return {...cost,min:scale(cost.min),max:scale(cost.max)};
}
export function budgetForProbability({probability,cost}={}){
  if(typeof probability!=='number'||!Number.isFinite(probability)||probability<0||probability>1)throw new RangeError('成功率须为0–1之间的数值');
  const expected=probability===0?Infinity:1/probability,n50=attempts(probability,.5),n90=attempts(probability,.9);
  return {possible:probability>0,expectedAttempts:expected,attempts50:n50,attempts90:n90,
    expected:multiplyCost(cost,expected),confidence50:multiplyCost(cost,n50),confidence90:multiplyCost(cost,n90)};
}
/** Envelope of every unknown mixture of initial three/four-line discs. Both
 * endpoints include slot, main and substat generation, not just enhancement.
 * Uniform sampling makes forced-first and conditional inclusion equivalent.
 */
export function fullGenerationRange(args={}){
  const initial3=fullGenerationProbability({...args,initialFourProbability:0,directedGeneration:'forced-first'});
  const initial4=fullGenerationProbability({...args,initialFourProbability:1,directedGeneration:'forced-first'});
  return {min:Math.min(initial3.probability,initial4.probability),max:Math.max(initial3.probability,initial4.probability),
    initial3:initial3.probability,initial4:initial4.probability,
    assumptions:{id:'uniform-generation',unknownInitialMixture:true,directedGeneration:'uniform-equivalent',notObservedDropRate:true}};
}
export function budgetForProbabilityRange({probability,cost}={}){
  if(!probability||![probability.min,probability.max].every(p=>typeof p==='number'&&Number.isFinite(p)&&p>=0&&p<=1)||probability.min>probability.max)throw new RangeError('成功率范围须满足0≤下界≤上界≤1');
  const lower=budgetForProbability({probability:probability.max,cost}),upper=budgetForProbability({probability:probability.min,cost});
  const costs=key=>({...cost,min:{...lower[key].min},max:{...upper[key].max}});
  const count=key=>({min:lower[key],max:upper[key]});
  return {possible:probability.max>0,finiteUpperBound:probability.min>0,
    expectedAttempts:count('expectedAttempts'),attempts50:count('attempts50'),attempts90:count('attempts90'),
    expected:costs('expected'),confidence50:costs('confidence50'),confidence90:costs('confidence90')};
}
export function summarizeUpgradeOptions({slot,mainId,targetSubs=[],rules,probabilities={}}={}){
  const check=validateTargets({slot,mainId,targetSubs,rules});if(!check.valid)throw new RangeError(check.errors.join('；'));
  if(targetSubs.length>4)throw new RangeError('一张盘最多四条目标副属性');
  return Object.entries(UPGRADE_MODES).filter(([mode])=>mode!=='sub1'&&mode!=='sub2'||targetSubs.length>=(mode==='sub1'?1:2)).map(([mode,label])=>{
    const p=probabilities[mode]??null,cost=costFor({slot,mode,rules});
    return {slot:Number(slot),mode,label,probability:p,cost,budget:p===null?null:budgetForProbability({probability:p,cost})};
  });
}

/** Robust material-vector comparison: uncertain cost ranges must not overlap
 * in a way that could reverse the dominance claim. No conversion between units.
 */
export function paretoOptions(options,{craftCores=false,rules}={}){
  const valid=options.filter(o=>o.probability>0&&o.budget);
  const costs=o=>craftCores?coreCraftEquivalent(o.budget.expected,rules):o.budget.expected;
  return valid.filter(b=>!valid.some(a=>a!==b&&KEYS.every(k=>costs(a).max[k]<=costs(b).min[k])&&KEYS.some(k=>costs(a).max[k]<costs(b).min[k])));
}
/** A worst-case budget may dominate another best-case budget only when every
 * material comparison is finite and at least one is strictly better. Overlap,
 * unknown upper bounds and material tradeoffs never produce a unique ranking.
 */
export function paretoRangeOptions(options,{craftCores=false,rules}={}){
  const valid=options.filter(o=>o.probabilityRange?.max>0&&o.rangeBudget);
  const costs=o=>craftCores?coreCraftEquivalent(o.rangeBudget.expected,rules):o.rangeBudget.expected;
  return valid.filter(b=>!valid.some(a=>a!==b&&
    KEYS.every(k=>Number.isFinite(costs(a).max[k])&&Number.isFinite(costs(b).min[k])&&costs(a).max[k]<=costs(b).min[k])&&
    KEYS.some(k=>costs(a).max[k]<costs(b).min[k])));
}

/** Only replacements/fills enter tuning budgets. Allocation remains untouched. */
export function upgradeChanges(config,allocation){
  if(!allocation||allocation.blocked||!allocation.configuration)return [];
  const slots=Array.isArray(allocation.changedSlots)?allocation.changedSlots:allocation.slotChanges?.filter(s=>s.action!=='keep').map(s=>s.slot)||[];
  return [...new Set(slots.map(Number))].sort((a,b)=>a-b).map(slot=>{
    const explicit=allocation.slotChanges?.find(s=>Number(s.slot)===slot);
    return {slot,before:explicit?.before||config?.discs?.find(d=>d.slot===slot),target:explicit?.target||allocation.configuration.discs?.find(d=>d.slot===slot),action:explicit?.action||'replace',reason:explicit?.reason||''};
  }).filter(s=>s.target);
}

const node=(tag,cls='',text='')=>{const n=document.createElement(tag);n.className=cls;n.textContent=text;return n;};
const field=(label,control)=>{const n=node('label','disc-budget-field');n.append(node('span','',label),control);return n;};
function select(label,items){const n=node('select');n.setAttribute('aria-label',label);for(const[value,text]of items){const o=node('option','',text);o.value=value;n.append(o);}return n;}
const number=n=>Number.isFinite(n)?Number(n).toLocaleString('zh-CN',{maximumFractionDigits:3}):'超出数值范围';
const percentage=p=>p>0&&p<.00001?(p*100).toExponential(2)+'%':number(p*100)+'%';
function costText(cost,rules){return KEYS.filter(k=>cost.max[k]>0).map(k=>`${cost.min[k]===cost.max[k]?number(cost.min[k]):number(cost.min[k])+'–'+number(cost.max[k])} ${rules.materials[k].name}`).join(' + ')||'0';}
function boundsText(range,format=number){
  if(!Number.isFinite(range.min))return '无法给出有限范围';
  if(!Number.isFinite(range.max))return `${format(range.min)}起（上限无法确定）`;
  return range.min===range.max?format(range.min):`${format(range.min)}–${format(range.max)}`;
}
function rangeCostText(cost,rules){return KEYS.filter(k=>cost.max[k]>0).map(k=>`${rules.materials[k].name} ${boundsText({min:cost.min[k],max:cost.max[k]})}`).join(' + ')||'0';}
function statName(raw,data,rules){const p=data?.properties?.[raw]||rules.substats.find(s=>id(s)===String(raw))||{};return (p.name||String(raw))+(p.percent||p.unit==='%'?'%':'');}
function describeDisc(d,data,rules,isTarget=false){
  if(!d||d.absent)return '未装备';
  const main=rules.mainStatsBySlot[String(d.slot)]?.find(s=>id(s)===String(d.mainId));
  const set=d.setName||data?.setNames?.[d.setId]||'';
  return `${set?set+'；':''}${main?.name||statName(d.mainId,data,rules)}${main?.unit||''}主属性；${(d.subs||[]).map(s=>`${statName(s.id,data,rules)} ${s.rolls}份`).join('、')||(isTarget?'其余副属性不限':'现有副属性未填写')}`;
}
function panelMeaning(config,allocation,change,data){
  try{
    const before=calculatePanel(config,data),discs=config.discs.map(d=>d.slot===change.slot?change.target:d),after=calculatePanel({...config,discs},data);
    const rows=(allocation.rows||[]).filter(r=>r.group&&Number.isFinite(r.targetRaw)),parts=[];
    for(const r of rows){
      const delta=after.values[r.group]-before.values[r.group];
      if(!Number.isFinite(delta)||Math.abs(delta)<1e-8)continue;
      const gap=Math.max(0,r.targetRaw-before.values[r.group]),left=Math.max(0,r.targetRaw-after.values[r.group]);
      parts.push(`${r.label||data.properties[r.group]?.name||r.group} ${delta>=0?'+':''}${formatProperty(r.group,delta,data)}${gap>0?`；该项缺口 ${formatProperty(r.group,gap,data)} → ${formatProperty(r.group,left,data)}`:''}`);
    }
    return parts.length?'仅换这一盘、其余装备保持当前时：'+parts.join('；')+'。':'单换这一盘对当前所列数值目标没有可展示的净变化；可能用于调整套装或属性组合。';
  }catch{return '现有盘或面板资料不足，暂不计算单换盘的面板变化。';}
}

export function renderUpgradeBudget({config,allocation,data,rules,onSelectSlot}={}){
  const root=node('section','disc-budget disc-upgrade-budget');root.append(node('h3','','换盘顺序与调律材料'));
  if(!allocation||allocation.blocked||!allocation.configuration){root.append(node('p','disc-budget-note','先生成一组换盘建议，再比较需要更换号位的调律材料。'));return root;}
  if(!Array.isArray(allocation.changedSlots)&&!Array.isArray(allocation.slotChanges)){root.append(node('p','disc-budget-note','此方案缺少与原盘的更换对照；请重新生成建议后查看预算。'));return root;}
  const changes=upgradeChanges(config,allocation);
  if(!changes.length){
    root.append(node('p','disc-upgrade-zero',allocation.met===true?'这组建议不需要换盘：0 新增调律材料。现有盘的强化、其他培养和已消耗材料不包含在此结论中。':'本轮未找到可用换盘目标，所选面板目标仍未达成。请核对锁定盘及候选限制；当前不提供达成目标的材料预算。'));
    return root;
  }
  root.append(node('p','disc-budget-note',`仅比较需要更换的 ${changes.length} 个号位；保留盘不重复计调律预算。成功事件为“获得一张满足该号位全部指定属性的S级目标盘”，不是整套毕业概率。未列出的副属性不限。`));
  root.append(node('p','disc-budget-note','目标盘按S盘强化到15级检验属性；以下只计调律及可选核心仪合成材料，不含盘强化经验与强化丁尼。各方式均选择该目标套装。'));
  root.append(node('p','disc-budget-note','正式3.2游戏规则已核实：高级调律S级概率100%；启用音轨设定后，指定套装概率100%。本页各方式都以前往音像店并选定目标套装为前提。'));
  if(!allocation.met)root.append(node('p','disc-budget-note','这组建议尚未覆盖全部面板目标；下列预算仅针对列出的目标盘。'));
  root.append(node('p','disc-budget-note','面板变化不等于伤害变化；单换盘结果包含当前套装与已实现的恒常转换，各号位变化可能因套装关系而不能直接相加。'));
  const controls=node('div','disc-upgrade-controls'),source=select('换盘预算显示方式',[['none','只看确定材料成本'],['uniform','查看等概率数学试算范围']]);
  const modelNotice=node('p','disc-budget-note','不用填写成功率。网站自动计算初始3条和4条两种情况，给出未知占比下的预算范围。这只是等概率假设下的结果，不保证真实掉率落在范围内，也不是保底。');modelNotice.hidden=true;
  const model=node('details','disc-upgrade-model');model.hidden=true;
  model.append(node('summary','','查看试算假设与范围来源'),node('p','disc-budget-note','先选定目标套装，按高级调律必出S盘计算；假设随机号位各1/6、该号位合法主属性等概率、排除同名主属性后的合法副属性均匀无放回生成，补齐四条后每次独立等概率强化。初始三条有4次强化，初始四条有5次。没有将这些随机分布认定为游戏真实掉率。'),node('p','disc-budget-note','分别计算全部为初始三条、全部为初始四条时的完整单次成功率，再取未知混合比例的上下界。两端均包含号位、主属性、全部目标副属性出现及强化达标，不是只统计已出好盘后的强化概率。材料区间还包含已知的单次费用不确定范围；不是从实测样本得到的统计置信区间。'),node('p','disc-budget-note','在均匀无放回模型中，先放入指定副属性再补齐，与自然生成四条后以包含指定属性为条件，最终集合分布相同。网站自动按这个等价数学场景计算；不代表已验证游戏的副定向生成机制。指定副属性不保证强化命中。'));
  const crafting=node('input');crafting.type='checkbox';crafting.setAttribute('aria-label','将核心仪折算为合成材料');
  controls.append(field('预算显示方式',source),modelNotice,model,field('比较预算时将核心仪折算为合成材料',crafting));root.append(controls);
  const ranking=node('div','disc-upgrade-ranking');root.append(ranking);
  const cards=[];
  for(const change of changes){
    const section=node('details','disc-upgrade-slot');section.dataset.slot=String(change.slot);section.open=cards.length===0;
    section.append(node('summary','',`${change.slot}号位 · ${change.action==='fill'?'补齐空位':'更换目标盘'}`),node('p','disc-upgrade-before','现有：'+describeDisc(change.before,data,rules)),node('p','disc-upgrade-target','目标：'+describeDisc(change.target,data,rules,true)),node('p','disc-upgrade-meaning',panelMeaning(config,allocation,change,data)));
    if(change.reason)section.append(node('p','disc-budget-note',change.reason));
    if(onSelectSlot){const b=node('button','','查看此号位的单盘预算');b.type='button';b.onclick=()=>onSelectSlot(change.slot);section.append(b);}
    const rows=[];
    try{
      const options=summarizeUpgradeOptions({slot:change.slot,mainId:change.target.mainId,targetSubs:change.target.subs||[],rules});
      for(const option of options){
        const box=node('div','disc-upgrade-method');box.dataset.mode=option.mode;
        const k=option.mode==='sub1'?1:option.mode==='sub2'?2:0;
        box.append(node('h4','',option.label),node('p','disc-upgrade-cost',`单次：${costText(option.cost,rules)}`));
        if(k)box.append(node('p','disc-budget-note','定向：'+change.target.subs.slice(0,k).map(s=>statName(s.id,data,rules)).join('、')+'；其余指定目标仍需随机生成并达标。'));
        for(const warning of option.cost.uncertainties)box.append(node('p','disc-budget-note',warning));
        const result=node('div','disc-upgrade-result');
        box.append(result);section.append(box);rows.push({option,result});
      }
    }catch(e){section.append(node('p','disc-budget-error',e.message));}
    root.append(section);cards.push({change,rows});
  }
  root.append(node('p','disc-budget-note','期望次数不是保底。50%/90%预算按各次独立且成功率不变计算；随机号位预算以只追这一张目标盘为口径，未计其他号位或副产物的价值。不要把各号位90%预算直接视为整套90%保证。'));
  function update(){
    const enabled=source.value==='uniform';model.hidden=!enabled;modelNotice.hidden=!enabled;
    const evaluated=[];
    for(const{change,rows}of cards)for(const row of rows){
      row.result.replaceChildren();
      if(!enabled){row.result.append(node('p','disc-budget-note','这里先列确定单次成本；开启数学试算后，网站会自动计算预算范围。'));continue;}
      let probabilityRange,error='';
      try{
        probabilityRange=fullGenerationRange({slot:change.slot,mainId:change.target.mainId,targetSubs:change.target.subs||[],mode:row.option.mode,rules,assumption:'uniform-generation'});
      }catch(e){error=e.message;}
      if(error){row.result.append(node('p','disc-budget-note',error));continue;}
      const option={...row.option,probabilityRange,rangeBudget:budgetForProbabilityRange({probability:probabilityRange,cost:row.option.cost})};evaluated.push(option);
      row.result.append(node('p','disc-upgrade-probability',`数学试算的完整单次成功率范围：${boundsText(probabilityRange,percentage)}`));
      if(!option.rangeBudget.possible){row.result.append(node('p','disc-budget-note','两种初始情况都无法满足这张目标盘的要求，当前数学模型内没有有限成功预算。'));continue;}
      const convert=cost=>crafting.checked?coreCraftEquivalent(cost,rules):cost;
      const b=option.rangeBudget;
      row.result.append(node('p','',`期望次数范围：${boundsText(b.expectedAttempts)}；材料：${rangeCostText(convert(b.expected),rules)}`),node('p','',`达到50%所需次数范围：${boundsText(b.attempts50)}；材料：${rangeCostText(convert(b.confidence50),rules)}`),node('p','',`达到90%所需次数范围：${boundsText(b.attempts90)}；材料：${rangeCostText(convert(b.confidence90),rules)}`));
      if(!b.finiteUpperBound)row.result.append(node('p','disc-budget-note','成功率下界为0，预算上限无法确定。范围下端只是较有利初始情况下的估算，不能据此承诺一定能出。'));
      if(crafting.checked&&row.option.cost.max.cores)row.result.append(node('p','disc-budget-note','核心仪已替换为合成所需的校音器和丁尼，不重复计成品。'));
    }
    ranking.replaceChildren();
    if(!enabled){ranking.append(node('p','disc-budget-note','目前只列确定成本。想比较随机或定向方式，可开启数学试算；无需自己填写概率。'));return;}
    const feasible=evaluated.filter(o=>o.probabilityRange.max>0);
    if(!feasible.length){ranking.append(node('p','disc-budget-note','当前目标没有可比较的有限数学预算；请先核对目标要求。'));return;}
    const frontier=paretoRangeOptions(evaluated,{craftCores:crafting.checked,rules}),label=o=>`${o.slot}号位·${o.label}`;
    if(frontier.length===1&&feasible.length>1){
      ranking.append(node('p','disc-upgrade-priority',`在这套数学假设下，${label(frontier[0])} 的各项材料预算上界都不高于其他候选的下界，可优先考虑。真实掉率尚未核实，不能据此保证实际最省。`));
    }else{
      ranking.append(node('p','disc-upgrade-priority',frontier.length>1?'这些候选的预算区间重叠，或不同材料各有取舍；目前无法确定唯一的先刷顺序。':'目前只有一个候选能给出可行范围，无法据此验证真实的最省顺序。'));
    }
    ranking.append(node('p','disc-budget-note',`仍需比较的候选：${frontier.map(label).join('、')}。只有一种方案的最坏预算在每种材料上都不高于另一种的最好预算，并且至少节省一种材料，才将后者排后；不将不同材料相加。`));
    const dominated=feasible.filter(o=>!frontier.includes(o));
    if(dominated.length)ranking.append(node('p','disc-budget-note',`本模型下可排后的候选：${dominated.map(label).join('、')}。`));
    ranking.append(node('p','disc-budget-note','这是逐张目标盘的资源比较，不保证整套最少材料或最大面板提升。'));
  }
  for(const control of [source,crafting])control.addEventListener('input',update);
  update();return root;
}

import {inspectDiscRolls,baseEquipmentProperties} from './disc-planner-core.js?v=20261118-disc-context-score-launch-1';

// DUKE's transparent allocation rubric, not official ratings or a damage model.
export const SCORE_RULES=Object.freeze({
  version:'duke-disc-score-v2',scale:100,primaryWeight:1,secondaryWeight:0.5,
  grades:Object.freeze([
    {grade:'SSS',min:90},{grade:'SS',min:80},{grade:'S',min:70},
    {grade:'A',min:60},{grade:'B',min:45},{grade:'C',min:30},{grade:'D',min:0}
  ].map(Object.freeze))
});
export const BUILD_FIT_RULES=Object.freeze({substats:60,main:20,set:10,target:10,targetMargin:0.05});
const round=value=>Math.round((value+Number.EPSILON)*10)/10;
const gradeFor=score=>SCORE_RULES.grades.find(entry=>score>=entry.min).grade;
const uniqueIds=values=>[...new Set((Array.isArray(values)?values:[]).map(Number).filter(Number.isSafeInteger))];

// The recorded Workshop default lists percentage and flat ATK under a single
// ATK heading. Nine ATK% rolls plus two flat ATK rolls total 9.6 in its detail.
const velinaWeights=Object.freeze({31203:1,12102:0.75,23203:0.3,12103:0.75*0.3});
function velinaDefault(build){
  if(String(build?.id)!=='1561'||build.customSubstats||build.alternativeId||build.alternativeSource)return false;
  const primary=uniqueIds(build.effectiveSubstats?.primaryIds),secondary=uniqueIds(build.effectiveSubstats?.secondaryIds);
  return primary.length===2&&primary.includes(31203)&&primary.includes(12102)&&secondary.includes(12103)&&secondary.every(id=>id===12103||id===23203);
}
export function withDiscScoreDefaults(build){
  if(!velinaDefault(build)||uniqueIds(build.effectiveSubstats.secondaryIds).includes(23203))return build;
  return {...build,effectiveSubstats:{...build.effectiveSubstats,secondaryIds:[...build.effectiveSubstats.secondaryIds,23203]}};
}

export function getDiscScoreProfile(build,data,config){
  build=withDiscScoreDefaults(build);
  const primaryIds=uniqueIds(build?.effectiveSubstats?.primaryIds);
  const secondaryIds=uniqueIds(build?.effectiveSubstats?.secondaryIds);
  const weights=Object.fromEntries(Object.keys(data.subBases||{}).map(id=>[id,0]));
  for(const id of secondaryIds)if(Object.hasOwn(weights,id))weights[id]=SCORE_RULES.secondaryWeight;
  for(const id of primaryIds)if(Object.hasOwn(weights,id))weights[id]=SCORE_RULES.primaryWeight;
  const agentId=String(build?.id||''),adjustments=[];
  let basis={zh:'DUKE 按当前玩法的词条分类赋予基础权重，优先为 1，补充为 0.5。',
    en:'DUKE assigns 1 to this build’s priority substats and 0.5 to its supplementary substats.',
    sourceUrl:build?.alternativeSource||build?.mechanicsSource?.url};
  if(build?.personalDamageSubstatsAreOptional)basis={
    zh:'本流派按个人输出方向赋权，优先 1、补充 0.5。护盾与击破功能另看主属性和整套面板。',
    en:'These priorities (1) and supplementary stats (0.5) rate this personal damage variant. Check shields and Daze separately against main stats and the equipped build.',
    sourceUrl:build.alternativeSource};
  if(velinaDefault(build)){
    for(const [id,weight] of Object.entries(velinaWeights))if(Object.hasOwn(weights,id))weights[id]=Math.round(weight*1000)/1000;
    basis={zh:'维琳娜采用工坊样本的精通 1、攻击% 0.75、穿透值 0.3。',
      en:'Velina uses the Workshop sample’s Proficiency weight of 1, ATK% weight of 0.75 and PEN weight of 0.3.'};
  }
  const flatConversions=[];
  const base=!build?.customSubstats&&String(config?.id)===agentId?baseEquipmentProperties(config,data):null;
  for(const [group,zh,en] of [[111,'生命','HP'],[121,'攻击','ATK'],[131,'防御','DEF']]){
    const flatId=group*100+3,percentId=group*100+2,percentWeight=weights[percentId];
    if(!(percentWeight>0&&weights[flatId]>0))continue;
    const baseValue=base?.[group*100+1],flatUnit=Number(data.subBases[flatId]),percentUnit=Number(data.subBases[percentId])/100;
    if(!(Number.isFinite(baseValue)&&baseValue>0&&Number.isFinite(flatUnit)&&flatUnit>0&&Number.isFinite(percentUnit)&&percentUnit>0))continue;
    const weight=Math.round(flatUnit/(baseValue*percentUnit/100)*percentWeight*1000)/1000;
    weights[flatId]=weight;
    flatConversions.push({flatId,percentId,baseValue,flatUnit,percentUnit,percentWeight,weight});
    basis.zh+=` 按当前基础${zh} ${baseValue}，固定${zh}单份权重为 ${flatUnit} ÷（${baseValue} × ${percentUnit}%）× ${percentWeight} ≈ ${weight}。`;
    basis.en+=` At ${baseValue} base ${en}, one flat ${en} roll has weight ${flatUnit} ÷ (${baseValue} × ${percentUnit}%) × ${percentWeight} ≈ ${weight}.`;
  }
  if(velinaDefault(build)&&!flatConversions.length){
    basis.zh+=' 基础攻击资料不全时，按样本中 9 份攻击% 与 2 份固定攻击合计 9.6 份，推算固定攻击权重为 0.225。';
    basis.en+=' When base ATK is unavailable, the sample’s nine ATK% rolls and two flat ATK rolls total 9.6 ATK rolls, implying a flat ATK weight of 0.225.';
  }
  if(!build?.customSubstats&&agentId==='1611'&&weights[20103]>0&&weights[21103]>0){
    // Fixed Gachabase release 3.3.0 D/R19815450: initial CD -> initial CR at 0.35.
    // 4.8% CD per roll gives 1.68% CR, compared with 2.4% per direct CR roll.
    const critRate=Number(data.subBases[20103]),critDamage=Number(data.subBases[21103]);
    if(critRate>0&&critDamage>0){
      weights[21103]=Math.round(critDamage*0.35/critRate*weights[20103]*1e6)/1e6;
      adjustments.push({id:21103,weight:weights[21103],reason:'claret-crit-conversion',
        sourceUrl:build.mechanicsSource?.url||'https://zzz.gachabase.net/agents/1611/claret/release/3.3.0/19815450?lang=zh-CN'});
    }
  }
  return {agentId,weights,adjustments,basis,flatConversions,primaryIds,secondaryIds,mode:primaryIds.length?'core-substats':'supplement-only',
    available:Object.values(weights).some(weight=>weight>0)};
}

function mainStatStatus(disc,build,data){
  const main=Number(disc.mainId),slot=Number(disc.slot);
  if(!Object.hasOwn(data.mainBases?.[slot]||{},main))return 'unknown';
  if(slot<=3)return 'recommended';
  if(uniqueIds(build?.mainStatIds?.[slot]).includes(main))return 'recommended';
  if(uniqueIds(build?.conditionalMainStatIds?.[slot]).includes(main))return 'conditional';
  return 'mismatch';
}

export function scoreDisc(disc,build,data,config){
  const d=disc||{},profile=getDiscScoreProfile(build,data,config),weights=profile.weights;
  const mainStatus=mainStatStatus(d,build,data),count=inspectDiscRolls(d,data);
  const result={status:'invalid',mainStatus,score:null,grade:null,estimatedGrade:null,substatScore:null,
    weightedRolls:0,maxWeightedRolls:0,weights,lines:[],reasons:[],profile};
  const unavailable=(status,reason=status)=>({...result,status,reasons:[reason]});
  if(d.absent)return unavailable('absent');
  if(d.unsupported)return unavailable('unsupported');
  if(!Number.isInteger(d.slot)||d.slot<1||d.slot>6||count.invalid)return unavailable('invalid');
  if(!profile.available)return unavailable('no-profile');

  // A legal full S-rank disc has four distinct substats, excluding its main stat.
  // Use the same initial-four reference at every level/initial count: a good
  // initial-three disc remains one roll behind an otherwise identical four-start.
  const eligible=Object.keys(data.subBases||{}).filter(id=>Number(id)!==Number(d.mainId))
    .map(id=>weights[id]||0).sort((a,b)=>b-a);
  result.maxWeightedRolls=eligible.slice(0,4).reduce((a,b)=>a+b,0)+5*(eligible[0]||0);
  if(!(result.maxWeightedRolls>0))return unavailable('no-profile');
  result.lines=count.lines.map(sub=>({id:sub.id,rolls:sub.rolls,
    weight:weights[sub.id]||0,weightedRolls:sub.rolls*(weights[sub.id]||0),
    scoreContribution:round(sub.rolls*(weights[sub.id]||0)/result.maxWeightedRolls*SCORE_RULES.scale)}));
  result.weightedRolls=result.lines.reduce((sum,line)=>sum+line.weightedRolls,0);
  // Round to the displayed precision before assigning a grade so its threshold
  // agrees with the number on the card. In-progress records get a separate estimate.
  result.substatScore=round(Math.max(0,Math.min(SCORE_RULES.scale,
    result.weightedRolls/result.maxWeightedRolls*SCORE_RULES.scale)));
  if(!d.subs.length)return {...result,status:'empty',reasons:['no-substats']};
  if(mainStatus==='unknown'||mainStatus==='mismatch')return {...result,status:'main-mismatch',reasons:['main-stat-mismatch']};
  result.score=result.substatScore;
  if(mainStatus==='conditional')result.reasons.push('conditional-main-stat');
  if(!count.complete){result.status='partial';result.estimatedGrade=gradeFor(result.score);result.reasons.push('incomplete-record');return result;}
  if(d.level!==15){result.status='unleveled';result.estimatedGrade=gradeFor(result.score);result.reasons.push('not-max-level');return result;}
  result.status='rated';
  result.grade=gradeFor(result.score);
  return result;
}

function recommendedSetFit(disc,build,config){
  if(build.setsUnverified||!build.sets?.length)return null;
  const counts=new Map();
  for(const item of config.discs){
    const id=String(item.setId);
    counts.set(id,(counts.get(id)||0)+1);
  }
  const id=String(disc.setId);
  if(counts.get(id)<2)return 0;
  let fit=0;
  for(const plan of build.sets){
    const four=String(plan.fourPieceId);
    const two=(plan.twoPieceIds||[]).map(String).filter(other=>other!==four);
    if(id!==four&&!two.includes(id))continue;
    fit=Math.max(fit,id===four&&counts.get(four)>=4?0.75:0.5);
    if(counts.get(four)>=4&&two.some(other=>counts.get(other)>=2))return 1;
  }
  return fit;
}

// A disc that keeps a real breakpoint can earn the target points even with
// modest substats. The margin makes tiny contributions vary smoothly near it.
function equippedTargetFit(contribution){
  if(!contribution.comparableTargetCount)return null;
  let best=0,overLimit=0;
  for(const row of contribution.targets){
    if(!(row.targetRaw>0))continue;
    const margin=BUILD_FIT_RULES.targetMargin*row.targetRaw;
    const gapWithout=Math.max(0,(row.bound==='maximum'?1:-1)*(row.withoutDisc-row.targetRaw));
    best=Math.max(best,row.closed/Math.max(gapWithout,margin));
    overLimit=Math.max(overLimit,row.excess/margin);
  }
  return Math.max(0,Math.min(1,best)-Math.min(1,overLimit));
}

/** Rate the current equipped use separately from the disc's own substats.
 * Pass the matching slot from evaluateDiscContributions, using the current
 * player, build, tier and team. A missing criterion never earns free points. */
export function scoreEquippedDisc(disc,build,data,config,contribution){
  const raw=scoreDisc(disc,build,data,config);
  const part=(key,fraction)=>fraction==null?{points:0,max:0}:
    {points:round(BUILD_FIT_RULES[key]*fraction),max:BUILD_FIT_RULES[key]};
  const parts={substats:part('substats',null),main:part('main',null),set:part('set',null),target:part('target',null)};
  const result={...raw,score:null,grade:null,estimatedGrade:null,substatGrade:raw.grade??raw.estimatedGrade,
    parts,totalMax:0,contextStatus:'unavailable'};
  if(raw.mainStatus==='mismatch'&&!uniqueIds(build?.mainStatIds?.[disc?.slot]).length){
    result.mainStatus='unverified';
    if(raw.status==='main-mismatch'){
      result.status='unverified-main';
      result.reasons=['no-main-reference'];
    }
  }
  if(raw.substatScore==null||!['rated','unleveled','main-mismatch'].includes(raw.status)||contribution?.status!=='ready'||
      !contribution.completeBuild||String(build?.id)!==String(config?.id))return result;
  parts.substats=part('substats',raw.substatScore/SCORE_RULES.scale);
  // Slots 1–3 have no selectable main. A conditional choice needs evidence
  // beyond the main's identity, so it also receives no main-stat component.
  if(result.mainStatus==='mismatch')parts.main=part('main',0);
  else if(disc.slot>=4&&raw.mainStatus==='recommended'){
    const initial=data.mainBases[disc.slot][disc.mainId];
    const mainAt=level=>Math.floor(initial*(10000+data.discLevels['4:'+level])/10000);
    parts.main=part('main',mainAt(disc.level)/mainAt(15));
  }
  parts.set=part('set',recommendedSetFit(disc,build,config));
  parts.target=part('target',equippedTargetFit(contribution));
  const components=Object.values(parts);
  result.totalMax=components.reduce((sum,row)=>sum+row.max,0);
  if(result.totalMax===parts.substats.max)return result;
  result.score=round(100*components.reduce((sum,row)=>sum+row.points,0)/result.totalMax);
  result.contextStatus='ready';
  if(disc.level===15&&!['conditional','unverified'].includes(result.mainStatus))result.grade=gradeFor(result.score);
  else result.estimatedGrade=gradeFor(result.score);
  return result;
}

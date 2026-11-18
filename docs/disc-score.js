import {inspectDiscRolls} from './disc-planner-core.js?v=20261117-disc-panel-launch-1';

// DUKE's transparent allocation rubric, not official ratings or a damage model.
export const SCORE_RULES=Object.freeze({
  version:'duke-disc-score-v1',scale:100,primaryWeight:1,secondaryWeight:0.5,
  grades:Object.freeze([
    {grade:'SSS',min:90},{grade:'SS',min:80},{grade:'S',min:70},
    {grade:'A',min:60},{grade:'B',min:45},{grade:'C',min:30},{grade:'D',min:0}
  ].map(Object.freeze))
});
const round=value=>Math.round((value+Number.EPSILON)*10)/10;
const uniqueIds=values=>[...new Set((Array.isArray(values)?values:[]).map(Number).filter(Number.isSafeInteger))];

export function getDiscScoreProfile(build,data){
  const primaryIds=uniqueIds(build?.effectiveSubstats?.primaryIds);
  const secondaryIds=uniqueIds(build?.effectiveSubstats?.secondaryIds);
  const weights=Object.fromEntries(Object.keys(data.subBases||{}).map(id=>[id,0]));
  for(const id of secondaryIds)if(Object.hasOwn(weights,id))weights[id]=SCORE_RULES.secondaryWeight;
  for(const id of primaryIds)if(Object.hasOwn(weights,id))weights[id]=SCORE_RULES.primaryWeight;
  const agentId=String(build?.id||''),adjustments=[];
  if(agentId==='1611'&&weights[20103]>0&&weights[21103]>0){
    // Fixed Gachabase release 3.3.0 D/R19815450: initial CD -> initial CR at 0.35.
    // 4.8% CD per roll gives 1.68% CR, compared with 2.4% per direct CR roll.
    const critRate=Number(data.subBases[20103]),critDamage=Number(data.subBases[21103]);
    if(critRate>0&&critDamage>0){
      weights[21103]=Math.round(critDamage*0.35/critRate*weights[20103]*1e6)/1e6;
      adjustments.push({id:21103,weight:weights[21103],reason:'claret-crit-conversion',
        sourceUrl:build.mechanicsSource?.url||'https://zzz.gachabase.net/agents/1611/claret/release/3.3.0/19815450?lang=zh-CN'});
    }
  }
  return {agentId,weights,adjustments,primaryIds,secondaryIds,mode:build?.effectiveSubstats?.mode||'core-substats',
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

export function scoreDisc(disc,build,data){
  const d=disc||{},profile=getDiscScoreProfile(build,data),weights=profile.weights;
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
  if(!count.complete){result.status='partial';result.estimatedGrade=SCORE_RULES.grades.find(entry=>result.score>=entry.min).grade;result.reasons.push('incomplete-record');return result;}
  if(d.level!==15){result.status='unleveled';result.estimatedGrade=SCORE_RULES.grades.find(entry=>result.score>=entry.min).grade;result.reasons.push('not-max-level');return result;}
  result.status='rated';
  result.grade=SCORE_RULES.grades.find(entry=>result.score>=entry.min).grade;
  return result;
}

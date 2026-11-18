import {resolveGraduation} from './agent-graduation.js?v=20261107-refresh-launch-1';
export const STAT_GROUPS={hp:111,atk:121,def:131,impact:122,sheerForce:123,critRate:201,critDmg:211,penRatio:231,pen:232,energyRegen:305,energyRegenBonus:30502,anomalyProficiency:312,anomalyMastery:314};
const integer=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b;
// Shared Gachabase UI unlock table; agrees with all 62 release cultivation records.
const CORE_LEVEL_REQUIREMENTS=[1,15,25,35,45,55,60];
const clone=x=>JSON.parse(JSON.stringify(x));
const owns=(table,key)=>table!=null&&Object.hasOwn(table,String(key));
const numericId=value=>(typeof value==='number'||typeof value==='string'&&/^\d+$/.test(value.trim()))&&Number.isSafeInteger(Number(value))&&Number(value)>0?Number(value):null;
const sourceNumber=value=>(typeof value==='number'||typeof value==='string'&&value.trim()!=='')&&Number.isFinite(Number(value))?Number(value):null;
const discRollLimits=(initial,level)=>{
  const upgradeNodes=integer(level,0,15)?Math.floor(level/3):null,known=[3,4].includes(initial)&&upgradeNodes!==null;
  return {upgradeNodes,expectedTotalRolls:known?initial+upgradeNodes:null,expectedTypes:known?Math.min(4,initial+upgradeNodes):null,maxRollsPerStat:known?1+Math.max(0,upgradeNodes-(4-initial)):null};
};
// Counts are the recorded lower bound, not an estimate of combat effectiveness.
// A missing substat type needs its first roll before any remaining rolls can be assigned.
export function inspectDiscRolls(disc,data){
  const d=disc||{},slot=d.slot,limits=discRollLimits(d.initial,d.level),problems=[],problemCodes=[];
  const problem=(code,message)=>{if(!problemCodes.includes(code)){problemCodes.push(code);problems.push(message);}};
  if(numericId(d.mainId)===null||!owns(data.mainBases?.[slot],numericId(d.mainId)))problem('main',`${slot}号位主属性不合法`);
  if(d.setId&&(numericId(d.setId)===null||!owns(data.setProps,d.setId)))problem('set',`${slot}号位套装未收录`);
  if(!integer(d.level,0,15))problem('level',`${slot}号盘等级无效`);
  if(![3,4].includes(d.initial))problem('initial',`${slot}号盘初始副属性数量无效`);
  const hasSubs=Array.isArray(d.subs),subs=hasSubs?d.subs:[],seen=new Set(),recognized=new Set();
  if(!hasSubs||subs.length>4)problem('types',`${slot}号盘副属性数量无效`);
  let rawTotalRolls=hasSubs?0:null;
  const lines=subs.map(s=>{
    const id=numericId(s?.id),rolls=sourceNumber(s?.rolls),known=id!==null&&owns(data.subBases,id),valid=known&&id!==numericId(d.mainId)&&!seen.has(id)&&integer(s?.rolls,1,6);
    if(!valid)problem('substat',`${slot}号盘副属性重复、与主属性冲突或份数无效`);
    if(known)recognized.add(id);seen.add(id);
    if(rolls===null)rawTotalRolls=null;else if(rawTotalRolls!==null)rawTotalRolls+=rolls;
    return {id,rolls,additionalRolls:integer(s?.rolls,1,6)?s.rolls-1:null,valid:valid&&(limits.maxRollsPerStat===null||rolls<=limits.maxRollsPerStat)};
  });
  const recordedTypes=recognized.size,enteredTypes=subs.length;
  const missingTypes=limits.expectedTypes===null?null:Math.max(0,limits.expectedTypes-recordedTypes),minimumReservedRolls=missingTypes;
  const missingRolls=limits.expectedTotalRolls===null||rawTotalRolls===null?null:Math.max(0,limits.expectedTotalRolls-rawTotalRolls);
  const minimumTotalRolls=rawTotalRolls===null||minimumReservedRolls===null?null:rawTotalRolls+minimumReservedRolls;
  if(limits.expectedTotalRolls!==null&&(minimumTotalRolls!==null&&minimumTotalRolls>limits.expectedTotalRolls||lines.some(s=>s.rolls!==null&&s.rolls>limits.maxRollsPerStat)))problem('capacity',`${slot}号盘份数超过当前等级上限（还需为其他副属性保留首次份数）`);
  if(d.absent&&d.locked)problem('absent-locked',`${slot}号位为空，不能锁定保留`);
  if(d.unsupported)problem('unsupported',`${slot}号盘为非S级或未知属性，请先选择S级目标；不把旧盘当成满级金盘`);
  const status=d.absent?'absent':d.unsupported?'unsupported':problems.length?'invalid':missingRolls===0&&missingTypes===0?'complete':'partial';
  return {status,complete:status==='complete',partial:status==='partial',invalid:problems.length>0,rawTotalRolls,recordedTypes,enteredTypes,
    ...limits,initial:[3,4].includes(d.initial)?d.initial:null,missingRolls,missingTypes,minimumReservedRolls,minimumTotalRolls,lines,problems,problemCodes};
}
export function formatProperty(id,value,data){const p=data.properties[id]||{};return `${Number(value/(p.percent?100:p.divisor||1)).toLocaleString('zh-CN',{maximumFractionDigits:2})}${p.percent?'%':''}`;}
export function weaponStats(config,data){
  if(!config.weaponId)return [];
  const w=data.weapons[config.weaponId],l=data.weaponLevels[`${w?.Rarity}:${config.weaponLevel}`],s=data.weaponStars[`${w?.Rarity}:${config.weaponBreak}`];
  if(!w||!l||!s)throw Error('音擎等级资料不完整');
  return ['MainStat','SecondaryStat'].map((k,i)=>({propertyId:w[k].PropertyId,value:Math.floor(w[k].PropertyValue*(10000+(i?s.secondary:l.main+s.main))/10000)}));
}
function validateAgentEquipment(config,data){
  const problems=[];
  if(numericId(config.id)===null||!owns(data.agents,config.id))problems.push('请选择已收录的正式服代理人');
  for(const [k,min,max]of [['level',1,60],['promotion',0,6],['core',0,6],['cinema',0,6],['refinement',1,5],['weaponLevel',0,60],['weaponBreak',0,5]])if(!integer(config[k],min,max))problems.push(`${k} 数值超出范围`);
  if(integer(config.level,1,60)&&integer(config.core,1,6)&&config.level<CORE_LEVEL_REQUIREMENTS[config.core])problems.push(`核心强化 ${'ABCDEF'[config.core-1]} 需要角色达到 ${CORE_LEVEL_REQUIREMENTS[config.core]} 级`);
  if(config.weaponId&&(numericId(config.weaponId)===null||!owns(data.weapons,config.weaponId)))problems.push('音擎未收录');
  if(config.level>10*(config.promotion+1))problems.push('角色突破阶段不足以支持当前等级');
  if(config.weaponId&&config.weaponLevel>10*(config.weaponBreak+1))problems.push('音擎改装阶段不足以支持当前等级');
  return problems;
}
export function validateConfiguration(config,data){
  const problems=validateAgentEquipment(config,data);
  if(!Array.isArray(config.discs)||config.discs.length!==6)return [...problems,'需要六个号位'];
  const seen=new Set();
  for(const d of config.discs){
    if(!integer(d.slot,1,6)||seen.has(d.slot)){problems.push('号位重复或无效');continue;}seen.add(d.slot);
    problems.push(...inspectDiscRolls(d,data).problems);
  }
  return [...new Set(problems)];
}
// baseValues are equipment totals. All rules read that same snapshot, so
// a conversion cannot feed itself or amplify another initial-stat conversion.
export function applyPanelMechanics(config,baseValues,data){
  const values={...baseValues}, effects=[];
  const agent=data.panelMechanics?.[config.id];
  if(!agent||!integer(config.core,0,6))return {values,effects};
  for(const rule of agent.rules){
    if(rule.minCinema&&!(config.cinema>=rule.minCinema))continue;
    const params=rule.parameters[rule.ranks.length===1?rule.ranks[0]:rule.ranks[config.core]];
    const {group,scope,inputGroup=null}=rule;
    const inputValue=inputGroup===null?null:baseValues[inputGroup];
    const before=values[group];
    if(!Number.isFinite(before)||(inputGroup!==null&&!Number.isFinite(inputValue)))continue;
    const units=inputGroup===null?1:Math.floor(Math.max(0,inputValue-params.threshold)/params.step);
    let bonus=Math.min(units*params.gain,params.limit??Infinity);
    let {description,descriptionEn}=params;
    if(rule.modifier&&config.cinema>=rule.modifier.minCinema){
      bonus*=rule.modifier.multiplier;
      description+=' '+rule.modifier.description;
      descriptionEn+=' '+rule.modifier.descriptionEn;
    }
    // Preserve half-points and decimal caps in the source; discard binary
    // floating-point noise before display or comparison to a decimal target.
    bonus=Math.round(bonus*1e6)/1e6;
    const after=Math.round((before+bonus)*1e6)/1e6;
    if(scope==='passive')values[group]=after;
    effects.push({group,inputGroup,inputValue,before,bonus,after,scope,description,descriptionEn,
      condition:rule.condition,conditionEn:rule.conditionEn,sourceUrl:agent.sourceUrl,
      minCinema:rule.minCinema,modifierCinema:config.cinema>=rule.modifier?.minCinema?rule.modifier.minCinema:undefined});
  }
  return {values,effects};
}
const panelGroups=[111,121,131,122,123,201,211,231,232,305,312,314,315,316,317,318,319,320,322,323,213,324,325];
function panelFromProperties(config,data,props,groups=panelGroups){
  const values={};
  for(const g of groups){
    const b=props[g*100+1]||0,r=props[g*100+2]||0,f=props[g*100+3]||0;
    values[g]=g===111?b+Math.ceil(b*r/10000)+f:Math.floor(b*(10000+r)/10000)+f;
  }
  if(String(config.id)==='1121'&&121 in values)values[121]+=Math.floor(values[131]*[40,46,52,60,66,72,80][config.core]/100);
  if(String(config.id)==='1611'&&201 in values)values[201]+=Math.floor(values[211]*35/100);
  if(data.agents[config.id].ProfessionType==='Rupture'&&123 in values)values[123]+=Math.floor(values[121]*3/10)+Math.floor(values[111]/10);
  values[30502]=props[30502]||0;
  return applyPanelMechanics(config,values,data);
}
// Properties before discs and set bonuses. Percentage ATK/HP/DEF rolls scale
// the corresponding base property, including the character and W-Engine.
export function baseEquipmentProperties(config,data){
  if(!config||!data?.agents||config.weaponId&&!data.weapons||validateAgentEquipment(config,data).length)return null;
  return equipmentProperties(config,data);
}
function equipmentProperties(config,data){
  const a=data.agents[config.id],props={},add=(k,v)=>props[k]=(props[k]||0)+Number(v),promotion=config.promotion?a.PromotionProps?.[config.promotion-1]:{};
  if(!a.BaseProps||!a.GrowthProps||!a.CoreEnhancementProps?.[config.core]||!promotion)return null;
  if(config.weaponId){
    const w=data.weapons[config.weaponId];
    if(!w.MainStat||!w.SecondaryStat||!data.weaponLevels?.[`${w.Rarity}:${config.weaponLevel}`]||!data.weaponStars?.[`${w.Rarity}:${config.weaponBreak}`])return null;
  }
  for(const[k,v]of Object.entries(a.BaseProps))add(k,v+Math.floor((a.GrowthProps[k]||0)*(config.level-1)/10000)+(promotion[k]||0));
  for(const[k,v]of Object.entries(a.CoreEnhancementProps[config.core]))add(k,Math.floor(v));
  for(const s of weaponStats(config,data))add(s.propertyId,s.value);
  return props;
}
export function calculatePanel(config,data){
  const errors=validateConfiguration(config,data);if(errors.length)throw Error(errors.join('；'));
  const props=equipmentProperties(config,data);
  if(!props)throw Error('角色或音擎的基础属性资料不完整');
  const add=(k,v)=>props[k]=(props[k]||0)+Number(v);
  const counts={};
  for(const d of config.discs){
    if(d.absent)continue;
    add(numericId(d.mainId),Math.floor(data.mainBases[d.slot][numericId(d.mainId)]*(10000+data.discLevels[`4:${d.level}`])/10000));
    for(const s of d.subs)add(numericId(s.id),data.subBases[numericId(s.id)]*s.rolls);
    if(d.setId)counts[d.setId]=(counts[d.setId]||0)+1;
  }
  for(const[id,n]of Object.entries(counts))if(n>=2)for(const[k,v]of Object.entries(data.setProps[id]))add(k,v);
  return {...panelFromProperties(config,data,props),props,counts};
}
export function normalizedToConfiguration(agent,data){
  const config={id:String(agent.id),level:sourceNumber(agent.level),promotion:sourceNumber(agent.promotionLevel),core:sourceNumber(agent.coreSkillEnhancement),cinema:sourceNumber(agent.mindscape),
    weaponId:String(agent.weapon?.id||''),weaponLevel:sourceNumber(agent.weapon?.level)??60,weaponBreak:sourceNumber(agent.weapon?.breakLevel)??5,refinement:sourceNumber(agent.weapon?.refinement)??1,discs:[]};
  for(let slot=1;slot<=6;slot++){
    const matches=Array.isArray(agent.discs)?agent.discs.filter(d=>sourceNumber(d?.slot)===slot):[],d=matches[0];
    const defaultMain=Number(Object.keys(data.mainBases[slot])[0]);
    if(!d){config.discs.push({slot,setId:'',mainId:defaultMain,level:15,initial:4,subs:[],locked:false,absent:true,unsupported:false});continue;}
    const reasons=[],countReasons=[],badCounts=message=>{countReasons.push(message);reasons.push(message);};
    if(matches.length!==1)badCounts('同一号位出现多条源盘记录');
    const level=sourceNumber(d.level),rarity=sourceNumber(d.rarity),mainStats=Array.isArray(d.mainStats)?d.mainStats:[],mainStat=mainStats.length===1?mainStats[0]:null,main=numericId(mainStat?.propertyId);
    if(rarity!==4)reasons.push('原盘不是已支持的 S 级盘');
    if(!integer(level,0,15))badCounts('原盘等级缺失或超出 S 级范围');
    if(main===null||!owns(data.mainBases[slot],main)||!Number.isFinite(mainStat?.value)||mainStat.value<=0)reasons.push('原盘主属性缺失、数值无效或不属于该号位');
    if(d.suitId&&!owns(data.setProps,d.suitId))reasons.push('原盘套装未收录');
    const rawSubs=Array.isArray(d.subStats)?d.subStats:[];
    if(!Array.isArray(d.subStats)||rawSubs.length<3||rawSubs.length>4)badCounts('原盘副属性列表不完整，不能推断初始条数');
    const seen=new Set(),subs=rawSubs.map(s=>{
      const id=numericId(s?.propertyId),r=sourceNumber(s?.rollCount),p=sourceNumber(s?.propertyLevel),hasR=s?.rollCount!=null,hasP=s?.propertyLevel!=null;
      if(!hasR&&!hasP||hasR&&!integer(r,1,6)||hasP&&!integer(p,1,6))badCounts('副属性份数缺失或不是合法整数');
      if(hasR&&hasP&&r!==p)badCounts('rollCount 与 propertyLevel 的份数记录冲突');
      const rolls=hasR?r:p;
      if(id===null||!owns(data.subBases,id)||seen.has(id)||id===main)badCounts('副属性编号未知、重复或与主属性冲突');seen.add(id);
      const value=sourceNumber(s?.value),base=sourceNumber(s?.baseValue);
      if(id!==null&&owns(data.subBases,id)&&(value===null||!integer(rolls,1,6)||Math.abs(data.subBases[id]*rolls-value)>1e-7||s?.baseValue!=null&&(base===null||Math.abs(base-data.subBases[id])>1e-7)))badCounts('副属性份数与原始数值不一致');
      return {id:id??0,rolls};
    });
    const upgrades=integer(level,0,15)?Math.floor(level/3):null,total=subs.reduce((n,s)=>n+(integer(s.rolls,1,6)?s.rolls:0),0),inferred=upgrades===null?null:total-upgrades;
    let initial=null;
    if(rarity===4&&countReasons.length===0){
      if(![3,4].includes(inferred))badCounts('副属性总份数与原盘等级不符，无法推断初始三条或四条');
      else if(subs.length!==discRollLimits(inferred,level).expectedTypes||subs.some(s=>s.rolls>discRollLimits(inferred,level).maxRollsPerStat))badCounts('副属性条数或单条份数不符合该等级的强化规则');
      else initial=inferred;
    }
    const unique=[...new Set(reasons)];
    config.discs.push({slot,setId:String(d.suitId||''),mainId:main!==null&&owns(data.mainBases[slot],main)?main:defaultMain,level:level??null,initial,subs,locked:false,absent:false,unsupported:unique.length>0,
      ...(unique.length?{unsupportedReason:unique.join('；'),unsupportedReasons:unique}:{})});
  }
  return config;
}
export function newConfiguration(id,build,equipment,data){
  id=String(id);
  const plan=build.sets?.[0]||{},weaponId=equipment.agents[id]?.signatureEngineId||'';
  return {id,level:60,promotion:6,core:6,cinema:0,weaponId,weaponLevel:60,weaponBreak:5,refinement:1,discs:Array.from({length:6},(_,i)=>({slot:i+1,setId:String(i<4?plan.fourPieceId||'':plan.twoPieceIds?.[0]||''),mainId:Number(i<3?Object.keys(data.mainBases[i+1])[0]:build.mainStatIds[i+1]?.[0]||Object.keys(data.mainBases[i+1])[0]),level:15,initial:4,subs:[],locked:false}))};
}
const keyAliases={attack:'atk',hpMax:'hp',energy:'energyRegen',energyRecovery:'energyRegen',anomaly:'anomalyProficiency',proficiency:'anomalyProficiency',mastery:'anomalyMastery'};
export function resolveTargets(config,agent,profile,equipment,data,tier='small',manualTargets={}){
  const signature=String(equipment.agents[config.id]?.signatureEngineId||''),rank=String(config.weaponId)===signature?config.refinement:0;
  const resolved=resolveGraduation(agent,profile,equipment,config.cinema,rank),rows=[];
  for(const raw of resolved.rows){
    const key=keyAliases[raw.key]||raw.key,group=STAT_GROUPS[key];
    if(!group||raw.purpose==='survival-reference')continue;
    const divisor=(data.properties[group]?.percent||data.properties[group]?.divisor===100)?100:1;
    const target=manualTargets[key]!==undefined?manualTargets[key]:tier==='large'&&raw.max!=null&&raw.bound!=='maximum'?raw.max:raw.min;
    const includeOptional=Array.isArray(config.includeOptionalStatKeys)&&config.includeOptionalStatKeys.includes(key);
    const route=config.route==='crit'?'critical':config.route;
    const available=raw.applicable!==false&&raw.bound!=='maximum'&&(!raw.optional||includeOptional)&&(!raw.choiceGroup||raw.choiceGroup===route);
    const scope=raw.panelContext||'unspecified';
    rows.push({...raw,key,group,target,targetRaw:target*divisor,planning:available&&Number.isFinite(target)&&target>=0&&(tier!=='usable'||raw.bound==='mechanic-threshold'),comparable:scope==='initial'&&config.core===6,scope,custom:manualTargets[key]!==undefined});
  }
  return {...resolved,rows};
}
function canAdd(d,id){
  if(d.locked||Number(d.mainId)===Number(id))return false;
  const limits=discRollLimits(d.initial,d.level);if(limits.expectedTotalRolls===null)return false;
  const sub=d.subs.find(s=>Number(s.id)===Number(id)),n=d.subs.length+(sub?0:1),sum=d.subs.reduce((n,s)=>n+s.rolls,0)+1;
  return n<=limits.expectedTypes&&sum+(limits.expectedTypes-n)<=limits.expectedTotalRolls&&(sub?.rolls||0)<limits.maxRollsPerStat;
}
function addRoll(d,id){const s=d.subs.find(s=>Number(s.id)===Number(id));if(s)s.rolls++;else d.subs.push({id:Number(id),rolls:1});}
const searchLimit=(value,fallback=8000)=>Number.isFinite(Number(value))?Math.max(1,Math.min(50000,Math.floor(Number(value)))):fallback;
function sameDisc(a,b){
  const normalize=d=>({slot:d.slot,setId:String(d.setId||''),mainId:Number(d.mainId),level:d.level,initial:d.initial,absent:!!d.absent,unsupported:!!d.unsupported,subs:d.subs.map(s=>({id:Number(s.id),rolls:s.rolls})).sort((x,y)=>x.id-y.id)});
  return JSON.stringify(normalize(a))===JSON.stringify(normalize(b));
}
function changesBetween(before,target){
  return target.discs.map(d=>{const old=before.discs.find(x=>x.slot===d.slot),action=sameDisc(old,d)?'keep':old.absent?'fill':'replace';return {slot:d.slot,action,before:clone(old),target:clone(d),reason:action==='keep'?'保持当前录入属性和等级':action==='fill'?'补齐原本空缺的号位':old.level!==d.level?'目标同时调整等级或属性；未把强化当作原样保留':'此号位需要调整为候选目标，不代表必须丢弃原盘'};});
}
function removeRoll(d,id){const s=d.subs.find(x=>Number(x.id)===Number(id));if(--s.rolls===0)d.subs=d.subs.filter(x=>x!==s);}

export function allocateTargets(config,data,rows,build,options={}){
  const {useReference=false}=options,mode=options.mode==='fresh'?'fresh':'improve';
  const planningScope=options.scope==='solo'?'solo':'team';
  const activeRows=rows.filter(r=>planningScope!=='solo'||!r.scopeExcluded),excludedRows=planningScope==='solo'?rows.filter(r=>r.scopeExcluded).map(r=>({...r})):[];
  const scopeResult={planningScope,excludedRows,guidanceOnly:false};
  const combatReference=row=>['in-combat','unspecified-combat-bonus'].includes(row.scope??row.panelContext);
  const canCompare=row=>!row.contextBlocked&&!combatReference(row)&&(row.comparable||useReference);
  const eligible=activeRows.filter(row=>row.planning&&canCompare(row));
  const unresolvedRows=activeRows.filter(row=>(row.planning&&!eligible.includes(row))||
    (row.bound==='maximum'&&row.applicable!==false&&combatReference(row))).map(row=>{
      if(combatReference(row))return {...row,reasonCode:'combat-reference',reason:'战斗目标需要实际增益；当前装备数值只供对照。'};
      return {...row,reason:row.contextBlocked?'当前配队未满足或尚未确认该目标的前提':'参考口径与当前装备估算尚未对齐'};
    });
  if(!eligible.length&&unresolvedRows.length&&unresolvedRows.every(row=>row.reasonCode==='combat-reference'))
    return {...scopeResult,guidanceOnly:true,met:false,baselineMet:false,reasonCode:'combat-reference',blocked:'当前数值目标均依赖战斗增益。可查看装备与参考的差值以及逐号位建议。',unresolvedRows};
  if(!eligible.length&&planningScope==='solo')return {...scopeResult,guidanceOnly:true,met:false,baselineMet:false,reasonCode:'no-personal-numeric-targets',blocked:unresolvedRows.some(r=>r.contextBlocked)?'当前个人目标仍有前提待核对，采用参考口径也不能绕过；先查看主属性、套装与逐号位建议。':unresolvedRows.length?'当前个人数值参考的口径尚未对齐；先查看主属性、套装与逐号位建议，明确采用参考口径后再试算。':'当前没有可直接比较的个人数值目标；可继续查看主属性、套装与逐号位建议。',unresolvedRows};
  if(config.level!==60||config.core!==6)return {...scopeResult,blocked:'攻略目标按角色60级、核心F整理；先调整规划等级或只查看逐号位建议。'};
  if(!eligible.length)return {...scopeResult,guidanceOnly:true,met:false,baselineMet:false,reasonCode:'no-comparable-numeric-targets',blocked:unresolvedRows.some(r=>r.contextBlocked)?'当前配队未满足目标的适用条件，不能通过勾选参考口径绕过；请核对队友与目标前提。':'当前没有可直接比较的目标。可选择按攻略参考口径试算，或查看可用档的套装与主属性建议。',unresolvedRows};
  const pool=[...new Set([...(build.effectiveSubstats?.primaryIds||[]),...(build.effectiveSubstats?.secondaryIds||[])].map(Number))].filter(id=>data.subBases[id]);
  const ceilings=activeRows.filter(r=>r.bound==='maximum'&&r.applicable!==false&&canCompare(r)&&Number.isFinite(r.targetRaw));
  const loss=panel=>{
    if(!panel)return Infinity;
    return eligible.reduce((n,r)=>n+(Number.isFinite(panel.values[r.group])&&Number.isFinite(r.targetRaw)?Math.max(0,r.targetRaw-panel.values[r.group])/Math.max(1,r.targetRaw):Infinity),0)+ceilings.reduce((n,r)=>n+Math.max(0,panel.values[r.group]-r.targetRaw)/Math.max(1,r.targetRaw),0);
  };
  const limit=searchLimit(options.maxEvaluations),budget=options._budget||{evaluations:0,maxEvaluations:limit},started=budget.evaluations;
  let truncated=false,migrations=0;const exhaustedChangeCounts=[];
  const evaluate=candidate=>{
    if(budget.evaluations>=budget.maxEvaluations||budget.evaluations-started>=limit){truncated=true;return null;}
    budget.evaluations++;return calculatePanel(candidate,data);
  };
  const validSix=c=>c.discs.length===6&&new Set(c.discs.map(d=>d.slot)).size===6&&c.discs.every(d=>!d.absent&&!d.unsupported);
  // Partial records can certify a met lower bound, but never certify an upper
  // bound: unentered rolls may still increase that stat or a stat converted to it.
  const incompleteCeilingSlots=c=>ceilings.length?c.discs.filter(d=>!d.absent&&inspectDiscRolls(d,data).partial).map(d=>d.slot):[];
  // Unknown source discs may be rebuilt, but a locked unknown disc is never silently replaced.
  if(config.discs.some(d=>d.locked&&(d.absent||d.unsupported)))return {...scopeResult,blocked:'保留的盘为空或属性资料未确认，请先核对该盘；不会自动替换锁定盘。',unresolvedRows};
  let baselinePanel=null;
  if(!config.discs.some(d=>d.unsupported))baselinePanel=evaluate(config);
  const baselineCovered=validSix(config)&&loss(baselinePanel)<1e-8;
  const baselineMet=baselineCovered&&unresolvedRows.length===0&&incompleteCeilingSlots(config).length===0;
  const decorate=state=>{
    const incompleteSlots=incompleteCeilingSlots(state.configuration),incompleteCeilingCheck=incompleteSlots.length>0;
    const ceilingWarnings=ceilings.filter(r=>state.panel.values[r.group]>r.targetRaw).map(r=>({...r,reasonCode:'above-ceiling',reason:'高于攻略所用配置的上限参考，需核对已包含的暴击增益，不判为完成'}));
    const incompleteWarnings=incompleteCeilingCheck?ceilings.filter(r=>state.panel.values[r.group]<=r.targetRaw).map(r=>({...r,reasonCode:'incomplete-ceiling',incompleteSlots:[...incompleteSlots],reason:`${incompleteSlots.join('、')}号位副属性未填全；已录入数值只能作为下界，上限待补齐核对。目标盘未指定的其余属性也可能增加该数值，不判为完成。`})) : [];
    const unresolved=[...unresolvedRows,...ceilingWarnings,...incompleteWarnings],slotChanges=changesBetween(config,state.configuration);
    const changedSlots=slotChanges.filter(x=>x.action!=='keep').map(x=>x.slot),retainedSlots=slotChanges.filter(x=>x.action==='keep').map(x=>x.slot);
    return {...scopeResult,configuration:state.configuration,panel:state.panel,rows:eligible.map(r=>({...r,shortfall:Math.max(0,r.targetRaw-state.panel.values[r.group])})),unresolvedRows:unresolved,
      met:validSix(state.configuration)&&loss(state.panel)<1e-8&&unresolved.length===0,baselineMet,steps:state.steps,mode,changedSlots,retainedSlots,changeCount:changedSlots.length,slotChanges,incompleteCeilingCheck,incompleteCeilingSlots:incompleteSlots,
      provisional:unresolved.length>0||eligible.some(r=>!r.comparable),
      search:{evaluations:budget.evaluations-started,maxEvaluations:limit,truncated,migrations,exhaustedChangeCounts,method:'按换盘号位子集递增，贪心分配后尝试跨盘迁移；子集枚举完成不代表穷尽全部副属性状态'},
      method:mode==='fresh'?'从空白目标重新分配未保留盘；遵守单盘约束，未声称全局最少材料或最大伤害。':
        baselineCovered?(incompleteCeilingCheck?'已录入属性已满足下限目标，保持原盘；部分副属性未录入，上限仍待核对。':'现有六盘已覆盖本次可比较的数值目标，保持原等级和录入属性；未填全的副属性不作补全或猜测。'):
        '从现有六盘出发，先尝试较少换盘；保留锁定盘，有限搜索并尝试迁移属性份数。结果是已找到的参考候选，不保证全局最少材料或最大伤害。'};
  };
  if(mode==='improve'&&baselineCovered)return decorate({configuration:clone(config),panel:baselinePanel,steps:0});
  const overrides=options._mainOverrides||{},unlocked=config.discs.filter(d=>!d.locked).map(d=>d.slot);
  if(config.discs.some(d=>d.locked&&overrides[d.slot]!=null&&Number(overrides[d.slot])!==Number(d.mainId)))return {...scopeResult,blocked:'主属性候选与保留盘冲突，未更改保留盘。',unresolvedRows};
  const mandatory=new Set(config.discs.filter(d=>!d.locked&&(d.absent||d.unsupported||(overrides[d.slot]!=null&&Number(overrides[d.slot])!==Number(d.mainId)))).map(d=>d.slot));
  let best=baselinePanel?{configuration:clone(config),panel:baselinePanel,steps:0,loss:loss(baselinePanel),changeCount:0}:null;
  const covered=s=>validSix(s.configuration)&&s.loss<1e-8;
  const better=(a,b)=>!b||Number(covered(a))>Number(covered(b))||(covered(a)===covered(b)&&(covered(a)?a.changeCount-b.changeCount||a.steps-b.steps:a.loss-b.loss||a.changeCount-b.changeCount||a.steps-b.steps)<0);
  function solve(selected){
    const candidate=clone(config);
    for(const d of candidate.discs)if(selected.has(d.slot)){d.level=15;d.subs=[];if(![3,4].includes(d.initial))d.initial=4;d.unsupported=false;d.absent=false;delete d.unsupportedReason;delete d.unsupportedReasons;if(overrides[d.slot]!=null)d.mainId=Number(overrides[d.slot]);}
    let panel=evaluate(candidate);if(!panel)return null;
    let state={configuration:candidate,panel,loss:loss(panel),steps:0};
    while(state.loss>1e-8&&state.steps<54&&!truncated){
      let next=null;
      const consider=(test,balance,migrated=false)=>{const p=evaluate(test);if(!p)return;const value=loss(p);if(value<state.loss-1e-9&&(!next||value<next.loss-1e-9||Math.abs(value-next.loss)<1e-9&&balance<next.balance))next={configuration:test,panel:p,loss:value,balance,steps:state.steps+1,migrated};};
      for(const d of state.configuration.discs){if(!selected.has(d.slot))continue;for(const id of pool){if(truncated)break;if(!canAdd(d,id))continue;const test=clone(state.configuration);addRoll(test.discs.find(x=>x.slot===d.slot),id);consider(test,d.subs.reduce((n,s)=>n+s.rolls,0));}}
      // Move one already assigned roll without changing the whole-panel totals,
      // then use the freed source capacity for a needed stat. Hard locks are excluded.
      if(!next&&!truncated){
        migration:for(const from of state.configuration.discs){if(!selected.has(from.slot))continue;for(const s of from.subs){for(const to of state.configuration.discs){
          if(!selected.has(to.slot)||from.slot===to.slot||!canAdd(to,s.id))continue;
          const moved=clone(state.configuration),source=moved.discs.find(d=>d.slot===from.slot),dest=moved.discs.find(d=>d.slot===to.slot);removeRoll(source,s.id);addRoll(dest,s.id);
          for(const id of pool){if(truncated)break migration;if(!canAdd(source,id))continue;const test=clone(moved);addRoll(test.discs.find(d=>d.slot===from.slot),id);consider(test,source.subs.reduce((n,x)=>n+x.rolls,0),true);}
        }}}
      }
      if(!next)break;if(next.migrated)migrations++;state=next;
    }
    state.changeCount=changesBetween(config,state.configuration).filter(x=>x.action!=='keep').length;return state;
  }
  if(mode==='fresh')best=solve(new Set(unlocked));
  else {
    // Establish a feasible fallback before spending the budget on small replacement subsets.
    // This matters when a sparse starting loadout needs several discs at once.
    if(unlocked.length){const seed=solve(new Set(unlocked));if(seed&&better(seed,best))best=seed;}
    for(let count=Math.max(1,mandatory.size);count<=unlocked.length&&!truncated;count++){
      for(let mask=1;mask<(1<<unlocked.length)&&!truncated;mask++){
        const selected=new Set(unlocked.filter((_,i)=>mask&(1<<i)));if(selected.size!==count||[...mandatory].some(x=>!selected.has(x)))continue;
        const result=solve(selected);if(result&&better(result,best))best=result;
      }
      if(!truncated)exhaustedChangeCounts.push(count);
      if(best&&covered(best)&&best.changeCount<=count)break;
    }
  }
  if(!best)return {...scopeResult,blocked:truncated?'搜索额度已用完，尚未找到可评估候选；不能据此认定无解。':'尚未找到可评估候选，请核对盘的资料与保留条件。',unresolvedRows,baselineMet:false,search:{evaluations:budget.evaluations-started,maxEvaluations:limit,truncated,migrations,exhaustedChangeCounts}};
  return decorate(best);
}
export function compareDisc(current,target){
  return !current.absent&&Number(current.mainId)===Number(target.mainId)&&String(current.setId)===String(target.setId)&&current.level===15&&!current.unsupported&&target.subs.every(t=>(current.subs.find(s=>Number(s.id)===Number(t.id))?.rolls||0)>=t.rolls);
}

// Only these raw groups can affect a target. Other legal substats still occupy
// slots and receive upgrades in the distribution below.
function farmGroups(config,data,rows){
  const groups=new Set(rows.map(row=>row.group));
  for(const rule of data.panelMechanics?.[config.id]?.rules||[]){
    if(groups.has(rule.group)&&rule.scope==='passive'&&rule.inputGroup!=null)groups.add(rule.inputGroup);
  }
  if(groups.has(123)&&data.agents[config.id].ProfessionType==='Rupture'){groups.add(111);groups.add(121);}
  if(groups.has(121)&&String(config.id)==='1121')groups.add(131);
  if(groups.has(201)&&String(config.id)==='1611')groups.add(211);
  return groups;
}
const farmGap=(row,values)=>Math.max(0,(row.bound==='maximum'?1:-1)*(values[row.group]-row.targetRaw))/Math.max(1,row.targetRaw);
function comparableDiscTargets(rows,options){
  return rows.filter(row=>!(options.scope==='solo'&&row.scopeExcluded)&&!row.contextBlocked&&row.applicable!==false&&
    !['in-combat','unspecified-combat-bonus'].includes(row.scope??row.panelContext)&&(row.comparable||options.useReference)&&
    (row.planning||row.bound==='maximum')&&Number.isFinite(row.targetRaw));
}

/** Compare each equipped disc with an empty slot, holding the other five
 * fixed. Recalculate the whole panel so set breakpoints and nonlinear Core
 * Skill conversions retain their actual in-build marginal contribution. */
export function evaluateDiscContributions(config,data,rows=[],options={}){
  const result={},valid=!validateConfiguration(config,data).length;
  const full=valid?calculatePanel(config,data):null;
  const targets=comparableDiscTargets(rows,options).filter(row=>row.comparable||
    ['initial-reference-unqualified','signature-conditioned'].includes(row.scope??row.panelContext));
  const partial=config.discs.some(d=>!d.absent&&!inspectDiscRolls(d,data).complete);
  for(const disc of config.discs){
    const item={status:disc.absent?'absent':valid?'ready':'unknown',partial,targets:[],effects:[],setLoss:null,main:null};
    result[disc.slot]=item;
    if(item.status!=='ready')continue;
    const removed=calculatePanel({...config,discs:config.discs.map(d=>d===disc?{...d,absent:true,locked:false}:d)},data);
    const group=Math.floor(Number(disc.mainId)/100);
    item.main={group,withDisc:full.values[group],withoutDisc:removed.values[group],delta:full.values[group]-removed.values[group]};
    const pieces=full.counts[disc.setId];
    if(pieces===2||pieces===4)item.setLoss={id:disc.setId,pieces};
    for(const row of targets){
      const withDisc=full.values[row.group],withoutDisc=removed.values[row.group];
      if(!Number.isFinite(withDisc)||!Number.isFinite(withoutDisc)||withDisc===withoutDisc)continue;
      const sign=row.bound==='maximum'?1:-1;
      const currentGap=Math.max(0,sign*(withDisc-row.targetRaw)),removedGap=Math.max(0,sign*(withoutDisc-row.targetRaw));
      item.targets.push({group:row.group,key:row.key,bound:row.bound,targetRaw:row.targetRaw,withDisc,withoutDisc,
        closed:Math.max(0,removedGap-currentGap),breakpoint:currentGap<1e-8&&removedGap>1e-8,
        excess:row.bound==='maximum'?Math.max(0,currentGap-removedGap):0});
    }
    // Both panels use the same character, Core level and Mindscapes, hence
    // applyPanelMechanics evaluates the same rules in the same order.
    full.effects.forEach((effect,i)=>{
      const previous=removed.effects[i];
      if(effect.scope!=='passive'||!previous||effect.bonus===previous.bonus)return;
      item.effects.push({group:effect.group,inputGroup:effect.inputGroup,withBonus:effect.bonus,withoutBonus:previous.bonus,
        withDisc:full.values[effect.group],withoutDisc:removed.values[effect.group],delta:effect.bonus-previous.bonus});
    });
    const tier=r=>r.excess>0?3:r.breakpoint?2:r.closed>0?1:0;
    item.targets.sort((a,b)=>tier(b)-tier(a)||Number(b.group===group)-Number(a.group===group)||
      (b.closed+b.excess)/Math.max(1,b.targetRaw)-(a.closed+a.excess)/Math.max(1,a.targetRaw));
  }
  return result;
}
const factorial=[1,1,2,6,24,120];
function choose(n,k){
  if(k<0||k>n)return 0;
  let value=1;
  for(let i=1;i<=k;i++)value=value*(n-i+1)/i;
  return value;
}

// For a given actual main, first choose four distinct legal lines. A disc
// starting with three lines gains its fourth before its four random upgrades;
// a four-line start has five upgrades. Marginalise irrelevant lines exactly.
function farmMainDistribution(config,data,disc,mainId,setId,rows,groups,baselineLoss){
  const trial={...config,discs:config.discs.map(d=>d.slot===disc.slot?
    {...d,mainId,setId,absent:false,level:15,initial:4,subs:[]}:d)};
  const props=calculatePanel(trial,data).props;
  const legal=Object.keys(data.subBases).map(Number).filter(id=>id!==mainId);
  const active=legal.filter(id=>groups.has(Math.floor(id/100)));
  const inactive=legal.length-active.length,selected=[],groupList=[...groups];
  const totals=[{chance:0,gain:0},{chance:0,gain:0}];
  const divisor=choose(legal.length,4);
  function evaluate(mass3,mass4){
    if(!mass3&&!mass4)return;
    const {values}=panelFromProperties(config,data,props,groupList);
    let loss=0;
    for(const row of rows){
      const gap=farmGap(row,values);
      if(row.met&&gap>1e-10)return;
      loss+=gap;
    }
    const gain=(baselineLoss-loss)/baselineLoss;
    if(!(gain>1e-10))return;
    totals[0].chance+=mass3;totals[0].gain+=mass3*gain;
    totals[1].chance+=mass4;totals[1].gain+=mass4*gain;
  }
  function upgrades(line,used,mass,otherLines){
    if(line===selected.length){
      const tail=draws=>used>draws?0:
        factorial[draws]/(4**draws)*otherLines**(draws-used)/factorial[draws-used];
      evaluate(mass*tail(4),mass*tail(5));
      return;
    }
    const id=selected[line],base=props[id]||0;
    for(let hits=0;hits<=5-used;hits++){
      props[id]=base+(1+hits)*data.subBases[id];
      upgrades(line+1,used+hits,mass/factorial[hits],otherLines);
    }
    props[id]=base;
  }
  function subsets(start){
    const otherLines=4-selected.length,combinations=choose(inactive,otherLines);
    if(combinations)upgrades(0,0,combinations/divisor,otherLines);
    if(otherLines)for(let i=start;i<active.length;i++){
      selected.push(active[i]);subsets(i+1);selected.pop();
    }
  }
  subsets(0);
  for(const result of totals){
    result.chance=Math.min(1,result.chance);
    result.gain=Math.min(1,result.gain);
  }
  return {mainId,initial3:totals[0],initial4:totals[1],chance:Math.min(totals[0].chance,totals[1].chance),gain:Math.min(totals[0].gain,totals[1].gain)};
}

/** Expected fraction of the current normalised panel deficit closed by a
 * single replacement. Compare like-for-like S discs of the selected set.
 * Bounds cover any mixture of three- and four-line starts under uniform
 * main, substat and upgrade draws. They are model results, not game rates.
 */
export function rankFarmSlots(config,data,rows,build,options={},allocation=null){
  const result={status:'no-targets',partial:false,deficits:[],protected:[],priority:null,tuning:null,slots:[]};
  const targets=comparableDiscTargets(rows,options);
  if(!targets.length||allocation?.guidanceOnly||config.level!==60||config.core!==6)return result;
  if(validateConfiguration(config,data).length){result.status='unknown';return result;}
  if(!config.discs.some(d=>!d.absent&&d.subs.length)){
    result.status='unknown';result.reason='empty-equipment';return result;
  }
  const panel=calculatePanel(config,data).values;
  if(targets.some(row=>!Number.isFinite(panel[row.group]))){result.status='unknown';return result;}
  result.partial=config.discs.some(d=>!d.absent&&!inspectDiscRolls(d,data).complete);
  const constraints=targets.map(row=>({...row,met:farmGap(row,panel)<=1e-10}));
  for(const row of constraints){
    result[row.met?'protected':'deficits'].push({key:row.key,group:row.group,label:row.label,current:panel[row.group],targetRaw:row.targetRaw,bound:row.bound});
  }
  const baselineLoss=constraints.reduce((n,row)=>n+farmGap(row,panel),0);
  if(baselineLoss<=1e-10){
    if(result.partial&&constraints.some(row=>row.bound==='maximum')){
      result.status='unknown';result.reason='partial-ceiling';
    }else result.status='met';
    return result;
  }
  if(config.discs.every(d=>d.locked)){result.status='locked';return result;}
  const groups=farmGroups(config,data,constraints);
  for(const disc of config.discs){
    if(disc.locked)continue;
    const slot=disc.slot,planned=allocation?.configuration?.discs?.find(d=>d.slot===slot);
    const legalMains=Object.keys(data.mainBases[slot]).map(Number);
    const mainIds=options.pinFarmMains&&planned?[Number(planned.mainId)]:
      [...new Set([...(build.mainStatIds?.[slot]||[]).map(Number),Number(planned?.mainId??disc.mainId)])];
    const setPlan=build.sets?.[options.planIndex??0];
    const setId=String(planned?.setId||disc.setId||(slot<=4?setPlan?.fourPieceId:setPlan?.twoPieceIds?.[0])||'');
    if(!setId||!owns(data.setProps,setId))continue;
    const mains=mainIds.filter(id=>legalMains.includes(id)).map(id=>farmMainDistribution(config,data,disc,id,setId,constraints,groups,baselineLoss));
    if(!mains.length)continue;
    // Other main stats do not fit this build. Their probability mass counts
    // as a miss when the main stat is random.
    const mean=(start,key)=>mains.reduce((n,m)=>n+m[start][key],0)/legalMains.length;
    const chances=[mean('initial3','chance'),mean('initial4','chance')];
    const gains=[mean('initial3','gain'),mean('initial4','gain')];
    const slotChance=Math.min(...chances),slotChanceMax=Math.max(...chances);
    const tuningKey=(m,key,reference)=>Math.min(m.initial3[key]-reference[0],m.initial4[key]-reference[1]);
    const main=mains.slice().sort((a,b)=>tuningKey(b,'gain',gains)-tuningKey(a,'gain',gains)||b.gain-a.gain||b.chance-a.chance)[0];
    result.slots.push({slot,setId,mainId:main.mainId,mains,
      gain:Math.min(...gains),gainMax:Math.max(...gains),randomChance:slotChance/6,randomChanceMax:slotChanceMax/6,slotChance,slotChanceMax,
      mainChance:main.chance,mainChanceMax:Math.max(main.initial3.chance,main.initial4.chance),
      mainLift:tuningKey(main,'chance',chances),tuningGain:tuningKey(main,'gain',gains)});
  }
  if(!result.slots.length){result.status='unknown';result.reason='missing-set';return result;}
  // Treat rounding noise as a tie and prefer a slot already changed by the
  // visible plan. Resolve remaining ties by slot so repeated runs are stable.
  const changed=new Set(allocation?.changedSlots||[]);
  const prefer=(a,b)=>Number(changed.has(b.slot))-Number(changed.has(a.slot))||a.slot-b.slot;
  const difference=(a,b)=>Math.abs(b-a)<1e-10?0:b-a;
  result.slots.sort((a,b)=>difference(a.gain,b.gain)||difference(a.gainMax,b.gainMax)||prefer(a,b));
  result.priority=result.slots.find(s=>s.gainMax>1e-10)||null;
  result.tuning=result.slots.filter(s=>s.slot>=4&&s.tuningGain>1e-10)
    .sort((a,b)=>difference(a.tuningGain,b.tuningGain)||prefer(a,b))[0]||null;
  result.status=result.priority?'ready':'no-gain';
  return result;
}
export function compareMainOptions(config,data,rows,build,options={}){
  const choices=[4,5,6].map(slot=>config.discs.find(d=>d.slot===slot).locked?[config.discs.find(d=>d.slot===slot).mainId]:(build.mainStatIds[slot]||[]).filter(id=>data.mainBases[slot]?.[id]));
  const combinations=[];for(const a of choices[0])for(const b of choices[1])for(const c of choices[2])combinations.push({4:Number(a),5:Number(b),6:Number(c)});
  combinations.sort((a,b)=>[4,5,6].filter(slot=>a[slot]!==Number(config.discs.find(d=>d.slot===slot).mainId)).length-[4,5,6].filter(slot=>b[slot]!==Number(config.discs.find(d=>d.slot===slot).mainId)).length);
  const results=[],seen=new Set(),budget={evaluations:0,maxEvaluations:searchLimit(options.maxEvaluations,10000)};
  let mainOptionsEvaluated=0,anyTruncated=false,baselineShortcut=false;
  for(let i=0;i<combinations.length&&budget.evaluations<budget.maxEvaluations;i++){
    const allowance=Math.max(1,Math.floor((budget.maxEvaluations-budget.evaluations)/(combinations.length-i)));
    const result=allocateTargets(config,data,rows,build,{...options,maxEvaluations:allowance,_budget:budget,_mainOverrides:combinations[i]});
    mainOptionsEvaluated++;anyTruncated||=!!result.search?.truncated;
    if(!result.blocked){const key=JSON.stringify(result.configuration.discs);if(!seen.has(key)){seen.add(key);results.push(result);}if(result.baselineMet&&result.mode==='improve'){baselineShortcut=true;break;}}
  }
  const totalEvaluations=budget.evaluations;
  for(const result of results)Object.assign(result.search,{totalEvaluations,totalMaxEvaluations:budget.maxEvaluations,mainOptionsEvaluated,mainOptionsTotal:combinations.length,truncated:!baselineShortcut&&(anyTruncated||mainOptionsEvaluated<combinations.length)});
  const rankLoss=result=>result.rows.reduce((n,r)=>n+r.shortfall/Math.max(1,r.targetRaw),0)+result.unresolvedRows.filter(r=>r.reasonCode==='above-ceiling').reduce((n,r)=>n+Math.max(0,result.panel.values[r.group]-r.targetRaw)/Math.max(1,r.targetRaw),0);
  return results.sort((a,b)=>Number(b.met)-Number(a.met)||(a.met&&b.met?a.changeCount-b.changeCount:0)||rankLoss(a)-rankLoss(b)||a.changeCount-b.changeCount||a.steps-b.steps).slice(0,3);
}

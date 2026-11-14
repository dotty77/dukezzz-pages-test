// Pure analysis of normalized, locally imported records. No requests or storage.
import {EXPECTATION_RULES} from './tuning-expectation.js?v=20260909-version-3-2-1';
import {findLastIndex} from './tuning-compat.js?v=20260909-tuning-win11-1';
import {compareSignalRecords,classifyBannerSignal,prepareSignalRecords} from './tuning-guarantee-core.js?v=20261001-planner-tuning-1';
const POOLS=Object.freeze({'2':90,'3':80,'102':90,'103':80});
export const UP_CHANNELS=Object.freeze({
  '2':Object.freeze({pool:'2',label:'普通独家频段',mode:'ordinary'}),
  '3':Object.freeze({pool:'3',label:'普通音擎频段',mode:'ordinary'}),
  '102':Object.freeze({pool:'102',label:'独家重映·复刻角色',mode:'rerun'}),
  '103':Object.freeze({pool:'103',label:'音擎回响·复刻音擎',mode:'rerun'})
});
export const UP_LUCK_BANDS=Object.freeze([
  {grade:'SS',title:'万里挑一 · 至尊欧皇',maxRatio:.25},
  {grade:'S',title:'欧气满满 · 幸运之星',maxRatio:.45},
  {grade:'A+',title:'好运常伴 · 小欧皇',maxRatio:.60},
  {grade:'A-',title:'平稳随缘 · 平常心玩家',maxRatio:.75},
  {grade:'B+',title:'欧气偏淡 · 随缘玩家',maxRatio:.90},
  {grade:'B-',title:'欧气不足 · 小非酋',maxRatio:1}
].map(Object.freeze));
export const UP_EXPECTATION_BANDS=Object.freeze([
  {grade:'SS',title:'万里挑一 · 至尊欧皇',maxRatio:.35},
  {grade:'S',title:'欧气满满 · 幸运之星',maxRatio:.65},
  {grade:'A+',title:'好运常伴 · 小欧皇',maxRatio:.90},
  {grade:'A-',title:'平稳随缘 · 平常心玩家',maxRatio:1.10},
  {grade:'B+',title:'欧气偏淡 · 随缘玩家',maxRatio:1.45},
  {grade:'B-',title:'欧气不足 · 小非酋',maxRatio:Infinity}
].map(Object.freeze));
const isOrdinary=pool=>pool==='2'||pool==='3';
const knownRank=rank=>['S','A','B'].includes(rank);
const compareId=compareSignalRecords;
function itemId(record,catalog){
  if(record.itemId)return String(record.itemId);
  const matches=Object.values(catalog).filter(item=>item.name===record.name||item.aliases?.includes(record.name));
  return matches.length===1?String(matches[0].id):'';
}

// Same conservative ordinary-banner rules as the guarantee report. An ID in
// the signature-weapon table establishes a pair, never historical UP status.
export function classifyUpRecord(record,account,catalog={},rules={windows:[]}){
  return classifyBannerSignal(record,account,catalog,rules).outcome;
}

function blankSummary(item,type,sharedWithAgentIds=[]){
  return {itemId:item,type,sharedWithAgentIds,sCount:0,confirmedUpCount:0,unverifiedCount:0,offCount:0,
    rerunCount:0,knownSCount:0,totalSPulls:0,averageSInterval:null,sRating:null,
    completeUpCount:0,totalUpPulls:0,averageUpPulls:null,rating:null,acquisitions:[]};
}
function gradePeriods(total,count,hardPity){
  if(!count)return null;
  const denominator=hardPity*count,scoreRatio=total/denominator;
  const band=UP_LUCK_BANDS.find(b=>total*100<=Math.round(b.maxRatio*100)*denominator);
  return band?{grade:band.grade,title:band.title,scoreRatio,provisional:count<3,sampleCount:count,
    averagePulls:total/count,hardPity,criterion:'s-hard-pity'}:null;
}
function gradeUpPeriods(total,count,type){
  if(!count)return null;
  const expectedPulls=EXPECTATION_RULES[type==='agent'?'character':'weapon'].expectedPerFeatured;
  const scoreRatio=total/count/expectedPulls;
  // Both public expected values and band thresholds are exact hundredths.
  // Comparing scaled integers makes inclusive boundaries stable.
  const band=UP_EXPECTATION_BANDS.find(b=>!Number.isFinite(b.maxRatio)||
    total*10000<=Math.round(b.maxRatio*100)*Math.round(expectedPulls*100)*count);
  return {grade:band.grade,title:band.title,scoreRatio,provisional:count<3,sampleCount:count,
    averagePulls:total/count,expectedPulls,criterion:'expected-up'};
}
function finishSummary(summary){
  summary.acquisitions.sort((a,b)=>String(b.record.time).localeCompare(String(a.record.time))||compareId(b.record,a.record));
  for(const acquisition of summary.acquisitions){
    summary.sCount++;
    if(acquisition.outcome==='up')summary.confirmedUpCount++;
    else if(acquisition.outcome==='off')summary.offCount++;
    else summary.unverifiedCount++;
    if(!isOrdinary(acquisition.pool))summary.rerunCount++;
    if(acquisition.sInterval!==null){summary.knownSCount++;summary.totalSPulls+=acquisition.sInterval;}
    if(acquisition.fullUpCost!==null){summary.completeUpCount++;summary.totalUpPulls+=acquisition.fullUpCost;}
  }
  const hardPity=summary.type==='agent'?90:80;
  if(summary.knownSCount){
    summary.averageSInterval=summary.totalSPulls/summary.knownSCount;
    summary.sRating=gradePeriods(summary.totalSPulls,summary.knownSCount,hardPity);
  }
  if(summary.completeUpCount){
    summary.averageUpPulls=summary.totalUpPulls/summary.completeUpCount;
    summary.rating=gradeUpPeriods(summary.totalUpPulls,summary.completeUpCount,summary.type);
  }
  return summary;
}

/**
 * Costs belong to the UP obtained at the end of a verified UP-to-UP cycle.
 * They include any intervening off-banner S and pulls made in other periods
 * of the same pool; they do not measure spending during one banner's dates.
 * `pairs` accepts either the downloaded {pairs:{...}} object or its inner map.
 */
export function analyzeUpPairs(account,{catalog={},pairs={},rules={windows:[]},classify=classifyUpRecord}={}){
  if(typeof classify!=='function')throw new TypeError('classify 必须是函数');
  const items=catalog.items||catalog,pairRows=Object.values(pairs.pairs||pairs).filter(p=>p&&p.agentId&&p.weaponId);
  const agentSummaries=new Map(),weaponSummaries=new Map(),groups=new Map(),pools=[];
  for(const pair of pairRows){
    const agentId=String(pair.agentId),weaponId=String(pair.weaponId);
    if(!agentSummaries.has(agentId))agentSummaries.set(agentId,blankSummary(agentId,'agent'));
    if(!weaponSummaries.has(weaponId))weaponSummaries.set(weaponId,blankSummary(weaponId,'weapon'));
    const owners=weaponSummaries.get(weaponId).sharedWithAgentIds;if(!owners.includes(agentId))owners.push(agentId);
  }
  const totals={matchedS:0,unmatchedS:0,confirmedUp:0,unverifiedS:0,offS:0,rerunS:0,completeUpCycles:0,completeUpPulls:0};
  for(const record of account.records||[]){
    const pool=String(record.pool);if(!Object.prototype.hasOwnProperty.call(POOLS,pool))continue;
    if(!groups.has(pool))groups.set(pool,[]);groups.get(pool).push(record);
  }
  for(const [pool,unsorted] of groups){
    const {records:rows,contradictions}=prepareSignalRecords(unsorted),hardPity=POOLS[pool],ordinary=isOrdinary(pool);
    const orderConsistent=!rows.some((record,index)=>index>0&&record.time<rows[index-1].time);
    if(!orderConsistent)contradictions.push('记录 ID 与时间顺序矛盾');
    let lastS=null,lastUp=null,priorOutcome='unknown',knownRun=0,cycleOffSignals=[];
    const acquisitions=[];
    rows.forEach((record,index)=>{
      if(!knownRank(record.rank)){lastS=null;lastUp=null;priorOutcome='unknown';knownRun=0;cycleOffSignals=[];return;}
      knownRun++;
      if(record.rank!=='S'){
        if(knownRun>=hardPity&&!contradictions.includes('连续未出 S 的记录达到硬保底'))contradictions.push('连续未出 S 的记录达到硬保底');
        return;
      }
      const interval=lastS===null?null:index-lastS;
      if((interval!==null&&interval>hardPity)||knownRun>hardPity){
        if(!contradictions.includes('S 级间隔超过硬保底'))contradictions.push('S 级间隔超过硬保底');
      }
      const resolved=ordinary?classify(record,account,items,rules):'unknown';
      const outcome=['up','off'].includes(resolved)?resolved:'unknown';
      if(ordinary&&outcome==='off'&&priorOutcome==='off'&&!contradictions.includes('连续两次非 UP 与大保底规则矛盾'))contradictions.push('连续两次非 UP 与大保底规则矛盾');
      let fullUpCost=null,upCostParts=null,exclusion=null;
      if(!ordinary)exclusion='复刻特殊保底，不参与普通 UP 花费';
      else if(outcome==='unknown')exclusion='该次 S 的当期 UP 身份未核实';
      else if(outcome==='off')exclusion='非 UP；抽数计入其后可确认的完整 UP 周期';
      else if(lastUp===null)exclusion='没有可确认的前一个 UP 起点';
      else {
        fullUpCost=index-lastUp;
        const offSignals=cycleOffSignals.map(signal=>({...signal})),offPulls=fullUpCost-interval;
        // The off-banner ledger follows the verified cycle, including objects
        // absent from the character/signature pairing table. Never manufacture
        // a split across an unknown result or a missing interval.
        if(Number.isInteger(interval)&&interval>0&&offSignals.every(signal=>Number.isInteger(signal.pulls)&&signal.pulls>0)&&
          offPulls===offSignals.reduce((sum,signal)=>sum+signal.pulls,0)){
          upCostParts={finalSPulls:interval,offPulls,offSignals,total:fullUpCost};
        }else if(!contradictions.includes('UP 周期分段抽数不一致'))contradictions.push('UP 周期分段抽数不一致');
      }
      acquisitions.push({record,pool,outcome,fullUpCost,upCostParts,sInterval:interval,observedSPulls:knownRun,exclusion});
      if(outcome==='unknown'){lastUp=null;cycleOffSignals=[];}
      else if(outcome==='up'){lastUp=index;cycleOffSignals=[];}
      else if(lastUp!==null)cycleOffSignals.push({record,pulls:interval});
      priorOutcome=outcome;lastS=index;knownRun=0;
    });
    const poolSummary={id:pool,hardPity,orderConsistent,contradictions,recordCount:rows.length,sCount:acquisitions.length,
      completeUpCycles:0,completeUpPulls:0};
    for(const acquisition of acquisitions){
      if(contradictions.length){
        acquisition.fullUpCost=null;acquisition.exclusion='该频段记录存在矛盾，已排除花费和评级';
        acquisition.upCostParts=null;
        acquisition.sInterval=null;
        acquisition.observedSPulls=null;
      }
      if(acquisition.outcome==='up')totals.confirmedUp++;
      else if(acquisition.outcome==='off')totals.offS++;
      else totals.unverifiedS++;
      if(!ordinary)totals.rerunS++;
      if(acquisition.fullUpCost!==null){
        poolSummary.completeUpCycles++;poolSummary.completeUpPulls+=acquisition.fullUpCost;
        totals.completeUpCycles++;totals.completeUpPulls+=acquisition.fullUpCost;
      }
      const id=itemId(acquisition.record,items),summaries=['2','102'].includes(pool)?agentSummaries:weaponSummaries;
      const summary=summaries.get(id);
      if(summary){summary.acquisitions.push(acquisition);totals.matchedS++;}else totals.unmatchedS++;
    }
    if(ordinary){
      const firstSIndex=rows.findIndex(record=>record.rank==='S'),lastSIndex=findLastIndex(rows,record=>record.rank==='S');
      const validTail=lastSIndex>=0&&!contradictions.length&&rows.slice(lastSIndex+1).every(record=>knownRank(record.rank));
      poolSummary.reconciliation={
        total:rows.length,countedUpPulls:poolSummary.completeUpPulls,unassignedPulls:rows.length-poolSummary.completeUpPulls,
        currentPity:validTail?rows.length-lastSIndex-1:null,alreadyRecordedBeforeFirstS:firstSIndex<0?null:firstSIndex+1,
        labels:{total:'当前频段已导入抽数',countedUpPulls:'已核算的完整 UP 周期抽数（含歪）',
          unassignedPulls:'未分配抽数：包括首段、身份未核实或未完成的周期',
          currentPity:'距末次 S 的已记录垫抽（未分配抽数的子项）',
          alreadyRecordedBeforeFirstS:'首个可见 S 及此前的已记录抽数（未分配抽数的子项）'},
        note:'已导入抽数＝已核算完整 UP 周期抽数＋未分配抽数。子项不重复相加；零个完整周期表示暂无法核算，不表示实际花费为零。'
      };
    }
    pools.push(poolSummary);
  }
  for(const summary of [...agentSummaries.values(),...weaponSummaries.values()]){
    finishSummary(summary);
    // Preserve aggregate fields for existing callers, but give display callers
    // independently finished statistics from each record's actual pool. A
    // character's name or signature mapping cannot identify a rerun channel.
    summary.channels=[];
    for(const channel of Object.values(UP_CHANNELS)){
      const acquisitions=summary.acquisitions.filter(acquisition=>acquisition.pool===channel.pool);
      if(!acquisitions.length)continue;
      const split={...blankSummary(summary.itemId,summary.type,[...summary.sharedWithAgentIds]),...channel,acquisitions};
      summary.channels.push(finishSummary(split));
    }
  }
  const entries=pairRows.map(pair=>({...pair,agentId:String(pair.agentId),weaponId:String(pair.weaponId),
    agent:agentSummaries.get(String(pair.agentId)),weapon:weaponSummaries.get(String(pair.weaponId))}))
    .filter(entry=>entry.agent.sCount||entry.weapon.sCount)
    .sort((a,b)=>{
      const latest=entry=>{const times=[entry.agent.acquisitions[0]?.record.time,entry.weapon.acquisitions[0]?.record.time].filter(Boolean).sort();return times[times.length-1]||'';};
      return latest(b).localeCompare(latest(a))||a.agentId.localeCompare(b.agentId);
    });
  return {entries,totals,pools,bands:UP_LUCK_BANDS.map(b=>({...b})),upBands:UP_EXPECTATION_BANDS.map(b=>({...b})),notes:[
    '角色与专属音擎按资料中的明确对应关系成对展示；专武关系不代表某次获得必定是 UP。',
    '普通与复刻按每条记录的实际频段分块，分别计算出金均值和评级；不按角色名称固定归类，同一角色或专武可以同时出现在普通与复刻记录中。',
    '完整 UP 花费从同频段前一次已核实 UP 的下一抽起，到本次 UP 为止，包含中途歪和跨期垫抽；不是该角色卡池开放期间的投入。',
    '首个可见 UP、跨越未知品质或未核实 S 的区间不计入完整花费。常驻所得不在本表，复刻定向只展示获得记录，不推断定向目标花费与 UP 评价。',
    '出金抽数和出金评级单独使用完整 S 到 S 区间（终点为该物品）与 90 / 80 抽硬保底比较；它不计入此前歪出的 S，不能等同取得 UP 的总花费。复刻也只可评价出金间隔，不评价定向目标花费。',
    `UP 评价使用该物品完整 UP 周期的平均抽数 ÷ 从零垫抽、小保底开始的理论均值（角色 ${EXPECTATION_RULES.character.expectedPerFeatured}、音擎 ${EXPECTATION_RULES.weapon.expectedPerFeatured} 抽）；少于 3 个周期为暂定。理论均值附近为 A-，阈值为本站自定义娱乐规则。`,
    '评级阈值为本站自定义娱乐规则，不是概率分位、全服排名或未来出货预测；例如“万里挑一”不代表真实万分之一概率。',
    '仅分析已导入记录，无法确认中间是否缺页；缺页可能让已知间隔偏小。存在顺序或硬保底矛盾的频段不参与花费和评级。',
    '汇总按唯一调频记录计算；同一音擎即使关联多个代理人也只计一次。'
  ]};
}

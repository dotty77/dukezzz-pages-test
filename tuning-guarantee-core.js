// Pure, local analysis. Banner identity and rule-based inference stay separate.
const HARD_PITY=Object.freeze({'2':90,'3':80,'102':90,'103':80});
const ordinary=pool=>pool==='2'||pool==='3';
const special=pool=>pool==='102'||pool==='103';
const knownRank=rank=>rank==='S'||rank==='A'||rank==='B';
const numericId=id=>/^\d+$/.test(id);
const compareText=(a,b)=>a===b?0:a<b?-1:1;
const idText=record=>String(record?.id??'');
export function compareSignalRecords(a,b){
  const x=idText(a),y=idText(b);
  if(numericId(x)&&numericId(y)){
    const nx=x.replace(/^0+(?=\d)/,''),ny=y.replace(/^0+(?=\d)/,'');
    const difference=nx.length-ny.length||compareText(nx,ny);
    if(difference)return difference;
  }
  return compareText(x,y)||compareText(String(a?.time??''),String(b?.time??''));
}
function validTime(value){
  if(typeof value!=='string'||!/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(value))return false;
  const date=new Date(value.replace(' ','T')+'Z');
  return Number.isFinite(date.valueOf())&&date.toISOString().slice(0,19).replace('T',' ')===value;
}
function resolveItemId(record,catalog){
  if(record.itemId!=null&&String(record.itemId)!=='')return {id:String(record.itemId)};
  if(typeof record.name!=='string'||!record.name)return {id:'',reasonCode:'missing-item'};
  const items=catalog?.items||catalog||{};
  const ids=new Set(Object.values(items).filter(item=>item&&
    (item.name===record.name||item.aliases?.includes(record.name))).map(item=>String(item.id??'')).filter(Boolean));
  return ids.size===1?{id:[...ids][0]}:{id:'',reasonCode:ids.size?'ambiguous-item-name':'unknown-item-name'};
}
function matchingWindows(record,account,rules,includeSpecial){
  const pool=String(record.pool);
  if(!Number.isInteger(account?.timezone)||!validTime(record.time))return [];
  const rows=special(pool)&&includeSpecial?rules?.specialWindows:rules?.windows;
  return (Array.isArray(rows)?rows:[]).filter(window=>String(window.pool)===pool&&
    window.timezone===account.timezone&&validTime(window.begin)&&validTime(window.end)&&
    record.time>=window.begin&&record.time<=window.end);
}
function periodKey(window){return String(window?.periodId||`${window?.pool}|${window?.timezone}|${window?.begin}|${window?.end}`);}
function commonWindow(windows){
  if(!windows.length)return undefined;
  return windows.every(window=>periodKey(window)===periodKey(windows[0]))?windows[0]:undefined;
}
// A lost 50/50 only yields a 定制调频 candidate. Without a verified period, the launch-standard items are
// always 歪 and items that were never candidates are always UP; items that joined later stay unknown.
function classifyByStandardPool(record,catalog,rules){
  const pool=rules?.standardPool?.pools?.[String(record.pool)];
  if(!pool)return null;
  const {id}=resolveItemId(record,catalog);
  if(!id)return null;
  const has=list=>Array.isArray(list)&&list.some(value=>String(value)===id);
  if(has(pool.alwaysOff))return {outcome:'off',basis:'standard-pool',itemId:id};
  if(Array.isArray(pool.candidates)&&!has(pool.candidates))return {outcome:'up',basis:'standard-pool',itemId:id};
  return null;
}
export function classifyBannerSignal(record,account,catalog={},rules={}, {includeSpecial=false}={}){
  const unknown=(reasonCode,extra={})=>({outcome:'unknown',basis:'unknown',reasonCode,...extra});
  if(!record||record.rank!=='S')return unknown('not-s');
  const pool=String(record.pool);
  if(!ordinary(pool)&&!(special(pool)&&includeSpecial))return unknown(special(pool)?'special-not-enabled':'unsupported-pool');
  const fallback=reasonCode=>(ordinary(pool)&&classifyByStandardPool(record,catalog,rules))||unknown(reasonCode);
  if(!Number.isInteger(account?.timezone))return fallback('missing-timezone');
  if(!validTime(record.time))return fallback('invalid-time');
  const windows=matchingWindows(record,account,rules,includeSpecial),window=commonWindow(windows);
  if(!windows.length)return fallback('outside-verified-windows');
  const resolved=resolveItemId(record,catalog);
  if(!resolved.id)return unknown(resolved.reasonCode,{window});
  const id=resolved.id,contains=(list)=>Array.isArray(list)&&list.some(value=>String(value)===id);
  if(windows.some(candidate=>candidate.ambiguity===true||contains(candidate.ambiguousItems)))return unknown('ambiguous-window',{window,itemId:id});
  const featured=windows.some(candidate=>contains(candidate.featured)),off=windows.some(candidate=>contains(candidate.off));
  if(featured&&off)return unknown('up-off-overlap',{window,itemId:id});
  if(featured)return {outcome:'up',basis:'verified-banner',window,itemId:id};
  if(windows.every(candidate=>contains(candidate.off)))return {outcome:'off',basis:'verified-banner',window,itemId:id};
  return unknown('item-not-covered',{window,itemId:id});
}
const allSpecialStates=()=>['available:small','available:big','spent:small','spent:big'];
function projectSpecial(states,part){
  const values=new Set(states.map(state=>state.split(':')[part]));
  return values.size===1?[...values][0]:'unknown';
}
function specialMechanism(window){
  return window&&window.ambiguity!==true&&window.welfareSeparate===true&&window.welfareFirstS===true&&
    window.welfareResetsEachPeriod===true&&window.welfareDoesNotConsumeRegularGuarantee===true&&
    window.regularPityCarriesAcrossPeriods===true&&window.sharesAcrossChoicePages===true;
}
function advanceSpecial(states,outcome){
  const next=new Set(),possibleOutcomes=new Set();
  for(const state of states){
    const [welfare,regular]=state.split(':');
    if(welfare==='available'){
      if(outcome!=='off'){next.add(`spent:${regular}`);possibleOutcomes.add('up');}
    }else{
      if(outcome!=='off'){next.add('spent:small');possibleOutcomes.add('up');}
      if(outcome!=='up'&&regular==='small'){next.add('spent:big');possibleOutcomes.add('off');}
    }
  }
  return {states:[...next],inferredOutcome:outcome==='unknown'&&possibleOutcomes.size===1?[...possibleOutcomes][0]:undefined};
}
// Optional metadata may complement another export of the same event. The
// copied records are safe to enrich without changing either source archive.
export function prepareSignalRecords(input=[]){
  const seen=new Map(),contradictions=[];
  const add=message=>{if(!contradictions.includes(message))contradictions.push(message);};
  for(const record of input){
    if(!record)continue;
    const rawId=idText(record),canonicalId=numericId(rawId)?rawId.replace(/^0+(?=\d)/,''):rawId;
    if(!canonicalId)add('记录缺少可用于排序的 ID');
    const key=String(record.pool)+':'+canonicalId;
    const previous=seen.get(key);
    if(!previous){seen.set(key,{...record});continue;}
    const present=value=>value!==undefined&&value!==null&&value!=='';
    if(['time','itemId','rank','gachaId'].some(field=>present(previous[field])&&present(record[field])&&String(previous[field])!==String(record[field]))||
      (!previous.itemId&&!record.itemId&&previous.name&&record.name&&previous.name!==record.name))add('相同记录 ID 的内容冲突');
    for(const field of ['time','itemId','rank','name','itemType','gachaId'])if(!present(previous[field])&&present(record[field]))previous[field]=record[field];
  }
  return {records:[...seen.values()].sort(compareSignalRecords),contradictions};
}
export function analyzeGuaranteeHistory(account,poolId,catalog={},rules={}){
  const pool=String(poolId),hardPity=HARD_PITY[pool]||null,signals=[];
  const {records,contradictions}=prepareSignalRecords((account?.records||[]).filter(record=>record&&String(record.pool)===pool));
  const add=message=>{if(!contradictions.includes(message))contradictions.push(message);};
  const timesValid=records.every(record=>validTime(record.time));
  const orderConsistent=timesValid&&!records.some((record,index)=>index>0&&record.time<records[index-1].time);
  if(!timesValid)add('记录时间缺失或无效');
  if(timesValid&&!orderConsistent)add('记录 ID 与时间顺序矛盾');
  let state='unknown',lastS=null,lastSignal=null,unknownAfterLastS=false,currentPity=null,knownRun=0;
  let specialStates=allSpecialStates(),activeWindow=null;
  for(const record of records){
    let window;
    if(special(pool)){
      window=commonWindow(matchingWindows(record,account,rules,true));
      if(!specialMechanism(window)){
        specialStates=allSpecialStates();activeWindow=null;state='unknown';
      }else{
        if(activeWindow&&periodKey(activeWindow)!==periodKey(window)){
          if(window.begin>activeWindow.begin)specialStates=[...new Set(specialStates.map(value=>`available:${value.split(':')[1]}`))];
          else {add('复刻频段期次顺序矛盾');specialStates=allSpecialStates();}
        }
        activeWindow=window;state=projectSpecial(specialStates,1);
      }
    }
    if(!knownRank(record.rank)){
      state='unknown';knownRun=0;currentPity=null;
      if(lastS)unknownAfterLastS=true;
      if(special(pool))specialStates=allSpecialStates();
      continue;
    }
    knownRun++;
    if(record.rank!=='S'){
      if(currentPity!==null)currentPity++;
      if(hardPity&&knownRun>=hardPity)add('连续未出 S 的记录达到硬保底');
      continue;
    }
    if(hardPity&&knownRun>hardPity)add('S 级间隔超过硬保底');
    const classification=classifyBannerSignal(record,account,catalog,rules,{includeSpecial:true});
    const signal={record,outcome:classification.outcome,basis:classification.basis,
      reasonCode:classification.reasonCode,window:classification.window,beforeState:state,afterState:'unknown'};
    if(ordinary(pool)){
      if(signal.outcome==='up')state='small';
      else if(signal.outcome==='off'){
        if(state==='big')add('连续两次非 UP 与大保底规则矛盾');
        state='big';
      }else if(state==='big'){
        state='small';signal.inferredOutcome='up';signal.basis='inferred-by-guarantee';
      }else state='unknown';
    }else if(special(pool)&&specialMechanism(window)){
      signal.beforeWelfare=projectSpecial(specialStates,0);
      const next=advanceSpecial(specialStates,signal.outcome);
      if(!next.states.length){
        add('非 UP 与复刻福利保证或常规大保底规则矛盾');specialStates=allSpecialStates();
      }else specialStates=next.states;
      if(next.inferredOutcome){signal.inferredOutcome=next.inferredOutcome;signal.basis='inferred-by-guarantee';}
      state=projectSpecial(specialStates,1);signal.afterWelfare=projectSpecial(specialStates,0);
    }else state='unknown';
    signal.afterState=state;signals.push(signal);lastS=record;lastSignal=signal;unknownAfterLastS=false;currentPity=0;knownRun=0;
  }
  const invalid=contradictions.length>0;
  const result={state:invalid?'unknown':state,lastS,lastSignal,signals,contradictions,orderConsistent,unknownAfterLastS,hardPity,
    currentPity:invalid?null:currentPity,canAnnotate:ordinary(pool)&&!invalid&&!unknownAfterLastS&&!!lastSignal&&lastSignal.outcome==='unknown'&&state==='unknown',
    records,recordCount:records.length};
  if(special(pool))result.special={welfare:invalid?'unknown':projectSpecial(specialStates,0),periodId:activeWindow?.periodId||null,
    regular:result.state,verifiedMechanism:!!activeWindow,possibleStates:invalid?allSpecialStates():[...specialStates]};
  return result;
}

// Hard-pity resource planning only. No probability model, requests, or record mutation.
import {EXPECTATION_RULES} from "./tuning-expectation.js?v=20260909-version-3-2-1";

export const BUDGET_STORAGE_KEY = 'duke-personal-budget-v1';
export const BUDGET_COST = 160;
export const BUDGET_POOLS = Object.freeze({character:'2',weapon:'3'});
const MAX_WALLET = 1000000000;
const integer = (value,min,max,field) => {
  // Empty input and null are never silently coerced to zero.
  if ((typeof value!=='string'&&typeof value!=='number') || String(value).trim()==='' || !/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value)<min || Number(value)>max) {
    const error = new RangeError(field); error.field=field; error.min=min; error.max=max; throw error;
  }
  return Number(value);
};
export function newBudget() {
  return {version:1,polychrome:'0',tapes:'0',mindscape:'0',refinement:'0',ownedCharacter:'0',ownedWeapon:'0',pools:{character:{pity:'',guarantee:'unknown'},weapon:{pity:'',guarantee:'unknown'}},recordSnapshot:null};
}
export function budgetScope(account,demo=false) {
  // Demo is memory-only; a real account with an identical UID remains separate.
  return demo?'demo':account?.uid!=null?'account:'+String(account.uid):'manual';
}
export function validateBudget(input) {
  if (!input || typeof input!=='object') throw new TypeError('budget');
  const result={};
  for(const field of ['polychrome','tapes'])result[field]=integer(input[field],0,MAX_WALLET,field);
  result.mindscape=integer(input.mindscape,0,6,'mindscape');
  result.refinement=integer(input.refinement,0,5,'refinement');
  result.ownedCharacter=integer(input.ownedCharacter,0,7,'ownedCharacter');
  result.ownedWeapon=integer(input.ownedWeapon,0,5,'ownedWeapon');
  result.pools={};
  for(const kind of Object.keys(BUDGET_POOLS)) {
    const raw=input.pools?.[kind];
    if(!raw||!['small','big','unknown'].includes(raw.guarantee))throw new RangeError(kind+'.guarantee');
    // The empty value is deliberately unknown; 0 is a distinct, explicit value.
    const pity=raw.pity===''||raw.pity==null?null:integer(raw.pity,0,EXPECTATION_RULES[kind].hardPity-1,kind+'.pity');
    result.pools[kind]={pity,guarantee:raw.guarantee};
  }
  return result;
}
export function poolBudget(kind,copies,pity,guarantee) {
  if(!Object.hasOwn(BUDGET_POOLS,kind))throw new RangeError('pool');
  const hard=EXPECTATION_RULES[kind].hardPity;
  copies=integer(copies,0,kind==='character'?7:5,'copies');
  if(pity!==null)pity=integer(pity,0,hard-1,'pity');
  if(!['small','big','unknown'].includes(guarantee))throw new RangeError('guarantee');
  if(copies===0)return {copies,hardPity:hard,pity,guarantee,minimum:0,maximum:0,uncertain:false,scenarios:[]};
  const guarantees=guarantee==='unknown'?['big','small']:[guarantee];
  const scenarios=guarantees.map(state=>{
    const base=(state==='big'?hard:2*hard)+(copies-1)*2*hard;
    return {guarantee:state,minimum:base-(pity??hard-1),maximum:base-(pity??0)};
  });
  return {copies,hardPity:hard,pity,guarantee,minimum:Math.min(...scenarios.map(s=>s.minimum)),maximum:Math.max(...scenarios.map(s=>s.maximum)),uncertain:pity===null||guarantee==='unknown',scenarios};
}
export function calculateBudget(input) {
  const value=validateBudget(input);
  const remaining={character:Math.max(0,value.mindscape+1-value.ownedCharacter),weapon:Math.max(0,value.refinement-value.ownedWeapon)};
  const pools=Object.fromEntries(Object.entries(remaining).map(([kind,copies])=>[kind,poolBudget(kind,copies,value.pools[kind].pity,value.pools[kind].guarantee)]));
  const minimum=pools.character.minimum+pools.weapon.minimum,maximum=pools.character.maximum+pools.weapon.maximum;
  const available=value.tapes+Math.floor(value.polychrome/BUDGET_COST);
  // Use the single shared wallet exactly once. Preserve unconverted Polychrome.
  const gap=pulls=>({pulls:Math.max(0,pulls-available),polychrome:Math.max(0,Math.max(0,pulls-value.tapes)*BUDGET_COST-value.polychrome)});
  return {value,remaining,pools,minimum,maximum,available,polychromeRemainder:value.polychrome%BUDGET_COST,uncertain:pools.character.uncertain||pools.weapon.uncertain,gapMinimum:gap(minimum),gapMaximum:gap(maximum),covered:available>=maximum,completed:remaining.character+remaining.weapon===0};
}

/** Read only independently validated ordinary pools. Missing/contradictory data remain unknown. */
export function snapshotPool(pool,guarantee) {
  if(!pool||!['2','3'].includes(String(pool.id))||!pool.count)return {pity:'',guarantee:'unknown',reason:'missing'};
  const hard=String(pool.id)==='2'?90:80;
  const coherent=pool.recordOrderConsistent!==false&&pool.hardPityConsistent!==false;
  const pity=coherent&&pool.currentPityKnown&&Number.isInteger(pool.currentPity)&&pool.currentPity>=0&&pool.currentPity<hard?String(pool.currentPity):'';
  const state=coherent&&['small','big'].includes(guarantee?.state)?guarantee.state:'unknown';
  return {pity,guarantee:state,reason:!coherent?'conflict':pity===''||state==='unknown'?'incomplete':'records',lastTime:pool.lastTime||null};
}

/** Local fingerprint only; never stored with names, auth links, or full records. */
export function recordFingerprint(account) {
  if(!account)return '';
  let h=2166136261;
  const feed=value=>{const text=String(value??'');for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619)>>>0;h=Math.imul(h^31,16777619)>>>0;};
  feed(account.uid);feed(account.timezone);
  for(const record of account.records||[]){for(const key of ['pool','id','time','rank','itemId','name','itemType'])feed(record[key]);}
  return (account.records?.length||0)+':'+h.toString(16);
}

/** Validate untrusted localStorage. A corrupt draft cannot create a false budget. */
export function restoreBudget(raw) {
  if(!raw||raw.version!==1)throw new TypeError('version');
  validateBudget(raw);
  const clean=newBudget();
  for(const field of ['polychrome','tapes','mindscape','refinement','ownedCharacter','ownedWeapon'])clean[field]=String(raw[field]);
  for(const kind of Object.keys(BUDGET_POOLS)){clean.pools[kind]={pity:raw.pools[kind].pity==null?'':String(raw.pools[kind].pity),guarantee:raw.pools[kind].guarantee};}
  if(raw.recordSnapshot&&typeof raw.recordSnapshot.fingerprint==='string'&&typeof raw.recordSnapshot.at==='string'&&raw.recordSnapshot.pools&&typeof raw.recordSnapshot.pools==='object') {
    clean.recordSnapshot={fingerprint:raw.recordSnapshot.fingerprint.slice(0,100),at:raw.recordSnapshot.at.slice(0,40),confirmed:raw.recordSnapshot.confirmed===true,pools:{}};
    for(const kind of Object.keys(BUDGET_POOLS))if(['records','incomplete','missing','conflict'].includes(raw.recordSnapshot.pools[kind]?.reason))clean.recordSnapshot.pools[kind]={reason:raw.recordSnapshot.pools[kind].reason,lastTime:typeof raw.recordSnapshot.pools[kind].lastTime==='string'?raw.recordSnapshot.pools[kind].lastTime.slice(0,40):null,pityFromRecords:raw.recordSnapshot.pools[kind].pityFromRecords!==false,guaranteeFromRecords:raw.recordSnapshot.pools[kind].guaranteeFromRecords!==false};
  }
  return clean;
}

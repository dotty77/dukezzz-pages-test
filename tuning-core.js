// Local-only ZZZ signal records. Text remains plain data; callers must use textContent.
import {isRngBackup,convertRngBackup} from './tuning-rng.js?v=20260911-community-update-1';
export const IMPORT_LIMITS = Object.freeze({bytes:20 * 1024 * 1024, records:100000});
export const POOL_META = Object.freeze({
  '1':Object.freeze({id:'1',label:'常驻频段',hardPity:90}),
  '2':Object.freeze({id:'2',label:'独家频段',hardPity:90}),
  '3':Object.freeze({id:'3',label:'音擎频段',hardPity:80}),
  '5':Object.freeze({id:'5',label:'邦布频段',hardPity:80}),
  '102':Object.freeze({id:'102',label:'复刻角色',hardPity:90}),
  '103':Object.freeze({id:'103',label:'复刻音擎',hardPity:80})
});

const RAW_RANK = Object.freeze({'4':'S','3':'A','2':'B'});
const EXPORT_RANK = Object.freeze({S:'4',A:'3',B:'2'});
const UIGF_LANGS = new Set(['de-de','en-us','es-es','fr-fr','id-id','it-it','ja-jp','ko-kr','pt-pt','ru-ru','th-th','tr-tr','vi-vn','zh-cn','zh-tw']);
const POOL_ALIAS = Object.freeze({'1001':'1','2001':'2','2011':'2','3001':'3','3011':'3','5001':'5'});
const MAX_TEXT = 1000;
const own = (o,k) => o != null && Object.prototype.hasOwnProperty.call(o,k);
const object = o => o !== null && typeof o === 'object' && !Array.isArray(o);
const field = (o,...keys) => {for (const k of keys) if (own(o,k) && o[k] !== '' && o[k] != null) return o[k];return undefined;};
const blankRank = () => ({S:0,A:0,B:0,unknown:0});
const fail = message => {throw new Error(message);};

function text(value,label,{required=false,max=MAX_TEXT,numeric=false}={}) {
  if (value == null || value === '') {if(required)fail(`缺少${label}`);return '';}
  if (typeof value !== 'string' && !(numeric && typeof value === 'number' && Number.isSafeInteger(value))) fail(`${label}必须是字符串${numeric?'或安全整数':''}`);
  const s=String(value).trim();
  if (required&&!s)fail(`缺少${label}`);
  if(s.length>max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s))fail(`${label}包含无效字符或过长`);
  return s;
}
function uid(value) {return text(value,'账号 UID',{required:true,max:128,numeric:true});}
function zone(value) {
  if(value==null||value==='')return null;
  const n=typeof value==='string'&&/^-?\d+$/.test(value)?Number(value):value;
  if(!Number.isInteger(n)||n < -12||n > 14)fail('timezone 必须是 -12 到 14 之间的整数');
  return n;
}
function pool(value) {
  const p=text(value,'调频类型 gacha_type',{required:true,max:80,numeric:true});
  return own(POOL_ALIAS,p)?POOL_ALIAS[p]:p;
}
function timestamp(value) {
  const s=text(value,'调频时间 time',{required:true,max:40});
  const m=/^(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d):(\d\d)$/.exec(s);
  if(!m)fail(`时间格式应为 YYYY-MM-DD HH:mm:ss：${s}`);
  const [,year,month,day,hour,minute,second]=m.map(Number);
  const date=new Date(Date.UTC(year,month-1,day,hour,minute,second));
  if(year<2000||year>2200||date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day||date.getUTCHours()!==hour||date.getUTCMinutes()!==minute||date.getUTCSeconds()!==second)fail(`无效调频时间：${s}`);
  return s.replace('T',' ');
}
function shiftTime(time,from,to) {
  const ms=Date.parse(time.replace(' ','T')+'Z')+(to-from)*3600000;
  return new Date(ms).toISOString().slice(0,19).replace('T',' ');
}
function rank(value,warnings) {
  if(value==null||value==='')return null;
  const r=text(value,'rank_type',{max:10,numeric:true}).toUpperCase();
  if(own(RAW_RANK,r))return RAW_RANK[r];
  if(own(EXPORT_RANK,r))return r;
  warnings.add(`未识别的 rank_type「${r}」按未知品质处理。绝区零使用 4=S、3=A、2=B。`);
  return null;
}
function idCompare(a,b) {
  if(a===b)return 0;
  if(/^\d+$/.test(a)&&/^\d+$/.test(b)) {
    const x=a.replace(/^0+(?=\d)/,''),y=b.replace(/^0+(?=\d)/,'');
    if(x.length!==y.length)return x.length-y.length;
    if(x!==y)return x<y?-1:1;
  }
  return a<b?-1:1;
}
function recordCompare(a,b) {
  // IDs determine acquisition order within a pool, including multiple draws per second.
  if(a.pool===b.pool)return idCompare(a.id,b.id)||a.time.localeCompare(b.time);
  return a.time.localeCompare(b.time)||a.pool.localeCompare(b.pool)||idCompare(a.id,b.id);
}
function sortRecords(records) {
  // Sort each pool independently; a mixed comparator based on time and ID is not transitive.
  const groups=new Map();
  for(const r of records){if(!groups.has(r.pool))groups.set(r.pool,[]);groups.get(r.pool).push(r);}
  return [...groups.keys()].sort(idCompare).flatMap(k=>groups.get(k).sort(recordCompare));
}
function readRecord(raw,account,warnings,index) {
  if(!object(raw))fail(`第 ${index+1} 条记录不是对象`);
  const recUid=field(raw,'uid');
  if(recUid!==undefined&&uid(recUid)!==account.uid)fail(`第 ${index+1} 条记录 UID 与所属账号不一致，已取消整个导入`);
  // Never coerce numeric IDs: JSON has already lost precision for long numbers.
  const id=text(field(raw,'id'),'记录 ID（必须用引号包裹）',{required:true,max:128});
  const count=field(raw,'count');
  if(count!==undefined && String(count)!=='1')fail(`记录 ${id} 的 count 必须是 1；合并数量无法可靠计算抽数`);
  return {
    id,uid:account.uid,pool:pool(field(raw,'gacha_type','pool')),
    itemId:text(field(raw,'item_id','itemId'),'物品 ID',{max:128,numeric:true}),
    name:text(field(raw,'name'),'物品名称',{max:300}),
    rank:rank(field(raw,'rank_type','rank'),warnings),
    itemType:text(field(raw,'item_type','itemType'),'物品类型',{max:100}),
    time:timestamp(field(raw,'time')),
    gachaId:text(field(raw,'gacha_id','gachaId'),'卡池 ID',{max:128,numeric:true})
  };
}
function sameRecord(a,b) {
  return a.pool===b.pool&&a.time===b.time&&(!a.itemId||!b.itemId||a.itemId===b.itemId)&&(!a.rank||!b.rank||a.rank===b.rank)&&(!a.gachaId||!b.gachaId||a.gachaId===b.gachaId);
}
function combine(accounts,warnings) {
  const byUid=new Map();let added=0,duplicates=0;
  for(const account of accounts) {
    let target=byUid.get(account.uid);
    if(!target){target={uid:account.uid,timezone:account.timezone,lang:account.lang,records:[],ids:new Map()};byUid.set(account.uid,target);}
    if(target.timezone!==account.timezone && (target.timezone===null||account.timezone===null))fail(`账号 ${account.uid} 的记录时区不明确，无法与另一时区合并。请先补齐或统一 timezone。`);
    for(const original of account.records) {
      const r={...original};
      if(target.timezone!==account.timezone)r.time=shiftTime(r.time,account.timezone,target.timezone);
      const old=target.ids.get(r.id);
      if(old) {
        if(!sameRecord(old,r))fail(`账号 ${account.uid} 的记录 ID ${r.id} 内容冲突，已取消整个导入`);
        // Optional fields from another export can complete a previously unknown record.
        for(const key of ['rank','name','itemId','itemType','gachaId'])if(!old[key]&&r[key])old[key]=r[key];
        duplicates++;
      } else {target.ids.set(r.id,r);target.records.push(r);added++;}
    }
  }
  if(duplicates)warnings.add(`已忽略 ${duplicates} 条相同账号、相同 ID 的重复记录。`);
  return {accounts:[...byUid.values()].map(a=>({uid:a.uid,timezone:a.timezone,lang:a.lang,records:sortRecords(a.records)})),added,duplicates};
}

function csvRows(input) {
  const rows=[];let row=[],cell='',quoted=false,afterQuote=false;
  for(let i=0;i<input.length;i++) {
    const c=input[i];
    if(quoted){if(c==='"'){if(input[i+1]==='"'){cell+='"';i++;}else{quoted=false;afterQuote=true;}}else cell+=c;continue;}
    if(afterQuote&&c!==','&&c!=='\r'&&c!=='\n')fail('CSV 引号后存在多余字符');
    if(c==='"'){if(cell||afterQuote)fail('CSV 引号位置无效');quoted=true;}
    else if(c===','){row.push(cell);cell='';afterQuote=false;}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&input[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v!==''))rows.push(row);row=[];cell='';afterQuote=false;}
    else cell+=c;
  }
  if(quoted)fail('CSV 引号未闭合');
  row.push(cell);if(row.some(v=>v!==''))rows.push(row);
  return rows;
}
function parseCSV(input,warnings) {
  const rows=csvRows(input);if(!rows.length)fail('CSV 文件为空');
  const headers=rows.shift().map(h=>h.trim());
  if(new Set(headers).size!==headers.length)fail('CSV 列名重复');
  for(const name of ['uid','id','time'])if(!headers.includes(name))fail(`CSV 缺少 ${name} 列`);
  if(!headers.includes('gacha_type')&&!headers.includes('pool'))fail('CSV 缺少 gacha_type 列');
  if(rows.length>IMPORT_LIMITS.records)fail('单次导入最多 100000 条记录');
  const accounts=new Map();
  rows.forEach((row,i)=>{
    if(row.length!==headers.length)fail(`CSV 第 ${i+2} 行列数不符`);
    const raw=Object.create(null);headers.forEach((h,j)=>{raw[h]=row[j];});
    // Our CSV prefix blocks spreadsheet formulas; undo exactly one prefix on import.
    for(const key of ['uid','id','gacha_type','pool','name','item_id','itemId','item_type','itemType','gacha_id','gachaId','lang','timezone'])if(typeof raw[key]==='string'&&/^'(?:'|\s*[=+\-@]|[\t\r\n])/.test(raw[key]))raw[key]=raw[key].slice(1);
    const u=uid(raw.uid),tz=zone(raw.timezone),lang=text(raw.lang,'语言',{max:30})||'zh-cn';
    const groupKey=JSON.stringify([u,tz]);let account=accounts.get(groupKey);
    if(!account){account={uid:u,timezone:tz,lang,records:[]};accounts.set(groupKey,account);}
    account.records.push(readRecord(raw,account,warnings,i));
  });
  if(!rows.length)fail('CSV 没有调频记录');
  return [...accounts.values()];
}

export function parseImport(input,fileName='',options={}) {
  if(typeof input!=='string')fail('导入内容必须是文本');
  if(new TextEncoder().encode(input).byteLength>IMPORT_LIMITS.bytes)fail('文件超过 20 MB 导入上限');
  const body=input.replace(/^\uFEFF/,'').trim();if(!body)fail('导入文件为空');
  const warnings=new Set();let accounts=[],format='';
  if(/\.csv$/i.test(fileName)||(!body.startsWith('{')&&!body.startsWith('['))) {format='CSV';accounts=parseCSV(body,warnings);}
  else {
    let data;try{data=JSON.parse(body);}catch{fail('JSON 格式无效，未导入任何记录');}
    if(!object(data))fail('JSON 顶层必须是对象');
    if(isRngBackup(data)) {
      const converted=convertRngBackup(data,options);
      accounts=converted.accounts.map(cleanAccount);format='rng.moe 调频备份';
      for(const warning of converted.warnings)warnings.add(warning);
    } else if(data.format==='bagel-tuning') {
      if(data.version!==1||!Array.isArray(data.accounts))fail('不支持的DUKE 调频备份版本或账号结构');
      if(data.accounts.reduce((n,a)=>n+(Array.isArray(a?.records)?a.records.length:0),0)>IMPORT_LIMITS.records)fail('单次导入最多 100000 条记录');
      accounts=data.accounts.map(cleanAccount);format='DUKE 调频备份';
      if(!accounts.length)fail('备份没有账号记录');
    } else if(Array.isArray(data.nap)) {
      const version=text(data.info?.version,'UIGF 版本',{max:30});
      if(version&&!/^v?4\.[012]$/i.test(version))fail(`不支持的 UIGF 版本 ${version}，目前支持 4.0、4.1、4.2`);
      format=`UIGF ${version.replace(/^v/i,'')||'4.x'}`;
      if(!version)warnings.add('文件未声明 UIGF 版本，按 nap 结构读取。');
      let count=0;
      accounts=data.nap.map((raw,i)=>{
        if(!object(raw)||!Array.isArray(raw.list))fail(`nap 第 ${i+1} 个账号缺少 list 数组`);
        if(!own(raw,'timezone')||raw.timezone==null||raw.timezone==='')fail('UIGF nap 账号缺少 timezone');
        count+=raw.list.length;if(count>IMPORT_LIMITS.records)fail('单次导入最多 100000 条记录');
        const a={uid:uid(raw.uid),timezone:zone(raw.timezone),lang:text(field(raw,'lang')??data.info?.lang,'语言',{max:30})||'zh-cn',records:[]};
        a.records=raw.list.map((r,j)=>readRecord(r,a,warnings,j));return a;
      });
      if(!accounts.length)fail('UIGF 文件没有绝区零 nap 账号记录');
      if(own(data,'hk4e')||own(data,'hkrpg'))warnings.add('已仅读取 nap 绝区零记录，其他游戏数据未导入。');
    } else {
      if(own(data,'nap')||own(data,'hk4e')||own(data,'hkrpg'))fail('文件缺少有效的 nap 绝区零记录');
      const list=Array.isArray(data.list)?data.list:data.data?.list;
      if(!Array.isArray(list))fail('未识别格式：需要 UIGF nap[]、原始 list/data.list 或 CSV');
      if(list.length>IMPORT_LIMITS.records)fail('单次导入最多 100000 条记录');
      const info=object(data.info)?data.info:{},nested=object(data.data)?data.data:{};
      const rootUid=field(info,'uid')??field(data,'uid')??field(nested,'uid');
      const tz=zone(field(info,'timezone')??field(data,'timezone')??field(nested,'timezone'));
      const lang=text(field(info,'lang')??field(data,'lang'),'语言',{max:30})||'zh-cn';
      const groups=new Map();
      list.forEach((r,j)=>{
        if(!object(r))fail(`第 ${j+1} 条记录不是对象`);
        const u=uid(rootUid??field(r,'uid'));let a=groups.get(u);
        if(!a){a={uid:u,timezone:tz,lang,records:[]};groups.set(u,a);}
        a.records.push(readRecord(r,a,warnings,j));
      });
      accounts=[...groups.values()];format='ZZZ 原始记录';
      if(!accounts.length)fail('文件没有调频记录');
    }
  }
  const merged=combine(accounts,warnings);
  for(const a of merged.accounts) {
    if(a.timezone===null)warnings.add(`账号 ${a.uid} 未提供时区，时间保持原文。补齐 timezone 后才能导出规范 UIGF。`);
    const missing=a.records.filter(r=>!r.rank).length;if(missing)warnings.add(`账号 ${a.uid} 有 ${missing} 条记录缺少可识别品质，相关保底统计可能未知。`);
  }
  return {accounts:merged.accounts,warnings:[...warnings],format};
}

function cleanAccount(account) {
  if(!object(account)||!Array.isArray(account.records))fail('账号数据无效');
  const a={uid:uid(account.uid),timezone:zone(account.timezone),lang:text(account.lang,'语言',{max:30})||'zh-cn',records:[]};
  if(account.records.length>IMPORT_LIMITS.records)fail('每个账号最多 100000 条记录');
  const warnings=new Set();a.records=account.records.map((r,i)=>readRecord(r,a,warnings,i));return a;
}
export function mergeAccounts(existing,incoming) {
  if(!Array.isArray(existing)||!Array.isArray(incoming))fail('需要账号数组');
  const warnings=new Set();
  const before=combine(existing.map(cleanAccount),warnings);
  const total=before.accounts.reduce((n,a)=>n+a.records.length,0)+incoming.reduce((n,a)=>n+(a.records?.length||0),0);
  // Each import is bounded independently; allow an existing full archive to be imported again.
  if(incoming.reduce((n,a)=>n+(a.records?.length||0),0)>IMPORT_LIMITS.records)fail('单次导入最多 100000 条记录');
  const result=combine([...before.accounts,...incoming.map(cleanAccount)],warnings);
  const oldCount=before.accounts.reduce((n,a)=>n+a.records.length,0);
  const newCount=result.accounts.reduce((n,a)=>n+a.records.length,0);
  if(newCount>IMPORT_LIMITS.records)fail('本地存储最多保留 100000 条记录');
  checkedBackup(result.accounts);
  return {accounts:result.accounts,added:newCount-oldCount,duplicates:total-newCount,warnings:[...warnings]};
}

export function analyzeAccount(input) {
  const account=cleanAccount(input),rankCounts=blankRank(),warnings=[];
  const records=combine([account],new Set()).accounts[0].records;
  const groups=new Map();for(const r of records){rankCounts[r.rank||'unknown']++;if(!groups.has(r.pool))groups.set(r.pool,[]);groups.get(r.pool).push(r);}
  const pools=[...groups.entries()].map(([id,list])=>{
    const meta=own(POOL_META,id)?POOL_META[id]:{id,label:`未知调频类型 ${id}`,hardPity:null};
    const counts=blankRank(),sIntervals=[],sRecords=[],poolWarnings=[];let sinceS=0,hasS=false,unknownSinceS=false,lastS=null,knownRun=0,hardPityConflict=false;
    for(const r of list) {
      counts[r.rank||'unknown']++;sinceS++;
      knownRun=['S','A','B'].includes(r.rank)?knownRun+1:0;
      if(meta.hardPity&&(r.rank==='S'?knownRun>meta.hardPity:knownRun>=meta.hardPity))hardPityConflict=true;
      if(!r.rank)unknownSinceS=true;
      if(r.rank==='S'){
        const interval=hasS&&!unknownSinceS?sinceS:null;
        if(interval!==null)sIntervals.push(interval);
        sRecords.push({id:r.id,name:r.name,itemId:r.itemId,time:r.time,interval,leftCensored:!hasS,known:interval!==null,complete:interval!==null});
        hasS=true;sinceS=0;knownRun=0;unknownSinceS=false;lastS=r;
      }
    }
    const currentPityKnown=hasS&&!unknownSinceS;
    const recordOrderConsistent=!list.some((r,i)=>i>0&&r.time<list[i-1].time);
    if(!hasS)poolWarnings.push('记录中没有 S 级，连续未出 S 的真实抽数未知；显示的记录数仅为已导入部分。');
    if(counts.unknown)poolWarnings.push('存在未知品质，跨越这些记录的 S 间隔不计入平均。');
    if(!recordOrderConsistent)poolWarnings.push('记录 ID 顺序与时间先后矛盾，请检查是否混用了时区或修改过记录。');
    if(meta.hardPity && (hardPityConflict||sIntervals.some(n=>n>meta.hardPity)||(currentPityKnown&&sinceS>=meta.hardPity)))poolWarnings.push('记录与已知硬保底规则不一致，请检查调频类型、品质和历史完整性。');
    if(!own(POOL_META,id))poolWarnings.push('调频类型尚未确认，独立统计，不与其他池合并保底。');
    return {id,label:meta.label,hardPity:meta.hardPity,count:list.length,rankCounts:counts,sCount:counts.S,unknownRankCount:counts.unknown,currentPity:currentPityKnown?sinceS:null,currentPityKnown,recordedSinceLastS:sinceS,sIntervals,averageSInterval:sIntervals.length?sIntervals.reduce((a,b)=>a+b,0)/sIntervals.length:null,completeIntervalCount:sIntervals.length,sRecords,sHistory:sRecords,lastS,historyStatus:'unknown',recordOrderConsistent,hardPityConsistent:!hardPityConflict,firstTime:list[0]?.time||null,lastTime:list[list.length-1]?.time||null,warnings:poolWarnings};
  });
  warnings.push('仅统计已导入记录；不能据此验证历史是否完整或中间缺页。首个 S 之前的左截断记录不计入完整 S 周期平均。');
  return {uid:account.uid,total:records.length,rankCounts,pools,items:aggregateItems(records),historyStatus:'unknown',warnings};
}

function aggregateItems(records) {
  const groups={agents:new Map(),engines:new Map(),bangboo:new Map(),unknown:new Map()};
  for(const r of records) {
    const t=r.itemType.toLowerCase().replace(/[\s_-]/g,'');
    const category=['代理人','角色','agent','agents','character','characters'].includes(t)?'agents':['音擎','武器','wengine','wengines','weapon','weapons'].includes(t)?'engines':['邦布','bangboo'].includes(t)?'bangboo':'unknown';
    const key=r.itemId?'id:'+r.itemId:'name:'+JSON.stringify([r.itemType,r.name]);
    const old=groups[category].get(key);
    if(old){old.count++;if(!old.pools.includes(r.pool))old.pools.push(r.pool);if(!old.rank&&r.rank)old.rank=r.rank;}
    else groups[category].set(key,{key,itemId:r.itemId,name:r.name,itemType:r.itemType,rank:r.rank,count:1,pools:[r.pool]});
  }
  return Object.fromEntries(Object.entries(groups).map(([key,value])=>[key,[...value.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name))]));
}

function checkedBackup(accounts) {
  if(accounts.reduce((n,a)=>n+a.records.length,0)>IMPORT_LIMITS.records)fail('备份最多保留 100000 条记录');
  const backup={format:'bagel-tuning',version:1,exportedAt:new Date().toISOString(),accounts};
  if(new TextEncoder().encode(JSON.stringify(backup)).byteLength>IMPORT_LIMITS.bytes)fail('本地完整备份超过 20 MB，原记录保留。请减少导入范围后重试。');
  return backup;
}
export function exportBackup(input) {
  if(!Array.isArray(input))fail('需要账号数组');
  const accounts=combine(input.map(cleanAccount),new Set()).accounts;
  return checkedBackup(accounts);
}

export function exportUIGF(input) {
  if(!Array.isArray(input))fail('需要账号数组');
  const accounts=combine(input.map(cleanAccount),new Set()).accounts;
  return {
    info:{export_app:'DUKE',export_app_version:'1.0.0',export_timestamp:Math.floor(Date.now()/1000),version:'v4.2'},
    nap:accounts.map(a=>{
      if(a.timezone===null)fail(`账号 ${a.uid} 缺少 timezone，无法生成规范 UIGF；可先导出 CSV。`);
      if(!UIGF_LANGS.has(a.lang))fail(`语言代码 ${a.lang} 不属于 UIGF 标准枚举，请使用「导出完整备份」。`);
      return {uid:a.uid,timezone:a.timezone,lang:a.lang,list:a.records.map(r=>{
        if(!['1','2','3','5'].includes(r.pool))fail(`调频类型 ${r.pool} 不属于 UIGF 4.x 标准枚举，请使用「导出完整备份」保留复刻及扩展池记录。`);
        if(!/^[0-9]{1,19}$/.test(r.id))fail(`记录 ID ${r.id} 不符合 UIGF 的 1–19 位十进制字符串要求，请使用「导出完整备份」。`);
        return {gacha_type:r.pool,item_id:r.itemId,time:r.time,id:r.id,...(r.name?{name:r.name}:{}),...(r.rank?{rank_type:EXPORT_RANK[r.rank]}:{}),...(r.itemType?{item_type:r.itemType}:{}),...(r.gachaId?{gacha_id:r.gachaId}:{}),count:'1'};
      })};
    })
  };
}
function csvCell(value) {
  let s=String(value??'');
  // Quoting alone does not prevent formulas in Excel/LibreOffice.
  if(/^[\s]*[=+\-@]/.test(s)||/^['\t\r\n]/.test(s))s="'"+s;
  return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
}
export function exportCSV(input) {
  const a=combine([cleanAccount(input)],new Set()).accounts[0];
  const headers=['uid','id','gacha_type','time','rank_type','name','item_id','item_type','timezone','lang','gacha_id'];
  return '\uFEFF'+[headers.join(','),...a.records.map(r=>[a.uid,r.id,r.pool,r.time,r.rank?EXPORT_RANK[r.rank]:'',r.name,r.itemId,r.itemType,a.timezone??'',a.lang,r.gachaId].map(csvCell).join(','))].join('\r\n');
}

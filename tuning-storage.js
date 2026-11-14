/* Gacha records stay in this browser. One read/write transaction protects tab merges. */
import {cloneData} from './tuning-compat.js?v=20260909-tuning-win11-1';
import {archiveStamp} from './tuning-sync.js?v=20260910-tuning-incremental-1';
const DB_NAME = 'bagel-tuning-v1';
let database;
let memory = [];
let memorySync = {version:1,revision:0,checkpoints:{}};
export let persistent = true;

function syncState(value) {
  return value?.version===1&&Number.isSafeInteger(value.revision)&&value.revision>=0&&value.checkpoints&&typeof value.checkpoints==='object'&&!Array.isArray(value.checkpoints)
    ? value : {version:1,revision:0,checkpoints:{}};
}
function prepareUpdate(update,accounts,storedSync,expectedRevision,expectedAccounts) {
  const current=syncState(storedSync);
  if(expectedRevision!==undefined&&expectedRevision!==current.revision)throw new Error('本地记录已在其他标签页中更新，请重新导入。');
  // Older open tabs do not know about revision yet, so also compare the archive snapshot.
  if(expectedAccounts!==undefined&&JSON.stringify(accounts)!==JSON.stringify(expectedAccounts))throw new Error('本地记录已在其他标签页中更新，请重新导入。');
  const result=update(accounts);
  const checkpoints={...current.checkpoints};
  // A cleared account or manually changed timezone cannot retain a usable checkpoint.
  for(const uid of Object.keys(checkpoints)) {
    const account=result.accounts.find(a=>a.uid===uid),checkpoint=checkpoints[uid];
    const previous=accounts.find(a=>a.uid===uid);
    if(!account||!checkpoint||checkpoint.uid!==uid||!checkpoint.heads||typeof checkpoint.heads!=='object'||checkpoint.archiveTimezone!==account.timezone||JSON.stringify(previous?.records)!==JSON.stringify(account.records))delete checkpoints[uid];
  }
  if(result.linkCheckpoint) {
    const checkpoint=result.linkCheckpoint,account=result.accounts.find(a=>a.uid===checkpoint.uid);
    if(!account)throw new Error('同步账号与本地记录不一致，已停止保存。');
    checkpoints[account.uid]={...checkpoint,archiveTimezone:account.timezone,archiveStamp:archiveStamp(account)};
  }
  return {result,nextSync:{version:1,revision:current.revision+1,checkpoints}};
}

export async function openStorage() {
  try {
    database = await new Promise((resolve, reject) => {
      let finished=false;
      const timer=setTimeout(()=>finish(new Error('本地记录存储响应超时')),8000);
      function finish(error,value){
        if(finished){if(value)value.close();return;}
        finished=true;clearTimeout(timer);
        if(error)reject(error);else resolve(value);
      }
      let request;
      try { request=indexedDB.open(DB_NAME,1); }
      catch(error){finish(error);return;}
      request.onupgradeneeded = () => {
        if(finished){request.transaction.abort();return;}
        request.result.createObjectStore('records');
      };
      request.onerror = () => finish(request.error||new Error('无法打开本地记录'));
      request.onblocked = () => finish(new Error('记录存储正在被其他页面占用'));
      request.onsuccess = () => finish(null,request.result);
    });
    database.onversionchange = () => database.close();
    return await readAccounts();
  } catch {
    persistent = false;
    return memory;
  }
}

export function readAccounts() {
  return readImportState().then(state=>state.accounts);
}

// Read archive and checkpoints together, before starting any network requests.
export function readImportState({signal,timeout=8000}={}) {
  if(signal?.aborted)return Promise.reject(new DOMException('已取消','AbortError'));
  if (!persistent) return Promise.resolve(cloneData({accounts:memory,...memorySync}));
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('records', 'readonly');
    let finished=false;
    const finish=(error,value)=>{if(finished)return;finished=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);error?reject(error):resolve(value);};
    const stop=error=>{finish(error);try{transaction.abort();}catch{/* already finished */}};
    const cancel=()=>stop(new DOMException('已取消','AbortError'));
    const timer=setTimeout(()=>stop(new Error('读取本地同步进度超时，请刷新页面后重试。')),timeout);
    signal?.addEventListener('abort',cancel,{once:true});
    try {
      const store=transaction.objectStore('records');
      const request = store.get('accounts'),syncRequest=store.get('linkSync');
      transaction.oncomplete = () => finish(null,{accounts:request.result||[],...syncState(syncRequest.result)});
      transaction.onabort = transaction.onerror = () => finish(transaction.error || new Error('无法读取本地记录'));
    } catch(error) {stop(error);}
  });
}

export function updateAccounts(update,{expectedRevision,expectedAccounts}={}) {
  if (!persistent) {
    const {result,nextSync}=prepareUpdate(update,cloneData(memory),cloneData(memorySync),expectedRevision,expectedAccounts);
    memory = result.accounts;memorySync=nextSync;
    return Promise.resolve(result);
  }
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('records', 'readwrite');
    const store = transaction.objectStore('records');
    const request = store.get('accounts'),syncRequest=store.get('linkSync');
    let result, failure;
    syncRequest.onsuccess = () => {
      try {
        const prepared=prepareUpdate(update,request.result||[],syncRequest.result,expectedRevision,expectedAccounts);
        result=prepared.result;
        store.put(result.accounts, 'accounts');
        store.put(prepared.nextSync,'linkSync');
      } catch (error) {
        failure = error;
        transaction.abort();
      }
    };
    transaction.oncomplete = () => resolve(result);
    transaction.onabort = transaction.onerror = () => reject(failure || transaction.error || new Error('保存失败，请检查浏览器可用空间'));
  });
}

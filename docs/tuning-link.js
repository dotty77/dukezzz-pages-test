// Only the published Pages project uses the fixed DUKE API; never read an API host from input.
const API_ROOT=globalThis.location?.origin==='https://dotty77.github.io'&&globalThis.location.pathname.startsWith('/dukezzz-pages-test/')?'https://dukezzz.com':'';
import {createRequestScheduler} from './tuning-request-scheduler.js?v=20260911-community-update-1';
import {mountRngGuide} from './tuning-import-guide.js?v=20261114-direct-tools-1';
import {archiveStamp} from './tuning-sync.js?v=20260910-tuning-incremental-1';
export {getLinkCommand} from './tuning-import-guide.js?v=20261114-direct-tools-1';
const POOLS = [['2','独家频段'],['3','音擎频段'],['1','常驻频段'],['5','邦布频段'],['102','复刻角色'],['103','复刻音擎']];
const LIMIT=100000;
const $=id=>document.getElementById(id);
// Repair copy-only formatting without decoding or rewriting authkey characters.
// Literal spaces remain invalid; official host/path checks still run server-side.
export function normalizePastedLink(value) {
  return value.trim().replace(/[ \t]*[\r\n]+[ \t]*/g,'').replace(/\t/g,'').replace(/\\([&_])/g,'$1');
}
function abortError(){return new DOMException('已取消','AbortError');}
function importError(code,message){const error=new Error(message);error.code=code;return error;}
// Bound both the connection and JSON body, even if a stalled transport ignores abort.
export async function requestImportJson(url,{signal,request=fetch,timeout=15000,onResponse=()=>{},...options}={}) {
  if(signal?.aborted)throw abortError();
  const controller=new AbortController();let timer,stop;
  const deadline=new Promise((resolve,reject)=>{
    stop=()=>{reject(abortError());controller.abort();};
    signal?.addEventListener('abort',stop,{once:true});
    timer=setTimeout(()=>{
      const error=new Error('读取请求超时，请检查网络后重试；若仍失败，请重新获取调频链接。');
      error.code='timeout';reject(error);controller.abort();
    },timeout);
  });
  try {
    return await Promise.race([(async()=>{
      let response;
      try {response=await request(url,{...options,signal:controller.signal});}
      catch {if(signal?.aborted)throw abortError();throw importError('client_network','读取服务连接中断，请检查网络后重试。');}
      if(controller.signal.aborted)throw abortError();
      onResponse(response);
      try {return {response,data:await response.json()};}
      catch {if(signal?.aborted)throw abortError();const error=importError(response.status===429?'rate_limit':response.status===408||response.status>=500?'service_unavailable':'invalid_response','读取服务暂未返回有效数据，请稍后重试。');error.retryAfter=response.headers?.get?.('Retry-After');throw error;}
    })(),deadline]);
  } finally {clearTimeout(timer);signal?.removeEventListener('abort',stop);}
}
function pause(ms,signal) {
  return new Promise((resolve,reject)=>{
    if(signal.aborted){reject(abortError());return;}
    const stop=()=>{clearTimeout(timer);reject(abortError());};
    const timer=setTimeout(()=>{signal.removeEventListener('abort',stop);resolve();},ms);
    signal.addEventListener('abort',stop,{once:true});
  });
}
function checkpointId(snapshot,uid,pool,timezone,region,stamps) {
  const checkpoint=snapshot.checkpoints?.[uid],account=snapshot.accounts?.find(a=>a.uid===uid);
  const id=checkpoint?.heads?.[pool];
  if(snapshot.version!==1||checkpoint?.uid!==uid||checkpoint.sourceTimezone!==timezone||checkpoint.region!==region||!account||checkpoint.archiveTimezone!==account.timezone||typeof id!=='string'||!/^\d{1,19}$/.test(id))return null;
  if(!stamps.has(uid))stamps.set(uid,archiveStamp(account));
  if(checkpoint.archiveStamp!==stamps.get(uid))return null;
  return account.records.some(r=>r.id===id&&r.pool===pool)?id:null;
}
export async function readLinkHistory(sourceUrl,{signal:externalSignal=new AbortController().signal,onProgress=()=>{},request=fetch,delay=350,timeout=15000,snapshot={},incremental=true,concurrency=1}={}) {
  if(![1,2].includes(concurrency)||!Number.isFinite(delay)||delay<0)throw new RangeError('读取并发只能为 1 或 2，间隔不能为负数。');
  sourceUrl=normalizePastedLink(sourceUrl);
  const controller=new AbortController(),signal=controller.signal;
  const cancel=()=>controller.abort();externalSignal.addEventListener('abort',cancel,{once:true});if(externalSignal.aborted)cancel();
  const scheduler=createRequestScheduler({signal,concurrency,delay});
  const records=[],seen=new Map(),poolRecords=new Map(POOLS.map(([pool])=>[pool,[]])),encoder=new TextEncoder();
  const heads=Object.fromEntries(POOLS.map(([pool])=>[pool,null])),stamps=new Map();
  let uid=null,timezone=null,region=null,byteCount=0,incrementalPools=0,requests=0,nextPool=0,rootError=null,rateLimited=false;
  const emit=p=>{if(!signal.aborted)onProgress({...p,total:records.length,concurrency:scheduler.concurrency,rateLimited});};
  function fail(error,meta){
    if(rootError||signal.aborted)return;
    rootError=error;rootError.pool=meta.pool;
    try{emit({...meta,state:'error'});}finally{controller.abort();}
  }
  const retryWait=(error,retry)=>{
    let ms=1500*(retry+1);const value=error.retryAfter;
    const requested=value?/^\d+(?:\.\d+)?$/.test(value)?Number(value)*1000:Date.parse(value)-Date.now():0;
    if(Number.isFinite(requested)&&requested>0)ms=Math.max(ms,requested);return ms;
  };
  async function readPool(index){
    const [pool,label]=POOLS[index];let endId='0',page=1,count=0,matchedCheckpoint=false,knownCheckpoint,finished=false;
    const meta=()=>({pool,label,index,page,count});
    const processPage=result=>{
      if(!Array.isArray(result?.list)||result.list.length>20||result.pool!==pool)throw new Error('记录分页格式异常，已停止读取。');
      const batch=result.list;let newRows=0,previousId=endId==='0'?null:endId;
      for(const row of batch){
        if(!row||typeof row.id!=='string'||!/^\d{1,19}$/.test(row.id)||typeof row.uid!=='string'||!/^\d{1,20}$/.test(row.uid))throw new Error('官方记录缺少有效 UID 或记录 ID。');
        if(previousId!==null&&BigInt(row.id)>BigInt(previousId))throw new Error('官方记录顺序异常，已停止读取。');previousId=row.id;
        if(uid!==null&&uid!==row.uid)throw new Error('不同页面返回了不同账号，已停止导入。请重新获取链接。');
        if(!Number.isInteger(result.timezone))throw new Error('无法确认官方记录的时区，已停止导入。');
        if(timezone!==null&&(timezone!==result.timezone||region!==result.region))throw new Error('记录的服务器或时区不一致，已停止导入。');
        uid=row.uid;timezone=result.timezone;region=result.region;
        if(row.gacha_type!==pool)throw new Error('官方返回了不匹配的频段，已停止导入。');
        if(heads[pool]===null)heads[pool]=row.id;
        if(knownCheckpoint===undefined)knownCheckpoint=incremental?checkpointId(snapshot,uid,pool,timezone,region,stamps):null;
        if(row.id===knownCheckpoint)matchedCheckpoint=true;
        if(seen.has(row.id)){
          const previous=seen.get(row.id);
          if(previous.gacha_type!==pool||previous.time!==row.time||previous.item_id!==row.item_id||previous.rank_type!==row.rank_type)throw new Error('分页中有互相冲突的记录，已停止导入。');
          continue;
        }
        byteCount+=encoder.encode(JSON.stringify(row)).byteLength;
        if(byteCount>20*1024*1024)throw new Error('读取的记录超过 20 MB，请使用文件分段管理。');
        seen.set(row.id,row);records.push(row);poolRecords.get(pool).push(row);newRows++;count++;
        if(records.length>LIMIT)throw new Error('记录超过 10 万条，请使用分段文件导入。');
      }
      // The whole overlap page must pass validation before a pool can stop.
      if(matchedCheckpoint){incrementalPools++;finished=true;}
      else if(!batch.length)finished=true;
      else{
        const next=batch[batch.length-1].id;
        if(!newRows||next===endId||endId!=='0'&&BigInt(next)>=BigInt(endId))throw new Error('官方分页没有继续前进，已停止读取以避免循环。');
        if(page>=5001)throw new Error('分页数量异常，已停止读取。');
        endId=next;
      }
    };
    try{
      while(!finished){
        if(signal.aborted)throw abortError();
        emit({...meta(),state:'waiting'});
        for(let retry=0;retry<=2;retry++){
          const step=await scheduler.run(async markRequestStart=>{
            emit({...meta(),state:'loading'});
            if(signal.aborted)throw abortError();
            requests++;
            let coolingFromHeaders=false;
            try{
              const received=await requestImportJson(API_ROOT+'/api/tuning/page',{request:(...args)=>{markRequestStart();return request(...args);},onResponse:response=>{
                if(response.status!==429)return;
                // Stop sibling starts at headers; a slow error body must not delay cooldown.
                coolingFromHeaders=true;rateLimited=true;
                scheduler.coolDown(retryWait({retryAfter:response.headers?.get?.('Retry-After')},retry));
                emit({...meta(),state:'retrying',message:'接口限流，已降低为单路读取，正在等待后重试当前页…'});
              },timeout,method:'POST',headers:{'Content-Type':'application/json','X-Bagel-Import':'1'},body:JSON.stringify({url:sourceUrl,pool,page,endId}),signal,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
              if(signal.aborted)throw abortError();
              const response=received.response,result=received.data;
              if(!response.ok){
                const messages={expired_key:'链接已过期或失效，请回游戏重新打开调频记录并获取新链接。',network:'本站连接游戏官方接口失败，请稍后重试。',invalid_link:'仅接受绝区零官方调频记录链接，请重新复制。',missing_key:'链接缺少临时读取凭证，请重新获取完整链接。',region:'无法确认记录所属服务器和时区，请重新获取完整链接。',rate_limit:'官方接口读取频繁，请稍后再试。',origin:'请从 DUKE 原站或 GitHub 站打开链接导入。',wrong_game:'链接所属游戏或服务器不匹配，请使用绝区零记录链接。',unavailable:'读取服务暂不可用，请稍后重试。'};
                const code=response.status===429?'rate_limit':result?.error;
                const error=importError(code,messages[code]||'官方记录暂时读取失败，请稍后重试或重新获取链接。');error.retryAfter=response.headers?.get?.('Retry-After');throw error;
              }
              processPage(result);
              emit({...meta(),state:finished?'done':'loading',...(finished?{stopReason:matchedCheckpoint?'checkpoint':'end'}:{})});
              return {done:true};
            }catch(error){
              if(signal.aborted)throw abortError();
              const transient=['network','timeout','client_network','service_unavailable','unavailable','rate_limit'].includes(error.code);
              const waitMs=retryWait(error,retry);
              if(error.code==='rate_limit'){rateLimited=true;if(!coolingFromHeaders)scheduler.coolDown(waitMs);}
              if(transient&&retry<2&&waitMs<=30000){
                emit({...meta(),state:'retrying',message:`${error.code==='rate_limit'?'接口限流，已降低为单路读取':'连接暂时中断或超时'}，${Math.ceil(waitMs/1000)} 秒后自动重试第 ${page} 页（${retry+1}/2），已读取 ${records.length} 条暂存中…`});
                return {done:false,waitMs,global:error.code==='rate_limit'};
              }
              if(transient&&retry>0)error.message+=` 已自动重试 ${retry} 次，仍未恢复。`;
              fail(error,meta());throw error;
            }
          });
          if(step.done)break;
          if(!step.global)await pause(step.waitMs,signal);
        }
        if(!finished)page++;
      }
    }catch(error){if(!signal.aborted)fail(error,meta());throw error;}
  }
  async function worker(){while(!signal.aborted){const index=nextPool++;if(index>=POOLS.length)return;await readPool(index);}}
  try{
    await Promise.allSettled(Array.from({length:concurrency},()=>worker()));
    if(rootError)throw rootError;if(signal.aborted)throw abortError();
    if(!records.length)throw new Error('六个频段均没有可读取的记录。请确认账号，并在游戏中打开调频记录后重试。');
    return {info:{uid,timezone,lang:'zh-cn'},list:POOLS.flatMap(([pool])=>poolRecords.get(pool)),linkCheckpoint:{uid,sourceTimezone:timezone,region,heads},syncSummary:{incrementalPools,requests,concurrency,effectiveConcurrency:scheduler.concurrency,rateLimited}};
  }finally{externalSignal.removeEventListener('abort',cancel);scheduler.dispose();sourceUrl='';}
}


export function setupLinkImport({onRecords,onBusy,onMessage,getImportState=async()=>({accounts:[],version:1,revision:0,checkpoints:{}})}) {
  const dialog=document.createElement('dialog');dialog.id='link-dialog';dialog.className='tuning-link-dialog';dialog.setAttribute('aria-labelledby','link-title');
  dialog.innerHTML=`<header class="link-dialog-heading"><h2 id="link-title">链接导入</h2><button id="link-close" type="button" aria-label="关闭链接导入">× 关闭</button></header>
    <p class="link-description">粘贴调频记录链接，自动读取六类频段，再合并到你的本地档案。</p>
    <form id="link-form"><label for="link-url">调频记录链接</label><textarea id="link-url" rows="3" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://public-operation-nap…/getGachaLog?…" required maxlength="24000"></textarea><p class="link-private-note">链接含临时读取凭证，仅交给 DUKE 读取服务和游戏官方接口，不会写入备份。无需提供账号密码。</p><div class="link-actions"><button id="link-start" class="primary-button" type="submit">开始导入</button><button id="link-cancel" class="secondary-button" type="button" hidden>取消读取</button></div></form>
    <div id="link-progress" class="link-progress"><p id="link-status" role="status" aria-live="polite">准备好链接后即可开始。</p><button id="link-view-results" class="primary-button" type="button" hidden>查看分析结果 →</button><progress id="link-progress-bar" max="6" value="0" aria-label="频段读取进度"></progress><ol id="link-pool-progress"></ol></div>
    <details id="link-guide" class="link-guide" open></details>`;
  document.body.append(dialog);
  const incrementalOption=document.createElement('label');incrementalOption.className='link-incremental-option';
  incrementalOption.innerHTML='<input id="link-incremental" type="checkbox" checked> 增量更新：接上上次同步的记录后停止读取该频段';
  const incrementalNote=document.createElement('p');incrementalNote.className='rng-tip';incrementalNote.id='link-incremental-note';
  incrementalNote.textContent='首次同步或只有文件导入记录时，会完整读取官方当前可查的历史。之后只读取新增部分；取消勾选可重新完整读取，补查历史记录。';
  incrementalOption.querySelector('input').setAttribute('aria-describedby','link-incremental-note');
  $('link-form').querySelector('.link-actions').before(incrementalOption,incrementalNote);
  const dualOption=document.createElement('label');dualOption.className='link-incremental-option';
  dualOption.innerHTML='<input id="link-dual-pool" type="checkbox" checked> 双频段加速：同时读取最多两个频段';
  const dualNote=document.createElement('p');dualNote.className='rng-tip';dualNote.id='link-read-mode';
  dualNote.textContent='遇到限流会自动降低为单路读取；也可以取消勾选，使用原来的顺序读取。';
  dualOption.querySelector('input').setAttribute('aria-describedby','link-read-mode');
  $('link-form').querySelector('.link-actions').before(dualOption,dualNote);
  $('link-form').before($('link-guide'));
  const jump=document.createElement('button');jump.type='button';jump.className='rng-paste-shortcut';jump.textContent='已有记录链接，直接粘贴 ↓';$('link-guide').before(jump);jump.onclick=()=>{$('link-url').focus();};
  const open=document.createElement('button');open.id='link-open';open.type='button';open.className='primary-button';open.textContent='链接导入';$('import-open').before(open);$('import-open').className='secondary-button';$('import-open').textContent='导入文件';
  let running=null, committing=false, lastProgress=null;
  const poolProgress=new Map();
  const status=(text,kind='info')=>{$('link-status').textContent=text;$('link-status').dataset.kind=kind;};
  const guide=mountRngGuide($('link-guide'),{status,isBusy:()=>!!running});
  function resetProgress(show=false) {
    poolProgress.clear();
    $('link-view-results').hidden=true;
    $('link-progress-bar').hidden=!show;$('link-pool-progress').hidden=!show;
    $('link-progress-bar').value=0;
    $('link-pool-progress').replaceChildren(...POOLS.map(([id,label])=>{const li=document.createElement('li');li.dataset.pool=id;li.dataset.state='waiting';const title=document.createElement('strong');title.textContent=label;const count=document.createElement('small');count.textContent='等待';li.append(title,count);return li;}));
  }
  function progress(p) {
    lastProgress=p;poolProgress.set(p.pool,p);
    const li=$('link-pool-progress').querySelector(`[data-pool="${p.pool}"]`);li.dataset.state=p.state;
    li.querySelector('small').textContent=p.state==='done'?`${p.count} 条 · ${p.stopReason==='checkpoint'?'已接上上次记录':'已读到末页'}`:`${p.count} 条 · 第 ${p.page} 页${p.state==='waiting'?' · 排队中':p.state==='retrying'?' · 等待重试':p.state==='error'?' · 读取失败':''}`;
    $('link-progress-bar').value=[...poolProgress.values()].filter(v=>v.state==='done').length;
    if(p.rateLimited)$('link-read-mode').textContent='检测到限流，本次已自动降低为单路读取，并遵守接口要求的等待时间。';
    const active=[...poolProgress.values()].filter(v=>v.state==='loading').map(v=>v.label);
    status(p.message||`${active.length?`正在读取${active.join('、')}`:'正在处理读取进度'}，共取得 ${p.total} 条记录…`);
  }
  open.onclick=()=>{resetProgress();lastProgress=null;$('link-read-mode').textContent='遇到限流会自动降低为单路读取；也可以取消勾选，使用原来的顺序读取。';status('准备好链接后即可开始。');dialog.showModal();dialog.scrollTop=0;$('link-close').focus({preventScroll:true});};
  const close=()=>{if(committing)return;running?.abort();$('link-url').value='';dialog.close();};
  $('link-close').onclick=close;
  $('link-view-results').onclick=()=>{
    if(running||committing)return;
    close();
    const stats=$('tuning-signal-stats');
    if(stats){stats.tabIndex=-1;stats.focus({preventScroll:true});stats.scrollIntoView({block:'start',behavior:'auto'});}
  };
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  $('link-cancel').onclick=()=>running?.abort();
  $('link-form').onsubmit=async event=>{
    event.preventDefault();if(running)return;
    let sourceUrl=normalizePastedLink($('link-url').value);
    if(/[\s\\]/.test(sourceUrl)){status('链接里仍有空格或多余转义符。请只复制完整记录网址，或重新运行获取命令后直接粘贴。','error');return;}
    try {const parsed=new URL(sourceUrl);if(parsed.protocol!=='https:'||!parsed.searchParams.has('authkey'))throw new Error();}
    catch {status('请粘贴包含临时读取凭证的完整调频记录链接。','error');return;}
    const incremental=$('link-incremental').checked;
    const concurrency=$('link-dual-pool').checked?2:1;
    $('link-read-mode').textContent=concurrency===2?'本次最多两个频段同时读取；各频段内按顺序翻页。':'本次按原有方式逐频段顺序读取。';
    running=new AbortController();onBusy(true);dialog.dataset.busy='true';$('link-url').value='';$('link-url').disabled=true;$('link-start').disabled=true;$('link-incremental').disabled=true;$('link-dual-pool').disabled=true;$('link-cancel').hidden=false;resetProgress(true);
    guide.setBusy(true);$('link-guide').open=false;$('link-progress').scrollIntoView({block:'nearest'});
    try {
      status('正在读取本地同步进度…');
      const snapshot=await getImportState({signal:running.signal});
      if(running.signal.aborted)throw abortError();
      status('正在连接记录读取服务…');
      const {response:health,data:healthData}=await requestImportJson(API_ROOT+'/api/tuning/health',{signal:running.signal,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
      if(!health.ok||!healthData?.mode)throw new Error('DUKE 读取服务暂不可用，请稍后重试。');
      const data=await readLinkHistory(sourceUrl,{signal:running.signal,onProgress:progress,snapshot,incremental,concurrency});
      if(running.signal.aborted)throw abortError();
      sourceUrl='';committing=true;$('link-close').disabled=true;$('link-cancel').disabled=true;
      status('六类频段读取完成，正在校验并合并本地记录…');
      const summary=await onRecords(data,{expectedRevision:snapshot.revision,expectedAccounts:snapshot.accounts});
      const mode=data.syncSummary.incrementalPools?'增量更新完成':'完整读取完成';
      status(`${mode}：新增 ${summary.added} 条，重复 ${summary.duplicates} 条。本次请求 ${data.syncSummary.requests} 次。${summary.persistent ? '已保存在本浏览器，下次可继续增量更新。' : '浏览器无法保存，当前仅临时展示，请立即导出完整备份。'}`,summary.persistent?'success':'warning');
      $('link-view-results').hidden=false;
      $('link-guide').open=false;
    }catch(error) {
      const canceled=error.name==='AbortError';
      for(const li of $('link-pool-progress').children){
        const p=poolProgress.get(li.dataset.pool);if(p?.state==='done')continue;
        const failed=!canceled&&li.dataset.pool===error.pool;
        li.dataset.state=failed?'error':'stopped';
        li.querySelector('small').textContent=p?`${p.count} 条 · 第 ${p.page} 页 · ${failed?'读取失败':canceled?'已取消':'已停止'}`:'尚未读取';
      }
      const message=canceled?'读取已取消，本次记录没有写入，原有档案保持不变。':`${error.message} 本次读取未写入，原有档案保持不变。`;
      status(message,canceled?'info':'error');onMessage(message,canceled?'info':'error');
    }finally {
      sourceUrl='';running=null;committing=false;delete dialog.dataset.busy;$('link-url').disabled=false;$('link-start').disabled=false;$('link-incremental').disabled=false;$('link-dual-pool').disabled=false;$('link-close').disabled=false;$('link-cancel').disabled=false;$('link-cancel').hidden=true;guide.setBusy(false);onBusy(false);
    }
  };
  return {isRunning:()=>!!running};
}

import {createAgentPicker} from './sync-agent-picker.js?v=20261107-refresh-launch-1';
// Same-origin Miyoushe sign-in UI. No credentials or login URLs are persisted.
export function mountOfficialSync(root,{getAgentId,getAgentName=()=>'',onImport,restoredBuild=false}){
  if(!root)return ()=>{};
  let state='checking',accounts=[],agents=[],uid='',agentId='',dataBusy=false,loadingAgents=false;
  let revision=0,dataRevision=0,authRequest=null,dataRequest=null,pollRequest=null,pollTimer=0,expiryTimer=0,polling=false,deadline=0,pollAfter=3000,qrObjectUrl='',disposed=false;
  const node=(tag,cls='')=>{const n=document.createElement(tag);n.className=cls;return n;};
  const text=(n,zh,en)=>{n.textContent=zh;n.dataset.i18nEn=en;return n;};
  const label=(tag,zh,en,cls='')=>text(node(tag,cls),zh,en);
  const control=(zh,en,action,cls='')=>{const n=label('button',zh,en,cls);n.type='button';n.onclick=action;return n;};
  const head=node('div','official-sync-head'),intro=node('div');
  intro.append(label('h2','米游社同步（国服）','Miyoushe sync · China servers'),label('p','用米游社 App 扫码，同步自己的角色配装。','Scan with the Miyoushe app to sync your own builds.'));
  const actions=node('div','official-sync-actions');
  const login=control('扫码登录','Scan to sign in',startLogin,'primary-button');login.dataset.action='login';
  const cancel=control('取消','Cancel',signOut);cancel.dataset.action='cancel';
  const logout=control('退出登录','Sign out',signOut);logout.dataset.action='logout';
  const retry=control('重试连接','Retry connection',checkStatus);retry.dataset.action='retry-status';
  actions.append(login,cancel,logout,retry);head.append(intro,actions);
  const privacy=label('p','登录授权数据由本站服务临时处理，仅用于同步你选择的角色。登录最多保留 1 小时，到期重扫。','Our service temporarily processes sign-in authorization data to sync the characters you select. Sessions last up to 1 hour; scan again after expiry.','official-sync-privacy');
  const qr=node('div','official-sync-qr'),qrImage=node('img');qrImage.width=220;qrImage.height=220;qrImage.alt='米游社登录二维码 / Miyoushe sign-in QR code';
  qr.append(qrImage,label('p','请在米游社 App 内确认登录；二维码最多保留 3 分钟。','Confirm sign-in in the Miyoushe app. This QR code is kept for up to 3 minutes.'));
  const fields=node('div','official-sync-fields'),accountLabel=label('label','游戏账号','Game account'),agentLabel=label('label','代理人','Agent');
  const accountSelect=node('select');accountSelect.id='official-sync-account';accountLabel.htmlFor=accountSelect.id;
  const picker=createAgentPicker({id:'official-sync-agent',getAgentName,onChange:value=>{agentId=value;if(agentId)loadEquipment();else{stopData();paint();}}});agentLabel.htmlFor=picker.input.id;
  const accountField=node('div'),agentField=node('div');accountField.append(accountLabel,accountSelect);agentField.append(agentLabel,picker.element);
  const sync=control('同步配装','Sync equipment',()=>agents.length?loadEquipment():loadAgents(),'primary-button');sync.dataset.action='sync';fields.append(accountField,agentField,sync);
  const status=node('p','official-sync-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  root.replaceChildren(head,privacy,qr,fields,status);
  const say=(zh,en)=>{status.replaceChildren(label('span',zh,en));};
  function paint(){
    const starting=state==='starting',waiting=state==='waiting'||state==='scanned',ready=state==='ready',leaving=state==='signing_out';
    root.dataset.state=state;root.setAttribute('aria-busy',String(starting||leaving||dataBusy||state==='checking'));
    login.hidden=ready||waiting||leaving||state==='logout_error'||state==='checking'||state==='unavailable';login.disabled=starting;
    text(login,starting?'准备中…':['expired','blocked'].includes(state)?'重新扫码':'扫码登录',starting?'Preparing…':['expired','blocked'].includes(state)?'Scan again':'Scan to sign in');
    cancel.hidden=!(starting||waiting||state==='blocked');cancel.disabled=false;
    logout.hidden=!(ready||leaving||state==='logout_error');logout.disabled=leaving;
    text(logout,state==='logout_error'?'重试退出':'退出登录',state==='logout_error'?'Retry sign out':'Sign out');
    retry.hidden=state!=='unavailable';qr.hidden=!waiting||!qrObjectUrl;fields.hidden=!ready;
    accountSelect.disabled=!ready||dataBusy||accounts.length<2;picker.setDisabled(!ready||dataBusy||loadingAgents||!agents.length);
    text(sync,!agents.length?'重试读取':'同步配装',!agents.length?'Retry roster':'Sync equipment');
    sync.disabled=!ready||dataBusy||!uid||(!agentId&&agents.length>0);
  }
  function clearQr(){if(qrObjectUrl)URL.revokeObjectURL(qrObjectUrl);qrObjectUrl='';qrImage.removeAttribute('src');}
  function stopPolling(){clearTimeout(pollTimer);clearTimeout(expiryTimer);pollTimer=0;expiryTimer=0;pollRequest?.abort();pollRequest=null;}
  function stopData(){dataRevision++;dataRequest?.abort();dataRequest=null;dataBusy=false;loadingAgents=false;}
  function invalidate(){revision++;stopPolling();stopData();authRequest?.abort();authRequest=null;clearQr();}
  function expiresAt(value){const n=typeof value==='number'?value:Date.parse(value);return Number.isFinite(n)?(n<1e12?n*1000:n):Date.now()+180000;}
  function errorText(error){
    const known={
      verification_required:['官方要求额外验证，请在米游社完成后重试。','Official verification is required. Complete it in Miyoushe, then retry.'],
      data_private:['战绩隐私设置暂未允许读取，请在米游社调整后重试。','Battle-record privacy settings prevent access. Adjust them in Miyoushe, then retry.'],
      no_cn_account:['此米游社账号未绑定可同步的绝区零国服角色。','This Miyoushe account has no linked Zenless Zone Zero character on China servers.'],
      account_not_bound:['所选游戏账号不属于当前登录，请重新选择。','The selected game account is not linked to this sign-in. Select another account.'],
      rate_limit:['操作较频繁，请稍后重试。','Too many requests. Please retry later.'],
      'official-equipment-rarity':['目前仅支持 S 级驱动盘，原配装保留。','Only S-Rank discs are supported. Your current build is kept.'],
      'official-equipment-initial':['无法确认驱动盘初始词条数，原配装保留。','The initial substat count could not be verified. Your current build is kept.'],
      'official-equipment-data':['本地驱动盘资料不完整，请刷新后重试。','Local disc data is incomplete. Refresh and retry.']
    };
    if(known[error.code])return known[error.code];
    if(/^official-equipment-(agent|weapon|set|property)$/.test(error.code||''))return ['部分角色、装备或属性尚未收录，原配装保留。','Some agent, equipment, or stat data is unavailable. Your current build is kept.'];
    if(/^official-equipment-/.test(error.code||''))return ['官方配装字段或数值无法核对，原配装保留。','Official equipment fields or values could not be verified. Your current build is kept.'];
    return null;
  }
  function stopForError(error){
    if(!['verification_required','data_private','no_cn_account'].includes(error.code))return false;
    stopPolling();clearQr();state='blocked';say(...errorText(error));paint();return true;
  }
  async function request(action,body,signal){
    const response=await fetch(`/api/mys/${action}`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Bagel-Import':'1'},body:JSON.stringify(body),signal});
    let result;try{result=await response.json();}catch{throw Error('response');}
    if(!response.ok){const error=Error('request');error.status=response.status;error.code=typeof result.error==='string'?result.error:result.error?.code;throw error;}
    return result;
  }
  function expired(){stopPolling();clearQr();state='expired';say('二维码或登录已过期，请重新扫码。','The QR code or session expired. Scan again.');paint();}
  function schedulePoll(delay=pollAfter){
    clearTimeout(pollTimer);pollTimer=0;
    if(disposed||!['waiting','scanned'].includes(state)||document.hidden)return;
    if(Date.now()>=deadline){expired();return;}
    pollTimer=setTimeout(poll,Math.min(delay,Math.max(0,deadline-Date.now())));
  }
  async function poll(){
    if(disposed||polling||document.hidden||!['waiting','scanned'].includes(state))return;
    if(Date.now()>=deadline){expired();return;}
    polling=true;const token=revision,abort=new AbortController();pollRequest=abort;
    try{
      const result=await request('poll',{},abort.signal);if(disposed||token!==revision)return;
      if(result.state==='ready'){await ready(result);return;}
      if(!['waiting','scanned'].includes(result.state)){expired();return;}
      state=result.state;pollAfter=Math.max(3000,Math.min(15000,(Number(result.pollAfter)||3)*1000));
      say(state==='scanned'?'已扫码，请在米游社 App 确认。':'等待米游社 App 扫码…',state==='scanned'?'Scanned. Confirm in the Miyoushe app.':'Waiting for a scan in the Miyoushe app…');paint();
    }catch(error){if(token===revision&&!disposed&&error.name!=='AbortError'){if(error.status===401){expired();return;}if(stopForError(error))return;if(error.code==='rate_limit')pollAfter=15000;say(...(errorText(error)||['暂时无法读取扫码状态，将继续重试。','The scan status is temporarily unavailable. Retrying.']));}}
    finally{if(pollRequest===abort)pollRequest=null;polling=false;if(token===revision)schedulePoll();}
  }
  async function startLogin(){
    if(disposed||['starting','waiting','scanned','signing_out','ready'].includes(state))return;
    invalidate();const token=revision,abort=new AbortController();authRequest=abort;state='starting';say('正在获取官方登录二维码…','Requesting the official sign-in QR code…');paint();
    try{
      const result=await request('login',{},abort.signal);if(disposed||token!==revision)return;
      if(result.state==='ready'){await ready(result);return;}
      if(result.state!=='waiting'||typeof result.qrSvg!=='string'||!result.qrSvg.trim().startsWith('<'))throw Error('qr');
      qrObjectUrl=URL.createObjectURL(new Blob([result.qrSvg],{type:'image/svg+xml'}));qrImage.src=qrObjectUrl;
      deadline=Math.min(Date.now()+180000,expiresAt(result.expiresAt));pollAfter=Math.max(3000,Math.min(15000,(Number(result.pollAfter)||3)*1000));
      state='waiting';expiryTimer=setTimeout(expired,Math.max(0,deadline-Date.now()));say('等待米游社 App 扫码…','Waiting for a scan in the Miyoushe app…');paint();schedulePoll();
    }catch(error){if(token===revision&&!disposed&&error.name!=='AbortError'){if(stopForError(error))return;clearQr();state='signed_out';say(...(errorText(error)||['暂时无法获取二维码，请稍后重试。','The QR code is unavailable. Please try again.']));paint();}}
    finally{if(authRequest===abort)authRequest=null;}
  }
  async function signOut(){
    if(disposed||state==='signing_out')return;
    invalidate();const token=revision,abort=new AbortController();authRequest=abort;state='signing_out';say('正在结束登录会话…','Ending the sign-in session…');paint();
    try{await request('logout',{},abort.signal);if(disposed||token!==revision)return;accounts=[];agents=[];uid='';agentId='';picker.setAgents([]);state='signed_out';say('已退出；当前规划配装保留。','Signed out. Your current planning build is kept.');paint();}
    catch(error){if(token===revision&&!disposed&&error.name!=='AbortError'){state='logout_error';say('未能结束登录会话，请重试退出。','The session could not be ended. Retry sign out.');paint();}}
    finally{if(authRequest===abort)authRequest=null;}
  }
  async function ready(result){
    stopPolling();clearQr();accounts=Array.isArray(result.accounts)?result.accounts.filter(a=>a&&a.uid&&a.region):[];state='ready';
    accountSelect.replaceChildren();
    for(const account of accounts){const option=node('option');option.value=String(account.uid);option.textContent=`${account.nickname||account.uid} · ${account.uid}`;option.dataset.i18nSkip='';accountSelect.append(option);}
    uid=accounts.some(a=>String(a.uid)===uid)?uid:String(accounts[0]?.uid||'');accountSelect.value=uid;agentId='';agents=[];picker.setAgents([]);paint();
    if(uid)await loadAgents();else say('此登录下未找到国服游戏账号。','No China-server game account was found for this sign-in.');
  }
  function dataError(error){
    if(error.status===401){invalidate();accounts=[];agents=[];uid='';agentId='';picker.setAgents([]);state='expired';say('登录已过期，请重新扫码。','Your session expired. Scan again.');}
    else say(...(errorText(error)||['同步未完成，当前规划配装保留。请重试。','Sync did not complete. Your current build is kept. Please retry.']));
  }
  async function loadAgents(){
    if(disposed||state!=='ready'||!uid)return;
    stopData();const token=dataRevision,abort=new AbortController();dataRequest=abort;dataBusy=true;loadingAgents=true;agents=[];agentId='';picker.setAgents([]);
    say('正在读取自己的角色列表…','Loading your agent roster…');paint();
    try{
      const result=await request('agents',{uid},abort.signal);if(disposed||token!==dataRevision)return;
      agents=Array.isArray(result.agents)?result.agents.filter(a=>a&&a.id):[];
      const current=String(getAgentId()||'');agentId=agents.some(a=>String(a.id)===current)?current:'';dataBusy=false;loadingAgents=false;picker.setAgents(agents);picker.setValue(agentId);paint();
      if(agentId&&!restoredBuild)await loadEquipment();else if(agentId)say('已恢复登录，当前配装保留；点击同步更新。','Sign-in restored. Your current build is kept; click Sync to update it.');else say(agents.length?'选择角色以同步配装。':'未找到可同步的角色。',agents.length?'Choose an agent to sync equipment.':'No agents are available to sync.');
    }catch(error){if(token===dataRevision&&!disposed&&error.name!=='AbortError'){dataError(error);}}
    finally{if(token===dataRevision){dataRequest=null;dataBusy=false;loadingAgents=false;paint();}}
  }
  async function loadEquipment(){
    if(disposed||state!=='ready'||!uid||!agentId||loadingAgents)return;
    restoredBuild=false;stopData();const token=dataRevision,abort=new AbortController(),requestedAgent=agentId;dataRequest=abort;dataBusy=true;say('正在同步配装…','Syncing equipment…');paint();
    try{
      const result=await request('equipment',{uid,agentId:requestedAgent},abort.signal);if(disposed||token!==dataRevision)return;
      if(!result.agent||result.source!=='miyoushe')throw Error('equipment');
      await onImport(result.agent,{source:result.source,fetchedAt:result.fetchedAt,uid,agentId:requestedAgent});
      if(disposed||token!==dataRevision)return;
      say('已同步；规划按 60 级满突破、核心 F 计算。','Synced. Planning uses Lv.60, full promotion, and Core Skill F.');
    }catch(error){if(token===dataRevision&&!disposed&&error.name!=='AbortError')dataError(error);}
    finally{if(token===dataRevision){dataRequest=null;dataBusy=false;paint();}}
  }
  async function checkStatus(){
    if(disposed)return;invalidate();const token=revision,abort=new AbortController();authRequest=abort;state='checking';say('正在检查登录状态…','Checking sign-in status…');paint();
    try{const result=await request('status',{},abort.signal);if(disposed||token!==revision)return;if(result.state==='ready')await ready(result);else{state='signed_out';say('','');paint();}}
    catch(error){if(token===revision&&!disposed&&error.name!=='AbortError'){state='unavailable';say('同步服务暂不可用，仍可使用下方公开展柜。','Sync is temporarily unavailable. The public showcase below is still available.');paint();}}
    finally{if(authRequest===abort)authRequest=null;}
  }
  accountSelect.onchange=()=>{uid=accountSelect.value;loadAgents();};
  const visibility=()=>{if(document.hidden){clearTimeout(pollTimer);pollTimer=0;pollRequest?.abort();}else schedulePoll(0);};
  const destroy=()=>{if(disposed)return;disposed=true;invalidate();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',destroy);picker.destroy();};
  document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',destroy);checkStatus();return destroy;
}

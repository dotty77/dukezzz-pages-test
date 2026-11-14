import {createAgentPicker} from './sync-agent-picker.js?v=20261107-agent-picker-1';
import {createMiyousheBookmark} from './mys-bookmark.js?v=20261114-refresh-launch-1';

const OFFICIAL_ORIGIN='https://act.mihoyo.com';
const CHANNEL='duke-miyoushe-web-sync-v1';
const randomId=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),value=>value.toString(16).padStart(2,'0')).join('');
const identifier=value=>(typeof value==='string'||(typeof value==='number'&&Number.isSafeInteger(value)))&&/^[1-9]\d{0,9}$/.test(String(value));

// Equipment travels between the two browser windows; this receiver reads no credentials.
export function mountMiyousheBrowserSync(root,{getAgentId,getAgentName=()=>'',onImport,restoredBuild=false}){
  if(!root)return ()=>{};
  const match=/^#miyoushe-sync=([0-9a-f]{32})$/.exec(location.hash);
  let nonce=match?.[1]||'',sourceWindow=match?window.opener:null,openedOfficial=null;
  if(match)history.replaceState(history.state,'',location.pathname+location.search);
  let state='idle',pending=null,handshakeId='',connected=false,accounts=[],agents=[],uid='',agentId='',loadingAgents=false;
  let readyTimer=0,requestTimer=0,idleTimer=0,disposed=false;
  const node=(tag,cls='')=>{const n=document.createElement(tag);n.className=cls;return n;};
  const text=(n,zh,en)=>{n.textContent=zh;n.dataset.i18nEn=en;return n;};
  const label=(tag,zh,en,cls='')=>text(node(tag,cls),zh,en);
  const button=(zh,en,handler,cls='')=>{const n=label('button',zh,en,cls);n.type='button';n.onclick=handler;return n;};
  const heading=node('div','hoyolab-sync-head'),title=node('div'),actions=node('div','hoyolab-sync-actions');
  title.append(label('h2','国服官方网页同步','Official web sync · China servers'),label('p','目前只支持电脑网页使用，手机网页暂不支持。','Currently supported on desktop browsers only. Mobile browsers are not supported yet.','hoyolab-sync-support'));
  const retry=button('重新连接','Reconnect',connect);retry.dataset.action='reconnect';
  const disconnect=button('断开连接','Disconnect',()=>endConnection('manual'));disconnect.dataset.action='disconnect';actions.append(retry,disconnect);heading.append(title,actions);
  const setup=node('details','hoyolab-sync-setup');setup.open=!restoredBuild;setup.append(label('summary','首次使用：三步同步','First use: connect in three steps'));
  const steps=node('ol');
  const first=node('li');first.append(label('span','将这个链接拖到浏览器书签栏：','Drag this link to your bookmarks bar: '));
  const localPreview=location.hostname==='localhost'||location.hostname==='127.0.0.1';
  const bookmark=label('a',localPreview?'DUKE 国服同步 · 本地测试':'DUKE 国服同步 · 正式站',localPreview?'DUKE CN sync · Local preview':'DUKE CN sync · Live site','hoyolab-sync-bookmark');bookmark.href=createMiyousheBookmark(location.origin);bookmark.draggable=true;
  bookmark.onclick=event=>{event.preventDefault();say('请将链接拖到书签栏，再到官方页面点击该书签。','Drag the link to your bookmarks bar, then click that bookmark on the official page.');};first.append(bookmark);
  const second=node('li'),official=label('a','打开国服官方养成指南并登录 ↗','Open the official China-server character builder and sign in ↗');official.href='https://act.mihoyo.com/zzz/gt/character-builder-h/index.html';official.target='_blank';official.rel='opener';official.dataset.action='open-official';
  official.onclick=event=>{
    event.preventDefault();
    if(openedOfficial&&!openedOfficial.closed){openedOfficial.focus();return;}
    openedOfficial=window.open(official.href,'_blank');
    if(!openedOfficial)say('请允许弹出官方页面后重试。','Allow the official page to open, then try again.');
    else say('登录后点击新书签，配装会回到此页。','After signing in, use the new bookmark to return the build to this page.');
  };second.append(official);
  const third=label('li','旧国服书签请替换。在官方页点击新书签，优先返回此页；无法返回时会打开连接页。','Replace your old China-server bookmark. Use the new bookmark on the official page to return here; if this tab is unavailable, a connection page opens.');steps.append(first,second,third);setup.append(steps);
  const privacy=label('p','登录与验证由你在官方页面完成；密码、Cookie 和登录凭据不传给本站，仅同步所选角色的配装。闲置 10 分钟后断开。','Sign-in and verification stay on the official page. DUKE receives no password, cookies, or sign-in credentials, and syncs only the selected agent’s equipment. The connection ends after 10 idle minutes.','hoyolab-sync-privacy');
  const fields=node('div','hoyolab-sync-fields'),accountField=node('div'),agentField=node('div');
  const accountLabel=label('label','游戏账号','Game account'),agentLabel=label('label','代理人','Agent'),accountSelect=node('select');
  const picker=createAgentPicker({id:'mys-web-sync-agent',getAgentName,onChange:value=>{agentId=value;if(agentId)loadEquipment();else{clearPending();paint();}}});
  accountSelect.id='mys-web-sync-account';accountLabel.htmlFor=accountSelect.id;agentLabel.htmlFor=picker.input.id;accountField.append(accountLabel,accountSelect);agentField.append(agentLabel,picker.element);
  const sync=button('同步配装','Sync equipment',()=>agents.length?loadEquipment():loadAgents(),'primary-button');sync.dataset.action='sync';fields.append(accountField,agentField,sync);
  const status=node('p','hoyolab-sync-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');root.replaceChildren(heading,setup,privacy,fields,status);
  const say=(zh,en)=>status.replaceChildren(label('span',zh,en));
  function paint(){
    root.dataset.state=state;root.setAttribute('aria-busy',String(Boolean(pending)));
    retry.hidden=!['error','timeout'].includes(state)||!nonce||!sourceWindow;
    disconnect.hidden=!['connecting','ready','error'].includes(state)||!nonce||!sourceWindow;
    fields.hidden=state!=='ready';accountSelect.disabled=state!=='ready'||Boolean(pending)||accounts.length<2;picker.setDisabled(state!=='ready'||Boolean(pending)||loadingAgents||!agents.length);
    text(sync,agents.length?'同步配装':'重试读取',agents.length?'Sync equipment':'Retry roster');sync.disabled=Boolean(pending)||!uid||(!agentId&&agents.length>0);
  }
  function clearPending(){clearTimeout(requestTimer);requestTimer=0;pending=null;}
  function stopTimers(){clearTimeout(readyTimer);clearTimeout(idleTimer);readyTimer=0;idleTimer=0;clearPending();}
  function keepAlive(){clearTimeout(idleTimer);idleTimer=setTimeout(()=>endConnection('idle'),600000);}
  function send(message){
    if(disposed||!sourceWindow||!nonce||sourceWindow.closed)return false;
    try{sourceWindow.postMessage({channel:CHANNEL,nonce,protocol:2,...message},OFFICIAL_ORIGIN);return true;}catch{return false;}
  }
  function endConnection(reason,notify=true){
    if(notify)send({type:'disconnect',requestId:randomId()});stopTimers();connected=false;handshakeId='';state='closed';setup.open=true;paint();
    say(reason==='idle'?'连接因闲置已结束；请回官方页面再次点击书签。当前配装保留。':'连接已断开；当前配装保留。需要同步时回官方页面再次点击书签。',reason==='idle'?'The idle connection ended. Click the bookmark again on the official page; your current build is kept.':'Disconnected. Your current build is kept. Click the bookmark again on the official page to reconnect.');
  }
  function timeout(){
    clearTimeout(readyTimer);readyTimer=0;clearPending();state='timeout';paint();
    say('连接超时。请保持官方页面打开，确认已登录后重试；也可重新点击官方页书签。','The connection timed out. Keep the official page open, sign in, and retry, or click the bookmark there again.');
  }
  function announceReady(){
    if(disposed||state!=='connecting'||connected)return;
    if(!send({type:'ready',requestId:handshakeId})){timeout();return;}
    readyTimer=setTimeout(announceReady,1000);
  }
  function connect(){
    if(disposed||state==='connecting'||!nonce||!sourceWindow)return;
    stopTimers();connected=false;handshakeId=randomId();pending={type:'handshake',requestId:handshakeId};state='connecting';
    say('正在连接官方页面…','Connecting to the official page…');paint();requestTimer=setTimeout(timeout,30000);announceReady();
  }
  function request(type,details){
    clearPending();const requestId=randomId();pending={type,requestId,...details};requestTimer=setTimeout(timeout,30000);keepAlive();paint();
    if(!send({type,requestId,...details}))timeout();
  }
  function loadAgents(){
    if(state!=='ready'||!uid)return;
    agents=[];agentId='';picker.setAgents([]);loadingAgents=true;say('正在读取自己的角色列表…','Loading your agent roster…');request('agents',{uid});
  }
  function loadEquipment(){
    if(state!=='ready'||!uid||!agentId||loadingAgents)return;
    restoredBuild=false;
    say('正在同步配装…','Syncing equipment…');request('equipment',{uid,agentId});
  }
  function diagnosticId(error,requestType){
    const stageForRequest={handshake:'list_accounts',agents:'list_agents',equipment:'read_equipment'};
    if(!Object.hasOwn(stageForRequest,requestType)||error.stage!==stageForRequest[requestType]||!Number.isInteger(error.officialCode))return '';
    const verification=error.code==='verification_required'&&[10035,5003,10041,1034,-3101,-3102].includes(error.officialCode);
    const limited=error.code==='rate_limit'&&error.officialCode===10101;
    return verification||limited?`MYS/${error.stage}/${error.officialCode}`:'';
  }
  function showError(code,details={},requestType=''){
    const notices={
      official_page_changed:['官方养成指南尚未加载完成或版本已变化，请刷新官方页面后使用新版国服书签。','The official character builder is still loading or its version has changed. Refresh it and use the latest China-server bookmark.'],
      login_required:['请本人先在国服官方养成指南登录，再重试连接。','Sign in on the official China-server character builder, then reconnect.'],
      verification_required:['官方要求额外验证，请本人在官方页面查看并处理；若没有验证入口，请稍后再试。原配装保留。','Official verification is required. Review it yourself on the official page; if no verification prompt is available, try again later. Your current build is kept.'],
      data_private:['战绩隐私设置暂未允许读取，请在米游社调整后重试。','Battle-record privacy settings prevent access. Adjust them in Miyoushe, then retry.'],
      no_account:['该登录下未找到国服游戏账号。','No China-server game account was found for this sign-in.'],
      no_cn_account:['该登录下未找到国服游戏账号。','No China-server game account was found for this sign-in.'],
      account_not_bound:['所选游戏账号不属于当前官方登录，请重新连接。','The selected game account is not linked to this official sign-in. Reconnect.'],
      agent_not_owned:['所选角色不在当前账号列表中，请重新选择。','The selected agent is not in this account’s roster. Select another agent.'],
      rate_limit:['读取较频繁，请稍后重试。','Too many requests. Please retry later.'],
      'official-equipment-rarity':['目前仅支持 S 级驱动盘，原配装保留。','Only S-Rank discs are supported. Your current build is kept.'],
      'official-equipment-initial':['无法确认驱动盘初始词条数，原配装保留。','The initial substat count could not be verified. Your current build is kept.']
    };
    const notice=Object.hasOwn(notices,code)?notices[code]:['同步未完成，当前配装保留。请在官方页面核对后重试。','Sync did not complete. Your current build is kept. Check the official page and retry.'];
    const id=diagnosticId({...details,code},requestType);
    say(...(id?[notice[0]+' 反馈编号：'+id,notice[1]+' Reference: '+id]:notice));
  }
  function outdatedBookmark(source,oldNonce){
    stopTimers();connected=false;state='outdated';setup.open=true;
    try{source.postMessage({channel:CHANNEL,nonce:oldNonce,type:'disconnect',requestId:randomId(),protocol:2},OFFICIAL_ORIGIN);}catch{}
    say('请将本页新的“DUKE 国服同步”重新拖到书签栏，替换旧书签，再到官方养成指南点击。','Replace your saved China-server bookmark with the new link on this page, then use it on the official character builder.');paint();
  }
  async function receive(event){
    if(disposed||event.origin!==OFFICIAL_ORIGIN)return;
    const message=event.data;if(!message||typeof message!=='object'||Array.isArray(message)||message.channel!==CHANNEL)return;
    if(message.type==='offer'){
      // The official page must be one this receiver opened or already authenticated.
      if(!event.source||(event.source!==openedOfficial&&event.source!==sourceWindow)||typeof message.nonce!=='string'||!/^([0-9a-f]{32})$/.test(message.nonce)||message.nonce===nonce)return;
      if(message.protocol!==2){outdatedBookmark(event.source,message.nonce);return;}
      stopTimers();if(sourceWindow&&sourceWindow!==event.source)send({type:'disconnect',requestId:randomId()});
      sourceWindow=event.source;nonce=message.nonce;state='idle';connected=false;
      accounts=[];agents=[];uid='';agentId='';loadingAgents=false;picker.setAgents([]);accountSelect.replaceChildren();connect();return;
    }
    if(event.source!==sourceWindow||message.nonce!==nonce||state==='outdated')return;
    if(message.protocol!==2){outdatedBookmark(event.source,nonce);return;}
    if(message.type==='disconnected'){endConnection('remote',false);return;}
    if(!pending||message.requestId!==pending.requestId)return;
    const expected=pending;
    if(message.type==='connected'&&expected.type==='handshake'){
      connected=true;clearTimeout(readyTimer);readyTimer=0;keepAlive();say('已连接，正在读取官方账号…','Connected. Loading your official accounts…');return;
    }
    if(message.type==='error'){
      clearPending();clearTimeout(readyTimer);readyTimer=0;loadingAgents=false;
      if(expected.type==='handshake')state='error';showError(typeof message.code==='string'?message.code:'unknown',message,expected.type);paint();return;
    }
    if(message.type==='accounts'&&expected.type==='handshake'){
      clearPending();clearTimeout(readyTimer);readyTimer=0;connected=true;state='ready';keepAlive();accounts=Array.isArray(message.accounts)?message.accounts.filter(account=>account&&identifier(account.uid)&&['prod_gf_cn','prod_qd_cn'].includes(account.region)):[];
      accountSelect.replaceChildren();for(const account of accounts){const option=node('option');option.value=String(account.uid);option.textContent=`${account.nickname||account.uid} · ${account.uid}`;option.dataset.i18nSkip='';accountSelect.append(option);}
      uid=String(accounts[0]?.uid||'');accountSelect.value=uid;agents=[];agentId='';picker.setAgents([]);setup.open=false;paint();
      if(uid)loadAgents();else showError('no_account');return;
    }
    if(message.type==='agents'&&expected.type==='agents'&&String(message.uid)===expected.uid){
      clearPending();keepAlive();loadingAgents=false;agents=Array.isArray(message.agents)?message.agents.filter(agent=>agent&&identifier(agent.id)):[];
      const current=String(getAgentId()||'');agentId=agents.some(agent=>String(agent.id)===current)?current:'';picker.setAgents(agents);picker.setValue(agentId);paint();
      if(agentId&&!restoredBuild)loadEquipment();else if(restoredBuild&&agentId)say('已连接；上次配装保留，点击同步配装更新。','Connected. Your saved build is kept; choose Sync equipment to update it.');else say(agents.length?'选择角色以同步配装。':'未找到可同步的角色。',agents.length?'Choose an agent to sync equipment.':'No agents are available to sync.');return;
    }
    if(message.type==='equipment'&&expected.type==='equipment'&&String(message.uid)===expected.uid&&String(message.agentId)===expected.agentId){
      if(!message.agent||typeof message.agent!=='object'||Array.isArray(message.agent)||String(message.agent.id)!==expected.agentId)return;
      clearPending();keepAlive();paint();
      try{await onImport(message.agent,{source:'miyoushe',uid:expected.uid,agentId:expected.agentId});say('已同步；规划按 60 级满突破、核心 F 计算。','Synced. Planning uses Lv.60, full promotion, and Core Skill F.');}
      catch(error){showError(error.code);}return;
    }
  }
  accountSelect.onchange=()=>{uid=accountSelect.value;loadAgents();};
  const destroy=()=>{if(disposed)return;send({type:'disconnect',requestId:randomId()});disposed=true;stopTimers();window.removeEventListener('message',receive);window.removeEventListener('pagehide',destroy);picker.destroy();};
  window.addEventListener('message',receive);window.addEventListener('pagehide',destroy);paint();
  if(nonce&&sourceWindow)connect();else if(nonce)say('连接需要从官方页面的书签打开，请按上方步骤重试。','Open this connection from the bookmark on the official page. Follow the steps above.');else if(restoredBuild)say('已恢复上次配装，可直接继续规划；更新游戏配装时再连接。','Your last build was restored. Continue planning, or reconnect to update equipment from the game.');
  return destroy;
}

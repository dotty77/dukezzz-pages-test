import {createAgentPicker} from './sync-agent-picker.js?v=20261107-refresh-launch-1';
import {createHoyolabBookmark} from './hoyolab-bookmark.js?v=20261114-direct-tools-1';

const OFFICIAL_ORIGIN='https://act.hoyolab.com';
const CHANNEL='duke-hoyolab-sync-v1';
const randomId=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),value=>value.toString(16).padStart(2,'0')).join('');

// Equipment travels between the two browser windows; this receiver reads no credentials.
export function mountHoyolabSync(root,{getAgentId,getAgentName=()=>'',onImport,restoredBuild=false}){
  if(!root)return ()=>{};
  const githubTest=location.origin==='https://dotty77.github.io'&&location.pathname==='/dukezzz-pages-test/disc-planner.html';
  const knownOrigin=['https://dukezzz.com', 'https://www.dukezzz.com', 'http://127.0.0.1:8877', 'http://localhost:8877'].includes(location.origin);
  if(!githubTest&&(!knownOrigin||!['/disc-planner','/disc-planner.html'].includes(location.pathname)))return ()=>{};
  const targetBase=githubTest?'https://dotty77.github.io/dukezzz-pages-test/':location.origin+'/';
  const bookmarkTarget=githubTest?targetBase:location.origin;
  const matchesTarget=message=>message.targetBase===targetBase||(!githubTest&&message.targetBase===undefined);
  const match=/^#hoyolab-sync=([0-9a-f]{32})$/.exec(location.hash);
  let nonce=match?.[1]||'',sourceWindow=match?window.opener:null,openedOfficial=null;
  if(match)history.replaceState(history.state,'',location.pathname+location.search);
  let state='idle',pending=null,handshakeId='',connected=false,accounts=[],agents=[],uid='',agentId='',loadingAgents=false;
  let readyTimer=0,requestTimer=0,idleTimer=0,disposed=false;
  const node=(tag,cls='')=>{const n=document.createElement(tag);n.className=cls;return n;};
  const text=(n,zh,en)=>{n.textContent=zh;n.dataset.i18nEn=en;return n;};
  const label=(tag,zh,en,cls='')=>text(node(tag,cls),zh,en);
  const button=(zh,en,handler,cls='')=>{const n=label('button',zh,en,cls);n.type='button';n.onclick=handler;return n;};
  const heading=node('div','hoyolab-sync-head'),title=node('div'),actions=node('div','hoyolab-sync-actions');
  title.append(label('h2','HoYoLAB 同步（国际服）','HoYoLAB sync · Global servers'),label('p','目前只支持电脑网页使用，手机网页暂不支持。','Currently supported on desktop browsers only. Mobile browsers are not supported yet.','hoyolab-sync-support'));
  const retry=button('重新连接','Reconnect',connect);retry.dataset.action='reconnect';
  const disconnect=button('断开连接','Disconnect',()=>endConnection('manual'));disconnect.dataset.action='disconnect';actions.append(retry,disconnect);heading.append(title,actions);
  const setup=node('details','hoyolab-sync-setup');setup.open=!restoredBuild;setup.append(label('summary','首次使用：三步同步','First use: connect in three steps'));
  const steps=node('ol');
  const first=node('li');first.append(label('span','将这个链接拖到浏览器书签栏：','Drag this link to your bookmarks bar: '));
  const localPreview=location.hostname==='localhost'||location.hostname==='127.0.0.1';
  const bookmark=label('a',githubTest?'DUKE 国际服同步 · GitHub 试站':localPreview?'DUKE 同步配装 · 本地测试':'DUKE 同步配装 · 正式站',githubTest?'DUKE Global sync · GitHub test site':localPreview?'DUKE sync · Local preview':'DUKE sync · Live site','hoyolab-sync-bookmark');bookmark.href=createHoyolabBookmark(bookmarkTarget);bookmark.draggable=true;
  bookmark.onclick=event=>{event.preventDefault();say('请将链接拖到书签栏，再到官方页面点击该书签。','Drag the link to your bookmarks bar, then click that bookmark on the official page.');};first.append(bookmark);
  if(githubTest)first.append(label('p','请从本试站重新保存这份书签；旧正式站书签仍会返回正式站。','Save this bookmark again from the GitHub test site. An old main-site bookmark still returns to the main site.'));
  const second=node('li'),official=label('a','从这里打开官方养成指南并登录 ↗','Open the official character builder from here and sign in ↗');official.href='https://act.hoyolab.com/zzz/gt/character-builder-h/index.html?lang=en-us#/';official.target='_blank';official.rel='opener';official.dataset.action='open-official';
  official.onclick=event=>{
    event.preventDefault();
    if(openedOfficial&&!openedOfficial.closed){openedOfficial.focus();return;}
    openedOfficial=window.open(official.href,'_blank');
    if(!openedOfficial)say('请允许弹出官方页面后重试。','Allow the official page to open, then try again.');
    else say('登录后点击新书签，配装会回到此页。','After signing in, use the new bookmark to return the build to this page.');
  };second.append(official);
  const third=label('li','在官方页点击新书签，优先返回此页。旧书签请替换；无法返回时会打开连接页。','Use the new bookmark on the official page to return here. Replace old bookmarks; if this tab is unavailable, a connection page opens.');steps.append(first,second,third);setup.append(steps);
  const privacy=label('p','密码留在官方页面；本站不接收登录凭据，仅同步所选角色的配装。闲置 10 分钟后断开。','Your password stays on the official page. DUKE receives no sign-in credentials and syncs only the selected agent’s equipment. The connection ends after 10 idle minutes.','hoyolab-sync-privacy');
  const fields=node('div','hoyolab-sync-fields'),accountField=node('div'),agentField=node('div');
  const accountLabel=label('label','游戏账号','Game account'),agentLabel=label('label','代理人','Agent'),accountSelect=node('select');
  const picker=createAgentPicker({id:'hoyolab-sync-agent',getAgentName,onChange:value=>{agentId=value;if(agentId)loadEquipment();else{clearPending();paint();}}});
  accountSelect.id='hoyolab-sync-account';accountLabel.htmlFor=accountSelect.id;agentLabel.htmlFor=picker.input.id;accountField.append(accountLabel,accountSelect);agentField.append(agentLabel,picker.element);
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
    try{sourceWindow.postMessage({channel:CHANNEL,nonce,targetBase,...message},OFFICIAL_ORIGIN);return true;}catch{return false;}
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
  function showError(code){
    const notices={
      login_required:['请先在官方养成指南登录，再重试连接。','Sign in on the official character builder, then reconnect.'],
      verification_required:['官方要求额外验证，请在官方页面完成后重试。','Official verification is required. Complete it on the official page, then retry.'],
      data_private:['战绩隐私设置暂未允许读取，请在 HoYoLAB 调整后重试。','Battle-record privacy settings prevent access. Adjust them in HoYoLAB, then retry.'],
      no_account:['该登录下未找到国际服游戏账号。','No global-server game account was found for this sign-in.'],
      no_os_account:['该登录下未找到国际服游戏账号。','No global-server game account was found for this sign-in.'],
      account_not_bound:['所选游戏账号不属于当前官方登录，请重新连接。','The selected game account is not linked to this official sign-in. Reconnect.'],
      agent_not_owned:['所选角色不在当前账号列表中，请重新选择。','The selected agent is not in this account’s roster. Select another agent.'],
      rate_limit:['读取较频繁，请稍后重试。','Too many requests. Please retry later.'],
      'official-equipment-rarity':['目前仅支持 S 级驱动盘，原配装保留。','Only S-Rank discs are supported. Your current build is kept.'],
      'official-equipment-initial':['无法确认驱动盘初始词条数，原配装保留。','The initial substat count could not be verified. Your current build is kept.']
    };
    say(...(notices[code]||['同步未完成，当前配装保留。请在官方页面核对后重试。','Sync did not complete. Your current build is kept. Check the official page and retry.']));
  }
  async function receive(event){
    if(disposed||event.origin!==OFFICIAL_ORIGIN)return;
    const message=event.data;if(!message||typeof message!=='object'||Array.isArray(message)||message.channel!==CHANNEL||!matchesTarget(message))return;
    if(message.type==='offer'){
      // The official page must be one this receiver opened or already authenticated.
      if(!event.source||(event.source!==openedOfficial&&event.source!==sourceWindow)||typeof message.nonce!=='string'||!/^([0-9a-f]{32})$/.test(message.nonce)||message.nonce===nonce)return;
      stopTimers();if(sourceWindow&&sourceWindow!==event.source)send({type:'disconnect',requestId:randomId()});
      sourceWindow=event.source;nonce=message.nonce;state='idle';connected=false;
      accounts=[];agents=[];uid='';agentId='';loadingAgents=false;picker.setAgents([]);accountSelect.replaceChildren();connect();return;
    }
    if(event.source!==sourceWindow||message.nonce!==nonce)return;
    if(message.type==='disconnected'){endConnection('remote',false);return;}
    if(!pending||message.requestId!==pending.requestId)return;
    const expected=pending;
    if(message.type==='connected'&&expected.type==='handshake'){
      connected=true;clearTimeout(readyTimer);readyTimer=0;keepAlive();say('已连接，正在读取官方账号…','Connected. Loading your official accounts…');return;
    }
    if(message.type==='error'){
      clearPending();clearTimeout(readyTimer);readyTimer=0;loadingAgents=false;
      if(expected.type==='handshake')state='error';showError(typeof message.code==='string'?message.code:'unknown');paint();return;
    }
    if(message.type==='accounts'&&expected.type==='handshake'){
      clearPending();clearTimeout(readyTimer);readyTimer=0;connected=true;state='ready';keepAlive();accounts=Array.isArray(message.accounts)?message.accounts.filter(account=>account&&account.uid&&typeof account.region==='string'):[];
      accountSelect.replaceChildren();for(const account of accounts){const option=node('option');option.value=String(account.uid);option.textContent=`${account.nickname||account.uid} · ${account.uid}`;option.dataset.i18nSkip='';accountSelect.append(option);}
      uid=String(accounts[0]?.uid||'');accountSelect.value=uid;agents=[];agentId='';picker.setAgents([]);setup.open=false;paint();
      if(uid)loadAgents();else showError('no_account');return;
    }
    if(message.type==='agents'&&expected.type==='agents'&&String(message.uid)===expected.uid){
      clearPending();keepAlive();loadingAgents=false;agents=Array.isArray(message.agents)?message.agents.filter(agent=>agent&&agent.id):[];
      const current=String(getAgentId()||'');agentId=agents.some(agent=>String(agent.id)===current)?current:'';picker.setAgents(agents);picker.setValue(agentId);paint();
      if(agentId&&!restoredBuild)loadEquipment();else if(restoredBuild&&agentId)say('已连接；上次配装保留，点击同步配装更新。','Connected. Your saved build is kept; choose Sync equipment to update it.');else say(agents.length?'选择角色以同步配装。':'未找到可同步的角色。',agents.length?'Choose an agent to sync equipment.':'No agents are available to sync.');return;
    }
    if(message.type==='equipment'&&expected.type==='equipment'&&String(message.uid)===expected.uid&&String(message.agentId)===expected.agentId){
      clearPending();keepAlive();paint();
      try{await onImport(message.agent,{source:'hoyolab',uid:expected.uid,agentId:expected.agentId});say('已同步；规划按 60 级满突破、核心 F 计算。','Synced. Planning uses Lv.60, full promotion, and Core Skill F.');}
      catch(error){showError(error.code);}return;
    }
  }
  accountSelect.onchange=()=>{uid=accountSelect.value;loadAgents();};
  const destroy=()=>{if(disposed)return;send({type:'disconnect',requestId:randomId()});disposed=true;stopTimers();window.removeEventListener('message',receive);window.removeEventListener('pagehide',destroy);picker.destroy();};
  window.addEventListener('message',receive);window.addEventListener('pagehide',destroy);paint();
  if(nonce&&sourceWindow)connect();else if(nonce)say('连接需要从官方页面的书签打开，请按上方步骤重试。','Open this connection from the bookmark on the official page. Follow the steps above.');else if(restoredBuild)say('已恢复上次配装，可直接继续规划；更新游戏配装时再连接。','Your last build was restored. Continue planning, or reconnect to update equipment from the game.');
  return destroy;
}

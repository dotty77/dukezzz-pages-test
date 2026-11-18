import {BUDGET_STORAGE_KEY,BUDGET_POOLS,newBudget,budgetScope,calculateBudget,snapshotPool,recordFingerprint,restoreBudget,recordedWallet,applyRecordedWallet} from './tuning-personal-budget-core.js?v=20261118-tuning-records-launch-1';
import {guaranteeState} from './tuning-summary.js?v=20261118-tuning-records-launch-1';
import {EXPECTATION_SOURCES} from './tuning-expectation.js?v=20260909-version-3-2-1';

// This self-contained bilingual component owns its text. Numeric values and drafts
// never enter DOM translation, and switching language does not reset the plan.
export const PERSONAL_BUDGET_COPY = {
  title:['个人抽卡预算','Personal Pull Budget'],
  kicker:['先算手里的资源，再定目标','Your resources. Your next target.'],
  intro:['按资源和当前保底，查看目标最坏还差多少。','Plan your target’s worst-case shortfall from your resources and current pity.'],
  scopeShort:['仅普通独家／音擎频段 · 最坏上限，非出货概率','Standard Exclusive / W-Engine Channels only · worst-case ceiling, not success probability'],
  manual:['手动预算 · 未选择账号','Manual plan · no account selected'],
  demo:['虚构示例 · 预算独立，不写入真实账号','Fictional demo · isolated from your real account'],
  account:['当前账号','Current account'],
  saved:['自动保存在当前浏览器 · 不上传账号、资源或记录','Saved in this browser · no account, wallet, or records are uploaded'],
  storageError:['预算无法保存到浏览器；本次仍可计算，关闭页面后可能丢失。','Browser storage is unavailable. You can still calculate, but this plan may be lost when you close the page.'],
  corrupt:['之前保存的预算无法读取，已显示空白预算；未改动调频记录。','The saved budget could not be read. A fresh plan is shown; your Signal Search records are unchanged.'],
  wallet:['共用资源','Shared wallet'],polychrome:['已有菲林','Polychrome owned'],tapes:['已有加密母带','Encrypted Master Tapes owned'],
  walletNote:['角色和音擎共用这一份资源。160 菲林 = 1 抽；不计普通母带、邦布券、未领取奖励及未来余波返还。','Agents and W-Engines share this wallet. 160 Polychrome = 1 pull. Master Tapes, Boopons, unclaimed rewards, and future Residual Signal refunds are excluded.'],
  walletHelp:['资源怎么算','How resources are counted'],targetHelp:['目标与份数说明','Target and copy counts'],ownedHelp:['已拥有目标？','Already own the target?'],breakdown:['查看分池明细','View channel breakdown'],
  target:['这次想达到','Target configuration'],mindscape:['目标影画','Target Mindscape Cinema'],refinement:['目标专武叠影','Target signature W-Engine Phase'],
  ownedCharacter:['已拥有该角色的本体份数','Copies of this Agent already owned'],ownedWeapon:['已拥有该专武的份数','Copies of this signature W-Engine already owned'],
  copies:['份','copies'],none:['未拥有','Not owned'],noWeapon:['不抽专武','No signature W-Engine'],
  notation:['0+0 = 1 个角色本体、不抽专武；6+5 = 7 个本体、5 把专武。已有份数只填这次目标，已用来激活影画或叠影的也要算；不从不完整记录猜持有量。','0+0 means one Agent and no signature W-Engine; 6+5 means seven Agent copies and five signature W-Engine copies. Count only your chosen target, including copies already used for Mindscape Cinema or Enhancement. Ownership is not inferred from incomplete records.'],
  history:['当前保底','Current pity'],read:['读取当前账号已导入记录','Read the selected account’s records'],
  confirm:['我已确认导入区间连续、没有缺页，并更新到最近一次调频。','I have confirmed the imported records are continuous, have no missing pages, and include my latest pull.'],
  readNote:['只读取垫抽和保底状态，不改资源、目标或已有份数。','Reads pity and guarantee states only; your wallet, target, and owned copies stay unchanged.'],
  readDisabled:['先选择账号，并勾选记录完整性确认。','Select an account and confirm record completeness first.'],
  noHistory:['没有记录也能手动规划；请按游戏内实际情况填写。','You can plan without imported records. Enter your actual in-game state manually.'],
  character:['普通独家频段 · 代理人','Standard Exclusive Channel · Agent'],weapon:['普通音擎频段 · 专武','Standard W-Engine Channel · signature W-Engine'],
  pity:['距上次 S 级已抽','Pulls since the last S-Rank'],unknownPity:['不确定时留空','Leave blank if unknown'],
  guarantee:['下次 S 级状态','Next S-Rank guarantee'],unknown:['未知 · 分情景计算','Unknown · calculate both scenarios'],small:['小保底 · 可能歪','Not guaranteed · may lose the featured roll'],big:['大保底 · 必为 UP','Guaranteed featured S-Rank'],
  smallShort:['若为小保底','If not guaranteed'],bigShort:['若为大保底','If guaranteed'],
  manualEvidence:['手动填写','Entered manually'],
  readEvidence:['已读取记录 · 仅截至最后导入的调频','Read from records · valid only as of your latest imported pull'],
  missing:['此池没有记录，垫抽与保证均保留未知。','No records for this channel; pity and guarantee remain unknown.'],
  incomplete:['此池证据不足；能确认的字段已读取，其余保留未知。','This channel has incomplete evidence. Verified fields were read; the rest remain unknown.'],
  conflict:['此池记录存在矛盾，垫抽与保证均保留未知。','This channel has conflicting records; pity and guarantee remain unknown.'],
  stale:['当前记录已变化，之前读入的保底字段已按未知处理。重新确认并读取记录，或手动修改对应字段。','The selected records have changed. Previously imported pity fields are treated as unknown. Confirm and read the updated records, or edit those fields manually.'],
  copied:['已读取两池状态；资源、目标和已有份数保持不变。','Both channel states were read. Your wallet, target, and owned copies are unchanged.'],
  required:['保证拿齐，最多再准备','To guarantee the target, allow up to'],pulls:['抽','pulls'],
  uncertain:['状态未知时，上限会随实际保底不同而变化。下列范围是“最坏上限的范围”，不是实际抽数区间或成功率。保守预算取右端。','With unknown pity, the ceiling depends on your actual state. This is a range of worst-case ceilings, not a range of actual results or a success probability. Use the higher value for a conservative budget.'],
  fixed:['按所填状态，每次小保底都歪、每次 S 级都到硬保底计算。实际可能更早达成。','Calculated from your entered state, assuming every featured roll is lost when not guaranteed and every S-Rank reaches hard pity. You may finish earlier.'],
  uncertainShort:['保底未知，按不同情景给出上限范围；保守预算取右端。','Unknown pity gives a range of scenario ceilings. Use the higher value for a conservative budget.'],
  fixedShort:['按每次硬保底、小保底都歪计算；实际可能更早。','Assumes hard pity and losing every non-guaranteed featured roll. You may finish earlier.'],
  available:['现在能抽','Available now'],gap:['保守预算仍缺','Conservative shortfall'],chromegap:['若全部用菲林补足，还缺','If covering the shortfall with Polychrome'],
  gapRange:['因保底未知，最坏预算的缺口范围','Unknown pity gives this range of worst-case shortfalls'],
  alternate:['也可补等量加密母带；两种补足方式不叠加。','Equivalent Encrypted Master Tapes can cover it instead. These are alternative funding methods, not additive costs.'],
  enough:['已有资源覆盖最坏上限','Your wallet covers the worst-case ceiling'],done:['按已填份数，目标已经达到','Your entered ownership already meets the target'],
  remainder:['兑换整抽后剩余菲林','Polychrome left after converting whole pulls'],
  remaining:['还需目标 UP','Featured copies still needed'],ceiling:['该池最坏上限','This channel’s worst-case ceiling'],
  pityUnknownNote:['垫抽未知：按 0 至硬保底前一抽列出上下界，未把未知当成 0。','Unknown pity spans 0 through one pull before hard pity. It is not assumed to be zero.'],
  zero:['此目标无需继续抽取，不消耗本池预算。','No more copies are needed, so this channel adds no cost.'],
  method:['计算方法与适用范围','Method and scope'],
  formula:['还缺 n 份目标 UP、已垫 p 抽、硬保底 H：大保底为 H − p + 2H × (n − 1)；小保底为 2H − p + 2H × (n − 1)。n = 0 时预算为 0。','For n remaining featured copies, p pulls of pity, and hard pity H: guaranteed = H − p + 2H × (n − 1); not guaranteed = 2H − p + 2H × (n − 1). If n = 0, the cost is 0.'],
  rules:['普通独家 H = 90，出 S 级时 UP 概率 50%；普通音擎 H = 80，UP 概率 75%。歪后下一次 S 级保证 UP；抽到 UP 后下一份按小保底计算。','Standard Exclusive: H = 90, with a 50% featured S-Rank chance. Standard W-Engine: H = 80, with a 75% featured S-Rank chance. Losing guarantees the next featured S-Rank; after receiving it, the next copy is not guaranteed.'],
  exclusions:['只适用普通独家和普通音擎频段（记录类型 2 / 3）。不套用独家重映、音擎重映、常驻、邦布或其他特殊机制。请在目标 UP 开放期间抽取。','Applies only to standard Exclusive and W-Engine Channels (record types 2 / 3). Exclusive Rerun, W-Engine Rerun, Stable, Bangboo, and other special mechanics are excluded. Pull while your chosen featured target is available.'],
  noExpectation:['这里计算资源上限，不计算个人平均抽数或出货概率。官方综合概率不足以还原逐抽概率，不能用“总体平均数减当前垫抽”来充当个人期望。','This calculates a resource ceiling, not personal expected pulls or success probability. Published consolidated rates do not reveal the full per-pull distribution, so subtracting pity from a population average would not give your conditional expectation.'],
  source:['官方规则 · 2026-09-18 核对','Official rules · checked 2026-09-18'],exclusiveSource:['独家频段公示','Exclusive Channel details'],weaponSource:['音擎频段公示','W-Engine Channel details'],
  reset:['重置这份预算','Reset this plan'],resetConfirm:['重置当前预算的资源、目标和保底输入？调频原始记录不会改动。','Reset this plan’s wallet, target, and pity inputs? Your original Signal Search records will not change.'],
  invalid:['请填写有效的非负整数；垫抽应小于该池硬保底。','Enter valid non-negative integers. Pity must be below the channel’s hard-pity limit.'],
  invalidField:['输入超出允许范围','Value is outside the allowed range'],
  crossTab:['其他标签页更新了本账号预算。请重新打开本页查看；本页修改会覆盖那份预算。','Another tab updated this account’s budget. Reopen this page to view it; edits here will overwrite that saved plan.'],
};
const el=(tag,cls='',text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
const clone=value=>JSON.parse(JSON.stringify(value));

export function mountPersonalBudget(host,{onWalletChange=()=>{}}={}) {
  if(!host)return null;
  host.dataset.i18nSkip='';
  let context={account:null,stats:null,catalog:{},demo:false},scope='',draft=newBudget(),currentFingerprint='',storageNotice='',crossTab=false,confirmed=false,notice='',resultNode,inputs={},poolNotes={},contextNode,savedNode,readButton,confirmInput,ownedDetails;
  const memory=new Map();
  const disclosureStates=new Map();
  const t=key=>PERSONAL_BUDGET_COPY[key]?.[window.DUKE_I18N?.language==='en'?1:0]||key;
  const number=value=>Number(value).toLocaleString(window.DUKE_I18N?.language==='en'?'en-US':'zh-CN');
  const range=(low,high)=>low===high?number(high):`${number(low)}–${number(high)}`;
  const hasOwned=()=>Number(draft.ownedCharacter)>0||Number(draft.ownedWeapon)>0;
  function rememberDisclosures(){for(const node of host.querySelectorAll('details[data-budget-disclosure]'))disclosureStates.set(node.dataset.budgetDisclosure,node.open);}
  function disclosure(key,label,cls='personal-budget-fold',initialOpen=false){
    const node=el('details',cls),stateKey=key==='owned'?`${key}:${scope}`:key;
    node.dataset.budgetDisclosure=stateKey;node.open=disclosureStates.has(stateKey)?disclosureStates.get(stateKey):initialOpen;
    node.append(el('summary','',t(label)));node.addEventListener('toggle',()=>{if(node.isConnected)disclosureStates.set(stateKey,node.open);});return node;
  }
  function updateOwnedSummary(){
    if(!ownedDetails)return;
    const characters=number(draft.ownedCharacter),weapons=number(draft.ownedWeapon);
    ownedDetails.querySelector('summary').textContent=hasOwned()?(window.DUKE_I18N?.language==='en'?`Already owned: Agent ×${characters} · signature W-Engine ×${weapons}`:`已拥有：角色 ${characters} 份 · 专武 ${weapons} 份`):t('ownedHelp');
  }
  function scopeKey(){return BUDGET_STORAGE_KEY+':'+scope;}
  function save() {
    memory.set(scope,clone(draft));
    if(scope==='demo')return;
    try {calculateBudget(draft);localStorage.setItem(scopeKey(),JSON.stringify(draft));if(storageNotice==='storageError')storageNotice='';}
    catch(error){if(!error.field&&!(error instanceof RangeError))storageNotice='storageError';}
  }
  function load() {
    storageNotice='';crossTab=false;
    if(memory.has(scope))return clone(memory.get(scope));
    if(scope==='demo'){
      const sample=newBudget();
      applyRecordedWallet(sample,{polychrome:1412,monochrome:7487,encryptedTapes:35,masterTapes:8,boopons:24});
      return sample;
    }
    try{const raw=localStorage.getItem(scopeKey());return raw?restoreBudget(JSON.parse(raw)):newBudget();}
    catch(error){storageNotice=error instanceof SyntaxError||error instanceof TypeError||error instanceof RangeError?'corrupt':'storageError';return newBudget();}
  }
  function isStale(){return !!draft.recordSnapshot&&draft.recordSnapshot.fingerprint!==currentFingerprint;}
  function effectiveDraft(){
    const value=clone(draft);
    if(isStale())for(const kind of Object.keys(BUDGET_POOLS)){
      const flags=draft.recordSnapshot.pools[kind];
      if(flags?.pityFromRecords!==false)value.pools[kind].pity='';
      if(flags?.guaranteeFromRecords!==false)value.pools[kind].guarantee='unknown';
    }
    return value;
  }
  function field(key,label,parent,{options,min=0,max=1000000000,placeholder}={}) {
    const wrap=el('label','personal-budget-field'),caption=el('span','',t(label));
    let control;
    if(options){control=el('select');for(const [value,title]of options){const option=el('option','',title);option.value=String(value);control.append(option);}}
    else{control=el('input');control.type='number';control.min=String(min);control.max=String(max);control.step='1';control.inputMode='numeric';if(placeholder)control.placeholder=t(placeholder);}
    control.id='budget-'+key.replaceAll('.','-');control.name=key;control.autocomplete='off';
    const [kind,part]=key.split('.');control.value=part?draft.pools[kind][part]:draft[key];
    control.addEventListener('input',()=>{
      if(part){draft.pools[kind][part]=control.value;if(draft.recordSnapshot?.pools[kind])draft.recordSnapshot.pools[kind][part+'FromRecords']=false;}
      else {
        draft[key]=control.value;
        if(key==='polychrome'||key==='tapes'){
          const walletKey=key==='tapes'?'encryptedTapes':key;
          draft.recordWallet??={};
          if(control.value!==''&&control.checkValidity())draft.recordWallet[walletKey]=Number(control.value);
          else delete draft.recordWallet[walletKey];
        }
      }
      notice='';save();renderResult();
      if(key==='polychrome'||key==='tapes')onWalletChange();
    });
    inputs[key]=control;wrap.append(caption,control);parent.append(wrap);return control;
  }
  function stat(label,value,extraClass='') {const n=el('article','personal-budget-stat '+extraClass);n.append(el('span','',t(label)),el('strong','',value));return n;}
  function renderResult() {
    rememberDisclosures();updateOwnedSummary();
    for(const control of Object.values(inputs))control.removeAttribute('aria-invalid');
    contextNode.textContent=context.demo?t('demo'):context.account?t('account')+' · UID '+String(context.account.uid).slice(0,2)+'***'+String(context.account.uid).slice(-4):t('manual');
    savedNode.textContent=t(storageNotice|| (crossTab?'crossTab':'saved'));
    savedNode.classList.toggle('personal-budget-warning',!!storageNotice||crossTab);
    readButton.disabled=!context.account||!confirmed;readButton.title=readButton.disabled?t('readDisabled'):'';
    for(const kind of Object.keys(BUDGET_POOLS)){
      const snap=draft.recordSnapshot?.pools[kind];
      const active=snap&&(snap.pityFromRecords!==false||snap.guaranteeFromRecords!==false);
      poolNotes[kind].textContent=active?t(snap.reason==='records'?'readEvidence':snap.reason):t('manualEvidence');
    }
    const warnings=el('div','personal-budget-notices');
    if(isStale())warnings.append(el('p','personal-budget-warning',t('stale')));
    if(notice)warnings.append(el('p','personal-budget-notice',t(notice)));
    let result;
    try {result=calculateBudget(effectiveDraft());}
    catch(error){const control=inputs[error.field];if(control)control.setAttribute('aria-invalid','true');warnings.append(el('p','personal-budget-warning',t('invalid')));resultNode.replaceChildren(warnings);return;}
    const hero=el('div','personal-budget-result-hero');hero.append(el('span','personal-budget-eyebrow',t(result.completed?'done':'required')),el('strong','',range(result.minimum,result.maximum)+' '+t('pulls')));if(!result.completed)hero.append(el('p','',t(result.uncertain?'uncertainShort':'fixedShort')));
    const metrics=el('div','personal-budget-metrics');
    metrics.append(stat('available',number(result.available)+' '+t('pulls')),stat('gap',number(result.gapMaximum.pulls)+' '+t('pulls'),result.covered?'is-covered':''),stat('chromegap',number(result.gapMaximum.polychrome)));
    const walletNote=el('p','personal-budget-note',`${t('remainder')} ${number(result.polychromeRemainder)} · ${t('alternate')}`);
    if(result.uncertain)walletNote.append(el('br'),document.createTextNode(`${t('gapRange')}：${range(result.gapMinimum.pulls,result.gapMaximum.pulls)} ${t('pulls')} (${range(result.gapMinimum.polychrome,result.gapMaximum.polychrome)} ${window.DUKE_I18N?.language==='en'?'Polychrome':'菲林'})`));
    const breakdown=el('div','personal-budget-breakdown');
    for(const kind of Object.keys(BUDGET_POOLS)) {
      const p=result.pools[kind],card=el('article','personal-budget-breakdown-pool');
      card.dataset.budgetPool=kind;
      card.append(el('h4','',t(kind)),el('p','',`${t('remaining')} ${p.copies} · ${t('ceiling')} ${range(p.minimum,p.maximum)} ${t('pulls')}`));
      if(!p.copies)card.append(el('p','personal-budget-note',t('zero')));
      else {
        for(const scenario of p.scenarios)card.append(el('p','personal-budget-scenario',`${t(scenario.guarantee==='big'?'bigShort':'smallShort')} · ${range(scenario.minimum,scenario.maximum)} ${t('pulls')}`));
        if(p.pity===null)card.append(el('p','personal-budget-note',t('pityUnknownNote')));
      }
      breakdown.append(card);
    }
    const details=disclosure('breakdown','breakdown','personal-budget-fold personal-budget-calculation');
    details.append(el('p','personal-budget-note',t(result.uncertain?'uncertain':'fixed')),walletNote,breakdown);
    if(result.covered&&!result.completed)warnings.append(el('p','personal-budget-covered',t('enough')));
    resultNode.replaceChildren(warnings,hero,metrics,details);
    host.dataset.budgetReady='true';
  }
  function readRecords() {
    if(!context.account||!confirmed)return;
    const pools={};
    for(const kind of Object.keys(BUDGET_POOLS)){
      const pool=context.stats?.pools.find(p=>String(p.id)===BUDGET_POOLS[kind]);
      const state=snapshotPool(pool,pool?guaranteeState(context.account,pool,context.catalog):null);
      draft.pools[kind]={pity:state.pity,guarantee:state.guarantee};
      pools[kind]={reason:state.reason,lastTime:state.lastTime||null,pityFromRecords:true,guaranteeFromRecords:true};
    }
    draft.recordSnapshot={fingerprint:currentFingerprint,at:new Date().toISOString(),confirmed:true,pools};
    notice='copied';save();build();
  }
  function build() {
    rememberDisclosures();
    inputs={};poolNotes={};
    const heading=el('div','personal-budget-heading'),titles=el('div');
    const title=el('h2','',t('title'));title.id='personal-budget-title';
    titles.append(title,el('p','personal-budget-note',t('intro')),el('p','personal-budget-scope',t('scopeShort')));
    const reset=el('button','quiet-button',t('reset'));reset.type='button';reset.onclick=()=>{if(window.confirm(t('resetConfirm'))){draft=newBudget();confirmed=false;notice='';save();build();onWalletChange();}};
    heading.append(titles,reset);contextNode=el('p','personal-budget-context');savedNode=el('p','personal-budget-note');
    const grid=el('div','personal-budget-input-grid');
    const wallet=el('fieldset','personal-budget-group');wallet.append(el('legend','',t('wallet')));const walletFields=el('div','personal-budget-fields');
    field('polychrome','polychrome',walletFields);field('tapes','tapes',walletFields);const walletHelp=disclosure('wallet','walletHelp');walletHelp.append(el('p','personal-budget-note',t('walletNote')));wallet.append(walletFields,walletHelp);
    const target=el('fieldset','personal-budget-group');target.append(el('legend','',t('target')));const targetFields=el('div','personal-budget-fields');
    field('mindscape','mindscape',targetFields,{options:Array.from({length:7},(_,i)=>[i,window.DUKE_I18N?.language==='en'?`Mindscape ${i}`:`${i} 影画`])});
    field('refinement','refinement',targetFields,{options:Array.from({length:6},(_,i)=>[i,i?window.DUKE_I18N?.language==='en'?`Phase ${i}`:`叠影 ${i} 阶`:t('noWeapon')])});
    ownedDetails=disclosure('owned','ownedHelp','personal-budget-fold personal-budget-owned',hasOwned());const ownedFields=el('div','personal-budget-fields');
    field('ownedCharacter','ownedCharacter',ownedFields,{options:Array.from({length:8},(_,i)=>[i,i?`${i} ${t('copies')}`:t('none')])});
    field('ownedWeapon','ownedWeapon',ownedFields,{options:Array.from({length:6},(_,i)=>[i,i?`${i} ${t('copies')}`:t('none')])});ownedDetails.append(ownedFields);
    const targetHelp=disclosure('target','targetHelp');targetHelp.append(el('p','personal-budget-note',t('notation')));
    target.append(targetFields,ownedDetails,targetHelp);grid.append(wallet,target);
    const history=el('section','personal-budget-history');history.append(el('h3','',t('history')));
    const readRow=el('div','personal-budget-read'),checkLabel=el('label','personal-budget-confirm');
    confirmInput=el('input');confirmInput.type='checkbox';confirmInput.checked=confirmed;confirmInput.disabled=!context.account;confirmInput.id='budget-records-complete';confirmInput.onchange=()=>{confirmed=confirmInput.checked;renderResult();};
    checkLabel.append(confirmInput,el('span','',t('confirm')));
    readButton=el('button','secondary-button',t('read'));readButton.type='button';readButton.id='budget-read-records';readButton.onclick=readRecords;
    readRow.append(checkLabel,readButton);history.append(readRow,el('p','personal-budget-note',t(context.account?'readNote':'noHistory')));
    const channels=el('div','personal-budget-pools');
    for(const kind of Object.keys(BUDGET_POOLS)){
      const group=el('fieldset','personal-budget-group');group.append(el('legend','',t(kind)));const fields=el('div','personal-budget-fields');
      field(kind+'.pity','pity',fields,{max:kind==='character'?89:79,placeholder:'unknownPity'});
      field(kind+'.guarantee','guarantee',fields,{options:[['unknown',t('unknown')],['small',t('small')],['big',t('big')]]});
      poolNotes[kind]=el('p','personal-budget-note');group.append(fields,poolNotes[kind]);channels.append(group);
    }
    history.append(channels);
    resultNode=el('div','personal-budget-results');resultNode.id='personal-budget-results';resultNode.setAttribute('aria-live','polite');resultNode.setAttribute('aria-atomic','false');
    const method=disclosure('method','method','personal-budget-method');
    for(const key of ['formula','rules','exclusions','noExpectation'])method.append(el('p','',t(key)));
    const sources=el('p','personal-budget-sources');sources.append(el('span','',t('source')));
    for(const[id,key]of [['exclusive-cn','exclusiveSource'],['weapon-cn','weaponSource']]){const a=el('a','',t(key));a.href=EXPECTATION_SOURCES.find(s=>s.id===id).url;a.target='_blank';a.rel='noreferrer';sources.append(a);}
    method.append(sources);host.replaceChildren(heading,contextNode,grid,history,resultNode,method,savedNode);renderResult();
  }
  function updateContext(next) {
    const nextScope=budgetScope(next.account,next.demo),nextFingerprint=recordFingerprint(next.account),switching=nextScope!==scope;
    if(switching){if(scope)memory.set(scope,clone(draft));scope=nextScope;draft=load();confirmed=false;notice='';}
    if(nextFingerprint!==currentFingerprint)confirmed=false;
    context=next;currentFingerprint=nextFingerprint;
    if(switching||!resultNode)build();else{confirmInput.checked=confirmed;renderResult();}
  }
  window.addEventListener('dukelanguagechange',()=>build());
  window.addEventListener('storage',event=>{
    const prefix=BUDGET_STORAGE_KEY+':';
    if(!event.key?.startsWith(prefix))return;
    if(event.key!==scopeKey()){memory.delete(event.key.slice(prefix.length));return;}
    if(scope==='demo')return;
    crossTab=true;
    try{
      const walletFrom=raw=>recordedWallet(raw?restoreBudget(JSON.parse(raw)):newBudget());
      const before=walletFrom(event.oldValue),latest=walletFrom(localStorage.getItem(scopeKey()));
      const changes=Object.fromEntries(Object.entries(latest).filter(([key,value])=>value!==before[key]));
      if(Object.keys(changes).length){
        applyRecordedWallet(draft,changes);
        if('polychrome' in changes)inputs.polychrome.value=draft.polychrome;
        if('encryptedTapes' in changes)inputs.tapes.value=draft.tapes;
        memory.set(scope,clone(draft));
        onWalletChange();
      }
    }catch{storageNotice='storageError';}
    renderResult();
  });
  function setWallet(changes){
    applyRecordedWallet(draft,changes);
    memory.set(scope,clone(draft));
    if(scope!=='demo'){
      try{
        // Keep unrelated budget edits from another tab, or an unfinished local text field.
        const persisted=localStorage.getItem(scopeKey());
        const last=persisted?restoreBudget(JSON.parse(persisted)):newBudget();
        applyRecordedWallet(last,changes);
        localStorage.setItem(scopeKey(),JSON.stringify(last));
        if(storageNotice==='storageError')storageNotice='';
      }catch{storageNotice='storageError';}
    }
    build();
    return storageNotice!=='storageError';
  }
  const api={updateContext,getWallet:()=>recordedWallet(draft),setWallet,getState:()=>({scope,draft:clone(draft),stale:isStale(),effective:effectiveDraft(),result:(()=>{try{return calculateBudget(effectiveDraft());}catch{return null;}})()})};
  updateContext(context);
  return api;
}

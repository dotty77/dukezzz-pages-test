// Only the published Pages project uses the fixed DUKE API; never read an API host from input.
const API_ROOT=globalThis.location?.origin==='https://dotty77.github.io'&&globalThis.location.pathname.startsWith('/dukezzz-pages-test/')?'https://dukezzz.com':'';
const demoUrl='showcase-demo.json?v=20261117-disc-panel-launch-1';
import {mountMiyousheBrowserSync} from './mys-browser-sync.js?v=20261114-canonical-sync-1';
import {mountHoyolabSync} from './hoyolab-sync.js?v=20261114-canonical-sync-1';
import {officialToConfiguration} from './official-equipment.js?v=20261118-disc-context-score-launch-1';
import {scoreEquippedDisc,getDiscScoreProfile,SCORE_RULES,withDiscScoreDefaults} from './disc-score.js?v=20261118-disc-context-score-launch-1';
import {newConfiguration,normalizedToConfiguration,validateConfiguration,calculatePanel,formatProperty,resolveTargets,compareDisc,inspectDiscRolls,evaluateDiscContributions} from './disc-planner-core.js?v=20261118-disc-context-score-launch-1';
import {evaluateContext,assessUsable} from './disc-context.js?v=20261027-agents-launch-1';
import {renderPanelEffects,renderDiscFitScore,discFitMethod} from './disc-panel-display.js?v=20261118-disc-context-score-launch-1';
import {applyPlanningScope} from './disc-scope.js?v=20260913-disc-planner-1';
const $=id=>document.getElementById(id),el=(tag,cls='',text='')=>{const n=document.createElement(tag);n.className=cls;n.textContent=text;return n;};
let data,builds,equipment,details,graduation,mechanics,config,alternative='',planIndex=0,team=['',''],tier='small',allocation=null,busy=false,controller,cacheUntil=0,cacheUid='',snapshot=null;
let planningMode='improve',planningScope='solo',searchTask=null,searchRevision=0,slotReview=null;
let activeImport=null,preferredAgentId='';
let planRequested=false,refreshTimer;
let farmNotice='';
function queuePlanRefresh(){
  clearTimeout(refreshTimer);
  if(planRequested||config.discs.some(d=>d.subs.length))refreshTimer=setTimeout(()=>generate(false),400);
}
function scrollToDiscSection(id){
  const target=document.getElementById(id);if(!target)return;
  target.style.scrollMarginTop=`${Math.ceil(document.querySelector('.site-header')?.getBoundingClientRect().height||74)+16}px`;
  target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
}
function revealSlotResults(){
  const revision=searchRevision;
  requestAnimationFrame(()=>{if(revision===searchRevision&&slotReview)scrollToDiscSection('disc-slot-results');});
}
// Section controls stay on this document even with a site-root <base>.
for(const control of document.querySelectorAll('[data-disc-section]')){
  control.addEventListener('click',()=>scrollToDiscSection(control.dataset.discSection));
}
const clone=x=>JSON.parse(JSON.stringify(x)),name=id=>data.properties[id]?.name||String(id),fmt=(id,v)=>formatProperty(id,v,data);
function uiText(tag,zh,en,cls=''){const n=el(tag,cls,zh);n.dataset.i18nEn=en;return n;}
function maximumPlanningLevels(value){return {...value,level:60,promotion:6,weaponLevel:60,weaponBreak:5,core:6};}
function setPlanningTeam(value){
  const entries=Array.isArray(value)?value:[];
  team=[0,1].map(i=>{const id=String(entries[i]??'');return Object.hasOwn(details.agents,id)?id:'';});
  planningScope=team.some(Boolean)?'team':'solo';
}
function setImportStatus(zh,en){$('disc-import-status').replaceChildren(uiText('span',zh,en));}

// Persist only the current planning inputs, never account metadata or connection credentials.
const SAVED_PLAN_KEY='duke-disc-planner-current-v1',SAVED_PLAN_LIMIT=16000;
let planStorageReady=false,lastSavedPlan='',planStorageFailed=false;
function savedPlanStatus(zh='',en=''){
  let status=$('disc-save-status');
  if(!status){status=el('p','disc-muted');status.id='disc-save-status';status.setAttribute('role','status');$('disc-import-status').after(status);}
  status.replaceChildren(...(zh?[uiText('span',zh,en)]:[]));status.hidden=!zh;
}
function savedConfiguration(value){
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const id=v=>typeof v==='string'&&/^\d*$/.test(v)?v:typeof v==='number'&&Number.isSafeInteger(v)&&v>0?String(v):null;
  if(!object(value)||!Array.isArray(value.discs)||value.discs.length!==6)return null;
  const result={};
  for(const key of ['id','weaponId']){result[key]=id(value[key]);if(result[key]===null)return null;}
  for(const key of ['level','promotion','core','cinema','weaponLevel','weaponBreak','refinement'])result[key]=value[key];
  if(value.level!==60||value.promotion!==6||value.core!==6||value.weaponLevel!==60||value.weaponBreak!==5)return null;
  if(Object.hasOwn(value,'route')){if(!['','critical','anomaly','crit'].includes(value.route))return null;result.route=value.route;}
  result.discs=[];
  for(const disc of value.discs){
    if(!object(disc)||!Array.isArray(disc.subs)||disc.subs.length>4||id(disc.setId)===null||typeof disc.locked!=='boolean')return null;
    const next={slot:disc.slot,setId:id(disc.setId),mainId:disc.mainId,level:disc.level,initial:disc.initial,subs:[],locked:disc.locked};
    for(const key of ['absent','unsupported'])if(Object.hasOwn(disc,key)){if(typeof disc[key]!=='boolean')return null;next[key]=disc[key];}
    for(const sub of disc.subs){if(!object(sub))return null;next.subs.push({id:sub.id,rolls:sub.rolls});}
    result.discs.push(next);
  }
  return validateConfiguration(result,data).length?null:result;
}
function savedPlan(value){
  if(!value||typeof value!=='object'||value.schema!=='duke-disc-planner-current-1')return null;
  const configuration=savedConfiguration(value.config);if(!configuration)return null;
  if(!Array.isArray(value.team)||value.team.length!==2||value.team.some(id=>typeof id!=='string'||id!==''&&!Object.hasOwn(details.agents,id)))return null;
  if(!['usable','small','large'].includes(value.tier)||!['improve','fresh'].includes(value.mode))return null;
  const alt=mechanics.agents[configuration.id]?.alternatives?.find(a=>a.id===value.alternative);
  if(typeof value.alternative!=='string'||value.alternative!==''&&!alt)return null;
  const plans=alt?.sets||builds.agents[configuration.id]?.sets||[];
  if(!Number.isInteger(value.planIndex)||value.planIndex<0||value.planIndex>=Math.max(1,plans.length))return null;
  const scope=value.team.some(Boolean)?'team':'solo';if(value.scope!==scope)return null;
  return {schema:'duke-disc-planner-current-1',config:configuration,team:[...value.team],scope,alternative:value.alternative,tier:value.tier,mode:value.mode,planIndex:value.planIndex};
}
function readSavedPlan(){
  try{
    const raw=localStorage.getItem(SAVED_PLAN_KEY);if(!raw||raw.length>SAVED_PLAN_LIMIT)return null;
    const result=savedPlan(JSON.parse(raw));if(result)lastSavedPlan=JSON.stringify(result);return result;
  }catch{return null;}
}
function saveCurrentPlan(){
  if(!planStorageReady)return;
  try{
    const count=currentBuild().sets?.length||1;
    const value=savedPlan({schema:'duke-disc-planner-current-1',config,team,scope:planningScope,alternative,tier,mode:planningMode,planIndex:Math.min(planIndex,count-1)});
    if(!value)return;
    const raw=JSON.stringify(value);if(raw.length>SAVED_PLAN_LIMIT||raw===lastSavedPlan)return;
    localStorage.setItem(SAVED_PLAN_KEY,raw);lastSavedPlan=raw;
    if(planStorageFailed){planStorageFailed=false;savedPlanStatus();}
  }catch{
    planStorageFailed=true;savedPlanStatus('浏览器未能保存配装，离开前可导出方案。','This browser could not save the build. Export it before leaving.');
  }
}
// End current-plan persistence.

function link(url,label){const a=el('a','',label);if(/^https:\/\//.test(url)||/^[\w.-]+\.html(?:[?#].*)?$/.test(url)){a.href=url;if(url.startsWith('https:')){a.target='_blank';a.rel='noopener noreferrer';}}return a;}
function textList(entries){const list=el('ul');for(const t of entries||[])list.append(el('li','',typeof t==='string'?t:t.text||t.note||t.condition||JSON.stringify(t)));return list;}
function selectField(label,entries,value,onchange,id){const l=el('label','disc-field',label),s=el('select');s.setAttribute('aria-label',label);if(id)s.id=id;for(const [v,t]of entries){const o=el('option','',t);o.value=v;s.append(o);}s.value=String(value);s.onchange=()=>onchange(s.value);l.append(s);return l;}
function searchableTeammateField(label,agents,value,onchange,id){
  const field=el('div','disc-field'),caption=el('label','',label),wrap=el('div','disc-combo');
  const input=el('input'),toggle=button('⌄',()=>{},'disc-combo-toggle'),list=el('div','disc-combo-list');
  const entries=[{id:'',name:'未选择'},...agents.map(a=>({id:String(a.id),name:a.name,fullName:a.fullName||''}))];
  let selected=String(value||''),matches=[],optionNodes=[],active=-1,opened=false;
  caption.htmlFor=id;input.id=id;input.type='text';input.autocomplete='off';input.spellcheck=false;
  input.placeholder='输入名字搜索';input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');
  input.setAttribute('aria-expanded','false');input.setAttribute('aria-controls',`${id}-listbox`);
  list.id=`${id}-listbox`;list.setAttribute('role','listbox');list.setAttribute('aria-label',`${label}候选`);list.hidden=true;
  toggle.tabIndex=-1;toggle.setAttribute('aria-label',`展开${label}候选`);
  const normalize=s=>s.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,'');
  const restore=()=>{input.dataset.i18nValue=selected?entries.find(a=>a.id===selected)?.name||'':'';input.value=window.DUKE_I18N.t(input.dataset.i18nValue);};
  function highlight(index,scroll=false){
    active=index;
    optionNodes.forEach((node,i)=>{node.classList.toggle('is-active',i===active);node.setAttribute('aria-selected',String(i===active));});
    if(optionNodes[active]){input.setAttribute('aria-activedescendant',optionNodes[active].id);if(scroll)optionNodes[active].scrollIntoView({block:'nearest'});}
    else input.removeAttribute('aria-activedescendant');
  }
  function close(){opened=false;list.hidden=true;input.setAttribute('aria-expanded','false');highlight(-1);restore();}
  function choose(entry){const changed=selected!==entry.id;selected=entry.id;close();if(changed)onchange(selected);}
  function show(query=''){
    const q=normalize(query),results=entries.slice(1).filter(a=>!q||window.DUKE_I18N.matches([a.name,a.fullName],q));
    matches=[entries[0],...results];list.replaceChildren();optionNodes=[];
    matches.forEach((entry,index)=>{
      const option=el('div','disc-combo-option',entry.name);option.id=`${id}-option-${index}`;
      option.setAttribute('role','option');option.dataset.value=entry.id;option.classList.toggle('is-selected',entry.id===selected);
      option.onmousedown=e=>e.preventDefault();
      option.onclick=()=>choose(entry);option.onpointermove=e=>{if(e.pointerType==='mouse')highlight(index);};
      list.append(option);optionNodes.push(option);
    });
    if(!results.length){const empty=el('div','disc-combo-empty','没有找到匹配的代理人');empty.setAttribute('role','status');list.append(empty);}
    opened=true;list.hidden=false;input.setAttribute('aria-expanded','true');highlight(q&&results.length?1:-1);list.scrollTop=0;
  }
  input.onfocus=()=>{show();input.select();};
  input.onclick=()=>{if(!opened){show();input.select();}};
  input.oninput=()=>show(input.value);
  input.onkeydown=e=>{
    if(e.isComposing||e.keyCode===229)return;
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){
      e.preventDefault();if(!opened)show();
      highlight(active<0?(e.key==='ArrowDown'?0:matches.length-1):(active+(e.key==='ArrowDown'?1:-1)+matches.length)%matches.length,true);
    }else if(e.key==='Enter'&&opened){e.preventDefault();if(matches[active])choose(matches[active]);}
    else if(e.key==='Escape'&&opened){e.preventDefault();e.stopPropagation();close();}
  };
  toggle.onpointerdown=e=>e.preventDefault();
  toggle.onclick=()=>{if(opened)close();else{input.focus();show();input.select();}};
  wrap.addEventListener('focusout',e=>{if(!wrap.contains(e.relatedTarget))close();});
  restore();wrap.append(input,toggle,list);field.append(caption,wrap);return field;
}
const range=(n,start=0)=>Array.from({length:n-start+1},(_,i)=>[i+start,String(i+start)]);
function numberField(label,value,min,max,onchange){const l=el('label','disc-field',label),i=el('input');i.type='number';i.min=min;i.max=max;i.value=value;i.setAttribute('aria-label',label);i.onchange=()=>onchange(Number(i.value));l.append(i);return l;}
function checkbox(label,checked,onchange){const l=el('label','disc-check'),i=el('input');i.type='checkbox';i.checked=checked;i.onchange=()=>onchange(i.checked);l.append(i,document.createTextNode(label));return l;}
function button(label,fn,cls=''){const b=el('button',cls,label);b.type='button';b.onclick=fn;return b;}
function sourceDetails(title,texts){const d=el('details','disc-source-details');d.append(el('summary','',title));for(const t of texts||[]){const p=el('p');for(const part of Array.isArray(t)?t:[t])p.append(el('span','',part));d.append(p);}return d;}
function currentBuild(){
  const b=clone(builds.agents[config.id]),alt=mechanics.agents[config.id]?.alternatives?.find(a=>a.id===alternative);
  if(alt){
    b.mainStatIds=alt.mainStatIds;
    b.effectiveSubstats={...b.effectiveSubstats,primaryIds:alt.primaryIds,secondaryIds:alt.secondaryIds,mode:alt.primaryIds.length?'core-substats':'supplement-only'};
    b.reasons=[alt.label,...alt.conditions];b.alternativeId=alt.id;b.alternativeSource=alt.sourceUrl;
    b.personalDamageSubstatsAreOptional=!!alt.personalDamageSubstatsAreOptional;
    if(alt.sets)b.sets=alt.sets;
    else{b.setsUnverified=true;b.reasons.push('下方套装沿用原搭配，仅作参考；本流派的套装尚未独立核实，请结合原文选择。');}
  }
  return withDiscScoreDefaults(b);
}
function currentContext(){return evaluateContext({config,team,scope:planningScope,build:currentBuild(),profile:graduation.agents[config.id],agent:details.agents[config.id],details,alternative:mechanics.agents[config.id]?.alternatives?.find(a=>a.id===alternative)});}
function checkList(checks){const root=el('div','disc-context-checks');for(const c of checks){const card=el('details',`disc-context-check is-${c.status}`);card.dataset.check=c.id;card.open=c.status==='unmet';card.append(el('summary','',`${c.status==='met'?'✓ 已确认':c.status==='excluded'?'本次不核对':c.status==='unmet'?'需调整':'待确认'} · ${c.label}`),el('p','',c.reason));root.append(card);}return root;}
function setSearchControls(searching,background=false){$('disc-generate').disabled=searching&&!background;$('disc-compare').disabled=searching&&!background;$('disc-search-cancel').hidden=!searching;}
function cancelSearch(message=''){
  clearTimeout(refreshTimer);
  searchRevision++;
  if(searchTask){const task=searchTask;searchTask=null;task.worker.terminate();task.reject(new DOMException('搜索已取消','AbortError'));}
  setSearchControls(false);if(message)$('disc-allocation-status').textContent=message;
}
function searchPlan(operation,selected=null,background=false){
  cancelSearch();setSearchControls(true,background);
  const revision=searchRevision;
  return new Promise((resolve,reject)=>{
    let worker;
    try{worker=new Worker(new URL('./disc-planner-worker.js?v=20261118-disc-context-score-launch-1',import.meta.url),{type:'module'});}
    catch(error){setSearchControls(false);reject(error);return;}
    searchTask={worker,reject,revision};
    const finish=()=>{worker.terminate();if(searchTask?.revision===revision){searchTask=null;setSearchControls(false);}};
    worker.onmessage=({data:message})=>{
      if(revision!==searchRevision){finish();reject(new DOMException('配置已改变','AbortError'));return;}
      finish();if(message.error)reject(Error(message.error));else resolve(message.result);
    };
    worker.onerror=event=>{event.preventDefault();finish();reject(revision===searchRevision?Error('方案搜索未能完成，请刷新页面后重试。'):new DOMException('配置已改变','AbortError'));};
    try{worker.postMessage({operation,config:clone(config),data,rows:targetRows().rows,build:currentBuild(),allocation:selected,options:{mode:planningMode,scope:planningScope,useReference:true,planIndex,pinFarmMains:!!selected}});}
    catch(error){finish();reject(error);}
  });
}
function invalidate(){cancelSearch();allocation=null;slotReview=null;farmNotice='';$('disc-allocation-status').textContent='';$('disc-candidates').replaceChildren();updateTargets();updateSlotGoals();updateDiscScores();saveCurrentPlan();queuePlanRefresh();}
function setAgent(id,imported=null,rememberAgent=true){
  cancelSearch();planRequested=!!imported;
  if(!data.agents[id])throw Error('该角色尚未收录正式服配装数据');
  preferredAgentId=rememberAgent?String(id):'';
  config=maximumPlanningLevels(imported||newConfiguration(id,builds.agents[id],equipment,data));alternative='';planIndex=0;setPlanningTeam([]);snapshot=imported?clone(config):null;allocation=null;slotReview=null;
  $('disc-file-status').textContent='';savedPlanStatus();
  const url=new URL(location.href);url.searchParams.set('agent',id);history.replaceState(null,'',url.pathname+url.search+url.hash);
  renderAll();
}
function renderAvailability(){
  const box=$('disc-availability');if(!box)return;
  const entries=[details.agents[config.id],equipment.engines[config.weaponId]].filter(x=>x?.availability?.status==='announced');
  box.textContent=[...new Set(entries.map(x=>x.availability.label))].join(' · ');box.hidden=!entries.length;
}
function renderConfig(){
  const target=$('disc-config-controls');target.replaceChildren();
  target.append(selectField('代理人',Object.values(details.agents).map(a=>[a.id,`${a.name} · ${a.specialty}`]),config.id,selectPlannerAgent, 'disc-agent'),
    selectField('影画',range(6).map(([n])=>[n,`${n} 影画`]),config.cinema,v=>{config.cinema=Number(v);invalidate();renderEvidence();},'disc-cinema'));
  const engines=Object.values(equipment.engines).sort((a,b)=>Number(b.profession===details.agents[config.id].specialty)-Number(a.profession===details.agents[config.id].specialty));
  target.append(selectField('音擎',[['','无音擎'],...engines.map(w=>[w.id,`${w.name} · ${w.profession}`])],config.weaponId,v=>{config.weaponId=v;invalidate();renderAvailability();renderEvidence();},'disc-weapon'),
    selectField('音擎叠影',range(5,1),config.refinement,v=>{config.refinement=Number(v);invalidate();renderEvidence();},'disc-refinement'));
  const availability=el('p','disc-note');availability.id='disc-availability';availability.style.gridColumn='1 / -1';target.append(availability);renderAvailability();
  renderTeamControls();
}
function renderTeamControls(){
  const ctx=$('disc-context-controls');ctx.replaceChildren();
  for(let i=0;i<2;i++)ctx.append(searchableTeammateField(`队友 ${i+1}`,Object.values(details.agents).filter(a=>String(a.id)!==String(config.id)),team[i],v=>{const next=[...team];next[i]=v;setPlanningTeam(next);invalidate();renderTeamControls();renderEvidence();},`disc-teammate-${i+1}`));
  ctx.append(selectField('输出方向（有双路线参考时）',[['','按当前机制方案'],['anomaly','异常路线'],['critical','双暴路线']],config.route||'',v=>{config.route=v;invalidate();}));
  const scopeNote=$('disc-scope-note');scopeNote.dataset.i18nEn=planningScope==='solo'?'Teammates are optional. Leave both empty to plan your personal build.':'Roster requirements are checked; combat buffs still need their actual triggers.';scopeNote.textContent=planningScope==='solo'?'队友可选；不选时按个人配装规划。':'已按队友核对条件；战斗增益仍需实际触发。';
  const generate=$('disc-generate');generate.dataset.i18nEn='Plan disc changes';generate.textContent='规划换盘方案';
}
function renderPlans(){
  const root=$('disc-plan-controls'),b=currentBuild(),alts=mechanics.agents[config.id]?.alternatives||[];root.replaceChildren();
  root.append(selectField('玩法',[['','角色机制推荐'],...alts.map(a=>[a.id,a.label])],alternative,v=>{alternative=v;invalidate();renderPlans();renderSlots();renderEvidence();},'disc-alternative'));
  const plans=b.sets||[];root.append(selectField('四件套方案',plans.map((p,i)=>[i,`${equipment.discs[p.fourPieceId]?.name||'方案'} · ${p.label||i+1}`]),planIndex,v=>{planIndex=Number(v);applySetPlan();},'disc-set-plan'));
  const p=plans[planIndex]||plans[0];
  if(p){root.append(button('将此套装应用到未保留号位',applySetPlan));if(p.twoPieceIds?.length>1)root.append(selectField('二件套候选',p.twoPieceIds.map(id=>[id,equipment.discs[id]?.name||id]),config.discs[5].setId,v=>{for(const d of config.discs.filter(d=>d.slot>=5&&!d.locked))d.setId=v;invalidate();renderSlots();renderEvidence();}));}
  const notes=$('disc-build-notes');notes.replaceChildren(textList([...(b.reasons||[]),...(p?.conditions||[])]));
  notes.append(el('p','disc-muted','套装按触发条件推荐；选择顺序不代表所有配队下的伤害排名。四件套和二件套可以放在不同号位，下面可逐盘调整。'));
  if(b.alternativeSource)notes.append(link(b.alternativeSource,'查看此流派原文 ↗'));
}
function applySetPlan(){const p=currentBuild().sets?.[planIndex];if(!p)return;for(const d of config.discs)if(!d.locked)d.setId=String(d.slot<=4?p.fourPieceId:p.twoPieceIds?.[0]||'');invalidate();renderPlans();renderSlots();renderEvidence();}
function renderTiers(){
  const root=$('disc-tier-controls');root.replaceChildren();
  for(const [id,title,desc]of [['usable','能用','先匹配套装、主属性和功能条件；不强求每盘固定份数。'],['small','小毕业参考','以逐角色攻略的区间下限规划，核对当前配置条件。'],['large','大毕业参考','以攻略区间上沿作为进阶目标；没有上沿时保留原目标。']]){
    const b=button('',()=>{tier=id;renderTiers();invalidate();},'disc-tier');b.dataset.tier=id;b.setAttribute('aria-pressed',String(tier===id));b.append(el('strong','',title),el('span','',desc));root.append(b);
  }
}
function renderStrategy(){
  $('disc-strategy-controls').replaceChildren(selectField('规划方式',[
    ['improve','优先保留现有盘'],['fresh','重新规划未锁定号位']
  ],planningMode,value=>{planningMode=value;invalidate();renderStrategy();},'disc-planning-mode'));
  $('disc-strategy-note').textContent=planningMode==='improve'?'先检查现有配装；需要补属性时，从更少的换盘号位开始搜索。勾选“保留此盘”的号位始终不变。':'为未锁定号位重新生成目标，用于查看培养方向；已录入的原盘保留，可切回优先保留模式比较。';
}
function targetRows(){
  const alt=mechanics.agents[config.id]?.alternatives?.find(a=>a.id===alternative),c={...config};
  if(alt){const map={11102:'hp',12102:'atk',13102:'def',20103:'critRate',21103:'critDmg',31203:'anomalyProficiency'};c.includeOptionalStatKeys=[...new Set(alt.primaryIds.map(id=>map[id]).filter(Boolean))];if(!c.route)c.route=alt.primaryIds.includes(31203)?'anomaly':alt.primaryIds.includes(20103)||alt.primaryIds.includes(21103)?'critical':'';}
  const result=resolveTargets(c,details.agents[config.id],graduation.agents[config.id],equipment,data,tier),context=currentContext();
  const scoped=applyPlanningScope({scope:planningScope,context,rows:result.rows.map(r=>({...r,contextBlocked:context.blockedTargetKeys.includes(r.key)}))});return {...result,...scoped};
}
function excludedTargetDetails(rows){
  const box=el('details','disc-source-details disc-excluded-targets');
  box.append(uiText('summary',`组队参考 · ${rows.length} 项单列`,`Team references (${rows.length})`));
  for(const row of rows){
    const line=el('p'),unit=row.unit||'';
    line.append(el('strong','',row.label||name(row.group)),' ',uiText('span',`${row.target??''}${unit}`,`${row.target??''}${row.group===305?'/s':unit}`),' · ',
      el('span','',row.scopeExclusionReason||'该目标依赖特定队伍条件。'));
    if(row.scopeExclusionSource?.sourceUrl){
      const source=link(row.scopeExclusionSource.sourceUrl,'角色机制依据 ↗');source.dataset.i18nEn='Agent mechanics reference ↗';line.append(' ',source);
    }
    box.append(line);
  }
  return box;
}
function targetGapText(row,panel){
  const message=(zh,en)=>({zh,en});
  if(row.applicable===false)return message('当前方案不适用','Not applicable to this build');
  if(row.scopeExcluded)return message('选择队友后核对','Select teammates to check');
  if(row.contextBlocked)return message('先核对配队条件','Check team requirements first');
  if(!row.planning&&row.bound!=='maximum')return message('未列入本次目标','Not part of this target');
  const reference=!row.comparable,combatReference=['in-combat','unspecified-combat-bonus'].includes(row.scope);
  if(reference&&row.scope==='initial')return message('目标按核心 F 核定','Target assumes Core F');
  if(reference&&!combatReference&&!['initial-reference-unqualified','signature-conditioned'].includes(row.scope))
    return message('参考条件未明确，暂不比较','Reference conditions are unspecified');
  const current=panel.values[row.group];
  if(!Number.isFinite(current)||!Number.isFinite(row.targetRaw))return message('暂不能计算','Cannot calculate yet');
  const property=data.properties[row.group],scale=property.percent?100:property.divisor||1;
  // Compare at the precision shown in both numeric columns.
  const delta=Math.round(current*100/scale)-Math.round(row.targetRaw*100/scale);
  const amount=(Math.abs(delta)/100).toLocaleString('zh-CN',{maximumFractionDigits:2});
  const zh=property.percent?`${amount} 个百分点`:amount+(row.group===305?'/秒':'');
  const en=property.percent?`${amount} percentage points`:amount+(row.group===305?'/s':'');
  if(combatReference){
    if(delta===0)return message('当前面板等于战斗参考，战斗增益另计','Current stats match the combat reference before combat buffs');
    return message(`当前面板${delta<0?'低于':'高于'}战斗参考 ${zh}，战斗增益另计`,
      `Current stats are ${en} ${delta<0?'below':'above'} the combat reference before combat buffs`);
  }
  if(row.bound==='maximum'){
    if(delta>0)return message(reference?`高于参考上限 ${zh}`:`高于上限 ${zh}`,reference?`${en} above the reference ceiling`:`${en} above the ceiling`);
    if(config.discs.some(d=>inspectDiscRolls(d,data).partial))return message('副属性未填全，上限待核对','Substats are incomplete; the ceiling is unverified');
    return message(reference?'已录入值未超参考上限':'已录入值未超上限',reference?'Recorded value is within the reference ceiling':'Recorded value is within the ceiling');
  }
  if(reference)return delta<0?message(`低于参考 ${zh}`,`${en} below the reference`):delta>0?message(`高于参考 ${zh}`,`${en} above the reference`):message('与参考相同','Equal to the reference');
  if(delta<0)return message(`按已录入值还差 ${zh}`,`${en} short based on recorded values`);
  if(delta>0)return message(`高于目标 ${zh}`,`${en} above the target`);
  return message('与目标相同','Equal to the target');
}
function targetConditions(row,panel){
  const cell=el('td','disc-target-conditions'),parts=[];
  if(row.scopeExcluded)parts.push(['队伍条件目标；选好队友后自动核对','Team-dependent target; checked after teammates are selected']);
  else if(row.comparable)parts.push(['初始 / 场外面板','Initial / out-of-combat stats']);
  else if(row.scope==='initial')parts.push(['初始 / 场外面板；该目标按核心 F 核定','Initial / out-of-combat stats; this target assumes Core F']);
  else if(row.scope==='signature-conditioned')parts.push(['专武方案参考；仅作数值对照','Signature W-Engine reference; numeric comparison only']);
  else if(row.scope==='initial-reference-unqualified')parts.push(['攻略培养参考；原文未详述场内 / 场外','Build-guide reference; in/out-of-combat assumptions are unspecified']);
  else if(['in-combat','unspecified-combat-bonus'].includes(row.scope))parts.push(['战斗参考；当前估算未计入完整战斗增益','Combat reference; the estimate does not include all combat buffs']);
  else parts.push(['原攻略未明确比较条件','Comparison conditions are unspecified in the guide']);
  if(row.contextBlocked&&!row.scopeExcluded)parts.push(['配队前提尚未满足或确认','Team requirements are unmet or unconfirmed']);
  if(row.applicable===false)parts.push([row.requiresSignature?'当前未装备专武':'当前方案不适用',row.requiresSignature?'Signature W-Engine is not equipped':'Not applicable to this build']);
  if(String(config.id)==='1611'&&row.key==='critRate')parts.push(['当前值已含暴伤转暴率，未加战斗增益','Current value includes CRIT DMG conversion, without combat buffs']);
  for(const [zh,en]of parts){if(cell.childNodes.length)cell.append(el('br'));cell.append(uiText('span',zh,en));}
  const notes=[...new Set([row.configurationNote,row.note,row.scopeExclusionReason].filter(Boolean))];
  if(notes.length){const more=el('details','disc-source-details');more.append(uiText('summary','条件详情','Condition details'));for(const note of notes)more.append(el('p','',note));cell.append(more);}
  return cell;
}
function updateTargets(){
  const root=$('disc-target-table');root.replaceChildren();const errors=validateConfiguration(config,data);$('disc-validation').textContent=errors.join('；');
  if(errors.length){root.append(el('p','disc-warning','请先修正上面的输入，再计算面板。'));return;}
  const context=currentContext();root.append(checkList(tier==='usable'?assessUsable(config,currentBuild(),data,context):context.checks));
  const panel=calculatePanel(config,data),targets=targetRows(),table=el('table','disc-table'),thead=el('thead'),tr=el('tr');for(const t of ['属性','当前录入 / 装备估算',tier==='usable'?'后续培养参考（非能用门槛）':'本档参考','距本次目标','条件与口径'])tr.append(el('th','',t));thead.append(tr);table.append(thead);const tbody=el('tbody');
  const activeRows=targets.rows;
  for(const r of activeRows){
    const row=el('tr'),gap=targetGapText(r,panel);
    if(r.scopeExcluded)row.dataset.teamConditional='true';
    const value=panel.values[r.group],recorded=Number.isFinite(value)?fmt(r.group,value):'—';
    const target=(r.bound==='maximum'?'≤ ':'')+r.target;
    const perSecond=r.group===305,unit=r.unit||'';
    row.append(el('th','',r.label),
      uiText('td',recorded+(perSecond&&Number.isFinite(value)?'/秒':''),recorded+(perSecond&&Number.isFinite(value)?'/s':'')),
      uiText('td',target+unit+(r.optional?'（可选）':''),target+(perSecond?'/s':unit)+(r.optional?' (optional)':'')),
      uiText('td',gap.zh,gap.en,'disc-target-gap'),targetConditions(r,panel));
    tbody.append(row);
  }
  if(!activeRows.length){const row=el('tr');const c=el('td','',planningScope==='solo'?'当前没有已收录的个人数值目标，可先查看主属性、套装与技能培养方向。':'暂缺成熟区间；查看下方技能门槛，不编造数值。');c.colSpan=5;row.append(c);tbody.append(row);}table.append(tbody);const wrap=el('div','disc-table-wrap');wrap.append(table);root.append(wrap);
  const blanks=config.discs.filter(d=>!inspectDiscRolls(d,data).complete).length;
  root.append(uiText('p',`${blanks?`${blanks} 张盘为空或未填全副属性，按已录入内容估算。`:''}表中按装备及已收录的常驻核心技能、影画加成估算；音擎被动、四件套战斗效果及队友增益另计。`,
    `${blanks?`Only recorded stats are included for ${blanks} empty or incomplete disc(s). `:''}Estimates include equipment and the recorded unconditional Core Skill and Mindscape bonuses. W-Engine passives, combat set effects and squad buffs are separate.`,'disc-muted'));
  root.append(renderPanelEffects(panel.effects));
  if(config.core!==6)root.append(el('p','disc-warning','当前核心未到F，不能直接套用核心F的阈值；下方提供所选等级技能原文。'));
  if(equipment.engines[config.weaponId]&&equipment.engines[config.weaponId].profession!==details.agents[config.id].specialty)root.append(el('p','disc-warning','当前音擎特性不匹配：基础属性仍计入，被动不会生效。'));
}
function renderRollGuide(){
  const root=$('disc-roll-guide');root.replaceChildren();
  root.append(el('summary','','词条数量怎么算？查看公式与 S 级数值表'));
  root.append(el('p','','总份数 = 该项副属性数值 ÷ 单份数值。首次出现算 1 份，之后每追加一次再加 1 份；例如暴击伤害 19.2% ÷ 4.8% = 4 份，对应游戏属性旁的 +3。属性旁的 +3 与驱动盘等级 +3 是两回事。'));
  const units=el('dl','disc-roll-units');
  for(const [id,value]of Object.entries(data.subBases)){const pair=el('div');pair.append(el('dt','',name(id)),el('dd','',`${fmt(id,value)} / 份`));units.append(pair);}root.append(units);
  root.append(el('p','','S 级盘每到 3、6、9、12、15 级有一次成长节点。初始三条盘在 3 级补出第四种副属性，其后才有四次追加；初始四条盘有五次追加。因此满级总份数分别为 3 + 5 = 8、4 + 5 = 9；最多仍只有四种副属性。主属性不计入副属性份数。'));
  root.append(el('p','','“有效词条”要结合角色、玩法、技能、影画、音擎与配队判断，还要考虑属性上限和转换。下方“优先副属性”是所选攻略的培养方向，不是所有份数都有相同收益，也不等同游戏内战备评估的计数。'));
  root.append(el('p','','换盘规划先算当前六盘，再比较适用的面板目标，把缺口分配到可调整号位。它不会把总份数当作毕业分数，也不要求六张盘各自凑同样多的词条。未填全的盘只计算已录入内容；换盘目标中的“至少几份”是最低要求，其余属性仍未指定。'));
  root.append(link('https://www.hoyolab.com/article/34243548','玩家教程：驱动光碟效果与词条介绍 · 第 3.1 节 ↗'));
  root.append(el('p','disc-muted','此处引用教程的副属性固定数值与成长规则；文中的套装等效词条和队伍权重未用作本站统一评分。'));
}
function renderRollSummary(d){
  const count=inspectDiscRolls(d,data),box=el('div','disc-roll-summary');box.dataset.status=count.status;
  if(count.status==='absent'){box.append(el('strong','','空缺号位 · 不计入当前面板'));return box;}
  if(count.status==='unsupported'){box.append(el('strong','','原盘资料待核对 · 暂不统计份数'));return box;}
  box.append(el('strong','',`已填 ${count.rawTotalRolls??'待核对'} 份 · 本级应有 ${count.expectedTotalRolls??'待核对'} 份`));
  if(count.status==='invalid'){box.append(el('p','disc-warning',count.problems.join('；')||'条数或份数不符合当前盘的成长规则，请核对输入。'));return box;}
  const countDetails=sourceDetails('查看计数明细',[`已填 ${count.recordedTypes} 种 / 应有 ${count.expectedTypes} 种副属性。初始 ${count.initial} 份 + ${count.upgradeNodes} 次成长节点 = ${count.expectedTotalRolls} 份；该等级单项最多 ${count.maxRollsPerStat} 份。`]);countDetails.querySelector('summary').dataset.i18nEn='View roll count details';box.append(countDetails);
  if(count.complete)countDetails.append(el('p','disc-muted','计数完整：条数与份数符合该等级规则，不表示这张盘已经毕业。'));
  else box.append(el('p','disc-warning',`尚未填全：总份数少于本级应有份数 ${count.missingRolls} 份${count.missingTypes?`，还缺 ${count.missingTypes} 种副属性`:''}。当前只按已填写数值计算。`));
  return box;
}
// Per-agent reference score presentation.
function currentContributions(){
  return evaluateDiscContributions(config,data,tier==='usable'?[]:targetRows().rows,{scope:planningScope,useReference:true});
}
function renderDiscScore(d,build,contribution){
  const score=scoreEquippedDisc(d,build,data,config,contribution);
  return renderDiscFitScore(score,contribution,'disc-card-score');
}
function renderScoreGuide(){
  const box=$('disc-score-guide');if(!box)return;
  const profile=getDiscScoreProfile(currentBuild(),data,config),weights=el('div','disc-score-weights');
  box.replaceChildren(uiText('summary','评分依据','Scoring basis'));
  box.append(discFitMethod());
  box.append(uiText('p','本页按角色与音擎 60 级、核心 F 的规划面板评分。展柜页采用实际等级。','The planner rates the planned Lv. 60 agent and W-Engine with Core F. The showcase uses the equipped levels.'));
  for(const [id,weight]of Object.entries(profile.weights||{}).filter(([,weight])=>weight>0).sort((a,b)=>b[1]-a[1]||Number(a[0])-Number(b[0]))){
    const chip=el('span');chip.append(el('span','',name(id)),el('b','',`×${weight}`));weights.append(chip);
  }
  if(weights.childElementCount)box.append(weights);
  const basis=uiText('p',profile.basis.zh,profile.basis.en);box.append(basis);
  if(profile.basis.sourceUrl){const source=link(profile.basis.sourceUrl,'角色或流派依据 ↗');source.dataset.i18nEn='Agent or build reference ↗';box.append(source);}
  if(profile.mode==='supplement-only')box.append(uiText('p','此角色的副词条仅作输出补充；功能属性仍看主词条与装备。','This agent uses substats only for supplemental damage; functional stats still depend on main stats and equipment.'));
  box.append(uiText('p','副词条分按已录入的加权份数，除以同主属性、初始四词条满级 S 盘的最佳加权份数，再乘 100。','The separate substat score divides recorded weighted rolls by the best legal weighted rolls on a max-level four-start S-Rank disc with the same main stat, then multiplies by 100.'));
  const grades=el('p','disc-score-thresholds');grades.append(uiText('span','评级阈值：','Grade thresholds: '),document.createTextNode(SCORE_RULES.grades.map(item=>`${item.grade} ≥ ${item.min}`).join(' · ')));box.append(grades);
  for(const adjustment of profile.adjustments||[]){
    const reason=adjustment.reason==='claret-crit-conversion'?[
      '克拉蕾的初始暴击伤害以 0.35 倍转为初始暴击率；每份 4.8% 暴伤折为 1.68% 暴率，所以相对每份 2.4% 暴率按 0.7 权重计入。',
      'Claret converts initial CRIT DMG to initial CRIT Rate at 0.35×. Each 4.8% CRIT DMG roll gives 1.68% CRIT Rate, so it has weight 0.7 against a direct 2.4% CRIT Rate roll.'
    ]:[adjustment.reason,adjustment.reasonEn||`This agent uses weight ${adjustment.weight} for this substat based on its skill conversion.`];
    const line=el('p');line.append(uiText('span',...reason));
    if(adjustment.sourceUrl){const source=link(adjustment.sourceUrl,'机制来源 ↗');source.dataset.i18nEn='Skill source ↗';line.append(document.createTextNode(' '),source);}
    box.append(line);
  }
}
function updateDiscScores(){
  const build=currentBuild(),contributions=currentContributions();
  for(const d of config.discs){const previous=$('disc-slot-grid')?.querySelector(`.disc-slot[data-slot="${d.slot}"] .disc-card-score`);if(previous)previous.replaceWith(renderDiscScore(d,build,contributions[d.slot]));}
  renderScoreGuide();
}
// End per-agent reference score presentation.
// Drive Disc cards: presentation only; all values use the existing planner model.
function renderDiscFace(d,build,contribution){
  const set=equipment.discs[d.setId],count=inspectDiscRolls(d,data),face=el('div','disc-card-face');
  const identity=el('div','disc-card-identity'),copy=el('div','disc-card-title');
  const title=el('h3','',set?.name||'未选择');if(set?.nameEn)title.dataset.i18nEn=set.nameEn;
  copy.append(title);
  const meta=el('div','disc-card-meta');
  if(d.absent)meta.append(uiText('span','空缺号位','Empty slot'));
  else if(d.unsupported)meta.append(uiText('span','资料待核对','Unverified'));
  else{meta.append(el('span','disc-card-rank','S'),el('span','',`Lv.${d.level}`));}
  copy.append(meta);identity.append(copy);
  const art=el('div','disc-card-art');art.setAttribute('aria-hidden','true');
  if(/^assets\/[\w/-]+\.(?:webp|png|jpe?g)$/.test(set?.icon||'')){
    const image=el('img');image.src=set.icon;image.alt='';image.width=72;image.height=72;image.loading='lazy';image.decoding='async';
    image.addEventListener('error',()=>{image.remove();art.classList.add('is-empty');},{once:true});art.append(image);
  }else art.classList.add('is-empty');
  identity.append(art);face.append(identity);
  const main=el('div','disc-card-main');
  const knownMain=!d.absent&&!d.unsupported&&Number.isFinite(data.mainBases[d.slot]?.[d.mainId])&&Number.isFinite(data.discLevels[`4:${d.level}`]);
  main.append(knownMain?el('span','disc-card-main-name',name(d.mainId)):uiText('span','主属性待核对','Main stat unverified','disc-card-main-name'),
    el('strong','disc-card-main-value',knownMain?fmt(d.mainId,Math.floor(data.mainBases[d.slot][d.mainId]*(10000+data.discLevels[`4:${d.level}`])/10000)):'—'));
  face.append(main);
  const primary=new Set((build.effectiveSubstats?.primaryIds||[]).map(Number)),secondary=new Set((build.effectiveSubstats?.secondaryIds||[]).map(Number));
  const subs=el('div','disc-card-substats');
  for(let i=0;i<4;i++){
    const sub=d.subs[i],row=el('div','disc-card-stat');
    if(!sub){row.classList.add('is-empty');row.append(uiText('span','未填写','Not entered','disc-card-stat-name'),el('span','disc-card-stat-value','—'));subs.append(row);continue;}
    const priority=primary.has(Number(sub.id))?'primary':secondary.has(Number(sub.id))?'secondary':'other';
    row.dataset.priority=priority;row.dataset.property=String(sub.id);
    const label=el('span','disc-card-stat-name');label.append(el('span','',name(sub.id)));
    const line=count.lines[i],additional=!d.absent&&!d.unsupported&&!count.invalid&&line?.valid?line.additionalRolls:null;
    if(additional>0){const badge=el('span','disc-card-rolls',`+${additional}`);badge.dataset.additional=String(additional);label.append(badge);}
    const knownSub=!d.absent&&!d.unsupported&&Number.isFinite(data.subBases[sub.id])&&Number.isFinite(sub.rolls);
    row.append(label,el('strong','disc-card-stat-value',knownSub?fmt(sub.id,data.subBases[sub.id]*sub.rolls):'—'));subs.append(row);
  }
  face.append(subs,renderDiscScore(d,build,contribution));return face;
}
function renderDiscCountDetails(d){
  const count=inspectDiscRolls(d,data),box=el('details','disc-card-count-details');box.dataset.status=count.status;
  const valid=['complete','partial'].includes(count.status);
  const summary=valid?uiText('summary',`副词条 ${count.rawTotalRolls} / ${count.expectedTotalRolls} 份`,`Substat rolls ${count.rawTotalRolls} / ${count.expectedTotalRolls}`)
    :uiText('summary',count.status==='absent'?'空缺 · 不计入面板':'计数待核对',count.status==='absent'?'Empty · excluded from panel':'Roll count unverified');
  box.append(summary,renderRollSummary(d));return box;
}
// End Drive Disc card presentation.
function renderSlots(){
  const root=$('disc-slot-grid'),openSlots=new Set([...root.querySelectorAll('.disc-slot-editor[open]')].map(n=>Number(n.dataset.slot)));root.replaceChildren();const b=currentBuild(),contributions=currentContributions();
  for(const d of config.discs){
    const card=el('article','panel disc-slot');card.dataset.slot=d.slot;
    const head=el('div','disc-section-head disc-card-toolbar');head.append(el('span','disc-card-slot',`#${String(d.slot).padStart(2,'0')}`),checkbox('保留此盘',d.locked,v=>{d.locked=v;invalidate();}));
    card.append(head,renderDiscFace(d,b,contributions[d.slot]));
    const editor=el('details','disc-slot-editor');editor.dataset.slot=d.slot;editor.open=openSlots.has(d.slot);editor.append(uiText('summary','编辑当前盘','Edit current disc'));
    if(d.absent)card.append(el('p','disc-warning','展柜未提供此盘。当前不计入面板；下面填写的是待补目标。'),button('加入此号位的目标盘',()=>{d.absent=false;invalidate();renderSlots();}));
    if(d.unsupported)card.append(el('p','disc-warning',d.unsupportedReason||'原盘为非S级或属性资料不一致，未按金盘计算。'),button('改为S级15级空白目标',()=>{d.unsupported=false;delete d.unsupportedReason;delete d.unsupportedReasons;d.absent=false;d.level=15;d.initial=4;d.subs=[];invalidate();renderSlots();}));
    const fields=el('div','disc-slot-fields');fields.append(selectField(`${d.slot}号位套装`,[['','未选择'],...Object.values(equipment.discs).map(s=>[s.id,s.name])],d.setId,v=>{d.setId=v;invalidate();renderSlots();renderEvidence();}));
    const recommended=d.slot<=3?Object.keys(data.mainBases[d.slot]).map(Number):(b.mainStatIds[d.slot]||[]).map(Number),conditional=(b.conditionalMainStatIds?.[d.slot]||[]).map(Number);
    fields.append(selectField(`${d.slot}号位主属性`,Object.keys(data.mainBases[d.slot]).map(id=>[id,`${name(id)} ${fmt(id,data.mainBases[d.slot][id]*4)}${recommended.includes(Number(id))?' · 推荐':conditional.includes(Number(id))?' · 条件备选':''}`]),d.mainId,v=>{d.mainId=Number(v);d.subs=d.subs.filter(s=>Number(s.id)!==d.mainId);invalidate();renderSlots();}),numberField(`${d.slot}号盘等级`,d.level,0,15,v=>{d.level=v;invalidate();renderSlots();}),selectField(`${d.slot}号盘初始副属性`,[...([3,4].includes(d.initial)?[]:[['unknown','未确认 · 请核对原盘']]),[3,'3条 · 满级8份'],[4,'4条 · 满级9份']],[3,4].includes(d.initial)?d.initial:'unknown',v=>{if(v==='unknown')return;d.initial=Number(v);invalidate();renderSlots();}));editor.append(fields);
    const rec=el('p','disc-slot-recommend',`主属性建议：${recommended.map(id=>name(id)).join(' / ')}。优先副属性：${(b.effectiveSubstats?.primaryIds||[]).filter(id=>Number(id)!==d.mainId).map(id=>name(id)).join('、')||'按循环与功能判断'}。`);editor.append(rec);
    const subgrid=el('div','disc-sub-grid'),conversions=[];
    for(let i=0;i<4;i++){
      const sub=d.subs[i],line=el('div','disc-sub-row');
      line.append(selectField(`${d.slot}号盘副属性${i+1}`,[['','未填写'],...Object.keys(data.subBases).filter(id=>Number(id)!==d.mainId).map(id=>[id,name(id)])],sub?.id||'',v=>{if(v){if(d.subs.some((s,j)=>j!==i&&s.id===Number(v))){$('disc-validation').textContent='同一张盘不能有重复副属性';renderSlots();return;}d.subs[i]={id:Number(v),rolls:sub?.rolls||1};d.subs=d.subs.filter(Boolean);}else d.subs.splice(i,1);invalidate();renderSlots();}),selectField(`${d.slot}号盘副属性${i+1}总份数`,range(6,1).map(([n])=>[n,`${n}份`]),sub?.rolls||1,v=>{if(d.subs[i])d.subs[i].rolls=Number(v);invalidate();renderSlots();}));
      if(sub){
        const raw=data.subBases[sub.id]*sub.rolls;line.append(el('span','disc-sub-value',fmt(sub.id,raw)));
        if(Number.isInteger(sub.rolls)&&sub.rolls>=1&&data.subBases[sub.id])conversions.push(`${fmt(sub.id,raw)} ÷ ${fmt(sub.id,data.subBases[sub.id])} = ${sub.rolls} 份；${sub.rolls===1?'首次出现，尚未追加。':`游戏标记 +${sub.rolls-1}（追加 ${sub.rolls-1} 次）。`}`);
      }subgrid.append(line);
    }
    editor.append(subgrid);if(conversions.length){const conversionDetails=sourceDetails('份数换算',conversions);conversionDetails.querySelector('summary').dataset.i18nEn='Roll calculations';editor.append(conversionDetails);}card.append(editor,renderDiscCountDetails(d));const goal=el('div','disc-slot-goal');goal.id=`disc-slot-goal-${d.slot}`;card.append(goal);root.append(card);
  }
  updateSlotGoals();renderScoreGuide();
}
function farmChance(low,high){
  const percent=n=>{
    const value=100*Math.max(0,Math.min(1,n));
    if(value>0&&value<0.01)return '<0.01%';
    return Number(value.toFixed(value<1?2:1))+'%';
  };
  const lo=percent(low),hi=percent(high??low);
  return lo===hi?lo:`${lo}–${hi}`;
}
function farmAction(action,entry){
  const row=el('div','disc-farm-row'),title=el('strong'),body=el('div');
  row.dataset.farmAction=action;row.dataset.slot=entry.slot;
  const tune=action==='tuning';
  row.append(tune?uiText('span','调律校音器','Tuning Calibrator','disc-farm-label'):uiText('span','优先刷','Farm first','disc-farm-label'));
  title.append(uiText('span',`${entry.slot}号位`,`Slot ${entry.slot}`));
  const set=equipment.discs[entry.setId];
  if(set?.name){title.append(' · ',uiText('span',set.name,set.nameEn||''));}
  if(tune)title.append(' · ',el('span','',name(entry.mainId)));
  body.append(title);
  if(tune){
    const gain=farmChance(entry.tuningGain);
    body.append(uiText('p',`比只定号位多用 1 个校音器，保守估算平均多补回当前缺口的 ${gain}。`,`Using one Calibrator on top of slot tuning closes an estimated extra ${gain} of your current gap on average (conservative estimate).`));
  }else{
    const chance=farmChance(entry.randomChance,entry.randomChanceMax);
    body.append(uiText('p',`估算每张这个套装的随机 S 盘，有 ${chance} 的机会在此号位缩小缺口。`,`Estimated chance per random S-Rank disc from this set to close a gap in this slot: ${chance}.`));
  }
  row.append(body);return row;
}
function renderFarmAdvice(){
  const root=$('disc-farm-advice'),farm=allocation?.farming;
  const problems=validateConfiguration(config,data);
  let status=farm?.status||farmNotice||(config.discs.some(d=>!d.absent&&d.subs.length)?'calculating':'unknown');
  if(problems.length)status='invalid';
  else if(tier==='usable')status='usable';
  else if(allocation?.guidanceOnly)status='no-targets';
  else if(allocation?.blocked)status='blocked';
  root.replaceChildren();root.hidden=false;
  root.dataset.status=status;
  root.append(uiText('h3','还值得刷吗？','Worth farming?'));
  if(status==='invalid'){
    const slots=config.discs.filter(d=>inspectDiscRolls(d,data).invalid).map(d=>d.slot);
    root.append(slots.length?uiText('p',`先核对 ${slots.join('、')} 号盘的装备记录。修正后会自动重算刷盘建议。`,`Check the equipment in slot(s) ${slots.join(', ')}. Farming advice updates when the records are corrected.`):
      uiText('p','请核对当前角色和音擎的配置，修正后会自动重算。','Check the Agent and W-Engine settings. Farming advice updates when the configuration is corrected.'));
    return;
  }
  const compared=(status==='met'?farm?.protected:farm?.deficits)||[];
  if(compared.length){
    const line=el('p','disc-muted');line.append(uiText('span','当前 → 目标　','Current → target  '));
    compared.forEach((r,i)=>{if(i)line.append(' · ');line.append(el('span','',name(r.group)),' ',fmt(r.group,r.current),' → ',fmt(r.group,r.targetRaw));});
    root.append(line);
  }
  if(status!=='ready'){
    const text={
      calculating:['正在估算这组方案的优先号位…','Estimating farming priorities for this build…'],
      met:farm?.partial?['按已录入属性，本次面板下限已达到，先保留现有盘。','The recorded stats already meet the target minimums. Keep your discs.']:['已达到本次可比较的面板目标，先保留现有盘和校音器。','Your build meets the comparable targets. Keep your discs and save the Calibrator.'],
      locked:['所有可调整号位都已锁定，先保留校音器。','All eligible slots are locked. Save the Calibrator.'],
      'no-targets':allocation?.reasonCode==='combat-reference'?['本档目标需要战斗增益。先保留校音器，按下方建议核对各号位的套装与主属性。','These targets depend on combat buffs. Save the Calibrator and check each slot’s set and main stat below.']:['当前条件下没有可比较的面板目标，先按方案选套装与主属性。','There are no comparable stat targets for this setup. Follow the plan’s set and main-stat recommendations.'],
      blocked:['当前装备或锁定条件限制了换盘方案。请查看换盘建议中的具体原因。','The current equipment or slot locks prevent a plan. See the reason under Recommended changes.'],
      cancelled:['已取消估算。点击「规划换盘方案」可继续使用当前配装计算。','Estimate cancelled. Select Plan disc changes to calculate again with this build.'],
      comparing:['正在比较推荐主词条组合…','Comparing recommended main-stat combinations…'],
      'select-candidate':['选择一个主词条组合，可查看对应的刷盘建议。','Select a main-stat combination to see its farming advice.'],
      unknown:farm?.reason==='partial-ceiling'?['已录入的面板在参考范围内。补全副属性即可复核上限，再决定是否继续刷。','The recorded stats are within the reference range. Complete the missing substats to check the cap before farming.']:['导入当前配装或在盘卡上补全资料后，会自动估算优先号位。','Import your build or fill in the disc stats. Farming priorities update automatically.'],
      'no-gain':['按本次目标，单换一张盘暂未找到能改善的号位。先保留校音器，可参考组合换盘方案。','No single replacement improved the current targets in this model. Save the Calibrator and review the multi-disc plan.'],
      usable:['能用档先看套装与主属性，暂不需要为面板目标消耗校音器。','For the usable tier, focus on sets and main stats. Save the Calibrator for a stat target.'],
      unavailable:['本次刷盘估算未完成。点击「规划换盘方案」可重试。','The farming estimate could not finish. Select Plan disc changes to retry.']
    }[status]||[];
    root.append(uiText('p',text[0]||'',text[1]||''));return;
  }
  if(farm.priority)root.append(farmAction('priority',farm.priority));
  if(farm.tuning)root.append(farmAction('tuning',farm.tuning));
  else root.append(uiText('p','校音器先留着，当前没有适合定向主属性的号位。','Save the Calibrator for now. None of the eligible slots warrants choosing a main stat.'));
  if(farm.partial)root.append(uiText('p','部分盘的副属性未录全，按已录入的面板估算。','Some substats are missing. Estimates use the recorded build.','disc-muted'));
  const method=el('details','disc-farm-method');
  method.append(uiText('summary','估算依据','How this is estimated'));
  method.append(uiText('p','每次只换一张盘，保留其余五张与已达到的门槛。优先刷能平均补回更多目标缺口的号位，校音器优先给锁定主属性后额外收益最大的号位。','Each estimate changes one disc and keeps the other five and their met thresholds. The farm recommendation prioritizes expected gap reduction. The Calibrator goes where choosing the main stat adds the most expected gain.'),
    uiText('p','按目标套装的满级 S 盘估算，假设同一池内的主属性、副属性与强化落点等可能。分别计算初始三条和四条的结果，显示两者范围。','The model uses max-level S-Rank discs from the target set. Eligible main stats, substats and upgrade destinations are assumed equally likely within their respective pools. Ranges span the three- and four-starting-substat cases.'));
  if(farm.tuning){
    const t=farm.tuning,slot=farmChance(t.slotChance,t.slotChanceMax),main=farmChance(t.mainChance,t.mainChanceMax);
    method.append(uiText('p',`${t.slot}号位只定号位的改善机会约 ${slot}，再定主属性约 ${main}。校音器按能补回多少缺口排序，也计入每次改善的幅度。`,`Slot ${t.slot} has an estimated ${slot} chance of improvement with slot tuning and ${main} with the main stat fixed. The Calibrator ranking accounts for how much each successful disc improves the build.`));
  }
  const plannedSlot=allocation.slotChanges?.find(change=>change.slot===farm.priority?.slot);
  if(plannedSlot?.action==='keep')method.append(uiText('p','下方方案保留了这个号位。先刷到合适的替换盘，也能从这个号位补缺口，换上后会重新规划。','The plan below keeps this slot. A good drop here offers another way to close the same gaps. Updating the equipped disc recalculates the plan.'));
  root.append(method);
}
function updateSlotGoals(){
  renderFarmAdvice();
  const resultNote=$('disc-slot-result-note');resultNote.replaceChildren();resultNote.hidden=!slotReview;
  if(slotReview==='usable')resultNote.append(uiText('span','已完成基础检查；尚未生成逐号位换盘目标。','Basic checks complete; no per-slot changes have been generated.'));
  else if(allocation?.guidanceOnly)resultNote.append(uiText('span','先看各号位的培养方向；尚未确定需要调整的号位。','Review each slot’s build direction; specific changes have not been determined.'));
  else if(slotReview&&allocation?.configuration){
    const count=allocation.slotChanges?.filter(c=>['fill','replace'].includes(c.action)&&!config.discs.find(d=>d.slot===c.slot)?.locked).length||0;
    resultNote.append(count?uiText('span',`本次参考方案建议调整 ${count} 个号位，已用同色标出。`,`This reference plan suggests changes to ${count} slots, highlighted in the same color.`):uiText('span','本次方案保留现有盘；请结合下方条件核对。','This plan keeps your current discs; check the listed conditions.'));
  }
  for(const d of config.discs){const root=$(`disc-slot-goal-${d.slot}`);if(!root)continue;root.replaceChildren();root.removeAttribute('data-action');const target=allocation?.configuration?.discs?.find(x=>x.slot===d.slot),change=allocation?.slotChanges?.find(x=>x.slot===d.slot);
    const card=root.closest('.disc-slot'),adjust=!!(target&&!allocation.guidanceOnly&&!allocation.blocked&&!d.locked&&['fill','replace'].includes(change?.action));
    const farmAlternative=change?.action==='keep'&&[allocation?.farming?.priority?.slot,allocation?.farming?.tuning?.slot].includes(d.slot);
    card.classList.toggle('is-adjustment',adjust);card.classList.toggle('is-locked',!!d.locked);card.querySelector('.disc-slot-plan-state')?.remove();
    if(adjust)card.querySelector('.disc-section-head').append(uiText('span','建议调整','Suggested change','disc-slot-plan-state is-adjustment'));
    else if(d.locked)card.querySelector('.disc-section-head').append(uiText('span','已锁定保留','Locked · keep','disc-slot-plan-state'));
    else if(target&&change?.action==='keep')card.querySelector('.disc-section-head').append(farmAlternative?uiText('span','原盘可留，有提升再换','Keep until a better drop','disc-slot-plan-state'):uiText('span','本次保留','Keep for this plan','disc-slot-plan-state'));
    if(allocation?.guidanceOnly){
      const b=currentBuild(),mainIds=d.slot<=3?Object.keys(data.mainBases[d.slot]).map(Number):b.mainStatIds[d.slot]||[];
      root.dataset.action='guidance';root.append(el('strong','','本号位的个人培养方向'),el('p','',`主属性参考：${mainIds.map(name).join(' / ')||'待核对'}。`));
      const priority=b.effectiveSubstats?.primaryIds||[];
      if(priority.length)root.append(el('p','',`副属性优先方向：${priority.map(name).join('、')}；最终不能与所选主属性重复。`));
      root.append(el('p','disc-muted',`${d.locked?'保留此盘；':''}当前只给出搭配方向，尚未分配指定词条份数或生成必须更换的盘。`));continue;
    }
    if(!target){if(d.locked)root.append(el('p','disc-muted','保留此盘：现有属性参与整套目标计算。'));continue;}
    root.dataset.action=change?.action||'';
    if(change?.action==='keep'){
      root.append(farmAlternative?uiText('strong','原盘可留，有提升再换','Keep until a better drop'):el('strong','','保留现有盘'),el('p','',`${equipment.discs[d.setId]?.name||'套装未选择'} · ${name(d.mainId)} · 当前 ${d.level} 级。${change.reason||'已录入属性参与整套计算，本方案保留此盘。'}`));
      continue;
    }
    root.append(el('strong','',change?.action==='fill'?'补齐空缺号位':d.locked?'保留当前盘':compareDisc(d,target)?'已录入属性覆盖本号位参考目标':'本号位的换盘目标'));
    root.append(el('p','',`目标：${equipment.discs[target.setId]?.name||'套装待选'} · ${name(target.mainId)} ${fmt(target.mainId,data.mainBases[target.slot][target.mainId]*4)} · S级15级。${Number(d.mainId)!==Number(target.mainId)?`当前录入主属性为${name(d.mainId)}，这是换主属性后的目标。`:''}`));
    if(!target.subs.length)root.append(el('p','','当前整体目标不再要求此盘追加指定副属性；仍需符合主属性和套装条件。'));
    else root.append(textList(target.subs.map(s=>`${name(s.id)}至少 ${s.rolls} 份，共 ${fmt(s.id,data.subBases[s.id]*s.rolls)}`)));
    root.append(el('p','disc-muted','这些是为补齐整套缺口分配的最低属性，不要求每一盘同时达到相同份数；其余副属性并未指定。'));
  }
}
function renderTargetGuidance(result){
  slotReview='guidance';const root=$('disc-allocation-status');root.replaceChildren(uiText('p','当前没有可直接比较的数值目标，可先核对套装和各号位的主属性。','There are no directly comparable stat targets for this build. Check the set and main stat for each slot.','disc-result-lead'));
  root.append(el('p','disc-muted',result.blocked||'先匹配六个号位、套装和主属性，再按适用的个人培养参考规划词条。'));
  root.append(checkList(assessUsable(config,currentBuild(),data,currentContext())));
  if(result.excludedRows?.length)root.append(excludedTargetDetails(result.excludedRows));
  updateSlotGoals();
}
function renderAllocationSummary(){
  const root=$('disc-allocation-status');root.replaceChildren();if(!allocation)return;
  const count=allocation.changeCount??allocation.changedSlots?.length??0;
  const retained=allocation.retainedSlots?.length??6-count;
  const pendingCeiling=allocation.unresolvedRows?.some(r=>r.reasonCode==='incomplete-ceiling')&&allocation.rows.every(r=>r.shortfall===0);
  const summary=pendingCeiling?`${count===0?'先保留现有盘':`已给出调整 ${count} 个号位的参考方案`}；${allocation.incompleteCeilingSlots.join('、')}号位的副属性尚未完整，上限待核对，暂不判定完成。`:allocation.met&&count===0?'现有配装已覆盖本档参考目标，无需为此目标换盘。':allocation.met?`找到覆盖本档参考目标的方案：调整 ${count} 个号位，保留 ${retained} 个号位。`:`当前搜索尚未找到覆盖全部目标的方案，先展示找到的参考分配：调整 ${count} 个号位。`;
  const summaryEn=pendingCeiling?`${count===0?'Keep your current discs':`A reference plan changes ${count} slots`}; substats in slots ${allocation.incompleteCeilingSlots.join(', ')} are incomplete, so upper limits remain unverified.`:allocation.met&&count===0?'Your current build covers this tier’s reference targets; no disc changes are needed for them.':allocation.met?`Found a plan covering this tier’s reference targets: change ${count} slots and keep ${retained}.`:`The search has not covered every target; the current reference plan changes ${count} slots.`;
  root.append(uiText('p',summary,summaryEn,'disc-result-lead'));
  if(planningScope==='solo')root.append(el('p','disc-muted','本次只比较当前代理人的个人配装目标；保留自身辅助技能门槛，特定队伍组成的参考不参与完成判断。队友增益和未核实的战斗效果未自动加入面板。'));
  if(allocation.excludedRows?.length)root.append(excludedTargetDetails(allocation.excludedRows));
  if(allocation.provisional)root.append(el('p','disc-muted','本次采用攻略参考口径；请结合配装条件核对，不据此认定实际毕业。'));
  if(allocation.search?.truncated)root.append(el('p','disc-warning','本次搜索尚未覆盖全部组合，可能还有更合适的方案；这里没有将搜索未找到当成无法达标。'));
  if(!allocation.met)root.append(textList(allocation.rows.filter(r=>r.shortfall>0).map(r=>`${r.label||name(r.group)}仍差 ${fmt(r.group,r.shortfall)}`)));
  if(allocation.unresolvedRows?.length)root.append(textList(allocation.unresolvedRows.map(r=>`${r.label||name(r.group)} ${r.target??''}${r.unit||''} 尚未评估：${r.reason}。`)));
  root.append(sourceDetails('方案计算范围',[allocation.method,'仅比较所列属性目标与当前套装范围；技能循环、全部战斗增益和实战伤害没有统一纳入本次目标，不将这组结果称为最高伤害配装。']));
}
function presentAllocation(result){
  allocation=result;farmNotice='';
  if(result.guidanceOnly){renderTargetGuidance(result);return;}
  if(result.blocked){slotReview=null;$('disc-allocation-status').textContent=result.blocked;updateSlotGoals();return;}
  slotReview='plan';renderAllocationSummary();updateSlotGoals();
}
async function generate(scroll=true){
  planRequested=true;cancelSearch();allocation=null;slotReview=null;farmNotice='calculating';$('disc-candidates').replaceChildren();updateSlotGoals();
  try{const errors=validateConfiguration(config,data);if(errors.length)throw Error(errors.join('；'));
    if(tier==='usable'){
      allocation=null;const checks=assessUsable(config,currentBuild(),data,currentContext());
      $('disc-allocation-status').replaceChildren(el('p','','能用档先看下面的结构与条件检查。未规定全角色通用的副词条份数；数值功能门槛仍需查看技能依据。'),checkList(checks));slotReview='usable';updateSlotGoals();if(scroll)revealSlotResults();return;
    }
    $('disc-allocation-status').textContent=planningMode==='improve'?'正在从现有配装寻找更少换盘的方案…':'正在搜索逐号位目标…';
    presentAllocation(await searchPlan('generate',null,!scroll));
    if(scroll)revealSlotResults();
  }catch(e){if(e.name!=='AbortError'){allocation=null;slotReview=null;farmNotice='unavailable';updateSlotGoals();$('disc-allocation-status').textContent=e.message;}}
}
async function showCandidate(candidate){
  cancelSearch();allocation=candidate;slotReview='plan';planRequested=true;farmNotice='calculating';
  renderAllocationSummary();updateSlotGoals();
  if(candidate.farming){revealSlotResults();return;}
  try{
    const pending=searchPlan('farming',candidate);
    revealSlotResults();
    candidate.farming=await pending;
    if(allocation===candidate)updateSlotGoals();
  }catch(error){
    if(error.name!=='AbortError'&&allocation===candidate){
      candidate.farming={status:'unavailable'};
      updateSlotGoals();
    }
  }
}
async function compare(){
  cancelSearch();farmNotice='comparing';updateSlotGoals();
  const box=$('disc-candidates');box.replaceChildren(el('p','','正在从同一套原装备比较推荐主词条组合…'));
  try{const errors=validateConfiguration(config,data);if(errors.length)throw Error(errors.join('；'));const candidates=await searchPlan('compare');box.replaceChildren();
    if(!candidates.length){
      if(!allocation)presentAllocation(await searchPlan('generate'));
      if(!allocation?.guidanceOnly)box.append(uiText('p','当前条件下暂无法比较。','Comparison is unavailable under the current conditions.'));
      return;
    }
    farmNotice='select-candidate';updateSlotGoals();
    for(const c of candidates){const row=el('div','disc-candidate'),choices=c.configuration.discs.filter(d=>d.slot>=4).map(d=>`${d.slot}号 ${name(d.mainId)}`).join(' · ');row.append(el('strong','',choices),uiText('span',`${c.met?'覆盖所列参考目标':'尚有参考目标缺口'} · 调整 ${c.changeCount??0} 个号位${c.search?.truncated?' · 部分组合未完成搜索':''}`,`${c.met?'Reference targets covered':'Reference targets still missing'} · Change ${c.changeCount??0} slots${c.search?.truncated?' · Some combinations were not searched':''}`),button('查看这组目标',()=>showCandidate(c)));box.append(row);}
    if(!allocation&&config.discs.some(d=>!d.absent&&d.subs.length))presentAllocation(await searchPlan('generate',null,true));
  }catch(e){if(e.name!=='AbortError'){farmNotice='unavailable';updateSlotGoals();box.replaceChildren(el('p','disc-warning',e.message));}}
}
function renderEvidence(){
  const root=$('disc-evidence'),a=details.agents[config.id],m=mechanics.agents[config.id]||{},b=currentBuild();root.replaceChildren();
  root.append(el('p','disc-warning',planningScope==='solo'?'个人配装保留自身技能、影画、音擎及辅助门槛。这里没有模拟只带一名角色出战，也没有把需要队友或战斗触发的效果自动加入面板；相关条件继续在下方说明。':'技能、影画、专武、套装与队友条件分开核对。下列触发句并不表示增益已经加入上方装备面板；条件未能确认时不会按已触发处理。'));
  const teamOnlyThreshold=r=>planningScope==='solo'&&String(config.id)==='1581'&&(r.key||r.id)==='triple-anomaly-attack-share-cap';
  for(const r of targetRows().thresholds)root.append(sourceDetails(`${teamOnlyThreshold(r)?'组队参考 · 本次不参与 · ':''}${r.title||r.stat}${r.value!=null?' · '+(r.roundedUpInteger??r.value)+(r.unit||''):''}`,[r.condition,r.formula,r.note].filter(Boolean)));
  if(m.reviewNotes?.length)root.append(textList(m.reviewNotes));root.append(textList(b.cautions));
  const coreSkills=a.skills.filter(s=>s.category==='核心被动'||/核心|额外能力/.test(s.name));
  root.append(sourceDetails('核心技能与额外能力：按触发条件核对',coreSkills.map(s=>[`${s.name}\n`,...skillText(s)])));
  for(const r of m.rules||[]){if(config.cinema<(r.cinemaMin||0)||config.cinema>(r.cinemaMax??6)||r.engineId&&String(r.engineId)!==String(config.weaponId))continue;
    const v=r.refinementValues?.[config.refinement-1]??r.value;
    root.append(sourceDetails(`${teamOnlyThreshold(r)?'组队参考 · 本次不参与 · ':''}${r.stat||'机制'} · ${r.title||(r.engineId?'当前音擎条件':'技能与影画条件')}${v!=null?' · '+v+(r.unit||''):''}`,[r.condition,r.formula,r.note,r.valueMeaning?.includes('effect')?'此数字是特定效果的增益，不是需要刷到的面板目标。':'此处保留技能机制条件；不自动当作整名角色的毕业线。'].filter(Boolean)));
  }
  const cinema=a.cinema||[];for(const c of cinema)root.append(sourceDetails(`影画 ${c.index} · ${c.name}${c.index<=config.cinema?' · 已解锁':' · 未解锁'}`,[c.description]));
  const w=equipment.engines[config.weaponId];if(w)root.append(sourceDetails(`${w.name} · 叠影 ${config.refinement} · 音擎生效条件`,[w.skillRequirement,w.refinements?.find(r=>r.level===config.refinement)?.description||w.skillDescription]));
  const sets=[...new Set(config.discs.map(d=>d.setId))].filter(Boolean);for(const id of sets){const s=equipment.discs[id];if(s)root.append(sourceDetails(`${s.name} · 套装效果`,[`2件：${s.twoPiece}`,`4件：${s.fourPiece}`]));}
  const activeTeam=planningScope==='team'?team.filter(Boolean):[];
  if(activeTeam.length!==new Set(activeTeam).size)root.append(el('p','disc-warning','两位队友重复，请重新选择。'));
  for(const id of activeTeam){const t=details.agents[id];root.append(sourceDetails(`${t.name} · 核心F参考，队友影画与实际等级需另核对`,t.skills.filter(s=>/核心|额外能力/.test(s.name)).map(s=>[`${s.name}\n`,...skillText(s,{core:6,cinema:0})])));}
  root.append(sourceDetails('查看当前角色所有招式依据',a.skills.map(s=>[s.name,' · ',`${s.category}\n`,...skillText(s)])),link(`agents.html#agent=${config.id}`,'打开完整角色资料 ↗'));
  if(graduation.agents[config.id]?.source?.url)root.append(link(graduation.agents[config.id].source.url,'逐角色攻略原文 ↗'));
  const guideCount=Object.values(graduation.agents||{}).filter(a=>a.status==='author-reference').length,coverageNote=el('p','disc-muted',`${guideCount}位角色已有作者培养参考；具体条件见对应攻略。测试服资料单独展示。`);coverageNote.dataset.i18nEn=`Guide-author build references cover ${guideCount} agents; see each guide for its assumptions. Beta data is shown separately.`;root.append(coverageNote);
}
function skillText(s,context=config){
  const levels=s.levels||s.variants||[];
  if(Array.isArray(levels)&&levels.length){const requested=s.levelType==='核心强化'?context.core+1:12+(context.cinema>=3?2:0)+(context.cinema>=5?2:0),found=levels.find(l=>l.level===requested);if(found)return [`${s.levelType==='核心强化'?`核心${context.core?'ABCDEF'[context.core-1]:'基础'}`:`招式培养12级，影画加成后${requested}级`}：`,found.description||found.text||s.description];return ['当前来源未提供所选等级完整文本；以下为基础说明，精确数值请在完整资料页核对。\n',s.description||''];}
  return [s.description||s.text||'请在完整技能页切换等级查看。'];
}
function renderAll(){farmNotice='';renderConfig();renderPlans();renderTiers();renderStrategy();renderRollGuide();renderSlots();updateTargets();renderEvidence();$('disc-candidates').replaceChildren();$('disc-allocation-status').textContent='';saveCurrentPlan();queuePlanRefresh();}
function setBusy(value){busy=value;$('disc-fetch').disabled=value;$('disc-demo').disabled=value;$('disc-cancel').hidden=!value;}
// Only this page retains the latest source. Selecting a role starts from a copy of its imported equipment.
function selectPlannerAgent(id){
  const imported=activeImport?.configs.get(id);
  setAgent(id,imported?clone(imported):null);
  if(imported){
    const plan=activeImport.plan;
    if(plan){
      setPlanningTeam(plan.team);alternative=plan.alternative;tier=plan.tier;planningMode=plan.mode;planIndex=plan.planIndex;renderAll();
    }
    setImportStatus(...activeImport.notice);
  }else if(activeImport){
    setImportStatus('本次导入没有这位角色的配装，可手动填盘。','This import has no equipment for this agent. Enter their discs manually.');
  }else $('disc-import-status').replaceChildren();
}
function loadSingleAgent(imported,notice,plan=null){
  cacheUid='';cacheUntil=0;$('disc-showcase-agents').replaceChildren();
  activeImport={configs:new Map([[String(imported.id),clone(imported)]]),notice,plan};
  selectPlannerAgent(String(imported.id));
}
function consumeShowcase(result,isDemo){
  if(!Array.isArray(result?.agents))throw Error('展柜资料不完整');
  const agents=result.agents.filter(a=>a&&Object.hasOwn(data.agents,String(a.id)));
  if(!agents.length)throw Error('展柜没有可规划的正式服角色');
  const configs=new Map(agents.map(a=>[String(a.id),normalizedToConfiguration(a,data)]));
  const buttons=agents.map(a=>button(a.name||details.agents[a.id].name,()=>selectPlannerAgent(String(a.id))));
  const notice=isDemo?['虚构展柜示例；角色与音擎按60级满突破、核心F规划。','Fictional showcase. Agent and W-Engine target Lv.60 and full promotion, with Core Skill F.']:
    ['已载入公开配装；角色与音擎按60级满突破、核心F规划，非来源实测等级。','Public build loaded. Agent and W-Engine target Lv.60 and full promotion, with Core Skill F; these are planning levels, not imported measurements.'];
  activeImport={configs,notice};$('disc-showcase-agents').replaceChildren(...buttons);
  selectPlannerAgent(!isDemo&&configs.has(preferredAgentId)?preferredAgentId:String(agents[0].id));
}
function beginImport(){
  controller?.abort();controller=new AbortController();setBusy(true);return controller;
}
function endImport(request){
  if(controller===request){controller=null;setBusy(false);}
}
function cancelImport(){
  if(controller){controller.abort();endImport(controller);}
}
async function readShowcase(isDemo){
  if(busy)return;
  const uid=$('disc-uid').value.trim();
  if(!isDemo){
    if(!/^[1-9][0-9]{5,9}$/.test(uid))return;
    if(uid===cacheUid&&Date.now()<cacheUntil){$('disc-import-status').textContent=`上游缓存尚余 ${Math.ceil((cacheUntil-Date.now())/1000)} 秒，稍后再试。`;return;}
  }
  const request=beginImport(),timer=setTimeout(()=>request.abort(),35000);
  if(!isDemo)$('disc-import-status').textContent='正在读取公开展柜…';
  try{
    const r=isDemo?await fetch(demoUrl,{signal:request.signal}):await fetch(API_ROOT+'/api/showcase',{
      method:'POST',headers:{'Content-Type':'application/json','X-Bagel-Import':'1'},body:JSON.stringify({uid}),
      signal:request.signal,credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'
    });
    if(isDemo&&!r.ok)throw Error('示例暂不可用');
    const result=await r.json();
    if(controller!==request)return;
    request.signal.throwIfAborted();
    if(!r.ok)throw Error(result.message||result.error?.message||'展柜读取失败');
    if(!isDemo&&String(result.uid)!==uid)throw Error('展柜UID与请求不一致');
    consumeShowcase(result,isDemo);
    cacheUid=isDemo?'':uid;cacheUntil=isDemo?0:Date.now()+Math.max(0,Number(result.ttl)||0)*1000;
  }catch(error){
    if(controller===request)$('disc-import-status').textContent=error.name==='AbortError'?'读取已取消或超时，原方案保留。':`${error.message}，原方案保留。`;
  }finally{clearTimeout(timer);endImport(request);}
}
$('disc-uid-form').onsubmit=e=>{e.preventDefault();return readShowcase(false);};
$('disc-cancel').onclick=()=>{cancelImport();$('disc-import-status').textContent='读取已取消或超时，原方案保留。';};
$('disc-demo').onclick=()=>readShowcase(true);
$('disc-reset').onclick=()=>{cancelImport();setAgent(config.id);setImportStatus('已重置当前角色。','Current agent reset.');};
$('disc-generate').onclick=()=>generate();$('disc-compare').onclick=compare;
$('disc-search-cancel').onclick=()=>{cancelSearch('搜索已取消，已录入配装保留。');farmNotice='cancelled';updateSlotGoals();$('disc-candidates').replaceChildren();};
$('disc-export').onclick=()=>{const errors=validateConfiguration(config,data);if(errors.length){$('disc-validation').textContent=errors.join('；');return;}const blob=new Blob([JSON.stringify({schema:'bagel-disc-plan-1',config,team,scope:planningScope,alternative,tier,mode:planningMode},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=`${details.agents[config.id].name}-驱动盘方案.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('disc-file').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  e.target.value='';
  const request=beginImport();
  try{
    if(file.size>100000)throw Error('方案文件过大');
    const x=JSON.parse(await file.text());
    if(controller!==request)return;
    if(x.schema!=='bagel-disc-plan-1')throw Error('不是本站驱动盘方案');
    const imported=maximumPlanningLevels(x.config),errors=validateConfiguration(imported,data);
    if(errors.length)throw Error(errors.join('；'));
    const plan={team:x.team,alternative:mechanics.agents[imported.id]?.alternatives?.some(a=>a.id===x.alternative)?x.alternative:'',
      tier:['usable','small','large'].includes(x.tier)?x.tier:'small',mode:x.mode==='fresh'?'fresh':'improve',planIndex:0};
    loadSingleAgent(imported,['已导入方案（不含UID）；角色与音擎按60级满突破、核心F规划，非来源实测等级。','Plan imported without a UID. Agent and W-Engine target Lv.60, full promotion, and Core Skill F; these are planning levels, not imported measurements.'],plan);
  }catch(error){
    if(controller===request)$('disc-import-status').textContent=`导入失败：${error.message}`;
  }finally{
    if(controller===request)$('disc-file-status').replaceChildren(...[...$('disc-import-status').childNodes].map(node=>node.cloneNode(true)));
    endImport(request);
  }
};
try{
  const paths=['disc-planner-data.json?v=20261117-disc-panel-launch-1','agent-builds.json?v=20261111-refresh-launch-1','agent-equipment.json?v=20261111-refresh-launch-1','agent-details.json?v=20261111-refresh-launch-1','agent-graduation.json?v=20261027-agents-launch-1','disc-planner-mechanics.json?v=20261027-agents-launch-1'];
  [data,builds,equipment,details,graduation,mechanics]=await Promise.all(paths.map(async p=>{const r=await fetch(p);if(!r.ok)throw Error(`资料读取失败：${p}`);return r.json();}));
  const requested=new URL(location.href).searchParams.get('agent'),remembered=readSavedPlan();
  const restore=remembered&&(!Object.hasOwn(data.agents,requested)||requested===remembered.config.id);
  if(restore){
    loadSingleAgent(remembered.config,['已恢复此浏览器最近的配装。','Restored the last build saved in this browser.'],remembered);
  }else if(Object.hasOwn(data.agents,requested))setAgent(requested);
  else setAgent('1611',null,false);
  let transferred=false;
  try{const raw=sessionStorage.getItem('bagel-disc-planner-handoff');if(raw){sessionStorage.removeItem('bagel-disc-planner-handoff');const a=JSON.parse(raw);if(data.agents[String(a.id)]){tier=['usable','small','large'].includes(a.planningTier)?a.planningTier:'small';loadSingleAgent(normalizedToConfiguration(a,data),['已带入配装（不含UID）；角色与音擎按60级满突破、核心F规划，非来源实测等级。','Build transferred without a UID. Agent and W-Engine target Lv.60 and full promotion, with Core Skill F; these are planning levels, not imported measurements.']);transferred=true;}}}catch{}
  planStorageReady=true;if(transferred||Object.hasOwn(data.agents,requested)&&!restore)saveCurrentPlan();
  // Official sync sources mount.
  const importOfficial=(agent,meta)=>{
    const imported=maximumPlanningLevels(officialToConfiguration(agent,data));
    if(String(imported.id)!==String(meta.agentId))throw Error('官方返回角色与所选角色不一致');
    const errors=validateConfiguration(imported,data);if(errors.length)throw Error(errors.join('；'));
    cancelImport();
    const provider=meta.source==='hoyolab'?'HoYoLAB':'米游社',providerEn=meta.source==='hoyolab'?'HoYoLAB':'Miyoushe';
    loadSingleAgent(imported,[`已同步${provider}配装；角色与音擎按60级满突破、核心F规划，非来源实测等级。`,`${providerEn} build synced. Agent and W-Engine target Lv.60, full promotion, and Core Skill F; these are planning levels, not imported measurements.`]);
  };
  mountHoyolabSync($('disc-hoyolab-sync'),{getAgentId:()=>config.id,getAgentName:id=>details.agents[id]?.name||'',onImport:importOfficial,restoredBuild:!!restore&&!transferred});
  const chinaSection=$('disc-cn-sync');let chinaMounted=false;
  const chinaOptions=()=>({getAgentId:()=>config.id,getAgentName:id=>details.agents[id]?.name||'',onImport:importOfficial,restoredBuild:!!restore&&!transferred});
  const mountChina=()=>{if(chinaSection?.open&&!chinaMounted){chinaMounted=true;mountMiyousheBrowserSync($('disc-mys-browser-sync'),chinaOptions());}};
  chinaSection?.addEventListener('toggle',mountChina);
  if(/^#miyoushe-sync=[0-9a-f]{32}$/.test(location.hash)&&chinaSection)chinaSection.open=true;
  mountChina();
  // End official sync sources mount.
  window.discPlanner={getState:()=>({ready:true,agentId:config.id,tier,alternative,busy,mode:planningMode,scope:planningScope,team:[...team],searching:!!searchTask,allocation:allocation?{met:allocation.met,steps:allocation.steps,blocked:allocation.blocked,guidanceOnly:allocation.guidanceOnly,baselineMet:allocation.baselineMet,changedSlots:allocation.changedSlots,retainedSlots:allocation.retainedSlots,search:allocation.search}:null}),getConfiguration:()=>clone(config),getAllocation:()=>allocation?clone(allocation):null};
}catch(e){$('disc-import-status').textContent=e.message;$('disc-fetch').disabled=true;}

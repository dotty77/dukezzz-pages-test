// Only the published Pages project uses the fixed DUKE API; never read an API host from input.
const API_ROOT=globalThis.location?.origin==='https://dotty77.github.io'&&globalThis.location.pathname.startsWith('/dukezzz-pages-test/')?'https://dukezzz.com':'';
const demoUrl='showcase-demo.json?v=20261117-disc-panel-launch-1';
import {mountMiyousheBrowserSync} from './mys-browser-sync.js?v=20261114-canonical-sync-1';
import {mountHoyolabSync} from './hoyolab-sync.js?v=20261114-canonical-sync-1';
import {officialToConfiguration} from './official-equipment.js?v=20261118-disc-context-score-launch-1';
import {scoreEquippedDisc,getDiscScoreProfile,SCORE_RULES,withDiscScoreDefaults} from './disc-score.js?v=20261118-disc-context-score-launch-1';
import {newConfiguration,normalizedToConfiguration,validateConfiguration,calculatePanel,formatProperty,resolveTargets,inspectDiscRolls,evaluateDiscContributions} from './disc-planner-core.js?v=20261121-equipment-scope-launch-1';
import {evaluateContext,assessUsable} from './disc-context.js?v=20261121-equipment-scope-launch-1';
import {renderPanelEffects,renderDiscFitScore,discFitMethod,formatPanelValue,renderSlotFiveGuide,renderSlotFiveSources} from './disc-panel-display.js?v=20261121-equipment-scope-launch-1';
import {applyPlanningScope} from './disc-scope.js?v=20260913-disc-planner-1';
const $=id=>document.getElementById(id),el=(tag,cls='',text='')=>{const n=document.createElement(tag);n.className=cls;n.textContent=text;return n;};
let data,builds,equipment,details,graduation,mechanics,abilityCatalog,config,alternative='',planIndex=0,team=['',''],tier='small',busy=false,controller,cacheUntil=0,cacheUid='';
let planningScope='solo',activeImport=null,preferredAgentId='';
let farmWorker=null,farmTimer,farmResult={status:'unknown'};
function scrollToDiscSection(id,focus=false){
  const target=document.getElementById(id);if(!target)return;
  if(focus){target.tabIndex=-1;target.focus({preventScroll:true});}
  target.style.scrollMarginTop=`${Math.ceil(document.querySelector('.site-header')?.getBoundingClientRect().height||74)+16}px`;
  target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
}
function mountBuildSettings(){
  const dialog=$('disc-character'), trigger=$('disc-settings-open');
  const open=()=>{
    if(dialog.open)return;
    dialog.showModal();
    $('disc-agent').focus({preventScroll:true});
  };
  trigger.disabled=false;
  trigger.addEventListener('click',open);
  dialog.addEventListener('change',({target})=>{
    if(target.id&&!target.isConnected)$(target.id)?.focus({preventScroll:true});
  });
  dialog.addEventListener('close',()=>{
    if(location.hash==='#disc-character')history.replaceState(history.state,'',location.pathname+location.search);
    trigger.focus({preventScroll:true});
  });
  const followLink=()=>{if(location.hash==='#disc-character')open();};
  window.addEventListener('hashchange',followLink);
  followLink();
}
// Section controls stay on this document even with a site-root <base>.
for(const control of document.querySelectorAll('[data-disc-section]')){
  control.addEventListener('click',()=>scrollToDiscSection(control.dataset.discSection,true));
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
  if(value.awakenedAbility===true)result.awakenedAbility=true;
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
  if(!['usable','small','large'].includes(value.tier))return null;
  const alt=mechanics.agents[configuration.id]?.alternatives?.find(a=>a.id===value.alternative);
  if(typeof value.alternative!=='string'||value.alternative!==''&&!alt)return null;
  const plans=alt?.sets||builds.agents[configuration.id]?.sets||[];
  if(!Number.isInteger(value.planIndex)||value.planIndex<0||value.planIndex>=Math.max(1,plans.length))return null;
  const scope=value.team.some(Boolean)?'team':'solo';if(value.scope!==scope)return null;
  // Older releases require this field when restoring a saved build.
  return {schema:'duke-disc-planner-current-1',config:configuration,team:[...value.team],scope,alternative:value.alternative,tier:value.tier,mode:'improve',planIndex:value.planIndex};
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
    const value=savedPlan({schema:'duke-disc-planner-current-1',config,team,scope:planningScope,alternative,tier,planIndex:Math.min(planIndex,count-1)});
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
  input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');
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
    b.conditionalMainStatIds=alt.conditionalMainStatIds;
    b.slot5Guide=alt.slot5Guide;
    b.effectiveSubstats={...b.effectiveSubstats,primaryIds:alt.primaryIds,secondaryIds:alt.secondaryIds,mode:alt.primaryIds.length?'core-substats':'supplement-only'};
    b.reasons=[alt.label,...alt.conditions];b.alternativeId=alt.id;b.alternativeSource=alt.sourceUrl;
    b.personalDamageSubstatsAreOptional=!!alt.personalDamageSubstatsAreOptional;
    if(alt.sets)b.sets=alt.sets;
    else{b.setsUnverified=true;b.reasons.push('下方套装沿用原搭配，仅作参考；本流派的套装尚未独立核实，请结合原文选择。');}
  }
  return withDiscScoreDefaults(b);
}
function currentContext(){return evaluateContext({config,team,scope:planningScope,build:currentBuild(),profile:graduation.agents[config.id],agent:details.agents[config.id],details,abilityAgents:abilityCatalog?.agents,alternative:mechanics.agents[config.id]?.alternatives?.find(a=>a.id===alternative)});}
function checkList(checks){const root=el('div','disc-context-checks');for(const c of checks){const card=el('details',`disc-context-check is-${c.status}`);card.dataset.check=c.id;card.open=c.status==='unmet';card.append(el('summary','',`${c.status==='met'?'✓ 已确认':c.status==='excluded'?'本次不核对':c.status==='unmet'?'需调整':'待确认'} · ${c.label}`),el('p','',c.reason));root.append(card);}return root;}
function queueFarmRefresh(){
  clearTimeout(farmTimer);
  farmWorker?.terminate();
  farmWorker=null;
  let status='calculating';
  if(validateConfiguration(config,data).length)status='invalid';
  else if(tier==='usable')status='usable';
  else if(!config.discs.some(d=>!d.absent&&d.subs.length))status='unknown';
  farmResult={status};
  updateFarmView();
  if(status==='calculating')farmTimer=setTimeout(estimateFarming,250);
}
function estimateFarming(){
  let worker;
  const finish=result=>{
    if(worker&&worker!==farmWorker)return;
    worker?.terminate();
    farmWorker=null;
    farmResult=result;
    updateFarmView();
  };
  try{
    worker=new Worker(new URL('./disc-planner-worker.js?v=20261121-equipment-scope-launch-1',import.meta.url),{type:'module'});
    farmWorker=worker;
    worker.onmessage=({data:message})=>finish(message.result||{status:'unavailable'});
    worker.onerror=event=>{event.preventDefault();finish({status:'unavailable'});};
    worker.onmessageerror=()=>finish({status:'unavailable'});
    worker.postMessage({operation:'farming',config,data,rows:targetRows().rows,build:currentBuild(),options:{scope:planningScope,useReference:true,planIndex}});
  }catch{finish({status:'unavailable'});}
}
function invalidate(){updateTargets();updateDiscScores();saveCurrentPlan();queueFarmRefresh();}
function setAgent(id,imported=null,rememberAgent=true){
  if(!data.agents[id])throw Error('该角色尚未收录正式服配装数据');
  if($('disc-slot-dialog').open)$('disc-slot-dialog').close();
  preferredAgentId=rememberAgent?String(id):'';
  config=maximumPlanningLevels(imported||newConfiguration(id,builds.agents[id],equipment,data));alternative='';planIndex=0;setPlanningTeam([]);
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
function changeTeammate(slot,id){
  const next=[...team];next[slot]=id;
  setPlanningTeam(next);invalidate();renderTeamControls();renderEvidence();
}
function renderTeamControls(){
  const ctx=$('disc-context-controls');ctx.replaceChildren();
  for(let i=0;i<2;i++)ctx.append(searchableTeammateField(`队友 ${i+1}`,Object.values(details.agents).filter(a=>String(a.id)!==String(config.id)),team[i],v=>changeTeammate(i,v),`disc-teammate-${i+1}`));
  ctx.append(selectField('输出方向（有双路线参考时）',[['','按当前机制方案'],['anomaly','异常路线'],['critical','双暴路线']],config.route||'',v=>{config.route=v;invalidate();}));
  const scopeNote=$('disc-scope-note');scopeNote.hidden=planningScope==='solo';scopeNote.replaceChildren(uiText('span','仅核对队伍条件，战斗增益需另行触发。','Team requirements checked. Combat buffs require their own triggers.'));
}
function renderPlans(){
  const root=$('disc-plan-controls'),b=currentBuild(),alts=mechanics.agents[config.id]?.alternatives||[];root.replaceChildren();
  root.append(selectField('玩法',[['','角色机制推荐'],...alts.map(a=>[a.id,a.label])],alternative,v=>{alternative=v;invalidate();renderPlans();renderSlots();renderEvidence();},'disc-alternative'));
  const plans=b.sets||[];root.append(selectField('四件套方案',plans.map((p,i)=>[i,`${equipment.discs[p.fourPieceId]?.name||'方案'} · ${p.label||i+1}`]),planIndex,v=>{planIndex=Number(v);applySetPlan();},'disc-set-plan'));
  const p=plans[planIndex]||plans[0];
  if(p){root.append(button('将此套装应用到未保留号位',applySetPlan));if(p.twoPieceIds?.length>1)root.append(selectField('二件套候选',p.twoPieceIds.map(id=>[id,equipment.discs[id]?.name||id]),config.discs[5].setId,v=>{for(const d of config.discs.filter(d=>d.slot>=5&&!d.locked))d.setId=v;invalidate();renderSlots();renderEvidence();}));}
  const notes=$('disc-build-notes');notes.replaceChildren(textList([...(b.reasons||[]),...(p?.conditions||[])]));
  if(b.alternativeSource)notes.append(link(b.alternativeSource,'查看此流派原文 ↗'));
}
function applySetPlan(){const p=currentBuild().sets?.[planIndex];if(!p)return;for(const d of config.discs)if(!d.locked)d.setId=String(d.slot<=4?p.fourPieceId:p.twoPieceIds?.[0]||'');invalidate();renderPlans();renderSlots();renderEvidence();}
function renderTiers(){
  const root=$('disc-tier-controls'),moveFocus=root.contains(document.activeElement);root.replaceChildren();
  for(const [id,title]of [['usable','能用'],['small','小毕业参考'],['large','大毕业参考']]){
    const b=button('',()=>{tier=id;renderTiers();invalidate();},'disc-tier');
    b.dataset.tier=id;b.setAttribute('aria-pressed',String(tier===id));b.append(el('strong','',title));root.append(b);
    if(tier===id&&moveFocus)b.focus({preventScroll:true});
  }
}
function targetRows(){
  const alt=mechanics.agents[config.id]?.alternatives?.find(a=>a.id===alternative),c={...config};
  if(alt){const map={11102:'hp',12102:'atk',13102:'def',20103:'critRate',21103:'critDmg',31203:'anomalyProficiency'};c.includeOptionalStatKeys=[...new Set(alt.primaryIds.map(id=>map[id]).filter(Boolean))];if(!c.route)c.route=alt.primaryIds.includes(31203)?'anomaly':alt.primaryIds.includes(20103)||alt.primaryIds.includes(21103)?'critical':'';}
  const result=resolveTargets(c,details.agents[config.id],graduation.agents[config.id],equipment,data,tier),context=currentContext();
  const scoped=applyPlanningScope({scope:planningScope,context,rows:result.rows.map(r=>({...r,contextBlocked:context.blockedTargetKeys.includes(r.key)}))});return {...result,...scoped};
}
const targetNumber = new Intl.NumberFormat('zh-CN', {maximumFractionDigits:2, useGrouping:false});
const signedGap = new Intl.NumberFormat('zh-CN', {maximumFractionDigits:2, signDisplay:'exceptZero'});

function targetAssessment(row,delta,partial){
  if(row.applicable===false)return 'inactive';
  if(row.scopeExcluded||row.contextBlocked)return 'pending';
  if(!row.planning&&row.bound!=='maximum')return 'inactive';
  if(delta===null)return 'pending';
  if(['in-combat','unspecified-combat-bonus'].includes(row.scope))return 'combat';
  if(!row.comparable&&!['initial-reference-unqualified','signature-conditioned'].includes(row.scope))return 'pending';
  if(row.bound==='maximum'){
    if(delta>0)return 'over';
    return partial?'pending':'met';
  }
  return delta<0?'short':'met';
}
function targetGap(row,current){
  if(!Number.isFinite(current)||!Number.isFinite(row.target))return {delta:null,zh:'—',en:'—'};
  const property=data.properties[row.group],scale=property.percent?100:property.divisor||1;
  // Subtract the rounded column values so the gap matches what the player sees.
  const delta=Number(targetNumber.format(current/scale))-Number(targetNumber.format(row.target));
  const amount=signedGap.format(delta);
  if(property.percent)return {delta,zh:amount+' 个百分点',en:amount+' pp'};
  if(row.group===305)return {delta,zh:amount+'/秒',en:amount+'/s'};
  return {delta,zh:amount,en:amount};
}
function targetNotes(rows){
  // Show rules shared by several stats once, keeping each stat-specific note named.
  const notes=new Map(),list=el('div','disc-target-notes');
  for(const row of rows){
    const add=(zh,en)=>{
      if(!zh)return;
      if(!notes.has(zh))notes.set(zh,{en,labels:new Set()});
      notes.get(zh).labels.add(row.label);
    };
    if(row.scopeExcluded)add('选择队友后核对队伍目标。','Team targets require selected teammates.');
    else if(row.comparable)add('比较场外面板。','Compares out-of-combat stats.');
    else if(row.scope==='initial')add('场外面板按核心 F 核对。','The out-of-combat target assumes Core F.');
    else if(row.scope==='signature-conditioned')add('参考值适用于专属音擎。','The benchmark assumes the signature W-Engine.');
    else if(row.scope==='initial-reference-unqualified')add('攻略未注明场内或场外，以当前面板对照。','The guide does not specify combat conditions. Comparison uses current stats.');
    else if(['in-combat','unspecified-combat-bonus'].includes(row.scope))add('战斗参考与当前面板的差值未计完整战斗增益。','Combat comparisons use current stats before all combat buffs.');
    else add('攻略未注明比较条件。','The guide does not specify comparison conditions.');
    if(row.contextBlocked&&!row.scopeExcluded)add('配队条件尚未满足或确认。','Team requirements are unmet or unconfirmed.');
    if(row.applicable===false&&row.requiresSignature)add('当前未装备专属音擎。','Signature W-Engine is not equipped.');
    if(String(config.id)==='1611'&&row.key==='critRate')add('当前值已含暴伤转暴率，战斗增益另计。','Current stats include CRIT DMG conversion before combat buffs.');
    for(const note of [row.configurationNote,row.note,row.scopeExclusionReason])add(note);
  }
  for(const [text,{en,labels}] of notes){
    const line=el('p');
    if(labels.size<rows.length){
      let first=true;
      for(const label of labels){
        if(!first)line.append(' / ');
        line.append(el('strong','',label));first=false;
      }
      line.append(' · ');
    }
    line.append(en?uiText('span',text,en):el('span','',text));list.append(line);
  }
  return list;
}
function renderProfileIdentity(){
  const agent=details.agents[config.id],engine=equipment.engines[config.weaponId];
  $('disc-profile-card').dataset.element=String(agent.elementId);
  const identity=$('disc-profile-identity');
  const meta=el('p','disc-profile-meta');
  meta.append(uiText('span',agent.element,agent.elementEn),' · ',uiText('span',agent.specialty,agent.specialtyEn),' · ',
    uiText('span',`规划 Lv.${config.level} · ${config.cinema} 影`,`Plan Lv.${config.level} · M${config.cinema}`));
  identity.replaceChildren(uiText('h2',agent.name,agent.nameEn,'disc-profile-name'),meta);

  const art=$('disc-profile-art');
  if(art.dataset.agent!==config.id){
    art.dataset.agent=config.id;art.alt='';art.hidden=false;art.classList.remove('is-avatar');
    art.onerror=()=>{art.onerror=()=>{art.hidden=true;};art.classList.add('is-avatar');art.src=agent.icon;};
    art.src=`assets/agent-portraits/agent-${agent.id}.webp`;
  }
  for(const control of $('disc-showcase-agents').querySelectorAll('[data-agent-id]')){
    control.setAttribute('aria-pressed',String(control.dataset.agentId===config.id));
  }
  const center=$('disc-profile-engine');center.replaceChildren();
  if(engine){
    const image=el('img');image.alt='';image.src=engine.icon;image.onerror=()=>{image.hidden=true;};
    center.append(image,uiText('strong',engine.name,engine.nameEn||engine.name),
      uiText('small',`Lv.${config.weaponLevel} · 叠影 ${config.refinement}`,`Lv.${config.weaponLevel} · R${config.refinement}`));
  }else center.append(uiText('strong','无音擎','No W-Engine'));
  const counts=new Map();
  for(const disc of config.discs){
    if(!disc.absent&&!disc.unsupported&&equipment.discs[disc.setId])counts.set(disc.setId,(counts.get(disc.setId)||0)+1);
  }
  const sets=$('disc-profile-sets');
  sets.replaceChildren(...[...counts].sort((a,b)=>b[1]-a[1]).map(([id,count])=>{
    const set=equipment.discs[id],item=el('span','disc-profile-set');
    item.append(el('b','',`×${count}`),uiText('span',set.name,set.nameEn||set.name));return item;
  }));
  if(!counts.size)sets.append(uiText('span','尚无套装记录','No sets recorded'));
}
function renderProfileStats(panel,targets){
  const stats=$('disc-profile-stats');stats.replaceChildren();
  if(!panel){
    stats.append(uiText('div','请先修正装备输入，再计算面板。','Correct the equipment entries to calculate stats.'));
    return;
  }
  const role=details.agents[config.id].specialty;
  const recovery=panel.values[324]>0?324:panel.values[320]>0?320:305;
  const groups=[...new Set([...targets.rows.filter(row=>row.applicable!==false).map(row=>Number(row.group)),
    ...({'异常':[312,314],'击破':[122],'命破':[123],'锋御':[213]}[role]||[]),121,111,131,201,211,recovery])];
  for(const group of groups.filter(id=>Number.isFinite(panel.values[id])).slice(0,8)){
    const entry=el('div');
    entry.dataset.group=String(group);
    const label=group===30502?uiText('dt','能量自动回复加成','Energy Regen bonus'):el('dt','',name(group));
    entry.append(label,uiText('dd',formatPanelValue(group,panel.values[group]),formatPanelValue(group,panel.values[group],'en-US')));
    stats.append(entry);
  }
}
function updateTargets(){
  renderProfileIdentity();
  const root=$('disc-stat-targets'),overview=$('disc-target-overview'),basisHost=$('disc-target-basis-host');
  const basisOpen=basisHost.firstElementChild?.open||false;
  root.replaceChildren();basisHost.replaceChildren();overview.replaceChildren();overview.hidden=true;
  const errors=validateConfiguration(config,data);
  $('disc-validation').textContent=errors.join('；');
  if(errors.length){renderProfileStats(null);return;}
  const panel=calculatePanel(config,data),targets=targetRows(),rows=targets.rows;
  renderProfileStats(panel,targets);
  const rollChecks=config.discs.map(d=>inspectDiscRolls(d,data)),partial=rollChecks.filter(r=>r.partial).length;
  const table=el('table','disc-table disc-target-list'),head=table.createTHead().insertRow(),body=table.createTBody();
  const columns=[['属性','Stat'],['当前','Now'],[tier==='usable'?'培养参考':'本档参考','Ref.'],['差额','Gap']];
  for(const [zh,en] of columns){const th=uiText('th',zh,en);th.scope='col';head.append(th);}
  let reached=0,compared=0;
  for(const r of rows){
    const value=panel.values[r.group],gap=targetGap(r,value),state=targetAssessment(r,gap.delta,partial);
    const row=body.insertRow(),stat=el('th','',r.label);
    row.dataset.state=state;stat.scope='row';
    if(r.scopeExcluded)row.dataset.teamConditional='true';
    if(['short','met','over'].includes(state))compared++;
    if(state==='met')reached++;
    const recorded=Number.isFinite(value)?fmt(r.group,value):'—';
    const target=Number.isFinite(r.target)?(r.bound==='maximum'?'≤ ':'')+r.target.toLocaleString('zh-CN',{maximumFractionDigits:2}):'—';
    const perSecond=r.group===305,unit=Number.isFinite(r.target)?r.unit||'':'';
    const gapCell=el('td','disc-target-gap');gapCell.append(uiText('span',gap.zh,gap.en,'disc-target-status'));
    const reference=el('td');
    reference.append(uiText('span',target+unit,target+(perSecond&&unit?'/s':unit),'disc-target-value'));
    if(r.optional)reference.append(' ',uiText('small','可选','optional'));
    row.append(stat,
      uiText('td',recorded+(perSecond&&Number.isFinite(value)?'/秒':''),recorded+(perSecond&&Number.isFinite(value)?'/s':'')),
      reference,gapCell);
  }
  if(compared){
    overview.append(el('strong','disc-target-count',`${reached} / ${compared}`),uiText('span','项达到参考','at benchmark','disc-target-count-label'));
    overview.hidden=false;
  }
  if(!rows.length){
    const row=body.insertRow(),cell=uiText('td',planningScope==='solo'?'暂无个人面板目标':'暂无队伍面板目标',planningScope==='solo'?'No personal stat targets':'No team stat targets');cell.colSpan=4;row.append(cell);
  }
  const wrap=el('div','disc-table-wrap');wrap.append(table);root.append(wrap);
  const empty=rollChecks.filter(r=>r.status==='absent').length;
  const missingZh=[],missingEn=[];
  if(partial){missingZh.push(`${partial} 张盘的副属性未录全`);missingEn.push(`partial substats on ${partial} ${partial===1?'disc':'discs'}`);}
  if(empty){missingZh.push(`${empty} 个号位为空`);missingEn.push(`${empty} empty ${empty===1?'slot':'slots'}`);}
  if(missingZh.length)root.append(uiText('p',`${missingZh.join('，')}，按已录入数值估算。`,`Estimate uses recorded stats (${missingEn.join(', ')}).`,'disc-muted'));
  if(config.core!==6)root.append(uiText('p','当前核心未到 F，部分目标待核对。','Some targets require Core F.','disc-warning'));
  if(equipment.engines[config.weaponId]&&equipment.engines[config.weaponId].profession!==details.agents[config.id].specialty)root.append(uiText('p','音擎特性不匹配，被动未生效。','The W-Engine passive requires a matching specialty.','disc-warning'));
  const context=currentContext(),checks=(tier==='usable'?assessUsable(config,currentBuild(),data,context):context.checks).filter(c=>c.id!=='extra-ability');
  const basis=el('details','disc-target-basis'),summary=uiText('summary','条件与换算','Conditions & calculations');
  const unmet=checks.filter(c=>c.status==='unmet').length;
  if(unmet){
    const title=uiText('span','条件与换算','Conditions & calculations');
    summary.replaceChildren(title,' · ',uiText('span',`${unmet} 项需调整`,`${unmet} ${unmet===1?'check':'checks'} to review`,'disc-target-needs-check'));
    delete summary.dataset.i18nEn;
  }
  basis.open=basisOpen;
  basis.append(summary);
  if(checks.length)basis.append(checkList(checks));
  basis.append(renderPanelEffects(panel.effects),targetNotes(rows));
  basisHost.append(basis);
}
function renderRollGuide(){
  const root=$('disc-roll-guide');root.replaceChildren();
  root.append(uiText('summary','S 级副词条数值','S-Rank substat values'));
  root.append(uiText('p','总份数 = 副属性数值 ÷ 单份数值。游戏中的 +3 对应 4 份。','Rolls = substat value ÷ value per roll. An in-game +3 counts as four rolls.'));
  const units=el('dl','disc-roll-units');
  for(const [id,value]of Object.entries(data.subBases)){const pair=el('div');pair.append(el('dt','',name(id)),el('dd','',`${fmt(id,value)} / 份`));units.append(pair);}root.append(units);
  root.append(uiText('p','S 级盘每 3 级强化一次。初始三条的满级共 8 份，初始四条的共 9 份。','S-Rank discs gain a roll every three levels. At Lv.15, a three-stat start totals eight rolls and a four-stat start totals nine.'));
  root.append(link('https://www.hoyolab.com/article/34243548','玩家教程：驱动光碟效果与词条介绍 · 第 3.1 节 ↗'));
}
function renderRollSummary(d){
  const count=inspectDiscRolls(d,data),box=el('div','disc-roll-summary');box.dataset.status=count.status;
  if(count.status==='absent'){box.append(el('strong','','空缺号位 · 不计入当前面板'));return box;}
  if(count.status==='unsupported'){box.append(el('strong','','原盘资料待核对 · 暂不统计份数'));return box;}
  box.append(el('strong','',`已填 ${count.rawTotalRolls??'待核对'} 份 · 本级应有 ${count.expectedTotalRolls??'待核对'} 份`));
  if(count.status==='invalid'){box.append(el('p','disc-warning',count.problems.join('；')||'条数或份数不符合当前盘的成长规则，请核对输入。'));return box;}
  const countDetails=sourceDetails('查看计数明细',[`已填 ${count.recordedTypes} 种 / 应有 ${count.expectedTypes} 种副属性。初始 ${count.initial} 份 + ${count.upgradeNodes} 次成长节点 = ${count.expectedTotalRolls} 份；该等级单项最多 ${count.maxRollsPerStat} 份。`]);countDetails.querySelector('summary').dataset.i18nEn='View roll count details';box.append(countDetails);
  if(!count.complete)box.append(el('p','disc-warning',`尚未填全：总份数少于本级应有份数 ${count.missingRolls} 份${count.missingTypes?`，还缺 ${count.missingTypes} 种副属性`:''}。当前只按已填写数值计算。`));
  return box;
}
// Per-agent reference score presentation.
function currentContributions(){
  return evaluateDiscContributions(config,data,tier==='usable'?[]:targetRows().rows,{scope:planningScope,useReference:true});
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
  for(const disc of config.discs){
    const contribution=contributions[disc.slot],score=scoreEquippedDisc(disc,build,data,config,contribution);
    renderOrbitSlot(disc,score);
    if($('disc-slot-dialog').open&&disc.slot===Number($('disc-slot-dialog').dataset.slot)){
      $('disc-slot-content').querySelector('.disc-card-score')?.replaceWith(renderDiscFitScore(score,contribution,'disc-card-score',{showDetails:false}));
    }
  }
  renderProfileRolls(build);renderScoreGuide();
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
  const score=scoreEquippedDisc(d,build,data,config,contribution);
  identity.append(art,renderDiscFitScore(score,contribution,'disc-card-score',{showDetails:false}));face.append(identity);
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
  face.append(subs);return face;
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
  updateDiscScores();
  const dialog=$('disc-slot-dialog');
  if(dialog.open)renderSlotDetail(config.discs.find(d=>d.slot===Number(dialog.dataset.slot)));
}
function renderSlotDetail(d){
  const root=$('disc-slot-content'),b=currentBuild();
  const editing=root.querySelector('.disc-slot-editor[open]')?.dataset.slot===String(d.slot);
  const focused=root.contains(document.activeElement)?document.activeElement.getAttribute('aria-label'):null;
  root.replaceChildren();
  const card=el('article','panel disc-slot');card.dataset.slot=d.slot;card.id='disc-card-'+d.slot;
  const head=el('div','disc-section-head disc-card-toolbar');head.append(checkbox('保留此盘',d.locked,v=>{d.locked=v;invalidate();}));
  card.append(head,renderDiscFace(d,b,currentContributions()[d.slot]));
  const slotFiveGuide=d.slot===5&&renderSlotFiveGuide(b);
  if(slotFiveGuide){
    const advice=el('p','disc-slot-main-guide');advice.append(slotFiveGuide);card.append(advice);
  }
  const editor=el('details','disc-slot-editor');editor.dataset.slot=d.slot;editor.open=editing;editor.append(uiText('summary','编辑当前盘','Edit current disc'));
  if(d.absent)card.append(el('p','disc-warning','展柜未提供此盘。当前不计入面板；下面填写的是待补目标。'),button('加入此号位的目标盘',()=>{d.absent=false;invalidate();renderSlots();}));
  if(d.unsupported)card.append(el('p','disc-warning',d.unsupportedReason||'原盘为非S级或属性资料不一致，未按金盘计算。'),button('改为S级15级空白目标',()=>{d.unsupported=false;delete d.unsupportedReason;delete d.unsupportedReasons;d.absent=false;d.level=15;d.initial=4;d.subs=[];invalidate();renderSlots();}));
  const fields=el('div','disc-slot-fields');fields.append(selectField(`${d.slot}号位套装`,[['','未选择'],...Object.values(equipment.discs).map(s=>[s.id,s.name])],d.setId,v=>{d.setId=v;invalidate();renderSlots();renderEvidence();}));
  const recommended=d.slot<=3?Object.keys(data.mainBases[d.slot]).map(Number):(b.mainStatIds[d.slot]||[]).map(Number),conditional=(b.conditionalMainStatIds?.[d.slot]||[]).map(Number);
  fields.append(selectField(`${d.slot}号位主属性`,Object.keys(data.mainBases[d.slot]).map(id=>[id,`${name(id)} ${fmt(id,data.mainBases[d.slot][id]*4)}${recommended.includes(Number(id))?' · 推荐':conditional.includes(Number(id))?' · 条件备选':''}`]),d.mainId,v=>{d.mainId=Number(v);d.subs=d.subs.filter(s=>Number(s.id)!==d.mainId);invalidate();renderSlots();}),numberField(`${d.slot}号盘等级`,d.level,0,15,v=>{d.level=v;invalidate();renderSlots();}),selectField(`${d.slot}号盘初始副属性`,[...([3,4].includes(d.initial)?[]:[['unknown','未确认 · 请核对原盘']]),[3,'3条 · 满级8份'],[4,'4条 · 满级9份']],[3,4].includes(d.initial)?d.initial:'unknown',v=>{if(v==='unknown')return;d.initial=Number(v);invalidate();renderSlots();}));editor.append(fields);
  const mainNote=slotFiveGuide?'':`主属性建议：${recommended.map(id=>name(id)).join(' / ')}。`;
  const rec=el('p','disc-slot-recommend',`${mainNote}优先副属性：${(b.effectiveSubstats?.primaryIds||[]).filter(id=>Number(id)!==d.mainId).map(id=>name(id)).join('、')||'按循环与功能判断'}。`);editor.append(rec);
  const subgrid=el('div','disc-sub-grid'),conversions=[];
  const feedback=el('p','disc-input-error');feedback.setAttribute('role','alert');editor.append(feedback);
  for(let i=0;i<4;i++){
    const sub=d.subs[i],line=el('div','disc-sub-row');
    const statField=selectField(`${d.slot}号盘副属性${i+1}`,[['','未填写'],...Object.keys(data.subBases).filter(id=>Number(id)!==d.mainId).map(id=>[id,name(id)])],sub?.id||'',v=>{
      if(v&&d.subs.some((other,j)=>j!==i&&other.id===Number(v))){
        statField.querySelector('select').value=sub?.id||'';
        feedback.replaceChildren(uiText('span','同一张盘不能有重复副属性。','Each substat must be unique on a disc.'));
        return;
      }
      if(v){d.subs[i]={id:Number(v),rolls:sub?.rolls||1};d.subs=d.subs.filter(Boolean);}
      else d.subs.splice(i,1);
      invalidate();renderSlots();
    });
    line.append(statField,selectField(`${d.slot}号盘副属性${i+1}总份数`,range(6,1).map(([n])=>[n,`${n}份`]),sub?.rolls||1,v=>{if(d.subs[i])d.subs[i].rolls=Number(v);invalidate();renderSlots();}));
    if(sub){
      const raw=data.subBases[sub.id]*sub.rolls;line.append(el('span','disc-sub-value',fmt(sub.id,raw)));
      if(Number.isInteger(sub.rolls)&&sub.rolls>=1&&data.subBases[sub.id])conversions.push(`${fmt(sub.id,raw)} ÷ ${fmt(sub.id,data.subBases[sub.id])} = ${sub.rolls} 份；${sub.rolls===1?'首次出现，尚未追加。':`游戏标记 +${sub.rolls-1}（追加 ${sub.rolls-1} 次）。`}`);
    }subgrid.append(line);
  }
  editor.append(subgrid);if(conversions.length){const conversionDetails=sourceDetails('份数换算',conversions);conversionDetails.querySelector('summary').dataset.i18nEn='Roll calculations';editor.append(conversionDetails);}card.append(editor,renderDiscCountDetails(d));root.append(card);
  if(focused)Array.from(editor.querySelectorAll('[aria-label]')).find(field=>field.getAttribute('aria-label')===focused)?.focus({preventScroll:true});
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
  title.append(slotDetailButton(entry.slot));
  const set=equipment.discs[entry.setId];
  if(set?.name){title.append(' · ',uiText('span',set.name,set.nameEn||''));}
  if(tune)title.append(' · ',el('span','',name(entry.mainId)));
  body.append(title);
  if(tune){
    const gain=farmChance(entry.tuningGain);
    body.append(uiText('p',`定向主属性平均额外补足 ${gain} 缺口（保守估算）。`,`Fixing the main stat closes an extra ${gain} of the gap on average (conservative estimate).`));
  }else{
    const chance=farmChance(entry.randomChance,entry.randomChanceMax);
    body.append(uiText('p',`该套装随机 S 盘改善此号位的概率约 ${chance}。`,`Chance per random S-Rank disc from this set to improve this slot: ${chance}.`));
  }
  row.append(body);return row;
}
function renderFarmAdvice(){
  const root=$('disc-farm-advice'),farm=farmResult,status=farm.status;
  root.replaceChildren();root.hidden=false;
  root.dataset.status=status;
  const heading=uiText('h3','还值得刷吗？','Worth farming?');heading.setAttribute('aria-level','2');root.append(heading);
  if(status==='invalid'){
    const slots=config.discs.filter(d=>inspectDiscRolls(d,data).invalid).map(d=>d.slot);
    root.append(slots.length?uiText('p',`请核对 ${slots.join('、')} 号盘的装备记录。`,`Check the equipment in slot(s) ${slots.join(', ')}.`):
      uiText('p','请核对角色和音擎配置。','Check the agent and W-Engine settings.'));
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
      calculating:['正在估算优先刷哪个号位…','Estimating farming priorities for this build…'],
      met:farm?.partial?['按已录入属性，本次面板下限已达到，先保留现有盘。','The recorded stats already meet the target minimums. Keep your discs.']:['已达到本次可比较的面板目标，先保留现有盘和校音器。','Your build meets the comparable targets. Keep your discs and save the Calibrator.'],
      locked:['所有可调整号位都已锁定，先保留校音器。','All eligible slots are locked. Save the Calibrator.'],
      'no-targets':['当前条件下没有可比较的面板目标，先按角色建议选择套装和主属性。','There are no comparable stat targets for this setup. Follow the agent’s recommended sets and main stats.'],
      unknown:farm?.reason==='partial-ceiling'?['已录入的面板在参考范围内。补全副属性即可复核上限，再决定是否继续刷。','The recorded stats are within the reference range. Complete the missing substats to check the cap before farming.']:['缺少驱动盘属性，暂无法估算。','Disc stats are needed for an estimate.'],
      'no-gain':['按本次目标，单换一张盘暂未找到能改善的号位。先保留校音器。','No single replacement improved the current targets in this model. Save the Calibrator.'],
      usable:['能用档先看套装与主属性，暂不需要为面板目标消耗校音器。','For the usable tier, focus on sets and main stats. Save the Calibrator for a stat target.'],
      unavailable:['刷盘建议暂时未能算出。','Farming advice could not be calculated.']
    }[status]||[];
    root.append(uiText('p',text[0]||'',text[1]||''));
    if(status==='unavailable'){
      const retry=button('',queueFarmRefresh);retry.append(uiText('span','重新估算','Retry estimate'));root.append(retry);
    }
    return;
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
  root.append(method);
}
function rollPriority(profile,id){
  if(!(profile.weights[id]>0))return 'other';
  return profile.primaryIds.includes(Number(id))?'primary':'secondary';
}
function slotDetailButton(slot){
  const control=button('',event=>showProfileSlot(slot,event.currentTarget),'disc-slot-link');
  control.append(uiText('span',`${slot}号位`,`Slot ${slot}`));
  control.dataset.detailSlot=slot;
  control.setAttribute('aria-controls','disc-slot-dialog');
  control.setAttribute('aria-haspopup','dialog');
  return control;
}
let slotOpener;
function showProfileSlot(slot,trigger){
  const dialog=$('disc-slot-dialog'),disc=config.discs.find(entry=>entry.slot===slot);
  if(!disc||dialog.open)return;
  slotOpener=trigger;
  dialog.dataset.slot=slot;
  $('disc-slot-title').replaceChildren(uiText('span',`${slot}号驱动盘`,`Drive Disc · Slot ${slot}`));
  renderSlotDetail(disc);
  dialog.showModal();
  dialog.scrollTop=0;
}
$('disc-slot-dialog').addEventListener('close',()=>{
  const dialog=$('disc-slot-dialog');
  if(dialog.open)return;
  const slot=dialog.dataset.slot;
  $('disc-slot-content').replaceChildren();
  delete dialog.dataset.slot;
  for(const guide of dialog.querySelectorAll('details[open]'))guide.open=false;
  const farm=slotOpener?.closest('[data-farm-action]')?.dataset.farmAction;
  const fallback=farm?document.querySelector(`[data-farm-action="${farm}"] [data-detail-slot="${slot}"]`):null;
  const origin=slotOpener?.isConnected?slotOpener:fallback||document.querySelector(`[data-jump-slot="${slot}"]`);
  if(origin?.getClientRects().length)origin.focus({preventScroll:true});
  else $('disc-view-stats').focus({preventScroll:true});
  slotOpener=null;
});
function renderOrbitSlot(disc,score){
  const index=$('disc-slot-index'),slot=disc.slot;
  let control=index.querySelector(`[data-jump-slot="${slot}"]`);
  if(!control){
    control=button('',event=>showProfileSlot(slot,event.currentTarget));
    control.dataset.jumpSlot=slot;control.setAttribute('aria-controls','disc-slot-dialog');
    control.setAttribute('aria-haspopup','dialog');
    index.append(control);
  }
  const grade=score.grade||score.estimatedGrade||'';
  Object.assign(control.dataset,{grade,status:score.status,gradeType:score.estimatedGrade?'estimated':grade?'final':'none'});
  control.classList.toggle('is-locked',Boolean(disc.locked));
  const icon=disc.absent?'':equipment.discs[disc.setId]?.icon;
  const image=control.querySelector('img')||el('img');
  image.alt='';image.width=52;image.height=52;
  if(icon&&image.getAttribute('src')!==icon)image.src=icon;
  if(!icon)image.removeAttribute('src');
  image.hidden=!icon;
  const label=uiText('span',`${slot}号位`,`Slot ${slot}`,'disc-orbit-label');
  const scoreText=Number.isFinite(score.score)?String(score.score):'—';
  const value=score.estimatedGrade?uiText('span','约 '+scoreText,'Est. '+scoreText,'disc-orbit-score'):el('span','disc-orbit-score',scoreText);
  const gradeLabel=el('span','disc-orbit-grade',grade||'—');
  if(!grade){
    const reason={absent:['空缺号位','Empty slot'],empty:['待填副词条','Needs substats'],unsupported:['资料待核对','Unverified data'],invalid:['词条有误','Invalid stats']}[score.status]||['暂未评分','Unrated'];
    value.replaceChildren(uiText('span',...reason));
  }
  const stats=el('span','disc-orbit-stats'),count=inspectDiscRolls(disc,data);
  if(!['complete','partial'].includes(count.status)){
    const absent=count.status==='absent';
    stats.append(uiText('span',absent?'空缺号位':'资料待核对',absent?'Empty slot':'Unverified data'));
  }else{
    stats.append(el('span','disc-orbit-main',name(disc.mainId)));
    for(const line of count.lines){
      const row=el('span');row.dataset.priority=rollPriority(score.profile,line.id);
      row.append(el('span','',name(line.id)));
      if(line.additionalRolls>0)row.append(el('b','','+'+line.additionalRolls));
      stats.append(row);
    }
    if(!count.lines.length)stats.append(uiText('span','未录入副词条','No substats entered'));
  }
  control.replaceChildren(image,label,gradeLabel,value,stats);
}
function renderProfileRolls(build){
  const root=$('disc-profile-rolls'),profile=getDiscScoreProfile(build,data,config),totals=new Map();
  let complete=0,recorded=0;
  for(const disc of config.discs){
    const count=inspectDiscRolls(disc,data);
    if(!['complete','partial'].includes(count.status))continue;
    if(count.complete)complete++;
    for(const line of count.lines){
      recorded+=line.rolls;
      if(profile.weights[line.id]>0)totals.set(line.id,(totals.get(line.id)||0)+line.rolls);
    }
  }
  const label=complete===6?['有效词条份数','Effective substat rolls']:['已录入有效词条份数','Recorded effective rolls'];
  root.replaceChildren(uiText('span',...label,'disc-roll-total-label'));
  for(const [id,rolls]of [...totals].sort((a,b)=>b[1]-a[1]||a[0]-b[0])){
    const chip=el('span','disc-roll-chip');chip.dataset.priority=rollPriority(profile,id);
    chip.append(el('b','',String(rolls)),el('span','',name(id)));root.append(chip);
  }
  if(!totals.size){
    if(!recorded)root.append(uiText('span','待录入','No recorded rolls'));
    else if(!profile.available)root.append(uiText('span','暂无角色权重','No agent weights'));
    else root.append(el('b','','0'));
  }
}
function updateFarmView(){
  renderFarmAdvice();
  const priority=farmResult.priority?.slot;
  for(const control of $('disc-slot-index').querySelectorAll('[data-jump-slot]')){
    control.classList.toggle('is-priority',Number(control.dataset.jumpSlot)===priority);
  }
}
function renderEvidence(){
  const root=$('disc-evidence'),a=details.agents[config.id],m=mechanics.agents[config.id]||{},b=currentBuild();root.replaceChildren();
  root.append(uiText('p','按装备面板估算，技能加成见「条件与换算」。音擎被动、套装战斗效果和队友增益另计。小毕业取攻略区间下限，大毕业取上限。','Estimates follow the equipment screen. See Conditions & calculations for skill bonuses. W-Engine passives, combat set effects and team buffs are evaluated separately. The two reference tiers use the lower and upper guide targets, where available.','disc-muted'));
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
  const guideUrl=graduation.agents[config.id]?.source?.url;
  if(guideUrl&&![b.slot5Guide?.sourceUrl,b.slot5Guide?.otherSourceUrl].includes(guideUrl))root.append(link(guideUrl,'逐角色攻略原文 ↗'));
  root.append(renderSlotFiveSources(b.slot5Guide));
}
function skillText(s,context=config){
  const levels=s.levels||s.variants||[];
  if(Array.isArray(levels)&&levels.length){const requested=s.levelType==='核心强化'?context.core+1:12+(context.cinema>=3?2:0)+(context.cinema>=5?2:0),found=levels.find(l=>l.level===requested);if(found)return [`${s.levelType==='核心强化'?`核心${context.core?'ABCDEF'[context.core-1]:'基础'}`:`招式培养12级，影画加成后${requested}级`}：`,found.description||found.text||s.description];return ['当前来源未提供所选等级完整文本；以下为基础说明，精确数值请在完整资料页核对。\n',s.description||''];}
  return [s.description||s.text||'请在完整技能页切换等级查看。'];
}
function renderAll(){renderConfig();renderPlans();renderTiers();renderRollGuide();renderSlots();updateTargets();renderEvidence();saveCurrentPlan();queueFarmRefresh();}
function setBusy(value){busy=value;$('disc-fetch').disabled=value;$('disc-demo').disabled=value;$('disc-cancel').hidden=!value;}
// Only this page retains the latest source. Selecting a role starts from a copy of its imported equipment.
function selectPlannerAgent(id){
  const imported=activeImport?.configs.get(id);
  setAgent(id,imported?clone(imported):null);
  if(imported){
    const plan=activeImport.plan;
    if(plan){
      setPlanningTeam(plan.team);alternative=plan.alternative;tier=plan.tier;planIndex=plan.planIndex;renderAll();
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
  const buttons=[...configs.keys()].map(id=>{
    const agent=details.agents[id],control=button('',()=>selectPlannerAgent(id),'disc-profile-agent'),image=el('img');
    image.src=agent.icon;image.alt='';image.width=36;image.height=36;
    control.append(image,uiText('span',agent.name,agent.nameEn));control.dataset.agentId=id;
    control.setAttribute('aria-pressed',String(config.id===id));return control;
  });
  const notice=isDemo?['已载入示例配装。','Example build loaded.']:
    ['已载入公开配装。','Public build loaded.'];
  activeImport={configs,notice};$('disc-showcase-agents').replaceChildren(...buttons);
  const first=isDemo?agents.reduce((best,a)=>(a.discs?.length||0)>(best.discs?.length||0)?a:best):agents[0];
  selectPlannerAgent(!isDemo&&configs.has(preferredAgentId)?preferredAgentId:String(first.id));
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
$('disc-export').onclick=()=>{const errors=validateConfiguration(config,data);if(errors.length){$('disc-validation').textContent=errors.join('；');return;}const blob=new Blob([JSON.stringify({schema:'bagel-disc-plan-1',config,team,scope:planningScope,alternative,tier,mode:'improve'},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=`${details.agents[config.id].name}-驱动盘方案.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
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
      tier:['usable','small','large'].includes(x.tier)?x.tier:'small',planIndex:0};
    loadSingleAgent(imported,['已导入方案。','Plan imported.'],plan);
  }catch(error){
    if(controller===request)$('disc-import-status').textContent=`导入失败：${error.message}`;
  }finally{
    if(controller===request)$('disc-file-status').replaceChildren(...[...$('disc-import-status').childNodes].map(node=>node.cloneNode(true)));
    endImport(request);
  }
};
try{
  const paths=['disc-planner-data.json?v=20261121-equipment-scope-launch-1','agent-builds.json?v=20261121-equipment-scope-launch-1','agent-equipment.json?v=20261111-refresh-launch-1','agent-details.json?v=20261111-refresh-launch-1','agent-graduation.json?v=20261027-agents-launch-1','disc-planner-mechanics.json?v=20261121-equipment-scope-launch-1'];
  const read=async p=>{const r=await fetch(p);if(!r.ok)throw Error(`资料读取失败：${p}`);return r.json();};
  const abilities=read('team-abilities.json?v=20261121-equipment-scope-launch-1').catch(()=>null);
  [data,builds,equipment,details,graduation,mechanics,abilityCatalog]=await Promise.all([...paths.map(read),abilities]);
  const requested=new URL(location.href).searchParams.get('agent'),remembered=readSavedPlan();
  const restore=remembered&&(!Object.hasOwn(data.agents,requested)||requested===remembered.config.id);
  if(restore){
    loadSingleAgent(remembered.config,['已恢复此浏览器最近的配装。','Restored the last build saved in this browser.'],remembered);
  }else if(Object.hasOwn(data.agents,requested))setAgent(requested);
  else setAgent('1611',null,false);
  let transferred=false;
  try{const raw=sessionStorage.getItem('bagel-disc-planner-handoff');if(raw){sessionStorage.removeItem('bagel-disc-planner-handoff');const a=JSON.parse(raw);if(data.agents[String(a.id)]){tier=['usable','small','large'].includes(a.planningTier)?a.planningTier:'small';loadSingleAgent(normalizedToConfiguration(a,data),['已载入展柜配装。','Showcase build loaded.']);transferred=true;}}}catch{}
  planStorageReady=true;if(transferred||Object.hasOwn(data.agents,requested)&&!restore)saveCurrentPlan();
  // Official sync sources mount.
  const importOfficial=(agent,meta)=>{
    const imported=maximumPlanningLevels(officialToConfiguration(agent,data));
    if(String(imported.id)!==String(meta.agentId))throw Error('官方返回角色与所选角色不一致');
    const errors=validateConfiguration(imported,data);if(errors.length)throw Error(errors.join('；'));
    cancelImport();
    const provider=meta.source==='hoyolab'?'HoYoLAB':'米游社',providerEn=meta.source==='hoyolab'?'HoYoLAB':'Miyoushe';
    loadSingleAgent(imported,[`已同步${provider}配装。`,`${providerEn} build synced.`]);
  };
  if(/^#(?:hoyolab-sync=[0-9a-f]{32}|disc-hoyolab-sync)$/.test(location.hash))$('disc-global-sync').open=true;
  mountHoyolabSync($('disc-hoyolab-sync'),{getAgentId:()=>config.id,getAgentName:id=>details.agents[id]?.name||'',onImport:importOfficial,restoredBuild:!!restore&&!transferred});
  const chinaSection=$('disc-cn-sync');let chinaMounted=false;
  const chinaOptions=()=>({getAgentId:()=>config.id,getAgentName:id=>details.agents[id]?.name||'',onImport:importOfficial,restoredBuild:!!restore&&!transferred});
  const mountChina=()=>{if(chinaSection?.open&&!chinaMounted){chinaMounted=true;mountMiyousheBrowserSync($('disc-mys-browser-sync'),chinaOptions());}};
  chinaSection?.addEventListener('toggle',mountChina);
  if(/^#miyoushe-sync=[0-9a-f]{32}$/.test(location.hash)&&chinaSection)chinaSection.open=true;
  mountChina();
  mountBuildSettings();
  // End official sync sources mount.
  window.discPlanner={
    getState:()=>({ready:true,agentId:config.id,tier,alternative,busy,scope:planningScope,team:[...team],searching:farmResult.status==='calculating',farmingStatus:farmResult.status}),
    getConfiguration:()=>clone(config),getFarming:()=>clone(farmResult)
  };
}catch(e){$('disc-import-status').textContent=e.message;$('disc-fetch').disabled=true;}

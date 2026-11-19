// Only the published Pages project uses the fixed DUKE API; never read an API host from input.
const API_ROOT=globalThis.location?.origin==='https://dotty77.github.io'&&globalThis.location.pathname.startsWith('/dukezzz-pages-test/')?'https://dukezzz.com':'';
const demoUrl='showcase-demo.json?v=20261117-disc-panel-launch-1';
import {scoreAgent} from './showcase-analysis.js?v=20261114-showcase-review-1';
import {getDiscScoreProfile,scoreEquippedDisc,withDiscScoreDefaults} from './disc-score.js?v=20261118-disc-context-score-launch-1';
import {applyPanelMechanics,calculatePanel,evaluateDiscContributions,normalizedToConfiguration,resolveTargets,validateConfiguration} from './disc-planner-core.js?v=20261118-disc-context-score-launch-1';
import {assessUsable,evaluateContext} from './disc-context.js?v=20261027-gachabase-all-1';
import {applyPlanningScope} from './disc-scope.js?v=20260913-disc-planner-1';
import {renderPanelEffects,renderDiscFitScore,discFitMethod,formatPanelValue} from './disc-panel-display.js?v=20261118-reviewed-ui-launch-1';
import {SUBSTAT_OPTIONS,CORE_OPTIONS,MAX_CORE_ATTRIBUTES,substatName,referenceSelection,setSelection,selectionBuild,countOccurrences} from './showcase-preferences.js?v=20261117-disc-farm-matching-launch-1';
import {ARTICLE_REFERENCE,evaluateArticleRules} from './showcase-article-rules.js?v=20260909-version-3-2-1';
const $=id=>document.getElementById(id);
const el=(tag,cls='',text='')=>{const node=document.createElement(tag);node.className=cls;node.textContent=text;return node;};
let result=null,selectedId='',builds={},equipment={},details={},portraits={},isDemo=false,busy=false,controller=null;
let panelData=null,graduation=null,graduationTier='small',cacheDeadline=0,cacheTimer=null,previousData=false;
const attributeChoices=new Map(),supplementPanels=new Set(),preferenceMessages=new Map();
const tones={物理:'#b39b6e',火:'#d47b67',冰:'#6cabb7',电:'#9174b4',以太:'#c777a0',烈霜:'#6eadd0',风:'#67ad91',流明:'#c5a56a',玄墨:'#8266b3'};
function img(path,cls=''){const image=el('img',cls);image.alt='';image.decoding='async';if(/^assets\/[\w/-]+\.(?:webp|png|jpg)$/.test(path||''))image.src=path;else image.hidden=true;image.onerror=()=>{image.hidden=true;};return image;}
function message(value,tone='info'){$('showcase-status').textContent=value;$('showcase-status').dataset.tone=tone;}
function section(title,description){const node=el('section','showcase-section');node.append(el('h3','',title));if(description)node.append(el('p','section-note',description));return node;}
function notes(title,entries){const node=el('details','showcase-panel-notes');node.append(el('summary','',title));const list=el('ul');for(const entry of entries)list.append(el('li','',entry));node.append(list);return node;}
function statRows(stats,cls){const grid=el('div',cls);for(const stat of stats||[]){const row=el('div');row.append(el('span','',stat.name),el('strong','',stat.formatted??String(stat.value)));grid.append(row);}return grid;}
function agentPanel(agent,panel){
  const stats=agent.stats||[];
  if(!panelData){
    const box=section('代理人属性',agent.statsLabel||'基础装备面板估算');
    const notice=el('p','section-note','未能读取核心技能数据，刷新后可查看转换明细。');
    notice.dataset.i18nEn='Core Skill data could not be loaded. Refresh to see the conversions.';
    box.append(statRows(stats,'showcase-stat-grid'),notice);
    return box;
  }
  const {values,effects}=panel;
  const rows=stats.map(row=>{
    const value=values[row.propertyId];
    return value===row.value ? row : {...row,value,formatted:formatPanelValue(row.propertyId,value)};
  });
  const box=section('代理人属性');
  const includesPassive=effects.some(effect=>effect.scope==='passive');
  const label=el('p','section-note',includesPassive?'装备与角色被动估算':agent.statsLabel||'基础装备面板估算');
  if(includesPassive)label.dataset.i18nEn='Equipment and personal passive estimate';
  // Older API responses can still carry the former conversion warning.
  const scopeNotes=(agent.notes||[]).filter(note=>!panelData.panelMechanics?.[agent.id]||!(/局外/.test(note)&&/尚未计入|未计入基础装备面板/.test(note)&&/核对/.test(note)));
  const scope=notes('面板计算范围',scopeNotes);
  if(includesPassive&&scopeNotes[0]?.startsWith('面板为基础装备估算')){
    const baseNote=scope.querySelector('li');
    baseNote.textContent='装备部分包括角色成长、突破、核心强化属性、音擎属性、驱动盘主副词条和 2 件套效果。';
    baseNote.dataset.i18nEn='The equipment subtotal includes Agent growth, promotions, Core Skill stat nodes, W-Engine stats, disc stats, and 2-piece set effects.';
  }
  box.append(label,statRows(rows,'showcase-stat-grid'),renderPanelEffects(effects),scope);
  return box;
}
function localized(tag,zh,en,cls=''){
  const node=el(tag,cls,zh);node.dataset.i18nEn=en;return node;
}
function personalTargets(agent,guide,reference,config,values){
  const profile=graduation?.agents?.[config.id],out={profile,rows:[],contributions:{}};
  if(!guide?.id||!Number.isInteger(config.cinema))return out;
  const context=evaluateContext({scope:'solo',config,profile:profile||{},agent:guide,details,build:reference||{}});
  const incomplete=(agent.notes||[]).some(s=>/尚未收录，未将|尚未计入/.test(s)&&/音擎尚未收录|驱动盘尚未收录|潜能强化/.test(s));
  const knownEquipment=!validateConfiguration(config,panelData).length;
  if(graduationTier==='usable'||!profile){
    if(graduationTier==='usable')out.checks=assessUsable(config,reference||{},panelData,context);
    if(knownEquipment&&!incomplete)out.contributions=evaluateDiscContributions(config,panelData,[],{scope:'solo'});
    return out;
  }
  const resolved=resolveTargets(config,guide,profile,equipment,panelData,graduationTier);
  const scoped=applyPlanningScope({scope:'solo',context,rows:resolved.rows});
  // Energy Regen bonus is a percentage of base Regen, a different stat from Regen/s.
  const missingBonus=scoped.rows.some(r=>r.group===30502)&&!Number.isFinite(values[30502]);
  if(missingBonus&&knownEquipment)values[30502]=calculatePanel(config,panelData).values[30502];
  for(const row of scoped.rows){
    if(!Number.isFinite(row.targetRaw))continue;
    const current=values[row.group],cap=row.bound==='maximum';
    let reason;
    if(row.applicable===false)reason=['此目标要求专属音擎','Requires the signature W-Engine'];
    else if(row.scopeExcluded||context.blockedTargetKeys.includes(row.key))reason=['需确认队伍条件','Requires a confirmed squad'];
    else if(row.choiceGroup||row.optional)reason=['可选培养路线','Optional build route'];
    else if(['in-combat','unspecified-combat-bonus'].includes(row.scope))reason=['需要战斗增益','Requires combat buffs'];
    else if(row.scope==='initial'&&config.core!==6)reason=['目标按核心 F 计算','Target assumes Core F'];
    else if(row.bound==='mechanic-threshold'&&config.id==='1151'&&agent.skills?.find(s=>s.id===1)?.baseLevel!==12)reason=['目标按基础特殊技 12 级计算','Target assumes base Special Attack Lv. 12'];
    else if(!row.planning&&!cap||!['initial','initial-reference-unqualified','signature-conditioned'].includes(row.scope))reason=['参考条件未明确','Reference conditions unspecified'];
    else if(incomplete||!Number.isFinite(current))reason=['展柜资料不足','Insufficient showcase data'];
    const diff=Number((current-row.targetRaw).toFixed(6)),met=cap?diff<=0:diff>=0;
    out.rows.push({...row,current,cap,diff,reason,status:reason?'excluded':met?'met':cap?'over':'short'});
  }
  if(knownEquipment&&!incomplete)out.contributions=evaluateDiscContributions(config,panelData,out.rows.filter(r=>!r.reason),{scope:'solo',useReference:true});
  return out;
}
function targetLine(row){
  const node=el('div','showcase-target-line');node.dataset.targetStatus=row.status;node.dataset.stat=String(row.group);
  const title=el('strong','',row.label),numbers=el('span','showcase-target-values');
  const value=(raw,lang)=>formatPanelValue(row.group,raw,lang),sign=row.cap?'≤ ':'';
  numbers.append(localized('span',value(row.current),value(row.current,'en-US')),' / ',localized('span',sign+value(row.targetRaw),sign+value(row.targetRaw,'en-US')));
  node.append(title,numbers);
  if(row.reason){node.append(localized('span',...row.reason,'showcase-target-status'));return node;}
  const bar=el('progress');bar.max=100;
  const ratio=row.cap?(row.current<=row.targetRaw?1:row.targetRaw/row.current):row.targetRaw?row.current/row.targetRaw:1;
  bar.value=Math.max(0,Math.min(100,ratio*100));
  bar.setAttribute('aria-label',row.label);node.append(bar);
  const zh=value(Math.abs(row.diff)).replace('%',' 个百分点'),en=value(Math.abs(row.diff),'en-US').replace('%',' percentage points');
  const label=row.status==='met'?(row.cap?['符合上限','Within cap']:['已达到参考','Target met']):row.cap?[`高出上限 ${zh}`,`${en} above cap`]:[`还差 ${zh}`,`${en} short`];
  const rounded=Number((ratio*100).toFixed(1));
  const percent=row.cap?'':`${row.status==='short'?Math.min(99.9,rounded):rounded}% · `;
  node.append(localized('span',percent+label[0],percent+label[1],'showcase-target-status'));return node;
}
function usableCheck(check){
  const row=el('details','showcase-usable-check');row.dataset.check=check.id;row.dataset.status=check.status;
  const header=el('summary'),labels={met:['已确认','Confirmed'],unmet:['需调整','Needs adjustment'],unknown:['待确认','Unverified'],excluded:['本档不核对','Outside this check']};
  header.append(el('span','',check.label),localized('strong',...(labels[check.status]||labels.unknown)));
  row.append(header,el('p','',check.reason));return row;
}
function graduationOverview(agent,targets,counts,score,hasCore,fitScores){
  const root=el('section','showcase-section showcase-targets');root.id='showcase-graduation';
  const header=el('div','showcase-target-head'),title=localized('h3','个人毕业进度','Personal build progress'),label=el('label'),tier=el('select');
  tier.id='showcase-graduation-tier';label.append(localized('span','目标档位','Target tier'),tier);
  for(const [key,zh,en] of [['usable','能用','Usable'],['small','小毕业参考','Standard target'],['large','大毕业参考','Advanced target']]){
    const option=localized('option',zh,en);option.value=key;tier.append(option);
  }
  tier.value=graduationTier;tier.onchange=()=>{graduationTier=tier.value;renderResult();$('showcase-graduation-tier')?.focus({preventScroll:true});};
  header.append(title,label);root.append(header);
  const eligible=targets.rows.filter(r=>!r.reason),met=eligible.filter(r=>r.status==='met').length;
  root.dataset.met=String(met);root.dataset.total=String(eligible.length);
  const meta=el('div','showcase-target-meta');
  const usable=graduationTier==='usable';root.dataset.tier=graduationTier;
  if(usable)meta.append(localized('strong','装备基础检查','Equipment checks'));
  else if(eligible.length)meta.append(localized('strong',`${met} / ${eligible.length} 项达到参考`,`${met} / ${eligible.length} targets met`));
  else meta.append(localized('strong',targets.profile?'暂无可直接比较的个人目标':'暂无角色培养参考',targets.profile?'No comparable personal targets':'No build reference available'));
  if(!usable)meta.append(isDemo?localized('span','示例装备估算 / 60 级目标','Simulated equipment estimate / Lv. 60 target'):localized('span','公开装备估算 / 60 级目标','Public equipment estimate / Lv. 60 target'));
  root.append(meta);
  const structuralIds=['six-slots','main-stats','set-fit'];
  if(usable){
    const checks=el('div','showcase-usable-grid');
    for(const check of targets.checks||[])if(structuralIds.includes(check.id))checks.append(usableCheck(check));
    root.append(checks);
  }
  if(eligible.length){const grid=el('div','showcase-target-grid');for(const row of eligible)grid.append(targetLine(row));root.append(grid);}
  const overview=el('div','showcase-target-overview'),core=agent.coreSkillEnhancement?'ABCDEF'[agent.coreSkillEnhancement-1]:'';
  const skills=(agent.skills||[]).filter(s=>s.id!==5&&Number.isInteger(s.baseLevel)),maxed=skills.filter(s=>s.baseLevel>=12).length;
  const strengths=el('div');strengths.append(localized('span',`影画 ${agent.mindscape} · 核心 ${core||'基础'}`,`M${agent.mindscape} · Core ${core||'Base'}`));
  if(skills.length)strengths.append(' · ',localized('span',`基础 12 级技能 ${maxed}/${skills.length}`,`Base Lv. 12 skills ${maxed}/${skills.length}`));
  const engine=el('div');
  if(agent.weapon){engine.append(el('span','',agent.weapon.name),' · ',localized('span',`${agent.weapon.level} 级 · 叠影 ${agent.weapon.refinement}`,`Lv. ${agent.weapon.level} · R${agent.weapon.refinement}`));}
  else engine.append(localized('span','未装备音擎','No W-Engine equipped'));
  const rolls=el('div');rolls.append(localized('span',`驱动盘 ${score.presentDiscCount}/6`,`Discs ${score.presentDiscCount}/6`));
  if(counts.confirmedDiscs&&hasCore){
    const total=score.discScores.reduce((n,d)=>n+(d.valid?d.totalRolls:0),0);
    rolls.append(' · ',localized('span',`已确认 ${total} 份副词条，其中核心有效 ${counts.effective} 份`,`${counts.effective} core rolls in ${total} verified substat rolls`));
  }
  const rated=fitScores.filter(item=>item.grade&&Number.isFinite(item.score));
  const average=rated.length===6?Number((rated.reduce((sum,item)=>sum+item.score,0)/6).toFixed(1)):null;
  const fitAverage=average===null
    ?localized('div',`六盘配装均分 —（已正式评级 ${rated.length}/6）`,`Six-disc fit average — (${rated.length}/6 graded)`)
    :localized('div',`六盘配装均分 ${average}/100`,`Six-disc fit average ${average}/100`);
  fitAverage.id='showcase-disc-fit-average';fitAverage.dataset.score=average??'';fitAverage.dataset.rated=rated.length;
  overview.append(fitAverage,strengths,engine,rolls);
  if(Number.isFinite(score.scoreRatio)&&score.maxRolls>0){
    const ratio=Number((100*score.scoreRatio).toFixed(1));
    overview.append(localized('div',`六盘核心覆盖 ${ratio}%（${score.knownEffectiveRolls} / ${score.maxRolls} 份理论上限）`,`Six-disc core roll coverage ${ratio}% (${score.knownEffectiveRolls} of ${score.maxRolls} possible)`));
  }
  if(attributeChoices.has(agent.id))overview.append(localized('div','核心份数采用自选属性。配装评分采用角色默认词条权重。','Core roll counts use your selection. Build fit scores use the agent’s default substat weights.'));
  root.append(overview);
  const fold=el('details','showcase-target-info'),others=targets.rows.filter(r=>r.reason);
  fold.append(localized('summary',others.length?`参考条件与未计入的 ${others.length} 项`:'目标来源与条件',others.length?`Reference conditions and ${others.length} excluded target(s)`:'Target sources and conditions'));
  fold.append(localized('p','目标与 DUKE 驱动盘规划一致。能用档检查盘位、主属性和套装。按公开展柜的实际等级、影画、音擎和装备估算当前面板。小毕业取攻略下限，大毕业取区间上沿。未注明场内或场外的攻略按培养参考比较，组队与战斗条件另计。','Targets match the DUKE Drive Disc Planner. The usable tier checks slots, main stats and sets. Current stats are estimated for the displayed levels, Mindscapes, W-Engine and discs. Standard targets use the guide minimums and advanced targets use the upper end when listed. Unspecified combat context is treated as a build reference. Team and combat conditions are separate.'));
  if(usable){
    for(const check of targets.checks||[])if(!structuralIds.includes(check.id))fold.append(usableCheck(check));
  }
  if(Number.isFinite(score.scoreRatio))fold.append(localized('p','六盘核心覆盖按已确认核心副词条份数，除以六张满级 S 盘在现有主属性下的理论核心份数上限。六盘配装均分取六张已评级盘的配装评分平均值。','Six-disc coverage divides verified core substat rolls by their theoretical maximum across six max-level S-Rank discs with these main stats. The six-disc fit average is the mean of six fully graded disc scores.'));
  if(others.length){const list=el('div','showcase-target-excluded');for(const r of others)list.append(targetLine(r));fold.append(list);}
  const conditions=[...new Set(eligible.map(row=>row.configurationNote||row.bound==='mechanic-threshold'&&row.note).filter(Boolean))];
  for(const condition of conditions)fold.append(el('p','',condition));
  const url=targets.profile?.source?.url;
  if(/^https:\/\//.test(url||'')){
    const link=localized('a','查看角色培养参考原文 ↗','Read the original build reference ↗');link.href=url;link.target='_blank';link.rel='noopener noreferrer';fold.append(link);
  }
  root.append(fold);return root;
}
function mask(uid){return uid==='DEMO'?'示例':String(uid).slice(0,2)+'****'+String(uid).slice(-4);}
function cacheSeconds(){return Math.max(0,Math.ceil((cacheDeadline-Date.now())/1000));}
function stopCacheTimer(){if(cacheTimer!==null)clearInterval(cacheTimer);cacheTimer=null;}
function renderRefresh(){
  const live=!!result&&!isDemo,remaining=live?cacheSeconds():0;
  $('showcase-refresh-panel').hidden=!live;
  $('showcase-refresh').disabled=!live||busy||remaining>0;
  $('showcase-refresh').textContent=busy?'读取中…':'刷新展柜';
  $('showcase-previous-data').hidden=!live||!previousData;
  if(!result){stopCacheTimer();return;}
  const fetched=new Date(result.fetchedAt),time=result.fetchedAt&&!Number.isNaN(fetched.valueOf())?fetched.toLocaleString('zh-CN',{hour12:false}):'未提供';
  $('showcase-updated').textContent=isDemo?'虚构示例 · 非真实数据':`${previousData?'上次数据 · ':''}本站读取时间：${time}${result.cacheHit?' · 本次命中缓存':''}`;
  $('showcase-cache-countdown').textContent=remaining>0?`上游缓存剩余 ${remaining} 秒，到期后可重新查询。`:'可重新查询，等待游戏展柜同步。';
  $('showcase-cache-countdown').dataset.remaining=String(remaining);
  if(!live||remaining===0)stopCacheTimer();
}
function startCacheTimer(){
  stopCacheTimer();renderRefresh();
  if(result&&!isDemo&&cacheSeconds()>0)cacheTimer=setInterval(renderRefresh,1000);
}
function setCacheDeadline(ttl){
  const seconds=Number(ttl);cacheDeadline=Date.now()+(Number.isFinite(seconds)&&seconds>0?seconds:0)*1000;
  startCacheTimer();
}
function updateChoices(agent,selection,option,category,checked,focusId){
  if(category==='primary'&&checked&&!selection.primaryIds.includes(option.id)&&selection.primaryIds.length>=MAX_CORE_ATTRIBUTES){
    preferenceMessages.set(agent.id,'核心属性最多选择 4 项，请先取消一项。');
  }else{
    attributeChoices.set(agent.id,setSelection(selection,option.id,category,checked));
    preferenceMessages.set(agent.id,'已按当前选择更新词条计数。');
  }
  renderResult();$(focusId)?.focus({preventScroll:true});
}
function attributePanel(agent,reference,selection,config){
  const custom=attributeChoices.has(agent.id),panel=el('div','showcase-reference');
  const heading=el('div','showcase-reference-heading'),copy=el('div');copy.append(el('h4','','有效副词条'),el('p','',custom?'本页自选方案':'角色建议 · 配装参考'));
  const reset=el('button','showcase-reset','恢复角色建议');reset.id='showcase-reset-attributes';reset.type='button';reset.disabled=!custom;
  reset.onclick=()=>{attributeChoices.delete(agent.id);preferenceMessages.set(agent.id,'已恢复该角色的建议属性。');renderResult();$('showcase-core-'+CORE_OPTIONS[0].id)?.focus({preventScroll:true});};heading.append(copy,reset);panel.append(heading);
  const core=el('fieldset','showcase-core-options');core.append(el('legend','',`核心副词条 · 选择 1–${MAX_CORE_ATTRIBUTES} 项`));
  const options=el('div','showcase-attribute-options');
  for(const option of CORE_OPTIONS){
    const label=el('label','showcase-attribute-option'),input=el('input');input.type='checkbox';input.id='showcase-core-'+option.id;input.checked=selection.primaryIds.includes(option.id);input.dataset.attribute=String(option.id);input.dataset.category='primary';
    if(reference?.role==='命破'&&option.id===23203){input.disabled=true;label.title='当前按贯穿输出判断，穿透值不计入有效副词条。';}
    input.onchange=()=>updateChoices(agent,selection,option,'primary',input.checked,input.id);label.append(input,el('span','',option.name));options.append(label);
  }
  core.append(options,el('p','showcase-reference-note','仅统计副词条。生命、攻击、防御的固定值可在补充项中选择。'+(reference?.role==='命破'?' 当前按贯穿输出判断，穿透值不计入有效或补充份数。':'')));panel.append(core);
  const secondary=el('div','showcase-reference-supplement');secondary.append(el('strong','','补充副词条 · 单独统计'));
  const chips=el('div','showcase-attribute-chips');for(const id of selection.secondaryIds)chips.append(el('span','',substatName(id)));if(!selection.secondaryIds.length)chips.append(el('span','is-empty','暂无选择'));secondary.append(chips);panel.append(secondary);
  const adjust=el('details','showcase-supplement-adjust');adjust.open=supplementPanels.has(agent.id);adjust.append(el('summary','','调整补充副词条'));adjust.ontoggle=()=>{if(adjust.open)supplementPanels.add(agent.id);else supplementPanels.delete(agent.id);};
  const supplementOptions=el('div','showcase-attribute-options');for(const option of SUBSTAT_OPTIONS){
    const label=el('label','showcase-attribute-option'),input=el('input');input.type='checkbox';input.id='showcase-supplement-'+option.id;input.checked=selection.secondaryIds.includes(option.id);input.dataset.attribute=String(option.id);input.dataset.category='supplement';
    if(reference?.role==='命破'&&option.id===23203){input.disabled=true;label.title='穿透值仍在原始词条中展示，贯穿输出方案不计入有效或补充份数。';}
    input.onchange=()=>updateChoices(agent,selection,option,'supplement',input.checked,input.id);label.append(input,el('span','',option.name));supplementOptions.append(label);
  }
  adjust.append(el('p','showcase-reference-note','同一属性只能归入一类，选择补充会取消其核心选择。'),supplementOptions);panel.append(adjust);
  const profile=getDiscScoreProfile(reference,panelData,config);
  if(profile.available)panel.append(discWeightDetails(profile));
  const reasons=reference?.reasons||[];if(reasons.length)panel.append(el('p','showcase-reference-reason',reasons[0]));
  const source=el('p','showcase-reference-source',custom?'本页自选方案，可按队伍调整。':'本站配装参考，可按队伍调整。');
  const link=el('a','','查看角色依据 ↗');link.href=`agents.html?v=20261118-reviewed-ui-launch-1#agent=${agent.id}`;source.append(link);panel.append(source,el('p','showcase-reference-note','选择仅在本页保留；刷新后恢复建议，不保存 UID 或账号资料。'));
  const status=el('p','showcase-preference-status',preferenceMessages.get(agent.id)||'');status.id='showcase-preference-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');panel.append(status);
  return panel;
}
function discWeightDetails(profile){
  const fold=el('details','showcase-panel-notes');fold.id='showcase-default-weights';
  fold.append(localized('summary','配装评分与角色权重','Build fit scoring and agent weights'),discFitMethod());
  fold.append(localized('p','本页按展柜的实际等级评分。驱动盘规划按角色与音擎 60 级、核心 F 评分。','This page uses the equipped levels. The planner rates a Lv. 60 agent and W-Engine with Core F.'));
  const weights=el('div','showcase-attribute-chips');
  for(const [id,weight] of Object.entries(profile.weights).filter(([,w])=>w>0).sort((a,b)=>b[1]-a[1]||Number(a[0])-Number(b[0]))){
    const chip=el('span','',substatName(id));chip.append(` ×${weight}`);weights.append(chip);
  }
  fold.append(weights,localized('p','未列出的副词条权重为 0。副词条分用加权份数除以同主属性满级 S 盘可达到的最高加权份数，再乘 100。自选属性只用于本页的核心、补充份数统计。','Unlisted substats have weight 0. The substat score divides its weighted rolls by the best legal weighted roll total for a max-level S-Rank disc with the same main stat, then multiplies by 100. Custom choices only change the core and supplemental roll counts on this page.'));
  if(profile.basis?.zh)fold.append(localized('p',profile.basis.zh,profile.basis.en));
  if(profile.adjustments?.some(a=>a.reason==='claret-crit-conversion'))fold.append(localized('p','克拉蕾核心被动将每份 4.8% 暴击伤害折为 1.68% 暴击率，相当于一份 2.4% 暴击率的 0.7 倍。','Claret’s Core Passive converts each 4.8% CRIT DMG roll into 1.68% CRIT Rate, or 0.7 of a direct 2.4% CRIT Rate roll.'));
  if(/^https:\/\//.test(profile.basis?.sourceUrl||'')){
    const link=localized('a','角色或流派依据 ↗','Agent or build reference ↗');link.href=profile.basis.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';fold.append(link);
  }
  return fold;
}
function countCard(title,total,first,additional,cls='',emptyNote='先勾选至少 1 项核心属性'){
  const card=el('div',`showcase-count-card ${cls}`),value=el('strong','showcase-count-value',total==null?'—':total);value.append(el('small','','份'));
  card.append(el('span','showcase-count-label',title),value,el('p','',total==null?emptyNote:`首次出现 ${first} 份 + 后续追加 ${additional} 份`));return card;
}
function renderResult(){
  $('showcase-result').hidden=!result;$('showcase-empty').hidden=!!result;
  if(!result)return;
  $('showcase-demo-banner').hidden=!isDemo;
  $('showcase-nickname').textContent=result.nickname||'绳匠';
  $('showcase-nickname').toggleAttribute('data-i18n-skip',!!result.nickname&&!isDemo);
  $('showcase-profile-info').textContent=`UID ${mask(result.uid)} · 绳网等级 ${result.level ?? '—'} · ${result.agents.length} 位公开展示角色`;
  renderRefresh();
  const available=result.agents || [];
  if(!available.some(a=>a.id===selectedId))selectedId=available[0]?.id||'';
  $('showcase-agents').replaceChildren(...available.map(agent=>{
    const button=el('button');button.type='button';button.setAttribute('aria-pressed',String(agent.id===selectedId));button.append(img(agent.icon),el('span','',agent.name));button.onclick=()=>{selectedId=agent.id;renderResult();};return button;
  }));
  const agent=available.find(a=>a.id===selectedId);
  if(!agent){
    const empty=section('没有可读取的展示角色','请在游戏个人主页放入展示角色，并开启“显示角色详情”，然后稍后重新查询。');
    if(result.hiddenCount||result.unsupportedCount)empty.append(el('p','section-note',`已隐藏 ${result.hiddenCount||0} 位；当前资料暂不支持 ${result.unsupportedCount||0} 位。`));
    $('showcase-agent-detail').replaceChildren(empty);return;
  }
  const guide=details.agents?.[agent.id]||{},reference=withDiscScoreDefaults(builds.agents?.[agent.id]),selection=attributeChoices.has(agent.id)?referenceSelection({role:reference?.role,effectiveSubstats:attributeChoices.get(agent.id)}):referenceSelection(reference);
  const build={...selectionBuild(reference,agent.id,selection),conditionalMainStatIds:{5:reference?.role==='命破'?[]:[23103],...(reference?.conditionalMainStatIds||{})}};
  const score=scoreAgent(agent,build),counts=countOccurrences(score.discScores),hasCore=selection.primaryIds.length>0,articleRules=evaluateArticleRules(agent,build,score,selection);
  const hero=el('header','showcase-hero');hero.style.setProperty('--showcase-color',tones[guide.element?.replace('属性','')]||'#917eaa');
  const info=el('div');info.append(el('p','',guide.faction||'代理人'),el('h2','',agent.name));
  const meta=el('div','showcase-hero-meta');for(const value of [`${agent.rank} 级`,`Lv. ${agent.level}`,guide.element,guide.specialty].filter(Boolean))meta.append(el('span','',value));
  const cinema=el('div','showcase-mindscape');cinema.setAttribute('aria-label',`已解锁 ${agent.mindscape} 层影画`);for(let i=1;i<=6;i++)cinema.append(el('span',i<=agent.mindscape?'active':'',i));
  info.append(meta,cinema);const link=el('a','showcase-guide-link','查看角色资料与配装 ↗');link.href=`agents.html?v=20261118-reviewed-ui-launch-1#agent=${agent.id}`;hero.append(img(agent.icon),info,link);
  if(portraits[agent.id]?.src)hero.append(img(portraits[agent.id].src,'showcase-hero-art'));
  const planner=el('button','primary-button','带入当前配装，规划驱动盘 ↗');planner.type='button';planner.onclick=()=>{try{sessionStorage.setItem('bagel-disc-planner-handoff',JSON.stringify({...agent,planningTier:graduationTier}));location.href=`disc-planner.html?agent=${encodeURIComponent(agent.id)}&v=20260916-english-2`;}catch{planner.textContent='浏览器存储受限，请在驱动盘规划页重新读取展柜';}};hero.append(planner);
  const config=normalizedToConfiguration(agent,panelData);
  const stats=Object.fromEntries((agent.stats||[]).filter(s=>Number.isFinite(s.value)).map(s=>[s.propertyId,s.value]));
  // Both public showcase normalizers omit zero Sheer Force.
  if(Object.keys(stats).length&&!Object.hasOwn(stats,123))stats[123]=0;
  const currentPanel=applyPanelMechanics(config,stats,panelData);
  const targets=personalTargets(agent,guide,reference,config,currentPanel.values);
  const fitScores=config.discs.map(disc=>scoreEquippedDisc(disc,reference,panelData,config,targets.contributions[disc.slot]));
  const overview=graduationOverview(agent,targets,counts,score,hasCore,fitScores);
  const columns=el('div','showcase-columns'),panel=agentPanel(agent,currentPanel);
  const weaponPanel=section('音擎','当前展示角色装备');
  if(agent.weapon){const w=agent.weapon,head=el('div','showcase-weapon'),copy=el('div');copy.append(el('h4','',w.name),el('p','',`${w.rank} 级 · Lv. ${w.level} · 叠影 ${w.refinement} 阶`));head.append(img(w.icon),copy);weaponPanel.append(head,statRows(w.stats,'showcase-weapon-stats'));}
  else weaponPanel.append(el('p','section-note','没有读取到已收录的音擎。'));
  columns.append(panel,weaponPanel);
  const skills=section('技能等级','普通技能含影画带来的等级加成；核心强化按基础及 A–F 展示。'),skillGrid=el('div','showcase-skill-row');
  for(const skill of agent.skills||[]){if(skill.id===5)continue;const cell=el('div');cell.title=`基础 ${skill.baseLevel} 级${skill.bonusLevel?` + 影画 ${skill.bonusLevel} 级`:''}`;cell.append(el('strong','',skill.level),el('span','',skill.name));skillGrid.append(cell);}
  const core=el('div');core.append(el('strong','',agent.coreSkillEnhancement?'ABCDEF'[agent.coreSkillEnhancement-1]:'基础'),el('span','','核心强化'));skillGrid.append(core);skills.append(skillGrid);
  const training=section('养成检查','先检查等级与技能投入，再结合主词条和队伍需求优化驱动盘。');
  const trainingTips=[];
  if(String(agent.id)==='1611'&&reference?.mechanicFlags?.allowsOvercapCrit)trainingTips.push('克拉蕾的初始暴击率超过 100% 后仍参与额外锐暴判定，不按普通暴击溢出处理。上方面板已计入核心被动的初始暴伤转暴击；是否压低暴击率仍需结合驱动盘、队伍增益和实际输出目标判断。');
  if(agent.level<60)trainingTips.push(`代理人当前 ${agent.level} 级；提升等级与突破能增加基础属性，请按养成资源安排。`);
  if(agent.weapon?.level<60)trainingTips.push(`音擎当前 ${agent.weapon.level} 级，仍有等级与改装提升空间。`);
  if(agent.coreSkillEnhancement<6)trainingTips.push(`核心强化当前为${agent.coreSkillEnhancement?'ABCDEF'[agent.coreSkillEnhancement-1]:'基础'}，可查看角色技能页确认后续强化收益。`);
  const lowSkills=(agent.skills||[]).filter(s=>s.id!==5&&s.baseLevel<12);
  if(lowSkills.length)trainingTips.push(`${lowSkills.map(s=>`${s.name} ${s.baseLevel} 级`).join('、')}尚未到基础 12 级；优先升级角色主要输出或功能技能。`);
  if(!trainingTips.length&&!reference?.mechanicFlags?.energyRegenThreshold)trainingTips.push('角色、音擎等级与基础技能已达到本页检查上限；可继续结合队伍检查套装触发和词条收益。');
  const trainingList=el('ul','showcase-suggestions');
  if(reference?.mechanicFlags?.energyRegenThreshold){
    const tip=el('li','','洛克茜核心 F 时，初始能量自动回复达到 3.12/秒即可取满攻击力与冲击力加成，可据此比较 6 号盘。');
    tip.dataset.i18nEn='At Core F, Roxy reaches both her ATK and Impact caps at 3.12 Energy Regen per second. Use this to compare slot 6 options.';
    trainingList.append(tip);
  }
  for(const tip of trainingTips)trainingList.append(el('li','',tip));
  training.append(trainingList);
  const discs=section('驱动盘词条','按当前方案统计副词条份数。金色标记核心属性，蓝色标记单列的补充属性。');discs.id='showcase-disc-analysis';
  const ruleIntro=el('div','showcase-article-intro');
  const ruleCopy=el('div');ruleCopy.append(el('h4','','判断顺序：套装 → 主属性 → 副属性'));
  const ruleSource=el('a','','17173 攻略原文 ↗');ruleSource.href=ARTICLE_REFERENCE.url;ruleSource.target='_blank';ruleSource.rel='noreferrer';ruleIntro.append(ruleCopy,ruleSource);discs.append(ruleIntro);
  discs.append(localized('p','配装评分与驱动盘规划共用同一算法，综合副词条、主属性、套装及对当前毕业目标的贡献。展开「副词条分」可查看构成。','Build fit scores use the planner’s formula for substats, main stat, set fit and contribution to the selected targets. Expand the substat score for the breakdown.','section-note'));
  const mainReview=notes('主属性检查 · 4–6 号位',(score.mainStatChecks||[]).filter(check=>check.slot>=4).map(check=>`${check.slot} 号位：${(check.actual||[]).join(' / ')||'暂无'}；参考 ${(check.expected||[]).join(' / ')||'暂无'}${check.conditional?' · 条件备选，需核对角色与队伍需求':check.matched===true?' · 符合参考':check.matched===false?' · 建议核对':''}`));
  mainReview.id='showcase-main-check';mainReview.open=true;mainReview.append(el('p','showcase-reference-note','异常掌控、冲击力、能量自动回复、穿透率和属性增伤属于主属性，不计入副词条份数。'));
  discs.append(mainReview);
  discs.append(attributePanel(agent,reference,selection,config));
  const counters=el('div','showcase-count-grid');counters.id='showcase-counts';counters.setAttribute('aria-live','polite');counters.setAttribute('aria-atomic','true');
  const effectiveKnown=hasCore&&counts.confirmedDiscs>0;
  const effective=countCard(counts.confirmedDiscs===6?'总有效副词条':'已确认的有效副词条',effectiveKnown?counts.effective:null,counts.effectiveFirst,counts.effectiveAdditional,'is-core',hasCore?'词条资料待确认':'先勾选至少 1 项核心属性');effective.id='showcase-effective-count';effective.dataset.count=effectiveKnown?String(counts.effective):'';
  counters.append(effective,countCard('补充副词条',counts.confirmedDiscs?counts.supplement:null,counts.supplementFirst,counts.supplementAdditional,'is-supplement','词条资料待确认'));
  const completeness=el('div','showcase-count-card is-completeness');completeness.append(el('span','showcase-count-label','装备完整性'),el('strong','showcase-count-value',`${score.presentDiscCount} / 6`),el('p','',`${counts.confirmedDiscs} 张盘可确认词条 · 共 ${score.discScores.filter(d=>d.valid).reduce((n,d)=>n+d.totalRolls,0)} 份${counts.pendingDiscs?` · ${counts.pendingDiscs} 张待确认`:''}`));counters.append(completeness);discs.append(counters);
  discs.append(el('p','showcase-count-explanation','S 级满级盘：初始 3 条共 8 份，初始 4 条共 9 份。有效份数只统计勾选的核心副词条，主属性不计入。'));
  const ruleBasis=el('div','showcase-article-basis');ruleBasis.id='showcase-rule-basis';ruleBasis.append(el('h4','','这次怎么判断'));const basisList=el('ul');for(const line of articleRules.basis)basisList.append(el('li','',line));ruleBasis.append(basisList);discs.append(ruleBasis);
  const suggestions=el('ul','showcase-suggestions'),checks=[...(score.inputWarnings||[])];
  if(!hasCore)checks.push('请先勾选至少 1 项核心属性，再查看有效副词条总数。');
  if(agent.discs.length<6)checks.push(`当前读取到 ${agent.discs.length}/6 个盘位，汇总只覆盖已确认的驱动盘。`);
  const unsupported=score.discScores.filter(d=>d.status==='unsupported-rarity').length,incomplete=counts.pendingDiscs-unsupported;
  if(incomplete)checks.push(`${incomplete} 张盘的数据暂不完整或存在矛盾，未纳入汇总；请核对下方盘位说明。`);
  if(unsupported)checks.push('非S级盘暂仅展示原始词条，未纳入已确认汇总。');
  const notMax=agent.discs.filter(d=>d.rarity===4&&d.level!==15);if(notMax.length)checks.push(`${notMax.map(d=>d.slot).join('、')} 号盘尚非 S 级 15 级；保留当前真实词条计数，请按资源安排养成。`);
  for(const check of score.mainStatChecks||[])if(check.matched===false)checks.push(`${check.slot} 号盘主属性与角色建议不同，请结合实际流派核对：${(check.expected||[]).join(' / ')}。`);
  for(const entry of checks)suggestions.append(el('li','',entry));if(suggestions.children.length)discs.append(suggestions);
  const grid=el('div','showcase-discs');
  for(let slot=1;slot<=6;slot++){
    const d=agent.discs.find(d=>d.slot===slot),card=el('article','showcase-disc');
    if(!d){card.dataset.empty='true';card.append(el('h4','',`${slot} 号位`),el('p','section-note','未读取到驱动盘'));grid.append(card);continue;}
    const ds=score.discScores?.find(d=>d.slot===slot),head=el('div','showcase-disc-heading'),title=el('div');title.append(el('h4','',`${d.name} [${slot}]`),el('span','',`${d.rank} 级 · ${d.level} 级`));head.append(title,img(d.icon||equipment.discs?.[d.suitId]?.icon));card.append(head);
    for(const stat of d.mainStats||[]){const row=el('div','showcase-disc-main');row.append(el('span','',stat.name),el('strong','',stat.formatted??stat.value));card.append(row);}
    for(const stat of d.subStats||[]){const row=el('div','showcase-disc-sub'),label=el('span','',substatName(stat.propertyId));const id=Number(stat.propertyId),classified=ds?.subStats?.find(entry=>entry.propertyId===id);row.dataset.effective=String(selection.primaryIds.includes(id));row.dataset.supplement=String(selection.secondaryIds.includes(id));const rolls=classified?.known?classified.rollCount:null;if(rolls>1){const later=el('small','',`+${rolls-1}`);later.title=`首次出现 1 份，后续追加 ${rolls-1} 份`;label.append(later);}row.append(label,el('strong','',stat.formatted??stat.value));card.append(row);}
    const dc=countOccurrences(ds?[ds]:[]),foot=el('div','showcase-disc-foot');
    if(ds?.valid){card.dataset.totalRolls=String(ds.totalRolls);foot.append(el('span','showcase-disc-total',`副词条合计 ${ds.totalRolls} 份 · 初始 ${ds.initialTypes} 条`));foot.append(el('strong','',hasCore?`有效 ${dc.effective} 份`:'先选择核心属性'));if(hasCore)foot.append(el('span','',`首次 ${dc.effectiveFirst} + 追加 ${dc.effectiveAdditional}`));foot.append(el('span','',`补充 ${dc.supplement} 份`));}
    else{foot.append(el('strong','',ds?.status==='unsupported-rarity'?'原始词条 · 暂不汇总':'词条数据待确认'));for(const warning of ds?.warnings||[])foot.append(el('span','',warning.replace(/暂停评分/g,'暂不汇总').replace(/评分/g,'计数')));}
    card.append(foot);
    card.append(renderDiscFitScore(fitScores[slot-1],targets.contributions[slot],'showcase-disc-subscore'));
    const judgement=articleRules.discs.find(entry=>entry.slot===slot);
    if(judgement){const verdict=el('div','showcase-disc-verdict');verdict.dataset.status=judgement.status;verdict.append(el('strong','',judgement.title),el('p','',judgement.note));verdict.dataset.coreTypes=String(judgement.coreTypes??'');card.append(verdict);}
    grid.append(card);
  }
  discs.append(grid);
  const fifthPanel=el('div','showcase-fifth-advice');fifthPanel.id='showcase-fifth-advice';fifthPanel.append(el('h4','','5 号盘 · 穿透与增伤'));const fifthList=el('ul');for(const line of articleRules.fifthAdvice)fifthList.append(el('li','',line));fifthPanel.append(fifthList);discs.append(fifthPanel);
  const setList=el('div','showcase-set-list');
  const setCounts=new Map();for(const disc of agent.discs)setCounts.set(disc.suitId,(setCounts.get(disc.suitId)||0)+1);
  for(const [id,count] of setCounts){const set=equipment.discs?.[id];if(!set||count<2)continue;const row=el('div','showcase-set'),copy=el('div');copy.append(el('h4','',`${set.name} · ${count} 件`),el('p','',`2 件套：${set.twoPiece}`));if(count>=4)copy.append(el('p','',`4 件套：${set.fourPiece}`));row.append(img(set.icon),copy);setList.append(row);}discs.append(setList);
  discs.append(notes('词条计数说明',[
    '首次出现计 1 份，+N 表示后续增长 N 次。例如暴击率 7.2% 是 3 份，显示 +2；不是 2 份或 4 份。主属性不计入。',
    '核心与补充属性分别汇总；不同属性的 1 份不代表相同伤害收益。更换方案后计数会变化。',
    '只汇总记录完整、词条值与份数一致的驱动盘。缺少盘位或资料矛盾时，明确显示部分计数。',
  ]));
  // Main-stat checks are displayed before the substat selector.
  $('showcase-agent-detail').replaceChildren(hero,overview,columns,skills,training,discs);
}
function setBusy(value){busy=value;for(const id of ['showcase-query','showcase-demo','showcase-uid'])$(id).disabled=value;$('showcase-query').textContent=value?'读取中…':'查询练度';renderRefresh();}
async function queryShowcase(uid){
  if(busy)return;
  if(!/^[1-9][0-9]{5,9}$/.test(uid)){message('请输入 6–10 位数字的绝区零游戏 UID。','error');return;}
  if(result&&!isDemo&&String(result.uid)===uid&&cacheSeconds()>0){message(`该展柜的上游缓存还剩 ${cacheSeconds()} 秒，到期后可重新查询；游戏展柜仍需同步。`);renderRefresh();return;}
  const sameUid=!!result&&!isDemo&&String(result.uid)===uid;
  setBusy(true);message('正在读取公开展柜…'+(result?' 下方暂时保留上次数据。':''));controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),30000);
  try{
    const response=await fetch(API_ROOT+'/api/showcase',{method:'POST',headers:{'Content-Type':'application/json','X-Bagel-Import':'1'},body:JSON.stringify({uid}),signal:controller.signal,credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'});let data;
    try{data=await response.json();}catch{throw new Error('展柜服务暂未返回有效资料，请稍后重试。');}
    if(!response.ok)throw new Error(data.message||'查询暂时失败，请稍后重试。');
    if(!data||String(data.uid)!==uid||!Array.isArray(data.agents))throw new Error('展柜资料不完整，请稍后重新查询。');
    result=data;isDemo=false;previousData=false;if(!sameUid)selectedId='';setCacheDeadline(result.ttl);renderResult();
    message(`已读取 ${result.agents.length} 位公开展示角色。${result.cacheHit?'本次命中缓存，显示此前读取的资料。':'游戏内刚修改的内容可能尚未同步。'}`);
  }catch(error){
    previousData=!!result&&!isDemo;renderRefresh();
    message((error.name==='AbortError'?'查询超时，请检查网络后重试。':error.message)+(result?' 下方保留的是上次读取结果。':''),'error');
  }finally{clearTimeout(timeout);controller=null;setBusy(false);}
}
$('showcase-form').addEventListener('submit',e=>{e.preventDefault();queryShowcase($('showcase-uid').value.trim());});
$('showcase-refresh').onclick=()=>{if(result&&!isDemo)queryShowcase(String(result.uid));};
$('showcase-demo').onclick=async()=>{if(busy)return;setBusy(true);try{const response=await fetch(demoUrl);if(!response.ok)throw new Error('示例资料暂未就绪，请稍后刷新。');result=await response.json();isDemo=true;previousData=false;selectedId='';cacheDeadline=0;stopCacheTimer();renderResult();message('正在浏览虚构的练度示例，可输入 UID 查询自己的公开展柜。');}catch(error){message(error.message,'error');}finally{setBusy(false);}};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)startCacheTimer();});
window.addEventListener('pagehide',()=>{controller?.abort();stopCacheTimer();});
window.addEventListener('pageshow',startCacheTimer);
try{
  setBusy(true);const responses=await Promise.all(['agent-builds.json?v=20261111-refresh-launch-1','agent-equipment.json?v=20261111-refresh-launch-1','agent-details.json?v=20261111-refresh-launch-1','agent-portraits.json?v=20261021-v33-launch-1','disc-planner-data.json?v=20261117-disc-panel-launch-1','agent-graduation.json?v=20261027-gachabase-all-1'].map(async path=>{try{const r=await fetch(path);if(!r.ok)throw new Error('角色资料暂未读取成功，请刷新重试。');return await r.json();}catch(error){if(path.startsWith('agent-graduation.json'))return null;throw error;}}));
  [builds,equipment,details,,panelData,graduation]=responses;portraits=responses[3].images||{};setBusy(false);
  window.showcaseAnalysis={getState:()=>({ready:true,demo:isDemo,selectedId,count:result?.agents.length||0,busy})};
  if(new URL(location.href).searchParams.get('demo')==='1')$('showcase-demo').click();
}catch(error){setBusy(false);message(error.message,'error');}

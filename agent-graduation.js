const node = (tag, cls = '', text = '') => {
  const n = document.createElement(tag); n.className = cls; n.textContent = text; return n;
};
const contexts = {initial:'初始 / 场外', 'in-combat':'战斗中', 'signature-conditioned':'专武方案', 'initial-reference-unqualified':'培养参考 · 口径未详述', 'unspecified-combat-bonus':'战斗增益口径待明确'};
const fmt = n => Number(n).toLocaleString('zh-CN', {maximumFractionDigits:2});
export function formatTarget(stat) {
  const unit = stat.unit || '';
  if(stat.bound === 'maximum')return `≤ ${fmt(stat.max ?? stat.min)}${unit}`;
  return `${fmt(stat.min)}${stat.max != null && stat.max !== stat.min ? `–${fmt(stat.max)}` : ''}${stat.upperOpen ? '+' : ''}${unit}`;
}
export function resolveGraduation(agent, profile, equipment, cinema = 0, refinement = 0) {
  if(!Number.isInteger(cinema) || cinema < 0 || cinema > 6 || !Number.isInteger(refinement) || refinement < 0 || refinement > 5)throw new RangeError('配置超出 00～65');
  const engineId = String(equipment.agents?.[agent.id]?.signatureEngineId || agent.signatureEngineId || '');
  const engine = equipment.engines?.[engineId];
  const thresholds = (profile.mechanics?.thresholds || []).filter(t => cinema >= (t.cinemaMin || 0) && cinema <= (t.cinemaMax ?? 6));
  const rows = (profile.stats || []).map(stat => ({...stat, applicable:!stat.requiresSignature || refinement > 0,
    configurationNote:stat.requiresSignature && !refinement ? '此行采用专武方案；当前未装备专武，不能直接套用。' : stat.assumedSignatureRank && refinement!==stat.assumedSignatureRank ? `原参考假定 ${stat.assumedSignatureRank} 阶专武；所选叠影效果见下方。` : stat.requiresSignature && refinement > 1 ? '来源专武方案参考；高叠影增益见下方，请勿重复加算。' : ''}));
  const adjustment=profile.weaponAdjustment, range=adjustment?.ranges?.find(r=>r.refinement===refinement);
  if(range && refinement>1){const row=rows.find(r=>r.key===adjustment.statKey);if(row)Object.assign(row,{min:range.min,max:range.max,configurationNote:'专武叠影条件换算：维持相同战斗暴击目标，扣除相比 1 阶多出的专武暴击；其他影画、队伍增益需相同。',note:adjustment.conditions.join('；')});}
  // Skill-derived breakpoints take precedence over an author range that assumes another cinema.
  if(agent.id === '1311') {
    const t = thresholds.find(t => t.key.startsWith('attack-share-cap'));
    if(t){const row=rows.find(r=>r.key==='atk');if(row)Object.assign(row,{min:Math.ceil(t.value),max:null,upperOpen:false,bound:'mechanic-threshold',panelContext:'initial',note:t.condition,configurationNote:'按当前影画的核心 F 满增益门槛换算。'});}
  }
  if(agent.id === '1151') {
    const t = thresholds.find(t => t.key.startsWith('cheer-attack-cap'));
    if(t)rows.unshift({key:'atk',label:'初始攻击力',min:t.roundedUpInteger,max:null,unit:'',bound:'mechanic-threshold',panelContext:'initial',applicable:true,note:`特殊技练至 12 级，影画加成后为 ${t.effectiveSkillLevel} 级；达到加油攻击增益上限。`});
  }
  return {code:`${cinema}${refinement}`,cinema,refinement,rows,thresholds,
    unlocked:(agent.cinema || []).filter((entry,i)=>(entry.index || i+1)<=cinema),
    engine,engineEffect:refinement ? engine?.refinements?.find((entry,i)=>Number(entry.level || i+1)===refinement)?.description || '' : '',
    skillLevel:12+(cinema>=3?2:0)+(cinema>=5?2:0),
    statEffects:(profile.mechanics?.statEffects || []).filter(e=>e.cinemaMin<=cinema)};
}
function sourceLink(url, label) {
  const a=node('a','',label);
  if(/^https:\/\//.test(url || '')){a.href=url;a.target='_blank';a.rel='noreferrer';}
  return a;
}
function ui(tag, cls, zh, en) {
  const element=node(tag,cls,zh);element.dataset.i18nEn=en;return element;
}
function disclosure(cls, zh, en) {
  const element=node('details',cls);element.append(ui('summary','',zh,en));return element;
}
function graduationLink(url, urlEn, zh, en) {
  const link=sourceLink(url,zh);link.dataset.i18nEn=en;
  if(link.href){link.dataset.sourceZh=url;if(urlEn)link.dataset.sourceEn=urlEn;
    if(window.DUKE_I18N?.language==='en'&&urlEn)link.href=urlEn;}
  return link;
}
export function renderGraduation(agent, profile, equipment) {
  const root=node('section','graduation-panel');
  root.append(ui('h3','','培养目标','Build targets'));
  if(!profile){root.append(ui('p','agent-source-note','培养参考暂未读取成功，请刷新重试。','Build references could not be loaded. Please refresh.'));return root;}
  root.append(ui('p','graduation-baseline','角色 60 级 · 机制按核心 F · 未激活潜能觉醒','Agent Lv. 60 · Core Skill F for mechanics · Potential awakening inactive'));
  const controls=node('div','graduation-controls'),selectors=[];
  for(const [zh,en,max,id] of [['影画等级','Mindscape level',6,'graduation-cinema'],['专属音擎','Signature W-Engine',5,'graduation-refinement']]){
    const label=node('label'),select=node('select');label.append(ui('span','',zh,en));select.id=id;
    select.setAttribute('aria-label',zh);select.dataset.i18nAriaLabelEn=en;
    for(let i=0;i<=max;i++){
      const cinema=id==='graduation-cinema';
      const option=ui('option','',cinema?`${i} 影画`:i?`${i} 阶专武`:'未装备专武',cinema?`M${i}`:i?`Signature R${i}`:'No signature');
      option.value=i;select.append(option);
    }
    label.append(select);controls.append(label);selectors.push(select);
  }
  root.append(controls);
  const body=node('div','graduation-body');root.append(body);
  const render=()=>{
    const config=resolveGraduation(agent,profile,equipment,Number(selectors[0].value),Number(selectors[1].value));
    root.dataset.configuration=config.code;body.replaceChildren();
    const mainRows=config.rows.filter(s=>s.purpose!=='survival-reference'&&!s.optional&&!s.choiceGroup);
    const optionalRows=config.rows.filter(s=>s.purpose!=='survival-reference'&&(s.optional||s.choiceGroup));
    const survival=config.rows.filter(s=>s.purpose==='survival-reference');
    const renderRows=rows=>{
      const grid=node('div','graduation-grid');
      for(const stat of rows){
        const mechanism=stat.bound==='mechanic-threshold';
        const card=node('article',`graduation-stat${stat.applicable?'':' is-conditional'}${formatTarget(stat).length>11?' is-wide-target':''}`);card.dataset.stat=stat.key;card.dataset.applicable=String(stat.applicable);
        card.append(node('div','graduation-stat-label',stat.label),ui('span','graduation-kind',mechanism?'技能门槛':'作者参考',mechanism?'Skill breakpoint':'Guide reference'));
        if(stat.applicable)card.append(node('strong','graduation-target',formatTarget(stat)));
        else card.append(ui('strong','graduation-target graduation-not-applicable','不适用','Not applicable'));
        card.append(node('span','graduation-context',contexts[stat.panelContext]||'机制参考'));
        if(!stat.applicable)card.append(ui('p','graduation-condition','需装备专属音擎','Requires the signature W-Engine'));
        else if(stat.assumedSignatureRank&&stat.assumedSignatureRank!==config.refinement)card.append(ui('p','graduation-condition',`原参考按 ${stat.assumedSignatureRank} 阶专武`,`Reference assumes signature R${stat.assumedSignatureRank}`));
        else if(stat.requiresSignature)card.append(ui('p','graduation-condition','专武方案限定','Signature build only'));
        const matchingThreshold=config.thresholds.find(t=>(t.stat===stat.label||t.stat===`初始${stat.label}`)&&Number(t.roundedUpInteger??t.value)===stat.min&&t.condition);
        if(matchingThreshold)card.append(node('p','graduation-condition',matchingThreshold.condition));
        if((stat.noteImportant||mechanism)&&stat.note&&stat.note!==matchingThreshold?.condition)card.append(node('p','graduation-condition',stat.note));
        const more=disclosure('graduation-stat-details','条件与依据','Conditions & evidence');
        if(!stat.applicable)more.append(ui('p','',`原方案参考：${formatTarget(stat)}`,`Original build reference: ${formatTarget(stat)}`));
        if(stat.configurationNote)more.append(node('p','graduation-stat-note',stat.configurationNote));
        if(stat.note&&!stat.noteImportant&&!mechanism)more.append(node('p','graduation-stat-note',stat.note));
        if(stat.sourceValue)more.append(ui('p','graduation-original',`原文：${stat.sourceValue}`,`Source: ${stat.sourceValue}`));
        if(stat.contextExplicit===false)more.append(ui('p','','原攻略未逐项注明场内外口径；按原配装条件使用。','The guide does not specify each stat’s context. Use it with the original build assumptions.'));
        if(stat.choiceGroup)more.append(ui('p','',stat.choiceGroup==='anomaly'?'可选异常路线':'可选双暴路线',stat.choiceGroup==='anomaly'?'Optional Anomaly route':'Optional CRIT route'));
        if(more.childElementCount>1)card.append(more);
        grid.append(card);
      }
      return grid;
    };
    if(mainRows.length){
      const heading=node('div','graduation-heading');heading.append(ui('h4','','主要目标','Primary targets'));
      body.append(heading,ui('p','graduation-reading','参考范围不等于达标判定；先核对每项适用条件。','Reference ranges are not pass/fail ratings. Check the conditions for each stat.'),renderRows(mainRows));
    }else if(profile.status==='mechanics-only'){
      const notice=node('div','graduation-empty');notice.append(ui('strong','','暂缺作者培养区间','Guide ranges not yet available'),ui('p','','以下仅展示已知技能机制。','Only known skill mechanics are shown below.'));body.append(notice);
    }
    const planner=node('a','graduation-planner');planner.href=`disc-planner.html?agent=${encodeURIComponent(agent.id)}`;
    planner.append(ui('strong','','在驱动盘规划中对比 ↗','Compare in the Drive Disc planner ↗'),ui('span','','录入实际配装后对照；此页未读取你的面板。','Compare after entering your build; this page has no current stats.'));body.append(planner);
    if(optionalRows.length){const box=disclosure('graduation-extra','可选输出方向','Optional damage routes');box.append(renderRows(optionalRows));body.append(box);}
    if(survival.length){const box=disclosure('graduation-extra','生存属性参考','Survival references');box.append(ui('p','graduation-reading','无需为凑齐这些数值牺牲核心词条。','Do not sacrifice core stats just to reach these values.'),renderRows(survival));body.append(box);}
    if(config.thresholds.length){
      const box=node('section','graduation-thresholds');box.append(ui('h4','','技能机制','Skill mechanics'),ui('p','graduation-reading','特定效果的触发或封顶条件，不是整名角色的属性上限。','Triggers or caps for specific effects, not overall Agent stat caps.'));
      for(const threshold of config.thresholds){
        const item=node('details','graduation-threshold'),summary=node('summary');summary.append(node('span','',threshold.stat),' · ',threshold.title?node('span','',threshold.title):ui('span','','机制条件','Mechanic condition'));
        if(threshold.value!=null)summary.append(` · ${fmt(threshold.roundedUpInteger??threshold.value)}${threshold.unit||''}`);item.append(summary);
        if(threshold.condition)item.append(node('p','',threshold.condition));
        if(threshold.formula)item.append(node('p','graduation-formula',threshold.formula));
        if(threshold.note)item.append(node('p','',threshold.note));
        if(profile.status==='mechanics-only')item.open=true;
        box.append(item);
      }
      body.append(box);
    }
    const assumptions=disclosure('graduation-extra graduation-assumptions','攻略条件与其他参考','Guide assumptions & alternatives');
    if(profile.notes?.length){const list=node('ul','graduation-notes');for(const text of profile.notes)list.append(node('li','',text));assumptions.append(list);}
    if(profile.baselineConfiguration?.note)assumptions.append(node('p','graduation-reading',profile.baselineConfiguration.note));
    if(profile.sourceVariants?.length){for(const variant of profile.sourceVariants){
      const prefix=variant.specialLevel?`特殊技 ${variant.specialLevel} 级`:variant.sourceCoreLevel?`核心等级 ${variant.sourceCoreLevel}`:variant.condition||'场外换算';
      assumptions.append(node('p','',`${prefix}：${variant.key==='atk'?'攻击力':variant.key==='critRate'?'暴击率':'异常精通'} ${formatTarget(variant)}${variant.derivation?`；${variant.derivation}`:''}`));
    }}
    if(assumptions.childElementCount>1)body.append(assumptions);
    const benefits=disclosure('graduation-extra graduation-benefits','当前配置的影画与音擎效果','Mindscape & W-Engine effects');
    benefits.append(ui('p','graduation-reading',`技能练至 12 级，影画加成后为 ${config.skillLevel} 级；核心强化独立计算。`,`Skills trained to Lv. 12 become Lv. ${config.skillLevel} with Mindscapes; Core Skill enhancement is separate.`));
    for(const entry of config.unlocked){const box=disclosure('graduation-effect',`影画 ${entry.index} · ${entry.name}`,`M${entry.index} · ${entry.nameEn||window.DUKE_I18N?.english(entry.name)||entry.name}`);const text=node('p','agent-prose',entry.description);if(entry.descriptionEn)text.dataset.i18nEn=entry.descriptionEn;box.append(text);benefits.append(box);}
    if(!config.unlocked.length)benefits.append(ui('p','graduation-reading','0 影画：基础技能机制。','M0: base skill mechanics.'));
    const weapon=node('div','graduation-weapon');weapon.append(ui('h4','',config.refinement?`${config.engine?.name||'专属音擎'} · ${config.refinement} 阶`:'未装备专武',config.refinement?`${config.engine?.nameEn||window.DUKE_I18N?.english(config.engine?.name||'专属音擎')||'Signature W-Engine'} · R${config.refinement}`:'No signature W-Engine'));
    weapon.append(node('p','agent-prose',config.refinement?config.engineEffect||'此阶音擎效果暂未读取成功。':'参考目标需结合实际替代音擎调整；专武限定的属性行已单独标注。'));benefits.append(weapon,ui('p','graduation-reading','请勿重复计入目标已包含的战斗增益。','Do not add combat bonuses already included in a target.'));body.append(benefits);
    const sources=disclosure('graduation-extra graduation-sources','来源、版本与日期','Sources, versions & dates');
    if(profile.source?.kind==='original-theorycraft-guide'){
      sources.append(ui('p','',`作者培养参考 · ${profile.source?.title||'逐角色攻略'}`,`Guide-author targets · ${profile.source?.title||'Character guide'}`));
      sources.append(ui('p','',`攻略更新时间：${profile.source?.updatedAt||'未注明'} · 资料读取：${profile.source?.retrievedAt||'未注明'}`,`Guide updated: ${profile.source?.updatedAt||'unspecified'} · Retrieved: ${profile.source?.retrievedAt||'unspecified'}`));
      if(profile.source?.url)sources.append(graduationLink(profile.source.url,profile.source.urlEn,'查看作者攻略 ↗','View author guide ↗'));
    }
    const source=profile.mechanicsSource;
    if(source||profile.mechanics?.sourceUrl){
      sources.append(ui('p','',`技能机制 · ${source?.provider||'游戏技能'} ${source?.version||profile.gameVersion} 正式服${source?.revision?` · D/R ${source.revision}`:''}`,`Skill mechanics · ${source?.provider||'Game skills'} ${source?.version||profile.gameVersion} release${source?.revision?` · D/R ${source.revision}`:''}`));
      if(source?.checkedAt)sources.append(ui('p','',`机制核对：${source.checkedAt}`,`Mechanics checked: ${source.checkedAt}`));
      sources.append(graduationLink(source?.url||profile.mechanics.sourceUrl,source?.urlEn,'查看技能数据 ↗','View skill data ↗'));
    }
    body.append(sources);
  };
  selectors.forEach(select=>select.addEventListener('change',render));render();return root;
}

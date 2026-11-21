const el=(tag,cls='',text='',textEn)=>{const n=document.createElement(tag);n.className=cls;setText(n,text,textEn);return n;};
function setText(node,text,textEn){
  if(typeof textEn==='string'&&textEn.trim())node.dataset.i18nEn=textEn;
  else delete node.dataset.i18nEn;
  // Replace the text node so language switching never restores another refinement.
  node.textContent=text??'';
}
export const betaTabs=[['beta','测试服概览'],['beta-skills','技能与倍率'],['beta-cinema','测试服影画'],['beta-engine','测试服音擎']];
function link(source,label='Gachabase 原文',labelEn='Gachabase source',languageFromQuery=false){
  const a=el('a','agent-beta-link',`${label} ↗`,`${labelEn} ↗`);
  for(const [key,value,lang]of [['sourceZh',source?.url,'zh-CN'],['sourceEn',languageFromQuery?source?.url:source?.urlEn,'en']]){
    try{
      const url=new URL(value);
      if(url.protocol!=='https:' || url.hostname!=='zzz.gachabase.net')continue;
      if(languageFromQuery)url.searchParams.set('lang',lang);
      a.dataset[key]=url.href;
    }catch{}
  }
  if(a.dataset.sourceZh){a.href=window.DUKE_I18N?.language==='en'&&a.dataset.sourceEn?a.dataset.sourceEn:a.dataset.sourceZh;a.target='_blank';a.rel='noopener noreferrer';}
  return a;
}
function paragraph(text,cls='agent-prose',textEn){return el('p',cls,text,textEn);}
function statsTable(stats,captionText='测试服面板数据',captionEn='Beta stat panel'){
  const table=el('table','agent-stats-table agent-beta-stats'),body=el('tbody');
  const caption=el('caption','',captionText,captionEn);table.append(caption);
  for(const stat of stats||[]){
    const row=el('tr'),name=el('th','',stat.label,stat.labelEn),value=el('td','',String(stat.value)+(stat.unit||''));name.scope='row';
    if(stat.context)value.append(el('small','',stat.context,stat.contextEn));row.append(name,value);body.append(row);
  }
  table.append(body);return table;
}
function sourceNote(data){
  const box=el('div','agent-beta-warning'),source=data.source||{},version=String(source.version||'').replace(/\s*BETA\s*$/i,'').trim();
  const revisions=[source.revision!=null?`D ${source.revision}`:'',source.resourceRevision!=null?`R ${source.resourceRevision}`:''].filter(Boolean);
  const label=['Gachabase',...revisions].join(' · '),details=el('details','agent-beta-story');
  box.append(el('strong','',`${version?version+' ':''}测试服 · 可能变动`,`${version?version+' ':''}Beta · Subject to change`));
  details.append(el('summary','','来源与修订','Source and revision'),paragraph(label+(source.checkedAt?` · 核对：${source.checkedAt}`:''),'agent-beta-version',label+(source.checkedAt?` · Checked: ${source.checkedAt}`:'')),link(source));
  if(source.changelogUrl)details.append(document.createTextNode(' · '),link({url:source.changelogUrl},'测试服更新日志','Beta changelog',true));
  box.append(details);return box;
}
function renderOverview(data){
  const frag=new DocumentFragment(),facts=el('dl','agent-facts');
  for(const [label,labelEn,value,valueEn]of [['测试评级','Beta Rank',data.rank,data.rank],['测试属性','Beta Attribute',data.element,data.elementEn],['测试特性','Beta Specialty',data.specialty,data.specialtyEn],['测试阵营','Beta Faction',data.faction,data.factionEn]]){
    if(!value)continue;const row=el('div');row.append(el('dt','',label,labelEn),el('dd','',value,valueEn));facts.append(row);
  }
  frag.append(facts,el('h3','','测试服面板','Beta stat panel'));
  frag.append(paragraph(data.kind==='full'?'60 级 / 最高突破 / 核心 F；不含装备、影画及战斗增益，核心百分比加成另列。':data.statsContext||'数值口径见各项备注。','agent-section-note',data.kind==='full'?'Level 60 / Max Promotion / Core F. Excludes gear, Mindscapes and combat buffs; percentage Core bonuses are listed separately.':data.statsContextEn||'See each stat’s notes.'));
  if(data.stats?.length)frag.append(statsTable(data.stats));
  if(data.notes?.length){
    const list=el('ul','agent-beta-notes');
    for(const [i,text]of data.notes.entries()){
      if(['分类、机制和数值均采用 Gachabase 同版测试文本；本页不改动正式服资料或计算器。','技能名称与部分文本仍处于测试占位阶段；源站尚未填写的内容保留缺口，不用其他站点补齐。'].includes(text))continue;
      if(text==='本修订已补全六层影画效果；音擎名称仍未填写。')list.append(el('li','','音擎名称暂缺。','The W-Engine name is unavailable.'));
      else if(text==='本修订已补全六层影画效果。核心 F 的生命值百分比单列于核心技，不计入基础生命值。')continue;
      else if(text==='本修订已提供技能、核心与六层影画；同修订中英文音擎目录未收录其专属音擎，暂不补数值。')list.append(el('li','','源站暂未收录卡芙卡专属音擎。','The source has no Kafka signature W-Engine yet.'));
      else list.append(el('li','',text,data.notesEn?.[i]));
    }
    if(list.children.length)frag.append(list);
  }
  if(data.training?.length){
    frag.append(el('h3','','培养要点','Build notes'),paragraph('尚未经实战验证。','agent-section-note','Not yet play-tested.'));
    const list=el('ul','agent-beta-notes');for(const [i,text]of data.training.entries())list.append(el('li','',text,data.trainingEn?.[i]));frag.append(list);
  }
  return frag;
}
function skillMoves(moves,level){
  const frag=new DocumentFragment();
  for(const move of moves||[]){const selected=move.descriptionsByLevel?.find(x=>x.level===level)||move,section=el('section','agent-beta-move');section.append(el('h4','',move.name,move.nameEn));if(move.context)section.append(paragraph(move.context,'agent-section-note',move.contextEn));section.append(paragraph(selected.description,'agent-prose',selected.descriptionEn));frag.append(section);}
  return frag;
}
function levelControl(labelText,labelEn,options,selected,onchange){
  const label=el('label','agent-skill-level'),select=el('select');label.append(el('span','',labelText,labelEn));
  for(const item of options){const option=el('option','',item.label,item.labelEn);option.value=String(item.level);select.append(option);}
  select.value=String(selected);select.onchange=()=>onchange(Number(select.value));label.append(select);return label;
}
function multiplierTable(rows,level){
  const table=el('table','agent-stats-table agent-beta-stats'),body=el('tbody');
  table.append(el('caption','',`技能等级 ${level} · 倍率与数值`,`Skill Level ${level} · Multipliers and values`));
  for(const item of rows||[]){
    const row=el('tr'),name=el('th','',item.label,item.labelEn);name.scope=item.isTitle?'colgroup':'row';
    if(item.isTitle){name.colSpan=2;row.append(name);}
    else row.append(name,el('td','',String(item.values?.[level-1]??'').trim()||'源站暂缺',String(item.valuesEn?.[level-1]??'').trim()||'Not available in source'));
    body.append(row);
  }
  table.append(body);return table;
}
function renderSkills(data){
  const frag=new DocumentFragment();frag.append(el('h3','','技能与倍率','Skills and multipliers'),paragraph('13–16 级为加成预览，未必可解锁。','agent-section-note','Levels 13–16 preview bonuses and may not be unlockable.'));
  for(const [i,skill]of(data.skills||[]).entries()){
    const item=el('details','agent-skill');item.open=i===0;
    item.append(el('summary','',skill.name,skill.nameEn));const body=el('div','agent-skill-body');
    if(skill.context)body.append(paragraph(skill.context,'agent-section-note',skill.contextEn));
    if(skill.levels?.length){
      const content=el('div');
      const update=level=>{const entry=skill.levels.find(x=>x.level===level);content.replaceChildren();if(!entry)return;
        if(entry.stats?.length)content.append(statsTable(entry.stats,'核心属性增益（累计）','Core stat bonuses (cumulative)'));
        content.append(skillMoves(entry.moves));};
      body.append(levelControl('核心等级','Core level',skill.levels,skill.defaultLevel,update),content);update(skill.defaultLevel);
    }else if(skill.moves){
      const content=el('div'),update=level=>content.replaceChildren(skillMoves(skill.moves,level),multiplierTable(skill.multipliers,level));
      const options=Array.from({length:skill.maxLevel-skill.minLevel+1},(_,i)=>({level:i+skill.minLevel,label:`${i+skill.minLevel} 级`,labelEn:`Level ${i+skill.minLevel}`}));
      body.append(levelControl('技能等级','Skill level',options,skill.defaultLevel,update),content);update(skill.defaultLevel);
    }else body.append(paragraph(skill.description,'agent-prose',skill.descriptionEn));
    item.append(body);frag.append(item);
  }
  return frag;
}
function renderCinema(data){
  const frag=new DocumentFragment();frag.append(el('h3','','测试服影画','Beta Mindscapes'),paragraph('影画未计入基础面板。','agent-section-note','Mindscapes are excluded from the base panel.'));
  const grid=el('div','agent-cinema-grid');
  for(const entry of data.cinema||[]){
    const card=el('article','agent-cinema'),heading=el('div','agent-cinema-heading');
    heading.append(el('span','agent-cinema-index',String(entry.index).padStart(2,'0')),el('h4','',entry.name||`影画 ${entry.index}`,entry.nameEn||(!entry.name?`Mindscape ${entry.index}`:undefined)));
    card.append(heading,paragraph(entry.description,'agent-prose',entry.descriptionEn));if(entry.context&&entry.context!=='名称尚未填写；以下效果保留源站测试文本。')card.append(paragraph(entry.context,'agent-source-note',entry.contextEn));
    if(entry.flavorText){const story=el('details','agent-beta-story');story.append(el('summary','','影画故事','Mindscape story'),paragraph(entry.flavorText,'agent-prose',entry.flavorTextEn));card.append(story);}
    grid.append(card);
  }
  frag.append(grid);return frag;
}
function equipmentHeading(data){
  const head=el('div','agent-equipment-head');
  if((/^assets\/[\w/-]+\.(?:webp|png|jpe?g)$/.test(data.icon||'')&&!data.icon.split('/').includes('..'))||(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(data.icon||'')&&data.icon.length<=131072)){
    const image=el('img');image.src=data.icon;image.alt='';image.width=96;image.height=96;image.loading='lazy';image.decoding='async';head.append(image);
  }
  head.append(el('h4','',data.name,data.nameEn));return head;
}
function renderEngine(data){
  const frag=new DocumentFragment(),engine=data.engine;
  frag.append(el('h3','','测试服音擎','Beta W-Engine'));
  if(!engine){frag.append(paragraph('源站暂缺本修订的专属音擎资料。','agent-section-note','The source has no signature W-Engine data for this revision.'));return frag;}
  if(engine.nameSource)frag.append(paragraph(`名称由${engine.nameSource.label}确认。`,'agent-section-note',`Name confirmed by the ${engine.nameSource.labelEn}.`));
  const card=el('article','agent-equipment-card');card.append(equipmentHeading(engine));
  if(engine.context)card.append(paragraph(data.kind==='full'?'60 级 / 突破 5 阶':engine.context,'agent-section-note',data.kind==='full'?'Level 60 / Modification 5':engine.contextEn));
  if(engine.stats?.length)card.append(statsTable(engine.stats));
  if(engine.refinements?.length){
    const label=el('label','agent-skill-level'),select=el('select'),effect=paragraph('');label.append(el('span','','叠影等级','Refinement'));select.setAttribute('aria-label','测试音擎叠影等级');
    for(const level of engine.refinements){const option=el('option','',`${level.level} 阶`,`Rank ${level.level}`);option.value=String(level.level);select.append(option);}
    select.onchange=()=>{const level=engine.refinements.find(r=>r.level===Number(select.value));setText(effect,level?.description,level?.descriptionEn);};
    select.onchange();label.append(select);card.append(label,effect);
  }else if(engine.description)card.append(paragraph(engine.description,'agent-prose',engine.descriptionEn));
  for(const [i,text]of(engine.notes||[]).entries()){
    if(text==='音擎数值与角色技能来自同一 Gachabase 测试服修订；未计入角色基础面板。')continue;
    if(text==='源站未填写音擎名称与效果名称；此处用角色名和 ID 标识。')card.append(paragraph('音擎及效果名称暂缺。','agent-source-note','W-Engine and effect names are unavailable.'));
    else card.append(paragraph(text,'agent-source-note',engine.notesEn?.[i]));
  }
  frag.append(card);return frag;
}
export function betaTabsFor(data){
  return data?.kind==='changes' ? [['beta','测试服变化']] : [...betaTabs,['beta-discs','测试服驱动盘']];
}
function renderChanges(data){
  const frag=new DocumentFragment();
  frag.append(el('h3','','本轮测试服变化','Changes in this beta'));if(data.previousVersion)frag.append(paragraph(`对比 ${data.previousVersion}。`,'agent-section-note',`Compared with ${data.previousVersion}.`));
  if(data.noNetChange){
    frag.append(paragraph('最新修订与旧测试修订一致，无净变化。','agent-prose','The latest and previous beta records match; no net change remains.'));
  }
  if(data.potentialLevels?.length){
    frag.append(el('h3','','测试服潜能','Beta Potential'));
    const content=el('div'),update=level=>{const entry=data.potentialLevels.find(x=>x.level===level);content.replaceChildren();if(!entry)return;
      content.append(el('h4','',entry.name||entry.label,entry.nameEn||entry.labelEn));if(entry.context)content.append(paragraph(entry.context,'agent-section-note agent-beta-source-mismatch',entry.contextEn));content.append(paragraph(entry.description||'源站未提供此阶独立能力说明；招式变化见下方。','agent-prose',entry.descriptionEn||'The source has no separate ability description for this stage; see move changes below.'));};
    const selected=data.potentialLevels.at(-1).level;
    frag.append(levelControl('潜能阶段','Potential stage',data.potentialLevels,selected,update),content);update(selected);
  }
  for(const change of data.changes||[]){
    const item=el('details','agent-skill');item.append(el('summary','',change.name,change.nameEn));
    const body=el('div','agent-skill-body');
    if(change.context)body.append(paragraph(change.context,'agent-section-note',change.contextEn));
    if(change.potentialIds?.some(x=>x>0))body.append(paragraph('需开启相应潜能。','agent-section-note','Requires the corresponding Potential.'));
    const showDescription=(entry,target)=>{target.replaceChildren(paragraph(entry.description||'源站暂缺该说明。','agent-prose',entry.descriptionEn||'English description is unavailable in this source revision.'));if(entry.previousDescription){const previous=el('details','agent-beta-story');previous.append(el('summary','','旧测试修订原文','Previous beta text'),paragraph(entry.previousDescription,'agent-prose',entry.previousDescriptionEn||'The previous English source does not provide this description.'));target.append(previous);}};
    const content=el('div','agent-beta-change-description');
    if(change.descriptionsByLevel?.length){const levels=change.descriptionsByLevel,selected=levels.at(-1).level,options=levels.map(entry=>({level:entry.level,label:entry.level===0?'未升级':String.fromCharCode(64+entry.level),labelEn:entry.level===0?'Base':String.fromCharCode(64+entry.level)})),update=level=>{const entry=levels.find(row=>row.level===level);if(entry)showDescription(entry,content);};body.append(levelControl('核心等级','Core level',options,selected,update));update(selected);}else showDescription(change,content);
    body.append(content);
    item.append(body);frag.append(item);
  }
  if(data.numericChanges?.length){
    const table=el('table','agent-stats-table agent-beta-stats'),head=el('thead'),heading=el('tr'),body=el('tbody');
    table.append(el('caption','','12 级倍率变化','Level 12 multiplier changes'));
    for(const [zh,en]of [['项目','Stat'],['旧测试修订','Previous beta'],['本修订','Current revision']]){const cell=el('th','',zh,en);cell.scope='col';heading.append(cell);}
    head.append(heading);
    for(const entry of data.numericChanges){const row=el('tr'),name=el('th','',entry.label,entry.labelEn);name.scope='row';row.append(name,el('td','',entry.previous??'源站暂缺',entry.previous??'Not available in source'),el('td','',entry.value));body.append(row);}
    table.append(head,body);frag.append(table);
  }
  frag.append(link(data.comparisonSource,'完整修订差异','Full revision comparison'));
  return frag;
}
function renderDiscs(data){
  const frag=new DocumentFragment();frag.append(el('h3','','测试服驱动盘','Beta Drive Discs'),paragraph('未加入正式配装或计算。','agent-section-note','Not included in release builds or calculators.'));
  for(const disc of data.discs||[]){
    const card=el('article','agent-equipment-card');card.append(equipmentHeading(disc));
    for(const effect of disc.effects){card.append(el('h5','',`${effect.pieces} 件套`,`${effect.pieces}-Piece Set`),paragraph(effect.description,'agent-prose',effect.descriptionEn));}
    card.append(sourceNote(disc));frag.append(card);
  }
  return frag;
}
export function renderBetaTab(data,key){
  const frag=new DocumentFragment();
  if(key!=='beta-discs')frag.append(sourceNote(key==='beta-engine'&&data.engine?.source?{source:data.engine.source}:data));
  const renderers={beta:data.kind==='changes'?renderChanges:renderOverview,'beta-skills':renderSkills,'beta-cinema':renderCinema,'beta-engine':renderEngine,'beta-discs':renderDiscs};
  frag.append((renderers[key]||renderOverview)(data));return frag;
}

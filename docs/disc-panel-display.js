// Values use the same property groups and raw units as calculatePanel and the showcase.
const statNames = {
  111: ['生命值', 'HP'], 121: ['攻击力', 'ATK'], 122: ['冲击力', 'Impact'],
  123: ['贯穿力', 'Sheer Force'], 131: ['防御力', 'DEF'],
  201: ['暴击率', 'CRIT Rate'], 211: ['暴击伤害', 'CRIT DMG'],
  231: ['穿透率', 'PEN Ratio'], 232: ['穿透值', 'PEN'],
  305: ['能量自动回复', 'Energy Regen'], 30502: ['能量自动回复加成', 'Energy Regen bonus'],
  312: ['异常精通', 'Anomaly Proficiency'], 314: ['异常掌控', 'Anomaly Mastery'],
  315: ['物理伤害加成', 'Physical DMG Bonus'], 316: ['火属性伤害加成', 'Fire DMG Bonus'],
  317: ['冰属性伤害加成', 'Ice DMG Bonus'], 318: ['电属性伤害加成', 'Electric DMG Bonus'],
  319: ['以太伤害加成', 'Ether DMG Bonus'], 323: ['风属性伤害加成', 'Wind DMG Bonus']
};

const percentGroups = new Set([201, 202, 211, 212, 213, 231, 306, 307, 308, 309, 310, 311, 313, 315, 316, 317, 318, 319, 321, 322, 323, 325, 30502]);
const rateGroups = new Set([305, 320, 324]);

export function formatPanelValue(group, raw, lang = 'zh-CN') {
  if (!Number.isFinite(raw)) return '—';
  const id = Number(group), rate = rateGroups.has(id);
  const percent = percentGroups.has(id);
  const value = (raw / (percent || rate ? 100 : 1)).toLocaleString(lang, {maximumFractionDigits: 2});
  if (rate) return value + (lang.startsWith('en') ? '/s' : '/秒');
  return value + (percent ? '%' : '');
}

function bilingual(tag, zh, en) {
  const node = document.createElement(tag);
  node.textContent = zh;
  node.dataset.i18nEn = en;
  return node;
}

const discFitParts = {
  substats: ['副词条', 'Substats'],
  main: ['主属性', 'Main stat'],
  set: ['套装搭配', 'Set fit'],
  target: ['目标贡献', 'Target contribution']
};

export function discFitMethod() {
  return bilingual('p','配装评分最多计副词条 60 分、主属性 20 分、套装 10 分、目标贡献 10 分。固定主属性、没有可靠参考的项目跳过，按适用项目的满分折算为百分制。目标贡献根据卸下这张盘后重新出现或扩大的面板缺口计算。',
    'Build fit allows up to 60 points for substats, 20 for the main stat, 10 for set fit and 10 for the target gaps this disc closes. Fixed main stats and criteria without a reliable reference are omitted. Points are scaled to 100 using the remaining criteria.');
}

export function renderDiscFitScore(result, contribution, className, {showDetails=true}={}) {
  const box=document.createElement('div'), grade=result.grade||result.estimatedGrade;
  const hasScore=Number.isFinite(result.score), estimated=Boolean(result.estimatedGrade);
  const hasSubstats=Boolean(result.lines?.length)&&Number.isFinite(result.substatScore);
  box.className=className+' disc-fit-score';
  Object.assign(box.dataset,{status:result.status,mainStatus:result.mainStatus,score:hasScore?result.score:'',
    grade:grade||'',gradeType:grade?(estimated?'estimated':'final'):'none',
    substatScore:hasSubstats?result.substatScore:'',contextStatus:result.contextStatus});
  const label=bilingual('span',estimated?'配装评分 · 估算':'配装评分',estimated?'Build fit score · estimate':'Build fit score');
  label.className='disc-card-score-label';
  const row=document.createElement('div'),value=document.createElement('div'),number=document.createElement('strong');
  row.className='disc-card-score-line';value.className='disc-card-score-number';
  number.textContent=hasScore?result.score:'—';value.append(number);
  if(hasScore){const scale=document.createElement('small');scale.textContent='/100';value.append(scale);}
  row.append(value);
  if(grade){
    const badge=document.createElement('div'),letter=document.createElement('strong');
    badge.className='disc-card-grade';letter.textContent=grade;
    badge.append(bilingual('span',estimated?'预估评级':'评级',estimated?'Est.':'Grade'),letter);row.append(badge);
  }
  box.append(label,row);
  const notes={
    absent:['空缺号位','Empty slot'],unsupported:['盘位资料待核对','Disc data unverified'],
    invalid:['词条记录有误','Invalid substat record'],empty:['待填写副词条','Enter substats'],
    'no-profile':['暂缺角色评分依据','No scoring profile'],
    'main-mismatch':['主属性偏离当前参考','Main stat outside this build'],
    'unverified-main':['该号位暂无主属性参考','No verified main stat for this slot'],
    partial:['副词条未填全','Incomplete substats'],unleveled:['未满 15 级','Below Lv. 15']
  };
  let missingContext=['整套面板资料不足','Insufficient equipment stats'];
  if(contribution?.status==='ready')missingContext=contribution.completeBuild?['缺少可核对的配装参考','No verified reference for this build']:['需补齐六张盘的配装资料','Complete all six disc records to score this build'];
  const note=(hasScore&&result.mainStatus==='mismatch'?notes['main-mismatch']:notes[result.status])
    ||(result.mainStatus==='conditional'?['主属性为条件备选','Conditional main stat']:null)
    ||(!hasScore?missingContext:null);
  if(note){const text=bilingual('p',...note);text.className='disc-card-score-note';box.append(text);}
  if(hasSubstats){
    const core=new Set(result.profile.primaryIds),supplement=new Set(result.profile.secondaryIds);
    const rollCount=accept=>result.lines.reduce((n,line)=>n+(accept(line.id)?line.rolls:0),0);
    const coreRolls=rollCount(id=>core.has(id)),supplementRolls=rollCount(id=>!core.has(id)&&supplement.has(id));
    Object.assign(box.dataset,{coreRolls,supplementRolls,totalRolls:rollCount(()=>true)});
    if(!showDetails)return box;
    const detail=document.createElement('details'),score=result.substatScore;
    detail.className='disc-fit-breakdown';
    detail.append(bilingual('summary',`副词条分 ${score}/100 · 查看构成`,`Substat score ${score}/100 · Breakdown`));
    const parts=Object.entries(discFitParts).filter(([key])=>result.parts?.[key]?.max>0);
    if(hasScore&&parts.length){
      const text=lang=>parts.map(([key,names])=>names[lang]+' '+result.parts[key].points+'/'+result.parts[key].max).join(' · ');
      detail.append(bilingual('p',text(0),text(1)));
    }
    const counts=bilingual('p',`核心 ${coreRolls} 份 · 补充 ${supplementRolls} 份`,`Core ${coreRolls} rolls · Supplement ${supplementRolls} rolls`);
    counts.className='disc-card-roll-totals';detail.append(counts);box.append(detail);
  }
  if(showDetails&&contribution?.status==='ready')box.append(renderDiscContribution(contribution));
  return box;
}

export function renderDiscContribution(item) {
  const box=document.createElement('div');
  box.className='disc-build-contribution';
  box.dataset.status=item.status;
  const label=bilingual('span',item.partial?'整套贡献 · 按已录入估算':'整套贡献',item.partial?'Build contribution · recorded stats':'Build contribution');
  label.className='disc-contribution-label';
  box.append(label);
  function add(kind,group,value,describe){
    const text=english=>{
      const stat=statNames[group]?.[english?1:0]||String(group);
      const amount=formatPanelValue(group,value,english?'en-US':'zh-CN');
      const delta=amount.replace(/%$/,english?' percentage points':' 个百分点');
      return describe(english,stat,amount,delta);
    };
    const row=bilingual('p',text(false),text(true));
    row.dataset.kind=kind;
    if(group!=null){row.dataset.group=String(group);row.dataset.value=String(value);}
    box.append(row);
    return row;
  }
  const target=item.targets.find(r=>r.excess>0||r.closed>0);
  if(target?.excess>0){
    add('excess',target.group,target.excess,(en,stat,amount,delta)=>en?`${stat} exceeds the cap by an extra ${delta}`:`${stat}超出上限的部分增加 ${delta}`);
  }else if(target?.breakpoint){
    add('threshold',target.group,target.targetRaw,(en,stat,amount)=>en?`Keeps ${stat} at or ${target.bound==='maximum'?'below':'above'} ${amount}`:`守住${stat} ${amount}`);
  }else if(target){
    add('gap',target.group,target.closed,(en,stat,amount,delta)=>en?`${stat} gap reduced by ${delta}`:`${stat}缺口缩小 ${delta}`);
  }else if(!item.effects.length&&item.main?.delta>0){
    add('panel',item.main.group,item.main.delta,(en,stat,amount)=>`${stat} +${amount}`);
  }
  for(const effect of item.effects){
    add('passive',effect.group,effect.delta,(en,stat,amount)=>`${en?'Passive conversion · ':'常驻转换 · '}${stat} ${effect.delta>0?'+':''}${amount}`);
  }
  if(item.setLoss){
    const pieces=item.setLoss.pieces;
    add('set',null,null,en=>en?`Maintains ${pieces}-piece set`:`维持 ${pieces} 件套`).dataset.pieces=String(pieces);
  }
  if(box.childElementCount===1)box.append(bilingual('p','当前参考目标无差值','No change to the current target gaps'));
  return box;
}

function effectText(effect, english) {
  const lang = english ? 'en-US' : 'zh-CN';
  const name = id => statNames[id]?.[english ? 1 : 0] || String(id);
  const fmt = (id, value) => formatPanelValue(id, value, lang);
  const {group, inputGroup, inputValue, before, bonus, after} = effect;
  const input = inputGroup && Number.isFinite(inputValue) ? `${name(inputGroup)} ${fmt(inputGroup, inputValue)} → ` : '';
  const increase = fmt(group, bonus).replace(/%$/, english ? ' percentage points' : ' 个百分点');
  const gain = `${name(group)} +${increase}`;
  const result = english ? `(${fmt(group, before)} → ${fmt(group, after)})` : `（${fmt(group, before)} → ${fmt(group, after)}）`;
  const cinema = effect.minCinema || effect.modifierCinema;
  const cinemaLabel = cinema ? (english ? `Mindscape ${cinema} · ` : `影画 ${cinema} · `) : '';
  const condition = english ? effect.conditionEn : effect.condition;
  if (condition) return cinemaLabel + condition + ' · ' + input + gain + ' ' + result;
  if (effect.scope === 'entry') return (english ? 'On entering combat · ' : '进入战场后 · ') + input + gain + ' ' + result;
  if (effect.scope === 'team') return (english ? 'With the required squad condition · ' : '满足队伍条件时 · ') + input + gain + ' ' + result;
  return cinemaLabel + input + gain + ' ' + result;
}

export function renderPanelEffects(effects = []) {
  const fragment = document.createDocumentFragment();
  if (!effects.length) return fragment;
  const section = document.createElement('section'), list = document.createElement('ul');
  section.className = 'disc-panel-effects';
  section.append(bilingual('h4', '角色技能与面板换算', 'Agent skill stat calculations'), list);
  const original = document.createElement('details'), descriptions = new Set(), sources = new Set();
  original.className = 'disc-source-details';
  original.append(bilingual('summary', '查看换算条件与技能原文', 'Calculation conditions and skill descriptions'));
  for (const effect of effects) {
    const row = bilingual('li', effectText(effect, false), effectText(effect, true));
    row.dataset.scope = effect.scope;
    row.dataset.stat = String(effect.group);
    list.append(row);
    if (effect.description && !descriptions.has(effect.description)) {
      descriptions.add(effect.description);
      original.append(bilingual('p', effect.description, effect.descriptionEn || effect.description));
    }
    if (effect.sourceUrl) sources.add(effect.sourceUrl);
  }
  for (const url of sources) {
    const link = bilingual('a', 'Gachabase 正式服技能资料 ↗', 'Gachabase release skill data ↗');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    original.append(link);
  }
  if (descriptions.size || sources.size) section.append(original);
  fragment.append(section);
  return fragment;
}

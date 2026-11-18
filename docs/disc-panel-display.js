// Values use the same property groups and raw units as calculatePanel and the showcase.
const statNames = {
  111: ['生命值', 'HP'], 121: ['攻击力', 'ATK'], 122: ['冲击力', 'Impact'],
  123: ['贯穿力', 'Sheer Force'], 131: ['防御力', 'DEF'],
  201: ['暴击率', 'CRIT Rate'], 211: ['暴击伤害', 'CRIT DMG'],
  231: ['穿透率', 'PEN Ratio'], 232: ['穿透值', 'PEN'],
  305: ['能量自动回复', 'Energy Regen'], 30502: ['能量自动回复加成', 'Energy Regen bonus'],
  312: ['异常精通', 'Anomaly Proficiency'], 314: ['异常掌控', 'Anomaly Mastery']
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

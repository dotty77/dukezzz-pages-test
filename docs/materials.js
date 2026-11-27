import {$, el, picture, toast, loadJSON, mountPicker, availabilityBadge, availabilityLabel, elementBase} from './agent-picker.js?v=20261107-refresh-launch-1';
import {BREAKPOINTS, MAX_LEVEL, MAX_SKILL, MAX_CORE, defaultPlan, normalizePlan, planCost, totalCost} from './cultivation-core.js?v=20261107-refresh-launch-1';
import {preferredRegion, mountTrainingEvent} from './banner-core.js?v=20261127-creator-archive-launch-1';

const STORE_PLANS = 'duke-cultivation-plans-v1';
const STORE_BETA_PLANS = 'duke-cultivation-beta-plans-v1';
const CORE_LABELS = ['基础', 'A', 'B', 'C', 'D', 'E', 'F'];
const GROUPS = [['denny', '通用'], ['exp-agent', '代理人经验'], ['promotion', '突破材料'], ['skill', '技能材料'], ['core', '核心技材料'], ['exp-weapon', '音擎经验'], ['weapon', '音擎突破']];
let data, releaseData, betaData, betaRequest, plans = [], picker, mode = 'release', modeRequest = 0, modeError = '', modeLoading = false;
let factions = {}, catalogAliases = {};
const fmt = value => window.DUKE_I18N?.number(value) ?? String(value);
const range = (min, max) => Array.from({length: max - min + 1}, (_, i) => min + i);
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* planning still works for this visit */ } };
const savePlans = () => write(mode === 'beta' ? STORE_BETA_PLANS : STORE_PLANS, plans);
const english = () => window.DUKE_I18N?.language === 'en';
const bilingual = (zh, en) => english() ? en : zh;
const entryName = entry => english() && entry.nameEn || entry.name;
const named = (tag, cls, entry) => { const node = el(tag, cls, entry.name); if (entry.nameEn) node.dataset.i18nEn = entry.nameEn; return node; };
// Official English names come from the game text map; plain labels avoid word-by-word translation.
const itemLabel = id => english() && data.items[id].nameEn || data.items[id].name;
// Official icons from the miHoYo wiki, see research/item-icons-20261001/.
const itemIcon = id => { if (data.items[id].icon === null) { const node = el('span', 'material-icon material-icon-missing', '?'); node.setAttribute('aria-hidden', 'true'); return node; } return picture(data.items[id].icon || `assets/materials/${id}.webp`, '', 'material-icon'); };
const itemName = id => { const item = data.items[id], span = el('span', '', item.name); if (item.nameEn) span.dataset.i18nEn = item.nameEn; span.title = itemLabel(id); return span; };

function select(values, label, current, text = String) {
  const node = el('select'); node.setAttribute('aria-label', label);
  for (const value of values) { const option = el('option', '', text(value)); option.value = String(value); node.append(option); }
  node.value = String(current);
  return node;
}

function weaponSelect(agent, current) {
  const node = el('select'); node.setAttribute('aria-label', '音擎');
  const none = el('option', '', '不计算音擎'); none.value = ''; node.append(none);
  const weapons = Object.values(data.weapons);
  const rank = {S: 0, A: 1, B: 2};
  const sorted = list => list.sort((a, b) => rank[a.rank] - rank[b.rank] || Number(b.id) - Number(a.id));
  const groups = [
    ['专属音擎', weapons.filter(w => w.id === agent.weapon)],
    [`${agent.specialty}音擎`, sorted(weapons.filter(w => w.id !== agent.weapon && w.specialty === agent.specialty))],
    ['其他音擎', sorted(weapons.filter(w => w.id !== agent.weapon && w.specialty !== agent.specialty))],
  ];
  for (const [label, list] of groups) {
    if (!list.length) continue;
    // optgroup labels are not walked by i18n.js, so translate them here; cards are rebuilt on language change.
    const group = el('optgroup'); group.label = window.DUKE_I18N?.t(label) ?? label;
    for (const weapon of list) { const option = el('option', '', `${entryName(weapon)}${english() ? ` (${weapon.rank})` : `（${weapon.rank}）`}${weapon.status === 'beta' ? bilingual(' · 测试服', ' · Beta') : availabilityLabel(weapon) ? ` · ${availabilityLabel(weapon)}` : ''}`); option.value = weapon.id; group.append(option); }
    node.append(group);
  }
  node.value = current || '';
  return node;
}

function rangeRow(label, ...children) {
  const row = el('div', 'plan-row'), box = el('div', 'plan-range');
  box.append(...children); row.append(el('span', '', label), box);
  return row;
}
function promotedBox(label) {
  const wrap = el('label'), box = el('input'); box.type = 'checkbox';
  wrap.append(box, el('span', '', label));
  return {wrap, box};
}

function buildCard(plan) {
  const agent = data.agents[plan.agent];
  const card = el('article', 'plan-card'); card.dataset.agent = agent.id;
  const head = el('header'), copy = el('div'), summary = el('p');
  copy.append(named('h3', '', agent), summary);
  if (agent.status === 'beta') copy.append(el('em', 'pill warn', bilingual('测试服', 'Beta')));
  const opening = availabilityBadge(agent); if (opening) copy.append(opening);
  const collapse = el('button', 'ghost-button', '收起'); collapse.type = 'button';
  const remove = el('button', 'ghost-button', '移除'); remove.type = 'button';
  head.append(picture(agent.icon, '', 'planner-icon'), copy, collapse, remove);

  const levelFrom = select(range(1, MAX_LEVEL), '当前等级', plan.level.from, v => `Lv.${v}`);
  const levelTo = select(range(1, MAX_LEVEL), '目标等级', plan.level.to, v => `Lv.${v}`);
  const levelPromoted = promotedBox('已突破');
  const skillBox = el('div', 'plan-skills'), skillSelects = [];
  data.skillTypes.forEach((type, index) => {
    const from = select(range(1, MAX_SKILL), `${type.name}当前等级`, plan.skills[index][0]);
    const to = select(range(1, MAX_SKILL), `${type.name}目标等级`, plan.skills[index][1]);
    const line = el('div', 'plan-range'); line.append(el('span', '', type.name), from, el('span', '', '→'), to);
    skillBox.append(line); skillSelects.push([from, to]);
  });
  const maxSkills = el('button', 'ghost-button', '技能目标全部 12'); maxSkills.type = 'button';
  const coreFrom = select(range(0, MAX_CORE), '核心技当前', plan.core[0], v => CORE_LABELS[v]);
  const coreTo = select(range(0, MAX_CORE), '核心技目标', plan.core[1], v => CORE_LABELS[v]);
  const weapon = weaponSelect(agent, plan.weapon?.id);
  const weaponFrom = select(range(0, MAX_LEVEL), '音擎当前等级', plan.weapon?.from ?? 0, v => `Lv.${v}`);
  const weaponTo = select(range(0, MAX_LEVEL), '音擎目标等级', plan.weapon?.to ?? MAX_LEVEL, v => `Lv.${v}`);
  const weaponPromoted = promotedBox('已突破');
  const weaponLevels = el('span', 'plan-range'); weaponLevels.append(weaponFrom, weaponPromoted.wrap, el('span', '', '→'), weaponTo);
  const warnings = el('div');

  const body = el('div', 'plan-body');
  const skillsRow = el('div', 'plan-row'), skillsWrap = el('div', 'plan-skills-wrap');
  skillsWrap.append(skillBox, maxSkills);
  skillsRow.append(el('span', '', '技能'), skillsWrap);
  body.append(rangeRow('等级', levelFrom, levelPromoted.wrap, el('span', '', '→'), levelTo));
  if (['1601', '1661'].includes(String(agent.gameId || agent.id))) {
    const guide = el('p', 'planner-muted', bilingual('官方养成指南 · ', 'Official upgrade guide · '));
    const servers = [
      [bilingual('国服', 'China'), 'https://act.mihoyo.com/zzz/event/character-builder/index.html?game_biz=nap_cn&mhy_auth_required=1&mhy_presentation_style=fullscreen#/'],
      [bilingual('国际服', 'Global'), 'https://act.hoyolab.com/zzz/event/character-builder/index.html?hyl_presentation_style=fullscreen#/'],
    ];
    for (const [label, url] of servers) {
      const link = el('a', '', label + ' ↗');
      link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
      guide.append(link, ' ');
    }
    body.append(guide);
  }
  if (agent.eventLevelMaterials) {
    const {throughLevel, url, urlEn} = agent.eventLevelMaterials;
    const note = el('p', 'planner-muted', bilingual(
      `3.4 活动赠送升至 ${throughLevel} 级的材料。使用后，把当前等级设为实际等级即可。 `,
      `The Version 3.4 event grants materials to reach Lv. ${throughLevel}. After using them, set your current level above. `));
    const link = el('a', '', bilingual('活动公告 ↗', 'Event details ↗'));
    link.href = bilingual(url, urlEn); link.target = '_blank'; link.rel = 'noopener noreferrer';
    note.append(link); body.append(note);
  }
  body.append(
    skillsRow,
    rangeRow('核心技', coreFrom, el('span', '', '→'), coreTo),
    rangeRow('音擎', weapon, weaponLevels),
    warnings,
  );
  card.append(head, body);

  const sync = () => {
    const p = plans.find(item => item.agent === agent.id);
    levelFrom.value = p.level.from; levelTo.value = p.level.to;
    levelPromoted.box.checked = p.level.promoted; levelPromoted.wrap.hidden = !BREAKPOINTS.includes(p.level.from);
    p.skills.forEach(([a, b], i) => { skillSelects[i][0].value = a; skillSelects[i][1].value = b; });
    coreFrom.value = p.core[0]; coreTo.value = p.core[1];
    weapon.value = p.weapon?.id || ''; weaponLevels.hidden = !p.weapon;
    if (p.weapon) { weaponFrom.value = p.weapon.from; weaponTo.value = p.weapon.to; weaponPromoted.box.checked = p.weapon.promoted; weaponPromoted.wrap.hidden = !BREAKPOINTS.includes(p.weapon.from); }
    card.classList.toggle('collapsed', !!p.collapsed); collapse.textContent = p.collapsed ? '展开' : '收起';
    collapse.setAttribute('aria-expanded', String(!p.collapsed));
    const parts = [`Lv.${p.level.from} → ${p.level.to}`, `${CORE_LABELS[p.core[0]]} → ${CORE_LABELS[p.core[1]]}`];
    summary.replaceChildren(el('span', '', parts[0]), el('span', '', ' · 核心技 '), el('span', '', parts[1]));
    if (p.weapon) summary.append(el('span', '', ' · '), el('span', '', entryName(data.weapons[p.weapon.id])));
    const cost = planCost(p, data);
    warnings.replaceChildren(...cost.warnings.map(w => el('p', 'plan-warning',
      w.type === 'skill' ? `${data.skillTypes[w.index].name}目标需要代理人 ${w.need} 级` : `核心技目标需要代理人 ${w.need} 级`)));
    if (agent.status === 'beta' && !agent.weapon) warnings.append(el('p', 'plan-warning', bilingual('专属音擎资料暂缺。', 'Signature W-Engine data is unavailable.')));
  };
  const update = () => {
    const index = plans.findIndex(item => item.agent === agent.id);
    const weaponId = weapon.value;
    const next = {
      agent: agent.id, collapsed: plans[index].collapsed,
      level: {from: +levelFrom.value, promoted: levelPromoted.box.checked, to: +levelTo.value},
      skills: skillSelects.map(([a, b]) => [+a.value, +b.value]),
      core: [+coreFrom.value, +coreTo.value],
      weapon: weaponId ? {id: weaponId, from: +weaponFrom.value, promoted: weaponPromoted.box.checked, to: +weaponTo.value} : null,
    };
    // Raising a current value above its target pulls the target up instead of rejecting the change.
    if (next.level.to < next.level.from) next.level.to = next.level.from;
    next.skills = next.skills.map(([a, b]) => [a, Math.max(a, b)]);
    next.core[1] = Math.max(next.core[0], next.core[1]);
    if (next.weapon) next.weapon.to = Math.max(next.weapon.from, next.weapon.to);
    plans[index] = normalizePlan(next, data);
    savePlans(); sync(); renderTotals();
  };
  for (const node of [levelFrom, levelTo, levelPromoted.box, coreFrom, coreTo, weapon, weaponFrom, weaponTo, weaponPromoted.box, ...skillSelects.flat()])
    node.addEventListener('change', update);
  maxSkills.addEventListener('click', () => { skillSelects.forEach(([, to]) => { to.value = MAX_SKILL; }); update(); });
  collapse.addEventListener('click', () => { const p = plans.find(item => item.agent === agent.id); p.collapsed = !p.collapsed; savePlans(); sync(); });
  remove.addEventListener('click', () => { plans = plans.filter(item => item.agent !== agent.id); savePlans(); card.remove(); renderAll(false); });
  sync();
  return card;
}

// users: [{agent, count}] in plan order; shown only when more than one agent is planned.
function itemRow(id, need, users) {
  const item = data.items[id], row = el('div', 'material-row'), name = el('div', 'material-name');
  const label = el('div', 'material-label'); label.append(itemName(id));
  if (plans.length > 1 && users.length) {
    const who = el('small', 'material-users');
    users.forEach(({agent, count}, i) => {
      if (i) who.append(el('span', '', ' · '));
      who.append(named('span', '', data.agents[agent]));
      if (users.length > 1) who.append(el('span', '', ` ${fmt(count)}`));
    });
    label.append(who);
  }
  name.append(itemIcon(id), label);
  row.append(name, el('span', 'material-need', fmt(need)));
  return row;
}

// EXP is shown as the largest EXP item it converts to, with the raw total underneath.
function expRow(kind, needed) {
  const id = data.expItems[kind][0], row = el('div', 'material-row'), name = el('div', 'material-name'), label = el('div', 'material-label');
  label.append(itemName(id), el('small', 'material-users', `共 ${fmt(needed)} 经验`));
  name.append(itemIcon(id), label);
  row.append(name, el('span', 'material-need', fmt(Math.ceil(needed / data.items[id].exp))));
  return row;
}

function renderTotals() {
  const total = totalCost(plans, data);
  // Which plans need each item, so rows can be grouped per agent instead of interleaving elements.
  const users = new Map();
  total.perPlan.forEach((cost, index) => {
    for (const [id, count] of cost.items) if (count > 0) {
      if (!users.has(id)) users.set(id, []);
      users.get(id).push({agent: plans[index].agent, count, index});
    }
  });
  const firstUser = id => users.get(id)?.[0]?.index ?? 0;
  $('materials-count').replaceChildren(el('span', '', plans.length ? `${plans.length} 位代理人` : '添加代理人后显示合计'));
  const groups = [];
  for (const [key, title] of GROUPS) {
    const section = el('section', 'material-group');
    section.append(el('h3', '', title));
    if (key === 'exp-agent' || key === 'exp-weapon') {
      const needed = key === 'exp-agent' ? total.agentExp : total.weaponExp;
      if (needed === null) section.append(el('p', 'planner-muted', bilingual('经验材料待核对', 'EXP materials unverified')));
      else { if (!needed) continue; section.append(expRow(key.slice(4), needed)); }
    } else {
      const rows = [...total.items].filter(([id, n]) => n > 0 && data.items[id].group === key)
        .sort(([a], [b]) => firstUser(a) - firstUser(b) || data.items[a].rarity - data.items[b].rarity || Number(a) - Number(b));
      if (!rows.length) continue;
      section.append(...rows.map(([id, n]) => itemRow(id, n, users.get(id) || [])));
    }
    groups.push(section);
  }
  const head = el('div', 'material-head');
  head.append(el('span', '', '材料'), el('span', '', '需要'));
  $('materials-groups').replaceChildren(...(groups.length ? [head, ...groups] : []));
  $('materials-notes').replaceChildren(...(data.notes || []).map((text, i) => { const node = el('span', '', `${text} `); if (data.notesEn?.[i]) node.dataset.i18nEn = `${data.notesEn[i]} `; return node; }));
  if (total.agentExp === null || total.weaponExp === null) $('materials-notes').append(el('span', '', bilingual('已计算突破、技能与核心技；经验材料暂未核对。', 'Promotion, skill and Core Skill costs are included; EXP materials are unverified.')));
  renderSource();
}

function renderAll(rebuildCards = true) {
  if (rebuildCards) $('materials-cards').replaceChildren(...plans.map(buildCard));
  $('materials-empty').hidden = plans.length > 0;
  renderTotals(); picker?.render();
}

function addAgent(agent) {
  if (plans.some(plan => plan.agent === agent.id)) {
    toast('已在计划中');
    document.querySelector(`.plan-card[data-agent="${agent.id}"]`)?.scrollIntoView({behavior: 'smooth', block: 'center'});
    return;
  }
  const plan = normalizePlan(defaultPlan(data.agents[agent.id]), data);
  plans.unshift(plan); savePlans();
  $('materials-cards').prepend(buildCard(plan));
  renderAll(false);
  toast(`已添加：${agent.name}`);
}

function togglePicker(open) {
  $('materials-picker-panel').hidden = !open;
  $('materials-add').setAttribute('aria-expanded', String(open));
  if (open) $('materials-picker').querySelector('input')?.focus();
}

function renderModeControls(loading = modeLoading) {
  $('materials-modes').setAttribute('aria-label', bilingual('资料版本', 'Data version'));
  $('materials-release').setAttribute('aria-pressed', String(mode === 'release'));
  $('materials-beta').setAttribute('aria-pressed', String(mode === 'beta'));
  $('materials-release').disabled = !releaseData;
  $('materials-beta').disabled = !releaseData || loading;
  $('materials-modes').setAttribute('aria-busy', String(loading));
  $('materials-version-label').hidden = mode !== 'beta';
  const version = String(data?.gameVersion || data?.source?.version || '').replace(/\s*BETA/i, '');
  $('materials-version-label').textContent = `${version} ${english() ? 'Beta · Subject to change' : '测试服 · 可能调整'}`;
  $('materials-live-source').hidden = mode === 'beta';
  document.body.dataset.materialsVersion = mode;
}

function renderSource() {
  const node = $('materials-source'); node.replaceChildren(); node.hidden = mode !== 'beta';
  if (mode !== 'beta') return;
  const source = data.source || {};
  const label = ['Gachabase', source.version || data.gameVersion,
    source.revision ? `D${source.revision}` : '', source.resourceRevision ? `R${source.resourceRevision}` : ''].filter(Boolean).join(' · ');
  const href = english() && source.urlEn || source.url || source.changelogUrl;
  if (typeof href === 'string' && /^https:\/\/zzz\.gachabase\.net\//.test(href)) {
    const link = el('a', '', label); link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer'; node.append(link);
  } else node.textContent = label;
}

function activateMode(next) {
  mode = next;
  data = next === 'beta' ? betaData : releaseData;
  const stored = read(next === 'beta' ? STORE_BETA_PLANS : STORE_PLANS, []);
  plans = (Array.isArray(stored) ? stored : []).map(plan => normalizePlan(plan, data)).filter(Boolean);
  mountAgentPicker();
  renderModeControls(); renderAll();
  togglePicker(!plans.length);
}

function mountAgentPicker() {
  const agents = Object.values(data.agents).map(a => ({...a, name: entryName(a),
    faction: a.faction || factions[a.id] || '', status: a.status || 'released'}))
    .sort((a, b) => Number(b.gameId || b.id) - Number(a.gameId || a.id));
  const aliases = {...catalogAliases};
  for (const agent of Object.values(data.agents)) aliases[agent.id] = [...(aliases[agent.id] || []), agent.name, agent.nameEn, ...(agent.aliases || [])].filter(Boolean);
  const betaElements = mode === 'beta' ? {elements: [...new Set(agents.map(a => elementBase(a.element)))],
    elementLabels: Object.fromEntries(Object.values(data.agents).map(a => [elementBase(a.element), a.elementEn || '']))} : {};
  picker = mountPicker($('materials-picker'), {agents, aliases, ...betaElements, isSelected: id => plans.some(plan => plan.agent === id), onPick: addAgent});
}

function prepareBeta(beta) {
  if (!beta?.agents || !Object.keys(beta.agents).length || !beta.items || !beta.weapons) throw new Error('Incomplete beta materials');
  const weapons = {...releaseData.weapons, ...Object.fromEntries(Object.entries(beta.weapons).map(([id, weapon]) => [id, {...weapon, id, status: 'beta'}]))};
  const agents = Object.fromEntries(Object.entries(beta.agents).map(([id, agent]) => [id, {...agent, id, status: 'beta',
    weapon: agent.weapon && weapons[String(agent.weapon)] ? String(agent.weapon) : null}]));
  const merged = {...releaseData, ...beta, agents, weapons, items: {...releaseData.items, ...beta.items}};
  for (const agent of Object.values(agents)) {
    if (!agent.promotion || !Array.isArray(agent.skills) || !Array.isArray(agent.core)) throw new Error('Incomplete beta agent costs');
    for (const rows of [...Object.values(agent.promotion), ...agent.skills.map(row => row.cost), ...agent.core.map(row => row.cost)])
      for (const [id] of rows) if (!merged.items[id]) throw new Error('Missing beta material');
  }
  return merged;
}

async function switchMode(next, updateUrl = true) {
  if (!releaseData) return;
  const request = ++modeRequest;
  modeError = ''; $('materials-status').textContent = ''; $('materials-retry').hidden = true;
  modeLoading = next === 'beta' && !betaData; renderModeControls();
  try {
    if (next === 'beta' && !betaData) {
      betaRequest ||= loadJSON('cultivation-beta.json?v=20261120-beta345-launch-1').then(prepareBeta).finally(() => { betaRequest = null; });
      const loaded = await betaRequest;
      if (request !== modeRequest) return;
      betaData = loaded;
    }
    if (request !== modeRequest) return;
    modeLoading = false;
    activateMode(next);
    if (updateUrl) {
      const url = new URL(location.href);
      if (next === 'beta') url.searchParams.set('version', 'beta'); else url.searchParams.delete('version');
      history.replaceState(null, '', url);
    }
  } catch {
    if (request !== modeRequest) return;
    modeError = 'beta'; modeLoading = false; renderModeControls(); renderModeError();
  }
}

function renderModeError() {
  $('materials-status').textContent = modeError === 'beta'
    ? bilingual('测试服资料暂未读取成功，正式服仍可使用。', 'Beta data could not be loaded. The release planner is still available.') : '';
  $('materials-retry').hidden = modeError !== 'beta';
}

async function main() {
  try {
    const [cultivation, catalog, details] = await Promise.all([
      loadJSON('cultivation-data.json?v=20261111-refresh-launch-1'), loadJSON('tuning-catalog.json?v=20261118-reviewed-ui-launch-1'),
      loadJSON('team-abilities.json?v=20261111-refresh-launch-1')]);
    releaseData = cultivation;
    factions = Object.fromEntries(details.agents.map(a => [a.id, a.faction]));
    catalogAliases = Object.fromEntries(Object.entries(catalog.items).map(([id, item]) => [id, item.aliases || []]));
    // Owned amounts were dropped from the planner; clear what older visits stored.
    try { localStorage.removeItem('duke-cultivation-owned-v1'); } catch { /* nothing to clear */ }
    activateMode('release');
    if (new URL(location.href).searchParams.get('version') === 'beta') await switchMode('beta', false);
  } catch (error) {
    $('materials-status').textContent = '资料读取失败，请刷新重试。';
    console.error(error);
  }
}

$('materials-add').addEventListener('click', () => togglePicker($('materials-picker-panel').hidden));
$('materials-picker-close').addEventListener('click', () => togglePicker(false));
$('materials-release').addEventListener('click', () => switchMode('release'));
$('materials-beta').addEventListener('click', () => switchMode('beta'));
$('materials-retry').addEventListener('click', () => switchMode('beta'));
window.addEventListener('dukelanguagechange', () => {
  if (data) { mountAgentPicker(); renderModeControls(); renderAll(); renderModeError(); }
});
main();
loadJSON('banner-calendar.json?v=20261127-creator-archive-launch-1')
  .then(calendar => mountTrainingEvent($('training-event'), calendar, () => preferredRegion(calendar.regions)))
  .catch(error => console.warn('Training event unavailable', error));

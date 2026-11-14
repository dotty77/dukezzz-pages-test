import {$, el, picture, toast, loadJSON, mountPicker, availabilityBadge, availabilityLabel} from './agent-picker.js?v=20261107-refresh-launch-1';
import {evaluateTeam} from './team-core.js?v=20261027-agents-launch-1';

const STORAGE = 'duke-team-v1';
const STATUS = {active: ['ok', '生效'], inactive: ['off', '未生效'], unknown: ['warn', '待确认']};
const REASON = {element: '同属性', faction: '同阵营', specialty: '特性', parry: '招架支援'};
let roster = [], byId = {}, team = [null, null, null], picker;
const i18n = () => window.DUKE_I18N;
const english = () => i18n()?.language === 'en';

function readTeam() {
  const fromHash = /(?:^|[#&])team=([\d,]+)/.exec(location.hash)?.[1];
  let ids = fromHash ? fromHash.split(',') : [];
  if (!ids.length) try { ids = JSON.parse(localStorage.getItem(STORAGE) || '[]'); } catch { ids = []; }
  const unique = [...new Set(ids.map(String))].filter(id => byId[id]).slice(0, 3);
  team = [0, 1, 2].map(i => unique[i] || null);
}
function saveTeam() {
  const ids = team.filter(Boolean);
  try { localStorage.setItem(STORAGE, JSON.stringify(ids)); } catch { /* the hash still carries the team */ }
  history.replaceState(history.state, '', `${location.pathname}${location.search}${ids.length ? `#team=${ids.join(',')}` : ''}`);
}
const members = () => team.filter(Boolean).map(id => byId[id]);

function toggle(agent) {
  const at = team.indexOf(agent.id);
  if (at >= 0) team[at] = null;
  else {
    const free = team.indexOf(null);
    if (free < 0) { toast('队伍已满，先点一位队员移除'); return; }
    team[free] = agent.id;
  }
  saveTeam(); render();
}

function renderSlots() {
  $('team-slots').replaceChildren(...team.map((id, index) => {
    const agent = byId[id], slot = el('button', `team-slot${agent ? ' filled' : ''}`); slot.type = 'button';
    if (!agent) { slot.append(el('span', '', `第 ${index + 1} 位 · 从下方选择`)); slot.disabled = true; return slot; }
    // Separate nodes so each official term is translated on its own.
    const meta = el('small'); meta.append(el('span', '', agent.element), el('span', '', ' · '), el('span', '', agent.specialty), el('span', '', ' · '), el('span', '', agent.faction));
    const copy = el('div'); copy.append(el('strong', '', agent.name), meta);
    slot.append(picture(agent.icon, ''), copy, el('span', 'slot-remove', '×'));
    slot.setAttribute('aria-label', `移除队员：${agent.name}`); slot.title = '移除';
    slot.addEventListener('click', () => { team[index] = null; saveTeam(); render(); });
    return slot;
  }));
}

function optionsText(agent) {
  const rule = agent.ability.rule, parts = rule.specialties.map(s => `[${s}]`);
  if (rule.sameElement) parts.push(`同属性（${agent.element.split(' / ').pop()}）`);
  if (rule.sameFaction) parts.push(`同阵营（${agent.faction}）`);
  if (rule.parryAssist) parts.push('可发动招架支援的角色');
  return parts;
}

function effectText(agent) {
  const ability = agent.ability;
  if (!english()) return ability.effect;
  if (ability.effectEn) return ability.effectEn;
  const full = i18n().english(ability.description || '');
  return full.includes('\n') ? full.slice(full.indexOf('\n') + 1).trim() : ability.effect;
}

function renderResults() {
  const results = evaluateTeam(members());
  const toggle = $('team-result-toggle');
  toggle.disabled = results.length === 0;
  if (toggle.disabled) setResultsExpanded(false);
  const active = results.filter(r => r.status === 'active').length;
  const summary = $('team-summary');
  if (!results.length) summary.replaceChildren(el('span', 'planner-muted', '还没有选择代理人'));
  else {
    const label = el('span', '', '额外能力生效');
    label.dataset.i18nEn = 'abilities active';
    summary.replaceChildren(el('b', '', String(active) + '/' + results.length), label);
  }
  $('team-results').replaceChildren(...results.map(({agent, status, by}) => {
    const card = el('article', 'team-result'); card.dataset.status = status;
    const head = el('header'), copy = el('div');
    const name = el('p', '', agent.ability.name); if (agent.ability.nameEn) name.dataset.i18nEn = agent.ability.nameEn;
    copy.append(el('h3', '', agent.name), name);
    const opening = availabilityBadge(agent); if (opening) copy.append(opening);
    head.append(picture(agent.icon, '', 'planner-icon'), copy, el('span', `pill ${STATUS[status][0]}`, STATUS[status][1]));
    card.append(head);
    if (agent.status === 'beta') card.append(el('p', 'team-why', '3.3 测试服资料，条件按测试服摘要整理。'));
    else card.append(el('p', 'team-condition', agent.ability.condition));
    const why = el('p', 'team-why');
    if (status === 'active') {
      const [open, close, comma] = english() ? [' (', ')', ', '] : ['（', '）', '、'];
      why.append(el('strong', '', '满足：'));
      by.forEach(({agent: mate, reasons}, i) => {
        if (i) why.append(el('span', '', comma));
        why.append(el('span', '', mate.name), el('span', '', open), el('span', '', reasons.map(r => r === 'specialty' ? mate.specialty : REASON[r]).join(' / ')), el('span', '', close));
      });
    } else {
      why.append(el('strong', '', status === 'unknown' ? '测试服角色的支援类型未确认。' : '还需要：'));
      if (status !== 'unknown') optionsText(agent).forEach((part, i) => { if (i) why.append(el('span', '', ' / ')); why.append(el('span', '', part)); });
    }
    card.append(why);
    const details = el('details'), effect = el('p', '', effectText(agent));
    effect.dataset.i18nSkip = '';
    details.append(el('summary', '', '能力效果'), effect);
    card.append(details);
    return card;
  }));
}

function render() { renderSlots(); renderResults(); picker?.render(); }

async function main() {
  try {
    const [data, catalog] = await Promise.all([loadJSON('team-abilities.json?v=20261111-refresh-launch-1'), loadJSON('tuning-catalog.json?v=20261111-refresh-launch-1')]);
    const order = {released: 0, beta: 1};
    roster = [...data.agents].sort((a, b) => (order[b.status] - order[a.status]) || Number(b.id) - Number(a.id));
    byId = Object.fromEntries(roster.map(agent => [agent.id, agent]));
    const aliases = Object.fromEntries(Object.entries(catalog.items).map(([id, item]) => [id, item.aliases || []]));
    picker = mountPicker($('team-picker'), {agents: roster, aliases, isSelected: id => team.includes(id), onPick: toggle});
    readTeam(); render();
  } catch (error) {
    $('team-status').textContent = '资料读取失败，请刷新重试。';
    console.error(error);
  }
}

function setResultsExpanded(expanded) {
  $('team-result-toggle').setAttribute('aria-expanded', String(expanded));
  $('team-results').classList.toggle('team-results-folded', !expanded);
}
$('team-result-toggle').addEventListener('click', event => {
  setResultsExpanded(event.currentTarget.getAttribute('aria-expanded') !== 'true');
});
$('team-clear').addEventListener('click', () => { team = [null, null, null]; saveTeam(); render(); });
$('team-share').addEventListener('click', async () => {
  saveTeam();
  try { await navigator.clipboard.writeText(location.href); toast('已复制队伍链接'); } catch { toast('复制失败，可直接复制地址栏'); }
});
window.addEventListener('hashchange', () => { readTeam(); render(); });
window.addEventListener('dukelanguagechange', () => renderResults());
main();

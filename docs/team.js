import {ROTATION_EXAMPLE_IDS, rotationConfiguration, rotationPreset, rotationBuild} from "./team-rotation-config.js?v=91d5e16f23261a80";
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
  readRotationHash();
}
function saveTeam() {
  const ids = team.filter(Boolean);
  try { localStorage.setItem(STORAGE, JSON.stringify(ids)); } catch { /* the hash still carries the team */ }
  history.replaceState(history.state, '', `${location.pathname}${location.search}${ids.length ? `#team=${ids.join(',')}${rotationHashSuffix()}` : ''}`);
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

// Slot changes move identities only; their saved builds remain keyed by agent ID.
function swapTeamSlots(from, to) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= team.length || to >= team.length || from === to || !team[from] || !team[to]) return;
  const movedId = team[from];
  [team[from], team[to]] = [team[to], team[from]];
  saveTeam(); render();
  const controls = [...$('team-slots').querySelectorAll('[data-team-order-agent]')].filter(item => item.dataset.teamOrderAgent === movedId);
  (controls.find(item => item.dataset.teamOrderDirection === (to > from ? 'next' : 'previous') && !item.disabled) || controls.find(item => !item.disabled))?.focus({preventScroll: true});
  const status = $('team-order-status');
  if (status) status.textContent = english() ? `Moved ${i18n()?.english(byId[movedId].name) || byId[movedId].name} to slot ${['A', 'B', 'C'][to]}. The plan has updated.` : `${byId[movedId].name}已移至${['A', 'B', 'C'][to]}位，方案已更新。`;
}

function renderSlots() {
  const slots = $('team-slots');
  slots.replaceChildren(...team.map((id, index) => {
    const agent = byId[id], card = el('article', 'team-slot-card');
    const slot = el('button', `team-slot${agent ? ' filled' : ''}`); slot.type = 'button';
    const letter = ['A', 'B', 'C'][index];
    if (!agent) {
      slot.append(el('span', '', english() ? `${letter} · Select an agent below` : `${letter}位 · 从下方选择`));
      slot.disabled = true; card.append(slot); return card;
    }
    const meta = el('small'); meta.append(el('span', '', agent.element), el('span', '', ' · '), el('span', '', agent.specialty), el('span', '', ' · '), el('span', '', agent.faction));
    const badge = el('small', 'team-slot-position', english() ? `${letter} · Slot ${index + 1}` : `${letter} · 第 ${index + 1} 位`); badge.dataset.i18nSkip = '';
    const copy = el('div', 'team-slot-copy'); copy.append(badge, el('strong', '', agent.name), meta);
    slot.append(picture(agent.icon, ''), copy, el('span', 'slot-remove', '×'));
    const displayName = english() ? i18n()?.english(agent.name) || agent.name : agent.name;
    slot.setAttribute('aria-label', english() ? `Remove agent: ${displayName}` : `移除队员：${agent.name}`); slot.title = english() ? 'Remove' : '移除';
    slot.addEventListener('click', () => { team[index] = null; saveTeam(); render(); });
    const controls = el('div', 'team-order-controls'); controls.dataset.i18nSkip = '';
    for (const direction of [-1, 1]) {
      const target = index + direction;
      const move = el('button', 'team-order-button', direction < 0 ? (english() ? '← Prev' : '← 前移') : (english() ? 'Next →' : '后移 →'));
      move.type = 'button'; move.disabled = target < 0 || target >= team.length || !team[target];
      move.dataset.teamOrderAgent = id; move.dataset.teamOrderDirection = direction < 0 ? 'previous' : 'next';
      move.setAttribute('aria-label', english() ? `Move ${displayName} ${direction < 0 ? 'one slot earlier' : 'one slot later'}` : `${agent.name}${direction < 0 ? '前移一位' : '后移一位'}`);
      move.addEventListener('click', () => swapTeamSlots(index, target)); controls.append(move);
    }
    card.append(slot, controls); return card;
  }));
  if (!$('team-order-status')) {
    const status = el('p', 'team-order-status'); status.id = 'team-order-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.dataset.i18nSkip = '';
    slots.after(status);
  }
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

function render() { renderSlots(); renderResults(); picker?.render(); renderRotationGuide(); }

async function main() {
  try {
    const data = await loadJSON('team-abilities.json?v=20261111-refresh-launch-1');
    const order = {released: 0, beta: 1};
    roster = [...data.agents].sort((a, b) => (order[b.status] - order[a.status]) || Number(b.id) - Number(a.id));
    byId = Object.fromEntries(roster.map(agent => [agent.id, agent]));
    const aliases = TEAM_SEARCH_ALIASES;
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
window.addEventListener('dukelanguagechange', () => { renderSlots(); renderResults(); });

const ROTATION_DIRECTORY={"version":"20261115-rotation-knowledge-1","agents":{"1011":{"id":"1011","name":"安比","nameEn":"Anby","rank":"A","icon":"assets/tuning/agent-1011.webp","signatureWeaponId":"13101","potentialLevels":[],"roleLabel":{"zh":"击破","en":"Stun"}},"1021":{"id":"1021","name":"猫又","nameEn":"Nekomata","rank":"S","icon":"assets/tuning/agent-1021.webp","signatureWeaponId":"14102","potentialLevels":[1,2,3,4,5,6],"roleLabel":{"zh":"强攻","en":"Attack"}},"1031":{"id":"1031","name":"妮可","nameEn":"Nicole","rank":"A","icon":"assets/tuning/agent-1031.webp","signatureWeaponId":"13103","potentialLevels":[],"roleLabel":{"zh":"支援","en":"Support"}},"1041":{"id":"1041","name":"「11号」","nameEn":"Soldier 11","rank":"S","icon":"assets/tuning/agent-1041.webp","signatureWeaponId":"14104","potentialLevels":[1,2,3,4,5,6],"roleLabel":{"zh":"强攻","en":"Attack"}},"1051":{"id":"1051","name":"伊德海莉","nameEn":"Yidhari","rank":"S","icon":"assets/tuning/agent-1051.webp","signatureWeaponId":"14105","potentialLevels":[],"roleLabel":{"zh":"命破","en":"Rupture"}},"1061":{"id":"1061","name":"可琳","nameEn":"Corin","rank":"A","icon":"assets/tuning/agent-1061.webp","signatureWeaponId":"13106","potentialLevels":[],"roleLabel":{"zh":"强攻","en":"Attack"}},"1071":{"id":"1071","name":"凯撒","nameEn":"Caesar","rank":"S","icon":"assets/tuning/agent-1071.webp","signatureWeaponId":"14107","potentialLevels":[],"roleLabel":{"zh":"防护","en":"Defense"}},"1081":{"id":"1081","name":"比利","nameEn":"Billy","rank":"A","icon":"assets/tuning/agent-1081.webp","signatureWeaponId":"13108","potentialLevels":[],"roleLabel":{"zh":"强攻","en":"Attack"}},"1091":{"id":"1091","name":"雅","nameEn":"Miyabi","rank":"S","icon":"assets/tuning/agent-1091.webp","signatureWeaponId":"14109","potentialLevels":[],"roleLabel":{"zh":"异常","en":"Anomaly"}},"1101":{"id":"1101","name":"珂蕾妲","nameEn":"Koleda","rank":"S","icon":"assets/tuning/agent-1101.webp","signatureWeaponId":"14110","potentialLevels":[1,2,3,4,5,6],"roleLabel":{"zh":"击破","en":"Stun"}},"1111":{"id":"1111","name":"安东","nameEn":"Anton","rank":"A","icon":"assets/tuning/agent-1111.webp","signatureWeaponId":"13111","potentialLevels":[],"roleLabel":{"zh":"强攻","en":"Attack"}},"1121":{"id":"1121","name":"本","nameEn":"Ben","rank":"A","icon":"assets/tuning/agent-1121.webp","signatureWeaponId":"13112","potentialLevels":[],"roleLabel":{"zh":"防护","en":"Defense"}},"1131":{"id":"1131","name":"苍角","nameEn":"Soukaku","rank":"A","icon":"assets/tuning/agent-1131.webp","signatureWeaponId":"13113","potentialLevels":[],"roleLabel":{"zh":"支援","en":"Support"}},"1141":{"id":"1141","name":"莱卡恩","nameEn":"Lycaon","rank":"S","icon":"assets/tuning/agent-1141.webp","signatureWeaponId":"14114","potentialLevels":[1,2,3,4,5,6],"roleLabel":{"zh":"击破","en":"Stun"}},"1151":{"id":"1151","name":"露西","nameEn":"Lucy","rank":"A","icon":"assets/tuning/agent-1151.webp","signatureWeaponId":"13115","potentialLevels":[],"roleLabel":{"zh":"支援","en":"Support"}},"1161":{"id":"1161","name":"莱特","nameEn":"Lighter","rank":"S","icon":"assets/tuning/agent-1161.webp","signatureWeaponId":"14116","potentialLevels":[],"roleLabel":{"zh":"击破","en":"Stun"}},"1171":{"id":"1171","name":"柏妮思","nameEn":"Burnice","rank":"S","icon":"assets/tuning/agent-1171.webp","signatureWeaponId":"14117","potentialLevels":[1,2,3,4,5,6],"roleLabel":{"zh":"异常","en":"Anomaly"}},"1181":{"id":"1181","name":"格莉丝","nameEn":"Grace","rank":"S","icon":"assets/tuning/agent-1181.webp","signatureWeaponId":"14118","potentialLevels":[1,2,3,4,5,6],"roleLabel":{"zh":"异常","en":"Anomaly"}},"1191":{"id":"1191","name":"艾莲","nameEn":"Ellen","rank":"S","icon":"assets/tuning/agent-1191.webp","signatureWeaponId":"14119","potentialLevels":[1,2,3,4,5,6],"roleLabel":{"zh":"强攻","en":"Attack"}},"1201":{"id":"1201","name":"悠真","nameEn":"Harumasa","rank":"S","icon":"assets/tuning/agent-1201.webp","signatureWeaponId":"14120","potentialLevels":[1,2,3,4,5,6],"roleLabel":{"zh":"强攻","en":"Attack"}},"1211":{"id":"1211","name":"丽娜","nameEn":"Rina","rank":"S","icon":"assets/tuning/agent-1211.webp","signatureWeaponId":"14121","potentialLevels":[1,2,3,4,5,6],"roleLabel":{"zh":"支援","en":"Support"}},"1221":{"id":"1221","name":"柳","nameEn":"Yanagi","rank":"S","icon":"assets/tuning/agent-1221.webp","signatureWeaponId":"14122","potentialLevels":[],"roleLabel":{"zh":"异常","en":"Anomaly"}},"1241":{"id":"1241","name":"朱鸢","nameEn":"Zhu Yuan","rank":"S","icon":"assets/tuning/agent-1241.webp","signatureWeaponId":"14124","potentialLevels":[],"roleLabel":{"zh":"强攻","en":"Attack"}},"1251":{"id":"1251","name":"青衣","nameEn":"Qingyi","rank":"S","icon":"assets/tuning/agent-1251.webp","signatureWeaponId":"14125","potentialLevels":[],"roleLabel":{"zh":"击破","en":"Stun"}},"1261":{"id":"1261","name":"简","nameEn":"Jane","rank":"S","icon":"assets/tuning/agent-1261.webp","signatureWeaponId":"14126","potentialLevels":[1,2,3,4,5,6],"roleLabel":{"zh":"异常","en":"Anomaly"}},"1271":{"id":"1271","name":"赛斯","nameEn":"Seth","rank":"A","icon":"assets/tuning/agent-1271.webp","signatureWeaponId":"13127","potentialLevels":[],"roleLabel":{"zh":"防护","en":"Defense"}},"1281":{"id":"1281","name":"派派","nameEn":"Piper","rank":"A","icon":"assets/tuning/agent-1281.webp","signatureWeaponId":"13128","potentialLevels":[],"roleLabel":{"zh":"异常","en":"Anomaly"}},"1291":{"id":"1291","name":"雨果","nameEn":"Hugo","rank":"S","icon":"assets/tuning/agent-1291.webp","signatureWeaponId":"14129","potentialLevels":[],"roleLabel":{"zh":"强攻","en":"Attack"}},"1301":{"id":"1301","name":"奥菲丝&「鬼火」","nameEn":"Orphie & Magus","rank":"S","icon":"assets/tuning/agent-1301.webp","signatureWeaponId":"14130","potentialLevels":[],"roleLabel":{"zh":"强攻","en":"Attack"}},"1311":{"id":"1311","name":"耀嘉音","nameEn":"Astra Yao","rank":"S","icon":"assets/tuning/agent-1311.webp","signatureWeaponId":"14131","potentialLevels":[],"roleLabel":{"zh":"支援","en":"Support"}},"1321":{"id":"1321","name":"伊芙琳","nameEn":"Evelyn","rank":"S","icon":"assets/tuning/agent-1321.webp","signatureWeaponId":"14132","potentialLevels":[],"roleLabel":{"zh":"强攻","en":"Attack"}},"1331":{"id":"1331","name":"薇薇安","nameEn":"Vivian","rank":"S","icon":"assets/tuning/agent-1331.webp","signatureWeaponId":"14133","potentialLevels":[],"roleLabel":{"zh":"异常","en":"Anomaly"}},"1341":{"id":"1341","name":"照","nameEn":"Zhao","rank":"S","icon":"assets/tuning/agent-1341.webp","signatureWeaponId":"14134","potentialLevels":[],"roleLabel":{"zh":"防护","en":"Defense"}},"1351":{"id":"1351","name":"波可娜","nameEn":"Pulchra","rank":"A","icon":"assets/tuning/agent-1351.webp","signatureWeaponId":"13135","potentialLevels":[],"roleLabel":{"zh":"击破","en":"Stun"}},"1361":{"id":"1361","name":"「扳机」","nameEn":"Trigger","rank":"S","icon":"assets/tuning/agent-1361.webp","signatureWeaponId":"14136","potentialLevels":[],"roleLabel":{"zh":"击破","en":"Stun"}},"1371":{"id":"1371","name":"仪玄","nameEn":"Yixuan","rank":"S","icon":"assets/tuning/agent-1371.webp","signatureWeaponId":"14137","potentialLevels":[],"roleLabel":{"zh":"命破","en":"Rupture"}},"1381":{"id":"1381","name":"零号·安比","nameEn":"Soldier 0 - Anby","rank":"S","icon":"assets/tuning/agent-1381.webp","signatureWeaponId":"14138","potentialLevels":[1,2,3,4,5,6],"roleLabel":{"zh":"强攻","en":"Attack"}},"1391":{"id":"1391","name":"橘福福","nameEn":"Ju Fufu","rank":"S","icon":"assets/tuning/agent-1391.webp","signatureWeaponId":"14139","potentialLevels":[],"roleLabel":{"zh":"击破","en":"Stun"}},"1401":{"id":"1401","name":"爱丽丝","nameEn":"Alice","rank":"S","icon":"assets/tuning/agent-1401.webp","signatureWeaponId":"14140","potentialLevels":[],"roleLabel":{"zh":"异常","en":"Anomaly"}},"1411":{"id":"1411","name":"柚叶","nameEn":"Yuzuha","rank":"S","icon":"assets/tuning/agent-1411.webp","signatureWeaponId":"14141","potentialLevels":[],"roleLabel":{"zh":"支援","en":"Support"}},"1421":{"id":"1421","name":"潘引壶","nameEn":"Pan Yinhu","rank":"A","icon":"assets/tuning/agent-1421.webp","signatureWeaponId":"13142","potentialLevels":[],"roleLabel":{"zh":"防护","en":"Defense"}},"1431":{"id":"1431","name":"叶瞬光","nameEn":"Ye Shunguang","rank":"S","icon":"assets/tuning/agent-1431.webp","signatureWeaponId":"14143","potentialLevels":[],"roleLabel":{"zh":"强攻","en":"Attack"}},"1441":{"id":"1441","name":"真斗","nameEn":"Manato","rank":"A","icon":"assets/tuning/agent-1441.webp","signatureWeaponId":"13144","potentialLevels":[],"roleLabel":{"zh":"命破","en":"Rupture"}},"1451":{"id":"1451","name":"卢西娅","nameEn":"Lucia","rank":"S","icon":"assets/tuning/agent-1451.webp","signatureWeaponId":"14145","potentialLevels":[],"roleLabel":{"zh":"支援","en":"Support"}},"1461":{"id":"1461","name":"「席德」","nameEn":"Seed","rank":"S","icon":"assets/tuning/agent-1461.webp","signatureWeaponId":"14146","potentialLevels":[],"roleLabel":{"zh":"强攻","en":"Attack"}},"1471":{"id":"1471","name":"般岳","nameEn":"Banyue","rank":"S","icon":"assets/tuning/agent-1471.webp","signatureWeaponId":"14147","potentialLevels":[],"roleLabel":{"zh":"命破","en":"Rupture"}},"1481":{"id":"1481","name":"琉音","nameEn":"Dialyn","rank":"S","icon":"assets/tuning/agent-1481.webp","signatureWeaponId":"14148","potentialLevels":[],"roleLabel":{"zh":"击破","en":"Stun"}},"1491":{"id":"1491","name":"千夏","nameEn":"Sunna","rank":"S","icon":"assets/tuning/agent-1491.webp","signatureWeaponId":"14149","potentialLevels":[],"roleLabel":{"zh":"支援","en":"Support"}},"1501":{"id":"1501","name":"爱芮","nameEn":"Aria","rank":"S","icon":"assets/tuning/agent-1501.webp","signatureWeaponId":"14150","potentialLevels":[],"roleLabel":{"zh":"异常","en":"Anomaly"}},"1511":{"id":"1511","name":"南宫羽","nameEn":"Nangong Yu","rank":"S","icon":"assets/tuning/agent-1511.webp","signatureWeaponId":"14151","potentialLevels":[],"roleLabel":{"zh":"击破","en":"Stun"}},"1521":{"id":"1521","name":"希希芙","nameEn":"Cissia","rank":"S","icon":"assets/tuning/agent-1521.webp","signatureWeaponId":"14152","potentialLevels":[],"roleLabel":{"zh":"强攻","en":"Attack"}},"1531":{"id":"1531","name":"星徽·比利","nameEn":"Starlight - Billy","rank":"S","icon":"assets/tuning/agent-1531.webp","signatureWeaponId":"14153","potentialLevels":[],"roleLabel":{"zh":"命破","en":"Rupture"}},"1541":{"id":"1541","name":"普罗米娅","nameEn":"Promeia","rank":"S","icon":"assets/tuning/agent-1541.webp","signatureWeaponId":"14154","potentialLevels":[],"roleLabel":{"zh":"异常","en":"Anomaly"}},"1551":{"id":"1551","name":"佩洛伊斯","nameEn":"Pyrois","rank":"S","icon":"assets/tuning/agent-1551.webp","signatureWeaponId":"14155","potentialLevels":[],"roleLabel":{"zh":"强攻","en":"Attack"}},"1561":{"id":"1561","name":"维琳娜","nameEn":"Velina","rank":"S","icon":"assets/tuning/agent-1561.webp","signatureWeaponId":"14156","potentialLevels":[],"roleLabel":{"zh":"异常","en":"Anomaly"}},"1571":{"id":"1571","name":"诺姆","nameEn":"Norma","rank":"S","icon":"assets/tuning/agent-1571.webp","signatureWeaponId":"14157","potentialLevels":[],"roleLabel":{"zh":"击破","en":"Stun"}},"1581":{"id":"1581","name":"蕾米埃尔","nameEn":"Remielle","rank":"S","icon":"assets/tuning/agent-1581.webp","signatureWeaponId":"14158","potentialLevels":[],"roleLabel":{"zh":"异常","en":"Anomaly"}},"1591":{"id":"1591","name":"希格莉德","nameEn":"Sigrid","rank":"S","icon":"assets/tuning/agent-1591.webp","signatureWeaponId":"14159","potentialLevels":[],"roleLabel":{"zh":"强攻","en":"Attack"}},"1611":{"id":"1611","name":"克拉蕾","nameEn":"Claret","rank":"S","icon":"assets/tuning/agent-1611.webp","signatureWeaponId":"14161","potentialLevels":[],"roleLabel":{"zh":"锋御","en":"Armorer"}},"1621":{"id":"1621","name":"洛克茜","nameEn":"Roxy","rank":"S","icon":"assets/tuning/agent-1621.webp","signatureWeaponId":"14162","potentialLevels":[],"roleLabel":{"zh":"击破","en":"Stun"}},"1631":{"id":"1631","name":"赛维里安","nameEn":"Severian","rank":"S","icon":"assets/tuning/agent-1631.webp","signatureWeaponId":"14163","potentialLevels":[],"roleLabel":{"zh":"强攻","en":"Attack"}},"1641":{"id":"1641","name":"菲欧妮","nameEn":"Phoenix","rank":"S","icon":"assets/tuning/agent-1641.webp","signatureWeaponId":"14164","potentialLevels":[],"roleLabel":{"zh":"异常","en":"Anomaly"}}}};
const TEAM_SEARCH_ALIASES={"1011":["Anby","Энби","アンビー","엔비"],"1021":["Nekomata","Нэкомата","貓又","네코마타"],"1031":["Nicole","Николь","ニコ","니콜"],"1041":["\"Soldier 11\"","Chiến Binh 11","N.º 11","N.º 11","Soldatin Nr. 11","Soldat 11","Soldier 11","Солдат 11","「11號」","「11호」"],"1051":["Yidhari","Йидхари","イドリー","이드하리"],"1061":["Corin","Корин","カリン","코린"],"1071":["Caesar","César","Цезарь","シーザー","凱撒","카이사르"],"1081":["Billy","Билли","ビリー","빌리"],"1091":["Miyabi","Мияби","星見雅","미야비"],"1101":["Koleda","Коляда","クレタ","콜레다"],"1111":["Anton","Antón","Антон","アンドー","安東","앤톤"],"1121":["Ben","Бен","ベン","벤"],"1131":["Soukaku","Сокаку","蒼角","소우카쿠"],"1141":["Lycaon","Ликаон","ライカン","萊卡恩","리카온"],"1151":["Lucy","Люси","ルーシー","루시"],"1161":["Lighter","Лайтер","ライト","萊特","라이터"],"1171":["Bernice","Burnice","Бёрнис","バーニス","버니스"],"1181":["Grace","Грейс","グレース","格莉絲","그레이스"],"1191":["Ellen","Эллен","エレン","艾蓮","엘렌"],"1201":["Harumasa","Харумаса","浅羽悠真","하루마사"],"1211":["Rina","Рина","リナ","麗娜","리나"],"1221":["Yanagi","Янаги","月城柳","야나기"],"1241":["Zhu Yuan","Чжу Юань","朱鳶","주연"],"1251":["Qingyi","Цинъи","청의"],"1261":["Jane","Джейн","ジェーン","簡","제인"],"1271":["Seth","Сет","セス","賽斯","세스"],"1281":["Piper","Пайпер","パイパー","파이퍼"],"1291":["Hugo","Хуго","ヒューゴ","휴고"],"1301":["Orfeu & Magus","Orfia y Magas","Orphie & \"Magus\"","Orphie & Magus","Orphie và Magus","Orphie & Magus","Орфея и Магус","オルペウス&「鬼火」","奧菲絲&「鬼火」","오피&「도깨비불」"],"1311":["Astra Yao","Астра Яо","アストラ","아스트라"],"1321":["Evelyn","Évelyne","Эвелин","イヴリン","이블린"],"1331":["Vivian","Viviane","Вивиан","ビビアン","비비안"],"1341":["Zhao","Чжао","자오"],"1351":["Pulchra","Пульхра","プルクラ","펄크라"],"1361":["\"Trigger\"","Gatillo","Gâchette","Trigger","Гашетка","「トリガー」","「扳機」","「트리거」"],"1371":["Yixuan","Исюань","儀玄","의현"],"1381":["0号・アンビー","0호·엔비","Chiến Binh 0 - Anby","N.º 0: Anby","Soldado\nN.º0 - Anby","Soldat 0 - Anby","Soldatin Nr. 0 – Anby","Soldier 0 - Anby","Солдат 0 Энби","零號·安比"],"1391":["Ju Fufu","Цзюй Фуфу","귤복복"],"1401":["Alice","Элис","アリス","愛麗絲","앨리스"],"1411":["Yuzuha","Юдзуха","柚葉","浮波柚葉","유즈하"],"1421":["Pan Yinhu","Пань Иньху","潘引壺","반인호"],"1431":["Ye Shunguang","Е Шуньгуан","葉瞬光","엽빛나"],"1441":["Manato","Манато","狛野真斗","마나토"],"1451":["Lucia","Lucía","Lúcia","Люсия","リュシア","盧西婭","루시아"],"1461":["\"Seed\"","Seed","Sporos","Сид","「シード」","「시드」"],"1471":["Banyue","Баньюэ","盤岳","반악"],"1481":["Dialyn","Диалинь","ダイアリン","다이아린"],"1491":["Sunna","Sunniva","Санна","수나"],"1501":["Aria","Ария","アリア","愛芮","아리아"],"1511":["Nangong Yu","Наньгун Юй","南宮羽","남궁우"],"1521":["Cissia","Císsia","Циссия","シーシィア","시시아"],"1531":["Billy - Stellaire","Billy Estelar","Starlight - Billy","Sternenlicht – Billy","Ánh Sao - Billy","Звёздный Билли","スターライト･ビリー","스타라이트·빌리"],"1541":["Promeia","Промея","プロメイア","普羅米婭","프로미아"],"1551":["Pyrois","Pyroïs","Пироис","ピュロイス","피로이스"],"1561":["Velina","Vélina","Велина","ヴェリナ","維琳娜","벨리나"],"1571":["Norma","Норма","ノルムー","諾姆","노르마"],"1581":["Remielle","Rémielle","Ремиэлла","レミエール","蕾米埃爾","레미엘"],"1591":["Sigrid","Сигрид","シグリッド","시그리드"],"1611":["Claret","Clarette","Кларет","クラレッタ","클라렛"],"1621":["Roxy","Рокси","ロクシー","록시","洛克西","洛克茜·伊芙莉塔·普莱斯"],"1631":["Severian","Severian Lowell","Севериан","セヴェリアン","塞维里安","賽維里安","赛维利安","세베리안"],"1641":["Phoenix","Phoenix Reffaella","Phénix","Феникс","フィオニー","菲欧妮·蕾法爱菈","菲歐妮","피닉스"]};
const ROTATION_FILES={"agent-1011.json":"e50cef713db8bf5e","agent-1021.json":"f78385571ffb2fac","potential-1021.json":"f3dbe432c2e3e0e2","agent-1031.json":"7e8f6c004904807b","agent-1041.json":"0a32c7bd1c883c9f","potential-1041.json":"3d5424953a1376ee","agent-1051.json":"e0fcabdc940e17e1","agent-1061.json":"c21fa6e66ecf6378","agent-1071.json":"2936a29909ba4167","agent-1081.json":"d0f13411746fe504","agent-1091.json":"a6dddd5121f45615","agent-1101.json":"43b42d6a0d9aa456","potential-1101.json":"963b3777b0476132","agent-1111.json":"55480e02c66ae36c","agent-1121.json":"d2ac23e6ea1f1cf7","agent-1131.json":"4b7c16b11949b31a","agent-1141.json":"bd72a60361b1eed6","potential-1141.json":"af46bd888b515915","agent-1151.json":"f9d64d8080ecc1b1","agent-1161.json":"8bee04c1664ec5a6","agent-1171.json":"24fac66847fc9a60","potential-1171.json":"24b563f767394051","agent-1181.json":"bc282644d198c5d2","potential-1181.json":"1ba45dde8f3b7e6b","agent-1191.json":"e51c0eba1ee08937","potential-1191.json":"02924e1644eefbb6","agent-1201.json":"1f424a9d1924b7b6","potential-1201.json":"e56eab410dd397cc","agent-1211.json":"af9452b0992050a4","potential-1211.json":"3dc724661b19cd50","agent-1221.json":"be138410b36ed471","agent-1241.json":"8aac98f945cb0457","agent-1251.json":"4e95513626da0966","agent-1261.json":"19c7b4b6673806ab","potential-1261.json":"83df17a165350d45","agent-1271.json":"d1f4dcd46725b262","agent-1281.json":"9e0ffb9560f64521","agent-1291.json":"3d96ee0f34c15304","agent-1301.json":"49649010ee711412","agent-1311.json":"21755ddd7dd0f693","agent-1321.json":"473c2fa23ae179c2","agent-1331.json":"c2bcb19de7891c77","agent-1341.json":"b04186c25ae05c48","agent-1351.json":"8f0dcb1b11abfe2d","agent-1361.json":"61dfef8c4c94863b","agent-1371.json":"4507b6bbc90e5bfa","agent-1381.json":"1079db21b3b55f10","potential-1381.json":"fafd53095d49540c","agent-1391.json":"59e5a511abf2f243","agent-1401.json":"d0ee302854014a3b","agent-1411.json":"66ff549d7ab2a536","agent-1421.json":"d97ca3ec46563cb9","agent-1431.json":"c9127bd968e212c9","agent-1441.json":"1b0e40cfaeeaf55b","agent-1451.json":"ba034334ff402d33","agent-1461.json":"76b2b49c36bbc941","agent-1471.json":"ca97f5c4ec16b4ac","agent-1481.json":"90085e289b46b7e1","agent-1491.json":"e8db8f8be765410d","agent-1501.json":"df843520b476c80c","agent-1511.json":"277dd0ba60a62a7e","agent-1521.json":"5eadedcefd777863","agent-1531.json":"a5cdd64c0ed544b5","agent-1541.json":"f71606324d9ef085","agent-1551.json":"7a92559f25febf17","agent-1561.json":"d8b57a683e0c39f0","agent-1571.json":"268a8a4cd0b57d96","agent-1581.json":"d7a69f300920d8b4","agent-1591.json":"97ce8be001a814b2","agent-1611.json":"ec9ca6eded1994bd","agent-1621.json":"0aa2006feb99d9c6","agent-1631.json":"502b3cd779c147dc","agent-1641.json":"e7e7e265b44de654","lesson-1561-1581-1641.json":"97ba8d76c649d16c","lesson-1151-1261-1271.json":"020111328940124b","lesson-1071-1091-1221.json":"276b481ec4aa4a80","lesson-1031-1241-1251.json":"1fcb396ff23cdbf5","lesson-1131-1141-1191.json":"531021909514357f","lesson-1371-1391-1421.json":"28e473dd6bc03dac","lesson-1331-1401-1411.json":"82b6129d798a7e3d","lesson-1091-1221-1311.json":"d0ea0ff7482e07ad","lesson-1151-1171-1221.json":"8c4db707cc800e02","lesson-1141-1161-1291.json":"00a607ba5c35c6ec","lesson-1161-1311-1321.json":"2927dc867aa4e95e","lesson-1311-1361-1381.json":"d55ee1673710ee33","lesson-1311-1371-1421.json":"877ee438bb84e706","lesson-1261-1331-1411.json":"7bd9d8bb4d9ac918","lesson-1221-1331-1411.json":"3942cee63e61362b","lesson-1201-1251-1311.json":"e3a0e42cc1800ef2","lesson-1041-1151-1161.json":"27df8a0b9b7a0103","lesson-1051-1391-1451.json":"3cecd395790e1a95","lesson-1451-1471-1481.json":"14775fb250ca83f5","lesson-1071-1171-1281.json":"ed2e33fe4d658bc5","lesson-1411-1501-1561.json":"2a9b4ef0fb000379","lesson-1411-1541-1561.json":"5aac2b21fce9d864","lesson-1301-1361-1461.json":"8d22461393189716","lesson-1301-1361-1381.json":"04b25f37fd6fa10b","lesson-1341-1431-1481.json":"22e55610cf92c487","lesson-1311-1341-1431.json":"80dd13d60fbb2c24","lesson-1261-1411-1561.json":"37987b00c2d2c51e","lesson-1401-1411-1561.json":"5f36a3e77def2d28","lesson-1311-1481-1591.json":"22c263f08210da5a","lesson-1031-1311-1551.json":"8d552400cee8db61","lesson-1211-1611-1621.json":"308fa0cb631325b9","runtime.js":"d5ee77f570ab9818","expert.js":"f782360e6015436d","specialist.js":"e2829c9fae1e9e6a"};
function mountRotationGuide(container, options = {}) {
  const doc = container.ownerDocument, win = doc.defaultView;
  let team = teamIds(options.team), data = options.data || {}, config = normalize(options.config);
  let phaseId = '', index = 0, started = false, paused = true, pending = false, destroyed = false;
  let lastSignature = '', lastChange = null, revealStep = false;
  let plainTerms = null, plainSignature = '', bundle = options.bundle;
  let chosenStep = null, chosenRef = '';
  const openDetails = new Map();
  const root = element('section', 'rotation-guide rotation-universal-guide');
  container.replaceChildren(root);

  function isEnglish() { return win.DUKE_I18N?.language === 'en'; }
  function text(zh, en) { return isEnglish() ? en : zh; }
  function value(item) {
    if (item == null) return '';
    if (typeof item === 'object') return String(isEnglish() ? (item.en ?? item.zh ?? '') : (item.zh ?? item.en ?? ''));
    return String(item);
  }
  function plain(item, actorId) { return plainTerms ? plainTerms.text(item, actorId) : item; }
  function actionTitle(step) { return plainTerms ? plainTerms.title(step) : step.title; }
  function element(tag, cls = '', content = '') {
    const item = doc.createElement(tag);
    if (cls) item.className = cls;
    if (content !== '') item.textContent = value(content);
    return item;
  }
  function button(label, callback, control, cls = '') {
    const item = element('button', `rotation-button ${cls}`.trim(), label);
    item.type = 'button';
    if (control) item.dataset.rotationControl = control;
    item.addEventListener('click', callback);
    return item;
  }
  function teamIds(input = []) { return input.filter(Boolean).map(item => String(typeof item === 'object' ? item.id : item)).slice(0, 3); }
  function normalize(input = {}) {
    const characters = {};
    for (const [id, item] of Object.entries(input.characters || {})) {
      const rank=Math.max(0,Math.min(6,Math.trunc(Number(item?.potential)||0)));
      const member=agent(id), levels=member?.potentialLevels;
      // The view only contains this squad; preserve other agents' saved ranks.
      // The knowledge-backed configuration validator validates the full roster.
      characters[id] = {mindscape: Math.max(0, Math.min(6, Math.trunc(Number(item?.mindscape) || 0))), signature: Math.max(0, Math.min(5, Math.trunc(Number(item?.signature) || 0))), potential:!member?rank:rank>0&&Array.isArray(levels)&&levels.includes(rank)?rank:0};
    }
    const keyBindings = {};
    for (const [id, label] of Object.entries(input.keyBindings || {})) keyBindings[id] = String(label).slice(0, 32);
    return {...input, characters, keyBindings, focusAgentId: String(input.focusAgentId || ''), strategy: ['auto', 'steady', 'burst'].includes(input.strategy) ? input.strategy : 'auto'};
  }
  function copyConfig() { return JSON.parse(JSON.stringify(config)); }
  function agents() { return Array.isArray(data.agents) ? data.agents : Object.values(data.agents || {}); }
  function agent(id) { return agents().find(item => String(item.id) === String(id)); }
  function agentName(id) {
    const item = agent(id);
    return item ? value(isEnglish() && item.nameEn ? item.nameEn : item.name) : text('未识别角色', 'Unknown agent');
  }
  function slot(id) { const at = team.indexOf(String(id)); return at < 0 ? '' : ['A', 'B', 'C'][at]; }
  function guide() { return !pending && data.guide && Array.isArray(data.guide.phases) ? data.guide : null; }
  function phase() { const list = guide()?.phases || []; return list.find(item => item.id === phaseId) || list[0] || null; }
  function steps() { return phase()?.steps || []; }
  function resetPractice() { phaseId = ''; index = 0; started = false; paused = true; revealStep = true; }
  function details(id, label, cls = '') {
    const item = element('details', `rotation-details ${cls}`.trim());
    item.open = !!openDetails.get(id);
    item.append(element('summary', '', label));
    item.addEventListener('toggle', () => { openDetails.set(id, item.open); });
    return item;
  }
  function emitConfig(meta) {
    const keysOnly = meta.kind === 'keys';
    if (!keysOnly) { pending = true; resetPractice(); }
    render();
    try {
      if (typeof options.onConfigChange === 'function') options.onConfigChange(copyConfig(), meta);
      else { pending = false; render(); }
    } catch (error) {
      pending = false;
      data = {...data, guide: null, unavailableReason: text('方案暂未更新，请重选配置。', 'The plan did not update. Select the build again.')};
      render(); console.error(error);
    }
  }
  function changeCharacter(id, field, next) {
    const previous = config.characters[id]?.[field] || 0;
    config.characters[id] = {...{mindscape: 0, signature: 0, potential: 0}, ...config.characters[id], [field]: next};
    lastChange = {agentId: id, field, previous, value: next};
    emitConfig({kind: 'character', agentId: id, field, previous, value: next});
  }
  function selector(label, current, choices, onChange, control, disabled = false) {
    const wrap = element('label', 'rotation-field');
    wrap.append(element('span', '', label));
    const select = element('select'); select.dataset.rotationControl = control;
    for (const [key, title] of choices) { const item = element('option', '', title); item.value = String(key); select.append(item); }
    select.value = String(current); select.disabled = disabled;
    select.addEventListener('change', () => onChange(select.value));
    wrap.append(select); return wrap;
  }
  function portrait(member, size = 40) {
    if (!/^assets\/[\w/.-]+\.(?:webp|png|jpe?g)$/.test(member?.icon || '')) return null;
    const image = element('img'); image.src = member.icon; image.alt = ''; image.width = size; image.height = size;
    image.loading = 'lazy'; image.decoding = 'async'; return image;
  }
  function renderConfig() {
    const section = element('section', 'rotation-config');
    const head = element('div', 'rotation-section-head');
    const title = element('div'); title.append(element('h2', '', text('合轴与排轴', 'Team rotation planner')));
    title.append(element('p', 'rotation-muted', text('选好队友，按当前配置生成操作方案。', 'Choose your teammates to build a plan for their current configuration.')));
    head.append(title);
    if (data.gold && !pending) {
      const gold = element('div', 'rotation-gold');
      gold.append(Number.isFinite(data.gold.total) ? element('strong', '', `${data.gold.total} ${text('金', 'gold')}`) : element('strong', 'rotation-gold-unknown', text('限定计金待核对', 'Limited count unconfirmed')),
        element('span', '', data.gold.label || text('当前配置', 'Current build')));
      if (data.gold.breakdown?.length) gold.title = data.gold.breakdown.map(value).join('\n');
      head.append(gold);
    }
    section.append(head);
    const builds = element('div', 'rotation-builds');
    for (const [at, id] of team.entries()) {
      const member = agent(id), current = config.characters[id] || {mindscape: 0, signature: 0, potential: 0};
      const card = element('article', 'rotation-build');
      const header = element('div', 'rotation-build-heading'), image = portrait(member);
      if (image) header.append(image);
      const name = element('div'); name.append(element('small', '', `${['A', 'B', 'C'][at]} · ${text(`第 ${at + 1} 位`, `Slot ${at + 1}`)}`), element('h3', '', agentName(id)));
      if (member?.roleLabel) name.append(element('span', 'rotation-role-label', member.roleLabel));
      header.append(name); card.append(header);
      const fields = element('div', 'rotation-build-fields');
      fields.append(selector(text('影画', 'Mindscape'), current.mindscape, Array.from({length: 7}, (_, n) => [n, text(`${n} 影`, `M${n}`)]), n => changeCharacter(id, 'mindscape', Number(n)), `${id}-mindscape`));
      const signatureKnown = !!member?.signatureWeaponId;
      fields.append(selector(text('专属音擎', 'Signature engine'), signatureKnown ? current.signature : 0,
        signatureKnown ? [[0, text('无专武', 'None')], ...Array.from({length: 5}, (_, n) => [n + 1, text(`叠影 ${n + 1}`, `R${n + 1}`)])] : [[0, text('未指定专武', 'No signature recorded')]],
        n => changeCharacter(id, 'signature', Number(n)), `${id}-signature`, !signatureKnown));
      const potentialLevels=Array.isArray(member?.potentialLevels)?[...new Set(member.potentialLevels.filter(n=>Number.isInteger(n)&&n>=1&&n<=6))].sort((a,b)=>a-b):[];
      if(potentialLevels.length)fields.append(selector(text('潜能激发', 'Potential Awakening'), current.potential,
        [[0,text('未激发', 'Not awakened')],...potentialLevels.map(n=>[n,text(`${n} 阶`, `Rank ${n}`)])],
        n=>changeCharacter(id,'potential',Number(n)),`${id}-potential`));
      card.append(fields); builds.append(card);
    }
    section.append(builds);
    if (team.length === 3) {
      const settings = element('div', 'rotation-plan-settings');
      const automatic = data.guide?.recommendedFocusId ? text(`自动建议 · ${agentName(data.guide.recommendedFocusId)}`, `Suggested · ${agentName(data.guide.recommendedFocusId)}`) : text('自动建议', 'Suggested');
      settings.append(selector(text('主要输出', 'Main damage dealer'), config.focusAgentId, [['', automatic], ...team.map(id => [id, agentName(id)])], id => {
        config.focusAgentId = id; lastChange = null; emitConfig({kind: 'focus'});
      }, 'focus-agent'));
      settings.append(selector(text('编排偏好', 'Plan preference'), config.strategy,
        [['auto', text('按队伍建议', 'Team suggestion')], ['steady', text('稳妥循环', 'Steady rotation')], ['burst', text('集中爆发', 'Burst window')]], mode => {
          config.strategy = mode; lastChange = null; emitConfig({kind: 'strategy'});
        }, 'strategy'));
      section.append(settings);
    }
    const shortcuts = element('div', 'rotation-presets');
    const picker = doc.getElementById('team-picker');
    if (picker) shortcuts.append(button(text('更换队友', 'Choose teammates'), () => {
      const headerHeight = doc.querySelector('.site-header')?.getBoundingClientRect().height || 0;
      const top = Math.max(0, win.scrollY + picker.getBoundingClientRect().top - headerHeight - 16);
      win.scrollTo({top, behavior: win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    }, 'choose-team'));
    if (team.length && options.onPreset) shortcuts.append(button(text('重置配置', 'Reset build'), () => options.onPreset('baseline'), 'preset-baseline'));
    if (options.onUseExampleTeam && !(data.personalPresetLabel && options.onPreset)) shortcuts.append(button(text('查看示例队伍', 'Load example team'), () => options.onUseExampleTeam(), 'example-team'));
    if (shortcuts.childElementCount) section.append(shortcuts);
    if (lastChange || data.configNotes?.length) {
      const notes = details('config-notes', text('配置影响', 'Build effects'), 'rotation-config-notes');
      if (lastChange) notes.append(element('p', '', `${agentName(lastChange.agentId)} · ${lastChange.field === 'mindscape' ? text('影画', 'Mindscape') : lastChange.field === 'potential' ? text('潜能阶数', 'Potential rank') : text('专武叠影', 'Signature refinement')} ${lastChange.previous} → ${lastChange.value}`));
      for (const entry of pending ? [] : data.configNotes || []) {
        const line = element('p', '', typeof entry === 'object' && 'text' in entry ? entry.text : entry);
        if (entry?.reason) line.append(element('span', 'rotation-muted', ` ${value(entry.reason)}`));
        notes.append(line);
      }
      section.append(notes);
    }
    return section;
  }
  function renderUnavailable() {
    const section = element('div', 'rotation-unavailable');
if (data.loading || data.loadError) {
      section.setAttribute('role','status');
      section.append(element('p','',data.loadError
        ? text('排轴资料读取失败，可以重试。','Rotation data could not be loaded.')
        : text('正在读取这支队伍的排轴…','Loading this team’s rotation…')));
      if (data.loadError) section.append(button(text('重试','Retry'),options.onRetry,'retry'));
      return section;
    }

    section.append(element('h3', '', pending ? text('正在更新方案', 'Updating plan') : team.length < 3 ? text('先选择三名队友', 'Choose three teammates') : text('当前方案待补充', 'Plan needs more information')));
    section.append(element('p', '', pending ? text('配置更新后从第一段重新开始。', 'Start from the first phase after the build updates.') : data.unavailableReason || text('使用页面中的代理人选择器组队，方案会在这里显示。', 'Use the agent picker to form your team. Its plan will appear here.')));
    return section;
  }
  function moveStep(next) { index = Math.max(0, Math.min(steps().length - 1, next)); revealStep = true; render(); }
  function handoffKind(kind) {
    const names = {switch: ['普通切换', 'Switch'],normal: ['普通切换', 'Switch'],quick: ['快速支援', 'Quick Assist'],quickAssist: ['快速支援', 'Quick Assist'],'quick-prompt': ['快速支援提示', 'Quick Assist prompt'],assist: ['支援', 'Assist'],chain: ['连携', 'Chain Attack'],parry: ['招架支援', 'Defensive Assist'],'entry-prompt': ['支援／连携提示', 'Assist / Chain prompt'],'resource-entry': ['条件登场', 'Resource-gated entry']};
    return names[kind] ? text(...names[kind]) : value(kind);
  }
  function renderTimeline(activeSteps) {
    const section = element('section', 'rotation-timeline');
    const header = element('div', 'rotation-timeline-head');
    header.append(element('h4', '', text('三人合轴图', 'Three-agent action lanes')), element('span', 'rotation-muted', text('按事件排列 · 不代表秒数', 'Event order · not a time scale')));
    section.append(header);
    const legends = element('div', 'rotation-legend');
    legends.append(element('span', 'rotation-legend-front', text('前台操作', 'On-field input')), element('span', 'rotation-legend-persistent', text('后台持续效果', 'Persistent off-field effect')), element('span', 'rotation-legend-overlap', text('切人后续招', 'Attack continues after switch')));
    section.append(legends);
    const scroller = element('div', 'rotation-timeline-scroll'); scroller.tabIndex = 0;
    scroller.setAttribute('aria-label', text('可横向滚动的三人事件图', 'Horizontally scrollable three-agent event chart'));
    const table = element('table', 'rotation-timeline-table');
    const caption = element('caption', 'rotation-visually-hidden', text('列是操作事件，行是三名队友；仅显示知识库明确记录的后台动作。', 'Columns are action events, rows are teammates. Off-field actions appear only when explicitly provided by the knowledge base.'));
    table.append(caption);
    const thead = element('thead'), heading = element('tr');
    const corner = element('th', 'rotation-lane-heading', text('队友 / 事件', 'Agent / event')); corner.scope = 'col'; heading.append(corner);
    activeSteps.forEach((step, at) => {
      const cell = element('th'); cell.scope = 'col';
      const control = button(text(`第 ${at + 1} 步`, `Step ${at + 1}`), () => moveStep(at), `event-${at}`, 'rotation-event-button');
      control.setAttribute('aria-current', index === at ? 'step' : 'false'); cell.append(control); heading.append(cell);
    });
    thead.append(heading); table.append(thead);
    const tbody = element('tbody');
    for (const id of team) {
      const row = element('tr');
      const label = element('th', 'rotation-lane-heading'); label.scope = 'row';
      const identity = element('div', 'rotation-lane-agent'), image = portrait(agent(id), 28);
      if (image) identity.append(image);
      identity.append(element('span', '', `${slot(id)} · ${agentName(id)}`)); label.append(identity); row.append(label);
      activeSteps.forEach((step, at) => {
        const cell = element('td', index === at ? 'rotation-active-column' : '');
        const front = String(step.actorId) === id;
        if (front) {
          const action = button('', () => moveStep(at), `lane-${id}-${at}`, 'rotation-lane-action rotation-lane-front');
          action.append(element('small', '', text('前台', 'On field')), element('span', '', actionTitle(step)));
          action.title = value(step.title);
          action.setAttribute('aria-current', index === at ? 'step' : 'false'); cell.append(action);
        }
        const backgrounds = (step.background || []).filter(item => String(item.actorId) === id && ['persistent', 'overlap'].includes(item.kind));
        for (const [n, background] of backgrounds.entries()) {
          const action = button('', () => moveStep(at), `background-${id}-${at}-${n}`, `rotation-lane-action rotation-lane-${background.kind}`);
          action.append(element('small', '', background.kind === 'persistent' ? text('后台效果', 'Off-field effect') : text('脱手续招', 'Continuing attack')), element('span', '', plain(background.label, background.actorId)));
          action.title = value(background.label);
          cell.append(action);
        }
        if (!front && !backgrounds.length) cell.append(element('span', 'rotation-lane-empty', '—'));
        row.append(cell);
      });
      tbody.append(row);
    }
    const transfers = element('tr', 'rotation-transfer-row'), transferLabel = element('th', 'rotation-lane-heading', text('交棒', 'Handoff')); transferLabel.scope = 'row'; transfers.append(transferLabel);
    activeSteps.forEach(step => {
      const cell = element('td');
      if (step.handoff?.toId && team.includes(String(step.handoff.toId))) {
        cell.append(element('strong', '', `${slot(step.actorId)} → ${slot(step.handoff.toId)}`));
        if (step.handoff.kind) cell.append(element('small', '', handoffKind(step.handoff.kind)));
      } else if (step.handoff?.kind === 'quick-prompt' && !step.handoff.toId) {
        cell.append(element('span', 'rotation-transfer-prompt', text('按游戏提示', 'Follow the in-game prompt')));
      } else cell.append(element('span', 'rotation-lane-empty', '—'));
      transfers.append(cell);
    });
    tbody.append(transfers); table.append(tbody); scroller.append(table); section.append(scroller);
    return section;
  }
  function instruction(label, content, cls = '') {
    const row = element('div', `rotation-instruction ${cls}`.trim());
    row.append(element('dt', '', label), element('dd', '', content || text('按实际状态确认', 'Check the actual state'))); return row;
  }
  function renderCurrent(activePhase, activeSteps) {
    const step = activeSteps[index], block = element('section', 'rotation-practice');
    if (chosenStep!==step) { chosenStep=step; chosenRef=''; }
    const routes=step.basicRoutes || [];
    const route=routes.find(r=>r.skillRef===chosenRef) || routes[0];
    const card = element('article', 'rotation-current'); card.setAttribute('aria-live', 'polite');
    const meta = element('div', 'rotation-step-meta'); meta.append(element('span', '', `${value(activePhase.label)} · ${text(`第 ${index + 1}/${activeSteps.length} 步`, `Step ${index + 1}/${activeSteps.length}`)}`), element('span', '', agentName(step.actorId)));
    card.append(meta, element('h4', '', actionTitle(step)));
    const incoming=activeSteps[index-1]?.handoff;
    if (String(incoming?.toId)===String(step.actorId) && ['quick','quickAssist','chain','resource-entry','entry-prompt','parry'].includes(incoming?.kind)) {
      card.append(element('p','rotation-next-hint',text('承接上一步：若'+agentName(step.actorId)+'已登场，不必重复切入，接着做本步剩余动作。','Continue the previous handoff: if '+agentName(step.actorId)+' has already entered, skip the entry input and continue this step.')));
    }
    if (routes.length>1) card.append(selector(text('本步招式（按当前条件选一招）','Move for this step (choose one you can use)'),route.skillRef,
      routes.map(r=>[r.skillRef,value(r.label)]),ref=>{chosenRef=ref;render();},'basic-route'));
    const action = element('div', 'rotation-action'), key = config.keyBindings[step.actionId];
    if (key && !route) action.append(element('kbd', '', key));
    if (key && route) {
      const note=element('p','rotation-next-hint',text('本步的自定义键位备注 ','Your key note for this step '));
      note.append(element('kbd','',key)); card.append(note);
    }
    const actionText=value(route?.input || plain(step.input || step.title,step.actorId));
    const cue=value(route?.basicCue || step.basicCue);
    const duplicated=cue && (cue===actionText || cue===value(step.input) && !route);
    const actionBody=element('strong');
    actionText.split('\n').forEach((line,i)=>{if(i)actionBody.append(element('br'));actionBody.append(doc.createTextNode(line));});
    action.append(actionBody);
    if(duplicated) {action.classList.add('rotation-basic-cue');action.prepend(element('span','rotation-muted',text('普攻按法','Basic input')));}
    card.append(action);
    if(!duplicated){
      const basic=element('dl','rotation-instructions rotation-basic-cue');
      basic.append(instruction(text('普攻按法','Basic input'),cue || text('本步不需要另按普攻。','No separate Basic input for this step.')));
      card.append(basic);
    }
    const displayedSteps=route ? activeSteps.map((s,i)=>i===index?{...s,input:route.input}:s) : activeSteps;
    const resourceHints = !isEnglish() && plainTerms?.firstResources(displayedSteps, index);
    if (resourceHints?.length) {
      const hints = element('div', 'rotation-resource-hints');
      for (const hint of resourceHints) hints.append(element('p','rotation-next-hint',hint.original+'：'+hint.short+'。'));
      card.append(hints);
    }
    const visibleBranches=(step.actionBranches || []).filter(branch=>!route || branch.skillRef===route.skillRef || !routes.some(other=>other.skillRef===branch.skillRef));
    if(visibleBranches.length){
      const branches=element('div','rotation-action-branches');
      branches.append(element('p','rotation-next-hint',text('技能与状态 · 展开查看条件','Skills and states · expand to check conditions')));
      for(const branch of visibleBranches){
        const label=(branch.context?text('状态／自动效果 · ','State / automatic effect · '):'')+value(plain(branch.title, step.actorId));
        const item=details(`branch-${step.id}-${branch.skillRef}`,label,'rotation-why');
        const command=branch.command && (isEnglish()?branch.command.en:branch.command.zh);
        if (command && branch.skillRef!==route?.skillRef) item.append(element('strong','rotation-branch-command',command));
        item.append(element('p','',branch.description));branches.append(item);
      }
      card.append(branches);
    }
    const info = element('dl', 'rotation-instructions');
    const trigger=value(plain(step.trigger, step.actorId)), input=actionText;
    if (trigger && trigger!==input && trigger.replace(/^(?:确认当前满足招式前提；|Confirm its current prerequisites\. )/,'')!==input)
      info.append(instruction(text('开始条件', 'Start when'), trigger));
    if (step.handoff?.signal || step.handoff?.input) {
      const signal=value(plain(step.handoff.signal,step.actorId)), key=value(plain(step.handoff.input,step.actorId));
      const cue=instruction(text('什么时候切人', 'When to switch'),signal||key,'rotation-handoff-cue');
      if (signal && key && signal!==key) cue.querySelector('dd').append(element('br'),element('strong','rotation-handoff-input',key));
      info.append(cue);
    } else if (!step.handoff && activeSteps[index+1]?.actorId===step.actorId) {
      info.append(instruction(text('切人', 'Switch'), text('不切人，继续用'+agentName(step.actorId)+'。','Stay on '+agentName(step.actorId)+'.')));
    }
    if (step.complete) info.append(instruction(text('完成标志', 'Finish when'), plain(step.complete, step.actorId)));
    if (step.warning) info.append(instruction(text('注意', 'Watch out'), plain(step.warning, step.actorId), 'rotation-step-warning'));
    if (step.fallback) info.append(instruction(text('没接上怎么办', 'If the setup fails'), plain(step.fallback, step.actorId), 'rotation-recovery'));
    card.append(info);
    const skills = plainTerms?.originalsFor(step) || [];
    // Movement and recovery can be instructions rather than a named skill.
    // Only offer this disclosure if we can actually identify something in it.
    const shownSkills=route ? [{skillRef:route.skillRef,role:'primary',name:route.label.zh,nameEn:route.label.en}] : skills;
    if (shownSkills.length) {
      const originals = details(`original-${step.id}`, text('技能原名与说明', 'Original skill names'), 'rotation-original-details');
      const source = element('dl', 'rotation-instructions');
      for (const skill of shownSkills) {
        const label = {primary:text('本步技能','Referenced skill'), choice:text('可选分支','Option'),
          first:text('第①招','1st'),second:text('第②招','2nd'),third:text('第③招','3rd'),
          firstThird:text('第①、③组','Groups 1 and 3'),secondFourth:text('第②、④组','Groups 2 and 4'),
          lead:text('起手','Opener'),optionalLead:text('可选起手','Optional opener'),variant:text('条件变化时的形态','Conditional form'),
          optional:text('可选操作','Optional input'),conditional:text('条件满足再接','Conditional follow-up'),auto:text('自动衔接，不用另按','Automatic; no extra input'),
          followup:text('后续招式','Follow-up'), context:text('状态／自动效果','State / automatic effect')}[skill.role];
        source.append(instruction(label, isEnglish()?skill.nameEn:skill.name));
      }
      originals.append(source); if(step.skillOriginalNote) originals.append(element('p','rotation-next-hint',step.skillOriginalNote)); card.append(originals);
    }
    if (step.reason) { const why = details(`why-${step.id}`, text('为什么这样安排', 'Why this order'), 'rotation-why'); why.append(element('p', '', step.reason)); card.append(why); }
    card.append(element('p', 'rotation-next-hint', activeSteps[index + 1] ? `${text('下一步：', 'Next: ')}${agentName(activeSteps[index + 1].actorId)} · ${value(actionTitle(activeSteps[index + 1]))}` : plain(activePhase.repeat) || text('本段结束；按实际状态选下一段。', 'Phase complete. Choose the next phase based on the actual state.')));
    block.append(card);
    const controls = element('div', 'rotation-controls');
    const previous = button(text('上一步', 'Previous'), () => moveStep(index - 1), 'previous'); previous.disabled = index === 0;
    const next = button(index === activeSteps.length - 1 ? text('本段结束', 'Phase complete') : text('下一步', 'Next'), () => moveStep(index + 1), 'next', 'rotation-button-primary'); next.disabled = index === activeSteps.length - 1;
    const toggle = button(!started ? text('开始跟练', 'Start practice') : paused ? text('继续', 'Resume') : text('暂停', 'Pause'), () => { started = true; paused = !paused; render(); }, 'practice-toggle');
    const restart = button(text('重练本段', 'Restart phase'), () => { index = 0; started = true; paused = false; revealStep = true; render(); }, 'restart');
    const status = element('span', 'rotation-practice-state', !started ? text('按游戏状态手动推进', 'Advance manually by game state') : paused ? text('已暂停，当前步骤保留', 'Paused; current step preserved') : text('跟练中 · 手动点下一步', 'Practicing · advance manually'));
    status.setAttribute('role', 'status'); controls.append(previous, next, toggle, restart, status); block.append(controls);
    return block;
  }
  function renderKeys(activeGuide) {
    const allSteps = activeGuide.phases.flatMap(item => item.steps || []), used = [...new Set(allSteps.map(item => item.actionId).filter(Boolean))];
    if (!used.length) return null;
    const section = details('keys', text('我的键位备注', 'My key labels'), 'rotation-key-settings');
    section.append(element('p', 'rotation-muted', text('只用于提示，不会控制游戏。', 'Display labels only; this does not control the game.')));
    const fields = element('div', 'rotation-key-fields');
    for (const id of used) {
      const label = data.actions?.find(item => item.id === id)?.label || allSteps.find(item => item.actionId === id)?.input || id;
      const owner = allSteps.find(item => item.actionId === id)?.actorId;
      const wrap = element('label', 'rotation-field'); wrap.append(element('span', '', `${owner ? agentName(owner) + ' · ' : ''}${value(plain(label, owner))}`));
      wrap.title = value(label);
      const input = element('input'); input.type = 'text'; input.maxLength = 32; input.value = config.keyBindings[id] || '';
      input.placeholder = text('例如 E / 鼠标侧键', 'e.g. E / mouse side button'); input.dataset.rotationControl = `key-${id}`;
      input.addEventListener('change', () => { config.keyBindings[id] = input.value.slice(0, 32); emitConfig({kind: 'keys', actionId: id}); });
      wrap.append(input); fields.append(wrap);
    }
    section.append(fields); return section;
  }
  function renderSources(activeGuide) {
    const section = details('sources', text('知识库与教学依据', 'Knowledge and teaching sources'), 'rotation-sources');
    if (activeGuide.coverage?.description) section.append(element('p', '', activeGuide.coverage.description));
    for (const lesson of activeGuide.lessons || []) {
      const item = element('article', 'rotation-lesson'); item.append(element('h4', '', lesson.title), element('p', '', lesson.body)); section.append(item);
    }
    for (const source of activeGuide.sources || []) {
      let url; try { url = new URL(source.url); } catch { continue; }
      if (!['http:', 'https:'].includes(url.protocol)) continue;
      const link = element('a', '', source.label || source.url); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; section.append(link);
    }
    return section;
  }
  function renderPositionPlan(plan) {
    if (!plan?.summary) return null;
    const section = element('section', 'rotation-position-plan');
    section.dataset.positionKind = plan.kind || '';
    section.append(element('h4', '', plan.label || text('当前站位', 'Current order')), element('p', '', plain(plan.summary)));
    if (plan.notes?.length) {
      const more = details('position-notes', text('站位说明', 'Order details'), 'rotation-position-detail');
      const list = element('ul');
      for (const note of plan.notes) list.append(element('li', '', plain(note)));
      more.append(list); section.append(more);
    }
    return section;
  }
  function renderGuide(activeGuide) {
    const section = element('section', 'rotation-workflow');
    const header = element('div', 'rotation-guide-heading');
    header.append(element('h3', '', activeGuide.title));
    if (activeGuide.coverage?.label) header.append(element('span', 'rotation-coverage', activeGuide.coverage.label));
    section.append(header);
    if (activeGuide.validationText) section.append(element('p', 'rotation-muted', activeGuide.validationText));
    section.append(element('p','rotation-next-hint',text('“第几段”看角色当前打出的动作。例如“直接接第3段”不需要先点两下普攻。','Hit numbers refer to the animation. A shortcut to hit 3 skips hits 1 and 2; do not add two Basic taps.')));
    if (activeGuide.recommendation) section.append(element('p', 'rotation-recommendation', plain(activeGuide.recommendation)));
    const positionPlan = renderPositionPlan(activeGuide.positionPlan); if (positionPlan) section.append(positionPlan);
    if (activeGuide.conditions?.length) {
      const conditions = details('conditions', text('开打前确认', 'Before you start'), 'rotation-conditions');
      const list = element('ul'); for (const condition of activeGuide.conditions) list.append(element('li', '', plain(condition))); conditions.append(list); section.append(conditions);
    }
    const phases = element('nav', 'rotation-phases'); phases.setAttribute('aria-label', text('选择操作段', 'Choose a phase'));
    const activePhase = phase();
    for (const [at, item] of activeGuide.phases.entries()) {
      const control = button('', () => { phaseId = item.id; index = 0; started = false; paused = true; revealStep = true; render(); }, `phase-${item.id}`, 'rotation-phase');
      control.setAttribute('aria-current', activePhase?.id === item.id ? 'step' : 'false');
      control.append(element('span', 'rotation-phase-number', String(at + 1)), element('span', '', item.label)); phases.append(control);
    }
    section.append(phases);
    if (!activePhase?.steps?.length) { section.append(renderUnavailable()); return section; }
    const activeSteps = activePhase.steps; phaseId = activePhase.id; index = Math.max(0, Math.min(activeSteps.length - 1, index));
    if (activePhase.objective) section.append(element('p', 'rotation-objective', plain(activePhase.objective)));
    if (activePhase.prep?.length) {
      const prep = details(`prep-${activePhase.id}`, text('这一段要准备什么', 'Prepare for this phase'), 'rotation-phase-prep');
      const list = element('ul'); for (const entry of activePhase.prep) list.append(element('li', '', plain(entry))); prep.append(list); section.append(prep);
    }
    section.append(renderTimeline(activeSteps), renderCurrent(activePhase, activeSteps));
    const keys = renderKeys(activeGuide); if (keys) section.append(keys);
    section.append(renderSources(activeGuide)); return section;
  }
  function render() {
    if (destroyed) return;
    const nextPlainSignature = JSON.stringify([team, team.map(id => config.characters[id]?.potential || 0)]);
    if (plainSignature !== nextPlainSignature) {
      plainTerms = bundle?.runtime.createRotationPlainTerms(bundle.knowledge, config, team) || null;
      plainSignature = nextPlainSignature;
    }
    const active = root.contains(doc.activeElement) ? doc.activeElement : null;
    const focus = active?.dataset.rotationControl;
    const selection = active?.tagName === 'INPUT' ? [active.selectionStart, active.selectionEnd] : null;
    const scrollLeft = root.querySelector('.rotation-timeline-scroll')?.scrollLeft || 0;
    root.replaceChildren(renderConfig(), guide() ? renderGuide(guide()) : renderUnavailable());
    const scroll = root.querySelector('.rotation-timeline-scroll');
    if (scroll) {
      scroll.scrollLeft = scrollLeft;
      if (revealStep) {
        const current = root.querySelector('.rotation-event-button[aria-current="step"]')?.closest('th');
        const first = root.querySelector('.rotation-timeline-table thead .rotation-lane-heading');
        if (current && first) {
          const bounds = scroll.getBoundingClientRect(), selected = current.getBoundingClientRect();
          const start = bounds.left + first.getBoundingClientRect().width + 5, end = bounds.right - 5;
          if (selected.right > end) scroll.scrollLeft += selected.right - end;
          else if (selected.left < start) scroll.scrollLeft -= start - selected.left;
        }
      }
    }
    revealStep = false;
    if (focus) {
      const next = [...root.querySelectorAll('[data-rotation-control]')].find(item => item.dataset.rotationControl === focus);
      if (next) { next.focus({preventScroll: true}); if (selection && next.tagName === 'INPUT') next.setSelectionRange(...selection); }
    }
  }
  function update(next = {}) {
    if (destroyed) return;
    const wasPending=pending;
    if ('bundle' in next && next.bundle !== bundle) { bundle=next.bundle; plainSignature=''; }
    if ('team' in next) team = teamIds(next.team);
    if ('data' in next) { data = next.data || {}; pending = false; }
    if ('config' in next) config = normalize(next.config);
    const selected = Object.fromEntries(team.map(id => [id, config.characters[id]]));
    const signature = JSON.stringify([team, selected, config.focusAgentId, config.strategy, data.guide?.id, data.guide?.phases?.map(item => [item.id, item.steps?.map(step => step.id)])]);
    if (lastSignature && signature !== lastSignature) {
      resetPractice();
      if(!(wasPending&&lastChange&&team.includes(lastChange.agentId)&&config.characters[lastChange.agentId]?.[lastChange.field]===lastChange.value))lastChange=null;
    }
    lastSignature = signature; render();
  }
  function visibilityChanged() { if (doc.hidden && started && !paused) { paused = true; render(); } }
  doc.addEventListener('visibilitychange', visibilityChanged); win.addEventListener('dukelanguagechange', render);
  update({});
  return {update, getConfig: copyConfig, destroy() { destroyed = true; doc.removeEventListener('visibilitychange', visibilityChanged); win.removeEventListener('dukelanguagechange', render); root.remove(); }};
}

// Learning configuration only: no account response, UID or combat telemetry.

const ROTATION_STORAGE='duke-team-rotation-v2';
let rotationView=null,rotationConfig=loadRotationConfiguration();
function loadRotationConfiguration(){
  const baseline=rotationPreset('baseline',ROTATION_DIRECTORY);
  for(const key of [ROTATION_STORAGE,'duke-team-rotation-v1']){
    try{const text=localStorage.getItem(key);if(!text||text.length>24000)continue;const parsed=JSON.parse(text);
      const checked=rotationConfiguration({...parsed,characters:{...baseline.characters,...parsed.characters}},ROTATION_DIRECTORY);
      if(checked)return checked;
    }catch{}
  }
  return baseline;
}
function saveRotationConfiguration(){try{localStorage.setItem(ROTATION_STORAGE,JSON.stringify(rotationConfig));}catch{}}
function readRotationHash(){
  const parameters=new URLSearchParams(location.hash.slice(1)),encoded=parameters.get('rotation');
  const selected=team.filter(Boolean);
  if(encoded&&/^[0-6]\.[0-5](,[0-6]\.[0-5]){0,2}$/.test(encoded)){
    const parts=encoded.split(',');
    if(parts.length===selected.length){const characters={...rotationConfig.characters};parts.forEach((part,index)=>{const [mindscape,signature]=part.split('.').map(Number);characters[selected[index]]={mindscape,signature,potential:0};});rotationConfig={...rotationConfig,characters};}
  }
  // Shared links are self-contained: old team/rotation links never inherit a
  // recipient's locally saved awakening. An ordinary reload without a share
  // hash preserves their saved configuration.
  if(parameters.has('potential')||parameters.has('rotation')||parameters.has('team')){
    const encodedPotential=parameters.get('potential');
    const parts=encodedPotential&&/^[0-6](,[0-6]){0,2}$/.test(encodedPotential)?encodedPotential.split(',').map(Number):[];
    const characters={...rotationConfig.characters};
    selected.forEach((id,index)=>{characters[id]={...rotationBuild(rotationConfig,id),potential:parts.length===selected.length?parts[index]:0};});
    const checked=rotationConfiguration({...rotationConfig,characters},ROTATION_DIRECTORY);
    if(checked)rotationConfig=checked;
  }
  const focus=parameters.get('focus'),pace=parameters.get('pace');
  if(parameters.has('focus'))rotationConfig.focusAgentId=team.includes(focus)?focus:'';
  if(parameters.has('pace')&&['auto','steady','burst'].includes(pace))rotationConfig.strategy=pace;
  if(!team.includes(rotationConfig.focusAgentId))rotationConfig.focusAgentId='';
  saveRotationConfiguration();
}
function rotationHashSuffix(){
  const selected=team.filter(Boolean);if(!selected.length)return '';
  return '&rotation='+selected.map(id=>{const c=rotationBuild(rotationConfig,id);return `${c.mindscape}.${c.signature}`;}).join(',')+'&potential='+selected.map(id=>rotationBuild(rotationConfig,id).potential).join(',')+'&focus='+encodeURIComponent(selected.includes(rotationConfig.focusAgentId)?rotationConfig.focusAgentId:'')+'&pace='+rotationConfig.strategy;
}
// A resource may be shared by many teams. Evict only failed reads so Retry can
// reuse every successful part, including requests still in flight.
const rotationResources = new Map();
const failedReads = new Map();
function rotationResource(name) {
  if (rotationResources.has(name)) return rotationResources.get(name);
  const version = ROTATION_FILES[name];
  if (!version) throw new Error('Unknown rotation resource: ' + name);
  const url = new URL('./assets/rotation/' + name, import.meta.url);
  const retry = failedReads.get(name) || 0;
  url.searchParams.set('v', version + (retry ? '-retry-' + retry : ''));
  const isModule = name.endsWith('.js');
  const read = isModule ? import(url.href) : fetch(url).then(async response => {
    if (!response.ok) throw new Error('Rotation resource ' + name + ': ' + response.status);
    const raw = await response.arrayBuffer();
    if (globalThis.crypto?.subtle) {
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256',raw));
      const hash = [...digest.slice(0,8)].map(n=>n.toString(16).padStart(2,'0')).join('');
      if (hash !== version) throw new Error('Rotation data revision mismatch: ' + name);
    }
    return JSON.parse(new TextDecoder().decode(raw));
  });
  const pending = read.catch(error => {
    rotationResources.delete(name);
    failedReads.set(name, retry + 1);
    throw error;
  });
  rotationResources.set(name, pending);
  return pending;
}
function expandPotential(bundle) {
  const revive = value => {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(revive);
    if (Object.hasOwn(value, '$field')) return bundle.fields[value.$field];
    return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,revive(v)]));
  };
  return revive(bundle.ranks);
}
async function fetchRotationTeam(ids, config) {
  const sorted = [...ids].sort().join('-');
  const lessonName = 'lesson-' + sorted + '.json';
  const hasLesson = Object.hasOwn(ROTATION_FILES, lessonName);
  const expert = ROTATION_EXAMPLE_IDS.every(id => ids.includes(id));
  const potentials = ids.filter(id => config.characters[id]?.potential > 0);
  const [runtime, agents, awakened, lesson, rules] = await Promise.all([
    rotationResource('runtime.js'),
    Promise.all(ids.map(id => rotationResource('agent-' + id + '.json'))),
    Promise.all(potentials.map(id => rotationResource('potential-' + id + '.json'))),
    hasLesson ? rotationResource(lessonName) : null,
    hasLesson ? rotationResource(expert ? 'expert.js' : 'specialist.js') : null,
  ]);
  const knowledge = {
    agents: {...ROTATION_DIRECTORY.agents}, potentialProfiles: {}, expertRules: {}, gold: {agents:{}},
    dedicatedGuides: [], foundationChoices:{}, foundationSequences:{}, version:ROTATION_DIRECTORY.version
  };
  for (const a of agents) {
    const id = a.profile.id;
    knowledge.agents[id] = a.profile;
    knowledge.gold.agents[id] = a.gold;
    knowledge.foundationChoices[id] = a.choices;
    if (a.sequence) knowledge.foundationSequences[id] = a.sequence;
    for (const [name, values] of Object.entries(a.tables))
      Object.assign(knowledge[name] ||= {}, values);
  }
  potentials.forEach((id,i) => { knowledge.potentialProfiles[id]=expandPotential(awakened[i]); });
  let specialist;
  if (expert) knowledge.expertRules = lesson.expertRules;
  else {
    knowledge.expertRules.selected = {mechanicsActions:agents.flatMap(a=>a.expertMoves || [])};
    if (lesson) {
      knowledge.dedicatedGuides = [lesson.guide];
      specialist = rules.specialist(runtime, lesson.instructions);
    }
  }
  return {runtime, knowledge, expert:expert ? rules.expert(runtime) : null, specialist};
}
let activeBundle = null;
let activeKey = '';
let loadSequence = 0;
let loadError = false;
function renderRotationGuide() {
  const container = $('team-rotation');
  if (!container) return;
  if (!team.includes(rotationConfig.focusAgentId)) rotationConfig.focusAgentId = '';
  const ids = team.filter(Boolean);
  const key = ids.length === 3 ? [...ids].sort().map(id =>
    id + (rotationConfig.characters[id]?.potential > 0 ? '+' : '')).join('-') : '';
  if (activeKey !== key) {
    activeKey = key;
    activeBundle = null;
    loadError = false;
    const seq = ++loadSequence;
    if (key) fetchRotationTeam(ids, rotationConfig).then(bundle => {
      if (seq !== loadSequence) return;
      activeBundle = bundle;
      renderRotationGuide();
    }).catch(error => {
      if (seq !== loadSequence) return;
      console.error('Rotation data unavailable', error);
      activeBundle = null;
      loadError = true;
      renderRotationGuide();
    });
  }
  const agents = ids.map(id => ROTATION_DIRECTORY.agents[id]).filter(Boolean);
  const viewData = activeBundle
    ? activeBundle.runtime.compileRotationGuide(team, rotationConfig, activeBundle.knowledge,
        evaluateTeam(members()), activeBundle.expert, activeBundle.specialist)
    : {agents, loading: Boolean(key && !loadError), loadError, unavailableReason:{
        zh:'从下方选择三名正式代理人，自动生成开局、循环和爆发方案。',
        en:'Choose three released agents below to generate opening, loop and burst plans.'}};
  const model = {team, data:viewData, config:rotationConfig, bundle:activeBundle};
  if (rotationView) { rotationView.update(model); return; }
  rotationView = mountRotationGuide(container, {...model,
    onRetry() { activeKey=''; renderRotationGuide(); },
    onConfigChange(next) {
      const checked=rotationConfiguration(next,ROTATION_DIRECTORY);
      if (checked) {rotationConfig=checked; saveRotationConfiguration(); saveTeam();}
      renderRotationGuide();
    },
    onPreset(kind) {
      const next=rotationPreset(kind,ROTATION_DIRECTORY);
      if(kind==='personal') team=[...ROTATION_EXAMPLE_IDS];
      rotationConfig={...rotationConfig,focusAgentId:'',strategy:'auto',characters:{
        ...rotationConfig.characters,...Object.fromEntries(team.filter(Boolean).map(id=>[id,next.characters[id]]))}};
      saveRotationConfiguration();saveTeam();render();
    }
  });
}

main();

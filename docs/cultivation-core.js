// Cultivation cost totals from cultivation-data.json. Pure functions; no DOM or storage.
export const BREAKPOINTS = [10, 20, 30, 40, 50];
export const MAX_LEVEL = 60, MAX_SKILL = 12, MAX_CORE = 6;
const DENNY = '10';

const clamp = (value, min, max) => Math.min(max, Math.max(min, Math.round(Number(value) || 0)));
const add = (totals, cost, times = 1) => { for (const [id, n] of cost) totals.set(String(id), (totals.get(String(id)) || 0) + n * times); };

// Highest skill level the agent level allows, read from the skill table's level requirements.
export function skillCap(agent, level) {
  let cap = 1;
  for (const row of agent.skills) if (row.agentLevel <= level) cap = Math.max(cap, row.from + 1);
  return cap;
}
export function coreCap(agent, level) {
  return agent.core.reduce((cap, row) => row.agentLevel <= level ? Math.max(cap, row.to) : cap, 0);
}

export function defaultPlan(agent) {
  return {
    agent: agent.id,
    level: {from: 1, promoted: false, to: MAX_LEVEL},
    skills: Array.from({length: 5}, () => [1, MAX_SKILL]),
    core: [0, MAX_CORE],
    weapon: agent.weapon ? {id: agent.weapon, from: 0, promoted: false, to: MAX_LEVEL} : null,
  };
}

// Repair stored or hand-edited plans instead of trusting them.
export function normalizePlan(plan, data) {
  const agent = data.agents[plan?.agent];
  if (!agent) return null;
  const base = defaultPlan(agent);
  const level = plan.level || base.level;
  const from = clamp(level.from, 1, MAX_LEVEL), to = clamp(level.to, from, MAX_LEVEL);
  const skills = base.skills.map((pair, i) => {
    const [a, b] = Array.isArray(plan.skills?.[i]) ? plan.skills[i] : pair;
    const start = clamp(a, 1, MAX_SKILL);
    return [start, clamp(b, start, MAX_SKILL)];
  });
  const coreFrom = clamp(plan.core?.[0], 0, MAX_CORE);
  let weapon = null;
  if (plan.weapon && data.weapons[plan.weapon.id]) {
    const wf = clamp(plan.weapon.from, 0, MAX_LEVEL);
    weapon = {id: String(plan.weapon.id), from: wf, promoted: !!plan.weapon.promoted && BREAKPOINTS.includes(wf), to: clamp(plan.weapon.to, wf, MAX_LEVEL)};
  } else if (plan.weapon === undefined && base.weapon && data.weapons[base.weapon.id]) weapon = base.weapon;
  return {
    agent: agent.id, collapsed: !!plan.collapsed,
    level: {from, promoted: !!level.promoted && BREAKPOINTS.includes(from), to},
    skills, core: [coreFrom, clamp(plan.core?.[1] ?? MAX_CORE, coreFrom, MAX_CORE)], weapon,
  };
}

function levelRange(from, promoted, to, expTable, totals, promotion) {
  let exp = from < to && expTable == null ? null : 0;
  for (let level = from; level < to && exp !== null; level++) exp += expTable[level] || 0;
  for (const point of BREAKPOINTS) {
    if (point < from || point >= to || (point === from && promoted)) continue;
    add(totals, promotion[String(point)] || []);
  }
  return exp;
}

export function planCost(plan, data) {
  const agent = data.agents[plan.agent], items = new Map(), warnings = [];
  // agentExp[i] is the EXP from level i+1 to i+2; shift so index == current level.
  const agentExpSource = agent.expTable === undefined ? data.agentExp : agent.expTable;
  const agentExp = agentExpSource == null ? null : [0, ...agentExpSource];
  const exp = levelRange(plan.level.from, plan.level.promoted, plan.level.to, agentExp, items, agent.promotion);
  const skillLimit = skillCap(agent, plan.level.to);
  plan.skills.forEach(([from, to], index) => {
    for (const row of agent.skills) if (row.from >= from && row.from < to) add(items, row.cost);
    if (to > skillLimit) warnings.push({type: 'skill', index, need: agent.skills.find(row => row.from === to - 1)?.agentLevel});
  });
  const [coreFrom, coreTo] = plan.core;
  for (const row of agent.core) if (row.to > coreFrom && row.to <= coreTo) add(items, row.cost);
  if (coreTo > coreCap(agent, plan.level.to)) warnings.push({type: 'core', need: agent.core.find(row => row.to === coreTo)?.agentLevel});
  let weaponExp = 0, weaponRarity = null;
  if (plan.weapon) {
    const weapon = data.weapons[plan.weapon.id];
    weaponRarity = weapon.rarity;
    const weaponExpSource = weapon.expTable === undefined ? data.weaponExp?.[String(weapon.rarity)] : weapon.expTable;
    weaponExp = levelRange(plan.weapon.from, plan.weapon.promoted, plan.weapon.to, weaponExpSource, items, weapon.promotion);
  }
  return {items, agentExp: exp, weaponExp, weaponRarity, warnings};
}

// Sum of several plans; EXP stays as raw points so mixed inventory can be subtracted exactly.
export function totalCost(plans, data) {
  const items = new Map();
  let agentExp = 0, weaponExp = 0;
  const perPlan = plans.map(plan => {
    const cost = planCost(plan, data);
    for (const [id, n] of cost.items) items.set(id, (items.get(id) || 0) + n);
    agentExp = agentExp === null || cost.agentExp === null ? null : agentExp + cost.agentExp;
    weaponExp = weaponExp === null || cost.weaponExp === null ? null : weaponExp + cost.weaponExp;
    return cost;
  });
  return {items, agentExp, weaponExp, perPlan};
}

export const isDenny = id => id === DENNY;

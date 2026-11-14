// Additional Ability (额外能力) checks. Pure functions; the agent itself never satisfies its own condition.
const shared = (a, b) => a.some(value => b.includes(value));

// Why one teammate satisfies an agent's rule: 'element' | 'faction' | 'specialty' | 'parry'.
// `unknown` is set when only an unverified beta teammate might satisfy a parry-assist condition.
// Display squads may share one combat faction. Legacy records keep label fallback.
export function sameFaction(agent, mate) {
  const id = value => /^[1-9]\d*$/.test(String(value ?? '')) ? String(value) : null;
  const a = id(agent?.factionId), b = id(mate?.factionId);
  if (a && b) return a === b;
  if (typeof agent?.faction !== 'string' || !agent.faction.trim() || typeof mate?.faction !== 'string' || !mate.faction.trim()) return null;
  return agent.faction === mate.faction;
}

export function matchReasons(agent, mate) {
  const rule = agent.ability.rule, reasons = [];
  if (rule.sameElement && shared(agent.elements, mate.elements)) reasons.push('element');
  if (rule.sameFaction && sameFaction(agent, mate)) reasons.push('faction');
  if (rule.specialties.includes(mate.specialty)) reasons.push('specialty');
  if (rule.parryAssist && mate.parryAssist === true) reasons.push('parry');
  return {reasons, unknown: !reasons.length && rule.parryAssist && mate.parryAssist == null};
}

export function evaluateAgent(agent, team) {
  const by = [];
  let unknown = false;
  for (const mate of team) {
    if (!mate || mate.id === agent.id) continue;
    const match = matchReasons(agent, mate);
    if (match.reasons.length) by.push({agent: mate, reasons: match.reasons});
    unknown ||= match.unknown;
  }
  return {agent, status: by.length ? 'active' : unknown ? 'unknown' : 'inactive', by};
}

export function evaluateTeam(team) {
  const members = team.filter(Boolean);
  return members.map(agent => evaluateAgent(agent, members));
}

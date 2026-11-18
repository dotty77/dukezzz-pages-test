/** Per-page choices only. No account data, browser storage, or network access. */
export const SUBSTAT_OPTIONS = Object.freeze([
  [20103, '暴击率'], [21103, '暴击伤害'], [12102, '攻击力%'], [12103, '攻击力（固定值）'],
  [31203, '异常精通'], [11102, '生命值%'], [11103, '生命值（固定值）'],
  [13102, '防御力%'], [13103, '防御力（固定值）'], [23203, '穿透值'],
].map(([id, name]) => Object.freeze({id, name})));
const allowed = new Set(SUBSTAT_OPTIONS.map(option => option.id));
export const MAX_CORE_ATTRIBUTES = 4;
const fixedAttributes = new Set([11103, 12103, 13103]);
export const CORE_OPTIONS = Object.freeze(SUBSTAT_OPTIONS.filter(option => !fixedAttributes.has(option.id)));
const coreAllowed = new Set(CORE_OPTIONS.map(option => option.id));
export const substatName = id => SUBSTAT_OPTIONS.find(option => option.id === Number(id))?.name || '未知属性';
const ids = list => [...new Set((Array.isArray(list) ? list : []).map(Number).filter(id => allowed.has(id)))];

export function referenceSelection(build) {
  const relevant = id => build?.role !== '命破' || id !== 23203;
  const sourcePrimary = ids(build?.effectiveSubstats?.primaryIds).filter(relevant);
  const primaryIds = sourcePrimary.filter(id => coreAllowed.has(id)).slice(0, MAX_CORE_ATTRIBUTES);
  const secondaryIds = ids([...(build?.effectiveSubstats?.secondaryIds || []), ...sourcePrimary.filter(id => fixedAttributes.has(id))]).filter(id => relevant(id) && !primaryIds.includes(id));
  return {primaryIds, secondaryIds};
}

export function setSelection(selection, propertyId, category, checked) {
  const id = Number(propertyId);
  const current = referenceSelection({effectiveSubstats: selection});
  if (!allowed.has(id) || !['primary', 'supplement'].includes(category)) return current;
  if (category === 'primary' && (!coreAllowed.has(id) || (checked && !current.primaryIds.includes(id) && current.primaryIds.length >= MAX_CORE_ATTRIBUTES))) return current;
  const key = category === 'primary' ? 'primaryIds' : 'secondaryIds';
  const other = category === 'primary' ? 'secondaryIds' : 'primaryIds';
  current[key] = current[key].filter(value => value !== id);
  if (checked) {
    current[key].push(id);
    current[other] = current[other].filter(value => value !== id);
  }
  return current;
}

export function selectionBuild(build, agentId, selection) {
  if (!selection) return build;
  const picked = referenceSelection({role: build?.role, effectiveSubstats: selection});
  const reference = referenceSelection(build);
  const changed = ['primaryIds','secondaryIds'].some(key => picked[key].length !== reference[key].length ||
    picked[key].some(id => !reference[key].includes(id)));
  return {
    ...(build || {}), id: String(agentId), customSubstats: changed,
    effectiveSubstats: {
      ...(build?.effectiveSubstats || {}), ...picked,
      mode: picked.primaryIds.length ? 'core-substats' : 'supplement-only',
      note: '按本页自选属性统计，补充属性单列，不代表等价伤害。',
    },
  };
}

/** Only complete, internally consistent discs enter the roll totals. */
export function countOccurrences(discScores) {
  const result = {effective: 0, effectiveFirst: 0, effectiveAdditional: 0,
    supplement: 0, supplementFirst: 0, supplementAdditional: 0,
    confirmedDiscs: 0, pendingDiscs: 0};
  for (const disc of discScores || []) {
    if (!disc.valid) {result.pendingDiscs++; continue;}
    result.confirmedDiscs++;
    for (const stat of disc.subStats || []) {
      if (!stat.known || !Number.isSafeInteger(stat.rollCount) || stat.rollCount < 1) continue;
      const key = stat.category === 'primary' ? 'effective' : stat.category === 'supplement' ? 'supplement' : null;
      if (!key) continue;
      result[key] += stat.rollCount;
      result[`${key}First`]++;
      result[`${key}Additional`] += stat.rollCount - 1;
    }
  }
  return result;
}

/** Local, pure analysis of an Enka-normalized ZZZ showcase.
 * PropertyLevel is the number of represented base-value occurrences, including
 * the first occurrence. It is never interpreted as "upgrade count + 1" here.
 * These grades measure reference-substat coverage, not DPS or official ratings.
 */

export const SCORE_BANDS = Object.freeze([
  {grade: 'SS', title: '核心词条很集中', minRatio: 0.85},
  {grade: 'S', title: '核心词条较集中', minRatio: 0.70},
  {grade: 'A', title: '核心词条良好', minRatio: 0.55},
  {grade: 'B', title: '核心词条可用', minRatio: 0.40},
  {grade: 'C', title: '核心词条有待补充', minRatio: 0.25},
  {grade: 'D', title: '核心词条较少', minRatio: 0},
].map(Object.freeze));

const SUBSTAT_IDS = new Set([11102, 11103, 12102, 12103, 13102, 13103, 20103, 21103, 23203, 31203]);
// Gachabase release 3.3.0 D/R19815450, drive_disc_stat_pools 2000 / 3000 / 4000; 30 values rechecked 2026-11-14.
const SUBSTAT_BASES = {
  2: {11103: 37, 11102: 100, 12103: 6, 12102: 100, 13103: 5, 13102: 160, 23203: 3, 20103: 80, 21103: 160, 31203: 3},
  3: {11103: 75, 11102: 200, 12103: 13, 12102: 200, 13103: 10, 13102: 320, 23203: 6, 20103: 160, 21103: 320, 31203: 6},
  4: {11103: 112, 11102: 300, 12103: 19, 12102: 300, 13103: 15, 13102: 480, 23203: 9, 20103: 240, 21103: 480, 31203: 9},
};
const FIXED_MAIN = {1: 11103, 2: 12103, 3: 13103};
// Fixed release drive-disc pools; recommendations do not define legal main stats.
const MAIN_IDS = {
  1: [11103], 2: [12103], 3: [13103],
  4: [12102,11102,13102,20103,21103,31203],
  5: [12102,11102,13102,23103,31503,31603,31703,31803,31903,32303],
  6: [12102,11102,13102,31402,12202,30502],
};
const NAME = {
  11102: '生命值%', 11103: '生命值（固定值）', 12102: '攻击力%', 12103: '攻击力（固定值）',
  13102: '防御力%', 13103: '防御力（固定值）', 20103: '暴击率', 21103: '暴击伤害',
  23203: '穿透值', 31203: '异常精通', 23103: '穿透率', 12202: '冲击力',
  30502: '能量自动回复', 31402: '异常掌控', 31503: '物理伤害加成',
  31603: '火属性伤害加成', 31703: '冰属性伤害加成', 31803: '电属性伤害加成',
  31903: '以太伤害加成', 32303: '风属性伤害加成',
};
const NOTE = '这是本站按技能参考整理的核心副词条评分，不是 HoYoLAB 官方评分、伤害模拟或全服排名。补充词条单列，不折算为等价伤害；未折算战斗内暴击溢出、辅助增益上限及不同词条之间的收益差异。';
const isInt = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const unique = (values) => [...new Set(values)];

function propertyId(value) {
  if (typeof value === 'string' && /^[0-9]{1,5}$/.test(value)) value = Number(value);
  return isInt(value, 1, 99999) ? value : null;
}

function gradeFor(rolls, max) {
  if (!isInt(rolls, 0, 1000) || !isInt(max, 1, 1000) || rolls > max) return null;
  // Integer cross-products avoid drifting at the documented boundaries.
  return SCORE_BANDS.find((band) => rolls * 100 >= Math.round(band.minRatio * 100) * max);
}

function referenceProfile(build, ident) {
  if (!build || typeof build !== 'object' || String(build.id) !== String(ident)) return null;
  const info = build.effectiveSubstats;
  if (!info || !Array.isArray(info.primaryIds) || !Array.isArray(info.secondaryIds)) return null;
  const primary = info.primaryIds.map(propertyId);
  const secondary = info.secondaryIds.map(propertyId);
  if ([...primary, ...secondary].some((id) => !SUBSTAT_IDS.has(id))) return null;
  if (unique(primary).length !== primary.length || unique(secondary).length !== secondary.length || primary.some((id) => secondary.includes(id))) return null;
  return {primary: new Set(primary), secondary: new Set(secondary), mode: info.mode, note: info.note || ''};
}

function mainCheck(disc, slot, build) {
  const expectedIds = FIXED_MAIN[slot] ? [FIXED_MAIN[slot]] : build?.mainStatIds?.[String(slot)];
  const stats = Array.isArray(disc?.mainStats) ? disc.mainStats : [];
  const actualIds = stats.map((stat) => propertyId(stat?.propertyId));
  const known = Array.isArray(expectedIds) && expectedIds.length > 0 && stats.length === 1 && actualIds[0] !== null;
  const conditionalIds = Array.isArray(build?.conditionalMainStatIds?.[String(slot)]) ? build.conditionalMainStatIds[String(slot)] : [];
  const conditional = known && !expectedIds.includes(actualIds[0]) && conditionalIds.includes(actualIds[0]);
  return {slot, matched: known && !conditional ? expectedIds.includes(actualIds[0]) : null, conditional,
    expected: Array.isArray(expectedIds) ? expectedIds.map((id) => NAME[id] || `属性 ${id}`) : [],
    expectedIds: Array.isArray(expectedIds) ? [...expectedIds] : [],
    actual: actualIds.filter(Boolean).map((id) => NAME[id] || `属性 ${id}`), actualIds: actualIds.filter(Boolean)};
}

function inspectDisc(disc, build, profile) {
  const slot = disc.slot;
  const main = mainCheck(disc, slot, build);
  const warnings = [];
  const stats = Array.isArray(disc.subStats) ? disc.subStats : [];
  const levelKnown = isInt(disc.level, 0, 15);
  const rankKnown = [2, 3, 4].includes(disc.rarity);
  const maximumLevel = {2: 9, 3: 12, 4: 15}[disc.rarity];
  const enhancementBudget = levelKnown ? Math.floor(disc.level / 3) : null;
  let valid = levelKnown && rankKnown && disc.level <= maximumLevel && stats.length >= 1 && stats.length <= 4;
  if (!valid) warnings.push('品质、等级或副词条列表不完整，无法可靠计数。');
  const mainStat = Array.isArray(disc.mainStats) && disc.mainStats.length === 1 ? disc.mainStats[0] : null;
  if (!mainStat || !MAIN_IDS[slot]?.includes(propertyId(mainStat.propertyId)) || !Number.isFinite(mainStat.value) || mainStat.value <= 0) {
    valid = false; warnings.push('主属性缺失、数值无效或不属于该号位，暂不汇总。');
  }
  const seen = new Set();
  const subStats = [];
  let primaryRolls = 0, supplementRolls = 0, knownTotalRolls = 0;
  for (const stat of stats) {
    const id = propertyId(stat?.propertyId);
    const rawRolls = stat?.rollCount ?? stat?.propertyLevel;
    let known = SUBSTAT_IDS.has(id) && !seen.has(id) && isInt(rawRolls, 1, 6);
    if (stat?.rollCount != null && stat?.propertyLevel != null && stat.rollCount !== stat.propertyLevel) known = false;
    if (known && enhancementBudget != null && rawRolls > enhancementBudget + 1) known = false;
    if (known && main.actualIds.includes(id)) known = false;
    const expectedBase = SUBSTAT_BASES[disc.rarity]?.[id], value = stat?.value;
    if (!Number.isFinite(expectedBase) || !Number.isFinite(value) || value <= 0 || Math.abs(expectedBase * rawRolls - value) > 1e-7) known = false;
    if (stat?.baseValue != null && expectedBase !== stat.baseValue) known = false;
    if (!known) {valid = false; warnings.push('存在缺失、重复或矛盾的词条份数；不根据显示百分比猜测强化次数。');}
    if (id !== null) seen.add(id);
    const category = !profile ? 'unclassified' : profile.primary.has(id) ? 'primary' : profile.secondary.has(id) ? 'supplement' : 'other';
    if (known) {
      knownTotalRolls += rawRolls;
      if (category === 'primary') primaryRolls += rawRolls;
      if (category === 'supplement') supplementRolls += rawRolls;
    }
    subStats.push({propertyId: id, name: NAME[id] || '未识别属性', category,
      rollCount: known ? rawRolls : null, firstOccurrence: known ? 1 : null,
      laterOccurrences: known ? rawRolls - 1 : null, known});
  }
  if (enhancementBudget != null && knownTotalRolls > 4 + enhancementBudget) {
    valid = false; warnings.push('副词条总份数超过该等级可能值，暂停评分。');
  }
  const full = disc.rarity === 4 && disc.level === 15;
  let initialTypes = null;
  const integritySupported = disc.rarity === 4;
  if (rankKnown && !integritySupported) warnings.push('非S级盘暂仅展示原始词条，未纳入已确认汇总。');
  if (disc.rarity === 4 && levelKnown) {
    const inferred = knownTotalRolls - enhancementBudget;
    const expectedTypes = Math.min(4, inferred + enhancementBudget);
    const maxPerStat = 1 + Math.max(0, enhancementBudget - (4 - inferred));
    if (![3, 4].includes(inferred) || stats.length !== expectedTypes || subStats.some(stat => !stat.known || stat.rollCount > maxPerStat)) {
      valid = false; warnings.push('S级盘的副属性种类、总份数或单条份数不符合当前等级的成长规则，暂不汇总。');
    } else if (valid) initialTypes = inferred;
  }
  const eligible = profile ? [...profile.primary].filter((id) => !main.actualIds.includes(id)).length : 0;
  // Four initial distinct attributes plus five upgrades is the S+15 upper bound.
  // A main attribute cannot also occur as a subattribute. If no target remains,
  // this position has no primary-roll objective and is deliberately unrated.
  const maxRolls = full && main.actualIds.length === 1 && profile ? (eligible ? Math.min(eligible, 4) + 5 : 0) : null;
  if (maxRolls !== null && primaryRolls > maxRolls) {
    valid = false; warnings.push('核心词条份数与主属性排斥规则矛盾，暂停评分。');
  }
  let status = !valid ? 'incomplete-data' : !integritySupported ? 'unsupported-rarity' : !profile ? 'no-reference' : profile.mode === 'supplement-only' ? 'supplement-only' : !full ? 'not-maxed' : main.matched !== true ? 'main-stat-review' : maxRolls === 0 ? 'no-primary-target' : 'rated';
  const band = status === 'rated' ? gradeFor(primaryRolls, maxRolls) : null;
  const title = band?.title || ({'no-reference': '缺少角色参考', 'incomplete-data': '数据待确认', 'supplement-only': '仅统计补充输出',
    'unsupported-rarity': '仅展示原始词条', 'not-maxed': '尚未满足评分条件', 'main-stat-review': '主属性需结合流派复核', 'no-primary-target': '该位置无核心副词条目标'})[status];
  const confirmed = valid && integritySupported;
  return {slot, effectiveRolls: confirmed && profile ? primaryRolls : null,
    supplementRolls: confirmed && profile ? supplementRolls : null, totalRolls: confirmed ? knownTotalRolls : null,
    knownEffectiveRolls: primaryRolls, knownSupplementRolls: supplementRolls, knownTotalRolls,
    initialTypes: valid ? initialTypes : null, upgradeNodes: enhancementBudget,
    maxRolls: valid ? maxRolls : null, scoreRatio: band ? primaryRolls / maxRolls : null,
    grade: band?.grade ?? null, title, status, valid: confirmed, integritySupported, full, subStats, warnings: unique(warnings), mainStatCheck: main};
}

export function scoreAgent(agent, build) {
  const profile = referenceProfile(build, agent?.id);
  const rawDiscs = Array.isArray(agent?.discs) ? agent.discs : [];
  const slots = new Set(), duplicateSlots = new Set();
  const inputWarnings = [];
  const discs = [];
  for (const disc of rawDiscs) {
    if (!disc || !isInt(disc.slot, 1, 6) || slots.has(disc.slot)) {
      if (disc && isInt(disc.slot, 1, 6) && slots.has(disc.slot)) duplicateSlots.add(disc.slot);
      inputWarnings.push('存在无效或重复盘位；重复盘位不纳入已确认词条。'); continue;
    }
    slots.add(disc.slot); discs.push(disc);
  }
  discs.sort((a, b) => a.slot - b.slot);
  const discScores = discs.map((disc) => {
    const inspected = inspectDisc(disc, build, profile);
    if (!duplicateSlots.has(disc.slot)) return inspected;
    return {...inspected, valid: false, ambiguousSlot: true, status: 'incomplete-data', title: '重复盘位待确认',
      effectiveRolls: null, supplementRolls: null, totalRolls: null, initialTypes: null, maxRolls: null, scoreRatio: null, grade: null,
      warnings: unique([...inspected.warnings, '同一号位有多张驱动盘记录，无法确认实际装备，暂不汇总。'])};
  });
  const mainStatChecks = Array.from({length: 6}, (_, i) => mainCheck(discs.find((disc) => disc.slot === i + 1), i + 1, build));
  const dataKnown = inputWarnings.length === 0 && discScores.every((d) => d.valid);
  const knownEffectiveRolls = discScores.reduce((sum, d) => sum + d.knownEffectiveRolls, 0);
  const knownSupplementRolls = discScores.reduce((sum, d) => sum + d.knownSupplementRolls, 0);
  const knownTotalRolls = discScores.reduce((sum, d) => sum + d.knownTotalRolls, 0);
  const coverage = discs.length / 6;
  const complete = discs.length === 6 && dataKnown && discScores.every((d) => d.full) && mainStatChecks.every((m) => m.matched === true);
  const maxRolls = complete && profile ? discScores.reduce((sum, d) => sum + (d.maxRolls || 0), 0) : null;
  const canRate = complete && profile?.mode !== 'supplement-only' && maxRolls > 0;
  const band = canRate ? gradeFor(knownEffectiveRolls, maxRolls) : null;
  const suggestions = [];
  if (!profile) suggestions.push('尚无可靠的角色词条参考，先展示原始配装，不套用其他角色评分。');
  if (discs.length < 6) suggestions.push(`公开展柜只读到${discs.length}/6个盘位，补齐或重新同步后再看整套参考。`);
  if (discScores.some((d) => d.status === 'not-maxed')) suggestions.push('非S级15级盘保留真实词条计数，但不与满级S盘套用同一等级；先按当前资源安排升级。');
  for (const check of mainStatChecks.filter((m) => m.matched === false)) suggestions.push(`${check.slot}号盘主属性不在本参考选项内，请结合实际流派复核；本参考选项：${check.expected.join(' / ')}。`);
  if (profile?.mode === 'supplement-only') suggestions.push('此角色的功能性主要看冲击、穿透分享、减防或循环。补充输出词条不用于给辅助或击破能力评级。');
  if (profile && profile.mode !== 'supplement-only') {
    const weakest = discScores.filter((d) => d.status === 'rated').sort((a, b) => a.scoreRatio - b.scoreRatio || a.slot - b.slot)[0];
    if (weakest && weakest.scoreRatio < 0.70) suggestions.push(`可先复核${weakest.slot}号盘的核心词条覆盖；替换前同时保留主属性、套装及角色所需面板，不能只看次数。`);
  }
  if (Number.isInteger(agent?.coreSkillEnhancement) && agent.coreSkillEnhancement < 6) suggestions.push('部分搭配门槛引用核心F文本，请按当前核心等级复核，不直接照搬满级数值。');
  suggestions.push(...inputWarnings, ...discScores.flatMap((d) => d.warnings));
  const basis = [
    '按 Enka 返回的 PropertyLevel（正规化后的 rollCount）计份数，首次出现计1份；不再额外加1。首次出现可能来自初始词条，也可能来自强化新增，无法还原每一级强化轨迹。',
    '核心词条计入 effectiveRolls；补充输出词条只列 supplementRolls，不与核心词条等价加分。这里统计份数，不把不同词条解释为等价伤害。',
    '只给数据完整、主属性属于本参考选项的S级15级盘评级；整套还需六个盘位齐全。',
    '单盘核心份数理论上限＝min(可用核心副属性种类数, 4)＋5；可用种类排除该盘主属性。没有可用核心副属性的盘位不单独评级。按初始4条的满级S盘上限计算，初始3条盘会少1份机会。',
    '参考等级按核心份数÷上述上限：SS≥85%，S≥70%，A≥55%，B≥40%，C≥25%，D<25%。阈值由本站定义，只表示本参考的词条覆盖。',
  ];
  if (profile?.note) basis.push(profile.note);
  return {grade: band?.grade ?? null,
    title: band?.title || (!profile ? '缺少角色参考' : profile.mode === 'supplement-only' ? '功能型角色 · 仅列词条' : !dataKnown ? '数据待确认' : '配装条件未齐 · 暂不评级'),
    effectiveRolls: dataKnown && profile ? knownEffectiveRolls : null,
    supplementRolls: dataKnown && profile ? knownSupplementRolls : null,
    totalRolls: dataKnown ? knownTotalRolls : null,
    knownEffectiveRolls, knownSupplementRolls, knownTotalRolls,
    maxRolls, scoreRatio: band ? knownEffectiveRolls / maxRolls : null, coverage, presentDiscCount: discs.length,
    ratedDiscCount: discScores.filter((d) => d.grade).length, provisional: !band,
    discScores, mainStatChecks, inputWarnings: unique(inputWarnings), suggestions: unique(suggestions), basis, note: NOTE};
}

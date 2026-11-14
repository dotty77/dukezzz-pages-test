/** Disc selection guidance, kept separate from verified substat occurrence counts.
 * No network, storage, mutations, automatic disc disposal, or letter ratings.
 */
export const ARTICLE_REFERENCE = Object.freeze({
  url: 'https://news.17173.com/content/07142025/175402052.shtml',
  title: '《绝区零》驱动盘攻略：基础介绍&分解锁定&5号盘分析',
  date: '2025-07-14',
});

const CORE_IDS = new Set([11102, 12102, 13102, 20103, 21103, 23203, 31203]);
const MAIN_IDS = {
  1: new Set([11103]), 2: new Set([12103]), 3: new Set([13103]),
  4: new Set([11102, 12102, 13102, 20103, 21103, 31203]),
  5: new Set([11102, 12102, 13102, 23103, 31503, 31603, 31703, 31803, 31903, 32303]),
  6: new Set([11102, 12102, 13102, 12202, 30502, 31402]),
};
const isInt = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const list = value => Array.isArray(value) ? value : [];
const id = value => typeof value === 'number' && isInt(value, 1, 99999) ? value
  : typeof value === 'string' && /^[1-9][0-9]{0,4}$/.test(value) ? Number(value) : null;

function candidateSets(build) {
  const result = new Set();
  for (const option of list(build?.sets).slice(0, 32)) {
    for (const value of [option?.fourPieceId, ...list(option?.twoPieceIds).slice(0, 16)]) {
      const setId = id(value);
      if (setId !== null) result.add(setId);
    }
  }
  return result;
}

function checkMain(disc, ds, build) {
  const main = list(disc.mainStats);
  const property = main.length === 1 ? id(main[0]?.propertyId) : null;
  if (property === null || !MAIN_IDS[disc.slot]?.has(property)) return 'unknown';
  if (disc.slot === 5 && property === 23103) {
    if (build.role === '命破') return 'ineffective';
    return ds.mainStatCheck?.matched === true ? 'matched' : 'conditional';
  }
  if (ds.mainStatCheck?.conditional) return 'conditional';
  return ds.mainStatCheck?.matched === true ? 'matched'
    : ds.mainStatCheck?.matched === false ? 'review' : 'unknown';
}

function unknownDisc(slot, status, title, note) {
  return {slot, status, title, note, coreTypes: null, effectiveRolls: null,
    mainStatus: 'unknown', setStatus: 'unknown'};
}

/** Call with the same build/selection used for scoreAgent; known score counts
 * remain authoritative. The article's "2/3 types" is not a roll-count target.
 */
export function evaluateArticleRules(agent, build, score, selection) {
  const rawDiscs = list(agent?.discs);
  const rawScores = list(score?.discScores);
  const referenceKnown = build && String(build.id) === String(agent?.id);
  const sets = referenceKnown ? candidateSets(build) : new Set();
  const primary = new Set(list(selection?.primaryIds ?? build?.effectiveSubstats?.primaryIds)
    .slice(0, 16).map(id).filter(value => CORE_IDS.has(value)));
  const output = [];

  for (let slot = 1; slot <= 6; slot++) {
    const matches = rawDiscs.slice(0, 12).filter(disc => disc?.slot === slot);
    const scores = rawScores.slice(0, 12).filter(disc => disc?.slot === slot);
    if (!matches.length) {
      output.push(unknownDisc(slot, 'missing', '未读取到驱动盘', '补齐盘位资料后再查看选择建议。'));
      continue;
    }
    const disc = matches[0], ds = scores[0];
    const dataKnown = rawDiscs.length <= 6 && rawScores.length <= 6 && matches.length === 1 && scores.length === 1
      && ds?.valid === true && isInt(ds.effectiveRolls, 0, 9) && isInt(disc.level, 0, 15)
      && list(ds.subStats).length >= 1 && list(ds.subStats).length <= 4;
    if (!referenceKnown || !dataKnown) {
      output.push(unknownDisc(slot, 'unknown', '资料待确认', '角色参考、盘位或词条数据不足，暂不判断是否值得培养。'));
      continue;
    }
    const substats = ds.subStats;
    if (substats.some(stat => stat?.known !== true || !isInt(stat.rollCount, 1, 6)
      || (stat.category === 'primary') !== primary.has(id(stat.propertyId)))
      || new Set(substats.map(stat => id(stat.propertyId))).size !== substats.length) {
      output.push(unknownDisc(slot, 'unknown', '资料待确认', '属性选择与已确认词条不一致，请重新计算后查看。'));
      continue;
    }
    const coreTypes = substats.filter(stat => stat.category === 'primary').length;
    const mainStatus = checkMain(disc, ds, build);
    const mainProperty = id(list(disc.mainStats)[0]?.propertyId);
    const availableCoreTypes = [...primary].filter(value => value !== mainProperty).length;
    const suit = id(disc.suitId);
    const setStatus = !sets.size || suit === null ? 'unknown' : sets.has(suit) ? 'matched' : 'review';
    const entry = {slot, status: 'unknown', title: '', note: '', coreTypes,
      effectiveRolls: ds.effectiveRolls, mainStatus, setStatus};

    if (mainStatus === 'ineffective') {
      Object.assign(entry, {status: 'review', title: '先调整 5 号主属性',
        note: '穿透率不提升命破的贯穿伤害；当前主属性不适合这项输出参考，副词条份数仍单独展示。'});
    } else if (mainStatus === 'unknown' || setStatus === 'unknown') {
      Object.assign(entry, {status: 'unknown', title: '先确认套装与主属性',
        note: '目前只能列出已确认的副词条种类与份数，不能给出培养结论。'});
    } else if (setStatus === 'review') {
      Object.assign(entry, {status: 'review', title: '先核对套装方案',
        note: '该盘套装不在当前角色的候选方案中；先确认实际搭配，再比较副词条。'});
    } else if (mainStatus === 'conditional') {
      Object.assign(entry, {status: 'conditional', title: disc.slot===5 && mainProperty===23103 ? '5 号穿透需结合队伍' : `${disc.slot} 号主属性需满足条件`,
        note: disc.slot===5 && mainProperty===23103 ? '这是合法主属性；是否合适还取决于穿透辅助、减防、音擎和增伤，不能仅凭副词条确定。' : '这是当前方案的条件备选；先核对角色的循环与增益门槛，再比较副词条。'});
    } else if (mainStatus === 'review') {
      Object.assign(entry, {status: 'review', title: '先核对主属性',
        note: '主属性与当前角色参考不同；先确认流派及功能需求，再考虑副词条培养。'});
    } else if (availableCoreTypes <= 1) {
      Object.assign(entry, {status: 'functional', title: '按功能门槛考虑',
        note: primary.size > availableCoreTypes
          ? `主副属性不能同名，这个盘位仅剩 ${availableCoreTypes} 种可选核心副属性；按盘位与角色需求考虑，不机械要求两种。`
          : `当前选择 ${primary.size} 种核心属性，先满足角色增益、冲击或循环需求，不套用两种副属性门槛。`});
    } else if (disc.level > 0) {
      Object.assign(entry, {status: 'current', title: coreTypes >= 2 ? '当前核心种类较集中' : '当前核心种类较少',
        note: `当前有 ${coreTypes} 种核心副属性、${ds.effectiveRolls} 份。盘已强化，只描述现状；无法反推初始胚子，也不据此建议分解。`});
    } else if (coreTypes >= 3 && ['强攻', '命破'].includes(build.role)) {
      Object.assign(entry, {status: 'priority', title: '可优先考虑培养',
        note: `未强化盘已含 ${coreTypes} 种核心副属性，符合当前输出方向；后续仍需观察强化结果。`});
    } else if (coreTypes >= 2) {
      Object.assign(entry, {status: 'candidate', title: '可考虑培养',
        note: `未强化盘已含 ${coreTypes} 种核心副属性；这只是培养候选，资源投入还要结合现有装备。`});
    } else {
      Object.assign(entry, {status: 'review', title: '当前核心种类较少',
        note: `未强化盘含 ${coreTypes} 种核心副属性，可先比较其他候选；这不等于应当分解。`});
    }
    output.push(entry);
  }

  const basis = [
    '按所提供的 2025 年攻略整理选择思路，再使用本页当前角色建议或自选属性；不是 HoYoLAB 官方评级。',
    '检查顺序为套装方向、主属性、副属性。单盘命中套装候选，不代表整套 4+2 已配齐或条件增益已触发。',
    '“两种、三种”统计不同的核心副属性，不是强化份数；同一种属性追加多次仍只算一种。',
    '未强化盘具备两种所需副属性可列为培养候选；强攻、命破可优先看三种，但两种并不等于差盘。',
    '强化后的盘只判断当前种类与匹配情况，不能还原初始属性；功能型角色先看自身门槛。',
    '攻略定位表包含主属性：冲击力、异常掌控、能量自动回复、穿透率应检查主属性或其他装备，不加入副词条种类。',
    '有效份数沿用已验证的词条记录，核心与补充分别统计。攻略未给出字母等级或通用最优公式。',
  ];
  if (referenceKnown) {
    const reason = list(build.reasons)[0], caution = list(build.cautions)[0];
    if (typeof reason === 'string' && reason.trim()) basis.push(`当前角色依据：${reason.slice(0, 640)}`);
    if (typeof caution === 'string' && caution.trim() && caution !== reason) basis.push(`角色条件：${caution.slice(0, 640)}`);
  }
  const fifthAdvice = [
    '5 号盘要结合角色、音擎、队友与敌人比较；不能仅凭面板，把属性增伤、攻击/生命或穿透率固定排成同一顺序。',
    '穿透辅助会改变穿透率收益；减防、无视防御与战斗增伤也会影响比较。这里没有完整战斗条件，不使用攻略中的简化阈值自动判优。',
  ];
  if (referenceKnown && build.role === '命破') fifthAdvice.push('命破的贯穿伤害不吃敌人防御，穿透率与穿透值不作为贯穿输出的有效属性；具体生命/攻击缩放仍按该角色技能。');
  else fifthAdvice.push('5 号穿透率即使不在当前参考清单，也先标为需结合队伍；合法属性不直接判为错误。');
  return {discs: output, basis, fifthAdvice};
}

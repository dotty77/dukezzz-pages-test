import { Solar, Lunar, LunarMonth } from './vendor/lunar/lunar.esm.js?v=20260909-version-3-2-1';

// Local calculations. Callers decide what to display; this module performs no
// I/O and does not save birth input in module state or persistent storage.
export const ALGORITHM_VERSION = 'bagel-oracle-v1';
export const BIRTH_CONVENTION = Object.freeze({
  timezone: 'UTC+08:00',
  timezoneLabel: '东八区民用时间（UTC+8）',
  sect: 2,
  yearBoundary: '年柱按立春交接时刻划分，月柱按节令交接时刻划分。',
  dayBoundary: '采用晚子时仍属当日日柱的口径（sect=2）：23:00 不换日柱，00:00 换日柱；23:00 至 23:59 的时干按次日日干起算。',
  timeCorrection: '按填写的东八区钟表时间计算，不换算真太阳时，也不自动还原历史夏令时。',
});

const STEM_ELEMENT = Object.freeze({甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水'});
const ELEMENT_ALIAS = Object.freeze({wood:'木',fire:'火',earth:'土',metal:'金',water:'水',木:'木',火:'火',土:'土',金:'金',水:'水'});
const pad = value => String(value).padStart(2, '0');
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const ymd = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`;
const monthDays = (year, month) => [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31,30,31,30,31,31,30,31,30,31][month - 1];

/** The device's local civil day; rollover follows its timezone and DST rules. */
export function dailyKey(now = new Date()) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new TypeError('日期无效。');
  return ymd(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

// Birth inputs use UTC+8 civil time. Their latest valid date must not depend on
// the device-local date used for drawing the daily sign.
function birthToday(now = new Date()) {
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return ymd(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

function parseDay(day) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new TypeError('求签日期应为 YYYY-MM-DD。');
  const [year, month, date] = day.split('-').map(Number);
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || date < 1 || date > monthDays(year, month)) throw new RangeError('求签日期无效或超出支持范围。');
  return { year, month, day: date };
}

function asSolar(input, hour = input.hour ?? 12, minute = input.hour == null ? 0 : input.minute) {
  return input.calendar === 'lunar'
    ? Lunar.fromYmdHms(input.year, input.leap ? -input.month : input.month, input.day, hour, minute, 0).getSolar()
    : Solar.fromYmdHms(input.year, input.month, input.day, hour, minute, 0);
}

/** Strict input validation; never returns the input in an error message. */
export function validateBirth(input, { today = birthToday() } = {}) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { valid: false, errors: ['请填写出生日期，或选择今日通用签。'] };
  const { calendar, year, month, day, hour = null, minute = 0, leap = false } = input;
  if (!['solar', 'lunar'].includes(calendar)) errors.push('请选择公历或农历。');
  if (!Number.isInteger(year) || year < 1900 || year > 2100) errors.push('出生年份支持 1900 年至今。');
  if (!Number.isInteger(month) || month < 1 || month > 12) errors.push('月份应为 1 至 12。');
  if (!Number.isInteger(day) || day < 1 || day > 31) errors.push('请填写有效日期。');
  if (hour !== null && (!Number.isInteger(hour) || hour < 0 || hour > 23)) errors.push('小时应为 0 至 23，不知道时辰请选择未知。');
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) errors.push('分钟应为 0 至 59。');
  if (typeof leap !== 'boolean') errors.push('请明确是否为农历闰月。');
  if (calendar === 'solar' && leap === true) errors.push('公历没有闰月选项，请取消勾选或改选农历。');
  if (errors.length) return { valid: false, errors };
  const normalized = { calendar, year, month, day, hour, minute: hour === null ? 0 : minute, leap };
  if (calendar === 'solar' && day > monthDays(year, month)) return { valid: false, errors: ['所选公历月份没有这一天，请核对出生日期。'] };
  if (calendar === 'lunar') {
    const lunarMonth = LunarMonth.fromYm(year, leap ? -month : month);
    if (!lunarMonth) return { valid: false, errors: ['该农历年份没有所选闰月，请核对年份和闰月选项。'] };
    if (day > lunarMonth.getDayCount()) return { valid: false, errors: ['所选农历月份没有这一天，请核对出生日期。'] };
  }
  try {
    const solar = asSolar(normalized);
    const solarDay = solar.toYmd();
    parseDay(today);
    if (solar.getYear() < 1900 || solarDay > today) return { valid: false, errors: ['出生日期应在公历 1900 年 1 月 1 日至今天之间。'] };
  } catch {
    return { valid: false, errors: ['无法换算该日期，请核对历法、日期和闰月选项。'] };
  }
  return { valid: true, errors: [], normalized };
}

function pillarsAt(solar) {
  const eight = solar.getLunar().getEightChar();
  eight.setSect(BIRTH_CONVENTION.sect);
  return { year: eight.getYear(), month: eight.getMonth(), day: eight.getDay(), hour: eight.getTime() };
}

/** Return calendar facts only: no favourable elements, luck or probability claim. */
export function calculateBirth(input) {
  const validation = validateBirth(input);
  if (!validation.valid) throw new RangeError(validation.errors.join(' '));
  const normalized = validation.normalized;
  const timeKnown = normalized.hour !== null;
  const solar = asSolar(normalized);
  const lunar = solar.getLunar();
  const pillars = pillarsAt(solar);
  const possiblePillars = {};
  const warnings = [];
  if (!timeKnown) {
    pillars.hour = null;
    warnings.push('出生时辰未知：时柱留空，属于简化排盘。');
    const first = pillarsAt(asSolar(normalized, 0, 0));
    const last = pillarsAt(asSolar(normalized, 23, 59));
    for (const key of ['year', 'month']) {
      if (first[key] !== last[key]) {
        possiblePillars[key] = [first[key], last[key]];
        pillars[key] = null;
      }
    }
    if (Object.keys(possiblePillars).length) warnings.push('出生当天有节令交接，未知时辰无法确定对应年柱或月柱，已列出可能值。');
  }
  return {
    solar: { year: solar.getYear(), month: solar.getMonth(), day: solar.getDay(), hour: normalized.hour, minute: timeKnown ? normalized.minute : null, text: solar.toYmd() },
    lunar: { year: lunar.getYear(), month: Math.abs(lunar.getMonth()), day: lunar.getDay(), leap: lunar.getMonth() < 0, text: lunar.toString() },
    pillars,
    possiblePillars,
    dayStem: pillars.day.slice(0, 1),
    element: STEM_ELEMENT[pillars.day.slice(0, 1)],
    timeKnown,
    warnings,
    convention: BIRTH_CONVENTION,
  };
}

// FNV-1a is used only as a repeatable selection function, never as encryption.
// Keep its birth-derived seed inside the current call; do not return or store it.
function hash(value) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index++) result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  return result >>> 0;
}

function uniqueCatalog(records, label) {
  if (!Array.isArray(records)) throw new TypeError(`${label}资料格式无效。`);
  const seen = new Set();
  return records.map(record => {
    const id = record?.id ?? record?.number;
    if (id == null || String(id).length === 0 || seen.has(String(id))) throw new TypeError(`${label}缺少唯一编号。`);
    seen.add(String(id));
    return { id: String(id), record };
  }).sort((left, right) => compare(left.id, right.id));
}

export const ORACLE_RULES = Object.freeze([
  Object.freeze({ id: 'source', title: '签诗来源', text: '传统签谱只提供原签文。八字、每日日期与游戏地点之间没有签谱自带的对应关系，以下选签和地点匹配均为本站娱乐设定。' }),
  Object.freeze({ id: 'calendar', title: '排盘口径', text: `${BIRTH_CONVENTION.timezoneLabel}；${BIRTH_CONVENTION.yearBoundary}${BIRTH_CONVENTION.dayBoundary}${BIRTH_CONVENTION.timeCorrection}` }),
  Object.freeze({ id: 'selection', title: '每日一签', text: '将换算后的出生日期、填写的时间（或未知标记）和设备当地日期，用固定算法映射到签库。求签日期以设备当地午夜为界，相同资料同一当地日期结果一致；修改已解锁场景只改变地点候选，不改变签文。通用签按当地日期生成。' }),
  Object.freeze({ id: 'mapping', title: '地点匹配分', text: '场景五行为本站按环境意象设置：与出生日干五行相同加 2 分，与求签当天日干五行相同加 1 分；同分地点按每日固定顺序排列。通用签只比较当天五行。分数只是候选排序，不是好运或出金概率。' }),
  Object.freeze({ id: 'limits', title: '解签边界', text: '不以五行数量判断喜用神，不评判命格吉凶，不把匹配分当作真实运势。民俗娱乐，调频概率以游戏规则为准。' }),
  Object.freeze({ id: 'privacy', title: '出生资料', text: '排盘和选签在本机完成，出生资料不写入网址或默认保存。签簿和分享图应只包含签号、日期与游戏地点。' }),
]);

/** Build a repeatable local result without mutating catalogs or keeping state. */
export function buildOracle({ birth = null, day = dailyKey(), signs, spots = [], selectedCities } = {}) {
  const dayParts = parseDay(day);
  const catalog = uniqueCatalog(signs, '签谱');
  if (!catalog.length) throw new RangeError('签谱为空，请先加载签文。');
  const locations = uniqueCatalog(spots, '点位');
  if (selectedCities !== undefined && !Array.isArray(selectedCities)) throw new TypeError('已解锁场景应为列表。');
  const birthChart = birth === null ? null : calculateBirth(birth);
  const todayPillars = pillarsAt(Solar.fromYmdHms(dayParts.year, dayParts.month, dayParts.day, 12, 0, 0));
  const today = { day, dayPillar: todayPillars.day, dayStem: todayPillars.day[0], element: STEM_ELEMENT[todayPillars.day[0]] };
  const identity = birthChart ? `${birthChart.solar.text}|${birthChart.timeKnown ? `${pad(birthChart.solar.hour)}:${pad(birthChart.solar.minute)}` : 'unknown'}` : 'general';
  const seed = `${ALGORITHM_VERSION}|${identity}|${day}`;
  const sign = catalog[hash(`${seed}|sign`) % catalog.length].record;
  const cities = selectedCities === undefined ? null : new Set(selectedCities.map(String));
  const ranked = locations.filter(({ record }) => cities === null || cities.has(String(record.cityId))).map(({ id, record: spot }) => {
    const element = ELEMENT_ALIAS[spot.element] ?? null;
    const scoreDetails = [];
    if (birthChart) {
      const points = element === birthChart.element ? 2 : 0;
      scoreDetails.push({ id: 'birth-element', points, reason: `场景意象${element ?? '未标注'}与出生日干${birthChart.dayStem}（${birthChart.element}）${points ? '同属一行' : '不作同类加分'}` });
    }
    const todayPoints = element === today.element ? 1 : 0;
    scoreDetails.push({ id: 'day-element', points: todayPoints, reason: `场景意象${element ?? '未标注'}与今日干${today.dayStem}（${today.element}）${todayPoints ? '同属一行' : '不作同类加分'}` });
    const score = scoreDetails.reduce((sum, detail) => sum + detail.points, 0);
    return { spot, score, scoreDetails, scoreReasons: scoreDetails.map(detail => `${detail.reason}：+${detail.points} 分`), order: hash(`${seed}|spot|${id}`), id };
  });
  ranked.sort((left, right) => right.score - left.score || left.order - right.order || compare(left.id, right.id));
  const spotRecommendations = ranked.slice(0, 3).map(({ order, id, ...recommendation }, index) => ({ ...recommendation, rank: index + 1 }));
  return {
    algorithmVersion: ALGORITHM_VERSION,
    day,
    mode: birthChart ? birthChart.timeKnown ? 'birth' : 'simplified' : 'general',
    sign,
    birthChart,
    pillars: birthChart?.pillars ?? null,
    element: birthChart?.element ?? null,
    today,
    spotRecommendations,
    candidateCount: ranked.length,
    reason: birthChart ? '按本机出生资料与设备当地日期取签；地点按五行意象匹配分排列，属于本站游戏趣味演绎。' : '今日通用签只使用设备当地日期；地点按当天日干与场景意象匹配，不代表个人八字。',
    rules: ORACLE_RULES,
  };
}

import {inspectDiscRolls, validateConfiguration} from './disc-planner-core.js?v=20261118-disc-context-score-launch-1';

// Raw MYS /avatar/info fields, verified against genshin.py commit
// 4cf0cdd42af1a70013bc873fdcf4f51ecd5366ff, genshin/models/zzz/character.py.
// This module performs no requests and never reads account credentials.
const own = (value, key) => value != null && Object.hasOwn(value, String(key));
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = value => {
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) value = Number(value.trim());
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : null;
};
const MAIN_ALIASES = Object.freeze({11101: 11103, 12101: 12103, 13101: 13103});
const MESSAGES = Object.freeze({
  data: '本地驱动盘资料不完整，请刷新后重试。',
  agent: '官方角色资料缺失或尚未收录，原配装未覆盖。',
  level: '官方角色等级资料不完整，原配装未覆盖。',
  cinema: '官方影画资料不完整，原配装未覆盖。',
  weapon: '官方音擎资料缺失或尚未收录，原配装未覆盖。',
  refinement: '官方音擎叠影资料不完整，原配装未覆盖。',
  equipment: '官方驱动盘列表不完整，原配装未覆盖。',
  slot: '官方驱动盘号位重复或无效，原配装未覆盖。',
  rarity: '目前只支持导入 S 级驱动盘，原配装未覆盖。',
  discLevel: '官方驱动盘等级资料不完整，原配装未覆盖。',
  set: '官方驱动盘套装缺失或尚未收录，原配装未覆盖。',
  property: '官方驱动盘属性缺失或无法识别，原配装未覆盖。',
  value: '官方驱动盘属性数值无法核对，原配装未覆盖。',
  main: '官方驱动盘主属性与号位或等级不符，原配装未覆盖。',
  rolls: '官方驱动盘副词条数值不符合当前词条规则，原配装未覆盖。',
  initial: '官方驱动盘的初始词条数无法确认，原配装未覆盖。',
});

function fail(kind, slot) {
  const error = new Error(MESSAGES[kind]);
  error.name = 'OfficialEquipmentError';
  error.code = `official-equipment-${kind}`;
  if (Number.isInteger(slot) && slot >= 1 && slot <= 6) error.slot = slot;
  if (kind === 'initial') error.initial = null;
  throw error;
}

function requiredInteger(value, min, max, kind, slot) {
  const parsed = integer(value);
  if (parsed === null || parsed < min || parsed > max) fail(kind, slot);
  return parsed;
}

function propertyId(row, data, slot) {
  if (!object(row)) fail('property', slot);
  const id = integer(row.property_id);
  if (id === null || id <= 0 || !own(data.properties, id)) fail('property', slot);
  return id;
}

function displayedValue(row, id, data, slot) {
  // property_id determines units. Names, add, level and valid never determine rolls.
  const property = data.properties[id];
  if (!object(property) || typeof property.percent !== 'boolean') fail('data', slot);
  if (typeof row.base !== 'string') fail('value', slot);
  const text = row.base.trim();
  const match = /^\+?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)([%％]?)$/.exec(text);
  if (!match || Boolean(match[2]) !== property.percent) fail('value', slot);
  const scaled = Number(match[1].replaceAll(',', '')) * (property.percent ? 100 : 1);
  const raw = Math.round(scaled);
  if (!Number.isSafeInteger(raw) || raw <= 0 || Math.abs(scaled - raw) > 1e-7) fail('value', slot);
  return raw;
}

function emptyDisc(slot, data) {
  // These are inert editor placeholders, matching normalizedToConfiguration.
  // absent=true excludes this slot from panel contributions and disc ratings.
  const mainId = Number(Object.keys(data.mainBases[slot] || {})[0]);
  if (!Number.isSafeInteger(mainId)) fail('data', slot);
  return {slot, setId: '', mainId, level: 15, initial: 4, subs: [], locked: false, absent: true, unsupported: false};
}

function convertDisc(raw, data, slot) {
  requiredInteger(raw.id, 1, Number.MAX_SAFE_INTEGER, 'equipment', slot);
  if (raw.rarity !== 'S') fail('rarity', slot);
  const level = requiredInteger(raw.level, 0, 15, 'discLevel', slot);
  const setId = integer(raw.equip_suit?.suit_id);
  if (setId === null || !own(data.setProps, setId)) fail('set', slot);
  if (!Array.isArray(raw.main_properties) || raw.main_properties.length !== 1) fail('main', slot);
  const main = raw.main_properties[0];
  const sourceMainId = propertyId(main, data, slot);
  const mainId = MAIN_ALIASES[sourceMainId] || sourceMainId;
  if (!own(data.mainBases[slot], mainId)) fail('main', slot);
  const mainValue = displayedValue(main, mainId, data, slot);
  const growth = data.discLevels[`4:${level}`];
  if (!Number.isFinite(growth)) fail('data', slot);
  const expectedMain = Math.floor(data.mainBases[slot][mainId] * (10000 + growth) / 10000);
  if (mainValue !== expectedMain) fail('main', slot);
  if (!Array.isArray(raw.properties) || raw.properties.length < 3 || raw.properties.length > 4) fail('initial', slot);
  const seen = new Set();
  const subs = raw.properties.map(row => {
    const id = propertyId(row, data, slot);
    if (!own(data.subBases, id) || id === mainId || seen.has(id)) fail('property', slot);
    seen.add(id);
    const base = data.subBases[id];
    if (!Number.isFinite(base) || base <= 0) fail('data', slot);
    const value = displayedValue(row, id, data, slot);
    const ratio = value / base, rolls = Math.round(ratio);
    if (Math.abs(ratio - rolls) > 1e-7 || rolls < 1 || rolls > 6) fail('rolls', slot);
    return {id, rolls};
  });
  const total = subs.reduce((sum, row) => sum + row.rolls, 0);
  const inferred = total - Math.floor(level / 3);
  const initial = [3, 4].includes(inferred) ? inferred : null;
  if (initial === null) fail('initial', slot);
  const disc = {slot, setId: String(setId), mainId, level, initial, subs,
    locked: false, absent: false, unsupported: false};
  // Require a complete, legal record at the source level, not just a plausible sum.
  const inspected = inspectDiscRolls(disc, data);
  if (!inspected.complete) fail('initial', slot);
  return disc;
}

/** Convert one raw MYS avatar_list item into the planner's fixed-level configuration.
 * Preserves mindscape, equipped weapon/refinement, actual disc levels and inferred rolls.
 * Throws a safe OfficialEquipmentError; callers should retain the previous configuration.
 */
export function officialToConfiguration(agent, data) {
  if (!object(data) || !object(data.agents) || !object(data.weapons) || !object(data.mainBases)
      || !object(data.subBases) || !object(data.properties) || !object(data.setProps) || !object(data.discLevels)) fail('data');
  if (!object(agent)) fail('agent');
  const id = integer(agent.id);
  if (id === null || !own(data.agents, id)) fail('agent');
  requiredInteger(agent.level, 1, 60, 'level');
  const cinema = requiredInteger(agent.rank, 0, 6, 'cinema');
  if (!Array.isArray(agent.equip) || agent.equip.length > 6) fail('equipment');
  let weaponId = '', refinement = 1;
  // Missing/null is the published Optional[WEngine] absence representation.
  // refinement=1 is an inactive editor placeholder only when weaponId is empty.
  if (agent.weapon !== undefined && agent.weapon !== null) {
    if (!object(agent.weapon)) fail('weapon');
    const wid = integer(agent.weapon.id);
    if (wid === null || !own(data.weapons, wid)) fail('weapon');
    requiredInteger(agent.weapon.level, 1, 60, 'weapon');
    weaponId = String(wid);
    refinement = requiredInteger(agent.weapon.star, 1, 5, 'refinement');
  }
  const discs = Array.from({length: 6}, (_, index) => emptyDisc(index + 1, data));
  const occupied = new Set();
  for (const raw of agent.equip) {
    if (!object(raw)) fail('equipment');
    const slot = requiredInteger(raw.equipment_type, 1, 6, 'slot');
    if (occupied.has(slot)) fail('slot', slot);
    occupied.add(slot);
    discs[slot - 1] = convertDisc(raw, data, slot);
  }
  const config = {id: String(id), level: 60, promotion: 6, core: 6, cinema,
    weaponId, weaponLevel: 60, weaponBreak: 5, refinement, discs};
  if (validateConfiguration(config, data).length) fail('equipment');
  return config;
}

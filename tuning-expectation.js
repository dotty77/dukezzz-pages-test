// Pure estimates for ordinary Exclusive / W-Engine Channels. No records or network access.
export const EXPECTATION_SOURCES = Object.freeze([
  Object.freeze({
    id:'exclusive-cn', label:'官方独家频段公示', checkedAt:'2026-09-08',
    url:'https://operation-webstatic.mihoyo.com/gacha_info/nap/prod_gf_cn/8c01c50da79028f66c4c28060f36654a98d35401/zh-cn.json'
  }),
  Object.freeze({
    id:'weapon-cn', label:'官方音擎频段公示', checkedAt:'2026-09-08',
    url:'https://operation-webstatic.mihoyo.com/gacha_info/nap/prod_gf_cn/ff5467b51b3e21ab91784c197458ea5b4465e6a9/zh-cn.json'
  }),
  Object.freeze({
    id:'weapon-global', label:'国际服官方音擎频段公示', checkedAt:'2026-09-08',
    url:'https://operation-webstatic.hoyoverse.com/gacha_info/nap/prod_gf_us/ff5467b51b3e21ab91784c197458ea5b4465e6a9/zh-cn.json'
  })
]);

export const EXPECTATION_RULES = Object.freeze({
  character:Object.freeze({
    label:'独家频段', sConsolidated:0.016, featuredSChance:0.5, hardPity:90,
    expectedPerS:62.5, expectedPerFeatured:93.75, maxPerFeatured:180,
    sourceId:'exclusive-cn'
  }),
  weapon:Object.freeze({
    label:'音擎频段', sConsolidated:0.02, featuredSChance:0.75, hardPity:80,
    expectedPerS:50, expectedPerFeatured:62.5, maxPerFeatured:160,
    sourceId:'weapon-cn'
  })
});

export const EXPECTATION_METHOD = Object.freeze({
  title:'从零抽取的总体期望',
  scope:'适用于普通独家频段与音擎频段的目标UP；不套用独家重映、音擎回响或其他特殊选定机制。',
  notation:'前面的数字是影画层数，后面的数字是专武叠影等级。0+0代表1个角色本体、无专武；6+5代表7个角色本体、5把专武。',
  formula:'每个目标UP的平均抽数 ≈（2 − 小保底UP概率）÷ S级综合概率；角色与专武分别乘以所需份数后相加。',
  derivation:'每个目标UP可能在第1个S获得，也可能先歪、在第2个S保证获得，因此平均需要的S数量为1×UP概率＋2×（1−UP概率）。',
  assumptions:Object.freeze([
    '角色池与音擎池都从0垫抽、小保底开始；尚未拥有目标角色和专武。',
    '全程抽取目标UP，抽到目标后停止；获得UP后按下一轮小保底继续计算。',
    '未扣除信号余波兑换返还、赠送、已有角色或专武。',
    '角色和音擎的保底独立累计；这里没有读取你的当前垫抽或大小保底状态。'
  ]),
  precision:'综合概率来自官方公示且可能经过舍入，所以结果是近似平均值；不是成功率、中位数，也不保证按这个抽数就能抽到。',
  maximum:'最坏上限按每次小保底都歪、每个S都到硬保底计算：每个目标角色180抽，每把目标专武160抽。'
});

function integerInRange(value, min, max, label) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${label}必须是${min}到${max}之间的整数`);
  }
  return value;
}

/** Expected gross draws, without rounding or applying account-specific progress. */
export function estimateTarget({mindscape=0, refinement=0}={}) {
  integerInRange(mindscape,0,6,'影画层数');
  integerInRange(refinement,0,5,'专武叠影等级');
  const characterCopies=mindscape+1;
  const weaponCopies=refinement;
  const {character,weapon}=EXPECTATION_RULES;
  const characterExpected=characterCopies*(2-character.featuredSChance)/character.sConsolidated;
  const weaponExpected=weaponCopies*(2-weapon.featuredSChance)/weapon.sConsolidated;
  const characterMax=characterCopies*2*character.hardPity;
  const weaponMax=weaponCopies*2*weapon.hardPity;
  return Object.freeze({
    mindscape,refinement,label:`${mindscape}+${refinement}`,characterCopies,weaponCopies,
    characterExpected,weaponExpected,totalExpected:characterExpected+weaponExpected,
    characterMax,weaponMax,maxPulls:characterMax+weaponMax
  });
}

/** All 42 supported targets in mindscape-major order. */
export function allTargets() {
  return Array.from({length:42},(_,index)=>estimateTarget({mindscape:Math.floor(index/6),refinement:index%6}));
}

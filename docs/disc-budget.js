// Disc tuning costs and an explicitly optional mathematical enhancement model.
// The uniform model is not a claim about the game's undisclosed probabilities.
const COST_KEYS=['hiFi','calibrators','cores','dennies'];
const MODE_NAMES={random:'高级调律 · 随机号位',slot:'指定号位',main:'指定号位与主属性',sub1:'主属性 + 1条副属性',sub2:'主属性 + 2条副属性'};
let nextHeading=0;
function integer(value,min,max,label){const n=Number(value);if(!Number.isInteger(n)||n<min||n>max)throw new RangeError(label+'超出范围');return n;}

/** Joint P(each target has at least its requested shares), conditional on the
 * targets already being present and independent uniform hits among four lines.
 * A share includes the initial line. No appearance/count probabilities enter.
 */
export function probability({initialSubstats,targetRolls,assumption}={}){
  if(assumption!=='uniform-4')throw new RangeError('必须明确选择 uniform-4 假设');
  const initial=integer(initialSubstats,3,4,'初始副属性条数');
  if(!Array.isArray(targetRolls)||targetRolls.length<1||targetRolls.length>2)throw new RangeError('模型只支持1–2条目标');
  const need=targetRolls.map(x=>integer(x,1,6,'目标份数')-1),draws=initial===3?4:5;
  if(need.reduce((a,b)=>a+b,0)>draws)return 0;
  if(need.every(x=>x===0))return 1;
  let states=new Map([[need.map(()=>0).join(','),1]]);
  for(let step=0;step<draws;step++){
    const next=new Map(),add=(key,p)=>next.set(key,(next.get(key)||0)+p);
    for(const [key,p]of states){
      const hits=key.split(',').map(Number);add(key,p*(4-need.length)/4);
      for(let i=0;i<need.length;i++){const copy=hits.slice();copy[i]=Math.min(need[i],copy[i]+1);add(copy.join(','),p/4);}
    }
    states=next;
  }
  return Math.min(1,Math.max(0,states.get(need.join(','))||0));
}

/** Independent repeated trials: smallest n with P(at least one success)>=q. */
export function attempts(p,q=0.9){
  if(!Number.isFinite(p)||p<0||p>1||!Number.isFinite(q)||q<0||q>1)throw new RangeError('概率必须在0到1之间');
  if(q===0)return 0;
  if(p===0)return Infinity;
  if(p===1)return 1;
  if(q===1)return Infinity;
  const lp=Math.log1p(-p),lq=Math.log1p(-q);let n=Math.max(1,Math.ceil(lq/lp));
  if(!Number.isSafeInteger(n))return Infinity;
  // Correct rounding at an exact confidence boundary, without a large loop.
  if(n>1&&(n-1)*lp<=lq)n--;
  if(n*lp>lq)n++;
  return Number.isSafeInteger(n)?n:Infinity;
}

export function validateTargets({slot,mainId,targetSubs=[],rules}={}){
  const errors=[],s=Number(slot),main=String(mainId??'');
  if(!Number.isInteger(s)||s<1||s>6)errors.push('请选择1–6号位。');
  if(!rules?.mainStatsBySlot?.[String(s)]?.some(x=>String(x.id??x.propertyId)===main))errors.push('该主属性不属于这个号位的合法集合。');
  if(!Array.isArray(targetSubs))return{valid:false,errors:[...errors,'目标副属性格式无效。']};
  const seen=new Set(),allowed=new Set((rules?.substats||[]).map(x=>String(x.id??x.propertyId)));
  for(const x of targetSubs){
    const id=String(x.id??'');
    if(seen.has(id))errors.push('目标副属性不能重复。');seen.add(id);
    if(!allowed.has(id))errors.push('存在不合法的副属性。');
    if(id===main)errors.push('副属性不能与主属性相同；百分比与固定数值按不同属性区分。');
    if(x.rolls!==undefined&&(!Number.isInteger(Number(x.rolls))||Number(x.rolls)<1||Number(x.rolls)>6))errors.push('副属性份数须为1–6，首次获得算1份。');
  }
  return{valid:errors.length===0,errors:[...new Set(errors)]};
}

/** Direct material expenditure; min/max preserve the unverified fixed-slot
 * substat-targeting calibrator charge instead of silently assuming it is zero.
 */
export function costFor({slot,mode='slot',rules}={}){
  const s=integer(slot,1,6,'号位');if(!Object.hasOwn(MODE_NAMES,mode))throw new RangeError('未知调律方式');
  const t=rules?.tuning;if(!t)throw new TypeError('缺少已核实的调律规则');
  const count=mode==='sub1'?1:mode==='sub2'?2:0;
  const min={hiFi:mode==='random'?t.randomCopies:t.slotCopies,calibrators:0,cores:count*t.coresPerSubstat,dennies:0},max={...min},uncertainties=[];
  if((mode==='main'||count)&&s>=4)min.calibrators=max.calibrators=t.mainCalibrators;
  if(count&&s<=3){min.calibrators=t.fixedSlotSubstatCalibrators.min;max.calibrators=t.fixedSlotSubstatCalibrators.max;uncertainties.push(t.fixedSlotSubstatCalibrators.note);}
  for(const values of [min,max])for(const key of COST_KEYS)if(!Number.isFinite(values[key])||values[key]<0)throw new TypeError('材料规则缺失或无效');
  return{slot:s,mode,min,max,uncertainties};
}
export function totalCost(cost,n){
  if(!Number.isFinite(n)||n<0)throw new RangeError('材料汇总须为有限非负次数');
  return{...cost,min:Object.fromEntries(COST_KEYS.map(k=>[k,cost.min[k]*n])),max:Object.fromEntries(COST_KEYS.map(k=>[k,cost.max[k]*n]))};
}
export function coreCraftEquivalent(cost,rules){
  const recipe=rules?.crafting?.core?.input;
  if(!recipe||!Number.isFinite(recipe.calibrators)||!Number.isFinite(recipe.dennies))throw new TypeError('缺少核心仪合成成本');
  const convert=v=>({...v,calibrators:v.calibrators+v.cores*recipe.calibrators,dennies:v.dennies+v.cores*recipe.dennies,cores:0});
  return{...cost,min:convert(cost.min),max:convert(cost.max)};
}
const format=n=>Number(n).toLocaleString('zh-CN',{maximumFractionDigits:3});
function costText(cost,rules){return COST_KEYS.filter(k=>cost.max[k]>0).map(k=>`${cost.min[k]===cost.max[k]?format(cost.min[k]):format(cost.min[k])+'–'+format(cost.max[k])} ${rules.materials[k].name}`).join(' + ')||'无需材料';}
function node(tag,cls='',text=''){const n=document.createElement(tag);n.className=cls;n.textContent=text;return n;}
function input(type,label,value){const n=node('input');n.type=type;n.setAttribute('aria-label',label);if(value!==undefined)n.value=String(value);return n;}
function field(label,control){const n=node('label','disc-budget-field');n.append(node('span','',label),control);return n;}
function select(label,options,value){const n=node('select');n.setAttribute('aria-label',label);for(const [v,t]of options){const o=node('option','',t);o.value=String(v);n.append(o);}if(value!==undefined)n.value=String(value);return n;}

/** No network requests or persistent writes. The parent supplies verified rules. */
export function renderDiscBudget({slot,mainId,targetSubs=[],rules}={}){
  const root=node('section','disc-budget'),heading=node('h3','','音像店材料预算');heading.id='disc-budget-heading-'+(++nextHeading);root.setAttribute('aria-labelledby',heading.id);root.append(heading);
  const basic=validateTargets({slot,mainId,targetSubs:[],rules});
  if(!basic.valid){root.append(node('p','disc-budget-error',basic.errors.join(' ')));return root;}
  root.append(node('p','disc-budget-note',`正式 ${rules.gameVersion} 规则 · 核对 ${rules.checkedAt}。以下先列确定材料消耗，随机属性权重未核实。`));
  root.append(node('p','disc-budget-note','高级调律和已指定的属性只保证生成结果；没有收录指定副属性必被强化的承诺。'));
  const modes=Number(slot)<=3?['random','slot','sub1','sub2']:['random','slot','main','sub1','sub2'];
  const modeName=m=>Number(slot)<=3?(m==='slot'?'指定号位 · 主属性固定':m.startsWith('sub')?`固定主属性 + ${m==='sub1'?1:2}条副属性`:MODE_NAMES[m]):MODE_NAMES[m];
  const table=node('table','disc-budget-costs'),caption=node('caption','','每次生成1个S盘的材料'),body=node('tbody');table.append(caption,body);
  for(const mode of modes){const cost=costFor({slot,mode,rules}),tr=node('tr');const title=node('th','',modeName(mode));title.scope='row';tr.append(title,node('td','',costText(cost,rules)));body.append(tr);}
  root.append(table);
  if(Number(slot)<=3)root.append(node('p','disc-budget-note',rules.tuning.fixedSlotSubstatCalibrators.note));
  const coreRecipe=rules.crafting.core.input;
  root.append(node('p','disc-budget-note',`已有谐振核心仪直接消耗；每合成1个需${format(coreRecipe.calibrators)}调律校音器 + ${format(coreRecipe.dennies)}丁尼，折算后不再叠加核心仪。`));
  const hiFiRecipe=rules.crafting.hiFi.input,noiseRecipe=rules.crafting.noiseReduction.input;
  root.append(node('p','disc-budget-note',`${format(hiFiRecipe.noiseReduction)}降噪处理母盘 + ${format(hiFiRecipe.dennies)}丁尼可合成1高保真母盘；${format(noiseRecipe.audioBoost)}音质增强母盘 + ${format(noiseRecipe.dennies)}丁尼可合成1降噪处理母盘。下列预算以已有高保真母盘计，不自动重复折算。`));
  const controls=node('div','disc-budget-controls'),method=select('试制调律方式',modes.map(m=>[m,modeName(m)]),'slot'),count=input('number','试制次数',10);count.min='0';count.max='1000000';count.step='1';
  controls.append(field('试制方式',method),field('试制次数',count));root.append(controls);
  const total=node('div','disc-budget-total');total.setAttribute('aria-live','polite');root.append(total,node('p','disc-budget-note','按投入总量计算，不预扣拆解返还；驱动盘升级的镀剂与丁尼不属于此调律预算。'));
  function renderTotal(){
    total.replaceChildren();const n=Number(count.value);
    if(count.value===''||!Number.isInteger(n)||n<0||n>1000000){total.append(node('p','disc-budget-error','请输入0–1000000之间的整数次数。'));return;}
    const c=totalCost(costFor({slot,mode:method.value,rules}),n);total.append(node('p','disc-budget-result',`${format(n)}次试制总投入：${costText(c,rules)}`));
    if(c.max.cores)total.append(node('p','disc-budget-note','若核心仪全部合成：'+costText(coreCraftEquivalent(c,rules),rules)+'；不再另加核心仪。'));
  }
  count.addEventListener('input',renderTotal);method.addEventListener('change',renderTotal);renderTotal();
  root.append(node('p','disc-budget-note','这里只需选择调律方式和次数，就能计算确定的材料投入。想估算目标盘的刷取用量，可在上方换盘方案中选择“等概率试算”；网站会自动给出假设范围，无需填写成功率。'));
  const sources=node('details','disc-budget-sources');sources.append(node('summary','','规则来源与证据范围'));
  sources.append(node('p','disc-budget-note','客户端表提供合法属性和单次数值；未取得可核实的随机属性权重与强化等概率证明。这里列确定成本，上方目标盘估算另行标注数学假设。'));
  const list=node('ul');
  for(const id of ['official-experience-25','client-gacha-32','client-compose-32','client-property-library-32']){
    const s=rules.sources.find(x=>x.id===id);if(!s)continue;
    try{const u=new URL(s.url);if(u.protocol!=='https:')continue;const li=node('li'),a=node('a','',s.name);a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';li.append(a);list.append(li);}catch{}
  }
  sources.append(list);root.append(sources);return root;
}

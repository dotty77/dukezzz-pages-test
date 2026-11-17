import {ROTATION_EXAMPLE_IDS, rotationConfiguration, rotationBuild} from "../../team-rotation-config.js?v=91d5e16f23261a80";
function rotationGold(team,config,knowledge) {
  let confirmed=0,unknown=0;
  const rows=team.map(id=>{
    const profile=knowledge.agents[id],build=rotationBuild(config,id),policy=knowledge.gold?.agents?.[id];
    const bodyClass=profile.rank==='A'?'non-gold':policy?.agent;
    const weaponClass=policy?.signature;
    const body=['limited','custom'].includes(bodyClass)?1+build.mindscape:0;
    const weapon=['limited','custom'].includes(weaponClass)?build.signature:0;
    const pending=(!['limited','standard','non-gold','custom'].includes(bodyClass)?1+build.mindscape:0)+(build.signature&&!['limited','standard','non-gold','custom'].includes(weaponClass)?build.signature:0);
    confirmed+=body+weapon;unknown+=pending;
    return {id,body,weapon,total:body+weapon,pending,bodyClass,weaponClass};
  });
  return {total:unknown?null:confirmed,confirmed,unknown,rows};
}

function rotationCyclicOrder(ids, order) {
  return !order || order.some((_, offset) => ids.every((id, i) => id === order[(i + offset) % 3]));
}

function rotationPositionDirection(ids, from, to) {
  if (!ids.includes(from) || !ids.includes(to) || from === to) return null;
  return ids[(ids.indexOf(from) + 1) % 3] === to ? 'next' : 'previous';
}

function rotationPositionSkill(knowledge, agentId, ref) {
  const p=knowledge.agents[agentId];
  return (p.selectedSkillCatalog || []).find(a=>a.skillRef===ref || a.id===ref)
    || knowledge.positionSkills?.[ref]
    || Object.values(p.actions).find(a=>a?.skillRef===ref);
}

function adaptDedicatedPosition(phases, guide, ids, knowledge, B, actions) {
  const notes=[], affected=new Set(), transferLoss=new Set();
  const agentName=(id,en=false)=>knowledge.agents[id][en?'nameEn':'name'];
  const pair=(x,key)=>B(x?.[key],x?.[key+'En']);
  const normal=(toId)=>({toId,kind:'normal',signal:B('本招完整结束，快支提示消失且允许切人后再普通换入；不接错误对象的快支。','Wait for this move and any Quick Assist prompt to end, then switch normally when allowed; skip a prompt for another recipient.')});
  for (const phase of phases) {
    let changed=false;
    let convertedChainSkipped=false;
    for(let j=0;j<phase.steps.length;j++) {
      const entry=phase.steps[j];
      if(entry.choiceMode!=='resource-entry'||!entry.alternateSkillRefs?.some(ref=>knowledge.dedicatedActions[ref]?.kind==='quickAssist'))continue;
      // Ye's resource-gated Entry remains possible, but Zhao's misplaced ordinary
      // Quick Assist must not be used as the low-resource alternative.
      entry.alternateSkillRefs=entry.alternateSkillRefs.filter(ref=>knowledge.dedicatedActions[ref]?.kind!=='quickAssist');
      entry.actionId+='-position-resource-only';
      entry.actionLabel=B('照影 · 满资源登场','Illuminating Darkness · full-resource Entry');
      actions.set(entry.actionId,{id:entry.actionId,label:entry.actionLabel});
      entry.title=B('叶满6剑势且非明心时，按资源登场','Enter Ye by resources at six Sword Force outside Enlightened Mind');
      entry.input=B('接战中、后台叶满6剑势且非明心时普通切入，发动照影。','During combat, switch in an off-field Ye with six Sword Force outside Enlightened Mind to activate Illuminating Darkness.');
      entry.trigger=B('实际有6剑势、未进入明心且正在接战；本变体取消照的错位普通快支分支。','Actually at six Sword Force, outside Enlightened Mind and in combat; this variant removes Zhao’s misplaced ordinary Assist branch.');
      entry.reason=B('满资源登场视为快支，但不是响应照的提示；因此不安排照的自动蓄力续招。嘉音的个人加攻另须本次合格入场实际耗能。','The full-resource Entry counts as Quick Assist but is not a response to Zhao’s prompt, so Zhao’s automatic charged continuation is not planned. Astra’s personal ATK buff separately requires actual energy spent on this qualified entry.');
      entry.fallback=B('不足6剑势先普通切叶，用当前可发动的技能积攒，再按满资源进入明心的条件继续；已在明心则保留当前姿态，不重复发动照影。','Below six Sword Force, enter normally and build resources with available skills before satisfying Enlightened Mind’s entry conditions. If already Enlightened, keep that state instead of repeating this Entry.');
      entry.background=(entry.background||[]).filter(b=>!(b.actorId==='1341'&&b.kind==='overlap'));
      const source=phase.steps[j-1];
      if(source?.handoff?.toId===entry.actorId)source.handoff={toId:entry.actorId,kind:'resource-entry',signal:B('只按叶的实际满资源登场条件接手；无条件就按下一步恢复，不接照的错位提示。','Use only Ye’s actual full-resource Entry; otherwise follow recovery, not Zhao’s misplaced prompt.')};
      notes.push(B('叶的满资源登场保留；取消照→叶的错位普通快支，不计照因该响应才产生的自动蓄力。','Ye’s full-resource Entry remains; the misplaced Zhao-to-Ye ordinary Assist and the automatic charge requiring that response are removed.'));
    }
    for(let i=0;i<phase.steps.length-1;i++) {
      const source=phase.steps[i], entry=phase.steps[i+1], handoff=source.handoff;
      const entryKind=knowledge.dedicatedActions[entry.skillRef]?.kind;
      const convertedChain=handoff?.kind==='chain' && entryKind==='chain'
        && (source.skillRef==='131100012' || (convertedChainSkipped && /convert/.test(entry.id)));
      if(!handoff?.toId || (!['quick','entry-prompt'].includes(handoff.kind)&&!convertedChain)) continue;
      if(entry.actorId!==handoff.toId || (entryKind!=='quickAssist'&&!convertedChain)) continue;
      const allTriggerFact=knowledge.agents[source.actorId].facts.find(f=>f.kind==='quickAssistTrigger'&&f.skillRef===source.skillRef);
      const fact=['previous','next'].includes(allTriggerFact?.direction)?allTriggerFact:null;
      // Astra's off-field Chord prompts alternate the two other agents; they are not
      // ordinary next-slot prompts generated by the currently active attacker.
      const astraRelay=ids.includes('1311') && source.actorId!=='1311' && entry.actorId!=='1311' && !allTriggerFact;
      if(astraRelay&&!convertedChain) continue;
      const direction=fact?.direction || rotationPositionDirection(guide.requiredOrder||ids,source.actorId,entry.actorId);
      const recipient=ids[(ids.indexOf(source.actorId)+(direction==='previous'?2:1))%3];
      if(recipient===entry.actorId&&!convertedChainSkipped) continue;
      if(convertedChain)convertedChainSkipped=true;
      changed=true; affected.add(source.actorId);
      if(['1271','1131','1421'].includes(source.actorId)) transferLoss.add(source.actorId);
      const originalRef=entry.skillRef, ref=rotationPositionSkill(knowledge,source.actorId,source.skillRef);
      const actual=fact ? B(`当前技能指向${direction==='previous'?'上一位':'下一位'}${agentName(recipient)}。`,`This move targets the ${direction} slot, ${agentName(recipient,true)}.`)
        : B(`原教学的快支接棒依赖原循环站位；此站位不保证出现${agentName(entry.actorId)}的提示。`,`The authored assist handoff depends on its original cyclic order; this order does not guarantee a prompt for ${agentName(entry.actorId,true)}.`);
      const loss=B(`本段改为普通切入${agentName(entry.actorId)}，不计被跳过快支／转换连携的攻击、补资源或专属传递增益。`,`This phase enters ${agentName(entry.actorId,true)} normally; the skipped Assist/converted Chain's attack, resource grants and recipient-only buffs are not credited.`);
      notes.push(B(actual.zh+loss.zh,actual.en+' '+loss.en));
      if(!source.positionRecovery) {
      source.title=B(`${ref?.name||knowledge.dedicatedActions[source.skillRef].name} · 完整结束再换人`,`${ref?.nameEn||knowledge.dedicatedActions[source.skillRef].nameEn} · finish before switching`);
      const inputZh=(ref?.description||'').split('\n').slice(0,2).join(' ');
      const inputEn=(ref?.descriptionEn||'').split('\n').slice(0,2).join(' ');
      const oldTrigger=source.trigger;
      source.input=B((inputZh||source.input.zh)+' 完整结束、提示消失且允许切人后再普通换入。',(inputEn||source.input.en)+' Switch normally only after completion, prompt expiry and release of the action lock.');
      const clearOldSlot=txt=>String(txt||'').replace(/[^；。]*(?:上一位|下一位|站位)[^；。]*[；。]?/g,'');
      const isUltimate=knowledge.dedicatedActions[source.skillRef]?.kind==='ultimate';
      source.trigger=B((isUltimate?'终结技已就绪且目标可命中。':'')+clearOldSlot(oldTrigger.zh)+' '+inputZh,
        (isUltimate?'Ultimate ready and target hittable. ':'')+inputEn);
      source.complete=B(`完成需要的命中并确认可切出。${actual.zh}${loss.zh}`,`Finish the required hits and confirm switching is allowed. ${actual.en} ${loss.en}`);
      source.reason=B('当前接棒是本站按站位与技能条件推导的替代流程；不沿用原教学的快支收益或提前切出时机。','This replacement handoff is inferred from the formation and skill conditions. The authored Assist benefits and early-switch timing are not carried over.');
      source.fallback=B('前置未满足先补资源；仍不可切出就完成当前动作。不要为接错误提示改变本队需要的属性命中顺序。','Recover missing resources; finish the move if switching is still unavailable. Do not change the required Attribute-hit order just to accept another agent’s prompt.');
      }
      source.handoff=normal(entry.actorId);
      source.background=source.positionRecovery?(source.background||[]):[];
      source.positionAdapted=true;
      if(ref?.description) source.actionBranches=[{skillRef:source.skillRef,title:pair(ref,'name'),description:pair(ref,'description')}];
      const target=knowledge.agents[entry.actorId], oldHandoff=entry.handoff;
      const choices=['basic','ex'].flatMap(kind=>knowledge.foundationChoices?.[target.id]?.[kind]||[]);
      const candidates=choices.length?choices:Object.values(target.actions).filter(a=>a && ['basic','ex'].some(kind=>target.actions[kind]===a));
      const refs=[...new Set(candidates.map(a=>a.skillRef).filter(Boolean))];
      const branches=candidates.filter(a=>a.description).map(a=>{
        const cmd=!a.context && foundationCommand(a.description,a.skillRef);
        return {skillRef:a.skillRef,title:pair(a,'name'),description:pair(a,'description'),
          context:!!a.context || (!!cmd && !cmd.manual), ...(cmd?{command:B(cmd.zh,'')}:{})};
      });
      let special={
        '1331':B('有能量可用强化特殊技补飞羽并进入浮游；否则按普攻第四段及实际飞羽条件进入浮游。确认已浮游后，才执行后面的悬落换人。','With energy, use EX to gain Flight Feathers and enter Suspension; otherwise use Basic hit 4 with its actual feather requirement. Confirm Suspension before the following descending handoff.'),
        '1241':B('此处没有快支赠送的一枚霰弹；按实际弹数，以突击普攻第四／第五段命中或能量足够时强化特殊技补弹，避免溢出。','This entry grants no Quick Assist shell. Check ammo; refill through Assault Basic hits 4/5 or an affordable EX without overflowing.'),
        '1191':B('此处没有快支快蓄；需要急冻充能时按正常巡游蓄剪或有能量的强化特殊技补充。','This entry grants no Assist Quick Charge. Recover Flash Freeze Charges through the normal charged Roaming scissors or an affordable EX.')
      }[target.id] || B('检查下一步要求的能量、专属资源和姿态；不足就先用当前可发动的技能恢复，达标才继续。','Check the next step’s energy, unique resources and stance. Recover with currently available skills before continuing.');
      const mustTint=source.actorId==='1411'||(ids.includes('1411')&&/染色|以太部分|物理命中|赋彩/.test(JSON.stringify(entry)));
      const tint=target.id==='1331'?B('以太','Ether'):B((target.elements||[]).join('／')||'本队要求的属性',(target.elementsEn||[]).join('/')||'the required Attribute');
      const tintCheck=mustTint?B(`先以${tint.zh}攻击实际命中并确认本队要求的染色；资源已足也不能跳过这次属性命中。${target.id==='1331'?'薇薇安要命中以太段，不能用物理段代替。':''}`,`First land an actual ${tint.en} hit and confirm this team’s required tint; full resources do not remove this hit requirement.${target.id==='1331'?' Vivian needs her Ether portion, not a Physical hit.':''}`):null;
      if(tintCheck)special=B(special.zh+' '+tintCheck.zh,special.en+' '+tintCheck.en);
      const actionId=`position-recovery-${target.id}-${entry.id}`;
      actions.set(actionId,{id:actionId,label:B('普通入场 · 核对资源','Normal entry · check resources')});
      phase.steps[i+1]={id:entry.id+'-position-recovery',actorId:target.id,actionId,positionRecovery:true,
        title:B(`普通切入${target.name}，补足后续条件`,`Enter ${target.nameEn} normally and recover prerequisites`),
        input:special,trigger:B('前一步已完整结束并允许普通切人；有独立登场锁定的角色仍须先解锁。','The previous move is finished and normal switching is allowed; any separate entry lock must first be cleared.'),
        complete:B('确认实际资源和姿态达标，再继续下一事件；普通入场本身不发放快支资源或转移增益。'+(tintCheck?' '+tintCheck.zh:''),'Continue only with the actual resources and stance ready. Normal entry itself grants no Assist resources or transferred buffs.'+(tintCheck?' '+tintCheck.en:'')),
        reason:loss,fallback:B('条件不足就留在此步恢复；真正的目标连携提示出现时可选该角色，但不要凭空补出连携或强制等待失衡。','Recover here if requirements are missing. A real Chain prompt may offer this agent, but do not invent one or wait indefinitely for Stun.'),
        sourceRefs:[...new Set([`agent-${target.id}`,`agent-${source.actorId}`,source.skillRef,originalRef,...refs].filter(Boolean))],
        actionBranches:branches,background:[],handoff:oldHandoff,evidence:'mechanics-derived-position-recovery'};
    }
    // Mirror-order teaching must not repeat a phase goal which presupposes the old recipient.
    phase.objective=B('按当前站位准备资源与实际增益，再执行本队的输出步骤。','Prepare resources and actual buffs in this formation, then execute the team’s damage steps.');
    phase.prep=[B('普通入场不补被跳过快支的资源或增益；连携、资源登场与升级连携仍分别满足原条件。','Normal entry does not grant a skipped Assist’s resources or buffs. Chains, resource-gated entries and upgraded Chains retain their separate prerequisites.')];
    if(changed) for(const step of phase.steps) step.background=(step.background||[]).filter(b=>b.kind!=='overlap'||!affected.has(b.actorId));
    for(const step of phase.steps) {
      if(step.input?.zh.includes('按下一位切维琳娜')) {
        const direction=rotationPositionDirection(ids,step.actorId,'1561');
        step.input=B(step.input.zh.replace('按下一位切维琳娜',`按${direction==='previous'?'上一位':'下一位'}切维琳娜`),
          step.input.en.replace(/next-slot/g,direction+'-slot').replace(/next slot/g,direction+' slot'));
      }
      if(step.trigger?.zh.includes('上一位主攻在场'))step.trigger=B(step.trigger.zh.replace('上一位主攻在场','主攻当前在场'),step.trigger.en.replace(/previous-slot carry/gi,'currently active carry').replace(/previous main attacker/gi,'currently active main attacker'));
      if(step.skillRef==='148100003'&&step.fallback?.zh.includes('上一位般岳')) {
        const previous=ids[(ids.indexOf('1481')+2)%3];
        step.fallback=B(`若只有普通快支，当前对象是上一位${agentName(previous)}，不能把它当作般岳的升级连携；本步跳过升级分支，返回实际资源循环。`,`If only an ordinary Assist appears, its recipient is previous-slot ${agentName(previous,true)}, not Banyue's upgraded Chain. Skip the upgraded branch and return to the actual resource loop.`);
      }
    }
  }
  if(transferLoss.size) {
    const lossNames=[...transferLoss].map(id=>agentName(id)).join('、');
    const lossNamesEn=[...transferLoss].map(id=>agentName(id,true)).join(', ');
    const warning=B(`${lossNames}原先通过快支传给主攻的增益，本变体不计入；普通换回主攻不会转移。只有实战确实获得时再按该效果执行。`,`${lossNamesEn}'s original Assist-recipient buffs are not credited in this variant; a normal switch to the carry does not transfer them. Apply them only if actually obtained in battle.`);
    notes.push(warning);
    for(const phase of phases) for(const step of phase.steps) {
      step.warning=step.warning?B(step.warning.zh+' '+warning.zh,step.warning.en+' '+warning.en):warning;
      // Jane's old shield gate cannot be recovered by repeating a wrong-slot transfer.
      if(guide.id==='jane-seth-lucy'&&step.actorId==='1261') {
        step.trigger=B(step.trigger.zh.replace('露西加油和赛斯护盾按实际状态检查','露西加油按实际状态检查；此站位不预设简持有赛斯护盾').replace('且增益覆盖','且实际已有的增益覆盖'),step.trigger.en.replace('Lucy’s buff and Seth’s shield','Lucy’s actual buff (Seth’s shield is not assumed)'));
      }
      if(guide.id==='jane-seth-lucy'&&step.key==='seth-resolve') {
        step.reason=B('为赛斯强化长普准备意气；本排列不预设护盾或精通传给简。','Prepare Resolve for Seth’s enhanced held Basic; this formation does not assume his shield or proficiency transfer to Jane.');
        step.fallback=B('无能量且意气不足就先恢复；实际可招架时可接赛斯支援突击，但其快支对象仍按当前上一位，不会因此改成简。','Recover if short of energy and Resolve. A real parry may enable Seth’s Assist Follow-Up, but its recipient remains the current previous slot, not Jane.');
      }
    }
  }
  return [...new Map(notes.map(n=>[n.zh,n])).values()];
}

// The signal is the timing; the control below is selected by the actual kind.
// In particular, a conditional entry may use a normal switch without a prompt.
function rotationHandoffInput(h, ids, actor, knowledge, B) {
  const to=String(h.toId), slot='ABC'[ids.indexOf(to)], p=knowledge.agents[to];
  const zh=slot+' · '+p.name, en=slot+' · '+p.nameEn;
  const dir=rotationPositionDirection(ids,actor,to);
  const switchZh='普通切到'+(dir==='previous'?'上一位':'下一位')+' '+zh;
  switch(h.kind){
    case 'switch': case 'normal':
      h.direction=dir;
      return B(switchZh,'Switch normally to the '+dir+' slot: '+en);
    case 'quick': case 'quickAssist':
      return B('出现 '+zh+' 的快速支援提示时，按支援键接人。','Use Assist when the Quick Assist prompt is for '+en+'.');
    case 'parry':
      return B('可招架的攻击到来、有支援点时，按对应切换键让 '+zh+' 招架。','On a parryable attack with Assist Points available, switch to '+en+' for Defensive Assist.');
    case 'chain':
      return B('连携选择出现时，选 '+zh+'。','When the Chain Attack selection opens, choose '+en+'.');
    case 'entry-prompt':
      return B('快速支援就按支援键，连携就选人；只接 '+zh+' 对应的一种。','Respond to the Quick Assist or choose the Chain Attack for '+en+'; use only one.');
    case 'resource-entry':
      return B('满足登场的资源和姿态条件时，'+switchZh+'。','When the entry resource and stance conditions hold, switch normally to the '+dir+' slot: '+en+'.');
    default: return h.input || B('按本步信号切到 '+zh+'。','Follow this step’s cue to enter with '+en+'.');
  }
}


function attachRotationPosition(view, ids, knowledge, B, kind, notes=[]) {
  const name=(id,en=false)=>knowledge.agents[id][en?'nameEn':'name'];
  const slot=id=>'ABC'[ids.indexOf(id)];
  for(const phase of view.guide.phases) for(const step of phase.steps) {
    const h=step.handoff;
    if(h?.toId && h.toId!==step.actorId) {
      h.input=rotationHandoffInput(h,ids,step.actorId,knowledge,B);
    }
  }
  const first=view.guide.phases.find(p=>p.id==='opening')?.steps[0]?.actorId;
  if(ids.includes('1481')) {
    const previous=ids[(ids.indexOf('1481')+2)%3], p=knowledge.agents[previous];
    notes.push(B(`琉音上一位为${p.name}（${p.role}）；其额外能力的伤害分支和参考面板按这一位判断，不能沿用换位前的主攻。技能增益仍须满足原文条件。`,`Dialyn's previous slot is ${p.nameEn} (${p.roleEn}); her Additional Ability's damage branch and reference stats follow this agent, not the previous formation's carry. Its original conditions still apply.`));
  }
  const firstHint=first&&first!==ids[0]?B(`开局先普通切到 ${slot(first)} · ${name(first)}，再执行第一步。`,`Start by switching normally to ${slot(first)} · ${name(first,true)} before the first step.`):B('从 A 位开始，按实际资源执行。','Start from slot A and follow actual resources.');
  view.guide.positionPlan={order:[...ids],kind,openingActorId:first,label:B(kind==='adapted'?'站位适配 · 机制推导':kind==='authored'?'当前站位 · 专用教学':'当前站位 · 基础方案',kind==='adapted'?'Formation variant · mechanics-derived':kind==='authored'?'Current formation · authored lesson':'Current formation · foundation'),
    summary:B(ids.map(id=>`${slot(id)} ${name(id)}`).join(' / ')+'。'+firstHint.zh,ids.map(id=>`${slot(id)} ${name(id,true)}`).join(' / ')+'. '+firstHint.en),notes};
  return view;
}

function rotationDedicatedMatch(ids, knowledge) {
  if (ids.length !== 3 || new Set(ids).size !== 3) return null;
  return (knowledge.dedicatedGuides || []).find(g => g.teamIds.every(id => ids.includes(id))) || null;
}

function rotationKnowledgeForPotential(knowledge, config) {
  const result = {...knowledge, agents:{...knowledge.agents},
    foundationChoices:{...(knowledge.foundationChoices || {})}};
  const clone = value => typeof structuredClone === 'function'
    ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  for (const [id, build] of Object.entries(config?.characters || {})) {
    const rank = build?.potential;
    if (!Number.isInteger(rank) || rank < 1 || rank > 6 || !Object.hasOwn(result.agents,id)) continue;
    const patch = knowledge.potentialProfiles?.[id]?.[rank];
    if (!patch) continue;
    const selected = clone(patch);
    // Identity always comes from the verified base directory, never the patch.
    const base = knowledge.agents[id];
    result.agents[id] = {...base,...selected,id:base.id,name:base.name,nameEn:base.nameEn};
    result.foundationChoices[id] = selected.foundationChoices || {};
  }
  return result;
}

// Base skill branches are choices with prerequisites, never an invented all-skills combo.
function decorateFoundationAction(profile, kind, step, specific, knowledge, B, actions) {
  step.foundationKind = kind;
  if (specific || (profile.id === '1481' && kind === 'ex')) return step;
  const branches = knowledge.foundationChoices?.[profile.id]?.[kind] || [];
  if (branches.length < 2) return step;
  const categories = {basic:B('普攻与状态派生','Basic and stance branches'),ex:B('特殊技与条件派生','Special and conditional branches'),ultimate:B('终结技形态','Ultimate forms'),quickAssist:B('快支形态','Quick Assist forms')};
  const category = categories[kind];
  if (!category) return step;
  step.actionId = `agent-${profile.id}-foundation-${kind}-branches`;
  step.title = category;
  step.input = B('按当前形态、资源和前一招选择；下面的分支不代表全部依次施放。', 'Choose by your current form, resources and preceding move. These branches are not an instruction to cast every listed skill in order.');
  step.trigger = B('展开对应招式核对完整条件；依赖前招、资源或提示的派生不能直接跳入。', 'Check the selected skill’s full conditions below. Follow-ups that need a prior move, resource or prompt cannot be started directly.');
  step.complete = B('完成所选分支的必要命中和后续；确认资源与状态，再继续。自动追击按触发条件发生，不另按一次技能。', 'Complete the selected branch’s required hits and follow-up. Recheck resources and state. Automatic follow-ups trigger from their conditions, not an extra skill press.');
  const core = profile.facts.find(f=>f.kind==='coreReference');
  step.reason = B('这是当前配置的机制分支参考；尚未确认整队顺序的招式不会强行排成固定连段。'+(core?'\n\n核心条件：'+core.text:''), 'These are skill choices for the current build. Unverified team ordering is not turned into a fixed combo.'+(core?'\n\nCore conditions: '+core.textEn:''));
  step.actionBranches = branches.map(a=>({skillRef:a.skillRef,context:!!a.context,title:B(a.name,a.nameEn),description:B(a.description,a.descriptionEn)}));
  step.sourceRefs = [`agent-${profile.id}`,...branches.map(a=>a.skillRef)];
  // A composite choice must not inherit the first skill's saved key or promise its assist.
  step.handoff = null;
  actions.set(step.actionId,{id:step.actionId,label:category});
  return step;
}

function expandFoundationSequences(steps, knowledge, B, actions) {
  const recipe = knowledge.foundationSequences?.['1481'];
  return steps.flatMap(step=>{
    if(step.actorId!=='1481'||step.foundationKind!=='ex'||!recipe)return [step];
    return recipe.steps.map((item,index)=>{
      const action=knowledge.foundationActions[item.skillRef];
      const actionId=`agent-1481-${item.skillRef}`;
      actions.set(actionId,{id:actionId,label:B(action.name,action.nameEn)});
      return {...step,id:step.id+'-rps-'+index,actionId,skillRef:item.skillRef,
        title:B(action.name,action.nameEn),input:{...item.input},trigger:{...item.trigger},
        complete:{...item.complete},fallback:{...item.fallback},reason:{...item.reason},
        sourceRefs:[`agent-1481`,item.skillRef,...recipe.contextSkillRefs],
        handoff:null,background:[],foundationSequence:'dialyn-rps',sequenceIndex:index};
    });
  });
}

// A deterministic, source-backed teaching planner. No combat clock, damage score or invented cancel frame.
// Read the selected skill's activation clause. A damage type or skill category
// does not tell us whether the player taps, holds, switches or does nothing.
const rotationFoundationEnergy={"101100004":"cost:60","102100007":"cost:40","104100007":"cost:80","107100005":"cost:40","108100003":"cost:60","110100006":"cost:60","111100004":"start:40","113100004":"start:60","115100005":"cost:60","117100006":"start:40","117100008":"start:10","118100006":"cost:40","119100006":"cost:40","119100007":"cost:40","121100004":"cost:60","124100004":"cost:60","125100006":"cost:60","126100008":"cost:60","126100009":"cost:60","127100005":"cost:80","128100005":"cost:20","129100004":"cost:40","130100004":"cost:30","130100005":"cost:30","131100007":"cost:25","132100007":"cost:60","133100006":"cost:60","134100004":"cost:80","135100005":"cost:60","136100006":"cost:60","138100007":"cost:60","139100004":"cost:60","140100004":"cost:40","140100005":"cost:40","141100008":"cost:60","141100009":"cost:60","142100004":"cost:60","145100003":"cost:60","148100005":"cost:25","148100006":"cost:25","148100007":"cost:25","149100004":"cost:70","150100005":"cost:40","150100006":"cost:40","151100004":"cost:40","152100005":"cost:65","154100005":"cost:40","156100003":"cost:45","156100004":"cost:45","157100004":"start:40","158100006":"cost:60","162100004":"start:25","164100006":"cost:40","164100007":"cost:40"};
function foundationCommand(description,ref){
  const lines=String(description||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  if(!lines.length)return null;
  const tidy=s=>s.replace(/】\s*【/g,'】 → 【').replace(/\s*【(普通攻击|特殊技|强化特殊技|闪避|切换|终结技)键】\s*/g,(_,k)=>k==='普通攻击'?'普攻键':k+'键')
    .replace(/\[([^\]]+)\]/g,'$1').replace(/发动[:：；。]?$/,'').replace(/[:：；。]+$/,'').trim();
  // These entries describe passive proc/equipment effects rather than an independent button.
  // Keep their real trigger; never mine a later sentence for a different follow-up input.
  const observed={
    '103100002':'使用特殊技、强化特殊技、连携技或终结技等招式后自动上弹；无需再按键。',
    '117100009':'有1点流火时，下次换柏妮思入场会自动发动；无需另按键，已在前台时不要为此额外切人。',
    '121100015':'丽娜施放强化特殊技、连携技或终结技后，召唤物会在13秒内每2.5秒自动攻击一次；无需另按键。',
    '121100016':'惊吓达到6层时，召唤物的下一次晨间清扫自动改为午夜清扫；无需另按键。',
    '138100006':'极雷断空或苍光期间触发雷殛伤害，本招在当前动作结束后自动发动；无需另按键。',
    '120100004':'场上有电壶时，用落羽命中敌人，电壶会自动射出甲乙矢；无需另按键。',
    '133100004':'有护羽时，队友强化特殊技命中会触发追加攻击；无需另按键。',
    '135100004':'猎步中，其他前台队友的特殊技或强化特殊技重击命中后自动触发；无需另按键。',
    '136100003':'有绝意时，由其他前台队友用普攻、冲刺攻击、闪避反击或快速支援命中，自动触发；无需另按键。',
    '136100004':'有绝意时，由其他前台队友用强化特殊技、支援突击或终结技重击命中，自动触发；无需另按键。',
    '138100005':'对同一目标连续触发三次白雷额外伤害后自动触发；无需另按键。',
    '139100002':'战斗中虎威自动攻击；无需另按键。',
    '141100003':'有甜度点时，其他前台队友命中后触发追加攻击；无需另按键。',
    '141100004':'敌人处于甜蜜惊吓状态时自动受击；无需另按键。',
    '141100005':'敌人处于甜蜜惊吓时，以硬糖射击或夹心硬糖射击重击命中，自动触发；无需另按键。',
    '141100006':'柚叶在后台或发动狸之帐时，阿釜自动协助攻击；无需另按键。',
    '149100002':'后台千夏有磨爪器，且场上没有猫的凝视目标时，泡泡自动攻击；无需另按键。',
    '155100005':'发动终结技或日华时法厄同协助攻击，受触发间隔限制；无需另按键。',
    '157100005':'炮塔自动攻击；无需另按键。',
    '157100006':'队友使敌人失衡，或诺姆消耗预热膛温触发连携技时，炮塔自动展开导弹舱；无需另按键。'
  };
  const choice=String(ref||'');
  if(observed[choice])return {zh:observed[choice],manual:false};
  const first=lines[0];
  if(/自动发动|自动释放/.test(first)&&!first.includes('【'))return {zh:tidy(first).replace(/自动$/,'自动触发')+'，无需另按键。',manual:false};
  if(/可通过以下[两二三四]种方式发动/.test(first)){
    // Use one fully sourced alternative at a time; commands in the original
    // “快速键入指令” route remain available under the full skill text.
    const alt=lines.slice(1).filter(s=>s.includes('【')&&/发动[；：]/.test(s));
    if(alt.length)return {zh:tidy(first.split('，')[0])+'，例如：'+tidy(alt[0])+'。其他输入方式见该招式说明。',manual:true};
  }
  const mark=l=>/【(?:普通攻击|切换|闪避|特殊技|强化特殊技|终结技)键】|拖曳摇杆|选择对应角色/.test(l);
  const i=lines.slice(0,4).findIndex(mark);
  if(i>=0){
    let s=tidy(lines[i]),prefix=lines.slice(0,i).find(l=>/^\[[^\]]+\]$/.test(l));
    if(prefix)s=tidy(prefix)+'：'+s;
    const cost=rotationFoundationEnergy[choice];
    if(cost&&/能量(?:足够|充足)时/.test(s)){
      const [kind,n]=cost.split(':');
      s=s.replace(/能量(?:足够|充足)时/,kind==='start'?'普通能量达到'+n+'点时':'能量足够时（基础消耗'+n+'点）');
    }
    return {zh:s+'。',manual:true};
  }
  return null;
}

function applyFoundationInputs(step,action,B){
  if(step.complete.zh==='该招式需要的命中和后续动作完成，且角色已允许切出，再交给下一位。'){
    step.complete=B('完成本步需要的动作和命中。只有本步标出交接时才切人，否则留场。','Complete the required input and hits. Stay on field unless this step has a handoff.');
  }
  if(step.actionBranches?.length){
    const available=[];
    for(const branch of step.actionBranches){
      if(branch.context)continue;
      const command=foundationCommand(branch.description.zh,branch.skillRef);
      if(!command)continue;
      branch.command=B(command.zh,'');
      if(!command.manual)branch.context=true;
      if(command.manual)available.push(command.zh);
    }
    // Keep an immediately usable example without pretending that every state is
    // available. Full independently conditioned choices stay on this same card.
    if(available.length){
      const short=available.find((s,i)=>i>0&&s!==available[0]&&s.length+available[0].length<65);
      const example=short?available[0].replace(/。$/,'；')+short:available[0];
      step.input=B('按当前条件选一招。例如：'+example+'不符合时看下方其他分支，不要逐项连按。',step.input.en);
    }
    return step;
  }
  const command=foundationCommand(action.description,action.skillRef);
  if(command)step.input=B(command.zh,step.input.en);
  return step;
}

// Only the resolved in-game skill (from this rank/branch) contributes instructions.
// These explanations describe inputs, not a simulated starting state or button count.
function applyFoundationBasics(phases,knowledge,config) {
  const pair=(zh,en)=>({zh,en});
  const notes=new Map();
  const add=(ids,zh,en)=>{for(const id of ids.split(' ')) notes.set(id,pair(zh,en));};
  add('101100003 101100004','不必先普攻就能发动。想更快出招，可选普攻第3段或「落雷」后接这招。','No Basic beforehand is required. For a faster startup, use it after Basic hit 3 or Thunderbolt.');
  add('101100002','要打「落雷」，先到普攻第3段，再长按普攻，或稍停后点按。落雷可以快接强化特殊技；直接放强化特殊技不必走这条路线。','For Thunderbolt, reach Basic hit 3, then hold Basic or pause and tap. Thunderbolt can speed up the following EX; a direct EX does not require it.');
  add('110100003 110100004 110100005','直接发动不必先普攻。要快速爆炸，在普攻第2段、第4段或强化普攻后接本招。本·比格在队时，要打出协同攻击，需接在强化普攻后。','No Basic required to start. For a fast explosion, use after Basic hit 2, hit 4, or an enhanced Basic. The team attack with Ben specifically needs the enhanced Basic.');
  add('110100006','直接发动不必先普攻。接在普攻第2段、第4段或强化普攻后才能快爆；本潜能招式经这条路线引爆时，爆炸失衡值提升10%。本·比格在队时，协同攻击另需强化普攻。','No Basic required to start. Follow Basic hit 2, hit 4, or an enhanced Basic to trigger the fast explosion. That route increases explosion Daze by 10% for this Potential skill. The team attack with Ben needs an enhanced Basic.');
  add('116100003','两种起手都不必先普攻。常态出招后可点按或长按普攻直接接第4段；垫步闪避期间出招后，同样输入直接接第5段。','Neither entry needs a Basic. After a normal EX, tap or hold Basic to start at hit 4. After an EX during the sidestep dodge, tap or hold Basic to start at hit 5.');
  add('122100002','直接点普通特殊技不必先普攻。要快速换架，可选在普攻第3、4或5段后点普通特殊技，再接新架势普攻第3段。','A normal Special needs no preceding Basic. To switch stance quickly, use Special after Basic hit 3, 4 or 5, then continue from the new stance’s Basic hit 3.');
  add('122100003','不要求先打普攻；能量足时长按强化特殊技。森罗万象中，从普攻第5段或其他招式衔接后继普攻时，可从第3段起手。','No Basic is required before holding EX. During Shinrabanshou, follow Basic hit 5 or another skill with Basic to enter at hit 3.');
  add('120100006','基础「地网」不需要先打穿云第4或第5段；能量足就可以点强化特殊技。','Base EX does not require Basic hit 4 or 5. Use it directly with enough Energy.');
  add('120100007','要发动潜能「地网·巡弋」，必须接合法前招：穿云第4或5段，或指定冲刺攻击、终结技、闪避反击、快速支援。选后一类就不用先打穿云。','The Potential EX requires an eligible lead-in: Basic hit 4 or 5, or the listed Dash Attack, Ultimate, Dodge Counter, or Quick Assist. The latter routes do not need Basic first.');
  add('120100003','要瞄准：长按普攻、松开普攻发射，不必先打第5段。要直接发射：穿云第5段、普通／强化特殊技或连携技之后长按特殊技。两种输入选一。','To aim, hold Basic and release to fire; hit 5 is not required. To fire directly, hold Special after Basic hit 5, Special, EX or Chain Attack. Choose one route.');
  add('154100001 154100009','选普攻路线：要到偏锋第5段下落，落地后、霜刑足够时继续长按普攻或特殊技（二选一）接「绝裁」。也可在坠霜或重霜落地后接，不用先打五段。绝裁发动后可接回偏锋第5段。','Basic route: land the plunging fifth hit, then keep holding either Basic or Special with enough Trial by Cold. The listed plunging Specials can also lead in, without five Basics. After EX, you can return to Basic hit 5.');
  add('150100002','这里的第3段是蓄力等级，不是点三下。长按普攻蓄力并松开；强化特殊技等指定前招后，附近至少2个应援能量时可直接长按普攻发动第3段蓄力。只有指定前招还允许限时点按。','Stage 3 is a charge level, not three taps. Hold Basic and release. After EX or another listed opener, 2 nearby resources allow held Basic to start at charge level 3. Only some openers also allow a timed tap.');
  add('150100004','这是普通特殊技的派生。可在甜心律动第4段后点特殊技；也能在支援突击、连携技或终结技后直接点，不必先打第4段。','This is a normal Special follow-up. Tap Special after Basic hit 4, or after Assist Follow-Up, Chain Attack or Ultimate without using Basic first.');
  add('150100005 150100006','不用先打普攻第4段。第一招可直接点强化特殊技；要接第二招，必须刚打完第一招且仍有能量。强化特殊技后若附近有2个应援能量，可选长按普攻直接打第3段蓄力。','No Basic hit 4 is required. Use the first EX directly; the second EX requires the first and enough remaining Energy. After EX, 2 nearby resources let you hold Basic to enter charge stage 3.');
  add('147100008','普攻起手：用普攻打「峥嵘」，第3或4段后点强化特殊技。其他入口不要求先打这几段：例如支援突击、闪避反击或快支后长按强化特殊技。','Basic route: use the Basic button for Basic hits 3 or 4, then tap EX. An Assist Follow-Up, Dodge Counter or Quick Assist also lets you hold EX without those Basics.');
  add('147100009','选择「崔巍」起手，要用特殊技键打到第1或2段，再点普攻发动山摇；也可在合法前招期间快速输入「强化特殊技→强化特殊技→普攻」。两条路线不连做。','Use the Special button for the first or second hit of this Basic string, then tap Basic for Mountain Tremor. Alternatively, during an eligible move, input EX → EX → Basic. Do not run both routes.');
  add('147100010','「崔巍」用特殊技键打到第3或4段后，点普攻发动本招。支援突击、闪反或快支后也可直接长按普攻；不用补打四段。','Use Special for the third or fourth hit of this Basic string, then tap Basic. Alternatively, hold Basic after Assist Follow-Up, Dodge Counter or Quick Assist without building four hits.');
  add('147100011','「峥嵘」用普攻键打到第1或2段后点强化特殊技。另一条路是在合法前招期间快速输入「普攻→普攻→强化特殊技」；不要先打完两条路线。','After Basic hit 1 or 2 on the Basic-button string, tap EX. Alternatively, during an eligible move input Basic → Basic → EX.');
  add('147100012','必须在「地动」动作期间快速输入强化特殊技、强化特殊技、普攻；不要等地动结束再按。','During Earth Shaker, quickly input EX → EX → Basic; do not wait until Earth Shaker ends.');
  add('147100013','必须在「论道」动作期间快速输入普攻、普攻、强化特殊技；最后输入的是强化特殊技。','During the required lead-in move, quickly input Basic → Basic → EX; EX is the last input.');
  add('125100006','发动前无需普攻；强化特殊技后可直接接普攻第3段。若要维持第3段连击，再连续点普攻。','No Basic is required beforehand. After EX, optionally enter Basic hit 3 directly; tap repeatedly only if you want to sustain this hit.');
  add('125100001','普攻第3段中连续点普攻才能维持连击；停止点按会自动接第4段。不是要求点固定次数。','Repeatedly tap Basic during hit 3 to sustain it. Stopping advances to hit 4 automatically; no fixed tap count.');
  add('129100004','强化特殊技前不必普攻。出招后可直接接「暗渊四重奏」第4段，不用从第1段重打。','No Basic before EX. After EX, Basic can enter the fourth hit of Dark Abyss Quartet directly.');
  add('145100003','强化特殊技前不必普攻。出招后可直接接普攻第5段，不是先点五次。','No Basic before EX. After EX, you can go straight into Basic hit 5.');
  add('156100003 156100004','起手不必先普攻。若要续段，必须在扬清后、仍有能量时再点或长按强化特殊技。准备接普攻时，无论哪一招放完都是点普攻直接到第5段。','No preceding Basic. The follow-up EX needs its opener and remaining Energy. After either EX, tapping Basic enters hit 5 directly.');
  add('161100005','非猩红铭刻、锐能足即可出招，不用先普攻。出招后可点按或长按普攻直达锻星第3段；保持长按强化特殊技跳过斩击是另一条路线。','Outside Crimson Inscription with enough resource, no prior Basic is needed. Afterwards tap or hold Basic to enter hit 3. Holding EX to skip the slash is a different route.');
  add('161100003','必须先在猩红铭刻中用指定特殊技实际触发毁伤，才点按或长按普攻发动伏钺；随后可再点按或长按普攻接锻星第3段。','The specified Special must trigger Maim in Crimson Inscription. Then tap or hold Basic to use the follow-up; optionally tap or hold again to enter Starforging hit 3.');
  add('155100002 155100004','想从日华直达天光第3段：先放强化特殊技，之后日珥至少30点才长按普攻。不要为了这条路线先点三次普攻。','For the shortcut, use EX first, then hold Basic with at least 30 resource to start at hit 3. Do not tap three Basics before EX.');
  add('151100002 151100004','强化特殊技不需要先打普攻。要跳过蓄力普攻第1段，须在强化特殊技、连携技或终结技后长按普攻，且重拍足够；第2、3段各耗50点。','No Basic before EX. To skip charge stage 1, hold Basic after EX, Chain or Ultimate with enough resource: stages 2 and 3 each cost 50.');
  add('109100004','能量够就能直接点强化特殊技，不需要先打固定段数普攻。第一段后能量仍足时可再按一次强化特殊技追加；不是接普攻。','Use EX directly with enough Energy. A second EX is optional after the first if enough Energy remains; this is not a Basic follow-up.');
  add('117100002 117100003','要打回旋喷火，先进入燃油特调，再长按普攻，发动时消耗20点燃点。可继续按住延长喷火。想接双喷，等终结一击发动后再点强化特殊技。','In Nitro-Fuel Cocktail, hold Basic to start the spin at a cost of 20 Heat. Keep holding to extend the spray. For double spray, tap EX after the finishing blow.');
  add('117100005 117100006','单喷靠能量直接起手，点强化特殊技即可，不用先点或长按普攻。继续按住强化特殊技可延长单喷；要转双喷，在单喷期间、能量足够时再点强化特殊技。','Start single spray directly with enough Energy by tapping EX. No Basic tap or hold is needed. Keep holding EX to extend it, or tap EX again during single spray with enough Energy to switch to double spray.');
  add('117100007 117100008','单喷期间还有足够能量就再点强化特殊技转双喷，这条路线不需要普攻。若走普攻路线，在燃油特调中长按普攻消耗20点燃点，等终结一击发动后再点强化特殊技。','For double spray, tap EX during single spray with enough Energy; no Basic is needed on that route. Alternatively, hold Basic in Nitro-Fuel Cocktail at a cost of 20 Heat, then tap EX after the finishing blow.');
  add('128100002 128100004','不要求先打固定段数的普攻。先长按特殊技让轮胎转到最高蓄力，再继续长按，有能量才发动强化特殊技。接在普攻前三段之一、冲刺攻击或闪反后可加快蓄力起手。','No fixed Basic string is required. Hold Special to reach maximum charge, then keep holding with enough Energy for EX. Starting after one of the first three Basic hits, a Dash Attack or Dodge Counter speeds up charging.');
  add('111100002','爆发状态下点普攻。第2段电钻或第3段打桩时，可以连点或长按普攻延长；不规定必须按几下。','Tap Basic in Burst Mode. Tap repeatedly or hold during drill hit 2 or pile-driver hit 3 to extend it; there is no required tap count.');
  add('119100006','不用先普攻，能量足就能发动横扫。出招后可选直接接普攻第3段。','No prior Basic: use Tail Swipe with enough Energy, then optionally start at Basic hit 3.');
  add('119100007','常规入口：横扫后还有能量，再点强化特殊技打鲨卷风。之后可直接接普攻第3段。','Standard entry: after Tail Swipe, use EX again with remaining Energy. Afterwards Basic can start at hit 3 directly.');
  add('152100005','不必先普攻。强化特殊技结束后，可选直接接「吐信」第4段。','No Basic lead-in. After EX, Basic can enter hit 4 of the specified string directly.');
  add('156100005','风华至少90点时长按特殊技或长按普攻，选一种；不必先打若干段普攻。','With 90+ Windbloom, hold either Special or Basic. No preceding Basic hits are required.');
  add('159100004 159100005','不必等普攻打到末段。想保留凛冽枪尖的当前普攻段位，才从该普攻衔接此招；仍需满足本招的枪势与能量条件。','No need to finish the Basic string. Following the specified Basic preserves its hit count, but EX still requires its own stance and Energy.');
  add('137100007','长按普攻就是发动这招强化特殊技的输入，不是先打普攻再点强化特殊技；闪能不足不能发动。','With enough Adrenaline, hold Basic to perform this EX. Do not press EX after Basic.');
  add('148100003','有客诉时长按普攻就是发动「送客！」；不必先点普攻，更不用按强化特殊技键。','With Customer Complaint, hold Basic for this EX; no preceding Basic tap or separate EX button.');
  add('148100002','必须先出石头或剪刀才可点普攻打「猜拳把戏」，各最多两段。它不在布后发动，也不是下一拳的前置。','Optional after Rock or Scissors only: tap Basic for up to two hits each. This does not follow Paper and is not required for the next EX.');
  add('148100005 148100006','不必先普攻。此拳后可选点普攻接猜拳把戏，最多两段；也可不插普攻，8秒内直接点强化特殊技接下一拳。','No Basic required before this punch. Afterwards optionally use Basic for up to two hits, or skip Basic and use the next EX within 8 seconds.');
  add('148100007','不必先普攻。剪刀后8秒内点强化特殊技出布；布后不接猜拳把戏。','No Basic required. Use EX within 8 seconds of Scissors for Paper; Paper does not lead into the special Basic follow-up.');
  add('164100005','有1点升变即可按特殊技，不用先打普攻；出招后可点普攻直达第3段。','With one Ascension, use Special without a preceding Basic. During the move, optionally tap Basic to enter hit 3.');
  add('164100006 164100007','普攻放在强化特殊技之后。首段后若要续段且还有40能量，先在衔接窗口点按或长按强化特殊技，再点普攻接第3段；不续段则可直接接普攻第3段。','Basic comes after EX. For the second EX, use tap or hold EX in the first EX’s follow-up window with 40 remaining Energy, then tap Basic for hit 3. If skipping the second EX, tap Basic for hit 3 directly.');
add('158100007','常规路线不要求普攻：接战、浮晖120，放特殊技或强化特殊技后长按特殊技进转换姿态，再切出才进入相变时流。另一路线是满浮晖且特殊技或强化特殊技命中失衡敌人，在该招中切出。','Normal entry requires combat and 120 Floating Radiance: use Special or EX, hold Special for Stance Shift, then switch out for Phase Flow. Alternatively, at 120 Floating Radiance, switch during a Special or EX that hits a Stunned target.');
  add('105100002','按住普攻是蓄力，不是连点；最多蓄3段，松开才出锤。达到第2段后，出招再点普攻可直达碎惘沉击第3段；蓄3段时点普攻还可提前下砸。','Hold Basic to charge up to 3 levels, then release. At charge level 2+, tap Basic afterwards to continue at Basic hit 3. At level 3 a tap can bring the final smash forward.');
  add('161100002','猩红铭刻中点普攻打锻星。第3段连斩中，连点或长按普攻可延长；停点或松开就下砸。不是先点3次才开始连斩。','During Crimson Inscription use Basic for Starforging. During hit 3, tap repeatedly or hold Basic to extend the slash; stop or release to plunge.');
  const compact=s=>String(s||'').replace(/\s*【(普通攻击|特殊技|强化特殊技|闪避|切换|终结技)键】\s*/g,(_,k)=>k==='普通攻击'?'普攻键':k+'键').replace(/\[([^\]]+)\]/g,'$1').replace(/普通攻击/g,'普攻').trim();
  const compactEn=s=>String(s||'').replace(/\[([^\]]+)\]/g,'$1').trim();
  const part=(d,re)=>String(d||'').split(/[\n；;]/).map(s=>s.trim()).filter(s=>re.test(s));
  // If a definition carries its own real stage/entry cue beyond the activation
  // clause, preserve that clause instead of guessing a click count from hit count.
  function generalCue(desc,descEn,command,ctx){
    if(ctx)return pair('按条件自动触发或结算；这项本身不需要另按普攻。','This is a conditional effect, not an extra Basic input.');
    const zhLines=String(desc||'').trim().split(/\r?\n/),enLines=String(descEn||'').trim().split(/\r?\n/);
    const input=compact(command.zh),usesBasic=input.includes('普攻键');
    const plain=/^(点按|长按)普攻键[。！]?$/.exec(input);
    const maxHits=String(desc||'').match(/(?:至多|最多)([一二三四五六七八九\d]+)段(?:的)?(?:攻击|斩击|打击|突刺|射击|连击|挥击|连续|物理|火属性|冰属性|电属性)/);
    const number=s=>({一:1,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9}[s]||s);
    const chain=plain?.[1]==='点按'&&maxHits ? pair('点按普攻起手，这套连段最多'+number(maxHits[1])+'段。本步没有指定必须停在哪一段；若下一招有段位前置，按下一招要求衔接。','Tap Basic to start this string of up to '+number(maxHits[1])+' hits. This step sets no mandatory stopping hit. Use the next move’s required hit if it has one.') : null;
    // The English and Chinese descriptions come from the same localized skill
    // entry. Keep both pieces of a follow-up on the same line and gate.
    function followup(test){
      const n=zhLines.findIndex((l,i)=>i>0&&l.length<=240&&test(l)&&/Basic Attack|Basic input|Basic button/i.test(enLines[i]||''));
      return n>=0 ? pair(compact(zhLines[n]).replace(/[：；;:]$/,'。'),compactEn(enLines[n])) : null;
    }
    const ordinal=/(?:第[一二三四五六七八九0-9、/或和]+段|最后一段|前[三四五]段|蓄力(?:段数|等级))/;
    const extra=followup(l=>/(?:普通攻击|普攻)/.test(l)&&/(?:期间|过程中|发动时|后|第[一二三四五六七八九\d]+段中)/.test(l)&&/(?:可以|可直接|可衔接|可进入|可快速|可发动|可通过|可以延长|将发动)/.test(l)&&(/【普通攻击键】/.test(l)||ordinal.test(l)&&/衔接/.test(l))&&!/^(此时|期间|若此时)/.test(l));
    let cue;
    if(chain)cue=chain;
    else if(plain)cue=pair(plain[1]+'普攻就能发动本招，没有指定必须先打到哪一段。',plain[1]==='长按'?'Hold Basic to start this move. No preceding Basic hit number is specified.':'Tap Basic to start this move. No preceding Basic hit number is specified.');
    else if(usesBasic){
      // “或” in a resource threshold or in “tap or hold” does not make Basic optional.
      const alternatives=input.split('或'),hasOtherKey=s=>/(?:特殊技|闪避|切换|终结技)键/.test(s);
      const hasAlternateButton=alternatives.some(s=>s.includes('普攻键'))&&alternatives.some(s=>!s.includes('普攻键')&&hasOtherKey(s));
      if(hasAlternateButton)cue=pair('普攻是可选输入。满足所选入口的条件后，按上面这一条路线操作；走另一个入口时不用补按普攻。','Basic is an alternative input. Meet the selected entry’s conditions and use its input only; the other entry does not need an extra Basic.');
      else if(/点按或长按|长按或点按/.test(input))cue=pair('在上面指定的时机，点按或长按普攻都能发动本招，选一种。','At the indicated timing, either tap or hold Basic to perform this move. Choose one.');
      else if(input.includes('长按')||input.includes('按住'))cue=pair('使用长按路线时，要在上面指定的时机按住普攻，连续点按无法代替这次长按。','For the hold route, hold Basic at the stated timing. Repeated taps do not replace this hold.');
      else if(/点按|点击/.test(input))cue=pair('在上面指定的时机点一次普攻发动本招；这次点按本身不代表要再打一套普攻。','Tap Basic once at the given timing to perform this move. This tap does not require a new Basic string.');
      else cue=pair('按上面的时机输入普攻；前招若指定某一段，要等该段出现再接。','Use Basic at the indicated timing. If the lead-in names a specific hit, wait for it before following up.');
    }else if(/普攻/.test(input))cue=pair('普攻出现在前招或触发条件中。满足这条路线的条件后，发动本招用上面标出的按键，不用再补一次普攻。','Basic appears in the lead-in or trigger. Once that condition is met, use the listed activation input without adding another Basic.');
    else cue=pair('按上面的前招或资源条件发动本步，起手不用额外按普攻。','Follow the listed lead-in or resource condition. Starting this step needs no extra Basic input.');
    return extra?pair(cue.zh+' '+extra.zh,cue.en+' '+extra.en):cue;
  }
  const byAgent=new Map();
  function catalog(id) {
    if(byAgent.has(id))return byAgent.get(id);
    const p=knowledge.agents[id],m=new Map(),put=a=>{if(a?.skillRef||a?.id)m.set(String(a.skillRef||a.id),a);};
    Object.values(knowledge.foundationChoices?.[id]||{}).flat().forEach(put);
    Object.values(p.actions||{}).forEach(put);
    Object.values(p.actionChoices||{}).flat().forEach(put);
    (p.selectedSkillCatalog||[]).forEach(put);
    byAgent.set(id,m);return m;
  }
  const commandOverrides={
    '120100003':pair('长按普攻瞄准并松开发射；或在穿云第5段、特殊技、强化特殊技或连携技后长按特殊技立即发射。','Hold Basic to aim and release to fire; or hold Special after Basic hit 5, Special, EX or Chain to fire immediately.'),
    '154100009':pair('霜刑足够时：偏锋第5段、坠霜或重霜落地后，保持长按普攻或特殊技，选一个键发动。','With enough Trial by Cold, land Basic hit 5 or one of the two eligible Specials, then keep holding either Basic or Special.'),
    '131100007':pair('有和弦、队友通过指定支援或连携入场时，消耗25点能量自动追加震音；该震音视为强化特殊技，无需点普攻或强化特殊技。','When a teammate enters through an eligible Assist or Chain, a Chord and 25 Energy trigger an automatic follow-up counted as EX. Do not press Basic or EX for it.')
  };
  function build(id,branch,src,s){
    const ref=String(branch.skillRef),title=branch.title,desc=branch.description?.zh||src?.description||'',descEn=branch.description?.en||src?.descriptionEn||'';
    const known=foundationCommand(desc,ref);
    let en=part(descEn,/(?:Press|Hold|Tap|Release|input|automatically|trigger|switch|select|While|When|If)/i)[0]||s.input.en;
    let command=commandOverrides[ref]||pair(branch.command?.zh||known?.zh||s.input.zh,compactEn(en));
    // Some foundation summaries select only one valid entry. Keep alternatives
    // in the cue. Use a real activation sentence rather than an orphan preface.
    if(branch.command?.en && !/Source text is not yet available/.test(branch.command.en)&&!commandOverrides[ref])command=pair(command.zh,branch.command.en);
    if(command.en&&!/press|tap|release|hold|select|input|automatically|switch|dodge|assist/i.test(command.en)){
      const active=part(descEn,/press|tap|release|hold|select|input|automatically|switch/i)[0];
      if(active)command=pair(command.zh,compactEn(active));
    }
    let cue=notes.get(ref)||generalCue(desc,descEn,command,branch.context||known?.manual===false);
    if((ref==='117100007'||ref==='117100008')&&(knowledge.agents[id].selectedSkillCatalog||[]).some(x=>String(x.skillRef||x.id)==='117100009'))
      cue=pair(cue.zh+' 当前潜能还可在消耗1点流火的自动入场攻击后，直接点强化特殊技接双喷。',cue.en+' With the current Potential, the automatic switch-in attack that spends 1 Emberflow can also lead directly into double spray by tapping EX.');
    if(ref==='119100007' && (config.characters?.['1191']?.mindscape||0)>=2)
      cue=pair(cue.zh+' 当前已解锁2影：第三段急冻普攻之后也可直接接鲨卷风。',cue.en+' With M2 unlocked, Flash Freeze Trimming hit 3 also leads directly into Sharknami.');
    return {skillRef:ref,label:title,input:command,basicCue:cue};
  }
  for(const phase of phases)for(const s of phase.steps){
    const id=String(s.actorId),table=catalog(id);
    const bound=String(s.skillRef||String(s.actionId||'').match(/^agent-\d+-(\d+)(?:$|-)/)?.[1]||'');
    const list=s.actionBranches||[];
    const composite=!bound && /-foundation-(basic|ex|ultimate)-branches$/.test(s.actionId||'') && list.length>0;
    if(composite){
      const rows=list.filter(b=>!b.context && b.skillRef!=='131100007').map(b=>build(id,b,table.get(String(b.skillRef)),s));
      if(!rows.length)continue;
      // Match the requested category first (e.g. EX, not the ordinary Special).
      // This does not assume it is currently ready; its prerequisites stay visible.
      const preferred=knowledge.agents[id].actions?.[s.foundationKind]?.skillRef;
      let def=rows.findIndex(r=>r.skillRef===String(preferred));
      if(s.foundationKind==='ex'&&(def<0||!/^强化特殊技/.test(rows[def].label.zh)))def=rows.findIndex(r=>/^强化特殊技/.test(r.label.zh));
      if(def>0)rows.unshift(rows.splice(def,1)[0]);
      s.basicRoutes=rows;s.input=rows[0].input;s.basicCue=rows[0].basicCue;
      // A phase-specific gate can prefix this sentence: keep the actual gate,
      // remove only the instruction to open the old branch accordion.
      const old='展开对应招式核对完整条件；依赖前招、资源或提示的派生不能直接跳入。';
      if(s.trigger?.zh?.includes(old)) {
        const english='Check the selected skill’s full conditions below. Follow-ups that need a prior move, resource or prompt cannot be started directly.';
        s.trigger=pair(s.trigger.zh.replace(old,'按所选招式的资源、姿态与前招条件执行。'),s.trigger.en.replace(english,'Check the selected move’s resources, stance and lead-in.'));
      }
    }else if(bound){
      const a=table.get(bound),b=list.find(v=>String(v.skillRef)===bound)||{skillRef:bound,title:s.title,description:pair(a?.description||'',a?.descriptionEn||'')};
      if(!a&&!notes.has(bound)&&!commandOverrides[bound])continue;
      s.basicCue=build(id,b,a,s).basicCue;
      if(commandOverrides[bound] && !s.foundationSequence)s.input=commandOverrides[bound];
    }
  }
}

function compileRotationGuide(team,rawConfig,knowledge,abilityResults=[],compileExpertRotation,compileDedicatedRotation) {
  const config=rotationConfiguration(rawConfig,knowledge);
  if(!config)throw Error('Invalid rotation configuration');
  knowledge=rotationKnowledgeForPotential(knowledge,config);
  const B=(zh,en)=>({zh:String(zh||''),en:String(en||'Source text is not yet available in English.')});
  const field=(x,name)=>B(x?.[name],x?.[name+'En']);
  const ids=(team||[]).filter(Boolean).map(String);
  const profiles=ids.map(id=>Object.hasOwn(knowledge.agents,id)?knowledge.agents[id]:null).filter(Boolean);
  const name=(p,en=false)=>en?p.nameEn:p.name;
  const agents=profiles.map(p=>({id:p.id,name:p.name,nameEn:p.nameEn,icon:p.icon,rank:p.rank,signatureWeaponId:p.signatureWeaponId,potentialLevels:p.potentialLevels||[],roleLabel:B(p.role,p.roleEn)}));
  const view={agents,guide:null,actions:[],configNotes:[],personalPresetLabel:B('丹菲维 20 金示例','Dan / Phoenix / Velina · 20 gold')};
  if(ids.length!==3||profiles.length!==3||new Set(ids).size!==3){
    view.unavailableReason=B('从下方选择三名正式代理人，自动生成开局、循环和爆发方案。','Choose three released agents below to generate opening, loop and burst plans.');return view;
  }
  const gold=rotationGold(ids,config,knowledge);
  view.gold={...gold,label:B('原生限定 · 含转定制','Originally limited · includes Custom Search'),breakdown:gold.rows.map(r=>{
    const p=knowledge.agents[r.id];return B(`${p.name}：角色/影画 ${r.body} + 专武 ${r.weapon} = ${r.total} 金${r.pending?'，另有分类待确认':''}`,`${p.nameEn}: agent/Mindscapes ${r.body} + signature ${r.weapon} = ${r.total} gold${r.pending?'; classification incomplete':''}`);
  })};
  const roles={damage:new Set(['强攻','命破','锋御']),support:new Set(['支援','防护'])};
  const score=p=>(roles.damage.has(p.role)?40:p.role==='异常'?30:p.role==='击破'?15:5)+rotationBuild(config,p.id).mindscape/10;
  const authoredFocus=ROTATION_EXAMPLE_IDS.every(id=>ids.includes(id))?'1581':rotationDedicatedMatch(ids,knowledge)?.focusId;
  const autoFocus=profiles.find(p=>p.id===authoredFocus)||[...profiles].sort((a,b)=>score(b)-score(a)||ids.indexOf(a.id)-ids.indexOf(b.id))[0];
  const focus=profiles.find(p=>p.id===config.focusAgentId)||autoFocus;
  const other=profiles.filter(p=>p.id!==focus.id);
  const ordered=[...other].sort((a,b)=>(roles.support.has(a.role)?0:a.role==='击破'?1:2)-(roles.support.has(b.role)?0:b.role==='击破'?1:2));
  const stunners=profiles.filter(p=>p.role==='击破');
  const isExpert=ROTATION_EXAMPLE_IDS.every(id=>ids.includes(id));
  const effectiveStrategy=config.strategy==='auto'?(isExpert||stunners.length?'burst':'steady'):config.strategy;
  const anomalies=profiles.filter(p=>p.role==='异常');
  const distinctAnomalies=new Set(anomalies.flatMap(p=>(p.elementIds||[]).filter(id=>id!==300))).size>1;
  const sources=[],sourceIds=new Set();
  function addSource(id,label,url){if(url&&!sourceIds.has(id)){sourceIds.add(id);sources.push({id,label,url});}}
  for(const p of profiles){
    addSource(`agent-${p.id}`,B(`${p.name} · Gachabase ${p.source?.version||''}`,`${p.nameEn} · Gachabase ${p.source?.version||''}`),p.source?.url);
    const build=rotationBuild(config,p.id);
    if(build.potential>0){
      view.configNotes.push({text:B(`${p.name} · 潜能 ${build.potential} 阶`,`${p.nameEn} · Potential ${build.potential}`),reason:B('技能按所选潜能切换；加成仍须满足原文触发条件，不按上限直接计满。','Skills follow the selected Potential. Effects still require their stated conditions; caps are not granted automatically.')});
      for(const effect of p.potentialEffects||[])view.configNotes.push({text:field(effect,'name'),reason:field(effect,'description')});
    }
    const active=(p.cinema||[]).filter(c=>c.index<=build.mindscape&&!['3','5'].includes(String(c.index)));
    for(const c of active)view.configNotes.push({text:B(`${p.name} · ${c.index}影 ${c.name}`,`${p.nameEn} · M${c.index} ${c.nameEn}`),reason:field(c,'description')});
    if(build.signature&&p.signatureEngine){
      const e=p.signatureEngine,rank=e.refinements?.find(r=>r.level===build.signature);
      view.configNotes.push({text:B(`${p.name} · ${e.name} 叠影${build.signature}`,`${p.nameEn} · ${e.nameEn} R${build.signature}`),reason:rank?field(rank,'description'):B('按对应叠影的实际触发条件生效。','Apply the actual trigger requirements at the selected refinement.')});
      addSource(`engine-${e.id}`,B(e.name,e.nameEn),e.source?.url);
    }
  }
  const conditions=[B(`主要输出：${focus.name}；可在上方更改，自动建议不代表伤害排名。`,`Primary damage dealer: ${focus.nameEn}. You can change this above; the suggestion is not a damage ranking.`),
    B('核心 F；按实际能量、资源与敌人状态执行，尚未指定的驱动盘效果不计入。','Core F. Follow actual energy, resources and enemy state. Unspecified Drive Disc effects are not assumed.')];
  conditions.push(effectiveStrategy==='burst'?B('集中爆发：常态循环保留终结技，前置准备后在实际窗口按需使用。','Burst focus: reserve Ultimates during the regular loop, then optionally use them in an actual prepared window.'):B('稳妥循环：终结技已就绪且没有更近的好窗口时可按需使用，避免一直空等失衡。','Steady loop: optionally use ready Ultimates when no better window is imminent, rather than waiting indefinitely for Stun.'));
  if(ids.includes('1581'))conditions.push(B('丹的流明不能当作独立异常属性计入；转换及返场须满足实际姿态与站位条件。','Dan’s Lumiflux is not counted as an independent Anomaly Attribute. Conversion and re-entry require their actual stance and slot conditions.'));
  for(const result of abilityResults){if(result.status!=='active'){const p=knowledge.agents[result.agent.id];if(p&&!rotationBuild(config,p.id).potential)conditions.push(B(`${p.name}的额外能力${result.status==='inactive'?'未满足':'尚待确认'}，不要按该增益已生效执行。`,`${p.nameEn}'s Additional Ability is ${result.status==='inactive'?'inactive':'unconfirmed'}; do not assume its benefits are active.`));}}
  for(const p of profiles)if(rotationBuild(config,p.id).potential>0)conditions.push(B(`${p.name}已启用潜能：额外能力与新增追击按“配置影响”中的条件判断，不沿用未觉醒时的能力判定。`,`${p.nameEn} has Potential enabled: check Additional Ability and new follow-up conditions under Build effects; the unawakened ability check does not apply.`));
  if(!profiles.some(p=>roles.damage.has(p.role)||p.role==='异常'))conditions.push(B('当前没有典型输出位；这是功能队的试验轮换，不能据此保证危局分数。','No typical damage dealer is selected. This is an experimental utility-team rotation, not a score guarantee.'));
  if(profiles.filter(p=>roles.damage.has(p.role)).length>1)conditions.push(B('多名前台输出会争用窗口：本轮集中给主要输出，另一位按需要补状态，下一轮可切换主攻比较。','Several on-field damage dealers compete for the window. Concentrate this rotation on the selected primary; use the other for needed setup, or compare another focus next time.'));
  const actionNames=new Map();
  function actionStep(p,kind,slug,purpose,purposeEn,specific=null){
    const action=specific||p.actions[kind]||p.actions.special||p.actions.basic;
    if(!action)throw Error(`No reference action for ${p.id}`);
    const actionId=`agent-${p.id}-${action.skillRef}`;actionNames.set(actionId,{id:actionId,label:field(action,'name')});
    const step={id:slug,actorId:p.id,actionId,title:field(action,'name'),input:field(action,'trigger'),
      trigger:B(`确认当前满足招式前提；${action.trigger||'按技能原文条件发动。'}`,`Confirm its current prerequisites. ${action.triggerEn||'Follow the skill conditions.'}`),
      complete:B('该招式需要的命中和后续动作完成，且角色已允许切出，再交给下一位。','Finish its required hits and follow-up inputs; hand off once this agent can leave the field.'),
      reason:B(`${purpose}\n\n招式原文：${action.description||'详见下方角色来源。'}`,`${purposeEn}\n\nSkill text: ${action.descriptionEn||'See the agent source below.'}`),
      fallback:B('前置不满足就跳过本分支，选择当前姿态可用的动作补资源；被打断后重新检查，不从下一步盲接。','Skip this branch when its prerequisites are unmet. Use actions available in the current stance to recover resources; recheck state after an interruption.'),
      sourceRefs:[`agent-${p.id}`,action.skillRef],background:[],handoff:null,evidence:'mechanic-reference-plus-site-order'};
    return applyFoundationInputs(decorateFoundationAction(p,kind,step,specific,knowledge,B,actionNames),action,B);
  }
  function prepare(p,stage){
    const reason=roles.support.has(p.role)?B('先准备这名队员的增益/防护。参考招式不等于已触发全部辅助效果，按下面的机制条件核对。','Prepare this teammate’s buff or protection. Using this reference move does not prove every support effect is active; check the conditions below.'):
      p.role==='击破'?B('把击破准备安排在主要输出前；是否进入失衡以敌人实际状态为准。','Place Daze preparation before the primary’s window; actual enemy state determines Stun.'):
      B('为主要输出补充状态或资源，避免两名输出无目的地交替站场。','Prepare complementary states or resources rather than alternating damage dealers without a purpose.');
    const s=actionStep(p,'ex',`${stage}-${p.id}-prepare`,reason.zh,reason.en);
    const core=p.facts.find(f=>f.kind==='coreReference');
    if(core&&!s.actionBranches?.length)s.reason=B(`${s.reason.zh}\n\n核心条件：${core.text}`,`${s.reason.en}\n\nCore conditions: ${core.textEn||'Read the linked source; the English condition is unavailable.'}`);
    if(p.id==='1011'&&!s.actionBranches?.length){
      s.input=B('普攻第三段或落雷 → 强化特殊技：苍雷斩','Basic Attack hit 3 or Thunderbolt → EX: Lightning Bolt');
      s.trigger=B('能量足够，且已完成普攻第三段或落雷。','Enough energy, after Basic hit 3 or Thunderbolt.');
      s.reason=B('衔接能更快发动苍雷斩，并满足安比核心的失衡增益条件。','This follow-up speeds up Lightning Bolt and meets Anby’s Core Passive Daze condition.');
    }
    return s;
  }
  function addRegularHandoffs(steps){
    steps=expandFoundationSequences(steps,knowledge,B,actionNames);
    for(let i=0;i<steps.length-1;i++)if(steps[i].actorId!==steps[i+1].actorId&&!steps[i].handoff){
      steps[i].handoff={toId:steps[i+1].actorId,kind:'normal',signal:B('完整完成当前招式并确认可切人后，普通换人。此处不视为快速支援。','Complete the current move and confirm switching is allowed, then switch normally. This is not treated as Quick Assist.')};
    }
    return steps;
  }
  function preparationSteps(p,stage){
    const result=[prepare(p,stage)];
    if(p.id==='1131'){
      const flag=knowledge.curatedActions?.['113100005']||(p.actionChoices.special||[]).find(a=>a.id==='113100005');
      if(flag){const s=actionStep(p,'special',`${stage}-1131-flag`,'展旗才是攻击增益与传递的关键，不能把积涡流的强化特殊技当作已完成传递。三层涡流是强化条件，不是基础展旗的必要条件。','Fly the Flag applies the ATK buff and enables its transfer; the EX that builds Vortex does not transfer it by itself. Three Vortex stacks strengthen the buff but are not required for base Fly the Flag.',flag);s.handoff={toId:null,kind:'quick-prompt',signal:B('展旗命中出现快支提示后，按提示接手；该增益仅传给通过对应快支/连携入场者。','After Fly the Flag hits and the Quick Assist prompt appears, respond to it. Only an agent entering through the matching Quick Assist/Chain receives this transferred buff.')};result.push(s);}
    }
    if(p.id==='1271'&&knowledge.curatedActions?.['127100002']){
      result.push(actionStep(p,'basic',`${stage}-1271-resolve`,'强化特殊技先积意气；意气足够时用长普的终结一击触发上一位快支，普通切人不会代替这个传递。','Build Resolve with EX first. With enough Resolve, the finishing hit of the held Basic triggers the previous-slot Quick Assist; a normal switch does not replace that transfer.',knowledge.curatedActions['127100002']));
    }
    if(p.id==='1251'&&knowledge.curatedActions?.['125100004']){
      result.push(actionStep(p,'basic',`${stage}-1251-voltage`,'只有闪络电压达到招式要求时才接长按普攻；用实际积蓄判断，不假定前一招已经攒满。','Use the held Basic only when Flash Connect Voltage meets its requirement; the preceding move is not assumed to fill it.',knowledge.curatedActions['125100004']));
    }
    for(const step of [...result]){
      if(step.actionBranches?.length)continue; // Branch selection does not guarantee any one skill's assist.
      const fact=p.facts.find(f=>f.kind==='quickAssistTrigger'&&step.sourceRefs.includes(f.skillRef));
      if(!fact||step.handoff)continue;
      if(!['previous','next'].includes(fact.direction)){
        step.handoff={toId:null,kind:'quick-prompt',signal:B('实际出现快支提示时按提示接手；对象未由当前资料固定，不把普通切人当作快支触发。','Respond to the actual Quick Assist prompt. Its target is not fixed by the current source; normal switching does not count as Quick Assist.')};continue;
      }
      const target=profiles[(ids.indexOf(p.id)+(fact.direction==='previous'?2:1))%3];
      step.handoff={toId:target.id,kind:'quick',signal:B(`招式满足触发条件并出现提示后，快速支援接${target.name}（${fact.direction==='previous'?'上一位':'下一位'}）。`,`After this move meets its trigger and shows the prompt, Quick Assist into ${target.nameEn} (${fact.direction}).`)};
      const q=actionStep(target,'quickAssist',`${stage}-${p.id}-assist-${target.id}`,'这是上一招触发的快速支援接手，不是任意普通换人。','This responds to the preceding move’s Quick Assist, not an arbitrary normal switch.');
      q.input=B('在对应快速支援提示出现时，按支援键接手。','Press Assist when the corresponding Quick Assist prompt appears.');
      q.trigger=B(fact.text,fact.textEn||'The previous move must trigger the matching Quick Assist prompt.');
      q.complete=B('确认目标角色已通过该提示入场，再继续当前状态下的动作。','Confirm the target entered through that prompt before continuing with actions available in the current state.');
      q.sourceRefs.push(`agent-${p.id}`,fact.skillRef);
      if(p.id==='1421'){
        q.background=[{actorId:p.id,kind:'overlap',label:B('破劲自动攻击 · 尚未结束时','Automatic Break Force attacks · while still ongoing')}];
        q.reason=B(`该次快支接手者是${target.name}，不能把通窍自动归给${focus.name}。潘仍有破劲时会在换人后继续自动攻击。`,`This Quick Assist recipient is ${target.nameEn}; do not automatically credit Meridian Flow to ${focus.nameEn}. Pan continues automatic attacks after switching while Break Force remains.`);
      }
      result.splice(result.indexOf(step)+1,0,q);
    }
    return result;
  }
  const start=ordered.flatMap(p=>preparationSteps(p,'opening'));
  start.push(actionStep(focus,'basic',`opening-${focus.id}-build`,'主要输出先确认资源和攻击分支，再开始第一轮。','Confirm the primary’s resources and attack branch before the first rotation.'));
  start.push(actionStep(focus,'ex',`opening-${focus.id}-ex`,'只有满足本招条件时才发动；开局不把所有终结技强行塞进流程。','Use this only with its prerequisites met; do not force every Ultimate into the opening.'));
  const loop=ordered.flatMap(p=>preparationSteps(p,'loop'));
  if(anomalies.length>=2){
    loop.forEach(s=>{if(knowledge.agents[s.actorId].role==='异常')s.reason=B(`${distinctAnomalies?'异属性异常队：先观察已有异常，再决定下一次覆盖与紊乱机会。':ids.includes('1581')?'含流明转换：观察实际施加的异常，不凭角色面板元素假定紊乱。':'同属性异常协作：不要期待同一属性自动触发紊乱。'}\n${s.reason.zh}`,`${distinctAnomalies?'Multi-attribute Anomaly team: observe the existing Anomaly before replacing it or creating Disorder.':ids.includes('1581')?'Lumiflux conversion: observe the applied Anomaly instead of inferring Disorder from the profile Attribute.':'Same-attribute Anomaly team: do not expect the same Attribute to automatically trigger Disorder.'}\n${s.reason.en}`);});
  }
  if(focus.id==='1611'){
    const action=knowledge.curatedActions['161100002'];
    const s=actionStep(focus,'basic','loop-1611-inscription','进入猩红铭刻后用锻星；姿态结束才返回开局的铸锋秘术。伏钺还需要特殊技先触发毁伤，不能只打锻星就硬接。','Use Starforging in Crimson Inscription. Return to Secret Forging Techniques only after the state ends. Subduing Axe additionally requires Maim from a qualifying Special; Starforging alone is insufficient.',action);
    s.fallback=B('尚未进入猩红铭刻时，先按锐能条件发动铸锋秘术；不在当前姿态时不要硬接锻星。','Outside Crimson Inscription, first meet Sharpness requirements and activate Secret Forging Techniques. Do not force Starforging outside its stance.');loop.push(s);
  }else{
    loop.push(actionStep(focus,'basic',`loop-${focus.id}-build`,'补足主要输出的实际资源；不假定打一套普攻就必然攒满。','Build the primary’s actual resource; a single Basic string is not assumed to fill it.'));
    loop.push(actionStep(focus,'ex',`loop-${focus.id}-ex`,'在前置状态仍有效时处理本轮输出，结束后重新检查资源。','Execute this rotation while required states remain active, then reassess resources.'));
  }
  if(effectiveStrategy==='steady'&&focus.actions.ultimate){const s=actionStep(focus,'ultimate',`loop-${focus.id}-ultimate`,'稳妥路线：就绪且目标适合命中时按需使用；若很快有更好的窗口，可以保留。','Steady route: optionally use when ready and the target is hittable; save it if a better window is imminent.');s.trigger=B(`终结技已经就绪，且你决定本轮使用。${s.trigger.zh}`,`Ultimate is ready and you choose to use it this rotation. ${s.trigger.en}`);loop.push(s);}
  const burst=ordered.flatMap(p=>preparationSteps(p,'burst-prep'));
  const hit=actionStep(focus,'ex',`burst-${focus.id}-ex`,'先把必要资源/增益放在窗口前准备；窗口内集中处理主要输出，别回头补一长串辅助。','Prepare necessary resources and buffs before the window; concentrate on the primary inside it instead of starting a long support setup.',focus.id==='1611'?knowledge.curatedActions['161100006']:null);
  if(focus.id==='1611')hit.fallback=B('未铭刻先满足锐能并发动铸锋秘术；已铭刻但残痕不足先用锻星。完成对应特殊技并确实触发毁伤后才可接伏钺。','If outside Inscription, meet Sharpness requirements and activate Secret Forging Techniques. If inside but short of Blood Scars, use Starforging. Subduing Axe is only available after a qualifying Special actually triggers Maim.');
  hit.trigger=B(`实际可输出窗口已出现。${hit.trigger.zh}`,`An actual damage window exists. ${hit.trigger.en}`);burst.push(hit);
  if(focus.actions.ultimate){const s=actionStep(focus,'ultimate',`burst-${focus.id}-ultimate`,'仅在终结技已经就绪且前置满足时使用；本顺序是基础编排，不代表与其他招式的最优先后。','Only use a ready Ultimate with its prerequisites met. This is a basic ordering, not a verified optimal placement against every other move.');s.trigger=B(`终结技就绪，目标可命中，当前窗口仍未结束。${s.trigger.zh}`,`Ultimate ready; the target is hittable and the window remains open. ${s.trigger.en}`);burst.push(s);}
  const prep=[B('确认资源够用；不要把普通特殊技当成强化特殊技。','Check resources; a normal Special is not an EX Special.'),B('确认增益真正触发且没有过期；普通换人不会代替快支/连携条件。','Confirm buffs actually triggered and remain active; a normal switch does not satisfy Quick Assist or Chain conditions.')];
  let phases=[{id:'opening',label:B('开局','Opening'),objective:B('准备前置，进入第一轮输出。','Prepare prerequisites and enter the first damage cycle.'),prep,steps:addRegularHandoffs(start)},
    {id:'loop',label:B('常态循环','Regular loop'),objective:anomalies.length>=2?B('围绕异常与资源交接，不等一个假定的固定失衡时间。','Cycle around actual Anomalies and resources, without assuming a fixed Stun timer.'):B('补关键状态，把主要输出的等待时间留给队友准备。','Refresh key states and use the primary’s downtime for teammate setup.'),prep:[],steps:addRegularHandoffs(loop),repeat:B('重新检查资源和增益，再决定下一轮；开局赠送资源不会重复发放。','Recheck resources and buffs before the next cycle. One-time opening grants do not repeat.')},
    {id:'burst',label:B('爆发窗口','Burst window'),objective:B(stunners.length?'失衡前准备 → 实际失衡后集中兑现。':'有实际输出机会再集中兑现；不保证这支队伍固定打出失衡。',stunners.length?'Prepare before Stun, then cash out in the actual window.':'Cash out in an actual opportunity; this team is not assumed to guarantee regular Stun.'),prep,steps:addRegularHandoffs(burst)}];
  let coverage=B('角色机制基础方案','Mechanics-based foundation');
  let coverageDescription=B('已按所选角色、主要输出与队伍结构生成。未收录的提前切人节点按完整招式后换人处理；这不是该组合实测最优轴。','Generated for these agents, your focus and team structure. Unverified early-switch points fall back to finishing the move. This is not a tested optimal rotation for this combination.');
  let positionKind='foundation',positionNotes=[];
  if(isExpert){
    const expert=compileExpertRotation(config,knowledge,focus.id,B,ids);
    positionKind=expert.positionAdapted?'adapted':'authored';positionNotes=expert.positionNotes;
    phases=expert.phases;
    for(const item of expert.actions)actionNames.set(item.id,item);
    coverage=B('角色机制＋作者组合教学','Mechanics + authored team guide');
    coverageDescription=B('命中丹／菲欧妮／维琳娜专用规则，加入白闪切人、焚罪合轴与爆发分配；秒数及最高分未实测。','Matched the Dan / Phoenix / Velina rules: white-flash handoff, Purifying Flame overlap and burst allocation. Exact timing and maximum score are unmeasured.');
    for(const s of knowledge.expertRules.danPhoenixVelina.authorSources)addSource(s.id,B(s.author+' · 组合教学',s.author+' · team guide'),s.url);
  }
  const dedicated=compileDedicatedRotation?.(ids,focus.id,config,knowledge,B);
  if(dedicated?.eligible){
    phases=dedicated.phases;
    positionKind=dedicated.positionAdapted?'adapted':'authored';positionNotes=dedicated.positionNotes;
    for(const item of dedicated.actions)actionNames.set(item.id,item);
    for(const source of dedicated.sources)addSource(source.id,source.label,source.url);
    conditions.push(...dedicated.conditions);
    coverage=B('专用教学 · '+dedicated.title.zh,'Dedicated lesson · '+dedicated.title.en);
    coverageDescription=dedicated.summary;
  }else if(dedicated?.hint){conditions.push(dedicated.hint);}
  if(positionKind==='adapted'){coverage=B('站位适配 · 机制推导','Formation variant · mechanics-derived');coverageDescription=B('保留本队的资源和输出依赖，按当前站位改写接棒；不同于原作者原站位教学，未实测最优伤害。','Retains this team’s resource and damage dependencies while adapting its handoffs to the current slots. This differs from the authored formation and is not a tested optimum.');}
  if(positionKind==='foundation') applyFoundationBasics(phases,knowledge,config);
  const usedActionIds=new Set(phases.flatMap(p=>p.steps.map(s=>s.actionId)));
  view.actions=[...actionNames.values()].filter(a=>usedActionIds.has(a.id));
  addSource('tutorial-main',B('凯诺 · 合轴与排轴教程','Kaino · action overlap and rotation tutorial'),'https://www.bilibili.com/video/BV1i5KU6UES9/');
  addSource('tutorial-safe',B('observateur · 合轴安全边界','observateur · overlap safety boundaries'),'https://www.miyoushe.com/zzz/article/61188722');
  view.guide={id:`knowledge-${ids.join('-')}`,title:B('合轴与排轴','Action overlap & rotation'),recommendedFocusId:autoFocus.id,mechanicReferencesVerified:true,rotationValidated:false,
    validationText:B('按事件看操作；格宽不是秒数。前台动作与已收录的后台延续分开显示。','Read actions by event; column width is not time. On-field actions and documented continuations are shown separately.'),
    coverage:{label:coverage,description:coverageDescription},conditions,phases,sources,
    lessons:[{title:B('先排依赖，再压缩空转','Order dependencies, then reduce downtime'),body:B('先准备资源和增益，再安排受益攻击；只有确认某招允许脱手，才让另一人同时准备。','Prepare resources and buffs before the attacks that need them. Overlap teammate setup only after a move has a confirmed handoff.')},
      {title:B('看切人信号，不只记按键','Watch the handoff cue'),body:B('普通换人、快速支援、连携分别核对；切早可能丢关键命中，不能把每个长动作都当可合轴。','Check normal switches, Quick Assists and Chains separately. Switching early can lose a key hit; not every long animation supports overlap.')},
      {title:B('录一轮，再调整','Review a recorded rotation'),body:B('看实际敌人动作、能量断点和漏掉的增益，再改资源准备和输出窗口；金数本身不等于最佳站场人选。','Review enemy behavior, resource gaps and missed buffs, then adjust setup and damage windows. Gold count alone does not determine the best on-field agent.')} ]};
  return attachRotationPosition(view,ids,knowledge,B,positionKind,positionNotes);
}

/**
 * Read-only Chinese presentation aliases for the rotation workspace.
 * Names are classified by the verified skill-name prefix, never action.kind:
 * an EX-class skill may use a held Basic or a resource other than Energy.
 * Inputs, thresholds, action IDs, event order and all English remain unchanged.
 */
function createRotationPlainTerms(knowledge, config = {}, teamIds = []) {
  const ids = [...new Set(teamIds.map(String))].filter(id => knowledge?.agents?.[id]);
  const profiles = new Map(ids.map(id => {
    const base = knowledge.agents[id], rank = config.characters?.[id]?.potential;
    const patch = Number.isInteger(rank) && rank > 0 ? knowledge.potentialProfiles?.[id]?.[rank] : null;
    return [id, patch ? {...base, ...patch} : base];
  }));
  const groups = new Map(), allSkills = new Map();
  const prefixes = new Map([
    ['普通攻击', '普攻'], ['特殊技', '特殊技'], ['强化特殊技', '强化特殊技'],
    ['终结技', '终结技'], ['连携技', '连携技'], ['快速支援', '快速支援'],
    ['招架支援', '招架支援'], ['回避支援', '回避支援'], ['支援突击', '支援突击'],
    ['闪避反击', '闪避反击'], ['冲刺攻击', '冲刺攻击'], ['闪避', '闪避']
  ]);
  // Exact reviewed exceptions. The input explanation is grounded in each skill
  // description; keeping separate EX branches avoids losing resource conditions.
  const overrides = {
    '158100001': ['普通攻击：蹁跹', '点按普攻'],
    '158100002': ['普通攻击：独舞', '长按普攻·独舞'],
    '158100003': ['普通攻击：垂虹', '长按普攻·消耗虚曜'],
    '158100004': ['普通攻击：惊鸿', '强化长按普攻·惊鸿'],
    '158100005': ['特殊技：薄明', '特殊技'],
    '158100006': ['强化特殊技：曙色颂', '强化特殊技'],
    '158100007': ['特殊技：曙色颂·转辉', '长按特殊技·转姿态'],
    '158100017': ['支援技：花羽轮舞', '返场支援攻击'],
    '164100002': ['普通攻击：焚罪', '长按普攻·消耗燔焰'],
    '164100003': ['普通攻击：熔毁', '特殊技后接普攻·熔毁'],
    '164100005': ['强化特殊技：燎斩', '强化特殊技·消耗升变'],
    '164100006': ['强化特殊技：眩焰', '强化特殊技·起手'],
    '164100007': ['强化特殊技：坠阳', '强化特殊技·续段'],
    '156100003': ['强化特殊技：风切变·扬清', '强化特殊技·起手'],
    '156100004': ['强化特殊技：风切变·三重绝息', '强化特殊技·续段'],
    '156100005': ['强化特殊技：风切变·风暴眼', '强化特殊技·长按分支（风暴眼）'],
    '148100002': ['普通攻击：猜拳把戏', '石头／剪刀后接普攻'],
    '148100003': ['强化特殊技：送客！', '强化特殊技·送客（长按普攻）'],
    '148100005': ['强化特殊技：石头', '强化特殊技·石头'],
    '148100006': ['强化特殊技：剪刀', '强化特殊技·剪刀'],
    '148100007': ['强化特殊技：布！', '强化特殊技·布']
  };
  function addSkill(id, skill) {
    if (!skill || typeof skill.name !== 'string') return;
    const skillRef = String(skill.skillRef || skill.id || '');
    const key = id + ':' + skillRef + ':' + skill.name;
    if (!allSkills.has(key)) allSkills.set(key, {agentId: id, skillRef, name: skill.name, description: skill.description || ''});
  }
  for (const [id, profile] of profiles) {
    for (const actions of Object.values(profile.actionChoices || {})) for (const action of actions || []) addSkill(id, action);
    for (const action of Object.values(profile.actions || {})) addSkill(id, action);
    for (const action of profile.potentialEffects || []) addSkill(id, action);
    // Curated and recovery projections must not overwrite a selected Potential
    // skill with the base version sharing its ID.
    const found = new Set([...allSkills.values()].filter(s => s.agentId === id).map(s => s.skillRef));
    for (const source of [knowledge.curatedActions, knowledge.positionSkills]) {
      for (const [ref, skill] of Object.entries(source || {})) {
        if (String(ref).startsWith(id) && !found.has(String(ref))) { addSkill(id, skill); found.add(String(ref)); }
      }
    }
    for (const rule of Object.values(knowledge.expertRules || {})) {
      for (const move of rule.mechanicsActions || []) {
        const ref = String(move.skillId || '');
        if (String(move.agentId) === id && !found.has(ref)) {
          addSkill(id, {id:ref, name:move.title}); found.add(ref);
        }
      }
    }
  }
  for (const skill of allSkills.values()) {
    const match = skill.name.match(/^([^：:]+)[：:](.+)$/);
    if (!match || !prefixes.has(match[1])) continue;
    const key = skill.agentId + ':' + match[1];
    if (!groups.has(key)) groups.set(key, new Set());
    groups.get(key).add(skill.name);
  }
  // Lookup for the expandable game names is keyed by (agent, skill ID). It is
  // deliberately separate from the alias matcher: lesson wording, citations
  // and names appearing in explanatory prose are not proof a move is cast.
  const originalsByAgent = new Map();
  for (const [id, profile] of profiles) {
    const names = new Map();
    const put = (item, ref, name = item?.name, en = item?.nameEn) => {
      ref = String(ref || item?.skillRef || item?.id || '');
      if (!ref.startsWith(id) || !name) return;
      names.set(ref, {skillRef:ref, name, nameEn:en || name});
    };
    if (!profile.selectedSkillCatalog) {
      for (const rule of Object.values(knowledge.expertRules || {}))
        for (const item of rule.mechanicsActions || [])
          if (String(item.agentId) === id) put(item, item.skillId, item.title, item.titleEn);
      for (const source of [knowledge.curatedActions, knowledge.foundationActions, knowledge.positionSkills, knowledge.dedicatedActions])
        for (const [ref, item] of Object.entries(source || {})) if (ref.startsWith(id)) put(item,ref);
      for (const list of Object.values(knowledge.foundationChoices?.[id] || {}))
        for (const item of list || []) put(item);
    }
    for (const item of Object.values(profile.actions || {})) put(item);
    for (const list of Object.values(profile.actionChoices || {})) for (const item of list || []) put(item);
    for (const item of profile.potentialEffects || []) put(item);
    for (const item of profile.selectedSkillCatalog || []) put(item);
    originalsByAgent.set(id,names);
  }
  function originalsFor(step) {
    const table = originalsByAgent.get(String(step?.actorId));
    if (!table) return [];
    if(step.displaySkillParts?.length) return step.displaySkillParts.flatMap(part=>{
      const name=table.get(part.skillRef) || (part.name?part:null);
      return name ? [{skillRef:part.skillRef,role:part.role,name:name.name,nameEn:name.nameEn||name.name}] : [];
    });
    const refs = new Map();
    const include = (ref, role='primary') => {
      ref=String(ref || '');
      if (ref && !refs.has(ref)) refs.set(ref, role);
    };
    // Older single-action foundation cards encoded the direct reference in the
    // action ID. Never use sourceRefs: it also cites other agents and states.
    const oldId = String(step.actionId || '').match(/^agent-(\d+)-(\d+)(?:-|$)/);
    include(step.skillRef || (oldId?.[1] === String(step.actorId) ? oldId[2] : ''));
    for (const ref of step.alternateSkillRefs || []) include(ref,'choice');
    for (const ref of step.followupSkillRefs || []) include(ref,'followup');
    for (const b of step.actionBranches || []) include(b.skillRef,b.context?'context':'choice');
    return [...refs].flatMap(([ref, role])=>{
      const skill=table.get(ref);
      if (skill) return [{...skill,role}];
      // A verified branch carries the actual selected-rank names itself.
      const branch=step.actionBranches?.find(b=>String(b.skillRef)===ref);
      return branch?.title?.zh ? [{skillRef:ref,name:branch.title.zh,nameEn:branch.title.en||branch.title.zh,role}] : [];
    });
  }
  const entries = [];
  function add(original, alias, agentId, skillRef = '', kind = 'skill') {
    if (!original || original === alias) return;
    if (!entries.some(e => e.original === original && e.alias === alias && e.agentId === agentId))
      entries.push({original, alias, short: alias, agentId, skillRef, kind});
  }
  for (const skill of allSkills.values()) {
    const reviewed = overrides[skill.skillRef];
    if (reviewed && reviewed[0] === skill.name) {
      add(skill.name, reviewed[1], skill.agentId, skill.skillRef); continue;
    }
    const match = skill.name.match(/^([^：:]+)[：:](.+)$/);
    if (!match || !prefixes.has(match[1])) continue;
    const category = prefixes.get(match[1]);
    const count = groups.get(skill.agentId + ':' + match[1])?.size || 0;
    // One verified name in the category: the action category suffices. Multiple
    // distinct branches: preserve their distinguishing names instead of guessing.
    add(skill.name, count === 1 ? category : category + '·' + match[2], skill.agentId, skill.skillRef);
  }
  // Authored lessons also mention short skill names inside ordinary sentences.
  // Only these individually reviewed names are replaced there, not every suffix.
  const bare = [
    ['1581', '158100007', '曙色颂·转辉', '长按特殊技·转姿态'],
    ['1581', '158100007', '转辉', '长按特殊技·转姿态'],
    ['1581', '158100006', '曙色颂', '强化特殊技'],
    ['1581', '158100003', '垂虹', '长按普攻·消耗虚曜'],
    ['1581', '158100004', '惊鸿', '强化长按普攻·惊鸿'],
    ['1581', '158100017', '花羽轮舞', '返场支援攻击'],
    ['1641', '164100005', '燎斩', '强化特殊技·消耗升变'],
    ['1641', '164100006', '眩焰', '强化特殊技·起手'],
    ['1641', '164100007', '坠阳', '强化特殊技·续段'],
    ['1641', '164100002', '焚罪', '长按普攻·消耗燔焰'],
    ['1641', '164100004', '掠火', '特殊技'],
    ['1641', '164100003', '熔毁', '特殊技后接普攻·熔毁'],
    ['1561', '156100003', '风切变·扬清', '强化特殊技·起手'],
    ['1561', '156100003', '扬清', '强化特殊技·起手'],
    ['1561', '156100004', '风切变·三重绝息', '强化特殊技·续段'],
    ['1561', '156100004', '三重绝息', '强化特殊技·续段'],
    ['1561', '156100005', '风切变·风暴眼', '长按特殊技／普攻·风暴眼'],
    ['1561', '156100005', '风暴眼', '长按特殊技／普攻·风暴眼']
  ];
  for (const [id, ref, original, alias] of bare) {
    const skill = [...allSkills.values()].find(s => s.agentId === id && s.skillRef === ref);
    if (skill && skill.name.includes(original)) add(original, alias, id, ref);
  }
  // Dedicated resources stay named in prose to keep phrases and thresholds
  // natural. Their explanations are offered next to the first instruction that needs them, not rewritten
  // into ordinary Energy or an assumed UI bar/color/location.
  const resources = [
    ['1201','电囚','悠真叠在目标身上的层数'], ['1251','闪络电压','青衣造成电属性伤害时积攒的资源'],
    ['1261','狂热心流','简在狂热状态下会消耗的资源'], ['1321','燎火','伊芙琳长按普攻或特殊技时可消耗的资源'],
    ['1381','白雷','零号·安比叠在目标身上的层数'], ['1481','客诉','琉音长按普攻抱拳时消耗的点数'],
    ['1501','全场应援','爱芮蓄力时可消耗的效果层数'], ['1541','霜刑','普罗米娅由寒蚀值转化的点数'],
    ['1541','寒誓','普罗米娅终结技获得、可用于衔接特殊技的效果'], ['1551','日珥','佩洛伊斯的专属资源'],
    ['1611','锐能','克拉蕾发动强化特殊技所需的资源'], ['1631','流息','赛维里安的专属资源'],
    ['1091','落霜','雅的蓄力普攻资源'], ['1131','涡流','苍角展旗时可消耗的资源'],
    ['1161','士气','莱特的专属资源'], ['1171','燃点','柏妮思用普通能量积攒的资源'],
    ['1181','电能','格莉丝累积的层数'], ['1191','急冻充能','艾莲强化普攻消耗的资源'],
    ['1241','强化霰弹','朱鸢压制攻击使用的弹药'], ['1271','意气','赛斯的专属资源'],
    ['1301','蓄炎','奥菲丝的专属资源'], ['1321','燎索点','伊芙琳发动自身连携技可消耗的点数'],
    ['1331','飞羽','薇薇安的专属资源'], ['1341','霜寒值','照开启帷幕时消耗的资源'],
    ['1361','绝意','扳机的专属资源'], ['1371','术法值','仪玄消耗闪能时积累的资源'],
    ['1371','玄墨值','仪玄的专属资源'], ['1391','威势','橘福福的专属点数'], ['1391','威风','橘福福的专属点数'],
    ['1401','剑仪','爱丽丝的专属资源'], ['1411','甜度点','柚叶的专属资源'], ['1431','青溟剑势','叶瞬光积攒的点数'],
    ['1451','梦境值','卢西娅进入梦境所需的资源'], ['1461','钢能','席德的专属资源'],
    ['1471','嗔火','般岳的专属资源'], ['1481','好评','琉音的专属点数'],
    ['1501','应援能量','爱芮在场上生成的资源'], ['1511','颤音','南宫羽叠在敌人身上的层数'],
    ['1531','决意','星徽·比利的专属资源'], ['1541','寒蚀值','普罗米娅的专属资源'],
    ['1571','预热膛温','诺姆的专属资源'], ['1611','残痕值','克拉蕾在敌人身上积攒的数值，满后叠一层残痕'], ['1611','残痕','克拉蕾施加在敌人身上的层数'],
    ['1621','风能','洛克茜积攒的点数'], ['1581', '浮晖', '丹转换姿态前要攒满的资源'], ['1581', '虚曜', '丹长按普攻可以消耗的储存资源'],
    ['1641', '燔焰', '菲欧妮的专属资源'], ['1641', '升变', '菲欧妮施放强化特殊技·燎斩消耗的资源'],
    ['1561', '风华', '维琳娜的专属资源']
  ];
  for (const [id, original, alias] of resources) if (profiles.has(id)) add(original, alias, id, '', 'resource');
  const byOriginal = new Map();
  for (const entry of entries) {
    if (!byOriginal.has(entry.original)) byOriginal.set(entry.original, []);
    byOriginal.get(entry.original).push(entry);
  }
  const escape = input => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matcher = byOriginal.size ? new RegExp([...byOriginal.keys()].sort((a, b) => b.length - a.length).map(escape).join('|'), 'g') : null;
  function resolve(original, actorId) {
    const candidates = byOriginal.get(original) || [];
    const own = candidates.filter(e => e.agentId === String(actorId || ''));
    const selected = own.length ? own : candidates;
    return new Set(selected.map(e => e.alias)).size === 1 ? selected[0] : null;
  }
  function rewrite(input, actorId) {
    if (!matcher || typeof input !== 'string') return input;
    // One pass: aliases are never recursively replaced, so generated labels
    // containing the original term cannot grow on their own within this call.
    return input.replace(matcher, original => {
      const entry = resolve(original, actorId);
      return entry && entry.kind !== 'resource' ? entry.alias : original;
    });
  }
  function text(item, actorId) {
    if (typeof item === 'string') return rewrite(item, actorId);
    if (item && typeof item === 'object' && typeof item.zh === 'string') return {...item, zh: rewrite(item.zh, actorId)};
    return item;
  }
  function entriesFor(step) {
    const parts = [];
    const gather = value => {
      if (typeof value === 'string') parts.push(value);
      else if (Array.isArray(value)) value.forEach(gather);
      else if (value && typeof value === 'object') {
        if (typeof value.zh === 'string') parts.push(value.zh);
        else for (const [key, item] of Object.entries(value)) if (!['sourceRefs','evidence','actionId','id'].includes(key)) gather(item);
      }
    };
    gather(step);
    const found = new Map();
    if (matcher) for (const part of parts) for (const match of part.matchAll(matcher)) {
      const entry = resolve(match[0], step?.actorId);
      if (entry) found.set(entry.agentId + ':' + entry.original, {...entry});
    }
    return [...found.values()];
  }
  function firstResources(phaseSteps, index) {
    const glossary=entries.filter(e=>e.kind==='resource').concat([
      {original:'喧响',short:'释放通常的终结技所需的资源，与普通能量分开'},
      {original:'支援点',short:'招架或回避支援所消耗的队伍点数'},
      {original:'闪能',short:'命破代理人使用的技能资源，与普通能量分开'}
    ]), seen=new Set();
    const synonyms={'闪络电压':['电压'],'青溟剑势':['剑势'],'狂热心流':['心流'],'甜度点':['甜度']};
    const mentioned=(name,visible)=>name==='霜寒值' ?
      // 雅 also deals Frost (霜寒). A bare element/anomaly is not 照's meter.
      /霜寒值|照的霜寒|(?:满|\d+点?)霜寒|霜寒(?:未满|满|不足|积攒|达到|已达|[≥\d])|补霜寒/.test(visible) :
      name==='残痕'?/残痕(?!值)/.test(visible):
      [name,...(synonyms[name]||[])].some(term=>visible.includes(term));
    for (let i=0;i<=index && i<phaseSteps.length;i++) {
      const step=phaseSteps[i];
      // Exclude hidden branches, future hints, generic failure text and
      // explanatory notes: they must not consume a later step's first mention.
      const visible=[title(step),...[step.input,step.trigger,step.complete,step.handoff?.signal,step.handoff?.input].map(v=>text(v,step.actorId))]
        .map(v=>typeof v==='string'?v:v?.zh||'').join(' ');
      const here=glossary.filter(e=>!seen.has(e.original) && mentioned(e.original,visible));
      if (i===index) return here;
      here.forEach(e=>seen.add(e.original));
    }
    return [];
  }
  // Keep reviewed authored headlines as natural sentences after replacing their
  // short move names. These exact phrases do not affect their original fields.
  const titles = new Map([
    ['满浮晖转辉，白闪交菲', '浮晖满后长按特殊技，白闪切菲'],
    ['扬清补风华，确认真实风异常', '强化特殊技起手，补风华并确认风异常'],
    ['90风华风暴眼 → 上一位菲快支', '风华达到90，长按特殊技／普攻 → 上一位菲快支'],
    ['焚罪已经启动，再交维准备', '长按普攻已经发动，再切维琳娜准备'],
    ['花羽轮舞已解锁，再返丹', '返场支援攻击已解锁，再切回丹'],
    ['长普兑现现存虚曜，再回到转辉', '长按普攻，消耗现存虚曜']
  ]);
  function title(step) {
    const original = step?.title;
    const zh = typeof original === 'string' ? original : original?.zh;
    if (!titles.has(zh)) return text(original, step?.actorId);
    return typeof original === 'string' ? titles.get(zh) : {...original, zh:titles.get(zh)};
  }
  return {text, title, entriesFor, originalsFor, firstResources,
    entries: entries.map(entry => ({...entry}))};
}


export {compileRotationGuide, createRotationPlainTerms, adaptDedicatedPosition, rotationBuild, rotationCyclicOrder, rotationDedicatedMatch};

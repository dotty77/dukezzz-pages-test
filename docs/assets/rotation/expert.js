export function expert({rotationBuild,rotationCyclicOrder}) {
function compileExpertRotation(config,knowledge,focusId,B,ids) {
  const A='1581',P='1641',V='1561';
  const direct=rotationCyclicOrder(ids,[A,P,V]);
  const rule=knowledge.expertRules.danPhoenixVelina;
  const moves=new Map(rule.mechanicsActions.map(a=>[a.id,a]));
  const used=new Map(),build=id=>rotationBuild(config,id);
  const dan=build(A),phoenix=build(P),velina=build(V);
  const focus=[A,P,V].includes(focusId)?focusId:A;
  const author=['asgater-phoenix','pangci-phoenix'];
  const clean=(text,en=false)=>String(text||'').replace(/<IconMap:([^>]+)>/g,(_,key)=>({Icon_Normal:en?'Basic':'普攻',Icon_Special:en?'Special':'特殊技',Icon_SpecialReady:en?'EX Special':'强化特殊技',Icon_Switch:en?'Switch':'换人',Icon_UltimateReady:en?'Ultimate':'终结技'}[key]||(en?'See skill input':'按技能输入')));
  const pair=(zh,en)=>B(clean(zh),clean(en,true));
  function event(stage,key,moveId,content){
    const m=moves.get(moveId);if(!m)throw Error('Missing expert move: '+moveId);
    const actionId='expert-'+moveId;used.set(actionId,{id:actionId,label:pair(m.title,m.titleEn)});
    return {id:`${stage}-${key}`,actorId:m.agentId,skillRef:String(m.skillId),actionId,title:pair(m.title,m.titleEn),input:pair(m.input,m.inputEn),
      trigger:B('满足本招式的实际条件后执行。','Execute only when this move’s actual prerequisites are met.'),
      complete:B('完成需要的命中后重新检查状态。','Complete the required hits, then recheck the state.'),
      fallback:B('条件未满足时先补资源或跳过，不能假定下一事件自动成立。','Recover resources or skip when unavailable; the next event is not assumed to become valid.'),
      sourceRefs:[`agent-${m.agentId}`,String(m.skillId)],background:[],handoff:null,evidence:'mechanic-reference-plus-authored-team-order',...content};
  }
  const cite=(step,...ids)=>{step.sourceRefs=[...new Set([...step.sourceRefs,...ids])];return step;};
  const normal=(toId,zh,en)=>({toId,kind:'normal',signal:B(zh,en)});
  const phaseBackground=()=>({actorId:A,kind:'persistent',label:B('丹的相变时流 · 仅实际仍生效时','Dan’s Phase Flow · only while actually active')});
  function quick(stage,fromId,toId,sourceSkill){
    const m=knowledge.agents[toId].actions.quickAssist,actionId='expert-quick-'+toId;
    used.set(actionId,{id:actionId,label:pair(m.name,m.nameEn)});
    return {id:`${stage}-quick-${toId}`,actorId:toId,skillRef:String(m.skillRef),actionId,title:pair(m.name,m.nameEn),
      input:B('看到对应角色的快速支援提示就按支援键；如果上一步已经接到该角色，无需再按。','Press Assist when the matching Quick Assist prompt appears.'),
      trigger:B(`上一事件确实触发了${knowledge.agents[toId].name}的快支提示。`,`The preceding event actually triggered ${knowledge.agents[toId].nameEn}’s Quick Assist prompt.`),
      complete:B('确认通过该快支提示入场，再接下一动作。','Confirm entry through that Quick Assist prompt before continuing.'),
      reason:B('这一事件是快速支援；普通切人不能代替该触发。','This event is a Quick Assist; an ordinary switch does not satisfy its trigger.'),
      fallback:B('没有对应提示就跳过本事件，按当前真实站位重新检查后续条件。','Without the matching prompt, skip this event and recheck subsequent conditions from the actual active agent.'),
      sourceRefs:[`agent-${toId}`,String(m.skillRef),`agent-${fromId}`,String(sourceSkill)],background:[],handoff:null};
  }
  function enterPhase(stage){
    return cite(event(stage,'phase','a-phase',{
      title:B('浮晖满：特殊技后长按特殊技，白闪时普通切菲','Full Radiance: hold Special after Special or EX, then switch on the white flash'),
      input:B('浮晖达到120：先用特殊技或强化特殊技 → 长按特殊技进入转换姿态 → 白闪时普通切到菲欧妮。'+(stage==='opening'?'如果刚用了上一步的强化特殊技，直接接长按。':''),'At 120 Radiance: use Special or EX → hold Special for Conversion Stance → switch normally to Phoenix on the white flash.'+(stage==='opening'?' If the preceding EX was just used, go straight to the hold.':'')),
      trigger:B('正在接战，浮晖已达到120点，要消耗的虚曜已处理。','In combat with 120 Floating Radiance; cash out any Voidflares you intend to keep before entering. Hold Special after Special or EX.'),
      complete:B('在转换姿态下切出丹，才进入相变时流。确认菲欧妮已在前台。','Switching Dan out of Conversion Stance starts Phase Flow. Confirm Phoenix is now on field.'),
      reason:B('白闪是作者提供的交棒信号，不是快支；进入相变会清空虚曜。菲后续火伤满足转换条件时，才确认流明转火。','The author’s white flash is a normal-switch cue, not Quick Assist. Entry clears Voidflares. Confirm Fire conversion only after Phoenix’s Fire hit meets its requirements.'),
      fallback:B('浮晖不足先恢复；无60能量时不能假定普通特殊技也施加两个积蓄点。尚有待兑现虚曜则先处理。','Recover Radiance first. Without 60 energy, do not treat a normal Special as applying the EX’s two points. Resolve stored Voidflares before entering.'),
      handoff:normal(P,'长特殊技白闪后普通切菲；不等快支提示。','Switch normally to Phoenix on the held Special’s white flash; do not wait for Quick Assist.')
    }),author[0]);
  }
  function fireSetup(stage,opening=false){
    return cite(event(stage,'fire','b-slash',{
      title:B('按资源选特殊技起手，接普攻三、四段','Choose the available starter; finish Fire Anomaly on field'),
      input:B('有升变：点特殊技出上挑，在上挑动作中点普攻接第3段，继续普攻至第4段命中。\n没有升变，能量≥40：点强化特殊技起手。想补升变、第一段后还够40能量，就在衔接窗口再点按或长按强化特殊技；否则只出第一段。两条路线都在最后一招中点普攻，直接接第3段，再打到第4段。\n都不够：点普通特殊技。完美格挡后点普攻直接接第3段；未完美格挡，先点普攻出突击，突击中再点普攻接第3段。继续打到第4段命中。','With Ascension: tap Special for the rising slash, then tap Basic during the slash for hit 3 and continue through hit 4.\nNo Ascension, at least 40 Energy: tap EX once. For Ascension, tap or hold EX again in the follow-up window only if another 40 Energy remains. Otherwise skip the second EX. During your last EX, tap Basic to enter hit 3 and continue to hit 4.\nWith neither resource, tap normal Special. After a Perfect Block, tap Basic straight into hit 3. Without the block, tap Basic for the lunge and tap Basic during it for hit 3. Continue through hit 4.'),
      trigger:B('先检查升变和普通能量，按当前可用分支起手。'+(opening&&phoenix.mindscape>=1?'本配置M1开局赠送1点，仅限开场。':'以当前升变为准，不重新领取开场资源。'),'Use Blazing Slash only with 1 Ascension. '+(opening&&phoenix.mindscape>=1?'M1 grants one at battle start only.':'Read the current resource; opening grants do not repeat.')),
      complete:B('本轮需要第四段爆条时，留在前台直到关键命中触发火异常；查看实际燔焰，不固定假定几轮到90。','When hit 4 must complete Fire Anomaly buildup, remain on field through that hit. Read actual Pyre rather than assuming a fixed number of strings reaches 90.'),
      reason:B('第四段跳起虽可切出，但作者指出后台不能完成异常爆条；不能照搬焚罪的脱手方式。','The Basic 4 leap can allow a switch, but the author reports it cannot complete Anomaly buildup off field. Its handoff differs from Purifying Flame.'),
      fallback:B('没有升变，且能量不足40时：点按特殊技后点普攻。完美格挡直接接第三段；未完美格挡先打一段追加普攻，再接第三、四段。'+(phoenix.mindscape>=6?'M6眩焰也会给升变，仍看实际资源。':''),'Without Ascension: Dazzling Flare costs 40 energy; another 40 in its follow-up window permits Falling Sun and grants Ascension. Without energy, use the normal Special branch: without Perfect Block, follow with the intermediate attack then Basic 3/4; Perfect Block leads directly to Basic 3.'+(phoenix.mindscape>=6?' M6 Dazzling Flare also grants Ascension; still check the current resource.':'')),
      alternateSkillRefs:['164100006','164100007','164100004','164100003'],followupSkillRefs:['164100001'],
      background:[phaseBackground()]
    }),author[1],'164100001','164100006','164100007');
  }
  function burn(stage){
    return cite(event(stage,'burn','b-burn',{
      title:B('长按普攻发动后，普通切到维琳娜','Start Purifying Flame, then hand setup to Velina'),
      input:B('燔焰达到90：长按普攻；看到攻击已启动，再普通切到维琳娜。','At 90 Pyre, hold Basic. Once the attack starts, switch normally to Velina.'),
      trigger:B('燔焰≥90；如要兑现异放，终结一击命中时目标须处于技能所列异常。','At least 90 Pyre. For Abloom, the target must have a listed Anomaly when the finishing hit lands.'),
      complete:B('长按普攻确实启动焚罪，再普通切维；检查后台终结一击实际命中与异常状态。','Actually start Purifying Flame with held Basic, then switch normally to Velina. Check the off-field finishing hit and actual target Anomaly.'),
      reason:B('作者确认焚罪能脱手续招并触发异常；只在维的第一个准备事件标出该重叠，不假定一长串招式都能塞进去。','The author confirms its off-field continuation and ability to trigger Anomaly. Only Velina’s first setup event is marked as overlapping; a whole unmeasured sequence is not assumed to fit.'),
      fallback:B('没有90燔焰继续攒条；没有适用异常先补异常。本动作未启动就不能把下一步画成后台焚罪。','Build Pyre if below 90 and establish a suitable Anomaly if needed. Without starting this move, the next step has no Purifying Flame continuation.'),
      background:[phaseBackground()],handoff:normal(V,'焚罪已启动后普通切维；这不是快速支援。','After Purifying Flame starts, switch normally to Velina. This is not Quick Assist.')
    }),author[0],author[1]);
  }
  function windPreparation(stage,overlap=false){
    const first=event(stage,'wind','c-ex',{
      title:B('点按强化特殊技，积攒风华','Purifying Rise: build Wind Grace and verify Wind Anomaly'),
      input:B('普通能量达到45：点按强化特殊技。看风华增加了多少，并另外确认敌人有没有进入风异常。','At 45 energy, tap EX Special. Check Wind Grace and the target’s Wind Anomaly separately.'),
      trigger:B('能量≥45；当前能够发动扬清。','At least 45 energy and Purifying Rise is currently available.'),
      complete:B('扬清发动获得45风华；命中积风异常。仅初始45仍在时，本次才可直接到90。','Using Purifying Rise grants 45 Wind Grace and its hits build Wind Anomaly. It reaches 90 directly only if the initial 45 remains.'),
      reason:B('一次EX不保证风异常已触发；专武层数要求该次EX实际造成风伤。','One EX does not guarantee Wind Anomaly. Signature stacks require that EX to actually deal Wind damage.'),
      fallback:B('能量不足先恢复，不自动补满；风华、风异常与专武层数分别看实际结果。','Recover energy if needed; do not auto-fill it. Check Wind Grace, Anomaly and signature stacks separately.'),background:[phaseBackground()]
    });
    if(overlap){first.background.push({actorId:P,kind:'overlap',label:B('焚罪脱手续招 · 已启动且尚未结束时','Purifying Flame continuation · started and not yet ended')});cite(first,author[0],author[1],'agent-'+P,'164100002');}
    const result=[first];
    if(velina.signature>0)result.push(event(stage,'second-wind','c-followup',{
      title:B('要补专武层数，再按一次强化特殊技','Follow with Triple Deathblow only if a stack is needed and energy permits'),
      input:B('上一步强化特殊技后，若还有45能量且专武需要补层，在衔接窗口再点按或长按一次强化特殊技。否则跳过。','After the previous EX, tap or hold EX once more within its follow-up window if you still have 45 energy and need a stack; otherwise skip.'),
      trigger:B('刚发动扬清，衔接仍有效、能量≥45，且需要第二次独立风伤EX触发。','Immediately after Purifying Rise, with its follow-up available, at least 45 energy, and a second separate Wind-damage EX trigger is still needed.'),
      complete:B('第二次独立EX实际造成风伤，才确认两层专武效果；已有完整效果时可跳过本补层分支。','Confirm the two-stack signature effect only after the second separate EX deals Wind damage. Skip this refresh branch if the full effect is already active.'),
      reason:B('一次EX多段命中不算两次触发；赋彩后的气旋也不能被默认算作风伤补层。','Multiple hits from one EX are not two triggers. A tinted cyclone is not automatically a Wind-damage stack trigger.'),
      fallback:B('能量不足或无需补层就跳过，再看实际风华决定风暴眼是否可用。','Skip if energy is insufficient or no refresh is needed, then check actual Wind Grace before Eye of the Storm.'),background:[phaseBackground()]
    }));
    return result;
  }
  function cyclone(stage){
    return event(stage,'cyclone','c-cyclone',{
      title:B('风华达到90，长按特殊技或普攻召唤气旋','90 Wind Grace: Eye of the Storm → previous-slot Phoenix Quick Assist'),
      input:B('风华达到90：长按特殊技或长按普攻，两个按键选一个。','At 90 Wind Grace, hold Special or hold Basic; choose one.'),
      trigger:B('风华≥90；确认风／火异常、浸染等所需状态实际存在。','At least 90 Wind Grace; check actual Wind/Fire Anomaly and any required Windswept state.'),
      complete:B('召唤广域气旋；出现上一位菲欧妮的快支提示后再接手。','Summon Sweeping Cyclone; hand off after the previous-slot Phoenix Quick Assist prompt appears.'),
      reason:B('当前循环站位中，维的上一位是菲。气旋只能有一个，重复施放不等于叠放。','In this cyclic formation, Velina’s previous slot is Phoenix. Only one cyclone can exist; repeated casts do not stack them.'),
      fallback:B('不足90风华先恢复；没有对应快支提示时不要把普通换人当作快支。','Recover if below 90 Wind Grace. Without the prompt, a normal switch is not Quick Assist.'),background:[phaseBackground()],
      handoff:{toId:P,kind:'quick',signal:B('风暴眼触发上一位菲的快支提示后接菲。','Respond to Eye of the Storm’s previous-slot Phoenix Quick Assist prompt.')}
    });
  }
  function returnDan(stage,beforeWindow=false){
    return cite(event(stage,'return','a-return',{
      title:B(beforeWindow?'窗口前，解锁返场后普通切回丹':'解锁返场攻击后，普通切回丹',beforeWindow?'Before the window: cash out Dan’s entry':'Return to Dan only after Flower & Feather Dance unlocks'),
      input:B('本轮相变已触发3次异化，或浮晖耗尽时仍有虚曜：确认返场攻击已解锁，再普通切回丹。已通过上一步切回就不用再按。','Switch normally into Dan after confirming the entry attack is unlocked.'),
      trigger:B('本次相变已触发3次异化；或浮晖耗尽且仍有≥1虚曜，实际已激活花羽轮舞。','Three Refringe reactions in this Phase Flow, or depleted Floating Radiance with at least 1 Voidflare; Flower & Feather Dance must actually be activated.'),
      complete:B('普通换入发动花羽轮舞并命中。起手浮晖≤90时不消耗并获得映曜；否则按实际消耗检查。','Enter normally and land Flower & Feather Dance. Starting at ≤90 Radiance grants the enhanced state without spending it; otherwise check the actual cost.'),
      reason:B('相变中的普通换入受锁定；实际失衡中命中才适用一次延长条件，不用固定秒表判断返场。','Normal entry is locked during Phase Flow. The one-per-Stun extension requires an actual hit during Stun; a fixed timer does not unlock entry.'),
      fallback:B('未解锁继续让队友积异常；连携例外不等于普通切回已开放。丹已在场则检查是否直接进入虚曜兑现。','If locked, continue teammates’ Anomaly setup. A Chain exception does not unlock normal entry. If Dan is already active, check whether stored Voidflares can be cashed out directly.')
    }),author[0]);
  }
  function held(stage){
    return event(stage,'held','a-held',{
      alternateSkillRefs:['158100004'],
      title:B('长按普攻，消耗现存虚曜','Hold Basic to spend stored Voidflares'),
      input:B('有至少1个虚曜：长按普攻，留场打完这一击。没有虚曜则先按恢复说明处理。','With at least one Voidflare, hold Basic and finish the attack on field. Otherwise use the recovery branch.'),
      trigger:B('虚曜≥1；有映曜时进入惊鸿分支。','At least 1 Voidflare; the enhanced held-attack branch applies when its buff is present.'),
      complete:B('命中并完成招式才兑现耀变；动作结束会清空虚曜、回复120浮晖，空挥也会消耗。'+(dan.mindscape>=6?'本配置M6使这类虚曜长普触发两次耀变。':''),'Land and complete the attack to cash out Luminize. At move end it clears Voidflares and restores 120 Radiance even on a whiff.'+(dan.mindscape>=6?' M6 makes this Voidflare-powered held attack trigger Luminize twice.':'')),
      reason:B('先处理已有虚曜，不把无虚曜的独舞当成相同兑现。','Spend existing Voidflares first; the no-Voidflare held move is a different action.'),
      fallback:B('没有虚曜先通过队友异化恢复。'+(dan.mindscape>=6?'M6可在丹能前台操作且无待保留高价值虚曜时，用第四段命中自供3个弱特殊虚曜（开局强度的25%）；这是恢复选项，不是固定最优循环。':'可用当前可用普攻等恢复浮晖；只有实际达到120才进入转辉。'),'Without Voidflares, recover through teammate Refringe.'+(dan.mindscape>=6?' If Dan can act on field and has no valuable stored Voidflares to preserve, M6’s landed fourth Basic can supply 3 weaker special Voidflares at 25% of the opening strength. This is a recovery option, not a fixed optimal loop.':' Use available attacks to recover Radiance; enter Radiant Turn only at an actual 120.'))
    });
  }
  function danUltimate(stage,steady=false){
    return cite(event(stage,steady?'optional-ultimate':'ultimate','a-ultimate',{
      title:B(steady?'需要时使用已就绪的终结技':'保留现有虚曜，先用丹的终结技',steady?'Optional steady branch: Dan’s ready Ultimate':'Actual burst window: Dan’s Ultimate before held Basic clears Voidflares'),
      trigger:B('终结技已就绪、目标可命中，且有准备兑现的虚曜。'+(steady?'你主动选择本轮使用，并确认没有更近的更好窗口。':'实际输出窗口已出现；失衡收益只有敌人确实失衡才计入。'),'Ultimate ready, target hittable, and stored Voidflares available.'+(steady?' You choose to spend it now, with no better imminent window.':' An actual output window is present; Stun benefits apply only if the enemy is actually Stunned.')),
      complete:B('终结技命中并结算后，再检查长普兑现条件。','Land and resolve the Ultimate, then recheck the held-Basic cashout conditions.'),
      reason:B(steady?'稳妥策略提供这一可跳过选择；作者的常规建议是留给实际失衡轮，不代表现在花掉更优。':'作者建议高投入丹利用实际失衡轮；先Q后长普是保留虚曜的参考安排，未验证为本配置最高分。',steady?'Steady mode offers this skippable choice; the author normally reserves it for an actual Stun rotation. Spending it now is not claimed to be better.':'The author favors an actual Stun window for a heavily invested Dan. Ultimate before held Basic preserves the stored-resource sequence; it is not a verified maximum-score order.'),
      fallback:B('未就绪或决定保留时直接跳过，回到现存虚曜的长普分支；不为凑Q空等。','If unavailable or saving it, skip directly to the stored-Voidflare held attack rather than waiting idle.')
    }),author[0]);
  }
  const opening=[];
  if(dan.mindscape>=1){
    opening.push(event('opening','gift','a-held',{
      title:B('开局长按普攻，消耗影画1赠送的虚曜','Opening only: spend the M1 special Voidflares'),
      input:B('开局赠送的3个虚曜还在：长按普攻，命中后等这一击结束。','If you still have the three opening Voidflares, hold Basic, land the attack and let it finish.'),
      trigger:B('本次战斗初始赠送的3个特殊虚曜仍在，且尚未进入相变。','The 3 special Voidflares granted at battle start remain, and Phase Flow has not been entered.'),
      complete:B('长普命中并结束，清空本批虚曜并回复120浮晖。'+(dan.mindscape>=6?'本配置M6使这类长普触发两次耀变。':''),'Land and finish the held Basic, clearing this batch and restoring 120 Radiance.'+(dan.mindscape>=6?' M6 triggers Luminize twice with this held attack.':'')),
      reason:B('进入相变会清空虚曜，先兑现是资源保留的参考分支，不声称开局最优。','Entry into Phase Flow clears Voidflares. Spending them first is a resource-preserving reference, not a proven best opener.'),
      fallback:B('已使用或已清空就跳过；这份开场资源不会每轮重给。','Skip if already spent or cleared. This opening grant does not repeat each rotation.')
    }));
    if(dan.mindscape>=4)opening.push(event('opening','one-refill','a-held',{
      title:B('影画4补回虚曜后，再长按一次普攻','Once only: spend the second batch refilled by M4'),
      input:B('看到虚曜重新补满：再长按一次普攻，打完再继续。本场只补这一次；没补回就跳过。','When Voidflares refill, hold Basic once again and finish the attack. The refill happens once per battle; skip if it did not occur.'),
      trigger:B('首次消耗开局特殊虚曜后，M4确实补满，且还没进入相变。','M4 actually refilled the initial special Voidflares after their first consumption, before entering Phase Flow.'),
      complete:B('第二次长普消耗补回资源；M4不会补第三批。','Spend the refilled resource with another held Basic. M4 does not supply a third batch.'),
      reason:B('第一次长普已经回满浮晖；第二次是兑现资源，不是为凑120而必需。','The first held attack already filled Radiance. This second attack spends the refill; it is not required to reach 120.'),
      fallback:B('补充未触发、已消耗或因进入相变取消时跳过。','Skip if the refill did not trigger, was already spent, or was cancelled by entering Phase Flow.')
    }));
  }else opening.push(event('opening','radiance','a-basic4',{
    title:B('连续点按普攻，把浮晖攒到120','M0: build actual Floating Radiance to 120'),
    input:B('浮晖不足120时，连续点按普攻打完四段。看实际浮晖，未满则继续；满了就停。','Below 120 Radiance, tap Basic through hit four. Repeat only if the actual gauge is still below 120.'),
    trigger:B('没有M1开场虚曜；当前浮晖不足120。','No M1 opening Voidflares; current Radiance is below 120.'),
    complete:B('四段全部命中并结束合计回复60；继续到界面实际显示120，不假定两轮必满。','A complete landed four-hit string restores 60. Continue until the gauge actually shows 120; two strings are not automatically treated as successful.'),
    fallback:B('漏命中或取消后看实际资源；无虚曜长普不是垂虹兑现。','Check actual resources after a miss or cancel. Without Voidflares, held Basic is not the Rainbow’s End cashout.')
  }));
  opening.push(event('opening','points','a-ex',{
    title:B('普通能量够60，点按强化特殊技布点','With enough energy, place buildup points using Ode to Dawn'),
    input:B('普通能量达到60且能打中：点按强化特殊技。能量不足则跳过这一步。','At 60 energy and with the target in range, tap EX Special. Below 60 energy, skip.'),
    trigger:B('能量≥60、目标可命中；该EX当前可用。','At least 60 energy, a hittable target, and this EX available.'),
    complete:B('EX命中并结束，施加两个流明积蓄点；不把流明伤害当作独立异常属性。','Land and finish the EX to apply two Lumiflux points. Lumiflux damage is not counted as an independent Anomaly Attribute.'),
    fallback:B('不足60能量跳过这次EX布点；按当前资源进入合法特殊技／转辉分支，不假定相同布点已完成。','Below 60 energy, skip this EX setup. Use a legal Special/Phase Flow branch without assuming the same points were applied.')
  }),enterPhase('opening'),fireSetup('opening',true),...windPreparation('opening'),cyclone('opening'),quick('opening',V,P,'156100005'));
  const loop=[fireSetup('loop'),burn('loop'),...windPreparation('loop',true),cyclone('loop'),quick('loop',V,P,'156100005'),returnDan('loop')];
  if(config.strategy==='steady')loop.push(danUltimate('loop',true));
  loop.push(held('loop'),enterPhase('loop'));
  let burst,objective;
  if(focus===A){
    objective=B('丹窗口：队友在窗口前备好火／风与资源，实际机会到来后返丹兑现。','Dan window: prepare teammates’ Fire/Wind states and resources before the opportunity, then cash out Dan.');
    burst=[returnDan('burst'),danUltimate('burst'),held('burst'),enterPhase('burst')];
  }else if(focus===P){
    objective=B('菲窗口：丹在窗口前兑现并回后台；窗口内给菲，Q接力仅在Q已就绪时执行。','Phoenix window: cash Dan out before the window and return her off field. Give Phoenix the window; perform the Ultimate relay only when ready.');
    const q=event('burst','phoenix-ultimate','b-ultimate',{
      title:B('用菲的终结技，等维琳娜的快速支援提示','Phoenix window: ready Ultimate → Velina Quick Assist'),
      trigger:B('实际窗口、终结技已就绪、目标可命中，且后续追魂所需异常可维持。','Actual window, Ultimate ready, target hittable, and the Anomaly needed for the subsequent return can be maintained.'),
      complete:B('进入生竭并出现下一位维的快支提示；生竭时不能直接接普通燃烧循环。','Enter Life Exhaustion and trigger next-slot Velina’s Quick Assist. Do not immediately assume a normal burning-attack loop is available in Life Exhaustion.'),
      reason:B('此处选择Q→维→追魂分支；也可按普攻直接追魂，不必强行换人等待。','This shows Ultimate → Velina → return. Basic can also trigger the return directly; switching and waiting are not mandatory.'),
      fallback:B('Q未就绪就跳过本组Q接力；有90燔焰及合适异常时用焚罪分支，否则先攒条。不要把后续维快支和追魂当作已解锁。','Without a ready Ultimate, skip this Ultimate relay. Use Purifying Flame with 90 Pyre and suitable Anomaly, or build resources. The following Velina Assist and return are not automatically unlocked.'),
      handoff:{toId:V,kind:'quick',signal:B('终结技触发下一位维的提示后，快速支援接维。','Use next-slot Velina’s Quick Assist after the Ultimate triggers its prompt.')}
    });
    const returnPhoenix=event('burst','phoenix-return','b-return',{
      title:B('普通切回菲欧妮，触发追魂','Return to Phoenix only when Soul-Searching Blaze is available'),
      input:B('菲仍处于生竭时，普通切回菲欧妮即可触发追魂。若上一步已经切回并触发，这里直接确认命中。','While Phoenix remains in Life Exhaustion, switch back normally to trigger the return. If the previous handoff already triggered it, simply confirm the hit.'),
      trigger:B('菲已完成本次终结技并进入对应生竭／追魂状态；后续普通换回可触发追魂。','Phoenix used this Ultimate and entered the matching Life Exhaustion/return state; the subsequent ordinary return can trigger Soul-Searching Blaze.'),
      complete:B('普通换回菲触发追魂；终结一击命中已有适用异常才兑现异放。','Switch normally back to Phoenix to trigger the return. Its finishing hit needs a suitable existing Anomaly for Abloom.'),
      fallback:B('没用Q或状态已消耗就跳过；回到燔焰／升变／异常的当前真实分支。','Skip without the Ultimate state or if already consumed. Return to the actual Pyre/Ascension/Anomaly branch.')
    });
    const cPrep=windPreparation('burst-relay')[0];
    cPrep.trigger=B('前面Q接力已发生，维已入场且能量≥45；只补实际需要的风准备，不保证整套都适合窗口。','The Ultimate relay occurred, Velina is active with at least 45 energy. Refresh only needed Wind setup; a full sequence is not assumed to fit the window.');
    cPrep.handoff=normal(P,'维所需准备结束且可切人后普通回菲；追魂状态须仍有效。','After the needed setup and once switching is allowed, return normally to Phoenix with the return state still available.');
    burst=[returnDan('burst-before',true),held('burst-before'),enterPhase('burst-before'),q,quick('burst',P,V,'164100012'),cPrep,returnPhoenix];
  }else{
    objective=B('维窗口参考：依你的选择围绕真实风异常与维终结技安排，未验证为本队最优。','Velina-focused reference: honor your choice with actual Wind Anomaly and her Ultimate. This is not validated as the team’s best allocation.');
    const q=event('burst','velina-ultimate','c-ultimate',{
      title:B('敌人已有风异常，使用维琳娜的终结技','Use Velina’s Ultimate with actual Wind Anomaly present'),
      trigger:B('终结技已就绪；重击命中时目标实际处于风属性异常，且额外能力已满足。','Ultimate ready; the heavy hit lands while the target actually has Wind Anomaly and the Additional Ability is active.'),
      complete:B('终结技重击命中后检查异放；出现上一位菲的提示才快支交回。','After the heavy hit, check Abloom. Hand off only when previous-slot Phoenix’s Quick Assist prompt appears.'),
      reason:B('不是任何异常都满足维的风异常前提；一次扬清也不保证已有风异常。','Not every Anomaly meets Velina’s Wind requirement; one Purifying Rise does not guarantee Wind Anomaly.'),
      fallback:B('无风异常先准备或保留Q；Q没就绪跳过，不把本分支称作最高分。','Prepare Wind Anomaly or save the Ultimate. Skip if not ready; this reference is not a maximum-score claim.'),
      handoff:{toId:P,kind:'quick',signal:B('维终结技触发上一位菲的快支提示后接手。','Respond to Velina’s Ultimate prompt for previous-slot Phoenix’s Quick Assist.')}
    });
    burst=[returnDan('burst-before',true),held('burst-before'),enterPhase('burst-before'),fireSetup('burst-before'),...windPreparation('burst'),q,quick('burst',V,P,'156100010')];
  }
  // Reverse-order Dan has two Assist triggers aimed at Dan, whose Phase Flow entry
  // is locked. Keep the Fire/Wind dependency without inserting a fake Dan Assist.
  const positionNotes=[];
  if(!direct) {
    positionNotes.push(B('维琳娜的上一位、菲欧妮的下一位现在都是丹。丹相变中不能凭快支强行返场；等花羽轮舞解锁后按普通换入，真实连携例外单独判断。','Velina’s previous slot and Phoenix’s next slot are now Dan. A Quick Assist cannot bypass Phase Flow’s entry lock; wait for Flower & Feather Dance to unlock normal entry, or evaluate an actual Chain separately.'));
    const adaptWind=(steps)=>steps.map(s=>{
      if(s.actionId.startsWith('expert-quick-')) {
        s.actionId='expert-position-entry-'+s.actorId;
        delete s.skillRef;
        s.positionRecovery=true;
        used.set(s.actionId,{id:s.actionId,label:B('普通入场 · 核对资源','Normal entry · check resources')});
        s.title=B('普通切菲，核对火资源与丹的返场条件','Switch normally to Phoenix; check Fire resources and Dan’s entry lock');
        s.input=B('提示结束且允许切人后普通切菲；用可用火伤动作继续积异常。丹返场未解锁就继续本轮菲／维资源循环。','After the prompt ends and switching is allowed, enter Phoenix normally and build Anomaly with available Fire attacks. Continue the Phoenix/Velina resource loop while Dan’s return remains locked.');
        s.trigger=B('菲可普通换入；丹当前尚未解锁时不尝试用指向丹的快支中转。','Phoenix can enter normally; do not bridge through a prompt for Dan while her entry remains locked.');
        s.complete=B('确认火异常与资源的实际结果；后续要切丹，必须先看花羽轮舞确实解锁。','Check actual Fire Anomaly and resources. A following return to Dan requires Flower & Feather Dance to be genuinely unlocked.');
        s.reason=B('这次是普通换入，不发动原来的菲快速支援攻击。','This is a normal entry; the former Phoenix Quick Assist attack is not performed.');
        s.fallback=B('菲资源不足就用可用动作恢复；丹尚未解锁则留在队友循环，不推进返丹事件。','Recover Phoenix’s resources with available actions. While Dan is locked, stay in the teammate loop instead of advancing to her return.');
      }

      if(s.skillRef==='156100005'||s.skillRef==='156100010') {
        s.title=B(s.skillRef==='156100005'?'风华达到90：长按特殊技或普攻，结束后普通切菲':'维终结技结算后，普通切菲',s.skillRef==='156100005'?'90 Wind Grace: Eye of the Storm, then normal entry to Phoenix':'Resolve Velina’s Ultimate, then switch normally to Phoenix');
        s.complete=B('确认招式需要的命中完成；当前上一位提示对象是丹，不把它当菲的快支。待提示结束且允许切人后，普通切菲；丹仍按返场解锁条件另处理。','Complete the required hits. The previous-slot prompt targets Dan, not Phoenix. Once the prompt ends and switching is allowed, enter Phoenix normally; Dan’s re-entry remains separately gated.');
        s.reason=B('换位后保留火／风准备，但取消原来维→菲的快支事件；不插丹中转。气旋仍只允许一个。','Retain Fire/Wind preparation after reordering, but remove the former Velina-to-Phoenix Assist event. Do not bridge through Dan. Only one cyclone may exist.');
        s.handoff=normal(P,'等当前提示和动作锁定结束，普通切到下一位菲；不响应指向丹的提示。','Wait for the current prompt and action lock to end, then switch normally to next-slot Phoenix; do not accept the prompt aimed at Dan.');
      }
      return s;
    });
    opening.splice(0,opening.length,...adaptWind(opening));
    loop.splice(0,loop.length,...adaptWind(loop));
    burst=adaptWind(burst);
    if(focus===P) {
      const qIndex=burst.findIndex(s=>s.skillRef==='164100012');
      const q=burst[qIndex];
      q.title=B('使用菲的终结技，留场，不接丹的支援提示','Phoenix Ultimate → on-field Soul-Searching Blaze; skip Dan’s prompt');
      q.complete=B('确认进入生竭；当前下一位提示是丹，不是维。留场，按下一步处理追魂；生竭期间不能继续普通燃烧循环。','Confirm Life Exhaustion. The next-slot prompt targets Dan, not Velina. Stay on field for the next step; normal burning attacks are unavailable during Life Exhaustion.');
      q.reason=B('本排列取消Q→维快支接力，采用技能允许的前台追魂分支；不假设丹已解锁，也不安排维在本次追魂前补风。','This order replaces the Ultimate-to-Velina relay with the allowed on-field return branch. Dan is not assumed unlocked and Velina does not refresh Wind before this return.');
      q.fallback=B('终结技未就绪就跳过Q和追魂；不要额外接一次维快支。已用Q则先按实际生竭状态处理追魂。','Skip both Ultimate and return if unavailable; do not insert a Velina Assist. If used, resolve the actual Life Exhaustion return state first.');
      q.handoff=null;
      const ret=burst.find(s=>s.skillRef==='164100013') || burst.find(s=>s.id==='burst-phoenix-return');
      ret.title=B('仍在生竭时，前台按普攻发动追魂','While still in Life Exhaustion, press Basic on field for the return');
      ret.input=B('保持菲在前台；生竭期间点按普攻。已自动发动则不重复。','Keep Phoenix on field and press Basic in Life Exhaustion; do not repeat an automatically released return.');
      ret.trigger=B('本次终结技已经发动，菲仍处于生竭且追魂尚未发动。','This Ultimate was used, Phoenix remains in Life Exhaustion, and the return has not started.');
      ret.complete=B('追魂终结一击命中所需异常才兑现异放；结束后再检查升变和燔焰，恢复正常循环。','The return’s finishing hit needs a suitable Anomaly for Abloom. Afterwards, recheck Ascension and Pyre before resuming the normal cycle.');
      ret.reason=B('追魂可在前台直接用普攻触发，不必经由一个错位快支。','Basic can trigger this return directly on field without a wrong-slot Assist.');
      burst=[...burst.slice(0,qIndex),q,ret];
      objective=B('菲窗口：窗口前备好火／风；Q后直接追魂，取消指向丹的错位快支接力。','Phoenix window: prepare Fire/Wind before it; after Ultimate, return directly instead of using a misplaced Assist relay to Dan.');
    }
  }
  // Add only conservative ordinary switches. Explicit Quick Assist cues retain their own entry event.
  function connect(steps){
    for(const s of steps){
      const byRef={
        '164100005':['起手无需普攻。按上面的分支衔接，在招式动作中点普攻跳到第3段，再打到第4段命中。','No Basic before the starter. Follow the branch above and tap Basic during the move to enter hit 3, then continue through hit 4.'],
        '164100002':['本步必须长按普攻来发动，不用先点普攻，也不用等打到特定段位。','Hold Basic to start this move; no preceding Basic taps or combo hit required.'],
        '158100003':['这次消耗虚曜要长按普攻，不用先打普通连段，也不用再按强化特殊技。','To spend these Voidflares, hold Basic. No preceding Basic combo or additional EX input.'],
        '158100001':['缺浮晖才走这条普攻路线：打到第4段并看实际浮晖；已达120就跳过，不是为下一招固定点四下。','Use this Basic route only if short on Radiance. Reach hit 4 and check the gauge; skip at 120. Four taps are not a prerequisite for the next skill.'],
        '156100003':['不用普攻起手。强化特殊技后可接普攻第5段；本路线若要接第二段强化特殊技，先接强化特殊技，不要先插普攻。','No Basic required to start. Basic can follow EX at hit 5; if using the second EX, take that follow-up first.'],
        '156100004':['补层要接上一段强化特殊技，不用先普攻。第二段之后可接普攻第5段，不需从第1段重打。','Follow the previous EX directly for the stack. Basic hit 5 after the second EX is optional; do not replay hits 1–4.'],
        '156100005':['长按普攻是长按特殊技的替代键，二选一；不用先点普攻，也不用两个都按。','Hold Basic or hold Special, not both. No Basic taps beforehand.'],
      };
      if(byRef[s.skillRef]) s.basicCue=B(...byRef[s.skillRef]);
      if(s.skillRef==='164100013' && !direct && focus===P) s.basicCue=B('采用留场路线时在终结技后点普攻发动追魂；已经自动发动就不再按，不要求普攻段位。','On the on-field route, tap Basic after the Ultimate for the return, unless it already started automatically. No Basic combo hit is required.');
    }
    for(let i=0;i<steps.length-1;i++){
      const s=steps[i],next=steps[i+1];
      if(s.actorId!==next.actorId&&!s.handoff) {
        s.handoff=next.skillRef==='158100017'
          ?normal(A,'先确认丹的返场攻击已经解锁，再普通切回丹；未解锁就继续用菲欧妮和维琳娜积异常。','Switch normally back to Dan only after her entry attack unlocks. Until then keep building Anomaly with Phoenix and Velina.')
          :normal(next.actorId,'完成当前必要命中且允许切人后普通换人；下张卡的解锁条件仍须成立。','Complete the required hits and switch only when allowed. The next event’s unlock conditions must still hold.');
      }
    }
    return steps;
  }
  const prep=[B('火／风异常、丹的返场解锁与虚曜均以实际状态为准；在窗口前补齐所需准备。','Check actual Fire/Wind Anomaly, Dan’s re-entry unlock and stored Voidflares. Prepare required states before the window.'),B('本页按事件教顺序，不预设失衡时间；缺条件就走对应恢复分支。','This guide orders events without predicting a Stun timer. Use the stated recovery branch when a prerequisite is missing.')];
  return {positionAdapted:!direct,positionNotes,actions:[...used.values()],phases:[
    {id:'opening',label:B('开局','Opening'),objective:B('处理一次性资源，转火后建立菲／维循环。','Resolve one-time opening resources, convert to Fire and establish Phoenix/Velina’s cycle.'),prep,steps:connect(opening)},
    {id:'loop',label:B('常态循环','Regular loop'),objective:direct?B('菲建立火底与焚罪交棒，维补风并快支交菲；丹解锁后兑现再转辉。','Phoenix establishes Fire and hands off Purifying Flame. Velina prepares Wind and Quick Assists Phoenix; Dan cashes out after re-entry unlocks, then resumes Phase Flow.'):B('菲建立火底与焚罪交棒，维补风后普通切菲；丹只在返场解锁后兑现。','Phoenix establishes Fire and hands off Purifying Flame; Velina prepares Wind then switches normally to Phoenix. Dan cashes out only after her entry unlocks.'),prep:[],steps:connect(loop),repeat:B('返回菲／维的当前资源继续；M1/M4开场赠送不会重发，后台状态也不会自动刷新。','Continue from Phoenix/Velina’s current resources. M1/M4 opening grants do not repeat, and background states do not refresh automatically.')},
    {id:'burst',label:B('爆发窗口','Burst window'),objective,prep,steps:connect(burst)}
  ]};
}

// Authored team lessons are matched against membership, focus and assist order.

return compileExpertRotation;
}

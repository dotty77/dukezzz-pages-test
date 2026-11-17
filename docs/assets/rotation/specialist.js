export function specialist({rotationBuild,adaptDedicatedPosition,rotationDedicatedMatch}, instructions) {
const {ROTATION_LESSON_TITLES,ROTATION_LESSON_INPUTS,ROTATION_CONTEXT_TITLES,ROTATION_RECOVERY_INPUTS,ROTATION_ADAPTED_INPUTS,DEDICATED_BASIC_CUES,RECOVERY_BASIC_CUES,events,names,notes}=instructions;
function rotationReadControls(zh){
 return zh.replace(/双E/g,'连续两次强化特殊技').replace(/(?:发动)?EX能量/g,'能量')
   .replace(/(?<![A-Za-z])EX(?![A-Za-z])/g,'强化特殊技').replace(/(?<![A-Za-z])Q(?![A-Za-z])/g,'终结技')
   .replace(/长E/g,'长按特殊技').replace(/松E/g,'松开特殊技键').replace(/(?<![A-Za-z])E(?![A-Za-z])/g,'特殊技')
   .replace(/长普/g,'长按普攻').replace(/普五/g,'普攻第五段').replace(/闪反/g,'闪避反击');
}
function applyTeamFollowalong(phases,knowledge){
 const local=(pair,zh)=>({...pair,zh});
 for(const phase of phases)for(const s of phase.steps){
  const originalInput=s.input.zh, originalTitle=s.title.zh;
  let input=Object.hasOwn(ROTATION_LESSON_INPUTS,originalInput)?ROTATION_LESSON_INPUTS[originalInput]:originalInput;
  let title=Object.hasOwn(ROTATION_LESSON_TITLES,originalTitle)?(ROTATION_CONTEXT_TITLES[originalInput]||ROTATION_LESSON_TITLES[originalTitle]):originalTitle;
  if(originalTitle==='失衡中短蓄力接追碾')input='在失衡窗口短暂长按普攻蓄力，接特殊技；保持按住普攻时也可点闪避。';
  if(s.positionRecovery){
   const old='检查下一步要求的能量、专属资源和姿态；不足就先用当前可发动的技能恢复，达标才继续。';
   if(ROTATION_RECOVERY_INPUTS[s.actorId])input=input.replace(old,'普通切入'+knowledge.agents[s.actorId].name+'后，先查看下步条件；已满足就继续。'+ROTATION_RECOVERY_INPUTS[s.actorId]);
  } else if(s.positionAdapted && ROTATION_ADAPTED_INPUTS[s.skillRef]){
   if(s.skillRef==='131100012')s.complete=local(s.complete,s.complete.zh+' 本招也为全队角色回复200点生命值。');
   const control=ROTATION_ADAPTED_INPUTS[s.skillRef]; input=control+'。等动作完整结束、错误对象的提示消失且能切人后，再普通换人。';
   // Position adaptation had appended the same raw skill description to both input and trigger.
   const tail=originalInput.split(' 完整结束、提示消失且允许切人后再普通换入。')[0];
   if(tail && s.trigger.zh.endsWith(tail)){const z=s.trigger.zh.slice(0,-tail.length).trim().replace(/(终结技已就绪且目标可命中。)\1/g,'$1');if(z)s.trigger=local(s.trigger,z);}
   title=control.split(/[，；]/)[0]+'，完整结束再换人';
  }
  s.input=local(s.input,rotationReadControls(input));s.title=local(s.title,rotationReadControls(title));
  for(const key of ['trigger','complete','fallback','warning']){
    if(s[key]?.zh)s[key]=local(s[key],rotationReadControls(s[key].zh));
  }
  if(s.handoff?.signal?.zh)s.handoff.signal=local(s.handoff.signal,rotationReadControls(s.handoff.signal.zh));
 }
}

// Generated only from audited lesson inputs and the pinned agent-details.json.
function applyFollowSkillParts(phases) {
 for(const phase of phases)for(const step of phase.steps){
   if(step.positionRecovery || step.positionAdapted || !step.key) continue;
   const id=step.actorId+':'+step.key, row=events[id];
   if(!row)continue;
   const parts=[...row]; for(const ref of step.alternateSkillRefs||[]) if(!parts.some(([r])=>r===ref))parts.push([ref,'choice']);
   step.displaySkillParts=parts.map(([ref,role])=>({skillRef:ref,role,name:names[ref]?.[0],nameEn:names[ref]?.[1]}));
   if(notes[id])step.skillOriginalNote={zh:notes[id][0],en:notes[id][1]};
 }
}

// Applied to the cloned specialist lesson AFTER formation adaptation and original-skill selection.
// Skill IDs identify mechanics; the event key selects the authored route when one skill permits several.
// Cues describe THIS planned event, not every use of a skill or the number of physical taps from neutral.
function applyDedicatedBasic(phases) {
  const B=(zh,en)=>({zh,en});
  for (const phase of phases) for (const s of phase.steps) {
    const ref=String(s.skillRef||''), key=s.key||'', id=String(s.actorId), input=s.input.zh;
    const cue=(zh,en)=>{s.basicCue=B(zh,en);};
    const press=(zh,en)=>{s.input=B(zh,en);s.basicCue=s.input;};
    const title=(zh,en)=>{s.title=B(zh,en);};
    if (s.positionRecovery) {
      // Preserve formation-derived gates, elemental-hit/tint instructions and recipient warnings.
      if(id==='1201')press('普通切悠真后先看电壶和标记。需要发射落羽：可直接长按普攻自由瞄准，松开发射；或在普攻第五段、特殊技、强化特殊技或连携技后长按特殊技，立即向前发射。两条路线选一条。','After entering normally, check Quivers and marks. To fire Falling Feather, hold Basic to aim and release; alternatively, hold Special immediately after Basic hit 5, Special, EX or Chain to fire straight ahead. Pick one route.');
      else if(id==='1281')press('普通切派派后，若下步需要蓄旋转，可直接长按特殊技。想加快蓄力，可在普攻第一、二或三段后衔接，不必打满三段。满蓄且能量够时继续按住，才转为强化特殊技。','After switching Piper in normally, hold Special directly to charge the spin if needed. For a faster start, link it after Basic hit 1, 2 or 3; all three are not required. Keep holding at maximum charge with enough Energy to enter EX.');
      else if(id==='1091')press('普通切雅后看落霜。需要积蓄烈霜时可打普攻后三段；要补落霜且能量够，可直接点强化特殊技，不必先普攻。已有6点落霜时可长按普攻蓄至第三阶段。','On normal entry, check Fallen Frost. The last three Basic hits can build Frost Anomaly; EX can be tapped directly with sufficient Energy when Fallen Frost is needed. At six stacks, hold Basic through charge level three.');
      else if(/普攻|普通攻击/.test(input)) {
        const note=RECOVERY_BASIC_CUES[id];
        if(note)cue(...note);
      }
      continue;
    }
    if(id==='1481' && ['148100005','148100006','148100007'].includes(ref)){
      if(key==='dialyn-rock'){
        press('能量够时直接点强化特殊技出石头，前置普攻0下。石头后可选点普攻接猜拳，最多两段；也可不插，8秒内接剪刀。','Tap EX for Rock with enough Energy; no Basic first. After Rock, optionally tap Basic for up to two follow-up hits, or skip them and use Scissors within 8s.');
      }else if(key==='dialyn-scissors'){
        press('石头后8秒内、能量够时点强化特殊技出剪刀，不必先打普攻。剪刀后可选点普攻接猜拳，最多两段；赶窗口可不插，8秒内接布。','Within 8s of Rock, tap EX for Scissors with enough Energy; no Basic is required. After Scissors, optionally tap Basic for up to two follow-up hits, or go straight to Paper within 8s.');
      }else if(key==='dialyn-paper'){
        press('剪刀后8秒内、能量够时直接点强化特殊技出布，不必先打普攻。让布命中；布后没有猜拳普攻。','Within 8s of Scissors, tap EX for Paper with enough Energy; no Basic is required. Land Paper. It has no guessing-game Basic follow-up.');
      }else {
        const zhao=key.endsWith('-paper');
        press('能量够时直接点三次强化特殊技：石头 → 8秒内剪刀 → 再在8秒内打布。起手不用普攻；只在石头或剪刀后可选插猜拳普攻，各最多两段。布后不插。'+(zhao?'布命中后再切照。':''),'With enough Energy, tap EX for Rock → Scissors within 8s → Paper within another 8s. No opening Basic. Only after Rock or Scissors, optionally add up to two Basic follow-up hits each. None after Paper.'+(zhao?' Switch to Zhao after Paper hits.':''));
      }
      continue;
    }
    if(key==='miyabi-build'){
      title('需要落霜可直接点强化特殊技，普攻另作积蓄','Tap EX for Fallen Frost; Basic is for separate buildup');
      press('要补落霜且能量够，直接点强化特殊技；前面不用打普攻。想先积烈霜，可打普攻第三至第五段。已有6点落霜时，先看下一步三段蓄力。','When you need Fallen Frost and have enough Energy, tap EX directly; no Basic is required first. To build Frost Anomaly first, use Basic hits 3–5. At six Fallen Frost, check the next charged Basic step.');
      if(s.displaySkillParts)s.displaySkillParts=s.displaySkillParts.map(v=>({...v,role:v.skillRef==='109100001'?'optional':'primary'}));
      continue;
    }
    if(ref==='120100003'){
      title('长按特殊技立即射击，或长按普攻瞄准后松开','Hold Special to fire immediately, or hold Basic to aim and release');
      press('普攻第五段、普通特殊技、强化特殊技或连携技后，长按特殊技可立即向前发射；普攻第五段只是一个入口。想自由瞄准则长按普攻，瞄好后松开发射，不必先打五段。','After Basic hit 5, Special, EX or Chain, hold Special to fire forward immediately. Hit 5 is one entry, not a prerequisite for every shot. To aim manually, hold Basic and release to fire; no five-hit string needed.');
      continue;
    }
    if(ref==='128100002'){
      title('长按特殊技起转；普攻只用于更快起转','Hold Special to spin; a Basic lead-in only accelerates the start');
      press('直接长按特殊技即可起转，前置普攻0下。想加快蓄力，可在普攻第一、二或三段后立即衔接；冲刺攻击或闪避反击后也可以。不必打满三段。','Hold Special directly to start spinning; no Basic first. For the faster start, link after Basic hit 1, 2 or 3, a Dash Attack or Dodge Counter. Finishing all three Basic hits is not required.');
      continue;
    }
    if(id==='1471'&&key==='loop-normal'){
      title('普攻第三或第四段接强化特殊技，地动中再输入派生','Link EX after Basic hit 3 or 4; enter the follow-up during Earth Shaker');
      press('走普攻起手：在「峥嵘」第三或第四段后点强化特殊技。也可在支援突击、闪避反击或快速支援后长按强化特殊技，不用先打普攻。地动发动期间，闪能够时快速输入「强化特殊技 → 强化特殊技 → 普攻」接山摇·怒；不要等地动结束。','For the Basic route, tap EX after hit 3 or 4 of the Basic string. Alternatively, hold EX after an Assist Follow-Up, Dodge Counter or Quick Assist without Basic first. During Earth Shaker, with enough Adrenaline, quickly enter EX → EX → Basic for the enhanced follow-up; do not wait for Earth Shaker to end.');
      // This sequence specifies the enhanced follow-up. The ordinary Mountain Tremor is not a third command.
      if(s.displaySkillParts)s.displaySkillParts=s.displaySkillParts.filter(v=>v.skillRef!=='147100009').map(v=>({...v,role:v.skillRef==='147100012'?'followup':v.role}));
      continue;
    }
    if(id==='1431'&&key==='burst-second-group'){
      title('空中下砸后点普攻；有剩余剑势才接强化特殊技','Dive, tap Basic, then use EX only with Sword Force left');
      press('空中点特殊技下砸打「灭」（强化下砸命中消耗2剑势）→ 还有剑势时点一下普攻接「极」（命中消耗1）。此时仍有至少1剑势且能衔接，才点强化特殊技接飞光；已耗尽就跳过末段。','In midair tap Special to dive (the enhanced dive spends 2 Sword Force on hit). With Sword Force remaining, tap Basic once for the next slash (1 on hit). Tap EX for the follow-up only in its link window with at least 1 still left; skip it at zero.');
      if(s.displaySkillParts)s.displaySkillParts=s.displaySkillParts.map(v=>({...v,role:v.skillRef==='143100012'?'conditional':v.role}));
      continue;
    }
    if(ref==='156100005'){
      const tail=s.positionAdapted?'动作完整结束、错误对象的提示消失且允许切人后，再普通换人。':'看到指定角色的入场提示再接。';
      press('风华至少90：长按特殊技或长按普攻，二选一。若用特殊技，无需另按普攻。'+tail,'At 90 Wind Grace or more, hold Special OR hold Basic; choose one. Using Special requires no extra Basic. '+(s.positionAdapted?'Finish the move, let the wrong prompt expire, then switch normally when allowed.':'Enter on the intended agent’s prompt.'));
      continue;
    }
    if(ref==='150100002'){
      title('长按普攻蓄力；有入口和应援可直接三蓄','Hold Basic to charge; shortcut to charge level 3 with an entry and support');
      press('普通蓄力可直接长按普攻，蓄到目标阶段再松开。想直接三蓄：快支、强化特殊技、普攻第四段、不加冰、三蓄、连携或终结技后，附近有至少2份应援能量时长按普攻。三蓄、连携或终结技后也可及时点按。妄想中若有全场应援，蓄力时优先消耗，每层升两级。','For a normal charge, hold Basic directly and release at the desired charge level. For instant level 3, hold Basic with at least two nearby support pickups after Quick Assist, EX, Basic hit 4, the No Ice Special, a level-3 charge, Chain or Ultimate. After a level-3 charge, Chain or Ultimate, a timely tap also works. In Delusion, a global support stack is spent first when charging and raises the level by two.');
      continue;
    }
    if(ref==='154100009'){
      press('走普攻路线，接到偏锋第五段下落；也可用坠霜或重霜的下落代替。有至少1点霜刑时，落地后保持长按普攻或特殊技，二选一，发动绝裁。若绝裁后还要续普攻，保持长按或点一下普攻，可直接回第五段。','On the Basic route, reach the hit-5 plunge. The two designated Special plunges are alternate entries. With at least one resource point, keep holding either Basic or Special on landing to activate Judgment. To continue after Judgment, keep holding or tap Basic once to return directly to hit 5.');
      continue;
    }
    // Action variants: only attribute a Basic follow-up to a route that actually includes it.
    if(ref==='109100004'){cue('本步强化特殊技可直接点；追加要再耗能，不需在两次之间插普攻。','Tap EX directly; its additional cast costs Energy again, with no Basic between them.');continue;}
    if(ref==='114100001'&&key==='lycaon-stunned-hit'){cue('只在还缺本轮对失衡目标的命中时点普攻命中一次；已经命中过就跳过。','Only tap Basic for one hit if the Stunned-target hit is still missing; otherwise skip.');continue;}
    if(ref==='122100008'&&!input.includes('普攻'))continue;
    if(ref==='140100010'&&!input.includes('普攻'))continue;
    if(ref==='145100003'&&!input.includes('普攻'))continue;
    if(ref==='143100023'&&key!=='opening-ye-enter')continue;
    if(ref==='161100007'&&!input.includes('普攻'))continue;
    if(ref==='154100001'&&key==='burst-prome-relink'){cue('绝裁后可保持长按，或点一下普攻，直接接第五段；不用从第一段重按。','After Judgment, keep holding or tap Basic to link directly to hit 5; do not restart the string.');continue;}
    if(ref==='159100002'&&key==='sigrid-formation'){cue('本步确认破阵后长按普攻，让第一至第三段连续打出；不是连点三下。','Once in Formation, hold Basic through hits 1–3; do not tap three times.');continue;}
    if(ref==='147100008'&&key.endsWith('-manual')){cue('普攻是派生指令中的键，不是出招前要先打的普通连段；按操作行顺序，在派生窗内输入四组。','Basic is part of the follow-up commands, not a preceding Basic string. Enter the four groups during their link windows in the order shown.');continue;}
    if(ref==='133100003'&&!input.includes('普攻')){cue('已浮游时，此路线普通切出自动悬落，不必点普攻。','In Suspension, this route descends automatically on switching out; no Basic press.');continue;}
    const known=DEDICATED_BASIC_CUES[ref];
    if(known)cue(...known);
  }
}
// Each entry describes Basic in the authored route. No row is selected by scanning a skill name.
function compileDedicatedRotation(ids, focusId, config, knowledge, B) {
  const guide = rotationDedicatedMatch(ids, knowledge);
  if (!guide) return null;
  const name = (id, en=false) => knowledge.agents[id][en ? 'nameEn' : 'name'];
  // An awakened kit may replace inputs or resource links in an authored lesson.
  // Only explicitly reviewed members may retain that lesson with Potential enabled.
  const potentialReviewed = new Set(guide.potentialReviewedIds || []);
  const unreviewed = ids.filter(id => (rotationBuild(config,id).potential || 0) > 0 && !potentialReviewed.has(id));
  if (unreviewed.length) {
    const reason = guide.baseOnlyReason;
    return {eligible:false, hint:B(
      `${unreviewed.map(id=>`${name(id)}潜能${rotationBuild(config,id).potential}阶`).join('、')}尚未完成本队专用合轴复核，当前使用对应潜能阶数的机制基础方案。${reason?.zh || ''}`,
      `${unreviewed.map(id=>`${name(id,true)} Potential rank ${rotationBuild(config,id).potential}`).join(', ')} has not been reviewed for this dedicated overlap. Using the foundation plan for the selected Potential ranks. ${reason?.en || ''}`.trim())};
  }
  const order = guide.requiredOrder;
  const ordered = !order || order.some((_, offset) => ids.every((id, i) => id === order[(i + offset) % 3]));
  if (focusId !== guide.focusId) return {eligible:false, hint:B(
    `已收录${guide.title.zh}，主要输出设为${name(guide.focusId)}时使用；当前主攻采用基础方案。`,
    `A dedicated ${guide.title.en} lesson is available with ${name(guide.focusId,true)} as the primary. This focus uses the foundation plan.`)};
  function enabled(when) {
    if (!when) return true;
    const build = rotationBuild(config,when.agentId);
    const potential = build.potential || 0;
    return build.mindscape >= (when.minMindscape || 0) && build.signature >= (when.minSignature || 0)
      && potential >= (when.minPotential ?? 0) && potential <= (when.maxPotential ?? Infinity);
  }
  const actions = new Map();
  const phases = guide.phases.map(phase => ({
    ...phase,
    steps: phase.steps.filter(s => enabled(s.when)).map((raw, index) => {
      const action = knowledge.dedicatedActions[raw.skillRef];
      const upgradedEntry=raw.entryMode==='upgradedChain';
      const actionId = `agent-${raw.actorId}-${raw.skillRef}${upgradedEntry?'-upgraded-entry':raw.choiceMode==='finisher'?'-finisher-choice':raw.alternateSkillRefs?.length?'-entry-choice':''}`;
      actions.set(actionId,{id:actionId,label:upgradedEntry ? B('选择升级连携入场','Select upgraded Chain entry') : raw.alternateSkillRefs?.length ? {...raw.actionLabel} : B(action.name,action.nameEn)});
      const step = {
        ...raw, id:`dedicated-${guide.id}-${phase.id}-${raw.key}`, actionId,
        sourceRefs:[...new Set([`agent-${raw.actorId}`,raw.skillRef,...(raw.alternateSkillRefs || []),...raw.sourceRefs])],
        background:(raw.background || []).map(b=>({...b})),
        handoff:raw.handoff ? {...raw.handoff} : null,
        evidence:'authored-team-teaching-crosschecked-against-fixed-mechanics'
      };
      // Persistent preferences never turn a conditional Ultimate into a guaranteed input.
      if (action.kind === 'ultimate') {
        step.trigger = upgradedEntry
          ? B(`升级连携窗口已实际出现且目标可命中。${step.trigger.zh}`,`The upgraded Chain prompt is actually available and the target is hittable. ${step.trigger.en}`)
          : B(`终结技已就绪且目标可命中。${step.trigger.zh}`,`Ultimate ready and target hittable. ${step.trigger.en}`);
      }
      return step;
    })
  }));
  // Entry attacks require their real prompts; a normal switch cannot execute them.
  for (const phase of phases) for (let i=0;i<phase.steps.length-1;i++) {
    const step=phase.steps[i], next=phase.steps[i+1];
    if (step.actorId===next.actorId || step.handoff) continue;
    const entry=knowledge.dedicatedActions[next.skillRef]?.kind;
    if (entry==='resourceEntry') {
      step.handoff={toId:next.actorId,kind:'resource-entry',signal:B(
        '按下一步的实际资源与形态登场；“视为快支”不代表需要普通快支提示。未满足时按恢复分支。',
        'Enter with the actual resources and form required next. Counting as Quick Assist does not require its ordinary prompt; use recovery if unavailable.')};
      step.sourceRefs.push(`agent-${next.actorId}`,next.skillRef);
    } else if (['quickAssist','defensiveAssist','chain'].includes(entry)) {
      const kind=next.alternateSkillRefs?.length?'entry-prompt':entry==='quickAssist'?'quick':entry==='chain'?'chain':'parry';
      step.handoff={toId:next.actorId,kind,signal:B(
        '只在下一步要求的支援／连携提示实际出现时接手；不代表当前招式一定触发它，无提示按恢复分支。',
        'Enter only on the actual Assist/Chain prompt required by the next step. This move does not guarantee that prompt; use the recovery branch if absent.')};
      step.sourceRefs.push(`agent-${next.actorId}`,next.skillRef);
    } else step.handoff={toId:next.actorId,kind:'normal',signal:B(
        '完成当前招式及必要命中后普通换人；按本步骤信号判断，不把它算成快支。',
        'Complete this move and its required hits, then switch normally following this step’s cue. This is not Quick Assist.')};
  }
  const positionNotes=!ordered?adaptDedicatedPosition(phases,guide,ids,knowledge,B,actions):[];
  applyTeamFollowalong(phases,knowledge);
  applyFollowSkillParts(phases);
  applyDedicatedBasic(phases);
  const conditions=guide.conditions.filter(c=>ordered||!/(站位|循环旋转|上一位必须|下一位必须|cyclic order|Order Astra)/i.test(c.zh+' '+c.en));
  for (const note of guide.configNotes || []) if(enabled(note.when)) conditions.push(note.text);
  conditions.push(B('配置说明只在对应门槛下生效；未实测更高影画的最优删步，仍按真实资源执行。',
    'Build notes apply only at their stated thresholds. Optimal high-investment shortcuts are unmeasured; follow actual resources.'));
  return {eligible:true,positionAdapted:!ordered,positionNotes,id:guide.id,title:guide.title,summary:guide.summary,
    phases,actions:[...actions.values()],sources:guide.sources,conditions};
}


return compileDedicatedRotation;
}

const $=id=>document.getElementById(id);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const JOURNAL_KEY='bagel-oracle-journal-v1';
let core,signData,spotData,ready=false,busy=false,result=null,birthForResult=null,journal=[],drawVersion=0,loadFailed=false;
const text=(id,value)=>{$(id).textContent=value;};
const status=value=>text('oracle-status',value);
function safeURL(value){try{const url=new URL(value);return url.protocol==='https:'?url.href:'';}catch{return '';}}
function sourceLink(url,label){const safe=safeURL(url);return safe?`<a href="${escape(safe)}" target="_blank" rel="noreferrer">${escape(label)} ↗</a>`:'';}
function selectedCities(){return [...document.querySelectorAll('#oracle-cities input:checked')].map(input=>input.value);}
function syncCitySelection(){text('oracle-city-selection',`已选 ${selectedCities().length} 个街区`);}
function selectAllCities(checked){
  if(!ready||busy)return;
  const inputs=[...document.querySelectorAll('#oracle-cities input')],changed=inputs.find(input=>input.checked!==checked);
  for(const input of inputs)input.checked=checked;
  // One input event follows the same location-only update as a single checkbox.
  if(changed)changed.dispatchEvent(new Event('input',{bubbles:true}));else syncCitySelection();
}
function readBirth(){
  if(document.querySelector('input[name="mode"]:checked').value==='general')return null;
  const number=id=>$(id).value.trim()===''?NaN:Number($(id).value);
  return {calendar:$('birth-calendar').value,year:number('birth-year'),month:number('birth-month'),day:number('birth-day'),hour:$('birth-time-known').checked?Number($('birth-hour').value):null,minute:$('birth-time-known').checked?number('birth-minute'):0,leap:$('birth-calendar').value==='lunar'&&$('birth-leap').checked};
}
function syncForm(){const general=document.querySelector('input[name="mode"]:checked').value==='general';$('birth-fields').hidden=general;$('general-note').hidden=!general;$('leap-field').hidden=$('birth-calendar').value!=='lunar';$('birth-hour').disabled=!$('birth-time-known').checked;$('birth-minute').disabled=!$('birth-time-known').checked;}
function clearResult(){drawVersion++;result=null;birthForResult=null;$('oracle-result').hidden=true;$('oracle-waiting').hidden=false;$('oracle-locations').hidden=true;$('oracle-explanation').hidden=true;for(const id of ['oracle-pillars','oracle-reasons','location-cards'])$(id).replaceChildren();if(ready)status('填写完成后求签，或选择今日通用签。');}
function updateDate(){if(core){text('oracle-day',`${core.dailyKey()} · 当地时间`);$('oracle-day').title='跟随设备时区：'+Intl.DateTimeFormat().resolvedOptions().timeZone;}}
function checkDay(){if(!ready)return;updateDate();if(result&&result.day!==core.dailyKey())status('当前签文的日期与当地日期不同，请重新求取今日签。');}
function eraseBirth(){for(const id of ['birth-year','birth-month','birth-day'])$(id).value='';$('birth-minute').value='0';$('birth-hour').value='12';$('birth-calendar').value='solar';$('birth-leap').checked=false;$('birth-time-known').checked=true;clearResult();syncForm();}
function renderSign(sign,day){
  text('sign-number',`第 ${sign.id} 签${sign.code?' · 签序 '+sign.code:''}`);text('sign-grade',sign.grade||'原本未标');text('sign-title',sign.title||`第 ${sign.id} 签`);
  $('sign-poem').replaceChildren(...sign.poem.map(line=>{const p=document.createElement('p');p.textContent=line;return p;}));
  text('sign-summary',sign.summary);text('sign-advice',sign.calmAdvice||'');$('sign-source').href=safeURL(sign.sourceUrl);text('sign-date',`${day} · 当地时间`);
}
function renderLocations(){
  $('location-cards').innerHTML=result.spotRecommendations.map(({spot,score,scoreReasons},index)=>`<article class="location-card"><div class="location-heading"><span class="mini-label">${index===0?'今日主荐':'备选吉位 · '+index}</span><span class="location-element" title="本站设定的场景意象">${escape(spot.element)}</span><h3>${escape(spot.name)}</h3><p>${escape(spot.city)} · ${escape(spot.landmark)}</p></div><div class="location-body"><p class="location-direction">宜向 · ${escape(spot.orientation)}</p><ol>${spot.approach.map(step=>`<li>${escape(step)}</li>`).join('')}</ol><details><summary>为何选这里 · 查看依据</summary><p>${escape(spot.rationale)}</p><ul>${scoreReasons.map(reason=>`<li>${escape(reason)}</li>`).join('')}</ul><p>${spot.sourceUrls.map((url,i)=>sourceLink(url,`地标资料 ${i+1}`)).join(' ')}</p></details><div class="location-score"><span>地点匹配分 · ${score} 分</span><span>娱乐排序</span></div></div></article>`).join('');
  if(!result.spotRecommendations.length)$('location-cards').innerHTML='<p class="oracle-field-note">所选街区暂无已核对的点位。签文已保留，可调整街区选择。</p>';
  $('oracle-locations').hidden=false;
}
function renderExplanation(){
  const chart=result.birthChart;
  if(chart){$('oracle-pillars').innerHTML=`<span class="mini-label">${chart.timeKnown?'生辰排盘':'简化排盘 · 时辰未知'}</span><div class="pillar-grid">${[['year','年柱'],['month','月柱'],['day','日柱'],['hour','时柱']].map(([key,label])=>`<div class="pillar-cell"><span>${label}</span><b>${escape(chart.pillars[key]||'未定')}</b>${chart.possiblePillars?.[key]?`<span>${escape(chart.possiblePillars[key].join(' / '))}</span>`:''}</div>`).join('')}</div><p class="birth-summary">公历 ${escape(chart.solar.text)} · 农历 ${escape(chart.lunar.text)}<br>出生日干：${escape(chart.dayStem)} · 所属五行：${escape(chart.element)}。今日干：${escape(result.today.dayStem)}（${escape(result.today.element)}）。</p>${chart.warnings.map(w=>`<p class="birth-summary">${escape(w)}</p>`).join('')}`;
  }else{$('oracle-pillars').innerHTML=`<span class="mini-label">今日通用签</span><p class="birth-summary">本次未使用出生资料。今日干为 ${escape(result.today.dayStem)}（${escape(result.today.element)}），仅用于地点的趣味匹配。</p>`;}
  const sign=result.sign;
  $('oracle-reasons').innerHTML=`<p class="birth-summary">${escape(result.reason)}</p><ol class="oracle-rule-list">${result.rules.map(rule=>`<li><strong>${escape(rule.title)}</strong>：${escape(rule.text)}</li>`).join('')}</ol><details><summary>原签出处与校记</summary><p class="birth-summary">${escape(signData.edition.description||signData.edition.title)}<br>${escape(signData.edition.provenanceNote||'')}${sign.scanPage?'<br>古籍扫描页：'+escape(sign.scanPage):''}${sign.transcriptionNote?'<br>'+escape(sign.transcriptionNote):''}</p>${sourceLink(sign.sourceUrl,'原签转录')} ${sourceLink(signData.edition.scanUrl,'底本扫描')}</details>`;
  $('oracle-explanation').hidden=false;
}
function showResult(next){result=next;renderSign(result.sign,result.day);renderLocations();renderExplanation();$('oracle-waiting').hidden=true;$('oracle-result').hidden=false;$('oracle-paper').classList.remove('just-revealed');requestAnimationFrame(()=>$('oracle-paper').classList.add('just-revealed'));text('save-sign','收入签簿');status('签已落定。往下查看推荐地点与解签依据。');}
async function draw(event){
  event.preventDefault();if(busy)return;if(!ready){if(loadFailed)location.reload();else await init();return;}
  updateDate();const birth=readBirth(),cities=selectedCities();
  if(!cities.length){status('请至少选择一个已解锁街区。');return;}
  if(birth){const validation=core.validateBirth(birth);if(!validation.valid){status(validation.errors.join(' '));return;}}
  let next;try{next=core.buildOracle({birth,day:core.dailyKey(),signs:signData.signs,spots:spotData.spots,selectedCities:cities});}catch{status('暂时无法完成排盘，请核对日期和历法后重试。');return;}
  busy=true;const token=++drawVersion;$('oracle-form').inert=true;$('draw-button').disabled=true;$('oracle-paper').classList.add('is-drawing');status('静候一签…');
  try{await new Promise(resolve=>setTimeout(resolve,matchMedia('(prefers-reduced-motion: reduce)').matches?30:1100));if(token!==drawVersion)return;birthForResult=birth;showResult(next);$('sign-title').focus({preventScroll:true});if(innerWidth<701)$('oracle-paper').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}
  finally{busy=false;$('oracle-form').inert=false;$('draw-button').disabled=false;$('oracle-paper').classList.remove('is-drawing');}
}
function readJournal(){
  try{const stored=JSON.parse(localStorage.getItem(JOURNAL_KEY)||'[]');if(!Array.isArray(stored))return[];return stored.filter(entry=>entry&&/^\d{4}-\d{2}-\d{2}$/.test(entry.day)&&signData.signs.some(s=>s.id===entry.signId)&&Array.isArray(entry.spotIds)).slice(0,30).map(entry=>({day:entry.day,signId:entry.signId,spotIds:entry.spotIds.filter(id=>typeof id==='string'&&spotData.spots.some(s=>s.id===id)).slice(0,3)}));}catch{return[];}
}
function renderJournal(){
  $('clear-journal').hidden=!journal.length;
  if(!journal.length){$('oracle-journal').innerHTML='<p class="oracle-field-note">签簿保存日期、签号与地点，不保存生辰。</p>';return;}
  $('oracle-journal').innerHTML=`<div class="journal-grid">${journal.map((entry,index)=>{const sign=signData.signs.find(s=>s.id===entry.signId);return `<button class="journal-entry" type="button" data-journal="${index}"><span>${escape(entry.day)} · 第 ${entry.signId} 签</span><b>${escape(sign.title)}</b></button>`;}).join('')}</div>`;
}
function saveSign(){
  if(!result)return;
  const entry={day:result.day,signId:result.sign.id,spotIds:result.spotRecommendations.map(r=>r.spot.id)};
  const next=[entry,...journal.filter(e=>!(e.day===entry.day&&e.signId===entry.signId))].slice(0,30);
  try{localStorage.setItem(JOURNAL_KEY,JSON.stringify(next));journal=next;renderJournal();text('save-sign','已收入签簿');status('已保存日期、签号和地点；出生资料未写入签簿。');}catch{status('浏览器暂不允许保存。你可以使用“保存签卡”留存本次签文。');}
}
function showCatalogSign(id,savedEntry){
  const sign=signData.signs.find(s=>s.id===Number(id));if(!sign)return;
  $('catalog-detail').innerHTML=`<button type="button" id="catalog-back">← 返回百签目录</button><h3>第 ${sign.id} 签 · ${escape(sign.title)}</h3><p>${escape(sign.code||'')} <span class="sign-grade">${escape(sign.grade||'原本未标')}</span></p><span class="mini-label i18n-english-only" lang="en">Original poem · Chinese</span><div class="sign-poem" data-i18n-skip lang="zh-CN">${sign.poem.map(line=>`<p>${escape(line)}</p>`).join('')}</div><span class="mini-label">白话解签 · 本站整理</span><p>${escape(sign.summary)}</p><p>${escape(sign.calmAdvice||'')}</p>${savedEntry?`<span class="mini-label">签簿记录 · ${escape(savedEntry.day)}</span><p>${savedEntry.spotIds.map(id=>spotData.spots.find(s=>s.id===id)).filter(Boolean).map(s=>escape(s.city+' · '+s.name)).join('<br>')||'未记录地点'}</p>`:''}<span class="mini-label">出处与校记</span><p>${escape(sign.transcriptionNote||signData.edition.provenanceNote||'据传统签谱转录。')}${sign.scanPage?' · 扫描页 '+escape(sign.scanPage):''}</p>${sourceLink(sign.sourceUrl,'原签出处')} ${sourceLink(signData.edition.scanUrl,'底本扫描')}<p class="oracle-field-note">此处为签谱查阅，不会替换今日求签结果。</p>`;
  $('catalog-list').hidden=true;$('catalog-search').parentElement.hidden=true;$('catalog-detail').hidden=false;$('catalog-dialog').scrollTop=0;$('catalog-back').onclick=showCatalogList;
}
function showCatalogList(){
  const query=$('catalog-search').value.trim();const matches=signData.signs.filter(sign=>!query||String(sign.id)===query||window.DUKE_I18N.matches([sign.title,sign.grade,...sign.poem],query));
  $('catalog-list').innerHTML=matches.length?matches.map(sign=>`<button type="button" data-sign="${sign.id}">第 ${sign.id} 签<span>${escape(sign.grade||'未标')}</span></button>`).join(''):'<p class="oracle-field-note">没有找到匹配的签文。</p>';
  $('catalog-list').hidden=false;$('catalog-search').parentElement.hidden=false;$('catalog-detail').hidden=true;$('catalog-dialog').scrollTop=0;
}
function wrapText(ctx,value,x,y,maxWidth,lineHeight){
  const translated=window.DUKE_I18N.t(value);let line='';
  // English words stay together; Chinese keeps the original per-character wrapping.
  const english=window.DUKE_I18N.language==='en',parts=english?(translated.match(/\S+\s*/g)||[]):[...translated];
  const draw=()=>{ctx.fillText(english?line.trimEnd():line,x,y);y+=lineHeight;line='';};
  for(const part of parts){
    if(line&&ctx.measureText(line+(english?part.trimEnd():part)).width>maxWidth)draw();
    if(english&&ctx.measureText(part.trimEnd()).width>maxWidth){for(const char of part){if(line&&ctx.measureText(line+char).width>maxWidth)draw();line+=char;}}
    else line+=part;
  }
  if(line)draw();return y;
}
async function exportCard(){
  if(!result)return;const snapshot=result;const button=$('share-sign');button.disabled=true;
  try{
    const uiFont=window.DUKE_I18N.language==='en'?'"Segoe UI",Arial,sans-serif':'"Microsoft YaHei",sans-serif';
    const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=1420;const ctx=window.DUKE_I18N.canvasContext(canvas.getContext('2d'));ctx.fillStyle='#f8f0df';ctx.fillRect(0,0,1000,1420);ctx.strokeStyle='#b59158';ctx.lineWidth=2;ctx.strokeRect(34,34,932,1352);ctx.strokeRect(46,46,908,1328);
    ctx.textAlign='center';ctx.fillStyle='#8f493e';ctx.font='24px '+uiFont;ctx.fillText('DUKE · 绳匠灵签',500,114);ctx.fillStyle='#81725b';ctx.font='21px '+uiFont;ctx.fillText('关圣帝君灵签 · 第 '+snapshot.sign.id+' 签 · '+snapshot.sign.grade,500,174);
    ctx.fillStyle='#40372c';ctx.font=window.DUKE_I18N.language==='en'?'42px Georgia,serif':'42px "SimSun",serif';let y=wrapText(ctx,snapshot.sign.title,500,249,820,54);y=Math.max(y+40,350);ctx.font='45px "SimSun",serif';window.DUKE_I18N.canvasLiteral(ctx,()=>{for(const line of snapshot.sign.poem){ctx.fillText(line,500,y);y+=84;}});if(window.DUKE_I18N.language==='en'){ctx.font='18px sans-serif';ctx.fillText('Original poem · Chinese',500,699);}
    ctx.strokeStyle='#cbb895';ctx.beginPath();ctx.moveTo(110,720);ctx.lineTo(890,720);ctx.stroke();ctx.textAlign='left';ctx.fillStyle='#8f493e';ctx.font='20px '+uiFont;ctx.fillText('白话解签 · 本站整理',110,765);ctx.fillStyle='#514839';ctx.font='24px '+uiFont;y=wrapText(ctx,snapshot.sign.summary,110,812,780,39);
    const spot=snapshot.spotRecommendations[0]?.spot;if(spot){y=Math.max(y+35,1002);ctx.fillStyle='#8f493e';ctx.font='20px '+uiFont;ctx.fillText('今日寻吉 · 游戏趣味演绎',110,y);ctx.fillStyle='#40372c';ctx.font='28px '+uiFont;y=wrapText(ctx,spot.city+' · '+spot.name,110,y+48,780,42);ctx.font='22px '+uiFont;wrapText(ctx,'宜向：'+spot.orientation,110,y+17,780,36);}
    ctx.textAlign='center';ctx.font='19px '+uiFont;ctx.fillStyle='#81725b';ctx.fillText(snapshot.day+' · 求签时当地日期',500,1250);ctx.font='18px '+uiFont;ctx.fillText('民俗娱乐 · 调频概率以游戏规则为准',500,1293);ctx.font='16px '+uiFont;ctx.fillText('姑苏钮氏藏板清刊本 · 签文出处见本站签谱',500,1330);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('export');const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`绳匠灵签-${snapshot.day}-第${snapshot.sign.id}签.png`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);status('签卡已生成，图片不包含出生资料。');
  }catch{status('签卡生成失败，请稍后重试。');}finally{button.disabled=false;}
}
async function init(){
  if(busy)return;busy=true;ready=false;$('draw-button').disabled=true;status('正在载入签谱与排盘工具…');
  try{
    const get=async url=>{const response=await fetch(url,{cache:'no-cache',credentials:'omit'});if(!response.ok)throw Error('data');return response.json();};
    const [module,signs,spots]=await Promise.all([import('./oracle-core.js?v=20260909-version-3-2-1'),get('oracle-signs.json?v=20260914-duke-brand-1'),get('oracle-spots.json?v=20260909-version-3-2-1')]);
    if(signs.signs?.length!==100||new Set(signs.signs.map(s=>s.id)).size!==100||signs.signs.some(s=>!Array.isArray(s.poem)||s.poem.length!==4||!s.summary)||!spots.cities?.length||!spots.spots?.length)throw Error('catalog');
    core=module;signData=signs;spotData=spots;ready=true;loadFailed=false;updateDate();
    $('oracle-cities').innerHTML=spots.cities.map(city=>`<label><input type="checkbox" value="${escape(city.id)}" checked>${escape(city.name)}</label>`).join('');text('oracle-city-coverage',`已收录 ${spots.cities.length} 个街区 · ${spots.spots.length} 处地标`);syncCitySelection();$('oracle-cities-all').disabled=false;$('oracle-cities-none').disabled=false;journal=readJournal();renderJournal();$('catalog-open').disabled=false;status('签谱已备妥。填写生辰，或求一支今日通用签。');$('draw-button').innerHTML='<span aria-hidden="true">✦</span> 静心求一签';
  }catch{loadFailed=true;status('签谱或排盘工具暂时未能载入，请刷新后重试。');text('draw-button','重新载入资料');}
  finally{busy=false;$('draw-button').disabled=false;}
}
$('birth-hour').innerHTML=Array.from({length:24},(_,i)=>`<option value="${i}" ${i===12?'selected':''}>${String(i).padStart(2,'0')} 时</option>`).join('');
$('oracle-form').addEventListener('submit',draw);
$('oracle-form').addEventListener('input',event=>{syncForm();if(event.target.closest('#oracle-cities'))syncCitySelection();if(event.target.closest('#oracle-cities')&&result&&ready){try{showResult(core.buildOracle({birth:birthForResult,day:result.day,signs:signData.signs,spots:spotData.spots,selectedCities:selectedCities()}));status('已更新地点候选，签文保持不变。');checkDay();}catch{status('地点更新失败，请重新求签。');}}else clearResult();});
$('oracle-cities-all').onclick=()=>selectAllCities(true);$('oracle-cities-none').onclick=()=>selectAllCities(false);
$('save-sign').onclick=saveSign;$('share-sign').onclick=exportCard;
$('clear-journal').onclick=()=>{try{localStorage.removeItem(JOURNAL_KEY);journal=[];renderJournal();status('签簿已清空。');}catch{status('浏览器暂不允许修改签簿。');}};
$('catalog-open').onclick=()=>{if(!ready)return;$('catalog-search').value='';showCatalogList();$('catalog-dialog').showModal();};
$('catalog-close').onclick=()=>$('catalog-dialog').close();
$('catalog-list').onclick=event=>{const target=event.target.closest('[data-sign]');if(target)showCatalogSign(target.dataset.sign);};
$('catalog-search').oninput=showCatalogList;
$('oracle-journal').onclick=event=>{const target=event.target.closest('[data-journal]');if(!target)return;const entry=journal[Number(target.dataset.journal)];showCatalogSign(entry.signId,entry);$('catalog-dialog').showModal();};
window.addEventListener('storage',event=>{if(ready&&(event.key===JOURNAL_KEY||event.key===null)){journal=readJournal();renderJournal();}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkDay();});
setInterval(()=>{if(!document.hidden)checkDay();},60000);
// Clear values restored by browser form history, including the back/forward cache.
window.addEventListener('pageshow',()=>eraseBirth());
window.addEventListener('pagehide',()=>eraseBirth());
eraseBirth();init();

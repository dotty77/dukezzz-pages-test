// Video regions are not entity coordinates or verified Hematite drop records.
// Keep them out of route targets until an individual location is matched.
const video='https://www.bilibili.com/video/BV1wo4D6HEpn/';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=(zh,en,tag='span')=>`<${tag} data-i18n-en="${escape(en)}">${escape(zh)}</${tag}>`;
export const bossCommunityRegions=[
 {map:'janus',label:'光映中心二楼',labelEn:'Lumina Central, 2F',phase:'恶噪一、二阶段',phaseEn:'Cacophony phases 1 and 2',time:70},
 {map:'janus',label:'商业步道',labelEn:'Shopping Promenade',phase:'恶噪第三阶段',phaseEn:'Cacophony phase 3',time:124},
 {map:'suburbs',label:'风蚀公路·加油站门口',labelEn:'Windworn Highway Gas Station entrance',phase:'受恶噪影响时；可能为首领或精英',phaseEn:'When affected by Cacophony; boss or elite variant',time:166},
 {map:'suburbs',label:'野人镇·芝邦邦餐厅后门',labelEn:'Cheezburg Bistro rear entrance, Bunless Bae Town',phase:'恶噪一、二阶段',phaseEn:'Cacophony phases 1 and 2',time:200},
 {map:'suburbs',label:'野人镇·空轨下方',labelEn:'Beneath the Skyrail, Bunless Bae Town',phase:'恶噪一、二阶段',phaseEn:'Cacophony phases 1 and 2',time:221},
 {map:'suburbs',label:'魅影水族馆正门',labelEn:'Phantom Aquarium main entrance',phase:'恶噪一、二阶段',phaseEn:'Cacophony phases 1 and 2',time:253}
];

export function bossCommunityDetails(map){
 const regions=bossCommunityRegions.filter(row=>row.map===map);if(!regions.length)return '';
 return `<details class="ore-reward-guide boss-community-guide">
 ${text(`首领与假狗线索 · 本图 ${regions.length} 处`,`Boss and mimic clues · ${regions.length} areas on this map`,'summary')}
 ${text('作者实测经验：可被假狗替换的首领，暂未见其容器出碎片。以下仅是区域线索，尚未逐点对应导航坐标。','Creator observations: no Hematite drops observed from these replaceable bosses. These are area references; individual route coordinates are still unverified.','p')}
 <ul>${regions.map(row=>`<li><a href="${video}?t=${row.time}" target="_blank" rel="noreferrer">${text(row.label,row.labelEn)} ↗</a><br>${text(row.phase,row.phaseEn)}</li>`).join('')}</ul>
 ${text('杀死大狗后，被替换的敌人会回来（作者说明）。','The creator reports that replaced enemies return after the dog is defeated.','p')}
 ${map==='janus'?text('作者另在评论中说明：雅努斯波可娜、白鸽二期工程的简不出碎片。','The creator also reports no Hematite drops from Janus Pulchra or Jane at Dove Phase II Project.','p'):''}
 <p><a href="https://www.bilibili.com/video/BV1ATeU6aEA7/" target="_blank" rel="noreferrer">${text('首领识别与击杀演示','Boss identification and combat demonstrations')} ↗</a><br>${text('演示中的首领名单，不等于碎片掉落名单。','A combat demonstration does not establish Hematite drops.')}</p>
 <p><a href="https://www.bilibili.com/video/BV1B2tA61ELV/?t=104" target="_blank" rel="noreferrer">${text('碎片规则实测与适用范围','Hematite tests and their limits')} ↗</a></p>
 </details>`;
}

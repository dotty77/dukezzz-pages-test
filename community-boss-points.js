// Player-map areas only. This module never creates world positions or routes.
const MAPS=new Set(['janus','suburbs']);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=(zh,en)=>`<span data-i18n-en="${escape(en)}">${escape(zh)}</span>`;
export function safeCommunityBossURL(value){
 if(typeof value!=='string')return null;
 if(/^assets\/map-sources\/[a-zA-Z0-9._-]+\.(?:png|jpe?g|webp)$/.test(value))return value;
 try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null;}catch{return null;}
}
export function normalizeCommunityBossPoints(data){
 if(data?.schemaVersion!==1||!Array.isArray(data.maps))throw Error('玩家首领图资料格式无效');
 const seenMaps=new Set(),ids=new Set(),result={janus:[],suburbs:[]};
 for(const layer of data.maps){
  if(!MAPS.has(layer.map)||seenMaps.has(layer.map)||!Array.isArray(layer.points))throw Error('玩家首领图地图格式无效');
  seenMaps.add(layer.map);
  for(const p of layer.points){
   if(!/^CY-[JS]-B\d[\d-]*$/.test(p.id)||ids.has(p.id)||!p.id.startsWith(layer.map==='janus'?'CY-J-':'CY-S-')||
      ![p.x,p.y].every(v=>Number.isFinite(v)&&v>=0&&v<=1)||p.worldPosition!==null||p.routeEligible!==false||
      !Array.isArray(p.bossNumbers)||!p.bossNumbers.length||!p.bossNumbers.every(n=>Number.isInteger(n)&&n>0)||!safeCommunityBossURL(p.sourceUrl))throw Error('玩家首领图点位缺少有效位置或来源');
   ids.add(p.id);
   const excluded=[...new Set([...(p.excludedBossNumbers||[]),...(layer.map==='janus'?[21,24]:[])])];
   const activeBossNumbers=p.bossNumbers.filter(n=>!excluded.includes(n));
   if(p.excludedByAuthor||!activeBossNumbers.length)continue;
   result[layer.map].push({...p,map:layer.map,type:'enemy',sourceKind:'community_boss',coordinateSpace:'source-image-normalized',
    status:'conditional',sourceStatus:p.status,worldPosition:null,exactEntityIds:[],routeEligible:false,
    floors:[],floorEvidence:'unlabelled',sourceImage:null,activeBossNumbers,
    label:`首领候选 ${activeBossNumbers.join(' / ')} · 玩家图`,labelEn:`Boss candidate ${activeBossNumbers.join(' / ')} · player map`,
    sourceLabel:p.label,sourceLabelEn:p.labelEn,
    note:p.note||'玩家图首领区域，刷新和碎片掉落以本局为准。',
    noteEn:p.noteEn||'A boss area marked on a player map. Spawns and Hematite Shard drops depend on the current run.',
    sourceUrl:safeCommunityBossURL(p.sourceUrl),sourceImageUrl:safeCommunityBossURL(p.sourceImageUrl),sourceVideoUrl:safeCommunityBossURL(p.sourceVideoUrl)});
  }
 }
 if(seenMaps.size!==2)throw Error('玩家首领图缺少地图');
 return result;
}
export async function loadCommunityBossPoints(){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
 try{const response=await fetch(new URL('./research/community-boss-points.json?v=20260919-site-refresh-1',import.meta.url),{signal:controller.signal});if(!response.ok)throw Error('玩家首领图暂未加载');return normalizeCommunityBossPoints(await response.json());}finally{clearTimeout(timer);}
}
export function communityBossDetails(p){
 if(p.sourceKind!=='community_boss')return '';
 const priority={recommended:['作者建议优先击杀','Recommended by the map author'],'optional-random':['作者标注为概率刷新','Marked as a random spawn by the author'],'bug-warning':['作者提示可能出现战斗异常','Author warns of possible combat bugs']}[p.authorPriority];
 const excluded=p.bossNumbers.filter(n=>!p.activeBossNumbers.includes(n));
 const probability=p.probabilitySourceText?`<p>${text(p.probabilitySourceText,p.probabilitySourceTextEn||'The author’s spawn note is unverified for the current run.')}</p>`:'';
 const links=[[p.sourceUrl,'作者原文 ↗','Author’s post ↗'],[p.sourceImageUrl,p.currentArticleDifferentNumbering?'本次使用的旧版原图（2026-09-19 截图）↗':'作者原图 ↗',p.currentArticleDifferentNumbering?'Older map used here (screenshot received 2026-09-19) ↗':'Author’s original map ↗'],[p.sourceVideoUrl,'作者路线视频 ↗','Author’s route video ↗']].filter(([url])=>safeCommunityBossURL(url));
 return `<section class="callout community-boss-detail"><b>${text('玩家图首领候选','Player-map boss candidate')}</b><p>${text('这是玩家地图标出的首领区域，可能掉落碎片；是否刷新和实际掉落以本局为准。','This player-marked boss area may yield Hematite Shards. Spawns and actual drops depend on the current run.')}</p>${priority?`<p>${text(...priority)}</p>`:''}${probability}${p.authorSkipSuggested?`<p>${text('作者建议视情况跳过；保留为可检查候选。','The author suggests skipping this area when appropriate; it remains an optional candidate.')}</p>`:''}${excluded.length?`<p>${text(`原图合并编号 ${p.bossNumbers.join(' / ')}；已排除 ${excluded.join(' / ')}，其余号码共享一个区域标记。`,`The source combines numbers ${p.bossNumbers.join(' / ')}. Number(s) ${excluded.join(' / ')} are excluded; the others share one area marker.`)}</p>`:''}${p.currentArticleDifferentNumbering?`<p>${text('使用用户于2026-09-19提供的旧版1–18编号；作者当前文章已改号，不能直接套用新版编号和排除结论。','Uses the older 1–18 numbering in the screenshot supplied on 2026-09-19. The author’s current post uses different numbers; its exclusions cannot be transferred by number alone.')}</p>`:''}${p.controversy?`<p>${text(p.controversy,p.controversyEn||'Available accounts disagree about this area. It remains a possible, unverified candidate; no definite drop or Hound identity is asserted.')}</p>`:''}<p>${text('位置仅按原图配准，未核实世界坐标或楼层；此标记不能生成世界路线。','Position is registered from the source image; world coordinates and floor are unverified. This marker cannot generate a world route.')}</p>${links.map(([url,zh,en])=>`<p><a href="${escape(url)}" target="_blank" rel="noreferrer">${text(zh,en)}</a></p>`).join('')}</section>`;
}

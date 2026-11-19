/* Personal positions retain their original coordinate space. No cross-map inference. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id), atlas=window.atlas, workspace=document.querySelector('.workspace');
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const tr=(zh,en)=>window.DUKE_I18N?.language==='en'?en:zh;
 const options={clean:false,showPersonal:true};let placement=null,editing=null,imported=null;
 const source=()=>atlas.state.source2d,adapter=()=>window.mapToolAdapters?.[source()];
 const custom=()=>atlas.personal.custom;
 const isWorld=p=>p.coordinateSpace==='source-world';
 const ownPoints=view=>custom().filter(p=>p.map===atlas.state.map&&(view==='native')===isWorld(p));
 const toast=atlas.toast;
 const bar=document.createElement('div');bar.id='map-tools';bar.setAttribute('aria-label','地图工具');
 bar.innerHTML=`<button id="map-add-marker" class="map-add-marker" type="button" aria-pressed="false">＋ 添加标记</button><button id="map-personal-list" type="button">我的标记 <span id="map-personal-count">0</span></button><button id="map-clean" type="button" aria-pressed="false">纯净底图</button><label class="map-personal-toggle"><input id="map-show-personal" type="checkbox" checked>个人标记</label><div class="map-rotation-tools" role="group" aria-label="旋转地图"><button id="map-rotate-left" type="button" aria-label="逆时针旋转45度">↶</button><button id="map-bearing" type="button" title="恢复默认朝向" aria-label="恢复默认朝向"><span id="map-compass">↑</span> <span id="map-degrees">0°</span></button><button id="map-rotate-right" type="button" aria-label="顺时针旋转45度">↷</button></div><button id="map-fullscreen" type="button" aria-pressed="false">⛶ 全屏</button><button id="map-export-image" type="button">导出图片</button><details class="map-backup-tools"><summary>备份</summary><div><button id="map-export-personal" type="button">导出个人记录</button><button id="map-import-personal" type="button">恢复个人记录</button></div></details>`;
 const more=document.createElement('button');
 more.id='map-view-toggle';more.type='button';
 more.setAttribute('aria-expanded','false');more.setAttribute('aria-controls','map-view-options');
 const moreLabel=document.createElement('span');moreLabel.dataset.i18nEn='More tools';moreLabel.textContent='更多工具';more.append(moreLabel);
 const viewOptions=document.createElement('div');viewOptions.id='map-view-options';
 const addMarker=bar.querySelector('#map-add-marker');
 while(addMarker.nextSibling)viewOptions.append(addMarker.nextSibling);
 bar.append(more,viewOptions);
 more.addEventListener('click',()=>more.setAttribute('aria-expanded',String(more.getAttribute('aria-expanded')!=='true')));
 bar.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&more.offsetWidth&&more.getAttribute('aria-expanded')==='true'){
   event.stopPropagation();more.setAttribute('aria-expanded','false');more.focus();
  }
 });
 document.querySelector('.toolbar').after(bar);
 const help=document.createElement('div');help.id='map-tools-help';help.textContent='左键拖动平移 · 右键拖动旋转 · 滚轮缩放';bar.after(help);
 const dialog=document.createElement('dialog');dialog.id='map-marker-dialog';
 dialog.innerHTML=`<form id="map-marker-form"><h2 id="map-marker-title">添加个人标记</h2><p id="map-marker-space" class="small muted"></p><label>名称<input id="map-marker-name" maxlength="80" required placeholder="例如：先去这里"></label><div class="map-marker-grid"><label>类型<select id="map-marker-kind"><option value="custom">个人位置</option><option value="spawn">出生点</option><option value="exit">撤离点</option><option value="electronic">电子保险箱</option><option value="mechanical">机械保险箱</option><option value="gear">武备箱</option></select></label><label>标记颜色<input id="map-marker-color" type="color" value="#ffb65e"></label></div><label id="map-marker-height-label">高度 Y<input id="map-marker-height" type="number" step="any" min="-100000" max="100000"><small>俯视点击无法确定楼层，请按附近点位或高度筛选填写。</small></label><label>备注<textarea id="map-marker-note" maxlength="2000" placeholder="位置说明、路线或注意事项"></textarea></label><p class="small muted">保存在当前浏览器，可通过“备份”导出到其他设备。</p><div class="map-marker-actions"><button id="map-marker-delete" type="button" hidden>删除标记</button><button id="map-marker-move" type="button" hidden>重新选位置</button><button id="map-marker-cancel" type="button">取消</button><button class="primary-button" type="submit">保存标记</button></div></form>`;
 // Dialogs belong to the fullscreen element so they remain visible there.
 workspace.append(dialog);
 const listDialog=document.createElement('dialog');listDialog.id='map-marker-list-dialog';workspace.append(listDialog);
 const restoreDialog=document.createElement('dialog');restoreDialog.id='map-restore-dialog';workspace.append(restoreDialog);
 const file=document.createElement('input');file.type='file';file.accept='.json,application/json';file.hidden=true;workspace.append(file);
 function persist(previous){const saved=atlas.save();if(!saved&&previous){for(const key of Object.keys(atlas.personal))delete atlas.personal[key];Object.assign(atlas.personal,previous);}atlas.renderFilters();atlas.renderRoutes();atlas.draw();window.nativeMap2D?.draw();sync();return saved;}
 function closePlacement(){placement=null;atlas.state.adding=false;$('map-canvas').classList.remove('adding');sync();}
 function sync(){
  const a=adapter(),angle=(a?.rotation()||0)*180/Math.PI,normal=((angle%360)+540)%360-180;
  $('map-degrees').textContent=`${Math.round(normal)}°`;$('map-compass').style.transform=`rotate(${normal}deg)`;
  $('map-add-marker').setAttribute('aria-pressed',String(!!placement));$('map-add-marker').textContent=placement?'× 取消标记':'＋ 添加标记';
  $('map-personal-count').textContent=ownPoints(source()).length;
  $('map-clean').setAttribute('aria-pressed',String(options.clean));$('map-clean').classList.toggle('active',options.clean);
  $('map-show-personal').checked=options.showPersonal;
  help.dataset.context=placement?'placement':options.clean?'clean':'explore';
  help.textContent=placement?'点击地图选择位置；按 Esc 取消':options.clean?(source()==='source'?'公共点位已隐藏 · 原图自带标注保留 · 左键平移，右键旋转':'公共点位已隐藏 · 左键平移，右键旋转'):'左键拖动平移 · 右键拖动旋转 · 滚轮缩放';
  const full=document.fullscreenElement===workspace||workspace.classList.contains('map-expanded');
  $('map-fullscreen').textContent=full?'⛶ 退出全屏':'⛶ 全屏';$('map-fullscreen').setAttribute('aria-pressed',String(full));
 }
 function beginPlacement(point=null){window.mapSketch?.setActive(false);if(!adapter()?.ready()){toast('地图正在加载，请稍后再试');return;}placement={view:source(),map:atlas.state.map,point};atlas.state.adding=false;options.showPersonal=true;sync();}
 function edit(point){
  window.mapSketch?.setActive(false);closePlacement();editing=structuredClone(point);const world=isWorld(point),position=world?point.worldPosition:point;
  $('map-marker-title').textContent=custom().some(p=>p.id===point.id)?'编辑个人标记':'添加个人标记';
  $('map-marker-space').textContent=world?`游戏坐标图 · X ${position.x.toFixed(2)} / Z ${position.z.toFixed(2)}`:`资料图 · ${(point.x*100).toFixed(2)}%, ${(point.y*100).toFixed(2)}%`;
  $('map-marker-name').value=point.label||'';$('map-marker-kind').value=['custom','spawn','exit','electronic','mechanical','gear'].includes(point.type)?point.type:'custom';
  $('map-marker-color').value=/^#[\da-f]{6}$/i.test(point.color||'')?point.color:'#ffb65e';
  $('map-marker-note').value=atlas.personal.notes[point.id]||point.note||'';
  $('map-marker-height-label').hidden=!world;$('map-marker-height').required=world;$('map-marker-height').value=world?position.y:'';
  $('map-marker-delete').hidden=$('map-marker-move').hidden=!custom().some(p=>p.id===point.id);
  dialog.showModal();$('map-marker-name').focus();
 }
 function freshPoint(view,map,position){
  const base={id:`U-${crypto.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)}`,map,type:'custom',label:'',color:'#ffb65e',personal:true,status:'unknown',floors:[],floorEvidence:'unlabelled',note:''};
  if(view==='native')return {...base,coordinateSpace:'source-world',worldPosition:position};
  return {...base,coordinateSpace:'source-image-normalized',x:position.x,y:position.y};
 }
 $('map-marker-form').onsubmit=e=>{
  e.preventDefault();if(!editing)return;const label=$('map-marker-name').value.trim();if(!label)return;
  editing.label=label;editing.type=$('map-marker-kind').value;editing.color=$('map-marker-color').value;editing.note=$('map-marker-note').value.trim();
  if(isWorld(editing)){const y=Number($('map-marker-height').value);if(!Number.isFinite(y))return;editing.worldPosition.y=y;}
  const previous=structuredClone(atlas.personal),index=custom().findIndex(p=>p.id===editing.id);if(index<0)custom().push(editing);else custom()[index]=editing;
  atlas.personal.notes[editing.id]=editing.note;options.showPersonal=true;if(persist(previous)){dialog.close();toast('个人标记已保存');}
 };
 $('map-marker-cancel').onclick=()=>dialog.close();
 $('map-marker-delete').onclick=()=>{const previous=structuredClone(atlas.personal),id=editing.id;atlas.personal.custom=custom().filter(p=>p.id!==id);delete atlas.personal.notes[id];delete atlas.personal.observations[id];for(const map of ['janus','suburbs'])atlas.personal.routes[map]=(atlas.personal.routes[map]||[]).filter(p=>p!==id);if(persist(previous)){dialog.close();toast('已删除此个人标记');}};
 $('map-marker-move').onclick=()=>{editing.label=$('map-marker-name').value.trim()||editing.label;editing.note=$('map-marker-note').value.trim();editing.color=$('map-marker-color').value;editing.type=$('map-marker-kind').value;if(isWorld(editing)&&Number.isFinite(Number($('map-marker-height').value)))editing.worldPosition.y=Number($('map-marker-height').value);dialog.close();beginPlacement(editing);};
 function showList(){
  const points=ownPoints('source'),mapName=atlas.state.map==='janus'?'雅努斯幻境':'城郊幻境',mapNameEn=atlas.state.map==='janus'?'Janus Illusion':'Suburbs Illusion';listDialog.innerHTML=`<div class="dialog-head"><h2 data-i18n-en="My markers · Reference map">我的标记 · 资料图</h2><button id="map-list-close" type="button">关闭</button></div><p class="small muted" data-i18n-en="${mapNameEn} · ${points.length} ${points.length===1?'marker':'markers'} · Saved on this device">${mapName} · ${points.length} 处 · 个人标记保存在本机</p><div class="map-own-list">${points.length?points.map(p=>`<div><span style="color:${/^#[\da-f]{6}$/i.test(p.color||'')?p.color:'#ffb65e'}">●</span><b data-i18n-skip>${escape(p.label)}</b><button data-locate="${escape(p.id)}">定位</button><button data-edit="${escape(p.id)}">编辑</button></div>`).join(''):'还没有个人标记，点击地图上方“＋ 添加标记”开始。'}</div>`;
  $('map-list-close').onclick=()=>listDialog.close();listDialog.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{listDialog.close();edit(points.find(p=>p.id===b.dataset.edit));});
  listDialog.querySelectorAll('[data-locate]').forEach(b=>b.onclick=()=>{const p=points.find(p=>p.id===b.dataset.locate);options.showPersonal=true;if(isWorld(p)){const s=adapter().state;if(p.worldPosition.y<s.minY||p.worldPosition.y>s.maxY){s.minY=p.worldPosition.y-5;s.maxY=p.worldPosition.y+5;$('native-height-min').value=s.minY;$('native-height-max').value=s.maxY;$('native-height-preset').value='custom';}}adapter().focus(isWorld(p)?p.worldPosition:p);listDialog.close();sync();});
  listDialog.showModal();
 }
 async function toggleFullscreen(){
  try{if(document.fullscreenElement===workspace)await document.exitFullscreen();else if(workspace.classList.contains('map-expanded'))workspace.classList.remove('map-expanded');else if(workspace.requestFullscreen)await workspace.requestFullscreen();else workspace.classList.add('map-expanded');}
  catch{workspace.classList.toggle('map-expanded');}sync();requestAnimationFrame(()=>{atlas.resize();window.nativeMap2D?.resize();});
 }
 function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
 let exportingImage=false;
 function syncExportButton(){const button=$('map-export-image');button.textContent=exportingImage?tr('正在导出…','Exporting…'):tr('导出高清全图','Export full map');button.title=tr('PNG · 长边 4096 像素 · 完整地图','PNG · 4096 px longest edge · Entire map');button.disabled=exportingImage;button.setAttribute('aria-busy',String(exportingImage));}
 $('map-export-image').setAttribute('data-i18n-skip','');syncExportButton();window.addEventListener('dukelanguagechange',syncExportButton);window.addEventListener('dukelanguageready',syncExportButton);
 async function exportImage(){
  if(exportingImage)return;const a=adapter();if(!a?.ready())return toast(tr('地图尚未加载完成','The map is still loading'));
  exportingImage=true;syncExportButton();let result;
  try{
   await new Promise(requestAnimationFrame);result=atlas.renderFullMapImage();
   const blob=await new Promise((resolve,reject)=>result.canvas.toBlob(value=>value?resolve(value):reject(Error('PNG encoding failed')),'image/png'));
   const name=window.DUKE_I18N.language==='en'?(result.map==='janus'?'Janus-Illusion':'Suburbs-Illusion'):result.name;
   download(blob,`${name}-${tr('高清全图','Full-map')}-${result.canvas.width}x${result.canvas.height}.png`);
   toast(tr('高清全图已导出','High-resolution full map exported'));
  }catch(error){console.error('Full map export failed',error);toast(tr('图片导出失败，请重试','Image export failed. Please try again'));}
  finally{if(result){result.canvas.width=0;result.canvas.height=0;}exportingImage=false;syncExportButton();}
 }
 function validateBackup(data){
  if(!data||typeof data!=='object'||!data.personal||typeof data.personal!=='object'||!Array.isArray(data.personal.custom))throw Error('请选择本站导出的个人记录 JSON');
  if(data.personal.custom.length>10000)throw Error('单个文件最多恢复 10000 个个人标记');
  const seen=new Set(),points=data.personal.custom.map(p=>{
   if(!p||!['janus','suburbs'].includes(p.map)||typeof p.id!=='string'||!/^U-[\w-]{1,100}$/.test(p.id)||seen.has(p.id)||typeof p.label!=='string'||p.label.length>80)throw Error('文件包含无效或重复的个人标记');seen.add(p.id);
   if(p.coordinateSpace&&!['source-world','source-image-normalized'].includes(p.coordinateSpace))throw Error('文件中的坐标格式暂不支持');
   if(isWorld(p)){if(!p.worldPosition||!['x','y','z'].every(k=>Number.isFinite(p.worldPosition[k])&&Math.abs(p.worldPosition[k])<=100000))throw Error('游戏坐标无效');}
   else if(!['x','y'].every(k=>Number.isFinite(p[k])&&p[k]>=0&&p[k]<=1))throw Error('资料图位置无效');
   const point={id:p.id,map:p.map,label:p.label,type:['spawn','exit','electronic','mechanical','gear','medical','briefcase','trash','enemy','keyroom','portal','custom'].includes(p.type)?p.type:'custom',personal:true,status:'unknown',note:String(p.note||'').slice(0,2000),color:/^#[\da-f]{6}$/i.test(p.color||'')?p.color:'#ffb65e',floors:Array.isArray(p.floors)?p.floors.filter(f=>Number.isInteger(f)&&Math.abs(f)<100):[],floorEvidence:'user',coordinateSpace:isWorld(p)?'source-world':'source-image-normalized'};
   return isWorld(p)?{...point,worldPosition:{x:p.worldPosition.x,y:p.worldPosition.y,z:p.worldPosition.z}}:{...point,x:p.x,y:p.y};
  });
  const safeKey=k=>k.length<160&&!['__proto__','constructor','prototype'].includes(k),notes={},observations={},routes={};
  for(const [k,v] of Object.entries(data.personal.notes||{}))if(safeKey(k)&&typeof v==='string')notes[k]=v.slice(0,2000);
  for(const [k,v] of Object.entries(data.personal.observations||{}))if(safeKey(k)&&v&&Number.isSafeInteger(v.present)&&v.present>=0&&Number.isSafeInteger(v.absent)&&v.absent>=0)observations[k]={present:v.present,absent:v.absent,history:Array.isArray(v.history)?v.history.filter(h=>['present','absent'].includes(h)).slice(-10000):[]};
  for(const map of ['janus','suburbs'])routes[map]=Array.isArray(data.personal.routes?.[map])?data.personal.routes[map].filter(id=>typeof id==='string'&&safeKey(id)).slice(0,10000):[];
  const hasSketches=Object.prototype.hasOwnProperty.call(data.personal,'sketches');
  if(hasSketches&&typeof window.mapSketch?.normalizeSketches!=='function')throw Error(tr('手绘工具尚未加载完成，请稍后恢复；本次没有导入任何数据','The drawing tool is still loading. Retry the restore shortly; nothing has been imported.'));
  let sketches=[];
  if(window.mapSketch?.normalizeSketches)try{sketches=window.mapSketch.normalizeSketches(data.personal.sketches,{strict:true});}catch{throw Error(tr('手绘路线格式无效或超过保存上限，请检查备份','Drawing data is invalid or exceeds the storage limit. Check the backup.'));}
  return {custom:points,notes,observations,routes,sketches};
 }
 function mergedBackup(records){
  const previous=atlas.personal,next=structuredClone(previous),ids=new Set(previous.custom.map(p=>p.id)),markers=records.custom.filter(p=>!ids.has(p.id));
  const normalize=window.mapSketch?.normalizeSketches;
  if(typeof normalize!=='function'&&((previous.sketches?.length||0)||records.sketches.length))throw Error(tr('手绘工具尚未加载完成，请稍后恢复；本次没有导入任何数据','The drawing tool is still loading. Retry the restore shortly; nothing has been imported.'));
  let sketches=[],addedSketches=[];
  try{
   const existing=normalize?normalize(previous.sketches,{strict:true}):[],sketchIds=new Set(existing.map(p=>p.id));
   addedSketches=records.sketches.filter(p=>!sketchIds.has(p.id));
   sketches=normalize?normalize([...existing,...addedSketches],{strict:true}):[];
  }catch{throw Error(tr('合并后的手绘路线无效或超过保存上限，原记录未改动','The merged drawings are invalid or exceed the storage limit. Existing records are unchanged.'));}
  next.custom.push(...markers);next.notes={...records.notes,...previous.notes};next.observations={...records.observations,...previous.observations};
  for(const map of ['janus','suburbs'])next.routes[map]=[...new Set([...(previous.routes[map]||[]),...records.routes[map]])];
  next.sketches=sketches;return {next,markerCount:markers.length,sketchCount:addedSketches.length};
 }
 async function readBackup(){try{
  const f=file.files[0];if(!f)return;if(f.size>25*1024*1024)throw Error('文件超过 25 MB，请选择个人记录备份');imported=validateBackup(JSON.parse(await f.text()));
  const preview=mergedBackup(imported),count=preview.markerCount,sketchCount=preview.sketchCount;
  const summary=`新增 ${count} 个标记、${sketchCount} 笔手绘路线；跳过 ${imported.custom.length-count} 个已有标记、${imported.sketches.length-sketchCount} 笔已有路线。`;
  const noun=(n,singular)=>n===1?singular:`${singular}s`,skippedMarkers=imported.custom.length-count,skippedSketches=imported.sketches.length-sketchCount;
  const summaryEn=`Add ${count} ${noun(count,'marker')} and ${sketchCount} ${noun(sketchCount,'drawing')}; skip ${skippedMarkers} existing ${noun(skippedMarkers,'marker')} and ${skippedSketches} existing ${noun(skippedSketches,'drawing')}.`;
  restoreDialog.innerHTML=`<h2>恢复个人记录</h2><p data-i18n-en="${escape(summaryEn)}">${summary}</p><p class="small muted" data-i18n-en="Merge personal markers, notes, visited lists and drawings. Existing records with the same ID are kept. Old backups keep your current drawings. Everything is validated before saving together.">合并个人位置、备注、访问清单和手绘路线；已有同编号记录保留。旧备份不会清除现有手绘路线，整批验证后一次保存。</p><div class="dialog-actions"><button id="map-restore-cancel">取消</button><button id="map-restore-confirm" class="primary-button">合并并保存</button></div>`;
  $('map-restore-cancel').onclick=()=>{imported=null;restoreDialog.close();};
  $('map-restore-confirm').onclick=()=>{
   let previous,merged;
   try{
    if(!imported)return;merged=mergedBackup(imported);previous=structuredClone(atlas.personal);
    for(const key of Object.keys(atlas.personal))delete atlas.personal[key];Object.assign(atlas.personal,merged.next);
    if(!atlas.save())throw Error(tr('保存失败，已保留全部原记录','Saving failed. All existing records have been kept.'));
   }catch(error){
    if(previous){for(const key of Object.keys(atlas.personal))delete atlas.personal[key];Object.assign(atlas.personal,previous);}
    toast(tr(`未恢复：${error.message}`,`Nothing restored: ${error.message}`));return;
   }
   imported=null;restoreDialog.close();window.mapSketch?.onPersonalRestored();atlas.renderFilters();atlas.renderRoutes();atlas.draw();window.nativeMap2D?.draw();sync();
   toast(tr(`已恢复 ${merged.markerCount} 个个人标记、${merged.sketchCount} 笔手绘路线`,`Restored ${merged.markerCount} personal ${noun(merged.markerCount,'marker')} and ${merged.sketchCount} ${noun(merged.sketchCount,'drawing')}.`));
  };restoreDialog.showModal();
 }catch(e){imported=null;toast(tr(`未恢复：${e.message}`,`Nothing restored: ${e.message}`));}finally{file.value='';}}
 function drawNative(ctx,project,state){
  state.personalHits=[];if(!options.showPersonal)return;
  for(const p of ownPoints('native')){if(p.worldPosition.y<state.minY||p.worldPosition.y>state.maxY)continue;const q=project(p.worldPosition);if(q.x<-25||q.y<-25||q.x>state.width+25||q.y>state.height+25)continue;state.personalHits.push({p,x:q.x,y:q.y});
   const color=/^#[\da-f]{6}$/i.test(p.color||'')?p.color:'#ffb65e';ctx.save();ctx.setLineDash([]);ctx.fillStyle='#141923';ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(q.x,q.y,11,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=color;ctx.font='bold 12px "Microsoft YaHei"';ctx.textAlign='center';ctx.fillText('点',q.x,q.y+4);ctx.font='11px "Microsoft YaHei"';window.DUKE_I18N.canvasLiteral(ctx,()=>{const text=p.label,w=ctx.measureText(text).width;ctx.fillStyle='#10151fed';ctx.fillRect(q.x-w/2-5,q.y+16,w+10,18);ctx.fillStyle='#eef2ff';ctx.fillText(text,q.x,q.y+29);});ctx.restore();
  }
 }
 const attached=new Set();
 function attach(view){
  const a=window.mapToolAdapters?.[view];if(!a||attached.has(view))return;attached.add(view);let gesture=null;
  a.canvas.addEventListener('contextmenu',e=>e.preventDefault());
  a.canvas.addEventListener('pointerdown',e=>{
   if(e.button===2){e.preventDefault();e.stopImmediatePropagation();gesture={kind:'rotate',x:e.offsetX,angle:a.rotation()};a.canvas.setPointerCapture(e.pointerId);}
   else if(e.button===0&&(placement||e.shiftKey)){e.preventDefault();e.stopImmediatePropagation();if(!a.ready())return;if(!placement)beginPlacement();gesture={kind:'place',x:e.offsetX,y:e.offsetY};a.canvas.setPointerCapture(e.pointerId);}
  },true);
  a.canvas.addEventListener('pointermove',e=>{if(!gesture)return;e.stopImmediatePropagation();if(gesture.kind==='rotate')a.setRotation(gesture.angle+(e.offsetX-gesture.x)*Math.PI/360);else if(Math.hypot(e.offsetX-gesture.x,e.offsetY-gesture.y)>5)gesture.moved=true;},true);
  a.canvas.addEventListener('pointerup',e=>{
   if(!gesture)return;e.stopImmediatePropagation();const g=gesture;gesture=null;if(a.canvas.hasPointerCapture(e.pointerId))a.canvas.releasePointerCapture(e.pointerId);
   if(g.kind!=='place'||g.moved||!placement||placement.map!==atlas.state.map||placement.view!==source())return;
   const position=a.unproject(e.offsetX,e.offsetY);if(view==='source'&&(position.x<0||position.x>1||position.y<0||position.y>1))return toast('请在底图范围内选择位置');
   if(view==='native')position.y=placement.point?.worldPosition?.y??Math.round((a.state.minY+a.state.maxY)/2*10)/10;
   const p=placement.point?structuredClone(placement.point):freshPoint(view,placement.map,position);if(view==='native')p.worldPosition=position;else {p.x=position.x;p.y=position.y;}edit(p);
  },true);
  a.canvas.addEventListener('pointercancel',()=>gesture=null,true);
 }
 $('map-add-marker').onclick=()=>placement?closePlacement():beginPlacement();$('add-point').onclick=()=>beginPlacement();
 $('map-personal-list').onclick=showList;$('map-clean').onclick=()=>{options.clean=!options.clean;atlas.draw();window.nativeMap2D?.draw();sync();};
 $('map-show-personal').onchange=e=>{options.showPersonal=e.target.checked;atlas.draw();window.nativeMap2D?.draw();sync();};
 $('map-rotate-left').onclick=()=>{const a=adapter();if(a?.ready())a.setRotation(a.rotation()-Math.PI/4);};$('map-rotate-right').onclick=()=>{const a=adapter();if(a?.ready())a.setRotation(a.rotation()+Math.PI/4);};$('map-bearing').onclick=()=>adapter()?.setRotation(0);
 $('map-fullscreen').onclick=toggleFullscreen;$('map-export-image').onclick=exportImage;$('map-export-personal').onclick=()=>download(new Blob([JSON.stringify({schemaVersion:3,exportedAt:new Date().toISOString(),personal:atlas.personal},null,2)],{type:'application/json'}),'DUKE-个人记录.json');
 $('map-import-personal').onclick=()=>file.click();file.onchange=readBackup;
 for(const name of ['atlasmapchange','atlassourcechange'])window.addEventListener(name,()=>{closePlacement();sync();});
 document.addEventListener('fullscreenchange',()=>{sync();requestAnimationFrame(()=>atlas.resize());});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){closePlacement();if(workspace.classList.contains('map-expanded')){workspace.classList.remove('map-expanded');sync();atlas.resize();}}});
 window.mapTools={get clean(){return options.clean},get showPersonal(){return options.showPersonal},sync,edit,attach,drawNative,validateBackup,cancelPlacement:closePlacement};attach('source');attach('native');sync();
})();

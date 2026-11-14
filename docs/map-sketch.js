import {normalizeSketches,simplifySketchPoints,SKETCH_LIMITS} from './map-sketch-data.js?v=20260919-site-refresh-1';

// Personal sketches describe drawing positions, never traversable game paths.
const atlas=window.atlas,$=id=>document.getElementById(id),workspace=document.querySelector('.workspace');
const tr=(zh,en)=>window.DUKE_I18N?.language==='en'?en:zh;
const view=()=>atlas.state.source2d,map=()=>atlas.state.map,key=()=>`${map()}:${view()}`;
const adapter=()=>window.mapToolAdapters?.[view()];
const colors=[['#a397ff','紫色','Purple'],['#ffc470','金色','Gold'],['#61d9ed','蓝色','Cyan'],['#ff8198','粉色','Pink']];
let active=false,shown=true,color=colors[0][0],draft=null,pendingFrame=false,status='';
const histories=new Map();
atlas.personal.sketches=normalizeSketches(atlas.personal.sketches);
const strokes=()=>atlas.personal.sketches||[];
const inScope=(s,m=map(),v=view())=>s.map===m&&s.view===v;
const own=()=>strokes().filter(s=>inScope(s));
const history=()=>{if(!histories.has(key()))histories.set(key(),{undo:[],redo:[]});return histories.get(key());};

const button=document.createElement('button');button.id='map-sketch-toggle';button.type='button';button.setAttribute('data-i18n-skip','');
button.setAttribute('aria-controls','map-sketch-tools');$('map-add-marker').after(button);
const panel=document.createElement('section');panel.id='map-sketch-tools';panel.hidden=true;panel.setAttribute('data-i18n-skip','');
panel.innerHTML='<div class="sketch-actions"><div id="map-sketch-colors" class="sketch-colors" role="group"></div><button id="map-sketch-undo" type="button"></button><button id="map-sketch-redo" type="button"></button><button id="map-sketch-clear" type="button"></button><label class="sketch-visibility"><input id="map-sketch-visible" type="checkbox" checked><span></span></label><button id="map-sketch-done" type="button"></button></div><div class="sketch-caption"><span id="map-sketch-hint"></span><span id="map-sketch-status" role="status" aria-live="polite"></span></div>';
$('map-tools-help').after(panel);
for(const [value,zh,en] of colors){const b=document.createElement('button');b.type='button';b.dataset.sketchColor=value;b.style.setProperty('--sketch-color',value);b.dataset.labelZh=zh;b.dataset.labelEn=en;b.onclick=()=>{color=value;sync();};$('map-sketch-colors').append(b);}

function sync(){
 const count=own().length,h=history();
 button.textContent=active?tr('✓ 完成绘制','✓ Finish drawing'):tr('✎ 手绘路线','✎ Draw route');
 button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-expanded',String(active));
 panel.hidden=!active;panel.setAttribute('aria-label',tr('手绘路线工具','Route drawing tools'));
 $('map-tools-help').hidden=active;$('view-note').hidden=active;
 $('map-sketch-colors').setAttribute('aria-label',tr('路线颜色','Route color'));
 for(const b of panel.querySelectorAll('[data-sketch-color]')){b.setAttribute('aria-label',tr(b.dataset.labelZh,b.dataset.labelEn));b.title=b.getAttribute('aria-label');b.setAttribute('aria-pressed',String(b.dataset.sketchColor===color));}
 for(const [id,zh,en,disabled] of [['undo','撤销','Undo',!h.undo.length],['redo','重做','Redo',!h.redo.length],['clear','清空本图','Clear this view',!count]]){const b=$('map-sketch-'+id);b.textContent=tr(zh,en);b.disabled=disabled;}
 $('map-sketch-done').textContent=tr('完成','Done');$('map-sketch-visible').checked=shown;
 panel.querySelector('.sketch-visibility span').textContent=tr('显示路线','Show drawings');
 $('map-sketch-hint').textContent=tr('按住拖动画线 · Esc 退出 · 自动保存到本机','Drag to draw · Esc to exit · Saved on this device');
 const scope=tr(map()==='janus'?'雅努斯':'城郊',map()==='janus'?'Janus':'Suburbs')+' · '+tr(view()==='source'?'资料图':'坐标图',view()==='source'?'Source map':'World map');
 // Keep the caption stable during a stroke so mobile wrapping cannot resize
 // the canvas and change its projection underneath the pointer.
 $('map-sketch-status').textContent=status==='failed'?tr('未能保存，请先导出备份后重试','Could not save. Export a backup and try again.'):status==='limit'?tr('绘制数量已达上限，请先备份并清理','Drawing limit reached. Back up and clear drawings first.'):`${scope} · ${count} ${tr('笔','strokes')}`;
 $('map-canvas').classList.toggle('is-sketching',active);
}
function redraw(){if(pendingFrame)return;pendingFrame=true;requestAnimationFrame(()=>{pendingFrame=false;atlas.draw();});}
function releaseDraft(){const d=draft;draft=null;if(d?.canvas.hasPointerCapture(d.pointerId))d.canvas.releasePointerCapture(d.pointerId);return d;}
function cancelDraft(){if(!draft)return;releaseDraft();status='';sync();redraw();}
function setActive(value){
 if(value&&!adapter()?.ready()){atlas.toast(tr('地图正在加载，请稍后再试','The map is loading. Try again shortly.'));return;}
 cancelDraft();active=!!value;status='';
 if(active){window.mapTools?.cancelPlacement?.();atlas.state.adding=false;$('map-canvas').classList.remove('adding');shown=true;}
 sync();redraw();
}
function persist(next){
 let clean;try{clean=normalizeSketches(next,{strict:true});}catch{status='limit';sync();atlas.toast(tr('手绘路线超出保存上限，请先备份并清理','Drawing storage limit reached. Back up and clear drawings first.'));return false;}
 const previous=atlas.personal.sketches;atlas.personal.sketches=clean;
 if(!atlas.save()){atlas.personal.sketches=previous;status='failed';sync();redraw();return false;}
 status='';sync();redraw();return true;
}
function commit(next,action){if(!persist(next))return false;const h=history();h.undo.push(action);if(h.undo.length>50)h.undo.shift();h.redo=[];sync();return true;}
function undo(){
 cancelDraft();const h=history(),action=h.undo.at(-1);if(!action)return;
 const next=action.kind==='add'?strokes().filter(s=>s.id!==action.stroke.id):[...strokes(),...action.strokes];
 if(persist(next)){h.undo.pop();h.redo.push(action);sync();}
}
function redo(){
 cancelDraft();const h=history(),action=h.redo.at(-1);if(!action)return;
 const next=action.kind==='add'?[...strokes(),action.stroke]:strokes().filter(s=>!action.strokes.some(r=>r.id===s.id));
 if(persist(next)){h.redo.pop();h.undo.push(action);sync();}
}
function clear(){cancelDraft();const removed=own();if(removed.length)commit(strokes().filter(s=>!inScope(s)),{kind:'clear',strokes:removed});}
function screenPoint(event,canvas){const r=canvas.getBoundingClientRect();return {x:event.clientX-r.left,y:event.clientY-r.top};}
function projectionStamp(a,v){
 const s=a.state,fields=v==='source'?['map','rotation','zoom','tx','ty','baseScale','w','h']:['map','loadedMap','rotation','zoom','panX','panY','scale','width','height','viewSign'];
 return fields.map(k=>s[k]).join('|');
}
function mapPoint(screen,a,v){
 const p=a.unproject(screen.x,screen.y),axis=v==='source'?'y':'z';
 if(!Number.isFinite(p.x)||!Number.isFinite(p[axis]))return null;
 if(v==='source'&&(p.x<0||p.x>1||p.y<0||p.y>1))return null;
 if(v==='native'&&(Math.abs(p.x)>100000||Math.abs(p.z)>100000))return null;
 return v==='source'?{x:p.x,y:p.y}:{x:p.x,z:p.z};
}
function intercept(event){event.preventDefault();event.stopImmediatePropagation();}
function begin(event){
 const a=adapter();if(!active||event.target!==a?.canvas)return;
 intercept(event);
 // Drawing owns the entire pointer gesture; do not leave a background rotate
 // gesture waiting for move/up events that this tool consumes.
 if(event.button!==0){if(draft)cancelDraft();return;}
 if(draft||event.isPrimary===false||!a.ready())return;
 const screen=screenPoint(event,a.canvas),p=mapPoint(screen,a,view());if(!p)return;
 shown=true;const u=a.unproject(screen.x+1,screen.y),axis=view()==='source'?'y':'z',unit=Math.hypot(u.x-p.x,u[axis]-p[axis]);
 draft={canvas:a.canvas,pointerId:event.pointerId,view:view(),map:map(),adapter:a,projection:projectionStamp(a,view()),points:[p],lastScreen:screen,pixels:0,tolerance:unit*.75,color};
 a.canvas.setPointerCapture(event.pointerId);status='drawing';$('tooltip').hidden=true;sync();redraw();
}
function addSample(event,force=false){
 const d=draft;if(!d||d.pointerId!==event.pointerId)return;
 if(d.projection!==projectionStamp(d.adapter,d.view)){cancelDraft();return;}
 const screen=screenPoint(event,d.canvas),distance=Math.hypot(screen.x-d.lastScreen.x,screen.y-d.lastScreen.y);
 if(!force&&distance<2)return;
 const p=mapPoint(screen,d.adapter,d.view);
 // End the stroke at the image edge instead of joining across blank space.
 if(!p){finishDraft();return;}
 if(distance<.05)return;
 d.points.push(p);d.pixels+=distance;d.lastScreen=screen;
 if(d.points.length>=SKETCH_LIMITS.maxPointsPerSketch)finishDraft();
}
function move(event){
 if(!active||event.target!==adapter()?.canvas)return;intercept(event);
 if(!draft||draft.pointerId!==event.pointerId)return;
 const events=event.getCoalescedEvents?.();for(const sample of events?.length?events:[event]){if(!draft)break;addSample(sample);}
 redraw();
}
function finishDraft(){
 const d=releaseDraft();if(!d)return;status='';
 if(d.map!==map()||d.view!==view()||d.points.length<2||d.pixels<4){sync();redraw();return;}
 const points=simplifySketchPoints(d.points,d.tolerance,{view:d.view});
 const stroke={id:'D-'+crypto.randomUUID(),map:d.map,view:d.view,coordinateSpace:d.view==='source'?'source-image-normalized':'source-world-planar',color:d.color,width:4,points,createdAt:new Date().toISOString()};
 commit([...strokes(),stroke],{kind:'add',stroke});sync();redraw();
}
function end(event){if(!active||event.target!==adapter()?.canvas)return;intercept(event);if(!draft||draft.pointerId!==event.pointerId)return;addSample(event,true);finishDraft();}
workspace.addEventListener('pointerdown',begin,true);
workspace.addEventListener('pointermove',move,true);
workspace.addEventListener('pointerup',end,true);
workspace.addEventListener('pointercancel',event=>{if(draft?.pointerId===event.pointerId){intercept(event);cancelDraft();}},true);
workspace.addEventListener('lostpointercapture',event=>{if(draft?.pointerId===event.pointerId)cancelDraft();},true);
workspace.addEventListener('wheel',event=>{if(draft&&event.target===draft.canvas)intercept(event);},{capture:true,passive:false});
window.addEventListener('blur',cancelDraft);window.addEventListener('resize',cancelDraft);
document.addEventListener('fullscreenchange',cancelDraft);
document.addEventListener('keydown',event=>{
 if(!active||event.target.closest?.('input,textarea,select,[contenteditable=true],dialog'))return;
 if(event.key==='Escape'){event.preventDefault();setActive(false);button.focus();}
 else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?redo():undo();}
 else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){event.preventDefault();redo();}
});
function draw(ctx,project,v,{exporting=false}={}){
 if(!exporting&&draft?.view===v&&draft.projection!==projectionStamp(draft.adapter,v))cancelDraft();
 if(!shown)return false;const items=strokes().filter(s=>inScope(s,map(),v));
 if(!exporting&&draft&&draft.map===map()&&draft.view===v)items.push({...draft,width:4});
 let painted=false;ctx.save();ctx.setLineDash([]);ctx.lineCap='round';ctx.lineJoin='round';ctx.shadowBlur=0;ctx.globalAlpha=1;
 for(const s of items){
  if(s.points.length<2)continue;const points=s.points.map(project);if(points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))continue;
  painted=true;
  for(const [stroke,width] of [['#121628d9',s.width+3],[s.color,s.width]]){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();}
  const start=points[0],end=points.at(-1);ctx.fillStyle=s.color;ctx.beginPath();ctx.arc(start.x,start.y,3.5,0,Math.PI*2);ctx.fill();
  const previous=[...points].reverse().find(p=>Math.hypot(p.x-end.x,p.y-end.y)>12);
  if(previous){const angle=Math.atan2(end.y-previous.y,end.x-previous.x);ctx.beginPath();ctx.moveTo(end.x+Math.cos(angle)*2,end.y+Math.sin(angle)*2);ctx.lineTo(end.x-Math.cos(angle-.55)*11,end.y-Math.sin(angle-.55)*11);ctx.lineTo(end.x-Math.cos(angle+.55)*11,end.y-Math.sin(angle+.55)*11);ctx.closePath();ctx.strokeStyle='#121628';ctx.lineWidth=2;ctx.stroke();ctx.fill();}
 }
 ctx.restore();return painted;
}
button.onclick=()=>setActive(!active);$('map-sketch-done').onclick=()=>{setActive(false);button.focus();};
$('map-sketch-undo').onclick=undo;$('map-sketch-redo').onclick=redo;$('map-sketch-clear').onclick=clear;
$('map-sketch-visible').onchange=event=>{cancelDraft();shown=event.target.checked;sync();redraw();};
for(const event of ['atlasmapchange','atlassourcechange'])window.addEventListener(event,()=>{setActive(false);sync();});
for(const event of ['dukelanguagechange','dukelanguageready'])window.addEventListener(event,sync);
window.addEventListener('atlasready',()=>{sync();redraw();});
window.mapSketch={draw,setActive,normalizeSketches,activeFor:v=>active&&view()===v,
 onPersonalRestored(){cancelDraft();histories.clear();status='';shown=true;sync();redraw();},
 getState:()=>({active,shown,map:map(),view:view(),color,count:own().length,drawing:!!draft,undo:history().undo.length,redo:history().redo.length,status})};
sync();redraw();

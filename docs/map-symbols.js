/* Compact, code-drawn symbols. Positions and hit targets remain owned by atlas. */
(() => {
 'use strict';
 const colors={spawn:'#b7ed83',exit:'#67d8b3',electronic:'#bbb0eb',mechanical:'#e7a267',gear:'#ecebe4',medical:'#f08092',briefcase:'#c5975d',trash:'#80a6df',enemy:'#da6597',phantom:'#58b6f0',gem_enemy:'#b79aff',trial_table:'#a69df5',spooky_box:'#efaa66',withdraw_beacon:'#60d4ca',ore_boss:'#da6597',keyroom:'#efcc60',portal:'#68c8d0',custom:'#a7b5fa'};
 const candidateTypes=new Set(['gem_enemy','trial_table','spooky_box','withdraw_beacon']);
 const paths={
  electronic:'M-5-5H5V5H-5Z M-5-2H5 M-2 1H2 M0-1V3',
  mechanical:'M-5-4H5V5H-5Z M-5-1H5 M-2-4V-6H2V-4 M-1 1H1V3H-1Z',
  gear:'M-6-3H6V5H-6Z M-3-3V-5H3V-3 M-6 0H6 M-2 0V2H2V0',
  medical:'M-2-6H2V-2H6V2H2V6H-2V2H-6V-2H-2Z',
  briefcase:'M-6-3H6V5H-6Z M-2-3V-5H2V-3 M-6 0H6',
  trash:'M-4-3H4L3 6H-3Z M-6-5H6 M-2-5V-7H2V-5 M-1-1V3 M2-1V3',
  keyroom:'M-1 0H6 M3 0V3 M6 0V2',
  spawn:'M0-6L5 5L0 2L-5 5Z',
  exit:'M0-6H-5V6H0 M-1 0H7 M4-3L7 0L4 3',
  portal:'M-2-6L5-2L2 5L-5 2Z',
  custom:'M0-6V6 M-6 0H6',
  gem_enemy:'M0-6L4-2L3 4L0 6L-3 4L-4-2Z M-4-2H4 M0-6V6',
  trial_table:'M-5-4H5V2H-5Z M-3 2L-4 6 M3 2L4 6 M-2-1H2 M0-3V1',
  spooky_box:'M-5-4H5V5H-5Z M-5-1H5 M-2 2H-1 M1 2H2 M-2-4L0-6L2-4',
  withdraw_beacon:'M-4 6V-6L5-4L1-1L-4-2 M-6 6H-1',
  enemy:'M-6-5L-2-3H2L6-5V5H-6Z M-4-1L-1 1 M4-1L1 1',
  elite:'M0-6C1-2 6-2 5 2C5 7-5 7-5 2C-6-2-1-2 0-6Z M-2 1H-1 M1 1H2',
  phantom:'M0-7L7 0L0 7L-7 0Z M-3-1V2 M3-1V2',
  doppelganger:'M-5-5L-3-3C-8 3-4 6 0 6C4 6 8 3 3-3L5-5 M-3-3H3'
 };
 const key=p=>candidateTypes.has(p.type)?p.type:p.enemyClass==='phantom'?'phantom':p.enemyClass==='elite'?'elite':p.enemyClass==='doppelganger'?'doppelganger':p.type==='ore_boss'?'enemy':p.type;
 const color=p=>p.personal?(p.color||colors[p.type]||colors.custom):candidateTypes.has(p.type)?colors[p.type]:p.enemyClass==='phantom'?'#58b6f0':p.cacophonyDisappears?'#46bdc9':p.enemyClass==='doppelganger'?'#eb6b73':colors[p.type]||colors.custom;
 function symbol(ctx,p,x,y,r){
  const k=key(p),c=color(p);ctx.save();ctx.translate(x,y);ctx.scale(r/8,r/8);ctx.lineJoin='round';ctx.lineCap='round';
  ctx.strokeStyle='#20222c';ctx.lineWidth=4;const path=new Path2D(paths[k]||paths.custom);ctx.stroke(path);
  ctx.fillStyle='#252631';if(['enemy','elite','doppelganger','electronic','mechanical','briefcase','gear'].includes(k)||candidateTypes.has(k))ctx.fill(path);
  ctx.strokeStyle=c;ctx.lineWidth=1.9;ctx.stroke(path);
  if(k==='enemy'){ctx.strokeStyle='#f7eafa';ctx.lineWidth=1.7;ctx.beginPath();ctx.moveTo(-3.6,-.8);ctx.lineTo(-1.4,.7);ctx.moveTo(3.6,-.8);ctx.lineTo(1.4,.7);ctx.stroke();}
  if(k==='keyroom'){ctx.beginPath();ctx.arc(-3,0,3,0,Math.PI*2);ctx.fill();ctx.stroke();}
  if(k==='portal'){ctx.beginPath();ctx.arc(0,0,2,0,Math.PI*2);ctx.stroke();}
  if(p.sourceLayer==='client33'){ctx.lineWidth=1;ctx.globalAlpha=.8;ctx.setLineDash([1.4,2.2]);ctx.beginPath();ctx.arc(0,0,8,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
 }
 function svg(type){
  const k=type==='ore_boss'?'enemy':type,c=colors[type]||colors.custom;
  return `<svg viewBox="-9 -9 18 18" width="18" height="18" aria-hidden="true" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[k]||paths.custom}"/>${k==='keyroom'?'<circle cx="-3" cy="0" r="3"/>':''}${k==='portal'?'<circle r="2"/>':''}${candidateTypes.has(k)?'<circle r="8" stroke-width="1" stroke-dasharray="1.4 2.2" opacity=".8"/>':''}</svg>`;
 }
 function draw(ctx,points,{project,state,literal}){
  const placed=[],reserved=[],labels=[];state.hit=[];
  for(const p of points){
   const q=project(p);if(q.x<-24||q.y<-24||q.x>state.w+24||q.y>state.h+24)continue;
   const selected=p.id===state.selected,hovered=p.id===state.hover,r=selected?10:state.zoom>=2?8.5:7;
   // Visuals stay small at full-map scale; mouse/touch targets do not shrink.
   state.hit.push({p,q,r:Math.max(r,10)});reserved.push({x:q.x-r-2,y:q.y-r-2,w:r*2+4,h:r*2+4});
   if(selected||hovered){ctx.save();ctx.strokeStyle=selected?'#657bff':'#e9edff';ctx.lineWidth=selected?2:1;ctx.beginPath();ctx.arc(q.x,q.y,r+6,0,Math.PI*2);ctx.stroke();ctx.restore();}
   symbol(ctx,p,q.x,q.y,r);
   if(p.status==='random_source'||p.status==='unknown'||p.status==='conditional'){
    ctx.save();ctx.fillStyle='#20222c';ctx.strokeStyle=color(p);ctx.lineWidth=1.2;const sx=q.x+r-1,sy=q.y-r+1;
    if(p.status==='unknown'){ctx.font='bold 8px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=3;ctx.strokeStyle='#20222c';ctx.strokeText('?',sx,sy);ctx.fillStyle=color(p);ctx.fillText('?',sx,sy)}
    else {ctx.beginPath();if(p.status==='conditional'){ctx.moveTo(sx,sy-3);ctx.lineTo(sx+3,sy);ctx.lineTo(sx,sy+3);ctx.lineTo(sx-3,sy);ctx.closePath()}else ctx.arc(sx,sy,2.7,0,Math.PI*2);ctx.fill();ctx.stroke();}ctx.restore();
   }
   const floors=p.floors||[];
   if(p.gradeChange&&state.zoom>=1.7){ctx.save();ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#20222c';ctx.strokeText(p.gradeChange==='upgrade'?'↑':'↓',q.x-r-3,q.y);ctx.fillStyle='#fff';ctx.fillText(p.gradeChange==='upgrade'?'↑':'↓',q.x-r-3,q.y);ctx.restore();}
   if(!selected&&!hovered&&!state.labels&&state.zoom>=1.7&&floors.length){
    ctx.save();ctx.font='bold 9px "Segoe UI",sans-serif';ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.lineWidth=3;ctx.strokeStyle='#20222c';ctx.strokeText(floors.map(f=>f===-1?'B1':f+'F').join('/'),q.x+r,q.y-r+3);ctx.fillStyle='#fff';ctx.fillText(floors.map(f=>f===-1?'B1':f+'F').join('/'),q.x+r,q.y-r+3);ctx.restore();
   }
   if(state.labels||selected||hovered)labels.push({p,q,r,selected,hovered});
  }
  const intersects=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  labels.sort((a,b)=>Number(b.selected)-Number(a.selected)||Number(b.hovered)-Number(a.hovered));
  for(const {p,q,r,selected,hovered} of labels){
   const full=selected||hovered;let label=full?(p.sourceLayer==='client33'&&window.DUKE_I18N?.language==='en'&&p.labelEn?p.labelEn:p.label):p.sourceKind==='community_boss'?'#'+p.activeBossNumbers.join('/'):p.id;
   ctx.save();ctx.font='11px "Segoe UI","Microsoft YaHei",sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';
   if(label.length>34)label=label.slice(0,33)+'…';const w=ctx.measureText(label).width+14,h=22;
   const candidates=[{x:q.x-w/2,y:q.y+r+8,w,h},{x:q.x-w/2,y:q.y-r-h-8,w,h},{x:q.x+r+9,y:q.y-h/2,w,h},{x:q.x-r-w-9,y:q.y-h/2,w,h}];
   const valid=a=>a.x>=4&&a.y>=4&&a.x+a.w<=state.w-4&&a.y+a.h<=state.h-4;
   const a=candidates.find(a=>valid(a)&&![...reserved,...placed].some(b=>intersects(a,b)))||(full?candidates.find(valid):null);
   if(a){ctx.fillStyle='#202331ee';ctx.beginPath();ctx.roundRect(a.x,a.y,w,h,5);ctx.fill();ctx.fillStyle='#f4f5fb';const paint=()=>ctx.fillText(label,a.x+7,a.y+h/2);p.personal?literal(ctx,paint):paint();placed.push(a);}
   ctx.restore();
  }
  state.renderedLabelCount=placed.length;
 }
 window.DUKEMapSymbols={draw,svg,color};
})();

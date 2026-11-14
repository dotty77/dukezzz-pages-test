// Cache the immutable navigation surface, retaining the original vertices.
// Panning blits an overscanned bitmap; zooming refreshes it after input settles.
export function createTerrainCache(requestDraw) {
 let geometry = null, raster = null, timer = 0;
 const stats = {geometryBuilds:0, rasterBuilds:0, blits:0};
 function vectors(s) {
  if (geometry?.triangles === s.triangles && geometry.minY === s.minY && geometry.maxY === s.maxY) return;
  const buckets = new Map(), edges = new Path2D();
  const add = (path, vs) => {vs.forEach((v,i) => i ? path.lineTo(v[0],-v[2]) : path.moveTo(v[0],-v[2]));path.closePath()};
  for (const t of s.triangles) {
   if (t.maxY < s.minY || t.minY > s.maxY) continue;
   const b = Math.max(0,Math.min(8,Math.floor((t.meanY-s.mainY[0])/Math.max(1,s.mainY[1]-s.mainY[0])*9)));
   if (!buckets.has(b)) buckets.set(b,new Path2D());
   add(buckets.get(b),t.v);
  }
  for (const p of s.polygons) if (p.maxY >= s.minY && p.minY <= s.maxY) add(edges,p.vertices);
  geometry = {triangles:s.triangles,minY:s.minY,maxY:s.maxY,buckets:[...buckets].sort((a,b)=>a[0]-b[0]),edges};
  raster = null;stats.geometryBuilds++;
 }
 function rebuild(s) {
  clearTimeout(timer);timer=0;
  const px=s.scale*s.zoom, sign=s.viewSign||1, unit=px*sign, margin=Math.max(160,Math.min(s.width,s.height)*.4);
  const w=Math.ceil(s.width+margin*2),h=Math.ceil(s.height+margin*2);
  // Bound memory even on high-DPI/large monitors (at most 32 MB of RGBA).
  const dpr=Math.min(devicePixelRatio||1,2,4096/w,4096/h,Math.sqrt(8000000/(w*h)));
  const surface=raster?.surface||document.createElement('canvas');
  surface.width=Math.ceil(w*dpr);surface.height=Math.ceil(h*dpr);
  const c=surface.getContext('2d'),cx=s.bounds.cx-s.panX/unit,cz=s.bounds.cz+s.panY/unit;
  c.setTransform(dpr*unit,0,0,dpr*unit,dpr*(w/2-cx*unit),dpr*(h/2+cz*unit));
  for(const [b,path] of geometry.buckets){c.fillStyle=`hsl(${186-b*4} 20% ${25+b*3}%)`;c.fill(path)}
  c.strokeStyle='#83abb438';c.lineWidth=.65/px;c.stroke(geometry.edges);
  raster={surface,w,h,px,cx,cz,sign};stats.rasterBuilds++;
 }
 function drawRaster(c,s) {
  vectors(s);
  const px=s.scale*s.zoom,sign=s.viewSign||1;
  const placement=()=>{
   const ratio=px/raster.px;
   return {ratio,x:s.width/2+s.panX+(raster.cx-s.bounds.cx)*px*sign-raster.w/2*ratio,
    y:s.height/2+s.panY-(raster.cz-s.bounds.cz)*px*sign-raster.h/2*ratio,w:raster.w*ratio,h:raster.h*ratio};
  };
  let p=raster&&placement();
  if(!p||raster.sign!==sign||p.x>0||p.y>0||p.x+p.w<s.width||p.y+p.h<s.height||p.ratio<.65||p.ratio>1.6){rebuild(s);p=placement()}
  else if(Math.abs(p.ratio-1)>.001){
   clearTimeout(timer);timer=setTimeout(()=>{raster=null;timer=0;requestDraw()},140);
  }
  c.drawImage(raster.surface,p.x,p.y,p.w,p.h);stats.blits++;
 }
 function draw(c,s){
  const a=s.rotation||0;if(Math.abs(a)<1e-9){drawRaster(c,s);return;}
  // A fixed diagonal-sized viewport covers every bearing without rebuilding for
  // each rotation step. Cached geometry and world coordinates stay unchanged.
  const side=Math.ceil(Math.hypot(s.width,s.height)),ca=Math.cos(a),sa=Math.sin(a);
  const virtual={...s,width:side,height:side,panX:s.panX*ca+s.panY*sa,panY:-s.panX*sa+s.panY*ca};
  c.save();c.translate(s.width/2,s.height/2);c.rotate(a);c.translate(-side/2,-side/2);drawRaster(c,virtual);c.restore();
 }
 return {draw,stats};
}

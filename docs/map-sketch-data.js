// Hand-drawn overlays only. Native points are planar x/z values, not navigable paths.
export const SKETCH_LIMITS=Object.freeze({maxSketches:200,maxPointsPerSketch:1500,maxTotalPoints:50000,minPoints:2,minWidth:2,maxWidth:8,maxWorldCoordinate:100000});
const hasOwn=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const uuid=/^D-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const color=/^#[0-9a-f]{6}$/i;
const spaces={source:'source-image-normalized',native:'source-world-planar'};
function fail(message){throw new TypeError(`Invalid map sketch: ${message}`);}
function field(value,key){if(!hasOwn(value,key))fail(`missing ${key}`);const descriptor=Object.getOwnPropertyDescriptor(value,key);if(!hasOwn(descriptor,'value'))fail(`${key} must be a data field`);return descriptor.value;}
function timestamp(value){
  // Keep timestamps unambiguous; accept UTC ISO seconds with optional milliseconds.
  if(typeof value!=='string')fail('createdAt must be an ISO UTC timestamp');
  const match=/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/.exec(value);
  if(!match)fail('createdAt must be an ISO UTC timestamp');
  const canonical=`${match[1]}.${(match[2]||'').padEnd(3,'0')}Z`,parsed=new Date(canonical);
  if(!Number.isFinite(parsed.getTime())||parsed.toISOString()!==canonical)fail('createdAt is not a real date');
  return canonical;
}
function point(value,view){
  if(!record(value))fail('each point must be an object');
  const key=view==='source'?'y':'z',x=field(value,'x'),second=field(value,key);
  if(typeof x!=='number'||typeof second!=='number'||!Number.isFinite(x)||!Number.isFinite(second))fail('point coordinates must be finite numbers');
  if(view==='source'&&(x<0||x>1||second<0||second>1))fail('source coordinates must be between 0 and 1');
  if(view==='native'&&(Math.abs(x)>SKETCH_LIMITS.maxWorldCoordinate||Math.abs(second)>SKETCH_LIMITS.maxWorldCoordinate))fail('native coordinates exceed the planar range');
  return view==='source'?{x,y:second}:{x,z:second};
}
function sketch(value){
  if(!record(value))fail('each sketch must be an object');
  const rawId=field(value,'id'),match=typeof rawId==='string'?uuid.exec(rawId):null;
  if(!match)fail('id must use D-UUID format');
  const map=field(value,'map'),view=field(value,'view');
  if(map!=='janus'&&map!=='suburbs')fail('unknown map');
  if(view!=='source'&&view!=='native')fail('unknown view');
  const coordinateSpace=field(value,'coordinateSpace');
  if(coordinateSpace!==spaces[view])fail('coordinateSpace does not match view');
  const rawColor=field(value,'color'),width=field(value,'width');
  if(typeof rawColor!=='string'||!color.test(rawColor))fail('color must be a six-digit hex value');
  if(typeof width!=='number'||!Number.isFinite(width)||width<SKETCH_LIMITS.minWidth||width>SKETCH_LIMITS.maxWidth)fail('width must be between 2 and 8');
  const rawPoints=field(value,'points');
  if(!Array.isArray(rawPoints)||rawPoints.length<SKETCH_LIMITS.minPoints||rawPoints.length>SKETCH_LIMITS.maxPointsPerSketch)fail('point count must be between 2 and 1500');
  const points=[];for(const entry of rawPoints)points.push(point(entry,view));
  return {id:`D-${match[1].toLowerCase()}`,map,view,coordinateSpace,color:rawColor.toLowerCase(),width,points,createdAt:timestamp(field(value,'createdAt'))};
}

/**
 * Copy only permitted fields into a bounded collection.
 * Missing sketches in an old backup are valid. Strict imports reject the whole
 * collection on any invalid record; local recovery skips invalid/over-limit
 * records and keeps later records that fit, in their original order.
 */
export function normalizeSketches(input,{strict=false}={}){
  if(input===undefined)return [];
  if(!Array.isArray(input)){if(strict)fail('collection must be an array');return [];}
  if(strict&&input.length>SKETCH_LIMITS.maxSketches)fail('collection exceeds 200 sketches');
  const output=[],ids=new Set();let total=0;
  for(const entry of input){
    if(!strict&&output.length===SKETCH_LIMITS.maxSketches)break;
    try{
      const normalized=sketch(entry);
      if(ids.has(normalized.id))fail('duplicate id');
      if(total+normalized.points.length>SKETCH_LIMITS.maxTotalPoints)fail('collection exceeds 50000 total points');
      ids.add(normalized.id);total+=normalized.points.length;output.push(normalized);
    }catch(error){if(strict)throw error;}
  }
  return output;
}

/**
 * Iterative Ramer-Douglas-Peucker simplification in coordinate-space units.
 * Source tolerance is normalized image distance; native tolerance is planar
 * world distance. This does not infer floors, obstacles, or traversability.
 * Empty/single-point samples are supported; positive-length endpoints survive.
 */
export function simplifySketchPoints(points,tolerance,{view='source'}={}){
  if(view!=='source'&&view!=='native')fail('unknown simplification view');
  if(!Array.isArray(points)||points.length>SKETCH_LIMITS.maxPointsPerSketch)fail('simplification requires at most 1500 points');
  if(typeof tolerance!=='number'||!Number.isFinite(tolerance)||tolerance<0)fail('tolerance must be a finite nonnegative number');
  const clean=[];for(const entry of points)clean.push(point(entry,view));
  if(clean.length<3||tolerance===0)return clean;
  const key=view==='source'?'y':'z',keep=new Uint8Array(clean.length),stack=[[0,clean.length-1]];
  keep[0]=1;keep[clean.length-1]=1;
  while(stack.length){
    const [first,last]=stack.pop(),a=clean[first],b=clean[last],dx=b.x-a.x,dy=b[key]-a[key],length=dx*dx+dy*dy;
    let farthest=-1,distance=tolerance;
    for(let i=first+1;i<last;i++){
      const p=clean[i],fraction=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p[key]-a[key])*dy)/length)):0;
      const deviation=Math.hypot(p.x-a.x-fraction*dx,p[key]-a[key]-fraction*dy);
      if(deviation>distance){distance=deviation;farthest=i;}
    }
    if(farthest!==-1){keep[farthest]=1;stack.push([first,farthest],[farthest,last]);}
  }
  return clean.filter((_,index)=>keep[index]);
}

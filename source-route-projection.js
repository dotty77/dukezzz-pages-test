// Pure coordinate conversion for registered source maps. No route finding,
// connection repair, point simplification, or conversion of height into floors.
const MAPS=new Set(['janus','suburbs']);
const pending=new Map();
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const matrixShape=(value,rows,columns)=>Array.isArray(value)&&value.length===rows&&value.every(row=>Array.isArray(row)&&row.length===columns&&row.every(finite));

function normalizedMatrix(registration){
 const size=registration.imageDimensions||[registration.imageSize?.width,registration.imageSize?.height];
 if(!Array.isArray(size)||size.length!==2||!size.every(v=>finite(v)&&v>0))throw Error('资料图配准缺少有效图像尺寸');
 const transform=registration.transform||{};
 let matrix;
 if(matrixShape(transform.matrixRows,2,3)){
  // Janus: [u,v]^T = a 2-by-3 pixel matrix times [worldX,worldZ,1]^T.
  matrix=transform.matrixRows.map((row,i)=>row.map(value=>value/size[i]));
 }else if(matrixShape(transform.normalizedRowVectorMatrix,3,2)){
  // Suburbs: [worldX,worldZ,1] times a 3-by-2 normalized matrix.
  const rows=transform.normalizedRowVectorMatrix;
  matrix=[[rows[0][0],rows[1][0],rows[2][0]],[rows[0][1],rows[1][1],rows[2][1]]];
 }else if(matrixShape(transform.rowVectorMatrix,3,2)){
  const rows=transform.rowVectorMatrix;
  matrix=[[rows[0][0],rows[1][0],rows[2][0]].map(v=>v/size[0]),[rows[0][1],rows[1][1],rows[2][1]].map(v=>v/size[1])];
 }else throw Error('资料图配准矩阵格式无效');
 const [[a,b],[d,e]]=matrix,determinant=a*e-b*d;
 if(!finite(determinant)||Math.abs(determinant)<=1e-12*Math.max(Math.abs(a*e),Math.abs(b*d),Number.MIN_VALUE))throw Error('资料图配准矩阵不可逆');
 return {matrix,size:[...size],determinant};
}

function worldPoint(value){
 const point=Array.isArray(value)?{x:value[0],y:value[1],z:value[2]}:value;
 if(!point||!['x','y','z'].every(key=>finite(point[key])))throw TypeError('路线节点必须包含有限的原始世界 X/Y/Z');
 return point;
}

// Exported separately so conversion can be verified with fixed matrices and
// loaded JSON in environments that do not fetch local files.
export function createSourceProjection(map,registration){
 if(!MAPS.has(map))throw Error('未知资料地图');
 if(!registration||registration.map!==map)throw Error('资料图配准与请求地图不匹配');
 const {matrix,size,determinant}=normalizedMatrix(registration);
 const [[a,b,c],[d,e,f]]=matrix;
 const evidenceFile=`research/${map}-source-registration.json`;
 function project(world){
  const p=worldPoint(world),point={x:a*p.x+b*p.z+c,y:d*p.x+e*p.z+f,worldY:p.y};
  // Keep explicit source floor identifiers, when supplied; never infer them from Y.
  for(const key of ['floor','floorId','level','levelId'])if(Object.hasOwn(p,key))point[key]=p[key];
  return point;
 }
 function inverse(point){
  if(!point||!finite(point.x)||!finite(point.y))throw TypeError('资料图坐标必须为有限的归一化 x/y');
  const x=point.x-c,y=point.y-f;
  return {x:(e*x-b*y)/determinant,z:(a*y-d*x)/determinant};
 }
 function projectRoute(result){
  const markerFields=Array.isArray(result?.assaultMarkers)?{assaultMarkers:result.assaultMarkers.map(marker=>({...marker,...project(marker.worldPosition)}))}:{};
  if(result?.status==='conditional'||(result?.overview&&result.status==='complete')){
   if(result.coordinateSpace!=='source-world'||!Array.isArray(result.segments)||!result.segments.length)throw Error('分段路线资料不完整');
   const segments=result.segments.map(segment=>{
    if(segment.kind==='walking')return {...projectRoute({...segment,status:'complete',coordinateSpace:'source-world'}),kind:'walking'};
    if(segment.kind!=='special'||!segment.source||segment.points?.length!==2)throw Error('特殊通路缺少原始依据或端点');
    const worldPoints=segment.points.map(p=>({...worldPoint(p)}));
    return {...segment,worldPoints,points:worldPoints.map(project)};
   });
   // Flatten only for fitting and endpoint markers. Renderers must draw segments separately.
   const points=segments.flatMap(s=>s.points),worldPoints=segments.flatMap(s=>s.worldPoints),ys=worldPoints.map(p=>p.y);
   if(!points.length)return null;
   return {...result,...markerFields,map,coordinateSpace:'source-image-normalized',worldCoordinateSpace:'source-world',segments,points,worldPoints,heightSegments:[],heightRange:{minY:Math.min(...ys),maxY:Math.max(...ys),startY:ys[0],endY:ys.at(-1)},registrationEvidence:{file:evidenceFile,image:registration.image,imageDimensions:[...size],positionStatus:'estimated_source_image_position'}};
  }
  // An unsuccessful result explicitly clears the caller's projected line.
  if(result?.status!=='complete'||!Array.isArray(result.points)||!result.points.length)return null;
  if(result.coordinateSpace&&result.coordinateSpace!=='source-world')throw Error('路线必须使用原始世界坐标，不能重复投影');
  const worldPoints=result.points.map(p=>({...worldPoint(p)}));
  const points=worldPoints.map(project),heightSegments=[];
  let minY=points[0].worldY,maxY=minY;
  for(let i=0;i<points.length;i++){
   minY=Math.min(minY,points[i].worldY);maxY=Math.max(maxY,points[i].worldY);
   if(i===0)continue;
   const startY=points[i-1].worldY,endY=points[i].worldY,deltaY=endY-startY;
   heightSegments.push({fromIndex:i-1,toIndex:i,startY,endY,deltaY,minY:Math.min(startY,endY),maxY:Math.max(startY,endY),direction:Math.abs(deltaY)<=.05?'level':deltaY>0?'up':'down'});
  }
  return {...result,...markerFields,map,coordinateSpace:'source-image-normalized',worldCoordinateSpace:'source-world',
   points,worldPoints,heightSegments,heightRange:{minY,maxY,startY:points[0].worldY,endY:points.at(-1).worldY},
   heightDirectionTolerance:.05,heightInterpretation:'world Y；上行/下行只表示相邻原始节点高度变化，不代表已核实楼层或楼梯。',
   registrationEvidence:{file:evidenceFile,image:registration.image,imageDimensions:[...size],positionStatus:'estimated_source_image_position'}};
 }
 return {map,project,inverse,projectRoute,registrationEvidence:{file:evidenceFile,image:registration.image,imageDimensions:[...size]},normalizedMatrixRows:matrix.map(row=>[...row])};
}

export function loadSourceProjection(map){
 if(!MAPS.has(map))return Promise.reject(Error('未知资料地图'));
 if(!pending.has(map)){
  const url=new URL(`./research/${map}-source-registration.json`,import.meta.url);
  const request=fetch(url).then(response=>{if(!response.ok)throw Error(`资料图配准读取失败：HTTP ${response.status}`);return response.json();})
   .then(registration=>createSourceProjection(map,registration)).catch(error=>{pending.delete(map);throw error;});
  pending.set(map,request);
 }
 return pending.get(map);
}

/* Static routing on decoded native Unity navigation polygons.
 * No synthetic links, region-center links, portals, doors or dynamic carving.
 * Optional sourced scene links are separate conditional references, not nav edges.
 * Source format evidence: extraction/navmesh-research/README.md.
 */
const EPS=1e-7, SEAM=1e-3, SEAM_HEIGHT=.02;
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const mul=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const dist=(a,b)=>Math.hypot(...sub(a,b));
const lerp=(a,b,t)=>add(a,mul(sub(b,a),t));
const xyz=p=>Array.isArray(p)?p:[p.x,p.y,p.z];
const point=p=>({x:p[0],y:p[1],z:p[2]});
const cross2=(a,b)=>a[0]*b[2]-a[2]*b[0];
const warnings=['仅静态烘焙导航路线；门禁、动态障碍、任务状态与单局刷新条件未应用。','未添加传送、跳跃或其它 off-mesh 连接；显示不可达时不会跨空隙或跨楼层补线。'];

function closestTriangle(p,a,b,c){
  const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);
  if(d1<=0&&d2<=0)return a;
  const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return b;
  const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0)return lerp(a,b,d1/(d1-d3));
  const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return c;
  const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0)return lerp(a,c,d2/(d2-d6));
  const va=d3*d6-d5*d4;if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0)return lerp(b,c,(d4-d3)/((d4-d3)+(d5-d6)));
  const sum=va+vb+vc;if(Math.abs(sum)<EPS)return a;
  return add(a,add(mul(ab,vb/sum),mul(ac,vc/sum)));
}
function heightOnTriangle(p,tri){
  const a=tri[0],b=tri[1],c=tri[2],v=sub(p,a),ab=sub(b,a),ac=sub(c,a),den=cross2(ab,ac);
  if(Math.abs(den)<EPS)return null;
  const u=cross2(v,ac)/den,w=cross2(ab,v)/den;
  // Native float32 detail vertices can be a few micrometres off a shared edge.
  // Use a geometric bound, since fixed barycentric epsilons fail on thin polys.
  const planarLength=v=>Math.hypot(v[0],v[2]),inv=SEAM/Math.abs(den);
  return u>=-inv*planarLength(ac)&&w>=-inv*planarLength(ab)&&1-u-w>=-inv*planarLength(sub(c,b))?a[1]+u*ab[1]+w*ac[1]:null;
}
function edgePoints(node,edge){
  const a=node.vertices[edge],b=node.vertices[(edge+1)%node.vertices.length],d=sub(b,a),sq=d[0]**2+d[2]**2;
  const values=[{t:0,p:a},{t:1,p:b}];
  if(sq>EPS)for(const p of node.detailVertices){
    const t=((p[0]-a[0])*d[0]+(p[2]-a[2])*d[2])/sq;
    if(t<=EPS||t>=1-EPS)continue;
    const q=lerp(a,b,t);if(Math.hypot(p[0]-q[0],p[2]-q[2])<.01)values.push({t,p});
  }
  return values.sort((a,b)=>a.t-b.t).map(v=>v.p);
}
function overlapEdge(a,b,c,d,side){
  // Both edges are explicit outward portals of adjacent source tiles.
  // Require overlapping detailed segments with the existing XZ bound and width.
  // Independent tile/detail quantization can differ slightly in Y (observed
  // 0.0010108 and 0.0101525 source units); allow at most 0.02 vertically.
  // This only reconciles declared tile portals, never nearby edges or floors.
  const axis=side===0||side===4?2:0,normalAxis=axis===2?0:2;
  if(Math.max(Math.abs(a[normalAxis]-c[normalAxis]),Math.abs(b[normalAxis]-d[normalAxis]))>SEAM)return null;
  const lo=Math.max(Math.min(a[axis],b[axis]),Math.min(c[axis],d[axis]));
  const hi=Math.min(Math.max(a[axis],b[axis]),Math.max(c[axis],d[axis]));
  if(hi-lo<=SEAM)return null;
  const at=(p,q,u)=>lerp(p,q,(u-p[axis])/(q[axis]-p[axis]));
  const p=at(a,b,lo),q=at(a,b,hi),r=at(c,d,lo),s=at(c,d,hi);
  const matches=(u,v)=>Math.hypot(u[0]-v[0],u[2]-v[2])<=SEAM&&Math.abs(u[1]-v[1])<=SEAM_HEIGHT;
  if(!matches(p,r)||!matches(q,s))return null;
  return [lerp(p,r,.5),lerp(q,s,.5)];
}

class Heap{
  constructor(){this.a=[];}
  push(x){const a=this.a;a.push(x);let i=a.length-1;while(i){const p=(i-1)>>1;if(a[p].f<=x.f)break;a[i]=a[p];i=p;}a[i]=x;}
  pop(){const a=this.a,top=a[0],end=a.pop();if(a.length){let i=0;while(true){let c=i*2+1;if(c>=a.length)break;if(c+1<a.length&&a[c+1].f<a[c].f)c++;if(a[c].f>=end.f)break;a[i]=a[c];i=c;}a[i]=end;}return top;}
}

export async function loadNavRouter(url,{signal,nativeLinks=[]}={}){
  const r=await fetch(url,{signal});if(!r.ok)throw new Error(`导航网格读取失败：${url} (${r.status})`);
  return createNavRouter(await r.json(),{nativeLinks});
}

export function createNavRouter(data,{nativeLinks=[]}={}){
  if(data.coordinateSpace!=='source-world'||!Array.isArray(data.tiles))throw new Error('导航数据必须声明 source-world 坐标和原生 tiles。');
  const nodes=[],tileMap=new Map();
  for(const t of data.tiles){
    const loc=`${t.x}:${t.z}`;if(tileMap.has(loc))throw new Error('重复导航 tile 坐标');
    const tile={...t,nodes:[]};tileMap.set(loc,tile);
    t.polygons.forEach((p,i)=>{
      const vertices=p.vertices.map(j=>t.vertices[j]),d=t.detailMeshes[i],detailVertices=t.detailVertices.slice(d[0],d[0]+d[2]),all=[...vertices,...detailVertices];
      const triangles=t.detailTriangles.slice(d[1],d[1]+d[3]).map(v=>v.slice(0,3).map(j=>all[j]));
      if(!triangles.length||triangles.some(v=>v.some(p=>!p?.every(Number.isFinite))))throw new Error('导航细节三角形不完整。');
      const center=mul(vertices.reduce(add,[0,0,0]),1/vertices.length);
      const node={index:nodes.length,key:`${t.index}:${i}`,tile,localIndex:i,vertices,detailVertices,triangles,center,links:new Map(),component:-1};
      nodes.push(node);tile.nodes.push(node);
    });
  }
  let internalLinks=0,externalLinks=0,rejectedSeams=0;
  const connect=(a,b,portal,kind)=>{
    if(a===b)return;
    const old=a.links.get(b.index);if(old&&dist(...old.portal)>=dist(...portal))return;
    const cost=dist(a.center,b.center);a.links.set(b.index,{to:b.index,portal,cost,kind});
  };
  for(const tile of tileMap.values())tile.polygons.forEach((p,i)=>p.neighbours.forEach((n,e)=>{
    if(!n)return;const from=tile.nodes[i];
    if(!(n&0x8000)){
      const to=tile.nodes[n-1];if(!to)throw new Error('内部邻接索引越界。');
      connect(from,to,[from.vertices[e],from.vertices[(e+1)%from.vertices.length]],'internal');internalLinks++;
    }else{
      const side=n&255,delta={0:[1,0],2:[0,1],4:[-1,0],6:[0,-1]}[side];
      if(!delta)throw new Error('未知跨 tile 边方向');
      const other=tileMap.get(`${tile.x+delta[0]}:${tile.z+delta[1]}`);if(!other||other.agentTypeId!==tile.agentTypeId)return;
      const ap=edgePoints(from,e);let matches=0;
      other.polygons.forEach((op,j)=>op.neighbours.forEach((on,oe)=>{
        if(on!==(0x8000|((side+4)&7)))return;
        const to=other.nodes[j],bp=edgePoints(to,oe);
        for(let ai=1;ai<ap.length;ai++)for(let bi=1;bi<bp.length;bi++){
          const portal=overlapEdge(ap[ai-1],ap[ai],bp[bi-1],bp[bi],side);
          if(portal){connect(from,to,portal,'external');matches++;}
        }
      }));
      if(!matches)rejectedSeams++;
    }
  }));
  for(const n of nodes)for(const [i,link] of n.links){
    if(!nodes[i].links.has(n.index))throw new Error('导航邻接不互反，拒绝生成路线。');
    if(link.kind==='external')externalLinks++;
  }
  const components=[];
  for(const node of nodes){
    if(node.component>=0)continue;const id=components.length,queue=[node];node.component=id;let count=0;
    while(queue.length){const p=queue.pop();count++;for(const i of p.links.keys())if(nodes[i].component<0){nodes[i].component=id;queue.push(nodes[i]);}}
    components.push({id,polygons:count});
  }
  const stats={map:data.map,polygons:nodes.length,internalDirectedLinks:internalLinks,externalDirectedLinks:externalLinks,unmatchedExternalEdges:rejectedSeams,components:components.sort((a,b)=>b.polygons-a.polygons),seamTolerance:SEAM,verticalSeamTolerance:SEAM_HEIGHT,offMeshLinksAdded:0,coordinateSpace:'source-world'};
  const nearestCache=new Map(),NEAREST_CACHE_LIMIT=1024;
  const copyNearest=value=>value?{...value,position:{...value.position}}:null;
  function nearest(position,{maxSnapDistance=2}={}){
    const p=xyz(position);if(p.length!==3||!p.every(Number.isFinite))throw new TypeError('需要有限的世界坐标 XYZ。');
    // Exact XYZ and snap bound only: no rounding across narrow doors or floors.
    // Cache misses, too. Callers receive copies and cannot corrupt later routes.
    const key=typeof maxSnapDistance==='number'?JSON.stringify([p,maxSnapDistance,Number.isFinite(maxSnapDistance)?'finite':String(maxSnapDistance)]):null;
    if(key!==null&&nearestCache.has(key)){
      const value=nearestCache.get(key);nearestCache.delete(key);nearestCache.set(key,value);return copyNearest(value);
    }
    let best=null,min=Infinity;
    for(const n of nodes)for(const tri of n.triangles){const q=closestTriangle(p,...tri),d=dist(p,q);if(d<min){min=d;best={node:n,position:q,distance:d};}}
    const value=best&&min<=maxSnapDistance?{position:point(best.position),distance:min,polygon:best.node.key,polygonIndex:best.node.index,component:best.node.component}:null;
    if(key!==null){nearestCache.set(key,value);if(nearestCache.size>NEAREST_CACHE_LIMIT)nearestCache.delete(nearestCache.keys().next().value);}
    return copyNearest(value);
  }
  function onSurface(node,a,b){
    // Split each polygon span at native detail triangle edges to preserve slopes.
    const d=sub(b,a),ts=[0,1];
    for(const tri of node.triangles)for(let i=0;i<3;i++){
      const c=tri[i],e=sub(tri[(i+1)%3],c),den=cross2(d,e);if(Math.abs(den)<EPS)continue;
      const ca=sub(c,a),t=cross2(ca,e)/den,u=cross2(ca,d)/den;
      if(t>EPS&&t<1-EPS&&u>=-EPS&&u<=1+EPS)ts.push(t);
    }
    const out=[];
    for(const t of ts.sort((a,b)=>a-b)){
      const p=lerp(a,b,t);let height=null,delta=Infinity;
      for(const tri of node.triangles){const y=heightOnTriangle(p,tri);if(y!==null&&Math.abs(y-p[1])<delta){height=y;delta=Math.abs(y-p[1]);}}
      if(height===null)throw new Error(`路径超出导航细节表面：${node.key} ${JSON.stringify({p,t,a,b})}`);
      const q=[p[0],height,p[2]];if(!out.length||dist(out.at(-1),q)>1e-6)out.push(q);
    }
    return out;
  }
  function walkingRoute(startXYZ,endXYZ,{maxSnapDistance=2,maxVisited=100000}={}){
    const start=nearest(startXYZ,{maxSnapDistance}),end=nearest(endXYZ,{maxSnapDistance});
    const common={coordinateSpace:'source-world',mode:'static_baked_navmesh',warnings:[...warnings],snappedStart:start,snappedEnd:end};
    if(!start||!end)return {...common,status:'off_mesh',reason:'起点或终点不在导航面允许的吸附距离内。',points:[],polygonPath:[]};
    if(start.component!==end.component)return {...common,status:'unreachable',reason:'起终点位于不同静态连通分量；不自动补接跳跃、门禁或传送。',points:[],polygonPath:[]};
    const s=start.polygonIndex,e=end.polygonIndex,g=new Float64Array(nodes.length).fill(Infinity),parents=new Int32Array(nodes.length).fill(-1),closed=new Uint8Array(nodes.length),heap=new Heap();
    g[s]=0;heap.push({i:s,f:dist(nodes[s].center,nodes[e].center)});let visits=0,found=false;
    while(heap.a.length){const {i}=heap.pop();if(closed[i])continue;closed[i]=1;if(++visits>maxVisited)break;if(i===e){found=true;break;}
      for(const link of nodes[i].links.values()){const next=link.to,cost=g[i]+link.cost;if(!closed[next]&&cost<g[next]){g[next]=cost;parents[next]=i;heap.push({i:next,f:cost+dist(nodes[next].center,nodes[e].center)});}}
    }
    if(!found)return {...common,status:'unreachable',reason:'静态导航搜索未找到完整路径。',points:[],polygonPath:[],visited:visits};
    const path=[];for(let i=e;i!==-1;i=parents[i])path.push(i);path.reverse();
    const portals=path.slice(0,-1).map((i,j)=>nodes[i].links.get(path[j+1]).portal),waypoints=[xyz(start.position),...portals.map(p=>lerp(...p,.5)),xyz(end.position)],result=[];
    for(let i=0;i<path.length;i++)for(const p of onSurface(nodes[path[i]],waypoints[i],waypoints[i+1]))if(!result.length||dist(result.at(-1),p)>1e-6)result.push(p);
    let distance=0;for(let i=1;i<result.length;i++)distance+=dist(result[i-1],result[i]);
    return {...common,status:'complete',points:result.map(point),polygonPath:path.map(i=>nodes[i].key),distance,visited:visits,algorithm:'A* 多边形走廊 + 共享边中点 + 原生细节表面分段；非最短平滑路线'};
  }
  // These records retain original scene endpoints and declared start/end order.
  // They are never inserted into polygon adjacency or counted as walkable edges.
  const sourceRecord=source=>typeof source?.path==='string'&&source.path.length>0&&
    /^[a-f0-9]{64}$/i.test(source.sha256||'')&&typeof source.jsonPath==='string'&&source.jsonPath.length>0;
  const referenceLinks=(Array.isArray(nativeLinks)?nativeLinks:[]).filter(link=>
    typeof link?.id==='string'&&link.id.length>0&&
    [link.start,link.end].every(p=>p&&[p.x,p.y,p.z].every(Number.isFinite))&&
    sourceRecord(link.source)&&(
      link.type==='SceneNavMeshLinkData'&&/^Scene\.NavMeshLinks\[\d+\]$/.test(link.source.jsonPath)||
      link.type==='ConfigTeleportLink'&&link.direction==='source-start-to-end-only'&&
        ['lumina_elevator','interact_door'].includes(link.mechanism)&&
        /^Group\.Members\[\d+\]\.MemberPosition$/.test(link.source.jsonPath)&&
        sourceRecord(link.destinationSource)&&sourceRecord(link.scriptSource)&&
        /^Group\.GameplayExternalData\.PointMap\.[\w]+\.Data\.Position$/.test(link.destinationSource.jsonPath)&&
        Array.isArray(link.conditions)&&link.conditions.length>0
    )
  ).map(link=>({...link,start:{...link.start},end:{...link.end},source:{...link.source}}));
  const referenceCache=new Map();
  function route(startXYZ,endXYZ,options={}){
    const direct=walkingRoute(startXYZ,endXYZ,options);
    if(options.allowConditional===false)return direct;
    if(direct.status!=='unreachable'||!referenceLinks.length||!direct.snappedStart||!direct.snappedEnd||direct.snappedStart.component===direct.snappedEnd.component)return direct;
    const maxSnapDistance=options.maxSnapDistance??2;
    if(!referenceCache.has(maxSnapDistance))referenceCache.set(maxSnapDistance,referenceLinks.flatMap(link=>{
      const start=nearest(link.start,{maxSnapDistance}),end=nearest(link.end,{maxSnapDistance});
      return start&&end&&start.component!==end.component?[{...link,startComponent:start.component,endComponent:end.component}]:[];
    }));
    const references=referenceCache.get(maxSnapDistance),startComponent=direct.snappedStart.component,endComponent=direct.snappedEnd.component;
    const queue=[startComponent],parents=new Map([[startComponent,null]]);
    // Breadth-first component search minimizes reference transitions only.
    // Each walking leg is checked separately against the actual native surface.
    for(let i=0;i<queue.length&&!parents.has(endComponent);i++)for(const link of references){
      if(link.startComponent!==queue[i]||parents.has(link.endComponent))continue;
      parents.set(link.endComponent,link);queue.push(link.endComponent);
    }
    if(!parents.has(endComponent))return direct;
    const links=[];for(let component=endComponent;component!==startComponent;){const link=parents.get(component);links.push(link);component=link.startComponent;}links.reverse();
    const segments=[];let cursor=startXYZ,walkingDistance=0;
    for(const link of links){
      const leg=walkingRoute(cursor,link.start,options);if(leg.status!=='complete')return direct;
      segments.push({...leg,kind:'walking'});walkingDistance+=leg.distance;
      segments.push({kind:'special',id:link.id,type:link.type,areaType:link.areaType,
        label:link.label,labelEn:link.labelEn,mechanism:link.mechanism,
        source:link.source,destinationSource:link.destinationSource,scriptSource:link.scriptSource,
        conditions:link.conditions,conditionsEn:link.conditionsEn,start:link.start,end:link.end,points:[link.start,link.end],
        direction:'source-start-to-end-only',runtimeAvailability:'unknown',
        startComponent:link.startComponent,endComponent:link.endComponent});
      cursor=link.end;
    }
    const finalLeg=walkingRoute(cursor,endXYZ,options);if(finalLeg.status!=='complete')return direct;
    segments.push({...finalLeg,kind:'walking'});walkingDistance+=finalLeg.distance;
    return {...direct,status:'conditional',reason:'路线包含特殊通路，请确认本局可通行。',
      warnings:[direct.warnings[0],'步行段经过原生导航面；特殊通路单独标出，不计入步行距离。',
        '特殊连接按来源中的 start→end 使用；场景连接的反向通行不作推定。',
        ...new Set(links.flatMap(link=>link.conditions||[]))],
      points:[],polygonPath:[],segments,walkingDistance,specialLinkCount:links.length,
      nativeLinkPolicy:'source-start-to-end-only; runtime availability unknown',
      algorithm:'静态表面步行分段 + 有源场景或交互连接；非最短路线'};
  }
  return {route,nearest,stats};
}

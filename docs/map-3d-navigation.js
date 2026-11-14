/* Static, native navigation surfaces for the local third-person viewer.
 * Movement follows declared polygon portals. Nearby floors are never joined.
 * Dynamic doors and gameplay state are outside this offline snapshot.
 */
const EPS=1e-7,SEAM=.0011,CELL_SIZE=8;
const asPosition=p=>Array.isArray(p)?{x:p[0],y:p[1],z:p[2]}:p;
const finitePosition=p=>p&&[p.x,p.y,p.z].every(Number.isFinite);
const copyLocation=p=>p?{position:{...p.position},polygon:p.polygon,triangle:p.triangle,component:p.component}:null;
const cross=(ax,az,bx,bz)=>ax*bz-az*bx;

export async function loadMapNavigation(url,{signal}={}){
  const response=await fetch(url,{signal});
  if(!response.ok)throw new Error(`Navigation request failed (${response.status})`);
  return createNavigation(await response.json());
}

export function createNavigation(data){
  if(data?.format!=='duke-map-navigation-v1'||data.coordinateSpace!=='three-world')throw new Error('Unsupported navigation format');
  for(const key of ['vertices','triangles','polygons','portals'])if(!Array.isArray(data[key]))throw new Error(`Missing navigation ${key}`);
  if(data.vertices.length%3||data.triangles.length%3||data.polygons.length%3||data.portals.length%4)throw new Error('Incomplete navigation arrays');
  if(!data.vertices.every(Number.isFinite))throw new Error('Invalid navigation coordinates');
  const vertices=new Float64Array(data.vertices),indices=new Uint32Array(data.triangles),polygonRows=data.polygons;
  const vertexCount=vertices.length/3,triangleCount=indices.length/3,polygonCount=polygonRows.length/3;
  if(!data.triangles.every(v=>Number.isSafeInteger(v)&&v>=0&&v<vertexCount))throw new Error('Navigation triangle index out of bounds');
  const triangles=[],polygons=[],cells=new Map();let indexedReferences=0;
  const vertex=i=>[vertices[i*3],vertices[i*3+1],vertices[i*3+2]];
  const key=(x,z)=>`${x}:${z}`;
  for(let polygon=0;polygon<polygonCount;polygon++){
    const first=polygonRows[polygon*3],count=polygonRows[polygon*3+1],component=polygonRows[polygon*3+2];
    if(![first,count,component].every(Number.isSafeInteger)||first<0||count<0||component<0||first+count>triangleCount)throw new Error('Invalid navigation polygon');
    polygons.push({first,count,component,links:[]});
    for(let triangle=first;triangle<first+count;triangle++){
      if(triangles[triangle])throw new Error('Overlapping navigation polygon spans');
      const a=vertex(indices[triangle*3]),b=vertex(indices[triangle*3+1]),c=vertex(indices[triangle*3+2]);
      const abx=b[0]-a[0],abz=b[2]-a[2],acx=c[0]-a[0],acz=c[2]-a[2],det=cross(abx,abz,acx,acz);
      if(Math.abs(det)<1e-10)throw new Error('Degenerate navigation triangle');
      const minX=Math.min(a[0],b[0],c[0]),maxX=Math.max(a[0],b[0],c[0]),minZ=Math.min(a[2],b[2],c[2]),maxZ=Math.max(a[2],b[2],c[2]);
      const row={a,b,c,abx,abz,acx,acz,inv:1/det,polygon,triangle,minX,maxX,minZ,maxZ,
        tolerances:[SEAM*Math.hypot(acx,acz)/Math.abs(det),SEAM*Math.hypot(abx,abz)/Math.abs(det),SEAM*Math.hypot(c[0]-b[0],c[2]-b[2])/Math.abs(det)]};
      triangles[triangle]=row;
      for(let x=Math.floor((minX-SEAM)/CELL_SIZE);x<=Math.floor((maxX+SEAM)/CELL_SIZE);x++)for(let z=Math.floor((minZ-SEAM)/CELL_SIZE);z<=Math.floor((maxZ+SEAM)/CELL_SIZE);z++){
        const cellKey=key(x,z);if(!cells.has(cellKey))cells.set(cellKey,[]);cells.get(cellKey).push(triangle);indexedReferences++;
      }
    }
  }
  if(triangles.filter(Boolean).length!==triangleCount)throw new Error('Unassigned navigation triangle');
  for(let i=0;i<data.portals.length;i+=4){
    const [a,b,va,vb]=data.portals.slice(i,i+4);
    if(![a,b,va,vb].every(Number.isSafeInteger)||a<0||b<0||a>=polygonCount||b>=polygonCount||va<0||vb<0||va>=vertexCount||vb>=vertexCount||a===b)throw new Error('Invalid navigation portal');
    if(polygons[a].component!==polygons[b].component)throw new Error('Navigation portal crosses disconnected components');
    const p=vertex(va),q=vertex(vb);polygons[a].links.push({to:b,a:p,b:q});polygons[b].links.push({to:a,a:p,b:q});
  }

  function height(tri,x,z){
    if(x<tri.minX-SEAM||x>tri.maxX+SEAM||z<tri.minZ-SEAM||z>tri.maxZ+SEAM)return null;
    const dx=x-tri.a[0],dz=z-tri.a[2],u=cross(dx,dz,tri.acx,tri.acz)*tri.inv,v=cross(tri.abx,tri.abz,dx,dz)*tri.inv;
    if(u < -tri.tolerances[0]||v < -tri.tolerances[1]||1-u-v < -tri.tolerances[2])return null;
    return tri.a[1]+u*(tri.b[1]-tri.a[1])+v*(tri.c[1]-tri.a[1]);
  }
  const location=(tri,x,y,z)=>({position:{x,y,z},polygon:tri.polygon,triangle:tri.triangle,component:polygons[tri.polygon].component});
  function onPolygon(polygon,x,z,referenceY){
    const row=polygons[polygon];if(!row)return null;let result=null,distance=Infinity;
    for(let i=row.first;i<row.first+row.count;i++){const y=height(triangles[i],x,z);if(y===null)continue;const d=Math.abs(y-referenceY);if(d<distance){distance=d;result=location(triangles[i],x,y,z);}}
    return result;
  }
  function candidates(x,z,radius=0){
    const result=new Set();for(let ix=Math.floor((x-radius)/CELL_SIZE);ix<=Math.floor((x+radius)/CELL_SIZE);ix++)for(let iz=Math.floor((z-radius)/CELL_SIZE);iz<=Math.floor((z+radius)/CELL_SIZE);iz++)for(const index of cells.get(key(ix,iz))||[])result.add(index);return result;
  }

  // A segment may change polygons only where it crosses a declared portal.
  // Component membership alone is insufficient: stacked floors can belong to
  // the same component via a distant staircase.
  function trace(start,x,z,maxStep=.75){
    const origin=start.position,dx=x-origin.x,dz=z-origin.z,distance=Math.hypot(dx,dz);
    let current=start.polygon,referenceY=origin.y,progress=-1e-6;const visited=new Set();
    for(let pass=0;pass<24;pass++){
      const end=onPolygon(current,x,z,referenceY);
      if(end&&Math.abs(end.position.y-origin.y)<=maxStep+distance*1.05)return end;
      visited.add(current);let crossing=null;
      for(const portal of polygons[current].links){
        if(visited.has(portal.to))continue;
        const ex=portal.b[0]-portal.a[0],ez=portal.b[2]-portal.a[2],den=cross(dx,dz,ex,ez);if(Math.abs(den)<EPS)continue;
        const ax=portal.a[0]-origin.x,az=portal.a[2]-origin.z;let t=cross(ax,az,ex,ez)/den,u=cross(ax,az,dx,dz)/den,reconciled=false;
        // The previous step can finish within the millimetre overlap of two
        // native polygons. Reconcile ownership only at that declared portal;
        // otherwise its mathematical crossing can sit just behind the origin.
        if(pass===0&&t<0){const squared=ex*ex+ez*ez,along=squared?Math.max(0,Math.min(1,(-ax*ex-az*ez)/squared)):0;
          if(Math.hypot(ax+along*ex,az+along*ez)<=SEAM){t=0;u=along;reconciled=true;}}
        if(t<progress-1e-6||t < -1e-5||t>1+1e-5||u < -1e-5||u>1+1e-5)continue;
        const probe=Math.min(1,Math.max(0,t)+(reconciled?SEAM*3:Math.min(.001*distance,.00005))/Math.max(distance,EPS));
        const next=onPolygon(portal.to,origin.x+dx*probe,origin.z+dz*probe,referenceY);if(!next)continue;
        const crossingY=portal.a[1]+u*(portal.b[1]-portal.a[1]);
        if(Math.abs(next.position.y-crossingY)>maxStep+.03)continue;
        if(!crossing||t<crossing.t)crossing={t,to:portal.to,y:next.position.y};
      }
      if(!crossing)return null;
      progress=crossing.t;current=crossing.to;referenceY=crossing.y;
    }
    return null;
  }
  function clearance(point,radius,maxStep=.75){
    if(radius<=0)return true;
    for(let i=0;i<8;i++){const angle=i*Math.PI/4;if(!trace(point,point.position.x+Math.cos(angle)*radius,point.position.z+Math.sin(angle)*radius,maxStep))return false;}
    return true;
  }
  function findGround(position,{maxDrop=1.25,maxRise=.35,radius=.15}={}){
    position=asPosition(position);
    if(!finitePosition(position)||![maxDrop,maxRise,radius].every(v=>Number.isFinite(v)&&v>=0))return null;
    const choices=[];
    for(const index of candidates(position.x,position.z)){
      const tri=triangles[index],y=height(tri,position.x,position.z);if(y===null||y<position.y-maxDrop||y>position.y+maxRise)continue;
      choices.push(location(tri,position.x,y,position.z));
    }
    choices.sort((a,b)=>Math.abs(a.position.y-position.y)-Math.abs(b.position.y-position.y));
    return choices.find(point=>clearance(point,radius))||null;
  }
  function closestXZ(tri,x,z){
    const ground=height(tri,x,z);if(ground!==null)return {x,y:ground,z};
    let best=null,distance=Infinity;
    for(const [a,b]of [[tri.a,tri.b],[tri.b,tri.c],[tri.c,tri.a]]){
      const dx=b[0]-a[0],dz=b[2]-a[2],squared=dx*dx+dz*dz,t=squared?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[2])*dz)/squared)):0;
      const q={x:a[0]+t*dx,y:a[1]+t*(b[1]-a[1]),z:a[2]+t*dz},d=Math.hypot(q.x-x,q.z-z);if(d<distance){distance=d;best=q;}
    }
    return best;
  }
  function getSpawn(preferred,{maxDistance=12,maxVerticalDistance=2,radius=.15}={}){
    preferred=asPosition(preferred);
    if(finitePosition(preferred)){
      const direct=findGround(preferred,{maxDrop:maxVerticalDistance,maxRise:maxVerticalDistance,radius});if(direct)return direct;
      const choices=[];
      for(const index of candidates(preferred.x,preferred.z,maxDistance)){
        const tri=triangles[index],closest=closestXZ(tri,preferred.x,preferred.z);
        const center={x:(tri.a[0]+tri.b[0]+tri.c[0])/3,y:(tri.a[1]+tri.b[1]+tri.c[1])/3,z:(tri.a[2]+tri.b[2]+tri.c[2])/3};
        const d=Math.hypot(center.x-closest.x,center.z-closest.z),t=d?Math.min(1,(radius+.12)/d):1;
        for(const p of [{x:closest.x+(center.x-closest.x)*t,y:closest.y+(center.y-closest.y)*t,z:closest.z+(center.z-closest.z)*t},center]){
          const xz=Math.hypot(p.x-preferred.x,p.z-preferred.z),vertical=Math.abs(p.y-preferred.y);
          if(xz<=maxDistance&&vertical<=maxVerticalDistance)choices.push({point:location(tri,p.x,p.y,p.z),distance:Math.hypot(xz,vertical)});
        }
      }
      choices.sort((a,b)=>a.distance-b.distance);for(const item of choices)if(clearance(item.point,radius))return item.point;
    }
    const fallback=data.defaultSpawn;
    if(fallback&&finitePosition(fallback.position)){
      const result=onPolygon(fallback.polygon,fallback.position.x,fallback.position.z,fallback.position.y);
      if(result&&clearance(result,radius))return result;
    }
    return null;
  }
  function move(start,delta,{radius=.15,maxStep=.75,slide=true}={}){
    if(!start||!finitePosition(start.position)||!polygons[start.polygon]||!Number.isFinite(delta?.x)||!Number.isFinite(delta?.z))return {location:copyLocation(start),movedDistance:0,blocked:true};
    if(!Number.isFinite(radius)||radius<0||!Number.isFinite(maxStep)||maxStep<0)return {location:copyLocation(start),movedDistance:0,blocked:true};
    let current=onPolygon(start.polygon,start.position.x,start.position.z,start.position.y);
    if(!current||Math.abs(current.position.y-start.position.y)>.05)return {location:copyLocation(start),movedDistance:0,blocked:true};
    const length=Math.hypot(delta.x,delta.z);if(length<EPS)return {location:copyLocation(current),movedDistance:0,blocked:false};
    const fraction=Math.min(1,7.68/length),steps=Math.max(1,Math.ceil(length*fraction/.12)),dx=delta.x*fraction/steps,dz=delta.z*fraction/steps;
    let blocked=fraction<1,movedDistance=0;
    const attempt=(x,z)=>{const result=trace(current,x,z,maxStep);return result&&clearance(result,radius,maxStep)?result:null;};
    for(let i=0;i<steps;i++){
      let next=attempt(current.position.x+dx,current.position.z+dz);
      if(!next)blocked=true;
      if(!next&&slide){const first=Math.abs(dx)>=Math.abs(dz)?[dx,0]:[0,dz],second=first[0]?[0,dz]:[dx,0];
        if(Math.hypot(...first)>EPS)next=attempt(current.position.x+first[0],current.position.z+first[1]);
        if(!next&&Math.hypot(...second)>EPS)next=attempt(current.position.x+second[0],current.position.z+second[1]);
      }
      if(!next)break;
      movedDistance+=Math.hypot(next.position.x-current.position.x,next.position.z-current.position.z);current=next;
    }
    return {location:copyLocation(current),movedDistance,blocked};
  }
  return {findGround,getSpawn,move,stats:{...data.stats,gridCells:cells.size,indexedTriangleReferences:indexedReferences},
    // Read-only inspection is useful for verifying ramps and overlapping floors.
    getPolygon:id=>polygons[id]?{...polygons[id],links:polygons[id].links.map(link=>({to:link.to,a:[...link.a],b:[...link.b]}))}:null};
}

export const createMapNavigation=createNavigation;

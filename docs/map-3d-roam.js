import * as THREE from 'three';

const ACTIONS=new Set(['forward','backward','left','right','up','down','fast']);
const KEY_ACTIONS={KeyW:'forward',ArrowUp:'forward',KeyS:'backward',ArrowDown:'backward',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',Space:'up',ControlLeft:'down',ControlRight:'down',KeyC:'down',ShiftLeft:'fast',ShiftRight:'fast'};
const clamp=THREE.MathUtils.clamp;
const asPosition=value=>Array.isArray(value)&&value.length===3&&value.every(Number.isFinite)?new THREE.Vector3(...value):value&&[value.x,value.y,value.z].every(Number.isFinite)?new THREE.Vector3(value.x,value.y,value.z):null;
const editing=target=>Boolean(target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'));

function makeExplorer(){
  const root=new THREE.Group();root.name='DUKE placeholder explorer';root.visible=false;
  const blue=new THREE.MeshStandardMaterial({color:0x6479ed,roughness:.78,metalness:.06});
  const purple=new THREE.MeshStandardMaterial({color:0x8d6cdb,roughness:.75});
  const light=new THREE.MeshStandardMaterial({color:0xe3e8f9,roughness:.72});
  const dark=new THREE.MeshStandardMaterial({color:0x252e50,roughness:.85});
  const visor=new THREE.MeshStandardMaterial({color:0x71e6fa,emissive:0x296e93,emissiveIntensity:.4,roughness:.3});
  const geometries=[],materials=[blue,purple,light,dark,visor];
  function part(geometry,material,parent=root,position=[0,0,0]){geometries.push(geometry);const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);mesh.castShadow=false;mesh.receiveShadow=false;parent.add(mesh);return mesh;}
  const body=new THREE.Group();root.add(body);
  part(new THREE.CapsuleGeometry(.25,.34,4,10),blue,body,[0,1.12,0]);
  part(new THREE.BoxGeometry(.34,.35,.15),purple,body,[0,1.13,.26]);
  part(new THREE.CylinderGeometry(.09,.09,.14,8),dark,body,[0,1.52,0]);
  part(new THREE.SphereGeometry(.25,14,10),light,body,[0,1.76,0]);
  const face=part(new THREE.SphereGeometry(.205,12,8),visor,body,[0,1.78,-.14]);face.scale.set(1,.48,.65);
  const arms=[],legs=[];
  for(const side of [-1,1]){
    const arm=new THREE.Group();arm.position.set(side*.34,1.37,0);body.add(arm);arms.push(arm);
    part(new THREE.CapsuleGeometry(.075,.36,3,8),blue,arm,[0,-.24,0]);
    part(new THREE.SphereGeometry(.095,10,7),light,arm,[0,-.5,0]);
    const leg=new THREE.Group();leg.position.set(side*.145,.76,0);body.add(leg);legs.push(leg);
    part(new THREE.CapsuleGeometry(.095,.42,3,8),dark,leg,[0,-.30,0]);
    part(new THREE.BoxGeometry(.2,.15,.32),purple,leg,[0,-.64,-.055]);
  }
  const shadowMaterial=new THREE.MeshBasicMaterial({color:0x10162c,transparent:true,opacity:.22,depthWrite:false,side:THREE.DoubleSide});materials.push(shadowMaterial);
  const shadowGeometry=new THREE.CircleGeometry(.43,24);geometries.push(shadowGeometry);
  const shadow=new THREE.Mesh(shadowGeometry,shadowMaterial);shadow.name='Explorer contact shadow';shadow.rotation.x=-Math.PI/2;shadow.visible=false;shadow.renderOrder=2;
  return {root,body,arms,legs,shadow,dispose(){for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();}};
}

// This is a local camera guard, not a replacement for the game's collision data.
// Instances get small spatial entries; large merged meshes remain broad-phase
// candidates. A strict triangle budget keeps dense scenery out of the frame loop.
function makeCameraGuard(meshes){
  const entries=[],cells=new Map(),large=[],cellSize=24;
  const matrix=new THREE.Matrix4(),instance=new THREE.Matrix4(),raycaster=new THREE.Raycaster(),proxy=new THREE.Mesh();proxy.matrixAutoUpdate=false;
  const key=(x,z)=>`${x}:${z}`;
  function insert(mesh,worldMatrix){
    const geometry=mesh.geometry;if(!geometry?.attributes.position)return;
    const material=mesh.material,assigned=Array.isArray(material)?material:[material];
    if(!assigned.some(item=>item&&!item.transparent&&item.opacity>.1))return;
    if(!geometry.boundingSphere)geometry.computeBoundingSphere();
    const sphere=geometry.boundingSphere.clone().applyMatrix4(worldMatrix);if(!(sphere.radius>.01)||!Number.isFinite(sphere.radius))return;
    const triangles=(geometry.index?.count||geometry.attributes.position.count)/3;
    const entry={geometry,material,matrix:worldMatrix.clone(),sphere,triangles,id:entries.length};entries.push(entry);
    const minX=Math.floor((sphere.center.x-sphere.radius)/cellSize),maxX=Math.floor((sphere.center.x+sphere.radius)/cellSize),minZ=Math.floor((sphere.center.z-sphere.radius)/cellSize),maxZ=Math.floor((sphere.center.z+sphere.radius)/cellSize);
    if((maxX-minX+1)*(maxZ-minZ+1)>64){large.push(entry);return;}
    for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){const id=key(x,z);if(!cells.has(id))cells.set(id,[]);cells.get(id).push(entry);}
  }
  for(const mesh of meshes||[]){
    if(!mesh?.isMesh||mesh.visible===false)continue;mesh.updateWorldMatrix(true,false);
    if(mesh.isInstancedMesh){for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,instance);matrix.multiplyMatrices(mesh.matrixWorld,instance);insert(mesh,matrix);}}
    else insert(mesh,mesh.matrixWorld);
  }
  const offset=new THREE.Vector3(),direction=new THREE.Vector3(),hits=[];
  let lastStats={candidates:0,raycastMeshes:0,triangles:0,skipped:0};
  function distance(origin,destination){
    direction.copy(destination).sub(origin);const length=direction.length();if(length<.01)return length;direction.multiplyScalar(1/length);
    const candidates=[],seen=new Set();
    const minX=Math.floor(Math.min(origin.x,destination.x)/cellSize),maxX=Math.floor(Math.max(origin.x,destination.x)/cellSize),minZ=Math.floor(Math.min(origin.z,destination.z)/cellSize),maxZ=Math.floor(Math.max(origin.z,destination.z)/cellSize);
    function consider(entry){if(seen.has(entry.id))return;seen.add(entry.id);offset.copy(entry.sphere.center).sub(origin);const along=offset.dot(direction),radius=entry.sphere.radius+.25;const nearest=clamp(along,0,length);if(offset.lengthSq()+nearest*nearest-2*nearest*along>radius*radius)return;const perpendicular=Math.max(0,offset.lengthSq()-along*along);candidates.push({entry,near:Math.max(0,along-Math.sqrt(Math.max(0,radius*radius-perpendicular)))});}
    for(const entry of large)consider(entry);
    for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++)for(const entry of cells.get(key(x,z))||[])consider(entry);
    candidates.sort((a,b)=>a.near-b.near);let closest=length,triangles=0,count=0,skipped=0;
    raycaster.set(origin,direction);raycaster.near=.06;
    for(const {entry,near} of candidates){
      if(near>closest)break;
      if(count>=24||triangles+entry.triangles>140000){skipped++;continue;}
      triangles+=entry.triangles;count++;proxy.geometry=entry.geometry;proxy.material=entry.material;proxy.matrixWorld.copy(entry.matrix);raycaster.far=closest;hits.length=0;proxy.raycast(raycaster,hits);
      for(const hit of hits)if(hit.distance<closest)closest=hit.distance;
    }
    lastStats={candidates:candidates.length,raycastMeshes:count,triangles,skipped};return Math.max(.45,closest<length?closest-.28:length);
  }
  return {distance,getState:()=>({...lastStats,entries:entries.length})};
}

/** Third-person local preview controller. All positions use the existing Three world space. */
export function createRoamController({scene,camera,canvas,controls,navigation=null,collisionMeshes=[],requestRender=()=>{},onChange=()=>{},onError=()=>{}}={}){
  if(!scene||!camera||!canvas||!controls)throw new Error('The roam controller needs scene, camera, canvas and orbit controls.');
  const explorer=makeExplorer();scene.add(explorer.root,explorer.shadow);
  const heldKeys=new Set(),touchActions=new Set(),position=new THREE.Vector3(),lookTarget=new THREE.Vector3(),desiredCamera=new THREE.Vector3(),cameraOffset=new THREE.Vector3(),movement=new THREE.Vector3();
  const forward=new THREE.Vector3(),right=new THREE.Vector3(),safeCamera=new THREE.Vector3();
  let active=false,fastFlight=false,mode='run',snapshot=null,navLocation=null,yaw=0,pitch=.24,facing=0,gait=0,limbAmount=0,elapsed=0,guardAt=-Infinity,navCameraAt=-Infinity,guardDistance=9,navCameraDistance=9;
  let pointerId=null,lastPointerX=0,lastPointerY=0,disposed=false,guard=null,grounded=false,lastReason=null,lastMoved=0;
  const followDistance=9,runSpeed=16,flySpeed=7,fastFlySpeed=16,eyeHeight=1.43;
  const navOptions={radius:.15,maxStep:.75};
  const notify=()=>onChange(getState());
  function result(ok,reason){return {ok,...(reason?{reason}:{}),mode,position:position.toArray()};}
  function clearInput(){heldKeys.clear();touchActions.clear();if(pointerId!==null){try{if(canvas.hasPointerCapture?.(pointerId))canvas.releasePointerCapture(pointerId);}catch{/* Capture may already be released. */}pointerId=null;}if(active)requestRender();}
  function pressed(action){if(touchActions.has(action))return true;for(const code of heldKeys)if(KEY_ACTIONS[code]===action)return true;return false;}
  function setInput(action,down){if(action==='boost')action='fast';if(!ACTIONS.has(action)||!active)return false;if(action==='fast'){if(mode!=='fly')return false;fastFlight=Boolean(down);notify();requestRender();return true;}down?touchActions.add(action):touchActions.delete(action);requestRender();return true;}
  function rotate(dx,dy){if(!active||!Number.isFinite(dx)||!Number.isFinite(dy))return;yaw-=dx*.004;pitch=clamp(pitch+dy*.004,-.3,1.08);requestRender();}
  function setAvatarPosition(){explorer.root.position.copy(position);explorer.root.position.y+=.025;explorer.root.rotation.y=facing;explorer.root.updateMatrixWorld(true);}
  function capture(){return {position:camera.position.clone(),quaternion:camera.quaternion.clone(),up:camera.up.clone(),fov:camera.fov,near:camera.near,far:camera.far,zoom:camera.zoom,target:controls.target.clone(),enabled:controls.enabled,enableDamping:controls.enableDamping};}
  function restore(){
    if(!snapshot)return;
    const reset=()=>{camera.position.copy(snapshot.position);camera.quaternion.copy(snapshot.quaternion);camera.up.copy(snapshot.up);camera.fov=snapshot.fov;camera.near=snapshot.near;camera.far=snapshot.far;camera.zoom=snapshot.zoom;camera.updateProjectionMatrix();controls.target.copy(snapshot.target);};
    // Flush OrbitControls' residual damping before restoring the exact saved view.
    controls.enableDamping=false;reset();controls.update();reset();controls.update();reset();controls.enableDamping=snapshot.enableDamping;controls.enabled=snapshot.enabled;camera.updateMatrixWorld(true);snapshot=null;
  }
  function groundAt(point,options){return navigation?.findGround?.({x:point.x,y:point.y,z:point.z},options)||null;}
  function enter(options={}){
    if(disposed)return result(false,'disposed');
    const requested=options.mode==='fly'?'fly':'run';
    if(active)return setMode(requested);
    const preferred=asPosition(options.position)||controls.target.clone();
    const start=navigation?.getSpawn?.({x:preferred.x,y:preferred.y,z:preferred.z})||null;
    if(requested==='run'&&!start){lastReason='navigation-unavailable';return result(false,lastReason);}
    snapshot=capture();controls.enabled=false;clearInput();fastFlight=false;
    const direction=snapshot.position.clone().sub(snapshot.target);yaw=Math.atan2(direction.x,direction.z);pitch=.24;facing=yaw;mode=requested;navLocation=start;
    if(start)position.copy(asPosition(start.position));else position.copy(preferred);
    if(mode==='fly')position.y+=1.5;
    grounded=mode==='run';lastReason=null;active=true;gait=0;limbAmount=0;elapsed=0;guardAt=-Infinity;navCameraAt=-Infinity;guardDistance=followDistance;navCameraDistance=followDistance;
    if(!guard)guard=makeCameraGuard(collisionMeshes);
    explorer.root.visible=true;explorer.shadow.visible=grounded;camera.fov=58;camera.near=.08;camera.updateProjectionMatrix();setAvatarPosition();updateCamera(0,true);notify();requestRender();return result(true);
  }
  function exit(){if(!active)return result(true);clearInput();active=false;fastFlight=false;navLocation=null;grounded=false;explorer.root.visible=false;explorer.shadow.visible=false;restore();lastReason=null;notify();requestRender();return result(true);}
  function setMode(next){
    if(next==='walk')next='run';
    if(next!=='run'&&next!=='fly')return result(false,'invalid-mode');
    if(!active)return enter({mode:next});
    if(mode===next)return result(true);
    if(next==='run'){
      const ground=groundAt(position,{maxDrop:1.8,maxRise:.3,radius:.15});
      if(!ground){lastReason=navigation?'no-ground':'navigation-unavailable';onError(lastReason);notify();return result(false,lastReason);}
      navLocation=ground;position.copy(asPosition(ground.position));grounded=true;
    }else{grounded=false;navLocation=null;}
    mode=next;clearInput();lastReason=null;guardAt=-Infinity;navCameraAt=-Infinity;setAvatarPosition();notify();requestRender();return result(true);
  }
  function teleport(value){
    const target=asPosition(value);if(!active||!target||!target.toArray().every(Number.isFinite))return result(false,'invalid-position');
    if(mode==='run'){const ground=groundAt(target,{maxDrop:1.8,maxRise:.3,radius:.15});if(!ground)return result(false,'no-ground');navLocation=ground;position.copy(asPosition(ground.position));}
    else position.copy(target);
    clearInput();setAvatarPosition();guardAt=-Infinity;navCameraAt=-Infinity;updateCamera(0,true);notify();requestRender();return result(true);
  }
  function updateCamera(dt,instant=false){
    lookTarget.copy(position);lookTarget.y+=eyeHeight;
    cameraOffset.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
    desiredCamera.copy(lookTarget).addScaledVector(cameraOffset,followDistance);
    if(instant||elapsed-navCameraAt>=.2){
      navCameraAt=elapsed;navCameraDistance=followDistance;
      if(mode==='run'&&navLocation&&navigation?.move){
        // The source navigation mesh has walls/edges but no ceiling volumes.
        // Trace only 4 m to stay cheap; farther camera obstruction uses rays.
        const horizontal=Math.hypot(cameraOffset.x,cameraOffset.z),traceLength=Math.min(4,followDistance*horizontal);
        if(horizontal>.01){const trace=navigation.move(navLocation,{x:cameraOffset.x/horizontal*traceLength,z:cameraOffset.z/horizontal*traceLength},{radius:.05,maxStep:.75,slide:false});if(trace?.blocked)navCameraDistance=Math.max(.7,Math.max(0,trace.movedDistance-.18)/horizontal);}
      }
    }
    if(instant||elapsed-guardAt>=.1){guardAt=elapsed;guardDistance=guard?.distance(lookTarget,desiredCamera)??followDistance;}
    const distance=Math.min(followDistance,guardDistance,mode==='run'?navCameraDistance:followDistance);
    safeCamera.copy(lookTarget).addScaledVector(cameraOffset,distance);
    // Pull in immediately at a nearby obstacle; easing only the outward motion
    // avoids deliberately interpolating a camera through the detected surface.
    if(instant||camera.position.distanceTo(lookTarget)>distance+.15)camera.position.copy(safeCamera);
    else camera.position.lerp(safeCamera,1-Math.exp(-dt*14));
    camera.lookAt(lookTarget);camera.updateMatrixWorld(true);controls.target.copy(lookTarget);
    explorer.root.visible=active&&distance>.75;
    return camera.position.distanceToSquared(safeCamera)>.0001;
  }
  function update(dt=1/60){
    if(!active||disposed)return false;dt=Number.isFinite(dt)?clamp(dt,0,.05):0;elapsed+=dt;
    const horizontal=(pressed('right')?1:0)-(pressed('left')?1:0),vertical=(pressed('forward')?1:0)-(pressed('backward')?1:0),lift=(pressed('up')?1:0)-(pressed('down')?1:0);
    forward.set(-Math.sin(yaw),0,-Math.cos(yaw));right.set(Math.cos(yaw),0,-Math.sin(yaw));movement.set(0,0,0).addScaledVector(forward,vertical).addScaledVector(right,horizontal);
    if(movement.lengthSq()>1)movement.normalize();
    if(mode==='fly')movement.y=lift;
    if(mode==='fly'&&movement.lengthSq()>1)movement.normalize();
    const speed=mode==='run'?runSpeed:(fastFlight?fastFlySpeed:flySpeed),inputMoving=movement.lengthSq()>0;
    movement.multiplyScalar(speed*dt);lastMoved=0;
    if(mode==='run'&&navLocation&&inputMoving){
      const moved=navigation.move(navLocation,{x:movement.x,z:movement.z},navOptions);
      if(moved?.location){navLocation=moved.location;const next=asPosition(navLocation.position);lastMoved=position.distanceTo(next);position.copy(next);grounded=true;}
    }else if(mode==='fly'&&inputMoving){
      const before=position.clone();position.add(movement);
      // Free flight has no invented wall physics. Do not let a downward step
      // slip just below a known nearby navigation floor, however.
      const floor=movement.y<0?groundAt(position,{maxDrop:.12,maxRise:-movement.y+.06,radius:0}):null;
      if(floor&&before.y>=floor.position.y-.02&&floor.position.y>position.y)position.y=floor.position.y;
      lastMoved=position.distanceTo(before);grounded=false;
    }
    if(inputMoving&&Math.hypot(movement.x,movement.z)>.00001){const desired=Math.atan2(-movement.x,-movement.z);facing+=Math.atan2(Math.sin(desired-facing),Math.cos(desired-facing))*(1-Math.exp(-dt*14));}
    const targetAmount=mode==='run'&&lastMoved>.001?1:0;limbAmount+=(targetAmount-limbAmount)*(1-Math.exp(-dt*15));gait+=lastMoved*2.8;
    const swing=Math.sin(gait)*.55*limbAmount;
    explorer.legs[0].rotation.x=swing;explorer.legs[1].rotation.x=-swing;explorer.arms[0].rotation.x=-swing-(mode==='fly'?.2:0);explorer.arms[1].rotation.x=swing-(mode==='fly'?.2:0);explorer.body.rotation.x=mode==='fly'&&inputMoving?-.08:0;
    setAvatarPosition();
    if(mode==='run'){explorer.shadow.visible=true;explorer.shadow.position.set(position.x,position.y+.035,position.z);}else explorer.shadow.visible=false;
    const cameraMoving=updateCamera(dt);
    return inputMoving||cameraMoving||Math.abs(limbAmount-targetAmount)>.002;
  }
  function getState(){return {active,mode,fastFlight,position:position.toArray(),heading:yaw,pitch,grounded,avatarVisible:explorer.root.visible,navigationReady:Boolean(navigation),navigationPolygon:navLocation?.polygon??null,lastReason,input:[...new Set([...touchActions,...[...heldKeys].map(code=>KEY_ACTIONS[code])])],cameraDistance:camera.position.distanceTo(lookTarget),lastMoved,cameraGuard:guard?.getState()||null};}
  function keydown(event){
    if(!active||event.defaultPrevented)return;if(editing(event.target)){clearInput();return;}if(event.altKey||event.metaKey)return;
    if(event.code==='Escape'){event.preventDefault();exit();return;}
    const action=KEY_ACTIONS[event.code];if(!action)return;
    if(action==='fast'){if(mode==='fly'){event.preventDefault();if(!event.repeat)setInput('fast',!fastFlight);}return;}
    if(mode==='run'&&(action==='up'||action==='down'))return;
    event.preventDefault();if(!heldKeys.has(event.code)){heldKeys.add(event.code);requestRender();}
  }
  function keyup(event){if(heldKeys.delete(event.code)&&active){if(!editing(event.target))event.preventDefault();requestRender();}}
  function pointerdown(event){if(!active||pointerId!==null||!(event.pointerType==='touch'||event.button===0))return;event.preventDefault();pointerId=event.pointerId;lastPointerX=event.clientX;lastPointerY=event.clientY;canvas.setPointerCapture?.(pointerId);}
  function pointermove(event){if(!active||event.pointerId!==pointerId)return;event.preventDefault();rotate(event.clientX-lastPointerX,event.clientY-lastPointerY);lastPointerX=event.clientX;lastPointerY=event.clientY;}
  function pointerup(event){if(event.pointerId!==pointerId)return;try{if(canvas.hasPointerCapture?.(pointerId))canvas.releasePointerCapture(pointerId);}catch{/* Browser already released capture. */}pointerId=null;}
  const contextmenu=event=>{if(active)event.preventDefault();},visibility=()=>{if(document.hidden)clearInput();},focus=event=>{if(editing(event.target))clearInput();};
  window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',clearInput);document.addEventListener('visibilitychange',visibility);document.addEventListener('focusin',focus);
  canvas.addEventListener('pointerdown',pointerdown);canvas.addEventListener('pointermove',pointermove);canvas.addEventListener('pointerup',pointerup);canvas.addEventListener('pointercancel',pointerup);canvas.addEventListener('lostpointercapture',pointerup);canvas.addEventListener('contextmenu',contextmenu);
  function dispose(){if(disposed)return;exit();disposed=true;window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',clearInput);document.removeEventListener('visibilitychange',visibility);document.removeEventListener('focusin',focus);canvas.removeEventListener('pointerdown',pointerdown);canvas.removeEventListener('pointermove',pointermove);canvas.removeEventListener('pointerup',pointerup);canvas.removeEventListener('pointercancel',pointerup);canvas.removeEventListener('lostpointercapture',pointerup);canvas.removeEventListener('contextmenu',contextmenu);scene.remove(explorer.root,explorer.shadow);explorer.dispose();}
  return {get active(){return active;},enter,exit,setMode,update,getState,setInput,rotate,teleport,clearInput,dispose};
}

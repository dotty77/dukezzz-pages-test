import * as THREE from 'three';

const textureSlots=['map','normalMap','roughnessMap','metalnessMap','emissiveMap','alphaMap'];
const wrapping={repeat:THREE.RepeatWrapping,clamp:THREE.ClampToEdgeWrapping,mirror:THREE.MirroredRepeatWrapping};
const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));

function progressReporter(callback) {
  let lastTime=-Infinity,lastKind='';
  return (progress,force=false)=>{const now=performance.now();if(force||progress.kind!==lastKind||now-lastTime>=100){lastTime=now;lastKind=progress.kind;callback(progress);}};
}
// Production packs retain the exact exported bytes, split only for hosting limits.
function geometryParts(parts,base) {
  if(!Array.isArray(parts)||!parts.length)throw new Error('Invalid map geometry parts');
  let total=0;for(const part of parts){if(!part||typeof part.url!=='string'||!part.url||!Number.isSafeInteger(part.byteLength)||part.byteLength<=0)throw new Error('Invalid map geometry part');total+=part.byteLength;if(!Number.isSafeInteger(total))throw new Error('Invalid packed geometry byte length');}
  let index=0,reader=null,received=0,stopped=false;const abort=new AbortController();
  async function release(reason){abort.abort(reason);if(reader){const active=reader;reader=null;try{await active.cancel(reason);}catch{}finally{active.releaseLock();}}}
  const body=new ReadableStream({
    async pull(controller){try{
      while(!stopped){
        if(index===parts.length){stopped=true;controller.close();return;}
        const part=parts[index];
        if(!reader){const response=await fetch(new URL(part.url,base),{signal:abort.signal});if(!response.ok)throw new Error(`Geometry part request failed (${response.status})`);if(stopped){await response.body?.cancel();return;}const stream=response.body||new ReadableStream({async start(target){try{target.enqueue(new Uint8Array(await response.arrayBuffer()));target.close();}catch(error){target.error(error);}}});reader=stream.getReader();received=0;}
        const item=await reader.read();if(stopped)return;
        if(item.done){reader.releaseLock();reader=null;if(received!==part.byteLength)throw new Error('A map geometry part is incomplete.');index++;continue;}
        if(item.value.byteLength>part.byteLength-received)throw new Error('A map geometry part exceeds its declared byte length.');received+=item.value.byteLength;controller.enqueue(item.value);return;
      }
    }catch(error){stopped=true;await release(error);controller.error(error);}},
    async cancel(reason){stopped=true;await release(reason);}
  });
  return {ok:true,status:200,headers:new Headers({'content-length':String(total)}),body};
}
function texturePackSource(packed,base) {
  const cache=new Map();
  if(packed){
    if(packed.format!=='duke-map3d-texture-packs-v1'||!Array.isArray(packed.packs)||!packed.packs.length||!packed.images||typeof packed.images!=='object'||Array.isArray(packed.images))throw new Error('Invalid map texture packs');
    for(const pack of packed.packs)if(!pack||typeof pack.url!=='string'||!pack.url||!Number.isSafeInteger(pack.byteLength)||pack.byteLength<=0)throw new Error('Invalid map texture pack');
    for(const image of Object.values(packed.images)){const pack=packed.packs[image?.pack];if(!Number.isSafeInteger(image?.pack)||!pack||!Number.isSafeInteger(image.byteOffset)||image.byteOffset<0||!Number.isSafeInteger(image.byteLength)||image.byteLength<=0||image.byteOffset>pack.byteLength||image.byteLength>pack.byteLength-image.byteOffset||image.mimeType!=='image/webp')throw new Error('Invalid packed map texture range');}
  }
  async function load(url,loader){
    if(!packed)return loader.loadAsync(new URL(url,base).href);
    const image=Object.hasOwn(packed.images,url)?packed.images[url]:null;if(!image)throw new Error('The map texture is missing from its pack.');
    let promise=cache.get(image.pack);if(!promise){const pack=packed.packs[image.pack];promise=(async()=>{const response=await fetch(new URL(pack.url,base));if(!response.ok)throw new Error(`Texture pack request failed (${response.status})`);const blob=await response.blob();if(blob.size!==pack.byteLength)throw new Error('The map texture pack has an incorrect byte length.');return blob;})();cache.set(image.pack,promise);}
    const blob=await promise,objectUrl=URL.createObjectURL(blob.slice(image.byteOffset,image.byteOffset+image.byteLength,image.mimeType));
    try{return await loader.loadAsync(objectUrl);}finally{URL.revokeObjectURL(objectUrl);}
  }
  return {load,clear(){cache.clear();}};
}
async function binaryFetch(url,compression,onProgress,expectedLength) {
  if(!Number.isSafeInteger(expectedLength)||expectedLength<=0)throw new Error('Invalid map geometry byte length');
  const response=url?.body?url:await fetch(url);if(!response.ok)throw new Error(`Geometry request failed (${response.status})`);
  // Fetch may already decode Content-Encoding. Inspect the received bytes so a
  // static .gz and an HTTP-decoded response both work without double decoding.
  const encoded=response.headers.get('content-encoding');
  const total=encoded&&encoded!=='identity'?0:Number(response.headers.get('content-length'))||0;
  let downloaded=0;
  const body=response.body||new ReadableStream({async start(controller){try{controller.enqueue(new Uint8Array(await response.arrayBuffer()));controller.close();}catch(error){controller.error(error);}}});
  const sourceReader=body.getReader();
  async function readSource(){const item=await sourceReader.read();if(!item.done){downloaded+=item.value.byteLength;onProgress({kind:'geometry',bytes:downloaded,percent:total?Math.min(45,downloaded/total*45):undefined});}return item;}
  try{
    const prefix=[],magic=[];
    while(magic.length<2){const {done,value}=await readSource();if(done)break;prefix.push(value);for(let i=0;i<value.length&&magic.length<2;i++)magic.push(value[i]);}
    const packed=new ReadableStream({
      async pull(controller){if(prefix.length){controller.enqueue(prefix.shift());return;}try{const {done,value}=await readSource();if(done)controller.close();else controller.enqueue(value);}catch(error){controller.error(error);}},
      cancel(reason){return sourceReader.cancel(reason);}
    });
    let decoded=packed;
    if(compression==='gzip'&&magic[0]===0x1f&&magic[1]===0x8b){if(typeof DecompressionStream==='undefined')throw new Error('This browser does not support compressed 3D maps. Please update your browser.');decoded=packed.pipeThrough(new DecompressionStream('gzip'));}
    // One final geometry allocation: compressed chunks are released as they are
    // decoded, rather than retaining and copying the full compressed download.
    const bytes=new Uint8Array(expectedLength),reader=decoded.getReader();let offset=0;
    try{
      for(;;){const {done,value}=await reader.read();if(done)break;if(value.byteLength>expectedLength-offset)throw new Error('The map geometry exceeds its declared byte length.');bytes.set(value,offset);offset+=value.byteLength;}
    }catch(error){await reader.cancel(error).catch(()=>{});throw error;}finally{reader.releaseLock();}
    if(offset!==expectedLength)throw new Error('The map geometry download is incomplete.');
    onProgress({kind:'geometry',bytes:downloaded,percent:45},true);return bytes.buffer;
  }catch(error){await sourceReader.cancel(error).catch(()=>{});throw error;}finally{sourceReader.releaseLock();}
}
function attribute(buffer,accessor) {
  if(!accessor||!Number.isSafeInteger(accessor.byteOffset)||!Number.isSafeInteger(accessor.count)||!Number.isSafeInteger(accessor.itemSize)||accessor.byteOffset<0||accessor.count<0||accessor.itemSize<=0||(accessor.normalized!==undefined&&typeof accessor.normalized!=='boolean'))throw new Error('Invalid map geometry accessor');
  const ArrayType=({uint32:Uint32Array,uint16:Uint16Array,int16:Int16Array,float32:Float32Array})[accessor.componentType];if(!ArrayType)throw new Error(`Unsupported component type: ${accessor.componentType}`);
  const length=accessor.count*accessor.itemSize,byteLength=length*ArrayType.BYTES_PER_ELEMENT;
  if(!Number.isSafeInteger(length)||!Number.isSafeInteger(byteLength)||accessor.byteOffset%ArrayType.BYTES_PER_ELEMENT!==0||accessor.byteOffset>buffer.byteLength||byteLength>buffer.byteLength-accessor.byteOffset)throw new Error('Map geometry accessor exceeds binary length or is misaligned');
  return new THREE.BufferAttribute(new ArrayType(buffer,accessor.byteOffset,length),accessor.itemSize,accessor.normalized===true);
}
function materialBase(row) {
  const result=new THREE.MeshStandardMaterial({name:row.name||'',color:new THREE.Color().fromArray(row.color||[1,1,1]),roughness:row.roughness??1,metalness:row.metalness??0,emissive:new THREE.Color().fromArray(row.emissive||[0,0,0]),emissiveIntensity:row.emissiveIntensity??1,opacity:row.opacity??1,transparent:Boolean(row.transparent),alphaTest:row.alphaTest||0,side:row.doubleSided?THREE.DoubleSide:THREE.FrontSide});
  if(row.normalScale)result.normalScale.fromArray(row.normalScale);if(row.depthWrite!==undefined)result.depthWrite=Boolean(row.depthWrite);if(row.polygonOffset){result.polygonOffset=true;result.polygonOffsetFactor=row.polygonOffsetFactor??-1;result.polygonOffsetUnits=row.polygonOffsetUnits??-1;}return result;
}

/** Load only the exported, versioned local map format; no executable scene data. */
export async function loadMapScene(url,{renderer,onProgress=()=>{},onRender=()=>{},onGeometry=()=>{}}={}) {
  const reportProgress=progressReporter(onProgress);
  const response=await fetch(url);if(!response.ok)throw new Error(`Map manifest request failed (${response.status})`);const manifest=await response.json();
  if(manifest.format!=='duke-map3d-v1'||!Array.isArray(manifest.meshes)||!manifest.materials?.length)throw new Error('The map export is incomplete or has an unsupported format.');
  const base=new URL('.',new URL(url,location.href));const buffer=await binaryFetch(manifest.binary.parts?geometryParts(manifest.binary.parts,base):new URL(manifest.binary.url,base),manifest.binary.compression,reportProgress,manifest.binary.byteLength);
  if(manifest.binary.byteLength&&buffer.byteLength!==manifest.binary.byteLength)throw new Error('The map geometry download is incomplete.');
  const geometries=manifest.meshes.map(row=>{const geometry=new THREE.BufferGeometry();geometry.name=row.name;for(const [name,accessor]of Object.entries(row.attributes))geometry.setAttribute(name,attribute(buffer,accessor));geometry.setIndex(attribute(buffer,row.index));for(const group of row.groups||[])geometry.addGroup(group.start,group.count,group.materialIndex);if(row.bounds)geometry.boundingBox=new THREE.Box3(new THREE.Vector3(...row.bounds.min),new THREE.Vector3(...row.bounds.max));geometry.computeBoundingSphere();return geometry;});
  const materials=manifest.materials.map(materialBase),group=new THREE.Group();group.name=manifest.name||manifest.mapId||'Operation Bagel map';
  for(let i=0;i<manifest.instances.length;i++){
    const row=manifest.instances[i],geometry=geometries[row.mesh],assigned=row.materials.map(index=>materials[index]);if(!geometry||assigned.some(mat=>!mat))throw new Error('Map mesh refers to a missing material.');
    const matrices=attribute(buffer,row.matrices);if(matrices.itemSize!==16||matrices.count!==row.count)throw new Error('Map instance matrices do not match instance count.');
    const castsShadow=!row.materials.every(index=>manifest.materials[index].sourceShader==='miHoYo/Scene/Decal');
    if(assigned.some(material=>material.transparent)){
      // Three sorts transparent objects, not instances within an InstancedMesh.
      // Keep every original matrix, including zero-scale source objects, so
      // overlapping fractional-alpha rock surfaces and decals sort individually.
      for(let instance=0;instance<row.count;instance++){const mesh=new THREE.Mesh(geometry,assigned);mesh.name=`${geometry.name}:${i}:${instance}`;mesh.matrixAutoUpdate=false;mesh.matrix.fromArray(matrices.array,instance*16);mesh.matrixWorldNeedsUpdate=true;mesh.castShadow=castsShadow;mesh.receiveShadow=true;group.add(mesh);}
    }else{
      const mesh=new THREE.InstancedMesh(geometry,assigned,row.count);mesh.name=`${geometry.name}:${i}`;mesh.instanceMatrix.array.set(matrices.array);mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=castsShadow;mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh);
    }
  }
  onGeometry(group,manifest);await nextFrame();
  const textureJobs=new Map(),textureCache=new Map(),failedTextures=[],textureSource=texturePackSource(manifest.texturePacks,base);
  for(let materialIndex=0;materialIndex<manifest.materials.length;materialIndex++)for(const slot of textureSlots){const spec=manifest.materials[materialIndex][slot];if(!spec?.url)continue;const key=JSON.stringify(spec);if(!textureJobs.has(key))textureJobs.set(key,{spec,targets:[]});textureJobs.get(key).targets.push([materials[materialIndex],slot]);}
  const jobs=[...textureJobs.values()];let cursor=0,done=0,lastRender=0;const loader=new THREE.TextureLoader();const maxAnisotropy=Math.min(4,renderer?.capabilities.getMaxAnisotropy()||1);
  // Cache identical files and transforms across material slots; roughness and
  // metallic channels normally share a single GPU texture.
  async function worker(){while(cursor<jobs.length){const {spec,targets}=jobs[cursor++];try{
    const sourceKey=JSON.stringify([spec.url,spec.colorSpace,spec.flipY,spec.repeat,spec.offset,spec.wrap]);let promise=textureCache.get(sourceKey);if(!promise){promise=textureSource.load(spec.url,loader);textureCache.set(sourceKey,promise);}const texture=await promise;
    texture.colorSpace=spec.colorSpace==='srgb'?THREE.SRGBColorSpace:THREE.NoColorSpace;texture.flipY=spec.flipY!==false;texture.wrapS=wrapping[spec.wrap?.[0]]??THREE.RepeatWrapping;texture.wrapT=wrapping[spec.wrap?.[1]]??THREE.RepeatWrapping;texture.repeat.fromArray(spec.repeat||[1,1]);texture.offset.fromArray(spec.offset||[0,0]);texture.anisotropy=maxAnisotropy;texture.needsUpdate=true;
    for(const [material,slot]of targets){material[slot]=texture;material.needsUpdate=true;}
  }catch(error){failedTextures.push(spec.url);console.warn('[map-3d] texture unavailable',spec.url,error?.message||'');}
  done++;reportProgress({kind:'textures',done,total:jobs.length,percent:45+done/jobs.length*50},done===jobs.length);if(performance.now()-lastRender>400){lastRender=performance.now();onRender();await nextFrame();}
  }}
  reportProgress({kind:'textures',done:0,total:jobs.length,percent:45},true);
  // Leave an HTTP/1.1 connection free for navigation while textures stream in.
  try{await Promise.all(Array.from({length:5},worker));}finally{textureSource.clear();}reportProgress({kind:'loadingComplete',percent:98},true);
  // Allow the UI to present the final preparation phase before GPU compilation.
  await nextFrame();onRender();
  return {group,manifest,failedTextures,stats:{meshes:group.children.length,geometries:geometries.length,materials:materials.length,textures:textureCache.size}};
}

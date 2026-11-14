// Store native 2D point notes under stable world-coordinate point keys.
const storageKey='bagel-atlas-local-v1';
function attach(point,map){
  const personal=window.atlas?.personal,detail=document.getElementById('detail');
  if(!personal||!detail||point?.id==null)return;
  document.getElementById('world-point-record')?.remove();
  const key=`world:${map}:${point.id}`;
  personal.notes||={};personal.observations||={};
  const record=personal.observations[key]||{present:0,absent:0};
  const section=document.createElement('section');section.id='world-point-record';
  section.innerHTML='<h3>个人备注</h3><textarea aria-label="此世界点位的个人备注" placeholder="记录路线、门禁与本局情况…"></textarea><button class="text-btn" data-save>保存备注</button><h3>本局观察</h3><div class="observation-buttons"><button data-present>见到 ＋1</button><button data-absent>未见 ＋1</button><button data-undo disabled>撤销</button></div><p class="small muted" aria-live="polite"></p>';
  const note=section.querySelector('textarea'),status=section.querySelector('p');
  note.value=personal.notes[key]||'';
  let previous=null;
  const render=()=>{status.textContent=`见到 ${record.present} 次 · 未见 ${record.absent} 次。个人记录不会自动判定必刷。`;};
  const save=()=>{try{localStorage.setItem(storageKey,JSON.stringify(personal));return true;}catch{status.textContent='本机存储不可用，请用右上角导出数据保存。';return false;}};
  section.querySelector('[data-save]').onclick=()=>{personal.notes[key]=note.value;if(save())status.textContent='此世界点位的备注已保存。';};
  for(const field of ['present','absent'])section.querySelector(`[data-${field}]`).onclick=()=>{previous={value:{...record},existed:Object.hasOwn(personal.observations,key)};record[field]++;personal.observations[key]=record;render();save();section.querySelector('[data-undo]').disabled=false;};
  section.querySelector('[data-undo]').onclick=()=>{if(!previous)return;Object.assign(record,previous.value);if(previous.existed)personal.observations[key]=record;else delete personal.observations[key];previous=null;render();save();section.querySelector('[data-undo]').disabled=true;};
  render();detail.append(section);
  // Merging exit locations must not hide or merge observations from old entities.
  const legacy=(point.variants||[]).map(v=>({id:v.id,key:`world:${map}:${v.id}`})).filter(v=>v.key!==key&&(personal.notes[v.key]||personal.observations[v.key]?.present||personal.observations[v.key]?.absent));
  if(legacy.length){
    const previousRecords=document.createElement('details'),summary=document.createElement('summary');
    summary.textContent=`合并前的个人记录（${legacy.length} 条）`;previousRecords.append(summary);
    for(const v of legacy){
      const label=document.createElement('p'),text=document.createElement('textarea'),button=document.createElement('button');
      const observation=personal.observations[v.key];
      label.className='small muted';label.textContent=`原点位 ${v.id}${observation?` · 见到 ${observation.present} 次 / 未见 ${observation.absent} 次`:''}`;
      text.value=personal.notes[v.key]||'';text.setAttribute('aria-label',`原点位 ${v.id} 的个人备注`);button.className='text-btn';button.textContent='保存原点位备注';
      button.onclick=()=>{personal.notes[v.key]=text.value;if(save())status.textContent='原点位备注已保存，观察次数保持独立。'};
      previousRecords.append(label,text,button);
    }
    section.append(previousRecords);
  }
}
window.worldPointNotes={attach};
window.addEventListener('nativemapselect',event=>attach(event.detail?.point,event.detail?.map));

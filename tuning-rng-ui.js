import {inspectRngBackup} from './tuning-rng.js?v=20260911-community-update-1';
import {parseImport,mergeAccounts,POOL_META} from './tuning-core.js?v=20260914-duke-brand-1';
const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
const labelZone=z=>`UTC${z>=0?'+':''}${z}${z===8?'（国服 / 亚服）':z===-5?'（美服）':z===1?'（欧服）':''}`;
export function mountRngMigration({chooseFile}){
  const help=document.createElement('dialog');help.id='rng-help-dialog';help.className='tuning-dialog rng-dialog';
  help.setAttribute('aria-labelledby','rng-help-title');
  help.innerHTML='<div class="dialog-heading"><h2 id="rng-help-title">从 rng.moe 迁入</h2><button type="button" class="icon-button" aria-label="关闭迁入说明">×</button></div><ol class="rng-migration-steps"><li>打开 <a href="https://zzz.rng.moe/zh/settings" target="_blank" rel="noreferrer">rng.moe 设置页面 ↗</a>，在「备份」中点击「导出」。</li><li>选择下载的 <code>zzz-rngmoe-backup_….json</code> 文件。</li><li>核对游戏 UID、时区和各频段条数，再确认合并。</li></ol><p>可以直接选择整站备份，本站只提取调频明细。记录在本浏览器处理；原文件保持不变。</p><p class="rng-migration-note">手动添加、精度已丢失或频道不明的记录会停止整次迁入并说明原因。请保留原始备份。</p><div class="dialog-actions"><button type="button" class="primary-button" id="rng-select-file">选择 rng.moe 备份</button></div>';
  document.body.append(help);help.querySelector('.icon-button').onclick=()=>help.close();
  help.querySelector('#rng-select-file').onclick=()=>{help.close();chooseFile();};
  const button=document.createElement('button');button.id='rng-import-open';button.type='button';button.className='secondary-button';button.textContent='从 rng.moe 迁入';button.disabled=true;
  document.getElementById('demo-open').before(button);button.onclick=()=>help.showModal();
}
export function reviewRngMigration(text,fileName,snapshot,catalog){
  const data=JSON.parse(text.replace(/^\uFEFF/,'')),inspection=inspectRngBackup(data);
  const dialog=document.createElement('dialog');dialog.id='rng-preview-dialog';dialog.className='tuning-dialog rng-dialog';dialog.setAttribute('aria-labelledby','rng-preview-title');
  const heading=node('div',undefined,'dialog-heading'),title=node('h2','核对迁入的调频记录');title.id='rng-preview-title';heading.append(title);
  const close=node('button','×','icon-button');close.type='button';close.setAttribute('aria-label','取消迁入');heading.append(close);dialog.append(heading);
  dialog.append(node('p',`发现 ${inspection.profiles.length} 个有调频记录的简档，共 ${inspection.total.toLocaleString('zh-CN')} 条原始记录${inspection.emptyProfiles?`；另 ${inspection.emptyProfiles} 个空简档`:''}。同 UID 简档会合并去重。`));
  dialog.append(node('p','请核对 UID 和时区。备份保存的是绝对时间；此处按所选时区还原记录时间。同账号已有记录若使用另一明确时区，合并时会统一换算。','rng-migration-note'));
  const fields=[];
  for(const profile of inspection.profiles){
    const section=node('section',undefined,'rng-profile'),h=node('h3',profile.name);section.append(h);
    const controls=node('div',undefined,'rng-profile-fields'),uidLabel=node('label','游戏 UID'),uid=document.createElement('input');
    uid.value=profile.uid;uid.readOnly=!!profile.uid;uid.inputMode='numeric';uid.maxLength=10;uid.placeholder='此简档未绑定，请填所属游戏 UID';uid.dataset.rngUid=profile.key;uidLabel.append(uid);
    const tzLabel=node('label','记录时区'),timezone=document.createElement('select');timezone.dataset.rngTimezone=profile.key;
    const empty=node('option','请选择时区');empty.value='';timezone.append(empty);
    for(let z=-12;z<=14;z++){const option=node('option',labelZone(z));option.value=String(z);timezone.append(option);}
    timezone.value=profile.timezone===null?'':String(profile.timezone);tzLabel.append(timezone);controls.append(uidLabel,tzLabel);section.append(controls);
    if(profile.timezone!==null)section.append(node('p','时区初值根据 UID 推断，请与原账号服务器核对。','rng-migration-note'));
    section.append(node('p',Object.entries(profile.counts).map(([pool,count])=>`${POOL_META[pool].label} ${count.toLocaleString('zh-CN')} 条`).join(' · '),'rng-pool-counts'));
    let earliest=Infinity,latest=-Infinity;for(const record of profile.records){earliest=Math.min(earliest,record.timestamp);latest=Math.max(latest,record.timestamp);}
    const range=node('p',undefined,'rng-migration-note');section.append(range);
    dialog.append(section);fields.push({profile,uid,timezone,range,earliest,latest});
  }
  const result=node('div',undefined,'rng-merge-preview');result.id='rng-merge-preview';result.setAttribute('aria-live','polite');dialog.append(result);
  const warnings=node('p',undefined,'rng-migration-note');warnings.id='rng-preview-warnings';dialog.append(warnings);
  const actions=node('div',undefined,'dialog-actions'),cancel=node('button','取消','secondary-button'),confirm=node('button','确认合并调频记录','primary-button');cancel.id='rng-preview-cancel';confirm.id='rng-preview-confirm';cancel.type=confirm.type='button';actions.append(cancel,confirm);dialog.append(actions);
  let incoming=null;
  function update(){
    incoming=null;confirm.disabled=true;result.replaceChildren();warnings.textContent='';
    const rngProfiles=Object.create(null);
    for(const {profile,uid,timezone,range,earliest,latest} of fields){
      const z=timezone.value===''?null:Number(timezone.value);rngProfiles[profile.key]={uid:uid.value.trim(),timezone:z};
      const format=value=>new Date(value+(z??0)*3600000).toISOString().slice(0,19).replace('T',' ');
      range.textContent=`记录时间：${format(earliest)} ～ ${format(latest)}${z===null?'（UTC，待选择时区）':''}`;
    }
    try{
      const parsed=parseImport(text,fileName,{rngProfiles,catalog}),merged=mergeAccounts(snapshot.accounts,parsed.accounts);
      for(const account of parsed.accounts){
        const current=snapshot.accounts.filter(a=>a.uid===account.uid),change=mergeAccounts(current,[account]);
        result.append(node('p',`UID ${account.uid}：${account.records.length.toLocaleString('zh-CN')} 条去重记录 · 新增 ${change.added.toLocaleString('zh-CN')} · 与本站重复 ${change.duplicates.toLocaleString('zh-CN')}`));
      }
      const total=node('strong',`确认后新增 ${merged.added.toLocaleString('zh-CN')} 条，合并已有重复 ${merged.duplicates.toLocaleString('zh-CN')} 条。`);result.append(total);
      warnings.textContent=[...new Set([...parsed.warnings,...merged.warnings])].join(' ');
      incoming=parsed;confirm.disabled=false;result.dataset.kind='success';
    }catch(error){result.textContent=error.message;result.dataset.kind='error';}
  }
  for(const field of fields){field.uid.addEventListener('input',()=>{incoming=null;confirm.disabled=true;});field.uid.addEventListener('change',update);field.timezone.addEventListener('change',update);}
  document.body.append(dialog);update();dialog.showModal();
  return new Promise(resolve=>{
    const done=value=>{dialog.close();dialog.remove();resolve(value);};
    close.onclick=cancel.onclick=()=>done(null);
    dialog.addEventListener('cancel',event=>{event.preventDefault();done(null);});
    confirm.onclick=()=>{update();if(incoming)done(incoming);};
  });
}

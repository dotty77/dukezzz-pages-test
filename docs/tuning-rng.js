// Read only the signal-history store in a rng.moe backup. Never import its other stores.
const CHANNELS=Object.freeze({'1001':'1','2001':'2','3001':'3','5001':'5','12001':'102','13001':'103'});
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const fail=message=>{throw new Error(message);};
const decimal=(value,label)=>{
  if(typeof value!=='string'&&!(typeof value==='number'&&Number.isSafeInteger(value)))fail(`${label}格式无效`);
  const result=String(value);
  if(!/^[1-9]\d{0,19}$/.test(result))fail(`${label}必须是完整的十进制编号`);
  return result;
};
export function isRngBackup(data){return object(data)&&own(data,'game')&&object(data.data)&&own(data.data,'profiles');}
export function rngTimezone(uid){
  if(/^\d{8,9}$/.test(uid))return 8;
  if(/^10\d{8}$/.test(uid))return -5;
  if(/^(13|17)\d{8}$/.test(uid))return 8;
  if(/^15\d{8}$/.test(uid))return 1;
  return null;
}
export function inspectRngBackup(data){
  if(!isRngBackup(data)||data.game!=='zzz')fail('请选择绝区零 rng.moe 备份，其他游戏备份不能迁入。');
  if(data.version!==1||!object(data.data)||!object(data.data.profiles))fail('暂不支持此 rng.moe 备份版本或简档结构。');
  const profiles=[];let total=0,emptyProfiles=0;
  for(const [key,profile] of Object.entries(data.data.profiles)){
    if(!object(profile)||!object(profile.stores)||!object(profile.stores['0'])||!object(profile.stores['0'].items))fail('rng.moe 简档缺少调频记录结构，已停止迁入。');
    const counts={},records=[];let missingManualFlag=0;
    for(const [channel,rows] of Object.entries(profile.stores['0'].items)){
      if(!own(CHANNELS,channel))fail(`rng.moe 频道 ${channel.slice(0,40)} 尚未确认，不能自动归入其他卡池。`);
      if(!Array.isArray(rows))fail('rng.moe 调频记录列表格式不正确。');
      const pool=CHANNELS[channel];counts[pool]=(counts[pool]||0)+rows.length;
      for(const row of rows){
        if(++total>100000)fail('单次迁入最多 100000 条调频记录。');
        if(!object(row))fail('rng.moe 包含无效的逐抽记录。');
        if(row.manual===true)fail('备份包含手动添加的调频记录，无法与官方记录可靠去重。请保留原备份；本次未导入任何记录。');
        if(row.manual!==undefined&&row.manual!==false)fail('rng.moe 手动记录标志格式不正确。');
        if(row.manual===undefined)missingManualFlag++;
        if(typeof row.uid!=='string'||!/^\d{1,19}$/.test(row.uid))fail('rng.moe 抽卡记录 ID 必须是 1–19 位数字字符串；数字类型可能已丢失精度，不能自动修复。');
        if(String(row.gachaType)!==channel)fail('rng.moe 记录频段与所属列表不一致，已停止迁入。');
        if(![2,3,4].includes(row.rarity))fail('rng.moe 记录品质不明确，不能据此计算抽数与保底。');
        if(!Number.isSafeInteger(row.timestamp)||row.timestamp<Date.UTC(2000,0,1)||row.timestamp>=Date.UTC(2201,0,1))fail('rng.moe 调频时间必须是有效的毫秒时间戳。');
        records.push({id:row.uid,itemId:decimal(row.id,'rng.moe 物品 ID'),pool,rank:({2:'B',3:'A',4:'S'})[row.rarity],timestamp:row.timestamp});
      }
    }
    if(!records.length){emptyProfiles++;continue;}
    const uid=profile.bindUid==null||profile.bindUid===''?'':decimal(profile.bindUid,'rng.moe 绑定账号 UID');
    const name=typeof profile.name==='string'?profile.name.slice(0,80):`简档 ${profiles.length+1}`;
    profiles.push({key,name,uid,timezone:rngTimezone(uid),counts,records,missingManualFlag});
  }
  if(!profiles.length)fail('这份 rng.moe 备份没有调频明细；背包和成就不会作为调频记录迁入。');
  return {profiles,total,emptyProfiles};
}
export function convertRngBackup(data,{rngProfiles={},catalog={}}={}){
  const inspection=inspectRngBackup(data),warnings=new Set(['已仅读取 rng.moe 调频明细；其背包、成就、设置及原站保底统计未导入。']);
  if(inspection.emptyProfiles)warnings.add(`另有 ${inspection.emptyProfiles} 个空简档，没有调频明细。`);
  const accounts=inspection.profiles.map(profile=>{
    const supplied=own(rngProfiles,profile.key)?rngProfiles[profile.key]:{};
    if(!object(supplied))fail('迁入账号设置格式不正确。');
    if(profile.uid&&supplied.uid!==undefined&&String(supplied.uid)!==profile.uid)fail('不能更改备份中已绑定的账号 UID。');
    const uid=profile.uid||(supplied.uid?decimal(supplied.uid,'账号 UID'):'');
    if(!uid)fail(`简档「${profile.name}」未绑定游戏 UID，请先在迁入预览中补充账号。`);
    if(!/^\d{6,10}$/.test(uid))fail('游戏 UID 需要 6–10 位数字，请核对后再迁入。');
    const timezone=own(supplied,'timezone')?supplied.timezone:rngTimezone(uid);
    if(!Number.isInteger(timezone)||timezone < -12||timezone > 14)fail(`简档「${profile.name}」的记录时区无法确认，请先选择服务器时区。`);
    if(!own(supplied,'timezone'))warnings.add(`账号 ${uid} 的时区按 UID 推断为 UTC${timezone>=0?'+':''}${timezone}，请在预览中核对。`);
    if(profile.missingManualFlag)warnings.add(`简档「${profile.name}」有 ${profile.missingManualFlag} 条旧记录未声明手动标志；仅按其原始字符串 ID 合并。`);
    return {uid,timezone,lang:'zh-cn',records:profile.records.map(record=>{
      const item=own(catalog,record.itemId)?catalog[record.itemId]:null;
      const time=new Date(record.timestamp+timezone*3600000).toISOString().slice(0,19).replace('T',' ');
      return {id:record.id,uid,pool:record.pool,itemId:record.itemId,rank:record.rank,time,
        name:item?.name||'',itemType:({agent:'代理人',engine:'音擎',bangboo:'邦布'})[item?.type]||'',gachaId:''};
    })};
  });
  return {accounts,warnings:[...warnings],inspection};
}

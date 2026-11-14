// Display restrictions from the 2026-09-10 source-coordinate audit.
// Keep original data/IDs for research and personal notes; never guess a new entrance.
// Recheck the source chain if the configured position changes in a future version.
const unlocated={
 janus:{
  '171300405:203':{position:[-260.03925,45.161167,95.08638],reason:'与 171300406:203 使用完全相同的参考坐标，未能对应雅努斯的导航轮廓。现有配置未提供足够依据定位实际入口。'},
  '171300406:203':{position:[-260.03925,45.161167,95.08638],reason:'与 171300405:203 使用完全相同的参考坐标，未能对应雅努斯的导航轮廓。现有配置未提供足够依据定位实际入口。'},
  '171300413:202':{position:[0,-0.020122528,0],reason:'配置位置接近原点；高危规则引用的 Suite 1 未在已提取的成员表中解析。尚无可确认的实际入口位置。'}
 }
};
export function pointPositionIssue(map,point){
 const issue=unlocated[map]?.[point?.id],p=point?.worldPosition;
 if(!issue||point.type!=='portal'||!p||!['x','y','z'].every((key,i)=>Math.abs(p[key]-issue.position[i])<1e-6))return null;
 return {code:'unverified_reference_position',reason:issue.reason,auditedAt:'2026-09-10',scope:'仅限制地图标点与路线端点；不表示该传送装置在游戏中不存在。'};
}

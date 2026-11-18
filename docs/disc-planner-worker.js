import {allocateTargets,compareMainOptions,rankFarmSlots} from './disc-planner-core.js?v=20261117-disc-farming-launch-1';

self.onmessage=({data:request})=>{
  try{
    const args=[request.config,request.data,request.rows,request.build,request.options];
    if(request.operation==='farming'){
      self.postMessage({result:rankFarmSlots(...args,request.allocation)});
      return;
    }
    if(request.operation==='compare'){
      self.postMessage({result:compareMainOptions(...args)});
      return;
    }
    const result=allocateTargets(...args);
    if(result.configuration)result.farming=rankFarmSlots(...args,result);
    self.postMessage({result});
  }catch(error){
    self.postMessage({error:error.message||'计算未能完成，请检查输入后重试。'});
  }
};

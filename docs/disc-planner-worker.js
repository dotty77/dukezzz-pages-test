import {allocateTargets,compareMainOptions} from './disc-planner-core.js?v=20261115-rotation-launch-1';

self.onmessage=({data:request})=>{
  try{
    const solve=request.operation==='compare'?compareMainOptions:allocateTargets;
    const result=solve(request.config,request.data,request.rows,request.build,request.options);
    self.postMessage({result});
  }catch(error){
    self.postMessage({error:error.message||'计算未能完成，请检查输入后重试。'});
  }
};

const canceled = () => new DOMException('已取消','AbortError');

// One FIFO start gate for every pool and retry in this import.
export function createRequestScheduler({signal,concurrency=1,delay=350}) {
  let limit=concurrency,active=0,lastStart=null,coolUntil=0,draining=false;
  const queue=[],listeners=new Set();
  function wake(){for(const resolve of [...listeners])resolve();}
  function changed(ms){
    return new Promise(resolve=>{
      let timer;
      const done=()=>{clearTimeout(timer);listeners.delete(done);resolve();};
      listeners.add(done);if(ms!=null)timer=setTimeout(done,Math.max(1,ms));
      if(signal.aborted)done();
    });
  }
  function stop(){for(const item of queue.splice(0))item.reject(canceled());wake();}
  signal.addEventListener('abort',stop,{once:true});
  async function drain(){
    if(draining)return;draining=true;
    try{
      while(queue.length){
        if(signal.aborted){stop();break;}
        if(active>=limit){await changed();continue;}
        const due=Math.max(lastStart===null?0:lastStart+delay,coolUntil);
        const remaining=due-performance.now();
        if(remaining>0){await changed(remaining);continue;}
        const item=queue.shift();active++;lastStart=performance.now();let released=false;
        item.resolve(()=>{if(released)return;released=true;active--;wake();});
      }
    }finally{draining=false;}
  }
  return {
    get concurrency(){return limit;},
    coolDown(ms){limit=1;coolUntil=Math.max(coolUntil,performance.now()+ms);wake();},
    async run(task){
      if(signal.aborted)throw canceled();
      const release=await new Promise((resolve,reject)=>{queue.push({resolve,reject});void drain();});
      try{
        if(signal.aborted)throw canceled();lastStart=performance.now();
        // A synchronous progress callback can delay fetch after the lease starts.
        // Anchor the next slot to the actual transport start as well.
        return await task(()=>{lastStart=performance.now();wake();});
      }finally{release();}
    },
    dispose(){signal.removeEventListener('abort',stop);stop();}
  };
}

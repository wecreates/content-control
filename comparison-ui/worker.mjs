export function createHashWorker(){
 // The offline builder embeds this source; the hosted app keeps its module worker.
 if(typeof __HASH_WORKER_SOURCE__!=='undefined'){
  const url=URL.createObjectURL(new Blob([__HASH_WORKER_SOURCE__],{type:'text/javascript'}));
  const worker=new Worker(url);URL.revokeObjectURL(url);return worker;
 }
 return new Worker(new URL('./hash-worker.mjs',import.meta.url),{type:'module'});
}

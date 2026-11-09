// One cancellable mix/mux child. Dependency injection permits host/offline checks.
export async function runAudioProcess(args,{signal,stage,onProcessStarted},runtime){
 if(signal?.aborted)throw Error('cancelled');
 const task=runtime.ffmpeg(args,{timeoutMs:30000});
 const abort=()=>runtime.kill(task.proc);
 signal?.addEventListener('abort',abort,{once:true});
 try{
  // Catch cancellation occurring synchronously inside process creation.
  if(signal?.aborted)abort();
  try{onProcessStarted?.({stage,proc:task.proc});}
  catch(error){abort();await task.done.catch(()=>{});throw error;}
  await task.done;
  if(signal?.aborted)throw Error('cancelled');
 }catch(error){if(signal?.aborted)throw Error('cancelled');throw error;}
 finally{signal?.removeEventListener('abort',abort);}
}

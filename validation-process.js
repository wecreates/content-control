import {spawn} from 'node:child_process';

// Validation is observational; failure must never take down hosted playback.
export function createValidationProcess({spawnImpl=spawn, env=process.env, timeoutMs=60000}={}) {
  const state={status:'booting',logs:[]};
  let running=false;
  function log(value){state.logs.push(String(value).slice(-4096));state.logs.splice(0,Math.max(0,state.logs.length-40));}
  function run(){
    if(running)return false;
    running=true;state.status='v2-validation-running';
    let child,timer,failed=false;
    const fail=()=>{failed=true;state.status='v2-validation-error';};
    try {
      child=spawnImpl('python',['scripts/v2_runtime_tick.py'],{env:{...env,PUBLICATION_ENABLED:'false'}});
      child.stdout?.on('data',log);child.stderr?.on('data',log);
      child.once('error',()=>{fail();log('Validation process could not start.');clearTimeout(timer);running=false;});
      child.once('close',code=>{clearTimeout(timer);if(!failed)state.status=code===0?'v2-validation-complete':'v2-validation-error';running=false;});
      timer=setTimeout(()=>{fail();log('Validation process exceeded its time limit.');child.kill('SIGKILL');},timeoutMs);
      timer.unref();
    } catch {fail();log('Validation process could not start.');running=false;}
    return true;
  }
  return {state,run,get running(){return running;}};
}

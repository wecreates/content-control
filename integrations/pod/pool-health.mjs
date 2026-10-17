// pg removes an errored idle client itself. Handle the pool event so it does not
// become an uncaught exception, retaining only a bounded, non-secret diagnostic.
const monitors=new WeakMap();
export function monitorPodPool(pool){
 if(monitors.has(pool))return monitors.get(pool);
 let failures=0,lastFailureAt=null;
 const health=()=>({idle_connection_failures:failures,last_idle_connection_failure_at:lastFailureAt,
  last_error_code:failures?'POD_DATABASE_IDLE_CONNECTION_FAILED':null});
 pool.on('error',()=>{
  failures=Math.min(Number.MAX_SAFE_INTEGER,failures+1);
  lastFailureAt=new Date().toISOString();
 });
 monitors.set(pool,health);
 return health;
}

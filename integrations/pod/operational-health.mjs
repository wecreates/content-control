import {artifactBudgetBytes} from './storage-budget.mjs';
import {validDateMs} from './storage-expiry.mjs';

// Observations only. This function cannot renew expiry or authorize execution.
export function operationalHealth({expiresAt,artifactBytes,expiredLeases,pendingEvents,oldestEventSeconds,now=Date.now(),env=process.env}){
 if(!validDateMs(now))throw Error('OPERATIONAL_CLOCK_INVALID');
 const count=value=>{if(typeof value!=='string'||!/^\d+$/.test(value))throw Error('OPERATIONAL_METRIC_INVALID');return BigInt(value);};
 const used=count(artifactBytes),leases=count(expiredLeases),pending=count(pendingEvents),age=count(oldestEventSeconds);
 const alerts=[];let budget=null;
 try{budget=artifactBudgetBytes(env);}catch{alerts.push({code:'ARTIFACT_BUDGET_UNKNOWN',severity:'critical'});}
 const finite=validDateMs(expiresAt);
 const seconds=finite?Math.max(0,Math.floor((expiresAt-now)/1000)):null;
 let lifetime='OK';
 if(!finite){lifetime='UNKNOWN';alerts.push({code:'STORAGE_EXPIRY_UNKNOWN',severity:'critical'});}
 else if(expiresAt<=now){lifetime='EXPIRED';alerts.push({code:'STORAGE_EXPIRED',severity:'critical'});}
 else if(expiresAt-now<=86400000){lifetime='BLOCKED';alerts.push({code:'STORAGE_EXPIRING',severity:'critical'});}
 else if(expiresAt-now<=7*86400000){lifetime='WARNING';alerts.push({code:'STORAGE_EXPIRING_SOON',severity:'warning'});}
 if(budget!==null){
  if(used>=BigInt(budget))alerts.push({code:'ARTIFACT_STORAGE_EXHAUSTED',severity:'critical'});
  else if(used*10n>=BigInt(budget)*9n)alerts.push({code:'ARTIFACT_STORAGE_LOW',severity:'warning'});
 }
 if(leases>0n)alerts.push({code:'EXPIRED_WORKER_LEASES',severity:'critical'});
 if(pending>0n&&age>=900n)alerts.push({code:'OUTBOX_DELIVERY_OVERDUE',severity:'warning'});
 return {scope:'operational_snapshot_only',observed_at:new Date(now).toISOString(),
  status:alerts.some(a=>a.severity==='critical')?'CRITICAL':alerts.length?'WARNING':'NO_ALERTS',
  storage:{expires_at:finite?new Date(expiresAt).toISOString():null,remaining_seconds:seconds,lifetime,
   artifact_bytes:used.toString(),budget_bytes:budget,remaining_bytes:budget===null?null:(used>=BigInt(budget)?0n:BigInt(budget)-used).toString()},
  expired_leases:leases.toString(),outbox:{pending:pending.toString(),oldest_pending_seconds:age.toString()},alerts,
  publication_enabled:false,acceptance_verified:false};
}

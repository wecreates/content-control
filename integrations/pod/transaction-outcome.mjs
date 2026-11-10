import {types as utilTypes} from 'node:util';

export function assertCommitOutcome(result){
 // PostgreSQL can resolve COMMIT with a ROLLBACK tag when the transaction
 // aborted. Only an own data property on the driver result is evidence.
 const command=result&&typeof result==='object'&&!utilTypes.isProxy(result)&&!Array.isArray(result)
  ?Object.getOwnPropertyDescriptor(result,'command'):null;
 if(!command||!Object.hasOwn(command,'value')||command.value!=='COMMIT')throw Error('POD_COMMIT_UNVERIFIED');
}

import {types as utilTypes} from 'node:util';

function assertOutcome(result,expected,error){
 // Only an own data property on a single driver result is evidence.
 const command=result&&typeof result==='object'&&!utilTypes.isProxy(result)&&!Array.isArray(result)
  ?Object.getOwnPropertyDescriptor(result,'command'):null;
 if(!command||!Object.hasOwn(command,'value')||command.value!==expected)throw Error(error);
}

export function assertBeginOutcome(result){
 assertOutcome(result,'BEGIN','POD_BEGIN_UNVERIFIED');
}

export function assertCommitOutcome(result){
 // PostgreSQL can resolve COMMIT with a ROLLBACK tag after an abort.
 assertOutcome(result,'COMMIT','POD_COMMIT_UNVERIFIED');
}

export function assertRollbackOutcome(result){
 assertOutcome(result,'ROLLBACK','POD_ROLLBACK_UNVERIFIED');
}

export function assertDiscardOutcome(result){
 // node-postgres exposes the first word of the DISCARD ALL command tag.
 assertOutcome(result,'DISCARD','POD_DISCARD_UNVERIFIED');
}

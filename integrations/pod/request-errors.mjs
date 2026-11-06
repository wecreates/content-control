// Parser errors can carry request bodies and stack traces. Never serialize or
// log the error object, its message, body, headers or filesystem paths.
import {types as utilTypes} from 'node:util';
const failures=Object.freeze({
 'entity.too.large':[413,'POD_REQUEST_TOO_LARGE'],
 'encoding.unsupported':[415,'POD_REQUEST_ENCODING_UNSUPPORTED'],
 'charset.unsupported':[415,'POD_REQUEST_ENCODING_UNSUPPORTED'],
 'entity.parse.failed':[400,'POD_REQUEST_INVALID'],
 'entity.verify.failed':[400,'POD_REQUEST_INVALID'],
 'request.aborted':[400,'POD_REQUEST_INVALID'],
 'request.size.invalid':[400,'POD_REQUEST_INVALID']
});
function fixedType(error){
 try{
  if(error===null||(typeof error!=='object'&&typeof error!=='function')||utilTypes.isProxy(error))return null;
  const descriptor=Object.getOwnPropertyDescriptor(error,'type');
  return descriptor&&Object.hasOwn(descriptor,'value')&&typeof descriptor.value==='string'?descriptor.value:null;
 }catch{return null;}
}
export function podRequestError(error,_req,res,next){
 if(res.headersSent)return next(error);
 const type=fixedType(error),[status,code]=type!==null&&Object.hasOwn(failures,type)?failures[type]:[500,'POD_REQUEST_FAILED'];
 res.status(status).json({error:code});
}

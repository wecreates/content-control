// Parser errors can carry request bodies and stack traces. Never serialize or
// log the error object, its message, body, headers or filesystem paths.
const failures=Object.freeze({
 'entity.too.large':[413,'POD_REQUEST_TOO_LARGE'],
 'encoding.unsupported':[415,'POD_REQUEST_ENCODING_UNSUPPORTED'],
 'charset.unsupported':[415,'POD_REQUEST_ENCODING_UNSUPPORTED'],
 'entity.parse.failed':[400,'POD_REQUEST_INVALID'],
 'entity.verify.failed':[400,'POD_REQUEST_INVALID'],
 'request.aborted':[400,'POD_REQUEST_INVALID'],
 'request.size.invalid':[400,'POD_REQUEST_INVALID']
});
export function podRequestError(error,_req,res,next){
 if(res.headersSent)return next(error);
 const [status,code]=Object.hasOwn(failures,error?.type)?failures[error.type]:[500,'POD_REQUEST_FAILED'];
 res.status(status).json({error:code});
}

// PostgreSQL text is UTF-8 and cannot store NUL. Reject identifiers whose
// JavaScript spelling would be replaced or rejected by the durable boundary.
export function validPostgresText(value){
 return typeof value==='string'&&!value.includes('\0')&&Buffer.from(value,'utf8').toString('utf8')===value;
}
export function validOpaqueText(value,{maxLength=256}={}){
 return validPostgresText(value)&&value.length<=maxLength&&value.trim().length>0;
}

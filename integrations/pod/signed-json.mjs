// Native parsing owns JSON grammar. After signature verification, walk tokens
// iteratively to reject ambiguous decoded keys and numeric overflow. Signed
// envelope callers additionally reject values whose identity or wire spelling
// would change on native reserialization. Recovery records retain their exact
// PostgreSQL bigint JSON text and never opt into JavaScript number coercion.
export function parseSignedJSON(text,{canonicalNumbers=false}={}){
 const value=JSON.parse(text),stack=[];
 for(let i=0;i<text.length;){
  const ch=text[i];
  if(ch==='"'){
   const start=i++;
   while(text[i]!=='"'){if(text[i]==='\\')i++;i++;}
   i++;
   const object=stack.at(-1);
   if(object?.expectKey){
    const key=JSON.parse(text.slice(start,i));
    if(object.keys.has(key))throw new SyntaxError('ENVELOPE_JSON_DUPLICATE_KEY');
    object.keys.add(key);object.expectKey=false;
   }
  }else if(ch==='{'){stack.push({keys:new Set(),expectKey:true});i++;}
  else if(ch==='['){stack.push(null);i++;}
  else if(ch==='}'||ch===']'){stack.pop();i++;}
  else if(ch===','){const object=stack.at(-1);if(object)object.expectKey=true;i++;}
  else if(ch===':'||/\s/.test(ch)){i++;}
  else{
   const start=i++;
   while(i<text.length&&!/[\s,}\]]/.test(text[i]))i++;
   if(ch==='-'||(ch>='0'&&ch<='9')){
    const token=text.slice(start,i),number=Number(token);
    if(!Number.isFinite(number))throw new SyntaxError('ENVELOPE_JSON_NONFINITE');
    if(canonicalNumbers){
     if(Number.isInteger(number)&&!Number.isSafeInteger(number))
      throw new SyntaxError('ENVELOPE_JSON_UNSAFE_INTEGER');
     if(JSON.stringify(number)!==token)
      throw new SyntaxError('ENVELOPE_JSON_NONCANONICAL_NUMBER');
    }
   }
  }
 }
 return value;
}

import {fileIdentity} from './hash.mjs';
self.onmessage=async({data})=>{
 try{self.postMessage({identity:await fileIdentity(data)});}
 catch(error){self.postMessage({error:error.message||'File verification failed.'});}
};

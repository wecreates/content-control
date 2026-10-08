import crypto from 'node:crypto';

export function createStore(seed={}){
  return {
    watches:Array.isArray(seed.watches)?seed.watches:[],
    events:Array.isArray(seed.events)?seed.events:[]
  };
}

export function hydrateStore(seed={}){ return createStore(seed); }

export function serializeStore(store){
  return JSON.stringify({watches:store.watches,events:store.events},null,2)+'\n';
}

export function createWatch(store,{clientId,kind='change',targetUrl,label='Watch'}){
  if(!clientId) throw new Error('clientId required');
  const u=new URL(targetUrl);
  if(!['http:','https:'].includes(u.protocol)) throw new Error('http(s) target required');
  const w={
    id:crypto.randomUUID(),
    client_id:String(clientId),
    kind:String(kind),
    target_url:u.toString(),
    label:String(label),
    last_value:null,
    last_checked_at:null,
    last_change_at:null,
    last_status:null,
    status:'active'
  };
  store.watches.unshift(w);
  return w;
}

export function listWatches(store,clientId){
  return store.watches.filter(w=>w.client_id===String(clientId));
}

export function deleteWatch(store,clientId,id){
  const before=store.watches.length;
  store.watches=store.watches.filter(w=>!(w.client_id===String(clientId)&&w.id===String(id)));
  return store.watches.length!==before;
}

export function applyCheck(store,id,{hash,checkedAt,status}){
  const w=store.watches.find(x=>x.id===String(id));
  if(!w) return null;
  const changed=w.last_value!==null && w.last_value!==hash;
  w.last_value=hash;
  w.last_checked_at=checkedAt;
  w.last_status=status;
  if(changed){
    w.last_change_at=checkedAt;
    store.events.unshift({
      id:crypto.randomUUID(),
      client_id:w.client_id,
      watch_id:w.id,
      type:'change',
      at:checkedAt,
      label:w.label,
      target_url:w.target_url
    });
  }
  return {watch:w,changed};
}

import express from 'express';
import {deletePriceWatch,deletedPriceWatches} from './pricewatch-adapter.js';
import {createWatch,listWatches,deleteWatch,isDurablePriceWatch} from './monitor-store.js';
import {saveMonitorStore,checkWatch} from './monitor-runtime.js';

export function createMonitorRouter(store,{saveStore=saveMonitorStore,enablePriceWatches=false,...checkOptions}={}){
  const router=express.Router();
  router.use(express.json({limit:'64kb'}));

  const priceToken=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value);
  async function reconcileDeleted(clientId){
    // Legacy generic scopes/IDs outside the price token contract can never
    // have a price tombstone; they must not poison unrelated listings.
    if(!priceToken(clientId))return;
    const prices=listWatches(store,clientId).filter(w=>w.kind==='price');
    if(!checkOptions.priceDbPath){
      if(prices.some(isDurablePriceWatch))throw new Error('price_storage_not_configured');
      return;
    }
    const ids=[...new Set([...prices.map(w=>w.id),...store.events.filter(e=>e.client_id===clientId).map(e=>e.watch_id)])].filter(priceToken);
    const deleted=new Set(await deletedPriceWatches(clientId,ids,checkOptions));
    if(deleted.size){
      store.watches=store.watches.filter(w=>!(w.client_id===clientId&&deleted.has(w.id)));
      store.events=store.events.filter(e=>!(e.client_id===clientId&&deleted.has(e.watch_id)));
      await saveStore(store);
    }
  }
  router.get('/watch',async(req,res)=>{
    const clientId=String(req.query.clientId||'');
    try{await reconcileDeleted(clientId);res.json({watches:listWatches(store,clientId)});}
    catch{res.status(503).json({error:'price deletion status unavailable'});}
  });

  router.post('/watch',async(req,res)=>{
    try{
      if(String(req.body?.kind)==='price'&&enablePriceWatches!==true){
        res.status(503).json({error:'price watches disabled'});return;
      }
      const w=createWatch(store,req.body||{});
      // Do not let scheduled work use a price watch before its first save.
      if(w.kind==='price')w.status='creation_pending';
      try{await saveStore(store);}
      catch(error){
        if(w.kind==='price')store.watches=store.watches.filter(candidate=>candidate!==w);
        throw error;
      }
      if(w.kind==='price')w.status='active';
      const firstCheck=await checkWatch(store,w.id,{...checkOptions,persist:false});
      await saveStore(store);
      res.json({ok:true,id:w.id,last_checked_at:firstCheck.last_checked_at??null,first_check_ok:firstCheck.ok,...(w.kind==='price'?{price_status:w.price_monitoring_status,price_observation:w.price_last_observation??null}: {})});
    }catch(error){
      res.status(400).json({error:String(error?.message||error)});
    }
  });

  router.delete('/watch/:id',async(req,res)=>{
    const clientId=String(req.query.clientId||''),id=req.params.id;
    const w=store.watches.find(w=>w.client_id===clientId&&w.id===id);
    try{
      if(isDurablePriceWatch(w)){
        // Prevent new scheduled work immediately; durable tombstone also blocks
        // already-running worker commits and stale JSON/backup restorations.
        w.status='deletion_pending';
        await deletePriceWatch(clientId,id,checkOptions);
      }else if(!w){
        const deleted=checkOptions.priceDbPath&&priceToken(clientId)&&priceToken(id) ? await deletedPriceWatches(clientId,[id],checkOptions) : [];
        if(!deleted.includes(id)){res.json({ok:false});return;}
      }
      const ok=deleteWatch(store,clientId,id);
      if(w?.kind==='price'||!w)store.events=store.events.filter(e=>!(e.client_id===clientId&&e.watch_id===id));
      if(ok||!w)await saveStore(store);
      res.json({ok:ok||!w});
    }catch{res.status(503).json({error:'watch deletion incomplete; retry safely'});}
  });

  router.get('/events',async(req,res)=>{
    const clientId=String(req.query.clientId||'');
    try{await reconcileDeleted(clientId);res.json({events:store.events.filter(e=>e.client_id===clientId)});}
    catch{res.status(503).json({error:'price deletion status unavailable'});}
  });

  // Public full-store export is disabled. Private backup design is a separate change.
  router.all('/export',(_req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.status(404).json({error:'not found'});
  });

  return router;
}

import express from 'express';
import {createWatch,listWatches,deleteWatch} from './monitor-store.js';
import {saveMonitorStore,checkWatch} from './monitor-runtime.js';

export function createMonitorRouter(store){
  const router=express.Router();
  router.use(express.json({limit:'64kb'}));

  router.get('/watch',(req,res)=>{
    res.json({watches:listWatches(store,String(req.query.clientId||''))});
  });

  router.post('/watch',async(req,res)=>{
    try{
      const w=createWatch(store,req.body||{});
      await saveMonitorStore(store);
      const firstCheck=await checkWatch(store,w.id);
      res.json({ok:true,id:w.id,last_checked_at:firstCheck.last_checked_at??null,first_check_ok:firstCheck.ok});
    }catch(error){
      res.status(400).json({error:String(error?.message||error)});
    }
  });

  router.delete('/watch/:id',async(req,res)=>{
    const ok=deleteWatch(store,String(req.query.clientId||''),req.params.id);
    if(ok) await saveMonitorStore(store);
    res.json({ok});
  });

  router.get('/events',(req,res)=>{
    const clientId=String(req.query.clientId||'');
    res.json({events:store.events.filter(e=>e.client_id===clientId)});
  });

  router.get('/export',(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.json({watches:store.watches,events:store.events});
  });

  return router;
}

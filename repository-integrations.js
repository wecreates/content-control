import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';

// Read-only projection. No arbitrary command execution is exposed on the web service.
export function createRepositoryIntegrationRouter({moneyFactoryRoot=process.env.MONEY_FACTORY_ROOT}={}) {
  const router=express.Router();
  router.get('/status',async(_req,res)=>{
    res.set('Cache-Control','no-store');
    const base={publication_enabled:false,paid_generation_enabled:false,
      production_ready:false,status_scope:'Source and adapter configuration, not live provider health',
      repository:'https://github.com/wecreates/Money-factory/tree/main/integrations'};
    if(!moneyFactoryRoot)return res.status(503).json({...base,status:'WORKER_NOT_CONFIGURED'});
    try {
      const registry=JSON.parse(await fs.readFile(path.join(moneyFactoryRoot,'integrations/repositories.json'),'utf8'));
      await fs.access(path.join(moneyFactoryRoot,'integrations/run.py'));
      if(registry.schema_version!==1||!Array.isArray(registry.repositories)||registry.repositories.length!==7)throw Error('invalid registry');
      res.json({...base,status:'WORKER_SOURCE_CONFIGURED',repositories:registry.repositories.map(entry=>({
        id:entry.id,order:entry.order,revision:entry.revision,capability:entry.capability,
        runtime_status:'LIVE_EXECUTION_NOT_CHECKED_BY_THIS_ENDPOINT'
      }))});
    }catch{
      res.status(503).json({...base,status:'WORKER_SOURCE_UNAVAILABLE'});
    }
  });
  return router;
}

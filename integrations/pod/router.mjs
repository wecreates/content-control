import express from 'express';
import {fileURLToPath} from 'node:url';
import {metrics} from './metrics.mjs';
import {recordFinancialEvent} from './finance.mjs';
import {ArtifactStore} from './artifacts.mjs';
import {recordMarketObservation} from './market.mjs';
import {reconcilePublication} from './reconcile.mjs';
export function createPodRouter({db,authorize,env=process.env}) {
 const router=express.Router();
 router.use((_req,res,next)=>{res.set('Cache-Control','no-store');res.set('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'");next();});
 router.get('/dashboard',(_req,res)=>res.sendFile(fileURLToPath(new URL('./dashboard.html',import.meta.url))));
 router.get('/dashboard.js',(_req,res)=>res.sendFile(fileURLToPath(new URL('./dashboard.js',import.meta.url))));
 router.get('/status',(_req,res)=>res.json({publication_enabled:env.PUBLICATION_ENABLED==='true'&&env.POD_PUBLICATION_ENABLED==='true',adapters_verified:false}));
 router.use(async(req,res,next)=>{try{if(typeof authorize!=='function'||await authorize(req)!==true)return res.status(401).json({error:'OWNER_AUTH_REQUIRED'});next();}catch{res.status(401).json({error:'OWNER_AUTH_REQUIRED'});}});
 router.post('/artifacts',express.raw({type:['image/png','application/pdf','application/json'],limit:'16mb'}),async(req,res)=>{
  try{const store=new ArtifactStore(db,{budgetBytes:Number(env.POD_ARTIFACT_BUDGET_BYTES||134217728)});res.status(201).json({sha256:await store.put(req.body,req.get('content-type').split(';')[0])});}
  catch{res.status(409).json({error:'ARTIFACT_STORAGE_BLOCKED'});}
 });
 router.use(express.json({limit:'256kb',strict:true}));
 router.post('/market',async(req,res)=>{try{res.status(202).json(await recordMarketObservation(db,req.body,env.POD_MARKET_KEY));}catch{res.status(409).json({error:'MARKET_OBSERVATION_BLOCKED'});}});
 router.post('/listing-observations',async(req,res)=>{try{res.json(await reconcilePublication(db,req.body,env.POD_PROVIDER_KEY));}catch{res.status(409).json({error:'LISTING_OBSERVATION_BLOCKED'});}});
 router.get('/metrics',async(_req,res)=>{try{res.json(await metrics(db));}catch{res.status(503).json({error:'POD_STORAGE_UNAVAILABLE'});}});
 router.post('/financial-events',async(req,res)=>{try{res.status(202).json(await recordFinancialEvent(db,req.body,env.POD_FINANCE_KEY));}catch{res.status(409).json({error:'FINANCIAL_EVENT_BLOCKED'});}});
 router.post('/intake',async(req,res)=>{try{res.status(202).json(await db.registerIntake({...req.body,intakeKey:env.POD_INTAKE_KEY,dailyLimit:Number(env.POD_DAILY_CONCEPT_LIMIT||100)}));}catch{res.status(409).json({error:'INTAKE_BLOCKED'});}});
 router.post('/jobs',async(req,res)=>{
  try{const r=await db.enqueue(req.body);res.status(202).json(r);}
  catch{res.status(409).json({error:'POD_INTAKE_BLOCKED'});}
 });
 router.get('/ready',async(_req,res)=>{try{res.json({jobs:await db.listReady()});}catch{res.status(503).json({error:'POD_STORAGE_UNAVAILABLE'});}});
 return router;
}

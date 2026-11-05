import express from 'express';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {metrics} from './metrics.mjs';
import {recordFinancialEvent} from './finance.mjs';
import {ArtifactStore} from './artifacts.mjs';
import {artifactBudgetBytes} from './storage-budget.mjs';
import {recordMarketObservation} from './market.mjs';
import {reconcilePublication} from './reconcile.mjs';
import {podRequestError} from './request-errors.mjs';
import {productionActivity} from './capacity.mjs';
import {parseSignedJSON} from './signed-json.mjs';
const requestDecoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});
const READ_REQUEST_TIMEOUT_MS=30000;
function verifyRequestJSON(_req,_res,body){parseSignedJSON(requestDecoder.decode(body));}
function storageFailure(res,error,status,code){
 if(error?.message==='POD_STORAGE_EXPIRING')return res.status(503).json({error:'POD_STORAGE_UNAVAILABLE'});
 return res.status(status).json({error:code});
}
function requestLifecycle(req,res){
 const controller=new AbortController();
 const deadline=performance.now()+READ_REQUEST_TIMEOUT_MS;
 const timeout=AbortSignal.timeout(READ_REQUEST_TIMEOUT_MS);
 const signal=AbortSignal.any([controller.signal,timeout]);
 const abort=()=>{if(!controller.signal.aborted)controller.abort(Error('POD_REQUEST_CANCELLED'));};
 req.once('aborted',abort);res.once('close',abort);
 return {signal,checkpoint(){
  signal.throwIfAborted();
  const now=performance.now();
  if(Number.isFinite(now)&&now<deadline)return;
  const error=Error('POD_REQUEST_TIMEOUT');
  if(!controller.signal.aborted)controller.abort(error);
  throw error;
 },dispose(){req.off('aborted',abort);res.off('close',abort);}};
}
async function requestRead(lifecycle,operation){const result=await operation;lifecycle.checkpoint();return result;}
export function createPodRouter({db,authorize,env=process.env,status}) {
 const router=express.Router();
 router.use((_req,res,next)=>{res.set('Cache-Control','no-store');res.set('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; img-src blob:; form-action 'self'; frame-ancestors 'none'");next();});
 router.get('/dashboard',(_req,res)=>res.sendFile(fileURLToPath(new URL('./dashboard.html',import.meta.url))));
 router.get('/dashboard.js',(_req,res)=>res.sendFile(fileURLToPath(new URL('./dashboard.js',import.meta.url))));
 router.get('/status',(_req,res)=>res.json({...status?.(),publication_enabled:false,publication_requested:env.PUBLICATION_ENABLED==='true'&&env.POD_PUBLICATION_ENABLED==='true',adapters_verified:false}));
 router.use(async(req,res,next)=>{try{if(typeof authorize!=='function'||await authorize(req)!==true)return res.status(401).json({error:'OWNER_AUTH_REQUIRED'});next();}catch{res.status(401).json({error:'OWNER_AUTH_REQUIRED'});}});
 router.post('/artifacts',express.raw({type:['image/png','application/pdf','application/json','font/ttf','text/plain','application/zip'],limit:'16mb'}),async(req,res)=>{
  try{const store=new ArtifactStore(db,{budgetBytes:artifactBudgetBytes(env)});res.status(201).json({sha256:await store.put(req.body,req.get('content-type').split(';')[0])});}
  catch(error){storageFailure(res,error,409,'ARTIFACT_STORAGE_BLOCKED');}
 });
 router.get('/artifacts/:sha',(_req,res)=>res.status(404).json({error:'ARTIFACT_UNAVAILABLE'}));
 router.get('/jobs/:id/artifacts/:sha',async(req,res)=>{
  const lifecycle=requestLifecycle(req,res);
  try{const item=await requestRead(lifecycle,db.reviewArtifact(req.params.id,req.params.sha,{signal:lifecycle.signal}));res.set('X-Content-Type-Options','nosniff');res.type(item.media_type).send(item.body);}
  catch(error){storageFailure(res,error,404,'ARTIFACT_UNAVAILABLE');}finally{lifecycle.dispose();}
 });
 router.get('/jobs/:id/package',async(req,res)=>{
  const lifecycle=requestLifecycle(req,res);
  try{res.json(await requestRead(lifecycle,db.reviewPackage(req.params.id,{signal:lifecycle.signal})));}catch(error){storageFailure(res,error,404,'PACKAGE_UNAVAILABLE');}finally{lifecycle.dispose();}
 });
 router.get('/jobs',async(req,res)=>{
  const lifecycle=requestLifecycle(req,res);
  try{res.json({jobs:await requestRead(lifecycle,db.listOperationsJobs(req.query.state||'review_required',{signal:lifecycle.signal})),limit:50,publication_enabled:false});}
  catch(error){storageFailure(res,error,409,'JOB_LIST_UNAVAILABLE');}finally{lifecycle.dispose();}
 });
 router.use(express.json({limit:'256kb',strict:true,verify:verifyRequestJSON}));
 router.post('/jobs/:id/retry',async(req,res)=>{
  try{await db.requeueRepair(req.params.id,req.body);res.json({status:'QUEUED',publication_enabled:false});}catch(error){storageFailure(res,error,409,'RETRY_BLOCKED');}
 });
 router.post('/jobs/:id/review',async(req,res)=>{
  try{res.json(await db.acceptReview(req.params.id,req.body));}catch(error){storageFailure(res,error,409,'REVIEW_BLOCKED');}
 });
 router.post('/market',async(req,res)=>{try{res.status(202).json(await recordMarketObservation(db,req.body,env.POD_MARKET_KEY));}catch(error){storageFailure(res,error,409,'MARKET_OBSERVATION_BLOCKED');}});
 router.post('/listing-observations',async(req,res)=>{try{res.json(await reconcilePublication(db,req.body,env.POD_PROVIDER_KEY));}catch(error){storageFailure(res,error,409,'LISTING_OBSERVATION_BLOCKED');}});
 router.get('/metrics',async(req,res)=>{const lifecycle=requestLifecycle(req,res);try{res.json(await requestRead(lifecycle,metrics(db,{env,signal:lifecycle.signal})));}catch{res.status(503).json({error:'POD_STORAGE_UNAVAILABLE'});}finally{lifecycle.dispose();}});
 router.get('/capacity',async(req,res)=>{const lifecycle=requestLifecycle(req,res);try{res.json(await requestRead(lifecycle,productionActivity(db,{signal:lifecycle.signal})));}catch{res.status(503).json({error:'POD_CAPACITY_UNAVAILABLE'});}finally{lifecycle.dispose();}});
 router.post('/financial-events',async(req,res)=>{try{res.status(202).json(await recordFinancialEvent(db,req.body,env.POD_FINANCE_KEY));}catch(error){storageFailure(res,error,409,'FINANCIAL_EVENT_BLOCKED');}});
 router.post('/intake',async(req,res)=>{try{res.status(202).json(await db.registerIntake({...req.body,intakeKey:env.POD_INTAKE_KEY,dailyLimit:Number(env.POD_DAILY_CONCEPT_LIMIT||100)}));}catch(error){storageFailure(res,error,409,'INTAKE_BLOCKED');}});
 router.post('/jobs',async(req,res)=>{
  try{const r=await db.enqueue(req.body);res.status(202).json(r);}
  catch(error){storageFailure(res,error,409,'POD_INTAKE_BLOCKED');}
 });
 router.get('/ready',async(req,res)=>{const lifecycle=requestLifecycle(req,res);try{res.json({jobs:await requestRead(lifecycle,db.listReady({signal:lifecycle.signal}))});}catch{res.status(503).json({error:'POD_STORAGE_UNAVAILABLE'});}finally{lifecycle.dispose();}});
 // Keep parser failures inside this router, including in development mode.
 // Express's default handler may expose parser messages and stack traces.
 router.use(podRequestError);
 return router;
}

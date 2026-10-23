import https from 'node:https';
import net from 'node:net';
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import tls from 'node:tls';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createPricePageFetcher} from '../pricewatch-safe-fetch.js';
import {createStore,createWatch} from '../monitor-store.js';
import {checkWatch} from '../monitor-runtime.js';
const URL='https://shop.example.com/item';
function network(config={}){
 const state={dns:0,requests:0,sent:0,canceled:0,destroyed:0,pins:[],options:[]};
 const dependencies={createResolver:()=>({resolve4:async host=>{state.dns++;assert.equal(host,'shop.example.com');if(config.dnsPending)return new Promise(()=>{});return config.addresses??['93.184.216.34'];},cancel:()=>state.canceled++}),request:(options,onResponse)=>{
  state.requests++;state.options.push(options);const req=new EventEmitter();req.destroy=()=>{state.destroyed++;};
  req.end=()=>{
   state.sent++;if(config.headerStall)return;
   queueMicrotask(()=>{
    const res=new EventEmitter();res.statusCode=config.status??200;res.headers=config.headers??{'content-type':'text/html; charset=utf-8'};res.complete=config.complete??true;res.destroy=()=>{state.destroyed++;};onResponse(res);
    if(config.bodyStall)return;
    if(config.responseError){res.emit('error',Error('fixture'));return;}
    for(const chunk of config.chunks??[Buffer.from('<html>ok</html>')])res.emit('data',chunk);
    res.emit('end');res.emit('close');
   });
  };
  queueMicrotask(()=>{
   if(config.requestError){req.emit('error',Error('TLS certificate failure'));return;}
   const socket=new EventEmitter();Object.assign(socket,{authorized:config.authorized??true,remoteAddress:config.peer??'93.184.216.34',remoteFamily:'IPv4',remotePort:443,getPeerCertificate:()=>({subjectaltname:config.certName??'DNS:shop.example.com'})});
   req.emit('socket',socket);
   // A repeated lookup must use the pin, never perform a second resolution.
   options.lookup(options.hostname,{},(err,address,family)=>{assert.ifError(err);state.pins.push(address);assert.equal(family,4);});
   options.lookup(options.hostname,{all:true},(err,records)=>{assert.ifError(err);assert.deepEqual(records,[{address:'93.184.216.34',family:4}]);});
   if(!config.tlsStall)socket.emit('secureConnect');
  });
  return req;
 }};return {state,dependencies};
}
function fetcher(config={},policy={}){const f=network(config);return {...f,fetch:createPricePageFetcher({allowedHosts:['shop.example.com'],...policy},f.dependencies)};}
test('default empty allowlist denies all URLs without DNS',async()=>{const n=network();const get=createPricePageFetcher({},n.dependencies);await assert.rejects(get(URL));assert.equal(n.state.dns,0);});
test('operator policy rejects broad hosts and excess resource limits',()=>{
 for(const policy of [{allowedHosts:['*.example.com']},{allowedHosts:['localhost']},{allowedHosts:['127.0.0.1']},{allowedHosts:['shop.example.com.']},{allowedHosts:['SHOP.example.com']},{allowedHosts:['xn--bcher-kva.example']},{allowedHosts:['a..example.com']},{deadlineMs:10001},{maxBytes:2097153},{maxBytes:true},{redirects:1}])assert.throws(()=>createPricePageFetcher(policy));
});
test('URL ambiguity, credentials, non-HTTPS, ports, literals and non-allowlisted hosts fail before DNS',async()=>{
 const f=fetcher();for(const url of ['http://shop.example.com/item','https://shop.example.com:444/item','https://shop.example.com:443/item','https://user:pass@shop.example.com/item','https://shop.example.com/item#fragment','https://shop.example.com/item#','https://shop.example.com.evil.test/item','https://127.0.0.1/item','https://2130706433/item','https://0x7f000001/item','https://[::1]/item','https://shop.example.com./item','https://SHOP.example.com/item','https://shop.example.com\\@evil.test/item',' https://shop.example.com/item','https://shop.example.com/\nitem'])await assert.rejects(f.fetch(url));assert.equal(f.state.dns,0);
});
test('every special-purpose IPv4 range and IPv6 response is denied before request',async()=>{
 for(const ip of ['0.1.2.3','10.0.0.1','100.64.0.1','127.0.0.1','169.254.169.254','172.16.0.1','192.0.0.9','192.0.2.1','192.31.196.1','192.52.193.1','192.88.99.1','192.168.0.1','192.175.48.1','198.18.0.1','198.19.255.255','198.51.100.1','203.0.113.1','224.0.0.1','239.255.255.255','240.0.0.1','255.255.255.255','::1','::ffff:93.184.216.34','010.0.0.1']){const f=fetcher({addresses:[ip]});await assert.rejects(f.fetch(URL));assert.equal(f.state.requests,0);}
});
test('mixed private/public DNS, empty or excessive answers fail closed',async()=>{
 for(const addresses of [[],['93.184.216.34','10.0.0.1'],Array(17).fill('93.184.216.34')]){const f=fetcher({addresses});await assert.rejects(f.fetch(URL));assert.equal(f.state.requests,0);}
});
test('public address is pinned, certificate-checked and fetched without credentials or proxy reuse',async()=>{
 const f=fetcher();assert.deepEqual(await f.fetch(URL),{verified:true,finalUrl:URL,html:'<html>ok</html>'});const o=f.state.options[0];
 assert.equal(o.hostname,'shop.example.com');assert.equal(o.servername,'shop.example.com');assert.equal(o.rejectUnauthorized,true);assert.equal(o.checkServerIdentity,tls.checkServerIdentity);assert.equal(o.autoSelectFamily,false);assert.equal(o.family,4);assert.equal(o.maxHeaderSize,8192);assert.equal(o.insecureHTTPParser,false);assert.deepEqual(o.agent.options.proxyEnv,{});assert.equal(o.agent.maxCachedSessions,0);
 assert.deepEqual(Object.keys(o.headers).sort(),['Accept','Accept-Encoding','Connection','Host','User-Agent']);assert.equal(o.auth,undefined);assert.equal(f.state.dns,1);assert.deepEqual(f.state.pins,['93.184.216.34']);assert.equal(f.state.sent,1);
});
test('unauthorized certificate, wrong hostname or peer mismatch sends no HTTP request bytes',async()=>{
 for(const config of [{authorized:false},{peer:'127.0.0.1'},{peer:'93.184.216.35'},{certName:'DNS:evil.example.com'},{requestError:true}]){const f=fetcher(config);await assert.rejects(f.fetch(URL));assert.equal(f.state.sent,0);assert.ok(f.state.destroyed);}
});
test('redirects are never followed including allowlisted, private and credential targets',async()=>{
 for(const location of [URL,'https://127.0.0.1/','http://169.254.169.254/','https://user:pass@shop.example.com/']){const f=fetcher({status:302,headers:{location,'content-type':'text/html'}});await assert.rejects(f.fetch(URL));assert.equal(f.state.requests,1);assert.equal(f.state.dns,1);}
});
test('HTTP errors, compressed, non-HTML and unsupported encodings are rejected',async()=>{
 for(const config of [{status:403},{status:500},{headers:{'content-type':'application/json'}},{headers:{'content-type':'text/html; charset=iso-8859-1'}},{headers:{'content-type':'text/html','content-encoding':'gzip'}},{headers:{}}])await assert.rejects(fetcher(config).fetch(URL));
});
test('declared and streamed byte limits plus invalid UTF8 and truncation fail closed',async()=>{
 for(const config of [{headers:{'content-type':'text/html','content-length':'9'}},{chunks:[Buffer.from('123'),Buffer.from('456')]},{chunks:[Buffer.from([255])]},{complete:false},{headers:{'content-type':'text/html','content-length':'4'},chunks:[Buffer.from('123')]},{responseError:true}])await assert.rejects(fetcher(config,{maxBytes:5}).fetch(URL));
 const exact=fetcher({chunks:[Buffer.from('12345')]},{maxBytes:5});assert.equal((await exact.fetch(URL)).html,'12345');
});
test('one total deadline covers DNS, TLS, headers and body and cancels resources',async()=>{
 for(const config of [{dnsPending:true},{tlsStall:true},{headerStall:true},{bodyStall:true}]){const f=fetcher(config,{deadlineMs:15});await assert.rejects(f.fetch(URL),/deadline/);assert.equal(f.state.canceled,1);if(!config.dnsPending)assert.ok(f.state.destroyed);}
});
test('late DNS after deadline never starts a connection and admission is bounded',async()=>{
 let release;const n=network();n.dependencies.createResolver=()=>({resolve4:()=>new Promise(r=>release=r),cancel:()=>{}});const get=createPricePageFetcher({allowedHosts:['shop.example.com'],deadlineMs:10},n.dependencies);
 await assert.rejects(get(URL),/deadline/);release(['93.184.216.34']);await new Promise(r=>setImmediate(r));assert.equal(n.state.requests,0);
 const f=fetcher({dnsPending:true},{deadlineMs:15});const pending=Array.from({length:4},()=>f.fetch(URL));await assert.rejects(f.fetch(URL),/busy/);assert.equal(f.state.dns,4);await Promise.all(pending.map(p=>assert.rejects(p,/deadline/)));
});
test('host policy is snapshotted and successful calls do not share agents',async()=>{
 const hosts=['shop.example.com'];const n=network();const get=createPricePageFetcher({allowedHosts:hosts},n.dependencies);hosts[0]='evil.example.com';await get(URL);await get(URL);assert.notEqual(n.state.options[0].agent,n.state.options[1].agent);await assert.rejects(get('https://evil.example.com/'));
});
test('actual monitor path uses network boundary and persists only verified extracted prices',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'pricewatch-fetch-'));t.after(()=>rm(dir,{recursive:true,force:true}));const db=path.join(dir,'prices.sqlite'),store=createStore(),w=createWatch(store,{clientId:'client-one',kind:'price',targetUrl:URL,priceCurrency:'USD'});
 const page=amount=>Buffer.from(`<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'Product',sku:'mug',offers:{'@type':'Offer',price:amount,priceCurrency:'USD',availability:'https://schema.org/InStock'}})}</script>`);
 const run=(id,config)=>checkWatch(store,w.id,{persist:false,priceDbPath:db,priceCheckId:`check-${id}`,priceCheckedAt:`2026-10-22T05:00:0${id}Z`,fetchPricePage:fetcher(config).fetch});
 assert.equal((await run(1,{chunks:[page('30')]})).monitoring_status,'baseline_recorded');assert.equal((await run(2,{addresses:['169.254.169.254']})).monitoring_status,'unsupported');assert.equal((await run(3,{chunks:[page('20')]})).candidate_queued,false);assert.equal((await run(4,{chunks:[page('10')]})).candidate_queued,true);
 assert.equal(execFileSync('python3',['-c','import sqlite3,sys;print(sqlite3.connect(sys.argv[1]).execute("select count(*) from price_outbox").fetchone()[0])',db],{encoding:'utf8'}).trim(),'1');
});

test('native HTTPS transport rejects a local malformed TLS peer without HTTP request bytes',async t=>{
 let received=Buffer.alloc(0),sent=0;const sockets=new Set();
 const server=net.createServer(socket=>{sockets.add(socket);socket.on('error',()=>{});socket.on('close',()=>sockets.delete(socket));socket.once('data',chunk=>{received=Buffer.concat([received,chunk]);socket.end('HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n');});});
 server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{for(const socket of sockets)socket.destroy();server.close();});
 // Redirect only the trusted test transport to a local adversarial fixture.
 // Production resolver/address policy and TLS checks are never weakened.
 const n=network();n.dependencies.request=(options,callback)=>{
   const request=https.request({...options,port:server.address().port,lookup:(_host,_options,cb)=>cb(null,'127.0.0.1',4)},callback);
   const end=request.end;request.end=function(...args){sent++;return end.apply(this,args);};return request;
 };
 const get=createPricePageFetcher({allowedHosts:['shop.example.com'],deadlineMs:1000},n.dependencies);
 await assert.rejects(get(URL));assert.ok(received.length>0);assert.equal(received[0],22);assert.equal(received.includes(Buffer.from('GET /')),false);assert.equal(sent,0);
});

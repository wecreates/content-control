import https from 'node:https';
import tls from 'node:tls';
import {Resolver} from 'node:dns/promises';
import {isIPv4} from 'node:net';

// IANA IPv4 special-purpose registry, checked 2026-10-22; reject even
// globally reachable special-purpose exceptions. Also reject multicast.
const excluded=['0.0.0.0/8','10.0.0.0/8','100.64.0.0/10','127.0.0.0/8',
  '169.254.0.0/16','172.16.0.0/12','192.0.0.0/24','192.0.2.0/24',
  '192.31.196.0/24','192.52.193.0/24','192.88.99.0/24','192.168.0.0/16',
  '192.175.48.0/24','198.18.0.0/15','198.51.100.0/24','203.0.113.0/24',
  '224.0.0.0/4','240.0.0.0/4'];
const numberOf=ip=>ip.split('.').reduce((n,x)=>n*256+Number(x),0);
const ranges=excluded.map(cidr=>{const [ip,bits]=cidr.split('/');const size=2**(32-Number(bits));return [numberOf(ip),size];});
function publicIPv4(ip){return typeof ip==='string'&&isIPv4(ip)&&!ranges.some(([base,size])=>numberOf(ip)>=base&&numberOf(ip)<base+size);}
function hostname(name){return typeof name==='string'&&name.length<=253&&!name.split('.').some(label=>label.startsWith('xn--'))&&/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(name);}
const failure=code=>new Error(`price_fetch_${code}`);

// Dependency overrides are a trusted code/test seam, never request parameters.
// This deliberately supports IPv4 HTTPS only, no redirects or compression.
export function createPricePageFetcher(policy={}, {createResolver=()=>new Resolver(),request=https.request}={}) {
  const {allowedHosts=[],maxBytes=2097152,deadlineMs=10000}=policy;
  if(Object.keys(policy).some(k=>!['allowedHosts','maxBytes','deadlineMs'].includes(k))||!Array.isArray(allowedHosts)||allowedHosts.length>100||allowedHosts.some(h=>!hostname(h))||!Number.isInteger(maxBytes)||maxBytes<1||maxBytes>2097152||!Number.isInteger(deadlineMs)||deadlineMs<1||deadlineMs>10000)throw failure('invalid_policy');
  const hosts=new Set(allowedHosts);let active=0;
  return async function fetchPricePage(input){
    if(typeof input!=='string'||input.length>8192||/[\s\\]/.test(input))throw failure('invalid_url');
    let url;try{url=new URL(input);}catch{throw failure('invalid_url');}
    if(url.protocol!=='https:'||url.port||url.username||url.password||input.includes('#')||url.href!==input||!hostname(url.hostname)||!hosts.has(url.hostname))throw failure('url_not_allowed');
    if(active>=4)throw failure('busy');active++;
    let resolver,req,response,agent,timer,settled=false;
    try{return await new Promise((resolve,reject)=>{
      const finish=(error,value)=>{
        if(settled)return;settled=true;clearTimeout(timer);
        resolver?.cancel();response?.destroy();req?.destroy();agent?.destroy();
        error?reject(error):resolve(value);
      };
      timer=setTimeout(()=>finish(failure('deadline')),deadlineMs);
      (async()=>{
        resolver=createResolver();
        const addresses=await resolver.resolve4(url.hostname);
        if(settled)return;
        if(!Array.isArray(addresses)||!addresses.length||addresses.length>16||!addresses.every(publicIPv4))throw failure('dns_not_public_ipv4');
        const pinned=addresses[0];
        agent=new https.Agent({keepAlive:false,maxCachedSessions:0,proxyEnv:{}});
        let secure=false;
        const options={protocol:'https:',hostname:url.hostname,port:443,method:'GET',path:url.pathname+url.search,
          servername:url.hostname,family:4,autoSelectFamily:false,agent,rejectUnauthorized:true,
          checkServerIdentity:tls.checkServerIdentity,minVersion:'TLSv1.2',maxHeaderSize:8192,insecureHTTPParser:false,
          headers:{Host:url.hostname,Accept:'text/html','Accept-Encoding':'identity','User-Agent':'PriceWatch/1.0',Connection:'close'},
          lookup:(host,opts,callback)=>{
            if(host!==url.hostname)return callback(failure('unexpected_lookup'));
            callback(null,...(opts?.all?[[{address:pinned,family:4}]]:[pinned,4]));
          }};
        req=request(options,res=>{
          response=res;
          if(settled){res.destroy();return;}
          res.on('error',()=>finish(failure('response_failed')));
          res.on('aborted',()=>finish(failure('response_aborted')));
          if(!secure||res.statusCode!==200)return finish(failure('http_rejected'));
          const type=res.headers['content-type'];
          if(typeof type!=='string'||!/^text\/html(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?\s*$/i.test(type))return finish(failure('content_type'));
          if(res.headers['content-encoding']&&res.headers['content-encoding']!=='identity')return finish(failure('content_encoding'));
          const length=res.headers['content-length'];
          if(length!==undefined&&(typeof length!=='string'||!/^\d+$/.test(length)||Number(length)>maxBytes))return finish(failure('body_limit'));
          const chunks=[];let bytes=0;
          res.on('data',chunk=>{
            if(settled)return;
            if(!Buffer.isBuffer(chunk))return finish(failure('invalid_chunk'));
            bytes+=chunk.length;if(bytes>maxBytes)return finish(failure('body_limit'));
            chunks.push(chunk);
          });
          res.on('end',()=>{
            if(settled)return;
            if(!res.complete||(length!==undefined&&Number(length)!==bytes))return finish(failure('response_incomplete'));
            try{const html=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks,bytes));finish(null,{verified:true,finalUrl:input,html});}catch{finish(failure('invalid_utf8'));}
          });
          res.on('close',()=>{if(!settled)finish(failure('response_closed'));});
        });
        req.on('error',()=>finish(failure('request_failed')));
        req.on('upgrade',(_res,socket)=>{socket.destroy();finish(failure('upgrade_rejected'));});
        req.on('socket',socket=>{
          socket.once('secureConnect',()=>{
            if(settled)return;
            if(socket.authorized!==true||socket.remoteAddress!==pinned||socket.remoteFamily!=='IPv4'||socket.remotePort!==443||tls.checkServerIdentity(url.hostname,socket.getPeerCertificate()))return finish(failure('peer_rejected'));
            secure=true;req.end();
          });
        });
        req.on('close',()=>{if(!settled&&!response)finish(failure('request_closed'));});
      })().catch(()=>finish(failure('network_rejected')));
    });}finally{active--;}
  };
}

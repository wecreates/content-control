// Bundle the existing comparison workspace into one local HTML file. No media included.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
const require=createRequire(resolve(process.env.BROWSER_QA_MODULES||'.','package.json'));
const {build}=require('esbuild');
const options={bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',minify:true,legalComments:'inline'};
const worker=await build({...options,entryPoints:['comparison-ui/hash-worker.mjs']});
const app=await build({...options,entryPoints:['comparison-ui/app.mjs'],define:{__HASH_WORKER_SOURCE__:JSON.stringify(worker.outputFiles[0].text)}});
const script=app.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
const html=readFileSync('comparison-ui/index.html','utf8').replace('<script type="module" src="/compare/app.mjs"></script>',`<script>${script}</script>`);
const output=resolve(process.argv[2]||'receipts/Content-Control-Offline-Comparison.html');
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,html);console.log(output);

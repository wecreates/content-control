import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
// Fixed Python entry point. No shell, dynamic imports, public endpoint or publisher.
const [input,font,output]=process.argv.slice(2);
if(!input||!font||!output||process.argv.length!==5)throw Error('INPUT_FONT_OUTPUT_REQUIRED');
const child=spawn(process.env.POD_PYTHON||'python3',[
 fileURLToPath(new URL('./pod_review_package.py',import.meta.url)),
 '--input',input,'--font',font,'--output',output
],{stdio:'inherit',env:{...process.env,PUBLICATION_ENABLED:'false',POD_PUBLICATION_ENABLED:'false'}});
let force;
const timer=setTimeout(()=>{child.kill('SIGTERM');force=setTimeout(()=>child.kill('SIGKILL'),5000);},240000);
child.on('error',()=>{clearTimeout(timer);clearTimeout(force);process.exitCode=1;});
child.on('close',code=>{clearTimeout(timer);clearTimeout(force);process.exitCode=code===0?0:1;});

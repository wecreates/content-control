import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runPythonStage} from '../integrations/pod/python-stage.mjs';

const [input,font,output]=process.argv.slice(2);
if(!input||!font||!output||process.argv.length!==5)throw Error('INPUT_FONT_OUTPUT_REQUIRED');
const args=['--input',path.resolve(input),'--font',path.resolve(font),'--output',path.resolve(output)];
const controller=new AbortController();
const cancel=()=>controller.abort();
process.on('SIGTERM',cancel);
process.on('SIGINT',cancel);
try{
 const result=await runPythonStage('pod_review_package.py',args,{
  root:fileURLToPath(new URL('../',import.meta.url)),signal:controller.signal,
  env:{...process.env,PUBLICATION_ENABLED:'false',POD_PUBLICATION_ENABLED:'false'},
  timeoutMs:240000,killGraceMs:5000,maxOutputBytes:1048576
 });
 process.stdout.write(result);
}catch{
 console.error('REVIEW_GENERATION_FAILED');
 process.exitCode=1;
}finally{
 process.off('SIGTERM',cancel);
 process.off('SIGINT',cancel);
}

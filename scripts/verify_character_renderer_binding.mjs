import {parse} from '@babel/parser';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const identities={dave:'Dave',points_monk:'PointsMonk',cashback_goblin:'CashbackGoblin'};
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function walk(node,visit){if(!node||typeof node!=='object')return;visit(node);for(const [key,value] of Object.entries(node)){if(key==='loc')continue;if(Array.isArray(value))value.forEach(v=>walk(v,visit));else if(value&&typeof value==='object')walk(value,visit);}}
export function analyzeSource(source,{dynamic=false}={}){
 const ast=parse(source,{sourceType:'module',plugins:['jsx']});
 const imports=new Set(),tags=new Set();let validRegistry=false,registryLookup=false;
 walk(ast,node=>{
  if(node.type==='ImportDeclaration'&&node.source.value==='./CharacterSystem')for(const spec of node.specifiers)if(spec.type==='ImportSpecifier'&&spec.local.name===spec.imported.name)imports.add(spec.local.name);
  if(node.type==='JSXOpeningElement'&&node.name.type==='JSXIdentifier')tags.add(node.name.name);
  if(node.type==='VariableDeclarator'&&node.id.name==='C'&&node.init?.type==='ObjectExpression')validRegistry=Object.entries(identities).every(([id,name])=>node.init.properties.some(p=>p.type==='ObjectProperty'&&p.key.name===id&&p.value.type==='Identifier'&&p.value.name===name));
  if(node.type==='VariableDeclarator'&&node.id.name==='Character'&&node.init?.type==='MemberExpression'&&node.init.object.name==='C'&&node.init.computed&&node.init.property.name==='id')registryLookup=true;
 });
 return {shared_renderer_imports:Object.values(identities).every(x=>imports.has(x)),character_dispatch:dynamic?(validRegistry&&registryLookup&&tags.has('Character')):Object.values(identities).every(x=>tags.has(x))};
}
export function verifyBinding({root='.',candidate=null}={}){
 const files={board_component:'remotion/CharacterBoardComposition.jsx',video_component:'remotion/StudioAnimaticComposition.jsx',character_system:'remotion/CharacterSystem.jsx',board_lock:'control/character-board-lock-v1.json'};
 const board=analyzeSource(fs.readFileSync(path.join(root,files.board_component),'utf8'));
 const video=analyzeSource(fs.readFileSync(path.join(root,files.video_component),'utf8'),{dynamic:true});
 const lock=JSON.parse(fs.readFileSync(path.join(root,files.board_lock),'utf8'));
 const checks={board_imports_shared_renderer:board.shared_renderer_imports,board_renders_all_identities:board.character_dispatch,video_imports_shared_renderer:video.shared_renderer_imports,video_dispatches_all_identities:video.character_dispatch,lock_names_same_renderer:lock.character_system===files.character_system&&lock.renderer_backed_board_component===files.board_component,publication_disabled:lock.publication_enabled===false};
 return {schema_version:1,status:Object.values(checks).every(Boolean)?'PASS':'FAIL',scope:'source_renderer_binding',checks,source_files:Object.fromEntries(Object.entries(files).map(([k,file])=>[k,{path:file,sha256:hash(path.join(root,file))}])),candidate_sha256:candidate?hash(candidate):null,rendered_pixel_identity_verified:false,full_av_review:false,production_approved:false,publication_enabled:false,limitation:'Shared source geometry verified. Scene transforms, occlusion, expression, and pose differ intentionally; this receipt does not prove rendered visibility or audiovisual quality.'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),value=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
 const out=value('--out');if(!out)throw new Error('--out required');
 const report=verifyBinding({root:value('--root')||'.',candidate:value('--candidate')});
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));process.exitCode=report.status==='PASS'?0:2;
}

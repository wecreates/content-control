import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve, dirname} from 'node:path';

export const UPSTREAM = 'https://raw.githubusercontent.com/yihui-dev/awesome-opus5-5-videos';
const DEFAULT_SHA = 'main';
export function normalizeCatalog(input, revision = DEFAULT_SHA) {
  const rows = Array.isArray(input) ? input : (Array.isArray(input.videos) ? input.videos : Array.isArray(input.items) ? input.items : null);
  if (!rows) throw new Error('Unsupported catalog format: expected array, videos, or items');
  const seen = new Set();
  return rows.map((v, index) => {
    if (!v || typeof v !== 'object') return null;
    const id = String(v.id ?? v.slug ?? v.videoId ?? v.video_id ?? index).slice(0,160);
    if (seen.has(id)) return null;
    seen.add(id);
    const category = String(v.category ?? v.type ?? v.section ?? 'unclassified').slice(0,120);
    const prompt = String(v.promptPath ?? v.prompt_path ?? v.promptFile ?? v.prompt_file ?? '').slice(0,250);
    const source = String(v.sourceUrl ?? v.source_url ?? v.url ?? v.postUrl ?? v.post_url ?? '').slice(0,500);
    return {id, category, title: String(v.title ?? v.name ?? id).slice(0,200), creator: String(v.creator ?? v.author ?? v.handle ?? 'unknown').slice(0,160), source_url: /^https:\/\//.test(source) ? source : null, prompt_path: /^prompts\/[a-zA-Z0-9._/-]+\.md$/.test(prompt) && !prompt.includes('..') ? prompt : null, revision, status:'reference_only', execution_allowed:false, publication_allowed:false};
  }).filter(Boolean);
}
export async function buildCatalog({inputPath, outputPath, revision = DEFAULT_SHA, allowNetwork = false} = {}) {
  if (!outputPath) throw new Error('outputPath required');
  let raw;
  if (inputPath) raw = await readFile(inputPath, 'utf8');
  else {
    if (!allowNetwork) throw new Error('Network access disabled unless explicitly requested');
    if (!/^(main|[0-9a-f]{40})$/.test(revision)) throw new Error('Invalid upstream revision');
    const response = await fetch(`${UPSTREAM}/${revision}/data/videos.json`, {signal: AbortSignal.timeout(20000)});
    if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
    raw = await response.text();
  }
  const entries = normalizeCatalog(JSON.parse(raw), revision);
  const output = {schema_version:1, upstream:'yihui-dev/awesome-opus5-5-videos', revision, imported_at:new Date().toISOString(), total:entries.length, mode:'reference_only', publication_enabled:false, entries};
  await mkdir(dirname(resolve(outputPath)), {recursive:true});
  await writeFile(outputPath, JSON.stringify(output,null,2)+'\n');
  return {count:entries.length, outputPath};
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const val = (key) => {const i=args.indexOf(key);return i<0?undefined:args[i+1];};
  buildCatalog({inputPath:val('--input'),outputPath:val('--output'),revision:val('--revision') ?? DEFAULT_SHA,allowNetwork:args.includes('--fetch')}).then(x=>console.log(JSON.stringify(x))).catch(e=>{console.error(e.message);process.exitCode=1;});
}

// Offline compile-only validation. No browser, media rendering, or provider access.
import {bundle} from '@remotion/bundler';
import fs from 'node:fs/promises';
import path from 'node:path';
const entries = ['remotion/v10-index.jsx', 'remotion/studio-animatic-index.jsx'];
const results = [];
for (const entry of entries) {
  const name = path.basename(entry, '.jsx');
  const outDir = path.resolve('../node-bundle-smoke', name);
  const started = performance.now();
  const output = await bundle({entryPoint:path.resolve(entry), outDir,
    enableCaching:false, gitSource:null, rootDir:process.cwd()});
  const files = await fs.readdir(output);
  if (!files.includes('index.html') || !files.some(file => file.endsWith('.js'))) {
    throw new Error(`Incomplete bundle: ${entry}`);
  }
  results.push({entry, status:'PASS', output, files:files.length,
    elapsed_ms:Math.round(performance.now()-started), scope:'compile_only_no_browser_no_media_render'});
  console.log(JSON.stringify(results.at(-1)));
}
await fs.writeFile(path.resolve('../node-bundle-smoke-results.json'), JSON.stringify(results,null,2)+'\n');

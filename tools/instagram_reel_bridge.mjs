#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {chromium} from 'playwright';
import ffprobePath from 'ffprobe-static';

const args = process.argv.slice(2);
const has = (name) => args.includes(name);
const value = (name, fallback=null) => {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : fallback;
};
const allValues = (name) => {
  const out = [];
  for (let i=0;i<args.length;i++) if (args[i]===name && i+1<args.length) out.push(args[i+1]);
  return out;
};

const profileDir = path.resolve(value('--profile', path.join(os.homedir(), '.content-control', 'instagram-profile')));
const outDir = path.resolve(value('--out', path.join(process.cwd(), 'reel-captures')));
const setupOnly = has('--setup');
const urls = allValues('--url');

function canonicalReelUrl(raw) {
  const u = new URL(raw);
  if (!['www.instagram.com','instagram.com'].includes(u.hostname)) throw new Error('Only Instagram URLs are supported');
  const m = u.pathname.match(/^\/reel\/([A-Za-z0-9_-]+)\/?$/);
  if (!m) throw new Error('Expected an Instagram Reel URL');
  return `https://www.instagram.com/reel/${m[1]}/`;
}

function ffprobe(file) {
  const p = spawnSync(ffprobePath, ['-v','error','-show_streams','-show_format','-of','json',file], {encoding:'utf8'});
  if (p.status !== 0) throw new Error(`ffprobe failed for ${file}: ${p.stderr || p.stdout}`);
  const d = JSON.parse(p.stdout);
  const streams = d.streams || [];
  return {
    duration_seconds: Number(d.format?.duration || 0),
    size_bytes: Number(d.format?.size || fs.statSync(file).size),
    video_stream_present: streams.some(s => s.codec_type === 'video'),
    audio_stream_present: streams.some(s => s.codec_type === 'audio'),
    video_codec: streams.find(s => s.codec_type === 'video')?.codec_name || null,
    audio_codec: streams.find(s => s.codec_type === 'audio')?.codec_name || null,
    width: streams.find(s => s.codec_type === 'video')?.width || null,
    height: streams.find(s => s.codec_type === 'video')?.height || null,
  };
}

async function downloadViaContext(context, mediaUrl, referer, target) {
  const res = await context.request.get(mediaUrl, {
    headers: {
      referer,
      'accept': 'video/*,*/*;q=0.8',
    },
    timeout: 120000,
  });
  if (!res.ok()) throw new Error(`Media fetch failed: HTTP ${res.status()}`);
  const body = await res.body();
  if (body.length < 100000) throw new Error(`Media response too small: ${body.length} bytes`);
  fs.writeFileSync(target, body);
  return body.length;
}

async function captureReel(context, rawUrl) {
  const reelUrl = canonicalReelUrl(rawUrl);
  const shortcode = new URL(reelUrl).pathname.split('/').filter(Boolean)[1];
  const page = await context.newPage();
  const candidates = new Set();
  page.on('response', async (response) => {
    try {
      const req = response.request();
      const ct = (await response.headerValue('content-type')) || '';
      const url = response.url();
      if (req.resourceType() === 'media' || ct.startsWith('video/') || /\.mp4(?:\?|$)/i.test(url)) {
        candidates.add(url);
      }
    } catch {}
  });

  await page.goto(reelUrl, {waitUntil:'domcontentloaded', timeout:120000});
  await page.waitForTimeout(2500);

  if (/accounts\/login/i.test(page.url())) {
    await page.close();
    throw new Error('Instagram login is required in the persistent Content Control profile');
  }

  const video = page.locator('video').first();
  try {
    await video.waitFor({state:'attached', timeout:30000});
  } catch {
    await page.close();
    throw new Error('No playable Reel media element found');
  }

  try {
    await video.click({timeout:5000}).catch(()=>{});
    await page.evaluate(() => {
      const v = document.querySelector('video');
      if (v) {
        v.muted = false;
        v.play().catch(()=>{});
      }
    });
  } catch {}
  await page.waitForTimeout(3500);

  const currentSrc = await page.evaluate(() => {
    const v = document.querySelector('video');
    return v ? (v.currentSrc || v.src || '') : '';
  });
  if (currentSrc) candidates.add(currentSrc);

  fs.mkdirSync(outDir, {recursive:true});
  const attempts = [];
  let verified = null;

  for (const mediaUrl of [...candidates]) {
    const target = path.join(outDir, `${shortcode}.mp4`);
    try {
      await downloadViaContext(context, mediaUrl, reelUrl, target);
      const probe = ffprobe(target);
      attempts.push({mediaUrl, probe, ok:true});
      if (probe.video_stream_present && probe.audio_stream_present && probe.duration_seconds > 1) {
        verified = {target, mediaUrl, probe};
        break;
      }
      fs.rmSync(target, {force:true});
    } catch (e) {
      attempts.push({mediaUrl, ok:false, error:String(e?.message || e)});
    }
  }

  await page.close();

  if (!verified) {
    throw new Error(`No playable Reel media with both audio and video could be captured. Candidates tried: ${attempts.length}`);
  }

  const result = {
    schema_version: 1,
    shortcode,
    source_url: reelUrl,
    local_file: verified.target,
    media_url_source: 'logged-in-browser-network',
    actual_media_verified: true,
    ...verified.probe,
    captured_at: new Date().toISOString(),
    temporary_analysis_copy: true,
    publication_enabled: false,
  };
  fs.writeFileSync(path.join(outDir, `${shortcode}.json`), JSON.stringify(result,null,2)+'\n');
  return result;
}

async function main() {
  fs.mkdirSync(profileDir, {recursive:true});
  const context = await chromium.launchPersistentContext(profileDir, {
    headless:false,
    channel:'chrome',
    viewport:{width:1280,height:900},
    args:['--autoplay-policy=no-user-gesture-required'],
  });

  try {
    if (setupOnly) {
      const page = context.pages()[0] || await context.newPage();
      await page.goto('https://www.instagram.com/', {waitUntil:'domcontentloaded', timeout:120000});
      console.log(JSON.stringify({
        status:'SETUP_BROWSER_OPEN',
        profile:profileDir,
        instruction:'Log into Instagram once in this Chrome window. The dedicated Content Control profile will retain the session.'
      }));
      await new Promise(resolve => {
        const timer=setInterval(async()=>{
          if (context.pages().length===0) { clearInterval(timer); resolve(); }
        },1000);
      });
      return;
    }

    if (!urls.length) throw new Error('Provide at least one --url or use --setup');

    const results = [];
    for (const raw of urls) {
      try {
        results.push({ok:true, ...(await captureReel(context, raw))});
      } catch (e) {
        results.push({ok:false, source_url:raw, error:String(e?.message || e), actual_media_verified:false});
      }
    }
    console.log(JSON.stringify({status:'COMPLETE',results},null,2));
    if (results.some(r => !r.ok)) process.exitCode = 2;
  } finally {
    await context.close().catch(()=>{});
  }
}

main().catch(err => {
  console.error(err?.stack || String(err));
  process.exit(1);
});

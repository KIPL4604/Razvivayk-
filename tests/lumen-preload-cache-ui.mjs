import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const origin=process.env.QA_ORIGIN||'http://127.0.0.1:8182',out=path.resolve('output/hub-social-loading');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const checks=[],errors=[],times={};const check=(v,label)=>{assert.ok(v,label);checks.push(label);};
const context=await browser.newContext({viewport:{width:375,height:812},hasTouch:true,isMobile:true});
const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
await p.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));
const cdp=await context.newCDPSession(p);
let failBackground=true,failWorld=false,assetRequests=[];
await p.route('**/menu-backgrounds/garden-preview.webp?*',r=>failBackground?r.abort('failed'):r.continue());
await p.route('**/sprites-*.pack?*',r=>failWorld?r.abort('failed'):r.continue());
p.on('request',r=>{if(/\/assets\/lumen\/.*\?v=/.test(r.url()))assetRequests.push(r.url());});
try{
 await p.goto(origin);await p.locator('#campaignCards [data-lumen-action=open]').click();await p.locator('[data-lumen-action=open]').filter({hasText:'Повторить загрузку'}).waitFor();check(await p.locator('.lumen-shell').count()===0,'Failed background never exposes incomplete menu');
 failBackground=false;
 await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:2500,uploadThroughput:150000});
 const start=Date.now();await p.getByRole('button',{name:'Повторить загрузку',exact:true}).click();await p.waitForFunction(()=>{const e=document.querySelector('#lumenEntryPercent');return e&&parseInt(e.textContent)>5&&parseInt(e.textContent)<90;});
 check(await p.locator('.lumen-shell').count()===0,'Throttled menu waits for complete map background and interface');
 await p.waitForFunction(()=>document.querySelector('#lumenEntryEta')?.textContent.startsWith('≈'));
 await p.screenshot({path:path.join(out,'loading-slow-375-i2.png')});
 check(/с/.test(await p.locator('#lumenEntryEta').textContent()),'ETA is derived from measured bytes during slow transfer');
 await p.locator('.lumen-title-screen').waitFor({timeout:90000});times.retryMenuMs=Date.now()-start;
 const background=await p.locator('.lumen-menu-background').evaluate(img=>({source:img.src,width:img.naturalWidth,complete:img.complete}));check(background.source.startsWith('blob:')&&background.complete,'Decoded map screenshot comes from blob');
 await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 await p.emulateMedia({reducedMotion:'reduce'});check(await p.locator('video').count()===0,'Static menu has no video in reduced motion');
 await p.emulateMedia({reducedMotion:'no-preference'});
 for(const width of [375,768,1440,1920]){
  await p.setViewportSize({width,height:width<800?812:1000});
  for(const theme of ['dark','light']){
   await p.evaluate(t=>MenuUI.set('theme',t),theme);await p.locator('.lumen-main-actions [data-lumen-value=play]').click();
   await p.locator('.lumen-shell[data-page=play]').waitFor();
   await p.screenshot({path:path.join(out,`lumen-play-${width}-${theme}-i2.png`)});
   check(await p.locator('.menu-motion-layer').count()===0,'No slide clone on Lumen button '+width+' '+theme);
   check(await p.locator('.lumen-game-window').evaluate(e=>e.getBoundingClientRect().width<=innerWidth),'Window fits '+width+' '+theme);
   await p.locator('[aria-label="Закрыть окно"]').click();
  }
 }
 await p.setViewportSize({width:375,height:812});await p.evaluate(()=>MenuUI.set('theme','dark'));
 failWorld=true;await p.locator('.lumen-main-actions [data-lumen-value=play]').click();await p.locator('[data-lumen-action=start]').click();await p.locator('[data-story-action=retry]:visible').waitFor({timeout:30000});
 check(await p.locator('#lumenCanvas').count()===0,'Missing world package blocks playable canvas');
 await p.screenshot({path:path.join(out,'world-error-375-i2.png')});
 failWorld=false;await p.locator('[data-story-action=retry]').click();await p.locator('[data-story-action=skip]:visible').waitFor({timeout:60000});
 await p.screenshot({path:path.join(out,'story-ready-375-i2.png')});
 check(await p.locator('#lumenStory img').evaluateAll(images=>images.every(i=>i.complete&&i.naturalWidth>0)),'Story portraits and scene are decoded before story opens');
 await p.locator('[data-story-action=skip]').click();await p.locator('#lumenCanvas').waitFor({timeout:30000});
 await p.waitForFunction(()=>document.querySelector('.lumen-menu-background')?.naturalWidth===960);
 await p.reload();await p.locator('#hubSearch').waitFor();assetRequests=[];const warm=Date.now();await p.locator('#campaignCards [data-lumen-action=open]').click();await p.locator('.lumen-title-screen').waitFor({timeout:30000});times.warmMenuMs=Date.now()-warm;
 check(assetRequests.length===0,'Reload uses persistent cache: zero versioned asset network requests');
 await p.locator('.lumen-main-actions [data-lumen-value=play]').click();p.once('dialog',d=>d.accept());await p.locator('[data-lumen-action=start]').click();await p.locator('[data-story-action=skip]:visible').waitFor({timeout:30000});await p.locator('[data-story-action=skip]').click();await p.locator('#lumenCanvas').waitFor();
 check(assetRequests.length===0,'Reloaded selected world also uses persistent cache');
 const keys=await p.evaluate(async()=>{const c=await caches.open('teramont-lumen-assets-v1');return(await c.keys()).map(r=>r.url);});check(keys.every(url=>/\/static\/assets\/lumen\/.+\?v=[a-f0-9]{64}$/.test(url)),'Persistent cache contains only versioned public Lumen assets');
 check(!keys.some(url=>/api|initData/.test(url)),'No account data in asset cache');
 check(errors.length===0,'No JS errors: '+errors.join(';'));
 await writeFile(path.join(out,'loading-results.json'),JSON.stringify({checks,times,background,errors},null,2));console.log(JSON.stringify({checks:checks.length,times,errors}));
}catch(error){await p.screenshot({path:path.join(out,'loading-failure.png')});throw error;}finally{await browser.close();}

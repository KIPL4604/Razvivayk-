import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const origin=process.env.QA_ORIGIN||'http://127.0.0.1:8186';
const manifest=JSON.parse(await readFile(new URL('../webapp/frontend/assets/lumen/garden-pilot.json',import.meta.url)));
const out=new URL('../output/lumen-garden-pilot/',import.meta.url);
await mkdir(out,{recursive:true});
const filename=path=>fileURLToPath(new URL(path,out));
const groups=labels=>new Set(labels.flatMap(label=>manifest.groups[label]).flatMap(name=>{
 const file=manifest.files[name];
 return (file.chunks||[file]).map(chunk=>chunk.pack);
}));
const opening=groups(['opening','scout']),bosses=groups(['bosses']);
const heroPack=[...groups(['scout'])][0];
const browser=await chromium.launch({headless:true,executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const context=await browser.newContext();
const errors=[],attempts=new Map(),times={};
const page=await context.newPage();
page.on('pageerror',error=>errors.push(error.message));
await page.route('https://telegram.org/**',route=>route.fulfill({body:'',contentType:'text/javascript'}));
let retryHero=true,icons=0,releaseBosses;
const bossGate=new Promise(resolve=>{releaseBosses=resolve;});
await page.route('**/weapon-icons/**',route=>{icons++;return route.abort('failed');});
await page.route('**/sprites-garden-*.pack?*',async route=>{
 const file=new URL(route.request().url()).pathname.split('/').at(-1);
 attempts.set(file,(attempts.get(file)||0)+1);
 if(bosses.has(file))await bossGate;
 if(file===heroPack&&retryHero){retryHero=false;return route.fulfill({status:502,body:'temporary failure'});}
 return route.continue();
});
const open=()=>page.locator('#campaignCards [data-lumen-action=open]').click();
try{
 for(const [iteration,width] of [[1,375],[2,1440]]){
  await page.setViewportSize({width,height:width===375?812:900});
  if(iteration===1){
   await page.goto(origin);
   await open();
   await page.locator('.lumen-main-actions [data-lumen-value=play]').click();
   const cdp=await context.newCDPSession(page);
   await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:125000,uploadThroughput:125000});
   const started=performance.now();
   await page.locator('[data-lumen-action=start]').click();
   await page.locator('[data-story-action=skip]:visible').waitFor();
   assert.equal(icons<=6,true,'Full library must not be requested by launch');
   assert.equal([...bosses].every(file=>!attempts.has(file)),true,'Boss packs must not be requested before combat');
   assert.equal(attempts.get(heroPack),2,'Temporary hero pack error retries automatically');
   for(const file of opening)if(file!==heroPack)assert.equal(attempts.get(file),1,'Completed opening pack is retained');
   await page.screenshot({path:filename('intro-375.png')});
   await page.locator('[data-story-action=skip]:visible').click();
   await page.locator('#lumenCanvas').waitFor();
   times.throttledStartWithOne502Ms=Math.round(performance.now()-started);
   await page.waitForFunction(()=>document.querySelector('#lumenCanvas')?.width>0);
   assert.equal(await page.locator('[data-story-action=retry]:visible').count(),0);
   await page.keyboard.down('KeyD');
   await page.waitForTimeout(300);
   await page.keyboard.up('KeyD');
   await page.keyboard.press('Escape');
   assert.ok(await page.evaluate(()=>saved.lumen.run.player.x>0),'Hero moved while boss transfers and icons were blocked');
   const visibleFallback=await page.evaluate(async()=>{
    const {loadArt}=await import('/static/js/lumen/assets.mjs');
    const {Renderer}=await import('/static/js/lumen/renderer.mjs');
    const art=await loadArt({map:'garden',character:'scout',phase:'opening'});
    if(art.images['boss-rootwarden'])return false;
    const canvas=document.createElement('canvas');
    canvas.style.cssText='position:fixed;left:-999px;width:320px;height:240px';
    document.body.append(canvas);
    const renderer=new Renderer(canvas,art);
    try{
     renderer.resize();renderer.map='garden';
     renderer.actor('boss-rootwarden','walk',0,0,90,120);
     return canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data.some((value,index)=>index%4===3&&value>0);
    }finally{renderer.destroy();canvas.remove();}
   });
   assert.equal(visibleFallback,true,'A late boss is visible even when its original atlas is unavailable');
   await page.screenshot({path:filename('paused-375.png')});
   releaseBosses();
   await cdp.detach();
  }else{
   await page.reload();
   await page.evaluate(async()=>{
    const {createRun,serialize}=await import('/static/js/lumen/engine.mjs');
    const run=createRun({map:'garden',character:'scout',seed:5,runId:crypto.randomUUID()});
    run.time=300;
    saved.lumen.run=serialize(run);
    saveState();
   });
   await open();
   await page.locator('[data-lumen-action=resume]').click();
   await page.locator('[data-story-action=skip]:visible').waitFor();
   await page.screenshot({path:filename('resume-intro-1440.png')});
   await page.locator('[data-story-action=skip]:visible').click();
   await page.locator('#lumenOverlay [data-lumen-action=continue]').waitFor();
   assert.equal(await page.evaluate(()=>saved.lumen.run.time),300);
   for(const file of opening)assert.equal(attempts.get(file),file===heroPack?2:1,'Opening packages reused across reload');
   await page.screenshot({path:filename('resume-paused-1440.png')});
   await page.setViewportSize({width:1920,height:1080});
   assert.ok(await page.locator('.lumen-dialog').evaluate(dialog=>dialog.getBoundingClientRect().width<innerWidth));
   await page.screenshot({path:filename('resume-paused-1920.png')});
  }
 }
 const disconnected=await browser.newContext({viewport:{width:768,height:1024}});
 const second=await disconnected.newPage();
 second.on('pageerror',error=>errors.push(error.message));
 await second.route('https://telegram.org/**',route=>route.fulfill({body:'',contentType:'text/javascript'}));
 const cdp=await disconnected.newCDPSession(second),requestIds=new Set();
 const worldPack=[...opening].find(file=>file!==heroPack);
 let interrupted;
 const downloadInterrupted=new Promise(resolve=>{interrupted=resolve;});
 await cdp.send('Network.enable');
 cdp.on('Network.requestWillBeSent',event=>{if(new URL(event.request.url).pathname.endsWith(worldPack))requestIds.add(event.requestId);});
 cdp.on('Network.dataReceived',event=>{if(event.dataLength>0&&requestIds.has(event.requestId))interrupted();});
 await second.goto(origin);
 await second.locator('#campaignCards [data-lumen-action=open]').click();
 await second.locator('.lumen-main-actions [data-lumen-value=play]').click();
 const network={latency:150,downloadThroughput:125000,uploadThroughput:125000};
 await cdp.send('Network.emulateNetworkConditions',{offline:false,...network});
 await second.locator('[data-lumen-action=start]').click();
 let timeout;
 try{
  await Promise.race([downloadInterrupted,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('No world bytes to interrupt')),10000);})]);
 }finally{clearTimeout(timeout);}
 await disconnected.setOffline(true);
 await second.waitForFunction(()=>!navigator.onLine);
 await second.waitForTimeout(2000);
 await disconnected.setOffline(false);
 await second.waitForFunction(()=>navigator.onLine);
 await second.locator('[data-story-action=skip]:visible').waitFor();
 await second.locator('[data-story-action=skip]:visible').click();
 await second.locator('#lumenCanvas').waitFor();
 assert.ok(requestIds.size>=2,'Part interrupted mid-transfer was requested again automatically');
 assert.equal(await second.locator('[data-story-action=retry]:visible').count(),0);
 await second.screenshot({path:filename('recovered-768.png')});
 await disconnected.close();
 assert.deepEqual(errors,[]);
 await writeFile(new URL('results.json',out),JSON.stringify({times,attempts:Object.fromEntries(attempts),icons,errors},null,2));
 console.log(JSON.stringify({times,icons,errors}));
}finally{releaseBosses();await browser.close();}

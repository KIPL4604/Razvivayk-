import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const origin=process.env.QA_ORIGIN||'http://127.0.0.1:8195';
const manifest=JSON.parse(await readFile(new URL('../webapp/frontend/assets/lumen/garden-pilot.json',import.meta.url)));
const pack=manifest.files[manifest.groups.opening[0]].pack;
const out=new URL('../output/lumen-progress-recovery/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
 for(const width of [375,768,1440,1920]){
  const context=await browser.newContext({viewport:{width,height:width===375?812:960},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[],ranges=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{
   if(request.url().includes(pack)&&request.headers().range)ranges.push(request.headers().range);
  });
  await page.route('https://telegram.org/**',route=>route.fulfill({body:'',contentType:'text/javascript'}));
  await page.route(/\/(scout\.png|story-world-garden-small\.webp)$/,route=>route.fulfill({status:502,body:'Unavailable preview'}));
  await page.addInitScript(file=>{
   const fetchOriginal=window.fetch.bind(window);
   let interrupted=false;
   window.fetch=async (resource,options)=>{
    const response=await fetchOriginal(resource,options);
    if(interrupted||!String(resource).includes(file)||options?.headers?.Range)return response;
    interrupted=true;
    const bytes=new Uint8Array(await response.arrayBuffer());
    return new Response(new ReadableStream({
     start(controller){
      setTimeout(()=>controller.enqueue(bytes.slice(0,8000)),300);
      setTimeout(()=>controller.enqueue(bytes.slice(8000,16000)),1600);
      setTimeout(()=>controller.error(new Error('Simulated LTE interruption')),6500);
     }
    }),{headers:response.headers});
   };
  },pack);
  await page.goto(origin);
  await page.locator('#campaignCards [data-lumen-action=open]').click();
  await page.locator('.lumen-main-actions [data-lumen-value=play]').click();
  await page.locator('.lumen-shell[data-page=play] [data-lumen-action=start]').click();
  const eta=page.locator('#lumenLoadEta'),phase=page.locator('#lumenLoadPhase'),percent=page.locator('#lumenLoadPercent');
  await page.waitForFunction(()=>document.querySelector('#lumenLoadEta')?.textContent.startsWith('Осталось ≈'));
  await page.screenshot({path:fileURLToPath(new URL(`active-${width}.png`,out))});
  const before=Number.parseInt(await percent.textContent());
  await page.waitForFunction(()=>document.querySelector('#lumenLoadPhase')?.textContent==='Данные пока не поступают');
  assert.equal(await eta.textContent(),'Оценка на паузе');
  assert.equal(Number.parseInt(await percent.textContent()),before);
  assert.equal(await phase.evaluate(element=>element.scrollWidth<=element.clientWidth),true);
  await page.screenshot({path:fileURLToPath(new URL(`waiting-${width}.png`,out))});
  await page.locator('[data-story-action=skip]:visible').click({timeout:20000});
  await page.locator('#lumenCanvas').waitFor();
  assert.match(ranges[0]||'',/^bytes=16000-28287$/);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({width,percentDuringStall:before,rangeRequests:ranges.length}));
  await context.close();
 }
}finally{await browser.close();}

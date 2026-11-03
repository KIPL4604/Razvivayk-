/* Isolated menu-only timing. Does not use personal Telegram identity or saves. */
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const origin=new URL(process.argv[2]||'http://127.0.0.1:8080').origin,label=process.argv[3]||'local',out=path.resolve('output/lumen-menu-startup');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE});
const report={label,origin:new URL(origin).origin,runs:[],errors:[]};
try{
 const context=await browser.newContext({viewport:{width:375,height:812},isMobile:true,hasTouch:true}),p=await context.newPage();
 await p.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));p.on('pageerror',e=>report.errors.push(e.message));
 const cdp=await context.newCDPSession(p);await cdp.send('Network.enable');
 let records=new Map();cdp.on('Network.requestWillBeSent',e=>{if(e.request.url.startsWith(origin+'/'))records.set(e.requestId,{file:new URL(e.request.url).pathname,start:e.timestamp,type:e.type});});
 cdp.on('Network.responseReceived',e=>{const r=records.get(e.requestId);if(r)Object.assign(r,{status:e.response.status,headersMs:Math.round((e.timestamp-r.start)*1000),cached:e.response.fromDiskCache||false});});
 cdp.on('Network.loadingFinished',e=>{const r=records.get(e.requestId);if(r)Object.assign(r,{ms:Math.round((e.timestamp-r.start)*1000),encodedBytes:e.encodedDataLength});});
 for(const run of ['cold','reload']){
  const shellStart=Date.now();await p.goto(origin,{waitUntil:'domcontentloaded',timeout:180000});await p.locator('#hubSearch').waitFor({timeout:180000});
  const shellMs=Date.now()-shellStart;records=new Map();const start=Date.now();
  await p.locator('#campaignCards [data-lumen-action=open]').click();
  let error;
  const title=p.locator('#lumenSetupMount .lumen-title-screen'),failure=p.locator('#lumenSetupMount [role="alert"]');
  try{
   await title.or(failure).waitFor({timeout:90000});
   if(await failure.isVisible())error=await failure.textContent();
  }catch(e){error=e.message.split('\n')[0];}
  const menuMs=Date.now()-start,resources=[...records.values()].map(({start,...r})=>r);
  report.runs.push({run,shellMs,menuMs,error,phase:await p.evaluate(()=>document.querySelector('#lumenEntryPhase')?.textContent||null),resources});
  await p.screenshot({path:path.join(out,label+'-'+run+'.png')});
  console.log(JSON.stringify({label,run,shellMs,menuMs,error,requests:resources.length,bytes:resources.reduce((sum,r)=>sum+(r.encodedBytes||0),0)}));
  await writeFile(path.join(out,label+'.json'),JSON.stringify(report,null,2));if(error)break;
 }
}finally{await browser.close();}

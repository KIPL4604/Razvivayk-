/* Read-only startup audit. Isolated Edge contexts never use personal saves.
 * NODE_PATH must resolve the existing playwright package. No test installation.
 * node tests/game-startup-profile.cjs <origin> <output.json> [game] [cpu-rate] [all|cold]
 */
const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const path=require('node:path');

async function main(){
  const [origin,output,game='lumen',rate='1',mode='all']=process.argv.slice(2);
  if(!origin||!output||!['lumen','specimen'].includes(game)||!['all','cold'].includes(mode)||!(Number(rate)>=1))throw Error('Expected origin, output.json, lumen|specimen, optional CPU rate, all|cold');
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:375,height:812},deviceScaleFactor:1});
  const page=await context.newPage(),cdp=await context.newCDPSession(page);
  const report={date:new Date().toISOString(),origin:new URL(origin).origin,game,cpuRate:Number(rate),mode,browser:browser.version(),runs:[],errors:[]};
  const requests=new Map(),network=[];
  let current='shell';
  await cdp.send('Network.enable');await cdp.send('Performance.enable');
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:Number(rate)});
  cdp.on('Network.requestWillBeSent',event=>{
    if(!event.request.url.startsWith(new URL(origin).origin))return;
    const url=new URL(event.request.url);
    requests.set(event.requestId,{phase:current,file:url.pathname,start:event.timestamp,type:event.type});
  });
  cdp.on('Network.responseReceived',event=>{
    const r=requests.get(event.requestId);if(!r)return;
    Object.assign(r,{status:event.response.status,headersAt:event.timestamp,cache:event.response.fromDiskCache||false,
      cacheControl:event.response.headers['cache-control']||event.response.headers['Cache-Control'],encoding:event.response.headers['content-encoding']});
  });
  cdp.on('Network.loadingFinished',event=>{
    const r=requests.get(event.requestId);if(!r)return;
    Object.assign(r,{end:event.timestamp,ms:(event.timestamp-r.start)*1000,ttfbMs:(r.headersAt-r.start)*1000,wireBytes:event.encodedDataLength});network.push(r);
    if(r.file.endsWith('.pack'))console.log(JSON.stringify({phase:current,pack:path.basename(r.file),ms:Math.round(r.ms),status:r.status,wireBytes:r.wireBytes}));
    requests.delete(event.requestId);
  });
  cdp.on('Network.loadingFailed',event=>{
    const r=requests.get(event.requestId);if(!r)return;
    Object.assign(r,{end:event.timestamp,ms:(event.timestamp-r.start)*1000,error:event.errorText});network.push(r);requests.delete(event.requestId);
    if(r.file.endsWith('.pack'))console.log(JSON.stringify({phase:current,pack:path.basename(r.file),error:r.error,ms:Math.round(r.ms)}));
  });
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('dialog',d=>d.accept());
  await context.addInitScript(()=>{
    window.__startup={decodes:[],longTasks:[]};
    const decode=HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode=async function(...args){
      const start=performance.now();
      try{return await decode.apply(this,args);}
      finally{window.__startup.decodes.push({start,end:performance.now(),width:this.naturalWidth,height:this.naturalHeight});}
    };
    new PerformanceObserver(list=>window.__startup.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,ms:e.duration})))).observe({type:'longtask',buffered:true});
  });
  const now=()=>page.evaluate(()=>performance.now());
  async function snapshot(){
    return page.evaluate(()=>({now:performance.now(),...window.__startup,resources:performance.getEntriesByType('resource').filter(r=>r.name.startsWith(location.origin)).map(r=>({file:new URL(r.name).pathname,start:r.startTime,end:r.responseEnd,ms:r.duration,wire:r.transferSize,encoded:r.encodedBodySize,decoded:r.decodedBodySize,initiator:r.initiatorType}))}));
  }
  async function metric(){return Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));}
  async function run(label,{reload=false,reenter=false}={}){
    current=label;const networkStart=network.length;
    if(reenter)await page.evaluate(()=>showScreen('home'));
    else{
      const start=Date.now();
      if(reload)await page.reload({waitUntil:'domcontentloaded',timeout:45000});
      else await page.goto(origin,{waitUntil:'domcontentloaded',timeout:45000});
      await page.locator('[data-lumen-action="open"]').waitFor({state:'attached',timeout:20000});
      console.log(JSON.stringify({phase:label,shellMs:Date.now()-start}));
    }
    const before=await metric(),from=await now();
    const menuSelector=game==='lumen'?'.lumen-home-actions [data-lumen-value="play"]':'.sp-actions .sp-primary';
    const open=game==='lumen'?'[data-lumen-action="open"]':'[data-sp-action="open"]';
    await page.locator(open).click({timeout:20000});
    await page.locator(menuSelector).waitFor({state:'visible',timeout:180000});
    const menu=await now();
    if(game==='lumen')await page.locator(menuSelector).click();
    const press=await now();
    await page.locator(game==='lumen'?'[data-lumen-action="start"]':menuSelector).click();
    const canvas=game==='lumen'?'#lumenCanvas':'.sp-shell[data-mode="playing"] canvas';
    const alert=game==='lumen'?'#lumenSetupMount [role="alert"]':'.sp-loading[role="alert"]';
    await page.locator(`${canvas}, ${alert}`).first().waitFor({state:'visible',timeout:180000});
    if(await page.locator(alert).isVisible())throw Error(await page.locator(alert).innerText());
    if(game==='specimen'&&await page.locator('[data-sp-action="portrait"]').isVisible())await page.locator('[data-sp-action="portrait"]').click();
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const ready=await now();
    await page.keyboard.press('Escape');
    const after=await metric(),data=await snapshot();
    const delta=key=>((after[key]||0)-(before[key]||0))*1000;
    const row={label,from,menu,press,ready,menuMs:menu-from,clickToFrameMs:ready-press,totalMs:ready-from,
      taskMs:delta('TaskDuration'),scriptMs:delta('ScriptDuration'),layoutMs:delta('LayoutDuration'),
      data,network:network.slice(networkStart)};
    report.runs.push(row);
    await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,JSON.stringify(report,null,2));
    console.log(JSON.stringify({label,menuMs:Math.round(row.menuMs),clickToFrameMs:Math.round(row.clickToFrameMs),totalMs:Math.round(row.totalMs),taskMs:Math.round(row.taskMs)}));
    await page.screenshot({path:output.replace(/\.json$/,`-${label}.png`)});
  }
  try{
    await run('cold');
    if(mode==='all'){
      await run('same-page',{reenter:true});
      await run('reload',{reload:true});
    }
    if(game==='lumen')report.cpu=await page.evaluate(async()=>{
      const {createRun}=await import('/static/js/lumen/engine.mjs'),{Renderer}=await import('/static/js/lumen/renderer.mjs'),{loadArt}=await import('/static/js/lumen/assets.mjs');
      const art=await loadArt(),canvas=document.createElement('canvas');
      canvas.style.cssText='position:fixed;inset:0;width:375px;height:812px';document.body.append(canvas);
      const results=[];
      for(const map of ['garden','quarry','castle']){
        const samples=[];
        for(let n=0;n<12;n++){
          const a=performance.now(),state=createRun({seed:n+1,character:'scout',map}),b=performance.now(),renderer=new Renderer(canvas,art);renderer.resize();const c=performance.now();renderer.draw(state);const d=performance.now();renderer.destroy();
          samples.push({createRun:b-a,renderer:c-b,firstDraw:d-c});
        }
        results.push({map,samples});
      }
      canvas.remove();return results;
    });
  }catch(error){report.failure={phase:current,message:error.message};console.log(JSON.stringify({failure:report.failure}));}
  finally{
    report.unfinished=[...requests.values()];
    report.network=network;
    await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,JSON.stringify(report,null,2));
    await browser.close();
  }
  if(report.failure)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;});

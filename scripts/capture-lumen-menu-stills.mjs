/* Original map frames from the actual renderer. No HUD or game-save writes. */
import {writeFile,mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE});
try{
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
 const page=await context.newPage();
 await page.route('**/capture-map',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><style>*{margin:0}canvas{width:1440px;height:900px;display:block}</style><canvas width="1440" height="900"></canvas>'}));
 await page.goto((process.env.QA_ORIGIN||'http://127.0.0.1:8080')+'/capture-map');
 const output='webapp/frontend/assets/lumen/menu-backgrounds';await mkdir(output,{recursive:true});
 for(const map of ['garden','quarry','castle']){
  const data=await page.evaluate(async map=>{
   const {createRun}=await import('/static/js/lumen/engine.mjs'),{loadArt}=await import('/static/js/lumen/assets.mjs'),{Renderer}=await import('/static/js/lumen/renderer.mjs');
   const canvas=document.querySelector('canvas'),art=await loadArt({map,character:'scout'}),renderer=new Renderer(canvas,art);
   renderer.resize();const run=createRun({map,character:'scout',seed:61102});
   renderer.draw(run,true);const frame=canvas.toDataURL('image/webp',.88);renderer.destroy();
   if(!frame.startsWith('data:image/webp;'))throw Error('WebP encoder unavailable');return frame.split(',')[1];
  },map);
  const bytes=Buffer.from(data,'base64');await writeFile(output+'/'+map+'.webp',bytes);console.log(JSON.stringify({map,bytes:bytes.length}));
 }
}finally{await browser.close();}

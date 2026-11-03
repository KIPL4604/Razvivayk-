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
  const frames=await page.evaluate(async map=>{
   const {createRun}=await import('/static/js/lumen/engine.mjs'),{loadArt}=await import('/static/js/lumen/assets.mjs'),{Renderer}=await import('/static/js/lumen/renderer.mjs');
   const canvas=document.querySelector('canvas'),art=await loadArt({map,character:'scout'}),renderer=new Renderer(canvas,art);
   renderer.resize();const run=createRun({map,character:'scout',seed:61102});
   renderer.draw(run,true);
   const still=document.createElement('canvas');still.width=960;still.height=600;
   const pixels=still.getContext('2d');pixels.imageSmoothingEnabled=false;
   pixels.drawImage(canvas,0,0,still.width,still.height);
   const full=still.toDataURL('image/webp',.76);
   still.width=320;still.height=200;pixels.imageSmoothingEnabled=false;
   pixels.drawImage(canvas,0,0,still.width,still.height);
   const preview=still.toDataURL('image/webp',.60);renderer.destroy();
   if(!full.startsWith('data:image/webp;')||!preview.startsWith('data:image/webp;'))throw Error('WebP encoder unavailable');
   return {full:full.split(',')[1],preview:preview.split(',')[1]};
  },map);
  for(const [kind,data]of Object.entries(frames)){
   const bytes=Buffer.from(data,'base64'),suffix=kind==='preview'?'-preview':'';
   await writeFile(output+'/'+map+suffix+'.webp',bytes);console.log(JSON.stringify({map,kind,bytes:bytes.length}));
  }
 }
 const coin=await page.evaluate(async()=>{
  const atlas=new Image();atlas.src='/static/assets/lumen/arsenal.png';await atlas.decode();
  const icon=document.createElement('canvas');icon.width=icon.height=48;
  icon.getContext('2d').drawImage(atlas,336,144,48,48,0,0,48,48);
  return icon.toDataURL('image/png').split(',')[1];
 });
 await writeFile(output+'/../menu-coin.png',Buffer.from(coin,'base64'));
}finally{await browser.close();}

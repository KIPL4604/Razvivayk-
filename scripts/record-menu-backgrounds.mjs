const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
import {writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true,args:['--autoplay-policy=no-user-gesture-required']});
try{
 for(const game of process.argv[2]?[process.argv[2]]:['lumen','specimen']){
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
  const page=await context.newPage();
  await page.route('**/record-menu',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><style>*{margin:0}canvas{width:1280px;height:720px;display:block}</style><canvas width="1280" height="720"></canvas>'}));
  await page.goto('http://127.0.0.1:8080/record-menu');
  const output=path.resolve('webapp/frontend/assets',game);await mkdir(output,{recursive:true});
  const result=await page.evaluate(async game=>{
    const canvas=document.querySelector('canvas');let run,renderer,tick,draw;
    if(game==='lumen'){
      const engine=await import('/static/js/lumen/engine.mjs');
      const {loadArt}=await import('/static/js/lumen/assets.mjs');
      const {Renderer}=await import('/static/js/lumen/renderer.mjs');
      const art=await loadArt({map:'garden',character:'scout'});
      renderer=new Renderer(canvas,art);renderer.resize();
      run=engine.createRun({seed:61102,character:'scout',map:'garden'});
      run.upgrades={spark:4,pulse:3,orbit:3};
      tick=t=>{run.player.hp=run.player.maxHp;run.player.invulnerable=2;engine.step(run,{x:Math.cos(t*Math.PI*2/15),y:Math.sin(t*Math.PI*2/15)},1/60,renderer.captureTick);if(run.status==='upgrade')engine.chooseUpgrade(run,run.choices[0]);};
      draw=()=>renderer.draw(run,false);
      for(let i=0;i<1200;i++)tick(i/60);
    }else{
      const engine=await import('/static/js/specimen/engine.mjs');
      const {createRenderer}=await import('/static/js/specimen/renderer.mjs?v=9');
      renderer=await createRenderer(canvas);renderer.resize();
      run=engine.createRun();run.mass=85;
      tick=t=>{run.mass=Math.max(85,run.mass);engine.step(run,1/60,{x:Math.cos(t*Math.PI*2/15),y:Math.sin(t*Math.PI*2/15)*.4,aimX:Math.cos(t),aimY:Math.sin(t),grabbing:true,burst:false,interact:false,echo:false});};
      draw=()=>renderer.draw(run,performance.now());
      for(let i=0;i<180;i++)tick(i/60);
    }
    draw();
    const poster=canvas.toDataURL('image/jpeg',.85).split(',')[1];
    const stream=canvas.captureStream(24);
    const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:1500000});
    const chunks=[];recorder.ondataavailable=e=>chunks.push(e.data);
    const done=new Promise(resolve=>recorder.onstop=resolve);
    recorder.start();
    const start=performance.now();let simulated=0;
    await new Promise(resolve=>{
      const frame=now=>{
        const elapsed=Math.min(15,(now-start)/1000);
        while(simulated<elapsed){tick(simulated);simulated+=1/60;}
        draw();
        if(elapsed<15)requestAnimationFrame(frame);else resolve();
      };requestAnimationFrame(frame);
    });
    recorder.stop();await done;stream.getTracks().forEach(t=>t.stop());renderer.destroy?.();
    const bytes=new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer());
    let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    return {video:btoa(binary),poster,bytes:bytes.length,duration:15,game};
  },game);
  await writeFile(path.join(output,'menu-loop.webm'),Buffer.from(result.video,'base64'));
  await writeFile(path.join(output,'menu-poster.jpg'),Buffer.from(result.poster,'base64'));
  console.log(JSON.stringify({game,bytes:result.bytes,duration:result.duration}));
  await context.close();
 }
}finally{await browser.close();}

async page => {
  const origin='http://127.0.0.1:8081';
  const out='D:/Codex-artifacts';
  const context=await page.context().browser().newContext({viewport:{width:375,height:812},reducedMotion:'reduce'});
  const p=await context.newPage(),errors=[],requests=[];
  const check=(ok,message)=>{if(!ok)throw new Error(message);};
  p.on('pageerror',error=>errors.push(error.message));
  await context.route('https://telegram.org/**',route=>route.fulfill({body:'',contentType:'text/javascript'}));
  const start=async()=>{
    await p.locator('#campaignCards [data-lumen-action="open"]').click();
    await p.locator('.lumen-main-actions [data-lumen-value="play"]').click();
    await p.locator('[data-lumen-action="start"]').click();
  };
  const skip=async()=>{
    await p.locator('#lumenStory[data-phase="dialogue"] [data-story-action="skip"]').click();
    await p.locator('#lumenCanvas').waitFor();
  };
  const waitCached=async files=>{
    const deadline=Date.now()+30000;
    while(Date.now()<deadline){
      if(await p.evaluate(async files=>{
        const cache=await caches.open('teramont-lumen-assets-v1');
        const cached=new Set((await cache.keys()).map(r=>new URL(r.url).pathname.split('/assets/lumen/')[1]));
        return files.every(file=>cached.has(file));
      },files))return;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    throw new Error('Expected files did not reach the persistent cache');
  };
  let releaseOpening,releaseFuture,firstFuture;
  const opening=new Promise(resolve=>releaseOpening=resolve),future=new Promise(resolve=>releaseFuture=resolve);
  const futureStarted=new Promise(resolve=>firstFuture=resolve);
  try{
    await p.goto(origin);
    const keys=await p.evaluate(async()=>{
      const [{selectArtFiles},{worldScene}]=await Promise.all([import('/static/js/lumen/assets.mjs'),import('/static/js/lumen/story.mjs')]);
      const base='/static/assets/lumen/';
      const [manifest,menu]=await Promise.all(['manifest.json','menu-manifest.json'].map(async name=>(await fetch(base+name)).json()));
      const plan=map=>{
        const files=selectArtFiles(manifest,{map,character:'scout'});
        const packs=new Set(files.flatMap(([,e])=>e.chunks?.map(c=>c.pack)||[e.pack]));
        const scene=worldScene(map);
        const sceneNames=[`story-world-${map}.webp`,`story-world-${map}-small.webp`,`story-${scene.portrait}.png`];
        return [...manifest.packs.filter(e=>packs.has(e.file)),...[...menu.files,...menu.scenes].filter(e=>sceneNames.includes(e.file))].map(e=>e.file);
      };
      return {quarry:plan('quarry'),castle:plan('castle')};
    });
    const futureFiles=new Set([...keys.quarry,...keys.castle]);
    let holdFirst=true,holdOpening=true;
    await context.route(/\/assets\/lumen\/.*\?v=/,async route=>{
      const file=new URL(route.request().url()).pathname.split('/assets/lumen/')[1];
      requests.push(file);
      if(holdOpening&&/\.pack$/.test(file)){holdOpening=false;await opening;}
      if(holdFirst&&futureFiles.has(file)){holdFirst=false;firstFuture(file);await future;}
      await route.continue();
    });
    await start();
    await p.getByText('Спасибо, что ждёшь. Готовим мир для твоей экспедиции.',{exact:true}).waitFor();
    for(const [width,height] of [[375,812],[768,1024],[1440,900],[1920,1080]]){
      await p.setViewportSize({width,height});
      await p.screenshot({path:`${out}/lumen-world-warmup-${width}.png`});
      check(await p.locator('#lumenStory').evaluate(e=>e.scrollWidth<=e.clientWidth),'Loading text overflow at '+width);
    }
    check(!requests.some(file=>futureFiles.has(file)),'Future downloads started before gameplay');
    releaseOpening();await skip();
    const first=await Promise.race([futureStarted,p.waitForTimeout(30000).then(()=>{throw new Error('No future request during gameplay');})]);
    check(keys.quarry.includes(first),'The first request must prepare the quarry');
    await p.keyboard.press('Escape');
    await p.locator('#lumenOverlay [data-lumen-action="continue"]').waitFor();
    const before=requests.filter(file=>futureFiles.has(file)).length;
    releaseFuture();
    await waitCached([first]);
    check(requests.filter(file=>futureFiles.has(file)).length===before,'Another future request began during pause');
    await p.locator('#lumenOverlay [data-lumen-action="continue"]').click();
    await waitCached([...futureFiles]);
    const castleFirst=requests.findIndex(file=>keys.castle.includes(file)&&!keys.quarry.includes(file));
    check(keys.quarry.every(file=>requests.indexOf(file)>=0&&requests.indexOf(file)<castleFirst),'Castle began before quarry files ');
    const counts=requests.length;
    await p.reload();
    await p.evaluate(async()=>{
      const {normalizeMeta}=await import('/static/js/lumen/economy.mjs');
      saved.lumen={meta:normalizeMeta({clearedMaps:['garden']}),selection:{map:'quarry',character:'scout'}};
    });
    await start();await skip();
    check(await p.locator('#lumenGameMount').getAttribute('data-map')==='quarry','Quarry did not start');
    const repeated=requests.slice(counts).filter(file=>keys.quarry.includes(file));
    check(!repeated.length,'Cached quarry files were re-requested: '+repeated.join(', '));
    check(!errors.length,'Unexpected page errors: '+errors.join('; '));
    return {first,quarryFiles:keys.quarry.length,castleFiles:keys.castle.length,repeatedQuarryFiles:repeated.length,errors};
  }finally{releaseOpening();releaseFuture();await context.close();}
}

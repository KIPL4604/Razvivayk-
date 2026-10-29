async(page)=>{
 const browser=page.context().browser(),origin='http://127.0.0.1:8081',out='D:/Codex-artifacts/lumen-story-20261029',results=[];
 const assert=(ok,message)=>{if(!ok)throw Error(message);};
 const context=await browser.newContext({viewport:{width:375,height:812},hasTouch:true});
 await context.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));
 const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 async function setup(map='garden',mode='normal'){
  await p.goto(origin);
  await p.evaluate(async({map,mode})=>{
   const engine=await import('/static/js/lumen/engine.mjs'),{MAPS}=await import('/static/js/lumen/catalog.mjs'),{normalizeMeta}=await import('/static/js/lumen/economy.mjs');
   saved.lumen={meta:normalizeMeta({clearedMaps:['garden','quarry'],unlocked:['keeper']}),selection:{map,character:'keeper'}};
   if(mode!=='normal'){
    const s=engine.createRun({map,seed:81,character:'keeper',runId:'qa-story-'+map});
    if(mode.startsWith('guardian-')){
     const stage=Number(mode.slice(-1));s.time=stage*120-1/60;s.spawnedGuardians=stage-1;s.spawnTimer=3;engine.step(s,{},1/60);
    }else{
     s.level=MAPS[map].goal-1;s.xp=s.xpNext;engine.step(s,{},1/60);
     if(map==='castle'){
      const door=s.enemies.find(e=>e.kind==='castle-door');
      s.projectiles.push({id:s.nextId++,x:door.x,y:door.y,vx:0,vy:0,radius:4,damage:6000,life:1,weapon:'spark',hostile:false,pierce:0,hits:[],returning:false});engine.step(s,{},1/60);
      s.player.y=s.castle.hallY+500;engine.step(s,{},1/60);
     }
    }
    if(mode==='reward'){
     for(let n=0;n<155;n++)engine.step(s,{},1/60);
     const boss=s.enemies.find(e=>e.kind==='arena-boss');boss.hp=1;boss.fireTimer=4;boss.actionTimer=0;
     s.projectiles.push({id:s.nextId++,x:boss.x,y:boss.y,vx:0,vy:0,radius:4,damage:1,life:1,weapon:'spark',hostile:false,pierce:0,hits:[],returning:false});engine.step(s,{},1/60);
     s.player.x=s.arena.x;s.player.y=s.arena.y;engine.step(s,{},1/60);
    }
    const snapshot=engine.serialize(s);if(!engine.restore(snapshot))throw Error('Invalid QA checkpoint');saved.lumen.run=snapshot;
   }
  },{map,mode});
  await p.locator('[data-lumen-action="open"]').click();
  if(mode==='normal'){await p.locator('.lumen-menu-nav [data-lumen-value="play"]').click();await p.locator('[data-lumen-action="start"]').click();}
  else await p.locator('[data-lumen-action="resume"]').click();
  await p.locator('#lumenStory:not([hidden])').waitFor();
 }
 async function skip(){await p.locator('#lumenStory [data-story-action="skip"]').click();}
 try{
  await setup();await p.locator('.lumen-story-hero').tap();
  assert(await p.locator('#lumenStory').getAttribute('data-typing')==='false','touch must reveal the whole line');
  assert((await p.locator('#lumenStoryCount').innerText()).startsWith('01'),'revealing must not change the line');
  await p.locator('[data-story-action="advance"]').tap();assert((await p.locator('#lumenStoryCount').innerText()).startsWith('02'),'second tap advances');
  await p.keyboard.press('Enter');assert((await p.locator('#lumenStoryCount').innerText()).startsWith('02'),'keyboard reveals without skipping');
  await skip();await p.locator('#lumenCanvas').waitFor();await p.keyboard.press('Escape');await p.locator('#lumenOverlay [data-lumen-action="exit"]').click();
  results.push('native touch and keyboard reveal/advance, skip, real game, pause and exit');

  for(const map of ['garden','quarry','castle']){
   await setup(map,'boss');await skip();await p.locator('#lumenOverlay [data-lumen-action="continue"]').click();
   await p.locator('#lumenStory[data-phase="dialogue"]:not([hidden])').waitFor();
   const title=await p.locator('#lumenStoryTitle').innerText(),before=await p.locator('#lumenTimer').innerText(),hp=await p.locator('#lumenHealth').innerText();
   await p.waitForTimeout(400);assert(await p.locator('#lumenTimer').innerText()===before,'simulation clock runs under boss dialogue');assert(await p.locator('#lumenHealth').innerText()===hp,'health changed under dialogue');
   await p.locator('[data-story-action="advance"]').click();await p.screenshot({path:out+'/iteration2-'+map+'-before-boss-375.png'});
   await skip();await p.waitForTimeout(950);await p.screenshot({path:out+'/iteration2-'+map+'-arena-375.png'});await p.keyboard.press('Escape');
   const seen=await p.evaluate(()=>saved.lumen.story.seen);assert(seen.some(id=>id.startsWith('boss:')),'boss scene acknowledgement was not saved');
   await p.reload();await p.locator('[data-lumen-action="open"]').click();await p.locator('[data-lumen-action="resume"]').click();await skip();await p.locator('#lumenOverlay [data-lumen-action="continue"]').click();
   await p.waitForTimeout(150);assert(await p.locator('#lumenStory').isHidden(),'acknowledged boss dialogue repeats after reload');await p.keyboard.press('Escape');
   results.push({map,title,paused:true,reloadWithoutRepeat:true});
  }

  for(const stage of [1,2]){
    await setup('quarry','guardian-'+stage);await skip();await p.locator('#lumenOverlay [data-lumen-action="continue"]').click();
    await p.locator('#lumenStory:not([hidden])').waitFor();
    const title=await p.locator('#lumenStoryTitle').innerText();assert(title===(stage===1?'Буровой голем':'Резонатор глубин'),'wrong quarry guardian');
    await p.locator('[data-story-action="advance"]').click();await p.screenshot({path:out+'/iteration2-quarry-guardian-'+stage+'-375.png'});await skip();await p.keyboard.press('Escape');
    results.push({quarryGuardian:stage,title});
  }

  await setup('garden','reward');await skip();await p.locator('#lumenOverlay [data-lumen-action="continue"]').click();
  await p.locator('#lumenStoryTitle').filter({hasText:'Дорога продолжается'}).waitFor();
  assert(await p.evaluate(()=>saved.lumen.stats.wins===1),'victory must be recorded before epilogue finishes');
  await p.evaluate(()=>showScreen('home'));assert(await p.evaluate(()=>saved.lumen.stats.wins===1&&saved.lumen.run===null),'external navigation lost terminal statistics');
  results.push('post-boss story and victory survive external navigation during epilogue');

  await p.emulateMedia({reducedMotion:'reduce'});await setup('quarry');
  assert(await p.locator('#lumenStory').getAttribute('data-typing')==='false','reduced motion should show the full text');
  await p.locator('[data-story-action="cancel"]').click();assert(await p.locator('#lumenStory').isHidden(),'cancel did not close intro');
  assert(await p.evaluate(()=>!document.querySelector('#lumenSetupMount').inert),'cancel leaked inert state');
  results.push('reduced motion and cancelled launch restore menu interaction');
  assert(!errors.length,'JavaScript errors: '+JSON.stringify(errors));
  return {results,errors,checkpointScope:'Boss/reward scenes use explicitly prepared valid snapshots in a fresh isolated context; opening and controls use the real app.'};
 }finally{await context.close();}
}

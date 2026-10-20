async (page) => {
  // Run with Playwright against the isolated tests/serve_qa.py fixture only.
  const base='http://127.0.0.1:8081',out='C:/Users/1234567890/Desktop/PHANTOM_PROJECTS_COLLECTED_2026-09-20/01 Проекты/01 В работе/Развивайка — Teramont/output/playwright/';
  const assert=(value,message)=>{if(!value)throw Error(message);};
  const browser=page.context().browser(),context=await browser.newContext({viewport:{width:375,height:812},hasTouch:true}),p=await context.newPage();
  const errors=[],requests=[],results=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));
  const settle=async()=>{await p.evaluate(async()=>{await Promise.all(document.getAnimations().filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});};
  const capture=async name=>{await settle();await p.screenshot({path:out+name+'.png'});};
  const saveRecord=()=>p.evaluate(()=>JSON.parse(JSON.stringify(saved.lumen)));
  async function seed(kind){
    await p.evaluate(async kind=>{
      showScreen('home');
      const core=await import('/static/js/lumen/engine.mjs');let run=core.createRun({seed:1});
      if(kind==='scene'){
        // Explicit visual fixture; full legal playthroughs live in lumen-engine.mjs.
        run.time=125;run.spawnedGuardians=1;run.spawnedElites=1;run.spawnTimer=3;
        run.level=10;run.xpNext=(await import('/static/js/lumen/progression.mjs')).xpForLevel(10);
        run.player.y=85;run.upgrades={spark:3,orbit:2,pulse:2};run.foundWeapons=['orbit','pulse'];
        run.enemies=Array.from({length:12},(_,i)=>({id:50+i,kind:i%3?'mote':'beetle',
          x:Math.cos(i*2.4)*(160+i*12),y:85+Math.sin(i*2.4)*(160+i*12),
          hp:150,maxHp:150,radius:i%3?10:16,speed:24,damage:7,value:12,
          phase:0,hitFlash:0,guardianStage:0,fireTimer:3}));run.nextId=1000;
      }else if(kind==='upgrade'){run.xp=run.xpNext;core.step(run,{},1/60);}
      else if(kind==='won'){run.level=29;run.xp=run.xpNext;}
      else if(kind==='lost'){run.player.hp=1;run.enemies=[{id:1,x:0,y:0,kind:'mote',hp:100,maxHp:100,radius:10,speed:0,damage:7,value:2,phase:0,hitFlash:0,guardianStage:0,fireTimer:3}];run.nextId=2;}
      saved.lumen||={};saved.lumen.run=core.serialize(run);saved.lumen.lastTouchedAt=Date.now();saveState();
    },kind);
    await p.reload();await p.locator('[data-resume="lumen"]').click();
    if(kind!=='upgrade')await p.locator('[data-lumen-action="continue"]').click();
  }
  try{
    await p.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));await p.goto(base);await p.locator('#campaignCards [data-lumen-action="open"]').waitFor();
    assert(!requests.some(u=>u.includes('/lumen/engine.mjs')||u.includes('/lumen/game.mjs')),'Game downloaded before opening');
    assert(await p.locator('#campaignCards button').count()===13,'Catalogue count');
    await capture('lumen-library-375-iteration2');
    await p.locator('[data-lumen-action="open"]').click();await p.locator('#lumenTitle').waitFor();
    for(const [width,height] of [[375,812],[768,1024],[1440,900],[1920,1080]]){
      await p.setViewportSize({width,height});await settle();
      await capture(`lumen-setup-${width}-iteration2`);
      assert(await p.evaluate(()=>document.querySelector('#main').scrollWidth<=document.querySelector('#main').clientWidth),'Setup overflow '+width);
      if(width===375){await p.locator('.lumen-menu-nav [data-lumen-value="play"]').click();const box=await p.locator('[data-lumen-action="start"]').boundingBox();assert(box.y+box.height<738,'Mobile launch below fold');await p.keyboard.press('Escape');}
    }
    results.push('lazy loading, 13 games, setup at four widths, mobile start visible');
    await p.setViewportSize({width:375,height:812});
    await p.locator('.lumen-menu-nav [data-lumen-value="weapons"]').click();await p.evaluate(()=>document.querySelector('#lumenMenuContent').scrollTop=250);await p.setViewportSize({width:375,height:780});
    assert(await p.evaluate(()=>document.querySelector('#lumenMenuContent').scrollTop)>=240,'Resize reset menu scroll');await p.setViewportSize({width:375,height:812});
    await p.locator('.lumen-menu-nav [data-lumen-value="characters"]').click();
    await p.locator('[data-lumen-action="character"][data-lumen-value="keeper"]').click();await p.locator('.lumen-menu-nav [data-lumen-value="play"]').click();
    await p.locator('[data-lumen-action="start"]').click();await p.locator('#lumenCanvas').waitFor();
    await p.keyboard.down('KeyD');await p.waitForTimeout(700);await p.keyboard.up('KeyD');await p.keyboard.press('Escape');
    const first=await saveRecord();assert(first.run.character==='keeper'&&first.run.player.maxHp===145,'Character choice ignored');assert(first.run.player.x>40,'Keyboard movement');
    const pausedClock=await p.locator('#lumenTimer').innerText();await p.waitForTimeout(250);assert(await p.locator('#lumenTimer').innerText()===pausedClock,'Pause did not freeze');
    const modalButtons=p.locator('#lumenOverlay button,#lumenOverlay summary');await modalButtons.last().focus();await p.keyboard.press('Tab');assert(await modalButtons.first().evaluate(e=>e===document.activeElement),'Focus escaped dialog');
    await p.locator('#lumenOverlay [data-lumen-action="sound"]').click();assert((await saveRecord()).settings.sound,'Mobile sound inaccessible');
    await p.locator('[data-lumen-action="continue"]').click();
    const cdp=await context.newCDPSession(p);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:180,y:500}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:265,y:500}]});
    await p.waitForTimeout(650);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await p.mouse.wheel(0,500);await p.keyboard.press('Escape');
    const second=await saveRecord();assert(second.run.player.x>first.run.player.x+40,'Touch joystick did not move');
    assert(await p.evaluate(()=>scrollY===0&&document.querySelector('#main').scrollTop===0&&document.documentElement.classList.contains('lumen-active')),'Arena scrolled');
    await p.locator('[data-lumen-action="exit"]').click();assert(await p.locator('.lumen-shell').isVisible(),'Missing game menu');await p.locator('[data-lumen-action="catalog"]').click();assert(await p.evaluate(()=>!document.documentElement.classList.contains('lumen-active')),'Scroll lock leaked');
    await p.mouse.move(180,450);await p.mouse.wheel(0,500);await p.waitForTimeout(100);assert(await p.evaluate(()=>document.querySelector('#main').scrollTop)>0,'Catalog scroll not restored');
    results.push('keeper, keyboard and actual CDP touch, pause, focus trap, sound, scroll lock/release');
    await p.reload();await p.locator('[data-resume="lumen"]').click();await p.locator('[data-lumen-action="continue"]').waitFor();
    assert(Math.abs((await saveRecord()).run.player.x-second.run.player.x)<3,'Resume position lost');
    await p.locator('[data-lumen-action="continue"]').click();
    await p.evaluate(()=>window.dispatchEvent(new Event('blur')));await p.locator('[data-lumen-action="continue"]').waitFor();
    assert(await p.getByRole('dialog').isVisible(),'Blur did not pause');
    await p.locator('[data-lumen-action="continue"]').click();
    await p.locator('[data-lumen-action="fullscreen"]').click();await p.waitForFunction(()=>!!document.fullscreenElement);
    assert(await p.evaluate(()=>!!document.fullscreenElement),'Browser fullscreen failed');
    await p.evaluate(()=>document.exitFullscreen());await p.locator('[data-lumen-action="continue"]').waitFor();
    results.push('reload resume, blur pause, actual browser fullscreen and exit pause');
    // Regression: inactive Lumen must not displace the latest puzzle from resume.
    await p.locator('[data-lumen-action="exit"]').click();
    await p.evaluate(()=>{showScreen('home');startGame('sudoku','easy',1);});
    await p.waitForFunction(()=>activeScreen==='game'&&!!saved.current);
    const touched=await p.evaluate(()=>saved.lumen.lastTouchedAt);
    await p.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
    assert(await p.evaluate(()=>saved.lumen.lastTouchedAt)===touched,'Inactive game stole resume timestamp');
    assert(await p.locator('#gameMount .sudoku-cell').count()===81,'Sudoku regression');
    await p.evaluate(()=>showScreen('home'));assert(await p.locator('[data-resume="sudoku"]').count()===1,'Latest puzzle not resumed');
    results.push('Sudoku integration and inactive pagehide regression');
    await seed('scene');
    for(const [width,height] of [[375,812],[768,1024],[1440,900],[1920,1080]]){
      await p.setViewportSize({width,height});await p.waitForTimeout(100);
      await capture(`lumen-arena-${width}-iteration2`);
      const rect=await p.locator('#lumenCanvas').boundingBox();assert(Math.abs(rect.width-width)<2&&Math.abs(rect.height-height)<2,'Arena viewport mismatch '+width);
    }
    await p.keyboard.press('Escape');await p.setViewportSize({width:812,height:375});
    await p.waitForFunction(()=>document.querySelector('#lumenCanvas').getBoundingClientRect().height===375);
    const rect=await p.locator('#lumenCanvas').boundingBox();assert(rect.width===812&&rect.height===375,'Landscape resize');
    await capture('lumen-landscape-pause-iteration2');
    results.push('deterministic visual fixture, four arena widths, landscape pause');
    await p.setViewportSize({width:375,height:812});await seed('upgrade');
    await capture('lumen-upgrade-375-iteration2');
    const upgraded=await saveRecord(),id=upgraded.run.choices[0],beforeRank=upgraded.run.upgrades[id]||0;await p.locator(`[data-lumen-action="upgrade"][data-lumen-value="${id}"]`).click();
    await p.keyboard.press('Escape');assert((await saveRecord()).run.upgrades[id]===beforeRank+1,'Upgrade did not apply');
    await p.emulateMedia({reducedMotion:'reduce'});await p.reload();await p.locator('[data-resume="lumen"]').click();
    assert(await p.evaluate(()=>matchMedia('(prefers-reduced-motion:reduce)').matches),'Reduced motion unavailable');
    assert(await p.evaluate(()=>!document.getAnimations().some(a=>a.effect.getTiming().iterations===Infinity)),'Unbounded reduced motion animation');
    results.push('upgrade choice persisted, reduced motion');
    await seed('won');await p.waitForSelector('#lumenDialogTitle');assert(await p.locator('#lumenDialogTitle').innerText()==='Биосад пройден','Victory result');
    await capture('lumen-victory-375-iteration2');const stats=await saveRecord();await p.waitForTimeout(200);assert((await saveRecord()).stats.runs===stats.stats.runs,'Result counted twice');
    await seed('lost');await p.waitForSelector('#lumenDialogTitle');assert(await p.locator('#lumenDialogTitle').innerText()==='Новая ночь. Новый шанс.','Defeat result');
    await capture('lumen-defeat-375-iteration2');
    assert((await saveRecord()).run===null,'Finished run still resumable');
    results.push('victory/defeat DOM, result counted once, finished save cleared');
    await p.evaluate(()=>{showScreen('home');saved.lumen.run={version:99,status:'playing'};saveState();});await p.reload();await p.locator('[data-resume="lumen"]').click();await p.locator('.lumen-shell').waitFor();
    assert((await saveRecord()).run===null,'Corrupt save not cleared');results.push('corrupt save safely reset');
    assert(errors.length===0,'Page errors: '+errors.join('; '));
    return {results,pageErrors:errors,screenshots:out};
  }catch(error){throw Error(`After [${results.join(' | ')}]: ${error.message}`);}finally{await context.close();}
}

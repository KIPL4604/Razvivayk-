async (page)=>{
  const iteration='v3',root='C:/Users/1234567890/Desktop/PHANTOM_PROJECTS_COLLECTED_2026-09-20/01 Проекты/01 В работе/Развивайка — Teramont/';
  const c=await page.context().browser().newContext({viewport:{width:1440,height:900},hasTouch:true}),p=await c.newPage();
  const errors=[],badAssets=[],checks=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().includes('/assets/lumen/')&&r.status()>=400)badAssets.push(r.url());});
  // Ordinary desktop-browser QA; physical Telegram is a separate gate.
  await p.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));
  const assert=(ok,msg)=>{if(!ok)throw Error(msg);};
  const nav=id=>p.locator(`.lumen-menu-nav [data-lumen-value="${id}"]`).click();
  const shot=name=>p.screenshot({path:root+`output/playwright/lumen-menu-${name}-${iteration}.png`});
  try{
    await p.goto('http://127.0.0.1:8081');
    await p.evaluate(()=>{showScreen('home');saved.lumen={meta:{coins:1000,weaponBest:{chakram:8},clearedMaps:['garden']}};saveState();});await p.reload();
    await p.locator('[data-lumen-action="open"]').click();await p.locator('.lumen-shell').waitFor();
    assert(await p.locator('.lumen-menu-nav button').count()===5,'Five menu sections');
    assert(await p.locator('#lumenGameMount:visible').count()===0,'Opening game started combat');
    for(const [width,height]of [[1440,900],[375,812],[768,1024],[1920,1080]]){
      await p.setViewportSize({width,height});
      for(const section of ['home','play','characters','weapons','training','settings']){
        await p.evaluate(()=>LumenMode.enter());if(section!=='home')await nav(section);
        await p.evaluate(()=>document.fonts.ready);await shot(`${section}-${width}`);
        const fit=await p.evaluate(()=>{const shell=document.querySelector('.lumen-shell').getBoundingClientRect(),content=document.querySelector('#lumenMenuContent');
          return {w:shell.width,h:shell.height,overflow:document.documentElement.scrollWidth>innerWidth||content.scrollWidth>content.clientWidth+1,
            small:[...document.querySelectorAll('.lumen-shell button')].filter(e=>getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().height<44).map(e=>e.textContent),
            outside:[...document.querySelectorAll('button')].filter(e=>!e.closest('.lumen-shell')&&e.getBoundingClientRect().width&&getComputedStyle(e).visibility!=='hidden').map(e=>e.textContent.slice(0,30))};});
        assert(fit.w===width&&fit.h===height&&!fit.overflow&&!fit.small.length&&!fit.outside.length,'Menu fit '+section+' '+width+' '+JSON.stringify(fit));checks.push({section,width});
      }
    }
    await p.setViewportSize({width:375,height:812});await nav('weapons');assert(await p.locator('.lumen-library article').count()===10,'Ten base weapons');
    await p.locator('[data-lumen-action="book"][data-lumen-value="hybrids"]').click();assert(await p.locator('.lumen-recipes-list article').count()===4,'Four recipes');await shot('hybrids-375');
    await p.locator('[data-lumen-action="book"][data-lumen-value="artifacts"]').click();assert(await p.locator('.lumen-library article').count()===4,'Four artifacts');
    await nav('characters');assert(await p.locator('.lumen-roster button').count()===8,'Eight characters');
    await p.locator('[data-lumen-action="character"][data-lumen-value="artificer"]').click();assert(await p.locator('[data-lumen-action="buy"]').isEnabled(),'Weapon mastery purchase');
    await p.locator('[data-lumen-action="buy"]').click();assert(await p.locator('#lumenWallet').innerText()==='460','Exact hero cost');
    await nav('play');await p.locator('[data-lumen-action="map"][data-lumen-value="quarry"]').click();
    const start=await p.locator('[data-lumen-action="start"]').boundingBox(),navbar=await p.locator('.lumen-menu-nav').boundingBox();
    await shot('departure-selected-375');assert(start.y+start.height<=navbar.y,'Mobile start below menu '+JSON.stringify({start,navbar}));checks.push({mobileStartBottom:start.y+start.height,navbarTop:navbar.y});
    await p.locator('[data-lumen-action="start"]').click();await p.keyboard.down('d');await p.waitForTimeout(300);await p.keyboard.up('d');await p.keyboard.press('Escape');
    const before=await p.evaluate(()=>JSON.parse(JSON.stringify(saved.lumen.run)));assert(before.character==='artificer'&&before.map==='quarry'&&before.player.x>15&&before.version===6,'Real run from menu');
    await p.locator('[data-lumen-action="exit"]').click();assert(await p.locator('.lumen-shell').getAttribute('data-page')==='home','Pause did not return to game menu');
    await nav('training');await p.locator('[data-lumen-action="train"][data-lumen-value="vigor"]').click();
    assert(await p.evaluate(()=>saved.lumen.meta.coins===410&&saved.lumen.meta.training.vigor===1),'Training spend');
    await nav('settings');await p.locator('.lumen-shell [data-lumen-action="fullscreen"]').click();await p.waitForFunction(()=>!!document.fullscreenElement);await p.locator('.lumen-shell [data-lumen-action="fullscreen"]').click();await p.waitForFunction(()=>!document.fullscreenElement);await p.locator('.lumen-shell [data-lumen-action="sound"]').click();await p.locator('#lumenVolume').focus();await p.keyboard.press('Home');for(let i=0;i<7;i++)await p.keyboard.press('ArrowRight');
    assert(await p.evaluate(()=>saved.lumen.settings.sound&&saved.lumen.settings.volume===35),'Sound/volume keyboard');
    await p.reload();await p.locator('[data-lumen-action="open"]').click();
    assert(await p.evaluate(()=>saved.lumen.meta.training.vigor===1&&saved.lumen.settings.volume===35&&saved.lumen.selection.character==='artificer'&&saved.lumen.selection.map==='quarry'),'Menu persistence');
    await p.locator('[data-lumen-action="resume"]').click();
    // restore omits transient rendering flags; compare canonical simulation saves.
    const resumed=await p.evaluate(()=>saved.lumen.run),canonical=await p.evaluate(async before=>{const core=await import('/static/js/lumen/engine.mjs');return core.serialize(core.restore(before));},before);assert(JSON.stringify(resumed)===JSON.stringify(canonical),'Menu purchase changed active snapshot');
    await p.locator('[data-lumen-action="continue"]').click();await p.waitForTimeout(100);await p.keyboard.press('Escape');
    assert(await p.evaluate(()=>saved.lumen.run.player.maxHp===115&&saved.lumen.run.training.vigor===0),'Resume applied new training');
    await p.locator('[data-lumen-action="exit"]').click();await nav('play');p.once('dialog',d=>d.accept());await p.locator('[data-lumen-action="start"]').click();await p.keyboard.press('Escape');
    assert(await p.evaluate(()=>saved.lumen.run.player.maxHp===117&&saved.lumen.run.training.vigor===1),'Next run missing +2 HP');
    await p.locator('[data-lumen-action="exit"]').click();await nav('settings');await p.keyboard.press('Escape');assert(await p.locator('.lumen-shell').getAttribute('data-page')==='home','Escape to game home');
    await p.keyboard.press('Escape');assert(await p.evaluate(()=>activeScreen==='home'&&!document.documentElement.classList.contains('lumen-active')),'Catalog exit scroll lock');
    await p.evaluate(()=>{saved.lumen.meta.coins=0;saveState();});await p.reload();await p.locator('[data-lumen-action="open"]').click();await nav('training');assert(await p.locator('[data-lumen-action="train"]:enabled').count()===0,'Cannot afford training');await shot('empty-wallet-375');
    await p.evaluate(()=>{saved.lumen.meta.coins=999;saved.lumen.meta.training={vigor:5,lens:5,drive:5,compass:5};saveState();});await p.reload();await p.locator('[data-lumen-action="open"]').click();await nav('training');assert(await p.locator('[data-lumen-action="train"]:disabled').count()===4,'Max ranks');await shot('max-training-375');
    await p.emulateMedia({reducedMotion:'reduce'});await p.keyboard.press('Escape');await shot('reduced-375');
    assert(await p.evaluate(()=>!document.getAnimations().some(a=>a.effect.getTiming().iterations===Infinity)),'Reduced motion');
    assert(!errors.length&&!badAssets.length,JSON.stringify({errors,badAssets}));return {iteration,checks,flow:'Hero purchase, start, pause/menu, permanent rank, sound/volume, reload, unchanged resume, new-run bonus, back, empty/max, reduced motion',errors,badAssets};
  }finally{await c.close();}
}

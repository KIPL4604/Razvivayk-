async(page)=>{
 const root='C:/Users/1234567890/Desktop/PHANTOM_PROJECTS_COLLECTED_2026-09-20/01 Проекты/01 В работе/Развивайка — Teramont/output/playwright/game-menus-20261102';
 const context=await page.context().browser().newContext({viewport:{width:1440,height:900},hasTouch:true});
 const p=await context.newPage(),errors=[],missing=[],checks=[];
 p.on('pageerror',e=>errors.push(e.message));
 p.on('response',r=>{if(r.status()>=400&&r.url().includes('/static/'))missing.push(r.status()+' '+r.url());});
 const assert=(ok,message)=>{if(!ok)throw Error(message);checks.push(message);};
 const shot=async name=>{await p.waitForTimeout(450);await p.screenshot({path:root+'/'+name+'-i2.png'});};
 const fit=async name=>{const bad=await p.evaluate(()=>[...document.querySelectorAll('.screen.active,.lumen-game-window,.sp-panel')].filter(e=>e.getClientRects().length).filter(e=>{const r=e.getBoundingClientRect();return r.left<-.5||r.right>innerWidth+.5||(e.matches('.lumen-game-window,.sp-panel')&&(r.top<-.5||r.bottom>innerHeight+.5));}).map(e=>e.className));assert(!bad.length,name+' fits '+bad.join(','));};
 const home=async()=>{await p.evaluate(()=>showScreen('home'));};
 const closeLumen=async()=>{await p.waitForFunction(()=>!document.querySelector('.menu-motion-layer')); if(await p.locator('#app .lumen-game-window').count())await p.locator('#app .lumen-window-toolbar button').click();};
 const menu=async id=>{await closeLumen();await p.locator('#app .lumen-title-screen [data-lumen-value="'+id+'"]').click();await p.waitForTimeout(450);};
 try{
  await p.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));
  await p.goto('http://127.0.0.1:8080/',{waitUntil:'domcontentloaded'});
  for(const [width,height]of [[375,812],[768,1024],[1440,900],[1920,1080]]){
    await p.setViewportSize({width,height});
    for(const theme of ['dark','light']){
      await p.evaluate(t=>MenuUI.set('theme',t),theme);await home();await shot('hub-'+theme+'-'+width);await fit('hub '+theme+' '+width);
    }
    await p.locator('.bottom-nav [data-screen-link="profile"]').click();await shot('profile-'+width);await fit('profile '+width);
    await p.locator('[data-hub-document="privacy"]').click();await shot('legal-'+width);await fit('legal '+width);await p.keyboard.press('Escape');
    await home();await p.locator('#app [data-lumen-action="open"]').click();await p.locator('#app .lumen-title-screen').waitFor();await shot('lumen-'+width);await fit('lumen '+width);
    const center=await p.locator('#app .lumen-main-actions').boundingBox();assert(Math.abs(center.x+center.width/2-width/2)<2,'Lumen actions centered '+width);
    for(const id of ['play','characters','weapons','training','settings']){await menu(id);await fit(id+' '+width);if(['characters','settings'].includes(id))await shot('lumen-'+id+'-'+width);const r=await p.locator('#app .lumen-game-window').boundingBox();assert(r.width<width*.92&&r.height<height*.86,'Compact '+id+' '+width);}
    await closeLumen();await p.locator('#app [data-lumen-action="catalog"]').click();
    await p.locator('#app [data-sp-action="open"]').click();await p.locator('#app .sp-panel').waitFor();await shot('specimen-'+width);await fit('specimen '+width);
    await p.locator('#app [data-sp-action="settings"]').click();await shot('specimen-settings-'+width);await fit('specimen settings '+width);
    const h=await p.locator('#app .sp-panel h1').evaluate(e=>parseFloat(getComputedStyle(e).fontSize));assert(h<=28,'Specimen window type '+width);
    await p.locator('#app [data-sp-action="help"]').click();await shot('specimen-help-'+width);await fit('specimen help '+width);
    await p.locator('#app [data-sp-action="help-back"]').first().click();await p.locator('#app [data-sp-action="exit"]').click();
  }
  await p.setViewportSize({width:375,height:812});await p.locator('#hubSearch').fill('неттакойигры');assert(await p.locator('#hubSearchEmpty').isVisible(),'Empty search');await p.locator('#hubSearch').fill('люмен');assert(await p.locator('#campaignCards>.campaign-card:visible').count()===1,'Search narrows catalog');await p.locator('#hubSearch').fill('');
  await p.locator('.bottom-nav [data-screen-link="profile"]').click();
  for(const id of ['privacy','terms','storage','licenses']){await p.locator('[data-hub-document="'+id+'"]').click();assert(await p.locator('.hub-document').evaluate(d=>d.open),'Legal '+id);await p.keyboard.press('Escape');}
  await p.locator('.header-actions [data-screen-link="help"]').click();for(const id of ['lumen','specimen','progress']){await p.locator('[data-hub-document="'+id+'"]').click();assert(await p.locator('.hub-document').evaluate(d=>d.open),'Article '+id);await p.locator('[data-document-close]').click();}
  await p.setViewportSize({width:1440,height:900});await home();await p.locator('#app [data-lumen-action="open"]').click();await p.locator('#app .lumen-title-screen').waitFor();
  await menu('characters');await p.locator('#app [data-lumen-action="character"][data-lumen-value="alchemist"]').click();assert(await p.locator('#app [data-lumen-action="buy"]').isDisabled(),'Unavailable hero cannot be bought');
  await menu('settings');const sound=await p.locator('#app [data-lumen-action="sound"]').getAttribute('aria-pressed');await p.locator('#app [data-lumen-action="sound"]').click();assert(await p.locator('#app [data-lumen-action="sound"]').getAttribute('aria-pressed')!==sound,'Lumen sound setting');
  await p.locator('#lumenVolume').fill('35');assert(await p.evaluate(()=>saved.lumen.settings.volume===35),'Volume persists');
  await p.keyboard.press('Tab');for(let i=0;i<15;i++){await p.keyboard.press('Tab');assert(await p.evaluate(()=>!!document.activeElement.closest('[role="dialog"]')),'Lumen focus contained '+i);}
  await menu('characters');await p.locator('#app [data-lumen-action="character"][data-lumen-value="scout"]').click();await menu('play');await p.locator('#app [data-lumen-action="start"]').click();
  await p.locator('[data-story-action="skip"]').waitFor();await p.locator('[data-story-action="skip"]').click();await p.locator('#lumenCanvas').waitFor({state:'visible',timeout:30000});
  await p.keyboard.down('d');await p.waitForTimeout(450);await p.keyboard.up('d');await p.keyboard.press('Escape');await p.locator('#app [data-lumen-action="continue"]').waitFor();assert(await p.evaluate(()=>saved.lumen.run.player.x!==0),'Lumen battle movement saved');await shot('lumen-battle-paused');await p.locator('#app [data-lumen-action="exit"]').click();await p.locator('#app [data-lumen-action="catalog"]').click();
  await p.locator('#app [data-sp-action="open"]').click();await p.locator('#app [data-sp-action="start"]').click();const before=await p.evaluate(()=>SpecimenMode.snapshot().x);await p.keyboard.down('d');await p.waitForTimeout(450);await p.keyboard.up('d');assert(await p.evaluate(()=>SpecimenMode.snapshot().x)>before+10,'Specimen movement');await p.keyboard.press('Escape');await shot('specimen-battle-paused');const time=await p.evaluate(()=>SpecimenMode.snapshot().time);await p.waitForTimeout(100);assert(await p.evaluate(()=>SpecimenMode.snapshot().time)===time,'Specimen pause');await p.locator('#app [data-sp-action="title"]').click();assert(await p.locator('#app [data-sp-action="resume"]').count()===1,'Specimen resume');await p.locator('#app [data-sp-action="exit"]').click();
  await p.emulateMedia({reducedMotion:'reduce'});await p.locator('#app [data-lumen-action="open"]').click();await p.locator('video.lumen-menu-reel').waitFor();assert(await p.locator('video.lumen-menu-reel').evaluate(v=>v.paused),'Reduced motion pauses video');assert(await p.locator('html').getAttribute('data-menu-motion')==='off','Reduced motion disables transitions');
  assert(!errors.length,'No browser errors '+errors.join('; '));assert(!missing.length,'No missing assets '+missing.join('; '));return {checks:checks.length,errors,missing};
 }finally{await context.close();}
}

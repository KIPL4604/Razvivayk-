async (page)=>{
 const root='C:/Users/1234567890/Desktop/PHANTOM_PROJECTS_COLLECTED_2026-09-20/01 Проекты/01 В работе/Развивайка — Teramont/';
 const base=process.env.SPECIMEN_QA_URL||'http://127.0.0.1:8080',iteration=process.env.SPECIMEN_QA_ITERATION||'v2',browser=page.context().browser(),checks=[],errors=[],assets=[];
 const assert=(v,m)=>{if(!v)throw Error(m);};
 async function setup(options={}){const c=await browser.newContext({viewport:{width:1440,height:900},...options}),p=await c.newPage();p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().includes('/assets/specimen/')&&r.status()>=400)assets.push(r.status());});await p.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));await p.goto(base,{waitUntil:'domcontentloaded'});return {c,p};}
 const shot=(p,name)=>p.screenshot({path:root+`output/playwright/specimen-${name}-${iteration}.png`});
 async function fixture(p,room,mass,x,y,status='playing'){
   console.log('Fixture',room,mass,x,y);
   await p.evaluate(async ({room,mass,x,y,status})=>{const m=await import('/static/js/specimen/engine.mjs');const raw={...m.serialize(m.createRun()),room,mass,x,y,status};saved.specimen={run:raw,checkpoint:raw,settings:{sound:false}};saveState();SpecimenMode.enter();},{room,mass,x,y,status});
   await p.locator('[data-sp-action="resume"]').waitFor();await p.locator('[data-sp-action="resume"]').click();
   if(await p.locator('.sp-rotate').isVisible())await p.locator('[data-sp-action="portrait"]').click();
 }
 async function mouseAt(p,x,y){const point=await p.evaluate(({x,y})=>{const s=SpecimenMode.snapshot(),r=document.querySelector('.sp-canvas').getBoundingClientRect();return{x:r.x+(x-s.metrics.cameraX+s.metrics.width/2)/s.metrics.width*r.width,y:r.y+(y-s.metrics.cameraY+s.metrics.height/2)/s.metrics.height*r.height};},{x,y});await p.mouse.move(point.x,point.y);}
 {
  const {c,p}=await setup();try{
   assert(await p.locator('.specimen-catalog').count()===1,'New catalog entry');
   assert(await p.locator('#campaignCards button').count()===Number(await p.locator('.library-count strong').innerText()),'Catalog header count');
   await p.locator('[data-sp-action="open"]').click();await p.locator('.sp-panel h1').waitFor();
   for(const [width,height] of [[375,812],[768,1024],[1440,900],[1920,1080]]){
    await p.setViewportSize({width,height});await p.evaluate(()=>document.fonts.ready);await shot(p,`menu-${width}`);
    const fit=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,small:[...document.querySelectorAll('.sp-panel button')].filter(e=>e.getBoundingClientRect().height<44).length,w:document.querySelector('.sp-shell').getBoundingClientRect().width}));
    assert(!fit.overflow&&!fit.small&&fit.w===width,'Menu fit '+width+' '+JSON.stringify(fit));
   }
   await p.setViewportSize({width:1440,height:900});await p.keyboard.press('Tab');assert(await p.evaluate(()=>document.activeElement.tagName==='BUTTON'),'Keyboard focus');
   await p.locator('[data-sp-action="sound"]').click();assert(await p.evaluate(()=>saved.specimen.settings.sound),'Sound on');await p.locator('[data-sp-action="sound"]').click();assert(!await p.evaluate(()=>saved.specimen.settings.sound),'Sound off');
   await p.locator('[data-sp-action="fullscreen"]').click();await p.waitForFunction(()=>!!document.fullscreenElement);await p.locator('[data-sp-action="fullscreen"]').click();await p.waitForFunction(()=>!document.fullscreenElement);
   await p.locator('[data-sp-action="help"]').click();await shot(p,'help-1440');await p.locator('[data-sp-action="help-back"]').click();
   await p.locator('[data-sp-action="start"]').click();const before=await p.evaluate(()=>SpecimenMode.snapshot().x);await p.keyboard.down('d');await p.waitForTimeout(650);await p.keyboard.up('d');assert(await p.evaluate(()=>SpecimenMode.snapshot().x)>before+50,'Real keyboard movement');
   await p.keyboard.press('Escape');assert(await p.locator('.sp-shell').getAttribute('data-mode')==='paused','Pause');const paused=await p.evaluate(()=>SpecimenMode.snapshot().time);await p.waitForTimeout(200);assert(await p.evaluate(()=>SpecimenMode.snapshot().time)===paused,'Pause stops simulation');await shot(p,'pause-1440');
   await p.locator('[data-sp-action="continue"]').click();await p.evaluate(()=>window.dispatchEvent(new Event('blur')));assert(await p.locator('.sp-shell').getAttribute('data-mode')==='paused','Blur auto-pause');
   await p.locator('[data-sp-action="title"]').click();await p.locator('[data-sp-action="exit"]').click();assert(await p.locator('[data-resume="specimen"]').count()===1,'Catalog resume');assert(!await p.evaluate(()=>document.documentElement.classList.contains('specimen-active')),'Scroll unlock');
   await p.reload({waitUntil:'domcontentloaded'});await p.locator('[data-resume="specimen"]').click();await p.locator('.sp-panel h1').waitFor();console.log('Reload menu ready');await p.locator('[data-sp-action="resume"]').click();assert(await p.evaluate(()=>SpecimenMode.snapshot().x)>before+50,'Reload resume');
   await fixture(p,0,32,300,646);await p.waitForTimeout(200);let snap=await p.evaluate(()=>SpecimenMode.snapshot());await mouseAt(p,snap.rooms[0].enemies[0].x,snap.rooms[0].enemies[0].y);await p.mouse.down();await p.waitForTimeout(1000);await p.mouse.up();assert(await p.evaluate(()=>SpecimenMode.snapshot().kills)===1,'Mouse grab and consume');await shot(p,'consume-1440');
   await fixture(p,0,32,400,100);await p.keyboard.down('w');await p.waitForTimeout(450);await p.keyboard.up('w');await p.waitForTimeout(250);
   const contacts=await p.evaluate(async()=>{const m=await import('/static/js/specimen/engine.mjs'),raw=SpecimenMode.snapshot(),s=m.restore(raw);return raw.limbs.filter(l=>l.anchor).map(l=>({x:l.anchor.x,y:l.anchor.y,solid:m.blocked(s,l.anchor.x,l.anchor.y)}));});assert(contacts.length>=2&&contacts.every(a=>a.solid),'Limbs attach to actual geometry');assert(contacts.some(a=>a.y<50),'Ceiling contact');await shot(p,'ceiling-1440');
   await fixture(p,0,32,130,564);await p.waitForTimeout(250);await shot(p,'lamp-before-1440');await mouseAt(p,130,510);await p.mouse.down();await p.waitForTimeout(450);await p.mouse.up();await p.waitForTimeout(600);assert(await p.evaluate(()=>SpecimenMode.snapshot().rooms[0].objects.find(o=>o.id==='0:lamp3').broken),'Mouse breaks light');await shot(p,'lamp-after-1440');await p.keyboard.press('Escape');await p.locator('[data-sp-action="title"]').click();await p.locator('[data-sp-action="resume"]').click();assert(await p.evaluate(()=>SpecimenMode.snapshot().rooms[0].objects.find(o=>o.id==='0:lamp3').broken),'Broken lamp survives resume');
   await fixture(p,1,100,250,430);await p.keyboard.press('e');await p.waitForTimeout(100);assert(await p.evaluate(()=>SpecimenMode.snapshot().mass)===32,'Shrink in reservoir');await p.keyboard.press('e');await p.waitForTimeout(100);assert(await p.evaluate(()=>SpecimenMode.snapshot().mass)===100,'Restore stored mass');
   await fixture(p,3,100,500,416);await p.keyboard.down('d');await p.keyboard.press('Space');await p.waitForTimeout(170);await p.keyboard.up('d');assert(await p.evaluate(()=>SpecimenMode.snapshot().rooms[3].gateOpen),'Real burst breaks gate');await shot(p,'large-1440');
   for(const [width,height]of [[375,812],[768,1024],[1440,900],[1920,1080]]){await p.setViewportSize({width,height});if(await p.locator('.sp-rotate').isVisible())await p.locator('[data-sp-action="portrait"]').click();await shot(p,`game-${width}`);assert(await p.evaluate(()=>document.documentElement.scrollWidth===innerWidth),'Gameplay overflow '+width);}
   await p.setViewportSize({width:1440,height:900});
   const metrics=await p.evaluate(()=>SpecimenMode.snapshot().metrics);checks.push({desktopWorkMs:metrics.meanWorkMs});
   await p.emulateMedia({reducedMotion:'reduce'});await p.keyboard.press('Escape');await shot(p,'reduced-motion-1440');await p.emulateMedia({reducedMotion:'no-preference'});
   await p.evaluate(async()=>{const m=await import('/static/js/specimen/engine.mjs');const raw={...m.serialize(m.createRun()),room:5,mass:1,x:582,y:300};saved.specimen={run:raw,checkpoint:{...raw,mass:80,x:100,y:240}};SpecimenMode.enter();});await p.locator('[data-sp-action="resume"]').click();await p.waitForTimeout(2400);assert(await p.locator('[data-sp-action="retry"]').isVisible(),'Defeat feedback');await shot(p,'defeat-1440');await p.locator('[data-sp-action="retry"]').click();assert(await p.evaluate(()=>SpecimenMode.snapshot().mass)>1,'Checkpoint retry');
   await fixture(p,5,80,520,204);await p.keyboard.down('d');await p.keyboard.press('Space');await p.waitForTimeout(250);await p.waitForTimeout(500);await p.keyboard.up('d');await p.keyboard.press('e');await p.waitForTimeout(100);assert(await p.evaluate(()=>SpecimenMode.snapshot().rooms[5].gateOpen),'Terminal interaction');await p.keyboard.down('w');await p.waitForTimeout(250);await p.keyboard.up('w');await p.keyboard.down('d');await p.waitForTimeout(2200);await p.keyboard.up('d');assert(await p.locator('.sp-shell').getAttribute('data-mode')==='won','Real exit completion');await shot(p,'ending-1440');
   checks.push('catalog, lazy loading, keyboard, pause, reload resume, grab, consume, reservoir, barrier, defeat, checkpoint, ending');
  }finally{await c.close();}
 }
 {
  const {c,p}=await setup({viewport:{width:844,height:390},hasTouch:true,isMobile:true});try{
   await p.locator('[data-sp-action="open"]').click();await p.locator('.sp-panel h1').waitFor();await shot(p,'menu-844');await p.locator('[data-sp-action="start"]').click();await shot(p,'touch-844');
   const move=await p.locator('.sp-move').boundingBox(),grab=await p.locator('.sp-grab').boundingBox(),cdp=await c.newCDPSession(p);
   const points=[{x:move.x+move.width/2,y:move.y+move.height/2,id:1},{x:grab.x+grab.width/2,y:grab.y+grab.height/2,id:2}];
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});points[0].x+=28;points[1].x+=26;await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points});await p.waitForTimeout(500);
   const multi=await p.evaluate(()=>SpecimenMode.snapshot());assert(multi.pointers===2&&multi.input.x>.5&&multi.input.grabbing,'Two real touch contacts');await shot(p,'two-touch-844');await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert(await p.evaluate(()=>SpecimenMode.snapshot().pointers)===0,'Touch release');
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});await p.evaluate(()=>window.dispatchEvent(new Event('blur')));assert(await p.evaluate(()=>SpecimenMode.snapshot().pointers)===0,'Blur resets both pointers');await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await p.locator('[data-sp-action="continue"]').click();
   await p.setViewportSize({width:375,height:812});await p.locator('.sp-rotate').waitFor({state:'visible'});await shot(p,'rotate-375');await p.locator('[data-sp-action="portrait"]').click();await shot(p,'portrait-375');
   await p.locator('[data-sp-action="pause"]').click();await shot(p,'pause-375');await p.locator('[data-sp-action="title"]').click();await p.locator('[data-sp-action="help"]').click();await shot(p,'help-375');await p.locator('[data-sp-action="help-back"]').click();
   checks.push('844x390 native two-contact touch; pointer release; portrait rotate and opt-in; mobile pause and help');
  }finally{await c.close();}
 }
 assert(!errors.length,'JS errors '+errors.join('; '));assert(!assets.length,'Missing game assets '+assets.join(','));return {checks,errors,assets,iteration};
}

async(page)=>{
 const context=await page.context().browser().newContext({viewport:{width:375,height:812},hasTouch:true,isMobile:true});
 const p=await context.newPage(),checks=[],errors=[];
 const ok=(value,message)=>{if(!value)throw Error(message);checks.push(message);};
 p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));await p.goto('http://127.0.0.1:8080/',{waitUntil:'domcontentloaded'});
  await p.locator('#hubSearch').waitFor();const s=await context.newCDPSession(p);
  const begin=async(x,y)=>s.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  const move=async(x,y)=>s.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y}]});
  const end=async()=>s.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  async function swipe(x,y,dx,dy=0){await begin(x,y);for(let i=1;i<=10;i++){await move(x+dx*i/10,y+dy*i/10);await p.waitForTimeout(18);}await end();await p.waitForTimeout(450);}
  const current=()=>p.evaluate(()=>activeScreen);
  ok((await p.locator('.bottom-nav button').allTextContents()).join(',')==='Игры,Карты,Профиль,Настройки','Four correct sections; no journal');
  ok(await p.locator('.bottom-nav svg').count()===4,'SVG navigation icons');
  const card=p.locator('#campaignCards [data-sp-action="open"]');const r=await card.boundingBox();
  await swipe(r.x+r.width*.8,r.y+40,-65);
  ok(await current()==='home','Short drag on game button neither navigates nor opens game');
  await begin(310,r.y+50);await move(235,r.y+51);await p.waitForTimeout(90);
  ok(await current()==='home','Gesture does not change page before release');
  ok(await p.locator('#main>.screen.active').evaluate(e=>getComputedStyle(e).transform!=='none'),'Page follows finger');
  ok(await p.locator('.menu-motion-layer [data-screen="cards"]').count()===1,'Next page visible alongside current page');
  await p.screenshot({path:'C:/Users/1234567890/Desktop/PHANTOM_PROJECTS_COLLECTED_2026-09-20/01 Проекты/01 В работе/Развивайка — Teramont/output/playwright/navigation-repair/drag-375-i1.png'});
  await move(125,r.y+51);await end();await p.waitForTimeout(450);
  ok(await current()==='cards','Deliberate swipe completes to Cards without game click: '+await current());
  await p.locator('.bottom-nav [data-screen-link="home"]').click();await p.waitForTimeout(450);
  const zone=p.locator('.category-gesture-zone'),z=await zone.boundingBox();
  await swipe(305,z.y+z.height/2,-225,0);
  ok(await current()==='home','Category swipe stays in library');
  ok(await zone.evaluate(e=>e.scrollLeft>40),'Category strip scrolls');
  ok(await p.locator('[data-filter="Все"]').getAttribute('aria-pressed')==='true','Category swipe does not click a category');
  await zone.evaluate(e=>e.scrollLeft=0);
  await swipe(300,z.y+z.height-3,-220,40);
  ok(await current()==='home','Leaving category bounds does not transfer gesture');
  await p.locator('.bottom-nav [data-screen-link="settings"]').click();
  const animation=await p.locator('#main>[data-screen="settings"]').evaluate(e=>e.getAnimations().map(a=>a.effect.getKeyframes()));
  ok(animation.some(frames=>frames[0].transform?.includes('375')),'Tap navigation uses a full-width sliding transition');
  await p.waitForTimeout(450);ok(await p.locator('.menu-motion-layer').count()===0,'Transition layers cleaned up');
  await p.locator('.header-actions [data-screen-link="help"]').click();await p.waitForTimeout(350);
  for(const id of ['lumen','specimen','progress']){await p.locator('[data-hub-document="'+id+'"]').click();ok(await p.locator('.hub-document').evaluate(e=>e.open),'Help article '+id);await p.keyboard.press('Escape');}
  await p.locator('.bottom-nav [data-screen-link="home"]').click();await p.waitForTimeout(450);
  await p.locator('[data-filter="Карты"]').click();ok(await p.locator('#campaignCards>.campaign-card:visible').count()===4,'Cards category includes four card games');await p.locator('[data-filter="Все"]').click();
  await p.locator('#campaignCards [data-lumen-action="open"]').click();await p.locator('.lumen-main-actions').waitFor();
  await p.locator('.lumen-main-actions [data-lumen-value="characters"]').click();await p.waitForTimeout(350);
  await swipe(300,225,-65);ok(await p.locator('.lumen-shell').getAttribute('data-page')==='characters','Lumen short swipe cancelled');
  await swipe(300,225,-210);ok(await p.locator('.lumen-shell').getAttribute('data-page')==='weapons','Lumen deliberate swipe changes window');
  await p.locator('.lumen-window-toolbar button').click();await p.locator('[data-lumen-action="catalog"]').click();await p.waitForTimeout(400);
  await p.locator('#campaignCards [data-sp-action="open"]').click();await p.locator('[data-sp-action="settings"]').click();await p.waitForTimeout(350);
  await swipe(300,230,-210);ok(await p.locator('.sp-shell').getAttribute('data-mode')==='help','Specimen deliberate swipe changes window');
  await p.emulateMedia({reducedMotion:'reduce'});await p.locator('.sp-window-close').click();await p.locator('[data-sp-action="exit"]').click();await p.locator('.bottom-nav [data-screen-link="settings"]').click();await p.waitForTimeout(180);
  ok(await p.locator('.menu-motion-layer').count()===0,'Reduced motion uses no positional page layer');
  ok(!errors.length,'No browser exceptions '+errors.join(';'));return {checks,errors};
 }finally{await context.close();}
}

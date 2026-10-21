async(page)=>{
 const root='C:/Users/1234567890/Desktop/PHANTOM_PROJECTS_COLLECTED_2026-09-20/01 Проекты/01 В работе/Развивайка — Teramont/';
 const c=await page.context().browser().newContext({viewport:{width:1440,height:900}}),p=await c.newPage(),errors=[],assets=[];
 const iteration=process.env.SPECIMEN_QA_ITERATION||'v1',checks=[],assert=(v,m)=>{if(!v)throw Error(m);},snap=()=>p.evaluate(()=>SpecimenMode.snapshot());
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().includes('/assets/specimen/')&&r.status()>=400)assets.push(r.url());});p.setDefaultTimeout(15000);
 async function shot(name){await p.screenshot({path:root+`output/playwright/specimen-laboratory-${name}-${iteration}.png`});}
 async function fixture(room,mass,x,y,scenario='still'){
   await p.evaluate(async args=>{
     const m=await import('/static/js/specimen/engine.mjs'),raw={...m.serialize(m.createRun()),room:args.room,mass:args.mass,x:args.x,y:args.y};
     raw.rooms.forEach(r=>r.enemies.forEach(e=>e.eaten=e.dead=true));
     if(args.scenario==='flame'){const e=raw.rooms[2].enemies.find(e=>e.id==='2:e4');e.eaten=e.dead=false;}
     if(args.scenario==='throw'){const e=raw.rooms[2].enemies.find(e=>e.id==='2:e3');Object.assign(e,{eaten:false,dead:false,x:540,y:620});const o=raw.rooms[2].objects.find(o=>o.id==='2:o1');Object.assign(o,{x:452,y:620});}
     saved.specimen={run:raw,checkpoint:raw,settings:{sound:false}};saveState();SpecimenMode.enter();
   },{room,mass,x,y,scenario});
   await p.locator('[data-sp-action="resume"]').click();if(await p.locator('.sp-rotate').isVisible())await p.locator('[data-sp-action="portrait"]').click();await p.clock.runFor(50);
 }
 async function aim(x,y){const s=await snap(),r=await p.locator('.sp-canvas').boundingBox(),m=s.metrics;await p.mouse.move(r.x+(x-m.cameraX+m.width/2)/m.width*r.width,r.y+(y-m.cameraY+m.height/2)/m.height*r.height);}
 try{
   await p.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));await p.goto(process.env.SPECIMEN_QA_URL||'http://127.0.0.1:8081',{waitUntil:'domcontentloaded'});
   await p.locator('[data-sp-action="open"]').click();await p.locator('.sp-panel h1').waitFor();await p.clock.install();await p.clock.pauseAt(new Date(Date.now()+1000));await p.clock.runFor(800);
   await fixture(0,32,125,616);await p.clock.runFor(200);await shot('living-core');assert(await p.evaluate(()=>saved.specimen.checkpoint.rooms[0].objects.find(o=>o.id==='0:o3').lit),'living core checkpoint');assert(!await p.locator('.sp-use').isVisible(),'automatic core obscured by manual action');checks.push('automatic living checkpoint');
   await p.clock.runFor(650);await shot('core-pulse');
   for(const [room,x,y]of [[0,492,400],[1,310,396],[2,490,430],[3,495,416],[4,480,396],[5,492,200]]){await fixture(room,32,x,y);await p.clock.runFor(400);await shot('room-'+room);}
   await fixture(1,32,310,396);await p.keyboard.down('d');await p.clock.runFor(1800);await p.keyboard.up('d');assert((await snap()).x>470,'small ventilation traversal');await shot('duct-exit');
   await fixture(2,54,450,420,'flame');await p.clock.runFor(1050);await shot('fire-warning');await p.clock.runFor(550);await shot('flamethrower');assert((await snap()).mass<54,'visible flame deals damage');checks.push('flame warning and burst');
   await fixture(2,54,400,620,'throw');await aim(452,620);await p.mouse.down();await p.clock.runFor(150);assert((await snap()).grab?.id==='2:o1','mouse box grab');await shot('held-box');await p.mouse.up();await p.clock.runFor(450);let s=await snap();assert(s.rooms[2].enemies.find(e=>e.id==='2:e3').hp<5,'box impact damage');assert(s.rooms[2].enemies.find(e=>e.id==='2:e3').knock>0,'knockdown');await shot('box-knockdown');checks.push('mouse grab / release throw / human damage and fall');
   await p.keyboard.press('Escape');await p.locator('[data-sp-action="title"]').click();await p.locator('[data-sp-action="resume"]').click();assert((await snap()).rooms[2].enemies.find(e=>e.id==='2:e3').hp<5,'injury persists');
   for(const [width,height]of [[375,812],[768,1024],[1440,900],[1920,1080]]){
     await p.setViewportSize({width,height});await p.clock.runFor(50);if(await p.locator('.sp-rotate').isVisible())await p.locator('[data-sp-action="portrait"]').click();
     await fixture(0,100,125,616);await p.clock.runFor(400);await shot('core-'+width);assert(await p.evaluate(()=>document.documentElement.scrollWidth===innerWidth),'overflow '+width);
   }
   await p.emulateMedia({reducedMotion:'reduce'});await p.clock.runFor(300);await shot('reduced-motion');
   await p.keyboard.press('Escape');const t=(await snap()).time;await p.clock.runFor(300);assert((await snap()).time===t,'pause stops hazards');
   await p.locator('[data-sp-action="help"]').click();assert((await p.locator('.sp-help').innerText()).includes('ящик'),'throw help missing');await shot('help');
   assert(!errors.length&&!assets.length,JSON.stringify({errors,assets}));return {checks,errors,assets,iteration};
 }finally{await c.close();}
}

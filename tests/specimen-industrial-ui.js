async(page)=>{
 const fs=require('node:fs'),root='C:/Users/1234567890/Desktop/PHANTOM_PROJECTS_COLLECTED_2026-09-20/01 Проекты/01 В работе/Развивайка — Teramont/';
 const iteration=process.env.SPECIMEN_QA_ITERATION||'v2',c=await page.context().browser().newContext({viewport:{width:1440,height:900}}),p=await c.newPage(),errors=[],checks=[];
 const assert=(v,m)=>{if(!v)throw Error(m);},snap=()=>p.evaluate(()=>SpecimenMode.snapshot()),clock=ms=>p.clock.runFor(ms);
 p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);
 const shot=name=>p.screenshot({path:root+`output/playwright/specimen-industrial-${name}-${iteration}.png`});
 async function aim(x,y){const s=await snap(),r=await p.locator('.sp-canvas').boundingBox(),m=s.metrics;await p.mouse.move(r.x+(x-m.cameraX+m.width/2)/m.width*r.width,r.y+(y-m.cameraY+m.height/2)/m.height*r.height);}
 async function fixture(room,mass,x,y,scenario){
  await p.evaluate(async a=>{
   const m=await import('/static/js/specimen/engine.mjs'),raw={...m.serialize(m.createRun()),room:a.room,mass:a.mass,x:a.x,y:a.y};
   raw.rooms.forEach(r=>r.enemies.forEach(e=>e.dead=e.eaten=true));
   if(a.scenario==='glass'){Object.assign(raw.rooms[0].objects.find(o=>o.id==='0:o2'),{x:322,y:176});}
   if(a.scenario==='relay'){Object.assign(raw.rooms[5].objects.find(o=>o.id==='5:o1'),{x:520,y:200});}
   if(a.scenario==='human'){Object.assign(raw.rooms[0].enemies[0],{x:594,y:620,eaten:false,dead:false});}
   saved.specimen={run:raw,checkpoint:raw,settings:{sound:false}};saveState();SpecimenMode.enter();
  },{room,mass,x,y,scenario});
  await p.locator('[data-sp-action="resume"]').click();if(await p.locator('.sp-rotate').isVisible())await p.locator('[data-sp-action="portrait"]').click();await clock(300);
 }
 try{
  await p.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));await p.goto(process.env.SPECIMEN_QA_URL||'http://127.0.0.1:8081',{waitUntil:'domcontentloaded'});
  await p.locator('[data-sp-action="open"]').click();await p.locator('.sp-panel h1').waitFor();await p.clock.install();await p.clock.pauseAt(new Date(Date.now()+1000));
  await fixture(0,32,270,176,'glass');await shot('glass-before');await aim(322,200);await p.mouse.down();await clock(200);assert((await snap()).grab?.id==='0:o2','glass crate selection');await p.mouse.up();await clock(220);
  assert((await snap()).rooms[0].objects.find(o=>o.id==='0:observation-glass').broken,'mouse throw did not break glass');await shot('glass-after');checks.push('mouse grab / throw shatters glass');
  await fixture(5,32,480,200,'relay');await aim(520,210);await p.mouse.down();await clock(180);assert((await snap()).grab?.id==='5:o1','relay crate selection');await p.mouse.up();await clock(220);
  assert((await snap()).rooms[5].objects.find(o=>o.id==='5:escape-relay').broken,'thrown box did not release final relay');await shot('relay-broken');checks.push('small form can solve final relay with a crate');
  await p.keyboard.press('Escape');const time=(await snap()).time;await clock(300);assert((await snap()).time===time,'pause advances simulation');
  await p.reload({waitUntil:'domcontentloaded'});await p.locator('[data-sp-action="open"]').click();await p.locator('[data-sp-action="resume"]').click();await clock(100);
  assert((await snap()).rooms[5].objects.find(o=>o.id==='5:escape-relay').broken,'broken relay lost on reload');checks.push('pause / save / full reload / resume preserves destruction');
  await fixture(0,54,536,620,'human');await aim(594,620);await p.mouse.down();await clock(160);assert((await snap()).grab?.type==='enemy','human grab');await p.mouse.up();await clock(150);
  let s=await snap(),e=s.rooms[0].enemies[0];assert(!e.eaten&&e.pose?.length===4,'short grip should throw person');assert(e.x<635,'thrown torso crossed partition');await shot('human-wall-throw');await clock(700);await shot('human-fall-blood');checks.push('human short grip / throw / partition collision / falling pose');
  for(const [width,height]of [[375,812],[768,1024],[1440,900],[1920,1080]]){
   await p.setViewportSize({width,height});await fixture(5,54,495,200);await clock(300);await shot('final-'+width);
   assert(await p.evaluate(()=>document.documentElement.scrollWidth===innerWidth),'overflow '+width);
  }
  await p.emulateMedia({reducedMotion:'reduce'});await clock(300);await shot('reduced');assert((await snap()).effects.flashes===0,'unexpected lasting flash');checks.push('four CSS widths and reduced motion');
  assert(!errors.length,errors.join(';'));const result={checks,errors,iteration};fs.writeFileSync(root+`output/specimen-industrial-ui-${iteration}.json`,JSON.stringify(result,null,2));return result;
 }finally{await c.close();}
}

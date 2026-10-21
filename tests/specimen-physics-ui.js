async(page)=>{
 const root='C:/Users/1234567890/Desktop/PHANTOM_PROJECTS_COLLECTED_2026-09-20/01 Проекты/01 В работе/Развивайка — Teramont/';
 const browser=page.context().browser(),c=await browser.newContext({viewport:{width:1440,height:900}}),p=await c.newPage();
 const errors=[],checks=[],iteration=process.env.SPECIMEN_QA_ITERATION||'physics';
 const assert=(v,m)=>{if(!v)throw Error(m);},snap=()=>p.evaluate(()=>SpecimenMode.snapshot());
 p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);
 async function hold(keys,ms){for(const k of keys)await p.keyboard.down(k);await p.clock.runFor(ms);for(const k of keys)await p.keyboard.up(k);}
 async function shot(name){await p.screenshot({path:root+`output/playwright/specimen-physics-${name}-${iteration}.png`});}
 async function checkBody(name){
   const result=await p.evaluate(async()=>{
     const m=await import('/static/js/specimen/engine.mjs'),s=SpecimenMode.snapshot();let penetrations=0,invalid=0;
     for(const n of s.nodes)for(let j=0;j<32;j++){const a=j/32*Math.PI*2;if(m.blocked(s,n.x+Math.cos(a)*(n.r-.08),n.y+Math.sin(a)*(n.r-.08)))penetrations++;}
     for(const l of s.limbs.filter(l=>l.anchor)){const n=s.nodes[l.root];if(!n||!m.blocked(s,l.anchor.x,l.anchor.y)||Math.hypot(n.x-l.anchor.x,n.y-l.anchor.y)>l.reach+.02)invalid++;}
     return {penetrations,invalid,x:s.x,y:s.y,mass:s.mass,contacts:s.limbs.filter(l=>l.anchor).length};
   });assert(!result.penetrations&&!result.invalid,name+' '+JSON.stringify(result));checks.push({name,...result});
 }
 async function fixture(room,mass,x,y){
   await p.evaluate(async args=>{const m=await import('/static/js/specimen/engine.mjs'),raw={...m.serialize(m.createRun()),...args};raw.rooms.forEach(r=>r.enemies.forEach(e=>e.dead=e.eaten=true));saved.specimen={run:raw,checkpoint:raw,settings:{sound:false}};saveState();SpecimenMode.enter();},{room,mass,x,y});
   await p.locator('[data-sp-action="resume"]').click();if(await p.locator('.sp-rotate').isVisible())await p.locator('[data-sp-action="portrait"]').click();
   await p.clock.runFor(40);
 }
 try{
   await p.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));
   await p.goto(process.env.SPECIMEN_QA_URL||'http://127.0.0.1:8081',{waitUntil:'domcontentloaded'});
   await p.locator('[data-sp-action="open"]').click();await p.locator('.sp-panel h1').waitFor();
   await p.clock.install();await p.clock.pauseAt(new Date(Date.now()+1000));
   await fixture(0,32,400,270);const start=await snap();await hold(['d'],600);const right=await snap();assert(right.x>start.x+40,'move right');
   await hold(['a'],140);await checkBody('turn');await shot('turn');await hold(['a'],650);assert((await snap()).x<right.x-30,'move left');await checkBody('reverse-settled');await shot('reverse-settled');
   await fixture(0,54,400,650);await hold(['s'],450);const floor=await snap();await hold(['d'],700);assert((await snap()).x>floor.x+30,'floor crawl');await checkBody('floor');await shot('floor');
   await fixture(0,32,74,325);await hold(['a'],400);const wall=await snap();await hold(['w'],650);assert((await snap()).y<wall.y-30,'wall crawl');await checkBody('wall');await shot('wall');
   await fixture(0,32,400,80);await hold(['w'],450);const ceiling=await snap();await hold(['a'],700);assert((await snap()).x<ceiling.x-30,'ceiling crawl');await checkBody('ceiling');await shot('ceiling');
   await fixture(0,100,80,80);await hold(['a','w'],700);await hold(['d'],700);await checkBody('corner');await shot('corner');
   await fixture(1,32,320,396);for(let i=0;i<15&&(await snap()).x<=470;i++)await hold(['d'],200);assert((await snap()).x>470,'narrow channel');await checkBody('channel');await shot('channel');
   await fixture(1,100,250,430);await p.keyboard.press('e');await p.clock.runFor(200);assert((await snap()).mass===32,'shrink');await checkBody('shrink');await shot('shrink');
   await p.keyboard.press('e');await p.clock.runFor(250);assert((await snap()).mass===100,'grow');await checkBody('grow');await shot('grow');
   for(const [width,height]of [[375,812],[768,1024],[1440,900],[1920,1080]]){
     await p.setViewportSize({width,height});await p.clock.runFor(50);if(await p.locator('.sp-rotate').isVisible())await p.locator('[data-sp-action="portrait"]').click();
     await hold(['a'],140);await checkBody('viewport-'+width);await shot('viewport-'+width);assert(await p.evaluate(()=>document.documentElement.scrollWidth===innerWidth),'overflow '+width);
   }
   await p.emulateMedia({reducedMotion:'reduce'});await hold(['d'],300);await shot('reduced-motion');await p.keyboard.press('Escape');
   const time=(await snap()).time;await p.clock.runFor(300);assert((await snap()).time===time,'pause');
   await p.locator('[data-sp-action="title"]').click();await p.locator('[data-sp-action="resume"]').click();assert((await snap()).mass===100,'size survives resume');
   await checkBody('restored');assert(!errors.length,errors.join(';'));return {checks,errors,iteration};
 }finally{await c.close();}
}

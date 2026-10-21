async(page)=>{
 const c=await page.context().browser().newContext({viewport:{width:1440,height:900}}),p=await c.newPage(),errors=[],badAssets=[],checks=[];
 const base=process.env.SPECIMEN_QA_URL||'http://127.0.0.1:8080',iteration=process.env.SPECIMEN_QA_ITERATION||'ref1';
 const out='C:/Users/1234567890/Desktop/PHANTOM_PROJECTS_COLLECTED_2026-09-20/01 Проекты/01 В работе/Развивайка — Teramont/output/playwright/';
 const assert=(v,m)=>{if(!v)throw Error(m);};p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.url().includes('/assets/specimen/')&&r.status()>=400)badAssets.push(r.url());});
 const shot=name=>p.screenshot({path:out+'specimen-'+name+'-'+iteration+'.png'});
 async function fixture(room,mass=100,x=400,y=270){await p.evaluate(async({room,mass,x,y})=>{const m=await import('/static/js/specimen/engine.mjs');const raw={...m.serialize(m.createRun()),room,mass,x,y};saved.specimen={run:raw,checkpoint:raw};SpecimenMode.enter();},{room,mass,x,y});await p.locator('[data-sp-action="resume"]').click();if(await p.locator('.sp-rotate').isVisible())await p.locator('[data-sp-action="portrait"]').click();await p.waitForTimeout(1150);}
 try{
  await p.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));await p.goto(base,{waitUntil:'domcontentloaded'});await p.locator('[data-sp-action="open"]').click();await p.locator('[data-sp-action="start"]').waitFor();
  for(const [width,height]of [[375,812],[768,1024],[1440,900],[1920,1080]]){await p.setViewportSize({width,height});await shot('reference-menu-'+width);assert(await p.evaluate(()=>document.documentElement.scrollWidth===innerWidth),'Menu overflow');}
  await p.setViewportSize({width:1440,height:900});
  for(let room=0;room<6;room++){await fixture(room);await shot('reference-room-'+room);checks.push({room,style:await p.evaluate(()=>SpecimenMode.snapshot().metrics.visualStyle)});}
  for(const [width,height]of [[375,812],[768,1024],[1440,900],[1920,1080]]){await p.setViewportSize({width,height});await fixture(0);await shot('reference-game-'+width);assert(await p.evaluate(()=>document.documentElement.scrollWidth===innerWidth),'Game overflow');}
  await p.setViewportSize({width:1440,height:900});await fixture(3,100,500,264);await p.waitForTimeout(3200);const metrics=await p.evaluate(()=>SpecimenMode.snapshot().metrics);
  const immutable=await p.evaluate(async()=>{const e=await import('/static/js/specimen/engine.mjs'),v=await import('/static/js/specimen/renderer.mjs?v=3');const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;left:-9000px;width:768px;height:432px';document.body.append(canvas);const r=await v.createRenderer(canvas),s=e.createRun(),before=JSON.stringify(s);r.draw(s,1000);const unchanged=before===JSON.stringify(s);r.destroy();canvas.remove();return unchanged;});assert(immutable,'Renderer changed simulation state');
  await p.emulateMedia({reducedMotion:'reduce'});await shot('reference-reduced-motion');
  assert(!errors.length&&!badAssets.length,JSON.stringify({errors,badAssets}));return{iteration,checks,metrics,rendererReadOnly:immutable,errors,badAssets};
 }finally{await c.close();}
}

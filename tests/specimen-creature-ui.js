async(page)=>{
 const c=await page.context().browser().newContext({viewport:{width:1440,height:900}}),p=await c.newPage(),errors=[],checks=[];
 const iteration=process.env.SPECIMEN_QA_ITERATION||'weave1',out='C:/Users/1234567890/Desktop/PHANTOM_PROJECTS_COLLECTED_2026-09-20/01 Проекты/01 В работе/Развивайка — Teramont/output/playwright/';
 const assert=(v,m)=>{if(!v)throw Error(m);},snap=()=>p.evaluate(()=>SpecimenMode.snapshot()),shot=name=>p.screenshot({path:out+'specimen-creature-'+name+'-'+iteration+'.png'});
 p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);
 async function fixture(mass=100,x=400,y=270){await p.evaluate(async args=>{const m=await import('/static/js/specimen/engine.mjs'),raw={...m.serialize(m.createRun()),...args};raw.rooms.forEach(r=>r.enemies.forEach(e=>e.dead=e.eaten=true));saved.specimen={run:raw,checkpoint:raw};SpecimenMode.enter();},{mass,x,y});await p.locator('[data-sp-action="resume"]').click();if(await p.locator('.sp-rotate').isVisible())await p.locator('[data-sp-action="portrait"]').click();await p.clock.runFor(1150);}
 async function hold(keys,ms){for(const k of keys)await p.keyboard.down(k);await p.clock.runFor(ms);for(const k of keys)await p.keyboard.up(k);}
 try{
  await p.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));await p.goto(process.env.SPECIMEN_QA_URL||'http://127.0.0.1:8080',{waitUntil:'domcontentloaded'});await p.locator('[data-sp-action="open"]').click();await p.locator('[data-sp-action="start"]').waitFor();await p.clock.install();await p.clock.pauseAt(new Date(Date.now()+1000));
  for(const mass of [32,54,100]){await fixture(mass);await shot('idle-'+mass);await hold(['d'],600);await shot('move-'+mass);await hold(['a'],400);await shot('turn-'+mass);checks.push({mass,nodes:(await snap()).nodes.length});}
  await fixture(100,400,80);await hold(['w'],500);await hold(['a'],500);await shot('ceiling');assert((await snap()).limbs.some(l=>l.anchor&&l.anchor.y<49),'Planted ceiling contacts');
  for(const [width,height]of [[375,812],[768,1024],[1440,900],[1920,1080]]){await p.setViewportSize({width,height});await fixture();await shot('game-'+width);assert(await p.evaluate(()=>document.documentElement.scrollWidth===innerWidth),'Overflow '+width);}
  await p.setViewportSize({width:1440,height:900});await p.emulateMedia({reducedMotion:'reduce'});await fixture();await shot('reduced');
  const sheet=await p.evaluate(async()=>{
    const e=await import('/static/js/specimen/engine.mjs'),a=await import('/static/js/specimen/organism.mjs?v=4'),img=new Image();img.src='/static/assets/specimen/tissue.png?v=3';await img.decode();
    const canvas=document.createElement('canvas');canvas.id='organismQaSheet';canvas.width=960;canvas.height=600;canvas.style.cssText='position:fixed;z-index:9999;left:0;top:0;width:960px;height:600px;background:#0c0911';document.body.append(canvas);const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
    const flesh=(c,i,x,y,w,h)=>c.drawImage(img,i%4*96,Math.floor(i/4)*96,96,96,x,y,w,h);let readOnly=true;
    for(const [i,mass]of [32,54,100].entries()){const s=e.restore({...e.serialize(e.createRun()),mass,x:400,y:270}),before=JSON.stringify(s);ctx.save();ctx.translate(160+i*320,210);ctx.scale(2,2);ctx.translate(-s.x,-s.y);a.drawBodyWeave(ctx,s,flesh,true);ctx.restore();readOnly&&=before===JSON.stringify(s);}
    ctx.save();ctx.translate(20,440);ctx.scale(2,2);a.paintVine(ctx,a.vineGeometry({x:10,y:20},{x:440,y:30},{base:6.1,bend:16}));ctx.restore();
    const mask=document.createElement('canvas');mask.width=360;mask.height=260;const mc=mask.getContext('2d'),s=e.restore({...e.serialize(e.createRun()),mass:100,x:400,y:270});mc.translate(230-s.x,130-s.y);a.drawBodyWeave(mc,s,flesh,true);const bytes=mc.getImageData(0,0,360,260).data;let minX=360,minY=260,maxX=0,maxY=0,ink=0;
    for(let y=0;y<260;y++)for(let x=0;x<360;x++)if(bytes[(y*360+x)*4+3]>128){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);ink++;}
    const before=JSON.stringify(s);a.drawOrganism(mc,s,flesh,s.rooms[s.room],true);a.drawOrganism(mc,s,flesh,s.rooms[s.room],true);readOnly&&=before===JSON.stringify(s);
    return{readOnly,transparentFraction:1-ink/((maxX-minX+1)*(maxY-minY+1)),bounds:[minX,minY,maxX,maxY]};
  });await p.locator('#organismQaSheet').screenshot({path:out+'specimen-creature-sheet-'+iteration+'.png'});await p.evaluate(()=>document.querySelector('#organismQaSheet').remove());assert(sheet.readOnly,'Painter mutated physics');assert(sheet.transparentFraction>.3,'Body lost its visible gaps');assert(!errors.length,errors.join(';'));return{iteration,checks,sheet,errors};
 }finally{await c.close();}
}

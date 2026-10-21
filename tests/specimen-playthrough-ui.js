async(page)=>{
 const root='C:/Users/1234567890/Desktop/PHANTOM_PROJECTS_COLLECTED_2026-09-20/01 Проекты/01 В работе/Развивайка — Teramont/';
 const route=JSON.parse(require('node:fs').readFileSync(root+'tests/fixtures/specimen-laboratory-route.json','utf8'));
 const c=await page.context().browser().newContext({viewport:{width:1280,height:720}}),p=await c.newPage(),errors=[],held=new Set(),rooms=[];
 p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);
 const assert=(v,m)=>{if(!v)throw Error(m);},snap=()=>p.evaluate(()=>SpecimenMode.snapshot());
 async function keys(want){for(const k of [...held])if(!want.includes(k)){await p.keyboard.up(k);held.delete(k);}for(const k of want)if(!held.has(k)){await p.keyboard.down(k);held.add(k);}}
 async function advance(ms=90){await p.clock.runFor(ms);}
 async function aim(s,x,y){const r=await p.locator('.sp-canvas').boundingBox(),m=s.metrics;await p.mouse.move(r.x+(x-m.cameraX+m.width/2)/m.width*r.width,r.y+(y-m.cameraY+m.height/2)/m.height*r.height);}
 async function move(x,y){const before=(await snap()).room;for(let i=0;i<1800;i++){const s=await snap(),dx=x-s.x,dy=y-s.y;if(s.status==='won'||s.room!==before||(Math.abs(dx)<9&&Math.abs(dy)<9)){await keys([]);return;}assert(s.status==='playing','Died during move '+before);await keys([...(Math.abs(dx)>6?[dx>0?'d':'a']:[]),...(Math.abs(dy)>6?[dy>0?'s':'w']:[])]);await advance();}throw Error('Movement blocked '+JSON.stringify({s:await snap(),x,y}));}
 async function hunt(id){for(let i=0;i<1800;i++){const s=await snap(),e=s.rooms[s.room].enemies.find(e=>e.id===id);if(e.eaten){await keys([]);await p.mouse.up();return;}assert(s.status==='playing','Died hunting '+id);const dx=e.x-s.x,dy=e.y-s.y,d=Math.hypot(dx,dy);await keys(d>70?[...(Math.abs(dx)>8?[dx>0?'d':'a']:[]),...(Math.abs(dy)>8?[dy>0?'s':'w']:[])]:[]);await aim(s,e.x,e.y);if(s.grab?.type==='object')await p.mouse.up();else await p.mouse.down();await advance();}throw Error('Hunt blocked '+id);}
 try{
  await p.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));await p.goto(process.env.SPECIMEN_QA_URL||'http://127.0.0.1:8081',{waitUntil:'domcontentloaded'});
  await p.locator('[data-sp-action="open"]').click();await p.locator('[data-sp-action="start"]').waitFor();
  await p.clock.install();await p.clock.pauseAt(new Date(Date.now()+1000));await p.locator('[data-sp-action="start"]').click();await advance(100);
  for(const [action,x,y]of route){
   if(action==='move')await move(x,y);
   else if(action==='hunt')await hunt(x);
   else if(action==='use'){await p.keyboard.press('e');await advance(100);}
   else if(action==='burst'){await keys([x>0?'d':'a']);await p.keyboard.press('Space');await advance(190);await keys([]);}
   else if(action==='room'){assert((await snap()).room===x,'Room '+x);rooms.push(x);await p.screenshot({path:root+'output/playwright/specimen-laboratory-route-'+x+'.png'});console.log('Vertical route room',x);}
   else if(action==='mass')assert((await snap()).mass===x,'Mass '+x);
   else if(action==='won')assert((await snap()).status==='won','Completed');
  }
  await p.screenshot({path:root+'output/playwright/specimen-laboratory-ending.png'});assert(!errors.length,errors.join(';'));const s=await snap();return{status:s.status,visited:s.visited,time:s.time,kills:s.kills,rooms,errors};
 }finally{await keys([]).catch(()=>{});await c.close();}
}

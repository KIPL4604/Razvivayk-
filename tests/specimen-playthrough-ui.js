async(page)=>{
 const root='C:/Users/1234567890/Desktop/PHANTOM_PROJECTS_COLLECTED_2026-09-20/01 Проекты/01 В работе/Развивайка — Teramont/',c=await page.context().browser().newContext({viewport:{width:1280,height:720}}),p=await c.newPage(),errors=[],held=new Set(),rooms=[];
 p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);
 const assert=(v,m)=>{if(!v)throw Error(m);},snap=()=>p.evaluate(()=>SpecimenMode.snapshot());
 async function keys(want){for(const k of [...held])if(!want.includes(k)){await p.keyboard.up(k);held.delete(k);}for(const k of want)if(!held.has(k)){await p.keyboard.down(k);held.add(k);}}
 async function advance(ms=75){await p.clock.runFor(ms);}
 async function move(x,y){const before=(await snap()).room;for(let i=0;i<1500;i++){const s=await snap(),dx=x-s.x,dy=y-s.y;if(s.status==='won'||s.room!==before||(Math.abs(dx)<9&&Math.abs(dy)<9)){await keys([]);return;}assert(s.status==='playing','Died during move '+before);await keys([...(Math.abs(dx)>6?[dx>0?'d':'a']:[]),...(Math.abs(dy)>6?[dy>0?'s':'w']:[])]);await advance();}throw Error('Movement blocked '+JSON.stringify({s:await snap(),x,y}));}
 async function eat(){for(let i=0;i<1500;i++){const s=await snap(),e=s.rooms[s.room].enemies.filter(e=>!e.eaten).sort((a,b)=>Math.hypot(a.x-s.x,a.y-s.y)-Math.hypot(b.x-s.x,b.y-s.y))[0];if(!e){await keys([]);await p.mouse.up();return;}assert(s.status==='playing','Died in combat '+s.room);const dx=e.x-s.x,dy=e.y-s.y,d=Math.hypot(dx,dy);await keys(d>70?[...(Math.abs(dx)>8?[dx>0?'d':'a']:[]),...(Math.abs(dy)>8?[dy>0?'s':'w']:[])]:[]);const box=await p.locator('.sp-canvas').boundingBox(),m=s.metrics;await p.mouse.move(box.x+(e.x-m.cameraX+m.width/2)/m.width*box.width,box.y+(e.y-m.cameraY+m.height/2)/m.height*box.height);if(s.grab?.type==='object')await p.mouse.up();else await p.mouse.down();await advance();}throw Error('Combat blocked');}
 async function use(){await p.keyboard.press('e');await advance(100);}
 async function shot(id){rooms.push((await snap()).room);await p.screenshot({path:root+`output/playwright/specimen-route-${id}.png`});console.log('Route room',id);}
 try{
  await p.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));await p.goto(process.env.SPECIMEN_QA_URL||'http://127.0.0.1:8080',{waitUntil:'domcontentloaded'});
  await p.locator('[data-sp-action="open"]').click();await p.locator('[data-sp-action="start"]').waitFor();
  await p.clock.install({time:new Date('2026-10-21T12:00:00Z')});await p.clock.pauseAt(new Date('2026-10-21T12:00:10Z'));await p.locator('[data-sp-action="start"]').click({force:true});await advance(100);
  await move(310,350);await eat();await move(520,338);await use();await shot(0);await move(760,240);assert((await snap()).room===1,'Room 1');
  await move(250,332);await use();assert((await snap()).mass===32,'Shrink 1');await move(346,264);await move(430,264);await shot(1);await move(760,240);assert((await snap()).room===2,'Room 2');
  await move(220,342);await eat();assert((await snap()).mass>68,'Large form');await shot(2);await move(760,240);assert((await snap()).room===3,'Room 3');
  await move(218,330);await use();await move(500,264);await keys(['d']);await p.keyboard.press('Space');await advance(180);await keys([]);assert((await snap()).rooms[3].gateOpen,'Heavy barrier');await shot(3);await move(760,240);assert((await snap()).room===4,'Room 4');
  await move(382,332);await use();await move(520,264);await move(610,264);await shot(4);await move(760,240);assert((await snap()).room===5,'Room 5');
  await move(240,344);await eat();await move(630,334);await use();await shot(5);await move(760,240);assert((await snap()).status==='won','Completed');await shot('ending');assert(!errors.length,errors.join(';'));
  const s=await snap();return{status:s.status,visited:s.visited,time:s.time,kills:s.kills,rooms,errors};
 }finally{await keys([]).catch(()=>{});await c.close();}
}

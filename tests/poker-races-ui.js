async page => {
  const base='http://127.0.0.1:8081',assert=(ok,msg)=>{if(!ok)throw Error(msg);};
  if(new URL(page.url()).origin!==base)throw Error('Use isolated QA server :8081');
  const context=await page.context().browser().newContext({viewport:{width:375,height:812}});context.setDefaultTimeout(8000);
  const releases=[],wait=async predicate=>{for(let i=0;i<160;i++){if(predicate())return;await new Promise(r=>setTimeout(r,50));}throw Error('Held request timed out');};
  try{
    await context.route('https://telegram.org/js/telegram-web-app.js',r=>r.fulfill({body:''}));const p=await context.newPage();await p.goto(base);await p.locator('#campaignCards [data-poker-action="setup"]').click();
    let created=false,releaseCreate;const createGate=new Promise(r=>releaseCreate=r);releases.push(releaseCreate);
    await context.route('**/api/poker/solo',async route=>{const response=await route.fetch();created=true;await createGate;await route.fulfill({response});});
    await p.locator('[data-poker-action="solo"]').click();await wait(()=>created);await p.locator('[data-screen="poker"] [data-screen-link="home"]').click();releaseCreate();
    await p.waitForFunction(()=>!!saved.poker);assert(await p.evaluate(()=>activeScreen==='home'),'Late room creation must not force navigation');
    await context.unroute('**/api/poker/solo');await p.locator('[data-resume="poker"]').click();await p.locator('.poker-table').waitFor();
    const identity=await p.evaluate(()=>({roomId:saved.poker.roomId,token:saved.poker.token}));
    const oldVersion=Number(await p.locator('#pokerMount').getAttribute('data-version'));
    let held=false,released=false,releasePoll;const pollGate=new Promise(r=>releasePoll=r);releases.push(releasePoll);
    const roomUrl=base+'/api/poker/rooms/'+identity.roomId;
    await context.route(roomUrl,async route=>{if(held)return route.continue();const response=await route.fetch();held=true;await pollGate;await route.fulfill({response});released=true;});
    await wait(()=>held);await p.locator('[data-poker-action="fold"]:not(:disabled)').click();await p.waitForFunction(v=>Number(document.querySelector('#pokerMount').dataset.version)>v,oldVersion);releasePoll();await wait(()=>released);
    await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert(Number(await p.locator('#pokerMount').getAttribute('data-version'))>oldVersion,'Delayed poll must not roll back the action');assert(await p.locator('.poker-result').isVisible(),'Resolved hand survives stale response');
    await context.unroute(roomUrl);await p.locator('[data-poker-action="next"]').click();await p.locator('.poker-actions').waitFor();
    await context.route('**/api/poker/rooms/*/hint',async route=>{const response=await route.fetch(),data=await response.json();await route.fulfill({response,json:{...data,version:data.version+1,equity:.999}});});
    await p.locator('[data-poker-action="hint"]').click();await p.waitForFunction(()=>!document.querySelector('[data-poker-action="hint"]').disabled);assert(await p.locator('.poker-ev').count()===0,'Hint from another version must not display');await context.unroute('**/api/poker/rooms/*/hint');
    let left=false,releaseLeave;const leaveGate=new Promise(r=>releaseLeave=r);releases.push(releaseLeave);
    await context.route('**/api/poker/rooms/*/action',async route=>{if(route.request().postDataJSON().action!=='leave')return route.continue();const response=await route.fetch();left=true;await leaveGate;await route.fulfill({response});});
    p.on('dialog',d=>d.accept());await p.locator('[data-poker-action="leave"]').click();await wait(()=>left);await p.locator('[data-screen="poker-game"] [data-poker-action="setup"]').click();await p.locator('[data-screen="poker"] [data-screen-link="home"]').click();releaseLeave();await p.waitForFunction(()=>saved.poker===null);assert(await p.evaluate(()=>activeScreen==='home'),'Leaving completion preserves navigation');
    return {lateCreateNavigation:true,stalePollIgnored:true,hintVersionGuard:true,lateLeaveCleared:true};
  }finally{releases.forEach(r=>r());await context.close();}
}

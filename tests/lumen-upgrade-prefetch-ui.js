async(page)=>{
 const browser=page.context().browser(),out='D:/Codex-artifacts/lumen-prefetch-20261029',assert=(ok,msg)=>{if(!ok)throw Error(msg);},results=[];
 for(const width of [375,768,1440,1920]){
  const context=await browser.newContext({viewport:{width,height:width===375?812:width===768?1024:width===1920?1080:900}}),p=await context.newPage(),errors=[],requests=[];
  await context.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));p.on('pageerror',e=>errors.push(e.message));
  let simultaneous=0,maxSimultaneous=0;
  await context.route('**/assets/lumen/weapon-icons/*.webp',async route=>{const id=new URL(route.request().url()).pathname.split('/').pop().replace(/-[0-9a-f]+\.webp$/,'');requests.push(id);simultaneous++;maxSimultaneous=Math.max(maxSimultaneous,simultaneous);await new Promise(done=>setTimeout(done,180));await route.continue();simultaneous--;});
  try{
   await p.goto('http://127.0.0.1:8081');
   const setup=await p.evaluate(async()=>{
    const engine=await import('/static/js/lumen/engine.mjs'),{normalizeMeta}=await import('/static/js/lumen/economy.mjs'),{WEAPONS}=await import('/static/js/lumen/catalog.mjs');
    const run=engine.createRun({seed:243,runId:'qa-weapon-prefetch'});run.spawnTimer=3;run.spawnedGuardians=3;run.spawnedElites=4;
    run.gems=[{x:100,y:0,value:run.xpNext,tier:1},{x:500,y:0,value:100,tier:3}];
    saved.lumen={meta:normalizeMeta({}),selection:{map:'garden',character:'scout'},run:engine.serialize(run)};
    return {plan:engine.upcomingUpgrade(run),weaponIds:Object.keys(WEAPONS)};
   });
   await p.locator('[data-lumen-action="open"]').click();await p.locator('[data-lumen-action="resume"]').click();await p.locator('#lumenStory:not([hidden])').waitFor();await p.locator('[data-story-action="skip"]').click();await p.locator('#lumenOverlay [data-lumen-action="continue"]').click();
   const promised=setup.plan.choices.filter(id=>setup.weaponIds.includes(id));
   await p.waitForFunction(ids=>ids.every(id=>document.documentElement.style.getPropertyValue('--lumen-weapon-'+id)),promised);
   await p.waitForTimeout(250);assert((await p.locator('#lumenTimer').innerText())!=='00:00'||await p.locator('#lumenLevel').innerText()==='Уровень 1 / 30','game must remain active during prefetch');
   const firstRequests=[...new Set(requests)];assert(firstRequests.every(id=>['spark',...promised].includes(id)),'unforetold weapon was downloaded: '+firstRequests.join(','));assert(firstRequests.length<24,'whole weapon catalog loaded');
   await p.keyboard.down('d');await p.waitForTimeout(550);await p.keyboard.up('d');await p.locator('.lumen-upgrade-dialog').waitFor();
   const first=await p.evaluate(()=>saved.lumen.run),offered=first.choices.filter(id=>setup.weaponIds.includes(id));assert(JSON.stringify(offered)===JSON.stringify(promised),'displayed weapons differ from the forecast');
   for(const id of offered)assert((await p.locator('.lumen-upgrades [data-weapon-icon="'+id+'"]').evaluate(el=>getComputedStyle(el).backgroundImage)).includes('blob:'),'offered image did not reuse decoded prefetch '+id);
   await p.screenshot({path:out+'/iteration1-upgrade-'+width+'.png'});
   const choice=offered.find(id=>!first.upgrades[id])||offered[0];await p.locator('[data-lumen-action="upgrade"][data-lumen-value="'+choice+'"]').click();
   const after=await p.evaluate(()=>saved.lumen.run),next=after.nextUpgrade;
   assert(next&&next.level===3,'choice did not prepare level3 while playing');const nextWeapons=next.choices.filter(id=>setup.weaponIds.includes(id));
   await p.waitForFunction(ids=>ids.every(id=>document.documentElement.style.getPropertyValue('--lumen-weapon-'+id)),nextWeapons);
   await p.keyboard.press('Escape');await p.locator('#lumenOverlay [data-lumen-action="exit"]').click();await p.reload();await p.locator('[data-lumen-action="open"]').click();await p.locator('[data-lumen-action="resume"]').click();await p.locator('[data-story-action="skip"]').click();await p.locator('#lumenOverlay [data-lumen-action="continue"]').click();
   await p.keyboard.down('d');await p.waitForTimeout(2500);await p.keyboard.up('d');await p.locator('.lumen-upgrade-dialog').waitFor();
   const reloaded=await p.evaluate(()=>saved.lumen.run);assert(reloaded.level===3,'expected the next level after reload');assert(JSON.stringify(reloaded.choices.filter(id=>setup.weaponIds.includes(id)))===JSON.stringify(nextWeapons),'reload rerolled the forecast');
   await p.waitForFunction(ids=>ids.every(id=>document.documentElement.style.getPropertyValue('--lumen-weapon-'+id)),nextWeapons);
   await p.screenshot({path:out+'/iteration2-upgrade-'+width+'.png'});
   assert(!errors.length,JSON.stringify(errors));assert(maxSimultaneous<=2,'more than two parallel icon transfers');
   results.push({width,promised,offered,nextWeapons,firstRequests,requests,maxSimultaneous,errors});
  }finally{await context.close();}
 }
 {
  const context=await browser.newContext({viewport:{width:375,height:812}}),p=await context.newPage();let releaseIcon,requests=0;
  const gate=new Promise(done=>releaseIcon=done);
  await context.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));
  await context.route('**/weapon-icons/bell-*.webp',async route=>{requests++;await gate;return route.continue();});
  try{
   await p.goto('http://127.0.0.1:8081');await p.evaluate(async()=>{const engine=await import('/static/js/lumen/engine.mjs'),{normalizeMeta}=await import('/static/js/lumen/economy.mjs');const run=engine.createRun({seed:243,runId:'qa-delayed-bell'});run.spawnTimer=3;run.spawnedGuardians=3;run.spawnedElites=4;run.gems=[{x:100,y:0,value:run.xpNext,tier:1}];saved.lumen={meta:normalizeMeta({}),selection:{map:'garden',character:'scout'},run:engine.serialize(run)};});
   await p.locator('[data-lumen-action="open"]').click();await p.locator('[data-lumen-action="resume"]').click();await p.locator('[data-story-action="skip"]').click();await p.locator('#lumenOverlay [data-lumen-action="continue"]').click();
   await p.waitForFunction(()=>document.querySelector('#lumenTimer')?.textContent==='00:01');assert(requests===1,'expected one held Bell transfer');assert(!await p.evaluate(()=>document.documentElement.style.getPropertyValue('--lumen-weapon-bell')),'held image unexpectedly became ready');
   await p.keyboard.down('d');await p.waitForTimeout(550);await p.keyboard.up('d');await p.locator('.lumen-upgrade-dialog').waitFor();await p.locator('[data-lumen-action="upgrade"][data-lumen-value="bell"]').click();assert(await p.evaluate(()=>saved.lumen.run.status==='playing'&&saved.lumen.run.upgrades.bell===1),'choosing a weapon must not await its image');
   releaseIcon();await p.waitForFunction(()=>document.documentElement.style.getPropertyValue('--lumen-weapon-bell'));assert(requests===1,'opening the card duplicated a still-pending transfer');
   results.push({battleAdvancesWithPendingImage:true,canChooseWhilePending:true,heldTransferReused:true});
  }finally{releaseIcon();await context.close();}
 }
 const context=await browser.newContext({viewport:{width:375,height:812}}),p=await context.newPage(),errors=[],requested=[];
 await context.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));p.on('pageerror',e=>errors.push(e.message));
 let fail=true,active=0,maxActive=0;
 await context.route('**/weapon-icons/*.webp',async route=>{requested.push(route.request().url());active++;maxActive=Math.max(maxActive,active);try{await new Promise(done=>setTimeout(done,120));if(fail)return await route.abort('failed');return await route.continue();}finally{active--;}});
 try{
  await p.goto('http://127.0.0.1:8081');
  const first=await p.evaluate(async()=>{const icons=await import('/static/js/lumen/weapon-icons.mjs');return icons.preloadWeaponIcons(['eclipse','eclipse','invalid','sunlance','meteor']);});assert(first===false,'failed icon fetch should resolve false without throwing');assert(requested.length===3,'icon requests were not deduplicated');assert(maxActive===2,'prefetch should use at most two simultaneous transfers');
  const blocked=await p.evaluate(async()=>{const icons=await import('/static/js/lumen/weapon-icons.mjs');return icons.preloadWeaponIcons(['eclipse']);});assert(!blocked&&requested.length===3,'failed speculative requests must back off');
  fail=false;const recovered=await p.evaluate(async()=>{const icons=await import('/static/js/lumen/weapon-icons.mjs');return icons.preloadWeaponIcons(['eclipse'],{visible:true});});assert(recovered,'visible card should retry and recover');
  const count=requested.length;const cached=await p.evaluate(async()=>{const icons=await import('/static/js/lumen/weapon-icons.mjs');return icons.preloadWeaponIcons(['eclipse','eclipse']);});assert(cached&&requested.length===count,'decoded blob should prevent no-store refetch');assert(!errors.length,JSON.stringify(errors));
  fail=true;await p.evaluate(async()=>{const engine=await import('/static/js/lumen/engine.mjs'),{normalizeMeta}=await import('/static/js/lumen/economy.mjs');const run=engine.createRun({seed:243,runId:'qa-failed-weapon-icons'});run.spawnTimer=3;run.spawnedGuardians=3;run.spawnedElites=4;run.gems=[{x:100,y:0,value:run.xpNext,tier:1}];saved.lumen={meta:normalizeMeta({}),selection:{map:'garden',character:'scout'},run:engine.serialize(run)};});
  await p.locator('[data-lumen-action="open"]').click();await p.locator('[data-lumen-action="resume"]').click();await p.locator('[data-story-action="skip"]').click();await p.locator('#lumenOverlay [data-lumen-action="continue"]').click();await p.keyboard.down('d');await p.waitForTimeout(550);await p.keyboard.up('d');await p.locator('.lumen-upgrade-dialog').waitFor();
  await p.screenshot({path:out+'/failed-icons-playable-375.png'});await p.locator('[data-lumen-action="upgrade"]').first().click();assert(await p.evaluate(()=>saved.lumen.run.status==='playing'&&saved.lumen.run.level===2),'failed images must not block a real level choice');assert(!errors.length,JSON.stringify(errors));
  results.push({deduplicated:true,errorNonfatal:true,retryBackoff:true,recovered:true,noStoreReuse:true,failedImagesStillPlayable:true,maxActive,errors});
 }finally{await context.close();}
 return results;
}

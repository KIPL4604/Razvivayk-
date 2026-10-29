async(page)=>{
 const browser=page.context().browser(),origin='http://127.0.0.1:8081',out='D:/Codex-artifacts/lumen-story-20261029';
 const assert=(ok,message)=>{if(!ok)throw Error(message);};
 const context=await browser.newContext({viewport:{width:375,height:812}});
 await context.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));
 let failing=false,delay=800,requests=0;
 await context.route(/\/assets\/lumen\/sprites-\d+\.pack(?:\?.*)?$/,async route=>{
  requests++;if(failing)return route.abort('failed');await new Promise(resolve=>setTimeout(resolve,delay));return route.continue();
 });
 const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 async function enter(map='garden'){
  await p.goto(origin);await p.evaluate(async map=>{const {normalizeMeta}=await import('/static/js/lumen/economy.mjs');saved.lumen={meta:normalizeMeta({clearedMaps:['garden','quarry']}),selection:{map,character:'scout'}};},map);
  await p.locator('[data-lumen-action="open"]').click();await p.locator('.lumen-menu-nav [data-lumen-value="play"]').click();await p.locator('[data-lumen-action="start"]').click();
  await p.locator('#lumenStory:not([hidden])').waitFor();await p.locator('[data-story-action="skip"]').click();
 }
 try{
  await enter();await p.waitForFunction(()=>document.querySelector('#lumenLoadEta')?.textContent.startsWith('Примерно'));
  const loading=await p.evaluate(()=>({percent:Number(document.querySelector('[role="progressbar"][aria-label="Загрузка графики мира"]').getAttribute('aria-valuenow')),eta:document.querySelector('#lumenLoadEta').textContent,phase:document.querySelector('#lumenStory').dataset.phase}));
  assert(loading.percent>0&&loading.percent<100&&loading.phase==='loading','real partial-byte progress was not shown');
  await p.screenshot({path:out+'/iteration2-loading-375.png'});await p.locator('#lumenCanvas').waitFor();await p.keyboard.press('Escape');

  failing=true;await enter('quarry');await p.locator('#lumenStory[data-phase="error"]').waitFor();
  assert(await p.evaluate(()=>document.activeElement.dataset.storyAction)==='retry','retry focus missing');
  await p.keyboard.press('Tab');assert(await p.evaluate(()=>document.activeElement.dataset.storyAction)==='cancel','error focus does not reach cancel');
  await p.keyboard.press('Tab');assert(await p.evaluate(()=>document.activeElement.dataset.storyAction)==='retry','error focus does not wrap');
  await p.keyboard.press('Shift+Tab');assert(await p.evaluate(()=>document.activeElement.dataset.storyAction)==='cancel','reverse focus does not wrap');
  await p.screenshot({path:out+'/iteration2-loading-error-375.png'});
  failing=false;delay=250;await p.locator('[data-story-action="retry"]').click();await p.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await p.locator('#lumenOverlay [data-lumen-action="continue"]').waitFor();
  assert(await p.locator('#lumenStory').isHidden(),'successful retry left story overlay visible');
  assert((await p.locator('#lumenGoal').innerText()).includes('Лунный карьер'),'retry entered a different world');
  await p.evaluate(()=>window.dispatchEvent(new Event('focus')));await p.locator('#lumenOverlay [data-lumen-action="continue"]').click();await p.keyboard.press('Escape');
  assert(!errors.length,'Unexpected JavaScript errors: '+JSON.stringify(errors));
  return {loading,requests,errorAndRetry:true,keyboardFocusLoop:true,blurDuringLoadPauses:true,errors,scope:'Transfer latency/failure injected only in an isolated browser context; progress is still calculated from real downloaded pack bytes.'};
 }finally{await context.close();}
}

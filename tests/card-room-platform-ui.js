async page => {
  const base='http://127.0.0.1:8081',assert=(ok,msg)=>{if(!ok)throw Error(msg);},results=[];
  if(new URL(page.url()).origin!==base)throw Error('Use isolated QA server :8081');
  const browser=page.context().browser(),c=await browser.newContext({viewport:{width:375,height:812},hasTouch:true});c.setDefaultTimeout(8000);
  try{
    await c.route('https://telegram.org/js/telegram-web-app.js',r=>r.fulfill({body:''}));
    await c.route('**/static/js/cards/game.mjs*',r=>r.abort());const p=await c.newPage();await p.goto(base);
    await p.evaluate(()=>CardGames.enter('durak'));await p.locator('#cardGameMount [role="alert"]').waitFor();
    await c.unroute('**/static/js/cards/game.mjs*');await p.locator('[data-cardgame-action="reload"]').click();
    await p.locator('#campaignCards [data-cardgame-value="solitaire"]').click();await p.locator('#cardGameMount[data-game="solitaire"]').waitFor();
    const stock=await p.locator('.sol-stock').boundingBox();await p.touchscreen.tap(stock.x+stock.width/2,stock.y+stock.height/2);
    await p.waitForFunction(()=>saved.cardGames.runs.solitaire.waste.length===1);assert(await p.evaluate(()=>saved.cardGames.runs.solitaire.waste.length===1),'Real touch draw');
    await p.locator('[data-cardgame-action="exit"]').first().click();
    // pagehide of the previous game must not steal the home resume choice.
    await p.evaluate(()=>{saved.cardGames.touched.solitaire=10;saved.cardGames.lastTouchedAt=10;saveState();window.dispatchEvent(new Event('pagehide'));});
    assert(await p.evaluate(()=>saved.cardGames.touched.solitaire===10),'Inactive pagehide preserves last touched');
    const local=await p.evaluate(()=>JSON.stringify(saved.cardGames));
    await p.reload();assert(await p.evaluate(raw=>JSON.stringify(saved.cardGames)===raw,local),'Touch party saved');
    results.push('Lazy-load error/reload recovery, real touch draw, inactive pagehide and persistence');
  }finally{await c.close();}
  const mock=await browser.newContext({viewport:{width:375,height:812}});mock.setDefaultTimeout(8000);
  try{
    await mock.route('https://telegram.org/js/telegram-web-app.js',r=>r.fulfill({body:''}));
    await mock.addInitScript(()=>{
      window.__tgCalls=[];window.__tgEvents={};
      const api={initData:'qa-invalid-signature',initDataUnsafe:{user:{id:9000122,first_name:'Cards QA'}},viewportHeight:812,isFullscreen:false,
        safeAreaInset:{top:24,bottom:16,left:0,right:0},contentSafeAreaInset:{top:48,bottom:16,left:0,right:0},
        isVersionAtLeast(){return true;},ready(){},expand(){},setHeaderColor(){},setBackgroundColor(){},setBottomBarColor(){},enableClosingConfirmation(){},
        requestFullscreen(){this.isFullscreen=true;window.__tgCalls.push('fullscreen');(window.__tgEvents.fullscreenChanged||[]).forEach(fn=>fn());},
        exitFullscreen(){this.isFullscreen=false;window.__tgCalls.push('exit');(window.__tgEvents.fullscreenChanged||[]).forEach(fn=>fn());},
        disableVerticalSwipes(){window.__tgCalls.push('swipes-disabled');},onEvent(name,fn){(window.__tgEvents[name]||=[]).push(fn);},
        BackButton:{show(){},hide(){},onClick(fn){window.__tgBack=fn;}}};window.Telegram={WebApp:api};
    });
    const p=await mock.newPage();await p.goto(base);await p.locator('#campaignCards [data-cardgame-value="solitaire"]').click();await p.locator('#cardGameMount[data-game="solitaire"]').waitFor();
    const data=await p.evaluate(()=>({calls:window.__tgCalls,top:getComputedStyle(document.documentElement).getPropertyValue('--cardroom-safe-top'),height:document.querySelector('.cardroom.active').getBoundingClientRect().height}));
    assert(data.calls.includes('fullscreen')&&data.calls.includes('swipes-disabled')&&data.top==='48px'&&data.height===812,'SDK fullscreen/swipes/safe area adapter');
    await p.locator('[data-cardroom-action="fullscreen"]:visible').click();assert(await p.evaluate(()=>__tgCalls.includes('exit')),'SDK exit fullscreen');
    await p.locator('[data-cardroom-action="fullscreen"]:visible').click();await p.locator('[data-cardgame-action="draw"]').click();
    assert(await p.locator('[data-cardroom-action="fullscreen"]:visible').getAttribute('aria-pressed')==='true','SDK fullscreen state after move');
    await p.evaluate(()=>window.__tgBack());assert(await p.evaluate(()=>activeScreen==='cards'&&!document.documentElement.classList.contains('cardroom-active')),'Telegram BackButton returns to card library');
    assert(await p.evaluate(()=>!localStorage.getItem('teramont.razvivayka.game.v2:browser')?.includes('"solitaire"')),'Telegram save isolated from browser namespace');
    results.push('Telegram SDK mock: request/exit fullscreen, preserved state, swipes, safe areas, BackButton and account namespace; physical WebView untested');
  }finally{await mock.close();}
  return results;
}

async(page)=>{
  // Additional browser boundary tests. Use tests/serve_qa.py (:8081) only.
  const browser=page.context().browser(),base='http://127.0.0.1:8081',results=[];
  const assert=(v,m)=>{if(!v)throw Error(m);};
  const c=await browser.newContext({viewport:{width:375,height:812}}),p=await c.newPage();
  try{
    await p.route('**/static/js/lumen/game.mjs*',r=>r.abort());await p.goto(base);
    await p.locator('[data-lumen-action="open"]').click();await p.getByRole('alert').waitFor();
    await p.unroute('**/static/js/lumen/game.mjs*');await p.locator('[data-lumen-action="reload"]').click();
    await p.locator('[data-lumen-action="open"]').click();await p.locator('[data-lumen-action="start"]').waitFor();
    results.push('module fetch failure and explicit reload recovery');
    await p.locator('[data-lumen-action="start"]').click();await p.keyboard.press('Escape');await p.locator('[data-lumen-action="exit"]').click();
    await p.evaluate(()=>showScreen('home'));await p.locator('#campaignCards [data-chess-action="setup"]').click();
    await p.locator('#chessSetupMount button[type="submit"]').click();await p.locator('[data-chess-square="e2"]').waitFor();
    await p.waitForFunction(()=>document.querySelectorAll('[data-chess-square]').length===64);
    await p.waitForFunction(()=>document.querySelector('#chessTurnStatus').textContent.includes('Твой ход'));
    await p.locator('[data-chess-square="e2"]').click();await p.locator('[data-chess-square="e4"]').click();
    await p.waitForFunction(()=>saved.chess?.moves?.length>=2,null,{timeout:25000});
    results.push('Lumen exit, chess 64 squares, e2-e4 and real Stockfish reply');
    await p.evaluate(()=>showScreen('home'));await p.locator('#campaignCards [data-poker-action="setup"]').click();
    await p.locator('[data-poker-action="solo"]').click();await p.locator('.poker-table').waitFor();
    await p.locator('[data-poker-action="hint"]').click();await p.locator('.poker-ev').waitFor();
    assert(await p.evaluate(()=>!document.documentElement.classList.contains('lumen-active')),'Scroll lock leaked into poker');
    results.push('real poker solo and mathematical hint after Lumen');
  }finally{await c.close();}
  const mock=await browser.newContext({viewport:{width:375,height:812}});
  try{
    await mock.route('https://telegram.org/js/telegram-web-app.js',r=>r.fulfill({body:'',contentType:'text/javascript'}));
    await mock.addInitScript(()=>{
      window.__tgCalls=[];window.__tgEvents={};
      window.Telegram={WebApp:{initData:'qa-invalid-signature',initDataUnsafe:{user:{id:9000111,first_name:'QA'}},viewportHeight:812,
        safeAreaInset:{top:24,bottom:16,left:0,right:0},contentSafeAreaInset:{top:48,bottom:16,left:0,right:0},
        isVersionAtLeast(){return true;},ready(){},expand(){},setHeaderColor(){},setBackgroundColor(){},setBottomBarColor(){},enableClosingConfirmation(){},
        requestFullscreen(){window.__tgCalls.push('fullscreen');},disableVerticalSwipes(){window.__tgCalls.push('swipes-disabled');},
        onEvent(name,fn){(window.__tgEvents[name]||=[]).push(fn);},BackButton:{show(){},hide(){},onClick(fn){window.__tgBack=fn;}}}};
    });
    const q=await mock.newPage();await q.goto(base);await q.locator('[data-lumen-action="open"]').click();await q.locator('[data-lumen-action="start"]').click();
    await q.evaluate(()=>window.__tgBack());await q.getByRole('dialog').waitFor();
    const data=await q.evaluate(()=>({calls:window.__tgCalls,top:getComputedStyle(document.documentElement).getPropertyValue('--lumen-safe-top'),height:document.querySelector('#lumenCanvas').getBoundingClientRect().height}));
    assert(data.calls.filter(s=>s==='fullscreen').length>=2&&data.calls.includes('swipes-disabled'),'Telegram methods not invoked');
    assert(data.top==='48px'&&data.height===812,'Telegram safe area/height');
    await q.locator('[data-lumen-action="continue"]').click();await q.evaluate(()=>window.__tgEvents.deactivated.forEach(fn=>fn()));await q.getByRole('dialog').waitFor();
    results.push('Telegram SDK mock: fullscreen, swipes, safe areas, BackButton and deactivation pause (not physical WebView acceptance)');
  }finally{await mock.close();}
  return results;
}

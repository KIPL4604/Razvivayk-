async page => {
  // Screenshot matrix for tests/serve_qa.py; uses a fresh isolated browser context.
  const base='http://127.0.0.1:8081';
  if(new URL(page.url()).origin!==base)throw Error('Use isolated QA server :8081');
  const context=await page.context().browser().newContext();context.setDefaultTimeout(10000);
  const out='C:/Users/1234567890/Desktop/PHANTOM_PROJECTS_COLLECTED_2026-09-20/01 Проекты/01 В работе/Развивайка — Teramont/output/playwright/';
  const results=[],errors=[],assert=(ok,msg)=>{if(!ok)throw Error(msg);};
  const settle=async p=>{await p.evaluate(async()=>{await Promise.all(document.getAnimations().filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});};
  try{
    await context.route('https://telegram.org/js/telegram-web-app.js',r=>r.fulfill({body:''}));
    const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);
    for(const [width,height] of [[375,812],[768,1024],[1440,900],[1920,1080]]){
      await p.setViewportSize({width,height});await p.evaluate(()=>showScreen('cards'));await settle(p);
      await p.screenshot({path:out+'card-room-library-'+width+'-iteration2.png'});
      for(const game of ['durak','blackjack','solitaire','poker']){
        if(game==='poker'){await p.locator('.club-game-poker').click();await p.locator(await p.locator('[data-poker-action="resume"]').count()?'[data-poker-action="resume"]':'[data-poker-action="solo"]').click();await p.locator('.poker-table').waitFor();}
        else{await p.locator('.club-game-'+game).click();await p.locator('#cardGameMount[data-game="'+game+'"]').waitFor();if(game==='durak')await p.waitForFunction(()=>saved.cardGames.runs.durak.turn===0||saved.cardGames.runs.durak.status!=='playing');}
        await settle(p);await p.screenshot({path:out+'card-room-'+game+'-'+width+'-iteration2.png'});
        const bounds=await p.evaluate(game=>{const root=document.querySelector('.cardroom.active'),head=root.querySelector('.cardroom-toolbar'),foot=root.querySelector('.table-footer,.poker-table-footer');return {game,width:innerWidth,height:innerHeight,top:head.getBoundingClientRect().top,bottom:foot.getBoundingClientRect().bottom,overflow:root.scrollWidth>root.clientWidth||root.scrollHeight>root.clientHeight,scrollTop:root.scrollTop,mount:root.querySelector('#cardGameMount,#pokerMount').scrollTop};},game);
        assert(bounds.top>=0&&bounds.bottom<=height&&!bounds.overflow&&!bounds.scrollTop&&!bounds.mount,'One-screen bounds '+JSON.stringify(bounds));results.push(bounds);
        await p.evaluate(()=>showScreen('cards'));
      }
    }
    await p.setViewportSize({width:812,height:375});
    await p.evaluate(async()=>{const {createSolitaire,restoreSolitaire}=await import('/static/js/cards/solitaire.mjs');const s=createSolitaire({seed:43}),ranks='KQJT98765432A',run=[...ranks].map((rank,i)=>rank+(i%2?'h':'s')),all=[...'shdc'].flatMap(suit=>[...'A23456789TJQK'].map(rank=>rank+suit)),hidden=all.filter(c=>!run.includes(c)).slice(0,6);s.tableau=Array.from({length:7},()=>[]);s.tableau[0]=[...hidden.map(card=>({card,faceUp:false})),...run.map(card=>({card,faceUp:true}))];s.foundations=Array.from({length:4},()=>[]);s.waste=[];s.stock=all.filter(c=>!run.includes(c)&&!hidden.includes(c));s.history=[];s.moves=0;s.redeals=0;if(!restoreSolitaire(s))throw Error('Invalid long fixture');saved.cardGames.runs.solitaire=s;saveState();});
    await p.locator('.club-game-solitaire').click();await p.locator('#cardGameMount[data-game="solitaire"]').waitFor();await settle(p);
    const long=await p.evaluate(()=>({card:document.querySelector('.sol-column .sol-card:last-child').getBoundingClientRect().bottom,footer:document.querySelector('.table-footer').getBoundingClientRect().top,step:getComputedStyle(document.querySelector('.sol-columns')).getPropertyValue('--sol-step')}));
    assert(long.card<long.footer,'19-card landscape column clears controls '+JSON.stringify(long));results.push({landscapeLongColumn:long});
    await p.screenshot({path:out+'card-room-solitaire-812x375-long-iteration2.png'});
    await p.locator('[data-cardgame-action="rules"]').click();await p.screenshot({path:out+'card-room-rules-812x375-iteration2.png'});
    assert(await p.locator('#cardGameDialog').evaluate(d=>d.scrollHeight>d.clientHeight),'Long rules scroll inside dialog');
    await p.keyboard.press('Escape');await p.emulateMedia({reducedMotion:'reduce'});await p.locator('[data-cardgame-action="draw"]').click();await settle(p);
    assert(await p.evaluate(()=>document.getAnimations().length===0),'Reduced motion has no flights');
    assert(errors.length===0,errors.join('; '));return {results,errors};
  }finally{await context.close();}
}

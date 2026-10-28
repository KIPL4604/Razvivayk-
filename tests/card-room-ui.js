async page => {
  // Playwright MCP function. Only tests/serve_qa.py, isolated context/database.
  const base='http://127.0.0.1:8081',assert=(ok,message)=>{if(!ok)throw Error(message);};
  if(new URL(page.url()).origin!==base)throw Error('Use isolated QA server :8081');
  const context=await page.context().browser().newContext({viewport:{width:375,height:812},reducedMotion:'reduce'});
  context.setDefaultTimeout(10000);
  const errors=[],results=[];
  try{
    await context.route('https://telegram.org/js/telegram-web-app.js',r=>r.fulfill({body:''}));
    // Accelerate only the UI opponent delay; legal moves still use the real engine.
    await context.addInitScript(()=>{const original=window.setTimeout;window.setTimeout=(fn,delay,...args)=>original(fn,delay===650?5:delay,...args);});
    const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
    await p.goto(base);await p.locator('[data-screen-link="cards"]:visible').first().click();
    assert(await p.locator('.club-game').count()===4,'Four actual card games in own tab');
    await p.locator('.club-game-durak').click();await p.locator('#cardGameMount[data-game="durak"]').waitFor();
    await p.waitForFunction(()=>saved.cardGames.runs.durak.turn===0);
    await p.locator('[data-cardgame-action="rules"]').focus();await p.keyboard.press('Enter');
    assert(await p.locator('#cardGameDialog').evaluate(d=>d.open),'Keyboard rules');
    const paused=await p.evaluate(()=>JSON.stringify(saved.cardGames.runs.durak));
    await p.evaluate(()=>new Promise(r=>setTimeout(r,30)));
    assert(await p.evaluate(s=>JSON.stringify(saved.cardGames.runs.durak)===s,paused),'Rules pause opponent');
    await p.keyboard.press('Escape');assert(await p.locator('dialog[open]').count()===0,'Escape closes rules');
    let humanMoves=0;
    for(let turn=0;turn<500;turn++){
      await p.waitForFunction(()=>saved.cardGames.runs.durak.status!=='playing'||saved.cardGames.runs.durak.turn===0);
      const a=await p.evaluate(async()=>{const s=saved.cardGames.runs.durak;if(s.status!=='playing')return null;const {legalDurak}=await import('/static/js/cards/durak.mjs');return legalDurak(s,0)[0];});
      if(!a)break;
      if(a.card){
        const index=await p.evaluate(c=>saved.cardGames.runs.durak.hands[0].indexOf(c),a.card),targetPage=Math.floor(index/6);
        const current=await p.locator('.hand-pages>span').count()?Number((await p.locator('.table-hand-label>span').last().innerText()).split('/')[0])-1:0;
        for(let n=current;n<targetPage;n++)await p.locator('[data-cardgame-action="page"][data-cardgame-value="1"]').click();
        for(let n=current;n>targetPage;n--)await p.locator('[data-cardgame-action="page"][data-cardgame-value="-1"]').click();
        await p.locator('[data-cardgame-action="select"][data-cardgame-value="'+a.card+'"]').click();await p.locator('[data-cardgame-action="play"]').click();
      }else await p.locator('[data-cardgame-action="'+a.type+'"]').click();
      humanMoves++;
    }
    const end=await p.evaluate(()=>saved.cardGames.runs.durak);
    assert(end.status!=='playing'&&humanMoves>5,'Full Durak match through visible controls');
    assert(end.hands.flat().length+end.stock.length+end.discard.length+end.table.reduce((n,x)=>n+1+!!x.defense,0)===36,'36 cards conserved');
    results.push({durakFullMatch:true,humanMoves,result:end.status});
    await p.locator('[data-cardgame-action="exit"]').first().click();
    // Deterministic Blackjack fixture: actual UI moves and a genuinely hidden dealer card.
    await p.evaluate(async()=>{const {createBlackjack}=await import('/static/js/cards/blackjack.mjs');let s;for(let seed=1;seed<100;seed++){s=createBlackjack({seed});if(s.status==='playing')break;}saved.cardGames.runs.blackjack=s;saveState();});
    await p.locator('.club-game-blackjack').click();await p.locator('#cardGameMount[data-game="blackjack"]').waitFor();
    const concealed=await p.evaluate(()=>({code:saved.cardGames.runs.blackjack.dealer[1],html:document.querySelector('.blackjack-dealer-hand').innerHTML}));
    assert(!concealed.html.includes('data-card="'+concealed.code+'"')&&!concealed.html.includes('data-card-code="'+concealed.code+'"'),'Dealer hole absent from DOM');
    await p.locator('[data-cardgame-action="double"]').click();
    assert(await p.evaluate(()=>saved.cardGames.runs.blackjack.wager===2&&saved.cardGames.runs.blackjack.status!=='playing'),'Double draws then resolves');
    results.push('Blackjack hidden hole, double and terminal result');
    await p.locator('[data-cardgame-action="exit"]').first().click();
    await p.locator('.club-game-solitaire').click();await p.locator('#cardGameMount[data-game="solitaire"]').waitFor();
    const before=await p.evaluate(()=>JSON.stringify(saved.cardGames.runs.solitaire));
    await p.locator('[data-cardgame-action="draw"]').click();await p.locator('[data-cardgame-action="undo"]').click();
    assert(await p.evaluate(s=>JSON.stringify(saved.cardGames.runs.solitaire)===s,before),'Solitaire draw and exact undo');
    await p.locator('[data-cardgame-action="draw"]').click();const snapshot=await p.evaluate(()=>JSON.stringify(saved.cardGames.runs.solitaire));
    await p.reload();await p.locator('[data-resume="cards"]').click();await p.locator('#cardGameMount[data-game="solitaire"]').waitFor();
    assert(await p.evaluate(s=>JSON.stringify(saved.cardGames.runs.solitaire)===s,snapshot),'Reload restores party exactly');
    await p.locator('[data-cardroom-action="fullscreen"]:visible').click();await p.waitForFunction(()=>!!document.fullscreenElement);
    await p.locator('[data-cardgame-action="draw"]').click();assert(await p.locator('[data-cardroom-action="fullscreen"]:visible').getAttribute('aria-pressed')==='true','Fullscreen state survives render');
    await p.mouse.wheel(0,600);assert(await p.evaluate(()=>document.querySelector('#main').scrollTop===0&&document.querySelector('#cardGameMount').scrollTop===0&&scrollY===0),'No game scrolling');
    await p.locator('[data-cardgame-action="exit"]').first().click();await p.waitForFunction(()=>!document.fullscreenElement);
    assert(await p.evaluate(()=>!document.documentElement.classList.contains('cardroom-active')),'Exit releases fullscreen and scroll lock');
    // Damaged save containers must remain JSON-persistable, never array properties.
    await p.evaluate(()=>{saved.cardGames.runs=[];saveState();});
    await p.locator('.club-game-solitaire').click();await p.locator('#cardGameMount[data-game="solitaire"]').waitFor();
    assert(await p.evaluate(()=>!Array.isArray(JSON.parse(JSON.stringify(saved.cardGames)).runs)&&!!JSON.parse(JSON.stringify(saved.cardGames)).runs.solitaire),'Array corruption recovered');
    results.push('Solitaire exact undo, reload, corrupt-map recovery, real browser fullscreen and scroll lock');
    // Reach a real winning action from a complete, valid 51-card fixture, then undo it.
    await p.locator('[data-cardgame-action="exit"]').first().click();
    await p.evaluate(async()=>{const {createSolitaire,restoreSolitaire}=await import('/static/js/cards/solitaire.mjs');const s=createSolitaire({seed:43}),ranks='A23456789TJQK';s.foundations=[...'shdc'].map((suit,i)=>[...ranks.slice(0,i===3?12:13)].map(r=>r+suit));s.tableau=Array.from({length:7},()=>[]);s.tableau[0]=[{card:'Kc',faceUp:true}];s.stock=[];s.waste=[];s.history=[];s.moves=0;s.redeals=0;if(!restoreSolitaire(s))throw Error('Invalid victory fixture');saved.cardGames.runs.solitaire=s;saveState();});
    await p.locator('.club-game-solitaire').click();await p.locator('#cardGameMount[data-game="solitaire"]').waitFor();
    assert(await p.locator('[data-cardgame-action="draw"]').isDisabled(),'Empty stock and waste disabled');
    await p.locator('[data-cardgame-action="sol-source"][data-cardgame-value="tableau:0:0"]').click();await p.locator('[data-cardgame-action="foundation"]').click();
    assert(await p.evaluate(()=>saved.cardGames.runs.solitaire.status==='won'),'Winning foundation move');
    await p.locator('[data-cardgame-action="undo"]').click();assert(await p.evaluate(()=>saved.cardGames.runs.solitaire.status==='playing'&&saved.cardGames.runs.solitaire.tableau[0][0].card==='Kc'),'Undo winning move');
    results.push('Solitaire victory through legal UI move, empty deck disabled, terminal undo');
    assert(errors.length===0,'Browser JS errors: '+errors.join('; '));
    return {results,errors};
  }finally{await context.close();}
}

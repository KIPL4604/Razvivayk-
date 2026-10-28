async page => {
  const base='http://127.0.0.1:8081',out='D:/Codex-artifacts/ui-essential-20261029/';
  if(new URL(page.url()).origin!==base)throw Error('Use isolated QA server :8081');
  const ctx=await page.context().browser().newContext({viewport:{width:375,height:812},hasTouch:true});
  ctx.setDefaultTimeout(10000);
  const errors=[],results=[],assert=(ok,msg)=>{if(!ok)throw Error(msg);};
  await ctx.route('https://telegram.org/js/telegram-web-app.js',r=>r.fulfill({body:''}));
  const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
  const settle=()=>p.evaluate(async()=>{await Promise.all(document.getAnimations().filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  const run=()=>p.evaluate(()=>JSON.stringify(saved.cardGames.runs));
  async function fixture(game){
    await p.evaluate(async game=>{
      showScreen('cards');saved.cardGames??={runs:{}};saved.cardGames.runs??={};
      if(game==='durak'){
        const {createDurak}=await import('/static/js/cards/durak.mjs');
        for(let seed=1;seed<100;seed++){const s=createDurak({seed});if(s.turn===0){saved.cardGames.runs.durak=s;break;}}
      }else if(game==='solitaire'){
        const {createSolitaire,restoreSolitaire}=await import('/static/js/cards/solitaire.mjs');const s=createSolitaire({seed:43});
        const all=[...'shdc'].flatMap(suit=>[...'A23456789TJQK'].map(rank=>rank+suit));
        s.tableau=Array.from({length:7},()=>[]);s.tableau[0]=[{card:'Ks',faceUp:true},{card:'Qh',faceUp:true}];
        s.foundations=Array.from({length:4},()=>[]);s.waste=[];s.stock=all.filter(c=>!['Ks','Qh'].includes(c));
        s.history=[];s.moves=0;s.redeals=0;if(!restoreSolitaire(s))throw Error('Bad stack fixture');saved.cardGames.runs.solitaire=s;
      }else{
        const {createBlackjack}=await import('/static/js/cards/blackjack.mjs');
        for(let seed=1;seed<100;seed++){const s=createBlackjack({seed});if(s.status==='playing'){saved.cardGames.runs.blackjack=s;break;}}
      }
      saveState();CardGames.enter(game);
    },game);
    await p.locator('#cardGameMount[data-game="'+game+'"]').waitFor();await settle();
  }
  async function drag(source,target,{touch=false,cancel=false}={}){
    const a=await source.boundingBox(),b=await target.boundingBox();
    const start={x:a.x+a.width/2,y:a.y+Math.min(8,a.height/2)},end={x:b.x+b.width/2,y:b.y+Math.min(40,b.height/2)};
    if(touch){
      const cdp=await ctx.newCDPSession(p),send=(type,point)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:point?[{id:1,...point}]:[]});
      await send('touchStart',start);
      for(let i=1;i<=12;i++)await send('touchMove',{x:start.x+(end.x-start.x)*i/12,y:start.y+(end.y-start.y)*i/12});
      await send(cancel?'touchCancel':'touchEnd');await cdp.detach();
    }else{
      await p.mouse.move(start.x,start.y);await p.mouse.down();
      // Move vertically first, distinguishing a deliberate drag from sorting.
      await p.mouse.move(start.x,start.y-18,{steps:3});await p.mouse.move(end.x,end.y,{steps:12});await p.mouse.up();
    }
    await settle();
  }
  try{
    await p.goto(base);await fixture('durak');await p.locator('.hand-card').first().click();await settle();
    let before=await run();await drag(p.locator('.hand-card').first(),p.locator('.cardroom.active .cardroom-toolbar'));
    assert(await run()===before,'Invalid drop must preserve state');
    assert(await p.locator('.durak-pairs.card-drop-ready').count()===1,'Invalid drop retains selected card targets');
    await drag(p.locator('.hand-card').first(),p.locator('.durak-pairs'),{touch:true,cancel:true});
    assert(await run()===before&&await p.locator('.card-drag-ghost').count()===0,'Touch cancellation preserves state and clears ghost');
    await drag(p.locator('.hand-card').first(),p.locator('.durak-pairs'),{touch:true});
    assert(await run()!==before,'Native touch drop plays a legal card');results.push('Durak native touch, invalid drop, pointercancel');
    await fixture('durak');before=await run();
    const value=await p.locator('.hand-card').first().getAttribute('data-cardgame-value');
    await p.locator('.hand-card').first().click();await settle();assert(await run()===before,'First tap selects only');
    assert(await p.locator('.durak-pairs.card-drop-ready').count()===1,'Selected card highlights legal table');
    await p.locator('[data-cardgame-value="'+value+'"].hand-card').click();await settle();assert(await run()!==before,'Second tap plays');
    await fixture('durak');before=await run();await p.locator('.hand-card').first().focus();await p.keyboard.press('Enter');
    await settle();await p.locator('.durak-pairs').focus();await p.keyboard.press('Enter');await settle();
    assert(await run()!==before,'Keyboard select and table Enter');
    await fixture('durak');before=await run();await p.locator('[data-cardgame-action="menu"]').click();await p.locator('[data-cardgame-action="sort"]').click();await settle();
    assert(await run()===before,'Sort changes only presentation');
    const sortLabel=await p.locator('#cardGameMount').getAttribute('data-hand-sort'),hand=await p.locator('.hand-card').first().boundingBox();
    await p.mouse.move(hand.x+hand.width/2,hand.y+35);await p.mouse.down();await p.mouse.move(hand.x+hand.width/2+80,hand.y+35,{steps:10});await p.mouse.up();await settle();
    assert(await p.locator('#cardGameMount').getAttribute('data-hand-sort')!==sortLabel&&await run()===before,'Horizontal swipe sorts without playing');
    results.push('Durak double tap, keyboard, legal highlight, swipe and button sorting');
    await fixture('solitaire');before=await run();
    await drag(p.locator('[data-cardgame-value="tableau:0:0"]'),p.locator('.sol-column').nth(2));
    assert(await p.evaluate(()=>saved.cardGames.runs.solitaire.tableau[2].map(e=>e.card).join(',')==='Ks,Qh'),'Whole stack drag');
    await p.keyboard.press('KeyZ');await settle();assert(await run()===before,'Z restores exact pre-drag state');
    await drag(p.locator('[data-cardgame-value="tableau:0:0"]'),p.locator('.sol-column').nth(3),{touch:true});
    assert(await p.evaluate(()=>saved.cardGames.runs.solitaire.tableau[3].length===2),'Native touch stack');
    await p.locator('[data-cardgame-action="undo"]').click();await settle();assert(await run()===before,'Undo touch stack');
    results.push('Solitaire whole-stack mouse/touch, exact undo');
    await fixture('blackjack');await p.keyboard.press('KeyD');await settle();
    assert(await p.evaluate(()=>saved.cardGames.runs.blackjack.wager===2&&saved.cardGames.runs.blackjack.status!=='playing'),'Blackjack keyboard double');
    results.push('Blackjack D executes actual double');
    for(const iteration of [1,2])for(const [width,height] of [[375,812],[768,1024],[1440,900],[1920,1080]]){
      await p.setViewportSize({width,height});
      for(const game of ['durak','blackjack','solitaire']){
        await fixture(game);
        if(game==='durak')await p.locator('.hand-card').first().click();
        await settle();await p.screenshot({path:out+`controls-${game}-${width}-iteration${iteration}.png`});
        const bounds=await p.evaluate(()=>{const root=document.querySelector('.cardroom.active'),foot=root.querySelector('.table-footer').getBoundingClientRect();return {overflow:root.scrollWidth>root.clientWidth||root.scrollHeight>root.clientHeight,bottom:foot.bottom,height:innerHeight};});
        assert(!bounds.overflow&&bounds.bottom<=height,'One screen '+JSON.stringify({game,width,...bounds}));
      }
    }
    await p.emulateMedia({reducedMotion:'reduce'});await fixture('solitaire');
    await p.locator('[data-cardgame-action="draw"]').click();assert(await p.evaluate(()=>document.getAnimations().length===0),'Reduced motion');
    await p.locator('[data-cardgame-action="rules"]').click();before=await run();await p.keyboard.press('KeyZ');assert(await run()===before,'Modal blocks shortcuts');
    assert(errors.length===0,'Page errors: '+errors.join(';'));return {results,viewports:4,iterations:2,errors};
  }finally{await ctx.close();}
}

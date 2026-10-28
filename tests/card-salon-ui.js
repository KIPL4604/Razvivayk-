async page=>{
  const base='http://127.0.0.1:8081',out='D:/Codex-artifacts/card-salon-20261029/';
  if(new URL(page.url()).origin!==base)throw Error('Use isolated QA server :8081');
  const ctx=await page.context().browser().newContext({viewport:{width:375,height:812},hasTouch:true});
  ctx.setDefaultTimeout(10000);const errors=[],badAssets=[],assert=(b,m)=>{if(!b)throw Error(m);};
  await ctx.route('https://telegram.org/js/telegram-web-app.js',r=>r.fulfill({body:''}));
  const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
  p.on('response',r=>{if(r.url().includes('/static/')&&r.status()>=400)badAssets.push(r.url());});
  const settle=f=>f.evaluate(async()=>{await Promise.all(document.getAnimations().filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  async function fixture(f,game,pairs=false){
    await f.evaluate(async({game,pairs})=>{
      showScreen('cards');saved.cardGames??={runs:{}};saved.cardGames.runs??={};
      if(game==='durak'){
        const {createDurak,legalDurak,actDurak}=await import('/static/js/cards/durak.mjs');let chosen;
        for(let seed=1;seed<2000;seed++){
          const s=createDurak({seed});if(s.turn!==0)continue;
          if(pairs)for(let i=0;i<4;i++){const a=legalDurak(s).find(a=>a.card);if(!a)break;actDurak(s,a);}
          if(!pairs||(s.table.length===2&&s.table.every(x=>x.defense)&&s.turn===0)){chosen=s;break;}
        }
        if(!chosen)throw Error('No legal two-pair fixture');saved.cardGames.runs.durak=chosen;
      }else if(game==='blackjack'){
        const {createBlackjack,total}=await import('/static/js/cards/blackjack.mjs');
        for(let seed=1;seed<1000;seed++){const s=createBlackjack({seed});if(s.status==='playing'&&total(s.player).value===18){saved.cardGames.runs.blackjack=s;break;}}
      }else{
        const {createSolitaire,actSolitaire}=await import('/static/js/cards/solitaire.mjs');const s=createSolitaire({seed:43});actSolitaire(s,{type:'draw'});saved.cardGames.runs.solitaire=s;
      }
      saveState();CardGames.enter(game);
    },{game,pairs});
    await f.locator('#cardGameMount[data-game="'+game+'"]').waitFor();await settle(f);
  }
  try{
    await p.goto(base);await fixture(p,'durak');
    const card=await p.locator('.hand-card').first().boundingBox(),zone=await p.locator('.durak-pairs').boundingBox();
    assert(zone.height>150&&zone.width>150,'Broad center target');
    const point={x:card.x+card.width/2,y:card.y+12},end={x:zone.x+zone.width/2,y:zone.y+zone.height/2};
    const cdp=await ctx.newCDPSession(p),send=(type,t)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:t?[{id:1,...t}]:[]});
    await send('touchStart',point);for(let i=1;i<=12;i++)await send('touchMove',{x:point.x+(end.x-point.x)*i/12,y:point.y+(end.y-point.y)*i/12});
    const flight=await p.locator('.card-drag-ghost').boundingBox();assert(flight&&Math.abs(flight.y-(end.y-12))<15,'Card follows native finger into center');
    await p.screenshot({path:out+'durak-native-center-drag.png'});await send('touchEnd');await cdp.detach();
    await p.waitForFunction(()=>saved.cardGames.runs.durak.table.length===1);await settle(p);
    const placed=await p.locator('.attack-card').boundingBox();assert(Math.abs(placed.x+placed.width/2-end.x)<40,'Played card stays at center');
    await p.screenshot({path:out+'durak-native-center-drop.png'});
    await p.emulateMedia({reducedMotion:'reduce'});await p.evaluate(()=>showScreen('cards'));await settle(p);
    for(const [width,height] of [[375,812],[768,1024],[1440,900],[1920,1080]]){
      await p.setViewportSize({width,height});await settle(p);await p.screenshot({path:out+`library-${width}-final.png`});
      assert(await p.evaluate(()=>document.querySelector('#main').scrollWidth<=document.querySelector('#main').clientWidth),'Library overflow');
    }
    await p.setViewportSize({width:375,height:812});await p.locator('.club-game-poker').click();
    await settle(p);await p.screenshot({path:out+'poker-setup-375-final.png'});await p.locator('[data-poker-action="solo"]').click();await p.locator('.poker-table').waitFor();
    for(const [width,height] of [[1280,720],[375,667],[812,375]]){
      await p.setViewportSize({width,height});await settle(p);
      const b=await p.evaluate(()=>{const root=document.querySelector('.cardroom.active'),bottom=document.querySelector('.poker-table-bottom').getBoundingClientRect(),table=document.querySelector('.poker-table').getBoundingClientRect(),controls=document.querySelector('.poker-controls').getBoundingClientRect();return {overflow:root.scrollHeight>root.clientHeight||root.scrollWidth>root.clientWidth,bottom:bottom.bottom,table:table.bottom,controls:controls.top};});
      assert(!b.overflow&&b.bottom<=b.table&&b.bottom<b.controls,'Poker cards clear controls '+JSON.stringify({width,height,...b}));await p.screenshot({path:out+`poker-compact-${width}-${height}.png`});
    }
    await p.setViewportSize({width:375,height:812});await p.emulateMedia({reducedMotion:'reduce'});
    assert(await p.evaluate(()=>document.getAnimations().length===0),'No bandana motion with reduced motion');
    await p.locator('[data-poker-action="rules"]').click();assert(await p.locator('#pokerRules').evaluate(d=>d.open),'Rules open');await p.keyboard.press('Escape');
    assert(await p.locator('dialog[open]').count()===0,'Rules Escape');
    await p.emulateMedia({reducedMotion:'no-preference'});
    const bandana=await p.evaluate(()=>{const a=document.querySelector('.cardroom.active .cardroom-bandana i');return {image:getComputedStyle(a).backgroundImage,motion:getComputedStyle(a,'::after').animationName};});
    assert(bandana.image.includes('bandana.webp')&&bandana.motion==='bandana-light','Real fabric asset and light animation');
    const light=await p.evaluate(()=>{const a=document.getAnimations().find(a=>a.animationName==='bandana-light'),old=a.currentTime;a.currentTime=4000;const first=getComputedStyle(a.effect.target,'::after').transform;a.currentTime=10000;const second=getComputedStyle(a.effect.target,'::after').transform;a.currentTime=old;return {first,second};});
    assert(light.first!==light.second,'Bandana light actually moves');
    // Comparison board uses four live app iframes; it is not a painted mockup.
    await ctx.route(base+'/qa/card-salon-proof',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at top,#4a3823,transparent 55%),#100e0c;color:#f0e1bd;font-family:Georgia,serif;padding:28px 43px}header{text-align:center;letter-spacing:.35em;font:12px Arial,sans-serif;margin-bottom:30px}main{display:grid;grid-template-columns:repeat(4,375px);gap:22px}h2{font-weight:400;font-size:35px;text-align:center;margin:0 0 17px}iframe{display:block;width:375px;height:812px;border:0;border-radius:24px;box-shadow:0 16px 40px #0008}footer{text-align:center;margin-top:22px;font:12px Arial,sans-serif;letter-spacing:.1em;color:#bba984}</style></head><body><header>TERAMONT · КАРТОЧНЫЙ ЗАЛ</header><main>${[['durak','Дурак'],['poker','Покер'],['blackjack','Блэкджек'],['solitaire','Косынка']].map(([id,title])=>`<section><h2>${title}</h2><iframe id="${id}" src="/" title="${title}"></iframe></section>`).join('')}</main><footer>РАБОТАЮЩИЙ ИНТЕРФЕЙС · 375 × 812 · EDGE</footer></body></html>`}));
    const proof=await ctx.newPage();proof.on('pageerror',e=>errors.push(e.message));await proof.setViewportSize({width:1652,height:982});await proof.goto(base+'/qa/card-salon-proof');
    for(const game of ['durak','blackjack','solitaire']){const f=proof.frameLocator('#'+game);await f.locator('#campaignCards button').first().waitFor();const frame=await(await proof.locator('#'+game).elementHandle()).contentFrame();await fixture(frame,game,game==='durak');}
    const poker=await(await proof.locator('#poker').elementHandle()).contentFrame();await poker.evaluate(()=>{saved.poker=null;showScreen('cards');});await poker.locator('.club-game-poker').click();await poker.locator('[data-poker-action="solo"]').click();await poker.locator('.poker-table').waitFor();
    const call=poker.locator('[data-poker-action="call"]:not(:disabled)');if(await call.count()){await call.click();await poker.waitForFunction(()=>document.querySelectorAll('.poker-board .poker-card').length>=3);}
    for(const f of proof.frames().slice(1))await settle(f);
    await proof.screenshot({path:out+'four-games-live-final.png'});
    assert(!errors.length,errors.join(';'));assert(!badAssets.length,badAssets.join(';'));
    return {nativeCenterDrag:true,placedAtCenter:true,libraryWidths:4,compactPoker:3,reducedMotion:true,bandana,light,errors,badAssets,proof:out+'four-games-live-final.png'};
  }finally{await ctx.close();}
}

async page=>{
  const base='http://127.0.0.1:8081',out='D:/Codex-artifacts/ui-essential-20261029/';
  if(new URL(page.url()).origin!==base)throw Error('Use isolated QA server');
  const ctx=await page.context().browser().newContext({viewport:{width:375,height:812},hasTouch:true,reducedMotion:'reduce'});
  ctx.setDefaultTimeout(10000);await ctx.route('https://telegram.org/js/telegram-web-app.js',r=>r.fulfill({body:''}));
  const p=await ctx.newPage(),errors=[],checks=[];p.on('pageerror',e=>errors.push(e.message));
  const assert=(b,m)=>{if(!b)throw Error(m);};
  const settle=f=>f.evaluate(async()=>{await Promise.all(document.getAnimations().filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  async function durak(f){
    await f.evaluate(async()=>{
      const {createDurak,actDurak,legalDurak,botDurak}=await import('/static/js/cards/durak.mjs');let chosen;
      for(let seed=1;seed<100&&!chosen;seed++){
        const s=createDurak({seed});for(let i=0;i<500&&s.status==='playing';i++){
          if(s.turn===0&&s.stock.length===0&&s.hands[0].length>6){chosen=s;break;}
          const legal=legalDurak(s);const a=s.turn===1?botDurak(s):legal.find(a=>a.type==='take')||legal[0];if(!a||!actDurak(s,a))break;
        }
      }
      if(!chosen)throw Error('No legal empty-stock paged-hand fixture');
      saved.cardGames??={runs:{}};saved.cardGames.runs??={};saved.cardGames.runs.durak=chosen;saveState();CardGames.enter('durak');
    });await f.locator('#cardGameMount[data-game="durak"]').waitFor();await settle(f);
  }
  try{
    await p.goto(base);await p.evaluate(()=>showScreen('cards'));await settle(p);
    assert(await p.locator('.brand-mark,.brand-caption,.club-library-heading .eyebrow,.club-game-heading>span').count()===0,'Marked brand/repeated copy removed');
    assert(await p.locator('.club-game').count()===4,'All card game actions remain');
    await durak(p);
    assert(await p.locator('.table-hand-label').count()===0,'Marked hand row removed');
    assert(await p.locator('.cardroom.active .cardroom-title>span').count()===0,'Repeated card-room heading removed');
    assert(await p.locator('.stock-trump').isVisible(),'Trump visible with empty stock');
    const position=await p.evaluate(()=>{const t=document.querySelector('.stock-trump').getBoundingClientRect(),d=document.querySelector('.table-stock').getBoundingClientRect();return {trump:t.x,deck:d.right,delta:Math.abs(t.top-d.top)};});
    assert(position.trump>=position.deck-3&&position.delta<12,'Trump next to stock '+JSON.stringify(position));
    const cards=await p.locator('.hand-card').evaluateAll(nodes=>nodes.map(n=>n.dataset.cardgameValue));
    await p.locator('[data-cardgame-action="page"][data-cardgame-value="1"]').click();
    assert(await p.locator('#cardGameMount').getAttribute('data-hand-page')==='1','Next page works');
    assert(JSON.stringify(await p.locator('.hand-card').evaluateAll(nodes=>nodes.map(n=>n.dataset.cardgameValue)))!==JSON.stringify(cards),'Actual next cards shown');
    await p.locator('[data-cardgame-action="menu"]').click();assert(await p.locator('dialog[open]').count()===1,'Menu works');
    await p.locator('[data-cardgame-action="sort"]').click();assert(await p.locator('#cardGameMount').getAttribute('data-hand-sort')==='suit','Sort moved into menu');
    assert(await p.locator('dialog[open]').count()===0,'Sort resumes game');
    checks.push('Empty-stock trump, >6 cards paging, menu sorting');await p.evaluate(()=>document.querySelector('#toast')?.classList.add('hidden'));
    for(const iteration of [1,2])for(const [width,height] of [[375,812],[768,1024],[1440,900],[1920,1080]]){
      await p.setViewportSize({width,height});
      for(const screen of ['home','cards','levels','profile','chess','poker']){
        await p.evaluate(screen=>{if(screen==='levels')selectCampaign('arithmetic');else showScreen(screen);},screen);await settle(p);
        const root=p.locator('[data-screen="'+screen+'"]');await root.waitFor({state:'visible'});
        assert(await p.evaluate(()=>{const e=document.querySelector('#main');return e.scrollWidth<=e.clientWidth;}),'Page fits '+screen+'/'+width);
        await p.screenshot({path:out+`${screen}-${width}-iteration${iteration}.png`});
      }
      await durak(p);await p.screenshot({path:out+`durak-paged-${width}-iteration${iteration}.png`});
      const b=await p.locator('.table-footer').boundingBox();assert(b.y+b.height<=height,'Game footer fits');
    }
    await p.setViewportSize({width:375,height:812});await p.evaluate(()=>selectCampaign('arithmetic'));
    assert(await p.locator('#campaignTitle').innerText()==='Устный счёт','Reference game title');
    assert((await p.locator('#campaignProgressText').innerText()).includes('из 100'),'Reference progress retained');
    await p.locator('#playCurrentLevel').click();await p.waitForFunction(()=>activeScreen==='game');
    assert(await p.locator('#gameMount button').count()>0,'Campaign actually starts');checks.push('Reference campaign and all information screens retain real actions');
    // Visual choices: outlines/numbers are added only in this isolated review board.
    await ctx.route(base+'/qa/info-choices',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#151711;color:#f3e8cb;padding:24px;font:14px Arial,sans-serif}h1{font:28px Georgia,serif;margin:0 0 20px}main{display:grid;grid-template-columns:repeat(4,375px);gap:22px}h2{font-size:16px;font-weight:500;margin:0 0 12px}iframe{width:375px;height:812px;border:0;border-radius:15px}p{max-width:375px;line-height:1.6;color:#c7b997}</style><h1>Оставлено для твоего выбора</h1><main><section><h2>1 · Статус синхронизации</h2><iframe id="library" src="/"></iframe><p>Служебная строка над содержимым.</p></section><section><h2>2 · Подсказка и перелистывание</h2><iframe id="durak" src="/"></iframe><p>Подсказка хода и диапазон показанных карт.</p></section><section><h2>3 · Пояснения к покеру</h2><iframe id="poker" src="/"></iframe><p>Учебный блок и ограничения режима.</p></section><section><h2>4 · Описания сложности</h2><iframe id="chess" src="/"></iframe><p>Чем отличаются шахматные соперники.</p></section></main>`}));
    const proof=await ctx.newPage();await proof.setViewportSize({width:1614,height:994});await proof.goto(base+'/qa/info-choices');
    const getFrame=async id=>(await proof.locator('#'+id).elementHandle()).contentFrame();
    const library=await getFrame('library');await library.locator('#campaignCards button').first().waitFor();await library.evaluate(()=>showScreen('cards'));await settle(library);
    const d=await getFrame('durak');await d.locator('#campaignCards button').first().waitFor();await durak(d);
    const poker=await getFrame('poker');await poker.locator('#campaignCards button').first().waitFor();await poker.evaluate(()=>showScreen('poker'));await settle(poker);await poker.locator('.poker-learning-note').scrollIntoViewIfNeeded();
    async function mark(frame,selector){await frame.evaluate(selector=>{for(const el of document.querySelectorAll(selector)){el.style.outline='2px dashed #ebc06c';el.style.outlineOffset='3px';}},selector);}
    const chess=await getFrame('chess');await chess.locator('#campaignCards button').first().waitFor();await chess.evaluate(()=>showScreen('chess'));await settle(chess);await mark(chess,'.chess-level-description');await chess.evaluate(()=>document.activeElement?.blur());
    await mark(library,'.connection-banner');await mark(d,'.table-message,.hand-pages');await mark(poker,'.poker-learning-note,.poker-telegram-note');
    await proof.screenshot({path:out+'uncertain-choices.png'});
    assert(!errors.length,errors.join(';'));return {checks,widths:4,iterations:2,errors,choices:out+'uncertain-choices.png'};
  }finally{await ctx.close();}
}

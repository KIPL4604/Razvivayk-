async page => {
  const ctx=await page.context().browser().newContext({viewport:{width:375,height:812},reducedMotion:'reduce'}),p=await ctx.newPage(), errors=[];
  const out='C:/Users/1234567890/Desktop/PHANTOM_PROJECTS_COLLECTED_2026-09-20/01 Проекты/01 В работе/Развивайка — Teramont/output/playwright/';
  const assert=(b,m)=>{if(!b)throw Error(m)};p.on('pageerror',e=>errors.push(e.message));
  await ctx.route('https://telegram.org/js/telegram-web-app.js',r=>r.fulfill({body:''}));
  try{
    await p.goto('http://127.0.0.1:8081');
    const info=await p.evaluate(async()=>{
      const {createDurak,legalDurak,actDurak,restoreDurak}=await import('/static/js/cards/durak.mjs');let large=null, crowded=null;
      for(let seed=1;seed<=300&&(!large||!crowded);seed++){
        const s=createDurak({seed});for(let i=0;i<300&&s.status==='playing';i++){
          if(s.turn===0&&s.hands[0].length>6&&!large)large=structuredClone(s);
          if(s.turn===0&&s.table.length>=4&&!crowded)crowded=structuredClone(s);
          const legal=legalDurak(s,s.turn);if(!legal.length)break;
          const a=(s.turn===0?legal.find(x=>x.type==='take'):null)||legal.find(x=>x.card)||legal[0];actDurak(s,a);
        }
      }
      if(!large||!crowded||!restoreDurak(large)||!restoreDurak(crowded))throw Error('Could not generate valid fixtures');
      window.__durakFixtures={large,crowded};return {large:large.hands[0].length,pairs:crowded.table.length};
    });
    for(const [w,h] of [[375,812],[375,667],[768,1024],[1440,900],[1920,1080],[812,375]]){
      await p.setViewportSize({width:w,height:h});
      for(const kind of ['large','crowded']){
        await p.evaluate(kind=>{showScreen('cards');saved.cardGames??={runs:{}};saved.cardGames.runs??={};saved.cardGames.runs.durak=structuredClone(window.__durakFixtures[kind]);saveState();CardGames.enter('durak')},kind);
        await p.locator('#cardGameMount[data-game="durak"]').waitFor();await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
        const b=await p.evaluate(()=>{const root=document.querySelector('.cardroom.active'),hand=document.querySelector('.table-hand').getBoundingClientRect(),foot=document.querySelector('.table-footer').getBoundingClientRect(),opponent=document.querySelector('.table-opponent').getBoundingClientRect(),pairs=[...document.querySelectorAll('.durak-pair')].map(e=>e.getBoundingClientRect());return {overflow:root.scrollWidth>root.clientWidth||root.scrollHeight>root.clientHeight,hand:hand.toJSON(),footer:foot.toJSON(),opponent:opponent.toJSON(),pairs:pairs.map(x=>x.toJSON())}});
        assert(!b.overflow&&b.footer.bottom<=h,'Overflow '+JSON.stringify({w,h,kind,b}));
        assert(b.pairs.every(r=>r.bottom<=b.hand.top+5),'Pairs overlap hand '+JSON.stringify({w,h,kind,b}));
        assert(b.pairs.every(r=>r.top>=b.opponent.bottom-1),'Pairs overlap opponent '+JSON.stringify({w,h,kind,b}));
        if(kind==='large'&&w<=600){await p.locator('[data-cardgame-action="page"][data-cardgame-value="1"]').click();assert(await p.locator('#cardGameMount').getAttribute('data-hand-page')==='1','Next hand page');}
        if(w===375||w===1440)await p.screenshot({path:out+`durak-ergonomics-${kind}-${w}x${h}.png`});
      }
    }
    assert(!errors.length,errors.join('; '));return {fixtures:info,viewports:6,errors};
  }finally{await ctx.close()}
}

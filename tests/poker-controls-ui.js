async page => {
  const base='http://127.0.0.1:8081',out='D:/Codex-artifacts/card-salon-20261029/';
  if(new URL(page.url()).origin!==base)throw Error('Use isolated QA server :8081');
  const ctx=await page.context().browser().newContext();ctx.setDefaultTimeout(12000);
  const errors=[],assert=(ok,msg)=>{if(!ok)throw Error(msg);};
  await ctx.route('https://telegram.org/js/telegram-web-app.js',r=>r.fulfill({body:''}));
  const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
  const state=()=>p.evaluate(async()=>{const r=await fetch('/api/poker/rooms/'+saved.poker.roomId,{headers:{'X-Poker-Token':saved.poker.token}});if(!r.ok)throw Error('Room GET '+r.status);return r.json();});
  const settle=()=>p.evaluate(async()=>{await Promise.all(document.getAnimations().filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
  try{
    await p.goto(base);await p.evaluate(()=>showScreen('cards'));await p.locator('.club-game-poker').click();await p.locator('[data-poker-action="solo"]').click();
    await p.locator('#pokerRaiseAmount').waitFor();const initial=await state();
    for(const value of ['min','half','pot','max']){
      await p.locator('[data-poker-action="preset"][data-poker-value="'+value+'"]').click();
      const n=Number(await p.locator('#pokerRaiseAmount').inputValue()),me=initial.players.find(x=>x.isYou);
      const raw=value==='min'?initial.minRaiseTo:value==='max'?initial.maxRaiseTo:me.bet+initial.toCall+Math.round((initial.pot+initial.toCall)*(value==='half'?.5:1));
      assert(n===Math.max(initial.minRaiseTo,Math.min(initial.maxRaiseTo,raw)),value+' preset total');
      assert((await state()).version===initial.version,'Preset does not submit a bet');
    }
    for(const iteration of [1,2])for(const [width,height] of [[375,812],[768,1024],[1440,900],[1920,1080]]){
      await p.setViewportSize({width,height});await settle();await p.screenshot({path:out+`controls-poker-${width}-iteration${iteration}.png`});
      const b=await p.locator('.poker-controls').boundingBox();assert(b.y+b.height<=height,'Controls fit '+width);
      assert(await p.evaluate(()=>{const e=document.querySelector('.cardroom.active');return e.scrollWidth<=e.clientWidth&&e.scrollHeight<=e.clientHeight;}),'No overflow');
    }
    await p.locator('[data-poker-action="preset"][data-poker-value="half"]').click();
    const amount=Number(await p.locator('#pokerRaiseAmount').inputValue());await p.locator('#pokerRaiseForm button[type="submit"]').click();
    await p.waitForFunction(()=>!document.querySelector('.poker-controls')?.innerText.includes('Сохраняем ход'));
    let s=await state();assert(s.version>initial.version,'Raise submitted to server');
    assert(s.players.find(x=>x.isYou).stack<=1000-amount,'Actual stack deducted');
    for(let i=0;i<12&&s.phase==='playing';i++){
      const a=s.legalActions.includes('check')?'check':'call';
      await p.locator('[data-poker-action="'+a+'"]:not(:disabled)').click();
      await p.waitForFunction(()=>!document.querySelector('.poker-controls')?.innerText.includes('Сохраняем ход'));s=await state();
    }
    assert(['complete','finished'].includes(s.phase),'Actual hand resolved');assert(s.players.reduce((n,x)=>n+x.stack,0)===2000,'Chips conserved');
    assert(!errors.length,errors.join(';'));return {presets:4,submittedAmount:amount,result:s.phase,viewports:4,iterations:2,errors};
  }finally{await ctx.close();}
}

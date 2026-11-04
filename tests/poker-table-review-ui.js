async page => {
 const ctx=await page.context().browser().newContext({viewport:{width:375,height:812}}), p=await ctx.newPage();
 const out='C:/Users/1234567890/Desktop/PHANTOM_PROJECTS_COLLECTED_2026-09-20/01 Проекты/01 В работе/Развивайка — Teramont/output/playwright/';
 const errors=[];p.on('pageerror',e=>errors.push(e.message));await ctx.route('https://telegram.org/js/telegram-web-app.js',r=>r.fulfill({body:''}));
 try{
 await p.goto('http://127.0.0.1:8081');await p.evaluate(()=>showScreen('cards'));await p.locator('.club-game-poker').click();await p.locator('[data-poker-action="solo"]').click();await p.locator('.poker-table').waitFor();
 for(const [w,h] of [[375,812],[768,1024],[1440,900],[1920,1080],[812,375]]){
  await p.setViewportSize({width:w,height:h});await p.screenshot({path:out+`poker-review-${w}-closed.png`});
  const btn=p.locator('[data-poker-action="toggle-raise"]');await btn.focus();await p.keyboard.press('Enter');if(await btn.getAttribute('aria-expanded')!=='true')throw Error('toggle did not open');
  await p.screenshot({path:out+`poker-review-${w}-open.png`});
  const bounds=await p.evaluate(()=>{const root=document.querySelector('.cardroom.active'),e=document.querySelector('.poker-controls'),board=document.querySelector('.poker-board');return {overflow:root.scrollHeight>root.clientHeight||root.scrollWidth>root.clientWidth,controls:e.getBoundingClientRect().bottom,view:innerHeight,board:board.getBoundingClientRect().toJSON()}});
  if(bounds.overflow||bounds.controls>h)throw Error('open controls overflow '+JSON.stringify(bounds));
  await btn.click();if(await btn.getAttribute('aria-expanded')!=='false')throw Error('toggle did not close');
 }
 await p.setViewportSize({width:375,height:812});await p.locator('[data-poker-action="toggle-raise"]').click();const inp=p.locator('#pokerRaiseAmount');const min=await inp.inputValue();await p.locator('[data-poker-action="preset"][data-poker-value="max"]').click();if(Number(await inp.inputValue())<=Number(min))throw Error('preset');await p.locator('[data-poker-action="preset"][data-poker-value="min"]').click();
 const before=await p.evaluate(async()=>{const r=await fetch('/api/poker/rooms/'+saved.poker.roomId,{headers:{'X-Poker-Token':saved.poker.token}});return (await r.json()).version;});
 await p.locator('#pokerRaiseForm button[type="submit"]').click();await p.waitForFunction(v=>Number(document.querySelector('#pokerMount')?.dataset.version)>v,before);if(errors.length)throw Error(errors.join('; '));return {viewports:5,keyboard:true,presets:true,raise:true,errors};
 }finally{await ctx.close();}
}

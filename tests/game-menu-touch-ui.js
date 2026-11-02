async(page)=>{
 const context=await page.context().browser().newContext({viewport:{width:375,height:812},hasTouch:true,isMobile:true});
 const p=await context.newPage(),checks=[];
 const assert=(v,m)=>{if(!v)throw Error(m);checks.push(m);};
 try{
  await p.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));await p.goto('http://127.0.0.1:8080/');await p.locator('#hubSearch').waitFor();
  const session=await context.newCDPSession(p);
  async function swipe(x,y,dx){await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=8;i++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/8,y:y+2}]});await p.waitForTimeout(16);}await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(240);}
  await swipe(300,160,-220);assert(await p.locator('[data-screen="articles"]').isVisible(),'Real touch: hub next page');
  await swipe(70,160,220);assert(await p.locator('[data-screen="home"]').isVisible(),'Real touch: hub previous page');
  await p.locator('[data-lumen-action="open"]').click();await p.locator('.lumen-title-screen').waitFor();await p.locator('[data-lumen-value="characters"]').click();
  await swipe(295,225,-210);assert(await p.locator('.lumen-shell').getAttribute('data-page')==='weapons','Real touch: Lumen next window');
  await swipe(75,225,220);assert(await p.locator('.lumen-shell').getAttribute('data-page')==='characters','Real touch: Lumen previous window');
  const video=p.locator('.lumen-menu-reel');await p.waitForFunction(()=>document.querySelector('.lumen-menu-reel').readyState>=2);
  const duration=await video.evaluate(v=>v.duration);
  await video.evaluate(v=>{v.currentTime=14.6;return v.play();});await p.waitForTimeout(1000);
  assert(await video.evaluate(v=>!v.ended&&v.currentTime<2),'Lumen 15-second reel loops');
  await p.emulateMedia({reducedMotion:'reduce'});await p.waitForFunction(()=>document.querySelector('.lumen-menu-reel').paused);assert(await video.evaluate(v=>v.paused),'OS reduced motion stops reel');
  await p.emulateMedia({reducedMotion:'no-preference'});await p.locator('.lumen-window-toolbar button').click();await p.locator('[data-lumen-action="catalog"]').click();
  assert(await video.evaluate(v=>v.paused),'Leaving menu stops reel');
  await p.locator('[data-sp-action="open"]').click();await p.locator('[data-sp-action="settings"]').click();
  await swipe(295,210,-210);assert(await p.locator('.sp-shell').getAttribute('data-mode')==='help','Real touch: Specimen help window');
  await swipe(70,210,220);assert(await p.locator('.sp-shell').getAttribute('data-mode')==='settings','Real touch: Specimen settings window');
  await p.locator('[data-sp-action="settings-back"]').first().click();await p.locator('[data-sp-action="exit"]').click();
  await p.locator('#campaignCards [data-campaign="sudoku"]').click();const map=p.locator('#levelMap');await map.scrollIntoViewIfNeeded();const r=await map.boundingBox();
  await swipe(300,Math.min(650,r.y+100),-220);assert(await p.locator('.hub-chapter-pager > span').textContent()==='Глава 2 / 10','Real touch: chapter next');await p.locator('[data-chapter-page="-1"]').click();assert(await p.locator('.hub-chapter-pager > span').textContent()==='Глава 1 / 10','Chapter button alternative');
  await p.evaluate(async()=>{showScreen('home');const {createDurak}=await import('/static/js/cards/durak.mjs');const run=createDurak({seed:18});run.attacker=run.turn=0;run.hands[0].push(...run.stock.splice(0,2));saved.cardGames={runs:{durak:run}};});
  await p.locator('[data-cardgame-action="open"][data-cardgame-value="durak"]').click();await p.locator('.hand-card').first().waitFor();const hand=await p.locator('.table-hand').boundingBox();
  await swipe(hand.x+hand.width*.7,hand.y+hand.height*.6,-160);assert(await p.locator('#cardGameMount').getAttribute('data-hand-page')==='1','Real touch: paginated cards');await p.locator('[data-cardgame-action="page"][data-cardgame-value="-1"]').click();assert(await p.locator('#cardGameMount').getAttribute('data-hand-page')==='0','Card page button alternative');
  return {checks,duration};
 }finally{await context.close();}
}

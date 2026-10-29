async(page)=>{
 const results=[],browser=page.context().browser(),out='D:/Codex-artifacts/lumen-story-20261029';
 for(const [width,height,map]of [[375,812,'garden'],[768,1024,'quarry'],[1440,900,'castle'],[1920,1080,'castle'],[375,667,'quarry'],[812,375,'garden']]){
  const context=await browser.newContext({viewport:{width,height}});
  await context.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  try{
   await p.goto('http://127.0.0.1:8081');
   await p.evaluate(async map=>{const {normalizeMeta}=await import('/static/js/lumen/economy.mjs');saved.lumen={meta:normalizeMeta({clearedMaps:['garden','quarry']}),selection:{map,character:'scout'}};},map);
   await p.locator('[data-lumen-action="open"]').click();await p.locator('.lumen-menu-nav [data-lumen-value="play"]').click();await p.locator('[data-lumen-action="start"]').click();
   await p.locator('#lumenStory:not([hidden])').waitFor();await p.locator('[data-story-action="advance"]').click();await p.evaluate(()=>document.fonts.ready);
   const layout=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,portrait:document.querySelector('.lumen-story-stage img').naturalWidth,focus:document.activeElement.dataset.storyAction}));
   if(layout.overflow||layout.portrait!==384||errors.length)throw Error(JSON.stringify({width,layout,errors}));
   await p.screenshot({path:out+`/iteration2-intro-${map}-${width}x${height}.png`});
   await p.keyboard.press('Tab');if(await p.evaluate(()=>document.activeElement.dataset.storyAction)!=='cancel')throw Error('dialogue Tab focus');
   await p.keyboard.press('Tab');if(await p.evaluate(()=>document.activeElement.dataset.storyAction)!=='skip')throw Error('dialogue focus wrap');
   await p.keyboard.press('Escape');if(!await p.locator('#lumenStory').isHidden())throw Error('Escape cancellation');
   results.push({width,height,map,layout,errors});
  }finally{await context.close();}
 }
 return results;
}

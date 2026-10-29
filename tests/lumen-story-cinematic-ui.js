async(page)=>{
 const browser=page.context().browser(),out='D:/Codex-artifacts/lumen-dialogue-20261029',results=[];
 const assert=(ok,msg)=>{if(!ok)throw Error(msg);};
 for(const [width,height,map]of [[375,812,'garden'],[768,1024,'quarry'],[1440,900,'castle'],[1920,1080,'crater'],[375,667,'quarry'],[812,375,'castle']]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',hasTouch:width===375}),p=await context.newPage(),errors=[],requests=[];
  await context.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.url().includes('story-world-'))requests.push(r.url());});
  try{
   await p.goto('http://127.0.0.1:8081');
   await p.evaluate(async map=>{const {StoryOverlay}=await import('/static/js/lumen/story-overlay.mjs'),{worldScene}=await import('/static/js/lumen/story.mjs');window.qaStory=new StoryOverlay();window.qaStory.play(worldScene(map,'before'),{hero:'Хранитель',heroId:'keeper'});},map);
   await p.locator('.lumen-story-landscape picture img').evaluate(img=>img.decode());await p.evaluate(()=>document.fonts.ready);
   const target=map==='quarry'?4:map==='castle'?2:map==='garden'?1:0;
   for(let n=0;n<target;n++)await p.locator('[data-story-action="advance"]').click();
   const layout=await p.evaluate(()=>{const root=document.querySelector('#lumenStory'),rect=root.querySelector('[data-story-action="cancel"]').getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,scroll:root.scrollHeight,height:innerHeight,hero:root.querySelector('.lumen-story-hero').naturalWidth,art:root.querySelector('.lumen-story-landscape picture img').naturalWidth,side:root.dataset.speaker,radio:root.dataset.radio,visibleBubbles:root.querySelectorAll('.lumen-story-bubble:not([hidden])').length,exitVisible:rect.bottom<=innerHeight};});
   assert(!layout.overflow&&layout.hero===192&&layout.art===(width<768?768:1536),'broken image or overflow '+JSON.stringify({width,layout}));
   assert(layout.exitVisible,'exit clipped '+JSON.stringify({width,layout}));if(map!=='crater')assert(layout.visibleBubbles===2,'both speakers need their own visible bubble');
   await p.screenshot({path:out+`/iteration2-battle-${map}-${width}x${height}.png`});
   await p.keyboard.press('Tab');assert(await p.evaluate(()=>document.activeElement.dataset.storyAction)==='cancel','Tab cancel');await p.keyboard.press('Tab');assert(await p.evaluate(()=>document.activeElement.dataset.storyAction)==='skip','Tab wrap');await p.keyboard.press('Escape');assert(await p.locator('#lumenStory').isHidden(),'Escape close');
   assert(!errors.length,JSON.stringify(errors));assert(requests.length===1,'only selected world image should load '+requests.join(','));
   results.push({width,height,map,layout,errors});
  }finally{await context.close();}
 }
 const context=await browser.newContext({viewport:{width:375,height:812},reducedMotion:'reduce'}),p=await context.newPage(),errors=[];
 await context.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.goto('http://127.0.0.1:8081');
  const heroes=await p.evaluate(async()=>Object.keys((await import('/static/js/lumen/catalog.mjs')).CHARACTERS));
  for(const hero of heroes){
   await p.evaluate(async hero=>{const {StoryOverlay}=await import('/static/js/lumen/story-overlay.mjs'),{worldScene}=await import('/static/js/lumen/story.mjs'),{CHARACTERS}=await import('/static/js/lumen/catalog.mjs');window.qaStory||=new StoryOverlay();window.qaStory.play(worldScene('garden'),{hero:CHARACTERS[hero].name,heroId:hero});},hero);
   await p.locator('.lumen-story-hero').evaluate(img=>img.decode());await p.locator('[data-story-action="advance"]').click();
   assert((await p.locator('#lumenStorySpeaker').innerText()).length>0,'selected hero speaker absent');
   assert((await p.locator('.lumen-story-hero').getAttribute('src')).includes('story-hero-'+hero+'.png'),'wrong selected hero image');
   assert(await p.locator('[data-side="partner"] .lumen-story-words').innerText()!==await p.locator('#lumenStoryText').innerText(),'opposite bubble should retain the previous line');
  }
  await p.locator('[data-story-action="skip"]').click();
  await p.emulateMedia({reducedMotion:'no-preference'});
  await p.evaluate(async()=>{const {worldScene}=await import('/static/js/lumen/story.mjs');window.qaStory.play(worldScene('quarry','before'));});
  const before=await p.locator('.is-active .lumen-story-bubble').boundingBox();await p.locator('[data-story-action="advance"]').click();const after=await p.locator('.is-active .lumen-story-bubble').boundingBox();
  assert(Math.abs(before.height-after.height)<1&&Math.abs(before.y-after.y)<1,'letter printing must not move or resize the dialogue window');
  await p.locator('[data-story-action="skip"]').click();await p.emulateMedia({reducedMotion:'reduce'});
  await context.route('**/story-world-*.webp',r=>r.abort('failed'));
  await p.evaluate(async()=>{const {worldScene}=await import('/static/js/lumen/story.mjs');window.qaStory.play(worldScene('castle'));});
  await p.locator('.lumen-story-landscape.is-unavailable').waitFor();assert((await p.locator('#lumenStoryText').innerText()).length>0,'image failure must not block readable dialogue');await p.locator('[data-story-action="skip"]').click();
  assert(await p.locator('#lumenStory').isHidden(),'image failure blocks skipping');assert(!errors.length,JSON.stringify(errors));results.push({all12HeroPortraits:true,previousLineRetained:true,stableTypewriterWindow:true,imageFailureFallback:true,errors});
 }finally{await context.close();}
 return {results,scope:'Layout uses the production StoryOverlay public API and production scene data. Separate lumen-story-ui.js exercises real game entry, combat checkpoints and persistence.'};
}

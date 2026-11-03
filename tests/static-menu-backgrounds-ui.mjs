import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE});
const origin=process.env.QA_ORIGIN||'http://127.0.0.1:8080',out=path.resolve('output/static-menu-backgrounds');await mkdir(out,{recursive:true});
const iteration=process.env.QA_ITERATION||'i1',checks=[],errors=[],requests=[];
const ok=(v,label)=>{assert.ok(v,label);checks.push(label);};
const context=await browser.newContext({viewport:{width:375,height:812},hasTouch:true,isMobile:true}),p=await context.newPage();
p.on('pageerror',error=>errors.push(error.message));p.on('request',request=>requests.push(request.url()));
await p.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));
const waitLumen=()=>p.waitForFunction(()=>{const image=document.querySelector('.lumen-menu-background');return image?.complete&&image.naturalWidth>0;});
const waitSpecimen=()=>p.waitForFunction(()=>{const image=document.querySelector('.sp-menu-background');return image?.complete&&image.naturalWidth>0;});
async function close(){await p.evaluate(()=>showScreen('home'));}
let releaseFull;
const fullGate=new Promise(resolve=>{releaseFull=resolve;});
await p.route('**/menu-backgrounds/garden.webp?*',async route=>{await fullGate;await route.continue();});
try{
 await p.goto(origin);await p.locator('#hubSearch').waitFor();
 for(const [clearedMaps,expected]of [[[],'garden'],[['garden'],'quarry'],[['garden','quarry'],'castle'],[['castle'],'garden']]){
  await p.evaluate(async clearedMaps=>{const{normalizeMeta}=await import('/static/js/lumen/economy.mjs');saved.lumen={meta:normalizeMeta({clearedMaps}),selection:{map:'garden',character:'scout'}};LumenMode.enter();},clearedMaps);
  await waitLumen();ok(await p.locator('.lumen-menu-background').getAttribute('data-background-map')===expected,'Latest accessible Lumen map '+JSON.stringify(clearedMaps)+' -> '+expected);
  ok(await p.locator('video').count()===0,'Lumen menu contains no video');
  if(!clearedMaps.length){
   const downloaded=requests.filter(url=>url.includes('/menu-backgrounds/'));
   ok(downloaded.some(url=>url.includes('/garden-preview.webp'))&&downloaded.every(url=>/\/garden(?:-preview)?\.webp/.test(url)),'Initial menu downloads only its accessible map');
   ok(await p.locator('.lumen-menu-background').evaluate(img=>img.naturalWidth===320),'Menu opens with a decoded map preview while full frame is stalled');
   await p.screenshot({path:path.join(out,'lumen-preview-'+iteration+'.png')});
   releaseFull();
   await p.waitForFunction(()=>document.querySelector('.lumen-menu-background')?.naturalWidth===960);
   ok(await p.locator('.lumen-main-actions').isVisible(),'Decoded full frame replaces preview without interrupting the menu');
  }
  await close();
 }
 // Simulate a newly earned unlock while keeping the selected expedition map at garden.
 await p.evaluate(()=>{saved.lumen.meta.clearedMaps=['garden','quarry'];LumenMode.enter();});await waitLumen();
 ok(await p.locator('.lumen-menu-background').getAttribute('data-background-map')==='castle','Background follows unlocks rather than selected garden expedition');
 await p.waitForFunction(()=>document.querySelector('.lumen-menu-background')?.naturalWidth===960);
 const picture=await p.locator('.lumen-menu-background').getAttribute('src');
 ok(!requests.some(url=>/\/lumen\/(game\.mjs|engine\.mjs|weapon-icons\/|arsenal\.png|scout\.png|story-world-)/.test(url)),'Title opens without requesting engine or window artwork');
 let releaseGame;
 const gameGate=new Promise(resolve=>{releaseGame=resolve;});
 const holdGame=async route=>{await gameGate;await route.continue();};
 await p.route('**/js/lumen/game.mjs?*',holdGame);
 await p.locator('.lumen-main-actions [data-lumen-value=characters]').click();
 await p.locator('.lumen-shell[data-page=loading] [role=status]').waitFor();
 await p.keyboard.press('Escape');releaseGame();
 await p.unroute('**/js/lumen/game.mjs?*',holdGame);
 await p.locator('.lumen-main-actions [data-lumen-value=settings]').click();
 await p.locator('.lumen-shell[data-page=settings]').waitFor();
 ok(await p.locator('.lumen-menu-background').getAttribute('src')===picture,'Cancelling the initial module load keeps the same map and permits another window');
 await p.keyboard.press('Escape');
 let failPortrait=true;
 await p.route('**/assets/lumen/scout.png?*',route=>failPortrait?route.abort():route.continue());
 await p.locator('.lumen-main-actions [data-lumen-value=characters]').click();
 await p.locator('.lumen-game-window [role=alert]').waitFor();
 ok(await p.locator('.lumen-menu-background').getAttribute('src')===picture,'Missing shop portrait leaves the menu backdrop visible');
 await p.screenshot({path:path.join(out,'lumen-shop-retry-'+iteration+'.png')});
 failPortrait=false;
 await p.getByRole('button',{name:'Повторить',exact:true}).click();
 await p.locator('.lumen-shell[data-page=characters]').waitFor();
 ok(await p.locator('[data-lumen-value=scout] .lumen-character-portrait').evaluate(el=>el.style.getPropertyValue('--hero-image').includes('blob:')),'Retry opens the shop with decoded portraits');
 await p.screenshot({path:path.join(out,'lumen-shop-'+iteration+'.png')});
 await p.keyboard.press('Escape');
 for(const width of [375,768,1440,1920]){
  await p.setViewportSize({width,height:width<800?812:1000});
  for(const theme of ['dark','light']){
   await p.evaluate(t=>MenuUI.set('theme',t),theme);await p.waitForTimeout(180);
   await p.screenshot({path:path.join(out,`lumen-${width}-${theme}-${iteration}.png`)});
   await p.locator('.lumen-main-actions [data-lumen-value=settings]').click();
   await p.locator('.lumen-shell[data-page=settings]').waitFor();
   ok(await p.locator('.lumen-menu-background').getAttribute('src')===picture,'Opening settings keeps map frame '+width+' '+theme);
   await p.screenshot({path:path.join(out,`lumen-settings-${width}-${theme}-${iteration}.png`)});
   await p.locator('.lumen-window-toolbar button').click();
  }
 }
 // A background not previously loaded is also decoded on direct in-game menu return.
 await close();await p.reload();await p.locator('#hubSearch').waitFor();await p.locator('#campaignCards [data-lumen-action=open]').click();await waitLumen();
 await p.locator('.lumen-main-actions [data-lumen-value=settings]').click();await p.locator('.lumen-shell[data-page=settings]').waitFor();
 await p.evaluate(()=>{saved.lumen.meta.clearedMaps=['garden'];LumenMode.click({dataset:{lumenAction:'setup'}});});await p.waitForFunction(()=>document.querySelector('.lumen-menu-background')?.dataset.backgroundMap==='quarry');await waitLumen();
 ok(true,'New unlock is prepared when returning through controller.setup');await close();
 for(const sector of [0,3,7]){
  await p.evaluate(async sector=>{const{createRun,serialize,ROOMS}=await import('/static/js/specimen/engine.mjs');const run=createRun();run.room=sector;[run.x,run.y]=ROOMS[sector].spawn;run.visited=Array.from({length:sector+1},(_,i)=>i);saved.specimen={version:5,run:serialize(run)};window.__menuRunBefore=JSON.stringify(saved.specimen.run);SpecimenMode.enter();},sector);
  await waitSpecimen();ok(await p.locator('.sp-menu-background').getAttribute('data-background-sector')===String(sector),'Latest accessible Specimen sector '+sector);
  ok(await p.evaluate(()=>JSON.stringify(saved.specimen.run)===window.__menuRunBefore),'Menu capture does not mutate saved run '+sector);
  const still=await p.locator('.sp-menu-background').getAttribute('src');await p.waitForTimeout(240);ok(await p.locator('.sp-menu-background').getAttribute('src')===still,'Specimen screenshot stays frozen');
  if(sector===7)for(const width of [375,768,1440,1920]){
   await p.setViewportSize({width,height:width<800?812:1000});await waitSpecimen();
   for(const theme of ['dark','light']){await p.evaluate(t=>MenuUI.set('theme',t),theme);await p.waitForTimeout(180);await p.screenshot({path:path.join(out,`specimen-${width}-${theme}-${iteration}.png`)});}
  }
  if(sector===7){
   await p.locator('[data-sp-action=resume]').click();await p.waitForFunction(()=>SpecimenMode.snapshot()?.mode==='playing');
   ok(await p.evaluate(()=>SpecimenMode.snapshot().room)===7,'Resume after snapshot keeps the real game in the saved sector');
   ok(!await p.locator('.sp-menu-background').isVisible(),'Playing displays the live canvas rather than menu snapshot');
  }
  await close();
 }
 for(const [record,expected,label]of [[{run:{room:7,visited:[7]}},0,'invalid save'],[{completed:true},7,'completed escape']]){
  await p.evaluate(record=>{saved.specimen=record;SpecimenMode.enter();},record);await waitSpecimen();ok(await p.locator('.sp-menu-background').getAttribute('data-background-sector')===String(expected),'Specimen '+label+' background');await close();
 }
 await p.locator('.bottom-nav [data-screen-link=settings]').click();ok(!await p.locator('[data-screen=settings]').textContent().then(s=>s.includes('Движение фона')),'Settings do not advertise background playback');
 ok(!requests.some(url=>/menu-loop\.(mp4|webm)/.test(url)),'No video downloads in either game');
 ok(errors.length===0,'No JS errors: '+errors.join(';'));
 await writeFile(path.join(out,'results-'+iteration+'.json'),JSON.stringify({checks,errors,videoRequests:0},null,2));console.log(JSON.stringify({checks:checks.length,errors}));
}catch(error){await p.screenshot({path:path.join(out,'failure-'+iteration+'.png')});throw error;}finally{await browser.close();}

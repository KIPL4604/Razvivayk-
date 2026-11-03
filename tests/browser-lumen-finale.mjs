import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const origin=process.env.QA_ORIGIN||'http://127.0.0.1:8195';
const output=new URL('../output/lumen-finale/',import.meta.url);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
 for(const width of [375,768,1440,1920]){
  const page=await browser.newPage({viewport:{width,height:width===375?812:960},reducedMotion:'reduce'});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://telegram.org/**',route=>route.fulfill({body:'',contentType:'text/javascript'}));
  await page.route(/\/assets\/lumen\/(scout|keeper|ui|expedition|expansion-items)\.png$/,route=>route.fulfill({status:502,body:'Image unavailable'}));
  await page.goto(origin);
  await page.evaluate(async()=>{
   const {normalizeMeta}=await import('/static/js/lumen/economy.mjs');
   saved.lumen={meta:normalizeMeta({coins:200}),selection:{map:'garden',character:'scout'}};
   saveState();
  });
  const shot=(name)=>page.screenshot({path:fileURLToPath(new URL(`${name}-${width}.png`,output))});
  const menu=id=>page.locator(`.lumen-title-screen [data-lumen-action=menu][data-lumen-value=${id}]`).click();
  await page.locator('#campaignCards [data-lumen-action=open]').click();
  await menu('characters');
  await page.locator('.lumen-shell[data-page=characters] .lumen-character-dossier').waitFor();
  await shot('shop');
  await page.locator('.lumen-window-toolbar button').click();
  await menu('training');
  await page.locator('[data-lumen-action=train][data-lumen-value=vigor]').click();
  assert.deepEqual(await page.evaluate(()=>[saved.lumen.meta.coins,saved.lumen.meta.training.vigor]),[150,1]);
  await shot('training');
  await page.locator('#toast').waitFor({state:'hidden'});
  await page.locator('.lumen-window-toolbar button').click();
  await page.evaluate(async()=>{
   const {createRun,step,serialize}=await import('/static/js/lumen/engine.mjs');
   const {xpForLevel}=await import('/static/js/lumen/progression.mjs');
   const run=createRun({seed:81,map:'garden'});
   run.level=30;run.xpNext=xpForLevel(30);
   run.spawnedGuardians=run.bossesDefeated=3;run.finalGuardianDefeated=true;
   run.player.hp=1;step(run,{},1/60);
   run.arena.phase='fighting';run.arena.time=0;
   run.player.y=run.arena.y+220;
   const boss=run.enemies.find(e=>e.kind==='arena-boss');
   boss.attackStage=1;boss.fireTimer=0;step(run,{},1/60);
   saved.lumen.run=serialize(run);
   saved.lumen.story={runId:run.runId,seen:['boss:'+boss.id]};
   saveState();
  });
  await menu('play');
  await page.locator('.lumen-departure [data-lumen-action=resume]').click();
  await page.locator('[data-story-action=skip]:visible').click({timeout:45000});
  await page.locator('#lumenOverlay [data-lumen-action=continue]').click();
  await page.locator('#lumenCanvas').waitFor();
  await page.waitForFunction(()=>document.querySelector('#lumenBossPhase')?.textContent==='ГОТОВИТ УДАР');
  assert.match(await page.locator('#lumenHealth').textContent(),/^33 \/ 110$/);
  assert.equal(await page.locator('#lumenGameMount').getAttribute('data-arena'),'fighting');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await shot('garden');
  await page.goto(origin);
  await page.evaluate(async()=>{
   const {createRun,step,serialize}=await import('/static/js/lumen/engine.mjs');
   const {normalizeMeta}=await import('/static/js/lumen/economy.mjs');
   const run=createRun({seed:82,map:'castle'});
   run.time=56;run.spawnTimer=3;run.player.y=180;
   run.enemies=[
    ['palace-guard',0,65],['wax-servant',-118,150],['paper-moth',130,10]
   ].map(([kind,x,y])=>({id:run.nextId++,kind,x,y,hp:200,maxHp:200,radius:13,speed:0,damage:10,value:20,
     phase:0,hitFlash:0,guardianStage:0,fireTimer:0,elite:false,slowTime:0,actionTimer:0}));
   step(run,{},1/60);
   saved.lumen={meta:normalizeMeta({clearedMaps:['garden','quarry']}),selection:{map:'castle',character:'scout'},run:serialize(run)};
   saveState();
  });
  await page.locator('#campaignCards [data-lumen-action=open]').click();
  await menu('play');
  await page.locator('.lumen-departure [data-lumen-action=resume]').click();
  await page.locator('[data-story-action=skip]:visible').click({timeout:45000});
  await page.locator('#lumenOverlay [data-lumen-action=continue]').click();
  assert.equal(await page.locator('#lumenGameMount').getAttribute('data-map'),'castle');
  await shot('castle');
  if(width===375||width===1440){
   await page.waitForTimeout(900);
   await shot('castle-release');
  }
  assert.deepEqual(errors,[]);
  await page.close();
  console.log(`Garden, Castle, shop and training checked at ${width}px`);
 }
}finally{await browser.close();}

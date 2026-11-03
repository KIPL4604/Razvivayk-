/* Run against an isolated Teramont QA server with Playwright and Edge/Chromium. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const modulePath=process.env.PLAYWRIGHT_MODULE;
const {chromium}=await import(modulePath&&/^[a-z]:[\\/]/i.test(modulePath)?pathToFileURL(modulePath).href:modulePath||'playwright-core');
const origin=new URL(process.argv[2]||'http://127.0.0.1:8081').origin;
const out='output/catalog-lazy';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE});
const results=[];
const remoteSdk=page=>page.route('https://telegram.org/**',route=>route.fulfill({body:'',contentType:'text/javascript'}));
const gameOnly=/\/static\/(?:css\/(?:chess|poker|lumen(?:-interface|-loading|-story)?|specimen(?:-interface)?|pixel-hop)\.css|js\/(?:chess-mode|poker-mode)\.js|js\/(?:lumen|specimen)\/|games\/pixel-hop-twins\/)/;

try {
  for (const [width,height] of [[375,812],[768,1024],[1440,900],[1920,1080]]) {
    const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
    const page=await context.newPage();
    const requests=[],errors=[];
    await remoteSdk(page);
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{
      const url=new URL(request.url());
      if(url.origin===origin)requests.push(url.pathname);
    });
    await page.goto(origin,{waitUntil:'load'});
    await page.locator('#campaignCards [data-lumen-action=open]').waitFor();
    await page.screenshot({path:out+'/after-'+width+'.png'});
    assert.deepEqual(requests.filter(path=>gameOnly.test(path)),[]);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    const encodedBytes=await page.evaluate(()=>performance.getEntriesByType('resource').filter(entry=>entry.name.startsWith(location.origin)).reduce((sum,entry)=>sum+entry.encodedBodySize,0));
    results.push({width,requests:requests.length,encodedBytes});

    async function open(selector,ready,group,keyboard=false) {
      const card=page.locator('#campaignCards '+selector);
      if(keyboard)await card.press('Enter');else await card.click();
      await page.locator(ready).waitFor();
      assert.equal(await page.locator('template[data-game-style="'+group+'"]:not([data-ready])').count(),0);
      await page.screenshot({path:out+'/'+group+'-'+width+'.png'});
      await page.evaluate(()=>showScreen('home'));
    }
    await open('[data-chess-action=setup]','#chessSetupForm','chess',true);
    assert.equal(requests.filter(path=>path==='/static/js/chess-mode.js').length,1);
    assert.equal(requests.filter(path=>path==='/static/js/poker-mode.js').length,0);
    await open('[data-poker-action=setup]','#pokerSetupMount h1','poker');
    await open('[data-lumen-action=open]','.lumen-title-screen','lumen');
    await open('[data-sp-action=open]','.sp-shell','specimen');
    await open('[data-pixel-hop-action=open]','.pixel-hop-screen.active','pixel-hop');
    assert.deepEqual(errors,[]);
    await context.close();
  }

  const page=await browser.newPage();
  await remoteSdk(page);
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  let fail=true;
  await page.route('**/static/js/chess-mode.js*',route=>fail?route.fulfill({status:503,body:''}):route.continue());
  await page.goto(origin);
  const chess=page.locator('#campaignCards [data-chess-action=setup]');
  await chess.click();
  await page.locator('#gameResourcesStatus',{hasText:/Не удалось загрузить игру/}).waitFor();
  await page.screenshot({path:out+'/error.png'});
  await page.locator('[data-screen=home].active').waitFor();
  fail=false;
  await chess.click();
  await page.locator('#chessSetupForm').waitFor();
  await page.evaluate(()=>showScreen('home'));
  let release;
  const hold=new Promise(resolve=>{release=resolve;});
  await page.route('**/static/css/poker.css*',async route=>{await hold;await route.continue();});
  await page.locator('#campaignCards [data-poker-action=setup]').click();
  await page.locator('#gameResourcesStatus',{hasText:'Загружаем файлы игры…'}).waitFor();
  await page.screenshot({path:out+'/loading.png'});
  await page.locator('.bottom-nav [data-screen-link=profile]').click();
  release();
  await page.locator('template[data-game-style=poker][data-ready]').waitFor({state:'attached'});
  await page.locator('[data-screen=profile].active').waitFor();
  assert.deepEqual(errors,[]);
  await page.close();

  await writeFile(out+'/after.json',JSON.stringify(results,null,2));
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}

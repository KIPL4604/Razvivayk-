/* Run with PLAYWRIGHT_MODULE pointing to playwright-core; uses isolated QA server. */
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const origin=process.env.QA_ORIGIN||'http://127.0.0.1:8182',output=path.resolve('output/hub-social-loading');await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const iteration=process.env.QA_ITERATION||'i1';
const errors=[],checks=[],check=(v,label)=>{assert.ok(v,label);checks.push(label);};
function signed(user){const d={auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify(user)};const secret=createHmac('sha256','WebAppData').update('social-browser-test-only').digest();d.hash=createHmac('sha256',secret).update(Object.entries(d).sort().map(([k,v])=>k+'='+v).join('\n')).digest('hex');return new URLSearchParams(d).toString();}
const base=1000000+Math.floor(Math.random()*1000000000);
const identities=[{id:base+1,first_name:'Алекс',username:'alex_qa'},{id:base+2,first_name:'Саша',username:'sasha_qa'}];
const contexts=[];
async function pageFor(index,width=375){
 const c=await browser.newContext({viewport:{width,height:width<800?812:1000},hasTouch:true,isMobile:width<800});contexts.push(c);
 const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));
 if(index!==null)await p.addInitScript(({user,initData})=>{const noop=()=>{};window.Telegram={WebApp:{initData,initDataUnsafe:{user},ready:noop,expand:noop,onEvent:noop,offEvent:noop,isVersionAtLeast:()=>false,HapticFeedback:{impactOccurred:noop,notificationOccurred:noop,selectionChanged:noop},BackButton:{show:noop,hide:noop,onClick:noop},setHeaderColor:noop,setBackgroundColor:noop,viewportHeight:0}};},{user:identities[index],initData:signed(identities[index])});
 await p.goto(origin,{waitUntil:'domcontentloaded'});await p.locator('#hubSearch').waitFor();return p;
}
async function api(p,url,body,method){return p.evaluate(async({url,body,method})=>{const r=await fetch('/api/social'+url,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json','X-Init-Data':Telegram.WebApp.initData},body:body?JSON.stringify(body):undefined});if(!r.ok)throw Error('API '+r.status);return r.json();},{url,body,method});}
try{
 const a=await pageFor(0),b=await pageFor(1);
 const meA=(await api(a,'/state')).me,meB=(await api(b,'/state')).me;
 await api(a,'/friends/'+meB.code,null,'DELETE');
 await a.locator('.bottom-nav [data-screen-link=friends]').click();
 await a.locator('[data-social=add]').click();await a.locator('#socialCode').fill(meB.code);await a.locator('#socialAdd button').click();await a.getByText('Заявка отправлена.',{exact:true}).waitFor();
 await a.locator('#socialQR img').waitFor();check(await a.locator('#socialQR img').evaluate(e=>e.complete&&e.naturalWidth>0),'Private QR SVG loads');
 await a.screenshot({path:path.join(output,`add-375-${iteration}.png`)});await a.locator('[data-social=close]').click();
 await b.locator('.bottom-nav [data-screen-link=friends]').click();await b.locator('#socialRequests').filter({hasText:'1'}).waitFor();await b.locator('[data-social=requests]').click();await b.locator('[data-accept=true]').click();await b.getByText('Новых заявок нет.',{exact:true}).waitFor();await b.locator('[data-social=close]').click();
 await a.locator('[data-social-chat="'+meB.code+'"] #missing').count();
 await a.locator('#socialFriends [data-social-chat="'+meB.code+'"]').waitFor();check(await a.locator('#socialFriends .online').count()===1,'Friend online through real presence API');
 await a.locator('#socialFriends button').click();await a.locator('#socialCompose').fill('Привет, проверяем чат <b>без HTML</b>');await a.locator('#socialSend').evaluate(e=>e.requestSubmit());await a.locator('#socialMessages li').filter({hasText:'без HTML'}).waitFor();
 await b.locator('#socialChats button').waitFor();await b.locator('#socialChats button').click();await b.locator('#socialMessages li').filter({hasText:'без HTML'}).waitFor();check(await b.locator('#socialMessages b').count()===0,'Chat text cannot inject HTML');
 await b.locator('#socialCompose').fill('Получено. Всё на месте.');await b.locator('#socialCompose').press('Enter');await a.locator('#socialMessages li').filter({hasText:'Получено.'}).waitFor();check(true,'Two-account request / acceptance / live chat round trip');
 await a.screenshot({path:path.join(output,`chat-375-${iteration}.png`)});
 for(const width of [375,768,1440,1920]){
  await a.setViewportSize({width,height:width<800?812:1000});
  for(const theme of ['dark','light']){
   await a.evaluate(t=>MenuUI.set('theme',t),theme);await a.waitForTimeout(220);await a.screenshot({path:path.join(output,`chat-${width}-${theme}-${iteration}.png`)});
   check(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No root overflow '+width+' '+theme);
  }
 }
 await a.setViewportSize({width:375,height:812});await a.locator('[data-social=back]').click();await a.locator('#socialSearch').fill('@sasha');check(await a.locator('#socialFriends button').count()===1,'Friend search by nickname');await a.locator('#socialSearch').fill('unknown');check(await a.locator('#socialFriends button').count()===0,'Friend search empty state');await a.locator('#socialSearch').fill('');await a.screenshot({path:path.join(output,`friends-375-${iteration}.png`)});
 check((await a.locator('.bottom-nav button').allTextContents()).join(',')==='Игры,Карты,Друзья,Профиль,Настройки','Five independent navigation sections');
 for(const name of ['home','cards','profile','settings','home']){
  await a.locator('.bottom-nav [data-screen-link='+name+']').click();check(await a.locator('.menu-motion-layer').count()===0,'No screen clone after button '+name);
  check(await a.locator('#main>.screen.active').count()===1,'Exactly one active section '+name);
 }
 const cdp=await a.context().newCDPSession(a);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:320,y:170}]});for(let i=1;i<=10;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:320-i*24,y:170}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 check(await a.evaluate(()=>activeScreen)==='home','Horizontal drag does not join independent sections');check(await a.locator('.menu-motion-layer').count()===0,'No stale screen behind library');
 // Fresh anonymous context measures the complete map background gate without private data.
 const p=await pageFor(null);let release;
 const gate=new Promise(resolve=>release=resolve);await p.route('**/menu-backgrounds/garden.webp?*',async r=>{await gate;await r.continue();});
 await p.locator('#campaignCards [data-lumen-action=open]').click();await p.locator('#lumenEntryPercent').waitFor();
 check(await p.locator('.lumen-shell').count()===0,'Menu hidden while background transfer is incomplete');check(await p.locator('.lumen-load-dots i').count()===8,'Loading progress has eight circles');await p.screenshot({path:path.join(output,`loading-375-${iteration}.png`)});release();
 await p.locator('.lumen-title-screen').waitFor({timeout:60000});
 const background=await p.locator('.lumen-menu-background').evaluate(img=>({src:img.src,width:img.naturalWidth,complete:img.complete}));check(background.src.startsWith('blob:')&&background.complete&&background.width===1440,'Complete decoded map screenshot uses local blob');check(await p.locator('video').count()===0,'Menu has no video element');
 await p.locator('.lumen-main-actions [data-lumen-value=play]').click();check(await p.locator('.lumen-window-pager').count()===0,'Independent Lumen windows have no next-section pager');
 await p.screenshot({path:path.join(output,`lumen-play-375-${iteration}.png`)});
 await p.locator('[data-lumen-action=start]').click();await p.locator('#lumenStory:not([hidden])').waitFor();await p.locator('[data-story-action=skip]:visible').click({timeout:60000});await p.locator('#lumenCanvas').waitFor({timeout:60000});check(true,'World and story decode before playable canvas');
 await p.screenshot({path:path.join(output,`lumen-world-375-${iteration}.png`)});
 check(errors.length===0,'No browser JavaScript errors: '+errors.join(';'));
 await writeFile(path.join(output,'results.json'),JSON.stringify({checks,background,errors},null,2));console.log(JSON.stringify({checks:checks.length,background,errors}));
}catch(error){for(const [i,c]of contexts.entries())for(const p of c.pages()){await p.screenshot({path:path.join(output,'failure-'+i+'.png')}).catch(()=>{});}throw error;}finally{await browser.close();}

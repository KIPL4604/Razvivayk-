async(page)=>{
 const c=await page.context().browser().newContext({viewport:{width:375,height:812}}),p=await c.newPage(),errors=[];
 const root='C:/Users/1234567890/Desktop/PHANTOM_PROJECTS_COLLECTED_2026-09-20/01 Проекты/01 В работе/Развивайка — Teramont/';
 p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);
 try{
  await p.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));
  await p.route('**/assets/specimen/fixtures.png*',r=>r.abort());
  await p.goto(process.env.SPECIMEN_QA_URL||'http://127.0.0.1:8080',{waitUntil:'domcontentloaded'});
  await p.locator('[data-sp-action="open"]').click();await p.locator('.sp-loading[role="alert"]').waitFor();
  await p.screenshot({path:root+'output/playwright/specimen-loading-error-375.png'});
  await p.unroute('**/assets/specimen/fixtures.png*');await p.locator('[data-sp-action="reload"]').click();
  await p.locator('[data-sp-action="open"]').click();await p.locator('[data-sp-action="start"]').waitFor();
  if(errors.length)throw Error(errors.join(';'));
  return{blockedTexture:true,visibleError:true,retryLoadedMenu:true,errors};
 }finally{await c.close();}
}

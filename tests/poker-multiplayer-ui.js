async (page) => {
  // Run only against isolated uvicorn :8081 with TG_BOT_TOKEN=teramont-poker-local-test.
  const base='http://127.0.0.1:8081';
  if(new URL(page.url()).origin!==base)throw Error('Use the isolated QA server on :8081');
  const out='C:/Users/1234567890/Desktop/PHANTOM_PROJECTS_COLLECTED_2026-09-20/01 Проекты/01 В работе/Развивайка — Teramont/output/playwright/';
  const assert=(ok,message)=>{if(!ok)throw Error(message);};
  const settle=async p=>p.evaluate(async()=>{await Promise.all(document.getAnimations().filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
  const stateOf=async p=>p.evaluate(async()=>{const headers={};if(tg?.initData)headers['X-Init-Data']=tg.initData;if(saved.poker.token)headers['X-Poker-Token']=saved.poker.token;const r=await fetch('/api/poker/rooms/'+saved.poker.roomId,{headers});if(!r.ok)throw Error('Room GET '+r.status);return r.json();});
  const snap=async(p,name)=>{await settle(p);await p.screenshot({path:out+name+'.png'});};
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const results=[];
  async function sign(user){
    const enc=new TextEncoder(),hmac=async(key,text)=>{const k=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',k,enc.encode(text)));};
    const data={auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify(user)};
    const key=await hmac(enc.encode('WebAppData'),'teramont-poker-local-test');
    const hash=[...await hmac(key,Object.keys(data).sort().map(k=>k+'='+data[k]).join('\n'))].map(x=>x.toString(16).padStart(2,'0')).join('');
    return new URLSearchParams({...data,hash}).toString();
  }
  const browser=page.context().browser();const contexts=[];
  try{
    const users=[{id:810001,first_name:'Алиса · QA'},{id:810002,first_name:'Борис · QA'}];const clients=[];
    for(const user of users){const initData=await sign(user),context=await browser.newContext({viewport:{width:375,height:812}});contexts.push(context);await context.route('https://telegram.org/js/telegram-web-app.js',r=>r.fulfill({body:''}));await context.addInitScript(({initData,user})=>{window.Telegram={WebApp:{initData,initDataUnsafe:{user},isVersionAtLeast:()=>false}};},{initData,user});context.setDefaultTimeout(8000);const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base);await p.locator('#campaignCards [data-poker-action="setup"]').click();clients.push(p);}
    const [a,b]=clients;
    await a.locator('[data-poker-action="create"]').click();await a.getByText('Ждём второго игрока',{exact:true}).waitFor();const waiting=await stateOf(a);await snap(a,'poker-online-waiting-375');
    await b.locator('#pokerRoomCode').fill('XXXXXX');await b.locator('#pokerJoinForm button').click();await b.locator('[role="alert"]:not(.hidden)').waitFor();await snap(b,'poker-online-invalid-code-375');
    await b.locator('#pokerRoomCode').fill(waiting.code);await b.locator('#pokerJoinForm button').click();await b.locator('.poker-table').waitFor();await a.locator('[data-poker-action="call"]:not(:disabled)').waitFor();
    const av=await stateOf(a),bv=await stateOf(b);assert(av.roomId===bv.roomId,'Same actual room');assert(av.players[1].hole.every(c=>c===null)&&bv.players[0].hole.every(c=>c===null),'Private opponent holes');assert(av.players[0].hole.every(Boolean)&&bv.players[1].hole.every(Boolean),'Own cards visible');
    await snap(a,'poker-online-alice-375');await snap(b,'poker-online-boris-375');
    await a.reload();await a.locator('[data-resume="poker"]').click();await a.locator('.poker-table').waitFor();assert((await stateOf(a)).roomId===waiting.roomId,'Online reconnect');
    for(let i=0;i<12;i++){const latest=await stateOf(a);if(latest.phase!=='playing')break;const p=clients[latest.turnIndex];const own=await stateOf(p);await p.locator('[data-poker-action="'+(own.legalActions.includes('check')?'check':'call')+'"]:not(:disabled)').click();await p.waitForFunction(()=>!document.querySelector('.poker-controls')?.innerText.includes('Сохраняем ход'));}
    const done=await stateOf(a);assert(done.phase==='complete','Online showdown');assert(done.board.length===5,'Full river');assert(done.players.every(p=>p.hole.every(Boolean)),'Showdown reveals cards');assert(done.players.reduce((n,p)=>n+p.stack,0)===2000,'Online chip conservation');await a.locator('.poker-result').waitFor();await snap(a,'poker-online-showdown-375');
    await a.locator('[data-poker-action="next"]').click();await a.getByText('Ты готов. Ждём подтверждения соперника.',{exact:true}).waitFor();await b.locator('[data-poker-action="next"]:not(:disabled)').click();await b.locator('.poker-actions').waitFor();const next=await stateOf(b);assert(next.handNumber===2&&next.dealerIndex===1,'Both ready then rotate dealer');
    results.push({multiplayer:true,showdown:true,reconnect:true,privateCards:true,bothReady:true});
  }finally{for(const c of contexts)await c.close();}
  assert(errors.length===0,errors.join("; "));
  return {results,errors};
}

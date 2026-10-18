async(page)=>{
  // Isolated QA API on :8081; never use real Telegram credentials here.
  const base='http://127.0.0.1:8081',out='C:/Users/1234567890/Desktop/PHANTOM_PROJECTS_COLLECTED_2026-09-20/01 Проекты/01 В работе/Развивайка — Teramont/output/playwright/';
  const assert=(value,message)=>{if(!value)throw Error(message);};
  const errors=[],results=[];
  const settle=async p=>p.evaluate(async()=>{await Promise.all(document.getAnimations().filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
  const capture=async(p,name)=>{await settle(p);await p.screenshot({path:out+name+'.png'});assert(await p.evaluate(()=>document.querySelector('#main').scrollWidth<=document.querySelector('#main').clientWidth),'Horizontal overflow '+name);};
  async function sign(user){
    const enc=new TextEncoder(),hmac=async(key,text)=>{const k=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',k,enc.encode(text)));};
    const data={auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify(user)};
    const key=await hmac(enc.encode('WebAppData'),'teramont-poker-local-test');
    const hash=[...await hmac(key,Object.keys(data).sort().map(k=>k+'='+data[k]).join('\n'))].map(x=>x.toString(16).padStart(2,'0')).join('');
    return new URLSearchParams({...data,hash}).toString();
  }
  const id=820000+Math.floor(Date.now()/1000)%100000;
  async function client(user){
    const context=await page.context().browser().newContext({viewport:{width:375,height:812}}),initData=await sign(user);
    await context.route('https://telegram.org/js/telegram-web-app.js',route=>route.fulfill({body:'',contentType:'text/javascript'}));
    await context.addInitScript(({user,initData})=>{window.Telegram={WebApp:{initData,initDataUnsafe:{user},ready(){},expand(){},isVersionAtLeast(){return false;}}};},{user,initData});
    const p=await context.newPage();p.on('pageerror',error=>errors.push(error.message));await p.goto(base);await p.waitForFunction(()=>serverReady&&!!saved.cloud);await p.waitForFunction(()=>!document.querySelector('#cloudStatus').innerText.includes('Проверяем'));
    return {context,p};
  }
  const a=await client({id,first_name:'Тестовый игрок'}),b=await client({id:id+1,first_name:'Соперник с длинным именем для проверки переноса'});
  try{
    const p=a.p,q=b.p;
    await p.locator('[data-screen-link="lobby"]').click();await p.locator('[data-lobby-action="find"]').waitFor();
    for(const width of [375,768,1440,1920]){await p.setViewportSize({width,height:width===375?812:width===768?1024:width===1440?900:1080});await capture(p,'platform-lobby-'+width+'-iteration1');}
    await p.setViewportSize({width:375,height:812});
    await p.locator('[data-lobby-action="find"]').click();await p.locator('[data-lobby-action="cancel"]').waitFor();await p.locator('[data-lobby-action="cancel"]').click();await p.locator('[data-lobby-action="find"]').waitFor();results.push('queue cancellation');
    await p.locator('[data-lobby-action="find"]').click();await p.locator('[data-lobby-action="cancel"]').waitFor();
    await q.locator('[data-screen-link="lobby"]').click();await q.locator('[data-lobby-action="find"]').click();
    await Promise.all([p.locator('#pokerMount .poker-table').waitFor(),q.locator('#pokerMount .poker-table').waitFor()]);
    await Promise.all([p.waitForFunction(()=>document.querySelector('#pokerLiveStatus')?.textContent.includes('установлена')),q.waitForFunction(()=>document.querySelector('#pokerLiveStatus')?.textContent.includes('установлена'))]);
    const room=await p.evaluate(()=>saved.poker.roomId);assert(room===await q.evaluate(()=>saved.poker.roomId),'Matchroom differs');
    const state=await p.evaluate(async()=>{const r=await fetch('/api/poker/rooms/'+saved.poker.roomId,{headers:{'X-Init-Data':tg.initData}});return r.json();});
    assert(state.players.find(x=>!x.isYou).hole.every(x=>x===null),'Private cards exposed');results.push('real two-user matchmaking and private WS');
    const actor=state.turnIndex===state.youIndex?p:q,observer=actor===p?q:p;
    const version=Number(await observer.locator('#pokerMount').getAttribute('data-version'));
    await actor.locator('.poker-actions .primary-button:not(:disabled)').click();
    await observer.waitForFunction(v=>Number(document.querySelector('#pokerMount').dataset.version)>v,version);results.push('opponent receives move without polling');
    let roomGets=0;p.on('request',request=>{if(request.method()==='GET'&&request.url().includes('/api/poker/rooms/'))roomGets++;});
    await p.waitForTimeout(3400);assert(roomGets===0,'Old 1.5s polling still running');
    await a.context.setOffline(true);await p.waitForTimeout(500);await a.context.setOffline(false);
    await p.waitForFunction(()=>document.querySelector('#pokerLiveStatus')?.textContent.includes('установлена'));results.push('WS reconnect');
    for(const width of [375,768,1440,1920]){await p.setViewportSize({width,height:width===375?812:width===768?1024:width===1440?900:1080});await capture(p,'platform-table-'+width+'-iteration1');}
    await p.emulateMedia({reducedMotion:'reduce'});await settle(p);assert(await p.evaluate(()=>document.getAnimations().length===0),'Reduced motion');await p.emulateMedia({reducedMotion:'no-preference'});
    await p.evaluate(()=>showScreen('home'));await p.evaluate(()=>startGame('arithmetic','easy',1));await p.waitForFunction(()=>activeScreen==='game'&&saved.current?.serverChallengeVersion===1);
    const session=await p.evaluate(()=>saved.current.sessionId);
    const forged=await p.evaluate(async()=>{const r=await fetch('/api/games/complete',{method:'POST',headers:{'Content-Type':'application/json','X-Init-Data':tg.initData},body:JSON.stringify({session_id:saved.current.sessionId,elapsed_seconds:30,hints:0,moves:1,proof:{answers:['fake']}})});return r.status;});assert(forged===409,'Forged completion accepted');
    await p.waitForTimeout(2100);
    while(await p.locator('#puzzleAnswer').count()){
      const answer=await p.evaluate(()=>saved.current.questions[saved.current.index].answers[0]);await p.locator('#puzzleAnswer').fill(String(answer));await p.locator('[data-puzzle-check]').click();await p.waitForTimeout(320);
    }
    await p.waitForFunction(()=>!!saved.current?.result&&!saved.current.syncPending);assert(await p.evaluate(()=>saved.current.result.xpAwarded)>0,'No validated reward');results.push('server challenge and validated completion');
    await p.evaluate(()=>showScreen('home'));await p.evaluate(()=>startGame('sudoku','easy',1));await p.waitForFunction(()=>saved.current?.type==='sudoku'&&saved.current.serverChallengeVersion===1);
    await p.evaluate(()=>{const c=saved.current;c.selected=c.given.findIndex(v=>!v);setSudokuNumber(c.solution[c.selected]);});await p.waitForFunction(()=>saved.cloud.sudoku?.revision>0);
    const twin=await client({id,first_name:'Тестовый игрок'});
    try{
      assert(await twin.p.evaluate(()=>saved.runs.sudoku?.sessionId)===await p.evaluate(()=>saved.current.sessionId),'Cloud resume differs');results.push('second device restores puzzle');
      const remote=await twin.p.evaluate(async()=>{const data=await Platform.request('/saves');const r=data.saves.sudoku;r.state.run.hints+=1;return Platform.request('/saves/sudoku',{method:'PUT',body:{revision:r.revision,state:r.state}});});
      await p.waitForFunction(()=>document.querySelector('[data-cloud-choice="remote"]'));
      await p.setViewportSize({width:375,height:812});await capture(p,'platform-cloud-conflict-375-iteration2');
      await p.locator('[data-cloud-choice="remote"]').click();assert(await p.evaluate(()=>saved.current.hints)===remote.state.run.hints,'Remote choice not applied');results.push('explicit cloud conflict resolution');
    }finally{await twin.context.close();}
    await p.evaluate(()=>showScreen('chess'));
    await p.locator('input[name="chessLevel"][value="beginner"]').check();await p.locator('input[name="chessSide"][value="w"]').check();await p.locator('#chessSetupForm button[type="submit"]').click();
    await p.waitForFunction(()=>document.querySelector('#chessTurnStatus')?.textContent.includes('Твой ход'));
    await p.locator('[data-chess-square="e2"]').click();await p.locator('[data-chess-square="e4"]').click();
    await p.waitForFunction(()=>saved.chess?.moves.length>=2&&document.querySelector('#chessTurnStatus')?.textContent.includes('Твой ход'));
    await p.evaluate(()=>Platform.flush());const chessRun=await p.evaluate(()=>({id:saved.chess.id,moves:[...saved.chess.moves]}));
    const chessTwin=await client({id,first_name:'Тестовый игрок'});
    try{
      assert(JSON.stringify(await chessTwin.p.evaluate(()=>saved.chess.moves))===JSON.stringify(chessRun.moves),'Cloud chess move list differs');
      await chessTwin.p.evaluate(()=>ChessMode.resume());await chessTwin.p.locator('.chess-square').first().waitFor();
      chessTwin.p.once('dialog',dialog=>dialog.accept());await chessTwin.p.locator('[data-chess-action="resign"]').click();
      await chessTwin.p.waitForFunction(()=>saved.chess.ended&&saved.chessStats.losses===1);await chessTwin.p.evaluate(()=>Platform.flush());
      await p.waitForFunction(()=>document.querySelector('[data-cloud-game="chess"][data-cloud-choice="remote"]'));
      await p.locator('[data-cloud-game="chess"][data-cloud-choice="remote"]').click();
      assert(await p.evaluate(()=>saved.chess.ended&&saved.chessStats.losses===1),'Restored chess stats must remain finite');results.push('real chess engine, cloud move restore and completed stats');
    }finally{await chessTwin.context.close();}
    await p.evaluate(()=>showScreen('lobby'));await p.locator('[data-lobby-room]').first().waitFor();
    await p.waitForTimeout(350);assert(await p.evaluate(()=>activeScreen)==='lobby','Historical match must not force lobby back to table');results.push('lobby stays open after historical match');
    for(const width of [375,768,1440,1920]){await p.setViewportSize({width,height:width===375?812:width===768?1024:width===1440?900:1080});await capture(p,'platform-lobby-'+width+'-iteration2');}
    await p.locator('[data-lobby-room="'+room+'"]').click();await p.waitForFunction(()=>activeScreen==='poker-game'&&document.querySelector('#pokerMount .poker-table'));
    for(const width of [375,768,1440,1920]){await p.setViewportSize({width,height:width===375?812:width===768?1024:width===1440?900:1080});await capture(p,'platform-table-'+width+'-iteration2');}
    await p.keyboard.press('Tab');assert(await p.evaluate(()=>document.activeElement!==document.body),'Keyboard focus missing');
    assert(errors.length===0,'Browser errors: '+errors.join('; '));return {results,errors,sessionChecked:!!session,screenshots:17};
  }finally{await a.context.close();await b.context.close();}
}

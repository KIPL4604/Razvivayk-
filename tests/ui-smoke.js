async (page) => {
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  if(await page.evaluate(()=>hasTelegramIdentity))throw Error("Use an isolated browser preview session");
  await page.evaluate(()=>{saved=loadSavedState({schemaVersion:3});saveState();localStorage.removeItem(PROFILE_KEY);});
  await page.reload();
  await page.waitForSelector('#campaignCards button');
  const results=[];
  for(const type of ['sudoku','memory','riddles','sequences','tiles','pattern','nonogram','arithmetic','rebuses','stroop']){
    await page.locator('.bottom-nav [data-screen-link="home"]').click();
    await page.locator(`#campaignCards [data-campaign="${type}"]`).click();
    await page.locator('#levelMap [data-start-level="1"]').click();
    await page.waitForFunction(type=>saved.current?.type===type&&activeScreen==='game',type);
    const c=await page.evaluate(()=>JSON.parse(JSON.stringify(saved.current)));
    if(type==='sudoku'){
      await page.screenshot({path:'C:/Users/1234567890/Desktop/PHANTOM_PROJECTS_COLLECTED_2026-09-20/01 Проекты/01 В работе/Развивайка — Teramont/output/playwright/sudoku-390.png'});
      for(let i=0;i<c.board.length;i++)if(!c.board[i]){
        await page.locator(`[data-sudoku-cell="${i}"]`).click();
        await page.locator(`[data-sudoku-number="${c.solution[i]}"]`).click();
      }
    }else if(type==='memory'){
      const pairs={};for(const card of c.cards)(pairs[card.value]||=[]).push(card.id);
      for(const ids of Object.values(pairs)){
        for(const id of ids)await page.locator(`[data-memory-card="${id}"]`).click();
        await page.waitForFunction(()=>!memoryLocked);
      }
    }else if(['riddles','sequences','arithmetic','rebuses'].includes(type)){
      for(let i=0;i<c.questions.length;i++){
        await page.locator('#puzzleAnswer').fill(String(c.questions[i].answers[0]));
        await page.locator('[data-puzzle-check]').click();
        await page.waitForFunction(()=>saved.current.completed||!saved.current.answerLocked);
      }
    }else if(type==='tiles'){
      const start=c.board.join(','),goal=c.board.map((_,i)=>(i+1)%c.board.length).join(',');
      const queue=[start],seen=new Map([[start,null]]);let head=0;
      while(head<queue.length&&!seen.has(goal)){
        const key=queue[head++],b=key.split(',').map(Number),z=b.indexOf(0);
        for(const n of [z-c.size,z+c.size,z-1,z+1]){
          if(n<0||n>=b.length||Math.abs(Math.floor(n/c.size)-Math.floor(z/c.size))+Math.abs(n%c.size-z%c.size)!==1)continue;
          const next=[...b];[next[z],next[n]]=[next[n],next[z]];const nk=next.join(',');
          if(!seen.has(nk)){seen.set(nk,[key,n]);queue.push(nk);}
        }
      }
      if(!seen.has(goal))throw Error('No tile solution');
      const moves=[];let key=goal;while(seen.get(key)){const [prev,index]=seen.get(key);moves.push(index);key=prev;}
      for(const index of moves.reverse())await page.locator(`[data-tile="${index}"]`).click();
    }else if(type==='pattern'){
      for(const cells of c.patterns){
        await page.locator('[data-pattern-reveal]').click();
        await page.waitForFunction(()=>saved.current.ready&&!saved.current.revealing);
        for(const index of cells)await page.locator(`[data-pattern-cell="${index}"]`).click();
      }
    }else if(type==='nonogram'){
      for(let i=0;i<c.solution.length;i++)if(c.solution[i])await page.locator(`[data-nonogram-cell="${i}"]`).click();
    }else if(type==='stroop'){
      for(const q of c.questions)await page.locator(`[data-ink="${q.ink}"]`).click();
    }
    await page.locator('.success-panel').waitFor();
    const result=await page.evaluate(type=>({type,completed:saved.current.completed,xp:profile.xp,unlocked:profile.campaigns[type].unlockedLevel,completedCount:profile.campaigns[type].completedCount}),type);
    if(!result.completed||result.unlocked!==2||result.completedCount!==1)throw Error(JSON.stringify(result));
    results.push(result);
    await page.locator('.success-panel [data-screen-link="levels"]').click();
  }
  await page.locator('.bottom-nav [data-screen-link="profile"]').click();
  await page.screenshot({path:'C:/Users/1234567890/Desktop/PHANTOM_PROJECTS_COLLECTED_2026-09-20/01 Проекты/01 В работе/Развивайка — Teramont/output/playwright/profile-390.png'});
  for(const width of [320,390,768]){
    await page.setViewportSize({width,height:844});
    for(const section of ['home','levels','profile']){
      await page.locator(`.bottom-nav [data-screen-link="${section}"]`).click();
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.body.scrollWidth>innerWidth);
      if(overflow)throw Error(`Horizontal overflow: ${width}/${section}`);
    }
  }
  await page.setViewportSize({width:390,height:844});
  await page.reload();await page.waitForSelector('#campaignCards button');
  const reloaded=await page.evaluate(()=>({total:profile.totalGames,xp:profile.xp,achievements:profile.achievements.filter(a=>a.unlocked).length}));
  if(reloaded.total!==10)throw Error('Profile lost after reload');
  if(errors.length)throw Error(errors.join('\n'));
  return {results,reloaded,pageErrors:errors};
}

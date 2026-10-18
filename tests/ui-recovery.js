async (page) => {
  if(await page.evaluate(()=>hasTelegramIdentity))throw Error("Use an isolated browser preview session");
  const passed=[];
  await page.reload();await page.waitForSelector('#campaignCards button');
  await page.locator('.bottom-nav [data-screen-link="home"]').click();
  await page.locator('#campaignCards [data-campaign="sudoku"]').click();
  await page.locator('#levelMap [data-start-level="2"]').click();
  const before=await page.evaluate(()=>JSON.parse(JSON.stringify(saved.current)));
  const blank=before.board.indexOf(0);
  await page.locator(`[data-sudoku-cell="${blank}"]`).click();
  await page.locator(`[data-sudoku-number="${before.solution[blank]}"]`).click();
  await page.locator('[data-screen="game"] .game-toolbar [data-screen-link="levels"]').click();
  await page.locator('.bottom-nav [data-screen-link="home"]').click();
  await page.locator('#campaignCards [data-campaign="memory"]').click();
  await page.locator('#levelMap [data-start-level="2"]').click();
  await page.locator('[data-memory-card]').first().click();
  await page.reload();await page.waitForSelector('#campaignCards button');
  if(await page.evaluate(()=>Object.values(saved.runs).filter(run=>!run.completed).length)!==2)throw Error('Two unfinished runs not restored');
  await page.locator('#campaignCards [data-campaign="sudoku"]').click();await page.locator('[data-play-current-level]').click();
  const after=await page.evaluate(()=>JSON.parse(JSON.stringify(saved.current)));
  if(after.board[blank]!==before.solution[blank]||after.levelNumber!==2)throw Error('Sudoku move lost');
  passed.push('Two independent unfinished runs survive reload, Sudoku move restored');
  const t0=await page.evaluate(()=>updateElapsed());
  for(const n of [1,2,3,4,5,6]){await page.locator(`[data-sudoku-cell="${blank}"]`).click();await page.waitForTimeout(120);}
  const delta=await page.evaluate(t0=>updateElapsed()-t0,t0);
  if(delta<.65)throw Error('Timer loses fractional seconds');
  passed.push('Timer retains fractional seconds across frequent actions');
  const original=await page.evaluate(()=>localStorage.getItem(STORAGE_KEY));
  await page.evaluate(()=>{saved.current={...saved.current,sessionId:'00000000-0000-4000-a000-000000000001',completed:true,syncPending:true,result:null};saved.runs.sudoku=saved.current;saved.pending=[];saveState();});
  await page.reload();await page.waitForSelector('#campaignCards button');
  const queue=await page.evaluate(()=>({pending:saved.pending.length,locked:saved.pending.some(c=>c.syncPending)}));
  if(queue.pending!==1||queue.locked)throw Error('Interrupted result upload not recovered');
  passed.push('Interrupted result upload recovered and retry unlocked');
  await page.evaluate(original=>{saved=loadSavedState(JSON.parse(original));saveState();},original);
  await page.reload();await page.waitForSelector('#campaignCards button');
  const result=await page.evaluate(()=>({games:profile.totalGames,xp:profile.xp,completed:Object.fromEntries(Object.entries(profile.campaigns).map(([k,c])=>[k,c.completedCount])),achievements:profile.achievements.filter(a=>a.unlocked).length}));
  return {passed,result};
}

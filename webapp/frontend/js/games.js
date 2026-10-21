"use strict";
const tg=window.Telegram?.WebApp;
const hasTelegramIdentity=Boolean(tg?.initData);
const namespace=tg?.initDataUnsafe?.user?.id||"browser";
const STORAGE_KEY=`teramont.razvivayka.game.v2:${namespace}`;
const PROFILE_KEY=`teramont.razvivayka.profile.v3:${namespace}`;
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const normalizeAnswer=value=>String(value??"").toLocaleLowerCase("ru-RU").replace(/ё/g,"е").replace(/[.,!?;:'"«»()\s-]+/g,"").trim();
function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||"null")||fallback;}catch(_){return fallback;}}
function emptyCampaigns(){return Object.fromEntries(GAME_ORDER.map(g=>[g,{completedLevels:[],unlockedLevel:1,completedCount:0,complete:false}]));}
function dayKey(offset=0){return new Date(Date.now()+10800000+offset*86400000).toISOString().slice(0,10);}
function loadSavedState(incoming=null){
  const state=incoming||readJson(STORAGE_KEY,{}),old=state.local||{};
  state.local={xp:0,totalGames:0,streak:0,bestStreak:0,lastPlayedDate:null,noHints:0,...old,stats:{...Object.fromEntries(GAME_ORDER.map(g=>[g,0])),...old.stats}};
  state.local.campaigns=old.campaigns||emptyCampaigns();
  if(!state.schemaVersion){
    const legacy=["sudoku","memory","riddles","sequences"];
    for(const number of old.completedLevels||[]){const game=legacy[(number-1)%4],n=Math.floor((number-1)/4)+1;state.local.campaigns[game].completedLevels.push(n);}
    if(state.current?.levelNumber)state.current.levelNumber=Math.floor((state.current.levelNumber-1)/4)+1;
  }
  GAME_ORDER.forEach(g=>{state.local.campaigns[g]||={completedLevels:[]};const c=state.local.campaigns[g];c.completedLevels=[...new Set(c.completedLevels||[])];c.unlockedLevel=Array.from({length:100},(_,i)=>i+1).find(n=>!c.completedLevels.includes(n))||100;c.completedCount=c.completedLevels.length;c.complete=c.completedCount===100;});
  state.schemaVersion=3;state.runs||={};state.pending||=[];state.selectedCampaign=GAME_NAMES[state.selectedCampaign]?state.selectedCampaign:"sudoku";
  if(state.current){state.runs[state.current.type]=state.current;}
  Object.values(state.runs).forEach(run=>{run.startedAt=null;run.answerLocked=false;run.syncPending=false;if(run.completed&&run.sessionId&&!run.result&&!state.pending.some(p=>p.sessionId===run.sessionId))state.pending.push(run);});
  state.pending=state.pending.map(run=>{run.syncPending=false;return state.runs[run.type]?.sessionId===run.sessionId?state.runs[run.type]:run;});
  return state;
}
let saved=loadSavedState();
let gameFilter="Все";
let profile=hasTelegramIdentity?readJson(PROFILE_KEY,null):null;
let timerHandle=null,memoryLocked=false,toastHandle=null,revealHandle=null,deviceSaveHandle=null,activeScreen="home",starting=false,serverReady=!hasTelegramIdentity;
profile=profile?.campaigns?profile:buildLocalProfile();
function deviceStorageAvailable(){return hasTelegramIdentity&&tg?.isVersionAtLeast?.("9.0")&&tg.DeviceStorage;}
function flushDeviceSave(){clearTimeout(deviceSaveHandle);if(deviceStorageAvailable()){try{tg.DeviceStorage.setItem(STORAGE_KEY,JSON.stringify(saved),()=>{});}catch(_){}}}
function saveState(){saved.updatedAt=Date.now();try{localStorage.setItem(STORAGE_KEY,JSON.stringify(saved));}catch(_){showToast("Не хватает места для локального сохранения.");}if(deviceStorageAvailable()){clearTimeout(deviceSaveHandle);deviceSaveHandle=setTimeout(flushDeviceSave,150);}Platform.changed();}
async function hydrateDeviceSave(){
  if(!deviceStorageAvailable())return;
  const remote=await Promise.race([new Promise(resolve=>{try{tg.DeviceStorage.getItem(STORAGE_KEY,(error,value)=>{try{resolve(error?null:JSON.parse(value||"null"));}catch(_){resolve(null);}});}catch(_){resolve(null);}}),new Promise(resolve=>setTimeout(()=>resolve(null),1800))]);
  if(remote&&remote.schemaVersion===3&&remote.updatedAt>(saved.updatedAt||0))saved=loadSavedState(remote);
}
function cacheProfile(value){profile=value;try{localStorage.setItem(PROFILE_KEY,JSON.stringify(value));}catch(_){} }
function showToast(message){const e=$("#toast");if(!e)return;e.textContent=message;e.classList.remove("hidden");clearTimeout(toastHandle);toastHandle=setTimeout(()=>e.classList.add("hidden"),3500);}
function rankForLevel(level){const index=RANKS.findLastIndex(([n])=>level>=n);return {rank:RANKS[index][1],nextRank:RANKS[index+1]?.[1]||null,nextRankLevel:RANKS[index+1]?.[0]||null};}
function eligibleAchievements(local){
  const ids=new Set();[[1,"first_game"],[10,"ten_games"],[100,"hundred_games"]].forEach(([n,id])=>{if(local.totalGames>=n)ids.add(id);});
  if(local.noHints>=5)ids.add("no_hints_five");
  [[3,"streak_three"],[7,"streak_seven"],[30,"streak_thirty"]].forEach(([n,id])=>{if(local.bestStreak>=n)ids.add(id);});
  if(GAME_ORDER.every(g=>local.stats[g]))ids.add("all_games");
  GAME_ORDER.forEach(g=>{const c=local.campaigns[g];if(local.stats[g]>=5)ids.add(`${g}_five`);if(c.unlockedLevel>=11)ids.add("chapter_two");if(c.complete){ids.add("campaign_100");ids.add(`${g}_100`);}});
  return ACHIEVEMENT_CATALOG.map(a=>({...a,unlocked:ids.has(a.id)}));
}
function buildLocalProfile(){
  const local=saved.local,level=Math.floor(local.xp/100)+1;
  return {displayName:hasTelegramIdentity?(tg.initDataUnsafe?.user?.first_name||"Игрок"):"Игрок",username:tg?.initDataUnsafe?.user?.username||null,xp:local.xp,level,xpIntoLevel:local.xp%100,xpToNext:100,xpProgress:local.xp%100,...rankForLevel(level),campaigns:local.campaigns,campaignLevels:1000,completedCampaignLevels:Object.values(local.campaigns).reduce((sum,c)=>sum+c.completedCount,0),totalGames:local.totalGames,streak:local.lastPlayedDate&&local.lastPlayedDate>=dayKey(-1)?local.streak:0,bestStreak:local.bestStreak,stats:local.stats,achievements:eligibleAchievements(local)};
}
function currentCampaign(game=saved.selectedCampaign){return profile.campaigns[game]||emptyCampaigns()[game];}
function campaignLevels(game=saved.selectedCampaign){const c=currentCampaign(game);return Array.from({length:100},(_,i)=>({...levelConfig(i+1,game),unlocked:i+1<=c.unlockedLevel,completed:c.completedLevels.includes(i+1),current:i+1===c.unlockedLevel&&!c.complete}));}
function hydrateIcons(){ $$("[data-ui-icon]").forEach(el=>{if(!el.firstElementChild)el.innerHTML=uiIcon(el.dataset.uiIcon);}); }
function achievementProgress(a){
  if(a.unlocked)return {value:1,target:1};
  if(a.id==="no_hints_five")return {value:hasTelegramIdentity?(profile.stats.noHints||0):saved.local.noHints,target:5};
  const totals={first_game:1,ten_games:10,hundred_games:100};
  if(totals[a.id])return {value:profile.totalGames,target:totals[a.id]};
  const streaks={streak_three:3,streak_seven:7,streak_thirty:30};
  if(streaks[a.id])return {value:profile.bestStreak||0,target:streaks[a.id]};
  if(a.id==="all_games")return {value:GAME_ORDER.filter(g=>profile.stats[g]>0).length,target:10};
  if(a.id==="chapter_two")return {value:Math.max(...GAME_ORDER.map(g=>Math.min(10,currentCampaign(g).unlockedLevel-1))),target:10};
  if(a.id==="campaign_100")return {value:Math.max(...GAME_ORDER.map(g=>currentCampaign(g).completedCount)),target:100};
  const game=GAME_ORDER.find(g=>a.id===g+"_five"||a.id===g+"_100");
  if(game)return {value:a.id.endsWith("_five")?profile.stats[game]:currentCampaign(game).completedCount,target:a.id.endsWith("_five")?5:100};
  return null;
}
function renderAchievements(){
  const all=profile.achievements;
  const nearest=all.filter(a=>!a.unlocked&&achievementProgress(a)).sort((a,b)=>{const x=achievementProgress(a),y=achievementProgress(b);return y.value/y.target-x.value/x.target;})[0];
  $("#rankEmblem").innerHTML=rewardStar();
  $("#nextAchievement").innerHTML=nearest?(()=>{
    const p=achievementProgress(nearest),value=Math.min(p.value,p.target),ratio=Math.round(value/p.target*100);
    return '<div class="next-achievement-top"><p class="eyebrow">Следующая награда</p>'+rewardStar()+'</div><h2>'+escapeHtml(nearest.title)+'</h2><p>'+escapeHtml(nearest.description)+'</p><small>'+value+' / '+p.target+' · твой прогресс</small><div class="xp-track" role="progressbar" aria-label="Прогресс достижения '+escapeHtml(nearest.title)+'" aria-valuemin="0" aria-valuemax="'+p.target+'" aria-valuenow="'+value+'"><span style="width:'+ratio+'%"></span></div>';
  })():'<div class="next-achievement-top"><p class="eyebrow">Полная коллекция</p>'+rewardStar()+'</div><h2>Все награды твои</h2><p>Все '+all.length+' достижений открыты. Продолжай играть в своём темпе.</p>';
  const sorted=[...all.filter(a=>a.unlocked),...all.filter(a=>!a.unlocked)];
  const item=a=>'<article class="achievement-item '+(a.unlocked?"unlocked":"locked")+'"><span class="achievement-icon">'+rewardStar()+'</span><span class="achievement-copy"><strong>'+escapeHtml(a.title)+'</strong><span>'+escapeHtml(a.description)+'</span></span><span class="achievement-state" aria-label="'+(a.unlocked?"Открыто":"Закрыто")+'">'+(a.unlocked?"✓":uiIcon("lock"))+'</span></article>';
  $("#achievementList").innerHTML=sorted.slice(0,3).map(item).join("")+'<details class="achievement-extra"><summary>Все достижения · '+all.length+'</summary><div class="achievement-list">'+sorted.slice(3).map(item).join("")+'</div></details>';
}
function renderCatalog(){
  const chess='<button class="campaign-card" type="button" data-chess-action="setup" '+(gameFilter!=="Все"&&gameFilter!=="Логика"?"hidden":"")+' aria-label="Шахматы. Играть против компьютера">'+gameArt("chess")+'<span class="campaign-card-copy"><span class="campaign-category">Логика · против компьютера</span><strong>Шахматы</strong><span class="campaign-card-progress"><span>6 уровней сложности</span>'+uiIcon("arrow")+'</span></span></button>';
  const poker='<button class="campaign-card" type="button" data-poker-action="setup" '+(gameFilter!=="Все"&&gameFilter!=="Мышление"?"hidden":"")+' aria-label="Математический покер. Играть с ботом или другом">'+PokerCards.art()+'<span class="campaign-card-copy"><span class="campaign-category">Мышление · вероятности</span><strong>Математический покер</strong><span class="campaign-card-progress"><span>С ботом или другом</span>'+uiIcon("arrow")+'</span></span></button>';
  const lumen='<button class="campaign-card lumen-catalog" type="button" data-lumen-action="open" '+(gameFilter!=="Все"?"hidden":"")+' aria-label="Люмен: последний маяк. Одиночный survival-экшен">'+LumenMode.art()+'<span class="campaign-card-copy"><span class="campaign-category">Новое · Survival</span><strong>Люмен<span>Последний маяк</span></strong><span class="campaign-card-progress"><span>2 карты · цель 30 / 35</span>'+uiIcon("arrow")+'</span></span></button>';
  $("#campaignCards").innerHTML=SpecimenMode.catalog()+lumen+poker+chess+GAME_ORDER.map(game=>{
    const d=GAME_CATALOG[game],p=currentCampaign(game),run=saved.runs[game],resume=run&&!run.completed;
    return '<button class="campaign-card" type="button" data-campaign="'+game+'" '+(gameFilter!=="Все"&&d.category!==gameFilter?"hidden":"")+' aria-label="'+escapeHtml(d.name)+'. '+(resume?'Есть сохранённая партия. ':'')+'Открыть кампанию">'+gameArt(game)+'<span class="campaign-card-copy"><span class="campaign-category">'+escapeHtml(d.category)+'</span><strong>'+escapeHtml(d.name)+'</strong><span class="campaign-card-progress"><span>'+(resume?"Есть сохранение":p.complete?"100 / 100 · пройдено":"Уровень "+p.unlockedLevel+" / 100")+'</span>'+uiIcon("arrow")+'</span>'+(p.completedCount?'<span class="xp-track"><span style="width:'+p.completedCount+'%"></span></span>':'')+'</span></button>';
  }).join("");
}
function updateProfileUI(){
  const name=profile.displayName||"Игрок",initial=[...name][0]?.toUpperCase()||"И";
  ["headerAvatar","homeAvatar","profileAvatar"].forEach(id=>$("#"+id).textContent=initial);
  ["headerRank","homeRank","profileRank"].forEach(id=>$("#"+id).textContent=profile.rank);
  ["homePlayerName","profileName"].forEach(id=>$("#"+id).textContent=name);
  ["homeLevel","profileLevel"].forEach(id=>$("#"+id).textContent=profile.level);
  ["homeXpText","profileXpText"].forEach(id=>$("#"+id).textContent=profile.xpIntoLevel+" / 100 XP");
  ["homeXpBar","profileXpBar"].forEach(id=>$("#"+id).style.width=profile.xpProgress+"%");
  $("#profileXpProgress").setAttribute("aria-valuenow",profile.xpProgress);
  $("#homeNextRank").textContent=profile.nextRank?"до звания "+profile.nextRank:"высшее звание";
  $("#rankNextText").textContent=profile.nextRank?'До звания «'+profile.nextRank+'» — '+Math.max(0,profile.nextRankLevel-profile.level)+" ур.":"Ты достиг высшего звания.";
  $("#profileUsername").textContent=profile.username?"@"+profile.username:hasTelegramIdentity?"профиль Telegram":"локальный профиль";
  $("#homeGamesCount").textContent=profile.totalGames;
  $("#homeStreak").textContent=profile.streak;
  $("#statGames").textContent=profile.totalGames;
  $("#statStreak").textContent=profile.streak;
  $("#statSudoku").textContent=profile.completedCampaignLevels;
  $("#statMemory").textContent=profile.xp;
  $("#streakNote").textContent=profile.totalGames?"Рекорд серии: "+(profile.bestStreak||0)+" дн. Новый игровой день — в 00:00 по Москве.":"Серия начинается с первой завершённой партии. Новый день — по Москве.";
  const unlocked=profile.achievements.filter(a=>a.unlocked).length;
  $("#homeAchievementCount").textContent=unlocked;$("#achievementCount").textContent=unlocked+" / "+profile.achievements.length;
  renderAchievements();
  const c=currentCampaign(),game=saved.selectedCampaign,config=levelConfig(c.unlockedLevel,game),run=saved.runs[game],resume=run&&!run.completed;
  $("#nextLevelNumber").textContent=resume&&run.levelNumber?run.levelNumber:c.unlockedLevel;
  $("#nextLevelLabel").textContent=resume?"Партия ждёт тебя":c.complete?"Кампания пройдена":c.completedCount?"Следующий шаг":"Первый шаг";
  $("#nextLevelDescription").textContent=resume?(run.levelNumber?"Сохранённый этап · ":"Свободная игра · ")+DIFFICULTIES[run.difficulty].label:c.complete?"Все сто этапов позади. Можно сыграть ещё.":"Глава "+config.chapter+" · "+config.difficultyName.toLowerCase();
  $("#campaignPlayLabel").textContent=resume?"Продолжить":c.complete?"Сыграть ещё":"Играть";
  $("#campaignSelect").value=game;
  $("#campaignTitle").textContent=GAME_NAMES[game];
  $("#campaignCategory").textContent=GAME_CATALOG[game].category;
  $("#campaignArt").innerHTML=gameArt(game);
  $("#campaignProgressText").textContent=c.completedCount+" из 100 уровней пройдено";
  $("#campaignProgressBar").style.width=c.completedCount+"%";
  $("#campaignProgress").setAttribute("aria-valuenow",c.completedCount);
  renderCatalog();
  $("#profileCampaigns").innerHTML=GAME_ORDER.map(game=>{const c=currentCampaign(game);return '<button class="profile-campaign" data-campaign="'+game+'" type="button"><span>'+escapeHtml(GAME_NAMES[game])+'</span><strong>'+c.completedCount+'/100 →</strong></button>';}).join("");
  renderLevelMap();hydrateIcons();
}
function levelButton(item,cls){
  return '<button class="'+cls+(item.current?" current":"")+(item.completed?" completed":"")+(item.unlocked?"":" locked")+'" type="button" data-start-level="'+item.number+'" '+(item.unlocked?"":"disabled")+' aria-label="Уровень '+item.number+', '+(item.completed?"пройден":item.current?"текущий":item.unlocked?"открыт":"закрыт")+'"><span>'+(item.completed?"✓":item.number)+'</span><small>'+(item.current?"играть":item.completed?"готово":item.unlocked?item.difficultyName:"закрыт")+'</small>'+(!item.unlocked?uiIcon("lock"):"")+'</button>';
}
function renderLevelMap(){
  const levels=campaignLevels(),current=Math.floor((currentCampaign().unlockedLevel-1)/10);
  $("#levelMap").innerHTML=Array.from({length:10},(_,i)=>{
    const chapter=levels.slice(i*10,i*10+10),done=chapter.filter(l=>l.completed).length;
    return '<details class="chapter-block" '+(i===current?"open":"")+'><summary><span class="chapter-number">'+String(i+1).padStart(2,"0")+'</span><span class="chapter-summary"><strong>Глава '+(i+1)+'</strong><small>Уровни '+(i*10+1)+'–'+(i*10+10)+'</small></span>'+(done?'<span class="chapter-done">'+done+'/10 ✓</span>':'')+'</summary><div class="chapter-levels">'+chapter.map(l=>levelButton(l,"map-level")).join("")+'</div></details>';
  }).join("");
}
function renderHome(){
  updateProfileUI();
  const chess=ChessMode.getResume(),poker=PokerMode.getResume(),specimen=SpecimenMode.getResume(),lumen=LumenMode.getResume(),runs=[...(specimen?[specimen]:[]),...(lumen?[lumen]:[]),...(poker?[poker]:[]),...Object.values(saved.runs).filter(r=>!r.completed),...(chess?[chess]:[])].sort((a,b)=>(b.lastTouchedAt||0)-(a.lastTouchedAt||0)),r=runs[0];
  const title=r?.type==="specimen"?"Нулевой образец":r?.type==="lumen"?"Люмен: последний маяк":r?.type==="poker"?"Математический покер":r?.type==="chess"?"Шахматы":GAME_NAMES[r?.type],subtitle=r?.type==="specimen"?"Побег из лаборатории":r?.type==="lumen"?"Экспедиция":r?.type==="poker"?(r.mode==="solo"?"Против бота":"С другом"):r?.type==="chess"?(CHESS_LEVELS.find(l=>l.id===r.level)?.name||"Против компьютера"):r?.levelNumber?"Уровень "+r.levelNumber:"Свободная игра";
  $("#resumeList").innerHTML=r?'<button class="resume-button" data-resume="'+r.type+'" type="button">'+(r.type==="specimen"?SpecimenMode.art():r.type==="lumen"?LumenMode.art():r.type==="poker"?PokerCards.art():gameArt(r.type))+'<span class="resume-copy"><small>Продолжить партию</small><strong>'+escapeHtml(title)+'</strong><span>'+escapeHtml(subtitle)+' · сохранено '+(r.type==="poker"?"на сервере":"на устройстве")+'</span></span>'+uiIcon("arrow")+'</button>':"";
  $("#pendingNotice").classList.toggle("hidden",!saved.pending.length);
}
function selectCampaign(game){if(!GAME_NAMES[game])return;saved.selectedCampaign=game;saveState();showScreen("levels");}
function showScreen(name){
  pauseGame();clearTimeout(revealHandle);if(saved.current?.revealing){saved.current.revealing=false;saved.current.ready=false;saveState();}
  activeScreen=name;$("#app").classList.toggle("is-playing",["game","chess-game","poker-game","lumen-game","specimen"].includes(name));$$("#main .screen").forEach(s=>s.classList.toggle("active",s.dataset.screen===name));$("#main").scrollTop=0;
  $$(".bottom-nav button").forEach(b=>{b.classList.toggle("active",b.dataset.screenLink===name);b.setAttribute("aria-current",b.dataset.screenLink===name?"page":"false");});
  if(name==="home")renderHome();else if(name==="profile"||name==="levels")updateProfileUI();
  $("#app").classList.toggle("is-poker",name==="poker-game");PokerMode.onScreen(name);ChessMode.onScreen(name);Platform.onScreen(name);LumenMode.onScreen(name);SpecimenMode.onScreen(name);hydrateIcons();
  if(hasTelegramIdentity&&tg?.isVersionAtLeast?.("6.1")&&tg?.BackButton){if(name==="home")tg.BackButton.hide();else tg.BackButton.show();}
  const heading=$(`.screen[data-screen="${name}"] h1,.screen[data-screen="${name}"] h2`);if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
}
function updateElapsed(){const c=saved.current;return Math.max(0,Number(c?.elapsed||0)+(c?.startedAt?(Date.now()-c.startedAt)/1000:0));}
function persistCurrent(){const c=saved.current;if(!c)return;if(!c.completed)c.elapsed=updateElapsed();c.lastTouchedAt=Date.now();c.startedAt=activeScreen==="game"&&!c.completed&&!document.hidden?Date.now():null;saved.runs[c.type]=c;saveState();}
function pauseGame(){clearInterval(timerHandle);if(saved.current){saved.current.elapsed=updateElapsed();saved.current.startedAt=null;saveState();}}
function startTimer(){clearInterval(timerHandle);if(!saved.current||saved.current.completed)return;saved.current.startedAt=Date.now();const tick=()=>{const n=Math.floor(updateElapsed());$("#gameTimer").textContent=`${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`;};tick();timerHandle=setInterval(tick,1000);}
function apiAvailable(){return hasTelegramIdentity;}
async function apiRequest(path,body){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
  try{const response=await fetch(path,{method:body?"POST":"GET",headers:{"Content-Type":"application/json","X-Init-Data":tg?.initData||""},body:body?JSON.stringify(body):undefined,signal:controller.signal,cache:"no-store"});const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.detail||`Сервер недоступен (${response.status})`);return payload;}catch(error){if(error.name==="AbortError")throw new Error("Сервер не ответил. Проверь соединение и повтори.");throw error;}finally{clearTimeout(timeout);}
}
async function loadProfile(){
  const status=$("#connectionStatus");status.parentElement.classList.remove("error","connected");status.textContent=hasTelegramIdentity?"Подключаем игровой профиль…":"Локальный просмотр · прогресс на этом устройстве";
  $("#retryConnection").classList.add("hidden");
  if(hasTelegramIdentity){try{cacheProfile(await apiRequest("/api/profile"));serverReady=true;status.parentElement.classList.add("connected");status.textContent="Профиль Telegram подключён · прогресс синхронизирован";}catch(error){serverReady=false;status.parentElement.classList.add("error");status.textContent=`Не удалось подключить профиль: ${error.message}`;$("#retryConnection").classList.remove("hidden");}}
  renderHome();
}
async function startGame(type,difficulty="easy",levelNumber=null,replace=false){
  if(starting)return;if(hasTelegramIdentity&&!serverReady){showToast("Сначала подключи профиль кнопкой «Повторить подключение».");return;}
  const existing=saved.runs[type];if(!replace&&existing&&!existing.completed&&existing.levelNumber===levelNumber&&existing.difficulty===difficulty){resumeGame(type);return;}
  if(existing&&!existing.completed&&!window.confirm("В этой игре уже есть незавершённая партия. Заменить её новой?"))return;
  starting=true;$("#launchStatus").textContent="Готовим поле…";
  try{
    const session=apiAvailable()?await apiRequest("/api/games/start",{game_type:type,difficulty,level_number:levelNumber}):null;
    const config=session||(levelNumber?levelConfig(levelNumber,type):{game:type,difficulty,number:null});
    const game=session?.puzzle||createPuzzle(config.game,config.difficulty,config.number,session?.sessionId);game.sessionId=session?.sessionId||null;game.startedAt=Date.now();game.lastTouchedAt=Date.now();
    pauseGame();saved.current=game;saved.runs[type]=game;saved.selectedCampaign=type;saveState();openCurrentGame();
  }catch(error){showToast(`Не удалось начать: ${error.message}`);}finally{starting=false;$("#launchStatus").textContent="";}
}
function startLevel(number){const c=currentCampaign();if(number>c.unlockedLevel)return;const config=levelConfig(number,saved.selectedCampaign);startGame(config.game,config.difficulty,number);}
function resumeGame(type){const c=saved.runs[type];if(!c||c.completed)return;pauseGame();saved.current=c;c.lastTouchedAt=Date.now();saved.selectedCampaign=type;if(type==="memory")c.cards.forEach(card=>{if(!card.matched)card.open=false;});if(type==="pattern"){c.revealing=false;c.ready=false;c.selectedCells=[];}openCurrentGame();}
function openCurrentGame(){memoryLocked=false;$("#gameRules").classList.add("hidden");$("#gameHelp").setAttribute("aria-expanded","false");showScreen("game");renderCurrentGame();startTimer();$("#gameTitle").tabIndex=-1;$("#gameTitle").focus({preventScroll:true});}
function renderCurrentGame(){$("#gameMount").removeAttribute("aria-busy");const c=saved.current;if(!c)return;if(c.completed){renderSuccess();return;}({sudoku:renderSudoku,memory:renderMemory,tiles:renderTiles,pattern:renderPattern,nonogram:renderNonogram,stroop:renderStroop}[c.type]||renderQuestionGame)();if(c.sessionId&&!c.serverChallengeVersion)$("#gameMount").insertAdjacentHTML("afterbegin",'<div class="lobby-notice"><p>Эта партия начата до обновления проверки решений. Для сохранения XP нужно начать этап заново.</p><button class="text-button" type="button" data-restart-verified>Начать с серверной проверкой</button></div>');}
function difficultyPicker(){const c=saved.current;return c.levelNumber?"":'<div class="level-picker" role="group" aria-label="Сложность">'+Object.entries(DIFFICULTIES).map(([key,d])=>'<button class="level-button'+(key===c.difficulty?" active":"")+'" aria-pressed="'+(key===c.difficulty)+'" data-game-difficulty="'+key+'" type="button">'+d.label+'</button>').join("")+'</div>';}
function updateGameMeta(description){
  const c=saved.current;if(!c)return;
  $("#gameTitle").textContent=GAME_NAMES[c.type];
  $("#gameLevelStatus").textContent=(c.levelNumber?"Уровень "+c.levelNumber+" / 100":"Свободная игра")+" · "+DIFFICULTIES[c.difficulty].label;
  if(description)$("#gameRules").textContent=description;
}
function gameHeader(description){updateGameMeta(description);return difficultyPicker();}

function applyLocalCompletion(current){
  const local=saved.local,before=new Set(eligibleAchievements(local).filter(a=>a.unlocked).map(a=>a.id)),campaign=local.campaigns[current.type];
  const replay=Boolean(current.levelNumber&&campaign.completedLevels.includes(current.levelNumber));
  const xp=(replay?10:GAME_CATALOG[current.type].xp+{easy:0,medium:10,hard:20}[current.difficulty]+(current.levelNumber?10:0))+(current.hints?0:5);
  local.xp+=xp;local.totalGames++;local.stats[current.type]++;if(!current.hints)local.noHints++;
  local.streak=local.lastPlayedDate===dayKey()?local.streak:local.lastPlayedDate===dayKey(-1)?local.streak+1:1;local.bestStreak=Math.max(local.bestStreak,local.streak);local.lastPlayedDate=dayKey();
  if(current.levelNumber&&!replay){campaign.completedLevels.push(current.levelNumber);campaign.completedCount=campaign.completedLevels.length;campaign.unlockedLevel=Array.from({length:100},(_,i)=>i+1).find(n=>!campaign.completedLevels.includes(n))||100;campaign.complete=campaign.completedCount===100;}
  const result=buildLocalProfile();return {xpAwarded:xp,newAchievements:result.achievements.filter(a=>a.unlocked&&!before.has(a.id)),profile:result};
}
async function syncCompletedGame(current=saved.current){
  if(!current?.sessionId||current.syncPending)return;current.syncPending=true;current.syncError=null;if(current===saved.current&&activeScreen==="game")renderSuccess(true);
  try{const result=await apiRequest("/api/games/complete",{session_id:current.sessionId,elapsed_seconds:Math.floor(current.elapsed),hints:current.hints||0,moves:current.moves||0,proof:completionProof(current)});current.result=result;current.syncError=null;saved.pending=saved.pending.filter(c=>c.sessionId!==current.sessionId);cacheProfile(result.profile);}
  catch(error){current.syncError=error.message;if(!saved.pending.some(c=>c.sessionId===current.sessionId))saved.pending.push(current);showToast("Результат сохранён на устройстве. Можно повторить синхронизацию.");}
  finally{current.syncPending=false;saveState();if(current===saved.current&&activeScreen==="game")renderSuccess();renderHome();}
}
async function retryPending(){for(const c of [...saved.pending])await syncCompletedGame(c);}
function completionProof(c){
  if(["sudoku","nonogram"].includes(c.type))return {board:c.board};
  if(c.type==="tiles")return {board:c.board,tileMoves:c.proofTileMoves||[]};
  if(c.type==="memory")return {pairs:c.proofPairs||[]};
  if(c.type==="pattern")return {patterns:c.proofPatterns||[]};
  return {answers:c.proofAnswers||[]};
}
async function finishGame(){const c=saved.current;if(!c||c.completed)return;c.elapsed=updateElapsed();c.startedAt=null;c.completed=true;clearInterval(timerHandle);clearTimeout(revealHandle);saveState();if(hasTelegramIdentity&&tg?.isVersionAtLeast?.("6.1")){try{tg.HapticFeedback?.notificationOccurred("success");}catch(_){}}if(c.sessionId&&apiAvailable())await syncCompletedGame(c);else{c.result=applyLocalCompletion(c);cacheProfile(c.result.profile);saveState();renderSuccess();renderHome();}}
function renderSuccess(pending=false){
  updateGameMeta();$("#gameMount").setAttribute("aria-busy",String(pending));
  const c=saved.current,result=c.result||{},n=currentCampaign(c.type).unlockedLevel,next=c.levelNumber&&!currentCampaign(c.type).complete&&n>c.levelNumber;
  $("#gameMount").innerHTML=`<div class="success-panel"><div class="success-mark" aria-hidden="true">${rewardStar()}</div><p class="eyebrow">${c.levelNumber?`УРОВЕНЬ ${c.levelNumber} ПРОЙДЕН`:"ПАРТИЯ ЗАВЕРШЕНА"}</p><h2>${pending?"Сохраняем результат…":"Отличный ход."}</h2><p>${Math.floor(c.elapsed/60)} мин ${Math.floor(c.elapsed%60)} сек · ${c.hints} подсказок</p>${pending?"":c.syncError?`<p class="sync-error">${escapeHtml(c.syncError)}</p><button class="primary-button" data-retry-save="true" type="button">Повторить сохранение</button>`:`<div class="xp-reward">+${result.xpAwarded||0} XP</div><div class="new-achievements-list">${(result.newAchievements||[]).map(a=>`<div class="new-achievement">${rewardStar()}<strong>${escapeHtml(a.title)}</strong></div>`).join("")}</div>${next?`<button class="primary-button" data-start-level="${n}" type="button">Следующий уровень →</button>`:""}`}<div class="game-actions"><button class="secondary-button" data-screen-link="levels" type="button">Кампания</button><button class="secondary-button" data-screen-link="profile" type="button">Профиль</button></div></div>`;
}

function renderSudoku() {
  const focusBefore=document.activeElement?.getAttribute("data-sudoku-cell");
  const current = saved.current;
  const conflicts = sudokuConflicts(current.board);
  const selected = current.selected;
  const selectedRow = selected >= 0 ? Math.floor(selected / 9) : -1;
  const selectedCol = selected >= 0 ? selected % 9 : -1;
  const selectedBox = selected >= 0 ? Math.floor(selectedRow / 3) * 3 + Math.floor(selectedCol / 3) : -1;
  const selectedValue = selected >= 0 ? current.board[selected] : 0;
  const cells = current.board.map((value, index) => {
    const row = Math.floor(index / 9), col = index % 9, box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
    const classes = ["sudoku-cell"];
    if (current.given[index]) classes.push("given");
    if (index === selected) classes.push("selected");
    else if (selected >= 0 && (row === selectedRow || col === selectedCol || box === selectedBox)) classes.push("related");
    if (selectedValue && value === selectedValue) classes.push("same-number");
    if (conflicts.has(index)) classes.push("conflict");
    return `<button class="${classes.join(" ")}" type="button" data-sudoku-cell="${index}" aria-pressed="${index===selected}" aria-label="Строка ${row + 1}, столбец ${col + 1}${value ? `, ${value}` : ", пусто"}${current.given[index]?", задано":""}${conflicts.has(index)?", конфликт":""}">${value || ""}</button>`;
  }).join("");
  updateGameMeta("Цифры от 1 до 9 не повторяются в строках, столбцах и квадратах 3×3. Выбери пустую клетку и цифру. На клавиатуре работают цифры, стрелки и Backspace. Подсказка заполняет одну клетку.");
  $("#gameMount").innerHTML = difficultyPicker()+'<div class="game-panel sudoku-layout"><div class="sudoku-meta"><span>Подсказки: '+current.hints+'</span><span>'+ (81-current.board.filter(Boolean).length)+' пустых клеток</span></div><div class="sudoku-grid" role="group" aria-label="Поле судоку">'+cells+'</div><div class="sudoku-tools"><button data-sudoku-erase="true" type="button">'+uiIcon("erase")+'Очистить</button><button data-sudoku-hint="true" type="button">'+uiIcon("bulb")+'Подсказка</button><button data-sudoku-check="true" type="button">'+uiIcon("check")+'Проверить</button></div><div class="sudoku-pad" aria-label="Выбор цифры">'+[1,2,3,4,5,6,7,8,9].map(n=>'<button class="number-button" type="button" data-sudoku-number="'+n+'">'+n+'</button>').join("")+'<button class="number-button erase" type="button" data-sudoku-erase="true" aria-label="Очистить выбранную клетку">'+uiIcon("erase")+'</button></div></div><p class="game-note">Выбери клетку, затем цифру. Играй без спешки.</p>';
  if(focusBefore!==null&&focusBefore!==undefined)$('[data-sudoku-cell="'+focusBefore+'"]')?.focus({preventScroll:true});
}

function setSudokuNumber(value) {
  const current = saved.current;
  if (!current || current.type !== "sudoku") return;
  const index = current.selected;
  if (index < 0 || current.given[index]) {
    showToast("Сначала выбери пустую клетку");
    return;
  }
  current.board[index] = value;
  persistCurrent();
  renderSudoku();
  if (current.board.every((number) => number !== 0) && current.board.every((number, cell) => number === current.solution[cell])) finishGame();
}

function sudokuHint() {
  const current = saved.current;
  if (!current || current.type !== "sudoku") return;
  let index = current.selected;
  if (index < 0 || current.given[index]) index = current.board.findIndex((value, cell) => value === 0 && !current.given[cell]);
  if (index < 0) return;
  current.selected = index;
  current.board[index] = current.solution[index];
  current.hints += 1;
  persistCurrent();
  renderSudoku();
  if (current.board.every((number, cell) => number === current.solution[cell])) finishGame();
}

/* ---------- Тренировка памяти ---------- */

function renderMemory() {
  const current = saved.current;
  const matched = current.cards.filter((card) => card.matched).length / 2;
  updateGameMeta("Открывай по две карточки и собирай одинаковые пары. Запоминай расположение фигур.");
  $("#gameMount").innerHTML = `${difficultyPicker()}<div class="game-panel"><div class="memory-summary"><span>Пары: <strong>${matched}/${current.cards.length / 2}</strong></span><span>Ходы: <strong>${current.moves}</strong></span></div><div class="memory-grid${current.cards.length<=8?" memory-small":""}" aria-label="Карточки для тренировки памяти">${current.cards.map((card) => `<button class="memory-card${card.open ? " open" : ""}${card.matched ? " matched" : ""}" type="button" data-memory-card="${card.id}" aria-label="Карточка ${card.matched || card.open ? card.value : "закрыта"}">${card.open || card.matched ? card.value : "✦"}</button>`).join("")}</div></div><p class="game-note">Запоминай расположение и собери все ${current.cards.length / 2} пар.</p>`;
}

function selectMemoryCard(id) {
  const current = saved.current;
  if (!current || current.type !== "memory" || memoryLocked) return;
  const card = current.cards.find((item) => item.id === id);
  if (!card || card.open || card.matched) return;
  const openCards = current.cards.filter((item) => item.open && !item.matched);
  if (openCards.length >= 2) return;
  card.open = true;
  if (openCards.length === 0) {
    persistCurrent();
    renderMemory();
    return;
  }
  const first = openCards[0];
  current.moves += 1;
  if (first.value === card.value) {
    (current.proofPairs||=[]).push([first.id,card.id]);
    first.matched = true;
    card.matched = true;
    persistCurrent();
    renderMemory();
    if (current.cards.every((item) => item.matched)) finishGame();
    return;
  }
  memoryLocked = true;
  persistCurrent();
  renderMemory();
  setTimeout(() => {
    if (saved.current !== current) return;
    first.open = false;
    card.open = false;
    memoryLocked = false;
    persistCurrent();
    renderMemory();
  }, 720);
}


function renderQuestionGame(){
  const c=saved.current,q=c.questions[c.index];if(!q){finishGame();return;}
  const numeric=["sequences","arithmetic","riddles"].includes(c.type);
  const descriptions={sequences:"Найди правило ряда и впиши следующее число.",riddles:"Прочитай условие и найди ответ. Все ответы в этой кампании — числа.",rebuses:"Раскрой правило и расшифруй слово. В алфавитных шифрах учитывается Ё.",arithmetic:"Посчитай в уме. Приоритет действий: скобки, умножение и деление, затем сложение."};
  $("#gameMount").innerHTML=`${gameHeader(descriptions[c.type])}<div class="game-panel"><p class="puzzle-progress">Задача ${c.index+1} из ${c.questions.length}</p><div class="round-progress"><span style="width:${c.index/c.questions.length*100}%"></span></div><p class="puzzle-question">${escapeHtml(q.question)}</p><p class="puzzle-hint" id="puzzleHint">${c.hintShown?escapeHtml(q.hint):""}</p><label class="answer-label" for="puzzleAnswer">${numeric?"Ответ числом":"Ответ словом"}</label><div class="answer-row"><input class="answer-input" id="puzzleAnswer" type="text" inputmode="${numeric?"decimal":"text"}" autocomplete="off" placeholder="Твой ответ"><button class="primary-button" data-puzzle-check="true" type="button">Ответить</button></div><p class="feedback" id="puzzleFeedback" aria-live="polite"></p></div><div class="game-actions"><button class="secondary-button" data-puzzle-hint="true" type="button" ${c.hintShown?"disabled":""}>${c.hintShown?"Подсказка показана":"Подсказка"}</button></div>`;
}
function checkPuzzleAnswer(){
  const c=saved.current;if(!c?.questions||c.completed||c.answerLocked||c.type==="stroop")return;
  const input=$("#puzzleAnswer"),feedback=$("#puzzleFeedback"),q=c.questions[c.index],answer=normalizeAnswer(input?.value);
  if(!answer){feedback.textContent="Впиши ответ.";input?.focus();return;}
  c.moves++;
  if(q.answers.some(a=>normalizeAnswer(a)===answer)){
    (c.proofAnswers||=[]).push(input.value);
    feedback.textContent="Верно!";feedback.className="feedback correct";c.index++;c.hintShown=false;c.answerLocked=true;persistCurrent();
    setTimeout(()=>{c.answerLocked=false;if(saved.current!==c||c.completed)return;if(c.index===c.questions.length)finishGame();else if(activeScreen==="game"){renderQuestionGame();$("#puzzleAnswer")?.focus({preventScroll:true});}},250);
  }else{feedback.textContent="Пока не совпало. Проверь рассуждение или возьми подсказку.";feedback.className="feedback incorrect";input.select();persistCurrent();}
}
function showPuzzleHint(){const c=saved.current;if(!c?.questions||c.hintShown||c.completed)return;c.hintShown=true;c.hints++;persistCurrent();renderQuestionGame();}
function renderTiles(){
  const c=saved.current,blank=c.board.indexOf(0),size=c.size;
  $("#gameMount").innerHTML=`${gameHeader("Сдвигай соседние с пустотой плитки. Расположи числа по порядку, пустую клетку — справа внизу.")}<div class="game-panel"><div class="memory-summary"><span>Поле ${size} × ${size}</span><span>Ходов: ${c.moves}</span></div><div class="tiles-grid" style="--grid-size:${size}" role="group" aria-label="Поле пятнашек">${c.board.map((n,i)=>{const adjacent=Math.abs(Math.floor(i/size)-Math.floor(blank/size))+Math.abs(i%size-blank%size)===1;return `<button class="tile${!n?" empty":""}${adjacent?" movable":""}" data-tile="${i}" aria-label="${n?`Плитка ${n}${adjacent?", можно сдвинуть":""}`:"Пустая клетка"}" type="button" ${!n?"disabled":""}>${n||""}</button>`;}).join("")}</div></div><div class="game-actions"><button class="secondary-button" data-tiles-undo="true" type="button" ${c.history.length?"":"disabled"}>Отменить ход</button></div><p class="game-note">Отмена считается подсказкой. На компьютере можно двигать пустую клетку стрелками.</p>`;
}
function moveTile(index){const c=saved.current;if(c?.type!=="tiles"||c.completed)return;const blank=c.board.indexOf(0);if(Math.abs(Math.floor(index/c.size)-Math.floor(blank/c.size))+Math.abs(index%c.size-blank%c.size)!==1){showToast("Сдвигается только плитка рядом с пустой клеткой.");return;}(c.proofTileMoves||=[]).push(index);c.history.push(blank);[c.board[blank],c.board[index]]=[c.board[index],c.board[blank]];c.moves++;persistCurrent();renderTiles();if(c.board.every((v,i)=>v===(i+1)%c.board.length))finishGame();}
function undoTile(){const c=saved.current;if(c?.type!=="tiles"||!c.history.length||c.completed)return;const blank=c.board.indexOf(0),previous=c.history.pop();(c.proofTileMoves||=[]).push(previous);[c.board[blank],c.board[previous]]=[c.board[previous],c.board[blank]];c.hints++;c.moves++;persistCurrent();renderTiles();}
function renderPattern(){
  const c=saved.current,pattern=c.patterns[c.round],selected=new Set(c.selectedCells);
  $("#gameMount").innerHTML=`${gameHeader("Запомни подсвеченные клетки, затем отметь их на пустом поле.")}<div class="game-panel"><div class="memory-summary"><span>Раунд ${c.round+1}/${c.patterns.length}</span><span>${c.revealing?"Запоминай":c.ready?`Выбрано ${selected.size}/${pattern.length}`:"Готов?"}</span></div><div class="pattern-grid" style="--grid-size:${c.size}" role="group" aria-label="Матрица памяти">${Array.from({length:c.size*c.size},(_,i)=>`<button class="pattern-cell${c.revealing&&pattern.includes(i)?" revealed":""}${!c.revealing&&selected.has(i)?" selected":""}" data-pattern-cell="${i}" type="button" aria-label="Клетка ${i+1}" aria-pressed="${selected.has(i)}" ${!c.ready||c.revealing?"disabled":""}>${c.revealing&&pattern.includes(i)||selected.has(i)?"●":""}</button>`).join("")}</div><p class="feedback" aria-live="polite">${escapeHtml(c.feedback||"")}</p><button class="primary-button" data-pattern-reveal="true" type="button" ${c.revealing?"disabled":""}>${c.revealing?"Запоминай узор…":c.ready?"Показать ещё раз (подсказка)":"Показать узор"}</button></div><p class="game-note">Повторный показ в одном раунде считается подсказкой. Можно менять выбранные клетки.</p>`;
}
function revealPattern(){const c=saved.current;if(c?.type!=="pattern"||c.revealing||c.completed)return;if(c.shownRound===c.round)c.hints++;c.shownRound=c.round;c.revealing=true;c.ready=false;c.selectedCells=[];c.feedback="";persistCurrent();renderPattern();clearTimeout(revealHandle);revealHandle=setTimeout(()=>{if(saved.current!==c||activeScreen!=="game"||c.completed)return;c.revealing=false;c.ready=true;persistCurrent();renderPattern();},c.revealDuration);}
function selectPattern(index){const c=saved.current;if(c?.type!=="pattern"||!c.ready||c.revealing||c.completed)return;const at=c.selectedCells.indexOf(index);if(at>=0)c.selectedCells.splice(at,1);else c.selectedCells.push(index);c.moves++;const target=c.patterns[c.round];c.feedback="";if(c.selectedCells.length===target.length){if(target.every(i=>c.selectedCells.includes(i))){(c.proofPatterns||=[]).push([...c.selectedCells]);c.round++;c.selectedCells=[];c.ready=false;if(c.round===c.patterns.length){finishGame();return;}c.feedback="Верно. Следующий узор.";}else c.feedback="Узор отличается. Можно изменить выбор или показать его ещё раз.";}persistCurrent();renderPattern();}
function renderStroop(){const c=saved.current,q=c.questions[c.index];$("#gameMount").innerHTML=`${gameHeader("Назови цвет букв. Значение самого слова не учитывается.")}<div class="game-panel stroop-panel"><p class="puzzle-progress">Раунд ${c.index+1}/${c.questions.length}</p><p class="stroop-word" style="color:${INK_COLORS[q.ink].color}" aria-label="Слово ${INK_COLORS[q.word].name}">${INK_COLORS[q.word].name}</p><div class="color-choices">${INK_COLORS.map((color,i)=>`<button class="secondary-button color-choice" data-ink="${i}" type="button"><span style="background:${color.color}" aria-hidden="true"></span>${color.name}</button>`).join("")}</div><p class="feedback" aria-live="polite">${escapeHtml(c.feedback||"")}</p></div>`;}
function selectInk(index){const c=saved.current;if(c?.type!=="stroop"||c.completed)return;c.moves++;if(index===c.questions[c.index].ink){(c.proofAnswers||=[]).push(index);c.index++;c.feedback="Верно!";if(c.index===c.questions.length){finishGame();return;}}else c.feedback="Смотри на цвет букв, а не на значение слова.";persistCurrent();renderStroop();}
function renderNonogram(){
  const c=saved.current;
  $("#gameMount").innerHTML=`${gameHeader("Числа задают длину закрашенных групп. Между группами оставь хотя бы одну пустую клетку.")}<div class="game-panel nonogram-panel"><div class="nonogram-grid" role="group" aria-label="Японский кроссворд 5 на 5"><span></span>${c.colClues.map(clue=>`<span class="nonogram-col-clue">${clue.join("<br>")}</span>`).join("")}${c.rowClues.map((clue,r)=>`<span class="nonogram-row-clue">${clue.join(" ")}</span>${c.board.slice(r*5,r*5+5).map((v,col)=>`<button class="nonogram-cell${v===1?" filled":v===-1?" crossed":""}" data-nonogram-cell="${r*5+col}" type="button" aria-label="Строка ${r+1}, столбец ${col+1}, ${v===1?"закрашено":v===-1?"пустая клетка":"не отмечено"}">${v===-1?"×":""}</button>`).join("")}`).join("")}</div><div class="level-picker" aria-label="Инструмент">${[["fill","Закрасить"],["cross","Крестик"]].map(([mode,label])=>`<button class="level-button${mode===c.markMode?" active":""}" data-nonogram-mode="${mode}" type="button">${label}</button>`).join("")}</div><p class="feedback" aria-live="polite">${escapeHtml(c.feedback||"")}</p></div><div class="game-actions"><button class="secondary-button" data-nonogram-hint="true" type="button">Подсказка</button><button class="primary-button" data-nonogram-check="true" type="button">Проверить</button></div><p class="game-note">Повторное нажатие снимает отметку. Пустые клетки можно оставлять без крестиков.</p>`;
}
function nonogramSolved(c){return c.board.every((v,i)=>(v===1?1:0)===c.solution[i]);}
function markNonogram(index){const c=saved.current;if(c?.type!=="nonogram"||c.completed)return;const mark=c.markMode==="fill"?1:-1;c.board[index]=c.board[index]===mark?0:mark;c.moves++;c.feedback="";persistCurrent();renderNonogram();if(nonogramSolved(c))finishGame();}
function hintNonogram(){const c=saved.current;if(c?.type!=="nonogram"||c.completed)return;const index=c.board.findIndex((v,i)=>(v===1?1:0)!==c.solution[i]);if(index<0){finishGame();return;}c.board[index]=c.solution[index]?1:-1;c.hints++;persistCurrent();renderNonogram();if(nonogramSolved(c))finishGame();}

function configureTelegram(){
  if(!tg||!hasTelegramIdentity)return;const call=fn=>{try{fn();}catch(_){}};
  call(()=>tg.ready());call(()=>tg.expand());call(()=>tg.setHeaderColor("#F5F7FB"));call(()=>tg.setBackgroundColor("#F5F7FB"));if(tg.isVersionAtLeast?.("7.10"))call(()=>tg.setBottomBarColor("#FFFFFF"));
  if(tg.isVersionAtLeast?.("8.0"))call(()=>tg.requestFullscreen());
  if(tg.isVersionAtLeast?.("7.7"))call(()=>tg.disableVerticalSwipes());
  if(tg.isVersionAtLeast?.("6.2"))call(()=>tg.enableClosingConfirmation());
  const safeArea=()=>{const top=(tg.safeAreaInset?.top||0)+(tg.contentSafeAreaInset?.top||0),bottom=(tg.safeAreaInset?.bottom||0)+(tg.contentSafeAreaInset?.bottom||0);document.documentElement.style.setProperty("--app-safe-top",`${top}px`);document.documentElement.style.setProperty("--app-safe-bottom",`${bottom}px`);};
  safeArea();call(()=>tg.onEvent("safeAreaChanged",safeArea));call(()=>tg.onEvent("contentSafeAreaChanged",safeArea));call(()=>tg.BackButton.onClick(()=>{if(activeScreen==="specimen"){SpecimenMode.back();return;}if(["lumen","lumen-game"].includes(activeScreen)){LumenMode.back();return;}showScreen(activeScreen==="poker-game"?"poker":activeScreen==="chess-game"?"chess":activeScreen==="game"?"levels":"home");}));
}
document.addEventListener("click",event=>{
  const target=event.target.closest("button");if(!target||target.disabled)return;
  if(target.hasAttribute("data-restart-verified")){const c=saved.current;startGame(c.type,c.difficulty,c.levelNumber,true);return;}
  if(PokerMode.click(target))return;
  if(ChessMode.click(target))return;
  if(LumenMode.click(target))return;
  if(SpecimenMode.click(target))return;
  if(target.dataset.resume==="poker"){PokerMode.resume();return;}
  if(target.dataset.resume==="chess"){ChessMode.resume();return;}
  if(target.closest("#gameMount")){const entry=Object.entries(target.dataset)[0];if(entry)queueMicrotask(()=>{if(!target.isConnected&&activeScreen==="game"){const attr="data-"+entry[0].replace(/[A-Z]/g,c=>"-"+c.toLowerCase());const replacement=$$("button["+attr+"]",$("#gameMount")).find(b=>b.getAttribute(attr)===entry[1]);replacement?.focus({preventScroll:true});}});}
  if(target.dataset.filter){gameFilter=target.dataset.filter;$$("[data-filter]").forEach(b=>{b.classList.toggle("active",b.dataset.filter===gameFilter);b.setAttribute("aria-pressed",String(b.dataset.filter===gameFilter));});renderCatalog();return;}
  if(target.id==="gameHelp"){const open=$("#gameRules").classList.toggle("hidden");target.setAttribute("aria-expanded",String(!open));return;}
  if(target.dataset.screenLink){showScreen(target.dataset.screenLink);return;}
  if(target.dataset.campaign){selectCampaign(target.dataset.campaign);return;}
  if(target.dataset.startLevel){startLevel(Number(target.dataset.startLevel));return;}
  if(target.hasAttribute("data-play-current-level")){const c=currentCampaign();const run=saved.runs[saved.selectedCampaign];if(run&&!run.completed)resumeGame(run.type);else if(c.complete)startGame(saved.selectedCampaign);else startLevel(c.unlockedLevel);return;}
  if(target.id==="freePlay"){startGame(saved.selectedCampaign);return;}
  if(target.dataset.resume){resumeGame(target.dataset.resume);return;}
  if(target.id==="retryConnection"){loadProfile().then(()=>{if(serverReady)return Platform.init();});return;}
  if(target.id==="retryPending"){retryPending();return;}
  if(target.dataset.retrySave){syncCompletedGame();return;}
  if(target.dataset.gameDifficulty){if(saved.current&&!saved.current.levelNumber)startGame(saved.current.type,target.dataset.gameDifficulty);return;}
  const c=saved.current;if(!c||c.completed||activeScreen!=="game")return;
  if(target.dataset.sudokuCell!==undefined){c.selected=Number(target.dataset.sudokuCell);persistCurrent();renderSudoku();return;}
  if(target.dataset.sudokuNumber){c.moves++;setSudokuNumber(Number(target.dataset.sudokuNumber));return;}
  if(target.dataset.sudokuErase){setSudokuNumber(0);return;}
  if(target.dataset.sudokuHint){sudokuHint();return;}
  if(target.dataset.sudokuCheck){if(c.board.every((v,i)=>v===c.solution[i]))finishGame();else showToast(sudokuConflicts(c.board).size?"Есть повторы в строках, столбцах или блоках.":"Пока не всё заполнено верно.");return;}
  if(target.dataset.memoryCard!==undefined){selectMemoryCard(Number(target.dataset.memoryCard));return;}
  if(target.dataset.tile!==undefined){moveTile(Number(target.dataset.tile));return;}
  if(target.dataset.tilesUndo){undoTile();return;}
  if(target.dataset.patternReveal){revealPattern();return;}
  if(target.dataset.patternCell!==undefined){selectPattern(Number(target.dataset.patternCell));return;}
  if(target.dataset.ink!==undefined){selectInk(Number(target.dataset.ink));return;}
  if(target.dataset.nonogramCell!==undefined){markNonogram(Number(target.dataset.nonogramCell));return;}
  if(target.dataset.nonogramMode){c.markMode=target.dataset.nonogramMode;persistCurrent();renderNonogram();return;}
  if(target.dataset.nonogramHint){hintNonogram();return;}
  if(target.dataset.nonogramCheck){if(nonogramSolved(c))finishGame();else{c.feedback="Узор пока не совпадает с подсказками. Проверь закрашенные группы.";renderNonogram();}return;}
  if(target.dataset.puzzleCheck){checkPuzzleAnswer();return;}
  if(target.dataset.puzzleHint)showPuzzleHint();
});
$("#campaignSelect").addEventListener("change",event=>selectCampaign(event.target.value));
document.addEventListener("keydown",event=>{
  if(activeScreen!=="game"||saved.current?.completed)return;
  if(event.key==="Enter"&&event.target.id==="puzzleAnswer"){event.preventDefault();checkPuzzleAnswer();return;}
  if(["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName))return;
  if(saved.current?.type==="sudoku"){const c=saved.current;const delta={ArrowUp:-9,ArrowDown:9,ArrowLeft:-1,ArrowRight:1}[event.key];if(delta!==undefined){event.preventDefault();c.selected=Math.max(0,Math.min(80,(c.selected<0?0:c.selected)+delta));persistCurrent();renderSudoku();$("[data-sudoku-cell='"+c.selected+"']").focus({preventScroll:true});return;}if(/^[1-9]$/.test(event.key))setSudokuNumber(Number(event.key));if(["Backspace","Delete"].includes(event.key)){event.preventDefault();setSudokuNumber(0);}}
  if(saved.current?.type==="tiles"){const c=saved.current,blank=c.board.indexOf(0),offset={ArrowUp:-c.size,ArrowDown:c.size,ArrowLeft:-1,ArrowRight:1}[event.key];if(offset!==undefined){event.preventDefault();const next=blank+offset;if(next>=0&&next<c.board.length&&(Math.abs(offset)!==1||Math.floor(next/c.size)===Math.floor(blank/c.size)))moveTile(next);}}
});
window.addEventListener("pagehide",()=>{pauseGame();flushDeviceSave();});
document.addEventListener("visibilitychange",()=>{if(document.hidden)pauseGame();else if(activeScreen==="game"&&!saved.current?.completed)startTimer();});
async function initializeGame(){hydrateIcons();configureTelegram();await hydrateDeviceSave();saveState();await loadProfile();if(serverReady&&hasTelegramIdentity){await Platform.init();await retryPending();}if(new URLSearchParams(location.search).get("screen")==="profile")showScreen("profile");}
initializeGame().catch(error=>{$("#connectionStatus").parentElement.classList.add("error");$("#connectionStatus").textContent=`Ошибка запуска: ${error.message}`;$("#retryConnection").classList.remove("hidden");});

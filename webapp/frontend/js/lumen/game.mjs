import {createRun,step,chooseUpgrade,serialize,restore,UPGRADES} from './engine.mjs';
import {Renderer} from './renderer.mjs';
import {loadArt} from './assets.mjs';
import {StoryOverlay} from './story-overlay.mjs';
import {worldScene,bossScene} from './story.mjs';
import {WORLD_FINALS} from './arena.mjs';
import {renderMenu,MENU_PAGES} from './menu.mjs';
import {buyTraining} from './training.mjs';
import {WEAPONS,upgradeSummary} from './presentation.mjs';
import {waveAt} from './progression.mjs';
import {BOSS_VARIANTS} from './bosses.mjs';
import {touchingEnemies} from './physics.mjs';
import {castleGuidance} from './castle.mjs';
import {CHARACTERS,WEAPON_IDS,HYBRIDS,ARTIFACTS,BOSSES,MAPS,weaponRarity,MAX_WEAPONS,MAX_ARTIFACTS} from './catalog.mjs';
import {normalizeMeta,buyCharacter,bankCoins,recordProgress,mapAvailable} from './economy.mjs';

const clock = n => `${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}`;
const roman=['','I','II','III','IV','V','VI','VII','VIII'];
const iconIndex={spark:0,orbit:1,pulse:2,focus:3,haste:4,stride:5,magnet:6,vitality:7,repair:8,pause:9,fullscreen:10,sound:11,mute:12,gem:13,light:14,stars:15};
const itemIcon=index=>`<span class="lumen-new-icon" style="--item-x:${index%5};--item-y:${Math.floor(index/5)}" aria-hidden="true"></span>`;
const expansionIcon=index=>`<span class="lumen-expansion-icon" style="--item-x:${index%8};--item-y:${Math.floor(index/8)}" aria-hidden="true"></span>`;
const pixelIcon = name => ARTIFACTS[name]?.index>=4?expansionIcon(10+ARTIFACTS[name].index-4):WEAPONS[name]?.index>=14?expansionIcon(WEAPONS[name].index-14):ARTIFACTS[name]?itemIcon(6+ARTIFACTS[name].index):WEAPONS[name]?.index>=8?itemIcon(WEAPONS[name].index-8):WEAPONS[name]
  ? `<span class="lumen-weapon-icon ${WEAPONS[name].className}" style="--weapon:${WEAPONS[name].index}" aria-hidden="true"></span>`
  : name==='coin'?'<span class="lumen-coin-icon" aria-hidden="true"></span>'
  : `<span class="lumen-pixel-icon" style="--icon:${iconIndex[name] ?? 0}" aria-hidden="true"></span>`;

function recipeBook(upgrades={}){
  return `<div class="lumen-recipes-list">${Object.entries(HYBRIDS).map(([id,r])=>`<article style="--weapon-color:${WEAPONS[id].color}">${pixelIcon(id)}<div><b>${WEAPONS[id].title}</b><span>${r.requires.map(part=>`${WEAPONS[part].short} ${roman[upgrades[part]||0]||'—'}`).join(' + ')}</span><small>Оба VIII → гибрид I · максимум IV</small></div></article>`).join('')}</div>`;
}
export function createGame(context) {
  const {getSaved,persist,navigate,telegram:tg,toast}=context;
  const $=s=>document.querySelector(s), gameMount=$('#lumenGameMount'),setupMount=$('#lumenSetupMount');
  let state=null,renderer=null,preview=null,previewState=null,raf=0,lastFrame=0,lastSave=0,lastHud=0,paused=false,screen='',character='scout',overlayKey='',resultRecorded=false;
  let art=null,waitingForStart=false,sceneTicket=0,appInactive=false;
  const readyArt=new Set(),story=new StoryOverlay();
  let pointer=null,stickOrigin=null,input={x:0,y:0},keys=new Set(),audio=null,fullscreenOwned=false;
  let terminalFrameStart=0,map='garden',menuPage='home',book='weapons',selectionLoaded=false;
  const handlers=new AbortController(),signal=handlers.signal;
  function record(){const root=getSaved();if(!root.lumen||typeof root.lumen!=='object'||Array.isArray(root.lumen))root.lumen={};const r=root.lumen;r.meta=normalizeMeta(r.meta);r.settings={sound:r.settings?.sound===true,volume:Number.isInteger(r.settings?.volume)&&r.settings.volume>=0&&r.settings.volume<=100?r.settings.volume:70};r.selection={character:Object.hasOwn(CHARACTERS,r.selection?.character)&&r.meta.unlocked.includes(r.selection.character)?r.selection.character:'scout',map:mapAvailable(r.meta,r.selection?.map)?r.selection.map:'garden'};if(!r.stats||typeof r.stats!=='object'||Array.isArray(r.stats))r.stats={};for(const key of ['runs','wins','bestTime','bestKills']){if(!Number.isFinite(r.stats[key])||r.stats[key]<0)r.stats[key]=0;}return r;}
  function save(){if(!state)return;const r=record();bankCoins(r.meta,state);recordProgress(r.meta,state);r.run=['playing','upgrade'].includes(state.status)?serialize(state):null;r.lastTouchedAt=Date.now();persist();lastSave=performance.now();}
  function sound(kind){
    const settings=record().settings;if(!settings.sound||settings.volume===0)return;
    try{
      audio ||= new (window.AudioContext||window.webkitAudioContext)();
      if(audio.state!=='running')return;
      const osc=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime;
      osc.type='sine';osc.frequency.setValueAtTime(kind==='level'?660:kind==='hurt'?130:440,now);
      osc.frequency.exponentialRampToValueAtTime(kind==='level'?990:kind==='hurt'?65:220,now+.12);
      gain.gain.setValueAtTime(.035*settings.volume/100,now);gain.gain.exponentialRampToValueAtTime(.0001,now+.14);
      osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(now+.16);
    }catch(_){record().settings.sound=false;}
  }
  function unlockAudio(){if(!record().settings.sound)return;try{audio ||= new (window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});}catch(_){}}
  function clearInput(){keys.clear();input={x:0,y:0};pointer=null;stickOrigin=null;const stick=$('#lumenStick');if(stick)stick.hidden=true;}
  function viewport(){
    const root=document.documentElement,webview=Boolean(tg?.initData),height=webview&&tg.viewportHeight>0?tg.viewportHeight:window.visualViewport?.height||innerHeight;
    root.style.setProperty('--lumen-height',`${height}px`);
    const safe=tg?.safeAreaInset||{},content=tg?.contentSafeAreaInset||{};
    for(const edge of ['top','bottom','left','right'])root.style.setProperty(`--lumen-safe-${edge}`,`${Math.max(safe[edge]||0,content[edge]||0)}px`);
    renderer?.resize();if(state){updateHud();renderer?.draw(state);}
  }
  function lockScreen(locked){
    document.documentElement.classList.toggle('lumen-active',locked);
    if(locked){viewport();if(tg?.isVersionAtLeast?.('7.7')){try{tg.disableVerticalSwipes();}catch(_){}}}
    else document.documentElement.style.removeProperty('--lumen-height');
  }
  function fullscreen(){
    if(tg?.initData&&tg.isVersionAtLeast?.('8.0')){try{tg.requestFullscreen();return;}catch(_){}}
    if(document.fullscreenElement){document.exitFullscreen?.().catch(()=>{});return;}
    if(document.documentElement.requestFullscreen){document.documentElement.requestFullscreen().then(()=>{fullscreenOwned=true;viewport();}).catch(()=>toast('Браузер не разрешил полный экран. Поле уже занимает доступный экран.'));}
    else toast('Поле занимает доступный экран. Полный экран в этом браузере недоступен.');
  }
  function releaseFullscreen(){if(fullscreenOwned&&document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});fullscreenOwned=false;}
  function stopRenderer(){cancelAnimationFrame(raf);raf=0;renderer?.destroy();renderer=null;clearInput();}
  function focusControl(selector){
    const control=$(selector);if(!control)return;
    const target=control.disabled?control.closest('article'):control;
    if(target){if(target!==control)target.tabIndex=-1;target.focus({preventScroll:true});}
  }
  function prepareArt(onProgress,world=map,selected=character){
    return loadArt({map:world,character:selected,onProgress}).then(loaded=>{art=loaded;readyArt.add(world+':'+selected);return loaded;});
  }
  function storyScope(){
    const r=record();
    if(!r.story||r.story.runId!==state.runId||!Array.isArray(r.story.seen))r.story={runId:state.runId,seen:[]};
    return r.story;
  }
  const sceneSeen=id=>Boolean(state&&storyScope().seen.includes(id));
  function markScene(id){const scope=storyScope();if(!scope.seen.includes(id))scope.seen.push(id);save();persist();}
  function bossDialogue(){
    if(!state||state.status!=='playing'||story.active)return false;
    const enemy=state.enemies.find(enemy=>enemy.hp>0&&['guardian','arena-boss'].includes(enemy.kind)&&!sceneSeen('boss:'+enemy.id));
    if(!enemy)return false;
    const runId=state.runId,scene=bossScene(enemy,state.map);paused=true;clearInput();soundSuspend();save();
    story.play(scene,{hero:CHARACTERS[state.character].name,heroId:state.character}).then(done=>{
      if(screen!=='lumen-game'||state?.runId!==runId)return;
      if(done){markScene(scene.id);if(document.hidden||appInactive||!document.hasFocus()){showPause();return;}paused=false;unlockAudio();runLoop();}
      else showPause();
    });
    return true;
  }
  function cancelLaunch(){sceneTicket++;waitingForStart=false;story.close();if(screen==='lumen')setup(menuPage);}
  function drawPreview(){
    const canvas=$('#lumenPreview');
    if(!canvas||!art||!readyArt.has(map+':'+character)||screen!=='lumen')return;
    preview?.destroy();
    preview=new Renderer(canvas,art);preview.resize();
    const demo=createRun({seed:17,character,map});demo.player.x=0;demo.player.y=110;demo.time=9;
    demo.enemies=[{id:1,x:-180,y:20,kind:map==='castle'?'palace-guard':map==='quarry'?'shardback':'beetle',radius:15,hp:40,maxHp:40},{id:2,x:190,y:100,kind:map==='castle'?'paper-moth':map==='quarry'?'quartzling':'mote',radius:12,hp:20,maxHp:20}];
    demo.gems=[{x:80,y:170,value:2,tier:1},{x:190,y:120,value:12,tier:2}];previewState=demo;preview.draw(demo,true);
  }
  function setup(page='home',preserveScroll=false){
    if(!MENU_PAGES.includes(page))page='home';
    const scroll=$('#lumenMenuContent')?.scrollTop||0,r=record();
    if(!selectionLoaded){character=r.selection.character;map=r.selection.map;selectionLoaded=true;}
    if(map==='crater')map=mapAvailable(r.meta,'castle')?'castle':'quarry';
    if(screen!=='lumen')navigate('lumen');
    screen='lumen';paused=true;menuPage=page;stopRenderer();preview?.destroy();preview=null;
    document.documentElement.classList.add('lumen-menu-active');
    setupMount.innerHTML=renderMenu({page,book,character,map,record:record(),icon:pixelIcon,recipes:recipeBook});
    lockScreen(true);
    drawPreview();
    if(preserveScroll)$('#lumenMenuContent').scrollTop=scroll;
    else $('#lumenMenuHeading')?.focus({preventScroll:true});
  }
  function back(){
    if(story.active){story.cancel();return true;}
    if(screen==='lumen-game'){if(overlayKey==='pause'||['won','lost'].includes(state?.status))setup();else showPause();return true;}
    if(screen!=='lumen')return false;
    if(menuPage!=='home')setup();else navigate('home');return true;
  }
  function mountRun(){
    terminalFrameStart=0;
    preview?.destroy();preview=null;stopRenderer();
    gameMount.innerHTML=`<canvas id="lumenCanvas" tabindex="0" role="img" aria-label="Арена Люмена. Двигайся WASD или стрелками. Оружие атакует само. Escape открывает паузу.">Для этой игры необходим Canvas 2D.</canvas><div class="lumen-hud"><div class="lumen-health"><span class="lumen-hud-kicker">СВЕТОВОЕ ЯДРО</span><div>${pixelIcon('vitality')}<b id="lumenHealth">110 / 110</b></div><div class="lumen-health-track" role="meter" aria-label="Здоровье" aria-valuemin="0" id="lumenHealthMeter"><i></i></div></div><div class="lumen-timer"><strong id="lumenTimer">00:00</strong><span id="lumenGoal"></span></div><div class="lumen-tools"><button type="button" class="lumen-tool" data-lumen-action="sound" aria-label="Включить звук" aria-pressed="false">${pixelIcon('mute')}</button><button type="button" class="lumen-tool" data-lumen-action="fullscreen" aria-label="Полный экран">${pixelIcon('fullscreen')}</button><button type="button" class="lumen-tool" data-lumen-action="pause" aria-label="Пауза">${pixelIcon('pause')}</button></div></div><div class="lumen-xp"><div><span id="lumenLevel">Уровень 1</span><span id="lumenXpLabel">0 / 10</span></div><div class="lumen-xp-track" role="progressbar" aria-label="Опыт забега" aria-valuemin="0" id="lumenXpMeter"><i></i></div></div><div class="lumen-boss-hud" id="lumenBossHud" hidden><div><strong id="lumenBossName"></strong><span id="lumenBossPhase"></span></div><div class="lumen-boss-track" role="meter" id="lumenBossMeter" aria-label="Здоровье босса" aria-valuemin="0"><i></i></div><span id="lumenBossHp"></span></div><div class="lumen-wave" id="lumenWave" aria-live="polite"></div><div class="lumen-bottom"><div class="lumen-equipment"><div class="lumen-artifacts" id="lumenArtifacts" hidden></div><div class="lumen-weapons" id="lumenWeapons"></div></div><div class="lumen-tally"><strong id="lumenKills">0</strong><span>побеждено</span><div class="lumen-run-coins">${pixelIcon('coin')}<b id="lumenCoins">0</b></div></div></div><div class="lumen-loot" id="lumenLoot" hidden></div><p class="lumen-hint" id="lumenMoveHint">Проведи по полю, чтобы двигаться<span>или используй WASD / стрелки</span></p><div class="lumen-stick" id="lumenStick" hidden aria-hidden="true"><i></i></div><div class="lumen-overlay" id="lumenOverlay" hidden></div><p class="sr-only" id="lumenAnnouncement" role="status" aria-live="polite"></p>`;
    gameMount.dataset.map=state.map;
    if(state.map==='castle')$('#lumenCanvas').setAttribute('aria-label','Замок угасшего света. Двигайся WASD или стрелками. На 45-м уровне стрелка укажет путь к финальному залу. Escape открывает паузу.');
    renderer=new Renderer($('#lumenCanvas'),art);lockScreen(true);renderer.resize();
    $('#lumenCanvas').addEventListener('pointerdown',pointerDown,{signal});
    $('#lumenCanvas').addEventListener('pointermove',pointerMove,{signal});
    $('#lumenCanvas').addEventListener('pointerup',pointerEnd,{signal});
    $('#lumenCanvas').addEventListener('pointercancel',pointerEnd,{signal});
    $('#lumenCanvas').addEventListener('lostpointercapture',pointerEnd,{signal});
    updateHud();renderer.draw(state);$('#lumenCanvas').focus({preventScroll:true});
  }
  async function launchRun(resumeSaved=false){
    if(waitingForStart)return;
    let restored=resumeSaved?restore(record().run):null;
    if(resumeSaved&&!restored){record().run=null;persist();setup();toast('Сохранение повреждено или устарело. Можно начать новую экспедицию.');return;}
    if(!resumeSaved&&(!record().meta.unlocked.includes(character)||!mapAvailable(record().meta,map)))return;
    if(!resumeSaved&&record().run&&!window.confirm('Начать заново? Текущая экспедиция будет заменена.'))return;
    if(screen!=='lumen')setup();
    const world=restored?.map||map,selected=restored?.character||character,ticket=++sceneTicket;
    waitingForStart=true;clearInput();preview?.destroy();preview=null;
    const load=()=>prepareArt(value=>{if(ticket===sceneTicket)story.progress(value);},world,selected).then(value=>({value}),error=>({error}));
    const ready=load();
    const proceed=await story.play(worldScene(world),{hero:CHARACTERS[selected].name,heroId:selected,hold:true,onCancel:cancelLaunch});
    if(!proceed){if(ticket===sceneTicket)cancelLaunch();return;}
    const finish=async result=>{
      if(ticket!==sceneTicket||screen!=='lumen')return;
      if(result.error){story.failure(()=>{story.retrying();load().then(finish);});return;}
      story.close();waitingForStart=false;
      state=restored||createRun({training:record().meta.training,seed:crypto.getRandomValues(new Uint32Array(1))[0],character:selected,map:world,runId:crypto.randomUUID()});
      character=state.character;map=state.map;selectionLoaded=true;resultRecorded=false;paused=resumeSaved||document.hidden||appInactive||!document.hasFocus();overlayKey='';
      if(!restored)state.player.y=85;
      storyScope();navigate('lumen-game');screen='lumen-game';mountRun();save();unlockAudio();
      if(tg?.initData&&tg.isVersionAtLeast?.('8.0')){try{tg.requestFullscreen();}catch(_){}}
      if(state.status==='upgrade'){paused=false;showUpgrade();}else if(paused)showPause('Экспедиция ждёт');
      lastFrame=performance.now();raf=requestAnimationFrame(frame);
    };
    await finish(await ready);
  }
  function start(){launchRun();}
  function resume(){launchRun(true);}
  function updateHud(){
    if(!state||!$('#lumenHealth'))return;
    const p=state.player;
    $('#lumenHealth').textContent=`${Math.ceil(Math.max(0,p.hp))} / ${p.maxHp}`;
    const hp=$('#lumenHealthMeter');hp.setAttribute('aria-valuemax',p.maxHp);hp.setAttribute('aria-valuenow',Math.ceil(Math.max(0,p.hp)));hp.firstElementChild.style.width=`${Math.max(0,p.hp/p.maxHp)*100}%`;
    const capped=state.level>=MAPS[state.map].goal,guidance=Boolean(castleGuidance(state));
    $('#lumenTimer').textContent=clock(state.time);$('#lumenGoal').textContent=MAPS[state.map].name;$('#lumenLevel').textContent=`Уровень ${state.level} / ${MAPS[state.map].goal}`;$('#lumenXpLabel').textContent=capped?'МАКСИМАЛЬНЫЙ УРОВЕНЬ':`${state.xp} / ${state.xpNext}`;
    const xp=$('#lumenXpMeter');xp.setAttribute('aria-valuemax',state.xpNext);xp.setAttribute('aria-valuenow',capped?state.xpNext:state.xp);xp.firstElementChild.style.width=`${capped?100:Math.min(100,state.xp/state.xpNext*100)}%`;
    if(guidance&&gameMount.dataset.guidance!=='true')$('#lumenAnnouncement').textContent='Достигнут 45-й уровень. Следуй за золотой стрелкой к залу Полого монарха.';
    gameMount.dataset.guidance=String(guidance);
    $('#lumenKills').textContent=state.kills;
    const weapons=WEAPON_IDS.filter(id=>state.upgrades[id]),dock=$('#lumenWeapons'),dockKey=weapons.map(id=>`${id}:${state.upgrades[id]}`).join(':');
    if(dock.dataset.key!==dockKey){dock.dataset.key=dockKey;dock.innerHTML=`<span class="lumen-kit-count" aria-label="Оружие ${weapons.length} из ${MAX_WEAPONS}">${weapons.length}/${MAX_WEAPONS}</span>`+weapons.map(id=>`<span class="lumen-slot ${WEAPONS[id].className}" data-rarity="${WEAPONS[id].rarity}" style="--weapon-color:${weaponRarity(id).color}" title="${weaponRarity(id).title} · ${WEAPONS[id].title}: ${WEAPONS[id].verb}">${pixelIcon(id)}<small>${state.upgrades[id]}</small><span class="lumen-slot-caption">${WEAPONS[id].short}</span><span class="sr-only">${weaponRarity(id).title} · ${WEAPONS[id].title}: стадия ${state.upgrades[id]}</span></span>`).join('');}
    const relicDock=$('#lumenArtifacts'),relics=Object.keys(ARTIFACTS).filter(id=>state.upgrades[id]),shield=state.upgrades.laurel?`Лавр: ${state.relicState.shield}/${state.upgrades.laurel}${state.relicState.recharge?` · ${Math.ceil(state.relicState.recharge)}с`:''}`:'',relicKey=relics.map(id=>id+state.upgrades[id]).join(':')+shield;
    relicDock.hidden=false;
    if(relicDock.dataset.key!==relicKey){relicDock.dataset.key=relicKey;relicDock.innerHTML=`<span class="lumen-relic-label" aria-label="Артефакты ${relics.length} из ${MAX_ARTIFACTS}">${relics.length}/${MAX_ARTIFACTS}</span>${relics.map(id=>`<span class="lumen-relic-slot" role="img" aria-label="${ARTIFACTS[id].title}, ранг ${state.upgrades[id]}. ${ARTIFACTS[id].description}" title="${ARTIFACTS[id].title} · ${state.upgrades[id]}/3" style="--weapon-color:${ARTIFACTS[id].color}">${pixelIcon(id)}<small>${roman[state.upgrades[id]]}</small></span>`).join('')}${shield?`<span class="lumen-shield-count">${shield}</span>`:''}`;}
    $('#lumenCoins').textContent=state.coinsEarned;
    const loot=state.lootLog.at(-1),notice=$('#lumenLoot');notice.hidden=!loot||state.time-loot.time>3;
    if(loot&&notice.dataset.id!==String(loot.id)){notice.dataset.id=loot.id;notice.innerHTML=`${pixelIcon(loot.weapon||'coin')}<span>${state.arena?.rewardId===loot.id?'Сокровищница · ':''}+${loot.coins} монет${loot.weapon?` · ${WEAPONS[loot.weapon].short} ${roman[loot.stage]}`:''}</span>`;$('#lumenAnnouncement').textContent=notice.textContent;}
    const wave=state.enemies.find(e=>e.kind==='arena-boss')||state.enemies.find(e=>e.kind==='guardian');
    const arena=state.arena,bossName=wave?(BOSS_VARIANTS[wave.bossType]?.name||BOSSES[wave.guardianStage].name):'';
    gameMount.dataset.arena=arena?.phase||'';gameMount.dataset.boss=String(Boolean(wave));
    const bossHud=$('#lumenBossHud');bossHud.hidden=!wave;
    if(wave){
      $('#lumenBossName').textContent=bossName;
      $('#lumenBossPhase').textContent=arena?.phase==='forming'?state.map==='castle'?'ВОРОТА ЗАКРЫВАЮТСЯ':'КОЛЬЦО ЗАМЫКАЕТСЯ':wave.hp<wave.maxHp*.5?'ЯРОСТЬ':'СЛЕДИ ЗА УДАРАМИ';
      const meter=$('#lumenBossMeter');meter.setAttribute('aria-valuemax',wave.maxHp);meter.setAttribute('aria-valuenow',Math.ceil(wave.hp));meter.firstElementChild.style.width=`${wave.hp/wave.maxHp*100}%`;
      $('#lumenBossHp').textContent=`${Math.ceil(wave.hp)} / ${wave.maxHp}`;
    }
    const phase=waveAt(state.time);
    const trapped=touchingEnemies(state).length>=3;
    const arenaText=arena?(arena.phase==='forming'?'ПРИГОТОВЬСЯ К ФИНАЛЬНОМУ БОЮ':arena.phase==='fighting'?'СЛЕДИ ЗА ПРЕДУПРЕЖДЕНИЯМИ И ПРОСВЕТАМИ':arena.phase==='reward'?'СТРАЖ ПОВЕРЖЕН · ОТКРОЙ СОКРОВИЩНИЦУ':arena.phase==='celebrating'?`+${WORLD_FINALS[state.map].reward} МОНЕТ · ПУТЬ ОТКРЫТ`:''):(guidance?'УРОВЕНЬ 45 · СЛЕДУЙ ЗА ЗОЛОТОЙ СТРЕЛКОЙ':'');
    const text=arenaText||(trapped?'ТЕБЯ ЗАЖАЛИ · ПРОБЕЙ ПРОХОД':wave?bossName.toUpperCase():state.chests.length?'СУНДУК НА ПОЛЕ · ПОДОЙДИ И ОТКРОЙ':state.time<8?'СОБИРАЙ ОСКОЛКИ СВЕТА':phase.kind==='harvest'?'СЛАБЫЙ РОЙ · СОБИРАЙ ОПЫТ':phase.kind==='pressure'&&phase.age<5?`НОВАЯ ВОЛНА · ЭТАП ${phase.stage}`:'');
    $('#lumenWave').dataset.phase=arena?'arena':trapped?'contact':wave?'guardian':phase.kind;
    if($('#lumenWave').textContent!==text)$('#lumenWave').textContent=text;
    $('#lumenMoveHint').hidden=Boolean(arena)||state.time>12||pointer!==null||keys.size>0;
    const sb=$('[data-lumen-action="sound"]',gameMount);if(sb){sb.setAttribute('aria-pressed',String(record().settings.sound));sb.setAttribute('aria-label',record().settings.sound?'Выключить звук':'Включить звук');sb.innerHTML=pixelIcon(record().settings.sound?'sound':'mute');}
    if(state.arena&&state.map!=='castle'&&renderer){
      const top=Math.max($('#lumenBossHud').getBoundingClientRect().bottom,$('#lumenWave').getBoundingClientRect().bottom);
      renderer.arenaInsets={top:top-gameMount.getBoundingClientRect().top+18,bottom:$('.lumen-bottom').getBoundingClientRect().top-gameMount.getBoundingClientRect().top-24};
    }
    if(state.map==='castle'&&renderer){
      const mountTop=gameMount.getBoundingClientRect().top,hud=$('.lumen-hud'),boss=$('#lumenBossHud'),wave=$('#lumenWave');
      const hudBottom=hud.getBoundingClientRect().bottom-mountTop;
      gameMount.style.setProperty('--lumen-boss-top',`${Math.ceil(hudBottom+10)}px`);
      gameMount.style.setProperty('--lumen-xp-top',`${Math.ceil(hudBottom+10)}px`);
      const bossBottom=boss.hidden?hudBottom:boss.getBoundingClientRect().bottom-mountTop;
      const xpBottom=$('.lumen-xp').getBoundingClientRect().bottom-mountTop;
      gameMount.style.setProperty('--lumen-wave-top',`${Math.ceil(Math.max(bossBottom,boss.hidden?xpBottom:0)+12)}px`);
      const waveBottom=wave.getBoundingClientRect().bottom-mountTop;
      renderer.castleInsets={top:Math.ceil(Math.max(bossBottom,waveBottom)+20),bottom:Math.floor($('.lumen-bottom').getBoundingClientRect().top-mountTop-22)};
    }
  }
  function frame(now){
    if(screen!=='lumen-game'||!renderer)return;
    const dt=Math.min(.1,Math.max(0,(now-lastFrame)/1000));lastFrame=now;
    if(!paused&&state.status==='playing'&&!bossDialogue()){
      const x=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),y=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0);
      const hp=state.player.hp,kills=state.kills,coins=state.coinsEarned;
      const direction=pointer===null?{x,y}:input;state.moving=Math.hypot(direction.x,direction.y)>.01;step(state,direction,dt,renderer.captureTick);
      if(state.player.hp<hp)sound('hurt');else if(state.kills>kills)sound('kill');
      if(state.coinsEarned>coins){save();sound('level');updateHud();}
      if(state.status==='upgrade'){sound('level');save();showUpgrade();}
      if(['won','lost'].includes(state.status)){updateHud();showResult();}
      else if(state.status==='playing')bossDialogue();
      if(now-lastSave>5000)save();
    }
    // Finish only the presentation of death. No step(), reward or save mutation.
    if(state.status==='lost'&&!terminalFrameStart)terminalFrameStart=now;
    renderer.draw(state,false,terminalFrameStart?Math.min(.6,(now-terminalFrameStart)/1000):undefined);
    if(now-lastHud>150){updateHud();lastHud=now;}
    if((!paused&&state.status==='playing')||(state.status==='lost'&&now-terminalFrameStart<600))raf=requestAnimationFrame(frame);else raf=0;
  }
  function runLoop(){if(!raf&&screen==='lumen-game'){lastFrame=performance.now();raf=requestAnimationFrame(frame);}}
  function showOverlay(key,html){
    if(overlayKey===key)return;clearInput();overlayKey=key;
    const overlay=$('#lumenOverlay'),upgrade=key.startsWith('upgrade-');overlay.hidden=false;overlay.classList.toggle('lumen-upgrade-overlay',upgrade);overlay.innerHTML=`<div class="lumen-dialog ${upgrade?'lumen-upgrade-dialog':''}" role="dialog" aria-modal="true" aria-labelledby="lumenDialogTitle" data-lumen-scroll tabindex="-1">${html}</div>`;
    gameMount.querySelectorAll('.lumen-hud,.lumen-xp,.lumen-boss-hud,.lumen-bottom,#lumenCanvas').forEach(el=>el.inert=true);
    overlay.querySelector('button')?.focus({preventScroll:true});
  }
  function hideOverlay(){const overlay=$('#lumenOverlay');if(overlay){overlay.hidden=true;overlay.innerHTML='';}overlayKey='';gameMount.querySelectorAll('[inert]').forEach(el=>el.inert=false);$('#lumenCanvas')?.focus({preventScroll:true});}
  function showPause(title='Маяк подождёт'){
    if(story.active||!state||['won','lost'].includes(state.status))return;
    paused=true;save();if(state.status==='upgrade'){showUpgrade();return;}
    showOverlay('pause',`<span class="lumen-dialog-kicker">ПАУЗА / ${clock(state.time)}</span><h2 id="lumenDialogTitle">${title}</h2><p>Экспедиция сохранена на этом устройстве. Когда будешь готов — продолжай.</p><button class="lumen-launch" data-lumen-action="continue" type="button">Продолжить экспедицию <span>→</span></button><button class="lumen-menu-button" data-lumen-action="exit" type="button">Сохранить и выйти в меню</button><button class="lumen-menu-button" data-lumen-action="sound" type="button" aria-pressed="${record().settings.sound}">Звук: ${record().settings.sound?'включён':'выключен'}</button>${Object.keys(state.archivedWeapons).length?`<p class="lumen-migration-note">Лимит обновлён: 4 оружия. В архив сохранения перенесены ${Object.keys(state.archivedWeapons).map(id=>WEAPONS[id].title+' '+roman[state.archivedWeapons[id]]).join(', ')}. Их стадии сохранены для оружейных испытаний.</p>`:''}<div class="lumen-pause-help">Двигайся джойстиком или WASD / стрелками.<br>Оружие атакует само. Собирай свет для улучшений.</div><details class="lumen-recipes"><summary>Рецепты слияний · VIII + VIII</summary>${recipeBook(state.upgrades)}</details>${Object.keys(ARTIFACTS).some(id=>state.upgrades[id])?`<div class="lumen-pause-artifacts">${Object.entries(ARTIFACTS).filter(([id])=>state.upgrades[id]).map(([id,a])=>`<p>${pixelIcon(id)}<span>${a.title} ${roman[state.upgrades[id]]}<small>${a.description}</small></span></p>`).join('')}</div>`:''}`);
    soundSuspend();
  }
  function showUpgrade(){
    showOverlay(`upgrade-${state.level}`,`<div class="lumen-upgrade-heading"><h2 id="lumenDialogTitle">Усиль свой свет</h2><span class="lumen-dialog-kicker">УРОВЕНЬ ${state.level} · ВЫБЕРИ ОДНО</span></div><div class="lumen-upgrades">${state.choices.map(id=>{
      const u=UPGRADES.find(u=>u.id===id),rank=state.upgrades[id]||0,fusion=HYBRIDS[id]&&!rank;
      const theme=WEAPONS[id]?.className||(u.kind==='recovery'?'rose':'neutral'),color=WEAPONS[id]?weaponRarity(id).color:ARTIFACTS[id]?.color||'#a4b9c9';
      const label=fusion?'Соединить VIII + VIII → I':rank?`${WEAPONS[id]?'Стадия':'Ранг'} ${roman[rank]||rank} → ${roman[rank+1]||rank+1}`:u.kind==='weapon'?'Новое оружие':u.kind==='artifact'?'Новый артефакт · I / III':'Новое улучшение';
      return `<button class="${theme}${fusion?' lumen-fusion-choice':''}" ${WEAPONS[id]?`data-rarity="${WEAPONS[id].rarity}"`:''} style="--weapon-color:${color}" type="button" data-lumen-action="upgrade" data-lumen-value="${id}" title="${u.description}${fusion?' · '+HYBRIDS[id].hint:''}"><span class="lumen-upgrade-icon" aria-hidden="true">${pixelIcon(id)}</span><span><small>${WEAPONS[id]?weaponRarity(id).title+' · ':''}${label}</small><strong>${u.title}</strong><span>${upgradeSummary(id,rank)}</span>${fusion?`<span class="lumen-recipe-hint">${HYBRIDS[id].requires.map(part=>WEAPONS[part].short+' VIII').join(' + ')} · освободит слот</span>`:''}<span class="sr-only">${u.description}</span></span></button>`;
    }).join('')}</div><p class="lumen-loadout-summary">Оружие ${WEAPON_IDS.filter(id=>state.upgrades[id]).length}/${MAX_WEAPONS} · Артефакты ${Object.keys(ARTIFACTS).filter(id=>state.upgrades[id]).length}/${MAX_ARTIFACTS}${WEAPON_IDS.filter(id=>state.upgrades[id]).length===MAX_WEAPONS?' · Оружейные слоты заполнены':''}</p><button class="lumen-upgrade-exit" data-lumen-action="exit" type="button">Сохранить и выйти в меню</button>`);
  }
  function showResult(){
    if(!resultRecorded){const r=record();r.stats.runs++;if(state.status==='won')r.stats.wins++;r.stats.bestTime=Math.max(r.stats.bestTime,state.time);r.stats.bestKills=Math.max(r.stats.bestKills,state.kills);resultRecorded=true;save();}
    const ending='after:'+state.map;
    if(state.status==='won'&&!sceneSeen(ending)){
      const runId=state.runId;paused=true;clearInput();soundSuspend();
      story.play(worldScene(state.map,'after'),{hero:CHARACTERS[state.character].name,heroId:state.character}).then(()=>{
        if(screen!=='lumen-game'||state?.runId!==runId)return;markScene(ending);showResult();
      });return;
    }
    const won=state.status==='won',biome=MAPS[state.map],next=won&&biome.next;
    showOverlay('result',`<span class="lumen-dialog-kicker">${won?'ЭКСПЕДИЦИЯ ЗАВЕРШЕНА':'СВЕТ НЕ ПОГАС НАВСЕГДА'}</span><div class="lumen-result-mark" aria-hidden="true">${pixelIcon(won?'stars':'light')}</div><h2 id="lumenDialogTitle">${won?`${biome.name} пройден`:'Новая ночь. Новый шанс.'}</h2><p>${won?next?`Уровень ${biome.goal} достигнут. Открыта следующая карта: ${MAPS[next].name}.`:state.endReason==='boss'?(state.map==='castle'?'Полый монарх повержен. Сокровищница замка открыта. Все три мира пройдены — попробуй другое сочетание оружия.':'Матриарх повержен, кольцо разрушено. Сокровищница открыта. Все три мира пройдены — попробуй другое сочетание оружия.'):`Уровень ${biome.goal} достигнут — можно вернуться с другим героем.`:'Сохрани монеты и попробуй новое сочетание оружия. Результат оружейного испытания тоже остаётся.'}</p><div class="lumen-result-stats"><span><b>${clock(state.time)}</b>время</span><span><b>${state.kills}</b>побеждено</span><span><b>${state.level}</b>уровень</span></div><p class="lumen-earned">${pixelIcon('coin')} +${state.coinsEarned} монет за забег <small>В кошельке: ${record().meta.coins}</small></p>${next?`<button class="lumen-launch" data-lumen-action="next" data-lumen-value="${next}" type="button">Следующая карта · ${MAPS[next].name} <span>→</span></button><button class="lumen-menu-button" data-lumen-action="start" type="button">Повторить эту карту</button>`:'<button class="lumen-launch" data-lumen-action="start" type="button">Новая экспедиция <span>→</span></button>'}<button class="lumen-menu-button" data-lumen-action="exit" type="button">Главное меню</button><small class="lumen-result-note">Прогресс сохранён на устройстве. XP кампаний не начисляется.</small>`);
  }
  function pointerDown(e){
    if(paused||state?.status!=='playing'||pointer!==null||e.button>0)return;
    e.preventDefault();pointer=e.pointerId;stickOrigin={x:e.clientX,y:e.clientY};e.target.setPointerCapture(e.pointerId);
    const stick=$('#lumenStick'),box=gameMount.getBoundingClientRect();stick.hidden=false;stick.style.left=`${e.clientX-box.left}px`;stick.style.top=`${e.clientY-box.top}px`;pointerMove(e);unlockAudio();
  }
  function pointerMove(e){
    if(pointer!==e.pointerId||!stickOrigin)return;e.preventDefault();
    const dx=e.clientX-stickOrigin.x,dy=e.clientY-stickOrigin.y,length=Math.hypot(dx,dy),radius=42;
    const strength=length<6?0:Math.min(1,length/radius);input={x:length?dx/length*strength:0,y:length?dy/length*strength:0};
    $('#lumenStick i').style.transform=`translate(${input.x*radius}px,${input.y*radius}px)`;
  }
  function pointerEnd(e){if(pointer===e.pointerId)clearInput();}
  function soundSuspend(){if(audio?.state==='running')audio.suspend().catch(()=>{});}
  function action(name,value){
    if(story.active)return;
    if(name==='setup'){setup();return;}
    if(name==='catalog'){navigate('home');return;}
    if(name==='menu'&&MENU_PAGES.includes(value)){setup(value);return;}
    if(name==='book'&&['weapons','hybrids','artifacts'].includes(value)){book=value;setup('weapons');focusControl(`[data-lumen-action="book"][data-lumen-value="${value}"]`);return;}
    if(name==='character'&&Object.hasOwn(CHARACTERS,value)){
      character=value;const r=record();if(r.meta.unlocked.includes(value)){r.selection.character=value;persist();}
      setup('characters',true);focusControl(`[data-lumen-action="character"][data-lumen-value="${value}"]`);return;
    }
    if(name==='map'&&mapAvailable(record().meta,value)){map=value;record().selection.map=value;persist();setup('play',true);focusControl(`[data-lumen-action="map"][data-lumen-value="${map}"]`);return;}
    if(name==='next'&&state?.status==='won'&&value===MAPS[state.map].next&&mapAvailable(record().meta,value)){map=value;record().selection.map=value;start();return;}
    if(name==='buy'){const r=record();if(buyCharacter(r.meta,value)){r.selection.character=value;persist();setup('characters',true);$('#lumenMenuHeading')?.focus({preventScroll:true});toast(`${CHARACTERS[value].name} готов к экспедиции`);}return;}
    if(name==='train'){const r=record();if(buyTraining(r.meta,value)){persist();setup('training',true);focusControl(`[data-lumen-action="train"][data-lumen-value="${value}"]`);toast('Ранг изучен. Подействует в новой экспедиции.');}return;}
    if(name==='start'){start();return;}
    if(name==='resume'){resume();return;}
    if(name==='pause'){showPause();return;}
    if(name==='continue'){hideOverlay();if(!bossDialogue()){paused=false;unlockAudio();runLoop();}return;}
    if(name==='fullscreen'){fullscreen();return;}
    if(name==='sound'){const r=record();r.settings.sound=!r.settings.sound;if(r.settings.sound)unlockAudio();else soundSuspend();persist();if(screen==='lumen'){setup('settings',true);focusControl('[data-lumen-action="sound"]');return;}updateHud();const button=$('#lumenOverlay [data-lumen-action="sound"]');if(button){button.textContent=`Звук: ${r.settings.sound?'включён':'выключен'}`;button.setAttribute('aria-pressed',String(r.settings.sound));}return;}
    if(name==='upgrade'&&state?.status==='upgrade'&&chooseUpgrade(state,value)){hideOverlay();paused=false;save();updateHud();if(state.status==='upgrade')showUpgrade();else if(state.status==='won')showResult();else{unlockAudio();runLoop();}return;}
    if(name==='exit'){save();setup();}
  }
  function onScreen(name){
    if(!['lumen','lumen-game'].includes(name)&&story.active){sceneTicket++;waitingForStart=false;story.close();}
    document.documentElement.classList.toggle('lumen-menu-active',name==='lumen');
    if(screen==='lumen-game'&&name!=='lumen-game'){paused=true;save();stopRenderer();soundSuspend();}
    if(screen==='lumen'&&name!=='lumen'){preview?.destroy();preview=null;}
    if(!['lumen','lumen-game'].includes(name)){lockScreen(false);releaseFullscreen();soundSuspend();}
    screen=name;
  }
  function preventScroll(e){if(['lumen','lumen-game'].includes(screen)&&!e.target.closest('[data-lumen-scroll]'))e.preventDefault();}
  document.addEventListener('wheel',preventScroll,{passive:false,signal});
  document.addEventListener('touchmove',preventScroll,{passive:false,signal});
  document.addEventListener('keydown',e=>{
    if(screen==='lumen'&&e.code==='Escape'){e.preventDefault();if(!e.repeat)back();return;}
    if(screen!=='lumen-game')return;
    if(e.code==='Tab'&&overlayKey){const buttons=[...$('#lumenOverlay').querySelectorAll('button,summary')],first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}return;}
    if(['Escape','KeyP'].includes(e.code)){e.preventDefault();if(e.repeat)return;if(overlayKey==='pause')action('continue');else if(!overlayKey)showPause();return;}
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'].includes(e.code)){e.preventDefault();if(!paused&&!overlayKey)keys.add(e.code);}
  },{signal});
  document.addEventListener('input',e=>{
    if(screen!=='lumen'||e.target.id!=='lumenVolume')return;
    const volume=Number(e.target.value);if(!Number.isInteger(volume)||volume<0||volume>100)return;
    record().settings.volume=volume;persist();$('#lumenVolumeValue').textContent=volume+'%';e.target.setAttribute('aria-valuetext',volume+'%');
  },{signal});
  document.addEventListener('keyup',e=>keys.delete(e.code),{signal});
  function deactivate(){appInactive=true;if(screen==='lumen-game'&&state?.status==='playing'&&!story.active)showPause('Экспедиция на паузе');clearInput();}
  window.addEventListener('blur',deactivate,{signal});
  window.addEventListener('focus',()=>{appInactive=false;},{signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)deactivate();},{signal});
  window.addEventListener('pagehide',()=>{if(screen==='lumen-game'&&state){paused=true;save();soundSuspend();}},{signal});
  window.addEventListener('resize',()=>{viewport();if(preview&&screen==='lumen'){preview.resize();preview.draw(previewState,true);}},{signal});
  window.visualViewport?.addEventListener('resize',viewport,{signal});
  document.addEventListener('fullscreenchange',()=>{viewport();if(screen==='lumen-game'&&!document.fullscreenElement&&fullscreenOwned){fullscreenOwned=false;deactivate();}},{signal});
  try{tg?.onEvent?.('activated',()=>{appInactive=false;});tg?.onEvent?.('deactivated',deactivate);tg?.onEvent?.('viewportChanged',viewport);tg?.onEvent?.('safeAreaChanged',viewport);tg?.onEvent?.('contentSafeAreaChanged',viewport);tg?.onEvent?.('fullscreenFailed',()=>{if(screen==='lumen-game')toast('Telegram не разрешил полный экран. Игра занимает доступную область.');});}catch(_){}
  return {setup,resume,action,onScreen,back};
}

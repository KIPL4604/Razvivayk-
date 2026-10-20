import {createRun,step,chooseUpgrade,serialize,restore,UPGRADES} from './engine.mjs';
import {Renderer} from './renderer.mjs';
import {loadArt} from './assets.mjs';
import {WEAPONS,upgradeSummary} from './presentation.mjs';
import {waveAt} from './progression.mjs';
import {touchingEnemies} from './physics.mjs';
import {CHARACTERS,WEAPON_IDS,BASE_WEAPON_IDS,HYBRIDS,ARTIFACTS,BOSSES,MAPS,MAX_WEAPON_STAGE} from './catalog.mjs';
import {normalizeMeta,buyCharacter,bankCoins,recordProgress,mapAvailable,characterRequirement} from './economy.mjs';

const art = await loadArt();

const clock = n => `${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}`;
const roman=['','I','II','III','IV','V','VI','VII','VIII'];
const iconIndex={spark:0,orbit:1,pulse:2,focus:3,haste:4,stride:5,magnet:6,vitality:7,repair:8,pause:9,fullscreen:10,sound:11,mute:12,gem:13,light:14,stars:15};
const itemIcon=index=>`<span class="lumen-new-icon" style="--item-x:${index%5};--item-y:${Math.floor(index/5)}" aria-hidden="true"></span>`;
const pixelIcon = name => ARTIFACTS[name]?itemIcon(6+ARTIFACTS[name].index):WEAPONS[name]?.index>=8?itemIcon(WEAPONS[name].index-8):WEAPONS[name]
  ? `<span class="lumen-weapon-icon ${WEAPONS[name].className}" style="--weapon:${WEAPONS[name].index}" aria-hidden="true"></span>`
  : name==='coin'?'<span class="lumen-coin-icon" aria-hidden="true"></span>'
  : `<span class="lumen-pixel-icon" style="--icon:${iconIndex[name] ?? 0}" aria-hidden="true"></span>`;

function recipeBook(upgrades={}){
  return `<div class="lumen-recipes-list">${Object.entries(HYBRIDS).map(([id,r])=>`<article style="--weapon-color:${WEAPONS[id].color}">${pixelIcon(id)}<div><b>${WEAPONS[id].title}</b><span>${r.requires.map(part=>`${WEAPONS[part].short} ${roman[upgrades[part]||0]||'—'}`).join(' + ')}</span><small>Оба VIII → гибрид I · максимум IV</small></div></article>`).join('')}</div>`;
}
function armoryDetails(){
  return `<details class="lumen-armory"><summary>Арсенал маяка <span>${BASE_WEAPON_IDS.length} базовых + 4 гибрида · до 6 в забеге</span></summary><div>${BASE_WEAPON_IDS.map(id=>`<article style="--weapon-color:${WEAPONS[id].color}">${pixelIcon(id)}<div><h3>${WEAPONS[id].title}</h3><p>${WEAPONS[id].verb}</p><small>I–VIII · число атак растёт на III, V и VII</small></div></article>`).join('')}</div><h3 class="lumen-book-heading">Соедини два оружия VIII</h3><p class="lumen-book-note">На следующем уровне выбери слияние. Два оружия заменит один гибрид I; дальше улучшай его до IV.</p>${recipeBook()}<h3 class="lumen-book-heading">Артефакты · не занимают слот оружия</h3><div>${Object.entries(ARTIFACTS).map(([id,a])=>`<article style="--weapon-color:${a.color}">${pixelIcon(id)}<div><h3>${a.title}</h3><p>${a.description}</p><small>Три ранга · действуют весь забег</small></div></article>`).join('')}</div></details>`;
}

export function createGame(context) {
  const {getSaved,persist,navigate,telegram:tg,toast}=context;
  const $=s=>document.querySelector(s), gameMount=$('#lumenGameMount'),setupMount=$('#lumenSetupMount');
  let state=null,renderer=null,preview=null,previewState=null,raf=0,lastFrame=0,lastSave=0,lastHud=0,paused=false,screen='',character='scout',overlayKey='',resultRecorded=false;
  let pointer=null,stickOrigin=null,input={x:0,y:0},keys=new Set(),audio=null,fullscreenOwned=false;
  let terminalFrameStart=0,map='garden';
  const handlers=new AbortController(),signal=handlers.signal;
  function record(){const root=getSaved();if(!root.lumen||typeof root.lumen!=='object'||Array.isArray(root.lumen))root.lumen={};const r=root.lumen;r.meta=normalizeMeta(r.meta);r.settings={sound:r.settings?.sound===true};if(!r.stats||typeof r.stats!=='object'||Array.isArray(r.stats))r.stats={};for(const key of ['runs','wins','bestTime','bestKills']){if(!Number.isFinite(r.stats[key])||r.stats[key]<0)r.stats[key]=0;}return r;}
  function save(){if(!state)return;const r=record();bankCoins(r.meta,state);recordProgress(r.meta,state);r.run=['playing','upgrade'].includes(state.status)?serialize(state):null;r.lastTouchedAt=Date.now();persist();lastSave=performance.now();}
  function sound(kind){
    if(!record().settings.sound)return;
    try{
      audio ||= new (window.AudioContext||window.webkitAudioContext)();
      if(audio.state!=='running')return;
      const osc=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime;
      osc.type='sine';osc.frequency.setValueAtTime(kind==='level'?660:kind==='hurt'?130:440,now);
      osc.frequency.exponentialRampToValueAtTime(kind==='level'?990:kind==='hurt'?65:220,now+.12);
      gain.gain.setValueAtTime(.035,now);gain.gain.exponentialRampToValueAtTime(.0001,now+.14);
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
    renderer?.resize();if(state)renderer?.draw(state);
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
  function setup(preserveScroll=false){
    const main=$('#main'),scroll=main?.scrollTop||0,rosterScroll=$('.lumen-roster')?.scrollLeft||0;
    navigate('lumen');screen='lumen';stopRenderer();preview?.destroy();preview=null;
    const r=record(),canResume=Boolean(r.run&&['playing','upgrade'].includes(r.run.status));
    const hero=CHARACTERS[character],owned=r.meta.unlocked.includes(character),missing=Math.max(0,hero.price-r.meta.coins),requirement=characterRequirement(r.meta,character),biome=MAPS[map];
    setupMount.innerHTML=`<div class="lumen-intro"><div class="lumen-cover"><canvas id="lumenPreview" aria-hidden="true"></canvas><div class="lumen-cover-copy"><span class="lumen-tag">Твоя экспедиция начинается здесь</span><h1 id="lumenTitle">ЛЮМЕН<span>Последний маяк</span></h1><p>Ночь наступает.<br>Сохрани свой свет.</p><span class="lumen-cover-coordinate">${biome.sector}</span></div></div><div class="lumen-brief"><span class="eyebrow">Двигайся. Собирай. Усиливайся.</span><h2>Достигни <br>уровня ${biome.goal}.</h2><p class="lumen-description">Пробивайся сквозь рой, собирай осколки света и создавай своё сочетание оружия. Усиливай героя, чтобы пройти эту карту.</p><fieldset class="lumen-maps"><legend>Экспедиция</legend>${Object.entries(MAPS).map(([id,m],index)=>`<button type="button" data-lumen-action="map" data-lumen-value="${id}" aria-pressed="${map===id}" ${mapAvailable(r.meta,id)?'':'disabled'} style="--map-accent:${m.accent}"><small>0${index+1} / УРОВЕНЬ ${m.goal}</small><b>${m.name}</b><span>${mapAvailable(r.meta,id)?r.meta.clearedMaps.includes(id)?'Пройдена · можно повторить':'Доступна':'Пройди Биосад'}</span></button>`).join('')}</fieldset><div class="lumen-facts"><span><b>08</b>бойцов</span><span><b>14</b>видов оружия</span><span><b>04</b>артефакта</span></div><div class="lumen-roster-heading"><b>Кто отправится в экспедицию?</b><span class="lumen-wallet" aria-label="Монет в кошельке: ${r.meta.coins}">${pixelIcon('coin')}<strong id="lumenWallet">${r.meta.coins}</strong></span></div><fieldset class="lumen-roster"><legend class="sr-only">Выбор героя</legend>${Object.entries(CHARACTERS).map(([id,h])=>`<button type="button" data-lumen-action="character" data-lumen-value="${id}" aria-pressed="${character===id}" aria-label="${h.name}, ${r.meta.unlocked.includes(id)?'доступен':`${h.price} монет`}" style="--hero-accent:${h.accent};--hero-image:url('../assets/lumen/${id}.png')"><span class="lumen-character-portrait" aria-hidden="true"></span><b>${h.name}</b><small>${r.meta.unlocked.includes(id)?WEAPONS[h.weapon].short:`${h.price} монет`}</small></button>`).join('')}</fieldset><div class="lumen-hero-detail" style="--weapon-color:${hero.accent}"><span class="lumen-native-icon">${pixelIcon(hero.weapon)}</span><div><h3>${hero.name} <small>${hero.hp} здоровья</small></h3><b>${WEAPONS[hero.weapon].title}</b><p>${hero.story}</p></div></div>${!owned?`<button class="lumen-buy" type="button" data-lumen-action="buy" data-lumen-value="${character}" ${missing||!requirement.eligible?'disabled':''}>${pixelIcon('coin')} Открыть героя · ${hero.price}</button><p class="lumen-unlock-rule" data-ready="${requirement.eligible}">${requirement.eligible?'Оружейное испытание выполнено':`Найди «${WEAPONS[hero.weapon].title}» в случайном выборе и доведи до VIII за один забег.`}<small>Лучший результат найденного оружия: ${requirement.best} / ${requirement.target}</small></p><p class="lumen-shop-note">${!requirement.eligible?'Сначала выполни оружейное испытание.':missing?`Нужно ещё ${missing} монет. Ищи сундуки у элиты и стражей.`:'Герой останется доступен во всех следующих экспедициях.'}</p>`:''}${canResume?'<button class="lumen-launch" type="button" data-lumen-action="resume">Продолжить экспедицию <span>→</span></button>':''}<button class="${canResume?'text-button lumen-new':'lumen-launch'}" type="button" data-lumen-action="start" ${owned?'':'disabled'}>${!owned?'Сначала открой героя':canResume?'Начать заново':'Зажечь маяк <span>→</span>'}</button><p class="lumen-controls-note">Джойстик на экране или <kbd>WASD</kbd> / стрелки.<br>Оружие атакует само. Пауза — <kbd>Esc</kbd> / <kbd>P</kbd>.</p></div></div>${armoryDetails()}<div class="lumen-how"><div><span>01 / ДВИЖЕНИЕ</span><h3>Не стой на месте</h3><p>Уходи от роя и подбирай осколки побеждённых существ.</p></div><div><span>02 / СОКРОВИЩА</span><h3>Охоться за сундуками</h3><p>Элита и стражи оставляют монеты. Иногда сундук усиливает уже взятое оружие.</p></div><div><span>03 / РАССВЕТ</span><h3>Открой следующий путь</h3><p>Достигни ${biome.goal}-го уровня. ${biome.next?'Победа откроет следующую карту.':'Это последняя доступная карта.'} Монеты и бойцы останутся с тобой.</p></div></div><p class="game-note">Забег, монеты и открытые герои сохраняются на этом устройстве. Без XP кампаний.${r.stats.runs?` Экспедиций: ${r.stats.runs}. Побед: ${r.stats.wins}. Лучшее время: ${clock(r.stats.bestTime)}.`:''}</p>`;
    // Keep the primary action in the first mobile screen; character choice stays editable below.
    if(matchMedia('(max-width:900px)').matches){const brief=setupMount.querySelector('.lumen-brief'),launch=brief.querySelector('.lumen-launch');brief.insertBefore(launch,brief.querySelector('.lumen-maps'));}
    preview=new Renderer($('#lumenPreview'),art);preview.resize();
    const demo=createRun({seed:17,character,map});demo.player.x=0;demo.player.y=110;demo.time=9;
    demo.enemies=[{id:1,x:-120,y:20,kind:map==='quarry'?'shardback':'beetle',radius:15,hp:40,maxHp:40},{id:2,x:120,y:80,kind:map==='quarry'?'quartzling':'mote',radius:12,hp:20,maxHp:20},{id:3,x:180,y:-80,kind:map==='quarry'?'moonmoth':'wasp',radius:12,hp:20,maxHp:20}];
    demo.gems=[{x:80,y:150,value:1},{x:-70,y:150,value:1}];previewState=demo;preview.draw(demo,true);
    if(preserveScroll){if(main)main.scrollTop=scroll;$('.lumen-roster').scrollLeft=rosterScroll;}
  }
  function mountRun(){
    terminalFrameStart=0;
    preview?.destroy();preview=null;stopRenderer();
    gameMount.innerHTML=`<canvas id="lumenCanvas" tabindex="0" role="img" aria-label="Арена Люмена. Двигайся WASD или стрелками. Оружие атакует само. Escape открывает паузу.">Для этой игры необходим Canvas 2D.</canvas><div class="lumen-hud"><div class="lumen-health"><span class="lumen-hud-kicker">СВЕТОВОЕ ЯДРО</span><div>${pixelIcon('vitality')}<b id="lumenHealth">110 / 110</b></div><div class="lumen-health-track" role="meter" aria-label="Здоровье" aria-valuemin="0" id="lumenHealthMeter"><i></i></div></div><div class="lumen-timer"><strong id="lumenTimer">00:00</strong><span id="lumenGoal"></span></div><div class="lumen-tools"><button type="button" class="lumen-tool" data-lumen-action="sound" aria-label="Включить звук" aria-pressed="false">${pixelIcon('mute')}</button><button type="button" class="lumen-tool" data-lumen-action="fullscreen" aria-label="Полный экран">${pixelIcon('fullscreen')}</button><button type="button" class="lumen-tool" data-lumen-action="pause" aria-label="Пауза">${pixelIcon('pause')}</button></div></div><div class="lumen-xp"><div><span id="lumenLevel">Уровень 1</span><span id="lumenXpLabel">0 / 10</span></div><div class="lumen-xp-track" role="progressbar" aria-label="Опыт забега" aria-valuemin="0" id="lumenXpMeter"><i></i></div></div><div class="lumen-wave" id="lumenWave" aria-live="polite"></div><div class="lumen-bottom"><div class="lumen-equipment"><div class="lumen-artifacts" id="lumenArtifacts" hidden></div><div class="lumen-weapons" id="lumenWeapons"></div></div><div class="lumen-tally"><strong id="lumenKills">0</strong><span>побеждено</span><div class="lumen-run-coins">${pixelIcon('coin')}<b id="lumenCoins">0</b></div></div></div><div class="lumen-loot" id="lumenLoot" hidden></div><p class="lumen-hint" id="lumenMoveHint">Проведи по полю, чтобы двигаться<span>или используй WASD / стрелки</span></p><div class="lumen-stick" id="lumenStick" hidden aria-hidden="true"><i></i></div><div class="lumen-overlay" id="lumenOverlay" hidden></div><p class="sr-only" id="lumenAnnouncement" role="status" aria-live="polite"></p>`;
    renderer=new Renderer($('#lumenCanvas'),art);lockScreen(true);renderer.resize();
    $('#lumenCanvas').addEventListener('pointerdown',pointerDown,{signal});
    $('#lumenCanvas').addEventListener('pointermove',pointerMove,{signal});
    $('#lumenCanvas').addEventListener('pointerup',pointerEnd,{signal});
    $('#lumenCanvas').addEventListener('pointercancel',pointerEnd,{signal});
    $('#lumenCanvas').addEventListener('lostpointercapture',pointerEnd,{signal});
    updateHud();renderer.draw(state);$('#lumenCanvas').focus({preventScroll:true});
  }
  function start(){
    if(!record().meta.unlocked.includes(character)||!mapAvailable(record().meta,map))return;
    if(record().run&&!window.confirm('Начать заново? Текущая экспедиция будет заменена.'))return;
    state=createRun({seed:crypto.getRandomValues(new Uint32Array(1))[0],character,map,runId:crypto.randomUUID()});state.player.y=85;resultRecorded=false;paused=false;overlayKey='';
    navigate('lumen-game');screen='lumen-game';mountRun();save();unlockAudio();
    if(tg?.initData&&tg.isVersionAtLeast?.('8.0')){try{tg.requestFullscreen();}catch(_){}}
    lastFrame=performance.now();raf=requestAnimationFrame(frame);
  }
  function resume(){
    state=restore(record().run);
    if(!state){record().run=null;persist();setup();toast('Сохранение повреждено или устарело. Можно начать новую экспедицию.');return;}
    character=state.character;map=state.map;resultRecorded=false;paused=true;overlayKey='';navigate('lumen-game');screen='lumen-game';mountRun();
    if(state.status==='upgrade'){paused=false;showUpgrade();}else showPause('Экспедиция ждёт');
    lastFrame=performance.now();raf=requestAnimationFrame(frame);
  }
  function updateHud(){
    if(!state||!$('#lumenHealth'))return;
    const p=state.player;
    $('#lumenHealth').textContent=`${Math.ceil(Math.max(0,p.hp))} / ${p.maxHp}`;
    const hp=$('#lumenHealthMeter');hp.setAttribute('aria-valuemax',p.maxHp);hp.setAttribute('aria-valuenow',Math.ceil(Math.max(0,p.hp)));hp.firstElementChild.style.width=`${Math.max(0,p.hp/p.maxHp)*100}%`;
    $('#lumenTimer').textContent=clock(state.time);$('#lumenGoal').textContent=MAPS[state.map].name;$('#lumenLevel').textContent=`Уровень ${state.level} / ${MAPS[state.map].goal}`;$('#lumenXpLabel').textContent=`${state.xp} / ${state.xpNext}`;
    const xp=$('#lumenXpMeter');xp.setAttribute('aria-valuemax',state.xpNext);xp.setAttribute('aria-valuenow',state.xp);xp.firstElementChild.style.width=`${Math.min(100,state.xp/state.xpNext*100)}%`;
    $('#lumenKills').textContent=state.kills;
    const weapons=WEAPON_IDS.filter(id=>state.upgrades[id]),dock=$('#lumenWeapons'),dockKey=weapons.map(id=>`${id}:${state.upgrades[id]}`).join(':');
    if(dock.dataset.key!==dockKey){dock.dataset.key=dockKey;dock.innerHTML=weapons.map(id=>`<span class="lumen-slot ${WEAPONS[id].className}" style="--weapon-color:${WEAPONS[id].color}" title="${WEAPONS[id].title}: ${WEAPONS[id].verb}">${pixelIcon(id)}<small>${state.upgrades[id]}</small><span class="lumen-slot-caption">${WEAPONS[id].short}</span><span class="sr-only">${WEAPONS[id].title}: стадия ${state.upgrades[id]}</span></span>`).join('');}
    const relicDock=$('#lumenArtifacts'),relics=Object.keys(ARTIFACTS).filter(id=>state.upgrades[id]),relicKey=relics.map(id=>id+state.upgrades[id]).join(':');
    relicDock.hidden=!relics.length;
    if(relicDock.dataset.key!==relicKey){relicDock.dataset.key=relicKey;relicDock.innerHTML=`<span class="lumen-relic-label">АРТЕФАКТЫ</span>${relics.map(id=>`<span class="lumen-relic-slot" role="img" aria-label="${ARTIFACTS[id].title}, ранг ${state.upgrades[id]}. ${ARTIFACTS[id].description}" title="${ARTIFACTS[id].title} · ${state.upgrades[id]}/3" style="--weapon-color:${ARTIFACTS[id].color}">${pixelIcon(id)}<small>${roman[state.upgrades[id]]}</small></span>`).join('')}`;}
    $('#lumenCoins').textContent=state.coinsEarned;
    const loot=state.lootLog.at(-1),notice=$('#lumenLoot');notice.hidden=!loot||state.time-loot.time>3;
    if(loot&&notice.dataset.id!==String(loot.id)){notice.dataset.id=loot.id;notice.innerHTML=`${pixelIcon(loot.weapon||'coin')}<span>+${loot.coins} монет${loot.weapon?` · ${WEAPONS[loot.weapon].short} ${roman[loot.stage]}`:''}</span>`;$('#lumenAnnouncement').textContent=notice.textContent;}
    const wave=state.enemies.find(e=>e.kind==='guardian');
    const phase=waveAt(state.time);
    const trapped=touchingEnemies(state).length>=3;
    const text=trapped?'ТЕБЯ ЗАЖАЛИ · ПРОБЕЙ ПРОХОД':wave?BOSSES[wave.guardianStage].name.toUpperCase():state.chests.length?'СУНДУК НА ПОЛЕ · ПОДОЙДИ И ОТКРОЙ':state.time<8?'СОБИРАЙ ОСКОЛКИ СВЕТА':phase.kind==='harvest'?'СЛАБЫЙ РОЙ · СОБИРАЙ ОПЫТ':phase.kind==='pressure'&&phase.age<5?`НОВАЯ ВОЛНА · ЭТАП ${phase.stage}`:'';
    $('#lumenWave').dataset.phase=trapped?'contact':wave?'guardian':phase.kind;
    if($('#lumenWave').textContent!==text)$('#lumenWave').textContent=text;
    $('#lumenMoveHint').hidden=state.time>12||pointer!==null||keys.size>0;
    const sb=$('[data-lumen-action="sound"]',gameMount);if(sb){sb.setAttribute('aria-pressed',String(record().settings.sound));sb.setAttribute('aria-label',record().settings.sound?'Выключить звук':'Включить звук');sb.innerHTML=pixelIcon(record().settings.sound?'sound':'mute');}
  }
  function frame(now){
    if(screen!=='lumen-game'||!renderer)return;
    const dt=Math.min(.1,Math.max(0,(now-lastFrame)/1000));lastFrame=now;
    if(!paused&&state.status==='playing'){
      const x=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),y=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0);
      const hp=state.player.hp,kills=state.kills,coins=state.coinsEarned;
      const direction=pointer===null?{x,y}:input;state.moving=Math.hypot(direction.x,direction.y)>.01;step(state,direction,dt,renderer.captureTick);
      if(state.player.hp<hp)sound('hurt');else if(state.kills>kills)sound('kill');
      if(state.coinsEarned>coins){save();sound('level');updateHud();}
      if(state.status==='upgrade'){sound('level');save();showUpgrade();}
      if(['won','lost'].includes(state.status)){updateHud();showResult();}
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
    gameMount.querySelectorAll('.lumen-hud,.lumen-xp,.lumen-bottom,#lumenCanvas').forEach(el=>el.inert=true);
    overlay.querySelector('button')?.focus({preventScroll:true});
  }
  function hideOverlay(){const overlay=$('#lumenOverlay');if(overlay){overlay.hidden=true;overlay.innerHTML='';}overlayKey='';gameMount.querySelectorAll('[inert]').forEach(el=>el.inert=false);$('#lumenCanvas')?.focus({preventScroll:true});}
  function showPause(title='Маяк подождёт'){
    if(!state||['won','lost'].includes(state.status))return;
    paused=true;save();if(state.status==='upgrade'){showUpgrade();return;}
    showOverlay('pause',`<span class="lumen-dialog-kicker">ПАУЗА / ${clock(state.time)}</span><h2 id="lumenDialogTitle">${title}</h2><p>Экспедиция сохранена на этом устройстве. Когда будешь готов — продолжай.</p><button class="lumen-launch" data-lumen-action="continue" type="button">Продолжить экспедицию <span>→</span></button><button class="lumen-menu-button" data-lumen-action="exit" type="button">Сохранить и выйти</button><button class="lumen-menu-button" data-lumen-action="sound" type="button" aria-pressed="${record().settings.sound}">Звук: ${record().settings.sound?'включён':'выключен'}</button><div class="lumen-pause-help">Двигайся джойстиком или WASD / стрелками.<br>Оружие атакует само. Собирай свет для улучшений.</div><details class="lumen-recipes"><summary>Рецепты слияний · VIII + VIII</summary>${recipeBook(state.upgrades)}</details>${Object.keys(ARTIFACTS).some(id=>state.upgrades[id])?`<div class="lumen-pause-artifacts">${Object.entries(ARTIFACTS).filter(([id])=>state.upgrades[id]).map(([id,a])=>`<p>${pixelIcon(id)}<span>${a.title} ${roman[state.upgrades[id]]}<small>${a.description}</small></span></p>`).join('')}</div>`:''}`);
    soundSuspend();
  }
  function showUpgrade(){
    showOverlay(`upgrade-${state.level}`,`<div class="lumen-upgrade-heading"><h2 id="lumenDialogTitle">Усиль свой свет</h2><span class="lumen-dialog-kicker">УРОВЕНЬ ${state.level} · ВЫБЕРИ ОДНО</span></div><div class="lumen-upgrades">${state.choices.map(id=>{
      const u=UPGRADES.find(u=>u.id===id),rank=state.upgrades[id]||0,fusion=HYBRIDS[id]&&!rank;
      const theme=WEAPONS[id]?.className||(u.kind==='recovery'?'rose':'neutral'),color=WEAPONS[id]?.color||ARTIFACTS[id]?.color||'#a4b9c9';
      const label=fusion?'Соединить VIII + VIII → I':rank?`${WEAPONS[id]?'Стадия':'Ранг'} ${roman[rank]||rank} → ${roman[rank+1]||rank+1}`:u.kind==='weapon'?'Новое оружие':u.kind==='artifact'?'Новый артефакт · I / III':'Новое улучшение';
      return `<button class="${theme}${fusion?' lumen-fusion-choice':''}" style="--weapon-color:${color}" type="button" data-lumen-action="upgrade" data-lumen-value="${id}" title="${u.description}${fusion?' · '+HYBRIDS[id].hint:''}"><span class="lumen-upgrade-icon" aria-hidden="true">${pixelIcon(id)}</span><span><small>${label}</small><strong>${u.title}</strong><span>${upgradeSummary(id,rank)}</span>${fusion?`<span class="lumen-recipe-hint">${HYBRIDS[id].requires.map(part=>WEAPONS[part].short+' VIII').join(' + ')} · освободит слот</span>`:''}<span class="sr-only">${u.description}</span></span></button>`;
    }).join('')}</div><button class="lumen-upgrade-exit" data-lumen-action="exit" type="button">Сохранить и выйти</button>`);
  }
  function showResult(){
    if(!resultRecorded){const r=record();r.stats.runs++;if(state.status==='won')r.stats.wins++;r.stats.bestTime=Math.max(r.stats.bestTime,state.time);r.stats.bestKills=Math.max(r.stats.bestKills,state.kills);resultRecorded=true;save();}
    const won=state.status==='won',biome=MAPS[state.map],next=won&&biome.next;
    showOverlay('result',`<span class="lumen-dialog-kicker">${won?'ЭКСПЕДИЦИЯ ЗАВЕРШЕНА':'СВЕТ НЕ ПОГАС НАВСЕГДА'}</span><div class="lumen-result-mark" aria-hidden="true">${pixelIcon(won?'stars':'light')}</div><h2 id="lumenDialogTitle">${won?`${biome.name} пройден`:'Новая ночь. Новый шанс.'}</h2><p>${won?next?`Уровень ${biome.goal} достигнут. Открыта следующая карта: ${MAPS[next].name}.`:`Уровень ${biome.goal} достигнут. Обе карты пройдены — можно вернуться с другим героем.`:'Сохрани монеты и попробуй новое сочетание оружия. Результат оружейного испытания тоже остаётся.'}</p><div class="lumen-result-stats"><span><b>${clock(state.time)}</b>время</span><span><b>${state.kills}</b>побеждено</span><span><b>${state.level}</b>уровень</span></div><p class="lumen-earned">${pixelIcon('coin')} +${state.coinsEarned} монет за забег <small>В кошельке: ${record().meta.coins}</small></p>${next?`<button class="lumen-launch" data-lumen-action="next" data-lumen-value="${next}" type="button">Следующая карта · ${MAPS[next].name} <span>→</span></button><button class="lumen-menu-button" data-lumen-action="start" type="button">Повторить эту карту</button>`:'<button class="lumen-launch" data-lumen-action="start" type="button">Новая экспедиция <span>→</span></button>'}<button class="lumen-menu-button" data-lumen-action="exit" type="button">К картам и бойцам</button><small class="lumen-result-note">Прогресс сохранён на устройстве. XP кампаний не начисляется.</small>`);
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
    if(name==='setup'){setup();return;}
    if(name==='character'&&Object.hasOwn(CHARACTERS,value)){character=value;setup(true);$(`[data-lumen-action="character"][data-lumen-value="${character}"]`)?.focus({preventScroll:true});return;}
    if(name==='map'&&mapAvailable(record().meta,value)){map=value;setup(true);$(`[data-lumen-action="map"][data-lumen-value="${map}"]`)?.focus({preventScroll:true});return;}
    if(name==='next'&&state?.status==='won'&&value===MAPS[state.map].next&&mapAvailable(record().meta,value)){map=value;start();return;}
    if(name==='buy'){const r=record();if(buyCharacter(r.meta,value)){persist();setup(true);$('[data-lumen-action="start"]')?.focus({preventScroll:true});toast(`${CHARACTERS[value].name} готов к экспедиции`);}return;}
    if(name==='start'){start();return;}
    if(name==='resume'){resume();return;}
    if(name==='pause'){showPause();return;}
    if(name==='continue'){paused=false;hideOverlay();unlockAudio();runLoop();return;}
    if(name==='fullscreen'){fullscreen();return;}
    if(name==='sound'){const r=record();r.settings.sound=!r.settings.sound;if(r.settings.sound)unlockAudio();else soundSuspend();persist();updateHud();const button=$('#lumenOverlay [data-lumen-action="sound"]');if(button){button.textContent=`Звук: ${r.settings.sound?'включён':'выключен'}`;button.setAttribute('aria-pressed',String(r.settings.sound));}return;}
    if(name==='upgrade'&&state?.status==='upgrade'&&chooseUpgrade(state,value)){hideOverlay();paused=false;save();updateHud();if(state.status==='upgrade')showUpgrade();else if(state.status==='won')showResult();else{unlockAudio();runLoop();}return;}
    if(name==='exit'){save();releaseFullscreen();setup();}
  }
  function onScreen(name){
    if(screen==='lumen-game'&&name!=='lumen-game'){paused=true;save();stopRenderer();lockScreen(false);releaseFullscreen();soundSuspend();}
    if(screen==='lumen'&&name!=='lumen'){preview?.destroy();preview=null;}
    screen=name;
  }
  function preventScroll(e){if(screen==='lumen-game'&&!e.target.closest('[data-lumen-scroll]'))e.preventDefault();}
  document.addEventListener('wheel',preventScroll,{passive:false,signal});
  document.addEventListener('touchmove',preventScroll,{passive:false,signal});
  document.addEventListener('keydown',e=>{
    if(screen!=='lumen-game')return;
    if(e.code==='Tab'&&overlayKey){const buttons=[...$('#lumenOverlay').querySelectorAll('button,summary')],first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}return;}
    if(['Escape','KeyP'].includes(e.code)){e.preventDefault();if(e.repeat)return;if(overlayKey==='pause')action('continue');else if(!overlayKey)showPause();return;}
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'].includes(e.code)){e.preventDefault();if(!paused&&!overlayKey)keys.add(e.code);}
  },{signal});
  document.addEventListener('keyup',e=>keys.delete(e.code),{signal});
  function deactivate(){if(screen==='lumen-game'&&state?.status==='playing')showPause('Экспедиция на паузе');clearInput();}
  window.addEventListener('blur',deactivate,{signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)deactivate();},{signal});
  window.addEventListener('pagehide',()=>{if(screen==='lumen-game'&&state){paused=true;save();soundSuspend();}},{signal});
  window.addEventListener('resize',()=>{viewport();if(preview&&screen==='lumen'){preview.resize();preview.draw(previewState,true);}},{signal});
  window.visualViewport?.addEventListener('resize',viewport,{signal});
  document.addEventListener('fullscreenchange',()=>{viewport();if(screen==='lumen-game'&&!document.fullscreenElement&&fullscreenOwned){fullscreenOwned=false;deactivate();}},{signal});
  try{tg?.onEvent?.('deactivated',deactivate);tg?.onEvent?.('viewportChanged',viewport);tg?.onEvent?.('safeAreaChanged',viewport);tg?.onEvent?.('contentSafeAreaChanged',viewport);tg?.onEvent?.('fullscreenFailed',()=>{if(screen==='lumen-game')toast('Telegram не разрешил полный экран. Игра занимает доступную область.');});}catch(_){}
  return {setup,resume,action,onScreen};
}

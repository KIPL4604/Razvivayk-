import {createRun,step,serialize,restore,interaction,objective,currentRoom,ROOMS,FORMS,formFor} from './engine.mjs';
import {createRenderer} from './renderer.mjs?v=7';

const icons={pause:'<path d="M8 5v14M16 5v14"/>',full:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',aim:'<circle cx="12" cy="12" r="6"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5"/>',burst:'<path d="m5 4 8 8-8 8m8-16 8 8-8 8"/>',sound:'<path d="M11 4 5 9H2v6h3l6 5Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>'};
const icon=id=>`<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">${icons[id]}</svg>`;
const button=(id,label,cls='')=>`<button type="button" data-sp-action="${id}" class="${cls}">${label}</button>`;
export async function createGame(context){
  const mount=document.querySelector('#specimenMount');
  mount.innerHTML=`<div class="sp-shell" data-mode="menu"><canvas class="sp-canvas" tabindex="0" aria-label="Лаборатория. Управление: WASD или стрелки, мышь — захват, E — взаимодействие, пробел — рывок, Escape — пауза."></canvas>
    <div class="sp-hud"><div class="sp-mass"><span>БИОМАССА <b id="spMassValue">32 / 100</b></span><div role="progressbar" aria-label="Запас биомассы" aria-valuemin="0" aria-valuemax="100" id="spMassBar"><i></i></div><small id="spForm">Малая форма</small></div><div class="sp-sector"><b id="spSector"></b><span id="spObjective"></span></div>${button('pause',icon('pause'),'sp-pause')}</div>
    <p class="sp-message" role="status" aria-live="polite"></p>
    <div class="sp-controls"><button class="sp-stick sp-move" type="button" aria-label="Джойстик движения"><span></span><small>ДВИЖЕНИЕ</small></button><button class="sp-stick sp-grab" type="button" aria-label="Направить щупальце и захватить">${icon('aim')}<span></span><small>ЗАХВАТ</small></button>${button('burst',icon('burst')+'<small>РЫВОК</small>','sp-burst')}${button('use','<kbd>E</kbd><span>Взаимодействие</span>','sp-use')}<span class="sp-desktop-hint">WASD · мышь: удерживай, чтобы схватить · E · пробел</span></div>
    <div class="sp-panel-wrap"><section class="sp-panel" tabindex="-1" aria-labelledby="spPanelTitle"></section></div>
    <div class="sp-rotate" hidden><b>Поверни телефон</b><p>В альбомном положении лучше видны лаборатория и оба щупальца управления.</p>${button('portrait','Играть вертикально','sp-secondary')}</div>
  </div>`;
  const shell=mount.querySelector('.sp-shell'),canvas=mount.querySelector('canvas'),panel=mount.querySelector('.sp-panel'),panelWrap=mount.querySelector('.sp-panel-wrap');
  const renderer=await createRenderer(canvas),keys=new Set(),pointers=new Map(),input={x:0,y:0,aimX:1,aimY:0,grabbing:false,burst:false,interact:false};
  let active=false,mode='menu',state=null,preview=null,last=0,raf=0,lastSave=0,lastHud=0,lastDraw=0,lastEvent=-1,lastCheckpoint=-1,audio=null,fullscreenOwned=false,portraitAllowed=false,helpReturn='menu',frameTimes=[];
  const $=s=>mount.querySelector(s);
  $('.sp-pause').setAttribute('aria-label','Пауза');$('.sp-burst').setAttribute('aria-label','Рывок');
  function record(){const root=context.getSaved();if(!root.specimen||typeof root.specimen!=='object'||Array.isArray(root.specimen))root.specimen={};const r=root.specimen;r.version=4;r.settings={sound:r.settings?.sound===true};return r;}
  function save(checkpoint=false){if(!state||state.status!=='playing')return;const r=record();r.run=serialize(state);if(checkpoint)r.checkpoint=serialize(state);r.lastTouchedAt=Date.now();context.persist();lastSave=performance.now();}
  function resetInput(){keys.clear();pointers.clear();Object.assign(input,{x:0,y:0,grabbing:false,burst:false,interact:false});for(const stick of mount.querySelectorAll('.sp-stick')){stick.style.setProperty('--stick-x','0px');stick.style.setProperty('--stick-y','0px');stick.classList.remove('held');}}
  function introPreview(){preview=restore({...serialize(createRun()),mass:100,x:542,y:556});preview.nodes.forEach((n,i)=>{n.x=542-(i%5)*19;n.y=542+Math.floor(i/5)*18+(i%2)*10;n.px=n.x;n.py=n.y;});preview.x=542;preview.y=556;}
  function sound(){if(!record().settings.sound)return;try{audio||=new AudioContext();if(audio.state!=='running')return;const o=audio.createOscillator(),g=audio.createGain(),now=audio.currentTime;o.type='triangle';o.frequency.setValueAtTime(94,now);o.frequency.exponentialRampToValueAtTime(46,now+.12);g.gain.setValueAtTime(.045,now);g.gain.exponentialRampToValueAtTime(.0001,now+.16);o.connect(g);g.connect(audio.destination);o.start();o.stop(now+.17);}catch{record().settings.sound=false;}}
  function title(name,kicker='СЕКТОР 7 / БИОКОНТРОЛЬ'){return `<p class="sp-kicker">${kicker}</p><h1 id="spPanelTitle">${name}</h1>`;}
  function settings(){return `<div class="sp-settings">${button('sound',icon('sound')+`Звук: ${record().settings.sound?'вкл':'выкл'}`)}${button('fullscreen',icon('full')+(document.fullscreenElement||context.telegram?.isFullscreen?'В оконный режим':'Во весь экран'))}</div>`;}
  function showPanel(){
    panelWrap.hidden=mode==='playing';panel.innerHTML='';shell.dataset.mode=mode;
    if(mode==='playing'){canvas.focus({preventScroll:true});return;}
    if(mode==='menu'){
      const resumable=!!restore(record().run);
      const recoverable=!resumable&&!record().completed&&!!restore(record().checkpoint);
      panel.innerHTML=title('Нулевой<br><em>образец</em>')+`<p class="sp-intro">Тебя создали в изоляции.<br>Теперь лаборатория — твой путь наружу.</p><p class="sp-edition">ПЕРВЫЙ ПРОТОТИП · 6 ПОМЕЩЕНИЙ · 3 ЭТАЖА</p><div class="sp-actions">${button(resumable?'resume':recoverable?'retry':'start',resumable?'Продолжить побег':recoverable?'Восстановить образец':'Начать побег','sp-primary')}${resumable||recoverable?button('new','Новый побег','sp-secondary'):''}${button('help','Как управлять','sp-secondary')}</div>`+settings()+button('exit','← В каталог','sp-exit');
    }else if(mode==='paused')panel.innerHTML=title('Связь<br><em>приостановлена</em>')+`<p class="sp-intro">${ROOMS[state.room].title}<br>${objective(state)}</p><div class="sp-actions">${button('continue','Продолжить','sp-primary')}${button('help','Управление','sp-secondary')}${button('title','В меню игры','sp-secondary')}</div>`+settings();
    else if(mode==='dead')panel.innerHTML=title('Образец<br><em>потерян</em>')+'<p class="sp-intro">Охрана уничтожила активную биомассу.<br>Контрольная точка сохранилась.</p><div class="sp-actions">'+button('retry','Восстановить образец','sp-primary')+button('title','В меню игры','sp-secondary')+'</div>';
    else if(mode==='won')panel.innerHTML=title('Контакт<br><em>оборван</em>','СЕКТОР 7 / ШЛЮЗ ОТКРЫТ')+`<p class="sp-intro">Образец покинул лабораторный сектор.<br>За шлюзом обнаружены другие источники тепла.</p><p class="sp-edition">ПРОТОТИП ПРОЙДЕН · ${Math.floor(state.time/60)}:${String(Math.floor(state.time%60)).padStart(2,'0')} · ПОГЛОЩЕНО ${state.kills}</p><div class="sp-actions">${button('start','Пройти ещё раз','sp-primary')}${button('title','В меню игры','sp-secondary')}</div>`;
    else if(mode==='new')panel.innerHTML=title('Новый<br><em>побег</em>')+'<p class="sp-intro">Начать с изолятора? Текущий побег и контрольная точка будут заменены.</p><div class="sp-actions">'+button('start','Начать заново','sp-primary')+button('title','Вернуться','sp-secondary')+'</div>';
    else if(mode==='help')panel.innerHTML=title('Почувствуй<br><em>каждый отросток</em>','УПРАВЛЕНИЕ ОБРАЗЦОМ')+`<dl class="sp-help"><div><dt>Двигайся</dt><dd>Левый джойстик или WASD / стрелки. Щупальца сами цепляются за стены, галереи и потолок и перехватываются при движении.</dd></div><div><dt>Хватай</dt><dd>Правым джойстиком направляй щупальце. Удерживай, чтобы притянуть и поглотить человека. Отпусти захваченный ящик — он полетит по прицелу, отскочит от стен и собьёт человека. На компьютере — удерживай левую кнопку мыши. Так же можно сорвать подвесную лампу.</dd></div><div><dt>Меняй массу</dt><dd>Подойди к резервуару и нажми «Оставить массу». Вернись к нему, чтобы забрать её.</dd></div><div><dt>Пробивай путь</dt><dd>Большая форма разрушает перегородку рывком: кнопка со стрелками или пробел.</dd></div><div><dt>Взаимодействуй</dt><dd>Рычаг и терминал: потяни захватом или нажми E. Зелёное живое ядро в стене сохраняет побег при сближении. Escape — пауза.</dd></div></dl>`+button('help-back','Понятно','sp-primary');
    panel.focus({preventScroll:true});
  }
  function setMode(next){resetInput();mode=next;last=performance.now();showPanel();updateRotation();}
  function updateRotation(){const rotate=$('.sp-rotate'),need=active&&mode==='playing'&&innerHeight>innerWidth&&!portraitAllowed;rotate.hidden=!need;if(need)resetInput();}
  function enter(){active=true;cancelAnimationFrame(raf);introPreview();state=restore(record().run);setMode('menu');renderer.resize();last=performance.now();raf=requestAnimationFrame(frame);}
  function start(){state=createRun();record().completed=false;lastCheckpoint=state.checkpointEvent;lastEvent=-1;save(true);setMode('playing');}
  async function fullscreen(){try{
    if(context.telegram?.isVersionAtLeast?.('8.0')&&context.telegram.requestFullscreen){fullscreenOwned=!context.telegram.isFullscreen;context.telegram.requestFullscreen();}
    else if(!document.fullscreenElement){await document.documentElement.requestFullscreen();fullscreenOwned=true;}
    else if(fullscreenOwned){await document.exitFullscreen();fullscreenOwned=false;}
  }catch{context.toast('Полный экран недоступен. Игра продолжает работать в окне.');}if(active&&mode!=='playing')showPanel();}
  function leaveFullscreen(){if(!fullscreenOwned)return;fullscreenOwned=false;try{if(context.telegram?.isFullscreen)context.telegram.exitFullscreen?.();else if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});}catch{}}
  function action(id){
    if(!active)return;
    if(id==='start')start();else if(id==='new')setMode('new');
    else if(id==='resume'){state=restore(record().run);if(state){lastCheckpoint=state.checkpointEvent;lastEvent=-1;setMode('playing');}else{context.toast('Сохранение недоступно. Можно начать новый побег.');setMode('menu');}}
    else if(id==='pause'){if(mode==='playing'){save();setMode('paused');}}
    else if(id==='continue'){if(state?.status==='playing')setMode('playing');}
    else if(id==='retry'){state=restore(record().checkpoint)||createRun();state.status='playing';lastCheckpoint=state.checkpointEvent;lastEvent=-1;save();setMode('playing');}
    else if(id==='title'){save();introPreview();setMode('menu');}
    else if(id==='exit'){save();leaveFullscreen();context.navigate('home');}
    else if(id==='help'){helpReturn=mode;setMode('help');}
    else if(id==='help-back')setMode(helpReturn==='playing'?'paused':helpReturn);
    else if(id==='sound'){const r=record();r.settings.sound=!r.settings.sound;context.persist();if(r.settings.sound){try{audio||=new AudioContext();audio.resume().then(sound);}catch{r.settings.sound=false;}}showPanel();}
    else if(id==='fullscreen')fullscreen();
    else if(id==='portrait'){portraitAllowed=true;updateRotation();canvas.focus({preventScroll:true});}
    else if(id==='use'&&mode==='playing')input.interact=true;
    else if(id==='burst'&&mode==='playing')input.burst=true;
  }
  function frame(now){
    if(!active)return;
    const dt=Math.min(.1,(now-last)/1000);last=now;const drawingStart=performance.now();
    if(mode==='playing'&&$('.sp-rotate').hidden){
      const kx=(keys.has('d')||keys.has('ArrowRight')?1:0)-(keys.has('a')||keys.has('ArrowLeft')?1:0),ky=(keys.has('s')||keys.has('ArrowDown')?1:0)-(keys.has('w')||keys.has('ArrowUp')?1:0),ticks=state.ticks;
      step(state,dt,{...input,x:kx||input.x,y:ky||input.y});if(state.ticks!==ticks){input.burst=false;input.interact=false;}
      if(state.checkpointEvent!==lastCheckpoint&&state.status==='playing'){save(true);lastCheckpoint=state.checkpointEvent;}
      if(state.event!==lastEvent){lastEvent=state.event;sound();}
      if(state.status==='dead'){record().run=null;context.persist();setMode('dead');}
      else if(state.status==='won'){const r=record();r.run=null;r.completed=true;context.persist();setMode('won');}
      if(now-lastSave>7000)save();
    }
    if(mode==='playing'||mode==='paused'||mode==='dead'||mode==='won'){
      if(now-lastDraw>(mode==='playing'?0:120)){renderer.draw(state,now);lastDraw=now;}
    }else if(now-lastDraw>50){preview.time=now/1000;renderer.draw(preview,now);lastDraw=now;}
    if(state&&now-lastHud>90){hud();lastHud=now;}
    frameTimes.push(performance.now()-drawingStart);if(frameTimes.length>180)frameTimes.shift();
    raf=requestAnimationFrame(frame);
  }
  function hud(){
    $('#spMassValue').textContent=`${Math.ceil(state.mass)} / 100`;$('#spMassBar').setAttribute('aria-valuenow',String(Math.ceil(state.mass)));$('#spMassBar i').style.width=state.mass+'%';$('#spMassBar').dataset.low=String(state.mass<24);
    $('#spForm').textContent=FORMS[formFor(state.mass)].name+' форма';$('#spSector').textContent=ROOMS[state.room].title;$('#spObjective').textContent=objective(state);
    const use=interaction(state),useButton=$('.sp-use');useButton.disabled=!use;useButton.hidden=use?.object.kind==='nest';useButton.querySelector('span').textContent=use?.label||'Подойди к объекту';
    $('.sp-burst').disabled=state.dashCooldown>0;$('.sp-message').textContent=state.messageTime>0?state.message:'';
  }
  function pausedByLifecycle(){if(active&&mode==='playing'){save();setMode('paused');}}
  function onScreen(name){if(name==='specimen'||!active)return;active=false;save();cancelAnimationFrame(raf);resetInput();leaveFullscreen();}
  function back(){if(mode==='playing'){action('pause');return true;}if(mode!=='menu'){action('title');return true;}action('exit');return true;}
  document.addEventListener('keydown',event=>{
    if(!active)return;const key=event.key.length===1?event.key.toLowerCase():event.key;
    if(key==='Escape'){event.preventDefault();if(event.repeat)return;if(mode==='playing')action('pause');else if(mode==='paused')action('continue');else back();return;}
    if(mode!=='playing'||!$('.sp-rotate').hidden)return;
    if(key===' '&&event.target.closest?.('button'))return;
    if(['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','e'].includes(key)){event.preventDefault();keys.add(key);if(!event.repeat){if(key===' ')input.burst=true;if(key==='e')input.interact=true;}}
  });
  document.addEventListener('keyup',event=>keys.delete(event.key.length===1?event.key.toLowerCase():event.key));
  window.addEventListener('blur',pausedByLifecycle);document.addEventListener('visibilitychange',()=>{if(document.hidden)pausedByLifecycle();});window.addEventListener('pagehide',()=>{save();resetInput();});window.addEventListener('resize',()=>{resetInput();updateRotation();});
  function setStick(event,stick,p){const r=stick.getBoundingClientRect(),dx=event.clientX-p.x,dy=event.clientY-p.y,d=Math.hypot(dx,dy),max=32,x=d?dx/Math.max(max,d):0,y=d?dy/Math.max(max,d):0;stick.style.setProperty('--stick-x',`${x*max}px`);stick.style.setProperty('--stick-y',`${y*max}px`);if(p.kind==='move'){input.x=x;input.y=y;}else{input.grabbing=true;if(d>4){input.aimX=x;input.aimY=y;}}}
  for(const [kind,selector]of [['move','.sp-move'],['grab','.sp-grab']]){
    const stick=$(selector);
    stick.addEventListener('pointerdown',e=>{if(mode!=='playing'||!$('.sp-rotate').hidden)return;e.preventDefault();if([...pointers.values()].some(p=>p.kind===kind))return;const r=stick.getBoundingClientRect(),p={kind,x:r.x+r.width/2,y:r.y+r.height/2};pointers.set(e.pointerId,p);stick.setPointerCapture(e.pointerId);stick.classList.add('held');setStick(e,stick,p);});
    stick.addEventListener('pointermove',e=>{const p=pointers.get(e.pointerId);if(p){e.preventDefault();setStick(e,stick,p);}});
    const release=e=>{const p=pointers.get(e.pointerId);if(!p)return;pointers.delete(e.pointerId);stick.classList.remove('held');stick.style.setProperty('--stick-x','0px');stick.style.setProperty('--stick-y','0px');if(p.kind==='move'){input.x=0;input.y=0;}else input.grabbing=false;};
    for(const event of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(event,release);
  }
  canvas.addEventListener('pointermove',e=>{if(!active||mode!=='playing'||e.pointerType!=='mouse')return;const p=renderer.worldPoint(e.clientX,e.clientY),d=Math.hypot(p.x-state.x,p.y-state.y)||1;input.aimX=(p.x-state.x)/d;input.aimY=(p.y-state.y)/d;});
  canvas.addEventListener('pointerdown',e=>{if(mode==='playing'&&e.pointerType==='mouse'&&e.button===0){canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);input.grabbing=true;e.preventDefault();}});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{input.grabbing=false;});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  introPreview();showPanel();
  return{enter,action,onScreen,back,snapshot:()=>state?{...serialize(state),mode,pointers:pointers.size,grab:state.grab?{...state.grab}:null,input:{...input},effects:{particles:state.particles.length,fragments:state.fragments.length,flashes:state.flashes.length},nodes:state.nodes.map(n=>({...n})),limbs:state.limbs.map(l=>({...l,anchor:l.anchor?{...l.anchor}:null,target:l.target?{...l.target}:null,tip:{...l.tip}})),metrics:{...renderer.metrics(),meanWorkMs:frameTimes.reduce((a,b)=>a+b,0)/(frameTimes.length||1)}}:{mode}};
}

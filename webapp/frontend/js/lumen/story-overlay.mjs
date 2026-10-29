const asset=new URL('../../assets/lumen/',import.meta.url);
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/** DOM-only scene director. It never advances or mutates the simulation. */
export class StoryOverlay{
 constructor(){
  this.root=document.createElement('section');this.root.id='lumenStory';this.root.hidden=true;document.body.append(this.root);
  this.media=matchMedia('(prefers-reduced-motion: reduce)');
  this.root.addEventListener('click',event=>{
   const action=event.target.closest('[data-story-action]')?.dataset.storyAction;
   if(!action){if(this.root.dataset.phase==='dialogue'&&event.target.closest('.lumen-story-stage,.lumen-story-copy')){event.preventDefault();event.stopPropagation();this.advance();}return;}
   event.preventDefault();event.stopPropagation();
   if(action==='advance')this.advance();else if(action==='skip')this.finish();else if(action==='cancel')this.cancel();else if(action==='retry')this.retry?.();
  });
  document.addEventListener('keydown',event=>{
   if(!this.active)return;
   if(event.code==='Tab'){
    const buttons=[...this.root.querySelectorAll('button')].filter(button=>!button.hidden&&!button.disabled&&button.getClientRects().length>0),index=buttons.indexOf(document.activeElement);
    event.preventDefault();buttons[(index+(event.shiftKey?-1:1)+buttons.length)%buttons.length]?.focus();
   }else if(['Enter','Space'].includes(event.code)){
    event.preventDefault();if(!event.repeat){const button=document.activeElement?.closest('[data-story-action]');if(button?.dataset.storyAction!=='advance')button?.click();else this.advance();}
   }else if(event.code==='Escape'){event.preventDefault();if(!event.repeat)this.cancel();}
   else if(['KeyP','KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code))event.preventDefault();
   event.stopImmediatePropagation();
  },true);
 }
 get active(){return !this.root.hidden;}
 play(scene,{hero='Герой',hold=false,onCancel}={}){
  this.close();this.scene=scene;this.hero=hero;this.hold=hold;this.onCancel=onCancel;this.index=0;this.previousFocus=document.activeElement;
  this.inert=[...document.querySelectorAll('#lumenGameMount,#lumenSetupMount')].map(el=>[el,el.inert]);this.inert.forEach(([el])=>el.inert=true);
  this.root.style.setProperty('--story-accent',scene.accent);this.root.hidden=false;this.root.dataset.phase='dialogue';
  this.root.innerHTML=`<div class="lumen-story-shell" role="dialog" aria-modal="true" aria-labelledby="lumenStoryTitle" data-lumen-scroll>
   <header class="lumen-story-header"><span>ЛЮМЕН <i>/</i> ${escape(scene.world)}</span><button type="button" data-story-action="skip">Пропустить <span aria-hidden="true">↗</span></button></header>
   <div class="lumen-story-stage${scene.silhouette?' is-silhouette':''}" aria-hidden="true"><div class="lumen-story-orbit"></div><img src="${new URL('story-'+scene.portrait+'.png',asset)}" alt="" width="384" height="384"></div>
   <div class="lumen-story-copy"><p class="lumen-story-chapter">ГЛАВА I <span>ПРОПАВШАЯ ЭКСПЕДИЦИЯ</span></p><h2 id="lumenStoryTitle">${escape(scene.title)}</h2>
    <div class="lumen-story-dialogue"><div class="lumen-story-speaker" id="lumenStorySpeaker"></div><button type="button" class="lumen-story-line" data-story-action="advance"><span id="lumenStoryText" aria-hidden="true"></span><span class="lumen-story-caret" aria-hidden="true">▾</span></button><p class="sr-only" id="lumenStoryAccessible" aria-live="polite" aria-atomic="true"></p></div>
    <div class="lumen-story-footer"><span id="lumenStoryCount"></span><span id="lumenStoryHint">Нажми, чтобы раскрыть реплику</span></div>
   </div><div class="lumen-story-loading" hidden><span class="lumen-story-kicker">ПОДГОТОВКА ЭКСПЕДИЦИИ</span><h2>Подождите…</h2><p id="lumenLoadPhase" role="status">Загружаем мир</p><div class="lumen-story-progress" role="progressbar" aria-label="Загрузка графики мира" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div><div class="lumen-story-load-meta"><strong id="lumenLoadPercent">0%</strong><span id="lumenLoadEta">Оцениваем время…</span></div><button type="button" data-story-action="retry" hidden>Повторить загрузку</button></div>
   <button type="button" class="lumen-story-back" data-story-action="cancel">${hold?'Вернуться в меню':'Закрыть · Esc'}</button></div>`;
  this.renderLine();this.root.querySelector('[data-story-action="advance"]').focus({preventScroll:true});
  return new Promise(resolve=>this.resolve=resolve);
 }
 renderLine(){
  cancelAnimationFrame(this.raf);const line=this.scene.lines[this.index],speaker=line.speaker==='hero'?this.hero:line.speaker;
  this.root.querySelector('#lumenStorySpeaker').textContent=speaker;
  this.root.querySelector('#lumenStoryAccessible').textContent=speaker+': '+line.text;
  this.root.querySelector('#lumenStoryCount').textContent=`${String(this.index+1).padStart(2,'0')} / ${String(this.scene.lines.length).padStart(2,'0')}`;
  this.letters=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter('ru',{granularity:'grapheme'}).segment(line.text)].map(part=>part.segment):Array.from(line.text);
  this.visible=this.media.matches?this.letters.length:0;this.paintText();let previous=performance.now(),elapsed=0;
  const tick=now=>{if(!this.active||this.root.dataset.phase!=='dialogue')return;if(!document.hidden)elapsed+=Math.min(60,now-previous);previous=now;if(!document.hidden){this.visible=Math.min(this.letters.length,Math.floor(elapsed/24));this.paintText();}if(this.visible<this.letters.length)this.raf=requestAnimationFrame(tick);};
  if(this.visible<this.letters.length)this.raf=requestAnimationFrame(tick);
 }
 paintText(){
  this.root.querySelector('#lumenStoryText').textContent=this.letters.slice(0,this.visible).join('');
  const typing=this.visible<this.letters.length;this.root.dataset.typing=String(typing);
  this.root.querySelector('#lumenStoryHint').textContent=typing?'Нажми, чтобы раскрыть реплику':'Нажми, чтобы продолжить';
  this.root.querySelector('[data-story-action="advance"]').setAttribute('aria-label',typing?'Раскрыть реплику целиком':'Следующая реплика');
 }
 advance(){
  if(!this.active||this.root.dataset.phase!=='dialogue')return;
  if(this.visible<this.letters.length){cancelAnimationFrame(this.raf);this.visible=this.letters.length;this.paintText();return;}
  if(++this.index<this.scene.lines.length)this.renderLine();else this.finish();
 }
 finish(){
  if(!this.active)return;const resolve=this.resolve;this.resolve=null;
  if(this.hold)this.loading();else this.close();resolve?.(true);
 }
 loading(){
  cancelAnimationFrame(this.raf);this.root.dataset.phase='loading';
  this.root.querySelector('.lumen-story-copy').hidden=true;this.root.querySelector('.lumen-story-loading').hidden=false;
  this.root.querySelector('[data-story-action="skip"]').hidden=true;
  this.root.querySelector('[data-story-action="cancel"]').focus({preventScroll:true});
  if(this.lastProgress)this.progress(this.lastProgress);
 }
 progress(value){
  this.lastProgress=value;if(!this.active)return;
  const phase=this.root.querySelector('#lumenLoadPhase');if(!phase||this.root.dataset.phase==='error')return;
  phase.textContent=value.phase==='manifest'?'Получаем список ресурсов':value.phase==='decode'?'Графика загружена. Подготавливаем мир':value.phase==='ready'?'Мир готов':'Загружаем графику мира';
  this.root.querySelector('#lumenLoadPercent').textContent=value.percent+'%';
  const meter=this.root.querySelector('[role="progressbar"]');meter.setAttribute('aria-valuenow',value.percent);meter.firstElementChild.style.width=value.percent+'%';
  this.root.querySelector('#lumenLoadEta').textContent=value.remainingSeconds===null?(value.phase==='ready'?'Готово':value.phase==='decode'?'Подготавливаем сцену…':'Оцениваем время…'):`Примерно ${value.remainingSeconds<60?value.remainingSeconds+' с':Math.ceil(value.remainingSeconds/60)+' мин'}`;
 }
 failure(retry){
  this.loading();this.root.dataset.phase='error';this.retry=retry;
  this.root.querySelector('.lumen-story-loading h2').textContent='Не удалось войти';
  this.root.querySelector('#lumenLoadEta').textContent='Можно повторить';
  this.root.querySelector('#lumenLoadPhase').textContent='Не удалось загрузить мир. Проверь соединение и попробуй ещё раз.';
  const button=this.root.querySelector('[data-story-action="retry"]');button.hidden=false;button.focus({preventScroll:true});
 }
 retrying(){this.root.querySelector('.lumen-story-loading h2').textContent='Подождите…';this.root.dataset.phase='loading';this.root.querySelector('[data-story-action="retry"]').hidden=true;this.retry=null;}
 cancel(){const resolve=this.resolve,onCancel=this.onCancel;this.resolve=null;this.close();if(resolve)resolve(false);else onCancel?.();}
 close(){
  cancelAnimationFrame(this.raf);this.root.hidden=true;this.inert?.forEach(([el,value])=>el.inert=value);this.inert=null;
  const resolve=this.resolve;this.resolve=null;resolve?.(false);this.previousFocus?.isConnected&&this.previousFocus.focus?.({preventScroll:true});
 }
}

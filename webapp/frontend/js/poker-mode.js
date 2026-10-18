"use strict";
const PokerMode = (() => {
  const streets={preflop:"Префлоп",flop:"Флоп",turn:"Тёрн",river:"Ривер",showdown:"Вскрытие"};
  let state=null,busy=false,error="",poll=null,epoch=0,hint=null,hintLoading=false,rulesOpen=false,previousCards=new Set(),lastPaintVersion=null,errorStatus=0,refreshing=false,focusTarget=null;
  let liveSocket=null,liveRoom=null,liveStatus="connecting",deadlineTimer=null;
  const active=()=>activeScreen==="poker-game";
  const fmt=n=>Number(n||0).toLocaleString("ru-RU");
  const pct=n=>(Number(n||0)*100).toFixed(1).replace(".",",")+"%";
  const icon=name=>PokerCards.icon(name);
  const button=(action,text,cls="secondary-button",disabled=false)=>`<button type="button" class="${cls}" data-poker-action="${action}" ${busy||disabled?"disabled":""}>${text}</button>`;
  async function api(path,body){
    const headers={"Content-Type":"application/json"};
    if(hasTelegramIdentity)headers["X-Init-Data"]=tg.initData;
    if(saved.poker?.token)headers["X-Poker-Token"]=saved.poker.token;
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
    try{
      const r=await fetch("/api/poker"+path,{method:body===undefined?"GET":"POST",headers,body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});
      const data=await r.json().catch(()=>({}));
      if(!r.ok){const e=new Error(typeof data.detail==="string"?data.detail:r.status===401?"Открой игру из Telegram, чтобы войти за стол.":"Не удалось выполнить действие. Обнови стол и попробуй ещё раз.");e.status=r.status;throw e;}
      return data;
    }catch(e){if(e.name==="AbortError"||e instanceof TypeError)throw new Error("Нет связи со столом. Партия сохранена на сервере. Повтори подключение.");throw e;}
    finally{clearTimeout(timeout);}
  }
  function remember(data){
    const next=data.state||data;
    if(state?.roomId===next.roomId&&next.version<state.version)return false;
    if(!state||next.version!==state.version)hint=null;
    state=next;error="";errorStatus=0;
    saved.poker={...saved.poker,roomId:state.roomId,mode:state.mode,code:state.code,token:data.token||saved.poker?.token,lastTouchedAt:Date.now()};saveState();
  }
  function renderSetup(){
    const run=saved.poker;
    $("#pokerSetupMount").innerHTML=`<div class="poker-intro"><div><p class="eyebrow">Вероятность. Решение. Твой ход.</p><h1 id="pokerSetupTitle">Математический<br>покер</h1><p class="page-intro">Настоящий холдем. Учись видеть за картами числа.</p></div><div class="poker-intro-deck" aria-hidden="true">${PokerCards.card("Ks",{deal:false})}${PokerCards.card("Qh",{deal:false})}</div></div><div class="poker-facts"><span>2 игрока</span><span>Блайнды 10 / 20</span><span>Виртуальные фишки</span></div>
    ${run?`<div class="poker-resume">${icon("cards")}<div><strong>Твой стол сохранён</strong><p>${run.mode==="solo"?"Партия с компьютером":"Комната "+escapeHtml(run.code||"")}</p></div>${button("resume","Продолжить","primary-button")}</div>`:""}
    <div class="poker-mode-grid"><article class="poker-mode-option"><span class="poker-mode-icon">${icon("math")}</span><p class="eyebrow">В своём темпе</p><h2>Против бота</h2><p>Изучай комбинации, сравнивай шансы и пробуй разные решения. Подсказка объяснит расчёт.</p><div class="poker-mode-foot"><span>По 1 000 фишек на старте</span>${button("solo",icon("cards")+"Играть с ботом","primary-button",!!run)}</div></article><article class="poker-mode-option"><span class="poker-mode-icon">${icon("chips")}</span><p class="eyebrow">Один на один</p><h2>С другом</h2><p>Создай стол и передай другу код комнаты. Карты и ходы синхронизируются через сервер.</p>${hasTelegramIdentity?`<div class="poker-mode-foot">${button("create",icon("chips")+"Создать комнату","primary-button",!!run)}<form id="pokerJoinForm"><label for="pokerRoomCode">Есть код комнаты?</label><div class="poker-join-row"><input id="pokerRoomCode" type="text" maxlength="6" minlength="6" pattern="[A-Za-z0-9]{6}" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Код комнаты" required><button type="submit" class="secondary-button" ${busy||run?"disabled":""}>Войти</button></div></form></div>`:`<p class="poker-telegram-note">Для игры с другом открой Развивайку через бота Telegram. В браузере можно играть с компьютером.</p>`}</article></div><div class="poker-learning-note">${icon("math")}<p><strong>Математика помогает выбирать.</strong> Equity, шансы банка и ожидаемая ценность — в подсказках за столом. Удача влияет на отдельную раздачу; гарантированной победы нет.</p></div><div role="alert" class="poker-error${error?"":" hidden"}">${escapeHtml(error)}</div>`;
  }
  async function start(kind,code){
    if(busy||saved.poker)return;
    let entered=false;const startEpoch=epoch;busy=true;error="";renderSetup();
    try{const data=await api(kind==="solo"?"/solo":kind==="create"?"/rooms":"/rooms/join",kind==="solo"?{name:profile.displayName||"Игрок"}:kind==="create"?{}:{code});remember(data);previousCards.clear();busy=false;if(epoch===startEpoch&&activeScreen==="poker"){showScreen("poker-game");entered=true;}else if(activeScreen==="home")renderHome();}
    catch(e){error=e.message;}
    finally{busy=false;if(activeScreen==="poker")renderSetup();else if(active()&&!entered)render();schedulePoll();}
  }
  function schedulePoll(){
    clearTimeout(poll);if(!active()||document.hidden||!saved.poker)return;
    const roomId=saved.poker.roomId;if(liveSocket&&liveRoom===roomId)return;
    liveSocket?.close();liveRoom=roomId;
    liveSocket=Platform.socket({roomId,token:saved.poker.token,onState:data=>{if(!active()||saved.poker?.roomId!==roomId)return;if(remember(data)!==false)render();},onStatus:(status,message)=>{liveStatus=status;const el=$("#pokerLiveStatus");if(el)el.textContent=status==="connected"?"Связь со столом установлена":status==="error"?message:"Восстанавливаем связь со столом…";}});
  }
  async function refresh(){
    if(!saved.poker||busy||refreshing){schedulePoll();return;}
    const currentEpoch=epoch,roomId=saved.poker.roomId;refreshing=true;
    try{const data=await api("/rooms/"+encodeURIComponent(roomId));if(currentEpoch!==epoch||!active()||saved.poker?.roomId!==roomId)return;if(state?.roomId===roomId&&data.version<state.version)return;if(!state||state.version!==data.version||error){remember(data);render();}}
    catch(e){if(currentEpoch===epoch&&active()){error=e.message;errorStatus=e.status||0;renderError();}}
    finally{refreshing=false;schedulePoll();}
  }
  async function resume(){if(busy||!saved.poker)return;state=null;hint=null;error="";previousCards.clear();showScreen("poker-game");await refresh();}
  function renderError(){const el=$("#pokerConnectionError");if(el){el.classList.toggle("hidden",!error);el.innerHTML=error?`<p>${escapeHtml(error)}</p>${button("retry","Повторить подключение")}${[401,403,404].includes(errorStatus)?button("clear","Убрать недоступный стол"):""}`:"";}}
  function seat(p){
    if(!p)return "";
    return `<div class="poker-seat${state.turnIndex===p.seat&&state.phase==="playing"?" has-turn":""}${state.result?.winners?.some(w=>w.seat===p.seat)?" won":""}"><span class="poker-avatar" aria-hidden="true">${p.isBot?"Т":escapeHtml([...(p.name||"И")][0])}</span><div><strong>${escapeHtml(p.name)}${p.isYou?" · ты":""}</strong><span>${fmt(p.stack)} фишек${p.allIn?" · олл-ин":p.folded?" · пас":""}</span></div>${state.dealerIndex===p.seat?'<abbr class="poker-dealer" title="Дилер · малый блайнд">D</abbr>':""}</div>`;
  }
  function card(code,key,index,winner=false){return PokerCards.card(code||"As",{hidden:!code,index,winner,deal:!previousCards.has(key),reveal:!!code&&!previousCards.has(key)});}
  function hand(p){if(!p)return "";const win=state.result?.winners?.find(w=>w.seat===p.seat);return(p.hole||[null,null]).map((c,i)=>card(c,`${state.handNumber}-${p.seat}-${c||"hidden"}-${i}`,i,!!win&&win.hand?.includes(c))).join("");}
  function controls(){
    const s=state,legal=s.legalActions||[],me=s.players.find(p=>p.isYou),isTurn=s.phase==="playing"&&s.turnIndex===me?.seat;
    if(s.phase==="waiting")return `<div class="poker-wait"><strong>Ждём второго игрока</strong><p>Друг входит в «С другом» и вводит этот код.</p><div class="poker-code-row"><strong class="poker-room-code">${escapeHtml(s.code)}</strong>${button("copy","Копировать код")}</div><p>Стол обновляется автоматически.</p></div>`;
    if(s.phase==="closed")return `<div class="poker-wait"><strong>Стол закрыт</strong><p>Игрок покинул комнату. Можно начать новую партию.</p>${button("clear","К выбору режима","primary-button")}</div>`;
    if(s.phase==="complete"||s.phase==="finished")return `<div class="poker-result" role="status"><span class="eyebrow">${s.phase==="finished"?"Матч завершён":"Раздача завершена"}</span><h2>${escapeHtml(s.result?.message||"Результат раздачи")}</h2>${s.result?.winners?.map(w=>`<p>${escapeHtml(s.players.find(p=>p.seat===w.seat)?.name||"Игрок")}: ${escapeHtml(w.handName||"")} · банк ${fmt(w.amount)}</p>`).join("")||""}${legal.includes("next")?button("next",icon("shuffle")+"Следующая раздача","primary-button"):s.phase==="complete"?'<p>Ты готов. Ждём подтверждения соперника.</p>':button("leave","Завершить стол","primary-button")}</div>`;
    return `<div class="poker-action-status" role="status"><span class="${isTurn?"poker-your-turn":""}">${busy?"Сохраняем ход…":isTurn?"Твой ход":"Ход соперника"}</span><span>${isTurn?(s.toCall?"Колл: "+fmt(s.toCall):"Можно сыграть чек"):""}</span></div><div class="poker-actions">${button("fold","Пас","poker-fold",!legal.includes("fold"))}${button(legal.includes("call")?"call":"check",legal.includes("call")?"Колл "+fmt(s.toCall):"Чек","primary-button",!legal.includes("call")&&!legal.includes("check"))}</div>${legal.includes("raise")?`<form id="pokerRaiseForm" class="poker-raise-form"><label for="pokerRaiseAmount">${s.currentBet?"Повысить до":"Ставка"}<span>${fmt(s.minRaiseTo)}–${fmt(s.maxRaiseTo)}</span></label><div class="poker-raise-row"><input id="pokerRaiseAmount" type="number" inputmode="numeric" min="${s.minRaiseTo}" max="${s.maxRaiseTo}" step="1" value="${s.minRaiseTo}" required><button type="submit" class="secondary-button" ${busy?"disabled":""}>${s.currentBet?"Рейз":"Ставка"}</button>${button("allin","Олл-ин")}</div><small>Сумма включает уже поставленные тобой фишки этой улицы.</small></form>`:""}`;
  }
  function mathPanel(){
    const h=hint;
    return `<aside class="poker-math-panel${hintLoading?" is-calculating":""}"><div class="poker-math-heading">${icon("math")}<div><p class="eyebrow">Твой математический помощник</p><h2>За картами — числа</h2></div></div><p>Сравни свою долю банка с ценой следующего хода.</p>${h?`${h.handName?`<p class="poker-current-hand">Твоя комбинация: <strong>${escapeHtml(h.handName)}</strong></p>`:""}<div class="poker-math-stats"><div><span>Equity</span><strong>${pct(h.equity)}</strong><small>Против случайной руки</small></div><div><span>Порог колла</span><strong>${pct(h.potOdds)}</strong><small>${fmt(h.toCall)} / (${fmt(h.pot)} + ${fmt(h.toCall)})</small></div></div><div class="poker-equity-track" aria-hidden="true"><span style="width:${Math.round(h.equity*100)}%"></span><i style="left:${Math.min(99,h.potOdds*100)}%"></i></div><p class="poker-ev">${h.toCall?"EV колла":"EV чека"} <strong>${h.callEV>=0?"+":""}${Number(h.callEV).toFixed(1)} фишек</strong></p><p class="poker-hint-explanation">${escapeHtml(h.text)}</p><p class="poker-math-assumptions">Монте-Карло · ${fmt(h.samples)} симуляций. Только твои и общие карты, без знания руки соперника. EV не учитывает будущие ставки и фолды.</p>`:`<div class="poker-math-placeholder"><span>01</span><p><strong>Оцени equity</strong>Доля банка, которую твоя рука получает в среднем, включая ничьи.</p><span>02</span><p><strong>Сравни цену</strong>Порог колла = колл / (банк + колл).</p><span>03</span><p><strong>Выбери ход</strong>Положительное EV помогает оценить колл при указанных допущениях.</p></div>`}${state.phase==="playing"?button("hint",icon("math")+(hintLoading?"Считаем вероятности…":h?"Пересчитать подсказку":"Рассчитать мой ход"),"secondary-button",hintLoading):""}<p class="poker-math-disclaimer">Одна раздача может пойти иначе. Эти числа учат принимать решения, а не предсказывают следующую карту.</p></aside>`;
  }
  function render(){
    const mount=$("#pokerMount");if(!mount)return;const scrollTop=$("#main").scrollTop;
    if(!state){mount.innerHTML='<div class="poker-loading" role="status">Восстанавливаем твой стол…</div><div id="pokerConnectionError" class="poker-error hidden" role="alert"></div>';renderError();return;}
    mount.dataset.version=state.version;
    const s=state,me=s.players.find(p=>p.isYou),op=s.players.find(p=>!p.isYou);
    const focusedElement=document.activeElement;
    if(mount.contains(focusedElement)){
      const action=focusedElement.closest("[data-poker-action]")?.dataset.pokerAction;
      if(action||focusedElement.id)focusTarget={action,id:focusedElement.id};
    }
    mount.innerHTML=`<p class="poker-live-status" id="pokerLiveStatus" role="status">${liveStatus==="connected"?"Связь со столом установлена":"Подключаем стол…"}</p><div class="poker-table-meta"><span>${s.mode==="solo"?"Против компьютера":"Комната "+escapeHtml(s.code)}</span><span>Раздача ${s.handNumber} · 10 / 20</span></div><div id="pokerConnectionError" class="poker-error hidden" role="alert"></div><div class="poker-play-layout"><div class="poker-play-main"><div class="poker-table" aria-label="Покерный стол"><div class="poker-table-top">${seat(op)||'<span class="poker-empty-seat">Место для друга</span>'}<div class="poker-opponent-hand">${op?hand(op):PokerCards.back({deal:false})+PokerCards.back({deal:false})}</div>${op?.bet?`<span class="poker-bet${lastPaintVersion!==s.version?" is-paid":""}">${icon("chips")}${fmt(op.bet)}</span>`:""}</div><div class="poker-board-area"><p class="poker-street-label">${s.phase==="waiting"?"Стол готов":streets[s.street]||"Холдем"}</p><div class="poker-pot">${icon("chips")}<span>Банк <strong>${fmt(s.result?.pot||s.pot)}</strong></span></div><div class="poker-board" aria-label="Общие карты">${Array.from({length:5},(_,i)=>s.board[i]?card(s.board[i],`${s.handNumber}-board-${s.board[i]}`,i,s.result?.winners?.some(w=>w.hand?.includes(s.board[i]))):'<span class="poker-card-slot" aria-label="Общая карта ещё не открыта"><span>Т</span></span>').join("")}</div><span class="poker-felt-brand" aria-hidden="true">TERAMONT · HOLD’EM</span></div><div class="poker-table-bottom">${me?.bet?`<span class="poker-bet${lastPaintVersion!==s.version?" is-paid":""}">${icon("chips")}${fmt(me.bet)}</span>`:""}<div class="poker-own-hand">${hand(me)}</div>${seat(me)}</div></div><div class="poker-controls">${controls()}${s.turnDeadline?'<p class="poker-turn-deadline" id="pokerTurnDeadline"></p>':""}</div><details class="poker-hand-log"><summary>История раздачи</summary><ol>${(s.log||[]).map(line=>`<li>${escapeHtml(line)}</li>`).join("")}</ol></details></div><div id="pokerMathMount">${mathPanel()}</div></div><details class="poker-rules" id="pokerRules" ${rulesOpen?"open":""}><summary>Правила и комбинации</summary><p>Техасский холдем один на один. У каждого две закрытые карты; на стол выходят флоп (три), тёрн и ривер. Собери лучшую комбинацию из пяти любых карт среди семи доступных. Дилер ставит малый блайнд и ходит первым до флопа, после флопа первым ходит второй игрок. Безлимитные ставки, минимум повышения равен предыдущему полному повышению; короткий олл-ин не открывает повторное повышение.</p><p>От сильной к слабой: стрит-флеш (старший — роял-флеш), каре, фулл-хаус, флеш, стрит, тройка, две пары, пара, старшая карта. Туз может начинать стрит A–2–3–4–5. Масти равны. При равных комбинациях банк делится. Непокрытая часть ставки возвращается.</p><p>Чек — пропустить без ставки; колл — уравнять; рейз — повысить общую ставку этой улицы; пас — отдать банк, не показывая карты. Следующую раздачу подтверждают оба игрока. Стол сохраняется на сервере; выход через «Игры» оставляет партию. «Завершить стол» закрывает комнату для обоих. Все фишки виртуальные, без денежной стоимости.</p></details><div class="poker-table-footer"><span>${s.mode==="online"?"Без денег · 2 минуты на ход":"Без денег · в своём темпе"}</span>${s.phase!=="closed"?button("leave","Завершить стол","text-button"):""}</div>`;
    clearInterval(deadlineTimer);
    const deadline=()=>{const el=$("#pokerTurnDeadline");if(el&&s.turnDeadline){const seconds=Math.max(0,Math.ceil(s.turnDeadline-Date.now()/1000));el.textContent="До автоматического паса: "+Math.floor(seconds/60)+":"+String(seconds%60).padStart(2,"0");}};
    deadline();if(s.turnDeadline)deadlineTimer=setInterval(deadline,1000);
    lastPaintVersion=s.version;
    s.players.forEach(p=>(p.hole||[null,null]).forEach((c,i)=>previousCards.add(`${s.handNumber}-${p.seat}-${c||"hidden"}-${i}`)));
    s.board.forEach(c=>previousCards.add(`${s.handNumber}-board-${c}`));
    if(focusTarget&&!busy&&!hintLoading){
      const current=document.activeElement;
      if(current===document.body||mount.contains(current)){
        const next=(focusTarget.id?mount.querySelector("#"+focusTarget.id):null)||mount.querySelector(`[data-poker-action="${focusTarget.action}"]:not(:disabled)`)||mount.querySelector(".poker-actions .primary-button:not(:disabled),.poker-result button:not(:disabled)");
        next?.focus({preventScroll:true});
      }
      focusTarget=null;
    }
    renderError();$("#main").scrollTop=scrollTop;
  }
  async function act(action,amount){
    if(busy||!state)return;
    if(action==="leave"&&state.phase!=="finished"&&!confirm("Завершить стол? Текущая раздача будет завершена, а комната закроется для обоих игроков."))return;
    const currentEpoch=epoch,roomId=state.roomId,handNumber=state.handNumber,version=state.version;
    busy=true;error="";render();
    const perform=v=>api("/rooms/"+encodeURIComponent(roomId)+"/action",{action,version:v,...(amount===undefined?{}:{amount})});
    try{
      let data;
      try{data=await perform(version);}
      catch(e){
        if(e.status!==409)throw e;
        const latest=await api("/rooms/"+encodeURIComponent(roomId));
        if(saved.poker?.roomId!==roomId)return;
        remember(latest);
        // Readiness is commutative within one resolved hand; wagers are never replayed.
        if(action==="next"&&latest.handNumber===handNumber&&latest.phase==="complete"&&latest.legalActions.includes("next"))data=await perform(latest.version);
        else{error=e.message;return;}
      }
      if(saved.poker?.roomId!==roomId)return;
      remember(data);
      if(action==="leave"){saved.poker=null;state=null;saveState();if(epoch===currentEpoch&&active())showScreen("poker");}
    }catch(e){error=e.message;}
    finally{busy=false;if(active())render();else if(activeScreen==="poker")renderSetup();else if(activeScreen==="home")renderHome();schedulePoll();}
  }
  async function getHint(){
    if(!state||hintLoading||busy)return;
    hintLoading=true;const version=state.version,roomId=state.roomId;render();
    try{const data=await api("/rooms/"+encodeURIComponent(roomId)+"/hint");if(active()&&state?.roomId===roomId&&state.version===version&&data.version===version){hint=data;error="";}}
    catch(e){error=e.message;}
    finally{hintLoading=false;if(active())render();}
  }
  function onScreen(name){epoch++;clearTimeout(poll);liveSocket?.close();liveSocket=null;liveRoom=null;clearInterval(deadlineTimer);if(name==="poker")renderSetup();if(name==="poker-game"){if(!state||state.roomId!==saved.poker?.roomId)state=null;render();schedulePoll();}}
  function click(target){
    const a=target.dataset.pokerAction;if(!a)return false;
    if(a==="setup")showScreen("poker");
    else if(a==="solo"||a==="create")start(a);
    else if(a==="resume")resume();
    else if(a==="retry")refresh();
    else if(a==="hint")getHint();
    else if(a==="rules"){$("#pokerRules").open=!$("#pokerRules").open;$("#pokerRules").scrollIntoView({block:"nearest"});}
    else if(a==="allin")act("raise",state.maxRaiseTo);
    else if(a==="copy"){if(navigator.clipboard?.writeText)navigator.clipboard.writeText(state.code).then(()=>showToast("Код комнаты скопирован.")).catch(()=>showToast("Не удалось скопировать. Код можно выделить вручную."));else showToast("Выдели и скопируй код комнаты вручную.");}
    else if(a==="clear"){saved.poker=null;state=null;saveState();showScreen("poker");}
    else act(a);
    return true;
  }
  document.addEventListener("submit",event=>{if(event.target.id==="pokerJoinForm"){event.preventDefault();start("join",$("#pokerRoomCode").value.trim().toUpperCase());}if(event.target.id==="pokerRaiseForm"){event.preventDefault();if(event.target.reportValidity())act("raise",Number($("#pokerRaiseAmount").value));}});
  document.addEventListener("toggle",event=>{if(event.target.id==="pokerRules")rulesOpen=event.target.open;},true);
  document.addEventListener("visibilitychange",()=>{if(document.hidden)clearTimeout(poll);else if(active())refresh();});
  window.addEventListener("pagehide",()=>{epoch++;clearTimeout(poll);});
  function getResume(){return saved.poker?{type:"poker",lastTouchedAt:saved.poker.lastTouchedAt,mode:saved.poker.mode}:null;}
  return {onScreen,click,resume,getResume};
})();

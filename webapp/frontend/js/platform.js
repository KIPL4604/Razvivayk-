"use strict";

const Platform = (() => {
  let enabled=false,hydrating=false,suppress=false,cloudTimer=null,saving=false,cloudError="",cloudConflicts=new Map(),pendingHydrate=false;
  let lobby=null,lobbyError="",lobbyBusy=false,lobbyTimer=null,lobbySocket=null,awaitingMatch=false;
  const sockets=new Set();
  const clone=value=>JSON.parse(JSON.stringify(value));
  async function request(path,{method="GET",body}={}){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch("/api/platform"+path,{method,headers:{"Content-Type":"application/json","X-Init-Data":tg?.initData||""},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal,cache:"no-store"});
      const data=await response.json().catch(()=>({}));
      if(!response.ok){const error=new Error(typeof data.detail==="string"?data.detail:data.detail?.message||"Не удалось связаться с платформой.");error.status=response.status;error.detail=data.detail;throw error;}
      return data;
    }catch(error){if(error.name==="AbortError")throw new Error("Сервер не ответил. Изменения остаются на устройстве.");throw error;}
    finally{clearTimeout(timer);}
  }
  function socket({roomId,token,onState,onStatus,onEvent}){
    let ws=null,stopped=false,reconnect=null,heartbeat=null,attempt=0;
    const close=()=>{clearTimeout(reconnect);clearInterval(heartbeat);if(ws){ws.onclose=null;ws.close();ws=null;}};
    const connect=()=>{
      if(stopped||document.hidden)return;
      onStatus?.("connecting");
      ws=new WebSocket((location.protocol==="https:"?"wss://":"ws://")+location.host+"/api/platform/ws");
      ws.onopen=()=>ws.send(JSON.stringify({type:"auth",initData:hasTelegramIdentity?tg.initData:undefined,token,roomId}));
      ws.onmessage=event=>{
        let data;try{data=JSON.parse(event.data);}catch(_){return;}
        if(data.type==="ready"){attempt=0;onStatus?.("connected");clearInterval(heartbeat);heartbeat=setInterval(()=>{if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:"ping"}));},20000);}
        if(data.type==="poker.state")onState?.(data.state);
        if(data.type==="error")onStatus?.("error",data.message||"Подключение отклонено");
        onEvent?.(data);
      };
      ws.onclose=event=>{
        clearInterval(heartbeat);ws=null;if(stopped)return;
        if([4401,4403,4404,1008].includes(event.code)){onStatus?.("error","Нужно повторно открыть игру из Telegram или проверить доступ к комнате.");return;}
        onStatus?.("reconnecting");clearTimeout(reconnect);reconnect=setTimeout(connect,Math.min(15000,500*2**Math.min(attempt++,5)));
      };
      ws.onerror=()=>{};
    };
    const handle={close(){stopped=true;close();sockets.delete(handle);},suspend(){close();},resume(){if(!stopped&&!ws){clearTimeout(reconnect);connect();}}};
    sockets.add(handle);connect();return handle;
  }
  function localRecord(game){
    const run=game==="chess"?saved.chess:saved.runs[game];if(!run)return null;
    const state={run:clone(run)};
    // Volatile timers and UI requests do not belong in the portable save.
    state.run.startedAt=null;delete state.run.syncPending;delete state.run.syncError;
    if(state.run.result)state.run.result={xpAwarded:state.run.result.xpAwarded,newAchievements:state.run.result.newAchievements||[],alreadyCompleted:state.run.result.alreadyCompleted};
    if(game==="chess"){state.stats=clone({wins:0,losses:0,draws:0,...saved.chessStats});state.preferences=clone(saved.chessPreferences||{});}
    return state;
  }
  function signature(state){return state?JSON.stringify(state):"";}
  function storeMeta(){suppress=true;saveState();suppress=false;}
  function applyRemote(game,record){
    const run=clone(record.state.run);run.startedAt=null;run.syncPending=false;
    if(game==="chess"){ChessMode.invalidateCloud?.();saved.chess=run;saved.chessStats={wins:0,losses:0,draws:0,...record.state.stats};saved.chessPreferences=record.state.preferences||{};}
    else{saved.runs[game]=run;if(saved.current?.type===game)saved.current=run;if(run.completed&&run.sessionId&&!run.result&&!saved.pending.some(item=>item.sessionId===run.sessionId))saved.pending.push(run);}
    saved.cloud[game]={revision:record.revision,signature:signature(record.state)};storeMeta();
  }
  function cloudStatus(){
    const mount=$("#cloudStatus");if(!mount)return;mount.classList.toggle("hidden",!enabled);mount.classList.toggle("is-error",!!cloudError);
    if(!enabled)return;
    const game=cloudConflicts.keys().next().value;mount.classList.toggle("has-conflict",!!game);
    if(game){mount.innerHTML=`<div class="cloud-conflict"><p><strong>${escapeHtml(game==="chess"?"Шахматы":GAME_NAMES[game])}: есть сохранение с другого устройства.</strong><br>Выбери версию партии. Текущее поле останется на устройстве до выбора.</p><div class="cloud-actions"><button type="button" class="text-button" data-cloud-choice="remote" data-cloud-game="${game}">Загрузить с сервера</button><button type="button" class="text-button" data-cloud-choice="local" data-cloud-game="${game}">Сохранить эту версию</button></div></div>`;return;}
    mount.innerHTML=cloudError?`<span>${escapeHtml(cloudError)}</span><button class="text-button" data-cloud-retry type="button">Повторить запись</button>`:`<span>${hydrating?"Проверяем облачные сохранения…":saving?"Сохраняем партию…":"Партии синхронизируются с аккаунтом Telegram"}</span>`;
  }
  function changed(){if(!enabled||suppress||hydrating)return;clearTimeout(cloudTimer);cloudTimer=setTimeout(flush,700);}
  async function hydrate(){
    if(saving){pendingHydrate=true;return;}if(!enabled||hydrating)return;hydrating=true;cloudStatus();saved.cloud||={};
    try{
      const data=await request("/saves");
      for(const [game,record] of Object.entries(data.saves||{})){
        if(!(GAME_NAMES[game]||game==="chess")||!record.state?.run)continue;
        const local=localRecord(game),meta=saved.cloud[game],localSig=signature(local);
        if(record.revision===meta?.revision)continue;
        if(!local||localSig===signature(record.state)){applyRemote(game,record);continue;}
        const playing=(activeScreen==="game"&&saved.current?.type===game)||(activeScreen==="chess-game"&&game==="chess");
        if(meta&&localSig===meta.signature&&!playing)applyRemote(game,record);
        else cloudConflicts.set(game,record);
      }
      cloudError="";renderHome();
    }catch(error){cloudError=error.message;}
    finally{hydrating=false;cloudStatus();changed();}
  }
  async function flush(){
    clearTimeout(cloudTimer);if(!enabled||hydrating||saving)return;saving=true;cloudStatus();
    let retryChanges=false;
    try{
      for(const game of [...GAME_ORDER,"chess"]){
        if(cloudConflicts.has(game))continue;
        const state=localRecord(game),meta=saved.cloud[game]||{},sig=signature(state);if(!state||sig===meta.signature)continue;
        try{
          const data=await request("/saves/"+game,{method:"PUT",body:{revision:meta.revision||0,state}});
          saved.cloud[game]={revision:data.revision,signature:sig};storeMeta();
          if(signature(localRecord(game))!==sig)retryChanges=true;
        }catch(error){if(error.status===409&&error.detail?.save)cloudConflicts.set(game,error.detail.save);else throw error;}
      }
      cloudError="";
    }catch(error){cloudError=error.message;}
    finally{saving=false;cloudStatus();if(pendingHydrate){pendingHydrate=false;hydrate();}else if(retryChanges)changed();}
  }
  async function chooseCloud(game,choice){
    const remote=cloudConflicts.get(game);if(!remote)return;
    if(choice==="remote"){
      pauseGame();applyRemote(game,remote);cloudConflicts.delete(game);cloudStatus();renderHome();
      if(game==="chess"&&activeScreen==="chess-game")await ChessMode.resume();
      else if(activeScreen==="game"&&saved.current?.type===game){if(saved.current.completed){if(!saved.current.result)await syncCompletedGame(saved.current);else renderSuccess();}else resumeGame(game);}
    }else{saved.cloud[game]={revision:remote.revision,signature:""};cloudConflicts.delete(game);storeMeta();await flush();}
  }
  function renderLobby(){
    const mount=$("#lobbyMount");if(!mount)return;
    if(!hasTelegramIdentity){mount.innerHTML='<div class="lobby-notice"><strong>Встречаемся в Telegram</strong><p>Для игры с другим человеком открой Развивайку через бота. В браузере доступны головоломки и компьютерные соперники.</p><button class="primary-button" type="button" data-screen-link="poker">Играть с компьютером</button></div>';return;}
    const queue=lobby?.matchmaking||{},finding=queue.status==="waiting"||queue.status==="searching",rooms=lobby?.rooms||[];
    mount.innerHTML=`<div class="lobby-launch"><div><h2>Найти соперника</h2><p>${finding?'<span class="lobby-find-status">Ищем игрока для покера…</span><br>Поиск действует две минуты. Ты можешь отменить его.':"Техасский холдем. Два игрока, равные стартовые стеки и математические подсказки."}</p></div><button type="button" class="${finding?"secondary-button":"primary-button"}" data-lobby-action="${finding?"cancel":"find"}" ${lobbyBusy?"disabled":""}>${lobbyBusy?"Подключаем…":finding?"Отменить поиск":"Найти соперника"}</button></div>
      <div class="lobby-friends"><div><h2>Пригласить друга</h2><p>Создай стол и передай шестизначный код. Комната ждёт второго игрока десять минут.</p><button type="button" class="secondary-button" data-lobby-action="create" ${lobbyBusy?"disabled":""}>Создать комнату</button></div><form id="lobbyJoinForm"><h2>Войти по приглашению</h2><label class="answer-label" for="lobbyCode">Код комнаты</label><div class="lobby-code-row"><input id="lobbyCode" minlength="6" maxlength="6" pattern="[A-Za-z0-9]{6}" autocomplete="off" autocapitalize="characters" placeholder="ABC123" required><button type="submit" class="secondary-button" ${lobbyBusy?"disabled":""}>Войти</button></div></form></div>
      ${lobbyError?`<p class="lobby-error" role="alert">${escapeHtml(lobbyError)}</p><button class="text-button" type="button" data-lobby-action="refresh">Обновить лобби</button>`:""}
      <div class="lobby-rooms"><h2>Твои столы</h2>${!lobby&&!lobbyError?'<p class="lobby-empty">Загружаем комнаты…</p>':rooms.length?rooms.map(room=>`<div class="lobby-room"><div><strong>Покер · ${escapeHtml(room.code)}</strong><p>${room.phase==="waiting"?"Ждём друга":room.phase==="playing"?"Партия идёт":room.phase==="closed"?"Стол закрыт":"Раздача завершена"}${room.players?.find(p=>!p.isYou)?.name?" · "+escapeHtml(room.players.find(p=>!p.isYou).name):""}</p></div><button type="button" class="secondary-button" data-lobby-room="${escapeHtml(room.roomId)}">К столу</button></div>`).join(""):'<p class="lobby-empty">Пока нет открытых столов. Найди соперника или пригласи друга.</p>'}</div><p class="game-note">Онлайн сейчас доступен в покере. На ход — две минуты; при истечении времени сервер выполнит пас. После обрыва связи можно вернуться в сохранённый стол.</p>`;
  }
  async function refreshLobby(){
    if(!hasTelegramIdentity)return;
    try{lobby=await request("/lobby");lobbyError="";if(activeScreen==="lobby")renderLobby();
      if(["waiting","searching"].includes(lobby.matchmaking?.status))awaitingMatch=true;
      if(awaitingMatch&&lobby.matchmaking?.roomId&&["matched","playing"].includes(lobby.matchmaking.status)&&activeScreen==="lobby"){awaitingMatch=false;openRoom(lobby.matchmaking.roomId);}
    }catch(error){lobbyError=error.message;if(activeScreen==="lobby")renderLobby();}
  }
  async function lobbyAction(action,code){
    if(lobbyBusy)return;lobbyBusy=true;lobbyError="";renderLobby();
    try{
      if(action==="find"){awaitingMatch=true;await request("/matchmaking",{method:"POST",body:{game:"poker"}});}
      else if(action==="cancel"){awaitingMatch=false;await request("/matchmaking",{method:"DELETE"});}
      else if(action==="create"||action==="join"){
        const data=await apiRequest("/api/poker/rooms"+(action==="join"?"/join":""),action==="join"?{code}:{});openRoom(data.roomId);return;
      }
      await refreshLobby();
    }catch(error){lobbyError=error.message;}
    finally{lobbyBusy=false;if(activeScreen==="lobby")renderLobby();}
  }
  function openRoom(roomId){saved.poker={roomId,mode:"online",lastTouchedAt:Date.now()};saveState();PokerMode.resume();}
  function onScreen(name){if(name!=="lobby"){clearInterval(lobbyTimer);lobbyTimer=null;return;}renderLobby();refreshLobby();clearInterval(lobbyTimer);lobbyTimer=setInterval(refreshLobby,30000);}
  function init(){
    enabled=hasTelegramIdentity;saved.cloud||={};cloudStatus();if(!enabled)return Promise.resolve();
    lobbySocket?.close();lobbySocket=socket({onEvent:data=>{if(data.type==="lobby.changed")refreshLobby();if(data.type==="resync"||(data.type==="cloud.changed"&&data.revision>Number(saved.cloud[data.game]?.revision||0)))hydrate();},onStatus:status=>{if(status==="connected"){hydrate();if(activeScreen==="lobby")refreshLobby();}}});
    return hydrate();
  }
  document.addEventListener("click",event=>{const target=event.target.closest("button");if(!target)return;if(target.hasAttribute("data-cloud-retry")){hydrate().then(flush);return;}if(target.dataset.cloudChoice){chooseCloud(target.dataset.cloudGame,target.dataset.cloudChoice);return;}if(target.dataset.lobbyRoom){openRoom(target.dataset.lobbyRoom);return;}if(target.dataset.lobbyAction)lobbyAction(target.dataset.lobbyAction);});
  document.addEventListener("submit",event=>{if(event.target.id==="lobbyJoinForm"){event.preventDefault();lobbyAction("join",$("#lobbyCode").value.trim().toUpperCase());}});
  document.addEventListener("visibilitychange",()=>{for(const handle of sockets)document.hidden?handle.suspend():handle.resume();if(!document.hidden&&enabled)hydrate();});
  window.addEventListener("pagehide",()=>{for(const handle of [...sockets])handle.close();});
  window.addEventListener("pageshow",event=>{if(event.persisted)init();});
  return {init,changed,onScreen,socket,request,flush,refreshLobby};
})();

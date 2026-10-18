"use strict";

const CHESS_LEVELS = [
  {id:"beginner",label:"Начальный",name:"Новичок",description:"Часто ошибается. Подойдёт для первых партий и знакомства с правилами.",skill:0,depth:2,time:120,random:.55},
  {id:"casual",label:"Легко",name:"Любитель",description:"Замечает взятия, но оставляет возможности для твоих комбинаций.",skill:2,depth:5,time:250,random:.12},
  {id:"club",label:"Средне",name:"Клубный игрок",description:"Следит за защитой фигур и находит простые тактические идеи.",skill:7,depth:8,time:500,random:0},
  {id:"expert",label:"Сложно",name:"Эксперт",description:"Просчитывает комбинации. За незащищённые фигуры придётся отвечать.",skill:13,depth:12,time:1000,random:0},
  {id:"master",label:"Очень сложно",name:"Мастер",description:"Точная игра и глубокий расчёт. Потребует внимательности в каждом ходе.",skill:18,depth:16,time:1800,random:0},
  {id:"grandmaster",label:"Ультрасложно",name:"Гроссмейстер",description:"Максимальная сила в этой игре. Серьёзное испытание без намеренных ошибок.",skill:20,depth:20,time:3000,random:0}
];

const ChessMode = (() => {
  const names={p:"пешка",n:"конь",b:"слон",r:"ладья",q:"ферзь",k:"король"};
  let library, game, restoredId, worker, generation=0;
  let selected=null, flipped=false, thinking=false, loading=false, ready=false, startingMatch=false, error="";
  let promotion=null, boardFocus="e2",downloadProgress=null;
  const currentLevel=()=>CHESS_LEVELS.find(l=>l.id===saved.chess?.level)||CHESS_LEVELS[1];
  const isActive=()=>activeScreen==="chess-game";
  const loadLibrary=()=>library||(library=import("/static/vendor/chess/chess.mjs").catch(e=>{library=null;throw e;}));
  const asUci=m=>m.from+m.to+(m.promotion||"");
  const newAbort=()=>Object.assign(new Error("Поиск остановлен"),{name:"AbortError"});

  class Opponent {
    constructor(onProgress){
      this.search=null;
      this.engine=new Worker("/static/vendor/stockfish/stockfish-19-lite-single.js");
      this.initialized=new Promise((resolve,reject)=>{
        this.rejectInit=reject;
        this.timeout=setTimeout(()=>this.fail(new Error("Загрузка соперника заняла слишком много времени.")),45000);
        this.engine.onmessage=event=>{
          for(const line of String(event.data).split("\n")){
            if(line.trim()==="uciok"){
              this.send("setoption name Hash value 16");
              this.send("setoption name UCI_LimitStrength value false");
              this.send("ucinewgame");
              this.send("isready");
            }
            if(line.trim()==="readyok"){clearTimeout(this.timeout);resolve();}
            if(line.startsWith("bestmove ")&&this.search){
              const pending=this.search;this.search=null;clearTimeout(pending.timeout);
              pending.resolve(line.split(/\s+/)[1]);
            }
          }
        };
        this.engine.onerror=()=>this.fail(new Error("Не удалось запустить шахматный движок."));
        this.engine.onmessageerror=()=>this.fail(new Error("Потеряна связь с соперником."));
      });
      if(typeof MessageChannel!=="undefined"){
        this.channel=new MessageChannel();
        this.channel.port1.onmessage=event=>{
          const percent=Number(event.data?.percent);
          if(Number.isFinite(percent))onProgress(Math.max(0,Math.min(100,Math.round(percent*100))));
        };
        this.engine.postMessage({progressPort:this.channel.port2},[this.channel.port2]);
      }
      this.send("uci");
    }
    send(command){this.engine.postMessage(command);}
    async choose(moves,level){
      await this.initialized;
      this.send("setoption name Skill Level value "+level.skill);
      this.send("position startpos"+(moves.length?" moves "+moves.join(" "):""));
      return new Promise((resolve,reject)=>{
        this.search={resolve,reject,timeout:setTimeout(()=>this.fail(new Error("Соперник не ответил. Попробуй ещё раз.")),level.time+12000)};
        this.send("go depth "+level.depth+" movetime "+level.time);
      });
    }
    fail(reason){clearTimeout(this.timeout);this.channel?.port1.close();this.rejectInit(reason);if(this.search){clearTimeout(this.search.timeout);this.search.reject(reason);this.search=null;}this.engine.terminate();}
    terminate(){this.fail(newAbort());}
  }

  function stop(){
    generation++;
    worker?.terminate();worker=null;
    loading=false;thinking=false;ready=false;
  }
  function persist(){
    const run=saved.chess;if(!run||!game)return;
    run.moves=game.history({verbose:true}).map(asUci);
    run.lastTouchedAt=Date.now();saveState();
  }
  async function restore(){
    const {Chess}=await loadLibrary(),run=saved.chess;
    if(!run)return false;
    if(restoredId!==run.id||!game||game.history().length!==run.moves.length){
      game=new Chess();
      for(const move of run.moves)game.move({from:move.slice(0,2),to:move.slice(2,4),...(move[4]?{promotion:move[4]}:{})});
      restoredId=run.id;
    }
    return true;
  }
  function summary(){
    const stats=saved.chessStats||{wins:0,losses:0,draws:0};
    return '<div class="chess-stats"><span><b>'+stats.wins+'</b> побед</span><span><b>'+stats.draws+'</b> ничьих</span><span><b>'+stats.losses+'</b> поражений</span><small>На этом устройстве</small></div>';
  }
  function renderSetup(){
    const prefs=saved.chessPreferences||{level:"casual",side:"w"},run=saved.chess;
    $("#chessSetupMount").innerHTML=
      '<div class="chess-intro"><div><p class="eyebrow">Твой следующий ход</p><h1 id="chessSetupTitle">Шахматы</h1><p class="lead">Один на один с компьютером.<br>Выбери соперника под свой уровень.</p></div><div class="chess-intro-art" aria-hidden="true">'+chessPiece("n","b")+'</div></div>'+
      (run&&!run.ended?'<button class="chess-resume" data-chess-action="resume" type="button"><span><small>Партия сохранена</small><strong>Продолжить · '+escapeHtml(CHESS_LEVELS.find(l=>l.id===run.level)?.name||"Соперник")+'</strong></span>'+uiIcon("arrow")+'</button>':'')+
      '<form id="chessSetupForm"><fieldset class="chess-levels"><legend>Выбери сложность <small>6 соперников</small></legend><div class="chess-level-list">'+CHESS_LEVELS.map((l,i)=>'<label class="chess-level-option"><input type="radio" name="chessLevel" value="'+l.id+'" '+(prefs.level===l.id?'checked':'')+' aria-describedby="chessLevelDescription-'+l.id+'"><span class="chess-level-number">'+String(i+1).padStart(2,"0")+'</span><span class="chess-level-copy"><span class="chess-level-top"><strong>'+l.name+'</strong><span>'+l.label+'</span></span><span class="chess-level-description" id="chessLevelDescription-'+l.id+'">'+l.description+'</span></span><span class="chess-radio-mark" aria-hidden="true"></span></label>').join("")+'</div></fieldset>'+
      '<fieldset class="chess-side"><legend>Твой цвет</legend><div class="chess-side-options">'+[["w","Белые"],["b","Чёрные"],["random","Случайно"]].map(([side,label])=>'<label><input type="radio" name="chessSide" value="'+side+'" '+(prefs.side===side?'checked':'')+'><span>'+(side==="random"?'<span class="chess-random" aria-hidden="true">?</span>':chessPiece("k",side))+label+'</span></label>').join("")+'</div></fieldset>'+
      '<p class="chess-strength-note">Названия обозначают режимы игры, а не рейтинг Elo. Можно начать с «Любителя» и постепенно усложнять.</p>'+
      '<div class="chess-setup-footer"><button class="primary-button" type="submit">Начать партию '+uiIcon("arrow")+'</button><span id="chessSelectionSummary">'+escapeHtml(CHESS_LEVELS.find(l=>l.id===prefs.level)?.name||"Любитель")+' · '+({w:"ты белыми",b:"ты чёрными",random:"случайный цвет"}[prefs.side])+' · без часов</span></div></form>'+
      summary()+
      '<details class="chess-credits"><summary>О шахматном движке</summary><p>Stockfish 19 · лёгкая версия. Вычисления идут на твоём устройстве. Первая загрузка движка — около 1,9 МБ.</p><p>Шахматы здесь — свободная игра. XP и достижения кампаний начисляются в головоломках.</p><p><a href="/static/vendor/stockfish/COPYING.txt" target="_blank" rel="noopener">GPL v3</a> · <a href="/static/vendor/stockfish/source-v19.0.1.tar.gz" download>Исходники движка</a> · <a href="/static/vendor/stockfish/BUILD.md" target="_blank" rel="noopener">Сборка</a> · <a href="/static/vendor/chess/LICENSE" target="_blank" rel="noopener">chess.js</a></p></details>';
  }
  function rememberSettings(){
    const form=$("#chessSetupForm");if(!form)return;
    saved.chessPreferences={level:form.elements.chessLevel.value,side:form.elements.chessSide.value};saveState();
    $("#chessSelectionSummary").textContent=(CHESS_LEVELS.find(l=>l.id===saved.chessPreferences.level)?.name||"Любитель")+" · "+({w:"ты белыми",b:"ты чёрными",random:"случайный цвет"}[saved.chessPreferences.side])+" · без часов";
  }
  async function start(){
    if(loading||startingMatch)return;
    rememberSettings();
    if(saved.chess&&!saved.chess.ended&&saved.chess.moves.length&&!confirm("Заменить сохранённую шахматную партию новой?"))return;
    startingMatch=true;
    try{
      const {Chess}=await loadLibrary(),prefs=saved.chessPreferences;
      stop();game=new Chess();selected=null;promotion=null;error="";flipped=false;
      saved.chess={version:1,id:crypto.randomUUID(),level:prefs.level,side:prefs.side==="random"?(Math.random()<.5?"w":"b"):prefs.side,moves:[],ended:false,result:null,lastTouchedAt:Date.now()};
      restoredId=saved.chess.id;boardFocus=saved.chess.side==="w"?"e2":"e7";persist();
      showScreen("chess-game");renderGame();activate();
    }catch(_){showToast("Не удалось загрузить правила шахмат. Проверь соединение и повтори.");}
    finally{startingMatch=false;}
  }
  async function resume(){
    try{if(!await restore())return;selected=null;promotion=null;error="";finishIfNeeded();persist();showScreen("chess-game");renderGame();if(!saved.chess.ended)activate();}
    catch(_){showToast("Сохранённую партию не удалось открыть. Можно начать новую.");}
  }
  async function activate(){
    if(!isActive()||saved.chess?.ended||worker)return;
    const token=++generation;
    loading=true;downloadProgress=null;error="";renderGame();
    try{
      if(typeof Worker==="undefined"||typeof WebAssembly==="undefined")throw new Error("Этот браузер не поддерживает шахматный движок. Обнови Telegram или браузер.");
      const next=new Opponent(percent=>{
        if(token!==generation||!isActive()||!loading)return;
        downloadProgress=percent;$("#chessTurnStatus").textContent=percent<100?"Загрузка соперника · "+percent+"%":"Готовим соперника…";
      });worker=next;await next.initialized;
      if(token!==generation||!isActive())return;
      loading=false;ready=true;renderGame();await computerMove();
    }catch(e){if(token!==generation||e.name==="AbortError")return;stop();error=e.message||"Не удалось загрузить соперника.";renderGame();}
  }
  async function computerMove(){
    if(!isActive()||!ready||saved.chess.ended||game.turn()===saved.chess.side||thinking)return;
    const token=generation,fen=game.fen(),level=currentLevel(),started=performance.now();
    thinking=true;selected=null;renderGame();
    try{
      let chosen;
      if(level.random&&Math.random()<level.random){
        const legal=game.moves({verbose:true});
        chosen=asUci(legal[Math.floor(Math.random()*legal.length)]);
      }else chosen=await worker.choose(saved.chess.moves,level);
      await new Promise(resolve=>setTimeout(resolve,Math.max(0,360-(performance.now()-started))));
      if(token!==generation||!isActive()||game.fen()!==fen||saved.chess.ended)return;
      if(!chosen||!/^([a-h][1-8]){2}[qrbn]?$/.test(chosen))throw new Error("Соперник не смог выбрать ход.");
      game.move({from:chosen.slice(0,2),to:chosen.slice(2,4),...(chosen[4]?{promotion:chosen[4]}:{})});
      thinking=false;persist();finishIfNeeded();renderGame();
    }catch(e){if(token!==generation||e.name==="AbortError")return;stop();error=e.message||"Расчёт хода прервался.";renderGame();}
  }
  function finishIfNeeded(){
    if(saved.chess.ended||!game.isGameOver())return;
    if(game.isCheckmate())finish(game.turn()===saved.chess.side?"loss":"win","Мат");
    else finish("draw",game.isStalemate()?"Пат":game.isInsufficientMaterial()?"Недостаточно фигур для мата":game.isThreefoldRepetition()?"Троекратное повторение позиции":game.isDrawByFiftyMoves()?"Правило 50 ходов":"Ничья");
  }
  function finish(outcome,reason){
    if(saved.chess.ended)return;
    saved.chess.ended=true;saved.chess.result={outcome,reason};
    const stats=saved.chessStats||{wins:0,losses:0,draws:0};
    stats[{win:"wins",loss:"losses",draw:"draws"}[outcome]]++;
    saved.chessStats=stats;persist();stop();
    try{if(hasTelegramIdentity&&tg.isVersionAtLeast?.("6.1"))tg.HapticFeedback?.notificationOccurred(outcome==="win"?"success":"warning");}catch(_){}
  }
  function move(from,to,piece){
    if(!game||thinking||loading||!ready||saved.chess.ended||game.turn()!==saved.chess.side)return;
    try{
      game.move({from,to,...(piece?{promotion:piece}:{})});
      selected=null;boardFocus=to;promotion=null;persist();finishIfNeeded();renderGame();computerMove();
    }catch(_){showToast("Такой ход сейчас невозможен.");}
  }
  function chooseSquare(square){
    if(!game||thinking||loading||!ready||saved.chess.ended||game.turn()!==saved.chess.side)return;
    const piece=game.get(square);
    if(selected===square){selected=null;renderGame();return;}
    if(selected){
      const legal=game.moves({square:selected,verbose:true}).filter(m=>m.to===square);
      if(legal.length){
        if(legal.some(m=>m.promotion)){promotion={from:selected,to:square};showPromotion();return;}
        move(selected,square);return;
      }
    }
    selected=piece?.color===saved.chess.side?square:null;boardFocus=square;renderGame();
  }
  function showPromotion(){
    const dialog=$("#chessPromotion"),color=saved.chess.side;
    $("#chessPromotionChoices").innerHTML=["q","r","b","n"].map(type=>'<button class="promotion-choice" data-chess-promote="'+type+'" aria-label="'+names[type]+'" type="button">'+chessPiece(type,color)+'<span>'+names[type]+'</span></button>').join("");
    dialog.showModal();
  }
  function undo(){
    const min=saved.chess.side==="w"?2:3;
    if(!game||saved.chess.ended||thinking||loading||game.history().length<min)return;
    game.undo();game.undo();selected=null;promotion=null;persist();renderGame();
  }
  function renderGame(){
    if(!game||!saved.chess)return;
    const run=saved.chess,level=currentLevel(),history=game.history({verbose:true}),last=history.at(-1);
    const reversed=(run.side==="b")!==flipped,files=reversed?"hgfedcba":"abcdefgh",ranks=reversed?"12345678":"87654321";
    const targets=new Set(selected?game.moves({square:selected,verbose:true}).map(m=>m.to):[]);
    const checkedKing=game.isCheck()?game.board().flat().find(p=>p&&p.type==="k"&&p.color===game.turn())?.square:null;
    const focusBefore=document.activeElement?.getAttribute("data-chess-square");
    const actionBefore=document.activeElement?.getAttribute("data-chess-action");
    const result=run.result;
    $("#chessOpponentName").textContent=level.name;
    $("#chessLevelLabel").textContent=level.label+" · "+(run.side==="w"?"ты белыми":"ты чёрными");
    $("#chessTurnStatus").textContent=run.ended?(result.outcome==="win"?"Твоя победа":result.outcome==="loss"?"Победа компьютера":"Ничья"):error?"Соперник недоступен":loading?(downloadProgress===null?"Загружаем соперника…":downloadProgress<100?"Загрузка соперника · "+downloadProgress+"%":"Готовим соперника…"):thinking?"Компьютер думает…":game.isCheck()?"Тебе шах. Защити короля.":"Твой ход";
    $("#chessTurnStatus").classList.toggle("is-thinking",loading||thinking);
    $("#chessBoardMount").innerHTML=
      (error?'<div class="chess-error" role="alert"><p>'+escapeHtml(error)+'</p><button class="text-button" data-chess-action="retry" type="button">Повторить загрузку</button></div>':'')+
      (run.ended?'<div class="chess-result" role="status"><strong>'+(result.outcome==="win"?"Отличная партия. Победа!":result.outcome==="loss"?"Победа компьютера.":"Партия закончилась вничью.")+'</strong><span>'+escapeHtml(result.reason)+'</span><button class="text-button" data-chess-action="setup" type="button">Сыграть ещё '+uiIcon("arrow")+'</button></div>':'')+
      '<div class="chess-board" role="group" aria-label="Шахматная доска. '+(reversed?"Чёрные":"Белые")+' снизу" aria-busy="'+(loading||thinking)+'">'+[...ranks].map((rank,ri)=>[...files].map((file,fi)=>{
        const square=file+rank,p=game.get(square),dark=(file.charCodeAt(0)-97+Number(rank))%2===0;
        const label=square+", "+(p?(p.color==="w"?"белые, ":"чёрные, ")+names[p.type]:"пусто")+(targets.has(square)?", допустимый ход":"")+(checkedKing===square?", шах":"");
        return '<button type="button" class="chess-square'+(dark?" dark":" light")+(selected===square?" selected":"")+(last&&(last.from===square||last.to===square)?" last-move":"")+(targets.has(square)?" legal-target":"")+(checkedKing===square?" king-in-check":"")+'" data-chess-square="'+square+'" tabindex="'+(square===boardFocus?"0":"-1")+'" aria-pressed="'+(selected===square)+'" aria-label="'+label+'">'+(p?chessPiece(p.type,p.color):"")+(fi===0?'<small class="rank-coordinate" aria-hidden="true">'+rank+'</small>':"")+(ri===7?'<small class="file-coordinate" aria-hidden="true">'+file+'</small>':"")+'</button>';
      }).join("")).join("")+'</div>'+
      '<div class="chess-player-line"><span class="chess-player-dot '+(run.side==="w"?"white":"black")+'"></span><strong>Ты · '+(run.side==="w"?"белые":"чёрные")+'</strong><span>'+Math.ceil(history.length/2)+' ход.</span></div>'+
      '<div class="chess-board-actions"><button class="secondary-button" data-chess-action="undo" type="button" '+(run.ended||thinking||loading||history.length<(run.side==="w"?2:3)?"disabled":"")+'>Отменить ход</button><button class="secondary-button" data-chess-action="flip" type="button">Перевернуть</button></div>'+
      '<p class="game-note">'+(loading?"Первый запуск: движок загружается на устройство.":run.ended?"Партия и результат сохранены на устройстве.":"Нажми на свою фигуру, затем на подсвеченную клетку.")+'</p>'+
      '<details class="chess-history"><summary>История партии <span>'+history.length+' полуходов</span></summary><ol>'+Array.from({length:Math.ceil(history.length/2)},(_,i)=>'<li><span>'+escapeHtml(history[i*2].san)+'</span><span>'+escapeHtml(history[i*2+1]?.san||"…")+'</span></li>').join("")+'</ol>'+(history.length?"":'<p>Первый ход ещё впереди.</p>')+'</details>'+
      '<div class="chess-bottom-actions"><button class="text-button" data-chess-action="setup" type="button">Новая партия</button>'+(!run.ended?'<button class="text-button chess-resign" data-chess-action="resign" type="button">Сдаться</button>':'')+'</div>';
    if(focusBefore)$('[data-chess-square="'+focusBefore+'"]')?.focus({preventScroll:true});
    else if(actionBefore)$('[data-chess-action="'+actionBefore+'"]', $("#chessBoardMount"))?.focus({preventScroll:true});
  }
  function click(target){
    if(target.hasAttribute("data-chess-square")){chooseSquare(target.dataset.chessSquare);return true;}
    if(target.hasAttribute("data-chess-promote")){
      const choice=target.dataset.chessPromote,pending=promotion;$("#chessPromotion").close();
      if(pending)move(pending.from,pending.to,choice);return true;
    }
    const action=target.dataset.chessAction;if(!action)return false;
    if(action==="setup")showScreen("chess");
    if(action==="resume")resume();
    if(action==="undo")undo();
    if(action==="flip"){flipped=!flipped;renderGame();}
    if(action==="retry"){stop();activate();}
    if(action==="rules"){const closed=$("#chessRules").classList.toggle("hidden");target.setAttribute("aria-expanded",String(!closed));}
    if(action==="resign"&&!saved.chess?.ended&&confirm("Сдаться и завершить эту партию?")){finish("loss","Ты сдался");renderGame();}
    return true;
  }
  function onScreen(name){
    if(name!=="chess-game"){
      stop();selected=null;promotion=null;
      if($("#chessPromotion")?.open)$("#chessPromotion").close();
    }
    if(name==="chess")renderSetup();
  }
  function getResume(){
    const run=saved.chess;
    return run&&!run.ended?{type:"chess",lastTouchedAt:run.lastTouchedAt,level:run.level}:null;
  }
  document.addEventListener("submit",event=>{if(event.target.id==="chessSetupForm"){event.preventDefault();start();}});
  document.addEventListener("change",event=>{if(event.target.closest("#chessSetupForm"))rememberSettings();});
  document.addEventListener("keydown",event=>{
    const square=event.target.dataset?.chessSquare;if(!square||!isActive())return;
    const delta={ArrowUp:-8,ArrowDown:8,ArrowLeft:-1,ArrowRight:1}[event.key];
    if(delta===undefined)return;event.preventDefault();
    const cells=$$("[data-chess-square]"),index=cells.indexOf(event.target),next=Math.max(0,Math.min(63,index+delta));
    cells[index].tabIndex=-1;cells[next].tabIndex=0;boardFocus=cells[next].dataset.chessSquare;cells[next].focus();
  });
  document.addEventListener("visibilitychange",()=>{if(document.hidden)stop();else if(isActive()&&!saved.chess?.ended)activate();});
  window.addEventListener("pagehide",stop);
  return {enter:()=>showScreen("chess"),onScreen,click,resume,getResume};
})();

import {createDurak,legalDurak,actDurak,botDurak,restoreDurak} from './durak.mjs';
import {createBlackjack,legalBlackjack,actBlackjack,total,viewBlackjack,restoreBlackjack} from './blackjack.mjs';
import {createSolitaire,legalSolitaire,actSolitaire,undoSolitaire,hintSolitaire,restoreSolitaire} from './solitaire.mjs';
import {attachCardGestures} from './gestures.mjs?v=1';

const titles={durak:'Дурак',blackjack:'Блэкджек',solitaire:'Косынка'};
const suits={s:'♠',h:'♥',d:'♦',c:'♣'},suitNames={s:'пик',h:'червей',d:'бубен',c:'треф'};
const ranks={A:'Туз',K:'Король',Q:'Дама',J:'Валет',T:'Десятка','9':'Девятка','8':'Восьмёрка','7':'Семёрка','6':'Шестёрка','5':'Пятёрка','4':'Четвёрка','3':'Тройка','2':'Двойка'};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const label=c=>`${ranks[c[0]]} ${suitNames[c[1]]}`;
const rules={
  durak:'Подкидной Дурак на двоих, 36 карт. Каждый начинает с шести карт. Первый ход — у младшего козыря. Карту можно побить старшей той же масти или козырем; козырь — только старшим козырем. Подкидывать можно ранги уже лежащих на столе карт. Не больше шести атак и не больше карт, чем было у защитника в начале боя. «Беру» позволяет сопернику ещё подкинуть, затем он завершает бой. Добирает сначала атакующий, затем защитник. После успешной защиты ход переходит защитнику; после взятия атакующий ходит снова. Колода закончилась — избавься от всех карт. Переводов нет. Управление: перетащи карту на стол; либо выбери карту и нажми на стол или «Сыграть»; повторное касание выбранной карты тоже выполняет ход. Свайп по руке меняет сортировку по старшинству/мастям, козыри справа. Кнопка сортировки делает то же самое. Стрелки переключают фокус между картами, Escape снимает выбор.',
  blackjack:'Одна колода, 52 карты. Цель — набрать ближе к 21, чем дилер, не перебрав. Туз считается за 1 или 11; валет, дама и король — за 10. «Ещё» берёт карту, «Хватит» завершает ход. «Удвоить» доступно на первых двух картах: одна последняя карта и завершение хода. Дилер добирает до 17 и остаётся на любых 17, включая мягкие. Блэкджек — туз и десятиочковая карта с раздачи — сильнее обычных 21 и приносит 1,5 условных очка. Обычная победа — 1 очко, удвоенная — 2. Равенство даёт ничью. Разделения пар и страховки в этом варианте нет. На клавиатуре: H — ещё, S — хватит, D — удвоить. Доступные кнопки работают через Tab и Enter.',
  solitaire:'Косынка, по одной карте. Собери четыре базы по мастям от туза до короля. На поле карты кладутся по убыванию с чередованием красного и чёрного; можно переносить целую открытую последовательность. На пустой столбец — только король. Нажми карту или начало последовательности, затем место назначения. Двойной клик по верхней карте отправляет её в доступную базу. Колода открывает одну карту; пустая колода возвращает сброс для новой пересдачи. Пересдачи не ограничены. «В базу», «Подсказка» и «Отменить» помогают управлять раскладкой. Не каждая случайная раздача решаема. Карты и открытые последовательности можно перетаскивать мышью или пальцем в подсвеченные места. Отпускание вне допустимого места отменяет перенос. Z — отменить ход, Escape — снять выбор.'
};

export function createCardGames(context){
  const {getSaved,persist,navigate,toast,room,deck}=context,mount=document.querySelector('#cardGameMount');
  let game=null,state=null,selected=null,handPage=0,dialog=null,botTimer=null,active=false,suspended=false,hint=null,lastTap={key:'',time:0},sortBySuit=false;
  const isRecord=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
  function store(){const root=getSaved();if(!isRecord(root.cardGames))root.cardGames={};const r=root.cardGames;for(const key of ['runs','stats','sessionIds','counted','touched'])if(!isRecord(r[key]))r[key]={};return r;}
  function save(touch=true){if(!state||!game)return;const r=store();r.runs[game]=JSON.parse(JSON.stringify(state));if(touch){r.lastGame=game;r.lastTouchedAt=Date.now();r.touched[game]=r.lastTouchedAt;}persist();}
  function countResult(){if(state.status==='playing')return;const r=store(),id=r.sessionIds[game];if(r.counted[game]===id)return;const stats=r.stats[game];if(!isRecord(stats)||!Number.isSafeInteger(stats.played)||!Number.isSafeInteger(stats.won)||stats.played<0||stats.won<0||stats.won>stats.played)r.stats[game]={played:0,won:0};r.stats[game].played++;if(state.status==='won')r.stats[game].won++;r.counted[game]=id;}
  function create(){const seed=crypto.getRandomValues(new Uint32Array(1))[0];return game==='durak'?createDurak({seed}):game==='blackjack'?createBlackjack({seed}):createSolitaire({seed});}
  function open(id){
    clearTimeout(botTimer);game=id;selected=null;handPage=0;dialog=null;hint=null;suspended=false;active=true;
    const r=store(),raw=r.runs[id];state=raw?.status==='playing'?(id==='durak'?restoreDurak(raw):id==='blackjack'?restoreBlackjack(raw):restoreSolitaire(raw)):null;
    if(raw?.status==='playing'&&!state)toast('Сохранение повреждено. Начинаем новую партию.');
    if(!state){state=create();r.sessionIds[game]=crypto.randomUUID();}else r.sessionIds[game]||=crypto.randomUUID();
    document.querySelector('#cardGameTitle').textContent=titles[game];countResult();save();render();mount.parentElement.querySelector('.cardroom-toolbar button')?.focus({preventScroll:true});scheduleBot();
  }
  function button(action,text,{disabled=false,value='',secondary=false}={}){return `<button class="table-button${secondary?' secondary':''}" data-cardgame-action="${action}" ${value?`data-cardgame-value="${esc(value)}"`:''} type="button" ${disabled?'disabled':''}>${text}</button>`;}
  function card(code,{hidden=false,key=code,reveal=false}={}){return `<span class="playing-card" data-card-key="${esc(key)}">${hidden?deck.back({deal:false}):deck.card(code,{deal:false,reveal})}</span>`;}
  function playerHand(cards,{canPlay=[],kind='durak'}={}){
    if(kind==='durak'&&sortBySuit)cards=[...cards].sort((a,b)=>('shdc'.indexOf(a[1])+(a[1]===state.trump?4:0))-('shdc'.indexOf(b[1])+(b[1]===state.trump?4:0))||'6789TJQKA'.indexOf(a[0])-'6789TJQKA'.indexOf(b[0]));
    const count=matchMedia('(max-width:600px)').matches?6:10,pages=Math.max(1,Math.ceil(cards.length/count));handPage=Math.min(handPage,pages-1);
    const shown=cards.slice(handPage*count,handPage*count+count);
    return `<div class="table-hand-area"><div class="table-hand-label"><span>ТВОЯ РУКА <b>${cards.length}</b></span>${kind==='durak'?`<button class="hand-sort" data-cardgame-action="sort" type="button" aria-label="Сортировка карт: ${sortBySuit?'по мастям':'по старшинству'}. Нажми, чтобы сменить">${sortBySuit?'По мастям':'По старшинству'} ↔</button>`:''}${pages>1?`<span>${handPage+1} / ${pages}</span>`:''}</div><div class="table-hand${kind==='blackjack'?' blackjack-hand':''}">${shown.map((c,i)=>kind==='blackjack'?`<span class="hand-slot" style="--i:${i};--count:${shown.length}">${card(c)}</span>`:`<button class="hand-slot hand-card${selected===c?' selected':''}${canPlay.includes(c)?' playable':''}" style="--i:${i};--count:${shown.length}" data-cardgame-action="select" data-cardgame-value="${c}" type="button" aria-label="${label(c)}${canPlay.includes(c)?'. Можно сыграть':''}" aria-pressed="${selected===c}">${card(c)}</button>`).join('')}</div>${pages>1?`<div class="hand-pages"><button class="table-icon" data-cardgame-action="page" data-cardgame-value="-1" aria-label="Предыдущие карты" type="button" ${handPage===0?'disabled':''}>${room.icon('prev')}</button><span>Карты ${handPage*count+1}–${Math.min(cards.length,(handPage+1)*count)} из ${cards.length}</span><button class="table-icon" data-cardgame-action="page" data-cardgame-value="1" aria-label="Следующие карты" type="button" ${handPage===pages-1?'disabled':''}>${room.icon('next')}</button></div>`:''}</div>`;
  }
  function durak(){
    const legal=state.turn===0&&state.status==='playing'?legalDurak(state,0):[],playable=legal.filter(a=>a.card).map(a=>a.card),play=legal.find(a=>a.card===selected);
    const botCount=state.hands[1].length,backs=Math.min(8,botCount);
    const message=state.status==='playing'?(state.turn===1?'Соперник обдумывает ход…':state.phase==='taking'?'Подкинь подходящие карты или заверши бой.':state.phase==='defend'?'Перетащи карту на стол или коснись её дважды.':state.table.length?'Подкинь карту или нажми «Бито».':'Перетащи карту на стол или коснись её дважды.'):state.message;
    return `<div class="cardroom-meta"><span>Подкидной · 36 карт</span><span>Бой ${state.round} · козырь <b class="suit-${state.trump}">${suits[state.trump]}</b></span></div><div class="duel-field"><div class="table-opponent"><div class="table-avatar">Т</div><div><strong>Терамонт</strong><span>Компьютер · ${botCount} карт</span></div><div class="opponent-cards" aria-label="Закрытые карты соперника: ${botCount}">${Array.from({length:backs},(_,i)=>card(null,{hidden:true,key:'bot-'+i})).join('')}</div></div><div class="durak-board"><div class="table-stock" data-deck-origin><div class="trump-card">${state.stock.length?card(state.trumpCard,{key:'open-trump'}):''}</div>${state.stock.length?card(null,{hidden:true,key:'stock'}):'<span class="card-empty">↻</span>'}<span>${state.stock.length} <small>в колоде</small></span></div><div class="durak-pairs" data-pairs="${state.table.length}" aria-label="Карты на столе">${state.table.length?state.table.map((pair,i)=>`<div class="durak-pair${!pair.defense?' uncovered':''}"><span class="attack-card">${card(pair.attack)}</span>${pair.defense?`<span class="defense-card">${card(pair.defense)}</span>`:'<span class="defense-outline" aria-hidden="true"></span>'}</div>`).join(''):'<div class="table-watermark"><span>Т</span><small>ТВОЯ ПАРТИЯ<br>ТВОЙ ХОД</small></div>'}</div><div class="table-discard"><span class="discard-mark">${deck.icon('cards')}</span><b>${state.discard.length}</b><small>в бито</small></div></div></div>${playerHand(state.hands[0],{canPlay:playable})}<footer class="table-footer"><p class="table-message" role="status">${esc(message)}</p><div class="table-actions">${state.status==='playing'?button('play',state.phase==='defend'?'Отбиться':'Сыграть',{disabled:!play})+button('take','Беру',{disabled:!legal.some(a=>a.type==='take'),secondary:true})+button('pass',state.phase==='taking'?'Завершить':state.table.length?'Бито':'Пропустить',{disabled:!legal.some(a=>a.type==='pass'),secondary:true}):resultButtons()}</div></footer>`;
  }
  function blackjack(){
    const view=viewBlackjack(state),legal=legalBlackjack(state).map(a=>a.type),terminal=state.status!=='playing';
    return `<div class="cardroom-meta"><span>Одна колода · дилер S17</span><span>Раунд ×${state.wager} · условные очки</span></div><div class="blackjack-field"><div class="table-dealer-label"><span class="table-avatar">Т</span><span><strong>Дилер</strong><small>${terminal?'Карты раскрыты':'Одна карта закрыта'}</small></span><b class="blackjack-total">${view.dealerTotal.value}${terminal?'':' + ?'}</b></div><div class="blackjack-dealer-hand">${view.dealer.map((c,i)=>card(c,{hidden:c===null,key:i===1?'dealer-hole':'dealer-'+i,reveal:terminal&&i===1})).join('')}</div><div class="blackjack-inscription"><svg viewBox="0 0 600 160" aria-hidden="true"><defs><path id="blackjackLetterArc" d="M 70 40 Q 300 175 530 40"/></defs><path d="M45 22 Q300 178 555 22 M60 44 Q300 193 540 44" fill="none" stroke="currentColor" stroke-width="1"/><text><textPath href="#blackjackLetterArc" startOffset="50%" text-anchor="middle">БЛЭКДЖЕК 3:2</textPath></text></svg><span>BLACKJACK PAYS 3 TO 2 · DEALER STANDS ON ALL 17</span></div>${playerHand(state.player,{kind:'blackjack'})}<div class="blackjack-player-label"><span>Твоя сумма</span><b class="blackjack-total${total(state.player).bust?' bust':''}">${view.playerTotal.value}</b><small>${view.playerTotal.blackjack?'Блэкджек':view.playerTotal.soft?'Мягкая рука':'Без перебора до 21'}</small></div></div><footer class="table-footer"><p class="table-message" role="status">${esc(terminal?state.result+(state.payout?` · ${state.payout>0?'+':''}${state.payout} очк.`:''):'Возьми карту или оставь свою сумму.')}</p><div class="table-actions">${terminal?resultButtons():button('hit','Ещё',{disabled:!legal.includes('hit')})+button('stand','Хватит',{secondary:true,disabled:!legal.includes('stand')})+button('double','Удвоить',{secondary:true,disabled:!legal.includes('double')})}</div></footer>`;
  }
  const sourceKey=s=>s?`${s.pile}:${s.index||0}:${s.at??0}`:'';
  function moveMatches(action,from,to){return action.type==='move'&&sourceKey(action.from)===sourceKey(from)&&action.to.pile===to.pile&&action.to.index===to.index;}
  function solitaire(){
    const selectedSource=typeof selected==='object'?selected:null,legal=legalSolitaire(state),canBase=selectedSource&&legal.find(a=>a.type==='move'&&sourceKey(a.from)===sourceKey(selectedSource)&&a.to.pile==='foundation');
    const top=(pile,index,entry)=>`<button class="sol-card${sourceKey(selectedSource)===sourceKey({pile,index})?' selected':''}" data-cardgame-action="sol-source" data-cardgame-value="${pile}:${index}:0" type="button" aria-label="${label(entry)}. ${pile==='waste'?'Сброс':'База '+(index+1)}">${card(entry)}</button>`;
    return `<div class="cardroom-meta"><span>По одной карте · пересдача ${state.redeals}</span><span>Ходов ${state.moves} · в базах ${state.foundations.reduce((n,f)=>n+f.length,0)} / 52</span></div><div class="solitaire-field"><div class="sol-top"><button class="sol-stock" data-deck-origin data-cardgame-action="draw" type="button" ${legal.some(a=>a.type==='draw')?'':'disabled'} aria-label="${state.stock.length?'Открыть карту. В колоде '+state.stock.length:state.waste.length?'Пересдать колоду':'Колода пуста'}">${state.stock.length?card(null,{hidden:true,key:'sol-stock'}):'<span class="card-empty">↻</span>'}<small>${state.stock.length||(state.waste.length?'Ещё круг':'Пусто')}</small></button><div class="sol-waste">${state.waste.length?top('waste',0,state.waste.at(-1)):'<span class="card-empty">·</span>'}</div><span></span>${state.foundations.map((f,i)=>`<div class="sol-foundation"><button class="sol-drop" data-cardgame-action="sol-target" data-cardgame-value="foundation:${i}" type="button" aria-label="База ${i+1}${f.length?', '+label(f.at(-1)):'. Пусто'}"><span class="card-empty">${['♠','♥','♣','♦'][i]}</span></button>${f.length?top('foundation',i,f.at(-1)):''}</div>`).join('')}</div><div class="sol-columns">${state.tableau.map((column,i)=>`<div class="sol-column"><button class="sol-drop" data-cardgame-action="sol-target" data-cardgame-value="tableau:${i}" type="button" aria-label="Столбец ${i+1}${column.length?'':'. Пусто, сюда можно положить короля'}"></button>${column.map((e,at)=>e.faceUp?`<button class="sol-card${sourceKey(selectedSource)===sourceKey({pile:'tableau',index:i,at})?' selected':''}" style="--pos:${at}" data-cardgame-action="sol-source" data-cardgame-value="tableau:${i}:${at}" type="button" aria-label="${label(e.card)}. Столбец ${i+1}, карта ${at+1}" aria-pressed="${sourceKey(selectedSource)===sourceKey({pile:'tableau',index:i,at})}">${card(e.card)}</button>`:`<span class="sol-card facedown" style="--pos:${at}">${card(null,{hidden:true,key:`hidden-${i}-${at}`})}</span>`).join('')}</div>`).join('')}</div></div><footer class="table-footer"><p class="table-message" role="status">${state.status==='won'?'Все четыре масти собраны. Отличная партия!':hint?hint.type==='draw'?'Открой карту из колоды.':`Подсказка: ${hint.to.pile==='foundation'?'перенеси карту в базу':'перенеси карты в столбец '+(hint.to.index+1)}.`:selectedSource?'Карта выбрана. Нажми место назначения.':'Перетащи карту или выбери её и место назначения.'}</p><div class="table-actions">${state.status==='won'?button('new','Ещё партию')+button('undo','Отменить',{disabled:!state.history.length,secondary:true}):button('hint','Подсказка',{secondary:true})+button('undo',room.icon('undo')+'Отменить',{disabled:!state.history.length,secondary:true})+button('foundation','В базу',{disabled:!canBase})}</div></footer>`;
  }
  function resultButtons(){return button('new','Ещё партию')+button('exit','К играм',{secondary:true});}
  function dialogHtml(){
    if(!dialog)return '';
    const content=dialog==='rules'?`<span class="table-kicker">КАК ИГРАТЬ</span><h2 id="cardDialogTitle">${titles[game]}</h2><p>${rules[game]}</p><p class="table-small">Партия сохраняется на устройстве. XP кампаний не начисляется.</p>`:`<span class="table-kicker">ПАРТИЯ СОХРАНЕНА</span><h2 id="cardDialogTitle">В своём темпе</h2><p>Продолжай, когда будешь готов.</p>${button('close','Продолжить')}${button('new','Новая партия',{secondary:true})}${button('exit','Сохранить и выйти',{secondary:true})}`;
    return `<dialog class="cardroom-dialog" id="cardGameDialog" aria-labelledby="cardDialogTitle"><button class="table-icon dialog-close" data-cardgame-action="close" type="button" aria-label="Закрыть">${room.icon('close')}</button>${content}</dialog>`;
  }
  function render(){
    if(!active||!state)return;
    gestures.cancel();
    const old=room.capture(mount),focused=document.activeElement?.closest('[data-cardgame-action]'),focus=focused?{action:focused.dataset.cardgameAction,value:focused.dataset.cardgameValue}:null;
    mount.innerHTML=(game==='durak'?durak():game==='blackjack'?blackjack():solitaire())+dialogHtml();
    mount.dataset.game=game;mount.parentElement.dataset.cardTheme=game;mount.dataset.status=state.status;mount.scrollTop=0;mount.parentElement.scrollTop=0;layout();markTargets();room.animate(mount,old);room.sync();
    if(dialog){const d=mount.querySelector('dialog');d.showModal();d.addEventListener('cancel',e=>{e.preventDefault();action('close');},{once:true});}
    else if(focus){const match=[...mount.parentElement.querySelectorAll('[data-cardgame-action]')].find(e=>e.dataset.cardgameAction===focus.action&&e.dataset.cardgameValue===focus.value&&!e.disabled);(match||mount.querySelector('.table-actions button:not(:disabled)'))?.focus({preventScroll:true});}
  }
  function layout(){if(game!=='solitaire'||!active)return;const area=mount.querySelector('.sol-columns');if(!area)return;const max=Math.max(1,...state.tableau.map(c=>c.length)),width=(area.clientWidth-parseFloat(getComputedStyle(area).columnGap)*6)/7,cardHeight=width*1.4,available=area.clientHeight;area.style.setProperty('--sol-step',Math.max(1,Math.min(29,(available-cardHeight-4)/Math.max(1,max-1)))+'px');}
  function scheduleBot(){clearTimeout(botTimer);if(!active||suspended||dialog||game!=='durak'||state.status!=='playing'||state.turn!==1)return;botTimer=setTimeout(()=>{if(!active||suspended||dialog)return;const a=botDurak(state);if(a&&actDurak(state,a)){selected=null;countResult();save();render();scheduleBot();}},650);}
  function changed(){selected=null;hint=null;countResult();save();render();scheduleBot();}
  function makeMove(a){if(game==='durak'){if(state.turn===0&&actDurak(state,a))changed();}else if(game==='blackjack'){if(actBlackjack(state,a))changed();}else if(actSolitaire(state,a))changed();}
  function sourceOf(value){const [pile,index,at]=value.split(':');return {pile,index:Number(index),...(pile==='tableau'?{at:Number(at)}:{})};}
  function targetsFor(from){
    if(game==='durak')return legalDurak(state,0).filter(a=>a.card===from).map(action=>({element:mount.querySelector('.durak-pairs'),action}));
    if(game!=='solitaire')return [];
    return legalSolitaire(state).filter(a=>a.type==='move'&&sourceKey(a.from)===sourceKey(from)).map(action=>({element:mount.querySelectorAll(action.to.pile==='tableau'?'.sol-column':'.sol-foundation')[action.to.index],action}));
  }
  function markTargets(){
    const board=mount.querySelector('.durak-pairs');
    if(board){board.setAttribute('role','button');board.tabIndex=0;board.setAttribute('aria-label','Сыграть выбранную карту на стол');board.setAttribute('aria-disabled',String(!selected||!targetsFor(selected).length));}
    if(selected)targetsFor(selected).forEach(t=>t.element.classList.add('card-drop-ready'));
  }
  const gestures=attachCardGestures({mount,enabled:()=>active&&!dialog&&!suspended&&state?.status==='playing',
    source:node=>{
      const from=game==='durak'?node.dataset.cardgameValue:sourceOf(node.dataset.cardgameValue);
      const nodes=game==='solitaire'&&from.pile==='tableau'?[...node.parentElement.querySelectorAll('.sol-card[data-cardgame-action]')].filter(e=>sourceOf(e.dataset.cardgameValue).at>=from.at):[node];
      return {nodes,targets:targetsFor(from)};
    },swipe:()=>action('sort'),drop:makeMove,restoreHighlights:()=>{if(active&&!dialog&&selected)markTargets();}});
  mount.addEventListener('click',e=>{if(active&&!dialog&&game==='durak'&&e.target.closest('.durak-pairs')){e.preventDefault();action('play');}});
  function solTarget(to){if(!selected||typeof selected!=='object')return;const a=legalSolitaire(state).find(a=>moveMatches(a,selected,to));if(a)makeMove(a);else toast('Эта карта сюда не подходит.');}
  function action(name,value,buttonElement){
    if(!state)return;
    if(name==='exit'){save();navigate('cards');return;}
    if(name==='rules'||name==='menu'){clearTimeout(botTimer);dialog=name;save();render();return;}
    if(name==='close'){dialog=null;render();scheduleBot();return;}
    if(name==='new'){if(state.status==='playing'&&!window.confirm('Начать новую партию? Текущая раскладка будет заменена.'))return;clearTimeout(botTimer);dialog=null;selected=null;hint=null;handPage=0;state=create();store().sessionIds[game]=crypto.randomUUID();countResult();save();render();scheduleBot();return;}
    if(name==='page'){handPage=Math.max(0,handPage+Number(value));render();return;}
    if(dialog)return;
    if(name==='sort'){sortBySuit=!sortBySuit;handPage=0;render();toast(sortBySuit?'Карты по мастям. Козыри справа.':'Карты по старшинству. Козыри справа.');return;}
    if(name==='select'){
      const move=legalDurak(state,0).find(a=>a.card===value);
      if(!move){toast(state.turn===1?'Дождись хода соперника.':'Этой картой сейчас нельзя сыграть.');return;}
      if(selected===value){makeMove(move);return;}selected=value;render();return;
    }
    if(name==='play'){const a=legalDurak(state,0).find(a=>a.card===selected);if(a)makeMove(a);return;}
    if(['take','pass','hit','stand','double'].includes(name)){makeMove({type:name});return;}
    if(name==='draw'){makeMove({type:'draw'});return;}
    if(name==='undo'){if(undoSolitaire(state))changed();return;}
    if(name==='hint'){hint=hintSolitaire(state);if(hint?.type==='move')selected=hint.from;render();if(!hint)toast('Доступных ходов нет. Можно отменить ход или начать новую раскладку.');return;}
    if(name==='foundation'){const a=legalSolitaire(state).find(a=>a.type==='move'&&sourceKey(a.from)===sourceKey(selected)&&a.to.pile==='foundation');if(a)makeMove(a);return;}
    if(name==='sol-target'){const [pile,index]=value.split(':');solTarget({pile,index:Number(index)});return;}
    if(name==='sol-source'){
      const [pile,index,at]=value.split(':'),source={pile,index:Number(index),...(pile==='tableau'?{at:Number(at)}:{})};
      const key=sourceKey(source),now=performance.now();
      if(lastTap.key===key&&now-lastTap.time<350&&sourceKey(selected)===key){lastTap={key:'',time:0};action('foundation');return;}lastTap={key,time:now};
      if(selected&&typeof selected==='object'&&pile!=='waste'&&sourceKey(selected)!==sourceKey(source)){
        const move=legalSolitaire(state).find(a=>moveMatches(a,selected,{pile,index:Number(index)}));if(move){makeMove(move);return;}
      }
      selected=sourceKey(selected)===sourceKey(source)?null:source;hint=null;render();
    }
  }
  function onScreen(name){const was=active;active=name==='card-game';if(was&&!active){gestures.cancel();clearTimeout(botTimer);mount.querySelector('dialog[open]')?.close();save();}if(active)scheduleBot();}
  window.addEventListener('pagehide',()=>{if(active)save();});
  document.addEventListener('visibilitychange',()=>{suspended=document.hidden;if(suspended){clearTimeout(botTimer);if(active)save();}else scheduleBot();});
  window.addEventListener('resize',layout);
  document.addEventListener('keydown',e=>{
    if(!active||dialog||e.repeat||e.ctrlKey||e.altKey||e.metaKey||e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
    if(e.code==='Escape'){e.preventDefault();gestures.cancel();if(selected){selected=null;render();}else action('menu');return;}
    if(game==='durak'){
      if(e.target.closest('.durak-pairs')&&['Enter','Space'].includes(e.code)){e.preventDefault();action('play');}
      if(['ArrowLeft','ArrowRight','Home','End'].includes(e.code)&&e.target.closest('.table-hand')){
        e.preventDefault();const cards=[...mount.querySelectorAll('.hand-card')],i=cards.indexOf(e.target.closest('.hand-card'));
        cards[e.code==='Home'?0:e.code==='End'?cards.length-1:(i+(e.code==='ArrowRight'?1:-1)+cards.length)%cards.length]?.focus({preventScroll:true});
      }
    }
    if(game==='blackjack'){const name={KeyH:'hit',KeyS:'stand',KeyD:'double'}[e.code];if(name&&legalBlackjack(state).some(a=>a.type===name)){e.preventDefault();action(name);}}
    if(game==='solitaire'&&e.code==='KeyZ'){e.preventDefault();action('undo');}
  });
  return {open,action,onScreen};
}

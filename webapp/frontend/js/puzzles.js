"use strict";

const GAME_CATALOG = {
  sudoku: { name: "Судоку", icon: "▦", category: "Логика", description: "Девять цифр. Одно решение.", xp: 30 },
  memory: { name: "Найди пары", icon: "◈", category: "Память", description: "Запомни и собери все пары.", xp: 26 },
  riddles: { name: "Логические задачи", icon: "?", category: "Логика", description: "Замечай связи и находи ответ.", xp: 24 },
  sequences: { name: "Числовые ряды", icon: "∴", category: "Мышление", description: "Разгадай правило следующего числа.", xp: 24 },
  tiles: { name: "Пятнашки", icon: "15", category: "Логика", description: "Собери числа по порядку.", xp: 30 },
  pattern: { name: "Матрица памяти", icon: "▧", category: "Память", description: "Увидеть. Запомнить. Повторить.", xp: 26 },
  nonogram: { name: "Японский кроссворд", icon: "▨", category: "Логика", description: "Восстанови узор по числам.", xp: 30 },
  arithmetic: { name: "Устный счёт", icon: "+", category: "Мышление", description: "Считай в уме, шаг за шагом.", xp: 24 },
  rebuses: { name: "Шифры и ребусы", icon: "АБ", category: "Мышление", description: "Раскрой слово за символами.", xp: 24 },
  stroop: { name: "Цвет и внимание", icon: "◎", category: "Внимание", description: "Выбери цвет, которым написано слово.", xp: 26 },
};
const GAME_NAMES = Object.fromEntries(Object.entries(GAME_CATALOG).map(([id, game]) => [id, game.name]));
const GAME_ORDER = Object.keys(GAME_CATALOG);
const MAX_LEVEL = 100;
const XP_PER_LEVEL = 100;
const DIFFICULTIES = { easy: { label: "Легко", clues: 45, pairs: 4 }, medium: { label: "Средне", clues: 37, pairs: 8 }, hard: { label: "Сложно", clues: 30, pairs: 12 } };
const RANKS = [[1,"Новичок"],[3,"Практик"],[6,"Мыслитель"],[11,"Тактик"],[21,"Мастер"],[41,"Легенда"],[81,"Виртуоз"],[151,"Стратег"],[301,"Архитектор мысли"]];
const ACHIEVEMENT_CATALOG = [
  ["first_game","Первый ход","Заверши первую партию","✦"], ["ten_games","Вошёл в ритм","Заверши 10 партий","↗"],
  ["hundred_games","Большая сотня","Заверши 100 партий","◎"], ["no_hints_five","Сам справился","Пять партий без подсказок","◇"],
  ["streak_three","Три дня в игре","Играй три дня подряд","⌁"], ["streak_seven","Полная неделя","Играй семь дней подряд","⌁"],
  ["streak_thirty","Привычка играть","Играй 30 дней подряд","⌁"], ["all_games","Любопытство","Заверши партию в каждой из десяти игр","✧"],
  ["chapter_two","Вторая глава","Пройди 10 уровней одной кампании","✧"], ["campaign_100","Полная дистанция","Пройди целиком одну кампанию","✺"],
].map(([id,title,description,icon]) => ({id,title,description,icon}));
GAME_ORDER.forEach((game) => ACHIEVEMENT_CATALOG.push({id:`${game}_five`,title:`Практик: ${GAME_NAMES[game]}`,description:"Заверши пять партий в этой игре",icon:"◇"}));
GAME_ORDER.forEach((game) => ACHIEVEMENT_CATALOG.push({id:`${game}_100`,title:`Мастер: ${GAME_NAMES[game]}`,description:"Все 100 уровней кампании пройдены",icon:"✺"}));
const MEMORY_SYMBOLS = ["●","▲","■","★","☀","☂","♠","♥","♣","♫","☾","✿"];
const FULL_MASK = 0b1111111110;
const INK_COLORS = [{name:"Красный",color:"#B52F45"},{name:"Синий",color:"#3567DC"},{name:"Зелёный",color:"#217457"},{name:"Жёлтый",color:"#916300"}];
let randomGenerator = null;
function random() { return randomGenerator ? randomGenerator() : Math.random(); }
function int(min, max) { return min + Math.floor(random() * (max-min+1)); }
function shuffle(items) { const copy=[...items]; for(let i=copy.length-1;i>0;i--) { const j=int(0,i); [copy[i],copy[j]]=[copy[j],copy[i]]; } return copy; }
function withSeed(key, callback) {
  let seed=2166136261; for(const char of key) seed=Math.imul(seed^char.charCodeAt(0),16777619);
  const previous=randomGenerator;
  randomGenerator=() => { seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
  try { return callback(); } finally { randomGenerator=previous; }
}
function levelConfig(number, game = "sudoku") {
  const difficulty=number<=20?"easy":number<=60?"medium":"hard";
  return {number,game,gameName:GAME_NAMES[game],difficulty,difficultyName:DIFFICULTIES[difficulty].label,chapter:Math.floor((number-1)/10)+1};
}
function question(question, answer, hint) { return {question,answers:[String(answer)],hint}; }
const WORDS = [
  ["ОРБИТА","путь небесного тела"],["МАЯК","помогает кораблям найти берег"],["КОМПАС","показывает стороны света"],
  ["РАКЕТА","летательный аппарат для космоса"],["ПЛАНЕТА","небесное тело вокруг звезды"],["АЛМАЗ","очень твёрдый минерал"],
  ["ТУМАН","облако у поверхности земли"],["МОЛНИЯ","электрический разряд в небе"],["РАДУГА","цветная дуга после дождя"],
  ["КРИСТАЛЛ","твёрдое тело с упорядоченным строением"],["ПАРУС","ловит ветер на судне"],["ОСТРОВ","суша среди воды"],
  ["ЗЕРКАЛО","показывает отражение"],["МОЗАИКА","изображение из маленьких частей"],["СПИРАЛЬ","линия, закрученная вокруг центра"],
  ["ЛАБИРИНТ","сеть запутанных ходов"],["КАМЕРА","прибор для съёмки"],["ПРИЗМА","преломляет свет"],
  ["СЕКУНДА","шестидесятая часть минуты"],["КНИГА","собрание страниц под обложкой"],["БАРХАТ","мягкая ткань с ворсом"],
  ["ПРУЖИНА","упругая закрученная деталь"],["ФОНАРЬ","источник света для улицы"],["ВУЛКАН","гора, из которой выходит лава"],
  ["ЛЕДНИК","большой массив медленно движущегося льда"],["СПУТНИК","вращается вокруг планеты"],["ГОРИЗОНТ","видимая граница неба и земли"],
  ["КАСКАД","ряд уступов водопада"],["ПОТОК","масса движущейся воды"],["ПАЛИТРА","набор красок художника"],
  ["КЛАВИША","её нажимают на пианино"],["МЕТРОНОМ","отмеряет музыкальный темп"],["АККОРД","несколько звуков одновременно"],
  ["ФРАГМЕНТ","часть целого"],["КОНТУР","линия по краю фигуры"],["МАСШТАБ","отношение размера изображения к предмету"],
  ["ПОЛЮС","крайняя точка земной оси"],["ЭКВАТОР","делит Землю на два полушария"],["ФАКЕЛ","переносной огонь на рукоятке"],
  ["ЯКОРЬ","удерживает судно на месте"],["МАРШРУТ","путь следования"],["ПОРТАЛ","вход или проход"],["АРКА","перекрытие в форме дуги"],
  ["ШАХМАТЫ","игра с королём и ферзём"],["ФЕРЗЬ","самая подвижная шахматная фигура"],["ФОРМУЛА","правило, записанное символами"],
  ["ВЕКТОР","направленный отрезок"],["РАДИУС","отрезок от центра окружности до неё"],["СИММЕТРИЯ","соответствие частей при отражении"],
  ["ПАЗЛ","картинка, собираемая из деталей"],["СИГНАЛ","условный знак или импульс"],["КОД","система условных обозначений"],
];
const REBUSES = [["7Я","семья"],["100Л","стол"],["100ЛБ","столб"],["100ЛИЦА","столица"],["С3Ж","стриж"],["3БУНА","трибуна"],["И100РИЯ","история"],["100РОЖ","сторож"],["ПИ100ЛЕТ","пистолет"],["100ЯНКА","стоянка"],["40А","сорока"],["3ТОН","тритон"]];
const ALPHABET = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ";
function makeQuestions(type, n) {
  const count=3+Math.floor((n-1)/20), tier=n<=20?0:n<=60?1:2;
  return Array.from({length:count},(_,index) => {
    const a=int(2,8+tier*12), b=int(2,7+tier*5);
    if(type==="arithmetic") {
      const mode=(n+index)%(tier===0?2:tier===1?4:6);
      if(mode===0) return question(`${a} + ${b} = ?`,a+b,"Сложи оба числа.");
      if(mode===1) return question(`${a+b} − ${b} = ?`,a,"Вычитай по частям: сначала десятки, затем единицы.");
      if(mode===2) return question(`${a} × ${b} = ?`,a*b,`Это ${b} слагаемых по ${a}.`);
      if(mode===3) return question(`${a*b} ÷ ${b} = ?`,a,`Какое число при умножении на ${b} даёт ${a*b}?`);
      if(mode===4) return question(`(${a} + ${b}) × ${tier+2} = ?`,(a+b)*(tier+2),"Сначала выполни действие в скобках.");
      return question(`${a*b} ÷ ${b} + ${a+b} = ?`,2*a+b,"Сначала деление, затем сложение.");
    }
    if(type==="sequences") {
      const mode=(n+index)%(tier===0?2:tier===1?4:6); let seq, hint;
      if(mode===0) { seq=Array.from({length:6},(_,i)=>a+i*b);hint=`Каждый шаг прибавляет ${b}.`; }
      if(mode===1) { const ratio=2+tier;seq=Array.from({length:6},(_,i)=>a*ratio**i);hint=`Каждый шаг умножает на ${ratio}.`; }
      if(mode===2) { seq=Array.from({length:6},(_,i)=>(i+1)**2+a);hint=`К квадратичным числам прибавлено ${a}.`; }
      if(mode===3) { seq=[a,b];while(seq.length<6) seq.push(seq.at(-1)+seq.at(-2));hint="Следующее число — сумма двух предыдущих."; }
      if(mode===4) { seq=Array.from({length:6},(_,i)=>i%2===0?a+Math.floor(i/2)*3:b+Math.floor(i/2)*5);hint="Смотри отдельно на нечётные и чётные позиции: шаги 3 и 5."; }
      if(mode===5) { seq=Array.from({length:6},(_,i)=>a+(i+1)*(i+2)/2);hint="Разности соседних чисел увеличиваются на единицу."; }
      return question(seq.slice(0,-1).join(" · ")+" · ?",seq.at(-1),hint);
    }
    if(type==="rebuses") {
      const [word,meaning]=WORDS[(n*7+index*13)%WORDS.length], mode=(n+index)%4;
      if(mode===0) { const item=REBUSES[(n+index)%REBUSES.length];return question(`Прочитай ребус: ${item[0]}`,item[1],"Замени цифры словами, затем прочитай всё слитно."); }
      if(mode===1) return question(`${[...word].reverse().join("")} — какое слово спрятано?`,word,"Прочитай буквы справа налево.");
      if(mode===2) return question(`${[...word].map(c=>ALPHABET.indexOf(c)+1).join(" · ")} — расшифруй слово.`,word,`Числа — номера букв: А=1, Б=2, Ё=7. Подсказка: ${meaning}.`);
      const shift=1+Math.floor(n/25), encoded=[...word].map(c=>ALPHABET[(ALPHABET.indexOf(c)+shift)%33]).join("");
      return question(`${encoded} · сдвиг +${shift}. Найди исходное слово.`,word,`Сдвинь каждую букву на ${shift} назад в русском алфавите с Ё. Это ${meaning}.`);
    }
    const mode=(n+index)%(tier===0?5:tier===1?8:11);
    if(mode===0) return question(`В очереди ${a+b+1} человек. Перед тобой ${a}. Сколько человек после тебя?`,b,"Не забудь учесть себя.");
    if(mode===1) return question(`У кроликов и уток вместе ${a*4+b*2} лап. Если всего животных ${a+b}, сколько среди них кроликов?`,a,"Если бы все были утками, лап было бы по две. Каждая лишняя пара — один кролик.");
    if(mode===2) return question(`Два друга вместе набрали ${a+b+a} очков. Один набрал на ${b} больше. Сколько очков у другого?`,a,"Вычти разницу из общей суммы и раздели остаток пополам.");
    if(mode===3) return question(`${a} человек обменялись рукопожатиями: каждый с каждым ровно один раз. Сколько рукопожатий?`,a*(a-1)/2,"Посчитай пары людей; каждое рукопожатие при прямом подсчёте учитывается дважды.");
    if(mode===4) return question(`Лестница имеет ${a*b} ступеней. Ты поднимаешься сразу на ${b} ступени за шаг. Сколько шагов нужно?`,a,"Число ступеней делится на длину шага.");
    if(mode===5) return question(`В ${a} коробок кладут шары. Какое минимальное число шаров гарантирует, что хотя бы в одной коробке окажется ${b+1} шаров?`,a*b+1,`Сначала заполни каждую из ${a} коробок ровно ${b} шарами, затем добавь один.`);
    if(mode===6) { const both=int(1,Math.min(a,b));return question(`Шахматами увлекаются ${a} человек, пазлами — ${b}. Хотя бы одним из этих занятий увлекаются ${a+b-both}. Сколько увлекаются обоими?`,both,"При сложении двух групп общие участники были посчитаны дважды."); }
    if(mode===7) return question(`На отрезке отмечены ${a} разные точки. Сколько разных отрезков можно выбрать с концами в этих точках?`,a*(a-1)/2,"Каждый отрезок определяется парой различных точек.");
    if(mode===8) { const rows=int(2,4),cols=int(2,5);return question(`Сетка ${rows} × ${cols} клеток. Сколько в ней прямоугольников, включая составленные из нескольких клеток?`,rows*(rows+1)*cols*(cols+1)/4,"Выбери две горизонтальные и две вертикальные линии сетки."); }
    if(mode===9) return question(`В турнире ${a+b} участников. Каждый матч навылет исключает одного. Сколько матчей нужно, чтобы остался один победитель?`,a+b-1,"Каждый матч убирает из борьбы ровно одного участника.");
    return question(`В мешке шарики ${a} разных цветов, каждого цвета очень много. Сколько нужно достать вслепую, чтобы гарантированно иметь два одного цвета?`,a+1,"В худшем случае первые шарики все разных цветов.");
  });
}

function lineClues(line) {
  const clues=[]; let run=0;
  for(const bit of [...line,0]) { if(bit)run++;else if(run){clues.push(run);run=0;} }
  return clues.length?clues:[0];
}
function countNonogramSolutions(rows, cols, limit=2) {
  const size=rows.length, options=rows.map(clue=>Array.from({length:1<<size},(_,mask)=>Array.from({length:size},(_,i)=>(mask>>i)&1)).filter(line=>lineClues(line).join()==clue.join()));
  const colOptions=cols.map(clue=>Array.from({length:1<<size},(_,mask)=>Array.from({length:size},(_,i)=>(mask>>i)&1)).filter(line=>lineClues(line).join()==clue.join()));
  let count=0; const chosen=[];
  function visit(row) { if(count>=limit)return;if(row===size){count++;return;} for(const candidate of options[row]){chosen[row]=candidate;if(colOptions.every((lines,col)=>lines.some(line=>chosen.slice(0,row+1).every((r,i)=>r[col]===line[i]))))visit(row+1);if(count>=limit)return;} }
  visit(0);return count;
}
function generateNonogram(n) {
  for(let attempt=0;attempt<200;attempt++) {
    const solution=Array.from({length:25},()=>random()<(n<=20?.65:n<=60?.55:.45)?1:0);
    const rows=Array.from({length:5},(_,r)=>lineClues(solution.slice(r*5,r*5+5))),cols=Array.from({length:5},(_,c)=>lineClues(Array.from({length:5},(_,r)=>solution[r*5+c])));
    if(solution.some(Boolean)&&solution.some(x=>!x)&&countNonogramSolutions(rows,cols)===1) return {solution,rowClues:rows,colClues:cols,board:Array(25).fill(0)};
  }
  throw new Error("Не удалось собрать однозначное поле. Попробуй ещё раз.");
}
function generateTiles(n) {
  const size=n<=40?3:4, board=Array.from({length:size*size},(_,i)=>(i+1)%(size*size));
  let last=-1;
  for(let step=0;step<8+n;step++) {
    const blank=board.indexOf(0), row=Math.floor(blank/size),col=blank%size;
    const adjacent=[row>0?blank-size:-1,row<size-1?blank+size:-1,col>0?blank-1:-1,col<size-1?blank+1:-1].filter(i=>i>=0&&i!==last);
    const next=adjacent[int(0,adjacent.length-1)];[board[blank],board[next]]=[board[next],board[blank]];last=blank;
  }
  if(board.every((v,i)=>v===(i+1)%(size*size))) [board[board.length-1],board[board.length-2]]=[board[board.length-2],board[board.length-1]];
  return {size,board,history:[]};
}
function createPuzzle(type,difficulty,levelNumber,sessionId) {
  const n=levelNumber||({easy:10,medium:40,hard:80}[difficulty]);
  const make=()=> {
    const common={type,difficulty,levelNumber,sessionId:sessionId||null,elapsed:0,startedAt:Date.now(),completed:false,hints:0,moves:0,schemaVersion:3};
    if(type==="sudoku") {const data=generateSudoku(difficulty,n);return {...common,board:data.puzzle,solution:data.solution,given:data.given,selected:-1};}
    if(type==="memory") {const pairs=Math.min(12,4+Math.floor((n-1)/12)),symbols=shuffle(MEMORY_SYMBOLS).slice(0,pairs);return {...common,cards:shuffle([...symbols,...symbols]).map((value,id)=>({id,value,open:false,matched:false}))};}
    if(type==="tiles")return {...common,...generateTiles(n)};
    if(type==="nonogram")return {...common,...generateNonogram(n),markMode:"fill"};
    if(type==="pattern") {const size=n<=20?3:n<=60?4:5,rounds=3+Math.floor((n-1)/25),count=Math.min(size*size-2,3+Math.floor((n-1)/12));return {...common,size,round:0,patterns:Array.from({length:rounds},()=>shuffle(Array.from({length:size*size},(_,i)=>i)).slice(0,count)),selectedCells:[],revealing:false,ready:false,revealDuration:Math.max(1000,2600-n*13)};}
    if(type==="stroop")return {...common,index:0,questions:Array.from({length:5+Math.floor((n-1)/10)},()=>{const ink=int(0,3);return {ink,word:(ink+int(1,3))%4};})};
    return {...common,index:0,questions:makeQuestions(type,n),hintShown:false};
  };
  return levelNumber?withSeed(`teramont-v3:${type}:${levelNumber}`,make):make();
}

function makeSolvedGrid() {
  const groups = [0, 1, 2];
  const rows = shuffle(groups).flatMap((band) => shuffle(groups).map((offset) => band * 3 + offset));
  const cols = shuffle(groups).flatMap((stack) => shuffle(groups).map((offset) => stack * 3 + offset));
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  return rows.flatMap((row) => cols.map((column) => {
    const base = (row * 3 + Math.floor(row / 3) + column) % 9;
    return digits[base];
  }));
}

function countSolutions(board, stopAt = 2) {
  const rowMasks = Array(9).fill(0);
  const colMasks = Array(9).fill(0);
  const boxMasks = Array(9).fill(0);
  for (let index = 0; index < 81; index += 1) {
    const value = board[index];
    if (!value) continue;
    const row = Math.floor(index / 9);
    const col = index % 9;
    const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
    const bit = 1 << value;
    if ((rowMasks[row] & bit) || (colMasks[col] & bit) || (boxMasks[box] & bit)) return 0;
    rowMasks[row] |= bit;
    colMasks[col] |= bit;
    boxMasks[box] |= bit;
  }

  let solutions = 0;
  function search() {
    if (solutions >= stopAt) return;
    let bestIndex = -1;
    let bestMask = 0;
    let fewest = 10;
    for (let index = 0; index < 81; index += 1) {
      if (board[index]) continue;
      const row = Math.floor(index / 9);
      const col = index % 9;
      const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
      const mask = FULL_MASK & ~(rowMasks[row] | colMasks[col] | boxMasks[box]);
      let count = 0;
      for (let bits = mask; bits; bits &= bits - 1) count += 1;
      if (count === 0) return;
      if (count < fewest) {
        bestIndex = index;
        bestMask = mask;
        fewest = count;
        if (count === 1) break;
      }
    }
    if (bestIndex < 0) {
      solutions += 1;
      return;
    }
    const row = Math.floor(bestIndex / 9);
    const col = bestIndex % 9;
    const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
    for (let bits = bestMask; bits; bits &= bits - 1) {
      const bit = bits & -bits;
      const value = Math.round(Math.log2(bit));
      board[bestIndex] = value;
      rowMasks[row] |= bit;
      colMasks[col] |= bit;
      boxMasks[box] |= bit;
      search();
      board[bestIndex] = 0;
      rowMasks[row] ^= bit;
      colMasks[col] ^= bit;
      boxMasks[box] ^= bit;
      if (solutions >= stopAt) return;
    }
  }
  search();
  return solutions;
}

function generateSudoku(difficulty, level = 10) {
  const solution = makeSolvedGrid();
  const puzzle = [...solution];
  const target = Math.max(30, 48 - Math.floor(level * .18));
  const positions = shuffle(Array.from({ length: 81 }, (_, index) => index));
  let clues = 81;
  for (const index of positions) {
    if (clues <= target) break;
    const previous = puzzle[index];
    puzzle[index] = 0;
    if (countSolutions(puzzle) === 1) clues -= 1;
    else puzzle[index] = previous;
  }
  return { puzzle, solution, given: puzzle.map((value) => value !== 0) };
}

function sudokuConflicts(board) {
  const conflicts = new Set();
  const checkGroup = (indices) => {
    const places = new Map();
    indices.forEach((index) => {
      const value = board[index];
      if (!value) return;
      if (!places.has(value)) places.set(value, []);
      places.get(value).push(index);
    });
    places.forEach((group) => { if (group.length > 1) group.forEach((index) => conflicts.add(index)); });
  };
  for (let row = 0; row < 9; row += 1) checkGroup(Array.from({ length: 9 }, (_, col) => row * 9 + col));
  for (let col = 0; col < 9; col += 1) checkGroup(Array.from({ length: 9 }, (_, row) => row * 9 + col));
  for (let boxRow = 0; boxRow < 3; boxRow += 1) {
    for (let boxCol = 0; boxCol < 3; boxCol += 1) {
      const cells = [];
      for (let row = 0; row < 3; row += 1) for (let col = 0; col < 3; col += 1) cells.push((boxRow * 3 + row) * 9 + boxCol * 3 + col);
      checkGroup(cells);
    }
  }
  return conflicts;
}

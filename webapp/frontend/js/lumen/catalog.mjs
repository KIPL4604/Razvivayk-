// Art style is shared; color belongs to an entity or biome, never the whole game.
export const MAX_WEAPON_STAGE=8;
export const MAPS=Object.freeze({
  garden:{name:'Биосад',sector:'БИОСАД 07 / СЕКТОР МАЯКА',goal:30,next:'quarry',hp:1,tiles:'tiles',props:'garden',accent:'#83cda4'},
  quarry:{name:'Лунный карьер',sector:'ЛУННЫЙ КАРЬЕР / МИНЕРАЛЬНЫЙ РАЗЛОМ',goal:35,next:'crater',hp:1.2,tiles:'quarry-tiles',props:'quarry-props',accent:'#d7b8ef'},
  crater:{name:'Кратер роя',sector:'КРАТЕР РОЯ / ЗАМКНУТОЕ ГНЕЗДО',goal:40,next:null,hp:1.35,tiles:'crater-tiles',props:'crater-props',accent:'#e5b783',bossGoal:true},
});
export const CHARACTERS=Object.freeze({
  scout:{name:'Следопыт',hp:110,speed:160,weapon:'spark',price:0,accent:'#efbe7c',story:'Медный фонарь ищет ближайшую цель.'},
  keeper:{name:'Хранитель',hp:145,speed:142,weapon:'pulse',price:0,accent:'#c1a4eb',story:'Тяжёлый молот выпускает круговую волну.'},
  alchemist:{name:'Алхимик',hp:105,speed:155,weapon:'flame',price:120,accent:'#f27358',story:'Бросает огненные колбы и оставляет пламя.'},
  ranger:{name:'Охотница',hp:100,speed:175,weapon:'ice',price:200,accent:'#8de8ee',story:'Ледяной арбалет замедляет преследователей.'},
  duelist:{name:'Дуэлянт',hp:120,speed:165,weapon:'orbit',price:320,accent:'#aabaff',story:'Лунный клинок защищает на близкой дистанции.'},
  stormcaller:{name:'Грозовик',hp:115,speed:150,weapon:'storm',price:450,accent:'#ffe17c',story:'Жезл передаёт молнию от врага к врагу.'},
  artificer:{name:'Механист',hp:115,speed:160,weapon:'chakram',price:540,accent:'#73dfcc',story:'Дисковый механизм перескакивает между целями.'},
  sentinel:{name:'Копейщик',hp:135,speed:152,weapon:'spear',price:620,accent:'#a4d7ee',story:'Кристальное копьё прошивает целую линию врагов.'},
  tinkerer:{name:'Мастер',hp:115,speed:166,weapon:'fan',price:680,accent:'#8fd4aa',story:'Веер из медных игл накрывает сразу несколько целей.'},
  cantor:{name:'Звонарь',hp:150,speed:140,weapon:'bell',price:740,accent:'#89c9e7',story:'Бронзовый колокол отбрасывает окруживший рой.'},
  astronomer:{name:'Астроном',hp:100,speed:158,weapon:'meteor',price:860,accent:'#c5a0ed',story:'Отмечает врагов и обрушивает на них звёздные осколки.'},
  heliarch:{name:'Гелиарх',hp:125,speed:148,weapon:'sunlance',price:1100,accent:'#f7d86a',story:'Солнечное копьё прожигает строй и наносит больше урона элите и стражам.'},
});
export const RARITIES=Object.freeze({
  common:{title:'Обычное',color:'#b8c1ca',ink:'#47525c',weight:63},
  rare:{title:'Редкое',color:'#83df9b',ink:'#25683b',weight:27},
  epic:{title:'Эпическое',color:'#c8a0f2',ink:'#713d99',weight:8.5},
  legendary:{title:'Легендарное',color:'#f8dc65',ink:'#725300',weight:1.5},
});
const rarityById={spark:'common',orbit:'common',pulse:'common',cleaver:'common',flame:'rare',ice:'rare',thorn:'rare',chakram:'rare',spear:'rare',storm:'epic',prism:'epic',cyclone:'epic',briar:'epic',sunrise:'epic'};
const definitions={
  spark:{index:0,title:'Световой разряд',short:'Разряд',verb:'Бьёт ближайшего',color:'#efbe7c',className:'amber',max:MAX_WEAPON_STAGE},
  orbit:{index:1,title:'Лунные клинки',short:'Клинки',verb:'Вращаются вокруг тебя',color:'#aabaff',className:'blue',max:MAX_WEAPON_STAGE},
  pulse:{index:2,title:'Молот рассвета',short:'Волна',verb:'Бьёт кругом и отталкивает',color:'#c1a4eb',className:'violet',max:MAX_WEAPON_STAGE},
  flame:{index:3,title:'Огненная колба',short:'Пламя',verb:'Оставляет горящее поле',color:'#f27358',className:'coral',max:MAX_WEAPON_STAGE},
  ice:{index:4,title:'Ледяной арбалет',short:'Мороз',verb:'Замедляет; с III — пробивает',color:'#8de8ee',className:'cyan',max:MAX_WEAPON_STAGE},
  storm:{index:5,title:'Грозовой жезл',short:'Гроза',verb:'Молния скачет между врагами',color:'#ffe17c',className:'gold',max:MAX_WEAPON_STAGE},
  cleaver:{index:6,title:'Возвратные секиры',short:'Секиры',verb:'Летят вперёд и возвращаются',color:'#e9a67b',className:'copper',max:MAX_WEAPON_STAGE},
  thorn:{index:7,title:'Терновый посох',short:'Тернии',verb:'Выращивает колючие ловушки',color:'#b4de8b',className:'leaf',max:MAX_WEAPON_STAGE},
  chakram:{index:8,title:'Рикошетный диск',short:'Рикошет',verb:'Отскакивает к новым целям',color:'#73dfcc',className:'mint',max:MAX_WEAPON_STAGE},
  spear:{index:9,title:'Кристальное копьё',short:'Копьё',verb:'Прошивает врагов по прямой',color:'#a4d7ee',className:'steel',max:MAX_WEAPON_STAGE},
  prism:{index:10,title:'Призматический луч',short:'Призма',verb:'Прошивает строй и замедляет цели',color:'#89e4dc',className:'prism',max:4,hybrid:true},
  cyclone:{index:11,title:'Грозовой вихрь',short:'Вихрь',verb:'Клинки проводят цепные разряды',color:'#d4b2f1',className:'cyclone',max:4,hybrid:true},
  briar:{index:12,title:'Пепельная оранжерея',short:'Оранжерея',verb:'Горящие тернии замедляют рой',color:'#f3a36e',className:'briar',max:4,hybrid:true},
  sunrise:{index:13,title:'Рассветный возврат',short:'Рассвет',verb:'Круговой залп возвращающихся лезвий',color:'#ffe09a',className:'sunrise',max:4,hybrid:true},
  needle:{index:14,title:'Швейная игла',short:'Игла',verb:'Быстрая очередь пробивает несколько врагов',color:'#d8dedb',className:'needle',max:8,rarity:'common'},
  fan:{index:15,title:'Медный веер',short:'Веер',verb:'Рассыпает иглы широким залпом',color:'#dfb481',className:'fan',max:8,rarity:'common'},
  bell:{index:16,title:'Колокол отлива',short:'Колокол',verb:'Круговой звон отбрасывает толпу',color:'#8fcadf',className:'bell',max:8,rarity:'rare'},
  mine:{index:17,title:'Искровые мины',short:'Мины',verb:'Оставляет ловушки, взрывающиеся при сближении',color:'#90dcaa',className:'mine',max:8,rarity:'rare'},
  frostnova:{index:18,title:'Сердце метели',short:'Метель',verb:'Ледяная волна надолго замедляет врагов',color:'#98e3e9',className:'frostnova',max:8,rarity:'rare'},
  drone:{index:19,title:'Рой светляков',short:'Светляки',verb:'Самонаводящиеся огни прошивают цели',color:'#a5dca1',className:'drone',max:8,rarity:'epic'},
  meteor:{index:20,title:'Звёздный обвал',short:'Обвал',verb:'Отмечает цель и бьёт взрывом с задержкой',color:'#d1a5ee',className:'meteor',max:8,rarity:'epic'},
  gravity:{index:21,title:'Якорь пустоты',short:'Якорь',verb:'Создаёт воронку, стягивающую и замедляющую врагов',color:'#b2a4eb',className:'gravity',max:8,rarity:'epic'},
  sunlance:{index:22,title:'Солнечное копьё',short:'Солнце',verb:'Прожигает строй; ×1,8 урона элите и стражам',color:'#ffe17b',className:'sunlance',max:8,rarity:'legendary'},
  eclipse:{index:23,title:'Нулевое затмение',short:'Затмение',verb:'Мощная круговая вспышка уничтожает вражеские снаряды',color:'#f4d46a',className:'eclipse',max:8,rarity:'legendary'},
};
export const WEAPONS=Object.freeze(Object.fromEntries(Object.entries(definitions).map(([id,w])=>[id,Object.freeze({...w,rarity:w.rarity||rarityById[id]})])));
export const weaponRarity=id=>RARITIES[WEAPONS[id]?.rarity]||RARITIES.common;
export const BASE_WEAPON_IDS=Object.freeze(Object.keys(WEAPONS).filter(id=>!WEAPONS[id].hybrid));
export const HYBRIDS=Object.freeze({
  prism:Object.freeze({requires:['spark','ice'],title:'Призматический луч',hint:'Световой разряд + ледяной арбалет · VIII + VIII'}),
  cyclone:Object.freeze({requires:['orbit','storm'],title:'Грозовой вихрь',hint:'Лунные клинки + грозовой жезл · VIII + VIII'}),
  briar:Object.freeze({requires:['flame','thorn'],title:'Пепельная оранжерея',hint:'Огненная колба + терновый посох · VIII + VIII'}),
  sunrise:Object.freeze({requires:['pulse','cleaver'],title:'Рассветный возврат',hint:'Молот рассвета + возвратные секиры · VIII + VIII'}),
});
export const WEAPON_IDS=Object.freeze(Object.keys(WEAPONS));
export const MAX_WEAPONS=4;
export const MAX_ARTIFACTS=5;
export const ARTIFACTS=Object.freeze({
  collector:{title:'Сборщик кристаллов',short:'Сборщик',color:'#73dfcc',description:'Радиус притяжения +90 за ранг.',max:3,index:0},
  chronogear:{title:'Шестерня хрономанта',short:'Шестерня',color:'#f4ce80',description:'Всё оружие срабатывает на 12% чаще за ранг.',max:3,index:1},
  amplifier:{title:'Лунный резонатор',short:'Резонатор',color:'#d4b2f1',description:'Область действия оружия +12% за ранг.',max:3,index:2},
  aegis:{title:'Оберег маяка',short:'Оберег',color:'#f2a3b7',description:'Входящий урон −2 за ранг, минимум 1.',max:3,index:3},
  laurel:{title:'Лавр хранителя',short:'Лавр',color:'#9bdda3',description:'Полностью блокирует удар. 1/2/3 заряда; один заряд восстанавливается за 20/18/16 с.',max:3,index:4},
  heart:{title:'Живое семя',short:'Семя',color:'#e5a0b0',description:'Восстанавливает 0,4 здоровья в секунду за ранг.',max:3,index:5},
  carapace:{title:'Лунный панцирь',short:'Панцирь',color:'#aebdeb',description:'При здоровье ниже 35% уменьшает входящий урон на 15% за ранг.',max:3,index:6},
  ember:{title:'Ответная искра',short:'Искра',color:'#efaa7e',description:'Полученный удар отвечает круговым уроном: 20 за ранг в радиусе 125.',max:3,index:7},
  compass:{title:'Попутный ветер',short:'Ветер',color:'#a1d9d2',description:'При полном здоровье скорость движения +5% за ранг.',max:3,index:8},
  hourglass:{title:'Песочные часы',short:'Часы',color:'#e4c98c',description:'После полученного или блокированного удара оружие на 2 с срабатывает на 20% чаще за ранг.',max:3,index:9},
});
export const ENEMIES=Object.freeze(['mote','beetle','wasp','crawler','spitter','wisp','quartzling','shardback','moonmoth']);
export const BOSSES=Object.freeze({1:{name:'Шипоносец',sprite:'boss-briar'},2:{name:'Матка роя',sprite:'boss-queen'},3:{name:'Пепельный колосс',sprite:'boss-ash'}});
export function weaponStats(id,stage=1){
  const level=Math.max(1,Math.min(WEAPONS[id]?.max||MAX_WEAPON_STAGE,stage)),count=1+Math.floor((level-1)/2);
  const definitions={
    spark:{count,damage:24+(level-1)*7,cooldown:.7,speed:490,radius:4},
    orbit:{count,damage:28+level*6,cooldown:.23,radius:76+level*6},
    pulse:{count,damage:30+level*10,cooldown:5.5-level*.3,radius:110+level*23},
    flame:{count,damage:14+level*4,cooldown:2.8-level*.12,speed:240,radius:55+level*5},
    ice:{count,damage:20+level*6,cooldown:1.1-level*.06,speed:440,radius:5,pierce:Math.floor((level-1)/2)},
    storm:{count:count+1,damage:32+level*8,cooldown:2.4-level*.13,radius:180},
    cleaver:{count,damage:32+level*8,cooldown:2-level*.08,speed:300,radius:9},
    thorn:{count,damage:18+level*5,cooldown:3.6-level*.16,radius:32+level*3},
    chakram:{count,damage:24+level*7,cooldown:1.7-level*.07,speed:320,radius:10,pierce:1+Math.floor(level/2)},
    spear:{count,damage:28+level*9,cooldown:1.6-level*.06,speed:550,radius:8,pierce:2+Math.floor(level/2)},
    prism:{count:2+level,damage:150+level*30,cooldown:.8-level*.05,speed:620,radius:8,pierce:6},
    cyclone:{count:4+level,damage:55+level*16,cooldown:.8-level*.05,radius:105+level*9},
    briar:{count:3+Math.floor(level/2),damage:63+level*16,cooldown:2.1-level*.12,radius:65+level*5},
    sunrise:{count:6+level,damage:110+level*24,cooldown:2.5-level*.14,speed:300,radius:12},
    needle:{count:1+Math.floor((level-1)/3),damage:16+level*5,cooldown:.48-level*.018,speed:680,radius:3,pierce:2+Math.floor(level/3)},
    fan:{count:3+Math.floor((level-1)/2),damage:18+level*5,cooldown:1.45-level*.055,speed:440,radius:5},
    bell:{count:1,damage:30+level*11,cooldown:3.4-level*.15,radius:120+level*15},
    mine:{count:1+Math.floor((level-1)/3),damage:65+level*19,cooldown:3.5-level*.12,radius:65+level*6},
    frostnova:{count:1,damage:16+level*6,cooldown:3.5-level*.13,radius:125+level*14},
    drone:{count:2+Math.floor((level-1)/2),damage:22+level*8,cooldown:1.9-level*.075,speed:390,radius:6,pierce:1+Math.floor(level/3)},
    meteor:{count:1+Math.floor((level-1)/3),damage:110+level*31,cooldown:4.9-level*.15,radius:75+level*8},
    gravity:{count:1+Math.floor((level-1)/4),damage:8+level*4,cooldown:4.8-level*.15,radius:90+level*9},
    sunlance:{count:1+Math.floor((level-1)/4),damage:110+level*29,cooldown:2.9-level*.11,radius:12+level*1.5,range:650},
    eclipse:{count:1,damage:110+level*32,cooldown:5.8-level*.2,radius:190+level*18},
  };
  return definitions[id];
}
export function weaponSummary(id,stage){
  const current=weaponStats(id,stage),next=weaponStats(id,stage+1);
  if(!current)return '';
  if(HYBRIDS[id]&&!stage)return WEAPONS[id].verb+' · гибрид I / IV';
  if(stage<1)return `${WEAPONS[id].verb} · стадия I`;
  const unit=id==='storm'?'цели':id==='orbit'?'клинка':id==='pulse'?'волны':id==='thorn'?'ловушки':'снаряда';
  return next.count>current.count?`${current.count} → ${next.count} ${unit} · больше урон`:'Больше урон · сильнее действие';
}

// Art style is shared; color belongs to an entity or biome, never the whole game.
export const CHARACTERS=Object.freeze({
  scout:{name:'Следопыт',hp:110,speed:160,weapon:'spark',price:0,accent:'#efbe7c',story:'Медный фонарь ищет ближайшую цель.'},
  keeper:{name:'Хранитель',hp:145,speed:142,weapon:'pulse',price:0,accent:'#c1a4eb',story:'Тяжёлый молот выпускает круговую волну.'},
  alchemist:{name:'Алхимик',hp:105,speed:155,weapon:'flame',price:120,accent:'#f27358',story:'Бросает огненные колбы и оставляет пламя.'},
  ranger:{name:'Охотница',hp:100,speed:175,weapon:'ice',price:200,accent:'#8de8ee',story:'Ледяной арбалет замедляет преследователей.'},
  duelist:{name:'Дуэлянт',hp:120,speed:165,weapon:'orbit',price:320,accent:'#aabaff',story:'Лунный клинок защищает на близкой дистанции.'},
  stormcaller:{name:'Грозовик',hp:115,speed:150,weapon:'storm',price:450,accent:'#ffe17c',story:'Жезл передаёт молнию от врага к врагу.'},
});
export const WEAPONS=Object.freeze({
  spark:{index:0,title:'Световой разряд',short:'Разряд',verb:'Бьёт ближайшего',color:'#efbe7c',className:'amber',max:5},
  orbit:{index:1,title:'Лунные клинки',short:'Клинки',verb:'Вращаются вокруг тебя',color:'#aabaff',className:'blue',max:5},
  pulse:{index:2,title:'Молот рассвета',short:'Волна',verb:'Бьёт кругом и отталкивает',color:'#c1a4eb',className:'violet',max:5},
  flame:{index:3,title:'Огненная колба',short:'Пламя',verb:'Оставляет горящее поле',color:'#f27358',className:'coral',max:5},
  ice:{index:4,title:'Ледяной арбалет',short:'Мороз',verb:'Замедляет; с III — пробивает',color:'#8de8ee',className:'cyan',max:5},
  storm:{index:5,title:'Грозовой жезл',short:'Гроза',verb:'Молния скачет между врагами',color:'#ffe17c',className:'gold',max:5},
  cleaver:{index:6,title:'Возвратные секиры',short:'Секиры',verb:'Летят вперёд и возвращаются',color:'#e9a67b',className:'copper',max:5},
  thorn:{index:7,title:'Терновый посох',short:'Тернии',verb:'Выращивает колючие ловушки',color:'#b4de8b',className:'leaf',max:5},
});
export const WEAPON_IDS=Object.freeze(Object.keys(WEAPONS));
export const MAX_WEAPONS=6;
export const ENEMIES=Object.freeze(['mote','beetle','wasp','crawler','spitter','wisp']);
export const BOSSES=Object.freeze({1:{name:'Шипоносец',sprite:'boss-briar'},2:{name:'Матка роя',sprite:'boss-queen'},3:{name:'Пепельный колосс',sprite:'boss-ash'}});
export function weaponStats(id,stage=1){
  const level=Math.max(1,Math.min(5,stage)),count=1+Math.floor((level-1)/2);
  const definitions={
    spark:{count,damage:24+(level-1)*7,cooldown:.7,speed:490,radius:4},
    orbit:{count,damage:28+level*6,cooldown:.23,radius:76+level*6},
    pulse:{count,damage:30+level*10,cooldown:5.5-level*.3,radius:110+level*23},
    flame:{count,damage:14+level*4,cooldown:2.8-level*.12,speed:240,radius:55+level*5},
    ice:{count,damage:20+level*6,cooldown:1.1-level*.06,speed:440,radius:5,pierce:Math.floor((level-1)/2)},
    storm:{count:count+1,damage:32+level*8,cooldown:2.4-level*.13,radius:180},
    cleaver:{count,damage:32+level*8,cooldown:2-level*.08,speed:300,radius:9},
    thorn:{count,damage:18+level*5,cooldown:3.6-level*.16,radius:32+level*3},
  };
  return definitions[id];
}
export function weaponSummary(id,stage){
  const current=weaponStats(id,stage),next=weaponStats(id,stage+1);
  if(!current)return '';
  if(stage<1)return `${WEAPONS[id].verb} · стадия I`;
  const unit=id==='storm'?'цели':id==='orbit'?'клинка':id==='pulse'?'волны':id==='thorn'?'ловушки':'снаряда';
  return next.count>current.count?`${current.count} → ${next.count} ${unit} · больше урон`:'Больше урон · сильнее действие';
}

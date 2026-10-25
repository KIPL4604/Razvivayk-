// Original laboratory: doors have landings; floor levels and shafts serve human staff.
export const TILE=24,COLS=32,ROWS=30,WIDTH=COLS*TILE,HEIGHT=ROWS*TILE;
export const LEGACY_LAYOUT=Object.freeze({enemies:[1,0,4,1,0,2],objects:[4,2,3,4,3,4],lamps:[5,4,5,5,5,5]});
function room(id,title,subtitle,{entry=672,exit=672,walls=[],ladders=[],decor=[],lights=[],vent=null,gate=null,people=[],props=[],extras=[],spawn=null}={}){
  const cells=new Uint8Array(COLS*ROWS);
  const fill=(x,y,w,h,value)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)cells[j*COLS+i]=value;};
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(x<2||x>29||y<2||y>=ROWS-2)cells[y*COLS+x]=1;
  for(const [x,y,w,h]of walls)fill(x,y,w,h,1);
  const portals={entry:id?{x:0,y:entry-96,w:48,h:96,floor:entry}:null,exit:{x:720,y:exit-96,w:48,h:96,floor:exit}};
  for(const p of Object.values(portals))if(p)fill(p.x/TILE,p.y/TILE,p.w/TILE,p.h/TILE,0);
  const door=gate?{...gate,y:gate.floor-96,w:24,h:96}:null;
  if(door)fill(door.x/TILE,door.y/TILE,1,4,0);
  if(vent)fill(vent.x/TILE,vent.y/TILE,vent.w/TILE,1,0);
  for(const [x,top]of ladders){const col=Math.floor(x/TILE);fill(col-1,top/TILE,3,1,0);}
  const objects=props.map((p,i)=>({id:`${id}:o${i}`,kind:p[0],x:p[1],y:p[2],...(p[0]==='tank'?{bank:0}:{}),...(p[0]==='crate'?{vx:0,vy:0,spin:0,angle:0,thrown:false}:{}),...(p[0]==='nest'?{lit:false}: {})}));
  for(let i=0;i<lights.length;i++){
    const [x,y]=lights[i];let mountY=48;
    for(let row=Math.floor(y/TILE)-1;row>=0;row--)if(cells[row*COLS+Math.floor(x/TILE)]){mountY=(row+1)*TILE;break;}
    objects.push({id:`${id}:lamp${i}`,kind:'lamp',x,y,mountY,broken:false});
  }
  const v3Objects=objects.length;
  for(const extra of extras)objects.push({...extra,id:`${id}:${extra.id}`,broken:false,hp:extra.kind==='glass'?1:3});
  return Object.freeze({id,title,subtitle,cells,portals,spawn:spawn||[92,entry-40],walls,ladders,decor,v3Objects,
    legacyObjects:LEGACY_LAYOUT.objects[id],vent:vent?{...vent,h:24}:null,gate:door,
    vines:objects.filter(o=>o.kind==='nest').map(o=>({x:o.x-32,y:o.y-96,w:112,h:190})),
    enemies:people.map((p,i)=>({id:`${id}:e${i}`,kind:p[0],x:p[1],y:(p[2]||672)-26,dir:-1,home:p[1],hp:p[0]==='tech'?3:p[0]==='flamer'?6:5})),objects});
}
export const ROOMS=Object.freeze([
  room(0,'01 / Изолятор','Поднимись к посту наблюдения. Рычаг открывает дверь на среднем этаже.',{
    spawn:[184,620],exit:456,
    walls:[[2,10,9,1],[15,10,15,1],[2,19,10,1],[17,19,13,1],[27,2,1,26]],
    ladders:[[252,240,456],[492,456,672]],
    decor:[[0,104,240,43,94],[1,176,240,47,80],[5,412,456,100,48],[2,350,672,70,169],[2,438,672,70,169],[6,610,240,43,79]],
    lights:[[112,100],[390,100],[620,294],[130,510],[560,510]],
    gate:{id:'isolation',kind:'lever',x:648,floor:456},people:[['tech',396,672]],
    props:[['capsule',184,646],['lever',554,430],['crate',468,646],['nest',76,616]],
    extras:[{id:'observation-glass',kind:'glass',x:360,y:208,w:24,h:64},{id:'service-panel',kind:'panel',x:586,y:653,w:24,h:38}]}),
  room(1,'02 / Сервисный канал','Людская дверь заблокирована. Малая форма пролезет в воздуховод над площадкой.',{
    entry:456,exit:240,
    walls:[[2,10,10,1],[17,10,13,1],[2,19,10,1],[17,19,13,1],[16,2,1,26],[14,15,5,1],[14,17,5,1],[4,24,4,1]],
    ladders:[[204,240,456],[252,456,672],[636,240,456],[588,456,672]],
    vent:{x:336,y:384,w:120},gate:{id:'maintenance',kind:'lever',x:384,floor:672},
    decor:[[0,110,240,43,86],[3,152,672,100,150],[6,490,240,50,84],[3,642,672,130,175],[5,560,456,105,48]],
    lights:[[106,100],[270,294],[504,98],[662,510]],
    props:[['tank',252,430],['desk',596,646],['lever',500,646]],
    extras:[{id:'shaft-panel',kind:'panel',x:690,y:648,w:20,h:48}]}),
  room(2,'03 / Персонал','Посты охраны на разных этажах. Ящик сбивает человека, огонь перекрывает прямой путь.',{
    entry:240,exit:672,
    walls:[[2,10,28,1],[2,19,28,1]],ladders:[[252,240,456],[492,456,672],[636,240,456]],
    decor:[[0,102,240,43,94],[1,170,240,45,86],[1,398,240,45,86],[5,378,456,120,48],[6,680,240,42,80],[1,158,672,59,133],[5,412,672,144,65]],
    lights:[[120,100],[336,294],[616,294],[160,510],[478,510]],
    people:[['tech',328,240],['tech',462,456],['tech',560,672],['guard',664,672],['flamer',584,456]],
    props:[['desk',350,214],['crate',420,430],['nest',76,610],['crate',530,646]],
    extras:[{id:'office-glass',kind:'glass',x:364,y:436,w:12,h:40},{id:'guard-screen',kind:'panel',x:704,y:647,w:18,h:50}]}),
  room(3,'04 / Грузовой отсек','Поднимись к грузовой двери. Большая форма пробивает её рывком.',{
    entry:672,exit:456,
    walls:[[2,10,17,1],[24,10,6,1],[2,19,8,1],[17,19,13,1],[23,2,1,26],[11,22,7,1]],
    ladders:[[132,240,456],[492,456,672],[636,240,456]],
    gate:{id:'cargo',kind:'heavy',x:552,floor:456},
    decor:[[0,84,240,41,84],[6,260,240,50,85],[9,340,672,160,106],[9,472,672,116,166],[0,666,240,42,86],[3,108,672,84,130]],
    lights:[[108,98],[338,294],[628,98],[285,510],[650,510]],
    people:[['guard',670,456],['flamer',410,240]],
    props:[['feed',218,646],['crate',356,646],['crate',408,430],['nest',76,610]],
    extras:[{id:'cargo-supply',kind:'supply',x:284,y:659,w:22,h:26},{id:'cargo-panel',kind:'panel',x:690,y:642,w:20,h:60}]}),
  room(4,'05 / Насосная','Оставь массу у резервуара. Узкая вентиляция обходит запертую служебную дверь.',{
    entry:456,exit:672,
    walls:[[2,10,16,1],[24,10,6,1],[2,19,18,1],[22,19,8,1],[23,2,1,26],[21,15,5,1],[21,17,5,1]],
    ladders:[[132,240,456],[396,456,672],[660,456,672]],
    vent:{x:504,y:384,w:120},gate:{id:'pump',kind:'lever',x:552,floor:672},
    decor:[[0,88,240,42,84],[5,250,240,94,52],[6,346,240,42,81],[11,260,672,106,177],[2,458,672,75,155],[3,664,672,126,192]],
    lights:[[110,94],[350,294],[616,108],[208,510],[470,510]],people:[['flamer',654,672]],
    props:[['tank',382,430],['desk',182,646],['nest',76,612],['lever',650,646]],
    extras:[{id:'pressure-glass',kind:'glass',x:280,y:637,w:24,h:70}]}),
  room(5,'06 / Аварийный шлюз','Выбей аварийную панель ящиком или большой формой. Затем включи терминал наверху.',{
    entry:672,exit:240,
    walls:[[2,10,28,1],[2,19,28,1],[28,2,1,26]],
    ladders:[[228,456,672],[492,240,456],[636,456,672]],
    gate:{id:'escape',kind:'terminal',x:672,floor:240},
    decor:[[0,112,240,42,94],[6,328,240,49,89],[0,444,456,42,94],[6,184,672,58,139],[11,606,672,80,142]],
    lights:[[114,100],[352,294],[604,104],[194,510],[556,510]],
    people:[['guard',396,672],['guard',582,456],['flamer',360,240]],
    props:[['crate',306,646],['crate',488,430],['terminal',610,214],['nest',76,608]],
    extras:[{id:'escape-relay',kind:'panel',x:552,y:204,w:20,h:72,relay:true},{id:'escape-feed',kind:'feed',x:404,y:430,w:32,h:48},{id:'escape-supply',kind:'supply',x:454,y:227,w:22,h:26}]})
]);
export const FORMS=Object.freeze([
  {name:'Малая',nodes:6,r:9,speed:142,reach:136},
  {name:'Средняя',nodes:10,r:11,speed:124,reach:154},
  {name:'Большая',nodes:16,r:13,speed:105,reach:178}
]);
export const formFor=mass=>mass<=36?0:mass<=68?1:2;
export function freshRoom(r){return {enemies:r.enemies.map(e=>({...e,dead:false,eaten:false,alert:0,windup:0,cooldown:.8,hurt:0,knock:0,vx:0,vy:0,fireTime:0})),objects:r.objects.map(o=>({...o})),gateOpen:false};}

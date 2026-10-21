// Original, hand-authored rooms. Coordinates and physics are independent of rendering.
export const TILE=24, WIDTH=768, HEIGHT=432;
function room(id,title,subtitle,{walls=[],ladders=[],decor=[],lights=[],vent=null,gate=null,people=[],props=[],spawn=[112,240]}={}){
  const cells=new Uint8Array(32*18);
  for(let y=0;y<18;y++)for(let x=0;x<32;x++)if(x<2||x>29||y<2||y>15)cells[y*32+x]=1;
  for(let y=8;y<12;y++){if(id>0){cells[y*32]=0;cells[y*32+1]=0;}cells[y*32+30]=0;cells[y*32+31]=0;}
  for(const [x,y,w,h]of walls)for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)cells[j*32+i]=1;
  if(vent){for(let y=2;y<16;y++)if(y<vent.row||y>vent.row+1)cells[y*32+vent.col]=1;}
  for(const [x,top]of ladders)cells[Math.floor(top/TILE)*32+Math.floor(x/TILE)]=0;
  const objects=props.map((p,i)=>({id:`${id}:o${i}`,x:p[1],y:p[2],kind:p[0],bank:p[0]==='tank'?0:undefined}));
  const legacyObjects=objects.length;
  for(const [x,y]of lights){let mountY=48;for(let row=Math.floor(y/TILE)-1;row>=0;row--)if(cells[row*32+Math.floor(x/TILE)]){mountY=(row+1)*TILE;break;}objects.push({id:`${id}:lamp${objects.length-legacyObjects}`,kind:'lamp',x,y,mountY,broken:false});}
  return Object.freeze({id,title,subtitle,cells,spawn,walls,ladders,decor,legacyObjects,vent:vent?{x:vent.col*TILE,y:vent.row*TILE,w:TILE,h:48}:null,
    gate:gate?{...gate,x:gate.x,y:48,w:24,h:336}:null,
    enemies:people.map((p,i)=>({id:`${id}:e${i}`,kind:p[0],x:p[1],y:358,dir:-1,home:p[1]})),objects});
}
export const ROOMS=Object.freeze([
  room(0,'01 / Изолятор','Протокол стерилизации активен. Образец должен быть уничтожен.',{
    walls:[[2,7,10,1],[23,6,7,1]],ladders:[[252,168,384],[612,144,384]],
    decor:[[0,104,168,43,94],[1,176,168,47,80],[5,212,168,69,45],[8,416,354,200,170],[2,350,384,70,169],[2,438,384,70,169],[2,526,384,70,169],[6,666,144,43,79]],
    lights:[[112,100],[390,94],[620,96],[130,246],[560,230]],gate:{id:'isolation',kind:'lever',x:648},people:[['tech',396]],
    props:[['capsule',184,358],['lever',554,338],['crate',468,362],['console',104,358]]}),
  room(1,'02 / Сервисный канал','Шахта узкая. В резервуаре можно оставить часть массы.',{
    vent:{col:16,row:10},walls:[[2,6,10,1],[17,6,13,1]],ladders:[[204,144,384],[636,144,384]],
    decor:[[0,110,144,43,86],[3,304,384,100,150],[6,490,144,50,84],[3,642,384,130,175],[8,524,360,200,150]],lights:[[106,100],[270,225],[504,98],[662,238]],
    props:[['tank',252,358],['desk',596,358]]}),
  room(2,'03 / Персонал','Они слышат тебя. Поглощай, чтобы нарастить массу.',{
    walls:[[2,7,19,1],[24,6,6,1]],ladders:[[228,168,384],[468,168,384],[636,144,384]],
    decor:[[0,102,168,43,94],[1,170,168,45,86],[1,298,168,45,86],[5,378,168,82,48],[6,680,144,42,80],[8,428,368,280,160],[1,158,384,59,133],[5,412,384,144,65],[0,682,384,46,95]],
    lights:[[120,100],[336,104],[616,94],[160,246],[478,244]],people:[['tech',328],['tech',462],['tech',560],['guard',664]],
    props:[['desk',254,358],['crate',598,362],['console',126,358]]}),
  room(3,'04 / Грузовой отсек','Большая форма и рывок пробьют грузовую перегородку.',{
    gate:{id:'cargo',kind:'heavy',x:552},walls:[[2,6,17,1],[24,7,6,1]],ladders:[[132,144,384],[420,144,384],[636,168,384]],
    decor:[[0,84,144,41,84],[6,260,144,50,85],[9,340,384,160,106],[9,472,384,116,166],[0,666,168,42,86],[3,108,384,84,130]],
    lights:[[108,98],[338,98],[628,112],[285,234],[650,270]],people:[['guard',670]],
    props:[['feed',218,358],['crate',356,362],['crate',408,362],['console',112,358]]}),
  room(4,'05 / Насосная','Стерилизация приближается. Сбрось массу и пройди обход.',{
    vent:{col:23,row:10},walls:[[2,6,16,1]],ladders:[[132,144,384],[396,144,384]],
    decor:[[0,88,144,42,84],[5,250,144,94,52],[6,346,144,42,81],[11,260,384,106,177],[2,458,384,75,155],[3,664,384,126,192]],
    lights:[[110,94],[350,100],[616,108],[208,238],[470,225]],
    props:[['tank',382,358],['desk',182,358],['console',96,358]]}),
  room(5,'06 / Аварийный шлюз','Отключи блокировку терминалом. За шлюзом — свобода.',{
    gate:{id:'escape',kind:'terminal',x:696},walls:[[2,7,21,1]],ladders:[[228,168,384],[492,168,384]],
    decor:[[0,112,168,42,94],[6,328,168,49,89],[0,444,168,42,94],[8,410,366,252,160],[6,184,384,58,139],[11,606,384,80,142]],
    lights:[[114,100],[352,105],[604,104],[194,243],[556,244]],people:[['guard',396],['guard',582]],
    props:[['crate',306,362],['crate',488,362],['terminal',644,358],['console',100,358]]})
]);
export const FORMS=Object.freeze([
  {name:'Малая',nodes:6,r:9,speed:142,reach:136},
  {name:'Средняя',nodes:10,r:11,speed:124,reach:154},
  {name:'Большая',nodes:16,r:13,speed:105,reach:178}
]);
export const formFor=mass=>mass<=36?0:mass<=68?1:2;
export function freshRoom(r){return {enemies:r.enemies.map(e=>({...e,dead:false,eaten:false,alert:0,windup:0,cooldown:.8,hurt:0})),objects:r.objects.map(o=>({...o})),gateOpen:false};}

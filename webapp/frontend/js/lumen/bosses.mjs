const TAU=Math.PI*2;
const freezeVariant=value=>Object.freeze({...value,attacks:Object.freeze(value.attacks.map(Object.freeze))});

export const BOSS_VARIANTS=Object.freeze({
  rootwarden:freezeVariant({name:'Смотритель корней',sprite:'boss-rootwarden',hp:16000,radius:70,damage:24,attacks:[
    {kind:'ring',count:18,speed:110,damage:14,windup:1.1,cooldown:3.3},
    {kind:'slam',radius:170,damage:26,windup:1.2,cooldown:3.2},
    {kind:'fan',count:7,speed:140,damage:14,spread:.22,windup:.9,cooldown:2.8},
    {kind:'line',range:520,width:20,damage:24,windup:1,cooldown:3},
    {kind:'spiral',count:16,speed:110,damage:13,windup:1.1,cooldown:3.2},
  ]}),
  overseer:freezeVariant({name:'Старший надзиратель',sprite:'boss-overseer',hp:24000,radius:80,damage:28,attacks:[
    {kind:'line',range:610,width:24,damage:32,windup:1,cooldown:2.8},
    {kind:'ring',count:24,speed:125,damage:17,windup:1.1,cooldown:3},
    {kind:'slam',radius:195,damage:32,windup:1.2,cooldown:3},
    {kind:'fan',count:9,speed:160,damage:17,spread:.18,windup:.9,cooldown:2.6},
    {kind:'spiral',count:20,speed:120,damage:16,windup:1,cooldown:3},
  ]}),
  drillguard:freezeVariant({name:'Буровой голем',sprite:'boss-drillguard',attacks:[
    {kind:'slam',radius:170,damage:28,windup:1.2,cooldown:3.2},
    {kind:'line',range:560,width:20,damage:30,windup:.9,cooldown:2.9},
    {kind:'fan',count:6,speed:145,damage:16,spread:.23,windup:.85,cooldown:2.8},
  ]}),
  resonator:freezeVariant({name:'Резонатор глубин',sprite:'boss-resonator',attacks:[
    {kind:'ring',count:22,speed:120,damage:16,windup:1.1,cooldown:3.2},
    {kind:'spiral',count:15,speed:135,damage:15,windup:1,cooldown:3},
    {kind:'line',range:580,width:22,damage:28,windup:.9,cooldown:2.7},
  ]}),
  carapace:freezeVariant({name:'Панцирный маршал',sprite:'boss-carapace',attacks:[
    {kind:'fan',count:7,speed:160,damage:18,spread:.16,windup:.75,cooldown:2.6},
    {kind:'slam',radius:165,damage:34,windup:1.1,cooldown:3.4},
    {kind:'radial',count:14,speed:125,damage:18,windup:.9,cooldown:3.2},
  ]}),
  tempest:freezeVariant({name:'Грозовой дозорный',sprite:'boss-tempest',attacks:[
    {kind:'line',range:580,width:22,damage:32,windup:.8,cooldown:2.5},
    {kind:'radial',count:18,speed:145,damage:16,windup:.75,cooldown:2.5},
    {kind:'fan',count:9,speed:175,damage:17,spread:.14,windup:.7,cooldown:2.6},
  ]}),
  matriarch:freezeVariant({name:'Матриарх разлома',sprite:'boss-matriarch',hp:36000,radius:48,damage:32,attacks:[
    {kind:'radial',count:18,speed:145,damage:20,windup:1,cooldown:2.8},
    {kind:'line',range:600,width:24,damage:40,windup:.85,cooldown:2.1},
    {kind:'slam',radius:180,damage:38,windup:1.15,cooldown:2.7},
    {kind:'fan',count:11,speed:190,damage:19,spread:.12,windup:.7,cooldown:2.2},
    {kind:'radial',count:22,speed:130,damage:21,windup:.8,cooldown:2.4},
    {kind:'line',range:620,width:28,damage:45,windup:.8,cooldown:2},
  ]}),
  conductor:freezeVariant({name:'Капельмейстер',sprite:'boss-conductor',attacks:[
    {kind:'fan',count:9,speed:150,damage:17,spread:.18,windup:.85,cooldown:2.5},
    {kind:'spiral',count:18,speed:120,damage:16,windup:1,cooldown:3},
    {kind:'line',range:510,width:23,damage:28,windup:.9,cooldown:2.8},
  ]}),
  gatekeeper:freezeVariant({name:'Латунный привратник',sprite:'boss-gatekeeper',attacks:[
    {kind:'fan',count:7,speed:155,damage:19,spread:.2,windup:.9,cooldown:2.8},
    {kind:'slam',radius:190,damage:34,windup:1.2,cooldown:3.3},
    {kind:'ring',count:26,speed:125,damage:19,windup:1,cooldown:3},
  ]}),
  monarch:freezeVariant({name:'Полый монарх',sprite:'boss-monarch',hp:52000,radius:100,damage:40,attacks:[
    {kind:'ring',count:32,speed:135,damage:22,windup:1.1,cooldown:2.8},
    {kind:'spiral',count:28,speed:130,damage:20,windup:1.1,cooldown:3.1},
    {kind:'fan',count:11,speed:185,damage:22,spread:.15,windup:.85,cooldown:2.6},
    {kind:'slam',radius:240,damage:42,windup:1.2,cooldown:2.8},
    {kind:'ring',count:38,speed:145,damage:24,windup:1,cooldown:2.7},
    {kind:'line',range:900,width:32,damage:40,windup:1,cooldown:2.7},
  ]}),
});
export const BOSS_TYPES=Object.freeze(Object.keys(BOSS_VARIANTS));

export function validateBossFields(enemy){
  if(enemy.bossType===undefined)return enemy.attackStage===undefined;
  if(!Object.hasOwn(BOSS_VARIANTS,enemy.bossType))return false;
  const variant=BOSS_VARIANTS[enemy.bossType];
  return Boolean(variant&&['guardian','arena-boss'].includes(enemy.kind)&&Number.isInteger(enemy.attackStage)&&enemy.attackStage>=0&&enemy.attackStage<variant.attacks.length);
}

// Typed world guardians share explicit warning/attack sequences. Untyped legacy
// guardians remain in engine.mjs; final arena bosses stay at their world anchor.
export function updateBossAttacks(state,enemy,dt,{hurt,effect,limits}){
  if(!Object.hasOwn(BOSS_VARIANTS,enemy.bossType))return false;
  const variant=BOSS_VARIANTS[enemy.bossType];
  if(!variant||!['guardian','arena-boss'].includes(enemy.kind)||enemy.hp<=0)return false;
  enemy.hitFlash=Math.max(0,(enemy.hitFlash||0)-dt);
  enemy.slowTime=Math.max(0,(enemy.slowTime||0)-dt);
  enemy.fireTimer=Math.max(0,(enemy.fireTimer||0)-dt);
  enemy.attackStage ||= 0;
  const attack=variant.attacks[enemy.attackStage];
  const emit=(kind,x,y,radius,life)=>{
    if(state.effects.length>=limits.effects)state.effects.shift();
    effect(state,kind,x,y,radius,life);return state.effects.at(-1);
  };
  const line=(kind,life)=>Object.assign(emit(kind,enemy.x,enemy.y,attack.width||22,life),{
    toX:enemy.x+Math.cos(enemy.phase)*(attack.range||520),toY:enemy.y+Math.sin(enemy.phase)*(attack.range||520),
  });
  const previous=enemy.actionTimer||0;
  if(previous>0){
    enemy.actionTimer=Math.max(0,previous-dt);
    if(enemy.actionTimer>0)return true;
    if(attack.kind==='slam'){
      emit('pulse',enemy.x,enemy.y,attack.radius,.45);
      if(Math.hypot(state.player.x-enemy.x,state.player.y-enemy.y)<attack.radius+state.player.radius)hurt(state,attack.damage,.35);
    }else if(attack.kind==='line'){
      line('arc',.3);
      const x=state.player.x-enemy.x,y=state.player.y-enemy.y,dx=Math.cos(enemy.phase),dy=Math.sin(enemy.phase),along=x*dx+y*dy;
      if(along>=0&&along<=attack.range&&Math.abs(x*dy-y*dx)<attack.width+(state.player.radius||13))hurt(state,attack.damage,.35);
    }else{
      const raging=enemy.hp<enemy.maxHp*.5,count=attack.count+(raging?2:0);
      for(let n=0;n<count&&state.projectiles.length<limits.projectiles;n++){
        const radial=['radial','ring'].includes(attack.kind);
        // Ring attacks always leave a full-body safe wedge aligned with the
        // captured warning direction. A spiral is an open arc, never a wall.
        const offset=radial?n/count*TAU:attack.kind==='spiral'?-1.8+n*.27:(n-(count-1)/2)*attack.spread;
        if(attack.kind==='ring'&&Math.min(offset,TAU-offset)<.56)continue;
        const angle=enemy.phase+offset;
        const speed=attack.speed*(raging?1.15:1);
        const start=['monarch','rootwarden','overseer'].includes(enemy.bossType)?enemy.radius+12+(attack.kind==='spiral'?n*2:0):0;
        state.projectiles.push({id:state.nextId++,x:enemy.x+Math.cos(angle)*start,y:enemy.y+Math.sin(angle)*start,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,
          radius:6,damage:attack.damage,life:4,hostile:true,weapon:'hostile',pierce:0,hits:[],returning:false});
      }
    }
    enemy.attackStage=(enemy.attackStage+1)%variant.attacks.length;
    enemy.fireTimer=attack.cooldown;return true;
  }
  if(enemy.fireTimer<=0){
    enemy.phase=(Math.atan2(state.player.y-enemy.y,state.player.x-enemy.x)+TAU)%TAU;
    enemy.actionTimer=attack.windup;
    if(attack.kind==='slam')emit('warning',enemy.x,enemy.y,attack.radius,attack.windup);
    else if(['radial','ring','spiral'].includes(attack.kind))emit('shards',enemy.x,enemy.y,enemy.kind==='arena-boss'?Math.max(110,enemy.radius*2):110,attack.windup);
    else line('charge',attack.windup);
    return true;
  }
  if(enemy.kind!=='arena-boss'){
    const dx=state.player.x-enemy.x,dy=state.player.y-enemy.y,distance=Math.hypot(dx,dy)||1;
    const movement=Math.min(Math.max(0,distance-95),enemy.speed*dt*(enemy.slowTime>0?.58:1));
    enemy.x+=dx/distance*movement;enemy.y+=dy/distance*movement;
  }
  return true;
}

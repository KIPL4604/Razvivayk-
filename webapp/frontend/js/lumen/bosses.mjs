const TAU=Math.PI*2;
const freezeVariant=value=>Object.freeze({...value,attacks:Object.freeze(value.attacks.map(Object.freeze))});

export const BOSS_VARIANTS=Object.freeze({
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
});
export const BOSS_TYPES=Object.freeze(Object.keys(BOSS_VARIANTS));

export function validateBossFields(enemy){
  if(enemy.bossType===undefined)return enemy.attackStage===undefined;
  if(!Object.hasOwn(BOSS_VARIANTS,enemy.bossType))return false;
  const variant=BOSS_VARIANTS[enemy.bossType];
  return Boolean(variant&&['guardian','arena-boss'].includes(enemy.kind)&&Number.isInteger(enemy.attackStage)&&enemy.attackStage>=0&&enemy.attackStage<variant.attacks.length);
}

// Only typed third-expedition guardians enter this path. Old guardian behavior
// remains in engine.mjs; the final arena boss stays fixed at its world anchor.
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
        const angle=enemy.phase+(attack.kind==='radial'?n/count*TAU:(n-(count-1)/2)*attack.spread);
        const speed=attack.speed*(raging?1.15:1);
        state.projectiles.push({id:state.nextId++,x:enemy.x,y:enemy.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,
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
    else if(attack.kind==='radial')emit('shards',enemy.x,enemy.y,110,attack.windup);
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

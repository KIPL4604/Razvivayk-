// Original encounter pacing. Time is simulation time: menus never consume a wave.
export function waveAt(time) {
  if(time<35)return {kind:'opening',stage:0,age:time,count:2,interval:.85};
  // A short, plentiful harvest precedes every harder group. The final pressure
  // lasts until dawn, and harvests finish before the 120/240/420s guardians.
  const cycle=Math.min(6,Math.floor((time-35)/60));
  const age=time-35-cycle*60,stage=cycle+1;
  return age<20
    ? {kind:'harvest',stage,age,count:8,interval:.8}
    : {kind:'pressure',stage,age:age-20,count:2+Math.floor(stage/3),interval:Math.max(.5,.84-stage*.04)};
}

export function xpForLevel(level) {
  const n=Math.max(0,level-1);
  // Late valuable crystals should not turn into an upgrade dialog every few
  // seconds. The extra smooth ramp starts after level20, without an XP reset.
  return Math.round(10+5*n+n**1.65+12*Math.max(0,n-19)**2.2);
}

export function crystalLoot(maxHp,guardianStage=0) {
  if(guardianStage)return {tier:3,value:[0,100,180,300][guardianStage]};
  return maxHp>=300?{tier:3,value:40}:maxHp>=150?{tier:2,value:12}:{tier:1,value:2};
}

export const crystalTier = crystal => crystal.tier || (crystal.value>=40?3:crystal.value>=12?2:1);

export function creatureStats(kind,wave) {
  const s=wave.stage;
  if(wave.kind==='harvest')return {hp:12,radius:10,speed:40,damage:3};
  if(kind==='quartzling')return {hp:52+s*14,radius:13,speed:64+s*2,damage:9};
  if(kind==='shardback')return {hp:150+s*32,radius:21,speed:29+s,damage:14};
  if(kind==='moonmoth')return {hp:40+s*12,radius:11,speed:69+s*2,damage:7};
  if(kind==='crawler')return {hp:24+s*22,radius:12,speed:62+s*3,damage:10};
  if(kind==='spitter')return {hp:70+s*24,radius:15,speed:32,damage:8};
  if(kind==='wisp')return {hp:20+s*8,radius:9,speed:88+s*2,damage:7};
  if(kind==='beetle')return {hp:[80,150,210,270,300,360,420][s-1],radius:16,speed:37+s*2,damage:13};
  if(kind==='wasp')return {hp:[35,55,80,120,150,210,300][s-1],radius:9,speed:72+s*2,damage:9};
  return {hp:wave.kind==='opening'?18:22+s*4,radius:10,speed:47+s*2,damage:7};
}

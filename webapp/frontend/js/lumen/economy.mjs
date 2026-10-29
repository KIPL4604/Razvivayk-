import {CHARACTERS,WEAPON_IDS,MAX_WEAPON_STAGE,MAPS} from './catalog.mjs';
import {normalizeTraining} from './training.mjs';
const amount=n=>Number.isSafeInteger(n)&&n>=0&&n<=1e8?n:0;
export function normalizeMeta(value){
  const unlocked=new Set(['scout','keeper']);
  if(Array.isArray(value?.unlocked))for(const id of value.unlocked)if(Object.hasOwn(CHARACTERS,id))unlocked.add(id);
  const credited={};
  if(value?.credited&&typeof value.credited==='object')for(const [key,n] of Object.entries(value.credited).slice(-50)){
    if(/^[a-zA-Z0-9-]{1,90}$/.test(key)&&Number.isSafeInteger(n)&&n>=0&&n<=1e6)credited[key]=n;
  }
  const weaponBest={};
  for(const id of WEAPON_IDS){const rank=value?.weaponBest?.[id];if(Number.isInteger(rank)&&rank>0&&rank<=MAX_WEAPON_STAGE)weaponBest[id]=rank;}
  const clearedMaps=Array.isArray(value?.clearedMaps)?Object.keys(MAPS).filter(id=>value.clearedMaps.includes(id)):[];
  if(!clearedMaps.includes('garden'))clearedMaps.length=0;
  if(!clearedMaps.includes('quarry'))for(const id of ['crater','castle']){const index=clearedMaps.indexOf(id);if(index>=0)clearedMaps.splice(index,1);}
  return {version:3,coins:amount(value?.coins),unlocked:[...unlocked],credited,weaponBest,clearedMaps,training:normalizeTraining(value?.training)};
}
export const mapAvailable=(meta,id)=>Object.hasOwn(MAPS,id)&&(id==='garden'||meta.clearedMaps.includes(['crater','castle'].includes(id)?'quarry':'garden'));
export function characterRequirement(meta,id){
  const hero=Object.hasOwn(CHARACTERS,id)?CHARACTERS[id]:null;
  const best=hero?meta.weaponBest[hero.weapon]||0:0;
  return {eligible:Boolean(hero&&(!hero.price||meta.unlocked.includes(id)||best>=MAX_WEAPON_STAGE)),best,target:MAX_WEAPON_STAGE,weapon:hero?.weapon};
}
export function buyCharacter(meta,id){
  const hero=CHARACTERS[id];
  if(!Object.hasOwn(CHARACTERS,id)||!hero.price||meta.unlocked.includes(id)||meta.coins<hero.price||!characterRequirement(meta,id).eligible)return false;
  meta.coins-=hero.price;meta.unlocked.push(id);return true;
}
export function recordProgress(meta,run){
  for(const id of run.foundWeapons||[]){
    if(!WEAPON_IDS.includes(id)||id===CHARACTERS[run.character]?.weapon)continue;
    const rank=run.masteredWeapons?.includes(id)?MAX_WEAPON_STAGE:run.upgrades?.[id]||run.archivedWeapons?.[id];
    if(Number.isInteger(rank)&&rank>0&&rank<=MAX_WEAPON_STAGE)meta.weaponBest[id]=Math.max(meta.weaponBest[id]||0,rank);
  }
  if(run.status==='won'&&Object.hasOwn(MAPS,run.map)&&run.level>=MAPS[run.map].goal&&(!MAPS[run.map].bossGoal||run.endReason==='boss'&&run.arena?.phase==='complete'||['garden','quarry'].includes(run.map)&&run.legacyLevelWin===true&&run.endReason==='level'&&run.arena===null)&&mapAvailable(meta,run.map)&&!meta.clearedMaps.includes(run.map))meta.clearedMaps.push(run.map);
}
// Credit a monotonically increasing run total once. Wallet and run are persisted
// together by the UI; resume, autosave and result rendering cannot duplicate it.
export function bankCoins(meta,run){
  if(!/^[a-zA-Z0-9-]{1,90}$/.test(run?.runId||''))return 0;
  const total=Math.min(1e6,amount(run.coinsEarned)),old=Object.hasOwn(meta.credited,run.runId)?amount(meta.credited[run.runId]):0;
  const delta=Math.max(0,total-old);meta.coins=Math.min(1e8,meta.coins+delta);
  meta.credited[run.runId]=Math.max(old,total);
  const keys=Object.keys(meta.credited);for(const key of keys.slice(0,-50))delete meta.credited[key];
  return delta;
}

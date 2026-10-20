// Modest, capped bonuses. The run stores a snapshot; the wallet lives in meta.
export const TRAINING = Object.freeze({
  vigor:Object.freeze({title:'Прочное ядро',icon:'vitality',unit:'здоровья',step:2,max:5,color:'#f2a3b7',description:'Небольшой запас здоровья для следующей экспедиции.'}),
  lens:Object.freeze({title:'Точная оптика',icon:'focus',unit:'% урона',step:1,max:5,color:'#f4ce80',description:'Чуть усиливает каждое оружие, включая гибриды.'}),
  drive:Object.freeze({title:'Тихий привод',icon:'stride',unit:'% скорости',step:.5,max:5,color:'#a4d7ee',description:'Немного легче находить лазейку между врагами.'}),
  compass:Object.freeze({title:'Ловец света',icon:'magnet',unit:'радиуса сбора',step:2,max:5,color:'#73dfcc',description:'Притягивает кристаллы с немного большего расстояния.'}),
});
const prices=Object.freeze([50,90,140,200,280]);
export const normalizeTraining=value=>Object.fromEntries(Object.entries(TRAINING).map(([id,t])=>
  [id,Number.isInteger(value?.[id])&&value[id]>=0&&value[id]<=t.max?value[id]:0]));
export const validTraining=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)
  &&Object.keys(value).length===Object.keys(TRAINING).length
  &&Object.entries(TRAINING).every(([id,t])=>Number.isInteger(value[id])&&value[id]>=0&&value[id]<=t.max);
export const trainingPrice=(id,rank)=>Object.hasOwn(TRAINING,id)&&Number.isInteger(rank)&&rank>=0&&rank<TRAINING[id].max?prices[rank]:null;
export function buyTraining(meta,id){
  if(!meta||!validTraining(meta.training)||!Number.isSafeInteger(meta.coins)||meta.coins<0)return false;
  const price=trainingPrice(id,meta.training[id]);
  if(price===null||meta.coins<price)return false;
  meta.coins-=price;meta.training[id]++;return true;
}

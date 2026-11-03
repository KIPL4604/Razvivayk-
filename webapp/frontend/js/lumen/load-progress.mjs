const STALL_MS=4000;

export function worldLoadProgress(now=()=>performance.now()){
 const tracks=new Map(),samples=[];
 let lastChange=now(),highWater=0;

 function update(key,value){
  const before=tracks.get(key)?.received||0;
  tracks.set(key,value);
  if(value.received===before)return;
  const time=now();
  if(value.received<before||time-lastChange>=STALL_MS)samples.length=0;
  lastChange=time;
  const received=[...tracks.values()].reduce((sum,track)=>sum+track.received,0);
  if(!samples.length||time-samples.at(-1).time>=500)samples.push({time,received});
  while(samples.length>2&&time-samples[1].time>=5000)samples.shift();
 }

 function read(online=true){
  const values=[...tracks.values()];
  const known=values.length===2&&values.every(track=>track.total>0);
  const total=values.reduce((sum,track)=>sum+track.total,0);
  const received=values.reduce((sum,track)=>sum+track.received,0);
  const ready=known&&values.every(track=>track.phase==='ready');
  const decode=known&&received>=total;
  const waiting=now()-lastChange>=STALL_MS;
  const phase=ready?'ready':decode?'decode':!online?'offline':values.some(track=>track.retrying)?'retry':waiting?'waiting':known?'download':'manifest';
  if(known)highWater=Math.max(highWater,Math.min(99,Math.floor(received/total*100)));
  const first=samples[0],last=samples.at(-1);
  const measured=last?.time-first?.time;
  const bytes=last?.received-first?.received;
  const remainingSeconds=phase==='download'&&measured>=700&&bytes>0
   ?Math.max(1,Math.ceil((total-received)*measured/bytes/1000)):null;
  return {phase,percent:ready?100:known||highWater?highWater:null,remainingSeconds};
 }

 function restart(){
  tracks.clear();samples.length=0;lastChange=now();
 }

 return {update,read,restart};
}

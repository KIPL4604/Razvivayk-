// Local versioned artwork; load and decode the selected world while its intro plays.
const base=new URL('../../assets/lumen/',import.meta.url);
let manifestPending;
const packs=new Map(),images=Object.create(null),decoded=new Map(),listeners=new Set();
const worldFiles={
 garden:['tiles','garden','mote','beetle','wasp','crawler','spitter','wisp','boss-briar','boss-queen','boss-ash','boss-rootwarden'],
 quarry:['mote','beetle','wasp','crawler','spitter','wisp','quarry-tiles','quarry-props','quartzling','shardback','moonmoth','boss-drillguard','boss-resonator','boss-overseer','boss-briar','boss-queen','boss-ash'],
 crater:['mote','crawler','spitter','crater-tiles','crater-props','quartzling','shardback','moonmoth','beetle','wasp','wisp','boss-carapace','boss-tempest','boss-matriarch','arena-tick'],
 castle:['castle-tiles','castle-props','castle-floor','castle-hall-floor','castle-hall-decor','castle-door','castle-guard','castle-wax','castle-moth','boss-conductor','boss-gatekeeper','boss-monarch'],
};
const shared=['arsenal','combat','fx','ui','weapons','expansion-items','arena-fx','arena-tick','enemy-projectiles','mega-chest'];
const notify=()=>listeners.forEach(listener=>listener());
export function selectArtFiles(manifest,{map,character}={}){
 if(!map)return Object.entries(manifest.files);
 const names=new Set([...shared,...(worldFiles[map]||worldFiles.garden),character||'scout'].map(name=>name+'.png'));
 return Object.entries(manifest.files).filter(([name])=>names.has(name));
}
async function manifest(){
 manifestPending ||= (async()=>{
  const response=await fetch(new URL('manifest.json',base));
  if(!response.ok)throw new Error('Lumen asset manifest unavailable');
  const value=await response.json();
  if(value.version!==1||value.frameSize!==48||value.packFormat!=='image/webp'||!Array.isArray(value.packs)||!value.files)throw new Error('Unsupported Lumen artwork');
  return value;
 })().catch(error=>{manifestPending=null;throw error;});
 return manifestPending;
}
function download(entry){
 const key=entry.file+':'+entry.sha256;
 if(packs.has(key))return packs.get(key);
 const record={received:0,done:false,promise:null};packs.set(key,record);
 record.promise=(async()=>{
  let lastError;
  for(let attempt=0;attempt<3;attempt++){
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20_000);
   const url=new URL(entry.file,base);url.searchParams.set('v',entry.sha256.slice(0,16));
   if(attempt)url.searchParams.set('attempt',String(attempt));
   try{
    const response=await fetch(url,{signal:controller.signal,priority:'high'});
    if(!response.ok)throw new Error(`Lumen artwork pack unavailable: ${entry.file}`);
    let data;
    if(response.body?.getReader){
     const reader=response.body.getReader(),chunks=[];let size=0;
     while(true){const result=await reader.read();if(result.done)break;chunks.push(result.value);size+=result.value.byteLength;record.received=Math.max(record.received,Math.min(size,entry.bytes));notify();}
     data=new Uint8Array(size);let cursor=0;for(const chunk of chunks){data.set(chunk,cursor);cursor+=chunk.byteLength;}data=data.buffer;
    }else data=await response.arrayBuffer();
    if(data.byteLength!==entry.bytes)throw new Error(`Incomplete Lumen artwork pack: ${entry.file}`);
    record.received=entry.bytes;record.done=true;notify();return data;
   }catch(error){lastError=error;}finally{clearTimeout(timeout);}
  }
  packs.delete(key);throw lastError;
 })();
 return record;
}
export async function loadArt({map,character,onProgress}={}){
 let update;let used=[];
 try{
  onProgress?.({phase:'manifest',received:0,total:0,percent:0,remainingSeconds:null});
  const value=await manifest(),files=selectArtFiles(value,{map,character}),needed=new Set(),chunksByFile=new Map();
  for(const [file,entry]of files){
   const invalid=()=>{throw new Error(`Invalid Lumen artwork entry: ${file}`);};
   if(!entry||typeof entry!=='object'||Array.isArray(entry))invalid();
   const chunks=entry.chunks===undefined?[{pack:entry.pack,offset:entry.offset,bytes:entry.packBytes}]:entry.chunks;
   if(!Array.isArray(chunks)||!chunks.length)invalid();
   for(const chunk of chunks){const pack=value.packs.find(pack=>pack.file===chunk?.pack);if(!pack||!Number.isSafeInteger(chunk.offset)||!Number.isSafeInteger(chunk.bytes)||chunk.offset<0||chunk.bytes<1||chunk.offset+chunk.bytes>pack.bytes)invalid();needed.add(chunk.pack);}
   chunksByFile.set(file,chunks);
  }
  const required=value.packs.filter(entry=>needed.has(entry.file));used=required.map(entry=>entry.file+':'+entry.sha256);
  const total=required.reduce((sum,entry)=>sum+entry.bytes,0),started=performance.now();let completed=0;
  update=()=>{
   const received=required.reduce((sum,entry)=>sum+(packs.get(entry.file+':'+entry.sha256)?.received||0),0),elapsed=(performance.now()-started)/1000,rate=received/Math.max(.1,elapsed);
   onProgress?.({phase:completed===files.length?'ready':received===total?'decode':'download',received,total,percent:total?Math.min(100,Math.floor(received/total*100)):0,remainingSeconds:elapsed>=1&&received>0&&received<total?Math.ceil((total-received)/rate):null});
  };
  listeners.add(update);update();
  // Bounded parallel transfers avoid flooding the mobile connection.
  let cursor=0;
  await Promise.all(Array.from({length:Math.min(2,required.length)},async()=>{while(cursor<required.length){const entry=required[cursor++];await download(entry).promise;}}));
  const buffers=Object.fromEntries(await Promise.all(required.map(async entry=>[entry.file,await download(entry).promise])));
  for(const [file,entry]of files){
   const key=file+':'+entry.sha256;
   if(decoded.get(file)!==key){
    const slices=chunksByFile.get(file).map(chunk=>buffers[chunk.pack].slice(chunk.offset,chunk.offset+chunk.bytes)),image=new Image(),url=URL.createObjectURL(new Blob(slices,{type:value.packFormat}));
    try{image.src=url;await image.decode();}finally{URL.revokeObjectURL(url);}
    images[file.replace('.png','')]=image;decoded.set(file,key);
   }
   completed++;update();
  }
  return {manifest:value,images};
 }catch(error){manifestPending=null;used.forEach(key=>packs.delete(key));throw error;}finally{if(update)listeners.delete(update);}
}

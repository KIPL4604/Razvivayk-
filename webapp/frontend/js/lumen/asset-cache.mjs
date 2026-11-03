/* Only fingerprinted public Lumen assets enter this cache; never account/API data. */
const base=new URL('../../assets/lumen/',import.meta.url),memory=new Map();
const CACHE='teramont-lumen-assets-v1';
function waitForRetry(delay){
 return new Promise(resolve=>{
  const done=()=>{clearTimeout(timer);globalThis.removeEventListener?.('online',done);resolve();};
  const timer=setTimeout(done,delay);
  globalThis.addEventListener?.('online',done,{once:true});
 });
}
export async function assetBytes(entry,onProgress,{recover=false}={}){
 const key=entry.file+':'+entry.sha256;
 if(memory.has(key)){const value=await memory.get(key);onProgress?.(entry.bytes);return value;}
 const pending=(async()=>{
  const url=new URL(entry.file,base);url.searchParams.set('v',entry.sha256);
  let cache;
  try{cache=await caches.open(CACHE);}catch(_){}
  const valid=async data=>data.byteLength===entry.bytes&&(!globalThis.crypto?.subtle||[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(x=>x.toString(16).padStart(2,'0')).join('')===entry.sha256);
  try{
   const cached=await cache?.match(url);
   if(cached){const data=await cached.arrayBuffer();if(await valid(data)){onProgress?.(entry.bytes);return data;}await cache.delete(url);}
  }catch(_){}
  let error;
  const attempts=recover?4:2;
  for(let attempt=0;attempt<attempts;attempt++){
   // Timeout measures a stalled transfer, not the entire download on a slow mobile link.
   const controller=new AbortController();let timer;
   const touch=()=>{clearTimeout(timer);timer=setTimeout(()=>controller.abort(),30000);};
   const offline=()=>controller.abort();
   let retryable=true,retryAfter=0;
   if(recover)globalThis.addEventListener?.('offline',offline,{once:true});
   try{
    touch();const response=await fetch(url,{signal:controller.signal});
    if(!response.ok){
     retryable=response.status===408||response.status===429||response.status>=500;
     const advice=response.headers.get('Retry-After');
     if(advice)retryAfter=Math.max(0,/^\d+$/.test(advice)?Number(advice)*1000:Date.parse(advice)-Date.now())||0;
     throw new Error('Asset unavailable: '+entry.file);
    }
    const chunks=[];let size=0;
    if(response.body?.getReader){const reader=response.body.getReader();while(true){const result=await reader.read();if(result.done)break;touch();size+=result.value.byteLength;if(size>entry.bytes){controller.abort();throw new Error('Invalid asset size');}chunks.push(result.value);onProgress?.(size);}}
    else{const chunk=new Uint8Array(await response.arrayBuffer());chunks.push(chunk);size=chunk.length;}
    const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
    if(!await valid(data.buffer))throw new Error('Incomplete or invalid asset: '+entry.file);
    onProgress?.(entry.bytes);
    try{
     await cache?.put(url,new Response(data,{headers:{'Content-Type':entry.file.endsWith('.mp4')?'video/mp4':'application/octet-stream'}}));
     // Retain the current version of each file; unrelated worlds remain reusable.
     for(const old of await cache?.keys()||[]){const previous=new URL(old.url);if(previous.pathname===url.pathname&&previous.href!==url.href)await cache.delete(old);}
    }catch(_){}
    return data.buffer;
   }catch(e){error=e;}finally{clearTimeout(timer);globalThis.removeEventListener?.('offline',offline);}
   if(recover&&(!retryable||attempt===attempts-1||retryAfter>30000))break;
   if(recover){
    const delay=700*2**attempt;
    if(retryAfter)await new Promise(resolve=>setTimeout(resolve,Math.max(delay,retryAfter)));
    else await waitForRetry(delay);
   }
  }
  throw error;
 })().catch(error=>{memory.delete(key);throw error;});
 memory.set(key,pending);return pending;
}

export function progressReporter(entries,callback){
 const total=entries.reduce((sum,e)=>sum+e.bytes,0),counts=new Map(),started=performance.now();
 return (entry,bytes,phase='download')=>{
  if(entry)counts.set(entry.file,bytes);
  const received=[...counts.values()].reduce((a,b)=>a+b,0),elapsed=(performance.now()-started)/1000;
  callback?.({phase,received,total,percent:total?Math.floor(100*received/total):0,remainingSeconds:elapsed>=1&&received>0&&received<total?Math.ceil((total-received)*elapsed/received):null});
 };
}

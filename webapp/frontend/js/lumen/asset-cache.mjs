/* Only fingerprinted public Lumen assets enter this cache; never account/API data. */
const base=new URL('../../assets/lumen/',import.meta.url),memory=new Map();
const CACHE='teramont-lumen-assets-v1';
const RESUME_BYTES=12*1024;
function waitForRetry(delay){
 return new Promise(resolve=>{
  const done=()=>{clearTimeout(timer);globalThis.removeEventListener?.('online',done);resolve();};
  const timer=setTimeout(done,delay);
  globalThis.addEventListener?.('online',done,{once:true});
 });
}
export async function assetBytes(entry,onProgress,{recover=false,priority}={}){
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
  const data=new Uint8Array(entry.bytes);
  let error,offset=0,resume=false,validator=null,invalidChecksums=0;
  const attempts=recover?4:2;
  for(let attempt=0;attempt<attempts;){
   // Timeout measures a stalled transfer, not the entire download on a slow mobile link.
   const controller=new AbortController();let timer;
   const touch=()=>{clearTimeout(timer);timer=setTimeout(()=>controller.abort(),recover?10000:30000);};
   const offline=()=>controller.abort();
   let retryable=true,retryAfter=0;
   if(recover)globalThis.addEventListener?.('offline',offline,{once:true});
   try{
    const start=resume?offset:0,end=resume?Math.min(start+RESUME_BYTES,entry.bytes)-1:entry.bytes-1;
    const headers=resume?{'Range':`bytes=${start}-${end}`,...(validator?{'If-Range':validator}:{})}:undefined;
    touch();const response=await fetch(url,{signal:controller.signal,headers,priority});
    if(!response.ok){
     retryable=response.status===408||response.status===429||response.status>=500;
     const advice=response.headers.get('Retry-After');
     if(advice)retryAfter=Math.max(0,/^\d+$/.test(advice)?Number(advice)*1000:Date.parse(advice)-Date.now())||0;
     throw new Error('Asset unavailable: '+entry.file);
    }
    let limit=entry.bytes;
    if(response.status===200){
     offset=0;
     const tag=response.headers.get('ETag');
     validator=tag?.startsWith('"')?tag:null;
    }else if(resume&&response.status===206&&response.headers.get('Content-Range')===`bytes ${start}-${end}/${entry.bytes}`){
     limit=end+1;
    }else{
     controller.abort();
     throw new Error('Invalid asset range: '+entry.file);
    }
    const append=chunk=>{
     if(offset+chunk.byteLength>limit){controller.abort();throw new Error('Invalid asset size');}
     data.set(chunk,offset);offset+=chunk.byteLength;touch();onProgress?.(offset);
    };
    if(response.body?.getReader){
     const reader=response.body.getReader();
     while(offset<limit){
      const result=await reader.read();
      if(result.done)break;
      append(result.value);
     }
     if(offset===limit)void reader.cancel().catch(()=>{});
    }else append(new Uint8Array(await response.arrayBuffer()));
    if(offset!==limit)throw new Error('Incomplete asset: '+entry.file);
    if(offset<entry.bytes){attempt=0;continue;}
    if(!await valid(data.buffer)){
     offset=0;resume=false;validator=null;
     if(++invalidChecksums>=2)retryable=false;
     throw new Error('Invalid asset checksum: '+entry.file);
    }
    onProgress?.(entry.bytes);
    try{
     await cache?.put(url,new Response(data,{headers:{'Content-Type':entry.file.endsWith('.mp4')?'video/mp4':'application/octet-stream'}}));
     // Retain the current version of each file; unrelated worlds remain reusable.
     for(const old of await cache?.keys()||[]){const previous=new URL(old.url);if(previous.pathname===url.pathname&&previous.href!==url.href)await cache.delete(old);}
    }catch(_){}
    return data.buffer;
   }catch(e){error=e;}finally{clearTimeout(timer);globalThis.removeEventListener?.('offline',offline);}
   attempt++;
   if(recover&&(!retryable||attempt===attempts||retryAfter>30000))break;
   if(recover){
    resume=offset>0&&offset<entry.bytes&&Boolean(validator||globalThis.crypto?.subtle);
    onProgress?.(offset,'retry');
    const delay=700*2**(attempt-1);
    if(retryAfter)await new Promise(resolve=>setTimeout(resolve,Math.max(delay,retryAfter)));
    else await waitForRetry(delay);
   }
  }
  throw error;
 })().catch(error=>{memory.delete(key);throw error;});
 memory.set(key,pending);return pending;
}

export function progressReporter(entries,callback){
 const total=entries.reduce((sum,e)=>sum+e.bytes,0),counts=new Map(),retries=new Set(),started=performance.now();
 return (entry,bytes,phase='download')=>{
  if(entry){counts.set(entry.file,bytes);if(phase==='retry')retries.add(entry.file);else retries.delete(entry.file);}
  const received=[...counts.values()].reduce((a,b)=>a+b,0),elapsed=(performance.now()-started)/1000;
  callback?.({phase,retrying:retries.size>0,received,total,percent:total?Math.floor(100*received/total):0,remainingSeconds:elapsed>=1&&received>0&&received<total?Math.ceil((total-received)*elapsed/received):null});
 };
}

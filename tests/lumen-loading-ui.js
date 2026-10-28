async(page)=>{
  // Real WebP decode, using one existing sprite as both legacy and chunked input.
  // A fresh isolated context and manifest routes leave application saves alone.
  const context=await page.context().browser().newContext({viewport:{width:768,height:1024}});
  const p=await context.newPage(),origin='http://127.0.0.1:8081',errors=[];
  const assert=(ok,message)=>{if(!ok)throw Error(message);};
  p.on('pageerror',e=>errors.push(e.message));
  try{
    await p.route('https://telegram.org/**',route=>route.fulfill({body:'',contentType:'text/javascript'}));
    await p.goto(origin);
    const response=await p.request.get(origin+'/static/assets/lumen/manifest.json');
    assert(response.ok(),'Artwork manifest unavailable');
    const manifest=await response.json(),source=manifest.files['scout.png'];
    assert(source,'Existing Scout fixture missing');
    const sourceChunks=source.chunks||[{pack:source.pack,offset:source.offset,bytes:source.packBytes}];
    const buffers=new Map();
    for(const chunk of sourceChunks)if(!buffers.has(chunk.pack)){
      const download=await p.request.get(origin+'/static/assets/lumen/'+chunk.pack);
      assert(download.ok(),'Fixture pack unavailable: '+chunk.pack);
      buffers.set(chunk.pack,await download.body());
    }
    const encoded=Buffer.concat(sourceChunks.map(c=>buffers.get(c.pack).subarray(c.offset,c.offset+c.bytes)));
    const split=Math.floor(encoded.length/2),a='loading-qa-a.pack',b='loading-qa-b.pack',range='loading-qa-range.pack';
    const payloads=new Map([[a,encoded.subarray(0,split)],[b,encoded.subarray(split)],[range,Buffer.from([0,1,2])]]);
    const descriptor=name=>({file:name,bytes:payloads.get(name).length,sha256:'a'.repeat(64)});
    const chunked={bytes:source.bytes,sha256:source.sha256,chunks:[{pack:a,offset:0,bytes:split},{pack:b,offset:0,bytes:encoded.length-split}]};
    // Keep a single-range fixture even if Scout itself ever crosses a pack.
    const legacyPack='loading-qa-legacy.pack';payloads.set(legacyPack,encoded);
    const good={version:1,frameSize:48,packFormat:'image/webp',packs:[descriptor(legacyPack),descriptor(a),descriptor(b)],
      files:{'legacy.png':{pack:legacyPack,offset:0,packBytes:encoded.length},'chunked.png':chunked}};
    let served=good,aRequests=0;
    await context.route('**/assets/lumen/manifest.json',route=>route.fulfill({json:served}));
    await context.route(/\/assets\/lumen\/loading-qa-.*\.pack(?:\?.*)?$/,route=>{
      const name=new URL(route.request().url()).pathname.split('/').at(-1),body=payloads.get(name);
      assert(body,'Unexpected fixture pack '+name);
      // The first partial network response must be rejected by its byte count,
      // then retried through the existing bounded retry path.
      const truncated=name===a&&++aRequests===1;
      return route.fulfill({body:truncated?body.subarray(0,body.length-1):body,contentType:'application/octet-stream'});
    });
    const load=token=>p.evaluate(async token=>{
      const module=await import('/static/js/lumen/assets.mjs?loading-qa='+token);
      try{
        const art=await module.loadArt(),images=Object.values(art.images);
        let samePixels=true;
        if(art.images.legacy&&art.images.chunked){
          const pixels=image=>{const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return ctx.getImageData(0,0,c.width,c.height).data;};
          const first=pixels(art.images.legacy),second=pixels(art.images.chunked);
          samePixels=first.length===second.length&&first.every((v,i)=>v===second[i]);
        }
        return {ok:true,dimensions:images.map(im=>[im.naturalWidth,im.naturalHeight]),samePixels};
      }catch(error){return {ok:false,error:error.message};}
    },token);
    const goodResult=await load('good-'+Date.now());
    assert(goodResult.ok&&goodResult.samePixels,'Legacy/chunked decoded pixels differ: '+JSON.stringify(goodResult));
    assert(goodResult.dimensions.length===2&&goodResult.dimensions.every(d=>d[0]>0&&d[1]>0),'Textures did not decode');
    assert(aRequests===2,'Truncated chunk pack did not retry exactly once');
    const initialChunkRequests=aRequests;
    const invalid=[[],[{pack:'missing.pack',offset:0,bytes:1}],
      [{pack:range,offset:-1,bytes:1}],[{pack:range,offset:0,bytes:0}],
      [{pack:range,offset:2,bytes:2}],[{pack:range,offset:.5,bytes:1}],null];
    for(let n=0;n<invalid.length;n++){
      served={version:1,frameSize:48,packFormat:'image/webp',packs:[descriptor(range)],files:{'invalid.png':{chunks:invalid[n]}}};
      const result=await load('invalid-'+n+'-'+Date.now());
      assert(!result.ok&&result.error==='Invalid Lumen artwork entry: invalid.png','Invalid chunk accepted or failed at wrong boundary: '+JSON.stringify({n,result}));
    }
    // A failed load resets the memoized promise; retrying the same module after
    // the manifest recovers should decode the artwork normally.
    const recoveryToken='recovery-'+Date.now();
    const failed=await load(recoveryToken);assert(!failed.ok,'Recovery fixture should start invalid');
    served=good;const recovered=await load(recoveryToken);assert(recovered.ok&&recovered.samePixels,'Failed load remained cached');
    assert(!errors.length,'Unexpected page errors: '+JSON.stringify(errors));
    return {legacyAndChunks:true,exactBrowserPixels:true,truncatedPackAttempts:initialChunkRequests,
      rejectedChunkLayouts:invalid.length,recovery:true,dimensions:goodResult.dimensions,errors};
  }finally{await context.close();}
}

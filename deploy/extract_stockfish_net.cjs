"use strict";
// Recover the unmodified embedded evaluation file for source redistribution.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const target=path.resolve(__dirname,"../webapp/frontend/vendor/stockfish");
const expected="61e7af4bb97d51eeeb25d322916f86513b5cd3a827ce189c98c6e31946f99e5b";
const size=1166381,original=WebAssembly.instantiate;
let memory;
WebAssembly.instantiate=async function(...args){
  const result=await original(...args);
  memory=Object.values((result.instance||result).exports).find(value=>value instanceof WebAssembly.Memory);
  return result;
};
const engine=require(path.join(target,"stockfish-19-lite-single.js"))();
const deadline=setTimeout(()=>{process.stderr.write("Could not initialize the pinned engine.\n");process.exit(1);},15000);
const poll=setInterval(()=>{
  if(!engine._command||!memory)return;
  clearInterval(poll);clearTimeout(deadline);
  const data=Buffer.from(memory.buffer),header=Buffer.from("fa8a446a","hex");
  let offset=data.indexOf(header);
  while(offset>=0){
    const payload=data.subarray(offset,offset+size);
    if(crypto.createHash("sha256").update(payload).digest("hex")===expected){
      fs.writeFileSync(path.join(target,"nn-61e7af4bb97d.nnue"),payload);
      process.stdout.write("Pinned evaluation network recovered and SHA-256 verified.\n");process.exit(0);
    }
    offset=data.indexOf(header,offset+4);
  }
  process.stderr.write("Evaluation network does not match the pinned hash.\n");process.exit(1);
},20);

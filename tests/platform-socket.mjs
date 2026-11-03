import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source=readFileSync(new URL("../webapp/frontend/js/platform.js",import.meta.url),"utf8");

function fixture(){
  const connections=[],events=new Map(),timers=new Map();
  const navigator={onLine:true},telegram={isActive:true,onEvent:(name,fn)=>events.set(name,fn)};
  const target=prefix=>({addEventListener:(name,fn)=>events.set(prefix+name,fn)});
  let now=0,lastId=0;
  function schedule(callback,delay,interval=0){
    const id=++lastId;timers.set(id,{callback,at:now+delay,interval});return id;
  }
  class WebSocket {
    static OPEN=1;
    static CLOSING=2;
    readyState=0;
    sent=[];
    constructor(url){this.url=url;connections.push(this);}
    open(){this.readyState=1;this.onopen();}
    send(raw){this.sent.push(JSON.parse(raw));}
    message(data){this.onmessage({data:JSON.stringify(data)});}
    close(){this.readyState=3;}
    closed(code){this.close();this.onclose({code});}
  }
  const platform=vm.runInNewContext(source+"\nPlatform",{
    window:{...target("window:"),Telegram:{WebApp:telegram}},
    document:{...target("document:"),hidden:false},
    navigator,location:{protocol:"https:",host:"test.invalid"},WebSocket,
    tg:{initData:"test-auth"},hasTelegramIdentity:true,
    setTimeout:schedule,clearTimeout:id=>timers.delete(id),
    setInterval:(callback,delay)=>schedule(callback,delay,delay),clearInterval:id=>timers.delete(id),
  });
  function advance(ms){
    const end=now+ms;
    for(;;){
      const [id,timer]=[...timers.entries()].sort((a,b)=>a[1].at-b[1].at)[0]??[];
      if(!timer||timer.at>end)break;
      now=timer.at;
      if(timer.interval)timer.at+=timer.interval;
      else timers.delete(id);
      timer.callback();
    }
    now=end;
  }
  const trigger=(name,detail={})=>events.get(name)(detail);
  return {platform,connections,navigator,telegram,timers,advance,trigger};
}

test("authentication timeout replaces a socket even without a browser close event",()=>{
  const {platform,connections,timers,advance}=fixture();
  const statuses=[];
  const handle=platform.socket({onStatus:status=>statuses.push(status)});
  const first=connections[0];first.open();
  advance(15000);
  assert.equal(first.readyState,3);
  advance(500);
  assert.equal(connections.length,2);
  first.message({type:"ready"});
  assert.deepEqual(statuses,["connecting","reconnecting","connecting"]);
  handle.close();
  assert.equal(timers.size,0);
});

test("missed heartbeat replaces a half-open socket and accepts the new room snapshot",()=>{
  const {platform,connections,advance}=fixture();
  const snapshots=[];
  const handle=platform.socket({roomId:"room",onState:state=>snapshots.push(state)});
  const first=connections[0];first.open();first.message({type:"ready"});
  assert.deepEqual(first.sent[0],{type:"auth",initData:"test-auth",roomId:"room"});
  first.message({type:"ping"});
  assert.deepEqual(first.sent.at(-1),{type:"pong"});
  advance(20000);
  assert.deepEqual(first.sent.at(-1),{type:"ping"});
  first.message({type:"pong"});
  advance(10000);
  assert.equal(first.readyState,1);
  advance(20000);
  assert.equal(first.readyState,3);
  advance(500);
  first.message({type:"poker.state",state:"stale"});
  connections[1].open();
  connections[1].message({type:"ready"});
  connections[1].message({type:"poker.state",state:"current"});
  assert.deepEqual(snapshots,["current"]);
  handle.close();
});

test("network, Telegram activation and bfcache resume the original subscriptions",()=>{
  const {platform,connections,navigator,telegram,trigger,advance}=fixture();
  const handle=platform.socket({roomId:"room"});
  navigator.onLine=false;trigger("window:offline");
  advance(30000);
  assert.equal(connections.length,1);
  navigator.onLine=true;trigger("window:online");trigger("window:online");
  assert.equal(connections.length,2);
  telegram.isActive=false;trigger("deactivated");trigger("window:online");
  assert.equal(connections.length,2);
  telegram.isActive=true;trigger("activated");
  assert.equal(connections.length,3);
  trigger("window:pagehide",{persisted:true});
  trigger("window:pageshow",{persisted:true});
  assert.equal(connections.length,4);
  connections.at(-1).open();
  assert.equal(connections.at(-1).sent[0].roomId,"room");
  handle.close();
});

test("authorization failure stays terminal when the network returns",()=>{
  const {platform,connections,trigger,advance}=fixture();
  const statuses=[];
  const handle=platform.socket({onStatus:status=>statuses.push(status)});
  connections[0].closed(1008);
  trigger("window:online");
  advance(30000);
  assert.equal(connections.length,1);
  assert.deepEqual(statuses,["connecting","error"]);
  handle.close();
});

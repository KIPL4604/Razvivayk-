import test from 'node:test';
import assert from 'node:assert/strict';
import {LumenAudio} from '../webapp/frontend/js/lumen/audio.mjs';

const sound={sound:true,volume:70};

function audioFixture(){
  const audio=new LumenAudio(),sources=[];
  let playing=0;
  const parameter=()=>({setTargetAtTime(){}});
  audio.context={
    state:'running',currentTime:1,
    createGain:()=>({gain:parameter(),connect(){},disconnect(){}}),
    createBuffer(_channels,length,rate){
      const samples=new Float32Array(length);
      return {duration:length/rate,getChannelData:()=>samples};
    },
    createBufferSource(){
      const source={playbackRate:parameter(),connect(){},disconnect(){},start(){playing++;},
        stop(){assert(playing>0);playing--;}};
      sources.push(source);
      return source;
    },
  };
  audio.master=audio.context.createGain();
  return {audio,sources,active:()=>playing};
}

test('one expedition score plays, and pause, mute and world changes dispose it',async()=>{
  const {audio,sources,active}=audioFixture();
  // The synthesized scores can be tested independently of sample fetching.
  audio.samples.set('glass',{});audio.samples.set('boulder',{});
  audio.update('garden',false,sound);
  assert.equal(active(),0);
  await new Promise(resolve=>setTimeout(resolve,0));
  audio.update('garden',false,sound);
  audio.update('garden',false,sound);
  assert.equal(active(),1);
  assert.equal(sources.length,1);
  assert.equal(sources[0].buffer.duration,16);
  assert(sources[0].buffer.getChannelData(0).some(value=>Math.abs(value)>.1));
  audio.stop();audio.stop();
  assert.equal(active(),0);
  audio.update('garden',false,sound);
  assert.equal(active(),1);
  assert.equal(sources[1].buffer,sources[0].buffer);
  audio.update('castle',false,sound);
  assert.equal(active(),0);
  await new Promise(resolve=>setTimeout(resolve,0));
  audio.update('castle',false,sound);
  assert.equal(active(),1);
  assert.notEqual(sources[2].buffer,sources[0].buffer);
  audio.update('castle',false,{...sound,sound:false});
  assert.equal(active(),0);
  audio.update('castle',false,{...sound,volume:0});
  assert.equal(sources.length,3);
});

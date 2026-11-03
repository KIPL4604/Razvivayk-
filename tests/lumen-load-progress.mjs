import assert from 'node:assert/strict';
import test from 'node:test';
import {worldLoadProgress} from '../webapp/frontend/js/lumen/load-progress.mjs';

test('world progress survives stalls, partial retries and a new attempt',()=>{
 let time=0;
 const progress=worldLoadProgress(()=>time);
 const report=(key,received,phase='download',retrying=false)=>progress.update(key,{phase,received,total:100,retrying});
 assert.deepEqual(progress.read(),{phase:'manifest',percent:null,remainingSeconds:null});
 report('world',0);
 report('scene',100,'ready');
 time=1000;report('world',26);
 assert.deepEqual(progress.read(),{phase:'download',percent:63,remainingSeconds:3});
 time=5100;
 assert.deepEqual(progress.read(),{phase:'waiting',percent:63,remainingSeconds:null});
 assert.equal(progress.read(false).phase,'offline');
 report('world',0,'download',true);
 assert.deepEqual(progress.read(),{phase:'retry',percent:63,remainingSeconds:null});
 progress.restart();
 assert.equal(progress.read().percent,63);
 report('scene',100,'ready');
 report('world',100,'decode');
 assert.deepEqual(progress.read(),{phase:'decode',percent:99,remainingSeconds:null});
 report('world',100,'ready');
 assert.deepEqual(progress.read(),{phase:'ready',percent:100,remainingSeconds:null});
});

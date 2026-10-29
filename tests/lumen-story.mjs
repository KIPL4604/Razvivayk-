import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {selectArtFiles} from '../webapp/frontend/js/lumen/assets.mjs';
import {worldScene,bossScene} from '../webapp/frontend/js/lumen/story.mjs';
import {WORLD_FINALS} from '../webapp/frontend/js/lumen/arena.mjs';
import {CHARACTERS,MAPS} from '../webapp/frontend/js/lumen/catalog.mjs';
const root=new URL('../webapp/frontend/assets/lumen/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));

test('every world introduction silhouettes its actual final boss and has a complete post-victory story',()=>{
 for(const map of ['garden','quarry','castle','crater']){
  const intro=worldScene(map),battle=bossScene({kind:'arena-boss',id:7},map),ending=worldScene(map,'after');
  assert(intro.silhouette);assert.equal(intro.portrait,'boss-'+WORLD_FINALS[map].bossType);
  assert.equal(battle.portrait,intro.portrait);assert.equal(battle.id,'boss:7');assert(!battle.silhouette);
  for(const scene of [intro,battle,ending]){
   assert(scene.lines.length>=1);assert(manifest.storyPortraits[scene.portrait]);
   for(const line of scene.lines){assert(line.speaker&&line.text);assert(line.text.length<=240);assert(!/TODO|TBD/.test(line.text));}
  }
 }
 const ending=worldScene('castle','after').lines.map(line=>line.text).join(' ');
 assert.match(ending,/Тарен|возвращаемся/);assert.match(ending,/Савеле/);assert.match(ending,/Перевал/);assert.match(ending,/караван/);
});

test('every world and selectable hero has an independent story image within the mobile download budget',async()=>{
 const art=JSON.parse(await readFile(new URL('../design/lumen-dialogue-scenes/assets.json',import.meta.url),'utf8'));
 assert.deepEqual(Object.keys(art.heroes).sort(),Object.keys(CHARACTERS).sort());
 for(const map of Object.keys(MAPS)){
  assert.equal(worldScene(map).map,map);assert.equal(bossScene({kind:'arena-boss',id:1},map).map,map);
  assert(worldScene(map).bossName);
  assert.deepEqual(art.worlds[map].size,[1536,1024]);assert.deepEqual(art.worlds[map+'-small'].size,[768,512]);
  assert(art.worlds[map+'-small'].bytes<90_000,'mobile image must remain under 90 KB');
 }
 for(const entry of [...Object.values(art.worlds),...Object.values(art.heroes)]){
  const bytes=await readFile(new URL(entry.file,root));assert.equal(bytes.length,entry.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);
 }
 for(const entry of Object.values(art.heroes)){assert.deepEqual(entry.size,[192,256]);assert(entry.bytes<5_000);}
});

test('selected-world artwork includes every spawned creature and arena boundary without requiring castle textures',()=>{
 const names=map=>new Set(selectArtFiles(manifest,{map,character:'keeper'}).map(([file])=>file.replace('.png','')));
 for(const map of ['garden','quarry','crater']){
  const files=names(map);
  for(const id of ['mote','beetle','wasp','crawler','spitter','wisp','arena-tick','arena-fx','mega-chest','keeper'])assert(files.has(id),map+': '+id);
  assert(files.has('boss-'+WORLD_FINALS[map].bossType));assert(!files.has('boss-monarch'));assert(!files.has('castle-hall-floor'));
 }
 const quarry=names('quarry');for(const id of ['boss-drillguard','boss-resonator','boss-briar','boss-queen','boss-ash'])assert(quarry.has(id));
 const castle=names('castle');for(const id of ['boss-monarch','castle-door','castle-hall-floor','castle-hall-decor'])assert(castle.has(id));
 assert(!castle.has('boss-overseer'));assert.equal(selectArtFiles(manifest).length,Object.keys(manifest.files).length);
});

test('lightweight portrait files exist independently of packed graphics and match their production hashes',async()=>{
 for(const entry of Object.values(manifest.storyPortraits)){
  const bytes=await readFile(new URL(entry.file,root));assert.equal(bytes.length,entry.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);
  assert(bytes.length<100_000,'intro portrait must not wait for a large animation atlas');
 }
});

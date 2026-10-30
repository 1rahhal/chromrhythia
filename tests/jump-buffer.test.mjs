import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {build} from 'esbuild';
import * as T from 'three';
await mkdir('.cache/jump-tests',{recursive:true});
await build({entryPoints:['src/lifecycle.ts','src/audio.ts','src/renderer.ts','src/model.ts','src/render-kernel.ts'],outdir:'.cache/jump-tests',bundle:true,platform:'node',format:'esm'});
const {jumpLeadIn,songClock}=await import('../.cache/jump-tests/lifecycle.js');
const {Audio}=await import('../.cache/jump-tests/audio.js');
const {Renderer}=await import('../.cache/jump-tests/renderer.js');
const {Attempt,sanitizeSettings}=await import('../.cache/jump-tests/model.js');
const {NotePalette}=await import('../.cache/jump-tests/render-kernel.js');

test('jump countdown lasts one real second at every speed, followed by the full note approach',()=>{
 for(const speed of [.5,1,2,3])for(const approach of [.1,.5,2]){
  const lead=jumpLeadIn(43000,speed,approach),clock=10+lead.delayMs/1000;
  assert.equal(lead.delayMs,1000);assert.equal(songClock(lead.time,clock,10,speed),lead.time);assert.equal(songClock(lead.time,clock,10.999,speed),lead.time);
  assert.ok(Math.abs(songClock(lead.time,clock,clock+approach,speed)-43000)<1e-7);
  // Pausing after 400ms must leave 600ms of the quiet countdown on resume.
  const remaining=(clock-10.4)*1000,resumedClock=20+remaining/1000;
  assert.ok(Math.abs(remaining-600)<1e-7);assert.equal(songClock(lead.time,resumedClock,20.599,speed),lead.time);
 }
});

test('audio scheduling applies the silent buffer in real time independently of song speed',()=>{
 const old=globalThis.AudioContext,started=[];
 globalThis.AudioContext=class {currentTime=10;destination={};createGain(){return {gain:{value:1},connect(){}}}createBufferSource(){return {playbackRate:{value:1},connect(){},stop(){},disconnect(){},start(...args){started.push(args)}}}};
 try{const audio=new Audio();audio.buffer={duration:120};for(const speed of [.5,1,2,3]){audio.play(43000,speed,0,1000);assert.deepEqual(started.at(-1),[11,43])}audio.play(43000,1,0);assert.deepEqual(started.at(-1),[10,43]);audio.play(-500,2,0,1000);assert.deepEqual(started.at(-1),[11.25,0])}finally{globalThis.AudioContext=old}
});

test('quiet buffer draws no notes or hit effects, and practice never draws notes before its start',()=>{
 const settings=sanitizeSettings({background:'void',resolutionMode:'fixed',fadeIn:0,fadeOut:0});
 const mesh=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshBasicMaterial(),8);mesh.setColorAt(0,new T.Color());
 let clears=0;const engine={w:1920,h:1080,qualityMode:'fixed',renderScale:1,noteShape:'native',noteGeometries:new Map(),effects:{update(){},reset(){clears++}},palette:new NotePalette(),camera:new T.PerspectiveCamera(70,16/9,.05,160),grid:{},cursor:{update(){}},lastTime:0,hitColor:new T.Color(),spaceMaterial:{uniforms:{offset:{value:0}}},backgroundName:'void',tunnel:{visible:false},auroraMaterial:{uniforms:{time:{value:0}}},capacity:8,mesh,opacity:new T.InstancedBufferAttribute(new Float32Array(8),1),gl:{render(){}},scene:{},frames:0,lastFPS:performance.now(),lastFrameAt:0,instance:Renderer.prototype.instance};
 const attempt=new Attempt({id:'practice',length:2000,notes:[{index:0,time:1000,x:-.5,y:0},{index:1,time:1000,x:.5,y:0}]});attempt.judged[0]=3;
 Renderer.prototype.render.call(engine,1000,settings,attempt,{x:0,y:0},false,{x:0,y:0},false);assert.equal(mesh.count,1);
 Renderer.prototype.render.call(engine,1000,settings,attempt,{x:0,y:0},false,{x:0,y:0},true);assert.equal(mesh.count,0);assert.equal(clears,1);assert.equal(attempt.hits,0);assert.equal(attempt.misses,0);
 Renderer.prototype.render.call(engine,1000,settings,attempt,{x:0,y:0},false,{x:0,y:0},false);assert.equal(mesh.count,1);
});

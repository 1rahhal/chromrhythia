import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp} from 'node:fs/promises';
import {build} from 'esbuild';
import {api} from '../worker/api.mjs';
import {localBucket} from '../scripts/dev-bucket.mjs';
import {sanitizeSettings} from '../shared/settings.mjs';
await mkdir('.cache/audio-tests',{recursive:true});await build({entryPoints:['src/audio.ts','src/library-filters.ts','src/note-skins.ts'],outdir:'.cache/audio-tests',bundle:true,format:'esm',platform:'node'});
const {Audio}=await import('../.cache/audio-tests/audio.js');
test('hit and miss toggles and gains are independent, including shared preset serialization',async()=>{
 const before=globalThis.AudioContext,oldFetch=globalThis.fetch,nodes=[];
 globalThis.AudioContext=class{destination={};state='running';createGain(){return {gain:{value:1},connect(){}}}resume(){return Promise.resolve()}decodeAudioData(){return Promise.resolve({duration:.1})}createBufferSource(){const node={playbackRate:{value:1},connect(target){this.target=target},start(){nodes.push(this)},disconnect(){}};return node}};
 globalThis.fetch=async()=>new Response(new Uint8Array([1]));
 try{const audio=new Audio(),settings=sanitizeSettings({volume:80,musicVolume:30,soundsVolume:60,hitVolume:25,missVolume:75,hitEnabled:false,missEnabled:true});audio.setVolume(settings);await audio.init();await audio.event('hit');await audio.event('miss');assert.equal(nodes.length,1);assert.equal(audio.master.gain.value,.8);assert.equal(audio.music.gain.value,.3);assert.equal(audio.sfx.gain.value,.6);assert.equal(nodes[0].target.gain.value,.75);const restored=sanitizeSettings(JSON.parse(JSON.stringify(settings)));assert.equal(restored.hitEnabled,false);assert.equal(restored.hitVolume,25);audio.setVolume({...restored,hitEnabled:true});await audio.event('hit');assert.equal(nodes.length,2);assert.equal(nodes[1].target.gain.value,.25)}finally{globalThis.AudioContext=before;globalThis.fetch=oldFetch}
});
test('a late sound decode never queues a burst of missed hit sounds',async()=>{
 const oldContext=globalThis.AudioContext,oldFetch=globalThis.fetch;let decode,voices=0;
 globalThis.AudioContext=class{destination={};state='running';createGain(){return {gain:{value:1},connect(){}}}resume(){return Promise.resolve()}decodeAudioData(){return new Promise(r=>decode=r)}createBufferSource(){return {playbackRate:{value:1},connect(){},start(){voices++},disconnect(){}}}};
 globalThis.fetch=async()=>new Response(new Uint8Array([1]));
 try{const audio=new Audio();audio.setVolume(sanitizeSettings({missSound:'none'}));await Promise.resolve();await new Promise(r=>setImmediate(r));for(let i=0;i<10;i++)await audio.event('hit');assert.equal(voices,0);decode({duration:.1});await Promise.resolve();await Promise.resolve();assert.equal(voices,0);await audio.event('hit');assert.equal(voices,1)}finally{globalThis.AudioContext=oldContext;globalThis.fetch=oldFetch}
});
test('sound and media uploads are shared across clients while HTML and cross-origin writes are rejected',async()=>{
 const token='a'.repeat(64),env={PASSWORD_HASH:token,BUCKET:localBucket(await mkdtemp('.cache/assets-'))},bytes=Buffer.from('RIFF-test-audio'),id=createHash('sha256').update(bytes).digest('hex');
 const request=(path,method='GET',type='audio/wav',origin='https://game.test')=>new Request('https://game.test'+path,{method,headers:{authorization:'Bearer '+token,origin,'content-type':type,'content-length':String(bytes.length),'x-asset-name':'Click.wav'},...(method==='PUT'?{body:bytes}:{})});
 assert.equal((await api(new Request('https://game.test/api/assets'),env)).status,401);
 assert.equal((await api(request('/api/assets/'+id,'PUT'),env)).status,201);
 const list=await(await api(request('/api/assets'),env)).json();assert.equal(list.assets.length,1);assert.equal(list.assets[0].type,'audio/wav');assert.equal(list.assets[0].name,'Click.wav');
 const downloaded=await api(request('/api/assets/'+id),env);assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()),bytes);assert.equal(downloaded.headers.get('content-type'),'audio/wav');
 assert.equal((await api(request('/api/assets/'+id,'PUT','text/html'),env)).status,400);assert.equal((await api(request('/api/assets/'+id,'PUT','audio/wav','https://other.test'),env)).status,403);
});
test('profiles accept only typed media, bounded HUD layouts, and supported shapes',()=>{const value=sanitizeSettings({noteSkin:'octagon',hitEffect:'break',borderSkin:'full',mediaLayers:[{id:'a'.repeat(64),type:'video',opacity:500},{id:'javascript:bad',type:'image'}],hudLayout:{combo:{x:-20,y:150,scale:40,visible:false},unknown:{x:0,y:0}},hitSound:'javascript:bad'});assert.equal(value.noteSkin,'octagon');assert.equal(value.mediaLayers.length,1);assert.equal(value.mediaLayers[0].opacity,100);assert.deepEqual(value.hudLayout.combo,{x:0,y:100,scale:3,visible:false});assert.equal(value.hudLayout.unknown,undefined);assert.equal(value.hitSound,'hit')});
test('sort and grouping use real map data and local attempts',async()=>{const {sortedMaps,mapGroup}=await import('../.cache/audio-tests/library-filters.js');const a={id:'a',title:'B',artist:'Artist',length:10000,count:100,notes:[],mappers:['Mapper'],difficulty:2},b={...a,id:'b',title:'A',length:10000,count:10};assert.deepEqual(sortedMaps([a,b],{sort:'density',descending:true,group:'none',unranked:true},[]).map(c=>c.id),['a','b']);assert.equal(mapGroup(a,'mapper',[]),'Mapper');assert.equal(mapGroup(a,'grade',[]),'Unplayed');assert.deepEqual(sortedMaps([a],{sort:'title',descending:false,group:'none',unranked:false},[]),[])});
test('note skins keep finite indexed geometry within the existing note dimensions',async()=>{const {noteSkinGeometry}=await import('../.cache/audio-tests/note-skins.js');for(const name of ['square','rounded','octagon','plane','circle']){const geometry=noteSkinGeometry(name);geometry.computeBoundingBox();assert.ok(geometry.index.count>0);assert.equal(geometry.index.count%3,0);assert.ok(geometry.getAttribute('position').array.every(Number.isFinite));assert.ok(geometry.boundingBox.max.x<=.438);assert.ok(geometry.boundingBox.min.x>=-.438);assert.ok(geometry.boundingBox.max.z<=.061);assert.equal(geometry.getAttribute('uv'),undefined);geometry.dispose()}});

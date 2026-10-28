import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {build} from 'esbuild';
import * as THREE from 'three';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
await mkdir('.cache/render-tests',{recursive:true});
await build({entryPoints:['src/render-kernel.ts','src/match-hud.ts','src/replay.ts','src/model.ts'],outdir:'.cache/render-tests',bundle:true,format:'esm',platform:'node'});
const {compactNoteGeometry,createTunnel,writeNoteMatrix,NotePalette}=await import('../.cache/render-tests/render-kernel.js');
const {updateMatchHud}=await import('../.cache/render-tests/match-hud.js');
const {replayPoint,replayJudgment,replaySettingsAt}=await import('../.cache/render-tests/replay.js');
const {sanitizeSettings,noteVisual}=await import('../.cache/render-tests/model.js');

test('indexed notes retain every triangle position while removing duplicate vertices and unused attributes',async()=>{
  const model=new OBJLoader().parse(await readFile('public/assets/squircle.obj','utf8'));let original;model.traverse(o=>{if(!original&&o.geometry)original=o.geometry});
  const optimized=compactNoteGeometry(original),p=original.getAttribute('position'),q=optimized.getAttribute('position');
  assert.equal(p.count,678);assert.equal(q.count,113);assert.equal(optimized.index.count,678);
  assert.equal(optimized.getAttribute('normal'),undefined);assert.equal(optimized.getAttribute('uv'),undefined);
  for(let i=0;i<678;i++)for(let axis=0;axis<3;axis++)assert.ok(Math.abs(p.array[i*3+axis]-q.array[optimized.index.array[i]*3+axis])<1e-6);
});

test('direct instance updates match the old Three transform path, including resetting rotated instances',()=>{
  const mesh=new THREE.InstancedMesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial(),8),object=new THREE.Object3D();
  for(const angle of [0,.13,1.7,-2.9,0])for(let i=0;i<8;i++){
    object.position.set(i/7,-i/9,-i*3);object.rotation.z=angle;object.updateMatrix();
    writeNoteMatrix(mesh.instanceMatrix.array,i,i/7,-i/9,-i*3,angle);
    for(let j=0;j<16;j++)assert.ok(Math.abs(mesh.instanceMatrix.array[i*16+j]-Math.fround(object.matrix.elements[j]))<1e-7);
  }
});

test('tunnel keeps nine correctly positioned rings but shares two textures, two materials and one geometry',()=>{
  const paths=[],tunnel=createTunnel(path=>{paths.push(path);return new THREE.Texture()});
  assert.deepEqual(paths,['assets/tunnel_ring_b.png','assets/tunnel_space_a.png']);assert.equal(tunnel.children.length,9);
  assert.equal(new Set(tunnel.children.map(o=>o.material.map)).size,2);assert.equal(new Set(tunnel.children.map(o=>o.material)).size,2);assert.equal(new Set(tunnel.children.map(o=>o.geometry)).size,1);
  tunnel.children.forEach((o,i)=>{assert.equal(o.position.z,-i*26.25);assert.equal(o.material.depthWrite,false);assert.equal(o.material.transparent,true)});
});

test('cached note colors retain color-space conversion and detect edits in the same array',()=>{
  const palette=new NotePalette(),values=['#ff0059','#ffd8e6'];palette.sync(values);const first=palette.colors;
  palette.sync([...values]);assert.equal(palette.colors,first);
  values[0]='#123456';palette.sync(values);assert.notEqual(palette.colors,first);
  const expected=new THREE.Color(values[0]);assert.equal(palette.colors[0].r,expected.r);assert.equal(palette.colors[0].g,expected.g);assert.equal(palette.colors[0].b,expected.b);
});

test('HUD caches node lookup and skips unchanged ring and accessibility mutations',()=>{
  let lookups=0,writes=0;const nodes=new Map(),root={querySelector(selector){lookups++;if(!nodes.has(selector))nodes.set(selector,{textContent:'',className:'',setAttribute(){writes++}});return nodes.get(selector)}};
  const attempt={accuracy:100,misses:0,combo:0,multiplier:1,multiplierProgress:0,increment:5,chart:{length:60000}};
  updateMatchHud(root,attempt,100);const initialLookups=lookups,initialWrites=writes;
  for(let i=0;i<100;i++)updateMatchHud(root,attempt,100+i);
  assert.equal(lookups,initialLookups);assert.equal(writes,initialWrites);
  attempt.combo=7;attempt.multiplierProgress=2;updateMatchHud(root,attempt,200);assert.equal(writes,initialWrites+2);
});

test('reused replay and visual outputs retain results, camera interpolation and backward settings lookup',()=>{
  const a=sanitizeSettings({}),b=sanitizeSettings({fov:100}),record={settings:a,settingsChanges:[{time:50,settings:b}],frames:[[0,0,0,0,0],[100,1,-1,.2,-.4]]};
  const point={index:0,x:0,y:0,spinX:0,spinY:0},decision={hit:false,miss:false,lateness:0},cursor={index:-1,time:-Infinity};
  assert.equal(replayPoint(record,50,0,point),point);assert.equal(point.x,.5);assert.equal(point.spinY,-.2);
  assert.equal(replayJudgment(-2,1000,decision),decision);assert.equal(decision.miss,false);
  assert.equal(replaySettingsAt(record,80,cursor),b);assert.equal(replaySettingsAt(record,0,cursor),a);
  const visual={depth:0,opacity:0};for(const t of [-100,0,300,500])assert.deepEqual(noteVisual(t,500,a,1,false,visual),noteVisual(t,500,a));
});

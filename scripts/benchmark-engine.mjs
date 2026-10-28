// CPU microbenchmark only: this does not measure browser FPS or GPU execution.
import {build} from 'esbuild';
import {readFile,mkdir} from 'node:fs/promises';
import * as T from 'three';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
await mkdir('.cache/benchmark',{recursive:true});
await build({entryPoints:['src/render-kernel.ts'],outfile:'.cache/benchmark/kernel.mjs',bundle:true,platform:'node',format:'esm'});
const {writeNoteMatrix,NotePalette,compactNoteGeometry}=await import('../.cache/benchmark/kernel.mjs');
const count=8192,iterations=300000,mesh=new T.InstancedMesh(new T.BufferGeometry(),new T.MeshBasicMaterial(),count),dummy=new T.Object3D(),color=new T.Color();
mesh.setColorAt(0,color);const matrices=mesh.instanceMatrix.array,colors=mesh.instanceColor.array,opacity=new Float32Array(count),hex=['#ff0059','#ffd8e6'];
const palette=new NotePalette();palette.sync(hex);
function sample(optimized,rotating,n=iterations){
  const begin=performance.now();
  for(let i=0;i<n;i++){
    const index=i%count,x=(i%31)/20,y=(i%23)/17,z=-(i%19),rotation=rotating?(i%32-16)/10:0;
    if(optimized){writeNoteMatrix(matrices,index,x,y,z,rotation);const rgb=palette.colors[i%2],offset=index*3;colors[offset]=rgb.r;colors[offset+1]=rgb.g;colors[offset+2]=rgb.b;opacity[index]=.5}
    else{dummy.position.set(x,y,z);dummy.rotation.z=rotation;dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);mesh.setColorAt(index,color.set(hex[i%2]));opacity[index]=.5}
  }
  const elapsed=performance.now()-begin;let checksum=0;for(let i=0;i<count;i++)checksum+=matrices[i*16]+matrices[i*16+12]+colors[i*3]+opacity[i];
  return {ms:elapsed,checksum};
}
const median=a=>a.sort((a,b)=>a-b)[Math.floor(a.length/2)],runs=[];
for(const rotating of [false,true]){
  sample(false,rotating,50000);sample(true,rotating,50000);
  const before=[],after=[];let old,newer;
  for(let trial=0;trial<5;trial++){
    if(trial%2){newer=sample(true,rotating);old=sample(false,rotating)}else{old=sample(false,rotating);newer=sample(true,rotating)}
    if(Math.abs(old.checksum-newer.checksum)>1e-4)throw Error('Transform/color checksum changed');
    before.push(old.ms);after.push(newer.ms);
  }
  const a=median(before),b=median(after);runs.push({scenario:rotating?'rotating notes':'unrotated notes',instances:iterations,beforeMedianMs:+a.toFixed(2),afterMedianMs:+b.toFixed(2),speedup:+(a/b).toFixed(2)});
}
const source=new OBJLoader().parse(await readFile('public/assets/squircle.obj','utf8'));let original;source.traverse(o=>{if(!original&&o.geometry)original=o.geometry});
const optimized=compactNoteGeometry(original);
const images=await Promise.all(['tunnel_ring_b.png','tunnel_space_a.png'].map(async name=>{const png=await readFile('public/assets/'+name),width=png.readUInt32BE(16),height=png.readUInt32BE(20);let bytes=0;for(let w=width,h=height;;w=Math.max(1,w>>1),h=Math.max(1,h>>1)){bytes+=w*h*4;if(w===1&&h===1)break}return {name,width,height,estimatedRGBA8MipBytes:bytes}}));
const before=images[0].estimatedRGBA8MipBytes*5+images[1].estimatedRGBA8MipBytes*4,after=images.reduce((n,i)=>n+i.estimatedRGBA8MipBytes,0);
console.log(JSON.stringify({kind:'CPU microbenchmark; not browser FPS',runtime:process.version,runs,noteMesh:{beforeVertices:original.getAttribute('position').count,afterVertices:optimized.getAttribute('position').count,indices:optimized.index.count,triangles:optimized.index.count/3},tunnel:{beforeTextureCount:9,afterTextureCount:2,beforeEstimatedMiB:+(before/1048576).toFixed(2),afterEstimatedMiB:+(after/1048576).toFixed(2),images}},null,2));

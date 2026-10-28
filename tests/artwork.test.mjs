import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile} from 'node:fs/promises';
import {createHash,randomBytes} from 'node:crypto';
import {zipSync,strToU8} from 'fflate';
import {build} from 'esbuild';
import {api} from '../worker/api.mjs';
import {extractArtwork,imageType} from '../worker/artwork.mjs';
import {localBucket} from '../scripts/dev-bucket.mjs';

await mkdir('.cache/artwork-tests',{recursive:true});
await build({entryPoints:['src/maps.ts','src/shared.ts'],outdir:'.cache/artwork-tests',bundle:true,platform:'node',format:'esm'});
const {parseMap}=await import('../.cache/artwork-tests/maps.js');
const image=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64'));
const rhm=(cover=image)=>zipSync({map:strToU8(JSON.stringify({Title:'Artist - Song',ImagePath:'/cache/covers/native-hash',Notes:[{Time:100,X:1,Y:1}],Mappers:['Mapper']})),audio:[randomBytes(2*1024*1024),{level:0}],...(cover?{cover}:{})});
const fromBytes=bytes=>(offset,length)=>Promise.resolve(bytes.slice(offset,offset+length));

test('RHM imports use the bundled cover, rather than a native cache file path',async()=>{
  const chart=await parseMap(rhm(),'song.rhm');assert.deepEqual(chart.cover,image);
  const noCover=await parseMap(rhm(null),'song.rhm');assert.equal(noCover.cover,undefined);
});

test('artwork extraction reads ZIP directory and cover ranges without downloading audio',async()=>{
  const bytes=rhm(),reads=[];const cover=await extractArtwork((offset,length)=>{reads.push({offset,length});return fromBytes(bytes)(offset,length)},bytes.length);
  assert.deepEqual(cover,image);assert.ok(reads.reduce((sum,r)=>sum+r.length,0)<80000);assert.ok(reads.every(r=>r.length<=65557));
  const webp=Uint8Array.from([82,73,70,70,4,0,0,0,87,69,66,80]);assert.equal(imageType(webp),'image/webp');
});

test('SSPM v2 artwork extraction validates offsets and does not read audio',async()=>{
  const bytes=new Uint8Array(2*1024*1024),view=new DataView(bytes.buffer);bytes.set(strToU8('SS+m'));view.setUint16(4,2,true);bytes[46]=1;view.setBigUint64(80,BigInt(bytes.length-image.length),true);view.setBigUint64(88,BigInt(image.length),true);bytes.set(image,bytes.length-image.length);
  const reads=[];assert.deepEqual(await extractArtwork((offset,length)=>{reads.push(length);return fromBytes(bytes)(offset,length)},bytes.length),image);assert.deepEqual(reads,[128,image.length]);
  view.setBigUint64(80,BigInt(bytes.length),true);await assert.rejects(()=>extractArtwork(fromBytes(bytes),bytes.length),/outside map/);
});

test('missing cloud covers repair once and persist for other visitors; absent art is remembered',async()=>{
  const bucket=localBucket(await mkdtemp('.cache/artwork-bucket-')),token='a'.repeat(64),env={PASSWORD_HASH:token,BUCKET:bucket};let rangeReads=0;
  const originalGet=bucket.get;bucket.get=async(key,options)=>{const object=await originalGet(key);if(object&&options?.range){rangeReads++;return {...object,body:object.body.subarray(options.range.offset,options.range.offset+options.range.length)}}return object};
  async function put(bytes){const id=createHash('sha256').update(bytes).digest('hex');await bucket.put(`maps/${id}.bin`,bytes,{customMetadata:{chart:Buffer.from(JSON.stringify({title:'Song',fileName:'song.rhm',hasCover:false})).toString('base64')}});return id}
  const id=await put(rhm()),request=id=>new Request(`https://game.test/api/maps/${id}/cover`,{headers:{authorization:'Bearer '+token}});
  assert.equal((await api(new Request(`https://game.test/api/maps/${id}/cover`),env)).status,401);
  const first=await api(request(id),env);assert.equal(first.status,200);assert.equal(first.headers.get('content-type'),'image/png');assert.deepEqual(new Uint8Array(await first.arrayBuffer()),image);assert.ok(rangeReads>0);
  rangeReads=0;const second=await api(request(id),env);assert.equal(second.status,200);assert.deepEqual(new Uint8Array(await second.arrayBuffer()),image);assert.equal(rangeReads,0);
  const absentId=await put(rhm(null));assert.equal((await api(request(absentId),env)).status,404);rangeReads=0;assert.equal((await api(request(absentId),env)).status,404);assert.equal(rangeReads,0);
  // A smaller browser thumbnail replaces the extracted original, then remains shared.
  const thumbnail=Uint8Array.from([255,216,255,1]);const upload=await api(new Request(`https://game.test/api/maps/${id}/cover`,{method:'PUT',headers:{authorization:'Bearer '+token,origin:'https://game.test','content-length':String(thumbnail.length)},body:thumbnail}),env);assert.equal(upload.status,201);const thumb=await api(request(id),env);assert.equal(thumb.headers.get('content-type'),'image/jpeg');assert.deepEqual(new Uint8Array(await thumb.arrayBuffer()),thumbnail);
});

test('cover downloads survive unavailable CacheStorage and surface transient errors for retry',async()=>{
  const before={window:globalThis.window,caches:globalThis.caches,fetch:globalThis.fetch};
  try{globalThis.window={__CHROMRHYTHIA_AUTH__:'a'.repeat(64)};globalThis.caches={open:async()=>{throw Error('storage blocked')}};globalThis.location={href:'https://game.test/'};const {fetchCover}=await import('../.cache/artwork-tests/shared.js');
    globalThis.fetch=async()=>new Response(image,{headers:{'content-type':'image/png'}});assert.deepEqual(await fetchCover('a'.repeat(64)),image);
    globalThis.fetch=async()=>new Response('offline',{status:503});await assert.rejects(()=>fetchCover('a'.repeat(64)),/temporarily unavailable/);
    globalThis.fetch=async()=>new Response('',{status:404});assert.equal(await fetchCover('a'.repeat(64)),undefined);
  }finally{for(const [key,value]of Object.entries(before))if(value===undefined)delete globalThis[key];else globalThis[key]=value;delete globalThis.location}
});

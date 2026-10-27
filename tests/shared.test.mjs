import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp} from 'node:fs/promises';
import {api} from '../worker/api.mjs';
import {worker} from '../worker/index.mjs';
import {localBucket} from '../scripts/dev-bucket.mjs';
const token=createHash('sha256').update('test-only-password').digest('hex');
const env={PASSWORD_HASH:token,BUCKET:localBucket(await mkdtemp('.cache/shared-test-'))};
const data=Buffer.from('SS+m fixture content'),id=createHash('sha256').update(data).digest('hex');
const meta=Buffer.from(JSON.stringify({title:'Shared chart',artist:'Artist',mappers:['Mapper'],difficulty:2,count:5,length:1000,fileName:'shared.sspm'})).toString('base64');
const request=(path,init={})=>new Request('https://game.test'+path,init);
test('shared API rejects missing and wrong passwords',async()=>{assert.equal((await api(request('/api/maps'),env)).status,401);assert.equal((await api(request('/api/maps',{headers:{authorization:'Bearer '+'0'.repeat(64)}}),env)).status,401)});
test('an upload is listed and downloaded by a second visitor without downloading audio in the index',async()=>{
 const upload=await api(request('/api/maps/'+id,{method:'PUT',headers:{authorization:'Bearer '+token,'content-length':String(data.length),'x-map-metadata':meta,origin:'https://game.test'},body:data}),env);assert.equal(upload.status,201);
 const list=await api(request('/api/maps',{headers:{authorization:'Bearer '+token}}),env),index=await list.json();assert.equal(index.maps.length,1);assert.equal(index.maps[0].title,'Shared chart');assert.deepEqual(index.maps[0].notes,[]);assert.equal(index.maps[0].size,data.length);assert.equal(index.maps[0].audio,undefined);
 const download=await api(request('/api/maps/'+id+'/download',{headers:{authorization:'Bearer '+token}}),env);assert.deepEqual(Buffer.from(await download.arrayBuffer()),data);
});
test('upload size and origin restrictions are enforced',async()=>{assert.equal((await api(request('/api/maps/'+id,{method:'PUT',headers:{authorization:'Bearer '+token,'content-length':'999999999','x-map-metadata':meta},body:'x'}),env)).status,413);assert.equal((await api(request('/api/maps/'+id,{method:'PUT',headers:{authorization:'Bearer '+token,'content-length':'1','x-map-metadata':meta,origin:'https://other.test'},body:'x'}),env)).status,403)});

test('cover thumbnails require auth and an existing map, then are shared without entering the map index',async()=>{
 const cover=Buffer.from([137,80,78,71,13,10,26,10,1,2,3]);
 const headers={authorization:'Bearer '+token,'content-length':String(cover.length),origin:'https://game.test'};
 assert.equal((await api(request('/api/maps/'+id+'/cover'),env)).status,401);
 assert.equal((await api(request('/api/maps/'+'0'.repeat(64)+'/cover',{method:'PUT',headers,body:cover}),env)).status,404);
 assert.equal((await api(request('/api/maps/'+id+'/cover',{method:'PUT',headers,body:cover}),env)).status,201);
 const r=await api(request('/api/maps/'+id+'/cover',{headers:{authorization:'Bearer '+token}}),env);
 assert.equal(r.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await r.arrayBuffer()),cover);
 const index=await (await api(request('/api/maps',{headers:{authorization:'Bearer '+token}}),env)).json();assert.equal(index.maps.length,1);
});

test('deployments revalidate mutable asset URLs and cache fingerprinted files safely',async()=>{
 const assets=Object.fromEntries(['style.css','index.html','source.zip','sw.js','style.123abc.css','game.123abc.bin'].map(path=>[path,{type:'text/plain',base64:btoa('fixture'),etag:'"test"'}]));const site=worker(assets);
 for(const path of ['style.css','index.html','source.zip','sw.js']){const r=await site.fetch(request('/'+path),{},{});assert.equal(r.headers.get('cache-control'),'no-cache')}
 for(const path of ['style.123abc.css','game.123abc.bin']){const r=await site.fetch(request('/'+path),{},{});assert.match(r.headers.get('cache-control'),/immutable/)}
});

const publisher='a'.repeat(64),otherPublisher='b'.repeat(64),presetId='11111111-1111-4111-8111-111111111111';
const presetRequest=(path,method='GET',value,owner=publisher)=>request(path,{method,headers:{authorization:'Bearer '+token,...(method==='GET'?{}:{'content-type':'application/json','x-preset-key':owner,origin:'https://game.test'})},...(value?{body:JSON.stringify(value)}:{})});
test('shared presets require game access, strip private fields, and keep every client independent',async()=>{
 assert.equal((await api(request('/api/presets'),env)).status,401);
 const r=await api(presetRequest('/api/presets','POST',{id:presetId,name:'My cursor',author:'Player',settings:{parallax:0,cursorShape:'circle',cursorFill:true,cursorTrail:true,publisherKey:'do-not-share',authToken:'secret',colors:['#123456']}}),env);assert.equal(r.status,201);const {preset}=await r.json();assert.equal(preset.settings.parallax,0);assert.equal(preset.settings.cursorFill,true);assert.equal(preset.ownerHash,undefined);assert.equal(preset.settings.publisherKey,undefined);assert.equal(preset.settings.authToken,undefined);
 const list=await (await api(presetRequest('/api/presets'),env)).json();assert.equal(list.presets.length,1);assert.equal(list.presets[0].settings.cursorShape,'circle');assert.equal(JSON.stringify(list).includes(publisher),false);assert.equal(JSON.stringify(list).includes('ownerHash'),false);
 // Another client copies to a new profile; its edits cannot change the original.
 const copy=await api(presetRequest('/api/presets','POST',{name:'My independent copy',settings:{...preset.settings,parallax:50}},otherPublisher),env);assert.equal(copy.status,201);const listed=await (await api(presetRequest('/api/presets'),env)).json();assert.equal(listed.presets.find(p=>p.id===presetId).settings.parallax,0);
});
test('only a preset publisher can update it, and creation retries are idempotent',async()=>{
 const update={id:presetId,name:'Updated',settings:{cursorShape:'square',cursorFill:true}};
 assert.equal((await api(presetRequest('/api/presets/'+presetId,'PUT',update,otherPublisher),env)).status,403);
 assert.equal((await api(presetRequest('/api/presets','POST',update,otherPublisher),env)).status,403);
 assert.equal((await api(presetRequest('/api/presets/'+presetId,'PUT',update),env)).status,200);
 assert.equal((await api(presetRequest('/api/presets','POST',update),env)).status,200);
 const list=await (await api(presetRequest('/api/presets'),env)).json();assert.equal(list.presets.length,2);assert.equal(list.presets.find(p=>p.id===presetId).name,'Updated');assert.equal(list.presets.find(p=>p.id===presetId).settings.cursorShape,'square');
});
test('preset uploads reject malformed, oversized and cross-origin writes',async()=>{
 assert.equal((await api(presetRequest('/api/presets','POST',{name:'',settings:{}}),env)).status,400);
 assert.equal((await api(presetRequest('/api/presets','POST',{name:'Large',settings:{extra:'x'.repeat(20000)}}),env)).status,413);
 assert.equal((await api(request('/api/presets',{method:'POST',headers:{authorization:'Bearer '+token,'x-preset-key':publisher,origin:'https://other.test'},body:'{}'}),env)).status,403);
 assert.equal((await api(presetRequest('/api/presets/nope','PUT',{name:'x',settings:{}}),env)).status,404);
});

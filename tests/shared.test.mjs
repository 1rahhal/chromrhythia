import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp} from 'node:fs/promises';
import {api} from '../worker/api.mjs';
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

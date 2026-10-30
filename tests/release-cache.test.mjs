import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {versionedShell} from '../scripts/build.mjs';
const shell=await readFile('public/index.html','utf8'),loader=await readFile('public/unlock.js','utf8'),sw=await readFile('public/sw.js','utf8');
function unlockFixture(build,config){
  const html=versionedShell(shell,build),requests=[],nodes={};let submit;
  for(const id of ['#unlock-button','#unlock-error','#password'])nodes[id]={value:'test-password',focus(){}};
  nodes['#unlock-form']={addEventListener(name,fn){submit=fn}};
  runInNewContext(loader,{document:{currentScript:{dataset:{config:html.match(/data-config="([^"]+)"/)[1]}},documentElement:{dataset:{build}},querySelector:id=>nodes[id]},navigator:{},crypto:{subtle:{}},fetch:async path=>{requests.push(path);return path.endsWith('.json')?new Response(JSON.stringify(config)):new Response('',{status:404})},window:{},Response});
  return {html,requests,nodes,submit:()=>submit({preventDefault(){}})};
}
test('an already open shell requests its own manifest and payload after a service-worker update',async()=>{
  const old='1111111111111111',fixture=unlockFixture(old,{build:old,payload:`game.${old}.bin`});
  assert.ok(fixture.html.includes(`style.${old}.css`));assert.ok(fixture.html.includes(`unlock.${old}.js`));
  await fixture.submit();assert.deepEqual(fixture.requests,[`unlock.${old}.json`,`game.${old}.bin`]);
});
test('the loader rejects mismatched code before it can run against the page stylesheet',async()=>{
  const fixture=unlockFixture('1111111111111111',{build:'2222222222222222',payload:'game.2222222222222222.bin'});
  await fixture.submit();assert.deepEqual(fixture.requests,['unlock.1111111111111111.json']);assert.match(fixture.nodes['#unlock-error'].textContent,/matching styles/);
});
function workerFixture(online=true){
  const stores=new Map(),listeners=new Map(),key=value=>new URL(typeof value==='string'?value:value.url||String(value),'https://test.game/').href;
  const open=async name=>{if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);return {match:async req=>store.get(key(req))?.clone(),put:async(req,response)=>store.set(key(req),response.clone())}};
  const cacheApi={open,keys:async()=>[...stores.keys()],delete:async name=>stores.delete(name),match:async req=>{for(const name of stores.keys()){const response=await(await open(name)).match(req);if(response)return response}}};
  runInNewContext(sw.replace('__VERSION__','new').replace('__CORE__','[]'),{self:{addEventListener:(event,fn)=>listeners.set(event,fn),registration:{scope:'https://test.game/'},clients:{claim:async()=>{}},skipWaiting:async()=>{}},location:{origin:'https://test.game'},caches:cacheApi,URL,Request,AbortSignal,fetch:async()=>{if(!online)throw Error('offline');return new Response('new shell')}});
  return {stores,open,async fetch(path){let response;listeners.get('fetch')({request:new Request('https://test.game/'+path),respondWith:p=>response=p});return await response},async activate(){let pending;listeners.get('activate')({waitUntil:p=>pending=p});await pending}};
}
test('navigation updates the shell online and still opens the cached shell offline',async()=>{
  for(const online of [true,false]){const worker=workerFixture(online),cache=await worker.open('chromrhythia-new');await cache.put('https://test.game/',new Response('old shell'));assert.equal(await(await worker.fetch('')).text(),online?'new shell':'old shell')}
});
test('activation retains the previous build so open tabs can finish loading their matching assets',async()=>{
  const worker=workerFixture();await worker.open('chromrhythia-ancient');const previous=await worker.open('chromrhythia-old');await previous.put('https://test.game/unlock.1111111111111111.json',new Response('previous manifest'));await worker.open('chromrhythia-new');await worker.activate();
  assert.deepEqual([...worker.stores.keys()],['chromrhythia-old','chromrhythia-new']);assert.equal(await(await worker.fetch('unlock.1111111111111111.json')).text(),'previous manifest');
});

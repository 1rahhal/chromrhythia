import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {build} from 'esbuild';
await mkdir('.cache/selector-motion-tests',{recursive:true});
await build({entryPoints:['src/selector-motion.ts'],outdir:'.cache/selector-motion-tests',bundle:true,platform:'node',format:'esm'});
const {ArtworkCache,SelectorArtwork}=await import('../.cache/selector-motion-tests/selector-motion.js');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
const appearance=name=>({background:'data:image/jpeg;base64,'+name,tint:'rgb(100 30 70)'});
function element(){
  const classes=new Set();
  return {style:{},children:[],ownerDocument:{createElement:()=>element()},classList:{add:(...names)=>names.forEach(n=>classes.add(n)),remove:(...names)=>names.forEach(n=>classes.delete(n)),contains:n=>classes.has(n),toggle:(n,value)=>{if(value)classes.add(n);else classes.delete(n)}},append(node){this.children.push(node)},remove(){this.removed=true}};
}
test('rapid song changes cannot display an older decode over the latest artwork',async()=>{
  const requests=new Map(['a','b','c'].map(id=>[id,deferred()])),root=element();
  const view=new SelectorArtwork(root,url=>requests.get(url).promise),a=element(),b=element(),c=element();
  const first=view.select('a',a);requests.get('a').resolve(appearance('a'));await first;
  const second=view.select('b',b),third=view.select('c',c);
  requests.get('b').resolve(appearance('b'));await second;
  assert.equal(b.classList.contains('art-ready'),false);
  assert.ok(root.children.find(n=>n.classList.contains('visible')).style.backgroundImage.includes('base64,a'));
  requests.get('c').resolve(appearance('c'));await third;
  const visible=root.children.filter(n=>n.classList.contains('visible'));
  assert.equal(visible.length,1);assert.ok(visible[0].style.backgroundImage.includes('base64,c'));assert.equal(c.classList.contains('art-ready'),true);
});
test('failed or removed song artwork clears the previous background and keeps a fallback',async()=>{
  const root=element(),view=new SelectorArtwork(root,async url=>{if(url==='bad')throw Error('bad image');return appearance(url)});
  await view.select('first',element());const bad=element();await view.select('bad',bad);
  assert.equal(root.children.some(n=>n.classList.contains('visible')),false);assert.equal(bad.classList.contains('art-failed'),true);assert.equal(bad.children[0].removed,true);
  await view.select('next',element());await view.select('',element());assert.equal(root.children.some(n=>n.classList.contains('visible')),false);
});
test('leaving the selector invalidates pending artwork work',async()=>{
  const pending=deferred(),root=element(),stack=element(),view=new SelectorArtwork(root,()=>pending.promise);
  const work=view.select('pending',stack);view.dispose();pending.resolve(appearance('pending'));await work;
  assert.equal(stack.classList.contains('art-ready'),false);assert.equal(root.children.some(n=>n.classList.contains('visible')),false);
});
test('artwork decoding is reused, bounded, and retryable after a failure',async()=>{
  const calls=[],cache=new ArtworkCache(async url=>{calls.push(url);if(url==='bad')throw Error('decode failed');return appearance(url)},2);
  const first=cache.load('a');assert.equal(cache.load('a'),first);await first;await cache.load('b');await cache.load('a');await cache.load('c');await cache.load('b');
  assert.deepEqual(calls,['a','b','c','b']);
  await assert.rejects(cache.load('bad'));await assert.rejects(cache.load('bad'));assert.equal(calls.filter(c=>c==='bad').length,2);
});

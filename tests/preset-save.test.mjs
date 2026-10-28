import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,mkdtemp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {api} from '../worker/api.mjs';
import {localBucket} from '../scripts/dev-bucket.mjs';
await mkdir('.cache/preset-tests',{recursive:true});
await build({entryPoints:['src/preset-actions.ts','src/presets.ts','src/model.ts'],outdir:'.cache/preset-tests',bundle:true,format:'esm',platform:'node'});
const {saveCurrentPreset,sharePreset}=await import('../.cache/preset-tests/preset-actions.js');
const {readPresets}=await import('../.cache/preset-tests/presets.js');
const {sanitizeSettings}=await import('../.cache/preset-tests/model.js');
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)}};

test('global save captures the latest cursor and colors and another client applies an independent copy',async()=>{
  const before=globalThis.localStorage,a=storage(),b=storage();
  const token=createHash('sha256').update('test-password').digest('hex');
  const env={PASSWORD_HASH:token,BUCKET:localBucket(await mkdtemp('.cache/preset-browser-'))};
  const publish=async(p,author)=>{
    const response=await api(new Request('https://test.game/api/presets'+(p.publicId?'/'+p.publicId:''),{method:p.publicId?'PUT':'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json','x-preset-key':p.publisherKey,origin:'https://test.game'},body:JSON.stringify({...p,author})}),env);
    assert.ok(response.ok);return (await response.json()).preset;
  };
  try{
    globalThis.localStorage=a;
    saveCurrentPreset('Ren',sanitizeSettings({cursorShape:'square',colors:['#111111']}));
    const current=sanitizeSettings({cursorShape:'circle',cursorFill:true,colors:['#9d60cf','#2266ee'],parallax:37});
    await sharePreset(saveCurrentPreset('Ren',current),'Ren',publish);
    assert.equal(readPresets().length,1);
    assert.ok(readPresets()[0].publicId);
    globalThis.localStorage=b;
    assert.equal(readPresets().length,0);
    const response=await api(new Request('https://test.game/api/presets',{headers:{authorization:'Bearer '+token}}),env);
    const shared=(await response.json()).presets[0];
    assert.equal(shared.settings.cursorShape,'circle');
    assert.deepEqual(shared.settings.colors,current.colors);
    assert.equal(shared.publisherKey,undefined);
    const applied=sanitizeSettings(shared.settings);applied.parallax=0;
    saveCurrentPreset('My copy',applied);
    assert.equal(readPresets()[0].settings.parallax,0);
    globalThis.localStorage=a;
    assert.equal(readPresets()[0].settings.parallax,37);
    const updated=saveCurrentPreset('Ren',sanitizeSettings({...current,cursorShape:'diamond'}));
    await sharePreset(updated,'Ren',publish);
    assert.equal(readPresets().length,1);
    assert.equal(readPresets()[0].settings.cursorShape,'diamond');
  }finally{globalThis.localStorage=before}
});

test('failed global saves retain the publishing identity so retry does not create a duplicate',async()=>{
  const before=globalThis.localStorage;globalThis.localStorage=storage();
  try{
    let attempt;
    await assert.rejects(sharePreset(saveCurrentPreset('Retry',sanitizeSettings({})),'',async p=>{attempt={...p};throw Error('Offline')}),/Offline/);
    const persisted=readPresets()[0];assert.equal(persisted.id,attempt.id);assert.equal(persisted.publisherKey,attempt.publisherKey);
    await sharePreset(saveCurrentPreset('Retry',sanitizeSettings({cursorFill:true})),'',async p=>{assert.equal(p.id,attempt.id);assert.equal(p.publisherKey,attempt.publisherKey);assert.equal(p.settings.cursorFill,true);return {id:p.id,settings:p.settings}});
    assert.equal(readPresets().length,1);assert.equal(readPresets()[0].publicId,attempt.id);
  }finally{globalThis.localStorage=before}
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {build} from 'esbuild';
import {sanitizeSettings} from '../shared/settings.mjs';
await mkdir('.cache/preview-tests',{recursive:true});
await build({entryPoints:['src/preview-sequence.ts','src/volume-overlay.ts','src/match-hud.ts'],outdir:'.cache/preview-tests',bundle:true,platform:'node',format:'esm'});
const {FourNotePreview}=await import('../.cache/preview-tests/preview-sequence.js');
const {draggedVolume}=await import('../.cache/preview-tests/volume-overlay.js');
const {matchHudMarkup}=await import('../.cache/preview-tests/match-hud.js');
test('four-note preview keeps exactly four sorted real notes inside the current approach interval',()=>{
 const preview=new FourNotePreview();
 for(const settings of [sanitizeSettings({}),sanitizeSettings({approachRate:2,spawnDistance:80}),sanitizeSettings({approachRate:100,spawnDistance:.5})])for(const time of [0,33,1000,60000]){
  const frame=preview.update(time,settings),notes=frame.attempt.chart.notes;
  assert.equal(notes.length,4);assert.equal(new Set(notes.map(n=>n.index)).size,4);
  assert.ok(notes.every((n,i)=>n.time>=time-55-.001&&n.time<=time+settings.spawnDistance/settings.approachRate*1000+.001&&(!i||n.time>=notes[i-1].time)));
  assert.ok(Number.isFinite(frame.cursor.x)&&Number.isFinite(frame.cursor.y));assert.ok(Math.abs(frame.cursor.x)<=.85&&Math.abs(frame.cursor.y)<=.85);
 }
});
test('dragging anywhere on a volume circle changes volume relatively upward/downward without jumping',()=>{
 assert.equal(draggedVolume(50,400,400),50);assert.equal(draggedVolume(50,400,360),80);assert.equal(draggedVolume(50,400,440),20);assert.equal(draggedVolume(50,400,0),100);assert.equal(draggedVolume(50,0,400),0);
});
test('settings preview reuses the match HUD with isolated element IDs',()=>{
 const game=matchHudMarkup(),preview=matchHudMarkup('settings-');assert.equal(preview.replaceAll('id="settings-','id="'),game);assert.ok(preview.includes('id="settings-combo-ring"'));assert.ok(!preview.includes('id="combo-ring"'));
});

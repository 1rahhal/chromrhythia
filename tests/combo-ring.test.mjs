import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {build} from 'esbuild';
await mkdir('.cache/combo-tests',{recursive:true});
await build({entryPoints:['src/match-hud.ts','src/model.ts'],outdir:'.cache/combo-tests',bundle:true,platform:'node',format:'esm'});
const {comboRingPoints,comboRingSides,updateMatchHud}=await import('../.cache/combo-tests/match-hud.js');
const {sanitizeSettings}=await import('../.cache/combo-tests/model.js');

test('native ring uses chart increment for its polygon and retains a single chosen color at maximum multiplier',()=>{
  assert.equal(comboRingSides(2),3);assert.equal(comboRingSides(5),5);assert.equal(comboRingSides(100),32);
  assert.equal(comboRingPoints(5).split(' ').length,5);
  const nodes=new Map(),root={querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{textContent:'',className:'',attrs:{},setAttribute(k,v){this.attrs[k]=v}});return nodes.get(selector)}};
  const attempt={accuracy:100,misses:0,combo:11,multiplier:3,multiplierProgress:2,increment:5,chart:{length:60000}},settings=sanitizeSettings({comboRingColor:'#55ccff'});
  updateMatchHud(root,attempt,100,settings);
  assert.equal(nodes.get('#hud-multiplier').textContent,'3×');assert.equal(nodes.get('#combo-ring').attrs['stroke-dashoffset'],'60');
  assert.equal(nodes.get('#combo-ring').attrs.stroke,'#55ccff');assert.equal(nodes.get('#combo-ring-track').attrs.stroke,'#55ccff');
  attempt.multiplier=8;attempt.multiplierProgress=5;updateMatchHud(root,attempt,200,settings);
  assert.equal(nodes.get('#combo-ring').attrs.stroke,'#55ccff');assert.equal(nodes.get('#combo-ring').attrs['stroke-dashoffset'],'0');
  updateMatchHud(root,attempt,300,sanitizeSettings({comboRingColor:'#bb44ee'}));assert.equal(nodes.get('#combo-ring').attrs.stroke,'#bb44ee');
});

test('ring color survives profile serialization and rejects invalid values',()=>{
  const settings=sanitizeSettings({approachRate:29.5,spawnDistance:13,comboRingColor:'#44bbcc'});
  assert.equal(sanitizeSettings(JSON.parse(JSON.stringify(settings))).comboRingColor,'#44bbcc');
  assert.equal(settings.approachRate,29.5);assert.equal(settings.spawnDistance,13);
  assert.equal(sanitizeSettings({comboRingColor:'red;bad'}).comboRingColor,'#ffffff');
  assert.equal(sanitizeSettings({}).comboRingColor,'#ffffff');
});

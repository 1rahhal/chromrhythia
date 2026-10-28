import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
await mkdir('.cache/replay-tests',{recursive:true});
await build({entryPoints:['src/replay.ts','src/storage.ts','src/model.ts','src/match-hud.ts'],outdir:'.cache/replay-tests',bundle:true,format:'esm',platform:'node'});
const {Attempt,sanitizeSettings}=await import('../.cache/replay-tests/model.js');
const {replayEnd,replayJudgment,replayPoint,replaySettingsAt,validateWebReplay}=await import('../.cache/replay-tests/replay.js');
const {saveAttempt}=await import('../.cache/replay-tests/storage.js');
const {accuracyGrade,comboRingProgress}=await import('../.cache/replay-tests/match-hud.js');
const chart={id:'map',notes:Array.from({length:8},(_,i)=>({index:i,time:100+i*100,x:0,y:0})),length:1000};
const base=()=>({id:'run',version:2,mapId:chart.id,speed:1,mods:[],settings:sanitizeSettings({}),frames:[[-500,0,0,0,0],[550,1,1,.1,.2]],results:[0,10,-1,-2,-2,-2,-2,-2],startFrom:0,endTime:550,alive:false,cameraMode:'Spin'});

test('completed, failed, given-up and practice replays preserve recorded judgments and final statistics',()=>{
  for(const {results,end,start,alive}of [
    {results:[0,4,10,6,0,0,0,0],end:1000,start:0,alive:true},
    {results:[0,-1,-1,-1,-1,-1,-2,-2],end:656,start:0,alive:false},
    {results:[0,4,-1,-2,-2,-2,-2,-2],end:380,start:0,alive:false},
    {results:[-2,-2,-2,0,8,-1,-2,-2],end:670,start:400,alive:false}
  ]){
    const original=new Attempt(chart),played=new Attempt(chart),record={...base(),results,endTime:end,startFrom:start,alive};
    for(const n of chart.notes)if(n.time<start){original.judged[n.index]=3;played.judged[n.index]=3}
    for(const n of chart.notes){const r=results[n.index];if(r!==-2)original.judge(n.index,r>=0,r>=0?r:56)}
    for(let time=0;time<=end+10;time++){
      const t=Math.min(time,replayEnd(record,chart));
      for(const n of chart.notes){if(n.time>t||played.judged[n.index])continue;const j=replayJudgment(results[n.index],t-n.time);if(j.hit||j.miss)played.judge(n.index,j.hit,j.lateness)}
    }
    for(const key of ['hits','misses','score','combo','maxCombo','accuracy'])assert.equal(played[key],original[key],key);
    assert.equal(replayEnd(record,chart),end);
  }
  assert.equal(replayJudgment(-2,5000).miss,false);
});

test('replays retain camera movement and timed settings changes without changing their start snapshot',()=>{
  const r=base();r.frames=[[0,0,0,0,0],[100,1,-1,.2,-.4]];
  r.settingsChanges=[{time:50,settings:sanitizeSettings({fov:100,cursorShape:'circle'})}];
  assert.deepEqual(replayPoint(r,50),{index:0,x:.5,y:-.5,spinX:.1,spinY:-.2});
  assert.equal(replaySettingsAt(r,20).fov,70);assert.equal(replaySettingsAt(r,60).fov,100);assert.equal(r.settings.fov,70);
  assert.equal(validateWebReplay(r,chart).cameraMode,'Spin');
  assert.throws(()=>validateWebReplay({...r,results:[-.5]},chart),/match/);
});

test('legacy recordings remain readable and finish after their final recorded judgment, not unplayed notes',()=>{
  const old={...base(),version:1,frames:[[0,0,0],[350,1,1]],endTime:undefined,alive:undefined,results:[0,2,-1,-2,-2,-2,-2,-2]};
  assert.ok(replayEnd(old,chart)>355&&replayEnd(old,chart)<356);
  assert.equal(validateWebReplay(old,chart).version,1);
});

test('local score and replay writes commit together, and transaction aborts leave both absent',async()=>{
  for(const fails of [false,true]){
    const stored=new Map(),pending=new Map();let transaction;
    const db={transaction(stores,mode){assert.deepEqual(stores,['scores','replays']);assert.equal(mode,'readwrite');transaction={error:Error('quota'),objectStore:store=>({put(value){pending.set(store,value)}}),abort(){queueMicrotask(()=>transaction.onabort())}};queueMicrotask(()=>{if(fails)transaction.onabort();else{for(const [k,v]of pending)stored.set(k,v);transaction.oncomplete()}});return transaction}};
    const saving=saveAttempt({id:'run',replayId:'run'},base(),Promise.resolve(db));
    if(fails){await assert.rejects(saving);assert.equal(stored.size,0)}else{await saving;assert.equal(stored.get('scores').replayId,stored.get('replays').id)}
  }
});

test('match grades and native combo rings react to accuracy, multiplier progress and misses',()=>{
  assert.equal(accuracyGrade(100),'S');assert.equal(accuracyGrade(96),'A');assert.equal(accuracyGrade(85),'C');
  assert.equal(comboRingProgress(0,5),0);assert.equal(comboRingProgress(2,5),40);assert.equal(comboRingProgress(5,5),100);assert.equal(comboRingProgress(9,5),100);
});

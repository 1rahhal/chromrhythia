import {clamp,HIT_WINDOW,MODS,sanitizeSettings,type Chart,type Settings} from './model';
import type {WebReplay} from './storage';

export function replayEnd(record:WebReplay,chart:Chart){
  if(record.version===2&&Number.isFinite(record.endTime))return record.endTime!;
  // Older records have no terminal time. Keep their final sample and recorded judgments.
  let end=record.frames.at(-1)?.[0]??record.startFrom;
  for(let i=0;i<record.results.length;i++)if(record.results[i]!==-2)end=Math.max(end,chart.notes[i].time+(record.results[i]===-1?HIT_WINDOW+.01:record.results[i])*record.speed);
  return end;
}
export function replayJudgment(result:number,late:number){
  return {hit:result>=0&&late>=result,miss:result===-1&&late>HIT_WINDOW,lateness:result>=0?result:late};
}
export function replayPoint(record:WebReplay,t:number,index=0){
  while(index+1<record.frames.length&&record.frames[index+1][0]<=t)index++;
  const p=record.frames[index],n=record.frames[Math.min(index+1,record.frames.length-1)];
  const f=p&&n?clamp((t-p[0])/Math.max(1,n[0]-p[0]),0,1):0;
  const value=(i:number)=>p&&n?(p[i]||0)+((n[i]||0)-(p[i]||0))*f:0;
  return {index,x:value(1),y:value(2),spinX:value(3),spinY:value(4)};
}
export function replaySettingsAt(record:WebReplay,t:number):Settings{
  let s=record.settings;
  for(const change of record.settingsChanges||[]){if(change.time>t)break;s=change.settings}
  return s;
}
export function validateWebReplay(value:unknown,chart:Chart):WebReplay{
  const r=value as WebReplay;
  if(!r||![1,2].includes(r.version)||r.mapId!==chart.id||!Array.isArray(r.frames)||!Array.isArray(r.results)||!Array.isArray(r.mods)||r.frames.length>1_000_000||r.results.length>2_000_000||!Number.isFinite(r.speed)||r.speed<.25||r.speed>3||!Number.isFinite(r.startFrom)||r.startFrom<0)throw Error('Invalid web replay');
  let last=-Infinity;
  for(const f of r.frames){if(!Array.isArray(f)||![3,5].includes(f.length)||!f.every(Number.isFinite)||f[0]<last)throw Error('Invalid replay frames');last=f[0]}
  if(r.results.length!==chart.notes.length||!r.results.every(v=>v===-2||v===-1||(Number.isFinite(v)&&v>=0&&v<=HIT_WINDOW)))throw Error('Replay notes do not match this map');
  if(r.version===2&&(!Number.isFinite(r.endTime)||typeof r.alive!=='boolean'))throw Error('Invalid replay endpoint');
  r.mods=r.mods.filter(m=>MODS.includes(m));r.settings=sanitizeSettings(r.settings);r.cameraMode=r.cameraMode==='Spin'?'Spin':'Lock';
  if(r.settingsChanges!==undefined){
    if(!Array.isArray(r.settingsChanges)||r.settingsChanges.length>10000)throw Error('Invalid replay settings');
    last=-Infinity;
    r.settingsChanges=r.settingsChanges.map(c=>{if(!c||!Number.isFinite(c.time)||c.time<last)throw Error('Invalid replay settings');last=c.time;return {time:c.time,settings:sanitizeSettings(c.settings)}});
  }
  return r;
}

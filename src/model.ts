// Gameplay defaults and formulas derived from Rhythia/Client (AGPL-3.0).
// Source revision: 9200e16441c94f0cffca8ee10beb4e889235c56a.
import {DEFAULTS,sanitizeSettings,type Settings} from '../shared/settings.mjs';
export {DEFAULTS,sanitizeSettings};
export type {Settings};
export interface Note {time:number;x:number;y:number;index:number}
export interface Chart {id:string;title:string;artist:string;mappers:string[];difficulty:number;difficultyName?:string;notes:Note[];length:number;audio?:Uint8Array;cover?:Uint8Array;favorite?:boolean;demo?:boolean;remote?:boolean;downloaded?:boolean;size?:number;count?:number;fileName?:string;hasCover?:boolean}
export type Mod = 'NoFail'|'Autoplay'|'Ghost'|'Strobe'|'HFlip'|'VFlip'|'Earthquake'|'Chaos'|'Vortex';
export const MODS:Mod[]=['NoFail','Autoplay','Ghost','Strobe','HFlip','VFlip','Earthquake','Chaos','Vortex'];
export const MOD_MULTIPLIERS:Partial<Record<Mod,number>>={Ghost:1.03,Strobe:1.035,Earthquake:1.01,Chaos:1.015,Vortex:1.02};
export const HIT_WINDOW=55, HIT_BOX=0.57, CURSOR_BOUND=1.36875;
export const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
export const approachTime=(s:Settings)=>s.spawnDistance/s.approachRate;
export const notesPerMinute=(count:number,length:number,speed=1)=>length>0?Math.round(count*60000/length*speed):0;
export function noteVisual(time:number,noteTime:number,s:Settings,speed=1,ghost=false){
  const depth=(noteTime-time)/1000*s.approachRate/speed;
  const pushback=HIT_WINDOW*s.approachRate/1000;
  const progress=1-Math.max(0,(depth+pushback)/(s.spawnDistance+pushback));
  let opacity=s.fadeIn>0?Math.min(1,progress/(s.fadeIn/100)):1;
  if(s.fadeOut>0&&!ghost)opacity-=1-Math.min(1,(1-progress)/(s.fadeOut/100));
  if(ghost)opacity-=Math.min(1,(s.spawnDistance-depth)/(s.spawnDistance/2));
  return {depth,opacity:clamp(Math.pow(Math.max(0,opacity),1.25),0,1)};
}
export class Attempt {
  hits=0;misses=0;score=0;combo=0;maxCombo=0;multiplier=1;multiplierProgress=0;health=100;healthStep=15;alive=true;lastHitIndex=-1;
  results:Float32Array;judged:Uint8Array;increment:number;modMultiplier:number;
  constructor(public chart:Chart,public speed=1,public mods:Mod[]=[]){this.results=new Float32Array(chart.notes.length).fill(-2);this.judged=new Uint8Array(chart.notes.length);this.increment=Math.max(2,Math.floor(chart.notes.length/200));this.modMultiplier=mods.reduce((m,k)=>m*(MOD_MULTIPLIERS[k]??1),1)}
  get accuracy(){const sum=this.hits+this.misses;return sum?Math.floor(this.hits/sum*10000)/100:100}
  judge(index:number,hit:boolean,lateness:number){
    if(this.judged[index])return;
    this.judged[index]=hit?1:2;this.results[index]=hit?lateness:-1;
    if(hit){
      this.hits++;this.lastHitIndex=index;this.combo++;this.maxCombo=Math.max(this.maxCombo,this.combo);this.multiplierProgress++;
      const factor=1-Math.max(0,lateness-25)/150;
      this.score+=Math.floor(100*this.multiplier*this.modMultiplier*factor*((this.speed-1)/2.5+1));
      if(this.multiplierProgress===this.increment&&this.multiplier<8){this.multiplierProgress=this.multiplier===7?this.increment:0;this.multiplier++}
      this.healthStep=Math.max(this.healthStep/1.45,15);this.health=Math.min(100,this.health+this.healthStep/1.75);
    }else{this.misses++;this.combo=0;this.multiplierProgress=0;this.multiplier=Math.max(1,this.multiplier-1);this.health=Math.max(0,this.health-this.healthStep);this.healthStep=Math.min(this.healthStep*1.2,100)}
    if(this.health<=0)this.alive=false;
  }
}

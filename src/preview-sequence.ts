import {Attempt,HIT_WINDOW,approachTime,type Settings,type Chart} from './model';
// Four reusable notes go through the same depth/fade renderer as a real attempt.
export class FourNotePreview {
 readonly chart:Chart={id:'settings-preview',title:'Settings Preview',artist:'',mappers:[],difficulty:0,length:1,notes:[[-.85,.85],[.85,.85],[.85,-.85],[-.85,-.85]].map(([x,y],index)=>({x,y,index,time:0}))};
 readonly attempt=new Attempt(this.chart,1,['Autoplay']);
 readonly cursor={x:0,y:0};
 update(elapsed:number,s:Settings){
  const approach=approachTime(s)*1000,cycle=approach+HIT_WINDOW,interval=cycle/4;
  for(const note of this.chart.notes)note.time=elapsed+approach-((elapsed+note.index*interval)%cycle);
  this.chart.notes.sort((a,b)=>a.time-b.time);
  this.chart.length=60000;const next=this.chart.notes.find(n=>n.time>=elapsed)||this.chart.notes[0],previous=this.chart.notes.find(n=>n.index===(next.index+1)%4)!;
  const f=Math.max(0,Math.min(1,1-(next.time-elapsed)/interval)),smooth=f*f*(3-2*f);
  this.cursor.x=previous.x+(next.x-previous.x)*smooth;this.cursor.y=previous.y+(next.y-previous.y)*smooth;
  const hits=Math.floor(elapsed/interval);this.attempt.hits=hits;this.attempt.combo=hits;this.attempt.multiplier=1+Math.min(7,Math.floor(hits/8));this.attempt.increment=8;this.attempt.multiplierProgress=hits%8;this.attempt.lastHitIndex=hits%4;
  return {attempt:this.attempt,cursor:this.cursor,time:elapsed};
 }
}

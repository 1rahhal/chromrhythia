// Resolution changes affect pixels only. Judgment and the audio clock stay independent.
export const AUTO_PIXEL_BUDGET=1600*900;
export function renderRatio(width:number,height:number,dpr:number,scale:number,mode:string,factor=1){
  if(mode==='fixed')return Math.min(dpr,2)*scale;
  return Math.min(1,dpr,Math.sqrt(AUTO_PIXEL_BUDGET/Math.max(1,width*height)))*Math.min(1,scale)*factor;
}
export class AdaptiveResolution {
  factor=1;private samples:number[]=[];private slow=0;private fast=0;
  reset(){this.samples=[];this.slow=0;this.fast=0}
  sample(frameMs:number){
    if(frameMs<2||frameMs>250)return false;
    this.samples.push(frameMs);if(this.samples.length<90)return false;
    const sorted=this.samples.sort((a,b)=>a-b);this.samples=[];
    const target=Math.min(1000/60,Math.max(1000/240,sorted[9]));
    const median=sorted[45],p80=sorted[72];
    if(p80>target*1.25){this.slow++;this.fast=0}else if(p80<target*1.08){this.fast++;this.slow=0}else{this.fast=0;this.slow=0}
    const old=this.factor;
    if(this.slow>=2){this.factor=Math.max(.5,this.factor*(median>target*1.8?.75:.85));this.slow=0}
    if(this.fast>=6){this.factor=Math.min(1,this.factor+.05);this.fast=0}
    return old!==this.factor;
  }
}

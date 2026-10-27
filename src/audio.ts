import type {Chart,Settings} from './model';
export class Audio {
  ctx=new AudioContext({latencyHint:'interactive'});master=this.ctx.createGain();music=this.ctx.createGain();sfx=this.ctx.createGain();source?:AudioBufferSourceNode;buffer?:AudioBuffer;hit?:AudioBuffer;miss?:AudioBuffer;
  private loadedId='';
  constructor(){this.master.connect(this.ctx.destination);this.music.connect(this.master);this.sfx.connect(this.master)}
  setVolume(s:Settings){this.master.gain.value=s.volume/100;this.music.gain.value=s.musicVolume/100;this.sfx.gain.value=0.5}
  async init(){await this.ctx.resume();if(this.hit&&this.miss)return;await Promise.all(['hit','miss'].map(async name=>{try{const r=await fetch(`assets/${name}.mp3`);if(!r.ok)return;const b=await this.ctx.decodeAudioData(await r.arrayBuffer());if(name==='hit')this.hit=b;else this.miss=b}catch{}}))}
  async load(chart:Chart){
    this.stop();if(this.loadedId===chart.id&&this.buffer)return;this.loadedId=chart.id;this.buffer=undefined;
    if(chart.audio){this.buffer=await this.ctx.decodeAudioData(chart.audio.slice().buffer);return}
    if(!chart.demo)return;
    // Original generated practice audio; each tone is tied to the chart timeline.
    const sampleRate=22050,buffer=this.ctx.createBuffer(1,Math.ceil((chart.length/1000+2)*sampleRate),sampleRate),data=buffer.getChannelData(0);
    for(const n of chart.notes){const start=Math.floor(n.time/1000*sampleRate),freq=220*2**((n.x+1+(n.y+1)*3)/12);for(let j=0;j<sampleRate*0.13&&start+j<data.length;j++){const t=j/sampleRate;data[start+j]+=Math.sin(2*Math.PI*freq*t)*Math.exp(-t*32)*0.22+Math.sin(2*Math.PI*(65*t+2*(1-Math.exp(-t*40))))*Math.exp(-t*45)*0.25}}
    this.buffer=buffer;
  }
  play(progress:number,speed:number,offset:number){this.stop();if(!this.buffer)return;const elapsed=(progress-offset)/1000,delay=Math.max(0,-elapsed/speed);if(elapsed>=this.buffer.duration)return;const source=this.ctx.createBufferSource();source.buffer=this.buffer;source.playbackRate.value=speed;source.connect(this.music);source.start(this.ctx.currentTime+delay,Math.max(0,elapsed));this.source=source}
  stop(){try{this.source?.stop()}catch{}this.source?.disconnect();this.source=undefined}
  effect(hit:boolean){const buffer=hit?this.hit:this.miss;if(!buffer)return;const source=this.ctx.createBufferSource();source.buffer=buffer;source.connect(this.sfx);source.onended=()=>source.disconnect();source.start()}
}

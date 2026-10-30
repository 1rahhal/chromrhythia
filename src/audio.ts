import {DEFAULTS,type Chart,type Settings} from './model';
import {sharedAssetURL} from './shared';
export type SoundKind='hit'|'miss'|'fail'|'retry';
const SOUND_RATES:Record<string,number>={bass:.55,creamy:.8,hit:1,pick:1.8,rhythiahit:1.15,vulnus:1.4};
export class Audio {
  ctx=new AudioContext({latencyHint:'interactive'});master=this.ctx.createGain();music=this.ctx.createGain();sfx=this.ctx.createGain();source?:AudioBufferSourceNode;buffer?:AudioBuffer;hit?:AudioBuffer;miss?:AudioBuffer;
  private loadedId='';private loadRequest=0;
  private settings=DEFAULTS;private soundBuffers=new Map<string,Promise<AudioBuffer|undefined>>();
  private readySounds=new Map<string,AudioBuffer>();
  private voices=new Set<AudioBufferSourceNode>();
  private gains:Record<SoundKind,GainNode>={hit:this.ctx.createGain(),miss:this.ctx.createGain(),fail:this.ctx.createGain(),retry:this.ctx.createGain()};
  constructor(){this.master.connect(this.ctx.destination);this.music.connect(this.master);this.sfx.connect(this.master);for(const gain of Object.values(this.gains))gain.connect(this.sfx)}
  setVolume(s:Settings){this.settings=s;this.master.gain.value=s.volume/100;this.music.gain.value=s.musicVolume/100;this.sfx.gain.value=s.soundsVolume/100;for(const kind of ['hit','miss','fail','retry'] as const)this.gains[kind].gain.value=s[`${kind}Enabled`]?s[`${kind}Volume`]/100:0;if(this.ctx.state==='running')void this.prepare()}
  private sound(name:string){let pending=this.soundBuffers.get(name);if(!pending){pending=(async()=>{if(name==='none')return;const url=name.startsWith('asset:')?await sharedAssetURL(name.slice(6)):`assets/${name==='miss'?'miss':'hit'}.mp3`,response=await fetch(url);if(!response.ok)throw Error('Sound unavailable');const buffer=await this.ctx.decodeAudioData(await response.arrayBuffer());this.readySounds.set(name,buffer);return buffer})().catch(()=>{this.soundBuffers.delete(name);return undefined});this.soundBuffers.set(name,pending)}return pending}
  private async prepare(){await Promise.all(['hit','miss','fail','retry'].map(kind=>this.sound(this.settings[`${kind}Sound` as keyof Settings] as string)))}
  async init(){await this.ctx.resume();await this.prepare()}
  async load(chart:Chart){
    this.stop();const request=++this.loadRequest;if(this.loadedId===chart.id&&this.buffer)return;this.buffer=undefined;
    if(chart.audio){const decoded=await this.ctx.decodeAudioData(chart.audio.slice().buffer);if(request===this.loadRequest){this.buffer=decoded;this.loadedId=chart.id}return}
    if(!chart.demo)return;
    // Original generated practice audio; each tone is tied to the chart timeline.
    const sampleRate=22050,buffer=this.ctx.createBuffer(1,Math.ceil((chart.length/1000+2)*sampleRate),sampleRate),data=buffer.getChannelData(0);
    for(const n of chart.notes){const start=Math.floor(n.time/1000*sampleRate),freq=220*2**((n.x+1+(n.y+1)*3)/12);for(let j=0;j<sampleRate*0.13&&start+j<data.length;j++){const t=j/sampleRate;data[start+j]+=Math.sin(2*Math.PI*freq*t)*Math.exp(-t*32)*0.22+Math.sin(2*Math.PI*(65*t+2*(1-Math.exp(-t*40))))*Math.exp(-t*45)*0.25}}
    if(request===this.loadRequest){this.buffer=buffer;this.loadedId=chart.id}
  }
  play(progress:number,speed:number,offset:number){this.stop();if(!this.buffer)return;const elapsed=(progress-offset)/1000,delay=Math.max(0,-elapsed/speed);if(elapsed>=this.buffer.duration)return;const source=this.ctx.createBufferSource();source.buffer=this.buffer;source.playbackRate.value=speed;source.connect(this.music);source.start(this.ctx.currentTime+delay,Math.max(0,elapsed));this.source=source}
  stop(){try{this.source?.stop()}catch{}this.source?.disconnect();this.source=undefined}
  effect(hit:boolean){this.playSound(hit?'hit':'miss')}
  private playSound(kind:SoundKind,buffer?:AudioBuffer,preview=false){const s=this.settings,name=s[`${kind}Sound`];if(name==='none'||(!preview&&!s[`${kind}Enabled`]))return;buffer??=this.readySounds.get(name);if(!buffer)return;if(this.voices.size>=64){const oldest=this.voices.values().next().value!;try{oldest.stop()}catch{}oldest.disconnect();this.voices.delete(oldest)}const source=this.ctx.createBufferSource();source.buffer=buffer;source.playbackRate.value=SOUND_RATES[name]||1;source.connect(this.gains[kind]);this.voices.add(source);source.onended=()=>{this.voices.delete(source);source.disconnect()};source.start()}
  async event(kind:SoundKind,preview=false){const name=this.settings[`${kind}Sound`];if(name==='none')return;this.playSound(kind,preview?await this.sound(name):undefined,preview)}
}

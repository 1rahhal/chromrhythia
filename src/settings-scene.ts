import type {Renderer} from './renderer';
import type {Settings} from './model';
import {FourNotePreview,previewPlaybackRate} from './preview-sequence';
import {updateMatchHud} from './match-hud';
import {MediaLayers} from './media-layers';

// Reuse the live WebGL renderer, then copy its frame into the settings panel.
// No second WebGL context, independent note shader, fake cursor, or fake space.
export class SettingsScene {
 private canvas?:HTMLCanvasElement;private hud?:HTMLElement;private stage?:HTMLElement;private media?:MediaLayers;
 private ready=false;private elapsed=0;private last=0;private lastHit=0;private mediaKey='';private sequence=new FourNotePreview();
 constructor(private renderer:Renderer){void renderer.ready.then(()=>{this.ready=true})}
 attach(root:HTMLElement){this.stop();this.canvas=root.querySelector<HTMLCanvasElement>('#settings-game-canvas')!;this.hud=root.querySelector<HTMLElement>('.settings-preview-hud')!;this.stage=this.canvas.parentElement!;this.media=new MediaLayers(root.querySelector<HTMLElement>('.preview-media')!);this.last=0;this.elapsed=0;this.lastHit=0;this.mediaKey='';this.renderer.begin()}
 stop(){this.media?.play(false);this.last=0;this.renderer.begin()}
 draw(now:number,s:Settings){
  const canvas=this.canvas,stage=this.stage,hud=this.hud;if(!canvas||!stage||!hud||!this.ready||!stage.isConnected||!stage.getBoundingClientRect().width)return;
  const paused=canvas.dataset.paused==='1',delta=this.last?Math.max(0,Math.min(100,now-this.last)):0;this.last=now;if(!paused)this.elapsed+=delta*previewPlaybackRate(s);
  stage.style.aspectRatio=String(innerWidth/innerHeight);const rect=stage.getBoundingClientRect(),scale=rect.width/innerWidth;
  hud.style.width=innerWidth+'px';hud.style.height=innerHeight+'px';hud.style.transform=`scale(${scale})`;
  const width=Math.max(1,Math.round(Math.min(1100,rect.width*devicePixelRatio))),height=Math.max(1,Math.round(width*innerHeight/innerWidth));
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;canvas.dataset.force='1'}
  const key=JSON.stringify([s.background,s.mediaLayers]);if(this.mediaKey!==key){this.mediaKey=key;void this.media!.sync(s).then(()=>this.media?.play(canvas.isConnected&&canvas.dataset.paused!=='1'))}this.media!.play(!paused);
  if(paused&&canvas.dataset.force!=='1')return;canvas.dataset.force='';
  const frame=this.sequence.update(this.elapsed,s);if(!paused&&frame.attempt.hits>this.lastHit){const hit=frame.attempt.chart.notes.find(n=>n.time<this.elapsed);if(hit)this.renderer.effects.trigger(hit.x,hit.y,s.colors[hit.index%s.colors.length],s.hitEffect)}this.lastHit=frame.attempt.hits;this.renderer.render(frame.time,s,frame.attempt,frame.cursor,true);
  const ctx=canvas.getContext('2d');if(ctx){ctx.clearRect(0,0,width,height);ctx.drawImage(this.renderer.canvas,0,0,width,height)}
  updateMatchHud(hud,frame.attempt,this.elapsed%frame.attempt.chart.length,s,'settings-');
  hud.querySelector('#settings-hud-title')!.textContent='Watching Auto play Settings Preview';
  (hud.querySelector('#settings-hud-progress') as HTMLElement).style.transform=`scaleX(${this.elapsed%frame.attempt.chart.length/frame.attempt.chart.length})`;
 }
}

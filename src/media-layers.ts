import type {Settings} from './model';
import {sharedAssetURL} from './shared';
export class MediaLayers {
 private root:HTMLElement;private signature='';private generation=0;private current:Settings['mediaLayers']=[];
 constructor(){this.root=document.createElement('div');this.root.className='game-media';this.root.setAttribute('aria-hidden','true');document.body.prepend(this.root)}
 async sync(s:Settings){this.current=s.mediaLayers;for(let i=0;i<this.root.children.length;i++)(this.root.children[i] as HTMLElement).style.opacity=String(s.mediaLayers[i]?.opacity/100||0);const signature=JSON.stringify(s.mediaLayers.map(({id,type})=>({id,type})));this.root.hidden=s.background!=='media';if(this.root.hidden)this.play(false);if(signature===this.signature)return;this.signature=signature;const generation=++this.generation;
  const elements=await Promise.all(s.mediaLayers.map(async layer=>{try{const url=await sharedAssetURL(layer.id),el=document.createElement(layer.type==='video'?'video':'img');el.src=url;el.style.opacity=String(layer.opacity/100);if(el instanceof HTMLVideoElement){el.loop=true;el.muted=true;el.playsInline=true}return el}catch{return undefined}}));if(generation!==this.generation)return;
  this.root.querySelectorAll('video').forEach(video=>video.pause());if(elements.some(el=>!el))this.signature='';elements.forEach((el,i)=>{if(el)el.style.opacity=String(this.current[i]?.opacity/100||0)});this.root.replaceChildren(...elements.filter((el):el is HTMLImageElement|HTMLVideoElement=>!!el));this.play(document.body.classList.contains('playing'));
 }
 play(enabled:boolean){for(const video of this.root.querySelectorAll('video'))if(enabled)void video.play().catch(()=>{});else video.pause()}
}

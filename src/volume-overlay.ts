import type {Settings} from './model';
export const draggedVolume=(value:number,startY:number,y:number)=>Math.max(0,Math.min(100,Math.round(value+(startY-y)*.75)));
export function mountVolumeOverlay(get:()=>Settings,set:(s:Settings)=>void){
 const root=document.createElement('section');root.id='volume-overlay';root.className='volume-overlay';root.hidden=true;root.setAttribute('aria-label','Volume mixer');
 root.innerHTML=([['musicVolume','Music'],['soundsVolume','Sounds'],['volume','Master']] as const).map(([key,name])=>`<label class="volume-dial dial-${key}" data-channel="${key}"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="dial-track" cx="50" cy="50" r="44"/><circle class="dial-level" cx="50" cy="50" r="44" pathLength="100"/></svg><span>${name}</span><b></b><input type="range" min="0" max="100" step="1" aria-label="${name} quick volume" data-volume="${key}"></label>`).join('');document.body.append(root);
 let held=false,timer=0,channel:keyof Settings='volume',drag:{id:number;key:keyof Settings;y:number;value:number}|undefined;
 const sync=()=>{for(const input of root.querySelectorAll<HTMLInputElement>('[data-volume]')){const value=get()[input.dataset.volume as keyof Settings] as number;input.value=String(value);input.parentElement!.querySelector('b')!.textContent=value+'%';(input.parentElement!.querySelector('.dial-level') as SVGElement).style.strokeDashoffset=String(100-value)}};
 const show=()=>{clearTimeout(timer);held=true;root.hidden=false;sync();root.classList.add('visible')};
 const hide=(force=false)=>{held=false;if(!force&&(drag||root.matches(':hover')))return;root.classList.remove('visible');timer=window.setTimeout(()=>root.hidden=true,160)};
 root.onpointerleave=()=>{if(!held&&!drag)hide()};
 root.querySelectorAll<HTMLInputElement>('[data-volume]').forEach(input=>input.oninput=()=>{set({...get(),[input.dataset.volume!]:Number(input.value)});sync()});
 root.querySelectorAll<HTMLElement>('[data-channel]').forEach(dial=>{
  dial.onpointerenter=()=>channel=dial.dataset.channel as keyof Settings;
  dial.onpointerdown=event=>{if(event.button!==0)return;event.preventDefault();clearTimeout(timer);root.hidden=false;root.classList.add('visible');channel=dial.dataset.channel as keyof Settings;drag={id:event.pointerId,key:channel,y:event.clientY,value:Number(get()[channel])};dial.setPointerCapture(event.pointerId)};
  dial.onpointermove=event=>{if(!drag||drag.id!==event.pointerId)return;event.preventDefault();set({...get(),[drag.key]:draggedVolume(drag.value,drag.y,event.clientY)});sync()};
  dial.onpointerup=dial.onpointercancel=dial.onlostpointercapture=event=>{if(drag?.id===event.pointerId){drag=undefined;if(!held)hide()}};
 });
 window.addEventListener('keydown',event=>{if(event.key==='Alt'&&!event.repeat){event.preventDefault();show()}});
 window.addEventListener('keyup',event=>{if(event.key==='Alt'){event.preventDefault();hide()}});const cancel=()=>{drag=undefined;hide(true)};window.addEventListener('blur',cancel);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel()});
 window.addEventListener('wheel',event=>{if(!held)return;event.preventDefault();const value=Math.max(0,Math.min(100,Number(get()[channel])+(event.deltaY<0?2:-2)));set({...get(),[channel]:value});sync()},{passive:false});
 return {show,hide,sync};
}

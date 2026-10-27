import {clamp,CURSOR_BOUND,type Settings} from './model';
export const CAMERA_Z=3.75,CAMERA_PARALLAX=.25;
export function migrateTouchAim(settings:Settings,storage:Pick<Storage,'getItem'|'setItem'>){
  const key='chromrhythia-trackpad-default-v1';if(storage.getItem(key)==='1')return settings;
  const updated={...settings,touchMode:'relative'};storage.setItem('chromrhythia-settings',JSON.stringify(updated));storage.setItem(key,'1');return updated;
}
export function relativeAim(cursor:{x:number;y:number},delta:{dx:number;dy:number},sensitivity:number,fov:number){
  const gain=sensitivity*fov/70/120;
  return {x:clamp(cursor.x+delta.dx*gain,-CURSOR_BOUND,CURSOR_BOUND),y:clamp(cursor.y-delta.dy*gain,-CURSOR_BOUND,CURSOR_BOUND)};
}
export function gameViewport(width:number,height:number,fov:number){
  const aspect=width/Math.max(1,height),compact=width<900||aspect<1.2;
  const fit=2*Math.atan(1.85/(CAMERA_Z*Math.max(.1,aspect)))*180/Math.PI;
  return {compact,fov:compact?Math.min(140,Math.max(fov,fit)):fov};
}
export function screenAim(x:number,y:number,rect:{left:number;top:number;width:number;height:number},fov:number,parallax=CAMERA_PARALLAX){
  const h=Math.max(1,rect.height),w=Math.max(1,rect.width),vertical=CAMERA_Z*Math.tan(fov*Math.PI/360)/(1-parallax);
  return {x:clamp(((x-rect.left)/w*2-1)*vertical*w/h,-CURSOR_BOUND,CURSOR_BOUND),y:clamp((1-(y-rect.top)/h*2)*vertical,-CURSOR_BOUND,CURSOR_BOUND)};
}
export const prefersTouch=(lastType:string|undefined,coarse:boolean)=>lastType?lastType==='touch'||lastType==='pen':coarse;
export class TouchDrag {
  private id:number|undefined;private x=0;private y=0;
  begin(id:number,type:string,x:number,y:number){if(this.id!==undefined||!['touch','pen'].includes(type))return false;this.id=id;this.x=x;this.y=y;return true}
  move(id:number,x:number,y:number){if(id!==this.id)return;const point={x,y,dx:x-this.x,dy:y-this.y};this.x=x;this.y=y;return point}
  end(id:number){if(id!==this.id)return false;this.reset();return true}
  reset(){this.id=undefined}
}
export function bindTouchAim(canvas:HTMLCanvasElement,options:{enabled:()=>boolean;activate:()=>void;move:(point:{x:number;y:number;dx:number;dy:number})=>void;cancel:()=>void}){
  const drag=new TouchDrag();
  canvas.addEventListener('contextmenu',event=>event.preventDefault());
  canvas.addEventListener('pointerdown',event=>{if(!options.enabled()||!drag.begin(event.pointerId,event.pointerType,event.clientX,event.clientY))return;event.preventDefault();options.activate();try{canvas.setPointerCapture(event.pointerId)}catch{}options.move({x:event.clientX,y:event.clientY,dx:0,dy:0})},{passive:false});
  canvas.addEventListener('pointermove',event=>{if(!options.enabled())return;const point=drag.move(event.pointerId,event.clientX,event.clientY);if(!point)return;event.preventDefault();options.move(point)},{passive:false});
  canvas.addEventListener('pointerup',event=>{if(!drag.end(event.pointerId))return;event.preventDefault();try{if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId)}catch{}},{passive:false});
  for(const name of ['pointercancel','lostpointercapture'])canvas.addEventListener(name,event=>{if(drag.end((event as PointerEvent).pointerId))options.cancel()});
  return {reset:()=>drag.reset()};
}

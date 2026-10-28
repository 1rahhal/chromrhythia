export function paintRange(input:HTMLInputElement){const min=Number(input.min)||0,max=Number(input.max)||100;const value=Math.max(0,Math.min(100,(Number(input.value)-min)/Math.max(.001,max-min)*100));input.style.setProperty('--range-fill',value+'%')}
export function paintRanges(root:ParentNode=document){root.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach(paintRange)}
export class SliderGesture {
  private x=0;private y=0;state:'idle'|'pending'|'adjust'|'scroll'='idle';
  begin(x:number,y:number){this.x=x;this.y=y;this.state='pending'}
  move(x:number,y:number){if(this.state!=='pending')return this.state;const dx=Math.abs(x-this.x),dy=Math.abs(y-this.y);if(dy>6&&dy>dx)this.state='scroll';else if(dx>8&&dx>dy*1.25)this.state='adjust';return this.state}
  end(){this.state='idle'}
}
export function installRangeTheme(){
  const gesture=new SliderGesture();let active:HTMLInputElement|undefined,pointer=-1,original='',emitting=false;
  const finish=()=>{if(active&&gesture.state!=='adjust'){active.value=original;paintRange(active)}active=undefined;pointer=-1;gesture.end()};
  document.addEventListener('pointerdown',event=>{const input=event.target;if(!(input instanceof HTMLInputElement)||input.type!=='range'||!['touch','pen'].includes(event.pointerType))return;finish();active=input;pointer=event.pointerId;original=input.value;gesture.begin(event.clientX,event.clientY);event.preventDefault()},{capture:true,passive:false});
  document.addEventListener('pointermove',event=>{if(!active||event.pointerId!==pointer)return;if(gesture.move(event.clientX,event.clientY)!=='adjust')return;event.preventDefault();try{active.setPointerCapture(pointer)}catch{}const rect=active.getBoundingClientRect(),min=Number(active.min)||0,max=Number(active.max)||100,step=Number(active.step)||1;const value=min+Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width))*(max-min);active.value=String(min+Math.round((value-min)/step)*step);emitting=true;active.dispatchEvent(new Event('input',{bubbles:true}));emitting=false},{capture:true,passive:false});
  document.addEventListener('pointerup',event=>{if(event.pointerId===pointer)finish()},true);document.addEventListener('pointercancel',event=>{if(event.pointerId===pointer)finish()},true);
  document.addEventListener('input',event=>{const input=event.target;if(!(input instanceof HTMLInputElement)||input.type!=='range')return;if(input===active&&!emitting&&gesture.state!=='adjust'){input.value=original;event.stopImmediatePropagation()}paintRange(input)},true);
  // Number fields must not change when a wheel scroll happens over a focused field.
  document.addEventListener('wheel',event=>{const input=event.target;if(input instanceof HTMLInputElement&&input.type==='number'&&document.activeElement===input)input.blur()},{capture:true,passive:true});
}

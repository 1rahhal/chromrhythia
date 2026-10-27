import type {Settings} from './model';
export function drawCursorPreview(canvas:HTMLCanvasElement,s:Settings,time:number){
  const ctx=canvas.getContext('2d');if(!ctx)return;ctx.clearRect(0,0,canvas.width,canvas.height);
  const position=(t:number)=>({x:canvas.width/2+Math.sin(t/800)*canvas.width*.29,y:canvas.height/2+Math.sin(t/400)*canvas.height*.23});
  const draw=(t:number,alpha:number,scale:number)=>{const p=position(t),r=9*s.cursorSize*scale;ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=alpha*s.cursorOpacity/100;ctx.strokeStyle=ctx.fillStyle=s.cursorColor;ctx.lineWidth=Math.max(1.2,r*.16);ctx.beginPath();if(s.cursorShape==='circle')ctx.arc(0,0,r,0,Math.PI*2);else if(s.cursorShape==='diamond'){ctx.moveTo(0,-r);ctx.lineTo(r,0);ctx.lineTo(0,r);ctx.lineTo(-r,0);ctx.closePath()}else if(s.cursorShape==='square')ctx.rect(-r,-r,r*2,r*2);else ctx.roundRect(-r,-r,r*2,r*2,r*.35);if(s.cursorFill)ctx.fill();else ctx.stroke();ctx.restore()};
  if(s.cursorTrail)for(let i=20;i>0;i--){const life=1-i/21;draw(time-i/20*s.trailLength,life*life*s.trailOpacity/100,.3+.65*life)}draw(time,1,1);
}

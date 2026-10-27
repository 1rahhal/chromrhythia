// Scene coordinates and viewport layout copied from Rhythia/Client scenes/game.tscn.
import * as T from 'three';
import {Attempt,clamp} from './model';
import {HUDBatch} from './hud-batch';
class Plane {
  canvas=document.createElement('canvas');ctx:CanvasRenderingContext2D;texture:T.CanvasTexture;mesh:T.Mesh;last='';
  constructor(w:number,h:number,width:number,height:number,x:number,y:number,z:number,rx=0,ry=0){this.canvas.width=w;this.canvas.height=h;this.ctx=this.canvas.getContext('2d')!;this.texture=new T.CanvasTexture(this.canvas);this.texture.colorSpace=T.SRGBColorSpace;this.texture.minFilter=T.LinearFilter;this.texture.generateMipmaps=false;this.mesh=new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({map:this.texture,transparent:true,depthWrite:false,side:T.DoubleSide,forceSinglePass:true}));this.mesh.position.set(x,y,z);this.mesh.rotation.set(rx,ry,0);this.mesh.renderOrder=1;this.mesh.updateMatrix();this.mesh.matrixAutoUpdate=false}
  draw(key:string,fn:(ctx:CanvasRenderingContext2D)=>void){if(key===this.last)return;this.last=key;this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);fn(this.ctx);this.texture.needsUpdate=true}
}
const time=(ms:number)=>`${Math.floor(Math.max(0,ms)/60000)}:${String(Math.floor(Math.max(0,ms)/1000)%60).padStart(2,'0')}`;
function text(ctx:CanvasRenderingContext2D,value:string,x:number,y:number,size=50,font='RhythiaNunito',color='#fff',align:CanvasTextAlign='center'){ctx.font=`${size}px ${font}`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(value,x,y)}
export class NativeHUD {
  group=new T.Group();ready:Promise<unknown>;images:Record<string,HTMLImageElement>={};
  left=new Plane(250,625,4,10,-7.5,0,-9,0,-Math.PI/18);right=new Plane(250,625,4,10,7.5,0,-9,0,Math.PI/18);
  health=new Plane(544,40,10.88,0.8,0,-6.3,-10,Math.PI/12);progress=new Plane(544,40,10.88,0.8,0,6.3,-10,-Math.PI/12);
  title=new Plane(2048,128,20.48,1.28,0,8.25,-10,-Math.PI/12);timer=new Plane(1024,128,8.96,1.12,0,7,-10,-Math.PI/12);combo=new Plane(512,128,8.96,2.24,0,3.5,-10,-Math.PI/18);speed=new Plane(512,128,8.96,2.24,0,-7.5,-10,Math.PI/12);
  healthValue=100;multiplierProgress=0;previousTime=0;private batch?:HUDBatch;private lastGlyph='';
  constructor(){for(const p of [this.left,this.right,this.health,this.progress,this.title,this.timer,this.combo,this.speed])this.group.add(p.mesh);this.group.visible=false;
    this.ready=Promise.all([Promise.all(['panel_left','panel_right','health','health_background','progress','progress_background','hits','misses'].map(name=>new Promise<void>((resolve,reject)=>{const img=new Image();img.onload=()=>{this.images[name]=img;resolve()};img.onerror=()=>reject(Error('HUD image could not load'));img.src=`assets/${name}.png`}))),...['Nunito','Ubuntu'].map(async font=>{const face=new FontFace('Rhythia'+font,`url(assets/${font.toLowerCase()}.woff2)`);await face.load();document.fonts.add(face)})]).then(()=>{this.batch=new HUDBatch();this.group.add(this.batch.mesh);this.group.remove(this.timer.mesh,this.combo.mesh,this.speed.mesh);this.left.draw('panel',ctx=>ctx.drawImage(this.images.panel_left,0,0,250,625));this.right.draw('panel',ctx=>{ctx.drawImage(this.images.panel_right,0,0,250,625);ctx.drawImage(this.images.hits,102,378,20,19);ctx.drawImage(this.images.misses,128,378,20,19);ctx.fillStyle='#ffffff38';ctx.fillRect(16,406.25,218,2)})});
  }
  update(a:Attempt|undefined,t:number){
    this.group.visible=!!a;if(!a||!this.batch)return;
    const dt=clamp((t-this.previousTime)/1000/a.speed,0,0.1);this.previousTime=t;this.healthValue+=(a.health-this.healthValue)*Math.min(1,dt*60);this.multiplierProgress+=(a.multiplierProgress/a.increment-this.multiplierProgress)*Math.min(1,dt*16);
    this.health.draw(this.healthValue.toFixed(1),ctx=>{ctx.drawImage(this.images.health_background,0,0,544,40);ctx.save();ctx.beginPath();ctx.rect(0,0,(32+this.healthValue*10.24)/2,40);ctx.clip();ctx.drawImage(this.images.health,0,0,544,40);ctx.restore()});
    const length=a.chart.length+1000,progress=clamp(t/Math.max(1,length),0,1);this.progress.draw(progress.toFixed(3),ctx=>{ctx.drawImage(this.images.progress_background,0,0,544,40);ctx.save();ctx.beginPath();ctx.rect(0,0,(32+progress*1024)/2,40);ctx.clip();ctx.drawImage(this.images.progress,0,0,544,40);ctx.restore()});
    const title=(a.chart.artist?a.chart.artist+' - ':'')+a.chart.title;this.title.draw(title,ctx=>text(ctx,title,1024,64,64));
    const key=[a.score,a.hits,a.misses,a.combo,a.multiplier,this.multiplierProgress.toFixed(2),Math.floor(t/1000),a.increment,a.speed].join(':');if(key===this.lastGlyph)return;this.lastGlyph=key;
    const b=this.batch;b.begin();
    b.text(this.left,a.score.toLocaleString('en-US'),125,218.75);b.text(this.left,a.multiplier+'x',125,406.25);
    const sides=clamp(a.increment,3,32),points=Array.from({length:sides+1},(_,i)=>{const angle=i/sides*Math.PI*2-Math.PI/2;return [125+Math.cos(angle)*64,406.25+Math.sin(angle)*64]});
    for(let i=0;i<sides;i++)b.line(this.left,...points[i] as [number,number],...points[i+1] as [number,number],'#282828');
    const n=clamp(this.multiplierProgress,0,1)*sides,color=a.multiplier===8?'#ff8c00':'#ffffff';for(let i=0;i<sides&&i<n;i++){const f=Math.min(1,n-i),p=points[i],q=points[i+1];b.line(this.left,p[0],p[1],p[0]+(q[0]-p[0])*f,p[1]+(q[1]-p[1])*f,color)}
    b.text(this.right,a.accuracy.toFixed(2)+'%',125,218.75);b.text(this.right,String(a.hits),100,390.6,30,'normal','#ffffffa0','right');b.text(this.right,String(a.misses),150,390.6,30,'normal','#ffffffa0','left');b.text(this.right,(a.hits+a.misses).toLocaleString('en-US'),125,437.5);
    b.text(this.timer,`${time(t)} / ${time(length)}`,512,64,64,'normal','#ffffffbe');b.text(this.combo,String(a.combo),256,64,64,'outline','#ffffff64');if(a.speed!==1)b.text(this.speed,a.speed.toFixed(2)+'x',256,64,32,'normal','#ffffff64');b.end();
  }
}

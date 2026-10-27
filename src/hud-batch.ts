import * as T from 'three';
type Surface={canvas:HTMLCanvasElement;mesh:T.Mesh};
// Rasterize the fonts once. Scores, combo and timer then update small vertex buffers,
// rather than repainting and uploading entire canvas textures for every judgment.
export class HUDBatch {
  mesh:T.Mesh;private geometry=new T.BufferGeometry();private positions=new Float32Array(512*12);private uvs=new Float32Array(512*8);private colors=new Float32Array(512*16);private count=0;
  private glyphs=new Map<string,{u:number;v:number;advance:number}>();private color=new T.Color();private capacity=512;private atlasWidth=768;private atlasHeight=768;
  constructor(){
    const canvas=document.createElement('canvas');canvas.width=this.atlasWidth;canvas.height=this.atlasHeight;const ctx=canvas.getContext('2d')!;
    const chars='0123456789:,.%x/ -+';let slot=0;
    for(const style of ['normal','outline'])for(const char of chars){const x=slot%8*96,y=Math.floor(slot/8)*128;ctx.font=`64px Rhythia${style==='normal'?'Nunito':'Ubuntu'}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=ctx.strokeStyle='#fff';ctx.lineWidth=4;if(style==='outline')ctx.strokeText(char,x+48,y+64);else ctx.fillText(char,x+48,y+64);this.glyphs.set(style+char,{u:x/canvas.width,v:1-y/canvas.height,advance:ctx.measureText(char).width});slot++}
    ctx.fillStyle='#fff';ctx.fillRect(760,760,8,8);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.minFilter=T.LinearFilter;texture.generateMipmaps=false;
    this.geometry.setAttribute('position',new T.BufferAttribute(this.positions,3).setUsage(T.DynamicDrawUsage));this.geometry.setAttribute('uv',new T.BufferAttribute(this.uvs,2).setUsage(T.DynamicDrawUsage));this.geometry.setAttribute('color',new T.BufferAttribute(this.colors,4).setUsage(T.DynamicDrawUsage));
    const indices=new Uint16Array(this.capacity*6);for(let i=0;i<this.capacity;i++)indices.set([i*4,i*4+1,i*4+2,i*4,i*4+2,i*4+3],i*6);this.geometry.setIndex(new T.BufferAttribute(indices,1));this.geometry.setDrawRange(0,0);
    this.mesh=new T.Mesh(this.geometry,new T.MeshBasicMaterial({map:texture,vertexColors:true,transparent:true,depthWrite:false,side:T.DoubleSide,forceSinglePass:true}));this.mesh.frustumCulled=false;this.mesh.renderOrder=2;
  }
  begin(){this.count=0}
  text(surface:Surface,value:string,x:number,y:number,size=50,style='normal',color='#ffffff',align='center'){
    const glyphs=[...value].map(c=>this.glyphs.get(style+c)||this.glyphs.get(style+' ')!);const scale=size/64,width=glyphs.reduce((sum,g)=>sum+g.advance*scale,0);let left=x-(align==='center'?width/2:align==='right'?width:0);
    for(const g of glyphs){const cx=left+g.advance*scale/2,w=96*scale/2,h=128*scale/2;this.quad(surface,[[cx-w,y+h],[cx+w,y+h],[cx+w,y-h],[cx-w,y-h]],[g.u,g.v-128/this.atlasHeight,g.u+96/this.atlasWidth,g.v],color);left+=g.advance*scale}
  }
  line(surface:Surface,x1:number,y1:number,x2:number,y2:number,color:string,width=3){const length=Math.hypot(x2-x1,y2-y1)||1,dx=-(y2-y1)/length*width/2,dy=(x2-x1)/length*width/2;this.quad(surface,[[x1+dx,y1+dy],[x2+dx,y2+dy],[x2-dx,y2-dy],[x1-dx,y1-dy]],[764/768,4/768,764/768,4/768],color)}
  private quad(surface:Surface,points:number[][],uv:number[],color:string){
    if(this.count>=this.capacity)return;const i=this.count++,p=i*12,t=i*8,c=i*16;const geometry=surface.mesh.geometry as T.PlaneGeometry,parameters=geometry.parameters;const e=surface.mesh.matrix.elements;
    const alpha=color.length===9?parseInt(color.slice(7),16)/255:1;this.color.set(color.slice(0,7));
    for(let v=0;v<4;v++){const x=(points[v][0]/surface.canvas.width-.5)*parameters.width,y=(.5-points[v][1]/surface.canvas.height)*parameters.height;this.positions[p+v*3]=e[0]*x+e[4]*y+e[12];this.positions[p+v*3+1]=e[1]*x+e[5]*y+e[13];this.positions[p+v*3+2]=e[2]*x+e[6]*y+e[14]+.002;this.colors.set([this.color.r,this.color.g,this.color.b,alpha],c+v*4)}
    this.uvs.set([uv[0],uv[1],uv[2],uv[1],uv[2],uv[3],uv[0],uv[3]],t);
  }
  end(){this.geometry.setDrawRange(0,this.count*6);for(const [name,size] of [['position',12],['uv',8],['color',16]] as const){const a=this.geometry.getAttribute(name) as T.BufferAttribute;a.clearUpdateRanges();a.addUpdateRange(0,this.count*size);a.needsUpdate=true}}
}

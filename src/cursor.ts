import * as T from 'three';
import type {Settings} from './model';
export class TrailHistory {
  points:{x:number;y:number;at:number}[]=[];
  reset(){this.points.length=0}
  sample(x:number,y:number,at:number,length:number){
    while(this.points.length&&at-this.points[0].at>length)this.points.shift();
    const last=this.points.at(-1);
    if(!last||Math.hypot(x-last.x,y-last.y)>.008){if(this.points.length===64)this.points.shift();this.points.push({x,y,at})}
    return this.points;
  }
}
export class GameCursor {
  group=new T.Group();head:T.Mesh;trail:T.InstancedMesh;history=new TrailHistory();
  private material:T.ShaderMaterial;private alpha=new T.InstancedBufferAttribute(new Float32Array(64),1);private dummy=new T.Object3D();
  constructor(){
    this.material=new T.ShaderMaterial({depthTest:false,depthWrite:false,transparent:true,uniforms:{color:{value:new T.Color('#ffffff')},shape:{value:0},filled:{value:false},opacity:{value:1},cursorTexture:{value:new T.TextureLoader().load('assets/cursor.png')}},vertexShader:`varying vec2 vUv;varying float vAlpha;
      #ifdef USE_INSTANCING
      attribute float cursorAlpha;
      #endif
      void main(){vUv=uv;vec4 p=vec4(position,1.0);vAlpha=1.0;
      #ifdef USE_INSTANCING
      p=instanceMatrix*p;vAlpha=cursorAlpha;
      #endif
      gl_Position=projectionMatrix*modelViewMatrix*p;}`,fragmentShader:`uniform vec3 color;uniform int shape;uniform bool filled;uniform float opacity;uniform sampler2D cursorTexture;varying vec2 vUv;varying float vAlpha;
      void main(){vec2 p=(vUv-.5)*2.0;float d;
      if(shape==2)d=length(p)-.84;else if(shape==3)d=(abs(p.x)+abs(p.y))*.70710678-.64;else if(shape==1)d=max(abs(p.x),abs(p.y))-.84;else{vec2 q=abs(p)-vec2(.65);d=length(max(q,0.0))+min(max(q.x,q.y),0.0)-.19;}
      float aa=max(fwidth(d),.005);float a=filled?1.0-smoothstep(-aa,aa,d):1.0-smoothstep(.07-aa,.07+aa,abs(d));
      if(shape==0&&!filled)a=texture2D(cursorTexture,vUv).a;
      gl_FragColor=vec4(color,a*opacity*vAlpha);
      #include <colorspace_fragment>
      }`});
    const geometry=new T.PlaneGeometry(.2625,.2625);this.head=new T.Mesh(geometry,this.material);this.head.renderOrder=3;this.group.add(this.head);
    const trailGeometry=geometry.clone();trailGeometry.setAttribute('cursorAlpha',this.alpha);this.trail=new T.InstancedMesh(trailGeometry,this.material,64);this.trail.instanceMatrix.setUsage(T.DynamicDrawUsage);this.alpha.setUsage(T.DynamicDrawUsage);this.trail.count=0;this.trail.renderOrder=2;this.trail.frustumCulled=false;this.group.add(this.trail);
  }
  reset(){this.history.reset();this.trail.count=0}
  update(x:number,y:number,s:Settings,visible:boolean,now:number){
    this.group.visible=visible;if(!visible){this.reset();return}
    const u=this.material.uniforms;u.color.value.set(s.cursorColor);u.shape.value=Math.max(0,['native','square','circle','diamond'].indexOf(s.cursorShape));u.filled.value=s.cursorFill;u.opacity.value=s.cursorOpacity/100;
    this.head.position.set(x,y,.003);this.head.scale.setScalar(s.cursorSize);
    if(!s.cursorTrail){this.reset();return}
    const points=this.history.sample(x,y,now,s.trailLength);let count=0;
    for(const p of points){const life=Math.max(0,1-(now-p.at)/s.trailLength);if(life<=0)continue;this.dummy.position.set(p.x,p.y,.002);this.dummy.scale.setScalar(s.cursorSize*(.3+.65*life));this.dummy.updateMatrix();this.trail.setMatrixAt(count,this.dummy.matrix);this.alpha.setX(count,life*life*s.trailOpacity/100);count++}
    this.trail.count=count;if(count){this.trail.instanceMatrix.needsUpdate=true;this.alpha.needsUpdate=true}
  }
}

import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {NativeHUD} from './native-hud';
import {Attempt,approachTime,clamp,noteVisual,type Settings} from './model';
export class Renderer {
  gl:T.WebGLRenderer;scene=new T.Scene();camera=new T.PerspectiveCamera(70,1,0.05,160);mesh:T.InstancedMesh;opacity:T.InstancedBufferAttribute;
  dummy=new T.Object3D();color=new T.Color();cursor:T.Mesh;grid:T.LineSegments;tunnel=new T.Group();capacity=8192;w=1;h=1;fps=0;
  ready:Promise<unknown>;hud=new NativeHUD();private lastFPS=performance.now();private frames=0;private environment=new T.Group();private spaceMaterial:T.ShaderMaterial;private hitColor=new T.Color('#ffd8e6');private lastTime=0;
  constructor(public canvas:HTMLCanvasElement){
    this.gl=new T.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance'});this.gl.setClearColor(0x080810);this.gl.outputColorSpace=T.SRGBColorSpace;
    this.camera.position.z=3.75;
    const geometry=new RoundedBoxGeometry(0.875,0.875,0.15,2,0.07);
    this.opacity=new T.InstancedBufferAttribute(new Float32Array(this.capacity),1);geometry.setAttribute('instanceOpacity',this.opacity);
    const mat=new T.MeshBasicMaterial({color:0xffffff,transparent:true,depthWrite:false});
    mat.onBeforeCompile=s=>{s.vertexShader='attribute float instanceOpacity; varying float vOpacity;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvOpacity=instanceOpacity;');s.fragmentShader='varying float vOpacity;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a *= vOpacity;')};
    this.mesh=new T.InstancedMesh(geometry,mat,this.capacity);this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.mesh.frustumCulled=false;this.scene.add(this.mesh);
    const points:number[]=[];for(let i=0;i<4;i++){const k=i-1.5;points.push(k,-1.5,0,k,1.5,0,-1.5,k,0,1.5,k,0)}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));this.grid=new T.LineSegments(g,new T.LineBasicMaterial({color:0xeeeeff,transparent:true,opacity:0.2}));this.scene.add(this.grid);
    const shape=new T.Shape();shape.moveTo(-0.11,-0.11);shape.lineTo(0.11,-0.11);shape.lineTo(0.11,0.11);shape.lineTo(-0.11,0.11);shape.closePath();
    this.cursor=new T.Mesh(new T.PlaneGeometry(0.2625,0.2625),new T.MeshBasicMaterial({color:0xffffff,depthTest:false,transparent:true,map:new T.TextureLoader().load('assets/cursor.png')}));this.cursor.position.z=0.001;this.cursor.renderOrder=2;this.scene.add(this.cursor);
    const ringPoints=[new T.Vector3(-3,-3,0),new T.Vector3(3,-3,0),new T.Vector3(3,3,0),new T.Vector3(-3,3,0),new T.Vector3(-3,-3,0)];
    for(let i=0;i<30;i++){const ring=new T.Line(new T.BufferGeometry().setFromPoints(ringPoints),new T.LineBasicMaterial({color:i%2?0x9d6eff:0xff0059,transparent:true,opacity:0.11}));ring.position.z=-i*3;this.tunnel.add(ring)}this.scene.add(this.tunnel);
    this.tunnel.visible=false;
    const texture=new T.TextureLoader().load('assets/grid_tile.png');texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;
    // Dimensions, repeat count, scroll speed and fog from prefabs/spaces/grid.tscn and Grid.cs.
    this.spaceMaterial=new T.ShaderMaterial({uniforms:{tile:{value:texture},offset:{value:0},tint:{value:this.hitColor},fogColor:{value:new T.Color(0.0470588,0.0313726,0.109804)}},side:T.DoubleSide,vertexShader:'varying vec2 vUv; varying float vDepth; void main(){vUv=uv;vec4 p=modelViewMatrix*vec4(position,1.0);vDepth=-p.z;gl_Position=projectionMatrix*p;}',fragmentShader:'uniform sampler2D tile;uniform float offset;uniform vec3 tint;uniform vec3 fogColor;varying vec2 vUv;varying float vDepth;void main(){vec4 c=texture2D(tile,vUv*34.0+vec2(0.0,offset));float fog=pow(clamp(vDepth/60.0,0.0,1.0),0.15);gl_FragColor=vec4(mix(c.rgb*tint,fogColor,fog),1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
    for(const y of [-10,10]){const plane=new T.Mesh(new T.PlaneGeometry(120,120),this.spaceMaterial);plane.rotation.x=Math.PI/2;plane.position.y=y;this.environment.add(plane)}this.scene.add(this.environment);
    const field=new T.Mesh(new T.PlaneGeometry(4,4),new T.MeshBasicMaterial({transparent:true,depthWrite:false,map:new T.TextureLoader().load('assets/playfield.png')}));this.scene.add(field);this.grid.visible=false;
    this.grid=field as unknown as T.LineSegments;this.scene.add(this.hud.group);
    this.ready=Promise.all([this.hud.ready,fetch('assets/squircle.obj').then(r=>r.text()).then(source=>{const model=new OBJLoader().parse(source);let geometry:T.BufferGeometry|undefined;model.traverse(child=>{if(!geometry&&child instanceof T.Mesh)geometry=child.geometry});if(geometry){geometry.scale(0.875/2,0.875/2,0.875/2);geometry.setAttribute('instanceOpacity',this.opacity);this.mesh.geometry.dispose();this.mesh.geometry=geometry}})]);
    window.addEventListener('resize',()=>this.resize());
    this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();window.dispatchEvent(new CustomEvent('renderer-lost'))});this.canvas.addEventListener('webglcontextrestored',()=>location.reload());
  }
  resize(scale=1){this.w=innerWidth;this.h=innerHeight;this.gl.setPixelRatio(Math.min(devicePixelRatio,2)*scale);this.gl.setSize(this.w,this.h,false);this.camera.aspect=this.w/this.h;this.camera.updateProjectionMatrix()}
  render(time:number,s:Settings,attempt?:Attempt,cursor={x:0,y:0},preview=false,spin={x:0,y:0}){
    this.camera.fov=s.fov;this.camera.position.set(cursor.x*0.25,cursor.y*0.25,3.75);this.camera.rotation.set(spin.x,spin.y,0,'YXZ');this.camera.updateProjectionMatrix();
    this.grid.visible=false;this.cursor.visible=!!attempt;this.cursor.position.set(cursor.x,cursor.y,0.001);
    const dt=Math.min(0.1,Math.max(0,(time-this.lastTime)/1000));this.lastTime=time;if(attempt&&attempt.lastHitIndex>=0)this.hitColor.lerp(this.color.set(s.colors[attempt.lastHitIndex%s.colors.length]),Math.min(1,dt*8));this.spaceMaterial.uniforms.offset.value=time/1000*3;
    for(let i=0;i<this.tunnel.children.length;i++){const ring=this.tunnel.children[i];ring.position.z=-((i*3+time/1000*1.5)%90);ring.rotation.z=Math.sin(time/7000+i*0.08)*0.12}
    let count=0;const notes=attempt?.chart.notes;const speed=attempt?.speed??1;const at=approachTime(s)*1000*speed;
    if(attempt&&notes){
      // Only walk the visible time interval, not the entire chart.
      let lo=0,hi=notes.length;while(lo<hi){const m=(lo+hi)>>>1;if(notes[m].time<time-55*speed)lo=m+1;else hi=m}
      for(let i=lo;i<notes.length&&count<this.capacity;i++){
        const n=notes[i];if(n.time>time+at)break;if(attempt.judged[i]===1)continue;
        const visual=noteVisual(time,n.time,s,speed,attempt.mods.includes('Ghost'));let {depth,opacity}=visual;let x=n.x*(attempt.mods.includes('HFlip')?-1:1),y=n.y*(attempt.mods.includes('VFlip')?-1:1),rotation=0;
        const d=Math.max(0,depth)/s.spawnDistance;
        if(attempt.mods.includes('Strobe')&&time/1000/speed%approachTime(s)>=approachTime(s)/2)opacity=0;
        if(attempt.mods.includes('Earthquake')){const angle=Math.sin(i*127.1+Math.floor(time/16)*311.7)*Math.PI*2;x+=Math.sin(angle)*d**1.5/2;y+=Math.cos(angle)*d**1.5/2}
        if(attempt.mods.includes('Chaos')){const angle=Math.sin(x*2+y*3+i+time/speed/400)*Math.PI*4;x+=Math.sin(angle)*d*d;y+=Math.cos(angle)*d*d}
        if(attempt.mods.includes('Vortex')){const sine=Math.sin(time/speed/1000*approachTime(s));rotation=(d*15)**1.5/60*Math.sign(sine)*Math.abs(sine)**0.75;const a=x*Math.cos(rotation)-y*Math.sin(rotation),b=x*Math.sin(rotation)+y*Math.cos(rotation),pull=(d*0.85)**3*Math.hypot(a,b);x=a*(1-pull);y=b*(1-pull)}
        this.instance(count++,x,y,-depth,opacity,s.colors[i%s.colors.length],rotation);
      }
    }else{
      const cycle=approachTime(s)*1000;for(let i=0;i<15;i++){const pos=((time+i*247)%Math.max(1000,cycle*4))/Math.max(1000,cycle*4);const depth=s.spawnDistance*(1-pos);const visual=noteVisual(0,depth/s.approachRate*1000,s);this.instance(count++,Math.sin(i*2.3),Math.cos(i*2.3),-depth,preview?visual.opacity:0.18,s.colors[i%s.colors.length],0)}
    }
    this.mesh.count=count;this.mesh.instanceMatrix.needsUpdate=true;this.opacity.needsUpdate=true;if(this.mesh.instanceColor)this.mesh.instanceColor.needsUpdate=true;
    this.hud.update(attempt,time);this.gl.render(this.scene,this.camera);this.frames++;const now=performance.now();if(now-this.lastFPS>=500){this.fps=Math.round(this.frames*1000/(now-this.lastFPS));this.frames=0;this.lastFPS=now}
  }
  private instance(index:number,x:number,y:number,z:number,opacity:number,color:string,rotation:number){this.dummy.position.set(x,y,z);this.dummy.rotation.z=rotation;this.dummy.updateMatrix();this.mesh.setMatrixAt(index,this.dummy.matrix);this.mesh.setColorAt(index,this.color.set(color));this.opacity.setX(index,clamp(opacity,0,1))}
}

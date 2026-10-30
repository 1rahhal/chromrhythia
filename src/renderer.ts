import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {GameCursor} from './cursor';
import {noteSkinGeometry,HitEffects} from './note-skins';
import {compactNoteGeometry,createTunnel,writeNoteMatrix,NotePalette} from './render-kernel';
import {gameViewport,CAMERA_Z} from './touch-input';
import {AdaptiveResolution,renderRatio} from './performance';
import {Attempt,approachTime,clamp,noteVisual,type Settings} from './model';
export class Renderer {
  gl:T.WebGLRenderer;scene=new T.Scene();camera=new T.PerspectiveCamera(70,1,0.05,160);mesh:T.InstancedMesh;opacity:T.InstancedBufferAttribute;
  cursor=new GameCursor();grid:T.LineSegments;tunnel=new T.Group();capacity=8192;w=1;h=1;fps=0;compact=false;
  effects=new HitEffects();private noteGeometries=new Map<string,T.BufferGeometry>();private noteShape='native';private noteScale=1;private noteOpacity=1;
  ready:Promise<unknown>;private lastFPS=performance.now();private frames=0;private environment=new T.Group();private spaceMaterial:T.ShaderMaterial;private hitColor=new T.Color('#ffd8e6');private lastTime=0;private backgroundName='';private aurora=new T.Group();private auroraMaterial:T.ShaderMaterial;private renderScale=1;private warmup?:Promise<void>;private qualityMode='auto';private adaptive=new AdaptiveResolution();private lastFrameAt=0;private palette=new NotePalette();private visual={depth:0,opacity:0};
  constructor(public canvas:HTMLCanvasElement){
    this.gl=new T.WebGLRenderer({canvas,antialias:false,alpha:true,powerPreference:'high-performance'});this.gl.setClearColor(0x080810);this.gl.outputColorSpace=T.SRGBColorSpace;
    this.camera.position.z=CAMERA_Z;
    const geometry=new RoundedBoxGeometry(0.875,0.875,0.15,2,0.07);
    this.opacity=new T.InstancedBufferAttribute(new Float32Array(this.capacity),1);geometry.setAttribute('instanceOpacity',this.opacity);
    const mat=new T.MeshBasicMaterial({color:0xffffff,transparent:true,depthWrite:false});
    mat.onBeforeCompile=s=>{s.vertexShader='attribute float instanceOpacity; varying float vOpacity;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvOpacity=instanceOpacity;');s.fragmentShader='varying float vOpacity;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a *= vOpacity;')};
    this.mesh=new T.InstancedMesh(geometry,mat,this.capacity);this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.mesh.frustumCulled=false;this.mesh.matrixAutoUpdate=false;this.scene.add(this.mesh);
    this.scene.add(this.cursor.group);this.scene.add(this.effects.group);
    const loader=new T.TextureLoader();
    this.tunnel=createTunnel(path=>loader.load(path));this.scene.add(this.tunnel);this.tunnel.visible=false;
    this.auroraMaterial=new T.ShaderMaterial({depthWrite:false,uniforms:{time:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec2 vUv;uniform float time;void main(){vec2 p=vUv;float a=exp(-abs(p.y-0.5-sin(p.x*5.0+time*0.1)*0.12)*12.0);float b=exp(-abs(p.y-0.4-cos(p.x*4.0-time*0.08)*0.15)*15.0);vec3 c=vec3(0.002,0.002,0.008)+a*vec3(0.075,0.013,0.15)+b*vec3(0.01,0.045,0.12);gl_FragColor=vec4(c,1.0);\n#include <colorspace_fragment>\n}'});const auroraPlane=new T.Mesh(new T.PlaneGeometry(400,240),this.auroraMaterial);auroraPlane.position.z=-110;this.aurora.add(auroraPlane);this.scene.add(this.aurora);
    const texture=new T.TextureLoader().load('assets/grid_tile.png');texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.colorSpace=T.SRGBColorSpace;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;
    // Dimensions, repeat count, scroll speed and fog from prefabs/spaces/grid.tscn and Grid.cs.
    this.spaceMaterial=new T.ShaderMaterial({uniforms:{tile:{value:texture},offset:{value:0},tint:{value:this.hitColor},fogColor:{value:new T.Color('#0c081c')}},side:T.DoubleSide,vertexShader:'varying vec2 vUv; varying float vDepth; void main(){vUv=uv;vec4 p=modelViewMatrix*vec4(position,1.0);vDepth=-p.z;gl_Position=projectionMatrix*p;}',fragmentShader:'uniform sampler2D tile;uniform float offset;uniform vec3 tint;uniform vec3 fogColor;varying vec2 vUv;varying float vDepth;void main(){vec4 c=texture2D(tile,vUv*340.0+vec2(0.0,offset));float fog=pow(clamp(vDepth/60.0,0.0,1.0),0.15);gl_FragColor=vec4(mix(c.rgb*tint,fogColor,fog),1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
    for(const y of [-10,10]){const plane=new T.Mesh(new T.PlaneGeometry(1200,1200),this.spaceMaterial);plane.rotation.x=Math.PI/2;plane.position.y=y;this.environment.add(plane)}this.scene.add(this.environment);
    this.grid=new T.LineSegments(new T.BufferGeometry(),new T.LineBasicMaterial());
    this.ready=Promise.all([fetch('assets/squircle.obj').then(r=>r.text()).then(source=>{const model=new OBJLoader().parse(source);let geometry:T.BufferGeometry|undefined;model.traverse(child=>{if(!geometry&&child instanceof T.Mesh)geometry=child.geometry});if(geometry){const original=geometry;geometry=compactNoteGeometry(original);original.dispose();geometry.scale(0.875/2,0.875/2,0.875/2);geometry.setAttribute('instanceOpacity',this.opacity);this.mesh.geometry.dispose();this.mesh.geometry=geometry}})]);
    this.mesh.setColorAt(0,new T.Color('#ffffff'));this.mesh.instanceColor!.setUsage(T.DynamicDrawUsage);this.opacity.setUsage(T.DynamicDrawUsage);
    window.addEventListener('resize',()=>this.resize(this.renderScale));
    this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();window.dispatchEvent(new CustomEvent('renderer-lost'))});this.canvas.addEventListener('webglcontextrestored',()=>location.reload());
  }
  resetFrameClock(){this.frames=0;this.fps=0;this.lastFPS=performance.now();this.lastFrameAt=0}
  begin(){this.effects.reset();this.cursor.reset();this.resetFrameClock();this.adaptive.reset()}
  resize(scale=1,mode=this.qualityMode){this.renderScale=scale;this.qualityMode=mode;const ratio=renderRatio(innerWidth,innerHeight,devicePixelRatio,scale,mode,this.adaptive.factor);if(this.w===innerWidth&&this.h===innerHeight&&this.gl.getPixelRatio()===ratio)return;this.w=innerWidth;this.h=innerHeight;this.compact=gameViewport(this.w,this.h,this.camera.fov).compact;document.body.classList.toggle('compact-play',this.compact);this.gl.setPixelRatio(ratio);this.gl.setSize(this.w,this.h,false);this.camera.aspect=this.w/this.h;this.camera.updateProjectionMatrix()}
  warm(settings:Settings){return this.warmup??=this.ready.then(async()=>{this.mesh.count=0;await this.gl.compileAsync(this.scene,this.camera);this.render(0,settings);})}
  render(time:number,s:Settings,attempt?:Attempt,cursor={x:0,y:0},preview=false,spin={x:0,y:0},hideNotes=false){
    if(s.resolutionMode!==this.qualityMode||s.renderScale!==this.renderScale)this.resize(s.renderScale,s.resolutionMode);
    this.noteScale=s.noteScale;this.noteOpacity=s.noteOpacity/100;if(this.noteShape!==s.noteSkin){if(!this.noteGeometries.has('native'))this.noteGeometries.set('native',this.mesh.geometry);let geometry=this.noteGeometries.get(s.noteSkin);if(!geometry){geometry=noteSkinGeometry(s.noteSkin);geometry.setAttribute('instanceOpacity',this.opacity);this.noteGeometries.set(s.noteSkin,geometry)}this.mesh.geometry=geometry;this.noteShape=s.noteSkin}this.effects.update(performance.now());
    this.palette.sync(s.colors);
    const viewport=gameViewport(this.w,this.h,s.fov);if(this.camera.fov!==viewport.fov){this.camera.fov=viewport.fov;this.camera.updateProjectionMatrix()}this.camera.position.set(cursor.x*s.parallax/100,cursor.y*s.parallax/100,CAMERA_Z);this.camera.rotation.set(spin.x,spin.y,0,'YXZ');
    this.grid.visible=false;this.cursor.update(cursor.x,cursor.y,s,!!attempt,performance.now());
    const dt=Math.min(0.1,Math.max(0,(time-this.lastTime)/1000));this.lastTime=time;if(attempt&&attempt.lastHitIndex>=0)this.hitColor.lerp(this.palette.colors[attempt.lastHitIndex%s.colors.length],Math.min(1,dt*8));this.spaceMaterial.uniforms.offset.value=time/1000*3;
    if(this.backgroundName!==s.background){this.backgroundName=s.background;this.environment.visible=s.background==='grid';this.tunnel.visible=s.background==='tunnel';this.aurora.visible=s.background==='aurora';this.gl.setClearColor(s.background==='grid'?0x0c081c:0x000000,s.background==='media'?0:1)}
    if(this.tunnel.visible)this.tunnel.position.z=(time/1000*s.approachRate/2)%52.5;this.auroraMaterial.uniforms.time.value=time/1000;
    let count=0;const notes=attempt?.chart.notes;const speed=attempt?.speed??1;const at=approachTime(s)*1000*speed;
    if(hideNotes){this.effects.reset()}
    else if(attempt&&notes){
      const mods=attempt.mods,ghost=mods.includes('Ghost'),hflip=mods.includes('HFlip'),vflip=mods.includes('VFlip'),strobe=mods.includes('Strobe')&&time/1000/speed%approachTime(s)>=approachTime(s)/2,earthquake=mods.includes('Earthquake'),chaos=mods.includes('Chaos'),vortex=mods.includes('Vortex');
      const sine=vortex?Math.sin(time/speed/1000*approachTime(s)):0,vortexSpin=vortex?Math.sign(sine)*Math.abs(sine)**0.75:0;
      // Only walk the visible time interval, not the entire chart.
      let lo=0,hi=notes.length;while(lo<hi){const m=(lo+hi)>>>1;if(notes[m].time<time-55*speed)lo=m+1;else hi=m}
      for(let i=lo;i<notes.length&&count<this.capacity;i++){
        const n=notes[i];if(n.time>time+at)break;if(attempt.judged[i]===1||attempt.judged[i]===3)continue;
        const visual=noteVisual(time,n.time,s,speed,ghost,this.visual);let {depth,opacity}=visual;let x=n.x*(hflip?-1:1),y=n.y*(vflip?-1:1),rotation=0;
        const d=Math.max(0,depth)/s.spawnDistance;
        if(strobe||opacity<=0)continue;
        if(earthquake){const angle=Math.sin(i*127.1+Math.floor(time/16)*311.7)*Math.PI*2;x+=Math.sin(angle)*d**1.5/2;y+=Math.cos(angle)*d**1.5/2}
        if(chaos){const angle=Math.sin(x*2+y*3+i+time/speed/400)*Math.PI*4;x+=Math.sin(angle)*d*d;y+=Math.cos(angle)*d*d}
        if(vortex){rotation=(d*15)**1.5/60*vortexSpin;const a=x*Math.cos(rotation)-y*Math.sin(rotation),b=x*Math.sin(rotation)+y*Math.cos(rotation),pull=(d*0.85)**3*Math.hypot(a,b);x=a*(1-pull);y=b*(1-pull)}
        // The four preview notes are re-sorted as they loop. Their source index
        // stays fixed, so wrapping another note cannot recolor this one.
        this.instance(count++,x,y,-depth,opacity,(preview?n.index:i)%s.colors.length,rotation);
      }
    }else{
      const cycle=approachTime(s)*1000;for(let i=0;i<15;i++){const pos=((time+i*247)%Math.max(1000,cycle*4))/Math.max(1000,cycle*4);const depth=s.spawnDistance*(1-pos);const visual=noteVisual(0,depth/s.approachRate*1000,s,1,false,this.visual);this.instance(count++,Math.sin(i*2.3),Math.cos(i*2.3),-depth,preview?visual.opacity:0.18,i%s.colors.length,0)}
    }
    this.mesh.count=count;if(count){this.mesh.instanceMatrix.clearUpdateRanges();this.mesh.instanceMatrix.addUpdateRange(0,count*16);this.mesh.instanceMatrix.needsUpdate=true;this.opacity.clearUpdateRanges();this.opacity.addUpdateRange(0,count);this.opacity.needsUpdate=true;if(this.mesh.instanceColor){this.mesh.instanceColor.clearUpdateRanges();this.mesh.instanceColor.addUpdateRange(0,count*3);this.mesh.instanceColor.needsUpdate=true}}
    this.gl.render(this.scene,this.camera);this.frames++;const now=performance.now();if(attempt&&!preview&&this.lastFrameAt&&this.qualityMode==='auto'&&this.adaptive.sample(now-this.lastFrameAt))this.resize(this.renderScale);this.lastFrameAt=now;if(now-this.lastFPS>=500){this.fps=Math.round(this.frames*1000/(now-this.lastFPS));this.frames=0;this.lastFPS=now}
  }
  private instance(index:number,x:number,y:number,z:number,opacity:number,color:number,rotation:number){
    writeNoteMatrix(this.mesh.instanceMatrix.array as Float32Array,index,x,y,z,rotation);
    if(this.noteScale!==1){const matrix=this.mesh.instanceMatrix.array as Float32Array,base=index*16;for(const offset of [0,1,4,5])matrix[base+offset]*=this.noteScale;matrix[base+10]=this.noteScale}else (this.mesh.instanceMatrix.array as Float32Array)[index*16+10]=1;
    const rgb=this.palette.colors[color],colors=this.mesh.instanceColor!.array as Float32Array,offset=index*3;
    colors[offset]=rgb.r;colors[offset+1]=rgb.g;colors[offset+2]=rgb.b;(this.opacity.array as Float32Array)[index]=clamp(opacity*this.noteOpacity,0,1);
  }
}

import * as T from 'three';
import {compactNoteGeometry} from './render-kernel';
export function noteSkinGeometry(name:string){
 const shape=new T.Shape(),points:number[][]=[];const radius=.4375;
 if(name==='circle'||name==='octagon'){const sides=name==='circle'?32:8;for(let i=0;i<=sides;i++){const a=i/sides*Math.PI*2;points.push([Math.cos(a)*radius,Math.sin(a)*radius])}}
 else{const rounding=name==='rounded'?.11:0;if(rounding){shape.moveTo(-radius+rounding,-radius);shape.lineTo(radius-rounding,-radius);shape.quadraticCurveTo(radius,-radius,radius,-radius+rounding);shape.lineTo(radius,radius-rounding);shape.quadraticCurveTo(radius,radius,radius-rounding,radius);shape.lineTo(-radius+rounding,radius);shape.quadraticCurveTo(-radius,radius,-radius,radius-rounding);shape.lineTo(-radius,-radius+rounding);shape.quadraticCurveTo(-radius,-radius,-radius+rounding,-radius)}else points.push([-radius,-radius],[radius,-radius],[radius,radius],[-radius,radius],[-radius,-radius])}
 if(points.length){shape.moveTo(...points[0] as [number,number]);for(const p of points.slice(1))shape.lineTo(p[0],p[1]);shape.closePath()}
 if(name!=='plane'){const hole=new T.Path(),sides=name==='circle'?32:name==='octagon'?8:4,r=radius-.075;if(sides===4){hole.moveTo(-r,-r);hole.lineTo(-r,r);hole.lineTo(r,r);hole.lineTo(r,-r);hole.closePath()}else for(let i=0;i<=sides;i++){const a=-i/sides*Math.PI*2;if(i===0)hole.moveTo(Math.cos(a)*r,Math.sin(a)*r);else hole.lineTo(Math.cos(a)*r,Math.sin(a)*r)}shape.holes.push(hole)}
 const source=new T.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:false,curveSegments:6,steps:1});source.translate(0,0,-.06);const geometry=compactNoteGeometry(source);source.dispose();return geometry;
}
export class HitEffects {
 group=new T.Group();private next=0;
 private shapes=[new T.BufferGeometry(),new T.BufferGeometry()];
 private pool:{mesh:T.LineSegments;at:number;active:boolean}[]=[];
 constructor(){
  const circle:number[]=[],pieces:number[]=[];for(let i=0;i<24;i++){const a=i/24*Math.PI*2,b=(i+1)/24*Math.PI*2;circle.push(Math.cos(a)*.5,Math.sin(a)*.5,0,Math.cos(b)*.5,Math.sin(b)*.5,0)}
  for(const [x,y,dx,dy]of [[-1,-1,.5,0],[-1,-1,0,.5],[1,-1,-.5,0],[1,-1,0,.5],[-1,1,.5,0],[-1,1,0,-.5],[1,1,-.5,0],[1,1,0,-.5]])pieces.push(x*.45,y*.45,0,(x+dx)*.45,(y+dy)*.45,0);
  this.shapes[0].setAttribute('position',new T.Float32BufferAttribute(circle,3));this.shapes[1].setAttribute('position',new T.Float32BufferAttribute(pieces,3));
  for(let i=0;i<24;i++){const mesh=new T.LineSegments(this.shapes[0],new T.LineBasicMaterial({color:0xffffff,transparent:true,depthWrite:false}));mesh.visible=false;mesh.frustumCulled=false;this.group.add(mesh);this.pool.push({mesh,at:0,active:false})}
 }
 trigger(x:number,y:number,color:string,type:string){if(type==='none')return;const item=this.pool[this.next++%this.pool.length];item.mesh.geometry=this.shapes[type==='break'?1:0];item.mesh.position.set(x,y,.03);(item.mesh.material as T.LineBasicMaterial).color.set(color);item.at=performance.now();item.active=true;item.mesh.visible=true}
 update(now:number){for(const item of this.pool){if(!item.active)continue;const age=(now-item.at)/250;if(age>=1){item.active=false;item.mesh.visible=false;continue}item.mesh.scale.setScalar(1+age*.8);(item.mesh.material as T.LineBasicMaterial).opacity=1-age}}
 reset(){for(const item of this.pool){item.active=false;item.mesh.visible=false}}
}

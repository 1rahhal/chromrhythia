import * as T from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

// Notes use an unlit, untextured material. Preserve positions and triangle order;
// dropping normals/UVs lets the GPU reuse identical vertices across faces.
export function compactNoteGeometry(source:T.BufferGeometry){
  const positions=new T.BufferGeometry();positions.setAttribute('position',source.getAttribute('position').clone());
  if(source.index)positions.setIndex(source.index.clone());
  const geometry=mergeVertices(positions,1e-6);positions.dispose();return geometry;
}
export function createTunnel(load:(path:string)=>T.Texture){
  const group=new T.Group(),geometry=new T.PlaneGeometry(28,28);
  const materials=['tunnel_ring_b.png','tunnel_space_a.png'].map(name=>{
    const map=load('assets/'+name);map.colorSpace=T.SRGBColorSpace;
    return new T.MeshBasicMaterial({map,transparent:true,depthWrite:false,side:T.DoubleSide,forceSinglePass:true,color:0xa4a0ff});
  });
  for(let i=0;i<9;i++){const ring=new T.Mesh(geometry,materials[i%2]);ring.position.z=-i*26.25;ring.updateMatrix();ring.matrixAutoUpdate=false;group.add(ring)}
  return group;
}
export function writeNoteMatrix(matrix:Float32Array,index:number,x:number,y:number,z:number,rotation:number){
  // InstancedMesh initializes every matrix to identity. Only these entries vary.
  const offset=index*16,c=rotation?Math.cos(rotation):1,s=rotation?Math.sin(rotation):0;
  matrix[offset]=c;matrix[offset+1]=s;matrix[offset+4]=-s;matrix[offset+5]=c;
  matrix[offset+12]=x;matrix[offset+13]=y;matrix[offset+14]=z;
}
export class NotePalette {
  colors:T.Color[]=[];private values:string[]=[];
  sync(values:string[]){if(this.values.length===values.length&&values.every((v,i)=>v===this.values[i]))return;this.values=[...values];this.colors=values.map(value=>new T.Color(value))}
}

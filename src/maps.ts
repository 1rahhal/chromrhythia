import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';
import type {Chart,Note} from './model';
const MAX_SIZE=256*1024*1024,MAX_NOTES=2_000_000;
class Reader {
  p=0;v:DataView;
  constructor(public b:Uint8Array){this.v=new DataView(b.buffer,b.byteOffset,b.byteLength)}
  take(n:number){if(!Number.isSafeInteger(n)||n<0||this.p+n>this.b.length)throw Error('Truncated or invalid map data');const b=this.b.subarray(this.p,this.p+n);this.p+=n;return b}
  skip(n:number){this.take(n)}
  seek(n:number){if(!Number.isSafeInteger(n)||n<0||n>this.b.length)throw Error('Invalid map offset');this.p=n}
  u8(){return this.take(1)[0]} u16(){const p=this.p;this.take(2);return this.v.getUint16(p,true)} u32(){const p=this.p;this.take(4);return this.v.getUint32(p,true)}
  u64(){const p=this.p;this.take(8);const n=Number(this.v.getBigUint64(p,true));if(!Number.isSafeInteger(n))throw Error('Map offset is too large');return n}
  f32(){const p=this.p;this.take(4);return this.v.getFloat32(p,true)}
  text(n:number){return strFromU8(this.take(n))} string(){return this.text(this.u16())}
  line(){const start=this.p;while(this.p<this.b.length&&this.b[this.p]!==10)this.p++;const s=strFromU8(this.b.subarray(start,this.p)).replace(/\r$/,'');if(this.p<this.b.length)this.p++;return s}
}
function count(n:number){if(n<1||n>MAX_NOTES)throw Error('Map must contain between 1 and 2,000,000 notes');return n}
function splitTitle(title:string){const i=title.indexOf(' - ');return i<0?{artist:'',title}:{artist:title.slice(0,i),title:title.slice(i+3)}}
function normalize(chart:Chart){
  count(chart.notes.length);
  for(const n of chart.notes)if(!Number.isFinite(n.time)||n.time<0||n.time>86400000||!Number.isFinite(n.x)||!Number.isFinite(n.y)||Math.abs(n.x)>10000||Math.abs(n.y)>10000)throw Error('Invalid note coordinates or time');
  chart.notes.sort((a,b)=>a.time-b.time);chart.notes.forEach((n,i)=>n.index=i);chart.length=Math.max(chart.length||0,chart.notes.at(-1)!.time);return chart;
}
function coords(r:Reader){const q=r.u8();if(q>1)throw Error('Invalid note coordinate type');return q?[r.f32(),r.f32()]:[r.u8(),r.u8()]}
export function parseSSPM(bytes:Uint8Array,name:string):Chart{
  const r=new Reader(bytes);if(r.text(4)!=='SS+m')throw Error('Invalid SSPM signature');const version=r.u16();let notes:Note[]=[],title=name,artist='',id='',mappers:string[]=[],difficulty=0,length=0,audio:Uint8Array|undefined,cover:Uint8Array|undefined;
  if(version===1){
    r.skip(2);id=r.line();({title,artist}=splitTitle(r.line()));mappers=r.line().split(/[&,]/);length=r.u32();const n=count(r.u32());difficulty=r.u8();const ct=r.u8();
    if(ct===2)cover=r.take(r.u64()).slice();else if(ct===1){r.skip(6);r.skip(r.u64())}else if(ct!==0)throw Error('Invalid cover format');
    if(r.u8())audio=r.take(r.u64()).slice();
    for(let i=0;i<n;i++){const time=r.u32();const [x,y]=coords(r);notes.push({time,x:x-1,y:1-y,index:i})}
  }else if(version===2){
    r.skip(24);length=r.u32();const n=count(r.u32()),markers=r.u32();difficulty=r.u8();r.skip(2);const hasAudio=r.u8(),hasCover=r.u8(),requiresMods=r.u8();if(requiresMods)throw Error('This SSPM requires unsupported map extensions');
    r.skip(16);const ao=r.u64(),al=r.u64(),co=r.u64(),cl=r.u64(),defs=r.u64();r.skip(8);const mo=r.u64();r.skip(8);
    id=r.string();({title,artist}=splitTitle(r.string()));r.string();const mc=r.u16();for(let i=0;i<mc;i++)mappers.push(r.string());
    if(hasAudio){r.seek(ao);audio=r.take(al).slice()}if(hasCover){r.seek(co);cover=r.take(cl).slice()}
    r.seek(defs);const types=r.u8();let noteType=-1;for(let i=0;i<types;i++){const typeName=r.string();const fields=r.u8();const datatypes=r.take(fields);r.skip(1);if(typeName==='ssp_note'&&fields===1&&datatypes[0]===7)noteType=i}
    if(noteType<0)throw Error('SSPM contains unsupported marker definitions');
    r.seek(mo);for(let i=0;i<markers;i++){const time=r.u32(),type=r.u8();if(type!==noteType)throw Error('SSPM contains non-note markers; import in the native client first');const [x,y]=coords(r);notes.push({time,x:x-1,y:1-y,index:i})}if(notes.length!==n)throw Error('SSPM note count mismatch');
  }else throw Error(`Unsupported SSPM version ${version}`);
  return normalize({id,title,artist,mappers,difficulty,notes,length,audio,cover});
}
export function parsePHXMO(bytes:Uint8Array){const r=new Reader(bytes);const groups=r.u32();if(groups!==12)throw Error('Unsupported PHXMO object version');const n=count(r.u32());const notes:Note[]=[];for(let i=0;i<n;i++){const time=r.u32(),q=r.u8();if(q>1)throw Error('Invalid coordinate type');const x=q?r.f32():r.u8()-1,y=q?r.f32():r.u8()-1;notes.push({time,x,y,index:i})}for(let i=0;i<11&&r.p<bytes.length;i++)if(r.u32()!==0)throw Error('Animated PHXM object tracks are not supported in this browser build');return notes}
function archive(bytes:Uint8Array){let total=0;return unzipSync(bytes,{filter:file=>{total+=file.originalSize;if(total>MAX_SIZE)throw Error('Unpacked map exceeds 256 MB');return true}})}
export async function parseMap(bytes:Uint8Array,name:string,pairedAudio?:Uint8Array):Promise<Chart>{
  if(bytes.length>MAX_SIZE)throw Error('Map exceeds 256 MB');const ext=name.split('.').pop()?.toLowerCase();let chart:Chart;
  if(ext==='sspm')chart=parseSSPM(bytes,name);
  else if(ext==='txt'){
    const [id,...items]=strFromU8(bytes).trim().split(',');const notes=items.filter(Boolean).map((v,i)=>{const a=v.split('|').map(Number);if(a.length!==3)throw Error('Invalid text map');return {x:1-a[0],y:a[1]-1,time:a[2],index:i}});
    chart=normalize({id,title:name.replace(/\.txt$/i,''),artist:'',mappers:[],difficulty:0,notes,length:0,audio:pairedAudio});
  }else if(ext==='phxm'||ext==='zip'||ext==='rhm'){
    const files=archive(bytes),find=(n?:string|null)=>{if(!n)return;const normalized=n.replaceAll('\\','/').replace(/^\.\//,'').toLowerCase();return Object.keys(files).find(k=>{const key=k.replaceAll('\\','/').toLowerCase();return key===normalized||key.endsWith('/'+normalized)})};
    if(ext==='rhm'||find('map')){
      const d=JSON.parse(strFromU8(files[find('map')!]));const notes=d.Notes.map((n:{Time:number;X:number;Y:number},i:number)=>({time:n.Time,x:n.X-1,y:1-n.Y,index:i}));
      chart=normalize({id:'',...splitTitle(d.Title||name),mappers:d.Mappers||[],difficulty:d.Difficulty||0,difficultyName:d.CustomDifficultyName,notes,length:0,audio:files[find('audio')||find(d.AudioFileName)||''],cover:files[find('cover')||find('cover.png')||find('cover.jpg')||find('cover.webp')||find(d.ImagePath)||'']});
    }else{
      const mk=find('metadata.json'),ok=find('objects.phxmo');if(!mk||!ok)throw Error('Archive needs metadata.json and objects.phxmo');const m=JSON.parse(strFromU8(files[mk]));
      chart=normalize({id:m.ID||'',title:m.Title||name,artist:m.Artist||'',mappers:m.Mappers||[],difficulty:m.Difficulty||0,difficultyName:m.DifficultyName,notes:parsePHXMO(files[ok]),length:m.Length||0,audio:files[find('audio.'+(m.AudioExt||'mp3'))||find('audio.ogg')||find('audio.wav')||''],cover:files[find('cover.png')||find('cover.jpg')||find('cover.jpeg')||find('cover.webp')||find('cover.gif')||find(m.CoverPath)||find(m.ImagePath)||'']});
    }
  }else throw Error('Choose a .phxm, .sspm, .rhm or .txt map');
  const hash=await crypto.subtle.digest('SHA-256',bytes.slice().buffer);chart.id=Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('');return chart;
}
export function exportPHXM(chart:Chart){
  const size=8+chart.notes.reduce((n,v)=>n+5+((Number.isInteger(v.x)&&Number.isInteger(v.y)&&Math.abs(v.x)<=1&&Math.abs(v.y)<=1)?2:8),0)+44;
  const b=new Uint8Array(size),v=new DataView(b.buffer);let p=0;const u32=(n:number)=>{v.setUint32(p,n,true);p+=4};u32(12);u32(chart.notes.length);
  for(const n of chart.notes){u32(n.time);const q=!(Number.isInteger(n.x)&&Number.isInteger(n.y)&&Math.abs(n.x)<=1&&Math.abs(n.y)<=1);b[p++]=+q;if(q){v.setFloat32(p,n.x,true);p+=4;v.setFloat32(p,n.y,true);p+=4}else{b[p++]=n.x+1;b[p++]=n.y+1}}
  const meta={ID:chart.id,Title:chart.title,Artist:chart.artist,Mappers:chart.mappers,Difficulty:chart.difficulty,DifficultyName:chart.difficultyName,Length:chart.length,AudioExt:chart.audio&&strFromU8(chart.audio.subarray(0,4))==='OggS'?'ogg':'mp3'};
  const files:Record<string,Uint8Array>={'metadata.json':strToU8(JSON.stringify(meta)), 'objects.phxmo':b};if(chart.audio)files['audio.'+meta.AudioExt]=chart.audio;if(chart.cover)files['cover.png']=chart.cover;return zipSync(files);
}
export function makeDemo(difficulty:number):Chart{
  const bpm=[100,128,160][difficulty],beat=60000/bpm,notes:Note[]=[];
  for(let i=0;i<64*(difficulty+1);i++){const step=difficulty===2?beat/2:beat;const a=Math.floor(i/(difficulty+1));notes.push({index:i,time:2000+i*step,x:(a%3)-1,y:(Math.floor(a/3)%3)-1})}
  return {id:'demo-'+difficulty,title:['First light','Neon steps','Overdrive'][difficulty],artist:'Chromrhythia practice',mappers:['Generated practice chart'],difficulty:difficulty+1,notes,length:notes.at(-1)!.time,demo:true};
}

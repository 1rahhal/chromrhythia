import type {Chart} from './model';
declare global{interface Window{__CHROMRHYTHIA_AUTH__?:string}}
const token=typeof window==='undefined'?'':window.__CHROMRHYTHIA_AUTH__||'';if(typeof window!=='undefined')delete window.__CHROMRHYTHIA_AUTH__;
const headers=()=>({Authorization:`Bearer ${token}`});
const pack=(m:unknown)=>{const a=new TextEncoder().encode(JSON.stringify(m));let s='';for(const c of a)s+=String.fromCharCode(c);return btoa(s)};
export async function sharedMaps():Promise<Chart[]>{let cursor:string|undefined;const maps:Chart[]=[];do{const r=await fetch('api/maps'+(cursor?'?cursor='+encodeURIComponent(cursor):''),{headers:headers(),signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('Shared library unavailable; showing downloaded maps.');const data=await r.json();maps.push(...data.maps);cursor=data.cursor;if(maps.length>10000)break}while(cursor);return maps}
export async function uploadShared(chart:Chart,bytes:Uint8Array,fileName:string){if(bytes.length>64*1024*1024)throw Error('The shared library supports maps up to 64 MB.');const hash=await crypto.subtle.digest('SHA-256',bytes.slice().buffer),id=Array.from(new Uint8Array(hash)).map(n=>n.toString(16).padStart(2,'0')).join('');const r=await fetch('api/maps/'+id,{method:'PUT',headers:{...headers(),'Content-Type':'application/octet-stream','X-Map-Metadata':pack({title:chart.title,artist:chart.artist,mappers:chart.mappers,difficulty:chart.difficulty,difficultyName:chart.difficultyName,count:chart.notes.length,length:chart.length,fileName,hasCover:!!chart.cover?.length})},body:bytes.slice().buffer});const data=await r.json();if(!r.ok)throw Error(data.error||'Upload failed');return data.map as Chart}
export async function downloadShared(chart:Chart,onProgress?:(loaded:number,total:number)=>void){
  const r=await fetch(`api/maps/${chart.id}/download`,{headers:headers()});if(!r.ok)throw Error('Could not download this map. Try again when connected.');const reader=r.body!.getReader(),chunks:Uint8Array[]=[];let size=0;const total=Number(r.headers.get('content-length'))||chart.size||0;while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);size+=value.length;if(size>256*1024*1024){await reader.cancel();throw Error('Map is too large')}onProgress?.(size,total)}const bytes=new Uint8Array(size);let p=0;for(const c of chunks){bytes.set(c,p);p+=c.length}return bytes;
}
export async function fetchCover(id:string){
  const path=new URL(`api/maps/${id}/cover`,location.href).href;let cache:Cache|undefined;
  try{cache=await caches.open('rhythia-cover-art-v2');const cached=await cache.match(path);if(cached)return new Uint8Array(await cached.arrayBuffer())}catch{/* Restricted storage must not prevent artwork downloads. */}
  const r=await fetch(path,{headers:headers(),signal:AbortSignal.timeout(20000)});if(r.status===404)return;if(!r.ok)throw Error('Artwork is temporarily unavailable. Retry when connected.');
  const bytes=new Uint8Array(await r.arrayBuffer());if(!bytes.length||bytes.length>8*1024*1024)throw Error('Invalid artwork response');
  if(cache)try{await cache.put(path,new Response(bytes.slice().buffer,{headers:{'content-type':r.headers.get('content-type')||'application/octet-stream'}}))}catch{}
  return bytes;
}
async function coverImage(bytes:Uint8Array):Promise<{image:CanvasImageSource;width:number;height:number;close:()=>void}>{
  const blob=new Blob([bytes.slice().buffer]);if(typeof createImageBitmap==='function')try{const bitmap=await createImageBitmap(blob);return {image:bitmap,width:bitmap.width,height:bitmap.height,close:()=>bitmap.close()}}catch{}
  const url=URL.createObjectURL(blob),image=new Image();try{image.src=url;await image.decode();return {image,width:image.naturalWidth,height:image.naturalHeight,close:()=>URL.revokeObjectURL(url)}}catch(e){URL.revokeObjectURL(url);throw e}
}
export async function uploadCover(chart:Chart){
  if(!chart.cover?.length||chart.demo)return;
  const decoded=await coverImage(chart.cover);let blob:Blob|null;
  try{const ratio=Math.min(1,512/Math.max(decoded.width,decoded.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(decoded.width*ratio));canvas.height=Math.max(1,Math.round(decoded.height*ratio));canvas.getContext('2d')!.drawImage(decoded.image,0,0,canvas.width,canvas.height);blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',.8))}finally{decoded.close()}
  if(!blob)throw Error('Could not create an artwork thumbnail');
  const r=await fetch(`api/maps/${chart.id}/cover`,{method:'PUT',headers:{...headers(),'Content-Type':'image/jpeg'},body:blob,signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Artwork thumbnail was not shared. Retry when connected.');
}

export async function communityPresets(cursor?:string){const r=await fetch('api/presets'+(cursor?'?cursor='+encodeURIComponent(cursor):''),{headers:headers(),signal:AbortSignal.timeout(10000)});const data=await r.json();if(!r.ok)throw Error(data.error||'Could not load shared presets');return data as {presets:import('./presets').Preset[];cursor:string|null}}
export interface SharedAsset{id:string;name:string;type:string;size:number}
export async function sharedAssets(){const assets:SharedAsset[]=[];let cursor:string|undefined;do{const r=await fetch('api/assets'+(cursor?'?cursor='+encodeURIComponent(cursor):''),{headers:headers(),signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Shared assets are unavailable');const data=await r.json();assets.push(...data.assets);cursor=data.cursor}while(cursor&&assets.length<1000);return assets}
export async function uploadAsset(file:File){const types:Record<string,string>={mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',m4a:'audio/mp4',flac:'audio/flac',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',mp4:'video/mp4',webm:'video/webm'};const type=types[file.name.split('.').pop()!.toLowerCase()]||file.type;const limit=type.startsWith('audio/')?8:32;if(!file.size||file.size>limit*1048576)throw Error(`Use a file under ${limit} MB`);const bytes=await file.arrayBuffer(),hash=await crypto.subtle.digest('SHA-256',bytes),id=Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');const r=await fetch('api/assets/'+id,{method:'PUT',headers:{...headers(),'content-type':type,'x-asset-name':encodeURIComponent(file.name)},body:bytes});const data=await r.json();if(!r.ok)throw Error(data.error||'Import failed');return data.asset as SharedAsset}
const assetURLs=new Map<string,Promise<string>>();
export function sharedAssetURL(id:string){let pending=assetURLs.get(id);if(!pending){pending=(async()=>{const cache=await caches.open('renythia-shared-assets-v1').catch(()=>undefined),path=new URL('api/assets/'+id,location.href).href;let response=await cache?.match(path);if(!response){response=await fetch(path,{headers:headers(),signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Could not load the imported asset');await cache?.put(path,response.clone()).catch(()=>{})}return URL.createObjectURL(await response.blob())})().catch(error=>{assetURLs.delete(id);throw error});assetURLs.set(id,pending)}return pending}
export async function publishPreset(preset:import('./presets').LocalPreset,author:string){
  try{
    const r=await fetch('api/presets'+(preset.publicId?'/'+preset.publicId:''),{method:preset.publicId?'PUT':'POST',headers:{...headers(),'Content-Type':'application/json','X-Preset-Key':preset.publisherKey!},body:JSON.stringify({id:preset.id,name:preset.name,author,settings:preset.settings}),signal:AbortSignal.timeout(20000)});
    const data=await r.json();if(!r.ok)throw Error(data.error||'Could not publish preset');
    if(!data.preset?.id)throw Error('The server did not confirm this preset. Retry Save global.');
    return data.preset as import('./presets').Preset;
  }catch(e){if(e instanceof Error&&(e.name==='TimeoutError'||e.name==='AbortError'))throw Error('Global save timed out. Your local copy is safe; retry Save global.');throw e}
}

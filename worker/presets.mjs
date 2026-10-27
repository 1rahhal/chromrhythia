import {sanitizeSettings} from '../shared/settings.mjs';
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const publicPreset=p=>({id:p.id,name:p.name,author:p.author,settings:p.settings,createdAt:p.createdAt,updatedAt:p.updatedAt});
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');
export async function presetsAPI(request,bucket){
  const url=new URL(request.url),id=url.pathname.slice('/api/presets/'.length),collection=url.pathname==='/api/presets';
  if(!collection&&!/^[a-f0-9-]{36}$/.test(id))return json({error:'Not found'},404);
  if(request.method==='GET'&&collection){
    const cursor=url.searchParams.get('cursor')||undefined;if(cursor&&cursor.length>2048)return json({error:'Invalid cursor'},400);
    const list=await bucket.list({prefix:'presets/',limit:20,cursor});
    const presets=await Promise.all(list.objects.map(async o=>{try{const object=await bucket.get(o.key);return publicPreset(await new Response(object.body).json())}catch{return null}}));
    return json({presets:presets.filter(Boolean),cursor:list.truncated?list.cursor:null});
  }
  if(!((collection&&request.method==='POST')||(!collection&&request.method==='PUT')))return json({error:'Method not allowed'},405);
  const origin=request.headers.get('origin');if(origin&&origin!==url.origin)return json({error:'Origin not allowed'},403);
  const ownerKey=request.headers.get('x-preset-key');if(!ownerKey||!/^[a-f0-9]{64}$/.test(ownerKey))return json({error:'Missing publisher key'},400);
  if(Number(request.headers.get('content-length'))>16384)return json({error:'Preset is too large'},413);
  // Bound the stream as well: Content-Length is not trusted.
  const reader=request.body?.getReader();if(!reader)return json({error:'Missing preset'},400);
  const chunks=[];let length=0;while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>16384){await reader.cancel();return json({error:'Preset is too large'},413)}chunks.push(value)}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  let value;try{value=JSON.parse(new TextDecoder().decode(bytes))}catch{return json({error:'Invalid preset'},400)}
  if(!value||typeof value.name!=='string'||!value.name.trim()||!value.settings||typeof value.settings!=='object'||Array.isArray(value.settings))return json({error:'Give the preset a name and settings'},400);
  const ownerHash=await hash(ownerKey),newId=typeof value.id==='string'&&/^[a-f0-9-]{36}$/.test(value.id)?value.id:crypto.randomUUID(),key=collection?`presets/${newId}.json`:`presets/${id}.json`;
  let previous;const object=await bucket.get(key);if(!collection&&!object)return json({error:'Preset not found'},404);if(object){previous=await new Response(object.body).json();if(previous.ownerHash!==ownerHash)return json({error:'Only the publishing browser can update this preset. Save your own copy instead.'},403)}
  const now=new Date().toISOString(),preset={id:key.slice(8,-5),name:value.name.trim().slice(0,60),author:typeof value.author==='string'?value.author.trim().slice(0,40):'',settings:sanitizeSettings(value.settings),ownerHash,createdAt:previous?.createdAt||now,updatedAt:now};
  await bucket.put(key,JSON.stringify(preset),{httpMetadata:{contentType:'application/json'}});
  return json({preset:publicPreset(preset)},collection&&!previous?201:200);
}

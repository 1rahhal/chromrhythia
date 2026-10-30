import {recoverCover,imageType} from './artwork.mjs';
import {presetsAPI} from './presets.mjs';
import {assetsAPI} from './assets.mjs';
const MAX_MAP_SIZE=64*1024*1024;
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
function equal(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==64||b.length!==64)return false;let result=0;for(let i=0;i<64;i++)result|=a.charCodeAt(i)^b.charCodeAt(i);return result===0}
function pack(value){const bytes=new TextEncoder().encode(JSON.stringify(value));let str='';for(const b of bytes)str+=String.fromCharCode(b);return btoa(str)}
function unpack(text){return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(text),c=>c.charCodeAt(0))))}
function metadata(object){const m=unpack(object.customMetadata?.chart||'');return {...m,id:object.key.slice(5,-4),size:object.size,uploadedAt:object.uploaded,remote:true,notes:[]}}
export async function api(request,env){
  const url=new URL(request.url),path=url.pathname;
  if(path==='/api/status')return json({shared:!!env.BUCKET});
  const auth=request.headers.get('authorization')||'';
  if(!equal(auth.startsWith('Bearer ')?auth.slice(7):'',env.PASSWORD_HASH))return json({error:'Unlock the game to use the shared library.'},401);
  if(!env.BUCKET)return json({error:'Shared storage is not configured.'},503);
  try{
    if(path==='/api/presets'||path.startsWith('/api/presets/'))return await presetsAPI(request,env.BUCKET);
    if(path==='/api/assets'||path.startsWith('/api/assets/'))return await assetsAPI(request,env.BUCKET);
    if(path==='/api/maps'&&request.method==='GET'){
      const cursor=url.searchParams.get('cursor')||undefined;if(cursor&&cursor.length>2048)return json({error:'Invalid cursor'},400);
      const list=await env.BUCKET.list({prefix:'maps/',limit:100,include:['customMetadata'],cursor});
      const maps=[];for(const item of list.objects){try{maps.push(metadata(item))}catch{}}
      return json({maps,cursor:list.truncated?list.cursor:null});
    }
    const match=path.match(/^\/api\/maps\/([a-f0-9]{64})(\/(?:download|cover))?$/);
    if(!match)return json({error:'Not found'},404);const id=match[1],key=`maps/${id}.bin`;
    if(match[2]==='/cover'){
      const coverKey=`covers/${id}.image`;
      if(request.method==='GET'){let cover=await env.BUCKET.get(coverKey);if(!cover)cover=await recoverCover(env.BUCKET,key,id);if(!cover||cover.customMetadata?.source==='absent')return json({error:'This map has no embedded cover.'},404);return new Response(cover.body,{headers:{'content-type':cover.httpMetadata?.contentType||'image/jpeg','content-length':String(cover.size),'cache-control':'private, max-age=31536000, immutable','x-content-type-options':'nosniff'}})}
      if(request.method==='PUT'){
        const origin=request.headers.get('origin');if(origin&&origin!==url.origin)return json({error:'Origin not allowed'},403);
        const size=Number(request.headers.get('content-length'));if(!Number.isInteger(size)||size<1||size>524288)return json({error:'Cover must be under 512 KB'},413);
        if(!await env.BUCKET.head(key))return json({error:'Map not found'},404);
        const existing=await env.BUCKET.head(coverKey);if(existing&&existing.customMetadata?.source!=='embedded'&&existing.customMetadata?.source!=='absent')return json({success:true});
        const bytes=new Uint8Array(await request.arrayBuffer());if(bytes.length>524288)return json({error:'Cover too large'},413);
        const type=imageType(bytes);if(!type)return json({error:'Use an encoded PNG, JPEG, WebP or GIF cover'},400);
        if(existing?.customMetadata?.source==='embedded'&&bytes.length>=existing.size)return json({success:true});
        await env.BUCKET.put(coverKey,bytes,{httpMetadata:{contentType:type},customMetadata:{artworkVersion:'2',source:'thumbnail'}});return json({success:true},201);
      }
      return json({error:'Method not allowed'},405);
    }
    if(request.method==='GET'&&match[2]){
      const object=await env.BUCKET.get(key);if(!object)return json({error:'Map not found'},404);
      return new Response(object.body,{headers:{'content-type':'application/octet-stream','content-length':String(object.size),'etag':object.httpEtag,'cache-control':'private, max-age=31536000, immutable','x-content-type-options':'nosniff','content-disposition':`attachment; filename="${id}.map"`}});
    }
    if(request.method==='PUT'&&!match[2]){
      const origin=request.headers.get('origin');if(origin&&origin!==url.origin)return json({error:'Origin not allowed'},403);
      const size=Number(request.headers.get('content-length'));if(!Number.isInteger(size)||size<=0||size>MAX_MAP_SIZE)return json({error:'Maps must be 64 MB or smaller.'},413);
      const header=request.headers.get('x-map-metadata');if(!header||header.length>4000)return json({error:'Missing map metadata'},400);
      let m;try{m=unpack(header)}catch{return json({error:'Invalid metadata'},400)}
      if(!m||typeof m.title!=='string'||typeof m.fileName!=='string'||!(/\.(sspm|phxm|rhm)$/i.test(m.fileName))||!Number.isInteger(m.count)||m.count<1||m.count>2_000_000||!Number.isFinite(m.length)||m.length<0||m.length>86400000)return json({error:'Invalid map metadata'},400);
      const data={title:m.title.slice(0,120),artist:String(m.artist||'').slice(0,100),mappers:Array.isArray(m.mappers)?m.mappers.slice(0,3).map(x=>String(x).slice(0,40)):[],difficulty:Math.max(0,Math.min(6,Math.floor(Number(m.difficulty)||0))),difficultyName:String(m.difficultyName||'').slice(0,60),count:m.count,length:m.length,fileName:m.fileName.replace(/[^\w .()\-]/g,'_').slice(-150),hasCover:!!m.hasCover};
      const existing=await env.BUCKET.head(key);if(existing)return json({map:metadata(existing),duplicate:true});
      // R2 validates the SHA-256 while consuming the stream. No song is buffered in the Worker.
      const stored=await env.BUCKET.put(key,request.body,{sha256:id,onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/octet-stream'},customMetadata:{chart:pack(data)}});
      const object=stored||await env.BUCKET.head(key);return json({map:metadata(object)},201);
    }
    return json({error:'Method not allowed'},405);
  }catch(error){return json({error:request.method==='PUT'?'Upload failed. Check the file and retry.':'The shared library is temporarily unavailable.'},request.method==='PUT'?400:503)}
}

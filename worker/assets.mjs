const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const types=new Set(['audio/mpeg','audio/wav','audio/ogg','audio/mp4','audio/flac','image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm']);
const info=o=>({id:o.key.slice(7),name:o.customMetadata?.name||'Imported asset',type:o.httpMetadata?.contentType||o.customMetadata?.type,size:o.size});
export async function assetsAPI(request,bucket){
 const url=new URL(request.url),match=url.pathname.match(/^\/api\/assets(?:\/([a-f0-9]{64}))?$/);if(!match)return json({error:'Not found'},404);
 if(!match[1]&&request.method==='GET'){const list=await bucket.list({prefix:'assets/',limit:100,cursor:url.searchParams.get('cursor')||undefined,include:['customMetadata','httpMetadata']});return json({assets:list.objects.map(info),cursor:list.truncated?list.cursor:null})}
 if(!match[1])return json({error:'Method not allowed'},405);const id=match[1],key='assets/'+id;
 if(request.method==='GET'){const object=await bucket.get(key);if(!object)return json({error:'Asset not found'},404);return new Response(object.body,{headers:{'content-type':object.httpMetadata?.contentType||object.customMetadata?.type||'application/octet-stream','cache-control':'private, max-age=31536000, immutable','content-length':String(object.size),'x-content-type-options':'nosniff'}})}
 if(request.method==='PUT'){
  const origin=request.headers.get('origin');if(origin&&origin!==url.origin)return json({error:'Origin not allowed'},403);
  const type=request.headers.get('content-type')?.split(';')[0]||'',size=Number(request.headers.get('content-length')),limit=type.startsWith('audio/')?8*1024*1024:32*1024*1024;
  if(!types.has(type))return json({error:'Use an audio, image, MP4 or WebM file'},400);if(!Number.isInteger(size)||size<1||size>limit)return json({error:'This file is too large'},413);
  let name;try{name=decodeURIComponent(request.headers.get('x-asset-name')||'Imported asset').slice(0,100)}catch{return json({error:'Invalid name'},400)}
  const existing=await bucket.head(key);if(existing)return json({asset:info(existing)});
  const stored=await bucket.put(key,request.body,{sha256:id,onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:type},customMetadata:{name,type}});return json({asset:info(stored||await bucket.head(key))},201);
 }
 return json({error:'Method not allowed'},405);
}

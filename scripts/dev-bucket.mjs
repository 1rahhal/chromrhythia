import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
// A development-only R2 substitute. Production always uses the managed BUCKET binding.
export function localBucket(root='.local/shared-maps'){
  const path=key=>{if(!/^maps\/[a-f0-9]{64}\.bin$/.test(key))throw Error('Invalid key');return root+'/'+key.slice(5)};
  const head=async key=>{try{const m=JSON.parse(await readFile(path(key)+'.json','utf8'));return {...m,uploaded:new Date(m.uploaded)}}catch{return null}};
  return {head,async get(key){const object=await head(key);if(!object)return null;return {...object,body:await readFile(path(key))}},async list({cursor}){await mkdir(root,{recursive:true});const files=(await readdir(root)).filter(p=>p.endsWith('.bin.json')).sort();const start=Number(cursor)||0,objects=[];for(const file of files.slice(start,start+100)){const m=await head('maps/'+file.slice(0,-5));if(m)objects.push(m)}return {objects,truncated:start+100<files.length,cursor:String(start+100)}},async put(key,body,options){await mkdir(root,{recursive:true});const bytes=Buffer.from(await new Response(body).arrayBuffer());if(createHash('sha256').update(bytes).digest('hex')!==options.sha256)throw Error('Checksum mismatch');if(await head(key))return null;const object={key,size:bytes.length,uploaded:new Date(),customMetadata:options.customMetadata,httpEtag:'"'+options.sha256+'"'};await writeFile(path(key),bytes);await writeFile(path(key)+'.json',JSON.stringify(object));return object}};
}

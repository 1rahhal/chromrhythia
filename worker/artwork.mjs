import {inflateSync} from 'fflate';

const MAX_IMAGE=8*1024*1024,MAX_DIRECTORY=1024*1024;
const decoder=new TextDecoder();
const u16=(b,p)=>new DataView(b.buffer,b.byteOffset,b.byteLength).getUint16(p,true);
const u32=(b,p)=>new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(p,true);
function u64(b,p){const n=Number(new DataView(b.buffer,b.byteOffset,b.byteLength).getBigUint64(p,true));if(!Number.isSafeInteger(n))throw Error('Invalid artwork offset');return n}
export function imageType(b){
  if(b.length>=8&&b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71&&b[4]===13&&b[5]===10&&b[6]===26&&b[7]===10)return 'image/png';
  if(b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';
  if(b.length>=12&&decoder.decode(b.subarray(0,4))==='RIFF'&&decoder.decode(b.subarray(8,12))==='WEBP')return 'image/webp';
  if(b.length>=6&&/^GIF8[79]a$/.test(decoder.decode(b.subarray(0,6))))return 'image/gif';
}

// Pull only the image entry/header from R2. Audio never enters the Worker heap.
export async function extractArtwork(read,size){
  const range=async(offset,length)=>{if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||offset<0||length<0||offset+length>size)throw Error('Artwork range is outside map');return read(offset,length)};
  const first=await range(0,Math.min(size,128));
  if(first.length>=6&&decoder.decode(first.subarray(0,4))==='SS+m'){
    const version=u16(first,4);
    if(version===2){if(first.length<96)throw Error('Truncated SSPM artwork header');if(!first[46])return;const offset=u64(first,80),length=u64(first,88);if(!length)return;if(length>MAX_IMAGE)throw Error('Embedded artwork is too large');const bytes=await range(offset,length);return imageType(bytes)?bytes:undefined}
    if(version===1){
      const header=await range(0,Math.min(size,65536));let at=8;
      for(let i=0;i<3;i++){while(at<header.length&&header[at]!==10)at++;if(at===header.length)throw Error('SSPM artwork metadata is too long');at++}
      at+=9;if(at>=header.length)throw Error('Truncated SSPM artwork header');const type=header[at++];
      if(type===0||type===1)return; // Legacy raw pixels have no portable encoded image.
      if(type!==2||at+8>header.length)throw Error('Invalid SSPM artwork type');const length=u64(header,at);at+=8;if(length>MAX_IMAGE)throw Error('Embedded artwork is too large');const bytes=await range(at,length);return imageType(bytes)?bytes:undefined;
    }
    return;
  }
  if(first.length<4||u32(first,0)!==0x04034b50)return;
  const tailLength=Math.min(size,65557),tail=await range(size-tailLength,tailLength);let eocd=-1;
  for(let p=tail.length-22;p>=0;p--)if(u32(tail,p)===0x06054b50&&p+22+u16(tail,p+20)===tail.length){eocd=p;break}
  if(eocd<0)throw Error('ZIP artwork directory missing');
  const entries=u16(tail,eocd+10),directoryLength=u32(tail,eocd+12),directoryOffset=u32(tail,eocd+16);
  if(u16(tail,eocd+4)||u16(tail,eocd+6)||entries>10000||directoryLength>MAX_DIRECTORY||directoryOffset===0xffffffff)throw Error('Unsupported ZIP artwork directory');
  const directory=await range(directoryOffset,directoryLength),files=[];let at=0;
  for(let i=0;i<entries;i++){
    if(at+46>directory.length||u32(directory,at)!==0x02014b50)throw Error('Invalid ZIP artwork entry');
    const nameLength=u16(directory,at+28),extra=u16(directory,at+30),comment=u16(directory,at+32),end=at+46+nameLength+extra+comment;
    if(end>directory.length)throw Error('Truncated ZIP artwork entry');
    files.push({name:decoder.decode(directory.subarray(at+46,at+46+nameLength)).replaceAll('\\','/'),flags:u16(directory,at+8),method:u16(directory,at+10),compressed:u32(directory,at+20),size:u32(directory,at+24),offset:u32(directory,at+42)});at=end;
  }
  const basename=name=>name.toLowerCase().split('/').pop();
  async function entry(file,limit){
    if(!file||file.size>limit||file.compressed>limit||file.flags&1||![0,8].includes(file.method))throw Error('Unsupported or oversized artwork entry');
    const header=await range(file.offset,30);if(u32(header,0)!==0x04034b50)throw Error('Invalid local artwork entry');
    const offset=file.offset+30+u16(header,26)+u16(header,28),compressed=await range(offset,file.compressed);
    const bytes=file.method===0?compressed:inflateSync(compressed,{out:new Uint8Array(file.size)});if(bytes.length!==file.size)throw Error('Invalid artwork size');return bytes;
  }
  let image=files.find(f=>/^(?:cover|cover\.(?:png|jpe?g|webp|gif))$/.test(basename(f.name)));
  if(!image){
    const metadata=files.find(f=>['map','metadata.json'].includes(basename(f.name)));
    if(metadata){const data=JSON.parse(decoder.decode(await entry(metadata,MAX_DIRECTORY))),path=data.ImagePath||data.CoverPath||data.CoverFileName;
      if(typeof path==='string'){const normalized=path.replaceAll('\\','/').replace(/^\.\//,'').toLowerCase();image=files.find(f=>f.name.toLowerCase()===normalized)||files.find(f=>basename(f.name)===basename(normalized))}}
  }
  if(!image)return;const bytes=await entry(image,MAX_IMAGE);return imageType(bytes)?bytes:undefined;
}

const pending=new WeakMap();
export async function recoverCover(bucket,key,id){
  let jobs=pending.get(bucket);if(!jobs){jobs=new Map();pending.set(bucket,jobs)}if(jobs.has(id))return jobs.get(id);
  const job=(async()=>{
    const map=await bucket.head(key);if(!map)return;
    const bytes=await extractArtwork(async(offset,length)=>{
      if(!length)return new Uint8Array();const object=await bucket.get(key,{range:{offset,length}});if(!object)throw Error('Map disappeared during artwork recovery');
      const body=new Uint8Array(await new Response(object.body).arrayBuffer());
      // Development adapters may ignore ranges; never needed for hosted R2.
      return body.length===map.size&&body.length!==length?body.slice(offset,offset+length):body;
    },map.size);
    const coverKey=`covers/${id}.image`;
    await bucket.put(coverKey,bytes||new Uint8Array(),{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:bytes?imageType(bytes):'application/octet-stream'},customMetadata:{artworkVersion:'2',source:bytes?'embedded':'absent'}});
    return bucket.get(coverKey);
  })();jobs.set(id,job);try{return await job}finally{jobs.delete(id)}
}

import {build} from 'esbuild';
import {readFile,writeFile,mkdir,cp,readdir,stat,rm} from 'node:fs/promises';
import {randomBytes,pbkdf2Sync,createCipheriv,createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {resolve,relative,join,sep} from 'node:path';
import {zipSync,strToU8} from 'fflate';
export const ITERATIONS=600000;
export function encryptBundle(bytes,password){const salt=randomBytes(16),iv=randomBytes(12),key=pbkdf2Sync(password,salt,ITERATIONS,32,'sha256');const cipher=createCipheriv('aes-256-gcm',key,iv);const payload=Buffer.concat([cipher.update(bytes),cipher.final(),cipher.getAuthTag()]);return {payload,config:{version:1,iterations:ITERATIONS,salt:salt.toString('base64'),iv:iv.toString('base64')}}}
export async function buildSite(){
  const target=resolve('dist');if(!target.startsWith(resolve('.')+sep)||target!==join(resolve('.'),'dist'))throw Error('Invalid build target');await rm(target,{recursive:true,force:true});
  await mkdir('dist',{recursive:true});await mkdir('.local',{recursive:true});let password=process.env.GAME_PASSWORD;
  if(process.env.CI&&!password)throw Error('Set the GAME_PASSWORD repository secret before publishing. No default password is allowed in CI.');
  if(!password){try{password=(await readFile('.local/access-key.txt','utf8')).trim()}catch{password=randomBytes(24).toString('base64url');await writeFile('.local/access-key.txt',password+'\n',{mode:0o600})}}
  if(password.length<12)throw Error('Use a password of at least 12 characters');
  await cp('public','dist',{recursive:true,filter:p=>!p.endsWith('.ttf')});await cp('src/style.css','dist/style.css');await cp('LICENSE','dist/LICENSE');
  const result=await build({entryPoints:['src/app.ts'],bundle:true,minify:true,write:false,format:'iife',target:['chrome110'],legalComments:'eof'});
  const {payload,config}=encryptBundle(gzipSync(result.outputFiles[0].contents,{level:9}),password);const version=createHash('sha256').update(payload).digest('hex').slice(0,16);config.payload='game.'+version+'.bin';config.compression='gzip';await writeFile('dist/'+config.payload,payload);await writeFile('dist/unlock.json',JSON.stringify(config));
  const css='style.'+version+'.css',unlock='unlock.'+version+'.js';await cp('src/style.css','dist/'+css);await cp('public/unlock.js','dist/'+unlock);const html=(await readFile('public/index.html','utf8')).replace('style.css',css).replace('unlock.js',unlock);await writeFile('dist/index.html',html);
  const source={};async function collect(path){for(const entry of await readdir(path,{withFileTypes:true})){const full=join(path,entry.name),rel=relative('.',full).replaceAll('\\','/');if(entry.name==='node_modules'||entry.name==='dist'||entry.name==='docs'||entry.name==='.git'||entry.name==='.local'||entry.name==='.cache'||entry.name.startsWith('.env'))continue;if(entry.isDirectory())await collect(full);else if(entry.isFile())source[rel]=new Uint8Array(await readFile(full))}}
  await collect('.');await writeFile('dist/source.zip',zipSync(source));
  const sourceInfo='Chromrhythia — current-rewrite browser port in development\n\nCorresponding source for this build: source.zip\nLicense: LICENSE (GNU AGPL version 3)\nUpstream: https://github.com/Rhythia/Client\nPinned upstream: 9200e16441c94f0cffca8ee10beb4e889235c56a\nModified port: browser-native TypeScript, Three.js and Web Audio; see README.md and PORT_STATUS.md in source.zip.\nAll passwords, personal maps, scores and replays are excluded from the source archive.\n';await writeFile('dist/SOURCE.txt',sourceInfo);
  const core=['./','index.html',css,unlock,'unlock.json',config.payload];for(const name of await readdir('dist/assets'))core.push('assets/'+name);
  let sw=await readFile('public/sw.js','utf8');sw=sw.replace('__VERSION__',version).replace('__CORE__',JSON.stringify(core));await writeFile('dist/sw.js',sw);
  console.log(`Built compressed, encrypted game (${Math.round(payload.length/1024)} KB). Password stays in .local/access-key.txt unless GAME_PASSWORD was supplied. Offline cache and source archive included.`);
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename))await buildSite();

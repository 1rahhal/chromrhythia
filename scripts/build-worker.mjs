import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {join,extname,relative} from 'node:path';
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.obj':'text/plain; charset=utf-8','.mp3':'audio/mpeg','.zip':'application/zip','.txt':'text/plain; charset=utf-8'};
const assets={};async function collect(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name),name=relative('dist',path).replaceAll('\\','/');if(entry.name==='.openai'||entry.name==='server')continue;if(entry.isDirectory())await collect(path);else{const bytes=await readFile(path);assets[name]={base64:bytes.toString('base64'),type:types[extname(name)]||'application/octet-stream',etag:'"'+createHash('sha256').update(bytes).digest('hex')+'"'}}}}
await collect('dist');await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});await writeFile('.cache/worker-entry.mjs',`import {worker} from '../worker/index.mjs';export default worker(${JSON.stringify(assets)});`);
await build({entryPoints:['.cache/worker-entry.mjs'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'dist/server/index.js',minify:true});await writeFile('dist/.openai/hosting.json',await readFile('.openai/hosting.json'));
console.log('Built cloud Worker with R2 shared-library API.');

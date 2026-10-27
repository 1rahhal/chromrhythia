import {api} from './api.mjs';
// __STATIC_ASSETS__ is supplied by scripts/build-worker.mjs; files stay in source.
export function worker(assets){return {async fetch(request,env,ctx){const url=new URL(request.url);if(url.pathname.startsWith('/api/'))return api(request,env);
  const path=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));const asset=assets[path];if(!asset)return new Response('Not found',{status:404});
  const headers={'content-type':asset.type,'x-content-type-options':'nosniff','referrer-policy':'same-origin','cache-control':path==='sw.js'||path==='index.html'||path==='unlock.json'?'no-cache':'public, max-age=31536000, immutable'};
  if(path==='sw.js')headers['service-worker-allowed']='/';
  if(request.headers.get('if-none-match')===asset.etag)return new Response(null,{status:304,headers});headers.etag=asset.etag;
  if(request.method==='HEAD')return new Response(null,{headers});if(request.method!=='GET')return new Response('Method not allowed',{status:405});
  return new Response(Uint8Array.from(atob(asset.base64),c=>c.charCodeAt(0)),{headers});
}}}

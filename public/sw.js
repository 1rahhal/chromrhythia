const CACHE='chromrhythia-__VERSION__';
const CORE=__CORE__;
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE.map(path=>new Request(path,{cache:'no-cache'})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('chromrhythia-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==location.origin||url.pathname.includes('/api/'))return;
  const name=url.pathname.slice(new URL(self.registration.scope).pathname.length);if(name==='source.zip'||name==='SOURCE.txt'||name==='LICENSE')return;
  // Core assets are atomic per build. No external CDN or install-time dependencies.
  event.respondWith(caches.open(CACHE).then(async cache=>{const cached=await cache.match(request,{ignoreSearch:true});if(cached)return cached;const response=await fetch(request);if(response.ok)await cache.put(request,response.clone());return response}));
});

const CACHE='chromrhythia-__VERSION__';
const CORE=__CORE__;
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE.map(path=>new Request(path,{cache:'no-cache'})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>{const builds=keys.filter(k=>k.startsWith('chromrhythia-')&&k!==CACHE),previous=builds.at(-1);return Promise.all(builds.filter(k=>k!==previous).map(k=>caches.delete(k)))}).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==location.origin||url.pathname.includes('/api/'))return;
  const name=url.pathname.slice(new URL(self.registration.scope).pathname.length);if(name==='source.zip'||name==='SOURCE.txt'||name==='LICENSE')return;
  // Refresh the shell online; its CSS, loader, manifest and payload share a build ID.
  // Keep the previous core cache for pages that were already open during an update.
  event.respondWith(caches.open(CACHE).then(async cache=>{
    if(request.mode==='navigate'||name===''||name==='index.html'){
      try{const response=await fetch(new Request(request,{cache:'no-cache',signal:AbortSignal.timeout(3000)}));if(!response.ok)throw Error('Shell unavailable');await cache.put(request,response.clone());return response}
      catch(error){const cached=await cache.match(request,{ignoreSearch:true})||await cache.match(new URL('index.html',self.registration.scope));if(cached)return cached;throw error}
    }
    const cached=await cache.match(request,{ignoreSearch:true})||await caches.match(request,{ignoreSearch:true});if(cached)return cached;
    const response=await fetch(request);if(response.ok)await cache.put(request,response.clone());return response;
  }));
});

importScripts('./assets/js/offline-assets.js');
const CACHE='climblog-shell-20261120-native-gif-home-'+self.registration.scope;
const SHELL=['./','./index.html','./config.js','./manifest.webmanifest',...self.climbLogOfflineAssets];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL))));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('climblog-shell-')&&key.endsWith(self.registration.scope)&&key!==CACHE).map(key=>caches.delete(key)))),self.clients.claim()])));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url),scope=new URL(self.registration.scope);if(event.request.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname)||url.search||event.request.headers.has('Authorization'))return;const relative=url.pathname.slice(scope.pathname.length);if(!(event.request.mode==='navigate'||/^(assets\/(js|css|icons|images)\/|config\.js$|manifest\.webmanifest$)/.test(relative)))return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE),cached=await cache.match(event.request);if(cached)return cached;
  try{const response=await fetch(new Request(event.request,{cache:'no-cache'}));if(response.ok&&response.type==='basic')event.waitUntil(cache.put(event.request,response.clone()));return response;}
  catch(error){if(event.request.mode==='navigate'){const page=await cache.match('./index.html');if(page)return page;}throw error;}
 })());});

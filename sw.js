/* 工程チェックリスト Service Worker
   - オフラインキャッシュ（アプリシェル）
   - Web Push 受信 → 通知表示 → タップで該当物件を開く
   UIを変えたら CACHE_VERSION を必ず上げる。 */
var CACHE_VERSION = "kc-v2";
var SHELL = ["./","index.html","app.js","manifest.json","icon-180.png","icon-192.png","icon-512.png"];

self.addEventListener("install", function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_VERSION).then(function(c){ return c.addAll(SHELL).catch(function(){}); }));
});
self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.map(function(k){ if(k!==CACHE_VERSION) return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

/* ネット優先→失敗でキャッシュ（データは常に最新を取りに行く／オフラインでも起動できる） */
self.addEventListener("fetch", function(e){
  var req=e.request;
  if(req.method!=="GET"){ return; }
  e.respondWith(
    fetch(req).then(function(res){
      var copy=res.clone();
      caches.open(CACHE_VERSION).then(function(c){ c.put(req, copy).catch(function(){}); });
      return res;
    }).catch(function(){ return caches.match(req).then(function(m){ return m || caches.match("index.html"); }); })
  );
});

/* Web Push 受信 */
self.addEventListener("push", function(e){
  var data={};
  try{ data=e.data.json(); }catch(err){ data={ title:"矢橋林業チェックリスト", body:(e.data&&e.data.text())||"" }; }
  var title=data.title||"矢橋林業チェックリスト";
  var opts={
    body:data.body||"",
    icon:"icon-192.png",
    badge:"icon-192.png",
    tag:data.tag||undefined,
    data:{ url:data.url||"./" }
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

/* 通知タップ → 該当画面へ */
self.addEventListener("notificationclick", function(e){
  e.notification.close();
  var url=(e.notification.data&&e.notification.data.url)||"./";
  e.waitUntil(clients.matchAll({type:"window", includeUncontrolled:true}).then(function(list){
    for(var i=0;i<list.length;i++){ if(list[i].url.indexOf(url)>=0 && "focus" in list[i]) return list[i].focus(); }
    if(clients.openWindow) return clients.openWindow(url);
  }));
});

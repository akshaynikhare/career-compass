var CACHE = 'career-compass-v1';
var ASSETS = [
  '/',
  '/index.html',
  '/test.html',
  '/result.html',
  '/explore.html',
  '/timeline.html',
  '/deepdive.html',
  '/result2.html',
  '/styles/main.css',
  '/src/config.js',
  '/src/match.js',
  '/src/store.js',
  '/src/app.js',
  '/src/render.js',
  '/src/deep_dive_engine.js',
  '/src/deepdive_app.js',
  '/src/path_parse.js',
  '/src/timeline.js',
  '/src/explore.js',
  '/src/share_card.js',
  '/src/i18n.js',
  '/data/questions.json',
  '/data/professions.json',
  '/data/riasec_edges.json',
  '/data/profession_tags.json',
  '/data/deep_dive_questions.json',
  '/data/riasec_people.json'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(ASSETS.map(function(url) {
        return new Request(url, { cache: 'reload' });
      })).catch(function() {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) return cached;
      return fetch(e.request).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE).then(function(cache) { cache.put(e.request, clone); });
        }
        return response;
      }).catch(function() { return caches.match('/index.html'); });
    })
  );
});

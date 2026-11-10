// 数学消消乐 Service Worker (Offline Support) — PWA 网站版专用
// 本文件为模板：构建时 vite.config.ts 会把下方的预缓存清单占位符替换为全部构建产物清单，
// 并把缓存版本占位符替换为版本号，输出到 dist/sw.js。
// 单文件 HTML 离线版不会注册 Service Worker。
const CACHE_NAME = 'anna-math-cache-2.3.0-levels-859ed44ca3';
const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/favicon.svg",
  "/icons.svg",
  "/manifest.json",
  "/assets/index-2_2UvlOz.js",
  "/assets/index-0siVSk6-.css",
  "/src/new-levels.mjs"
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // cache: 'reload' 绕过 HTTP 缓存，确保缓存的是当前版本的完整文件
      return cache.addAll(PRECACHE_ASSETS.map((url) => new Request(url, { cache: 'reload' })));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key.startsWith('anna-math-cache-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // 安装新缓存时使用 cache:'reload'。这里若仍返回旧缓存，已安装访客会把旧文件写进新缓存。
  if (event.request.cache === 'reload') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // 页面导航：网络优先（便于更新），断网时回退到缓存的 index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match('/index.html')) || (await cache.match('/')) ||
            new Response('Offline', { status: 503, statusText: 'Offline' });
        })
    );
    return;
  }

  // 静态资源（带 hash 文件名，内容不可变）：缓存优先，未命中再走网络并写入缓存
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => new Response('Network error (Offline)', { status: 503, statusText: 'Offline' }));
    })
  );
});

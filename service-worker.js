// Frutti Service Worker
// キャッシュ戦略: Cache First（キャッシュ優先、なければネットワーク）
// JSONは Network First（新鮮さ優先、失敗したらキャッシュ）

const CACHE_VERSION = 'frutti-v1';
const CACHE_NAME = CACHE_VERSION;

// 初回インストール時にキャッシュするファイル
const CORE_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './bgm.mp3',
  './bgm-title.mp3',
  './bgm-zukan.mp3',
  './bgm-spring.mp3',
  './bgm-summer.mp3',
  './bgm-autumn.mp3',
  './bgm-winter.mp3',
  './variety_images.json'
];

// インストール時：コアファイルをキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // 1つずつ追加して、失敗してもインストールは続行
        return Promise.all(
          CORE_FILES.map((url) =>
            cache.add(url).catch((err) => {
              console.warn('Cache add failed:', url, err);
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// アクティベート時：古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// フェッチ時：キャッシュ優先、なければネットワーク
self.addEventListener('fetch', (event) => {
  // GETリクエスト以外はキャッシュしない
  if (event.request.method !== 'GET') return;

  // 他ドメインは無視（Google Fontsなどは通常通り）
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // バックグラウンドで更新もかける（Stale-While-Revalidate）
        fetch(event.request)
          .then((response) => {
            if (response && response.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, response);
              });
            }
          })
          .catch(() => {});
        return cached;
      }

      // キャッシュになければネットワーク
      return fetch(event.request).then((response) => {
        // 成功したレスポンスをキャッシュに追加
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(() => {
        // オフラインでキャッシュもない場合はエラー
        return new Response('オフラインです', {
          status: 503,
          statusText: 'Service Unavailable',
        });
      });
    })
  );
});

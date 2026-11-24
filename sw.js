/* Службовий скрипт: дає застосунку працювати без інтернету.
   Змінюй CACHE_VERSION, коли оновлюєш файли — тоді телефон підхопить нову версію. */

const CACHE_VERSION = "biblioteka-v5";
const COVER_CACHE = "biblioteka-covers-v1";
const COVER_HOSTS = ["covers.openlibrary.org", "books.google.com", "books.googleusercontent.com", "upload.wikimedia.org"];
const CORE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./fonts.css",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-192.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
  "./favicon.png",
  "./owl-spring.png",
  "./owl-summer.png",
  "./owl-autumn.png",
  "./owl-winter.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION && k !== COVER_CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const isFont = url.hostname.includes("fonts.googleapis.com") ||
                 url.hostname.includes("fonts.gstatic.com");

  // Обкладинки книжок: раз завантажили — лишаються доступними без інтернету
  if (COVER_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.open(COVER_CACHE).then(cache =>
        cache.match(req).then(hit => hit || fetch(req).then(res => {
          if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
          return res;
        }))
      ).catch(() => Response.error())
    );
    return;
  }

  // Пошук у базі книжок завжди йде в мережу, не з кешу
  if (["www.googleapis.com", "openlibrary.org", "uk.wikipedia.org", "www.wikidata.org"].includes(url.hostname)) return;

  // Шрифти: спершу з кешу, у фоні оновлюємо
  if (isFont) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(cache =>
        cache.match(req).then(hit => {
          const network = fetch(req).then(res => {
            if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
            return res;
          }).catch(() => hit);
          return hit || network;
        })
      )
    );
    return;
  }

  // Свої файли: спершу мережа, при відсутності інтернету — кеш
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.ok && url.origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then(hit => hit || caches.match("./index.html"))
      )
  );
});

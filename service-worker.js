const CACHE = "pepper-static-v33";
const CORE = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./ui.css",
  "./assets/apple-touch-icon.png",
  "./lib/gemini-api.mjs",
  "./lib/i18n-en.mjs",
  "./manifest.webmanifest",
  "./assets/chili.svg",
  "./assets/jalap.svg",
  "./assets/pepper-favicon.svg"
];
const STATIC_PATHS = ["/PEPPER/", "/PEPPER/index.html", "/PEPPER/styles.css", "/PEPPER/ui.css", "/PEPPER/app.js", "/PEPPER/assets/apple-touch-icon.png", "/PEPPER/lib/gemini-api.mjs", "/PEPPER/lib/i18n-en.mjs", "/PEPPER/manifest.webmanifest", "/PEPPER/assets/chili.svg", "/PEPPER/assets/jalap.svg", "/PEPPER/assets/pepper-favicon.svg"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
      .then(() => self.registration.navigationPreload?.enable?.().catch(() => {}))
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request) || await cache.match("./index.html");
    if (cached) return cached;
    throw error;
  }
}

async function staticFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request).then(async response => {
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || await network || Response.error();
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }
  // Le code (JS/CSS/modules) passe d'abord par le réseau : une mise en ligne est visible dès le rechargement.
  if (/\.(?:m?js|css)$/.test(url.pathname)) {
    event.respondWith(networkFirst(request));
    return;
  }
  if (STATIC_PATHS.includes(url.pathname) || url.pathname.endsWith(".js") || url.pathname.endsWith(".css") || url.pathname.endsWith(".svg")) {
    event.respondWith(staticFirst(request));
  }
});

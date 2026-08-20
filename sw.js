const CACHE_VERSION = "neon-embers-v15-room-stage-separation";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./assets/icon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable-512.png",
  "./assets/items/energy-sword.png",
  "./assets/items/rail-pistol.png",
  "./assets/items/energy-core.png",
  "./assets/items/power-hammer.png",
  "./assets/items/phase-twin-blades.png",
  "./assets/items/phase-blade.png",
  "./assets/players/hunter-core.png",
  "./assets/players/storm-core.png",
  "./assets/players/bastion-core.png",
  "./assets/enemies/melee-drone.png",
  "./assets/enemies/ranged-drone.png",
  "./assets/enemies/brute-drone.png",
  "./assets/enemies/shield-drone.png",
  "./assets/enemies/elite-drone.png",
  "./assets/enemies/boss-drone.png",
  "./assets/world/arena-pylon.png",
  "./assets/audio/swing-whoosh-1.wav",
  "./assets/audio/swing-whoosh-2.wav",
  "./assets/audio/bullet-impact.wav",
  "./assets/audio/body-hit-1.ogg",
  "./assets/audio/body-hit-2.ogg",
  "./assets/audio/body-hit-3.ogg",
  "./assets/audio/heavy-hit-1.ogg",
  "./assets/audio/heavy-hit-2.ogg",
  "./assets/audio/metal-block-1.ogg",
  "./assets/audio/metal-block-2.ogg",
  "./assets/audio/mechanism-1.ogg",
  "./assets/audio/mechanism-2.ogg",
  "./src/ad-service.js",
  "./src/audio.js",
  "./src/config.js",
  "./src/game.js",
  "./src/main.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
      }
      return response;
    }))
  );
});

const CACHE_PREFIX = "neon-embers-";
const ASSET_REVISION = "74bfda676dbb";
const CACHE_VERSION = `${CACHE_PREFIX}${ASSET_REVISION}`;
const versioned = (path) => `${path}?v=${ASSET_REVISION}`;

const CORE_SHELL = [
  "./",
  "./index.html",
  versioned("./styles.css"),
  versioned("./manifest.webmanifest"),
  versioned("./assets/icon.svg"),
  versioned("./assets/icon-192.png"),
  versioned("./assets/icon-512.png"),
  versioned("./assets/icon-maskable-512.png"),
  versioned("./src/revision.js"),
  versioned("./src/ad-service.js"),
  versioned("./src/audio.js"),
  versioned("./src/config.js"),
  versioned("./src/game.js"),
  versioned("./src/main.js"),
];

const ASSET_SHELL = [
  versioned("./assets/items/energy-sword.png"),
  versioned("./assets/items/rail-pistol.png"),
  versioned("./assets/items/energy-core.png"),
  versioned("./assets/items/power-hammer.png"),
  versioned("./assets/items/phase-twin-blades.png"),
  versioned("./assets/items/phase-blade.png"),
  versioned("./assets/players/hunter-core.png"),
  versioned("./assets/players/storm-core.png"),
  versioned("./assets/players/bastion-core.png"),
  versioned("./assets/enemies/melee-drone.png"),
  versioned("./assets/enemies/ranged-drone.png"),
  versioned("./assets/enemies/brute-drone.png"),
  versioned("./assets/enemies/shield-drone.png"),
  versioned("./assets/enemies/elite-drone.png"),
  versioned("./assets/enemies/boss-drone.png"),
  versioned("./assets/world/arena-pylon.png"),
  versioned("./assets/effects/slash-arc.png"),
  versioned("./assets/effects/bullet-impact.png"),
  versioned("./assets/effects/block-shield.png"),
  versioned("./assets/effects/dash-streak.png"),
  versioned("./assets/effects/boss-burst.png"),
  versioned("./assets/audio/swing-whoosh-1.wav"),
  versioned("./assets/audio/swing-whoosh-2.wav"),
  versioned("./assets/audio/bullet-impact.wav"),
  versioned("./assets/audio/body-hit-1.ogg"),
  versioned("./assets/audio/body-hit-2.ogg"),
  versioned("./assets/audio/body-hit-3.ogg"),
  versioned("./assets/audio/heavy-hit-1.ogg"),
  versioned("./assets/audio/heavy-hit-2.ogg"),
  versioned("./assets/audio/metal-block-1.ogg"),
  versioned("./assets/audio/metal-block-2.ogg"),
  versioned("./assets/audio/mechanism-1.ogg"),
  versioned("./assets/audio/mechanism-2.ogg"),
];

const freshRequest = (path) => new Request(new URL(path, self.registration.scope), { cache: "reload" });

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await cache.addAll(CORE_SHELL.map(freshRequest));
    await Promise.allSettled(ASSET_SHELL.map(async (path) => {
      const request = freshRequest(path);
      const response = await fetch(request);
      if (!response.ok) throw new Error(`Unable to precache ${path}`);
      await cache.put(request, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_VERSION)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_VERSION);
      try {
        const response = await fetch(request, { cache: "reload" });
        if (response.ok) await cache.put(new URL("./index.html", self.registration.scope), response.clone());
        return response;
      } catch {
        return (await cache.match(new URL("./index.html", self.registration.scope))) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  })());
});

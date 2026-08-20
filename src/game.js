import { CORES, ENEMIES, GAME, MISSION_STAGES, ROOM_ITEMS, WEAPONS } from "./config.js?v=2d2113e208de";
import { audio } from "./audio.js?v=2d2113e208de";
import { assetUrl } from "./revision.js?v=2d2113e208de";

const TAU = Math.PI * 2;
const MAX_ASSET_LOAD_ATTEMPTS = 3;
const ASSET_RETRY_DELAY = 140;
const VFX_WARM_COLUMNS = 7;
const VFX_WARM_ROWS = 4;
const VFX_WARM_CELL_SIZE = 96;
const ARENA_CACHE_PADDING = 160;
const WEAPON_TIP_TRAIL_CAPACITY = 11;
const WEAPON_TIP_TRAIL_SAMPLE_INTERVAL = 1 / 90;
const WEAPON_TIP_TRAIL_LIFETIME = 0.17;
const WEAPON_TIP_TRAIL_HANDS = Object.freeze(["primary", "offhand"]);
const FILTERED_SPRITE_VARIANTS = Object.freeze({
  enemyHit: Object.freeze({ filter: "brightness(2.1) saturate(.35)", imageKeys: Object.freeze([
    "enemyMelee", "skitterDrone", "lancerDrone", "enemyRanged",
    "enemyBrute", "enemySentinel", "enemyElite", "enemyBoss",
  ]) }),
  playerSkill: Object.freeze({ filter: "brightness(1.35) saturate(1.18)", imageKeys: Object.freeze([
    "playerHunter", "playerStorm", "playerBastion",
  ]) }),
  playerDash: Object.freeze({ filter: "brightness(1.18)", imageKeys: Object.freeze([
    "playerHunter", "playerStorm", "playerBastion",
  ]) }),
});
const VFX_IMAGE_KEYS = Object.freeze([
  "guardField",
  "parryFlash",
  "guardBreak",
  "pulseWave",
  "overdriveAura",
  "barrierShell",
  "railRound",
  "enemyBolt",
  "bossBolt",
  "railMuzzle",
  "enemyMuzzle",
  "enemySwing",
  "attackTelegraph",
  "heavyTelegraph",
  "lancerTrail",
  "enemySpawn",
  "bladeHit",
  "twinHit",
  "hammerHit",
  "railHit",
  "guardHit",
  "barrierHit",
  "enemyDestroy",
  "pickupCollect",
  "enemyShield",
  "dashStreak",
  "bossBurst",
  "energySpark",
]);
const PLAYER_SPRITES = Object.freeze({
  hunter: "playerHunter",
  storm: "playerStorm",
  bastion: "playerBastion",
});
const PLAYER_SPRITE_SCALE = Object.freeze({
  hunter: 3.9,
  storm: 2.75,
  bastion: 2.45,
});
const ENEMY_SPRITES = Object.freeze({
  chaser: "enemyMelee",
  skitter: "skitterDrone",
  lancer: "lancerDrone",
  shooter: "enemyRanged",
  brute: "enemyBrute",
  sentinel: "enemySentinel",
  elite: "enemyElite",
  boss: "enemyBoss",
});
const ENEMY_SPRITE_SCALE = Object.freeze({
  chaser: 2.9,
  skitter: 3.05,
  lancer: 3,
  shooter: 3,
  brute: 2.75,
  sentinel: 3.1,
  elite: 3,
  boss: 2.65,
});
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, amount) => a + (b - a) * amount;
const distanceSquared = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const randomBetween = (min, max) => min + Math.random() * (max - min);
const VFX_KEYFRAMES = Object.freeze({
  burst: Object.freeze([
    { at: 0, scale: 0.24, alpha: 0, rotation: -0.08 },
    { at: 0.08, scale: 0.58, alpha: 0.88, rotation: -0.045 },
    { at: 0.18, scale: 0.9, alpha: 1, rotation: -0.018 },
    { at: 0.32, scale: 1.08, alpha: 0.94, rotation: 0.012 },
    { at: 0.48, scale: 1.18, alpha: 0.78, rotation: 0.038 },
    { at: 0.65, scale: 1.25, alpha: 0.56, rotation: 0.06 },
    { at: 0.82, scale: 1.31, alpha: 0.28, rotation: 0.078 },
    { at: 1, scale: 1.35, alpha: 0, rotation: 0.09 },
  ]),
  pulse: Object.freeze([
    { at: 0, scale: 0.18, alpha: 0, rotation: -0.03 },
    { at: 0.1, scale: 0.42, alpha: 0.72, rotation: -0.018 },
    { at: 0.22, scale: 0.67, alpha: 1, rotation: -0.006 },
    { at: 0.36, scale: 0.9, alpha: 0.92, rotation: 0.008 },
    { at: 0.52, scale: 1.08, alpha: 0.74, rotation: 0.02 },
    { at: 0.68, scale: 1.2, alpha: 0.52, rotation: 0.032 },
    { at: 0.84, scale: 1.28, alpha: 0.25, rotation: 0.042 },
    { at: 1, scale: 1.34, alpha: 0, rotation: 0.05 },
  ]),
  loop: Object.freeze([
    { at: 0, scale: 0.97, alpha: 0.7, rotation: -0.018 },
    { at: 0.14, scale: 1, alpha: 0.82, rotation: -0.01 },
    { at: 0.28, scale: 1.025, alpha: 0.92, rotation: 0 },
    { at: 0.42, scale: 1.045, alpha: 1, rotation: 0.012 },
    { at: 0.57, scale: 1.035, alpha: 0.94, rotation: 0.018 },
    { at: 0.71, scale: 1.012, alpha: 0.84, rotation: 0.008 },
    { at: 0.86, scale: 0.988, alpha: 0.76, rotation: -0.008 },
    { at: 1, scale: 0.97, alpha: 0.7, rotation: -0.018 },
  ]),
  travel: Object.freeze([
    { at: 0, scale: 0.92, alpha: 0.78, rotation: -0.018 },
    { at: 0.14, scale: 1.04, alpha: 1, rotation: -0.01 },
    { at: 0.28, scale: 1.1, alpha: 0.9, rotation: 0 },
    { at: 0.42, scale: 0.98, alpha: 0.82, rotation: 0.012 },
    { at: 0.57, scale: 0.9, alpha: 0.76, rotation: 0.018 },
    { at: 0.71, scale: 0.98, alpha: 0.86, rotation: 0.008 },
    { at: 0.86, scale: 1.08, alpha: 0.96, rotation: -0.008 },
    { at: 1, scale: 0.92, alpha: 0.78, rotation: -0.018 },
  ]),
  telegraphPulse8: Object.freeze([
    { at: 0, scale: 0.92, alpha: 0.24, rotation: -0.012 },
    { at: 0.14, scale: 0.95, alpha: 0.42, rotation: -0.008 },
    { at: 0.28, scale: 0.94, alpha: 0.31, rotation: -0.004 },
    { at: 0.42, scale: 0.98, alpha: 0.58, rotation: 0 },
    { at: 0.57, scale: 0.97, alpha: 0.44, rotation: 0.004 },
    { at: 0.71, scale: 1.01, alpha: 0.76, rotation: 0.008 },
    { at: 0.86, scale: 1, alpha: 0.62, rotation: 0.01 },
    { at: 1, scale: 1.04, alpha: 1, rotation: 0.012 },
  ]),
  heavyPulse10: Object.freeze([
    { at: 0, scale: 0.9, alpha: 0.2, rotation: -0.06 },
    { at: 0.11, scale: 0.94, alpha: 0.38, rotation: -0.048 },
    { at: 0.22, scale: 0.93, alpha: 0.28, rotation: -0.034 },
    { at: 0.33, scale: 0.97, alpha: 0.52, rotation: -0.02 },
    { at: 0.44, scale: 0.96, alpha: 0.4, rotation: -0.006 },
    { at: 0.56, scale: 1, alpha: 0.68, rotation: 0.01 },
    { at: 0.67, scale: 0.99, alpha: 0.54, rotation: 0.026 },
    { at: 0.78, scale: 1.03, alpha: 0.82, rotation: 0.04 },
    { at: 0.89, scale: 1.02, alpha: 0.7, rotation: 0.052 },
    { at: 1, scale: 1.06, alpha: 1, rotation: 0.064 },
  ]),
});
const formatTime = (seconds) => {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
};

function sampleKeyframes(frames, progress) {
  const position = clamp(progress, 0, 1);
  let previous = frames[0];
  for (let index = 1; index < frames.length; index += 1) {
    const next = frames[index];
    if (position <= next.at) {
      const span = Math.max(0.0001, next.at - previous.at);
      const amount = (position - previous.at) / span;
      return {
        scale: lerp(previous.scale, next.scale, amount),
        alpha: lerp(previous.alpha, next.alpha, amount),
        rotation: lerp(previous.rotation, next.rotation, amount),
      };
    }
    previous = next;
  }
  return { scale: previous.scale, alpha: previous.alpha, rotation: previous.rotation };
}

function normalized(x, y) {
  const length = Math.hypot(x, y);
  return length > 0.0001 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
}

function createWeaponTipTrail() {
  return {
    points: Array.from({ length: WEAPON_TIP_TRAIL_CAPACITY }, () => ({ x: 0, y: 0, age: Infinity, stroke: 0 })),
    start: 0,
    count: 0,
    stroke: 0,
    sampleTimer: WEAPON_TIP_TRAIL_SAMPLE_INTERVAL,
  };
}

function pointSegmentDistanceSquared(point, start, end) {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;
  if (lengthSquared < 0.0001) return distanceSquared(point, start);
  const projection = clamp(((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) / lengthSquared, 0, 1);
  const closestX = start.x + segmentX * projection;
  const closestY = start.y + segmentY * projection;
  return (point.x - closestX) ** 2 + (point.y - closestY) ** 2;
}

export class Game {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.callbacks = callbacks;
    this.settings = { volume: 0.5, musicVolume: 0.26, shake: true, reduceFlash: false };
    this.state = "menu";
    this.lastFrame = performance.now();
    this.view = { width: window.innerWidth, height: window.innerHeight, dpr: 1 };
    this.keys = new Set();
    this.touchVector = { x: 0, y: 0 };
    this.pointer = { x: window.innerWidth * 0.7, y: window.innerHeight * 0.5, active: false };
    this.camera = { x: GAME.width / 2, y: GAME.height / 2 };
    this.dashRequested = false;
    this.shake = 0;
    this.flash = 0;
    this.hudAccumulator = 0;
    this.menuStars = Array.from({ length: 74 }, () => ({
      x: Math.random(), y: Math.random(), size: randomBetween(0.5, 2.1), phase: Math.random() * TAU,
    }));
    this.images = {};
    this.filteredSprites = { enemyHit: {}, playerSkill: {}, playerDash: {} };
    this.patterns = new WeakMap();
    this.arenaCache = { canvas: null, key: "", pendingKey: "", ready: false, promise: null, generation: 0 };
    this.assetLoadState = { ready: false, loaded: 0, failed: [] };
    const assetEntries = Object.entries({
      guardField: "assets/effects/guard-field.png",
      parryFlash: "assets/effects/parry-flash.png",
      guardBreak: "assets/effects/guard-break.png",
      pulseWave: "assets/effects/pulse-wave.png",
      overdriveAura: "assets/effects/overdrive-aura.png",
      barrierShell: "assets/effects/barrier-shell.png",
      railRound: "assets/effects/rail-round.png",
      enemyBolt: "assets/effects/enemy-bolt.png",
      bossBolt: "assets/effects/boss-bolt.png",
      railMuzzle: "assets/effects/rail-muzzle.png",
      enemyMuzzle: "assets/effects/enemy-muzzle.png",
      enemySwing: "assets/effects/enemy-swing.png",
      attackTelegraph: "assets/effects/attack-telegraph.png",
      heavyTelegraph: "assets/effects/heavy-telegraph.png",
      lancerTrail: "assets/effects/lancer-trail.png",
      enemySpawn: "assets/effects/enemy-spawn.png",
      bladeHit: "assets/effects/blade-hit.png",
      twinHit: "assets/effects/twin-hit.png",
      hammerHit: "assets/effects/hammer-hit.png",
      railHit: "assets/effects/rail-hit.png",
      guardHit: "assets/effects/guard-hit.png",
      barrierHit: "assets/effects/barrier-hit.png",
      enemyDestroy: "assets/effects/enemy-destroy.png",
      pickupCollect: "assets/effects/pickup-collect.png",
      enemyShield: "assets/effects/enemy-shield.png",
      dashStreak: "assets/effects/dash-streak-hard.png",
      bossBurst: "assets/effects/boss-burst-hard.png",
      energySpark: "assets/effects/energy-spark.png",
      blade: WEAPONS.blade.asset,
      twin: WEAPONS.twin.asset,
      hammer: WEAPONS.hammer.asset,
      pistol: WEAPONS.rail.asset,
      energy: "assets/items/energy-core.png",
      playerHunter: CORES.hunter.bodyAsset,
      playerStorm: CORES.storm.bodyAsset,
      playerBastion: CORES.bastion.bodyAsset,
      enemyMelee: "assets/enemies/melee-drone.png",
      skitterDrone: "assets/enemies/skitter-drone.png",
      lancerDrone: "assets/enemies/lancer-drone.png",
      enemyRanged: "assets/enemies/ranged-drone.png",
      enemyBrute: "assets/enemies/brute-drone.png",
      enemySentinel: "assets/enemies/shield-drone.png",
      enemyElite: "assets/enemies/elite-drone.png",
      enemyBoss: "assets/enemies/boss-drone.png",
      floorRoom: "assets/world/room-floor.png",
      floorOuter: "assets/world/outer-floor.png",
      floorBlockade: "assets/world/blockade-floor.png",
      floorCore: "assets/world/core-floor.png",
      arenaBarrier: "assets/world/arena-barrier.png",
      arenaVent: "assets/world/arena-vent.png",
      terminal: "assets/world/energy-terminal.png",
      pylon: "assets/world/arena-pylon.png",
    });
    this.assetLoadState.total = assetEntries.length;
    this.vfxWarmState = { ready: false, warmed: 0, total: VFX_IMAGE_KEYS.length, failed: [] };
    this.filteredSpriteState = { ready: false, prepared: 0, total: 0, failed: [] };
    this.emitLoadProgress("images");
    this.assetsReady = Promise.all(assetEntries.map(([id, path]) => this.loadImageAsset(id, path)))
      .then(async () => {
        await this.prepareFilteredSprites();
        await this.warmFilteredSprites();
        await this.warmVfxImages();
        this.vfxWarmState.ready = true;
        this.assetLoadState.ready = true;
        this.emitLoadProgress("ready");
        return this.assetLoadState;
      });
    this.resize();
    this.bindInput();
    requestAnimationFrame((time) => this.frame(time));
  }

  loadImageAsset(id, path) {
    const image = new Image();
    image.decoding = "async";
    image.fetchPriority = id.startsWith("player") || ["guardField", "railRound", "enemyBolt", "dashStreak"].includes(id) ? "high" : "auto";
    this.images[id] = image;

    return new Promise((resolve) => {
      let attempts = 0;
      let settled = false;
      const finish = (loaded) => {
        if (settled) return;
        settled = true;
        if (loaded) this.assetLoadState.loaded += 1;
        else this.assetLoadState.failed.push(id);
        this.emitLoadProgress("images");
        resolve({ id, loaded });
      };
      const request = () => {
        attempts += 1;
        const retry = attempts > 1 ? `&retry=${attempts}` : "";
        image.src = `${assetUrl(path)}${retry}`;
      };
      image.addEventListener("load", async () => {
        if (typeof image.decode === "function") {
          try { await image.decode(); } catch {
            // A decoded image with valid dimensions is still safe for Canvas.
          }
        }
        finish(image.naturalWidth > 0);
      });
      image.addEventListener("error", () => {
        if (attempts < MAX_ASSET_LOAD_ATTEMPTS) {
          window.setTimeout(request, ASSET_RETRY_DELAY * attempts);
        } else {
          finish(false);
        }
      });
      request();
    });
  }

  emitLoadProgress(phase, phaseLoaded = null, phaseTotal = null) {
    try {
      this.callbacks.onLoadProgress?.({
        phase,
        loaded: this.assetLoadState.loaded,
        total: this.assetLoadState.total,
        failed: [...this.assetLoadState.failed],
        phaseLoaded,
        phaseTotal,
      });
    } catch {
      // Loading must continue even if an optional presentation callback fails.
    }
  }

  waitForAnimationFrames(count = 1) {
    return new Promise((resolve) => {
      let remaining = Math.max(1, count);
      const next = () => {
        remaining -= 1;
        if (remaining <= 0) {
          resolve();
          return;
        }
        if (typeof requestAnimationFrame === "function") requestAnimationFrame(next);
        else window.setTimeout(next, 16);
      };
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(next);
      else window.setTimeout(next, 16);
    });
  }

  markVfxWarmFailure(key) {
    if (!this.vfxWarmState.failed.includes(key)) this.vfxWarmState.failed.push(key);
  }

  async prepareFilteredSprites() {
    const jobs = Object.entries(FILTERED_SPRITE_VARIANTS)
      .flatMap(([variant, definition]) => definition.imageKeys.map((imageKey) => ({
        variant,
        imageKey,
        filter: definition.filter,
      })));
    this.filteredSpriteState.total = jobs.length;
    this.emitLoadProgress("sprite-filters", 0, jobs.length);
    for (let index = 0; index < jobs.length; index += 1) {
      const { variant, imageKey, filter } = jobs[index];
      const image = this.images[imageKey];
      let filtered = null;
      try {
        if (image?.complete && image.naturalWidth && image.naturalHeight) {
          const surface = document.createElement("canvas");
          surface.width = image.naturalWidth;
          surface.height = image.naturalHeight;
          const context = surface.getContext("2d");
          if (context) {
            context.filter = filter;
            context.drawImage(image, 0, 0);
            context.filter = "none";
            filtered = surface;
            if (typeof createImageBitmap === "function") {
              try { filtered = await createImageBitmap(surface); } catch {
                // The rendered canvas remains an exact visual fallback.
              }
            }
          }
        }
      } catch {
        filtered = null;
      }
      if (filtered) {
        this.filteredSprites[variant][imageKey] = filtered;
        this.filteredSpriteState.prepared += 1;
      } else {
        this.filteredSpriteState.failed.push(`${variant}:${imageKey}`);
      }
      this.emitLoadProgress("sprite-filters", index + 1, jobs.length);
      if ((index + 1) % 3 === 0) await this.waitForAnimationFrames(1);
    }
  }

  runFilteredSpriteWarmPass() {
    return new Promise((resolve) => {
      const drawGrid = () => {
        const context = this.ctx;
        if (!context) {
          resolve();
          return;
        }
        const sprites = Object.values(this.filteredSprites).flatMap((group) => Object.values(group));
        let saved = false;
        try {
          context.save();
          saved = true;
          if (typeof context.resetTransform === "function") context.resetTransform();
          else context.setTransform(1, 0, 0, 1, 0, 0);
          context.globalAlpha = 0.25;
          context.globalCompositeOperation = "source-over";
          context.shadowBlur = 0;
          context.filter = "none";
          const columns = 4;
          const rows = Math.max(1, Math.ceil(sprites.length / columns));
          const cellSize = Math.max(1, Math.min(
            112,
            Math.floor((this.canvas.width - 2) / columns),
            Math.floor((this.canvas.height - 2) / rows),
          ));
          const innerSize = Math.max(1, cellSize - 4);
          for (let index = 0; index < sprites.length; index += 1) {
            const sprite = sprites[index];
            const sourceWidth = sprite.naturalWidth || sprite.width;
            const sourceHeight = sprite.naturalHeight || sprite.height;
            if (!sourceWidth || !sourceHeight) continue;
            const scale = Math.min(innerSize / sourceWidth, innerSize / sourceHeight);
            const width = Math.max(1, sourceWidth * scale);
            const height = Math.max(1, sourceHeight * scale);
            const column = index % columns;
            const row = Math.floor(index / columns);
            const x = 1 + column * cellSize + (cellSize - width) / 2;
            const y = 1 + row * cellSize + (cellSize - height) / 2;
            context.drawImage(sprite, x, y, width, height);
          }
        } catch {
          // Runtime rendering can still use the original sprites if warmup fails.
        } finally {
          if (saved) {
            try { context.restore(); } catch {
              // The normal frame resets the transform and drawing state.
            }
          }
          resolve();
        }
      };
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(drawGrid);
      else window.setTimeout(drawGrid, 16);
    });
  }

  async warmFilteredSprites() {
    this.emitLoadProgress("sprite-warm", 0, 1);
    await this.runFilteredSpriteWarmPass();
    await this.waitForAnimationFrames(3);
    this.filteredSpriteState.ready = true;
    this.emitLoadProgress("sprite-warm", 1, 1);
  }

  runVfxWarmPass(composite, warmedKeys) {
    return new Promise((resolve) => {
      const drawGrid = () => {
        const context = this.ctx;
        if (!context) {
          for (const key of VFX_IMAGE_KEYS) this.markVfxWarmFailure(key);
          resolve();
          return;
        }
        let saved = false;
        try {
          context.save();
          saved = true;
          if (typeof context.resetTransform === "function") context.resetTransform();
          else context.setTransform(1, 0, 0, 1, 0, 0);
          context.globalAlpha = 0.25;
          context.globalCompositeOperation = composite;
          context.shadowBlur = 0;
          context.filter = "none";
          const cellSize = Math.max(1, Math.min(
            VFX_WARM_CELL_SIZE,
            Math.floor((this.canvas.width - 2) / VFX_WARM_COLUMNS),
            Math.floor((this.canvas.height - 2) / VFX_WARM_ROWS),
          ));
          const innerSize = Math.max(1, cellSize - 4);
          for (let index = 0; index < VFX_IMAGE_KEYS.length; index += 1) {
            const key = VFX_IMAGE_KEYS[index];
            const image = this.images[key];
            if (!image?.complete || !image.naturalWidth || !image.naturalHeight) {
              this.markVfxWarmFailure(key);
              continue;
            }
            try {
              const scale = Math.min(innerSize / image.naturalWidth, innerSize / image.naturalHeight);
              const width = Math.max(1, image.naturalWidth * scale);
              const height = Math.max(1, image.naturalHeight * scale);
              const column = index % VFX_WARM_COLUMNS;
              const row = Math.floor(index / VFX_WARM_COLUMNS);
              const x = 1 + column * cellSize + (cellSize - width) / 2;
              const y = 1 + row * cellSize + (cellSize - height) / 2;
              context.drawImage(image, x, y, width, height);
              warmedKeys.add(key);
            } catch {
              this.markVfxWarmFailure(key);
            }
          }
          if (composite === "screen") {
            const pulse = this.images.pulseWave;
            if (pulse?.complete && pulse.naturalWidth && pulse.naturalHeight) {
              const targetWidth = Math.max(1, Math.min(
                this.canvas.width - 2,
                this.canvas.height * pulse.naturalWidth / pulse.naturalHeight - 2,
                Math.ceil(540 * this.view.dpr),
              ));
              const targetHeight = targetWidth * pulse.naturalHeight / pulse.naturalWidth;
              context.drawImage(pulse, 1, 1, targetWidth, targetHeight);
              warmedKeys.add("pulseWave");
            }
          }
        } catch {
          // Main-canvas prewarm is optional; normal Image drawing remains the fallback.
          for (const key of VFX_IMAGE_KEYS) this.markVfxWarmFailure(key);
        } finally {
          if (saved) {
            try { context.restore(); } catch {
              // The next normal render resets the main transform and drawing state.
            }
          }
          resolve();
        }
      };
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(drawGrid);
      else window.setTimeout(drawGrid, 16);
    });
  }

  async warmVfxImages() {
    const warmedKeys = new Set();
    this.emitLoadProgress("vfx-source");
    await this.runVfxWarmPass("source-over", warmedKeys);
    this.emitLoadProgress("vfx-source");
    await this.waitForAnimationFrames(3);
    this.emitLoadProgress("vfx-lighter");
    await this.runVfxWarmPass("lighter", warmedKeys);
    this.emitLoadProgress("vfx-lighter");
    await this.waitForAnimationFrames(3);
    this.emitLoadProgress("vfx-screen");
    await this.runVfxWarmPass("screen", warmedKeys);
    this.emitLoadProgress("vfx-screen");
    await this.waitForAnimationFrames(3);
    this.vfxWarmState.warmed = warmedKeys.size;
  }

  bindInput() {
    window.addEventListener("resize", () => this.resize());
    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
      this.keys.add(key);
      if (event.repeat) return;
      if (key === "j") this.requestAttack();
      if (key === "k") this.setBlocking(true);
      if (key === "q") this.requestRanged();
      if (key === "e") this.requestSkill();
      if (key === " ") this.requestDash();
      if (key === "escape" || key === "p") this.togglePause();
    });
    window.addEventListener("keyup", (event) => {
      const key = event.key.toLowerCase();
      this.keys.delete(key);
      if (key === "k") this.setBlocking(false);
    });
    this.canvas.addEventListener("pointermove", (event) => {
      this.pointer.x = event.clientX;
      this.pointer.y = event.clientY;
      this.pointer.active = event.pointerType === "mouse" || event.pointerType === "pen";
    });
    this.canvas.addEventListener("pointerdown", (event) => {
      if (this.state !== "playing") return;
      audio.unlock();
      if (event.button === 0) this.requestAttack();
      if (event.button === 2) this.setBlocking(true);
    });
    window.addEventListener("pointerup", (event) => {
      if (event.button === 2) this.setBlocking(false);
    });
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    window.addEventListener("blur", () => {
      this.keys.clear();
      this.setTouchVector(0, 0);
      this.setBlocking(false);
      if (this.state === "playing") this.pause(false);
    });
  }

  resize() {
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    this.view = { width: window.innerWidth, height: window.innerHeight, dpr };
    this.canvas.width = Math.round(this.view.width * dpr);
    this.canvas.height = Math.round(this.view.height * dpr);
    this.canvas.style.width = `${this.view.width}px`;
    this.canvas.style.height = `${this.view.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.run && this.arenaCache) {
      this.invalidateArenaCache();
      this.arenaReady = this.prepareArenaCache();
    }
  }

  applySettings(settings) {
    this.settings = { ...this.settings, ...settings };
    audio.setVolume(this.settings.volume);
    audio.setMusicVolume(this.settings.musicVolume);
    audio.setEnabled(this.settings.volume > 0 || this.settings.musicVolume > 0);
  }

  setTouchVector(x, y) {
    this.touchVector = normalized(x, y);
  }

  setBlocking(active) {
    if (!this.player) return;
    const wasBlocking = this.player.blockHeld;
    this.player.blockHeld = Boolean(active);
    if (active && !wasBlocking && this.state === "playing" && this.canGuard()) {
      this.faceThreat();
      this.player.action = "block";
      this.player.parryTimer = this.player.stats.parryWindow;
    }
    if (!active && this.player.action === "block") this.player.action = "idle";
  }

  requestAttack() {
    if (this.state !== "playing" || !this.player) return;
    const player = this.player;
    if (player.action === "attack") {
      player.comboQueued = true;
      return;
    }
    if (["dash", "broken", "skill"].includes(player.action)) return;
    this.faceThreat();
    player.blockHeld = false;
    this.startAttack(0);
  }

  requestRanged() {
    if (this.state !== "playing" || !this.player) return;
    const player = this.player;
    if (["attack", "block", "dash", "broken", "skill"].includes(player.action) || player.rangedCooldown > 0 || player.reloadTimer > 0) return;
    if (player.ammo <= 0) {
      this.startReload();
      return;
    }
    this.faceThreat();
    const direction = { x: Math.cos(player.facing), y: Math.sin(player.facing) };
    const speed = WEAPONS.rail.speed;
    this.projectiles.push({
      x: player.x + direction.x * 30,
      y: player.y + direction.y * 30,
      vx: direction.x * speed,
      vy: direction.y * speed,
      radius: 4,
      life: 1.1,
      damage: WEAPONS.rail.damage * player.stats.rangedDamage,
      color: WEAPONS.rail.color,
      spriteKey: "railRound",
      animationPhase: Math.random(),
      hit: new Set(),
    });
    player.ammo -= 1;
    player.rangedCooldown = WEAPONS.rail.cooldown;
    player.rangedPoseTimer = 0.2;
    this.effects.push({ type: "railMuzzle", x: player.x + direction.x * 52, y: player.y + direction.y * 52, angle: player.facing, radius: 70, life: 0.14, maxLife: 0.14, color: WEAPONS.rail.color });
    audio.shoot("rail");
    if (player.ammo <= 0) this.startReload();
  }

  requestSkill() {
    if (this.state !== "playing" || !this.player || this.player.skillCooldown > 0) return;
    const player = this.player;
    if (["dash", "broken"].includes(player.action)) return;
    player.blockHeld = false;
    player.action = "skill";
    player.actionTimer = 0.34;
    const cooldown = 8 * player.stats.skillCooldown;
    player.skillCooldown = cooldown;
    if (this.run.core.skill === "pulseSlash") {
      for (const enemy of this.enemies) {
        const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
        if (!enemy.dead && distance <= 190 + enemy.radius) {
          const direction = normalized(enemy.x - player.x, enemy.y - player.y);
          this.damageEnemy(enemy, 58 * player.stats.meleeDamage, "skill", direction, 300);
        }
      }
      this.effects.push({ type: "pulseWave", x: player.x, y: player.y, angle: player.facing, radius: 390, life: 0.46, maxLife: 0.46, color: "#4df6ff" });
    } else if (this.run.core.skill === "overdrive") {
      player.overdrive = 5;
      this.effects.push({ type: "overdriveAura", x: player.x, y: player.y, angle: player.facing, radius: 148, life: 0.5, maxLife: 0.5, color: "#b77dff" });
    } else {
      player.barrier = Math.max(player.barrier, 55);
      this.effects.push({ type: "barrierShell", x: player.x, y: player.y, angle: player.facing, radius: 126, life: 0.54, maxLife: 0.54, color: "#ffcc66" });
    }
    audio.skill(this.run.core.skill);
    this.spawnBurst(player.x, player.y, this.run.core.color, 22, 210);
  }

  requestDash() {
    this.dashRequested = true;
  }

  start(coreId = "hunter", meta = {}) {
    audio.unlock();
    audio.startMusic();
    const core = CORES[coreId] || CORES.hunter;
    const maxHealth = 110 + (core.bonuses.health || 0) + Number(meta.armor || 0) * 8;
    const maxStamina = 100 + (core.bonuses.stamina || 0);
    this.run = {
      coreId: core.id,
      core,
      elapsed: 0,
      spawnTimer: 0.55,
      kills: 0,
      scrap: 0,
      energy: 25,
      energyEarned: 0,
      purchases: {},
      stageIndex: 0,
      pendingStageIndex: 0,
      stageQueue: [],
      stageDefeated: 0,
      mission: "ROOM",
      bossSpawned: false,
      boss: null,
      victory: false,
      metaRecovery: Number(meta.recovery || 0),
    };
    this.player = {
      x: GAME.width / 2,
      y: GAME.height / 2,
      radius: GAME.playerRadius,
      maxHealth,
      health: maxHealth,
      maxStamina,
      stamina: maxStamina,
      staminaDelay: 0,
      facing: 0,
      lastMove: { x: 1, y: 0 },
      action: "idle",
      actionTimer: 0,
      attackTimer: 0,
      attackDuration: 0,
      attackIndex: 0,
      attackHit: new Set(),
      comboQueued: false,
      blockHeld: false,
      parryTimer: 0,
      invulnerable: 0,
      dashTime: 0,
      dashCooldown: 0,
      dashVector: { x: 1, y: 0 },
      rangedCooldown: 0,
      rangedPoseTimer: 0,
      maxAmmo: WEAPONS.rail.ammo,
      ammo: WEAPONS.rail.ammo,
      reloadTimer: 0,
      skillCooldown: 0,
      barrier: 0,
      overdrive: 0,
      pulse: 0,
      stats: {
        meleeDamage: 1 + Number(meta.power || 0) * 0.04,
        rangedDamage: 1 + Number(meta.power || 0) * 0.04,
        swingArc: 1,
        attackSpeed: 1,
        speed: 1 + (core.bonuses.speed || 0),
        staminaRegen: 1,
        guardEfficiency: 1,
        parryWindow: 0.16,
        dashCooldown: 1,
        skillCooldown: 1,
        reload: 1,
      },
    };
    this.enemies = [];
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.pickups = [];
    this.particles = [];
    this.effects = [];
    this.weaponTipTrails = {
      primary: createWeaponTipTrail(),
      offhand: createWeaponTipTrail(),
    };
    this.damageTexts = [];
    this.decorations = Array.from({ length: 100 }, (_, index) => ({
      x: (index * 347.71) % GAME.width,
      y: (index * 613.37) % GAME.height,
      size: 2 + (index % 5),
      kind: index % 4,
      prop: index % 13 === 0,
    }));
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this.shake = 0;
    this.flash = 0;
    this.state = "room";
    this.arenaReady = this.prepareArenaCache();
    audio.pauseMusic();
    this.callbacks.onState?.("room");
    this.emitHud(true);
    this.callbacks.onRoom?.(this.getRoomState());
  }

  getRoomState() {
    if (!this.run || !this.player) return null;
    const stage = MISSION_STAGES[this.run.pendingStageIndex];
    const availability = {
      repair: this.player.health < this.player.maxHealth,
      ammo: this.player.ammo < this.player.maxAmmo,
      stamina: this.player.stamina < this.player.maxStamina,
      barrier: this.player.barrier < 80,
    };
    const reasons = {
      repair: "生命已满",
      ammo: "弹药已满",
      stamina: "体力已满",
      barrier: "护盾已满",
    };
    return {
      stage: { id: stage.id, name: stage.name, subtitle: stage.subtitle, boss: Boolean(stage.boss) },
      energy: this.run.energy,
      health: Math.ceil(this.player.health),
      maxHealth: Math.round(this.player.maxHealth),
      stamina: Math.ceil(this.player.stamina),
      maxStamina: Math.round(this.player.maxStamina),
      ammo: this.player.ammo,
      maxAmmo: this.player.maxAmmo,
      barrier: Math.ceil(this.player.barrier),
      items: ROOM_ITEMS.map((item) => ({
        ...item,
        available: availability[item.id],
        reason: availability[item.id] ? "" : reasons[item.id],
        purchased: this.run.purchases[item.id] || 0,
      })),
    };
  }

  purchaseRoomItem(itemId) {
    if (this.state !== "room") return { ok: false, message: "只能在整备房间购买" };
    const item = ROOM_ITEMS.find((candidate) => candidate.id === itemId);
    const room = this.getRoomState();
    const roomItem = room?.items.find((candidate) => candidate.id === itemId);
    if (!item || !roomItem) return { ok: false, message: "未找到该物品" };
    if (!roomItem.available) return { ok: false, message: roomItem.reason };
    if (this.run.energy < item.cost) return { ok: false, message: "任务能源不足" };

    this.run.energy -= item.cost;
    if (item.id === "repair") this.player.health = Math.min(this.player.maxHealth, this.player.health + item.amount);
    if (item.id === "ammo") {
      this.player.ammo = this.player.maxAmmo;
      this.player.reloadTimer = 0;
    }
    if (item.id === "stamina") {
      this.player.stamina = this.player.maxStamina;
      this.player.staminaDelay = 0;
    }
    if (item.id === "barrier") this.player.barrier = Math.min(80, this.player.barrier + item.amount);
    this.run.purchases[item.id] = (this.run.purchases[item.id] || 0) + 1;
    audio.pickup();
    this.emitHud(true);
    this.callbacks.onRoom?.(this.getRoomState());
    return { ok: true, message: `${item.name} 已装配` };
  }

  beginStage() {
    if (this.state !== "room") return false;
    const stageIndex = this.run.pendingStageIndex;
    const stage = MISSION_STAGES[stageIndex];
    this.run.stageIndex = stageIndex;
    this.run.stageQueue = [...stage.enemies];
    this.run.stageDefeated = 0;
    this.run.mission = stage.id;
    this.state = "playing";
    if (!this.isArenaCacheReady("stage", stageIndex)) this.arenaReady = this.prepareArenaCache({ mode: "stage", stageIndex });
    this.run.spawnTimer = 0.45;
    audio.resumeMusic();
    this.callbacks.onState?.("playing");
    this.callbacks.onAnnouncement?.({ title: `${stage.id} ${stage.name}`, subtitle: stage.subtitle });
    this.emitHud(true);
    return true;
  }

  stop() {
    audio.stopMusic();
    this.state = "menu";
    this.keys.clear();
    this.setTouchVector(0, 0);
    this.callbacks.onState?.("menu");
  }

  pause(manual = true) {
    if (this.state !== "playing") return;
    audio.pauseMusic();
    this.state = "paused";
    this.callbacks.onPauseChange?.(true, manual);
  }

  resume() {
    if (this.state !== "paused") return;
    audio.unlock();
    audio.resumeMusic();
    this.state = "playing";
    this.lastFrame = performance.now();
    this.callbacks.onPauseChange?.(false, true);
  }

  togglePause() {
    if (this.state === "playing") this.pause(true);
    else if (this.state === "paused") this.resume();
  }

  frame(time) {
    const dt = Math.min(0.034, Math.max(0, (time - this.lastFrame) / 1000));
    this.lastFrame = time;
    if (this.state === "playing") this.update(dt);
    this.render(time / 1000);
    requestAnimationFrame((nextTime) => this.frame(nextTime));
  }

  update(dt) {
    const run = this.run;
    run.elapsed += dt;
    this.flash = Math.max(0, this.flash - dt * 4.5);
    this.shake = Math.max(0, this.shake - dt * 20);
    this.updatePlayer(dt);
    this.updateWeaponTipTrails(dt);
    this.updateSpawning(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    this.updateEffects(dt);
    this.camera.x = lerp(this.camera.x, this.player.x, 1 - Math.exp(-dt * 8));
    this.camera.y = lerp(this.camera.y, this.player.y, 1 - Math.exp(-dt * 8));
    this.hudAccumulator += dt;
    if (this.hudAccumulator >= 0.06) {
      this.hudAccumulator = 0;
      this.emitHud();
    }
  }

  getMovementVector() {
    let x = this.touchVector.x;
    let y = this.touchVector.y;
    if (this.keys.has("a") || this.keys.has("arrowleft")) x -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) x += 1;
    if (this.keys.has("w") || this.keys.has("arrowup")) y -= 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) y += 1;
    return normalized(x, y);
  }

  getPointerWorld() {
    return {
      x: this.camera.x + this.pointer.x - this.view.width / 2,
      y: this.camera.y + this.pointer.y - this.view.height / 2,
    };
  }

  nearestEnemy(origin = this.player, range = Infinity) {
    let nearest = null;
    let nearestDistance = range * range;
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      const distance = distanceSquared(origin, enemy);
      if (distance < nearestDistance) {
        nearest = enemy;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  faceThreat() {
    if (!this.player) return;
    if (this.pointer.active) {
      const pointer = this.getPointerWorld();
      this.player.facing = Math.atan2(pointer.y - this.player.y, pointer.x - this.player.x);
      return;
    }
    const target = this.nearestEnemy(this.player, 620);
    if (target) this.player.facing = Math.atan2(target.y - this.player.y, target.x - this.player.x);
    else this.player.facing = Math.atan2(this.player.lastMove.y, this.player.lastMove.x);
  }

  canGuard() {
    return this.player && !["attack", "dash", "broken", "skill"].includes(this.player.action) && this.player.stamina > 0;
  }

  updatePlayer(dt) {
    const player = this.player;
    const move = this.getMovementVector();
    if (move.x || move.y) player.lastMove = move;
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    player.rangedCooldown = Math.max(0, player.rangedCooldown - dt);
    player.rangedPoseTimer = Math.max(0, player.rangedPoseTimer - dt);
    player.skillCooldown = Math.max(0, player.skillCooldown - dt);
    player.parryTimer = Math.max(0, player.parryTimer - dt);
    player.staminaDelay = Math.max(0, player.staminaDelay - dt);
    player.overdrive = Math.max(0, player.overdrive - dt);
    player.pulse += dt;

    if (player.reloadTimer > 0) {
      player.reloadTimer -= dt;
      if (player.reloadTimer <= 0) {
        player.reloadTimer = 0;
        player.ammo = player.maxAmmo;
        audio.reload();
      }
    }

    if (this.dashRequested) {
      this.dashRequested = false;
      const dashDirection = move.x || move.y ? move : player.lastMove;
      if (player.dashCooldown <= 0 && player.stamina >= 30 && !["broken", "skill"].includes(player.action)) {
        player.stamina -= 30;
        player.staminaDelay = 0.72;
        player.action = "dash";
        player.blockHeld = false;
        player.dashTime = GAME.dashDuration;
        player.dashCooldown = GAME.dashCooldown * player.stats.dashCooldown;
        player.dashVector = dashDirection;
        player.invulnerable = GAME.dashDuration + 0.05;
        this.effects.push({
          type: "dashStreak", x: player.x, y: player.y,
          angle: Math.atan2(dashDirection.y, dashDirection.x),
          radius: 176, life: 0.24, maxLife: 0.24, color: this.run.core.color,
        });
        this.spawnBurst(player.x, player.y, "#4df6ff", 14, 190);
        audio.dash();
      }
    }

    if (player.blockHeld && this.canGuard()) {
      if (player.action !== "block") {
        player.action = "block";
        player.parryTimer = player.stats.parryWindow;
      }
      this.faceThreat();
      player.stamina -= 8 * player.stats.guardEfficiency * dt;
      player.staminaDelay = 0.22;
      if (player.stamina <= 0) this.breakGuard();
    } else if (player.action === "block") {
      player.action = "idle";
    }

    if (player.action === "attack") this.updateAttack(dt);
    if (["broken", "skill"].includes(player.action)) {
      player.actionTimer -= dt;
      if (player.actionTimer <= 0) player.action = "idle";
    }

    let direction = move;
    let speed = GAME.playerSpeed * player.stats.speed * (player.overdrive > 0 ? 1.16 : 1);
    if (player.action === "dash") {
      player.dashTime -= dt;
      direction = player.dashVector;
      speed = GAME.dashSpeed;
      if (player.dashTime <= 0) player.action = "idle";
    } else if (player.action === "block") {
      speed *= 0.44;
    } else if (player.action === "attack") {
      speed *= 0.5;
    } else if (["broken", "skill"].includes(player.action)) {
      speed = 0;
    }

    if (player.action !== "dash" && player.action !== "block" && this.pointer.active && player.action !== "attack") this.faceThreat();
    player.x = clamp(player.x + direction.x * speed * dt, 42, GAME.width - 42);
    player.y = clamp(player.y + direction.y * speed * dt, 42, GAME.height - 42);

    if (player.staminaDelay <= 0 && player.action !== "block") {
      player.stamina = Math.min(player.maxStamina, player.stamina + 31 * player.stats.staminaRegen * dt);
    }
  }

  startAttack(index) {
    const player = this.player;
    const combo = WEAPONS[this.run.core.weapon].combo;
    const overdrive = player.overdrive > 0 ? 1.3 : 1;
    player.action = "attack";
    player.attackIndex = index;
    player.attackTimer = 0;
    player.attackDuration = combo[index].duration / (player.stats.attackSpeed * overdrive);
    player.attackHit = new Set();
    player.comboQueued = false;
    this.beginWeaponTipTrailStroke(index);
    if (combo[index].lunge) {
      player.x = clamp(player.x + Math.cos(player.facing) * combo[index].lunge, 42, GAME.width - 42);
      player.y = clamp(player.y + Math.sin(player.facing) * combo[index].lunge, 42, GAME.height - 42);
    }
    audio.melee(this.run.core.weapon, index);
  }

  updateAttack(dt) {
    const player = this.player;
    const moveDefinition = WEAPONS[this.run.core.weapon].combo[player.attackIndex];
    const speedMultiplier = moveDefinition.duration / player.attackDuration;
    player.attackTimer += dt;
    const definitionTime = player.attackTimer * speedMultiplier;
    if (definitionTime >= moveDefinition.activeStart && definitionTime <= moveDefinition.activeEnd) this.performMeleeHit(moveDefinition);
    if (player.attackTimer >= player.attackDuration) {
      if (player.comboQueued && player.attackIndex < 2) this.startAttack(player.attackIndex + 1);
      else player.action = player.blockHeld && this.canGuard() ? "block" : "idle";
    }
  }

  performMeleeHit(moveDefinition) {
    const player = this.player;
    const pose = this.getHeldWeaponPose(this.run.elapsed);
    const shapes = this.getActiveWeaponShapes(pose);
    for (const enemy of this.enemies) {
      if (enemy.dead || player.attackHit.has(enemy)) continue;
      const touchingWeapon = shapes.some((shape) => {
        const hitRadius = enemy.radius + shape.thickness;
        if (pointSegmentDistanceSquared(enemy, shape.start, shape.end) <= hitRadius * hitRadius) return true;
        if (shape.headRadius) {
          const headHitRadius = enemy.radius + shape.headRadius;
          return distanceSquared(enemy, shape.end) <= headHitRadius * headHitRadius;
        }
        return false;
      });
      if (!touchingWeapon) continue;
      player.attackHit.add(enemy);
      const direction = normalized(enemy.x - player.x, enemy.y - player.y);
      const critical = player.attackIndex === 2 ? 1.18 : 1;
      this.damageEnemy(enemy, moveDefinition.damage * player.stats.meleeDamage * critical, "melee", direction, moveDefinition.knockback);
    }
  }

  getWeaponHitShapes(pose) {
    const weapon = WEAPONS[this.run.core.weapon];
    const createShape = (angle, side, hand) => {
      const perpendicular = angle + Math.PI / 2;
      const origin = {
        x: this.player.x + Math.cos(perpendicular) * side,
        y: this.player.y + Math.sin(perpendicular) * side,
      };
      const start = {
        x: origin.x + Math.cos(angle) * this.player.radius * 0.34,
        y: origin.y + Math.sin(angle) * this.player.radius * 0.34,
      };
      const end = {
        x: origin.x + Math.cos(angle) * weapon.collision.length,
        y: origin.y + Math.sin(angle) * weapon.collision.length,
      };
      return {
        hand,
        start,
        end,
        thickness: weapon.collision.thickness,
        headRadius: weapon.collision.headRadius || 0,
      };
    };
    const primarySide = pose.offhandAngle == null ? 0 : 5;
    const shapes = [createShape(pose.angle, primarySide, "primary")];
    if (pose.offhandAngle != null) shapes.push(createShape(pose.offhandAngle, -5, "offhand"));
    return shapes;
  }

  getActiveWeaponShapes(pose) {
    const shapes = this.getWeaponHitShapes(pose);
    if (this.run.core.weapon !== "twin") return shapes;
    if (this.player.attackIndex === 0) return shapes.filter((shape) => shape.hand === "primary");
    if (this.player.attackIndex === 1) return shapes.filter((shape) => shape.hand === "offhand");
    return shapes;
  }

  beginWeaponTipTrailStroke(attackIndex) {
    const trails = this.weaponTipTrails;
    if (!trails) return;
    const begin = (trail) => {
      trail.stroke += 1;
      trail.sampleTimer = WEAPON_TIP_TRAIL_SAMPLE_INTERVAL;
    };
    if (this.run.core.weapon !== "twin" || attackIndex !== 1) begin(trails.primary);
    if (this.run.core.weapon === "twin" && attackIndex !== 0) begin(trails.offhand);
  }

  updateWeaponTipTrails(dt) {
    const trails = this.weaponTipTrails;
    if (!trails) return;
    const lifetime = WEAPON_TIP_TRAIL_LIFETIME;
    for (const hand of WEAPON_TIP_TRAIL_HANDS) {
      const trail = trails[hand];
      trail.sampleTimer += dt;
      for (let offset = 0; offset < trail.count; offset += 1) {
        trail.points[(trail.start + offset) % WEAPON_TIP_TRAIL_CAPACITY].age += dt;
      }
      while (trail.count > 0 && trail.points[trail.start].age >= lifetime) {
        trail.start = (trail.start + 1) % WEAPON_TIP_TRAIL_CAPACITY;
        trail.count -= 1;
      }
    }
    if (this.player.action !== "attack") return;
    const timing = this.getAttackTiming();
    if (timing.stage !== "strike" && !(timing.stage === "recovery" && timing.progress <= 0.28)) return;
    const shapes = this.getActiveWeaponShapes(this.getHeldWeaponPose(this.run.elapsed));
    for (const shape of shapes) this.sampleWeaponTipTrail(trails[shape.hand], shape.end);
  }

  sampleWeaponTipTrail(trail, tip) {
    if (!trail) return;
    let latest = null;
    if (trail.count > 0) {
      latest = trail.points[(trail.start + trail.count - 1) % WEAPON_TIP_TRAIL_CAPACITY];
    }
    const beginsStroke = !latest || latest.stroke !== trail.stroke;
    if (!beginsStroke && trail.sampleTimer < WEAPON_TIP_TRAIL_SAMPLE_INTERVAL) return;
    let writeIndex;
    if (trail.count < WEAPON_TIP_TRAIL_CAPACITY) {
      writeIndex = (trail.start + trail.count) % WEAPON_TIP_TRAIL_CAPACITY;
      trail.count += 1;
    } else {
      writeIndex = trail.start;
      trail.start = (trail.start + 1) % WEAPON_TIP_TRAIL_CAPACITY;
    }
    const point = trail.points[writeIndex];
    point.x = tip.x;
    point.y = tip.y;
    point.age = 0;
    point.stroke = trail.stroke;
    trail.sampleTimer = 0;
  }

  startReload() {
    if (!this.player || this.player.reloadTimer > 0 || this.player.ammo >= this.player.maxAmmo) return;
    this.player.reloadTimer = 1.28 * this.player.stats.reload;
  }

  updateSpawning(dt) {
    const run = this.run;
    const stage = MISSION_STAGES[run.stageIndex];
    run.spawnTimer -= dt;
    if (run.stageQueue.length > 0 && run.spawnTimer <= 0 && this.enemies.length < stage.maxActive) {
      const type = run.stageQueue.shift();
      const enemy = this.spawnEnemy(type, true);
      run.spawnTimer = stage.spawnDelay;
      if (type === "elite") {
        this.callbacks.onAnnouncement?.({ title: "精英处刑机", subtitle: "重型攻击会大量削减格挡体力" });
      }
      if (type === "boss") {
        run.bossSpawned = true;
        run.boss = enemy;
        this.callbacks.onAnnouncement?.({ title: "零号执行体", subtitle: "最终目标已进入核心战区" });
        this.effects.push({ type: "bossBurst", x: enemy.x, y: enemy.y, angle: 0, radius: 270, life: 0.72, maxLife: 0.72, color: enemy.color });
        this.flash = this.settings.reduceFlash ? 0.1 : 0.4;
        this.shake = 16;
        audio.explosion();
      }
    }
    if (run.stageQueue.length === 0 && this.enemies.length === 0 && run.stageIndex < MISSION_STAGES.length - 1) {
      this.completeMissionStage();
    }
  }

  completeMissionStage() {
    const run = this.run;
    const cleared = MISSION_STAGES[run.stageIndex];
    const nextIndex = run.stageIndex + 1;
    const uncollectedEnergy = this.pickups.reduce((sum, pickup) => sum + pickup.value, 0);
    if (uncollectedEnergy > 0) {
      run.energy += uncollectedEnergy;
      run.energyEarned += uncollectedEnergy;
      this.pickups = [];
      audio.pickup();
    }
    run.pendingStageIndex = nextIndex;
    run.stageQueue = [];
    run.spawnTimer = 0.45;
    run.mission = "ROOM";
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.player.x = GAME.width / 2;
    this.player.y = GAME.height / 2;
    this.player.action = "idle";
    this.player.blockHeld = false;
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this.state = "room";
    this.arenaReady = this.prepareArenaCache({ mode: "room", stageIndex: nextIndex });
    audio.pauseMusic();
    audio.levelUp();
    this.callbacks.onState?.("room");
    this.callbacks.onAnnouncement?.({ title: `${cleared.id} 已突破`, subtitle: "返回整备房间" });
    this.emitHud(true);
    this.callbacks.onRoom?.(this.getRoomState());
  }

  spawnEnemy(typeId, far = false, override = {}) {
    const definition = ENEMIES[typeId];
    const angle = Math.random() * TAU;
    const distance = far ? Math.max(this.view.width, this.view.height) * 0.62 : Math.max(this.view.width, this.view.height) * randomBetween(0.48, 0.64);
    const x = clamp(this.player.x + Math.cos(angle) * distance, 50, GAME.width - 50);
    const y = clamp(this.player.y + Math.sin(angle) * distance, 50, GAME.height - 50);
    const difficulty = 1 + this.run.stageIndex * 0.16;
    const enemy = {
      ...definition,
      ...override,
      x: override.x ?? x,
      y: override.y ?? y,
      maxHp: (override.hp ?? definition.hp) * difficulty,
      hp: (override.hp ?? definition.hp) * difficulty,
      state: "chase",
      stateTimer: 0,
      shootTimer: randomBetween(0.8, 1.8),
      burstTimer: randomBetween(2.4, 4.2),
      hitFlash: 0,
      stun: 0,
      pushX: 0,
      pushY: 0,
      rotation: 0,
      trailTimer: 0,
      dead: false,
    };
    this.enemies.push(enemy);
    this.effects.push({
      type: "enemySpawn", x: enemy.x, y: enemy.y, angle: angle + Math.PI,
      radius: enemy.boss ? 210 : enemy.elite ? 128 : 94,
      life: enemy.boss ? 0.72 : 0.42, maxLife: enemy.boss ? 0.72 : 0.42, color: enemy.color,
    });
    return enemy;
  }

  updateEnemies(dt) {
    const alive = [];
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt * 6);
      enemy.stun = Math.max(0, enemy.stun - dt);
      enemy.shootTimer -= dt;
      enemy.burstTimer -= dt;
      enemy.trailTimer = Math.max(0, enemy.trailTimer - dt);
      enemy.pushX *= Math.exp(-dt * 8);
      enemy.pushY *= Math.exp(-dt * 8);
      const dx = this.player.x - enemy.x;
      const dy = this.player.y - enemy.y;
      const distance = Math.max(0.001, Math.hypot(dx, dy));
      const direction = { x: dx / distance, y: dy / distance };
      enemy.rotation = Math.atan2(dy, dx);
      let velocityX = enemy.pushX;
      let velocityY = enemy.pushY;

      if (enemy.stun <= 0) {
        if (enemy.state === "windup") {
          enemy.stateTimer -= dt;
          if (enemy.stateTimer <= 0) {
            if (distance <= (enemy.reach || 62) + this.player.radius + 28) this.damagePlayer(enemy.damage, enemy, enemy.heavy ? 1.55 : 1);
            enemy.state = "recover";
            enemy.stateTimer = enemy.heavy ? 0.72 : 0.46;
            this.effects.push({ type: "enemySwing", x: enemy.x, y: enemy.y, angle: enemy.rotation, radius: ((enemy.reach || 62) + 24) * 2, life: 0.24, maxLife: 0.24, color: enemy.color });
          }
        } else if (enemy.state === "recover") {
          enemy.stateTimer -= dt;
          if (enemy.stateTimer <= 0) enemy.state = "chase";
        } else {
          const meleeReach = (enemy.reach || 52) + this.player.radius + enemy.radius;
          if (distance <= meleeReach && !enemy.ranged) {
            enemy.state = "windup";
            enemy.stateTimer = enemy.windup || 0.5;
          } else {
            let movementSign = 1;
            if (enemy.ranged && distance < 280) movementSign = -0.72;
            else if (enemy.ranged && distance < 390) movementSign = 0;
            velocityX += direction.x * enemy.speed * movementSign;
            velocityY += direction.y * enemy.speed * movementSign;
            if (enemy.lunge && distance < 360) {
              velocityX += direction.x * enemy.speed * 0.55;
              velocityY += direction.y * enemy.speed * 0.55;
              if (enemy.trailTimer <= 0) {
                enemy.trailTimer = 0.11;
                this.effects.push({
                  type: "lancerTrail", x: enemy.x, y: enemy.y, angle: enemy.rotation,
                  radius: 118, life: 0.24, maxLife: 0.24, color: enemy.color,
                });
              }
            }
          }
          if (enemy.ranged && enemy.shootTimer <= 0 && distance < 720) {
            this.fireEnemyProjectile(enemy, direction, enemy.boss ? 3 : 1);
            enemy.shootTimer = enemy.boss ? 1.25 : enemy.elite ? 1.45 : 2.1;
          }
          if (enemy.boss && enemy.burstTimer <= 0) {
            this.fireRadial(enemy, enemy.hp < enemy.maxHp * 0.5 ? 12 : 8);
            enemy.burstTimer = enemy.hp < enemy.maxHp * 0.5 ? 2.3 : 3.2;
          }
        }
      }
      enemy.x = clamp(enemy.x + velocityX * dt, 35, GAME.width - 35);
      enemy.y = clamp(enemy.y + velocityY * dt, 35, GAME.height - 35);
      alive.push(enemy);
    }
    this.enemies = alive;
  }

  fireEnemyProjectile(enemy, direction, count = 1) {
    for (let index = 0; index < count; index += 1) {
      const angle = Math.atan2(direction.y, direction.x) + (index - (count - 1) / 2) * 0.14;
      this.enemyProjectiles.push({
        x: enemy.x + Math.cos(angle) * enemy.radius,
        y: enemy.y + Math.sin(angle) * enemy.radius,
        vx: Math.cos(angle) * (enemy.boss ? 280 : 235),
        vy: Math.sin(angle) * (enemy.boss ? 280 : 235),
        radius: enemy.boss ? 8 : 6,
        damage: enemy.damage * 0.82,
        life: 4,
        color: enemy.color,
        spriteKey: enemy.boss ? "bossBolt" : "enemyBolt",
        animationPhase: Math.random(),
        source: enemy,
      });
    }
    const angle = Math.atan2(direction.y, direction.x);
    this.effects.push({
      type: "enemyMuzzle",
      x: enemy.x + Math.cos(angle) * enemy.radius,
      y: enemy.y + Math.sin(angle) * enemy.radius,
      angle,
      radius: enemy.boss ? 108 : 72,
      life: enemy.boss ? 0.22 : 0.16,
      maxLife: enemy.boss ? 0.22 : 0.16,
      color: enemy.color,
    });
    audio.shoot("grenade");
  }

  fireRadial(enemy, count) {
    for (let index = 0; index < count; index += 1) {
      const angle = this.run.elapsed * 0.5 + index / count * TAU;
      this.enemyProjectiles.push({
        x: enemy.x, y: enemy.y, vx: Math.cos(angle) * 215, vy: Math.sin(angle) * 215,
        radius: 8, damage: enemy.damage * 0.65, life: 5, color: "#ff477f",
        spriteKey: "bossBolt", animationPhase: Math.random(), source: enemy,
      });
    }
    this.effects.push({
      type: "enemyMuzzle", x: enemy.x, y: enemy.y, angle: this.run.elapsed * 0.5,
      radius: 138, life: 0.28, maxLife: 0.28, color: enemy.color,
    });
    audio.shoot("grenade");
  }

  updateProjectiles(dt) {
    const projectiles = [];
    for (const projectile of this.projectiles) {
      projectile.life -= dt;
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      let consumed = false;
      for (const enemy of this.enemies) {
        if (enemy.dead || projectile.hit.has(enemy)) continue;
        const radius = projectile.radius + enemy.radius;
        if (distanceSquared(projectile, enemy) <= radius * radius) {
          projectile.hit.add(enemy);
          this.damageEnemy(enemy, projectile.damage, "rail", normalized(projectile.vx, projectile.vy), 125);
          consumed = true;
          break;
        }
      }
      if (!consumed && projectile.life > 0) projectiles.push(projectile);
    }
    this.projectiles = projectiles;

    const hostile = [];
    for (const projectile of this.enemyProjectiles) {
      projectile.life -= dt;
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      const radius = projectile.radius + this.player.radius;
      if (distanceSquared(projectile, this.player) <= radius * radius) {
        const result = this.damagePlayer(projectile.damage, projectile.source || projectile, 1);
        if (result === "parry") {
          const target = this.nearestEnemy(projectile, 420);
          if (target) this.damageEnemy(target, projectile.damage * 1.8, "reflect", normalized(projectile.vx, projectile.vy), 140);
        }
        continue;
      }
      if (projectile.life > 0) hostile.push(projectile);
    }
    this.enemyProjectiles = hostile;
  }

  damageEnemy(enemy, amount, kind = "melee", direction = null, knockback = 0) {
    if (!enemy || enemy.dead) return;
    enemy.hp -= amount;
    const meleeImpact = kind === "melee";
    const heavyImpact = meleeImpact && (this.player.attackIndex === 2 || enemy.elite || enemy.boss);
    enemy.hitFlash = heavyImpact ? 1.35 : 1;
    if (direction && knockback) {
      enemy.pushX += direction.x * knockback;
      enemy.pushY += direction.y * knockback;
    }
    this.damageTexts.push({ x: enemy.x, y: enemy.y - enemy.radius, text: String(Math.round(amount)), color: kind === "rail" ? "#c9a6ff" : "#bfffff", life: 0.65, maxLife: 0.65, heavy: heavyImpact });
    if (direction) {
      const impactType = kind === "rail" || kind === "reflect"
        ? "railHit"
        : kind === "melee"
          ? `${this.run.core.weapon}Hit`
          : "pulseWave";
      this.effects.push({
        type: impactType,
        x: enemy.x,
        y: enemy.y,
        angle: Math.atan2(direction.y, direction.x),
        radius: enemy.boss ? 144 : heavyImpact ? 112 : meleeImpact ? 88 : 72,
        life: heavyImpact ? 0.28 : meleeImpact ? 0.23 : 0.16,
        maxLife: heavyImpact ? 0.28 : meleeImpact ? 0.23 : 0.16,
        color: kind === "rail" ? "#b77dff" : this.run.core.color,
        heavy: heavyImpact,
      });
    }
    this.spawnBurst(enemy.x, enemy.y, kind === "rail" ? "#b77dff" : "#4df6ff", enemy.boss ? 14 : heavyImpact ? 10 : meleeImpact ? 7 : 4, heavyImpact ? 175 : meleeImpact ? 145 : 110);
    this.shake = Math.max(this.shake, heavyImpact ? 7 : meleeImpact ? 5 : 2.5);
    const weaponKind = kind === "melee" ? this.run.core.weapon : kind;
    audio.hit(weaponKind, {
      heavy: heavyImpact,
      killed: enemy.hp <= 0,
    });
    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  killEnemy(enemy) {
    if (enemy.dead) return;
    enemy.dead = true;
    this.run.kills += 1;
    this.run.stageDefeated += 1;
    const energy = Math.max(1, Math.round(enemy.energy));
    const count = enemy.boss ? 10 : enemy.elite ? 4 : 1;
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * TAU;
      this.pickups.push({
        x: enemy.x + Math.cos(angle) * randomBetween(0, enemy.radius),
        y: enemy.y + Math.sin(angle) * randomBetween(0, enemy.radius),
        value: Math.max(1, Math.round(energy / count)),
        radius: enemy.boss ? 15 : 10,
        pulse: Math.random() * TAU,
      });
    }
    this.effects.push({
      type: "enemyDestroy", x: enemy.x, y: enemy.y, angle: enemy.rotation,
      radius: enemy.boss ? 310 : enemy.elite ? 176 : enemy.radius * 5.2,
      life: enemy.boss ? 0.82 : 0.48, maxLife: enemy.boss ? 0.82 : 0.48, color: enemy.color,
    });
    this.spawnBurst(enemy.x, enemy.y, enemy.color, enemy.boss ? 48 : 14, enemy.boss ? 300 : 180);
    if (enemy.boss) {
      this.run.boss = enemy;
      this.finish(true);
    }
  }

  damagePlayer(amount, source, guardPressure = 1) {
    const player = this.player;
    if (!player || player.invulnerable > 0 || this.state !== "playing") return "evade";
    const towardSource = normalized(source.x - player.x, source.y - player.y);
    const facing = { x: Math.cos(player.facing), y: Math.sin(player.facing) };
    const front = towardSource.x * facing.x + towardSource.y * facing.y > -0.18;
    if (player.action === "block" && front) {
      if (player.parryTimer > 0) {
        if (source && "stun" in source) {
          source.stun = Math.max(source.stun, 1.15);
          source.pushX -= towardSource.x * 240;
          source.pushY -= towardSource.y * 240;
        }
        player.stamina = Math.min(player.maxStamina, player.stamina + 10);
        this.effects.push({ type: "parryFlash", x: player.x, y: player.y, angle: player.facing, radius: 150, life: 0.34, maxLife: 0.34, color: "#ffffff" });
        this.callbacks.onAnnouncement?.({ title: "精准招架", subtitle: "攻击者已失衡" });
        audio.guard(true);
        return "parry";
      }
      const staminaCost = amount * 0.82 * guardPressure * player.stats.guardEfficiency;
      player.stamina -= staminaCost;
      player.staminaDelay = 0.7;
      this.effects.push({ type: "guardHit", x: player.x, y: player.y, angle: player.facing, radius: 142, life: 0.22, maxLife: 0.22, color: "#4df6ff" });
      audio.guard(false);
      if (player.stamina <= 0) {
        this.breakGuard();
        this.applyHealthDamage(amount * 0.42, source);
        return "broken";
      }
      this.damageTexts.push({ x: player.x, y: player.y - 38, text: "格挡", color: "#4df6ff", life: 0.55, maxLife: 0.55 });
      return "block";
    }
    this.applyHealthDamage(amount, source);
    return "hit";
  }

  applyHealthDamage(amount, source = null) {
    const player = this.player;
    let remaining = amount;
    let absorbed = 0;
    if (player.barrier > 0) {
      absorbed = Math.min(player.barrier, remaining);
      player.barrier -= absorbed;
      remaining -= absorbed;
    }
    if (absorbed > 0) {
      const barrierAngle = source ? Math.atan2(source.y - player.y, source.x - player.x) : player.facing;
      this.effects.push({
        type: "barrierHit", x: player.x, y: player.y, angle: barrierAngle,
        radius: 138, life: 0.26, maxLife: 0.26, color: "#ffcc66",
      });
    }
    if (remaining <= 0) {
      player.invulnerable = 0.46;
      this.shake = Math.max(this.shake, 4);
      audio.guard(false);
      return;
    }
    if (remaining > 0) player.health -= remaining;
    player.invulnerable = 0.46;
    this.flash = this.settings.reduceFlash ? 0.06 : 0.22;
    this.shake = 11;
    this.spawnBurst(player.x, player.y, "#ff5478", 13, 180);
    audio.hurt();
    if (player.health <= 0) this.finish(false);
  }

  breakGuard() {
    const player = this.player;
    player.stamina = 0;
    player.blockHeld = false;
    player.action = "broken";
    player.actionTimer = 0.9;
    player.staminaDelay = 1.1;
    this.effects.push({
      type: "guardBreak", x: player.x, y: player.y, angle: player.facing,
      radius: 168, life: 0.46, maxLife: 0.46, color: "#ffcc66",
    });
    this.callbacks.onAnnouncement?.({ title: "防御过载", subtitle: "体力耗尽" });
    this.shake = 8;
  }

  updatePickups(dt) {
    const remaining = [];
    for (const pickup of this.pickups) {
      pickup.pulse += dt * 3;
      const dx = this.player.x - pickup.x;
      const dy = this.player.y - pickup.y;
      const distance = Math.max(0.001, Math.hypot(dx, dy));
      if (distance < 155) {
        const speed = distance < 52 ? 700 : 350;
        pickup.x += dx / distance * speed * dt;
        pickup.y += dy / distance * speed * dt;
      }
      if (distance < this.player.radius + pickup.radius + 8) {
        this.collectEnergy(pickup.value, pickup);
        continue;
      }
      remaining.push(pickup);
    }
    this.pickups = remaining;
  }

  collectEnergy(value, pickup = this.player) {
    this.run.energy += value;
    this.run.energyEarned += value;
    this.effects.push({
      type: "pickupCollect", x: pickup.x, y: pickup.y, angle: Math.atan2(this.player.y - pickup.y, this.player.x - pickup.x),
      radius: 88, life: 0.32, maxLife: 0.32, color: "#4df6ff",
    });
    audio.pickup();
  }

  updateEffects(dt) {
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.exp(-dt * 3.2);
      particle.vy *= Math.exp(-dt * 3.2);
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
    for (const effect of this.effects) effect.life -= dt;
    this.effects = this.effects.filter((effect) => effect.life > 0);
    for (const text of this.damageTexts) {
      text.life -= dt;
      text.y -= 30 * dt;
    }
    this.damageTexts = this.damageTexts.filter((text) => text.life > 0);
  }

  spawnBurst(x, y, color, count = 8, speed = 140) {
    const spriteCount = clamp(Math.ceil(count / 5), 1, 8);
    for (let index = 0; index < spriteCount; index += 1) {
      const angle = Math.random() * TAU;
      const travel = randomBetween(2, Math.max(3, speed * 0.035));
      const life = randomBetween(0.24, 0.42);
      this.effects.push({
        type: "energySpark",
        x: x + Math.cos(angle) * travel,
        y: y + Math.sin(angle) * travel,
        angle,
        radius: randomBetween(34, 58),
        life,
        maxLife: life,
        color,
      });
    }
  }

  finish(victory) {
    if (!this.run || this.state === "result") return;
    this.run.victory = victory;
    this.state = "result";
    audio.endRun(victory);
    const coreEnergy = Math.max(1, Math.round((this.run.kills * 0.85 + this.run.energyEarned * 0.25 + (victory ? 55 : 0)) * (1 + this.run.metaRecovery * 0.06)));
    this.run.scrap = coreEnergy;
    this.callbacks.onResult?.({
      victory,
      coreId: this.run.coreId,
      time: this.run.elapsed,
      timeText: formatTime(this.run.elapsed),
      kills: this.run.kills,
      mission: this.run.mission,
      energy: this.run.energyEarned,
      scrap: coreEnergy,
    });
  }

  emitHud() {
    if (!this.run || !this.player) return;
    const player = this.player;
    const melee = WEAPONS[this.run.core.weapon];
    const displayStageIndex = this.state === "room" ? this.run.pendingStageIndex : this.run.stageIndex;
    const stage = MISSION_STAGES[displayStageIndex];
    const stageProgress = this.state === "room" ? 0 : clamp(this.run.stageDefeated / stage.enemies.length, 0, 1);
    const remainingTargets = Math.max(0, stage.enemies.length - this.run.stageDefeated);
    this.callbacks.onHud?.({
      mission: this.state === "room" ? "ROOM" : this.run.mission,
      health: player.health,
      maxHealth: player.maxHealth,
      shield: player.stamina,
      shieldMax: player.maxStamina,
      progress: clamp((displayStageIndex + stageProgress) / MISSION_STAGES.length, 0, 1),
      phase: this.state === "room" ? "整备房间" : stage.name,
      objective: this.state === "room" ? `准备进入 ${stage.id} ${stage.name}` : stage.boss ? "击败零号执行体" : `清除本关目标 · 剩余 ${remainingTargets}`,
      time: formatTime(this.run.elapsed),
      kills: this.run.kills,
      scrap: this.run.energy,
      dash: 1 - clamp(player.dashCooldown / (GAME.dashCooldown * player.stats.dashCooldown), 0, 1),
      ammo: player.ammo,
      maxAmmo: player.maxAmmo,
      reload: player.reloadTimer,
      skill: 1 - clamp(player.skillCooldown / (8 * player.stats.skillCooldown), 0, 1),
      action: player.action,
      weapons: [
        { id: melee.id, name: melee.name, color: melee.color, asset: melee.asset },
        { id: "rail", name: WEAPONS.rail.name, color: WEAPONS.rail.color, asset: WEAPONS.rail.asset, ammo: `${player.ammo}/${player.maxAmmo}` },
      ],
      boss: this.run.boss && !this.run.boss.dead ? { name: this.run.boss.name, ratio: Math.max(0, this.run.boss.hp / this.run.boss.maxHp) } : null,
    });
  }

  render(time) {
    const ctx = this.ctx;
    ctx.setTransform(this.view.dpr, 0, 0, this.view.dpr, 0, 0);
    ctx.fillStyle = "#050710";
    ctx.fillRect(0, 0, this.view.width, this.view.height);
    if (!this.run || this.state === "menu") {
      this.renderMenuBackground(time);
      return;
    }
    const shakeClock = this.run.elapsed * 62;
    const shakeX = this.settings.shake ? Math.sin(shakeClock) * this.shake * 0.72 : 0;
    const shakeY = this.settings.shake ? Math.cos(shakeClock * 0.83) * this.shake * 0.58 : 0;
    ctx.save();
    ctx.translate(this.view.width / 2 - this.camera.x + shakeX, this.view.height / 2 - this.camera.y + shakeY);
    this.renderArena(ctx);
    this.renderPickups(ctx);
    this.renderEffects(ctx, true);
    this.renderProjectiles(ctx);
    for (const enemy of this.enemies) this.renderEnemy(ctx, enemy, time);
    this.renderPlayer(ctx, time);
    this.renderEffects(ctx, false);
    this.renderDamageTexts(ctx);
    ctx.restore();
    if (this.pointer.active && this.state === "playing") this.renderCrosshair(ctx);
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,70,110,${this.flash})`;
      ctx.fillRect(0, 0, this.view.width, this.view.height);
    }
  }

  renderMenuBackground(time) {
    const ctx = this.ctx;
    const gradient = ctx.createRadialGradient(this.view.width * 0.74, this.view.height * 0.46, 10, this.view.width * 0.74, this.view.height * 0.46, this.view.width * 0.62);
    gradient.addColorStop(0, "#151339");
    gradient.addColorStop(0.5, "#081020");
    gradient.addColorStop(1, "#04060d");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.view.width, this.view.height);
    for (const star of this.menuStars) {
      ctx.globalAlpha = 0.2 + Math.sin(time * 1.3 + star.phase) * 0.14;
      ctx.fillStyle = "#9eefff";
      ctx.fillRect(star.x * this.view.width, star.y * this.view.height, star.size, star.size);
    }
    ctx.globalAlpha = 1;
    const x = this.view.width * 0.77;
    const y = this.view.height * 0.46;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(time * 0.08);
    ctx.strokeStyle = "rgba(77,246,255,.24)";
    ctx.lineWidth = 2;
    for (const radius of [100, 132, 176]) {
      ctx.beginPath();
      ctx.arc(0, 0, radius, time * 0.25, time * 0.25 + Math.PI * 1.36);
      ctx.stroke();
    }
    ctx.restore();
    const menuCore = this.images.playerHunter;
    if (menuCore?.complete && menuCore.naturalWidth) {
      const width = 74 * PLAYER_SPRITE_SCALE.hunter;
      const height = width * menuCore.naturalHeight / menuCore.naturalWidth;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(time * 0.08);
      ctx.shadowColor = "#4df6ff";
      ctx.shadowBlur = 28;
      ctx.drawImage(menuCore, -width / 2, -height / 2, width, height);
      ctx.restore();
    } else {
      this.drawTechBall(ctx, x, y, 74, time, "#4df6ff", 0, "idle");
    }
  }

  getArenaCacheKey(mode = this.state === "room" ? "room" : "stage", stageIndex = this.run?.stageIndex || 0) {
    return `${mode}:${mode === "room" ? "room" : stageIndex}:dpr-${this.view.dpr}`;
  }

  isArenaCacheReady(mode = this.state === "room" ? "room" : "stage", stageIndex = this.run?.stageIndex || 0) {
    return Boolean(this.arenaCache?.ready && this.arenaCache.key === this.getArenaCacheKey(mode, stageIndex));
  }

  invalidateArenaCache() {
    if (!this.arenaCache) return;
    this.arenaCache.generation += 1;
    this.arenaCache.ready = false;
    this.arenaCache.key = "";
    this.arenaCache.pendingKey = "";
    this.arenaCache.promise = null;
    if (this.arenaCache.canvas) {
      this.arenaCache.canvas.width = 1;
      this.arenaCache.canvas.height = 1;
      this.arenaCache.canvas = null;
    }
  }

  runArenaCacheWarmPass(canvas) {
    return new Promise((resolve) => {
      const submit = () => {
        const context = this.ctx;
        let saved = false;
        try {
          context.save();
          saved = true;
          if (typeof context.resetTransform === "function") context.resetTransform();
          else context.setTransform(1, 0, 0, 1, 0, 0);
          context.globalAlpha = 0.25;
          context.globalCompositeOperation = "source-over";
          context.filter = "none";
          context.shadowBlur = 0;
          const scale = Math.min(this.canvas.width / canvas.width, this.canvas.height / canvas.height);
          const width = Math.max(1, canvas.width * scale);
          const height = Math.max(1, canvas.height * scale);
          context.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, width, height);
        } catch {
          // The cached arena remains usable even if the hidden upload pass fails.
        } finally {
          if (saved) {
            try { context.restore(); } catch {
              // The next normal frame resets the transform and drawing state.
            }
          }
          resolve();
        }
      };
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(submit);
      else window.setTimeout(submit, 16);
    });
  }

  prepareArenaCache({
    mode = this.state === "room" ? "room" : "stage",
    stageIndex = this.state === "room" ? this.run?.pendingStageIndex || 0 : this.run?.stageIndex || 0,
  } = {}) {
    if (!this.run || !this.decorations) return Promise.resolve(false);
    const key = this.getArenaCacheKey(mode, stageIndex);
    if (this.arenaCache.ready && this.arenaCache.key === key) return Promise.resolve(true);
    if (this.arenaCache.pendingKey === key && this.arenaCache.promise) return this.arenaCache.promise;
    const generation = this.arenaCache.generation + 1;
    this.arenaCache.generation = generation;
    this.arenaCache.pendingKey = key;
    this.emitLoadProgress("arena-cache", 0, 1);
    const promise = new Promise((resolve) => {
      const build = async () => {
        let nextCanvas = null;
        try {
          nextCanvas = document.createElement("canvas");
          nextCanvas.width = Math.max(1, Math.round((GAME.width + ARENA_CACHE_PADDING * 2) * this.view.dpr));
          nextCanvas.height = Math.max(1, Math.round((GAME.height + ARENA_CACHE_PADDING * 2) * this.view.dpr));
          const context = nextCanvas.getContext("2d", { alpha: true });
          if (!context) throw new Error("Arena cache context unavailable");
          context.setTransform(this.view.dpr, 0, 0, this.view.dpr, 0, 0);
          context.translate(ARENA_CACHE_PADDING, ARENA_CACHE_PADDING);
          this.drawArenaStatic(context, { mode, stageIndex });
          if (generation !== this.arenaCache.generation) {
            nextCanvas.width = 1;
            nextCanvas.height = 1;
            resolve(false);
            return;
          }
          const previousCanvas = this.arenaCache.canvas;
          this.arenaCache.canvas = nextCanvas;
          this.arenaCache.key = key;
          this.arenaCache.pendingKey = "";
          this.arenaCache.ready = true;
          if (previousCanvas && previousCanvas !== nextCanvas) {
            previousCanvas.width = 1;
            previousCanvas.height = 1;
          }
          await this.runArenaCacheWarmPass(nextCanvas);
          await this.waitForAnimationFrames(3);
          if (generation === this.arenaCache.generation) {
            this.arenaCache.promise = null;
            this.emitLoadProgress("arena-cache", 1, 1);
            resolve(true);
          } else {
            resolve(false);
          }
        } catch {
          if (nextCanvas && nextCanvas !== this.arenaCache.canvas) {
            nextCanvas.width = 1;
            nextCanvas.height = 1;
          }
          if (generation === this.arenaCache.generation) {
            this.arenaCache.pendingKey = "";
            this.arenaCache.promise = null;
          }
          resolve(false);
        }
      };
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(build);
      else window.setTimeout(build, 16);
    });
    this.arenaCache.promise = promise;
    return promise;
  }

  renderArena(ctx) {
    const mode = this.state === "room" ? "room" : "stage";
    const stageIndex = mode === "room" ? this.run?.pendingStageIndex || 0 : this.run?.stageIndex || 0;
    if (this.isArenaCacheReady(mode, stageIndex) && this.arenaCache.canvas) {
      ctx.drawImage(
        this.arenaCache.canvas,
        0, 0, this.arenaCache.canvas.width, this.arenaCache.canvas.height,
        -ARENA_CACHE_PADDING, -ARENA_CACHE_PADDING,
        GAME.width + ARENA_CACHE_PADDING * 2, GAME.height + ARENA_CACHE_PADDING * 2,
      );
      return;
    }
    this.drawArenaStatic(ctx, { mode, stageIndex });
  }

  drawArenaStatic(ctx, { mode = "room", stageIndex = 0 } = {}) {
    const palettes = [
      { ground: "#060b16", grid: "rgba(76,181,220,.08)", border: "rgba(77,246,255,.34)" },
      { ground: "#0b0815", grid: "rgba(183,125,255,.09)", border: "rgba(183,125,255,.38)" },
      { ground: "#13070e", grid: "rgba(255,70,110,.09)", border: "rgba(255,70,110,.44)" },
    ];
    const palette = mode === "room" ? palettes[0] : palettes[stageIndex] || palettes[0];
    const floorKey = mode === "room"
      ? "floorRoom"
      : ["floorOuter", "floorBlockade", "floorCore"][stageIndex] || "floorOuter";
    const floorPattern = this.getFloorPattern(ctx, floorKey);
    ctx.fillStyle = floorPattern || palette.ground;
    ctx.fillRect(0, 0, GAME.width, GAME.height);
    for (const decoration of this.decorations) {
      const angle = ((decoration.x * 0.013 + decoration.y * 0.007) % TAU) - Math.PI;
      if (decoration.prop) {
        this.drawWorldProp(ctx, "pylon", decoration.x, decoration.y, 68 + decoration.kind * 6, angle, palette.border);
      } else if (decoration.kind === 0) {
        this.drawWorldProp(ctx, "arenaVent", decoration.x, decoration.y, 44 + decoration.size * 2, angle, palette.grid);
      }
    }
    if (mode === "room") {
      this.drawWorldProp(ctx, "terminal", GAME.width / 2 + 165, GAME.height / 2 - 10, 156, -0.18, "#4df6ff");
    }
    this.renderArenaBoundary(ctx, palette.border);
  }

  getFloorPattern(ctx, imageKey) {
    const image = this.images[imageKey];
    if (!image?.complete || !image.naturalWidth || typeof ctx.createPattern !== "function") return null;
    let contextPatterns = this.patterns.get(ctx);
    if (!contextPatterns) {
      contextPatterns = new Map();
      this.patterns.set(ctx, contextPatterns);
    }
    if (!contextPatterns.has(imageKey)) contextPatterns.set(imageKey, ctx.createPattern(image, "repeat"));
    return contextPatterns.get(imageKey);
  }

  drawWorldProp(ctx, imageKey, x, y, width, angle = 0, glow = "#4df6ff") {
    const image = this.images[imageKey];
    if (!image?.complete || !image.naturalWidth) return false;
    const height = width * image.naturalHeight / image.naturalWidth;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.shadowColor = glow;
    ctx.shadowBlur = 8;
    ctx.drawImage(image, -width / 2, -height / 2, width, height);
    ctx.restore();
    return true;
  }

  renderArenaBoundary(ctx, glow) {
    const horizontalStep = 150;
    const verticalStep = 132;
    for (let x = 55; x < GAME.width - 40; x += horizontalStep) {
      this.drawWorldProp(ctx, "arenaBarrier", x, 27, 148, 0, glow);
      this.drawWorldProp(ctx, "arenaBarrier", x, GAME.height - 27, 148, Math.PI, glow);
    }
    for (let y = 100; y < GAME.height - 70; y += verticalStep) {
      this.drawWorldProp(ctx, "arenaBarrier", 27, y, 132, Math.PI / 2, glow);
      this.drawWorldProp(ctx, "arenaBarrier", GAME.width - 27, y, 132, -Math.PI / 2, glow);
    }
  }

  renderPickups(ctx) {
    for (const pickup of this.pickups) {
      const scale = 1 + Math.sin(pickup.pulse) * 0.08;
      ctx.save();
      ctx.translate(pickup.x, pickup.y);
      ctx.scale(scale, scale);
      ctx.shadowColor = "#4df6ff";
      ctx.shadowBlur = 15;
      if (this.images.energy.complete && this.images.energy.naturalWidth) {
        const size = pickup.radius * 3.1;
        ctx.drawImage(this.images.energy, -size / 2, -size / 2, size, size);
      } else {
        ctx.fillStyle = "#4df6ff";
        ctx.beginPath(); ctx.arc(0, 0, pickup.radius, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  }

  renderProjectiles(ctx) {
    for (const projectile of this.projectiles) {
      this.drawKeyframedSprite(ctx, projectile.spriteKey || "railRound", {
        ...projectile,
        angle: Math.atan2(projectile.vy, projectile.vx),
      }, projectile.radius * 14, {
        animation: "travel",
        phase: (this.run.elapsed * 7.5 + (projectile.animationPhase || 0)) % 1,
        offset: -projectile.radius * 6,
      });
    }
    for (const projectile of this.enemyProjectiles) {
      this.drawKeyframedSprite(ctx, projectile.spriteKey || "enemyBolt", {
        ...projectile,
        angle: Math.atan2(projectile.vy, projectile.vx),
      }, projectile.radius * (projectile.spriteKey === "bossBolt" ? 10 : 9), {
        animation: "travel",
        phase: (this.run.elapsed * 5.5 + (projectile.animationPhase || 0)) % 1,
        offset: -projectile.radius * (projectile.spriteKey === "bossBolt" ? 4.2 : 3.8),
      });
    }
  }

  renderEnemy(ctx, enemy, time) {
    if (enemy.dead) return;
    const telegraph = enemy.state === "windup";
    if (telegraph) {
      const windup = enemy.windup || 0.5;
      const progress = clamp(1 - enemy.stateTimer / windup, 0, 1);
      const telegraphRadius = (enemy.reach || 58) + 25;
      const heavyTelegraph = enemy.boss || enemy.heavy;
      const telegraphWidth = heavyTelegraph ? telegraphRadius * 2 : telegraphRadius * 1.3;
      const materialWidth = telegraphWidth / 0.88;
      this.drawKeyframedSprite(ctx, heavyTelegraph ? "heavyTelegraph" : "attackTelegraph", {
        x: enemy.x, y: enemy.y, angle: enemy.rotation,
      }, materialWidth, {
        animation: heavyTelegraph ? "heavyPulse10" : "telegraphPulse8",
        phase: progress,
        alpha: heavyTelegraph ? 0.9 : 0.82,
        offset: heavyTelegraph ? 0 : telegraphWidth * 0.278,
        composite: "source-over",
      });
    }
    if (enemy.shielded) {
      this.drawKeyframedSprite(ctx, "enemyShield", {
        x: enemy.x, y: enemy.y, angle: enemy.rotation,
      }, enemy.radius * 4.7, {
        animation: "loop",
        phase: (time * 0.7 + enemy.x * 0.001) % 1,
        alpha: enemy.hitFlash > 0 ? 0.94 : 0.68,
        offset: enemy.radius * 0.68,
      });
    }
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(enemy.rotation);
    ctx.shadowColor = enemy.color;
    ctx.shadowBlur = enemy.elite || enemy.boss ? 14 : 0;
    const sprite = this.images[ENEMY_SPRITES[enemy.id]];
    if (sprite?.complete && sprite.naturalWidth) {
      const width = enemy.radius * (ENEMY_SPRITE_SCALE[enemy.id] || 2.9);
      const height = width * sprite.naturalHeight / sprite.naturalWidth;
      const renderedSprite = enemy.hitFlash > 0
        ? this.filteredSprites.enemyHit[ENEMY_SPRITES[enemy.id]] || sprite
        : sprite;
      ctx.drawImage(renderedSprite, -width / 2, -height / 2, width, height);
    } else {
      ctx.fillStyle = enemy.hitFlash > 0 ? "#ffffff" : "#12172a";
      ctx.strokeStyle = enemy.color;
      ctx.lineWidth = enemy.elite || enemy.boss ? 4 : 2;
      ctx.beginPath();
      const sides = enemy.boss ? 8 : enemy.ranged ? 6 : 4;
      for (let index = 0; index < sides; index += 1) {
        const angle = index / sides * TAU;
        const radius = enemy.radius * (index % 2 ? 0.88 : 1);
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = enemy.color;
      ctx.globalAlpha = 0.82;
      ctx.beginPath(); ctx.arc(enemy.radius * 0.18, 0, enemy.radius * 0.3, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    if (enemy.stun > 0) {
      this.drawKeyframedSprite(ctx, "parryFlash", {
        x: enemy.x, y: enemy.y, angle: enemy.rotation,
      }, enemy.radius * 3.4, {
        animation: "loop",
        phase: (time * 1.8) % 1,
        alpha: 0.42,
      });
    }
    if (enemy.elite || enemy.boss) {
      const width = enemy.boss ? 130 : 72;
      ctx.fillStyle = "rgba(0,0,0,.72)";
      ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 17, width, 5);
      ctx.fillStyle = enemy.color;
      ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 17, width * Math.max(0, enemy.hp / enemy.maxHp), 5);
    }
  }

  renderPlayer(ctx, time) {
    const player = this.player;
    if (player.invulnerable > 0 && Math.floor(player.invulnerable * 22) % 2 === 0) ctx.globalAlpha = 0.48;
    if (player.overdrive > 0) {
      this.drawKeyframedSprite(ctx, "overdriveAura", {
        x: player.x, y: player.y, angle: player.facing,
      }, player.radius * 5.8, {
        animation: "loop",
        phase: (time * 1.25) % 1,
        alpha: 0.5,
        composite: "source-over",
      });
    }
    if (player.barrier > 0) {
      this.drawKeyframedSprite(ctx, "barrierShell", {
        x: player.x, y: player.y, angle: player.facing,
      }, player.radius * 5.35, {
        animation: "loop",
        phase: (time * 0.82 + 0.21) % 1,
        alpha: 0.46,
        composite: "source-over",
      });
    }
    const weaponPose = this.getHeldWeaponPose(time);
    this.drawWeaponTipTrails(ctx);
    this.drawHeldWeapon(ctx, weaponPose);
    if (player.rangedPoseTimer > 0) this.drawRangedPistol(ctx);
    this.drawPlayerBody(ctx, time);

    const gripAngles = weaponPose.offhandAngle == null
      ? [{ angle: weaponPose.angle, side: 0 }]
      : [{ angle: weaponPose.angle, side: 5 }, { angle: weaponPose.offhandAngle, side: -5 }];
    for (const grip of gripAngles) {
      ctx.save();
      ctx.translate(
        player.x + Math.cos(grip.angle) * player.radius * 0.72 + Math.cos(grip.angle + Math.PI / 2) * grip.side,
        player.y + Math.sin(grip.angle) * player.radius * 0.72 + Math.sin(grip.angle + Math.PI / 2) * grip.side,
      );
      ctx.fillStyle = "#dffeff";
      ctx.strokeStyle = this.run.core.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = this.run.core.color;
      ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    if (player.action === "block") {
      this.drawKeyframedSprite(ctx, "guardField", {
        x: player.x, y: player.y, angle: player.facing,
      }, player.radius * 5.8, {
        animation: "loop",
        phase: (time * 0.92) % 1,
        alpha: player.parryTimer > 0 ? 0.78 : 0.56,
        offset: player.radius * 1.3,
        composite: "source-over",
      });
    }
    ctx.globalAlpha = 1;
  }

  drawRangedPistol(ctx) {
    const image = this.images.pistol;
    if (!image?.complete || !image.naturalWidth) return;
    const player = this.player;
    const angle = player.facing;
    const size = 76;
    const recoil = clamp(player.rangedPoseTimer / 0.2, 0, 1) * 3;
    ctx.save();
    ctx.translate(
      player.x + Math.cos(angle) * (22 - recoil) + Math.cos(angle + Math.PI / 2) * -6,
      player.y + Math.sin(angle) * (22 - recoil) + Math.sin(angle + Math.PI / 2) * -6,
    );
    ctx.rotate(angle);
    ctx.shadowColor = WEAPONS.rail.color;
    ctx.shadowBlur = 5;
    ctx.drawImage(image, -size * 0.34, -size * 0.5, size, size);
    ctx.restore();
  }

  getHeldWeaponPose(time) {
    const player = this.player;
    const arcScale = player.stats.swingArc || 1;
    const idleMotion = Math.sin(time * 2.2) * 0.035;
    let angle = player.facing + idleMotion;
    let offhandAngle = null;
    const isTwin = this.run.core.weapon === "twin";
    if (isTwin) {
      angle = player.facing + 0.24 + idleMotion;
      offhandAngle = player.facing - 0.24 - idleMotion;
    }
    if (player.action === "attack") {
      const timing = this.getAttackTiming();
      if (isTwin) {
        if (player.attackIndex === 0) {
          angle = player.facing + this.interpolateSwing(0.24, -1.12 * arcScale, 0.72 * arcScale, timing);
          offhandAngle = player.facing - 0.32;
        } else if (player.attackIndex === 1) {
          angle = player.facing + 0.32;
          offhandAngle = player.facing + this.interpolateSwing(-0.24, 1.12 * arcScale, -0.72 * arcScale, timing);
        } else {
          angle = player.facing + this.interpolateSwing(0.24, -1.28 * arcScale, 1.02 * arcScale, timing);
          offhandAngle = player.facing + this.interpolateSwing(-0.24, 1.28 * arcScale, -1.02 * arcScale, timing);
        }
      } else {
        const swings = [
          [-1.08, 0.7],
          [0.72, -0.7],
          [-0.76, 1.12],
        ];
        const [start, end] = swings[player.attackIndex] || swings[0];
        angle = player.facing + this.interpolateSwing(0, start * arcScale, end * arcScale, timing);
      }
    } else if (player.action === "block") {
      angle = player.facing + 1.28;
      if (isTwin) offhandAngle = player.facing - 1.28;
    } else if (player.action === "dash") {
      angle = player.facing - 0.48;
      if (isTwin) offhandAngle = player.facing + 0.48;
    } else if (player.action === "skill") {
      angle = player.facing + Math.sin(time * 18) * 0.12;
      if (isTwin) offhandAngle = player.facing - Math.sin(time * 18) * 0.12;
    }
    return { angle, offhandAngle };
  }

  getAttackTiming() {
    const player = this.player;
    const definition = WEAPONS[this.run.core.weapon].combo[player.attackIndex];
    const progress = clamp(player.attackTimer / Math.max(0.001, player.attackDuration), 0, 1);
    const anticipationEnd = clamp(definition.activeStart / definition.duration * 0.72, 0.14, 0.3);
    const strikeEnd = clamp(definition.activeEnd / definition.duration * 1.08, 0.54, 0.8);
    if (progress < anticipationEnd) return { stage: "anticipation", progress: progress / anticipationEnd };
    if (progress < strikeEnd) return { stage: "strike", progress: (progress - anticipationEnd) / (strikeEnd - anticipationEnd) };
    return { stage: "recovery", progress: (progress - strikeEnd) / Math.max(0.001, 1 - strikeEnd) };
  }

  interpolateSwing(rest, start, end, timing) {
    const smoothstep = (value) => value * value * (3 - 2 * value);
    if (timing.stage === "anticipation") return lerp(rest, start, smoothstep(timing.progress));
    if (timing.stage === "strike") return lerp(start, end, 1 - Math.pow(1 - timing.progress, 3));
    return lerp(end, rest, smoothstep(timing.progress));
  }

  drawHeldWeapon(ctx, pose) {
    const weapon = WEAPONS[this.run.core.weapon];
    const image = this.images[weapon.id];
    if (!image?.complete || !image.naturalWidth || !weapon.render) return;
    const primarySide = pose.offhandAngle == null ? 0 : 5;
    this.drawWeaponSprite(ctx, image, weapon, pose.angle, primarySide);
    if (pose.offhandAngle != null) this.drawWeaponSprite(ctx, image, weapon, pose.offhandAngle, -5);
  }

  drawWeaponTipTrails(ctx) {
    const trails = this.weaponTipTrails;
    if (!trails) return;
    const weapon = WEAPONS[this.run.core.weapon];
    const isHammer = weapon.id === "hammer";
    const lifetime = WEAPON_TIP_TRAIL_LIFETIME;
    const outerWidth = isHammer ? 24 : 17;
    const coreWidth = isHammer ? 4 : 3;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const hand of WEAPON_TIP_TRAIL_HANDS) {
      const trail = trails[hand];
      for (let offset = 1; offset < trail.count; offset += 1) {
        const previous = trail.points[(trail.start + offset - 1) % WEAPON_TIP_TRAIL_CAPACITY];
        const current = trail.points[(trail.start + offset) % WEAPON_TIP_TRAIL_CAPACITY];
        if (previous.stroke !== current.stroke) continue;
        const freshness = 1 - clamp(Math.max(previous.age, current.age) / lifetime, 0, 1);
        if (freshness <= 0) continue;
        ctx.globalAlpha = freshness * (this.settings.reduceFlash ? 0.12 : 0.18);
        ctx.strokeStyle = weapon.color;
        ctx.lineWidth = outerWidth;
        ctx.beginPath();
        ctx.moveTo(previous.x, previous.y);
        ctx.lineTo(current.x, current.y);
        ctx.stroke();
        ctx.globalAlpha = freshness * (this.settings.reduceFlash ? 0.46 : 0.72);
        ctx.strokeStyle = "#f4ffff";
        ctx.lineWidth = coreWidth;
        ctx.beginPath();
        ctx.moveTo(previous.x, previous.y);
        ctx.lineTo(current.x, current.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawWeaponSprite(ctx, image, weapon, angle, sideOffset) {
    const { size, anchorX, anchorY, rotation } = weapon.render;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.translate(
      this.player.x + Math.cos(angle + Math.PI / 2) * sideOffset,
      this.player.y + Math.sin(angle + Math.PI / 2) * sideOffset,
    );
    ctx.rotate(angle);
    ctx.rotate(rotation);
    ctx.shadowColor = weapon.color;
    ctx.shadowBlur = 3;
    ctx.drawImage(image, -anchorX * size, -anchorY * size, size, size);
    ctx.restore();
  }

  drawPlayerBody(ctx, time) {
    const player = this.player;
    const key = PLAYER_SPRITES[this.run.core.id];
    const image = this.images[key];
    if (!image?.complete || !image.naturalWidth) {
      this.drawTechBall(ctx, player.x, player.y, player.radius, time, this.run.core.color, player.facing, player.action);
      return;
    }
    const width = player.radius * (PLAYER_SPRITE_SCALE[this.run.core.id] || 2.8);
    const height = width * image.naturalHeight / image.naturalWidth;
    const renderedImage = player.action === "skill"
      ? this.filteredSprites.playerSkill[key] || image
      : player.action === "dash"
        ? this.filteredSprites.playerDash[key] || image
        : image;
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.facing);
    ctx.shadowColor = this.run.core.color;
    ctx.shadowBlur = player.action === "skill" ? 28 : player.action === "block" ? 20 : 14;
    ctx.drawImage(renderedImage, -width / 2, -height / 2, width, height);
    if (player.action === "skill") {
      ctx.globalAlpha = 0.2;
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(renderedImage, -width / 2, -height / 2, width, height);
    }
    ctx.restore();
  }

  drawTechBall(ctx, x, y, radius, time, color, facing, action) {
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = color;
    ctx.shadowBlur = action === "skill" ? 26 : 15;
    const gradient = ctx.createRadialGradient(-radius * 0.28, -radius * 0.32, radius * 0.12, 0, 0, radius);
    gradient.addColorStop(0, "#eaffff");
    gradient.addColorStop(0.18, color);
    gradient.addColorStop(0.42, "#12304b");
    gradient.addColorStop(1, "#080c19");
    ctx.fillStyle = gradient;
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, radius - 2, time * 0.8, time * 0.8 + Math.PI * 1.35); ctx.stroke();
    ctx.save();
    ctx.rotate(-time * 0.55);
    ctx.strokeStyle = "rgba(220,250,255,.46)";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, radius * 0.68, 0.2, 1.35); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, radius * 0.68, 3.2, 4.35); ctx.stroke();
    ctx.restore();
    ctx.rotate(facing);
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(radius * 0.48, 0, radius * 0.16, 0, TAU); ctx.fill();
    ctx.restore();
  }

  renderEffects(ctx, behind) {
    for (const effect of this.effects) {
      const drawsBehind = [
        "dashStreak", "bossBurst", "enemySpawn", "lancerTrail",
        "pulseWave", "overdriveAura", "barrierShell",
      ].includes(effect.type);
      if (drawsBehind !== behind) continue;
      if (effect.type === "dashStreak") {
        this.drawKeyframedSprite(ctx, "dashStreak", effect, effect.radius, {
          animation: "burst",
          alpha: 0.82,
          offset: -54,
        });
      } else if (effect.type === "bossBurst") {
        this.drawKeyframedSprite(ctx, "bossBurst", effect, effect.radius, {
          animation: "pulse",
          alpha: 0.94,
        });
      } else if (effect.type === "enemySpawn") {
        this.drawKeyframedSprite(ctx, "enemySpawn", effect, effect.radius, { animation: "pulse", alpha: 0.86 });
      } else if (effect.type === "lancerTrail") {
        this.drawKeyframedSprite(ctx, "lancerTrail", effect, effect.radius, { animation: "burst", alpha: 0.76, offset: -34 });
      } else if (effect.type === "pulseWave") {
        this.drawKeyframedSprite(ctx, "pulseWave", effect, effect.radius, { animation: "pulse", alpha: 0.72, composite: "screen" });
      } else if (effect.type === "overdriveAura") {
        this.drawKeyframedSprite(ctx, "overdriveAura", effect, effect.radius, { animation: "pulse", alpha: 0.82 });
      } else if (effect.type === "barrierShell") {
        this.drawKeyframedSprite(ctx, "barrierShell", effect, effect.radius, { animation: "pulse", alpha: 0.84 });
      } else if (["railMuzzle", "enemyMuzzle"].includes(effect.type)) {
        this.drawKeyframedSprite(ctx, effect.type, effect, effect.radius, { animation: "burst", alpha: 0.94 });
      } else if (effect.type === "enemySwing") {
        this.drawKeyframedSprite(ctx, "enemySwing", effect, effect.radius, { animation: "burst", alpha: 0.88, offset: effect.radius * 0.1 });
      } else if (["bladeHit", "twinHit", "hammerHit", "railHit"].includes(effect.type)) {
        this.drawKeyframedSprite(ctx, effect.type, effect, effect.radius, {
          animation: "burst",
          alpha: 0.96,
          rotation: effect.type === "railHit" ? effect.angle + Math.PI : effect.angle,
        });
      } else if (effect.type === "guardHit") {
        this.drawKeyframedSprite(ctx, "guardHit", effect, effect.radius, { animation: "burst", alpha: 0.96, offset: 34 });
      } else if (effect.type === "parryFlash") {
        this.drawKeyframedSprite(ctx, "parryFlash", effect, effect.radius, { animation: "burst", alpha: 0.98, offset: 26 });
      } else if (["guardBreak", "barrierHit", "enemyDestroy", "pickupCollect", "energySpark"].includes(effect.type)) {
        this.drawKeyframedSprite(ctx, effect.type, effect, effect.radius, {
          animation: effect.type === "pickupCollect" ? "pulse" : "burst",
          alpha: effect.type === "energySpark" ? 0.78 : 0.94,
          offset: effect.type === "barrierHit" ? 24 : 0,
        });
      }
    }
    ctx.globalAlpha = 1;
  }

  drawKeyframedSprite(ctx, imageKey, effect, width, {
    alpha = 1,
    offset = 0,
    scale = 1,
    rotation = effect.angle || 0,
    flipY = false,
    animation = "burst",
    phase = null,
    composite = "lighter",
  } = {}) {
    const image = this.images[imageKey];
    if (!image?.complete || !image.naturalWidth) return false;
    const lifeProgress = effect.maxLife ? 1 - effect.life / effect.maxLife : 0;
    const position = phase == null ? clamp(lifeProgress, 0, 1) : clamp(phase, 0, 1);
    const frame = sampleKeyframes(VFX_KEYFRAMES[animation] || VFX_KEYFRAMES.burst, position);
    const drawWidth = width * scale * frame.scale;
    const drawHeight = drawWidth * image.naturalHeight / image.naturalWidth;
    ctx.save();
    const angle = effect.angle || 0;
    ctx.translate(effect.x + Math.cos(angle) * offset, effect.y + Math.sin(angle) * offset);
    ctx.rotate(rotation + frame.rotation);
    ctx.scale(1, flipY ? -1 : 1);
    ctx.globalAlpha *= (this.settings.reduceFlash ? 0.7 : 1) * alpha * frame.alpha;
    ctx.globalCompositeOperation = composite;
    ctx.shadowBlur = 0;
    ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    ctx.restore();
    return true;
  }

  renderDamageTexts(ctx) {
    ctx.textAlign = "center";
    for (const text of this.damageTexts) {
      ctx.font = `${text.heavy ? 950 : 800} ${text.heavy ? 17 : 13}px ui-sans-serif, system-ui`;
      ctx.globalAlpha = clamp(text.life / text.maxLife, 0, 1);
      ctx.fillStyle = text.color;
      ctx.fillText(text.text, text.x, text.y);
    }
    ctx.globalAlpha = 1;
  }

  renderCrosshair(ctx) {
    const { x, y } = this.pointer;
    ctx.strokeStyle = "rgba(178,247,255,.72)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 13, y); ctx.lineTo(x - 6, y); ctx.moveTo(x + 6, y); ctx.lineTo(x + 13, y); ctx.moveTo(x, y - 13); ctx.lineTo(x, y - 6); ctx.moveTo(x, y + 6); ctx.lineTo(x, y + 13); ctx.stroke();
  }
}

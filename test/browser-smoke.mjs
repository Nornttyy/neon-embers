import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const baseUrl = process.env.NEON_SMOKE_URL || "http://127.0.0.1:4173";
const publicBlackBox = process.env.NEON_PUBLIC_BLACKBOX === "1";
const requiredMaterialPaths = [
  "assets/effects/guard-field.png", "assets/effects/parry-flash.png", "assets/effects/guard-break.png",
  "assets/effects/pulse-wave.png", "assets/effects/overdrive-aura.png", "assets/effects/barrier-shell.png",
  "assets/effects/rail-round.png", "assets/effects/enemy-bolt.png", "assets/effects/boss-bolt.png",
  "assets/effects/rail-muzzle.png", "assets/effects/enemy-muzzle.png", "assets/effects/enemy-swing.png",
  "assets/effects/attack-telegraph.png", "assets/effects/heavy-telegraph.png",
  "assets/effects/lancer-trail.png", "assets/effects/enemy-spawn.png", "assets/effects/blade-hit.png",
  "assets/effects/twin-hit.png", "assets/effects/hammer-hit.png", "assets/effects/rail-hit.png",
  "assets/effects/guard-hit.png", "assets/effects/barrier-hit.png", "assets/effects/enemy-destroy.png",
  "assets/effects/pickup-collect.png", "assets/effects/enemy-shield.png", "assets/effects/dash-streak-hard.png",
  "assets/effects/boss-burst-hard.png", "assets/effects/energy-spark.png", "assets/effects/impact-shard.png",
  "assets/effects/combo-finisher.png", "assets/effects/parry-counter.png", "assets/effects/skill-core.png",
  "assets/effects/dash-arrival.png", "assets/effects/execution-burst.png",
  "assets/effects/screen-success-overload.png", "assets/effects/screen-danger-fracture.png",
  "assets/items/repair-kit.png", "assets/items/ammo-cell.png", "assets/items/stamina-cell.png", "assets/items/barrier-module.png",
  "assets/enemies/skitter-drone.png", "assets/enemies/lancer-drone.png",
  "assets/world/room-floor.png", "assets/world/outer-floor.png", "assets/world/blockade-floor.png",
  "assets/world/core-floor.png", "assets/world/energy-terminal.png", "assets/world/arena-barrier.png", "assets/world/arena-vent.png",
];
const debugPort = 9400 + Math.floor(Math.random() * 400);
const profileDir = await mkdtemp(join(tmpdir(), "neon-embers-smoke-"));
const browser = spawn(chromePath, [
  "--headless=new",
  "--disable-gpu",
  "--no-sandbox",
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profileDir}`,
  "--window-size=1280,800",
  "about:blank",
], { stdio: "ignore" });

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForEndpoint() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      if (response.ok) return response.json();
    } catch {}
    await delay(100);
  }
  throw new Error("Chrome DevTools endpoint did not start");
}

let socket;
try {
  const pages = await waitForEndpoint();
  const page = pages.find((entry) => entry.type === "page");
  assert.ok(page?.webSocketDebuggerUrl, "headless page is available");
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  let commandId = 0;
  const pending = new Map();
  const exceptions = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    }
    if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails.text);
  });

  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++commandId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    }
    return result.result.value;
  };
  const captureScreenshot = async (path) => {
    if (!path) return;
    const shot = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    await writeFile(path, Buffer.from(shot.data, "base64"));
  };
  const collectStartupDiagnostics = () => evaluate(`(async () => {
    const game = window.__NEON_DEBUG__?.game;
    const loading = document.querySelector('#loading-screen');
    const registration = 'serviceWorker' in navigator
      ? await navigator.serviceWorker.getRegistration().catch(() => null)
      : null;
    const cacheEntries = {};
    if ('caches' in window) {
      for (const name of await caches.keys().catch(() => [])) {
        cacheEntries[name] = await caches.open(name)
          .then((cache) => cache.keys())
          .then((requests) => requests.length)
          .catch(() => -1);
      }
    }
    const workerState = (worker) => worker ? {
      state: worker.state,
      scriptURL: worker.scriptURL,
    } : null;
    return {
      documentReadyState: document.readyState,
      gameState: game?.state,
      assetLoadState: game?.assetLoadState ? {
        ready: game.assetLoadState.ready,
        loaded: game.assetLoadState.loaded,
        total: game.assetLoadState.total,
        failed: [...game.assetLoadState.failed],
      } : null,
      vfxWarmState: game?.vfxWarmState ? {
        ready: game.vfxWarmState.ready,
        warmed: game.vfxWarmState.warmed,
        total: game.vfxWarmState.total,
        failed: [...game.vfxWarmState.failed],
      } : null,
      filteredSpriteState: game?.filteredSpriteState ? {
        ready: game.filteredSpriteState.ready,
        prepared: game.filteredSpriteState.prepared,
        total: game.filteredSpriteState.total,
        failed: [...game.filteredSpriteState.failed],
      } : null,
      arenaCache: game?.arenaCache ? {
        ready: game.arenaCache.ready,
        key: game.arenaCache.key,
        pendingKey: game.arenaCache.pendingKey,
        hasPromise: Boolean(game.arenaCache.promise),
        generation: game.arenaCache.generation,
        width: game.arenaCache.canvas?.width || 0,
        height: game.arenaCache.canvas?.height || 0,
      } : null,
      loading: loading ? {
        active: loading.classList.contains('is-active'),
        busy: loading.getAttribute('aria-busy'),
        hidden: loading.getAttribute('aria-hidden'),
        stage: document.querySelector('#loading-stage')?.textContent,
        percent: document.querySelector('#loading-percent')?.textContent,
        progress: document.querySelector('#loading-track')?.getAttribute('aria-valuenow'),
      } : null,
      roomActive: document.querySelector('#room-screen')?.classList.contains('is-active'),
      serviceWorker: {
        supported: 'serviceWorker' in navigator,
        controller: workerState(navigator.serviceWorker?.controller),
        installing: workerState(registration?.installing),
        waiting: workerState(registration?.waiting),
        active: workerState(registration?.active),
      },
      cacheEntries,
      resourceEntries: performance.getEntriesByType('resource').length,
    };
  })()`);

  await command("Runtime.enable");
  await command("Page.enable");
  await command("Page.navigate", { url: `${baseUrl.replace(/\/$/, "")}/?autostart=hunter` });
  let roomReady = false;
  for (let attempt = 0; attempt < 300; attempt += 1) {
    try {
      roomReady = await evaluate(publicBlackBox
        ? `(() => {
          const art = [...document.querySelectorAll('#room-grid .room-item-art img')];
          return Boolean(
            document.querySelector('#room-screen')?.classList.contains('is-active')
            && !document.querySelector('#loading-screen')?.classList.contains('is-active')
            && document.querySelector('#room-grid')?.children.length === 4
            && art.length === 4
            && art.every((image) => image.complete && image.naturalWidth > 0)
          );
        })()`
        : `Boolean(
          window.__NEON_DEBUG__?.game?.assetLoadState?.ready
          && window.__NEON_DEBUG__.game.state === 'room'
          && window.__NEON_DEBUG__.game.arenaCache?.ready
          && !window.__NEON_DEBUG__.game.arenaCache?.promise
          && !document.querySelector('#loading-screen')?.classList.contains('is-active')
          && document.querySelector('#room-screen')?.classList.contains('is-active')
        )`);
    } catch {}
    if (roomReady) break;
    await delay(100);
  }
  if (!roomReady) {
    const startupDiagnostics = await collectStartupDiagnostics().catch((error) => ({
      diagnosticError: error?.stack || String(error),
    }));
    console.error("Startup readiness diagnostics:", JSON.stringify(startupDiagnostics, null, 2));
  }
  assert.equal(roomReady, true, "decoded assets, VFX, audio, arena cache, and the preparation room become ready within 30 seconds without waiting for offline caching");

  if (publicBlackBox) {
    const room = await evaluate(`(() => {
      const itemArt = [...document.querySelectorAll('#room-grid .room-item-art img')];
      return {
        visible: document.querySelector('#room-screen').classList.contains('is-active'),
        items: document.querySelector('#room-grid').children.length,
        itemArt: itemArt.length,
        itemArtReady: itemArt.every((image) => image.complete && image.naturalWidth > 0),
        itemArtVersioned: itemArt.every((image) => new URL(image.src).searchParams.has('v')),
        loadingHidden: !document.querySelector('#loading-screen').classList.contains('is-active'),
        loadingProgress: document.querySelector('#loading-track').getAttribute('aria-valuenow'),
        loadingPercent: document.querySelector('#loading-percent').textContent,
        loadingBusy: document.querySelector('#loading-screen').getAttribute('aria-busy'),
        debugPrivate: !('__NEON_DEBUG__' in window)
      };
    })()`);
    assert.deepEqual(room, {
      visible: true, items: 4, itemArt: 4, itemArtReady: true, itemArtVersioned: true,
      loadingHidden: true, loadingProgress: "100", loadingPercent: "100%", loadingBusy: "false", debugPrivate: true,
    });
    await captureScreenshot(process.env.NEON_SMOKE_ROOM_SHOT);

    await evaluate("document.querySelector('[data-room-item=\"barrier\"]').click()");
    await delay(100);
    assert.deepEqual(await evaluate(`({
      energy: document.querySelector('#room-energy').textContent,
      barrier: document.querySelector('#room-barrier').textContent
    })`), { energy: "3", barrier: "40 / 80" });

    await evaluate("document.querySelector('#room-start-button').click()");
    let battleReady = false;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      battleReady = await evaluate(`Boolean(
        document.querySelector('#hud')?.classList.contains('is-active')
        && !document.querySelector('#room-screen')?.classList.contains('is-active')
        && document.querySelector('#weapon-dock')?.children.length === 2
        && document.querySelector('#skill-dock')?.children.length === 3
      )`);
      if (battleReady) break;
      await delay(100);
    }
    assert.equal(battleReady, true, "the public preparation-room button starts combat");
    const publicControls = await evaluate(`(async () => {
      const press = (key, repeat = false) => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key, repeat }));
        window.dispatchEvent(new KeyboardEvent('keyup', { key }));
      };
      const keyDown = (key) => window.dispatchEvent(new KeyboardEvent('keydown', { key }));
      const keyUp = (key) => window.dispatchEvent(new KeyboardEvent('keyup', { key }));
      const active = () => [...document.querySelectorAll('#weapon-dock .weapon-chip.is-active')]
        .map((chip) => chip.dataset.slot);
      const activeSkills = () => [...document.querySelectorAll('#skill-dock .skill-slot.is-active')]
        .map((chip) => chip.dataset.skillSlot);
      const waitFrames = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const captureGuard = async (operate) => {
        let guardDrawn = false;
        const original = CanvasRenderingContext2D.prototype.drawImage;
        CanvasRenderingContext2D.prototype.drawImage = function(source, ...args) {
          if (source?.src && new URL(source.src).pathname.endsWith('/assets/effects/guard-field.png')) guardDrawn = true;
          return original.call(this, source, ...args);
        };
        try {
          operate();
          await waitFrames();
        } finally {
          CanvasRenderingContext2D.prototype.drawImage = original;
        }
        return guardDrawn;
      };
      const canvas = document.querySelector('#game-canvas');
      const chips = [...document.querySelectorAll('#weapon-dock .weapon-chip')];
      const skills = [...document.querySelectorAll('#skill-dock .skill-slot')];
      const initialSkillLabels = skills.map((skill) => skill.getAttribute('aria-label'));
      const initial = active();

      keyDown('e');
      canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 2, bubbles: true }));
      const bothGuardVisible = await captureGuard(() => {});
      keyUp('e');
      const mouseKeepsGuardVisible = await captureGuard(() => {});
      window.dispatchEvent(new PointerEvent('pointerup', { button: 2, bubbles: true }));
      const allReleasedGuardHidden = !(await captureGuard(() => {}));
      const kHasNoGuard = !(await captureGuard(() => press('k')));

      press('2');
      const selectedTwo = active();
      press('1');
      const selectedOne = active();
      press('2', true);
      const repeatWeaponIgnored = active();
      press('3');
      const threeUnbound = active();

      const wheel = (deltaX, deltaY, options = {}) => {
        const event = new WheelEvent('wheel', { deltaX, deltaY, deltaMode: options.deltaMode || 0, ctrlKey: Boolean(options.ctrlKey), bubbles: true, cancelable: true });
        canvas.dispatchEvent(event);
        return event.defaultPrevented;
      };
      const smallWheelPrevented = wheel(0, 20);
      const belowThreshold = active();
      const thresholdWheelPrevented = wheel(0, 28);
      const thresholdSwitched = active();
      wheel(0, 120);
      const sameGestureDebounced = active();
      await new Promise((resolve) => setTimeout(resolve, 180));
      wheel(0, -48);
      const nextGestureSwitched = active();
      await new Promise((resolve) => setTimeout(resolve, 180));
      const horizontalPrevented = wheel(80, 10);
      const horizontalIgnored = active();
      const ctrlPrevented = wheel(0, 60, { ctrlKey: true });
      const ctrlIgnored = active();

      const initialSkill = activeSkills();
      press('r');
      const oneSkillCycleStable = activeSkills();
      press('r', true);
      const repeatSkillCycleIgnored = activeSkills();
      press('q');
      await waitFrames();
      const skillOneLabel = document.querySelector('[data-skill-slot="1"]').getAttribute('aria-label');
      const qKeepsWeapon = active();
      return {
        slots: chips.map((chip) => chip.dataset.slot),
        labelsVisible: chips.every((chip) => chip.textContent.includes(chip.dataset.slot)),
        weaponShortcuts: chips.map((chip) => chip.getAttribute('aria-keyshortcuts')),
        skillSlots: skills.map((skill) => skill.dataset.skillSlot),
        skillDisabled: skills.map((skill) => skill.getAttribute('aria-disabled')),
        skillLabels: initialSkillLabels,
        initial,
        selectedTwo,
        selectedOne,
        repeatWeaponIgnored,
        threeUnbound,
        smallWheelPrevented,
        belowThreshold,
        thresholdWheelPrevented,
        thresholdSwitched,
        sameGestureDebounced,
        nextGestureSwitched,
        horizontalPrevented,
        horizontalIgnored,
        ctrlPrevented,
        ctrlIgnored,
        initialSkill,
        oneSkillCycleStable,
        repeatSkillCycleIgnored,
        skillOneCooling: skillOneLabel.includes('冷却中'),
        qKeepsWeapon,
        bothGuardVisible,
        mouseKeepsGuardVisible,
        allReleasedGuardHidden,
        kHasNoGuard,
      };
    })()`);
    assert.deepEqual(publicControls, {
      slots: ["1", "2"], labelsVisible: true, weaponShortcuts: ["1", "2"],
      skillSlots: ["1", "2", "3"], skillDisabled: ["false", "true", "true"],
      skillLabels: ["技能槽 1：脉冲斩，已选中，就绪", "技能槽 2：待装配", "技能槽 3：待装配"],
      initial: ["1"], selectedTwo: ["2"], selectedOne: ["1"], repeatWeaponIgnored: ["1"], threeUnbound: ["1"],
      smallWheelPrevented: true, belowThreshold: ["1"], thresholdWheelPrevented: true, thresholdSwitched: ["2"],
      sameGestureDebounced: ["2"], nextGestureSwitched: ["1"], horizontalPrevented: false, horizontalIgnored: ["1"],
      ctrlPrevented: false, ctrlIgnored: ["1"], initialSkill: ["1"], oneSkillCycleStable: ["1"],
      repeatSkillCycleIgnored: ["1"], skillOneCooling: true, qKeepsWeapon: ["1"],
      bothGuardVisible: true, mouseKeepsGuardVisible: true, allReleasedGuardHidden: true, kHasNoGuard: true,
    });
    await evaluate(`(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '2' }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: '2' }));
      document.querySelector('#game-canvas').dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
    })()`);
    await delay(220);
    await captureScreenshot(process.env.NEON_SMOKE_BATTLE_SHOT);

    const publicAssets = await evaluate(`(async () => {
      const revision = new URL(document.querySelector('link[rel=stylesheet]').href).searchParams.get('v');
      const fresh = (path) => path + '?v=' + revision + '&blackbox=1';
      const required = [
        'assets/effects/guard-field.png', 'assets/effects/attack-telegraph.png',
        'assets/effects/heavy-telegraph.png', 'assets/effects/rail-round.png',
        'assets/effects/impact-shard.png', 'assets/effects/combo-finisher.png',
        'assets/effects/parry-counter.png', 'assets/effects/skill-core.png',
        'assets/effects/dash-arrival.png', 'assets/effects/execution-burst.png',
        'assets/effects/screen-success-overload.png', 'assets/effects/screen-danger-fracture.png',
        'assets/enemies/skitter-drone.png', 'assets/items/barrier-module.png',
        'assets/ui/power-upgrade.png', 'assets/world/room-floor.png'
      ];
      const retired = [
        'assets/effects/slash-arc.png', 'assets/effects/bullet-impact.png',
        'assets/effects/block-shield.png', 'assets/effects/dash-streak.png',
        'assets/effects/boss-burst.png'
      ];
      const current = await Promise.all(required.map(async (path) => {
        const response = await fetch(fresh(path), { cache: 'no-store' });
        return response.ok && response.headers.get('content-type')?.includes('image/png');
      }));
      const old = await Promise.all(retired.map(async (path) => (await fetch(fresh(path), { cache: 'no-store' })).status));
      return { revision, current, old };
    })()`);
    assert.match(publicAssets.revision, /^[a-f0-9]{12}$/);
    assert.ok(publicAssets.current.every(Boolean));
    assert.deepEqual(publicAssets.old, [404, 404, 404, 404, 404]);
    assert.deepEqual(exceptions, []);
    console.log("Public browser black-box passed: preparation room, purchases, combat start, input, generated art, private debug boundary and retired assets are correct.");
  } else {

  const roomInitial = await evaluate(`(() => {
    const game = window.__NEON_DEBUG__?.game;
    const itemArt = [...document.querySelectorAll('#room-grid .room-item-art img')];
    const arena = game?.arenaCache.canvas;
    let scenePixelsValid = false;
    if (arena) {
      try {
        const context = arena.getContext('2d');
        const colors = [[0.12, 0.18], [0.5, 0.5], [0.82, 0.72]].map(([x, y]) => {
          const pixel = context.getImageData(Math.floor(arena.width * x), Math.floor(arena.height * y), 1, 1).data;
          return [...pixel].join(',');
        });
        scenePixelsValid = colors.every((color) => color.endsWith(',255')) && new Set(colors).size > 1;
      } catch {}
    }
    window.__NEON_ROOM_ARENA_CANVAS__ = arena;
    return {
      state: game?.state,
      visible: document.querySelector('#room-screen').classList.contains('is-active'),
      items: document.querySelector('#room-grid').children.length,
      itemArt: itemArt.length,
      itemArtReady: itemArt.every((image) => image.complete && image.naturalWidth > 0),
      itemArtVersioned: itemArt.every((image) => new URL(image.src).searchParams.has('v')),
      energy: game?.run.energy,
      enemies: game?.enemies.length,
      arenaReady: game?.arenaCache.ready,
      arenaKeyMatches: game?.arenaCache.key === 'room:room:dpr-' + game?.view.dpr,
      arenaSizeCorrect: arena?.width === Math.round((2200 + 320) * game?.view.dpr)
        && arena?.height === Math.round((1400 + 320) * game?.view.dpr),
      scenePixelsValid,
      loadingHidden: !document.querySelector('#loading-screen').classList.contains('is-active'),
      loadingProgress: document.querySelector('#loading-track').getAttribute('aria-valuenow'),
      loadingPercent: document.querySelector('#loading-percent').textContent,
      loadingBusy: document.querySelector('#loading-screen').getAttribute('aria-busy'),
      musicPaused: window.__NEON_DEBUG__?.audio.musicPlaying && window.__NEON_DEBUG__?.audio.musicPaused
    };
  })()`);
  assert.deepEqual(roomInitial, {
    state: "room", visible: true, items: 4, itemArt: 4, itemArtReady: true,
    itemArtVersioned: true, energy: 25, enemies: 0,
    arenaReady: true, arenaKeyMatches: true, arenaSizeCorrect: true, scenePixelsValid: true,
    loadingHidden: true, loadingProgress: "100", loadingPercent: "100%", loadingBusy: "false", musicPaused: true,
  });
  await captureScreenshot(process.env.NEON_SMOKE_ROOM_SHOT);

  await evaluate("document.querySelector('[data-room-item=\"barrier\"]').click()");
  await delay(40);
  assert.deepEqual(await evaluate(`({
    energy: window.__NEON_DEBUG__.game.run.energy,
    barrier: window.__NEON_DEBUG__.game.player.barrier,
    count: window.__NEON_DEBUG__.game.run.purchases.barrier
  })`), { energy: 3, barrier: 40, count: 1 });

  await evaluate("document.querySelector('#room-start-button').click()");
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await evaluate("(window.__NEON_DEBUG__?.game.enemies.length || 0) > 0")) break;
    await delay(100);
  }

  const initial = await evaluate(`(() => {
    const game = window.__NEON_DEBUG__?.game;
    const requiredPaths = ${JSON.stringify(requiredMaterialPaths)};
    const loadedImages = [...Object.values(game?.images || {}), ...document.images];
    const loadedPaths = loadedImages
      .filter((image) => image.complete && image.naturalWidth > 0)
      .map((image) => new URL(image.src).pathname);
    return {
      state: game?.state,
      hud: document.querySelector('#hud').classList.contains('is-active'),
      weapons: document.querySelector('#weapon-dock').children.length,
      weaponSlots: [...document.querySelectorAll('#weapon-dock .weapon-chip')].map((chip) => chip.dataset.slot),
      activeWeaponSlots: [...document.querySelectorAll('#weapon-dock .weapon-chip.is-active')].map((chip) => chip.dataset.slot),
      weaponShortcuts: [...document.querySelectorAll('#weapon-dock .weapon-chip')].map((chip) => chip.getAttribute('aria-keyshortcuts')),
      skillSlots: [...document.querySelectorAll('#skill-dock .skill-slot')].map((chip) => chip.dataset.skillSlot),
      activeSkillSlots: [...document.querySelectorAll('#skill-dock .skill-slot.is-active')].map((chip) => chip.dataset.skillSlot),
      skillDisabled: [...document.querySelectorAll('#skill-dock .skill-slot')].map((chip) => chip.getAttribute('aria-disabled')),
      enemies: game?.enemies.length,
      shape: game?.run.core.name,
      musicRunning: window.__NEON_DEBUG__?.audio.musicPlaying,
      musicBusReady: Boolean(window.__NEON_DEBUG__?.audio.musicBus),
      samplesReady: Object.values(window.__NEON_DEBUG__?.audio.sampleBuffers || {}).every((group) => group.length >= 1),
      audioRolesCorrect: window.__NEON_DEBUG__?.audio.melee.toString().includes('swingWhoosh')
        && window.__NEON_DEBUG__?.audio.hit.toString().includes('bulletImpact')
        && window.__NEON_DEBUG__?.audio.guard.toString().includes('metalBlock')
        && window.__NEON_DEBUG__?.audio.dash.toString().includes('noiseSweep'),
      fixedWeaponScale: !game?.drawWeaponSprite.toString().includes('ctx.scale'),
      generatedArtReady: requiredPaths.every((path) => loadedPaths.some((loaded) => loaded.endsWith('/' + path))),
      retiredSlashAbsent: !loadedPaths.some((path) => path.endsWith('/assets/effects/slash-arc.png'))
        && !game?.renderEffects.toString().includes('slashSprite'),
      dynamicMaterialSampler: typeof game?.drawKeyframedSprite === 'function'
        && game.drawKeyframedSprite.toString().includes('sampleKeyframes'),
      assetPreloadReady: game?.assetLoadState.ready
        && game.assetLoadState.loaded === game.assetLoadState.total
        && game.assetLoadState.failed.length === 0,
      assetImageTotal: game?.assetLoadState.total,
      vfxWarmState: {
        ready: game?.vfxWarmState.ready,
        warmed: game?.vfxWarmState.warmed,
        total: game?.vfxWarmState.total,
        failed: game?.vfxWarmState.failed.length,
      },
      filteredSpriteState: {
        ready: game?.filteredSpriteState.ready,
        prepared: game?.filteredSpriteState.prepared,
        total: game?.filteredSpriteState.total,
        failed: game?.filteredSpriteState.failed.length,
        enemyHit: Object.keys(game?.filteredSprites.enemyHit || {}).length,
        playerSkill: Object.keys(game?.filteredSprites.playerSkill || {}).length,
        playerDash: Object.keys(game?.filteredSprites.playerDash || {}).length,
      },
      screenOverlaySpriteState: {
        ready: game?.screenOverlaySpriteState.ready,
        prepared: game?.screenOverlaySpriteState.prepared,
        warmed: game?.screenOverlaySpriteState.warmed,
        total: game?.screenOverlaySpriteState.total,
        failed: game?.screenOverlaySpriteState.failed.length,
        normal: Object.keys(game?.screenOverlaySprites || {}).filter((key) => key.endsWith(':normal')).length,
        reduced: Object.keys(game?.screenOverlaySprites || {}).filter((key) => key.endsWith(':reduced')).length,
        fullResolution: Object.values(game?.screenOverlaySprites || {}).every((sprite) => sprite.width === 512 && sprite.height === 512),
      },
      arenaCacheState: {
        ready: game?.arenaCache.ready,
        stageKeyMatches: game?.arenaCache.key === 'stage:' + game?.run.stageIndex + ':dpr-' + game?.view.dpr,
        sizeCorrect: game?.arenaCache.canvas?.width === Math.round((2200 + 320) * game?.view.dpr)
          && game?.arenaCache.canvas?.height === Math.round((1400 + 320) * game?.view.dpr),
        previousRoomReleased: window.__NEON_ROOM_ARENA_CANVAS__?.width === 1
          && window.__NEON_ROOM_ARENA_CANVAS__?.height === 1,
        loadingHidden: !document.querySelector('#loading-screen').classList.contains('is-active'),
      },
      assetRevisionCount: new Set(Object.values(game?.images || {})
        .map((image) => new URL(image.src).searchParams.get('v'))).size,
      generatedEnemyRendering: game?.renderEnemy.toString().includes('ENEMY_SPRITES'),
      generatedPlayerRendering: game?.drawPlayerBody.toString().includes('PLAYER_SPRITES')
    };
  })()`);
  assert.equal(initial.state, "playing");
  assert.equal(initial.hud, true);
  assert.equal(initial.weapons, 2);
  assert.deepEqual(initial.weaponSlots, ["1", "2"]);
  assert.deepEqual(initial.activeWeaponSlots, ["1"]);
  assert.deepEqual(initial.weaponShortcuts, ["1", "2"]);
  assert.deepEqual(initial.skillSlots, ["1", "2", "3"]);
  assert.deepEqual(initial.activeSkillSlots, ["1"]);
  assert.deepEqual(initial.skillDisabled, ["false", "true", "true"]);
  assert.ok(initial.enemies > 0);
  assert.equal(initial.shape, "剑锋球体");
  assert.equal(initial.musicRunning, true);
  assert.equal(initial.musicBusReady, true);
  assert.equal(initial.samplesReady, true);
  assert.equal(initial.audioRolesCorrect, true);
  assert.equal(initial.fixedWeaponScale, true);
  assert.equal(initial.generatedArtReady, true);
  assert.equal(initial.retiredSlashAbsent, true);
  assert.equal(initial.dynamicMaterialSampler, true);
  assert.equal(initial.assetPreloadReady, true);
  assert.equal(initial.assetImageTotal, 60);
  assert.equal(initial.vfxWarmState.ready, true);
  assert.equal(initial.vfxWarmState.total, 36);
  assert.equal(initial.vfxWarmState.warmed, initial.vfxWarmState.total);
  assert.equal(initial.vfxWarmState.failed, 0);
  assert.deepEqual(initial.filteredSpriteState, {
    ready: true, prepared: 14, total: 14, failed: 0, enemyHit: 8, playerSkill: 3, playerDash: 3,
  });
  assert.deepEqual(initial.screenOverlaySpriteState, {
    ready: true, prepared: 20, warmed: 20, total: 20, failed: 0, normal: 10, reduced: 10, fullResolution: true,
  });
  assert.deepEqual(initial.arenaCacheState, {
    ready: true, stageKeyMatches: true, sizeCorrect: true, previousRoomReleased: true, loadingHidden: true,
  });
  assert.equal(initial.assetRevisionCount, 1);
  assert.equal(initial.generatedEnemyRendering, true);
  assert.equal(initial.generatedPlayerRendering, true);

  const screenFeedback = await evaluate(`(() => {
    const game = window.__NEON_DEBUG__.game;
    const previous = {
      screenFlash: game.screenFlash,
      screenFlashClock: game.screenFlashClock,
      screenFlashNextAt: game.screenFlashNextAt,
      screenFlashLastByKind: game.screenFlashLastByKind,
      reduceFlash: game.settings.reduceFlash,
      effects: game.effects,
      pickups: game.pickups,
      damageTexts: game.damageTexts,
      kills: game.run.kills,
      defeated: game.run.stageDefeated,
      attackIndex: game.player.attackIndex,
    };
    const resetFlash = () => {
      game.screenFlash = null;
      game.screenFlashClock = 10;
      game.screenFlashNextAt = 0;
      game.screenFlashLastByKind = Object.create(null);
    };
    const makeEnemy = (hp = 1000) => ({
      x: game.player.x + 70, y: game.player.y, radius: 18,
      hp, maxHp: hp, dead: false, energy: 1, elite: false, boss: false,
      color: '#ff4f8b', rotation: 0, hitFlash: 0, pushX: 0, pushY: 0,
    });
    const renderSample = (kind, reduced) => {
      resetFlash();
      game.settings.reduceFlash = reduced;
      const accepted = game.triggerScreenFlash(kind);
      game.screenFlash.life = game.screenFlash.maxLife * 0.9;
      let edgeAlpha = 0;
      let tintAlpha = 0;
      let tint = '';
      let imagePath = '';
      let compositeUsed = false;
      let compositeWidth = 0;
      let compositeHeight = 0;
      let fallbackTintDraws = 0;
      const effect = game.screenFlash;
      const composite = game.screenOverlaySprites[kind + ':' + (reduced ? 'reduced' : 'normal')];
      const sourceImage = game.images[effect.family === 'success' ? 'screenSuccess' : 'screenDanger'];
      const originalDrawImage = game.ctx.drawImage;
      const originalFillRect = game.ctx.fillRect;
      game.ctx.drawImage = function(image, ...args) {
        if (image === composite) {
          edgeAlpha = this.globalAlpha;
          compositeUsed = true;
          compositeWidth = image.width;
          compositeHeight = image.height;
          imagePath = new URL(sourceImage.src).pathname;
        }
        return originalDrawImage.call(this, image, ...args);
      };
      game.ctx.fillRect = function(...args) {
        fallbackTintDraws += 1;
        return originalFillRect.call(this, ...args);
      };
      let rendered = false;
      try {
        game.ctx.save();
        game.ctx.globalAlpha = 1;
        rendered = game.renderScreenFlash(game.ctx);
        game.ctx.restore();
      } finally {
        game.ctx.drawImage = originalDrawImage;
        game.ctx.fillRect = originalFillRect;
      }
      const reducedScale = reduced ? 0.24 : 1;
      const edgePeak = reduced ? Math.min(0.1, effect.edgeAlpha * reducedScale) : effect.edgeAlpha;
      const tintPeak = reduced ? Math.min(0.02, effect.tintAlpha * reducedScale) : effect.tintAlpha;
      const frameAlpha = edgePeak ? edgeAlpha / edgePeak : 0;
      tintAlpha = tintPeak * frameAlpha;
      tint = effect.family === 'success' ? '#4df6ff' : '#ff2e67';
      return {
        accepted, rendered, edgeAlpha, tintAlpha, tint, imagePath,
        compositeUsed, compositeWidth, compositeHeight, fallbackTintDraws,
      };
    };

    game.effects = [];
    game.pickups = [];
    game.damageTexts = [];
    try {
      resetFlash();
      const firstAccepted = game.triggerScreenFlash('combo');
      const firstObject = game.screenFlash;
      game.updateScreenFlash(0.06);
      const progressBeforeUpgrade = 1 - game.screenFlash.life / game.screenFlash.maxLife;
      const nextAtBeforeUpgrade = game.screenFlashNextAt;
      const higherAccepted = game.triggerScreenFlash('execution');
      const stayedSameObject = game.screenFlash === firstObject;
      const progressAfterUpgrade = 1 - game.screenFlash.life / game.screenFlash.maxLife;
      const priorityKind = game.screenFlash?.kind;
      const progressPreserved = Math.abs(progressAfterUpgrade - progressBeforeUpgrade) < 0.000001;
      const nextAtNotRestarted = game.screenFlashNextAt === nextAtBeforeUpgrade;
      const singletonCount = Number(Boolean(game.screenFlash)) + Number(Array.isArray(game.screenFlash));

      resetFlash();
      const parryAccepted = game.triggerScreenFlash('parry');
      const parryObject = game.screenFlash;
      const parryNextAt = game.screenFlashNextAt;
      const executionAfterParryAccepted = game.triggerScreenFlash('execution');
      const parryStayedActive = game.screenFlash === parryObject && game.screenFlash?.kind === 'parry';
      const parryCooldownUnchanged = game.screenFlashNextAt === parryNextAt;

      resetFlash();
      const initialDash = game.triggerScreenFlash('dash');
      const duplicateDash = game.triggerScreenFlash('dash');
      game.updateScreenFlash(0.17);
      const blockedInsideGlobalWindow = game.triggerScreenFlash('dash');
      game.updateScreenFlash(0.18);
      const acceptedAfterGlobalWindow = game.triggerScreenFlash('dash');

      resetFlash();
      game.player.attackIndex = 0;
      game.damageEnemy(makeEnemy(1000), 1, 'melee', { x: 1, y: 0 }, 0);
      const ordinaryHitStayedLocal = game.screenFlash === null;
      game.damageEnemy(makeEnemy(1), 2, 'melee', { x: 1, y: 0 }, 0);
      const ordinaryKillStayedLocal = game.screenFlash === null;

      resetFlash();
      game.player.attackIndex = 2;
      game.damageEnemy(makeEnemy(1000), 1, 'melee', { x: 1, y: 0 }, 0);
      const comboKind = game.screenFlash?.kind;

      resetFlash();
      game.killEnemy(makeEnemy(1), { finisher: true });
      const executionKind = game.screenFlash?.kind;

      const success = renderSample('parry', false);
      const successReduced = renderSample('parry', true);
      const danger = renderSample('execution', false);
      const dangerReduced = renderSample('execution', true);

      resetFlash();
      game.triggerScreenFlash('parry');
      const expiryDuration = game.screenFlash.maxLife;
      game.updateScreenFlash(expiryDuration + 0.01);

      return {
        firstAccepted,
        stayedSameObject,
        higherAccepted,
        priorityKind,
        progressPreserved,
        nextAtNotRestarted,
        singletonCount,
        parryAccepted,
        executionAfterParryAccepted,
        parryStayedActive,
        parryCooldownUnchanged,
        initialDash,
        duplicateDash,
        blockedInsideGlobalWindow,
        acceptedAfterGlobalWindow,
        ordinaryHitStayedLocal,
        ordinaryKillStayedLocal,
        comboKind,
        executionKind,
        expired: game.screenFlash === null,
        success,
        successReduced,
        danger,
        dangerReduced,
      };
    } finally {
      game.screenFlash = previous.screenFlash;
      game.screenFlashClock = previous.screenFlashClock;
      game.screenFlashNextAt = previous.screenFlashNextAt;
      game.screenFlashLastByKind = previous.screenFlashLastByKind;
      game.settings.reduceFlash = previous.reduceFlash;
      game.effects = previous.effects;
      game.pickups = previous.pickups;
      game.damageTexts = previous.damageTexts;
      game.run.kills = previous.kills;
      game.run.stageDefeated = previous.defeated;
      game.player.attackIndex = previous.attackIndex;
    }
  })()`);
  assert.deepEqual({
    firstAccepted: screenFeedback.firstAccepted,
    stayedSameObject: screenFeedback.stayedSameObject,
    higherAccepted: screenFeedback.higherAccepted,
    priorityKind: screenFeedback.priorityKind,
    progressPreserved: screenFeedback.progressPreserved,
    nextAtNotRestarted: screenFeedback.nextAtNotRestarted,
    singletonCount: screenFeedback.singletonCount,
    parryAccepted: screenFeedback.parryAccepted,
    executionAfterParryAccepted: screenFeedback.executionAfterParryAccepted,
    parryStayedActive: screenFeedback.parryStayedActive,
    parryCooldownUnchanged: screenFeedback.parryCooldownUnchanged,
    initialDash: screenFeedback.initialDash,
    duplicateDash: screenFeedback.duplicateDash,
    blockedInsideGlobalWindow: screenFeedback.blockedInsideGlobalWindow,
    acceptedAfterGlobalWindow: screenFeedback.acceptedAfterGlobalWindow,
    ordinaryHitStayedLocal: screenFeedback.ordinaryHitStayedLocal,
    ordinaryKillStayedLocal: screenFeedback.ordinaryKillStayedLocal,
    comboKind: screenFeedback.comboKind,
    executionKind: screenFeedback.executionKind,
    expired: screenFeedback.expired,
  }, {
    firstAccepted: true,
    stayedSameObject: true,
    higherAccepted: true,
    priorityKind: "execution",
    progressPreserved: true,
    nextAtNotRestarted: true,
    singletonCount: 1,
    parryAccepted: true,
    executionAfterParryAccepted: false,
    parryStayedActive: true,
    parryCooldownUnchanged: true,
    initialDash: true,
    duplicateDash: false,
    blockedInsideGlobalWindow: false,
    acceptedAfterGlobalWindow: true,
    ordinaryHitStayedLocal: true,
    ordinaryKillStayedLocal: true,
    comboKind: "combo",
    executionKind: "execution",
    expired: true,
  });
  assert.deepEqual({
    successAccepted: screenFeedback.success.accepted,
    successRendered: screenFeedback.success.rendered,
    successPath: screenFeedback.success.imagePath,
    successTint: screenFeedback.success.tint,
    dangerAccepted: screenFeedback.danger.accepted,
    dangerRendered: screenFeedback.danger.rendered,
    dangerPath: screenFeedback.danger.imagePath,
    dangerTint: screenFeedback.danger.tint,
  }, {
    successAccepted: true,
    successRendered: true,
    successPath: "/assets/effects/screen-success-overload.png",
    successTint: "#4df6ff",
    dangerAccepted: true,
    dangerRendered: true,
    dangerPath: "/assets/effects/screen-danger-fracture.png",
    dangerTint: "#ff2e67",
  });
  for (const [normal, reduced] of [
    [screenFeedback.success, screenFeedback.successReduced],
    [screenFeedback.danger, screenFeedback.dangerReduced],
  ]) {
    assert.equal(normal.compositeUsed, true);
    assert.equal(reduced.compositeUsed, true);
    assert.deepEqual([normal.compositeWidth, normal.compositeHeight], [512, 512]);
    assert.deepEqual([reduced.compositeWidth, reduced.compositeHeight], [512, 512]);
    assert.equal(normal.fallbackTintDraws, 0);
    assert.equal(reduced.fallbackTintDraws, 0);
    assert.ok(normal.edgeAlpha > 0 && normal.tintAlpha > 0);
    assert.ok(reduced.edgeAlpha > 0 && reduced.edgeAlpha <= 0.100001);
    assert.ok(reduced.tintAlpha > 0 && reduced.tintAlpha <= 0.020001);
    assert.ok(reduced.edgeAlpha / normal.edgeAlpha <= 0.240001);
    assert.ok(reduced.tintAlpha / normal.tintAlpha <= 0.240001);
  }

  const controlRouting = await evaluate(`(() => {
    const game = window.__NEON_DEBUG__.game;
    const player = game.player;
    const keyDown = (key, repeat = false) => window.dispatchEvent(new KeyboardEvent('keydown', { key, repeat }));
    const keyUp = (key) => window.dispatchEvent(new KeyboardEvent('keyup', { key }));
    const press = (key, repeat = false) => {
      keyDown(key, repeat);
      keyUp(key);
    };
    const clickPrimary = () => game.canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
    const activeHudSlots = () => [...document.querySelectorAll('#weapon-dock .weapon-chip.is-active')]
      .map((chip) => Number(chip.dataset.slot));
    const activeHudSkills = () => [...document.querySelectorAll('#skill-dock .skill-slot.is-active')]
      .map((chip) => Number(chip.dataset.skillSlot));
    const wheel = (deltaX, deltaY, options = {}) => {
      const event = new WheelEvent('wheel', {
        deltaX, deltaY, deltaMode: options.deltaMode || 0, ctrlKey: Boolean(options.ctrlKey),
        bubbles: true, cancelable: true,
      });
      game.canvas.dispatchEvent(event);
      return event.defaultPrevented;
    };
    const captureHeldWeapons = () => {
      const paths = [];
      const originalDrawImage = game.ctx.drawImage;
      game.ctx.drawImage = function(source, ...args) {
        if (source?.src) paths.push(new URL(source.src).pathname);
        return originalDrawImage.call(this, source, ...args);
      };
      try {
        game.renderPlayer(game.ctx, performance.now() / 1000);
      } finally {
        game.ctx.drawImage = originalDrawImage;
      }
      return {
        melee: paths.filter((path) => path.endsWith('/assets/items/energy-sword.png')).length,
        pistol: paths.filter((path) => path.endsWith('/assets/items/rail-pistol.png')).length,
      };
    };
    const prepareRanged = () => {
      game.blockInputs.clear();
      player.action = 'idle';
      player.blockHeld = false;
      player.rangedCooldown = 0;
      player.reloadTimer = 0;
      player.ammo = player.maxAmmo;
    };
    const originalEnemies = game.enemies;
    const originalSkillSlots = [...game.run.skillSlots];
    const originalBarrier = player.barrier;
    game.enemies = [];

    game.applyWeaponSlot(1);
    prepareRanged();
    game.projectiles = [];
    game.effects = [];
    const selectionAmmo = player.ammo;
    const selectionProjectiles = game.projectiles.length;
    press('2');
    const selectionOnly = player.activeWeaponSlot === 2
      && player.pendingWeaponSlot === null
      && player.ammo === selectionAmmo
      && game.projectiles.length === selectionProjectiles
      && player.action === 'idle';
    const slotTwoHud = activeHudSlots();
    const slotTwoRender = captureHeldWeapons();

    const mouseAmmo = player.ammo;
    const mouseProjectiles = game.projectiles.length;
    game.camera.x = player.x;
    game.camera.y = player.y;
    game.pointer.active = true;
    game.pointer.x = game.view.width / 2 + 240;
    game.pointer.y = game.view.height / 2;
    clickPrimary();
    const mouseProjectile = game.projectiles.at(-1);
    const primaryRanged = player.ammo === mouseAmmo - 1
      && game.projectiles.length === mouseProjectiles + 1
      && player.activeWeaponSlot === 2
      && mouseProjectile.vx > 0
      && Math.abs(mouseProjectile.vy) < 0.001;

    prepareRanged();
    game.applyWeaponSlot(1);
    player.skillCooldowns.fill(0);
    player.activeSkillSlot = 1;
    game.run.skillSlots = [originalSkillSlots[0], null, null];
    game.effects = [];
    const qAmmo = player.ammo;
    const qProjectiles = game.projectiles.length;
    press('q');
    const qEffectCount = game.effects.length;
    const qActivatesCurrentSkill = player.ammo === qAmmo
      && game.projectiles.length === qProjectiles
      && player.activeWeaponSlot === 1
      && player.activeSkillSlot === 1
      && player.action === 'skill'
      && player.skillCooldowns[0] > 0
      && qEffectCount > 0;
    press('q', true);
    const qRepeatIgnored = game.effects.length === qEffectCount;
    const qSkillRender = captureHeldWeapons();

    prepareRanged();
    player.skillCooldowns.fill(0);
    player.activeSkillSlot = 1;
    game.emitHud(true);
    press('r');
    const oneSkillCycleStable = player.activeSkillSlot === 1 && activeHudSkills().join(',') === '1';
    press('r', true);
    const rRepeatIgnored = player.activeSkillSlot === 1 && activeHudSkills().join(',') === '1';

    game.run.skillSlots = ['pulseSlash', null, 'barrier'];
    player.activeSkillSlot = 1;
    game.emitHud(true);
    press('r');
    const futureCycleSkipsEmpty = player.activeSkillSlot === 3 && activeHudSkills().join(',') === '3';
    press('r');
    const futureCycleWraps = player.activeSkillSlot === 1 && activeHudSkills().join(',') === '1';
    game.cycleSkillSlot(-1);
    const futureReverseCycle = player.activeSkillSlot === 3 && activeHudSkills().join(',') === '3';
    const emptySelectionRejected = game.selectSkillSlot(2) === false
      && player.activeSkillSlot === 3 && activeHudSkills().join(',') === '3';
    const uniqueActiveSkill = document.querySelectorAll('#skill-dock .skill-slot.is-active').length === 1;
    game.run.skillSlots = [...originalSkillSlots];
    player.activeSkillSlot = 1;
    game.emitHud(true);

    prepareRanged();
    game.applyWeaponSlot(1);
    const unboundEffects = game.effects.length;
    const unboundCooldowns = [...player.skillCooldowns];
    press('3');
    press('k');
    const threeAndKUnbound = player.activeWeaponSlot === 1
      && player.activeSkillSlot === 1
      && player.action === 'idle'
      && game.blockInputs.size === 0
      && game.effects.length === unboundEffects
      && player.skillCooldowns.every((value, index) => value === unboundCooldowns[index]);

    game.resetWeaponWheelGesture();
    const wheelSmallPrevented = wheel(0, 20);
    const wheelBelowThreshold = player.activeWeaponSlot === 1;
    const wheelSecondSmallPrevented = wheel(0, 27);
    const wheelStillBelowThreshold = player.activeWeaponSlot === 1;
    const wheelThresholdPrevented = wheel(0, 1);
    const wheelThresholdSwitch = player.activeWeaponSlot === 2;
    wheel(0, 120);
    const wheelGestureDebounced = player.activeWeaponSlot === 2;
    game.resetWeaponWheelGesture();
    const wheelLinePrevented = wheel(0, -3, { deltaMode: 1 });
    const wheelLineNormalized = player.activeWeaponSlot === 1;
    game.resetWeaponWheelGesture();
    const wheelHorizontalPrevented = wheel(80, 10);
    const wheelHorizontalIgnored = player.activeWeaponSlot === 1;
    const wheelCtrlPrevented = wheel(0, 60, { ctrlKey: true });
    const wheelCtrlIgnored = player.activeWeaponSlot === 1;

    prepareRanged();
    game.applyWeaponSlot(1);
    const slotOneRender = captureHeldWeapons();
    const meleeAmmo = player.ammo;
    clickPrimary();
    const primaryMelee = player.action === 'attack'
      && player.ammo === meleeAmmo
      && player.activeWeaponSlot === 1;
    player.action = 'idle';
    player.comboQueued = false;

    prepareRanged();
    game.applyWeaponSlot(2);
    const directMeleeAmmo = player.ammo;
    game.requestAttack();
    const directMeleeSelectsSlotOne = player.activeWeaponSlot === 1
      && player.action === 'attack'
      && player.ammo === directMeleeAmmo;

    prepareRanged();
    game.applyWeaponSlot(1);
    player.action = 'block';
    player.blockHeld = true;
    const blockedMeleeAmmo = player.ammo;
    game.requestPrimaryAttack();
    const blockedMeleeStarts = player.activeWeaponSlot === 1
      && player.action === 'attack'
      && player.blockHeld === false
      && player.ammo === blockedMeleeAmmo;

    prepareRanged();
    game.applyWeaponSlot(2);
    player.action = 'block';
    player.blockHeld = true;
    const blockedRangedAmmo = player.ammo;
    const blockedRangedProjectiles = game.projectiles.length;
    game.requestPrimaryAttack();
    const blockedRangedStarts = player.activeWeaponSlot === 2
      && player.action === 'idle'
      && player.blockHeld === false
      && player.ammo === blockedRangedAmmo - 1
      && game.projectiles.length === blockedRangedProjectiles + 1;
    player.action = 'idle';

    const queuedStates = ['attack', 'block', 'dash', 'broken', 'skill'].map((action) => {
      game.applyWeaponSlot(1);
      player.action = action;
      press('2');
      const queued = player.activeWeaponSlot === 1 && player.pendingWeaponSlot === 2;
      player.action = 'idle';
      game.applyPendingWeaponSlot();
      const applied = player.activeWeaponSlot === 2 && player.pendingWeaponSlot === null;
      return { action, queued, applied };
    });

    prepareRanged();
    game.applyWeaponSlot(2);
    const touchAttackAmmo = player.ammo;
    const touchAttackProjectiles = game.projectiles.length;
    document.querySelector('#touch-attack').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const touchAttackUsesSlot = player.ammo === touchAttackAmmo - 1
      && game.projectiles.length === touchAttackProjectiles + 1
      && player.activeWeaponSlot === 2;

    prepareRanged();
    game.applyWeaponSlot(1);
    const touchRangedAmmo = player.ammo;
    const touchRangedProjectiles = game.projectiles.length;
    document.querySelector('#touch-ranged').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const touchRangedQuickFire = player.ammo === touchRangedAmmo - 1
      && game.projectiles.length === touchRangedProjectiles + 1
      && player.activeWeaponSlot === 1;

    prepareRanged();
    game.run.skillSlots = ['pulseSlash', null, 'barrier'];
    player.activeSkillSlot = 3;
    player.skillCooldowns.fill(0);
    player.barrier = 0;
    game.effects = [];
    document.querySelector('#touch-skill').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const touchSkillUsesCurrent = player.action === 'skill'
      && player.activeSkillSlot === 3
      && player.skillCooldowns[2] > 0
      && player.skillCooldowns[0] === 0
      && player.barrier >= 55;
    game.run.skillSlots = [...originalSkillSlots];
    player.activeSkillSlot = 1;
    player.barrier = originalBarrier;
    player.skillCooldowns.fill(0);
    game.emitHud(true);

    prepareRanged();
    keyDown('e');
    const keyboardGuard = player.action === 'block' && player.blockHeld
      && [...game.blockInputs].join(',') === 'keyboard';
    keyDown('e', true);
    const guardRepeatIgnored = game.blockInputs.size === 1;
    game.canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 2, bubbles: true }));
    const keyboardAndMouseGuard = player.action === 'block' && player.blockHeld
      && game.blockInputs.has('keyboard') && game.blockInputs.has('mouse');
    keyUp('e');
    const mouseKeepsGuard = player.action === 'block' && player.blockHeld
      && !game.blockInputs.has('keyboard') && game.blockInputs.has('mouse');
    document.querySelector('#touch-block').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointerup', { button: 2, bubbles: true }));
    const touchKeepsGuard = player.action === 'block' && player.blockHeld
      && !game.blockInputs.has('mouse') && game.blockInputs.has('touch');
    document.querySelector('#touch-block').dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    const allGuardReleased = player.action === 'idle' && !player.blockHeld && game.blockInputs.size === 0;
    const menuEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    game.canvas.dispatchEvent(menuEvent);
    const contextMenuSuppressed = menuEvent.defaultPrevented;

    prepareRanged();
    player.stamina = player.maxStamina;
    player.skillCooldowns.fill(0);
    keyDown('e');
    press('q');
    const skillInterruptKeepsSource = player.action === 'skill' && !player.blockHeld
      && game.blockInputs.has('keyboard');
    game.updatePlayer(0.4);
    const guardReturnsAfterSkill = player.action === 'block' && player.blockHeld
      && game.blockInputs.has('keyboard');
    keyUp('e');

    prepareRanged();
    game.applyWeaponSlot(1);
    player.stamina = player.maxStamina;
    keyDown('e');
    clickPrimary();
    press('2');
    const attackInterruptKeepsSource = player.action === 'attack' && !player.blockHeld
      && game.blockInputs.has('keyboard') && player.activeWeaponSlot === 1
      && player.pendingWeaponSlot === 2;
    for (let index = 0; index < 8; index += 1) game.updatePlayer(0.08);
    const guardReturnsAfterAttack = player.action === 'block' && player.blockHeld
      && game.blockInputs.has('keyboard') && player.activeWeaponSlot === 2
      && player.pendingWeaponSlot === null;
    keyUp('e');

    prepareRanged();
    player.stamina = player.maxStamina;
    keyDown('e');
    game.breakGuard();
    const breakGuardClearsSources = player.action === 'broken' && !player.blockHeld
      && game.blockInputs.size === 0;
    game.updatePlayer(1);
    const breakGuardDoesNotAutoReturn = player.action === 'idle' && !player.blockHeld
      && game.blockInputs.size === 0;
    keyUp('e');
    player.stamina = player.maxStamina;

    prepareRanged();
    game.applyWeaponSlot(1);
    press('2', true);
    const repeatIgnored = player.activeWeaponSlot === 1 && player.pendingWeaponSlot === null;
    const restoredHud = activeHudSlots();
    game.enemies = originalEnemies;
    game.run.skillSlots = [...originalSkillSlots];
    player.activeSkillSlot = 1;
    player.barrier = originalBarrier;
    player.skillCooldowns.fill(0);
    game.emitHud(true);
    game.projectiles = [];
    game.effects = [];
    return {
      selectionOnly,
      slotTwoHud,
      slotTwoRender,
      primaryRanged,
      qActivatesCurrentSkill,
      qRepeatIgnored,
      qSkillRender,
      oneSkillCycleStable,
      rRepeatIgnored,
      futureCycleSkipsEmpty,
      futureCycleWraps,
      futureReverseCycle,
      emptySelectionRejected,
      uniqueActiveSkill,
      threeAndKUnbound,
      wheelSmallPrevented,
      wheelBelowThreshold,
      wheelSecondSmallPrevented,
      wheelStillBelowThreshold,
      wheelThresholdPrevented,
      wheelThresholdSwitch,
      wheelGestureDebounced,
      wheelLinePrevented,
      wheelLineNormalized,
      wheelHorizontalPrevented,
      wheelHorizontalIgnored,
      wheelCtrlPrevented,
      wheelCtrlIgnored,
      slotOneRender,
      primaryMelee,
      directMeleeSelectsSlotOne,
      blockedMeleeStarts,
      blockedRangedStarts,
      queuedStates,
      touchAttackUsesSlot,
      touchRangedQuickFire,
      touchSkillUsesCurrent,
      keyboardGuard,
      guardRepeatIgnored,
      keyboardAndMouseGuard,
      mouseKeepsGuard,
      touchKeepsGuard,
      allGuardReleased,
      contextMenuSuppressed,
      skillInterruptKeepsSource,
      guardReturnsAfterSkill,
      attackInterruptKeepsSource,
      guardReturnsAfterAttack,
      breakGuardClearsSources,
      breakGuardDoesNotAutoReturn,
      repeatIgnored,
      restoredHud,
    };
  })()`);
  assert.deepEqual(controlRouting, {
    selectionOnly: true,
    slotTwoHud: [2],
    slotTwoRender: { melee: 0, pistol: 1 },
    primaryRanged: true,
    qActivatesCurrentSkill: true,
    qRepeatIgnored: true,
    qSkillRender: { melee: 1, pistol: 0 },
    oneSkillCycleStable: true,
    rRepeatIgnored: true,
    futureCycleSkipsEmpty: true,
    futureCycleWraps: true,
    futureReverseCycle: true,
    emptySelectionRejected: true,
    uniqueActiveSkill: true,
    threeAndKUnbound: true,
    wheelSmallPrevented: true,
    wheelBelowThreshold: true,
    wheelSecondSmallPrevented: true,
    wheelStillBelowThreshold: true,
    wheelThresholdPrevented: true,
    wheelThresholdSwitch: true,
    wheelGestureDebounced: true,
    wheelLinePrevented: true,
    wheelLineNormalized: true,
    wheelHorizontalPrevented: false,
    wheelHorizontalIgnored: true,
    wheelCtrlPrevented: false,
    wheelCtrlIgnored: true,
    slotOneRender: { melee: 1, pistol: 0 },
    primaryMelee: true,
    directMeleeSelectsSlotOne: true,
    blockedMeleeStarts: true,
    blockedRangedStarts: true,
    queuedStates: ["attack", "block", "dash", "broken", "skill"].map((action) => ({ action, queued: true, applied: true })),
    touchAttackUsesSlot: true,
    touchRangedQuickFire: true,
    touchSkillUsesCurrent: true,
    keyboardGuard: true,
    guardRepeatIgnored: true,
    keyboardAndMouseGuard: true,
    mouseKeepsGuard: true,
    touchKeepsGuard: true,
    allGuardReleased: true,
    contextMenuSuppressed: true,
    skillInterruptKeepsSource: true,
    guardReturnsAfterSkill: true,
    attackInterruptKeepsSource: true,
    guardReturnsAfterAttack: true,
    breakGuardClearsSources: true,
    breakGuardDoesNotAutoReturn: true,
    repeatIgnored: true,
    restoredHud: [1],
  });

  const cachedArenaFrame = await evaluate(`(() => {
    const game = window.__NEON_DEBUG__.game;
    const arena = game.arenaCache.canvas;
    const originalWorldProp = game.drawWorldProp;
    const originalDrawImage = game.ctx.drawImage;
    let worldPropCalls = 0;
    let arenaDrawCalls = 0;
    game.drawWorldProp = function(...args) {
      worldPropCalls += 1;
      return originalWorldProp.apply(this, args);
    };
    game.ctx.drawImage = function(source, ...args) {
      if (source === arena) arenaDrawCalls += 1;
      return originalDrawImage.call(this, source, ...args);
    };
    let scenePixelsValid = false;
    try {
      game.renderArena(game.ctx);
      const context = arena.getContext('2d');
      const colors = [[0.08, 0.1], [0.5, 0.5], [0.9, 0.86]].map(([x, y]) => {
        const pixel = context.getImageData(Math.floor(arena.width * x), Math.floor(arena.height * y), 1, 1).data;
        return [...pixel].join(',');
      });
      scenePixelsValid = colors.every((color) => color.endsWith(',255')) && new Set(colors).size > 1;
    } finally {
      game.drawWorldProp = originalWorldProp;
      game.ctx.drawImage = originalDrawImage;
    }
    return { worldPropCalls, arenaDrawCalls, scenePixelsValid };
  })()`);
  assert.deepEqual(cachedArenaFrame, { worldPropCalls: 0, arenaDrawCalls: 1, scenePixelsValid: true });

  const filteredRuntimeSprites = await evaluate(`(() => {
    const game = window.__NEON_DEBUG__.game;
    const previousAction = game.player.action;
    const previousEnemies = game.enemies;
    const captures = [];
    const originalDrawImage = game.ctx.drawImage;
    game.ctx.drawImage = function(source, ...args) {
      captures.push(source);
      return originalDrawImage.call(this, source, ...args);
    };
    const capturePlayer = (action) => {
      captures.length = 0;
      game.player.action = action;
      game.drawPlayerBody(game.ctx, performance.now() / 1000);
      return [...captures];
    };
    try {
      const originalEnemy = game.images.enemyMelee;
      const enemyHit = game.filteredSprites.enemyHit.enemyMelee;
      const playerOriginal = game.images.playerHunter;
      const playerSkill = game.filteredSprites.playerSkill.playerHunter;
      const playerDash = game.filteredSprites.playerDash.playerHunter;
      game.enemies = [];
      const enemy = game.spawnEnemy('chaser', false, { x: game.player.x + 150, y: game.player.y });
      enemy.state = 'chase';
      enemy.hitFlash = 1;
      captures.length = 0;
      game.renderEnemy(game.ctx, enemy, performance.now() / 1000);
      const enemySources = [...captures];
      const dashSources = capturePlayer('dash');
      const skillSources = capturePlayer('skill');
      const sourceSize = (source) => ({
        width: source?.naturalWidth || source?.width || 0,
        height: source?.naturalHeight || source?.height || 0,
      });
      const sameSize = (cached, original) => {
        const cachedSize = sourceSize(cached);
        const originalSize = sourceSize(original);
        return cachedSize.width === originalSize.width && cachedSize.height === originalSize.height;
      };
      return {
        cachesExist: Boolean(enemyHit && playerSkill && playerDash),
        fullResolution: sameSize(enemyHit, originalEnemy)
          && sameSize(playerSkill, playerOriginal) && sameSize(playerDash, playerOriginal),
        enemyHitUsesCache: enemySources.includes(enemyHit) && !enemySources.includes(originalEnemy),
        dashUsesCache: dashSources.length === 1 && dashSources[0] === playerDash,
        skillUsesCache: skillSources.length === 2 && skillSources.every((source) => source === playerSkill),
        runtimeEnemyFilterAbsent: !game.renderEnemy.toString().includes('ctx.filter'),
        runtimePlayerFilterAbsent: !game.drawPlayerBody.toString().includes('ctx.filter'),
      };
    } finally {
      game.ctx.drawImage = originalDrawImage;
      game.player.action = previousAction;
      game.enemies = previousEnemies;
    }
  })()`);
  assert.deepEqual(filteredRuntimeSprites, {
    cachesExist: true,
    fullResolution: true,
    enemyHitUsesCache: true,
    dashUsesCache: true,
    skillUsesCache: true,
    runtimeEnemyFilterAbsent: true,
    runtimePlayerFilterAbsent: true,
  });

  const telegraphMaterials = await evaluate(`(() => {
    const game = window.__NEON_DEBUG__.game;
    const previousEnemies = game.enemies;
    const previousEffects = game.effects;
    game.enemies = [];
    game.effects = [];
    const normal = game.spawnEnemy('chaser', false, { x: game.player.x + 150, y: game.player.y });
    const heavy = game.spawnEnemy('brute', false, { x: game.player.x + 190, y: game.player.y + 20 });
    normal.state = 'windup';
    heavy.state = 'windup';
    normal.rotation = 0;
    heavy.rotation = 0;
    const drawn = [];
    let arcCalls = 0;
    const originalDrawImage = game.ctx.drawImage;
    const originalArc = game.ctx.arc;
    game.ctx.drawImage = function(image, ...args) {
      if (image?.src) drawn.push({ path: new URL(image.src).pathname, width: args[2], alpha: this.globalAlpha });
      return originalDrawImage.call(this, image, ...args);
    };
    game.ctx.arc = function(...args) {
      arcCalls += 1;
      return originalArc.call(this, ...args);
    };
    const capture = (enemy, progress) => {
      const start = drawn.length;
      enemy.stateTimer = (enemy.windup || 0.5) * (1 - progress);
      game.renderEnemy(game.ctx, enemy, performance.now() / 1000);
      return drawn.slice(start);
    };
    try {
      var normalEarly = capture(normal, 0.1);
      var normalLate = capture(normal, 0.82);
      var heavyEarly = capture(heavy, 0.1);
      var heavyLate = capture(heavy, 0.82);
    } finally {
      game.ctx.drawImage = originalDrawImage;
      game.ctx.arc = originalArc;
      game.enemies = previousEnemies;
      game.effects = previousEffects;
    }
    const find = (items, name) => items.find((item) => item.path.endsWith('/assets/effects/' + name));
    const normalA = find(normalEarly, 'attack-telegraph.png');
    const normalB = find(normalLate, 'attack-telegraph.png');
    const heavyA = find(heavyEarly, 'heavy-telegraph.png');
    const heavyB = find(heavyLate, 'heavy-telegraph.png');
    return {
      normalDrawn: Boolean(normalA && normalB),
      heavyDrawn: Boolean(heavyA && heavyB),
      normalAnimated: Boolean(normalA && normalB && (Math.abs(normalA.width - normalB.width) > 0.1 || Math.abs(normalA.alpha - normalB.alpha) > 0.01)),
      heavyAnimated: Boolean(heavyA && heavyB && (Math.abs(heavyA.width - heavyB.width) > 0.1 || Math.abs(heavyA.alpha - heavyB.alpha) > 0.01)),
      noProgramFan: arcCalls === 0
    };
  })()`);
  assert.deepEqual(telegraphMaterials, {
    normalDrawn: true, heavyDrawn: true, normalAnimated: true, heavyAnimated: true, noProgramFan: true,
  });

  const musicLifecycle = await evaluate(`(() => {
    const { game, audio } = window.__NEON_DEBUG__;
    game.pause(true);
    const paused = audio.musicPlaying && audio.musicPaused;
    game.resume();
    return { paused, resumed: audio.musicPlaying && !audio.musicPaused };
  })()`);
  assert.deepEqual(musicLifecycle, { paused: true, resumed: true });

  const attackVisual = await evaluate(`(() => {
    const game = window.__NEON_DEBUG__.game;
    const previousEnemies = game.enemies;
    const previousEffects = game.effects;
    game.enemies = [];
    const attackEffects = [];
    game.effects = attackEffects;
    const primary = game.weaponTipTrails.primary;
    primary.start = 0;
    primary.count = 0;
    primary.stroke = 0;
    primary.sampleTimer = 1;
    const drawn = [];
    let trailLineCount = 0;
    const originalDrawImage = game.ctx.drawImage;
    const originalLineTo = game.ctx.lineTo;
    game.player.action = 'idle';
    game.player.blockHeld = false;
    game.applyWeaponSlot(1);
    game.ctx.drawImage = function(image, ...args) {
      if (image?.src) drawn.push(new URL(image.src).pathname);
      return originalDrawImage.call(this, image, ...args);
    };
    game.ctx.lineTo = function(...args) {
      trailLineCount += 1;
      return originalLineTo.call(this, ...args);
    };
    const latest = (trail) => trail.points[(trail.start + trail.count - 1) % trail.points.length];
    const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    try {
      game.requestAttack();
      game.player.attackTimer = game.player.attackDuration * 0.4;
      const firstShape = game.getActiveWeaponShapes(game.getHeldWeaponPose(game.run.elapsed))[0];
      game.updateWeaponTipTrails(0.02);
      const firstSample = { ...latest(primary) };
      game.player.attackTimer = game.player.attackDuration * 0.58;
      const secondShape = game.getActiveWeaponShapes(game.getHeldWeaponPose(game.run.elapsed))[0];
      game.updateWeaponTipTrails(0.02);
      const secondSample = { ...latest(primary) };
      game.performMeleeHit({ damage: 20, knockback: 40 });
      game.renderPlayer(game.ctx, performance.now() / 1000);
      const weaponDrawCount = drawn.filter((path) => path.endsWith('/assets/items/energy-sword.png')).length;
      return {
        action: game.player.action,
        weaponDrawCount,
        missAddsNoTextureEffect: attackEffects.length === 0,
        dynamicTrailDrawn: primary.count >= 2 && trailLineCount >= 2,
        samplesFollowTips: distance(firstSample, firstShape.end) < 0.001
          && distance(secondSample, secondShape.end) < 0.001,
        trailTipMoved: distance(firstSample, secondSample) > 1,
        noSlashImage: !Object.values(game.images).some((image) => new URL(image.src).pathname.endsWith('/assets/effects/slash-arc.png'))
      };
    } finally {
      game.ctx.drawImage = originalDrawImage;
      game.ctx.lineTo = originalLineTo;
      game.enemies = previousEnemies;
      game.effects = previousEffects;
    }
  })()`);
  assert.deepEqual(attackVisual, {
    action: "attack",
    weaponDrawCount: 1,
    missAddsNoTextureEffect: true,
    dynamicTrailDrawn: true,
    samplesFollowTips: true,
    trailTipMoved: true,
    noSlashImage: true,
  });

  const signatureImpactMaterials = await evaluate(`(() => {
    const game = window.__NEON_DEBUG__.game;
    const previous = {
      enemies: game.enemies,
      effects: game.effects,
      pickups: game.pickups,
      damageTexts: game.damageTexts,
      kills: game.run.kills,
      defeated: game.run.stageDefeated,
      attackIndex: game.player.attackIndex,
      screenFlash: game.screenFlash,
      screenFlashClock: game.screenFlashClock,
      screenFlashNextAt: game.screenFlashNextAt,
      screenFlashLastByKind: game.screenFlashLastByKind,
    };
    game.enemies = [];
    game.effects = [];
    game.pickups = [];
    game.damageTexts = [];
    game.screenFlash = null;
    game.screenFlashClock = 10;
    game.screenFlashNextAt = 0;
    game.screenFlashLastByKind = Object.create(null);
    const drawnKeys = [];
    const drawnPaths = [];
    const originalDrawImage = game.ctx.drawImage;
    game.ctx.drawImage = function(image, ...args) {
      for (const key of ['comboFinisher', 'executionBurst']) {
        if (image === game.images[key]) drawnKeys.push(key);
      }
      if (image?.src) drawnPaths.push(new URL(image.src).pathname);
      return originalDrawImage.call(this, image, ...args);
    };
    try {
      const enemy = game.spawnEnemy('chaser', false, { x: game.player.x + 90, y: game.player.y });
      enemy.hp = 1;
      game.player.attackIndex = 2;
      game.damageEnemy(enemy, 10, 'melee', { x: 1, y: 0 }, 0);
      const comboEvent = game.effects.some((effect) => /Hit$/.test(effect.type) && effect.comboFinisher === true);
      const executionEvent = game.effects.some((effect) => effect.type === 'enemyDestroy' && effect.finisher === true);
      game.renderEffects(game.ctx, false);
      return {
        comboEvent,
        executionEvent,
        comboDrawImage: drawnKeys.includes('comboFinisher')
          && drawnPaths.some((path) => path.endsWith('/assets/effects/combo-finisher.png')),
        executionDrawImage: drawnKeys.includes('executionBurst')
          && drawnPaths.some((path) => path.endsWith('/assets/effects/execution-burst.png')),
        screenKind: game.screenFlash?.kind,
        singletonScreenFeedback: Boolean(game.screenFlash) && !Array.isArray(game.screenFlash),
        noGenericSlash: drawnPaths.every((path) => !path.endsWith('/assets/effects/slash-arc.png')),
      };
    } finally {
      game.ctx.drawImage = originalDrawImage;
      game.enemies = previous.enemies;
      game.effects = previous.effects;
      game.pickups = previous.pickups;
      game.damageTexts = previous.damageTexts;
      game.run.kills = previous.kills;
      game.run.stageDefeated = previous.defeated;
      game.player.attackIndex = previous.attackIndex;
      game.screenFlash = previous.screenFlash;
      game.screenFlashClock = previous.screenFlashClock;
      game.screenFlashNextAt = previous.screenFlashNextAt;
      game.screenFlashLastByKind = previous.screenFlashLastByKind;
    }
  })()`);
  assert.deepEqual(signatureImpactMaterials, {
    comboEvent: true,
    executionEvent: true,
    comboDrawImage: true,
    executionDrawImage: true,
    screenKind: "execution",
    singletonScreenFeedback: true,
    noGenericSlash: true,
  });

  const movingImpactParticles = await evaluate(`(() => {
    const game = window.__NEON_DEBUG__.game;
    const previousEffects = game.effects;
    const previousParticles = game.particles;
    const previousDamageTexts = game.damageTexts;
    game.effects = [];
    game.particles = [];
    game.damageTexts = [];
    const drawnKeys = [];
    const originalDrawImage = game.ctx.drawImage;
    game.ctx.drawImage = function(image, ...args) {
      for (const key of ['energySpark', 'impactShard']) {
        if (image === game.images[key]) drawnKeys.push(key);
      }
      return originalDrawImage.call(this, image, ...args);
    };
    try {
      for (let index = 0; index < 7; index += 1) game.spawnBurst(400, 400, '#4df6ff', 24, 200, { x: 1, y: 0 });
      const sparks = game.effects.filter((effect) => effect.type === 'energySpark' || effect.type === 'impactShard');
      const before = sparks.map((effect) => ({ x: effect.x, y: effect.y, vx: effect.vx, vy: effect.vy, angle: effect.angle }));
      const fieldsValid = sparks.every((effect) => effect.particle === true
        && Number.isFinite(effect.vx) && Number.isFinite(effect.vy)
        && effect.drag > 0 && Number.isFinite(effect.spin));
      const directedForward = sparks.every((effect) => effect.vx > 0);
      game.updateEffects(0.05);
      const moved = sparks.every((effect, index) => Math.hypot(effect.x - before[index].x, effect.y - before[index].y) > 0.01);
      const damped = sparks.every((effect, index) => Math.hypot(effect.vx, effect.vy) < Math.hypot(before[index].vx, before[index].vy));
      const spun = sparks.some((effect, index) => Math.abs(effect.angle - before[index].angle) > 0.0001);
      game.renderEffects(game.ctx, false);
      return {
        capped: sparks.length === 48,
        alternatingTypes: sparks.some((effect) => effect.type === 'energySpark')
          && sparks.some((effect) => effect.type === 'impactShard'),
        fieldsValid,
        directedForward,
        moved,
        damped,
        spun,
        energyDrawImage: drawnKeys.includes('energySpark'),
        shardDrawImage: drawnKeys.includes('impactShard'),
      };
    } finally {
      game.ctx.drawImage = originalDrawImage;
      game.effects = previousEffects;
      game.particles = previousParticles;
      game.damageTexts = previousDamageTexts;
    }
  })()`);
  assert.deepEqual(movingImpactParticles, {
    capped: true,
    alternatingTypes: true,
    fieldsValid: true,
    directedForward: true,
    moved: true,
    damped: true,
    spun: true,
    energyDrawImage: true,
    shardDrawImage: true,
  });

  await delay(420);
  await evaluate("window.__NEON_DEBUG__.game.requestRanged()");
  await delay(20);
  assert.ok(await evaluate("window.__NEON_DEBUG__.game.player.ammo < window.__NEON_DEBUG__.game.player.maxAmmo"));
  const rangedMaterial = await evaluate(`(() => {
    const game = window.__NEON_DEBUG__.game;
    const drawn = [];
    const original = game.ctx.drawImage;
    game.ctx.drawImage = function(image, ...args) {
      if (image?.src) drawn.push(new URL(image.src).pathname);
      return original.call(this, image, ...args);
    };
    try {
      game.renderProjectiles(game.ctx);
      game.renderEffects(game.ctx, false);
    } finally {
      game.ctx.drawImage = original;
    }
    return {
      round: drawn.some((path) => path.endsWith('/assets/effects/rail-round.png')),
      muzzle: drawn.some((path) => path.endsWith('/assets/effects/rail-muzzle.png'))
    };
  })()`);
  assert.deepEqual(rangedMaterial, { round: true, muzzle: true });

  const parry = await evaluate(`(() => {
    const game = window.__NEON_DEBUG__.game;
    game.effects = [];
    game.screenFlash = null;
    game.screenFlashNextAt = 0;
    game.screenFlashLastByKind = Object.create(null);
    game.player.action = 'idle';
    game.pointer.active = false;
    game.setBlocking(true);
    game.player.facing = 0;
    const attacker = { x: game.player.x + 30, y: game.player.y, stun: 0, pushX: 0, pushY: 0 };
    const health = game.player.health;
    const result = game.damagePlayer(20, attacker, 1);
    const counterEvent = game.effects.some((effect) => effect.type === 'parryFlash' && effect.counter === true);
    const drawn = [];
    const original = game.ctx.drawImage;
    game.ctx.drawImage = function(image, ...args) {
      if (image === game.images.parryCounter) drawn.push(new URL(image.src).pathname);
      return original.call(this, image, ...args);
    };
    try { game.renderEffects(game.ctx, false); } finally { game.ctx.drawImage = original; }
    game.setBlocking(false);
    return {
      result,
      healthUnchanged: game.player.health === health,
      stunned: attacker.stun > 0,
      material: game.effects.some((effect) => /parry/i.test(effect.type)),
      counterEvent,
      counterDrawImage: drawn.some((path) => path.endsWith('/assets/effects/parry-counter.png')),
      screenKind: game.screenFlash?.kind,
    };
  })()`);
  assert.deepEqual(parry, {
    result: "parry", healthUnchanged: true, stunned: true, material: true,
    counterEvent: true, counterDrawImage: true, screenKind: "parry",
  });

  const heldDefense = await evaluate(`(() => {
    const game = window.__NEON_DEBUG__.game;
    game.player.action = 'idle';
    game.setBlocking(true);
    const drawn = [];
    const original = game.ctx.drawImage;
    game.ctx.drawImage = function(image, ...args) {
      if (image?.src) drawn.push(new URL(image.src).pathname);
      return original.call(this, image, ...args);
    };
    try {
      game.renderPlayer(game.ctx, performance.now() / 1000);
    } finally {
      game.ctx.drawImage = original;
      game.setBlocking(false);
    }
    return {
      guardField: drawn.some((path) => path.endsWith('/assets/effects/guard-field.png')),
      barrierShell: drawn.some((path) => path.endsWith('/assets/effects/barrier-shell.png'))
    };
  })()`);
  assert.deepEqual(heldDefense, { guardField: true, barrierShell: true });

  const guardFeedback = await evaluate(`(() => {
    const game = window.__NEON_DEBUG__.game;
    const source = { x: game.player.x + 30, y: game.player.y, stun: 0, pushX: 0, pushY: 0 };
    game.player.action = 'idle';
    game.player.invulnerable = 0;
    game.player.stamina = game.player.maxStamina;
    game.pointer.active = false;
    game.setBlocking(true);
    game.player.facing = 0;
    game.player.parryTimer = 0;
    const result = game.damagePlayer(16, source, 1);
    const drawn = [];
    const original = game.ctx.drawImage;
    game.ctx.drawImage = function(image, ...args) {
      if (image?.src) drawn.push(new URL(image.src).pathname);
      return original.call(this, image, ...args);
    };
    try { game.renderEffects(game.ctx, false); } finally { game.ctx.drawImage = original; }
    game.setBlocking(false);
    return {
      result,
      material: drawn.some((path) => path.endsWith('/assets/effects/guard-hit.png'))
    };
  })()`);
  assert.deepEqual(guardFeedback, { result: "block", material: true });

  const hurtFeedback = await evaluate(`(() => {
    const game = window.__NEON_DEBUG__.game;
    const previous = {
      health: game.player.health,
      barrier: game.player.barrier,
      invulnerable: game.player.invulnerable,
      action: game.player.action,
    };
    game.screenFlash = null;
    game.screenFlashNextAt = 0;
    game.screenFlashLastByKind = Object.create(null);
    game.player.action = 'idle';
    game.player.invulnerable = 0;
    game.player.barrier = 0;
    game.applyHealthDamage(1, { x: game.player.x + 20, y: game.player.y });
    const screenKind = game.screenFlash?.kind;
    game.player.health = previous.health;
    game.player.barrier = previous.barrier;
    game.player.invulnerable = previous.invulnerable;
    game.player.action = previous.action;
    return { screenKind, singleton: Boolean(game.screenFlash) && !Array.isArray(game.screenFlash) };
  })()`);
  assert.deepEqual(hurtFeedback, { screenKind: "hurt", singleton: true });

  const guardBreak = await evaluate(`(() => {
    const game = window.__NEON_DEBUG__.game;
    const source = { x: game.player.x + 30, y: game.player.y, stun: 0, pushX: 0, pushY: 0 };
    game.player.action = 'idle';
    game.player.invulnerable = 0;
    game.player.stamina = 1;
    game.pointer.active = false;
    game.setBlocking(true);
    game.player.facing = 0;
    game.player.parryTimer = 0;
    game.screenFlash = null;
    game.screenFlashNextAt = 0;
    game.screenFlashLastByKind = Object.create(null);
    const result = game.damagePlayer(24, source, 1.2);
    const material = game.effects.some((effect) => /break/i.test(effect.type));
    const screenKind = game.screenFlash?.kind;
    game.player.stamina = game.player.maxStamina;
    game.player.action = 'idle';
    game.player.blockHeld = false;
    return { result, material, screenKind };
  })()`);
  assert.deepEqual(guardBreak, { result: "broken", material: true, screenKind: "guardBreak" });

  const generatedDash = await evaluate(`(() => {
    const game = window.__NEON_DEBUG__.game;
    game.effects = [];
    game.screenFlash = null;
    game.screenFlashNextAt = 0;
    game.screenFlashLastByKind = Object.create(null);
    game.player.action = 'idle';
    game.player.stamina = game.player.maxStamina;
    game.player.dashCooldown = 0;
    game.requestDash();
    game.updatePlayer(0.016);
    game.player.dashTime = 0.001;
    game.updatePlayer(0.016);
    const drawn = [];
    const original = game.ctx.drawImage;
    game.ctx.drawImage = function(image, ...args) {
      if (image?.src) drawn.push(new URL(image.src).pathname);
      return original.call(this, image, ...args);
    };
    try { game.renderEffects(game.ctx, true); } finally { game.ctx.drawImage = original; }
    return {
      streakEvent: game.effects.some((effect) => effect.type === 'dashStreak'),
      arrivalEvent: game.effects.some((effect) => effect.type === 'dashArrival'),
      streakDrawImage: drawn.some((path) => path.endsWith('/assets/effects/dash-streak-hard.png')),
      arrivalDrawImage: drawn.some((path) => path.endsWith('/assets/effects/dash-arrival.png')),
      screenKind: game.screenFlash?.kind,
    };
  })()`);
  assert.deepEqual(generatedDash, {
    streakEvent: true, arrivalEvent: true, streakDrawImage: true, arrivalDrawImage: true, screenKind: "dash",
  });

  const generatedSkill = await evaluate(`(() => {
    const game = window.__NEON_DEBUG__.game;
    const previousEnemies = game.enemies;
    game.enemies = [];
    game.effects = [];
    game.screenFlash = null;
    game.screenFlashNextAt = 0;
    game.screenFlashLastByKind = Object.create(null);
    game.player.action = 'idle';
    game.player.skillCooldowns[game.player.activeSkillSlot - 1] = 0;
    game.requestSkill();
    const drawn = [];
    const original = game.ctx.drawImage;
    game.ctx.drawImage = function(image, ...args) {
      if (image?.src) drawn.push(new URL(image.src).pathname);
      return original.call(this, image, ...args);
    };
    try {
      game.renderEffects(game.ctx, true);
      game.renderEffects(game.ctx, false);
    } finally {
      game.ctx.drawImage = original;
    }
    const result = {
      skillEvent: game.effects.some((effect) => /pulse|skill/i.test(effect.type)),
      pulseDrawImage: drawn.some((path) => path.endsWith('/assets/effects/pulse-wave.png')),
      coreDrawImage: drawn.some((path) => path.endsWith('/assets/effects/skill-core.png')),
      screenKind: game.screenFlash?.kind,
    };
    game.enemies = previousEnemies;
    return result;
  })()`);
  assert.deepEqual(generatedSkill, { skillEvent: true, pulseDrawImage: true, coreDrawImage: true, screenKind: "skill" });

  if (process.env.NEON_SMOKE_BATTLE_SHOT) {
    await evaluate(`(() => {
      const game = window.__NEON_DEBUG__.game;
      game.enemies = [];
      game.effects = [];
      game.particles = [];
      game.damageTexts = [];
      const normal = game.spawnEnemy('chaser', false, { x: game.player.x + 175, y: game.player.y - 70 });
      const heavy = game.spawnEnemy('brute', false, { x: game.player.x + 205, y: game.player.y + 115 });
      for (const enemy of [normal, heavy]) {
        enemy.state = 'windup';
        enemy.stateTimer = (enemy.windup || 0.5) * 0.36;
        enemy.rotation = Math.atan2(game.player.y - enemy.y, game.player.x - enemy.x);
      }
      game.player.action = 'idle';
      game.player.invulnerable = 0;
      game.player.barrier = Math.max(game.player.barrier, 40);
      game.setBlocking(true);
      game.player.parryTimer = 0;
      game.effects.push({ type: 'pulseWave', x: game.player.x, y: game.player.y, angle: game.player.facing, radius: 230, life: 0.3, maxLife: 0.5 });
    })()`);
    await delay(40);
    await captureScreenshot(process.env.NEON_SMOKE_BATTLE_SHOT);
  }

  await evaluate(`(() => {
    const game = window.__NEON_DEBUG__.game;
    game.player.action = 'idle';
    game.applyWeaponSlot(2);
  })()`);
  await evaluate("window.__NEON_DEBUG__.beginRun('storm').then(() => window.__NEON_DEBUG__.game.beginStage())");
  await delay(120);
  const dualWield = await evaluate(`(() => {
    const game = window.__NEON_DEBUG__.game;
    const previousEnemies = game.enemies;
    const previousEffects = game.effects;
    game.enemies = [];
    game.effects = [];
    const primary = game.weaponTipTrails.primary;
    const offhand = game.weaponTipTrails.offhand;
    for (const trail of [primary, offhand]) {
      trail.start = 0;
      trail.count = 0;
      trail.stroke = 0;
      trail.sampleTimer = 1;
    }
    const drawn = [];
    let trailLineCount = 0;
    const originalDrawImage = game.ctx.drawImage;
    const originalLineTo = game.ctx.lineTo;
    const newRunDefaultSlot = game.player.activeWeaponSlot;
    const newRunPendingSlot = game.player.pendingWeaponSlot;
    game.ctx.drawImage = function(image, ...args) {
      if (image?.src) drawn.push(new URL(image.src).pathname);
      return originalDrawImage.call(this, image, ...args);
    };
    game.ctx.lineTo = function(...args) {
      trailLineCount += 1;
      return originalLineTo.call(this, ...args);
    };
    const latest = (trail) => trail.points[(trail.start + trail.count - 1) % trail.points.length];
    const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    try {
      game.player.action = 'idle';
      game.applyWeaponSlot(1);
      game.startAttack(2);
      game.player.attackTimer = game.player.attackDuration * 0.4;
      game.updateWeaponTipTrails(0.02);
      game.player.attackTimer = game.player.attackDuration * 0.58;
      const shapes = game.getActiveWeaponShapes(game.getHeldWeaponPose(game.run.elapsed));
      game.updateWeaponTipTrails(0.02);
      const primaryShape = shapes.find((shape) => shape.hand === 'primary');
      const offhandShape = shapes.find((shape) => shape.hand === 'offhand');
      game.performMeleeHit({ damage: 20, knockback: 40 });
      game.renderPlayer(game.ctx, performance.now() / 1000);
      const weaponDrawCount = drawn.filter((path) => path.endsWith('/assets/items/phase-blade.png')).length;
      return {
        weapon: game.run.core.weapon,
        newRunDefaultSlot,
        newRunPendingSlot,
        singleBladeLoaded: game.images.twin.naturalWidth > 0
          && new URL(game.images.twin.src).pathname.endsWith('/assets/items/phase-blade.png'),
        weaponDrawCount,
        independentBuffers: primary !== offhand && primary.points !== offhand.points,
        bothTrailsSampled: primary.count >= 2 && offhand.count >= 2,
        separateTipEndpoints: distance(latest(primary), latest(offhand)) > 1,
        samplesFollowBothWeapons: distance(latest(primary), primaryShape.end) < 0.001
          && distance(latest(offhand), offhandShape.end) < 0.001,
        bothTrailsDrawn: trailLineCount >= 4,
        missAddsNoTextureEffect: game.effects.length === 0,
      };
    } finally {
      game.ctx.drawImage = originalDrawImage;
      game.ctx.lineTo = originalLineTo;
      game.enemies = previousEnemies;
      game.effects = previousEffects;
    }
  })()`);
  assert.deepEqual(dualWield, {
    weapon: "twin",
    newRunDefaultSlot: 1,
    newRunPendingSlot: null,
    singleBladeLoaded: true,
    weaponDrawCount: 2,
    independentBuffers: true,
    bothTrailsSampled: true,
    separateTipEndpoints: true,
    samplesFollowBothWeapons: true,
    bothTrailsDrawn: true,
    missAddsNoTextureEffect: true,
  });

  const weaponContact = await evaluate(`(() => {
    const game = window.__NEON_DEBUG__.game;
    game.enemies = [];
    game.player.action = 'idle';
    game.applyWeaponSlot(1);
    game.player.action = 'attack';
    game.player.attackIndex = 0;
    game.player.attackDuration = 0.22;
    game.player.attackTimer = 0.11;
    game.player.attackHit = new Set();
    const pose = game.getHeldWeaponPose(game.run.elapsed);
    const shape = game.getActiveWeaponShapes(pose)[0];
    const shapeLength = Math.hypot(shape.end.x - shape.start.x, shape.end.y - shape.start.y);
    game.player.stats.swingArc = 1.24;
    const widerPose = game.getHeldWeaponPose(game.run.elapsed);
    const widerShape = game.getActiveWeaponShapes(widerPose)[0];
    const widerShapeLength = Math.hypot(widerShape.end.x - widerShape.start.x, widerShape.end.y - widerShape.start.y);
    game.player.stats.swingArc = 1;
    const perpendicular = { x: -(shape.end.y - shape.start.y), y: shape.end.x - shape.start.x };
    const length = Math.hypot(perpendicular.x, perpendicular.y);
    const makeEnemy = (x, y) => ({
      x, y, radius: 12, hp: 1000, maxHp: 1000, dead: false, energy: 1,
      color: '#ff4f8b', hitFlash: 0, pushX: 0, pushY: 0, boss: false
    });
    const touching = makeEnemy(shape.end.x, shape.end.y);
    const missing = makeEnemy(
      shape.end.x + perpendicular.x / length * 55,
      shape.end.y + perpendicular.y / length * 55
    );
    game.enemies = [touching, missing];
    game.performMeleeHit({ damage: 20, knockback: 40 });
    const drawn = [];
    const original = game.ctx.drawImage;
    game.ctx.drawImage = function(image, ...args) {
      if (image?.src) drawn.push(new URL(image.src).pathname);
      return original.call(this, image, ...args);
    };
    try { game.renderEffects(game.ctx, false); } finally { game.ctx.drawImage = original; }
    return {
      touchingDamaged: touching.hp < 1000,
      missingUntouched: missing.hp === 1000,
      dprCapped: game.view.dpr <= 1.5,
      weaponLengthFixed: Math.abs(shapeLength - widerShapeLength) < 0.001,
      impactFeedbackStrong: drawn.some((path) => path.endsWith('/assets/effects/twin-hit.png')) && game.shake >= 5
    };
  })()`);
  assert.deepEqual(weaponContact, { touchingDamaged: true, missingUntouched: true, dprCapped: true, weaponLengthFixed: true, impactFeedbackStrong: true });

  const fixedMission = await evaluate(`(() => {
    const game = window.__NEON_DEBUG__.game;
    const before = game.run.energy;
    game.collectEnergy(20);
    return {
      state: game.state,
      energyAdded: game.run.energy === before + 20,
      noUpgradeScreen: !document.querySelector('#upgrade-screen'),
      noRandomUpgradeApi: typeof game.openTerminal === 'undefined' && typeof game.rerollUpgrades === 'undefined'
    };
  })()`);
  assert.deepEqual(fixedMission, { state: "playing", energyAdded: true, noUpgradeScreen: true, noRandomUpgradeApi: true });

  const stageAdvance = await evaluate(`(() => {
    const game = window.__NEON_DEBUG__.game;
    game.enemies = [];
    game.run.stageQueue = [];
    game.pickups = [{ x: game.player.x, y: game.player.y, value: 7, radius: 10, pulse: 0 }];
    game.player.health = game.player.maxHealth - 30;
    const energyBefore = game.run.energy;
    game.updateSpawning(0.1);
    return {
      currentStageIndex: game.run.stageIndex,
      pendingStageIndex: game.run.pendingStageIndex,
      mission: game.run.mission,
      state: game.state,
      roomVisible: document.querySelector('#room-screen').classList.contains('is-active'),
      roomTitle: document.querySelector('#room-title').textContent,
      nextStageLabel: document.querySelector('#room-stage').textContent,
      nextStageNotLoaded: game.run.stageQueue.length === 0,
      healthPreserved: game.player.health === game.player.maxHealth - 30,
      autoCollected: game.run.energy === energyBefore + 7 && game.pickups.length === 0,
      earnedTracked: game.run.energyEarned === 27
    };
  })()`);
  assert.deepEqual(stageAdvance, {
    currentStageIndex: 0,
    pendingStageIndex: 1,
    mission: "ROOM",
    state: "room",
    roomVisible: true,
    roomTitle: "整备房间",
    nextStageLabel: "1-2",
    nextStageNotLoaded: true,
    healthPreserved: true,
    autoCollected: true,
    earnedTracked: true
  });

  const roomRepair = await evaluate(`(() => {
    const game = window.__NEON_DEBUG__.game;
    const result = game.purchaseRoomItem('repair');
    return { ok: result.ok, healthFull: game.player.health === game.player.maxHealth, energy: game.run.energy };
  })()`);
  assert.deepEqual(roomRepair, { ok: true, healthFull: true, energy: 34 });

  await evaluate(`(() => {
    const game = window.__NEON_DEBUG__.game;
    game.enemies = [];
    game.run.pendingStageIndex = 2;
    game.beginStage();
    game.run.spawnTimer = 0;
    game.updateSpawning(0.1);
  })()`);
  await delay(120);
  const boss = await evaluate(`(() => {
    const game = window.__NEON_DEBUG__.game;
    const drawn = [];
    const original = game.ctx.drawImage;
    game.ctx.drawImage = function(image, ...args) {
      if (image?.src) drawn.push(new URL(image.src).pathname);
      return original.call(this, image, ...args);
    };
    try {
      game.renderEffects(game.ctx, true);
      game.renderEffects(game.ctx, false);
    } finally {
      game.ctx.drawImage = original;
    }
    return {
      spawned: game.run.bossSpawned,
      exists: Boolean(game.run.boss),
      bar: document.querySelector('#boss-bar').classList.contains('is-active'),
      burst: game.effects.some((effect) => /boss/i.test(effect.type)),
      material: drawn.some((path) => path.endsWith('/assets/effects/boss-burst-hard.png')),
      screenKind: game.screenFlash?.kind,
    };
  })()`);
  assert.equal(boss.spawned, true);
  assert.equal(boss.exists, true);
  assert.equal(boss.bar, true);
  assert.equal(boss.burst, true);
  assert.equal(boss.material, true);
  assert.equal(boss.screenKind, "boss");

  const victoryScreenKind = await evaluate(`(() => {
    const game = window.__NEON_DEBUG__.game;
    game.damageEnemy(game.run.boss, 999999, 'melee');
    return game.screenFlash?.kind;
  })()`);
  assert.equal(victoryScreenKind, "victory");
  await delay(120);
  assert.equal(await evaluate("document.querySelector('#result-screen').classList.contains('is-active')"), true);
  assert.equal(await evaluate("window.__NEON_DEBUG__.audio.musicPlaying"), false);

  await evaluate("document.querySelector('#meta-button').click()");
  await delay(160);
  const upgradeCards = await evaluate(`(() => {
    const images = [...document.querySelectorAll('#meta-grid .meta-art')];
    const expected = ['power-upgrade.png', 'armor-upgrade.png', 'recovery-upgrade.png'];
    const paths = images.map((image) => new URL(image.src).pathname);
    return {
      count: images.length,
      ready: images.every((image) => image.complete && image.naturalWidth > 0),
      versioned: images.every((image) => new URL(image.src).searchParams.has('v')),
      correctArt: expected.every((name) => paths.some((path) => path.endsWith('/assets/ui/' + name)))
    };
  })()`);
  assert.deepEqual(upgradeCards, { count: 3, ready: true, versioned: true, correctArt: true });
  assert.deepEqual(exceptions, []);
  console.log("Browser smoke passed: 1/2 and debounced-wheel weapon switching, R/Q expandable skill slots, multi-source guard recovery, current-weapon attacks, 36/36 VFX and 20/20 full-screen composite prewarm, six event-linked impact materials, two throttled full-screen materials, capped moving spark/shard particles, endpoint blade trails, and mission flows are functional.");
  }
} finally {
  socket?.close();
  browser.kill("SIGTERM");
}

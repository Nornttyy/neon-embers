import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const baseUrl = process.env.NEON_PERF_URL || "http://127.0.0.1:4173";
const debugPort = 9800 + Math.floor(Math.random() * 400);
const profileDir = await mkdtemp(join(tmpdir(), "neon-embers-gpu-perf-"));
const browser = spawn(chromePath, [
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
  "--ignore-gpu-blocklist",
  "--use-angle=metal",
  "--js-flags=--expose-gc",
  "--force-device-scale-factor=1",
  "--window-size=1920,1200",
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profileDir}`,
  "about:blank",
], { stdio: "ignore" });

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForJson(path) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}${path}`);
      if (response.ok) return response.json();
    } catch {}
    await delay(100);
  }
  throw new Error("Chrome DevTools endpoint did not start");
}

async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let commandId = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++commandId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  return { socket, command };
}

function gpuDescription(info) {
  const gpu = info?.gpu || {};
  return [
    ...(gpu.devices || []).flatMap((device) => [device.vendorString, device.deviceString]),
    gpu.auxAttributes?.glRenderer,
    gpu.auxAttributes?.displayType,
    ...["gpu_compositing", "rasterization", "skia_graphite"].flatMap((key) => [key, gpu.featureStatus?.[key]]),
  ].filter(Boolean).join(" | ");
}

let pageConnection;
let browserConnection;
try {
  const [version, pages] = await Promise.all([waitForJson("/json/version"), waitForJson("/json/list")]);
  const page = pages.find((entry) => entry.type === "page");
  assert.ok(page?.webSocketDebuggerUrl, "headed Chrome page is available");
  assert.ok(version.webSocketDebuggerUrl, "headed Chrome browser endpoint is available");

  pageConnection = await connect(page.webSocketDebuggerUrl);
  browserConnection = await connect(version.webSocketDebuggerUrl);
  const { command } = pageConnection;
  const gpuInfo = await browserConnection.command("SystemInfo.getInfo");
  const gpu = gpuDescription(gpuInfo);
  assert.match(gpu, /metal/i, `Chrome must use Metal for this benchmark; reported: ${gpu}`);
  assert.doesNotMatch(gpu, /software only|swiftshader/i, `software rendering is not valid performance evidence; reported: ${gpu}`);

  await command("Runtime.enable");
  await command("Page.enable");
  await command("Emulation.setDeviceMetricsOverride", {
    width: 1920,
    height: 1200,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await command("Page.bringToFront");
  await command("Page.navigate", { url: `${baseUrl.replace(/\/$/, "")}/?autostart=hunter` });

  const evaluate = async (expression) => {
    const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    }
    return result.result.value;
  };

  let ready = false;
  for (let attempt = 0; attempt < 300; attempt += 1) {
    try {
      ready = await evaluate(`Boolean(
        window.__NEON_DEBUG__?.game?.assetLoadState?.ready
        && window.__NEON_DEBUG__.game.state === 'room'
        && window.__NEON_DEBUG__.game.arenaCache?.ready
        && !window.__NEON_DEBUG__.game.arenaCache?.promise
        && !document.querySelector('#loading-screen')?.classList.contains('is-active')
      )`);
    } catch {}
    if (ready) break;
    await delay(100);
  }
  assert.equal(ready, true, "game assets and the 1920x1200 arena become ready within 30 seconds");
  await evaluate("document.querySelector('#room-start-button').click()");
  let battleReady = false;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    battleReady = await evaluate(`Boolean(
      window.__NEON_DEBUG__?.game?.state === 'playing'
      && window.__NEON_DEBUG__.game.arenaCache?.ready
      && !window.__NEON_DEBUG__.game.arenaCache?.promise
      && !document.querySelector('#loading-screen')?.classList.contains('is-active')
      && !document.querySelector('#room-screen')?.classList.contains('is-active')
      && document.querySelector('#hud')?.classList.contains('is-active')
    )`);
    if (battleReady) break;
    await delay(100);
  }
  assert.equal(battleReady, true, "the visible combat canvas becomes ready within 12 seconds");

  const reportPromise = evaluate(`(async () => {
    const game = window.__NEON_DEBUG__.game;
    game.resize();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const percentile = (values, ratio) => {
      if (!values.length) return 0;
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
    };
    const summarize = (values) => ({
      samples: values.length,
      p50: percentile(values, 0.5),
      p95: percentile(values, 0.95),
      max: Math.max(...values),
      over12: values.filter((value) => value >= 12).length,
      over20: values.filter((value) => value >= 20).length,
    });
    const waitFrames = (count) => new Promise((resolve) => {
      let remaining = count;
      const next = () => {
        remaining -= 1;
        if (remaining <= 0) resolve();
        else requestAnimationFrame(next);
      };
      requestAnimationFrame(next);
    });
    const makeParticles = () => Array.from({ length: 48 }, (_, index) => ({
      type: index % 2 ? 'impactShard' : 'energySpark',
      x: game.camera.x + ((index % 8) - 3.5) * 54,
      y: game.camera.y + (Math.floor(index / 8) - 2.5) * 54,
      radius: 20 + index % 4 * 3,
      angle: index / 48 * Math.PI * 2,
      vx: Math.cos(index / 48 * Math.PI * 2) * 180,
      vy: Math.sin(index / 48 * Math.PI * 2) * 180,
      drag: 4.8,
      spin: index % 2 ? 3.4 : -3.4,
      flipY: Boolean(index % 2),
      life: 0.24,
      maxLife: 0.3,
    }));
    const setFlash = (kind) => {
      game.screenFlash = null;
      game.screenFlashClock = 20;
      game.screenFlashNextAt = 0;
      game.screenFlashLastByKind = Object.create(null);
      game.triggerScreenFlash(kind);
    };
    const measure = async (name, kind = null, particles = false) => {
      game.effects = [];
      game.screenFlash = null;
      globalThis.gc?.();
      await waitFrames(36);

      const cpu = [];
      const original = game.renderScreenFlash;
      game.renderScreenFlash = function(context) {
        const started = performance.now();
        const rendered = original.call(this, context);
        cpu.push(performance.now() - started);
        return rendered;
      };
      const intervals = [];
      let previous;
      let firstTrigger = 0;
      try {
        await new Promise((resolve) => {
          const next = (time) => {
            if (previous == null) {
              previous = time;
              if (kind) setFlash(kind);
              if (particles) game.effects = makeParticles();
              requestAnimationFrame(next);
              return;
            }
            const interval = time - previous;
            intervals.push(interval);
            if (!firstTrigger) firstTrigger = interval;
            previous = time;
            if (kind && !game.screenFlash) game.triggerScreenFlash(kind);
            if (particles) {
              game.updateEffects(Math.min(0.034, interval / 1000));
              const moving = game.effects.filter((effect) => effect.type === 'energySpark' || effect.type === 'impactShard');
              if (moving.length < 48) game.effects = makeParticles();
            }
            if (intervals.length >= 240) resolve();
            else requestAnimationFrame(next);
          };
          requestAnimationFrame(next);
        });
      } finally {
        game.renderScreenFlash = original;
      }
      return {
        name,
        firstTrigger,
        frames: summarize(intervals.slice(8)),
        renderScreenFlashCpu: summarize(cpu.slice(8)),
      };
    };

    const previous = {
      state: game.state,
      update: game.update,
      enemies: game.enemies,
      projectiles: game.projectiles,
      pickups: game.pickups,
      damageTexts: game.damageTexts,
      effects: game.effects,
      screenFlash: game.screenFlash,
      reduceFlash: game.settings.reduceFlash,
    };
    game.settings.reduceFlash = false;
    game.update = () => {};
    game.enemies = [];
    game.projectiles = [];
    game.pickups = [];
    game.damageTexts = [];
    game.state = 'playing';
    try {
      const baseline = await measure('baseline');
      const success = await measure('success', 'parry');
      const danger = await measure('danger', 'execution');
      const dangerParticles = await measure('danger+48-particles', 'execution', true);
      const scenarios = [success, danger, dangerParticles].map((scenario) => ({
        ...scenario,
        p95Delta: scenario.frames.p95 - baseline.frames.p95,
      }));
      return {
        environment: {
          viewport: [window.innerWidth, window.innerHeight],
          canvas: [game.canvas.width, game.canvas.height],
          dpr: game.view.dpr,
          refreshMedian: baseline.frames.p50,
          assets: [game.assetLoadState.loaded, game.assetLoadState.total],
          vfx: [game.vfxWarmState.warmed, game.vfxWarmState.total],
          filteredSprites: [game.filteredSpriteState.prepared, game.filteredSpriteState.total],
          screenComposites: [game.screenOverlaySpriteState.warmed, game.screenOverlaySpriteState.total],
          movingParticles: 48,
        },
        baseline,
        scenarios,
      };
    } finally {
      game.state = previous.state;
      game.update = previous.update;
      game.enemies = previous.enemies;
      game.projectiles = previous.projectiles;
      game.pickups = previous.pickups;
      game.damageTexts = previous.damageTexts;
      game.effects = previous.effects;
      game.screenFlash = previous.screenFlash;
      game.settings.reduceFlash = previous.reduceFlash;
    }
  })()`);
  let benchmarkTimeout;
  const benchmarkTimeoutPromise = new Promise((_, reject) => {
    benchmarkTimeout = setTimeout(() => reject(new Error("GPU benchmark stopped receiving animation frames for 45 seconds")), 45000);
  });
  let report;
  try {
    report = await Promise.race([reportPromise, benchmarkTimeoutPromise]);
  } finally {
    clearTimeout(benchmarkTimeout);
  }

  assert.deepEqual(report.environment.viewport, [1920, 1200]);
  assert.deepEqual(report.environment.canvas, [1920, 1200]);
  assert.equal(report.environment.dpr, 1);
  assert.deepEqual(report.environment.assets, [60, 60]);
  assert.deepEqual(report.environment.vfx, [36, 36]);
  assert.deepEqual(report.environment.filteredSprites, [14, 14]);
  assert.deepEqual(report.environment.screenComposites, [20, 20]);
  assert.equal(report.environment.movingParticles, 48);
  assert.ok(report.environment.refreshMedian < 10, `a 120 Hz display path is required; median frame interval was ${report.environment.refreshMedian.toFixed(2)} ms`);
  console.log(`GPU: ${gpu}`);
  console.log(JSON.stringify(report, null, 2));
  for (const scenario of report.scenarios) {
    assert.ok(scenario.p95Delta <= 1, `${scenario.name} p95 delta must be <= 1 ms, got ${scenario.p95Delta.toFixed(2)} ms`);
    assert.ok(scenario.firstTrigger < 12, `${scenario.name} first trigger must be < 12 ms, got ${scenario.firstTrigger.toFixed(2)} ms`);
    assert.ok(scenario.frames.max < 12, `${scenario.name} max frame must be < 12 ms, got ${scenario.frames.max.toFixed(2)} ms`);
    assert.equal(scenario.frames.over12, 0, `${scenario.name} must not have frames >= 12 ms`);
    assert.equal(scenario.frames.over20, 0, `${scenario.name} must not have frames >= 20 ms`);
    assert.ok(scenario.renderScreenFlashCpu.p95 <= 0.5, `${scenario.name} renderScreenFlash CPU p95 must be <= 0.5 ms, got ${scenario.renderScreenFlashCpu.p95.toFixed(3)} ms`);
  }

  console.log("GPU performance passed: 1920x1200 Metal rendering keeps success, danger, and danger+48-particle screen feedback within the 0.9.6 frame budget.");
} finally {
  try {
    await browserConnection?.command("Browser.close");
  } catch {}
  pageConnection?.socket.close();
  browserConnection?.socket.close();
  if (browser.exitCode == null) browser.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => browser.once("exit", resolve)),
    delay(2000),
  ]);
  await rm(profileDir, { recursive: true, force: true });
}

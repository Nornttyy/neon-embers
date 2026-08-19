import { CORES, ENEMIES, GAME, UPGRADES, WEAPONS, getWaveProfile, weightedSample, xpForLevel } from "./config.js";
import { audio } from "./audio.js";

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const distanceSquared = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const formatTime = (seconds) => {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
};

function normalized(x, y) {
  const length = Math.hypot(x, y);
  if (length < 0.0001) return { x: 0, y: 0 };
  return { x: x / length, y: y / length };
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export class Game {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.callbacks = callbacks;
    this.settings = { volume: 0.55, shake: true, reduceFlash: false };
    this.state = "menu";
    this.lastFrame = performance.now();
    this.view = { width: window.innerWidth, height: window.innerHeight, dpr: 1 };
    this.keys = new Set();
    this.touchVector = { x: 0, y: 0 };
    this.dashRequested = false;
    this.camera = { x: GAME.width / 2, y: GAME.height / 2 };
    this.shake = 0;
    this.flash = 0;
    this.toastCooldown = 0;
    this.hudAccumulator = 0;
    this.menuStars = Array.from({ length: 70 }, () => ({
      x: Math.random(), y: Math.random(), size: randomBetween(0.5, 2.2), phase: Math.random() * TAU,
    }));
    this.resize();
    this.bindInput();
    requestAnimationFrame((time) => this.frame(time));
  }

  bindInput() {
    window.addEventListener("resize", () => this.resize());
    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
        event.preventDefault();
      }
      this.keys.add(key);
      if (key === " " && !event.repeat) this.requestDash();
      if ((key === "escape" || key === "p") && !event.repeat) this.togglePause();
    });
    window.addEventListener("keyup", (event) => this.keys.delete(event.key.toLowerCase()));
    window.addEventListener("blur", () => {
      this.keys.clear();
      this.setTouchVector(0, 0);
      if (this.state === "playing") this.pause(false);
    });
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.view = { width: window.innerWidth, height: window.innerHeight, dpr };
    this.canvas.width = Math.round(this.view.width * dpr);
    this.canvas.height = Math.round(this.view.height * dpr);
    this.canvas.style.width = `${this.view.width}px`;
    this.canvas.style.height = `${this.view.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  applySettings(settings) {
    this.settings = { ...this.settings, ...settings };
    audio.setVolume(this.settings.volume);
    audio.setEnabled(this.settings.volume > 0);
  }

  setTouchVector(x, y) {
    const vector = normalized(x, y);
    this.touchVector.x = vector.x;
    this.touchVector.y = vector.y;
  }

  requestDash() {
    this.dashRequested = true;
  }

  start(coreId = "hunter", meta = {}) {
    audio.unlock();
    const core = CORES[coreId] || CORES.hunter;
    const metaPower = Number(meta.power || 0);
    const metaArmor = Number(meta.armor || 0);
    const metaRecovery = Number(meta.recovery || 0);
    const maxHealth = 100 + (core.bonuses.health || 0) + metaArmor * 8;

    this.run = {
      coreId: core.id,
      core,
      elapsed: 0,
      spawnTimer: 0.2,
      kills: 0,
      scrap: 0,
      scrapMultiplier: 1 + metaRecovery * 0.06,
      level: 1,
      xp: 0,
      xpNeeded: xpForLevel(1),
      pendingLevels: 0,
      rerolls: 1,
      lastElite: 0,
      eliteFlags: new Set(),
      bossSpawned: false,
      boss: null,
      victory: false,
      upgradeLevels: {},
      weaponLevels: { pulse: 0, orbit: 0, arc: 0, beam: 0, grenade: 0, drone: 0 },
      weaponMods: {},
      global: {
        speed: 1 + (core.bonuses.speed || 0),
        cooldown: 1 - (core.bonuses.cooldown || 0),
        damage: 1 + metaPower * 0.04,
        magnet: 1,
        crit: 0.05,
        shieldMax: 0,
        dashCooldown: 1,
      },
      weaponTimers: {},
    };

    for (const id of Object.keys(WEAPONS)) {
      this.run.weaponMods[id] = { damage: 1, cooldown: 1, count: 1, pierce: 0, range: 1, radius: 1, chains: 0, blast: 1, cluster: 0 };
      this.run.weaponTimers[id] = Math.random() * 0.25;
    }
    this.run.weaponLevels[core.weapon] = 1;

    this.player = {
      x: GAME.width / 2,
      y: GAME.height / 2,
      radius: GAME.playerRadius,
      maxHealth,
      health: maxHealth,
      shield: 0,
      invulnerable: 0,
      dashTime: 0,
      dashCooldown: 0,
      dashVector: { x: 1, y: 0 },
      lastMove: { x: 1, y: 0 },
      rotation: 0,
      pulse: 0,
    };

    this.enemies = [];
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.pickups = [];
    this.particles = [];
    this.damageTexts = [];
    this.effects = [];
    this.hazards = [];
    this.decorations = Array.from({ length: 90 }, (_, index) => ({
      x: (index * 347.71) % GAME.width,
      y: (index * 613.37) % GAME.height,
      size: 2 + (index % 5),
      kind: index % 4,
    }));
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this.shake = 0;
    this.flash = 0;
    this.state = "playing";
    this.callbacks.onState?.("playing");
    this.callbacks.onAnnouncement?.({ title: core.name, subtitle: "协议已加载" });
    this.emitHud(true);
  }

  stop() {
    this.state = "menu";
    this.keys.clear();
    this.setTouchVector(0, 0);
    this.callbacks.onState?.("menu");
  }

  pause(manual = true) {
    if (this.state !== "playing") return;
    this.state = "paused";
    this.callbacks.onPauseChange?.(true, manual);
  }

  resume() {
    if (this.state !== "paused") return;
    audio.unlock();
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
    this.toastCooldown = Math.max(0, this.toastCooldown - dt);
    this.flash = Math.max(0, this.flash - dt * 3.8);
    this.shake = Math.max(0, this.shake - dt * 18);
    this.player.invulnerable = Math.max(0, this.player.invulnerable - dt);
    this.player.dashCooldown = Math.max(0, this.player.dashCooldown - dt);
    this.player.pulse += dt;

    this.updatePlayer(dt);
    this.updateSpawning(dt);
    this.updateEnemies(dt);
    this.updateWeapons(dt);
    this.updateProjectiles(dt);
    this.updateEnemyProjectiles(dt);
    this.updatePickups(dt);
    this.updateEffects(dt);
    this.resolveContactDamage();

    this.camera.x = lerp(this.camera.x, this.player.x, 1 - Math.exp(-dt * 7));
    this.camera.y = lerp(this.camera.y, this.player.y, 1 - Math.exp(-dt * 7));
    this.hudAccumulator += dt;
    if (this.hudAccumulator >= 0.08) {
      this.hudAccumulator = 0;
      this.emitHud();
    }

    if (run.bossSpawned && run.boss && run.boss.dead) this.finish(true);
  }

  getMovementVector() {
    let x = 0;
    let y = 0;
    if (this.keys.has("a") || this.keys.has("arrowleft")) x -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) x += 1;
    if (this.keys.has("w") || this.keys.has("arrowup")) y -= 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) y += 1;
    x += this.touchVector.x;
    y += this.touchVector.y;
    return normalized(x, y);
  }

  updatePlayer(dt) {
    const player = this.player;
    let move = this.getMovementVector();
    if (move.x || move.y) player.lastMove = move;

    if (this.dashRequested) {
      this.dashRequested = false;
      if (player.dashCooldown <= 0 && (move.x || move.y || player.lastMove.x || player.lastMove.y)) {
        player.dashTime = GAME.dashDuration;
        player.dashCooldown = GAME.dashCooldown * this.run.global.dashCooldown;
        player.dashVector = move.x || move.y ? move : player.lastMove;
        player.invulnerable = Math.max(player.invulnerable, GAME.dashDuration + 0.06);
        this.spawnBurst(player.x, player.y, "#4df6ff", 16, 180);
        audio.dash();
      }
    }

    let speed = GAME.playerSpeed * this.run.global.speed;
    if (this.hazards.some((hazard) => Math.hypot(player.x - hazard.x, player.y - hazard.y) < hazard.radius)) speed *= 0.68;
    if (player.dashTime > 0) {
      player.dashTime -= dt;
      move = player.dashVector;
      speed = GAME.dashSpeed;
      if (Math.random() < 0.72) this.particles.push({ x: player.x, y: player.y, vx: -move.x * 90, vy: -move.y * 90, life: 0.25, maxLife: 0.25, size: 11, color: "#4df6ff", type: "trail" });
    }

    player.x = clamp(player.x + move.x * speed * dt, 36, GAME.width - 36);
    player.y = clamp(player.y + move.y * speed * dt, 36, GAME.height - 36);
    if (move.x || move.y) player.rotation = Math.atan2(move.y, move.x);
  }

  updateSpawning(dt) {
    const run = this.run;
    if (!run.bossSpawned && run.elapsed >= GAME.bossTime) {
      run.bossSpawned = true;
      const boss = this.spawnEnemy("boss", true);
      run.boss = boss;
      this.callbacks.onAnnouncement?.({ title: "零号收割机", subtitle: "最终协议入侵" });
      this.flash = this.settings.reduceFlash ? 0.12 : 0.48;
      this.shake = 16;
      audio.explosion();
    }

    for (const eliteTime of [95, 215]) {
      if (run.elapsed >= eliteTime && !run.eliteFlags.has(eliteTime)) {
        run.eliteFlags.add(eliteTime);
        const type = eliteTime === 95 ? "eliteHunter" : "eliteShooter";
        this.spawnEnemy(type, true);
        this.callbacks.onAnnouncement?.({ title: ENEMIES[type].name, subtitle: "高价值目标已出现" });
      }
    }

    run.spawnTimer -= dt;
    if (run.spawnTimer <= 0 && this.enemies.length < GAME.maxEnemies) {
      const profile = getWaveProfile(run.elapsed);
      const batch = run.elapsed > 260 ? (Math.random() < 0.38 ? 2 : 1) : 1;
      for (let i = 0; i < batch; i += 1) {
        const type = profile.pool[Math.floor(Math.random() * profile.pool.length)];
        this.spawnEnemy(type);
      }
      const pressure = run.bossSpawned ? 1.35 : 1;
      run.spawnTimer = profile.rate * pressure * randomBetween(0.78, 1.18);
    }
  }

  spawnEnemy(typeId, far = false, override = {}) {
    const definition = ENEMIES[typeId];
    const angle = Math.random() * TAU;
    const margin = far ? Math.max(this.view.width, this.view.height) * 0.68 : Math.max(this.view.width, this.view.height) * randomBetween(0.52, 0.7);
    const x = clamp(this.player.x + Math.cos(angle) * margin, 42, GAME.width - 42);
    const y = clamp(this.player.y + Math.sin(angle) * margin, 42, GAME.height - 42);
    const difficulty = 1 + Math.min(0.82, this.run.elapsed / GAME.runDuration * 0.82);
    const enemy = {
      ...definition,
      ...override,
      x: override.x ?? x,
      y: override.y ?? y,
      maxHp: (override.hp ?? definition.hp) * difficulty,
      hp: (override.hp ?? definition.hp) * difficulty,
      speed: (override.speed ?? definition.speed) * (1 + Math.min(0.22, this.run.elapsed / 1200)),
      damage: (override.damage ?? definition.damage) * (1 + this.run.elapsed / 900),
      rotation: 0,
      hitFlash: 0,
      touchTimer: 0,
      shootTimer: randomBetween(0.5, 1.5),
      chargeTimer: randomBetween(2, 4),
      chargeState: "idle",
      chargePhase: 0,
      chargeVector: { x: 0, y: 0 },
      abilityTimer: randomBetween(1.5, 3),
      orbitHits: {},
      dead: false,
    };
    this.enemies.push(enemy);
    return enemy;
  }

  updateEnemies(dt) {
    const player = this.player;
    const alive = [];
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt * 5);
      enemy.touchTimer = Math.max(0, enemy.touchTimer - dt);
      enemy.shootTimer -= dt;
      enemy.chargeTimer -= dt;
      enemy.abilityTimer -= dt;

      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const dist = Math.max(0.001, Math.hypot(dx, dy));
      const direction = { x: dx / dist, y: dy / dist };
      enemy.rotation = Math.atan2(dy, dx);

      let vx = direction.x * enemy.speed;
      let vy = direction.y * enemy.speed;

      if (enemy.ranged && !enemy.boss) {
        const desired = enemy.elite ? 330 : 285;
        const sign = dist < desired - 45 ? -1 : dist > desired + 60 ? 1 : 0;
        vx = direction.x * enemy.speed * sign + -direction.y * enemy.speed * 0.38;
        vy = direction.y * enemy.speed * sign + direction.x * enemy.speed * 0.38;
        if (enemy.shootTimer <= 0 && dist < 620) {
          this.fireEnemyProjectile(enemy, direction, enemy.elite ? 3 : 1);
          enemy.shootTimer = enemy.elite ? 1.35 : 2.15;
        }
      }

      if (enemy.charger && enemy.chargeState === "idle" && enemy.chargeTimer <= 0 && dist < 650) {
        enemy.chargeState = "telegraph";
        enemy.chargePhase = enemy.boss ? 0.82 : 0.65;
        enemy.chargeVector = direction;
      }
      if (enemy.chargeState === "telegraph") {
        enemy.chargePhase -= dt;
        vx = 0;
        vy = 0;
        if (enemy.chargePhase <= 0) {
          enemy.chargeState = "charge";
          enemy.chargePhase = enemy.boss ? 0.72 : 0.48;
        }
      } else if (enemy.chargeState === "charge") {
        enemy.chargePhase -= dt;
        vx = enemy.chargeVector.x * (enemy.boss ? 420 : 510);
        vy = enemy.chargeVector.y * (enemy.boss ? 420 : 510);
        if (enemy.chargePhase <= 0) {
          enemy.chargeState = "idle";
          enemy.chargeTimer = enemy.boss ? 3.1 : 4.4;
        }
      }

      if (enemy.jammer && enemy.abilityTimer <= 0) {
        this.hazards.push({ x: enemy.x, y: enemy.y, radius: 135, life: 3.4, maxLife: 3.4, color: "#d35cff" });
        enemy.abilityTimer = 5.2;
      }

      if (enemy.boss) {
        const enraged = enemy.hp < enemy.maxHp * 0.5;
        if (enemy.shootTimer <= 0) {
          this.fireRadial(enemy, enraged ? 14 : 10, enraged ? 245 : 205);
          enemy.shootTimer = enraged ? 1.45 : 2.15;
          audio.shoot("grenade");
        }
        if (enemy.abilityTimer <= 0) {
          for (let i = 0; i < (enraged ? 5 : 3); i += 1) {
            const angle = Math.random() * TAU;
            this.spawnEnemy(Math.random() < 0.5 ? "skitter" : "hunter", false, {
              x: clamp(enemy.x + Math.cos(angle) * 90, 35, GAME.width - 35),
              y: clamp(enemy.y + Math.sin(angle) * 90, 35, GAME.height - 35),
            });
          }
          enemy.abilityTimer = enraged ? 4.4 : 6.2;
        }
      }

      enemy.x = clamp(enemy.x + vx * dt, 28, GAME.width - 28);
      enemy.y = clamp(enemy.y + vy * dt, 28, GAME.height - 28);
      alive.push(enemy);
    }
    this.enemies = alive;

    for (const hazard of this.hazards) hazard.life -= dt;
    this.hazards = this.hazards.filter((hazard) => hazard.life > 0);
  }

  fireEnemyProjectile(enemy, direction, count = 1) {
    for (let i = 0; i < count; i += 1) {
      const spread = (i - (count - 1) / 2) * 0.16;
      const angle = Math.atan2(direction.y, direction.x) + spread;
      this.enemyProjectiles.push({
        x: enemy.x + Math.cos(angle) * enemy.radius,
        y: enemy.y + Math.sin(angle) * enemy.radius,
        vx: Math.cos(angle) * 220,
        vy: Math.sin(angle) * 220,
        radius: enemy.elite ? 7 : 5,
        damage: enemy.damage,
        life: 4,
        color: enemy.color,
      });
    }
  }

  fireRadial(enemy, count, speed) {
    const offset = this.run.elapsed * 0.7;
    for (let i = 0; i < count; i += 1) {
      const angle = offset + (i / count) * TAU;
      this.enemyProjectiles.push({
        x: enemy.x + Math.cos(angle) * enemy.radius,
        y: enemy.y + Math.sin(angle) * enemy.radius,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 7,
        damage: enemy.damage * 0.7,
        life: 5,
        color: "#ff477f",
      });
    }
  }

  updateWeapons(dt) {
    const run = this.run;
    for (const id of Object.keys(run.weaponTimers)) run.weaponTimers[id] -= dt;
    if (run.weaponLevels.pulse > 0 && run.weaponTimers.pulse <= 0) this.firePulse();
    if (run.weaponLevels.arc > 0 && run.weaponTimers.arc <= 0) this.fireArc();
    if (run.weaponLevels.beam > 0 && run.weaponTimers.beam <= 0) this.fireBeam();
    if (run.weaponLevels.grenade > 0 && run.weaponTimers.grenade <= 0) this.fireGrenade();
    if (run.weaponLevels.drone > 0 && run.weaponTimers.drone <= 0) this.fireDrones();
    if (run.weaponLevels.orbit > 0) this.updateOrbitBlades(dt);
  }

  weaponCooldown(id) {
    return WEAPONS[id].cooldown * this.run.weaponMods[id].cooldown * this.run.global.cooldown;
  }

  weaponDamage(id) {
    return WEAPONS[id].damage * this.run.weaponMods[id].damage * this.run.global.damage;
  }

  nearestEnemies(origin, range, count = 1, excluded = new Set()) {
    const maxDistance = range * range;
    return this.enemies
      .filter((enemy) => !enemy.dead && !excluded.has(enemy) && distanceSquared(origin, enemy) <= maxDistance)
      .sort((a, b) => distanceSquared(origin, a) - distanceSquared(origin, b))
      .slice(0, count);
  }

  firePulse() {
    const mods = this.run.weaponMods.pulse;
    const targets = this.nearestEnemies(this.player, WEAPONS.pulse.range * mods.range, 1);
    if (!targets.length) { this.run.weaponTimers.pulse = 0.12; return; }
    const target = targets[0];
    const baseAngle = Math.atan2(target.y - this.player.y, target.x - this.player.x);
    const count = Math.max(1, Math.round(mods.count));
    for (let index = 0; index < count; index += 1) {
      const angle = baseAngle + (index - (count - 1) / 2) * 0.075;
      this.projectiles.push({
        kind: "pulse", x: this.player.x, y: this.player.y,
        vx: Math.cos(angle) * WEAPONS.pulse.speed, vy: Math.sin(angle) * WEAPONS.pulse.speed,
        radius: 4, damage: this.weaponDamage("pulse"), life: 1.25,
        color: WEAPONS.pulse.color, pierce: mods.pierce, hit: new Set(),
      });
    }
    this.player.rotation = baseAngle;
    this.run.weaponTimers.pulse = this.weaponCooldown("pulse");
    audio.shoot("pulse");
  }

  fireArc() {
    const mods = this.run.weaponMods.arc;
    const first = this.nearestEnemies(this.player, WEAPONS.arc.range * mods.range, 1)[0];
    if (!first) { this.run.weaponTimers.arc = 0.16; return; }
    const hit = new Set();
    const points = [{ x: this.player.x, y: this.player.y }];
    let current = first;
    const chains = WEAPONS.arc.chains + Math.round(mods.chains);
    for (let index = 0; current && index < chains; index += 1) {
      hit.add(current);
      points.push({ x: current.x, y: current.y });
      this.damageEnemy(current, this.weaponDamage("arc") * Math.max(0.62, 1 - index * 0.08), "arc");
      current = this.nearestEnemies(current, 235 * mods.range, 1, hit)[0];
    }
    this.effects.push({ type: "arc", points, life: 0.18, maxLife: 0.18, color: WEAPONS.arc.color });
    this.run.weaponTimers.arc = this.weaponCooldown("arc");
    audio.shoot("arc");
  }

  fireBeam() {
    const mods = this.run.weaponMods.beam;
    const targets = this.nearestEnemies(this.player, WEAPONS.beam.range * mods.range, Math.max(1, Math.round(mods.count)));
    if (!targets.length) { this.run.weaponTimers.beam = 0.14; return; }
    for (const target of targets) {
      this.damageEnemy(target, this.weaponDamage("beam"), "beam");
      this.effects.push({ type: "beam", from: { x: this.player.x, y: this.player.y }, to: { x: target.x, y: target.y }, life: 0.22, maxLife: 0.22, color: WEAPONS.beam.color });
    }
    this.run.weaponTimers.beam = this.weaponCooldown("beam");
    audio.shoot("beam");
  }

  fireGrenade() {
    const mods = this.run.weaponMods.grenade;
    const targets = this.nearestEnemies(this.player, WEAPONS.grenade.range * mods.range, 1);
    if (!targets.length) { this.run.weaponTimers.grenade = 0.18; return; }
    const target = targets[0];
    const direction = normalized(target.x - this.player.x, target.y - this.player.y);
    this.projectiles.push({
      kind: "grenade", x: this.player.x, y: this.player.y,
      vx: direction.x * WEAPONS.grenade.speed, vy: direction.y * WEAPONS.grenade.speed,
      radius: 9, damage: this.weaponDamage("grenade"), life: 1.45,
      color: WEAPONS.grenade.color, blast: WEAPONS.grenade.blast * mods.blast,
      cluster: Math.round(mods.cluster), hit: new Set(),
    });
    this.run.weaponTimers.grenade = this.weaponCooldown("grenade");
    audio.shoot("grenade");
  }

  dronePositions() {
    const count = Math.max(1, Math.round(this.run.weaponMods.drone.count));
    return Array.from({ length: count }, (_, index) => {
      const angle = this.run.elapsed * 1.6 + index / count * TAU;
      return { x: this.player.x + Math.cos(angle) * 58, y: this.player.y + Math.sin(angle) * 58, angle };
    });
  }

  fireDrones() {
    const drones = this.dronePositions();
    let fired = false;
    for (const drone of drones) {
      const target = this.nearestEnemies(drone, WEAPONS.drone.range, 1)[0];
      if (!target) continue;
      fired = true;
      const direction = normalized(target.x - drone.x, target.y - drone.y);
      this.projectiles.push({
        kind: "drone", x: drone.x, y: drone.y,
        vx: direction.x * 580, vy: direction.y * 580,
        radius: 3, damage: this.weaponDamage("drone"), life: 1.1,
        color: WEAPONS.drone.color, pierce: 0, hit: new Set(),
      });
    }
    this.run.weaponTimers.drone = fired ? this.weaponCooldown("drone") : 0.16;
    if (fired) audio.shoot("drone");
  }

  updateOrbitBlades(dt) {
    const mods = this.run.weaponMods.orbit;
    const count = Math.max(1, Math.round(mods.count));
    const radius = WEAPONS.orbit.radius * mods.radius;
    for (let index = 0; index < count; index += 1) {
      const angle = this.run.elapsed * 2.9 + index / count * TAU;
      const blade = { x: this.player.x + Math.cos(angle) * radius, y: this.player.y + Math.sin(angle) * radius, radius: 11 * Math.sqrt(mods.radius) };
      for (const enemy of this.enemies) {
        if (enemy.dead) continue;
        enemy.orbitHits[index] = Math.max(0, (enemy.orbitHits[index] || 0) - dt);
        const hitRadius = blade.radius + enemy.radius;
        if (distanceSquared(blade, enemy) <= hitRadius * hitRadius && enemy.orbitHits[index] <= 0) {
          this.damageEnemy(enemy, this.weaponDamage("orbit"), "orbit");
          enemy.orbitHits[index] = this.weaponCooldown("orbit");
        }
      }
    }
  }

  updateProjectiles(dt) {
    const alive = [];
    for (const projectile of this.projectiles) {
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.life -= dt;
      let removed = false;
      for (const enemy of this.enemies) {
        if (enemy.dead || projectile.hit.has(enemy)) continue;
        const radius = projectile.radius + enemy.radius;
        if (distanceSquared(projectile, enemy) > radius * radius) continue;
        if (projectile.kind === "grenade") {
          this.explode(projectile.x, projectile.y, projectile.damage, projectile.blast, projectile.cluster);
          removed = true;
          break;
        }
        projectile.hit.add(enemy);
        this.damageEnemy(enemy, projectile.damage, projectile.kind);
        if (projectile.pierce > 0) projectile.pierce -= 1;
        else { removed = true; break; }
      }
      if (!removed && projectile.life > 0 && projectile.x > 0 && projectile.x < GAME.width && projectile.y > 0 && projectile.y < GAME.height) alive.push(projectile);
      else if (!removed && projectile.kind === "grenade") this.explode(projectile.x, projectile.y, projectile.damage, projectile.blast, projectile.cluster);
    }
    this.projectiles = alive;
  }

  explode(x, y, damage, radius, cluster = 0) {
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      const distance = Math.hypot(enemy.x - x, enemy.y - y);
      if (distance <= radius + enemy.radius) {
        const falloff = 1 - Math.min(0.48, distance / Math.max(1, radius) * 0.48);
        this.damageEnemy(enemy, damage * falloff, "grenade");
      }
    }
    this.effects.push({ type: "explosion", x, y, radius, life: 0.34, maxLife: 0.34, color: WEAPONS.grenade.color });
    this.spawnBurst(x, y, WEAPONS.grenade.color, 18, 230);
    this.shake = Math.max(this.shake, 8);
    audio.explosion();
    if (cluster > 0) {
      for (let i = 0; i < cluster * 3; i += 1) {
        const angle = i / (cluster * 3) * TAU + Math.random() * 0.4;
        const offset = radius * randomBetween(0.45, 0.88);
        this.effects.push({ type: "delayedExplosion", x: x + Math.cos(angle) * offset, y: y + Math.sin(angle) * offset, radius: radius * 0.42, damage: damage * 0.38, life: 0.22 + i * 0.035, maxLife: 0.22 + i * 0.035, triggered: false, color: "#ffc066" });
      }
    }
  }

  updateEnemyProjectiles(dt) {
    const alive = [];
    for (const projectile of this.enemyProjectiles) {
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.life -= dt;
      const radius = projectile.radius + this.player.radius;
      if (distanceSquared(projectile, this.player) <= radius * radius) {
        this.damagePlayer(projectile.damage);
        this.spawnBurst(projectile.x, projectile.y, projectile.color, 6, 100);
        continue;
      }
      if (projectile.life > 0 && projectile.x > 0 && projectile.x < GAME.width && projectile.y > 0 && projectile.y < GAME.height) alive.push(projectile);
    }
    this.enemyProjectiles = alive;
  }

  resolveContactDamage() {
    for (const enemy of this.enemies) {
      if (enemy.dead || enemy.touchTimer > 0) continue;
      const radius = enemy.radius + this.player.radius;
      if (distanceSquared(enemy, this.player) <= radius * radius) {
        enemy.touchTimer = 0.65;
        this.damagePlayer(enemy.damage);
        const push = normalized(enemy.x - this.player.x, enemy.y - this.player.y);
        enemy.x += push.x * 22;
        enemy.y += push.y * 22;
      }
    }
  }

  damagePlayer(amount) {
    const player = this.player;
    if (player.invulnerable > 0 || this.state !== "playing") return;
    let remaining = amount;
    if (player.shield > 0) {
      const blocked = Math.min(player.shield, remaining);
      player.shield -= blocked;
      remaining -= blocked;
    }
    player.health -= remaining;
    player.invulnerable = 0.72;
    this.shake = Math.max(this.shake, 10);
    this.flash = this.settings.reduceFlash ? 0.06 : 0.24;
    audio.hurt();
    this.spawnBurst(player.x, player.y, "#ff537d", 12, 170);
    if (player.health <= 0) {
      player.health = 0;
      this.finish(false);
    }
  }

  damageEnemy(enemy, amount, source) {
    if (enemy.dead) return;
    const critical = Math.random() < this.run.global.crit;
    const finalDamage = amount * (critical ? 1.75 : 1);
    enemy.hp -= finalDamage;
    enemy.hitFlash = 0.18;
    this.damageTexts.push({ x: enemy.x + randomBetween(-6, 6), y: enemy.y - enemy.radius, value: Math.round(finalDamage), critical, life: 0.62, maxLife: 0.62 });
    if (Math.random() < 0.6) this.particles.push({ x: enemy.x, y: enemy.y, vx: randomBetween(-80, 80), vy: randomBetween(-80, 80), life: 0.24, maxLife: 0.24, size: critical ? 5 : 3, color: critical ? "#fff07a" : WEAPONS[source]?.color || "#ffffff", type: "spark" });
    audio.hit();
    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  killEnemy(enemy) {
    if (enemy.dead) return;
    enemy.dead = true;
    this.run.kills += 1;
    this.spawnBurst(enemy.x, enemy.y, enemy.color, enemy.boss ? 46 : enemy.elite ? 24 : 10, enemy.boss ? 330 : 150);
    const gemCount = enemy.elite ? 6 : enemy.boss ? 14 : 1;
    for (let index = 0; index < gemCount; index += 1) {
      const angle = Math.random() * TAU;
      this.pickups.push({
        type: "xp",
        x: enemy.x + Math.cos(angle) * randomBetween(0, enemy.radius),
        y: enemy.y + Math.sin(angle) * randomBetween(0, enemy.radius),
        vx: Math.cos(angle) * randomBetween(25, 90),
        vy: Math.sin(angle) * randomBetween(25, 90),
        value: Math.max(1, Math.round(enemy.xp / gemCount)),
        radius: enemy.elite ? 6 : 4,
        life: 28,
      });
    }
    if (enemy.elite || Math.random() < 0.16) {
      const value = enemy.elite ? 12 : 2;
      this.pickups.push({ type: "scrap", x: enemy.x, y: enemy.y, vx: randomBetween(-50, 50), vy: randomBetween(-50, 50), value, radius: 6, life: 28 });
    }
    if (enemy.splitter && !enemy.elite) {
      for (let i = 0; i < 2; i += 1) {
        const angle = i * Math.PI + Math.random();
        this.spawnEnemy("skitter", false, { x: enemy.x + Math.cos(angle) * 18, y: enemy.y + Math.sin(angle) * 18, hp: 13, radius: 9, xp: 2 });
      }
    }
  }

  updatePickups(dt) {
    const alive = [];
    const magnetRange = 92 * this.run.global.magnet;
    for (const pickup of this.pickups) {
      pickup.life -= dt;
      pickup.vx *= Math.pow(0.02, dt);
      pickup.vy *= Math.pow(0.02, dt);
      pickup.x += pickup.vx * dt;
      pickup.y += pickup.vy * dt;
      const distance = Math.hypot(this.player.x - pickup.x, this.player.y - pickup.y);
      if (distance < magnetRange) {
        const pull = normalized(this.player.x - pickup.x, this.player.y - pickup.y);
        const force = 260 + (1 - distance / magnetRange) * 700;
        pickup.x += pull.x * force * dt;
        pickup.y += pull.y * force * dt;
      }
      if (distance < this.player.radius + pickup.radius + 8) {
        if (pickup.type === "xp") this.addXp(pickup.value);
        else this.run.scrap += Math.max(1, Math.round(pickup.value * this.run.scrapMultiplier));
        audio.pickup();
        continue;
      }
      if (pickup.life > 0) alive.push(pickup);
    }
    this.pickups = alive;
  }

  addXp(amount) {
    this.run.xp += amount;
    while (this.run.xp >= this.run.xpNeeded) {
      this.run.xp -= this.run.xpNeeded;
      this.run.level += 1;
      this.run.xpNeeded = xpForLevel(this.run.level);
      this.run.pendingLevels += 1;
    }
    if (this.run.pendingLevels > 0 && this.state === "playing") this.openUpgrade();
  }

  openUpgrade() {
    this.state = "upgrading";
    audio.levelUp();
    this.callbacks.onUpgrade?.(this.getUpgradeChoices());
  }

  getUpgradeChoices() {
    const candidates = UPGRADES.filter((upgrade) => {
      const level = this.run.upgradeLevels[upgrade.id] || 0;
      if (level >= upgrade.max) return false;
      if (upgrade.unlock) return this.run.weaponLevels[upgrade.weapon] === 0;
      if (upgrade.weapon) return this.run.weaponLevels[upgrade.weapon] > 0;
      return true;
    }).map((upgrade) => {
      let weight = 1;
      if (upgrade.weapon && this.run.weaponLevels[upgrade.weapon] > 0) weight = 1.55;
      if (upgrade.unlock) weight = 0.72;
      if (upgrade.rarity === "epic") weight *= 0.42;
      if (upgrade.rarity === "rare") weight *= 0.72;
      return { ...upgrade, weight };
    });
    const pool = [...candidates];
    const choices = [];
    while (pool.length && choices.length < 3) {
      const choice = weightedSample(pool);
      choices.push(choice);
      pool.splice(pool.findIndex((item) => item.id === choice.id), 1);
    }
    return choices;
  }

  rerollUpgrades() {
    if (this.state !== "upgrading" || this.run.rerolls <= 0) return false;
    this.run.rerolls -= 1;
    this.callbacks.onUpgrade?.(this.getUpgradeChoices());
    return true;
  }

  chooseUpgrade(id) {
    if (this.state !== "upgrading") return;
    const upgrade = UPGRADES.find((item) => item.id === id);
    if (!upgrade) return;
    const current = this.run.upgradeLevels[id] || 0;
    if (current >= upgrade.max) return;
    this.run.upgradeLevels[id] = current + 1;
    if (upgrade.unlock) {
      this.run.weaponLevels[upgrade.weapon] = 1;
    } else if (upgrade.weapon) {
      const mods = this.run.weaponMods[upgrade.weapon];
      if (["count", "pierce", "chains", "cluster"].includes(upgrade.stat)) mods[upgrade.stat] += upgrade.amount;
      else if (upgrade.stat === "cooldown") mods.cooldown *= 1 - upgrade.amount;
      else mods[upgrade.stat] *= 1 + upgrade.amount;
      this.run.weaponLevels[upgrade.weapon] += 1;
    } else if (upgrade.global) {
      if (upgrade.global === "speed") this.run.global.speed += upgrade.amount;
      if (upgrade.global === "magnet") this.run.global.magnet += upgrade.amount;
      if (upgrade.global === "cooldown") this.run.global.cooldown *= 1 - upgrade.amount;
      if (upgrade.global === "crit") this.run.global.crit += upgrade.amount;
      if (upgrade.global === "dash") this.run.global.dashCooldown *= 1 - upgrade.amount;
      if (upgrade.global === "health") {
        this.player.maxHealth += upgrade.amount;
        this.player.health = Math.min(this.player.maxHealth, this.player.health + upgrade.amount);
      }
      if (upgrade.global === "shield") {
        this.run.global.shieldMax += upgrade.amount;
        this.player.shield = this.run.global.shieldMax;
      }
    }
    this.run.pendingLevels -= 1;
    this.callbacks.onUpgradeChosen?.(upgrade);
    if (this.run.pendingLevels > 0) this.callbacks.onUpgrade?.(this.getUpgradeChoices());
    else {
      this.state = "playing";
      this.lastFrame = performance.now();
      this.callbacks.onUpgradeClosed?.();
      this.callbacks.onAnnouncement?.({ title: upgrade.name, subtitle: "构筑已进化" });
    }
    this.emitHud(true);
  }

  updateEffects(dt) {
    const effects = [];
    for (const effect of this.effects) {
      effect.life -= dt;
      if (effect.type === "delayedExplosion" && effect.life <= 0 && !effect.triggered) {
        effect.triggered = true;
        for (const enemy of this.enemies) {
          if (enemy.dead) continue;
          const distance = Math.hypot(enemy.x - effect.x, enemy.y - effect.y);
          if (distance <= effect.radius + enemy.radius) this.damageEnemy(enemy, effect.damage, "grenade");
        }
        effects.push({ type: "explosion", x: effect.x, y: effect.y, radius: effect.radius, life: 0.25, maxLife: 0.25, color: effect.color });
        this.spawnBurst(effect.x, effect.y, effect.color, 7, 130);
        continue;
      }
      if (effect.life > 0) effects.push(effect);
    }
    this.effects = effects;
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.pow(0.04, dt);
      particle.vy *= Math.pow(0.04, dt);
    }
    this.particles = this.particles.filter((particle) => particle.life > 0).slice(-650);
    for (const text of this.damageTexts) {
      text.life -= dt;
      text.y -= dt * 42;
    }
    this.damageTexts = this.damageTexts.filter((text) => text.life > 0).slice(-100);
  }

  spawnBurst(x, y, color, count, speed) {
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * TAU;
      const velocity = randomBetween(speed * 0.25, speed);
      this.particles.push({ x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity, life: randomBetween(0.18, 0.55), maxLife: 0.55, size: randomBetween(2, 6), color, type: "spark" });
    }
  }

  finish(victory) {
    if (!["playing", "upgrading"].includes(this.state)) return;
    this.run.victory = victory;
    const time = Math.min(this.run.elapsed, GAME.runDuration);
    const completion = victory ? 45 : 0;
    const earnedScrap = Math.round((this.run.scrap + this.run.kills * 0.42 + this.run.level * 2.4 + completion) * this.run.scrapMultiplier);
    this.state = "result";
    this.callbacks.onResult?.({
      victory,
      time,
      timeText: formatTime(time),
      kills: this.run.kills,
      level: this.run.level,
      scrap: earnedScrap,
      coreId: this.run.coreId,
    });
    this.callbacks.onState?.("result");
  }

  emitHud(force = false) {
    if (!this.run || !this.player) return;
    const remaining = Math.max(0, GAME.runDuration - this.run.elapsed);
    const phase = this.run.bossSpawned ? "最终协议" : `敌潮 ${String(Math.min(6, Math.floor(this.run.elapsed / 60) + 1)).padStart(2, "0")}`;
    this.callbacks.onHud?.({
      level: this.run.level,
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      shield: this.player.shield,
      shieldMax: this.run.global.shieldMax,
      xp: this.run.xp,
      xpNeeded: this.run.xpNeeded,
      time: formatTime(remaining),
      phase,
      kills: this.run.kills,
      scrap: this.run.scrap,
      dash: 1 - clamp(this.player.dashCooldown / (GAME.dashCooldown * this.run.global.dashCooldown), 0, 1),
      weapons: Object.entries(this.run.weaponLevels).filter(([, level]) => level > 0).map(([id, level]) => ({ ...WEAPONS[id], level })),
      boss: this.run.boss && !this.run.boss.dead ? { name: this.run.boss.name, ratio: Math.max(0, this.run.boss.hp / this.run.boss.maxHp) } : null,
      force,
    });
  }

  worldToScreen(x, y, shakeX = 0, shakeY = 0) {
    return {
      x: x - this.camera.x + this.view.width / 2 + shakeX,
      y: y - this.camera.y + this.view.height / 2 + shakeY,
    };
  }

  render(time) {
    const ctx = this.ctx;
    ctx.setTransform(this.view.dpr, 0, 0, this.view.dpr, 0, 0);
    ctx.clearRect(0, 0, this.view.width, this.view.height);
    if (this.state === "menu" || !this.run) {
      this.renderMenuAmbient(time);
      return;
    }

    const shakeAmount = this.settings.shake ? this.shake : 0;
    const shakeX = randomBetween(-shakeAmount, shakeAmount);
    const shakeY = randomBetween(-shakeAmount, shakeAmount);
    this.renderArena(time, shakeX, shakeY);
    this.renderHazards(shakeX, shakeY);
    this.renderPickups(time, shakeX, shakeY);
    this.renderProjectiles(shakeX, shakeY);
    this.renderEnemies(time, shakeX, shakeY);
    this.renderWeapons(time, shakeX, shakeY);
    this.renderPlayer(time, shakeX, shakeY);
    this.renderEffects(shakeX, shakeY);
    this.renderDamageTexts(shakeX, shakeY);

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255, 76, 124, ${this.flash * (this.settings.reduceFlash ? 0.16 : 0.38)})`;
      ctx.fillRect(0, 0, this.view.width, this.view.height);
    }
  }

  renderMenuAmbient(time) {
    const ctx = this.ctx;
    const gradient = ctx.createRadialGradient(this.view.width * 0.76, this.view.height * 0.45, 10, this.view.width * 0.76, this.view.height * 0.45, Math.max(this.view.width, this.view.height) * 0.62);
    gradient.addColorStop(0, "#151d3f");
    gradient.addColorStop(0.42, "#090c1d");
    gradient.addColorStop(1, "#04060d");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.view.width, this.view.height);
    ctx.strokeStyle = "rgba(77, 246, 255, .06)";
    ctx.lineWidth = 1;
    const spacing = 55;
    const offset = (time * 7) % spacing;
    for (let x = -spacing + offset; x < this.view.width + spacing; x += spacing) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.view.height); ctx.stroke();
    }
    for (let y = -spacing + offset; y < this.view.height + spacing; y += spacing) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.view.width, y); ctx.stroke();
    }
    for (const star of this.menuStars) {
      const alpha = 0.16 + Math.sin(time * 1.6 + star.phase) * 0.09;
      ctx.fillStyle = `rgba(133, 232, 255, ${alpha})`;
      ctx.fillRect(star.x * this.view.width, star.y * this.view.height, star.size, star.size);
    }
    const cx = this.view.width * 0.76;
    const cy = this.view.height * 0.45;
    const radius = Math.min(this.view.width, this.view.height) * 0.19;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(time * 0.11);
    ctx.strokeStyle = "rgba(77, 246, 255, .18)";
    ctx.lineWidth = 1;
    for (let ring = 0; ring < 3; ring += 1) {
      ctx.beginPath();
      ctx.arc(0, 0, radius * (0.65 + ring * 0.25), ring * 0.8, Math.PI * (1.2 + ring * 0.42));
      ctx.stroke();
    }
    ctx.rotate(-time * 0.32);
    ctx.strokeStyle = "rgba(182, 112, 255, .42)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const angle = i / 6 * TAU;
      const r = i % 2 ? radius * 0.34 : radius * 0.52;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  renderArena(time, shakeX, shakeY) {
    const ctx = this.ctx;
    ctx.fillStyle = "#050813";
    ctx.fillRect(0, 0, this.view.width, this.view.height);
    const grid = 64;
    const cameraLeft = this.camera.x - this.view.width / 2 - shakeX;
    const cameraTop = this.camera.y - this.view.height / 2 - shakeY;
    const xOffset = -(cameraLeft % grid);
    const yOffset = -(cameraTop % grid);
    ctx.strokeStyle = "rgba(66, 163, 195, .075)";
    ctx.lineWidth = 1;
    for (let x = xOffset; x < this.view.width; x += grid) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.view.height); ctx.stroke(); }
    for (let y = yOffset; y < this.view.height; y += grid) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.view.width, y); ctx.stroke(); }

    for (const decoration of this.decorations) {
      const point = this.worldToScreen(decoration.x, decoration.y, shakeX, shakeY);
      if (point.x < -30 || point.x > this.view.width + 30 || point.y < -30 || point.y > this.view.height + 30) continue;
      ctx.strokeStyle = decoration.kind === 0 ? "rgba(77,246,255,.13)" : "rgba(130,92,210,.1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(point.x - decoration.size * 2, point.y);
      ctx.lineTo(point.x + decoration.size * 2, point.y);
      ctx.moveTo(point.x, point.y - decoration.size * 2);
      ctx.lineTo(point.x, point.y + decoration.size * 2);
      ctx.stroke();
    }

    const topLeft = this.worldToScreen(0, 0, shakeX, shakeY);
    ctx.strokeStyle = "rgba(77,246,255,.3)";
    ctx.lineWidth = 3;
    ctx.strokeRect(topLeft.x, topLeft.y, GAME.width, GAME.height);
    const pulse = 0.03 + Math.sin(time * 0.8) * 0.015;
    ctx.fillStyle = `rgba(72, 53, 140, ${pulse})`;
    ctx.fillRect(0, 0, this.view.width, this.view.height);
  }

  renderHazards(shakeX, shakeY) {
    const ctx = this.ctx;
    for (const hazard of this.hazards) {
      const point = this.worldToScreen(hazard.x, hazard.y, shakeX, shakeY);
      const ratio = hazard.life / hazard.maxLife;
      ctx.fillStyle = `rgba(194, 72, 255, ${0.05 + ratio * 0.04})`;
      ctx.strokeStyle = `rgba(210, 92, 255, ${0.22 + ratio * 0.2})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(point.x, point.y, hazard.radius, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.setLineDash([5, 10]);
      ctx.beginPath(); ctx.arc(point.x, point.y, hazard.radius * 0.7, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  renderPickups(time, shakeX, shakeY) {
    const ctx = this.ctx;
    for (const pickup of this.pickups) {
      const point = this.worldToScreen(pickup.x, pickup.y, shakeX, shakeY);
      if (point.x < -20 || point.x > this.view.width + 20 || point.y < -20 || point.y > this.view.height + 20) continue;
      ctx.save();
      ctx.translate(point.x, point.y + Math.sin(time * 5 + pickup.x) * 2);
      ctx.rotate(time * 2.2 + pickup.y);
      ctx.shadowBlur = 12;
      ctx.shadowColor = pickup.type === "xp" ? "#55efff" : "#ffcf64";
      ctx.fillStyle = pickup.type === "xp" ? "#6ef5ff" : "#ffcf64";
      ctx.fillRect(-pickup.radius, -pickup.radius, pickup.radius * 2, pickup.radius * 2);
      ctx.restore();
    }
  }

  renderProjectiles(shakeX, shakeY) {
    const ctx = this.ctx;
    for (const projectile of this.projectiles) {
      const point = this.worldToScreen(projectile.x, projectile.y, shakeX, shakeY);
      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.rotate(Math.atan2(projectile.vy, projectile.vx));
      ctx.shadowBlur = 12;
      ctx.shadowColor = projectile.color;
      ctx.fillStyle = projectile.color;
      if (projectile.kind === "grenade") {
        ctx.beginPath(); ctx.arc(0, 0, projectile.radius, 0, TAU); ctx.fill();
        ctx.strokeStyle = "#ffe2a3"; ctx.lineWidth = 2; ctx.stroke();
      } else {
        ctx.fillRect(-10, -projectile.radius, 18, projectile.radius * 2);
      }
      ctx.restore();
    }
    for (const projectile of this.enemyProjectiles) {
      const point = this.worldToScreen(projectile.x, projectile.y, shakeX, shakeY);
      ctx.save();
      ctx.shadowBlur = 14;
      ctx.shadowColor = projectile.color;
      ctx.fillStyle = projectile.color;
      ctx.beginPath(); ctx.arc(point.x, point.y, projectile.radius, 0, TAU); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.72)"; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }
  }

  renderEnemies(time, shakeX, shakeY) {
    const ctx = this.ctx;
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      const point = this.worldToScreen(enemy.x, enemy.y, shakeX, shakeY);
      if (point.x < -100 || point.x > this.view.width + 100 || point.y < -100 || point.y > this.view.height + 100) continue;
      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.rotate(enemy.rotation);
      if (enemy.chargeState === "telegraph") {
        ctx.strokeStyle = `rgba(255, 72, 92, ${0.4 + Math.sin(time * 18) * 0.22})`;
        ctx.lineWidth = enemy.boss ? 12 : 5;
        ctx.setLineDash([12, 8]);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(600, 0); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.shadowBlur = enemy.elite || enemy.boss ? 24 : 12;
      ctx.shadowColor = enemy.color;
      ctx.fillStyle = enemy.hitFlash > 0 ? "#ffffff" : enemy.color;
      ctx.strokeStyle = enemy.elite || enemy.boss ? "#fff4a3" : "rgba(255,255,255,.34)";
      ctx.lineWidth = enemy.elite || enemy.boss ? 3 : 1.5;

      if (enemy.id === "shooter" || enemy.id === "eliteShooter") {
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-enemy.radius * .72, -enemy.radius * .72, enemy.radius * 1.44, enemy.radius * 1.44);
        ctx.strokeRect(-enemy.radius * .72, -enemy.radius * .72, enemy.radius * 1.44, enemy.radius * 1.44);
      } else if (enemy.id === "charger") {
        ctx.beginPath(); ctx.moveTo(enemy.radius, 0); ctx.lineTo(-enemy.radius * .8, enemy.radius * .7); ctx.lineTo(-enemy.radius * .45, 0); ctx.lineTo(-enemy.radius * .8, -enemy.radius * .7); ctx.closePath(); ctx.fill(); ctx.stroke();
      } else if (enemy.id === "splitter") {
        ctx.beginPath();
        for (let i = 0; i < 8; i += 1) { const a = i / 8 * TAU; const r = i % 2 ? enemy.radius * .72 : enemy.radius; const x = Math.cos(a) * r; const y = Math.sin(a) * r; if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
      } else if (enemy.boss) {
        ctx.rotate(time * 0.3);
        ctx.beginPath();
        for (let i = 0; i < 12; i += 1) { const a = i / 12 * TAU; const r = i % 2 ? enemy.radius * .7 : enemy.radius; const x = Math.cos(a) * r; const y = Math.sin(a) * r; if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#160514"; ctx.beginPath(); ctx.arc(0, 0, enemy.radius * .34, 0, TAU); ctx.fill();
        ctx.fillStyle = "#fff2a3"; ctx.fillRect(-enemy.radius * .2, -3, enemy.radius * .4, 6);
      } else {
        ctx.beginPath(); ctx.arc(0, 0, enemy.radius, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "rgba(5,5,15,.7)"; ctx.beginPath(); ctx.arc(enemy.radius * .28, 0, enemy.radius * .28, 0, TAU); ctx.fill();
      }

      if (enemy.elite && !enemy.boss) {
        ctx.rotate(-enemy.rotation + time * 0.8);
        ctx.strokeStyle = "rgba(255,242,130,.6)";
        ctx.beginPath(); ctx.arc(0, 0, enemy.radius + 8, 0, Math.PI * 1.5); ctx.stroke();
      }
      ctx.restore();

      if (enemy.elite || enemy.boss) {
        const ratio = Math.max(0, enemy.hp / enemy.maxHp);
        const width = enemy.boss ? 110 : 54;
        ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(point.x - width / 2, point.y - enemy.radius - 14, width, 5);
        ctx.fillStyle = enemy.color; ctx.fillRect(point.x - width / 2, point.y - enemy.radius - 14, width * ratio, 5);
      }
    }
  }

  renderWeapons(time, shakeX, shakeY) {
    const ctx = this.ctx;
    const run = this.run;
    if (run.weaponLevels.orbit > 0) {
      const mods = run.weaponMods.orbit;
      const count = Math.max(1, Math.round(mods.count));
      const radius = WEAPONS.orbit.radius * mods.radius;
      for (let index = 0; index < count; index += 1) {
        const angle = run.elapsed * 2.9 + index / count * TAU;
        const world = { x: this.player.x + Math.cos(angle) * radius, y: this.player.y + Math.sin(angle) * radius };
        const point = this.worldToScreen(world.x, world.y, shakeX, shakeY);
        ctx.save(); ctx.translate(point.x, point.y); ctx.rotate(angle + Math.PI / 4); ctx.shadowBlur = 18; ctx.shadowColor = WEAPONS.orbit.color; ctx.fillStyle = WEAPONS.orbit.color;
        ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(0, 6); ctx.lineTo(-13, 0); ctx.lineTo(0, -6); ctx.closePath(); ctx.fill(); ctx.restore();
      }
    }
    if (run.weaponLevels.drone > 0) {
      for (const drone of this.dronePositions()) {
        const point = this.worldToScreen(drone.x, drone.y, shakeX, shakeY);
        ctx.save(); ctx.translate(point.x, point.y); ctx.rotate(drone.angle + Math.PI / 2); ctx.shadowBlur = 14; ctx.shadowColor = WEAPONS.drone.color; ctx.fillStyle = WEAPONS.drone.color;
        ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(8, 7); ctx.lineTo(0, 4); ctx.lineTo(-8, 7); ctx.closePath(); ctx.fill(); ctx.restore();
      }
    }
  }

  renderPlayer(time, shakeX, shakeY) {
    const ctx = this.ctx;
    const player = this.player;
    const point = this.worldToScreen(player.x, player.y, shakeX, shakeY);
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(player.rotation + Math.PI / 2);
    const blink = player.invulnerable > 0 && Math.floor(player.invulnerable * 16) % 2 === 0;
    ctx.globalAlpha = blink ? 0.38 : 1;
    ctx.shadowBlur = 24;
    ctx.shadowColor = this.run.core.color;
    ctx.fillStyle = this.run.core.color;
    ctx.strokeStyle = "#ddfeff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(15, 13);
    ctx.lineTo(0, 8);
    ctx.lineTo(-15, 13);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#07111d";
    ctx.beginPath(); ctx.arc(0, 1, 7, 0, TAU); ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(0, 1, 3, 0, TAU); ctx.fill();
    ctx.restore();
    if (this.run.global.shieldMax > 0 && player.shield > 0) {
      ctx.strokeStyle = `rgba(77,246,255,${0.22 + player.shield / this.run.global.shieldMax * .35})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(point.x, point.y, player.radius + 8 + Math.sin(time * 4) * 2, 0, TAU); ctx.stroke();
    }
  }

  renderEffects(shakeX, shakeY) {
    const ctx = this.ctx;
    for (const effect of this.effects) {
      const alpha = clamp(effect.life / effect.maxLife, 0, 1);
      if (effect.type === "arc") {
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = 2 + alpha * 3;
        ctx.shadowBlur = 13;
        ctx.shadowColor = effect.color;
        ctx.beginPath();
        effect.points.forEach((world, index) => {
          const point = this.worldToScreen(world.x, world.y, shakeX, shakeY);
          const jitterX = index > 0 ? randomBetween(-6, 6) : 0;
          const jitterY = index > 0 ? randomBetween(-6, 6) : 0;
          if (index === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x + jitterX, point.y + jitterY);
        });
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (effect.type === "beam") {
        const from = this.worldToScreen(effect.from.x, effect.from.y, shakeX, shakeY);
        const to = this.worldToScreen(effect.to.x, effect.to.y, shakeX, shakeY);
        ctx.strokeStyle = `rgba(111,255,193,${alpha})`;
        ctx.lineWidth = 3 + alpha * 6;
        ctx.shadowBlur = 18; ctx.shadowColor = effect.color;
        ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke(); ctx.shadowBlur = 0;
      } else if (effect.type === "explosion") {
        const point = this.worldToScreen(effect.x, effect.y, shakeX, shakeY);
        const progress = 1 - alpha;
        ctx.strokeStyle = `rgba(255,151,82,${alpha})`;
        ctx.fillStyle = `rgba(255,92,52,${alpha * .12})`;
        ctx.lineWidth = 3 + alpha * 5;
        ctx.beginPath(); ctx.arc(point.x, point.y, effect.radius * (0.25 + progress * .75), 0, TAU); ctx.fill(); ctx.stroke();
      }
    }
    for (const particle of this.particles) {
      const point = this.worldToScreen(particle.x, particle.y, shakeX, shakeY);
      const alpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      if (particle.type === "trail") ctx.fillRect(point.x - particle.size / 2, point.y - particle.size / 2, particle.size, particle.size);
      else { ctx.beginPath(); ctx.arc(point.x, point.y, particle.size * alpha, 0, TAU); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }

  renderDamageTexts(shakeX, shakeY) {
    const ctx = this.ctx;
    ctx.textAlign = "center";
    ctx.font = "800 12px ui-sans-serif, system-ui";
    for (const text of this.damageTexts) {
      const point = this.worldToScreen(text.x, text.y, shakeX, shakeY);
      const alpha = clamp(text.life / text.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = text.critical ? "#fff06a" : "#d9faff";
      ctx.font = text.critical ? "900 16px ui-sans-serif, system-ui" : "800 11px ui-sans-serif, system-ui";
      ctx.fillText(text.critical ? `${text.value}!` : text.value, point.x, point.y);
    }
    ctx.globalAlpha = 1;
  }
}

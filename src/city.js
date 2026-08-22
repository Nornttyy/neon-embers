import { assetUrl } from "./revision.js?v=__ASSET_REVISION__";

const WORLD = Object.freeze({ width: 2000, height: 1400 });
const PLAYER_RADIUS = 25;
const PLAYER_SPEED = 250;
const DASH_SPEED = 720;
const DASH_DURATION = 0.18;
const DASH_COOLDOWN = 1.05;
const CITY_CACHE_MAX_DPR = 1;

const BUILDINGS = Object.freeze([
  Object.freeze({ x: 100, y: 100, w: 470, h: 330, name: "装备工坊", code: "WORKSHOP", color: "#aa72ff" }),
  Object.freeze({ x: 650, y: 70, w: 500, h: 310, name: "任务管理局", code: "MISSION CONTROL", color: "#4df6ff" }),
  Object.freeze({ x: 1260, y: 100, w: 560, h: 340, name: "城市训练场", code: "TRAINING DECK", color: "#ffcc66" }),
  Object.freeze({ x: 100, y: 1010, w: 520, h: 270, name: "能源街区", code: "ENERGY BLOCK", color: "#4df6ff" }),
  Object.freeze({ x: 1370, y: 990, w: 470, h: 290, name: "轨道港", code: "TRANSIT PORT", color: "#ff4f9a" }),
]);

const FACILITIES = Object.freeze([
  Object.freeze({ id: "mission", x: 900, y: 435, radius: 112, name: "任务终端", action: "选择球体并准备任务", color: "#4df6ff" }),
  Object.freeze({ id: "workshop", x: 490, y: 485, radius: 105, name: "装备工坊", action: "校准永久装备", color: "#aa72ff" }),
  Object.freeze({ id: "training", x: 1510, y: 500, radius: 105, name: "训练中心", action: "重新开始基础训练", color: "#ffcc66" }),
]);

const CITY_PROPS = Object.freeze([
  Object.freeze({ key: "pylon", x: 650, y: 500, width: 86, angle: -.14, glow: "#4df6ff" }),
  Object.freeze({ key: "pylon", x: 1310, y: 500, width: 86, angle: .14, glow: "#4df6ff" }),
  Object.freeze({ key: "pylon", x: 650, y: 935, width: 86, angle: .12, glow: "#aa72ff" }),
  Object.freeze({ key: "pylon", x: 1310, y: 935, width: 86, angle: -.12, glow: "#aa72ff" }),
  Object.freeze({ key: "vent", x: 155, y: 650, width: 92, angle: .12, glow: "#4df6ff" }),
  Object.freeze({ key: "vent", x: 350, y: 790, width: 86, angle: -.18, glow: "#4df6ff" }),
  Object.freeze({ key: "vent", x: 1650, y: 650, width: 92, angle: -.12, glow: "#ff4f9a" }),
  Object.freeze({ key: "vent", x: 1800, y: 805, width: 86, angle: .18, glow: "#ff4f9a" }),
  Object.freeze({ key: "energyCore", x: 730, y: 710, width: 54, angle: 0, glow: "#4df6ff" }),
  Object.freeze({ key: "energyCore", x: 1230, y: 710, width: 54, angle: 0, glow: "#aa72ff" }),
]);

const CITY_NPCS = Object.freeze([
  Object.freeze({ key: "storm", x: 590, y: 600, width: 92, name: "相位技师", color: "#aa72ff" }),
  Object.freeze({ key: "bastion", x: 1390, y: 610, width: 94, name: "壁垒教官", color: "#ffcc66" }),
]);

const WORKSHOP_DISPLAYS = Object.freeze([
  Object.freeze({ key: "sword", x: 275, y: 495, width: 66, color: "#4df6ff" }),
  Object.freeze({ key: "pistol", x: 365, y: 495, width: 62, color: "#aa72ff" }),
  Object.freeze({ key: "hammer", x: 185, y: 495, width: 66, color: "#ffcc66" }),
]);

const TUTORIAL_STEPS = Object.freeze([
  Object.freeze({ title: "在城市中移动", text: "使用 WASD 或左侧摇杆移动球体。先走一小段，熟悉镜头跟随。", hint: "移动 120 米" }),
  Object.freeze({ title: "试一次闪避", text: "按空格或右侧“闪避”。闪避可以快速脱离危险。", hint: "完成 1 次闪避" }),
  Object.freeze({ title: "试一次攻击", text: "点击城市地面或按右侧“攻击”。进入战区后也是相同操作。", hint: "完成 1 次攻击" }),
]);

const STATIC_SCENE_IMAGE_KEYS = new Set([
  "floorOuter", "floorRoom", "floorBlockade", "floorCore",
  "barrier", "pylon", "vent", "sword", "pistol", "hammer", "energyCore",
]);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

export class CityHub {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.callbacks = {
      onFacility: callbacks.onFacility || (() => {}),
      onState: callbacks.onState || (() => {}),
      onTutorial: callbacks.onTutorial || (() => {}),
      onTutorialComplete: callbacks.onTutorialComplete || (() => {}),
      onMessage: callbacks.onMessage || (() => {}),
    };
    this.active = false;
    this.frame = 0;
    this.lastTime = 0;
    this.time = 0;
    this.keys = new Set();
    this.touch = { x: 0, y: 0 };
    this.player = { x: 900, y: 760, facingX: 0, facingY: -1, distance: 0 };
    this.camera = { x: 900, y: 700 };
    this.dashTime = 0;
    this.dashCooldown = 0;
    this.dashVector = { x: 0, y: -1 };
    this.attackTime = 0;
    this.tutorialStep = -1;
    this.nearFacility = null;
    this.lastStateSignature = "";
    this.patterns = new Map();
    this.staticScene = document.createElement("canvas");
    this.staticScene.width = WORLD.width;
    this.staticScene.height = WORLD.height;
    this.staticSceneDpr = 0;
    this.staticSceneReady = false;
    const cityImagePaths = {
      player: "assets/players/hunter-core.png",
      storm: "assets/players/storm-core.png",
      bastion: "assets/players/bastion-core.png",
      floorOuter: "assets/world/outer-floor.png",
      floorRoom: "assets/world/room-floor.png",
      floorBlockade: "assets/world/blockade-floor.png",
      floorCore: "assets/world/core-floor.png",
      barrier: "assets/world/arena-barrier.png",
      pylon: "assets/world/arena-pylon.png",
      vent: "assets/world/arena-vent.png",
      terminal: "assets/world/energy-terminal.png",
      sword: "assets/items/energy-sword.png",
      pistol: "assets/items/rail-pistol.png",
      hammer: "assets/items/power-hammer.png",
      energyCore: "assets/items/energy-core.png",
      trainingDrone: "assets/enemies/shield-drone.png",
      pulseWave: "assets/effects/pulse-wave.png",
    };
    this.staticAssetsPending = Object.keys(cityImagePaths).filter((key) => STATIC_SCENE_IMAGE_KEYS.has(key)).length;
    this.staticAssetsReady = this.staticAssetsPending === 0;
    this.images = Object.fromEntries(Object.entries(cityImagePaths).map(([key, path]) => [key, this.loadImage(key, path)]));

    this.onKeyDown = (event) => this.handleKey(event, true);
    this.onKeyUp = (event) => this.handleKey(event, false);
    this.onResize = () => this.resize();
    this.onPointerDown = (event) => {
      if (!this.active || event.button !== 0) return;
      this.requestAttack();
    };
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("resize", this.onResize);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    this.resize();
  }

  loadImage(key, path) {
    const image = new Image();
    if (STATIC_SCENE_IMAGE_KEYS.has(key)) {
      let settled = false;
      const settleStaticAsset = () => {
        if (settled) return;
        settled = true;
        this.staticAssetsPending = Math.max(0, this.staticAssetsPending - 1);
        if (this.staticAssetsPending === 0) {
          this.staticAssetsReady = true;
          this.staticSceneReady = false;
          this.patterns.clear();
        }
      };
      image.addEventListener("load", settleStaticAsset, { once: true });
      image.addEventListener("error", settleStaticAsset, { once: true });
    }
    image.src = assetUrl(path);
    return image;
  }

  start({ tutorial = false, resetPosition = false } = {}) {
    if (resetPosition) {
      this.player.x = 900;
      this.player.y = 760;
      this.player.facingX = 0;
      this.player.facingY = -1;
    }
    this.active = true;
    this.keys.clear();
    this.touch.x = 0;
    this.touch.y = 0;
    this.nearFacility = null;
    this.lastStateSignature = "";
    this.resize();
    if (tutorial) this.startTutorial();
    else {
      this.tutorialStep = -1;
      this.emitTutorial();
    }
    if (!this.frame) {
      this.lastTime = performance.now();
      this.frame = requestAnimationFrame((time) => this.loop(time));
    }
  }

  stop() {
    this.active = false;
    this.keys.clear();
    this.touch.x = 0;
    this.touch.y = 0;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.view = { width: rect.width, height: rect.height, dpr };
    if (this.staticSceneDpr !== Math.min(CITY_CACHE_MAX_DPR, dpr)) this.staticSceneReady = false;
  }

  handleKey(event, down) {
    if (!this.active) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLButtonElement || target instanceof HTMLDetailsElement) return;
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowleft", "arrowdown", "arrowright"].includes(key)) {
      event.preventDefault();
      if (down) this.keys.add(key);
      else this.keys.delete(key);
      return;
    }
    if (!down || event.repeat) return;
    if (key === " ") {
      event.preventDefault();
      this.requestDash();
    } else if (key === "e") {
      event.preventDefault();
      this.interact();
    } else if (key === "f" || key === "j") {
      event.preventDefault();
      this.requestAttack();
    }
  }

  setTouchVector(x, y) {
    this.touch.x = clamp(Number(x) || 0, -1, 1);
    this.touch.y = clamp(Number(y) || 0, -1, 1);
  }

  requestDash() {
    if (!this.active || this.dashCooldown > 0) return false;
    this.dashTime = DASH_DURATION;
    this.dashCooldown = DASH_COOLDOWN;
    this.dashVector.x = this.player.facingX;
    this.dashVector.y = this.player.facingY;
    if (this.tutorialStep === 1) this.advanceTutorial();
    return true;
  }

  requestAttack() {
    if (!this.active || this.attackTime > 0) return false;
    this.attackTime = 0.28;
    if (this.tutorialStep === 2) this.advanceTutorial();
    return true;
  }

  interact() {
    if (!this.active || !this.nearFacility) return false;
    if (this.tutorialStep >= 0 && this.nearFacility.id === "mission") {
      this.callbacks.onMessage("先完成左上角的三个基础动作");
      return false;
    }
    this.callbacks.onFacility(this.nearFacility.id);
    return true;
  }

  startTutorial() {
    this.tutorialStep = 0;
    this.player.distance = 0;
    this.emitTutorial();
  }

  advanceTutorial() {
    if (this.tutorialStep < 0) return;
    this.tutorialStep += 1;
    if (this.tutorialStep >= TUTORIAL_STEPS.length) {
      this.tutorialStep = -1;
      this.emitTutorial();
      this.callbacks.onTutorialComplete();
      return;
    }
    this.emitTutorial();
  }

  emitTutorial() {
    const step = this.tutorialStep >= 0 ? TUTORIAL_STEPS[this.tutorialStep] : null;
    this.callbacks.onTutorial(step ? {
      active: true,
      index: this.tutorialStep,
      total: TUTORIAL_STEPS.length,
      ...step,
    } : { active: false, index: -1, total: TUTORIAL_STEPS.length });
  }

  loop(timestamp) {
    if (!this.active) {
      this.frame = 0;
      return;
    }
    const dt = Math.min(0.033, Math.max(0, (timestamp - this.lastTime) / 1000));
    this.lastTime = timestamp;
    this.time += dt;
    this.update(dt);
    this.render();
    this.frame = requestAnimationFrame((time) => this.loop(time));
  }

  update(dt) {
    this.dashTime = Math.max(0, this.dashTime - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.attackTime = Math.max(0, this.attackTime - dt);

    let dx = this.touch.x;
    let dy = this.touch.y;
    if (this.keys.has("a") || this.keys.has("arrowleft")) dx -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) dx += 1;
    if (this.keys.has("w") || this.keys.has("arrowup")) dy -= 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) dy += 1;
    let length = Math.hypot(dx, dy);
    if (this.dashTime > 0 && length <= .05) {
      dx = this.dashVector.x;
      dy = this.dashVector.y;
      length = Math.hypot(dx, dy);
    }
    if (length > 0.05) {
      dx /= Math.max(1, length);
      dy /= Math.max(1, length);
      this.player.facingX = dx;
      this.player.facingY = dy;
      const speed = this.dashTime > 0 ? DASH_SPEED : PLAYER_SPEED;
      const distance = speed * dt;
      const beforeX = this.player.x;
      const beforeY = this.player.y;
      this.movePlayer(dx * distance, 0);
      this.movePlayer(0, dy * distance);
      const traveled = Math.hypot(this.player.x - beforeX, this.player.y - beforeY);
      this.player.distance += traveled;
      if (this.tutorialStep === 0 && this.player.distance >= 120) this.advanceTutorial();
    }

    const targetX = clamp(this.player.x, this.view.width * .36, WORLD.width - this.view.width * .36);
    const targetY = clamp(this.player.y, this.view.height * .34, WORLD.height - this.view.height * .34);
    const cameraEase = 1 - Math.exp(-dt * 7);
    this.camera.x += (targetX - this.camera.x) * cameraEase;
    this.camera.y += (targetY - this.camera.y) * cameraEase;

    this.nearFacility = FACILITIES
      .map((facility) => ({ facility, distance: Math.hypot(this.player.x - facility.x, this.player.y - facility.y) }))
      .filter(({ facility, distance }) => distance <= facility.radius)
      .sort((a, b) => a.distance - b.distance)[0]?.facility || null;

    const signature = `${this.nearFacility?.id || "none"}:${Math.ceil(this.dashCooldown * 10)}:${this.tutorialStep}`;
    if (signature !== this.lastStateSignature) {
      this.lastStateSignature = signature;
      this.callbacks.onState({
        facility: this.nearFacility,
        dashReady: this.dashCooldown <= 0,
        tutorialActive: this.tutorialStep >= 0,
      });
    }
  }

  movePlayer(dx, dy) {
    const nextX = clamp(this.player.x + dx, PLAYER_RADIUS + 32, WORLD.width - PLAYER_RADIUS - 32);
    const nextY = clamp(this.player.y + dy, PLAYER_RADIUS + 32, WORLD.height - PLAYER_RADIUS - 32);
    const blocked = BUILDINGS.some((building) => (
      nextX + PLAYER_RADIUS > building.x - 12
      && nextX - PLAYER_RADIUS < building.x + building.w + 12
      && nextY + PLAYER_RADIUS > building.y - 12
      && nextY - PLAYER_RADIUS < building.y + building.h + 12
    ));
    if (!blocked) {
      this.player.x = nextX;
      this.player.y = nextY;
    }
  }

  render() {
    const { ctx } = this;
    const { width, height, dpr } = this.view;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#050914";
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.translate(width / 2 - this.camera.x, height / 2 - this.camera.y);
    this.drawWorld(ctx);
    this.drawPlayer(ctx);
    ctx.restore();
    this.drawVignette(ctx, width, height);
  }

  drawWorld(ctx) {
    if (this.staticAssetsReady) {
      if (!this.staticSceneReady) this.buildStaticScene();
      ctx.drawImage(
        this.staticScene,
        0, 0, this.staticScene.width, this.staticScene.height,
        0, 0, WORLD.width, WORLD.height,
      );
    } else {
      this.drawCityLoadingFallback(ctx);
    }
    for (const npc of CITY_NPCS) this.drawNpc(ctx, npc);
    for (const facility of FACILITIES) this.drawFacility(ctx, facility);
    this.drawTrainingDummy(ctx);
  }

  drawCityLoadingFallback(ctx) {
    ctx.fillStyle = "#101827";
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    ctx.fillStyle = "rgba(77, 246, 255, .06)";
    ctx.fillRect(0, 505, WORLD.width, 420);
    ctx.fillRect(700, 0, 560, WORLD.height);
  }

  buildStaticScene() {
    const sceneDpr = Math.min(CITY_CACHE_MAX_DPR, this.view?.dpr || 1);
    const pixelWidth = Math.round(WORLD.width * sceneDpr);
    const pixelHeight = Math.round(WORLD.height * sceneDpr);
    if (this.staticScene.width !== pixelWidth || this.staticScene.height !== pixelHeight) {
      this.staticScene.width = pixelWidth;
      this.staticScene.height = pixelHeight;
      this.patterns.clear();
    }
    const ctx = this.staticScene.getContext("2d", { alpha: false });
    ctx.setTransform(sceneDpr, 0, 0, sceneDpr, 0, 0);
    ctx.clearRect(0, 0, WORLD.width, WORLD.height);
    this.drawCityGround(ctx);
    for (const building of BUILDINGS) this.drawBuilding(ctx, building);
    for (const prop of CITY_PROPS) this.drawWorldProp(ctx, prop.key, prop.x, prop.y, prop.width, prop.angle, prop.glow);
    for (const display of WORKSHOP_DISPLAYS) this.drawWorkshopDisplay(ctx, display);
    this.drawCityBoundary(ctx);
    this.staticSceneDpr = sceneDpr;
    this.staticSceneReady = true;
  }

  getPattern(ctx, imageKey) {
    const image = this.images[imageKey];
    if (!image?.complete || !image.naturalWidth) return null;
    const cacheKey = `${imageKey}:${ctx.canvas === this.staticScene ? "city" : "view"}`;
    if (!this.patterns.has(cacheKey)) this.patterns.set(cacheKey, ctx.createPattern(image, "repeat"));
    return this.patterns.get(cacheKey);
  }

  fillTexturePanel(ctx, imageKey, x, y, width, height, fallback, radius = 0, alpha = 1) {
    ctx.save();
    roundedRect(ctx, x, y, width, height, radius);
    ctx.clip();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.getPattern(ctx, imageKey) || fallback;
    ctx.fillRect(x, y, width, height);
    ctx.restore();
  }

  drawCityGround(ctx) {
    ctx.fillStyle = this.getPattern(ctx, "floorOuter") || "#101827";
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    ctx.fillStyle = "rgba(3, 8, 17, .18)";
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    this.fillTexturePanel(ctx, "floorRoom", 0, 505, WORLD.width, 420, "#172234", 0, .98);
    this.fillTexturePanel(ctx, "floorRoom", 700, 0, 560, WORLD.height, "#172234", 0, .98);
    this.fillTexturePanel(ctx, "floorBlockade", 0, 455, 700, 70, "#19152a", 0, .9);
    this.fillTexturePanel(ctx, "floorBlockade", 1260, 455, 740, 70, "#19152a", 0, .9);
    this.fillTexturePanel(ctx, "floorBlockade", 0, 925, 700, 72, "#19152a", 0, .9);
    this.fillTexturePanel(ctx, "floorBlockade", 1260, 925, 740, 72, "#19152a", 0, .9);

    const coreFloor = this.images.floorCore;
    if (coreFloor?.complete && coreFloor.naturalWidth) {
      ctx.save();
      ctx.shadowColor = "rgba(77, 246, 255, .2)";
      ctx.shadowBlur = 34;
      ctx.drawImage(coreFloor, 685, 420, 590, 590);
      ctx.restore();
    } else {
      this.fillTexturePanel(ctx, "floorRoom", 685, 420, 590, 590, "#172234", 0, 1);
    }

    ctx.strokeStyle = "rgba(120, 226, 255, .2)";
    ctx.lineWidth = 3;
    ctx.strokeRect(32, 32, WORLD.width - 64, WORLD.height - 64);
  }

  drawBuilding(ctx, building) {
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, .72)";
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 22;
    roundedRect(ctx, building.x, building.y, building.w, building.h, 18);
    ctx.fillStyle = "#070d18";
    ctx.fill();
    ctx.restore();

    const texture = building.code === "MISSION CONTROL" ? "floorRoom" : "floorBlockade";
    this.fillTexturePanel(ctx, texture, building.x, building.y, building.w, building.h, "#121a28", 18, .98);
    const shade = ctx.createLinearGradient(building.x, building.y, building.x, building.y + building.h);
    shade.addColorStop(0, "rgba(6, 13, 25, .08)");
    shade.addColorStop(1, "rgba(2, 6, 14, .56)");
    ctx.fillStyle = shade;
    roundedRect(ctx, building.x, building.y, building.w, building.h, 18);
    ctx.fill();
    ctx.strokeStyle = `${building.color}88`;
    ctx.lineWidth = 3;
    ctx.stroke();

    const entrance = FACILITIES.find((facility) => facility.x > building.x && facility.x < building.x + building.w && Math.abs(facility.y - (building.y + building.h)) < 130);
    for (let x = building.x + 68; x < building.x + building.w - 45; x += 122) {
      if (entrance && Math.abs(x - entrance.x) < 92) continue;
      this.drawWorldProp(ctx, "barrier", x, building.y + building.h - 2, 126, 0, building.color);
    }
    this.drawWorldProp(ctx, "vent", building.x + building.w - 82, building.y + 96, 78, .08, building.color);
    this.drawWorldProp(ctx, "pylon", building.x + 84, building.y + building.h - 92, 74, -.08, building.color);

    ctx.fillStyle = "rgba(3, 8, 18, .9)";
    roundedRect(ctx, building.x + 30, building.y + 28, Math.min(290, building.w - 60), 66, 10);
    ctx.fill();
    ctx.strokeStyle = `${building.color}88`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = building.color;
    ctx.font = "800 18px system-ui";
    ctx.fillText(building.name, building.x + 48, building.y + 59);
    ctx.fillStyle = "rgba(221, 244, 250, .58)";
    ctx.font = "700 9px system-ui";
    ctx.fillText(building.code, building.x + 48, building.y + 80);
  }

  drawCityBoundary(ctx) {
    for (let x = 78; x < WORLD.width - 55; x += 138) {
      this.drawWorldProp(ctx, "barrier", x, 35, 142, 0, "#4df6ff");
      this.drawWorldProp(ctx, "barrier", x, WORLD.height - 35, 142, Math.PI, "#4df6ff");
    }
    for (let y = 100; y < WORLD.height - 60; y += 126) {
      this.drawWorldProp(ctx, "barrier", 35, y, 126, Math.PI / 2, "#4df6ff");
      this.drawWorldProp(ctx, "barrier", WORLD.width - 35, y, 126, -Math.PI / 2, "#4df6ff");
    }
  }

  drawWorldProp(ctx, imageKey, x, y, width, angle = 0, glow = "#4df6ff", alpha = 1) {
    const image = this.images[imageKey];
    if (!image?.complete || !image.naturalWidth) return false;
    const height = width * image.naturalHeight / image.naturalWidth;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 10;
    ctx.drawImage(image, -width / 2, -height / 2, width, height);
    ctx.restore();
    return true;
  }

  drawWorkshopDisplay(ctx, display) {
    this.drawWorldProp(ctx, "energyCore", display.x, display.y + 16, 54, 0, display.color, .82);
    this.drawWorldProp(ctx, display.key, display.x, display.y - 9, display.width, -.14, display.color, .96);
  }

  drawNpc(ctx, npc) {
    const bob = Math.sin(this.time * 2.1 + npc.x * .01) * 3;
    ctx.save();
    ctx.translate(npc.x, npc.y + bob);
    ctx.fillStyle = "rgba(0, 0, 0, .48)";
    ctx.beginPath();
    ctx.ellipse(7, 27, 38, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    this.drawWorldProp(ctx, npc.key, npc.x, npc.y + bob, npc.width, 0, npc.color);
    ctx.fillStyle = "rgba(3, 8, 18, .88)";
    roundedRect(ctx, npc.x - 52, npc.y + 52, 104, 28, 7);
    ctx.fill();
    ctx.strokeStyle = `${npc.color}88`;
    ctx.stroke();
    ctx.fillStyle = npc.color;
    ctx.font = "800 10px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(npc.name, npc.x, npc.y + 70);
    ctx.textAlign = "start";
  }

  drawFacility(ctx, facility) {
    const pulse = 1 + Math.sin(this.time * 2.6 + facility.x * .01) * .035;
    const active = this.nearFacility?.id === facility.id;
    ctx.save();
    ctx.translate(facility.x, facility.y);
    ctx.rotate(this.time * .08);
    ctx.globalAlpha = active ? .82 : .46;
    const wave = this.images.pulseWave;
    if (wave?.complete && wave.naturalWidth) ctx.drawImage(wave, -88 * pulse, -88 * pulse, 176 * pulse, 176 * pulse);
    ctx.restore();

    ctx.save();
    ctx.translate(facility.x, facility.y - 10 + Math.sin(this.time * 2.8 + facility.y) * 2);
    ctx.shadowColor = facility.color;
    ctx.shadowBlur = active ? 28 : 14;
    if (this.images.terminal.complete && this.images.terminal.naturalWidth) {
      const terminalWidth = facility.id === "mission" ? 138 : 122;
      const terminalHeight = terminalWidth * this.images.terminal.naturalHeight / this.images.terminal.naturalWidth;
      ctx.drawImage(this.images.terminal, -terminalWidth / 2, -terminalHeight / 2, terminalWidth, terminalHeight);
    } else {
      ctx.fillStyle = facility.color;
      ctx.fillRect(-18, -28, 36, 56);
    }
    ctx.restore();

    ctx.save();
    ctx.translate(facility.x, facility.y);
    ctx.fillStyle = "rgba(3,8,18,.92)";
    roundedRect(ctx, -88, 72, 176, 43, 8);
    ctx.fill();
    ctx.strokeStyle = active ? facility.color : `${facility.color}99`;
    ctx.lineWidth = active ? 3 : 1.5;
    ctx.stroke();
    ctx.fillStyle = facility.color;
    ctx.font = "800 13px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(facility.name, 0, 98);
    ctx.textAlign = "start";
    ctx.restore();
  }

  drawTrainingDummy(ctx) {
    const x = 1510;
    const y = 725;
    const hit = this.attackTime > .12 && Math.hypot(this.player.x - x, this.player.y - y) < 150;
    ctx.save();
    ctx.translate(x + (hit ? Math.sin(this.time * 80) * 7 : 0), y + Math.sin(this.time * 2.4) * 3);
    ctx.globalAlpha = .8;
    ctx.shadowColor = "#ffcc66";
    ctx.shadowBlur = 18;
    const drone = this.images.trainingDrone;
    if (drone?.complete && drone.naturalWidth) {
      const width = 112;
      const height = width * drone.naturalHeight / drone.naturalWidth;
      ctx.drawImage(drone, -width / 2, -height / 2, width, height);
    }
    if (hit && this.images.bladeHit?.complete && this.images.bladeHit.naturalWidth) {
      ctx.globalAlpha = .95;
      ctx.drawImage(this.images.bladeHit, -48, -48, 96, 96);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(3, 8, 18, .9)";
    roundedRect(ctx, -54, 60, 108, 28, 7);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 204, 102, .66)";
    ctx.stroke();
    ctx.fillStyle = "#ffcc66";
    ctx.font = "800 10px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("训练无人机", 0, 78);
    ctx.textAlign = "start";
    ctx.restore();
  }

  drawPlayer(ctx) {
    const { x, y, facingX, facingY } = this.player;
    ctx.save();
    ctx.translate(x, y);
    const speedGlow = this.dashTime > 0 ? 1 : .35;
    const aura = ctx.createRadialGradient(0, 0, 8, 0, 0, 58);
    aura.addColorStop(0, `rgba(77,246,255,${.28 + speedGlow * .18})`);
    aura.addColorStop(1, "rgba(77,246,255,0)");
    ctx.fillStyle = aura;
    ctx.fillRect(-60, -60, 120, 120);
    ctx.fillStyle = "rgba(0,0,0,.45)";
    ctx.beginPath();
    ctx.ellipse(5, 24, 34, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    if (this.images.player.complete && this.images.player.naturalWidth) ctx.drawImage(this.images.player, -35, -35, 70, 70);
    else {
      ctx.fillStyle = "#4df6ff";
      ctx.beginPath();
      ctx.arc(0, 0, PLAYER_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = "rgba(230,255,255,.92)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(facingX * 24, facingY * 24);
    ctx.lineTo(facingX * 43, facingY * 43);
    ctx.stroke();
    if (this.attackTime > 0) {
      const progress = 1 - this.attackTime / .28;
      const base = Math.atan2(facingY, facingX);
      ctx.strokeStyle = "rgba(77,246,255,.92)";
      ctx.lineWidth = 8;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(0, 0, 58, base - 1.3 + progress * .9, base + .4 + progress * .9);
      ctx.stroke();
      ctx.strokeStyle = "white";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.lineCap = "butt";
    }
    ctx.restore();
  }

  drawVignette(ctx, width, height) {
    const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * .28, width / 2, height / 2, Math.max(width, height) * .72);
    vignette.addColorStop(0, "rgba(2,5,12,0)");
    vignette.addColorStop(1, "rgba(2,5,12,.64)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }
}

export { FACILITIES, TUTORIAL_STEPS, WORLD };

import { assetUrl } from "./revision.js?v=__ASSET_REVISION__";

const WORLD = Object.freeze({ width: 2000, height: 1400 });
const PLAYER_RADIUS = 25;
const PLAYER_SPEED = 250;
const DASH_SPEED = 720;
const DASH_DURATION = 0.18;
const DASH_COOLDOWN = 1.05;

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

const TUTORIAL_STEPS = Object.freeze([
  Object.freeze({ title: "在城市中移动", text: "使用 WASD 或左侧摇杆移动球体。先走一小段，熟悉镜头跟随。", hint: "移动 120 米" }),
  Object.freeze({ title: "试一次闪避", text: "按空格或右侧“闪避”。闪避可以快速脱离危险。", hint: "完成 1 次闪避" }),
  Object.freeze({ title: "试一次攻击", text: "点击城市地面或按右侧“攻击”。进入战区后也是相同操作。", hint: "完成 1 次攻击" }),
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
    this.images = {
      player: this.loadImage("assets/players/hunter-core.png"),
      terminal: this.loadImage("assets/world/energy-terminal.png"),
      sword: this.loadImage("assets/items/energy-sword.png"),
    };

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

  loadImage(path) {
    const image = new Image();
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
    ctx.fillStyle = "#091321";
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    ctx.strokeStyle = "rgba(77,246,255,.055)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= WORLD.width; x += 50) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.height); ctx.stroke();
    }
    for (let y = 0; y <= WORLD.height; y += 50) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.width, y); ctx.stroke();
    }

    ctx.fillStyle = "#111a2a";
    ctx.fillRect(0, 520, WORLD.width, 390);
    ctx.fillRect(720, 0, 520, WORLD.height);
    ctx.strokeStyle = "rgba(129,231,255,.2)";
    ctx.lineWidth = 3;
    ctx.setLineDash([34, 30]);
    ctx.beginPath(); ctx.moveTo(0, 715); ctx.lineTo(WORLD.width, 715); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(980, 0); ctx.lineTo(980, WORLD.height); ctx.stroke();
    ctx.setLineDash([]);

    const plaza = ctx.createRadialGradient(980, 715, 40, 980, 715, 300);
    plaza.addColorStop(0, "rgba(77,246,255,.12)");
    plaza.addColorStop(1, "rgba(26,40,62,.96)");
    ctx.fillStyle = plaza;
    ctx.beginPath(); ctx.arc(980, 715, 285, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(77,246,255,.24)";
    ctx.lineWidth = 2;
    for (const radius of [130, 210, 285]) { ctx.beginPath(); ctx.arc(980, 715, radius, 0, Math.PI * 2); ctx.stroke(); }

    for (const building of BUILDINGS) this.drawBuilding(ctx, building);
    this.drawStreetLights(ctx);
    for (const facility of FACILITIES) this.drawFacility(ctx, facility);
    this.drawTrainingDummy(ctx);
  }

  drawBuilding(ctx, building) {
    ctx.fillStyle = "rgba(0,0,0,.4)";
    ctx.fillRect(building.x + 20, building.y + 24, building.w, building.h);
    const gradient = ctx.createLinearGradient(building.x, building.y, building.x + building.w, building.y + building.h);
    gradient.addColorStop(0, "#182642");
    gradient.addColorStop(1, "#0a1224");
    ctx.fillStyle = gradient;
    ctx.fillRect(building.x, building.y, building.w, building.h);
    ctx.strokeStyle = `${building.color}66`;
    ctx.lineWidth = 3;
    ctx.strokeRect(building.x, building.y, building.w, building.h);

    ctx.fillStyle = "rgba(3,8,19,.72)";
    ctx.fillRect(building.x + 28, building.y + 34, building.w - 56, 72);
    ctx.fillStyle = building.color;
    ctx.font = "800 18px system-ui";
    ctx.fillText(building.name, building.x + 46, building.y + 67);
    ctx.fillStyle = "rgba(194,226,239,.55)";
    ctx.font = "700 9px system-ui";
    ctx.fillText(building.code, building.x + 46, building.y + 87);

    for (let y = building.y + 135; y < building.y + building.h - 28; y += 54) {
      for (let x = building.x + 32; x < building.x + building.w - 26; x += 64) {
        const lit = (Math.floor(x / 64) + Math.floor(y / 54)) % 3 !== 0;
        ctx.fillStyle = lit ? `${building.color}24` : "rgba(2,7,16,.7)";
        ctx.fillRect(x, y, 34, 18);
      }
    }
  }

  drawStreetLights(ctx) {
    const lamps = [[650,500],[1310,500],[650,940],[1310,940],[770,470],[1190,470],[770,965],[1190,965]];
    for (const [x, y] of lamps) {
      const glow = ctx.createRadialGradient(x, y, 2, x, y, 80);
      glow.addColorStop(0, "rgba(77,246,255,.34)");
      glow.addColorStop(1, "rgba(77,246,255,0)");
      ctx.fillStyle = glow; ctx.fillRect(x - 80, y - 80, 160, 160);
      ctx.fillStyle = "#b9fbff"; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawFacility(ctx, facility) {
    const pulse = 1 + Math.sin(this.time * 3 + facility.x * .01) * .08;
    ctx.save();
    ctx.translate(facility.x, facility.y);
    ctx.strokeStyle = facility.color;
    ctx.lineWidth = 3;
    ctx.globalAlpha = .34;
    ctx.beginPath(); ctx.arc(0, 0, 50 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = .9;
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.stroke();
    if (this.images.terminal.complete && this.images.terminal.naturalWidth) {
      ctx.drawImage(this.images.terminal, -34, -34, 68, 68);
    } else {
      ctx.fillStyle = facility.color; ctx.fillRect(-12, -20, 24, 40);
    }
    ctx.fillStyle = "rgba(3,8,18,.92)";
    roundedRect(ctx, -80, 62, 160, 42, 8); ctx.fill();
    ctx.strokeStyle = `${facility.color}88`; ctx.stroke();
    ctx.fillStyle = facility.color;
    ctx.font = "800 13px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(facility.name, 0, 88);
    ctx.textAlign = "start";
    ctx.restore();
  }

  drawTrainingDummy(ctx) {
    const x = 1100;
    const y = 760;
    const hit = this.attackTime > .12 && Math.hypot(this.player.x - x, this.player.y - y) < 150;
    ctx.save();
    ctx.translate(x + (hit ? Math.sin(this.time * 80) * 6 : 0), y);
    ctx.fillStyle = "rgba(255,204,102,.12)";
    ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(255,204,102,.66)"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, -8, 20, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, 54); ctx.moveTo(-24, 30); ctx.lineTo(24, 30); ctx.stroke();
    ctx.fillStyle = "#ffcc66"; ctx.font = "800 10px system-ui"; ctx.textAlign = "center"; ctx.fillText("训练靶", 0, 78); ctx.textAlign = "start";
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
    ctx.fillStyle = aura; ctx.fillRect(-60, -60, 120, 120);
    ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.beginPath(); ctx.ellipse(5, 24, 34, 15, 0, 0, Math.PI * 2); ctx.fill();
    if (this.images.player.complete && this.images.player.naturalWidth) ctx.drawImage(this.images.player, -35, -35, 70, 70);
    else { ctx.fillStyle = "#4df6ff"; ctx.beginPath(); ctx.arc(0, 0, PLAYER_RADIUS, 0, Math.PI * 2); ctx.fill(); }

    ctx.strokeStyle = "rgba(230,255,255,.92)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(facingX * 24, facingY * 24); ctx.lineTo(facingX * 43, facingY * 43); ctx.stroke();
    if (this.attackTime > 0) {
      const progress = 1 - this.attackTime / .28;
      const base = Math.atan2(facingY, facingX);
      ctx.strokeStyle = "rgba(77,246,255,.92)"; ctx.lineWidth = 8; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(0, 0, 58, base - 1.3 + progress * .9, base + .4 + progress * .9); ctx.stroke();
      ctx.strokeStyle = "white"; ctx.lineWidth = 2; ctx.stroke();
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

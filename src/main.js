import { CORES, META_UPGRADES, WEAPONS, metaCost } from "./config.js";
import { audio } from "./audio.js";
import { adService } from "./ad-service.js";
import { Game } from "./game.js";

const SAVE_KEY = "neon-embers-save-v1";
const DEFAULT_SAVE = Object.freeze({
  version: 1,
  scrap: 0,
  bestTime: 0,
  bestKills: 0,
  runs: 0,
  guideSeen: false,
  lastCore: "hunter",
  meta: { power: 0, armor: 0, recovery: 0 },
  settings: { volume: 0.5, musicVolume: 0.26, shake: true, reduceFlash: false },
});

function loadSave() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (!parsed || parsed.version !== 1) return structuredClone(DEFAULT_SAVE);
    return {
      ...structuredClone(DEFAULT_SAVE),
      ...parsed,
      meta: { ...DEFAULT_SAVE.meta, ...(parsed.meta || {}) },
      settings: { ...DEFAULT_SAVE.settings, ...(parsed.settings || {}) },
    };
  } catch {
    return structuredClone(DEFAULT_SAVE);
  }
}

let profile = loadSave();
let currentScreen = "menu-screen";
let settingsReturnScreen = "menu-screen";
let resetArmedUntil = 0;
let toastTimer = 0;

const byId = (id) => document.getElementById(id);
const allScreens = [...document.querySelectorAll(".screen")];
const hud = byId("hud");
const touchControls = byId("touch-controls");
const coarsePointer = window.matchMedia("(pointer: coarse)");

const elements = {
  menuScrap: byId("menu-scrap"),
  menuBestTime: byId("menu-best-time"),
  menuBestKills: byId("menu-best-kills"),
  metaScrap: byId("meta-scrap"),
  coreGrid: byId("core-grid"),
  metaGrid: byId("meta-grid"),
  weaponDock: byId("weapon-dock"),
  healthFill: byId("health-fill"),
  healthText: byId("health-text"),
  shieldFill: byId("shield-fill"),
  missionFill: byId("mission-fill"),
  staminaText: byId("stamina-text"),
  hudMission: byId("hud-mission"),
  hudPhase: byId("hud-phase"),
  hudTime: byId("hud-time"),
  hudKills: byId("hud-kills"),
  hudScrap: byId("hud-scrap"),
  hudAmmo: byId("hud-ammo"),
  dashFill: byId("dash-fill"),
  skillFill: byId("skill-fill"),
  bossBar: byId("boss-bar"),
  bossName: byId("boss-name"),
  bossFill: byId("boss-fill"),
  toast: byId("toast"),
};

function saveProfile() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(profile));
  } catch {
    showToast("本地存档不可用，本次进度仅在当前页面保留");
  }
}

function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function showScreen(id, { keepHud = false } = {}) {
  for (const screen of allScreens) screen.classList.toggle("is-active", screen.id === id);
  currentScreen = id;
  if (!keepHud) {
    hud.classList.remove("is-active");
    touchControls.classList.remove("is-active");
  }
}

function showGameLayer(id = null) {
  for (const screen of allScreens) screen.classList.toggle("is-active", screen.id === id);
  currentScreen = id || "game";
  hud.classList.add("is-active");
  touchControls.classList.toggle("is-active", coarsePointer.matches && !id);
}

function showToast(message, duration = 1700) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-active");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-active"), duration);
}

function renderProfile() {
  elements.menuScrap.textContent = profile.scrap;
  elements.menuBestTime.textContent = formatTime(profile.bestTime);
  elements.menuBestKills.textContent = profile.bestKills;
  elements.metaScrap.textContent = profile.scrap;
}

function renderCoreCards() {
  elements.coreGrid.replaceChildren();
  for (const core of Object.values(CORES)) {
    const button = document.createElement("button");
    button.className = "core-card";
    button.type = "button";
    button.style.setProperty("--card-color", core.color);
    button.innerHTML = `
      ${core.bodyAsset ? `<img class="core-player-art" src="${core.bodyAsset}" alt="" />` : core.asset ? `<img class="core-item-art" src="${core.asset}" alt="" />` : `<div class="core-icon" aria-hidden="true"></div>`}
      <span class="core-subtitle">${core.subtitle}</span>
      <h3>${core.name}</h3>
      <p>${core.description}</p>
      <span class="select-label">启动该协议 →</span>
    `;
    button.addEventListener("click", () => beginRun(core.id));
    elements.coreGrid.append(button);
  }
}

function renderMeta() {
  elements.metaGrid.replaceChildren();
  elements.metaScrap.textContent = profile.scrap;
  for (const definition of META_UPGRADES) {
    const level = profile.meta[definition.id] || 0;
    const cost = metaCost(definition, level);
    const item = document.createElement("article");
    item.className = "meta-item";
    const info = document.createElement("div");
    info.innerHTML = `
      <h3>${definition.name}</h3>
      <p>${definition.description}</p>
      <div class="meta-level" aria-label="等级 ${level} / ${definition.max}">
        ${Array.from({ length: definition.max }, (_, index) => `<i class="${index < level ? "on" : ""}"></i>`).join("")}
      </div>
    `;
    const button = document.createElement("button");
    button.className = "meta-buy";
    button.type = "button";
    button.disabled = level >= definition.max || profile.scrap < cost;
    button.textContent = level >= definition.max ? "已完成" : `${cost} 核心能源`;
    button.addEventListener("click", () => {
      if (profile.scrap < cost || level >= definition.max) return;
      profile.scrap -= cost;
      profile.meta[definition.id] = level + 1;
      saveProfile();
      renderProfile();
      renderMeta();
      audio.pickup();
      showToast(`${definition.name} 已校准`);
    });
    item.append(info, button);
    elements.metaGrid.append(item);
  }
}

function renderHud(data) {
  elements.hudMission.textContent = data.mission;
  elements.healthFill.style.width = `${Math.max(0, data.health / data.maxHealth * 100)}%`;
  elements.healthText.textContent = `${Math.ceil(data.health)} / ${Math.round(data.maxHealth)}`;
  elements.shieldFill.style.width = `${data.shieldMax ? Math.max(0, data.shield / data.shieldMax * 100) : 0}%`;
  elements.staminaText.textContent = `体力 ${Math.ceil(data.shield)} / ${Math.round(data.shieldMax)}`;
  elements.missionFill.style.width = `${Math.max(0, data.progress * 100)}%`;
  elements.hudPhase.textContent = data.phase;
  elements.hudTime.textContent = data.time;
  elements.hudKills.textContent = data.kills;
  elements.hudScrap.textContent = data.scrap;
  elements.hudAmmo.textContent = data.reload > 0 ? "装填" : `${data.ammo}/${data.maxAmmo}`;
  elements.dashFill.style.width = `${data.dash * 100}%`;
  elements.skillFill.style.width = `${data.skill * 100}%`;

  const signature = data.weapons.map((weapon) => `${weapon.id}:${weapon.ammo || ""}`).join("|");
  if (elements.weaponDock.dataset.signature !== signature) {
    elements.weaponDock.dataset.signature = signature;
    elements.weaponDock.innerHTML = data.weapons.map((weapon) => `
      <div class="weapon-chip" style="--weapon-color:${weapon.color}" title="${weapon.name} · 固定装备">
        ${weapon.asset ? `<img src="${weapon.asset}" alt="" />` : `<b>${weapon.name.slice(0, 2)}</b>`}
        <span>${weapon.ammo || "固定"}</span>
      </div>
    `).join("");
  }

  elements.bossBar.classList.toggle("is-active", Boolean(data.boss));
  if (data.boss) {
    elements.bossName.textContent = data.boss.name;
    elements.bossFill.style.width = `${data.boss.ratio * 100}%`;
  }
}

function showResult(summary) {
  profile.scrap += summary.scrap;
  profile.bestTime = Math.max(profile.bestTime, Math.round(summary.time));
  profile.bestKills = Math.max(profile.bestKills, summary.kills);
  profile.runs += 1;
  profile.lastCore = summary.coreId;
  saveProfile();
  renderProfile();

  byId("result-kicker").textContent = summary.victory ? "MISSION COMPLETE" : "SIGNAL LOST";
  byId("result-title").textContent = summary.victory ? "训练完成" : "球体离线";
  byId("result-subtitle").textContent = summary.victory ? "零号执行体已被清除。" : "任务失败，已保存本次回收记录。";
  byId("result-time").textContent = summary.timeText;
  byId("result-kills").textContent = summary.kills;
  byId("result-energy").textContent = summary.energy;
  byId("result-scrap").textContent = `+${summary.scrap}`;
  showGameLayer("result-screen");
}

const game = new Game(byId("game-canvas"), {
  onHud: renderHud,
  onPauseChange: (paused) => {
    if (paused) showGameLayer("pause-screen");
    else showGameLayer();
  },
  onAnnouncement: ({ title, subtitle }) => showToast(`${title} // ${subtitle}`, 1500),
  onResult: showResult,
});

function beginRun(coreId) {
  profile.lastCore = coreId;
  profile.guideSeen = true;
  saveProfile();
  game.applySettings(profile.settings);
  game.start(coreId, profile.meta);
  showGameLayer();
}

function returnToMenu() {
  game.stop();
  renderProfile();
  showScreen("menu-screen");
}

function openSettings() {
  settingsReturnScreen = currentScreen === "game" ? "menu-screen" : currentScreen;
  byId("volume-input").value = profile.settings.volume;
  byId("music-volume-input").value = profile.settings.musicVolume;
  byId("shake-input").checked = profile.settings.shake;
  byId("flash-input").checked = profile.settings.reduceFlash;
  showScreen("settings-screen");
}

function closeSettings() {
  showScreen(settingsReturnScreen || "menu-screen");
}

byId("start-button").addEventListener("click", () => { audio.unlock(); showScreen("core-screen"); });
byId("meta-button").addEventListener("click", () => { renderMeta(); showScreen("meta-screen"); });
byId("guide-button").addEventListener("click", () => showScreen("guide-screen"));
byId("guide-start-button").addEventListener("click", () => {
  profile.guideSeen = true;
  saveProfile();
  showScreen("core-screen");
});
byId("settings-button").addEventListener("click", openSettings);
byId("settings-close").addEventListener("click", closeSettings);

for (const button of document.querySelectorAll("[data-back]")) {
  button.addEventListener("click", () => {
    if (currentScreen === "guide-screen") {
      profile.guideSeen = true;
      saveProfile();
    }
    showScreen(button.dataset.back);
  });
}

byId("volume-input").addEventListener("input", (event) => {
  profile.settings.volume = Number(event.target.value);
  game.applySettings(profile.settings);
  saveProfile();
});
byId("music-volume-input").addEventListener("input", (event) => {
  profile.settings.musicVolume = Number(event.target.value);
  game.applySettings(profile.settings);
  saveProfile();
});
byId("shake-input").addEventListener("change", (event) => {
  profile.settings.shake = event.target.checked;
  game.applySettings(profile.settings);
  saveProfile();
});
byId("flash-input").addEventListener("change", (event) => {
  profile.settings.reduceFlash = event.target.checked;
  game.applySettings(profile.settings);
  saveProfile();
});

byId("reset-save-button").addEventListener("click", (event) => {
  const now = Date.now();
  if (now > resetArmedUntil) {
    resetArmedUntil = now + 3500;
    event.currentTarget.textContent = "再点一次确认重置";
    showToast("该操作会清除核心能源与最高纪录");
    window.setTimeout(() => {
      if (Date.now() > resetArmedUntil) event.currentTarget.textContent = "重置本地进度";
    }, 3600);
    return;
  }
  localStorage.removeItem(SAVE_KEY);
  profile = structuredClone(DEFAULT_SAVE);
  resetArmedUntil = 0;
  event.currentTarget.textContent = "重置本地进度";
  game.applySettings(profile.settings);
  renderProfile();
  renderMeta();
  showToast("本地进度已重置");
});

byId("pause-button").addEventListener("click", () => game.pause(true));
byId("resume-button").addEventListener("click", () => game.resume());
byId("restart-button").addEventListener("click", () => beginRun(profile.lastCore));
byId("quit-button").addEventListener("click", returnToMenu);
byId("again-button").addEventListener("click", () => beginRun(profile.lastCore));
byId("result-menu-button").addEventListener("click", returnToMenu);
const joystickZone = byId("joystick-zone");
const joystickKnob = byId("joystick-knob");
let joystickPointer = null;

function updateJoystick(event) {
  const rect = joystickZone.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  let dx = event.clientX - centerX;
  let dy = event.clientY - centerY;
  const max = rect.width * 0.34;
  const length = Math.hypot(dx, dy);
  if (length > max) { dx = dx / length * max; dy = dy / length * max; }
  joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  game.setTouchVector(dx / max, dy / max);
}

joystickZone.addEventListener("pointerdown", (event) => {
  joystickPointer = event.pointerId;
  joystickZone.setPointerCapture(event.pointerId);
  updateJoystick(event);
});
joystickZone.addEventListener("pointermove", (event) => {
  if (event.pointerId === joystickPointer) updateJoystick(event);
});
function releaseJoystick(event) {
  if (event.pointerId !== joystickPointer) return;
  joystickPointer = null;
  joystickKnob.style.transform = "translate(0, 0)";
  game.setTouchVector(0, 0);
}
joystickZone.addEventListener("pointerup", releaseJoystick);
joystickZone.addEventListener("pointercancel", releaseJoystick);
byId("touch-dash").addEventListener("pointerdown", (event) => { event.preventDefault(); game.requestDash(); });
byId("touch-attack").addEventListener("pointerdown", (event) => { event.preventDefault(); game.requestAttack(); });
byId("touch-ranged").addEventListener("pointerdown", (event) => { event.preventDefault(); game.requestRanged(); });
byId("touch-skill").addEventListener("pointerdown", (event) => { event.preventDefault(); game.requestSkill(); });
byId("touch-block").addEventListener("pointerdown", (event) => { event.preventDefault(); game.setBlocking(true); });
for (const eventName of ["pointerup", "pointercancel", "pointerleave"]) {
  byId("touch-block").addEventListener(eventName, () => game.setBlocking(false));
}

game.applySettings(profile.settings);
renderCoreCards();
renderProfile();

// Referencing the adapter here keeps the integration boundary exercised without
// showing fake ads. Real platform adapters can replace it without touching UI flow.
void adService.isAvailable();

if (["127.0.0.1", "localhost"].includes(window.location.hostname)) {
  window.__NEON_DEBUG__ = { game, beginRun, audio };
}

const previewCore = new URLSearchParams(window.location.search).get("autostart");
if (previewCore && CORES[previewCore]) {
  window.setTimeout(() => beginRun(previewCore), 80);
} else if (!profile.guideSeen) {
  window.setTimeout(() => showScreen("guide-screen"), 280);
}

if ("serviceWorker" in navigator && (window.location.protocol === "https:" || ["localhost", "127.0.0.1"].includes(window.location.hostname))) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Offline support is optional; a registration failure must never block the game.
    });
  });
}

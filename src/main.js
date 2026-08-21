import { CORES, META_UPGRADES, WEAPONS, metaCost } from "./config.js?v=67b2c11b0b75";
import { audio } from "./audio.js?v=67b2c11b0b75";
import { adService } from "./ad-service.js?v=67b2c11b0b75";
import { Game } from "./game.js?v=67b2c11b0b75";
import { ASSET_REVISION, assetUrl } from "./revision.js?v=67b2c11b0b75";

const SAVE_KEY = "neon-embers-save-v1";
const SW_REFRESH_KEY = "neon-embers-sw-refresh";

const refreshedUrl = new URL(window.location.href);
if (refreshedUrl.searchParams.has("_sw")) {
  refreshedUrl.searchParams.delete("_sw");
  window.history.replaceState(null, "", `${refreshedUrl.pathname}${refreshedUrl.search}${refreshedUrl.hash}`);
}

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
let loadingForRun = false;
let runtimeAssetsReady = false;
const offlineCacheState = { loaded: 0, total: 0, failed: [], ready: false };

const byId = (id) => document.getElementById(id);
const allScreens = [...document.querySelectorAll(".screen")];
const hud = byId("hud");
const touchControls = byId("touch-controls");
const coarsePointer = window.matchMedia("(pointer: coarse)");

const elements = {
  loadingScreen: byId("loading-screen"),
  loadingTrack: byId("loading-track"),
  loadingFill: byId("loading-fill"),
  loadingStage: byId("loading-stage"),
  loadingPercent: byId("loading-percent"),
  menuScrap: byId("menu-scrap"),
  menuBestTime: byId("menu-best-time"),
  menuBestKills: byId("menu-best-kills"),
  metaScrap: byId("meta-scrap"),
  coreGrid: byId("core-grid"),
  metaGrid: byId("meta-grid"),
  roomGrid: byId("room-grid"),
  roomStage: byId("room-stage"),
  roomStageName: byId("room-stage-name"),
  roomSubtitle: byId("room-subtitle"),
  roomEnergy: byId("room-energy"),
  roomHealth: byId("room-health"),
  roomStamina: byId("room-stamina"),
  roomAmmo: byId("room-ammo"),
  roomBarrier: byId("room-barrier"),
  roomStartButton: byId("room-start-button"),
  weaponDock: byId("weapon-dock"),
  healthFill: byId("health-fill"),
  healthText: byId("health-text"),
  shieldFill: byId("shield-fill"),
  missionFill: byId("mission-fill"),
  staminaText: byId("stamina-text"),
  hudMission: byId("hud-mission"),
  hudPhase: byId("hud-phase"),
  hudObjectiveText: byId("hud-objective-text"),
  hudTime: byId("hud-time"),
  hudKills: byId("hud-kills"),
  hudScrap: byId("hud-scrap"),
  hudAmmo: byId("hud-ammo"),
  dashFill: byId("dash-fill"),
  skillDock: byId("skill-dock"),
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
    touchControls.setAttribute("aria-hidden", "true");
  }
}

function showGameLayer(id = null) {
  for (const screen of allScreens) screen.classList.toggle("is-active", screen.id === id);
  currentScreen = id || "game";
  hud.classList.add("is-active");
  const touchActive = coarsePointer.matches && !id;
  touchControls.classList.toggle("is-active", touchActive);
  touchControls.setAttribute("aria-hidden", String(!touchActive));
}

function showToast(message, duration = 1700) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-active");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-active"), duration);
}

function setLoadingStatus(stage, percent) {
  const progress = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  elements.loadingStage.textContent = stage;
  elements.loadingPercent.textContent = `${progress}%`;
  elements.loadingFill.style.width = `${progress}%`;
  elements.loadingTrack.setAttribute("aria-valuenow", String(progress));
}

function showLoadingScreen(stage = "读取战斗素材", percent = 0) {
  setLoadingStatus(stage, percent);
  elements.loadingScreen.setAttribute("aria-hidden", "false");
  elements.loadingScreen.setAttribute("aria-busy", "true");
  elements.loadingScreen.classList.add("is-active");
}

function hideLoadingScreen() {
  setLoadingStatus("战斗核心就绪", 100);
  elements.loadingScreen.setAttribute("aria-busy", "false");
  elements.loadingScreen.setAttribute("aria-hidden", "true");
  elements.loadingScreen.classList.remove("is-active");
}

function renderLoadProgress({
  phase = "images", loaded = 0, total = 1, failed = [], phaseLoaded = 0, phaseTotal = 1,
} = {}) {
  const failedCount = Array.isArray(failed) ? failed.length : Number(failed) || 0;
  const completed = Math.min(total, loaded + failedCount);
  if (phase === "images") {
    setLoadingStatus(`读取战斗素材 ${completed}/${total}`, total ? completed / total * 76 : 0);
  } else if (phase === "sprite-filters") {
    const prepared = Math.min(phaseTotal, phaseLoaded);
    setLoadingStatus(`生成受击与动作材质 ${prepared}/${phaseTotal}`, 76 + (phaseTotal ? prepared / phaseTotal * 4 : 0));
  } else if (phase === "sprite-warm") {
    setLoadingStatus("提交角色材质", phaseLoaded >= phaseTotal ? 82 : 80);
  } else if (phase === "vfx-source") {
    setLoadingStatus("准备战斗特效", 85);
  } else if (phase === "vfx-lighter") {
    setLoadingStatus("准备能量光效", 91);
  } else if (phase === "vfx-screen") {
    setLoadingStatus("校准冲击光效", 96);
  } else if (phase === "arena-cache") {
    setLoadingStatus("构建完整战区", phaseLoaded >= phaseTotal ? 100 : 98);
  } else if (phase === "ready") {
    setLoadingStatus("战斗核心就绪", 100);
  }
}

function renderOfflineCacheProgress({ loaded = 0, total = 0, failed = [], ready = false } = {}) {
  offlineCacheState.loaded = Number(loaded) || 0;
  offlineCacheState.total = Number(total) || 0;
  offlineCacheState.failed = Array.isArray(failed) ? failed : [];
  offlineCacheState.ready = Boolean(ready);
  if (!runtimeAssetsReady || loadingForRun || !elements.loadingScreen.classList.contains("is-active")) return;
  const completed = Math.min(offlineCacheState.total, offlineCacheState.loaded + offlineCacheState.failed.length);
  const progress = offlineCacheState.total ? completed / offlineCacheState.total : 1;
  setLoadingStatus(
    ready ? "离线战斗缓存就绪" : `建立离线战斗缓存 ${completed}/${offlineCacheState.total}`,
    ready ? 100 : 96 + progress * 3,
  );
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
      ${core.bodyAsset ? `<img class="core-player-art" src="${assetUrl(core.bodyAsset)}" alt="" />` : core.asset ? `<img class="core-item-art" src="${assetUrl(core.asset)}" alt="" />` : `<div class="core-icon" aria-hidden="true"></div>`}
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
    info.className = "meta-info";
    info.innerHTML = `
      <img class="meta-art" src="${assetUrl(definition.asset)}" alt="" />
      <div class="meta-copy">
        <h3>${definition.name}</h3>
        <p>${definition.description}</p>
        <div class="meta-level" aria-label="等级 ${level} / ${definition.max}">
          ${Array.from({ length: definition.max }, (_, index) => `<i class="${index < level ? "on" : ""}"></i>`).join("")}
        </div>
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
  elements.hudObjectiveText.textContent = data.objective;
  elements.hudTime.textContent = data.time;
  elements.hudKills.textContent = data.kills;
  elements.hudScrap.textContent = data.scrap;
  elements.hudAmmo.textContent = data.reload > 0 ? "装填" : `${data.ammo}/${data.maxAmmo}`;
  elements.dashFill.style.width = `${data.dash * 100}%`;

  const skillSignature = data.skills.map((skill) => `${skill.slot}:${skill.id || "empty"}:${skill.name}:${skill.active ? 1 : 0}`).join("|");
  if (elements.skillDock.dataset.signature !== skillSignature) {
    elements.skillDock.dataset.signature = skillSignature;
    elements.skillDock.innerHTML = data.skills.map((skill) => `
      <div class="skill-slot${skill.equipped ? " is-equipped" : " is-empty"}${skill.active ? " is-active" : ""}" data-skill-slot="${skill.slot}" style="--skill-color:${skill.color}" role="listitem" aria-disabled="${skill.equipped ? "false" : "true"}" aria-current="${skill.active ? "true" : "false"}">
        <small>S${skill.slot}</small><span>${skill.name}</span><i><b></b></i>
      </div>
    `).join("");
  }
  for (const skill of data.skills) {
    const item = elements.skillDock.querySelector(`[data-skill-slot="${skill.slot}"]`);
    if (!item) continue;
    const ready = skill.equipped && skill.charge >= 0.999;
    item.classList.toggle("is-ready", ready);
    item.querySelector("b").style.width = `${Math.max(0, skill.charge) * 100}%`;
    item.setAttribute("aria-label", skill.equipped ? `技能槽 ${skill.slot}：${skill.name}${skill.active ? "，已选中" : ""}${ready ? "，就绪" : "，冷却中"}` : `技能槽 ${skill.slot}：待装配`);
  }

  const signature = data.weapons.map((weapon) => `${weapon.slot}:${weapon.id}:${weapon.ammo || ""}:${weapon.active ? 1 : 0}`).join("|");
  if (elements.weaponDock.dataset.signature !== signature) {
    elements.weaponDock.dataset.signature = signature;
    elements.weaponDock.innerHTML = data.weapons.map((weapon) => `
      <div class="weapon-chip${weapon.active ? " is-active" : ""}" data-slot="${weapon.slot}" style="--weapon-color:${weapon.color}" role="listitem" aria-current="${weapon.active ? "true" : "false"}" aria-keyshortcuts="${weapon.slot}" title="按 ${weapon.slot} 选择，或滚动鼠标滚轮切换武器">
        <kbd class="weapon-slot-key">${weapon.slot}</kbd>
        ${weapon.asset ? `<img src="${assetUrl(weapon.asset)}" alt="" />` : `<b>${weapon.name.slice(0, 2)}</b>`}
        <span>${weapon.ammo || (weapon.active ? "已装备" : "近战")}</span>
      </div>
    `).join("");
  }

  elements.bossBar.classList.toggle("is-active", Boolean(data.boss));
  if (data.boss) {
    elements.bossName.textContent = data.boss.name;
    elements.bossFill.style.width = `${data.boss.ratio * 100}%`;
  }
}

function renderRoom(data) {
  if (!data) return;
  elements.roomStage.textContent = data.stage.id;
  elements.roomStageName.textContent = data.stage.name;
  elements.roomSubtitle.textContent = data.stage.subtitle;
  elements.roomEnergy.textContent = data.energy;
  elements.roomHealth.textContent = `${data.health} / ${data.maxHealth}`;
  elements.roomStamina.textContent = `${data.stamina} / ${data.maxStamina}`;
  elements.roomAmmo.textContent = `${data.ammo} / ${data.maxAmmo}`;
  elements.roomBarrier.textContent = `${data.barrier} / 80`;
  elements.roomStartButton.innerHTML = `<span>开始 ${data.stage.id} 战斗</span><small>${data.stage.boss ? "进入核心区迎战最终首领" : "整备完成后手动进入战区"}</small>`;
  elements.roomGrid.replaceChildren();
  for (const item of data.items) {
    const article = document.createElement("article");
    article.className = "room-item";
    article.innerHTML = `
      <div class="room-item-art"><img src="${assetUrl(item.asset)}" alt="" /></div>
      <div class="room-item-copy"><h3>${item.name}</h3><p>${item.description}</p><small>本次任务已购买 ${item.purchased}</small></div>
    `;
    const button = document.createElement("button");
    button.className = "room-buy";
    button.type = "button";
    button.dataset.roomItem = item.id;
    button.disabled = !item.available || data.energy < item.cost;
    button.textContent = !item.available ? item.reason : `${item.cost} 能源`;
    button.addEventListener("click", () => {
      const result = game.purchaseRoomItem(item.id);
      showToast(result.message);
    });
    article.append(button);
    elements.roomGrid.append(article);
  }
  showGameLayer("room-screen");
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
  onLoadProgress: renderLoadProgress,
  onHud: renderHud,
  onRoom: renderRoom,
  onPauseChange: (paused) => {
    if (paused) showGameLayer("pause-screen");
    else showGameLayer();
  },
  onAnnouncement: ({ title, subtitle }) => showToast(`${title} // ${subtitle}`, 1500),
  onResult: showResult,
});

game.assetsReady.then(() => {
  runtimeAssetsReady = true;
  if (!offlineCacheState.ready && offlineCacheState.total) renderOfflineCacheProgress(offlineCacheState);
  if (!loadingForRun) hideLoadingScreen();
});

async function beginRun(coreId) {
  loadingForRun = true;
  showLoadingScreen("同步战斗音频", 97);
  audio.unlock();
  await game.assetsReady;
  await audio.loadSamples();
  profile.lastCore = coreId;
  profile.guideSeen = true;
  saveProfile();
  game.applySettings(profile.settings);
  game.start(coreId, profile.meta);
  await game.arenaReady;
  loadingForRun = false;
  hideLoadingScreen();
}

async function beginPreparedStage() {
  if (game.state !== "room") return;
  loadingForRun = true;
  showLoadingScreen("构建完整战区", 98);
  const stageIndex = game.run.pendingStageIndex;
  await game.prepareArenaCache({ mode: "stage", stageIndex });
  if (game.beginStage()) showGameLayer();
  loadingForRun = false;
  hideLoadingScreen();
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
byId("room-start-button").addEventListener("click", () => { void beginPreparedStage(); });
byId("room-exit-button").addEventListener("click", returnToMenu);
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
byId("touch-attack").addEventListener("pointerdown", (event) => { event.preventDefault(); game.requestPrimaryAttack(); });
byId("touch-ranged").addEventListener("pointerdown", (event) => { event.preventDefault(); game.requestRanged(); });
byId("touch-skill").addEventListener("pointerdown", (event) => { event.preventDefault(); game.requestSkill(); });
byId("touch-block").addEventListener("pointerdown", (event) => { event.preventDefault(); game.setBlockInput("touch", true); });
for (const eventName of ["pointerup", "pointercancel", "pointerleave"]) {
  byId("touch-block").addEventListener(eventName, () => game.setBlockInput("touch", false));
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
  const hadController = Boolean(navigator.serviceWorker.controller);
  let refreshingForUpdate = false;
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "CACHE_PROGRESS") renderOfflineCacheProgress(event.data);
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || refreshingForUpdate) return;
    if (window.sessionStorage.getItem(SW_REFRESH_KEY) === ASSET_REVISION) return;
    refreshingForUpdate = true;
    window.sessionStorage.setItem(SW_REFRESH_KEY, ASSET_REVISION);
    const updateUrl = new URL(window.location.href);
    updateUrl.searchParams.set("_sw", Date.now().toString(36));
    window.location.replace(updateUrl);
  });
  const waitForInstall = (registration) => {
    const worker = registration.installing;
    if (!worker || ["installed", "activated", "redundant"].includes(worker.state)) return Promise.resolve();
    return new Promise((resolve) => {
      const finish = () => {
        if (!["installed", "activated", "redundant"].includes(worker.state)) return;
        worker.removeEventListener("statechange", finish);
        resolve();
      };
      worker.addEventListener("statechange", finish);
    });
  };
  const windowLoadReady = document.readyState === "complete"
    ? Promise.resolve()
    : new Promise((resolve) => window.addEventListener("load", resolve, { once: true }));
  void Promise.all([game.assetsReady, windowLoadReady]).then(() => {
    navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" })
      .then(async (registration) => {
        try { await registration.update(); } catch {
          // The worker already installing from register() can still complete normally.
        }
        await waitForInstall(registration);
        offlineCacheState.ready = true;
      })
      .catch(() => {
        // Offline support is optional; a registration failure must never block the game.
        offlineCacheState.ready = true;
      });
  });
}

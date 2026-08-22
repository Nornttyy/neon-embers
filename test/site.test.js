import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const ROOM_ITEM_ART = ["repair-kit.png", "ammo-cell.png", "stamina-cell.png", "barrier-module.png"];
const ENEMY_ART = ["melee-drone.png", "skitter-drone.png", "ranged-drone.png", "brute-drone.png", "shield-drone.png", "lancer-drone.png", "elite-drone.png", "boss-drone.png"];
const WORLD_ART = ["arena-pylon.png", "energy-terminal.png", "room-floor.png", "outer-floor.png", "blockade-floor.png", "core-floor.png", "arena-barrier.png", "arena-vent.png"];
const EFFECT_ART = [
  "guard-field.png", "parry-flash.png", "guard-break.png", "pulse-wave.png", "overdrive-aura.png", "barrier-shell.png",
  "rail-round.png", "enemy-bolt.png", "boss-bolt.png", "rail-muzzle.png", "enemy-muzzle.png", "enemy-swing.png",
  "attack-telegraph.png", "heavy-telegraph.png",
  "lancer-trail.png", "enemy-spawn.png", "blade-hit.png", "twin-hit.png", "hammer-hit.png", "rail-hit.png",
  "guard-hit.png", "barrier-hit.png", "enemy-destroy.png", "pickup-collect.png", "enemy-shield.png",
  "dash-streak-hard.png", "boss-burst-hard.png", "energy-spark.png", "impact-shard.png",
  "combo-finisher.png", "parry-counter.png", "skill-core.png", "dash-arrival.png", "execution-burst.png",
];
const VFX_IMAGE_KEYS = [
  "guardField", "parryFlash", "guardBreak", "pulseWave", "overdriveAura", "barrierShell",
  "railRound", "enemyBolt", "bossBolt", "railMuzzle", "enemyMuzzle", "enemySwing",
  "attackTelegraph", "heavyTelegraph", "lancerTrail", "enemySpawn", "bladeHit", "twinHit",
  "hammerHit", "railHit", "guardHit", "barrierHit", "enemyDestroy", "pickupCollect",
  "enemyShield", "dashStreak", "bossBurst", "energySpark", "impactShard",
  "comboFinisher", "parryCounter", "skillCore", "dashArrival", "executionBurst",
];
const UPGRADE_ART = ["power-upgrade.png", "armor-upgrade.png", "recovery-upgrade.png"];
const RETIRED_EFFECT_ART = ["slash-arc.png", "bullet-impact.png", "block-shield.png", "dash-streak.png", "boss-burst.png"];

async function readPng(url) {
  const bytes = await readFile(url);
  assert.ok(bytes.length > 512, `${url.pathname} is not an empty placeholder`);
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${url.pathname} has a PNG signature`);
  return bytes;
}

test("web app manifest references installable local assets", async () => {
  const manifest = JSON.parse(await readFile(new URL("../manifest.webmanifest", import.meta.url), "utf8"));
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "./");
  assert.ok(manifest.icons.length >= 3);
  for (const icon of manifest.icons) {
    const iconUrl = new URL(`../${icon.src}`, import.meta.url);
    iconUrl.search = "";
    await access(iconUrl);
  }
});

test("service worker caches every required application module and generated sprite", async () => {
  const worker = await readFile(new URL("../sw.js", import.meta.url), "utf8");
  const required = [
    "index.html", "styles.css", "src/revision.js", "src/config.js", "src/city.js", "src/game.js", "src/main.js",
    "assets/items/energy-sword.png", "assets/items/phase-blade.png", "assets/items/phase-twin-blades.png", "assets/items/power-hammer.png", "assets/items/rail-pistol.png", "assets/items/energy-core.png",
    ...ROOM_ITEM_ART.map((asset) => `assets/items/${asset}`),
    "assets/players/hunter-core.png", "assets/players/storm-core.png", "assets/players/bastion-core.png",
    ...UPGRADE_ART.map((asset) => `assets/ui/${asset}`),
    ...ENEMY_ART.map((asset) => `assets/enemies/${asset}`),
    ...WORLD_ART.map((asset) => `assets/world/${asset}`),
    ...EFFECT_ART.map((asset) => `assets/effects/${asset}`),
    "assets/audio/swing-whoosh-1.wav", "assets/audio/swing-whoosh-2.wav", "assets/audio/bullet-impact.wav",
    "assets/audio/body-hit-1.ogg", "assets/audio/body-hit-2.ogg", "assets/audio/body-hit-3.ogg",
    "assets/audio/heavy-hit-1.ogg", "assets/audio/heavy-hit-2.ogg",
    "assets/audio/metal-block-1.ogg", "assets/audio/metal-block-2.ogg",
    "assets/audio/mechanism-1.ogg", "assets/audio/mechanism-2.ogg",
  ];
  for (const asset of required) {
    assert.match(worker, new RegExp(asset.replaceAll(".", "\\.")));
  }
  for (const asset of RETIRED_EFFECT_ART) assert.doesNotMatch(worker, new RegExp(`assets/effects/${asset}`.replaceAll(".", "\\.")));
  assert.match(worker, /cache: "reload"/);
  assert.match(worker, /cache\.match\(request\)/);
  assert.doesNotMatch(worker, /caches\.match\(request\)/);
  assert.match(worker, /key\.startsWith\(CACHE_PREFIX\)/);
  const shellEntries = (name) => {
    const block = worker.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\n\\];`))?.[1] || "";
    return [...block.matchAll(/^\s+(?:versioned\()?"[^"\n]+"\)?[,]?$/gm)];
  };
  assert.equal(shellEntries("CORE_SHELL").length, 18);
  assert.equal(shellEntries("ASSET_SHELL").length, 75);
  assert.equal(shellEntries("CORE_SHELL").length + shellEntries("ASSET_SHELL").length, 93, "bounded installation retains the complete offline manifest");
  assert.match(worker, /const PRECACHE_CONCURRENCY = 4/);
  const concurrencyBlock = worker.match(/async function cacheWithConcurrency[\s\S]*?\n\}/)?.[0] || "";
  assert.match(concurrencyBlock, /while \(nextIndex < paths\.length\)/);
  assert.match(concurrencyBlock, /workerCount = Math\.min\(PRECACHE_CONCURRENCY, paths\.length\)/);
  assert.match(concurrencyBlock, /await Promise\.all\(Array\.from\(\{ length: workerCount \}/);
  assert.match(concurrencyBlock, /progress\.failed\.push\(path\)/, "optional failures are counted without aborting a worker");
  assert.match(concurrencyBlock, /if \(required && failures\.length > 0\)/, "the core shell remains required and atomic at install level");
  const installBlock = worker.match(/self\.addEventListener\("install"[\s\S]*?\n\}\);/)?.[0] || "";
  const coreIndex = installBlock.indexOf("cacheWithConcurrency(cache, CORE_SHELL, progress, reportProgress, true)");
  const optionalIndex = installBlock.indexOf("cacheWithConcurrency(cache, ASSET_SHELL, progress, reportProgress, false)");
  const readyIndex = installBlock.indexOf("progress.ready = true");
  assert.ok(coreIndex >= 0 && coreIndex < optionalIndex && optionalIndex < readyIndex, "required core assets finish before optional assets and the ready signal");
  assert.match(worker, /type: "CACHE_PROGRESS"/);
  assert.match(worker, /client\.postMessage\(progress\)/);
  assert.match(worker, /total: CORE_SHELL\.length \+ ASSET_SHELL\.length/);
  const precacheRequestBlock = worker.match(/const precacheRequest[\s\S]*?;\n/)?.[0] || "";
  assert.match(precacheRequestBlock, /path\.includes\(`\?v=\$\{ASSET_REVISION\}`\) \? "default" : "reload"/, "revisioned resources reuse HTTP cache while the unversioned document shell refreshes");
  assert.doesNotMatch(worker, /Promise\.allSettled/, "the old unbounded optional-asset fanout is retired");
});

test("asset loading decodes and prewarms every VFX image before becoming ready", async () => {
  const game = await readFile(new URL("../src/game.js", import.meta.url), "utf8");
  const main = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
  assert.match(game, /MAX_ASSET_LOAD_ATTEMPTS = 3/);
  assert.match(game, /await image\.decode\(\)/);
  assert.match(game, /this\.assetsReady = Promise\.all/);
  const vfxKeysBlock = game.match(/const VFX_IMAGE_KEYS\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\);/);
  assert.ok(vfxKeysBlock, "VFX prewarming declares an explicit image-key allowlist");
  assert.deepEqual(
    [...vfxKeysBlock[1].matchAll(/"(\w+)"/g)].map((match) => match[1]),
    VFX_IMAGE_KEYS,
    "every runtime VFX image is included in the prewarm allowlist",
  );
  assert.match(game, /this\.vfxWarmState = \{ ready: false, warmed: 0, total: VFX_IMAGE_KEYS\.length, failed: \[\] \}/);
  const passBlock = game.match(/\n  runVfxWarmPass\(composite, warmedKeys\) \{([\s\S]*?)\n  \}\n\n  async warmVfxImages\(/)?.[1] || "";
  const warmBlock = game.match(/\n  async warmVfxImages\(\) \{([\s\S]*?)\n  \}\n\n  bindInput\(/)?.[1] || "";
  assert.match(passBlock, /const context = this\.ctx/, "VFX textures are warmed on the real game Canvas");
  assert.doesNotMatch(game, /createVfxWarmSurface|OffscreenCanvas/, "a detached surface cannot warm the game Canvas");
  assert.match(passBlock, /context\.globalAlpha = 0\.25/, "prewarm draws remain non-zero for GPU submission");
  assert.match(passBlock, /context\.globalCompositeOperation = composite/);
  assert.match(game, /const VFX_WARM_COLUMNS = 7/);
  assert.match(game, /const VFX_WARM_ROWS = 5/);
  assert.match(passBlock, /column = index % VFX_WARM_COLUMNS/);
  assert.match(passBlock, /row = Math\.floor\(index \/ VFX_WARM_COLUMNS\)/);
  assert.match(passBlock, /context\.drawImage\(image, x, y, width, height\)/);
  assert.ok(
    passBlock.indexOf("context.drawImage(image, x, y, width, height)") < passBlock.indexOf("warmedKeys.add(key)"),
    "a VFX key is counted as warm only after its image was submitted through drawImage",
  );
  assert.doesNotMatch(passBlock, /clearRect/, "grid images remain present until the Canvas submits the frame");
  assert.match(passBlock, /requestAnimationFrame\(drawGrid\)/, "each grid pass is drawn after the regular game frame");
  const sourcePassIndex = warmBlock.indexOf('await this.runVfxWarmPass("source-over", warmedKeys);');
  const sourceSettleIndex = warmBlock.indexOf("await this.waitForAnimationFrames(3);", sourcePassIndex);
  const glowPassIndex = warmBlock.indexOf('await this.runVfxWarmPass("lighter", warmedKeys);');
  const glowSettleIndex = warmBlock.indexOf("await this.waitForAnimationFrames(3);", glowPassIndex);
  const screenPassIndex = warmBlock.indexOf('await this.runVfxWarmPass("screen", warmedKeys);');
  const screenSettleIndex = warmBlock.indexOf("await this.waitForAnimationFrames(3);", screenPassIndex);
  assert.ok(
    sourcePassIndex >= 0 && sourcePassIndex < sourceSettleIndex
      && sourceSettleIndex < glowPassIndex && glowPassIndex < glowSettleIndex
      && glowSettleIndex < screenPassIndex && screenPassIndex < screenSettleIndex,
    "all three VFX blend pipelines remain submitted for three animation frames",
  );
  for (const phase of ["images", "sprite-filters", "sprite-warm", "vfx-source", "vfx-lighter", "vfx-screen", "ready"]) {
    assert.match(game, new RegExp(`emitLoadProgress\\(\"${phase}\"`), `loading reports the ${phase} phase`);
  }
  const frameWaitBlock = game.match(/\n  waitForAnimationFrames\(count = 1\) \{([\s\S]*?)\n  \}\n\n  markVfxWarmFailure\(/)?.[1] || "";
  assert.match(frameWaitBlock, /requestAnimationFrame\(next\)/, "batch yielding is backed by requestAnimationFrame");
  const readyBlock = game.match(/this\.assetsReady = Promise\.all[\s\S]*?\.then\(async \(\) => \{([\s\S]*?)\n\s*\}\);\n\s*this\.resize\(\);/)?.[1] || "";
  const filterBuildIndex = readyBlock.indexOf("await this.prepareFilteredSprites();");
  const filterWarmIndex = readyBlock.indexOf("await this.warmFilteredSprites();");
  const warmIndex = readyBlock.indexOf("await this.warmVfxImages();");
  const vfxReadyIndex = readyBlock.indexOf("this.vfxWarmState.ready = true;");
  const assetReadyIndex = readyBlock.indexOf("this.assetLoadState.ready = true;");
  assert.ok(
    filterBuildIndex >= 0 && filterBuildIndex < filterWarmIndex && filterWarmIndex < warmIndex
      && warmIndex < vfxReadyIndex && vfxReadyIndex < assetReadyIndex,
    "assetsReady becomes ready only after filtered sprites and all three main-Canvas VFX passes have settled",
  );
  assert.match(passBlock, /composite === "screen"[\s\S]*?Math\.ceil\(540 \* this\.view\.dpr\)/, "the screen pipeline prewarms a full-size pulse, not only tiny grid cells");
  assert.match(main, /game\.assetsReady\.then\(\(\) =>/);
  assert.doesNotMatch(main, /offlineCacheReady/, "background offline installation is not part of runtime readiness");
  assert.match(main, /updateViaCache: "none"/);
  assert.match(main, /controllerchange/);
  assert.match(main, /window\.location\.replace\(updateUrl\)/);
});

test("production build replaces one content revision across code and asset URLs", async () => {
  const builtRevision = await readFile(new URL("../dist/src/revision.js", import.meta.url), "utf8");
  const match = builtRevision.match(/ASSET_REVISION = "([a-f0-9]{12})"/);
  assert.ok(match, "build emits a twelve-character content revision");
  for (const path of ["../dist/index.html", "../dist/manifest.webmanifest", "../dist/sw.js", "../dist/src/audio.js", "../dist/src/game.js", "../dist/src/main.js", "../dist/src/revision.js"]) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.doesNotMatch(source, /__ASSET_REVISION__/);
    assert.match(source, new RegExp(match[1]));
  }
});

test("generated equipment sprites are present", async () => {
  for (const asset of ["energy-sword.png", "phase-blade.png", "phase-twin-blades.png", "power-hammer.png", "rail-pistol.png", "energy-core.png", ...ROOM_ITEM_ART]) {
    await readPng(new URL(`../assets/items/${asset}`, import.meta.url));
  }
});

test("generated enemy and arena sprites are present", async () => {
  for (const asset of ENEMY_ART) {
    await readPng(new URL(`../assets/enemies/${asset}`, import.meta.url));
  }
  for (const asset of WORLD_ART) {
    await readPng(new URL(`../assets/world/${asset}`, import.meta.url));
  }
});

test("generated player core sprites are present", async () => {
  for (const asset of ["hunter-core.png", "storm-core.png", "bastion-core.png"]) {
    await access(new URL(`../assets/players/${asset}`, import.meta.url));
  }
});

test("generated permanent upgrade card sprites are present", async () => {
  for (const asset of UPGRADE_ART) {
    const bytes = await readPng(new URL(`../assets/ui/${asset}`, import.meta.url));
    assert.ok([4, 6].includes(bytes[25]), `${asset} keeps an alpha channel`);
  }
});

test("generated combat material sprites are present and keep transparent alpha", async () => {
  for (const asset of EFFECT_ART) {
    const bytes = await readPng(new URL(`../assets/effects/${asset}`, import.meta.url));
    assert.ok([4, 6].includes(bytes[25]), `${asset} keeps an alpha channel`);
  }
});

test("retired paint-like effects are absent from source and production output", async () => {
  for (const asset of RETIRED_EFFECT_ART) {
    await assert.rejects(access(new URL(`../assets/effects/${asset}`, import.meta.url)));
    await assert.rejects(access(new URL(`../dist/assets/effects/${asset}`, import.meta.url)));
  }
});

test("0.9.6 keeps weapon, skill, wheel, and multi-source guard controls independent", async () => {
  const config = await readFile(new URL("../src/config.js", import.meta.url), "utf8");
  const game = await readFile(new URL("../src/game.js", import.meta.url), "utf8");
  const main = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const methodBlock = (name) => game.match(new RegExp(`\\n  ${name}\\([^)]*\\) \\{([\\s\\S]*?)\\n  \\}`))?.[1] || "";

  assert.match(config, /export const SKILLS = Object\.freeze\(\{/);
  assert.match(game, /import \{[^\n]*\bSKILLS\b[^\n]*\} from "\.\/config\.js/);
  assert.match(game, /const WEAPON_SLOT_MELEE = 1/);
  assert.match(game, /const WEAPON_SLOT_RANGED = 2/);
  assert.match(game, /const SKILL_SLOT_COUNT = 3/);
  const switchLockBlock = game.match(/const WEAPON_SWITCH_LOCKED_ACTIONS = Object\.freeze\(\[([^\]]+)\]\)/)?.[1] || "";
  for (const action of ["attack", "block", "dash", "broken", "skill"]) {
    assert.match(switchLockBlock, new RegExp(`"${action}"`), `${action} locks switching until the complete action finishes`);
  }
  assert.match(game, /activeWeaponSlot:\s*WEAPON_SLOT_MELEE/, "every new player starts on the core melee slot");
  assert.match(game, /pendingWeaponSlot:\s*null/);
  assert.match(game, /skillSlots:\s*\[core\.skill, null, null\]/, "the expandable skill dock starts with only the selected core skill equipped");
  assert.match(game, /activeSkillSlot:\s*1/);
  assert.match(game, /skillCooldowns:\s*Array\(SKILL_SLOT_COUNT\)\.fill\(0\)/);
  const inputBlock = methodBlock("bindInput");
  assert.match(inputBlock, /key === "1"[^\n]*selectWeaponSlot\(WEAPON_SLOT_MELEE\)/);
  assert.match(inputBlock, /key === "2"[^\n]*selectWeaponSlot\(WEAPON_SLOT_RANGED\)/);
  assert.match(inputBlock, /key === "j"[^\n]*requestPrimaryAttack\(\)/);
  assert.match(inputBlock, /key === "q"[^\n]*requestSkill\(\)/, "Q activates the selected skill rather than firing the pistol");
  assert.match(inputBlock, /key === "r"[^\n]*cycleSkillSlot\(\)/);
  assert.match(inputBlock, /key === "e"[^\n]*setBlockInput\("keyboard", true\)/);
  assert.match(inputBlock, /keyup[\s\S]*key === "e"[^\n]*setBlockInput\("keyboard", false\)/);
  assert.doesNotMatch(inputBlock, /key === "k"|key === 'k'|key === "3"|key === '3'/, "K and 3 have no combat binding");
  assert.match(inputBlock, /event\.button === 0[^\n]*requestPrimaryAttack\(\)/, "left click uses the selected slot");
  assert.match(inputBlock, /event\.button === 2[^\n]*setBlockInput\("mouse", true\)/);
  assert.match(inputBlock, /event\.button === 2[^\n]*setBlockInput\("mouse", false\)/);
  assert.match(inputBlock, /contextmenu[^\n]*preventDefault\(\)/);
  assert.match(game, /this\.weaponWheelGesture = \{ delta: 0, switched: false, resetTimer: 0 \}/);
  const wheelBlock = inputBlock.match(/this\.canvas\.addEventListener\("wheel",([\s\S]*?)\}, \{ passive: false \}\)/)?.[1] || "";
  assert.match(wheelBlock, /event\.ctrlKey/);
  assert.match(wheelBlock, /event\.deltaY === 0/);
  assert.match(wheelBlock, /Math\.abs\(event\.deltaX\) > Math\.abs\(event\.deltaY\)/);
  assert.match(wheelBlock, /event\.preventDefault\(\)/);
  assert.match(wheelBlock, /event\.deltaMode === 1 \? 16 : event\.deltaMode === 2 \? this\.view\.height : 1/);
  assert.match(wheelBlock, /gesture\.delta \+= event\.deltaY \* scale/);
  assert.match(wheelBlock, /window\.setTimeout\(\(\) => this\.resetWeaponWheelGesture\(\), 160\)/);
  assert.match(wheelBlock, /!gesture\.switched && Math\.abs\(gesture\.delta\) >= 48/);
  assert.match(wheelBlock, /this\.toggleWeaponSlot\(\)/, "one thresholded wheel gesture toggles the weapon once");
  const resetWheelBlock = methodBlock("resetWeaponWheelGesture");
  assert.match(resetWheelBlock, /delta = 0/);
  assert.match(resetWheelBlock, /switched = false/);

  const selectBlock = methodBlock("selectWeaponSlot");
  const applyBlock = methodBlock("applyWeaponSlot");
  const applyPendingBlock = methodBlock("applyPendingWeaponSlot");
  const toggleBlock = methodBlock("toggleWeaponSlot");
  const primaryBlock = methodBlock("requestPrimaryAttack");
  assert.match(selectBlock, /nextSlot !== WEAPON_SLOT_MELEE[^\n]*nextSlot !== WEAPON_SLOT_RANGED/, "only the two fixed slots are accepted");
  assert.match(selectBlock, /WEAPON_SWITCH_LOCKED_ACTIONS\.includes\(this\.player\.action\)/);
  assert.match(selectBlock, /pendingWeaponSlot = nextSlot/);
  assert.match(selectBlock, /applyWeaponSlot\(nextSlot\)/);
  assert.doesNotMatch(selectBlock, /requestAttack|requestRanged|\.ammo\s*[-+]?=/, "selection itself neither attacks nor spends ammo");
  assert.match(applyBlock, /activeWeaponSlot = slot/);
  assert.match(applyBlock, /pendingWeaponSlot = null/);
  assert.match(applyBlock, /emitHud\(true\)/, "the active highlight updates immediately");
  assert.match(applyPendingBlock, /player\.action !== "idle"/, "a queued switch applies only after the complete action returns to idle");
  assert.match(applyPendingBlock, /pendingWeaponSlot/);
  assert.match(applyPendingBlock, /applyWeaponSlot/);
  assert.match(game, /this\.applyPendingWeaponSlot\(\)/, "queued selection is revisited by the player update path");
  assert.match(toggleBlock, /pendingWeaponSlot \|\| this\.player\.activeWeaponSlot/);
  assert.match(toggleBlock, /selectWeaponSlot\(nextSlot\)/);
  assert.match(primaryBlock, /activeWeaponSlot === WEAPON_SLOT_RANGED/);
  assert.match(primaryBlock, /action === "block"/);
  assert.match(primaryBlock, /blockHeld = false/);
  assert.match(primaryBlock, /action = "idle"/, "primary attack cancels held block consistently for either slot");
  assert.match(primaryBlock, /requestRanged\(\)/);
  assert.match(primaryBlock, /requestAttack\(\)/, "the existing requestAttack API remains the direct melee action");
  const directMeleeBlock = methodBlock("requestAttack");
  assert.match(directMeleeBlock, /activeWeaponSlot !== WEAPON_SLOT_MELEE/);
  assert.match(directMeleeBlock, /selectWeaponSlot\(WEAPON_SLOT_MELEE\)/);
  assert.match(directMeleeBlock, /activeWeaponSlot !== WEAPON_SLOT_MELEE\) return/, "direct melee cannot create an invisible hit while slot 2 remains active");

  const selectSkillBlock = methodBlock("selectSkillSlot");
  const cycleSkillBlock = methodBlock("cycleSkillSlot");
  const requestSkillBlock = methodBlock("requestSkill");
  assert.match(selectSkillBlock, /nextSlot < 1[^\n]*nextSlot > SKILL_SLOT_COUNT/);
  assert.match(selectSkillBlock, /!this\.run\.skillSlots\[nextSlot - 1\][^\n]*return false/, "empty skill slots cannot become active");
  assert.match(selectSkillBlock, /activeSkillSlot = nextSlot/);
  assert.match(cycleSkillBlock, /for \(let offset = 1; offset <= SKILL_SLOT_COUNT; offset \+= 1\)/);
  assert.match(cycleSkillBlock, /this\.run\.skillSlots\[slot - 1\][^\n]*selectSkillSlot\(slot\)/, "R skips empty slots and can cycle future equipped skills");
  assert.match(game, /requestSkill\(slot = this\.player\?\.activeSkillSlot \|\| 1\)/);
  assert.match(requestSkillBlock, /this\.run\.skillSlots\[slotIndex\]/);
  assert.match(requestSkillBlock, /SKILLS\[skillId\]/);
  assert.match(requestSkillBlock, /!definition \|\| this\.player\.skillCooldowns\[slotIndex\] > 0[^\n]*return false/);
  assert.match(requestSkillBlock, /skillCooldowns\[slotIndex\] = definition\.cooldown \* player\.stats\.skillCooldown/);
  assert.match(requestSkillBlock, /return true/);
  assert.match(game, /for \(let index = 0; index < player\.skillCooldowns\.length; index \+= 1\)/);

  assert.match(game, /this\.blockInputs = new Set\(\)/);
  const blockInputBlock = methodBlock("setBlockInput");
  assert.match(blockInputBlock, /this\.blockInputs\.add\(source\)/);
  assert.match(blockInputBlock, /this\.blockInputs\.delete\(source\)/);
  assert.match(blockInputBlock, /this\.setBlocking\(this\.blockInputs\.size > 0\)/, "releasing one source keeps guard held while another source remains");
  assert.match(inputBlock, /this\.blockInputs\.clear\(\)/, "losing focus releases every guard source");
  const updatePlayerBlock = methodBlock("updatePlayer");
  assert.match(updatePlayerBlock, /this\.blockInputs\.size > 0 && !player\.blockHeld && player\.action === "idle" && this\.canGuard\(\)/);
  assert.match(updatePlayerBlock, /this\.setBlocking\(true\)/, "held guard input resumes after an interrupting attack or skill returns to idle");
  assert.ok(
    updatePlayerBlock.indexOf("this.applyPendingWeaponSlot()") < updatePlayerBlock.indexOf("this.blockInputs.size > 0"),
    "a queued weapon switch applies while idle before a held guard source restores the block action",
  );
  const breakGuardBlock = methodBlock("breakGuard");
  assert.match(breakGuardBlock, /this\.blockInputs\.clear\(\)/);
  assert.match(breakGuardBlock, /player\.blockHeld = false/);
  assert.match(breakGuardBlock, /player\.action = "broken"/, "guard break clears held sources instead of immediately re-entering guard");

  const hudBlock = methodBlock("emitHud");
  assert.match(hudBlock, /slot:\s*WEAPON_SLOT_MELEE[\s\S]*?active:\s*player\.activeWeaponSlot === WEAPON_SLOT_MELEE/);
  assert.match(hudBlock, /slot:\s*WEAPON_SLOT_RANGED[\s\S]*?active:\s*player\.activeWeaponSlot === WEAPON_SLOT_RANGED/);
  assert.match(hudBlock, /this\.run\.skillSlots\.map\(\(skillId, index\) =>/);
  assert.match(hudBlock, /active:\s*player\.activeSkillSlot === index \+ 1/);
  const renderHudBlock = main.match(/function renderHud\(data\) \{([\s\S]*?)\n\}\n\nfunction renderRoom/)?.[1] || "";
  const signatureBlock = renderHudBlock.match(/const signature[\s\S]*?join\("\|"\)/)?.[0] || "";
  assert.match(signatureBlock, /weapon\.slot/);
  assert.match(signatureBlock, /weapon\.active/, "changing only selection invalidates the HUD cache");
  assert.match(renderHudBlock, /weapon\.active[\s\S]*?is-active|is-active[\s\S]*?weapon\.active/);
  assert.match(renderHudBlock, /data-slot="\$\{weapon\.slot\}"/);
  assert.match(renderHudBlock, /aria-keyshortcuts="\$\{weapon\.slot\}"/);
  assert.match(renderHudBlock, /<kbd class="weapon-slot-key">\$\{weapon\.slot\}<\/kbd>/, "weapon shortcuts 1 and 2 remain visible");
  assert.match(styles, /\.weapon-chip\.is-active\s*\{/);
  assert.match(renderHudBlock, /skill\.active \? " is-active"/);
  assert.match(renderHudBlock, /data-skill-slot="\$\{skill\.slot\}"/);
  assert.match(renderHudBlock, /aria-disabled="\$\{skill\.equipped \? "false" : "true"\}"/);
  assert.match(renderHudBlock, /aria-current="\$\{skill\.active \? "true" : "false"\}"/);
  assert.match(renderHudBlock, /<small>S\$\{skill\.slot\}<\/small>/);
  assert.match(styles, /\.skill-slot\.is-active\s*\{/);
  assert.match(html, /id="skill-dock"[^>]*role="list"[^>]*按 R 轮换[^>]*按 Q 释放/);
  assert.match(html, /id="weapon-dock"[^>]*aria-keyshortcuts="1 2"/);
  assert.match(html, /id="skill-dock"[^>]*aria-keyshortcuts="r q"/);
  assert.match(main, /touchControls\.setAttribute\("aria-hidden", String\(!touchActive\)\)/, "touch controls become available to assistive technology only while active");

  assert.match(main, /touch-attack"\)\.addEventListener\("pointerdown"[^\n]*requestPrimaryAttack\(\)/, "touch attack follows the selected slot");
  assert.match(main, /touch-ranged"\)\.addEventListener\("pointerdown"[^\n]*requestRanged\(\)/, "touch ranged remains a direct shortcut");
  assert.match(main, /touch-skill"\)\.addEventListener\("pointerdown"[^\n]*requestSkill\(\)/, "touch skill activates the selected skill");
  assert.match(main, /touch-block"\)\.addEventListener\("pointerdown"[^\n]*setBlockInput\("touch", true\)/);
  assert.match(main, /\["pointerup", "pointercancel", "pointerleave"\][\s\S]*setBlockInput\("touch", false\)/);
  for (const id of ["touch-attack", "touch-ranged", "touch-block", "touch-dash", "touch-skill"]) {
    assert.match(html, new RegExp(`id="${id}"`), `${id} is retained for mobile play`);
  }
  for (const cityControl of ["WASD</kbd> 移动", "空格</kbd> 闪避", "鼠标 / F</kbd> 攻击", "E</kbd> 互动"]) {
    assert.match(html, new RegExp(cityControl), `the playable city teaches ${cityControl.replace(/<[^>]+>/g, "")}`);
  }
});

test("combat art uses endpoint-sampled dynamic weapon trails without static slash art or weapon ghosts", async () => {
  const game = await readFile(new URL("../src/game.js", import.meta.url), "utf8");
  const config = await readFile(new URL("../src/config.js", import.meta.url), "utf8");
  const main = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
  assert.doesNotMatch(game, /slashSprite|vfxSlash|slash-arc\.png/);
  assert.match(game, /const WEAPON_TIP_TRAIL_CAPACITY = 11/);
  assert.match(game, /const WEAPON_TIP_TRAIL_HANDS = Object\.freeze\(\["primary", "offhand"\]\)/);
  assert.match(game, /this\.weaponTipTrails = \{\s*primary: createWeaponTipTrail\(\),\s*offhand: createWeaponTipTrail\(\),\s*\}/);
  const updateTrailBlock = game.match(/\n  updateWeaponTipTrails\(dt\) \{([\s\S]*?)\n  \}\n\n  sampleWeaponTipTrail\(/)?.[1] || "";
  assert.match(updateTrailBlock, /this\.player\.action !== "attack"/);
  assert.match(updateTrailBlock, /timing\.stage !== "strike"/);
  assert.match(updateTrailBlock, /timing\.stage === "recovery" && timing\.progress <= 0\.28/);
  assert.match(updateTrailBlock, /this\.getActiveWeaponShapes\(this\.getHeldWeaponPose\(this\.run\.elapsed\)\)/);
  assert.match(updateTrailBlock, /this\.sampleWeaponTipTrail\(trails\[shape\.hand\], shape\.end\)/, "trail points come from each live weapon-shape endpoint");
  const drawTrailBlock = game.match(/\n  drawWeaponTipTrails\(ctx\) \{([\s\S]*?)\n  \}\n\n  drawWeaponSprite\(/)?.[1] || "";
  assert.match(drawTrailBlock, /for \(const hand of WEAPON_TIP_TRAIL_HANDS\)/, "the two hands are rendered as separate paths");
  assert.match(drawTrailBlock, /previous\.stroke !== current\.stroke/);
  assert.match(drawTrailBlock, /ctx\.globalCompositeOperation = "lighter"/);
  assert.match(drawTrailBlock, /const outerWidth = isHammer \? 24 : 17/);
  assert.match(drawTrailBlock, /const coreWidth = isHammer \? 4 : 3/);
  assert.match(drawTrailBlock, /ctx\.moveTo\(previous\.x, previous\.y\)/);
  assert.match(drawTrailBlock, /ctx\.lineTo\(current\.x, current\.y\)/);
  assert.equal([...drawTrailBlock.matchAll(/ctx\.stroke\(\)/g)].length, 2, "the dynamic trail has an outer glow and a bright core");
  assert.doesNotMatch(drawTrailBlock, /shadowBlur|filter|drawImage/, "the two wide lighter strokes replace runtime blur, texture, and translucent weapon ghosts");
  const keyframeBlock = game.match(/const (?:VFX|MATERIAL)_KEYFRAMES\s*=\s*Object\.freeze\(\{([\s\S]*?)\n\}\);/i);
  assert.ok(keyframeBlock, "combat materials expose declarative keyframe tracks");
  const frameTracks = [...keyframeBlock[1].matchAll(/\w+\s*:\s*Object\.freeze\(\[([\s\S]*?)\]\)/g)];
  assert.ok(frameTracks.length >= 4, "defense, burst, loop, and travel materials have distinct timing tracks");
  for (const [, track] of frameTracks) {
    const frameCount = [...track.matchAll(/\bat\s*:/g)].length;
    assert.ok(frameCount >= 8 && frameCount <= 10, `material track uses 8–10 frames, received ${frameCount}`);
  }
  const telegraphFrames = keyframeBlock[1].match(/telegraphPulse8\s*:\s*Object\.freeze\(\[([\s\S]*?)\]\)/)?.[1] || "";
  const heavyFrames = keyframeBlock[1].match(/heavyPulse10\s*:\s*Object\.freeze\(\[([\s\S]*?)\]\)/)?.[1] || "";
  const impactFrames = keyframeBlock[1].match(/impactSnap10\s*:\s*Object\.freeze\(\[([\s\S]*?)\]\)/)?.[1] || "";
  const sparkFrames = keyframeBlock[1].match(/sparkFlight10\s*:\s*Object\.freeze\(\[([\s\S]*?)\]\)/)?.[1] || "";
  assert.equal([...telegraphFrames.matchAll(/\bat\s*:/g)].length, 8);
  assert.equal([...heavyFrames.matchAll(/\bat\s*:/g)].length, 10);
  assert.ok([...impactFrames.matchAll(/\bat\s*:/g)].length >= 10, "signature impact overlays use at least ten timed animation poses");
  assert.ok([...sparkFrames.matchAll(/\bat\s*:/g)].length >= 10, "moving impact particles use at least ten timed animation poses");
  assert.match(game, /function sampleKeyframes\s*\(/);
  assert.match(game, /drawKeyframedSprite\s*\(/);
  const renderEnemy = game.match(/\n  renderEnemy\([\s\S]*?\n  renderPlayer\(/)?.[0] || "";
  const telegraphBlock = renderEnemy.match(/const telegraph[\s\S]*?\n    if \(enemy\.shielded\)/)?.[0] || "";
  assert.match(telegraphBlock, /attackTelegraph/);
  assert.match(telegraphBlock, /heavyTelegraph/);
  assert.match(telegraphBlock, /drawKeyframedSprite/);
  assert.doesNotMatch(telegraphBlock, /ctx\.(?:arc|moveTo|lineTo|fill)\s*\(/, "enemy windup no longer draws a visible procedural fan");
  for (const asset of EFFECT_ART) assert.match(game, new RegExp(asset.replaceAll(".", "\\.")));
  for (const asset of ["skitter-drone.png", "lancer-drone.png"]) assert.match(game, new RegExp(asset.replaceAll(".", "\\.")));
  for (const asset of ROOM_ITEM_ART) assert.match(config, new RegExp(asset.replaceAll(".", "\\.")));
  assert.match(main, /room-item-art/);
  assert.match(main, /assetUrl\(item\.asset\)/);
  for (const asset of UPGRADE_ART) assert.match(config, new RegExp(asset.replaceAll(".", "\\.")));
  assert.match(main, /meta-(?:item-)?art/);
  assert.match(main, /assetUrl\(definition\.asset\)/);

  assert.match(game, /const MAX_ACTIVE_SPARKS = 48/);
  const updatePlayerBlock = game.match(/\n  updatePlayer\(dt\) \{([\s\S]*?)\n  \}\n\n  startAttack\(/)?.[1] || "";
  assert.match(updatePlayerBlock, /dashArrived = true[\s\S]*?type: "dashArrival"/, "finishing a real dash emits its arrival material");
  const damageEnemyBlock = game.match(/\n  damageEnemy\(enemy,[\s\S]*?\n  \}\n\n  killEnemy\(/)?.[0] || "";
  assert.match(damageEnemyBlock, /this\.player\.attackIndex === 2/);
  assert.match(damageEnemyBlock, /comboFinisher,/);
  assert.match(damageEnemyBlock, /this\.spawnBurst\([\s\S]*?direction,[\s\S]*?\)/, "weapon-contact direction feeds the moving impact particles");
  const damagePlayerBlock = game.match(/\n  damagePlayer\(amount,[\s\S]*?\n  \}\n\n  applyHealthDamage\(/)?.[0] || "";
  assert.match(damagePlayerBlock, /type: "parryFlash"[\s\S]*?counter: true/);
  const killEnemyBlock = game.match(/\n  killEnemy\(enemy,[\s\S]*?\n  \}\n\n  damagePlayer\(/)?.[0] || "";
  assert.match(killEnemyBlock, /type: "enemyDestroy"[\s\S]*?finisher,/);
  const spawnBurstBlock = game.match(/\n  spawnBurst\(x,[\s\S]*?\n  \}\n\n  finish\(/)?.[0] || "";
  assert.match(spawnBurstBlock, /effect\.type === "energySpark" \|\| effect\.type === "impactShard"/);
  assert.match(spawnBurstBlock, /MAX_ACTIVE_SPARKS - activeSparks/);
  assert.match(spawnBurstBlock, /const directedAngle = direction/);
  assert.match(spawnBurstBlock, /const shard = index % 2 === 1/);
  assert.match(spawnBurstBlock, /type: shard \? "impactShard" : "energySpark"/);
  for (const field of ["particle: true", "vx:", "vy:", "drag:", "spin:"]) assert.match(spawnBurstBlock, new RegExp(field));
  const updateEffectsBlock = game.match(/\n  updateEffects\(dt\) \{([\s\S]*?)\n  \}\n\n  spawnBurst\(/)?.[1] || "";
  assert.match(updateEffectsBlock, /effect\.x \+= effect\.vx \* dt/);
  assert.match(updateEffectsBlock, /effect\.y \+= effect\.vy \* dt/);
  assert.match(updateEffectsBlock, /Math\.exp\(-dt \* effect\.drag\)/);
  assert.match(updateEffectsBlock, /effect\.angle \+= effect\.spin \* dt/);
  const effectRenderBlock = game.match(/\n  renderEffects\(ctx, behind\) \{([\s\S]*?)\n  \}\n\n  drawKeyframedSprite\(/)?.[1] || "";
  for (const key of ["comboFinisher", "parryCounter", "skillCore", "dashArrival", "executionBurst"]) {
    assert.match(effectRenderBlock, new RegExp(`"${key}"[\\s\\S]*?animation: "impactSnap10"`), `${key} is rendered through the ten-pose impact animation`);
  }
  assert.match(effectRenderBlock, /\["energySpark", "impactShard"\]\.includes\(effect\.type\)/);
  assert.match(effectRenderBlock, /animation: "sparkFlight10"/);
  assert.match(effectRenderBlock, /drawKeyframedSprite\(ctx, effect\.type, effect, effect\.radius/);
});

test("0.9.7 removes the added full-screen edge flashes and keeps the original light feedback", async () => {
  const game = await readFile(new URL("../src/game.js", import.meta.url), "utf8");
  const main = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const worker = await readFile(new URL("../sw.js", import.meta.url), "utf8");

  for (const retired of [
    "SCREEN_FLASH_PRESETS", "screenPulse10", "screenPulseReduced10", "screenFlash",
    "triggerScreenFlash", "updateScreenFlash", "renderScreenFlash", "screenOverlaySprites",
    "screen-success-overload.png", "screen-danger-fracture.png",
  ]) {
    assert.doesNotMatch(game, new RegExp(retired.replaceAll(".", "\\.")), `${retired} is removed from runtime code`);
  }
  assert.doesNotMatch(worker, /screen-(?:success-overload|danger-fracture)\.png/);
  assert.doesNotMatch(main, /screen-composites|screen-composite-warm|合成全屏反馈|提交全屏反馈/);
  assert.doesNotMatch(styles, /combat-overlay-reveal/);

  assert.match(game, /this\.flash = 0/);
  assert.match(game, /this\.flash = Math\.max\(0, this\.flash - dt \* 4\.5\)/);
  assert.match(game, /this\.flash = this\.settings\.reduceFlash \? 0\.1 : 0\.4/);
  assert.match(game, /this\.flash = this\.settings\.reduceFlash \? 0\.06 : 0\.22/);
  assert.match(game, /if \(this\.flash > 0\)[\s\S]*?rgba\(255,70,110,\$\{this\.flash\}\)[\s\S]*?ctx\.fillRect/);
  assert.match(html, /<b>减少闪光<\/b><small>降低受伤闪白和局部高亮强度<\/small>/);
  assert.match(main, /profile\.settings\.reduceFlash = event\.target\.checked;[\s\S]*?game\.applySettings\(profile\.settings\);[\s\S]*?saveProfile\(\);/);
});

test("runtime hit, dash, and skill rendering uses full-resolution prefiltered sprite caches", async () => {
  const game = await readFile(new URL("../src/game.js", import.meta.url), "utf8");
  const variantsBlock = game.match(/const FILTERED_SPRITE_VARIANTS\s*=\s*Object\.freeze\(\{([\s\S]*?)\n\}\);/)?.[1] || "";
  for (const variant of ["enemyHit", "playerSkill", "playerDash"]) assert.match(variantsBlock, new RegExp(`${variant}: Object\\.freeze`));
  for (const filter of ["brightness(2.1) saturate(.35)", "brightness(1.35) saturate(1.18)", "brightness(1.18)"]) {
    assert.match(variantsBlock, new RegExp(filter.replace(/[().]/g, "\\$&")));
  }
  assert.match(game, /this\.filteredSprites = \{ enemyHit: \{\}, playerSkill: \{\}, playerDash: \{\} \}/);
  assert.match(game, /this\.filteredSpriteState = \{ ready: false, prepared: 0, total: 0, failed: \[\] \}/);
  const prepareBlock = game.match(/\n  async prepareFilteredSprites\(\) \{([\s\S]*?)\n  \}\n\n  runFilteredSpriteWarmPass\(/)?.[1] || "";
  assert.match(prepareBlock, /surface\.width = image\.naturalWidth/);
  assert.match(prepareBlock, /surface\.height = image\.naturalHeight/);
  assert.match(prepareBlock, /context\.filter = filter/);
  assert.match(prepareBlock, /context\.drawImage\(image, 0, 0\)/);
  assert.match(prepareBlock, /createImageBitmap\(surface\)/);
  assert.match(prepareBlock, /this\.filteredSprites\[variant\]\[imageKey\] = filtered/);
  const warmFilteredBlock = game.match(/\n  async warmFilteredSprites\(\) \{([\s\S]*?)\n  \}\n\n  runVfxWarmPass\(/)?.[1] || "";
  assert.match(warmFilteredBlock, /await this\.runFilteredSpriteWarmPass\(\)/);
  assert.match(warmFilteredBlock, /await this\.waitForAnimationFrames\(3\)/);
  assert.match(warmFilteredBlock, /this\.filteredSpriteState\.ready = true/);
  const renderEnemyBlock = game.match(/\n  renderEnemy\(ctx, enemy, time\) \{([\s\S]*?)\n  \}\n\n  renderPlayer\(/)?.[1] || "";
  assert.match(renderEnemyBlock, /this\.filteredSprites\.enemyHit\[ENEMY_SPRITES\[enemy\.id\]\] \|\| sprite/);
  assert.doesNotMatch(renderEnemyBlock, /ctx\.filter/, "enemy hit flash never compiles a Canvas filter during combat");
  const drawPlayerBlock = game.match(/\n  drawPlayerBody\(ctx, time\) \{([\s\S]*?)\n  \}\n\n  drawTechBall\(/)?.[1] || "";
  assert.match(drawPlayerBlock, /this\.filteredSprites\.playerSkill\[key\] \|\| image/);
  assert.match(drawPlayerBlock, /this\.filteredSprites\.playerDash\[key\] \|\| image/);
  assert.match(drawPlayerBlock, /ctx\.drawImage\(renderedImage/);
  assert.doesNotMatch(drawPlayerBlock, /ctx\.filter/, "player dash and skill never compile a Canvas filter during combat");
});

test("arena floor, props, and boundary are rendered once into one DPR-aware static cache", async () => {
  const game = await readFile(new URL("../src/game.js", import.meta.url), "utf8");
  const main = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
  assert.match(game, /this\.patterns = new WeakMap\(\)/, "floor patterns are scoped to their Canvas contexts");
  assert.match(game, /const ARENA_CACHE_PADDING = 160/, "the world cache preserves boundary glow and shadow overflow");
  assert.match(game, /this\.arenaCache = \{ canvas: null, key: "", pendingKey: "", ready: false, promise: null, generation: 0 \}/);
  const keyBlock = game.match(/\n  getArenaCacheKey\([\s\S]*?\n  \}/)?.[0] || "";
  assert.match(keyBlock, /mode/);
  assert.match(keyBlock, /stageIndex/);
  assert.match(keyBlock, /this\.view\.dpr/);
  const staticBlock = game.match(/\n  drawArenaStatic\(ctx,[\s\S]*?\n  \}\n\n  getFloorPattern\(/)?.[0] || "";
  assert.match(staticBlock, /this\.getFloorPattern\(ctx, floorKey\)/);
  assert.match(staticBlock, /ctx\.fillRect\(0, 0, GAME\.width, GAME\.height\)/);
  assert.match(staticBlock, /for \(const decoration of this\.decorations\)/);
  for (const prop of ["pylon", "arenaVent", "terminal"]) assert.match(staticBlock, new RegExp(`this\\.drawWorldProp\\(ctx, "${prop}"`));
  assert.match(staticBlock, /this\.renderArenaBoundary\(ctx, palette\.border\)/);
  const prepareBlock = game.match(/\n  prepareArenaCache\([\s\S]*?\n  \}\n\n  renderArena\(/)?.[0] || "";
  assert.equal([...prepareBlock.matchAll(/document\.createElement\("canvas"\)/g)].length, 1, "each generation builds one replacement Canvas");
  assert.match(prepareBlock, /Math\.round\(\(GAME\.width \+ ARENA_CACHE_PADDING \* 2\) \* this\.view\.dpr\)/);
  assert.match(prepareBlock, /Math\.round\(\(GAME\.height \+ ARENA_CACHE_PADDING \* 2\) \* this\.view\.dpr\)/);
  assert.match(prepareBlock, /getContext\("2d", \{ alpha: true \}\)/);
  assert.match(prepareBlock, /context\.setTransform\(this\.view\.dpr, 0, 0, this\.view\.dpr, 0, 0\)/);
  assert.match(prepareBlock, /context\.translate\(ARENA_CACHE_PADDING, ARENA_CACHE_PADDING\)/);
  assert.match(prepareBlock, /this\.drawArenaStatic\(context, \{ mode, stageIndex \}\)/);
  assert.match(prepareBlock, /this\.arenaCache\.canvas = nextCanvas/);
  assert.match(prepareBlock, /previousCanvas\.width = 1[\s\S]*?previousCanvas\.height = 1/, "the swapped-out full-world Canvas releases its backing store");
  assert.match(prepareBlock, /await this\.runArenaCacheWarmPass\(nextCanvas\)/);
  assert.match(prepareBlock, /await this\.waitForAnimationFrames\(3\)/);
  assert.match(prepareBlock, /emitLoadProgress\("arena-cache", 0, 1\)/);
  assert.match(prepareBlock, /emitLoadProgress\("arena-cache", 1, 1\)/);
  const warmBlock = game.match(/\n  runArenaCacheWarmPass\(canvas\) \{([\s\S]*?)\n  \}\n\n  prepareArenaCache\(/)?.[1] || "";
  assert.match(warmBlock, /const context = this\.ctx/);
  assert.match(warmBlock, /context\.drawImage\(canvas/);
  assert.match(warmBlock, /requestAnimationFrame\(submit\)/);
  const renderBlock = game.match(/\n  renderArena\(ctx\) \{([\s\S]*?)\n  \}\n\n  drawArenaStatic\(/)?.[1] || "";
  assert.match(renderBlock, /this\.isArenaCacheReady\(mode, stageIndex\)/);
  assert.match(renderBlock, /ctx\.drawImage\([\s\S]*?this\.arenaCache\.canvas/);
  assert.match(renderBlock, /-ARENA_CACHE_PADDING, -ARENA_CACHE_PADDING/);
  assert.match(renderBlock, /GAME\.width \+ ARENA_CACHE_PADDING \* 2, GAME\.height \+ ARENA_CACHE_PADDING \* 2/);
  assert.match(renderBlock, /this\.drawArenaStatic\(ctx, \{ mode, stageIndex \}\)/, "an uncached frame retains the complete visual fallback");
  assert.doesNotMatch(renderBlock, /drawWorldProp|renderArenaBoundary|getFloorPattern/, "a ready arena does not redraw static world pieces every frame");
  const resizeBlock = game.match(/\n  resize\(\) \{([\s\S]*?)\n  \}\n\n  applySettings\(/)?.[1] || "";
  assert.match(resizeBlock, /this\.invalidateArenaCache\(\)/);
  assert.match(resizeBlock, /this\.arenaReady = this\.prepareArenaCache\(\)/);
  assert.match(game, /this\.state = "room";\s*this\.arenaReady = this\.prepareArenaCache\(\)/, "starting a run prepares the room cache");
  assert.match(game, /this\.state = "room";\s*this\.arenaReady = this\.prepareArenaCache\(\{ mode: "room", stageIndex: nextIndex \}\)/, "clearing a stage rebuilds the room cache");
  assert.match(game, /if \(!this\.isArenaCacheReady\("stage", stageIndex\)\) this\.arenaReady = this\.prepareArenaCache\(\{ mode: "stage", stageIndex \}\)/);
  const runBlock = main.match(/async function beginRun\(coreId\) \{([\s\S]*?)\n\}\n\nasync function beginPreparedStage/)?.[1] || "";
  const startIndex = runBlock.indexOf("game.start(coreId, profile.meta);");
  const roomCacheIndex = runBlock.indexOf("await game.arenaReady;");
  const hideIndex = runBlock.indexOf("hideLoadingScreen();");
  assert.ok(startIndex >= 0 && startIndex < roomCacheIndex && roomCacheIndex < hideIndex, "the room is revealed only after its full-world cache is submitted");
  const stageBlock = main.match(/async function beginPreparedStage\(\) \{([\s\S]*?)\n\}\n\nfunction returnToCity/)?.[1] || "";
  const showIndex = stageBlock.indexOf("showLoadingScreen");
  const prepareIndex = stageBlock.indexOf("await game.prepareArenaCache");
  const beginIndex = stageBlock.indexOf("game.beginStage()");
  const stageHideIndex = stageBlock.indexOf("hideLoadingScreen();");
  assert.ok(showIndex >= 0 && showIndex < prepareIndex && prepareIndex < beginIndex && beginIndex < stageHideIndex, "stage input remains blocked until the target arena cache is ready");
});

test("lightweight loading screen gates assets, VFX, filtered sprites, arena, and run audio without waiting for offline caching", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const main = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(html, /id="loading-screen" class="loading-screen is-active"[^>]*aria-live="polite"[^>]*aria-busy="true"/);
  assert.match(html, /id="loading-track"[^>]*role="progressbar"[^>]*aria-valuemin="0"[^>]*aria-valuemax="100"[^>]*aria-valuenow="0"/);
  for (const id of ["loading-fill", "loading-stage", "loading-percent"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(styles, /\.loading-screen\s*\{[\s\S]*?pointer-events:\s*none/);
  assert.match(styles, /\.loading-screen\.is-active\s*\{[\s\S]*?pointer-events:\s*auto/);
  assert.doesNotMatch(styles.match(/\.loading-screen\s*\{([\s\S]*?)\n\}/)?.[1] || "", /url\(|backdrop-filter/, "loading presentation stays CSS-only and lightweight");
  assert.match(main, /completed = Math\.min\(total, loaded \+ failedCount\)/, "failed assets still advance an exact completed/total counter");
  assert.match(main, /setLoadingStatus\(`读取战斗素材 \$\{completed\}\/\$\{total\}`/);
  for (const phase of ["sprite-filters", "sprite-warm", "vfx-source", "vfx-lighter", "vfx-screen", "arena-cache", "ready"]) assert.match(main, new RegExp(`phase === "${phase}"`));
  assert.match(main, /生成受击与动作材质 \$\{prepared\}\/\$\{phaseTotal\}/);
  assert.match(main, /setLoadingStatus\("提交角色材质"/);
  assert.match(main, /setLoadingStatus\("构建完整战区"/);
  assert.match(main, /function renderOfflineCacheProgress/);
  assert.match(main, /建立离线战斗缓存 \$\{completed\}\/\$\{offlineCacheState\.total\}/);
  assert.match(main, /event\.data\?\.type === "CACHE_PROGRESS"/);
  assert.doesNotMatch(main, /offlineCacheReady/, "offline installation must never become a startup or play gate");
  const windowReadyIndex = main.indexOf('const windowLoadReady = document.readyState === "complete"');
  const loadListenerIndex = main.indexOf('window.addEventListener("load", resolve, { once: true })', windowReadyIndex);
  const combinedReadyIndex = main.indexOf('void Promise.all([game.assetsReady, windowLoadReady]).then(() => {', loadListenerIndex);
  const registerIndex = main.indexOf('navigator.serviceWorker.register("./sw.js"', combinedReadyIndex);
  assert.ok(
    windowReadyIndex >= 0 && windowReadyIndex < loadListenerIndex
      && loadListenerIndex < combinedReadyIndex && combinedReadyIndex < registerIndex,
    "the service worker starts its four-worker background install only after window load and runtime assets are both ready",
  );
  assert.equal(main.indexOf('navigator.serviceWorker.register("./sw.js"'), registerIndex, "there is no competing eager registration");
  const initialReadyBlock = main.match(/game\.assetsReady\.then\(\(\) => \{([\s\S]*?)\n\}\);/)?.[1] || "";
  const initialHideIndex = initialReadyBlock.indexOf("hideLoadingScreen();");
  assert.ok(initialHideIndex >= 0, "the initial loader hides as soon as decoded assets, filtered sprites, and VFX warm passes are ready");
  assert.doesNotMatch(initialReadyBlock, /await/, "initial runtime readiness does not wait on background installation");
  const runBlock = main.match(/async function beginRun\(coreId\) \{([\s\S]*?)\n\}\n\nasync function beginPreparedStage/)?.[1] || "";
  const assetsIndex = runBlock.indexOf("await game.assetsReady;");
  const audioIndex = runBlock.indexOf("await audio.loadSamples();");
  const startIndex = runBlock.indexOf("game.start(coreId, profile.meta);");
  const arenaIndex = runBlock.indexOf("await game.arenaReady;");
  const hideIndex = runBlock.indexOf("hideLoadingScreen();");
  assert.doesNotMatch(runBlock, /offlineCache|serviceWorker/, "starting combat never waits for offline installation");
  assert.ok(
    assetsIndex >= 0 && assetsIndex < audioIndex && audioIndex < startIndex
      && startIndex < arenaIndex && arenaIndex < hideIndex,
    "a run cannot hide its loader before assets, VFX prewarm, combat samples, and room cache finish",
  );
  const hideBlock = main.match(/function hideLoadingScreen\(\) \{([\s\S]*?)\n\}/)?.[1] || "";
  assert.match(hideBlock, /setLoadingStatus\("战斗核心就绪", 100\)/);
  assert.match(hideBlock, /aria-busy", "false"/);
  assert.match(hideBlock, /classList\.remove\("is-active"\)/);
});

test("HTML exposes manifest and install metadata", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /rel="manifest"/);
  assert.match(html, /apple-touch-icon/);
  assert.match(html, /theme-color/);
  assert.match(html, /id="music-volume-input"/);
  assert.match(html, /id="room-screen"/);
  assert.match(html, /id="room-grid"/);
  assert.match(html, /id="room-start-button"/);
  assert.match(html, /NEON EMBERS \/\/ 0\.10\.2/);
  assert.doesNotMatch(html, /id="upgrade-screen"/);
  assert.doesNotMatch(html, /动作肉鸽/);
});

test("title screen keeps one enter-game action before the city hub", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const main = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const menu = html.match(/<section id="menu-screen"[\s\S]*?<\/section>/)?.[0] || "";

  assert.equal([...menu.matchAll(/<button\b/g)].length, 1, "the title screen contains exactly one button");
  assert.match(menu, /<button class="enter-game-button" id="start-button"[^>]*><span>进入游戏<\/span><\/button>/);
  assert.doesNotMatch(menu, /settings-button|meta-button|guide-button|profile-strip|feature-rail/);
  assert.match(main, /byId\("start-button"\)\.addEventListener\("click", \(\) => \{[\s\S]*?enterCity\(\);/, "entering always routes through the city hub");
  assert.doesNotMatch(main.match(/byId\("start-button"\)[\s\S]*?\n\}\);/)?.[0] || "", /beginRun|core-screen|guide-screen/, "the title cannot launch a mission flow directly");
  assert.match(styles, /\.title-lockup h1/);
  assert.match(styles, /\.enter-game-button/);
  assert.match(styles, /@keyframes title-enter/);
});

test("0.10.2 city hub keeps its original movement feel while using cached environment art", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const main = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
  const citySource = await readFile(new URL("../src/city.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const city = html.match(/<section id="city-screen"[\s\S]*?<section id="core-screen"/)?.[0] || "";

  assert.match(city, /id="city-canvas"[^>]*aria-label="可自由移动的余烬城中央广场"/);
  assert.match(city, /id="city-title">余烬城 · 中央广场/);
  for (const id of ["settings-button", "city-live-tutorial", "city-interaction", "city-interact-button", "city-joystick", "city-touch-interact", "city-touch-dash", "city-touch-attack"]) {
    assert.match(city, new RegExp(`id="${id}"`));
  }
  assert.doesNotMatch(city, /city-stations|city-station|city-mission-button|tutorial-next/, "the city is no longer a disguised card menu or slideshow");
  assert.match(html, /data-back="city-screen"[^>]*>← 返回城市/);
  assert.match(main, /function enterCity\([\s\S]*?showScreen\("city-screen"\);[\s\S]*?cityHub\.start\(\{ tutorial: promptTutorial && !profile\.guideSeen \}\);/);
  assert.match(main, /function finishCityTutorial\([\s\S]*?profile\.guideSeen = true;[\s\S]*?saveProfile\(\);/);
  assert.doesNotMatch(main.match(/function finishCityTutorial[\s\S]*?\n\}/)?.[0] || "", /beginRun|core-screen/, "finishing hands-on training remains in the city");
  assert.match(main, /if \(id === "mission"\) \{[\s\S]*?showScreen\("core-screen"\)/, "walking to and interacting with the mission terminal opens loadout selection");
  assert.match(main, /function returnToCity\([\s\S]*?enterCity\(\{ promptTutorial: false \}\);/);
  assert.match(citySource, /const BUILDINGS = Object\.freeze/);
  assert.match(citySource, /const FACILITIES = Object\.freeze/);
  assert.match(citySource, /const TUTORIAL_STEPS = Object\.freeze\(\[[\s\S]*?在城市中移动[\s\S]*?试一次闪避[\s\S]*?试一次攻击/);
  assert.match(citySource, /this\.keys\.has\("w"\)/);
  assert.match(citySource, /this\.setTouchVector|setTouchVector\(x, y\)/);
  assert.match(citySource, /this\.movePlayer\(dx \* distance, 0\)/);
  assert.match(citySource, /const blocked = BUILDINGS\.some/);
  assert.match(citySource, /requestDash\(\)/);
  assert.match(citySource, /requestAttack\(\)/);
  assert.match(citySource, /interact\(\)/);
  assert.match(citySource, /requestAnimationFrame\(\(time\) => this\.loop\(time\)\)/);
  for (const asset of [
    "outer-floor.png", "room-floor.png", "blockade-floor.png", "core-floor.png",
    "arena-barrier.png", "arena-pylon.png", "arena-vent.png", "energy-terminal.png",
    "hunter-core.png", "storm-core.png", "bastion-core.png", "shield-drone.png",
    "energy-sword.png", "rail-pistol.png", "power-hammer.png", "energy-core.png", "pulse-wave.png",
  ]) assert.match(citySource, new RegExp(asset.replaceAll(".", "\\.")), `city reuses ${asset}`);
  assert.match(citySource, /this\.staticScene = document\.createElement\("canvas"\)/, "the material-rich city scene is cached instead of rebuilding all props every frame");
  assert.match(citySource, /ctx\.drawImage\([\s\S]*?this\.staticScene,[\s\S]*?WORLD\.width, WORLD\.height/);
  assert.match(citySource, /const CITY_CACHE_MAX_DPR = 1/);
  assert.match(citySource, /const sceneDpr = Math\.min\(CITY_CACHE_MAX_DPR, this\.view\?\.dpr \|\| 1\)/, "the city cache is deliberately bounded so it cannot degrade movement response");
  assert.match(citySource, /this\.staticAssetsPending/);
  assert.match(citySource, /drawCityLoadingFallback/);
  for (const [constant, value] of [["PLAYER_SPEED", "250"], ["DASH_SPEED", "720"], ["DASH_DURATION", "0.18"], ["DASH_COOLDOWN", "1.05"]]) {
    assert.match(citySource, new RegExp(`const ${constant} = ${value.replace(".", "\\.")};`), `${constant} keeps the original city tuning`);
  }
  const playerRender = citySource.match(/\n  drawPlayer\(ctx\) \{([\s\S]*?)\n  \}\n\n  drawVignette/)?.[1] || "";
  assert.match(playerRender, /ctx\.drawImage\(this\.images\.player, -35, -35, 70, 70\)/, "the city player keeps its original readable footprint");
  assert.match(playerRender, /ctx\.arc\(0, 0, 58, base - 1\.3 \+ progress \* \.9, base \+ \.4 \+ progress \* \.9\)/, "the city attack keeps its short original feedback arc");
  assert.doesNotMatch(playerRender, /dashStreak|bladeHit|images\.sword/, "battle-material overlays cannot alter city movement perception");
  assert.match(citySource, /getPattern\(ctx, imageKey\)/);
  assert.match(citySource, /const CITY_NPCS = Object\.freeze/);
  assert.match(citySource, /const WORKSHOP_DISPLAYS = Object\.freeze/);
  assert.match(styles, /\.city-canvas\s*\{[\s\S]*?width:\s*100%;[\s\S]*?height:\s*100%/);
  assert.match(styles, /\.city-touch-controls\s*\{/);
});

test("audio engine includes battle music lifecycle", async () => {
  const source = await readFile(new URL("../src/audio.js", import.meta.url), "utf8");
  for (const method of ["noiseSweep(", "loadSamples()", "playSample(", "startMusic()", "pauseMusic()", "resumeMusic()", "stopMusic()", "scheduleMusicStep("]) {
    assert.match(source, new RegExp(method.replace(/[()]/g, "\\$&")));
  }
});

test("CC0 combat samples and license metadata are present", async () => {
  for (const asset of ["swing-whoosh-1.wav", "swing-whoosh-2.wav", "bullet-impact.wav", "body-hit-1.ogg", "body-hit-2.ogg", "body-hit-3.ogg", "heavy-hit-1.ogg", "heavy-hit-2.ogg", "metal-block-1.ogg", "metal-block-2.ogg", "mechanism-1.ogg", "mechanism-2.ogg", "LICENSE.md"]) {
    await access(new URL(`../assets/audio/${asset}`, import.meta.url));
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { CORES, ENEMIES, GAME, META_UPGRADES, MISSION_STAGES, ROOM_ITEMS, SKILLS, WEAPONS, metaCost } from "../src/config.js";

test("action slice exposes distinct sphere loadouts and weapons", () => {
  assert.equal(Object.keys(CORES).length, 3);
  assert.equal(Object.keys(WEAPONS).length, 6);
  assert.ok(Object.keys(ENEMIES).length >= 8);
  assert.ok(META_UPGRADES.length >= 3);
  for (const core of Object.values(CORES)) {
    assert.equal(WEAPONS[core.weapon].combo.length, 3);
    assert.ok(WEAPONS[core.weapon].asset);
    assert.ok(WEAPONS[core.weapon].render?.size > 0);
    assert.ok(WEAPONS[core.weapon].collision?.length > 0);
    assert.ok(WEAPONS[core.weapon].collision?.thickness > 0);
    assert.equal(SKILLS[core.skill]?.id, core.skill);
    assert.ok(SKILLS[core.skill].cooldown > 0);
    assert.ok(core.bodyAsset?.startsWith("assets/players/"));
  }
  assert.equal(WEAPONS.rail.ammo, 6);
  assert.deepEqual(Object.keys(SKILLS), ["pulseSlash", "overdrive", "barrier"]);
});

test("progression requirements increase monotonically", () => {
  for (const upgrade of META_UPGRADES) {
    assert.ok(metaCost(upgrade, 1) > metaCost(upgrade, 0));
  }
});

test("mission uses finite clear-to-advance stages", () => {
  assert.equal(MISSION_STAGES.length, 3);
  assert.ok(GAME.maxEnemies <= 32);
  assert.deepEqual(MISSION_STAGES.map((stage) => stage.id), ["1-1", "1-2", "1-B"]);
  for (const stage of MISSION_STAGES) {
    assert.ok(stage.enemies.length > 0);
    assert.ok(stage.enemies.every((id) => ENEMIES[id]));
    assert.ok(stage.maxActive > 0 && stage.maxActive <= GAME.maxEnemies);
    assert.ok(stage.spawnDelay > 0);
  }
  assert.equal(MISSION_STAGES.at(-1).boss, true);
  assert.deepEqual(MISSION_STAGES.at(-1).enemies, ["boss"]);
});

test("later stages introduce new enemy roles without random pools", () => {
  const openingRoles = new Set(MISSION_STAGES[0].enemies);
  const mixedRoles = new Set(MISSION_STAGES[1].enemies);
  assert.deepEqual([...openingRoles].sort(), ["chaser", "skitter"]);
  assert.ok(mixedRoles.size > openingRoles.size);
  assert.ok(mixedRoles.has("elite"));
  assert.ok(Object.isFrozen(MISSION_STAGES[0].enemies));
});

test("preparation room sells a fixed non-random item list", () => {
  assert.deepEqual(ROOM_ITEMS.map((item) => item.id), ["repair", "ammo", "stamina", "barrier"]);
  assert.ok(ROOM_ITEMS.every((item) => item.cost > 0 && item.name && item.description));
  assert.ok(Object.isFrozen(ROOM_ITEMS));
  assert.ok(ROOM_ITEMS.every((item) => Object.isFrozen(item)));
});

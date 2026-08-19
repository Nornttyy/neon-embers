export const GAME = Object.freeze({
  width: 2200,
  height: 1400,
  playerRadius: 23,
  playerSpeed: 235,
  dashSpeed: 760,
  dashDuration: 0.17,
  dashCooldown: 1.15,
  maxEnemies: 32,
});

export const WEAPONS = Object.freeze({
  blade: {
    id: "blade", name: "弧光剑", color: "#4df6ff", asset: "assets/items/energy-sword.png",
    render: { size: 108, anchorX: 0.17, anchorY: 0.8, rotation: 0.78 },
    collision: { length: 112, thickness: 8 },
    description: "均衡的三段近战连击，第三击范围更大。",
    combo: [
      { duration: 0.3, activeStart: 0.1, activeEnd: 0.19, damage: 26, range: 92, arc: 1.7, knockback: 85 },
      { duration: 0.33, activeStart: 0.11, activeEnd: 0.21, damage: 31, range: 98, arc: 1.85, knockback: 105 },
      { duration: 0.46, activeStart: 0.17, activeEnd: 0.29, damage: 45, range: 112, arc: 2.3, knockback: 180 },
    ],
  },
  twin: {
    id: "twin", name: "相位双刃", color: "#c77dff", asset: "assets/items/phase-blade.png",
    render: { size: 94, anchorX: 0.14, anchorY: 0.83, rotation: 0.78 },
    collision: { length: 96, thickness: 7 },
    description: "连击速度快，攻击时产生小幅位移。",
    combo: [
      { duration: 0.22, activeStart: 0.07, activeEnd: 0.14, damage: 19, range: 78, arc: 1.9, knockback: 55, lunge: 20 },
      { duration: 0.23, activeStart: 0.07, activeEnd: 0.15, damage: 21, range: 82, arc: 2, knockback: 65, lunge: 24 },
      { duration: 0.34, activeStart: 0.1, activeEnd: 0.23, damage: 34, range: 91, arc: 2.65, knockback: 120, lunge: 35 },
    ],
  },
  hammer: {
    id: "hammer", name: "动力锤", color: "#ffcc66", asset: "assets/items/power-hammer.png",
    render: { size: 112, anchorX: 0.08, anchorY: 0.9, rotation: 0.78 },
    collision: { length: 94, thickness: 11, headRadius: 21 },
    description: "前摇较长，拥有很强的削韧与击退。",
    combo: [
      { duration: 0.48, activeStart: 0.2, activeEnd: 0.3, damage: 40, range: 96, arc: 1.55, knockback: 190 },
      { duration: 0.52, activeStart: 0.22, activeEnd: 0.34, damage: 48, range: 101, arc: 1.75, knockback: 230 },
      { duration: 0.72, activeStart: 0.32, activeEnd: 0.47, damage: 70, range: 124, arc: 2.8, knockback: 340 },
    ],
  },
  rail: {
    id: "rail", name: "轨道手枪", color: "#b77dff", asset: "assets/items/rail-pistol.png",
    description: "六发弹匣的高精度远程副武器。", cooldown: 0.28, damage: 25, speed: 920, ammo: 6,
  },
  bow: { id: "bow", name: "能量弓", color: "#6fffc1", description: "后续版本加入的蓄力穿透武器。" },
  shotgun: { id: "shotgun", name: "磁轨霰弹枪", color: "#ff8a55", description: "后续版本加入的近距离远程武器。" },
});

export const CORES = Object.freeze({
  hunter: {
    id: "hunter", name: "剑锋球体", subtitle: "均衡 · 反击",
    description: "装备弧光剑。主动技能释放环形脉冲斩。", color: "#4df6ff",
    weapon: "blade", skill: "pulseSlash", asset: "assets/items/energy-sword.png", bodyAsset: "assets/players/hunter-core.png", bonuses: { speed: 0.04 },
  },
  storm: {
    id: "storm", name: "相位球体", subtitle: "高速 · 连击",
    description: "装备相位双刃。主动技能进入短时超频。", color: "#b77dff",
    weapon: "twin", skill: "overdrive", asset: "assets/items/phase-twin-blades.png", bodyAsset: "assets/players/storm-core.png", bonuses: { stamina: 12 },
  },
  bastion: {
    id: "bastion", name: "壁垒球体", subtitle: "重击 · 防御",
    description: "装备动力锤。主动技能生成应急护盾。", color: "#ffcc66",
    weapon: "hammer", skill: "barrier", asset: "assets/items/power-hammer.png", bodyAsset: "assets/players/bastion-core.png", bonuses: { health: 24 },
  },
});

export const ENEMIES = Object.freeze({
  chaser: { id: "chaser", name: "切割体", color: "#ff4f8b", radius: 17, hp: 64, speed: 105, damage: 18, energy: 5, reach: 56, windup: 0.48 },
  skitter: { id: "skitter", name: "疾行体", color: "#ff7b72", radius: 13, hp: 39, speed: 148, damage: 13, energy: 4, reach: 48, windup: 0.36 },
  shooter: { id: "shooter", name: "游弋枪体", color: "#ffb454", radius: 18, hp: 72, speed: 74, damage: 14, energy: 7, ranged: true },
  brute: { id: "brute", name: "破阵体", color: "#ff653f", radius: 25, hp: 155, speed: 67, damage: 29, energy: 12, reach: 74, windup: 0.72, heavy: true },
  sentinel: { id: "sentinel", name: "屏障体", color: "#d35cff", radius: 22, hp: 118, speed: 62, damage: 17, energy: 10, ranged: true, shielded: true },
  lancer: { id: "lancer", name: "突进体", color: "#ff3ebf", radius: 19, hp: 94, speed: 84, damage: 24, energy: 9, reach: 68, windup: 0.58, lunge: true },
  elite: { id: "elite", name: "精英处刑机", color: "#fff06a", radius: 31, hp: 520, speed: 88, damage: 32, energy: 30, reach: 84, windup: 0.68, heavy: true, elite: true },
  boss: { id: "boss", name: "零号执行体", color: "#ff2e67", radius: 58, hp: 2900, speed: 57, damage: 38, energy: 100, reach: 118, windup: 0.82, heavy: true, ranged: true, boss: true },
});

export const MISSION_STAGES = Object.freeze([
  Object.freeze({
    id: "1-1",
    name: "外围突破",
    subtitle: "清除切割体与疾行体",
    enemies: Object.freeze(["chaser", "skitter", "chaser", "skitter", "chaser", "chaser", "skitter", "chaser"]),
    spawnDelay: 0.72,
    maxActive: 4,
  }),
  Object.freeze({
    id: "1-2",
    name: "火力封锁",
    subtitle: "突破远程、护盾与重装组合",
    enemies: Object.freeze(["shooter", "chaser", "brute", "shooter", "skitter", "sentinel", "lancer", "brute", "shooter", "elite"]),
    spawnDelay: 0.84,
    maxActive: 4,
  }),
  Object.freeze({
    id: "1-B",
    name: "核心决战",
    subtitle: "击败零号执行体",
    enemies: Object.freeze(["boss"]),
    spawnDelay: 1.1,
    maxActive: 1,
    boss: true,
  }),
]);

export const ROOM_ITEMS = Object.freeze([
  Object.freeze({ id: "repair", code: "HP", name: "装甲修复包", description: "立即恢复 35 点生命。", cost: 18, amount: 35 }),
  Object.freeze({ id: "ammo", code: "AM", name: "轨道弹匣", description: "立即补满轨道手枪弹药。", cost: 10 }),
  Object.freeze({ id: "stamina", code: "ST", name: "动能电池", description: "立即补满格挡与闪避体力。", cost: 12 }),
  Object.freeze({ id: "barrier", code: "SH", name: "应急护盾", description: "获得 40 点临时护盾，上限 80。", cost: 22, amount: 40 }),
]);

export const META_UPGRADES = Object.freeze([
  { id: "power", name: "初始校准", description: "单机与合作模式基础伤害 +4%", max: 5, baseCost: 45 },
  { id: "armor", name: "备用装甲", description: "单机与合作模式初始生命 +8", max: 5, baseCost: 40 },
  { id: "recovery", name: "回收协议", description: "核心能源结算 +6%", max: 5, baseCost: 55 },
]);

export function metaCost(definition, currentLevel) {
  return Math.round(definition.baseCost * (1 + currentLevel * 0.72));
}

export function weightedSample(items, random = Math.random) {
  const total = items.reduce((sum, item) => sum + (item.weight ?? 1), 0);
  let roll = random() * total;
  for (const item of items) {
    roll -= item.weight ?? 1;
    if (roll <= 0) return item;
  }
  return items.at(-1);
}

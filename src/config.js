export const GAME = Object.freeze({
  width: 2200,
  height: 1400,
  runDuration: 180,
  bossTime: 150,
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
    weapon: "blade", skill: "pulseSlash", asset: "assets/items/energy-sword.png", bonuses: { speed: 0.04 },
  },
  storm: {
    id: "storm", name: "相位球体", subtitle: "高速 · 连击",
    description: "装备相位双刃。主动技能进入短时超频。", color: "#b77dff",
    weapon: "twin", skill: "overdrive", asset: "assets/items/phase-twin-blades.png", bonuses: { stamina: 12 },
  },
  bastion: {
    id: "bastion", name: "壁垒球体", subtitle: "重击 · 防御",
    description: "装备动力锤。主动技能生成应急护盾。", color: "#ffcc66",
    weapon: "hammer", skill: "barrier", asset: "assets/items/power-hammer.png", bonuses: { health: 24 },
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

export const UPGRADES = Object.freeze([
  { id: "blade_power", name: "锋刃增压", rarity: "common", max: 5, description: "近战伤害 +18%。", stat: "meleeDamage", amount: 0.18, cost: 22, asset: "assets/items/energy-sword.png" },
  { id: "blade_reach", name: "广域挥击", rarity: "common", max: 3, description: "挥击角度 +8%，武器尺寸不变。", stat: "swingArc", amount: 0.08, cost: 20, asset: "assets/items/energy-sword.png" },
  { id: "blade_speed", name: "动作超频", rarity: "rare", max: 3, description: "近战动作速度 +10%。", stat: "attackSpeed", amount: 0.1, cost: 28 },
  { id: "rail_power", name: "轨道增幅器", rarity: "common", max: 5, description: "轨道手枪伤害 +20%。", stat: "rangedDamage", amount: 0.2, cost: 22, asset: "assets/items/rail-pistol.png" },
  { id: "rail_mag", name: "扩展弹匣", rarity: "rare", max: 3, description: "弹匣容量 +2，并立即装满。", stat: "ammo", amount: 2, cost: 27, asset: "assets/items/rail-pistol.png" },
  { id: "rail_haste", name: "快速装填", rarity: "common", max: 3, description: "装填时间 -15%。", stat: "reload", amount: 0.15, cost: 20, asset: "assets/items/rail-pistol.png" },
  { id: "stamina", name: "高密度电容", rarity: "common", max: 4, description: "最大体力 +18，并恢复体力。", stat: "stamina", amount: 18, cost: 21, asset: "assets/items/energy-core.png" },
  { id: "stamina_regen", name: "回流总线", rarity: "common", max: 4, description: "体力恢复速度 +16%。", stat: "staminaRegen", amount: 0.16, cost: 21, asset: "assets/items/energy-core.png" },
  { id: "dash", name: "折跃回路", rarity: "rare", max: 3, description: "闪避冷却 -14%。", stat: "dashCooldown", amount: 0.14, cost: 27 },
  { id: "guard", name: "定向屏障", rarity: "common", max: 3, description: "格挡消耗 -15%。", stat: "guardEfficiency", amount: 0.15, cost: 22 },
  { id: "parry", name: "预判模块", rarity: "epic", max: 2, description: "精准招架窗口 +35 毫秒。", stat: "parryWindow", amount: 0.035, cost: 34 },
  { id: "skill", name: "技能冷却器", rarity: "rare", max: 3, description: "主动技能冷却 -12%。", stat: "skillCooldown", amount: 0.12, cost: 29, asset: "assets/items/energy-core.png" },
  { id: "health", name: "再生装甲", rarity: "common", max: 4, description: "最大生命 +22，并恢复 22。", stat: "health", amount: 22, cost: 22 },
  { id: "speed", name: "矢量推进", rarity: "common", max: 4, description: "移动速度 +7%。", stat: "speed", amount: 0.07, cost: 20 },
  { id: "repair", name: "战地维修", rarity: "rare", max: 4, description: "立即恢复 35 点生命。", stat: "repair", amount: 35, cost: 18 },
  { id: "energy", name: "回收磁场", rarity: "rare", max: 3, description: "能源获取量 +15%。", stat: "energyGain", amount: 0.15, cost: 25, asset: "assets/items/energy-core.png" },
]);

export const META_UPGRADES = Object.freeze([
  { id: "power", name: "初始校准", description: "单机与合作模式基础伤害 +4%", max: 5, baseCost: 45 },
  { id: "armor", name: "备用装甲", description: "单机与合作模式初始生命 +8", max: 5, baseCost: 40 },
  { id: "recovery", name: "回收协议", description: "核心能源结算 +6%", max: 5, baseCost: 55 },
]);

export function getWaveProfile(elapsed) {
  if (elapsed < 30) return { rate: 2.45, pool: ["chaser", "skitter"] };
  if (elapsed < 70) return { rate: 1.95, pool: ["chaser", "skitter", "shooter"] };
  if (elapsed < 115) return { rate: 1.58, pool: ["chaser", "skitter", "shooter", "brute"] };
  if (elapsed < GAME.bossTime) return { rate: 1.28, pool: ["skitter", "shooter", "brute", "sentinel", "lancer"] };
  return { rate: 1.55, pool: ["chaser", "shooter", "lancer"] };
}

export function xpForLevel(level) {
  return Math.round(28 + level * 14 + Math.pow(level, 1.25) * 3);
}

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

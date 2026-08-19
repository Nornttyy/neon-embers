export const GAME = Object.freeze({
  width: 2400,
  height: 1600,
  runDuration: 360,
  bossTime: 330,
  playerRadius: 18,
  playerSpeed: 250,
  dashSpeed: 780,
  dashDuration: 0.16,
  dashCooldown: 3.2,
  maxEnemies: 150,
});

export const CORES = Object.freeze({
  hunter: {
    id: "hunter",
    name: "猎光核心",
    subtitle: "稳定 · 精确",
    description: "以强化脉冲针开局，移动速度 +8%。",
    color: "#4df6ff",
    weapon: "pulse",
    bonuses: { speed: 0.08 },
  },
  storm: {
    id: "storm",
    name: "雷暴核心",
    subtitle: "连锁 · 清群",
    description: "以链式电弧开局，技能冷却 -6%。",
    color: "#b77dff",
    weapon: "arc",
    bonuses: { cooldown: 0.06 },
  },
  bastion: {
    id: "bastion",
    name: "壁垒核心",
    subtitle: "近战 · 生存",
    description: "以环轨刃开局，最大生命 +20。",
    color: "#ffcc66",
    weapon: "orbit",
    bonuses: { health: 20 },
  },
});

export const WEAPONS = Object.freeze({
  pulse: {
    id: "pulse",
    name: "脉冲针",
    color: "#4df6ff",
    description: "高速追踪最近目标，可升级为多重穿透射击。",
    cooldown: 0.48,
    damage: 22,
    speed: 720,
    range: 760,
  },
  orbit: {
    id: "orbit",
    name: "环轨刃",
    color: "#ffcc66",
    description: "围绕核心切割近身敌人，提供稳定防线。",
    cooldown: 0.28,
    damage: 15,
    radius: 82,
  },
  arc: {
    id: "arc",
    name: "链式电弧",
    color: "#b77dff",
    description: "电流在密集敌群中连续跳跃。",
    cooldown: 1.18,
    damage: 25,
    range: 510,
    chains: 3,
  },
  beam: {
    id: "beam",
    name: "棱镜光束",
    color: "#6fffc1",
    description: "锁定最近目标，以短促光束持续灼烧。",
    cooldown: 1.4,
    damage: 40,
    range: 620,
  },
  grenade: {
    id: "grenade",
    name: "裂变榴弹",
    color: "#ff8a55",
    description: "抛出慢速能量体，爆炸清理聚集目标。",
    cooldown: 1.65,
    damage: 52,
    speed: 330,
    range: 580,
    blast: 92,
  },
  drone: {
    id: "drone",
    name: "守卫无人机",
    color: "#ff72d6",
    description: "独立环绕并自动发射微型脉冲。",
    cooldown: 0.72,
    damage: 12,
    range: 540,
  },
});

export const ENEMIES = Object.freeze({
  hunter: { id: "hunter", name: "追猎者", color: "#ff4f8b", radius: 15, hp: 34, speed: 105, damage: 11, xp: 5 },
  skitter: { id: "skitter", name: "疾行体", color: "#ff7b72", radius: 11, hp: 20, speed: 160, damage: 8, xp: 4 },
  shooter: { id: "shooter", name: "游弋者", color: "#ffb454", radius: 17, hp: 48, speed: 76, damage: 10, xp: 7, ranged: true },
  charger: { id: "charger", name: "冲锋者", color: "#ff5a36", radius: 20, hp: 75, speed: 72, damage: 18, xp: 10, charger: true },
  splitter: { id: "splitter", name: "分裂体", color: "#d35cff", radius: 21, hp: 68, speed: 82, damage: 12, xp: 9, splitter: true },
  jammer: { id: "jammer", name: "干扰者", color: "#ff3ebf", radius: 19, hp: 92, speed: 62, damage: 13, xp: 12, jammer: true },
  eliteHunter: { id: "eliteHunter", name: "精英追猎者", color: "#fff06a", radius: 27, hp: 320, speed: 112, damage: 22, xp: 50, elite: true },
  eliteShooter: { id: "eliteShooter", name: "精英游弋者", color: "#ffcf5a", radius: 29, hp: 390, speed: 66, damage: 19, xp: 58, ranged: true, elite: true },
  boss: { id: "boss", name: "零号收割机", color: "#ff2e67", radius: 58, hp: 3600, speed: 58, damage: 28, xp: 300, boss: true, ranged: true, charger: true },
});

export const UPGRADES = Object.freeze([
  { id: "pulse_unlock", weapon: "pulse", name: "脉冲协议", rarity: "rare", max: 1, description: "解锁脉冲针。", unlock: true },
  { id: "pulse_power", weapon: "pulse", name: "锐化脉冲", rarity: "common", max: 5, description: "脉冲针伤害 +22%。", stat: "damage", amount: 0.22 },
  { id: "pulse_twin", weapon: "pulse", name: "并行针列", rarity: "rare", max: 3, description: "脉冲针额外发射 1 枚。", stat: "count", amount: 1 },
  { id: "pulse_pierce", weapon: "pulse", name: "相位穿透", rarity: "rare", max: 3, description: "脉冲针额外穿透 1 个目标。", stat: "pierce", amount: 1 },
  { id: "orbit_unlock", weapon: "orbit", name: "环轨协议", rarity: "rare", max: 1, description: "解锁环轨刃。", unlock: true },
  { id: "orbit_count", weapon: "orbit", name: "复列刀环", rarity: "rare", max: 4, description: "增加 1 枚环轨刃。", stat: "count", amount: 1 },
  { id: "orbit_power", weapon: "orbit", name: "切割增幅", rarity: "common", max: 5, description: "环轨刃伤害 +24%。", stat: "damage", amount: 0.24 },
  { id: "orbit_radius", weapon: "orbit", name: "扩张轨道", rarity: "common", max: 3, description: "环轨半径和刃体尺寸提升。", stat: "radius", amount: 0.13 },
  { id: "arc_unlock", weapon: "arc", name: "雷暴协议", rarity: "rare", max: 1, description: "解锁链式电弧。", unlock: true },
  { id: "arc_chain", weapon: "arc", name: "电弧分叉", rarity: "rare", max: 4, description: "电弧额外跳跃 1 次。", stat: "chains", amount: 1 },
  { id: "arc_power", weapon: "arc", name: "过载电容", rarity: "common", max: 5, description: "电弧伤害 +25%。", stat: "damage", amount: 0.25 },
  { id: "arc_reach", weapon: "arc", name: "导电空气", rarity: "common", max: 3, description: "电弧搜索距离 +16%。", stat: "range", amount: 0.16 },
  { id: "beam_unlock", weapon: "beam", name: "棱镜协议", rarity: "rare", max: 1, description: "解锁棱镜光束。", unlock: true },
  { id: "beam_power", weapon: "beam", name: "聚焦晶格", rarity: "common", max: 5, description: "光束伤害 +24%。", stat: "damage", amount: 0.24 },
  { id: "beam_split", weapon: "beam", name: "折射镜组", rarity: "epic", max: 2, description: "光束额外锁定 1 个目标。", stat: "count", amount: 1 },
  { id: "beam_haste", weapon: "beam", name: "快速校准", rarity: "rare", max: 3, description: "光束冷却 -14%。", stat: "cooldown", amount: 0.14 },
  { id: "grenade_unlock", weapon: "grenade", name: "裂变协议", rarity: "rare", max: 1, description: "解锁裂变榴弹。", unlock: true },
  { id: "grenade_blast", weapon: "grenade", name: "膨胀核心", rarity: "common", max: 4, description: "爆炸范围 +18%。", stat: "blast", amount: 0.18 },
  { id: "grenade_power", weapon: "grenade", name: "高能装药", rarity: "common", max: 5, description: "榴弹伤害 +26%。", stat: "damage", amount: 0.26 },
  { id: "grenade_cluster", weapon: "grenade", name: "子母裂变", rarity: "epic", max: 2, description: "爆炸产生额外小型爆破。", stat: "cluster", amount: 1 },
  { id: "drone_unlock", weapon: "drone", name: "守卫协议", rarity: "rare", max: 1, description: "解锁守卫无人机。", unlock: true },
  { id: "drone_count", weapon: "drone", name: "蜂群节点", rarity: "rare", max: 3, description: "增加 1 架守卫无人机。", stat: "count", amount: 1 },
  { id: "drone_power", weapon: "drone", name: "火控升级", rarity: "common", max: 5, description: "无人机伤害 +22%。", stat: "damage", amount: 0.22 },
  { id: "drone_haste", weapon: "drone", name: "协同链路", rarity: "rare", max: 3, description: "无人机射速 +16%。", stat: "cooldown", amount: 0.16 },
  { id: "move_speed", name: "矢量推进", rarity: "common", max: 5, description: "移动速度 +8%。", global: "speed", amount: 0.08 },
  { id: "max_health", name: "再生装甲", rarity: "common", max: 5, description: "最大生命 +20，并恢复 20。", global: "health", amount: 20 },
  { id: "magnet", name: "回收磁场", rarity: "common", max: 4, description: "拾取范围 +24%。", global: "magnet", amount: 0.24 },
  { id: "cooldown", name: "超频总线", rarity: "rare", max: 5, description: "所有武器冷却 -6%。", global: "cooldown", amount: 0.06 },
  { id: "critical", name: "弱点解析", rarity: "rare", max: 5, description: "暴击概率 +7%。", global: "crit", amount: 0.07 },
  { id: "shield", name: "自愈护盾", rarity: "rare", max: 4, description: "获得 18 点护盾容量。", global: "shield", amount: 18 },
  { id: "dash", name: "折跃回路", rarity: "rare", max: 3, description: "闪避冷却 -14%。", global: "dash", amount: 0.14 },
]);

export const META_UPGRADES = Object.freeze([
  { id: "power", name: "初始校准", description: "基础伤害永久 +4%", max: 5, baseCost: 45 },
  { id: "armor", name: "备用装甲", description: "初始生命永久 +8", max: 5, baseCost: 40 },
  { id: "recovery", name: "回收协议", description: "每局获得零件 +6%", max: 5, baseCost: 55 },
]);

export function getWaveProfile(elapsed) {
  if (elapsed < 45) return { rate: 1.0, pool: ["hunter", "skitter"] };
  if (elapsed < 105) return { rate: 0.76, pool: ["hunter", "skitter", "shooter"] };
  if (elapsed < 175) return { rate: 0.58, pool: ["hunter", "shooter", "charger", "splitter"] };
  if (elapsed < 250) return { rate: 0.42, pool: ["skitter", "shooter", "charger", "splitter", "jammer"] };
  return { rate: 0.3, pool: ["hunter", "skitter", "shooter", "charger", "splitter", "jammer"] };
}

export function xpForLevel(level) {
  return Math.round(14 + level * 7 + Math.pow(level, 1.42) * 2.3);
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

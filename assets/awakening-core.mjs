// Season 6 Awakening math. Kept independent of EW upgrade shards.
export const AWAKENING_HEROES = Object.freeze([
  { id: 'kim', week: 1, skill: 'Priceless Resolve', guide: 'https://cpt-hedge.com/guides/season-6-kim-awakening', summary: 'Energy barrages and Energy Amplification synergy.', bonuses: ['Starts battle in Resolve state', '20% extra damage', 'Gains 2 Energy Amplification stacks when skill activates', '40% extra damage', 'One extra barrage per Energy Amplification stack'] },
  { id: 'dva', week: 3, skill: 'Starred Ace', guide: 'https://cpt-hedge.com/guides/season-6-dva-awakening', summary: 'Airborne follow-up attacks. Ace Boost scales with Aircraft heroes.', bonuses: ['Ace Boost gives 10% more Attack Speed per stack', 'Follow-up attacks deal 20% extra damage', 'Ace Boost gives 5% Attack per stack', 'Follow-up attacks deal 40% extra damage', 'Airborne duration increases by 1 second'] },
  { id: 'tesla', week: 5, skill: 'Vortex Resonance', guide: 'https://cpt-hedge.com/guides/season-6-tesla-awakening', summary: 'Chain-lightning bounces and Inductive Current stacks.', bonuses: ['Each bounce adds 2 Inductive Current stacks', '20% additional damage', 'One extra chain-lightning bounce', '40% additional damage', 'One extra chain-lightning bounce'] }
]);
export const STAR_TIERS = Object.freeze([4, 5, 5, 5, 5]);
export const TIER_COSTS = Object.freeze([20, 40, 70, 80, 100]);
export const STAR_MILESTONES = Object.freeze([0, 4, 9, 14, 19, 24]);
export function clampInteger(value, min, max) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : min;
}
export function awakeningStars(progress) {
  if (progress < 0) return -1;
  let stars = 0;
  for (const milestone of STAR_MILESTONES.slice(1)) if (progress >= milestone) stars++;
  return stars;
}
export function awakeningLabel(progress) {
  if (progress < 0) return 'Not awakened';
  if (progress === 24) return '5★ complete';
  const stars = awakeningStars(progress);
  const base = STAR_MILESTONES[stars];
  return stars + '★ · Tier ' + (progress - base) + '/' + STAR_TIERS[stars];
}
export function shardsSpent(progress) {
  if (progress < 0) return 0;
  let amount = 50;
  for (let step = 1; step <= Math.min(24, progress); step++) {
    const star = STAR_MILESTONES.slice(1).findIndex(milestone => step <= milestone);
    amount += TIER_COSTS[star];
  }
  return amount;
}
export function awakeningCost(current, target) {
  const from = clampInteger(current, -1, 24);
  const to = Math.max(from, clampInteger(target, 0, 24));
  const unlockNamed = from < 0 ? 50 : 0;
  const tierShards = shardsSpent(to) - shardsSpent(Math.max(0, from));
  return { unlockNamed, tierShards, total: unlockNamed + tierShards };
}
export function nextAwakeningTarget(progress) {
  if (progress < 0) return 0;
  return STAR_MILESTONES.slice(1).find(milestone => milestone > progress) ?? 24;
}
export function awakeningBudget(current, target, named, universal) {
  const costs = awakeningCost(current, target);
  const n = clampInteger(named, 0, 999999);
  const u = clampInteger(universal, 0, 999999);
  const unlockGap = Math.max(0, costs.unlockNamed - n);
  const namedAfterUnlock = Math.max(0, n - costs.unlockNamed);
  const tierGap = Math.max(0, costs.tierShards - namedAfterUnlock - u);
  return { ...costs, unlockGap, tierGap, readyMaterials: unlockGap === 0 && tierGap === 0 };
}

import {AWAKENING_HEROES, STAR_MILESTONES, STAR_TIERS, awakeningStars, awakeningLabel, awakeningCost, awakeningBudget, nextAwakeningTarget, clampInteger} from './awakening-core.mjs';

// The legacy EW page owns the single saved profile. This module only reads and
// updates its shared state, so formation, EW levels and imports keep working.
const stageOptions = [
  {value:0,label:'Unlock Awakening (0★)'},
  {value:4,label:'Reach 1★'},
  {value:9,label:'Reach 2★'},
  {value:14,label:'Reach 3★'},
  {value:19,label:'Reach 4★'},
  {value:24,label:'Reach 5★'}
];
const heroNames = Object.fromEntries(AWAKENING_HEROES.map(h => [h.id,h]));
const byId = id => document.getElementById(id);
const nums = n => new Intl.NumberFormat('en-CA').format(n);
const isAvailable = h => state.season >= 6 && state.awakeningWeek >= h.week;
const heroAw = id => state.awakening[id];
const labelFor = id => {
  const progress = heroAw(id).progress;
  return progress < 0 ? 'Awakening locked' : 'Awakening ' + awakeningLabel(progress);
};
function chosenTarget(h) {
  const progress = heroAw(h.id).progress;
  const saved = state.awakeningTargets[h.id];
  return saved > progress ? saved : nextAwakeningTarget(progress);
}
function statSummary(h, a) {
  const stars = awakeningStars(a.progress);
  if (a.progress < 0) return '<div class="progress-warning">Awakening stats are not active yet.</div>';
  const dr = (2.5 + Math.max(0, stars) * .5).toFixed(2);
  return '<div class="progress-metrics">' +
    '<div class="progress-metric"><span class="value">+' + dr + '%</span><small>Damage Reduction</small></div>' +
    '<div class="progress-metric"><span class="value">HP ↑</span><small>Tier-based growth</small></div>' +
    '<div class="progress-metric"><span class="value">ATK ↑</span><small>Tier-based growth</small></div>' +
    '<div class="progress-metric"><span class="value">DEF ↑</span><small>Tier-based growth</small></div>' +
    '</div><p class="progress-footnote">HP, Attack and Defense increase with tiers. Exact values depend on the in-game tier preview and are not estimated here.</p>';
}
function progressOptions(current) {
  let options = '<option value="-1"' + (current === -1 ? ' selected' : '') + '>Not awakened</option>';
  for (let step = 0; step <= 24; step++) {
    const label = step === 0 ? 'Awakened · 0★' : awakeningLabel(step);
    options += '<option value="' + step + '"' + (current === step ? ' selected' : '') + '>' + label + '</option>';
  }
  return options;
}
function renderAwakeningCard(h) {
  const a = heroAw(h.id);
  const hero = HERO_MAP[h.id];
  const target = chosenTarget(h);
  const cost = awakeningCost(a.progress,target);
  const budget = awakeningBudget(a.progress,target,a.named,state.awakeningUniversal);
  const available = isAvailable(h);
  const readyGate = a.progress >= 0 || (available && a.fiveStar && state.levels[h.id] >= 20);
  const ready = available && readyGate && budget.readyMaterials;
  const stars = Math.max(0,awakeningStars(a.progress));
  let gate = '';
  if (!available) gate = state.season < 6 ? 'Season 6 not selected yet.' : 'Unlocks in Season 6, Week ' + h.week + '.';
  else if (a.progress < 0 && !a.fiveStar) gate = 'Hero must be 5★ before awakening can unlock.';
  else if (a.progress < 0 && state.levels[h.id] < 20) gate = 'Reach EW20 first. Your saved EW level is ' + state.levels[h.id] + '.';
  else if (budget.unlockGap > 0) gate = 'Need ' + nums(budget.unlockGap) + ' more named ' + hero.name + ' Awakening Shards for the unlock.';
  else if (budget.tierGap > 0) gate = 'Need ' + nums(budget.tierGap) + ' more usable Awakening Shards toward this goal.';
  else gate = 'Requirements and entered shard amounts cover this target.';
  const milestones = h.bonuses.map((bonus,index) =>
    '<li class="' + (stars >= index + 1 ? 'earned' : 'not-earned') + '"><b>' + (index+1) + '★:</b> ' + bonus + '</li>').join('');
  const options = stageOptions.map(opt =>
    '<option value="' + opt.value + '"' + (target === opt.value ? ' selected' : '') + '>' + opt.label + '</option>').join('');
  return '<article class="progress-card" id="awakening-' + h.id + '">' +
    '<div class="progress-card-head"><div class="avatar ' + hero.type + '">' + hero.initials + '</div><div><h3>' + hero.name + '</h3>' +
    '<span class="muted">' + TYPE[hero.type].name + ' · Season 6, Week ' + h.week + '</span><br><span class="pill-note">' + (available ? 'Released on your selected week' : 'Upcoming / preview') + '</span></div></div>' +
    '<div class="progress-stat-row"><span>Exclusive Weapon</span><strong>EW' + state.levels[h.id] + '</strong></div>' +
    '<div class="progress-stat-row"><span>Current Awakening</span><strong>' + (a.progress < 0 ? 'Locked' : awakeningLabel(a.progress)) + '</strong></div>' +
    '<div class="field"><label for="aw-current-' + h.id + '">Current Awakening tier</label><select id="aw-current-' + h.id + '" data-aw-current="' + h.id + '">' + progressOptions(a.progress) + '</select></div>' +
    '<div class="check-line"><input type="checkbox" id="aw-five-' + h.id + '" data-aw-five="' + h.id + '"' + (a.fiveStar ? ' checked' : '') + '><label for="aw-five-' + h.id + '">Hero is 5★</label></div>' +
    '<div class="field"><label for="aw-target-' + h.id + '">Target milestone</label><select id="aw-target-' + h.id + '" data-aw-target="' + h.id + '">' + options + '</select></div>' +
    '<div class="field"><label for="aw-named-' + h.id + '">Named ' + hero.name + ' Awakening Shards owned</label><input id="aw-named-' + h.id + '" data-aw-named="' + h.id + '" type="number" inputmode="numeric" min="0" max="999999" value="' + a.named + '"></div>' +
    '<div class="progress-money"><div>To target: <strong>' + nums(cost.total) + ' shards</strong></div><small>' +
    (cost.unlockNamed ? nums(cost.unlockNamed) + ' named for unlock' : 'Already unlocked') +
    (cost.tierShards ? ' · ' + nums(cost.tierShards) + ' named/universal for tiers' : '') + '</small></div>' +
    '<div class="progress-warning' + (ready ? ' progress-success' : '') + '">' + gate + '</div>' +
    statSummary(h,a) +
    '<details><summary>' + h.skill + ' and star bonuses</summary><p class="muted">' + h.summary + '</p><ol class="progress-bonuses">' + milestones + '</ol></details>' +
    '<p class="progress-footnote"><a href="' + h.guide + '" target="_blank" rel="noopener noreferrer">Full skill and stat reference: Cpt Hedge ↗</a></p>' +
    '</article>';
}
function renderAwakening() {
  if (!byId('awakeningGrid')) return;
  byId('awakeningGrid').innerHTML = AWAKENING_HEROES.map(renderAwakeningCard).join('');
  byId('awakeningUniversal').value = state.awakeningUniversal;
  byId('awakeningWeek').value = state.awakeningWeek;
  const unlocked = AWAKENING_HEROES.filter(h => heroAw(h.id).progress >= 0).length;
  byId('awakeningCount').textContent = unlocked + ' / 3 unlocked';
  const inSquad = AWAKENING_HEROES.filter(h => plannedLineup().includes(h.id)).map(h => h.name).join(', ');
  byId('awakeningSquadNote').textContent = inSquad ? 'Awakening candidates in your planned lineup: ' + inSquad + '.' : 'No Season 6 Awakening heroes in your planned lineup. You can still track them below.';
}
function nextAwakeningForSquad() {
  return AWAKENING_HEROES
    .filter(h => plannedLineup().includes(h.id))
    .sort((a,b) => Number(isAvailable(b)) - Number(isAvailable(a)) || Number(HERO_MAP[b.id].type === activeGoal().focus) - Number(HERO_MAP[a.id].type === activeGoal().focus) || a.week - b.week)[0] || null;
}
function renderAdvice() {
  if (!byId('advisorEW')) return;
  byId('spenderProfile').value = state.spendProfile;
  const profile = state.spendProfile;
  const ew = nextSteps()[0] || null;
  const aw = nextAwakeningForSquad();
  const planning = ew ? HERO_MAP[ew.id] : null;
  const costEW = ew ? upgradeCost(ew.current,ew.target) : 0;
  byId('advisorEW').innerHTML = ew
    ? '<h3>' + planning.name + ' · EW' + ew.target + '</h3><p>From EW' + ew.current + '. ' + nums(costEW) + ' weapon upgrade shards' +
      (ew.current === 0 ? ' plus 50 named EW unlock shards' : '') + '.</p><p class="progress-footnote">Weapon upgrade shards available: ' + nums(state.budget) + '.</p>'
    : '<h3>EW roadmap complete</h3><p>No next EW milestone for your planned squad under the current roadmap.</p>';
  if (!aw) {
    byId('advisorAW').innerHTML = '<h3>No Awakening candidate in squad</h3><p>Add Kimberly, DVA or Tesla to your planned lineup to get a direct comparison.</p>';
    byId('advisorRecommendation').innerHTML = '<h3>Follow your EW roadmap</h3><p>Your planned squad has no confirmed Season 6 Awakening hero, so keep using the existing EW priorities.</p>';
    return;
  }
  const a = heroAw(aw.id);
  const target = chosenTarget(aw);
  const budget = awakeningBudget(a.progress,target,a.named,state.awakeningUniversal);
  const label = target === 0 ? 'Unlock' : stageOptions.find(x => x.value === target)?.label;
  byId('advisorAW').innerHTML = '<h3>' + HERO_MAP[aw.id].name + ' · ' + label + '</h3><p>' +
    nums(budget.unlockNamed) + ' named shards for unlock + ' + nums(budget.tierShards) + ' tier shards after unlock.</p>' +
    '<p class="progress-footnote">' + (a.progress >= 0 ? 'Already awakened.' : 'Needs 5★, EW20 and 50 named shards.') + ' Shared universal Awakening budget: ' + nums(state.awakeningUniversal) + '.</p>';
  let title = '',reason = '';
  if (!isAvailable(aw)) {
    title = 'Prepare for ' + HERO_MAP[aw.id].name + ' Awakening';
    reason = 'It opens in Season 6 Week ' + aw.week + '. Keep collecting named Awakening Shards while following your EW roadmap. Set your current season and week in the tracker.';
  } else if (a.progress < 0 && state.levels[aw.id] < 20) {
    title = 'First unlock ' + HERO_MAP[aw.id].name + ' EW20';
    reason = 'EW20 is required before Awakening. You need ' + nums(upgradeCost(state.levels[aw.id],20)) + ' more weapon upgrade shards for EW20, plus a 50-named EW unlock if the weapon is locked.';
  } else if (a.progress < 0 && !a.fiveStar) {
    title = 'Finish ' + HERO_MAP[aw.id].name + ' at 5★';
    reason = 'The five-star hero requirement blocks Awakening. Keep your named Awakening Shards saved rather than spending Universal Awakening Shards on another hero without a plan.';
  } else if (a.progress < 0 && budget.unlockGap > 0) {
    title = 'Save named ' + HERO_MAP[aw.id].name + ' Awakening Shards';
    reason = 'The initial unlock needs 50 hero-specific shards. Universal Awakening Shards cannot pay this gate. Missing: ' + nums(budget.unlockGap) + '.';
  } else if (a.progress < 0) {
    title = 'Consider unlocking ' + HERO_MAP[aw.id].name + ' Awakening';
    reason = 'Your entered prerequisites and 50 named shards are ready. Awakening replaces the Expertise skill and creates a separate star path. Compare it with the next EW milestone before committing.';
  } else if (a.progress < 24) {
    title = 'Compare ' + HERO_MAP[aw.id].name + ' next Awakening star vs EW';
    reason = 'This hero is awakened. The next star milestone costs ' + nums(budget.tierShards) + ' Awakening Shards from the saved tier. Check the new skill bonus and keep your universal pool focused.';
  } else {
    title = 'Awakening maxed for ' + HERO_MAP[aw.id].name;
    reason = 'This hero is at Awakening 5★. Redirect future Awakening resources to another planned hero and follow the remaining EW roadmap.';
  }
  if (profile === 'f2p') reason += ' F2P tip: focus one primary carry and meaningful milestones instead of splitting scarce Awakening Shards.';
  if (profile === 'low') reason += ' Low-spend tip: plan for the nearest useful skill breakpoint before paying for a second path.';
  if (profile === 'high') reason += ' High-spend tip: compare combat skill breakpoints, not just displayed hero power.';
  byId('advisorRecommendation').innerHTML = '<h3>' + title + '</h3><p>' + reason + '</p>';
}
function decorateSquad() {
  const candidates = new Set(AWAKENING_HEROES.map(h => h.id));
  document.querySelectorAll('#frontSlots .slot, #backSlots .slot').forEach(slot => {
    slot.querySelectorAll('.aw-mini').forEach(x => x.remove());
    const id = slot.querySelector('[data-slot]')?.value;
    if (!candidates.has(id)) return;
    const note = document.createElement('small');
    note.className = 'aw-mini';
    note.textContent = labelFor(id);
    slot.appendChild(note);
  });
  const filtered = heroes.filter(heroVisible);
  const cards = [...document.querySelectorAll('#heroGrid .hero-card')];
  cards.forEach((card,i) => {
    card.querySelectorAll('.aw-card-tag').forEach(x => x.remove());
    const h = filtered[i];
    if (!h || !candidates.has(h.id)) return;
    const heading = card.querySelector('h3');
    if (!heading) return;
    const tag = document.createElement('span');
    tag.className = 'aw-card-tag';
    tag.textContent = labelFor(h.id);
    heading.parentNode.appendChild(tag);
  });
}
let preferredTab = activeTabOnLoad();
function showTab(next,scroll = false) {
  const selected = ['squad','ew','awakening','advisor'].includes(next) ? next : 'squad';
  preferredTab = selected;
  document.querySelectorAll('[data-progress-tab]').forEach(button => {
    const active = button.dataset.progressTab === selected;
    button.setAttribute('aria-selected',String(active));
    button.tabIndex = active ? 0 : -1;
  });
  document.querySelectorAll('.progress-view').forEach(panel => {
    panel.hidden = panel.id !== 'progress-' + selected;
  });
  try { localStorage.setItem('utw-progress-active-tab',selected); } catch {}
  if (scroll) byId('progressTabs')?.scrollIntoView({behavior:'smooth',block:'start'});
}
function activeTabOnLoad() {
  const hash = location.hash;
  if (hash === '#roadmap' || hash === '#heroes') return 'ew';
  if (hash === '#awakening') return 'awakening';
  if (hash === '#upgrade-advisor') return 'advisor';
  if (hash === '#builder') return 'squad';
  try { return localStorage.getItem('utw-progress-active-tab') || 'squad'; } catch { return 'squad'; }
}
document.addEventListener('click',e => {
  const button = e.target.closest('[data-progress-tab]');
  if (button) { showTab(button.dataset.progressTab,true); return; }
  const jump = e.target.closest('[data-jump-tab]');
  if (jump) { showTab(jump.dataset.jumpTab,true); return; }
});
document.addEventListener('change',e => {
  const el = e.target, data = el.dataset;
  if (data.awCurrent) {
    state.awakening[data.awCurrent].progress = clampInteger(el.value,-1,24);
    render(); return;
  }
  if (data.awFive) { state.awakening[data.awFive].fiveStar = el.checked; render(); return; }
  if (data.awTarget) { state.awakeningTargets[data.awTarget] = clampInteger(el.value,0,24); render(); return; }
  if (data.awNamed) { state.awakening[data.awNamed].named = clampInteger(el.value,0,999999); render(); return; }
  if (el.id === 'awakeningUniversal') { state.awakeningUniversal = clampInteger(el.value,0,999999); render(); return; }
  if (el.id === 'awakeningWeek') { state.awakeningWeek = clampInteger(el.value,1,8); render(); return; }
  if (el.id === 'spenderProfile') { state.spendProfile = el.value; render(); return; }
});
window.refreshHeroProgression = function () {
  renderAwakening();
  renderAdvice();
  decorateSquad();
  showTab(preferredTab);
};
window.addEventListener('load',() => window.refreshHeroProgression?.());

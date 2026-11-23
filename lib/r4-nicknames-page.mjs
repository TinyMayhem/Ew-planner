import {authorizedAccess} from '../api/r4-planner.mjs';
const H={'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex,nofollow','Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff'};
const html=String.raw`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#09291f"><title>Member Nicknames | UTW R4</title>
<link rel="stylesheet" href="/assets/hub.css"><link rel="stylesheet" href="/assets/forest.css"><link rel="stylesheet" href="/assets/r4-stats.css"><link rel="stylesheet" href="/assets/r4-nicknames.css?version=week-archive-20261117"></head>
<body><header><div class="container"><a class="brand" href="/">✦ UTW <span class="brand-gold">HUB</span><small>UNITED · TOGETHER · WE WIN</small></a><nav aria-label="R4 navigation"><a href="/r4-planner">R4 Command Centre</a><a href="/r4-stats">Member Stats</a><a href="/r4-reports">Reports</a><a href="/r4-nicknames" aria-current="page">Nicknames</a></nav></div></header>
<section class="hero stat-hero"><div class="container"><span class="eyebrow">PRIVATE · UTW R4 MEMBER RECORDS</span><h1>Nickname Manager</h1><p>One member, all their weird in-game names. Connect past nicknames so VS, donations and train records can be reviewed under the correct person.</p></div></section>
<main class="container nickname-main">
<p id="nickname-message" class="nickname-message" role="status" aria-live="polite">Loading names…</p>
<section class="stat-card nickname-weekly" id="this-week"><div class="nickname-weekly-head"><div><span class="eyebrow">WEEKLY NICKNAME ACTIVITY</span><h2>🔄 This Week’s Name Changes</h2><p class="stat-muted">See the names recorded since Monday, and which player they belong to. The newest additions appear first.</p></div><span id="nickname-week-count" class="nickname-week-count"></span></div><div id="nickname-weekly-list" class="nickname-weekly-list" aria-live="polite"><p class="stat-muted">Loading this week’s changes…</p></div></section>
<section class="stat-card nickname-editor"><h2>1. Choose the real member record</h2><p class="stat-muted">Choose who should own the scores. Choose the member record, then mark their latest in-game nickname as current. Old names remain searchable.</p>
<div class="nickname-fields"><label>Member to keep<select id="nickname-member"><option value="">Choose member…</option></select></label>
<label>Existing name from the roster<select id="nickname-existing-member"><option value="">Choose an existing name…</option></select></label></div>
<div class="nickname-actions"><button class="stat-button primary" id="nickname-link-existing" type="button">Review linking existing name</button>
<p class="stat-muted">Use this dropdown when the nickname is already a separate member record. Linking it will combine its old scores and aliases with the member you keep, but only after you confirm.</p></div>
<div class="nickname-new-section"><h3>Or add a name that isn't in the roster yet</h3>
<div class="nickname-new-row"><label>New nickname (exact spelling from the game)<input id="nickname-new" maxlength="60" autocomplete="off" placeholder="Type a new nickname"></label>
<button class="stat-button" id="nickname-add" type="button">Add new nickname</button></div></div>
<div id="nickname-collision" hidden class="nickname-collision" role="status" aria-live="polite"></div>
<div class="nickname-existing"><h3>Names linked to this member</h3><p class="stat-muted">The main name appears in Train Desk, VS reports and member lists. Click <strong>Make current</strong> beside the newest confirmed nickname. Historical names remain attached to the same player.</p><div id="nickname-linked"></div><div class="nickname-member-tools"><button class="stat-button" id="nickname-archive-toggle" type="button" hidden>Archive member</button><p id="nickname-archive-hint" class="stat-muted">Archiving hides former members from current Train Desk recommendations, but keeps their old VS scores and nicknames.</p></div></div>
</section>
<section class="stat-card"><h2>2. Review possible train-name matches</h2>
<p class="stat-muted">These are unlinked spellings from the saved conductor and VIP archives, matched against existing members and nicknames. Suggestions are not confirmed automatically. Check that they are genuinely the same player, then link the old spelling without merging or deleting records.</p>
<div id="nickname-train-suggestions" class="stat-stack" aria-live="polite"></div>
</section>
<section class="stat-card"><div class="nickname-heading"><div><h2>3. Active members and names</h2><p class="stat-muted">Search active UTW members by name or any known nickname. Former members never appear here.</p></div>
<label>Search members<input id="nickname-search" type="search" placeholder="Try Sus, Mo, Korean names…" autocomplete="off"></label></div>
<p id="nickname-count" class="stat-muted"></p><div id="nickname-directory" class="nickname-directory"></div></section>
<details class="stat-card" id="archived-members"><summary>📦 Manage archived records (restore only)</summary><div class="nickname-heading"><div><p class="stat-muted">Separate from active member search. Historical scores, aliases, and train history are preserved. Open a record only to restore a returning player.</p></div><span id="nickname-archived-count" class="nickname-week-count"></span></div><label>Find archived record<input id="nickname-archived-search" type="search" placeholder="Search former member for restoration" autocomplete="off"></label><div id="nickname-archived-directory" class="nickname-directory" aria-live="polite"></div></details>
<section class="stat-card nickname-help"><h2>How this affects screenshot uploads</h2><p>The scanner checks every recognized name against this saved nickname list. For example, <strong>Sus</strong>, <strong>Fkn Up Your Couch</strong>, and <strong>A Tribe Called SuS</strong> can point to the same member. VS and donation records from both spellings then appear under that one person in reports and eligibility checks.</p>
<p>If a nickname already has its <strong>own member record</strong>, this page can combine those two records after your confirmation. That merge also moves existing score history and cannot be undone from this page. Verify the two people really are the same before merging.</p>
<a class="stat-button" href="/r4-stats">Return to Screenshot Upload</a></section>
</main><footer class="footer"><div class="container">UTW R4 · Private nickname and alias records</div></footer>
<script type="module" src="/assets/r4-nicknames.js?version=active-only-search-20261122"></script><script type="module" src="/assets/r4-es.js?locale=nickname-dropdown-v2-20261104"></script></body></html>`;
export async function GET(request){
 if(!await authorizedAccess(request))return new Response(null,{status:303,headers:{...H,Location:'/r4-planner'}});
 return new Response(html,{headers:H});
}

import {authorizedAccess} from '../api/r4-planner.mjs';
const H={'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex,nofollow','Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff'};
const html=String.raw`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#09291f"><title>Member Nicknames | UTW R4</title>
<link rel="stylesheet" href="/assets/hub.css"><link rel="stylesheet" href="/assets/forest.css"><link rel="stylesheet" href="/assets/r4-stats.css"><link rel="stylesheet" href="/assets/r4-nicknames.css"></head>
<body><header><div class="container"><a class="brand" href="/">✦ UTW <span class="brand-gold">HUB</span><small>UNITED · TOGETHER · WE WIN</small></a><nav aria-label="R4 navigation"><a href="/r4-planner">R4 Command Centre</a><a href="/r4-stats">Member Stats</a><a href="/r4-reports">Reports</a><a href="/r4-nicknames" aria-current="page">Nicknames</a></nav></div></header>
<section class="hero stat-hero"><div class="container"><span class="eyebrow">PRIVATE · UTW R4 MEMBER RECORDS</span><h1>Nickname Manager</h1><p>One member, all their weird in-game names. Connect past nicknames so VS, donations and train records can be reviewed under the correct person.</p></div></section>
<main class="container nickname-main">
<p id="nickname-message" class="nickname-message" role="status" aria-live="polite">Loading names…</p>
<section class="stat-card nickname-editor"><h2>1. Choose the real member record</h2><p class="stat-muted">Choose who should own the scores. The name selected here stays their main name in reports.</p>
<div class="nickname-fields"><label>Member to keep<select id="nickname-member"><option value="">Choose member…</option></select></label>
<label>Existing name from the roster<select id="nickname-existing-member"><option value="">Choose an existing name…</option></select></label></div>
<div class="nickname-actions"><button class="stat-button primary" id="nickname-link-existing" type="button">Review linking existing name</button>
<p class="stat-muted">Use this dropdown when the nickname is already a separate member record. Linking it will combine its old scores and aliases with the member you keep, but only after you confirm.</p></div>
<div class="nickname-new-section"><h3>Or add a name that isn't in the roster yet</h3>
<div class="nickname-new-row"><label>New nickname (exact spelling from the game)<input id="nickname-new" maxlength="60" autocomplete="off" placeholder="Type a new nickname"></label>
<button class="stat-button" id="nickname-add" type="button">Add new nickname</button></div></div>
<div id="nickname-collision" hidden class="nickname-collision" role="status" aria-live="polite"></div>
<div class="nickname-existing"><h3>Names linked to this member</h3><div id="nickname-linked"></div></div>
</section>
<section class="stat-card"><div class="nickname-heading"><div><h2>2. Browse all members and names</h2><p class="stat-muted">Search by current name or any known nickname. Tap a member to add or review their names.</p></div>
<label>Search members<input id="nickname-search" type="search" placeholder="Try Sus, Mo, Korean names…" autocomplete="off"></label></div>
<p id="nickname-count" class="stat-muted"></p><div id="nickname-directory" class="nickname-directory"></div></section>
<section class="stat-card nickname-help"><h2>How this affects screenshot uploads</h2><p>The scanner checks every recognized name against this saved nickname list. For example, <strong>Sus</strong> and <strong>Fkn Up Your Couch</strong> can point to the same member. VS and donation records from both spellings then appear under that one person in reports and eligibility checks.</p>
<p>If a nickname already has its <strong>own member record</strong>, this page can combine those two records after your confirmation. That merge also moves existing score history and cannot be undone from this page. Verify the two people really are the same before merging.</p>
<a class="stat-button" href="/r4-stats">Return to Screenshot Upload</a></section>
</main><footer class="footer"><div class="container">UTW R4 · Private nickname and alias records</div></footer>
<script type="module" src="/assets/r4-nicknames.js"></script><script type="module" src="/assets/r4-es.js?locale=v1"></script></body></html>`;
export async function GET(request){
 if(!await authorizedAccess(request))return new Response(null,{status:303,headers:{...H,Location:'/r4-planner'}});
 return new Response(html,{headers:H});
}

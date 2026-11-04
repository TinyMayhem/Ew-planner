import {authorizedAccess} from '../api/r4-planner.mjs';
const headers={'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex,nofollow','Content-Type':'text/html; charset=utf-8'};
const page=String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#09291f">
<title>Member Reports | UTW R4</title>
<link rel="stylesheet" href="/assets/hub.css"><link rel="stylesheet" href="/assets/forest.css">
<link rel="stylesheet" href="/assets/r4-stats.css"><link rel="stylesheet" href="/assets/r4-reports.css"></head>
<body>
<header><div class="container"><a class="brand" href="/">✦ UTW <span class="brand-gold">HUB</span><small>UNITED · TOGETHER · WE WIN</small></a>
<nav aria-label="R4 navigation"><a href="/r4-planner">R4 Command Centre</a><a href="/r4-stats">Member Stats</a><a href="/r4-reports" aria-current="page">Reports</a></nav></div></header>
<section class="hero stat-hero"><div class="container"><span class="eyebrow">PRIVATE · UTW R4 / R5</span>
<h1>Member Performance Reports</h1><p>Find patterns in VS scores and alliance donations. Every flag links back to actual uploaded results.</p></div></section>
<main class="container stats-main reports-main">
<section class="panel report-filter-panel" aria-label="Report filters">
<div class="report-heading"><div><h2>Choose what to review</h2><p class="stat-muted">Select a period or use All recorded history. Results use only verified uploaded snapshots.</p></div><button class="stat-button" id="report-export" type="button" disabled>Export report CSV</button></div>
<form id="report-form">
<div class="report-filters">
<label>Time period<select id="report-preset"><option value="all">All recorded history</option><option value="4">Last 4 weeks</option><option value="8">Last 8 weeks</option><option value="12">Last 12 weeks</option><option value="custom">Custom dates</option></select></label>
<label>From date<input id="report-from" type="date"></label>
<label>Through date<input id="report-to" type="date" required></label>
<label>Season<select id="report-season"><option value="">All seasons</option><option value="post-s5">Post Season 5</option><option value="s6">Season 6</option></select></label>
<label>Members<select id="report-roster"><option value="latest">Latest VS roster</option><option value="all">Entire member directory</option></select></label>
<label>Daily VS minimum<input id="report-daily" type="number" min="0" step="100000" value="7200000"></label>
<label>Weekly VS minimum<input id="report-weekly" type="number" min="0" step="1000000" value="42000000"></label>
<label>Weekly donation minimum<input id="report-donations" type="number" min="0" step="1" value="1"></label>
<label>Minimum recorded results<input id="report-samples" type="number" min="1" max="100" value="2"></label>
<label>Misses in at least (%)<input id="report-percent" type="number" min="1" max="100" value="50"></label>
</div>
<div class="report-actions"><button class="stat-button primary" id="report-run" type="submit">Generate report</button>
<button type="button" class="stat-button" id="report-reset">Reset filters</button></div>
</form>
</section>
<p id="report-message" role="status" aria-live="polite">Loading report…</p>
<section class="report-results" id="report-results" hidden>
<div id="report-summary" class="report-summary" aria-label="Report summary"></div>
<article class="stat-card report-data-notice"><h2>Data coverage and fairness checks</h2><div id="report-coverage"></div>
<p class="stat-muted">A missing screenshot, missing upload, or a name absent from a snapshot is <strong>not</strong> counted as zero or a missed minimum. Reports are supporting evidence for R4 review, not automatic removal decisions. Screenshot recognition and nickname matching must be checked.</p></article>
<article class="stat-card">
<div class="report-heading"><div><h2>Members</h2><p class="stat-muted" id="report-count"></p></div>
<div class="report-table-controls">
<label>Show<select id="report-view"><option value="any_issue">All repeated issues</option><option value="repeated_vs">Repeated VS misses</option><option value="daily">Repeated daily VS misses</option><option value="weekly">Repeated weekly VS misses</option><option value="always_vs">Always below VS minimum (recorded)</option><option value="below_donations">Repeatedly below donation target</option><option value="zero_donations">Recorded zero donations</option><option value="no_vs_data">No VS scores recorded</option><option value="no_donation_data">No donation scores recorded</option><option value="all">All members</option></select></label>
<label>Find member<input id="report-search" type="search" placeholder="Search in-game name"></label></div></div>
<div class="report-table-scroll"><table class="stat-table report-table"><thead><tr>
<th scope="col">Member</th><th scope="col">Daily VS</th><th scope="col">Weekly VS</th><th scope="col">Donations</th><th scope="col">Evidence / details</th></tr></thead>
<tbody id="report-rows"></tbody></table></div>
<p id="report-empty" class="stat-empty" hidden>No members match these filters. Try All members or a longer date range.</p>
</article></section>
</main><footer class="footer"><div class="container">UTW R4 · Private evidence-based reports · No data means unknown, not zero.</div></footer>
<script type="module" src="/assets/r4-reports.js"></script>
</body></html>`;
export async function GET(request){
 if(!await authorizedAccess(request))return new Response(null,{status:303,headers:{...headers,Location:'/r4-planner'}});
 return new Response(page,{headers});
}

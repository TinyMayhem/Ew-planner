import {sessionUser} from '../lib/r4-auth.mjs';

const HEADERS={
  'Content-Type':'text/html; charset=utf-8',
  'Cache-Control':'private, no-store, max-age=0',
  'X-Robots-Tag':'noindex, nofollow',
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'same-origin',
  'Content-Security-Policy':"default-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self'; frame-src 'self'; base-uri 'none'; form-action 'none'"
};

function page(){
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#09291f">
<title>Alliance Duel | R4 Command Centre | UTW Hub</title>
<link rel="stylesheet" href="/assets/hub.css">
<link rel="stylesheet" href="/assets/forest.css">
<style>
.duel-hero{padding:30px 0 18px}
.duel-hero h1{font-size:clamp(32px,5vw,52px);margin:8px 0}
.duel-frame{background:#fffaf1;border:1px solid #dac89c;border-radius:20px;padding:12px;box-shadow:0 8px 26px #001b121b;overflow:hidden}
.duel-frame iframe{display:block;width:100%;height:85vh;border:0;border-radius:17px;background:#fff}
.duel-note{font-size:13px;line-height:1.6;color:#6e765f;margin:14px 0 30px}
.duel-actions{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0}
.duel-actions a{display:inline-block}
@media(max-width:640px){.duel-hero{padding-top:18px}.duel-frame{padding:5px;border-radius:15px}.duel-frame iframe{height:85vh;border-radius:12px}}
</style>
</head>
<body>
<header><div class="container"><a class="brand" href="/">✦ UTW <span class="brand-gold">HUB</span><small>UNITED · TOGETHER · WE WIN</small></a>
<nav aria-label="Main navigation"><a href="/">Home</a><a href="/ew-planner.html">EW Planner</a><a href="/r4-planner">R4 Command Centre 🔒</a><a href="/r4-duel" aria-current="page">Alliance Duel 🔒</a></nav></div></header>
<section class="hero duel-hero"><div class="container"><span class="eyebrow">SERVER 1395 · R4 / R5 ACCESS</span><h1>Alliance Duel</h1><p>One more tool for the raccoon command centre.</p></div></section>
<main class="container">
<div class="duel-actions"><a class="btn" href="/r4-planner">← Back to R4 Command Centre</a><a class="btn" href="/mirror" target="_blank" rel="noopener">Open Duel in a new tab ↗</a></div>
<div class="duel-frame"><iframe src="/mirror" style="width:100%;height:85vh;border:0;border-radius:17px" title="Alliance Duel" loading="lazy" referrerpolicy="same-origin"></iframe></div>
<p class="duel-note">This page uses your existing R4 sign-in. The embedded Alliance Duel requires the /mirror application to be deployed on this site. If it is not yet installed, the frame may display a not-found page.</p>
</main>
<footer class="footer"><div class="container">UTW · Server 1395 · Questionable supervision.</div></footer>
</body>
</html>`;
}

export async function GET(request){
  try{
    const user=await sessionUser(request);
    if(!user || !['admin','r4','von'].includes(user.role)){
      return Response.redirect(new URL('/r4-planner',request.url),303);
    }
    return new Response(page(),{status:200,headers:HEADERS});
  }catch{
    return new Response('R4 sign-in is temporarily unavailable.',{
      status:503,
      headers:{'Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8'}
    });
  }
}

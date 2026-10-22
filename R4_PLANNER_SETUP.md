# UTW Season 6 R4 Command Centre

Route: /r4-planner (Vercel function api/r4-planner.mjs)
Private discussion endpoint: /api/r4-comments (GET, POST).

## Environment and passcode

The requested R4 passcode is stored as the encrypted Vercel environment variable UTW_R4_PASSWORD. Do not commit the actual passcode to GitHub. A short dictionary passcode is much weaker than a random password, so the login requires Supabase rate limiting and fails closed if the rate-limiter is unreachable. Rotate this passcode if it leaks outside the intended R4/R5 group.

Existing production/preview variables:
- UTW_R4_PASSWORD: the separate R4 passcode (at least 8 characters).
- UTW_SESSION_SECRET: existing secret (at least 32 characters). Do not overwrite it.
- SUPABASE_URL: existing Supabase URL.
- SUPABASE_SECRET_KEY: existing server-only Supabase service role credential.

The R4 login uses the existing utw_buddy_rate_limit RPC, capped at ten attempts per IP/15 minutes. The comment API uses the same RPC, capped at 30 comments per IP/15 minutes, and fails closed if unavailable. The passcode is verified only on the server. Eight-hour sessions use HMAC-signed HttpOnly, Secure, SameSite=Strict cookies (Path=/); GET and POST APIs verify session cookies. POST additionally verifies Origin.

**Shared comments require one database setup action:** Run the reviewed migration in supabase/season6-r4-comments.sql using the SQL Editor of the *existing* Supabase project. This creates public.utw_r4_comments with its private indexes and security grants. No access is granted to anon/authenticated; the server API uses the server-only service role key. Do not paste credentials into the editor or browser.

## Features

- 10-week dropdown: Pre-season Weeks 1–2 and Season Weeks 1–8.
- 75 checklist tasks for diplomacy, leadership structure, city battles, War Merit, Altars, Outposts, Sanctuary Duels, Faction Duel and settlement.
- Expandable Discussion per individual item, including name, message and timestamps, visible to other signed-in R4s on other devices. Users choose a display name, which is **not verified** as a game account.
- 72-hour leadership/map review, 48-hour attendance poll, 24-hour final-map approval reminders.
- Checkboxes and progress are still stored **locally in each browser**, NOT shared. User can copy the checklist to back up progress.
- The generic checklists are stored in a **public** GitHub repository. The discussion contents are NOT in GitHub, only in the private Supabase table, accessible through the locked server API.

## Rollout and verification

1. Confirm the Vercel preview and production environments have the four environment variables. Redeploy after setting a new one.
2. Run supabase/season6-r4-comments.sql in your existing Supabase dashboard.
3. Run npm test or review GitHub checks.
4. Test /r4-planner in a preview: unauthenticated users only see the passcode screen.
5. Sign in, switch through all ten weeks, expand a discussion, and post a test message.
6. Sign in on another device and confirm the same comment appears. Check that checkbox ticks remain device-local.
7. Try an invalid login and log out; confirm API comments cannot be fetched without the signed session.
8. When approved, merge the draft pull request to main. This activates the Hub link in production.

No messages are shared before the Supabase table is created. If the table is missing or Supabase is unavailable, the UI shows a clear error and does not pretend a comment was saved.

## Privacy and operational considerations

The R4 password is shared among all R4s; access is role-based by knowledge of that password, not individual identity. Anyone with the passcode can read/post discussions using any displayed name. Avoid highly sensitive commitments and individual account credentials. For verified attribution, revocation of individual R4s, or edit/delete moderation, implement per-user sign-in instead of a shared passcode. Rotating UTW_R4_PASSWORD prevents new logins but does not immediately invalidate existing eight-hour cookies. To revoke existing sessions instantly, rotate UTW_SESSION_SECRET (which also invalidates other feature sessions).

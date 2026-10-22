# Season 6 R4 Command Centre

Route: /r4-planner (served by the Vercel function api/r4-planner.mjs).

## Security and setup

The Hub homepage and regular EW Planner remain public. The Command Centre has a separate server-side password gate. It fails closed with HTTP 503 until these Vercel environment variables are configured:

- UTW_R4_PASSWORD: a unique randomly generated passcode of at least 16 characters, shared only with authorized UTW R4/R5. Do not reuse UTW_ADMIN_PASSWORD, UTW_PAGE_PASSWORD, or the gear beta passcode.
- UTW_SESSION_SECRET: existing strong project secret of at least 32 characters. Do not overwrite it: other app sessions depend on it.

Set UTW_R4_PASSWORD in Vercel Project Settings -> Environment Variables (Production, and Preview if testing previews). Redeploy the relevant environment after adding it. Never commit the password, an auth cookie, or individual diplomatic secrets to GitHub.

If SUPABASE_URL and SUPABASE_SECRET_KEY are present, R4 logins additionally use the existing utw_buddy_rate_limit database RPC and fail closed when rate checking is unavailable. Allow up to 10 attempts per rolling 15-minute period per IP before the RPC rejects further attempts. Use a strong randomly generated passcode even with rate limiting.

Authenticated sessions use HMAC-signed HttpOnly, Secure, SameSite=Strict cookies for eight hours. The page and server response are no-store and noindex. Log out after using a shared device. Revoke access by rotating UTW_R4_PASSWORD or UTW_SESSION_SECRET, considering that changing the latter affects other features.

## Features

- Ten-week dropdown: pre-season Weeks 1-2, Season Weeks 1-8.
- 75 tasks covering diplomacy, leadership structure, capture maps, polls, city and Outpost battles, Altar Conquest, Sanctuary Duel, Faction Duel and settlement.
- Checkboxes, per-week progress, next-week, copy and reset controls, responsive mobile layout.
- Standard T-72 / T-48 / T-24 battle preparation reminders.

Task ticks are stored only in the current browser via localStorage. They are NOT shared, backed up, synchronized, or stored in Supabase. Clearing browser data wipes them. Use Copy Checklist to keep a manual backup, and do not enter confidential diplomatic agreements or account secrets. The generic task templates are committed to a public repository, so the server-side lock restricts page access but does not make those source templates confidential. A proper shared R4 live board would require separate authenticated server-side storage and access auditing.

Before each season event, validate exact opening dates and windows against the in-game Season 6 event calendar. The countdowns in the app are UTW planning practices, not game-mandated rules.

## Smoke test

Run npm test locally or in CI. On a deployed preview:
1. Open /r4-planner with no cookie and verify the passcode screen appears.
2. Confirm wrong passcodes do not show the checklist.
3. Enter the R4 passcode; confirm all ten weeks and task categories render.
4. Check a box, refresh the page, verify it stays checked on the same device.
5. Copy a weekly checklist and ensure completion markers reflect selections.
6. Lock the page and confirm protected content is no longer served without a session.

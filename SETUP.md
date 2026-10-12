# UTW Buddy Board activation

The EW Planner is now `/ew-planner.html`; existing root `#build=` links redirect there. The home page is UTW Field HQ. Gear guidance remains unpublished.

The board uses durable Upstash Redis via server-side REST calls. It returns a setup status and does not accept submissions until configured. Never use localStorage as the shared database or a temporary 72-hour database for production.

In Vercel, open **ew-planner** in **tiny-mayhem-s-projects**:

1. Storage → Create Database → Upstash Redis. Choose a permanent database suitable for this project and connect only **ew-planner**. Check the provider's plan and pricing before creating it.
2. Ensure Production environment has `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from that database. Some integrations use a different prefix; add these exact names if necessary.
3. Add `UTW_ADMIN_PASSWORD` (a unique private password of at least 16 characters) and `UTW_SESSION_SECRET` (a separate random secret of at least 32 characters). Neither belongs in GitHub or browser code. Admin sessions are HttpOnly, expire after eight hours, and mutations require same-origin requests.
4. Redeploy. `/api/buddies` must return `ready: true`. Verify a real member signup, private edit link, admin login, draft/publish, and profession change with two devices. Delete any test entries afterward.

Signups are self-reported, not proof of in-game identity. Each skill has one assigned provider slot and one recipient slot per member. Win-Win and Hospital Aid are independent. Only an Engineer explicitly offering a skill may provide it. A profession change flags all their active/draft pairings for reassignment immediately, and old pairings do not auto-reactivate. Admin can recover links and edit or remove entries. Private edit tokens are hashed in storage, never shown in the public board, and only returned when issuing a link.

Atomic compare-and-set prevents concurrent writes from overwriting each other. Conflicts return 409 and require a refresh. Drafts are hidden from the public API, while published pairing invalidations are visible immediately. Rate limits persist in Redis. Enable provider backups or use the admin export regularly.

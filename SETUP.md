# UTW Buddy Board

The home page is UTW Field HQ. The EW Planner remains at /ew-planner.html. Gear guidance remains unpublished.

The shared board uses Supabase server-side REST calls. Production environment variables: SUPABASE_URL, SUPABASE_SECRET_KEY, UTW_ADMIN_PASSWORD (at least 16 characters), UTW_SESSION_SECRET (at least 32 characters). Keep all secrets in Vercel, never GitHub or browser code. The secret API key is passed in the apikey header.

Database objects: public.utw_buddy_board (id text primary key constrained to main, revision bigint, data jsonb, updated_at timestamptz); public.utw_buddy_rate_limits (key text primary key, hits integer, expires_at timestamptz); public.utw_buddy_rate_limit(p_key text) returns integer and atomically increments a 15-minute counter, cleaning expired entries. Enable RLS and revoke all access from PUBLIC, anon, authenticated on both tables and the function. Grant table CRUD and function execution only to service_role. Initialize main with revision 0 and an empty board. Do not reset existing board data.

Writes use an atomic PATCH filtered by stored revision; conflicts return 409. Draft pairings remain private. Profession changes flag affected pairings for reassignment immediately. Only Engineers offering the relevant skill can provide it. Win-Win and Hospital Aid are independent. Private edit tokens are hashed; public responses never contain those hashes. Admin sessions use HttpOnly cookies and expire after eight hours.

After deployment, verify /api/buddies returns ready:true, then signup, private edits, admin login, draft publication, and profession changes on separate devices. Remove test entries afterward. Use admin exports for backups. Signups are self-reported and do not prove in-game identity.

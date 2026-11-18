# UTW Member Den | Weekly PFP Studio (beta)

## What this branch builds
- Adds a PFP Studio card and working section under `/members.html`.
- Member uploads a PNG, JPG or WebP character image (up to 3 MB).
- Three example weekly themes: Pick Your Squad, Your Starter Pack, UTW Royalty.
- Preserve source-image art style by default, with optional anime/chibi/comic/3D/photorealistic/watercolor.
- Keep outfit by default; optional change to theme outfit.
- One-tap demo mock-up, created entirely in browser without uploading the source image.
- When AI is enabled, the same form sends a one-off image edit request to OpenAI using a private server key.
- Download the image without storing the uploaded photo or output in a DB, object storage, cookies or localStorage.
- Browser previews are object URLs revoked when changed/cleared or page is closed.

## Preview the demo
Open your Vercel feature-branch deployment at:
`/members.html?pfpPreview=1#pfpStudio`

The `pfpPreview=1` UI override is only honored by the PFP Studio script when Vercel says `VERCEL_ENV=preview`. It allows visual testing without a production passcode. It does **not** grant backend authentication or enable billable AI generation. The demo makes a simple labeled collage, **not an AI-transformed picture**. Production Member Den keeps its existing passcode gate.

## Enabling real AI after testing
Add these Vercel project **server-only environment variables** directly in Vercel Settings, never in code or chat:

- `OPENAI_API_KEY`: valid API key with image-edits access.
- `UTW_PFP_STUDIO_ENABLED=true`: explicit spending switch.
- `UTW_PFP_THEME=squad`: weekly active theme; choose `squad`, `starter` or `royalty`.
- `UTW_PFP_MODEL=gpt-image-2.5-flare`: optional image model override.

These existing production variables must also be configured: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `UTW_SESSION_SECRET`, `UTW_PAGE_PASSWORD`. The guarded POST checks the existing member cookie and uses the existing Supabase rate-limit RPC. It fails closed if any of those prerequisites is missing.

The current rate limit is two attempts per existing rate-limit window per IP, **not two attempts per individually identified member or per week**. For broader member rollout, implement account-based quotas and an atomic spend cap first. Also set a budget limit in the OpenAI project. The four-character shared passcode is not adequate by itself as an anti-abuse or billing control.

## Privacy
The application does not persist member images. Images briefly travel through a Vercel serverless function to OpenAI when AI is enabled. OpenAI is an external processor subject to its own retention and safety policies. Do not claim zero provider-side retention. The existing rate-limiter stores only a hashed IP key/count, not photos. Avoid logging files, prompts or AI responses.

## Constraints
- The three game unit reference symbols have not been added. The beta asks for a generic vehicle illustration and makes no promise of pixel-identical game insignia.
- Current theme selection is hardcoded for beta; when AI is enabled the server enforces one active theme configured by an env variable.
- Production admin theme editor, true weekly scheduling, per-member quota and exact icon compositing are next-phase items.
- Run `npm test` (Node 24) before merging.

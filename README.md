# UTW Wasteland Exclusive Weapon Planner

Static HTML website for UTW / Server 1395, ready for Vercel. No npm installation, build command, or environment variables are needed.

## Deploy using GitHub and Vercel

1. Create a GitHub repository and upload `index.html`, `vercel.json`, and this `README.md` to the **repository root**.
2. In Vercel select **Add New → Project**, import that repository.
3. Set Framework Preset to **Other**; leave Root Directory as `./`.
4. No Build Command or Install Command is needed. Output Directory is `.` (defined in `vercel.json`).
5. Click **Deploy**. Future pushes to the configured production branch redeploy automatically.

Alternatively, in a terminal in this folder, run `npx vercel` and then `npx vercel --prod` once configured.

## Features

- Tank, aircraft, missile, and custom squad planning
- EW levels 0–30 for 15 heroes, with shard and milestone tracking
- Local browser autosave, shareable URL fragments, and JSON export/import
- Mobile responsive, no backend needed

## Notes

- This is a fan-made, unofficial planning guide.
- Player state persists in that device's browser localStorage. It does not sync between devices. Use Export / Import or Share Build to transfer progress.
- Shared links can contain the saved squad and inventory state; share only with people you trust.

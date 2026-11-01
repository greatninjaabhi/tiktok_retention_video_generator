# TikTok political explainer pipeline

Doodle-stickman political videos, 61–75 s, built from YAML beat sheets. Pipeline overview: `README.md`. Full research and rules: `RESEARCH_BRIEF.md`.

**Making a video? Run `/make-video` and follow `docs/PLAYBOOK.md`.** The playbook holds the owner-approved look, pace and tactics.

## Rules that don't bend

- **Save every iteration.** After each round of changes, make sure `npm run check` passes, then commit and push to the working branch. The owner works iteratively and hands this repo between agents, so unsaved work is lost work.
- **Keep the standard from drifting.** Don't slow the voice, lengthen captions or intro, or loosen a linter rule or `tests/house-style.test.ts` to get a video through. Change the script. Only the owner changes the standard, and when they do, update the playbook, what enforces it, and these rules together.
- **Look before you render.** Run `npm run frames` and open `out/<id>/frames/sheet.png`. A full render takes about 9 minutes.
- **Photos:** only public-domain, CC0, free-stock or owner-licensed images. Never scrape or download from news sites, even with credit.
- **Honesty:** every fact is sourced, quotes are verbatim, and allegations are said out loud as allegations. Agents never set `human_edited: true` and never post to TikTok unless the owner asks.
- **Record owner feedback.** New preferences go in `docs/PLAYBOOK.md`, and in a linter rule or test if a machine can check them.

## Commands

`npm run check` (typecheck, style lint, tests) · `npm run radar` · `npm run stock -- "<query>" --n 1` · `npm run lint:script -- <yaml>` · `npm run frames -- <yaml> --draft` · `npm run render -- <yaml> --draft` · `npm run preflight -- <yaml>`

## Environment notes

- Windows: use `fileURLToPath`, never `new URL(...).pathname`, and don't search paths for forward slashes.
- `assets/stock/cache/`, `voice/cache/` and `out/` are gitignored. On a fresh clone, re-fetch photos by running `npm run stock` for each `stock:` query in the script.
- Wikimedia Commons rate-limits; leave a few seconds between `npm run stock` calls.

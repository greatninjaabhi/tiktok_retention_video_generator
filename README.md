# TikTok Retention Video Generator

A semi-automated pipeline for 61–75 s character-narrated **political explainer** reels on TikTok (v1 niche, left-leaning, very current controversies; see brief §0.5). An original, code-drawn color doodle stickman narrates; the system handles voiceover, phrase captions, stock photos, memes, editing and rendering, then learns from each video's retention data what to make next.

- [`RESEARCH_BRIEF.md`](RESEARCH_BRIEF.md): locked decisions, niche rules (§0.5), format, retention rules, platform pitfalls, tech stack, build order. Start with "Decisions locked by owner".
- [`COMPETITOR_ANALYSIS.md`](COMPETITOR_ANALYSIS.md): teardown of same-format (finance) accounts; political-explainer teardown still to do.
- [`docs/STYLE_GUIDE.md`](docs/STYLE_GUIDE.md): the approved look, layout, and how to add art without breaking it.
- [`channels/politics/channel.yaml`](channels/politics/channel.yaml): niche rules as config (caption word colors, topic types, banned hooks, sourcing).

## Status: Milestone 1 in progress

![contact sheet](docs/gallery/contact-sheet.png)

| Done | Where |
|---|---|
| `style.tokens.json`: one source of truth for colors, strokes, wobble, boil, fonts, motion, layout, stage, captions, stock treatment, lint limits | `style.tokens.json` |
| Shared drawing engine (seeded, deterministic) | `render/draw/` |
| Big procedural stickman (~650 px): 8 poses, 7 expressions, talking mouth, blink, breathing, tie flap, line boil | `render/character/`, `assets/characters/stickman/` |
| Stage movement: walk / slide / hop between marks, tilts, rare spin; seeded auto-director | `render/character/blocking.ts`, `director.ts` |
| Phrase-group captions (3–7 words, ≤ 2 balanced lines, active word highlighted, good/bad word colors from channel config) | `render/captions/` |
| Stock pipeline: Pexels / Pixabay / Openverse (CC0, PD) / local drop folder, AI-tag screening, license manifest, panel treatment + transitions | `render/stock/` |
| Drawn meme formats: expectation vs reality, nobody / X, zoom stare | `assets/memes/` |
| 13 props (4 political, 9 finance) on the head-unit grid | `assets/props/` |
| Style lint + 96 tests incl. visual snapshots of every pose, prop and meme | `render/lint/`, `tests/` |

Next (brief §10): beat-sheet format + retention/honesty linter → ElevenLabs voice with real word timings → renderer v0 (SFX, cover) → editor v0 → topic radar.

## Commands

```bash
npm install
npm run check                    # typecheck + style lint + tests + visual snapshots (what CI runs)
npm run preview                  # out/preview.mp4: ~20 s format test (needs ffmpeg)
npm run stock -- "us capitol"    # search + download licensed stock photos into the cache/manifest
npm run contact-sheet            # regenerate docs/gallery/contact-sheet.png and prop thumbnails
npm run test:update              # approve intentional visual changes (review the contact sheet first)
```

### Stock photo setup
Set free API keys for the best sources (otherwise only Openverse and the local folder are used):

```bash
export PEXELS_API_KEY=...    # https://www.pexels.com/api/
export PIXABAY_API_KEY=...   # https://pixabay.com/api/docs/
```

Or drop images you've licensed into `inbox/stock/` with a sidecar `<name>.json` (`pageUrl`, `license`, `licenseUrl`, `creator`, `tags`). Images without a sidecar are ignored.

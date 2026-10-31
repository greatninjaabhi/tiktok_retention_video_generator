# TikTok Retention Video Generator

A semi-automated pipeline for 61–75 s character-narrated finance explainer reels on TikTok. An original, code-drawn color doodle stickman narrates; the system handles the AI voiceover, word-perfect captions, editing and rendering, then learns from each video's retention data what to make next.

- [`RESEARCH_BRIEF.md`](RESEARCH_BRIEF.md): locked decisions, target format, retention rules, platform pitfalls, tech stack, build order. Start with "Decisions locked by owner".
- [`COMPETITOR_ANALYSIS.md`](COMPETITOR_ANALYSIS.md): teardown of same-format accounts, winning patterns, whitespace.
- [`docs/STYLE_GUIDE.md`](docs/STYLE_GUIDE.md): the approved look and how to add art without breaking it.

## Status: Milestone 1, step 1 done (look + character)

![contact sheet](docs/gallery/contact-sheet.png)

| Done | Where |
|---|---|
| `style.tokens.json`: one source of truth for colors, strokes, wobble, boil, fonts, motion, layout, lint limits | `style.tokens.json` |
| Shared drawing engine (seeded, deterministic): `line`, `rect`, `ellipse`/`circle`, `polygon`, `dot`, `hatch`, `scribbleFill`, `label` | `render/draw/` |
| Procedural stickman rig: 8 poses, 7 expressions, 5 talking mouth shapes, blink, breathing, eased pose changes with overshoot, tie flap, line boil | `render/character/`, `assets/characters/stickman/` |
| 9 starter props on the head-unit grid | `assets/props/` |
| Style lint (palette, widths, size grid, accents, primitives-only, contrast) | `render/lint/` |
| Visual regression snapshots for every pose and prop | `tests/visual/` |

Next (brief §10): beat-sheet format + retention linter → ElevenLabs voice with word timings → renderer v0 (split layout, captions, transitions, SFX) → editor v0.

## Commands

```bash
npm install
npm run check          # typecheck + style lint + tests + visual snapshots (what CI runs)
npm run contact-sheet  # regenerate docs/gallery/contact-sheet.png and prop thumbnails
npm run preview        # render out/preview.mp4, an 8 s motion test (needs ffmpeg)
npm run test:update    # approve intentional visual changes (review the contact sheet first)
```

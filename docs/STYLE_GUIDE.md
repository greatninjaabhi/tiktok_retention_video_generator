# Style guide — the approved look

Brief §1.2–1.3. The rule: **vary which props, poses and moves appear; never vary how they're drawn.**

![contact sheet](gallery/contact-sheet.png)

*Regenerate with `npm run contact-sheet`. This image is the approved look. New art must match it.*

## Single source of truth: `style.tokens.json`
Nothing is styled per video. Colors, stroke widths, wobble, boil rate, fonts, text sizes, motion timing, layout and lint limits all live in `style.tokens.json`.

### Palette
| Token | Use | Never |
|---|---|---|
| `ink` | All outlines, text outlines | — |
| `paper` | The one constant background on every video | Change per video |
| `white` | Head fill, paper/props fills, caption text | — |
| `signature` (blue) | **The stickman's tie only** | On any prop or text (the lint fails it) |
| `money` (green) | Money, gains, good numbers | Losses |
| `loss` (red) | Losses, debt, warnings | Gains |
| `highlight` (yellow) | Keyword/cover title, small accents | Large fills behind text |

Text contrast is checked by the lint: ink on paper ≥ 7:1, and every caption/keyword fill on its ink outline ≥ 4.5:1.

### Lines
- Three stroke widths only: `fine` (4 px, faces/details/texture), `main` (8 px, bodies and outlines), `bold` (11 px, arrows/emphasis).
- Round caps and joins. No shadows, gradients or drop shadows.
- Every line wobbles slightly; fills are slightly mis-registered from their outlines (marker look).
- **Line boil:** the wobble is re-seeded 10×/s, so the drawing looks alive even when nothing moves.

### Scale grid
- 1 head unit (HU) = the stickman's head = 80 px. The stickman is ≈ 5 HU tall.
- Every prop declares its `heightHU`. The lint fails a prop that's drawn more than 15% off its declared size, or wider than 3.5 HU.

## Do / don't
| Do | Don't |
|---|---|
| Build props from the pen primitives (`line`, `rect`, `ellipse`, `circle`, `polygon`, `dot`, `hatch`, `scribbleFill`, `label`) | Paste SVG paths, images, emoji, or hex colors into a prop |
| One prop per beat, at its declared size | Scale a prop up "because it's important"; use a camera move (`punch_in`) instead |
| Max 2 accent colors per prop | Rainbow props, or the tie blue on anything else |
| Keep labels short (`TAX`, `$`) in the title font | Paragraphs of text inside a prop |
| Same background (`paper`) every video | Per-video background colors |

## Adding a prop
1. Create `assets/props/<name>.ts` using only `../../render/props/api` (`defineProp`, `u`, `px`, `path`, `arrowHead`). Draw with origin at bottom-center, y negative = up, sizes in HU.
2. Register it in `assets/props/index.ts`.
3. `npm run lint:style`, which checks palette, widths, size grid, accents and imports.
4. `npm run test:update` to write its snapshot, then `npm run contact-sheet` and look at it next to the others.
5. Commit the prop, its snapshot, its thumbnail and the updated contact sheet together.

## Changing the style on purpose
Edit `style.tokens.json` → `npm run check` (snapshots will fail, as intended) → review `npm run contact-sheet` → `npm run test:update` → commit tokens, snapshots and gallery together, with the reason in the commit message.

## Safe zones
`layout.safeZonePx` in the tokens holds starting values (top 150, right 140, bottom 420, left 60 px). ⚠️ Not yet verified against the current TikTok UI (brief §1.6 TODO). Keep hook text and captions out of these areas.

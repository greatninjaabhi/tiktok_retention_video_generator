# TikTok Retention Video Generator

A semi-automated pipeline for 61–75 s **political explainer and fact-check** reels on TikTok (v1 niche: left-leaning, very current controversies; see brief §0.5). An original, code-drawn doodle stickman narrates. The system finds stories, drafts scripts, enforces retention and honesty rules, voices, renders with captions, stock photos, memes and SFX, and learns from each video's numbers what to make next. **A human picks the story and edits every script before anything is posted.**

- [`RESEARCH_BRIEF.md`](RESEARCH_BRIEF.md): decisions, niche rules (§0.5), formats, retention rules, platform rules, build order.
- [`COMPETITOR_ANALYSIS.md`](COMPETITOR_ANALYSIS.md): format lessons (finance-era accounts; political teardown still to do).
- [`docs/STYLE_GUIDE.md`](docs/STYLE_GUIDE.md): the approved look.
- [`channels/politics/`](channels/politics/): niche rules as config: `channel.yaml` (caption colors, required tags, banned phrases, sourcing), `sources.yaml` (left / center / right outlets, fact-checkers), `hooks.yaml` (hook patterns).

![contact sheet](docs/gallery/contact-sheet.png)

## Daily workflow

```bash
npm run radar                                            # 1. today's stories → out/radar/<date>.md
```

```bash
npm run plan -- out/radar/<date>.json                    # 2. what to make (picker) → out/plan/<date>.md
```

```bash
npm run draft -- --radar out/radar/<date>.json --story 3 # 3. Claude drafts beat sheet + 10 hooks
```

4. **Edit** `scripts/videos/<id>.yaml`: pick the hook, verify every source, rewrite the angle, one example and the punchline, then set `human_edited: true`.

```bash
npm run stock -- "us capitol building"                   # 5. licensed photos for each stock query
```

```bash
npm run lint:script -- scripts/videos/<id>.yaml          # 6. retention + honesty rules
```

```bash
npm run render -- scripts/videos/<id>.yaml               # 7. out/<id>/video.mp4, cover.png, post.txt
```

```bash
npm run preflight -- scripts/videos/<id>.yaml            # 8. blocks anything not safe to post
```

```bash
npm run tiktok -- post scripts/videos/<id>.yaml           # 9. post to TikTok with caption + hashtags (auto-registers for analytics)
```

10. Pin a comment with the sources from `out/<id>/post.txt` (the API can't post comments).

```bash
npm run analytics -- pull                                # 11. Display API snapshot (run a few times a day)
```

```bash
npm run analytics -- import                              # 12. weekly: TikTok Studio CSV from inbox/tiktok_exports/
```

## What each stage does

| Stage | Where | Notes |
|---|---|---|
| Topic radar | `research/radar/` | Left, center and right outlets, fact-checkers, primary sources, Google Trends. Clusters headlines into stories; scores recency, coverage, **both-sides coverage**, conflict, checkable claims and search trends; suggests explainer vs fact-check. |
| Drafting | `scripts/draft.ts` | `claude-opus-5-5` structured output: beat sheet + 10 hooks, using only the sources given; unsourced facts become "NEEDS SOURCE" editor notes; lint errors go back for repair. |
| Beat sheet + linter | `scripts/` | Explainer and fact-check formats. Enforces hook length, 61–75 s, ≤ 4 s per beat, re-hook at 25–30 s, closed open loops, sources on facts and verdicts, opinion markers, verbatim quotes, official voting info, no paid political sponsors, left+right research, human-edit gate. |
| Voice | `voice/` | Kokoro-82M (free, local, Apache 2.0), voiced beat by beat and cached; if the model can't load, estimated timings and no narration (clearly marked). |
| Render | `render/` | Big moving stickman, phrase captions, stock panel with one house treatment and transitions, drawn memes, verdict stamps, synthesized SFX, hook on frame 0, cover, post text. |
| Posting | `publish/tiktok-*.ts` | Official Content Posting API: shows account, caption + hashtags, privacy choice (no default), comment/duet/stitch and disclosure settings, posts only after you type `post`, then registers the video for analytics. `--inbox` sends it to your TikTok drafts instead. ⚠ Until TikTok audits your app, Direct Posts are private-only (use `--inbox` to go public from the app). |
| Pre-post check | `publish/` | Lint clean, human-edited, real voice, 61–75 s, licensed images for every photo slot, cover, post text; then a manual checklist. |
| Analytics + picker | `analytics/`, `picker/` | Display API + Studio CSV; reward = z-scores vs your last 20 videos; Thompson sampling with discounting over format × topic type × hook pattern. |

## Setup

```bash
npm install
```

```bash
npm run check    # typecheck + style lint + all tests (what CI runs)
```

Credentials (all optional; each stage falls back or tells you what's missing):

| Variable | For | Get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | `npm run draft` | console.anthropic.com (or `ant auth login`) |
| `PEXELS_API_KEY`, `PIXABAY_API_KEY` | stock photos | pexels.com/api, pixabay.com/api/docs |
| `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI` | posting + analytics (run `npm run tiktok -- auth` once; tokens refresh automatically) | developers.tiktok.com: create an app with Login Kit, Content Posting API and Display API (scopes `user.info.basic`, `video.publish`, `video.upload`, `video.list`) |

**Running in a Claude Code cloud environment:** its network policy must allow these hosts (environment settings → Network access): `huggingface.co` (first Kokoro model download), `api.pexels.com`, `images.pexels.com`, `pixabay.com`, `cdn.pixabay.com`, `api.openverse.org`, `open.tiktokapis.com`, `trends.google.com`, and the feed hosts in `channels/politics/sources.yaml`. Or run the pipeline on your own machine.

Other commands: `npm run contact-sheet` (gallery), `npm run preview` (renders the sample draft), `npm run test:update` (approve intentional visual changes).

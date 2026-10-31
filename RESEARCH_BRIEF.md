# Finance Shorts Engine — Research & Build Brief (v0.1)

> **Purpose:** Starting point for Claude Code. This file collects the market research, retention research, pitfalls, and a proposed build plan for a semi-automated pipeline that makes split-screen, character-narrated personal-finance explainer videos (61–75 s) for TikTok, YouTube Shorts and Instagram Reels.
>
> **Status:** Research only. No code yet. The video format is still being finalized by the owner (see §12 Open questions).
>
> **Last updated:** 2026-10-31

---

## ✅ Decisions locked by owner (2026-10-31) — read first

| Decision | Choice |
|---|---|
| Platform | **TikTok only** for v1. Build analytics so TikTok numbers feed the learning loop (see §5.7 "TikTok numbers plan"). YouTube/Reels later. |
| Character | Original **animated doodle stickman** (§1.2), **in color**, not black-and-white (owner: B&W seems to retain worse; winning competitors are all full-color — see `COMPETITOR_ANALYSIS.md` §3) |
| Competitors | See **`COMPETITOR_ANALYSIS.md`** (closest matches: Null Monolith, the squid-character account, Dirty Dollars) |
| Top-panel visuals | **Code-drawn doodle props** in the same wobbly hand-drawn style as the stickman. **Must look consistent across every video**: no style drift, no "ugly differences" (§1.3) |
| Voice | No preference → default **ElevenLabs AI voice** with timestamps, behind a swappable `VoiceProvider` interface (human VO later) |
| First milestone | No preference → default **one finished video end-to-end** (script → voice → render → MP4), then tracker → picker |
| Length | 61–75 s (TikTok Creator Rewards needs > 1 min) |

---

## 0. TL;DR

- **What we're building:** a pipeline where a human picks the idea and edits the script; the system handles AI voiceover, word-perfect captions, editing and rendering with **pre-built original characters**, then learns from each video's retention data what to make next.
- **Goal metric:** retention, specifically 3-second hold, average % viewed, and rewatches, on videos **longer than 60 s** (required for TikTok Creator Rewards payouts).
- **Our edge vs existing tools:** existing faceless generators are template-driven, look the same, and are tuned for sub-60 s clips with no feedback loop. We build for the hard part (holding attention through 60+ s), use original characters (originality score), and adapt per channel from our own data.
- **Biggest risks:** originality/"inauthentic content" flags, IP (copyrighted characters or footage), finance misinformation and get-rich-quick rules, AI-label requirements, and the TikTok API limits on posting and analytics.

---

## 1. Target format (draft — owner will finalize)

The reference the owner shared is a **stacked split-screen**:

```
┌──────────────────────────┐
│  TOP PANEL               │  visual that illustrates the current line
│  (images / charts /      │  (comparison cards, numbers, props, mini-scenes)
│   comparison cards)      │
├──────────────────────────┤
│  CAPTION BAND            │  word-by-word captions, current word highlighted
├──────────────────────────┤
│  BOTTOM PANEL            │  narrator character (our own mascot), posed/animated
│  (character)             │
└──────────────────────────┘
```

**Decisions already made by the owner**
- Characters are **pre-built** (designed once and reused), not generated per video.
- Video is **not AI-generated footage**. AI does the editing, voiceover and captions.
- AI voiceover with **word-perfect captions**.
- The second half of the split screen illustrates the content (not unrelated "brainrot" gameplay).

**IP note on the reference example:** it uses images of famous copyrighted cartoon characters in the top panel. **We must not do this.** All characters, props and illustrations must be ours or properly licensed (see §5.3).

### 1.1 Second reference: "rich-people secrets" illustrated reels (closer to the target)

Owner shared a profile grid from an account doing short illustrated finance reels. Observed pattern:
- **One recurring character in a suit** (status = wealth), shown doing a concrete action with a **prop** per scene: a shredder with luxury bags, a washing machine full of cash, holding a house, a globe and a key, gold frames.
- **Flat cartoon illustration**, same soft blue-grey background on every video, so the grid looks like a series.
- **Cover = big yellow outlined title** ("Why the poor get poorer", "How to avoid taxes"). **In-video captions = one big keyword** at a time (BILLIONAIRE, PROPERTY, LOOK).
- **Topic angle: how the rich think and play the game** (rich vs poor, billionaire habits, property, taxes, moving countries).
- **Views ranged ~23K → ~669K** on the same format. Top performers: billionaire, property, money-in-washer, "poor get poorer". Weaker: Dubai, airports. Same format, so **topic and hook drive the variance**. This is exactly the data the outlier tracker and picker (§8) should learn from.

**What we copy:** structure (one character + one prop-driven visual metaphor per beat), series-consistent look, keyword captions, the rich-vs-poor angle.
**What we don't copy:** that account uses well-known copyrighted cartoon characters. That's a takedown and demonetization risk (§5.3). **We use our own original character in a similar flat style.**
**Finance-rule note:** "avoid taxes" must mean legal tax *minimization* explained educationally, never evasion or laundering how-tos (§5.4). Jokes or visual metaphors about laundering are fine as illustrations; instructions are not.

**Implications for the build**
- Character asset system = **character × pose × prop** library. Each beat picks a pose and a prop scene. Scenes are reusable and recombinable, which helps variety (§5.1).
- If scenes are AI-illustrated, use a fixed character reference sheet and style guide, and check every frame for character drift.
- Keyword-caption mode: one emphasized word on screen per beat, with optional full word-by-word captions. Make it an A/B arm in the picker.
- Thumbnail/cover generator: title text in the house style, auto-made from the hook.

### 1.2 Character decision: animated doodle stickman (owner, 2026-10-31)

The narrator is an **original talking doodle stickman** that should feel **animated, not static**.

**Identity (make it ownable, since plain stick figures are generic and other channels use them)**
- One signature trait that shows even at thumbnail size (e.g. a tie or suit outline that fits the "rich vs poor" angle, a hat, or a color accent). Pick one and never change it.
- A few fixed expressions: smug, shocked, sad, thinking, excited, side-eye.
- Must not resemble any existing stick-figure character from games or shows. Keep a dated design file as proof of origin in `/assets/characters/`.

**Color direction (owner decision: more color)**
- Keep the hand-drawn doodle line, but add **flat color fills**: a signature colored outfit/accessory on the stickman (one bold color, always the same), colored props, colored skin/face tone optional.
- **One constant tinted background** across all videos (the winners use a soft light background on every video so the grid reads as a series). Pick our own color, not a copy of theirs.
- Accent palette: green for money, red for loss/warning, yellow for the keyword/cover title. Max ~5 colors total, defined in `style.tokens.json`.
- Covers: big outlined title in yellow/red on the tinted background.
- Contrast check: captions and keyword text must pass a readability contrast check on phone screens.
- Treat "color beats B&W" as a hypothesis. Optionally A/B a palette variant through the picker once there are ~20 videos.

**What makes a doodle feel animated (cheap tricks, high payoff)**
- **Line boil:** redraw the outline with slight jitter every 2–3 frames ("animating on twos", ~8–12 fps for the lines). Instantly reads as hand-drawn and alive.
- **Idle motion:** gentle breathing bob, occasional blink, small weight shifts. Never fully frozen.
- **Talking:** mouth shapes synced to the voice (open/closed from audio volume at minimum; visemes from word timings if possible), plus head nods on stressed words.
- **Pose changes with easing**, overshoot and settle (squash & stretch). Each pose change counts as a pattern interrupt (R7).
- **Secondary motion:** tie or hair flaps, props bounce in.
- **Emphasis hits:** small camera shake, zoom punch, or "pop" lines on key numbers.
- **Props interact:** the stickman picks up, points at, throws, or reacts to the prop of each beat (§1.1 character × pose × prop).

**Build options**
1. **Procedural vector rig** (joints → lines in SVG/Canvas inside Remotion): poses as joint-angle sets, interpolated, with line boil via noise. Cheapest, infinitely reusable, fully code-controlled. *Recommended for MVP.*
2. **Rigged 2D tool** (Rive, Spine, or After Effects + Duik), exported and driven by timings. More polish, more manual setup.
3. **Hand-drawn frame library** per pose (artist-made). Best look, slowest to expand.

### 1.3 Visual consistency system (owner requirement: no ugly differences between videos)

Everything on screen (stickman, props, panels, text) is drawn by **one shared drawing engine** with **one locked set of style tokens**. Nothing is hand-tuned per video.

- **`style.tokens.json` (single source of truth):** stroke width(s), line cap/join, ink color, paper/background color, accent palette (max 2–3 accents), fonts (caption + keyword + title), shadow (none or one fixed style), corner rounding, line-boil amplitude and frequency, animation easing curves, panel padding, safe-zone margins.
- **Primitive-only drawing:** props are built only from shared primitives (`wobblyLine`, `wobblyRect`, `wobblyCircle`, `scribbleFill`, `hatch`, `label`), so a house, a washer and a bag automatically share the same hand.
- **Fixed scale grid:** props declare their size relative to the stickman's head unit, so a "house" never appears 3× too big in one video and tiny in another.
- **Deterministic randomness:** line boil and jitter use a **seeded RNG** (seed = video id + element id). Re-renders are identical and wobble stays within the token range.
- **Prop library with versioning:** `/assets/props/<name>.ts` + a thumbnail. New props go through a **"style lint"** (stroke widths, colors, line count, size within the token limits).
- **Visual regression tests:** render a contact sheet of every pose and prop on each change and diff it against approved snapshots. Fail CI on unexpected changes.
- **Approved-look gallery:** `docs/STYLE_GUIDE.md` shows do/don't examples. Claude Code must check new art against it.
- **Variety without inconsistency:** vary *which* props, poses, camera moves and layouts are used, never the drawing style itself.

### 1.4 "Genuinely drawn" rule (no AI imagery in the pipeline)

- Every visual (stickman, props, backgrounds, covers) is **drawn by our own code** from primitives (§1.3). There are **no AI-generated images**, so there's nothing to "flag" and nothing to hide. That's the point: the character *is* hand-drawn-by-code, not a disguised AI image.
- **Do not** add an image-generation step, and **do not** strip provenance metadata (C2PA/Content Credentials) from any file. TikTok treats undisclosed realistic AI content and evasion as integrity violations (§5.2).
- The AI **voice** remains the one AI element. Decide on labeling per §5.2 (default: toggle TikTok's AI-generated label; TikTok says honest labeling doesn't reduce distribution).

### 1.5 Editing style: CapCut-style transitions, captions & SFX (built natively)

Goal: the finished video should *feel* like a polished CapCut edit, but every effect is generated by our renderer so it's consistent, timed to the word timings, and needs no manual editing. We copy the *techniques*, not CapCut templates or assets.

**Transitions / camera moves (preset library, all driven by beat/word timings)**
| Preset | What it is | Starting params | When |
|---|---|---|---|
| `punch_in` | Quick scale jump on a keyword | +8–15% over ~6–12 frames, short ease-in ([Pippit](https://www.pippit.ai/blog/capcut-alternative/capcut-zoom-in-effect)) | Keywords, numbers, punchlines |
| `punch_hold` | Punch in, hold a few frames, ease back | 110–125% scale, start 3–8 frames before the word ([Cursa CapCut guide](https://cursa.app/en/page/keyframes-in-capcut-smooth-zooms-reframes-and-motion-that-follows-the-subject)) | The hook line, the payoff |
| `slow_push` | Gentle continuous zoom across a beat | 105–108% short clips, up to 110–120% longer ([Pippit](https://www.pippit.ai/blog/capcut-alternative/slow-zoom-capcut)) | Explanation stretches (prevents static frames) |
| `zoom_blur` | 1–2 frame radial blur on a scene change | single-frame hit ([Edit with Zakir](https://edit-with-zakir.blogspot.com/2026/05/zoom-effects-add-energy-to-your-videos.html)) | Beat-to-beat scene swaps |
| `zoom_shake` | Zoom + brief camera shake | small amplitude, ≤8 frames | Shock moments ("you lose $X") |
| `whip_wipe` | Fast horizontal slide with motion blur between scenes | ~6–10 frames | Changing topic/beat |
| `flash` | White flash frame | 1–2 frames | Reveals |
| `pop_in` | Prop/text scales in with overshoot | 0 → 110% → 100% | Every new prop / keyword |

Rules: one camera move every ~3–7 s keeps it dynamic without distracting, with subtler moves for educational content ([Pippit](https://www.pippit.ai/blog/capcut-alternative/capcut-zoom-effect)). Never stack two transitions on the same beat. The picker can A/B "move intensity" (subtle vs punchy).

**Captions (CapCut-style presets)**
- Default: **word-by-word karaoke highlight**, the style one 2026 roundup ranks highest for watch time ([BlitzCut ranking](https://blitzcutai.com/blog/video-caption-styles-ranked)): bold white text, dark outline, active word in **yellow** (money words green, loss words red).
- Alt presets for A/B: `single_word_pop` (one big word center screen, pops in), `keyword_only` (like the competitor format, one keyword per beat), `color_pop` (key words in a different color) ([FluxNote](https://fluxnote.io/best/best-ai-caption-tools-short-form-video)).
- Fonts (all free for commercial use under the SIL Open Font License): **Montserrat Black/ExtraBold** (most common caption font), **Anton** for single big keywords/covers, **TikTok Sans** (open-sourced by TikTok under OFL) ([BlitzCut](https://blitzcutai.com/blog/best-caption-fonts-tiktok), [BlitzCut on TikTok Sans](https://blitzcutai.com/blog/what-font-does-tiktok-use), [Made Good Designs](https://madegooddesigns.com/?p=7189)). Avoid "free for personal use" fonts.
- Layout: ALL CAPS, 1–3 words per chunk, centered in the caption band, never over the panel seam, outside platform UI safe zones.
- Note: one 2026 trend piece says the heavy "Hormozi" style is getting saturated ([BlitzCut trends](https://blitzcutai.com/blog/tiktok-caption-trends-2026)), another reason to make the caption preset a picker arm.

**Sound design (SFX)**
- Map SFX to actions: **whoosh** on zooms/wipes, **pop/click** on text and prop pop-ins, **riser** before a reveal, **ding/cash register** on money numbers, **boing** for comedic beats ([Jupitrr breakdown](https://jupitrr.com/video-formats/vault/53iymufzosqe), [Fish Audio](https://fish.audio/blog/using-sound-effects-for-short-form-content)).
- Match whoosh length to the move ([Morphic](https://morphic.com/kr/resources/sounds/whoosh-sound-effect)). **Don't put a sound on every cut**: the same swoosh everywhere stops meaning anything and fatigues viewers ([Sonilo](https://sonilo.com/blog/guides/transition-effect-sound-video-edits)). Rule: SFX only on marked emphasis beats; vary samples from a small pool; ducked under the voice.
- Only royalty-free SFX with commercial licenses; keep license files in `/assets/sfx/LICENSES.md`. Optional low-volume original background music (no trending copyrighted tracks, §5.3).

### 1.6 The editor (review & tweak tool)

The pipeline needs a lightweight **editor** so the owner can fix things in minutes without opening CapCut:
- **Timeline view per video:** beats, word timings, poses, props, transitions, SFX, caption chunks on tracks.
- **Live preview** (Remotion Studio–style player) at 9:16 with safe-zone overlay.
- **Click-to-edit:** change a line (re-voices only that beat), swap pose/prop, change transition preset, nudge timing, change caption preset, mute an SFX.
- **Lint panel:** shows retention-linter results (§7) and style-lint results (§1.3) live.
- **Approve → render → export** to `/out/<video_id>.mp4` plus the cover image and caption/hashtag text file.
- Everything the editor changes is written back to the beat-sheet YAML, so edits stay versioned in git.

**Layout spec (starting values)**
- Frame: 1080×1920 (9:16). One guide lists YouTube's Shorts upload maximum as 1080p.
- Split options described by a split-screen tool vendor ([Kineo](https://www.usekineo.com/brainrot-video-generator)): even split 960/960 px; "content-led" 1248 px top / 672 px bottom when the top half carries real information. **Start with content-led**, since our top panel carries the explanation.
- Keep captions inside **one band**. Text crossing the seam between panels reads as an error (same source).
- TODO (verify): exact TikTok/Shorts/Reels UI safe zones (right-side buttons, bottom caption/username area). Keep hook text and captions out of those.

---

## 2. Retention research → rules the system should enforce

> Most sources here are creator-tool blogs, not platform data. Treat exact percentages as directional; the patterns are consistent across sources. The system should **learn our own baselines** (§8) rather than trust these numbers.

### 2.1 First 3 seconds ("swipe zone")
- Steepest drop on any retention curve: one analysis says 30–50% of viewers swipe instantly if there's no immediate value ([ByteCap](https://www.bytecap.io/blog/optimal-short-form-video-length-retention-analysis)).
- Meta data often cited: of viewers who watch 3 s, ~65% reach 10 s ([Kapwing roundup](https://www.kapwing.com/resources/short-form-video-statistics-tiktok-reels-and-shorts-by-the-numbers-in-2026/)).
- Rough target: ~70% retained past 3 s ([Hansen Commerce](https://hansencommerce.com/insights-tiktok-hook-3-seconds), [OpusClip](https://www.opus.pro/blog/ideal-youtube-shorts-length-format-retention)).

**Rules**
- R1. Hook text is **fully visible on frame 0**, no fade-in ([Kineclip](https://kineclip.com/blog/how-to-write-viral-hooks-short-form-2026/), [Creator Lane](https://creatorlanehq.com/blog/first-three-seconds-instagram-hook-anatomy-2026)).
- R2. Spoken hook ≈ 6–12 words; on-screen hook ≈ 3–8 words ([Kabo](https://kabo.sh/guides/how-long-should-a-video-hook-be)). The on-screen line doesn't need to repeat the spoken line word-for-word.
- R3. No intros, logos, channel names or "hey guys" in the first 3 s. Moving branding to the end is reported to lift retention ([Percee Digital](https://www.perceedigital.com/insights/video-hooks-that-convert/)).
- R4. Hooks must be **specific and credible** (a concrete number or situation), not vague hype ([Faceless.so](https://faceless.so/blog/short-form-video-script-the-retention-guide)). This matters doubly for finance (§5.4).

### 2.2 Captions
- Many viewers watch muted, so captions carry the video. Word-synced highlighting keeps the eye moving ([Kineclip](https://kineclip.com/blog/how-to-write-viral-hooks-short-form-2026/)).
- R5. Word-by-word captions with the active word highlighted; big, high-contrast, bold font.
- R6. Emphasize numbers and money amounts (color/scale pop). They're the hook in finance content.

### 2.3 Visual change cadence (pattern interrupts)
- Sources range from every 1–3 s to every 3–5 s. Educational content can hold longer shots when information density is high ([Sozee](https://www.sozee.ai/resources/edit-tiktok-trend-videos-retention/), [OpusClip TikTok](https://www.opus.pro/blog/tiktok-length-format-retention-data)).
- R7. **Something changes at least every 3–4 s** (pose change, zoom punch, new top-panel visual, number pop, prop). The split screen gives two zones to alternate changes.
- R8. No dead air. Trim silences between lines ([Reeldrift](https://reeldrift.pro/learn/tiktok-retention-tips)).

### 2.4 Voice pace
- Short-form narration typically 150–180 WPM; 200+ gets hard to follow ([ZeroSkillAI](https://zeroskillai.com/60-second-youtube-short-script-eguide-2026/), [Avocado](https://avocadonotch.com/blog/how-fast-should-you-speak-on-camera)).
- Default AI voices run ~160–170 WPM ([AI Video Toolbox](https://aivideotoolbox.com/script-timer)).
- R9. Target 155–180 WPM. A 65 s video ≈ **165–190 spoken words**.

### 2.5 Holding attention past 60 seconds (our main edge)
- Most advice targets 20–35 s clips. We need 61 s+ to earn on TikTok.
- 60 s scripts need a mid-video "retention reset" around 25–30 s ([ScrollScript](https://scrollscript.ai/blog/how-long-should-a-tiktok-reel-youtube-short-be)).
- Small open loops every 10–15 s re-hook drifting viewers ([Shortzly](https://shortzly.com/blog/short-form-video-retention-strategies)).
- Padding a short idea to fill time hurts more than keeping it tight ([Influencers Time](https://www.influencers-time.com/tiktok-longer-video-retention-means-rewrite-your-creator-bri/)).
- Expect lower absolute numbers. One benchmark set targets >30% retention for 1–3 min TikToks ([Mean CEO roundup](https://blog.mean.ceo/video-hook-retention-statistics/)).

**Rules**
- R10. Script must have **≥3 real beats** (distinct ideas or steps), not one idea stretched out.
- R11. **Re-hook between 25–30 s** (twist, reveal, "the 3rd one is the one that matters").
- R12. **Micro open loop every 10–15 s.**
- R13. Close every loop that was opened (payoff), or viewers stop trusting the channel.
- R14. Duration **61–75 s** (hard floor 61 s).

### 2.6 Endings and loops
- Replays are a strong signal, but seamless "trick" loops rarely suit educational explainers, since the value is already delivered ([Shortzly](https://shortzly.com/blog/short-form-video-retention-strategies)).
- R15. Prefer a **thematic callback** to the opening line over a forced seamless loop. End the moment the payoff lands.

### 2.7 Metrics to optimize
- YouTube "viewed vs swiped away" (now also labeled "stayed to watch") is effectively the hook score. YouTube publishes **no official benchmark**, so compare against your own last ~20 Shorts of the same format ([Versely](https://www.versely.studio/blog/viewed-vs-swiped-away-the-shorts-hook-gate), [1of10](https://1of10.com/blog/youtube-shorts-analytics/)).
- Average % viewed can exceed 100% because of rewatches ([Prepublish](https://prepublish.ai/blog/viewed-vs-swiped-away-youtube-shorts)).

---

## 2.8 The human layer (so nobody feels misled, and so people actually care)

> Owner requirement: scripts must have a real human aspect, and viewers should never feel tricked. This section is the "soul" spec. The retention rules in §2 get people to watch; this is what makes them trust, follow and come back.

### 2.8.1 What the research says
- **People want to know when AI is involved, and hiding it backfires.** In a Meltwater/YouGov study of ~10,000 consumers, 86% said AI-generated content should be disclosed; 32% would trust a brand less if content was AI-made vs 15% more; trust drops most when AI content feels misleading, is undisclosed, or replaces human creativity ([Meltwater](https://www.meltwater.com/en/blog/generative-ai-trust-yougov)). Acceptance is higher for entertainment than for high-trust areas like news and influencer content ([Podcasting Today summary](https://podcastingtoday.co.uk/?p=42824)). Finance advice is high-trust.
- **The "found out later" penalty is real.** In one study, 52% felt less engaged with the *same* content once told it was AI-made ([MarTech](https://martech.org/consumers-like-ai-content-until-they-know-its-ai/)). Younger audiences care less about disclosure (45% of 16–24s vs 71% of 55+, same source), but being exposed later is worse than being upfront.
- **Gen Z values originality, honesty and authenticity over polish** ([DCN/Magid](https://digitalcontentnext.org/?p=45348)). Commentary in 2026 also describes a shift from pure relatability toward **credibility and substance** ([Pulse summary](https://www.pulse.bot/entertainment/video/people-are-demanding-more-from-influencers-7fd60e18-0cd2-4310-b3b7-8868e499be85/)).
- **Familiarity builds trust.** Gen Z and Millennials trust creators far more than older groups, and people who watch a creator more often trust them more ([Modash Creator Trust Report 2026](https://www.modash.io/ko/blog/creator-trust-report-2026)).
- **People bond with characters, not just faces.** VTuber research finds viewers form real parasocial bonds even though VTubers don't reveal their real identity ([Lee et al., arXiv](https://arxiv.org/html/2504.13421v1)). Fans of an AI VTuber accept that she's technically constructed, yet still relate to her through humanized roles ([arXiv 2509.10427](https://arxiv.org/pdf/2509.10427)). **Implication:** our stickman can be a real "someone" to viewers *if* he has a consistent personality and history.
- **Stories pull people in.** Narrative transportation research (Green & Brock and a decade of follow-ups, incl. a meta-analysis) shows immersion in a story shifts attitudes and builds emotional engagement ([van Laer et al. meta-analysis](https://openaccess.city.ac.uk/id/eprint/16984/)). One large experiment found stories weren't more persuasive than a fact list directly, but they **increased warmth toward the hero character** ([ESCP library abstract](https://libraries.escp.eu/doc/bth/99543208)). For us: stories make people like the stickman; facts make them learn. Use both.

### 2.8.2 Honesty contract (non-negotiable)
1. **Don't pretend the AI voice is a real person.** Use TikTok's AI-generated label on videos (voice) per §5.2. No bio disclosure line needed (owner decision).
2. **The stickman never makes fake personal claims.** No "I made $50K last month", no fake screenshots, no invented testimonials. Hypotheticals are framed as hypotheticals ("Say you're 20 and…", "Meet Jay, a made-up 22-year-old…").
3. **Every number has a source** (in the beat sheet, with a short source note in the caption when it matters).
4. **One honest caveat per video** where it matters ("this works if you have no high-interest debt", "this is legal but not for everyone"). Nuance is a credibility signal, not a retention killer, if it's one line.
5. **Corrections in public.** If a video gets something wrong: pin a comment with the correction and/or post a follow-up. Track in `corrections.md`.
6. **Dark-curiosity topics end on the legal/protective side** (how people get caught, how to protect yourself), never as a how-to.

### 2.8.3 Character bible (gives the stickman a soul)
Create `docs/CHARACTER_BIBLE.md` before the first video:
- **Name, look, signature trait** (§1.2).
- **Personality:** e.g. curious, a bit sarcastic, used to be bad with money and learned the hard way (clearly a character backstory), roots for the viewer, allergic to hype.
- **Values:** honest about money, anti-scam, "rich people's tricks, explained for normal people".
- **Voice & speech:** contractions, short sentences, occasional self-deprecating jokes; 2–3 catchphrases used sparingly.
- **Flaws & running jokes:** e.g. always tempted by a $7 coffee, a recurring broke friend vs a smug rich character. Recurring cast creates storylines viewers follow.
- **What he never does:** shill, fake wealth, mock poor people, give personal advice to individuals.

### 2.8.4 The human ingredients every script needs
| Ingredient | What it looks like | Why |
|---|---|---|
| **Relatable scenario** | Grounded in an everyday situation **the target audience commonly faces**, drawn from audience research (comment questions, competitor comment sections, public surveys/forums, trend data), **never from the owner's personal life**. Finance examples: first paycheck, surprise bill, a subscription you forgot, a friend asking to borrow money | Viewer sees themselves → identification |
| **A point of view** | The stickman takes a side: "Honestly? This is overrated." / "I used to think X, I was wrong." | Opinions feel human; neutral summaries feel like AI |
| **Emotion beat** | One moment of feeling: frustration, relief, outrage at unfairness, a small win | Emotion drives shares and memory |
| **Story spine** | Even 60 s can carry a mini-story: character → problem → twist → payoff | Narrative transportation (§2.8.1) |
| **Specific details** | "$1,247 rent", "a $9 burrito", "a 19-year-old in Austin" (made-up character) beats "some money", "a young person" | Specifics read as real and credible |
| **Viewer as hero** | End on what *they* can do or understand now | Respect, not lecture |
| **Humor** | One joke or visual gag per video (the doodle style is great for this) | Warmth + rewatch |

### 2.8.5 Writing rules (keep it from sounding like AI)
- Write for the ear: contractions, short punchy lines, natural pauses; read every script out loud before rendering.
- **Banned AI-cliché list** (linter): "delve", "in today's fast-paced world", "unlock", "game-changer", "it's important to note", "navigate the landscape", "let's dive in", "in conclusion", "elevate", "embark".
- No fake hype words: "insane", "secret they don't want you to know" (unless actually true and sourced).
- The human editor must change **at least the angle, one example, and the punchline** on any AI-drafted script (also protects originality, §5.1).

### 2.8.6 Community = the human loop
- Turn real comment questions into videos ("@user asked…") with video replies. These are cheap, human, and convert followers.
- Pin a comment on each video inviting questions; the stickman "answers mail" in a recurring format.
- **Privacy:** no content is based on the owner's personal life, and no personal details (name, school, location, family) appear in videos, captions or metadata.

### 2.8.6b Niche-agnostic by design
- Finance is v1 because it's the highest-paying niche we found (§3.1, §13). But the human layer, character bible format, linter and picker must work for **any niche**: topic lists, scenario bank, banned-phrase rules and caveat rules live in `channels/<niche>.yaml`, not in code.
- The **scenario bank** (`channels/<niche>/scenarios.yaml`) is built from audience research per niche and tagged by topic, so scripts can pull relatable situations without inventing personal stories.
- Switching or adding a niche = new channel config + new character variant + new scenario bank; no code changes. Re-check that niche's platform rules (e.g. health/medical content has its own restrictions) before launch.

### 2.8.7 Linter additions (human layer)
Fail render if missing: relatable scenario tag, POV line, source for every stat, no first-person fake claims (pattern check on "I made/I earned/my portfolio"), banned-cliché check, caveat line on advice topics, human-edit flag set by the editor (§1.6).

---

## 3. Market & competitors

### 3.1 Faceless finance works
- Finance is described as a strong faceless niche because viewers care about the explanation more than the presenter. One example given: **Casual Finance**, a **stick-figure explainer** channel that reportedly passed 300K subscribers in about a year ([vidIQ](https://vidiq.com/blog/post/youtube-channel-ideas-without-showing-your-face/)). That's close to our format; study it.
- Other faceless finance channels to study: Practical Wisdom (animated finance/self-improvement) ([Fliki](https://fliki.ai/blog/best-faceless-youtube-niches)); The Plain Bagel; Economics Explained ([OutlierKit](https://outlierkit.com/resources/faceless-youtube-channels/), [FlowShorts](https://flowshorts.app/blog/best-faceless-youtube-channels)).
- Finance has higher ad rates (RPM/CPM) than entertainment niches, so the same views are worth more ([OutlierKit growth guide](https://outlierkit.com/resources/faceless-youtube-growth-strategy/)). Note: Shorts ad revenue is pooled, so per-view pay is still low; affiliates and sponsors matter more.
- A recognizable narrator/character can be a faceless channel's identity ([Lip-sync.ai](https://lip-sync.ai/blog/faceless-tiktok-content-ideas)). This supports the mascot approach.

### 3.2 The split-screen ("brainrot") format
- Classic version: narration/text on top, looping gameplay (Subway Surfers, Minecraft parkour) below, with word-by-word captions ([inReels](https://www.inreels.ai/blog/how-to-create-brainrot-videos)).
- A vendor that sells this format calls it the **riskiest faceless format for monetization**, because identical intros/voices/loops with only the topic swapped look mass-produced, and because of footage rights ([Kineo](https://www.usekineo.com/brainrot-video-generator)). Even another vendor admits it can cost credibility with some audiences ([ScaleReach](https://www.scalereach.ai/tools/subway-surfers-video-generator-tool/)).
- **Our version avoids this:** the second panel is **our own illustrative visuals tied to the script**, not unrelated gameplay.

### 3.3 What finance topics are hot (late 2026)
- Trends named in 2026 coverage: "moneymaxxing", "No Buy 2026", "soft saving", doom spending, BNPL creep ([Boldin](https://www.boldin.com/retirement/personal-finance-fads/)).
- Evergreen high-demand topics: high-yield savings accounts, taxes (seasonal: Jan–Apr), recession prep, AI finance tools, Gen Z money, and **specific-income** content (e.g., "building wealth on a $40K salary") ([FluxNote](https://fluxnote.io/guides/trending-personal-finance-youtube-topics-2026)).
- Formats that drive shares/comments: compound-interest comparisons ("start at 25 vs 35"), real-math hot takes, "explain like I'm 5", money-mistakes lists ([FlowShorts Reels ideas](https://flowshorts.app/instagram-reels-ideas/finance)).

### 3.4 Audience trust is a gap we can fill
- Credit Karma survey: 77% of Gen Z seek financial info online; 37% say they got into trouble after following social-media financial advice; 25% say they were scammed by someone posing as a financial adviser ([Credit Karma](https://www.creditkarma.com/about/commentary/gen-z-feels-burned-after-taking-financial-advice-from-social-media)).
- **Implication:** accurate, specific, non-hype content is a differentiator, not just a compliance cost.

---

## 4. Existing tools and their gaps

| Tool | What it does | Starting price (as reported) | Notes |
|---|---|---|---|
| AutoShorts.ai | Autopilot series: generates and auto-posts | ~$19/mo (3 posts/wk) | Hands-off; limited per-video control ([Reelry](https://www.reelry.app/compare/crayo-vs-autoshorts)) |
| Faceless.video | Series on a fixed cadence | ~$20/mo per series | Trustpilot ~1.8/5 with bug/upload complaints ([Trustpilot](https://it.trustpilot.com/review/faceless.video)) |
| Revid.ai | Generate + publish + stats | ~$39/mo | Reported reliability complaints: lost credits, character drift ([AITuber review](https://aituber.app/blog/best-ai-faceless-video-generators/)) |
| Crayo | Reddit-story / fake-text / gameplay templates, clipping | ~$13/mo (annual) | Workshop-style, no auto-post ([Reelry](https://www.reelry.app/compare/crayo-vs-autoshorts)) |
| StoryShort | Faceless generation with character consistency | ~$39/mo | ([StoryShort](https://storyshort.ai/blog/autoshorts-ai-review-and-alternatives)) |
| Brainrot Shorts etc. | Split-screen, character explainers, quizzes | varies | Some advertise cartoon-show-style character explainers, which is an IP risk ([Toolify listing](https://www.toolify.ai/tool/brainrot-shorts)) |
| n8n / Make templates | DIY: script → images → TTS → Creatomate render → post | free–cheap | Glue code, no retention logic |

**Shared weaknesses (our wedge)**
1. **Template sameness.** Even comparison writers note that both major tools share this limitation ([Reelry](https://www.reelry.app/compare/crayo-vs-autoshorts)). Stock-matching makes every channel look alike ([AITuber](https://aituber.app/blog/best-ai-faceless-video-generators/)). This is exactly what originality filters punish.
2. **No retention feedback loop.** Tools generate and post; none we found adapt future videos from the channel's own retention curves.
3. **Tuned for short clips**, not the 61 s+ structure needed for TikTok payouts.
4. **Credit-based pricing** that burns money on retries ([AITuber](https://aituber.app/blog/best-ai-faceless-video-generators/)).
5. **Character drift** when characters are AI-generated per scene. We avoid this with pre-built characters.

---

## 5. Pitfalls & platform rules (read before building)

### 5.1 Originality / "inauthentic content"
- **TikTok:** Creator Rewards uses "originality" as a key metric; unoriginal content is ineligible ([TikTok Creator Academy](https://www.tiktok.com/creator-academy/article/tiktok-originality-policy)). Content copied or with minimal original input/edits doesn't qualify ([Mintface](https://mintface.ai/blog/tiktok-ai-content-policy-2026)). Creator reports say repeated unoriginal flags can cost monetization permanently ([SocialBoost](https://socialboostdigital.com/blog/tiktok-creator-rewards-unoriginal-content-flag)), unverified.
- **Faceless accounts qualify on the same terms.** They fail on originality, not on the missing face ([ShortsFast](https://shortsfast.com/blog/tiktok-creator-rewards-2026-requirements/)).
- ⚠️ **Conflicting reports on AI:** one source says TikTok excludes fully AI-generated videos (visuals + voice) from Creator Rewards ([Storrito](https://storrito.com/resources/what-tiktoks-ai-monetization-restrictions-signal-for-creator-income/)); another says the program terms never mention AI ([MonetizedNow](https://monetizednow.com/ai-tiktok-content-monetization)). Our format (human-designed characters, real editing, AI voice) is in the safer middle, but **AI voice is the open risk**. Keep an option to swap in a human voiceover.
- **YouTube:** in July 2025 YouTube renamed its "repetitious content" policy to "inauthentic content" (mass-produced/repetitive) ([Creator Handbook](https://www.creatorhandbook.net/youtube-updates-monetization-policy-for-inauthentic-content/)). In July 2026 it clarified that generic, template-based channels lose Partner Program access whether or not AI made them ([Media Copilot](https://mediacopilot.ai/youtube-ai-slop-monetization-policy/)).

**Design consequences**
- Vary structure, openings, top-panel visuals, poses and camera moves per video (randomized within the style guide).
- A human writes or edits every script's angle and punchline.
- No scraped scripts, no reused third-party footage. Ideas and hook *patterns* only.

### 5.2 AI labels
- TikTok requires labeling AI-generated or significantly edited content showing **realistic** people or scenes; unlabeled content may be removed, restricted or auto-labeled. Current Community Guidelines released 25 Aug 2026, effective 24 Sep 2026 ([Sirency](https://www.sirency.com/blog/tiktok-ai-generated-content-label)).
- TikTok reads C2PA Content Credentials and auto-applies labels ([CineRads](https://www.cinerads.com/blog/tiktok-ai-content-policy)). Some guides say realistic AI voices are covered too ([Turrboo](https://turrboo.com/blog/does-tiktok-allow-ai-influencers)).
- TikTok's help article (as quoted in [UGCVids](https://ugcvids.ai/blog/tiktok-ai-content-disclosure-rules-2026)) says turning on the AI label doesn't affect distribution if the video follows the guidelines.
- YouTube auto-labels detected photorealistic AI use since 27 May 2026 ([Kineo](https://www.usekineo.com/brainrot-video-generator)).
- **Decision:** cartoon characters are clearly stylized, but the voice is AI. **Default to toggling the AI label** (cheap insurance). Note: the reference example's cat looks photorealistic AI, which would get labeled.

### 5.3 IP / copyright
- TikTok's guidelines prohibit reposting copyrighted or trademarked work without permission ([Lilach Bullock summary](https://www.lilachbullock.com/tiktok-community-guidelines/)).
- **Never** use famous cartoon/TV/movie characters, clips or screenshots (like the reference example's top panel). Draw our own visual metaphors instead.
- Gameplay: someone else's recording can trigger strikes; licensed stock loops are clean; trending music can trigger Content ID revenue claims ([Kineo](https://www.usekineo.com/brainrot-video-generator)).
- Character assets: commission or create originals; keep the source files and license terms in the repo (`/assets/LICENSES.md`).

### 5.4 Finance content rules
- TikTok bans promoting financial scams, including fake investment offers and **"get-rich-quick" schemes** ([TikTok: Regulated Goods & Commercial Activities](https://www.tiktok.com/community-guidelines/en/regulated-commercial-activities)), and harmful misinformation ([TikTok Community Guidelines](https://www.tiktok.com/community-guidelines)).
- EU: the European Parliament backed minimum standards for finfluencers, and ESMA warned that investment-recommendation rules can apply to social posts ([Euronews](https://www.euronews.com/my-europe/2026/08/13/tiktoks-finfluencers-how-reliable-is-the-financial-advice-reaching-young-investors)).
- **Rules for scripts:** educational framing ("how X works"), no individualized advice, no guaranteed returns, no "get rich fast". Cite sources for every stat in the script file. A fact-check step is mandatory before render. Add a "not financial advice / for education" line in the caption/description.

### 5.5 Disclosure (affiliates & sponsors)
- TikTok requires its content disclosure setting when promoting a product, brand or business ([TikTok Community Guidelines](https://www.tiktok.com/community-guidelines)).
- FTC treats affiliate commissions as material connections needing clear disclosure (e.g., #ad / "affiliate link") ([Everything PR](https://everything-pr.com/ftc-influencer-disclosure-rules-2026-complete-guide)).
- Store a per-video `disclosures` field; the publisher refuses to post affiliate content without it.

### 5.6 Account setup
- TikTok Creator Rewards: 18+, 10K followers, 100K views in 30 days, personal account (Business accounts aren't eligible), eligible country, videos > 1 min ([ShortsFast](https://shortsfast.com/blog/tiktok-creator-rewards-2026-requirements/), [Faceless.my](https://faceless.my/tiktok/monetize-faceless-tiktok/)).
- YouTube Shorts path to Partner Program: 1K subscribers + 10M Shorts views in 90 days ([FlowShorts](https://flowshorts.app/blog/faceless-youtube-channel-ideas)).
- Multi-channel: one summary of TikTok's guidelines lists running automation to operate many accounts among violations ([Fastlane](https://www.usefastlane.ai/blog/tiktok-community-guidelines)). Separate niches, separate characters, distinct content, run openly. No VPN/device-farm tricks.

### 5.7 API limits (these shape the architecture)
- **TikTok posting:** unaudited Content Posting API clients can only post **private** videos; lifting this requires a Terms-of-Service audit ([TikTok for Developers](https://developers.tiktok.com/doc/content-posting-api-reference-direct-post)). The audit can take weeks, and posts made before it stay private ([bundle.social](https://bundle.social/blog/tiktok-api-approval)). Already-audited schedulers (e.g., Blotato) exist ([Blotato](https://www.blotato.com/api/tiktok)).
- **TikTok analytics:** the Display API covers your own profile and public video list; richer per-day analytics sit in Business/Research APIs ([Knowi docs](https://docs.knowi.com/hc/en-us/articles/52573229203347-TikTok)). Business-API fields like average time watched and full-video-watched rate exist ([Adverity](https://docs.adverity.com/reference/connectors/connector-tiktok-business.html)), **but Business accounts can't join Creator Rewards**. ⚠️ **Conflict:** for a personal TikTok account, expect to enter retention numbers manually from TikTok Studio (or via a third-party tool) at first.
- **YouTube analytics:** the YouTube Analytics API returns a per-video retention curve (`elapsedVideoTimeRatio` × `audienceWatchRatio`, up to 100 points; the ratio can exceed 1 on Shorts because of loops) plus `relativeRetentionPerformance` ([Zernio docs](https://docs.zernio.com/analytics/get-youtube-video-retention)). **Use YouTube as the automated retention signal; TikTok as manual/semi-manual.**

### 5.7.1 TikTok numbers plan (owner: "find a way to do TikTok numbers too")

Layered, all inside TikTok's rules (no bots logging into TikTok Studio, no scraping):

1. **Automatic, official: Display API** (Login Kit + `video.list` scope on our own account). Pull every few hours: views, likes, comments, shares per video. Gives the **early velocity curve** (views at 1 h / 6 h / 24 h / 48 h), a strong early signal for the picker. Display API covers your own profile and public videos ([Knowi docs](https://docs.knowi.com/hc/en-us/articles/52573229203347-TikTok)).
2. **Retention metrics: TikTok Studio CSV export (weekly, ~1 minute of human time).** On desktop, TikTok Studio → Analytics → Export Data downloads a CSV (60-day window; desktop only) ([Sozee](https://www.sozee.ai/resources/?p=44803)). Guides list per-video average watch time and % who watched the full video among the exported fields ([Graphed](https://www.graphed.com/blog/how-to-export-tiktok-analytics)). The pipeline **watches an `/inbox/tiktok_exports/` folder**, auto-imports the CSV, matches rows to our video ids, and updates the picker. ⚠️ Verify the exact columns on the first real export and adapt the importer.
3. **Per-second retention curve (optional): screenshot import.** For key videos, the owner screenshots the retention graph in TikTok Studio and drops it in `/inbox/tiktok_screens/`. A vision model extracts the curve and drop-off points (hook drop at 0–3 s, mid-video dips) into the DB. Every extraction is flagged for human confirmation.
4. **Derived metrics** (computed, no extra data needed): avg watch time ÷ video length = average % viewed; full-watch rate; velocity; engagement per 1K views; follows per 1K views.
5. ⚠️ Account type: some guides say TikTok Studio analytics require a Creator/Business account, others say personal accounts have them ([Lilach Bullock](https://www.lilachbullock.com/?p=134270), [Post Bridge](https://www.post-bridge.com/blog/tiktok-analytics)). Since Business accounts can't join Creator Rewards (§5.6), **stay on a personal/creator account** and confirm analytics are visible before launch.

**Picker reward for TikTok (v1)** = weighted z-scores vs the channel's last 20 videos of: average % viewed (from CSV), full-watch rate (CSV), 24 h/48 h view velocity (API), shares per 1K views (API). Until the first CSV arrives, use velocity + shares only and mark rewards "provisional".

---

## 6. Recommended tech stack (proposal)

| Layer | Choice | Why |
|---|---|---|
| Script authoring | Markdown/YAML "beat sheet" per video (see §7) | Human-editable; diff-able in git |
| Script drafting help | LLM (Claude) via API, prompt seeded with hook pattern + topic + style guide | Human edits before render |
| Voice | ElevenLabs `POST /v1/text-to-speech/{voice_id}/with-timestamps` | Returns audio plus **character-level timestamps in one call** ([ElevenLabs docs](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps)); no Whisper drift |
| Alignment for human voice (optional) | ElevenLabs forced alignment (audio + transcript → word timings) ([SDK docs](https://tessl.io/registry/tessl/npm-elevenlabs--elevenlabs-js/files/docs/content/forced-alignment.md)) | If we switch to a human VO later |
| Rendering | **Remotion** (React → MP4 via FFmpeg) | Good fit for template-driven, data-driven video; has caption guidance ([Remotion best-practices skill](https://agentskillsfinder.com/skills/remotion)). Check its license terms for our use. Alternative: Python + FFmpeg |
| Character system | Layered SVG/PNG pose library per character (idle, point, shocked, thinking, holding-money, celebrate…) + mouth shapes; optional Rive/Lottie | Consistent identity; fast; no drift |
| Data | SQLite (single file) | Tracker, results, bandit state |
| Analytics in | YouTube Analytics API (auto); TikTok Studio numbers (manual entry form/CSV at first) | See §5.7 |
| Posting | Manual upload at first → later an audited scheduler or our own audited app | See §5.7 |

**Caption pitfalls to handle**
- Numbers: the script shows "$1,000" but the voice says "one thousand dollars". Use ElevenLabs `normalized_alignment` vs `alignment` and map back to display tokens ([skill notes](https://skillselion.com/skills/coleam00/hyperframes-ai-video-generation/text-to-speech)).
- Merge character timings into words; group into 1–3-word caption chunks; never let a chunk cross the panel seam.
- Pronunciation dictionary for finance terms (APR, IRA, 401(k), HYSA, ETF).

---

## 7. Script format & retention linter

### 7.1 Beat sheet (proposal)
```yaml
id: 2026-11-03-hysa-01
channel: finance-main
character: mascot_v1
target_seconds: 66
hook:
  spoken: "Your bank is paying you almost nothing to hold your money."
  on_screen: "Your bank is underpaying you"
  pattern: shocking_number        # from hook library
beats:
  - id: b1
    line: "..."
    top_panel: {type: compare_cards, left: "Big bank 0.01%", right: "HYSA ~4%"}
    pose: pointing
    emphasis: ["0.01%", "4%"]
  - id: b2
    line: "..."
    open_loop: "But the third one is the one most people miss."
  - id: rehook                     # must land 25–30 s
    line: "..."
payoff: "..."
callback_to_hook: true
sources:                           # required for every stat
  - claim: "HYSA rates ~4%"
    url: "https://..."
disclosures: []                    # required if any affiliate/sponsor
tags: {topic: savings, hook_type: shocking_number, length_bucket: "60-70"}
```

### 7.2 Linter checks (fail = cannot render)
| Check | Threshold | Ref |
|---|---|---|
| Spoken hook length | 6–12 words | R2 |
| On-screen hook | 3–8 words, visible frame 0 | R1–R2 |
| Estimated duration | 61–75 s (from word count @ target WPM, then actual TTS duration) | R14 |
| Pace | 155–180 WPM | R9 |
| Beats | ≥3 distinct | R10 |
| Re-hook | present, lands 25–30 s | R11 |
| Open loops | one every 10–15 s, each closed | R12–R13 |
| Visual changes | ≤4 s between changes (computed from beat timings) | R7 |
| Dead air | no gap > 0.4 s (tunable) | R8 |
| Branding in first 3 s | none | R3 |
| Stats | every number has a source | §5.4 |
| Banned phrases | "guaranteed", "get rich quick", "risk-free" etc. | §5.4 |
| Human layer | relatable scenario, POV line, emotion beat, caveat, no fake first-person claims, no AI clichés, human-edit flag | §2.8 |
| Similarity | not too close to recent videos (structure/opening/visual sequence) | §5.1 |

---

## 8. Adaptive picker ("the algorithm")

- **Arms:** combinations of `hook_type × topic × length_bucket` (later: `top_panel_style`, `pose_sequence`, `posting_time`).
- **Reward (per video, after ~48 h):** weighted score, normalized against the channel's **own rolling baseline of the last 20 videos**:
  - 3-second hold / "viewed vs swiped" (hook)
  - average % viewed (body)
  - rewatch signal (audienceWatchRatio > 1 at the start, or loop proxy)
  - shares + **follows per 1K views** + profile visits per 1K views (secondary but important: followers gate monetization, §12.5)
- **Method:** Thompson sampling with **discounting** (recent results weigh more) so it adapts to trend shifts. Start ~70–80% exploit / 20–30% explore and let the sampler shift naturally.
- **Inputs from research:** weekly logged outliers from other channels (views ÷ followers, views ÷ account median) feed **new candidate arms**: hook patterns and topics, never copied scripts.
- **Output:** a daily plan, e.g. "2× shocking-number hooks on credit cards (winning), 1× test myth-vs-fact on taxes."

---

## 9. Proposed repo layout

```
finance-shorts/
├── RESEARCH_BRIEF.md          # this file
├── docs/
│   ├── STYLE_GUIDE.md         # character, colors, fonts, caption style, safe zones
│   └── POLICY_CHECKLIST.md    # §5 condensed into a pre-post checklist
├── channels/
│   └── finance-main.yaml      # character, voice id, palette, topics, hook library
├── assets/
│   ├── characters/<name>/     # pose layers, mouth shapes
│   └── LICENSES.md
├── research/                  # outlier tracker (SQLite + import CSV), hook leaderboard
├── scripts/                   # beat sheets (YAML), linter
├── voice/                     # TTS + alignment → word timings JSON
├── render/                    # Remotion project (or Python/FFmpeg)
├── analytics/                 # YouTube API pull, TikTok manual-entry importer
├── picker/                    # bandit + daily plan
└── publish/                   # export presets, captions/descriptions, disclosure checks
```

## 10. Build order (MVP → v1)

**Milestone 1: one finished TikTok video end-to-end (first priority)**
1. `style.tokens.json` + drawing primitives + stickman rig (~8 poses, mouth shapes, line boil) + 5–10 starter props (§1.2, §1.3).
2. Beat-sheet format + retention linter (§7).
3. Voice provider (ElevenLabs with timestamps) → word timings JSON with number normalization.
4. Renderer v0: layout, frame-0 hook, captions (karaoke-highlight default + keyword mode), pose switching, prop scenes, transition presets (§1.5), SFX track → 1080×1920 MP4, 61–75 s.
5. Visual regression contact sheet (poses + props) to lock the look.
6. Editor v0 (§1.6): preview + swap pose/prop/transition + re-voice one beat + approve/export.

**Milestone 2: learning loop (TikTok)**
6. Display API pull (velocity) + TikTok Studio CSV importer (+ optional screenshot import) (§5.7.1).
7. Outlier tracker + hook leaderboard (manual logging of other accounts' videos).
8. Picker once ~20–30 videos are posted.

**Later:** audited posting, more props/templates, YouTube Shorts/Reels, second channel.

## 11. Success metrics (first 60 days)
- Production: one video in ≤30 min of human time; 1–2 posts/day.
- Hook: 3-second hold trending above the channel's own baseline.
- Body: average % viewed at 61–75 s trending up week over week.
- Zero policy strikes or unoriginal flags.

## 12. Open questions (owner)
- ~~Which platform leads~~ → TikTok only for v1.
- ~~Top-panel visuals~~ → code-drawn doodle props, consistent style.
- ~~Voice~~ → ElevenLabs default, swappable.
- Final layout: stacked split (§1) vs full-frame illustrated scenes like the second reference (§1.1)? Make both a config option; owner picks after seeing Milestone 1.
- Stickman signature trait and name.
- Which specific ElevenLabs voice (pick from 3–5 test renders).
- Budget ceiling for APIs per month.
- Posting cadence target (1/day vs 2/day).

---

## 12.5 Growth funnel: retention → views → followers → money

The owner's chain: **retention → views → 10K followers (converts) → Creator Rewards → sponsorships.** Each link needs its own design and metric.

### Link 1–2: retention → views
Covered by §2 (retention rules), §1.5 (editing), §8 (picker). Metric: average % viewed, full-watch rate, 3 s hold.

### Link 3: views → followers (the conversion gap)
Views don't automatically become followers (see Dirty Dollars: 557K followers but recent parts at 2–6K views; how really?: 1.5M hit, 33.8K followers). Followers are needed for the 10K Creator Rewards gate and for sponsors.

- **Metrics to track per video:** profile visits per 1K views, follows per 1K views. One guide calls 1–3% of viewers following healthy and under 0.5% a sign of weak identity/series ([FluxNote](https://fluxnote.io/guides/how-to-grow-tiktok-followers)). Educational and series content tends to drive higher profile-visit rates than entertainment ([TT Calculator](https://ttcalculator.net/calculators/profile-visit-rate/)). Add **follows per 1K views** to the picker reward (§8).
- **Named series, not endless parts.** Series are widely described as the strongest follow trigger, because a follow "resolves" the open loop ([Kompozy](https://kompozy.io/creator-growth/get-more-followers-on-tiktok)). But avoid Dirty Dollars' "Part 424" fatigue: run **2–3 named recurring formats** (e.g. "Rich vs Broke", "Money myths", "How they actually got rich"), each episode with its own topic and cover; only start a series once a topic proves itself.
- **Soft follow CTA in the last 2–3 s** (not in the hook): "Part 2 on my page", "follow for the next trick". Subtle prompts are reported to work better than aggressive asks ([Marketing Agent](https://marketingagent.blog/2025/12/31/tiktok-profile-views-in-2026-the-conversion-metric-that-separates-viral-content-from-real-growth/)). Make the CTA line a linter-checked slot.
- **Profile = landing page:** one-line bio that says exactly what you get ("Money tricks the rich don't explain, drawn simply"), consistent grid look (§1.3), **pin the top 3 outliers** (like Null Monolith), profile photo = the stickman.
- **Character as the reason to follow:** a recognizable mascot with a personality (catchphrase, running jokes) gives people something to come back for. This is the one thing the copyrighted-character accounts can't own.
- **Comment loop:** reply to good comments with a video reply (cheap new content, strong conversion).

### Link 4: followers → Creator Rewards
- Gates: 10K followers, 100K views/30 days, 18+, personal account, eligible country, videos > 1 min (§5.6). Every video ships at 61–75 s from day one so the back catalog already qualifies.
- Owner action: confirm the account holder is 18+ and the account is a personal (not Business) account before posting.

### Link 5: audience → sponsorships & affiliates (where most money is)
- One 2026 estimate puts a typical TikTok creator's income mix at roughly half brand deals and only about a fifth Creator Rewards ([Virlo](https://virlo.ai/blog/what-content-makes-the-most-money-on-tiktok)). Finance is often quoted at a rate premium vs other niches ([TT Calculator](https://ttcalculator.net/calculators/brand-deal-rate/)).
- Brands weigh **engagement rate and niche fit over follower count**; small creators with strong engagement can land deals ([TT Calculator media kit guide](https://ttcalculator.net/learn/tiktok-media-kit/)).
- **Prepare early (~5K followers):** auto-generated **media kit** from our analytics DB (niche, audience geo/age, engagement rate, avg % viewed, best videos, rate card); TikTok Creator Marketplace profile; list of finance apps/fintechs already sponsoring creators.
- **Brand safety = sponsor eligibility:** no get-rich-quick, accurate claims, disclosures (§5.4–5.5). A clean history makes finance brands comfortable.
- **Affiliates:** only products the owner would actually recommend (budgeting apps, HYSAs, brokerages); always disclosed.

### Owned audience (platform-risk insurance)
- Single-platform risk is real (policy changes, flags, account issues). Once there's traction: a simple email list or newsletter link in bio, and cross-post to YouTube Shorts/Reels (also re-uses the same renders).

### Launch plan (first 30 days)
1. Before posting: bank **10–15 finished videos**, finished profile (bio, avatar, banner style), 2–3 named formats defined.
2. Weeks 1–2: post 1–2/day; vary hooks/topics deliberately (exploration phase for the picker).
3. Weeks 3–4: double down on the top 20% by retention and follows per 1K views; turn the best topic into a named series; pin top 3.
4. Weekly: competitor screenshots (Popular + Latest tabs), TikTok Studio CSV export, review dashboard.

## 13. Costs vs revenue (estimates, Oct 2026)

### 13.1 Monthly running costs (assume ~1 video/day, ~180 spoken words ≈ ~1,000 characters/video, ×2 for retries)

| Item | Lean setup | Full setup | Notes |
|---|---|---|---|
| ElevenLabs voice | $22 (Creator, ~100K–121K credits) | $22–99 | Starter (~$5–6) has commercial rights but only ~30K credits, too tight for daily posting with retries ([Hackceleration](https://www.hackceleration.com/labs/elevenlabs-pricing), [DEV/TechSifted](https://dev.to/techsifted/elevenlabs-pricing-2026-plans-credits-and-api-costs-explained-1549)) |
| Rendering (Remotion) | $0 | $0 | Free for individuals and companies of up to 3 people, commercial use included ([Remotion LICENSE](https://cdn.jsdelivr.net/npm/remotion@4.0.529/LICENSE.md)). Render locally |
| Script drafting LLM | ~$0–20 | ~$10–30 | Estimate; $0 if drafting in an existing Claude plan |
| Scheduler / posting | $0 (manual upload) | ~$29 (e.g. Blotato Starter) | Already-audited TikTok posting ([That Marketing Buddy](https://thatmarketingbuddy.com/pricing/blotato)) |
| Props/scene art | $0 (draw a reusable prop library once) | ~$10–30 | Estimate, if using an image model for new props |
| Character design | $0 DIY | one-time ~$50–300 | Estimate, if commissioning an artist |
| **Total** | **~$25–45/mo** | **~$80–180/mo** | Plus your time: ~20–30 min/video ≈ 10–15 h/month at 1/day |

### 13.2 Revenue per platform (direct payouts only)

| Platform | Unlocks at | Reported pay | Per 1M views |
|---|---|---|---|
| TikTok Creator Rewards | 10K followers + 100K views/30 days, 18+, videos > 1 min | $0.40–1.00 per 1K *qualified* views ([AITuber Marketing](https://aituber-marketing.pages.dev/blog/how-much-does-tiktok-pay-per-view)); other reports range much lower ([FluxNote](https://fluxnote.io/guides/how-much-tiktok-pays-for-1-million-views-2026)) | ~$400–1,000 (qualified views; total views will be higher) |
| YouTube Shorts | 1K subs + 10M Shorts views in 90 days | Most creators $0.02–0.30 per 1K; finance occasionally $0.50–1.50 ([Lilach Bullock](https://www.lilachbullock.com/?p=116686)) | ~$20–300 (good months more) |
| Instagram Reels | — | No standard pay-per-view; bonuses are invite-only ([Gerald](https://joingerald.com/learn/work--income/instagram-reels-income)) | ~$0 (use for audience + affiliates) |
| Affiliates / sponsors | Once there's an audience | Brand deals often quoted CPM-style, far above platform payouts ([Unilink](https://app.unilink.us/blog/how-much-does-youtube-pay-per-1000-views)) | Biggest upside long-term |

### 13.3 Scenarios (TikTok + YouTube, after both are monetized)

| Scenario | Monthly views (per platform) | Est. revenue | vs. lean cost (~$40) |
|---|---|---|---|
| Months 1–3, building | — | $0 (not eligible yet) | −$75 to −$135 total |
| Modest | 1M TikTok qualified + 1M YouTube | ~$420–1,300 | Profitable |
| Rent-level target (~$1,250/mo) | ~1.25–3M qualified TikTok views + YouTube on top | ~$1,250+ | Profitable |
| Strong (reference-account level) | Reference grid averages ~250K views/video, so ~7M/mo at 1/day | ~$3,000–8,000 | Very profitable, but survivorship risk |

**Takeaways**
- **Money cost is low.** The real costs are time and the follower/view thresholds before any payout.
- **TikTok pays far more per view than Shorts** for 61 s+ videos, so TikTok leads monetization. YouTube leads automated analytics (§5.7). Instagram is for audience and affiliates.
- **Break-even is tiny** (~100K qualified TikTok views/month covers lean costs). The hard part is getting to 10K followers.
- Payout rates are self-reported by creators and tool vendors, so they vary widely. Re-check after the first paid month.

---

### Sources
Inline links above. Many retention and tool claims come from vendor blogs (marked "as reported"); platform-policy points link to TikTok's own pages where possible. Re-verify policy items before launch, since they change often.

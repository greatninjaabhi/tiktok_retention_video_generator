# mascot_v1 — design record (proof of origin)

- **Created:** 2026-10-31, in this repository (see git history for this folder and `render/character/`).
- **How it's made:** entirely procedural. Code in `render/character/` draws the character from the data in `character.ts` (proportions in head units, joint-angle poses, expressions, mouth shapes), using the shared primitives in `render/draw/pen.ts`. No image, reference sheet or AI image model was used.
- **Name:** placeholder `mascot_v1` until the owner picks one (brief §12).

## Look

| Part | Spec |
|---|---|
| Head | Circle, 1 HU across (defines the head unit, 80 px), white fill, ink outline |
| Body | Single-line torso, arms and legs; small outward foot ticks |
| **Signature trait** | **Bold blue necktie** (`signature` color, used by nothing else), with a knot under the neck. It swings as secondary motion |
| Face | Dot eyes, optional brows, one-line or filled mouth |
| Height | ≈ 5 HU standing |

The tie was chosen because the channel's angle is "how the rich play the game, explained for normal people" (brief §1.1–1.2): it suggests "suit" at thumbnail size with one shape and one color.

## Poses (v1)
`idle`, `point_up` (at the top panel), `present`, `shocked`, `thinking`, `shrug`, `celebrate`, `hold` (a prop between the hands).

## Expressions (v1)
`neutral`, `smug`, `shocked`, `sad`, `thinking`, `excited`, `side_eye`, plus talking mouth shapes `closed`, `small`, `open`, `round`, `wide` and a blink.

## Originality check (owner to confirm)
Stick figures in general are generic. What makes this one ours is the combination of the blue tie, the white filled head and our wobble/boil style. Before launch, the owner should do a quick visual search to confirm it doesn't look like an existing stick-figure character from a game, comic or show (brief §1.2).

## Changelog
- v1 (2026-10-31): first version.

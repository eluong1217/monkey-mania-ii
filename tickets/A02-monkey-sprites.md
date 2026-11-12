# A02 — Monkey sprites

- **Assignee:** Gemini (Google AI Pro) + you
- **Depends on:** A01 (and `assets/README.md` from T15 for exact sizes, once it exists)
- **Status:** done

## Goal
One low-poly monkey in a small set of poses, in four colour/accessory variants. This is the hardest art ticket: generators struggle to keep a 3D-looking character identical between poses, so the pose count is deliberately small and the game adds motion in code.

## Target spec
- Frame size 64×64, transparent background.
- Poses: idle (1), run (2), action/shove-throw (1), stunned (1), out (1), win (1). Seven frames in total.
- Two views: three-quarter top-down (used by three mini-games) and side (Fruit Frenzy). Do the top-down set first.

## Steps
1. Generate the base monkey (red, bandana) with the prompt below, attaching the A01 style sheet.
2. If poses drift (different proportions, face or accessory), ask in the same chat for the odd one to be redone "matching the first pose exactly". Generating poses one at a time with the idle pose attached as reference often works better than one big sheet.
3. In an image editor: remove the magenta background, crop each pose to the same framing, and downscale to 64×64. Use a smooth downscale here, not nearest-neighbour; the slight blur suits the style.
4. Make the other three variants by asking Gemini to recolour the finished red sheet and swap the accessory ("same image, change only the fur colour to blue and replace the bandana with a cap").
5. Export one horizontal sprite sheet per variant per view, named per the manifest.

## Prompt
> 3D render of a sprite sheet of the red cartoon monkey with a bandana from the attached style sheet, seen from a three-quarter top-down camera, isolated on a plain solid magenta background with no ground and no cast shadow. One row of seven evenly spaced poses, same size and same camera angle in each: standing idle, running (two different stride poses), arm thrust forward shoving, dizzy and wobbling, knocked out lying down, cheering with arms up. Keep the model, proportions, colours and bandana identical in every pose.
>
> [style block from docs/DESIGN.md]

For the side view, replace "seen from a three-quarter top-down camera" with "seen from a side-on camera, facing right".

## Fallback
If consistency is not good enough after a few tries, use a single idle pose per monkey and let T16/T17 animate everything in code, or use a CC0 low-poly character pack.

## Done when
- Eight sheets (4 variants × 2 views) sit in `assets/sprites/monkeys/` and match the manifest sizes.
- Flipping between poses in an image viewer does not show the character changing shape or colour.

## Notes
- Delivered 2026-11-12: eight sheets in `assets/sprites/monkeys/`, named `monkey_<red|blue|green|yellow>_<top|side>.png`, each 448×64 (seven 64×64 frames, transparent).
- Frame order: idle, run 1, run 2, shove, stunned, out, win. Side sheets face right.
- The "top" sheets are a front three-quarter view at eye level, not from above; accepted because they read well on the top-down backgrounds.
- Known blemishes: green has a cap brim in the side view but a bare head in the top view; the accessory is missing in the knocked-out side frame for red, blue and green; a faint pink edge shows on some outlines against light backgrounds.
- `monkey_red_side.png` frame 5 (stunned) was taken from an earlier generation than the other six frames.
- Raw Gemini sheets are kept in `assets/_source/`.

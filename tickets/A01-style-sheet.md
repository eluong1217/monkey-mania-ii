# A01 — Style sheet

- **Assignee:** Gemini (Google AI Pro) + you
- **Depends on:** —
- **Status:** done

## Goal
One reference image that every later art prompt attaches, so the game looks like it came from one studio.

## Steps
1. In Gemini, attach `MonkeyMania.jpeg` from the project (for the jungle mood and the monkey, not the rendering style) and run the prompt below. Generate several and pick one.
2. Save the chosen sheet as `assets/style/style-sheet.png`.
3. Attach the style sheet to every prompt in A02–A04, and always end those prompts with the style block from `docs/DESIGN.md`.

## Prompt
> 3D rendered character and prop reference sheet for a party video game called "Monkey Mania II" set in a dense tropical jungle. On one sheet, evenly spaced on a plain solid magenta background with no ground: four cartoon monkeys of the same model in different colours (red with a bandana, blue with a cap, yellow with sunglasses, green with a flower), each seen from a three-quarter top-down camera; an apple, a banana, a pineapple and a coconut; and a small chunk of jungle ground with a palm.
>
> Early-2000s sixth-generation console video game graphics. Low-poly 3D model with blocky, angular geometry, visible polygon facets and sharp edges. Low-resolution, slightly blurry bitmap textures wrapped onto the surface. Flat vertex lighting from the upper left with soft baked shadows; no ray tracing, no realistic reflections, no modern shaders. Bright, saturated tropical colours with a playful, cartoonish party-game mood. Y2K retro gaming aesthetic. No text, no logos, no user interface, no borders, no scanlines.

## Done when
- One style sheet is saved in `assets/style/`.
- The four monkeys are distinguishable in greyscale by their accessory alone.
- The look is bright and playful, not dark or gritty.

## Notes
- Delivered 2026-11-12 at `assets/style/style-sheet.png`.
- The sheet differs from the prompt: green wears the sunglasses and yellow wears the flower. All later art follows the sheet, so the mapping is red = bandana, blue = cap, green = sunglasses, yellow = flower.

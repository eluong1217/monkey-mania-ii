# A04 — Backgrounds and title art

- **Assignee:** Gemini (Google AI Pro) + you
- **Depends on:** A01
- **Status:** done

## Goal
One background per mini-game plus title and lobby art. This is where image generation helps most; these need the least cleanup.

## Asset list (generate at 16:9, then smooth-downscale to 640×360)
- `fruit-frenzy`: side-on jungle clearing with a flat ground strip along the bottom and open sky/canopy above.
- `coconut-dodge`: top-down sandy beach clearing ringed by palms; the centre must be plain so shadows read clearly.
- `banana-heist`: top-down jungle floor with four distinct corners and an open middle.
- `king-of-the-stump`: top-down view into a misty canopy or river far below; the stump from A03 sits on top.
- Title screen: a lush jungle scene with space for the logo.
- Lobby: a calm treehouse or campfire scene with room for four seat panels.

## Prompt template
> 3D rendered game environment: [SCENE DESCRIPTION FROM THE LIST], 16:9, seen from a [top-down / side-on] camera. Keep the central play area low-contrast and uncluttered so small characters stand out against it. No characters, no fruit.
>
> [style block from docs/DESIGN.md]

For the logo, generate the scene without text and add the "Monkey Mania II" lettering yourself in the menu font from T18; generated lettering is rarely clean.

## Done when
- Six images in `assets/backgrounds/`, named per the manifest.
- A monkey sprite from A02 placed on each gameplay background is clearly readable and its camera angle matches the scene.

## Notes
- Delivered 2026-11-12: `fruit-frenzy`, `coconut-dodge`, `banana-heist`, `king-of-the-stump`, `title` and `lobby` in `assets/backgrounds/`, each 640×360 PNG.
- `king-of-the-stump.png` was regenerated without a stump so the A03 stump sprite sits on top. It is viewed from a steep angle, not perfectly straight down.
- Readability test composites are in `art-previews/` at the project root; they are not game assets.
- The title art has no lettering; the logo is added in T18.

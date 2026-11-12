# A03 — Fruit, props and UI kit

- **Assignee:** Gemini (Google AI Pro) + you
- **Depends on:** A01
- **Status:** done

## Goal
Every non-character object and the menu kit.

## Asset list
- 32×32: apple, banana, golden pineapple, rotten fruit (must read as bad by shape, e.g. flies or a bite, not just colour), coconut, coconut shadow target, banana pile.
- 64×64: four corner stashes (crates or baskets marked with each monkey's accessory), stun stars, dust puff, splat.
- Tree-stump platform: a round top-down stump, about 256×256, that still looks right when scaled down.
- UI: button (normal / focused / pressed), panel frame as a 9-slice, ready tick, crown, timer icon, four seat badges, cooldown ring.

## Steps
1. Run the prompts below with the A01 style sheet attached. Ask for a few objects per image; small props come out better in small batches.
2. In an image editor: remove the magenta background, crop each object, downscale to the listed size with a smooth downscale.
3. Export to `assets/sprites/props/` and `assets/ui/`, named per the manifest.

## Prompts
> 3D render of game item props, each whole and centred in its own space, evenly spaced in a grid, all seen from the same three-quarter top-down camera, isolated on a plain solid magenta background with no ground and no cast shadow: a red apple, a banana, a shiny golden pineapple, a rotten brown fruit with flies, a coconut, and a pile of bananas.
>
> [style block from docs/DESIGN.md]

> 3D render of a video game menu kit seen straight on, isolated on a plain solid magenta background: a chunky rounded button in three states (normal, glowing highlighted, pressed in), a rectangular panel frame with bevelled edges and leafy corners, a green tick, a gold crown, a stopwatch, and four round badges in red, blue, yellow and green. Glossy bevelled early-2000s console menu styling.
>
> [style block from docs/DESIGN.md]

## Done when
- Every item in the asset list exists at the right size with a transparent background.
- Rotten fruit is identifiable in greyscale.
- All props share the same camera angle and light direction.

## Notes
- Delivered 2026-11-12. Props are in `assets/sprites/props/`, UI in `assets/ui/`, all transparent PNGs.
- 32×32: `apple`, `banana`, `pineapple_golden`, `rotten_fruit`, `coconut`, `coconut_shadow_target`, `banana_pile`.
- 64×64: `stash_red`, `stash_blue`, `stash_green`, `stash_yellow`, `stun_stars`, `dust_puff`, `splat`.
- 256×256: `tree_stump_platform` (true top-down).
- UI sizes for the T15 manifest: `button_normal` / `button_focused` / `button_pressed` 96×64, `panel_frame` 256×208, `ready_tick` / `crown` / `timer_icon` 64×64, `seat_badge_<colour>` 48×48, `cooldown_ring` 96×96 (plain white, meant to be tinted in code).
- The buttons are chunky 3D slabs, squarer than a typical menu button; T18 should plan label layout around that.
- Known blemishes: `banana` is a bunch of three and looks similar to `banana_pile` at 32px; the pineapple is not obviously golden; `splat` has a red sliver on its right edge; a faint purple smudge sits under the coconut and a thin pink rim on the focused button glow.
- Raw Gemini sheets are kept in `assets/_source/`.

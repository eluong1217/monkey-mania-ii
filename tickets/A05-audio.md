# A05 — Sound effects and music

- **Assignee:** You
- **Depends on:** —
- **Status:** todo

## Goal
A small, cohesive sound set with clear licences, in an upbeat early-2000s console party-game style.

## Sound list
- UI: move focus, confirm, back, ready, countdown beep, countdown go.
- Shared: shove, stun, eliminated, round win sting, match win fanfare, point tick.
- Fruit Frenzy: catch (three pitches for apple / banana / pineapple), rotten catch.
- Coconut Dodge: coconut whistle, coconut impact, roll.
- Banana Heist: pick up, deposit, steal, throw, coconut hit.
- King of the Stump: shove hit, fall off.
- Music: lobby loop, gameplay loop, results sting.

## How
- Effects: take them from a CC0 pack such as Kenney's audio packs, or synthesise simple ones with jsfxr. Keep everything in one style.
- Music: a CC0 or clearly licensed upbeat loop (tropical, funky, early-2000s console feel), or generate one if a tool you already have supports it. Check the licence allows use in a public game.
- Export effects as short `.ogg` (with `.mp3` fallback if T15 asks for it), normalised to similar loudness.
- Record source and licence for every file in `assets/audio/CREDITS.md`.

## Done when
- Every sound in the list exists in `assets/audio/`, named per the manifest.
- `CREDITS.md` is complete.

## Notes

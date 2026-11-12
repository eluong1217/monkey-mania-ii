# Assets

`manifest.json` is the list of every sprite, image and sound the game looks up by key. It is the spec the art and audio tickets (A02–A05) deliver against. Drop a file at the listed path with the listed size and reload: it replaces the generated placeholder. A missing file never breaks the game (images get a labelled placeholder, audio stays silent).

To add an asset, add an entry to `manifest.json` (keys and files must be unique; `npm test` checks this, and that every animation lies inside its sheet) and update the table here. `_source/` holds raw generator output and is never served.

Sizes are logical pixels (the game is 640×360). PNG with transparency, except backgrounds. Audio is `.ogg`.

## Sprite sheets (one horizontal row of frames)

| Key | File | Frame | Frames | Animations (frames, fps) |
|---|---|---|---|---|
| `monkey_red_top` | `sprites/monkeys/monkey_red_top.png` | 64×64 | 7 | idle 0 @1, run 1-2 @8, shove 3 @1, stunned 4 @1, out 5 @1, win 6 @1 |
| `monkey_blue_top` | `sprites/monkeys/monkey_blue_top.png` | 64×64 | 7 | idle 0 @1, run 1-2 @8, shove 3 @1, stunned 4 @1, out 5 @1, win 6 @1 |
| `monkey_yellow_top` | `sprites/monkeys/monkey_yellow_top.png` | 64×64 | 7 | idle 0 @1, run 1-2 @8, shove 3 @1, stunned 4 @1, out 5 @1, win 6 @1 |
| `monkey_green_top` | `sprites/monkeys/monkey_green_top.png` | 64×64 | 7 | idle 0 @1, run 1-2 @8, shove 3 @1, stunned 4 @1, out 5 @1, win 6 @1 |
| `monkey_red_side` | `sprites/monkeys/monkey_red_side.png` | 64×64 | 7 | idle 0 @1, run 1-2 @8, shove 3 @1, stunned 4 @1, out 5 @1, win 6 @1 |
| `monkey_blue_side` | `sprites/monkeys/monkey_blue_side.png` | 64×64 | 7 | idle 0 @1, run 1-2 @8, shove 3 @1, stunned 4 @1, out 5 @1, win 6 @1 |
| `monkey_yellow_side` | `sprites/monkeys/monkey_yellow_side.png` | 64×64 | 7 | idle 0 @1, run 1-2 @8, shove 3 @1, stunned 4 @1, out 5 @1, win 6 @1 |
| `monkey_green_side` | `sprites/monkeys/monkey_green_side.png` | 64×64 | 7 | idle 0 @1, run 1-2 @8, shove 3 @1, stunned 4 @1, out 5 @1, win 6 @1 |

Frame order for monkeys: idle, run 1, run 2, shove/throw, stunned, out, win. Side sheets face right. Variants follow slot order: red (P1), blue (P2), yellow (P3), green (P4).

## Images

| Key | File | Size |
|---|---|---|
| `apple` | `sprites/props/apple.png` | 32×32 |
| `banana` | `sprites/props/banana.png` | 32×32 |
| `pineapple_golden` | `sprites/props/pineapple_golden.png` | 32×32 |
| `rotten_fruit` | `sprites/props/rotten_fruit.png` | 32×32 |
| `coconut` | `sprites/props/coconut.png` | 32×32 |
| `coconut_shadow_target` | `sprites/props/coconut_shadow_target.png` | 32×32 |
| `banana_pile` | `sprites/props/banana_pile.png` | 32×32 |
| `stash_red` | `sprites/props/stash_red.png` | 64×64 |
| `stash_blue` | `sprites/props/stash_blue.png` | 64×64 |
| `stash_green` | `sprites/props/stash_green.png` | 64×64 |
| `stash_yellow` | `sprites/props/stash_yellow.png` | 64×64 |
| `stun_stars` | `sprites/props/stun_stars.png` | 64×64 |
| `dust_puff` | `sprites/props/dust_puff.png` | 64×64 |
| `splat` | `sprites/props/splat.png` | 64×64 |
| `tree_stump_platform` | `sprites/props/tree_stump_platform.png` | 256×256 |
| `bg_fruit-frenzy` | `backgrounds/fruit-frenzy.png` | 640×360 |
| `bg_coconut-dodge` | `backgrounds/coconut-dodge.png` | 640×360 |
| `bg_banana-heist` | `backgrounds/banana-heist.png` | 640×360 |
| `bg_king-of-the-stump` | `backgrounds/king-of-the-stump.png` | 640×360 |
| `bg_title` | `backgrounds/title.png` | 640×360 |
| `bg_lobby` | `backgrounds/lobby.png` | 640×360 |
| `button_normal` | `ui/button_normal.png` | 96×64 |
| `button_focused` | `ui/button_focused.png` | 96×64 |
| `button_pressed` | `ui/button_pressed.png` | 96×64 |
| `panel_frame` | `ui/panel_frame.png` | 256×208 |
| `ready_tick` | `ui/ready_tick.png` | 64×64 |
| `crown` | `ui/crown.png` | 64×64 |
| `timer_icon` | `ui/timer_icon.png` | 64×64 |
| `seat_badge_red` | `ui/seat_badge_red.png` | 48×48 |
| `seat_badge_blue` | `ui/seat_badge_blue.png` | 48×48 |
| `seat_badge_yellow` | `ui/seat_badge_yellow.png` | 48×48 |
| `seat_badge_green` | `ui/seat_badge_green.png` | 48×48 |
| `cooldown_ring` | `ui/cooldown_ring.png` | 96×96 |

## Audio

| Key | File | Kind |
|---|---|---|
| `ui_move` | `audio/ui_move.ogg` | effect |
| `ui_confirm` | `audio/ui_confirm.ogg` | effect |
| `ui_back` | `audio/ui_back.ogg` | effect |
| `ui_ready` | `audio/ui_ready.ogg` | effect |
| `countdown_beep` | `audio/countdown_beep.ogg` | effect |
| `countdown_go` | `audio/countdown_go.ogg` | effect |
| `shove` | `audio/shove.ogg` | effect |
| `stun` | `audio/stun.ogg` | effect |
| `eliminated` | `audio/eliminated.ogg` | effect |
| `round_win` | `audio/round_win.ogg` | effect |
| `match_win` | `audio/match_win.ogg` | effect |
| `point_tick` | `audio/point_tick.ogg` | effect |
| `ff_catch_apple` | `audio/ff_catch_apple.ogg` | effect |
| `ff_catch_banana` | `audio/ff_catch_banana.ogg` | effect |
| `ff_catch_pineapple` | `audio/ff_catch_pineapple.ogg` | effect |
| `ff_rotten` | `audio/ff_rotten.ogg` | effect |
| `cd_whistle` | `audio/cd_whistle.ogg` | effect |
| `cd_impact` | `audio/cd_impact.ogg` | effect |
| `cd_roll` | `audio/cd_roll.ogg` | effect |
| `bh_pickup` | `audio/bh_pickup.ogg` | effect |
| `bh_deposit` | `audio/bh_deposit.ogg` | effect |
| `bh_steal` | `audio/bh_steal.ogg` | effect |
| `bh_throw` | `audio/bh_throw.ogg` | effect |
| `bh_hit` | `audio/bh_hit.ogg` | effect |
| `kots_hit` | `audio/kots_hit.ogg` | effect |
| `kots_fall` | `audio/kots_fall.ogg` | effect |
| `music_lobby` | `audio/music_lobby.ogg` | music loop |
| `music_gameplay` | `audio/music_gameplay.ogg` | music loop |
| `music_results` | `audio/music_results.ogg` | music loop |

Record the source and licence of every audio file in `audio/CREDITS.md`.

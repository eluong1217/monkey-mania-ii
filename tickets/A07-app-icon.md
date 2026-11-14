# A07 — App icon and favicon

- **Assignee:** Gemini (Google AI Pro) + you
- **Depends on:** A01, A02
- **Status:** done

## Goal
One icon that stands for the game on an iPhone Home Screen and in a browser tab.

## How it is used (read before generating)
- **iOS Home Screen** shows a 180×180 PNG and rounds the corners itself. Transparent areas turn black, so the icon is a full square with no transparency.
- **Browser tab** shows it at 32×32 or 16×16, so it needs one bold shape that still reads when tiny.
- Unlike A02–A04, this image is not cut out, so it is generated on its final background, not on magenta.

## Asset
- **Subject:** the head of one monkey with its accessory, centred, seen straight on. Use the red P1 monkey with the bandana (the A02 base model); red on green gives the strongest contrast. A 2×2 grid of all four heads is unreadable at 32 px, so do not use one.
- **Background:** solid jungle green or a simple green gradient, lighter in the middle, to match the title screen (gold on green). No scenery.
- **Safe area:** everything that matters sits inside the middle 80% of the square, so the iOS rounded corners never clip it.
- **No text, letters or logos.**

| File | Size | Notes |
|---|---|---|
| `assets/_source/app_icon_raw.*` | as generated | raw Gemini output, never served |
| `assets/_source/app_icon_master.png` | 1024×1024 | cropped and cleaned master, no transparency |
| `assets/icons/apple-touch-icon.png` | 180×180 | iOS Home Screen |
| `assets/icons/icon-192.png` | 192×192 | Android, for a future web manifest |
| `assets/icons/icon-512.png` | 512×512 | Android, for a future web manifest |
| `assets/icons/favicon-32.png` | 32×32 | browser tab |
| `assets/icons/favicon-16.png` | 16×16 | browser tab |

## Steps
1. Run the prompt below with the A01 style sheet (`assets/style/style-sheet.png`) and the idle frame of `assets/sprites/monkeys/monkey_red_top.png` attached. Ask for three or four variations.
2. Pick one by shrinking each to 32 px in an image viewer; keep the one that still reads as a monkey with a bandana.
3. In an image editor: crop to a square, scale to 1024×1024, check the head sits inside the central 820×820, paint out any text, rounded corners or border the generation added, and flatten so there is no alpha channel. Save it as the master.
4. Downscale the master to 512, 192 and 180 with a smooth downscale.
5. For 32 and 16: start from the master, crop tighter to the face if it helps it fill the square, downscale smoothly, and sharpen lightly if it turns to mush.
6. Export all five as PNG with no transparency to `assets/icons/`.

## Prompt
> 3D render of a square video game app icon: the head of the red cartoon monkey with a bandana from the attached style sheet and reference image, seen straight on from the front with a big cheerful grin, centred in the image with clear space around it on all sides. Plain bright jungle-green background with a soft gradient, lighter behind the head. Bold, simple silhouette that is easy to recognise when very small: big head, big eyes, the bandana clearly visible. Head only, no body, no ground, no scenery. The image fills the whole square edge to edge: no rounded corners, no frame, no border. Square 1:1 image.
>
> [style block from docs/DESIGN.md]

## Done when
- All five files in `assets/icons/` exist at the listed sizes, and `sips -g hasAlpha` reports `no` for each.
- At 32×32 and 16×16 the favicon reads as a monkey head; at 180×180 the bandana is clearly visible.
- On the 180×180 icon nothing important lies in the outer 10% on any side.
- The monkey matches A02 (face, fur colour and bandana) and the look matches the A01 style sheet.
- No text, letters or logos appear anywhere.
- The raw output and the 1024 master are in `assets/_source/`.

## Out of scope
Linking the icon into the page (T28). A web app manifest, a `favicon.ico`, icons for the other three monkeys, animated icons.

## Notes

## Handoff

- **Built:** `assets/_source/app_icon_raw.jpeg` (2048×2048, one Gemini generation, used as is) was downscaled with `sips` to the 1024 master `assets/_source/app_icon_master.png`, then to `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png`. `favicon-32.png` and `favicon-16.png` come from a tighter central 860×860 crop of the master so the face fills more of the square.
- **Verified:** `sips -g hasAlpha` reports `no` for the master and all five icons; sizes are as listed. At 32 px, enlarged, it still reads as a monkey with a red bandana. Head and ears span about 10–89% horizontally and 18–79% vertically in the master, so nothing lies in the outer 10% except the bandana tail and the left ear tip, which touch the 10% line.
- **Not checked:** 16 px was not inspected by eye; no image editor was used, so there was no manual cleanup (the raw had no text, border or rounded corners). One variation only, not three or four.
- **For T28:** link `assets/icons/apple-touch-icon.png` as `apple-touch-icon` and the two favicon PNGs as `icon` with `sizes="32x32"` / `"16x16"`. `icon-192.png` and `icon-512.png` are for a future manifest.

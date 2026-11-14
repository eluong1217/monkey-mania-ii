# A06 — Arcade cabinet frame art

- **Assignee:** Gemini (Google AI Pro) + you
- **Depends on:** A01
- **Status:** done

## Goal
One image of an arcade cabinet that fills the spare window space around the game, so the game looks like it is playing on that machine's screen.

## How it is used (read before generating)
The game canvas is 640×360, scaled by whole multiples, so the space around it changes with the window. T27 centres this image behind the canvas and lets the window crop it. The canvas always covers the middle of the image; how much of the rest shows depends on the window:

- A window only slightly larger than the game shows just the screen bezel.
- A typical laptop window shows the bezel, the lower edge of the marquee, the top of the control panel and part of the cabinet sides, with more at the sides than above and below.
- Only a window almost twice the game's size shows the whole image.

So the important detail belongs close to the screen, and nothing near the image edges may matter.

## Asset
`assets/ui/arcade_frame.jpg`, 2560×1440, no transparency.

- The screen opening is centred and sits just inside the central 1280×720 pixels (exactly half the width and half the height). It may be up to 8 px smaller on each side, never larger; the game canvas is drawn over it.
- The screen is a flat 16:9 rectangle with at most slightly rounded corners, seen straight on. A bulging, tilted or strongly rounded screen will not line up with a rectangular canvas.
- Bezel around the screen: black, roughly 50–100 px thick in the final file. Thicker and it is all anyone sees.
- Above the bezel: a backlit marquee about as wide as the screen and roughly 150 px tall, showing a jungle-leaf pattern and no lettering. Its lower edge sits directly on the bezel so it is the first thing to appear as the window grows.
- Below the bezel: the control panel, starting directly under it. Four joysticks in a row, each with one round button beside it, in the four seat colours from left to right: red, blue, yellow, green. The cabinet below the panel fades to black.
- At the sides: the cabinet's side panels with a coloured edge trim, starting directly beside the bezel, then a dim arcade room.
- The room fades to solid black at all four image edges, so the image blends into the black page on very wide windows.
- Muted colours and low contrast compared with the game art. The marquee glow and the joystick colours are dimmed; the frame must not compete with the picture.

## Steps
1. Run the prompt below with the A01 style sheet attached.
2. In an image editor: scale and crop to 2560×1440 so the magenta screen is centred and fits the rule above. Stretch the image slightly if the screen is not quite 16:9.
3. Fill the magenta screen with black, and fade the outer edges to black if the generation did not.
4. Paint out any lettering or logos the generation added to the marquee or the panel.
5. Export as JPEG at about 85% quality (aim for under 600 KB).

## Prompt
> 3D render of a chunky early-2000s four-player arcade cabinet seen perfectly straight on, centred, in a dim arcade at night. The cabinet has a flat, rectangular 16:9 widescreen monitor with only slightly rounded corners, set in a thick black bezel. Directly above the bezel is a softly backlit marquee with a jungle-leaf pattern and no text. Directly below the bezel is a wide control panel with four ball-top joysticks in a row, each with one round button next to it, coloured red, blue, yellow and green from left to right. The cabinet's side panels with coloured edge trim are visible at the left and right of the screen. The monitor is switched off and shown as a plain, flat, solid magenta rectangle with no reflections. The monitor fills the middle half of the image width and height, so the top of the marquee and the bottom of the cabinet run out of frame. Around the cabinet is a dark, out-of-focus arcade room that fades to black at the edges of the image. Muted, desaturated colours; the cabinet must not be colourful. No text, letters or logos anywhere. 16:9 image.
>
> [style block from docs/DESIGN.md]

## Done when
- `assets/ui/arcade_frame.jpg` exists at 2560×1440.
- A 1280×720 rectangle centred on the image covers the whole screen opening, with bezel visible on all four sides of it.
- The marquee's lower edge and the joysticks are inside the central 1600×900 pixels, so a typical laptop window shows them.
- The image edges are black.
- No lettering or logos appear anywhere.
- With a gameplay screenshot pasted over the centre, the frame reads as an arcade cabinet and the game is still the brightest thing in view.

## Out of scope
Glass glare, scanlines or any overlay drawn on top of the game (the optional CRT filter is T17). Brand names, logos or the game's title on the marquee. Animated or interactive cabinet parts.

## Notes

## Handoff
- **Built:** `assets/ui/arcade_frame.jpg`, 2560×1440, 142 KB (JPEG q85). Made from the raw Gemini generation `assets/ui/arcade_frame.jpeg` (2752×1536, kept as the source). Steps: perspective-warped the trapezoid magenta screen to a flat 1264×711 rectangle centred in the image, squeezed the plain cabinet gap above the screen (so the marquee's lower edge sits about 75 px above the bezel) and below it (so the joystick balls sit just under the bezel), painted a 56 px black bezel with slightly rounded corners over the screen opening and filled the opening black, and faded the outer 160 px to black.
- **Verified:** file size and dimensions with `sips`; viewed the result. Screen opening is exactly centred, so a 1280×720 centre rectangle covers it with bezel on all four sides. No lettering or logos. Not yet checked with a gameplay screenshot pasted over the centre; T27 will show that.
- **Known gaps:** the marquee's lower edge is inside the central 1600×900, but the joystick balls only just reach it (their tops are at y≈1130–1150, the bases are below y=1170), so a laptop window shows only the tops of the sticks. The red joystick ball is slightly clipped by the bezel. Each player has two or three buttons instead of one, and two white buttons sit between the blue and yellow sticks. The marquee is brighter than "muted" and the side trim is the red and teal of the generation, not tuned to the four seat colours. Regenerate or retouch if any of that matters.
- **For T27:** use `assets/ui/arcade_frame.jpg` (not `.jpeg`). The screen opening is x 648–1912, y 365–1076 in the 2560×1440 image.

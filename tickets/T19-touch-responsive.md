# T19 — Touch controls and scaling

- **Assignee:** Sonnet
- **Depends on:** T09
- **Status:** todo

## Goal
A friend who opens the invite link on a phone can play.

## Scope (`packages/client`)
- On touch devices: a floating virtual stick on the left half of the screen and a large action button on the right. Both produce the same `PlayerInput` as the keyboard.
- Canvas scales to fit any viewport at the largest integer multiple that fits, letterboxed; falls back to fractional scaling only on very small screens.
- Landscape is required on phones; show a "rotate your device" prompt in portrait.
- Touch targets in menus are at least 44 CSS pixels. Respect safe-area insets.
- Pausing the tab or locking the phone sends neutral input and resumes cleanly.

## Done when
- A full match is playable on one iOS Safari and one Android Chrome phone (note the devices in Handoff).
- Desktop behaviour is unchanged.
- Rotating the device mid-round does not break layout or input.

## Out of scope
Native app wrappers, gamepad support.

## Handoff

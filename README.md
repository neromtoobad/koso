# KOSO

**Spin it. Clash it. Take their top.**

Play: **https://koso.nerom.site**

KOSO is a spinning-top battle game from a Lagos compound. You wind your wooden top (a *koso*), throw it into a chalk ring, and try to knock the other kid's top out, or keep spinning after theirs falls over. Best of 3. The winner takes the koso.

Built from scratch for **Twigpine Project Treetop, Round 01 (Games)**, 9 to 16 October 2026.

## How to play

1. **Wind and throw.** Drag back from your top to aim at the ring. A white ring shrinks around your hand. Let go when it meets the gold ring:
   - **PERFECT** gives full spin.
   - A late or early release gives a looser top.
2. **Steer and GBAM.** Steer with your thumb (or WASD / arrows). **GBAM** (or Space) charges at the other top, but costs a little spin.
3. **Win the round.** Knock their top out of the chalk ring, or outlast it. Below a quarter spin a top starts to wobble, and at zero it falls over.

## The street ladder

Beat five compound kids in a row. Every win takes their top, and you can throw it in later matches.

| Kid | Top | What's on the ground |
|---|---|---|
| Tunde | Baby Koso | nothing, he's just starting |
| Kemi | Dart (fast, light) | sand patches that slow you down |
| Big Sola | Iroko (heavy) | bottle caps that scatter |
| Ify | Wahala (dashes a lot) | a chicken wanders through the ring |
| Oga Nail | Nail Tip | Mama's broom sweeps across mid-round |

Beat Oga Nail to become **Street Champion** and post your time.

**2 Players** puts both players on one phone. Player 1 holds the bottom, Player 2 the top. On a keyboard, Player 1 uses WASD + Space and Player 2 uses the arrows + Enter.

## Tech

- **Code:** plain HTML, Canvas 2D and JavaScript, with no build step, no framework and no backend.
- **Sound:** synthesized live in WebAudio. That covers the spin hum, wood clacks, crowd and chicken, plus a shekere / agogo / talking-drum loop. There are no audio files.
- **Physics:** a fixed-step 120 Hz simulation of spin, grip, a shallow dish, spin-weighted collisions, dash crits and wobble.
- **Opponents:** CPU kids are steering agents. Each has its own reaction time, aggression, dash habit and throw accuracy, and the smarter ones circle round to the centre side before they charge.
- **Art:** the character portraits, arena ground and cover image are original images generated for this game (Higgsfield). The tops, chicken, broom, hazards and effects are drawn in code.
- **Saves:** progress (tops won, run time, best time) lives in `localStorage`.

Run it locally by serving the folder with any static server, for example `npx serve .`.

## Files

- `index.html`: layout, styles and screens
- `js/game.js`: game loop, physics, AI, rendering and UI flow
- `js/audio.js`: the WebAudio sound engine and music
- `assets/`: arena, cover, character portraits and icons
- `DESIGN.md`: the design brief written before the build

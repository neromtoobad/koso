# KOSO - design brief

**Pitch:** Wind your wooden top, throw it into the chalk ring, and knock the other kid's top out. Winner takes the koso.

Built from scratch for Twigpine Project Treetop, Round 01 (Games), 9-16 Oct 2026.

## Core loop

Each match is best of 3 rounds. A round has two phases.

1. **THROW**
   - Press and drag back from your top in hand (slingshot style). The drag direction aims the throw into the ring and the drag length sets its distance. A dotted landing reticle shows where it will land.
   - While you hold, a "wind" ring shrinks around your hand on a loop. Release when it meets the target circle:
     - **PERFECT** = full spin.
     - **GOOD** = 85%.
     - **LOOSE** = 65-75%.
   - The top flies in an arc (it scales up as its shadow separates), lands with a dust puff and starts spinning.
2. **BATTLE**
   - Steer your spinning top. The higher its spin, the more grip it has.
   - Collisions knock the tops apart, and the top with less spin times mass loses more spin.
   - **GBAM** (dash): a burst in the steer direction. It costs 7% spin, has a 1.1 s cooldown, and a hit during a dash is a critical (more knockback, screen shake and hit-stop).
   - A top below 25% spin starts wobbling (precession) and steers weakly. At 0 it falls over and rolls: **"IT FELL!"**
   - If a top's centre leaves the chalk ring: **"OUT!"**
   - The ring has a very gentle dish pull toward the centre.

## Controls

- **Touch:**
  - The throw is a drag from anywhere and release.
  - In battle, a floating joystick appears wherever your left thumb lands (left 60% of the screen), and a GBAM button sits bottom right.
- **Mouse:** drag to throw, then hold LMB to steer toward the cursor. RMB or Space = GBAM.
- **Keyboard:** WASD / arrows steer, Space = GBAM.
  - Throwing by keyboard: hold Space to wind, arrows aim, and release Space to throw.
- **2P on one device:**
  - P1 owns the bottom half (stick and GBAM) and P2 the top half, with P2's UI rotated 180°.
  - Keys: P1 uses WASD + Space and P2 uses arrows + Enter.

## Street ladder: 5 compound kids (original characters)

| # | Kid | Top | Stats | Ground hazard |
|---|-----|-----|-------|---------------|
| 1 | Tunde | Baby Koso (yellow) | light, slow decay | none |
| 2 | Kemi | Dart (blue/white) | fast, light | sand patches (more drag) |
| 3 | Big Sola | Iroko (dark wood) | heavy, slow | bottle caps scattered (bouncy obstacles) |
| 4 | Ify | Wahala (striped) | erratic, dashes a lot | a chicken wanders through the ring |
| 5 | Oga Nail | Nail Tip (black/red, steel nail) | top tier | Mama's broom sweeps across mid-round |

- **Winner takes the koso:** beating a kid adds their top to "Your tops", and you pick which one to throw before each match.
- Your starter top is **Ọmọ Ìta** (red/green), with balanced stats.
- Beating Oga Nail makes you **STREET CHAMPION**, shows your time and lets you post a score card to X.

## Art direction (locked)

- **View:** warm Lagos compound, seen from above.
- **Ground:** red laterite earth (procedural noise) with a rough hand-drawn white chalk circle, pebbles, a dry leaf and bottle caps.
- **Spectators:** kids' feet and rubber slippers around the ring edge. They hop when a big hit lands.
- **Tops:** painted wooden tops with concentric paint bands and a centre knob, drawn in code.
  - Rotation shows as radial stripes that blur into smeared rings at speed.
  - Each top casts a soft late-afternoon shadow to the lower right, and leaves faint scuff trails that build up in the dirt.
- **Characters:** stylized 3D, warm clay-like portraits (Higgsfield nano_banana_pro, one lineup sheet so they match). They appear on the ladder, the versus card and the share card.
- **UI:**
  - Chunky display caps (Lilita One) with dark-brown ink outlines and hard drop shadows.
  - Palette: laterite #b5532f, chalk #f6f1e7, palm green #2f8f4e, sun yellow #f4b63d, indigo adire #2b3a67.

## Sound (all synthesized in WebAudio)

- **Spin hum** per top, with pitch following spin.
- **Clack** (bandpassed noise plus a click) scaled by impact.
- **Throw:** string zip, then a whoosh on release and a thunk with dust on landing.
- **GBAM:** a punch.
- **Crowd:** a murmur that swells on big hits.
- **Hazards:** chicken clucks and a broom swish.
- **Result stings:** a fall clatter, then a win stinger or a lose slide.
- **Music:** a light loop with shekere, talking-drum pitch bends, an agogo bell and a sine bass at about 108 bpm. It ducks during the throw.
- One mute toggle, saved.

## On-screen copy

- **Title:** "KOSO", subtitle "Spin it. Clash it. Take their top." Buttons STREET, 2 PLAYERS and HOW TO PLAY, plus a sound toggle and the footer "Made in 7 days for Project Treetop".
- **Ladder:** "THE COMPOUND", "Beat 5 kids. Winner takes the koso.", the button "THROW DOWN", and the label "YOUR TOPS".
- **Versus:** "<name> vs YOU", top names, and "Best of 3".
- **Throw:** "Drag back to wind. Let go on the ring."
- **Battle:**
  - "SPIN!" at the start.
  - Hit callouts: "GBAM!", "KPA!", "EHN!".
  - Round end: "OUT!", "IT FELL!", "ROUND TO YOU" / "ROUND TO <name>".
- **Match win:** "You won <name>'s koso!"
- **Match loss:** "<name> keeps the koso." with the button "AGAIN".
- **Champion:** "STREET CHAMPION" with the buttons "Post my time" and "Play again".

## Tech

- Plain HTML, canvas 2D and JS, with no build step and no backend.
- Saves (unlocked tops, best time, mute) go in localStorage.
- Hosted on Vercel at koso.nerom.site.

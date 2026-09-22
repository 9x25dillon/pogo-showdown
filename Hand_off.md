# Pogo Showdown — next-session handoff

## September 21 (later): Pog Quest expansion — branch `feat/pog-quest-expansion`

Pog Quest itself is merged to `master` (`e56e49b`); this branch adds the four follow-ups the user asked for at once. Not merged, not released.

- **Economy hookup** (`db/questRepository.ts`): attempts of 15s+ credit character mastery (which feeds Circuit Advantage), using Pogo Dash's rule. The first clear of each level grants +1 TP (`grantQuestClearBonus`) and that level's reward pog (`LevelDef.rewardPogId`). Career tier, `careerBestScore`, `totalRuns` and the Circuit match are deliberately untouched. Progress lives in `profile.quest[levelId]`. Level 1 and co-op are always open; every other level unlocks when the previous solo level is cleared. New `PlatformerLevelSelect` scene is the Pog Quest entry point.
- **Battle content:** 4 new item kinds (`freeze`, `magnet`, `doubleJump`, `groundPound`). 12 of the original 20 pogs now have an active effect, plus 5 new quest-drop pogs. **Every equipped active pog is carried** and swapped in-run (Q / ⇄ button); this settles old open question #4. New enemies: `hopper`, `spiker` (stomping it hurts; only a projectile or ground pound kills it), `turret` (fires pellets). `PlatformerEnemyDef.flies` was replaced by `movement`. New race level **Tech Park Tangle** (id `level5`, plays 3rd; ids are save keys, indexes aren't).
- **Co-op gaps:** `PlatformerRunScene` was refactored around a per-player `Hero` record, giving P2 full parity: own item charges, speed boost, double jump. Lives and shields stay shared. P2 keys: arrows, `/` or Enter for item, `.` to swap. The camera follows the midpoint and leashes both players inside the view. A fallen co-op player respawns at their partner's checkpoint. There's a split-screen touch layout (each half gets ◀ ▶ JUMP + item/swap, all below the ground line). **Not tested on a real phone.**
- **Physics tuning:** feel values moved to a mutable `PHYS` object. Open the game with `?tune` to get a live slider panel (values persist in localStorage; COPY exports them). It shows jump height/reach against the widest open pit. **The defaults were deliberately not changed**; that needs the user's own playtest. `fallGravityMultiplier` (default 1) is available for a less floaty fall.

**Pre-existing bugs found and fixed** (all were on `master`):
1. **The AI rival could never finish a race.** It released jump after 220ms (the jump-cut gave ~120px of reach), jumped 60px before the edge, and after a fall its waypoint index was past the jump, so it looped into the same pit forever. Players always won by default. `rivalAI.ts` now does full held jumps at the ledge and `resyncRivalAI` runs on respawn.
2. **Respawns landed under the floor.** `setPosition` teleports kept the body's below-the-pit `prev` position, so Arcade separated the body out through the underside of the ground slab. Now `body.reset(x, y)` for both heroes and the rival.
3. **Checkpoints were recorded on moving platforms**, so a respawn could land in mid-air over the pit. Checkpoints now use `blocked.down` only (static ground).
4. **Level 1's "raised ledge" (130px up) was above the 120px jump peak**, and its underside bonked every jump from the edge. It's now a low stepping stone set 50px past the edge.

**Testing notes:** the headless browser's frame rate is erratic, often under 10fps, which starves per-frame AI. The suite now drives the game at an exact 60fps with `game.headlessStep` (see `simulate` in `tests/platformer-regression.mjs`) and asserts the rival wins every race level with zero pit falls. Vite binds IPv6 `localhost`, so run `POGO_URL=http://localhost:5173 npm run test:browser`. If you kill a scratch CDP script, close its tabs (`/json/close/<id>`); orphaned game tabs slowed the browser enough to time the suite out.

**Follow-up (same day): more levels + a second boss.** The play order is now 9 levels: Footpeg Flats, Signature Sprint, Tech Park Tangle, Circuit Showdown (boss 1), **Rooftop Relay**, **Night Circuit**, **Summit Slam** (boss 2), Co-op Circuit, **Co-op Summit**. Co-op levels sit at the end so solo NEXT never has to skip one. Test indexes are listed at the top of `tests/platformer-regression.mjs`.
- **Spring pads** (`LevelDef.springs`, `SPRING_VELOCITY`): running or landing on one launches you, including the rival. A pad at a pit's edge is the only way across a 180–190px pit. `largestUnbridgedGap` counts a spring within 40px before a pit as a bridge, but only the rival race sim actually proves the spring's reach.
- **Summit Slammer** (`bossKind: 'slammer'`, 4 HP): patrol → telegraph → leap onto the nearest player's x → slam that sends a shockwave both ways along the ground (jump it, or stand on a ledge) → dizzy `stunned` window. While stunned it's harmless to touch and stompable. A hit sends it into `recover` (a hop clear, always toward the arena's middle when near an edge), during which it can't be hurt, so each window is worth one hit. At ≤ half HP it enrages: shorter patrol, faster walk, faster waves. Shockwaves use the same hazard list as turret pellets (`spawnHazard`), so freeze clears them too. The charger boss is unchanged.
- 4 new reward pogs: `skyline`, `nightowl`, `summitcrown`, `ropeteam`.
- Verified with a 40s fixed-60fps sim of the fight, solo and co-op: 9 and 7 slam cycles, and the boss never leaves its arena. That's a scratch check, not in the suite. The suite covers the phase transitions directly. If you script sims yourself, teleporting co-op heroes must also move the camera, or the co-op leash snaps them back.

**Follow-up 2 (same day): more enemies, a third boss, Xbox controller.** The play order is now 12 levels. Midnight Mansion (race, `level10`) and Thunder Peak (boss 3, `level11`) come after Summit Slam, and Co-op Storm (`level12`) joins the other co-op levels at the end.
- **New enemies:**
  - `chaser` walks its strip, then charges any hero within 260px. It never leaves the strip, so it can't run itself into a pit.
  - `ghost` drifts after you in a box and fades on a cycle. While `phased` it's harmless, unstompable, and lets projectiles pass through.
  - `dropper` hovers, flashes, then drops a gravity bomb on a hero passing underneath.
  - `PlatformerEnemyDef.airborne` now decides whether an enemy has gravity.
- **Storm Conductor** (`bossKind: 'conductor'`, 5 HP):
  - Cycle: hover out of jump reach while tracking the nearest player and firing aimed bolts (a three-bolt fan once enraged) → telegraph → dive → `perched` (the stomp window, harmless to touch) → `recover` (rises, immune for 900ms) → hover.
  - The two springs in its arena can launch you high enough to stomp it mid-hover.
  - A 40s fixed-60fps sim showed about 4 perches per 40s, so a perch-only win takes ~50s. The hover length (`CONDUCTOR_HOVER_MS`) is the knob if that feels long.
- **Controller** (`systems/gamepad.ts`, `ui/padMenu.ts`):
  - It uses the browser Gamepad API with the standard mapping, polled directly and cached per frame time, so the paused run and the pause menu can't both see one press.
  - In play: stick/D-pad move, A jump (hold for height), X/B/RT item, Y/LB/RB swap, Menu pause. Solo: any pad drives P1. Co-op: pad 1 is P1 and pad 2 is P2 (a lone pad leaves P2 on the arrow keys). Hits and pit falls rumble the pad of the player who took them.
  - Menus: main menu (focus starts on Pog Quest), level select (focus starts on the first uncleared solo level), pause, and results get a focus ring. A taps the focused button (it emits that button's own `pointerdown`), and B goes back. The other modes (Pogo Dash, Trick Lab, Battles…) are still touch/keyboard only.
  - The user's desktop pad is a **Microsoft Xbox One Elite 2** on the `xpad` driver. Browsers only show a pad after a button press on the page.
  - Test gotcha: Phaser tweens run on the wall clock, not `headlessStep`'s delta, so tests that press tweened menu buttons use real time (`tapReal`).

**Follow-up 3 (branch `feat/pog-quest-powerups`, built in a worktree while the user played the previous build): power-ups, spikes, 3 levels, boss rush.** Solo now has 12 levels. Sky Garden (`level13`), Spike Foundry (`level14`) and Champion's Gauntlet (`level15`) come after Thunder Peak, and co-op is indexes 12–14.
- **Power-up pickups** (`LevelDef.powerups`, `pu_*` textures) are separate from pog items: heroes only, and once per attempt.
  - `star`: 6s invincible. Touching a regular enemy defeats it; bosses can't hurt you, but you still have to stomp them. It also stuns the rival and ignores pellets and spikes.
  - `feather`: 10s; holding jump while falling caps the fall at 110px/s.
  - `rocket`: 8s; ×1.3 jump velocity (via `ControllerOptions.jumpScale`), which reaches the "rocket-only" coin rows.
  - `heart`: +1 life. `shield`: +1 shield hit.
  - Timers show under lives, per player in co-op.
- **Spike strips** (`LevelDef.spikes`): they hurt and always bounce you out. The rival doesn't collide with them; its jump waypoints sit 34px before each strip so it visibly hops them. Keep strips ≤60px wide or its 60px body clips them.
- **Boss rush** (`LevelDef.bossRush`): every boss after the first starts `dormant` (hidden, body off, untouchable) and drops in at the arena's middle when the previous one dies. The HUD shows `BOSS n/3 · NAME`.
- **Level select** has Solo / Co-op tabs (tap them, or LB/RB on a pad). The main menu opens Solo; the results screen returns to the tab of the level just played.
- 3 reward pogs: `sprout`, `anvil`, `gauntlet`.
- One suite run failed once with an uncaptured error; the next three runs were clean. If it recurs, capture the output before changing anything.

**Still open:** real-device playtest (feel, touch co-op ergonomics, whether the Slammer's and Conductor's timing is readable, and the controller on the real Elite 2 pad); whether Pog Quest should ever touch career tier; enemy/item/boss balance numbers are first guesses.

## September 21 follow-up

Continued on `feat/pog-quest-platformer`. Added a Pog Quest pause overlay (touch PAUSE or Escape) with resume, retry, and menu actions. The gameplay scene is paused so physics, timers, and tweens freeze together; held controls are cleared before pausing. Touch pointers are reused across retries. Camera and physics bounds now use each level's `widthPx`, fixing Signature Sprint's finish being outside the camera boundary.

Platformer regression coverage now lives in `tests/platformer-regression.mjs`, called by `npm run test:browser` in its isolated browser context. Covers movement/jump, pause/resume/retry/menu, rival stomps, restart listeners/pointers, level bounds and real goal overlap, boss phases/victory, solo progression boundaries, co-op input/shared lives, coins, and gap defeat. The older notes below about missing committed test scripts are superseded. Economy integration, touch co-op, and human physics tuning remain open.

Updated after the September 17, 2026 session (Android release cleanup, a balance pass, and a new platformer mode built across three phases).

## Start here

Two distinct pieces of work happened today, on two different lines of history:

1. **On `master`**: finished the v0.4.0 Android release (it had fallen a commit behind) and ran a data-driven balance pass. `master` is clean, pushed, and unchanged since.
2. **On a new branch, `feat/pog-quest-platformer`** (branched from `master` at `f373e1e`, per the user's explicit request to keep the released game untouched): built "Pog Quest," a genuinely new 2D side-scroller mode — gravity/jump physics, an AI rival you race *and* fight, collectible pogs reworked into usable battle items, a boss fight, and local 2-player co-op. Four commits, ~1,626 lines across 14 files (10 new). **You are almost certainly continuing on this branch, not `master`.**

```
git branch --show-current   # should say feat/pog-quest-platformer
git log --oneline master..feat/pog-quest-platformer
```

**Known environment gotchas, hit and solved today — read before testing:**

- The **system Chromium is currently broken** (`~/.config/chromium` → "Transport endpoint is not connected"). This session accidentally killed the `fuse-overlayfs` mount backing it via an overly broad `pkill -f "chromium"` cleanup command that also matched an unrelated system process. Use the **Playwright-bundled Chromium** instead: `~/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome --headless --no-sandbox --disable-gpu --remote-debugging-port=9333 --user-data-dir=/tmp/<unique-dir> about:blank`. Never `pkill` by a bare substring again — kill by the specific PID you captured at launch, or match a unique `--user-data-dir` flag.
- **Headless Chrome's requestAnimationFrame rate is inconsistent in this environment** (confirmed on more than one freshly-launched browser process — not just a stale-process artifact). Simulated physics `dt` per frame is always correct; the wall-clock-to-frame-count ratio is not fixed. A test that does "hold input, `pause(600ms)`, assert position moved by ~X px" will intermittently and falsely look like a regression. **Poll a condition instead** (e.g. `waitFor('player.body.velocity.x >= 209')`) rather than asserting on a fixed-pause position delta. This bit the movement check in `/tmp/.../verify-platformer.mjs` twice before being fixed properly.

## Product and architecture (orientation, unchanged today)

A portrait (480×854), web-first game: TypeScript, Phaser 4, Vite, wrapped for Android via Capacitor. No external art assets — everything is procedural Graphics→`generateTexture` or emoji. IndexedDB holds progression (`LocalDB.ts`); everything is local, no accounts or network calls.

Existing modes (all on `master`, all untouched today): **Pogo Dash** (the 3-lane endless dodge/trick runner, `RunScene.ts`), **The Circuit** (daily simulated league vs. 11 historical pros, unlocks at Pro career standing), **Yoyo Trick Lab** (60s gesture-pattern combos), **Pog Battles** (turn-based best-of-3 timing slams, wagers collectible pogs), **Pog Binder** (collection/equip screen), plus per-character mastery, career tiers, and a Tech Point/Advantage gear economy. Full mechanics for all of that are documented in earlier `Hand_off.md` history (`git log -p -- Hand_off.md` on `master`, or the prior commit `f373e1e`) — trimmed here to make room for today's new material; nothing about them changed today.

**Pog Quest** (this branch only, not on `master`) is the new sixth mode — see the architecture table below.

## Key decisions made today

- **New mode on a new branch, not a rewrite of Pogo Dash on `master`.** The original ask ("replace the core mode") got superseded by the user's explicit "this can be an additional branch... to preserve the pogo showdown work." Nothing about Pogo Dash, Circuit, career tiers, or Pog Battles changed.
- **Phased build, not one pass.** Plan-mode produced a 4-phase plan (vertical slice → more content → boss → co-op); each phase was built, tested, and committed before starting the next, rather than attempting the full end-state vision in one sitting.
- **Arcade Physics (Phaser's built-in), added globally but inert by default.** `game.ts` now has a `physics` block, but global gravity is `0` and every other scene is untouched (none of them call `this.physics.add.*`). Gravity is set per-body only on the platformer's sprites.
- **Camera follows the player horizontally only, never vertically** (`startFollow(player, true, 1, 0)`), on a level built wide in world-space. Avoids jump-bounce camera jitter without touching the portrait 480×854 canvas the rest of the app (and the Android shell) assumes.
- **Touch controls are twin hold-zones + jump/item circles, not swipes.** `RunScene`'s swipe classification can't express "hold to keep running" or "hold to jump higher"; a continuous platformer needs held state, so this is a new input pattern, not a reuse.
- **Pogs became dual-purpose, not migrated.** `PogDef.activeEffect` sits alongside the existing `perks` field. `equippedPerks()` (used by Pogo Dash and Pog Battles) is untouched; a new `equippedLoadout()` was added for the platformer's identity-preserving needs. A pog can be passive-only, active-only, or both.
- **The rival AI shares the exact same `PlayerController` the human uses**, fed synthetic input from `rivalAI.ts` (waypoint-following) instead of a separate movement implementation — tuning never has to be kept in sync across two systems.
- **Player↔rival stomp exchanges stun, they don't eliminate or cost a life.** This is a *different* rule from environmental hazards (which do cost lives) — deliberately, so the race stays competitive instead of becoming a one-hit knockout.
- **Boss health is a generalization of the existing enemy model** (`maxHealth`, default 1 for ordinary enemies), not a parallel system. `damageEnemy(enemy, amount)` is the one function both a one-hit patroller and a 3-hit boss go through.
- **Co-op has a shared lives pool but per-player invulnerability.** Getting hit doesn't make your partner briefly invincible too. This was a specific, discussed tradeoff, not an accident of shared vs. separate state.
- **Co-op's item button, and the camera, are P1-only in this first pass.** Documented scope cuts, not oversights — see "Not done yet" below.

## Unresolved assumptions — flag these back to the user, don't silently resolve them

1. **Whether Pog Quest should ever feed the existing economy** (career tiers, Circuit auto-resolve, character mastery credit). Currently `recordRun()` is never called from the new scenes — deliberate non-integration, not yet a real decision either way.
2. **Whether Pog Quest eventually *replaces* Pogo Dash** or stays a permanent second mode. The very first clarifying question got "replace," but the branch-first framing sidestepped actually doing that — right now they coexist as siblings on the mode-select screen.
3. **Touch-based 2-player input for co-op is still unsolved.** Keyboard-only (P1 WASD, P2 arrows) was always meant as the *first*, lower-risk step, not the answer — splitting touch input across one small portrait phone screen needs its own design pass.
4. **How many pogs should get an active effect, and whether more than one should be equippable at once.** Only 4 of 20 pogs have one; `activeItem` is hard-limited to whichever equipped pog is found first.
5. **None of the physics/pacing constants are human-validated** (`GRAVITY_Y`, `JUMP_VELOCITY`, `MOVE_SPEED`, `RIVAL_MOVE_SPEED`, boss `chargeSpeed`, `paceMultiplier`, etc.) — all reasonable defaults per the plan's own framing, proven only via headless-browser physics assertions, never a real thumb on a real screen.
6. **The v0.4.0 Android release does not include today's balance-tuning commits** (they landed after the tag was cut) — flagged last session too, still true, still not released.
7. **Merge strategy and timing for `feat/pog-quest-platformer` → `master`** has not been discussed at all.

## Pog Quest architecture — file map

| File | Responsibility |
|---|---|
| `src/game/data/platformerConfig.ts` | Every physics/gameplay tunable in one place (gravity, jump, move speed, stomp/combo rules, boss timings, projectile speed) |
| `src/game/data/levels.ts` | `LevelDef` type, builder helpers, `LEVEL_1`–`LEVEL_4`, `LEVELS` array |
| `src/game/data/platformerEnemies.ts` | Enemy type table (`patroller`, `flyer`, `boss`) — texture, contact damage, stomp reward, `maxHealth`, `chargeSpeed` |
| `src/game/data/pogs.ts` | `PogActiveEffect` (discriminated union: `shieldBurst`/`speedBurst`/`extraLife`/`projectile`), alongside the pre-existing passive `perks` |
| `src/game/systems/PlayerController.ts` | Shared movement/physics: accel, coyote time, jump buffer, jump-cut — used by the human player, P2, and the AI rival alike |
| `src/game/systems/rivalAI.ts` | Turns a level's authored waypoints into `ControllerInput` for the rival |
| `src/game/db/platformerResult.ts` | `PlatformerResult` (win/loss/coins/combo/level index) — separate from `runResult.ts`, which is score/tier-shaped for Pogo Dash |
| `src/game/db/pogRepository.ts` | `equippedLoadout()` (new, identity-preserving) alongside the untouched `equippedPerks()` |
| `src/game/scenes/PlatformerRunScene.ts` | The gameplay scene — by far the largest file (~860 lines): movement, stomp/damage resolution, boss AI, co-op, items, HUD, controls |
| `src/game/scenes/PlatformerResultScene.ts` | Win/loss/fell screen; offers NEXT LEVEL only when it wouldn't dump a solo player into the co-op level |
| `src/game/scenes/ModeSelectScene.ts` | "Pog Quest" button (resets to level 0) + a compact co-op text link (`LEVELS.findIndex(l => l.coop)`) |
| `src/game/scenes/BootScene.ts` | New procedural textures: platform tile, coin, patrol/flying/boss enemies, projectile, goal flag, shield-burst icon |

Levels: `LEVEL_1` "Footpeg Flats" and `LEVEL_2` "Signature Sprint" are normal race-and-fight levels; `LEVEL_3` "Circuit Showdown" is the boss arena (`bossLevel: true`, no rival, no goal flag); `LEVEL_4` "Co-op Circuit" is the same boss shape at `paceMultiplier: 0.65` (`coop: true`, spawns via `player2Start`).

## Run and verify

Same commands as always (`npm run dev`, `npm run build`, `npx tsc --noEmit`, `npm run test:browser`), but for the platformer specifically there is **no committed regression coverage yet** — every check this session lived in ad hoc scripts under the scratchpad (`verify-platformer.mjs`, `verify-phase2.mjs`, `verify-boss.mjs`, `verify-coop.mjs`), which are **not saved in the repo** and won't survive to next session. If picking this back up, either:
- recreate similar scripts (the existing `tests/browser-regression.mjs` shows the CDP-over-WebSocket pattern — `Target.createBrowserContext` per test group, `window.__game.scene.getScene('PlatformerRun')` to reach in directly), or
- fold the platformer checks into `tests/browser-regression.mjs` itself so they're not lost again.

Use `scene.restart()` (Phaser's own API) to restart the *current* scene — a manual `for (...) s.scene.stop(); scene.start(key)` loop races Phaser's scene queue when the target is already the active scene and can leave it stuck at `SHUTDOWN` status. This cost real debugging time twice today before being traced correctly.

When forcing a stomp/hit test by setting `sprite.setPosition(...)` directly (bypassing real gameplay), call `body.updateFromGameObject()` on both bodies immediately after — Arcade bodies cache their bounds and won't reflect a manual position change until the next physics step otherwise, which looks exactly like a broken hit-detection bug but isn't.

## Recommended next session

1. **Playtest on a phone or at least a real browser tab**, not just headless assertions — none of the physics tuning has had human eyes/thumbs on it yet.
2. **Decide the economy question** (unresolved assumption #1 above) before building more content that might need to change shape depending on the answer.
3. **Save the platformer test scripts into the repo** (see "Run and verify") before they're lost to a fresh scratchpad next session.
4. If continuing content breadth: more active pogs, more enemy variety, more levels — all follow the same data-driven patterns already established (`platformerEnemies.ts`, `levels.ts`, `PogActiveEffect`).
5. If continuing toward the original Smash-Bros framing: touch-split co-op input is the next real design problem, not just more code.

## Collaboration retrospective (today)

Three ways the assistant could have been more efficient:

1. Diagnosed a "movement regression" across two full debug cycles before landing on the real, durable fix (poll a condition, don't assert on a fixed-pause position delta) — the first diagnosis (blamed a stale browser process) was itself incomplete, since the identical symptom reappeared on a genuinely fresh process and should have been treated with more skepticism before being called solved.
2. Forced a test-state change via `sprite.setPosition()` without calling `body.updateFromGameObject()`, producing a false "stomp didn't register" failure that took a debugging detour to trace — should have anticipated the caching behavior, having already used Arcade Physics bodies elsewhere in the same session.
3. Used broad `pkill -f "chromium"` cleanup commands more than once despite having the specific PID or a unique `--user-data-dir` flag on hand from the corresponding launch command — the one time this went wrong, it broke something outside the repo that couldn't be un-broken from within the session.

Three ways the user's prompting could get more out of these sessions:

1. The opening ask ("make it into a 2d side scroller kind of like mario") turned out to want something much bigger — a Smash-Bros-style VS mode, bosses, co-op, an item-battle system — that only surfaced across three rounds of clarifying questions. Front-loading the fuller vision, even as a rough bullet list, would let the phased plan get scoped correctly on the first pass instead of needing that back-and-forth.
2. Momentum phrases like "keep cooking king" are great fuel but bundle multiple possible directions into one line — naming which phase or aspect to prioritize (as happened for boss-vs-co-op, resolved via a clarifying question) saves a round trip.
3. This very message bundles seven distinct deliverables into one ask (review, decisions, assumptions, two sets of three examples, vocabulary, a full handoff rewrite) — reasonable for a wrap-up, but for ongoing work, splitting "give me the quick version" from "now go build the long document" lets you redirect the cheap part before committing to the expensive part.

**New vocabulary, both earned today:**

- **Scope cut** — a boundary drawn on purpose and communicated, not an oversight. ("Co-op's item button is a scope cut, not a bug — P2 can't use items yet.") Naming it this way instead of leaving it implicit is exactly what separates "we know and chose this" from "we forgot."
- **Flaky** (test) — a check that intermittently fails for reasons unrelated to whether the code is correct (timing, environment, load), as opposed to a real regression. Today's movement-check saga was a flaky test, not a flaky game — worth naming precisely, because the fix for a flaky test (make the assertion deterministic) is completely different from the fix for a regression (find and revert/repair the bad change).

Useful older vocabulary, still relevant: **acceptance criteria** (observable conditions that define "done") and **invariant** (a rule that must stay true through changes) — both from the prior handoff, both still apply, e.g. "no life loss from a player↔rival stomp exchange" is an invariant of the race mechanic.

Example next prompt: *"Continue on feat/pog-quest-platformer. I played it on my phone — jump feels floaty, tighten GRAVITY_Y. Before adding more content, save the verify scripts into tests/ so we stop losing them. Don't touch master."*

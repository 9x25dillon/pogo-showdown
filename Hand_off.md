# Pogo Showdown — session handoff

Updated September 22, 2026. This replaces the layered September 21/22 handoffs; earlier detail remains in Git history.

## Start here next session

1. Read this file, any applicable `AGENTS.md`, `git status --short --branch`, and `git log -5 --oneline`. Preserve unrelated local changes. Check the remote before publishing.
2. September 22 delivered two Forever Realm expansions: persistent homesteads (`d9cb7a3`) and Buried Foundry expeditions (the subsequent commit containing this handoff; find it with `git log`). Work was developed on `master`; there is no separate September 22 feature branch requiring a merge. Verify publication from Git rather than treating this document as live remote status.
3. The user authorized committing, pushing, and merging this work. That is source publication, not an Android release. No Android package was built or published this session. The last recorded Play release in the previous handoff was v0.4.0; current store status has not been independently checked.
4. Recommended next task: playtest and tune the complete home → Foundry → permanent reward loop. Human feel and balance are the largest remaining uncertainties. A second dungeon is a later option, not an agreed next deliverable.
5. The user values autonomous completion and concise progress updates. Continue authorized implementation through appropriate checks. Their “please continue” was encouragement to finish the active expansion, not a request to start another feature. Ask only for information that materially affects the next task; routine reversible work does not need repeated confirmation.

## Repository and existing game

Phaser 4, TypeScript, Vite, and a Capacitor Android shell. Procedural art lives in `src/game/scenes/BootScene.ts`. Data is local IndexedDB: database version 4, Realm save version 1. Tile IDs are persisted keys: append new IDs rather than renumbering. Preserve item keys and compatibility with saves missing optional fields.

The eight modes are Pogo Dash, The Circuit, Pog Battles, Yoyo Trick Lab, Leaderboard, Pog Binder, Pog Quest, and Forever Realm. September 22 extended Forever Realm; it did not introduce another main-menu mode.

Prior-session context, not work completed today:

- Pog Quest has 12 solo levels including a boss-rush finale, three co-op levels, pickups, and the `?tune` physics panel. Its economy gives mastery training for qualifying attempts and first-clear Tech Points/reward pogs, without changing career tiers or Circuit matches.
- Forever Realm has a 640×200 overworld, mining/building/crafting, day/night, four elemental portal realms, four relics, the Forever Gate, Eternal Hall, and Eternal Reaper. Ordinary pockets are 220×70; the Hall is 260×70.
- Realm uses a 960×540 landscape game size and restores portrait when exiting. The Android shell is still portrait-locked.
- Cue-based music streams through HTML audio; M mutes. User source tracks are in ignored `/music/`; shipped compressed copies are in `public/music/`. Artist credit remains unspecified.
- Standard-mapping controller input is polled directly and cached per frame. Recorded user hardware: Xbox One Elite 2 on Linux's `xpad` driver.

## What September 22 added

### Persistent homesteads

The HOME menu provides furniture placement previews and confirms costs only on valid placement. Canceling costs nothing. Furniture is passable but reserves clearance and supporting tiles against building/mining. It belongs to the overworld.

| Furniture | Cost and space | Behavior |
|---|---|---|
| Wayfarer Bed | 12 wood + 4 gel; three tiles wide, three tiles headroom | Sets overworld respawn. A roof 3–7 tiles above every bed column and no enemies within 10 tiles allow full healing and sleep to dawn. A compass points home. |
| Storage Chest | 8 wood + 2 copper; two tiles wide | Twelve distinct item types, unrestricted stack counts; one-item/whole-stack transfers, quick-stack matching types, paged inventories. |
| Campfire | 8 stone + 4 wood; two tiles wide | Permanent light within 160px; adds 4 HP/s within 96px when enemies are away, after the existing recovery delay. |
| Warden Core Trophy | First Foundry victory only; two tiles wide and two tiles clearance | Decorative permanent light within 100px. Cannot be freely crafted. |

Packed furniture becomes a reusable kit. Chests must be empty before packing. Packing the claimed bed restores the original spawn. Homesteads persist through reloads and portal visits using optional `RealmSave.homestead`, without a schema version bump.

Two related fixes shipped with homesteads: saving a dead player now uses both spawn coordinates, and screen-fixed crafting/HOME controls receive pointer input correctly after camera scrolling. Set scroll factors on each interactive child explicitly; Phaser 4's container propagation does not handle inherited properties as expected.

### Lost Ruins: Buried Foundry

A brass entrance west of the original overworld spawn leads to a separate expedition. The entrance is a world object, not terrain edits. Placement searches for clear ground away from furniture; heavily modified worlds and fallback placement deserve more coverage. Discovery within 200px reveals an amber minimap marker. The journal provides a rumor before discovery and direction/distance afterward.

The authored 378×72 dungeon contains Intake, Stamping, and Boiler halls followed by the Heart Engine. Each hall has a regulator/checkpoint, an optional upper cache gallery reachable with ordinary jumps, and a pressure gate. Seeded variation changes trap rhythms and gallery offsets; this is not a wholly procedural room generator. Nine traps and six Scrap Sentinels guard the route. Foundry masonry/gates are unbreakable and block placement is disabled.

- Trap cycle: 3.6 seconds idle, 1.2 seconds amber warning, 1.2 seconds active. Steam deals 12 damage; presses deal 22, subject to normal hit invulnerability.
- Regulators open their gates and heal 25 HP. Death retains regulator/cache progress for the current visit and returns to the last checkpoint, resetting the boss. Leaving or quitting ends the visit; reentry resets dungeon rooms and caches. An unfinished expedition does not resume across sessions.
- Clockwork Warden: 420 HP, 16 contact damage; patrol → warning → charge → gear-wave slam → cyan exposed recovery. Only recovery accepts sword damage, multiplied by 1.5. Below half health, movement/charges intensify and extra waves appear.
- Every victory grants 12 iron. The first permanently unlocks the Survey Lantern and awards one trophy kit. Awarding victory twice within one run cannot duplicate rewards.
- The lantern outlines copper, iron, and soulstone through darkness/terrain within a 12-tile radius, scanning every 250ms. It changes neither mining reach nor pickaxe requirements. Its journal toggle persists.
- The journal pauses gameplay and records discovery, objectives, clears, lifetime cache count, best active-simulation completion time, and lantern controls. Attempts are saved but are not displayed in the current journal.

Optional `RealmSave.expeditions` stores entrance/discovery, attempts, clears, caches, best time, lantern unlock, and lantern preference. Existing saves receive defaults. Foundry is a pocket but not an elemental relic realm; the four-relic finale requirements remain unchanged.

## Controls worth knowing

| Action | Keyboard/mouse | Controller/touch |
|---|---|---|
| Move / jump | A/D; W or Space | Left stick; A |
| Sword / tool | J or right click; K or left click | X; RT; right stick aims |
| Potion / crafting | Q; E | B; Y |
| Minimap / pause | Tab; Esc | View; Menu |
| HOME | H or HOME button | LT or HOME button |
| Journal | N or JOURNAL button | R3/right-stick click or JOURNAL button |
| Interact / enter portal | S / down arrow | D-pad down or contextual touch prompt |
| Place selected furnishing | Click or K | RT |
| Cancel placement | H or Esc | LT or B |

Menus interpret buttons contextually. Chest transfers support one item or a whole stack, quick stack, and page controls. Journal closes with N/Esc or R3/B.

## Code map

All game paths below are relative to `src/game/`.

| Files | Responsibility |
|---|---|
| `realm/homestead.ts`, `realm/RealmHomestead.ts` | Pure save/placement/storage rules; furniture rendering, preview and menus |
| `realm/expeditions.ts` | Progress defaults, entrance search, trap timing, cache loot |
| `realm/foundryGen.ts` | Foundry geometry, gates, galleries, seeded variation |
| `realm/RealmExpedition.ts` | Entrance discovery, props/traps, journal, awards, survey overlay |
| `realm/realmBosses.ts` | Existing bosses plus the Warden state machine and armor rules |
| `realm/realmSave.ts`, `realm/realms.ts`, `realm/pocketGen.ts` | Persistence, pocket/relic types, world generation routing |
| `realm/items.ts`, `realm/tiles.ts` | Trophy item and appended Foundry wall/gate tile IDs 28/29 |
| `scenes/RealmScene.ts` | World/input/combat/save integration, travel/checkpoints, HUD/minimap |
| `scenes/BootScene.ts`, `systems/gamepad.ts` | Procedural Foundry textures; R3 input mapping |
| `db/LocalDB.ts`, `systems/music.ts`, `ui/padMenu.ts` | Existing database, soundtrack, controller menu systems |

`tests/realm-homestead-regression.mjs` and `tests/realm-foundry-regression.mjs` integrate into `tests/browser-regression.mjs`. RealmScene remains large; extract a subsystem when a concrete change benefits from it, rather than combining a broad rewrite with balance tuning.

## Validation and debugging

Completed against the final application changes this session: production build, focused Foundry regression, full browser regression, and whitespace checks passed. The full suite covered existing modes, Pog Quest, Realm core, portals, the Forever Gate/Reaper, homesteads, and Foundry, with zero browser exceptions. Vite still reports the existing large-bundle warning. No dependencies were added.

Foundry coverage includes actual keyboard, emulated touch, and emulated R3 journal input; pause timing; discovery/minimap visibility; unchanged overworld tiles; all three gallery climbs; normal-jump route traversal through regulators; trap warning/damage; boss armor/attack states; checkpoint deaths; reward idempotency/persistence; lantern range/toggle; and trophy placement/packing. The victory integration test reduces boss HP before the finishing sword hit. It does not prove a natural full-health Warden fight is fair or enjoyable. Automated traversal likewise does not establish human completion time or physical-device feel.

To validate application changes:

```sh
npm run build
# In a separate terminal, choose an available port and use the printed URL:
npm run dev -- --host 127.0.0.1 --port 5175
# Start an isolated Chromium instance in another terminal:
foundry_profile=$(mktemp -d /tmp/pogo-browser.XXXXXX)
~/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome --headless --no-sandbox --disable-gpu --remote-debugging-port=9333 --user-data-dir="$foundry_profile" about:blank
# With the server and browser running:
POGO_URL=http://127.0.0.1:5175 npm run test:browser
# Optional focused checks during iteration:
POGO_SUITE=foundry POGO_URL=http://127.0.0.1:5175 npm run test:browser
POGO_SUITE=homestead POGO_URL=http://127.0.0.1:5175 npm run test:browser
git diff --check
```

Check that the cached Chromium path exists. CDP defaults to port 9333 and supports `CDP_URL`. Use the exact URL Vite prints; occupied ports may cause it to choose another. Last Foundry server used 5175, while an earlier homestead server used 5174. Check live processes before assuming either remains running. Browser saves are origin-specific: switching host or port can make an existing save appear absent. Tests create a separate browser context and dispose it without touching player saves.

Debugging rules learned from actual failures:

- Test real input after camera scrolling early. Directly invoking menu methods does not validate hitboxes. Explicit child `setScrollFactor(0)` fixed the actual issue.
- Drive movement with fixed 60Hz simulation, stable inputs, and assertions inside stepped frames. Release/stop input before yielding to the browser. Render between manual simulation chunks to flush graphics buffers; accumulating headless frames without rendering can stall the next real frame.
- The initial Foundry route bot got stuck by walking into a step without jumping; the geometry did not require changing. Trace position, collision and input before diagnosing unreachable terrain.
- Phaser tweens use wall time. Allow real time for tween-driven UI; do not assume `headlessStep` advances every subsystem.
- Use `body.reset(x, y)` for physical respawns. Use `restart()` for active scenes and wait for a new world object. Keep the existing scene-start-data clearing and camera `resetFX()` fixes.
- Freeze application edits during a full regression run: Vite hot reload previously invalidated a run. Work in a separate worktree/server when edits would interrupt the user's game.
- Close only browser tabs/processes you own. Preserve the original assertion when browser cleanup also fails. Diagnose focused failures before rerunning the whole suite.
- `npm run build` already includes TypeScript checking. Do not repeat the full game suite for documentation-only changes.

Temporary screenshots were saved under `/tmp/pogo-foundry-screens/` and `/tmp/pogo-homestead-screens/`; they are disposable and not repository artifacts. The journal was visually inspected. Do not mistake a limited boss-area screenshot for comprehensive combat visual validation.

## Decisions and unresolved assumptions

Decisions made today:

1. Build a persistent home loop, then one complete optional expedition that gives homes and exploration another purpose.
2. Preserve existing worlds with optional save fields and an entrance object instead of regenerating terrain.
3. Keep Foundry separate from the four elemental relics and finale gating.
4. Save permanent expedition progression while resetting visits; checkpoints protect progress only within a visit.
5. Reward exploration with a permanent utility upgrade and a placeable trophy, plus repeatable materials.
6. Reuse procedural art and the existing controller/combat stack; verify actual input and traversal alongside rule-level assertions.

Open questions, with current behavior distinguished from intent:

- **Pacing and difficulty:** the proposed 5–10 minute visit is a design target, not a measured result. Warden recovery windows, trap readability, discovery distance and gearing need a human pass.
- **Run persistence:** does quitting intentionally abandoning the current visit match player expectations? Cross-session checkpoint restoration would be a separate change.
- **Economy:** inventory is already unrestricted; chests provide organization. Repeat caches/iron and permanent healing may make farming too generous. Measure before imposing capacity limits or fuel costs.
- **Entrance edge cases:** normal terrain and furniture avoidance are covered; extreme player edits may exhaust the safe-location search. Check fallback reachability without destroying existing construction.
- **Platforms and release:** physical Xbox/phone feel and Android landscape remain unverified. No Android orientation plugin or release work was part of this expansion.
- **Carried forward:** Realm uses its Chakan-styled hero regardless of character selection; Realm rewards do not feed career/Circuit. Those relationships, soundtrack artist credit, and post-Reaper progression remain product choices.

## Collaboration review and next-session prompting

Three concrete ways the assistant could have been more efficient:

1. Homestead tests initially bypassed pointer hit testing, and a guessed container scroll-factor fix failed. Build one scrolled, real-input interaction first and inspect the actual Phaser behavior before expanding the UI.
2. Foundry traversal debugging spent effort on input continuing between browser calls and unflushed rendering. Establish one reliable fixed-step driver and one representative climb before adding all route assertions.
3. An application edit triggered hot reload during validation, and appended handoff sections later contradicted publication status. Freeze the application for the final test run, then rewrite one authoritative handoff from the completed state.

Three opportunities for the user to reduce back-and-forth; these are prompt improvements, not evidence that broad delegation was wrong:

1. “Enhance where you see fit” gave useful creative freedom but left platform and completion scope inferred. Add a short boundary, such as “one complete Forever Realm feature; desktop and Xbox first; preserve old saves.”
2. Accepting the Foundry proposal established scope, but this conversation contains no concrete human Foundry playtest observations. Supply gear, room, attempted action, observed result and desired feel; that lets tuning target an actual experience.
3. “Commit” followed by “push and merge” required separate wrap-up turns. When appropriate, authorize the whole finish in advance: implement, validate, update the handoff, commit, push, and merge if a branch is used. Today's combined wrap-up request already does this well.

Useful vocabulary:

- **Invariant:** a condition that must remain true as the system changes. Example prompt: “Existing worlds and the four-relic gate are invariants.” This identifies what every implementation must preserve.
- **Acceptance criteria:** observable conditions that define completion. Example: “Old saves load, the journal works with touch and R3, and each gallery is reachable without relic powers.” Separate automated criteria from human judgments such as enjoyable difficulty.

Suggested next prompt, adaptable after playing:

> Continue from Hand_off.md. Improve the existing home-to-Foundry loop for desktop and Xbox. My playtest observations are: [gear, room, action, result, desired feel]. Preserve old saves and the four-relic finale. Tune the reported problems and run relevant checks; do not add another dungeon in this task. Update the handoff, commit, push, and merge if a branch is used. Make routine implementation decisions autonomously and flag unresolved product choices.

A productive first playtest starts with ordinary early-game gear, finds the entrance without debug teleporting, attempts a gallery, activates a regulator, dies once to check the checkpoint, and fights the full-health Warden. Record time, deaths and unclear moments. Then verify the unlocked lantern and trophy back at home. Use those observations to choose the next bounded improvement.

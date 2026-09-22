# Pogo Showdown — next-session handoff

## September 22, 2026 — Homestead expansion (current workspace)

Forever Realm now has a persistent home-building loop. This expansion is committed locally; it has not been pushed or released to Android.

- **Open HOME:** H, controller LT, or the HOME button. Select a furnishing, aim at a flat floor, then click / K / RT to place it. H / LT or B / Esc cancels placement without spending materials.
- **Wayfarer Bed:** 12 wood + 4 gel; three tiles wide with three tiles of headroom. Interact to set your overworld respawn. A roof 3–7 tiles above all three bed tiles and no enemies within 10 tiles allow a full heal and sleep to dawn. A HOME compass shows direction and distance.
- **Storage Chest:** 8 wood + 2 copper; two tiles wide; 12 distinct item types. Deposit or withdraw one item with A / click / K, a whole stack with X / J or the on-screen button. Quick stack transfers matching item types. LB/RB or arrows page through larger inventories. Contents persist across reloads and portal expeditions.
- **Campfire:** 8 stone + 4 wood; two tiles wide; permanent light and +4 HP/s within six tiles when enemies are away, after the existing damage recovery delay.
- **Interact:** S / D-pad down, or tap the contextual prompt. Beds and fires can be packed; chests must be empty first. Packed furnishings can be placed again without another resource cost. Packing the active bed restores the original spawn.
- Furniture is passable, but reserves its space and supporting tiles against mining/building. It belongs only to the overworld. Portal entrances and boss behavior are unchanged.

Implementation: `realm/homestead.ts` contains save types, placement rules, storage transfers, and restoration; `realm/RealmHomestead.ts` owns furniture rendering, placement preview, and the paged UI; `RealmScene.ts` supplies world/combat/save hooks. The optional `RealmSave.homestead` field keeps version-1 saves compatible. No database upgrade is needed. A separate existing bug was fixed: saving while dead now writes both spawn coordinates, instead of combining the death X with spawn Y.

Pointer regression found and fixed: screen-fixed container children need their own `setScrollFactor(0)` for hit tests. Phaser 4's `container.setScrollFactor(0, 0, true)` does not propagate to inherited scroll-factor properties. Both homestead and the existing crafting panel now set children explicitly. The suite exercises real keyboard and touch events after the world camera has scrolled.

Tests: `tests/realm-homestead-regression.mjs` runs as part of `npm run test:browser`. Set `POGO_SUITE=homestead` for the focused suite. Tests use an isolated browser context, so player saves are untouched. Development testing uses a separate server at `http://127.0.0.1:5174`.

Validation completed: `npm run build`, `git diff --check`, and the full browser suite (existing modes, Pog Quest, Realm core, four portals, Forever Gate/Reaper, homesteads) all passed; zero browser exceptions. Desktop menu screenshots were inspected. Real keyboard and emulated touch interactions passed; physical controller/phone feel still needs a human playtest.

The previous handoff below describes the state **before** this expansion. Its “everything merged” statement applies only to the September 21 work.

---

_Last updated after the September 21, 2026 session (one long day): Pog Quest expansion → power-ups → Forever Realm Phases 1–3 + soundtrack. Previous handoffs are in git history (`git log -p -- Hand_off.md`)._

## Start here

- **Everything is merged to `master` and pushed** (merge commit `ab929cd`). Today's work came in through `feat/forever-realm`, which contains `feat/pog-quest-expansion` and `feat/pog-quest-powerups`. The next session can branch fresh from `master`.
- **Release status: nothing from today has been released to Android.** The last Play build is v0.4.0. Everything since (Pog Quest onward) is unreleased.
- **The user's hardware:** a desktop with a **Microsoft Xbox One Elite 2** controller on the Linux `xpad` driver. The user plays in the browser at `http://localhost:5173` (`npm run dev`).
- **Their own music** lives in `music/` (WAV and MP3, git-ignored with an anchored `/music/`). The game ships 128 kbps copies in `public/music/`.

```
git switch master && git pull
npm run dev                      # the user plays here
npx tsc --noEmit && npm run build
# tests: a headless Chromium with CDP on 9333, then:
POGO_URL=http://localhost:5173 npm run test:browser   # 5 suites, ~3-4 min
```

Headless browser for tests (never `pkill` by pattern; kill the PID you launched):
```
~/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome --headless --no-sandbox --disable-gpu \
  --remote-debugging-port=9333 --user-data-dir=<scratch>/chrome-profile about:blank &
```

## What the game is now

A web-first Phaser 4 + TypeScript + Vite game with a Capacitor Android shell. All art is procedural (`BootScene`), all data is local (IndexedDB, `db/LocalDB.ts`, **DB version 4**). The main menu has 8 modes:

| Mode | Where | Notes |
|---|---|---|
| Pogo Dash, The Circuit, Pog Battles, Yoyo Trick Lab, Leaderboard, Pog Binder | unchanged, portrait | see older handoffs |
| **Pog Quest** | `scenes/Platformer*`, `data/levels.ts`, `data/platformerConfig.ts` | 12 solo levels (3 bosses + a boss rush finale) and 3 co-op levels, in a tabbed level select; economy hooks (`db/questRepository.ts`); 8 active pog item kinds; 5 power-up pickups; springs, spikes; `?tune` live physics panel |
| **Forever Realm** | `scenes/RealmScene.ts`, `realm/*` | **landscape 960×540** open world (Terraria + Chakan). Phase 1: dig, build, craft, day/night, lighting, 3 creatures. Phase 2: a portal shrine, 4 elemental realms (Ember/Tide/Gale/Grave), 4 bosses, relics, brews. Phase 3: the Forever Gate, the Eternal Hall, the Eternal Reaper, the ending, a minimap, the Chakan hero |

Cross-cutting systems added today:
- `systems/music.ts`: cue-based soundtrack (`menu / explore / danger / win / loss`), streamed through `<audio>`. M mutes.
- `systems/gamepad.ts`, `ui/padMenu.ts`: standard-mapping gamepads, cached per frame time, rumble, and menu focus rings.
- `scenes/PlatformerPauseScene.ts`: the shared pause menu. It takes `{ target }` and lays out from the live screen size.

### Forever Realm file map
| File | What |
|---|---|
| `realm/worldGen.ts` | seeded overworld (640×200 tiles): caves, ores by depth, trees, **the shrine** (4 portals + the Forever Gate) |
| `realm/pocketGen.ts` | the portal realms (220×70) and the Eternal Hall (260×70), each ending in a boss arena |
| `realm/realms.ts` | realm defs, relics, `FOREVER_SEGMENTS` |
| `realm/realmBosses.ts` | 5 boss state machines behind a `BossCtx` (Tyrant, Leviathan, Harpy Queen, Hollow King, **Eternal Reaper**) |
| `realm/tiles.ts`, `realm/items.ts`, `realm/realmEnemies.ts` | tile table (ids are save keys: append only), items/recipes/brews/swords, creatures with `ai` kinds |
| `realm/realmSave.ts` | the save: seed + tile edits, inventory, gear, relics, champion, stats, minimap fog bitset |
| `scenes/RealmScene.ts` | ~1800 lines: world build, input, mining/building, combat, environment hazards, portals/travel, boss fights, lighting, HUD, minimap, ending, save. **The next refactor candidate**: split out environment, HUD/minimap and boss plumbing. |

### Forever Realm controls
Controller: stick move · A jump · X sword · RT use tool (hold to mine) · right stick aim · LB/RB tools · B potion · Y craft · View minimap · Menu pause · ▼ enter a portal.
Keyboard/mouse: A/D · W/Space · J sword · K or click use · right-click sword · 1–0 tools · Q potion · E craft · Tab minimap · S/↓ portal · Esc.

## Key decisions (today)

1. **New modes sit beside old ones; nothing is replaced.** Pog Quest stayed alongside Pogo Dash, and the Forever Realm stayed alongside Pog Quest (the user's explicit choice both times).
2. **Pog Quest economy:** attempts of 15s+ give character mastery training (which feeds Circuit Advantage), and a first clear gives +1 Tech Point plus a reward pog. It never touches career tier, Dash score or the Circuit match.
3. **Physics defaults were not tuned by the assistant.** Instead there's a `?tune` panel for the human to use. Feel is a human judgment.
4. **Worlds save as a seed plus edits**, not full maps. Portal realms regenerate on every visit (dungeons); only gear, pack, relics and stats travel back.
5. **The soundtrack streams through `<audio>` instead of Web Audio decoding** (~100MB of RAM per song otherwise), mapped by cue rather than by file.
6. **Controller input is polled directly from the Gamepad API** (not Phaser's plugin), cached per frame time so a press is seen exactly once across stacked scenes.
7. **The realm is landscape via `scale.setGameSize`** while it runs, restored to portrait on exit. The rest of the app stays portrait.
8. **Relics gate the finale and make the Eternal Hall passable** (immunities, double jump, breathing). That's the progression loop. The opened gate follows the relics; it isn't saved as a tile edit.
9. **Traversability is proven by bots at a fixed 60fps** (`game.headlessStep`, fixed seeds), not assumed from level data. This found 6+ real level-design bugs.

## Bugs found and fixed along the way (worth remembering)

- **Pog Quest's AI rival could never finish a race** (a jump-cut hop, then a loop into the same pit after respawning). It existed on `master` since the mode shipped.
- **Respawns via `setPosition` dropped bodies through the floor.** Use `body.reset(x, y)`.
- **Checkpoints on moving platforms respawned players in mid-air.**
- **Unreachable or bonk-prone ledges** in Pog Quest Level 1 and the Tide knolls (fixed with a surface-breach jump). **A sky island blocked the Eternal Hall's crypt door.**
- **Phaser reuses a scene's previous start data** when `start()`/`restart()` get none, so a single "New World" wiped the save on every later visit. The realm now clears `sys.settings.data`.
- **The camera fade persisted across `scene.restart()`**, which would have left the screen black after every portal trip. Fixed with `resetFX()` in create.
- **Two flaky tests traced to root causes:** assertions read after control returned to the real game loop, and `stop()`+`start()` on an already-active scene left it stuck at SHUTDOWN (use `restart()`).

## Unresolved assumptions (raise these with the user; don't silently decide)

1. **Difficulty and feel have never had a human pass**: jump physics, boss HP and timings, heat/breath rates, enemy damage. The Reaper has 900 HP; perch-only Conductor fights take ~50s.
2. **Android:** the Capacitor shell is portrait-locked, so the realm letterboxes on phones. Is the realm meant to ship on Android? That needs an orientation plugin and touch-control tuning. Touch co-op for Pog Quest has also never been on a real phone.
3. **Nothing since v0.4.0 is released.** Is a release planned, and at what scope? The APK now includes ~25MB of music.
4. **Should Pog Quest or the Forever Realm feed career tiers** or the Circuit? Currently they don't (Pog Quest only feeds mastery and Tech Points).
5. **The realm hero replaced the chosen character** (Chakan styling). Should the character select still matter there?
6. **Post-game:** after the Reaper, the realms are replayable but offer nothing new. New Game+, harder bosses, or beds and chests (proposed, not started)?
7. **Crediting the soundtrack:** the ending lists track names only. Does the user want an artist name?

## Test and debugging playbook (hard-won)

- **Drive time yourself.** Headless Chrome runs at <10fps and irregularly. Use chunked `game.headlessStep` loops (see `simulate`/`step` in the tests), and **assert inside the stepped frames**, not in a later CDP call.
- **Phaser tweens run on the wall clock**, not headlessStep's delta. Anything that finishes on a tween (menu buttons) needs real-time waits (`tapReal`).
- **Scene restarts:** `restart()` an active scene; wait for a *new* state object (`world !== oldWorld`), not a flag the old instance still holds.
- **Fixed seeds** for traversal bots (`scene.restart({ pocket, seed })`). The generator constraints are checked separately across seeds.
- **Reproduce a flake with a trace before fixing it.** Twice today, a guessed fix was wrong.
- **Close CDP tabs you open** (`/json/close/<id>`). Orphaned game tabs slowed the browser enough to time the suite out.
- **Vite binds IPv6 `localhost`**, so use `POGO_URL=http://localhost:5173`.
- **Phaser 4 API differences met today:** `rt.render()` is required on RenderTextures; `erase()` has no alpha argument (set it on the eraser object); `setTintFill(color)` is gone; `make.image(config, addToScene)`.
- **To work while the user plays**, build in a git worktree with its own dev server on another port, so their session doesn't hot-reload mid-game.

## Collaboration retrospective

**Where the assistant could have been more efficient**
1. **I guessed at a flaky test twice before measuring it.** The Pog Quest pad-jump flake got a guessed fix (move the rival), then a second guess that broke the level (the rival won the race), before a 25-iteration trace showed the real cause. I should have reproduced it with a trace first, as I eventually did.
2. **I wrote tests with assumptions I hadn't checked** (the respawn point being inside the portal, the stick aim distance, test-injected relics persisting, the ground under a placed block), which cost several suite reruns at 3–4 minutes each. Reading the exact state before asserting on it would have saved most of them.
3. **The realm's lighting took four screenshot rounds** (uniform darkness, sky color, erase alpha, scaled erasers) because I built it before checking Phaser 4's RenderTexture semantics. A 5-minute API spike up front would have been cheaper.

**Where the user could have been more efficient**
1. **Scope escalated every turn** ("more levels" → "open world" → "portal realms" → "final boss") without a stated end goal. A one-paragraph north star ("a Terraria/Chakan open world with 4 realms and a final boss, released on Android by X") would have let the architecture be planned once. For example, landscape and Android orientation got deferred because they weren't known up front.
2. **"It plays fine" was the only playtest feedback.** The biggest open risk (feel, difficulty) can only be closed by you. Even three bullets per session ("jumps float, the Tyrant is too easy, I got lost in Tide") would steer tuning better than more features.
3. **Some requests bundled 3–5 deliverables** (e.g. "commit push merge … review … key decisions … assumptions … examples … vocabulary … handoff"). That's fine for wrap-ups, but mid-build, one goal per message lets each piece be reviewed before the next is stacked on it.

**Prompting tips that unlock more**
- **Name the constraint, not just the feature:** "must run on my Android phone", "keep it under 10 minutes to beat", "bosses should be hard". Constraints change designs more than features do.
- **Say what "done" looks like** ("I can beat Ember without dying more than twice"). I'll build tests and tuning toward it.
- **Point at a reference moment** ("the Tyrant should feel like Chakan's fire boss", "mining should feel like Terraria's copper era"). Concrete references beat adjectives.

## Vocabulary

- **Deterministic simulation**: running a game with a fixed time step and seeded randomness so the same inputs always produce the same result. That's what made today's bot tests reliable ("run it deterministically at 60fps with seed 777").
- **Root-cause analysis**: finding *why* a failure happens, not just making it go away. Today's flaky tests were fixed for real only after tracing them. Asking "what's the root cause?" pushes past quick patches.
- **Vertical slice**: a thin but complete, playable piece of a big feature, like Phase 1 of the realm. Asking for "a vertical slice of X" gets you something to play early instead of lots of half-finished parts.

## Recommended next session

1. **Playtest first**, then tune through `?tune` and the boss constants (`realm/realmBosses.ts`, `data/platformerConfig.ts`). Bring back concrete notes.
2. **Decide the Android question** (unresolved #2/#3) before more content. If yes, add an orientation plugin and a realm touch-controls pass, then cut v0.5.0.
3. **Phase 4 candidates:** beds and chests, New Game+, per-tile flood-fill lighting, more biomes, and splitting `RealmScene.ts`.

Example next prompt:
> "Played the Forever Realm on desktop. The Tyrant is too easy, the Tide breath runs out too fast, and I got lost in the Grave Realm. Tune those, then set up Android landscape for the realm and cut v0.5.0. Don't add new content yet."

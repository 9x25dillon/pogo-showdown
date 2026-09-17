# Pogo Showdown — next-session handoff

Updated after the September 16, 2026 session (America/Los_Angeles; the GitHub merge timestamp falls on September 17 UTC).

## Start here

Today's session focused on **polishing graphics and gameplay, correcting balance and reliability issues, and adding separate character mastery**. The user then requested commit, push, and merge; all three completed. This handoff replaces outdated development plans and conflicting notes in the previous version.

- Workspace: `/home/kill/pogo-showdown`.
- Repository: https://github.com/9x25dillon/pogo-showdown
- Default branch: `master`.
- Feature commit: `b8df0da` — Add per-character mastery and polish gameplay.
- Merged PR: https://github.com/9x25dillon/pogo-showdown/pull/1
- Merge commit: `a78ee94`.
- Local `master` was synchronized and clean after the merge. This subsequent handoff rewrite is a documentation change; it has not been committed or pushed.
- Android debug APK rebuilt after the handoff at `android/app/build/outputs/apk/debug/app-debug.apk` (4,473,054 bytes). Signature verified; all four bundled web files match the latest `dist/` build. Version remains 0.3.0 (code 3). No release APK/AAB rebuild or physical-phone test was performed. SHA-256: `480aa773ecc6212cc8b4cf26826250f77aad5de1bbeb8c2073e33648bebcdf07`.

Begin the next session by reading this file, checking `git status --short`, branch and remote state, and any applicable workspace instructions. Do not assume temporary processes or screenshots still exist. Preserve any user edits. Do not recreate completed modes or ask again whether mastery should be separate.

## Product and architecture

A portrait, web-first game using TypeScript, Phaser 4, Vite, and a Capacitor Android wrapper. Logical canvas size: **480 × 854**. Art is procedural geometry, generated textures, and emoji; no new raster assets were needed this session.

Everything is local. IndexedDB stores progression; the leaderboard uses localStorage. The Circuit is a deterministic daily simulation against historical pros, not online multiplayer. IndexedDB has an in-memory fallback when persistent storage is unavailable.

Existing modes and screens:

- **Pogo Dash:** endless three-lane runner, with lane changes, jumps, ducks, combos, character perks, and equipped collectible-pog perks.
- **The Circuit:** daily simulated league against 11 pros. Unlocks at Pro career standing. The first eligible Pogo Dash run of the day resolves the player's scheduled match.
- **Yoyo Trick Lab:** 60-second gesture-pattern sessions with three strings. Sessions count toward Yoyo Rig usage; profile stores sessions and best score.
- **Pog Battles:** best-of-three timing slams. Highschooler practice is unstaked; ranked pros require Pro access and an owned stake. Wins can award one signature-pog drop per opponent per calendar day. Ranked losses remove the stake.
- **Pog Binder:** collectible inventory and equipment. Collection grids now paginate rather than hiding all but the first nine items. Ranked stake grids paginate beyond fifteen items.
- **The Locker:** shared Pog Stack and Yoyo Rig purchases plus a view of the selected character's earned mastery. Arrow controls change the active character.

## What changed this session

### Separate character mastery

`PlayerProfile.characters[characterId]` stores `runs`, `trainingRuns`, and `bestScore`. `lastCharacterId` records the last runner. These optional fields preserve compatibility with old profiles.

- Completing a Pogo Dash run after **15 active seconds** earns one training run for that character. Paused time does not count. Short runs still count as runs and can update the personal best.
- Every **four training runs** earns one character level, capped at **level 10**.
- Mastery tier thresholds: **4 / 12 / 24 / 40** training runs.
- Corresponding mastery points: **6 / 12 / 18 / 24**.
- Mastery now costs **no Tech Points** and cannot be purchased or traded in.
- Character selection, the Locker, and results expose individual progression.
- Circuit scoring uses the actual runner's training. Ranked Pog Battles uses the registry's selected character, falling back to the last played character, then Cleo.
- Only Pogo Dash currently awards character training. Trick Lab and Pog Battles do not.

### Existing-save migration

`getLoadout()` performs a one-time migration guarded by `characterMasteryMigrated`:

1. Refund the cumulative TP cost of the old owned shared-mastery tier by reducing `techPointsSpent`.
2. Reset the legacy mastery axis and record `masteryRefund`.
3. Keep gear, currency earned, collections, and career records intact.

Old aggregate runs were not reliably attributed to characters. Individual character records therefore begin with this update; historical career totals remain. Do not invent character-specific history from the aggregate count. Repeated reads must never issue another refund.

IndexedDB remains **version 3**. New optional properties on existing objects need no store upgrade. New stores or indexes require an appropriate versioned upgrade.

### Balance and economy

- Natural advantage grows by **1.5 percentage points per character level**, capped at **15%**, while net TP spent is zero.
- Otherwise gear points and that character's mastery combine, with +6 synergy for each maxed axis and a hard **30% total cap**.
- This Advantage applies to Circuit scores and ranked slams. It does not multiply casual runner scores. Character and collectible-pog perks still affect the runner.
- Crossing multiple career tiers in one run now awards a TP for **each** tier crossed. This fixes future awards; it does not retroactively reconstruct historically missed bonuses.
- Gear step costs remain `[2, 4, 6, 6]`; cumulative costs `[0, 2, 6, 12, 18]`. Gear trade-in refunds half the cumulative cost.
- Lifetime TP sources remain five career-tier awards plus up to twenty Circuit-win awards. Refunded TP is returned spending capacity, not new earnings.

Character changes:

| Character | Current distinction relevant to this pass |
|---|---|
| Cleo | Flair multiplier 1.3 |
| Khan | One extra starting life |
| Joan | +6 base points for successful hurdle/banner dodges; flair 1.15 |
| Albert | Speed ramp multiplier 1.25 |
| Ada | Jump and duck durations ×1.15; speed ramp ×0.9 |
| Sun Tzu | One starting shield that absorbs a hit while preserving the combo |
| Frida | Flair reduced from 1.4 to 1.2; retains speed ramp ×0.95 |
| Leo | Star spawn probability 26%, versus the standard 16%; flair 1.1 |

Career thresholds are unchanged: Rookie 0, Amateur 600, Varsity 2,000, Semi-Pro 5,000, Pro 10,000, Elite 20,000. Runner constants remain `BASE_SPEED=260`, `MAX_SPEED=680`, `SPEED_RAMP=5.5`, `PASSIVE_SCORE_RATE=0.12`. Consult `scoreCurve.ts` when changing these; opponent scoring depends on them.

This is an initial tuning pass. Automated checks establish the implemented rules, not equal character strength or enjoyable pacing. Human playtesting remains necessary.

### Graphics, controls, and reliability

- Hurdles have orange raised-barrier silhouettes and upward chevrons; banners have purple hanging silhouettes and downward chevrons.
- Added rider details, landing shadow, character-colored road edges, compact life/shield HUD, and a fading control hint.
- Added pause button, P/Esc pause/resume, and auto-pause on focus loss.
- Bounce animation uses elapsed time; repeated lane changes replace competing movement tweens.
- Destroyed obstacles are removed from the update list.
- Run, Trick Lab, and Pog Battle keyboard listeners are cleaned up on shutdown; Run and Trick Lab pointer handlers are also cleaned up.
- Fixed menu updates targeting destroyed text after an early scene exit, the Binder's initial perk-summary race, and repeated activation of several transition buttons.

## Where to work

| File | Responsibility |
|---|---|
| `src/game/systems/characterMastery.ts` | Training minimum, thresholds, progress lookup, mastery summary |
| `src/game/db/schema.ts` | Profile and per-character record shape; career tiers |
| `src/game/db/repository.ts` | Run recording, character credit, tier rewards, Circuit simulation |
| `src/game/db/loadoutRepository.ts` | Legacy refund migration, TP economy, Advantage calculation |
| `src/game/db/loadoutSchema.ts` | Gear axes and migration fields |
| `src/game/data/characters.ts` | Character perk values and descriptions |
| `src/game/data/loadoutData.ts` | Gear flavors, costs, caps, character-level constants |
| `src/game/data/pogs.ts` | Collectible catalog, rarity weights, perk clamps |
| `src/game/db/pogRepository.ts` | Collection, equipment, daily drops, battle results |
| `src/game/scenes/BootScene.ts` | Procedural texture generation |
| `src/game/scenes/RunScene.ts` | Runner loop, controls, pause, collisions, scoring |
| `src/game/scenes/CharacterSelectScene.ts` | Roster picker and mastery preview |
| `src/game/scenes/LoadoutScene.ts` | Gear shop and character mastery view |
| `src/game/scenes/GameOverScene.ts` | Results, mastery summary, score submission |
| `src/game/ui/pageControls.ts` | Shared inventory page controls |
| `tests/browser-regression.mjs` | Isolated browser regression suite |
| `PLAY_STORE.md` | Existing Android build/signing/release instructions |

## Run and verify

```bash
npm run dev
npm run build
git diff --check
```

The browser regression suite needs a Vite **development** server and Chromium with remote debugging. It imports source modules through Vite and is not designed to run against production preview.

The Chromium executable used this session was:

```bash
/home/kill/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome \
  --headless --no-sandbox --disable-gpu \
  --remote-debugging-port=9333 \
  --user-data-dir=/tmp/pogo-browser-check about:blank
```

Check whether that executable and the ports are available rather than assuming they persist. With the server and browser running:

```bash
npm run test:browser
# Optional screenshots:
POGO_SCREENSHOT_DIR=/tmp npm run test:browser
```

Defaults: `POGO_URL=http://127.0.0.1:5173`, `CDP_URL=http://127.0.0.1:9333`. Both can be overridden. The suite uses modern Node's native `fetch` and `WebSocket`; this session used Node 26.8.2. It creates and disposes an isolated browser context, leaving ordinary player saves untouched. No Playwright package install is required.

Verified this session:

- Production build and whitespace checks passed.
- Browser regressions passed for collection paging, one-time migration, separate mastery, training-duration gate, tier awards, Advantage caps, mastery UI, restart/listener behavior, pause, shield behavior, destroyed-obstacle cleanup, real run completion, and persistence after reload.
- No browser exceptions were recorded in the final suite.
- Character-picker and runner screenshots were visually inspected.
- Browser tests use direct scene/module access for much of their setup; they are not a substitute for full touch interaction testing or human gameplay.
- Vite still reports a large bundle warning, largely from Phaser. No bundle-size work was attempted.
- No GitHub CI checks were configured on PR #1. Verification was local.

Temporary screenshots were `/tmp/character-mastery.png` and `/tmp/runner-polish.png`. Treat them as disposable. Debug hook: `window.__game`.

Local ports and `.git` writes were blocked by the sandbox during this session; approved escalation was needed for browser/server startup, browser connections, and Git/GitHub operations. Use the environment's normal approval mechanism if those restrictions recur.

## Recommended next session

No further feature was committed to by the user. Suggested order:

1. **Playtest the current build on a phone.** Check obstacle readability, swipe responsiveness, pause/focus behavior, and mastery-screen layout. The rebuilt debug APK includes today's changes. Follow `PLAY_STORE.md` for installation or a signed release build; older release APK/AAB files have not been updated.
2. **Measure balance before further tuning.** Compare survival, score, and perceived usefulness across characters using similar runs and equipment. Pay particular attention to Ada's timing-plus-slowdown benefit, Leo's higher pickup rate, and the pace of 4/12/24/40 training milestones.
3. **Consider automated CI or further presentation polish** after gathering gameplay feedback. These are recommendations, not existing implementations or authorization to publish a new release.

Preserve the one-time refund, independent character credit, collection accessibility, and the 15%/30% caps unless the user changes those rules. Keep perk descriptions consistent with code. Run relevant regressions after changes; avoid repeatedly rerunning unchanged checks without a reason.

## Collaboration retrospective

The user asked to continue development, then clarified: polish/fix/balance the current graphics and gameplay while adding separate character mastery. They prefer concrete progress and later explicitly authorized commit, push, and merge. The requested implementation was delivered and merged; this document was requested afterwards.

Three ways the assistant could improve:

1. Establish a small, explicit balance/migration rule table before editing multiple systems; distinguish assumptions from the user's exact requirements.
2. Make browser assertions deterministic from the start: return serializable values instead of Phaser objects, and read action timers in the same evaluation that sets them.
3. Replace stale handoff sections during the original update instead of appending current facts above contradictory historical instructions.

Three ways the user could save time in future prompts:

1. Put the specific objective in the opening request, as they did in the follow-up, rather than only asking to continue.
2. Rank the priorities and identify the target experience or device, such as phone controls first, mastery second, and visual polish third.
3. Specify what completion means: build and tests, screenshots, Android package, and/or commit/push/merge. This reduces follow-up turns; it is not required to make a useful request.

Useful vocabulary:

- **Acceptance criteria:** observable conditions that define completion. Example: each character retains separate mastery after restarting the app.
- **Invariant:** a rule that must remain true through changes. Example: legacy mastery TP is refunded at most once.

Example next prompt: “Continue from Hand_off.md. Prioritize Android touch feel and character balance. Preserve existing saves and the 30% Advantage cap. Acceptance criteria: no duplicate inputs after restarts, readable controls on my phone, and passing regression tests. Make routine implementation choices, report balance assumptions, and commit, push, and merge when verified.”

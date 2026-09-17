# Pogo Showdown — next-session handoff

Updated after the September 17, 2026 session (release + balance tuning).

## Start here

This session: (1) rebuilt and published the Android release that had fallen a commit behind the last GitHub release, and (2) ran a data-driven character balance pass. Both are pushed to `master`.

- Workspace: `/home/kill/pogo-showdown`.
- Repository: https://github.com/9x25dillon/pogo-showdown, default branch `master`.
- Android release **v0.4.0** is live: https://github.com/9x25dillon/pogo-showdown/releases/tag/v0.4.0 (signed APK attached, same upload key as v0.1.0–v0.3.0, installs as an update). `versionCode` 4, `versionName` "0.4.0".
- Why a new release was needed: `b8df0da` (per-character mastery) merged *after* the v0.3.0 tag was cut, so the last published APK didn't include it. Fixed by bumping the version and cutting v0.4.0.
- Character balance pass (see below) landed in three commits after v0.4.0 was tagged, so **the published v0.4.0 APK does not include the balance changes** — the next release should bundle them.
- Local `master` is clean and pushed as of this handoff.

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

## What changed this session (balance tuning)

Simulated RunScene's actual scoring formulas outside Phaser (Monte Carlo, thousands of runs per character across fixed "skill" levels — probability of correctly timing a jump/duck — since real human reflex data doesn't exist yet) to compare characters head to head. Script was scratch work, not committed; rerun it from the formulas below if needed.

**Finding:** pure-survivability characters (Khan's extra life, Sun Tzu's shield) beat every flairMod-based character (Cleo, Joan, Frida, Leo) by 20-30%, widening with skill/run length. Root cause: passive score (`speed * dt * PASSIVE_SCORE_RATE`, the dominant score channel over a full run) previously ignored `flairMod` entirely, so an extra life converted directly into more of the dominant channel while flairMod only touched the secondary trick-point channel. Einstein and Ada (no flairMod at baseline) trailed by a similar 23-30%, for a different reason: their identity stats (speedMod, timingMod) don't compound with survival time the way flairMod now does.

**Fixes (three commits, `src/game/config.ts`, `src/game/scenes/RunScene.ts`, `src/game/data/characters.ts`):**

- `PASSIVE_FLAIR_WEIGHT = 1.1` in `config.ts`: `passiveMod = 1 + (flairMod - 1) * PASSIVE_FLAIR_WEIGHT` now multiplies the passive score gain, not just trick points. Closes the flairMod-character gap to ~5-17%. `scoreCurve.ts` (career tiers, pro-opponent scoring) is untouched by design — it's flairMod-agnostic and stays the flairMod-1 baseline.
- Einstein: `flairMod` 1 → 1.15 (keeps "Momentum+" as the headline stat).
- Ada: `flairMod` 1 → 1.2 (chosen over a flat trickBonus because flairMod compounds with the passive-score fix the same way Frida's does; landed in Frida's ~11-18%-behind territory rather than Ada's own ~20-30%).

This is still an initial tuning pass grounded in simulated formulas, not real playtesting — Khan/Sun Tzu still lead by design (survivability archetype), and nobody has measured whether Ada's `timingMod` (15% longer jump/duck window) actually helps human reflexes as much as this pass assumes it might. Flag both to the user before further rebalancing.

## What changed in the previous session (per-character mastery, 2026-09-16)

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

This session used the system Chromium instead of a Playwright-managed one:

```bash
/usr/bin/chromium --headless --no-sandbox --disable-gpu \
  --remote-debugging-port=9333 \
  --user-data-dir=/tmp/pogo-browser-check about:blank
```

`npm run dev` binds to `localhost` (IPv6 `::1`) — `curl 127.0.0.1:PORT` will get connection-refused even though the server is up; use `localhost` or `::1`. Also: a `Bash` tool call backgrounded with a trailing `&` in this environment can get torn down when that specific tool call ends — use the tool's own `run_in_background` option instead, or the dev server dies silently between calls.

Check whether that executable and the ports are available rather than assuming they persist. With the server and browser running:

```bash
npm run test:browser
# Optional screenshots:
POGO_SCREENSHOT_DIR=/tmp npm run test:browser
```

Defaults: `POGO_URL=http://127.0.0.1:5173`, `CDP_URL=http://127.0.0.1:9333`. Both can be overridden. The suite uses modern Node's native `fetch` and `WebSocket`; this session used Node 26.8.2. It creates and disposes an isolated browser context, leaving ordinary player saves untouched. No Playwright package install is required.

Verified this session:

- Production build, `tsc --noEmit`, and the full browser regression suite passed after the version bump and after each balance commit.
- Signed release APK's certificate verified against `apksigner` (SHA-256 `f0da5384...`, matches `PLAY_STORE.md`'s recorded upload-key fingerprint).
- A real Android phone was attached over `adb` this session (`adb devices` showed one) but was not used to playtest — only the balance simulation and automated regressions ran. Physical playtesting is still outstanding.
- No GitHub CI checks are configured on this repo; verification is local only.

Local ports and `.git` writes needed approval via the sandbox's normal escalation prompt this session (browser/server startup, browser connections, Git/GitHub operations). Expect the same next time.

## Recommended next session

1. **Cut a v0.4.1 (or v0.5.0) release bundling the balance commits.** v0.4.0 only has the mastery/gameplay-polish content; the three balance commits made after it aren't in any published APK yet.
2. **Playtest on the attached phone.** A device was connected via `adb` this session but never used. Specifically worth checking: does Ada's 15%-longer jump/duck window feel meaningfully easier, or is the `flairMod` bump doing all the real work? That answer should drive whether `timingMod` needs its own tuning.
3. **Re-run the balance simulation after any further character/scoring changes** rather than eyeballing new numbers — the simulator (Monte Carlo against RunScene's real formulas) caught a 20-30% structural gap that wasn't obvious from reading the character table alone.

Preserve the one-time mastery-refund migration, independent character credit, collection accessibility, and the 15%/30% Advantage caps unless the user changes those rules. Keep perk descriptions consistent with code — note Einstein and Ada's perk *text* still only describes their headline stat; the small flairMod bump is intentionally not called out in the UI, matching how Frida's speedMod isn't either.

## Collaboration retrospective

The user asked to finish the Android release, then to keep developing. Given an open choice of focus (playtest / balance / new feature / other), they picked balance tuning, then explicitly approved both the systemic flairMod fix and the Einstein/Ada fix via follow-up choices rather than open-ended requests.

Two things worth carrying forward:

1. Simulating the actual scoring code (not just reading character stats and reasoning about them) surfaced a real, non-obvious structural issue — survivability perks compound with run length in a way flat multipliers don't. Reasoning from the code alone likely would have missed the size of the gap.
2. `npm run dev` in this environment binds IPv6-only (`localhost`, not `127.0.0.1`), and backgrounding a dev server with a bare `&` inside one Bash tool call can die when that call ends — costs a few minutes of confused debugging if not expected going in.

Useful vocabulary:

- **Acceptance criteria:** observable conditions that define completion. Example: each character retains separate mastery after restarting the app.
- **Invariant:** a rule that must remain true through changes. Example: legacy mastery TP is refunded at most once.

Example next prompt: “Continue from Hand_off.md. Prioritize Android touch feel and character balance. Preserve existing saves and the 30% Advantage cap. Acceptance criteria: no duplicate inputs after restarts, readable controls on my phone, and passing regression tests. Make routine implementation choices, report balance assumptions, and commit, push, and merge when verified.”

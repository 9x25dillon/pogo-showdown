# Pogo Showdown — Handoff

Last session: 2026-09-16. Repo: `~/pogo-showdown` (git, branch `master`, no remote configured yet).

## Where things stand

**Built and verified working** (headless-browser tested each time, screenshots checked, no console errors):
- **Pogo Dash** — the core endless lane-runner. Playable end to end.
- **Local DB** (IndexedDB, `src/game/db/LocalDB.ts`) — player profile, tiers, career stats.
- **The Circuit** — 11 historical pros running a deterministic, seeded daily league since simulated purely from wall-clock date. Unlocks at Pro tier. Player's first Pogo Dash run each day auto-resolves as their scheduled match.
- **Equipment/Advantage system** — Pog Stack / Yoyo Rig / Character Mastery axes, Tech Point economy, The Locker screen, The Natural secret path. Applies only to Circuit battle scores, not the casual leaderboard.

- **Yoyo Trick Lab** (2026-09-16, v0.2.0) — `scenes/TrickLabScene.ts` + `data/tricks.ts`. 60s sessions, 3 strings, prompted swipe/tap patterns with real yoyo trick names, combo multiplier same shape as Pogo Dash. Sessions are recorded on the profile (`trickLabSessions`, `trickLabBest`, optional fields, no DB version bump) and count as Yoyo Rig "use" for the Locker's unlock gate via `yoyoUsageCount()`. Verified on a Pixel with real touches driven over adb + Chrome DevTools (see "Testing on device" below).
- **Android packaging** — Capacitor wrapper in `android/`, signed release pipeline, GitHub Releases carry the APK. See `PLAY_STORE.md`.

**Not built yet** — Pog Battles is still a menu stub. Design plan below; the open data-model question (Pog Stack tier vs. discrete collectible pogs) still needs the user's call before building.

## How to run / test

Android/Play packaging (Capacitor) lives in `android/`; build, signing, and Play Console steps are in `PLAY_STORE.md`.

```bash
cd ~/pogo-showdown
npm run dev          # http://localhost:5173
npm run build         # production build
npx tsc --noEmit -p tsconfig.json   # typecheck only
```

No `chromium-cli` in this environment. Testing approach that worked: installed `playwright` into the scratchpad dir (`npm install playwright@<version>`), then `npx playwright install chromium` (the cached `~/.cache/ms-playwright` browser revision didn't match the npm package's expected revision — had to fetch a matching one). Drive with a small `.mjs` script using `chromium.launch({args:['--no-sandbox']})`, screenshot at each step, and read the screenshots with the Read tool. To test states that require real playtime (Pro tier, owned gear, etc.) without grinding, write directly into IndexedDB via `page.evaluate` — see any `drive*.mjs` pattern from this session (not saved to the repo, they lived in the session scratchpad).

## Testing on device

Debug builds have WebView inspection enabled. Forward Chrome DevTools to the app's *current* pid (the socket name changes on every restart — a stale forward just hangs):

```bash
adb forward --remove-all
adb forward tcp:9222 localabstract:webview_devtools_remote_$(adb shell pidof com.pogoshowdown.app | tr -d '\r\n')
```

Then `chromium.connectOverCDP('http://localhost:9222')` from Playwright, read scene state through `window.__game` / `window.__trick` / `window.__seq` (test hooks), and send real touches with `adb shell input swipe/tap`. Game-to-device pixel mapping on the Pixel: device_y ≈ 205 + game_y × 2.36, device_x ≈ game_x × 2.25. Remember the session clock keeps running while you read screenshots — a 60s mode will end and its results buttons will eat your next tap.

## Architecture map

```
src/game/
  config.ts              shared constants: WIDTH/HEIGHT, lanes, colors,
                          BASE_SPEED/MAX_SPEED/SPEED_RAMP/PASSIVE_SCORE_RATE
                          (single source of truth for RunScene AND scoreCurve.ts)
  data/
    characters.ts         8 selectable highschoolers (Pogo Dash roster)
    circuitRoster.ts       11 Circuit pros (id, name, epithet, color, emoji, skill)
    loadoutData.ts          Pog/Yoyo/Mastery tier tables, TP costs, caps
  db/
    LocalDB.ts              generic IndexedDB wrapper + in-memory fallback
    schema.ts                 PlayerProfile, TIERS, tierForScore()
    repository.ts              profile/circuit/season logic (the big one)
    loadoutSchema.ts             AxisState, PlayerLoadout, AdvantageResult types
    loadoutRepository.ts          TP economy, unlock/trade-in, computeAdvantage()
    runResult.ts                   RunScene -> GameOverScene payload shape
  scenes/
    BootScene            procedural textures (no raster art in this project)
    ModeSelectScene         main menu, shows tier + Circuit lock state
    CharacterSelectScene     highschooler roster picker
    RunScene                  the actual gameplay
    GameOverScene               score, tier-up/circuit-match/TP banners
    LeaderboardScene              local top-10
    CircuitScene                   standings, today's match, locked teaser
    LoadoutScene                    "The Locker" - buy/trade gear tiers
  systems/
    dates.ts, seededRandom.ts, scoreCurve.ts, LeaderboardService.ts
  ui/
    CharacterCard.ts        procedural "trading card" visual (shapes+emoji+text)
```

## Key decisions made this session (and why)

1. **Web-first (Phaser + TS + Vite), not native.** No device/simulator access in this environment; a browser build is testable end-to-end right now and packages to a real app later (Capacitor) once the loop is validated. Revisit if the user wants App Store distribution soon.
2. **Everything local, no backend.** IndexedDB with an in-memory fallback. The Circuit's "multiplayer" is a deterministic seeded simulation keyed off wall-clock date, not a server — reproducible, catches up correctly after any absence, needs zero infrastructure.
3. **Balance is derived from the game's own math, not guessed.** `scoreCurve.ts` reproduces RunScene's exact speed-ramp/scoring formula so tier thresholds and pro opponent scores stay internally consistent. When Pogo Dash's scoring formula changes, re-derive from there rather than hand-tuning numbers again.
4. **Equipment: three structurally identical axes, one shared 30% ceiling, a free-but-lower 15% underdog path.** This was a genuinely ambiguous, densely-worded request (see "unresolved assumptions" below) — resolved by picking the most internally-consistent reading and documenting it explicitly rather than silently guessing. Flag this to the user if they meant something different; it's cheap to re-tune the numbers, harder to redo the architecture.
5. **No image-generation tool available** → built procedural card art instead of raster assets, and said so plainly rather than quietly delivering something lesser without flagging it.

## Balance reference table

| Tier | Threshold (career-best score) | ~survival time |
|---|---|---|
| Rookie | 0 | - |
| Amateur | 600 | ~16s |
| Varsity | 2000 | ~38s |
| Semi-Pro | 5000 | ~95s |
| **Pro** (unlocks Circuit) | 10000 | ~145s |
| Elite | 20000 | ~230s+ |

Scoring curve constants (`config.ts`): `BASE_SPEED=260, MAX_SPEED=680, SPEED_RAMP=5.5, PASSIVE_SCORE_RATE=0.12`. Ramp completes at `(680-260)/5.5 ≈ 76.4s`. Pro opponent score: `seconds = 40 + (skill-70)*7`, then `passiveScoreAtTime(seconds) * variance(0.85-1.15)`.

Equipment economy (`loadoutData.ts`): 4 tiers per axis, cumulative points `[0,6,12,18,24]`, cumulative TP cost `[0,2,6,12,18]`. Synergy bonus `+6` for maxing any one axis (→ 30 total). Natural path cap `15%`, needs `techPointsSpent===0` and Character Level `10` (= 40 total runs, `RUNS_PER_CHARACTER_LEVEL=4`). Lifetime TP cap: 5 (tier-ups) + 20 (circuit wins, capped) = **25 TP ever** — deliberately just enough to max one axis (18 TP) with a little left over, not two.

## Known limitations / unresolved assumptions

Flag these back to the user early next session rather than assuming silently:

1. **Character Mastery is one unified track**, not per-highschooler. If the user wants "maining" a specific highschooler to matter distinctly (separate mastery per character), that's a real redesign of the Prodigy axis, not a tweak.
2. **Advantage bonus applies only to Circuit matches**, never to casual Pogo Dash or the local leaderboard. Confirm this is still the intended scope once Pog Battles exists — does Pog Battles use the same Advantage number, or does it need its own?
3. **No git remote configured.** `gh` is authenticated as `9x25dillon` with `repo` scope, so a repo can be created and pushed to on request — needs the user's call on name/visibility, don't assume.
4. **Pog Stack (the Locker axis) vs. "collectible pogs" (the user's stated vision) aren't the same data model yet.** The Locker's Pog Stack is a single tiered progression track (4 tiers, one value). The user's original ask ("add the pogs... as collectable") implies discrete, individually ownable/tradable pog items. Pog Battles (below) is where this needs reconciling — see the open question in that section.

## Gotchas hit this session (save yourself the rediscovery)

- **The `</content>` bug**: repeatedly, Write tool calls in this session ended up with a literal stray `</content>` line appended to the file (an artifact of how the content was composed, not a tool bug). If a freshly-written file's last line looks like `</content>` or a build/typecheck fails mysteriously at end-of-file, run: `grep -rl '^</content>$' src | xargs -r sed -i '/^<\/content>$/d'`. Better: don't reproduce the pattern that caused it in the first place — end file content cleanly with the actual last code line, nothing after.
- **Phaser installed is v4.2.1**, not v3, since `npm install phaser` pulled latest. The public API used here (Scene, GameObjects, tweens, particles, Graphics→generateTexture) has behaved v3-compatible so far, but if something acts unexpectedly, check v4 docs/changelog rather than assuming v3 behavior.
- **IndexedDB `DB_VERSION`** is at `2` (bumped when the `loadout` store was added). Any future new store or schema shape change needs another version bump in `LocalDB.ts`, or `onupgradeneeded` won't fire for anyone who already has a v2 database on their device.
- `npx playwright install chromium` was needed even though `~/.cache/ms-playwright` had a chromium build — the cached revision didn't match the installed npm package's expected revision. Don't assume a cached browser is usable without checking the version.

---

## Next up: Pog Battles — design plan

**Concept**: turn-based skill contests where you wager and can win/lose individual pogs, against either the 8 highschoolers (low-stakes practice) or, once Pro-tier, the 11 Circuit pros (real stakes). This is also the natural way to grow the Locker's Pog Stack axis through play instead of only through Tech Points.

**Open question to resolve with the user first**: does winning a battle grant progress on the existing single-track Pog Stack axis (simplest, reuses current system, but "collectible" stays abstract), or does it grant a discrete named pog item into a real collection (truer to "collectable," bigger data-model change: a new `pogCollection` store of individually-owned pog instances with rarity, and the Locker's Pog Stack tier becomes *derived* from collection size/rarity rather than directly purchased)? Recommend asking directly rather than guessing — this determines whether Pog Battles is an alternate path to the same axis, or unlocks a genuinely separate collectible layer.

**Proposed core loop** (assuming the discrete-collectible direction, since it best matches "collectable" and "tradable" from the original request):
1. Pick an opponent (highschooler roster for practice, no stakes; Circuit pro roster for ranked stakes, gated the same way Circuit is).
2. Wager: pick one owned pog (or battle unstaked if you own none yet — always allow a free practice path so the mode is playable pre-collection).
3. Best-of-3 rounds, each a timing-based "slam" mini-game: a moving power/accuracy meter, tap to lock in — reuses the same "skill with the illusion of control" philosophy as Pogo Dash's jump/duck timing, just as a standalone input rather than embedded in a runner.
4. Opponent's round performance derived from their `skill` rating (same Elo-ish approach already used for Circuit pro-vs-pro sims) plus their own equipped-pog flavor for personality/color.
5. Winner of 2-of-3 takes the wagered pog (or, unstaked, a small consolation prize - a Tech Point or two).
6. Log to a new `pogCollection` + `battleLog` DB store; local-only, same pattern as everything else this session.

**Reuse from existing code**: the Circuit's seeded-RNG + Elo win-probability pattern (`repository.ts`'s `winProbability`/`simulateProDay`) is directly reusable for opponent round outcomes. `CharacterCard` can render individual pog items once they're discrete objects with their own name/rarity/color.

**Scope warning for next session**: this is a full mini-game (its own input scene, its own win/loss resolution, a new collectible data model) — comparable in size to what The Circuit took this session. Don't try to also do Yoyo Trick Lab in the same pass unless there's a lot of budget; ship one, verify it's fun, then the other.

## Shipped: Yoyo Trick Lab (kept for reference — original design plan)

**Concept**: a dedicated freestyle trick-combo mode, separate from Pogo Dash's runner loop, that's the natural home for building Yoyo Rig mastery through direct practice rather than passively equipping it.

**Proposed core loop**:
1. A named trick is prompted (e.g. "Around the World," "Rock the Baby," "Walk the Dog" — real yoyo trick names, good flavor already available for free), shown as a short input pattern (arrow/swipe sequence).
2. Player inputs the matching swipe/tap sequence within a timing window.
3. Successful tricks chain into a combo multiplier (same combo-scoring shape as Pogo Dash, for consistency of feel); a miss breaks the chain.
4. Session score feeds its own local leaderboard, and completing sessions grants Yoyo Rig axis "usage" credit (paralleling how a Pogo Dash run counts as "using" the current equipped tier) so Trick Lab becomes a genuine second path to leveling that axis, not just flavor.

**Reuse from existing code**: `RunScene`'s swipe-gesture detection (`pointerdown`/`pointerup` delta logic) is directly transferable to a sequence-input scene. `ComboSystem`-style multiplier math already exists in `RunScene` (`onTrickSuccess`) and can be lifted into a shared helper if both modes end up wanting it (currently combo logic is inline in RunScene - worth extracting to `systems/` if a second mode needs the same shape).

**Scope note**: smaller than Pog Battles (no opponent AI, no wagering/economy design needed) — likely the faster of the two to build if next session's budget is tight.

---

## Session retrospective (condensed — full version was given to the user in chat)

- Where Claude could improve: (1) repeatedly reproduced the `</content>` stray-tag bug across many Write calls instead of catching and fixing the root cause once; (2) took several internal false starts before converging on the equipment system's final rule set — should write the numeric rule table first, narrate the reasoning after; (3) didn't batch cleanup sweeps from the start of the session (fixed eventually, but several early turns fixed one file at a time).
- Where the user could improve: dense run-on requests mixing several distinct design axes in one paragraph (the equipment-system ask) cost real interpretation risk; a follow-up clarification (pogs/yoyos theming) arrived after implementation had already started under placeholder names, costing a rename pass; this handoff request itself bundles five distinct asks (plan two features, commit, push, merge, write two documents) in one message, which is fine but means a blocker on one (e.g. push needing a remote) can stall visibility into the rest.

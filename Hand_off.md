# Pogo Showdown — session handoff

Updated September 28, 2026. This replaces the September 22 handoff; earlier detail is in Git history.

## Start here next session

1. Read this file, `README.md`, `git status --short --branch` and `git log -8 --oneline`. Check the remote before publishing.
2. On September 28 the Forever Realm became the whole game. The user decided that "nobody has downloaded this app yet so nothing is being disrupted", so old modes and menus were removed rather than kept for compatibility. Every other mode was rebuilt natively inside the world. The user's requirement was that every rebuilt mini-game be "spec'd for entertainment, difficulty, risk/reward and stat development."
3. The work was built on `realm-unification` and merged to `master`. v0.5.0 was published as a GitHub release, with a signed APK and a noarch RPM. The APK was installed and launched on the user's Pixel 10a. Nothing was uploaded to Google Play.
4. **Recommended next task:** a human playtest of the full loop, on desktop with the Xbox pad and on the phone. No human has played any of this yet. Every number below is a design target that has only been checked by automated tests.

## What the game is now

The Title screen has CONTINUE, and NEW WORLD, which leads to a hero picker. Everything happens in the Forever Realm. Your hero, XP, pogs, Tech Points and activity records are **account-level** (IndexedDB `profile`, `loadout` and `pogs` stores), so a New World keeps them. The world itself holds terrain, items, relics, homestead and gear (`RealmSave`).

| System (old mode) | In the world | Balance lives in |
|---|---|---|
| Characters + mastery | The hero is the picked highschooler. The perk becomes a stat. Levels 1–20 give +3 HP and +1.5% damage each, and a mastery tier every 5 levels scales the perk by 1+0.25·tier. | `realm/hero.ts` |
| Combat layer | Style combo gives +5% per chained hit (cap 30% plus perks) and resets when you're hit. Crits (×1.75) come only from Jo of Arc and trick-bonus pogs. Guard pips absorb a hit and recharge every 20s once out of combat. Revives come from pogs. | `hero.ts`, `RealmHero.ts` |
| XP risk | Kills (with combo), ore, crafting, duels, medals and bouts all add **unbanked** XP. Sleeping or a realm/arena victory banks it; a real death loses half. Rift clears bank immediately. | `hero.ts` |
| Pog Binder / perks | Equipped pogs map to Realm stats: extraLives→revives, shieldHits→guard, flair→combo cap, starBonus→loot %, trickBonus→crit %, speedScale→speed. Their Pog Quest actives join the hotbar and refill on sleep or a portal trip. Footpeg weight capacity is 4 + tier. | `hero.ts`, `RealmHeroMenu.ts` |
| Loadout / Tech Points | TP is paid once per milestone key (`boss:*`, `duel:*`, `dash:*:gold`, `pogorank:*`, `arena:*`, `quest:*`) and buys footpeg tiers at 2/4/6/6. | `progression.ts` |
| Pog Battles | Seven Schoolyard highschoolers stand west of spawn; the 11 pros are spread across the map, with the top 3 in caverns 30–90 tiles down. The slam bar is best of 3. Skill speeds up the sweep and shrinks the sweet zone; your level, footpeg weight, crit and trick window help. Friendly pays XP. For-keeps stakes copper (Schoolyard) or a pog (pros) and pays a signature pog once per realm day. Pros need 4 distinct Schoolyard wins first. | `realm/duels.ts`, `RealmDuel.ts` |
| Yoyo Trick Lab | Four yoyos are crafted at the bench, each landing longer tricks. A throw opens a trick window; the 20 Trick Lab sequences fire effects. Dead-end inputs snap strings (3 snaps = tangled 6s). Chains give up to +50%. | `realm/yoyo.ts`, `RealmYoyo.ts` |
| Pogo Dash | The Pogo Stick is a mount: auto-bounce, held-jump super bounce, a perfect bounce (jump within 150ms of landing), and stomps. Riding costs +25% damage taken and no regen. Three Dash Trials (Shrine Sprint, Ridge Run, night-only Night Circuit) award medals, Hardcore scores ×1.5 on bonus points, and a Pogo Rank sums your bests. | `realm/dash.ts`, `RealmDash.ts` |
| The Circuit | The Circuit Arena is a pocket reached through a red gate east of the shrine. It's an 11-pro ladder of 60s bouts, each with its own rules (see `PRO_RULES`). Score is kill toughness × combo against the pro's mark. Showboat raises the mark by 30% for ×2 rewards. | `realm/arena.ts`, `RealmArena.ts` |
| Pog Quest | 15 rifts in the overworld open in the old unlock order. Entering one saves and launches `PlatformerRun` as the Realm hero, and results return to the rift. Clears bank XP and send coins to your pack as copper. | `realm/rifts.ts`, `RealmRifts.ts`, `db/questRepository.ts` |
| Leaderboard | The hero menu's RECORDS tab. | `RealmScene.records()` |

Removed: `ModeSelect`, `CharacterSelect`, `Run`, `GameOver`, `Leaderboard`, `Circuit`, `Loadout`, `TrickLab`, `PogBinder`, `PogBattle`, `PlatformerLevelSelect`, plus their dead data/db/system modules. The LocalDB stores for the old circuit (`standings`, `season`, `matchLog`, `battleLog`) still exist but are unused. The DB version is still 4.

## Controls added this session

| Action | Keyboard | Controller | Touch |
|---|---|---|---|
| Hero menu (HERO / POGS / GEAR / RECORDS) | I | L3 (new mapping: button 10) | HERO button |
| Pog ability, yoyo, pogo | select the hotbar slot, then K / click | RT | tap world |
| Trick inputs (yoyo in hand) | arrow keys; ● = K | right-stick flick from centre; ● = RT | trick pad appears |
| Duel / Dash flag / arena ladder / rift | S / ↓ | D-pad down | tap prompt |
| Slam in a duel | Space / K / A | A | tap |

With the yoyo in hand, the arrow keys stop moving and aiming the hero. WASD still moves.

## Code map (new this session)

All under `src/game/`. The pattern is a pure rules module plus a runtime class with a small host interface, like the existing homestead and expedition code.

- `realm/hero.ts`, `realm/progression.ts`, `realm/RealmHero.ts`, `realm/RealmHeroMenu.ts`
- `realm/RealmPanel.ts`: one shared full-screen menu (rows, tabs, paging, pad/keys/touch, per-child scroll factor)
- `realm/duels.ts` + `RealmDuel.ts`, `realm/yoyo.ts` + `RealmYoyo.ts`, `realm/dash.ts` + `RealmDash.ts`, `realm/arena.ts` + `RealmArena.ts`, `realm/rifts.ts` + `RealmRifts.ts`
- `scenes/TitleScene.ts`. `RealmScene.ts` hosts all of the above and is now ~2400 lines. Extract further subsystems only when a concrete change needs it.
- New optional `RealmSave` fields: `hero`, `yoyo`, `pogo`, `duelSpots`, `arenaGate`, `riftSpots`. New pocket `arena` (its `PocketDef` boss fields are unused). `PlayerProfile.realm` and `CharacterProgress.xp` are optional.
- Packaging: `packaging/rpm/` (spec, launcher, desktop file, icon, `build.sh`), and `npm run package:rpm`.

## Validation

The final state passed `npm run build` and the full browser regression: unified, Pog Quest, Realm core, portals, Forever Gate, homestead and Foundry suites, with zero browser exceptions. The new `tests/realm-unified-regression.mjs` covers every system above through real scene paths, with keyboard input for the hero menu. Run it alone with `POGO_SUITE=unified`.

Things learned while testing:
- Stopping and restarting an **active** scene in the same frame is silently ignored. Wait until no scenes are active before starting, or call `restart`.
- Anything a rider does between `step()` calls varies, because the real loop runs frames in between. Check prompts on foot, and use tall water columns rather than single tiles.
- Leftover enemies (a 900 HP knight) will kill the hero in later steps. Despawn them.
- Rift placement failed on ~3.5% of seeds before the two-pass search. A 200-seed scan now passes; `rifts.ts` has the rationale.
- Earlier suites predate heroes, so `realm-regression` resets to a level-1 Cleo with no pogs before running.

Device and packaging:
- `npm run android:release` produced versionCode 5 / 0.5.0. It installed as an update over the Pixel's v0.3.0 (same key), launched in landscape, and a new world started with touch controls.
- **iPhone:** detected over USB, but no build is possible here. iOS needs Xcode on macOS, and there is no `@capacitor/ios` project.
- The RPM is built in Docker `fedora:42`. It was installed in a clean container, and the launcher served the game and music on `127.0.0.1:47219`. The fixed port is deliberate: IndexedDB saves are per origin.

## Free software and F-Droid (v0.5.1)

- The user chose **GPL-3.0-or-later** for the code (`LICENSE`) and **CC BY-SA 4.0** for their soundtrack (`LICENSE-MUSIC`, with credits in `public/music/LICENSE.txt`). The music is credited to "9x25dillon"; change that if they want another artist name.
- F-Droid prep: removed the Google Services Gradle plugin; keyless release builds are unsigned; Fastlane metadata is in `fastlane/metadata/android/en-US/`; the draft fdroiddata recipe and steps are in `fdroid/`. The merge request to gitlab.com/fdroid/fdroiddata needs the user's GitLab account and hasn't been opened. Expect reviewers to adjust the Node setup (Vite 8 needs Node 20.19+).
- v0.5.1 (versionCode 6) is tagged and released with a signed APK and RPM. The repo is public, with a new description, topics and homepage.

## Decisions and open questions

Decided this session:
1. The Realm replaces every mode (user's call). Account-level progression survives New World.
2. The Android shell is now `sensorLandscape`, because the whole game is the 960×540 Realm. The portrait title screen and Pog Quest rifts pillarbox on phones.
3. Base crit is 0%, which makes crit a build choice.
4. Quest rifts reuse the original Pog Quest scenes unchanged (portrait) rather than being rebuilt in the Realm engine.

Open, and needing a human:
- **Balance.** Arena marks (610–1820) versus real kill speed, duel difficulty spread, Dash pars (5/14/16s) and medal lines, the XP curve (≈10k XP to level 20 per hero), and the 50% death loss. None of this has been felt by a player.
- **Phone UX.** Title and rift screens pillarbox in landscape. A per-scene orientation lock needs a Capacitor plugin (a new dependency). The minimap overlaps the right-hand buttons on small screens.
- **Economy.** For-keeps duels can re-win signature pogs daily, and New World resets the realm day. Arena rematches are an XP farm, balanced only by danger.
- **Carried forward.** Soundtrack artist credit, Play Store listing and screenshots (they still show the old modes), and post-Reaper progression.

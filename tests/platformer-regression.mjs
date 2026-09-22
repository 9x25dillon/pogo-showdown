import assert from 'node:assert/strict';

// Uses the runner's isolated browser context, never the player's save.
// Level order: 0 Footpeg Flats, 1 Signature Sprint, 2 Tech Park Tangle, 3 Circuit Showdown (boss),
// 4 Rooftop Relay, 5 Night Circuit, 6 Summit Slam (boss 2), 7 Co-op Circuit, 8 Co-op Summit.
export async function verifyPlatformer({ execute, evaluate, waitFor, start, scene, textExists }) {
  const s = scene('PlatformerRun');
  const p1 = `${s}.heroes[0]`;
  const enter = async index => {
    await execute(`window.__game.registry.set('platformerLevelIndex', ${index});`);
    await start('PlatformerRun');
    await waitFor(`${s}.ready && ${s}.levelIndex === ${index}`);
  };
  // Headless Chrome's frame rate is erratic (often < 10fps), which starves
  // per-frame AI. Drive the game at an exact 60fps instead, without rendering.
  // \`body\` runs after every frame and may return true to stop early. Runs in
  // 3s chunks so no single CDP call hits the runner's per-call timeout.
  const simulate = async (seconds, body = '') => {
    let simulated = 0;
    while (simulated < seconds) {
      const chunk = Math.min(3, seconds - simulated);
      const [ran, stopped] = await execute(`const g = window.__game; const s = ${s}; g.loop.sleep();
        let t = window.__simClock ?? performance.now(); let frames = 0, stop = false;
        try { for (; frames < ${chunk} * 60 && !stop; frames++) { t += 1000 / 60; g.headlessStep(t, 1000 / 60); stop = !!(() => { ${body} })(); } }
        finally { window.__simClock = t; g.loop.wake(); }
        return [frames / 60, stop];`);
      simulated += ran;
      if (stopped) break;
    }
    await execute('delete window.__simClock;');
    return simulated;
  };

  // The rival must be able to finish every race level on its own at real frame rates,
  // without once falling into a pit (an idle player never gets in its way).
  for (const index of [0, 1, 2, 4, 5]) {
    await enter(index);
    await execute(`window.__game.registry.remove('lastPlatformerResult'); window.__rivalFalls = 0;`);
    const seconds = await simulate(40, `if (s.rival.y > 900 && !window.__rivalFalling) window.__rivalFalls++;
      window.__rivalFalling = s.rival.y > 900; return !!window.__game.registry.get('lastPlatformerResult');`);
    assert.deepEqual(await execute(`return [window.__game.registry.get('lastPlatformerResult')?.raceOutcome, window.__rivalFalls];`),
      ['rivalWon', 0], `rival on level ${index}`);
    assert.ok(seconds < 25, `rival took ${seconds}s on level ${index}`);
  }

  // Falling in a pit costs exactly one life and respawns you standing on the ledge
  // (a teleport via setPosition used to leave the body under the ground).
  await enter(0);
  await simulate(1);
  await execute(`const s = ${s}; const hero = s.heroes[0]; const lives = s.lives;
    hero.lastCheckpoint = { x: 600, y: 700 }; hero.sprite.body.reset(765, 600);
    window.__livesBefore = lives;`);
  await simulate(2.5);
  assert.deepEqual(await execute(`const s = ${s}; const hero = s.heroes[0];
    return [window.__livesBefore - s.lives, Math.round(hero.sprite.x), Math.round(hero.sprite.y), hero.sprite.body.blocked.down];`), [1, 600, 700, true]);

  // Every open pit must fit inside a full jump at the shipped physics values,
  // and a platform only counts as a bridge if a jump can reach its top.
  assert.deepEqual(await execute(`const { LEVELS, largestUnbridgedGap } = await import('/src/game/data/levels.ts');
    const { PHYS, PHYS_DEFAULTS, jumpReach } = await import('/src/game/data/platformerConfig.ts');
    const { distancePx, peakPx } = jumpReach(PHYS_DEFAULTS);
    return [LEVELS.every(l => largestUnbridgedGap(l, peakPx - 8) <= distancePx), JSON.stringify(PHYS) === JSON.stringify(PHYS_DEFAULTS),
      !!document.getElementById('pogquest-tune')];`), [true, true, false]);

  await enter(0);
  await waitFor(`${p1}.sprite.body.blocked.down`);
  await execute(`${s}.input.keyboard.emit('keydown', { key: 'd' });`);
  await waitFor(`${s}.player.body.velocity.x >= 209`);
  await execute(`${s}.input.keyboard.emit('keyup', { key: 'd' });
    ${s}.input.keyboard.emit('keydown', { key: 'w' });`);
  await waitFor(`${s}.player.body.velocity.y < -300`);
  await execute(`${s}.input.keyboard.emit('keyup', { key: 'w' });`);

  await execute(`${s}.input.keyboard.emit('keydown', { key: 'Escape' });`);
  await waitFor('window.__game.scene.isActive("PlatformerPause")');
  const frozen = await execute(`const s = ${s}; return [s.elapsed, s.player.x, s.player.y];`);
  // Wait on the overlay's live clock: the underlying scene must stay frozen.
  await execute(`window.__pauseCheckTime = window.__game.scene.getScene('PlatformerPause').time.now;`);
  await waitFor("window.__game.scene.getScene('PlatformerPause').time.now > window.__pauseCheckTime + 300");
  assert.deepEqual(await execute(`const s = ${s}; return [s.elapsed, s.player.x, s.player.y];`), frozen);
  assert.equal(await evaluate(`${p1}.input.keyJump || ${p1}.input.keyRight || ${p1}.input.pendingJump`), false);
  await execute(`window.__game.scene.getScene('PlatformerPause').input.keyboard.emit('keydown-ESC', { repeat: false });`);
  await waitFor('window.__game.scene.isActive("PlatformerRun") && !window.__game.scene.isActive("PlatformerPause")');

  // Rival stomps stun without consuming lives; synchronize manually placed bodies.
  assert.deepEqual(await execute(`const s = ${s}; s.physics.pause();
    const lives = s.lives;
    s.rival.setPosition(200, 600); s.rival.body.updateFromGameObject();
    s.player.setPosition(200, s.rival.body.top); s.player.body.updateFromGameObject();
    s.player.setVelocityY(100); s.rival.setVelocityY(0);
    s.resolvePlayerRivalContact();
    return [s.lives === lives, s.rivalStunTimer > 0, s.player.body.velocity.y < 0];`), [true, true, true]);

  // Restarting the same scene must not stack listeners or retain old state.
  for (let i = 0; i < 3; i++) await enter(0);
  assert.deepEqual(await execute(`const s = ${s};
    return [s.input.keyboard.listenerCount('keydown'), s.input.keyboard.listenerCount('keyup'), s.coins, s.bestStompCombo, s.heroes.length];`), [1, 1, 0, 0, 1]);
  assert.equal(await evaluate(`${s}.input.manager.pointersTotal`), 5);
  await execute(`${s}.pauseRun();`);
  await waitFor('window.__game.scene.isActive("PlatformerPause")');
  await execute(`window.__game.scene.getScene('PlatformerPause').children.list.find(o => o.type === 'Rectangle' && o.y === 425).emit('pointerdown');`);
  await waitFor(`window.__game.scene.isActive('PlatformerRun') && ${s}.ready && !window.__game.scene.isActive('PlatformerPause')`);
  assert.equal(await evaluate(`${s}.elapsed < 1`), true);
  await execute(`${s}.pauseRun();`);
  await waitFor('window.__game.scene.isActive("PlatformerPause")');
  await execute(`window.__game.scene.getScene('PlatformerPause').children.list.find(o => o.type === 'Rectangle' && o.y === 500).emit('pointerdown');`);
  await waitFor('window.__game.scene.isActive("ModeSelect")');
  assert.equal(await evaluate("window.__game.scene.isPaused('PlatformerRun') || window.__game.scene.isActive('PlatformerRun')"), false);

  // Level select gates on the previous solo clear.
  await start('PlatformerLevelSelect');
  await waitFor(textExists('PlatformerLevelSelect', 'Tech Park Tangle'));
  assert.equal(await evaluate(textExists('PlatformerLevelSelect', 'reward: 🚩 Flagpole Pog')), true);
  assert.equal(await evaluate(textExists('PlatformerLevelSelect', '🔒')), true);

  await enter(1);
  assert.deepEqual(await execute(`const s = ${s};
    return [s.physics.world.bounds.width, s.cameras.main.getBounds().width];`), [3500, 3500]);
  // Reach the actual goal through Arcade overlap, rather than calling endLevel.
  await execute(`const s = ${s}; s.player.setPosition(s.level.goalX, s.level.goalY);
    s.player.body.updateFromGameObject();`);
  await waitFor('window.__game.scene.isActive("PlatformerResult")');
  assert.equal(await evaluate(textExists('PlatformerResult', 'NEXT: TECH PARK TANGLE')), true);
  assert.equal(await evaluate("window.__game.registry.get('lastPlatformerResult').raceOutcome"), 'playerWon');
  // First clear pays out once: a Tech Point and the level's pog.
  await waitFor(textExists('PlatformerResult', 'FIRST CLEAR'));
  assert.equal(await evaluate(textExists('PlatformerResult', 'Sprint Spike')), true);
  assert.deepEqual(await execute(`const { getProfile } = await import('/src/game/db/repository.ts');
    const { getCollection } = await import('/src/game/db/pogRepository.ts');
    const { isLevelUnlocked, recordQuestRun } = await import('/src/game/db/questRepository.ts');
    const { getLoadout, techPointsAvailable } = await import('/src/game/db/loadoutRepository.ts');
    const tpBefore = techPointsAvailable(await getLoadout());
    const again = await recordQuestRun({ ...window.__game.registry.get('lastPlatformerResult'), elapsedSeconds: 20 });
    const profile = await getProfile();
    const owned = (await getCollection()).filter(p => p.defId === 'sprinter').length;
    return [profile.quest.level2.clears, again.firstClear, again.techPointsGranted, techPointsAvailable(await getLoadout()) - tpBefore,
      owned, again.trainingEarned, isLevelUnlocked(profile, 2), isLevelUnlocked(profile, 3), isLevelUnlocked(profile, 7)];`),
    [2, false, 0, 0, 1, true, true, false, true]);

  await enter(2);
  const tp = `${s}.enemies.find(e => e.def.id === 'turret')`;
  const spiker = `${s}.enemies.find(e => e.def.id === 'spiker')`;
  // Every ground enemy must actually rest on the ground (an immovable body would fall through static tiles).
  await waitFor(`${s}.enemies.filter(e => e.def.movement !== 'fly').every(e => e.sprite.body.blocked.down && e.sprite.y <= ${s}.level.groundY + 1)`);
  assert.deepEqual(await execute(`const s = ${s}; s.physics.pause(); s.shields = 0;
    const hopper = s.enemies.find(e => e.def.id === 'hopper'); hopper.timer = 0; s.updatePatrolEnemies(16);
    const hopped = hopper.sprite.body.velocity.y < 0;
    // Stomping a spiker hurts and leaves it alive.
    const hero = s.heroes[0]; const sp = ${spiker}; const lives = s.lives;
    hero.sprite.setPosition(sp.sprite.x, sp.sprite.body.top); hero.sprite.body.updateFromGameObject(); hero.sprite.setVelocityY(200);
    s.resolveEnemyContact(hero, sp);
    const stompHurt = [s.lives === lives - 1, sp.alive, hero.sprite.body.velocity.y < 0];
    // A ground pound shockwave takes it out.
    hero.invulnTimer = 0; hero.sprite.setPosition(sp.sprite.x + 60, sp.sprite.y); s.poundShockwave(hero);
    return [hopped, ...stompHurt, sp.alive, hero.pounding];`), [true, true, true, true, false, false]);
  assert.deepEqual(await execute(`const s = ${s}; const t = ${tp}; const hero = s.heroes[0];
    hero.sprite.setPosition(t.sprite.x - 200, t.sprite.y); hero.sprite.body.updateFromGameObject();
    t.timer = 0; s.updateTurret(t, 16);
    const fired = s.pellets.length === 1 && s.pellets[0].body.velocity.x < 0 && t.sprite.flipX;
    const pellet = s.pellets[0]; const lives = s.lives; hero.invulnTimer = 0;
    s.hitHeroWithPellet(hero, pellet); s.hitHeroWithPellet(hero, pellet);
    return [fired, s.lives === lives - 1, pellet.active];`), [true, true, false]);

  // Items: freeze, swap, auto-swap on empty, double jump, magnet.
  assert.deepEqual(await execute(`const s = ${s}; const hero = s.heroes[0]; const t = ${tp};
    const { pogDef } = await import('/src/game/data/pogs.ts');
    const slot = id => { const def = pogDef(id); return { def, effect: def.activeEffect, charges: def.activeEffect.charges }; };
    hero.items = [slot('chalk'), slot('propeller'), slot('punchcard')]; hero.selectedItem = 0;
    hero.sprite.setPosition(t.sprite.x - 200, t.sprite.y); t.timer = 0; s.updateTurret(t, 16);
    s.useItem(hero);
    const frozen = [s.freezeTimer > 0, s.pellets.every(p => !p.active), hero.selectedItem === 1];
    t.timer = 0; s.updatePatrolEnemies(16); const noFire = s.pellets.filter(p => p.active).length === 0;
    s.swapItem(hero); const swapped = hero.selectedItem === 2;
    s.swapItem(hero); const skipsEmpty = hero.selectedItem === 1;
    s.useItem(hero); const jumpWindow = hero.airJumpTimer > 0;
    hero.sprite.setPosition(1600, 400); hero.sprite.body.updateFromGameObject(); hero.sprite.setVelocity(0, 50);
    hero.sprite.body.blocked.down = false; hero.sprite.body.touching.down = false; hero.ctrl.coyoteMs = 0;
    hero.input.keyJump = true; hero.input.pendingJump = true; s.updateHero(hero, 16);
    const airJump = hero.sprite.body.velocity.y < -500 && hero.airJumpsUsed === 1;
    hero.sprite.setVelocityY(50); hero.input.pendingJump = true; s.updateHero(hero, 16);
    const onlyOnce = hero.sprite.body.velocity.y > 0; hero.input.keyJump = false;
    hero.selectedItem = 2; s.useItem(hero);
    const coin = s.coinSprites[0]; hero.sprite.setPosition(coin.x + 80, coin.y + 36); s.updateMagnets();
    return [...frozen, noFire, swapped, skipsEmpty, jumpWindow, airJump, onlyOnce, hero.magnetTimer > 0, coin.body.velocity.x > 0];`),
    [true, true, true, true, true, true, true, true, true, true, true]);
  await execute(`${s}.physics.resume();`);
  await waitFor(`${s}.freezeTimer === 0`);
  assert.equal(await evaluate(`${tp}.sprite.isTinted`), false);

  await enter(3);
  assert.deepEqual(await execute(`const s = ${s}; s.physics.pause();
    const boss = s.enemies.find(e => e.def.id === 'boss');
    s.updateBoss(boss, 2201); const telegraph = boss.bossPhase;
    s.updateBoss(boss, 501); const charge = boss.bossPhase;
    s.damageEnemy(boss); s.damageEnemy(boss);
    return [!s.rival, !s.goalSprite, telegraph, charge, boss.health, boss.alive, s.gameOver];`), [true, true, 'telegraph', 'charge', 1, true, false]);
  await execute(`const s = ${s}; s.damageEnemy(s.enemies.find(e => e.def.id === 'boss'));`);
  await waitFor('window.__game.scene.isActive("PlatformerResult")');
  assert.equal(await evaluate(textExists('PlatformerResult', 'BOSS DOWN')), true);
  assert.equal(await evaluate(textExists('PlatformerResult', 'NEXT: ROOFTOP RELAY')), true);

  // Spring pads launch you (running onto one counts), and the launch ignores jump-cut.
  await enter(4);
  await execute(`const s = ${s}; const hero = s.heroes[0]; hero.sprite.body.reset(1180, 700); hero.input.keyRight = true;`);
  const toLaunch = await simulate(2, `return ${s}.heroes[0].sprite.body.velocity.y < -1000;`);
  assert.ok(toLaunch < 1, `spring launch took ${toLaunch}s`);
  assert.equal(await evaluate(`${p1}.ctrl.jumpCutApplied`), true);
  await execute(`${p1}.input.keyRight = false;`);

  // Summit Slammer: telegraph -> leap at you -> slam with two shockwaves -> dizzy stomp window.
  await enter(6);
  const sl = `${s}.enemies.find(e => e.def.id === 'slammer')`;
  await waitFor(`${sl}.sprite.body.blocked.down`);
  assert.deepEqual(await execute(`const s = ${s}; s.physics.pause(); s.shields = 0;
    const e = ${sl}; const hero = s.heroes[0];
    hero.sprite.setPosition(1600, 700); hero.sprite.body.updateFromGameObject();
    e.timer = 0; s.updateSlammer(e, 16); const telegraph = e.bossPhase;
    e.timer = 0; s.updateSlammer(e, 16);
    const leap = [e.bossPhase, e.sprite.body.velocity.x > 0, e.sprite.body.velocity.y < -900];
    e.sprite.body.blocked.down = true; e.timer = 400; s.updateSlammer(e, 16);
    const waves = s.pellets.filter(p => p.active && p.texture.key === 'shockwave');
    const slam = [e.bossPhase, waves.length, waves.some(w => w.body.velocity.x < 0) && waves.some(w => w.body.velocity.x > 0)];
    // dizzy: touching it from the side is harmless, but its shockwave still hurts
    const lives = s.lives; hero.invulnTimer = 0;
    hero.sprite.setPosition(e.sprite.x + 40, e.sprite.y); hero.sprite.body.updateFromGameObject(); hero.sprite.setVelocity(0, 0);
    s.resolveEnemyContact(hero, e); const harmless = s.lives === lives;
    s.hitHeroWithPellet(hero, waves[0]); const waveHurts = s.lives === lives - 1;
    // one stomp per window: the hit sends it into 'recover', where it can't be hurt again
    hero.invulnTimer = 0; hero.sprite.setPosition(e.sprite.x, e.sprite.body.top); hero.sprite.body.updateFromGameObject(); hero.sprite.setVelocityY(200);
    s.resolveEnemyContact(hero, e); const afterStomp = [e.health, e.bossPhase];
    s.damageEnemy(e); const oncePerWindow = e.health === 3;
    e.sprite.body.blocked.down = true; e.timer = 400; s.updateSlammer(e, 16); const back = e.bossPhase;
    // enraged at half health: shorter patrol, flagged in the HUD
    const calm = s.slammerPatrolMs(e); e.health = 2; s.updateHud();
    const enraged = [s.slammerPatrolMs(e) < calm, s.rivalPositionText.text.includes('ENRAGED')];
    // hit at the arena's right end with you to its left: it hops inward, never out of the arena
    e.bossPhase = 'stunned'; e.sprite.setX(e.originX + e.rangeX - 20); hero.sprite.setX(e.sprite.x - 100);
    s.damageEnemy(e, 1, hero); const inward = e.sprite.body.velocity.x < 0;
    return [telegraph, ...leap, ...slam, harmless, waveHurts, ...afterStomp, oncePerWindow, back, ...enraged, inward];`),
    ['telegraph', 'leap', true, true, 'stunned', 2, true, true, true, 3, 'recover', true, 'patrol', true, true, true]);
  // Freeze clears shockwaves along with pellets.
  assert.equal(await execute(`const s = ${s}; const e = ${sl}; e.bossPhase = 'stunned'; s.slam(e);
    s.startFreeze(1000); return s.pellets.length;`), 0);
  await execute(`const s = ${s}; const e = ${sl}; e.bossPhase = 'stunned'; s.damageEnemy(e);`);
  await waitFor('window.__game.scene.isActive("PlatformerResult")');
  assert.equal(await evaluate(textExists('PlatformerResult', 'BOSS DOWN')), true);
  assert.equal(await evaluate(textExists('PlatformerResult', 'NEXT')), false); // only co-op levels remain: never routes a solo player there

  await enter(7);
  assert.deepEqual(await execute(`const s = ${s}; s.physics.pause(); s.shields = 0;
    const [a, b] = s.heroes;
    s.input.keyboard.emit('keydown', { key: 'ArrowRight' });
    s.input.keyboard.emit('keydown', { key: '/' });
    const independentControls = b.input.keyRight && !a.input.keyRight && b.input.pendingItem && !a.input.pendingItem;
    s.input.keyboard.emit('keyup', { key: 'ArrowRight' });
    b.input.pendingItem = false;
    // Split touch: the right half of the screen drives P2.
    s.children.list.find(o => o.type === 'Rectangle' && o.x === 280 && o.y === ${854 - 58}).emit('pointerdown');
    const touchSplit = b.input.touchLeft && !a.input.touchLeft;
    const lives = s.lives; s.takeDamage(b, 1);
    // P2 has their own item charges and speed boost.
    const { pogDef } = await import('/src/game/data/pogs.ts');
    const coil = pogDef('coil');
    a.items = [{ def: coil, effect: coil.activeEffect, charges: 1 }];
    b.items = [{ def: coil, effect: coil.activeEffect, charges: 1 }];
    s.useItem(b);
    return [independentControls, touchSplit, s.lives === lives - 1, b.invulnTimer > 0, a.invulnTimer === 0,
      b.speedBoostTimer > 0, a.speedBoostTimer === 0, a.items[0].charges, b.items[0].charges];`),
    [true, true, true, true, true, true, true, 1, 0]);
  // The camera leash keeps both players on screen.
  assert.equal(await execute(`const s = ${s}; const [a, b] = s.heroes; const cam = s.cameras.main;
    a.sprite.setX(cam.scrollX + 100); b.sprite.setX(cam.scrollX + 2000); s.updateCoopCamera();
    return b.sprite.x <= cam.scrollX + 480 - 24 && s.cameraTarget.x < b.sprite.x;`), true);
  assert.deepEqual(await execute(`const s = ${s}; const [a, b] = s.heroes; const before = s.coins;
    const coin = s.coinSprites[0]; s.collectCoin(coin); s.collectCoin(coin);
    // A fallen player respawns beside their partner, not back at their own last ledge.
    s.lives = 5; a.lastCheckpoint = { x: 900, y: 700 }; b.sprite.setY(1000);
    a.sprite.body.blocked.down = false; a.sprite.body.touching.down = false;
    b.sprite.body.blocked.down = false; b.sprite.body.touching.down = false; s.checkCheckpointsAndGaps();
    return [s.coins - before, s.coinSprites.includes(coin), b.sprite.x, s.lives];`), [1, false, 900, 4]);
  await execute(`const s = ${s}; s.lives = 1; s.p2.setY(1000);
    s.p2.body.blocked.down = false; s.p2.body.touching.down = false;
    s.checkCheckpointsAndGaps();`);
  await waitFor('window.__game.scene.isActive("PlatformerResult")');
  assert.equal(await evaluate("window.__game.registry.get('lastPlatformerResult').raceOutcome"), 'fell');
  await waitFor(textExists('PlatformerResult', 'training credit'));
  assert.equal(await execute(`const { getProfile } = await import('/src/game/db/repository.ts');
    const p = await getProfile(); return p.quest.level4.attempts === 1 && p.quest.level4.clears === 0;`), true);
  console.log('PASS: Pog Quest rival finishes all 5 races at 60fps, springs, Summit Slammer phases/shockwaves/stun window/enrage/arena clamp, pit respawn, movement/jump, pause/resume/retry/menu, rival stomp, scene restarts, level select gating, gap reach, first-clear rewards, hopper/spiker/turret, freeze/swap/double jump/magnet/ground pound, boss phases/victory, solo progression, co-op controls/touch split/items/camera leash/respawn/lives, coin collection, gap defeat.');
}

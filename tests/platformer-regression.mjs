import assert from 'node:assert/strict';

// Uses the runner's isolated browser context, never the player's save.
export async function verifyPlatformer({ execute, evaluate, waitFor, start, scene, textExists }) {
  const s = scene('PlatformerRun');
  const enter = async index => {
    await execute(`window.__game.registry.set('platformerLevelIndex', ${index});`);
    await start('PlatformerRun');
    await waitFor(`${s}.ready && ${s}.levelIndex === ${index}`);
  };

  await enter(0);
  await waitFor(`${s}.player.body.blocked.down`);
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
  assert.equal(await evaluate(`${s}.keyJumpHeld || ${s}.keyRightDown || ${s}.pendingJumpPress`), false);
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
    return [s.input.keyboard.listenerCount('keydown'), s.input.keyboard.listenerCount('keyup'), s.coins, s.bestStompCombo];`), [1, 1, 0, 0]);
  assert.equal(await evaluate(`${s}.input.manager.pointersTotal`), 3);
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

  await enter(1);
  assert.deepEqual(await execute(`const s = ${s};
    return [s.physics.world.bounds.width, s.cameras.main.getBounds().width];`), [3500, 3500]);
  // Reach the actual goal through Arcade overlap, rather than calling endLevel.
  await execute(`const s = ${s}; s.player.setPosition(s.level.goalX, s.level.goalY);
    s.player.body.updateFromGameObject();`);
  await waitFor('window.__game.scene.isActive("PlatformerResult")');
  assert.equal(await evaluate(textExists('PlatformerResult', 'NEXT LEVEL')), true);
  assert.equal(await evaluate("window.__game.registry.get('lastPlatformerResult').raceOutcome"), 'playerWon');

  await enter(2);
  assert.deepEqual(await execute(`const s = ${s}; s.physics.pause();
    const boss = s.enemies.find(e => e.def.id === 'boss');
    s.updateBoss(boss, 2201); const telegraph = boss.bossPhase;
    s.updateBoss(boss, 501); const charge = boss.bossPhase;
    s.damageEnemy(boss); s.damageEnemy(boss);
    return [!s.rival, !s.goalSprite, telegraph, charge, boss.health, boss.alive, s.gameOver];`), [true, true, 'telegraph', 'charge', 1, true, false]);
  await execute(`const s = ${s}; s.damageEnemy(s.enemies.find(e => e.def.id === 'boss'));`);
  await waitFor('window.__game.scene.isActive("PlatformerResult")');
  assert.equal(await evaluate(textExists('PlatformerResult', 'NEXT LEVEL')), false);

  await enter(3);
  assert.deepEqual(await execute(`const s = ${s}; s.physics.pause(); s.shields = 0;
    s.input.keyboard.emit('keydown', { key: 'ArrowRight' });
    const independentControls = s.p2RightDown && !s.keyRightDown;
    s.input.keyboard.emit('keyup', { key: 'ArrowRight' });
    const lives = s.lives; s.takeDamage(1, true);
    return [independentControls, s.lives === lives - 1, s.p2InvulnTimer > 0, s.invulnTimer === 0];`), [true, true, true, true]);
  assert.deepEqual(await execute(`const s = ${s}; const before = s.coins;
    const coin = s.coinSprites[0]; s.collectCoin(coin); s.collectCoin(coin);
    return [s.coins - before, s.coinSprites.includes(coin)];`), [1, false]);
  await execute(`const s = ${s}; s.lives = 1; s.p2.setY(1000);
    s.p2.body.blocked.down = false; s.p2.body.touching.down = false;
    s.checkCheckpointsAndGaps();`);
  await waitFor('window.__game.scene.isActive("PlatformerResult")');
  assert.equal(await evaluate("window.__game.registry.get('lastPlatformerResult').raceOutcome"), 'fell');
  console.log('PASS: Pog Quest movement/jump, pause/resume/retry/menu, rival stomp, scene restarts, level bounds, goal overlap, boss phases/victory, solo progression, co-op controls/lives, coin collection, gap defeat.');
}

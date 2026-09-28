import assert from 'node:assert/strict';

// The Forever Realm as the whole game: title, hero stats and XP risk, pog gear, duelists,
// yoyo tricks, pogo stick and Dash Trials, the Circuit Arena and Quest Rifts.
// Runs in the runner's isolated browser context, never the player's save.
export async function verifyUnified({ execute, evaluate, waitFor, scene, key }) {
  const r = scene('Realm');
  const title = scene('Title');
  const step = async seconds => {
    for (let left = seconds; left > 0; left -= 2) {
      await execute(`const g = window.__game; g.loop.sleep(); let t = window.__unifiedClock ?? performance.now();
        try { for (let i = 0; i < ${Math.min(2, left)} * 60; i++) { t += 1000 / 60; g.headlessStep(t, 1000 / 60); } }
        finally { window.__unifiedClock = t; g.loop.wake(); }`);
    }
  };
  const settle = () => new Promise(resolve => setTimeout(resolve, 400));
  // stopping and starting an active scene in one frame is ignored: restart it instead
  const open = async (name, data = {}) => {
    await execute(`for (const s of window.__game.scene.getScenes(true)) s.scene.stop();`);
    await waitFor(`window.__game.scene.getScenes(true).length === 0`);
    await execute(`window.__game.scene.start('${name}', ${JSON.stringify(data)});`);
  };
  const newWorld = async characterIndex => {
    await open('Title', { view: 'picker' });
    await waitFor(`${title}.children.list.filter(o => o.type === 'Rectangle' && o.input?.enabled).length === 8`);
    await execute(`${title}.children.list.filter(o => o.type === 'Rectangle' && o.input?.enabled)[${characterIndex}].emit('pointerdown');`);
    await waitFor(`${r}?.ready && !${r}.pocket`);
    await step(0.5);
  };

  // ---- pure rules: hero stats, XP curve, pogs in realm terms ----
  assert.deepEqual(await execute(`const h = await import('/src/game/realm/hero.ts');
    const { EMPTY_PERKS, aggregatePerks, pogDef } = await import('/src/game/data/pogs.ts');
    const none = { ...EMPTY_PERKS };
    const khan1 = h.computeHeroStats('khan', 1, none), khan20 = h.computeHeroStats('khan', 20, none);
    const perks = aggregatePerks([pogDef('bicep'), pogDef('lantern'), pogDef('coil')]);
    const geared = h.computeHeroStats('cleo', 1, perks);
    let total = 0; for (let l = 1; l < 20; l++) total += h.xpToNext(l);
    return [khan1.maxHpBonus, khan1.guardPips, khan20.maxHpBonus, +khan20.damageMult.toFixed(3), h.masteryTierForLevel(20),
      geared.guardPips, geared.revives, +geared.lootLuck.toFixed(2), +geared.moveMult.toFixed(2), +geared.comboCap.toFixed(2),
      h.levelForXp(0).level, h.levelForXp(total).level, h.levelForXp(total * 10).level, total];`),
    [20, 1, 97, 1.285, 4, 1, 1, 0.08, 1.15, 0.55, 1, 20, 20, 10074]);

  // ---- title → hero picker → a fresh world as that hero ----
  await open('Title');
  await waitFor(`${title}.children.list.some(o => o.type === 'Text' && o.text === 'NEW WORLD')`);
  await newWorld(1); // Genghis K.
  // no ambient creatures wandering in between real frames (removed again at the end of the suite)
  await execute(`${r}.trySpawn = () => {};`);
  assert.deepEqual(await evaluate(`[${r}.hero.character.id, ${r}.player.texture.key, ${r}.maxHp, ${r}.hero.stats.guardPips, ${r}.slots.length]`),
    ['khan', 'realm_hero_khan', 120, 1, 10]);

  // ---- combat: style combo, crit-free damage, kill XP, guard, revive, death penalty, banking ----
  assert.deepEqual(await execute(`const s = ${r}; const { REALM_ENEMIES } = await import('/src/game/realm/realmEnemies.ts');
    s.hero.stats.critChance = 0;
    const e = s.spawnEnemy(REALM_ENEMIES.knight, s.player.x + 20 * s.facing, s.player.y); e.hp = 500;
    s.swingTimer = 0; s.swing(); const first = 500 - e.hp;
    s.swingTimer = 0; s.swing(); s.swingTimer = 0; s.swing(); const third = 500 - e.hp - first * 2;
    e.hp = 1; s.swingTimer = 0; s.swing();
    return [first, s.hero.combo, third > 0, s.hero.unbanked > 0, s.enemies.includes(e)];`), [10, 4, true, true, false]);
  assert.deepEqual(await execute(`const s = ${r}; s.hero.guard = 1; s.invuln = 0; const hp = s.hp;
    s.hurtPlayer(30, s.player.x + 10); const guarded = s.hp === hp && s.hero.guard === 0;
    s.hero.revivesLeft = 1; s.hero.unbanked = 90; s.invuln = 0; s.hp = 5; s.hurtPlayer(30, s.player.x);
    const revived = !s.dead && s.hp === 60 && s.hero.revivesLeft === 0;
    s.invuln = 0; s.hp = 5; s.hurtPlayer(30, s.player.x);
    return [guarded, revived, s.dead, s.hero.unbanked, s.deathText.text.includes('45 unbanked XP lost')];`), [true, true, true, 45, true]);
  await step(4);
  assert.deepEqual(await execute(`const s = ${r}; s.hero.unbanked = 400; await s.hero.bank();
    const { getProfile } = await import('/src/game/db/repository.ts'); const p = await getProfile();
    return [s.dead, s.hero.level, s.maxHp, s.hero.unbanked, p.characters.khan.xp];`), [false, 5, 137, 0, 400]); // mastery tier 1 at level 5: Khan's +20 HP perk ×1.25

  // ---- pogs: equip through the real hero menu, capacity, hotbar actives, freeze, slammer, refill ----
  await execute(`const { grantPog } = await import('/src/game/db/pogRepository.ts');
    for (const id of ['chalk', 'foil', 'dragon', 'katana']) await grantPog(id, 'test');
    const { loadHeroSnapshot } = await import('/src/game/realm/progression.ts'); ${r}.hero.refresh(await loadHeroSnapshot());`);
  await key(73, 'i');
  await waitFor(`${r}.heroMenu.open`);
  await key(39, 'ArrowRight');
  await waitFor(`${r}.heroMenu.panel.rows.length >= 5`);
  const equip = name => execute(`const m = ${r}.heroMenu; const i = m.panel.rows.findIndex(row => row.label.includes(${JSON.stringify(name)}));
    m.panel.index = i; m.panel.rows[i].action(); for (let n = 0; n < 40 && m.busy; n++) await new Promise(res => setTimeout(res, 25)); return m.feedback;`);
  assert.equal(await equip('Chalk Disc'), '');
  // starter 1 + chalk 1 + a legendary 4 = 6 > the base footpeg's 4
  assert.equal(await equip('Dragon Slammer'), "Can't equip: footpeg full (4 slots)");
  assert.deepEqual(await evaluate(`${r}.hero.snap.pogs.filter(p => p.instance.equipped).map(p => p.def.id).sort()`), ['cafeteria', 'chalk']);
  await key(27, 'Escape');
  await waitFor(`!${r}.heroMenu.open && !${r}.physics.world.isPaused`);
  assert.deepEqual(await execute(`const s = ${r}; const { REALM_ENEMIES } = await import('/src/game/realm/realmEnemies.ts');
    const slot = s.slots.find(x => x.startsWith('pog:')); s.slot = s.slots.indexOf(slot);
    const e = s.spawnEnemy(REALM_ENEMIES.wraith, s.player.x + 150, s.player.y - 40);
    s.useTool(false, true, 16); const left = s.hero.chargesLeft(slot.slice(4));
    return [s.slots.length, s.hero.frozen, left, slot.startsWith('pog:')];`), [11, true, 0, true]);
  await step(0.5);
  assert.equal(await evaluate(`${r}.enemies.every(e => e.sprite.body.moves === false)`), true);
  await step(2.5);
  assert.equal(await evaluate(`${r}.hero.frozen || ${r}.enemies.some(e => e.sprite.body.moves === false)`), false);

  // ---- Tech Points are one-time milestones; they buy footpeg room ----
  assert.deepEqual(await execute(`const { grantMilestone, tpAvailable, buyFootpegTier } = await import('/src/game/realm/progression.ts');
    const a = await grantMilestone('test:one', 2), b = await grantMilestone('test:one', 2);
    const before = await tpAvailable(); const res = await buyFootpegTier(); const after = await tpAvailable();
    const { loadHeroSnapshot } = await import('/src/game/realm/progression.ts'); const snap = await loadHeroSnapshot();
    return [a, b, before, res.ok, after, snap.capacity];`), [true, false, 2, true, 0, 5]);

  // ---- duelists: Schoolyard, stakes, the ranked lock, losing a staked pog ----
  assert.deepEqual(await execute(`const d = await import('/src/game/realm/duels.ts');
    const easy = d.slamTuning(45, { level: 1, critChance: 0.05, trickWindowMult: 1, footpegWeight: 0 });
    const hard = d.slamTuning(97, { level: 1, critChance: 0.05, trickWindowMult: 1, footpegWeight: 0 });
    return [+easy.sweep.toFixed(2), +hard.sweep.toFixed(2), Math.round(easy.sweet), Math.round(hard.sweet),
      d.slamPower(0.5, easy).power, d.slamPower(0, easy).power, d.opponentPower(97, 0.5), d.opponentPower(45, 0)];`),
    [1.2, 2.4, 27, 15, 101, 1, 93, 53]);
  const bout = async (markerT) => {
    for (let i = 0; i < 6 && await evaluate(`!!${r}.duel.bout && !${r}.duel.bout.done`); i++) {
      await execute(`const d = ${r}.duel; d.bout.sweeping = true; d.bout.markerT = ${markerT}; d.slam(); d.bout.wait = 1;`);
      await step(0.1);
    }
    await waitFor(`!!${r}.duel.bout?.result`);
    const result = await evaluate(`${r}.duel.bout.result`);
    await execute(`${r}.duel.tapQueued = true;`); await step(0.1);
    return result;
  };
  const faceDuelist = async id => {
    await execute(`const s = ${r}; const sp = s.duel.spots.${id}; s.player.body.reset((sp.tx + 0.5) * 16, (sp.ty + 1) * 16);`);
    await waitFor(`${r}.duel.nearby()?.id === '${id}'`);
  };
  await execute(`${r}.inventory.copper = 30;`);
  await faceDuelist('cleo'); await step(0.3);
  assert.equal(await evaluate(`${r}.promptText.text.includes('duel 👑 Cleo P.')`), true);
  await execute(`${r}.duel.interact();`);
  await execute(`${r}.duel.panel.rows[1].action();`);
  assert.equal(await evaluate(`${r}.inventory.copper`), 24);
  assert.match(await bout(0.5), /YOU WIN 2–0[\s\S]*Tin Crown is yours/);
  assert.equal(await evaluate(`${r}.inventory.copper`), 44);
  await execute(`${r}.duel.interact();`);
  assert.equal(await evaluate(`${r}.duel.panel.rows[1].enabled === false && ${r}.duel.panel.rows[1].label.includes('already paid out today')`), true);
  await execute(`${r}.duel.panel.rows[0].action();`);
  assert.match(await bout(0), /CLEO P\. WINS/);
  for (const id of ['joan', 'einstein', 'ada']) {
    await faceDuelist(id); await step(0.2);
    await execute(`${r}.duel.interact(); ${r}.duel.panel.rows[0].action();`);
    assert.match(await bout(0.5), /YOU WIN/);
  }
  await faceDuelist('napoleon'); await step(0.2);
  await execute(`${r}.duel.interact();`);
  assert.match(await evaluate(`${r}.duel.stakeView().title + ' wins ' + ${r}.duel.schoolyardWins() + ' open ' + ${r}.duel.panel.open + ' ' + ${r}.duel.panel.rows.map(row => row.label).join('|')`), /NAPOLEON[\s\S]*Stake/);
  await execute(`const rows = ${r}.duel.panel.rows; rows.find(row => row.label.includes('Stake') && row.label.includes('Katana')).action();`);
  assert.match(await bout(0), /NAPOLEON B\. WINS[\s\S]*Katana Pog is gone for good/);
  assert.equal(await evaluate(`${r}.hero.snap.pogs.some(p => p.def.id === 'katana')`), false);

  // ---- yoyo: craft, trick matching, a landed trick, a fumble tangle, right-stick flicks ----
  assert.deepEqual(await execute(`const y = await import('/src/game/realm/yoyo.ts');
    const known = y.tricksFor(3);
    return [y.tricksFor(1).length, known.length, y.matchTrick(['down'], known).status, y.matchTrick(['left', 'left'], known).status,
      y.matchTrick(['down', 'right', 'up'], known).final, y.matchTrick(['down', 'tap'], known).final, y.trickWindow(0, 1), +y.trickWindow(20, 1.3).toFixed(3)];`),
    [4, 16, 'partial', 'fumble', true, false, 1.1, 0.715]);
  assert.deepEqual(await execute(`const s = ${r}; s.inventory.wood = 30; s.inventory.gel = 20; s.inventory.copper = 30;
    const { RECIPES } = await import('/src/game/realm/items.ts');
    for (const id of ['yoyo1', 'yoyo2', 'pogo']) s.craft(RECIPES.find(x => x.id === id));
    return [s.yoyoTier, s.hasPogo, s.slots.includes('yoyo'), s.slots.includes('pogo'), s.canCraft(RECIPES.find(x => x.id === 'yoyo1'))];`),
    [2, true, true, true, false]);
  assert.deepEqual(await execute(`const s = ${r}; const { REALM_ENEMIES } = await import('/src/game/realm/realmEnemies.ts');
    for (const e of [...s.enemies]) s.despawn(e);
    // on the flattened spawn plaza, so no hill can stop the roll
    s.player.body.reset(s.spawnPoint.x, s.spawnPoint.y);
    s.slot = s.slots.indexOf('yoyo'); s.facing = 1; s.aim = null; s.hero.stats.critChance = 0; s.hero.combo = 0;
    const e = s.spawnEnemy(REALM_ENEMIES.knight, s.player.x + 110, s.player.y); e.hp = 900;
    s.useTool(false, true, 16); s.yoyo.input('down'); s.yoyo.input('right'); s.yoyo.input('up');
    return [s.yoyo.chain, s.hero.combo, s.yoyo.window];`), [1, 3, 0]);
  await step(1);
  assert.equal(await evaluate(`${r}.enemies.find(e => e.def.id === 'knight').hp < 900`), true);
  await execute(`const s = ${r}; for (const e of [...s.enemies]) s.despawn(e); s.hp = s.maxHp;`); // a 900 HP knight left alone would win
  assert.deepEqual(await execute(`const s = ${r}; for (let i = 0; i < 3; i++) { s.yoyo.cooldown = 0; s.yoyo.use(); s.yoyo.input('up'); s.yoyo.input('up'); }
    const tangled = [s.yoyo.strings, s.yoyo.tangle > 0, s.yoyo.chain]; s.yoyo.cooldown = 0; s.yoyo.use();
    return [...tangled, s.yoyo.window];`), [0, true, 0, 0]);
  await step(6.2);
  assert.equal(await evaluate(`${r}.yoyo.strings`), 3);
  // right stick: a stick held when the window opens doesn't count until it recentres
  assert.deepEqual(await execute(`const s = ${r}; s.yoyo.cooldown = 0; s.stickNeutral = true;
    const pad = rx => [{ sticks: { lx: 0, ly: 0, rx, ry: 0 } }];
    s.readTrickInput(pad(1), s.keys, true); const heldBeforeThrow = s.yoyo.buffer.length;
    s.yoyo.use(); s.readTrickInput(pad(1), s.keys, true); const stillHeld = s.yoyo.buffer.length;
    s.readTrickInput(pad(0), s.keys, true); s.readTrickInput(pad(-1), s.keys, true);
    return [heldBeforeThrow, stillHeld, s.yoyo.buffer.join()];`), [0, 0, 'left']);
  await step(1.5);

  // ---- pogo stick: bounce heights, stomp, dismount in water, hits hurt more ----
  const bounceApex = async hold => {
    await execute(`const s = ${r}; s.keys.space.isDown = ${hold}; window.__apex = s.player.y;`);
    for (let i = 0; i < 24; i++) { await step(0.05); await execute(`window.__apex = Math.min(window.__apex, ${r}.player.y);`); }
    await execute(`${r}.keys.space.isDown = false;`);
    return evaluate(`Math.round(${r}.spawnPoint.y - window.__apex)`);
  };
  await execute(`const s = ${r}; s.slot = s.slots.indexOf('pogo'); s.player.body.reset(s.spawnPoint.x, s.spawnPoint.y); s.useTool(false, true, 16);`);
  await step(1);
  assert.equal(await evaluate(`${r}.riding`), true);
  const low = await bounceApex(false);
  const high = await bounceApex(true);
  assert.ok(high > low * 2 && low > 20, `pogo bounce ${low} vs held ${high}`);
  assert.deepEqual(await execute(`const s = ${r}; const { REALM_ENEMIES } = await import('/src/game/realm/realmEnemies.ts');
    for (const e of [...s.enemies]) s.despawn(e);
    const e = s.spawnEnemy(REALM_ENEMIES.crawler, s.player.x + 300, s.player.y); e.hp = 300; e.timer = 1e9;
    s.player.body.reset(e.sprite.x, e.sprite.y - 90); s.player.body.setVelocity(0, 500); window.__stompHp = s.hp; return e.hp;`), 300);
  await step(0.4);
  assert.deepEqual(await evaluate(`[${r}.enemies.find(e => e.def.id === 'crawler').hp < 300, ${r}.hp === window.__stompHp]`), [true, true]);
  assert.equal(await execute(`const s = ${r}; s.invuln = 0; s.hero.guard = 0; const hp = s.hp; s.hurtPlayer(20, s.player.x + 5); return hp - s.hp;`), 25);

  // ---- Dash Trials: a real pogo run through the Shrine Sprint, then hardcore ends on a hit ----
  await execute(`const s = ${r}; for (const e of [...s.enemies]) s.despawn(e); s.invuln = 1e9; const c = s.dashTrials.courses[0];
    s.riding = false; s.player.body.reset(c.start.x, c.start.y);`);
  await step(0.3);
  await waitFor(`${r}.promptText.text.includes('Shrine Sprint')`); // checked on foot: a rider's bounce height varies with real frames
  await execute(`${r}.riding = true;`);
  await execute(`${r}.dashTrials.interact(); ${r}.dashTrials.panel.rows[0].action(); ${r}.keys.d.isDown = true;`);
  for (let i = 0; i < 10 && await evaluate(`!!${r}.dashTrials.run`); i++) await step(0.5);
  await execute(`${r}.keys.d.isDown = false;`);
  await waitFor(`(${r}.dashTrials.records.sprint?.medal ?? 0) >= 1`);
  assert.equal(await evaluate(`${r}.dashTrials.records.sprint.best >= 700`), true);
  await execute(`const s = ${r}; s.invuln = 0; s.hero.guard = 0; s.dashTrials.interact(); s.dashTrials.panel.rows[1].action(); s.hurtPlayer(5, s.player.x);`);
  assert.equal(await evaluate(`!${r}.dashTrials.run && ${r}.bannerText.text.includes('hardcore over')`), true);
  assert.deepEqual(await execute(`const d = await import('/src/game/realm/dash.ts'); const c = ${r}.dashTrials.courses[0];
    return [d.scoreRun(c, { gates: 7, stars: 0, stompPoints: 0, seconds: 99, hardcore: true }), d.scoreRun(c, { gates: 7, stars: 2, stompPoints: 0, seconds: 99, hardcore: true }),
      d.pogoRank(0), d.pogoRank(10000)];`), [700, 820, 0, 4]);
  // water knocks you off: a three-tile column so a rider's bounce can't clear it between frames
  await execute(`const s = ${r}; s.riding = false; s.player.body.reset(s.spawnPoint.x, s.spawnPoint.y); window.__pool = [Math.floor(s.player.x / 16), Math.floor(s.player.y / 16)];
    for (let dy = 1; dy <= 3; dy++) s.setTile(window.__pool[0], window.__pool[1] - dy, 18); s.riding = true;`);
  await step(0.2);
  assert.equal(await evaluate(`${r}.riding`), false);
  await execute(`const s = ${r}; for (let dy = 1; dy <= 3; dy++) s.setTile(window.__pool[0], window.__pool[1] - dy, 0); s.invuln = 0;`);

  // ---- the Circuit Arena: gate, ladder lock, a won bout, a lost one ----
  await execute(`const s = ${r}; const g = s.arena.gate; s.player.body.reset((g.tx + 2) * 16, (g.ty + 1) * 16);`);
  await step(0.3);
  assert.equal(await evaluate(`${r}.promptText.text`), '▼ enter the Circuit Arena');
  await execute(`${r}.hero.unbanked = 0; ${r}.travel('arena');`);
  await waitFor(`${r}?.ready && ${r}.pocket === 'arena'`);
  await step(0.3);
  assert.deepEqual(await evaluate(`[${r}.promptText.text, ${r}.placeTile(20, 30, 'dirt'), ${r}.hero.chargesLeft(${r}.slots.find(x => x.startsWith('pog:')).slice(4))]`),
    ['▼ / S / tap · the Circuit ladder', false, 1]);
  await execute(`${r}.arena.interact();`);
  assert.deepEqual(await evaluate(`${r}.arena.panel.rows.slice(0, 3).map(row => row.enabled !== false)`), [true, true, false]);
  await execute(`${r}.arena.panel.rows[0].action();`);
  await step(3.2);
  for (let i = 0; i < 31 && await evaluate(`!!${r}.arena.bout`); i++) {
    await execute(`const s = ${r}; s.invuln = 5000; for (const e of [...s.enemies]) s.killEnemy(e);`);
    await step(2);
  }
  await waitFor(`${r}.arena.beaten.includes('elizabeth') && ${r}.hero.unbanked === 0`);
  assert.equal(await evaluate(`${r}.arena.bout`), undefined);
  await execute(`${r}.arena.interact(); ${r}.arena.panel.rows[2].action();`);
  await step(3.5);
  await execute(`const s = ${r}; s.invuln = 0; s.hero.guard = 0; s.hero.revivesLeft = 0; s.hp = 1; s.hurtPlayer(50, s.player.x);`);
  await waitFor(`!${r}.arena.bout && ${r}.bannerText.text.includes('WINS')`);
  assert.deepEqual(await evaluate(`[${r}.arena.beaten, ${r}.enemies.length, ${r}.darkOverride]`), [['elizabeth'], 0, null]);
  await step(4);
  await execute(`${r}.travel('home');`);
  await waitFor(`${r}?.ready && !${r}.pocket`);

  // ---- Quest Rifts: placement, the sequence, a round trip into Pog Quest and back ----
  assert.deepEqual(await execute(`const s = ${r}; const spots = s.rifts.spots; const { isSolid } = await import('/src/game/realm/tiles.ts');
    const ground = spots.every(p => [0, 1, 2].every(dx => isSolid(s.tileAt(p.tx + dx, p.ty + 1)) && s.tileAt(p.tx + dx, p.ty) === 0));
    const apart = spots.every((p, i) => spots.every((q, j) => i === j || Math.abs(p.tx - q.tx) >= 6));
    return [spots.length, ground, apart, s.rifts.state(0), s.rifts.state(1), s.rifts.state(12), s.rifts.nextRift()];`),
    [15, true, true, 'open', 'sealed', 'open', 0]);
  await execute(`const s = ${r}; const sp = s.rifts.spots[1]; s.player.body.reset((sp.tx + 1.5) * 16, (sp.ty + 1) * 16);`);
  await step(0.3);
  assert.match(await evaluate(`${r}.promptText.text`), /Rift 2 is sealed/);
  await execute(`const s = ${r}; const sp = s.rifts.spots[0]; s.player.body.reset((sp.tx + 1.5) * 16, (sp.ty + 1) * 16);`);
  await step(0.3);
  await execute(`${r}.rifts.interact(); ${r}.rifts.panel.rows[0].action();`);
  await waitFor(`window.__game.scene.getScene('PlatformerRun')?.ready && window.__game.scene.isActive('PlatformerRun')`);
  assert.deepEqual(await evaluate(`[window.__game.scene.getScene('PlatformerRun').character.id, window.__game.scene.getScene('PlatformerRun').levelIndex, window.__game.scale.width]`),
    ['khan', 0, 480]);
  await execute(`const p = window.__game.scene.getScene('PlatformerRun'); p.coins = 12; p.endLevel('playerWon');`);
  await waitFor(`window.__game.scene.isActive('PlatformerResult') && window.__game.scene.getScene('PlatformerResult').children.list.some(o => o.type === 'Text' && o.text.includes('FIRST CLEAR'))`);
  await settle();
  await execute(`window.__game.scene.getScene('PlatformerResult').children.list.filter(o => o.type === 'Rectangle' && o.input?.enabled)[0].emit('pointerdown');`);
  await waitFor(`${r}?.ready && !${r}.pocket && window.__game.scene.isActive('Realm')`);
  assert.deepEqual(await evaluate(`[window.__game.scale.width, ${r}.rifts.state(0), ${r}.rifts.state(1), ${r}.rifts.nextRift(),
    Math.abs(${r}.player.x - (${r}.rifts.spots[0].tx + 1.5) * 16) < 32, ${r}.hero.snap.pogs.some(p => p.def.id === 'flagpole'), ${r}.yoyoTier, ${r}.hasPogo]`),
    [960, 'cleared', 'open', 1, true, true, 2, true]);

  // ---- records: every activity reports into the hero menu ----
  const records = await evaluate(`${r}.records().join('\\n')`);
  for (const line of ['Pog duels', 'Pogo Rank', 'Circuit Arena · 1/11', 'Quest rifts · 1/15']) assert.ok(records.includes(line), `records: ${line}`);
  await execute(`delete ${r}.trySpawn;`);
  console.log('PASS: title and hero picker, hero stats/XP curve, combo/guard/revive/death penalty/banking, pog equip via menu with footpeg limit, freeze active, Tech Point milestones and footpeg upgrade, duel tuning/stakes/daily payout/ranked lock/lost pog, yoyo crafting/tricks/tangle/stick flicks, pogo bounce/stomp/damage/water dismount, Dash Trial run and hardcore, arena ladder win/loss, quest rift sequence and round trip, records.');
}

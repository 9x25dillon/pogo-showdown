import assert from 'node:assert/strict';

// Forever Realm + soundtrack. Runs in the runner's isolated browser context.
export async function verifyRealm({ execute, evaluate, waitFor, start, scene }) {
  const r = scene('Realm');
  // fixed 60fps, no rendering, in chunks (see platformer-regression.mjs for why)
  const step = async seconds => {
    for (let left = seconds; left > 0; left -= 2) {
      await execute(`const g = window.__game; g.loop.sleep(); let t = window.__realmClock ?? performance.now();
        try { for (let i = 0; i < ${Math.min(2, left)} * 60; i++) { t += 1000 / 60; g.headlessStep(t, 1000 / 60); } }
        finally { window.__realmClock = t; g.loop.wake(); }`);
    }
  };

  // world generation is pure and seeded
  assert.deepEqual(await execute(`const { generateWorld, WORLD_W, WORLD_H } = await import('/src/game/realm/worldGen.ts');
    const { T } = await import('/src/game/realm/tiles.ts');
    const a = generateWorld(1234), b = generateWorld(1234), c = generateWorld(99);
    const same = a.tiles.every((v, i) => v === b.tiles[i]);
    const differs = a.tiles.some((v, i) => v !== c.tiles[i]);
    const at = (w, x, y) => w.tiles[y * w.w + x];
    const bottom = [...Array(w = a.w).keys()].every(x => at(a, x, a.h - 1) === T.BEDROCK);
    const spawnClear = at(a, a.spawn.tx, a.spawn.ty) === T.AIR && at(a, a.spawn.tx, a.spawn.ty + 1) === T.GRASS;
    let soulShallow = 0, soul = 0, copper = 0;
    for (let x = 0; x < a.w; x++) for (let y = 0; y < a.h; y++) {
      const id = at(a, x, y); const depth = y - a.surface[x];
      if (id === T.SOULSTONE) { soul++; if (depth <= 70) soulShallow++; }
      if (id === T.COPPER) copper++;
    }
    return [same, differs, a.w, a.h, bottom, spawnClear, soul > 0, soulShallow, copper > 100];`),
    [true, true, 640, 200, true, true, true, 0, true]);

  await execute(`window.__game.registry.set('selectedCharacterId', 'cleo');
    for (const s of window.__game.scene.getScenes(true)) s.scene.stop(); window.__game.scene.start('Realm', { newWorld: true });`);
  await waitFor(`${r}.ready`);
  assert.deepEqual(await evaluate(`[window.__game.scale.width, window.__game.scale.height, window.__music.cue]`), [960, 540, 'explore']);
  await step(1);
  assert.equal(await evaluate(`${r}.player.body.blocked.down`), true);

  // mining takes real time scaled by the pickaxe; ore is gated by tier
  assert.deepEqual(await execute(`const s = ${r}; const { T } = await import('/src/game/realm/tiles.ts');
    const tx = Math.floor(s.player.x / 16), ty = Math.floor(s.player.y / 16);
    s.setTile(tx + 1, ty, T.DIRT); s.aim = { tx: tx + 1, ty }; s.slot = 0;
    const dirt = s.count('dirt');
    s.useTool(true, true, 120); const half = s.tileAt(tx + 1, ty);
    s.useTool(true, false, 150); const done = s.tileAt(tx + 1, ty);
    s.setTile(tx + 1, ty, T.IRON); s.aim = { tx: tx + 1, ty }; for (let i = 0; i < 50; i++) s.useTool(true, false, 50);
    const ironBlocked = s.tileAt(tx + 1, ty) === T.IRON;
    s.pickaxe = 1; for (let i = 0; i < 50; i++) s.useTool(true, false, 50);
    return [half, done, s.count('dirt') - dirt, s.edits.has(ty * s.world.w + tx + 1), ironBlocked, s.tileAt(tx + 1, ty), s.count('iron')];`),
    [2, 0, 1, true, true, 0, 1]);

  // felling a tree takes the whole trunk and its leaves; wood x2 per trunk tile
  assert.deepEqual(await execute(`const s = ${r}; const { T } = await import('/src/game/realm/tiles.ts');
    const w = s.world.w; let found = null;
    for (let x = Math.floor(s.player.x / 16); x < w - 5 && !found; x++) for (let y = 20; y < 110; y++) {
      if (s.tileAt(x, y) === T.TRUNK && s.tileAt(x, y + 1) === T.GRASS) { found = { x, y }; break; }
    }
    let top = found.y; while (s.tileAt(found.x, top - 1) === T.TRUNK) top--;
    const height = found.y - top + 1; const wood = s.count('wood');
    s.breakTile(found.x, found.y);
    let left = 0; for (let y = top - 3; y <= found.y; y++) for (let dx = -3; dx <= 3; dx++) { const id = s.tileAt(found.x + dx, y); if (id === T.TRUNK || id === T.LEAVES) left++; }
    return [s.count('wood') - wood === height * 2, left];`), [true, 0]);

  // building: needs a neighbor, can't be placed inside you
  assert.deepEqual(await execute(`const s = ${r}; const { T } = await import('/src/game/realm/tiles.ts');
    const tx = Math.floor(s.player.x / 16), ty = Math.floor(s.player.y / 16);
    s.inventory.stone = 3;
    const inYou = s.placeTile(tx, ty - 1, 'stone');
    s.setTile(tx + 2, ty, T.STONE); s.setTile(tx + 2, ty - 1, T.AIR); // solid ground to build on
    const beside = s.placeTile(tx + 2, ty - 1, 'stone');
    const floating = s.placeTile(tx + 2, ty - 8, 'stone');
    return [inYou, beside, s.tileAt(tx + 2, ty - 1), floating, s.count('stone')];`), [false, true, 3, false, 2]);

  // alchemy & smithing
  assert.deepEqual(await execute(`const s = ${r}; const { RECIPES } = await import('/src/game/realm/items.ts');
    const byId = id => RECIPES.find(x => x.id === id);
    s.pickaxe = 0; s.sword = 0; // the ore-tier check above upgraded the pick by hand
    Object.assign(s.inventory, { copper: 18, wood: 10, gel: 2, herb: 2 });
    const pick = s.craft(byId('copperPick')); const again = s.craft(byId('copperPick'));
    const sword = s.craft(byId('copperSword')); const potion = s.craft(byId('potion')); const torch = s.craft(byId('torch'));
    const cantAfford = s.craft(byId('ironSword'));
    return [pick, again, s.pickaxe, sword, s.sword, potion, s.count('potion'), torch, s.count('copper'), cantAfford];`),
    [true, false, 1, true, 1, true, 2, true, 0, false]);

  // sword combat: damage by blade tier, knockback, drops on death
  assert.deepEqual(await execute(`const s = ${r}; const { REALM_ENEMIES } = await import('/src/game/realm/realmEnemies.ts');
    s.facing = 1; const slime = s.spawnEnemy(REALM_ENEMIES.slime, s.player.x + 30, s.player.y);
    slime.sprite.body.updateFromGameObject();
    s.swingTimer = 0; s.swing(); const afterOne = slime.hp;
    s.swingTimer = 0; s.swing(); const gel = s.count('gel');
    return [afterOne, slime.hp <= 0, s.enemies.includes(slime), gel > 0];`), [8, true, false, true]);

  // getting hurt, dying, respawning (the loss track plays while you're down)
  assert.deepEqual(await execute(`const s = ${r}; s.invuln = 0; s.hurtPlayer(30, s.player.x + 10);
    const hurt = [s.hp, s.invuln > 0, s.player.body.velocity.x < 0];
    s.invuln = 0; s.hurtPlayer(200, s.player.x); return [...hurt, s.dead, window.__music.cue];`), [70, true, true, true, 'loss']);
  await step(4);
  assert.deepEqual(await evaluate(`[${r}.dead, ${r}.hp, ${r}.player.visible]`), [false, 100, true]);

  // night on the surface switches to the danger track and darkens the sky
  await execute(`const s = ${r}; s.clock = 0.8 * 360000; s.enemies.slice().forEach(e => s.despawn(e));`);
  await step(0.3);
  assert.deepEqual(await evaluate(`[window.__music.cue, ${r}.darknessAlpha() > 0.5]`), ['danger', true]);
  await execute(`${r}.clock = 0.2 * 360000;`);
  await step(0.3);
  assert.equal(await evaluate('window.__music.cue'), 'explore');

  // the controller: X swings, right stick aims, RT mines, LB/RB switch tools
  await execute(`window.__pads = [{ index: 0, connected: true, mapping: 'standard', id: 'Xbox', axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) }];
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => window.__pads });`);
  const btn = (b, down) => execute(`window.__pads[0].buttons[${b}].pressed = ${down}; window.__pads[0].buttons[${b}].value = ${down ? 1 : 0};`);
  await btn(2, true); await step(0.05);
  assert.equal(await evaluate(`${r}.swingTimer > 0`), true);
  await btn(2, false);
  await btn(5, true); await step(0.05); await btn(5, false); await step(0.05);
  assert.equal(await evaluate(`${r}.slot`), 1);
  await btn(4, true); await step(0.05); await btn(4, false); await step(0.05);
  assert.equal(await evaluate(`${r}.slot`), 0);
  // full right-stick deflection aims at full reach (Terraria-style); read where, put stone there, mine it
  await execute(`window.__pads[0].axes[3] = 1;`);
  await step(0.05);
  const target = await execute(`const s = ${r}; const { T } = await import('/src/game/realm/tiles.ts');
    const a = s.aim; s.setTile(a.tx, a.ty, T.STONE);
    return [a.tx, a.ty, a.ty > Math.floor(s.player.y / 16), Math.hypot(a.tx * 16 + 8 - s.player.x, a.ty * 16 + 8 - (s.player.y - 20)) <= 16 * 5.5 + 12];`);
  assert.deepEqual(target.slice(2), [true, true]);
  await btn(7, true); await step(1);
  assert.equal(await evaluate(`${r}.tileAt(${target[0]}, ${target[1]})`), 0);
  await btn(7, false);
  await execute(`window.__pads = [];`);

  // saving: the world comes back from its seed plus your edits
  const before = await execute(`const s = ${r}; const { T } = await import('/src/game/realm/tiles.ts');
    const tx = Math.floor(s.player.x / 16) + 3, ty = Math.floor(s.player.y / 16) - 1;
    s.setTile(tx, ty, T.WOOD); await s.save();
    return { seed: s.world.seed, tx, ty, pick: s.pickaxe, sword: s.sword, copper: s.count('copper'), potion: s.count('potion') };`);
  await execute(`${r}.scene.restart();`);
  await waitFor(`${r}.ready`);
  assert.deepEqual(await execute(`const s = ${r}; return { seed: s.world.seed, tile: s.tileAt(${before.tx}, ${before.ty}), pick: s.pickaxe, sword: s.sword, potion: s.count('potion') };`),
    { seed: before.seed, tile: 4, pick: before.pick, sword: before.sword, potion: before.potion });

  // pause -> save & quit restores the portrait game for every other mode
  await execute(`${r}.pauseRealm();`);
  await waitFor(`window.__game.scene.isActive('PlatformerPause')`);
  assert.deepEqual(await evaluate(`[window.__game.scene.getScene('PlatformerPause').children.list.filter(o => o.type === 'Text').map(t => t.text).join('|')]`),
    ['PAUSED|RESUME|NEW WORLD|SAVE & QUIT']);
  await execute(`window.__game.scene.getScene('PlatformerPause').children.list.find(o => o.type === 'Rectangle' && o.y === 270 + 73).emit('pointerdown');`);
  await waitFor(`window.__game.scene.isActive('ModeSelect')`);
  assert.deepEqual(await evaluate(`[window.__game.scale.width, window.__game.scale.height, window.__game.scene.getScene('ModeSelect').cameras.main.width, window.__music.cue]`),
    [480, 854, 480, 'menu']);

  // soundtrack cues elsewhere: Pog Quest levels explore, bosses danger, results win/loss
  await execute(`window.__game.registry.set('platformerLevelIndex', 0);`);
  await start('PlatformerRun');
  await waitFor(`window.__game.scene.getScene('PlatformerRun').ready`);
  assert.equal(await evaluate('window.__music.cue'), 'explore');
  await execute(`window.__game.registry.set('platformerLevelIndex', 3);`);
  await start('PlatformerRun');
  await waitFor(`window.__game.scene.getScene('PlatformerRun').ready && window.__game.scene.getScene('PlatformerRun').levelIndex === 3`);
  assert.equal(await evaluate('window.__music.cue'), 'danger');
  await execute(`window.__game.scene.getScene('PlatformerRun').endLevel('playerWon');`);
  await waitFor(`window.__game.scene.isActive('PlatformerResult')`);
  assert.deepEqual(await evaluate(`[window.__music.cue, window.__music.src.endsWith('/music/win-woned.mp3')]`), ['win', true]);
  // M toggles mute and it's remembered
  assert.equal(await execute(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm' })); return window.__music.muted && localStorage.getItem('pogo-showdown:muted') === '1';`), true);
  await execute(`window.__music.setMuted(false);`);
  console.log('PASS: Forever Realm world gen, mining/ore tiers, tree felling, building, crafting, sword combat, death/respawn, day/night, controller, save/load, landscape<->portrait; soundtrack cues and mute.');
}

import assert from 'node:assert/strict';

// Forever Realm Phase 3: the Forever Gate, the Eternal Hall, the Eternal Reaper, the ending, the minimap.
export async function verifyForeverGate({ execute, evaluate, waitFor, scene }) {
  const r = scene('Realm');
  const step = async (seconds, body = '') => {
    let ran = 0;
    for (let left = seconds; left > 0; left -= 2) {
      const [frames, stop] = await execute(`const g = window.__game; const s = ${r}; g.loop.sleep(); let t = window.__foreverClock ?? performance.now(); let f = 0, stop = false;
        try { for (; f < ${Math.min(2, left)} * 60 && !stop; f++) { t += 1000 / 60; g.headlessStep(t, 1000 / 60); stop = !!(() => { ${body} })(); } }
        finally { window.__foreverClock = t; g.loop.wake(); }
        return [f, stop];`);
      ran += frames / 60;
      if (stop) break;
    }
    return ran;
  };
  await execute(`window.__pads = [{ index: 0, connected: true, mapping: 'standard', id: 'Xbox', axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) }];
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => window.__pads });
    window.__btn = (b, down) => { window.__pads[0].buttons[b].pressed = down; window.__pads[0].buttons[b].value = down ? 1 : 0; };
    const { T, isSolid } = await import('/src/game/realm/tiles.ts'); window.__T = T; window.__solid = isSolid;`);
  // a restart is queued: until it runs, the old instance still reads ready, so wait for a new world
  const restarted = async js => {
    await execute(`window.__oldWorld = ${r}.world; ${js}`);
    await waitFor(`${r}.ready && ${r}.world !== window.__oldWorld`);
  };
  const press = async b => { await execute(`window.__btn(${b}, true);`); await step(0.1); await execute(`window.__btn(${b}, false);`); await step(0.05); };

  // a fresh world: the gate is there, sealed, and says so
  // restart() if the realm is already running: stop-all + start on an active scene races Phaser's queue
  await restarted(`if (window.__game.scene.isActive('Realm')) ${r}.scene.restart({ newWorld: true });
    else { for (const s of window.__game.scene.getScenes(true)) s.scene.stop(); window.__game.scene.start('Realm', { newWorld: true }); }`);
  assert.deepEqual(await execute(`const s = ${r}; const g = s.world.foreverGate; const T = window.__T;
    let gateTiles = 0; for (let dx = 0; dx < 4; dx++) for (let dy = 0; dy < 5; dy++) if (s.tileAt(g.tx + dx, g.ty + dy) === T.GATE) gateTiles++;
    s.player.body.reset((g.tx - 1) * 16, (g.ty + 5) * 16);
    return [gateTiles, window.__solid(T.GATE), s.player.texture.key, Math.round(s.player.body.width), Math.round(s.player.body.height)];`),
    [20, true, 'realm_hero', 16, 40]);
  await step(0.2);
  const why = await evaluate(`JSON.stringify({ x: ${r}.player.x, y: ${r}.player.y, gate: ${r}.world.foreverGate, ready: ${r}.ready, dead: ${r}.dead, craft: !!${r}.craftPanel?.visible })`);
  assert.deepEqual(await evaluate(`[${r}.promptText.text, ${r}.portalHere()]`), ['the Forever Gate is sealed · 0/4 relics', null], why);

  // the minimap: fogged except around you, uncovered as you travel, saved, and toggled with Tab/View
  const fog0 = await execute(`const s = ${r}; return s.explored.reduce((n, v) => n + v, 0);`);
  assert.ok(fog0 > 400 && fog0 < 2200, `explored at start (spawn + gate): ${fog0}`);
  await execute(`const s = ${r}; s.player.body.reset(s.player.x - 60 * 16, 20 * 16);`);
  await step(0.5);
  const fog1 = await execute(`const s = ${r}; return s.explored.reduce((n, v) => n + v, 0);`);
  assert.ok(fog1 > fog0 + 300, `explored after travel: ${fog1}`);
  assert.deepEqual(await execute(`const { packBits, unpackBits } = await import('/src/game/realm/realmSave.ts');
    const s = ${r}; const back = unpackBits(packBits(s.explored), s.explored.length); return back.every((v, i) => v === s.explored[i]);`), true);
  assert.deepEqual(await evaluate(`${r}.minimapParts.every(o => o.visible)`), true);
  await press(8); // View
  assert.deepEqual(await evaluate(`${r}.minimapParts.every(o => !o.visible)`), true);
  await press(8);

  // the four relics open it (they're saved; the gate follows them, not a tile edit)
  await restarted(`const s = ${r}; ['ember', 'tide', 'gale', 'grave'].forEach(x => s.relics.add(x)); s.inventory.herb = 3; await s.save(); s.scene.restart();`);
  assert.deepEqual(await execute(`const s = ${r}; const g = s.world.foreverGate; const T = window.__T;
    const open = s.tileAt(g.tx + 1, g.ty + 2) === T.ETERNAL && !s.edits.has((g.ty + 2) * s.world.w + g.tx + 1);
    s.player.body.reset((g.tx + 2) * 16, (g.ty + 5) * 16);
    return [open, s.explored.reduce((n, v) => n + v, 0) > ${fog1} - 10];`), [true, true]);
  await step(0.2);
  assert.equal(await evaluate(`${r}.promptText.text`), '▼ pass through the Forever Gate');
  await press(13);
  await waitFor(`${r}.ready && ${r}.pocket === 'forever'`);
  // the gate took us in; now pin the Hall's layout so the walk below replays exactly
  await execute(`${r}.scene.restart({ pocket: 'forever', seed: 777 });`);
  await waitFor(`${r}.ready && ${r}.pocket === 'forever' && ${r}.world.seed === 777`);
  assert.deepEqual(await evaluate(`[${r}.cameras.main.fadeEffect.isRunning || ${r}.cameras.main.fadeEffect.alpha < 1, window.__game.scale.width]`), [true, 960]);

  // the Eternal Hall: four realms' hazards in sequence, then the throne
  assert.deepEqual(await execute(`const s = ${r}; const w = s.world; const T = window.__T;
    const col = (x, id) => { for (let y = 0; y < w.h; y++) if (w.tiles[y * w.w + x] === id) return true; return false; };
    const seg = x => { s.player.body.reset(x * 16 + 8, 20 * 16); return [s.hazardHere(), +s.darknessAlpha().toFixed(2)]; };
    const lava = [...Array(52).keys()].some(x => col(x, T.LAVA));
    const water = [...Array(48).keys()].some(i => col(52 + i, T.WATER));
    let widest = 0, run = 0; for (let x = 100; x < 150; x++) { if (w.surface[x] >= w.h) run++; else { widest = Math.max(widest, run); run = 0; } }
    const segs = [seg(20), seg(70), seg(120), seg(170), seg(230)];
    s.player.body.reset(s.spawnPoint.x, s.spawnPoint.y);
    return [w.w, lava, water, widest <= 6 && widest >= 4, JSON.stringify(segs), w.arena.x1 - w.arena.x0, s.count('herb')];`),
    [260, true, true, true, JSON.stringify([['ember', 0.55], ['tide', 0.6], ['gale', 0.35], ['grave', 0.97], [null, 0.8]]), 60, 3]);

  // a bot with the relics (immune to lava, breathes water, double-jumps) walks the whole Hall to the throne
  const took = await step(90, `const s = ${r}; s.spawnTimer = 1e9; const b = s.player.body; s.invuln = 1e9; s.hp = s.maxHp;
    const T = window.__T, solid = window.__solid;
    const tx = Math.floor(s.player.x / 16), ty = Math.floor((s.player.y - 1) / 16);
    const wall = solid(s.tileAt(tx + 1, ty)) || solid(s.tileAt(tx + 1, ty - 1)) || solid(s.tileAt(tx + 1, ty - 2));
    const gap = !solid(s.tileAt(tx + 1, ty + 1));
    const swim = s.isWaterAt(s.player.x, s.player.y - 18);
    const grounded = b.blocked.down;
    window.__f = (window.__f ?? 0) + 1;
    window.__pads[0].axes[0] = 1;
    let floor = false; for (let y = ty + 1; y < ty + 5; y++) if (solid(s.tileAt(tx, y))) floor = true;
    if (swim) window.__btn(0, window.__f % 14 < 9);
    else if (grounded && (wall || gap) && !window.__jumping) { window.__btn(0, true); window.__jumping = window.__f; window.__dj = 0; }
    else if (!grounded && window.__jumping && b.velocity.y > 60 && !floor && !window.__dj) { window.__btn(0, false); window.__dj = 1; }
    else if (window.__dj === 1) { window.__btn(0, true); window.__dj = 2; }
    else if (window.__jumping && grounded && window.__f - window.__jumping > 6) { window.__btn(0, false); window.__jumping = 0; }
    return s.player.x > (s.pocketWorld.arena.x0 + 6) * 16;`);
  await execute(`window.__pads[0].axes[0] = 0; window.__btn(0, false);`);
  assert.equal(await evaluate(`${r}.player.x > (${r}.pocketWorld.arena.x0 + 6) * 16`), true, `bot reached the throne (after ${took.toFixed(1)}s)`);
  await step(0.3);
  assert.deepEqual(await evaluate(`[${r}.boss?.def.id, ${r}.boss?.phase, window.__music.cue]`), ['reaper', 'drift', 'danger']);

  // the Reaper: one realm per quarter of its health, immune while calling or unseen, exposed after a strike
  assert.deepEqual(await execute(`const s = ${r}; const b = s.boss; const ctx = s.bossCtx();
    const { updateBoss, hitBoss } = await import('/src/game/realm/realmBosses.ts');
    s.physics.pause(); s.invuln = 1e9;
    const clear = () => s.hazards.slice().forEach(h => s.removeHazard(h));
    const run = (ms) => { for (let t = 0; t < ms; t += 16) updateBoss(b, ctx, 16); };
    const kinds = () => [...new Set(s.hazards.map(h => h.sprite.texture.key))].sort().join('+');
    clear(); b.data.fire = 0; run(32); const s1 = kinds();
    b.hp = 600; run(16); const call2 = [b.phase, hitBoss(b, 40, s.player.x), b.data.stage];
    run(1500); clear(); b.phase = 'drift'; b.timer = 9999; b.data.fire = 0; run(32);
    const s2 = kinds(); const falls = s.hazards.every(h => h.sprite.body.allowGravity);
    b.hp = 400; run(16); run(1500); clear(); b.phase = 'drift'; b.timer = 9999; b.data.waves = 0; b.data.fire = 99999; run(32); const s3 = kinds();
    b.hp = 200; run(16); const dark = s.darkOverride; run(1500); const vanish = [b.phase, hitBoss(b, 40, s.player.x)];
    run(1000); const behind = Math.sign(b.sprite.x - s.player.x) === (s.player.flipX ? 1 : -1);
    run(900); const exposed = [b.phase, hitBoss(b, 40, s.player.x)];
    s.physics.resume(); clear();
    return [s1, ...call2, s2, falls, s3, dark, ...vanish, behind, ...exposed];`),
    ['fx_soul', 'call', 0, 2, 'fx_flame', true, 'fx_wave', 0.93, 'vanish', 0, true, 'exposed', 60]);

  // victory: Eternity, Champion, the ending; A returns you home, where the gate remembers
  await execute(`const s = ${r}; s.boss.hp = 1; s.boss.phase = 'exposed'; s.boss.sprite.setAlpha(1);
    s.facing = s.boss.sprite.x > s.player.x ? 1 : -1; s.player.body.reset(s.boss.sprite.x - s.facing * 30, s.boss.sprite.y + 30);
    s.swingTimer = 0; s.swing();`);
  assert.deepEqual(await evaluate(`[${r}.champion, ${r}.sword, ${r}.bossDefeated, ${r}.stats.bosses >= 1]`), [true, 4, true, true]);
  await step(9);
  assert.deepEqual(await evaluate(`[!!${r}.ending, ${r}.endingReady, window.__music.cue,
    ${r}.ending.list.some(o => o.text === 'THE ETERNAL REAPER IS UNMADE'), ${r}.ending.list.some(o => (o.text ?? '').includes('Eternity (60)'))]`),
    [true, true, 'win', true, true]);
  await press(0);
  await waitFor(`${r}.ready && !${r}.pocket`);
  assert.deepEqual(await execute(`const s = ${r}; const { loadRealm } = await import('/src/game/realm/realmSave.ts'); const save = await loadRealm();
    return [s.champion, s.sword, save.champion, save.stats.bosses >= 1, s.portalLabels.some(o => (o.text ?? '').includes('champion'))];`),
    [true, 4, true, true, true]);

  // stats count the journey
  assert.deepEqual(await execute(`const s = ${r}; const before = { ...s.stats }; const T = window.__T;
    const tx = Math.floor(s.player.x / 16) + 2, ty = Math.floor(s.player.y / 16);
    s.setTile(tx, ty - 1, T.DIRT); s.breakTile(tx, ty - 1); s.inventory.dirt = 1; s.setTile(tx, ty, T.STONE); s.placeTile(tx, ty - 1, 'dirt');
    return [s.stats.mined - before.mined, s.stats.placed - before.placed];`), [1, 1]);
  await execute(`window.__pads = [];`);
  console.log('PASS: Forever Gate: sealed/open by relics, Chakan hero, fogged minimap (reveal, save, toggle), Eternal Hall segments, bot walks the Hall, Reaper stages/immunity/exposure, Eternity + Champion, ending, stats.');
}

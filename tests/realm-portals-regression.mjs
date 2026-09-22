import assert from 'node:assert/strict';

// Forever Realm Phase 2: the shrine, the four portal realms, their hazards, bosses and relics.
export async function verifyPortalRealms({ execute, evaluate, waitFor, scene }) {
  const r = scene('Realm');
  const step = async (seconds, body = '') => {
    let ran = 0;
    for (let left = seconds; left > 0; left -= 2) {
      const [frames, stop] = await execute(`const g = window.__game; const s = ${r}; g.loop.sleep(); let t = window.__portalClock ?? performance.now(); let f = 0, stop = false;
        try { for (; f < ${Math.min(2, left)} * 60 && !stop; f++) { t += 1000 / 60; g.headlessStep(t, 1000 / 60); stop = !!(() => { ${body} })(); } }
        finally { window.__portalClock = t; g.loop.wake(); }
        return [f, stop];`);
      ran += frames / 60;
      if (stop) break;
    }
    return ran;
  };
  // a fake pad the bot and the portal checks drive
  await execute(`window.__pads = [{ index: 0, connected: true, mapping: 'standard', id: 'Xbox', axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) }];
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => window.__pads });
    window.__btn = (b, down) => { window.__pads[0].buttons[b].pressed = down; window.__pads[0].buttons[b].value = down ? 1 : 0; };`);

  // pocket generation: entrance portal, an arena, and gaps sized to the jump
  assert.deepEqual(await execute(`const { generatePocket } = await import('/src/game/realm/pocketGen.ts');
    const { T } = await import('/src/game/realm/tiles.ts');
    const out = {};
    for (const id of ['ember', 'tide', 'gale', 'grave']) {
      const a = generatePocket(id, 42), b = generatePocket(id, 42);
      const at = (x, y) => a.tiles[y * a.w + x];
      const portal = [3, 4].every(x => [1, 2, 3].every(dy => at(x, a.surface[5] - dy) === T.PORTAL));
      let widestPool = 0, run = 0;
      for (let x = 0; x < a.w; x++) { if (at(x, a.surface[x]) === T.LAVA) run++; else { widestPool = Math.max(widestPool, run); run = 0; } }
      let widestGap = 0, rise = 0; run = 0;
      if (id === 'gale') for (let x = 1; x < a.arena.x0; x++) {
        if (a.surface[x] >= a.h) run++; else { widestGap = Math.max(widestGap, run); if (run > 0) rise = Math.max(rise, lastTop - a.surface[x]); run = 0; var lastTop = a.surface[x]; }
      }
      out[id] = [a.tiles.every((v, i) => v === b.tiles[i]), portal, a.arena.x1 - a.arena.x0 >= 40, widestPool <= 5, widestGap <= 5, rise <= 3,
        id !== 'tide' || at(5, a.entrance.ty) !== T.WATER];
    }
    return out;`), {
    ember: [true, true, true, true, true, true, true], tide: [true, true, true, true, true, true, true],
    gale: [true, true, true, true, true, true, true], grave: [true, true, true, true, true, true, true],
  });

  // the shrine: four portals east of spawn; stand in one, press down, and you're in its realm
  await execute(`for (const s of window.__game.scene.getScenes(true)) s.scene.stop(); window.__game.scene.start('Realm', { newWorld: true });`);
  await waitFor(`${r}.ready`);
  const shrine = await execute(`const s = ${r}; s.inventory.copper = 7; s.inventory.herb = 5;
    const p = s.world.portals; const ember = p[0]; s.player.body.reset((ember.tx + 1) * 16, (ember.ty + 3) * 16);
    return [p.map(q => q.pocket).join(','), ember.tx];`);
  assert.equal(shrine[0], 'ember,tide,gale,grave');
  await step(0.2);
  assert.equal(await evaluate(`${r}.promptText.text`), '▼ enter the Ember Realm');
  await execute(`window.__btn(13, true);`); await step(0.1); await execute(`window.__btn(13, false);`);
  await waitFor(`${r}.ready && ${r}.pocket === 'ember'`);
  assert.deepEqual(await evaluate(`[${r}.count('copper'), ${r}.count('herb'), ${r}.world.w, window.__game.scale.width]`), [7, 5, 220, 960]);

  // Ember hazards: heat drains; a Fire Ward stops it and halves lava; the Ember Heart makes you immune
  assert.deepEqual(await execute(`const s = ${r}; const body = s.player.body;
    const env = () => s.updateEnvironment(1000, body, { inWater: false, grounded: true, jumpPressed: false, jumpHeld: false });
    s.hp = 100; env(); const heat = 100 - s.hp;
    s.hp = 100; s.buffs.fireward = 5000; env(); const warded = 100 - s.hp;
    const { T } = await import('/src/game/realm/tiles.ts');
    const tx = Math.floor(s.player.x / 16), ty = Math.floor((s.player.y - 4) / 16);
    s.setTile(tx, ty, T.LAVA); s.invuln = 0; s.hp = 100; env(); const wardLava = 100 - s.hp;
    s.buffs.fireward = 0; s.relics.add('ember'); s.invuln = 0; s.hp = 100; env(); const heartLava = 100 - s.hp;
    s.relics.delete('ember'); s.setTile(tx, ty, T.AIR);
    return [Math.round(heat * 10) / 10, warded, wardLava, heartLava];`), [2.5, 0, 10, 0]);

  // traversal: a simple bot (hold right, jump walls/gaps/lava, stroke in water) reaches every arena
  const bot = `const b = s.player.body; s.invuln = 1e9; s.hp = s.maxHp; s.breath = 100;
    const T = window.__T; const solid = id => window.__solid(id);
    const tx = Math.floor(s.player.x / 16), ty = Math.floor((s.player.y - 1) / 16);
    const wall = solid(s.tileAt(tx + 1, ty)) || solid(s.tileAt(tx + 1, ty - 1)) || solid(s.tileAt(tx + 1, ty - 2));
    const gap = !solid(s.tileAt(tx + 1, ty + 1)) || s.tileAt(tx + 1, ty + 1) === T.LAVA || s.tileAt(tx + 2, ty) === T.LAVA || s.tileAt(tx + 2, ty + 1) === T.LAVA;
    const swim = s.isWaterAt(s.player.x, s.player.y - 18);
    window.__f = (window.__f ?? 0) + 1;
    window.__pads[0].axes[0] = 1;
    // hold a jump like a person does (a short tap gets cut to a hop); swim in strokes
    const grounded = b.blocked.down;
    if (swim) window.__btn(0, window.__f % 14 < 9);
    else if (grounded && (wall || gap) && !window.__jumping) { window.__btn(0, true); window.__jumping = window.__f; }
    else if (window.__jumping && grounded && window.__f - window.__jumping > 6) { window.__btn(0, false); window.__jumping = 0; }
    if (s.pocket === 'gale' && s.player.y > (s.world.h - 3) * 16 - 4) window.__falls = (window.__falls ?? 0) + 1;
    return s.player.x > (s.pocketWorld.arena.x0 + 2) * 16;`;
  await execute(`const { T, isSolid } = await import('/src/game/realm/tiles.ts'); window.__T = T; window.__solid = isSolid;`);
  for (const pocket of ['ember', 'tide', 'gale', 'grave']) {
    if (pocket !== 'ember') {
      await execute(`${r}.scene.restart({ pocket: '${pocket}' });`);
      await waitFor(`${r}.ready && ${r}.pocket === '${pocket}'`);
    }
    await execute(`window.__falls = 0; window.__f = 0; window.__jumping = 0; const s = ${r}; s.enemies.slice().forEach(e => s.despawn(e)); s.spawnTimer = 1e9;`);
    const took = await step(90, `const s = ${r}; s.spawnTimer = 1e9; ${bot}`);
    await execute(`window.__pads[0].axes[0] = 0; window.__btn(0, false);`);
    const [reached, falls] = await evaluate(`[${r}.player.x > (${r}.pocketWorld.arena.x0 + 2) * 16, window.__falls]`);
    assert.equal(reached, true, `bot reached the ${pocket} arena (after ${took.toFixed(1)}s)`);
    assert.ok(took < 80, `${pocket} took ${took}s`);
    if (pocket === 'gale') assert.ok(falls <= 3, `gale void falls: ${falls}`);
    // the arena closes behind you and the boss wakes
    await step(0.3);
    assert.deepEqual(await evaluate(`[${r}.boss?.def.id, ${r}.gateTiles.length > 5, window.__music.cue]`),
      [{ ember: 'tyrant', tide: 'leviathan', gale: 'harpy', grave: 'king' }[pocket], true, 'danger']);

    if (pocket === 'tide') {
      // drowning: breath runs out with your head under, then it hurts; Gillweed or the Tide Pearl prevents it
      assert.deepEqual(await execute(`const s = ${r}; const body = s.player.body;
        const { T } = await import('/src/game/realm/tiles.ts');
        const tx = Math.floor(s.player.x / 16), ty = Math.floor(s.player.y / 16);
        for (let y = ty - 4; y < ty; y++) if (s.tileAt(tx, y) === T.AIR) s.setTile(tx, y, T.WATER);
        s.invuln = 0; s.breath = 100; s.hp = 100;
        const env = ms => s.updateEnvironment(ms, body, { inWater: true, grounded: true, jumpPressed: false, jumpHeld: false });
        env(5000); const half = Math.round(s.breath); env(6000); const drowning = s.hp < 100;
        s.breath = 100; s.hp = 100; s.buffs.gills = 60000; env(12000); const gills = [Math.round(s.breath), s.hp];
        return [half, drowning, ...gills];`), [50, true, 100, 100]);
    }
    if (pocket === 'gale') {
      // the void puts you back on the last solid ground, for a price; the Gale Plume adds a mid-air jump
      assert.deepEqual(await execute(`const s = ${r}; const body = s.player.body; s.invuln = 0; s.hp = 100; s.lastSafe = { x: 500, y: 600 };
        body.reset(700, (s.world.h - 2) * 16); s.updateEnvironment(16, body, { inWater: false, grounded: false, jumpPressed: false, jumpHeld: false });
        return [Math.round(s.player.x), Math.round(s.player.y), s.hp];`), [500, 600, 85]);
    }
  }

  // bosses: each state machine cycles; the Hollow King turns frontal blows aside
  assert.deepEqual(await execute(`const { BOSSES, createBoss, updateBoss, hitBoss } = await import('/src/game/realm/realmBosses.ts');
    const s = ${r}; const ctx = s.bossCtx(); const phases = {};
    for (const id of ['tyrant', 'leviathan', 'harpy', 'king']) {
      const sprite = s.physics.add.sprite((s.pocketWorld.arena.x0 + 20) * 16, (s.pocketWorld.arena.floorY - 4) * 16, BOSSES[id].texture);
      sprite.body.setAllowGravity(false); sprite.body.blocked.down = true;
      const b = createBoss(BOSSES[id], sprite); const seen = [b.phase];
      for (let i = 0; i < 600 && seen.length < 4; i++) {
        b.timer = Math.min(b.timer, 16); if (b.phase === 'leap' || b.phase === 'dive') { b.timer = 5000; sprite.body.blocked.down = true; }
        updateBoss(b, ctx, 16); if (seen[seen.length - 1] !== b.phase) seen.push(b.phase);
        if (b.phase === 'dive') { b.data.tx = sprite.x; b.data.ty = sprite.y; }
      }
      phases[id] = seen.join('>');
      if (id === 'king') {
        b.phase = 'stalk'; sprite.setFlipX(false); const hp = b.hp;
        const front = hitBoss(b, 10, sprite.x + 50); const back = hitBoss(b, 10, sprite.x - 50);
        b.phase = 'reel'; const reel = hitBoss(b, 10, sprite.x + 50);
        phases.kingHits = [front, back, reel, hp - b.hp].join(',');
      }
      sprite.destroy();
    }
    return phases;`), {
    tyrant: 'walk>crouch>leap>recover', leviathan: 'circle>windup>lunge>tired', harpy: 'hover>windup>dive>climb',
    king: 'stalk>windup>dash>reel', kingHits: '0,10,15,25',
  });

  // winning: the Hollow King (the realm we're in) drops his relic, loot, and a way home
  assert.deepEqual(await execute(`const s = ${r}; s.boss.hp = 1; s.boss.phase = 'reel'; s.facing = 1;
    s.player.body.reset(s.boss.sprite.x - 30, s.boss.sprite.y); s.swingTimer = 0; s.swing();
    const { T } = await import('/src/game/realm/tiles.ts');
    const pw = s.pocketWorld; const mid = Math.floor((pw.arena.x0 + pw.arena.x1) / 2);
    await s.save();
    const { loadRealm } = await import('/src/game/realm/realmSave.ts'); const saved = await loadRealm();
    return [!!s.boss, s.bossDefeated, s.relics.has('grave'), s.maxHp, s.count('dust') >= 10, s.tileAt(mid, pw.arena.floorY - 1) === T.PORTAL, s.gateTiles.length, saved.relics.includes('grave')];`),
    [false, true, true, 150, true, true, 0, true]);
  await step(0.2);
  assert.equal(await evaluate('window.__music.cue'), 'win');

  // relic powers carry everywhere: the Gale Plume double jump and the Ember Heart's +4
  assert.deepEqual(await execute(`const s = ${r}; s.relics.add('gale'); s.relics.add('ember'); const base = s.swordDamage();
    s.buffs.tonic = 1000; const tonic = s.swordDamage(); s.buffs.tonic = 0; return [base, tonic];`), [14, 21]);

  // dying mid-fight resets the arena; the way home returns you to the shrine in the overworld
  await execute(`${r}.scene.restart({ pocket: 'ember' });`);
  await waitFor(`${r}.ready && ${r}.pocket === 'ember'`);
  await execute(`const s = ${r}; s.player.body.reset((s.pocketWorld.arena.x0 + 8) * 16, s.pocketWorld.arena.floorY * 16 - 2);`);
  await step(0.3);
  assert.equal(await evaluate(`!!${r}.boss`), true);
  await execute(`const s = ${r}; s.invuln = 0; s.hurtPlayer(9999, s.player.x);`);
  await step(4);
  assert.deepEqual(await evaluate(`[${r}.dead, !!${r}.boss, ${r}.gateTiles.length, ${r}.player.x < 20 * 16]`), [false, false, 0, true]);
  // you come back beside the return portal; step left into it
  await execute(`const s = ${r}; s.player.body.reset(4 * 16, s.player.y);`);
  await step(0.2);
  assert.equal(await evaluate(`${r}.promptText.text`), '▼ return to the Overworld');
  await execute(`window.__btn(13, true);`); await step(0.1); await execute(`window.__btn(13, false);`);
  await waitFor(`${r}.ready && !${r}.pocket`);
  assert.deepEqual(await evaluate(`[${r}.world.w, Math.abs(${r}.player.x - (${r}.world.portals[0].tx + 1) * 16) < 40, [...${r}.relics].sort().join(',')]`),
    [640, true, 'grave']); // only the relic actually won persists (the powers check above only set them in memory)
  await execute(`window.__pads = [];`);
  console.log('PASS: Forever Realm portals: shrine travel both ways, pocket generation, bot reaches all four arenas, heat/lava/drowning/void, four boss state machines, King guard, relic/loot/exit on victory, relic powers, arena reset on death.');
}

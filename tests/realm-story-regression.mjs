import assert from 'node:assert/strict';

// Eternity High v0.6: item builds, nemeses, ultimate weapons, Story Mode from title to ending,
// the harvest bubble, and every hero's art. Runs in the runner's isolated browser context.
export async function verifyStory({ execute, evaluate, waitFor, scene }) {
  const r = scene('Realm');
  const title = scene('Title');
  const step = async seconds => {
    for (let left = seconds; left > 0; left -= 2) {
      await execute(`const g = window.__game; g.loop.sleep(); let t = window.__storyClock ?? performance.now();
        try { for (let i = 0; i < ${Math.min(2, left)} * 60; i++) { t += 1000 / 60; g.headlessStep(t, 1000 / 60); } }
        finally { window.__storyClock = t; g.loop.wake(); }`);
    }
  };
  const open = async (name, data = {}) => {
    await execute(`for (const s of window.__game.scene.getScenes(true)) s.scene.stop();`);
    await waitFor(`window.__game.scene.getScenes(true).length === 0`);
    // a stopped scene keeps its old fields: don't let its old 'ready' answer for the next one
    await execute(`const old = ${r}; if (old) old.ready = false; window.__game.scene.start('${name}', ${JSON.stringify(data)});`);
  };
  const quiet = () => execute(`${r}.trySpawn = () => {}; for (const e of [...${r}.enemies]) ${r}.despawn(e); ${r}.invuln = 1e9;`);
  /** run a scene to its end: taps through every line, and answers a question with its first choice */
  const finishDialogue = async (answer = 0) => {
    for (let i = 0; i < 40 && await evaluate(`!!${r}.dialogue?.open`); i++) {
      await execute(`const d = ${r}.dialogue; d.shownAt = -1e9; d.typing = undefined;
        if (d.choiceButtons.length) d.choose(d.lines[d.index].choices[Math.min(${answer}, d.lines[d.index].choices.length - 1)].id);
        else d.advance();`);
    }
    assert.equal(await evaluate(`!!${r}.dialogue?.open`), false);
  };
  const storyTick = async () => { await execute(`${r}.story.checkTimer = 0; ${r}.story.update(16);`); };

  // ---- pure rules ----
  assert.deepEqual(await execute(`const g = await import('/src/game/realm/gear.ts');
    const { CHARACTERS } = await import('/src/game/data/characters.ts');
    const { WEAPONS, nemesisSpoils, weaponStage } = await import('/src/game/realm/weapons.ts');
    const { NEMESES } = await import('/src/game/realm/nemesis.ts');
    const { HERO_VOICE, CHAPTERS, finale } = await import('/src/game/realm/story.ts');
    const { computeHeroStats } = await import('/src/game/realm/hero.ts');
    const { EMPTY_PERKS } = await import('/src/game/data/pogs.ts');
    const ids = CHARACTERS.map(c => c.id);
    const every = (rec) => ids.every(id => !!rec[id]);
    // nothing is ever lost: build from raw materials, break it all the way down, and the pack is exactly as it was
    const pack = { copper: 50, iron: 50, wood: 50, gel: 50, ember: 10, bone: 50, stone: 50, feather: 10, pearl: 10, dust: 10, ecto: 10, herb: 50, soulstone: 10 };
    const before = JSON.stringify(pack);
    const st = g.emptyGear();
    const lossless = g.GEAR_IDS.every(id => {
      const def = g.GEAR[id];
      for (const c of def.components) g.craftComponent(c, st, pack);
      if (!g.buildItem(id, st, pack)) return false;
      g.dismantleItem(id, st, pack);
      for (const c of def.components) g.salvageComponent(c, st, pack);
      return JSON.stringify(Object.fromEntries(Object.keys(JSON.parse(before)).map(k => [k, pack[k]]))) === before;
    });
    // a part you already own is not paid for twice
    const owned = g.emptyGear(); owned.components.metronome = 1;
    const cost = g.buildCost('diadem', owned);
    // each ultimate build makes that hero's own stat the point
    const base = (id) => { const s = computeHeroStats(id, 1, { ...EMPTY_PERKS }); return s; };
    const full = (id) => { const s = base(id); g.applyGear(s, id, g.ULTIMATE_BUILDS[id].items); return s; };
    const cleo = [base('cleo').comboCap, full('cleo').comboCap];
    const khan = [base('khan').maxHpBonus, full('khan').maxHpBonus];
    return [every(g.ULTIMATE_BUILDS), every(WEAPONS), every(NEMESES), every(HERO_VOICE), CHAPTERS.length, lossless,
      cost.metronome === undefined && cost.copper === 3 && cost.ember === 2,
      cleo[1] > cleo[0] + 0.7, khan[1] > khan[0] + 100,
      new Set(ids.map(id => WEAPONS[id].passive)).size, new Set(ids.map(id => NEMESES[id].id)).size,
      // the nemesis pays only for what the overworld can't give, so every weapon still has something to gather
      ids.every(id => Object.keys(WEAPONS[id].materials).length > Object.keys(nemesisSpoils(id)).length),
      weaponStage('cleo', [], [], {}), weaponStage('cleo', ['cleo'], [], {}), weaponStage('cleo', ['cleo'], ['cleo'], {}),
      ids.every(id => CHAPTERS.every(c => c.scene(id).length > 0 && c.hint(id).length > 0) && finale(id).length > 0),
      ids.every(id => window.__game.textures.exists('realm_hero_' + id) && window.__game.textures.exists('boss_nem_' + id) && window.__game.textures.exists('weapon_' + id))];`),
    [true, true, true, true, 6, true, true, true, true, 8, 8, true, 'nemesis', 'gather', 'done', true, true]);

  // ---- the title: landscape, with Story Mode ----
  await open('Title');
  await waitFor(`${title}.children.list.some(o => o.type === 'Text' && o.text === 'STORY MODE')`);
  assert.deepEqual(await evaluate(`[window.__game.scale.width > window.__game.scale.height, ${title}.children.list.some(o => o.type === 'Text' && o.text === 'ETERNITY HIGH')]`), [true, true]);
  await execute(`${title}.children.list.filter(o => o.type === 'Rectangle' && o.input?.enabled)[${await evaluate(`${title}.children.list.filter(o => o.type === 'Rectangle' && o.input?.enabled).length`)} - 2].emit('pointerdown');`);
  await waitFor(`${title}.storyPick && ${title}.children.list.filter(o => o.type === 'Rectangle' && o.input?.enabled).length === 8`);
  await execute(`${title}.children.list.filter(o => o.type === 'Rectangle' && o.input?.enabled)[0].emit('pointerdown');`); // Cleo P.
  await waitFor(`window.__game.scene.isActive('Realm') && ${r}.ready && !${r}.pocket && !!${r}.story?.data`);
  await quiet();

  // ---- chapter one opens by itself, with a question; the answer is a real gift ----
  await step(0.6);
  assert.equal(await evaluate(`${r}.dialogue.open && ${r}.physics.world.isPaused && ${r}.story.data.played === 0`), true);
  // a tap can't skip a question, and Esc-style skipping stops at it
  await execute(`${r}.dialogue.skip();`);
  assert.equal(await evaluate(`!!${r}.dialogue.lines[${r}.dialogue.index].choices`), true);
  await execute(`const d = ${r}.dialogue; d.shownAt = -1e9; d.typing = undefined; d.advance();`);
  assert.equal(await evaluate(`${r}.dialogue.open && !!${r}.dialogue.lines[${r}.dialogue.index].choices`), true);
  await finishDialogue(0);
  assert.deepEqual(await evaluate(`[${r}.physics.world.isPaused, ${r}.gear.components.whetstone, ${r}.story.data.choices.bell, ${r}.expeditionText.text.includes('Chop a tree')]`),
    [false, 1, 'fight', true]);

  // ---- the harvest bubble says how, and gets out of the way ----
  const tree = `(() => { const w = ${r}.world; for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === 9) return { tx: i % w.w, ty: Math.floor(i / w.w) }; return null; })()`;
  const spot = await evaluate(tree);
  assert.ok(spot, 'the world has trees');
  await execute(`const b = ${r}.player.body; b.reset(${(spot.tx + 2) * 16}, ${(spot.ty + 1) * 16}); ${r}.slot = 1; ${r}.harvestTimer = 0; ${r}.updateHarvestHelp(16);`);
  assert.deepEqual(await evaluate(`[${r}.bubble.visible, ${r}.bubble.text.includes('Tree'), ${r}.bubble.text.includes('hotbar') || ${r}.bubble.text.includes('pick ⛏')]`), [true, true, true]);
  await execute(`${r}.bubble.emit('pointerdown'); ${r}.harvestTimer = 0; ${r}.updateHarvestHelp(16);`);
  assert.deepEqual(await evaluate(`[${r}.slots[${r}.slot], ${r}.bubble.text.includes('hold')]`), ['pickaxe', true]);
  // each thing is explained once, for a few seconds, then it's gone for good
  await execute(`${r}.bubbleUntil = 0; ${r}.harvestTimer = 0; ${r}.updateHarvestHelp(16);`);
  assert.equal(await evaluate(`${r}.bubble.visible`), false);
  // a blocked ore explains itself once as well
  await execute(`const w = ${r}.world; const tx = Math.floor(${r}.player.x / 16); const ty = Math.floor((${r}.player.y - 20) / 16);
    window.__oreAt = ty * w.w + tx; window.__oreWas = w.tiles[window.__oreAt]; w.tiles[window.__oreAt] = 6; ${r}.pickaxe = 0; ${r}.harvestTimer = 0; ${r}.updateHarvestHelp(16);`);
  assert.deepEqual(await evaluate(`[${r}.bubble.visible, ${r}.bubble.text.includes('Copper Pickaxe'), ${r}.harvestTile]`), [true, true, null]);
  await execute(`${r}.world.tiles[window.__oreAt] = window.__oreWas;`);

  // ---- chapters advance on what the world says ----
  const advanceTo = async (n) => {
    for (let i = 0; i < 12 && await evaluate(`${r}.story.data.played < ${n}`); i++) {
      await storyTick();
      await finishDialogue();
    }
    assert.equal(await evaluate(`${r}.story.data.chapter === ${n} && ${r}.story.data.played === ${n}`), true);
  };
  await execute(`${r}.inventory.wood = 6;`);
  await advanceTo(1);
  await execute(`${r}.pickaxe = 1; ${r}.sword = 1;`);
  await advanceTo(2);
  await execute(`${r}.relics.add('ember');`);
  await advanceTo(3);
  assert.equal(await evaluate(`${r}.expeditionText.text.includes('Octavia')`), true);

  // ---- the objective is a button to the QUEST page, which walks you into detention ----
  await execute(`${r}.expeditionText.emit('pointerdown');`);
  await waitFor(`${r}.heroMenu.open && ${r}.heroMenu.tab === 3`);
  assert.equal(await evaluate(`${r}.heroMenu.panel.rows.some(row => row.label.includes('Step 1') && row.label.includes('Octavia') && row.enabled !== false)`), true);
  // nemesis first: forging is locked and says what it needs
  assert.equal(await evaluate(`${r}.heroMenu.panel.rows.find(row => row.label.includes('Step 3')).enabled`), false);
  await execute(`${r}.heroMenu.panel.rows.find(row => row.label.includes('Step 1')).action();`);
  await waitFor(`${r}.pocket === 'detention' && ${r}.ready`);
  await quiet();
  await execute(`${r}.hero.stats.critChance = 0; ${r}.player.body.reset(${r}.pocketWorld.arena.x0 * 16 + 120, ${r}.pocketWorld.arena.floorY * 16);`);
  await step(0.3);
  assert.deepEqual(await evaluate(`[${r}.boss.def.id, ${r}.boss.def.name, ${r}.boss.sprite.texture.key, ${r}.boss.phase, ${r}.bossText.text.includes('Octavia')]`),
    ['nem_cleo', 'Octavia the Hall Monitor', 'boss_nem_cleo', 'rest', true]);
  // it goes through its moves without the arena falling apart, and is open while it rests
  await execute(`${r}.boss.timer = 0;`);
  await step(0.4);
  assert.equal(await evaluate(`${r}.boss.phase.startsWith('tell_')`), true);
  await step(4);
  assert.equal(await evaluate(`${r}.boss.sprite.x >= ${r}.pocketWorld.arena.x0 * 16 && ${r}.boss.sprite.x <= ${r}.pocketWorld.arena.x1 * 16 && ${r}.hazards.length >= 0`), true);
  assert.deepEqual(await execute(`const b = ${r}.boss; const { hitBoss } = await import('/src/game/realm/realmBosses.ts'); b.phase = 'rest'; const hp = b.hp; const open = hitBoss(b, 100, 0); b.phase = 'tell_blink'; const gone = hitBoss(b, 100, 0); b.hp = hp; b.phase = 'rest'; return [open, gone];`), [125, 0]);
  // the first win pays the sigil and the rare half
  await execute(`${r}.boss.hp = 1; ${r}.damageBoss(50);`);
  await step(0.3);
  assert.deepEqual(await evaluate(`[${r}.sigils.includes('cleo'), ${r}.count('ember') >= 6, ${r}.count('pearl') >= 4, ${r}.count('soulstone') >= 6, ${r}.boss === undefined, ${r}.bossDefeated]`),
    [true, true, true, true, true, true]);
  await execute(`const a = ${r}.pocketWorld.arena; ${r}.player.body.reset(Math.floor((a.x0 + a.x1) / 2) * 16 + 8, a.floorY * 16);`);
  await step(0.2);
  assert.equal(await evaluate(`${r}.portalHere()`), 'home');
  await execute(`void ${r}.travel('home');`);
  await waitFor(`!${r}.pocket && ${r}.ready && ${r}.sigils.includes('cleo')`);
  await quiet();
  await advanceTo(4); // the win moved the story on by itself, as soon as nothing else was on screen

  // ---- forge: step two counts what's left; once it's there, the weapon works ----
  await execute(`${r}.heroMenu.toggle(3);`);
  await waitFor(`${r}.heroMenu.open`);
  assert.equal(await evaluate(`${r}.heroMenu.panel.rows.find(row => row.label.includes('Step 3')).enabled`), false);
  await execute(`${r}.heroMenu.close(); ${r}.inventory.copper = 14; ${r}.heroMenu.toggle(3);`);
  await waitFor(`${r}.heroMenu.open`);
  const pearlBefore = await evaluate(`${r}.count('pearl')`);
  await execute(`${r}.heroMenu.panel.rows.find(row => row.label.includes('Step 3')).action();`);
  assert.deepEqual(await evaluate(`[${r}.forged.includes('cleo'), ${r}.weapon.name, ${r}.count('copper'), ${r}.count('pearl')]`), [true, 'The Asp Sceptre', 0, pearlBefore - 4]);
  await execute(`${r}.heroMenu.close();`);
  assert.equal(await evaluate(`${r}.swordDamage()`), 76); // 72, plus the Ember Heart's 4
  // ---- every hero's weapon passive does its own thing ----
  assert.deepEqual(await execute(`const s = ${r}; const fired = () => s.projectiles.length;
    const results = {};
    s.hero.combo = 5; s.burstCooldown = 0; let shock = 0; const orig = s.shockwave; s.shockwave = function () { shock++; };
    s.weaponEffect('comboBurst', 50, false, true); results.burst = shock === 1 && s.burstCooldown > 0;
    shock = 0; s.swingCount = 4; s.weaponEffect('everyFourthQuake', 50, false, false); results.quake = shock === 1;
    shock = 0; s.swingCount = 5; s.weaponEffect('everyFourthQuake', 50, false, false); results.notQuake = shock === 0;
    s.shockwave = orig;
    const f0 = fired(); s.weaponEffect('critFlame', 50, false, true); results.noCritNoFlame = fired() === f0;
    s.weaponEffect('critFlame', 50, true, true); results.flame = fired() === f0 + 1;
    const f1 = fired(); s.weaponEffect('lightBolt', 50, false, false); results.bolt = fired() === f1 + 1;
    s.hp = 10; s.weaponEffect('lifeSteal', 50, false, true); results.steal = s.hp === 13;
    results.forcedCrit = s.hero.strike(10, true).crit === true;
    return Object.values(results).every(Boolean);`), true);

  // ---- item builds through the menu: craft, wear, set bonus, break down ----
  await execute(`Object.assign(${r}.inventory, { copper: 60, gel: 30, ember: 20, feather: 20, wood: 40, stone: 40, herb: 40, iron: 40, bone: 40, pearl: 20 });
    ${r}.heroMenu.toggle(2);`);
  await waitFor(`${r}.heroMenu.open && ${r}.heroMenu.tab === 2`);
  const capBefore = await evaluate(`${r}.hero.stats.comboCap`);
  for (const name of ['Imperial Diadem', 'Tempo Band', "Duelist's Edge", 'Lifebloom']) {
    await execute(`const rows = ${r}.heroMenu.panel.rows; rows.find(row => row.label.includes(${JSON.stringify(name)})).action();`);
    await execute(`const rows = ${r}.heroMenu.panel.rows; rows.find(row => row.label.includes(${JSON.stringify(name)})).action();`);
  }
  const worn = await evaluate(`${r}.gear.equipped.cleo`);
  assert.deepEqual(worn, ['diadem', 'tempoBand', 'duelistEdge', 'lifebloom']);
  assert.ok(await evaluate(`${r}.hero.stats.comboCap`) >= capBefore + 0.25 + 0.1 + 0.4 - 1e-9, 'gear and the set bonus raise combo cap');
  assert.equal(await evaluate(`${r}.heroMenu.panel.host.view().subtitle.includes('SET COMPLETE')`), true);
  // a fifth doesn't fit, and it says why
  await execute(`const row = ${r}.heroMenu.panel.rows.find(row => row.label.includes('Warlord Plate')); row.action(); ${r}.heroMenu.panel.rows.find(x => x.label.includes('Warlord Plate')).action();`);
  assert.equal(await evaluate(`${r}.heroMenu.feedback.includes('full')`), true);
  // breaking one down takes it off and hands back its parts
  await execute(`${r}.heroMenu.panel.rows.find(row => row.label.includes('Imperial Diadem')).alt.action();`);
  assert.deepEqual(await evaluate(`[${r}.gear.items.diadem, ${r}.gear.equipped.cleo.includes('diadem'), ${r}.gear.components.metronome >= 1, ${r}.gear.components.lens >= 1]`), [0, false, true, true]);
  assert.ok(await evaluate(`${r}.hero.stats.comboCap`) < capBefore + 0.5, 'stats follow the gear');
  await execute(`${r}.heroMenu.close();`);

  // ---- all of it survives a reload ----
  await execute(`await ${r}.save();`);
  await open('Realm');
  await waitFor(`${r}?.ready`);
  await quiet();
  assert.deepEqual(await evaluate(`[${r}.forged, ${r}.sigils, ${r}.gear.equipped.cleo.length, ${r}.story.data.chapter, ${r}.story.data.choices.bell, ${r}.weapon.name]`),
    [['cleo'], ['cleo'], 3, 5, 'fight', 'The Asp Sceptre']);

  // ---- chapter six: Ms. Clio lends the relics and the gate opens on the spot ----
  await advanceTo(5);
  assert.deepEqual(await evaluate(`[${r}.relics.size, ${r}.tileAt(${r}.world.foreverGate.tx, ${r}.world.foreverGate.ty), ${r}.layer.getTileAt(${r}.world.foreverGate.tx, ${r}.world.foreverGate.ty).index]`), [4, 26, 26]);
  await execute(`const g = ${r}.world.foreverGate; ${r}.player.body.reset((g.tx + 1) * 16, (g.ty + 4) * 16 - 2);`);
  await step(0.2);
  assert.equal(await evaluate(`${r}.portalHere()`), 'forever');
  await execute(`void ${r}.travel('forever');`);
  await waitFor(`${r}.pocket === 'forever' && ${r}.ready`);
  await quiet();
  await execute(`const a = ${r}.pocketWorld.arena; ${r}.player.body.reset((a.x0 + 8) * 16, a.floorY * 16);`);
  await step(0.3);
  assert.equal(await evaluate(`${r}.boss?.def.id`), 'reaper');

  // ---- the finale asks one last question, and the answer is in the ending ----
  await execute(`${r}.boss.phase = 'drift'; ${r}.boss.hp = 1; ${r}.damageBoss(500);`);
  await execute(`await new Promise(res => ${r}.time.delayedCall(1850, res));`);
  await waitFor(`${r}.dialogue.open`);
  await finishDialogue(1); // leave the doors open
  await waitFor(`!!${r}.ending`);
  assert.deepEqual(await evaluate(`[${r}.story.data.choices.ending, ${r}.story.data.finished, ${r}.champion, ${r}.story.active, ${r}.ending.list.some(o => o.type === 'Text' && o.text.includes('took the lock off every door')), ${r}.ending.list.some(o => o.type === 'Text' && o.text.includes('UNMADE'))]`),
    ['stay', true, true, false, true, true]);
  await execute(`${r}.ending.destroy(); ${r}.ending = undefined; ${r}.endingReady = false;`);

  // ---- every nemesis fights properly, whichever hero you are ----
  for (const id of ['khan', 'joan', 'einstein', 'ada', 'suntzu', 'frida', 'leo']) {
    await open('Realm', { pocket: 'detention' });
    await waitFor(`${r}?.ready && ${r}.pocket === 'detention'`);
    await execute(`const { setHero, loadHeroSnapshot } = await import('/src/game/realm/progression.ts');
      await setHero('${id}'); ${r}.hero.refresh(await loadHeroSnapshot());`);
    await quiet();
    await execute(`${r}.player.body.reset(${r}.pocketWorld.arena.x0 * 16 + 120, ${r}.pocketWorld.arena.floorY * 16);`);
    await step(0.2);
    assert.equal(await evaluate(`${r}.boss?.def.id`), `nem_${id}`);
    // ten seconds of its whole move rotation, with no errors and nothing out of bounds
    await execute(`${r}.boss.timer = 0;`);
    await step(10);
    assert.equal(await execute(`const a = ${r}.pocketWorld.arena; const b = ${r}.boss.sprite; return ${r}.boss.data.step >= 2 && b.x >= (a.x0 - 1) * 16 && b.x <= (a.x1 + 1) * 16 && b.y <= (a.floorY + 2) * 16`), true);
    // a resting flyer drifts into reach of a jumping swing, and everything comes to you
    await execute(`const b = ${r}.boss; for (const h of [...${r}.hazards]) ${r}.removeHazard(h); b.sprite.clearTint(); b.sprite.setAlpha(1); b.phase = 'rest'; b.timer = 6000;`);
    await step(2.5);
    assert.deepEqual(await evaluate(`[Math.abs(${r}.boss.sprite.x - ${r}.player.x) < 200, ${r}.boss.def.flies ? ${r}.pocketWorld.arena.floorY * 16 - ${r}.boss.sprite.y < 130 : true]`), [true, true]);
    await execute(`${r}.boss.hp = 1; ${r}.damageBoss(500);`);
    await step(0.2);
    assert.equal(await evaluate(`${r}.sigils.includes('${id}') && ${r}.bossDefeated`), true);
    await execute(`await ${r}.save();`);
  }
  // back to the first hero, so the suites after this one start where they expect
  await execute(`const { setHero } = await import('/src/game/realm/progression.ts'); await setHero('cleo');`);
  console.log('PASS: Eternity High: lossless item builds and set bonuses, eight nemeses, weapon quest and passives, Story Mode title to ending with choices, harvest bubble, QUEST and BUILD menus, save and reload.');
}

// The fight itself: stamina, the chain, dodge, guard, parry, poise, telegraphed monsters, and the light that follows you.
export async function verifyCombat({ execute, evaluate, waitFor, scene }) {
  const r = scene('Realm');
  const open = async (data = {}) => {
    await execute(`for (const s of window.__game.scene.getScenes(true)) s.scene.stop();`);
    await waitFor(`window.__game.scene.getScenes(true).length === 0`);
    await execute(`const old = ${r}; if (old) old.ready = false; window.__game.scene.start('Realm', ${JSON.stringify(data)});`);
    await waitFor(`window.__game.scene.isActive('Realm') && ${r}.ready`);
    await execute(`${r}.trySpawn = () => {}; for (const e of [...${r}.enemies]) ${r}.despawn(e); ${r}.hero.stats.critChance = 0; ${r}.hero.stats.guardPips = 0; ${r}.hero.guard = 0; ${r}.spawnTimer = 1e9;
      const { REALM_ENEMIES } = await import('/src/game/realm/realmEnemies.ts'); window.__E = REALM_ENEMIES;
      window.__step = (n) => { const g = window.__game; g.loop.sleep(); window.__t = window.__t ?? performance.now(); for (let i = 0; i < n; i++) { window.__t += 1000 / 60; g.headlessStep(window.__t, 1000 / 60); } g.loop.wake(); };
      // a flat slab to fight on
      const s = ${r}; const ty = Math.floor(s.player.y / 16); const cx = Math.floor(s.player.x / 16);
      for (let x = cx - 24; x < cx + 24; x++) { for (let y = ty - 12; y < ty; y++) if (s.tileAt(x, y) !== 0 && s.tileAt(x, y) !== 23) s.setTile(x, y, 0); if (s.tileAt(x, ty) !== 23) s.setTile(x, ty, 3); }
      s.player.body.reset(cx * 16, ty * 16); window.__step(4);`);
  };
  await open({ newWorld: true });

  // ---- reach is the same either way, at every step of the chain, and matches the drawn blade ----
  assert.equal(await execute(`const s = ${r};
    const reach = (dir, chain) => { let best = 0; for (let d = 10; d < 150; d += 2) {
      const e = s.spawnEnemy(window.__E.crawler, s.player.x + dir * d, s.player.y); e.hp = 1e6; e.sprite.setPosition(s.player.x + dir * d, s.player.y); e.sprite.body.updateFromGameObject();
      s.facing = dir; s.swingTimer = 0; s.combat.chain = chain; s.keys.a.isDown = false; const before = e.hp; s.swing(); if (e.hp < before) best = d; s.despawn(e); s.dash.ms = 0; }
      return best; };
    for (let c = 0; c < 3; c++) if (reach(1, c) !== reach(-1, c) || reach(1, c) < 60) return 'chain step ' + c + ': ' + reach(1, c) + ' vs ' + reach(-1, c);
    return true;`), true);

  // ---- the chain: three swings, the third hits harder, then it starts over; a pause drops it ----
  assert.deepEqual(await execute(`const s = ${r}; const e = s.spawnEnemy(window.__E.knight, s.player.x + 20, s.player.y); e.hp = 1e6; e.poise = 1e6; s.facing = 1; s.combat.resetChain(); s.hero.combo = 0; s.hero.stats.comboCap = 0;
    const hit = () => { s.swingTimer = 0; const b = e.hp; s.swing(); s.dash.ms = 0; return b - e.hp; };
    const a = hit(), b = hit(), c = hit(), d = hit(); s.combat.tick(2000); const chainAfter = s.combat.chain; s.despawn(e);
    return [c > a * 1.4, d === a, b >= a, chainAfter];`), [true, true, true, 0]);

  // ---- stamina: swings spend it, it comes back, and an empty bar means a slow swing but never no swing ----
  assert.deepEqual(await execute(`const s = ${r}; const c = s.combat; c.stamina = 100; s.swingTimer = 0; s.swing(); s.dash.ms = 0; const spent = c.stamina; c.tick(300); const held = c.stamina; c.tick(1000); const back = c.stamina;
    c.stamina = 0; c.resetChain(); s.swingTimer = 0; s.swing(); s.dash.ms = 0; const slow = s.swingTimer; const canRoll = c.canDodge(true); c.stamina = 100; c.dodgeCooldown = 0;
    return [spent, held === spent, back > spent, slow > 320, canRoll];`), [88, true, true, true, false]);

  // ---- dodge: a double-tap only; i-frames; a blow through it is a perfect dodge, and the next hit is stronger ----
  assert.deepEqual(await execute(`const s = ${r}; const c = s.combat; const now = 1e6;
    const single = c.tapped(1, now), wrong = c.tapped(-1, now + 50), slowTap = c.tapped(-1, now + 500), good = c.tapped(-1, now + 720);
    s.swingTimer = 200; s.invuln = 0; s.hp = 100; c.stamina = 100; c.dodgeCooldown = 0; s.dodge(1, true);
    const e = s.spawnEnemy(window.__E.crawler, s.player.x + 30, s.player.y);
    const iframes = s.invuln > 0; s.hurtPlayer(10, e.sprite.x, { enemy: e }); const unhurt = s.hp === 100; const bonus = c.perfectBonus > 0; const stam = c.stamina;
    s.despawn(e);
    return [single, wrong, slowTap, good, iframes, unhurt, bonus, stam > 80, s.swingTimer];`), [false, false, false, true, true, true, true, true, 0]);
  await execute(`window.__step(40); const s = ${r}; s.invuln = 0; s.combat.perfectBonus = 0; s.combat.stamina = 100; s.combat.lowerGuard();`);

  // ---- guard: a tap is a parry (no damage, it reels, a riposte is 2.5x); holding blocks for stamina; behind you isn't blocked ----
  assert.deepEqual(await execute(`const s = ${r}; const c = s.combat; s.hp = 100; s.facing = 1; c.stamina = 100; s.invuln = 0;
    const e = s.spawnEnemy(window.__E.knight, s.player.x + 26, s.player.y); e.hp = 1e5; e.sprite.setFlipX(true);
    c.raiseGuard(); s.hurtPlayer(20, e.sprite.x, { enemy: e }); const parried = [s.hp, e.stagger > 0, e.riposte];
    s.invuln = 0; c.lowerGuard(); s.swingTimer = 0; c.resetChain(); s.hero.combo = 0; const plain = s.hero.strike(s.swordDamage()).damage; const b = e.hp; s.swing(); s.dash.ms = 0; const riposte = b - e.hp; const spent = e.riposte;
    s.despawn(e); return [...parried, riposte >= plain * 2.4, spent];`), [100, true, true, true, false]);
  assert.deepEqual(await execute(`const s = ${r}; const c = s.combat; const e = s.spawnEnemy(window.__E.knight, s.player.x + 26, s.player.y); s.hp = 100; s.facing = 1; c.stamina = 100; s.invuln = 0;
    c.raiseGuard(); c.parryTimer = 0; s.hurtPlayer(20, e.sprite.x, { enemy: e }); const blocked = [s.hp, c.stamina < 100, c.guarding];
    s.invuln = 0; s.hp = 100; s.hurtPlayer(20, s.player.x - 40, { enemy: e }); const behind = s.hp;
    // run the bar out and the guard breaks, and you're open
    s.invuln = 0; s.hp = 100; c.stamina = 5; c.guarding = true; c.parryTimer = 0; s.hurtPlayer(20, e.sprite.x, { enemy: e }); const broke = [s.hp, c.guarding, c.stun > 0];
    c.stun = 0; c.stamina = 100; s.invuln = 0; s.despawn(e);
    return [...blocked, behind, ...broke];`), [97, true, true, 80, 88, false, true]);
  // a world hazard (lava, traps) can't be blocked
  assert.equal(await execute(`const s = ${r}; const c = s.combat; c.raiseGuard(); s.hp = 100; s.invuln = 0; s.hurtPlayer(20, s.player.x + 10); c.lowerGuard(); s.invuln = 0; const hp = s.hp; s.hp = 100; return hp;`), 80);
  // a parried shot goes back
  assert.deepEqual(await execute(`const s = ${r}; const c = s.combat; s.facing = 1; c.stamina = 100; s.invuln = 0; c.parryTimer = 0; c.dodgeCooldown = 0; c.tick(1000);
    s.spawnHazard({ x: s.player.x + 200, y: s.player.y - 20, texture: 'fx_soul', vx: 0, vy: 0, damage: 12, lifespanMs: 5000 });
    const h = s.hazards[s.hazards.length - 1]; const shots = s.projectiles.length; c.raiseGuard(); s.hp = 100; s.hurtPlayer(9, h.sprite.x, { hazard: h }); const out = [s.hp, s.hazards.includes(h), s.projectiles.length === shots + 1]; c.lowerGuard(); s.invuln = 0; return out;`), [100, false, true]);

  // ---- poise: blows pile up to a stagger; a staggered target takes more ----
  assert.deepEqual(await execute(`const s = ${r}; const e = s.spawnEnemy(window.__E.crawler, s.player.x + 20, s.player.y); e.hp = 1e5; const first = e.poise; s.hurtEnemy(e, 1, 1, false, 12); const held = e.stagger; s.hurtEnemy(e, 1, 1, false, 30); const reeling = e.stagger > 0; const scale = s.openingScale(e.sprite, e.stagger > 0, false); s.despawn(e);
    return [first > 12, held, reeling, scale];`), [true, 0, true, 1.3]);

  // ---- a monster warns before it strikes, and touching it otherwise is harmless ----
  const fight = await execute(`const s = ${r}; s.invuln = 0; s.hp = s.maxHp; s.facing = 1; const start = s.hp; s.keys.a.isDown = false;
    const e = s.spawnEnemy(window.__E.crawler, s.player.x + 10, s.player.y); e.hp = 1e5; e.timer = 0; e.cooldown = 1e6; e.sprite.setPosition(s.player.x + 10, s.player.y); e.sprite.body.updateFromGameObject();
    window.__step(30); const touching = s.hp === start && e.phase === 'none';
    e.cooldown = 0; e.timer = 0; const seen = []; let hurtPhase = null;
    for (let i = 0; i < 90; i++) { window.__step(1); if (!seen.includes(e.phase)) seen.push(e.phase); if (s.hp < start && !hurtPhase) hurtPhase = e.phase; e.sprite.setPosition(Math.abs(e.sprite.x - s.player.x) > 40 ? s.player.x + 10 : e.sprite.x, e.sprite.y); }
    const lost = start - s.hp; s.despawn(e); s.hp = s.maxHp; s.invuln = 0; return { touching, seen, hurtPhase, lost, dmg: window.__E.crawler.damage };`);
  assert.deepEqual([fight.touching, fight.seen.filter(x => x !== 'none').slice(0, 3), fight.hurtPhase], [true, ['windup', 'strike', 'recover'], 'strike']);
  assert.ok(fight.lost <= fight.dmg && fight.dmg <= 10, 'one strike, softer than it used to be: ' + JSON.stringify(fight));

  // ---- a boss's poise breaks too, and it stands still for it ----
  await open({ pocket: 'detention' });
  await execute(`const s = ${r}; s.invuln = 1e9; s.player.body.reset(s.pocketWorld.arena.x0 * 16 + 120, s.pocketWorld.arena.floorY * 16); window.__step(10);`);
  assert.deepEqual(await execute(`const s = ${r}; const b = s.boss; const before = b.data.stagger ?? 0; s.breakBossPoise(b, b.def.hp); const on = b.data.stagger > 0; const x = b.sprite.x; window.__step(20); const still = Math.abs(b.sprite.x - x) < 2; s.boss.data.stagger = 0;
    return [before, on, still];`), [0, true, true]);

  // ---- the Ember Realm: the dark opens around you, wherever you stand, and every light really draws ----
  await open({ pocket: 'ember' });
  const light = await execute(`const s = ${r}; const g = window.__game; s.invuln = 1e9; const cam = s.cameras.main;
    const sample = () => { g.loop.sleep(); window.__t += 1000 / 60; g.headlessStep(window.__t, 1000 / 60); s.lightScanTimer = 0; window.__t += 1000 / 60; g.headlessStep(window.__t, 1000 / 60);
      const c = document.createElement('canvas'); c.width = g.canvas.width; c.height = g.canvas.height; const x = c.getContext('2d'); x.drawImage(g.canvas, 0, 0); g.loop.wake();
      const k = g.canvas.width / g.scale.width; const px = (wx, wy) => { const d = x.getImageData((wx - cam.worldView.x) * k, (wy - cam.worldView.y) * k, 1, 1).data; return d[0] + d[1] + d[2]; };
      return px; };
    // only the hero's own light in the test: no lava about
    const w = s.world; for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === 15) s.setTile(i % w.w, Math.floor(i / w.w), 13);
    const out = [];
    for (const tx of [30, 60]) {
      s.player.body.reset(tx * 16, s.world.surface[tx] * 16); window.__step(30);
      const floor = s.world.surface[tx] * 16 + 10;
      const px = sample(); out.push([px(s.player.x + 40, floor), px(s.player.x + 250, floor)]);
    }
    return out;`);
  for (const [near, far] of light) assert.ok(near > far * 1.5, 'the ground by the hero is lit and the ground far off is not: ' + JSON.stringify(light));
  console.log('PASS: combat: mirrored reach, chain, stamina, dodge and perfect dodge, parry and riposte, block and guard break, reflected shots, poise and stagger, telegraphed monsters, boss stagger, light follows the hero.');
}

// Real touch events on a phone-shaped screen: a thumb on a direction while the other presses jump and attack.
export async function verifyTouch({ page, execute, evaluate, waitFor, scene, gameUrl, pause }) {
  const r = scene('Realm');
  await page.call('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36', platform: 'Android' });
  await page.call('Emulation.setDeviceMetricsOverride', { width: 1212, height: 540, deviceScaleFactor: 2, mobile: true });
  await page.call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await page.call('Page.navigate', { url: gameUrl });
  await waitFor('!!window.__game?.scene.isActive("Title")');
  assert.deepEqual(await evaluate(`[window.__game.scale.width, window.__game.scale.height, window.__game.device.os.desktop]`), [1212, 540, false]);
  await execute(`for (const s of window.__game.scene.getScenes(true)) s.scene.stop();`);
  await waitFor(`window.__game.scene.getScenes(true).length === 0`);
  await execute(`window.__game.scene.start('Realm', { newWorld: true });`);
  await waitFor(`${r}?.ready`);
  await execute(`${r}.trySpawn = () => {};`);
  const rect = await evaluate(`(() => { const c = window.__game.canvas.getBoundingClientRect(); return { x: c.x, y: c.y, w: c.width, h: c.height }; })()`);
  const pt = (id, x, y) => ({ id, x: rect.x + (x / 1212) * rect.w, y: rect.y + (y / 540) * rect.h });
  const touch = (type, touchPoints) => page.call('Input.dispatchTouchEvent', { type, touchPoints });
  const zones = await evaluate(`${r}.touchZones.map(z => ({ x: z.x, y: z.y }))`);
  const [left, right, jump, attack] = zones;

  await pause(200);
  // hold ▶
  await touch('touchStart', [pt(0, right.x, right.y)]);
  await pause(200);
  assert.equal(await evaluate(`${r}.touch.right`), true);
  const vx = await evaluate(`${r}.player.body.velocity.x`);
  assert.ok(vx > 0, `moving right, vx ${vx}`);
  // ...and press jump and attack with it still held
  const swingsBefore = await evaluate(`${r}.swingTimer`);
  await execute(`window.__sawJump = false; window.__sawSwing = false; const s = ${r}; const orig = s.swing.bind(s);
    s.swing = () => { window.__sawSwing = true; orig(); };`);
  await touch('touchStart', [pt(0, right.x, right.y), pt(1, jump.x, jump.y), pt(2, attack.x, attack.y)]);
  await pause(100);
  assert.deepEqual(await evaluate(`[${r}.touch.right, ${r}.touch.jump, ${r}.touch.attack, window.__sawSwing, ${r}.player.body.velocity.y < 0 || !${r}.player.body.blocked.down, ${r}.player.body.velocity.x > 0]`),
    [true, true, true, true, true, true]);
  assert.equal(swingsBefore, 0);
  // the jump thumb lifts: the direction and the attack stay held
  await touch('touchEnd', [pt(1, jump.x, jump.y)]); // CDP: the points listed are the ones released
  await pause(80);
  assert.deepEqual(await evaluate(`[${r}.touch.right, ${r}.touch.jump, ${r}.touch.attack]`), [true, false, true]);
  // a thumb slides from ▶ to ◀ without lifting
  await touch('touchMove', [pt(0, left.x, left.y), pt(2, attack.x, attack.y)]);
  await pause(80);
  assert.deepEqual(await evaluate(`[${r}.touch.left, ${r}.touch.right]`), [true, false]);
  // tapping a button never mines the world underneath it
  assert.equal(await evaluate(`${r}.pointerUse`), false);
  await touch('touchEnd', []);
  await pause(80);
  assert.deepEqual(await evaluate(`[${r}.touch.left, ${r}.touch.right, ${r}.touch.jump, ${r}.touch.attack]`), [false, false, false, false]);

  // a double-tap of a direction is a dodge; a single tap isn't. 🛡 is its own thumb: tap parries, hold guards, while moving
  const guardZone = zones[5];
  await execute(`${r}.combat.stamina = 100; ${r}.invuln = 0;`);
  await touch('touchStart', [pt(0, right.x, right.y)]); await pause(70); await touch('touchEnd', [pt(0, right.x, right.y)]); await pause(600);
  assert.equal(await evaluate(`${r}.dash.ms <= 0 && ${r}.combat.stamina`), 100);
  await execute(`window.__rolled = 0; const s = ${r}; const o = s.dodge.bind(s); s.dodge = (d, g) => { window.__rolled = d; o(d, g); };`);
  await touch('touchStart', [pt(0, left.x, left.y)]); await pause(70); await touch('touchEnd', [pt(0, left.x, left.y)]); await pause(60);
  await touch('touchStart', [pt(0, left.x, left.y)]); await pause(90);
  assert.equal(await evaluate(`window.__rolled`), -1);
  await touch('touchEnd', [pt(0, left.x, left.y)]); await pause(500);
  await touch('touchStart', [pt(0, guardZone.x, guardZone.y)]); await pause(90);
  assert.deepEqual(await evaluate(`[${r}.touch.guard, ${r}.combat.guarding]`), [true, true]);
  await touch('touchStart', [pt(0, guardZone.x, guardZone.y), pt(1, right.x, right.y)]); await pause(120);
  assert.deepEqual(await evaluate(`[${r}.combat.guarding, ${r}.touch.right]`), [true, true]);
  await touch('touchEnd', []); await pause(120);
  assert.equal(await evaluate(`${r}.combat.guarding`), false);

  // the USE button mines the nearest harvest with no aiming at all
  const w = await execute(`const s = ${r}; const b = s.player.body; const tx = Math.floor(s.player.x / 16) + 2; const ty = Math.floor((s.player.y - 20) / 16);
    s.setTile(tx, ty, 5); s.slot = 0; s.harvestTimer = 0; s.updateHarvestHelp(16); return { tx, ty, harvest: s.harvestTile };`);
  assert.deepEqual(w.harvest, { tx: w.tx, ty: w.ty });
  const useZone = zones[4];
  await touch('touchStart', [pt(0, useZone.x, useZone.y)]);
  await waitFor(`${r}.tileAt(${w.tx}, ${w.ty}) === 0`);
  await touch('touchEnd', []);
  assert.deepEqual(await evaluate(`[${r}.tileAt(${w.tx}, ${w.ty}), ${r}.count('copper') >= 1]`), [0, true]);

  // every menu fits a wide screen, and a tap outside the card closes it
  await execute(`${r}.toggleHeroMenu();`);
  await waitFor(`${r}.heroMenu.open`);
  assert.equal(await evaluate(`${r}.heroMenu.panel.panel.x`), 606);
  await touch('touchStart', [pt(0, 6, 270)]);
  await touch('touchEnd', []);
  await waitFor(`!${r}.heroMenu.open`);
  await page.call('Emulation.setUserAgentOverride', { userAgent: '' }).catch(() => {});
  await page.call('Emulation.setTouchEmulationEnabled', { enabled: false });
  console.log('PASS: touch: direction + jump + attack together, thumbs lift and slide independently, double-tap dodge, guard thumb, USE mines with no aiming, menus centred, tap outside closes.');
}

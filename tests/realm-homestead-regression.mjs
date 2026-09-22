import assert from 'node:assert/strict';

export async function verifyHomestead({ execute, evaluate, waitFor, scene, key, tap, screenshot }) {
  const r = scene('Realm');
  const step = async (seconds = 0.1, body = '') => execute(`const g = window.__game; const s = ${r}; g.loop.sleep();
    let t = window.__homeClock ?? performance.now();
    try { for (let f = 0; f < ${seconds} * 60; f++) { t += 1000/60; g.headlessStep(t, 1000/60); ${body} } }
    finally { window.__homeClock = t; g.loop.wake(); }`);
  const restart = async (code) => {
    await execute(`window.__oldHomeWorld = ${r}.world; ${code}`);
    await waitFor(`${r}.ready && ${r}.world !== window.__oldHomeWorld`);
  };
  await restart(`if (window.__game.scene.isActive('Realm')) ${r}.scene.restart({ newWorld: true });
    else { for (const s of window.__game.scene.getScenes(true)) s.scene.stop(); window.__game.scene.start('Realm', { newWorld: true }); }`);
  await execute(`window.__pads = [{ index: 0, connected: true, mapping: 'standard', id: 'Xbox', axes: [0,0,0,0], buttons: Array.from({length:17}, () => ({pressed:false,value:0})) }];
    Object.defineProperty(navigator, 'getGamepads', {configurable:true, value: () => window.__pads});
    window.__homeButton = (n, down) => { window.__pads[0].buttons[n].pressed = down; window.__pads[0].buttons[n].value = down ? 1 : 0; };
    const s = ${r}; s.spawnTimer = 1e9;
    window.__homeX = Math.floor(s.player.x / 16) - 5; window.__homeY = Math.floor(s.player.y / 16) - 1;
    const x = window.__homeX, y = window.__homeY;
    for (let dx = -5; dx < 23; dx++) for (let dy = -8; dy <= 1; dy++) s.setTile(x+dx, y+dy, dy === 1 ? 3 : 0);
    s.player.body.reset((x+3)*16, (y+1)*16);
    s.inventory = {wood:100, stone:100, copper:20, gel:20, potion:4};`);
  const press = async n => { await execute(`window.__homeButton(${n}, true);`); await step(); await execute(`window.__homeButton(${n}, false);`); await step(); };
  // Real browser keyboard and touch events, including pointer shielding while a modal is open.
  if (key && tap) {
    await key(72, 'h');
    assert.equal(await evaluate(`${r}.homestead.open`), true);
    await key(27, 'Escape');
    assert.equal(await evaluate(`${r}.homestead.open`), false);
    await tap(908, 108);
    assert.equal(await evaluate(`${r}.homestead.open`), true);
    await tap(480, 160); // select the bed by touch
    assert.deepEqual(await evaluate(`[${r}.homestead.placing,${r}.homestead.open,${r}.pointerUse]`), [true,false,false]);
    await key(72, 'h');
    assert.equal(await evaluate(`${r}.homestead.placing`), false);
    await key(69, 'e');
    await tap(480, 84); // the existing crafting panel must also hit-test after camera scrolling
    assert.deepEqual(await evaluate(`[${r}.count('torch'),${r}.count('wood'),${r}.count('gel')]`), [4,99,19]);
    await key(69, 'e');
    await execute(`${r}.inventory={wood:100,stone:100,copper:20,gel:20,potion:4};`);
  }
  // Opening and closing by controller freezes both physics and the world clock.
  await press(6);
  assert.deepEqual(await evaluate(`[${r}.homestead.open, ${r}.physics.world.isPaused]`), [true, true]);
  const clock = await evaluate(`${r}.clock`);
  await step(1);
  assert.equal(await evaluate(`${r}.clock`), clock);
  if (screenshot) await screenshot('homestead-build');
  await press(1);
  assert.deepEqual(await evaluate(`[${r}.homestead.open, ${r}.physics.world.isPaused]`), [false, false]);

  // Cancel is free; invalid terrain costs nothing; valid placement is charged exactly once.
  assert.deepEqual(await execute(`const s=${r}, h=s.homestead; h.prepare('bed'); h.cancelPlacement(); const n=s.count('wood');
    h.prepare('bed'); h.aim(window.__homeX, window.__homeY - 7); const invalid=h.place();
    h.aim(window.__homeX, window.__homeY); const valid=h.place();
    return [n, invalid, valid, h.place(), s.count('wood'), s.count('gel'), h.data.furniture.length];`), [100, false, true, false, 88, 16, 1]);
  // A furnishing reserves headroom and its support. It cannot be buried or undermined.
  assert.deepEqual(await execute(`const s=${r}, h=s.homestead, x=window.__homeX, y=window.__homeY;
    const before=s.tileAt(x,y+1); s.breakTile(x,y+1);
    return [s.placeTile(x,y-1,'stone'), s.tileAt(x,y+1)===before];`), [false,true]);

  // Chest + fire: actual tool placement path for the chest, then check persistent light and healing.
  assert.deepEqual(await execute(`const s=${r}, h=s.homestead, x=window.__homeX, y=window.__homeY;
    s.player.body.reset((x+5)*16,(y+1)*16); h.prepare('chest'); s.aim={tx:x+5,ty:y}; s.useTool(true,true,16);
    h.prepare('campfire'); h.aim(x+8,y); const fire=h.place();
    return [h.data.furniture.map(f=>f.kind),fire,h.lights().length,h.warmth()];`), [['bed','chest','campfire'],true,1,true]);
  await execute(`const s=${r}; s.hp=40; s.sinceHit=99999;`);
  await step(1);
  assert.ok(await evaluate(`${r}.hp >= 45.9`), 'campfire supplies additional regeneration');

  // Interact by D-pad, enter the storage view, transfer a stack by X.
  await press(13);
  assert.equal(await evaluate(`${r}.homestead.open`), true);
  await press(0);
  assert.equal(await evaluate(`${r}.homestead.mode`), 'deposit');
  await press(13); // first pack item (stone)
  await press(2);
  assert.deepEqual(await evaluate(`[${r}.homestead.target.stock.stone, ${r}.count('stone')]`), [92,0]);
  if (screenshot) await screenshot('homestead-storage');
  // Filled chests cannot be packed; quick-stack, withdrawals and slot capacity conserve items.
  assert.deepEqual(await execute(`const s=${r}, h=s.homestead, chest=h.target;
    h.packFurniture(chest); const protectedChest=h.data.furniture.includes(chest);
    h.mode='withdraw'; h.transfer('stone',true);
    const returned=s.count('stone'); h.mode='deposit'; h.transfer('wood',true);
    s.inventory.wood=5; h.mode='furniture'; h.render(); h.rows[2].action();
    return [protectedChest,returned,chest.stock.wood,s.count('wood')];`), [true,92,81,0]);
  assert.deepEqual(await execute(`const {transferStock,CHEST_SLOTS}=await import('/src/game/realm/homestead.ts');
    const {ITEM_NAME}=await import('/src/game/realm/items.ts'); const ids=Object.keys(ITEM_NAME), to={};
    ids.slice(0,CHEST_SLOTS).forEach(id=>to[id]=1); const from={[ids[0]]:9,[ids[12]]:4};
    return [transferStock(from,to,ids[12],Infinity,CHEST_SLOTS),transferStock(from,to,ids[0],Infinity,CHEST_SLOTS),from[ids[12]],to[ids[0]],transferStock(from,to,ids[12],-1,CHEST_SLOTS)];`), [0,9,4,10,0]);
  await execute(`${r}.homestead.close();`);

  // Claim a bed; exposed beds don't heal/skip time. A roof makes resting available.
  await execute(`const s=${r}; s.player.body.reset((window.__homeX+1.5)*16,(window.__homeY+1)*16); s.hp=30; s.clock=280000; s.sinceHit=0;`);
  await press(13);
  await press(0);
  assert.equal(await evaluate(`${r}.homestead.data.homeId`), 1);
  assert.deepEqual(await execute(`const s=${r}, h=s.homestead; const hp=s.hp; const clock=s.clock; h.rest(h.home); return [s.hp===hp,s.clock===clock,h.open,h.feedback.includes('roof')];`), [true,true,true,true]);
  await execute(`const s=${r}; for(let dx=0;dx<3;dx++) s.setTile(window.__homeX+dx,window.__homeY-4,4); s.homestead.render();`);
  if (screenshot) await screenshot('homestead-bed');
  assert.deepEqual(await execute(`const s=${r}, h=s.homestead;
    s.spawnEnemy((await import('/src/game/realm/realmEnemies.ts')).REALM_ENEMIES.slime,s.player.x+50,s.player.y);
    const hp=s.hp; h.rest(h.home); const blocked=h.open && s.hp===hp;
    for(const e of [...s.enemies]) s.despawn(e); h.rest(h.home);
    return [blocked,s.hp===s.maxHp,s.clock%360000,h.open];`), [true,true,36000,false]);

  // Die far from home; the saved X and Y and live respawn both point to the bed.
  assert.deepEqual(await execute(`const s=${r}; s.player.body.reset(s.player.x+400,s.player.y); s.die(); await s.save();
    const {loadRealm}=await import('/src/game/realm/realmSave.ts'); const save=await loadRealm();
    s.respawn(); return [save.player.x===save.spawn.x,save.player.y===save.spawn.y,s.player.x===save.spawn.x,s.player.y===save.spawn.y];`), [true,true,true,true]);
  await execute(`await ${r}.save();`);
  await restart(`${r}.scene.restart();`);
  assert.deepEqual(await evaluate(`[${r}.homestead.data.furniture.length,${r}.homestead.home.id,${r}.homestead.data.furniture.find(f=>f.kind==='chest').stock.wood]`), [3,1,81]);
  // Portal saving preserves the overworld's furniture and chest contents.
  await restart(`${r}.scene.restart({pocket:'ember',seed:777});`);
  assert.equal(await evaluate(`!!${r}.homestead`), false);
  await execute(`${r}.inventory.ember=7; await ${r}.save();`);
  await restart(`${r}.scene.restart({});`);
  assert.deepEqual(await evaluate(`[${r}.count('ember'),${r}.homestead.data.furniture.length,${r}.homestead.home.id,${r}.homestead.data.furniture.find(f=>f.kind==='chest').stock.wood]`), [7,3,1,81]);
  // Packing an active bed clears the home and refunds a kit; replacement uses that kit.
  assert.deepEqual(await execute(`const s=${r},h=s.homestead,bed=h.home; h.packFurniture(bed);
    const cleared=!h.home && s.spawnPoint.x===s.world.spawn.tx*16+8;
    s.player.body.reset((bed.tx+1.5)*16,(bed.ty+1)*16); h.prepare('bed'); h.aim(bed.tx,bed.ty);
    const placed=h.place(); return [cleared,placed,s.count('bed'),s.count('wood')];`), [true,true,0,0]);
  // Legacy saves have no homestead; invalid furniture can't leave a phantom home.
  assert.deepEqual(await execute(`const {restoreHomestead}=await import('/src/game/realm/homestead.ts');
    const old=restoreHomestead(undefined,()=>0);
    const invalid=restoreHomestead({homeId:1,furniture:[{id:1,kind:'bed',tx:1,ty:1,stock:{}}]},()=>0);
    return [old.furniture.length,invalid.furniture.length,invalid.homeId===undefined];`), [0,0,true]);
  // Starting a new world from an open panel discards furniture and resumes physics.
  await execute(`${r}.homestead.toggle();`);
  await restart(`${r}.scene.restart({newWorld:true});`);
  assert.deepEqual(await evaluate(`[${r}.homestead.data.furniture.length,${r}.homestead.open,${r}.physics.world.isPaused,${r}.count('wood')]`), [0,false,false,0]);
  await execute(`window.__pads=[];`);
  console.log('PASS: Homestead: pad menus, paused clock, placement/cost/cancel, terrain protection, campfire healing/light, chest transfers/capacity, safe sheltered rest, home respawn, save/reload, portal persistence, packing/reuse.');
}

import assert from 'node:assert/strict';

export async function verifyFoundry({ execute, evaluate, waitFor, scene, key, tap, screenshot }) {
  const r = scene('Realm');
  const step = async (seconds = 0.1, body = '') => {
    let stopped = false;
    for (let left = seconds; left > 0 && !stopped; left -= 2) stopped = await execute(`const g=window.__game,s=${r}; g.loop.sleep();
      let t=window.__foundryClock??performance.now(),stop=false;
      try {for(let f=0;f<${Math.min(2, left)}*60&&!stop;f++){t+=1000/60;g.headlessStep(t,1000/60);stop=!!(()=>{${body}})();}}
      finally{window.__foundryClock=t;if(window.__foundryManual){g.renderer.preRender();g.scene.render(g.renderer);g.renderer.postRender();}else g.loop.wake();} return stop;`);
    return stopped;
  };
  const restart = async code => {
    await execute(`window.__oldFoundryWorld=${r}.world; ${code}`);
    await waitFor(`${r}.ready && ${r}.world!==window.__oldFoundryWorld`);
  };
  await restart(`if(window.__game.scene.isActive('Realm')) ${r}.scene.restart({newWorld:true});
    else {for(const s of window.__game.scene.getScenes(true))s.scene.stop();window.__game.scene.start('Realm',{newWorld:true});}`);
  await execute(`window.__pads=[{index:0,connected:true,mapping:'standard',id:'Xbox',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))}];
    Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>window.__pads});
    window.__foundryBtn=(i,on)=>{window.__pads[0].buttons[i].pressed=on;window.__pads[0].buttons[i].value=on?1:0;};
    ${r}.spawnTimer=1e9;`);
  const press = async i => { await execute(`window.__foundryBtn(${i},true);`); await step(); await execute(`window.__foundryBtn(${i},false);`); await step(); };
  // An entrance is added without changing a single old-world tile; old saves get defaults.
  assert.deepEqual(await execute(`const s=${r}; const {generateWorld}=await import('/src/game/realm/worldGen.ts');
    const {expeditionProgress,findFoundryEntrance}=await import('/src/game/realm/expeditions.ts');
    const before=generateWorld(s.world.seed),e=s.expedition.entrance;
    return [before.tiles.every((n,i)=>n===s.world.tiles[i]),e.tx<s.world.spawn.tx-50,s.edits.size,s.expedition.progress.discovered,expeditionProgress().lantern];`), [true,true,0,false,false]);
  // Real journal keyboard, gamepad R3, and touch controls while the camera is scrolled.
  await key(78,'n');
  assert.deepEqual(await evaluate(`[${r}.expedition.open,${r}.physics.world.isPaused]`), [true,true]);
  const oldClock = await evaluate(`${r}.clock`); await step(1);
  assert.equal(await evaluate(`${r}.clock`), oldClock);
  if (screenshot) await screenshot('foundry-journal');
  await tap(480,470);
  assert.equal(await evaluate(`${r}.expedition.open`), false);
  await press(11); assert.equal(await evaluate(`${r}.expedition.open`), true);
  await press(1); assert.equal(await evaluate(`${r}.expedition.open`), false);
  // Discovery, map visibility and persistence.
  await execute(`const s=${r},e=s.expedition.entrance;s.player.body.reset((e.tx+1.5)*16,(e.ty+1)*16);`);
  await step(0.3);
  assert.deepEqual(await evaluate(`[${r}.expedition.progress.discovered,${r}.foundryMapMark.visible,${r}.portalHere()]`), [true,true,'foundry']);
  await press(8); assert.equal(await evaluate(`${r}.foundryMapMark.visible`), false);
  await press(8);
  await execute(`const s=${r};s.sword=1;s.inventory.potion=6;await s.save();`);
  await restart(`${r}.scene.restart();`);
  assert.equal(await evaluate(`${r}.expedition.progress.discovered`), true);
  await press(13);
  await waitFor(`${r}.ready && ${r}.pocket==='foundry'`);
  assert.deepEqual(await evaluate(`[${r}.expedition.progress.attempts,${r}.world.stations.length,${r}.world.caches.length,${r}.world.traps.length,${r}.hazardHere(),${r}.relics.size]`), [1,3,3,9,null,0]);
  // Fixed-seed generations remain deterministic and all seals reach the ceiling.
  assert.deepEqual(await execute(`const {generateFoundry}=await import('/src/game/realm/foundryGen.ts');const {T}=await import('/src/game/realm/tiles.ts');
    const worlds=[1,777,98765].map(generateFoundry);return worlds.map(w=>{const again=generateFoundry(w.seed);return w.stations.every(s=>[29,40,49].every(y=>w.tiles[y*w.w+s.gate]===T.FOUNDRY_GATE)) && w.tiles.every((t,i)=>t===again.tiles[i]);});`), [true,true,true]);
  // Trap telegraphs don't hurt; active machinery does. Touching an empty cache twice pays once.
  assert.deepEqual(await execute(`const s=${r},e=s.expedition,t=s.world.traps[0];
    s.player.body.reset((t.tx+1)*16,(t.ty+1)*16);s.invuln=0;s.hp=100;
    e.trapClock=4000-t.offset;e.drawTraps();const safe=s.hp===100;
    e.trapClock=5000-t.offset;e.drawTraps();const hit=s.hp===88;
    const c=s.world.caches[0];s.player.body.reset((c.tx+.5)*16,(c.ty+1)*16);
    const n=s.count('copper');e.interact();e.interact();
    return [safe,hit,s.count('copper')-n,e.caches.size,e.progress.cachesOpened];`), [true,true,10,1,1]);

  // Restart this expedition with a pinned seed for physical route proofs (no terrain edits).
  await restart(`${r}.scene.restart({pocket:'foundry',seed:777});`);
  await execute(`${r}.invuln=1e9; ${r}.spawnTimer=1e9; window.__foundryManual=true;window.__game.loop.sleep();`);
  // Jump to all three optional caches via their stairs using the actual player controller.
  for (let cacheIndex=0; cacheIndex<3; cacheIndex++) {
    await execute(`const s=${r},c=s.world.caches[${cacheIndex}],branch=c.tx-33;
      s.player.body.reset((branch-4)*16,50*16);window.__pads[0].axes[0]=0;window.__foundryBtn(0,false);`);
    await step(0.2);
    for (let level=0;level<4;level++) {
      await execute(`const c=${r}.world.caches[${cacheIndex}];window.__targetX=(c.tx-33+${level}*6+1.5)*16;window.__targetY=(50-3*(${level}+1))*16;window.__foundryBtn(0,true);`);
      const reached = await step(3, `const p=s.player,b=p.body; const dx=window.__targetX-p.x; window.__pads[0].axes[0]=Math.abs(dx)<4?0:Math.sign(dx);
        const done=b.blocked.down && Math.abs(p.y-window.__targetY)<3 && Math.abs(dx)<20;
        if(done){window.__pads[0].axes[0]=0;window.__foundryBtn(0,false);}return done;`);
      assert.ok(reached, `cache ${cacheIndex} platform ${level}: ${await evaluate(`JSON.stringify({x:${r}.player.x,y:${r}.player.y,tx:window.__targetX,ty:window.__targetY})`)}`);
      await execute(`window.__pads[0].axes[0]=0;window.__foundryBtn(0,false);`); await step(0.08);
    }
    await execute(`window.__galleryTrace=[];window.__pads[0].axes[0]=1;window.__foundryBtn(0,true);`);
    const gallery=await step(3,`if(f%12===0)window.__galleryTrace.push([s.player.x,s.player.y,s.player.body.blocked.down,s.expedition.prompt()]);if(s.expedition.prompt().includes('open')){s.expedition.interact();window.__pads[0].axes[0]=0;return true;}`);
    if (!gallery && screenshot) await screenshot('foundry-gallery-debug');
    assert.ok(gallery, `cache ${cacheIndex} gallery reachable: ${await evaluate(`JSON.stringify(window.__galleryTrace)`)}`);
  }
  assert.equal(await evaluate(`${r}.expedition.caches.size`), 3);
  console.log('Foundry: all three treasure galleries reached with normal jumps.');

  // Traverse the route with normal jumps and operate all regulators with D-pad input.
  await execute(`const s=${r};s.player.body.reset(s.world.spawn.tx*16+8,(s.world.spawn.ty+1)*16);window.__pads[0].axes[0]=1;window.__foundryBtn(0,false);window.__routeFrame=0;window.__routeJump=0;window.__isSolid=(await import('/src/game/realm/tiles.ts')).isSolid;`);
  const routed=await step(55,`window.__routeFrame++;window.__pads[0].axes[0]=1;
    const b=s.player.body,tx=Math.floor(s.player.x/16),ty=Math.floor((s.player.y-1)/16);
    const wall=[ty,ty-1,ty-2].some(y=>window.__isSolid(s.tileAt(tx+1,y)));
    if(b.blocked.down&&wall&&!window.__routeJump){window.__foundryBtn(0,true);window.__routeJump=window.__routeFrame;}
    else if(b.blocked.down&&window.__routeJump&&window.__routeFrame-window.__routeJump>10){window.__foundryBtn(0,false);window.__routeJump=0;}
    window.__foundryBtn(13,!!s.expedition.prompt()&&window.__routeFrame%12<6);return !!s.boss;`);
  const routeState=await execute(`const s=${r};window.__pads[0].axes[0]=0;window.__foundryBtn(13,false);window.__foundryBtn(0,false);return {x:s.player.x,y:s.player.y,switches:s.expedition.switches.size,boss:s.boss?.def.id};`);
  assert.ok(routed, `main route reached Warden: ${JSON.stringify(routeState)}`);
  await execute(`window.__foundryManual=false;window.__game.loop.wake();`);
  assert.deepEqual(await evaluate(`[${r}.expedition.switches.size,${r}.boss.def.id,${r}.spawnPoint.x,${r}.world.stations[2].tx*16+8]`), [3,'warden',await evaluate(`${r}.world.stations[2].tx*16+8`),await evaluate(`${r}.world.stations[2].tx*16+8`)]);
  // Warden armor, telegraph, charge, gear-wave attack and vulnerability are real states.
  assert.deepEqual(await execute(`const s=${r},b=s.boss,{updateBoss,hitBoss}=await import('/src/game/realm/realmBosses.ts'),ctx=s.bossCtx();
    s.physics.pause();b.phase='patrol';b.timer=0;updateBoss(b,ctx,16);const tele=b.phase;
    const blocked=hitBoss(b,16,s.player.x);updateBoss(b,ctx,1000);const charge=b.phase;
    updateBoss(b,ctx,700);updateBoss(b,ctx,700);const open=b.phase;const dealt=hitBoss(b,16,s.player.x);
    const gear=s.hazards.some(h=>h.sprite.texture.key==='fx_gear');s.physics.resume();return [tele,blocked,charge,open,dealt,gear];`), ['telegraph',0,'charge','recover',24,true]);
  if (screenshot) await screenshot('foundry-warden');
  // A death preserves regulators/cache claims, respawns at the last regulator and resets the boss.
  assert.deepEqual(await execute(`const s=${r},home={...s.spawnPoint};s.die();s.respawn();return [s.player.x===home.x,s.player.y===home.y,!s.boss,s.expedition.caches.size,s.expedition.switches.size];`), [true,true,true,3,3]);
  await execute(`const s=${r};s.player.body.reset((s.world.arena.x0+5)*16,s.world.arena.floorY*16);s.invuln=1e9;`);
  await step(0.3);
  // Win through sword damage, then the award is permanent and isn't an elemental relic.
  await execute(`const s=${r};s.boss.hp=1;s.boss.phase='recover';s.boss.timer=2400;
    s.player.body.reset(s.boss.sprite.x-30,s.boss.sprite.y);s.facing=1;s.swingTimer=0;s.swing();await s.save();`);
  assert.deepEqual(await evaluate(`[${r}.bossDefeated,${r}.expedition.progress.clears,${r}.expedition.progress.lantern,${r}.count('wardenCore'),${r}.relics.size]`), [true,1,true,1,0]);
  await execute(`${r}.expedition.victory();`);
  assert.equal(await evaluate(`${r}.count('wardenCore')`), 1);
  await restart(`await ${r}.save();${r}.scene.restart({});`);
  assert.deepEqual(await evaluate(`[${r}.expedition.progress.lantern,${r}.expedition.progress.clears,${r}.count('wardenCore')]`), [true,1,1]);
  // Survey reveals only nearby ore; toggling it really removes the overlay and persists.
  assert.deepEqual(await execute(`const s=${r},p=s.player;const x=Math.floor(p.x/16),y=Math.floor(p.y/16);
    s.setTile(x+4,y,5);s.setTile(x+16,y,6);s.expedition.drawSurvey();
    return [s.expedition.oreMarks.includes(y*s.world.w+x+4),s.expedition.oreMarks.includes(y*s.world.w+x+16)];`), [true,false]);
  await key(78,'n'); await tap(480,427);
  assert.deepEqual(await evaluate(`[${r}.expedition.progress.lanternEnabled,${r}.expedition.oreMarks.length]`), [false,0]);
  await key(27,'Escape');
  await restart(`await ${r}.save();${r}.scene.restart();`);
  assert.equal(await evaluate(`${r}.expedition.progress.lanternEnabled`), false);
  // Earned furniture cannot be crafted for free; the trophy survives placement and packing.
  assert.deepEqual(await execute(`const s=${r},h=s.homestead,p=s.player,x=Math.floor(p.x/16)+2,y=Math.floor(p.y/16)-1;
    for(let dx=0;dx<2;dx++){s.setTile(x+dx,y+1,3);s.setTile(x+dx,y,0);s.setTile(x+dx,y-1,0);}
    h.prepare('wardenCore');h.aim(x,y);const built=h.place(),n=s.count('wardenCore');h.prepare('wardenCore');const forbidden=!h.placing;
    const f=h.data.furniture.find(f=>f.kind==='wardenCore');h.packFurniture(f);return [built,n,forbidden,s.count('wardenCore')];`), [true,0,true,1]);
  await execute(`window.__pads=[];`);
  console.log('PASS: Buried Foundry: compatible entrance/discovery/map, keyboard/touch/R3 journal, seeded rooms, trap warnings/damage, all three galleries climbed, regulator route bot, checkpoint death, Warden states/armor/waves, victory/reward persistence, Survey Lantern toggle/range, earned trophy.');
}

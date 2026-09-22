// Run against a Vite dev server and Chromium with remote debugging enabled.
// Tests create and dispose an isolated browser context; player saves are untouched.
// POGO_URL defaults to http://127.0.0.1:5173; CDP_URL defaults to http://127.0.0.1:9333.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { verifyPlatformer } from './platformer-regression.mjs';
import { verifyRealm } from './realm-regression.mjs';
import { verifyPortalRealms } from './realm-portals-regression.mjs';
import { verifyForeverGate } from './realm-forever-regression.mjs';
import { verifyHomestead } from './realm-homestead-regression.mjs';
import { verifyFoundry } from './realm-foundry-regression.mjs';

const cdpUrl = process.env.CDP_URL ?? 'http://127.0.0.1:9333';
const gameUrl = process.env.POGO_URL ?? 'http://127.0.0.1:5173';
const pause = (ms = 150) => new Promise(resolve => setTimeout(resolve, ms));
async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  const errors = [];
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (message.id) {
      pending.get(message.id)?.(message);
      pending.delete(message.id);
    }
  });
  return {
    socket, errors,
    call: (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++nextId;
      const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 15000);
      pending.set(id, message => {
        clearTimeout(timeout);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result);
      });
      socket.send(JSON.stringify({ id, method, params }));
    }),
  };
}
const version = await (await fetch(`${cdpUrl}/json/version`)).json();
const browser = await connect(version.webSocketDebuggerUrl);
const { browserContextId } = await browser.call('Target.createBrowserContext');
let page;
let completed = false;
try {
  const { targetId } = await browser.call('Target.createTarget', { url: 'about:blank', browserContextId });
  const targets = await (await fetch(`${cdpUrl}/json/list`)).json();
  page = await connect(targets.find(target => target.id === targetId).webSocketDebuggerUrl);
  const evaluate = async expression => {
    const result = await page.call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }).catch(error => {
      throw new Error(`${error.message}\nEvaluating: ${expression.slice(0, 700)}`);
    });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const execute = expression => evaluate(`(async () => { ${expression} })()`);
  const waitFor = async expression => {
    for (let i = 0; i < 80; i++) {
      if (await evaluate(expression)) return;
      await pause();
    }
    throw new Error(`Condition not reached: ${expression}`);
  };
  const scene = name => `window.__game.scene.getScene('${name}')`;
  const textExists = (name, text) => `${scene(name)}.children.list.some(o => o.type === 'Text' && o.text.includes(${JSON.stringify(text)}))`;
  const click = async (name, x, y) => {
    await execute(`${scene(name)}.children.list.find(o => o.type === 'Rectangle' && o.input?.enabled && o.x === ${x} && o.y === ${y}).emit('pointerdown');`);
    await pause();
  };
  const start = async name => {
    await execute(`if (window.__game.scene.isActive('${name}')) {
      window.__game.scene.getScene('${name}').scene.restart();
    } else {
      for (const s of window.__game.scene.getScenes(true)) s.scene.stop();
      window.__game.scene.start('${name}');
    }`);
    await pause();
  };
  await page.call('Runtime.enable');
  await page.call('Emulation.setDeviceMetricsOverride', { width: 480, height: 854, deviceScaleFactor: 1, mobile: true });
  await page.call('Page.navigate', { url: gameUrl });
  await waitFor('!!window.__game?.scene.isActive("ModeSelect")');

  if (!['homestead', 'foundry'].includes(process.env.POGO_SUITE)) {

  // Starter perks must reflect the starter created during this visit.
  await start('PogBinder');
  await waitFor(textExists('PogBinder', 'equipped:'));
  await execute(`const { grantPog } = await import('/src/game/db/pogRepository.ts');
    for (let i = 0; i < 30; i++) await grantPog('cafeteria', 'regression');
    ${scene('PogBinder')}.scene.restart({ page: 0 });`);
  await waitFor(textExists('PogBinder', '1 / 4'));
  for (let i = 0; i < 3; i++) await click('PogBinder', 382, 728);
  assert.equal(await evaluate(textExists('PogBinder', '4 / 4')), true);
  await click('PogBinder', 90, 240); // Duplicate cannot equip; stay on the same page.
  assert.equal(await evaluate(textExists('PogBinder', 'one copy')), true);
  await click('PogBinder', 98, 728);
  assert.equal(await evaluate(textExists('PogBinder', '3 / 4')), true);

  // Old shared mastery returns its full remaining purchase cost exactly once.
  assert.deepEqual(await execute(`const { dbPut } = await import('/src/game/db/LocalDB.ts');
    const { getLoadout, techPointsAvailable } = await import('/src/game/db/loadoutRepository.ts');
    const old = await getLoadout();
    await dbPut('loadout', { ...old, techPointsEarned: 20, techPointsSpent: 18,
      mastery: { tier: 4, unlockedAtRun: 30 }, characterMasteryMigrated: undefined });
    const migrated = await getLoadout(); const again = await getLoadout();
    return [techPointsAvailable(migrated), techPointsAvailable(again), again.mastery.tier, again.masteryRefund];`), [20, 20, 0, 18]);

  // Independent character training, 15-second gate, tier thresholds, and advantage ceilings.
  assert.deepEqual(await execute(`const { recordRun } = await import('/src/game/db/repository.ts');
    await recordRun(100, 'cleo', 14.9);
    for (let i = 0; i < 4; i++) await recordRun(600, 'ada', 15);
    const { profile } = await recordRun(200, 'cleo', 15);
    const { masteryTier } = await import('/src/game/systems/characterMastery.ts');
    return [profile.characters.cleo.trainingRuns, profile.characters.ada.trainingRuns,
      profile.characters.ada.bestScore, masteryTier(4), masteryTier(12), masteryTier(24), masteryTier(40)];`), [1, 4, 600, 1, 2, 3, 4]);
  assert.deepEqual(await execute(`const { computeAdvantage, getLoadout } = await import('/src/game/db/loadoutRepository.ts');
    const loadout = await getLoadout();
    return [computeAdvantage(loadout, 4).percent, computeAdvantage(loadout, 400).percent,
      computeAdvantage({ ...loadout, techPointsSpent: 2, pog: { tier: 1, unlockedAtRun: 0 } }, 40).percent];`), [1.5, 15, 30]);
  assert.equal(await execute(`const { recordRun } = await import('/src/game/db/repository.ts');
    const { profile, techPointsGranted, circuitMatch } = await recordRun(21000, 'ada', 120);
    return techPointsGranted - (circuitMatch?.won ? 1 : 0);`), 4); // Amateur already earned; four remaining tiers.

  await start('CharacterSelect');
  await waitFor(textExists('CharacterSelect', 'training runs'));
  await execute(`${scene('CharacterSelect')}.select(4);`);
  assert.equal(await evaluate(textExists('CharacterSelect', 'BEST 21000')), true);
  if (process.env.POGO_SCREENSHOT_DIR) {
    const { data } = await page.call('Page.captureScreenshot');
    await writeFile(`${process.env.POGO_SCREENSHOT_DIR}/character-mastery.png`, Buffer.from(data, 'base64'));
  }
  await execute(`window.__game.registry.set('selectedCharacterId', 'ada');`);
  await start('Loadout');
  await waitFor(textExists('Loadout', 'Ada L.'));
  assert.equal(await evaluate(textExists('Loadout', '18 TP returned')), true);

  await start('PogBattle');
  await waitFor(textExists('PogBattle', 'PRACTICE'));
  await execute(`const { battleOpponents } = await import('/src/game/db/pogRepository.ts');
    const s = ${scene('PogBattle')}; s.opponent = battleOpponents().find(o => o.ranked); await s.showWager();`);
  assert.equal(await evaluate(textExists('PogBattle', '1 / 3')), true);
  await click('PogBattle', 382, 720); await click('PogBattle', 382, 720);
  await click('PogBattle', 90, 130);
  assert.equal(await evaluate(`${scene('PogBattle')}.phase`), 'battle');
  for (let i = 0; i < 3; i++) await execute(`await ${scene('PogBattle')}.startBattle();`);
  assert.equal(await evaluate(`${scene('PogBattle')}.input.keyboard.listenerCount('keydown-SPACE')`), 1);

  // Scene restarts cannot stack controls. Pausing freezes scoring and movement.
  await start('Run');
  for (let i = 0; i < 3; i++) { await execute(`${scene('Run')}.scene.restart();`); await pause(); }
  assert.equal(await evaluate(`${scene('Run')}.input.keyboard.listenerCount('keydown-SPACE')`), 1);
  assert.equal(await evaluate(`${scene('Run')}.input.listenerCount('pointerdown')`), 1);
  await execute(`${scene('Run')}.togglePause();`);
  const pausedScore = await evaluate(`${scene('Run')}.score`);
  await pause(400);
  assert.equal(await evaluate(`${scene('Run')}.score`), pausedScore);
  const jumpDuration = await execute(`${scene('Run')}.togglePause(); ${scene('Run')}.startJump(); return ${scene('Run')}.jumpTimer;`);
  assert.ok(Math.abs(jumpDuration - 552) < 0.01);
  // Remove a collected object immediately instead of retaining its destroyed sprite forever.
  assert.equal(await execute(`const s = ${scene('Run')};
    const sprite = s.add.sprite(240, 674, 'star'); sprite.destroy();
    s.obstacles = [{ sprite, lane: 1, type: 'star', resolved: true }];
    s.updateObstacles(0); return s.obstacles.length;`), 0);
  await execute(`const s = ${scene('Run')}; s.obstacles = [];
    for (const [type, x, y] of [['hurdle', 100, 330], ['banner', 240, 250], ['star', 380, 400]]) s.add.sprite(x, y, type);
    s.gameOver = true;`);
  if (process.env.POGO_SCREENSHOT_DIR) {
    const { data } = await page.call('Page.captureScreenshot');
    await writeFile(`${process.env.POGO_SCREENSHOT_DIR}/runner-polish.png`, Buffer.from(data, 'base64'));
  }
  await start('TrickLab');
  assert.equal(await evaluate(`${scene('Run')}.input.keyboard.listenerCount('keydown-SPACE')`), 0);
  for (let i = 0; i < 3; i++) { await execute(`${scene('TrickLab')}.scene.restart();`); await pause(); }
  assert.equal(await evaluate(`${scene('TrickLab')}.input.keyboard.listenerCount('keydown-UP')`), 1);
  assert.equal(await evaluate(`${scene('TrickLab')}.input.listenerCount('pointerdown')`), 1);
  await execute(`${scene('TrickLab')}.input.keyboard.emit('keydown-UP');`);
  assert.equal(await evaluate(`${scene('TrickLab')}.started`), true);
  assert.equal(await evaluate(`${scene('TrickLab')}.step`), 0); // Start key is not also a trick input.

  // Real run completion credits the active character; switching doesn't credit the old one.
  await execute(`window.__game.registry.set('selectedCharacterId', 'suntzu');`);
  await start('Run');
  assert.deepEqual(await execute(`const s = ${scene('Run')}; return [s.lives, s.shields];`), [3, 1]);
  assert.deepEqual(await execute(`const s = ${scene('Run')}; s.combo = 5;
    const sprite = s.add.sprite(240, 674, 'hurdle'); s.onHit({ sprite, type: 'hurdle', lane: 1, resolved: false });
    return [s.lives, s.shields, s.combo];`), [3, 0, 5]);
  await execute(`const s = ${scene('Run')}; s.elapsed = 20; s.endRun();`);
  await waitFor('window.__game.scene.isActive("GameOver")');
  await waitFor(textExists('GameOver', 'Sun Tzu'));
  assert.equal(await execute(`const { getProfile } = await import('/src/game/db/repository.ts');
    return (await getProfile()).characters.suntzu.trainingRuns;`), 1);
  await page.call('Page.reload');
  await waitFor('!!window.__game?.scene.isActive("ModeSelect")');
  assert.deepEqual(await execute(`const { getProfile } = await import('/src/game/db/repository.ts');
    const p = await getProfile(); return [p.characters.cleo.trainingRuns, p.characters.ada.trainingRuns, p.characters.suntzu.trainingRuns];`), [1, 5, 1]);
  await verifyPlatformer({ execute, evaluate, waitFor, start, scene, textExists });
  await verifyRealm({ execute, evaluate, waitFor, start, scene, textExists });
  await verifyPortalRealms({ execute, evaluate, waitFor, start, scene, textExists });
  await verifyForeverGate({ execute, evaluate, waitFor, start, scene, textExists });
  }
  await page.call('Emulation.setDeviceMetricsOverride', { width: 960, height: 540, deviceScaleFactor: 1, mobile: false });
  const key = async (code, key) => {
    await page.call('Input.dispatchKeyEvent', { type: 'keyDown', windowsVirtualKeyCode: code, key });
    await pause();
    await page.call('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: code, key });
    await pause();
  };
  const tap = async (x, y) => {
    const rect = await evaluate(`(() => { const r = window.__game.canvas.getBoundingClientRect(); return { x:r.x,y:r.y,w:r.width,h:r.height }; })()`);
    await page.call('Emulation.setTouchEmulationEnabled', { enabled: true });
    await page.call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: rect.x + x / 960 * rect.w, y: rect.y + y / 540 * rect.h }] });
    await pause();
    await page.call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await pause();
  };
  const screenshot = process.env.POGO_SCREENSHOT_DIR ? async name => {
    const { data } = await page.call('Page.captureScreenshot');
    await writeFile(`${process.env.POGO_SCREENSHOT_DIR}/${name}.png`, Buffer.from(data, 'base64'));
  } : undefined;
  if (process.env.POGO_SUITE !== 'foundry') await verifyHomestead({ execute, evaluate, waitFor, scene, key, tap, screenshot });
  if (process.env.POGO_SUITE !== 'homestead') await verifyFoundry({ execute, evaluate, waitFor, scene, key, tap, screenshot });
  assert.equal(page.errors.length, 0, JSON.stringify(page.errors));
  console.log(process.env.POGO_SUITE ? 'PASS: no browser exceptions.' : 'PASS: collection paging, migration, independent mastery, training gate, tier awards, advantage caps, character UI, battle listeners, runner restart/pause, shield behavior, Trick Lab restart, obstacle cleanup, save persistence; no browser exceptions.');
  completed = true;
} finally {
  page?.socket.close();
  try {
    await browser.call('Target.disposeBrowserContext', { browserContextId });
  } catch (error) {
    if (completed) throw error;
    console.error(`Browser cleanup failed after the test failure: ${error.message}`);
  } finally { browser.socket.close(); }
}

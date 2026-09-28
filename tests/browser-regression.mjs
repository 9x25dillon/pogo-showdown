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
import { verifyUnified } from './realm-unified-regression.mjs';

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
  await waitFor('!!window.__game?.scene.isActive("Title")');

  const key = async (code, key) => {
    await page.call('Input.dispatchKeyEvent', { type: 'keyDown', windowsVirtualKeyCode: code, key });
    await pause();
    await page.call('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: code, key });
    await pause();
  };
  if (!['homestead', 'foundry'].includes(process.env.POGO_SUITE)) {
  await verifyUnified({ execute, evaluate, waitFor, scene, key });
  if (process.env.POGO_SUITE !== 'unified') {
  await verifyPlatformer({ execute, evaluate, waitFor, start, scene, textExists });
  await verifyRealm({ execute, evaluate, waitFor, start, scene, textExists });
  await verifyPortalRealms({ execute, evaluate, waitFor, start, scene, textExists });
  await verifyForeverGate({ execute, evaluate, waitFor, start, scene, textExists });
  }
  }
  await page.call('Emulation.setDeviceMetricsOverride', { width: 960, height: 540, deviceScaleFactor: 1, mobile: false });
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
  if (!['foundry', 'unified'].includes(process.env.POGO_SUITE)) await verifyHomestead({ execute, evaluate, waitFor, scene, key, tap, screenshot });
  if (!['homestead', 'unified'].includes(process.env.POGO_SUITE)) await verifyFoundry({ execute, evaluate, waitFor, scene, key, tap, screenshot });
  assert.equal(page.errors.length, 0, JSON.stringify(page.errors));
  console.log('PASS: no browser exceptions.');
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

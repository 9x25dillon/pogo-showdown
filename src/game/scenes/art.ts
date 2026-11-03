import Phaser from 'phaser';

/**
 * Eternity High's look, in code: no image files. Sprites share one hand through
 * `shadeSprite` (a dark outline and light from the upper left), and backgrounds
 * are painted once at boot, in white, so a scene can tint them for any realm.
 */
export function shadeSprite(scene: Phaser.Scene, key: string): void {
  const tex = scene.textures.get(key);
  const canvas = tex.getSourceImage() as HTMLCanvasElement;
  const ctx = canvas.getContext?.('2d', { willReadFrequently: true });
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  const src = ctx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(w, h);
  const a = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src.data[(y * w + x) * 4 + 3]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const alpha = src.data[i + 3];
    if (alpha < 40) {
      if (a(x - 1, y) > 80 || a(x + 1, y) > 80 || a(x, y - 1) > 80 || a(x, y + 1) > 80) {
        out.data[i] = 12; out.data[i + 1] = 8; out.data[i + 2] = 22; out.data[i + 3] = 255;
      }
      continue;
    }
    let light = 1.12 - 0.34 * ((x / w) * 0.35 + (y / h) * 0.65);
    if (a(x - 1, y) < 40 || a(x, y - 1) < 40) light += 0.16;
    if (a(x + 1, y) < 40 || a(x, y + 1) < 40) light -= 0.2;
    out.data[i] = Math.min(255, src.data[i] * light);
    out.data[i + 1] = Math.min(255, src.data[i + 1] * light);
    out.data[i + 2] = Math.min(255, src.data[i + 2] * light);
    out.data[i + 3] = alpha;
  }
  ctx.putImageData(out, 0, 0);
  (tex as Phaser.Textures.CanvasTexture).refresh();
}

type Paint = (ctx: CanvasRenderingContext2D, w: number, h: number, rand: () => number) => void;

function bake(scene: Phaser.Scene, key: string, w: number, h: number, paint: Paint, seed = 11): void {
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex?.getContext();
  if (!tex || !ctx) return;
  let s = seed;
  paint(ctx, w, h, () => ((s = (s * 16807) % 2147483647) / 2147483647));
  tex.refresh();
}

/** a ridge that meets itself at the edges, so it can scroll forever */
function ridge(w: number, x: number, seed: number, amp: number): number {
  const t = (x / w) * Math.PI * 2;
  return amp * (Math.sin(t * 2 + seed) * 0.5 + Math.sin(t * 5 + seed * 2) * 0.28 + Math.sin(t * 11 + seed * 3) * 0.14);
}

/** the clock tower: every clock at Eternity High says three o'clock */
function clockTower(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, face: string, hands: string): void {
  const fill = ctx.fillStyle;
  ctx.fillRect(x - 22 * s, y - 150 * s, 44 * s, 150 * s);
  ctx.beginPath(); ctx.moveTo(x - 28 * s, y - 150 * s); ctx.lineTo(x, y - 200 * s); ctx.lineTo(x + 28 * s, y - 150 * s); ctx.fill();
  ctx.fillRect(x - 1.5 * s, y - 220 * s, 3 * s, 22 * s);
  ctx.fillStyle = face;
  ctx.beginPath(); ctx.arc(x, y - 118 * s, 16 * s, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = hands; ctx.lineWidth = 2.5 * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y - 118 * s); ctx.lineTo(x, y - 131 * s); ctx.moveTo(x, y - 118 * s); ctx.lineTo(x + 10 * s, y - 118 * s); ctx.stroke();
  ctx.fillStyle = fill;
}

/** the school: a long building with a row of windows; `windows` punches them out or lights them */
function school(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rand: () => number, windows: (wx: number, wy: number, ww: number, wh: number) => void): void {
  ctx.fillRect(x, y - h, w, h);
  ctx.beginPath(); ctx.moveTo(x - 8, y - h); ctx.lineTo(x + w / 2, y - h - 30); ctx.lineTo(x + w + 8, y - h); ctx.fill();
  for (let row = 0; row < 3; row++) for (let wx = x + 12; wx < x + w - 16; wx += 24) {
    if (rand() < 0.86) windows(wx, y - h + 14 + row * 30, 12, 18);
  }
}

export function bakeArt(scene: Phaser.Scene): void {
  // ---- far hills: 1024 wide and 512 tall so they tile; the skyline sits near the top ----
  bake(scene, 'bg_far', 1024, 512, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) ctx.lineTo(x, 150 + ridge(w, x, 1.3, 90));
    ctx.lineTo(w, h); ctx.fill();
  }, 23);
  // ---- middle distance: the school and its tower on a low rise, windows cut through ----
  bake(scene, 'bg_school', 1024, 512, (ctx, w, h, rand) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) ctx.lineTo(x, 262 + ridge(w, x, 4.1, 22));
    ctx.lineTo(w, h); ctx.fill();
    const y = 270;
    school(ctx, 300, y, 330, 106, rand, (wx, wy, ww, wh) => ctx.clearRect(wx, wy, ww, wh));
    clockTower(ctx, 465, y - 100, 0.72, 'rgba(0,0,0,0)', '#ffffff');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(465, y - 100 - 118 * 0.72, 16 * 0.72, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    const cy = y - 100 - 118 * 0.72;
    ctx.beginPath(); ctx.moveTo(465, cy); ctx.lineTo(465, cy - 9); ctx.moveTo(465, cy); ctx.lineTo(472, cy); ctx.stroke();
    for (let x = 30; x < w; x += 54 + rand() * 70) {
      if (x > 280 && x < 650) continue;
      const by = 268 + ridge(w, x, 4.1, 22);
      const size = 18 + rand() * 26;
      ctx.fillRect(x - 2, by - size, 4, size + 6);
      ctx.beginPath(); ctx.ellipse(x, by - size - 8, size * 0.62, size * 0.72, 0, 0, Math.PI * 2); ctx.fill();
    }
  }, 57);
  // ---- stars: a sky you can only see once the sun's gone ----
  bake(scene, 'bg_stars', 1024, 300, (ctx, w, h, rand) => {
    for (let i = 0; i < 180; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.25 + rand() * 0.75})`;
      const s = rand() < 0.12 ? 2 : 1;
      ctx.fillRect(rand() * w, rand() * h, s, s);
    }
  }, 77);
  // ---- the edges of the screen ease in, so the middle is what you look at ----
  bake(scene, 'vignette', 480, 270, (ctx, w, h) => {
    const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.5, w / 2, h / 2, w * 0.68);
    v.addColorStop(0, 'rgba(4,2,12,0)'); v.addColorStop(1, 'rgba(4,2,12,0.62)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  });
  bake(scene, 'skyfade', 8, 270, (ctx, w, h) => {
    const v = ctx.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, 'rgba(0,0,0,0.5)'); v.addColorStop(0.6, 'rgba(0,0,0,0.08)'); v.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  });
  // ---- the title: dusk over the school, the Last Bell tower stopped at three ----
  bake(scene, 'title_art', 1296, 540, (ctx, w, h, rand) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0b0620'); sky.addColorStop(0.42, '#3b1553'); sky.addColorStop(0.68, '#a23a5c'); sky.addColorStop(0.86, '#f08a4b'); sky.addColorStop(1, '#fbcb6b');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 170; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.2 + rand() * 0.7})`;
      ctx.fillRect(rand() * w, rand() * h * 0.5, rand() < 0.1 ? 2 : 1, rand() < 0.1 ? 2 : 1);
    }
    // a low sun, behind the tower
    const cx = w * 0.74; const ground = 440;
    const sun = ctx.createRadialGradient(cx, ground - 60, 18, cx, ground - 60, 280);
    sun.addColorStop(0, 'rgba(255,233,170,0.95)'); sun.addColorStop(0.2, 'rgba(255,170,90,0.55)'); sun.addColorStop(1, 'rgba(255,120,90,0)');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, w, h);
    // far hills
    ctx.fillStyle = '#4a1d58';
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) ctx.lineTo(x, 370 + ridge(w, x, 1.1, 46));
    ctx.lineTo(w, h); ctx.fill();
    // the school
    ctx.fillStyle = '#1c0d30';
    const lit = ['#ffd27a', '#ffb867', '#ffe39a'];
    school(ctx, w * 0.48, ground, 520, 150, rand, (wx, wy, ww, wh) => {
      const keep = ctx.fillStyle;
      ctx.fillStyle = rand() < 0.5 ? lit[Math.floor(rand() * 3)] : '#2b1647';
      ctx.fillRect(wx, wy, ww, wh);
      ctx.fillStyle = keep;
    });
    clockTower(ctx, cx, ground - 130, 1.25, '#fff2c9', '#1c0d30');
    // a crack of the Forever Realm tearing through the sky
    ctx.strokeStyle = 'rgba(232,121,249,0.85)'; ctx.lineWidth = 2; ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 16;
    ctx.beginPath(); let px = cx + 8; let py = ground - 330; ctx.moveTo(px, py);
    for (let i = 0; i < 10; i++) { px += 8 + rand() * 26; py -= 4 + rand() * 18; ctx.lineTo(px, py); }
    ctx.stroke(); ctx.shadowBlur = 0;
    // near ground and trees
    ctx.fillStyle = '#0d0618';
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) ctx.lineTo(x, 440 + ridge(w, x, 3.3, 14));
    ctx.lineTo(w, h); ctx.fill();
    for (let x = 12; x < w; x += 40 + rand() * 70) {
      if (x > w * 0.46 && x < w * 0.92) continue;
      const by = 442 + ridge(w, x, 3.3, 14);
      const size = 26 + rand() * 40;
      ctx.fillRect(x - 3, by - size, 6, size + 6);
      ctx.beginPath(); ctx.ellipse(x, by - size - 12, size * 0.7, size * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    }
  }, 201);
  // ---- combat: the blade's arc, sparks and a bolt of split light ----
  bake(scene, 'fx_slash', 64, 64, (ctx) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineCap = 'round';
    for (const [r, width, alpha] of [[28, 7, 0.28], [26, 4, 0.6], [24, 2, 1]] as const) {
      ctx.globalAlpha = alpha; ctx.lineWidth = width;
      ctx.beginPath(); ctx.arc(14, 32, r, -1.15, 1.15); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
  bake(scene, 'fx_spark', 8, 8, (ctx) => {
    const g = ctx.createRadialGradient(4, 4, 0, 4, 4, 4);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 8, 8);
  });
  bake(scene, 'fx_bolt', 30, 12, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(244,114,182,0)'); g.addColorStop(0.5, '#93c5fd'); g.addColorStop(1, '#ffffff');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w / 2, h / 2 - 1, 0, 0, Math.PI * 2); ctx.fill();
  });
}

type G = Phaser.GameObjects.Graphics;

/** a teenager in school uniform: skin, blazer and legs. Each hero then adds what makes them them. */
function student(g: G, skin: number, blazer: number, trousers = 0x25213a): void {
  g.fillStyle(trousers, 1).fillRect(9, 31, 4, 13).fillRect(15, 31, 4, 13);
  g.fillStyle(0x12101c, 1).fillRect(8, 42, 6, 4).fillRect(14, 42, 6, 4);
  g.fillStyle(blazer, 1).fillRoundedRect(6, 19, 16, 15, 3);
  g.fillStyle(0xf8fafc, 1).fillTriangle(11, 19, 17, 19, 14, 25);
  g.fillStyle(skin, 1).fillRect(4, 21, 3, 11).fillRect(21, 21, 3, 11);
  g.fillStyle(skin, 1).fillRoundedRect(8, 6, 12, 13, 4);
  g.fillStyle(0x12101c, 1).fillCircle(11, 12, 1.2).fillCircle(17, 12, 1.2);
}

/** one drawing per hero, keyed by the save id */
export const HERO_ART: Record<string, (g: G) => void> = {
  cleo: (g) => {
    g.fillStyle(0x12101c, 1).fillRect(5, 4, 18, 18); // a straight black bob
    student(g, 0xc99a6b, 0xf4c430);
    g.fillStyle(0x12101c, 1).fillRect(7, 4, 14, 4);
    g.fillStyle(0xfacc15, 1).fillRect(6, 4, 16, 3).fillTriangle(12, 4, 16, 4, 14, 0); // the gold circlet
    g.fillStyle(0x0ea5e9, 1).fillCircle(14, 5, 1.4);
    g.fillStyle(0xfacc15, 1).fillRect(8, 19, 12, 2);
  },
  khan: (g) => {
    student(g, 0xd6a077, 0xd9432f);
    g.fillStyle(0x7c4a21, 1).fillRoundedRect(5, 2, 18, 8, 3); // fur hat
    g.fillStyle(0xd9432f, 1).fillRect(9, 0, 10, 4);
    g.fillStyle(0x2a1a10, 1).fillRect(10, 15, 8, 1.5).fillRect(9, 15, 1.5, 4).fillRect(17.5, 15, 1.5, 4); // moustache
    g.fillStyle(0xd9432f, 1).fillRect(3, 19, 4, 5).fillRect(21, 19, 4, 5); // shoulders
  },
  joan: (g) => {
    student(g, 0xf1c7a3, 0x8d8d9b);
    g.fillStyle(0x7a4a24, 1).fillRoundedRect(6, 3, 16, 8, 3).fillRect(6, 8, 3, 7).fillRect(19, 8, 3, 7); // cropped hair
    g.fillStyle(0xe2e8f0, 1).fillRoundedRect(8, 20, 12, 11, 2); // breastplate
    g.fillStyle(0xfacc15, 1).fillRect(13, 22, 2, 7).fillRect(10.5, 24, 7, 2); // a cross of gold
  },
  einstein: (g) => {
    g.fillStyle(0xe7e5e4, 1).fillCircle(7, 9, 5).fillCircle(21, 9, 5).fillCircle(6, 16, 5).fillCircle(22, 16, 5); // the long curled wig
    student(g, 0xf1c7a3, 0x3b82f6);
    g.fillStyle(0xe7e5e4, 1).fillCircle(9, 5, 4).fillCircle(14, 4, 4).fillCircle(19, 5, 4);
    g.fillStyle(0xef4444, 1).fillCircle(23, 31, 3); // an apple in hand
    g.fillStyle(0x22c55e, 1).fillRect(23, 27, 2, 2);
  },
  ada: (g) => {
    student(g, 0xf1c7a3, 0x14b8a6);
    g.fillStyle(0x3b2416, 1).fillRoundedRect(7, 3, 14, 6, 3).fillCircle(14, 2, 3); // hair up in a bun
    g.fillStyle(0xfacc15, 1).fillCircle(11, 11, 3).fillCircle(17, 11, 3); // brass goggles
    g.fillStyle(0x0f172a, 1).fillCircle(11, 11, 1.8).fillCircle(17, 11, 1.8);
    g.fillStyle(0x0f766e, 1).fillRect(13, 22, 2, 9); // a tie
  },
  suntzu: (g) => {
    student(g, 0xe0b48a, 0x22c55e, 0x14532d);
    g.fillStyle(0x12101c, 1).fillRoundedRect(8, 3, 12, 5, 2).fillCircle(14, 2, 2.5); // topknot
    g.fillStyle(0xfacc15, 1).fillRect(13, 0, 2, 4);
    g.fillStyle(0x14532d, 1).fillTriangle(6, 19, 14, 29, 8, 33).fillTriangle(22, 19, 14, 29, 20, 33); // crossed robe
    g.fillStyle(0xfef3c7, 1).fillRect(21, 12, 5, 16); // a scroll at the back
    g.fillStyle(0x7c2d12, 1).fillRect(20, 12, 7, 2).fillRect(20, 26, 7, 2);
  },
  frida: (g) => {
    g.fillStyle(0x7a2f1b, 1).fillCircle(14, 5, 8); // auburn hair piled high
    student(g, 0xf1c7a3, 0xec4899);
    g.fillStyle(0x7a2f1b, 1).fillRect(8, 4, 12, 3);
    g.fillStyle(0xfda4af, 1).fillRect(7, 2, 14, 2); // ribbon
    g.fillStyle(0xfef3c7, 1).fillRoundedRect(8, 22, 12, 14, 2); // a smock with paint on it
    g.fillStyle(0xef4444, 1).fillCircle(11, 26, 1.5);
    g.fillStyle(0x3b82f6, 1).fillCircle(16, 29, 1.5);
    g.fillStyle(0xfacc15, 1).fillCircle(12, 32, 1.5);
  },
  leo: (g) => {
    student(g, 0xf1c7a3, 0xf97316);
    g.fillStyle(0x6b4423, 1).fillRect(6, 7, 3, 14).fillRect(19, 7, 3, 14); // long hair
    g.fillStyle(0x6b4423, 1).fillRoundedRect(10, 14, 8, 8, 3); // and a beard, somehow, already
    g.fillStyle(0x12101c, 1).fillCircle(11, 11, 1.2).fillCircle(17, 11, 1.2);
    g.fillStyle(0x7c2d12, 1).fillRoundedRect(5, 3, 18, 5, 3); // floppy cap
    g.fillStyle(0x92400e, 1).fillRoundedRect(17, 26, 9, 8, 2); // satchel
    g.lineStyle(1.5, 0x92400e, 1).lineBetween(8, 19, 19, 27);
  },
};

export function drawClio(g: G): void {
  g.fillStyle(0x4b3a6b, 1).fillRoundedRect(6, 19, 16, 27, 3); // a long cardigan
  g.fillStyle(0x12101c, 1).fillRect(9, 42, 5, 4).fillRect(15, 42, 5, 4);
  g.fillStyle(0xf1d5b8, 1).fillRoundedRect(8, 6, 12, 13, 4);
  g.fillStyle(0x9ca3af, 1).fillRoundedRect(7, 3, 14, 6, 3).fillCircle(14, 2, 3.5); // grey bun
  g.lineStyle(1.2, 0xfacc15, 1).strokeCircle(11, 12, 2.4).strokeCircle(17, 12, 2.4); // spectacles
  g.fillStyle(0x12101c, 1).fillCircle(11, 12, 1).fillCircle(17, 12, 1);
  g.fillStyle(0xfacc15, 1).fillRect(13, 19, 2, 8);
  g.fillStyle(0x7f1d1d, 1).fillRoundedRect(4, 27, 14, 11, 1); // the record, always open
  g.fillStyle(0xfef3c7, 1).fillRect(5, 28, 12, 9);
  g.fillStyle(0x7f1d1d, 1).fillRect(10.5, 28, 1, 9);
}

/** the hero's own weapon, in the 16x34 frame the sword uses (grip at the bottom) */
export const WEAPON_ART: Record<string, (g: G) => void> = {
  cleo: (g) => { // the Asp Sceptre
    g.fillStyle(0xfacc15, 1).fillRect(7, 8, 2, 25);
    g.fillStyle(0x22c55e, 1).fillCircle(8, 6, 5);
    g.fillStyle(0x052e16, 1).fillCircle(6.5, 5, 1).fillCircle(9.5, 5, 1);
    g.lineStyle(2, 0x22c55e, 1).beginPath().moveTo(5, 11).lineTo(11, 16).lineTo(5, 21).lineTo(11, 26).strokePath();
  },
  khan: (g) => { // Horde Breaker
    g.fillStyle(0x78350f, 1).fillRect(7, 6, 3, 28);
    g.fillStyle(0x9ca3af, 1).fillRoundedRect(0, 0, 16, 13, 2);
    g.fillStyle(0xd9432f, 1).fillRect(0, 5, 16, 3);
  },
  joan: (g) => { // the Oriflamme
    g.fillStyle(0xe2e8f0, 1).fillTriangle(5, 25, 11, 25, 8, 0);
    g.fillStyle(0xef4444, 1).fillTriangle(8, 4, 16, 7, 8, 13);
    g.fillStyle(0xfacc15, 1).fillRect(2, 25, 12, 3).fillRect(7, 28, 2, 6);
  },
  einstein: (g) => { // the Prism Blade
    g.fillStyle(0xbfdbfe, 1).fillTriangle(3, 26, 13, 26, 8, 0);
    g.fillStyle(0xf472b6, 1).fillTriangle(8, 0, 8, 26, 5, 26);
    g.fillStyle(0xfacc15, 1).fillTriangle(8, 0, 8, 26, 11, 26);
    g.fillStyle(0x1e3a8a, 1).fillRect(2, 26, 12, 2).fillRect(7, 28, 2, 6);
  },
  ada: (g) => { // the Analytical Edge
    g.fillStyle(0x99f6e4, 1).fillRect(5, 0, 6, 26);
    g.fillStyle(0x0f766e, 1);
    for (const y of [3, 9, 15, 21]) g.fillRect(6, y, 4, 2);
    g.fillStyle(0xfacc15, 1).fillCircle(8, 28, 4);
    g.fillStyle(0x0f172a, 1).fillCircle(8, 28, 1.5).fillRect(7, 31, 2, 3);
  },
  suntzu: (g) => { // the Art of Edge
    g.fillStyle(0xd1fae5, 1).fillTriangle(6, 26, 10, 26, 9, 0).fillRect(6, 6, 3, 20);
    g.fillStyle(0x14532d, 1).fillRect(2, 26, 12, 2).fillRect(7, 28, 2, 6);
    g.fillStyle(0xef4444, 1).fillRect(10, 29, 4, 4);
  },
  frida: (g) => { // the Crimson Brush
    g.fillStyle(0x7c2d12, 1).fillRect(7, 12, 2, 22);
    g.fillStyle(0xcbd5e1, 1).fillRect(6, 9, 4, 4);
    g.fillStyle(0xdc2626, 1).fillTriangle(3, 10, 13, 10, 8, 0);
    g.fillStyle(0xdc2626, 0.7).fillCircle(13, 15, 1.5).fillCircle(3, 19, 1.2);
  },
  leo: (g) => { // the Vitruvian Engine
    g.fillStyle(0x92400e, 1).fillRect(7, 12, 2, 22);
    g.lineStyle(2, 0xfacc15, 1).strokeCircle(8, 8, 7);
    g.fillStyle(0xf97316, 1).fillRect(1, 7, 14, 2).fillRect(7, 1, 2, 14);
    g.fillStyle(0xfef3c7, 1).fillCircle(8, 8, 2);
  },
};

/** each hero's nemesis, drawn to its own scale; ground bosses stand at the bottom of the frame */
export const NEMESIS_ART: Record<string, { w: number; h: number; draw: (g: G) => void }> = {
  cleo: { w: 58, h: 88, draw: (g) => { // Octavia the Hall Monitor
    g.fillStyle(0x25213a, 1).fillRect(20, 64, 7, 24).fillRect(31, 64, 7, 24);
    g.fillStyle(0xf8fafc, 1).fillRoundedRect(14, 30, 30, 38, 4);
    g.fillStyle(0xdc2626, 1).fillTriangle(14, 32, 20, 30, 44, 66).fillTriangle(14, 32, 38, 68, 44, 66); // the sash
    g.fillStyle(0xf1c7a3, 1).fillRoundedRect(18, 8, 22, 23, 6);
    g.fillStyle(0x3b2416, 1).fillRect(16, 6, 26, 8);
    g.fillStyle(0x16a34a, 1); for (let x = 16; x < 44; x += 5) g.fillCircle(x, 7, 3); // a laurel
    g.fillStyle(0x12101c, 1).fillRect(22, 18, 5, 2).fillRect(31, 18, 5, 2);
    g.fillStyle(0x92400e, 1).fillRect(38, 36, 18, 26); // the clipboard
    g.fillStyle(0xfef3c7, 1).fillRect(40, 39, 14, 21);
    g.fillStyle(0x7f1d1d, 1); for (let y = 42; y < 58; y += 4) g.fillRect(42, y, 10, 1.5);
  } },
  khan: { w: 104, h: 96, draw: (g) => { // The Great Wall
    g.fillStyle(0x57534e, 1).fillRect(6, 22, 92, 74);
    g.fillStyle(0x78716c, 1); for (let y = 24; y < 94; y += 10) for (let x = (y % 20 ? 6 : 16); x < 96; x += 20) g.fillRect(x, y, 18, 8);
    g.fillStyle(0x57534e, 1); for (let x = 6; x < 96; x += 20) g.fillRect(x, 6, 12, 18); // battlements
    g.fillStyle(0x0c0a09, 1).fillRoundedRect(38, 62, 28, 34, 10); // gate for a mouth
    g.fillStyle(0xfca5a5, 1).fillCircle(32, 42, 6).fillCircle(72, 42, 6);
    g.fillStyle(0x7f1d1d, 1).fillCircle(32, 42, 3).fillCircle(72, 42, 3);
  } },
  joan: { w: 74, h: 96, draw: (g) => { // Headmaster Cauchon
    g.fillStyle(0x1e1b2e, 1).fillTriangle(6, 94, 37, 30, 68, 94);
    g.fillStyle(0x7f1d1d, 1).fillTriangle(24, 94, 37, 40, 50, 94);
    g.fillStyle(0xf1c7a3, 1).fillRoundedRect(25, 22, 24, 22, 7);
    g.fillStyle(0xf8fafc, 1).fillTriangle(22, 26, 37, 0, 52, 26); // mitre
    g.fillStyle(0xfacc15, 1).fillRect(35.5, 6, 3, 18).fillRect(30, 12, 14, 3);
    g.fillStyle(0x12101c, 1).fillRect(29, 31, 6, 2).fillRect(39, 31, 6, 2);
    g.fillStyle(0x7c2d12, 1).fillRect(58, 42, 4, 28).fillRoundedRect(50, 34, 20, 12, 2); // the gavel
  } },
  einstein: { w: 72, h: 84, draw: (g) => { // Gottfried the Rival Proof
    g.fillStyle(0x4c1d95, 1).fillTriangle(10, 84, 36, 36, 62, 84);
    g.fillStyle(0xe7e5e4, 1); for (const [x, y] of [[20, 14], [14, 26], [52, 14], [58, 26], [30, 8], [42, 8], [12, 38], [60, 38]]) g.fillCircle(x, y, 9); // a grander wig than yours
    g.fillStyle(0xf1c7a3, 1).fillRoundedRect(25, 16, 22, 24, 7);
    g.fillStyle(0x12101c, 1).fillCircle(31, 27, 1.8).fillCircle(41, 27, 1.8);
    g.lineStyle(4, 0xfacc15, 1).beginPath().moveTo(44, 78).lineTo(38, 74).lineTo(36, 50).lineTo(30, 46).strokePath(); // the integral he's waving at you
  } },
  ada: { w: 86, h: 98, draw: (g) => { // The Difference Engine
    g.fillStyle(0x3f3f46, 1).fillRect(18, 10, 50, 74);
    g.fillStyle(0xb45309, 1); for (let y = 16; y < 80; y += 12) for (let x = 22; x < 64; x += 11) g.fillCircle(x + 3, y + 3, 4.5);
    g.fillStyle(0xfacc15, 1); for (let y = 16; y < 80; y += 12) for (let x = 22; x < 64; x += 11) g.fillCircle(x + 3, y + 3, 1.6);
    g.fillStyle(0x18181b, 1).fillCircle(20, 88, 10).fillCircle(66, 88, 10);
    g.fillStyle(0x71717a, 1).fillCircle(20, 88, 4).fillCircle(66, 88, 4);
    g.fillStyle(0xef4444, 1).fillRect(26, 2, 34, 10);
    g.fillStyle(0xfef2f2, 1).fillRect(32, 5, 22, 3);
    g.fillStyle(0xd4d4d8, 1).fillRect(68, 30, 16, 5).fillRect(2, 44, 16, 5);
  } },
  suntzu: { w: 62, h: 90, draw: (g) => { // The Mirror General
    g.fillStyle(0x1e1b4b, 1).fillRect(20, 66, 8, 24).fillRect(34, 66, 8, 24);
    g.fillStyle(0x7c3aed, 1).fillRoundedRect(14, 32, 34, 36, 4);
    g.fillStyle(0xc4b5fd, 1).fillTriangle(14, 32, 31, 52, 20, 68).fillTriangle(48, 32, 31, 52, 42, 68);
    g.fillStyle(0xdbeafe, 1).fillRoundedRect(20, 10, 22, 23, 6); // a mirror for a face
    g.lineStyle(2, 0x7dd3fc, 1).lineBetween(24, 14, 38, 28).lineBetween(36, 12, 26, 24);
    g.fillStyle(0x12101c, 1).fillRoundedRect(23, 3, 16, 9, 2).fillCircle(31, 2, 3);
    g.fillStyle(0xdbeafe, 1).fillTriangle(50, 40, 60, 40, 55, 4); // a blade of mirror
  } },
  frida: { w: 84, h: 94, draw: (g) => { // The Living Canvas
    g.fillStyle(0x92400e, 1).fillRect(6, 4, 72, 70);
    g.fillStyle(0xfef3c7, 1).fillRect(12, 10, 60, 58);
    g.fillStyle(0xdb2777, 1).fillCircle(32, 32, 16);
    g.fillStyle(0x2563eb, 1).fillCircle(54, 44, 14);
    g.fillStyle(0xfacc15, 1).fillCircle(26, 54, 10);
    g.fillStyle(0x0c0a09, 1).fillCircle(32, 32, 5).fillCircle(54, 38, 5);
    g.fillStyle(0xffffff, 1).fillCircle(33, 31, 1.5).fillCircle(55, 37, 1.5);
    g.fillStyle(0xdb2777, 1).fillRect(20, 74, 5, 16).fillCircle(22.5, 90, 3.5);
    g.fillStyle(0x2563eb, 1).fillRect(44, 74, 5, 12).fillCircle(46.5, 86, 3.5);
    g.fillStyle(0xfacc15, 1).fillRect(62, 74, 4, 18).fillCircle(64, 91, 3);
  } },
  leo: { w: 92, h: 110, draw: (g) => { // The Marble Titan
    g.fillStyle(0xd6d3d1, 1).fillRoundedRect(26, 72, 16, 38, 4).fillRoundedRect(50, 72, 16, 38, 4);
    g.fillStyle(0xe7e5e4, 1).fillRoundedRect(18, 28, 56, 48, 10);
    g.fillStyle(0xd6d3d1, 1).fillRoundedRect(4, 30, 16, 46, 7).fillRoundedRect(72, 30, 16, 46, 7);
    g.fillStyle(0xa8a29e, 1).fillRect(45, 34, 2, 30).fillRect(28, 46, 36, 2);
    g.fillStyle(0xe7e5e4, 1).fillRoundedRect(32, 4, 28, 28, 8);
    g.fillStyle(0xa8a29e, 1); for (const [x, y] of [[32, 6], [39, 3], [46, 3], [53, 3], [60, 6]]) g.fillCircle(x, y, 4); // curls
    g.fillStyle(0x57534e, 1).fillCircle(40, 18, 2).fillCircle(52, 18, 2).fillRect(42, 25, 8, 2);
    g.lineStyle(1, 0x78716c, 1).lineBetween(20, 60, 34, 74).lineBetween(70, 40, 58, 58); // chisel marks
  } },
};

import { LEVELS, largestUnbridgedGap } from '../data/levels';
import { PHYS, PHYS_DEFAULTS, jumpReach, type PhysKey } from '../data/platformerConfig';

/**
 * Playtest-only feel tuner for Pog Quest. Open the game with `?tune` in
 * the URL and a slider panel appears over the platformer; every change
 * applies live to PHYS. Values persist per browser (localStorage) so a
 * tuning session survives reloads, and COPY puts the current values on
 * the clipboard to paste back into platformerConfig.ts.
 *
 * Without `?tune` this is a no-op and PHYS keeps its shipped defaults.
 */
const STORAGE_KEY = 'pogquest:tune';
/** a platform this far below the jump peak is comfortably landable */
const CLIMB_MARGIN_PX = 8;

const SLIDERS: { key: PhysKey; min: number; max: number; step: number }[] = [
  { key: 'gravityY', min: 800, max: 3200, step: 50 },
  { key: 'fallGravityMultiplier', min: 1, max: 2.5, step: 0.05 },
  { key: 'jumpVelocity', min: -900, max: -400, step: 10 },
  { key: 'jumpCutMultiplier', min: 0.1, max: 1, step: 0.05 },
  { key: 'maxFallSpeed', min: 500, max: 1500, step: 25 },
  { key: 'moveSpeed', min: 120, max: 360, step: 5 },
  { key: 'moveAccel', min: 400, max: 4000, step: 50 },
  { key: 'coyoteMs', min: 0, max: 200, step: 5 },
  { key: 'jumpBufferMs', min: 0, max: 200, step: 5 },
  { key: 'rivalMoveSpeed', min: 100, max: 320, step: 5 },
];

function tuningEnabled(): boolean {
  try {
    return new URLSearchParams(window.location.search).has('tune');
  } catch {
    return false;
  }
}

function loadSaved(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as Partial<Record<PhysKey, number>>;
    for (const { key } of SLIDERS) {
      if (typeof saved[key] === 'number' && Number.isFinite(saved[key])) PHYS[key] = saved[key]!;
    }
  } catch {
    // unreadable storage: stay on defaults
  }
}

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(PHYS));
  } catch {
    // private window etc. - tuning still works for this session
  }
}

/** mounts the panel if `?tune` is set; returns an unmount function (always safe to call) */
export function mountTuningPanel(): () => void {
  if (!tuningEnabled()) return () => {};
  loadSaved();

  const panel = document.createElement('div');
  panel.id = 'pogquest-tune';
  panel.style.cssText = [
    'position:fixed', 'top:8px', 'left:8px', 'z-index:1000', 'width:230px', 'max-height:calc(100vh - 16px)',
    'overflow:auto', 'padding:8px 10px', 'background:rgba(11,7,20,0.92)', 'color:#fff', 'border:1px solid #362a52',
    'border-radius:8px', 'font:11px system-ui,sans-serif',
  ].join(';');

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-weight:bold';
  header.textContent = 'Pog Quest tuning';
  const toggle = document.createElement('button');
  toggle.textContent = '–';
  toggle.style.cssText = 'background:#362a52;color:#fff;border:0;border-radius:4px;padding:0 8px;cursor:pointer';
  header.appendChild(toggle);
  panel.appendChild(header);

  const body = document.createElement('div');
  panel.appendChild(body);
  toggle.onclick = () => {
    const hidden = body.style.display === 'none';
    body.style.display = hidden ? '' : 'none';
    toggle.textContent = hidden ? '–' : '+';
  };

  const reach = document.createElement('div');
  reach.style.cssText = 'margin:4px 0 8px;color:#f9d64b';
  const refreshReach = () => {
    const r = jumpReach();
    const widest = Math.max(...LEVELS.map((l) => largestUnbridgedGap(l, r.peakPx - CLIMB_MARGIN_PX)));
    const ok = r.distancePx >= widest;
    reach.innerHTML = `jump: ${Math.round(r.peakPx)}px high · ${Math.round(r.distancePx)}px far<br>` +
      `<span style="color:${ok ? '#4ade80' : '#ef4444'}">widest open pit: ${widest}px ${ok ? '✓ clearable' : '✗ TOO WIDE'}</span>`;
  };
  body.appendChild(reach);

  const inputs = new Map<PhysKey, { range: HTMLInputElement; value: HTMLSpanElement }>();
  for (const s of SLIDERS) {
    const row = document.createElement('label');
    row.style.cssText = 'display:block;margin-bottom:4px';
    const name = document.createElement('div');
    name.style.cssText = 'display:flex;justify-content:space-between';
    const value = document.createElement('span');
    name.append(document.createTextNode(s.key), value);
    const range = document.createElement('input');
    range.type = 'range';
    range.min = String(s.min);
    range.max = String(s.max);
    range.step = String(s.step);
    range.style.width = '100%';
    range.oninput = () => {
      PHYS[s.key] = Number(range.value);
      value.textContent = range.value;
      refreshReach();
      save();
    };
    row.append(name, range);
    body.appendChild(row);
    inputs.set(s.key, { range, value });
  }

  const sync = () => {
    for (const [key, { range, value }] of inputs) {
      range.value = String(PHYS[key]);
      value.textContent = String(PHYS[key]);
    }
    refreshReach();
  };

  const buttons = document.createElement('div');
  buttons.style.cssText = 'display:flex;gap:6px;margin-top:6px';
  const mkButton = (label: string, onClick: () => void) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'flex:1;background:#f9d64b;color:#221a10;border:0;border-radius:4px;padding:4px;font-weight:bold;cursor:pointer';
    b.onclick = onClick;
    buttons.appendChild(b);
    return b;
  };
  const copy = mkButton('COPY', () => {
    const text = JSON.stringify(PHYS, null, 2);
    void navigator.clipboard?.writeText(text).then(
      () => { copy.textContent = 'COPIED'; },
      () => { console.log(text); copy.textContent = 'SEE CONSOLE'; },
    );
    setTimeout(() => { copy.textContent = 'COPY'; }, 1200);
  });
  mkButton('RESET', () => {
    Object.assign(PHYS, PHYS_DEFAULTS);
    save();
    sync();
  });
  body.appendChild(buttons);

  sync();
  document.body.appendChild(panel);
  return () => panel.remove();
}

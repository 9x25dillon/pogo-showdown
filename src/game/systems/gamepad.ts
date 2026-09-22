/**
 * Controller support (Xbox and other "standard"-mapping pads) via the
 * browser Gamepad API, polled directly rather than through Phaser's
 * gamepad plugin so it needs no game-config change and tests can stub
 * `navigator.getGamepads`.
 *
 * Standard mapping (what Chrome/Firefox report for an Xbox pad):
 *   0 A · 1 B · 2 X · 3 Y · 4 LB · 5 RB · 6 LT · 7 RT · 8 View · 9 Menu
 *   12-15 D-pad up/down/left/right · axes 0/1 left stick
 *
 * Browsers hide pads until a button is pressed while the page has focus.
 */
export interface PadButtons {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  a: boolean;
  b: boolean;
  x: boolean;
  y: boolean;
  lb: boolean;
  rb: boolean;
  lt: boolean;
  rt: boolean;
  view: boolean;
  menu: boolean;
}

export interface PadFrame {
  index: number;
  id: string;
  held: PadButtons;
  /** true only on the frame the button went down */
  pressed: PadButtons;
}

const STICK_DEADZONE = 0.4;
const KEYS: (keyof PadButtons)[] = ['left', 'right', 'up', 'down', 'a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'view', 'menu'];

export function emptyButtons(): PadButtons {
  return { left: false, right: false, up: false, down: false, a: false, b: false, x: false, y: false, lb: false, rb: false, lt: false, rt: false, view: false, menu: false };
}

function button(pad: Gamepad, i: number): boolean {
  const b = pad.buttons[i];
  return !!b && (b.pressed || b.value > 0.5);
}

function toButtons(pad: Gamepad): PadButtons {
  const ax = pad.axes[0] ?? 0;
  const ay = pad.axes[1] ?? 0;
  return {
    left: button(pad, 14) || ax < -STICK_DEADZONE,
    right: button(pad, 15) || ax > STICK_DEADZONE,
    up: button(pad, 12) || ay < -STICK_DEADZONE,
    down: button(pad, 13) || ay > STICK_DEADZONE,
    a: button(pad, 0),
    b: button(pad, 1),
    x: button(pad, 2),
    y: button(pad, 3),
    lb: button(pad, 4),
    rb: button(pad, 5),
    lt: button(pad, 6),
    rt: button(pad, 7),
    view: button(pad, 8),
    menu: button(pad, 9),
  };
}

let lastTime = Number.NaN;
let cached: PadFrame[] = [];
const prevHeld = new Map<number, PadButtons>();

/**
 * Connected pads in index order. Pass the scene's update `time`: every
 * scene running in the same frame gets the same result, so a press is
 * seen by all of them exactly once (the Menu press that pauses the run
 * can't also resume it from the pause scene).
 */
export function readPads(time: number): PadFrame[] {
  if (time === lastTime) return cached;
  lastTime = time;
  let raw: readonly (Gamepad | null)[] = [];
  try {
    raw = navigator.getGamepads?.() ?? [];
  } catch {
    raw = [];
  }
  const frames: PadFrame[] = [];
  const seen = new Set<number>();
  for (const pad of raw) {
    if (!pad || !pad.connected) continue;
    seen.add(pad.index);
    const held = toButtons(pad);
    const prev = prevHeld.get(pad.index) ?? emptyButtons();
    const pressed = emptyButtons();
    for (const k of KEYS) pressed[k] = held[k] && !prev[k];
    prevHeld.set(pad.index, held);
    frames.push({ index: pad.index, id: pad.id, held, pressed });
  }
  for (const index of [...prevHeld.keys()]) if (!seen.has(index)) prevHeld.delete(index);
  cached = frames;
  return frames;
}

/** OR together several pads (solo play: any connected pad drives player one) */
export function mergePads(frames: PadFrame[]): { held: PadButtons; pressed: PadButtons } {
  const held = emptyButtons();
  const pressed = emptyButtons();
  for (const f of frames) {
    for (const k of KEYS) {
      held[k] ||= f.held[k];
      pressed[k] ||= f.pressed[k];
    }
  }
  return { held, pressed };
}

/** short rumble on pads that support it; silently does nothing elsewhere */
export function rumble(index: number, durationMs = 140, strength = 0.6): void {
  try {
    const pad = navigator.getGamepads?.()[index] as (Gamepad & {
      vibrationActuator?: { playEffect?: (type: string, params: Record<string, number>) => Promise<unknown> };
    }) | null;
    void pad?.vibrationActuator?.playEffect?.('dual-rumble', {
      duration: durationMs,
      strongMagnitude: strength,
      weakMagnitude: strength / 2,
    })?.catch(() => undefined);
  } catch {
    // no haptics
  }
}

/** friendly name for the HUD: "Xbox controller" for the usual ids, else the raw id trimmed */
export function padLabel(id: string): string {
  if (/xbox|x-box|microsoft|045e/i.test(id)) return 'Xbox controller';
  const trimmed = id.replace(/\(.*?\)/g, '').trim();
  return trimmed.length > 28 ? `${trimmed.slice(0, 28)}…` : trimmed || 'controller';
}

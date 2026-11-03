/** Touch screens only ever hear about touch; keyboards and pads keep their full key lists. */
export function isTouch(): boolean {
  return typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0
    && typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

/** the "stand here and press" prefix on world prompts */
export function interactKey(): string {
  return isTouch() ? 'Tap here' : '▼ / S / tap';
}

export function hint(desktop: string, touch: string): string {
  return isTouch() ? touch : desktop;
}

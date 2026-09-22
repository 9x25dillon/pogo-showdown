import Phaser from 'phaser';
import { mergePads, readPads } from '../systems/gamepad';

/**
 * Controller navigation for a scene's existing tap buttons: D-pad/stick
 * moves a focus ring, A "taps" the focused button (emits its own
 * pointerdown, so every button keeps a single code path), B goes back.
 * The ring only appears while a controller is connected.
 */
export interface PadMenuOptions {
  initial?: number;
  onBack?: () => void;
  /** Menu/Start button; defaults to onBack */
  onMenu?: () => void;
  /** LB (-1) / RB (+1), e.g. to switch tabs */
  onShoulder?: (dir: -1 | 1) => void;
}

type Focusable = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform & {
  displayWidth: number;
  displayHeight: number;
};

export function attachPadMenu(scene: Phaser.Scene, items: Focusable[], opts: PadMenuOptions = {}): void {
  if (items.length === 0 && !opts.onBack) return;
  let index = Phaser.Math.Clamp(opts.initial ?? 0, 0, Math.max(0, items.length - 1));
  const ring = scene.add.rectangle(0, 0, 10, 10).setStrokeStyle(3, 0xffffff, 0.95).setDepth(60).setVisible(false);

  const place = () => {
    const item = items[index];
    if (!item) return;
    ring.setPosition(item.x, item.y).setSize(item.displayWidth + 12, item.displayHeight + 12);
    ring.setOrigin(0.5);
  };

  const onUpdate = (time: number) => {
    const pads = readPads(time);
    ring.setVisible(pads.length > 0 && items.length > 0);
    if (pads.length === 0) return;
    const { pressed } = mergePads(pads);
    if (items.length > 0) {
      if (pressed.down || pressed.right) index = (index + 1) % items.length;
      if (pressed.up || pressed.left) index = (index - 1 + items.length) % items.length;
      place();
      const item = items[index];
      if (pressed.a && item.input?.enabled) {
        item.emit('pointerdown');
        return;
      }
    }
    if (pressed.lb) opts.onShoulder?.(-1);
    else if (pressed.rb) opts.onShoulder?.(1);
    else if (pressed.b) opts.onBack?.();
    else if (pressed.menu) (opts.onMenu ?? opts.onBack)?.();
  };

  place();
  scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate));
}

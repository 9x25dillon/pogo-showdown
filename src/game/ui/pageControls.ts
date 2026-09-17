import Phaser from 'phaser';
import { WIDTH } from '../config';

/** Fixed-size touch targets for collection grids. Page indices are zero-based. */
export function addPageControls(
  scene: Phaser.Scene,
  page: number,
  total: number,
  pageSize: number,
  y: number,
  onPage: (page: number) => void,
): void {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return;

  const style = { fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#b7aed0' };
  scene.add.text(WIDTH / 2, y, `${page + 1} / ${pages}`, style).setOrigin(0.5);
  let navigating = false;
  for (const direction of [-1, 1]) {
    const target = page + direction;
    const enabled = target >= 0 && target < pages;
    const x = WIDTH / 2 + direction * 142;
    const button = scene.add.rectangle(x, y, 112, 44, 0x1c1430).setStrokeStyle(1, 0x362a52);
    scene.add.text(x, y, direction < 0 ? '← previous' : 'next →', style).setOrigin(0.5).setAlpha(enabled ? 1 : 0.3);
    if (enabled) {
      button.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        if (navigating) return;
        navigating = true;
        onPage(target);
      });
    }
  }
}

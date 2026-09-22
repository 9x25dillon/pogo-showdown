import Phaser from 'phaser';
import { COLORS } from '../config';
import { attachPadMenu } from '../ui/padMenu';

/**
 * A separate scene freezes gameplay physics, timers, and tweens together.
 * Shared by Pog Quest (`PlatformerRun`) and the Forever Realm (`Realm`),
 * and laid out from the live game size so it works in portrait and landscape.
 */
export interface PauseData {
  target?: 'PlatformerRun' | 'Realm';
}

export class PlatformerPauseScene extends Phaser.Scene {
  private target: NonNullable<PauseData['target']> = 'PlatformerRun';

  constructor() {
    super('PlatformerPause');
  }

  create(data: PauseData = {}): void {
    this.target = data.target ?? 'PlatformerRun';
    const w = this.scale.width;
    const h = this.scale.height;
    const cy = h / 2;
    this.add.rectangle(w / 2, cy, w, h, COLORS.bg, 0.9).setInteractive();
    this.add.text(w / 2, cy - 182, 'PAUSED', {
      fontFamily: 'system-ui, sans-serif', fontSize: '32px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5);

    const buttons = [this.button(cy - 77, 'RESUME', () => this.resumeRun())];
    if (this.target === 'Realm') {
      // erasing a world takes two presses
      const newWorld = this.button(cy - 2, 'NEW WORLD', () => {
        (newWorld.getData('label') as Phaser.GameObjects.Text).setText('AGAIN TO ERASE WORLD');
        newWorld.once('pointerdown', () => this.leave('Realm', { newWorld: true }));
      });
      buttons.push(newWorld);
      buttons.push(this.button(cy + 73, 'SAVE & QUIT', () => this.leave('ModeSelect')));
    } else {
      buttons.push(this.button(cy - 2, 'RETRY LEVEL', () => this.leave('PlatformerRun')));
      buttons.push(this.button(cy + 73, 'MENU', () => this.leave('ModeSelect')));
    }
    // B or Menu resumes, mirroring Escape
    attachPadMenu(this, buttons, { onBack: () => this.resumeRun() });

    const onEscape = (event: KeyboardEvent) => {
      if (!event.repeat) this.resumeRun();
    };
    this.input.keyboard?.on('keydown-ESC', onEscape);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.off('keydown-ESC', onEscape));
  }

  private resumeRun(): void {
    this.scene.resume(this.target);
    this.scene.stop();
  }

  private leave(next: string, data?: object): void {
    this.scene.stop(this.target);
    this.scene.start(next, data);
  }

  private button(y: number, label: string, action: () => void): Phaser.GameObjects.Rectangle {
    const w = this.scale.width;
    const button = this.add.rectangle(w / 2, y, 280, 54, COLORS.accent)
      .setInteractive({ useHandCursor: true });
    const text = this.add.text(w / 2, y, label, {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#221a10',
    }).setOrigin(0.5);
    button.setData('label', text);
    button.once('pointerdown', action);
    return button;
  }
}

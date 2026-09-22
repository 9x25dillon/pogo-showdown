import Phaser from 'phaser';
import { COLORS, HEIGHT, WIDTH } from '../config';
import { attachPadMenu } from '../ui/padMenu';

/** A separate scene freezes gameplay physics, timers, and tweens together. */
export class PlatformerPauseScene extends Phaser.Scene {
  constructor() {
    super('PlatformerPause');
  }

  create(): void {
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, COLORS.bg, 0.9).setInteractive();
    this.add.text(WIDTH / 2, 245, 'PAUSED', {
      fontFamily: 'system-ui, sans-serif', fontSize: '32px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5);
    const buttons = [
      this.button(350, 'RESUME', () => this.resumeRun()),
      this.button(425, 'RETRY LEVEL', () => {
        this.scene.stop('PlatformerRun');
        this.scene.start('PlatformerRun');
      }),
      this.button(500, 'MENU', () => {
        this.scene.stop('PlatformerRun');
        this.scene.start('ModeSelect');
      }),
    ];
    // B or Menu resumes, mirroring Escape
    attachPadMenu(this, buttons, { onBack: () => this.resumeRun() });
    const onEscape = (event: KeyboardEvent) => {
      if (!event.repeat) this.resumeRun();
    };
    this.input.keyboard?.on('keydown-ESC', onEscape);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard?.off('keydown-ESC', onEscape));
  }

  private resumeRun(): void {
    this.scene.resume('PlatformerRun');
    this.scene.stop();
  }

  private button(y: number, label: string, action: () => void): Phaser.GameObjects.Rectangle {
    const button = this.add.rectangle(WIDTH / 2, y, 280, 54, COLORS.accent)
      .setInteractive({ useHandCursor: true });
    this.add.text(WIDTH / 2, y, label, {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#221a10',
    }).setOrigin(0.5);
    button.once('pointerdown', action);
    return button;
  }
}

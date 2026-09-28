import Phaser from 'phaser';
import { LEVELS } from '../data/levels';
import { pogDef } from '../data/pogs';
import { isLevelUnlocked, questProgressFor, QUEST_FIRST_CLEAR_XP, QUEST_XP_PER_LEVEL } from '../db/questRepository';
import type { PadButtons } from '../systems/gamepad';
import { RealmPanel } from './RealmPanel';
import type { RealmHero } from './RealmHero';
import { RIFT_COLOR, placeRifts, type RiftSpot } from './rifts';
import type { World } from './worldGen';

interface RiftHost {
  world: World;
  player: () => { x: number; y: number };
  hero: () => RealmHero;
  reserved: () => number[];
  available: () => boolean;
  pause: (open: boolean) => void;
  notify: (title: string, sub: string) => void;
  enter: (levelIndex: number) => void;
}

const FONT = 'system-ui, sans-serif';

/** Pog Quest rifts standing in the overworld: discovery, the sequence, and stepping through. */
export class RealmRifts {
  readonly spots: RiftSpot[];
  private art: Phaser.GameObjects.Container;
  private panel: RealmPanel;
  private target = -1;
  private scene: Phaser.Scene;
  private host: RiftHost;

  constructor(scene: Phaser.Scene, host: RiftHost, saved?: RiftSpot[]) {
    this.scene = scene;
    this.host = host;
    this.spots = saved?.length === LEVELS.length ? saved : placeRifts(host.world, host.reserved());
    this.art = scene.add.container(0, 0).setDepth(3);
    this.panel = new RealmPanel(scene, { view: () => this.view(), onClose: () => { this.panel.close(); this.host.pause(false); } });
    this.draw();
  }

  get open(): boolean { return this.panel.open; }

  private get profile() { return this.host.hero().snap.profile; }
  state(i: number): 'sealed' | 'open' | 'cleared' {
    if (questProgressFor(this.profile, LEVELS[i].id).clears > 0) return 'cleared';
    return isLevelUnlocked(this.profile, i) ? 'open' : 'sealed';
  }

  /** the rift the quest points you at next: the first open solo rift, else any open one */
  nextRift(): number {
    const open = LEVELS.map((_, i) => i).filter((i) => this.state(i) === 'open');
    return open.find((i) => !LEVELS[i].coop) ?? open[0] ?? -1;
  }

  cleared(): number {
    return LEVELS.filter((_, i) => this.state(i) === 'cleared').length;
  }

  private draw(): void {
    this.art.removeAll(true);
    this.spots.forEach((s, i) => {
      const state = this.state(i);
      const x = (s.tx + 1.5) * 16;
      const y = (s.ty + 1) * 16;
      const glow = this.scene.add.ellipse(x, y - 30, 30, 52, RIFT_COLOR[state], state === 'sealed' ? 0.25 : 0.55);
      const core = this.scene.add.ellipse(x, y - 30, 14, 34, 0x0b0714, state === 'sealed' ? 0.8 : 0.6);
      if (state !== 'sealed') this.scene.tweens.add({ targets: glow, scaleX: 1.15, alpha: 0.3, duration: 900 + i * 37, yoyo: true, repeat: -1 });
      const level = LEVELS[i];
      const label = this.scene.add.text(x, y - 60, `${state === 'cleared' ? '✓ ' : state === 'sealed' ? '🔒 ' : '🌀 '}Rift ${i + 1} · ${level.name}${level.coop ? ' (co-op)' : ''}`, {
        fontSize: '9px', fontFamily: FONT, fontStyle: 'bold', color: state === 'cleared' ? '#fde68a' : '#ffffff', backgroundColor: '#0b0714aa', padding: { x: 3, y: 1 },
      }).setOrigin(0.5, 1);
      this.art.add([glow, core, label]);
    });
  }

  nearby(): number {
    const p = this.host.player();
    return this.spots.findIndex((s) => Math.abs((s.tx + 1.5) * 16 - p.x) < 26 && Math.abs((s.ty + 1) * 16 - p.y) < 40);
  }

  prompt(): string {
    const i = this.nearby();
    if (i < 0) return '';
    const state = this.state(i);
    if (state === 'sealed') return `🔒 Rift ${i + 1} is sealed · clear the rifts before it first`;
    return `▼ / S / tap · step into Rift ${i + 1}: ${LEVELS[i].name}`;
  }

  interact(): void {
    const i = this.nearby();
    if (i < 0 || this.state(i) === 'sealed' || !this.host.available()) return;
    this.target = i;
    this.host.pause(true);
    this.panel.show();
  }

  private view() {
    const i = this.target;
    const level = LEVELS[i];
    const progress = questProgressFor(this.profile, level.id);
    const pog = level.rewardPogId ? pogDef(level.rewardPogId) : undefined;
    const first = progress.clears === 0;
    return {
      title: `🌀 RIFT ${i + 1} · ${level.name.toUpperCase()}`,
      subtitle: `${level.coop ? 'Co-op: a second player joins on the arrow keys or a second pad. ' : ''}${level.bossLevel ? 'A boss waits inside. ' : 'Race your rival to the flag. '}Your hero goes in as they are; you come back out right here.`,
      rows: [
        { label: `Step through · ${progress.attempts} attempts · ${progress.clears} clears${progress.bestTimeSeconds !== null ? ` · best ${progress.bestTimeSeconds.toFixed(1)}s` : ''}`, action: () => { this.panel.close(); this.host.enter(i); } },
        { label: first ? `First clear: +${QUEST_FIRST_CLEAR_XP + i * QUEST_XP_PER_LEVEL} XP (banked) · +1 Tech Point${pog ? ` · ${pog.emoji} ${pog.name}` : ''}` : 'Repeat clears: +30 XP (banked) · coins become copper ore', enabled: false },
      ],
      accent: RIFT_COLOR[this.state(i)],
    };
  }

  recordLines(): string[] {
    const next = this.nextRift();
    return [`Quest rifts · ${this.cleared()}/${LEVELS.length} cleared${next >= 0 ? ` · next: Rift ${next + 1}, ${LEVELS[next].name}` : ''}`];
  }

  update(): void {
    const p = this.host.player();
    this.spots.forEach((s, i) => {
      if (s.seen || Math.hypot((s.tx + 1.5) * 16 - p.x, (s.ty + 1) * 16 - p.y) > 220) return;
      s.seen = true;
      if (this.state(i) !== 'sealed') this.host.notify(`🌀 RIFT ${i + 1}`, `${LEVELS[i].name} · marked on your map`);
    });
  }

  updateInput(pressed: PadButtons, keys: Record<string, Phaser.Input.Keyboard.Key>): void {
    this.panel.updateInput(pressed, keys);
  }
}

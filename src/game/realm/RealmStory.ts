import Phaser from 'phaser';
import { interactKey } from '../systems/inputHints';
import { CHAPTERS, chapterDone, finale, newStory, objectiveText, type StoryLine, type StoryProgress, type StorySave } from './story';
import { TILE, type World } from './worldGen';

export interface StoryHost {
  world: World;
  player: () => Phaser.Physics.Arcade.Sprite;
  progress: () => StoryProgress;
  /** in the overworld, with nothing on screen that a scene would interrupt */
  calm: () => boolean;
  play: (lines: StoryLine[], done?: () => void) => void;
  notify: (title: string, sub: string) => void;
  save: () => void;
  /** chapter six: Ms. Clio opens the trophy case */
  lendRelics: () => void;
  /** this is Story Mode's own gift, spent once */
  gift: (ask: string, id: string) => void;
}

const OPEN_WORLD_HINTS = [
  'Monsters flash before they strike. Double-tap a direction to roll through it, tap your shield to parry, hold it to block, and hold attack for a heavy blow.',
  'Everything you build can be unbuilt. Open HERO, then BUILD: items break back down into what they were made of.',
  'Your hero has a nemesis, and a weapon only they can carry. Open HERO, then QUEST.',
  'The shrine to the east holds four doors. Each ruler behind one keeps a relic, and four relics open the Forever Gate.',
  'XP only counts once you rest in a bed or win a realm. Dying loses half of what you carry.',
  'Duelists, dash flags, the arena and the purple rifts are all out there. I have written most of them down.',
];

/**
 * Runs the story: plays each chapter's scene when it can, advances when the
 * world says the objectives are met, and keeps Ms. Clio standing at spawn. She
 * is here in every world, but only a Story Mode world has `data`.
 */
export class RealmStory {
  readonly data?: StorySave;
  private host: StoryHost;
  private npc?: Phaser.GameObjects.Image;
  private hintIndex = 0;
  private checkTimer = 0;

  constructor(scene: Phaser.Scene, host: StoryHost, story?: StorySave) {
    this.host = host;
    this.data = story;
    if (!('pocket' in host.world)) {
      const { tx } = host.world.spawn;
      const nx = tx + 4;
      this.npc = scene.add.image((nx + 0.5) * TILE, host.world.surface[nx] * TILE, 'npc_clio').setOrigin(0.5, 1).setDepth(8);
      scene.tweens.add({ targets: this.npc, y: this.npc.y - 2, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  static fresh(): StorySave { return newStory(); }

  get active(): boolean { return !!this.data && !this.data.finished; }
  get chapter() { return this.data ? CHAPTERS[Math.min(this.data.chapter, CHAPTERS.length - 1)] : undefined; }

  /** the HUD line: chapter and what's next */
  objective(): string {
    if (!this.active) return '';
    return `CH ${this.data!.chapter + 1}: ${this.chapter!.title} · ${objectiveText(this.chapter!, this.host.progress())} ›`;
  }

  /** Ms. Clio is right here */
  private near(): boolean {
    if (!this.npc) return false;
    const p = this.host.player();
    return Math.abs(p.x - this.npc.x) < TILE * 3 && Math.abs(p.y - this.npc.y) < TILE * 4;
  }

  prompt(): string {
    return this.near() ? `${interactKey()} · talk to Ms. Clio` : '';
  }

  interact(): void {
    if (!this.near()) return;
    const text = this.active ? this.chapter!.hint(this.host.progress().heroId) : OPEN_WORLD_HINTS[this.hintIndex++ % OPEN_WORLD_HINTS.length];
    this.host.play([{ who: 'clio', text }]);
  }

  update(dt: number): void {
    if (!this.active) return;
    this.checkTimer -= dt;
    if (this.checkTimer > 0) return;
    this.checkTimer = 400;
    const s = this.data!;
    if (s.played < s.chapter) {
      if (!this.host.calm()) return;
      s.played = s.chapter;
      if (s.chapter === CHAPTERS.length - 1) this.host.lendRelics();
      this.host.play(this.chapter!.scene(this.host.progress().heroId), () => this.host.save());
      return;
    }
    if (s.chapter < CHAPTERS.length - 1 && chapterDone(this.chapter!, this.host.progress())) {
      s.chapter++;
      this.host.notify(`CHAPTER ${s.chapter + 1}`, CHAPTERS[s.chapter].title);
      this.checkTimer = 1400; // let the banner land before the scene opens
      this.host.save();
    }
  }

  answer(ask: string, id: string): void {
    if (!this.data) return;
    const first = !this.data.choices[ask];
    this.data.choices[ask] = id;
    if (first) this.host.gift(ask, id);
  }

  /** the Reaper is down: the last scene, then the ending */
  runFinale(then: () => void): void {
    if (!this.data) { then(); return; }
    this.host.play(finale(this.host.progress().heroId), () => {
      this.data!.finished = true;
      this.host.save();
      then();
    });
  }
}

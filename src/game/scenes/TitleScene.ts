import Phaser from 'phaser';
import { COLORS, HEIGHT, WIDTH } from '../config';
import { CHARACTERS } from '../data/characters';
import { getProfile } from '../db/repository';
import type { PlayerProfile } from '../db/schema';
import { HERO_PERKS, levelForXp, masteryTierForLevel } from '../realm/hero';
import { MASTERY_TIERS } from '../data/loadoutData';
import { heroId, heroXp, setHero } from '../realm/progression';
import { loadRealm } from '../realm/realmSave';
import { music } from '../systems/music';
import { attachPadMenu } from '../ui/padMenu';

const FONT = 'system-ui, sans-serif';

/**
 * The front door. Pogo Showdown is one game now: the Forever Realm, with
 * every duel, trick, dash, arena bout and quest rift living inside it.
 */
export class TitleScene extends Phaser.Scene {
  private profile?: PlayerProfile;
  private hasWorld = false;
  private confirmNew = false;

  constructor() {
    super('Title');
  }

  /** each view is its own scene start, so pad menus never stack */
  create(data: { view?: 'main' | 'confirm' | 'picker' } = {}): void {
    this.sys.settings.data = {};
    music.play('menu');
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.confirmNew = data.view === 'confirm';
    void Promise.all([getProfile(), loadRealm()]).then(([profile, save]) => {
      if (!this.scene.isActive()) return;
      this.profile = profile;
      this.hasWorld = !!save;
      if (data.view === 'picker') this.showPicker();
      else this.showMain();
    });
  }

  private heading(sub: string): void {
    this.add.text(WIDTH / 2, 92, 'POGO SHOWDOWN', { fontSize: '36px', fontFamily: FONT, fontStyle: 'bold', color: '#f9d64b' }).setOrigin(0.5);
    this.add.text(WIDTH / 2, 132, 'THE FOREVER REALM', { fontSize: '16px', fontFamily: FONT, fontStyle: 'bold', color: '#c4b5fd' }).setOrigin(0.5);
    this.add.text(WIDTH / 2, 160, sub, { fontSize: '13px', fontFamily: FONT, color: '#b7aed0', align: 'center', wordWrap: { width: 420 } }).setOrigin(0.5, 0);
  }

  private button(y: number, label: string, sub: string, color: number, onTap: () => void): Phaser.GameObjects.Rectangle {
    const b = this.add.rectangle(WIDTH / 2, y, 380, 76, 0x1c1430).setStrokeStyle(2, color).setInteractive({ useHandCursor: true });
    this.add.text(WIDTH / 2, y - 12, label, { fontSize: '22px', fontFamily: FONT, fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(WIDTH / 2, y + 18, sub, { fontSize: '12px', fontFamily: FONT, color: '#b7aed0' }).setOrigin(0.5);
    b.on('pointerdown', onTap);
    return b;
  }

  private showMain(): void {
    const profile = this.profile!;
    const id = heroId(profile);
    const hero = CHARACTERS.find((c) => c.id === id)!;
    const lv = levelForXp(heroXp(profile, id)).level;
    this.heading('history’s icons, one cursed open world: dig, build, duel, trick, dash and fight your way to the Forever Gate');
    const buttons: Phaser.GameObjects.Rectangle[] = [];
    if (this.hasWorld) {
      buttons.push(this.button(300, 'CONTINUE', `${hero.emoji} ${hero.name} · Lv ${lv}`, 0xf9d64b, () => this.scene.start('Realm')));
    }
    const newWorld = this.button(this.hasWorld ? 400 : 300, this.confirmNew ? 'AGAIN TO ERASE WORLD' : 'NEW WORLD',
      this.hasWorld ? 'a fresh world · your heroes, pogs and Tech Points stay' : 'pick a hero and raise the realm', 0x8b5cf6, () => {
        this.scene.restart({ view: this.hasWorld && !this.confirmNew ? 'confirm' : 'picker' });
      });
    buttons.push(newWorld);
    this.add.text(WIDTH / 2, HEIGHT - 150, [
      'In the world: duel pog players · craft yoyos and land tricks in combat',
      'ride the pogo stick through dash trials · climb the Circuit arena',
      'step through quest rifts · win relics · open the Forever Gate',
    ].join('\n'), { fontSize: '12px', fontFamily: FONT, color: '#8b80a8', align: 'center', lineSpacing: 8 }).setOrigin(0.5);
    attachPadMenu(this, buttons);
  }

  private showPicker(): void {
    const profile = this.profile!;
    this.add.text(WIDTH / 2, 48, 'CHOOSE YOUR HERO', { fontSize: '24px', fontFamily: FONT, fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(WIDTH / 2, 76, 'each levels on their own · switch later at your bed or a campfire', { fontSize: '12px', fontFamily: FONT, color: '#b7aed0' }).setOrigin(0.5);
    const cards: Phaser.GameObjects.Rectangle[] = [];
    CHARACTERS.forEach((c, i) => {
      const y = 128 + i * 82;
      const lv = levelForXp(heroXp(profile, c.id)).level;
      const card = this.add.rectangle(WIDTH / 2, y, 440, 74, c.color, 0.12).setStrokeStyle(2, c.color, 0.8).setInteractive({ useHandCursor: true });
      this.add.text(40, y, c.emoji, { fontSize: '30px' }).setOrigin(0, 0.5);
      this.add.text(88, y - 20, `${c.name} · Lv ${lv} · ${MASTERY_TIERS[masteryTierForLevel(lv)].name}`, { fontSize: '15px', fontFamily: FONT, fontStyle: 'bold', color: '#ffffff' });
      this.add.text(88, y + 2, HERO_PERKS[c.id]?.label ?? c.perk, { fontSize: '12px', fontFamily: FONT, color: '#fde68a', wordWrap: { width: 360 } });
      card.on('pointerdown', () => {
        card.disableInteractive();
        void setHero(c.id).then(() => this.scene.start('Realm', { newWorld: true }));
      });
      cards.push(card);
    });
    const back = this.add.text(24, 20, '← back', { fontSize: '15px', fontFamily: FONT, color: '#b7aed0' }).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.restart({ view: 'main' }));
    attachPadMenu(this, cards, { initial: Math.max(0, CHARACTERS.findIndex((c) => c.id === heroId(profile))), onBack: () => this.scene.restart({ view: 'main' }) });
  }
}

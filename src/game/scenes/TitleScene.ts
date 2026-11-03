import Phaser from 'phaser';
import { APP_NAME, COLORS, RH, RW } from '../config';
import { CHARACTERS } from '../data/characters';
import { getProfile } from '../db/repository';
import type { PlayerProfile } from '../db/schema';
import { HERO_PERKS, levelForXp, masteryTierForLevel } from '../realm/hero';
import { MASTERY_TIERS } from '../data/loadoutData';
import { heroId, heroXp, setHero } from '../realm/progression';
import { nemesisFor } from '../realm/nemesis';
import { loadRealm } from '../realm/realmSave';
import { WEAPONS } from '../realm/weapons';
import { music } from '../systems/music';
import { attachPadMenu } from '../ui/padMenu';

const FONT = 'system-ui, sans-serif';

type View = 'main' | 'confirm' | 'picker';

/**
 * The front door: dusk over the school, with the clock stopped at three.
 * Eternity High is one game: Story Mode and the open world are the same realm,
 * and every duel, trick, dash, arena bout and quest rift lives inside it.
 */
export class TitleScene extends Phaser.Scene {
  private profile?: PlayerProfile;
  private hasWorld = false;
  private confirmNew = false;
  /** the picker starts a Story Mode world */
  private storyPick = false;

  constructor() {
    super('Title');
  }

  /** each view is its own scene start, so pad menus never stack */
  create(data: { view?: View; story?: boolean } = {}): void {
    this.sys.settings.data = {};
    this.scale.setGameSize(RW, RH);
    this.cameras.main.setSize(RW, RH);
    music.play('menu');
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.confirmNew = data.view === 'confirm';
    this.storyPick = !!data.story;
    this.add.image(RW / 2, RH / 2, 'title_art').setDisplaySize(RW, RH);
    void Promise.all([getProfile(), loadRealm()]).then(([profile, save]) => {
      if (!this.scene.isActive()) return;
      this.profile = profile;
      this.hasWorld = !!save;
      if (data.view === 'picker') this.showPicker();
      else this.showMain();
    });
  }

  private logo(): void {
    this.add.text(40, 26, APP_NAME.toUpperCase(), {
      fontSize: '58px', fontFamily: 'Georgia, serif', fontStyle: 'bold', color: '#ffe9a8', stroke: '#22082f', strokeThickness: 8,
      shadow: { offsetY: 4, color: '#a21caf', blur: 0, fill: false, stroke: true }, padding: { x: 4, y: 8 },
    });
    this.add.text(44, 104, 'One school day. It never ends. Somebody should do something.', {
      fontSize: '16px', fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#fbe7ff', stroke: '#22082f', strokeThickness: 4,
    });
  }

  private button(y: number, label: string, sub: string, color: number, onTap: () => void): Phaser.GameObjects.Rectangle {
    const x = 40 + 210;
    const b = this.add.rectangle(x, y, 420, 74, 0x150a26, 0.9).setStrokeStyle(3, color).setInteractive({ useHandCursor: true });
    this.add.text(x, y - 13, label, { fontSize: '23px', fontFamily: FONT, fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(x, y + 17, sub, { fontSize: '13px', fontFamily: FONT, color: '#d8cdea' }).setOrigin(0.5);
    b.on('pointerdown', onTap);
    return b;
  }

  private showMain(): void {
    const profile = this.profile!;
    const id = heroId(profile);
    const hero = CHARACTERS.find((c) => c.id === id)!;
    const lv = levelForXp(heroXp(profile, id)).level;
    this.logo();
    const buttons: Phaser.GameObjects.Rectangle[] = [];
    let y = 186;
    const row = (label: string, sub: string, color: number, tap: () => void) => { buttons.push(this.button(y, label, sub, color, tap)); y += 84; };
    if (this.hasWorld) row('CONTINUE', `${hero.name} · Lv ${lv}`, 0xf9d64b, () => this.scene.start('Realm'));
    const replace = this.hasWorld ? ' · replaces your world' : '';
    row('STORY MODE', `six chapters, about an hour · pick a hero${replace}`, 0xf472b6, () => this.scene.restart({ view: 'picker', story: true }));
    row(this.confirmNew ? 'AGAIN TO ERASE WORLD' : 'NEW WORLD', this.hasWorld ? 'endless open world · heroes, pogs and Tech Points stay' : 'endless open world · pick a hero', 0x8b5cf6, () => {
      this.scene.restart({ view: this.hasWorld && !this.confirmNew ? 'confirm' : 'picker' });
    });
    // the cast, waiting at the school gates
    CHARACTERS.forEach((c, i) => {
      const hx = RW - 40 - (CHARACTERS.length - 1 - i) * 60;
      this.add.image(hx, RH - 22, `realm_hero_${c.id}`).setOrigin(0.5, 1).setScale(2);
    });
    attachPadMenu(this, buttons);
  }

  private showPicker(): void {
    const profile = this.profile!;
    this.add.rectangle(RW / 2, RH / 2, RW, RH, 0x0b0714, 0.84);
    this.add.text(RW / 2, 28, this.storyPick ? 'STORY MODE: WHO ASKED THE WRONG QUESTION?' : 'CHOOSE YOUR HERO', { fontSize: '24px', fontFamily: FONT, fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(RW / 2, 56, 'each levels on their own, each has their own nemesis and weapon · switch later at your bed or a campfire', { fontSize: '13px', fontFamily: FONT, color: '#d8cdea' }).setOrigin(0.5);
    const cards: Phaser.GameObjects.Rectangle[] = [];
    const cols = 4;
    const cardW = Math.floor((RW - 40 - 12 * (cols - 1)) / cols);
    const cardH = 214;
    CHARACTERS.forEach((c, i) => {
      const x = 20 + cardW / 2 + (i % cols) * (cardW + 12);
      const y = 82 + cardH / 2 + Math.floor(i / cols) * (cardH + 10);
      const lv = levelForXp(heroXp(profile, c.id)).level;
      const card = this.add.rectangle(x, y, cardW, cardH, c.color, 0.16).setStrokeStyle(2, c.color, 0.9).setInteractive({ useHandCursor: true });
      this.add.image(x - cardW / 2 + 42, y - cardH / 2 + 104, `realm_hero_${c.id}`).setOrigin(0.5, 1).setScale(2);
      this.add.text(x - cardW / 2 + 80, y - cardH / 2 + 12, c.name, { fontSize: '17px', fontFamily: FONT, fontStyle: 'bold', color: '#ffffff', wordWrap: { width: cardW - 88 } });
      this.add.text(x - cardW / 2 + 80, y - cardH / 2 + 56, `${c.club}\nLv ${lv} · ${MASTERY_TIERS[masteryTierForLevel(lv)].name}`, { fontSize: '12px', fontFamily: FONT, color: '#d8cdea', wordWrap: { width: cardW - 88 } });
      this.add.text(x - cardW / 2 + 12, y - cardH / 2 + 114, HERO_PERKS[c.id]?.label ?? c.perk, { fontSize: '12px', fontFamily: FONT, color: '#fde68a', wordWrap: { width: cardW - 24 } });
      this.add.text(x - cardW / 2 + 12, y + cardH / 2 - 36, `⚔ ${nemesisFor(c.id).name}\n🔥 ${WEAPONS[c.id].name}`, { fontSize: '11px', fontFamily: FONT, color: '#fca5a5', lineSpacing: 2 });
      card.on('pointerdown', () => {
        card.disableInteractive();
        void setHero(c.id).then(() => this.scene.start('Realm', { newWorld: true, story: this.storyPick }));
      });
      cards.push(card);
    });
    const back = this.add.text(24, 16, '← back', { fontSize: '17px', fontFamily: FONT, color: '#d8cdea', padding: { x: 10, y: 8 } }).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.restart({ view: 'main' }));
    attachPadMenu(this, cards, { initial: Math.max(0, CHARACTERS.findIndex((c) => c.id === heroId(profile))), onBack: () => this.scene.restart({ view: 'main' }) });
  }
}

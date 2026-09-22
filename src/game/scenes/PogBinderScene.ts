import Phaser from 'phaser';
import { COLORS, HEIGHT, WIDTH } from '../config';
import { POG_CATALOG, RARITY_COLOR, RARITY_LABEL, RARITY_WEIGHT, describeActive, describePerks, pogDef } from '../data/pogs';
import { ensureStarterPog, equippedPerks, footpegCapacity, toggleEquip, weightOf } from '../db/pogRepository';
import { addPageControls } from '../ui/pageControls';
import type { PogInstance } from '../db/pogSchema';

const FONT = 'system-ui, sans-serif';

/**
 * The Pog Binder: every pog you own, tap to equip onto the footpeg.
 * Capacity is a weight budget (rarity 1-4) of 4 + Locker Pog Stack tier.
 */
export class PogBinderScene extends Phaser.Scene {
  private page = 0;
  private equipping = false;
  private toast?: Phaser.GameObjects.Text;

  constructor() {
    super('PogBinder');
  }

  create(data: { page?: number } = {}): void {
    this.page = data.page ?? 0;
    this.equipping = false;
    this.toast = undefined;
    this.cameras.main.setBackgroundColor(COLORS.bg);

    this.add
      .text(WIDTH / 2, 44, 'POG BINDER', { fontSize: '26px', fontFamily: FONT, fontStyle: 'bold', color: '#f97316' })
      .setOrigin(0.5);

    const back = this.add
      .text(WIDTH / 2, HEIGHT - 36, '← back to menu', { fontSize: '15px', fontFamily: FONT, color: '#b7aed0' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('ModeSelect'));

    void this.render();
  }

  private async render(): Promise<void> {
    const owned = await ensureStarterPog();
    const [cap, perks] = await Promise.all([footpegCapacity(), equippedPerks()]);
    if (!this.scene.isActive()) return;
    const equipped = owned.filter((i) => i.equipped);
    const used = weightOf(equipped);

    this.add
      .text(WIDTH / 2, 76, `footpeg ${used}/${cap} slots  ·  ${owned.length} owned  ·  ${new Set(owned.map((o) => o.defId)).size}/${POG_CATALOG.length} discovered`, {
        fontSize: '12px',
        fontFamily: FONT,
        color: '#b7aed0',
      })
      .setOrigin(0.5);

    // capacity bar
    const barW = 300;
    this.add.rectangle(WIDTH / 2, 98, barW, 8, 0x1c1430).setStrokeStyle(1, 0x362a52);
    if (used > 0) {
      this.add.rectangle(WIDTH / 2 - barW / 2, 98, (barW * used) / cap, 8, 0xf97316).setOrigin(0, 0.5);
    }

    const perkLines = describePerks(perks);
    this.add
      .text(WIDTH / 2, 122, perkLines.length ? `equipped: ${perkLines.join(' · ')}` : 'nothing equipped', {
        fontSize: '12px',
        fontFamily: FONT,
        fontStyle: 'bold',
        color: '#f9d64b',
        wordWrap: { width: WIDTH - 40 },
        align: 'center',
      })
      .setOrigin(0.5, 0);

    // grid of owned pogs: 3 columns
    const cols = 3;
    const cardW = 140;
    const cardH = 150;
    const gapX = 10;
    const gapY = 10;
    const startX = WIDTH / 2 - ((cols - 1) * (cardW + gapX)) / 2;
    const startY = 240;
    const sorted = [...owned].sort((a, b) => {
      const ra = RARITY_WEIGHT[pogDef(a.defId)?.rarity ?? 'common'];
      const rb = RARITY_WEIGHT[pogDef(b.defId)?.rarity ?? 'common'];
      if (a.equipped !== b.equipped) return a.equipped ? -1 : 1;
      return rb - ra;
    });

    this.page = Math.min(this.page, Math.max(0, Math.ceil(sorted.length / 9) - 1));
    sorted.slice(this.page * 9, (this.page + 1) * 9).forEach((inst, i) => {
      const x = startX + (i % cols) * (cardW + gapX);
      const y = startY + Math.floor(i / cols) * (cardH + gapY);
      this.renderCard(inst, x, y, cardW, cardH);
    });

    addPageControls(this, this.page, sorted.length, 9, 728, (page) => {
      if (!this.equipping) this.scene.restart({ page });
    });

    this.add
      .text(WIDTH / 2, HEIGHT - 66, 'tap a pog to equip / unequip · win more in Pog Battles & Pog Quest', {
        fontSize: '12px',
        fontFamily: FONT,
        color: '#6b6180',
      })
      .setOrigin(0.5);
  }

  private renderCard(inst: PogInstance, x: number, y: number, w: number, h: number): void {
    const def = pogDef(inst.defId);
    if (!def) return;
    const rc = RARITY_COLOR[def.rarity];

    const bg = this.add
      .rectangle(x, y, w, h, inst.equipped ? rc : 0x1c1430, inst.equipped ? 0.22 : 0.9)
      .setStrokeStyle(inst.equipped ? 3 : 1, rc, inst.equipped ? 1 : 0.6)
      .setInteractive({ useHandCursor: true });

    this.add.circle(x, y - 40, 24, def.color, 0.9).setStrokeStyle(3, rc);
    this.add.text(x, y - 40, def.emoji, { fontSize: '22px' }).setOrigin(0.5);

    this.add
      .text(x, y - 4, def.name, { fontSize: '12px', fontFamily: FONT, fontStyle: 'bold', color: '#ffffff', align: 'center', wordWrap: { width: w - 12 } })
      .setOrigin(0.5, 0);

    this.add
      .text(x, y + 30, `${RARITY_LABEL[def.rarity]} · ${RARITY_WEIGHT[def.rarity]} slot${RARITY_WEIGHT[def.rarity] > 1 ? 's' : ''}`, {
        fontSize: '10px',
        fontFamily: FONT,
        color: `#${rc.toString(16).padStart(6, '0')}`,
      })
      .setOrigin(0.5, 0);

    this.add
      .text(x, y + 46, [describePerks(def.perks).join(', '), def.activeEffect ? describeActive(def.activeEffect) : ''].filter(Boolean).join('\n'), {
        fontSize: '10px',
        fontFamily: FONT,
        color: '#b7aed0',
        align: 'center',
        wordWrap: { width: w - 10 },
      })
      .setOrigin(0.5, 0);

    if (inst.equipped) {
      this.add
        .text(x + w / 2 - 6, y - h / 2 + 6, 'ON', { fontSize: '10px', fontFamily: FONT, fontStyle: 'bold', color: '#052e2b', backgroundColor: '#4ade80', padding: { x: 4, y: 2 } })
        .setOrigin(1, 0);
    }

    bg.on('pointerdown', () => {
      if (this.equipping) return;
      this.equipping = true;
      void toggleEquip(inst.id).then((res) => {
        if (!this.scene.isActive()) return;
        this.equipping = false;
        if (res.ok) {
          this.scene.restart({ page: this.page });
        } else {
          this.showToast(res.reason ?? 'can’t equip');
        }
      });
    });
  }

  private showToast(msg: string): void {
    this.toast?.destroy();
    this.toast = this.add
      .text(WIDTH / 2, 160, msg, {
        fontSize: '13px',
        fontFamily: FONT,
        fontStyle: 'bold',
        color: '#ffffff',
        backgroundColor: '#7f1d1d',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setDepth(50);
    this.tweens.add({ targets: this.toast, alpha: 0, delay: 1400, duration: 400 });
  }
}

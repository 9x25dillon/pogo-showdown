import Phaser from 'phaser';
import { RARITY_LABEL } from '../data/pogs';
import { dbDelete } from '../db/LocalDB';
import { grantPog } from '../db/pogRepository';
import type { DuelRecord } from '../db/schema';
import type { PadButtons } from '../systems/gamepad';
import { BAR_W, PRACTICE_PRIZE, PRACTICE_STAKE, PRO_FIRST_WIN_XP, RANKED_UNLOCK_WINS, ROUNDS_TO_WIN, duelXp, duelists, opponentPower, placeDuelists, slamPower, slamTuning,
  type DuelSpot, type Duelist, type SlamTuning } from './duels';
import { ITEM_ICON, ITEM_NAME, type ItemId } from './items';
import { equippedWeight, grantMilestone, realmMeta, saveDuelist, type PogRow } from './progression';
import { RealmPanel, type PanelRow } from './RealmPanel';
import type { RealmHero } from './RealmHero';
import type { World } from './worldGen';

interface DuelHost {
  world: World;
  player: () => { x: number; y: number };
  hero: () => RealmHero;
  pack: () => Partial<Record<ItemId, number>>;
  day: () => number;
  available: () => boolean;
  pause: (open: boolean) => void;
  notify: (title: string, sub: string) => void;
  grant: (item: ItemId, count: number) => void;
  /** the pog collection changed: reload the hero snapshot */
  reloadHero: () => Promise<void>;
  save: () => void;
}

type Stake = { kind: 'friendly' } | { kind: 'materials' } | { kind: 'pog'; row: PogRow };

interface Bout {
  foe: Duelist;
  stake: Stake;
  tuning: SlamTuning;
  round: number;
  you: number;
  them: number;
  rounds: { you: number; them: number }[];
  markerT: number;
  dir: 1 | -1;
  sweeping: boolean;
  /** ms until the next round starts (after a slam) */
  wait: number;
  done: boolean;
  result?: string;
}

const FONT = 'system-ui, sans-serif';

/** Duelists standing in the overworld, their stake menu, and the slam-bar bout itself. */
export class RealmDuel {
  readonly spots: Record<string, DuelSpot>;
  private roster = duelists();
  private records: Record<string, DuelRecord>;
  private npcs = new Map<string, Phaser.GameObjects.Container>();
  private panel: RealmPanel;
  private target?: Duelist;
  private feedback = '';
  private bout?: Bout;
  private overlay?: Phaser.GameObjects.Container;
  private marker?: Phaser.GameObjects.Rectangle;
  private boutText?: Phaser.GameObjects.Text;
  private roundText?: Phaser.GameObjects.Text;
  private tapQueued = false;
  private scene: Phaser.Scene;
  private host: DuelHost;

  constructor(scene: Phaser.Scene, host: DuelHost, saved?: Record<string, DuelSpot>) {
    this.scene = scene;
    this.host = host;
    const fresh = placeDuelists(host.world);
    this.spots = Object.fromEntries(Object.entries(fresh).map(([id, s]) => [id, saved?.[id] ?? s]));
    this.records = { ...realmMeta(host.hero().snap.profile).duels };
    this.panel = new RealmPanel(scene, { view: () => this.stakeView(), onClose: () => this.closePanel() });
    this.drawNpcs();
  }

  get open(): boolean { return this.panel.open || !!this.overlay; }

  /** the hero you play doesn't duel themself */
  private present(): Duelist[] {
    return this.roster.filter((d) => d.id !== this.host.hero().snap.characterId);
  }

  private schoolyardWins(): number {
    return this.roster.filter((d) => !d.ranked && (this.records[d.id]?.wins ?? 0) > 0).length;
  }

  private drawNpcs(): void {
    for (const c of this.npcs.values()) c.destroy();
    this.npcs.clear();
    for (const d of this.present()) {
      const s = this.spots[d.id];
      const x = (s.tx + 0.5) * 16;
      const y = (s.ty + 1) * 16;
      const body = this.scene.add.image(0, 0, 'npc_body').setOrigin(0.5, 1).setTint(d.color);
      const head = this.scene.add.image(0, -24, 'npc_head').setOrigin(0.5, 1);
      const label = this.scene.add.text(0, -40, `${d.emoji} ${d.name}${d.ranked ? ' ★' : ''}`, {
        fontSize: '9px', fontFamily: FONT, fontStyle: 'bold', color: d.ranked ? '#fde68a' : '#ffffff', backgroundColor: '#0b0714aa', padding: { x: 3, y: 1 },
      }).setOrigin(0.5, 1);
      const c = this.scene.add.container(x, y, [body, head, label]).setDepth(8);
      this.scene.tweens.add({ targets: [body, head], y: '-=2', duration: 700 + (s.tx % 5) * 90, yoyo: true, repeat: -1 });
      this.npcs.set(d.id, c);
    }
  }

  /** after a hero switch the old hero joins the Schoolyard */
  refreshRoster(): void {
    this.drawNpcs();
  }

  nearby(): Duelist | undefined {
    const p = this.host.player();
    return this.present().find((d) => {
      const s = this.spots[d.id];
      return Math.abs((s.tx + 0.5) * 16 - p.x) < 30 && Math.abs((s.ty + 1) * 16 - p.y) < 40;
    });
  }

  prompt(): string {
    const d = this.nearby();
    if (!d) return '';
    const rec = this.records[d.id];
    const record = rec ? ` · ${rec.wins}-${rec.losses}` : '';
    return `▼ / S / tap · duel ${d.emoji} ${d.name}, ${d.epithet} · skill ${d.skill}${record}`;
  }

  proIds(): string[] {
    return this.roster.filter((d) => d.ranked).map((d) => d.id);
  }

  /** pros you've come within sight of, for the minimap */
  seenPros(): string[] {
    return this.proIds().filter((id) => this.spots[id].seen);
  }

  recordLines(): string[] {
    const wins = Object.values(this.records).reduce((n, r) => n + r.wins, 0);
    const losses = Object.values(this.records).reduce((n, r) => n + r.losses, 0);
    const pros = this.roster.filter((d) => d.ranked && (this.records[d.id]?.wins ?? 0) > 0).length;
    const seen = this.roster.filter((d) => d.ranked && this.spots[d.id].seen).length;
    return [`Pog duels · ${wins}-${losses} · Schoolyard ${this.schoolyardWins()}/${this.roster.filter((d) => !d.ranked).length} beaten · pros ${pros}/11 beaten, ${seen}/11 found`];
  }

  interact(): void {
    if (!this.host.available() || this.open) return;
    const d = this.nearby();
    if (!d) return;
    this.target = d;
    this.feedback = '';
    this.host.pause(true);
    this.panel.show();
  }

  private closePanel(): void {
    this.panel.close();
    if (!this.overlay) this.host.pause(false);
  }

  private stakeView() {
    const d = this.target!;
    const rec = this.records[d.id] ?? { wins: 0, losses: 0 };
    const paidToday = rec.lastWinDay === this.host.day();
    const rows: PanelRow[] = [];
    const locked = d.ranked && this.schoolyardWins() < RANKED_UNLOCK_WINS;
    const sig = d.signature ? `${d.signature.emoji} ${d.signature.name} (${RARITY_LABEL[d.signature.rarity]})` : 'their pog';
    if (locked) {
      rows.push({ label: `${d.name} won't slam with an unknown. Beat ${RANKED_UNLOCK_WINS} different Schoolyard players first (${this.schoolyardWins()}/${RANKED_UNLOCK_WINS}).`, enabled: false });
    } else {
      rows.push({ label: `Friendly · nothing at stake · win ${duelXp(d.skill, false)} XP`, action: () => this.begin({ kind: 'friendly' }) });
      if (paidToday) rows.push({ label: `For keeps · ${d.name} already paid out today · come back after dawn`, enabled: false });
      else if (!d.ranked) {
        const have = this.host.pack()[PRACTICE_STAKE.item] ?? 0;
        const prize = Object.entries(PRACTICE_PRIZE).map(([i, n]) => `${n} ${ITEM_ICON[i as ItemId]}`).join(' ');
        rows.push({
          label: `For keeps · stake ${PRACTICE_STAKE.count} ${ITEM_NAME[PRACTICE_STAKE.item]} (you have ${have}) · win ${prize} + ${sig} + ${duelXp(d.skill, true)} XP`,
          enabled: have >= PRACTICE_STAKE.count, action: () => this.begin({ kind: 'materials' }),
        });
      } else {
        const hero = this.host.hero();
        const pogs = hero.snap.pogs;
        rows.push({ label: `For keeps · stake a pog below · win ${sig} + ${duelXp(d.skill, true)} XP${(this.records[d.id]?.wins ?? 0) === 0 ? ' + a Tech Point' : ''} · lose it and it's gone`, enabled: false });
        for (const row of pogs) {
          rows.push({ label: `   Stake ${row.def.emoji} ${row.def.name} · ${RARITY_LABEL[row.def.rarity]}${row.instance.equipped ? ' · equipped' : ''}`, color: '#fca5a5', action: () => this.begin({ kind: 'pog', row }) });
        }
      }
    }
    const t = slamTuning(d.skill, this.heroSlamStats());
    return {
      title: `${d.emoji} ${d.name.toUpperCase()} · ${d.epithet}`,
      subtitle: `Skill ${d.skill} · record ${rec.wins}-${rec.losses} · best of 3 slams · sweep ${t.sweep.toFixed(1)}/s · sweet zone ±${Math.round(t.sweet)}px · your slam +${t.bonus.toFixed(1)} (level + footpeg weight)`,
      rows, feedback: this.feedback, accent: d.color,
    };
  }

  private heroSlamStats() {
    const hero = this.host.hero();
    return { level: hero.level, critChance: hero.stats.critChance, trickWindowMult: hero.stats.trickWindowMult, footpegWeight: equippedWeight(hero.snap.pogs) };
  }

  // ---------------- the bout ----------------

  private begin(stake: Stake): void {
    const foe = this.target!;
    this.panel.close();
    if (stake.kind === 'materials') {
      const pack = this.host.pack();
      pack[PRACTICE_STAKE.item] = (pack[PRACTICE_STAKE.item] ?? 0) - PRACTICE_STAKE.count;
    }
    this.bout = { foe, stake, tuning: slamTuning(foe.skill, this.heroSlamStats()), round: 1, you: 0, them: 0, rounds: [], markerT: 0, dir: 1, sweeping: true, wait: 0, done: false };
    this.buildOverlay();
  }

  private buildOverlay(): void {
    const b = this.bout!;
    const c = this.scene.add.container(480, 270).setDepth(86);
    this.overlay = c;
    const bg = this.scene.add.rectangle(0, 0, 960, 540, 0x030712, 0.8).setInteractive();
    bg.on('pointerdown', () => { this.tapQueued = true; });
    c.add(bg);
    c.add(this.scene.add.rectangle(0, 0, 560, 300, 0x0e0a1a).setStrokeStyle(2, b.foe.color));
    c.add(this.scene.add.text(0, -122, `${b.foe.emoji} ${b.foe.name}  ·  ${b.stake.kind === 'friendly' ? 'friendly' : 'FOR KEEPS'}`, { fontSize: '18px', fontFamily: FONT, fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5));
    this.roundText = this.scene.add.text(0, -88, '', { fontSize: '14px', fontFamily: FONT, color: '#b7aed0' }).setOrigin(0.5);
    c.add(this.roundText);
    c.add(this.scene.add.rectangle(0, -10, BAR_W, 26, 0x241b3a).setStrokeStyle(1, 0x4c3f73));
    c.add(this.scene.add.rectangle(0, -10, b.tuning.sweet * 2, 26, 0x4ade80, 0.45));
    this.marker = this.scene.add.rectangle(-BAR_W / 2, -10, 6, 40, 0xfacc15);
    c.add(this.marker);
    this.boutText = this.scene.add.text(0, 50, 'A / Space / K / tap to SLAM', { fontSize: '16px', fontFamily: FONT, fontStyle: 'bold', color: '#fde68a', align: 'center' }).setOrigin(0.5);
    c.add(this.boutText);
    for (const child of c.list) (child as Phaser.GameObjects.Rectangle).setScrollFactor(0);
    this.refreshBout();
  }

  private refreshBout(): void {
    const b = this.bout!;
    this.roundText?.setText(`round ${Math.min(b.round, 3)} · you ${b.you} – ${b.them} ${b.foe.name}`);
  }

  private slam(): void {
    const b = this.bout!;
    if (!b.sweeping) return;
    b.sweeping = false;
    const yours = slamPower(b.markerT, b.tuning);
    const theirs = opponentPower(b.foe.skill, Math.random());
    const tie = yours.power === theirs;
    if (!tie) {
      if (yours.power > theirs) b.you++;
      else b.them++;
      b.rounds.push({ you: yours.power, them: theirs });
      b.round++;
    }
    this.boutText?.setText(`${yours.perfect ? 'PERFECT! ' : ''}you ${yours.power}  ·  ${b.foe.name} ${theirs}\n${tie ? 'dead even · slam again' : yours.power > theirs ? 'you take the round' : 'they take the round'}`)
      .setColor(tie ? '#e2e8f0' : yours.power > theirs ? '#4ade80' : '#fb7185');
    if (yours.perfect) this.scene.cameras.main.shake(120, 0.004);
    this.refreshBout();
    if (b.you >= ROUNDS_TO_WIN || b.them >= ROUNDS_TO_WIN) { b.done = true; void this.finish(); }
    else b.wait = 1100;
  }

  private async finish(): Promise<void> {
    const b = this.bout!;
    const won = b.you > b.them;
    const foe = b.foe;
    const hero = this.host.hero();
    const rec = { ...(this.records[foe.id] ?? { wins: 0, losses: 0 }) };
    const firstProWin = foe.ranked && rec.wins === 0;
    const lines: string[] = [];
    if (won) {
      rec.wins++;
      const keeps = b.stake.kind !== 'friendly';
      lines.push(`YOU WIN ${b.you}–${b.them}`);
      lines.push(`+${hero.gainXp(duelXp(foe.skill, keeps))} XP (unbanked)`);
      if (keeps) {
        rec.lastWinDay = this.host.day();
        if (b.stake.kind === 'materials') {
          this.host.grant(PRACTICE_STAKE.item, PRACTICE_STAKE.count);
          for (const [item, n] of Object.entries(PRACTICE_PRIZE)) this.host.grant(item as ItemId, n);
          lines.push(`stake back + ${Object.entries(PRACTICE_PRIZE).map(([i, n]) => `${n} ${ITEM_NAME[i as ItemId]}`).join(' + ')}`);
        }
        if (foe.signature) {
          await grantPog(foe.signature.id, foe.id);
          lines.push(`${foe.signature.emoji} ${foe.signature.name} is yours`);
        }
        if (foe.ranked && firstProWin) {
          lines.push(`+${hero.gainXp(PRO_FIRST_WIN_XP)} XP for your first win over ${foe.name}`);
          if (await grantMilestone(`duel:${foe.id}`)) lines.push('+1 TECH POINT');
        }
      }
    } else {
      rec.losses++;
      lines.push(`${foe.name.toUpperCase()} WINS ${b.them}–${b.you}`);
      if (b.stake.kind === 'materials') lines.push(`your ${PRACTICE_STAKE.count} ${ITEM_NAME[PRACTICE_STAKE.item]} are theirs`);
      if (b.stake.kind === 'pog') {
        await dbDelete('pogs', b.stake.row.instance.id);
        lines.push(`${b.stake.row.def.emoji} ${b.stake.row.def.name} is gone for good`);
      }
    }
    this.records[foe.id] = rec;
    await saveDuelist(foe.id, (d) => { Object.assign(d, rec); });
    if (b.stake.kind !== 'friendly') await this.host.reloadHero();
    b.result = `${lines.join('\n')}\n\nA / Space / tap to continue`;
    this.boutText?.setText(b.result).setColor(won ? '#4ade80' : '#fb7185');
    this.host.save();
  }

  private closeBout(): void {
    this.overlay?.destroy();
    this.overlay = undefined;
    this.bout = undefined;
    this.host.pause(false);
  }

  update(dt: number): void {
    const p = this.host.player();
    for (const d of this.roster) {
      const s = this.spots[d.id];
      if (!s.seen && Math.hypot((s.tx + 0.5) * 16 - p.x, (s.ty + 1) * 16 - p.y) < 220) {
        s.seen = true;
        if (d.ranked && d.id !== this.host.hero().snap.characterId) this.host.notify(`${d.emoji} ${d.name.toUpperCase()}`, `${d.epithet} · a Circuit pro, skill ${d.skill} · marked on your map`);
      }
    }
    const b = this.bout;
    if (!b || !this.marker) return;
    if (b.sweeping) {
      b.markerT += (dt / 1000) * b.tuning.sweep * b.dir;
      if (b.markerT >= 1) { b.markerT = 1; b.dir = -1; } else if (b.markerT <= 0) { b.markerT = 0; b.dir = 1; }
      this.marker.x = -BAR_W / 2 + b.markerT * BAR_W;
    } else if (!b.done && b.wait > 0) {
      b.wait -= dt;
      if (b.wait <= 0) {
        b.sweeping = true;
        b.markerT = Math.random() < 0.5 ? 0 : 1;
        b.dir = b.markerT === 0 ? 1 : -1;
        this.boutText?.setText('A / Space / K / tap to SLAM').setColor('#fde68a');
      }
    }
  }

  updateInput(pressed: PadButtons, keys: Record<string, Phaser.Input.Keyboard.Key>): void {
    if (this.panel.open) { this.panel.updateInput(pressed, keys); return; }
    const J = Phaser.Input.Keyboard.JustDown;
    const tap = pressed.a || J(keys.space) || J(keys.k) || this.tapQueued;
    this.tapQueued = false;
    const b = this.bout;
    if (!b || !tap) return;
    if (b.result) this.closeBout();
    else if (b.sweeping) this.slam();
  }
}

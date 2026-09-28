import Phaser from 'phaser';
import { CHARACTERS } from '../data/characters';
import { TIER_STEP_COST, MAX_AXIS_TIER } from '../data/loadoutData';
import { RARITY_LABEL } from '../data/pogs';
import { toggleEquip } from '../db/pogRepository';
import type { PadButtons } from '../systems/gamepad';
import { HERO_PERKS, describeRealmPerks, levelForXp } from './hero';
import { buyFootpegTier, equippedWeight, heroXp, loadHeroSnapshot, pogWeight, setHero } from './progression';
import { RealmPanel, type PanelRow, type PanelView } from './RealmPanel';
import { realmActiveText, type RealmHero } from './RealmHero';

interface HeroMenuHost {
  hero: () => RealmHero;
  pause: (open: boolean) => void;
  /** null when switching heroes is allowed here, else why not */
  switchBlocked: () => string | null;
  /** snapshot reloaded (equip, upgrade, switch): refresh the hero and anything derived */
  reloaded: (switched: boolean) => void;
  /** extra lines for the RECORDS tab, assembled by the scene */
  records: () => string[];
  /** extra rows for the GEAR tab (yoyo, pogo...) */
  gear: () => PanelRow[];
}

const TABS = ['HERO', 'POGS', 'GEAR', 'RECORDS'];

/** I / L3 / HERO button: who you are, what's on your footpeg, what you've done. */
export class RealmHeroMenu {
  private panel: RealmPanel;
  private tab = 0;
  private picking = false;
  private feedback = '';
  private busy = false;
  private host: HeroMenuHost;

  constructor(scene: Phaser.Scene, host: HeroMenuHost) {
    this.host = host;
    this.panel = new RealmPanel(scene, {
      view: () => this.view(),
      onClose: () => this.close(),
      onTab: (dir) => { this.tab = (this.tab + dir + TABS.length) % TABS.length; this.picking = false; this.feedback = ''; this.panel.show(); },
    });
  }

  get open(): boolean { return this.panel.open; }

  toggle(tab?: number): void {
    if (this.open) { this.close(); return; }
    this.tab = tab ?? this.tab;
    this.picking = false;
    this.feedback = '';
    this.host.pause(true);
    this.panel.show();
  }

  close(): void {
    this.panel.close();
    this.host.pause(false);
  }

  updateInput(pressed: PadButtons, keys: Record<string, Phaser.Input.Keyboard.Key>): void {
    if ((pressed.l3 || Phaser.Input.Keyboard.JustDown(keys.i)) && !this.busy) { this.close(); return; }
    this.panel.updateInput(pressed, keys);
  }

  private async act(job: () => Promise<string | void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const message = await job();
      this.feedback = message ?? '';
    } finally {
      this.busy = false;
      if (this.open) this.panel.render();
    }
  }

  private view(): PanelView {
    const hero = this.host.hero();
    const base = { tabs: TABS, tab: this.tab, feedback: this.feedback, accent: hero.character.color };
    if (this.tab === 1) return { ...base, ...this.pogsView() };
    if (this.tab === 2) return { ...base, ...this.gearView() };
    if (this.tab === 3) return { ...base, title: 'RECORDS', subtitle: 'Everything you have done, in every world.', rows: this.host.records().map((label) => ({ label, enabled: true })) };
    return { ...base, ...(this.picking ? this.pickView() : this.heroView()) };
  }

  private heroView(): Omit<PanelView, 'tabs'> {
    const hero = this.host.hero();
    const c = hero.character;
    const st = hero.stats;
    const { level, into, need } = hero.xpProgress();
    const blocked = this.host.switchBlocked();
    const pct = (n: number) => `${Math.round(n * 100)}%`;
    const rows: PanelRow[] = [
      { label: `${c.emoji}  ${c.name} · ${c.club}` },
      { label: `Level ${level}${level >= 20 ? ' (max)' : ` · ${into}/${need} XP`} · ${hero.masteryName}` },
      { label: `Unbanked XP ${hero.unbanked} · rest in your bed or win a realm to bank it · dying loses half`, color: hero.unbanked ? '#fcd68c' : undefined },
      { label: `Perk: ${HERO_PERKS[c.id]?.label ?? c.perk}`, color: '#a7f3d0' },
      { label: `Max HP +${st.maxHpBonus} · damage ×${st.damageMult.toFixed(2)} · crit ${pct(st.critChance)} · move ×${st.moveMult.toFixed(2)} · jump ×${st.jumpMult.toFixed(2)}` },
      { label: `Combo cap +${pct(st.comboCap)} · combo lasts ${(st.comboDecayMs / 1000).toFixed(1)}s · regen ×${st.regenMult.toFixed(2)} · loot +${pct(st.lootLuck)}` },
      { label: `Guard pips ${hero.guard}/${st.guardPips} (every ${(st.guardRechargeMs / 1000).toFixed(0)}s) · revives ${hero.revivesLeft}/${st.revives}` },
      { label: blocked ? `Switch hero · ${blocked}` : 'Switch hero ›', enabled: !blocked, action: () => { this.picking = true; this.panel.show(); } },
    ];
    return { title: 'YOUR HERO', subtitle: 'Your hero, pogs and Tech Points belong to you, not the world: a New World keeps them.', rows };
  }

  private pickView(): Omit<PanelView, 'tabs'> {
    const hero = this.host.hero();
    const rows: PanelRow[] = [{ label: '‹ Back', action: () => { this.picking = false; this.panel.show(); } }];
    for (const c of CHARACTERS) {
      const lv = levelForXp(heroXp(hero.snap.profile, c.id)).level;
      const current = c.id === hero.snap.characterId;
      rows.push({
        label: `${current ? '✓ ' : ''}${c.emoji} ${c.name} · Lv ${lv} · ${HERO_PERKS[c.id]?.label ?? c.perk}`,
        enabled: !current,
        action: () => void this.act(async () => {
          await hero.bank();
          await setHero(c.id);
          hero.refresh(await loadHeroSnapshot());
          this.host.reloaded(true);
          this.picking = false;
          return `${c.name} takes up the blade. Unbanked XP went to your previous hero.`;
        }),
      });
    }
    return { title: 'SWITCH HERO', subtitle: 'Each hero levels separately. Pogs and Tech Points are shared.', rows };
  }

  private pogsView(): Omit<PanelView, 'tabs'> {
    const hero = this.host.hero();
    const snap = hero.snap;
    const used = equippedWeight(snap.pogs);
    const rows: PanelRow[] = [...snap.pogs]
      .sort((a, b) => Number(b.instance.equipped) - Number(a.instance.equipped) || pogWeight(b.def) - pogWeight(a.def))
      .map(({ instance, def }) => {
        const perks = describeRealmPerks(def.perks).join(', ');
        const active = def.activeEffect ? ` · ⚡ ${realmActiveText(def.activeEffect)} ×${def.activeEffect.charges}` : '';
        return {
          label: `${instance.equipped ? '✓' : '  '} ${def.emoji} ${def.name} · ${RARITY_LABEL[def.rarity]} (${pogWeight(def)})${perks ? ` · ${perks}` : ''}${active}`,
          color: instance.equipped ? '#fde68a' : undefined,
          action: () => void this.act(async () => {
            const res = await toggleEquip(instance.id);
            hero.refresh(await loadHeroSnapshot());
            this.host.reloaded(false);
            return res.ok ? '' : `Can't equip: ${res.reason}`;
          }),
        };
      });
    return {
      title: 'FOOTPEG',
      subtitle: `Weight ${used}/${snap.capacity} (common 1 · rare 2 · epic 3 · legendary 4) · ⚡ actives join your hotbar, recharge on sleep or portal`,
      rows: rows.length ? rows : [{ label: 'No pogs yet. Win duels, clear rifts and beat pros to collect them.', enabled: false }],
    };
  }

  private gearView(): Omit<PanelView, 'tabs'> {
    const hero = this.host.hero();
    const tier = snapTier(hero.snap.capacity);
    const cost = tier >= MAX_AXIS_TIER ? null : TIER_STEP_COST[tier + 1];
    const rows: PanelRow[] = [
      { label: `Tech Points available: ${hero.snap.tp} · earned once each from firsts: bosses, pro duels, gold medals, arena wins, rift clears` },
      {
        label: cost === null ? 'Footpeg · full size (8)' : `Grow footpeg ${hero.snap.capacity} → ${hero.snap.capacity + 1} weight · ${cost} TP`,
        enabled: cost !== null && hero.snap.tp >= cost,
        action: () => void this.act(async () => {
          const res = await buyFootpegTier();
          hero.refresh(await loadHeroSnapshot());
          this.host.reloaded(false);
          return res.ok ? 'Footpeg grown.' : res.reason;
        }),
      },
      ...this.host.gear(),
    ];
    return { title: 'GEAR & TECH', subtitle: 'Tech Points are rare and never farmable. Spend them where your style needs room.', rows };
  }
}

function snapTier(capacity: number): number {
  return capacity - 4;
}

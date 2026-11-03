import Phaser from 'phaser';
import { CHARACTERS } from '../data/characters';
import { TIER_STEP_COST, MAX_AXIS_TIER } from '../data/loadoutData';
import { RARITY_LABEL } from '../data/pogs';
import { toggleEquip } from '../db/pogRepository';
import type { PadButtons } from '../systems/gamepad';
import { hint } from '../systems/inputHints';
import { HERO_PERKS, describeRealmPerks, levelForXp } from './hero';
import {
  COMPONENTS, GEAR, GEAR_IDS, GEAR_SLOTS, ULTIMATE_BUILDS, buildCost, buildItem, costText, craftComponent, dismantleItem, equippedFor,
  affordable, salvageComponent, setComplete, toggleEquip as toggleGear, type ComponentId, type GearId, type GearState,
} from './gear';
import { ITEM_ICON, type ItemId } from './items';
import { nemesisFor } from './nemesis';
import { WEAPONS, weaponStage } from './weapons';
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
  /** builds: the state and the pack they draw on */
  builds: () => GearState;
  pack: () => Partial<Record<ItemId, number>>;
  /** a build changed (craft, equip, dismantle): recompute stats and save */
  buildChanged: () => void;
  sigils: () => readonly string[];
  forged: () => readonly string[];
  forge: () => boolean;
  /** null when the Detention Hall can be entered from here, else why not */
  detentionBlocked: () => string | null;
  enterDetention: () => void;
  /** Story Mode's current chapter and objective, if this is a Story Mode world */
  storyLine: () => string;
}

const TABS = ['HERO', 'POGS', 'BUILD', 'QUEST', 'GEAR', 'RECORDS'];
export const TAB_QUEST = 3;

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
    if (this.tab === 2) return { ...base, ...this.buildView() };
    if (this.tab === 3) return { ...base, ...this.questView() };
    if (this.tab === 4) return { ...base, ...this.gearView() };
    if (this.tab === 5) return { ...base, title: 'RECORDS', subtitle: 'Everything you have done, in every world.', rows: this.host.records().map((label) => ({ label, enabled: true })) };
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
      { label: hint('Dodge: double-tap a direction or Shift / double-tap stick · Guard: hold L or B, tap to parry · Heavy: hold J or X', 'Dodge: double-tap ◀ ▶ · Guard: hold 🛡, tap it to parry · Heavy: hold ⚔ · Monsters flash before they strike'), color: '#93c5fd' },
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

  /** item builds: craft from materials, wear up to four, and break anything back down at no loss */
  private buildView(): Omit<PanelView, 'tabs'> {
    const hero = this.host.hero();
    const state = this.host.builds();
    const pack = this.host.pack();
    const id = hero.character.id;
    const worn = equippedFor(state, id);
    const build = ULTIMATE_BUILDS[id];
    const changed = () => { hero.recompute(); this.host.buildChanged(); this.panel.render(); };
    const itemRow = (g: GearId): PanelRow => {
      const def = GEAR[g];
      const owned = state.items[g] ?? 0;
      const wearing = worn.includes(g);
      const cost = buildCost(g, state);
      const can = affordable(cost, pack);
      return {
        label: owned > 0
          ? `${wearing ? '✓ ' : ''}${def.icon} ${def.name} ×${owned} · ${def.effect} · ${wearing ? 'wearing' : 'tap to wear'}`
          : `${def.icon} ${def.name} · ${def.effect} · ${costText(cost, (m) => ITEM_ICON[m], pack)}`,
        color: wearing ? '#fde68a' : owned > 0 ? '#ffffff' : can ? '#4ade80' : undefined,
        enabled: owned > 0 || can,
        action: () => {
          if (owned > 0) {
            this.feedback = toggleGear(g, state, id) ? '' : `All ${GEAR_SLOTS} slots are full. Take something off first.`;
          } else if (buildItem(g, state, pack)) this.feedback = `${def.name} built.`;
          changed();
        },
        alt: owned > 0 ? { label: 'BREAK DOWN', action: () => { dismantleItem(g, state, pack); this.feedback = `${def.name} is back to its parts. Nothing lost.`; changed(); } } : undefined,
      };
    };
    const complete = setComplete(id, worn);
    const others = GEAR_IDS.filter((g) => !build.items.includes(g));
    const componentRow = (c: ComponentId): PanelRow => {
      const def = COMPONENTS[c];
      const owned = state.components[c] ?? 0;
      return {
        label: `${def.icon} ${def.name} ×${owned} · ${def.effect} when built into an item · ${costText(def.cost, (m) => ITEM_ICON[m], pack)}`,
        enabled: affordable(def.cost, pack),
        color: affordable(def.cost, pack) ? '#a7f3d0' : undefined,
        action: () => { craftComponent(c, state, pack); this.feedback = `${def.name} crafted.`; changed(); },
        alt: owned > 0 ? { label: 'SALVAGE', action: () => { salvageComponent(c, state, pack); this.feedback = `${def.name} salvaged. Materials returned.`; changed(); } } : undefined,
      };
    };
    return {
      title: `BUILD · ${build.title}`,
      subtitle: `${worn.length}/${GEAR_SLOTS} worn · ${build.bonus}${complete ? ' · SET COMPLETE' : ' when all four are worn'} · parts you own are used first, and everything breaks back down`,
      rows: [
        ...build.items.map(itemRow),
        ...others.map(itemRow),
        ...(Object.keys(COMPONENTS) as ComponentId[]).map(componentRow),
      ],
    };
  }

  /** your nemesis, then your weapon: the quest only your hero can do */
  private questView(): Omit<PanelView, 'tabs'> {
    const hero = this.host.hero();
    const id = hero.character.id;
    const n = nemesisFor(id);
    const w = WEAPONS[id];
    const pack = this.host.pack();
    const stage = weaponStage(id, this.host.sigils(), this.host.forged(), pack);
    const blocked = this.host.detentionBlocked();
    const beaten = this.host.sigils().includes(id);
    const rows: PanelRow[] = [];
    const story = this.host.storyLine();
    if (story) rows.push({ label: `📖 ${story.replace(/ ›$/, '')}`, color: '#fde68a' });
    rows.push({
      label: `${beaten ? '✓ ' : ''}⚔ Step 1 · ${beaten ? 'Rematch' : 'Face'} ${n.name} · ${n.title}${blocked ? ` · ${blocked}` : ' · tap to enter detention'}`,
      enabled: !blocked,
      color: beaten ? '#a7f3d0' : '#fca5a5',
      action: () => this.host.enterDetention(),
    });
    rows.push({
      label: `${stage === 'forge' || stage === 'done' ? '✓ ' : ''}⛏ Step 2 · ${w.gatherText}: ${costText(w.materials, (m) => ITEM_ICON[m], pack)}`,
      color: stage === 'nemesis' ? '#8b80a8' : undefined,
    });
    rows.push({
      label: stage === 'done' ? `✓ 🔥 Step 3 · ${w.name} forged and in hand` : `🔥 Step 3 · Forge ${w.name}${stage === 'forge' ? ' · tap to forge' : ''}`,
      enabled: stage === 'forge',
      color: stage === 'forge' ? '#4ade80' : stage === 'done' ? '#fde68a' : undefined,
      action: () => { if (this.host.forge()) this.feedback = `${w.name} is yours.`; this.panel.render(); },
    });
    rows.push({ label: `${w.name} · ${w.damage} damage · ${w.power}`, color: '#c4b5fd' });
    return {
      title: `${hero.character.emoji} ${hero.character.name.toUpperCase()}'S QUEST`,
      subtitle: `Your nemesis drops the rare half of your weapon and a sigil to forge it. ${hint('', 'Tap a step to do it.')}`,
      rows,
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

import Phaser from 'phaser';
import { COLORS, HEIGHT, REGISTRY_KEY_CHARACTER, REGISTRY_KEY_PLATFORMER_LEVEL_INDEX, WIDTH, RW, RH } from '../config';
import { PHYS } from '../data/platformerConfig';
import { applyHeroGravity, createControllerState, updateController, type ControllerState } from '../systems/PlayerController';
import { mergePads, readPads, rumble, type PadFrame } from '../systems/gamepad';
import { music } from '../systems/music';
import {
  BREWS, BREW_IDS, HOTBAR, ITEM_ICON, ITEM_NAME, PICKAXES, PLACES, POTION_HEAL, RECIPES, SWORDS,
  type BrewId, type HotbarSlot, type ItemId, type Recipe,
} from '../realm/items';
import { generatePocket, type PocketWorld } from '../realm/pocketGen';
import { BOSSES, createBoss, enraged, hitBoss, updateBoss, type BossCtx, type BossState, type HazardSpec } from '../realm/realmBosses';
import { FOREVER_SEGMENTS, POCKETS, POCKET_ORDER, RELICS, type PocketId, type RelicId } from '../realm/realms';
import { REALM_ENEMIES, spawnCap, spawnTable, type RealmEnemyDef } from '../realm/realmEnemies';
import { emptyStats, loadRealm, newSeed, packBits, saveRealm, unpackBits, type RealmSave, type RealmStats } from '../realm/realmSave';
import { SOLID_TILES, T, TILE_INFO, isSolid } from '../realm/tiles';
import { GATE_H, GATE_W, TILE, generateWorld, type World } from '../realm/worldGen';
import { RealmHomestead } from '../realm/RealmHomestead';
import { RealmExpedition } from '../realm/RealmExpedition';
import { RealmHeroMenu } from '../realm/RealmHeroMenu';
import { RealmDuel } from '../realm/RealmDuel';
import { RealmYoyo } from '../realm/RealmYoyo';
import { RealmDash } from '../realm/RealmDash';
import { RealmArena } from '../realm/RealmArena';
import { RealmRifts } from '../realm/RealmRifts';
import { SHRINE_OFFSET, SHRINE_W } from '../realm/worldGen';
import { TRICK_EFFECTS, YOYOS, tricksFor } from '../realm/yoyo';
import { INPUT_GLYPH, TRICKS, type TrickInput } from '../data/tricks';
import { BOSS_XP, ORE_XP, killXp } from '../realm/hero';
import { RealmHero, realmActiveText } from '../realm/RealmHero';
import { grantMilestone, loadHeroSnapshot, type HeroSnapshot } from '../realm/progression';
import type { PanelRow } from '../realm/RealmPanel';
import { emptyGear, equippedFor, type GearState } from '../realm/gear';
import { WEAPONS, nemesisSpoils, weaponStage, type UltimateWeapon } from '../realm/weapons';
import { nemesisBossDef, nemesisFor } from '../realm/nemesis';
import { RealmDialogue } from '../realm/RealmDialogue';
import { RealmStory } from '../realm/RealmStory';
import { endingLines, newStory, type Speaker } from '../realm/story';
import { TAB_QUEST } from '../realm/RealmHeroMenu';
import { hint, interactKey, isTouch } from '../systems/inputHints';
import {
  ATTACK_BUFFER_MS, ATTACK_COOLDOWN_MS, BACKSTAB_DAMAGE, BOSS_DAMAGE_SCALE, BOSS_POISE_PER_HP, BOSS_STAGGER_MS, CHARGE_COMMIT_MS, DODGE_MS, DODGE_SPEED,
  EXHAUSTED_LOCK_SCALE, GUARD_MOVE_SCALE, HEAVY, HEAVY_COST, LIGHT_COST, PARRY_BOSS_POISE, PARRY_STAGGER_MS, PERFECT_BONUS, POISE, POISE_REGEN_DELAY_MS,
  RECOVER_MS, RIPOSTE_DAMAGE, RealmCombat, STAGGER_DAMAGE, STAGGER_MS, STAMINA_MAX, STRIKE_MS, STRIKE_RANGE_PX, STRIKE_SPEED, WINDUP_MS, type SwingDef,
} from '../realm/combat';

/** a hotbar entry: a fixed item/tool slot, or one equipped pog's active ability */
type Slot = HotbarSlot | 'yoyo' | 'pogo' | `pog:${string}`;

/**
 * The Forever Realm: an open, procedurally generated world you can dig
 * and build in (Terraria), with a dark sword-first combat loop and an
 * alchemy/smithing bench (Chakan). Landscape: this scene resizes the
 * game to 960x540 while it runs and restores the portrait size on exit.
 *
 * Controls
 *   controller  stick move · A jump · X sword · RT use tool (hold to mine) ·
 *               right stick aim · LB/RB hotbar · B drink potion · Y craft · Menu pause
 *   keyboard    A/D move · W/Space jump · J sword · K use · arrows aim up/down ·
 *               1-6 hotbar · Q potion · E craft · Esc pause
 *   mouse       aim · left hold use · right click sword · wheel hotbar
 *   touch       ◀ ▶ JUMP ⚔ buttons · tap the world to use the tool there
 */
export { RW, RH };
const REACH_PX = TILE * 5.5;
const MOVE_SPEED = 175;
/** realm jumps are a bit shorter than Pog Quest's: ~5 tiles */
const JUMP_SCALE = 0.84;
const BASE_HP = 100;
const CROWN_HP = 50;
const HEAT_DRAIN_PER_S = 2.5;
const LAVA_DAMAGE = 20;
const BREATH_MAX = 100;
const BREATH_LOSS_PER_S = 10;
const DROWN_PER_S = 10;
const VOID_DAMAGE = 15;
const SWIM_STROKE = -250;
const SWIM_MAX_FALL = 110;
const GALE_FALL = 150;
const WIND_ACCEL = 1500;
const HIT_INVULN_MS = 700;
const REGEN_DELAY_MS = 4000;
const REGEN_PER_S = 2;
const PLACE_REPEAT_MS = 140;
export const CYCLE_MS = 6 * 60_000;
const AUTOSAVE_MS = 30_000;
const SPAWN_EVERY_MS = 1200;
const DESPAWN_PX = 1400;
const RESPAWN_MS = 3500;
/** the hotbar lives between the HP column (to x 236) and the sword label/buttons (from x ~795) */
const HOTBAR_X0 = 244;
const HOTBAR_X1 = RW - 176;
const HOTBAR_CX = (HOTBAR_X0 + HOTBAR_X1) / 2;
/** the help bubble: a few short showings over the whole game, then it's gone for good */
const HELP_SHOWINGS = 3;
const HELP_SHOW_MS = 4000;
/** the most lights drawn at once; the nearest win */
const MAX_LIGHTS = 28;
const HARVESTABLE: Record<number, { kind: string; label: string }> = {
  [T.TRUNK]: { kind: 'tree', label: '🪵 Tree: wood for everything' },
  [T.HERB]: { kind: 'herb', label: '🌸 Nightbloom: potions and brews' },
  [T.COPPER]: { kind: 'copper', label: '🟠 Copper: pickaxes and blades' },
  [T.IRON]: { kind: 'iron', label: '⚪ Iron: better pickaxes and blades' },
  [T.SOULSTONE]: { kind: 'soulstone', label: '🔴 Soulstone: the strongest gear' },
};

interface RealmEnemy {
  sprite: Phaser.Physics.Arcade.Sprite;
  def: RealmEnemyDef;
  hp: number;
  timer: number;
  colliders: Phaser.Physics.Arcade.Collider[];
  /** its attack: wind up, strike, recover. Only the strike hurts */
  phase: 'none' | 'windup' | 'strike' | 'recover';
  phaseTimer: number;
  cooldown: number;
  dir: number;
  struck: boolean;
  poise: number;
  poiseTimer: number;
  stagger: number;
  /** reeling from a parry: the next blow is a riposte */
  riposte: boolean;
}

/** what's hitting you: lets a parry answer it */
interface BlowSource { enemy?: RealmEnemy; boss?: BossState; hazard?: Hazard }

interface Hazard {
  sprite: Phaser.Physics.Arcade.Sprite;
  damage: number;
  colliders: Phaser.Physics.Arcade.Collider[];
}

interface Projectile {
  sprite: Phaser.Physics.Arcade.Sprite;
  damage: number;
  pierce: number;
  hit: Set<unknown>;
}

interface Aim {
  tx: number;
  ty: number;
}

/** 0 = full day, 1 = full night, with ramps at dusk (0.62-0.7) and dawn (0.95-1) of the cycle */
export function nightFactor(clockMs: number): number {
  const p = (((clockMs % CYCLE_MS) + CYCLE_MS) % CYCLE_MS) / CYCLE_MS;
  if (p < 0.62) return 0;
  if (p < 0.7) return (p - 0.62) / 0.08;
  if (p < 0.95) return 1;
  return 1 - (p - 0.95) / 0.05;
}

function lerpColor(a: number, b: number, t: number): number {
  const ca = Phaser.Display.Color.IntegerToColor(a);
  const cb = Phaser.Display.Color.IntegerToColor(b);
  return Phaser.Display.Color.GetColor(
    Math.round(ca.red + (cb.red - ca.red) * t),
    Math.round(ca.green + (cb.green - ca.green) * t),
    Math.round(ca.blue + (cb.blue - ca.blue) * t),
  );
}

export class RealmScene extends Phaser.Scene {
  private world!: World;
  private map!: Phaser.Tilemaps.Tilemap;
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private player!: Phaser.Physics.Arcade.Sprite;
  private ctrl: ControllerState = createControllerState();
  private ready = false;
  /** saved and leaving for another world or a rift */
  private handedOff = false;
  private dead = false;
  private deathTimer = 0;

  /** set while in a portal realm (see realms.ts); undefined = the overworld */
  private pocket?: PocketId;
  private relics = new Set<RelicId>();
  private buffs: Partial<Record<BrewId, number>> = {};
  private breath = BREATH_MAX;
  private airJumpsUsed = 0;
  private lastSafe = { x: 0, y: 0 };
  private wind = { force: 0, timer: 4000 };
  private boss?: BossState;
  private bossDefeated = false;
  private gateTiles: { tx: number; ty: number }[] = [];
  private hazards: Hazard[] = [];
  private portalLabels: Phaser.GameObjects.GameObject[] = [];
  private champion = false;
  private stats: RealmStats = emptyStats();
  /** the Reaper's last stage darkens its arena (null = the realm's own darkness) */
  private darkOverride: number | null = null;
  private ending?: Phaser.GameObjects.Container;
  private endingReady = false;
  // minimap: one pixel per tile; the overworld's is fogged until explored (Terraria-style)
  private explored?: Uint8Array;
  private minimapTex?: Phaser.Textures.CanvasTexture;
  private minimapData?: ImageData;
  private minimapDirty: { x0: number; y0: number; x1: number; y1: number } | null = null;
  private minimapParts: Phaser.GameObjects.GameObject[] = [];
  private minimapDot?: Phaser.GameObjects.Rectangle;
  private minimapBox = { x: 0, y: 0, w: 0, h: 0 };
  private minimapTimer = 0;

  private gear: GearState = emptyGear();
  private sigils: string[] = [];
  private forged: string[] = [];
  private harvested: Record<string, number> = {};
  private story?: RealmStory;
  private dialogue?: RealmDialogue;
  /** this new world is a Story Mode world */
  private startStory = false;
  private expeditionStory = false;
  private combat = new RealmCombat();
  private staminaBar!: Phaser.GameObjects.Rectangle;
  private guardFx?: Phaser.GameObjects.Image;
  /** a brief hold or slowdown of the whole world */
  private timeWarp = { ms: 0, scale: 1 };
  /** the bubble's current showing */
  private bubbleKey = '';
  private bubbleUntil = 0;
  private wasLeft = false;
  private wasRight = false;
  private wasGuard = false;
  private swingCount = 0;
  private hitCount = 0;
  private burstCooldown = 0;
  /** what the help bubble is pointing at, and what a touch USE will mine */
  private harvestTile: { tx: number; ty: number } | null = null;
  private harvestTimer = 0;
  private bubble?: Phaser.GameObjects.Text;
  private bubbleTail?: Phaser.GameObjects.Triangle;
  private bubbleMark?: Phaser.GameObjects.Rectangle;
  private backdrop: { sprite: Phaser.GameObjects.TileSprite; rate: number; day: number; night: number }[] = [];
  private stars?: Phaser.GameObjects.TileSprite;
  private motes: { o: Phaser.GameObjects.Image; vx: number; vy: number; phase: number }[] = [];
  private hero!: RealmHero;
  private heroMenu?: RealmHeroMenu;
  private duel?: RealmDuel;
  private yoyo!: RealmYoyo;
  private dashTrials?: RealmDash;
  private arena?: RealmArena;
  private rifts?: RealmRifts;
  private riftMarks: Phaser.GameObjects.Rectangle[] = [];
  private arenaMapMark?: Phaser.GameObjects.Rectangle;
  private hasPogo = false;
  /** on the pogo stick: auto-bounce, stomps, faster, but hits hurt more and you don't regenerate */
  private riding = false;
  private pogoGfx!: Phaser.GameObjects.Graphics;
  private lastJumpPressAt = -1e9;
  private stompChain = 0;
  private stickNeutral = true;
  private dash = { vx: 0, ms: 0 };
  /** a bounce that stomps on landing (Boingy Boing, the pogo stick) */
  private stomp: { damage: number; airborne: boolean } | null = null;
  private trickPad: Phaser.GameObjects.GameObject[] = [];
  private proMarks = new Map<string, Phaser.GameObjects.Rectangle>();
  private heroText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private slots: Slot[] = [...HOTBAR];
  private projectiles: Projectile[] = [];
  /** set while a ground pound is falling; the shockwave's damage */
  private pound: number | null = null;
  private hp = BASE_HP;
  private invuln = 0;
  private sinceHit = 0;
  private facing: 1 | -1 = 1;
  private inventory: Partial<Record<ItemId, number>> = {};
  private sword = 0;
  private pickaxe = 0;
  private yoyoTier = 0;
  private slot = 0;
  private spawnPoint = { x: 0, y: 0 };
  private clock = CYCLE_MS * 0.1;
  private homestead?: RealmHomestead;
  private homeText!: Phaser.GameObjects.Text;
  private expedition?: RealmExpedition;
  private expeditionText!: Phaser.GameObjects.Text;
  private foundryMapMark?: Phaser.GameObjects.Rectangle;

  private edits = new Map<number, number>();
  private torches = new Set<number>();
  private enemies: RealmEnemy[] = [];
  private spawnTimer = 0;
  private autosaveTimer = 0;

  private aim: Aim | null = null;
  private mining: { index: number; progress: number } | null = null;
  private placeTimer = 0;
  private swingTimer = 0;

  // input
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private lastMouseMove = -1e9;
  private pointerUse = false;
  private touch = { left: false, right: false, jump: false, attack: false, use: false, guard: false };
  private touchJumpPressed = false;
  private touchUsePressed = false;
  /** the finger that is aiming the tool on the world, so another thumb can't steal it */
  private usePointerId = -1;
  private touchZones: { x: number; y: number; r: number; held: boolean; face: Phaser.GameObjects.Arc; set: (down: boolean) => void }[] = [];
  private useIcon?: Phaser.GameObjects.Text;
  private touchAttackPressed = false;

  // visuals
  private aimRect!: Phaser.GameObjects.Rectangle;
  private swordSprite!: Phaser.GameObjects.Image;
  private darkness!: Phaser.GameObjects.RenderTexture;
  /** redrawn each frame with the sky-lit area, then used as one eraser on the darkness */
  private skyLight!: Phaser.GameObjects.Graphics;
  private lightSources: { x: number; y: number; r: number }[] = [];
  private lightScanTimer = 0;

  // HUD
  private hpBar!: Phaser.GameObjects.Rectangle;
  private hpText!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;
  private swordText!: Phaser.GameObjects.Text;
  private slotBoxes: Phaser.GameObjects.Rectangle[] = [];
  private slotTexts: Phaser.GameObjects.Text[] = [];
  private slotLabel!: Phaser.GameObjects.Text;
  private deathText?: Phaser.GameObjects.Text;
  private craftPanel?: Phaser.GameObjects.Container;
  private craftRows: { bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text; recipe: Recipe }[] = [];
  private craftIndex = 0;
  private relicText!: Phaser.GameObjects.Text;
  private buffText!: Phaser.GameObjects.Text;
  private breathBar!: Phaser.GameObjects.Rectangle;
  private breathBack!: Phaser.GameObjects.Rectangle;
  private promptText!: Phaser.GameObjects.Text;
  private bossBar!: Phaser.GameObjects.Rectangle;
  private bossBack!: Phaser.GameObjects.Rectangle;
  private bossText!: Phaser.GameObjects.Text;
  private bannerText!: Phaser.GameObjects.Text;
  private windStreaks: Phaser.GameObjects.Rectangle[] = [];

  constructor() {
    super('Realm');
  }

  private get maxHp(): number {
    return BASE_HP + (this.relics.has('grave') ? CROWN_HP : 0) + (this.hero?.stats.maxHpBonus ?? 0);
  }

  private get pocketWorld(): PocketWorld | undefined {
    return this.pocket ? (this.world as PocketWorld) : undefined;
  }

  /** seeded per world so a realm's wind (and anything else chancy) replays exactly for a given seed */
  private rand: () => number = Math.random;
  private pocketSeed?: number;

  create(data: { newWorld?: boolean; story?: boolean; pocket?: PocketId; seed?: number } = {}): void {
    // Phaser hands a scene its previous start data again when started with none;
    // "new world" must apply once, or the next visit would wipe the save again
    this.sys.settings.data = {};
    this.scale.setGameSize(RW, RH);
    this.cameras.main.setSize(RW, RH);
    this.handedOff = false;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      // travel() and enterRift() already saved: a second, late write could clobber what the next scene saves (rift copper)
      if (!this.handedOff) void this.save();
      this.scale.setGameSize(WIDTH, HEIGHT);
    });
    // the camera outlives restarts: clear travel()'s fade-out, or every portal trip ends on a black screen
    this.cameras.main.resetFX();
    this.cameras.main.setFollowOffset(0, 0);
    this.resetState();
    this.startStory = !!data.newWorld && !!data.story;
    this.pocket = data.pocket;
    this.pocketSeed = data.seed;
    this.cameras.main.setBackgroundColor(this.pocket ? POCKETS[this.pocket].sky : COLORS.bg);
    music.play('explore');
    const loading = this.add.text(RW / 2, RH / 2, this.pocket ? `crossing into the ${POCKETS[this.pocket].name}…` : 'raising the Forever Realm…', {
      fontSize: '16px', fontFamily: 'system-ui, sans-serif', color: '#b7aed0',
    }).setOrigin(0.5).setScrollFactor(0);

    void Promise.all([data.newWorld ? Promise.resolve(undefined) : loadRealm(), loadHeroSnapshot()]).then(([save, snap]) => {
      if (!this.scene.isActive()) return;
      loading.destroy();
      this.build(save, snap);
    });
  }

  private resetState(): void {
    this.gear = emptyGear();
    this.sigils = [];
    this.forged = [];
    this.harvested = {};
    this.story = undefined;
    this.dialogue = undefined;
    this.startStory = false;
    this.expeditionStory = false;
    this.combat = new RealmCombat();
    this.guardFx = undefined;
    this.timeWarp = { ms: 0, scale: 1 };
    this.physics.world.timeScale = 1;
    this.bubbleKey = '';
    this.bubbleUntil = 0;
    this.wasLeft = false;
    this.wasRight = false;
    this.wasGuard = false;
    this.swingCount = 0;
    this.hitCount = 0;
    this.burstCooldown = 0;
    this.harvestTile = null;
    this.harvestTimer = 0;
    this.bubble = undefined;
    this.bubbleTail = undefined;
    this.bubbleMark = undefined;
    this.backdrop = [];
    this.stars = undefined;
    this.motes = [];
    this.touchZones = [];
    this.usePointerId = -1;
    this.physics.resume();
    this.ready = false;
    this.dead = false;
    this.deathTimer = 0;
    this.pocket = undefined;
    this.relics = new Set();
    this.buffs = {};
    this.breath = BREATH_MAX;
    this.airJumpsUsed = 0;
    this.wind = { force: 0, timer: 4000 };
    this.boss = undefined;
    this.bossDefeated = false;
    this.gateTiles = [];
    this.hazards = [];
    this.portalLabels = [];
    this.windStreaks = [];
    this.champion = false;
    this.stats = emptyStats();
    this.darkOverride = null;
    this.ending = undefined;
    this.endingReady = false;
    this.explored = undefined;
    this.minimapTex = undefined;
    this.minimapData = undefined;
    this.minimapDirty = null;
    this.minimapParts = [];
    this.minimapDot = undefined;
    this.minimapTimer = 0;
    this.hp = BASE_HP;
    this.invuln = 0;
    this.sinceHit = 0;
    this.facing = 1;
    this.inventory = { torch: 6, potion: 1 };
    this.sword = 0;
    this.pickaxe = 0;
    this.yoyoTier = 0;
    this.slot = 0;
    this.clock = CYCLE_MS * 0.1;
    this.edits = new Map();
    this.torches = new Set();
    this.enemies = [];
    this.spawnTimer = 0;
    this.autosaveTimer = 0;
    this.aim = null;
    this.mining = null;
    this.placeTimer = 0;
    this.swingTimer = 0;
    this.ctrl = createControllerState();
    this.pointerUse = false;
    this.touch = { left: false, right: false, jump: false, attack: false, use: false, guard: false };
    this.touchJumpPressed = false;
    this.touchAttackPressed = false;
    this.slotBoxes = [];
    this.slotTexts = [];
    this.craftPanel = undefined;
    this.craftRows = [];
    this.deathText = undefined;
    this.lightSources = [];
    this.homestead = undefined;
    this.expedition = undefined;
    this.foundryMapMark = undefined;
    this.heroMenu = undefined;
    this.duel = undefined;
    this.stickNeutral = true;
    this.dashTrials = undefined;
    this.arena = undefined;
    this.rifts = undefined;
    this.riftMarks = [];
    this.arenaMapMark = undefined;
    this.hasPogo = false;
    this.riding = false;
    this.lastJumpPressAt = -1e9;
    this.stompChain = 0;
    this.dash = { vx: 0, ms: 0 };
    this.stomp = null;
    this.trickPad = [];
    this.proMarks = new Map();
    this.slots = [...HOTBAR];
    this.projectiles = [];
    this.pound = null;
  }

  // ---------------- world ----------------

  private build(save: RealmSave | undefined, snap: HeroSnapshot): void {
    // portal realms are regenerated every visit; only the overworld keeps its edits
    const foundrySeed = ((save?.seed ?? 777) ^ Math.imul((save?.expeditions?.attempts ?? 0) + 1, 7919)) >>> 0;
    this.world = this.pocket ? generatePocket(this.pocket, this.pocketSeed ?? (this.pocket === 'foundry' ? foundrySeed : newSeed())) : generateWorld(save?.seed ?? newSeed());
    let r = this.world.seed >>> 0 || 1;
    this.rand = () => ((r = Math.imul(r ^ (r >>> 15), 2246822519) + 0x6d2b79f5) >>> 0) / 4294967296;
    const { w, h, tiles } = this.world;
    if (save) {
      if (!this.pocket) {
        for (const [index, id] of save.edits) {
          if (index >= 0 && index < tiles.length) {
            tiles[index] = id;
            this.edits.set(index, id);
          }
        }
        this.clock = save.clock;
      }
      this.inventory = { ...save.inventory };
      this.sword = save.sword;
      this.pickaxe = save.pickaxe;
      this.yoyoTier = save.yoyo ?? 0;
      this.hasPogo = !!save.pogo;
      this.relics = new Set(save.relics ?? []);
      this.champion = !!save.champion;
      this.stats = { ...emptyStats(), ...save.stats };
      this.gear = { ...emptyGear(), ...save.gear };
      this.sigils = save.sigils ?? [];
      this.forged = save.forged ?? [];
      this.harvested = save.harvested ?? {};
    }
    if (!this.pocket) this.openGateIfWorthy();
    this.hero = new RealmHero({
      swordDamage: () => this.swordDamage(),
      projectile: (damage) => this.throwPog(damage),
      groundPound: (damage) => this.groundPound(damage),
      shield: (ms) => { this.invuln = Math.max(this.invuln, ms); this.player.setTint(0xfde68a); this.time.delayedCall(ms, () => this.player.clearTint()); },
      healFull: () => { this.hp = this.maxHp; this.floatText(this.player.x, this.player.y - 50, 'FULL HEAL', '#4ade80'); },
      float: (text, color) => this.floatText(this.player.x, this.player.y - 56, text, color),
      notify: (title, sub) => this.banner(title, sub),
      worn: (id) => equippedFor(this.gear, id),
      statsChanged: () => { this.hp = Math.min(this.hp, this.maxHp); this.player?.setTexture(`realm_hero_${this.hero.character.id}`); this.rebuildHotbar(); },
    }, snap, save?.hero);

    this.map = this.make.tilemap({ tileWidth: TILE, tileHeight: TILE, width: w, height: h });
    const tileset = this.map.addTilesetImage('realmTiles', 'realmTiles', TILE, TILE, 0, 0)!;
    this.layer = this.map.createBlankLayer('ground', tileset, 0, 0)!;
    const rows: number[][] = [];
    for (let y = 0; y < h; y++) {
      const row = new Array<number>(w);
      for (let x = 0; x < w; x++) {
        const id = tiles[y * w + x];
        row[x] = id === T.AIR ? -1 : id;
        if (id === T.TORCH) this.torches.add(y * w + x);
      }
      rows.push(row);
    }
    this.map.putTilesAt(rows, 0, 0, false, this.layer);
    this.map.setCollision(SOLID_TILES, true, true, this.layer);

    this.physics.world.setBounds(0, 0, w * TILE, h * TILE);
    this.cameras.main.setBounds(0, 0, w * TILE, h * TILE);

    const spawn = { x: this.world.spawn.tx * TILE + TILE / 2, y: (this.world.spawn.ty + 1) * TILE };
    this.spawnPoint = this.pocket ? spawn : save?.spawn ?? spawn;
    const at = this.pocket ? spawn : save?.player ?? spawn;
    this.lastSafe = { ...at };
    // the Forever Realm's hero is Chakan-styled: skull face, wide-brimmed hat, cloak
    this.player = this.physics.add.sprite(at.x, at.y, `realm_hero_${this.hero.character.id}`).setOrigin(0.5, 1).setDepth(10);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(16, 40).setOffset(6, 6);
    body.setCollideWorldBounds(true);
    body.setGravityY(PHYS.gravityY);
    this.physics.add.collider(this.player, this.layer);
    this.hp = save ? Phaser.Math.Clamp(save.player.hp, 1, this.maxHp) : this.maxHp;

    if (!this.pocket) {
      this.homestead = new RealmHomestead(this, {
        tile: (x, y) => this.tileAt(x, y),
        pack: () => this.inventory,
        player: () => this.player,
        available: () => this.ready && !this.dead && !this.ending && !this.craftPanel?.visible && !this.expedition?.open && !this.heroMenu?.open && !this.duel?.open,
        danger: () => this.enemies.some(e => e.hp > 0 && Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, this.player.x, this.player.y) < 160),
        changed: (crafted) => { if (crafted !== undefined) this.stats.placed++; if (crafted) this.stats.crafted++; this.lightScanTimer = 0; this.updateHud(); void this.save(); },
        claim: (at) => { this.spawnPoint = at ?? spawn; },
        rest: () => {
          this.hero.restore(); void this.hero.bank().then(() => { this.hp = this.maxHp; void this.save(); });
          this.hp = this.maxHp; this.sinceHit = REGEN_DELAY_MS;
          if (nightFactor(this.clock) > 0) this.clock = Math.ceil(this.clock / CYCLE_MS) * CYCLE_MS + CYCLE_MS * 0.1;
          this.updateHud(); this.updateLighting(0); void this.save();
        },
        pause: (open) => {
          this.pointerUse = false; this.mining = null;
          this.touch = { left: false, right: false, jump: false, attack: false, use: false, guard: false };
          this.touchJumpPressed = false; this.touchAttackPressed = false;
          if (open) { this.physics.pause(); this.aimRect?.setVisible(false); }
          else this.physics.resume();
        },
        notify: (message) => { this.banner('HOMESTEAD', message); this.bannerText.setFontSize(18); },
      }, save?.homestead);
      // A removed or invalid saved bed must never leave a spawn in blocked terrain.
      if (save?.homestead?.homeId && !this.homestead.home) this.spawnPoint = spawn;
      const home = this.homestead.home;
      if (home) this.spawnPoint = { x: (home.tx + 1.5) * TILE, y: (home.ty + 1) * TILE };
    }

    this.expedition = new RealmExpedition(this, {
      world: this.world, foundry: this.pocket === 'foundry',
      player: () => this.player,
      occupied: (x, y) => !!this.homestead?.protects(x, y, true),
      tile: (x, y) => this.tileAt(x, y), setTile: (x, y, id) => this.setTile(x, y, id),
      available: () => this.ready && !this.dead && !this.ending && !this.craftPanel?.visible && !this.homestead?.open && !this.heroMenu?.open && !this.duel?.open,
      pause: (open) => {
        this.pointerUse = false; this.mining = null;
        this.touch = { left: false, right: false, jump: false, attack: false, use: false, guard: false };
        this.touchJumpPressed = false; this.touchAttackPressed = false;
        this.homestead?.cancelPlacement();
        if (open) { this.physics.pause(); this.aimRect?.setVisible(false); } else this.physics.resume();
      },
      notify: (title, detail) => { this.banner(title, detail); this.bannerText.setFontSize(18); },
      save: () => { void this.save(); }, grant: (item, count) => this.addItem(item, count, this.player),
      checkpoint: (x, y) => { this.spawnPoint = { x, y }; this.hp = Math.min(this.maxHp, this.hp + 25); },
      hurt: (damage, x) => this.hurtPlayer(damage, x),
      guard: (x, y) => this.spawnEnemy({ ...REALM_ENEMIES.crawler, name: 'Scrap Sentinel', texture: 'realm_scrapper', hp: 36, drop: 'iron', dropMax: 1 }, x, y),
    }, save?.expeditions);

    this.cameras.main.startFollow(this.player, true, 0.14, 0.14);
    this.cameras.main.setDeadzone(90, 60);
    this.cameras.main.setRoundPixels(true);

    // background wall behind everything below the original surface, so dug-out
    // tunnels and caves read as dark rock rather than open sky
    const wall = this.add.graphics().setDepth(-1);
    const wallColor: Record<string, number> = { overworld: 0x1b1226, ember: 0x1c0a07, tide: 0x071a2c, gale: 0x000000, grave: 0x0b0810, forever: 0x0c0714, foundry: 0x10212b, detention: 0x1a1528, arena: 0x0c0714 };
    wall.fillStyle(wallColor[this.pocket ?? 'overworld'], this.pocket === 'gale' ? 0 : 1); // the Gale Realm is open sky
    const pts: Phaser.Math.Vector2[] = [];
    for (let x = 0; x < w; x++) {
      const y = (this.world.surface[x] + 2) * TILE;
      pts.push(new Phaser.Math.Vector2(x * TILE, y), new Phaser.Math.Vector2((x + 1) * TILE, y));
    }
    pts.push(new Phaser.Math.Vector2(w * TILE, h * TILE), new Phaser.Math.Vector2(0, h * TILE));
    wall.fillPoints(pts, true);
    this.buildBackdrop();

    this.aimRect = this.add.rectangle(0, 0, TILE, TILE).setOrigin(0).setStrokeStyle(2, 0xffffff, 0.9).setDepth(20).setVisible(false);
    this.swordSprite = this.add.image(0, 0, 'realm_sword').setOrigin(0.5, 0.95).setDepth(11).setVisible(false);

    this.darkness = this.add.renderTexture(0, 0, RW, RH).setOrigin(0).setScrollFactor(0).setDepth(50);
    this.skyLight = new Phaser.GameObjects.Graphics(this);

    this.heroMenu = new RealmHeroMenu(this, {
      hero: () => this.hero,
      pause: (open) => this.menuPause(open),
      switchBlocked: () => this.switchBlocked(),
      reloaded: (switched) => { if (switched) this.duel?.refreshRoster(); this.updateHud(); void this.save(); },
      records: () => this.records(),
      gear: () => this.gearRows(),
      builds: () => this.gear,
      pack: () => this.inventory,
      buildChanged: () => { this.hp = Math.min(this.hp, this.maxHp); this.updateHud(); void this.save(); },
      sigils: () => this.sigils,
      forged: () => this.forged,
      forge: () => this.forgeWeapon(),
      detentionBlocked: () => (this.pocket ? 'only from the overworld'
        : this.enemies.some((e) => Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, this.player.x, this.player.y) < 160) ? 'enemies nearby' : null),
      enterDetention: () => { this.heroMenu?.close(); void this.travel('detention'); },
      storyLine: () => this.story?.objective() ?? '',
    });

    this.yoyo = new RealmYoyo(this, {
      player: () => this.player,
      facing: () => this.facing,
      aimPoint: () => (this.aim ? { x: (this.aim.tx + 0.5) * TILE, y: (this.aim.ty + 0.5) * TILE } : null),
      hero: () => this.hero,
      maxHp: () => this.maxHp,
      enemies: () => this.enemies,
      hurtEnemy: (e, damage, dir, crit) => this.hurtEnemy(e as RealmEnemy, damage, dir, crit),
      boss: () => this.boss?.sprite,
      damageBoss: (damage, crit) => this.damageBoss(damage, crit),
      solidAt: (x, y) => isSolid(this.tileAt(Math.floor(x / TILE), Math.floor(y / TILE))),
      invuln: (ms) => { this.invuln = Math.max(this.invuln, ms); },
      heal: (hp) => { this.hp = Math.min(this.maxHp, this.hp + hp); this.floatText(this.player.x, this.player.y - 50, `+${Math.round(hp)} HP`, '#4ade80'); },
      launch: (scale) => { (this.player.body as Phaser.Physics.Arcade.Body).setVelocityY(PHYS.jumpVelocity * JUMP_SCALE * scale); },
      bounceStomp: (scale, damage) => this.bounceStomp(scale, damage),
      dash: (dx) => { this.dash = { vx: dx / 0.18, ms: 180 }; },
      float: (x, y, text, color) => this.floatText(x, y, text, color),
      shake: (ms, intensity) => this.cameras.main.shake(ms, intensity),
    }, this.yoyoTier);

    this.pogoGfx = this.add.graphics().setDepth(10);
    if (!this.pocket || this.pocket === 'arena') {
      this.arena = new RealmArena(this, {
        world: this.world,
        inside: this.pocket === 'arena',
        player: () => this.player,
        hero: () => this.hero,
        occupied: (x, y) => !!this.homestead?.protects(x, y, true) || (!!this.expedition?.entrance && Math.abs(x - this.expedition.entrance.tx) < 6),
        available: () => this.ready && !this.dead && !this.ending && !this.craftPanel?.visible && !this.heroMenu?.open,
        pause: (open) => this.menuPause(open),
        notify: (title, sub) => { this.banner(title, sub); this.bannerText.setFontSize(20); },
        grant: (item, count) => this.addItem(item, count, this.player),
        spawn: (def, x, y) => { this.spawnEnemy(def, x, y); },
        hazard: (spec) => this.spawnHazard(spec),
        darken: (alpha) => { this.darkOverride = alpha; },
        clearEnemies: () => { for (const e of [...this.enemies]) this.despawn(e); for (const h of [...this.hazards]) this.removeHazard(h); },
        save: () => { void this.save(); },
      }, save?.arenaGate);
    }
    if (!this.pocket) {
      this.dashTrials = new RealmDash(this, {
        world: this.world,
        player: () => this.player,
        hero: () => this.hero,
        night: () => nightFactor(this.clock) > 0.5,
        riding: () => this.riding,
        available: () => this.ready && !this.dead && !this.ending && !this.craftPanel?.visible && !this.homestead?.open && !this.expedition?.open && !this.heroMenu?.open && !this.duel?.open,
        pause: (open) => this.menuPause(open),
        notify: (title, sub) => { this.banner(title, sub); this.bannerText.setFontSize(20); },
        grant: (item, count) => this.addItem(item, count, this.player),
        save: () => { void this.save(); },
      });
      this.duel = new RealmDuel(this, {
        world: this.world,
        player: () => this.player,
        hero: () => this.hero,
        pack: () => this.inventory,
        day: () => Math.floor(this.clock / CYCLE_MS),
        available: () => this.ready && !this.dead && !this.ending && !this.craftPanel?.visible && !this.homestead?.open && !this.expedition?.open && !this.heroMenu?.open,
        pause: (open) => this.menuPause(open),
        notify: (title, sub) => this.banner(title, sub),
        grant: (item, count) => this.addItem(item, count, this.player),
        reloadHero: async () => { this.hero.refresh(await loadHeroSnapshot()); },
        save: () => { void this.save(); },
      }, save?.duelSpots);
      this.rifts = new RealmRifts(this, {
        world: this.world,
        player: () => this.player,
        hero: () => this.hero,
        reserved: () => this.reservedColumns(),
        available: () => this.ready && !this.dead && !this.ending && !this.craftPanel?.visible && !this.homestead?.open && !this.expedition?.open && !this.heroMenu?.open,
        pause: (open) => this.menuPause(open),
        notify: (title, sub) => this.banner(title, sub),
        enter: (i) => void this.enterRift(i),
      }, save?.riftSpots);
    }

    this.buildPortalLabels();
    this.dialogue = new RealmDialogue(this, {
      pause: (open) => this.menuPause(open),
      speaker: (who) => this.speaker(who),
      answered: (ask, id) => this.story?.answer(ask, id),
    });
    this.story = new RealmStory(this, {
      world: this.world,
      player: () => this.player,
      progress: () => ({
        heroId: this.hero.character.id, wood: this.count('wood'), sword: this.sword, pickaxe: this.pickaxe, relics: this.relics.size,
        sigil: this.sigils.includes(this.hero.character.id), forged: this.forged.includes(this.hero.character.id), champion: this.champion,
      }),
      calm: () => this.ready && !this.dead && !this.boss && !this.ending && !this.anyMenuOpen(),
      play: (lines, done) => this.dialogue?.play(lines, done),
      notify: (title, sub) => this.banner(title, sub),
      save: () => { void this.save(); },
      lendRelics: () => this.lendRelics(),
      gift: (ask, id) => {
        if (ask !== 'bell') return;
        const part = id === 'fight' ? 'whetstone' : id === 'run' ? 'swiftboots' : 'lens';
        this.gear.components[part] = (this.gear.components[part] ?? 0) + 1;
      },
    }, save?.story ?? (this.startStory ? newStory() : undefined));
    this.registry.set('storyMode', !!this.story.data);
    this.buildHud();
    this.buildMinimap(save);
    this.buildInput();
    this.ready = true;
    if (this.pocket) this.banner(`${POCKETS[this.pocket].name}`, POCKETS[this.pocket].blurb);
    this.cameras.main.fadeIn(300, 0, 0, 0);
    void this.save();
  }

  /** with all four relics, the Forever Gate's seal becomes a gateway (not saved as an edit: it follows the relics) */
  private openGateIfWorthy(): void {
    const gate = this.world.foreverGate;
    if (!gate || this.relics.size < POCKET_ORDER.length) return;
    const { w, tiles } = this.world;
    for (let dx = 0; dx < GATE_W; dx++) for (let dy = 0; dy < GATE_H; dy++) {
      const index = (gate.ty + dy) * w + gate.tx + dx;
      if (tiles[index] === T.GATE) tiles[index] = T.ETERNAL;
    }
  }

  /** names and colors over each shrine portal (overworld), or the way home (portal realms) */
  private buildPortalLabels(): void {
    const font = 'system-ui, sans-serif';
    const label = (x: number, y: number, text: string, color: number) => {
      const glow = this.add.ellipse(x, y + 26, 44, 60, color, 0.25).setDepth(-0.5);
      this.tweens.add({ targets: glow, alpha: 0.1, duration: 900, yoyo: true, repeat: -1 });
      const t = this.add.text(x, y - 12, text, { fontSize: '10px', fontFamily: font, fontStyle: 'bold', color: '#ffffff', align: 'center', backgroundColor: '#0b0714aa', padding: { x: 4, y: 2 } })
        .setOrigin(0.5, 1).setDepth(12);
      this.portalLabels.push(glow, t);
    };
    if (this.pocket) {
      const e = this.pocketWorld!.entrance;
      label(4 * TILE, (e.ty - 2) * TILE, '↩ OVERWORLD\n▼ to leave', 0xa78bfa);
      return;
    }
    // staggered heights so neighboring labels never overlap
    (this.world.portals ?? []).forEach((p, i) => {
      const def = POCKETS[p.pocket];
      const done = this.relics.has(p.pocket);
      label((p.tx + 1) * TILE, p.ty * TILE - (i % 2) * 30, `${done ? '✓ ' : ''}${def.name} ${'★'.repeat(def.tier)}\n${def.blurb}`, def.portalColor);
    });
    const gate = this.world.foreverGate;
    if (gate) {
      const sockets = POCKET_ORDER.map((id) => (this.relics.has(id) ? RELICS[id].icon : '◌')).join(' ');
      const open = this.relics.size >= POCKET_ORDER.length;
      const title = this.champion ? '✦ THE FOREVER GATE ✦ (champion)' : 'THE FOREVER GATE';
      label((gate.tx + GATE_W / 2) * TILE, (gate.ty - 1) * TILE, `${title}\n${sockets}${open ? '' : '   sealed'}`, open ? 0xfde68a : 0x57534e);
    }
  }

  private tileAt(tx: number, ty: number): number {
    const { w, h, tiles } = this.world;
    if (tx < 0 || ty < 0 || tx >= w || ty >= h) return T.BEDROCK;
    return tiles[ty * w + tx];
  }

  private setTile(tx: number, ty: number, id: number): void {
    const { w, tiles } = this.world;
    const index = ty * w + tx;
    tiles[index] = id;
    this.edits.set(index, id);
    if (id === T.AIR) this.layer.removeTileAt(tx, ty);
    else this.layer.putTileAt(id, tx, ty);
    if (id === T.TORCH) this.torches.add(index);
    else this.torches.delete(index);
    this.lightScanTimer = 0;
    this.paintMinimap(index);
  }

  private addItem(item: ItemId, n: number, at?: { x: number; y: number }): void {
    this.inventory[item] = (this.inventory[item] ?? 0) + n;
    if (at && n > 0) this.floatText(at.x, at.y, `+${n} ${ITEM_ICON[item]}`, '#fef08a');
  }

  private count(item: ItemId): number {
    return this.inventory[item] ?? 0;
  }

  /** mining a trunk fells the whole tree above it, leaves and all */
  private breakTile(tx: number, ty: number): void {
    if (this.homestead?.protects(tx, ty, true)) return;
    const id = this.tileAt(tx, ty);
    const info = TILE_INFO[id];
    if (!info || id === T.AIR) return;
    const at = { x: tx * TILE + TILE / 2, y: ty * TILE };
    if (id === T.TRUNK) {
      let top = ty;
      while (this.tileAt(tx, top - 1) === T.TRUNK) top--;
      let bottom = ty;
      while (this.tileAt(tx, bottom + 1) === T.TRUNK) bottom++;
      for (let y = top; y <= bottom; y++) this.setTile(tx, y, T.AIR);
      for (let dy = -3; dy <= 2; dy++) {
        for (let dx = -3; dx <= 3; dx++) if (this.tileAt(tx + dx, top + dy) === T.LEAVES) this.setTile(tx + dx, top + dy, T.AIR);
      }
      this.addItem('wood', (bottom - top + 1) * 2, at);
      this.harvested.tree = (this.harvested.tree ?? 0) + 1;
      return;
    }
    this.setTile(tx, ty, T.AIR);
    this.stats.mined += 1;
    this.spark(at.x, at.y + TILE / 2, info.color[1], 4);
    if (HARVESTABLE[id]) this.harvested[HARVESTABLE[id].kind] = (this.harvested[HARVESTABLE[id].kind] ?? 0) + 1;
    const ore = info.drop ? ORE_XP[info.drop] : undefined;
    if (info.drop) this.addItem(info.drop, ore ? this.hero.lootRoll(1) : 1, at);
    if (ore) this.hero.gainXp(ore);
    // plants and torches don't float: whatever sat on this tile drops too
    const above = this.tileAt(tx, ty - 1);
    if (above === T.HERB || above === T.TORCH) this.breakTile(tx, ty - 1);
  }

  /** place a block/torch; returns whether it happened */
  private placeTile(tx: number, ty: number, item: ItemId): boolean {
    if (this.pocket === 'foundry' || this.pocket === 'arena' || this.pocket === 'detention') return false;
    if (this.homestead?.protects(tx, ty)) return false;
    const id = PLACES[item];
    if (id === undefined || this.count(item) <= 0 || this.tileAt(tx, ty) !== T.AIR) return false;
    const neighbors = [this.tileAt(tx - 1, ty), this.tileAt(tx + 1, ty), this.tileAt(tx, ty - 1), this.tileAt(tx, ty + 1)];
    if (id === T.TORCH ? !neighbors.some(isSolid) : neighbors.every((n) => n === T.AIR)) return false;
    if (isSolid(id)) {
      const rect = new Phaser.Geom.Rectangle(tx * TILE, ty * TILE, TILE, TILE);
      const bodies = [this.player, ...this.enemies.map((e) => e.sprite)].map((s) => (s.body as Phaser.Physics.Arcade.Body));
      if (bodies.some((b) => Phaser.Geom.Intersects.RectangleToRectangle(rect, new Phaser.Geom.Rectangle(b.x, b.y, b.width, b.height)))) return false;
    }
    this.setTile(tx, ty, id);
    this.inventory[item] = this.count(item) - 1;
    this.stats.placed += 1;
    return true;
  }

  // ---------------- HUD ----------------

  private buildHud(): void {
    const font = 'system-ui, sans-serif';
    const hud = <T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: T) =>
      o.setScrollFactor(0).setDepth(60);
    hud(this.add.rectangle(16, 14, 220, 16, 0x1c1430).setOrigin(0).setStrokeStyle(1, 0x7f1d1d));
    this.hpBar = hud(this.add.rectangle(17, 15, 218, 14, 0xdc2626).setOrigin(0));
    this.hpText = hud(this.add.text(126, 22, '', { fontSize: '11px', fontFamily: font, fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5));
    hud(this.add.rectangle(16, 31, 220, 7, 0x10231c).setOrigin(0).setStrokeStyle(1, 0x14532d));
    this.staminaBar = hud(this.add.rectangle(17, 32, 218, 5, 0x4ade80).setOrigin(0));
    this.heroText = hud(this.add.text(16, 40, '', { fontSize: '11px', fontFamily: font, fontStyle: 'bold', color: '#fde68a', lineSpacing: 1 }));
    this.infoText = hud(this.add.text(16, 70, '', { fontSize: '12px', fontFamily: font, color: '#e9d5ff' }));
    this.swordText = hud(this.add.text(RW - 64, 58, '', { fontSize: '13px', fontFamily: font, fontStyle: 'bold', color: '#fca5a5' }).setOrigin(1, 0));

    this.relicText = hud(this.add.text(16, 88, '', { fontSize: '13px', fontFamily: font, color: '#ffffff' }));
    this.buffText = hud(this.add.text(16, 107, '', { fontSize: '12px', fontFamily: font, color: '#a7f3d0' }));
    this.breathBack = hud(this.add.rectangle(16, 124, 120, 8, 0x0c1a2e).setOrigin(0).setStrokeStyle(1, 0x38bdf8).setVisible(false));
    this.breathBar = hud(this.add.rectangle(17, 125, 118, 6, 0x38bdf8).setOrigin(0).setVisible(false));

    this.slotLabel = hud(this.add.text(HOTBAR_CX, 64, '', { fontSize: '12px', fontFamily: font, color: '#fef08a' }).setOrigin(0.5, 0));
    this.comboText = hud(this.add.text(HOTBAR_CX, 82, '', { fontSize: '15px', fontFamily: font, fontStyle: 'bold', color: '#f472b6', stroke: '#0b0714', strokeThickness: 3 }).setOrigin(0.5, 0));
    this.rebuildHotbar();

    // a single column of real thumb targets down the right edge; the minimap sits beside it
    const btn = (y: number, label: string, name: string, onTap: () => void) => {
      const b = hud(this.add.rectangle(RW - 30, y, 48, 38, 0x241a3c, 0.92).setStrokeStyle(1, 0x5b4a86).setInteractive({ useHandCursor: true }));
      hud(this.add.text(RW - 30, y - 5, label, { fontSize: '15px', fontFamily: font, color: '#ffffff' }).setOrigin(0.5));
      hud(this.add.text(RW - 30, y + 12, name, { fontSize: '8px', fontFamily: font, fontStyle: 'bold', color: '#c4b5fd' }).setOrigin(0.5));
      b.on('pointerdown', onTap);
    };
    let by = 26;
    const next = () => { const y = by; by += 43; return y; };
    btn(next(), '⏸', 'PAUSE', () => this.pauseRealm());
    btn(next(), '⚒', 'CRAFT', () => this.toggleCraft());
    if (this.homestead) btn(next(), '⌂', 'HOME', () => this.toggleHome());
    btn(next(), '📖', 'JOURNAL', () => this.expedition?.toggleJournal());
    btn(next(), '🧍', 'HERO', () => this.toggleHeroMenu());
    this.homeText = hud(this.add.text(16, 143, '', { fontSize: '12px', fontFamily: font, color: '#a7f3d0' }));
    this.expeditionText = hud(this.add.text(16, 166, '', { fontSize: '12px', fontFamily: font, color: '#f9d68c', wordWrap: { width: 510 }, padding: { x: 5, y: 3 } }));
    // Story Mode's objective is a button: it opens the QUEST page
    this.expeditionText.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      if (this.story?.active && !this.heroMenu?.open && !this.anyMenuOpen()) this.heroMenu?.toggle(TAB_QUEST);
    });

    this.promptText = hud(this.add.text(RW / 2, RH - 60, '', {
      fontSize: '14px', fontFamily: font, fontStyle: 'bold', color: '#ffffff', backgroundColor: '#0b0714cc', padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setVisible(false));
    this.promptText.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      if (!this.ready || this.dead || this.homestead?.open || this.craftPanel?.visible || this.expedition?.open || this.heroMenu?.open || this.duel?.open) return;
      const portal = this.portalHere();
      if (portal) void this.travel(portal);
      else if (this.duel?.prompt() || this.dashTrials?.prompt() || this.arena?.prompt() || this.rifts?.prompt()) this.interactActivity();
      else if (this.expedition?.prompt()) this.expedition.interact();
      else if (!this.homestead?.nearby() && this.story?.prompt()) this.story.interact();
      else if (!this.homestead?.placing) this.homestead?.interact();
    });
    this.bossBack = hud(this.add.rectangle(RW / 2, 112, 404, 14, 0x1c1430).setStrokeStyle(1, 0xe11d48).setVisible(false));
    this.bossBar = hud(this.add.rectangle(RW / 2 - 200, 112, 400, 10, 0xe11d48).setOrigin(0, 0.5).setVisible(false));
    this.bossText = hud(this.add.text(RW / 2, 97, '', { fontSize: '12px', fontFamily: font, fontStyle: 'bold', color: '#fecdd3' }).setOrigin(0.5).setVisible(false));
    this.bannerText = hud(this.add.text(RW / 2, RH / 2 - 90, '', {
      fontSize: '26px', fontFamily: font, fontStyle: 'bold', color: '#fef08a', align: 'center', stroke: '#0b0714', strokeThickness: 5, wordWrap: { width: 860 },
    }).setOrigin(0.5).setAlpha(0).setDepth(65));
    for (let i = 0; i < 14; i++) this.windStreaks.push(hud(this.add.rectangle(0, 0, 60, 2, 0xffffff, 0.5).setVisible(false)));

    if (this.sys.game.device.os.desktop) {
      const hint = hud(this.add.text(RW / 2, RH - 12,
        'A/D move · W jump · J sword · K/click use · E craft · H home · I hero · S interact    🎮 A jump · X sword · RT use · RS aim · Y craft · LT home · L3 hero · ▼ interact',
        { fontSize: '11px', fontFamily: font, color: '#b7aed0' }).setOrigin(0.5, 1));
      this.tweens.add({ targets: hint, alpha: 0, delay: 25_000, duration: 1500 });
    }

    if (!this.sys.game.device.os.desktop) this.buildTouchControls();
    this.groupHudBatches();
    this.updateHud();
  }

  /**
   * The GPU draws in depth order, and each switch between a shape and a texture is a new
   * draw call. The hotbar alone alternated box, label, box, label: twenty switches a frame.
   * Lift every HUD texture a hair above the HUD shapes at the same depth, so all the boxes
   * draw in one batch and all the labels in the next. Labels already sat on their boxes.
   */
  private groupHudBatches(): void {
    for (const o of this.children.list as (Phaser.GameObjects.GameObject & Partial<Phaser.GameObjects.Components.Depth & Phaser.GameObjects.Components.ScrollFactor>)[]) {
      if (o.scrollFactorX !== 0 || o.depth === undefined || o.depth % 1 !== 0) continue;
      if (o.type === 'Text') o.setDepth!(o.depth + 0.4);
      else if (o.type === 'Image' || o.type === 'TileSprite') o.setDepth!(o.depth + 0.2);
    }
  }

  /**
   * The thumbs. Zones are polled against every finger each frame instead of waiting for
   * per-button events, so holding a direction can never swallow jump or attack, and a thumb
   * can slide from ◀ to ▶ without lifting. See pollTouch().
   */
  private buildTouchControls(): void {
    const zone = (x: number, y: number, r: number, label: string, set: (down: boolean) => void) => {
      // interactive with no listener: taps here must not also count as taps on the world
      const face = this.add.circle(x, y, r - 6, 0xffffff, 0.13).setStrokeStyle(2, 0xffffff, 0.28).setScrollFactor(0).setDepth(60).setInteractive();
      const text = this.add.text(x, y, label, { fontSize: '24px', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0).setDepth(61);
      this.touchZones.push({ x, y, r, held: false, face, set });
      return text;
    };
    zone(58, RH - 62, 56, '◀', (d) => { this.touch.left = d; });
    zone(166, RH - 62, 56, '▶', (d) => { this.touch.right = d; });
    zone(RW - 58, RH - 62, 56, '⤒', (d) => { if (d && !this.touch.jump) this.touchJumpPressed = true; this.touch.jump = d; });
    zone(RW - 166, RH - 62, 56, '⚔', (d) => { if (d && !this.touch.attack) this.touchAttackPressed = true; this.touch.attack = d; });
    this.useIcon = zone(RW - 112, RH - 158, 46, '⛏', (d) => { if (d && !this.touch.use) this.touchUsePressed = true; this.touch.use = d; });
    zone(RW - 274, RH - 62, 52, '🛡', (d) => { this.touch.guard = d; });
    // the trick pad: only while the yoyo is in hand
    const trick = (x: number, y: number, label: string, dir: TrickInput) => {
      const r = this.add.circle(x, y, 22, 0x5eead4, 0.22).setScrollFactor(0).setDepth(60).setInteractive();
      const t = this.add.text(x, y, label, { fontSize: '16px', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0).setDepth(61);
      r.on('pointerdown', () => this.yoyo.input(dir));
      this.trickPad.push(r, t);
    };
    trick(RW - 150, RH - 190, '↑', 'up');
    trick(RW - 150, RH - 130, '↓', 'down');
    trick(RW - 206, RH - 160, '←', 'left');
    trick(RW - 94, RH - 160, '→', 'right');
  }

  private pollTouch(): void {
    if (!this.touchZones.length) return;
    const down = this.input.manager.pointers.filter((p) => p.isDown);
    for (const z of this.touchZones) {
      const held = down.some((p) => Math.hypot(p.x - z.x, p.y - z.y) <= z.r);
      if (held !== z.held) {
        z.held = held;
        z.face.setFillStyle(0xffffff, held ? 0.34 : 0.13);
      }
      z.set(held);
    }
  }

  private banner(title: string, sub = ''): void {
    this.bannerText.setFontSize(26).setText(sub ? `${title}\n${sub}` : title).setAlpha(1);
    this.tweens.killTweensOf(this.bannerText);
    this.tweens.add({ targets: this.bannerText, alpha: 0, delay: 2600, duration: 900 });
  }

  private updateHud(): void {
    const storyLine = this.arena?.hud() || this.dashTrials?.hud() ? '' : this.story?.objective() ?? '';
    this.expeditionText?.setText(storyLine || this.arena?.hud() || this.dashTrials?.hud() || (this.pocket === 'arena' || this.pocket === 'detention' ? '' : this.expedition?.objective() ?? ''));
    // restyling re-uploads the text's texture, so only when it really changes
    if (!!storyLine !== this.expeditionStory) {
      this.expeditionStory = !!storyLine;
      this.expeditionText?.setBackgroundColor(storyLine ? '#2a103dd9' : '#00000000').setColor(storyLine ? '#fde68a' : '#f9d68c');
    }
    this.arenaMapMark?.setVisible(!!this.minimapDot?.visible);
    if (this.rifts) {
      const next = this.rifts.nextRift();
      this.riftMarks.forEach((mark, i) => {
        const state = this.rifts!.state(i);
        const show = i === next || (this.rifts!.spots[i].seen && state !== 'sealed');
        mark.setVisible(!!this.minimapDot?.visible && show).setFillStyle(state === 'cleared' ? 0xfacc15 : 0xa855f7).setSize(i === next ? 6 : 4, i === next ? 6 : 4);
      });
    }
    if (this.foundryMapMark) this.foundryMapMark.setVisible(!!this.expedition?.progress.discovered && !!this.minimapDot?.visible);
    const seen = new Set(this.duel?.seenPros() ?? []);
    for (const [id, mark] of this.proMarks) mark.setVisible(!!this.minimapDot?.visible && seen.has(id));
    const home = this.homestead?.home;
    const dx = home ? (home.tx + 1.5) * TILE - this.player.x : 0;
    const dy = home ? (home.ty + 1) * TILE - this.player.y : 0;
    const distance = Math.round(Math.hypot(dx, dy) / TILE);
    this.homeText?.setText(this.homestead ? `${home ? distance < 4 ? '⌂ Home' : `⌂ Home ${Math.abs(dy) > Math.abs(dx) ? dy < 0 ? '↑' : '↓' : dx < 0 ? '←' : '→'} ${distance} m` : hint('H / LT · build a homestead', '⌂ build a homestead')}${this.homestead.warmth() ? ' · Warmth +' : ''}` : '');
    this.hpBar.width = 218 * Math.max(0, this.hp) / this.maxHp;
    this.staminaBar.width = 218 * (this.combat.stamina / STAMINA_MAX);
    this.staminaBar.setFillStyle(this.combat.stun > 0 ? 0xef4444 : this.combat.stamina < 25 ? 0xfacc15 : 0x4ade80);
    this.hpText.setText(`HP ${Math.ceil(Math.max(0, this.hp))} / ${this.maxHp}`);
    this.relicText.setText(POCKET_ORDER.map((id) => (this.relics.has(id) ? RELICS[id].icon : '◌')).join(' '));
    const t = this.hero.timers;
    const effects = ([['speed', '⚡'], ['freeze', '❄'], ['plunder', '💰'], ['airJump', '⤊']] as const)
      .filter(([k]) => t[k] > 0).map(([k, icon]) => `${icon} ${Math.ceil(t[k] / 1000)}s`);
    this.buffText.setText([...BREW_IDS.filter((b) => (this.buffs[b] ?? 0) > 0).map((b) => `${ITEM_ICON[b]} ${Math.ceil(this.buffs[b]! / 1000)}s`), ...effects].join('  ')
      + (this.hazardHere() === 'ember' && !this.heatProof() ? '   🔥 HEAT' : ''));
    const h = this.hero;
    const xp = h.xpProgress();
    this.heroText.setText(`${h.character.emoji} ${h.character.name} · Lv ${xp.level}${xp.level < 20 ? ` · ${xp.into}/${xp.need} XP` : ''}\n${h.unbanked ? `+${h.unbanked} unbanked` : 'all XP banked'}`
      + `${h.stats.guardPips ? ` · 🛡${'◆'.repeat(h.guard)}${'◇'.repeat(h.stats.guardPips - h.guard)}` : ''}${h.stats.revives ? ` · ✚${h.revivesLeft}` : ''}`);
    this.comboText.setText(h.combo > 1 ? `COMBO ×${h.combo} · +${Math.round((h.comboMult - 1) * 100)}%` : '');
    const showBreath = this.breath < BREATH_MAX;
    this.breathBack.setVisible(showBreath);
    this.breathBar.setVisible(showBreath).width = 118 * (this.breath / BREATH_MAX);
    const b = this.boss;
    for (const o of [this.bossBack, this.bossBar, this.bossText]) o.setVisible(!!b);
    if (b) {
      this.bossBar.width = 400 * (b.hp / b.def.hp);
      this.bossText.setText(`${b.def.name}${enraged(b) ? ' · ENRAGED' : ''}`);
    }
    if (this.pocket) {
      this.infoText.setText(`${POCKETS[this.pocket].name} · 🧪 ${this.count('potion')}`);
    } else {
      const night = nightFactor(this.clock) > 0.5;
      const depth = this.depthTiles();
      this.infoText.setText(`${night ? '🌙 Night' : '☀ Day'} · ${depth > 0 ? `${depth} m deep` : 'surface'} · 🧪 ${this.count('potion')}`);
    }
    this.swordText.setText(`⚔ ${this.weapon?.name ?? SWORDS[this.sword].name} (${Math.round(this.swordDamage() * this.hero.stats.damageMult)})`);
    this.slots.forEach((slot, i) => {
      const selected = i === this.slot;
      this.slotBoxes[i]?.setStrokeStyle(selected ? 3 : 2, selected ? 0xfacc15 : 0x362a52);
      const t = this.slotTexts[i];
      if (t) {
        const size = slot === 'pickaxe' ? '20px' : '13px';
        if (t.style.fontSize !== size) t.setFontSize(size);
        t.setText(this.slotIcon(slot));
      }
    });
    this.slotLabel.setText(this.slotName(this.slots[this.slot]));
    if (this.useIcon) { const cur = this.slots[this.slot]; this.useIcon.setText(cur === 'pickaxe' ? '⛏' : cur === 'yoyo' ? '🪀' : cur === 'pogo' ? '🦘' : cur.startsWith('pog:') ? '⚡' : ITEM_ICON[cur as ItemId] ?? 'USE'); }
    const yoyoInHand = this.slots[this.slot] === 'yoyo';
    for (const o of this.trickPad) (o as Phaser.GameObjects.Arc).setVisible(yoyoInHand);
  }

  private activeFor(slot: Slot) {
    return slot.startsWith('pog:') ? this.hero.activeRows().find((r) => `pog:${r.id}` === slot) : undefined;
  }

  private slotIcon(slot: Slot): string {
    if (slot === 'pickaxe') return '⛏';
    if (slot === 'yoyo') return `🪀\n${this.yoyo.strings}`;
    if (slot === 'pogo') return this.riding ? '🦘\nON' : '🦘';
    const active = this.activeFor(slot);
    if (active) return `${active.def.emoji}\n${this.hero.chargesLeft(active.id)}`;
    return `${ITEM_ICON[slot as ItemId]}\n${this.count(slot as ItemId)}`;
  }

  private slotName(slot: Slot | undefined): string {
    if (!slot) return '';
    if (slot === 'pickaxe') return PICKAXES[this.pickaxe].name;
    if (slot === 'yoyo') return `${YOYOS[this.yoyoTier].name} · ${this.yoyo.status()}`;
    if (slot === 'pogo') return this.riding ? 'Pogo Stick · riding · hold jump for a super bounce, press it just before landing for a perfect · use to hop off'
      : 'Pogo Stick · use to hop on: faster, bouncier, stomps enemies · hits hurt 25% more, no regen';
    const active = this.activeFor(slot);
    if (active) return `${active.def.name} · ${realmActiveText(active.effect)} · ${this.hero.chargesLeft(active.id)} left (refills when you sleep or cross a portal)`;
    const brew = (BREW_IDS as string[]).includes(slot) ? ` · ${BREWS[slot as BrewId].effect}` : '';
    return `${ITEM_NAME[slot as ItemId]} ×${this.count(slot as ItemId)}${brew}`;
  }

  /** fixed slots, then one per equipped pog with an active ability */
  private rebuildHotbar(): void {
    if (!this.hero || !this.slotLabel) return;
    for (const o of [...this.slotBoxes, ...this.slotTexts]) o.destroy();
    this.slotBoxes = [];
    this.slotTexts = [];
    const previous = this.slots[this.slot];
    this.slots = [...HOTBAR, ...(this.hasPogo ? ['pogo' as const] : []), ...(this.yoyoTier > 0 ? ['yoyo' as const] : []), ...this.hero.activeRows().map((r) => `pog:${r.id}` as Slot)];
    const keep = previous ? this.slots.indexOf(previous) : -1;
    this.slot = keep >= 0 ? keep : Math.min(this.slot, this.slots.length - 1);
    const n = this.slots.length;
    // between the HP column and the button column, shrinking as the bar grows
    const gap = Math.min(46, Math.floor((HOTBAR_X1 - HOTBAR_X0) / n));
    const size = gap - 4;
    this.slots.forEach((_, i) => {
      const x = HOTBAR_CX + (i - (n - 1) / 2) * gap;
      const box = this.add.rectangle(x, 30, size, size, 0x1c1430, 0.85).setStrokeStyle(2, 0x362a52).setInteractive().setScrollFactor(0).setDepth(60);
      box.on('pointerdown', () => { this.slot = i; });
      this.slotBoxes.push(box);
      this.slotTexts.push(this.add.text(x, 30, '', { fontSize: '18px', fontFamily: 'system-ui, sans-serif', align: 'center' }).setOrigin(0.5).setScrollFactor(0).setDepth(60));
    });
    if (this.ready) { this.groupHudBatches(); this.updateHud(); } // buildHud() refreshes once everything exists
  }

  private floatText(x: number, y: number, text: string, color: string): void {
    const t = this.add.text(x, y, text, { fontSize: '12px', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', color })
      .setOrigin(0.5).setDepth(45);
    this.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }

  // ---------------- input ----------------

  private buildInput(): void {
    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = kb.addKeys({
      a: K.A, d: K.D, w: K.W, space: K.SPACE, j: K.J, k: K.K, e: K.E, q: K.Q, esc: K.ESC,
      up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT,
      one: K.ONE, two: K.TWO, three: K.THREE, four: K.FOUR, five: K.FIVE, six: K.SIX,
      seven: K.SEVEN, eight: K.EIGHT, nine: K.NINE, zero: K.ZERO, s: K.S, tab: K.TAB, h: K.H, n: K.N, i: K.I, l: K.L, shift: K.SHIFT,
    }) as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', () => { this.lastMouseMove = this.time.now; });
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (this.ending) {
        if (this.endingReady) void this.travel('home');
        return;
      }
      if (over.length > 0 || this.dialogue?.open || this.craftPanel?.visible || this.homestead?.open || this.expedition?.open || this.heroMenu?.open || this.duel?.open || this.dead || !this.ready) return;
      this.lastMouseMove = this.time.now;
      if (pointer.rightButtonDown()) this.attackPress();
      else { this.pointerUse = true; this.usePointerId = pointer.id; }
    });
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.id === this.usePointerId) { this.pointerUse = false; this.usePointerId = -1; }
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.cycleSlot(dy > 0 ? 1 : -1));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointermove');
      this.input.off('pointerdown');
      this.input.off('pointerup');
      this.input.off('wheel');
      kb.removeAllKeys(true);
    });
  }

  private cycleSlot(dir: number): void {
    this.slot = (this.slot + dir + this.slots.length) % this.slots.length;
  }

  private toggleHeroMenu(): void {
    if (!this.heroMenu?.open && (!this.ready || this.dead || this.homestead?.open || this.expedition?.open || this.duel?.open || this.craftPanel?.visible || this.ending)) return;
    this.homestead?.cancelPlacement();
    this.heroMenu?.toggle();
  }

  /** every full-screen menu freezes the world the same way */
  private menuPause(open: boolean): void {
    this.pointerUse = false;
    this.mining = null;
    this.touch = { left: false, right: false, jump: false, attack: false, use: false, guard: false };
    this.touchJumpPressed = false;
    this.touchAttackPressed = false;
    if (open) { this.physics.pause(); this.aimRect?.setVisible(false); } else this.physics.resume();
  }

  /** heroes change at home: your spawn, your bed or a campfire, with no enemies about */
  private switchBlocked(): string | null {
    if (this.pocket) return 'only in the overworld';
    if (this.enemies.some((e) => Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, this.player.x, this.player.y) < 160)) return 'enemies nearby';
    const atSpawn = Phaser.Math.Distance.Between(this.spawnPoint.x, this.spawnPoint.y, this.player.x, this.player.y) < TILE * 6;
    if (atSpawn || this.homestead?.warmth() || this.homestead?.nearby()?.kind === 'bed') return null;
    return 'stand by your bed, a campfire or your spawn point';
  }

  private records(): string[] {
    const s = this.stats;
    const minutes = Math.floor(s.playMs / 60_000);
    return [
      `This world · ⛏ ${s.mined} mined · 🧱 ${s.placed} placed · ⚒ ${s.crafted} crafted · ⏳ ${Math.floor(minutes / 60)}h ${minutes % 60}m`,
      `⚔ ${s.slain} slain · 👑 ${s.bosses} bosses · ✝ ${s.deaths} deaths`,
      `Relics ${POCKET_ORDER.map((id) => (this.relics.has(id) ? RELICS[id].icon : '◌')).join(' ')}${this.champion ? ' · ✦ Forever Champion' : ''}`,
      `Buried Foundry · ${this.expedition?.progress.clears ?? 0} clears · ${this.expedition?.progress.cachesOpened ?? 0} caches`,
      ...(this.duel?.recordLines() ?? []),
      ...(this.dashTrials?.recordLines() ?? []),
      ...(this.arena?.recordLines() ?? []),
      ...(this.rifts?.recordLines() ?? []),
    ];
  }

  private gearRows(): PanelRow[] {
    const y = YOYOS[this.yoyoTier];
    const rows: PanelRow[] = [{
      label: this.yoyoTier ? `🪀 ${y.name} · ${y.damage} damage · reach ${y.reach} · tricks up to ${y.maxLen} inputs · craft a better one at the bench`
        : '🪀 No yoyo yet · craft a Wooden Yoyo (6 wood, 2 gel) at the bench to start landing tricks',
    }];
    for (const t of TRICKS) {
      const known = t.sequence.length <= y.maxLen;
      rows.push({ label: `${known ? '' : '🔒 '}${t.name} ${t.sequence.map((i) => INPUT_GLYPH[i]).join(' ')} · ${TRICK_EFFECTS[t.name]?.blurb ?? ''}`, enabled: known, color: known ? '#5eead4' : undefined });
    }
    return rows;
  }

  /** arrow keys, or a right-stick flick out from centre, while a trick window is open */
  private readTrickInput(pads: PadFrame[], k: Record<string, Phaser.Input.Keyboard.Key>, active: boolean): void {
    if (!active || this.yoyoTier === 0) return;
    const J = Phaser.Input.Keyboard.JustDown;
    const keys: [Phaser.Input.Keyboard.Key, TrickInput][] = [[k.up, 'up'], [k.down, 'down'], [k.left, 'left'], [k.right, 'right']];
    for (const [key, dir] of keys) if (J(key)) this.yoyo.input(dir);
    const stick = pads.map((p) => p.sticks).find((st) => Math.hypot(st.rx, st.ry) > 0.7);
    if (!stick) {
      if (pads.every((p) => Math.hypot(p.sticks.rx, p.sticks.ry) < 0.3)) this.stickNeutral = true;
      return;
    }
    // a stick already held when the window opened (aiming the throw) doesn't count until it recentres
    if (this.stickNeutral && this.yoyo.window > 0) {
      this.yoyo.input(Math.abs(stick.rx) > Math.abs(stick.ry) ? (stick.rx > 0 ? 'right' : 'left') : (stick.ry > 0 ? 'down' : 'up'));
    }
    this.stickNeutral = false;
  }

  /** the nearest in-world activity: a duelist, a Dash Trial flag, the arena ladder */
  private interactActivity(): void {
    if (this.duel?.prompt()) this.duel.interact();
    else if (this.dashTrials?.prompt()) this.dashTrials.interact();
    else if (this.arena?.prompt()) this.arena.interact();
    else if (this.rifts?.prompt()) this.rifts.interact();
  }

  /** columns the rifts keep clear of: spawn, the shrine, and every world object */
  private reservedColumns(): number[] {
    const sx = this.world.spawn.tx;
    const cols = [sx];
    for (let x = sx + SHRINE_OFFSET - 2; x <= sx + SHRINE_OFFSET + SHRINE_W + 2; x++) cols.push(x);
    const e = this.expedition?.entrance;
    if (e) cols.push(e.tx, e.tx + 2);
    const g = this.arena?.gate;
    if (g) cols.push(g.tx, g.tx + 2, g.tx + 4);
    for (const c of this.dashTrials?.courses ?? []) cols.push(Math.floor(c.start.x / TILE));
    for (const spot of Object.values(this.duel?.spots ?? {})) cols.push(spot.tx);
    return cols;
  }

  /** save, then hand the hero to Pog Quest; the result screen brings them back here */
  private async enterRift(index: number): Promise<void> {
    if (!this.ready) return;
    this.ready = false;
    this.menuPause(false);
    await this.save();
    this.handedOff = true;
    this.registry.set(REGISTRY_KEY_CHARACTER, this.hero.character.id);
    this.registry.set(REGISTRY_KEY_PLATFORMER_LEVEL_INDEX, index);
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.time.delayedCall(260, () => this.scene.start('PlatformerRun'));
  }

  private mount(): void {
    if (!this.hasPogo || this.isWaterAt(this.player.x, this.player.y - 18)) return;
    this.riding = true;
    this.stompChain = 0;
    this.floatText(this.player.x, this.player.y - 56, '🦘 BOING', '#fde68a');
  }

  private dismount(): void {
    if (!this.riding) return;
    this.riding = false;
    this.pogoGfx?.clear();
  }

  /** landing on the stick: a hop, a held-jump super bounce, or a perfectly timed one */
  private pogoBounce(body: Phaser.Physics.Arcade.Body, grounded: boolean, jumpHeld: boolean): void {
    if (!grounded || body.velocity.y < 0) return;
    this.stompChain = 0;
    const perfect = this.time.now - this.lastJumpPressAt < 150;
    const factor = perfect ? 1.45 : jumpHeld ? 1.2 : 0.62;
    body.setVelocityY(PHYS.jumpVelocity * JUMP_SCALE * this.hero.stats.jumpMult * factor);
    this.ctrl.jumpCutApplied = true;
    this.lastJumpPressAt = -1e9;
    if (perfect) {
      this.hero.hitLanded();
      this.floatText(this.player.x, this.player.y - 50, 'PERFECT BOUNCE', '#fde047');
    }
  }

  /** riding and falling onto something: it takes the hit, you bounce */
  private tryStomp(sprite: Phaser.Physics.Arcade.Sprite, e?: RealmEnemy): boolean {
    const pb = this.player.body as Phaser.Physics.Arcade.Body;
    const tb = sprite.body as Phaser.Physics.Arcade.Body;
    if (!this.riding || this.dead || pb.velocity.y < 120 || pb.bottom > tb.top + 14) return false;
    const { damage, crit } = this.hero.strike(12 + pb.velocity.y / 30);
    pb.setVelocityY(PHYS.jumpVelocity * JUMP_SCALE * 0.95);
    this.ctrl.jumpCutApplied = true;
    this.stompChain++;
    this.invuln = Math.max(this.invuln, 150);
    if (e) this.hurtEnemy(e, damage, sprite.x < this.player.x ? -1 : 1, crit);
    else this.damageBoss(damage, crit);
    this.hero.hitLanded();
    this.dashTrials?.stomped(this.stompChain);
    if (this.stompChain > 1) this.floatText(this.player.x, this.player.y - 60, `STOMP ×${this.stompChain}`, '#fde68a');
    return true;
  }

  /** the stick under the hero, with your equipped pogs stacked on the footpeg */
  private drawPogo(): void {
    const g = this.pogoGfx.clear();
    if (!this.riding || this.dead) return;
    const x = this.player.x + this.facing * 5;
    const y = this.player.y;
    g.lineStyle(2, 0x9ca3af).lineBetween(x, y - 30, x, y + 3);
    g.lineStyle(2, 0x1f2937).lineBetween(x - 5, y - 30, x + 5, y - 30);
    g.lineStyle(1, 0xe5e7eb);
    for (let i = 0; i < 3; i++) g.lineBetween(x - 3, y - 2 - i * 3, x + 3, y - 3 - i * 3);
    g.fillStyle(0x374151).fillRect(x - 7, y - 12, 14, 2);
    this.hero.snap.pogs.filter((r) => r.instance.equipped).slice(0, 6)
      .forEach((r, i) => g.fillStyle(r.def.color, 1).fillEllipse(x + 5, y - 13 - i * 2, 8, 3));
  }

  private bounceStomp(scale: number, damage: number): void {
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocityY(PHYS.jumpVelocity * JUMP_SCALE * scale);
    this.stomp = { damage, airborne: false };
  }

  private pauseRealm(): void {
    if (!this.ready || !this.scene.isActive()) return;
    this.pointerUse = false;
    this.touch = { left: false, right: false, jump: false, attack: false, use: false, guard: false };
    void this.save();
    this.scene.launch('PlatformerPause', { target: 'Realm' });
    this.scene.pause();
  }

  // ---------------- crafting ----------------

  private toggleHome(): void {
    if (this.homestead?.placing) this.homestead.cancelPlacement();
    else this.homestead?.toggle();
  }

  private toggleCraft(): void {
    if (!this.ready || this.dead || this.homestead?.open || this.expedition?.open || this.heroMenu?.open || this.duel?.open || this.ending) return;
    this.homestead?.cancelPlacement();
    if (!this.craftPanel) this.buildCraftPanel();
    const open = !this.craftPanel!.visible;
    this.craftPanel!.setVisible(open);
    if (open) {
      this.physics.pause();
      this.refreshCraft();
    } else {
      this.physics.resume();
    }
  }

  private buildCraftPanel(): void {
    const font = 'system-ui, sans-serif';
    const panel = this.add.container(RW / 2, RH / 2).setScrollFactor(0).setDepth(80);
    panel.add(this.add.rectangle(0, 0, 900, 480, 0x0b0714, 0.96).setStrokeStyle(2, 0x7c3aed));
    panel.add(this.add.text(0, -218, 'ALCHEMY & SMITHING', { fontSize: '18px', fontFamily: font, fontStyle: 'bold', color: '#c4b5fd' }).setOrigin(0.5));
    panel.add(this.add.text(0, 224, hint('click / A to craft · ↑ ↓ choose · E / Y / B to close', 'tap a recipe to craft · tap × to close'), { fontSize: '11px', fontFamily: font, color: '#8b80a8' }).setOrigin(0.5));
    const close = this.add.rectangle(420, -216, 48, 36, 0x241b3a).setStrokeStyle(1, 0x7c3aed).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.toggleCraft());
    panel.add([close, this.add.text(420, -216, '×', { fontSize: '18px', fontFamily: font, fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5)]);
    const perColumn = Math.ceil(RECIPES.length / 2);
    RECIPES.forEach((recipe, i) => {
      const x = i < perColumn ? -222 : 222;
      const y = -180 + (i % perColumn) * 46;
      const bg = this.add.rectangle(x, y, 432, 40, 0x1c1430).setStrokeStyle(1, 0x362a52).setInteractive({ useHandCursor: true });
      const text = this.add.text(x - 206, y, '', { fontSize: '12px', fontFamily: font, color: '#ffffff', lineSpacing: 2 }).setOrigin(0, 0.5);
      bg.on('pointerdown', () => { this.craftIndex = i; this.craft(recipe); });
      panel.add([bg, text]);
      this.craftRows.push({ bg, text, recipe });
    });
    for (const child of panel.list) (child as Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text).setScrollFactor(0);
    panel.setVisible(false);
    this.craftPanel = panel;
  }

  private canCraft(recipe: Recipe): boolean {
    if ('pogo' in recipe.gives && this.hasPogo) return false;
    if ('yoyo' in recipe.gives && this.yoyoTier >= recipe.gives.yoyo) return false;
    if ('sword' in recipe.gives && this.sword >= recipe.gives.sword) return false;
    if ('pickaxe' in recipe.gives && this.pickaxe >= recipe.gives.pickaxe) return false;
    return Object.entries(recipe.cost).every(([item, n]) => this.count(item as ItemId) >= (n ?? 0));
  }

  private refreshCraft(): void {
    this.craftRows.forEach(({ bg, text, recipe }, i) => {
      const owned = ('sword' in recipe.gives && this.sword >= recipe.gives.sword) || ('pickaxe' in recipe.gives && this.pickaxe >= recipe.gives.pickaxe)
        || ('yoyo' in recipe.gives && this.yoyoTier >= recipe.gives.yoyo) || ('pogo' in recipe.gives && this.hasPogo);
      const cost = Object.entries(recipe.cost)
        .map(([item, n]) => `${ITEM_ICON[item as ItemId]} ${this.count(item as ItemId)}/${n}`)
        .join('   ');
      text.setText(`${recipe.name}\n${owned ? '✓ owned' : cost}`);
      text.setColor(owned ? '#6b6180' : this.canCraft(recipe) ? '#4ade80' : '#b7aed0');
      bg.setStrokeStyle(i === this.craftIndex ? 2 : 1, i === this.craftIndex ? 0xfacc15 : 0x362a52);
    });
  }

  private craft(recipe: Recipe): boolean {
    if (!this.canCraft(recipe)) {
      this.refreshCraft();
      return false;
    }
    for (const [item, n] of Object.entries(recipe.cost)) this.inventory[item as ItemId] = this.count(item as ItemId) - (n ?? 0);
    this.stats.crafted += 1;
    this.hero.gainXp(2);
    const g = recipe.gives;
    if ('item' in g) this.addItem(g.item, g.count);
    else if ('sword' in g) this.sword = g.sword;
    else if ('pogo' in g) {
      this.hasPogo = true;
      this.rebuildHotbar();
      this.banner('🦘 POGO STICK', 'select it on the hotbar and use it to hop on · Dash Trials: 🏁 flags near spawn');
    } else if ('yoyo' in g) {
      this.yoyoTier = g.yoyo;
      this.yoyo.tier = g.yoyo;
      this.rebuildHotbar();
      this.banner(`🪀 ${YOYOS[g.yoyo].name}`, `select it on the hotbar · use to throw, then flick tricks · ${tricksFor(g.yoyo).length} tricks known`);
    } else this.pickaxe = g.pickaxe;
    this.floatText(this.player.x, this.player.y - 50, `✦ ${recipe.name}`, '#c4b5fd');
    this.refreshCraft();
    this.updateHud();
    return true;
  }

  // ---------------- update ----------------

  update(time: number, deltaMs: number): void {
    if (!this.ready) return;
    const dt = Math.min(deltaMs, 50);
    const pads = readPads(time);
    const pad = mergePads(pads);
    const k = this.keys;
    const J = Phaser.Input.Keyboard.JustDown;

    if (this.dialogue?.open) {
      this.dialogue.updateInput(pad.pressed, k);
      return;
    }
    if (this.ending) {
      if (this.endingReady && (pad.pressed.a || J(k.space) || J(k.k) || J(k.j))) void this.travel('home');
      return;
    }
    if (this.homestead?.open) {
      if (pad.pressed.menu) this.pauseRealm();
      else this.homestead.updateInput(pad.pressed, k);
      return;
    }
    if (this.expedition?.open) {
      if (pad.pressed.menu) this.pauseRealm();
      else this.expedition.updateInput(pad.pressed, k);
      return;
    }
    if (this.heroMenu?.open) {
      if (pad.pressed.menu) this.pauseRealm();
      else this.heroMenu.updateInput(pad.pressed, k);
      return;
    }
    if (this.duel?.open) {
      this.duel.update(dt);
      this.duel.updateInput(pad.pressed, k);
      return;
    }
    if (this.dashTrials?.open) {
      this.dashTrials.updateInput(pad.pressed, k);
      return;
    }
    if (this.arena?.open) {
      this.arena.updateInput(pad.pressed, k);
      return;
    }
    if (this.rifts?.open) {
      this.rifts.updateInput(pad.pressed, k);
      return;
    }
    if (pad.pressed.r3 || J(k.n)) { this.expedition?.toggleJournal(); return; }
    if (pad.pressed.l3 || J(k.i)) { this.toggleHeroMenu(); return; }
    if (this.homestead?.placing && (pad.pressed.b || J(k.esc))) { this.homestead.cancelPlacement(); return; }
    if (pad.pressed.menu || J(k.esc)) {
      this.pauseRealm();
      return;
    }
    if (pad.pressed.view || J(k.tab)) for (const o of this.minimapParts) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(!(o as unknown as Phaser.GameObjects.Components.Visible).visible);
    if (pad.pressed.y || J(k.e)) this.toggleCraft();
    if (this.craftPanel?.visible) {
      this.updateCraftInput(pad, k);
      return;
    }

    if (!this.pocket) this.clock += dt;
    this.stats.playMs += dt;
    this.updateLighting(dt);

    if (this.dead) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) this.respawn();
      return;
    }
    if (pad.pressed.lt || J(k.h)) { this.toggleHome(); return; }

    // hotbar & potion
    if (pad.pressed.lb) this.cycleSlot(-1);
    if (pad.pressed.rb) this.cycleSlot(1);
    (['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'zero'] as const).forEach((key, i) => { if (J(k[key]) && i < this.slots.length) this.slot = i; });
    if (J(k.q)) this.drinkPotion();

    // yoyo in hand: the arrow keys and right-stick flicks are trick inputs, not movement or aim
    const yoyoInHand = this.slots[this.slot] === 'yoyo';
    this.readTrickInput(pads, k, yoyoInHand);
    const downPressed = pad.pressed.down || J(k.s) || (!yoyoInHand && J(k.down));

    // movement
    this.pollTouch();
    let left = k.a.isDown || (!yoyoInHand && k.left.isDown) || pad.held.left || this.touch.left;
    let right = k.d.isDown || (!yoyoInHand && k.right.isDown) || pad.held.right || this.touch.right;
    let jumpPressed = pad.pressed.a || J(k.w) || J(k.space) || this.touchJumpPressed;
    const jumpHeld = pad.held.a || k.w.isDown || k.space.isDown || this.touch.jump;
    this.touchJumpPressed = false;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const grounded = body.blocked.down || body.touching.down;
    const inWater = this.isWaterAt(this.player.x, this.player.y - 18);
    this.updateDefence(dt, { left, right, grounded, inWater, guardHeld: !!(pad.held.b || k.l.isDown || this.touch.guard), dodgeKey: J(k.shift) });
    if (!this.combat.ready) { left = false; right = false; jumpPressed = false; }

    // portals: stand in one and press down
    const portal = this.portalHere();
    const sealed = !portal && this.nearSealedGate();
    const duelPrompt = !portal && !sealed ? this.duel?.prompt() || this.dashTrials?.prompt() || this.arena?.prompt() || this.rifts?.prompt() : '';
    const furniture = !portal && !sealed && !duelPrompt ? this.homestead?.nearby() : undefined;
    const expeditionPrompt = this.expedition?.prompt();
    const storyPrompt = !portal && !sealed && !duelPrompt && !furniture && !expeditionPrompt ? this.story?.prompt() : '';
    this.promptText.setVisible(!!portal || sealed || !!duelPrompt || !!furniture || !!this.homestead?.placing || !!expeditionPrompt || !!storyPrompt).setText(
      portal ? `${isTouch() ? 'Tap here · ' : '▼ '}${portal === 'home' ? 'return to the Overworld' : portal === 'forever' ? 'pass through the Forever Gate' : `enter the ${POCKETS[portal].name}`}`
      : sealed ? `the Forever Gate is sealed · ${this.relics.size}/${POCKET_ORDER.length} relics`
      : this.homestead?.placing ? this.homestead.placementHint()
      : duelPrompt ? duelPrompt
      : expeditionPrompt ? expeditionPrompt
      : furniture ? `${interactKey()} · ${ITEM_NAME[furniture.kind]}`
      : storyPrompt || '',
    );
    if (portal && downPressed) {
      void this.travel(portal);
      return;
    }
    if (duelPrompt && !this.homestead?.placing && downPressed) { this.interactActivity(); return; }
    if (furniture && !this.homestead?.placing && downPressed) {
      this.homestead?.interact(); return;
    }
    if (expeditionPrompt && downPressed) { this.expedition?.interact(); return; }
    if (storyPrompt && downPressed) { this.story?.interact(); return; }

    // Gale Plume (always) and a double-jump pog (while it lasts): extra jumps in the air
    if (grounded || inWater) this.airJumpsUsed = 0;
    const airJumps = (this.relics.has('gale') ? 1 : 0) + (this.hero.timers.airJump > 0 ? 1 : 0);
    if (jumpPressed && !grounded && !inWater && this.ctrl.coyoteMs <= 0 && this.airJumpsUsed < airJumps) {
      body.setVelocityY(PHYS.jumpVelocity * JUMP_SCALE * this.hero.stats.jumpMult * 0.92);
      this.ctrl.jumpCutApplied = false;
      this.airJumpsUsed += 1;
      jumpPressed = false;
    }
    const swimSpeed = inWater && !this.relics.has('tide') ? 0.7 : 1;
    if (this.riding && inWater) this.dismount();
    if (jumpPressed) this.lastJumpPressAt = this.time.now;
    const speed = MOVE_SPEED * swimSpeed * this.hero.stats.moveMult * (this.hero.timers.speed > 0 ? 1.6 : 1) * (this.riding ? 1.35 : 1)
      * (this.combat.guarding ? GUARD_MOVE_SCALE : this.combat.charge > 0 ? 0.55 : 1);
    updateController(body, { left, right, jumpPressed: jumpPressed && !inWater && !this.riding, jumpHeld }, this.ctrl,
      { moveSpeed: speed, moveAccel: PHYS.moveAccel * (speed / MOVE_SPEED), jumpScale: JUMP_SCALE * this.hero.stats.jumpMult, responsive: true }, dt);
    applyHeroGravity(body);
    // the top of a held jump hangs a moment, so a jump can be steered
    if (jumpHeld && !grounded && Math.abs(body.velocity.y) < 75) body.setGravityY(PHYS.gravityY * 0.6);
    this.updatePound(body, grounded);
    if (this.riding) this.pogoBounce(body, grounded, jumpHeld);
    if (this.dash.ms > 0) { this.dash.ms -= dt; body.setVelocityX(this.dash.vx); body.setVelocityY(Math.min(body.velocity.y, 0)); }
    this.updateEnvironment(dt, body, { inWater, grounded, jumpPressed, jumpHeld });
    if (left && !right) this.facing = -1;
    else if (right && !left) this.facing = 1;
    this.player.setFlipX(this.facing < 0);
    this.player.setScale(1, grounded && Math.abs(body.velocity.x) > 30 ? 1 + Math.sin(this.time.now / 55) * 0.04 : 1);
    this.invuln = Math.max(0, this.invuln - dt);
    this.player.setAlpha(this.invuln > 0 && Math.floor(this.invuln / 80) % 2 === 0 ? 0.45 : 1);

    // sword
    this.swingTimer = Math.max(0, this.swingTimer - dt);
    if (pad.pressed.x || J(k.j) || this.touchAttackPressed) this.attackPress();
    this.touchAttackPressed = false;
    this.updateAttack(dt, !!(pad.held.x || k.j.isDown || this.touch.attack));

    // aim & tool use
    this.aim = this.computeAim(pads, k);
    const using = pad.held.rt || k.k.isDown || this.pointerUse || this.touch.use;
    this.useTool(using, pad.pressed.rt || J(k.k) || this.touchUsePressed, dt);
    this.touchUsePressed = false;
    this.drawAim();

    // regen
    this.sinceHit += dt;
    if (this.sinceHit > REGEN_DELAY_MS && this.hp < this.maxHp && !this.riding) this.hp = Math.min(this.maxHp, this.hp + ((REGEN_PER_S * this.hero.stats.regenMult + (this.homestead?.warmth() ? 4 : 0)) * dt) / 1000);
    this.hero.tick(dt);
    this.yoyo.update(dt);
    this.applyFreeze();
    this.updateProjectiles();
    for (const b of BREW_IDS) if ((this.buffs[b] ?? 0) > 0) this.buffs[b] = Math.max(0, this.buffs[b]! - dt);

    this.updateHarvestHelp(dt);
    this.combat.tick(dt);
    this.updateTimeWarp(dt);
    this.story?.update(dt);
    this.burstCooldown = Math.max(0, this.burstCooldown - dt);
    this.updateMinimap(dt);
    this.updateEnemies(dt);
    this.updateHazards();
    this.updateBossFight(dt);
    this.expedition?.update(dt);
    this.duel?.update(dt);
    this.dashTrials?.update(dt);
    this.arena?.update(dt);
    this.rifts?.update();
    this.drawPogo();
    this.updateBackdrop(dt);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = SPAWN_EVERY_MS;
      this.trySpawn();
    }

    if (this.pocket) music.play(this.boss || this.arena?.bout ? 'danger' : this.bossDefeated ? 'win' : 'explore');
    else music.play(nightFactor(this.clock) > 0.5 && this.depthTiles() < 12 ? 'danger' : 'explore');
    this.updateHud();
    this.autosaveTimer += dt;
    if (this.autosaveTimer >= AUTOSAVE_MS) {
      this.autosaveTimer = 0;
      void this.save();
    }
  }

  private isWaterAt(x: number, y: number): boolean {
    return this.tileAt(Math.floor(x / TILE), Math.floor(y / TILE)) === T.WATER;
  }

  private heatProof(): boolean {
    return this.relics.has('ember') || (this.buffs.fireward ?? 0) > 0;
  }

  /**
   * Each realm's pressure: water (swim, breath), lava, the Ember heat, the
   * Gale void and wind. Runs after the controller so it can override it.
   */
  private updateEnvironment(dt: number, body: Phaser.Physics.Arcade.Body, s: { inWater: boolean; grounded: boolean; jumpPressed: boolean; jumpHeld: boolean }): void {
    const secs = dt / 1000;
    // swimming: floaty, strokes on jump, and your breath runs out with your head under
    const headUnder = this.isWaterAt(this.player.x, this.player.y - 36);
    if (s.inWater) {
      body.setGravityY(PHYS.gravityY * 0.18);
      // at the surface (head out) a jump breaches, full height, so you can climb out onto land
      if (s.jumpPressed) body.setVelocityY(headUnder ? SWIM_STROKE : PHYS.jumpVelocity * JUMP_SCALE);
      if (body.velocity.y > SWIM_MAX_FALL) body.setVelocityY(SWIM_MAX_FALL);
    }
    const canBreathe = this.relics.has('tide') || (this.buffs.gills ?? 0) > 0;
    if (headUnder && !canBreathe) this.breath = Math.max(0, this.breath - BREATH_LOSS_PER_S * secs);
    else this.breath = Math.min(BREATH_MAX, this.breath + 40 * secs);
    if (this.breath <= 0) this.drain(DROWN_PER_S * secs);

    // Gale Draught: hold jump to float down
    if ((this.buffs.gale ?? 0) > 0 && s.jumpHeld && body.velocity.y > GALE_FALL) body.setVelocityY(GALE_FALL);

    // lava burns (the Ember Heart makes you immune; a Fire Ward halves it)
    const feet = this.tileAt(Math.floor(this.player.x / TILE), Math.floor((this.player.y - 4) / TILE));
    const mid = this.tileAt(Math.floor(this.player.x / TILE), Math.floor((this.player.y - 20) / TILE));
    if ((feet === T.LAVA || mid === T.LAVA) && !this.relics.has('ember')) {
      if (this.invuln <= 0) {
        this.hurtPlayer(LAVA_DAMAGE * ((this.buffs.fireward ?? 0) > 0 ? 0.5 : 1), this.player.x);
        body.setVelocityY(-420);
      }
    } else if (s.grounded) {
      this.lastSafe = { x: this.player.x, y: this.player.y };
    }
    if (this.hazardHere() === 'ember' && !this.heatProof()) this.drain(HEAT_DRAIN_PER_S * secs);

    // the Gale void: falling off the islands costs HP and puts you back on the last ground
    const galeHere = this.hazardHere() === 'gale';
    this.windStreaks.forEach((r) => { if (!galeHere) r.setVisible(false); });
    if (galeHere) {
      if (this.player.y > (this.world.h - 3) * TILE) {
        body.reset(this.lastSafe.x, this.lastSafe.y);
        this.invuln = 1000;
        this.drain(VOID_DAMAGE);
        this.cameras.main.flash(150, 200, 220, 255);
      }
      this.wind.timer -= dt;
      if (this.wind.timer <= 0) {
        if (this.wind.force === 0) { this.wind.force = this.rand() < 0.5 ? -1 : 1; this.wind.timer = 1600; }
        else { this.wind.force = 0; this.wind.timer = 3500 + this.rand() * 2500; }
      }
      if (this.wind.force !== 0 && !s.grounded) {
        body.setVelocityX(Phaser.Math.Clamp(body.velocity.x + this.wind.force * WIND_ACCEL * secs, -260, 260));
      }
      this.windStreaks.forEach((r, i) => {
        r.setVisible(this.wind.force !== 0);
        if (this.wind.force !== 0) {
          const x = ((this.time.now * 0.9 + i * 137) % (RW + 120)) - 60;
          r.setPosition(this.wind.force > 0 ? x : RW - x, 40 + ((i * 97) % (RH - 80)));
        }
      });
    }
  }

  /** environmental damage: no knockback, no invulnerability window */
  private drain(amount: number): void {
    if (this.dead || amount <= 0) return;
    this.hp -= amount;
    this.sinceHit = 0;
    if (this.hp <= 0) this.die();
  }

  /** which portal the player is standing in: a realm (overworld shrine) or 'home' (inside a realm) */
  private portalHere(): PocketId | 'home' | null {
    if (!this.pocket && this.expedition?.nearEntrance()) return 'foundry';
    if (!this.pocket && this.arena?.nearGate()) return 'arena';
    const tx = Math.floor(this.player.x / TILE);
    const ty = Math.floor((this.player.y - 8) / TILE);
    if (this.tileAt(tx, ty) === T.ETERNAL) return 'forever';
    if (this.tileAt(tx, ty) !== T.PORTAL) return null;
    if (this.pocket) return 'home';
    const p = (this.world.portals ?? []).find((q) => tx >= q.tx && tx < q.tx + 2);
    return p?.pocket ?? null;
  }

  private nearSealedGate(): boolean {
    const gate = this.world.foreverGate;
    if (!gate || this.pocket) return false;
    const tx = Math.floor(this.player.x / TILE);
    return tx >= gate.tx - 2 && tx < gate.tx + GATE_W + 2 && this.tileAt(gate.tx, gate.ty) === T.GATE && Math.abs(this.player.y - (gate.ty + GATE_H) * TILE) < 40;
  }

  /** which realm's hazard applies here: the realm itself, or in the Eternal Hall the segment you're in */
  private hazardHere(): RelicId | undefined {
    if (!this.pocket || this.pocket === 'foundry' || this.pocket === 'arena' || this.pocket === 'detention') return undefined;
    if (this.pocket !== 'forever') return this.pocket;
    const tx = Math.floor(this.player.x / TILE);
    return FOREVER_SEGMENTS.find((s) => tx >= s.x0 && tx < s.x1)?.like;
  }

  private async travel(to: PocketId | 'home'): Promise<void> {
    if (!this.ready) return;
    this.ready = false; // freeze input while we save and swap worlds
    this.hero.refillCharges();
    await this.save();
    this.handedOff = true;
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.time.delayedCall(260, () => this.scene.restart(to === 'home' ? {} : { pocket: to }));
  }

  private updateCraftInput(pad: ReturnType<typeof mergePads>, k: Record<string, Phaser.Input.Keyboard.Key>): void {
    const J = Phaser.Input.Keyboard.JustDown;
    const n = this.craftRows.length;
    if (pad.pressed.down || J(k.down)) this.craftIndex = (this.craftIndex + 1) % n;
    if (pad.pressed.up || J(k.up)) this.craftIndex = (this.craftIndex - 1 + n) % n;
    if (pad.pressed.a || J(k.k) || J(k.space)) this.craft(this.craftRows[this.craftIndex].recipe);
    if (pad.pressed.b) this.toggleCraft();
    this.refreshCraft();
  }

  private depthTiles(): number {
    const tx = Phaser.Math.Clamp(Math.floor(this.player.x / TILE), 0, this.world.w - 1);
    return Math.max(0, Math.floor(this.player.y / TILE) - this.world.surface[tx]);
  }

  /** right stick > mouse (if used recently) > smart aim in front of / above / below you */
  private computeAim(pads: PadFrame[], k: Record<string, Phaser.Input.Keyboard.Key>): Aim | null {
    const cx = this.player.x;
    const cy = this.player.y - 20;
    let ax: number;
    let ay: number;
    const stick = pads.find((p) => Math.hypot(p.sticks.rx, p.sticks.ry) > 0.35)?.sticks;
    // the finger on the world, never whichever thumb happened to move last
    const pointer = this.input.manager.pointers.find((p) => p.id === this.usePointerId) ?? this.input.activePointer;
    const desktop = this.sys.game.device.os.desktop;
    if (stick) {
      ax = cx + stick.rx * REACH_PX;
      ay = cy + stick.ry * REACH_PX;
    } else if (this.pointerUse || (desktop && this.time.now - this.lastMouseMove < 2500)) {
      const at = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      ax = at.x;
      ay = at.y;
    } else {
      const padFrames = mergePads(pads).held;
      const arrows = this.slots[this.slot] !== 'yoyo';
      const up = (arrows && k.up.isDown) || (padFrames.up && !padFrames.left && !padFrames.right);
      const down = (arrows && k.down.isDown) || (padFrames.down && !padFrames.left && !padFrames.right);
      if (up) {
        ax = cx;
        ay = this.player.y - 44;
      } else if (down) {
        ax = cx;
        ay = this.player.y + 8;
      } else {
        ax = cx + this.facing * 18;
        ay = cy;
        // pickaxe: chest height, else foot height, else the ground just in front of you
        const tx = Math.floor(ax / TILE);
        // on touch there's no aiming a finger and moving at once: USE goes for what's worth having
        if (!desktop && this.harvestTile && this.slots[this.slot] === 'pickaxe') {
          ax = (this.harvestTile.tx + 0.5) * TILE;
          ay = (this.harvestTile.ty + 0.5) * TILE;
        } else if (this.slots[this.slot] === 'pickaxe') {
          for (const y of [cy, this.player.y - 6, this.player.y + 8]) {
            ay = y;
            if (this.tileAt(tx, Math.floor(y / TILE)) !== T.AIR) break;
          }
        }
      }
    }
    const dx = ax - cx;
    const dy = ay - cy;
    const d = Math.hypot(dx, dy);
    if (d > REACH_PX) {
      ax = cx + (dx / d) * REACH_PX;
      ay = cy + (dy / d) * REACH_PX;
    }
    if (ax < 0 || ay < 0) return null;
    return { tx: Math.floor(ax / TILE), ty: Math.floor(ay / TILE) };
  }

  private useTool(held: boolean, pressed: boolean, dt: number): void {
    if (this.homestead?.placing) {
      this.mining = null;
      if (this.aim) this.homestead.aim(this.aim.tx, this.aim.ty);
      if (held) { this.homestead.place(); this.pointerUse = false; }
      return;
    }
    const slot = this.slots[this.slot];
    this.placeTimer = Math.max(0, this.placeTimer - dt);
    if (slot.startsWith('pog:')) {
      this.mining = null;
      if (pressed && this.hero.useActive(slot.slice(4))) this.updateHud();
      return;
    }
    if (slot === 'pogo') {
      this.mining = null;
      if (pressed) { if (this.riding) this.dismount(); else this.mount(); }
      return;
    }
    if (held && this.riding && !slot.startsWith('pog:')) this.dismount();
    if (slot === 'yoyo') {
      this.mining = null;
      if (pressed) this.yoyo.use();
      return;
    }
    if (!held || !this.aim) {
      this.mining = null;
      return;
    }
    const { tx, ty } = this.aim;
    if (slot === 'pickaxe') {
      const id = this.tileAt(tx, ty);
      const info = TILE_INFO[id];
      if (!info || id === T.AIR || info.minPick > this.pickaxe || !Number.isFinite(info.hardness)) {
        this.mining = null;
        return;
      }
      const index = ty * this.world.w + tx;
      if (!this.mining || this.mining.index !== index) this.mining = { index, progress: 0 };
      this.mining.progress += dt * PICKAXES[this.pickaxe].speed;
      if (this.mining.progress >= info.hardness) {
        this.mining = null;
        this.breakTile(tx, ty);
      }
    } else if (slot === 'potion') {
      if (pressed) this.drinkPotion();
    } else if ((BREW_IDS as string[]).includes(slot)) {
      if (pressed) this.drinkBrew(slot as BrewId);
    } else if (pressed || this.placeTimer <= 0) {
      if (this.placeTile(tx, ty, slot as ItemId)) this.placeTimer = PLACE_REPEAT_MS;
    }
  }

  private drawAim(): void {
    if (this.homestead?.placing) { this.aimRect.setVisible(false); return; }
    const slot = this.slots[this.slot];
    if (!this.aim || slot === 'potion' || slot === 'yoyo' || slot === 'pogo' || slot.startsWith('pog:') || (BREW_IDS as string[]).includes(slot)) {
      this.aimRect.setVisible(false);
      return;
    }
    const { tx, ty } = this.aim;
    const id = this.tileAt(tx, ty);
    const info = TILE_INFO[id];
    let ok: boolean;
    if (slot === 'pickaxe') ok = !!info && id !== T.AIR && info.minPick <= this.pickaxe && Number.isFinite(info.hardness);
    else ok = id === T.AIR && this.count(slot as ItemId) > 0;
    const progress = this.mining && info ? Math.min(1, this.mining.progress / info.hardness) : 0;
    this.aimRect
      .setPosition(tx * TILE, ty * TILE)
      .setVisible(true)
      .setStrokeStyle(2, ok ? 0xffffff : 0xef4444, ok ? 0.9 : 0.6)
      .setFillStyle(0xfacc15, progress * 0.6);
  }

  private drinkPotion(): void {
    if (this.count('potion') <= 0 || this.hp >= this.maxHp || this.dead) return;
    this.inventory.potion = this.count('potion') - 1;
    this.hp = Math.min(this.maxHp, this.hp + POTION_HEAL);
    this.floatText(this.player.x, this.player.y - 50, `+${POTION_HEAL} HP`, '#4ade80');
  }

  private drinkBrew(brew: BrewId): void {
    if (this.count(brew) <= 0 || this.dead) return;
    this.inventory[brew] = this.count(brew) - 1;
    this.buffs[brew] = BREWS[brew].ms;
    this.floatText(this.player.x, this.player.y - 50, `${ITEM_ICON[brew]} ${ITEM_NAME[brew]}`, '#a7f3d0');
  }

  /** blade tier, plus the Ember Heart's fire and a Strength Tonic */
  private swordDamage(): number {
    const base = (this.weapon?.damage ?? SWORDS[this.sword].damage) + (this.relics.has('ember') ? 4 : 0);
    return Math.round(base * ((this.buffs.tonic ?? 0) > 0 ? 1.5 : 1));
  }

  // ---------------- combat ----------------

  /** attack pressed: swing now, or hold the press for the moment this swing ends */
  private attackPress(): void {
    if (this.dead || !this.ready || !this.combat.ready) return;
    if (this.combat.guarding) this.combat.lowerGuard();
    if (this.swingTimer > 0) { this.combat.buffer = ATTACK_BUFFER_MS; return; }
    this.swing();
  }

  /** keeps the chain moving, and turns a held button into a charged blow */
  private updateAttack(dt: number, held: boolean): void {
    const c = this.combat;
    if (c.buffer > 0 && this.swingTimer <= 0 && c.ready && !c.guarding) { c.buffer = 0; this.swing(); }
    if (held && c.ready && !c.guarding && this.swingTimer <= 0 && !this.riding) {
      c.held += dt;
      if (c.held >= CHARGE_COMMIT_MS && c.stamina > 0) {
        const before = c.charged;
        c.charge += dt;
        const pulse = c.charged ? (Math.floor(this.time.now / 90) % 2 ? 0xfde047 : 0xffffff) : 0xfed7aa;
        this.player.setTint(pulse);
        if (!before && c.charged) { this.spark(this.player.x, this.player.y - 24, 0xfde047, 10); this.floatText(this.player.x, this.player.y - 58, 'READY', '#fde047'); }
      }
      return;
    }
    if (!held) {
      if (c.charge > 0) {
        this.player.clearTint();
        if (c.charged && this.swingTimer <= 0) this.swing(HEAVY);
      }
      c.charge = 0;
      c.held = 0;
    }
  }

  /** one blow: a step in the light chain, or the charged heavy when `def` is given */
  private swing(def?: SwingDef): void {
    if (this.swingTimer > 0 || this.dead || !this.ready) return;
    const c = this.combat;
    const heavy = !!def;
    const blow = def ?? c.nextSwing();
    this.swingTimer = blow.lock * (c.exhausted ? EXHAUSTED_LOCK_SCALE : 1);
    c.spend(heavy ? HEAVY_COST : LIGHT_COST);
    this.softLock(blow.range);
    const dir = this.facing;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (body.blocked.down && !this.riding) this.dash = { vx: dir * blow.lunge, ms: 90 };

    // what you see is what you hit: the blade and its arc reach exactly as far as the blow does
    const weapon = this.weapon;
    this.swordSprite.setTexture(weapon ? `weapon_${weapon.heroId}` : 'realm_sword');
    this.tweens.killTweensOf(this.swordSprite);
    this.swordSprite.setPosition(this.player.x + dir * 6, this.player.y - 20).setFlipX(dir < 0).setVisible(true)
      .setAngle(dir * blow.from).setScale((blow.range - 6) / 32);
    this.tweens.add({
      targets: this.swordSprite,
      angle: dir * blow.to,
      duration: Math.min(190, blow.lock * 0.6),
      onComplete: () => this.swordSprite.setVisible(false),
    });
    const scale = blow.range / 42;
    const slash = this.add.image(this.player.x + dir * (blow.range - 10 * scale), this.player.y - 24, 'fx_slash').setDepth(11).setFlipX(dir < 0)
      .setTint(weapon ? this.hero.character.color : heavy ? 0xfde047 : 0xfff4d6).setAlpha(0.9).setScale(scale * 0.9);
    this.tweens.add({ targets: slash, scale, alpha: 0, duration: 180, onComplete: () => slash.destroy() });
    this.swingCount++;

    const passive = weapon?.passive;
    const guardBonus = passive === 'fullGuardBonus' && this.hero.stats.guardPips > 0 && this.hero.guard >= this.hero.stats.guardPips ? 1.3 : 1;
    const perfect = c.perfectBonus > 0 ? PERFECT_BONUS : 1;
    const { damage, crit } = this.hero.strike(this.swordDamage() * blow.damage * guardBonus * perfect, passive === 'thirdCrit' && (this.hitCount + 1) % 3 === 0);
    // one box, mirrored by the facing: from just behind the hero to the blade's tip
    const inReach = (b: Phaser.Physics.Arcade.Body) => {
      const ahead = (b.center.x - this.player.x) * dir;
      return ahead >= -18 - b.width / 2 && ahead <= blow.range + b.width / 2 && Math.abs(b.center.y - (this.player.y - 22)) <= 40 + b.height / 2;
    };
    let landed = false;
    for (const e of [...this.enemies]) {
      if (!inReach(e.sprite.body as Phaser.Physics.Arcade.Body)) continue;
      const scaled = this.openingScale(e.sprite, e.stagger > 0, e.riposte);
      if (e.riposte) e.riposte = false;
      this.hurtEnemy(e, Math.round(damage * scaled), dir, crit || scaled >= RIPOSTE_DAMAGE, blow.poise);
      landed = true;
    }
    const boss = this.boss;
    if (boss && inReach(boss.sprite.body as Phaser.Physics.Arcade.Body)) {
      const scaled = this.openingScale(boss.sprite, (boss.data.stagger ?? 0) > 0, false);
      if (this.damageBoss(Math.round(damage * scaled), crit) > 0) { landed = true; this.breakBossPoise(boss, blow.poise); }
    }
    if (landed) {
      this.hero.hitLanded();
      this.hitCount++;
      c.perfectBonus = 0;
      this.warpTime(blow.stop, 8);
      this.cameras.main.shake(heavy ? 110 : 50, heavy ? 0.007 : crit ? 0.004 : 0.0015);
    }
    if (passive) this.weaponEffect(passive, damage, crit, landed);
  }

  /** with no direction held, the blow turns to meet the nearest thing in reach (the soft lock-on) */
  private softLock(range: number): void {
    const held = this.touch.left || this.touch.right || this.keys?.a.isDown || this.keys?.d.isDown || mergePads(readPads(this.time.now)).held.left || mergePads(readPads(this.time.now)).held.right;
    if (held) return;
    let best = Infinity;
    let dir = 0;
    const consider = (s: Phaser.Physics.Arcade.Sprite) => {
      const dx = s.x - this.player.x;
      const d = Math.abs(dx) - (s.body as Phaser.Physics.Arcade.Body).width / 2;
      if (d <= range + 16 && Math.abs(s.y - this.player.y) < 70 && d < best) { best = d; dir = dx < 0 ? -1 : 1; }
    };
    for (const e of this.enemies) consider(e.sprite);
    if (this.boss) consider(this.boss.sprite);
    if (dir) { this.facing = dir as 1 | -1; this.player.setFlipX(dir < 0); }
  }

  /** what the moment is worth: a riposte, a staggered target, or one that's looking the other way */
  private openingScale(s: Phaser.Physics.Arcade.Sprite, staggered: boolean, riposte: boolean): number {
    if (riposte) { this.floatText(s.x, s.y - 74, 'RIPOSTE', '#fde047'); return RIPOSTE_DAMAGE; }
    if (staggered) return STAGGER_DAMAGE;
    const looking = s.flipX ? -1 : 1;
    if (Math.sign(this.player.x - s.x) === -looking) { this.floatText(s.x, s.y - 74, 'BACKSTAB', '#fca5a5'); return BACKSTAB_DAMAGE; }
    return 1;
  }

  /** the whole world holds (a hit landing) or slows (a perfect dodge) for a moment */
  private warpTime(ms: number, scale: number): void {
    if (ms <= 0) return;
    this.timeWarp = { ms, scale };
    this.physics.world.timeScale = scale;
  }

  private updateTimeWarp(dt: number): void {
    if (this.timeWarp.ms <= 0) return;
    this.timeWarp.ms -= dt;
    if (this.timeWarp.ms <= 0) this.physics.world.timeScale = 1;
  }

  /** dodge and guard: read the inputs, then draw the guard */
  private updateDefence(dt: number, s: { left: boolean; right: boolean; grounded: boolean; inWater: boolean; guardHeld: boolean; dodgeKey: boolean }): void {
    const c = this.combat;
    const now = this.time.now;
    if (s.grounded) c.airDodged = false;
    let tap = false;
    let dir: 1 | -1 = this.facing;
    if (s.left && !this.wasLeft) { dir = -1; tap = c.tapped(-1, now); }
    if (s.right && !this.wasRight) { dir = 1; tap = c.tapped(1, now) || tap; }
    this.wasLeft = s.left;
    this.wasRight = s.right;
    if (s.dodgeKey) { tap = true; dir = s.left ? -1 : s.right ? 1 : this.facing; }
    if (tap && !s.inWater && !this.riding && c.canDodge(s.grounded)) this.dodge(dir, s.grounded);

    if (s.guardHeld && !this.wasGuard && c.ready && !this.riding && this.dash.ms <= 0) c.raiseGuard();
    if (!s.guardHeld && c.guarding) c.lowerGuard();
    this.wasGuard = s.guardHeld;
    if (c.guarding && this.swingTimer > 0 && this.swingTimer > 200) c.lowerGuard();

    if (!this.guardFx) this.guardFx = this.add.image(0, 0, 'fx_slash').setDepth(11);
    this.guardFx.setVisible(c.guarding).setFlipX(this.facing < 0);
    if (c.guarding) {
      this.guardFx.setPosition(this.player.x + this.facing * 4, this.player.y - 24).setScale(0.75, 0.9)
        .setTint(c.parryTimer > 0 ? 0xfde047 : 0x93c5fd).setAlpha(c.parryTimer > 0 ? 1 : 0.6);
    }
    void dt;
  }

  /** a quick roll: you can't be hit, and it cuts short a swing's recovery */
  private dodge(dir: 1 | -1, grounded: boolean): void {
    const c = this.combat;
    c.dodged(grounded);
    this.facing = dir;
    this.swingTimer = 0;
    this.player.clearTint();
    this.dash = { vx: dir * DODGE_SPEED, ms: DODGE_MS };
    this.invuln = Math.max(this.invuln, 270);
    const texture = this.player.texture.key;
    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(i * 55, () => {
        if (!this.player?.active) return;
        const ghost = this.add.image(this.player.x, this.player.y, texture).setOrigin(0.5, 1).setDepth(9).setFlipX(dir < 0).setAlpha(0.45).setTint(this.hero.character.color);
        this.tweens.add({ targets: ghost, alpha: 0, duration: 220, onComplete: () => ghost.destroy() });
      });
    }
  }

  /** take poise off an enemy; when it's gone, it reels */
  private staggerEnemy(e: RealmEnemy, ms: number, riposte = false): void {
    e.stagger = ms;
    e.riposte = riposte;
    e.phase = 'none';
    e.poise = POISE[e.def.id] ?? 20;
    e.sprite.setTint(riposte ? 0xfde047 : 0xfca5a5);
    (e.sprite.body as Phaser.Physics.Arcade.Body).setVelocityX(0);
    this.floatText(e.sprite.x, e.sprite.y - 60, riposte ? 'OPEN!' : 'STAGGER', '#fde047');
  }

  private breakBossPoise(b: BossState, amount: number): void {
    const max = b.def.hp * BOSS_POISE_PER_HP;
    b.data.poise = (b.data.poise ?? max) - amount;
    b.data.poiseTimer = POISE_REGEN_DELAY_MS;
    if (b.data.poise > 0 || b.hp <= 0) return;
    b.data.poise = max;
    b.data.stagger = BOSS_STAGGER_MS;
    this.floatText(b.sprite.x, b.sprite.y - 90, 'STAGGER', '#fde047');
    this.warpTime(120, 4);
    this.spark(b.sprite.x, b.sprite.y - 30, 0xfde047, 14);
  }

  /** a parried shot goes back the way it came, harder */
  private reflect(h: Hazard): void {
    const damage = h.damage * 2.5;
    const texture = h.sprite.texture.key;
    this.removeHazard(h);
    this.fireBolt(texture, damage, 2, 560);
  }

  /** the hero's ultimate weapon, if they've forged it */
  private get weapon(): UltimateWeapon | undefined {
    const id = this.hero?.character.id;
    return id && this.forged.includes(id) ? WEAPONS[id] : undefined;
  }

  /** what makes each ultimate weapon that hero's own (see weapons.ts) */
  private weaponEffect(passive: UltimateWeapon['passive'], damage: number, crit: boolean, landed: boolean): void {
    switch (passive) {
      case 'comboBurst':
        if (landed && this.hero.combo >= 5 && this.burstCooldown <= 0) { this.burstCooldown = 700; this.shockwave(damage * 0.4, 0x22c55e, false); }
        break;
      case 'everyFourthQuake':
        if (this.swingCount % 4 === 0) this.shockwave(damage * 0.8, 0xd9432f);
        break;
      case 'critFlame':
        if (crit) this.fireBolt('fx_flame', damage, 2, 620);
        break;
      case 'lightBolt':
        this.fireBolt('fx_bolt', damage * 0.35, 1, 680);
        break;
      case 'lifeSteal':
        if (landed) { this.hp = Math.min(this.maxHp, this.hp + 3); this.floatText(this.player.x, this.player.y - 56, '+3', '#f472b6'); }
        break;
      // thirdCrit and fullGuardBonus change the strike itself; doubleLoot pays out in killEnemy
      default:
    }
  }

  /** a shot straight ahead; already a finished number, so it doesn't roll combos again */
  private fireBolt(texture: string, damage: number, pierce: number, speed: number): void {
    const dir = this.facing;
    const sprite = this.physics.add.sprite(this.player.x + dir * 16, this.player.y - 24, texture).setDepth(12).setFlipX(dir < 0);
    (sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setVelocity(dir * speed, 0);
    const p: Projectile = { sprite, damage: Math.round(damage), pierce, hit: new Set() };
    this.projectiles.push(p);
    this.time.delayedCall(800, () => this.removeProjectile(p));
  }

  /** forge step of the weapon quest: spends the materials and it's in hand at once */
  private forgeWeapon(): boolean {
    const id = this.hero.character.id;
    if (weaponStage(id, this.sigils, this.forged, this.inventory) !== 'forge') return false;
    const w = WEAPONS[id];
    for (const [m, n] of Object.entries(w.materials)) this.inventory[m as ItemId] = this.count(m as ItemId) - (n ?? 0);
    this.forged.push(id);
    this.stats.crafted += 1;
    this.banner(`🔥 ${w.name.toUpperCase()}`, w.power);
    this.spark(this.player.x, this.player.y - 24, this.hero.character.color, 18);
    this.updateHud();
    void this.save();
    return true;
  }

  /** Story Mode, chapter six: Ms. Clio opens the trophy case, and the gate follows the relics */
  private lendRelics(): void {
    for (const id of POCKET_ORDER) this.relics.add(id);
    this.hp = this.maxHp;
    if (this.pocket) return;
    this.openGateIfWorthy();
    const gate = this.world.foreverGate;
    if (gate) for (let dx = 0; dx < GATE_W; dx++) for (let dy = 0; dy < GATE_H; dy++) {
      if (this.tileAt(gate.tx + dx, gate.ty + dy) === T.ETERNAL) this.layer.putTileAt(T.ETERNAL, gate.tx + dx, gate.ty + dy);
    }
    for (const o of this.portalLabels) o.destroy();
    this.portalLabels = [];
    this.buildPortalLabels();
  }

  private speaker(who: Speaker): { name: string; face?: string; color: number } {
    const c = this.hero.character;
    switch (who) {
      case 'clio': return { name: 'Ms. Clio', face: 'npc_clio', color: 0xc4b5fd };
      case 'hero': return { name: c.name, face: `realm_hero_${c.id}`, color: c.color };
      case 'nemesis': return { name: nemesisFor(c.id).name, face: `boss_nem_${c.id}`, color: 0xfca5a5 };
      case 'reaper': return { name: 'The Eternal Reaper', face: 'boss_reaper', color: 0xfde68a };
      default: return { name: '', color: 0x8b80a8 };
    }
  }

  private anyMenuOpen(): boolean {
    return !!(this.dialogue?.open || this.craftPanel?.visible || this.homestead?.open || this.expedition?.open || this.heroMenu?.open
      || this.duel?.open || this.dashTrials?.open || this.arena?.open || this.rifts?.open);
  }

  // ---------------- help and looks ----------------

  /** the nearest thing worth harvesting, and a small bubble saying exactly how */
  private updateHarvestHelp(dt: number): void {
    this.harvestTimer -= dt;
    if (this.harvestTimer > 0) return;
    this.harvestTimer = 180;
    const px = this.player.x;
    const py = this.player.y - 20;
    const r = Math.ceil(REACH_PX / TILE);
    const cx = Math.floor(px / TILE);
    const cy = Math.floor(py / TILE);
    let best: { tx: number; ty: number; id: number; d: number } | null = null;
    for (let ty = cy - r; ty <= cy + r; ty++) for (let tx = cx - r; tx <= cx + r; tx++) {
      const id = this.tileAt(tx, ty);
      if (!HARVESTABLE[id] || this.homestead?.protects(tx, ty, true)) continue;
      const d = Math.hypot((tx + 0.5) * TILE - px, (ty + 0.5) * TILE - py);
      if (d <= REACH_PX && (!best || d < best.d)) best = { tx, ty, id, d };
    }
    const info = best ? TILE_INFO[best.id] : undefined;
    this.harvestTile = best && info && info.minPick <= this.pickaxe ? { tx: best.tx, ty: best.ty } : null;
    const weak = !!(best && info && info.minPick > this.pickaxe);
    const kind = best ? HARVESTABLE[best.id] : undefined;
    // a few short showings in the whole game: each thing is explained once, for a few seconds
    const key = kind ? `help:${weak ? 'weak:' : ''}${kind.kind}` : '';
    const now = this.time.now;
    const live = !!key && this.bubbleKey === key && now < this.bubbleUntil;
    let show = live;
    if (!live && key && !this.harvested[key] && now >= this.bubbleUntil) {
      const shown = Object.keys(this.harvested).filter((k) => k.startsWith('help:') && !k.startsWith('help:weak:')).length;
      if (weak || shown < HELP_SHOWINGS) {
        this.harvested[key] = 1;
        this.bubbleKey = key;
        this.bubbleUntil = now + HELP_SHOW_MS;
        show = true;
      }
    }
    if (!this.bubble) {
      this.bubble = this.add.text(0, 0, '', { fontSize: '12px', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', color: '#1c0d30', backgroundColor: '#fef3c7', padding: { x: 7, y: 4 }, align: 'center' })
        .setOrigin(0.5, 1).setDepth(44).setVisible(false).setInteractive({ useHandCursor: true });
      // tapping the bubble does the first step for you
      this.bubble.on('pointerdown', () => { this.slot = Math.max(0, this.slots.indexOf('pickaxe')); });
      this.bubbleTail = this.add.triangle(0, 0, 0, 0, 12, 0, 6, 7, 0xfef3c7).setOrigin(0.5, 0).setDepth(44).setVisible(false);
      this.bubbleMark = this.add.rectangle(0, 0, TILE, TILE).setOrigin(0).setStrokeStyle(2, 0xfef3c7, 0.9).setDepth(19).setVisible(false);
      this.tweens.add({ targets: this.bubbleMark, alpha: 0.35, duration: 500, yoyo: true, repeat: -1 });
    }
    this.bubble.setVisible(show);
    this.bubbleTail!.setVisible(show);
    this.bubbleMark!.setVisible(show);
    if (!show || !best || !kind) return;
    const holding = this.slots[this.slot] === 'pickaxe';
    const how = weak ? `needs a ${PICKAXES[info!.minPick].name} · ⚒ CRAFT`
      : !holding ? hint('pick ⛏ on the hotbar', 'tap here to pick ⛏')
      : hint('hold K, or hold click on it', 'hold the ⛏ button');
    const x = (best.tx + 0.5) * TILE;
    const y = best.ty * TILE - 10;
    this.bubble.setText(`${kind.label}\n${how}`).setPosition(x, y);
    this.bubbleTail!.setPosition(x - 6, y);
    this.bubbleMark!.setPosition(best.tx * TILE, best.ty * TILE);
  }

  /** a few fading points of light */
  private spark(x: number, y: number, color: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const s = this.add.image(x, y, 'fx_spark').setTint(color).setDepth(13).setBlendMode(Phaser.BlendModes.ADD);
      const a = Math.random() * Math.PI * 2;
      const d = 12 + Math.random() * 26;
      this.tweens.add({ targets: s, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, scale: 0.3, duration: 240 + Math.random() * 200, onComplete: () => s.destroy() });
    }
  }

  /** what's behind the world: hills and the school in the overworld, tinted hills in a realm, a corridor in detention */
  private buildBackdrop(): void {
    const { w, h } = this.world;
    this.add.image(0, 0, 'skyfade').setOrigin(0).setDisplaySize(RW, RH).setScrollFactor(0).setDepth(-4);
    this.add.image(0, 0, 'vignette').setOrigin(0).setDisplaySize(RW, RH).setScrollFactor(0).setDepth(49);
    if (this.pocket === 'detention') {
      const g = this.add.graphics().setDepth(-1);
      g.fillStyle(0x221a33, 1).fillRect(0, 0, w * TILE, h * TILE);
      const floor = this.pocketWorld!.arena.floorY * TILE;
      g.fillStyle(0x2f2542, 1).fillRect(0, floor - 60, w * TILE, 60);
      g.fillStyle(0xfacc15, 0.5).fillRect(0, floor - 62, w * TILE, 2);
      const a = this.pocketWorld!.arena;
      const cx = ((a.x0 + a.x1) / 2) * TILE;
      g.fillStyle(0x4b3621, 1).fillRect(cx - 214, floor - 244, 428, 134);
      g.fillStyle(0x16321f, 1).fillRect(cx - 206, floor - 236, 412, 118);
      this.add.text(cx, floor - 177, Array(5).fill('I will not question the timetable.').join('\n'), { fontSize: '16px', fontFamily: 'Georgia, serif', color: '#e7f0e0', align: 'center', lineSpacing: 2 })
        .setOrigin(0.5).setAlpha(0.8).setDepth(-0.8);
    } else if (this.pocket !== 'foundry' && this.pocket !== 'arena') {
      const sky = this.pocket ? POCKETS[this.pocket].sky : 0;
      const tint = (mix: number) => lerpColor(sky, 0xffffff, mix);
      const layer = (key: string, rate: number, depth: number, day: number, night: number) => {
        const sprite = this.add.tileSprite(0, 0, RW, 512, key).setOrigin(0).setScrollFactor(0).setDepth(depth);
        this.backdrop.push({ sprite, rate, day, night });
      };
      if (!this.pocket) {
        this.stars = this.add.tileSprite(0, 0, RW, 300, 'bg_stars').setOrigin(0).setScrollFactor(0).setDepth(-3.5).setAlpha(0);
        layer('bg_far', 0.15, -3, 0x6a7fa8, 0x171330);
        layer('bg_school', 0.32, -2, 0x46557f, 0x0f0c20);
      } else {
        layer('bg_far', 0.15, -3, tint(0.1), tint(0.1));
        layer('bg_far', 0.3, -2, tint(0.04), tint(0.04));
      }
    }
    // a little life in the air: fireflies at home, embers, bubbles, snow-white motes elsewhere
    const moteColor: Partial<Record<PocketId, number>> = { ember: 0xfb923c, tide: 0xbae6fd, gale: 0xffffff, grave: 0xa78bfa, forever: 0xfde68a, foundry: 0xfbbf24, detention: 0xfef3c7 };
    const rising = this.pocket === 'ember' || this.pocket === 'tide' || this.pocket === 'forever';
    for (let i = 0; i < 16; i++) {
      const o = this.add.image(Math.random() * RW, Math.random() * RH, 'fx_spark').setScrollFactor(0).setDepth(40)
        .setTint(this.pocket ? moteColor[this.pocket] ?? 0xffffff : 0xd9f99d).setBlendMode(Phaser.BlendModes.ADD).setScale(0.4 + Math.random() * 0.5).setAlpha(0.5);
      this.motes.push({ o, vx: (Math.random() - 0.5) * 16, vy: (rising ? -1 : 0.35) * (6 + Math.random() * 14), phase: Math.random() * 6 });
    }
  }

  private updateBackdrop(dt: number): void {
    const cam = this.cameras.main;
    const anchor = this.world.surface[this.world.spawn.tx] * TILE - cam.scrollY;
    const night = this.pocket ? 0 : nightFactor(this.clock);
    for (const b of this.backdrop) {
      b.sprite.tilePositionX = cam.scrollX * b.rate;
      b.sprite.y = RH / 2 + (anchor - RH / 2) * b.rate - 300;
      b.sprite.setTint(lerpColor(b.day, b.night, night));
    }
    if (this.stars) {
      this.stars.tilePositionX = cam.scrollX * 0.04;
      this.stars.setAlpha(night);
    }
    const secs = dt / 1000;
    // fireflies only come out at night, and only where the sky is
    const fade = this.pocket ? 0.55 : night * 0.8;
    for (const m of this.motes) {
      m.phase += secs;
      m.o.x += (m.vx + Math.sin(m.phase * 1.3) * 10) * secs;
      m.o.y += m.vy * secs;
      if (m.o.y < -8) m.o.y = RH + 8;
      if (m.o.y > RH + 8) m.o.y = -8;
      if (m.o.x < -8) m.o.x = RW + 8;
      if (m.o.x > RW + 8) m.o.x = -8;
      m.o.setAlpha(fade * (0.4 + 0.6 * Math.abs(Math.sin(m.phase))));
    }
  }

  /** any blow on the boss (sword, pog, shockwave): armor, numbers, flash, defeat */
  private damageBoss(damage: number, crit = false): number {
    const boss = this.boss;
    if (!boss) return 0;
    const dealt = hitBoss(boss, damage, this.player.x);
    if (dealt === 0) {
      this.floatText(boss.sprite.x, boss.sprite.y - 60, 'BLOCKED', '#94a3b8');
    } else {
      this.floatText(boss.sprite.x, boss.sprite.y - 60, crit ? `${dealt}!` : `${dealt}`, crit ? '#fde047' : '#fca5a5');
      this.spark(boss.sprite.x, boss.sprite.y - 20, crit ? 0xfde047 : 0xfca5a5, crit ? 8 : 4);
      boss.sprite.setTint(0xff5c5c);
      this.time.delayedCall(90, () => { if (boss.sprite.active) boss.sprite.clearTint(); });
      if (boss.hp <= 0) this.defeatBoss();
    }
    return dealt;
  }

  private hurtEnemy(e: RealmEnemy, damage: number, dir: number, crit = false, poise = 8): void {
    e.hp -= damage;
    const body = e.sprite.body as Phaser.Physics.Arcade.Body;
    e.poise -= poise;
    e.poiseTimer = POISE_REGEN_DELAY_MS;
    // poise holds through a blow: the small get knocked about, the big only when it breaks
    const sturdy = (POISE[e.def.id] ?? 20) >= 24;
    if (e.poise <= 0 || (e.phase === 'none' && !sturdy)) body.setVelocity(dir * 230, -200);
    if (e.hp > 0 && e.poise <= 0) this.staggerEnemy(e, STAGGER_MS);
    if (!sturdy) e.timer = Math.max(e.timer, 350); // flinch
    e.sprite.setTint(0xff5c5c); // hit flash
    this.time.delayedCall(90, () => { if (e.sprite.active) e.sprite.clearTint(); });
    this.floatText(e.sprite.x, e.sprite.y - 24, crit ? `${damage}!` : `${damage}`, crit ? '#fde047' : '#fca5a5');
    this.spark(e.sprite.x, e.sprite.y - 10, crit ? 0xfde047 : 0xfca5a5, crit ? 6 : 3);
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: RealmEnemy): void {
    this.enemies = this.enemies.filter((x) => x !== e);
    this.stats.slain += 1;
    for (const c of e.colliders) c.destroy();
    const drops = this.hero.lootRoll(1 + Math.floor(Math.random() * e.def.dropMax)) * (this.weapon?.passive === 'doubleLoot' ? 2 : 1);
    this.spark(e.sprite.x, e.sprite.y - 14, 0xfff4d6, 10);
    this.addItem(e.def.drop, drops, { x: e.sprite.x, y: e.sprite.y - 30 });
    this.arena?.onKill(e.def);
    const xp = this.hero.gainXp(killXp(e.def.hp, e.def.damage), true);
    this.floatText(e.sprite.x, e.sprite.y - 46, `+${xp} XP`, '#c4b5fd');
    (e.sprite.body as Phaser.Physics.Arcade.Body).enable = false;
    this.tweens.add({ targets: e.sprite, alpha: 0, scaleY: 0.2, duration: 200, onComplete: () => e.sprite.destroy() });
  }

  /** the blow never lands: the attacker reels, a shot goes back, and you get stamina for it */
  private parry(src: BlowSource): void {
    const c = this.combat;
    c.parried();
    this.invuln = 300;
    this.floatText(this.player.x, this.player.y - 60, 'PARRY', '#fde047');
    this.spark(this.player.x + this.facing * 18, this.player.y - 26, 0xfde047, 14);
    this.cameras.main.flash(90, 253, 224, 71);
    this.warpTime(140, 8);
    for (const p of readPads(this.time.now)) rumble(p.index, 120, 0.7);
    if (src.enemy) this.staggerEnemy(src.enemy, PARRY_STAGGER_MS, true);
    if (src.boss) this.breakBossPoise(src.boss, src.boss.def.hp * BOSS_POISE_PER_HP * PARRY_BOSS_POISE);
    if (src.hazard) this.reflect(src.hazard);
  }

  /** every blow comes through here. No `src` means the world (lava, traps): those can't be parried or blocked */
  private hurtPlayer(damage: number, fromX: number, src?: BlowSource): void {
    if (this.dead) return;
    if (this.invuln > 0) {
      if (src && this.combat.perfectDodge()) {
        this.floatText(this.player.x, this.player.y - 60, 'PERFECT DODGE', '#67e8f9');
        this.warpTime(320, 3);
        this.spark(this.player.x, this.player.y - 24, 0x67e8f9, 10);
      }
      return;
    }
    const c = this.combat;
    const facingIt = Math.abs(fromX - this.player.x) < 10 || Math.sign(fromX - this.player.x) === this.facing;
    if (src && c.guarding && facingIt) {
      if (c.parryTimer > 0) { this.parry(src); return; }
      const { taken, broke } = c.blocked(damage);
      this.invuln = 260;
      this.spark(this.player.x + this.facing * 16, this.player.y - 26, 0x93c5fd, broke ? 12 : 5);
      (this.player.body as Phaser.Physics.Arcade.Body).setVelocityX((this.player.x < fromX ? -1 : 1) * (broke ? 240 : 120));
      this.hp -= taken;
      this.sinceHit = 0;
      this.floatText(this.player.x, this.player.y - 54, broke ? 'GUARD BROKEN' : 'BLOCK', broke ? '#ef4444' : '#93c5fd');
      if (this.hp <= 0) this.die();
      return;
    }
    c.interrupted();
    this.player.clearTint();
    if (this.hero.absorb()) {
      this.invuln = HIT_INVULN_MS * this.hero.stats.invulnMult;
      (this.player.body as Phaser.Physics.Arcade.Body).setVelocity((this.player.x < fromX ? -1 : 1) * 140, -120);
      return;
    }
    this.hero.hurt();
    this.dashTrials?.hurt();
    this.hp -= damage * (this.riding ? 1.25 : 1);
    this.invuln = HIT_INVULN_MS * this.hero.stats.invulnMult;
    this.sinceHit = 0;
    const away = this.player.x < fromX ? -1 : 1;
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(away * 260, -220);
    this.cameras.main.flash(120, 180, 20, 40);
    for (const p of readPads(this.time.now)) rumble(p.index, 150, 0.6);
    if (this.hp <= 0) this.die();
  }

  private die(): void {
    if (this.hero.tryRevive()) {
      this.hp = Math.ceil(this.maxHp / 2);
      this.invuln = 2000;
      this.cameras.main.flash(300, 253, 230, 138);
      this.banner('BACK ON YOUR FEET', `a revive spent · ${this.hero.revivesLeft} left until you sleep`);
      return;
    }
    const lost = this.hero.onDeath();
    this.dashTrials?.fail('you fell');
    this.arena?.onDeath();
    this.dismount();
    this.homestead?.cancelPlacement();
    this.dead = true;
    this.stats.deaths += 1;
    this.deathTimer = RESPAWN_MS;
    this.player.setVisible(false);
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0).enable = false;
    this.aimRect.setVisible(false);
    music.play('loss');
    const penalty = lost ? `\n${lost} unbanked XP lost` : '';
    this.deathText = this.add.text(RW / 2, RH / 2, (this.pocket ? `YOU FELL\nthe ${POCKETS[this.pocket].name} casts you back to its gate…` : 'YOU FELL\nthe Forever Realm does not let you go…') + penalty, {
      fontSize: '26px', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', color: '#e11d48', align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(70);
  }

  private respawn(): void {
    this.dead = false;
    this.hp = this.maxHp;
    this.breath = BREATH_MAX;
    // dying in a realm sends you back to its entrance and resets any boss fight
    if (this.boss) this.endBossFight(false);
    for (const h of [...this.hazards]) this.removeHazard(h);
    this.invuln = 1500;
    this.deathText?.destroy();
    this.deathText = undefined;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.reset(this.spawnPoint.x, this.spawnPoint.y);
    this.player.setVisible(true);
    for (const e of this.enemies) if (Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, this.player.x, this.player.y) < 500) this.despawn(e);
  }

  // ---------------- pog abilities ----------------

  /** a slammer thrown at the aim point (or straight ahead): pierces three creatures, one hit on a boss */
  private throwPog(damage: number): void {
    const from = { x: this.player.x + this.facing * 12, y: this.player.y - 26 };
    const target = this.aim ? { x: (this.aim.tx + 0.5) * TILE, y: (this.aim.ty + 0.5) * TILE } : { x: from.x + this.facing * 100, y: from.y };
    const angle = Math.hypot(target.x - from.x, target.y - from.y) < 24 ? (this.facing > 0 ? 0 : Math.PI) : Math.atan2(target.y - from.y, target.x - from.x);
    const sprite = this.physics.add.sprite(from.x, from.y, 'fx_pog').setDepth(12);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false).setVelocity(Math.cos(angle) * 560, Math.sin(angle) * 560).setAngularVelocity(1080);
    const p: Projectile = { sprite, damage: this.hero.strike(damage).damage, pierce: 3, hit: new Set() };
    this.projectiles.push(p);
    this.time.delayedCall(900, () => this.removeProjectile(p));
  }

  private removeProjectile(p: Projectile): void {
    this.projectiles = this.projectiles.filter((q) => q !== p);
    if (p.sprite.active) p.sprite.destroy();
  }

  private updateProjectiles(): void {
    for (const p of [...this.projectiles]) {
      const { x, y } = p.sprite;
      if (!p.sprite.active || isSolid(this.tileAt(Math.floor(x / TILE), Math.floor(y / TILE)))) { this.removeProjectile(p); continue; }
      const dir = (p.sprite.body as Phaser.Physics.Arcade.Body).velocity.x < 0 ? -1 : 1;
      const touching = (b: Phaser.Physics.Arcade.Body) => Math.abs(b.center.x - x) < b.width / 2 + 9 && Math.abs(b.center.y - y) < b.height / 2 + 9;
      for (const e of [...this.enemies]) {
        if (p.pierce <= 0 || p.hit.has(e) || !touching(e.sprite.body as Phaser.Physics.Arcade.Body)) continue;
        p.hit.add(e); p.pierce--;
        this.hurtEnemy(e, p.damage, dir);
        this.hero.hitLanded();
      }
      const boss = this.boss;
      if (boss && p.pierce > 0 && !p.hit.has(boss) && touching(boss.sprite.body as Phaser.Physics.Arcade.Body)) {
        p.hit.add(boss); p.pierce = 0;
        if (this.damageBoss(p.damage) > 0) this.hero.hitLanded();
      }
      if (p.pierce <= 0) this.removeProjectile(p);
    }
  }

  /** airborne: dive and slam on landing; on the ground: slam where you stand */
  private groundPound(damage: number): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (body.blocked.down) { this.shockwave(damage); return; }
    this.pound = damage;
    body.setVelocity(0, 900);
  }

  private updatePound(body: Phaser.Physics.Arcade.Body, grounded: boolean): void {
    if (this.stomp) {
      if (!grounded) this.stomp.airborne = true;
      else if (this.stomp.airborne && body.velocity.y >= 0) { const d = this.stomp.damage; this.stomp = null; this.shockwave(d); }
    }
    if (this.pound === null) return;
    if (grounded || this.isWaterAt(this.player.x, this.player.y - 18)) {
      const damage = this.pound;
      this.pound = null;
      this.shockwave(damage);
    } else body.setVelocity(0, Math.max(body.velocity.y, 700));
  }

  private shockwave(base: number, color = 0xfde68a, shake = true): void {
    const { x, y } = this.player;
    const damage = this.hero.strike(base).damage;
    const ring = this.add.ellipse(x, y - 4, 40, 14, color, 0.7).setDepth(12);
    this.tweens.add({ targets: ring, scaleX: 5.5, scaleY: 2.5, alpha: 0, duration: 320, onComplete: () => ring.destroy() });
    if (shake) {
      this.cameras.main.shake(180, 0.008);
      for (const pad of readPads(this.time.now)) rumble(pad.index, 200, 0.8);
    }
    const inRange = (b: Phaser.Physics.Arcade.Body) => Math.abs(b.center.x - x) < 110 + b.width / 2 && Math.abs(b.center.y - (y - 20)) < 60 + b.height / 2;
    let landed = false;
    for (const e of [...this.enemies]) if (inRange(e.sprite.body as Phaser.Physics.Arcade.Body)) { this.hurtEnemy(e, damage, e.sprite.x < x ? -1 : 1); landed = true; }
    if (this.boss && inRange(this.boss.sprite.body as Phaser.Physics.Arcade.Body) && this.damageBoss(damage) > 0) landed = true;
    if (landed && shake) this.hero.hitLanded();
  }

  /** a freeze pog stops every creature, boss and missile where it is */
  private applyFreeze(): void {
    const frozen = this.hero.frozen;
    const bodies = [...this.enemies.map((e) => e.sprite), ...this.hazards.map((h) => h.sprite), ...(this.boss ? [this.boss.sprite] : [])];
    for (const sprite of bodies) {
      const body = sprite.body as Phaser.Physics.Arcade.Body;
      if (body.moves === !frozen) continue;
      body.moves = !frozen;
      if (frozen) sprite.setTint(0x93c5fd); else sprite.clearTint();
    }
  }

  // ---------------- realm bosses ----------------

  private bossCtx(): BossCtx {
    const pw = this.pocketWorld!;
    return {
      player: this.player,
      arena: {
        x0: pw.arena.x0 * TILE,
        x1: pw.arena.x1 * TILE,
        floorY: pw.arena.floorY * TILE,
        waterTopY: pw.waterTop !== undefined ? pw.waterTop * TILE : undefined,
      },
      hazard: (spec) => this.spawnHazard(spec),
      summon: (id, x, y) => { this.spawnEnemy(REALM_ENEMIES[id], x, y); },
      shake: (ms, intensity) => this.cameras.main.shake(ms, intensity),
      float: (x, y, text, color) => this.floatText(x, y, text, color),
      announce: (title, sub) => this.banner(title, sub),
      darken: (alpha) => { this.darkOverride = alpha; },
    };
  }

  /** stepping into the arena closes the gate behind you and wakes the boss */
  private updateBossFight(dt: number): void {
    const pw = this.pocketWorld;
    if (!pw) return;
    if (this.pocket === 'foundry' && !this.expedition?.readyForBoss) return;
    if (this.pocket === 'arena') return;
    if (!this.boss && !this.bossDefeated && this.player.x > (pw.arena.x0 + 3) * TILE) this.startBossFight();
    const b = this.boss;
    if (!b) return;
    if ((b.data.poiseTimer ?? 0) > 0) { b.data.poiseTimer -= dt; if (b.data.poiseTimer <= 0) b.data.poise = b.def.hp * BOSS_POISE_PER_HP; }
    if ((b.data.stagger ?? 0) > 0) {
      // reeling: nothing but the blows it's about to take
      b.data.stagger -= dt;
      (b.sprite.body as Phaser.Physics.Arcade.Body).setVelocityX(0);
      if (b.def.flies) (b.sprite.body as Phaser.Physics.Arcade.Body).setVelocityY(0);
      b.sprite.setTint(Math.floor(this.time.now / 100) % 2 ? 0xfde047 : 0xffffff);
      if (b.data.stagger <= 0) b.sprite.clearTint();
    } else if (!this.hero.frozen) updateBoss(b, this.bossCtx(), dt);
    const bd = b.sprite.body as Phaser.Physics.Arcade.Body;
    // keep flyers inside the arena box
    b.sprite.x = Phaser.Math.Clamp(b.sprite.x, (pw.arena.x0 + 1) * TILE, (pw.arena.x1 - 1) * TILE);
    if (b.def.flies) b.sprite.y = Phaser.Math.Clamp(b.sprite.y, (pw.arena.floorY - 18) * TILE, (pw.arena.floorY - 1) * TILE);
    if (b.sprite.y > this.world.h * TILE) bd.reset((pw.arena.x0 + pw.arena.x1) / 2 * TILE, (pw.arena.floorY - 2) * TILE);
  }

  private startBossFight(): void {
    const pw = this.pocketWorld!;
    const nemesis = pw.pocket === 'detention' ? nemesisFor(this.hero.character.id) : undefined;
    const def = nemesis ? nemesisBossDef(nemesis.heroId, this.hero.level) : BOSSES[POCKETS[pw.pocket].boss];
    const cx = ((pw.arena.x0 + pw.arena.x1) / 2 + 8) * TILE;
    const y = def.flies ? (pw.arena.floorY - (def.id === 'leviathan' ? 5 : nemesis ? 7 : 12)) * TILE : pw.arena.floorY * TILE;
    const sprite = this.physics.add.sprite(cx, y, def.texture).setOrigin(0.5, def.flies ? 0.5 : 1).setDepth(9);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    if (def.id === 'warden') body.setSize(54, 58).setOffset(9, 18);
    if (def.flies) body.setAllowGravity(false);
    else {
      body.setGravityY(PHYS.gravityY);
      this.physics.add.collider(sprite, this.layer);
    }
    this.physics.add.overlap(this.player, sprite, () => {
      const b = this.boss;
      if (!b || b.sprite !== sprite) return;
      const harmless = b.phase === 'reel' || b.phase === 'tired' || b.phase === 'recover' || b.phase === 'rest' || this.hero.frozen;
      if (this.tryStomp(sprite)) return;
      if (!harmless && !(b.data.stagger > 0)) this.hurtPlayer(def.contactDamage * BOSS_DAMAGE_SCALE, sprite.x, { boss: b });
    });
    this.boss = createBoss(def, sprite);
    // flying bosses fight from above: look higher so they stay clear of the HUD
    if (def.flies && !nemesis) this.cameras.main.setFollowOffset(0, 90);
    // close the arena behind you
    this.gateTiles = [];
    for (let ty = pw.arena.floorY - 1; ty > pw.arena.floorY - 16 && ty > 0; ty--) {
      const tx = pw.arena.x0;
      if (this.tileAt(tx, ty) === T.AIR || this.tileAt(tx, ty) === T.WATER) {
        this.gateTiles.push({ tx, ty });
        this.setTile(tx, ty, T.SHRINE);
      }
    }
    if (nemesis) this.banner(def.name.toUpperCase(), nemesis.taunt);
    else this.banner(def.name.toUpperCase(), POCKETS[pw.pocket].name);
    this.cameras.main.shake(250, 0.006);
  }

  /** victory drops the relic and loot and opens a way home; a loss (death) just resets the arena */
  private endBossFight(victory: boolean): void {
    const b = this.boss;
    if (!b) return;
    this.boss = undefined;
    this.cameras.main.setFollowOffset(0, 0);
    this.darkOverride = null;
    const pw = this.pocketWorld!;
    const refill = pw.pocket === 'tide' ? T.WATER : T.AIR;
    for (const g of this.gateTiles) this.setTile(g.tx, g.ty, pw.waterTop !== undefined && g.ty >= pw.waterTop ? refill : T.AIR);
    this.gateTiles = [];
    for (const h of [...this.hazards]) this.removeHazard(h);
    if (!victory) {
      b.sprite.destroy();
      return;
    }
    (b.sprite.body as Phaser.Physics.Arcade.Body).enable = false;
    this.tweens.add({ targets: b.sprite, alpha: 0, scale: 1.4, duration: 700, onComplete: () => b.sprite.destroy() });
  }

  /** a way home, in the middle of the arena */
  private openWayHome(): void {
    const pw = this.pocketWorld!;
    const tx = Math.floor((pw.arena.x0 + pw.arena.x1) / 2);
    for (let dx = 0; dx < 2; dx++) for (let dy = 1; dy <= 3; dy++) this.setTile(tx + dx, pw.arena.floorY - dy, T.PORTAL);
  }

  /** the first win gives the sigil and the rare half of the weapon; a rematch is just XP */
  private defeatNemesis(): void {
    const id = this.hero.character.id;
    const n = nemesisFor(id);
    const at = { x: this.boss!.sprite.x, y: this.boss!.sprite.y - 40 };
    this.spark(at.x, at.y, this.hero.character.color, 24);
    this.endBossFight(true);
    this.bossDefeated = true;
    this.stats.bosses += 1;
    for (const e of [...this.enemies]) this.killEnemy(e);
    this.hero.gainXp(this.sigils.includes(id) ? 120 : 400);
    void this.hero.bank().then(() => this.save());
    if (!this.sigils.includes(id)) {
      this.sigils.push(id);
      for (const [m, count] of Object.entries(nemesisSpoils(id))) this.addItem(m as ItemId, count ?? 0, at);
      void grantMilestone(`boss:${n.id}`).then((paid) => {
        if (paid) this.time.delayedCall(5200, () => this.banner('+1 TECH POINT', `first victory over ${n.name}`));
      });
    }
    this.banner(`${n.name.toUpperCase()} FALLS`, n.defeat);
    this.bannerText.setFontSize(20);
    this.openWayHome();
    this.hp = this.maxHp;
    for (const p of readPads(this.time.now)) rumble(p.index, 400, 0.8);
    void this.save();
  }

  private defeatBoss(): void {
    const pw = this.pocketWorld!;
    if (pw.pocket === 'detention') { this.defeatNemesis(); return; }
    const def = POCKETS[pw.pocket];
    const at = { x: this.boss!.sprite.x, y: this.boss!.sprite.y - 40 };
    this.endBossFight(true);
    this.bossDefeated = true;
    this.darkOverride = null;
    this.stats.bosses += 1;
    for (const e of [...this.enemies]) this.killEnemy(e);
    // a realm victory banks everything you carried in, plus the boss itself; the first ever pays a Tech Point
    const bossId = def.boss;
    this.hero.gainXp(BOSS_XP[bossId] ?? 200);
    void this.hero.bank().then(() => this.save());
    void grantMilestone(`boss:${bossId}`).then((paid) => {
      if (paid) this.time.delayedCall(5200, () => this.banner('+1 TECH POINT', `first victory over the ${def.bossName}`));
    });
    this.addItem(def.loot.item, def.loot.count, at);
    if (pw.pocket === 'foundry') {
      this.expedition?.victory();
    } else if (pw.pocket === 'forever') {
      this.champion = true;
      if (this.sword < 4) this.sword = 4;
      this.time.delayedCall(1800, () => {
        if (this.story?.data) this.story.runFinale(() => this.showEnding());
        else this.showEnding();
      });
    } else if (pw.pocket !== 'arena') {
      const firstTime = !this.relics.has(pw.pocket);
      this.relics.add(pw.pocket);
      const relic = RELICS[pw.pocket];
      this.banner(`${relic.icon} ${relic.name}`, relic.power);
      if (firstTime && this.relics.size === POCKET_ORDER.length) {
        this.time.delayedCall(3600, () => this.banner('THE FOREVER GATE STIRS…', 'all four relics are yours'));
      }
    }
    this.openWayHome();
    this.hp = this.maxHp;
    for (const p of readPads(this.time.now)) rumble(p.index, 400, 0.8);
    void this.save();
  }

  private spawnHazard(spec: HazardSpec): void {
    const sprite = this.physics.add.sprite(spec.x, spec.y, spec.texture).setDepth(12);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(!!spec.gravity);
    if (spec.gravity) body.setGravityY(spec.gravity);
    body.setVelocity(spec.vx, spec.vy);
    sprite.setFlipX(spec.vx < 0);
    const h: Hazard = { sprite, damage: spec.damage, colliders: [] };
    h.colliders.push(this.physics.add.overlap(this.player, sprite, () => {
      if (this.dead || this.hero.frozen) return;
      const through = this.invuln > 0;
      this.hurtPlayer(h.damage * BOSS_DAMAGE_SCALE, sprite.x, { hazard: h });
      if (!through) this.removeHazard(h);
    }));
    if (spec.solidStops) h.colliders.push(this.physics.add.collider(sprite, this.layer, () => this.removeHazard(h)));
    this.hazards.push(h);
    this.time.delayedCall(spec.lifespanMs, () => this.removeHazard(h));
  }

  private removeHazard(h: Hazard): void {
    if (!this.hazards.includes(h)) return;
    this.hazards = this.hazards.filter((x) => x !== h);
    for (const c of h.colliders) c.destroy();
    if (h.sprite.active) h.sprite.destroy();
  }

  private updateHazards(): void {
    for (const h of [...this.hazards]) if (!h.sprite.active) this.removeHazard(h);
  }

  // ---------------- creatures ----------------

  private trySpawn(): void {
    const depth = this.depthTiles();
    const night = nightFactor(this.clock) > 0.5;
    const pocketDef = this.pocket ? POCKETS[this.pocket] : undefined;
    // no ambient spawns in (or after) a boss arena
    if (pocketDef && (this.boss || this.bossDefeated || this.player.x > (this.pocketWorld!.arena.x0 - 20) * TILE)) return;
    if (this.enemies.length >= (pocketDef ? pocketDef.spawnCap : spawnCap(depth, night))) return;
    const table = pocketDef ? pocketDef.enemies : spawnTable(depth, night);
    const def = REALM_ENEMIES[table[Math.floor(Math.random() * table.length)]];
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = this.player.x + side * (RW / 2 + 60 + Math.random() * 160);
    const tx = Math.floor(x / TILE);
    if (tx < 2 || tx >= this.world.w - 2) return;
    let y: number | null = null;
    if (def.ai === 'swim') {
      const pty = Math.floor(this.player.y / TILE);
      for (let off = 0; off <= 14 && y === null; off++) {
        for (const ty of [pty + off, pty - off]) if (this.tileAt(tx, ty) === T.WATER && this.tileAt(tx, ty - 1) === T.WATER) { y = ty * TILE; break; }
      }
    } else if (def.phasing) {
      y = this.player.y - 60 - Math.random() * 120;
    } else {
      const pty = Math.floor(this.player.y / TILE);
      for (let off = 0; off <= 16 && y === null; off++) {
        for (const ty of [pty - off, pty + off]) {
          const standable = this.tileAt(tx, ty) === T.AIR && this.tileAt(tx, ty - 1) === T.AIR && this.tileAt(tx, ty - 2) === T.AIR && isSolid(this.tileAt(tx, ty + 1));
          if (standable) { y = (ty + 1) * TILE; break; }
        }
      }
    }
    if (y === null) return;
    this.spawnEnemy(def, x, y);
  }

  private spawnEnemy(def: RealmEnemyDef, x: number, y: number): RealmEnemy {
    const floats = def.ai === 'fly' || def.ai === 'swim';
    const sprite = this.physics.add.sprite(x, y, def.texture).setOrigin(0.5, floats ? 0.5 : 1).setDepth(9).setFlipX(x > this.player.x);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    const e: RealmEnemy = { sprite, def, hp: def.hp, timer: 600 + Math.random() * 600, colliders: [], phase: 'none', phaseTimer: 0, cooldown: 500, dir: 1, struck: false, poise: POISE[def.id] ?? 20, poiseTimer: 0, stagger: 0, riposte: false };
    if (floats) body.setAllowGravity(false);
    else body.setGravityY(PHYS.gravityY);
    if (!def.phasing) e.colliders.push(this.physics.add.collider(sprite, this.layer));
    e.colliders.push(this.physics.add.overlap(this.player, sprite, () => {
      if (this.hero.frozen || this.tryStomp(sprite, e)) return;
      // bumping into something is nothing: only its strike hurts, and only once
      if (e.phase !== 'strike' || e.struck) return;
      const through = this.invuln > 0;
      this.hurtPlayer(def.damage, sprite.x, { enemy: e });
      if (!through) e.struck = true;
    }));
    this.enemies.push(e);
    return e;
  }

  private despawn(e: RealmEnemy): void {
    this.enemies = this.enemies.filter((x) => x !== e);
    for (const c of e.colliders) c.destroy();
    e.sprite.destroy();
  }

  private updateEnemies(dt: number): void {
    if (this.hero.frozen) return;
    for (const e of [...this.enemies]) {
      const body = e.sprite.body as Phaser.Physics.Arcade.Body;
      const dx = this.player.x - e.sprite.x;
      const dy = this.player.y - 20 - e.sprite.y;
      if (Math.hypot(dx, dy) > DESPAWN_PX) {
        this.despawn(e);
        continue;
      }
      const dir = dx < 0 ? -1 : 1;
      e.timer -= dt;
      if (this.updateEnemyAttack(e, body, dt, dx, dy, dir)) continue;
      e.sprite.setFlipX(dir < 0);
      const grounded = body.blocked.down || body.touching.down;
      switch (e.def.ai) {
        case 'hop':
          if (grounded) {
            body.setVelocityX(body.velocity.x * 0.8);
            if (e.timer <= 0) {
              body.setVelocity(dir * e.def.speed * 1.6, -330 - Math.random() * 80);
              e.timer = 900 + Math.random() * 700;
            }
          }
          break;
        case 'walk':
          if (e.timer <= 0) body.setVelocityX(dir * e.def.speed);
          if (grounded && (body.blocked.left || body.blocked.right) && e.timer <= 0) {
            body.setVelocityY(-430);
            e.timer = 300;
          }
          break;
        case 'swim': {
          // eels never leave the water: any step that would take them out is cancelled
          if (e.timer > 0) break;
          const d = Math.hypot(dx, dy) || 1;
          const chase = this.isWaterAt(this.player.x, this.player.y - 18);
          let vx = chase ? (dx / d) * e.def.speed : Math.sin(this.time.now / 900 + e.sprite.x) * 50;
          let vy = chase ? (dy / d) * e.def.speed : 0;
          if (!this.isWaterAt(e.sprite.x + Math.sign(vx) * 18, e.sprite.y)) vx = 0;
          if (!this.isWaterAt(e.sprite.x, e.sprite.y + Math.sign(vy) * 14)) vy = 0;
          body.setVelocity(vx, vy);
          if (!this.isWaterAt(e.sprite.x, e.sprite.y)) body.setVelocityY(90); // stranded: sink back in
          break;
        }
        case 'fly': {
          if (e.timer > 0) break; // staggered
          const d = Math.hypot(dx, dy) || 1;
          body.setVelocity((dx / d) * e.def.speed, (dy / d) * e.def.speed + Math.sin(this.clock / 300) * 20);
          break;
        }
      }
      if (e.sprite.y > this.world.h * TILE + 50) this.despawn(e);
    }
  }

  /** a monster's attack: close, warn, strike, recover. Returns true while it's busy with that */
  private updateEnemyAttack(e: RealmEnemy, body: Phaser.Physics.Arcade.Body, dt: number, dx: number, dy: number, dir: number): boolean {
    if (e.poiseTimer > 0) { e.poiseTimer -= dt; if (e.poiseTimer <= 0) e.poise = POISE[e.def.id] ?? 20; }
    const floats = e.def.ai === 'fly' || e.def.ai === 'swim';
    if (e.stagger > 0) {
      e.stagger -= dt;
      body.setVelocityX(0);
      if (floats) body.setVelocityY(0);
      e.sprite.setAngle(Math.sin(e.stagger / 60) * 7);
      if (e.stagger <= 0) { e.riposte = false; e.sprite.setAngle(0); e.sprite.clearTint(); e.cooldown = ATTACK_COOLDOWN_MS; }
      return true;
    }
    if (e.phase === 'none') {
      e.cooldown -= dt;
      const near = floats ? Math.hypot(dx, dy) < STRIKE_RANGE_PX + 20 : Math.abs(dx) < STRIKE_RANGE_PX && Math.abs(dy) < 56;
      // a flinch doesn't stop it starting a swing: only broken poise does
      if (!near || e.cooldown > 0) return false;
      e.phase = 'windup';
      e.phaseTimer = WINDUP_MS;
      if (!this.harvested['tip:combat']) {
        // the first time anything swings at you, once ever
        this.harvested['tip:combat'] = 1;
        this.banner('IT FLASHES BEFORE IT STRIKES', hint('double-tap a direction or Shift to dodge · L / B to guard, tap to parry', 'double-tap ◀ ▶ to dodge · tap 🛡 to parry, hold to block · hold ⚔ for a heavy blow'));
        this.bannerText.setFontSize(18);
      }
      e.dir = dir;
      e.sprite.setFlipX(dir < 0);
    }
    e.phaseTimer -= dt;
    switch (e.phase) {
      case 'windup':
        // it draws back, glowing: that's your cue
        body.setVelocityX(-e.dir * 12);
        if (floats) body.setVelocityY(0);
        e.sprite.setTint(Math.floor(this.time.now / 70) % 2 ? 0xffa94d : 0xffffff);
        if (e.phaseTimer <= 0) {
          e.phase = 'strike';
          e.phaseTimer = STRIKE_MS;
          e.struck = false;
          e.sprite.clearTint();
          const lunge = Math.max(260, e.def.speed * STRIKE_SPEED);
          const d = Math.hypot(dx, dy) || 1;
          if (floats) body.setVelocity((dx / d) * lunge, (dy / d) * lunge);
          else { body.setVelocityX(e.dir * lunge); if (e.def.ai === 'hop') body.setVelocityY(-210); }
        }
        break;
      case 'strike':
        if (e.phaseTimer <= 0) { e.phase = 'recover'; e.phaseTimer = RECOVER_MS; body.setVelocityX(0); if (floats) body.setVelocityY(0); }
        break;
      case 'recover':
        body.setVelocityX(body.velocity.x * 0.8);
        if (floats) body.setVelocity(0, 0);
        if (e.phaseTimer <= 0) { e.phase = 'none'; e.cooldown = ATTACK_COOLDOWN_MS + Math.random() * 500; }
        break;
    }
    return true;
  }

  // ---------------- lighting ----------------

  /** dark by night and underground; torches and soulstone push it back */
  private darknessAlpha(): number {
    if (this.darkOverride !== null) return this.darkOverride;
    if (this.pocket === 'forever') {
      const seg = this.hazardHere();
      return seg ? (seg === 'gale' ? 0.35 : POCKETS[seg].darkness) : POCKETS.forever.darkness;
    }
    if (this.pocket) return POCKETS[this.pocket].darkness;
    const underground = Phaser.Math.Clamp((this.depthTiles() - 3) / 14, 0, 1);
    return Math.max(nightFactor(this.clock) * 0.62, underground * 0.93);
  }

  private updateLighting(dt: number): void {
    const night = this.pocket ? 0 : nightFactor(this.clock);
    // the background is the sky; caves are dark because the darkness layer covers them, not the sky
    this.cameras.main.setBackgroundColor(this.pocket ? POCKETS[this.pocket].sky : lerpColor(0x4b6c9e, 0x0b0714, night));

    const alpha = this.darknessAlpha();
    if (alpha < 0.02) {
      this.darkness.setVisible(false);
      return;
    }
    this.darkness.setVisible(true);
    const cam = this.cameras.main;
    this.lightScanTimer -= dt;
    if (this.lightScanTimer <= 0) {
      this.lightScanTimer = 250;
      this.lightSources = [];
      this.lightSources.push(...(this.homestead?.lights() ?? []));
      const { w } = this.world;
      for (const index of this.torches) {
        const x = (index % w) * TILE + TILE / 2;
        const y = Math.floor(index / w) * TILE + TILE / 2;
        if (x > cam.worldView.x - 200 && x < cam.worldView.right + 200 && y > cam.worldView.y - 200 && y < cam.worldView.bottom + 200) {
          this.lightSources.push({ x, y, r: TILE_INFO[T.TORCH].light! });
        }
      }
      // soulstone glows faintly - a trail of breadcrumbs in the deep
      const x0 = Math.max(0, Math.floor(cam.worldView.x / TILE));
      const x1 = Math.min(w - 1, Math.ceil(cam.worldView.right / TILE));
      const y0 = Math.max(0, Math.floor(cam.worldView.y / TILE));
      const y1 = Math.min(this.world.h - 1, Math.ceil(cam.worldView.bottom / TILE));
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          const id = this.world.tiles[ty * w + tx];
          if (id === T.SOULSTONE) this.lightSources.push({ x: tx * TILE + 8, y: ty * TILE + 8, r: 34 });
          else if (id === T.LAVA || id === T.PORTAL) this.lightSources.push({ x: tx * TILE + 8, y: ty * TILE + 8, r: TILE_INFO[id].light! });
        }
      }
      if (this.lightSources.length > MAX_LIGHTS) {
        const px = this.player.x;
        const py = this.player.y;
        this.lightSources.sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py));
        this.lightSources.length = MAX_LIGHTS;
      }
    }
    const rt = this.darkness;
    rt.clear();
    rt.fill(0x05030a, alpha);
    // sunlight/moonlight reaches everything above the ground line: there the
    // darkness only needs to be as deep as the time of day makes it
    const skyDark = night * 0.62;
    // portal realms have no sun: their darkness is the realm's own
    const skyErase = !this.pocket && alpha > 0 ? 1 - skyDark / alpha : 0;
    if (skyErase > 0.01) {
      const g = this.skyLight.clear();
      const x0 = Math.max(0, Math.floor(cam.worldView.x / TILE));
      const x1 = Math.min(this.world.w - 1, Math.ceil(cam.worldView.right / TILE));
      for (let tx = x0; tx <= x1; tx++) {
        const sx = tx * TILE - cam.worldView.x;
        const groundY = this.world.surface[tx] * TILE - cam.worldView.y;
        if (groundY > 0) g.fillStyle(0xffffff, skyErase).fillRect(sx, 0, TILE, groundY);
        if (groundY > -48) {
          g.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, skyErase, skyErase, 0, 0).fillRect(sx, groundY, TILE, 48);
        }
      }
      rt.erase(g);
    }
    // a stamp keeps its own position and size; rt.erase(object) only keeps the object, so every light would land on the last one
    const erase = (x: number, y: number, r: number) => {
      rt.stamp('lightBrush', undefined, x - cam.worldView.x, y - cam.worldView.y, { scale: (r * 2) / 256, blendMode: Phaser.BlendModes.ERASE });
    };
    if (!this.dead) erase(this.player.x, this.player.y - 20, 150);
    for (const l of this.lightSources) erase(l.x, l.y, l.r);
    rt.render();
  }

  // ---------------- the ending ----------------

  private showEnding(): void {
    const font = 'system-ui, sans-serif';
    const c = this.add.container(0, 0).setScrollFactor(0).setDepth(95);
    this.ending = c;
    const bg = this.add.rectangle(RW / 2, RH / 2, RW, RH, 0x030106, 1).setAlpha(0);
    c.add(bg);
    this.tweens.add({ targets: bg, alpha: 0.94, duration: 1400 });
    const s = this.stats;
    const hours = Math.floor(s.playMs / 3_600_000);
    const minutes = Math.floor((s.playMs % 3_600_000) / 60_000);
    const lines: [string, number, string][] = [
      ['THE ETERNAL REAPER IS UNMADE', 28, '#fde68a'],
      ...(this.story?.data
        ? endingLines(this.hero.character.id, this.story.data.choices.ending).map((line): [string, number, string] => [line, 15, '#e9d5ff'])
        : [['Four relics. One gate. The curse of forever, broken, for now.', 15, '#e9d5ff'], ['The Forever Realm endures, and so do you.', 15, '#e9d5ff']] as [string, number, string][]),
      ['', 10, '#ffffff'],
      [`⛏ ${s.mined} mined   🧱 ${s.placed} placed   ⚒ ${s.crafted} crafted`, 14, '#ffffff'],
      [`⚔ ${s.slain} slain   👑 ${s.bosses} bosses   ✝ ${s.deaths} deaths   ⏳ ${hours}h ${minutes}m`, 14, '#ffffff'],
      ['', 10, '#ffffff'],
      [`✦ ${SWORDS[4].name} (${SWORDS[4].damage}) is yours · Forever Champion ✦`, 16, '#facc15'],
      ['the realms remain; their bosses will fight you again', 12, '#b7aed0'],
      ['', 10, '#ffffff'],
      ['soundtrack: score · 110 points · 50 points · chaose mode max · woned · Loss', 11, '#8b80a8'],
      ['', 16, '#ffffff'],
      ['press A / Space / tap to return home', 14, '#fef08a'],
    ];
    let y = 70;
    lines.forEach(([text, size, color], i) => {
      const t = this.add.text(RW / 2, y, text, { fontSize: `${size}px`, fontFamily: font, fontStyle: i === 0 ? 'bold' : 'normal', color, align: 'center' })
        .setOrigin(0.5, 0).setAlpha(0);
      c.add(t);
      this.tweens.add({ targets: t, alpha: 1, delay: 1400 + i * 450, duration: 700 });
      y += size + 14;
    });
    this.time.delayedCall(1400 + lines.length * 450, () => { this.endingReady = true; });
    void this.save();
  }

  // ---------------- minimap ----------------

  private buildMinimap(save: RealmSave | undefined): void {
    const { w, h } = this.world;
    const key = 'realmMinimap';
    if (this.textures.exists(key)) this.textures.remove(key);
    const tex = this.textures.createCanvas(key, w, h);
    if (!tex) return;
    this.minimapTex = tex;
    this.minimapData = tex.getContext().createImageData(w, h);
    this.explored = this.pocket ? undefined : save?.explored ? unpackBits(save.explored, w * h) : new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) this.paintMinimap(i, false);
    tex.getContext().putImageData(this.minimapData, 0, 0);
    tex.refresh();

    const dw = 220;
    const dh = Math.round((dw * h) / w);
    const box = { x: RW - 64 - dw, y: 78, w: dw, h: dh };
    this.minimapBox = box;
    const frame = this.add.rectangle(box.x - 2, box.y - 2, dw + 4, dh + 4, 0x000000, 0.6).setOrigin(0).setStrokeStyle(1, 0x7c3aed)
      .setScrollFactor(0).setDepth(58);
    const img = this.add.image(box.x, box.y, key).setOrigin(0).setDisplaySize(dw, dh).setScrollFactor(0).setDepth(59);
    this.minimapDot = this.add.rectangle(0, 0, 4, 4, 0xffffff).setScrollFactor(0).setDepth(60);
    this.minimapParts = [frame, img, this.minimapDot];
    const mark = (tx: number, ty: number, color: number) => {
      this.minimapParts.push(this.add.rectangle(box.x + (tx / w) * dw, box.y + (ty / h) * dh, 4, 4, color).setScrollFactor(0).setDepth(60));
    };
    for (const p of this.world.portals ?? []) mark(p.tx + 1, p.ty + 1, POCKETS[p.pocket].portalColor);
    if (this.world.foreverGate) mark(this.world.foreverGate.tx + 2, this.world.foreverGate.ty + 2, 0xfde68a);
    if (this.pocketWorld) mark((this.pocketWorld.arena.x0 + this.pocketWorld.arena.x1) / 2, this.pocketWorld.arena.floorY - 4, 0xe11d48);
    for (const id of this.duel?.proIds() ?? []) {
      const spot = this.duel!.spots[id];
      this.proMarks.set(id, this.add.rectangle(box.x + ((spot.tx + 0.5) / w) * dw, box.y + (spot.ty / h) * dh, 4, 4, 0xfde68a)
        .setScrollFactor(0).setDepth(60).setVisible(false));
    }
    this.rifts?.spots.forEach((spot) => {
      this.riftMarks.push(this.add.rectangle(box.x + ((spot.tx + 1.5) / w) * dw, box.y + (spot.ty / h) * dh, 4, 4, 0xa855f7).setScrollFactor(0).setDepth(60).setVisible(false));
    });
    if (!this.pocket && this.arena?.gate) {
      const g = this.arena.gate;
      this.arenaMapMark = this.add.rectangle(box.x + ((g.tx + 2) / w) * dw, box.y + (g.ty / h) * dh, 5, 5, 0xef4444).setScrollFactor(0).setDepth(60);
      this.minimapParts.push(this.arenaMapMark);
    }
    if (!this.pocket && this.expedition?.entrance) {
      const e = this.expedition.entrance;
      this.foundryMapMark = this.add.rectangle(box.x + ((e.tx + 1) / w) * dw, box.y + (e.ty / h) * dh, 5, 5, 0xfbbf24)
        .setScrollFactor(0).setDepth(60).setVisible(this.expedition.progress.discovered);
    }
    this.revealAround(true);
  }

  /** write one tile's color into the minimap buffer (flushed in batches by updateMinimap) */
  private paintMinimap(index: number, markDirty = true): void {
    const data = this.minimapData;
    if (!data) return;
    const { w, tiles, surface } = this.world;
    const x = index % w;
    const y = Math.floor(index / w);
    const id = tiles[index];
    let color: number;
    let alpha = 235;
    if (id === T.AIR) {
      const below = y > surface[x] + 1;
      color = below ? 0x120c1f : this.pocket ? POCKETS[this.pocket].sky : 0x2a3a5c;
      alpha = below ? 235 : 180;
    } else {
      const info = TILE_INFO[id];
      const bright = [T.GRASS, T.COPPER, T.IRON, T.SOULSTONE, T.TORCH, T.LAVA, T.PORTAL, T.ETERNAL, T.GATE, T.HERB, T.WATER];
      color = info ? (bright.includes(id as never) ? info.color[1] : info.color[0]) : 0xff00ff;
    }
    if (this.explored && !this.explored[index]) alpha = 0;
    const o = index * 4;
    data.data[o] = (color >> 16) & 0xff;
    data.data[o + 1] = (color >> 8) & 0xff;
    data.data[o + 2] = color & 0xff;
    data.data[o + 3] = alpha;
    if (markDirty) {
      const d = this.minimapDirty;
      this.minimapDirty = d
        ? { x0: Math.min(d.x0, x), y0: Math.min(d.y0, y), x1: Math.max(d.x1, x), y1: Math.max(d.y1, y) }
        : { x0: x, y0: y, x1: x, y1: y };
    }
  }

  /** uncover the map in a circle around the player (overworld only) */
  private revealAround(flush = false): void {
    const ex = this.explored;
    if (ex) {
      const { w, h } = this.world;
      const cx = Math.floor(this.player.x / TILE);
      const cy = Math.floor(this.player.y / TILE);
      const r = 16;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || y < 0 || x >= w || y >= h || dx * dx + dy * dy > r * r) continue;
          const i = y * w + x;
          if (!ex[i]) {
            ex[i] = 1;
            this.paintMinimap(i);
          }
        }
      }
    }
    if (flush) this.flushMinimap();
  }

  private flushMinimap(): void {
    const d = this.minimapDirty;
    if (!d || !this.minimapTex || !this.minimapData) return;
    this.minimapTex.getContext().putImageData(this.minimapData, 0, 0, d.x0, d.y0, d.x1 - d.x0 + 1, d.y1 - d.y0 + 1);
    this.minimapTex.refresh();
    this.minimapDirty = null;
  }

  private updateMinimap(dt: number): void {
    if (!this.minimapDot) return;
    const b = this.minimapBox;
    this.minimapDot.setPosition(b.x + (this.player.x / TILE / this.world.w) * b.w, b.y + (this.player.y / TILE / this.world.h) * b.h);
    this.minimapTimer -= dt;
    if (this.minimapTimer <= 0) {
      this.minimapTimer = 200;
      this.revealAround(true);
    }
  }

  // ---------------- save ----------------

  private async save(): Promise<void> {
    if (!this.world || !this.player) return;
    if (this.pocket) {
      // a portal realm never overwrites the overworld: only your gear, pack and relics travel back
      const base = await loadRealm();
      if (!base) return;
      const { id: _id, version: _v, savedAt: _at, ...rest } = base;
      await saveRealm({
        ...rest, inventory: this.inventory, sword: this.sword, pickaxe: this.pickaxe, yoyo: this.yoyoTier, pogo: this.hasPogo, relics: [...this.relics],
        champion: this.champion, stats: this.stats, expeditions: this.expedition?.progress, hero: this.hero?.save(),
        gear: this.gear, sigils: this.sigils, forged: this.forged, harvested: this.harvested, story: this.story?.data,
      });
      return;
    }
    await saveRealm({
      seed: this.world.seed,
      edits: [...this.edits.entries()],
      player: { x: this.dead ? this.spawnPoint.x : this.player.x, y: this.dead ? this.spawnPoint.y : this.player.y, hp: this.dead ? this.maxHp : this.hp },
      spawn: this.spawnPoint,
      inventory: this.inventory,
      sword: this.sword,
      pickaxe: this.pickaxe,
      yoyo: this.yoyoTier,
      pogo: this.hasPogo,
      clock: this.clock,
      relics: [...this.relics],
      champion: this.champion,
      stats: this.stats,
      explored: this.explored ? packBits(this.explored) : undefined,
      homestead: this.homestead?.data,
      expeditions: this.expedition?.progress,
      hero: this.hero?.save(),
      duelSpots: this.duel?.spots,
      arenaGate: this.arena?.gate,
      riftSpots: this.rifts?.spots,
      gear: this.gear,
      sigils: this.sigils,
      forged: this.forged,
      harvested: this.harvested,
      story: this.story?.data,
    });
  }
}

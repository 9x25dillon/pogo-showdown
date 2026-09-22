import Phaser from 'phaser';
import { COLORS, HEIGHT, WIDTH } from '../config';
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
export const RW = 960;
export const RH = 540;
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
const SWING_COOLDOWN_MS = 320;
const SWING_RANGE = 40;
const PLACE_REPEAT_MS = 140;
export const CYCLE_MS = 6 * 60_000;
const AUTOSAVE_MS = 30_000;
const SPAWN_EVERY_MS = 1200;
const DESPAWN_PX = 1400;
const RESPAWN_MS = 3500;

interface RealmEnemy {
  sprite: Phaser.Physics.Arcade.Sprite;
  def: RealmEnemyDef;
  hp: number;
  timer: number;
  colliders: Phaser.Physics.Arcade.Collider[];
}

interface Hazard {
  sprite: Phaser.Physics.Arcade.Sprite;
  damage: number;
  colliders: Phaser.Physics.Arcade.Collider[];
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

  private hp = BASE_HP;
  private invuln = 0;
  private sinceHit = 0;
  private facing: 1 | -1 = 1;
  private inventory: Partial<Record<ItemId, number>> = {};
  private sword = 0;
  private pickaxe = 0;
  private slot = 0;
  private spawnPoint = { x: 0, y: 0 };
  private clock = CYCLE_MS * 0.1;

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
  private touch = { left: false, right: false, jump: false, attack: false };
  private touchJumpPressed = false;
  private touchAttackPressed = false;

  // visuals
  private aimRect!: Phaser.GameObjects.Rectangle;
  private swordSprite!: Phaser.GameObjects.Image;
  private darkness!: Phaser.GameObjects.RenderTexture;
  private lightBrush!: Phaser.GameObjects.Image;
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
    return BASE_HP + (this.relics.has('grave') ? CROWN_HP : 0);
  }

  private get pocketWorld(): PocketWorld | undefined {
    return this.pocket ? (this.world as PocketWorld) : undefined;
  }

  /** seeded per world so a realm's wind (and anything else chancy) replays exactly for a given seed */
  private rand: () => number = Math.random;
  private pocketSeed?: number;

  create(data: { newWorld?: boolean; pocket?: PocketId; seed?: number } = {}): void {
    // Phaser hands a scene its previous start data again when started with none;
    // "new world" must apply once, or the next visit would wipe the save again
    this.sys.settings.data = {};
    this.scale.setGameSize(RW, RH);
    this.cameras.main.setSize(RW, RH);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      void this.save();
      this.scale.setGameSize(WIDTH, HEIGHT);
    });
    // the camera outlives restarts: clear travel()'s fade-out, or every portal trip ends on a black screen
    this.cameras.main.resetFX();
    this.cameras.main.setFollowOffset(0, 0);
    this.resetState();
    this.pocket = data.pocket;
    this.pocketSeed = data.seed;
    this.cameras.main.setBackgroundColor(this.pocket ? POCKETS[this.pocket].sky : COLORS.bg);
    music.play('explore');
    const loading = this.add.text(RW / 2, RH / 2, this.pocket ? `crossing into the ${POCKETS[this.pocket].name}…` : 'raising the Forever Realm…', {
      fontSize: '16px', fontFamily: 'system-ui, sans-serif', color: '#b7aed0',
    }).setOrigin(0.5).setScrollFactor(0);

    void (data.newWorld ? Promise.resolve(undefined) : loadRealm()).then((save) => {
      if (!this.scene.isActive()) return;
      loading.destroy();
      this.build(save);
    });
  }

  private resetState(): void {
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
    this.touch = { left: false, right: false, jump: false, attack: false };
    this.touchJumpPressed = false;
    this.touchAttackPressed = false;
    this.slotBoxes = [];
    this.slotTexts = [];
    this.craftPanel = undefined;
    this.craftRows = [];
    this.deathText = undefined;
    this.lightSources = [];
  }

  // ---------------- world ----------------

  private build(save: RealmSave | undefined): void {
    // portal realms are regenerated every visit; only the overworld keeps its edits
    this.world = this.pocket ? generatePocket(this.pocket, this.pocketSeed ?? newSeed()) : generateWorld(save?.seed ?? newSeed());
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
      this.relics = new Set(save.relics ?? []);
      this.champion = !!save.champion;
      this.stats = { ...emptyStats(), ...save.stats };
    }
    if (!this.pocket) this.openGateIfWorthy();

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
    this.player = this.physics.add.sprite(at.x, at.y, 'realm_hero').setOrigin(0.5, 1).setDepth(10);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(16, 40).setOffset(6, 6);
    body.setCollideWorldBounds(true);
    body.setGravityY(PHYS.gravityY);
    this.physics.add.collider(this.player, this.layer);
    this.hp = save ? Phaser.Math.Clamp(save.player.hp, 1, this.maxHp) : this.maxHp;

    this.cameras.main.startFollow(this.player, true, 0.14, 0.14);
    this.cameras.main.setDeadzone(90, 60);
    this.cameras.main.setRoundPixels(true);

    // background wall behind everything below the original surface, so dug-out
    // tunnels and caves read as dark rock rather than open sky
    const wall = this.add.graphics().setDepth(-1);
    const wallColor: Record<string, number> = { overworld: 0x1b1226, ember: 0x1c0a07, tide: 0x071a2c, gale: 0x000000, grave: 0x0b0810, forever: 0x0c0714 };
    wall.fillStyle(wallColor[this.pocket ?? 'overworld'], this.pocket === 'gale' ? 0 : 1); // the Gale Realm is open sky
    const pts: Phaser.Math.Vector2[] = [];
    for (let x = 0; x < w; x++) {
      const y = (this.world.surface[x] + 2) * TILE;
      pts.push(new Phaser.Math.Vector2(x * TILE, y), new Phaser.Math.Vector2((x + 1) * TILE, y));
    }
    pts.push(new Phaser.Math.Vector2(w * TILE, h * TILE), new Phaser.Math.Vector2(0, h * TILE));
    wall.fillPoints(pts, true);

    this.aimRect = this.add.rectangle(0, 0, TILE, TILE).setOrigin(0).setStrokeStyle(2, 0xffffff, 0.9).setDepth(20).setVisible(false);
    this.swordSprite = this.add.image(0, 0, 'realm_sword').setOrigin(0.5, 0.95).setDepth(11).setVisible(false);

    this.darkness = this.add.renderTexture(0, 0, RW, RH).setOrigin(0).setScrollFactor(0).setDepth(50);
    // off the display list: only ever drawn into the darkness texture as an eraser
    this.lightBrush = new Phaser.GameObjects.Image(this, 0, 0, 'lightBrush').setOrigin(0.5);
    this.skyLight = new Phaser.GameObjects.Graphics(this);

    this.buildPortalLabels();
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
      return;
    }
    this.setTile(tx, ty, T.AIR);
    this.stats.mined += 1;
    if (info.drop) this.addItem(info.drop, 1, at);
    // plants and torches don't float: whatever sat on this tile drops too
    const above = this.tileAt(tx, ty - 1);
    if (above === T.HERB || above === T.TORCH) this.breakTile(tx, ty - 1);
  }

  /** place a block/torch; returns whether it happened */
  private placeTile(tx: number, ty: number, item: ItemId): boolean {
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
    this.infoText = hud(this.add.text(16, 36, '', { fontSize: '12px', fontFamily: font, color: '#e9d5ff' }));
    this.swordText = hud(this.add.text(RW - 16, 10, '', { fontSize: '13px', fontFamily: font, fontStyle: 'bold', color: '#fca5a5' }).setOrigin(1, 0));

    this.relicText = hud(this.add.text(16, 54, '', { fontSize: '13px', fontFamily: font, color: '#ffffff' }));
    this.buffText = hud(this.add.text(16, 74, '', { fontSize: '12px', fontFamily: font, color: '#a7f3d0' }));
    this.breathBack = hud(this.add.rectangle(16, 94, 120, 8, 0x0c1a2e).setOrigin(0).setStrokeStyle(1, 0x38bdf8).setVisible(false));
    this.breathBar = hud(this.add.rectangle(17, 95, 118, 6, 0x38bdf8).setOrigin(0).setVisible(false));

    HOTBAR.forEach((_, i) => {
      const x = RW / 2 + (i - (HOTBAR.length - 1) / 2) * 46;
      const box = hud(this.add.rectangle(x, 30, 42, 42, 0x1c1430, 0.85).setStrokeStyle(2, 0x362a52).setInteractive());
      box.on('pointerdown', () => { this.slot = i; });
      this.slotBoxes.push(box);
      this.slotTexts.push(hud(this.add.text(x, 30, '', { fontSize: '18px', fontFamily: font, align: 'center' }).setOrigin(0.5)));
    });
    this.slotLabel = hud(this.add.text(RW / 2, 64, '', { fontSize: '12px', fontFamily: font, color: '#fef08a' }).setOrigin(0.5, 0));

    const btn = (y: number, label: string, onTap: () => void) => {
      const b = hud(this.add.rectangle(RW - 52, y, 80, 26, 0x362a52).setInteractive({ useHandCursor: true }));
      hud(this.add.text(RW - 52, y, label, { fontSize: '11px', fontFamily: font, fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5));
      b.on('pointerdown', onTap);
    };
    btn(44, 'PAUSE', () => this.pauseRealm());
    btn(76, 'CRAFT', () => this.toggleCraft());

    this.promptText = hud(this.add.text(RW / 2, RH - 60, '', {
      fontSize: '14px', fontFamily: font, fontStyle: 'bold', color: '#ffffff', backgroundColor: '#0b0714cc', padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setVisible(false));
    this.bossBack = hud(this.add.rectangle(RW / 2, 112, 404, 14, 0x1c1430).setStrokeStyle(1, 0xe11d48).setVisible(false));
    this.bossBar = hud(this.add.rectangle(RW / 2 - 200, 112, 400, 10, 0xe11d48).setOrigin(0, 0.5).setVisible(false));
    this.bossText = hud(this.add.text(RW / 2, 97, '', { fontSize: '12px', fontFamily: font, fontStyle: 'bold', color: '#fecdd3' }).setOrigin(0.5).setVisible(false));
    this.bannerText = hud(this.add.text(RW / 2, RH / 2 - 90, '', {
      fontSize: '26px', fontFamily: font, fontStyle: 'bold', color: '#fef08a', align: 'center', stroke: '#0b0714', strokeThickness: 5,
    }).setOrigin(0.5).setAlpha(0).setDepth(65));
    for (let i = 0; i < 14; i++) this.windStreaks.push(hud(this.add.rectangle(0, 0, 60, 2, 0xffffff, 0.5).setVisible(false)));

    const hint = hud(this.add.text(RW / 2, RH - 12,
      'mine & build · ⚔ fight · the shrine east of spawn opens the realms    🎮 A jump · X sword · RT use · RS aim · LB/RB tools · Y craft · ▼ enter portal    ⌨ A/D · W · J · K/click · 1-0 · E craft · S portal',
      { fontSize: '11px', fontFamily: font, color: '#b7aed0' }).setOrigin(0.5, 1));
    this.tweens.add({ targets: hint, alpha: 0, delay: 25_000, duration: 1500 });

    if (!this.sys.game.device.os.desktop) this.buildTouchControls();
    this.updateHud();
  }

  private buildTouchControls(): void {
    const zone = (x: number, y: number, label: string, set: (down: boolean) => void) => {
      const r = this.add.circle(x, y, 38, 0xffffff, 0.14).setScrollFactor(0).setDepth(60).setInteractive();
      this.add.text(x, y, label, { fontSize: '20px', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0).setDepth(61);
      r.on('pointerdown', () => set(true));
      r.on('pointerup', () => set(false));
      r.on('pointerout', () => set(false));
    };
    zone(60, RH - 60, '◀', (d) => { this.touch.left = d; });
    zone(150, RH - 60, '▶', (d) => { this.touch.right = d; });
    zone(RW - 150, RH - 60, '⚔', (d) => { if (d && !this.touch.attack) this.touchAttackPressed = true; this.touch.attack = d; });
    zone(RW - 60, RH - 60, '⤒', (d) => { if (d && !this.touch.jump) this.touchJumpPressed = true; this.touch.jump = d; });
  }

  private banner(title: string, sub = ''): void {
    this.bannerText.setText(sub ? `${title}\n${sub}` : title).setAlpha(1);
    this.tweens.killTweensOf(this.bannerText);
    this.tweens.add({ targets: this.bannerText, alpha: 0, delay: 2600, duration: 900 });
  }

  private updateHud(): void {
    this.hpBar.width = 218 * Math.max(0, this.hp) / this.maxHp;
    this.hpText.setText(`HP ${Math.ceil(Math.max(0, this.hp))} / ${this.maxHp}`);
    this.relicText.setText(POCKET_ORDER.map((id) => (this.relics.has(id) ? RELICS[id].icon : '◌')).join(' '));
    this.buffText.setText(BREW_IDS.filter((b) => (this.buffs[b] ?? 0) > 0).map((b) => `${ITEM_ICON[b]} ${Math.ceil(this.buffs[b]! / 1000)}s`).join('  ')
      + (this.hazardHere() === 'ember' && !this.heatProof() ? '   🔥 HEAT' : ''));
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
    this.swordText.setText(`⚔ ${SWORDS[this.sword].name} (${this.swordDamage()})`);
    HOTBAR.forEach((slot, i) => {
      const selected = i === this.slot;
      this.slotBoxes[i].setStrokeStyle(selected ? 3 : 2, selected ? 0xfacc15 : 0x362a52);
      this.slotTexts[i].setText(slot === 'pickaxe' ? '⛏' : `${ITEM_ICON[slot]}\n${this.count(slot)}`).setFontSize(slot === 'pickaxe' ? 20 : 13);
    });
    const current = HOTBAR[this.slot];
    const brew = (BREW_IDS as string[]).includes(current) ? ` · ${BREWS[current as BrewId].effect}` : '';
    this.slotLabel.setText(current === 'pickaxe' ? PICKAXES[this.pickaxe].name : `${ITEM_NAME[current]} ×${this.count(current)}${brew}`);
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
      seven: K.SEVEN, eight: K.EIGHT, nine: K.NINE, zero: K.ZERO, s: K.S, tab: K.TAB,
    }) as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', () => { this.lastMouseMove = this.time.now; });
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (this.ending) {
        if (this.endingReady) void this.travel('home');
        return;
      }
      if (over.length > 0 || this.craftPanel?.visible) return; // a HUD button, not the world
      this.lastMouseMove = this.time.now;
      if (pointer.rightButtonDown()) this.swing();
      else this.pointerUse = true;
    });
    this.input.on('pointerup', () => { this.pointerUse = false; });
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
    this.slot = (this.slot + dir + HOTBAR.length) % HOTBAR.length;
  }

  private pauseRealm(): void {
    if (!this.ready || !this.scene.isActive()) return;
    this.pointerUse = false;
    this.touch = { left: false, right: false, jump: false, attack: false };
    void this.save();
    this.scene.launch('PlatformerPause', { target: 'Realm' });
    this.scene.pause();
  }

  // ---------------- crafting ----------------

  private toggleCraft(): void {
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
    panel.add(this.add.rectangle(0, 0, 560, 480, 0x0b0714, 0.96).setStrokeStyle(2, 0x7c3aed));
    panel.add(this.add.text(0, -218, 'ALCHEMY & SMITHING', { fontSize: '18px', fontFamily: font, fontStyle: 'bold', color: '#c4b5fd' }).setOrigin(0.5));
    panel.add(this.add.text(0, 224, 'click / A to craft · E / Y / B to close', { fontSize: '11px', fontFamily: font, color: '#6b6180' }).setOrigin(0.5));
    RECIPES.forEach((recipe, i) => {
      const y = -186 + i * 37;
      const bg = this.add.rectangle(0, y, 520, 32, 0x1c1430).setStrokeStyle(1, 0x362a52).setInteractive({ useHandCursor: true });
      const text = this.add.text(-248, y, '', { fontSize: '13px', fontFamily: font, color: '#ffffff' }).setOrigin(0, 0.5);
      bg.on('pointerdown', () => { this.craftIndex = i; this.craft(recipe); });
      panel.add([bg, text]);
      this.craftRows.push({ bg, text, recipe });
    });
    panel.setVisible(false);
    this.craftPanel = panel;
  }

  private canCraft(recipe: Recipe): boolean {
    if ('sword' in recipe.gives && this.sword >= recipe.gives.sword) return false;
    if ('pickaxe' in recipe.gives && this.pickaxe >= recipe.gives.pickaxe) return false;
    return Object.entries(recipe.cost).every(([item, n]) => this.count(item as ItemId) >= (n ?? 0));
  }

  private refreshCraft(): void {
    this.craftRows.forEach(({ bg, text, recipe }, i) => {
      const owned = ('sword' in recipe.gives && this.sword >= recipe.gives.sword) || ('pickaxe' in recipe.gives && this.pickaxe >= recipe.gives.pickaxe);
      const cost = Object.entries(recipe.cost)
        .map(([item, n]) => `${ITEM_ICON[item as ItemId]} ${this.count(item as ItemId)}/${n}`)
        .join('   ');
      text.setText(`${recipe.name}    ${owned ? '✓ owned' : cost}`);
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
    const g = recipe.gives;
    if ('item' in g) this.addItem(g.item, g.count);
    else if ('sword' in g) this.sword = g.sword;
    else this.pickaxe = g.pickaxe;
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

    if (this.ending) {
      if (this.endingReady && (pad.pressed.a || J(k.space) || J(k.k) || J(k.j))) void this.travel('home');
      return;
    }
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

    // hotbar & potion
    if (pad.pressed.lb) this.cycleSlot(-1);
    if (pad.pressed.rb) this.cycleSlot(1);
    (['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'zero'] as const).forEach((key, i) => { if (J(k[key])) this.slot = i; });
    if (pad.pressed.b || J(k.q)) this.drinkPotion();

    // movement
    const left = k.a.isDown || k.left.isDown || pad.held.left || this.touch.left;
    const right = k.d.isDown || k.right.isDown || pad.held.right || this.touch.right;
    let jumpPressed = pad.pressed.a || J(k.w) || J(k.space) || this.touchJumpPressed;
    const jumpHeld = pad.held.a || k.w.isDown || k.space.isDown || this.touch.jump;
    this.touchJumpPressed = false;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const grounded = body.blocked.down || body.touching.down;
    const inWater = this.isWaterAt(this.player.x, this.player.y - 18);

    // portals: stand in one and press down
    const portal = this.portalHere();
    const sealed = !portal && this.nearSealedGate();
    this.promptText.setVisible(!!portal || sealed).setText(
      portal ? `▼ ${portal === 'home' ? 'return to the Overworld' : portal === 'forever' ? 'pass through the Forever Gate' : `enter the ${POCKETS[portal].name}`}`
      : sealed ? `the Forever Gate is sealed · ${this.relics.size}/${POCKET_ORDER.length} relics` : '',
    );
    if (portal && (pad.pressed.down || J(k.down) || J(k.s))) {
      void this.travel(portal);
      return;
    }

    // Gale Plume: one extra jump in the air
    if (grounded || inWater) this.airJumpsUsed = 0;
    if (jumpPressed && !grounded && !inWater && this.ctrl.coyoteMs <= 0 && this.relics.has('gale') && this.airJumpsUsed < 1) {
      body.setVelocityY(PHYS.jumpVelocity * JUMP_SCALE * 0.92);
      this.ctrl.jumpCutApplied = false;
      this.airJumpsUsed += 1;
      jumpPressed = false;
    }
    const swimSpeed = inWater && !this.relics.has('tide') ? 0.7 : 1;
    updateController(body, { left, right, jumpPressed: jumpPressed && !inWater, jumpHeld }, this.ctrl,
      { moveSpeed: MOVE_SPEED * swimSpeed, moveAccel: PHYS.moveAccel, jumpScale: JUMP_SCALE }, dt);
    applyHeroGravity(body);
    this.updateEnvironment(dt, body, { inWater, grounded, jumpPressed, jumpHeld });
    if (left && !right) this.facing = -1;
    else if (right && !left) this.facing = 1;
    this.player.setFlipX(this.facing < 0);
    this.player.setScale(1, grounded && Math.abs(body.velocity.x) > 30 ? 1 + Math.sin(this.time.now / 55) * 0.04 : 1);
    this.invuln = Math.max(0, this.invuln - dt);
    this.player.setAlpha(this.invuln > 0 && Math.floor(this.invuln / 80) % 2 === 0 ? 0.45 : 1);

    // sword
    this.swingTimer = Math.max(0, this.swingTimer - dt);
    if (pad.pressed.x || J(k.j) || this.touchAttackPressed) this.swing();
    this.touchAttackPressed = false;

    // aim & tool use
    this.aim = this.computeAim(pads, k);
    const using = pad.held.rt || k.k.isDown || this.pointerUse;
    this.useTool(using, pad.pressed.rt || J(k.k), dt);
    this.drawAim();

    // regen
    this.sinceHit += dt;
    if (this.sinceHit > REGEN_DELAY_MS && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + (REGEN_PER_S * dt) / 1000);
    for (const b of BREW_IDS) if ((this.buffs[b] ?? 0) > 0) this.buffs[b] = Math.max(0, this.buffs[b]! - dt);

    this.updateMinimap(dt);
    this.updateEnemies(dt);
    this.updateHazards();
    this.updateBossFight(dt);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = SPAWN_EVERY_MS;
      this.trySpawn();
    }

    if (this.pocket) music.play(this.boss ? 'danger' : this.bossDefeated ? 'win' : 'explore');
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
    if (!this.pocket) return undefined;
    if (this.pocket !== 'forever') return this.pocket;
    const tx = Math.floor(this.player.x / TILE);
    return FOREVER_SEGMENTS.find((s) => tx >= s.x0 && tx < s.x1)?.like;
  }

  private async travel(to: PocketId | 'home'): Promise<void> {
    if (!this.ready) return;
    this.ready = false; // freeze input while we save and swap worlds
    await this.save();
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
    const pointer = this.input.activePointer;
    if (stick) {
      ax = cx + stick.rx * REACH_PX;
      ay = cy + stick.ry * REACH_PX;
    } else if (this.pointerUse || this.time.now - this.lastMouseMove < 2500) {
      ax = pointer.worldX;
      ay = pointer.worldY;
    } else {
      const padFrames = mergePads(pads).held;
      const up = k.up.isDown || (padFrames.up && !padFrames.left && !padFrames.right);
      const down = k.down.isDown || (padFrames.down && !padFrames.left && !padFrames.right);
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
        if (HOTBAR[this.slot] === 'pickaxe') {
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
    const slot: HotbarSlot = HOTBAR[this.slot];
    this.placeTimer = Math.max(0, this.placeTimer - dt);
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
      if (this.placeTile(tx, ty, slot)) this.placeTimer = PLACE_REPEAT_MS;
    }
  }

  private drawAim(): void {
    const slot = HOTBAR[this.slot];
    if (!this.aim || slot === 'potion' || (BREW_IDS as string[]).includes(slot)) {
      this.aimRect.setVisible(false);
      return;
    }
    const { tx, ty } = this.aim;
    const id = this.tileAt(tx, ty);
    const info = TILE_INFO[id];
    let ok: boolean;
    if (slot === 'pickaxe') ok = !!info && id !== T.AIR && info.minPick <= this.pickaxe && Number.isFinite(info.hardness);
    else ok = id === T.AIR && this.count(slot) > 0;
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
    const base = SWORDS[this.sword].damage + (this.relics.has('ember') ? 4 : 0);
    return Math.round(base * ((this.buffs.tonic ?? 0) > 0 ? 1.5 : 1));
  }

  // ---------------- combat ----------------

  private swing(): void {
    if (this.swingTimer > 0 || this.dead || !this.ready) return;
    this.swingTimer = SWING_COOLDOWN_MS;
    const dir = this.facing;
    const hx = this.player.x + dir * 22;
    const hy = this.player.y - 22;
    this.swordSprite.setPosition(this.player.x + dir * 6, this.player.y - 20).setFlipX(dir < 0).setVisible(true).setAngle(dir * -100);
    this.tweens.add({
      targets: this.swordSprite,
      angle: dir * 70,
      duration: 160,
      onComplete: () => this.swordSprite.setVisible(false),
    });
    const damage = this.swordDamage();
    const inReach = (b: Phaser.Physics.Arcade.Body) => Math.hypot(b.center.x - hx, b.center.y - hy) <= SWING_RANGE + Math.max(b.width, b.height) / 2;
    for (const e of [...this.enemies]) if (inReach(e.sprite.body as Phaser.Physics.Arcade.Body)) this.hurtEnemy(e, damage, dir);
    const boss = this.boss;
    if (boss && inReach(boss.sprite.body as Phaser.Physics.Arcade.Body)) {
      const dealt = hitBoss(boss, damage, this.player.x);
      if (dealt === 0) {
        this.floatText(boss.sprite.x, boss.sprite.y - 60, 'BLOCKED', '#94a3b8');
      } else {
        this.floatText(boss.sprite.x, boss.sprite.y - 60, `${dealt}`, '#fca5a5');
        boss.sprite.setTint(0xff5c5c);
        this.time.delayedCall(90, () => { if (boss.sprite.active) boss.sprite.clearTint(); });
        if (boss.hp <= 0) this.defeatBoss();
      }
    }
  }

  private hurtEnemy(e: RealmEnemy, damage: number, dir: number): void {
    e.hp -= damage;
    const body = e.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(dir * 230, -200);
    e.timer = Math.max(e.timer, 350); // stagger
    e.sprite.setTint(0xff5c5c); // hit flash
    this.time.delayedCall(90, () => { if (e.sprite.active) e.sprite.clearTint(); });
    this.floatText(e.sprite.x, e.sprite.y - 24, `${damage}`, '#fca5a5');
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: RealmEnemy): void {
    this.enemies = this.enemies.filter((x) => x !== e);
    this.stats.slain += 1;
    for (const c of e.colliders) c.destroy();
    const drops = 1 + Math.floor(Math.random() * e.def.dropMax);
    this.addItem(e.def.drop, drops, { x: e.sprite.x, y: e.sprite.y - 30 });
    (e.sprite.body as Phaser.Physics.Arcade.Body).enable = false;
    this.tweens.add({ targets: e.sprite, alpha: 0, scaleY: 0.2, duration: 200, onComplete: () => e.sprite.destroy() });
  }

  private hurtPlayer(damage: number, fromX: number): void {
    if (this.invuln > 0 || this.dead) return;
    this.hp -= damage;
    this.invuln = HIT_INVULN_MS;
    this.sinceHit = 0;
    const away = this.player.x < fromX ? -1 : 1;
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(away * 260, -220);
    this.cameras.main.flash(120, 180, 20, 40);
    for (const p of readPads(this.time.now)) rumble(p.index, 150, 0.6);
    if (this.hp <= 0) this.die();
  }

  private die(): void {
    this.dead = true;
    this.stats.deaths += 1;
    this.deathTimer = RESPAWN_MS;
    this.player.setVisible(false);
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0).enable = false;
    this.aimRect.setVisible(false);
    music.play('loss');
    this.deathText = this.add.text(RW / 2, RH / 2, this.pocket ? `YOU FELL\nthe ${POCKETS[this.pocket].name} casts you back to its gate…` : 'YOU FELL\nthe Forever Realm does not let you go…', {
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
    if (!this.boss && !this.bossDefeated && this.player.x > (pw.arena.x0 + 3) * TILE) this.startBossFight();
    const b = this.boss;
    if (!b) return;
    updateBoss(b, this.bossCtx(), dt);
    const bd = b.sprite.body as Phaser.Physics.Arcade.Body;
    // keep flyers inside the arena box
    b.sprite.x = Phaser.Math.Clamp(b.sprite.x, (pw.arena.x0 + 1) * TILE, (pw.arena.x1 - 1) * TILE);
    if (b.def.flies) b.sprite.y = Phaser.Math.Clamp(b.sprite.y, (pw.arena.floorY - 18) * TILE, (pw.arena.floorY - 1) * TILE);
    if (b.sprite.y > this.world.h * TILE) bd.reset((pw.arena.x0 + pw.arena.x1) / 2 * TILE, (pw.arena.floorY - 2) * TILE);
  }

  private startBossFight(): void {
    const pw = this.pocketWorld!;
    const def = BOSSES[POCKETS[pw.pocket].boss];
    const cx = ((pw.arena.x0 + pw.arena.x1) / 2 + 8) * TILE;
    const y = def.flies ? (pw.arena.floorY - (def.id === 'leviathan' ? 5 : 12)) * TILE : pw.arena.floorY * TILE;
    const sprite = this.physics.add.sprite(cx, y, def.texture).setOrigin(0.5, def.flies ? 0.5 : 1).setDepth(9);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    if (def.flies) body.setAllowGravity(false);
    else {
      body.setGravityY(PHYS.gravityY);
      this.physics.add.collider(sprite, this.layer);
    }
    this.physics.add.overlap(this.player, sprite, () => {
      const b = this.boss;
      if (!b || b.sprite !== sprite) return;
      const harmless = b.phase === 'reel' || b.phase === 'tired' || b.phase === 'recover';
      if (!harmless) this.hurtPlayer(def.contactDamage, sprite.x);
    });
    this.boss = createBoss(def, sprite);
    // flying bosses fight from above: look higher so they stay clear of the HUD
    if (def.flies) this.cameras.main.setFollowOffset(0, 90);
    // close the arena behind you
    this.gateTiles = [];
    for (let ty = pw.arena.floorY - 1; ty > pw.arena.floorY - 16 && ty > 0; ty--) {
      const tx = pw.arena.x0;
      if (this.tileAt(tx, ty) === T.AIR || this.tileAt(tx, ty) === T.WATER) {
        this.gateTiles.push({ tx, ty });
        this.setTile(tx, ty, T.SHRINE);
      }
    }
    this.banner(def.name.toUpperCase(), POCKETS[pw.pocket].name);
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

  private defeatBoss(): void {
    const pw = this.pocketWorld!;
    const def = POCKETS[pw.pocket];
    const at = { x: this.boss!.sprite.x, y: this.boss!.sprite.y - 40 };
    this.endBossFight(true);
    this.bossDefeated = true;
    this.darkOverride = null;
    this.stats.bosses += 1;
    for (const e of [...this.enemies]) this.killEnemy(e);
    this.addItem(def.loot.item, def.loot.count, at);
    if (pw.pocket === 'forever') {
      this.champion = true;
      if (this.sword < 4) this.sword = 4;
      this.time.delayedCall(1800, () => this.showEnding());
    } else {
      const firstTime = !this.relics.has(pw.pocket);
      this.relics.add(pw.pocket);
      const relic = RELICS[pw.pocket];
      this.banner(`${relic.icon} ${relic.name}`, relic.power);
      if (firstTime && this.relics.size === POCKET_ORDER.length) {
        this.time.delayedCall(3600, () => this.banner('THE FOREVER GATE STIRS…', 'all four relics are yours'));
      }
    }
    // a way home, in the middle of the arena
    const tx = Math.floor((pw.arena.x0 + pw.arena.x1) / 2);
    for (let dx = 0; dx < 2; dx++) for (let dy = 1; dy <= 3; dy++) this.setTile(tx + dx, pw.arena.floorY - dy, T.PORTAL);
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
      if (this.invuln > 0 || this.dead) return;
      this.hurtPlayer(h.damage, sprite.x);
      this.removeHazard(h);
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
    const sprite = this.physics.add.sprite(x, y, def.texture).setOrigin(0.5, floats ? 0.5 : 1).setDepth(9);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    const e: RealmEnemy = { sprite, def, hp: def.hp, timer: 600 + Math.random() * 600, colliders: [] };
    if (floats) body.setAllowGravity(false);
    else body.setGravityY(PHYS.gravityY);
    if (!def.phasing) e.colliders.push(this.physics.add.collider(sprite, this.layer));
    e.colliders.push(this.physics.add.overlap(this.player, sprite, () => this.hurtPlayer(def.damage, sprite.x)));
    this.enemies.push(e);
    return e;
  }

  private despawn(e: RealmEnemy): void {
    this.enemies = this.enemies.filter((x) => x !== e);
    for (const c of e.colliders) c.destroy();
    e.sprite.destroy();
  }

  private updateEnemies(dt: number): void {
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
    const erase = (x: number, y: number, r: number) => {
      this.lightBrush.setPosition(x - cam.worldView.x, y - cam.worldView.y).setScale((r * 2) / 256);
      rt.erase(this.lightBrush);
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
      ['Four relics. One gate. The curse of forever, broken — for now.', 15, '#e9d5ff'],
      ['The Forever Realm endures, and so do you.', 15, '#e9d5ff'],
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
    const box = { x: RW - 16 - dw, y: 100, w: dw, h: dh };
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
        ...rest, inventory: this.inventory, sword: this.sword, pickaxe: this.pickaxe, relics: [...this.relics],
        champion: this.champion, stats: this.stats,
      });
      return;
    }
    await saveRealm({
      seed: this.world.seed,
      edits: [...this.edits.entries()],
      player: { x: this.player.x, y: this.dead ? this.spawnPoint.y : this.player.y, hp: this.dead ? this.maxHp : this.hp },
      spawn: this.spawnPoint,
      inventory: this.inventory,
      sword: this.sword,
      pickaxe: this.pickaxe,
      clock: this.clock,
      relics: [...this.relics],
      champion: this.champion,
      stats: this.stats,
      explored: this.explored ? packBits(this.explored) : undefined,
    });
  }
}

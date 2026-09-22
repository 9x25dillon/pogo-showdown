import Phaser from 'phaser';
import { CHARACTERS, type Character } from '../data/characters';
import {
  COLORS,
  HEIGHT,
  REGISTRY_KEY_CHARACTER,
  REGISTRY_KEY_LAST_PLATFORMER_RESULT,
  REGISTRY_KEY_PLATFORMER_LEVEL_INDEX,
  WIDTH,
} from '../config';
import {
  AIR_JUMP_VELOCITY_SCALE,
  BOLT_LIFESPAN_MS,
  BOLT_SPEED,
  BOMB_LIFESPAN_MS,
  CHASER_RANGE_PX,
  CHASER_SPEED_SCALE,
  CONDUCTOR_DIVE_SPEED,
  CONDUCTOR_ENRAGED_FIRE_MS,
  CONDUCTOR_FIRE_MS,
  CONDUCTOR_HOVER_MS,
  CONDUCTOR_HOVER_SPEED,
  CONDUCTOR_HOVER_Y,
  CONDUCTOR_PERCH_MS,
  CONDUCTOR_PERCH_Y,
  CONDUCTOR_RISE_SPEED,
  CONDUCTOR_TELEGRAPH_MS,
  DROPPER_RELOAD_MS,
  DROPPER_TELEGRAPH_MS,
  DROPPER_TRIGGER_PX,
  GHOST_DRIFT_SPEED,
  GHOST_FADED_MS,
  GHOST_RANGE_PX,
  GHOST_SOLID_MS,
  BOSS_CHARGE_MS,
  BOSS_COOLDOWN_MS,
  BOSS_PATROL_MS,
  BOSS_TELEGRAPH_MS,
  COOP_VIEW_MARGIN_PX,
  ENEMY_PATROL_SPEED,
  FLYER_BOB_HEIGHT,
  FLYER_BOB_SPEED,
  GAP_DEATH_Y,
  GRAVITY_Y,
  GROUND_POUND_RADIUS_X,
  GROUND_POUND_RADIUS_Y,
  GROUND_POUND_SPEED,
  HOPPER_HOP_INTERVAL_MS,
  HOPPER_HOP_VELOCITY,
  MAGNET_PULL_SPEED,
  MAGNET_RADIUS_PX,
  PELLET_LIFESPAN_MS,
  PELLET_SPEED,
  PHYS,
  PLATFORMER_INVULN_MS,
  PLAYER_LIVES,
  PROJECTILE_LIFESPAN_MS,
  PROJECTILE_SPEED,
  SHOCKWAVE_LIFESPAN_MS,
  SHOCKWAVE_SPEED,
  SLAMMER_ENRAGE_PATROL_SCALE,
  SLAMMER_LEAP_VELOCITY,
  SLAMMER_MAX_LEAP_VX,
  SLAMMER_PATROL_MS,
  SLAMMER_STUN_MS,
  SLAMMER_TELEGRAPH_MS,
  SPRING_VELOCITY,
  SPEED_BOOST_MS,
  SPEED_BOOST_MULTIPLIER,
  STOMP_BOUNCE_VELOCITY,
  STOMP_COMBO_THRESHOLD,
  STOMP_STUN_MS,
  STOMP_TOLERANCE_PX,
  TURRET_FIRE_INTERVAL_MS,
  TURRET_RANGE_PX,
} from '../data/platformerConfig';
import { LEVELS, type LevelDef } from '../data/levels';
import { enemyDef, type PlatformerEnemyDef } from '../data/platformerEnemies';
import {
  applyHeroGravity,
  createControllerState,
  updateController,
  type ControllerInput,
  type ControllerState,
} from '../systems/PlayerController';
import { createRivalAIState, computeRivalInput, resyncRivalAI, type RivalAIState } from '../systems/rivalAI';
import { mountTuningPanel } from '../systems/tuningPanel';
import { mergePads, readPads, rumble } from '../systems/gamepad';
import { equippedLoadout, equippedPerks } from '../db/pogRepository';
import type { PogActiveEffect, PogDef } from '../data/pogs';
import type { PlatformerResult } from '../db/platformerResult';

const ITEM_ICON: Record<PogActiveEffect['kind'], string> = {
  shieldBurst: '⛨',
  speedBurst: '⚡',
  extraLife: '❤',
  projectile: '🔥',
  freeze: '❄',
  magnet: '🧲',
  doubleJump: '🦘',
  groundPound: '💥',
};

const P2_TINT = 0x38bdf8;
const RIVAL_TINT = 0x94a3b8;
const FROZEN_TINT = 0x93c5fd;

/**
 * charger:   patrol/telegraph/charge/cooldown
 * slammer:   patrol/telegraph/leap/stunned/recover
 * conductor: hover/telegraph/dive/perched/recover
 */
type BossPhase = 'patrol' | 'telegraph' | 'charge' | 'cooldown' | 'leap' | 'stunned' | 'recover' | 'hover' | 'dive' | 'perched';

interface PatrolEnemyState {
  sprite: Phaser.Physics.Arcade.Sprite;
  def: PlatformerEnemyDef;
  originX: number;
  rangeX: number;
  dir: 1 | -1;
  alive: boolean;
  baseY: number;
  bobPhase: number;
  health: number;
  /** hop / fire / boss-phase countdown, depending on def.movement */
  timer: number;
  bossPhase?: BossPhase;
  /** ghost: faded out - harmless, unstompable, projectiles pass through */
  phased?: boolean;
  /** dropper: ms left in the pre-drop warning flash (0 = not winding up) */
  windup?: number;
  /** conductor: dive target x, and countdown to its next bolt */
  diveX?: number;
  fireTimer?: number;
}

interface MovingPlatformState {
  sprite: Phaser.Physics.Arcade.Sprite;
  originX: number;
  rangeX: number;
  speed: number;
  dir: 1 | -1;
  prevX: number;
}

/** one equipped active pog; each hero carries their own charges */
interface ItemSlot {
  def: PogDef;
  effect: PogActiveEffect;
  charges: number;
}

interface HeroInput {
  touchLeft: boolean;
  touchRight: boolean;
  keyLeft: boolean;
  keyRight: boolean;
  touchJump: boolean;
  keyJump: boolean;
  padLeft: boolean;
  padRight: boolean;
  padJump: boolean;
  pendingJump: boolean;
  pendingItem: boolean;
  pendingSwap: boolean;
}

/**
 * A human-controlled player. Solo has one; co-op has two, with full
 * parity (own items, boosts, invulnerability) except the lives pool,
 * which stays shared.
 */
interface Hero {
  slot: 1 | 2;
  sprite: Phaser.Physics.Arcade.Sprite;
  ctrl: ControllerState;
  input: HeroInput;
  invulnTimer: number;
  stunTimer: number;
  speedBoostTimer: number;
  airJumpTimer: number;
  airJumpsUsed: number;
  magnetTimer: number;
  pounding: boolean;
  lastCheckpoint: { x: number; y: number };
  items: ItemSlot[];
  selectedItem: number;
  /** Gamepad API index of the controller driving this hero, for rumble */
  padIndex?: number;
  itemButton?: { bg: Phaser.GameObjects.Arc; label: Phaser.GameObjects.Text; charges: Phaser.GameObjects.Text };
  swapButton?: { bg: Phaser.GameObjects.Arc; label: Phaser.GameObjects.Text };
}

function emptyInput(): HeroInput {
  return {
    touchLeft: false,
    touchRight: false,
    keyLeft: false,
    keyRight: false,
    touchJump: false,
    keyJump: false,
    padLeft: false,
    padRight: false,
    padJump: false,
    pendingJump: false,
    pendingItem: false,
    pendingSwap: false,
  };
}

export class PlatformerRunScene extends Phaser.Scene {
  private level!: LevelDef;
  private character!: Character;

  private heroes: Hero[] = [];
  /** P1's sprite - kept as a field since most solo logic (rival, boss aim, camera) keys off it */
  private player!: Phaser.Physics.Arcade.Sprite;
  /** co-op only (LevelDef.player2Start) - a second human, not an AI rival */
  private p2?: Phaser.Physics.Arcade.Sprite;
  private coopMode = false;
  /** co-op camera follows this point, kept at the heroes' midpoint */
  private cameraTarget?: Phaser.GameObjects.Zone;

  /** absent for boss levels - see LevelDef.bossLevel */
  private rival?: Phaser.Physics.Arcade.Sprite;
  private rivalState: ControllerState = createControllerState();
  private rivalAI: RivalAIState = createRivalAIState();
  private rivalStunTimer = 0;
  private rivalLastSafe = { x: 0, y: 0 };

  private lives = PLAYER_LIVES;
  private shields = 0;
  private coins = 0;
  private stompCombo = 0;
  private bestStompCombo = 0;
  private elapsed = 0;
  /** freeze item: enemies, pellets and the rival stop while > 0 */
  private freezeTimer = 0;
  private gameOver = false;
  private ready = false;
  private levelIndex = 0;

  private staticSolids!: Phaser.Physics.Arcade.StaticGroup;
  private movingPlatforms: MovingPlatformState[] = [];
  private coinSprites: Phaser.Physics.Arcade.Sprite[] = [];
  private enemies: PatrolEnemyState[] = [];
  private projectiles: Phaser.Physics.Arcade.Sprite[] = [];
  /** enemy (turret) fire */
  private pellets: Phaser.Physics.Arcade.Sprite[] = [];
  /** absent for boss levels; win condition there is defeating the boss */
  private goalSprite?: Phaser.Physics.Arcade.Sprite;

  private coinsText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private rivalPositionText!: Phaser.GameObjects.Text;
  private loadingText?: Phaser.GameObjects.Text;

  constructor() {
    super('PlatformerRun');
  }

  create(): void {
    const charId = this.registry.get(REGISTRY_KEY_CHARACTER) as string | undefined;
    this.character = CHARACTERS.find((c) => c.id === charId) ?? CHARACTERS[0];
    this.levelIndex = Phaser.Math.Clamp(Number(this.registry.get(REGISTRY_KEY_PLATFORMER_LEVEL_INDEX) ?? 0), 0, LEVELS.length - 1);
    this.level = LEVELS[this.levelIndex];
    this.coopMode = !!this.level.coop;

    // reset run state (scene instance is reused between attempts)
    this.heroes = [];
    this.p2 = undefined;
    this.cameraTarget = undefined;
    this.rivalState = createControllerState();
    this.rivalAI = createRivalAIState();
    this.rivalStunTimer = 0;
    this.lives = PLAYER_LIVES;
    this.shields = 0;
    this.coins = 0;
    this.stompCombo = 0;
    this.bestStompCombo = 0;
    this.elapsed = 0;
    this.freezeTimer = 0;
    this.gameOver = false;
    this.ready = false;
    this.movingPlatforms = [];
    this.coinSprites = [];
    this.enemies = [];
    this.projectiles = [];
    this.pellets = [];

    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.cameras.main.resetFX();
    // Pointers belong to the game, so retries must reuse them. Co-op on
    // one screen needs up to four simultaneous touches (move + jump each).
    if (this.input.manager.pointersTotal < 5) this.input.addPointer(5 - this.input.manager.pointersTotal);

    this.buildLevel();
    this.buildHud();
    this.buildControls();

    this.cameras.main.setBounds(0, 0, this.level.widthPx, HEIGHT);
    if (this.p2) {
      this.cameraTarget = this.add.zone(this.player.x, this.player.y, 1, 1);
      this.cameras.main.startFollow(this.cameraTarget, true, 1, 0);
    } else {
      this.cameras.main.startFollow(this.player, true, 1, 0);
    }

    this.rivalLastSafe = this.rival ? { x: this.rival.x, y: this.rival.y } : { x: 0, y: 0 };

    const unmountTuning = mountTuningPanel();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unmountTuning);

    void this.loadLoadout();
  }

  private async loadLoadout(): Promise<void> {
    const [perks, loadout] = await Promise.all([equippedPerks(), equippedLoadout()]);
    if (!this.scene.isActive()) return;
    this.shields = perks.shieldHits;
    this.lives = PLAYER_LIVES + perks.extraLives;
    const active = loadout.filter((row) => row.def.activeEffect);
    for (const hero of this.heroes) {
      hero.items = active.map((row) => ({ def: row.def, effect: row.def.activeEffect!, charges: row.def.activeEffect!.charges }));
      hero.selectedItem = 0;
      this.updateItemButton(hero);
    }
    this.updateHud();
    this.loadingText?.destroy();
    this.loadingText = undefined;
    this.ready = true;
  }

  // ---------------- level construction ----------------

  private buildLevel(): void {
    // extra headroom below the visible area so bodies aren't clamped before
    // the manual gap-death check (GAP_DEATH_Y) gets a chance to fire
    this.physics.world.setBounds(0, 0, this.level.widthPx, HEIGHT + 200);
    this.staticSolids = this.physics.add.staticGroup();

    for (const seg of this.level.ground) {
      // thin slab, not a full fill down to the screen bottom: a gap must
      // stay genuinely lethal, not catchable by a neighboring segment's
      // collision body if a fall drifts sideways into its x-range
      const tile = this.add.tileSprite(seg.x, this.level.groundY, seg.width, 56, 'platformTile').setOrigin(0, 0);
      this.physics.add.existing(tile, true);
      this.staticSolids.add(tile);
    }

    for (const p of this.level.platforms) {
      const tile = this.add.tileSprite(p.x, p.y, p.width, 20, 'platformTile').setOrigin(0, 0);
      this.physics.add.existing(tile, true);
      this.staticSolids.add(tile);
    }

    for (const mp of this.level.movingPlatforms) {
      const sprite = this.physics.add.sprite(mp.x, mp.y, 'platformTile');
      sprite.setOrigin(0, 0);
      sprite.setDisplaySize(mp.width, 20);
      const body = sprite.body as Phaser.Physics.Arcade.Body;
      body.setSize(mp.width, 20);
      body.setAllowGravity(false);
      body.setImmovable(true);
      this.movingPlatforms.push({ sprite, originX: mp.x, rangeX: mp.rangeX, speed: mp.speed, dir: 1, prevX: mp.x });
    }

    for (const c of this.level.coins) {
      const coin = this.physics.add.sprite(c.x, c.y, 'coin');
      (coin.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
      this.coinSprites.push(coin);
    }

    for (const e of this.level.enemies) {
      const def = enemyDef(e.type);
      const flies = !!def.airborne;
      const sprite = this.physics.add.sprite(e.x, e.y, def.textureKey).setOrigin(0.5, flies ? 0.5 : 1);
      const body = sprite.body as Phaser.Physics.Arcade.Body;
      body.setCollideWorldBounds(false);
      if (flies) {
        body.setAllowGravity(false);
      } else {
        body.setGravityY(GRAVITY_Y);
      }
      this.enemies.push({
        sprite,
        def,
        originX: e.x,
        rangeX: e.rangeX,
        dir: 1,
        alive: true,
        baseY: e.y,
        bobPhase: Math.random() * Math.PI * 2,
        health: def.maxHealth ?? 1,
        timer:
          def.bossKind === 'conductor' ? CONDUCTOR_HOVER_MS
          : def.movement === 'ghost' ? GHOST_SOLID_MS
          : def.movement === 'drop' ? 0
          : def.bossKind === 'slammer' ? SLAMMER_PATROL_MS
          : def.movement === 'boss' ? BOSS_PATROL_MS
          : def.movement === 'hop' ? HOPPER_HOP_INTERVAL_MS
          : TURRET_FIRE_INTERVAL_MS,
        bossPhase: def.bossKind === 'conductor' ? 'hover' : def.movement === 'boss' ? 'patrol' : undefined,
        phased: false,
        windup: 0,
        fireTimer: CONDUCTOR_FIRE_MS,
      });
    }

    if (this.level.goalX !== undefined && this.level.goalY !== undefined) {
      this.goalSprite = this.physics.add.sprite(this.level.goalX, this.level.goalY, 'goalFlag').setOrigin(0.5, 1);
      (this.goalSprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    } else {
      this.goalSprite = undefined;
    }

    const p1 = this.spawnHero(1, this.level.playerStart, this.character.color);
    this.player = p1.sprite;
    if (this.level.player2Start) {
      this.p2 = this.spawnHero(2, this.level.player2Start, P2_TINT).sprite;
    }

    if (this.level.rivalStart) {
      this.rival = this.physics.add.sprite(this.level.rivalStart.x, this.level.rivalStart.y, 'player').setOrigin(0.5, 1);
      this.rival.setTint(RIVAL_TINT);
      this.rival.setAlpha(0.92);
      const rivalBody = this.rival.body as Phaser.Physics.Arcade.Body;
      rivalBody.setGravityY(PHYS.gravityY);
      rivalBody.setCollideWorldBounds(false);
      this.physics.add.collider(this.rival, this.staticSolids);
      for (const mp of this.movingPlatforms) this.physics.add.collider(this.rival, mp.sprite);
    } else {
      this.rival = undefined;
    }

    for (const e of this.enemies) {
      if (!e.def.airborne) this.physics.add.collider(e.sprite, this.staticSolids);
      if (e.def.movement === 'ghost') e.sprite.setAlpha(0.9);
    }

    for (const hero of this.heroes) {
      this.physics.add.collider(hero.sprite, this.staticSolids);
      for (const mp of this.movingPlatforms) this.physics.add.collider(hero.sprite, mp.sprite);
      for (const coin of this.coinSprites) this.physics.add.overlap(hero.sprite, coin, () => this.collectCoin(coin));
      for (const e of this.enemies) this.physics.add.overlap(hero.sprite, e.sprite, () => this.resolveEnemyContact(hero, e));
      if (this.rival) this.physics.add.overlap(hero.sprite, this.rival, () => this.resolvePlayerRivalContact(hero));
      if (this.goalSprite) this.physics.add.overlap(hero.sprite, this.goalSprite, () => this.endLevel('playerWon'));
    }
    if (this.rival && this.goalSprite) {
      this.physics.add.overlap(this.rival, this.goalSprite, () => this.endLevel('rivalWon'));
    }

    for (const def of this.level.springs ?? []) {
      const pad = this.physics.add.staticImage(def.x, def.y, 'springPad').setOrigin(0.5, 1);
      pad.refreshBody();
      for (const hero of this.heroes) {
        this.physics.add.overlap(hero.sprite, pad, () => {
          if (this.launchFromSpring(hero.sprite, hero.ctrl, pad)) hero.pounding = false;
        });
      }
      if (this.rival) this.physics.add.overlap(this.rival, pad, () => this.launchFromSpring(this.rival!, this.rivalState, pad));
    }
  }

  /** running or landing on a pad launches you; returns whether it fired */
  private launchFromSpring(sprite: Phaser.Physics.Arcade.Sprite, ctrl: ControllerState, pad: Phaser.Physics.Arcade.Image): boolean {
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    if (body.velocity.y < 0) return false; // already on the way up
    body.setVelocityY(SPRING_VELOCITY);
    // a spring launch is not a jump: releasing the button mustn't cut it short
    ctrl.jumpCutApplied = true;
    ctrl.coyoteMs = 0;
    this.tweens.add({ targets: pad, scaleY: 0.55, duration: 70, yoyo: true });
    return true;
  }

  private spawnHero(slot: 1 | 2, at: { x: number; y: number }, tint: number): Hero {
    const sprite = this.physics.add.sprite(at.x, at.y, 'player').setOrigin(0.5, 1);
    sprite.setTint(tint);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setGravityY(PHYS.gravityY);
    body.setCollideWorldBounds(false);
    const hero: Hero = {
      slot,
      sprite,
      ctrl: createControllerState(),
      input: emptyInput(),
      invulnTimer: 0,
      stunTimer: 0,
      speedBoostTimer: 0,
      airJumpTimer: 0,
      airJumpsUsed: 0,
      magnetTimer: 0,
      pounding: false,
      lastCheckpoint: { x: at.x, y: at.y },
      items: [],
      selectedItem: 0,
    };
    this.heroes.push(hero);
    return hero;
  }

  // ---------------- HUD ----------------

  private buildHud(): void {
    const style = { fontSize: '15px', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', color: '#ffffff' };
    this.coinsText = this.add.text(16, 16, '🪙 0', style).setScrollFactor(0).setDepth(30);
    this.livesText = this.add.text(16, 40, `♥ ${this.lives}`, style).setScrollFactor(0).setDepth(30);
    this.timeText = this.add.text(WIDTH - 16, 16, '0.0s', style).setOrigin(1, 0).setScrollFactor(0).setDepth(30);
    this.comboText = this.add
      .text(WIDTH / 2, 16, '', { fontSize: '15px', fontFamily: 'system-ui, sans-serif', color: '#f9d64b', fontStyle: 'bold' })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(30);
    this.rivalPositionText = this.add
      .text(WIDTH / 2, 40, '', { fontSize: '13px', fontFamily: 'system-ui, sans-serif', color: '#94a3b8' })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(30);
    this.loadingText = this.add
      .text(WIDTH / 2, HEIGHT / 2, 'loading loadout…', { fontSize: '14px', fontFamily: 'system-ui, sans-serif', color: '#b7aed0' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(40);
    const pauseButton = this.add.rectangle(WIDTH - 42, 70, 64, 40, 0x362a52)
      .setScrollFactor(0).setDepth(30).setInteractive({ useHandCursor: true });
    this.add.text(WIDTH - 42, 70, 'PAUSE', { ...style, fontSize: '12px' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(31);
    pauseButton.on('pointerdown', () => this.pauseRun());
  }

  private updateHud(): void {
    this.coinsText.setText(`🪙 ${this.coins}`);
    this.livesText.setText(`♥ ${Math.max(0, this.lives)}${this.shields ? `  ⛨ ${this.shields}` : ''}`);
    this.timeText.setText(`${this.elapsed.toFixed(1)}s`);
    this.comboText.setText(
      this.freezeTimer > 0 ? `❄ frozen ${(this.freezeTimer / 1000).toFixed(1)}s` : this.stompCombo >= 2 ? `stomp x${this.stompCombo}` : '',
    );
    if (this.rival) {
      const ahead = this.player.x - this.rival.x;
      this.rivalPositionText.setText(ahead >= 0 ? `Rival: ahead by ${Math.round(ahead)}` : `Rival: behind by ${Math.round(-ahead)}`);
    } else {
      const boss = this.enemies.find((e) => e.def.movement === 'boss');
      const enraged = boss && boss.def.bossKind !== 'charger' && this.bossEnraged(boss);
      this.rivalPositionText.setText(boss && boss.alive ? `BOSS HP: ${boss.health} / ${boss.def.maxHealth}${enraged ? ' · ENRAGED' : ''}` : '');
    }
  }

  // ---------------- controls ----------------

  private buildControls(): void {
    if (this.coopMode) {
      this.buildTouchCluster(this.heroes[0], 0, 240);
      if (this.heroes[1]) this.buildTouchCluster(this.heroes[1], 240, 240);
      this.add.rectangle(WIDTH / 2, HEIGHT - 72, 2, 136, 0xffffff, 0.12).setScrollFactor(0).setDepth(30);
    } else {
      this.buildSoloTouchControls(this.heroes[0]);
    }
    this.buildKeyboard();
  }

  private holdZone(zone: Phaser.GameObjects.Shape, set: (down: boolean) => void): void {
    zone.on('pointerdown', () => set(true));
    zone.on('pointerup', () => set(false));
    zone.on('pointerout', () => set(false));
  }

  private buildSoloTouchControls(hero: Hero): void {
    const zoneAlpha = 0.16;
    const leftZone = this.add.rectangle(70, HEIGHT - 74, 90, 90, 0xffffff, zoneAlpha).setScrollFactor(0).setDepth(30).setInteractive();
    const rightZone = this.add.rectangle(170, HEIGHT - 74, 90, 90, 0xffffff, zoneAlpha).setScrollFactor(0).setDepth(30).setInteractive();
    this.add.text(70, HEIGHT - 74, '◀', { fontSize: '26px', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0).setDepth(31);
    this.add.text(170, HEIGHT - 74, '▶', { fontSize: '26px', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0).setDepth(31);
    this.holdZone(leftZone, (d) => { hero.input.touchLeft = d; });
    this.holdZone(rightZone, (d) => { hero.input.touchRight = d; });

    const jumpBtn = this.add.circle(WIDTH - 70, HEIGHT - 74, 55, COLORS.accent, 0.32).setScrollFactor(0).setDepth(30).setInteractive();
    this.add.text(WIDTH - 70, HEIGHT - 74, 'JUMP', { fontSize: '13px', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0).setDepth(31);
    this.bindJump(jumpBtn, hero);

    this.buildItemButtons(hero, WIDTH - 70, HEIGHT - 150, 38, WIDTH - 140, HEIGHT - 176, 0x38bdf8);
  }

  /**
   * One player's half of the split co-op screen, all kept below the
   * ground line so nothing covers the players: ◀ ▶ JUMP on the bottom
   * row, item + swap + player tag on the ground slab above it.
   */
  private buildTouchCluster(hero: Hero, originX: number, width: number): void {
    const tint = hero.slot === 1 ? this.character.color : P2_TINT;
    const y = HEIGHT - 58;
    const left = this.add.rectangle(originX + 40, y, 70, 76, tint, 0.16).setScrollFactor(0).setDepth(30).setInteractive();
    const right = this.add.rectangle(originX + 116, y, 70, 76, tint, 0.16).setScrollFactor(0).setDepth(30).setInteractive();
    this.add.text(originX + 40, y, '◀', { fontSize: '24px', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0).setDepth(31);
    this.add.text(originX + 116, y, '▶', { fontSize: '24px', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0).setDepth(31);
    this.holdZone(left, (d) => { hero.input.touchLeft = d; });
    this.holdZone(right, (d) => { hero.input.touchRight = d; });

    const jumpX = originX + width - 42;
    const jumpBtn = this.add.circle(jumpX, y, 37, tint, 0.3).setScrollFactor(0).setDepth(30).setInteractive();
    this.add.text(jumpX, y, 'JUMP', { fontSize: '12px', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0).setDepth(31);
    this.bindJump(jumpBtn, hero);

    this.add.text(jumpX, HEIGHT - 128, `P${hero.slot}`, { fontSize: '13px', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5).setAlpha(0.7).setScrollFactor(0).setDepth(31);
    this.buildItemButtons(hero, originX + 40, HEIGHT - 128, 24, originX + 98, HEIGHT - 128, tint);
  }

  private bindJump(btn: Phaser.GameObjects.Shape, hero: Hero): void {
    btn.on('pointerdown', () => { hero.input.touchJump = true; hero.input.pendingJump = true; });
    btn.on('pointerup', () => { hero.input.touchJump = false; });
    btn.on('pointerout', () => { hero.input.touchJump = false; });
  }

  private buildItemButtons(hero: Hero, x: number, y: number, r: number, swapX: number, swapY: number, color: number): void {
    const bg = this.add.circle(x, y, r, color, 0.28).setScrollFactor(0).setDepth(30).setInteractive();
    const label = this.add.text(x, y, '—', { fontSize: r > 30 ? '22px' : '18px' }).setOrigin(0.5).setScrollFactor(0).setDepth(31);
    const charges = this.add
      .text(x + r * 0.7, y + r * 0.7, '', { fontSize: '11px', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(32);
    bg.on('pointerdown', () => { hero.input.pendingItem = true; });
    hero.itemButton = { bg, label, charges };

    const swapBg = this.add.circle(swapX, swapY, 20, 0xffffff, 0.14).setScrollFactor(0).setDepth(30).setInteractive();
    const swapLabel = this.add.text(swapX, swapY, '⇄', { fontSize: '16px', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0).setDepth(31);
    swapBg.on('pointerdown', () => { hero.input.pendingSwap = true; });
    hero.swapButton = { bg: swapBg, label: swapLabel };
    this.updateItemButton(hero);
  }

  /**
   * Solo: WASD or arrows, W/Up/Space jump, F item, Q swap.
   * Co-op: P1 WASD (+Space jump, F item, Q swap); P2 arrows
   * (/ or Enter item, . swap).
   */
  private buildKeyboard(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    const bindings = (key: string): { hero: Hero; action: 'left' | 'right' | 'jump' | 'item' | 'swap' } | undefined => {
      const p1 = this.heroes[0];
      const p2 = this.heroes[1];
      const arrowsToP1 = !this.coopMode;
      switch (key) {
        case 'a': return { hero: p1, action: 'left' };
        case 'd': return { hero: p1, action: 'right' };
        case 'w':
        case ' ': return { hero: p1, action: 'jump' };
        case 'f': return { hero: p1, action: 'item' };
        case 'q': return { hero: p1, action: 'swap' };
        case 'arrowleft': return arrowsToP1 ? { hero: p1, action: 'left' } : p2 && { hero: p2, action: 'left' };
        case 'arrowright': return arrowsToP1 ? { hero: p1, action: 'right' } : p2 && { hero: p2, action: 'right' };
        case 'arrowup': return arrowsToP1 ? { hero: p1, action: 'jump' } : p2 && { hero: p2, action: 'jump' };
        case '/':
        case 'enter': return p2 && { hero: p2, action: 'item' };
        case '.': return p2 && { hero: p2, action: 'swap' };
        default: return undefined;
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'escape' && !e.repeat) { this.pauseRun(); return; }
      const b = bindings(key);
      if (!b) return;
      const input = b.hero.input;
      if (b.action === 'left') input.keyLeft = true;
      else if (b.action === 'right') input.keyRight = true;
      else if (b.action === 'jump' && !input.keyJump) { input.keyJump = true; input.pendingJump = true; }
      else if (b.action === 'item' && !e.repeat) input.pendingItem = true;
      else if (b.action === 'swap' && !e.repeat) input.pendingSwap = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const b = bindings(e.key.toLowerCase());
      if (!b) return;
      if (b.action === 'left') b.hero.input.keyLeft = false;
      else if (b.action === 'right') b.hero.input.keyRight = false;
      else if (b.action === 'jump') b.hero.input.keyJump = false;
    };
    kb.on('keydown', onKeyDown);
    kb.on('keyup', onKeyUp);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      kb.off('keydown', onKeyDown);
      kb.off('keyup', onKeyUp);
    });
  }

  private pauseRun(): void {
    if (!this.ready || this.gameOver || !this.scene.isActive()) return;
    // Key/pointer releases can happen while the scene is paused.
    for (const hero of this.heroes) hero.input = emptyInput();
    this.scene.launch('PlatformerPause');
    this.scene.pause();
  }

  // ---------------- items ----------------

  private currentItem(hero: Hero): ItemSlot | undefined {
    return hero.items[hero.selectedItem];
  }

  private updateItemButton(hero: Hero): void {
    const btn = hero.itemButton;
    if (!btn) return;
    const item = this.currentItem(hero);
    const has = !!item && item.charges > 0;
    btn.bg.setAlpha(has ? 0.5 : 0.12);
    btn.label.setAlpha(has ? 1 : 0.4);
    btn.label.setText(item ? ITEM_ICON[item.effect.kind] : '—');
    btn.charges.setText(item ? `×${item.charges}` : '');
    const canSwap = hero.items.length > 1;
    hero.swapButton?.bg.setVisible(canSwap);
    hero.swapButton?.label.setVisible(canSwap);
  }

  /** cycle to the next carried item, preferring ones with charges left */
  private swapItem(hero: Hero): void {
    const n = hero.items.length;
    if (n < 2) return;
    for (let step = 1; step <= n; step++) {
      const i = (hero.selectedItem + step) % n;
      if (hero.items[i].charges > 0 || step === n) {
        hero.selectedItem = i;
        break;
      }
    }
    this.updateItemButton(hero);
  }

  private useItem(hero: Hero): void {
    const item = this.currentItem(hero);
    if (!item || item.charges <= 0 || this.gameOver) return;
    const effect = item.effect;
    item.charges -= 1;

    switch (effect.kind) {
      case 'shieldBurst':
        hero.invulnTimer = Math.max(hero.invulnTimer, effect.invulnMs);
        this.cameras.main.flash(140, 56, 189, 248);
        break;
      case 'speedBurst':
        hero.speedBoostTimer = Math.max(hero.speedBoostTimer, effect.boostMs);
        this.cameras.main.flash(140, 250, 204, 21);
        break;
      case 'extraLife':
        this.lives += 1;
        this.cameras.main.flash(160, 249, 214, 75);
        break;
      case 'projectile':
        this.spawnProjectile(hero);
        break;
      case 'freeze':
        this.startFreeze(effect.freezeMs);
        break;
      case 'magnet':
        hero.magnetTimer = Math.max(hero.magnetTimer, effect.magnetMs);
        this.cameras.main.flash(120, 250, 204, 21);
        break;
      case 'doubleJump':
        hero.airJumpTimer = Math.max(hero.airJumpTimer, effect.windowMs);
        this.cameras.main.flash(120, 110, 231, 183);
        break;
      case 'groundPound':
        this.startGroundPound(hero);
        break;
    }
    if (item.charges <= 0) this.swapItem(hero);
    this.updateItemButton(hero);
  }

  private startFreeze(ms: number): void {
    this.freezeTimer = Math.max(this.freezeTimer, ms);
    for (const p of this.pellets) if (p.active) p.destroy();
    this.pellets = [];
    for (const e of this.enemies) {
      if (!e.alive) continue;
      (e.sprite.body as Phaser.Physics.Arcade.Body).setVelocityX(0);
      e.sprite.setTint(FROZEN_TINT);
    }
    this.rival?.setTint(FROZEN_TINT);
    this.cameras.main.flash(180, 147, 197, 253);
  }

  private endFreeze(): void {
    for (const e of this.enemies) if (e.alive) e.sprite.clearTint();
    if (this.rival) this.rival.setTint(this.rivalStunTimer > 0 ? 0x475569 : RIVAL_TINT);
  }

  private startGroundPound(hero: Hero): void {
    const body = hero.sprite.body as Phaser.Physics.Arcade.Body;
    if (body.blocked.down || body.touching.down) {
      this.poundShockwave(hero);
      return;
    }
    hero.pounding = true;
    body.setVelocity(0, GROUND_POUND_SPEED);
  }

  /** landing a ground pound hits everything nearby - the one reliable answer to a spiker */
  private poundShockwave(hero: Hero): void {
    hero.pounding = false;
    const x = hero.sprite.x;
    const y = hero.sprite.y;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (Math.abs(e.sprite.x - x) <= GROUND_POUND_RADIUS_X && Math.abs(e.sprite.y - y) <= GROUND_POUND_RADIUS_Y) {
        this.damageEnemy(e, 1, hero);
      }
    }
    if (this.rival && this.rivalStunTimer <= 0 &&
        Math.abs(this.rival.x - x) <= GROUND_POUND_RADIUS_X && Math.abs(this.rival.y - y) <= GROUND_POUND_RADIUS_Y) {
      this.stunRival(hero);
    }
    const ring = this.add.ellipse(x, y - 6, 40, 14).setStrokeStyle(4, 0xfacc15, 0.9).setDepth(20);
    this.tweens.add({
      targets: ring,
      scaleX: (GROUND_POUND_RADIUS_X * 2) / 40,
      scaleY: 2.4,
      alpha: 0,
      duration: 260,
      onComplete: () => ring.destroy(),
    });
    this.cameras.main.shake(140, 0.008);
  }

  // ---------------- update loop ----------------

  update(time: number, deltaMs: number): void {
    if (this.gameOver || !this.ready) return;
    if (this.applyGamepads(time)) return;
    const dt = Math.min(deltaMs, 50);
    this.elapsed += dt / 1000;

    if (this.rivalStunTimer > 0) this.rivalStunTimer = Math.max(0, this.rivalStunTimer - dt);
    if (this.freezeTimer > 0) {
      this.freezeTimer = Math.max(0, this.freezeTimer - dt);
      if (this.freezeTimer === 0) this.endFreeze();
    }

    for (const hero of this.heroes) this.updateHero(hero, dt);

    if (this.rival) {
      const held = this.rivalStunTimer > 0 || this.freezeTimer > 0;
      const rivalInput = computeRivalInput(this.rival.x, this.level.rivalWaypoints ?? [], this.rivalAI, held, dt);
      const rivalBody = this.rival.body as Phaser.Physics.Arcade.Body;
      updateController(rivalBody, rivalInput, this.rivalState, { moveSpeed: PHYS.rivalMoveSpeed, moveAccel: PHYS.moveAccel }, dt);
      applyHeroGravity(rivalBody);
      this.rival.setFlipX(rivalBody.velocity.x < -5 ? true : rivalBody.velocity.x > 5 ? false : this.rival.flipX);
    }

    this.updatePatrolEnemies(dt);
    this.updateProjectiles();
    this.updateMagnets();
    this.updateMovingPlatforms();
    this.updateCoopCamera();
    this.checkCheckpointsAndGaps();
    this.updateHud();
  }

  /**
   * Controller: stick/D-pad move, A jump (hold for height), X/B/RT item,
   * Y/LB/RB swap, Menu pause. Solo: every pad drives player one. Co-op:
   * the first pad is P1, the second P2 (a lone pad leaves P2 on the
   * arrow keys). Returns true when it paused the run.
   */
  private applyGamepads(time: number): boolean {
    const pads = readPads(time);
    if (pads.length === 0) {
      for (const hero of this.heroes) {
        hero.input.padLeft = hero.input.padRight = hero.input.padJump = false;
        hero.padIndex = undefined;
      }
      return false;
    }
    if (pads.some((p) => p.pressed.menu)) {
      this.pauseRun();
      return true;
    }
    for (const hero of this.heroes) {
      const own = this.coopMode ? pads.filter((_, i) => i === hero.slot - 1) : pads;
      const { held, pressed } = mergePads(own);
      hero.padIndex = own[0]?.index;
      hero.input.padLeft = held.left;
      hero.input.padRight = held.right;
      hero.input.padJump = held.a;
      if (pressed.a) hero.input.pendingJump = true;
      if (pressed.x || pressed.b || pressed.rt) hero.input.pendingItem = true;
      if (pressed.y || pressed.lb || pressed.rb) hero.input.pendingSwap = true;
    }
    return false;
  }

  private buzz(hero: Hero, ms = 140, strength = 0.6): void {
    if (hero.padIndex !== undefined) rumble(hero.padIndex, ms, strength);
  }

  private updateHero(hero: Hero, dt: number): void {
    hero.invulnTimer = Math.max(0, hero.invulnTimer - dt);
    hero.stunTimer = Math.max(0, hero.stunTimer - dt);
    hero.speedBoostTimer = Math.max(0, hero.speedBoostTimer - dt);
    hero.airJumpTimer = Math.max(0, hero.airJumpTimer - dt);
    hero.magnetTimer = Math.max(0, hero.magnetTimer - dt);

    const input = hero.input;
    if (input.pendingSwap) { this.swapItem(hero); input.pendingSwap = false; }
    if (input.pendingItem) { this.useItem(hero); input.pendingItem = false; }

    const body = hero.sprite.body as Phaser.Physics.Arcade.Body;
    const grounded = body.blocked.down || body.touching.down;
    let jumpPressed = input.pendingJump;
    input.pendingJump = false;

    if (hero.pounding) {
      if (grounded) {
        this.poundShockwave(hero);
      } else {
        body.setVelocity(0, GROUND_POUND_SPEED);
        return;
      }
    }

    if (grounded) hero.airJumpsUsed = 0;
    if (jumpPressed && hero.stunTimer <= 0 && !grounded && hero.ctrl.coyoteMs <= 0 && hero.airJumpTimer > 0 && hero.airJumpsUsed < 1) {
      body.setVelocityY(PHYS.jumpVelocity * AIR_JUMP_VELOCITY_SCALE);
      hero.ctrl.jumpCutApplied = false;
      hero.airJumpsUsed += 1;
      jumpPressed = false; // consumed - must not also buffer a jump for landing
    }

    const controllerInput: ControllerInput =
      hero.stunTimer > 0
        ? { left: false, right: false, jumpPressed: false, jumpHeld: false }
        : {
            left: input.touchLeft || input.keyLeft || input.padLeft,
            right: input.touchRight || input.keyRight || input.padRight,
            jumpPressed,
            jumpHeld: input.touchJump || input.keyJump || input.padJump,
          };
    const moveSpeed = hero.speedBoostTimer > 0 ? PHYS.moveSpeed * SPEED_BOOST_MULTIPLIER : PHYS.moveSpeed;
    updateController(body, controllerInput, hero.ctrl, { moveSpeed, moveAccel: PHYS.moveAccel }, dt);
    applyHeroGravity(body);

    hero.sprite.setFlipX(body.velocity.x < -5 ? true : body.velocity.x > 5 ? false : hero.sprite.flipX);
    hero.sprite.setAlpha(hero.invulnTimer > 0 && Math.floor(hero.invulnTimer / 80) % 2 === 0 ? 0.4 : 1);
  }

  /** co-op: camera sits between the two players, and neither may walk out of frame */
  private updateCoopCamera(): void {
    if (!this.cameraTarget || this.heroes.length < 2) return;
    const cam = this.cameras.main;
    const minX = cam.scrollX + COOP_VIEW_MARGIN_PX;
    const maxX = cam.scrollX + WIDTH - COOP_VIEW_MARGIN_PX;
    for (const hero of this.heroes) {
      const body = hero.sprite.body as Phaser.Physics.Arcade.Body;
      if (hero.sprite.x < minX) {
        hero.sprite.x = minX;
        if (body.velocity.x < 0) body.setVelocityX(0);
      } else if (hero.sprite.x > maxX) {
        hero.sprite.x = maxX;
        if (body.velocity.x > 0) body.setVelocityX(0);
      }
    }
    const [a, b] = this.heroes;
    this.cameraTarget.setPosition((a.sprite.x + b.sprite.x) / 2, (a.sprite.y + b.sprite.y) / 2);
  }

  /** co-op's slower pace scales enemy/boss speed down; everywhere else this is a no-op (factor 1) */
  private paced(baseSpeed: number): number {
    return baseSpeed * (this.level.paceMultiplier ?? 1);
  }

  private nearestHero(x: number): Hero {
    return this.heroes.reduce((best, h) => (Math.abs(h.sprite.x - x) < Math.abs(best.sprite.x - x) ? h : best), this.heroes[0]);
  }

  private updatePatrolEnemies(dt: number): void {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const body = e.sprite.body as Phaser.Physics.Arcade.Body;
      if (this.freezeTimer > 0) {
        if (e.def.airborne) body.setVelocity(0, 0);
        else body.setVelocityX(0);
        continue;
      }
      switch (e.def.movement) {
        case 'boss':
          if (e.def.bossKind === 'slammer') this.updateSlammer(e, dt);
          else if (e.def.bossKind === 'conductor') this.updateConductor(e, dt);
          else this.updateBoss(e, dt);
          break;
        case 'chase':
          this.updateChaser(e, body);
          break;
        case 'ghost':
          this.updateGhost(e, body, dt);
          break;
        case 'drop':
          this.updateDropper(e, body, dt);
          break;
        case 'turret':
          this.updateTurret(e, dt);
          break;
        case 'hop':
          this.walkPatrol(e, body, 0.8);
          e.timer -= dt;
          if (e.timer <= 0 && (body.blocked.down || body.touching.down)) {
            body.setVelocityY(HOPPER_HOP_VELOCITY);
            e.timer = HOPPER_HOP_INTERVAL_MS;
          }
          break;
        case 'fly':
          this.walkPatrol(e, body, 1);
          e.bobPhase += (dt / 1000) * FLYER_BOB_SPEED;
          e.sprite.setY(e.baseY + Math.sin(e.bobPhase) * FLYER_BOB_HEIGHT);
          break;
        case 'walk':
        default:
          this.walkPatrol(e, body, e.def.spiky ? 0.7 : 1);
          break;
      }
    }
  }

  private walkPatrol(e: PatrolEnemyState, body: Phaser.Physics.Arcade.Body, speedScale: number): void {
    if (e.sprite.x >= e.originX + e.rangeX) e.dir = -1;
    else if (e.sprite.x <= e.originX) e.dir = 1;
    body.setVelocityX(e.dir * this.paced(ENEMY_PATROL_SPEED * speedScale));
    e.sprite.setFlipX(e.dir < 0);
  }

  /** walks its strip until a hero comes close, then charges - but never leaves the strip (no suicide runs into pits) */
  private updateChaser(e: PatrolEnemyState, body: Phaser.Physics.Arcade.Body): void {
    const target = this.nearestHero(e.sprite.x);
    const dx = target.sprite.x - e.sprite.x;
    if (Math.abs(dx) > CHASER_RANGE_PX || Math.abs(target.sprite.y - e.sprite.y) > 140) {
      e.sprite.clearTint();
      this.walkPatrol(e, body, 0.6);
      return;
    }
    const dir = dx < 0 ? -1 : 1;
    const blocked = (dir < 0 && e.sprite.x <= e.originX) || (dir > 0 && e.sprite.x >= e.originX + e.rangeX);
    body.setVelocityX(blocked ? 0 : dir * this.paced(ENEMY_PATROL_SPEED * CHASER_SPEED_SCALE));
    e.dir = dir;
    e.sprite.setFlipX(dir < 0);
    e.sprite.setTint(0xfecaca);
  }

  /** drifts after the nearest hero inside its box, fading in and out on a fixed cycle */
  private updateGhost(e: PatrolEnemyState, body: Phaser.Physics.Arcade.Body, dt: number): void {
    e.timer -= dt;
    if (e.timer <= 0) {
      e.phased = !e.phased;
      e.timer = e.phased ? GHOST_FADED_MS : GHOST_SOLID_MS;
      this.tweens.add({ targets: e.sprite, alpha: e.phased ? 0.2 : 0.9, duration: 250 });
    }
    const target = this.nearestHero(e.sprite.x);
    const chasing = Math.abs(target.sprite.x - e.sprite.x) < GHOST_RANGE_PX;
    const tx = chasing ? target.sprite.x : e.originX + e.rangeX / 2;
    const ty = chasing ? target.sprite.y - 50 : e.baseY;
    const clampedX = Phaser.Math.Clamp(tx, e.originX, e.originX + e.rangeX);
    const clampedY = Phaser.Math.Clamp(ty, e.baseY - 60, e.baseY + 60);
    const dx = clampedX - e.sprite.x;
    const dy = clampedY - e.sprite.y;
    const d = Math.hypot(dx, dy);
    const speed = this.paced(GHOST_DRIFT_SPEED);
    if (d < 3) body.setVelocity(0, 0);
    else body.setVelocity((dx / d) * speed, (dy / d) * speed);
    e.sprite.setFlipX(dx < 0);
  }

  /** hovers along its strip; flashes, then drops a bomb, when a hero passes underneath */
  private updateDropper(e: PatrolEnemyState, body: Phaser.Physics.Arcade.Body, dt: number): void {
    e.bobPhase += (dt / 1000) * FLYER_BOB_SPEED;
    e.sprite.setY(e.baseY + Math.sin(e.bobPhase) * 8);
    if ((e.windup ?? 0) > 0) {
      body.setVelocityX(0);
      e.windup = (e.windup ?? 0) - dt;
      if (e.windup <= 0) {
        e.windup = 0;
        e.timer = DROPPER_RELOAD_MS / (this.level.paceMultiplier ?? 1);
        e.sprite.clearTint();
        this.spawnHazard(e.sprite.x, e.sprite.y + 20, 'bomb', 0, BOMB_LIFESPAN_MS, true, 40, GRAVITY_Y * 0.7);
      }
      return;
    }
    this.walkPatrol(e, body, 0.8);
    e.timer -= dt;
    const heroBelow = this.heroes.some((h) => Math.abs(h.sprite.x - e.sprite.x) < DROPPER_TRIGGER_PX && h.sprite.y > e.sprite.y);
    if (e.timer <= 0 && heroBelow) {
      e.windup = DROPPER_TELEGRAPH_MS;
      e.sprite.setTint(0xfca5a5);
    }
  }

  /** stands still, faces the nearest hero, and fires a slow pellet when one is in range */
  private updateTurret(e: PatrolEnemyState, dt: number): void {
    const target = this.nearestHero(e.sprite.x);
    const dx = target.sprite.x - e.sprite.x;
    e.sprite.setFlipX(dx < 0);
    e.timer -= dt;
    if (e.timer > 0 || Math.abs(dx) > TURRET_RANGE_PX) return;
    e.timer = TURRET_FIRE_INTERVAL_MS / (this.level.paceMultiplier ?? 1);
    const dir = dx < 0 ? -1 : 1;
    this.spawnHazard(e.sprite.x + dir * 22, e.sprite.y - 26, 'pellet', dir * this.paced(PELLET_SPEED), PELLET_LIFESPAN_MS, true);
  }

  /**
   * Enemy fire that hurts heroes on contact: turret pellets, slammer
   * shockwaves, dropper bombs, conductor bolts. Lives in `pellets`, so a
   * freeze clears it all at once.
   */
  private spawnHazard(
    x: number, y: number, texture: string, vx: number, lifespanMs: number, stopsOnSolids: boolean, vy = 0, gravityY = 0,
  ): Phaser.Physics.Arcade.Sprite {
    const hazard = this.physics.add.sprite(x, y, texture);
    const body = hazard.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(gravityY > 0);
    if (gravityY > 0) body.setGravityY(gravityY);
    body.setVelocity(vx, vy);
    hazard.setFlipX(vx < 0);
    this.pellets.push(hazard);
    for (const hero of this.heroes) {
      this.physics.add.overlap(hero.sprite, hazard, () => this.hitHeroWithPellet(hero, hazard));
    }
    if (stopsOnSolids) this.physics.add.collider(hazard, this.staticSolids, () => hazard.destroy());
    this.time.delayedCall(lifespanMs, () => { if (hazard.active) hazard.destroy(); });
    return hazard;
  }

  private bossEnraged(e: PatrolEnemyState): boolean {
    return e.health <= (e.def.maxHealth ?? 1) / 2;
  }

  /**
   * patrol -> telegraph (crouch + flash) -> leap (arcs onto the nearest
   * player's x) -> slam: shockwaves both ways -> stunned (the stomp
   * window; harmless to touch) -> patrol. A hit hops it clear into
   * 'recover', so each window is worth one hit.
   */
  private updateSlammer(e: PatrolEnemyState, dt: number): void {
    const body = e.sprite.body as Phaser.Physics.Arcade.Body;
    const grounded = body.blocked.down || body.touching.down;
    e.timer -= dt;

    switch (e.bossPhase) {
      case 'telegraph':
        if (e.timer <= 0) {
          const target = this.nearestHero(e.sprite.x);
          const landX = Phaser.Math.Clamp(target.sprite.x, e.originX, e.originX + e.rangeX);
          const airtime = (2 * -SLAMMER_LEAP_VELOCITY) / GRAVITY_Y;
          const vx = Phaser.Math.Clamp((landX - e.sprite.x) / airtime, -SLAMMER_MAX_LEAP_VX, SLAMMER_MAX_LEAP_VX);
          e.bossPhase = 'leap';
          e.timer = 0; // counts up while airborne, so takeoff isn't mistaken for landing
          e.sprite.clearTint();
          e.sprite.setFlipX(vx < 0);
          body.setVelocity(vx, SLAMMER_LEAP_VELOCITY);
        }
        break;
      case 'leap':
        e.timer += 2 * dt; // undo the countdown above: elapsed airtime
        if (grounded && e.timer > 150) this.slam(e);
        break;
      case 'stunned':
        body.setVelocityX(0);
        if (e.timer <= 0) {
          e.bossPhase = 'patrol';
          e.timer = this.slammerPatrolMs(e);
          e.sprite.setAngle(0);
        } else {
          e.sprite.setAngle(Math.sin(e.timer / 60) * 8); // dizzy wobble
        }
        break;
      case 'recover':
        e.timer += 2 * dt;
        if (grounded && e.timer > 150) {
          body.setVelocityX(0);
          e.bossPhase = 'patrol';
          e.timer = this.slammerPatrolMs(e);
        }
        break;
      case 'patrol':
      default:
        this.walkPatrol(e, body, this.bossEnraged(e) ? 1.4 : 1);
        if (e.timer <= 0 && grounded) {
          e.bossPhase = 'telegraph';
          e.timer = SLAMMER_TELEGRAPH_MS;
          body.setVelocityX(0);
          e.sprite.setTint(0xffffff);
        }
        break;
    }
  }

  /** fly toward (x, y) at up to `speed`, easing in; true once within a few px */
  private flyToward(e: PatrolEnemyState, x: number, y: number, speed: number): boolean {
    const body = e.sprite.body as Phaser.Physics.Arcade.Body;
    const dx = x - e.sprite.x;
    const dy = y - e.sprite.y;
    const d = Math.hypot(dx, dy);
    if (d < 6) {
      body.setVelocity(0, 0);
      return true;
    }
    const v = Math.min(speed, d * 6);
    body.setVelocity((dx / d) * v, (dy / d) * v);
    return false;
  }

  /**
   * hover (tracks the nearest player out of jump reach, firing aimed
   * bolts) -> telegraph (flash) -> dive onto that spot -> perched (the
   * stomp window; harmless to touch) -> recover (rises; immune) -> hover.
   * Springs in its arena let a player stomp it mid-hover too.
   */
  private updateConductor(e: PatrolEnemyState, dt: number): void {
    const body = e.sprite.body as Phaser.Physics.Arcade.Body;
    const pace = this.level.paceMultiplier ?? 1;
    e.timer -= dt;
    const target = this.nearestHero(e.sprite.x);
    const clampX = (x: number) => Phaser.Math.Clamp(x, e.originX, e.originX + e.rangeX);

    switch (e.bossPhase) {
      case 'telegraph':
        body.setVelocity(0, 0);
        if (e.timer <= 0) {
          e.bossPhase = 'dive';
          e.diveX = clampX(target.sprite.x);
          e.sprite.clearTint();
        }
        break;
      case 'dive':
        if (this.flyToward(e, e.diveX ?? e.sprite.x, CONDUCTOR_PERCH_Y, this.paced(CONDUCTOR_DIVE_SPEED))) {
          e.bossPhase = 'perched';
          e.timer = CONDUCTOR_PERCH_MS / pace;
          this.cameras.main.shake(140, 0.008);
        }
        break;
      case 'perched':
        body.setVelocity(0, 0);
        e.sprite.setAngle(Math.sin(e.timer / 60) * 8);
        if (e.timer <= 0) {
          e.bossPhase = 'recover';
          e.timer = 0;
          e.sprite.setAngle(0);
        }
        break;
      case 'recover':
        if (this.flyToward(e, e.sprite.x, CONDUCTOR_HOVER_Y, CONDUCTOR_RISE_SPEED) && e.timer <= 0) {
          e.bossPhase = 'hover';
          e.timer = CONDUCTOR_HOVER_MS * (this.bossEnraged(e) ? 0.7 : 1) / pace;
          e.fireTimer = CONDUCTOR_FIRE_MS;
        }
        break;
      case 'hover':
      default: {
        this.flyToward(e, clampX(target.sprite.x), CONDUCTOR_HOVER_Y, this.paced(CONDUCTOR_HOVER_SPEED));
        e.sprite.setFlipX(target.sprite.x < e.sprite.x);
        e.fireTimer = (e.fireTimer ?? 0) - dt;
        if (e.fireTimer <= 0) {
          e.fireTimer = (this.bossEnraged(e) ? CONDUCTOR_ENRAGED_FIRE_MS : CONDUCTOR_FIRE_MS) / pace;
          this.fireBolts(e, target);
        }
        if (e.timer <= 0) {
          e.bossPhase = 'telegraph';
          e.timer = CONDUCTOR_TELEGRAPH_MS;
          e.sprite.setTint(0xffffff);
        }
        break;
      }
    }
  }

  /** one aimed bolt; a three-bolt fan once enraged */
  private fireBolts(e: PatrolEnemyState, target: Hero): void {
    const fromY = e.sprite.y + 30;
    const aim = Math.atan2(target.sprite.y - 37 - fromY, target.sprite.x - e.sprite.x);
    const spreads = this.bossEnraged(e) ? [-0.28, 0, 0.28] : [0];
    const speed = this.paced(BOLT_SPEED);
    for (const s of spreads) {
      this.spawnHazard(e.sprite.x, fromY, 'bolt', Math.cos(aim + s) * speed, BOLT_LIFESPAN_MS, true, Math.sin(aim + s) * speed);
    }
  }

  private slammerPatrolMs(e: PatrolEnemyState): number {
    return SLAMMER_PATROL_MS * (this.bossEnraged(e) ? SLAMMER_ENRAGE_PATROL_SCALE : 1) / (this.level.paceMultiplier ?? 1);
  }

  private slam(e: PatrolEnemyState): void {
    const body = e.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(0);
    e.bossPhase = 'stunned';
    e.timer = SLAMMER_STUN_MS / (this.level.paceMultiplier ?? 1);
    const speed = this.paced(SHOCKWAVE_SPEED) * (this.bossEnraged(e) ? 1.25 : 1);
    for (const dir of [-1, 1]) {
      this.spawnHazard(e.sprite.x + dir * 40, e.sprite.y, 'shockwave', dir * speed, SHOCKWAVE_LIFESPAN_MS, false).setOrigin(0.5, 1);
    }
    this.cameras.main.shake(180, 0.01);
    for (const hero of this.heroes) this.buzz(hero, 180, 0.4);
  }

  private hitHeroWithPellet(hero: Hero, pellet: Phaser.Physics.Arcade.Sprite): void {
    if (!pellet.active || this.gameOver) return;
    pellet.destroy();
    if (hero.invulnTimer > 0) return;
    this.takeDamage(hero, 1);
  }

  /** patrol -> telegraph (pause + flash) -> charge (fast dash at the nearest player) -> cooldown -> repeat */
  private updateBoss(e: PatrolEnemyState, dt: number): void {
    const body = e.sprite.body as Phaser.Physics.Arcade.Body;
    e.timer -= dt;

    switch (e.bossPhase) {
      case 'telegraph':
        if (e.timer <= 0) {
          e.bossPhase = 'charge';
          e.timer = BOSS_CHARGE_MS;
          const target = this.nearestHero(e.sprite.x);
          const toward = target.sprite.x < e.sprite.x ? -1 : 1;
          e.dir = toward;
          e.sprite.setFlipX(toward < 0);
          body.setVelocityX(toward * this.paced(e.def.chargeSpeed ?? ENEMY_PATROL_SPEED));
        }
        break;
      case 'charge':
        if (e.timer <= 0 || e.sprite.x <= e.originX || e.sprite.x >= e.originX + e.rangeX) {
          e.bossPhase = 'cooldown';
          e.timer = BOSS_COOLDOWN_MS;
          body.setVelocityX(0);
          e.sprite.clearTint();
        }
        break;
      case 'cooldown':
        body.setVelocityX(0);
        if (e.timer <= 0) {
          e.bossPhase = 'patrol';
          e.timer = BOSS_PATROL_MS;
        }
        break;
      case 'patrol':
      default:
        this.walkPatrol(e, body, 1);
        if (e.timer <= 0) {
          e.bossPhase = 'telegraph';
          e.timer = BOSS_TELEGRAPH_MS;
          body.setVelocityX(0);
          e.sprite.setTint(0xffffff);
        }
        break;
    }
  }

  private updateProjectiles(): void {
    this.projectiles = this.projectiles.filter((p) => p.active);
    this.pellets = this.pellets.filter((p) => p.active);
  }

  private updateMagnets(): void {
    const pulling = this.heroes.filter((h) => h.magnetTimer > 0);
    for (const coin of this.coinSprites) {
      const body = coin.body as Phaser.Physics.Arcade.Body;
      let target: Hero | undefined;
      let best = MAGNET_RADIUS_PX;
      for (const h of pulling) {
        const d = Phaser.Math.Distance.Between(coin.x, coin.y, h.sprite.x, h.sprite.y - 36);
        if (d < best) { best = d; target = h; }
      }
      if (!target) {
        if (body.velocity.x !== 0 || body.velocity.y !== 0) body.setVelocity(0, 0);
        continue;
      }
      const angle = Phaser.Math.Angle.Between(coin.x, coin.y, target.sprite.x, target.sprite.y - 36);
      body.setVelocity(Math.cos(angle) * MAGNET_PULL_SPEED, Math.sin(angle) * MAGNET_PULL_SPEED);
    }
  }

  private updateMovingPlatforms(): void {
    for (const mp of this.movingPlatforms) {
      const body = mp.sprite.body as Phaser.Physics.Arcade.Body;
      if (mp.sprite.x >= mp.originX + mp.rangeX) mp.dir = -1;
      else if (mp.sprite.x <= mp.originX) mp.dir = 1;
      body.setVelocityX(mp.dir * mp.speed);

      const deltaX = mp.sprite.x - mp.prevX;
      if (deltaX !== 0) {
        for (const hero of this.heroes) if (this.isStandingOn(hero.sprite, mp.sprite)) hero.sprite.x += deltaX;
        if (this.rival && this.isStandingOn(this.rival, mp.sprite)) this.rival.x += deltaX;
      }
      mp.prevX = mp.sprite.x;
    }
  }

  private isStandingOn(rider: Phaser.Physics.Arcade.Sprite, platformSprite: Phaser.Physics.Arcade.Sprite): boolean {
    const rb = rider.body as Phaser.Physics.Arcade.Body;
    const pb = platformSprite.body as Phaser.Physics.Arcade.Body;
    return rb.bottom <= pb.top + 6 && rb.bottom >= pb.top - 6 && rb.right > pb.left && rb.left < pb.right && rb.velocity.y >= 0;
  }

  private checkCheckpointsAndGaps(): void {
    for (const hero of this.heroes) {
      // blocked (not touching) = static ground only: a checkpoint on a moving
      // platform would respawn you in mid-air once it has moved on
      const body = hero.sprite.body as Phaser.Physics.Arcade.Body;
      if (body.blocked.down) {
        hero.lastCheckpoint = { x: hero.sprite.x, y: hero.sprite.y };
      }
      if (hero.sprite.y > GAP_DEATH_Y) {
        this.lives -= 1;
        this.stompCombo = 0;
        if (this.lives <= 0) {
          this.endLevel('fell');
          return;
        }
        this.respawnHero(hero);
      }
    }

    if (this.rival) {
      const rivalBody = this.rival.body as Phaser.Physics.Arcade.Body;
      if (rivalBody.blocked.down) {
        this.rivalLastSafe = { x: this.rival.x, y: this.rival.y };
      }
      if (this.rival.y > GAP_DEATH_Y) {
        // reset(), not setPosition(): the body must forget its below-the-pit
        // previous position or Arcade separates it out the underside of the ground
        rivalBody.reset(this.rivalLastSafe.x, this.rivalLastSafe.y);
        resyncRivalAI(this.rivalAI, this.level.rivalWaypoints ?? [], this.rival.x);
      }
    }
  }

  /** co-op respawns next to your partner, so the camera leash can't strand you over the pit you fell in */
  private respawnHero(hero: Hero): void {
    const partner = this.heroes.find((h) => h !== hero);
    const at = partner ? partner.lastCheckpoint : hero.lastCheckpoint;
    // see the rival respawn in checkCheckpointsAndGaps for why this is reset()
    (hero.sprite.body as Phaser.Physics.Arcade.Body).reset(at.x, at.y);
    hero.pounding = false;
    hero.invulnTimer = PLATFORMER_INVULN_MS;
    this.buzz(hero, 220, 0.8);
    this.cameras.main.flash(140, 239, 68, 68);
  }

  private collectCoin(coin: Phaser.Physics.Arcade.Sprite): void {
    if (!coin.active) return;
    coin.destroy();
    this.coinSprites = this.coinSprites.filter((c) => c !== coin);
    this.coins += 1;
  }

  private resolveEnemyContact(hero: Hero, enemy: PatrolEnemyState): void {
    if (!enemy.alive || this.gameOver || hero.invulnTimer > 0 || hero.stunTimer > 0) return;
    const heroBody = hero.sprite.body as Phaser.Physics.Arcade.Body;
    const enemyBody = enemy.sprite.body as Phaser.Physics.Arcade.Body;
    const isStomp = heroBody.velocity.y > 0 && heroBody.bottom <= enemyBody.top + STOMP_TOLERANCE_PX;
    if (enemy.phased) return; // a faded ghost is just air
    // a dizzy, perched or retreating boss can't hurt you by touch
    const harmless = enemy.bossPhase === 'stunned' || enemy.bossPhase === 'perched' || enemy.bossPhase === 'recover';
    if (harmless && !isStomp && !hero.pounding) return;

    if (hero.pounding) {
      this.damageEnemy(enemy, 1, hero);
      if (enemy.alive) heroBody.setVelocityY(STOMP_BOUNCE_VELOCITY);
      hero.pounding = false;
    } else if (isStomp && !enemy.def.spiky) {
      heroBody.setVelocityY(STOMP_BOUNCE_VELOCITY);
      this.damageEnemy(enemy, 1, hero);
    } else {
      // landing on a spiker bounces you off as well as hurting, so you don't sit in it
      if (isStomp) heroBody.setVelocityY(STOMP_BOUNCE_VELOCITY * 0.8);
      this.takeDamage(hero, enemy.def.contactDamage);
    }
  }

  private damageEnemy(enemy: PatrolEnemyState, amount = 1, by: Hero = this.heroes[0]): void {
    if (!enemy.alive) return;
    if (enemy.phased) return;
    const slammer = enemy.def.bossKind === 'slammer';
    const conductor = enemy.def.bossKind === 'conductor';
    if ((slammer || conductor) && enemy.bossPhase === 'recover') return; // one hit per window
    enemy.health -= amount;
    if (enemy.health > 0) {
      // hurt but not defeated (bosses only - regular enemies default to 1 health)
      enemy.sprite.setTint(0xffffff);
      this.time.delayedCall(120, () => { if (enemy.alive) enemy.sprite.clearTint(); });
      this.registerStomp(by);
      if (slammer) {
        // hop clear, away from whoever hit it - but never out of its arena
        let away = enemy.sprite.x < by.sprite.x ? -1 : 1;
        const mid = enemy.originX + enemy.rangeX / 2;
        if ((away < 0 && enemy.sprite.x - 150 < enemy.originX) || (away > 0 && enemy.sprite.x + 150 > enemy.originX + enemy.rangeX)) {
          away = enemy.sprite.x < mid ? 1 : -1;
        }
        enemy.bossPhase = 'recover';
        enemy.timer = 0;
        enemy.sprite.setAngle(0);
        (enemy.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(away * 220, -520);
      }
      if (conductor) {
        // rises back up, immune a moment even if it was already at hover height (a spring stomp)
        enemy.bossPhase = 'recover';
        enemy.timer = 900;
        enemy.sprite.setAngle(0);
      }
      return;
    }
    enemy.alive = false;
    (enemy.sprite.body as Phaser.Physics.Arcade.Body).enable = false;
    this.tweens.add({
      targets: enemy.sprite,
      scaleY: 0.2,
      alpha: 0,
      duration: 220,
      onComplete: () => enemy.sprite.destroy(),
    });
    this.coins += enemy.def.stompReward;
    this.registerStomp(by);
    if (enemy.def.movement === 'boss') this.endLevel('playerWon');
  }

  private spawnProjectile(hero: Hero): void {
    const from = hero.sprite;
    const facingLeft = from.flipX;
    const sprite = this.physics.add.sprite(from.x + (facingLeft ? -20 : 20), from.y - 40, 'projectile');
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setVelocityX(facingLeft ? -PROJECTILE_SPEED : PROJECTILE_SPEED);
    this.projectiles.push(sprite);

    for (const e of this.enemies) {
      this.physics.add.overlap(sprite, e.sprite, () => this.hitEnemyWithProjectile(sprite, e, hero));
    }
    if (this.rival) {
      this.physics.add.overlap(sprite, this.rival, () => this.hitRivalWithProjectile(sprite, hero));
    }

    this.time.delayedCall(PROJECTILE_LIFESPAN_MS, () => {
      if (sprite.active) sprite.destroy();
    });
  }

  private hitEnemyWithProjectile(sprite: Phaser.Physics.Arcade.Sprite, enemy: PatrolEnemyState, by: Hero): void {
    if (!sprite.active || !enemy.alive || enemy.phased) return; // passes through a faded ghost
    sprite.destroy();
    this.damageEnemy(enemy, 1, by);
  }

  private hitRivalWithProjectile(sprite: Phaser.Physics.Arcade.Sprite, by: Hero): void {
    if (!sprite.active || this.rivalStunTimer > 0) return;
    sprite.destroy();
    this.stunRival(by);
  }

  private stunRival(by: Hero = this.heroes[0]): void {
    if (!this.rival) return;
    this.rivalStunTimer = STOMP_STUN_MS;
    this.rival.setTint(0x475569);
    this.time.delayedCall(STOMP_STUN_MS, () => {
      if (this.rival && this.freezeTimer <= 0) this.rival.setTint(RIVAL_TINT);
    });
    this.registerStomp(by);
  }

  private resolvePlayerRivalContact(hero: Hero = this.heroes[0]): void {
    if (!this.rival || this.gameOver || hero.stunTimer > 0 || this.rivalStunTimer > 0) return;
    const heroBody = hero.sprite.body as Phaser.Physics.Arcade.Body;
    const rivalBody = this.rival.body as Phaser.Physics.Arcade.Body;
    const heroStomps = heroBody.velocity.y > 0 && heroBody.bottom <= rivalBody.top + STOMP_TOLERANCE_PX;
    // a frozen rival can be stomped but can't stomp back
    const rivalStomps = this.freezeTimer <= 0 && rivalBody.velocity.y > 0 && rivalBody.bottom <= heroBody.top + STOMP_TOLERANCE_PX;

    if (heroStomps && !rivalStomps) {
      heroBody.setVelocityY(STOMP_BOUNCE_VELOCITY);
      this.stunRival(hero);
    } else if (rivalStomps && !heroStomps) {
      rivalBody.setVelocityY(STOMP_BOUNCE_VELOCITY * 0.6);
      hero.stunTimer = STOMP_STUN_MS;
      this.stompCombo = 0;
      this.cameras.main.flash(120, 239, 68, 68);
    }
  }

  private registerStomp(by: Hero): void {
    this.stompCombo += 1;
    this.bestStompCombo = Math.max(this.bestStompCombo, this.stompCombo);
    if (this.stompCombo % STOMP_COMBO_THRESHOLD === 0) {
      by.speedBoostTimer = SPEED_BOOST_MS;
    }
  }

  /** lives and shields are a shared pool in co-op; only the invulnerability window is per-player */
  private takeDamage(hero: Hero, amount = 1): void {
    hero.invulnTimer = PLATFORMER_INVULN_MS;
    this.buzz(hero, 160, this.shields > 0 ? 0.35 : 0.7);
    if (this.shields > 0) {
      this.shields -= 1;
      this.cameras.main.flash(140, 56, 189, 248);
      return;
    }
    this.lives -= amount;
    this.stompCombo = 0;
    this.cameras.main.flash(140, 239, 68, 68);
    if (this.lives <= 0) this.endLevel('fell');
  }

  private endLevel(raceOutcome: PlatformerResult['raceOutcome']): void {
    if (this.gameOver) return;
    this.gameOver = true;
    const result: PlatformerResult = {
      raceOutcome,
      coins: this.coins,
      elapsedSeconds: Math.round(this.elapsed * 10) / 10,
      bestStompCombo: this.bestStompCombo,
      characterId: this.character.id,
      levelIndex: this.levelIndex,
    };
    this.registry.set(REGISTRY_KEY_LAST_PLATFORMER_RESULT, result);
    this.time.delayedCall(300, () => this.scene.start('PlatformerResult'));
  }
}

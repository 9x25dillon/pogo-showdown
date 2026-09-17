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
  BOSS_CHARGE_MS,
  BOSS_COOLDOWN_MS,
  BOSS_PATROL_MS,
  BOSS_TELEGRAPH_MS,
  ENEMY_PATROL_SPEED,
  FLYER_BOB_HEIGHT,
  FLYER_BOB_SPEED,
  GAP_DEATH_Y,
  GRAVITY_Y,
  LEVEL_WIDTH_PX,
  MOVE_ACCEL,
  MOVE_SPEED,
  PLATFORMER_INVULN_MS,
  PLAYER_LIVES,
  PROJECTILE_LIFESPAN_MS,
  PROJECTILE_SPEED,
  RIVAL_MOVE_SPEED,
  SPEED_BOOST_MS,
  SPEED_BOOST_MULTIPLIER,
  STOMP_BOUNCE_VELOCITY,
  STOMP_COMBO_THRESHOLD,
  STOMP_STUN_MS,
  STOMP_TOLERANCE_PX,
} from '../data/platformerConfig';
import { LEVELS, type LevelDef } from '../data/levels';
import { enemyDef, type PlatformerEnemyDef } from '../data/platformerEnemies';
import {
  createControllerState,
  updateController,
  type ControllerInput,
  type ControllerState,
} from '../systems/PlayerController';
import { createRivalAIState, computeRivalInput, type RivalAIState } from '../systems/rivalAI';
import { equippedLoadout, equippedPerks } from '../db/pogRepository';
import type { PogActiveEffect, PogDef } from '../data/pogs';
import type { PogInstance } from '../db/pogSchema';
import type { PlatformerResult } from '../db/platformerResult';

const ITEM_ICON: Record<PogActiveEffect['kind'], string> = {
  shieldBurst: '⛨',
  speedBurst: '⚡',
  extraLife: '❤',
  projectile: '🔥',
};

type BossPhase = 'patrol' | 'telegraph' | 'charge' | 'cooldown';

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
  bossPhase?: BossPhase;
  bossPhaseTimer?: number;
}

interface MovingPlatformState {
  sprite: Phaser.Physics.Arcade.Sprite;
  originX: number;
  rangeX: number;
  speed: number;
  dir: 1 | -1;
  prevX: number;
}

export class PlatformerRunScene extends Phaser.Scene {
  private level!: LevelDef;
  private character!: Character;

  private player!: Phaser.Physics.Arcade.Sprite;
  /** absent for boss levels - see LevelDef.bossLevel */
  private rival?: Phaser.Physics.Arcade.Sprite;
  private playerState: ControllerState = createControllerState();
  private rivalState: ControllerState = createControllerState();
  private rivalAI: RivalAIState = createRivalAIState();

  /** co-op only (LevelDef.player2Start) - a second human, not an AI rival */
  private coopMode = false;
  private p2?: Phaser.Physics.Arcade.Sprite;
  private p2State: ControllerState = createControllerState();
  private p2InvulnTimer = 0;
  private p2LastCheckpoint = { x: 0, y: 0 };
  private p2LeftDown = false;
  private p2RightDown = false;
  private p2JumpHeld = false;
  private pendingP2JumpPress = false;

  private touchMoveLeft = false;
  private touchMoveRight = false;
  private keyLeftDown = false;
  private keyRightDown = false;
  private touchJumpHeld = false;
  private keyJumpHeld = false;
  private pendingJumpPress = false;
  private pendingItemUse = false;

  private lives = PLAYER_LIVES;
  private coins = 0;
  private stompCombo = 0;
  private bestStompCombo = 0;
  private elapsed = 0;
  private invulnTimer = 0;
  private playerStunTimer = 0;
  private rivalStunTimer = 0;
  private speedBoostTimer = 0;
  private gameOver = false;
  private ready = false;

  private lastCheckpoint = { x: 0, y: 0 };
  private rivalLastSafe = { x: 0, y: 0 };

  private staticSolids!: Phaser.Physics.Arcade.StaticGroup;
  private movingPlatforms: MovingPlatformState[] = [];
  private coinSprites: Phaser.Physics.Arcade.Sprite[] = [];
  private enemies: PatrolEnemyState[] = [];
  private projectiles: Phaser.Physics.Arcade.Sprite[] = [];
  /** absent for boss levels; win condition there is defeating the boss */
  private goalSprite?: Phaser.Physics.Arcade.Sprite;
  private levelIndex = 0;

  private shields = 0;
  private activeItem?: { instance: PogInstance; def: PogDef; chargesRemaining: number };
  private itemButtonBg?: Phaser.GameObjects.Arc;
  private itemButtonLabel?: Phaser.GameObjects.Text;

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
    this.playerState = createControllerState();
    this.rivalState = createControllerState();
    this.rivalAI = createRivalAIState();
    this.p2State = createControllerState();
    this.p2InvulnTimer = 0;
    this.p2LeftDown = false;
    this.p2RightDown = false;
    this.p2JumpHeld = false;
    this.pendingP2JumpPress = false;
    this.touchMoveLeft = false;
    this.touchMoveRight = false;
    this.keyLeftDown = false;
    this.keyRightDown = false;
    this.touchJumpHeld = false;
    this.keyJumpHeld = false;
    this.pendingJumpPress = false;
    this.pendingItemUse = false;
    this.lives = PLAYER_LIVES;
    this.coins = 0;
    this.stompCombo = 0;
    this.bestStompCombo = 0;
    this.elapsed = 0;
    this.invulnTimer = 0;
    this.playerStunTimer = 0;
    this.rivalStunTimer = 0;
    this.speedBoostTimer = 0;
    this.gameOver = false;
    this.ready = false;
    this.movingPlatforms = [];
    this.coinSprites = [];
    this.enemies = [];
    this.projectiles = [];
    this.activeItem = undefined;

    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.cameras.main.resetFX();
    this.input.addPointer(2); // allow simultaneous move + jump touches

    this.buildLevel();
    this.buildHud();
    this.buildControls();

    this.cameras.main.setBounds(0, 0, LEVEL_WIDTH_PX, HEIGHT);
    this.cameras.main.startFollow(this.player, true, 1, 0);

    this.lastCheckpoint = { x: this.level.playerStart.x, y: this.player.y };
    this.rivalLastSafe = this.rival ? { x: this.rival.x, y: this.rival.y } : { x: 0, y: 0 };
    this.p2LastCheckpoint = this.p2 ? { x: this.p2.x, y: this.p2.y } : { x: 0, y: 0 };

    void this.loadLoadout();
  }

  private async loadLoadout(): Promise<void> {
    const [perks, loadout] = await Promise.all([equippedPerks(), equippedLoadout()]);
    if (!this.scene.isActive()) return;
    this.shields = perks.shieldHits;
    this.lives = PLAYER_LIVES + perks.extraLives;
    const withActive = loadout.find((row) => row.def.activeEffect);
    if (withActive) {
      this.activeItem = { instance: withActive.instance, def: withActive.def, chargesRemaining: withActive.def.activeEffect!.charges };
    }
    this.updateItemButton();
    this.updateHud();
    this.loadingText?.destroy();
    this.loadingText = undefined;
    this.ready = true;
  }

  // ---------------- level construction ----------------

  private buildLevel(): void {
    // extra headroom below the visible area so bodies aren't clamped before
    // the manual gap-death check (GAP_DEATH_Y) gets a chance to fire
    this.physics.world.setBounds(0, 0, LEVEL_WIDTH_PX, HEIGHT + 200);
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
      const sprite = this.physics.add.sprite(e.x, e.y, def.textureKey).setOrigin(0.5, def.flies ? 0.5 : 1);
      const body = sprite.body as Phaser.Physics.Arcade.Body;
      body.setCollideWorldBounds(false);
      if (def.flies) {
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
        bossPhase: def.id === 'boss' ? 'patrol' : undefined,
        bossPhaseTimer: def.id === 'boss' ? BOSS_PATROL_MS : undefined,
      });
    }

    if (this.level.goalX !== undefined && this.level.goalY !== undefined) {
      this.goalSprite = this.physics.add.sprite(this.level.goalX, this.level.goalY, 'goalFlag').setOrigin(0.5, 1);
      (this.goalSprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    } else {
      this.goalSprite = undefined;
    }

    this.player = this.physics.add.sprite(this.level.playerStart.x, this.level.playerStart.y, 'player').setOrigin(0.5, 1);
    this.player.setTint(this.character.color);
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    playerBody.setGravityY(GRAVITY_Y);
    playerBody.setCollideWorldBounds(false);

    if (this.level.rivalStart) {
      this.rival = this.physics.add.sprite(this.level.rivalStart.x, this.level.rivalStart.y, 'player').setOrigin(0.5, 1);
      this.rival.setTint(0x94a3b8);
      this.rival.setAlpha(0.92);
      const rivalBody = this.rival.body as Phaser.Physics.Arcade.Body;
      rivalBody.setGravityY(GRAVITY_Y);
      rivalBody.setCollideWorldBounds(false);
    } else {
      this.rival = undefined;
    }

    if (this.level.player2Start) {
      this.p2 = this.physics.add.sprite(this.level.player2Start.x, this.level.player2Start.y, 'player').setOrigin(0.5, 1);
      this.p2.setTint(0x38bdf8);
      const p2Body = this.p2.body as Phaser.Physics.Arcade.Body;
      p2Body.setGravityY(GRAVITY_Y);
      p2Body.setCollideWorldBounds(false);
    } else {
      this.p2 = undefined;
    }

    // physical collision (stops falling through)
    this.physics.add.collider(this.player, this.staticSolids);
    if (this.rival) this.physics.add.collider(this.rival, this.staticSolids);
    if (this.p2) this.physics.add.collider(this.p2, this.staticSolids);
    for (const mp of this.movingPlatforms) {
      this.physics.add.collider(this.player, mp.sprite);
      if (this.rival) this.physics.add.collider(this.rival, mp.sprite);
      if (this.p2) this.physics.add.collider(this.p2, mp.sprite);
    }
    for (const e of this.enemies) {
      if (!e.def.flies) this.physics.add.collider(e.sprite, this.staticSolids);
    }

    // gameplay overlaps
    for (const coin of this.coinSprites) {
      this.physics.add.overlap(this.player, coin, () => this.collectCoin(coin));
      if (this.p2) this.physics.add.overlap(this.p2, coin, () => this.collectCoin(coin));
    }
    for (const e of this.enemies) {
      this.physics.add.overlap(this.player, e.sprite, () => this.resolveEnemyContact(this.player, false, e));
      if (this.p2) this.physics.add.overlap(this.p2, e.sprite, () => this.resolveEnemyContact(this.p2!, true, e));
    }
    if (this.rival) {
      this.physics.add.overlap(this.player, this.rival, () => this.resolvePlayerRivalContact());
    }
    if (this.goalSprite) {
      this.physics.add.overlap(this.player, this.goalSprite, () => this.endLevel('playerWon'));
      if (this.rival) this.physics.add.overlap(this.rival, this.goalSprite, () => this.endLevel('rivalWon'));
      if (this.p2) this.physics.add.overlap(this.p2, this.goalSprite, () => this.endLevel('playerWon'));
    }
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
  }

  private updateHud(): void {
    this.coinsText.setText(`🪙 ${this.coins}`);
    this.livesText.setText(`♥ ${Math.max(0, this.lives)}${this.shields ? `  ⛨ ${this.shields}` : ''}`);
    this.timeText.setText(`${this.elapsed.toFixed(1)}s`);
    this.comboText.setText(this.stompCombo >= 2 ? `stomp x${this.stompCombo}` : '');
    if (this.rival) {
      const ahead = this.player.x - this.rival.x;
      this.rivalPositionText.setText(ahead >= 0 ? `Rival: ahead by ${Math.round(ahead)}` : `Rival: behind by ${Math.round(-ahead)}`);
    } else {
      const boss = this.enemies.find((e) => e.def.id === 'boss');
      this.rivalPositionText.setText(boss && boss.alive ? `BOSS HP: ${boss.health} / ${boss.def.maxHealth}` : '');
    }
  }

  // ---------------- controls ----------------

  private buildControls(): void {
    const zoneAlpha = 0.16;
    const leftZone = this.add.rectangle(70, HEIGHT - 74, 90, 90, 0xffffff, zoneAlpha).setScrollFactor(0).setDepth(30).setInteractive();
    const rightZone = this.add.rectangle(170, HEIGHT - 74, 90, 90, 0xffffff, zoneAlpha).setScrollFactor(0).setDepth(30).setInteractive();
    this.add.text(70, HEIGHT - 74, '◀', { fontSize: '26px', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0).setDepth(31);
    this.add.text(170, HEIGHT - 74, '▶', { fontSize: '26px', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0).setDepth(31);

    leftZone.on('pointerdown', () => { this.touchMoveLeft = true; });
    leftZone.on('pointerup', () => { this.touchMoveLeft = false; });
    leftZone.on('pointerout', () => { this.touchMoveLeft = false; });
    rightZone.on('pointerdown', () => { this.touchMoveRight = true; });
    rightZone.on('pointerup', () => { this.touchMoveRight = false; });
    rightZone.on('pointerout', () => { this.touchMoveRight = false; });

    const jumpBtn = this.add.circle(WIDTH - 70, HEIGHT - 74, 55, COLORS.accent, 0.32).setScrollFactor(0).setDepth(30).setInteractive();
    this.add.text(WIDTH - 70, HEIGHT - 74, 'JUMP', { fontSize: '13px', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5).setScrollFactor(0).setDepth(31);
    jumpBtn.on('pointerdown', () => { this.touchJumpHeld = true; this.pendingJumpPress = true; });
    jumpBtn.on('pointerup', () => { this.touchJumpHeld = false; });
    jumpBtn.on('pointerout', () => { this.touchJumpHeld = false; });

    this.itemButtonBg = this.add.circle(WIDTH - 70, HEIGHT - 150, 38, 0x38bdf8, 0.28).setScrollFactor(0).setDepth(30).setInteractive();
    this.itemButtonLabel = this.add.text(WIDTH - 70, HEIGHT - 150, '⛨', { fontSize: '22px' }).setOrigin(0.5).setScrollFactor(0).setDepth(31);
    this.itemButtonBg.on('pointerdown', () => { this.pendingItemUse = true; });

    const kb = this.input.keyboard;
    if (kb) {
      // co-op: P1 is WASD-only, P2 gets the arrow keys exclusively (no
      // combat item for P2 in this first pass - keep the control surface
      // simple). Solo modes keep accepting both WASD and arrows for P1.
      const onKeyDown = (e: KeyboardEvent) => {
        const key = e.key.toLowerCase();
        if (key === 'a' || (!this.coopMode && key === 'arrowleft')) this.keyLeftDown = true;
        else if (key === 'd' || (!this.coopMode && key === 'arrowright')) this.keyRightDown = true;
        else if ((key === 'w' || (!this.coopMode && key === 'arrowup') || key === ' ') && !this.keyJumpHeld) {
          this.keyJumpHeld = true;
          this.pendingJumpPress = true;
        } else if (key === 'f') this.pendingItemUse = true;
        else if (this.coopMode && key === 'arrowleft') this.p2LeftDown = true;
        else if (this.coopMode && key === 'arrowright') this.p2RightDown = true;
        else if (this.coopMode && key === 'arrowup' && !this.p2JumpHeld) {
          this.p2JumpHeld = true;
          this.pendingP2JumpPress = true;
        }
      };
      const onKeyUp = (e: KeyboardEvent) => {
        const key = e.key.toLowerCase();
        if (key === 'a' || (!this.coopMode && key === 'arrowleft')) this.keyLeftDown = false;
        else if (key === 'd' || (!this.coopMode && key === 'arrowright')) this.keyRightDown = false;
        else if (key === 'w' || (!this.coopMode && key === 'arrowup') || key === ' ') this.keyJumpHeld = false;
        else if (this.coopMode && key === 'arrowleft') this.p2LeftDown = false;
        else if (this.coopMode && key === 'arrowright') this.p2RightDown = false;
        else if (this.coopMode && key === 'arrowup') this.p2JumpHeld = false;
      };
      kb.on('keydown', onKeyDown);
      kb.on('keyup', onKeyUp);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        kb.off('keydown', onKeyDown);
        kb.off('keyup', onKeyUp);
      });
    }
  }

  private updateItemButton(): void {
    if (!this.itemButtonBg || !this.itemButtonLabel) return;
    const has = !!this.activeItem && this.activeItem.chargesRemaining > 0;
    this.itemButtonBg.setAlpha(has ? 0.5 : 0.12);
    this.itemButtonLabel.setAlpha(has ? 1 : 0.4);
    this.itemButtonLabel.setText(this.activeItem ? ITEM_ICON[this.activeItem.def.activeEffect!.kind] : '—');
  }

  private useItem(): void {
    if (!this.activeItem || this.activeItem.chargesRemaining <= 0 || this.gameOver) return;
    const effect = this.activeItem.def.activeEffect!;
    this.activeItem.chargesRemaining -= 1;

    switch (effect.kind) {
      case 'shieldBurst':
        this.invulnTimer = Math.max(this.invulnTimer, effect.invulnMs);
        this.cameras.main.flash(140, 56, 189, 248);
        break;
      case 'speedBurst':
        this.speedBoostTimer = Math.max(this.speedBoostTimer, effect.boostMs);
        this.cameras.main.flash(140, 250, 204, 21);
        break;
      case 'extraLife':
        this.lives += 1;
        this.cameras.main.flash(160, 249, 214, 75);
        break;
      case 'projectile':
        this.spawnProjectile();
        break;
    }
    this.updateItemButton();
  }

  // ---------------- update loop ----------------

  update(_time: number, deltaMs: number): void {
    if (this.gameOver || !this.ready) return;
    const dt = Math.min(deltaMs, 50);
    this.elapsed += dt / 1000;

    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.p2InvulnTimer > 0) this.p2InvulnTimer = Math.max(0, this.p2InvulnTimer - dt);
    if (this.playerStunTimer > 0) this.playerStunTimer = Math.max(0, this.playerStunTimer - dt);
    if (this.rivalStunTimer > 0) this.rivalStunTimer = Math.max(0, this.rivalStunTimer - dt);
    if (this.speedBoostTimer > 0) this.speedBoostTimer = Math.max(0, this.speedBoostTimer - dt);

    if (this.pendingItemUse) {
      this.useItem();
      this.pendingItemUse = false;
    }

    const jumpPressed = this.pendingJumpPress;
    this.pendingJumpPress = false;

    const playerInput: ControllerInput =
      this.playerStunTimer > 0
        ? { left: false, right: false, jumpPressed: false, jumpHeld: false }
        : {
            left: this.touchMoveLeft || this.keyLeftDown,
            right: this.touchMoveRight || this.keyRightDown,
            jumpPressed,
            jumpHeld: this.touchJumpHeld || this.keyJumpHeld,
          };

    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    const playerMoveSpeed = this.speedBoostTimer > 0 ? MOVE_SPEED * SPEED_BOOST_MULTIPLIER : MOVE_SPEED;
    updateController(playerBody, playerInput, this.playerState, { moveSpeed: playerMoveSpeed, moveAccel: MOVE_ACCEL }, dt);

    if (this.rival) {
      const rivalInput = computeRivalInput(this.rival.x, this.level.rivalWaypoints ?? [], this.rivalAI, this.rivalStunTimer > 0, dt);
      const rivalBody = this.rival.body as Phaser.Physics.Arcade.Body;
      updateController(rivalBody, rivalInput, this.rivalState, { moveSpeed: RIVAL_MOVE_SPEED, moveAccel: MOVE_ACCEL }, dt);
      this.rival.setFlipX(rivalBody.velocity.x < -5 ? true : rivalBody.velocity.x > 5 ? false : this.rival.flipX);
    }

    this.player.setFlipX(playerBody.velocity.x < -5 ? true : playerBody.velocity.x > 5 ? false : this.player.flipX);
    this.player.setAlpha(this.invulnTimer > 0 && Math.floor(this.invulnTimer / 80) % 2 === 0 ? 0.4 : 1);

    if (this.p2) {
      const p2Input: ControllerInput = {
        left: this.p2LeftDown,
        right: this.p2RightDown,
        jumpPressed: this.pendingP2JumpPress,
        jumpHeld: this.p2JumpHeld,
      };
      this.pendingP2JumpPress = false;
      const p2Body = this.p2.body as Phaser.Physics.Arcade.Body;
      const p2MoveSpeed = this.speedBoostTimer > 0 ? MOVE_SPEED * SPEED_BOOST_MULTIPLIER : MOVE_SPEED;
      updateController(p2Body, p2Input, this.p2State, { moveSpeed: p2MoveSpeed, moveAccel: MOVE_ACCEL }, dt);
      this.p2.setFlipX(p2Body.velocity.x < -5 ? true : p2Body.velocity.x > 5 ? false : this.p2.flipX);
      this.p2.setAlpha(this.p2InvulnTimer > 0 && Math.floor(this.p2InvulnTimer / 80) % 2 === 0 ? 0.4 : 1);
    }

    this.updatePatrolEnemies(dt);
    this.updateProjectiles();
    this.updateMovingPlatforms();
    this.checkCheckpointsAndGaps();
    this.updateHud();
  }

  /** co-op's slower pace scales enemy/boss speed down; everywhere else this is a no-op (factor 1) */
  private paced(baseSpeed: number): number {
    return baseSpeed * (this.level.paceMultiplier ?? 1);
  }

  private updatePatrolEnemies(dt: number): void {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.def.id === 'boss') {
        this.updateBoss(e, dt);
        continue;
      }
      const body = e.sprite.body as Phaser.Physics.Arcade.Body;
      if (e.sprite.x >= e.originX + e.rangeX) e.dir = -1;
      else if (e.sprite.x <= e.originX) e.dir = 1;
      body.setVelocityX(e.dir * this.paced(ENEMY_PATROL_SPEED));
      e.sprite.setFlipX(e.dir < 0);
      if (e.def.flies) {
        e.bobPhase += (dt / 1000) * FLYER_BOB_SPEED;
        e.sprite.setY(e.baseY + Math.sin(e.bobPhase) * FLYER_BOB_HEIGHT);
      }
    }
  }

  /** patrol -> telegraph (pause + flash) -> charge (fast dash at the player) -> cooldown -> repeat */
  private updateBoss(e: PatrolEnemyState, dt: number): void {
    const body = e.sprite.body as Phaser.Physics.Arcade.Body;
    e.bossPhaseTimer = (e.bossPhaseTimer ?? 0) - dt;

    switch (e.bossPhase) {
      case 'telegraph':
        if (e.bossPhaseTimer <= 0) {
          e.bossPhase = 'charge';
          e.bossPhaseTimer = BOSS_CHARGE_MS;
          const towardPlayer = this.player.x < e.sprite.x ? -1 : 1;
          e.dir = towardPlayer;
          e.sprite.setFlipX(towardPlayer < 0);
          body.setVelocityX(towardPlayer * this.paced(e.def.chargeSpeed ?? ENEMY_PATROL_SPEED));
        }
        break;
      case 'charge':
        if (e.bossPhaseTimer <= 0 || e.sprite.x <= e.originX || e.sprite.x >= e.originX + e.rangeX) {
          e.bossPhase = 'cooldown';
          e.bossPhaseTimer = BOSS_COOLDOWN_MS;
          body.setVelocityX(0);
          e.sprite.clearTint();
        }
        break;
      case 'cooldown':
        body.setVelocityX(0);
        if (e.bossPhaseTimer <= 0) {
          e.bossPhase = 'patrol';
          e.bossPhaseTimer = BOSS_PATROL_MS;
        }
        break;
      case 'patrol':
      default:
        if (e.sprite.x >= e.originX + e.rangeX) e.dir = -1;
        else if (e.sprite.x <= e.originX) e.dir = 1;
        body.setVelocityX(e.dir * this.paced(ENEMY_PATROL_SPEED));
        e.sprite.setFlipX(e.dir < 0);
        if (e.bossPhaseTimer <= 0) {
          e.bossPhase = 'telegraph';
          e.bossPhaseTimer = BOSS_TELEGRAPH_MS;
          body.setVelocityX(0);
          e.sprite.setTint(0xffffff);
        }
        break;
    }
  }

  private updateProjectiles(): void {
    this.projectiles = this.projectiles.filter((p) => p.active);
  }

  private updateMovingPlatforms(): void {
    for (const mp of this.movingPlatforms) {
      const body = mp.sprite.body as Phaser.Physics.Arcade.Body;
      if (mp.sprite.x >= mp.originX + mp.rangeX) mp.dir = -1;
      else if (mp.sprite.x <= mp.originX) mp.dir = 1;
      body.setVelocityX(mp.dir * mp.speed);

      const deltaX = mp.sprite.x - mp.prevX;
      if (deltaX !== 0) {
        if (this.isStandingOn(this.player, mp.sprite)) this.player.x += deltaX;
        if (this.rival && this.isStandingOn(this.rival, mp.sprite)) this.rival.x += deltaX;
        if (this.p2 && this.isStandingOn(this.p2, mp.sprite)) this.p2.x += deltaX;
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
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    if (playerBody.blocked.down || playerBody.touching.down) {
      this.lastCheckpoint = { x: this.player.x, y: this.player.y };
    }
    if (this.player.y > GAP_DEATH_Y) {
      this.lives -= 1;
      this.stompCombo = 0;
      if (this.lives <= 0) {
        this.endLevel('fell');
        return;
      }
      this.respawnPlayer();
    }

    if (this.rival) {
      const rivalBody = this.rival.body as Phaser.Physics.Arcade.Body;
      if (rivalBody.blocked.down || rivalBody.touching.down) {
        this.rivalLastSafe = { x: this.rival.x, y: this.rival.y };
      }
      if (this.rival.y > GAP_DEATH_Y) {
        this.rival.setPosition(this.rivalLastSafe.x, this.rivalLastSafe.y);
        rivalBody.setVelocity(0, 0);
      }
    }

    if (this.p2) {
      const p2Body = this.p2.body as Phaser.Physics.Arcade.Body;
      if (p2Body.blocked.down || p2Body.touching.down) {
        this.p2LastCheckpoint = { x: this.p2.x, y: this.p2.y };
      }
      if (this.p2.y > GAP_DEATH_Y) {
        this.lives -= 1;
        this.stompCombo = 0;
        if (this.lives <= 0) {
          this.endLevel('fell');
          return;
        }
        this.respawnP2();
      }
    }
  }

  private respawnPlayer(): void {
    this.player.setPosition(this.lastCheckpoint.x, this.lastCheckpoint.y);
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.invulnTimer = PLATFORMER_INVULN_MS;
    this.cameras.main.flash(140, 239, 68, 68);
  }

  private respawnP2(): void {
    if (!this.p2) return;
    this.p2.setPosition(this.p2LastCheckpoint.x, this.p2LastCheckpoint.y);
    (this.p2.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.p2InvulnTimer = PLATFORMER_INVULN_MS;
    this.cameras.main.flash(140, 239, 68, 68);
  }

  private collectCoin(coin: Phaser.Physics.Arcade.Sprite): void {
    if (!coin.active) return;
    coin.destroy();
    this.coinSprites = this.coinSprites.filter((c) => c !== coin);
    this.coins += 1;
  }

  private resolveEnemyContact(playerSprite: Phaser.Physics.Arcade.Sprite, isP2: boolean, enemy: PatrolEnemyState): void {
    const ownInvuln = isP2 ? this.p2InvulnTimer : this.invulnTimer;
    if (!enemy.alive || this.gameOver || ownInvuln > 0 || (!isP2 && this.playerStunTimer > 0)) return;
    const playerBody = playerSprite.body as Phaser.Physics.Arcade.Body;
    const enemyBody = enemy.sprite.body as Phaser.Physics.Arcade.Body;
    const isStomp = playerBody.velocity.y > 0 && playerBody.bottom <= enemyBody.top + STOMP_TOLERANCE_PX;

    if (isStomp) {
      playerBody.setVelocityY(STOMP_BOUNCE_VELOCITY);
      this.damageEnemy(enemy);
    } else {
      this.takeDamage(enemy.def.contactDamage, isP2);
    }
  }

  private damageEnemy(enemy: PatrolEnemyState, amount = 1): void {
    if (!enemy.alive) return;
    enemy.health -= amount;
    if (enemy.health > 0) {
      // hurt but not defeated (bosses only - regular enemies default to 1 health)
      enemy.sprite.setTint(0xffffff);
      this.time.delayedCall(120, () => { if (enemy.alive) enemy.sprite.clearTint(); });
      this.registerStomp();
      return;
    }
    enemy.alive = false;
    this.tweens.add({
      targets: enemy.sprite,
      scaleY: 0.2,
      alpha: 0,
      duration: 220,
      onComplete: () => enemy.sprite.destroy(),
    });
    this.coins += enemy.def.stompReward;
    this.registerStomp();
    if (enemy.def.id === 'boss') this.endLevel('playerWon');
  }

  private spawnProjectile(): void {
    const facingLeft = this.player.flipX;
    const sprite = this.physics.add.sprite(this.player.x + (facingLeft ? -20 : 20), this.player.y - 40, 'projectile');
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setVelocityX(facingLeft ? -PROJECTILE_SPEED : PROJECTILE_SPEED);
    this.projectiles.push(sprite);

    for (const e of this.enemies) {
      this.physics.add.overlap(sprite, e.sprite, () => this.hitEnemyWithProjectile(sprite, e));
    }
    if (this.rival) {
      this.physics.add.overlap(sprite, this.rival, () => this.hitRivalWithProjectile(sprite));
    }

    this.time.delayedCall(PROJECTILE_LIFESPAN_MS, () => {
      if (sprite.active) sprite.destroy();
    });
  }

  private hitEnemyWithProjectile(sprite: Phaser.Physics.Arcade.Sprite, enemy: PatrolEnemyState): void {
    if (!sprite.active || !enemy.alive) return;
    sprite.destroy();
    this.damageEnemy(enemy);
  }

  private hitRivalWithProjectile(sprite: Phaser.Physics.Arcade.Sprite): void {
    if (!sprite.active || this.rivalStunTimer > 0) return;
    sprite.destroy();
    this.stunRival();
  }

  private stunRival(): void {
    if (!this.rival) return;
    this.rivalStunTimer = STOMP_STUN_MS;
    this.rival.setTint(0x475569);
    this.time.delayedCall(STOMP_STUN_MS, () => this.rival?.setTint(0x94a3b8));
    this.registerStomp();
  }

  private resolvePlayerRivalContact(): void {
    if (!this.rival || this.gameOver || this.playerStunTimer > 0 || this.rivalStunTimer > 0) return;
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    const rivalBody = this.rival.body as Phaser.Physics.Arcade.Body;
    const playerStomps = playerBody.velocity.y > 0 && playerBody.bottom <= rivalBody.top + STOMP_TOLERANCE_PX;
    const rivalStomps = rivalBody.velocity.y > 0 && rivalBody.bottom <= playerBody.top + STOMP_TOLERANCE_PX;

    if (playerStomps && !rivalStomps) {
      playerBody.setVelocityY(STOMP_BOUNCE_VELOCITY);
      this.stunRival();
    } else if (rivalStomps && !playerStomps) {
      rivalBody.setVelocityY(STOMP_BOUNCE_VELOCITY * 0.6);
      this.playerStunTimer = STOMP_STUN_MS;
      this.stompCombo = 0;
      this.cameras.main.flash(120, 239, 68, 68);
    }
  }

  private registerStomp(): void {
    this.stompCombo += 1;
    this.bestStompCombo = Math.max(this.bestStompCombo, this.stompCombo);
    if (this.stompCombo % STOMP_COMBO_THRESHOLD === 0) {
      this.speedBoostTimer = SPEED_BOOST_MS;
    }
  }

  /** lives are a shared pool in co-op; only the invulnerability window is per-player */
  private takeDamage(amount = 1, isP2 = false): void {
    if (this.shields > 0) {
      this.shields -= 1;
      if (isP2) this.p2InvulnTimer = PLATFORMER_INVULN_MS;
      else this.invulnTimer = PLATFORMER_INVULN_MS;
      this.cameras.main.flash(140, 56, 189, 248);
      return;
    }
    this.lives -= amount;
    this.stompCombo = 0;
    if (isP2) this.p2InvulnTimer = PLATFORMER_INVULN_MS;
    else this.invulnTimer = PLATFORMER_INVULN_MS;
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

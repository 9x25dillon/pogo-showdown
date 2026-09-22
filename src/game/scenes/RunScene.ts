import Phaser from 'phaser';
import { music } from '../systems/music';
import { EMPTY_PERKS, type PogPerks } from '../data/pogs';
import { CHARACTERS, type Character } from '../data/characters';
import {
  BASE_SPEED,
  COLORS,
  GROUND_Y,
  HEIGHT,
  LANE_X,
  MAX_SPEED,
  PASSIVE_FLAIR_WEIGHT,
  PASSIVE_SCORE_RATE,
  PLAYER_Y,
  REGISTRY_KEY_CHARACTER,
  REGISTRY_KEY_PERKS,
  REGISTRY_KEY_LAST_RESULT,
  SPEED_RAMP,
  WIDTH,
} from '../config';
import { recordRun } from '../db/repository';
import type { RunResult } from '../db/runResult';
import { getLoadout } from '../db/loadoutRepository';
import { POG_TIERS, YOYO_TIERS } from '../data/loadoutData';

type ObstacleType = 'hurdle' | 'banner' | 'star';

interface Obstacle {
  sprite: Phaser.GameObjects.Sprite;
  lane: number;
  type: ObstacleType;
  resolved: boolean;
}

const JUMP_MS = 480;
const DUCK_MS = 460;
const INVULN_MS = 550;
const SWIPE_THRESHOLD = 28;

export class RunScene extends Phaser.Scene {
  private character!: Character;

  // player state
  private lane = 1;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private jumpTimer = 0;
  private duckTimer = 0;
  private invulnTimer = 0;
  private bobPhase = 0;
  private lives = 3;
  private perks: Required<PogPerks> = { ...EMPTY_PERKS };
  private shields = 0;
  private secondWindUsed = false;
  private combo = 0;
  private bestCombo = 0;
  private score = 0;

  // world
  private speed = BASE_SPEED;
  private elapsed = 0;
  private obstacles: Obstacle[] = [];
  private nextSpawnAt = 0;
  private roadLines: Phaser.GameObjects.Rectangle[] = [];
  private gameOver = false;
  private paused = false;
  private pauseOverlay?: Phaser.GameObjects.Container;
  private shadow!: Phaser.GameObjects.Ellipse;

  // ui
  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private heartsText!: Phaser.GameObjects.Text;
  private particles!: Phaser.GameObjects.Particles.ParticleEmitter;

  // equipped gear, drawn onto the pogo stick itself
  private pogStack?: Phaser.GameObjects.Container;
  private yoyoDangle?: Phaser.GameObjects.Container;

  // input
  private pointerStartX = 0;
  private pointerStartY = 0;
  private pointerStartT = 0;
  private pointerActive = false;

  constructor() {
    super('Run');
  }

  create(): void {
    music.play('explore');
    const charId = this.registry.get(REGISTRY_KEY_CHARACTER) as string | undefined;
    this.character = CHARACTERS.find((c) => c.id === charId) ?? CHARACTERS[0];

    // reset all run state (scene instances are reused between runs)
    this.lane = 1;
    this.jumpTimer = 0;
    this.duckTimer = 0;
    this.invulnTimer = 0;
    this.bobPhase = 0;
    this.perks = (this.registry.get(REGISTRY_KEY_PERKS) as Required<PogPerks> | undefined) ?? { ...EMPTY_PERKS };
    this.lives = 3 + this.character.shield + this.perks.extraLives;
    this.shields = this.perks.shieldHits + (this.character.startingShields ?? 0);
    this.secondWindUsed = false;
    this.combo = 0;
    this.bestCombo = 0;
    this.score = 0;
    this.speed = BASE_SPEED;
    this.elapsed = 0;
    this.obstacles = [];
    this.nextSpawnAt = 0;
    this.gameOver = false;
    this.paused = false;
    this.pauseOverlay = undefined;
    this.pointerActive = false;

    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.cameras.main.resetFX();

    this.buildRoad();

    this.shadow = this.add.ellipse(LANE_X[this.lane], PLAYER_Y + 36, 62, 16, 0x000000, 0.4).setDepth(4);
    this.playerSprite = this.add.sprite(LANE_X[this.lane], PLAYER_Y, 'player');
    this.playerSprite.setTint(this.character.color);
    this.playerSprite.setDepth(10);

    this.pogStack?.destroy();
    this.yoyoDangle?.destroy();
    this.pogStack = undefined;
    this.yoyoDangle = undefined;
    void this.loadGearVisuals();

    this.particles = this.add.particles(0, 0, 'particle', {
      speed: { min: 80, max: 220 },
      lifespan: 380,
      scale: { start: 1, end: 0 },
      quantity: 0,
      emitting: false,
    });
    this.particles.setDepth(20);

    this.scoreText = this.add
      .text(WIDTH / 2, 28, '0', {
        fontSize: '30px',
        fontFamily: 'system-ui, sans-serif',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(30);

    this.comboText = this.add
      .text(WIDTH / 2, 62, '', {
        fontSize: '16px',
        fontFamily: 'system-ui, sans-serif',
        color: '#f9d64b',
      })
      .setOrigin(0.5)
      .setDepth(30);

    this.heartsText = this.add
      .text(16, 22, '', { fontSize: '16px', fontFamily: 'system-ui, sans-serif' })
      .setDepth(30);
    this.updateHearts();

    const pauseButton = this.add.rectangle(WIDTH - 35, 28, 48, 44, 0x362a52).setDepth(31).setInteractive({ useHandCursor: true });
    this.add.text(WIDTH - 35, 28, 'Ⅱ', { fontSize: '22px', color: '#ffffff' }).setOrigin(0.5).setDepth(32);
    pauseButton.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.togglePause();
    });
    const hint = this.add.text(WIDTH / 2, HEIGHT - 44, '← → move   ·   ↑ / tap jump   ·   ↓ duck', {
      fontSize: '13px', fontFamily: 'system-ui, sans-serif', color: '#b7aed0',
    }).setOrigin(0.5).setDepth(30);
    this.tweens.add({ targets: hint, alpha: 0, delay: 6500, duration: 1000 });
    this.setupInput();
    const onBlur = () => { if (!this.paused && !this.gameOver) this.togglePause(); };
    this.game.events.on(Phaser.Core.Events.BLUR, onBlur);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off(Phaser.Core.Events.BLUR, onBlur));
  }

  private buildRoad(): void {
    this.roadLines = [];
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, COLORS.road).setDepth(0);
    this.add
      .rectangle(WIDTH / 2, GROUND_Y + 40, WIDTH, 220, COLORS.ground)
      .setDepth(0);

    for (const x of [34, WIDTH - 34]) {
      this.add.rectangle(x, HEIGHT / 2, 3, HEIGHT, this.character.color, 0.35).setDepth(1);
      this.add.rectangle(x, HEIGHT / 2, 14, HEIGHT, this.character.color, 0.04).setDepth(1);
    }
    this.add.rectangle(WIDTH / 2, PLAYER_Y + 36, WIDTH - 70, 2, 0xffffff, 0.16).setDepth(1);
    this.add.rectangle(WIDTH / 2, 40, WIDTH, 88, COLORS.bg, 0.85).setDepth(25);

    // lane divider dashes that scroll to sell forward motion
    const dividerXs = [(LANE_X[0] + LANE_X[1]) / 2, (LANE_X[1] + LANE_X[2]) / 2];
    for (const dx of dividerXs) {
      for (let i = 0; i < 10; i++) {
        const line = this.add
          .rectangle(dx, i * 100, 6, 50, COLORS.laneLine)
          .setDepth(1);
        this.roadLines.push(line);
      }
    }
  }

  private setupInput(): void {
    const onDown = (p: Phaser.Input.Pointer) => {
      if (this.paused || this.gameOver) return;
      this.pointerActive = true;
      this.pointerStartX = p.x;
      this.pointerStartY = p.y;
      this.pointerStartT = this.time.now;
    };

    const onUp = (p: Phaser.Input.Pointer) => {
      if (!this.pointerActive) return;
      this.pointerActive = false;
      const dx = p.x - this.pointerStartX;
      const dy = p.y - this.pointerStartY;
      const dt = this.time.now - this.pointerStartT;

      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD) {
        this.changeLane(dx > 0 ? 1 : -1);
      } else if (dy < -SWIPE_THRESHOLD) {
        this.startJump();
      } else if (dy > SWIPE_THRESHOLD) {
        this.startDuck();
      } else if (dt < 250) {
        // quick tap with no real swipe = jump, the most common action
        this.startJump();
      }
    };
    this.input.on('pointerdown', onDown);
    this.input.on('pointerup', onUp);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', onDown);
      this.input.off('pointerup', onUp);
    });

    const kb = this.input.keyboard;
    if (kb) {
      const bindings: Record<string, () => void> = {
        LEFT: () => this.changeLane(-1), A: () => this.changeLane(-1),
        RIGHT: () => this.changeLane(1), D: () => this.changeLane(1),
        UP: () => this.startJump(), W: () => this.startJump(), SPACE: () => this.startJump(),
        DOWN: () => this.startDuck(), S: () => this.startDuck(),
        ESC: () => this.togglePause(), P: () => this.togglePause(),
      };
      for (const [key, handler] of Object.entries(bindings)) kb.on(`keydown-${key}`, handler);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        for (const [key, handler] of Object.entries(bindings)) kb.off(`keydown-${key}`, handler);
      });
    }
  }

  private togglePause(): void {
    if (this.gameOver) return;
    this.paused = !this.paused;
    this.pointerActive = false;
    if (!this.paused) {
      this.pauseOverlay?.destroy();
      this.pauseOverlay = undefined;
      this.tweens.resumeAll();
      return;
    }
    this.tweens.pauseAll();
    const shade = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x0b0714, 0.9).setInteractive();
    const title = this.add.text(WIDTH / 2, 340, 'TAKE A BREATHER', {
      fontSize: '26px', fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', color: '#f9d64b',
    }).setOrigin(0.5);
    const hint = this.add.text(WIDTH / 2, 395, 'Tap to resume · P / Esc', {
      fontSize: '16px', fontFamily: 'system-ui, sans-serif', color: '#b7aed0',
    }).setOrigin(0.5);
    this.pauseOverlay = this.add.container(0, 0, [shade, title, hint]).setDepth(100);
    shade.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.togglePause();
    });
  }

  private changeLane(dir: number): void {
    if (this.gameOver || this.paused) return;
    const next = Phaser.Math.Clamp(this.lane + dir, 0, LANE_X.length - 1);
    if (next === this.lane) return;
    this.lane = next;
    this.tweens.killTweensOf(this.playerSprite);
    this.tweens.add({
      targets: this.playerSprite,
      x: LANE_X[this.lane],
      duration: 130,
      ease: 'Quad.Out',
    });
  }

  private startJump(): void {
    if (this.gameOver || this.paused || this.jumpTimer > 0) return;
    this.jumpTimer = JUMP_MS * (this.character.timingMod ?? 1);
    this.duckTimer = 0;
  }

  private startDuck(): void {
    if (this.gameOver || this.paused || this.duckTimer > 0) return;
    this.duckTimer = DUCK_MS * (this.character.timingMod ?? 1);
    this.jumpTimer = 0;
  }

  update(_time: number, deltaMs: number): void {
    if (this.gameOver || this.paused) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    this.elapsed += dt;

    this.speed = Math.min(MAX_SPEED, this.speed + SPEED_RAMP * this.character.speedMod * this.perks.speedScale * dt);
    const passiveMod = 1 + (this.character.flairMod - 1) * PASSIVE_FLAIR_WEIGHT;
    this.score += this.speed * dt * PASSIVE_SCORE_RATE * passiveMod;
    this.scoreText.setText(Math.floor(this.score).toString());

    this.updateTimers(dt);
    this.updatePlayerPose(dt);
    this.scrollRoad(dt);
    this.updateSpawning(dt);
    this.updateObstacles(dt);
  }

  private updateTimers(dt: number): void {
    if (this.jumpTimer > 0) this.jumpTimer = Math.max(0, this.jumpTimer - dt * 1000);
    if (this.duckTimer > 0) this.duckTimer = Math.max(0, this.duckTimer - dt * 1000);
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt * 1000);
  }

  private updatePlayerPose(dt: number): void {
    this.bobPhase += dt * 12 * (0.6 + this.speed / MAX_SPEED);
    const idleBob = Math.sin(this.bobPhase) * 6;

    let yOffset = idleBob;
    let scaleX = 1;
    let scaleY = 1;

    if (this.jumpTimer > 0) {
      const t = this.jumpTimer / (JUMP_MS * (this.character.timingMod ?? 1)); // 1 -> 0
      const arc = Math.sin((1 - t) * Math.PI); // 0 -> 1 -> 0
      yOffset = idleBob - arc * 90;
      scaleY = 1 + arc * 0.18;
      scaleX = 1 - arc * 0.1;
    } else if (this.duckTimer > 0) {
      const t = this.duckTimer / (DUCK_MS * (this.character.timingMod ?? 1));
      const arc = Math.sin((1 - t) * Math.PI);
      yOffset = idleBob + arc * 18;
      scaleY = 1 - arc * 0.35;
      scaleX = 1 + arc * 0.22;
    } else {
      // subtle squash on idle bounce ground contact
      const squash = Math.max(0, Math.sin(this.bobPhase));
      scaleY = 1 - squash * 0.04;
      scaleX = 1 + squash * 0.03;
    }

    this.shadow.x = this.playerSprite.x;
    this.shadow.setScale(1 + Math.min(0, yOffset) / 180);
    this.playerSprite.y = PLAYER_Y + yOffset;
    this.playerSprite.setScale(scaleX, scaleY);

    if (this.invulnTimer > 0) {
      this.playerSprite.setAlpha(Math.floor(this.invulnTimer / 80) % 2 === 0 ? 0.35 : 1);
    } else {
      this.playerSprite.setAlpha(1);
    }

    // pogs ride the footpeg at the base of the stick; the yoyo swings off the handle
    this.pogStack?.setPosition(this.playerSprite.x, this.playerSprite.y + 30);
    this.yoyoDangle?.setPosition(this.playerSprite.x + 15, this.playerSprite.y + 1);
    this.yoyoDangle?.setRotation(Math.sin(this.bobPhase * 0.4) * 0.2);
  }

  private async loadGearVisuals(): Promise<void> {
    const loadout = await getLoadout();
    if (!this.scene.isActive() || this.gameOver) return;

    if (loadout.pog.tier > 0) {
      const flavor = POG_TIERS[loadout.pog.tier];
      const container = this.add.container(this.playerSprite.x, this.playerSprite.y + 30);
      for (let i = 0; i < loadout.pog.tier; i++) {
        container.add(this.add.circle(0, -i * 4, 5, flavor.color).setStrokeStyle(1, 0x000000, 0.3));
      }
      container.setDepth(9);
      this.pogStack = container;
    }

    if (loadout.yoyo.tier > 0) {
      const flavor = YOYO_TIERS[loadout.yoyo.tier];
      const container = this.add.container(this.playerSprite.x + 15, this.playerSprite.y + 1);
      container.add(this.add.rectangle(0, 6, 1.5, 12, 0xd4d4d8));
      container.add(this.add.circle(0, 14, 6, flavor.color).setStrokeStyle(1, 0x000000, 0.35));
      container.setDepth(11);
      this.yoyoDangle = container;
    }
  }

  private scrollRoad(dt: number): void {
    const dy = this.speed * dt;
    for (const line of this.roadLines) {
      line.y += dy;
      if (line.y > HEIGHT + 30) line.y -= 1000;
    }
  }

  private updateSpawning(dt: number): void {
    this.nextSpawnAt -= dt;
    if (this.nextSpawnAt > 0) return;

    const difficulty = Phaser.Math.Clamp(this.elapsed / 45, 0, 1);
    this.nextSpawnAt = Phaser.Math.FloatBetween(0.85, 1.5) - difficulty * 0.35;

    const lane = Phaser.Math.Between(0, LANE_X.length - 1);
    const roll = Math.random();
    const starChance = 0.16 + (this.character.pickupBonus ?? 0);
    let type: ObstacleType;
    if (roll < starChance) type = 'star';
    else if (roll < starChance + 0.45) type = 'hurdle';
    else type = 'banner';

    const sprite = this.add.sprite(LANE_X[lane], -40, type);
    sprite.setDepth(5);
    if (type === 'hurdle') sprite.y = -40;
    if (type === 'banner') sprite.y = -70; // sits "overhead" visually, still same collision band

    this.obstacles.push({ sprite, lane, type, resolved: false });
  }

  private updateObstacles(dt: number): void {
    const dy = this.speed * dt;
    const keep: Obstacle[] = [];

    for (const ob of this.obstacles) {
      if (!ob.sprite.active) continue;
      ob.sprite.y += dy;

      if (!ob.resolved && ob.lane === this.lane && ob.sprite.y > PLAYER_Y - 34 && ob.sprite.y < PLAYER_Y + 34) {
        this.resolveObstacle(ob);
      }

      if (ob.sprite.y > HEIGHT + 60) {
        ob.sprite.destroy();
      } else if (ob.sprite.active) {
        keep.push(ob);
      }
    }

    this.obstacles = keep;
  }

  private resolveObstacle(ob: Obstacle): void {
    ob.resolved = true;

    if (ob.type === 'star') {
      this.onTrickSuccess(ob, 40 + this.perks.starBonus, 'STAR!');
      return;
    }

    const dodgedByAir = ob.type === 'hurdle' && this.jumpTimer > 0;
    const dodgedByDuck = ob.type === 'banner' && this.duckTimer > 0;

    if (dodgedByAir || dodgedByDuck) {
      this.onTrickSuccess(ob, 18 + this.perks.trickBonus + (this.character.trickBonus ?? 0), ob.type === 'hurdle' ? 'HOP!' : 'DUCK!');
    } else {
      this.onHit(ob);
    }
  }

  private onTrickSuccess(ob: Obstacle, basePoints: number, label: string): void {
    this.combo += 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const multiplier = 1 + Math.min(this.combo, 12) * 0.12 * (this.character.flairMod + this.perks.flair);
    const gained = Math.round(basePoints * multiplier);
    this.score += gained;

    this.comboText.setText(this.combo >= 2 ? `combo x${this.combo}` : '');
    this.tweens.add({ targets: this.comboText, scale: { from: 1.4, to: 1 }, duration: 180, ease: 'Back.Out' });

    this.particles.emitParticleAt(ob.sprite.x, PLAYER_Y, 14);
    this.cameras.main.shake(80, 0.003);

    const floatText = this.add
      .text(ob.sprite.x, PLAYER_Y - 40, `+${gained} ${label}`, {
        fontSize: '16px',
        fontFamily: 'system-ui, sans-serif',
        fontStyle: 'bold',
        color: '#f9d64b',
      })
      .setOrigin(0.5)
      .setDepth(40);
    this.tweens.add({
      targets: floatText,
      y: PLAYER_Y - 90,
      alpha: 0,
      duration: 550,
      onComplete: () => floatText.destroy(),
    });

    ob.sprite.destroy();
  }

  private onHit(ob: Obstacle): void {
    if (this.invulnTimer > 0) {
      ob.sprite.destroy();
      return;
    }

    if (this.shields > 0) {
      // an equipped pog eats the hit: no life lost, combo survives
      this.shields -= 1;
      this.invulnTimer = INVULN_MS;
      this.updateHearts();
      this.cameras.main.flash(140, 56, 189, 248);
      ob.sprite.destroy();
      return;
    }

    this.lives -= 1;
    this.combo = 0;
    this.comboText.setText('');
    this.invulnTimer = INVULN_MS;
    this.updateHearts();

    this.cameras.main.shake(180, 0.01);
    this.cameras.main.flash(140, 239, 68, 68);
    ob.sprite.destroy();

    if (this.lives <= 0 && this.perks.secondWind && !this.secondWindUsed) {
      this.secondWindUsed = true;
      this.lives = 1;
      this.invulnTimer = INVULN_MS * 2;
      this.updateHearts();
      this.cameras.main.flash(260, 249, 214, 75);
      return;
    }

    if (this.lives <= 0) {
      this.endRun();
    }
  }

  private updateHearts(): void {
    const full = Math.max(0, this.lives);
    this.heartsText.setText(`♥ ${full}${this.shields ? `  ⛨ ${this.shields}` : ''}`);
  }

  private endRun(): void {
    this.gameOver = true;
    const finalScore = Math.floor(this.score);

    this.time.delayedCall(400, () => {
      void recordRun(finalScore, this.character.id, this.elapsed).then((outcome) => {
        const result: RunResult = {
          score: finalScore,
          bestCombo: this.bestCombo,
          characterId: this.character.id,
          leveledUp: outcome.leveledUp,
          newTierId: outcome.profile.tier,
          justUnlockedCircuit: outcome.justUnlockedCircuit,
          techPointsGranted: outcome.techPointsGranted,
          circuitMatch: outcome.circuitMatch
            ? {
                opponentName: outcome.circuitMatch.opponent.name,
                opponentEmoji: outcome.circuitMatch.opponent.emoji,
                yourScore: outcome.circuitMatch.yourScore,
                opponentScore: outcome.circuitMatch.opponentScore,
                battleScore: outcome.circuitMatch.battleScore,
                advantagePercent: outcome.circuitMatch.advantage.percent,
                setupPath: outcome.circuitMatch.advantage.path,
                won: outcome.circuitMatch.won,
              }
            : null,
        };
        this.registry.set(REGISTRY_KEY_LAST_RESULT, result);
        this.scene.start('GameOver');
      });
    });
  }
}

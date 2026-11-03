import Phaser from 'phaser';
import type { BossCtx, BossDef, BossState } from './realmBosses';
import type { RealmEnemyId } from './realmEnemies';
import { TILE } from './worldGen';

/**
 * Every hero has one enemy who is theirs alone. Each nemesis is a rotation of
 * shared moves with its own order, speed, hazards and lines, so a new one is
 * data. Between moves it rests: that's the opening, and contact is harmless.
 */
export type NemesisMove = 'dash' | 'volley' | 'rain' | 'wave' | 'summon' | 'blink';

export interface NemesisDef {
  heroId: string;
  id: string;
  name: string;
  title: string;
  taunt: string;
  defeat: string;
  flies: boolean;
  moves: NemesisMove[];
  summon: RealmEnemyId;
  bolt: string;
  rain: string;
  /** scales how quickly it moves on */
  tempo: number;
}

export const NEMESES: Record<string, NemesisDef> = {
  cleo: { heroId: 'cleo', id: 'nem_cleo', name: 'Octavia the Hall Monitor', title: 'She has your name on a list', taunt: 'Everyone votes for me in the end, Cleo.', defeat: 'The list burns. Nobody is keeping score of you now.', flies: false, moves: ['volley', 'dash', 'summon', 'volley', 'blink'], summon: 'slime', bolt: 'fx_soul', rain: 'fx_soul', tempo: 1 },
  khan: { heroId: 'khan', id: 'nem_khan', name: 'The Great Wall', title: 'It was built to keep you out', taunt: 'BRICK BY BRICK. GATE BY GATE. YOU SHALL NOT PASS.', defeat: 'The wall comes down, and past it is only open country.', flies: false, moves: ['wave', 'dash', 'rain', 'wave', 'summon'], summon: 'crawler', bolt: 'fx_gear', rain: 'fx_gear', tempo: 0.82 },
  joan: { heroId: 'joan', id: 'nem_joan', name: 'Headmaster Cauchon', title: 'He wrote your verdict in advance', taunt: 'The hearing is over, child. It was over before you came in.', defeat: 'His verdict is ash. This time you were the one still standing.', flies: true, moves: ['rain', 'volley', 'blink', 'rain', 'dash'], summon: 'wraith', bolt: 'fx_flame', rain: 'fx_flame', tempo: 1 },
  einstein: { heroId: 'einstein', id: 'nem_einstein', name: 'Gottfried the Rival Proof', title: 'He claims he solved it first', taunt: 'I published first, Isaac. I always publish first.', defeat: 'Q.E.D. Let them argue about the footnotes.', flies: true, moves: ['volley', 'blink', 'volley', 'rain', 'dash'], summon: 'wraith', bolt: 'fx_bubble', rain: 'fx_pog', tempo: 1.15 },
  ada: { heroId: 'ada', id: 'nem_ada', name: 'The Difference Engine', title: 'It never gets a sum wrong', taunt: 'PROBABILITY OF YOUR SUCCESS: 0.0000', defeat: 'Rounding error found. It was you all along.', flies: false, moves: ['dash', 'wave', 'volley', 'summon', 'dash'], summon: 'crawler', bolt: 'fx_gear', rain: 'fx_gear', tempo: 1.05 },
  suntzu: { heroId: 'suntzu', id: 'nem_suntzu', name: 'The Mirror General', title: 'He knows every plan you have', taunt: 'Know yourself? I do. I am you, with better posture.', defeat: 'He read everything you ever wrote, and it still wasn\'t enough.', flies: false, moves: ['blink', 'summon', 'blink', 'volley', 'dash'], summon: 'knight', bolt: 'fx_soul', rain: 'fx_soul', tempo: 1.1 },
  frida: { heroId: 'frida', id: 'nem_frida', name: 'The Living Canvas', title: 'Your unfinished work, finished with you', taunt: 'You left me half painted. I can fix that. Hold still.', defeat: 'The paint dries. Now you can sign it.', flies: true, moves: ['rain', 'wave', 'volley', 'summon', 'rain'], summon: 'imp', bolt: 'fx_flame', rain: 'fx_bubble', tempo: 0.95 },
  leo: { heroId: 'leo', id: 'nem_leo', name: 'The Marble Titan', title: 'Your rival carved it to prove a point', taunt: 'A painter who tinkers? Stand there and be measured.', defeat: 'Beautiful work. It took you apart and you took it apart better.', flies: false, moves: ['wave', 'rain', 'dash', 'volley', 'summon'], summon: 'knight', bolt: 'fx_pog', rain: 'fx_gear', tempo: 0.9 },
};

export function nemesisFor(heroId: string): NemesisDef {
  return NEMESES[heroId] ?? NEMESES.cleo;
}

/** tougher as the hero grows, so the fight stays a fight whenever you take it */
export function nemesisBossDef(heroId: string, level: number): BossDef {
  const n = nemesisFor(heroId);
  return { id: n.id as BossDef['id'], name: n.name, texture: `boss_${n.id}`, hp: 620 + level * 40, contactDamage: 12 + Math.floor(level / 2), flies: n.flies };
}

const REST_MS = 1500;
/** every attack's wind-up: long enough to see it and move */
const TELL_MS = 760;
/** how far above the floor a flying nemesis rests: inside a jumping swing's reach */
const HOVER_PX = 92;

export function isNemesis(b: BossState): boolean {
  return String(b.def.id).startsWith('nem_');
}

export function updateNemesis(b: BossState, ctx: BossCtx, dt: number): void {
  const n = nemesisFor(String(b.def.id).slice(4));
  const body = b.sprite.body as Phaser.Physics.Arcade.Body;
  const { player, arena } = ctx;
  const angry = b.hp <= b.def.hp / 2;
  const pace = n.tempo * (angry ? 1.3 : 1);
  const toward = player.x < b.sprite.x ? -1 : 1;
  b.timer -= dt * pace;
  b.sprite.setFlipX(toward < 0);

  const aimed = (speed: number, spread = 0) => {
    const a = Math.atan2(player.y - 20 - b.sprite.y, player.x - b.sprite.x) + spread;
    return { vx: Math.cos(a) * speed, vy: Math.sin(a) * speed };
  };
  const damage = Math.round(b.def.contactDamage * 0.6);

  switch (b.phase) {
    case 'rest': {
      b.sprite.clearTint();
      // it closes the distance while it rests, so the opening is always worth taking
      const far = Math.abs(player.x - b.sprite.x) > 150;
      if (n.flies) {
        const hover = arena.floorY - HOVER_PX + Math.sin(b.timer / 200) * 10;
        body.setVelocity(toward * (far ? 95 : 30), Phaser.Math.Clamp((hover - b.sprite.y) * 3, -140, 140));
      } else body.setVelocityX(toward * (far ? 80 : 22));
      if (b.timer <= 0) {
        const move = n.moves[(b.data.step ?? 0) % n.moves.length];
        b.data.step = (b.data.step ?? 0) + 1;
        b.phase = `tell_${move}`;
        b.timer = TELL_MS;
        body.setVelocity(0, 0);
        b.sprite.setTint(move === 'dash' || move === 'blink' ? 0xff6b6b : 0xfde68a);
      }
      break;
    }
    case 'tell_dash':
      if (b.timer <= 0) { b.phase = 'dash'; b.timer = 520; b.data.dir = toward; b.sprite.setTint(0xff6b6b); }
      break;
    case 'dash':
      body.setVelocity(b.data.dir * 380, 0);
      if (b.timer <= 0 || body.blocked.left || body.blocked.right) { body.setVelocity(0, 0); ctx.shake(120, 0.005); toRest(b); }
      break;
    case 'tell_volley':
      if (b.timer <= 0) {
        const shots = angry ? 4 : 3;
        for (let i = 0; i < shots; i++) {
          const v = aimed(205, (i - (shots - 1) / 2) * 0.24);
          ctx.hazard({ x: b.sprite.x, y: b.sprite.y - 30, texture: n.bolt, vx: v.vx, vy: v.vy, damage, lifespanMs: 2600 });
        }
        toRest(b);
      }
      break;
    case 'tell_rain':
      if (b.timer <= 0) {
        const drops = angry ? 7 : 5;
        for (let i = 0; i < drops; i++) {
          const x = Phaser.Math.Clamp(player.x + (i - (drops - 1) / 2) * 3.6 * TILE, arena.x0 + TILE * 2, arena.x1 - TILE * 2);
          ctx.hazard({ x, y: arena.floorY - TILE * 15 - (i % 2) * TILE * 3, texture: n.rain, vx: 0, vy: 230, damage, lifespanMs: 2400, solidStops: true });
        }
        toRest(b);
      }
      break;
    case 'tell_wave':
      if (b.timer <= 0) {
        for (const dir of [-1, 1]) {
          ctx.hazard({ x: b.sprite.x + dir * 30, y: arena.floorY - 18, texture: 'fx_wave', vx: dir * 240, vy: 0, damage, lifespanMs: 2300 });
        }
        ctx.shake(160, 0.006);
        toRest(b);
      }
      break;
    case 'tell_summon':
      if (b.timer <= 0) {
        if ((b.data.summoned ?? 0) < 4) {
          b.data.summoned = (b.data.summoned ?? 0) + 2;
          for (const dir of [-1, 1]) ctx.summon(n.summon, Phaser.Math.Clamp(b.sprite.x + dir * 90, arena.x0 + TILE * 3, arena.x1 - TILE * 3), arena.floorY - TILE * 2);
        } else {
          const v = aimed(205);
          ctx.hazard({ x: b.sprite.x, y: b.sprite.y - 30, texture: n.bolt, vx: v.vx, vy: v.vy, damage, lifespanMs: 2400 });
        }
        toRest(b);
      }
      break;
    case 'tell_blink':
      b.sprite.setAlpha(Math.max(0.1, b.timer / TELL_MS));
      if (b.timer <= 0) {
        const behind = player.flipX ? 1 : -1;
        const x = Phaser.Math.Clamp(player.x + behind * 74, arena.x0 + TILE * 2, arena.x1 - TILE * 2);
        body.reset(x, n.flies ? arena.floorY - HOVER_PX : arena.floorY);
        b.sprite.setAlpha(1).setTint(0xff6b6b);
        b.phase = 'blinkStrike';
        b.timer = 520;
      }
      break;
    case 'blinkStrike':
      if (b.timer <= 0) { b.data.dir = toward; b.phase = 'dash'; b.timer = 300; }
      break;
    default:
      toRest(b);
  }
}

function toRest(b: BossState): void {
  b.phase = 'rest';
  b.timer = REST_MS;
  b.sprite.clearTint();
  b.sprite.setAlpha(1);
}

/** it can only be struck when it isn't mid-vanish; a rest is worth 25% extra */
export function nemesisHitScale(b: BossState): number {
  if (b.phase === 'tell_blink') return 0;
  return b.phase === 'rest' ? 1.25 : 1;
}

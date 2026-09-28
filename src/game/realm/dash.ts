import type { World } from './worldGen';
import { SHRINE_OFFSET, SHRINE_W } from './worldGen';

/**
 * Pogo Dash, in the world: Dash Trials are gate courses across the
 * overworld surface. Pass every gate in order before time runs out; stars
 * and stomps pay extra, and finishing under par pays per second saved.
 * High gates want a held-jump super bounce, so the pogo stick is the way
 * to gold, though nothing stops you running it on foot.
 *
 * Scoring   gate 100 · star 40 · stomp 25 × stomp chain · 25 per second under par
 * Hardcore  one hit ends the run, for ×1.5 on everything but the gates themselves
 * Rewards   the first bronze/silver/gold on each course pays materials and XP,
 *           first gold pays a Tech Point; your Pogo Rank (the sum of your best
 *           scores) pays a Tech Point at each new rank
 */
export const GATE_POINTS = 100;
export const STAR_POINTS = 40;
export const STOMP_POINTS = 25;
export const PAR_POINTS_PER_S = 25;
export const HARDCORE_MULT = 1.5;
/** a course is abandoned at twice its par */
export const TIME_LIMIT_PARS = 2;

export interface DashCourse {
  id: string;
  name: string;
  blurb: string;
  night: boolean;
  start: { x: number; y: number };
  gates: { x: number; y: number }[];
  stars: { x: number; y: number }[];
  par: number;
  /** bronze, silver, gold */
  medals: [number, number, number];
}

export const MEDALS = ['', '🥉 bronze', '🥈 silver', '🥇 gold'];

export const MEDAL_REWARDS: { xp: number; items: Partial<Record<'copper' | 'iron' | 'potion' | 'soulstone' | 'torch', number>> }[] = [
  { xp: 0, items: {} },
  { xp: 60, items: { copper: 8, torch: 4 } },
  { xp: 140, items: { iron: 6, potion: 2 } },
  { xp: 300, items: { soulstone: 4, potion: 3 } },
];

/** Pogo Rank from the sum of best course scores; each rank-up is a Tech Point milestone */
export const POGO_RANKS: { name: string; points: number }[] = [
  { name: 'Rookie', points: 0 },
  { name: 'Amateur', points: 1500 },
  { name: 'Varsity', points: 4000 },
  { name: 'Semi-Pro', points: 7000 },
  { name: 'Pro', points: 10_000 },
  { name: 'Elite', points: 13_000 },
];

export function pogoRank(total: number): number {
  let r = 0;
  POGO_RANKS.forEach((rank, i) => { if (total >= rank.points) r = i; });
  return r;
}

export function medalFor(course: DashCourse, score: number): number {
  return course.medals.filter((m) => score >= m).length;
}

export function scoreRun(course: DashCourse, r: { gates: number; stars: number; stompPoints: number; seconds: number; hardcore: boolean }): number {
  const bonus = r.stars * STAR_POINTS + r.stompPoints + Math.max(0, course.par - r.seconds) * PAR_POINTS_PER_S;
  return Math.round(r.gates * GATE_POINTS + bonus * (r.hardcore ? HARDCORE_MULT : 1));
}

/**
 * Pars assume the pogo stick (~235 px/s) plus a little per gate for the
 * climbs: on foot you'll finish, but you won't beat par.
 * Three courses, laid over the generated surface (px, gates hang above the
 * ground). Heights are in tiles above the highest ground nearby; anything
 * over ~5 needs a super bounce.
 */
export function planCourses(world: World): DashCourse[] {
  /** the highest ground within two columns, so a gate never sits inside a hillside */
  const ground = (tx: number) => {
    let s = world.h;
    for (let x = tx - 2; x <= tx + 2; x++) s = Math.min(s, world.surface[Math.max(0, Math.min(world.w - 1, x))]);
    return s;
  };
  const make = (id: string, name: string, blurb: string, night: boolean, startTx: number, dir: 1 | -1, spacing: number, heights: number[], par: number): DashCourse => {
    const gates = heights.map((h, i) => {
      const tx = startTx + dir * (i + 1) * spacing;
      return { x: (tx + 0.5) * 16, y: (ground(tx) - h) * 16 };
    });
    const stars = gates.slice(0, -1).map((g, i) => {
      const n = gates[i + 1];
      const tx = Math.round(((g.x + n.x) / 2) / 16);
      return { x: (g.x + n.x) / 2, y: Math.min(g.y, n.y, (ground(tx) - 3) * 16) - 40 };
    });
    const clean = gates.length * GATE_POINTS;
    const allStars = stars.length * STAR_POINTS;
    const medals: [number, number, number] = [clean, Math.round(clean + allStars * 0.5 + par * 0.15 * PAR_POINTS_PER_S), Math.round(clean + allStars * 0.85 + par * 0.3 * PAR_POINTS_PER_S)];
    return { id, name, blurb, night, start: { x: (startTx + 0.5) * 16, y: world.surface[startTx] * 16 }, gates, stars, par, medals };
  };
  const sx = world.spawn.tx;
  return [
    // ends short of the Forever Gate (shrine + 30), which is solid while sealed
    make('sprint', 'Shrine Sprint', 'across the shrine plaza · low gates · a warm-up', false, sx + 2, 1, 5, [2, 3, 2, 4, 3, 2, 3], 5),
    make('ridge', 'Ridge Run', 'the eastern hills · high gates want a super bounce', false, sx + SHRINE_OFFSET + SHRINE_W + 16, 1, 10, [3, 5, 2, 6, 4, 7, 3, 5, 6, 4, 7, 3], 14),
    make('night', 'Night Circuit', 'the western dark · only after dusk · wraiths about', true, sx - 100, -1, 10, [4, 6, 3, 8, 5, 7, 4, 9, 6, 5, 8, 4], 16),
  ];
}

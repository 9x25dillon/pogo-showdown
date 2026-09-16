/** deterministic PRNG so the same date+key always simulates the same result */
function hashStringToSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** deterministic float in [0,1) seeded from an arbitrary string key */
export function seededRandom(key: string): number {
  return mulberry32(hashStringToSeed(key))();
}

/** deterministic float in [min,max) seeded from an arbitrary string key */
export function seededRange(key: string, min: number, max: number): number {
  return min + seededRandom(key) * (max - min);
}

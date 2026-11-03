import { WEAPONS } from './weapons';
import { NEMESES } from './nemesis';
import { characterById } from './hero';

/**
 * Eternity High's story, as data. Story Mode is six chapters through the same
 * open world, about an hour long, with a line or two written for each hero.
 * Rules live here; RealmStory runs them and RealmDialogue shows them.
 */
export type Speaker = 'clio' | 'hero' | 'nemesis' | 'reaper' | 'narrator';

export interface StoryChoice {
  id: string;
  label: string;
}

export interface StoryLine {
  who: Speaker;
  text: string;
  /** a question with buttons: the answer goes in StorySave.choices under `ask` */
  ask?: string;
  choices?: StoryChoice[];
}

export interface StorySave {
  chapter: number;
  /** the highest chapter whose opening scene has played, -1 before the first */
  played: number;
  choices: Record<string, string>;
  /** the Reaper is down and the ending has been seen */
  finished: boolean;
}

export const newStory = (): StorySave => ({ chapter: 0, played: -1, choices: {}, finished: false });

/** what the world can tell the story */
export interface StoryProgress {
  heroId: string;
  wood: number;
  sword: number;
  pickaxe: number;
  relics: number;
  sigil: boolean;
  forged: boolean;
  champion: boolean;
}

export interface StoryObjective {
  text: (p: StoryProgress) => string;
  done: (p: StoryProgress) => boolean;
}

export interface Chapter {
  title: string;
  scene: (heroId: string) => StoryLine[];
  objectives: StoryObjective[];
  /** what Ms. Clio tells you if you ask her again */
  hint: (heroId: string) => string;
}

/** each hero's own reason for being here, in their own voice */
export const HERO_VOICE: Record<string, { why: string; nemesis: string; forged: string; last: string }> = {
  cleo: {
    why: 'I asked who approved the timetable. I run this school, and nobody could tell me.',
    nemesis: 'Octavia has kept a list of me since freshman year. Time she met the woman on it.',
    forged: 'A queen should carry something heavier than a clipboard.',
    last: 'Next election, the voters get to be older than sixteen.',
  },
  khan: {
    why: 'I walked out of the gym and kept walking. The fence was only ever a suggestion.',
    nemesis: 'They built a wall to keep me in. They always do. It never helps them.',
    forged: 'It breaks hordes. I was promised hordes.',
    last: 'Open country. All of it. I am going to need a bigger team bus.',
  },
  joan: {
    why: 'I heard the bell ring and something under it. A voice saying this was wrong. I said so, out loud.',
    nemesis: 'Cauchon wrote my verdict before my hearing. I would like to appeal.',
    forged: 'This time the fire is on my side.',
    last: 'Nobody gets to write my ending for me again.',
  },
  einstein: {
    why: 'I timed the school day. Then I timed it again. It has been 3:00 for longer than the universe allows.',
    nemesis: 'Gottfried says he solved all this first. He is going to explain it to my sword.',
    forged: 'White light in, every answer out. I knew I should have started with optics.',
    last: 'Every action has an equal and opposite reaction. They should have thought of that.',
  },
  ada: {
    why: 'The bell schedule loops. I wrote out the program for it, and it has no exit condition.',
    nemesis: 'It never gets a sum wrong. So I will change what it is adding up.',
    forged: 'Every third hit is not luck. I checked my work.',
    last: 'Program terminated. I always did want to see what comes after.',
  },
  suntzu: {
    why: 'I stood in the doorway at the Last Bell to study how the hall emptied. It noticed me studying.',
    nemesis: 'He has read everything I wrote. Good. Then he believes I will do what I wrote.',
    forged: 'The best blade is the one you never needed to draw. I am drawing it anyway.',
    last: 'The supreme art is to end the war before lunch.',
  },
  frida: {
    why: 'I painted the school as it is, and the painting aged. Nothing else here does. Then they came for it.',
    nemesis: 'I left that canvas half finished and it has not forgiven me. Fair enough. I will finish it.',
    forged: 'Red the colour of everything they told me to paint over.',
    last: 'Now I can paint something that changes.',
  },
  leo: {
    why: 'I took the clock tower apart to see how it worked. There is nothing inside. Nothing at all.',
    nemesis: 'A rival carved a titan out of marble to prove a point about me. I respect the craft. I will take it apart.',
    forged: 'I drew this at twelve. It took me until now to find out why.',
    last: 'I have four hundred new ideas and, finally, the time to be late for them.',
  },
};

const has = (n: number, need: number) => `${Math.min(n, need)}/${need}`;

export const CHAPTERS: Chapter[] = [
  {
    title: 'The Last Bell',
    scene: (id) => [
      { who: 'narrator', text: 'Eternity High keeps history\'s icons as teenagers. One school day, the same one, forever. Nobody remembers agreeing to it.' },
      { who: 'narrator', text: 'Ask the wrong question, and at the Last Bell the Eternal Reaper signs you into detention. Detention is a world.' },
      { who: 'clio', text: `There you are, ${characterById(id).name}. I am Ms. Clio. I run the library, and I am the only one here who writes anything down.` },
      { who: 'hero', text: HERO_VOICE[id].why },
      { who: 'clio', text: 'Then you are right, and you are in trouble. What did you do when the bell rang? Be honest. It goes in the record.',
        ask: 'bell', choices: [
          { id: 'fight', label: 'I fought it  (gift: Whetstone)' },
          { id: 'run', label: 'I ran  (gift: Swift Boots)' },
          { id: 'ask', label: 'I asked why  (gift: Keen Lens)' },
        ] },
      { who: 'clio', text: 'Noted. Everything in this world can be reused, and you start with nothing. Trees first. Walk up to one and hold your pickaxe on the trunk.' },
    ],
    objectives: [{ text: (p) => `Chop a tree for wood ${has(p.wood, 6)}`, done: (p) => p.wood >= 6 }],
    hint: () => 'Stand next to a tree, pick the ⛏ on your hotbar, and hold USE on the trunk. The whole tree comes down.',
  },
  {
    title: 'Hall Pass',
    scene: () => [
      { who: 'clio', text: 'Good. The realm is made of the school: the walls, the lockers, everyone who ever failed. Dig, and it gives some of that back.' },
      { who: 'clio', text: 'Copper shows orange in the rock. Dig down until you find it, then craft a pickaxe and a blade at your bench. Things come out at night here.' },
    ],
    objectives: [
      { text: (p) => `Craft a Copper Pickaxe ${p.pickaxe >= 1 ? '✓' : ''}`, done: (p) => p.pickaxe >= 1 },
      { text: (p) => `Craft a Copper Falchion ${p.sword >= 1 ? '✓' : ''}`, done: (p) => p.sword >= 1 },
    ],
    hint: () => 'Dig straight down from the surface and watch for orange ore. A pickaxe takes 10 copper and 3 wood, a Falchion 8 copper and 2 wood. Open ⚒ CRAFT from anywhere.',
  },
  {
    title: 'Field Trip',
    scene: () => [
      { who: 'clio', text: 'The shrine east of here is the old trophy hall. Each door leads to a realm the Reaper built from a school that failed before this one.' },
      { who: 'clio', text: 'Whoever rules a realm keeps a relic. Take one. Start with the Ember door, and bring something for the heat.' },
    ],
    objectives: [{ text: (p) => `Win a relic in the shrine's realms ${has(p.relics, 1)}`, done: (p) => p.relics >= 1 }],
    hint: () => 'Walk east to the shrine and stand in the Ember door. At the bench, Fire Ward and Healing Draught are worth their herbs. The boss waits at the far end.',
  },
  {
    title: 'Permanent Record',
    scene: (id) => [
      { who: 'clio', text: 'You took a relic, so the Reaper has opened your file. Everybody here has a file, and everybody has someone assigned to it.' },
      { who: 'clio', text: `Yours is ${NEMESES[id].name}. ${NEMESES[id].title}. Open your QUEST page when you are ready. Your name is already on the door.` },
      { who: 'hero', text: HERO_VOICE[id].nemesis },
    ],
    objectives: [{ text: (p) => `Beat ${NEMESES[p.heroId].name} in the Detention Hall`, done: (p) => p.sigil }],
    hint: (id) => `Open HERO, then QUEST, and walk into detention. ${NEMESES[id].name} is harmless and takes extra damage while resting between moves. Hit it then.`,
  },
  {
    title: 'The Forge',
    scene: (id) => [
      { who: 'nemesis', text: NEMESES[id].defeat },
      { who: 'clio', text: `That sigil is the first page of your record that you wrote yourself. It can forge ${WEAPONS[id].name}, a weapon no one else can carry.` },
      { who: 'clio', text: `${WEAPONS[id].gatherText}. Your nemesis already paid for the rest. Forge it on your QUEST page.` },
    ],
    objectives: [{ text: (p) => `Forge ${WEAPONS[p.heroId].name} (HERO › QUEST)`, done: (p) => p.forged }],
    hint: (id) => `${WEAPONS[id].name}: ${WEAPONS[id].power} The QUEST page counts what you still need.`,
  },
  {
    title: 'The Forever Gate',
    scene: (id) => [
      { who: 'hero', text: HERO_VOICE[id].forged },
      { who: 'clio', text: 'Then it is time. I have kept the school trophy case locked since the first bell. Here is what is in it: all four relics. Borrowed, and I want it in the record that I said so.' },
      { who: 'clio', text: 'The Forever Gate stands at the far end of the shrine, past the fourth door. Behind it is the Reaper\'s office. End the school day.' },
    ],
    objectives: [{ text: () => 'Pass the Forever Gate and end the Eternal Reaper', done: (p) => p.champion }],
    hint: () => 'The relics make you fireproof, let you breathe water and give you a double jump. Look for the gold mark on your map. Keep moving through the Eternal Hall, and hit the Reaper when it stands exposed after striking.',
  },
];

/** the last scene, after the Reaper falls: the answer changes the ending */
export function finale(id: string): StoryLine[] {
  return [
    { who: 'reaper', text: 'You understand nothing. It was never a prison. Nobody ever failed here. Nobody ever died here. I kept you all exactly as you were.' },
    { who: 'hero', text: HERO_VOICE[id].last },
    { who: 'clio', text: 'The bell rope is yours now. Ring it and the day ends: everyone walks out into their own time, and the school is gone. Leave it, and the day goes on, but the doors stay open.',
      ask: 'ending', choices: [
        { id: 'ring', label: 'Ring the bell' },
        { id: 'stay', label: 'Leave the doors open' },
      ] },
  ];
}

export function endingLines(id: string, choice: string | undefined): string[] {
  const name = characterById(id).name;
  return choice === 'ring'
    ? [`${name} rang the Last Bell, and for the first time it stopped.`, 'The halls emptied into a thousand different years. Ms. Clio wrote it all down, then closed the book herself.']
    : [`${name} left the bell where it hung, and took the lock off every door.`, 'It is still 3:00 at Eternity High. But now anyone can leave, and some of them even come back.'];
}

export function chapterDone(c: Chapter, p: StoryProgress): boolean {
  return c.objectives.every((o) => o.done(p));
}

/** the first thing still to do, for the HUD */
export function objectiveText(c: Chapter, p: StoryProgress): string {
  return (c.objectives.find((o) => !o.done(p)) ?? c.objectives[c.objectives.length - 1]).text(p);
}

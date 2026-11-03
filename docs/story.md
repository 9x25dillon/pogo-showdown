# Eternity High: story bible

**Premise.** Eternity High keeps history's icons as teenagers, in one school day that never ends. It is always three o'clock. Anyone who questions the timetable is signed into detention at the Last Bell by the Eternal Reaper, and detention is the Forever Realm: a world built from the school and everyone who ever failed it.

**Ms. Clio** is the school librarian, an original character based on the muse of history. She is the only one who writes anything down. She stands near spawn in every world and repeats the current objective if asked.

**The Reaper's defence:** it was never a prison. Nobody failed here and nobody died here. It kept everyone exactly as they were. The last choice is whether that was worth ending.

## Story Mode: six chapters, about an hour

| # | Chapter | Objective | Teaches |
|---|---|---|---|
| 1 | The Last Bell | Chop a tree for 6 wood | Harvesting. A choice gives your first component |
| 2 | Hall Pass | Craft a Copper Pickaxe and Falchion | Digging and the bench |
| 3 | Field Trip | Win one relic | Realms and bosses |
| 4 | Permanent Record | Beat your nemesis | The QUEST page and the Detention Hall |
| 5 | The Forge | Forge your weapon | Gathering, and your hero's own power |
| 6 | The Forever Gate | End the Reaper | Clio lends you all four relics. The final choice sets the ending |

## Heroes

| Hero (save id) | Nemesis | Weapon and power | Ultimate build |
|---|---|---|---|
| Cleo P. (`cleo`) | Octavia the Hall Monitor | The Asp Sceptre: venom shockwaves at combo 5+ | The Unbroken Chain |
| Genghis K. (`khan`) | The Great Wall | Horde Breaker: every fourth swing shakes the ground | The Steppe Wall |
| Jo of Arc (`joan`) | Headmaster Cauchon | The Oriflamme: crits launch a blade of flame | The Clean Cut |
| Isaac N. (`einstein`) | Gottfried the Rival Proof | The Prism Blade: every swing fires split light | Laws of Motion |
| Ada L. (`ada`) | The Difference Engine | The Analytical Edge: every third hit crits | Perfect Program |
| Sun Tzu (`suntzu`) | The Mirror General | The Art of Edge: +30% damage at full guard | The Unassailable Plan |
| Artemisia G. (`frida`) | The Living Canvas | The Crimson Brush: every hit heals 3 HP | Living Colour |
| Leo da V. (`leo`) | The Marble Titan | The Vitruvian Engine: double drops | The Workshop |

Save ids stay as they were so existing saves keep working. Hero lines live in `src/game/realm/story.ts`.

All of it is original. Shared engine techniques (the sprite shading pass, baked parallax, the dialogue box, movement feel) are general code, not content.

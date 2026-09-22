import Phaser from 'phaser';
import { CHARACTERS } from '../data/characters';
import { COLORS, REGISTRY_KEY_LAST_PLATFORMER_RESULT, REGISTRY_KEY_PLATFORMER_LEVEL_INDEX, WIDTH } from '../config';
import { LEVELS, nextSoloLevelIndex } from '../data/levels';
import { describeActive } from '../data/pogs';
import type { PlatformerResult } from '../db/platformerResult';
import { recordQuestRun, type QuestRunReward } from '../db/questRepository';
import { masterySummary } from '../systems/characterMastery';
import { attachPadMenu } from '../ui/padMenu';

const FONT = 'system-ui, sans-serif';

function fallbackResult(): PlatformerResult {
  return { raceOutcome: 'fell', coins: 0, elapsedSeconds: 0, bestStompCombo: 0, characterId: CHARACTERS[0].id, levelIndex: 0 };
}

const OUTCOME_COPY: Record<PlatformerResult['raceOutcome'], { title: string; color: string; sub: string }> = {
  playerWon: { title: 'YOU WIN THE RACE!', color: '#4ade80', sub: 'first to the flag' },
  rivalWon: { title: 'RIVAL WINS', color: '#ef4444', sub: 'they beat you to the flag' },
  fell: { title: 'OUT OF LIVES', color: '#ef4444', sub: 'shake it off and go again' },
};

/**
 * Results are recorded exactly once per finished run, keyed by the
 * result object's identity - the scene can be re-created (e.g. a
 * resize) without double-crediting.
 */
const recorded = new WeakMap<PlatformerResult, Promise<QuestRunReward>>();

export class PlatformerResultScene extends Phaser.Scene {
  constructor() {
    super('PlatformerResult');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    const stored = this.registry.get(REGISTRY_KEY_LAST_PLATFORMER_RESULT) as PlatformerResult | undefined;
    const result = stored ?? fallbackResult();
    const character = CHARACTERS.find((c) => c.id === result.characterId) ?? CHARACTERS[0];
    const level = LEVELS[result.levelIndex] ?? LEVELS[0];
    const won = result.raceOutcome === 'playerWon';
    const copy =
      won && level.bossLevel
        ? { title: 'BOSS DOWN!', color: '#4ade80', sub: level.coop ? 'teamwork makes the dream work' : 'the champion falls' }
        : OUTCOME_COPY[result.raceOutcome];
    const next = won ? nextSoloLevelIndex(result.levelIndex) : undefined;
    const toLevels = () => this.scene.start('PlatformerLevelSelect', { tab: level.coop ? 'coop' : 'solo' });

    this.add.text(WIDTH / 2, 96, character.emoji, { fontSize: '52px' }).setOrigin(0.5);
    this.add.text(WIDTH / 2, 148, level.name, { fontSize: '13px', fontFamily: FONT, color: '#6b6180' }).setOrigin(0.5);
    this.add
      .text(WIDTH / 2, 182, copy.title, { fontSize: '26px', fontFamily: FONT, fontStyle: 'bold', color: copy.color })
      .setOrigin(0.5);
    this.add.text(WIDTH / 2, 216, copy.sub, { fontSize: '14px', fontFamily: FONT, color: '#b7aed0' }).setOrigin(0.5);

    this.add.rectangle(WIDTH / 2, 300, 360, 120, 0x1c1430).setStrokeStyle(1, 0x362a52);
    const stats = [
      `🪙 Coins collected: ${result.coins}`,
      `⏱️ Time: ${result.elapsedSeconds.toFixed(1)}s`,
      `👟 Best stomp combo: ${result.bestStompCombo}`,
    ];
    this.add
      .text(WIDTH / 2, 300, stats.join('\n'), { fontSize: '15px', fontFamily: FONT, color: '#ffffff', align: 'center', lineSpacing: 10 })
      .setOrigin(0.5);

    const rewardText = this.add
      .text(WIDTH / 2, 372, 'saving…', { fontSize: '13px', fontFamily: FONT, color: '#6b6180', align: 'center', lineSpacing: 6, wordWrap: { width: WIDTH - 60 } })
      .setOrigin(0.5, 0);
    if (stored) {
      let pending = recorded.get(stored);
      if (!pending) {
        pending = recordQuestRun(stored);
        recorded.set(stored, pending);
      }
      void pending.then(
        (reward) => { if (rewardText.active) this.showReward(rewardText, reward, character.name, won); },
        () => { if (rewardText.active) rewardText.setText(''); },
      );
    } else {
      rewardText.setText('');
    }

    const buttons: Phaser.GameObjects.Rectangle[] = [];
    let y = 560;
    if (next !== undefined) {
      buttons.push(this.makeButton(y, `NEXT: ${LEVELS[next].name.toUpperCase()}`, 0x4ade80, '#0b2417', () => {
        this.registry.set(REGISTRY_KEY_PLATFORMER_LEVEL_INDEX, next);
        this.scene.start('PlatformerRun');
      }));
      y += 68;
    }
    buttons.push(this.makeButton(y, 'RETRY', COLORS.accent, '#221a10', () => {
      this.registry.set(REGISTRY_KEY_PLATFORMER_LEVEL_INDEX, result.levelIndex);
      this.scene.start('PlatformerRun');
    }));
    y += 68;
    buttons.push(this.makeButton(y, 'LEVELS', 0x38bdf8, '#07202c', toLevels));
    y += 68;
    buttons.push(this.makeButton(y, 'MENU', 0x22c55e, '#ffffff', () => this.scene.start('ModeSelect')));
    attachPadMenu(this, buttons, { onBack: toLevels });
  }

  private showReward(text: Phaser.GameObjects.Text, reward: QuestRunReward, characterName: string, won: boolean): void {
    const lines: string[] = [];
    if (reward.firstClear) lines.push('⭐ FIRST CLEAR ⭐');
    else if (reward.newBestTime) lines.push(`⏱️ New best time!`);
    else if (won && reward.level.bestTimeSeconds !== null) lines.push(`best time ${reward.level.bestTimeSeconds.toFixed(1)}s`);
    if (reward.techPointsGranted > 0) lines.push(`⚙️ +${reward.techPointsGranted} Tech Point${reward.techPointsGranted > 1 ? 's' : ''}`);
    if (reward.rewardPog) {
      const effect = reward.rewardPog.activeEffect ? ` · ${describeActive(reward.rewardPog.activeEffect)}` : '';
      lines.push(`${reward.rewardPog.emoji} New pog: ${reward.rewardPog.name}${effect}`);
    }
    lines.push(
      reward.trainingEarned
        ? `${characterName} · ${masterySummary(reward.mastery)}`
        : `${characterName} · play 15s+ for training credit`,
    );
    text.setText(lines.join('\n')).setColor(reward.firstClear ? '#f9d64b' : '#b7aed0');
    if (reward.firstClear) this.tweens.add({ targets: text, scale: { from: 0.85, to: 1 }, duration: 260, ease: 'Back.Out' });
  }

  private makeButton(y: number, label: string, color: number, textColor: string, onTap: () => void): Phaser.GameObjects.Rectangle {
    const btn = this.add.rectangle(WIDTH / 2, y, 300, 54, color).setInteractive({ useHandCursor: true });
    this.add.text(WIDTH / 2, y, label, { fontSize: '17px', fontFamily: FONT, fontStyle: 'bold', color: textColor }).setOrigin(0.5);
    btn.on('pointerdown', () => {
      btn.disableInteractive();
      this.tweens.add({ targets: btn, scale: 0.96, duration: 80, yoyo: true, onComplete: onTap });
    });
    return btn;
  }
}

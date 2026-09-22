/**
 * Soundtrack. Scenes ask for a *cue* (what the moment is), not a file,
 * so the track list can change without touching scenes:
 *
 *   menu     menus and hubs                     score
 *   explore  normal play (a playlist)           110 points, 50 points
 *   danger   bosses, night, battles             chaose mode max
 *   win      victory screens                    woned
 *   loss     game over / defeat                 Loss
 *
 * Tracks stream through plain <audio> elements rather than Phaser's Web
 * Audio loader: each song is ~4 minutes, and decoding them all up front
 * would cost ~100MB of memory apiece and delay boot. Asking for the cue
 * that's already playing is a no-op, so scenes can call play() freely.
 *
 * Browsers block audio until the first tap/click/key; a blocked play()
 * simply retries on the next gesture. M toggles mute (remembered).
 */
export type MusicCue = 'menu' | 'explore' | 'danger' | 'win' | 'loss';

const BASE = `${import.meta.env.BASE_URL}music/`;
const TRACKS: Record<MusicCue, string[]> = {
  menu: ['menu-score.mp3'],
  explore: ['explore-110-points.mp3', 'explore-50-points.mp3'],
  danger: ['danger-chaose-mode-max.mp3'],
  win: ['win-woned.mp3'],
  loss: ['loss.mp3'],
};
const MUTE_KEY = 'pogo-showdown:muted';
const VOLUME = 0.55;
const FADE_MS = 700;

class MusicManager {
  cue: MusicCue | null = null;
  muted = false;
  /** false until a play() has actually succeeded (autoplay may block it) */
  playing = false;
  private current: HTMLAudioElement | null = null;
  private playlistPos: Partial<Record<MusicCue, number>> = {};
  private waitingForGesture = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      this.muted = false;
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'm' && !e.repeat) this.toggleMute();
      });
    }
  }

  play(cue: MusicCue): void {
    if (cue === this.cue) return;
    this.cue = cue;
    this.startTrack(cue);
  }

  /** the file currently assigned to the active cue, for tests and debugging */
  get src(): string | null {
    return this.current?.src ?? null;
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.current) this.current.muted = muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      // private window: mute still works for the session
    }
  }

  private startTrack(cue: MusicCue): void {
    const list = TRACKS[cue];
    const pos = this.playlistPos[cue] ?? 0;
    this.playlistPos[cue] = (pos + 1) % list.length;
    const el = new Audio(BASE + list[pos]);
    el.preload = 'auto';
    el.muted = this.muted;
    el.volume = 0;
    // a single-track cue loops; a playlist moves on to its next song
    el.loop = list.length === 1;
    if (list.length > 1) el.addEventListener('ended', () => { if (this.cue === cue && this.current === el) this.startTrack(cue); });

    const old = this.current;
    this.current = el;
    if (old) this.fade(old, 0, () => { old.pause(); old.src = ''; });
    this.tryPlay(el);
  }

  private tryPlay(el: HTMLAudioElement): void {
    el.play().then(
      () => {
        this.playing = true;
        this.fade(el, VOLUME);
      },
      () => {
        this.playing = false;
        this.retryOnGesture();
      },
    );
  }

  private retryOnGesture(): void {
    if (this.waitingForGesture || typeof window === 'undefined') return;
    this.waitingForGesture = true;
    const retry = () => {
      this.waitingForGesture = false;
      for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) window.removeEventListener(ev, retry, true);
      if (this.current) this.tryPlay(this.current);
    };
    for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) window.addEventListener(ev, retry, true);
  }

  private fade(el: HTMLAudioElement, to: number, done?: () => void): void {
    const from = el.volume;
    const start = performance.now();
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / FADE_MS);
      el.volume = from + (to - from) * t;
      if (t < 1) setTimeout(step, 30);
      else done?.();
    };
    step();
  }
}

export const music = new MusicManager();
(window as unknown as { __music?: MusicManager }).__music = music; // test hook

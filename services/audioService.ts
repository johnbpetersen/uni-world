import { SOUNDS } from '../constants';

class AudioController {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;

  constructor() {
    // Initialize on first user interaction typically, handling safely here
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();
    } catch (e) {
      console.error("Web Audio API not supported");
    }
  }

  public toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  public resume() {
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public playTone(type: keyof typeof SOUNDS) {
    if (this.muted || !this.ctx) return;

    const [startFreq, endFreq] = SOUNDS[type];
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = type === 'EXPLOSION' ? 'sawtooth' : 'sine';
    if (type === 'SHOOT') osc.type = 'square';

    const now = this.ctx.currentTime;
    const duration = 0.1;

    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 0.01), now + duration);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.start(now);
    osc.stop(now + duration);
  }
}

export const audioService = new AudioController();
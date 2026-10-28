import { inject, Injectable } from '@angular/core';
import { ImpactDetector } from './impact-detector.service';
import { Move } from './models';

/** Bips et voix. Chaque son coupe brièvement la détection micro pour ne pas se compter lui-même. */
@Injectable({ providedIn: 'root' })
export class AudioCue {
  private readonly detector = inject(ImpactDetector);
  private ctx: AudioContext | null = null;

  /** À appeler dans un geste utilisateur (iOS). */
  unlock(): void {
    this.ctx ??= new AudioContext();
    void this.ctx.resume();
    if ('speechSynthesis' in window) {
      // amorce la synthèse vocale sur iOS
      speechSynthesis.speak(new SpeechSynthesisUtterance(''));
    }
  }

  /** Un bip par mouvement : grave = gauche, aigu = droite, timbre différent = esquive. */
  moveCue(move: Move): void {
    if (move.type === 'dodge') this.tone(520, 0.08, 0, 0.45, 'triangle');
    else this.tone(move.hand === 'L' ? 780 : 1250, 0.07, 0, 0.4);
  }

  countdown(): void {
    this.tone(700, 0.15);
  }

  go(): void {
    this.tone(1200, 0.45, 0, 0.5);
  }

  warning(): void {
    this.tone(1000, 0.08);
    this.tone(1000, 0.08, 0.14);
  }

  bell(): void {
    [0, 0.3, 0.6].forEach((t) => this.tone(880, 0.25, t, 0.5, 'triangle'));
  }

  speak(text: string): void {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    u.rate = 1.6;
    u.onstart = () => this.detector.setHold(true);
    u.onend = u.onerror = () => this.detector.setHold(false);
    speechSynthesis.speak(u);
  }

  stopSpeech(): void {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    this.detector.setHold(false);
  }

  private tone(freq: number, duration: number, delay = 0, gain = 0.4, type: OscillatorType = 'sine'): void {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(amp).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration);
    // Le son sort du haut-parleur avec un retard (latence de sortie, souvent 50–150 ms sur mobile).
    const latency = Math.max(0.06, (this.ctx.baseLatency ?? 0) + (this.ctx.outputLatency ?? 0));
    this.detector.mute((delay + duration + latency) * 1000 + 100);
  }
}

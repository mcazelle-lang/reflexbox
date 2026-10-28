import { Injectable, signal } from '@angular/core';

type ImpactListener = (time: number) => void;

/** Intervalle minimal entre deux impacts (deux coups ne peuvent pas être plus rapprochés). */
const MIN_INTERVAL_MS = 90;
/** Réarmement quand le son est retombé à 35 % (≈ −9 dB) du pic de l'impact. */
const REARM_DROP = 0.35;
/** Bruit de fond : monte lentement (même pendant un bruit fort), redescend vite. */
const BG_RISE_MS = 2500;
const BG_FALL_MS = 120;

/**
 * Détection d'impacts au sac via le micro, par détection de front :
 *  - un impact = le pic d'amplitude dépasse un seuil absolu (réglé par la sensibilité)
 *    ET nettement le bruit de fond ;
 *  - après un impact, le détecteur est désarmé jusqu'à ce que le son retombe :
 *    un bruit continu (ventilateur, musique, gain automatique du téléphone) compte au plus une fois ;
 *  - le bruit de fond est suivi en permanence, y compris quand il est fort.
 */
@Injectable({ providedIn: 'root' })
export class ImpactDetector {
  /** Niveau courant normalisé 0..1 (pour le vumètre). */
  readonly level = signal(0);
  /** Seuil de déclenchement normalisé 0..1. */
  readonly threshold = signal(0);
  readonly active = signal(false);
  readonly error = signal<string | null>(null);
  readonly lastImpact = signal(0);

  private sensitivity = 0.5;
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private buffer = new Float32Array(0);
  private raf = 0;
  private background = 0.005;
  private armed = true;
  private hitPeak = 0;
  private lastHit = 0;
  private lastFrame = 0;
  private muteUntil = 0;
  private hold = false;
  private readonly listeners = new Set<ImpactListener>();

  setSensitivity(value: number): void {
    this.sensitivity = Math.min(1, Math.max(0, value));
  }

  onImpact(listener: ImpactListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Ignore le micro pendant `ms` (bips émis par l'app). */
  mute(ms: number): void {
    this.muteUntil = Math.max(this.muteUntil, performance.now() + ms);
  }

  /** Ignore le micro tant que `hold` est vrai (synthèse vocale en cours). */
  setHold(hold: boolean): void {
    this.hold = hold;
    if (!hold) this.mute(150);
  }

  async start(): Promise<boolean> {
    if (this.active()) return true;
    this.error.set(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      this.error.set('Micro indisponible (HTTPS requis).');
      return false;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch {
      this.error.set('Accès au micro refusé.');
      return false;
    }
    this.ctx = new AudioContext();
    await this.ctx.resume();
    const source = this.ctx.createMediaStreamSource(this.stream);
    const highpass = this.ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 80;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.buffer = new Float32Array(this.analyser.fftSize);
    source.connect(highpass).connect(this.analyser);
    this.background = 0.005;
    this.armed = true;
    this.lastFrame = 0;
    this.active.set(true);
    this.loop();
    return true;
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close();
    this.stream = null;
    this.ctx = null;
    this.analyser = null;
    this.active.set(false);
    this.level.set(0);
  }

  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.analyser) return;
    this.analyser.getFloatTimeDomainData(this.buffer);
    let peak = 0;
    for (const v of this.buffer) {
      const a = Math.abs(v);
      if (a > peak) peak = a;
    }

    const now = performance.now();
    const dt = this.lastFrame ? Math.min(100, now - this.lastFrame) : 16;
    this.lastFrame = now;

    const s = this.sensitivity;
    const absThr = dbToAmp(-6 - 36 * s); // 0 % : −6 dBFS (coups très forts) → 100 % : −42 dBFS
    const ratio = 6 - 4 * s; // pic ≥ 6× le fond (≈ +16 dB) → 2× (+6 dB)
    const thr = Math.max(absThr, this.background * ratio);
    this.level.set(toMeter(peak));
    this.threshold.set(toMeter(thr));

    if (!this.armed) {
      this.hitPeak = Math.max(this.hitPeak, peak);
      const settled = peak < this.hitPeak * REARM_DROP || peak < thr * 0.7;
      if (settled && now - this.lastHit > MIN_INTERVAL_MS) this.armed = true;
    }

    if (this.armed && peak > thr) {
      this.armed = false;
      this.hitPeak = peak;
      this.lastHit = now;
      // Un son de l'app (bip, voix) désarme sans compter : sa traîne ne sera pas comptée non plus.
      if (!this.hold && now > this.muteUntil) {
        this.lastImpact.set(now);
        this.listeners.forEach((l) => l(now));
      }
    }

    const tau = peak > this.background ? BG_RISE_MS : BG_FALL_MS;
    this.background += (peak - this.background) * (1 - Math.exp(-dt / tau));
  };
}

function dbToAmp(db: number): number {
  return Math.pow(10, db / 20);
}

/** Amplitude → échelle 0..1 sur 60 dB. */
function toMeter(amplitude: number): number {
  const db = 20 * Math.log10(Math.max(amplitude, 1e-6));
  return Math.min(1, Math.max(0, (db + 60) / 60));
}

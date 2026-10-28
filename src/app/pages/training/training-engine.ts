import { inject, Injectable, signal } from '@angular/core';
import { AudioCue } from '../../core/audio-cue.service';
import { ComboGenerator } from '../../core/combo-generator';
import { ImpactDetector } from '../../core/impact-detector.service';
import { comboDisplayMs, pauseRangeMs, REVEAL_MS } from '../../core/levels';
import { Combo, moveToSpeech, SequenceResult, sequenceScore, Preferences, SessionConfig, SessionResult, strikeCount } from '../../core/models';
import { ProgressService } from '../../core/progress.service';

export type Phase = 'idle' | 'countdown' | 'work' | 'rest' | 'done';

const COUNTDOWN_MS = 3000;

interface Scoring {
  strikes: number;
  hits: number;
  shownAt: number;
  displayMs: number;
  reacted: boolean;
  reactionMs: number | null;
  executionMs: number | null;
  /** Tous les coups ont été entendus à temps. */
  done: boolean;
}

export type Flash = { kind: 'success' | 'fail'; id: number } | null;

/**
 * Déroulé d'une séance : compte à rebours → round → repos → … → fin.
 * Chaque mouvement d'un enchaînement a son temps (un bip + son icône), au rythme de la
 * vitesse des enchaînements ; la pause entre enchaînements tient le volume de frappe.
 * L'aléatoire du timing rend le rythme irrégulier et fait varier la pause autour de sa moyenne.
 */
@Injectable()
export class TrainingEngine {
  private readonly generator = inject(ComboGenerator);
  private readonly audio = inject(AudioCue);
  private readonly detector = inject(ImpactDetector);

  readonly phase = signal<Phase>('idle');
  readonly round = signal(1);
  readonly remainingMs = signal(0);
  readonly combo = signal<Combo | null>(null);
  readonly comboId = signal(0);
  readonly comboProgress = signal(0);
  /** Mouvement en cours (celui du dernier bip), -1 avant le premier et pendant le maintien. */
  readonly activeIndex = signal(-1);
  /** Nombre de mouvements déjà annoncés de l'enchaînement affiché. */
  readonly revealed = signal(0);
  readonly paused = signal(false);
  readonly hits = signal(0);
  readonly result = signal<SessionResult | null>(null);
  /** Flash vert (enchaînement terminé à temps) ou rouge (décompte écoulé). */
  readonly flash = signal<Flash>(null);

  cfg!: SessionConfig;
  private prefs!: Preferences;
  private useMic = false;
  private raf = 0;
  private phaseEnd = 0;
  private comboEnd = 0;
  private pauseMs = 0;
  private responses: number[] = [];
  private sequences: SequenceResult[] = [];
  /** Fin de l'apparition : l'enchaînement complet reste ensuite affiché, sans surlignage. */
  private revealEnd = 0;
  private gapEnd = 0;
  /** Instants (absolus) de chaque mouvement de l'enchaînement affiché. */
  private beats: number[] = [];
  private nextBeat = 0;
  private pausedAt = 0;
  private lastSecond = -1;
  private warned = false;
  private lastCombo: Combo | null = null;
  private scoring: Scoring | null = null;
  private expected = 0;
  private matched = 0;
  private combos = 0;
  private reactions: number[] = [];
  private unsubscribe: (() => void) | null = null;

  start(cfg: SessionConfig, prefs: Preferences, useMic: boolean): void {
    this.cfg = cfg;
    this.prefs = prefs;
    this.useMic = useMic;
    if (useMic) this.unsubscribe = this.detector.onImpact((t) => this.onImpact(t));
    this.beginCountdown(performance.now());
    this.raf = requestAnimationFrame(this.loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.audio.stopSpeech();
  }

  togglePause(): void {
    const now = performance.now();
    if (this.paused()) {
      const shift = now - this.pausedAt;
      this.phaseEnd += shift;
      this.comboEnd += shift;
      this.revealEnd += shift;
      this.gapEnd += shift;
      this.beats = this.beats.map((b) => b + shift);
      if (this.scoring) this.scoring.shownAt += shift;
      this.paused.set(false);
    } else if (this.phase() !== 'done' && this.phase() !== 'idle') {
      this.pausedAt = now;
      this.paused.set(true);
      this.audio.stopSpeech();
    }
  }

  private loop = (now: number): void => {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.paused()) this.tick(now);
  };

  private tick(now: number): void {
    const remaining = this.phaseEnd - now;
    this.remainingMs.set(Math.max(0, remaining));

    switch (this.phase()) {
      case 'countdown': {
        if (remaining <= 0) {
          this.beginWork(now);
          break;
        }
        const s = Math.ceil(remaining / 1000);
        if (s !== this.lastSecond) {
          this.lastSecond = s;
          if (this.prefs.sounds) this.audio.countdown();
        }
        break;
      }
      case 'rest':
        if (remaining <= 0) this.beginCountdown(now);
        break;
      case 'work':
        if (remaining <= 0) {
          this.endRound(now);
          break;
        }
        if (!this.warned && remaining <= 10_000 && this.cfg.roundSec > 20) {
          this.warned = true;
          if (this.prefs.sounds) this.audio.warning();
        }
        if (this.combo() && now >= this.comboEnd) {
          if (this.useMic && this.scoring && !this.scoring.done && this.scoring.strikes > 0) this.showFlash('fail');
          this.combo.set(null);
          this.activeIndex.set(-1);
        }
        if (!this.combo() && now >= this.gapEnd) this.showNext(now);
        while (this.combo() && this.nextBeat < this.beats.length && now >= this.beats[this.nextBeat]) {
          this.fireBeat(this.nextBeat++);
        }
        if (this.combo() && this.nextBeat >= this.beats.length && now >= this.revealEnd) {
          this.activeIndex.set(-1);
        }
        if (this.scoring) {
          this.comboProgress.set(Math.min(1, (now - this.scoring.shownAt) / this.scoring.displayMs));
        }
        break;
    }
  }

  private beginCountdown(now: number): void {
    this.phase.set('countdown');
    this.phaseEnd = now + COUNTDOWN_MS;
    this.lastSecond = -1;
  }

  private beginWork(now: number): void {
    this.phase.set('work');
    this.phaseEnd = now + this.cfg.roundSec * 1000;
    this.gapEnd = now + 400 + Math.random() * this.cfg.timingRandomness * 1500;
    this.warned = false;
    if (this.prefs.sounds) this.audio.go();
  }

  private showNext(now: number): void {
    this.tally();
    const combo = this.generator.generate(this.cfg, this.prefs.stance, this.lastCombo);
    this.beats = combo.map((_, i) => now + i * REVEAL_MS);
    const revealMs = combo.length * REVEAL_MS;
    const displayMs = comboDisplayMs(combo.length, this.cfg);
    this.nextBeat = 0;
    this.revealEnd = now + revealMs;
    this.revealed.set(0);
    this.comboEnd = now + displayMs;
    const [minPause, maxPause] = pauseRangeMs(combo.length, this.cfg);
    this.pauseMs = minPause + Math.random() * (maxPause - minPause);
    this.gapEnd = this.comboEnd + this.pauseMs;
    this.scoring = { strikes: strikeCount(combo), hits: 0, shownAt: now, displayMs, reacted: false, reactionMs: null, executionMs: null, done: false };
    this.lastCombo = combo;
    this.activeIndex.set(-1);
    this.combo.set(combo);
    this.comboId.update((i) => i + 1);
    this.comboProgress.set(0);
  }

  private fireBeat(index: number): void {
    const move = this.combo()![index];
    this.activeIndex.set(index);
    this.revealed.set(index + 1);
    if (this.prefs.voice) this.audio.speak(moveToSpeech(move, this.prefs.stance));
    else if (this.prefs.sounds) this.audio.moveCue(move);
  }


  /** Comptabilise l'enchaînement précédent (les impacts pendant le blanc lui reviennent). */
  private tally(): void {
    const s = this.scoring;
    if (!s) return;
    this.expected += s.strikes;
    this.matched += Math.min(s.hits, s.strikes);
    this.combos++;
    if (s.strikes > 0) this.sequences.push({ strikes: s.strikes, reactionMs: s.reactionMs, executionMs: s.executionMs, allowedMs: Math.round(s.displayMs), success: s.done });
    this.scoring = null;
  }

  private endRound(now: number): void {
    // Un enchaînement coupé par la cloche ne compte que s'il a été affiché au moins à moitié.
    if (this.scoring && now - this.scoring.shownAt < this.scoring.displayMs / 2) this.scoring = null;
    this.tally();
    this.combo.set(null);
    this.activeIndex.set(-1);
    this.lastCombo = null;
    this.audio.stopSpeech();
    if (this.prefs.sounds) this.audio.bell();

    if (this.round() >= this.cfg.rounds) {
      this.finish();
      return;
    }
    this.round.update((r) => r + 1);
    if (this.cfg.restSec > 0) {
      this.phase.set('rest');
      this.phaseEnd = now + this.cfg.restSec * 1000;
    } else {
      this.beginCountdown(now);
    }
  }

  private onImpact(time: number): void {
    if (this.phase() !== 'work' || this.paused()) return;
    this.hits.update((h) => h + 1);
    const s = this.scoring;
    if (!s) return;
    s.hits++;
    if (!s.reacted && s.strikes > 0) {
      s.reacted = true;
      s.reactionMs = Math.round(time - s.shownAt);
      this.reactions.push(s.reactionMs);
    }
    if (s.strikes > 0 && !s.done && s.hits >= s.strikes && time <= this.comboEnd) this.complete(s, time);
  }

  /** Enchaînement réussi : score, flash vert, disparition immédiate et passage au suivant après la pause. */
  private complete(s: Scoring, time: number): void {
    s.done = true;
    const response = time - s.shownAt;
    s.executionMs = Math.round(response);
    this.responses.push(response);
    this.showFlash('success');
    this.combo.set(null);
    this.activeIndex.set(-1);
    this.nextBeat = this.beats.length;
    this.comboEnd = time;
    this.gapEnd = time + this.pauseMs;
  }

  private showFlash(kind: 'success' | 'fail'): void {
    this.flash.update((f) => ({ kind, id: (f?.id ?? 0) + 1 }));
  }

  private finish(): void {
    this.phase.set('done');
    this.stop();
    const accuracy = this.useMic && this.expected > 0 ? this.matched / this.expected : null;
    this.result.set({
      date: new Date().toISOString(),
      level: this.cfg.level,
      durationSec: this.cfg.roundSec * this.cfg.rounds,
      combos: this.combos,
      expectedStrikes: this.expected,
      detectedHits: this.useMic ? this.hits() : null,
      accuracy,
      avgReactionMs: this.reactions.length
        ? Math.round(this.reactions.reduce((a, b) => a + b, 0) / this.reactions.length)
        : null,
      stars: ProgressService.starsFor(accuracy),
      score: this.useMic ? this.sequences.reduce((sum, seq) => sum + sequenceScore(seq), 0) : null,
      successes: this.useMic ? this.responses.length : null,
      avgResponseMs: this.responses.length
        ? Math.round(this.responses.reduce((a, b) => a + b, 0) / this.responses.length)
        : null,
      sequences: this.useMic ? this.sequences : undefined,
    });
  }
}

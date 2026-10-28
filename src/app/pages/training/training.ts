import { Component, computed, effect, inject, OnDestroy, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AudioCue } from '../../core/audio-cue.service';
import { ImpactDetector } from '../../core/impact-detector.service';
import { formatDuration, levelDef } from '../../core/levels';
import { PreferencesService } from '../../core/preferences.service';
import { ProgressService } from '../../core/progress.service';
import { SessionState } from '../../core/session-state.service';
import { CardState, MoveCard } from '../../shared/move-card';
import { TrainingEngine } from './training-engine';

@Component({
  selector: 'app-training',
  imports: [MoveCard, RouterLink],
  providers: [TrainingEngine],
  templateUrl: './training.html',
  styleUrl: './training.scss',
  host: { '(document:visibilitychange)': 'onVisibilityChange()' },
})
export class TrainingPage implements OnDestroy {
  protected readonly engine = inject(TrainingEngine);
  protected readonly detector = inject(ImpactDetector);
  private readonly audio = inject(AudioCue);
  private readonly prefsService = inject(PreferencesService);
  private readonly progress = inject(ProgressService);
  private readonly session = inject(SessionState);
  private readonly router = inject(Router);

  protected readonly prefs = this.prefsService.prefs;
  protected readonly config = this.session.config();
  protected readonly title = this.config?.level ? `Niveau ${this.config.level} · ${levelDef(this.config.level).name}` : 'Séance libre';
  protected readonly useMic = signal(false);
  protected readonly starting = signal(false);

  protected readonly clock = computed(() => formatDuration(Math.ceil(this.engine.remainingMs() / 1000)));
  protected readonly countdown = computed(() => Math.max(1, Math.ceil(this.engine.remainingMs() / 1000)));
  protected readonly lastSeconds = computed(
    () => this.engine.phase() === 'work' && this.engine.remainingMs() <= 10_000,
  );

  private wakeLock: WakeLockSentinel | null = null;

  protected cardState(index: number): CardState {
    if (index === this.engine.activeIndex()) return 'active';
    if (index < this.engine.revealed()) return 'shown';
    return this.prefs().reveal === 'progressive' ? 'hidden' : 'shown';
  }

  constructor() {
    if (!this.config) void this.router.navigate(['/']);

    effect(() => {
      const result = this.engine.result();
      if (!result) return;
      this.session.outcome.set(this.progress.record(result));
      void this.router.navigate(['/bilan'], { replaceUrl: true });
    });
  }

  protected async begin(): Promise<void> {
    if (!this.config || this.starting()) return;
    this.starting.set(true);
    // Tout ce qui exige un geste utilisateur doit partir avant le premier await.
    this.audio.unlock();
    document.documentElement.requestFullscreen?.().catch(() => undefined);

    const prefs = this.prefs();
    let mic = false;
    if (prefs.mic) {
      this.detector.setSensitivity(prefs.micSensitivity);
      mic = await this.detector.start();
    }
    this.useMic.set(mic);
    await this.requestWakeLock();
    this.engine.start(this.config, prefs, mic);
  }

  protected quit(): void {
    void this.router.navigate(['/']);
  }

  protected onVisibilityChange(): void {
    if (document.hidden) {
      if (!this.engine.paused()) this.engine.togglePause();
    } else if (this.engine.phase() !== 'idle') {
      void this.requestWakeLock();
    }
  }

  ngOnDestroy(): void {
    this.engine.stop();
    if (this.useMic()) this.detector.stop();
    void this.wakeLock?.release().catch(() => undefined);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
  }

  private async requestWakeLock(): Promise<void> {
    try {
      this.wakeLock = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      // non supporté : l'écran peut se mettre en veille
    }
  }
}

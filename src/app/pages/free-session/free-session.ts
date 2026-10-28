import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { estimatedMoves, formatDuration, meanPauseMs, pauseRangeMs } from '../../core/levels';
import { DODGE_LABELS, DodgeKind, SessionConfig, STRIKE_LABELS, StrikeKind } from '../../core/models';
import { PreferencesService } from '../../core/preferences.service';
import { SessionState } from '../../core/session-state.service';

@Component({
  selector: 'app-free-session',
  imports: [RouterLink],
  templateUrl: './free-session.html',
})
export class FreeSessionPage {
  private readonly prefs = inject(PreferencesService);
  private readonly session = inject(SessionState);
  private readonly router = inject(Router);

  protected readonly cfg = this.prefs.freeConfig;
  protected readonly formatDuration = formatDuration;
  protected readonly strikeKinds = Object.entries(STRIKE_LABELS) as [StrikeKind, string][];
  protected readonly dodgeKinds = Object.entries(DODGE_LABELS) as [DodgeKind, string][];
  protected readonly total = computed(() => estimatedMoves(this.cfg()));
  private readonly avgMoves = computed(() => (this.cfg().minMoves + this.cfg().maxMoves) / 2);
  protected readonly meanPauseSec = computed(() => (meanPauseMs(this.avgMoves(), this.cfg()) / 1000).toFixed(1));
  protected readonly pauseRangeSec = computed(() =>
    pauseRangeMs(this.avgMoves(), this.cfg()).map((ms) => (ms / 1000).toFixed(1)),
  );
  protected readonly valid = computed(() => this.cfg().strikes.length > 0);

  protected set<K extends keyof SessionConfig>(key: K, value: SessionConfig[K]): void {
    this.cfg.update((c) => {
      const next = { ...c, [key]: value };
      if (key === 'minMoves') next.maxMoves = Math.max(next.maxMoves, next.minMoves);
      if (key === 'maxMoves') next.minMoves = Math.min(next.minMoves, next.maxMoves);
      return next;
    });
  }

  protected pct(value: number): string {
    return (value * 100).toFixed(0);
  }

  protected num(event: Event): number {
    return +(event.target as HTMLInputElement).value;
  }

  protected toggleStrike(kind: StrikeKind): void {
    const list = this.cfg().strikes;
    this.set('strikes', list.includes(kind) ? list.filter((k) => k !== kind) : [...list, kind]);
  }

  protected toggleDodge(kind: DodgeKind): void {
    const list = this.cfg().dodges;
    this.set('dodges', list.includes(kind) ? list.filter((k) => k !== kind) : [...list, kind]);
  }

  protected start(): void {
    this.session.config.set({ ...this.cfg(), rounds: 1, restSec: 0, level: null });
    void this.router.navigate(['/entrainement']);
  }
}

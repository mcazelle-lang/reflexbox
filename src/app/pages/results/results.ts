import { Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { levelDef, LEVELS } from '../../core/levels';
import { SessionState } from '../../core/session-state.service';
import { ReactionChart } from '../../shared/reaction-chart';

@Component({
  selector: 'app-results',
  imports: [RouterLink, DecimalPipe, ReactionChart],
  templateUrl: './results.html',
  styleUrl: './results.scss',
})
export class ResultsPage {
  private readonly session = inject(SessionState);
  private readonly router = inject(Router);

  protected readonly outcome = this.session.outcome();
  protected readonly levelDef = levelDef;
  protected readonly levelCount = LEVELS.length;

  /**
   * Cadence finale : temps moyen entre deux frappes d'un même enchaînement,
   * = Σ (dernière frappe − première frappe) / Σ (coups − 1), sur les enchaînements réussis d'au moins 2 coups.
   */
  protected readonly avgIntervalMs = (() => {
    let time = 0;
    let gaps = 0;
    for (const s of this.outcome?.result.sequences ?? []) {
      const n = s.strikes ?? 1;
      if (!s.success || n < 2 || s.reactionMs === null || s.executionMs == null) continue;
      time += s.executionMs - s.reactionMs;
      gaps += n - 1;
    }
    return gaps ? Math.round(time / gaps) : null;
  })();

  constructor() {
    if (!this.outcome) void this.router.navigate(['/']);
  }

  protected replay(): void {
    void this.router.navigate(['/entrainement']);
  }

  protected next(level: number): void {
    this.session.config.set(levelDef(level).config);
    void this.router.navigate(['/entrainement']);
  }
}

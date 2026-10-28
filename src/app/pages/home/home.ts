import { Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { formatDuration, levelDef, LEVELS, STARS_TO_VALIDATE } from '../../core/levels';
import { Combo } from '../../core/models';
import { ProgressService } from '../../core/progress.service';
import { SessionState } from '../../core/session-state.service';
import { MoveCard } from '../../shared/move-card';

@Component({
  selector: 'app-home',
  imports: [RouterLink, MoveCard, DecimalPipe],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomePage {
  protected readonly progress = inject(ProgressService);
  private readonly session = inject(SessionState);
  private readonly router = inject(Router);

  protected readonly levels = LEVELS;
  protected readonly starsToValidate = STARS_TO_VALIDATE;
  protected readonly formatDuration = formatDuration;
  protected readonly current = computed(() => levelDef(this.progress.recommended()));

  protected readonly demo: Combo = [
    { type: 'strike', kind: 'direct', hand: 'L', target: 'head' },
    { type: 'strike', kind: 'direct', hand: 'R', target: 'head' },
    { type: 'dodge', kind: 'slip', side: 'R' },
    { type: 'strike', kind: 'hook', hand: 'L', target: 'body' },
  ];

  protected starRow(level: number): boolean[] {
    const stars = Math.min(this.progress.stars(level), STARS_TO_VALIDATE);
    return Array.from({ length: STARS_TO_VALIDATE }, (_, i) => i < stars);
  }

  protected play(level: number): void {
    this.session.config.set(levelDef(level).config);
    void this.router.navigate(['/entrainement']);
  }
}

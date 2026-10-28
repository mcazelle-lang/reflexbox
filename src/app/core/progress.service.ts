import { computed, Injectable } from '@angular/core';
import { LEVELS, STARS_TO_VALIDATE } from './levels';
import { SessionResult } from './models';
import { persistedSignal } from './storage';

interface ProgressState {
  /** Niveau conseillé : le premier niveau non validé après le dernier validé. */
  recommended: number;
  starsByLevel: Record<number, number>;
  history: SessionResult[];
  streakDays: number;
  lastDay: string | null;
}

export interface RecordOutcome {
  result: SessionResult;
  /** Niveau qui vient d'être validé par cette séance. */
  validatedLevel: number | null;
}

const HISTORY_SIZE = 100;

@Injectable({ providedIn: 'root' })
export class ProgressService {
  private readonly state = persistedSignal<ProgressState>('progress', {
    recommended: 1,
    starsByLevel: {},
    history: [],
    streakDays: 0,
    lastDay: null,
  });

  readonly recommended = computed(() => this.state().recommended);
  readonly history = computed(() => this.state().history);
  readonly streakDays = computed(() => {
    const { lastDay, streakDays } = this.state();
    return lastDay === today() || lastDay === yesterday() ? streakDays : 0;
  });

  readonly stats = computed(() => {
    const h = this.state().history;
    const withMic = h.filter((r) => r.accuracy !== null);
    const withReaction = h.filter((r) => r.avgReactionMs !== null).slice(0, 10);
    return {
      sessions: h.length,
      strikes: h.reduce((sum, r) => sum + r.expectedStrikes, 0),
      accuracy: withMic.length ? withMic.reduce((s, r) => s + r.accuracy!, 0) / withMic.length : null,
      reactionMs: withReaction.length
        ? withReaction.reduce((s, r) => s + r.avgReactionMs!, 0) / withReaction.length
        : null,
    };
  });

  stars(level: number): number {
    return this.state().starsByLevel[level] ?? 0;
  }

  validated(level: number): boolean {
    return this.stars(level) >= STARS_TO_VALIDATE;
  }

  /** 1 étoile = séance terminée ; avec micro : 2 à 70 % de précision, 3 à 90 %. */
  static starsFor(accuracy: number | null): number {
    if (accuracy === null) return 1;
    return accuracy >= 0.9 ? 3 : accuracy >= 0.7 ? 2 : 1;
  }

  record(result: SessionResult): RecordOutcome {
    let validatedLevel: number | null = null;
    this.state.update((s) => {
      const starsByLevel = { ...s.starsByLevel };
      let recommended = s.recommended;
      if (result.level !== null) {
        const before = starsByLevel[result.level] ?? 0;
        starsByLevel[result.level] = before + result.stars;
        if (before < STARS_TO_VALIDATE && starsByLevel[result.level] >= STARS_TO_VALIDATE) {
          validatedLevel = result.level;
          recommended = Math.max(recommended, Math.min(result.level + 1, LEVELS.length));
        }
      }
      const day = today();
      const streakDays =
        s.lastDay === day ? s.streakDays : s.lastDay === yesterday() ? s.streakDays + 1 : 1;
      return {
        recommended,
        starsByLevel,
        history: [result, ...s.history].slice(0, HISTORY_SIZE),
        streakDays,
        lastDay: day,
      };
    });
    return { result, validatedLevel };
  }
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
const today = () => dayKey(new Date());
const yesterday = () => dayKey(new Date(Date.now() - 86_400_000));

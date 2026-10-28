import { Injectable, signal } from '@angular/core';
import { SessionConfig } from './models';
import { RecordOutcome } from './progress.service';

/** Passe la configuration à l'écran d'entraînement et le résultat à l'écran de bilan. */
@Injectable({ providedIn: 'root' })
export class SessionState {
  readonly config = signal<SessionConfig | null>(null);
  readonly outcome = signal<RecordOutcome | null>(null);
}

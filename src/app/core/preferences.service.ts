import { Injectable } from '@angular/core';
import { Preferences, SessionConfig } from './models';
import { persistedSignal } from './storage';
import { LEVELS } from './levels';

@Injectable({ providedIn: 'root' })
export class PreferencesService {
  readonly prefs = persistedSignal<Preferences>('prefs', {
    stance: 'orthodox',
    sounds: true,
    voice: false,
    mic: false,
    micSensitivity: 0.5,
    showNumbers: false,
    reveal: 'progressive',
  });

  /** Dernière configuration de séance libre. */
  readonly freeConfig = persistedSignal<SessionConfig>('free-config', {
    ...LEVELS[3].config,
    roundSec: 60,
    rounds: 1,
    restSec: 0,
    execSec: 2,
    timingRandomness: 0.3,
    comboRandomness: 0.3,
    level: null,
  });

  update(patch: Partial<Preferences>): void {
    this.prefs.update((p) => ({ ...p, ...patch }));
  }
}

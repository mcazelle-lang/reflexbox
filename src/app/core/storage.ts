import { effect, signal, WritableSignal } from '@angular/core';

const PREFIX = 'reflex-boxe:';

/** Signal synchronisé avec localStorage (tolère navigation privée / stockage bloqué). */
export function persistedSignal<T extends object>(key: string, defaults: T): WritableSignal<T> {
  let initial = defaults;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw) initial = { ...defaults, ...JSON.parse(raw) };
  } catch {
    // stockage indisponible : valeurs par défaut
  }
  const state = signal<T>(initial);
  effect(() => {
    const value = state();
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // ignoré
    }
  });
  return state;
}

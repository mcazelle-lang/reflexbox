import { SessionConfig } from './models';

export interface LevelDef {
  level: number;
  name: string;
  goal: string;
  config: SessionConfig;
}

/** Étoiles cumulées sur un niveau pour le valider (tous les niveaux restent jouables). */
export const STARS_TO_VALIDATE = 3;

type LevelSpec = [
  name: string,
  goal: string,
  config: Omit<SessionConfig, 'level' | 'execSec' | 'timingRandomness' | 'comboRandomness'>,
];

/** Temps d'exécution par niveau, en secondes (après l'apparition du dernier coup). */
const EXEC_SEC = [3, 3, 3, 2, 2, 2, 2, 1, 1, 1];

/** [aléatoire du timing, variété des enchaînements] par niveau : l'imprévisibilité augmente avec la progression. */
const RANDOMNESS: [number, number][] = [
  [0, 0], [0, 0.1], [0.1, 0.15], [0.15, 0.2], [0.2, 0.25],
  [0.25, 0.3], [0.3, 0.35], [0.4, 0.4], [0.5, 0.5], [0.6, 0.6],
];

const SPECS: LevelSpec[] = [
  ['Premiers directs', 'Jab et direct, tête uniquement', {
    roundSec: 60, rounds: 1, restSec: 0, minMoves: 1, maxMoves: 2, strikesPerMin: 30,
    strikes: ['direct'], dodges: [], body: false,
  }],
  ['Crochets', 'Ajout des crochets', {
    roundSec: 60, rounds: 1, restSec: 0, minMoves: 1, maxMoves: 3, strikesPerMin: 36,
    strikes: ['direct', 'hook'], dodges: [], body: false,
  }],
  ['Au corps', 'Alterner tête et corps', {
    roundSec: 90, rounds: 1, restSec: 0, minMoves: 1, maxMoves: 3, strikesPerMin: 40,
    strikes: ['direct', 'hook'], dodges: [], body: true,
  }],
  ['Uppercuts', 'Toute la panoplie de coups', {
    roundSec: 90, rounds: 1, restSec: 0, minMoves: 2, maxMoves: 3, strikesPerMin: 45,
    strikes: ['direct', 'hook', 'uppercut'], dodges: [], body: true,
  }],
  ['Esquive latérale', 'Défendre puis contrer', {
    roundSec: 90, rounds: 1, restSec: 0, minMoves: 2, maxMoves: 4, strikesPerMin: 50,
    strikes: ['direct', 'hook', 'uppercut'], dodges: ['slip'], body: true,
  }],
  ['Retrait', 'Esquive arrière', {
    roundSec: 120, rounds: 1, restSec: 0, minMoves: 2, maxMoves: 4, strikesPerMin: 55,
    strikes: ['direct', 'hook', 'uppercut'], dodges: ['slip', 'pull'], body: true,
  }],
  ['Rotation', 'Rouler sous les crochets', {
    roundSec: 120, rounds: 1, restSec: 0, minMoves: 2, maxMoves: 5, strikesPerMin: 60,
    strikes: ['direct', 'hook', 'uppercut'], dodges: ['slip', 'pull', 'roll'], body: true,
  }],
  ['Cadence', 'Monter le rythme', {
    roundSec: 150, rounds: 1, restSec: 0, minMoves: 2, maxMoves: 5, strikesPerMin: 70,
    strikes: ['direct', 'hook', 'uppercut'], dodges: ['slip', 'pull', 'roll'], body: true,
  }],
  ['Pression', 'Longs enchaînements', {
    roundSec: 180, rounds: 1, restSec: 0, minMoves: 3, maxMoves: 5, strikesPerMin: 80,
    strikes: ['direct', 'hook', 'uppercut'], dodges: ['slip', 'pull', 'roll'], body: true,
  }],
  ['Champion', 'Haute intensité, enchaînements longs', {
    roundSec: 180, rounds: 1, restSec: 0, minMoves: 3, maxMoves: 5, strikesPerMin: 95,
    strikes: ['direct', 'hook', 'uppercut'], dodges: ['slip', 'pull', 'roll'], body: true,
  }],
];

export const LEVELS: LevelDef[] = SPECS.map(([name, goal, config], i) => ({
  level: i + 1,
  name,
  goal,
  config: {
    ...config,
    execSec: EXEC_SEC[i],
    timingRandomness: RANDOMNESS[i][0],
    comboRandomness: RANDOMNESS[i][1],
    level: i + 1,
  },
}));

export function levelDef(level: number): LevelDef {
  return LEVELS[Math.min(Math.max(level, 1), LEVELS.length) - 1];
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Écran vide entre deux enchaînements pour bien marquer le changement. */
export const GAP_MS = 300;
/** Une icône (et son bip) apparaît toutes les 200 ms. */
export const REVEAL_MS = 200;
const MIN_DISPLAY_MS = 900;

/** Temps à l'écran = apparition (200 ms par coup) + temps d'exécution du niveau. */
export function comboDisplayMs(moves: number, cfg: SessionConfig): number {
  return Math.max(MIN_DISPLAY_MS, moves * REVEAL_MS + cfg.execSec * 1000);
}

/**
 * Pause moyenne après un enchaînement (blanc compris) pour tenir le volume de frappe.
 * Si la vitesse ne permet pas d'atteindre le volume, on ne garde que le blanc.
 */
export function meanPauseMs(moves: number, cfg: SessionConfig): number {
  return Math.max(GAP_MS, (moves * 60_000) / cfg.strikesPerMin - comboDisplayMs(moves, cfg));
}

/** Plage de la pause entre enchaînements, élargie par l'aléatoire du timing (moyenne conservée). */
export function pauseRangeMs(moves: number, cfg: SessionConfig): [number, number] {
  const extra = meanPauseMs(moves, cfg) - GAP_MS;
  return [GAP_MS + extra * (1 - cfg.timingRandomness), GAP_MS + extra * (1 + cfg.timingRandomness)];
}

export function estimatedMoves(cfg: SessionConfig): number {
  const avgMoves = (cfg.minMoves + cfg.maxMoves) / 2;
  const comboMs = comboDisplayMs(avgMoves, cfg) + meanPauseMs(avgMoves, cfg);
  return Math.round(((cfg.roundSec * cfg.rounds * 1000) / comboMs) * avgMoves);
}

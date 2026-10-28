export type Hand = 'L' | 'R';
export type Target = 'head' | 'body';
export type StrikeKind = 'direct' | 'hook' | 'uppercut';
export type DodgeKind = 'slip' | 'pull' | 'roll';
export type Stance = 'orthodox' | 'southpaw';

export interface Strike {
  type: 'strike';
  kind: StrikeKind;
  hand: Hand;
  target: Target;
}

/** `side` = direction dans laquelle part la tête (null pour le retrait). */
export interface Dodge {
  type: 'dodge';
  kind: DodgeKind;
  side: Hand | null;
}

export type Move = Strike | Dodge;
export type Combo = Move[];

export interface SessionConfig {
  roundSec: number;
  rounds: number;
  restSec: number;
  minMoves: number;
  maxMoves: number;
  /** Volume de frappe : mouvements demandés par minute, en moyenne (règle la pause entre enchaînements). */
  strikesPerMin: number;
  /** Temps d'exécution accordé après l'apparition du dernier coup, en secondes. */
  execSec: number;
  strikes: StrikeKind[];
  dodges: DodgeKind[];
  body: boolean;
  /** 0..1 : pause imprévisible avant chaque enchaînement et rythme irrégulier entre les coups. */
  timingRandomness: number;
  /** 0..1 : 0 = enchaînements classiques uniquement, 1 = combinaisons totalement libres. */
  comboRandomness: number;
  /** null = séance libre (ne compte pas pour la progression). */
  level: number | null;
}

export interface Preferences {
  stance: Stance;
  sounds: boolean;
  voice: boolean;
  mic: boolean;
  /** 0 (peu sensible) → 1 (très sensible). */
  micSensitivity: number;
  showNumbers: boolean;
  /** progressive = chaque icône apparaît sur son bip ; highlight = séquence entière, coup en cours surligné. */
  reveal: 'progressive' | 'highlight';
}

export interface SessionResult {
  date: string;
  level: number | null;
  durationSec: number;
  combos: number;
  expectedStrikes: number;
  /** null quand le micro n'était pas actif. */
  detectedHits: number | null;
  accuracy: number | null;
  avgReactionMs: number | null;
  /** Score final (micro uniquement), voir `sequenceScore`. */
  score: number | null;
  /** Enchaînements terminés à temps (tous les coups entendus). */
  successes: number | null;
  /** Temps de réponse moyen : de l'apparition au dernier coup entendu, enchaînements réussis. */
  avgResponseMs: number | null;
  stars: number;
  /** Une entrée par enchaînement comportant des coups (micro uniquement). */
  sequences?: SequenceResult[];
}

export interface SequenceResult {
  /** Temps entre l'affichage et la première frappe entendue ; null si aucune frappe. */
  reactionMs: number | null;
  /** Temps entre l'affichage et le dernier coup entendu ; null si la séquence est ratée. */
  executionMs?: number | null;
  /** Temps imparti (apparition + temps d'exécution du niveau). */
  allowedMs?: number;
  /** Nombre de coups demandés (hors esquives). */
  strikes?: number;
  /** Tous les coups entendus avant la fin du décompte. */
  success: boolean;
}

/** Temps de réaction au-delà duquel le bonus de rapidité tombe à 0. */
export const REACTION_REF_MS = 1000;

/** Points par coup : base, bonus de réaction (prépondérant), bonus de cadence. */
export const BASE_POINTS = 50;
export const REACTION_WEIGHT = 35;
export const CADENCE_WEIGHT = 15;
/** Cadence de référence (coups/s) donnant le bonus de cadence maximal : un coup toutes les 200 ms. */
export const CADENCE_REF = 5;

/** Cadence entre la première et la dernière frappe, en coups par seconde (null pour un seul coup). */
export function sequenceCadence(seq: SequenceResult): number | null {
  const n = seq.strikes ?? 1;
  if (n < 2 || seq.reactionMs === null || seq.executionMs == null) return null;
  return (n - 1) / (Math.max(1, seq.executionMs - seq.reactionMs) / 1000);
}

/**
 * Score d'un enchaînement de n coups : 0 s'il est raté, sinon
 *   n × (50 + 35 × R + 15 × C)
 * avec R = max(0, 1 − réaction / 1000 ms)
 * et   C = min(1, cadence / 5 coups/s), C = R pour un coup unique.
 * Chaque coup vaut entre 50 et 100 points : plus la séquence est longue, plus elle rapporte.
 */
export function sequenceScore(seq: SequenceResult): number {
  if (!seq.success || seq.reactionMs === null) return 0;
  const n = seq.strikes ?? 1;
  const reaction = Math.max(0, 1 - seq.reactionMs / REACTION_REF_MS);
  const cadence = sequenceCadence(seq);
  const c = cadence === null ? reaction : Math.min(1, cadence / CADENCE_REF);
  return Math.round(n * (BASE_POINTS + REACTION_WEIGHT * reaction + CADENCE_WEIGHT * c));
}

export const STRIKE_LABELS: Record<StrikeKind, string> = {
  direct: 'Direct',
  hook: 'Crochet',
  uppercut: 'Uppercut',
};

export const DODGE_LABELS: Record<DodgeKind, string> = {
  slip: 'Esquive latérale',
  pull: 'Retrait arrière',
  roll: 'Rotation du buste',
};

export function strikeCount(combo: Combo): number {
  return combo.filter((m) => m.type === 'strike').length;
}

/** Numérotation boxe classique : 1 jab, 2 direct arrière, 3/4 crochets, 5/6 uppercuts. */
export function moveNumber(move: Strike, stance: Stance): number {
  const lead: Hand = stance === 'orthodox' ? 'L' : 'R';
  const base = { direct: 1, hook: 3, uppercut: 5 }[move.kind];
  return move.hand === lead ? base : base + 1;
}

export function moveToSpeech(m: Move, stance: Stance): string {
  if (m.type === 'dodge') {
    return { slip: 'esquive', pull: 'retrait', roll: 'rotation' }[m.kind];
  }
  const n = moveNumber(m, stance);
  return m.target === 'body' ? `${n} corps` : `${n}`;
}

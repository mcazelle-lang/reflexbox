import { Injectable } from '@angular/core';
import { Combo, Dodge, DodgeKind, Hand, Move, SessionConfig, Stance, Strike, StrikeKind } from './models';

const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];
const chance = (p: number) => Math.random() < p;
const other = (h: Hand): Hand => (h === 'L' ? 'R' : 'L');

/**
 * Enchaînements classiques en numérotation boxe (1 jab, 2 direct arrière, 3/4 crochets,
 * 5/6 uppercuts ; suffixe b = corps ; S/P/R = esquive latérale / retrait / rotation).
 */
const CLASSICS = [
  '1', '2', '3', '1-1', '1-2', '3-2', '5-6', '1-1-2', '1-2-1', '1-2-3', '2-3-2', '6-3-2',
  '1-2-3-2', '1-2-5-2', '1-6-3-2', '1-1-2-3', '1-2-3-4',
  '1-2b', '2b-3', '3b-3', '1-3b-3', '1-2-3b', '1-2-3b-2', '1-2-5b-2',
  'S-2', 'P-2', 'S-2-3', 'R-3-2', '1-2-S-2', '1-2-P-2', '1-R-3-2', '1-2-R-3', '1-2-S-3-2', '3-R-3-2',
];
const DODGE_CODES: Record<string, DodgeKind> = { S: 'slip', P: 'pull', R: 'roll' };
const STRIKE_CODES: StrikeKind[] = ['direct', 'hook', 'uppercut'];

/**
 * Le dosage `comboRandomness` mélange deux sources :
 *  - 0 : uniquement des enchaînements classiques compatibles avec la séance ;
 *  - 1 : combinaisons libres (mains, techniques et cibles tirées sans règle de boxe).
 * Entre les deux, on tire tantôt dans les classiques, tantôt dans des combinaisons
 * de moins en moins « orthodoxes ».
 */
@Injectable({ providedIn: 'root' })
export class ComboGenerator {
  generate(cfg: SessionConfig, stance: Stance, previous: Combo | null): Combo {
    let combo = this.build(cfg, stance);
    for (let i = 0; i < 5 && previous && sameCombo(combo, previous); i++) {
      combo = this.build(cfg, stance);
    }
    return combo;
  }

  private build(cfg: SessionConfig, stance: Stance): Combo {
    const r = cfg.comboRandomness;
    if (!chance(r)) {
      const classics = this.classicsFor(cfg, stance);
      if (classics.length) return pick(classics);
    }
    return this.random(cfg, stance, r);
  }

  private classicsFor(cfg: SessionConfig, stance: Stance): Combo[] {
    const lead: Hand = stance === 'orthodox' ? 'L' : 'R';
    return CLASSICS.map((code) => parseClassic(code, lead)).filter(
      (combo) =>
        combo.length >= cfg.minMoves &&
        combo.length <= cfg.maxMoves &&
        combo.every((m) =>
          m.type === 'dodge'
            ? cfg.dodges.includes(m.kind)
            : cfg.strikes.includes(m.kind) && (cfg.body || m.target === 'head'),
        ),
    );
  }

  /** Génération libre : plus `r` est grand, moins on respecte l'alternance et les ouvertures au jab. */
  private random(cfg: SessionConfig, stance: Stance, r: number): Combo {
    const lead: Hand = stance === 'orthodox' ? 'L' : 'R';
    const min = Math.max(1, Math.min(cfg.minMoves, cfg.maxMoves));
    const length = min + Math.floor(Math.random() * (Math.max(cfg.minMoves, cfg.maxMoves) - min + 1));
    const kinds: StrikeKind[] = cfg.strikes.length ? cfg.strikes : ['direct'];
    const alternate = 0.8 - 0.3 * r;

    const moves: Move[] = [];
    let lastHand: Hand | null = null;
    let hasStrike = false;

    for (let i = 0; i < length; i++) {
      const prev = moves[i - 1];
      const mustStrike = !hasStrike && i === length - 1;
      const canDodge = cfg.dodges.length > 0 && length > 1 && prev?.type !== 'dodge' && !mustStrike;

      if (canDodge && chance(0.28)) {
        moves.push(this.dodge(cfg));
        continue;
      }

      const hand: Hand =
        lastHand === null
          ? chance(0.65 - 0.15 * r) ? lead : other(lead)
          : chance(alternate) ? other(lastHand) : lastHand;
      let kind = pick(kinds);
      if (lastHand === null && hand === lead && kinds.includes('direct') && chance(0.5 * (1 - r))) {
        kind = 'direct';
      }
      const strike: Strike = { type: 'strike', kind, hand, target: cfg.body && chance(0.3) ? 'body' : 'head' };

      if (prev && sameMove(prev, strike)) {
        strike.target = strike.target === 'head' && cfg.body ? 'body' : 'head';
        if (sameMove(prev, strike)) strike.hand = other(strike.hand);
      }
      moves.push(strike);
      lastHand = strike.hand;
      hasStrike = true;
    }
    return moves;
  }

  private dodge(cfg: SessionConfig): Dodge {
    return makeDodge(pick(cfg.dodges));
  }
}

function makeDodge(kind: DodgeKind): Dodge {
  return { type: 'dodge', kind, side: kind === 'pull' ? null : pick<Hand>(['L', 'R']) };
}

function parseClassic(code: string, lead: Hand): Combo {
  return code.split('-').map((token): Move => {
    if (DODGE_CODES[token]) return makeDodge(DODGE_CODES[token]);
    const n = parseInt(token, 10);
    return {
      type: 'strike',
      kind: STRIKE_CODES[Math.floor((n - 1) / 2)],
      hand: n % 2 === 1 ? lead : other(lead),
      target: token.endsWith('b') ? 'body' : 'head',
    };
  });
}

function sameMove(a: Move, b: Move): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function sameCombo(a: Combo, b: Combo): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

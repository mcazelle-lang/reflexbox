import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { REACTION_REF_MS, SequenceResult, sequenceCadence, sequenceScore } from '../core/models';

const W = 360;
const H = 200;
const PAD = { top: 12, right: 8, bottom: 22, left: 40 };

/**
 * Pour chaque séquence : barre pleine = réaction (affichage → première frappe),
 * barre claire derrière = exécution complète (affichage → dernière frappe, séquences réussies).
 * Vert = réussie, rouge = ratée ; croix rouge = aucune frappe entendue.
 * La ligne pointillée marque 1 s, au-delà de laquelle le bonus de rapidité est nul.
 */
@Component({
  selector: 'app-reaction-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="legend">
      <span><i class="sw ok"></i>réaction (1er coup)</span>
      <span><i class="sw ok light"></i>exécution complète</span>
      <span><i class="sw ko"></i>ratée</span>
      <span><i class="sw ref"></i>1 s (bonus nul)</span>
    </div>
    <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" role="img" aria-label="Temps de réaction par séquence">
      @for (t of ticks(); track t.ms) {
        <line class="grid" [attr.x1]="pad.left" [attr.x2]="w - pad.right" [attr.y1]="t.y" [attr.y2]="t.y" />
        <text class="axis" [attr.x]="pad.left - 6" [attr.y]="t.y + 3" text-anchor="end">{{ t.label }}</text>
      }
      <line class="ref" [attr.x1]="pad.left" [attr.x2]="w - pad.right" [attr.y1]="refY()" [attr.y2]="refY()" />
      @for (b of bars(); track b.i) {
        <g [class.ko]="!b.success">
          <title>Séquence {{ b.i + 1 }} : réaction {{ b.label }} · exécution {{ b.exec }} · {{ b.strikes }} coups, {{ b.cadence }} · {{ b.score }} pts</title>
          <rect class="hit" [attr.x]="b.x - 2" [attr.y]="pad.top" [attr.width]="b.width + 4" [attr.height]="plotH" />
          @if (b.execPath) {
            <path class="bar exec" [attr.d]="b.execPath" />
          }
          @if (b.ms !== null) {
            <path class="bar" [attr.d]="b.path" />
          } @else {
            <path class="miss" [attr.d]="b.cross" />
          }
        </g>
      }
      <line class="base" [attr.x1]="pad.left" [attr.x2]="w - pad.right" [attr.y1]="h - pad.bottom" [attr.y2]="h - pad.bottom" />
      @for (b of bars(); track b.i) {
        @if (b.showIndex) {
          <text class="axis" [attr.x]="b.x + b.width / 2" [attr.y]="h - 6" text-anchor="middle">{{ b.i + 1 }}</text>
        }
      }
    </svg>
    <details>
      <summary>Voir le tableau</summary>
      <table>
        <tr><th>Séq.</th><th>Réaction</th><th>Exécution</th><th>Coups</th><th>Cadence</th><th>Résultat</th><th>Points</th></tr>
        @for (b of bars(); track b.i) {
          <tr><td>{{ b.i + 1 }}</td><td>{{ b.label }}</td><td>{{ b.exec }}</td><td>{{ b.strikes }}</td><td>{{ b.cadence }}</td><td>{{ b.success ? 'réussie' : 'ratée' }}</td><td>{{ b.score }}</td></tr>
        }
      </table>
    </details>
  `,
  styles: `
    :host { display: block; }
    svg { width: 100%; height: auto; display: block; }
    .legend { display: flex; gap: 14px; font-size: 0.8rem; color: var(--muted); margin-bottom: 6px; flex-wrap: wrap; }
    .legend span { display: inline-flex; align-items: center; gap: 6px; }
    .sw { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
    .sw.ok { background: var(--right); }
    .sw.ko { background: var(--left); }
    .sw.light { opacity: 0.35; }
    .sw.ref { height: 0; border-top: 2px dashed var(--muted); border-radius: 0; width: 14px; }
    .grid { stroke: rgb(255 255 255 / 8%); stroke-width: 1; }
    .base { stroke: rgb(255 255 255 / 30%); stroke-width: 1; }
    .ref { stroke: var(--muted); stroke-width: 1.5; stroke-dasharray: 4 3; }
    .axis { fill: var(--muted); font-size: 9px; }
    .bar { fill: var(--right); }
    .ko .bar { fill: var(--left); }
    .bar.exec { opacity: 0.35; }
    .miss { stroke: var(--left); stroke-width: 2; stroke-linecap: round; fill: none; }
    .hit { fill: transparent; }
    g:hover .bar { opacity: 0.8; }
    g:hover .hit { fill: rgb(255 255 255 / 6%); }
    details { margin-top: 8px; font-size: 0.85rem; color: var(--muted); }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; font-variant-numeric: tabular-nums; }
    th, td { text-align: left; padding: 3px 6px; border-bottom: 1px solid var(--surface-2); }
    th { color: var(--text); }
  `,
})
export class ReactionChart {
  readonly sequences = input.required<SequenceResult[]>();

  protected readonly w = W;
  protected readonly h = H;
  protected readonly pad = PAD;
  protected readonly plotH = H - PAD.top - PAD.bottom;

  /** Échelle en ms : au moins 1,5 s, arrondie à 250 ms au-dessus du maximum. */
  private readonly maxMs = computed(() => {
    const max = Math.max(0, ...this.sequences().map((s) => Math.max(s.reactionMs ?? 0, s.executionMs ?? 0)));
    return Math.max(1500, Math.ceil(max / 250) * 250);
  });

  private y(ms: number): number {
    return PAD.top + this.plotH * (1 - ms / this.maxMs());
  }

  protected readonly refY = computed(() => this.y(REACTION_REF_MS));

  protected readonly ticks = computed(() => {
    const step = this.maxMs() > 2000 ? 500 : 250;
    const ticks = [];
    for (let ms = 0; ms <= this.maxMs(); ms += step) {
      ticks.push({ ms, y: this.y(ms), label: ms >= 1000 ? `${(ms / 1000).toFixed(ms % 1000 ? 2 : 0)} s` : `${ms}` });
    }
    return ticks;
  });

  protected readonly bars = computed(() => {
    const seqs = this.sequences();
    const n = Math.max(seqs.length, 1);
    const slot = (W - PAD.left - PAD.right) / n;
    const gap = Math.min(4, slot * 0.25);
    const width = Math.max(1, slot - gap);
    const labelEvery = Math.ceil(n / 15);
    const base = H - PAD.bottom;
    return seqs.map((s, i) => {
      const x = PAD.left + i * slot + gap / 2;
      const top = s.reactionMs !== null ? this.y(s.reactionMs) : base;
      const r = Math.min(4, width / 2, base - top);
      const execTop = s.executionMs != null ? this.y(s.executionMs) : null;
      const cx = x + width / 2;
      const c = Math.min(5, width / 2);
      return {
        i,
        x,
        width,
        ms: s.reactionMs,
        success: s.success,
        score: sequenceScore(s),
        label: s.reactionMs !== null ? `${s.reactionMs} ms` : 'aucune frappe',
        exec: s.executionMs != null ? `${s.executionMs} ms` : '—',
        strikes: s.strikes ?? 1,
        cadence: cadenceLabel(sequenceCadence(s)),
        showIndex: (i + 1) % labelEvery === 0 || i === 0,
        // Barre à coins supérieurs arrondis, posée sur la ligne de base.
        execPath: execTop !== null ? roundedBar(x, width, execTop, base) : null,
        path: `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + width - r} Q${x + width},${top} ${x + width},${top + r} V${base} Z`,
        cross: `M${cx - c},${base - 12 - c} L${cx + c},${base - 12 + c} M${cx + c},${base - 12 - c} L${cx - c},${base - 12 + c}`,
      };
    });
  });
}

function roundedBar(x: number, width: number, top: number, base: number): string {
  const r = Math.min(4, width / 2, base - top);
  return `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + width - r} Q${x + width},${top} ${x + width},${top + r} V${base} Z`;
}

function cadenceLabel(cadence: number | null): string {
  return cadence === null ? '—' : `${cadence.toFixed(1)} coups/s`;
}

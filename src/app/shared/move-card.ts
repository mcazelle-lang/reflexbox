import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Move, moveNumber, Stance } from '../core/models';

/** hidden = pas encore annoncé (mode coup par coup), active = coup du bip en cours. */
export type CardState = 'hidden' | 'shown' | 'active';

/**
 * Une carte = un mouvement.
 *  - couleur : rouge = gauche, vert = droite, ambre = esquive
 *  - forme : carré = coup, rond = esquive
 *  - position par rapport à la ligne d'horizon (classe .horizon du parent) :
 *    au-dessus = tête, en dessous = corps, sur la ligne = esquive
 *  - pictogramme : trajectoire du coup / déplacement de la tête
 * Les pictogrammes sont dessinés pour la main gauche et mis en miroir pour la droite.
 */
@Component({
  selector: 'app-move-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'hostClass()',
  },
  template: `
    @let m = move();
    <div class="face">
      <svg class="icon" viewBox="0 0 100 100" [class.mirror]="mirror()" aria-hidden="true">
        @switch (m.kind) {
          @case ('direct') {
            <path d="M50 90 L50 30" [attr.marker-end]="marker()" />
          }
          @case ('hook') {
            <path d="M22 86 C 22 34, 40 30, 70 30" [attr.marker-end]="marker()" />
          }
          @case ('uppercut') {
            <path d="M18 46 C 24 94, 64 94, 64 32" [attr.marker-end]="marker()" />
          }
          @case ('slip') {
            <circle class="head" cx="26" cy="50" r="13" />
            <path d="M42 50 L76 50" [attr.marker-end]="marker()" />
          }
          @case ('pull') {
            <circle class="head" cx="50" cy="22" r="13" />
            <path d="M50 42 L50 70" [attr.marker-end]="marker()" />
          }
          @case ('roll') {
            <circle class="head" cx="20" cy="22" r="11" />
            <path d="M20 42 C 20 88, 80 88, 80 50" [attr.marker-end]="marker()" />
          }
        }
      </svg>
      @if (number(); as n) {
        <span class="num">{{ n }}</span>
      }
    </div>
  `,
  styleUrl: './move-card.scss',
})
export class MoveCard {
  readonly move = input.required<Move>();
  readonly stance = input<Stance>('orthodox');
  readonly showNumber = input(false);
  readonly state = input<CardState>('shown');

  protected readonly mirror = computed(() => {
    const m = this.move();
    return m.type === 'strike' ? m.hand === 'R' : m.side === 'L';
  });

  /** Marqueurs définis une seule fois dans App (pointe blanche ou foncée selon le fond). */
  protected readonly marker = computed(() =>
    this.move().type === 'dodge' ? 'url(#arrowhead-dark)' : 'url(#arrowhead-light)',
  );

  protected readonly number = computed(() => {
    const m = this.move();
    return this.showNumber() && m.type === 'strike' ? moveNumber(m, this.stance()) : null;
  });

  protected readonly hostClass = computed(() => {
    const m = this.move();
    const kind = m.type === 'strike' ? `strike hand-${m.hand} target-${m.target}` : `dodge dodge-${m.kind}`;
    return `${kind} ${this.state()}`;
  });
}

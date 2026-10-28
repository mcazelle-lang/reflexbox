import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Move } from '../../core/models';
import { MoveCard } from '../../shared/move-card';

interface Entry {
  move: Move;
  label: string;
}

@Component({
  selector: 'app-legend',
  imports: [RouterLink, MoveCard],
  templateUrl: './legend.html',
  styleUrl: './legend.scss',
})
export class LegendPage {
  protected readonly strikes: Entry[] = [
    { move: { type: 'strike', kind: 'direct', hand: 'L', target: 'head' }, label: 'Direct gauche (jab)' },
    { move: { type: 'strike', kind: 'direct', hand: 'R', target: 'head' }, label: 'Direct droit' },
    { move: { type: 'strike', kind: 'hook', hand: 'L', target: 'head' }, label: 'Crochet gauche' },
    { move: { type: 'strike', kind: 'hook', hand: 'R', target: 'head' }, label: 'Crochet droit' },
    { move: { type: 'strike', kind: 'uppercut', hand: 'L', target: 'head' }, label: 'Uppercut gauche' },
    { move: { type: 'strike', kind: 'uppercut', hand: 'R', target: 'head' }, label: 'Uppercut droit' },
  ];

  protected readonly targets: Entry[] = [
    { move: { type: 'strike', kind: 'hook', hand: 'L', target: 'head' }, label: 'Au-dessus de la ligne = tête' },
    { move: { type: 'strike', kind: 'hook', hand: 'L', target: 'body' }, label: 'Sous la ligne = corps' },
  ];

  protected readonly dodges: Entry[] = [
    { move: { type: 'dodge', kind: 'slip', side: 'L' }, label: 'Esquive latérale à gauche' },
    { move: { type: 'dodge', kind: 'slip', side: 'R' }, label: 'Esquive latérale à droite' },
    { move: { type: 'dodge', kind: 'pull', side: null }, label: 'Retrait arrière' },
    { move: { type: 'dodge', kind: 'roll', side: 'R' }, label: 'Rotation du buste (vers la droite)' },
  ];
}

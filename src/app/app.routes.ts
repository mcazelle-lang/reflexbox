import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home/home').then((m) => m.HomePage) },
  { path: 'libre', loadComponent: () => import('./pages/free-session/free-session').then((m) => m.FreeSessionPage) },
  { path: 'entrainement', loadComponent: () => import('./pages/training/training').then((m) => m.TrainingPage) },
  { path: 'bilan', loadComponent: () => import('./pages/results/results').then((m) => m.ResultsPage) },
  { path: 'legende', loadComponent: () => import('./pages/legend/legend').then((m) => m.LegendPage) },
  { path: 'reglages', loadComponent: () => import('./pages/settings/settings').then((m) => m.SettingsPage) },
  { path: '**', redirectTo: '' },
];

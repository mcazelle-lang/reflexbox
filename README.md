# Reflex Boxe

Application web mobile (Angular 21, zoneless, signals) pour travailler les réflexes en boxe anglaise :
l'écran impose des enchaînements de 1 à 5 mouvements, lisibles d'un coup d'œil, pendant des rounds de 10 s à 3 min.

## Lancer

```bash
npm install          # en cas d'erreur « edgesOut » avec npm 10.8 : npx npm@11 install
npm start            # http://localhost:4200
npm run start:mobile # HTTPS sur le réseau local, pour tester sur téléphone (le micro exige HTTPS)
npm run build
```

### Accès depuis le téléphone

1. Lancer `npm run start:mobile` ([scripts/serve-mobile.mjs](scripts/serve-mobile.mjs)), avec le téléphone sur le même Wi-Fi que le PC
   (pas un réseau invité, pas en 4G).
   Le script annonce le nom `reflexbox.local` en mDNS (Bonjour), puis sert l'app en HTTPS sur le port 443.
2. Ouvrir **https://reflexbox.local** sur le téléphone.
   Si le nom n'est pas résolu, utiliser l'adresse IP affichée dans la console (par exemple `https://192.168.1.69`).
3. Le certificat est auto-signé, donc le navigateur affiche un avertissement. Pour passer outre :
   - Chrome Android : « Paramètres avancés » → « Continuer vers… » ;
   - Safari iOS : « Afficher les détails » → « Visiter ce site web ».

Le nom autorisé par le serveur de dev est déclaré dans `angular.json`, sous `serve.options.allowedHosts`.
Le port se change avec la variable d'environnement `PORT`.

## Code visuel

| Élément | Signification |
|---|---|
| Carte rouge / verte | Main gauche / main droite |
| Rond ambre | Esquive |
| Carte au-dessus de la ligne | Tête |
| Carte sous la ligne | Corps |
| Esquive centrée sur la ligne | — |
| Flèche droite ↑ | Direct |
| Flèche coudée | Crochet (de l'extérieur vers l'intérieur) |
| Flèche en cuillère | Uppercut |
| Tête + flèche latérale | Esquive latérale (sens de la flèche) |
| Tête + flèche vers le bas | Retrait arrière |
| Tête + flèche en U | Rotation du buste |

## Structure

- `src/app/core/` : modèles, niveaux, générateur d'enchaînements, audio, détection d'impacts micro, progression (localStorage)
- `src/app/shared/move-card.ts` : la carte d'un mouvement (pictogrammes SVG)
- `src/app/pages/training/` : écran d'entraînement et `TrainingEngine` (minuterie, créneaux, comptage)
- `src/app/pages/` : accueil/progression, séance libre, bilan, légende, réglages

## Rythme, bips et aléatoire

- **Vitesse des enchaînements** (`comboSpeed`, coups/s) : chaque mouvement a son temps, espacé de `1 / vitesse` secondes,
  avec un bip et son icône. Le bip est grave pour la gauche, aigu pour la droite et sourd pour une esquive.
  Elle va de 2 coups/s au niveau 1 à 4,2 coups/s au niveau 10, et se règle de 1 à 6 coups/s en séance libre.
- **Volume de frappe** (`strikesPerMin`) : moyenne de coups par minute. Il fixe la pause entre deux enchaînements :
  `n × 60 / volume − durée de l'enchaînement`, avec un minimum de 300 ms.
- **Affichage** (Réglages) :
  - *coup par coup* : chaque icône apparaît sur son bip ;
  - *séquence + surlignage* : tout l'enchaînement est visible et le coup en cours est entouré.
  Une fois le dernier coup apparu, l'enchaînement complet reste affiché tel quel, sans estompage ni surlignage,
  pendant un temps égal à son apparition.
- **Aléatoire du timing** (`timingRandomness`, 0–1) : la pause entre enchaînements varie de ±100 % autour de sa moyenne (volume conservé), et le rythme entre les coups devient irrégulier (±30 % max).
- **Variété des enchaînements** (`comboRandomness`, 0–1) : probabilité de tirer une combinaison libre plutôt qu'un enchaînement classique
  (bibliothèque dans `combo-generator.ts`). Plus elle est haute, moins la génération respecte l'alternance des mains et l'ouverture au jab.
- Ces deux dosages augmentent avec les niveaux : 0 au niveau 1, 0,6 au niveau 10.

## Progression

10 niveaux qui ajoutent progressivement crochets, corps, uppercuts, esquives, puis cadence et durée.
Chaque séance terminée rapporte 1 étoile. Avec le micro, elle rapporte 2 étoiles à partir de 70 % de précision et 3 étoiles à partir de 90 %.
Tous les niveaux sont jouables à tout moment. Avec 3 étoiles cumulées, un niveau est validé et le suivant devient le niveau conseillé à l'accueil.

## Micro

La détection se fait par front montant :
- un impact est compté quand le pic d'amplitude dépasse à la fois un seuil absolu et nettement le bruit de fond ;
- le seuil absolu va de −6 dBFS à 0 % de sensibilité à −42 dBFS à 100 % ;
- l'écart demandé au-dessus du bruit de fond va de ×6 à ×2.

Après un impact, le détecteur reste désarmé jusqu'à ce que le son retombe sous 35 % du pic, avec 90 ms minimum entre deux coups.
Un bruit continu (ventilateur, musique, gain automatique du téléphone) compte donc au plus une fois.
Le bruit de fond est suivi en permanence : il monte lentement et redescend vite.

Les bips et la voix de l'app désarment la détection sans compter. La coupure dure le temps du son plus la latence de sortie audio.
La précision compte, pour chaque enchaînement, `min(impacts, coups demandés)`.
Le temps de réaction est mesuré entre l'affichage et le premier impact.
À calibrer dans Réglages → « Tester au sac ».

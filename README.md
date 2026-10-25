# Crossword Daily JVC

Une grille de mots croisés par jour, la même pour tout le forum, directement sur jeuxvideo.com (userscript).

Statut : **bêta**. Si le bouton s'affiche mal sur votre forum, ouvrez un ticket dans l'onglet *Issues* avec une capture d'écran.

## Installation
1. Installez un gestionnaire de scripts : **Tampermonkey** (Chrome, Edge, Firefox, Safari) ou **Violentmonkey** (Chrome, Firefox). Sur Chrome, vérifiez dans `chrome://extensions` que l'option « Autoriser les scripts utilisateur » est activée.
2. Cliquez sur ce lien, puis sur **Installer** :
   https://raw.githubusercontent.com/seblenonsaint/Crossword-Daily-JVC/main/crossword-daily-jvc.user.js
3. Allez sur un forum, par exemple *Forum Blabla 18-25 ans* : le bouton **🧩 Mots du jour** apparaît à droite du titre.

Les mises à jour sont proposées automatiquement par votre gestionnaire de scripts (comptez jusqu'à 24 h).

## Jouer
- **Clavier** : lettres, flèches pour se déplacer, Espace ou Entrée pour changer de sens, Retour arrière pour effacer, Échap pour fermer.
- **Tactile** : touchez une case ou une définition ; ‹ › change de mot.
- Une nouvelle grille 11 × 11 chaque jour à minuit (heure de Paris), identique pour tous.
- Un mot juste se verrouille tout seul.

## Niveaux : forces 1 à 6
Chaque mot a une force, affichée à côté de son indice :

| Force | Niveau |
|---|---|
| 1 et 2 | Facile |
| 3 et 4 | Intermédiaire |
| 5 et 6 | Difficile à très difficile |

Chaque grille mélange les trois paliers, dans les mêmes proportions tous les jours : la difficulté ne dépend ni du jour de la semaine ni de la date.

## Score
**Temps final** = temps de jeu + 30 s par indice + 15 s par vérification. Plus bas = meilleur.
Le chrono ne tourne que si le panneau est ouvert et l'onglet visible.
Le bouton **Partager** copie un résultat sans spoiler, à coller dans un topic. Le script garde aussi votre série de jours terminés, votre record et votre meilleur temps.

## Mots
838 mots, répartis en 4 familles qui tournent chaque jour : un mot ne revient jamais avant 4 jours.
Pour proposer un mot, ouvrez un ticket (*Issues*) avec ce format : `MOT|indice|force`
Exemple : `ESTUAIRE|Embouchure large d'un fleuve à marée|5`

Règles : mot sans accent ni espace, indice qui ne contient pas la réponse, force estimée de 1 à 6.

## Vie privée
Aucune donnée n'est envoyée : le script n'utilise aucun serveur. Votre progression est stockée dans le navigateur (clés `cdj:v03:*` et `cdj:v04:*`). Vider les données du site jeuxvideo.com l'efface. Le script ne lit ni ne poste aucun message.

## Limites
Les scores sont déclaratifs : rien ne permet de les vérifier, car le script s'exécute dans votre navigateur. Jouez pour le plaisir.

## Dépannage
Pas de bouton ? Sur la page du forum, ouvrez la console (`Ctrl + Maj + J`), tapez `localStorage.setItem('cdj:debug','1')`, rechargez la page, puis joignez une capture de la console à votre ticket.

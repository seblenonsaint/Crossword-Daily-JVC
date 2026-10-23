# Crossword Daily JVC

Une grille de mots croisés par jour, la même pour tout le forum, directement sur jeuxvideo.com (userscript).

Statut : **bêta**. Le bouton est testé sur des pages de démonstration ; si vous constatez un problème d'affichage sur le vrai forum, ouvrez un ticket dans l'onglet *Issues*.

## Installation
1. Installez un gestionnaire de scripts : **Tampermonkey** (Chrome, Edge, Firefox, Safari) ou **Violentmonkey** (Chrome, Firefox). Sur Chrome, vérifiez dans `chrome://extensions` que l'option « Autoriser les scripts utilisateur » est activée.
2. Cliquez sur ce lien, puis sur **Installer** :
   https://raw.githubusercontent.com/seblenonsaint/Crossword-Daily-JVC/main/crossword-daily-jvc.user.js
3. Allez sur un forum, par exemple *Forum Blabla 18-25 ans* : le bouton **🧩 Mots du jour** apparaît à droite du titre.

Les mises à jour sont proposées automatiquement par votre gestionnaire de scripts.

## Jouer
- Clavier : lettres, flèches pour se déplacer, Espace ou Entrée pour changer de sens, Retour arrière pour effacer, Échap pour fermer.
- Tactile : touchez une case ou une définition ; ‹ › change de mot.
- Une nouvelle grille chaque jour à minuit (heure de Paris), identique pour tous.
- Score : temps actif + 30 s par indice + 15 s par vérification. Plus bas = mieux.

## Vie privée
Aucune donnée n'est envoyée : le script n'utilise aucun serveur. Votre progression est stockée dans le navigateur (clés `cdj:v03:*`). Vider les données du site jeuxvideo.com l'efface. Le script ne lit ni ne poste aucun message.

## Limites
Les scores sont déclaratifs : rien ne permet de les vérifier. Jouez pour le plaisir.

## Dépannage
Pas de bouton ? Sur la page du forum, ouvrez la console (`Ctrl + Maj + J`), tapez `localStorage.setItem('cdj:debug','1')`, rechargez, puis joignez une capture de la console à votre ticket.

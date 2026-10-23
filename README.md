# Crossword Daily JVC

Mots croisés quotidiens pour les forums jeuxvideo.com (userscript). Statut : **bêta — voir AUDIT.md (blocages de publication)**.

## Installation
1. Installer un gestionnaire de userscripts : Tampermonkey (Chrome, Edge, Firefox, Safari), Violentmonkey (Chrome, Firefox) ou Greasemonkey (Firefox). Sur iOS : « Userscripts » (Safari).
2. Ouvrir `crossword-daily-jvc.user.js` (glisser le fichier dans le navigateur, ou « Nouveau script » puis coller son contenu) et confirmer l'installation. Une seule permission : `GM_addStyle`.
3. Aller sur un forum, par exemple *Forum Blabla 18-25 ans* : le bouton **🧩 Mots du jour** apparaît à droite du titre.
4. Mise à jour : une fois hébergé sur JVScript.fr, le gestionnaire la propose automatiquement (nécessite `@updateURL`/`@downloadURL`, à renseigner).

## Jouer
Clavier : lettres, flèches, Espace/Entrée (changer de sens), Retour arrière, Échap (fermer). Tactile : touchez une case ou une définition ; ‹ › change de mot.
Score : temps actif + 30 s/indice + 15 s/vérification.

## Dépannage
- Pas de bouton : `localStorage.setItem('cdj:debug','1')` puis recharger ; la console indique l'élément de titre choisi.
- Progression perdue : elle est dans le localStorage de jeuxvideo.com (clés `cdj:v03:*`) ; vider les données du site l'efface.

## Tests
`node tests/generator.test.js` et `node tests/browser.test.js` (playwright requis). Détail dans TESTS.md.

## Avant de publier (à compléter par l'auteur)
Ajouter dans l'en-tête `@author`, `@license`, `@homepageURL`, `@supportURL`, `@updateURL`, `@downloadURL`.

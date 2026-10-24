# Changelog

## 0.4.0 — dictionnaire étendu et fin des répétitions
- **649 mots** (au lieu de 148), tous niveaux mélangés : animaux, nature, corps, cuisine, maison, métiers, sport, sciences, histoire et mythes, géographie, mots abstraits et **jeux vidéo / internet** (console, boss, avatar, topic, pseudo…).
- **Anti-répétition** : le dictionnaire est réparti en 4 familles qui tournent chaque jour ; un mot ne peut jamais revenir avant 4 jours (mesuré sur 400 jours : écart médian 20 jours, aucun mot en commun entre deux jours consécutifs).
- Le générateur refuse de placer ensemble deux mots dont l'un figure dans l'indice de l'autre.
- **Transition en douceur** : les grilles jusqu'au 27/10/2026 restent strictement identiques (test de régression) ; le nouveau dictionnaire s'applique à partir du 28/10/2026 (`NEW_FROM`). Séries et statistiques conservées.
- Le panneau s'ouvre toujours en haut.

## 0.3.0 — audit et fiabilisation
**Équité**
- Score transparent : temps actif + 30 s par indice + 15 s par vérification ; affiché en continu.
- Chrono actif (panneau ouvert, onglet visible, plafond anti-veille) au lieu de l'horloge murale.
- « Effacer » devient « Effacer mes erreurs » : conserve chrono, indices et vérifications.
- Verrouillages recalculés depuis la grille ; état du localStorage entièrement assaini ; synchronisation entre onglets.
- Tailles de grille par jour de semaine (7 / 9 / 11 / 13) ; 5×5 supprimé ; grilles renouvelées (graine `cdj03`).

**Communauté**
- Défi numéroté (#N depuis le 23/10/2026), série, record, meilleur temps.
- Texte de partage avec temps net, pénalités et série, sans spoiler.

**Interface**
- Bouton ancré au titre « Forum … » sans modifier le style natif ; ré-ancrage si le site re-rend ; repli flottant limité aux listes de sujets.
- Barre de définition courante avec ‹ ›, en-tête collant, règles repliables, bandeau de changement de jour.
- Clavier : Espace/Entrée = changer de sens, flèches sans retour à la ligne, Backspace/Suppr fiables, tabulation unique dans la grille, définitions focalisables.
- Mobile : police 16 px, cases ≥ 22 px, boutons ≥ 40 px, saisie en majuscules sans correction automatique.

**Corrections**
- Une lettre saisie peut enfin être remplacée directement.
- Le 1er clic sur une case croisée ne bascule plus de sens.
- 17 indices contenant une réponse et ~10 ambiguïtés réécrits.
- `try/catch` à l'initialisation, date Paris via `formatToParts`, `@noframes`.

## 0.2.2
Version auditée (voir AUDIT.md).

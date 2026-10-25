# Changelog

## 0.6.0 — accents significatifs
- **Les accents font partie de la réponse** (grilles à partir du **31/10/2026**) : ÉTÉ ≠ ETE, PÊCHE ≠ PECHE, FORÊT ≠ FORET. Validation stricte, lettre par lettre.
- **Base de données** : les 160 mots à accents conservent leur orthographe d'origine (ÉTÉ, FORÊT, HÔPITAL, NAPOLÉON, CLÉOPÂTRE, NOËL, MAÇON…), en Unicode NFC et en majuscules. Chaque entrée garde aussi sa forme sans accent (`key`) pour les anciennes grilles et les contrôles internes.
- **Saisie** : é è ê à â ç ù û î ô ë ï ü ÿ tapés en minuscules deviennent É È Ê À Â Ç Ù Û Î Ô Ë Ï Ü Ÿ ; touches mortes (^ puis e) gérées sans casser la composition ; formes décomposées (e + accent combinant) converties en NFC ; chiffres et symboles refusés.
- **Ligature œ / æ** : elles occupent deux cases (O+E, A+E) comme dans une grille classique ; taper « œ » remplit les deux.
- **Barre d'accents** sous la grille (É È Ê À Â Ç Ù Û Î Ï Ô Ë Ü Œ) pour mobile et claviers sans touches mortes ; elle ne vole pas le focus de la case.
- Aucune régression : les grilles du 23/10 au 30/10 restent strictement identiques (test de comparaison), navigation, sauvegarde, chrono, score et partage inchangés. Progression du mode accent stockée sous `cdj:v05:<date>`, séries et stats conservées.

## 0.5.0 (regroupe la 0.4.0) — niveaux mélangés, dictionnaire étendu, fin des répétitions
- **Forces 1 à 6** : chaque mot a une force (1-2 facile, 3-4 intermédiaire, 5-6 difficile à très difficile), affichée sur chaque indice (pastille F1…F6) et dans la barre de définition.
- **Niveaux mélangés dans chaque grille** : chaque grille contient entre 20 % et 50 % de chacun des trois paliers (en pratique ≈ 45 % faciles, 30 % intermédiaires, 26 % difficiles). **Plus aucune progression selon le jour ou la date** : taille fixe 11 × 11 pour toutes les nouvelles grilles (mesuré sur 400 jours : part de mots difficiles identique du dimanche au samedi, ±1 point).
- **838 mots** (au lieu de 148) : dont ≈ 130 mots difficiles (expressions rares, littérature, sciences, géographie, philosophie, jargon du jeu vidéo : HITBOX, SHADER, SPEEDRUN, NERF…).
- **Anti-répétition** : le dictionnaire est réparti en 4 familles qui tournent chaque jour ; un mot ne revient jamais avant 4 jours (mesuré sur 400 jours : écart médian 24 jours, aucun mot en commun entre deux jours consécutifs).
- Le générateur refuse de placer ensemble deux mots dont l'un figure dans l'indice de l'autre.
- **Transition en douceur** : les grilles jusqu'au 27/10/2026 restent strictement identiques (test de régression) ; le nouveau mode s'applique à partir du 28/10/2026 (`NEW_FROM`). Séries et statistiques conservées.
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

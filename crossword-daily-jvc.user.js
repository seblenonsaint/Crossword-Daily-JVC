// ==UserScript==
// @name         Crossword Daily JVC
// @namespace    https://jvscript.fr/
// @version      0.9.0
// @description  Mots croisés quotidiens sur les forums JVC : une grille par jour, identique pour tout le monde. Chrono, série et partage du résultat, 100 % local.
// @match        https://www.jeuxvideo.com/forums/*
// @match        https://jeuxvideo.com/forums/*
// @match        https://www.jeuxvideo.com/forums.htm
// @match        https://jeuxvideo.com/forums.htm
// @author       seblenonsaint
// @license      MIT
// @homepageURL  https://github.com/seblenonsaint/Crossword-Daily-JVC
// @supportURL   https://github.com/seblenonsaint/Crossword-Daily-JVC/issues
// @downloadURL  https://raw.githubusercontent.com/seblenonsaint/Crossword-Daily-JVC/main/crossword-daily-jvc.user.js
// @updateURL    https://raw.githubusercontent.com/seblenonsaint/Crossword-Daily-JVC/main/crossword-daily-jvc.user.js
// @noframes
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

/*
 * Crossword Daily JVC — v0.9.0
 *
 * Aucune requête réseau, aucune donnée envoyée : tout reste dans le localStorage
 * du navigateur. La grille du jour est calculée à partir de la date (fuseau
 * Europe/Paris), donc identique pour tous les joueurs sans serveur.
 *
 * Limites assumées (voir README / rapport d'audit) :
 *  - un userscript est lisible et modifiable par son utilisateur : le score est
 *    DÉCLARATIF et ne peut pas être garanti sans serveur ;
 *  - la solution est calculable par quiconque lit ce fichier.
 */
(() => {
  'use strict';
  if (document.getElementById('cdj-panel')) return; // garde anti double injection

  /* <pure> — bloc sans accès au DOM, extrait tel quel par les tests Node */
  const VERSION = '0.9.0';
  // Alphabet français : majuscules accentuées comprises, en Unicode NFC (é = U+00E9, jamais « e » + accent combinant).
  // Les ligatures œ / æ sont saisies comme deux lettres (OE, AE), comme dans une grille classique.
  const STRICT_RE = /^[A-ZÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸ]$/;
  const BASE_RE = /^[A-Z]$/;
  const fold = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Normalise une saisie : NFC, ligatures développées, majuscules (règles françaises), lettres autorisées seulement.
  // strict = true : les accents sont conservés ; strict = false (anciennes grilles) : ils sont retirés.
  function normalizeInput(raw, strict) {
    let t = String(raw).normalize('NFC').replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/æ/g, 'ae').replace(/Æ/g, 'AE')
      .toLocaleUpperCase('fr').normalize('NFC');
    if (!strict) t = fold(t).normalize('NFC');
    return [...t].filter((c) => (strict ? STRICT_RE : BASE_RE).test(c)).join('');
  }
  const EPOCH = '2026-10-23';       // défi n°1
  const HINT_PENALTY = 30;          // secondes ajoutées par indice
  const CHECK_PENALTY = 15;         // secondes ajoutées par vérification
  // Taille de grille selon le jour (0 = dimanche) : courbe de difficulté prévisible.
  const SIZE_BY_WEEKDAY = [11, 7, 7, 9, 9, 11, 13];
  const MIN_WORDS = { 5: 4, 7: 7, 9: 10, 11: 13, 13: 16 };
  // Nouvelles grilles : taille fixe (pas de progression selon le jour) et mélange imposé des niveaux.
  // Force 1-2 = facile, 3-4 = intermédiaire, 5-6 = difficile à très difficile.
  const SIZE_NEW = 11;
  const MIX_MIN = 0.2, MIX_MAX = 0.5; // part de chaque palier dans une grille
  const tierOf = (e) => (e.force <= 2 ? 0 : e.force <= 4 ? 1 : 2);
  const mixCounts = (entries) => entries.reduce((c, e) => { c[tierOf(e)]++; return c; }, [0, 0, 0]);
  const mixOk = (entries) => entries.length > 0
    && mixCounts(entries).every((c) => c / entries.length >= MIX_MIN && c / entries.length <= MIX_MAX);

  const LEGACY_RAW = `CHAT|Félin domestique;CHIEN|Animal qui aboie;LUNE|Satellite de la Terre;SOLEIL|Notre étoile;MER|Étendue d'eau salée;LAC|Étendue d'eau intérieure;RIVE|Bord d'une rivière;PLAGE|Rivage sablonneux;VAGUE|Ondulation de l'eau;ORAGE|Tonnerre et éclairs;NUAGE|Masse de vapeur dans le ciel;PLUIE|Précipitation liquide;NEIGE|Précipitation hivernale en flocons;VENT|Air en mouvement;ARBRE|Végétal à tronc;FORÊT|Étendue boisée;FLEUR|Partie colorée d'une plante;ROSE|Rosacée à épines;TIGE|Axe d'une plante;RACINE|Partie souterraine;FEUILLE|Organe de la photosynthèse;FRUIT|Se mange, après la floraison;POMME|Se cueille sur un pommier;POIRE|Se cueille sur un poirier;PÊCHE|Velouté, avec un noyau;PRUNE|Se cueille sur un prunier;RAISIN|Pousse en grappes sur la vigne;CERISE|Petite boule à queue du cerisier;MELON|Cucurbitacée sucrée;CITRON|Agrume très acide;ORANGE|Agrume sucré qui nomme une couleur;TABLE|Meuble pour les repas;CHAISE|Siège à dossier;PORTE|Ouverture mobile;FENÊTRE|Ouverture vitrée;MAISON|Lieu d'habitation;TOIT|Couverture d'un bâtiment;MUR|Paroi verticale;SALON|Pièce de réception;CUISINE|Pièce des repas;LIVRE|Ouvrage relié à lire;PAGE|Côté d'un feuillet imprimé;STYLO|Instrument à encre;CRAYON|Instrument à mine;PAPIER|Support d'écriture;LETTRE|Signe de l'alphabet;MOT|Unité du dictionnaire;PHRASE|Énoncé complet et ponctué;TEXTE|Contenu écrit d'un document;ÉCOLE|Lieu d'enseignement;CLASSE|Groupe d'apprenants;ÉLÈVE|Personne qui apprend;PROF|Enseignant familier;COURS|Leçon;EXAMEN|Épreuve d'évaluation;NOTE|Résultat scolaire;MATHS|Discipline des équations;NOMBRE|Objet servant à compter;CHIFFRE|Symbole numérique;CARRÉ|Quadrilatère régulier;CERCLE|Courbe fermée autour d'un centre;ANGLE|Ouverture entre deux droites;LIGNE|Trait continu;POINT|Lieu sans dimension en géométrie;FORME|Aspect extérieur d'une figure;TEMPS|Ce que mesure l'horloge;HEURE|Vingt-quatrième partie d'une journée;MINUTE|Soixante secondes;JOUR|Durée d'une rotation de la Terre;NUIT|Période d'obscurité;MATIN|Début de journée;SOIR|Fin de journée;SEMAINE|Du lundi au dimanche;MOIS|Un douzième d'an;ANNÉE|Période allant de janvier à décembre;HIVER|Saison froide;PRINTEMPS|Saison des bourgeons;AUTOMNE|Saison des vendanges;ÉTÉ|Saison chaude;ROUTE|Voie de circulation;TRAIN|Transport sur rails;AVION|Appareil volant;VÉLO|Deux-roues à pédales;BATEAU|Véhicule flottant;VILLE|Grande agglomération;VILLAGE|Petite agglomération;RUE|Voie urbaine;PLACE|Espace public;PONT|Franchit une rivière;AMI|Personne liée par l'amitié;AMIE|Camarade, au féminin;FAMILLE|Personnes apparentées;ENFANT|Jeune être humain;PARENT|Père ou mère;FRÈRE|Garçon de la fratrie;SOEUR|Fille de la fratrie;JEU|Activité ludique;JOUEUR|Participant d'une partie;SCORE|Total marqué;RÈGLE|Consigne à respecter;ÉNIGME|Question à résoudre;INDICE|Aide à la résolution;RÉPONSE|Solution à une question;SECRET|Information cachée;IDÉE|Pensée;LOGIQUE|Étude du raisonnement;MÉMOIRE|Faculté de se souvenir;SAVOIR|Connaissances;ESPRIT|Intelligence, ou fantôme;RAISON|Bon sens, faculté de juger;RIRE|Exprimer sa gaieté;JOIE|Sentiment de bonheur;PEUR|Émotion face au danger;CALME|Absence d'agitation;PAIX|Absence de guerre;FORCE|Capacité d'action;VITESSE|Distance par durée;ÉNERGIE|Capacité de travail;MUSIQUE|Art de combiner mélodies et rythmes;CHANT|Mélodie exécutée sans instrument;DANSE|Mouvement en rythme;IMAGE|Reflet que renvoie un miroir;PHOTO|Cliché pris avec un appareil;FILM|Œuvre cinématographique;SCÈNE|Partie d'une pièce;ÉCRAN|Surface d'affichage;RADIO|Média sonore;VOIX|Instrument de la parole;SON|Vibration audible;BRUIT|Nuisance sonore;MAIN|Extrémité du bras;PIED|Extrémité de la jambe;TÊTE|Partie supérieure du corps;OEIL|Organe de la vue;NEZ|Organe de l'odorat;BOUCHE|Ouverture du visage;COEUR|Organe central de la circulation;SANG|Liquide des vaisseaux;BLEU|Couleur du ciel clair;ROUGE|Couleur de la tomate mûre;VERT|Couleur de l'herbe;BLANC|Couleur du lait;NOIR|Couleur de l'encre;GRIS|Couleur de la cendre;FER|Métal de l'acier;BOIS|Matière du tronc;PIERRE|Matériau minéral;VERRE|Matériau des vitres`;

  // Dictionnaire étendu (v0.4) : indices variés, tous niveaux. Les anciens mots sont conservés.
  const EXTRA_RAW = `LION|Roi de la savane|1;TIGRE|Grand félin rayé|1;LOUP|Il hurle à la pleine lune|1;RENARD|Roux et rusé dans les fables|2;OURS|Plantigrade qui hiberne|1;CHEVAL|Il galope avec un cavalier sur le dos|1;VACHE|Elle donne du lait|1;MOUTON|Il donne sa laine|1;CHÈVRE|Elle fournit du fromage frais|2;COCHON|Il a une queue en tire-bouchon|2;POULE|Elle pond des oeufs|1;CANARD|Palmipède qui cancane|1;OIE|Palmipède du foie gras|2;LAPIN|Il aime les carottes|1;SOURIS|Rongeur ou périphérique d'ordinateur|1;RAT|Rongeur des égouts|2;SINGE|Primate agile, cousin de l'homme|1;GIRAFE|Animal au plus long cou|1;ZÈBRE|Équidé rayé d'Afrique|2;ÉLÉPHANT|Pachyderme à trompe|1;DAUPHIN|Mammifère marin très joueur|2;BALEINE|Plus grand mammifère marin|2;REQUIN|Squale redouté des nageurs|2;POISSON|Il respire avec des branchies|1;ABEILLE|Elle butine et fait du miel|1;FOURMI|Petit insecte travailleur|2;PAPILLON|Ancienne chenille aux ailes colorées|2;ARAIGNÉE|Elle tisse une toile|2;SERPENT|Reptile sans pattes|1;TORTUE|Reptile à carapace|1;GRENOUILLE|Batracien qui coasse|2;AIGLE|Rapace symbole de puissance|2;HIBOU|Rapace nocturne|2;CORBEAU|Oiseau sombre de la fable du fromage|3;MOINEAU|Petit oiseau des villes|3;HÉRISSON|Boule de piquants|3;ÉCUREUIL|Rongeur roux amateur de noisettes|3;CERF|Mâle portant des bois|2;CHAMEAU|Bossu du désert à deux bosses|3;PINGOUIN|Oiseau marin des régions froides|3;FAUCON|Rapace dressé pour la chasse|3;PERROQUET|Oiseau coloré qui répète ce qu'il entend|3;HIRONDELLE|Migratrice à queue en fourche|3;ESCARGOT|Il porte sa coquille|3;LIÈVRE|Rapide oreillard de la fable|3;MOUCHE|Insecte bourdonnant|2;MOUSTIQUE|Il pique en bourdonnant|3;CRABE|Il marche de côté|3;PIEUVRE|Mollusque à huit bras|3;MÉDUSE|Elle brûle les baigneurs|3;LICORNE|Cheval légendaire à une corne|3;DRAGON|Monstre ailé qui crache du feu|1;MONTAGNE|Haut relief rocheux|2;COLLINE|Petite élévation de terrain|2;VALLÉE|Creux entre deux reliefs|3;VOLCAN|Relief qui crache de la lave|3;DÉSERT|Étendue aride de sable|2;OCÉAN|Immense étendue salée|2;ÎLE|Terre entourée d'eau|2;FLEUVE|Grand cours d'eau|2;RUISSEAU|Petit cours d'eau|2;CASCADE|Chute d'eau|3;GLACIER|Rivière de glace|3;GLACE|Eau solide|2;CAVERNE|Grotte profonde|3;FALAISE|Paroi rocheuse abrupte|3;SABLE|Il compose les dunes|2;DUNE|Colline de sable|3;TERRE|Notre planète|2;PLANÈTE|Mars ou Vénus, par exemple|2;ÉTOILE|Astre scintillant|2;COMÈTE|Astre à longue queue lumineuse|3;GALAXIE|Immense ensemble d'étoiles|3;UNIVERS|Tout ce qui existe|3;ÉCLIPSE|Un astre en cache un autre|4;AURORE|Première lueur du jour|3;BROUILLARD|Voile qui limite la visibilité|3;TEMPÊTE|Perturbation violente|3;ÉCLAIR|Trait de lumière précédant le tonnerre|3;TONNERRE|Grondement après la foudre|3;FOUDRE|Décharge électrique du ciel|3;GRÊLE|Précipitation de grains durs|3;BRISE|Souffle léger|3;ARBUSTE|Petit végétal ligneux|3;BUISSON|Touffe de branches épineuses|3;HERBE|Elle pousse dans la prairie|2;PRAIRIE|Étendue herbeuse|3;CHAMP|Terre cultivée|2;JARDIN|Espace cultivé d'agrément|2;CHÊNE|Arbre aux glands|3;SAPIN|Conifère de Noël|3;PALMIER|Arbre des oasis|3;BAMBOU|Plante creuse mangée par le panda|3;MOUSSE|Végétal doux qui tapisse les troncs|3;CHAMPIGNON|Cèpe ou girolle|3;TULIPE|Fleur néerlandaise|3;MARGUERITE|Fleur effeuillée par les amoureux|3;LILAS|Arbuste à grappes parfumées mauves|3;ORCHIDÉE|Plante exotique délicate|3;MUGUET|Brin porte-bonheur du premier mai|3;CACTUS|Plante grasse piquante|3;LAVANDE|Plante violette de Provence|3;BRAS|Membre qui va de l'épaule au coude|1;JAMBE|Membre qui porte le corps|1;GENOU|Articulation entre cuisse et tibia|3;COUDE|Articulation entre humérus et radius|3;DOIGT|L'index en est un|2;ONGLE|Il se coupe ou se vernit|3;DENT|Elle mord et se brosse|1;LANGUE|Organe du goût|1;OREILLE|Organe de l'ouïe|1;JOUE|Partie ronde du visage|3;FRONT|Haut du visage|3;CHEVEU|Poil de la chevelure|2;PEAU|Enveloppe du corps|2;OS|Il compose le squelette|2;MUSCLE|Il se contracte pour bouger|2;CERVEAU|Siège de la pensée|3;POUMON|Organe de la respiration|3;FOIE|Organe qui produit la bile|2;RHUME|Infection virale bénigne des voies respiratoires|3;FIÈVRE|Température élevée du corps|3;MÉDECIN|Il soigne les malades|2;HÔPITAL|Lieu de soins|2;REMÈDE|Traitement pour guérir|3;SOMMEIL|Repos nocturne|2;RÊVE|Vision de l'endormi|2;SANTÉ|On la souhaite en trinquant|2;FATIGUE|Besoin de repos|2;PAIN|Aliment de la baguette|1;FROMAGE|Camembert ou brie|1;BEURRE|Il se tartine, issu de la crème|2;LAIT|Boisson des biberons|1;OEUF|Il contient un jaune|1;SUCRE|Il rend le café doux|1;SEL|Il assaisonne les plats|1;POIVRE|Épice qui fait éternuer|3;CAFÉ|Boisson de l'expresso|1;THÉ|Infusion asiatique|2;CHOCOLAT|Gourmandise tirée du cacao|2;GÂTEAU|Dessert d'anniversaire|1;TARTE|Dessert à fond de pâte|3;BONBON|Friandise sucrée|1;SORBET|Dessert glacé sans crème|3;CRÊPE|Elle se mange à la Chandeleur|3;SOUPE|Plat chaud en bouillon|1;SALADE|Plat vert avec une vinaigrette|2;TOMATE|Base du ketchup|2;CAROTTE|Légume orangé croquant|2;OIGNON|Il fait pleurer quand on l'épluche|2;AIL|Bulbe qui parfume et éloigne les vampires|2;RIZ|Céréale asiatique|2;PÂTES|Spaghettis et tagliatelles|2;JAMBON|Charcuterie de porc|2;SAUCISSE|Charcuterie en boyau|2;STEAK|Tranche de boeuf grillée|2;POULET|Volaille rôtie du dimanche|2;SAUMON|Fumé, il garnit les blinis|3;HUÎTRE|Mollusque à avaler vivant|3;MOULE|Coquillage servi avec des frites|3;FRAISE|Baie sucrée à pépins externes|1;BANANE|Jaune et courbée, riche en potassium|1;ANANAS|Tropical piquant à couronne|3;NOIX|Elle se casse en deux coques|3;AMANDE|Elle donne un lait et un massepain|3;MIEL|Nectar transformé par les butineuses|2;VINAIGRE|Condiment acide issu du vin|3;VIN|Boisson du Bordeaux|2;BIÈRE|Boisson d'orge et de houblon|3;CIDRE|Boisson bretonne fermentée|3;EAU|Elle coule du robinet|1;JUS|Boisson pressée|2;RECETTE|Mode d'emploi du cuisinier|2;FOUR|Appareil de cuisson fermé|2;POÊLE|Casserole plate|2;COUTEAU|Il tranche à table|2;FOURCHETTE|Elle pique les aliments|2;CUILLÈRE|Couvert pour les liquides|2;ASSIETTE|Elle reçoit le plat|2;BOUTEILLE|Récipient à goulot|2;LIT|On s'y couche|1;CANAPÉ|Siège pour plusieurs personnes|2;ARMOIRE|Meuble pour ranger le linge|3;TIROIR|Boîte coulissante d'un meuble|3;ÉTAGÈRE|Planche murale pour ranger|3;LAMPE|Elle éclaire une pièce|1;BOUGIE|Éclairage à la cire|3;MIROIR|Surface réfléchissante|3;TAPIS|Il couvre le sol|3;RIDEAU|Tissu qui masque la vitre|3;CLÉ|Elle ouvre la serrure|1;SERRURE|Mécanisme de verrouillage|3;ESCALIER|Il monte à l'étage|3;COULOIR|Passage étroit entre des pièces|3;GARAGE|Abri pour voiture|2;CAVE|Pièce en sous-sol|2;GRENIER|Pièce sous les combles|3;BALCON|Plateforme sur une façade|3;CLOCHE|Elle sonne ou couvre un plat|3;HORLOGE|Elle sonne les quarts|3;MONTRE|Elle se porte au poignet|2;BALAI|Il chasse la poussière|1;SEAU|Il porte l'eau|2;CORDE|Fil épais tressé|2;CLOU|Il se plante au marteau|2;MARTEAU|Outil du menuisier|3;SCIE|Outil à dents pour couper|3;PINCEAU|Outil du peintre|3;PEINTURE|Art du tableau|2;VALISE|Elle se prépare pour partir|1;SAC|Contenant à anses|1;PARAPLUIE|Il s'ouvre quand il pleut|3;LUNETTES|Elles corrigent la vue|3;CHAPEAU|Il coiffe|1;CHAUSSURE|Basket ou mocassin|2;MANTEAU|Vêtement chaud d'extérieur|2;ROBE|Vêtement féminin d'une pièce|1;PANTALON|Vêtement à deux tuyaux|2;CHEMISE|Elle se boutonne|2;ÉCHARPE|Elle réchauffe le cou|3;BIJOU|Collier ou bague|3;BAGUE|Anneau de fiançailles|3;COLLIER|Parure du cou|3;PARFUM|Fragrance|3;SAVON|Il lave et mousse|3;BROSSE|Elle coiffe ou nettoie|2;PEIGNE|Il démêle|3;TÉLÉPHONE|Appareil pour appeler|2;CLAVIER|Il porte les touches|2;ORDINATEUR|Machine de bureau numérique|2;VOITURE|Automobile|1;CAMION|Poids lourd|1;MOTO|Deux-roues à moteur|1;BUS|Transport en commun urbain|1;MÉTRO|Transport souterrain|2;TAXI|Voiture avec chauffeur à la course|1;FUSÉE|Engin qui décolle vers l'espace|3;VOILIER|Navire à toile|3;PORT|Abri des navires|2;GARE|Lieu d'embarquement ferroviaire|2;AÉROPORT|Lieu d'embarquement aérien|3;TUNNEL|Passage creusé sous un relief|3;PHARE|Tour qui guide les navires|3;CHÂTEAU|Demeure fortifiée d'un seigneur|3;ÉGLISE|Lieu de culte chrétien|1;MUSÉE|Lieu d'expositions|3;CINÉMA|Salle de projection|2;BIBLIOTHÈQUE|Lieu de prêt d'ouvrages|4;MARCHÉ|Étals en plein air|2;MAGASIN|Lieu d'achats|2;BANQUE|Elle garde l'argent|2;ARGENT|Monnaie|2;PRIX|Montant demandé pour un achat|2;CADEAU|Présent offert|2;FÊTE|Jour de réjouissance|2;NOËL|Fête de la crèche|2;AIR|Ce qu'on respire|2;OR|Métal jaune précieux|2;DOS|Arrière du torse|2;ROUE|Elle tourne sur un essieu|2;BOULANGER|Il pétrit la baguette|2;BOUCHER|Il découpe la viande|2;MAÇON|Il bâtit en briques|3;PLOMBIER|Il répare les canalisations|3;PEINTRE|Artiste de la toile|2;POMPIER|Il éteint les feux|3;POLICIER|Agent de l'ordre|2;JUGE|Il rend la sentence|2;AVOCAT|Il plaide|3;MAIRE|Élu de la commune|3;ROI|Souverain|1;REINE|Épouse du souverain|1;PRINCE|Fils de roi|2;CHEVALIER|Noble en armure|2;SOLDAT|Militaire du rang|3;PILOTE|Commandant de bord|3;MARIN|Navigateur sur un navire|2;PAYSAN|Cultivateur de la campagne|2;CUISINIER|Il prépare les plats|2;SERVEUR|Il apporte les plats à table|2;CHANTEUR|Il interprète des chansons|2;ACTEUR|Il joue un rôle|2;POÈTE|Il écrit des vers|2;AUTEUR|Il écrit une oeuvre|2;FACTEUR|Il distribue le courrier|2;CHAUFFEUR|Il conduit les passagers|2;INGÉNIEUR|Concepteur technique|2;ARTISTE|Créateur d'oeuvres|2;SAVANT|Érudit|2;FOOTBALL|Sport du ballon rond|1;TENNIS|Sport de raquette sur court|1;RUGBY|Sport du ballon ovale|2;BASKET|Sport du panier|2;NATATION|Sport pratiqué dans un bassin|2;COURSE|Épreuve de rapidité|2;SAUT|Bond|2;BALLON|Il se lance et se tape|1;FILET|Il sépare les camps au volley|2;STADE|Enceinte sportive|2;ARBITRE|Il siffle les fautes|3;ÉQUIPE|Groupe de sportifs|2;MÉDAILLE|Récompense d'un podium|3;CHAMPION|Vainqueur suprême|2;VICTOIRE|Succès|2;DÉFAITE|Échec dans un match|2;BUT|Il fait marquer au foot|2;RAQUETTE|Elle frappe la balle|2;GOLF|Sport de trous|3;BOXE|Sport de gants|3;JUDO|Art martial japonais|3;SKI|Glisse sur la poudreuse|2;ESCRIME|Sport de l'épée|4;CONSOLE|Machine pour jouer sur téléviseur|1;MANETTE|On la tient pour jouer|2;JOYSTICK|Levier d'arcade|3;ARCADE|Salle de bornes de jeux|3;NIVEAU|Étape d'un jeu|2;BOSS|Ennemi final|3;QUÊTE|Mission d'un personnage|3;AVATAR|Alter ego virtuel|3;PIXEL|Plus petit point affiché|3;CLAN|Communauté soudée du jeu en ligne|3;FORUM|Espace de discussion en ligne|2;TOPIC|Fil de discussion|2;MESSAGE|Texte envoyé à quelqu'un|2;PSEUDO|Nom choisi en ligne|3;MODÉRATEUR|Il fait respecter la charte|4;CODE|Instructions d'un programme|2;BUG|Défaut d'un logiciel|3;LOGICIEL|Programme informatique|3;INTERNET|Réseau mondial|2;SITE|Page web|2;LIEN|Il mène vers une autre page|2;CLIC|Appui sur un bouton du pointeur|2;ROBOT|Machine automatisée|2;DRONE|Petit aéronef sans pilote|2;CAMÉRA|Elle filme|2;MICRO|Objet tenu par les présentateurs|2;CASQUE|Audio ou protection moto|2;LABYRINTHE|Dédale|4;TRÉSOR|Coffre de pirate|2;PIRATE|Écumeur à jambe de bois|2;SORCIER|Magicien maléfique|4;MAGIE|Art des sorts|2;ÉPÉE|Lame de d'Artagnan|2;BOUCLIER|Il protège des coups|2;ARC|Arme à flèches|2;FLÈCHE|Projectile empenné|2;POTION|Breuvage magique|4;DONJON|Tour principale d'une forteresse|4;ORC|Monstre vert de fantasy|2;ELFE|Créature forestière immortelle|2;NAIN|Petit mineur de légende|2;EXPÉRIENCE|Savoir acquis par la pratique|4;VIE|Compteur de chances d'un jeu|2;VIRTUEL|Non réel|4;TABLEAU|Oeuvre de peintre|2;STATUE|Sculpture sur piédestal|2;ROMAN|Récit en prose|2;POÈME|Texte en vers|2;CONTE|Histoire pour enfants|2;FABLE|Récit à morale avec animaux|2;OPÉRA|Spectacle chanté|2;CONCERT|Spectacle musical|2;GUITARE|Instrument à six cordes|2;PIANO|Instrument à queue ou droit|2;VIOLON|Instrument à archet|2;FLÛTE|Instrument à embouchure|2;TAMBOUR|Instrument frappé|2;TROMPETTE|Instrument de cuivre|2;MÉLODIE|Suite de notes|4;RYTHME|Cadence|4;CHORALE|Ensemble vocal|4;ALBUM|Disque de plusieurs titres|2;COMÉDIE|Pièce légère|2;DRAME|Genre sombre|2;HÉROS|Personnage principal|2;BANDIT|Hors-la-loi|2;DÉTECTIVE|Enquêteur privé|4;ENQUÊTE|Recherche de la vérité|4;CRIME|Infraction très grave|2;PRISON|Lieu d'enfermement|2;LOI|Texte voté par les députés|2;ATOME|Plus petite part d'un élément chimique|3;MOLÉCULE|Assemblage d'éléments|4;CELLULE|Brique du vivant|3;GÈNE|Unité d'hérédité|4;VIRUS|Microbe responsable d'épidémies|3;MICROBE|Organisme minuscule|3;CHIMIE|Science des réactions|3;PHYSIQUE|Science de la matière|3;BIOLOGIE|Science du vivant|3;GÉOMÉTRIE|Science des figures|3;ALGÈBRE|Calcul avec des inconnues|4;OXYGÈNE|Gaz respiré|3;HYDROGÈNE|Élément le plus léger|4;CARBONE|Base de la vie|3;GAZ|Fluide sans forme propre|3;LIQUIDE|État fluide de la matière|3;SOLIDE|État rigide|3;GRAVITÉ|Attraction terrestre|4;LUMIÈRE|Elle voyage à 300 000 km/s|3;CHALEUR|Sensation du chaud|3;FROID|Contraire de chaud|2;ÉLECTRICITÉ|Courant qui alimente les prises|4;AIMANT|Il attire certains métaux|4;BATTERIE|Réserve d'électricité|4;MOTEUR|Il fait avancer un véhicule|2;TÉLESCOPE|Il observe les astres|4;MICROSCOPE|Il grossit l'infiniment petit|4;FOSSILE|Reste ancien dans la roche|4;DINOSAURE|Reptile géant disparu|3;SQUELETTE|Charpente osseuse|3;ÉVOLUTION|Théorie de Darwin|4;EMPIRE|Vaste territoire d'un empereur|4;PHARAON|Souverain égyptien|3;PYRAMIDE|Monument triangulaire d'Égypte|3;GUERRE|Conflit armé|2;BATAILLE|Combat entre armées|3;RÉVOLUTION|Bouleversement de 1789|3;NAPOLÉON|Empereur de Waterloo|3;CLÉOPÂTRE|Reine d'Égypte|4;ZEUS|Maître de l'Olympe|3;HERCULE|Héros aux douze travaux|4;ULYSSE|Roi d'Ithaque|4;TITAN|Géant mythologique|3;SPHINX|Gardien du plateau de Gizeh|5;VIKING|Navigateur scandinave|3;CROISADE|Expédition médiévale|4;LÉGENDE|Récit transmis oralement|3;MYTHE|Récit des dieux antiques|3;FANTÔME|Revenant en drap|3;VAMPIRE|Buveur d'hémoglobine|3;FÉE|Marraine au pouvoir magique|3;GÉANT|Être de taille démesurée|3;PARIS|Capitale française|1;LYON|Ville des traboules|3;MARSEILLE|Cité phocéenne|3;NICE|Ville de la Promenade des Anglais|3;LILLE|Capitale des Flandres françaises|3;TOULOUSE|Ville rose|3;BORDEAUX|Port de la Lune|3;NANTES|Ville des ducs de Bretagne|3;STRASBOURG|Siège du Parlement européen|4;RENNES|Capitale bretonne|3;FRANCE|Pays de la Marseillaise|1;ESPAGNE|Pays de Madrid|3;ITALIE|Pays en forme de botte|3;ALLEMAGNE|Pays de Berlin|3;BELGIQUE|Pays de Bruxelles|3;SUISSE|Pays neutre aux Alpes|3;JAPON|Archipel de Tokyo|3;CHINE|Pays de la Grande Muraille|3;INDE|Pays du Taj Mahal|3;BRÉSIL|Pays du carnaval de Rio|3;CANADA|Pays de l'érable et du sirop|3;ÉGYPTE|Pays du Nil|3;AFRIQUE|Continent du Sahara|3;EUROPE|Vieux continent|3;ASIE|Plus vaste continent|3;AMÉRIQUE|Nouveau Monde|3;ALPES|Massif du Mont-Blanc|3;PYRÉNÉES|Chaîne frontalière du sud-ouest|4;SEINE|Fleuve de la capitale|3;LOIRE|Fleuve des châteaux|4;RHÔNE|Fleuve du Valais|4;CORSE|Île de beauté|3;BRETAGNE|Région des menhirs|3;NORMANDIE|Région du débarquement de 1944|4;PROVENCE|Région des cigales|4;ALSACE|Région de la choucroute|4;AMOUR|Sentiment qui lie les amants|1;HAINE|Aversion extrême|2;COLÈRE|Emportement soudain|2;TRISTESSE|Chagrin|2;COURAGE|Vertu du brave|2;SAGESSE|Vertu de la prudence éclairée|4;BONHEUR|État de félicité|2;CHANCE|Veine, bonne fortune|4;DESTIN|Sort écrit d'avance|4;LIBERTÉ|Droit de choisir|2;JUSTICE|Équité rendue par un tribunal|2;VÉRITÉ|Contraire du mensonge|2;MENSONGE|Fausse affirmation|2;HONNEUR|Dignité|4;AVENTURE|Voyage plein d'imprévus|2;VOYAGE|Déplacement lointain|2;VACANCES|Congés|2;REPOS|Pause réparatrice|2;TRAVAIL|Activité professionnelle|2;DÉFI|Épreuve proposée à un concurrent|2;HASARD|Ce qui arrive sans raison|4;RISQUE|Danger possible|2;SURPRISE|Événement inattendu|2;PATIENCE|Vertu de l'attente|2;SILENCE|Quand plus rien ne se dit|2;MYSTÈRE|Chose inexplicable|4;JAUNE|Couleur des tournesols|2;VIOLET|Couleur de l'aubergine|2;MARRON|Couleur de la châtaigne|2;DORÉ|Qui a l'éclat de l'or|2;DELTA|Embouchure en éventail d'un fleuve|4;STEPPE|Vaste plaine herbeuse d'Asie centrale|4;TUNDRA|Plaine glacée des hautes latitudes|4;EVEREST|Plus haut sommet du monde|4;AMAZONE|Fleuve géant d'Amérique du Sud|4;DANUBE|Fleuve de Vienne et de Budapest|4;TAMISE|Fleuve de Londres|4;ANDES|Cordillère d'Amérique du Sud|4;SAHARA|Plus grand désert chaud du monde|4;ISLANDE|Pays de Reykjavik|4;NORVÈGE|Pays d'Oslo|4;SUÈDE|Pays de Stockholm|3;GRÈCE|Pays d'Athènes|3;PORTUGAL|Pays de Lisbonne|3;IRLANDE|Pays de Dublin|3;AUTRICHE|Pays de Vienne et de Mozart|4;HONGRIE|Pays de Budapest|4;POLOGNE|Pays de Varsovie|4;RUSSIE|Plus grand pays du monde|3;TURQUIE|Pays d'Ankara|4;MAROC|Pays de Rabat et de Marrakech|3;ALGÉRIE|Pays de la Casbah|3;TUNISIE|Pays de Carthage et de Hammamet|4;SÉNÉGAL|Pays de Dakar|4;AUSTRALIE|Pays des kangourous|3;MADAGASCAR|Terre des lémuriens|4;MOLIÈRE|Auteur du Misanthrope|4;HUGO|Poète des Misérables|4;BALZAC|Auteur de la Comédie humaine|4;VOLTAIRE|Philosophe de Candide|4;CAMUS|Auteur de L'Étranger|4;FLAUBERT|Père de Madame Bovary|5;PROUST|Auteur d'une célèbre madeleine|5;RIMBAUD|Poète adolescent des Illuminations|5;GOTHIQUE|Style des cathédrales à ogives|4;FRESQUE|Peinture murale sur enduit frais|4;MOSAÏQUE|Assemblage de petits fragments colorés|4;DYNASTIE|Lignée de souverains|4;DÉMOCRATIE|Pouvoir du peuple|3;RÉPUBLIQUE|Régime sans monarque|4;TYRAN|Dirigeant despotique|4;OLYMPE|Mont des dieux grecs|4;ILIADE|Épopée d'Homère sur Troie|4;PHÉNIX|Oiseau qui renaît de ses cendres|4;ZÉNITH|Point du ciel à la verticale|4;GEYSER|Source jaillissante d'Islande|4;ALLIAGE|Mélange de métaux|4;BRONZE|Alliage de cuivre et d'étain|4;CUIVRE|Métal rougeâtre conducteur|4;PLOMB|Métal lourd et mou|4;MERCURE|Métal liquide ou planète proche du Soleil|4;SONNET|Poème de quatorze vers|4;ODE|Poème lyrique à la louange|4;SYNONYME|Mot de sens voisin|4;MONARCHIE|Régime d'un souverain héréditaire|4;ESTUAIRE|Embouchure large d'un fleuve à marée|5;ISTHME|Bande de terre entre deux mers|5;MÉANDRE|Courbe sinueuse d'une rivière|5;ATOLL|Île corallienne en anneau|5;FJORD|Longue baie étroite des côtes norvégiennes|5;MAGMA|Roche en fusion des profondeurs|5;MOUSSON|Régime saisonnier de l'Asie du Sud|5;ALIZÉ|Souffle constant des tropiques|5;ÉQUINOXE|Moment où le Soleil croise l'équateur céleste|5;SOLSTICE|Point extrême de la course annuelle du Soleil|5;NÉBULEUSE|Vaste amas de gaz cosmique|5;ÉLECTRON|Particule négative qui gravite autour du noyau|5;PHOTON|Grain de lumière|5;PROTON|Particule positive du noyau|5;NEUTRON|Particule neutre du noyau|5;ENZYME|Protéine qui accélère une réaction|5;ALCHIMIE|Art ancien de la transmutation|5;ALAMBIC|Appareil de distillation|5;PRISME|Solide transparent qui crée l'arc-en-ciel|5;HOMONYME|Mot qui se prononce comme un autre|5;ANTONYME|Mot de sens contraire|5;MÉTAPHORE|Image sans « comme »|5;HYPERBOLE|Exagération volontaire|5;PALINDROME|Mot qui se lit dans les deux sens|5;ALEXANDRIN|Vers de douze syllabes|5;HAIKU|Poème japonais de dix-sept syllabes|5;ÉLÉGIE|Poème plaintif|5;ÉPOPÉE|Long poème héroïque|5;PARADOXE|Affirmation contraire à l'opinion commune|5;ELLIPSE|Courbe ovale ou omission volontaire|5;ANAGRAMME|Mot formé des mêmes lettres qu'un autre|5;RENAISSANCE|Mouvement artistique européen du XVIe siècle|5;BAROQUE|Style exubérant du XVIIe siècle|5;OGIVE|Voûte à nervures croisées|5;CUBISME|Mouvement de Picasso et Braque|5;AQUEDUC|Canalisation monumentale romaine|5;FÉODALITÉ|Système de fiefs du Moyen Âge|5;SERF|Paysan attaché au domaine seigneurial|5;AGORA|Centre de la vie civique athénienne|5;ODYSSÉE|Épopée d'Homère après la guerre de Troie|5;MINOTAURE|Homme à tête de taureau enfermé en Crète|5;ATLAS|Titan portant le ciel ou recueil de cartes|5;CERBÈRE|Gardien à trois têtes des Enfers|5;KRAKEN|Monstre marin des légendes nordiques|5;VOLGA|Plus long fleuve d'Europe|5;ALGORITHME|Suite d'instructions pour résoudre un problème|5;PROTOCOLE|Ensemble de règles d'échange entre machines|5;BINAIRE|Système de numération en base deux|5;OCTET|Huit bits|5;PROCESSEUR|Cerveau d'un ordinateur|5;THÉORÈME|Proposition démontrée|5;PARALLÈLE|Droite qui ne croise jamais une autre|5;OXYDATION|Réaction avec l'oxygène|5;FUSION|Passage de l'état solide à l'état liquide|5;ABSURDE|Qui défie la raison|5;CHIMÈRE|Monstre mêlant lion, chèvre et serpent|5;CRYPTE|Salle souterraine d'une église|5;NEF|Vaisseau central d'une église|5;CLOÎTRE|Galerie couverte d'un monastère|5;ABBAYE|Monastère dirigé par un abbé|5;ARGOT|Langage familier d'un milieu|5;JARGON|Vocabulaire propre à un métier|5;MAT|Fin de partie aux échecs|5;LOOT|Butin laissé par un ennemi vaincu|4;PATCH|Correctif publié par l'éditeur|4;PING|Temps de latence d'une connexion|4;SKIN|Apparence personnalisée d'un personnage|4;NOOB|Débutant maladroit en ligne|3;LAG|Retard de réponse en ligne|3;RESPAWN|Réapparition après une mort virtuelle|5;NERF|Affaiblissement d'un personnage par un patch|5;BUFF|Amélioration temporaire d'une capacité|5;GRIND|Répétition fastidieuse pour progresser|5;SPEEDRUN|Course pour finir un jeu au plus vite|5;FRAG|Élimination d'un adversaire|5;CAMPER|Rester embusqué sans bouger en ligne|5;SANDBOX|Jeu à monde ouvert sans objectif imposé|5;TEXTURE|Revêtement d'un modèle en 3D|5;ÉMULATEUR|Logiciel imitant une ancienne console|5;LOBBY|Salle d'attente avant une partie|5;RAID|Expédition de groupe contre le méchant final|5;TANK|Rôle qui encaisse les coups d'un groupe|5;LATENCE|Délai entre une action et sa réponse|5;HITBOX|Zone de collision d'un personnage|6;ROGUELIKE|Jeu à donjons générés aléatoirement|6;SHADER|Programme de rendu d'un effet visuel|6;POLYGONE|Facette d'un modèle en trois dimensions|6;FRAMERATE|Nombre d'images par seconde|6;PHISHING|Hameçonnage par faux courriel|6;COMPILATEUR|Traducteur du code source en langage machine|6;PÉRIHÉLIE|Point de l'orbite le plus proche du Soleil|6;QUASAR|Noyau galactique extrêmement lumineux|6;PULSAR|Astre compact émettant des impulsions radio|6;ENTROPIE|Mesure du désordre en thermodynamique|6;ISOTOPE|Variante d'un élément selon sa masse|6;MITOSE|Division qui produit deux noyaux identiques|6;CHROMOSOME|Filament porteur de l'hérédité|6;EUPHÉMISME|Atténuation d'une réalité pénible|6;ALLITÉRATION|Répétition d'un même son consonantique|6;PÉGASE|Monture ailée de Bellérophon|6;STALACTITE|Concrétion qui pend au plafond d'une grotte|6;STALAGMITE|Concrétion qui monte du sol d'une grotte|6;BEFFROI|Tour de guet d'une ville du Nord|6;GAMBIT|Sacrifice d'ouverture aux échecs|6;ANACOLUTHE|Rupture dans la construction d'une phrase|6;SYNECDOQUE|Figure qui désigne le tout par la partie|6;OXYMORE|Alliance de deux mots contradictoires|6;PLÉONASME|Redondance comme « monter en haut »|6;APHORISME|Maxime brève|6;ÉPITAPHE|Inscription funéraire|6;PALIMPSESTE|Parchemin gratté puis réécrit|6;ASTROLABE|Instrument de navigation antique|6;SEXTANT|Instrument de mesure de la hauteur des astres|6;CHRONOMÈTRE|Montre de haute précision|6;HOMÈRE|Aède de l'Iliade et de l'Odyssée|6;SOCRATE|Philosophe qui but la ciguë|6;PLATON|Disciple de Socrate, auteur de la République|6;ARISTOTE|Précepteur d'Alexandre le Grand|6;NIETZSCHE|Philosophe du surhomme|6;DESCARTES|Auteur du « je pense, donc je suis »|6;PASCAL|Savant au triangle arithmétique|6;LOGARITHME|Fonction réciproque de l'exponentielle|6;HYPOTHÉNUSE|Plus grand côté du triangle rectangle|6;ASYMPTOTE|Droite dont une courbe s'approche à l'infini|6;ISOCÈLE|Se dit d'un triangle à deux côtés égaux|6;PÉRIPLE|Long voyage maritime autour d'un territoire|6;SYMBIOSE|Association durable à bénéfice mutuel|6;OSMOSE|Passage d'un solvant à travers une membrane|6;MÉTABOLISME|Ensemble des réactions chimiques du vivant|6;CATALYSEUR|Substance qui accélère une réaction sans être consommée|6;PLASMA|Quatrième état de la matière|6;PARADIGME|Modèle de pensée dominant|6;SYLLOGISME|Raisonnement à trois propositions|6;DIALECTIQUE|Art de discuter par thèse et antithèse|6`;

  // Mots (≥ 3 lettres, avec et sans pluriel) contenus dans un indice, pour éviter qu'une grille
  // contienne deux mots dont l'un figure dans l'indice de l'autre.
  const clueTokens = (clue) => new Set(clue.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
    .split(/[^A-Z]+/).filter((t) => t.length >= 3).flatMap((t) => [t, t.replace(/[SX]$/, '')]));
  const clash = (a, b) => a.tokens.has(b.key) || b.tokens.has(a.key);
  // Chaque entrée : w = solution avec ses accents d'origine (NFC, majuscules) ; key = même mot sans accents
  // (utilisé pour les anciennes grilles, le tri, les familles et la détection d'indices qui se dévoilent).
  const parseDict = (raw) => raw.split(';')
    .map((x) => {
      const [w0, clue, f] = x.split('|');
      const w = (w0 || '').normalize('NFC');
      return { w, key: fold(w), clue, tokens: clueTokens(clue || ''), force: Number(f) || 0 };
    })
    .filter((e) => /^[A-Z]{2,}$/.test(e.key) && [...e.w].every((c) => STRICT_RE.test(c)) && e.clue);
  // Force de chaque mot de l'ancien dictionnaire (les nouveaux mots portent leur force : MOT|indice|force).
  const FORCE_LEGACY_RAW = '1=CHAT CHIEN LUNE SOLEIL MER LAC PLAGE PLUIE NEIGE VENT ARBRE FLEUR ROSE POMME POIRE CITRON ORANGE TABLE CHAISE PORTE MAISON TOIT MUR LIVRE STYLO ECOLE JOUR NUIT MATIN SOIR HIVER ETE ROUTE TRAIN AVION VELO BATEAU VILLE RUE AMI FAMILLE ENFANT FRERE SOEUR JEU RIRE JOIE PEUR MAIN PIED TETE OEIL NEZ BOUCHE COEUR BLEU ROUGE VERT BLANC NOIR GRIS;2=RIVE VAGUE ORAGE NUAGE FORET TIGE RACINE FEUILLE FRUIT PECHE PRUNE RAISIN CERISE MELON FENETRE SALON CUISINE PAGE CRAYON PAPIER LETTRE MOT PHRASE TEXTE CLASSE ELEVE PROF COURS EXAMEN NOTE MATHS NOMBRE CHIFFRE CARRE CERCLE ANGLE LIGNE POINT FORME TEMPS HEURE MINUTE SEMAINE MOIS ANNEE PRINTEMPS AUTOMNE VILLAGE PLACE PONT AMIE PARENT JOUEUR SCORE REGLE ENIGME INDICE REPONSE SECRET IDEE SAVOIR CALME PAIX FORCE VITESSE ENERGIE MUSIQUE CHANT DANSE IMAGE PHOTO FILM SCENE ECRAN RADIO VOIX SON BRUIT SANG FER BOIS PIERRE VERRE;4=LOGIQUE MEMOIRE ESPRIT RAISON';
  const forceLegacy = new Map();
  FORCE_LEGACY_RAW.split(';').forEach((g) => { const [f, ws] = g.split('='); ws.split(' ').forEach((w) => forceLegacy.set(w, Number(f))); });
  const dictionaryLegacy = parseDict(LEGACY_RAW).filter((e) => e.w.length >= 3);
  dictionaryLegacy.forEach((e) => { e.force = forceLegacy.get(e.key) || 2; });
  const dictionaryNew = (() => {
    const seen = new Set();
    return [...dictionaryLegacy, ...parseDict(EXTRA_RAW)].filter((e) => !seen.has(e.key) && seen.add(e.key));
  })();
  const dictionary = dictionaryNew; // alias historique
  // Dès cette date, grilles du dictionnaire étendu. Avant : ancien dictionnaire, grilles inchangées.
  const NEW_FROM = '2026-10-26';
  // Dès cette date : accents significatifs (grille, saisie et validation). Avant : ancien comportement, grilles inchangées.
  // (NEW_FROM = ACCENT_FROM : le mode intermédiaire « sans accents » n'est plus utilisé, il reste disponible si les dates diffèrent.)
  const ACCENT_FROM = '2026-10-26';
  const KEY_PREFIX = { legacy: 'v03', ascii: 'v04', accent: 'v05' }; // clé de stockage de la progression, par mode de grille
  const modeOf = (d) => (d < NEW_FROM ? 'legacy' : d < ACCENT_FROM ? 'ascii' : 'accent');
  // Chaque mot appartient à 1 « famille » ; une seule famille sert chaque jour (rotation) :
  // un mot ne peut donc jamais revenir avant BUCKETS jours.
  const BUCKETS = 4;
  const bucketOf = (key) => hash('b:' + key) % BUCKETS;

  function hash(s) {
    let h = 2166136261;
    for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return h >>> 0;
  }

  function random(seed) { // mulberry32
    return () => {
      seed += 0x6D2B79F5;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Date du jour à Paris, "AAAA-MM-JJ". formatToParts évite de dépendre du format d'une locale.
  function parisDate(now = new Date()) {
    try {
      const parts = new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
      }).formatToParts(now);
      const get = (t) => parts.find((p) => p.type === t).value;
      return `${get('year')}-${get('month')}-${get('day')}`;
    } catch {
      return now.toISOString().slice(0, 10);
    }
  }

  const utcDay = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  const prevDay = (d) => new Date(utcDay(d) - 864e5).toISOString().slice(0, 10);
  const nextDay = (d) => new Date(utcDay(d) + 864e5).toISOString().slice(0, 10);
  const weekday = (d) => new Date(utcDay(d)).getUTCDay();
  const dayNumber = (d) => Math.round((utcDay(d) - utcDay(EPOCH)) / 864e5) + 1;

  function formatTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0');
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  function generate(s, n, dict, mix, strict) {
    const rnd = random(s);
    const b = Array.from({ length: n }, () => Array(n).fill(''));
    const entries = [];
    let pool = dict
      .filter((e) => e.w.length <= n)
      .sort((a, c) => hash(a.key + s) - hash(c.key + s));
    if (mix) { // alternance des trois paliers pour que chacun ait sa chance d'être placé
      const tiers = [[], [], []];
      pool.forEach((e) => tiers[tierOf(e)].push(e));
      pool = [];
      for (let i = 0; tiers.some((t) => i < t.length); i++) for (const k of [1, 0, 2]) if (i < tiers[k].length) pool.push(tiers[k][i]);
    }

    function fit(w, y, x, d) {
      const dy = d === 'V' ? 1 : 0, dx = 1 - dy;
      if (y < 0 || x < 0 || y + dy * (w.length - 1) >= n || x + dx * (w.length - 1) >= n) return -1;
      if (y - dy >= 0 && x - dx >= 0 && b[y - dy][x - dx]) return -1;
      if (y + dy * w.length < n && x + dx * w.length < n && b[y + dy * w.length][x + dx * w.length]) return -1;
      let cross = 0;
      for (let i = 0; i < w.length; i++) {
        const Y = y + dy * i, X = x + dx * i;
        if (b[Y][X]) {
          if (b[Y][X] !== w[i]) return -1;
          cross++;
        } else if (d === 'H'
          ? ((Y > 0 && b[Y - 1][X]) || (Y < n - 1 && b[Y + 1][X]))
          : ((X > 0 && b[Y][X - 1]) || (X < n - 1 && b[Y][X + 1]))) {
          return -1;
        }
      }
      return cross;
    }

    // Lettres posées dans la grille : avec accents (mode strict) ou sans (anciennes grilles).
    const letters = (e) => (strict ? e.w : e.key);
    function put(e, y, x, d) {
      const w = letters(e);
      for (let i = 0; i < w.length; i++) b[y + (d === 'V' ? i : 0)][x + (d === 'H' ? i : 0)] = w[i];
      entries.push({ ...e, w, y, x, d });
    }

    const first = pool.find((e) => e.key.length >= 4);
    if (!first) return null;
    put(first, Math.floor(n / 2), Math.floor((n - first.key.length) / 2), 'H');

    for (let pass = 0; pass < 3; pass++) {
      for (const e of pool) {
        if (entries.some((p) => p.key === e.key || clash(p, e))) continue;
        let best = null;
        for (const d of ['H', 'V']) {
          for (let y = 0; y < n; y++) {
            for (let x = 0; x < n; x++) {
              const cross = fit(letters(e), y, x, d);
              if (cross < 1) continue;
              const score = cross * 100 - Math.abs(y - n / 2) - Math.abs(x - n / 2) + rnd() * 4;
              if (!best || score > best.score) best = { y, x, d, score };
            }
          }
        }
        if (best) put(e, best.y, best.x, best.d);
      }
    }

    // Contrôle d'intégrité : toute suite de 2+ lettres doit être un mot voulu (pas de mot accidentel).
    const runs = [];
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (!b[y][x]) continue;
        if (x === 0 || !b[y][x - 1]) {
          let w = '';
          for (let X = x; X < n && b[y][X]; X++) w += b[y][X];
          if (w.length > 1) runs.push(`H:${y}:${x}:${w}`);
        }
        if (y === 0 || !b[y - 1][x]) {
          let w = '';
          for (let Y = y; Y < n && b[Y][x]; Y++) w += b[Y][x];
          if (w.length > 1) runs.push(`V:${y}:${x}:${w}`);
        }
      }
    }
    const expected = entries.map((e) => `${e.d}:${e.y}:${e.x}:${e.w}`);
    if (runs.length !== expected.length || runs.some((k) => !expected.includes(k))
      || !entries.some((e) => e.d === 'V')) return null;

    let num = 0;
    const numbers = Array.from({ length: n }, () => Array(n).fill(0));
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (entries.some((e) => e.y === y && e.x === x)) numbers[y][x] = ++num;
      }
    }
    return {
      b,
      numbers,
      entries: entries.map((e) => {
        const cells = [...e.w].map((_, i) => (e.y + (e.d === 'V' ? i : 0)) * n + e.x + (e.d === 'H' ? i : 0));
        return { ...e, num: numbers[e.y][e.x], cells };
      }),
    };
  }

  // Grille du jour : déterministe (même date => même grille pour tout le monde).
  function buildPuzzle(date, forceMode) {
    const mode = forceMode || modeOf(date);
    const legacy = mode === 'legacy', strict = mode === 'accent';
    const seed = hash((legacy ? 'cdj03:' : strict ? 'cdj05:' : 'cdj04:') + date);
    const n = legacy ? SIZE_BY_WEEKDAY[weekday(date)] : SIZE_NEW;
    const target = MIN_WORDS[n];
    const bucket = ((dayNumber(date) % BUCKETS) + BUCKETS) % BUCKETS;
    const dict = legacy ? dictionaryLegacy : dictionaryNew.filter((e) => bucketOf(e.key) === bucket);
    let puzzle = null, fallback = null;
    for (let i = 0; i < 150; i++) {
      const p = generate((seed + Math.imul(i + 1, 2654435761)) >>> 0, n, dict, !legacy, strict);
      if (!p) continue;
      if (legacy) { if (!puzzle || p.entries.length > puzzle.entries.length) puzzle = p; if (puzzle.entries.length >= target) break; continue; }
      if (mixOk(p.entries) && p.entries.length >= target) { puzzle = p; break; }
      if (mixOk(p.entries) && (!puzzle || p.entries.length > puzzle.entries.length)) puzzle = p;
      if (!fallback || p.entries.length > fallback.entries.length) fallback = p;
    }
    puzzle = puzzle || fallback;
    return puzzle && { ...puzzle, n, seed, date, legacy, strict, mode };
  }

  // Série en cours (jours consécutifs terminés, tolérante si aujourd'hui n'est pas encore joué) et meilleure série.
  function computeStreaks(history, today) {
    const days = Object.keys(history).sort();
    let best = 0, run = 0, prev = null;
    for (const d of days) {
      run = prev && prevDay(d) === prev ? run + 1 : 1;
      best = Math.max(best, run);
      prev = d;
    }
    let current = 0;
    let d = history[today] ? today : prevDay(today);
    while (history[d]) { current++; d = prevDay(d); }
    return { current, best };
  }
  /* </pure> */

  // ───────────────────────────── Initialisation ─────────────────────────────
  // Accès administrateur (mode testeur), protégé par mot de passe. Le script ne contient PAS le mot de passe :
  // seulement son empreinte PBKDF2-SHA256 salée. Limite à connaître : un userscript est public, cette protection
  // masque les outils aux joueurs ordinaires mais n'est pas une sécurité forte. Les outils n'agissent de toute
  // façon que sur le navigateur où ils sont utilisés : aucun autre joueur ne peut être affecté.
  const ADMIN_SALT = 'cdj-admin-v1-38373092b58157f8a20b576a';
  const ADMIN_HASH = '9890014bd5f0f941b18b0bc76633ad26ea8848cd9b9a06d646edb27a6ebe6bb0';
  const ADMIN_ITER = 150000;
  const adminStored = () => {
    try { return sessionStorage.getItem('cdj:admin-ok') === ADMIN_HASH || localStorage.getItem('cdj:admin-ok') === ADMIN_HASH; } catch { return false; }
  };
  try { localStorage.removeItem('cdj:admin'); } catch { /* ancien drapeau (0.7.x) : n'ouvre plus rien */ }
  let ADMIN = adminStored();
  try { // un jeton invalide (modifié à la main, ancienne empreinte…) est supprimé au lieu de rester dans le stockage
    for (const st of [sessionStorage, localStorage]) { const v = st.getItem('cdj:admin-ok'); if (v !== null && v !== ADMIN_HASH) st.removeItem('cdj:admin-ok'); }
  } catch { /* ignoré */ }
  const DEBUG = (() => { try { return localStorage.getItem('cdj:debug') === '1'; } catch { return false; } })();
  const log = (...a) => { if (DEBUG) console.log('[CDJ]', ...a); };

  // Date de test (mode testeur uniquement) : joue la grille d'un autre jour, sans rien enregistrer dans les stats.
  const realDate = parisDate();
  let date = realDate;
  let testMode = false;
  if (ADMIN) {
    try {
      const td = localStorage.getItem('cdj:testdate');
      if (/^\d{4}-\d{2}-\d{2}$/.test(td || '') && !Number.isNaN(Date.parse(td))) { date = td; testMode = true; }
    } catch { /* ignoré */ }
  }
  // Tout ce qui dépend du jour affiché (grille, clé de stockage, index des mots) est reconfigurable :
  // c'est ce qui permet de rejouer les grilles passées sans recharger la page.
  let b, entries, numbers, n, legacy, strict, mode, dayNum, KEY_DAY, entriesAt, order;
  const KEY_STATS = 'cdj:v03:stats'; // clé conservée : les séries existantes continuent
  const entryId = (e) => `${e.d}-${e.num}`;
  function configureDay(d) {
    const pz = buildPuzzle(d);
    if (!pz) return false;
    ({ b, entries, numbers, n, legacy, strict, mode } = pz);
    date = d;
    dayNum = dayNumber(d);
    KEY_DAY = testMode ? `cdj:test:${d}` : `cdj:${KEY_PREFIX[mode]}:${d}`;
    entriesAt = Array.from({ length: n * n }, () => []);
    for (const e of entries) for (const i of e.cells) entriesAt[i].push(e);
    order = [...entries].sort((x, y) => (x.d === y.d ? x.num - y.num : x.d === 'H' ? -1 : 1));
    return true;
  }
  try {
    if (!configureDay(date)) { console.warn('[CDJ] Génération impossible'); return; }
  } catch (err) {
    console.error('[CDJ] Erreur de génération', err);
    return;
  }

  const isLetter = (i) => !!b[Math.floor(i / n)][i % n];
  const solutionAt = (i) => b[Math.floor(i / n)][i % n];

  // ───────────────────────────── Stockage ─────────────────────────────
  let storageOk = true;
  const readJSON = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const writeJSON = (k, v) => {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { storageOk = false; return false; }
  };
  const clampInt = (v, max) => (Number.isFinite(v) && v >= 0 ? Math.min(Math.floor(v), max) : 0);

  function sanitize(raw) {
    const s = { rev: 0, cells: Array(n * n).fill(''), activeMs: 0, hints: 0, checks: 0, finalSeconds: null };
    if (!raw || typeof raw !== 'object') return s;
    if (Array.isArray(raw.cells) && raw.cells.length === n * n) {
      s.cells = raw.cells.map((c, i) => (isLetter(i) && typeof c === 'string' && (strict ? STRICT_RE : BASE_RE).test(c.normalize('NFC')) ? c.normalize('NFC') : ''));
    }
    s.rev = clampInt(raw.rev, 1e9);
    s.activeMs = clampInt(raw.activeMs, 864e5);
    s.hints = clampInt(raw.hints, 999);
    s.checks = clampInt(raw.checks, 9999);
    s.finalSeconds = Number.isFinite(raw.finalSeconds) && raw.finalSeconds >= 0 ? Math.floor(raw.finalSeconds) : null;
    return s;
  }

  function loadStats() {
    const raw = readJSON(KEY_STATS);
    const history = {};
    if (raw && raw.history && typeof raw.history === 'object') {
      for (const [d, r] of Object.entries(raw.history)) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(d) && r && Number.isFinite(r.sec) && r.sec >= 0) {
          history[d] = { sec: Math.floor(r.sec), hints: clampInt(r.hints, 999), checks: clampInt(r.checks, 9999), n: clampInt(r.n, 99) };
        }
      }
    }
    return { history };
  }

  let state = sanitize(readJSON(KEY_DAY));
  let stats = loadStats();
  const save = () => writeJSON(KEY_DAY, state);
  const touch = () => { state.rev++; save(); };

  const scoreSeconds = () => Math.floor(state.activeMs / 1000) + state.hints * HINT_PENALTY + state.checks * CHECK_PENALTY;
  const finished = () => state.finalSeconds !== null;

  // ───────────────────────────── Styles ─────────────────────────────
  const css = `
#cdj-launch,#cdj-fab{--cdj-accent:#6559d8;display:inline-flex;align-items:center;gap:6px;box-sizing:border-box;min-height:34px;margin:0 0 0 12px;padding:6px 12px;border:0;border-radius:8px;background:var(--cdj-accent);color:#fff;font:600 13px/1.2 Arial,sans-serif;letter-spacing:0;text-transform:none;text-shadow:none;white-space:nowrap;vertical-align:middle;cursor:pointer;float:none;position:static}
#cdj-launch:hover,#cdj-fab:hover{filter:brightness(1.12)}
#cdj-launch:focus-visible,#cdj-fab:focus-visible{outline:2px solid #fff;outline-offset:2px;box-shadow:0 0 0 4px var(--cdj-accent)}
#cdj-launch.after{display:flex;width:fit-content;margin:6px 0 0}
#cdj-fab{position:fixed;left:12px;bottom:12px;z-index:2147483645;margin:0;box-shadow:0 4px 14px #0006}
#cdj-panel{--cdj-accent:#6559d8;--cdj-bg:#202127;--cdj-fg:#f5f5f5;--cdj-muted:#c3c3cc;position:fixed;right:16px;top:70px;z-index:2147483646;width:min(570px,calc(100vw - 32px));max-height:calc(100vh - 85px);overflow:auto;padding:16px;background:var(--cdj-bg);color:var(--cdj-fg);border:1px solid #555;border-radius:12px;box-shadow:0 12px 36px #0008;font:14px/1.4 Arial,sans-serif;text-align:left}
#cdj-panel[hidden],#cdj-panel [hidden]{display:none!important}
#cdj-panel *{box-sizing:border-box}
#cdj-panel .hd{position:sticky;top:-16px;z-index:5;display:flex;justify-content:space-between;align-items:center;margin:-16px -16px 4px;padding:12px 16px 6px;background:var(--cdj-bg)}
#cdj-panel h2{margin:0;color:#fff;font-size:18px}
#cdj-panel h3{margin:8px 0 2px;font-size:14px;color:#fff}
#cdj-panel .close{background:none;border:0;color:#fff;font-size:28px;line-height:1;cursor:pointer;padding:0 6px}
#cdj-panel .meta{margin:4px 0;font-size:12px;color:var(--cdj-muted)}
#cdj-panel .bar{display:flex;flex-wrap:wrap;gap:4px 14px;align-items:baseline;margin:6px 0}
#cdj-panel .timer{font:700 18px/1 monospace;color:#fff}
#cdj-panel .pen{font-size:12px;color:var(--cdj-muted)}
#cdj-panel .banner{margin:6px 0;padding:8px;border-radius:6px;background:#5b4a14;color:#ffe9a8}
#cdj-panel .cluebar{display:flex;align-items:stretch;gap:6px;margin:8px 0}
#cdj-panel .cluebar button{flex:0 0 40px;min-height:40px;background:#33353f;color:#fff;border:0;border-radius:6px;font-size:20px;cursor:pointer}
#cdj-panel .cluebar .cur{min-width:0;overflow-wrap:anywhere;flex:1;margin:0;padding:6px 8px;background:#2b2d36;border-radius:6px;min-height:40px;display:flex;align-items:center}
#cdj-panel .gridwrap{overflow-x:auto;margin:8px auto;max-width:430px}
#cdj-panel .grid{display:grid;gap:2px;margin:0 auto}
#cdj-panel .cell{position:relative;aspect-ratio:1;min-width:0;background:#fff}
#cdj-panel .cell.block{background:#444650}
#cdj-panel .cell.active{background:#ddd9ff}
#cdj-panel .cell.locked{background:#b8e8c4}
#cdj-panel .cell.current{outline:3px solid #7464ec;outline-offset:-3px;z-index:1}
#cdj-panel .cell small{position:absolute;top:1px;left:2px;color:#333;font-size:10px;line-height:1;pointer-events:none}
#cdj-panel .cell input{width:100%;height:100%;min-width:0;border:0;outline:0;background:transparent;color:#171717;text-align:center;padding:8px 0 0;font:700 16px Arial,sans-serif;text-transform:uppercase;caret-color:transparent;border-radius:0}
#cdj-panel .cell.locked input{color:#12532b}
#cdj-panel .daynav{display:flex;align-items:center;gap:6px;margin:6px 0}
#cdj-panel .daynav button{flex:0 0 auto;min-height:36px;padding:0 10px;background:#33353f;color:#fff;border:0;border-radius:6px;font:600 12px Arial,sans-serif;cursor:pointer}
#cdj-panel .daynav button:disabled{opacity:.4;cursor:default}
#cdj-panel .daynav select{flex:1;min-width:0;min-height:36px;padding:0 6px;background:#33353f;color:#fff;border:1px solid #555;border-radius:6px;font:13px Arial,sans-serif}
#cdj-panel .archnote{margin:4px 0;padding:6px 8px;border-radius:6px;background:#2b3a55;color:#cfe1ff;font-size:12px}
#cdj-panel .archnote button{margin-left:6px;padding:3px 8px;background:#6559d8;color:#fff;border:0;border-radius:5px;cursor:pointer;font:600 12px Arial,sans-serif}
#cdj-panel .accents{display:flex;flex-wrap:wrap;justify-content:center;gap:5px;margin:2px 0 8px}
#cdj-panel .accents button{min-width:38px;min-height:38px;padding:0;background:#33353f;color:#fff;border:0;border-radius:6px;font:700 16px Arial,sans-serif;cursor:pointer}
#cdj-panel .accents button:hover{background:#45406b}
#cdj-panel .hint{margin:0 0 6px;text-align:center;font-size:12px;color:var(--cdj-muted)}
#cdj-panel .clues{display:grid;grid-template-columns:1fr 1fr;gap:12px}
#cdj-panel ol{margin:0;padding-left:27px;line-height:1.45}
#cdj-panel li{padding:4px 3px;cursor:pointer;border-radius:4px}
#cdj-panel li.chosen{background:#45406b}
#cdj-panel li.solved{color:#86e5a5;text-decoration:line-through;text-decoration-thickness:2px}
#cdj-panel li.solved::after{content:' ✓';text-decoration:none;display:inline-block}
#cdj-panel li .f{display:inline-block;margin-left:6px;padding:0 6px;border-radius:9px;font:700 10px/16px Arial,sans-serif;vertical-align:middle;text-decoration:none;background:#2f5d3f;color:#d6f5de}
#cdj-panel li .f.mid{background:#6a5a1c;color:#ffe9a8}
#cdj-panel li .f.hard{background:#7a2f43;color:#ffd6de}
#cdj-panel .actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}
#cdj-panel .actions button{min-height:40px;background:var(--cdj-accent);color:#fff;border:0;border-radius:6px;padding:9px 12px;cursor:pointer;font:600 13px Arial,sans-serif}
#cdj-panel .actions button:disabled{opacity:.45;cursor:default}
#cdj-panel .status{min-height:22px;margin-top:8px;color:#b8efc5}
#cdj-panel .result{margin-top:8px;padding:10px;border-radius:8px;background:#1f3b2a;color:#d6f5de}
#cdj-panel .fallback{width:100%;min-height:80px;margin-top:6px;background:#111;color:#fff;border:1px solid #666;border-radius:6px;padding:6px;font:13px monospace}
#cdj-panel details{margin-top:8px;color:var(--cdj-muted);font-size:13px}
#cdj-panel summary{cursor:pointer;color:#fff}
#cdj-panel .lockrow{margin-top:6px;text-align:right}
#cdj-panel .lockbtn{background:none;border:0;opacity:.35;cursor:pointer;font-size:14px;padding:4px 8px;color:#fff}
#cdj-panel .lockbtn:hover,#cdj-panel .lockbtn:focus-visible{opacity:.9}
#cdj-panel .adminlogin{margin-top:6px;padding:8px 10px;border:1px dashed #8a7fe0;border-radius:8px;font-size:13px;color:var(--cdj-muted)}
#cdj-panel .adminlogin input[type=password]{display:block;width:100%;margin:4px 0 6px;padding:7px;border-radius:4px;border:1px solid #666;background:#111;color:#fff;font-size:16px}
#cdj-panel .adminlogin .rem{display:block;margin-bottom:6px}
#cdj-panel .adminlogin button{min-height:38px;background:var(--cdj-accent);color:#fff;border:0;border-radius:6px;padding:8px 12px;cursor:pointer;font:600 13px Arial,sans-serif}
#cdj-panel details.admin{margin-top:10px;padding:6px 10px;border:1px dashed #8a7fe0;border-radius:8px;color:var(--cdj-muted);font-size:13px}
#cdj-panel details.admin .actions button{background:#7a2f43}
#cdj-panel details.admin button{cursor:pointer}
#cdj-panel details.admin input[type=date]{padding:4px;border-radius:4px;border:1px solid #666;background:#111;color:#fff}
#cdj-panel .stats{margin:8px 0 0;font-size:12px;color:var(--cdj-muted)}
#cdj-panel :focus-visible{outline:2px solid #aaa3ff;outline-offset:1px}
#cdj-panel .cell input:focus-visible{outline:0}
@media(max-width:500px){#cdj-panel{left:8px;right:8px;top:8px;width:auto;max-height:calc(100vh - 16px);padding:12px}#cdj-panel .hd{top:-12px;margin:-12px -12px 4px;padding:10px 12px 6px}#cdj-panel .clues{grid-template-columns:1fr}}`;
  if (typeof GM_addStyle === 'function') GM_addStyle(css);
  else { const st = document.createElement('style'); st.textContent = css; document.head.append(st); }

  // ───────────────────────────── DOM ─────────────────────────────
  const launch = document.createElement('button');
  launch.id = 'cdj-launch';
  // Second bouton, flottant en bas à gauche : toujours accessible, même sur un long topic.
  // Désactivable : localStorage.setItem('cdj:floating', '0') (il réapparaît seulement si l'autre bouton est introuvable).
  const fab = document.createElement('button');
  fab.id = 'cdj-fab';
  const FAB_PREF = (() => { try { return localStorage.getItem('cdj:floating') !== '0'; } catch { return true; } })();
  for (const btn of [launch, fab]) {
    btn.type = 'button';
    btn.textContent = '🧩 Mots du jour';
    btn.title = 'Ouvrir le défi de mots croisés du jour';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'cdj-panel');
  }

  const panel = document.createElement('section');
  panel.id = 'cdj-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Mots croisés du jour');
  panel.innerHTML = `
<header class="hd"><h2>🧩 Défi du jour</h2><button type="button" class="close" aria-label="Fermer">×</button></header>
<p class="meta"></p>
<div class="daynav" role="group" aria-label="Choisir la grille d’un jour"><button type="button" data-a="day-prev" aria-label="Jour précédent">‹ Jour précédent</button><select class="daysel" aria-label="Toutes les grilles"></select><button type="button" data-a="day-next" aria-label="Jour suivant">Jour suivant ›</button></div>
<p class="archnote" hidden>Grille d’archive : elle ne compte pas dans votre série ni vos records. <button type="button" data-a="day-today">Revenir à aujourd’hui</button></p>
<div class="bar"><span class="timer" title="Temps actif (panneau ouvert et onglet visible)">⏱ 00:00</span><span class="pen"></span></div>
<div class="banner" role="alert" hidden>Un nouveau défi est disponible. <button type="button" data-a="reload">Recharger la page</button></div>
<div class="cluebar"><button type="button" data-a="prev" aria-label="Définition précédente">‹</button><p class="cur" aria-live="polite"></p><button type="button" data-a="next" aria-label="Définition suivante">›</button></div>
<div class="gridwrap"><div class="grid" role="group" aria-label="Grille de mots croisés"></div></div>
<p class="hint" hidden>Les accents comptent : ÉTÉ n’est pas ETE. Tapez-les au clavier ou touchez une lettre ci-dessous.</p>
<div class="accents" role="group" aria-label="Lettres accentuées" hidden>${['É', 'È', 'Ê', 'À', 'Â', 'Ç', 'Ù', 'Û', 'Î', 'Ï', 'Ô', 'Ë', 'Ü', 'Œ'].map((c) => `<button type="button" data-ch="${c}" aria-label="Lettre ${c}">${c}</button>`).join('')}</div>
<div class="clues"><section><h3>Horizontalement</h3><ol class="h"></ol></section><section><h3>Verticalement</h3><ol class="v"></ol></section></div>
<div class="actions"><button type="button" data-a="check">Vérifier (+${CHECK_PENALTY} s)</button><button type="button" data-a="hint">Indice (+${HINT_PENALTY} s)</button><button type="button" data-a="share">Partager</button><button type="button" data-a="reset">Effacer mes erreurs</button></div>
<div class="status" role="status" aria-live="polite"></div>
<div class="result" hidden></div>
<details><summary>Règles et calcul du score</summary>
<p>Une seule grille par jour, identique pour tous les joueurs (calculée d'après la date à Paris). Saisissez les lettres au clavier. Un mot juste se verrouille. Touches : flèches pour se déplacer, Espace ou Entrée pour changer de sens, Échap pour fermer.</p>
<p class="rule-accents" hidden><strong>Accents obligatoires</strong> : é, è, ê, à, ç… font partie de la réponse (ÉTÉ ≠ ETE). Majuscules accentuées automatiques. La ligature « œ » occupe deux cases (O et E) : taper œ remplit les deux.</p>
<p class="rule-ascii" hidden>Cette ancienne grille (avant le 26/10/2026) ignore les accents : é, è, ê… sont saisis comme E.</p>
<p><strong>Forces des mots</strong> : chaque mot a une force de 1 à 6 (1-2 facile, 3-4 intermédiaire, 5-6 difficile à très difficile). Chaque grille mélange les trois paliers, dans les mêmes proportions tous les jours : la difficulté ne dépend ni du jour ni de la date.</p>
<p><strong>Temps final</strong> = temps actif + ${HINT_PENALTY} s par indice + ${CHECK_PENALTY} s par vérification. Plus bas = meilleur. Le chrono ne tourne que si le panneau est ouvert et l'onglet visible.</p>
<p><strong>Grilles passées</strong> : la barre « Jour précédent » permet de rejouer toutes les grilles depuis le premier défi. Elles se jouent avec les mêmes règles et le même score, mais <strong>ne comptent pas dans votre série ni vos records</strong> (seule la grille du jour compte).</p>
<p>Votre progression et vos stats sont stockées uniquement dans ce navigateur. Les scores partagés sont déclaratifs : rien ne peut les vérifier sans serveur.</p>
</details>
<p class="stats"></p>
<div class="lockrow"><button type="button" class="lockbtn" data-a="admin-open" aria-label="Accès administrateur" title="Accès administrateur">🔒</button></div>
<div class="adminlogin" hidden><label>Mot de passe administrateur <input type="password" class="apw" autocomplete="off" spellcheck="false"></label>
<label class="rem"><input type="checkbox" class="aremember"> Rester connecté sur cet appareil</label>
<button type="button" data-a="admin-unlock">Déverrouiller</button></div>`;
  document.body.append(panel);

  const $ = (sel) => panel.querySelector(sel);
  const gridEl = $('.grid'), statusEl = $('.status'), timerEl = $('.timer'), penEl = $('.pen');
  const curEl = $('.cur'), resultEl = $('.result'), statsEl = $('.stats'), bannerEl = $('.banner');
  const lockRow = $('.lockrow'), loginBox = $('.adminlogin');
  // Section « Mode administrateur » : n'existe dans le DOM qu'après déverrouillage par mot de passe.
  function buildAdmin() {
    const d = document.createElement('details');
    d.className = 'admin';
    d.innerHTML = '<summary>🛠 Mode administrateur</summary><p>Ces actions ne concernent que ce navigateur : les autres joueurs ne sont jamais affectés.</p>'
      + '<p><label>Date de test : <input type="date" class="tdate"></label> '
      + '<button type="button" data-a="admin-testdate">Jouer cette date</button> <button type="button" data-a="admin-realdate">Revenir à aujourd’hui</button></p>'
      + '<div class="actions"><button type="button" data-a="admin-today">Recommencer la grille affichée</button>'
      + '<button type="button" data-a="admin-stats">Effacer mes stats et séries</button>'
      + '<button type="button" data-a="admin-off">Verrouiller le mode admin</button></div>';
    statsEl.after(d);
    lockRow.hidden = true; loginBox.hidden = true;
  }
  if (ADMIN) buildAdmin();
  const diffNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  function renderMode() {
    const accTxt = strict ? ' · accents obligatoires' : '';
    const mixTxt = legacy ? '' : (([x, m, h]) => ` · ${x} faciles, ${m} intermédiaires, ${h} difficiles`)(mixCounts(entries));
    $('.meta').textContent = `Défi n°${dayNum > 0 ? dayNum : '–'} · ${diffNames[weekday(date)]} ${date} · grille ${n} × ${n} · ${entries.length} mots${mixTxt}${accTxt}${testMode ? ' · 🧪 MODE TEST : rien n’est compté dans vos stats' : ''}`;
    panel.querySelectorAll('.hint,.accents,.rule-accents').forEach((el) => { el.hidden = !strict; });
    panel.querySelector('.rule-ascii').hidden = strict;
  }

  let inputs = [], boxes = [];
  const clueItems = new Map();
  let selected = null;
  let pendingDir = null;
  let pointerWasFocused = false;
  let currentIdx = -1;

  const dirLabel = (e) => (e.d === 'H' ? 'Horizontalement' : 'Verticalement');
  const FORCE_NAMES = ['', 'facile', 'facile', 'intermédiaire', 'intermédiaire', 'difficile', 'très difficile'];

  function setCurrent(i) {
    if (currentIdx >= 0 && boxes[currentIdx]) { boxes[currentIdx].classList.remove('current'); inputs[currentIdx].tabIndex = -1; }
    currentIdx = i;
    boxes[i].classList.add('current');
    inputs[i].tabIndex = 0;
  }

  function choose(e, { focus = true, cell = null } = {}) {
    selected = e;
    boxes.forEach((el) => el && el.classList.remove('active'));
    for (const i of e.cells) boxes[i].classList.add('active');
    clueItems.forEach((li, id) => li.classList.toggle('chosen', id === entryId(e)));
    curEl.textContent = `${e.num} ${dirLabel(e)} — ${e.clue} (${e.w.length}) · Force ${e.force} (${FORCE_NAMES[e.force]})`;
    if (focus) {
      const t = cell !== null ? cell : (e.cells.find((i) => !inputs[i].readOnly) ?? e.cells[0]);
      if (document.activeElement === inputs[t]) setCurrent(t); else inputs[t].focus();
    }
  }

  function toggleDirection(i) {
    const other = entriesAt[i].find((e) => e !== selected);
    if (other) choose(other, { cell: i });
  }

  function stepFrom(i, dy, dx) {
    let y = Math.floor(i / n) + dy, x = (i % n) + dx;
    while (y >= 0 && y < n && x >= 0 && x < n) {
      if (inputs[y * n + x]) return y * n + x;
      y += dy; x += dx;
    }
    return -1;
  }

  function clearCell(i) {
    inputs[i].value = '';
    state.cells[i] = '';
    touch();
    refreshLocks();
  }

  // Place 1 lettre (ou 2 pour une ligature œ / æ) à partir de la case i, puis passe à la case suivante du mot.
  function enterLetters(i, str) {
    const ids = selected.cells.includes(i) ? selected.cells : [i];
    let pos = i, last = i;
    for (const ch of str) {
      if (pos === undefined || inputs[pos].readOnly) break;
      inputs[pos].value = ch;
      state.cells[pos] = ch;
      last = pos;
      pos = ids[ids.indexOf(pos) + 1];
    }
    touch();
    refreshLocks();
    const next = ids.slice(ids.indexOf(last) + 1).find((j) => !inputs[j].readOnly);
    if (next !== undefined) inputs[next].focus();
  }

  const ARROWS = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] };

  // (Re)construit la grille et les listes de définitions du jour affiché.
  function buildBoard() {
    gridEl.textContent = '';
    $('.h').textContent = ''; $('.v').textContent = '';
    clueItems.clear();
    inputs = Array(n * n).fill(null);
    boxes = Array(n * n).fill(null);
    gridEl.style.gridTemplateColumns = `repeat(${n},minmax(22px,1fr))`;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = y * n + x;
        const box = document.createElement('div');
        box.className = 'cell' + (b[y][x] ? '' : ' block');
        boxes[i] = box;
        if (b[y][x]) {
          if (numbers[y][x]) {
            const small = document.createElement('small');
            small.textContent = numbers[y][x];
            box.append(small);
          }
          const input = document.createElement('input');
          input.type = 'text';
          input.maxLength = 4; // marge pour remplacer une lettre (ou saisie décomposée e + accent) ; seule la dernière lettre est conservée
          input.autocomplete = 'off';
          input.autocapitalize = 'characters';
          input.spellcheck = false;
          input.setAttribute('autocorrect', 'off');
          input.setAttribute('enterkeyhint', 'next');
          input.setAttribute('aria-label', `Ligne ${y + 1}, colonne ${x + 1}`);
          input.tabIndex = -1;
          input.value = state.cells[i] || '';
          inputs[i] = input;

          input.addEventListener('focus', () => {
            const list = entriesAt[i];
            const pref = pendingDir || (list.includes(selected) ? null : selected.d);
            let target = pref ? list.find((e) => e.d === pref) : null;
            if (!target) target = list.includes(selected) ? selected : list[0];
            pendingDir = null;
            if (target !== selected) choose(target, { focus: false });
            setCurrent(i);
          });
          input.addEventListener('pointerdown', () => { pointerWasFocused = document.activeElement === input; });
          input.addEventListener('click', () => {
            if (pointerWasFocused && entriesAt[i].length === 2) toggleDirection(i);
            pointerWasFocused = false;
          });
          input.addEventListener('input', (ev) => {
            if (input.readOnly) { input.value = state.cells[i]; return; }
            const all = normalizeInput(input.value, strict);
            if (!all) {
              if (ev.isComposing) return; // touche morte en attente (^, ¨…) : ne pas casser la composition
              input.value = state.cells[i] || ''; // saisie rejetée (chiffre, symbole…)
              return;
            }
            // Ce qui vient d'être tapé : une ligature (œ, æ) donne 2 lettres, sinon la dernière lettre saisie.
            const typed = ev.data && /^[œŒæÆ]$/.test(ev.data) ? normalizeInput(ev.data, strict) : all.slice(-1);
            enterLetters(i, typed);
          });
          input.addEventListener('keydown', (ev) => {
            if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
            const dir = ARROWS[ev.key];
            if (dir) {
              const t = stepFrom(i, dir[0], dir[1]);
              if (t >= 0) { ev.preventDefault(); pendingDir = dir[0] === 0 ? 'H' : 'V'; inputs[t].focus(); }
              return;
            }
            if (ev.key === 'Backspace' || ev.key === 'Delete') {
              ev.preventDefault();
              if (!input.readOnly && input.value) { clearCell(i); return; }
              if (ev.key === 'Backspace') {
                const prev = selected.cells[selected.cells.indexOf(i) - 1];
                if (prev !== undefined) inputs[prev].focus();
              }
              return;
            }
            if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); toggleDirection(i); }
          });
          box.append(input);
        }
        gridEl.append(box);
      }
    }
    const firstInput = inputs.findIndex(Boolean);
    inputs[firstInput].tabIndex = 0;

    for (const e of order) {
      const li = document.createElement('li');
      li.value = e.num;
      li.dataset.id = entryId(e);
      li.tabIndex = 0;
      li.setAttribute('role', 'button');
      li.textContent = `${e.clue} (${e.w.length})`;
      const badge = document.createElement('span');
      badge.className = 'f ' + ['', '', '', 'mid', 'mid', 'hard', 'hard'][e.force];
      badge.textContent = 'F' + e.force;
      badge.title = `Force ${e.force} : ${FORCE_NAMES[e.force]}`;
      li.append(badge);
      li.addEventListener('click', () => choose(e));
      li.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); choose(e); } });
      clueItems.set(entryId(e), li);
      $(e.d === 'H' ? '.h' : '.v').append(li);
    }
  }

  // ───────────────────────────── Logique de jeu ─────────────────────────────
  function solvedSet() {
    const s = new Set();
    for (const e of entries) if (e.cells.every((pos, k) => state.cells[pos] === e.w[k])) s.add(entryId(e));
    return s;
  }

  function refreshLocks() {
    const solved = solvedSet();
    const frozen = new Set();
    for (const e of entries) if (solved.has(entryId(e))) e.cells.forEach((p) => frozen.add(p));
    inputs.forEach((input, i) => {
      if (!input) return;
      input.readOnly = frozen.has(i);
      input.setAttribute('aria-readonly', String(frozen.has(i)));
      boxes[i].classList.toggle('locked', frozen.has(i));
    });
    clueItems.forEach((li, id) => li.classList.toggle('solved', solved.has(id)));
    if (solved.size === entries.length && !finished()) finish();
    renderControls();
    return solved;
  }

  function finish() {
    state.finalSeconds = scoreSeconds();
    if (!testMode && date === realDate) { // ni une grille de test, ni une grille d'archive ne comptent dans les stats / la série
      stats.history[date] = { sec: state.finalSeconds, hints: state.hints, checks: state.checks, n };
      const keep = Object.keys(stats.history).sort().slice(-120);
      stats.history = Object.fromEntries(keep.map((d) => [d, stats.history[d]]));
      writeJSON(KEY_STATS, stats);
    }
    touch();
    stopTimer();
    renderResult();
    renderStats();
    renderDayNav(); // la liste des jours affiche « ✓ + temps » dès la fin de la grille
    statusEl.textContent = 'Bravo ! Tous les mots sont validés.';
  }

  function renderControls() {
    const done = finished();
    panel.querySelectorAll('[data-a="check"],[data-a="hint"]').forEach((el) => { el.disabled = done; });
  }

  function renderPenalties() {
    penEl.textContent = `Indices : ${state.hints} · Vérifications : ${state.checks} · Pénalités : +${state.hints * HINT_PENALTY + state.checks * CHECK_PENALTY} s`;
  }

  function renderTimer() {
    timerEl.textContent = '⏱ ' + formatTime(finished() ? state.finalSeconds : scoreSeconds());
  }

  function renderStats() {
    const { current, best } = computeStreaks(stats.history, realDate);
    const secs = Object.values(stats.history).map((r) => r.sec);
    statsEl.textContent = secs.length
      ? `Grilles terminées : ${secs.length} · Série : ${current} 🔥 (record ${best}) · Meilleur temps : ${formatTime(Math.min(...secs))}`
      : 'Aucune grille terminée pour l’instant — la série démarre à votre première victoire.';
  }

  function shareText() {
    const head = `${testMode ? '🧪 [TEST] ' : ''}🧩 Crossword Daily JVC #${dayNum > 0 ? dayNum : date} · ${date}${!testMode && date !== realDate ? ' (archive)' : ''}`;
    if (finished()) {
      const net = Math.floor(state.activeMs / 1000);
      const { current } = computeStreaks(stats.history, realDate);
      const streak = !testMode && date === realDate ? `\n🔥 Série : ${current}` : '';
      return `${head}\n${n}×${n} · ⏱ ${formatTime(state.finalSeconds)} (net ${formatTime(net)}, ${state.hints} indice(s), ${state.checks} vérif.)${streak}`;
    }
    return `${head}\n${n}×${n} · en cours : ${solvedSet().size}/${entries.length} mots · ⏱ ${formatTime(scoreSeconds())}`;
  }

  function renderResult() {
    if (!finished()) { resultEl.hidden = true; return; }
    const net = Math.floor(state.activeMs / 1000);
    resultEl.hidden = false;
    const pen = state.hints * HINT_PENALTY + state.checks * CHECK_PENALTY;
    resultEl.textContent = !testMode && date !== realDate
      ? `Grille d’archive terminée en ${formatTime(state.finalSeconds)} : ${formatTime(net)} de jeu + ${pen} s de pénalités. Elle ne compte pas dans votre série.`
      : `Terminé en ${formatTime(state.finalSeconds)} : ${formatTime(net)} de jeu + ${pen} s de pénalités. Revenez demain pour le défi n°${dayNum + 1}.`;
  }

  function applyStateToUI() {
    inputs.forEach((input, i) => { if (input) input.value = state.cells[i] || ''; });
    refreshLocks();
    renderTimer(); renderPenalties(); renderResult();
  }

  // ───────────────────────────── Chrono ─────────────────────────────
  let timerId = null;
  let tickAt = null;
  let ticks = 0;
  const counting = () => !panel.hidden && !document.hidden && !finished();

  function tick() {
    const now = Date.now();
    if (tickAt !== null && counting()) state.activeMs += Math.min(now - tickAt, 5000); // plafond anti mise en veille
    tickAt = now;
    ticks++;
    renderTimer();
    if (ticks % 5 === 0) save();
    if (ticks % 30 === 0) checkRollover();
  }
  function startTimer() { if (timerId === null) { tickAt = Date.now(); timerId = setInterval(tick, 1000); } }
  function stopTimer() { if (timerId !== null) { clearInterval(timerId); timerId = null; } tickAt = null; save(); }

  function checkRollover() {
    if (!testMode && parisDate() !== realDate) bannerEl.hidden = false;
  }

  function syncFromStorage() {
    const raw = readJSON(KEY_DAY);
    if (raw && Number.isFinite(raw.rev) && raw.rev > state.rev) { state = sanitize(raw); applyStateToUI(); }
    stats = loadStats();
    renderStats();
  }

  // ───────────────────────────── Grilles passées (archive) ─────────────────────────────
  const dateFr = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  // État d'un jour, lu dans le stockage : « ✓ 05:12 » (terminé), « en cours » ou vide.
  function dayStatus(d) {
    const raw = readJSON(`cdj:${KEY_PREFIX[modeOf(d)]}:${d}`);
    if (!raw || typeof raw !== 'object') return '';
    if (Number.isFinite(raw.finalSeconds) && raw.finalSeconds >= 0) return `✓ ${formatTime(raw.finalSeconds)}`;
    return Array.isArray(raw.cells) && raw.cells.some(Boolean) ? 'en cours' : '';
  }
  function renderDayNav() {
    const nav = panel.querySelector('.daynav');
    nav.hidden = testMode; // le mode test a son propre sélecteur de date
    panel.querySelector('.archnote').hidden = testMode || date === realDate;
    if (testMode) return;
    save(); // le statut du jour affiché doit être à jour
    const sel = panel.querySelector('.daysel');
    sel.textContent = '';
    for (let d = realDate, k = 0; d >= EPOCH && k < 500; d = prevDay(d), k++) {
      const o = document.createElement('option');
      const st = dayStatus(d);
      o.value = d;
      o.textContent = `n°${dayNumber(d)} · ${dateFr(d)}${d === realDate ? ' (aujourd’hui)' : ''}${st ? ' — ' + st : ''}`;
      if (d === date) o.selected = true;
      sel.append(o);
    }
    panel.querySelector('[data-a="day-prev"]').disabled = prevDay(date) < EPOCH;
    panel.querySelector('[data-a="day-next"]').disabled = date >= realDate;
  }
  // Affiche la grille d'un autre jour (passé uniquement), avec sa propre progression et son propre chrono.
  function switchDay(d) {
    if (testMode || d === date || d < EPOCH || d > realDate) return;
    const wasOpen = !panel.hidden;
    stopTimer(); // enregistre la progression du jour quitté
    removeFallback();
    if (!configureDay(d)) { say('Grille indisponible pour ce jour.'); return; }
    state = sanitize(readJSON(KEY_DAY));
    stats = loadStats();
    buildBoard();
    renderMode();
    selected = order[0]; currentIdx = -1; pendingDir = null;
    choose(selected, { focus: false });
    applyStateToUI();
    renderStats();
    renderDayNav();
    panel.scrollTop = 0;
    if (wasOpen && !finished()) startTimer();
    say(date === realDate ? 'Retour à la grille du jour.' : `Grille d’archive du ${date} (n°${dayNum}).`);
  }

  // ───────────────────────────── Actions ─────────────────────────────
  let resetArmed = null;
  const say = (msg) => { statusEl.textContent = msg; };

  function removeFallback() { panel.querySelectorAll('.fallback').forEach((el) => el.remove()); }

  // Déverrouillage : empreinte PBKDF2-SHA256 du mot de passe saisi comparée à celle du script.
  async function adminDerive(pw) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(ADMIN_SALT), iterations: ADMIN_ITER }, key, 256);
    return [...new Uint8Array(bits)].map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  let adminFails = 0, adminLockUntil = 0;
  async function adminUnlock() {
    const now = Date.now();
    if (now < adminLockUntil) { say(`Trop d’essais : patientez ${Math.ceil((adminLockUntil - now) / 1000)} s.`); return; }
    const pwEl = panel.querySelector('.apw');
    const pw = pwEl.value;
    pwEl.value = '';
    if (!pw) { say('Saisissez le mot de passe.'); return; }
    let h = '';
    try { h = await adminDerive(pw); } catch { say('Chiffrement indisponible dans ce navigateur : accès administrateur impossible.'); return; }
    if (h !== ADMIN_HASH) {
      adminFails++;
      if (adminFails >= 5) { adminFails = 0; adminLockUntil = Date.now() + 30000; say('Mot de passe incorrect. Trop d’essais : patientez 30 s.'); } else say('Mot de passe incorrect.');
      return;
    }
    adminFails = 0;
    try {
      sessionStorage.setItem('cdj:admin-ok', ADMIN_HASH); // valable jusqu'à la fermeture de l'onglet
      if (panel.querySelector('.aremember').checked) localStorage.setItem('cdj:admin-ok', ADMIN_HASH); // sur cet appareil
    } catch { /* ignoré */ }
    ADMIN = true;
    buildAdmin();
    say('Mode administrateur déverrouillé.');
  }
  panel.querySelector('.apw').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); adminUnlock(); } });

  // Actions du mode administrateur : double clic de confirmation (4 s), comme « Effacer mes erreurs ».
  const adminArmed = new Map();
  function adminAction(btn, a) {
    if (a === 'admin-testdate' || a === 'admin-realdate') { // pas de confirmation : aucune donnée n'est effacée
      const v = a === 'admin-testdate' ? panel.querySelector('.tdate').value : '';
      if (a === 'admin-testdate' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) { say('Choisissez d’abord une date de test.'); return; }
      try { if (v) localStorage.setItem('cdj:testdate', v); else localStorage.removeItem('cdj:testdate'); } catch { /* ignoré */ }
      location.reload();
      return;
    }
    if (!adminArmed.has(btn)) {
      btn.dataset.label = btn.textContent;
      btn.textContent = 'Confirmer ?';
      adminArmed.set(btn, setTimeout(() => { btn.textContent = btn.dataset.label; adminArmed.delete(btn); }, 4000));
      return;
    }
    clearTimeout(adminArmed.get(btn)); adminArmed.delete(btn);
    btn.textContent = btn.dataset.label;
    if (a === 'admin-today') {
      // Grille du jour entièrement remise à zéro : lettres, chrono, indices, vérifications, résultat et entrée de stats du jour.
      const rev = state.rev + 1; // révision supérieure : les autres onglets de CE navigateur suivent
      state = sanitize(null); state.rev = rev;
      if (!testMode) { delete stats.history[date]; writeJSON(KEY_STATS, stats); }
      save();
      applyStateToUI(); renderStats();
      if (!panel.hidden) startTimer();
      choose(order[0]);
      say('Grille du jour recommencée (chrono, indices et vérifications remis à zéro).');
    } else if (a === 'admin-stats') {
      stats = { history: {} };
      writeJSON(KEY_STATS, stats); renderStats();
      say('Statistiques et séries effacées (ce navigateur uniquement).');
    } else {
      // Verrouillage : retire l'accès (session et appareil) et la date de test éventuelle.
      try { sessionStorage.removeItem('cdj:admin-ok'); localStorage.removeItem('cdj:admin-ok'); } catch { /* ignoré */ }
      ADMIN = false;
      panel.querySelectorAll('details.admin').forEach((el) => el.remove());
      if (testMode) { try { localStorage.removeItem('cdj:testdate'); } catch { /* ignoré */ } location.reload(); return; }
      lockRow.hidden = false;
      say('Mode administrateur verrouillé.');
    }
  }

  panel.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('[data-a]');
    if (!btn) return;
    const a = btn.dataset.a;
    removeFallback();
    if (a === 'admin-open') { loginBox.hidden = !loginBox.hidden; if (!loginBox.hidden) panel.querySelector('.apw').focus(); return; }
    if (a === 'admin-unlock') { adminUnlock(); return; }
    if (a.startsWith('admin-')) { if (ADMIN) adminAction(btn, a); return; }
    if (a === 'day-prev') { switchDay(prevDay(date)); return; }
    if (a === 'day-next') { switchDay(nextDay(date)); return; }
    if (a === 'day-today') { switchDay(realDate); return; }
    if (a === 'reload') { location.reload(); return; }
    if (a === 'prev' || a === 'next') {
      const k = order.indexOf(selected);
      choose(order[(k + (a === 'next' ? 1 : order.length - 1)) % order.length]);
      return;
    }
    if (a === 'check') {
      if (finished()) return;
      if (!state.cells.some(Boolean)) { say('Rien à vérifier pour l’instant.'); return; }
      state.checks++;
      touch();
      const total = inputs.filter(Boolean).length;
      const correct = inputs.filter((el, i) => el && state.cells[i] === solutionAt(i)).length;
      renderPenalties(); renderTimer();
      say(`${correct}/${total} lettres correctes (+${CHECK_PENALTY} s).`);
      return;
    }
    if (a === 'hint') {
      if (finished()) return;
      const i = selected.cells.find((j) => state.cells[j] !== solutionAt(j));
      if (i === undefined) { say('Ce mot est déjà correct.'); return; }
      state.cells[i] = solutionAt(i);
      inputs[i].value = state.cells[i];
      state.hints++;
      touch();
      refreshLocks();
      renderPenalties(); renderTimer();
      say(`Une lettre révélée (+${HINT_PENALTY} s).`);
      return;
    }
    if (a === 'share') {
      const text = shareText();
      try {
        await navigator.clipboard.writeText(text);
        say('Résultat copié : collez-le dans votre topic.');
      } catch {
        const ta = document.createElement('textarea');
        ta.className = 'fallback';
        ta.readOnly = true;
        ta.value = text;
        statusEl.after(ta);
        ta.select();
        say('Copie automatique impossible : copiez le texte ci-dessous (Ctrl+C).');
      }
      return;
    }
    if (a === 'reset') {
      if (finished()) { say('Grille terminée : rien à effacer.'); return; }
      if (!resetArmed) {
        btn.textContent = 'Confirmer ?';
        resetArmed = setTimeout(() => { btn.textContent = 'Effacer mes erreurs'; resetArmed = null; }, 4000);
        return;
      }
      clearTimeout(resetArmed); resetArmed = null;
      btn.textContent = 'Effacer mes erreurs';
      // Seules les cases non validées sont effacées ; chrono, indices et vérifications sont conservés.
      const solved = solvedSet();
      const keep = new Set();
      for (const e of entries) if (solved.has(entryId(e))) e.cells.forEach((p) => keep.add(p));
      state.cells = state.cells.map((c, i) => (keep.has(i) ? c : ''));
      inputs.forEach((input, i) => { if (input) input.value = state.cells[i]; });
      touch();
      refreshLocks();
      say('Cases non validées effacées (chrono et pénalités conservés).');
    }
  });

  panel.querySelector('.daysel').addEventListener('change', (ev) => switchDay(ev.target.value));

  // Barre d'accents (mode strict) : clavier virtuel pour les claviers sans touches mortes ou sur mobile.
  panel.querySelectorAll('.accents button').forEach((btn) => {
    btn.addEventListener('mousedown', (ev) => ev.preventDefault()); // garde le focus dans la case
    btn.addEventListener('click', () => {
      if (finished()) return;
      if (currentIdx < 0 || inputs[currentIdx].readOnly) { say('Choisissez d’abord une case non validée.'); return; }
      enterLetters(currentIdx, normalizeInput(btn.dataset.ch, true));
    });
  });

  // ───────────────────────────── Ouverture / fermeture ─────────────────────────────
  function open(v) {
    panel.hidden = !v;
    [launch, fab].forEach((x) => x.setAttribute('aria-expanded', String(v)));
    if (v) {
      checkRollover();
      syncFromStorage();
      renderDayNav();
      if (!storageOk) say('Stockage local indisponible : votre progression ne sera pas sauvegardée.');
      choose(selected);
      panel.scrollTop = 0;
      startTimer();
    } else {
      stopTimer();
      (opener && opener.isConnected ? opener : launch.isConnected ? launch : fab).focus();
    }
  }
  let opener = null;
  [launch, fab].forEach((x) => x.addEventListener('click', () => { opener = x; open(panel.hidden); }));
  $('.close').addEventListener('click', () => open(false));
  // Les frappes dans le panneau ne doivent pas déclencher d'éventuels raccourcis d'autres scripts.
  panel.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') { ev.preventDefault(); open(false); }
    ev.stopPropagation();
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !panel.hidden) open(false); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { save(); tickAt = null; } else { tickAt = Date.now(); syncFromStorage(); }
  });
  window.addEventListener('pagehide', save);
  window.addEventListener('storage', (ev) => { if (ev.key === KEY_DAY || ev.key === KEY_STATS) syncFromStorage(); });

  // ───────────────────────────── Intégration à la page du forum ─────────────────────────────
  // Deux boutons : un bouton « en ligne » placé dans la page, et un bouton flottant (bas gauche).
  // Emplacements du bouton en ligne, essayés dans l'ordre (le suivant est utilisé si le site rogne/masque le précédent) :
  //  1. à droite de la barre d'actions « ← Liste des sujets | ☆ 🔔 RSS ⚙ » (ou « Retour aux forums »),
  //  2. à la fin du fil d'Ariane (« Accueil / Tous les forums / Forum … / Topic … »),
  //  3. sous le fil d'Ariane, 4. à côté d'un titre « Forum … ».
  const t0 = Date.now();
  const inForums = /^\/forums(\/|\.htm)/.test(location.pathname);
  const titleText = (el) => {
    let t = '';
    el.childNodes.forEach((nd) => { if (nd !== launch) t += nd.textContent; });
    return t.replace(/\s+/g, ' ').trim();
  };
  const visibleEl = (el) => el.getClientRects().length > 0 && !el.closest('#cdj-panel');
  // Premier élément visible dont le texte est exactement l'un des libellés (quelle que soit la balise utilisée).
  function findByText(re) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let nd = walker.nextNode(); nd; nd = walker.nextNode()) {
      const el = nd.parentElement;
      if (el && re.test(nd.nodeValue.replace(/\s+/g, ' ').trim()) && visibleEl(el)) return el;
    }
    return null;
  }
  function findTitle() {
    const cands = [...document.querySelectorAll('h1,h2,[role="heading"]')]
      .filter((el) => visibleEl(el) && /^Forum\s+\S/i.test(titleText(el)));
    return cands.find((el) => el.tagName === 'H1') || cands[0] || null;
  }
  // Fil d'Ariane : plus proche ancêtre de « Tous les forums » dont le texte commence par « Accueil ».
  function findCrumbRoot() {
    let el = findByText(/^Tous les forums$/i);
    el = el && el.parentElement;
    for (let d = 0; el && d < 5; d++, el = el.parentElement) {
      if (/^Accueil/i.test(titleText(el)) && el.textContent.length < 600) return el;
    }
    return null;
  }
  // Barre d'actions : plus petit ancêtre du lien « Liste des sujets » / « Retour aux forums » qui contient
  // aussi la barre d'outils (≥ 3 liens ou boutons) et tient sur une ligne.
  function findActionRow() {
    let el = findByText(/^(Retour aux forums|Liste des sujets)$/i);
    for (let d = 0; el && d < 5 && el !== document.body; d++, el = el.parentElement) {
      if (el.querySelectorAll('a,button').length >= 3 && el.getBoundingClientRect().height <= 90) return el;
    }
    return null;
  }
  const STRATS = ['actions', 'crumb', 'crumb-after', 'heading'];
  let strat = 0;
  const place = {
    actions() {
      const row = findActionRow();
      if (!row) return false;
      launch.classList.remove('after');
      if (launch.parentElement !== row || row.lastElementChild !== launch) row.appendChild(launch);
      return true;
    },
    crumb() {
      const root = findCrumbRoot();
      if (!root) return false;
      const host = [...root.children].filter((c) => c !== launch && c.getClientRects().length > 0).pop() || root;
      launch.classList.remove('after');
      if (host === root) { if (launch.parentElement !== root) root.appendChild(launch); }
      else if (host.closest('a')) host.insertAdjacentElement('afterend', launch); // jamais de bouton à l'intérieur d'un lien
      else if (launch.parentElement !== host) host.appendChild(launch);
      return true;
    },
    'crumb-after'() {
      const root = findCrumbRoot();
      if (!root) return false;
      launch.classList.add('after');
      if (launch.previousElementSibling !== root) root.insertAdjacentElement('afterend', launch);
      return true;
    },
    heading() {
      const t = findTitle();
      if (!t) return false;
      launch.classList.remove('after');
      if (launch.parentElement !== t) t.appendChild(launch);
      return true;
    },
  };
  function attach() {
    for (let i = strat; i < STRATS.length; i++) {
      if (place[STRATS[i]]()) { strat = i; log('bouton placé :', STRATS[i], launch.parentElement); verifySoon(); return true; }
    }
    return false;
  }
  // Le bouton est-il rogné, masqué ou hors de l'écran à cause de son parent ?
  function isClipped() {
    if (!launch.isConnected) return false;
    const r = launch.getBoundingClientRect();
    if (r.width < 8 || r.height < 8 || r.right > document.documentElement.clientWidth + 1) return true;
    for (let el = launch.parentElement; el && el !== document.body; el = el.parentElement) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return true;
      if (/(hidden|clip|auto|scroll)/.test(cs.overflowX + cs.overflowY)) {
        const a = el.getBoundingClientRect();
        if (r.right > a.right + 1 || r.left < a.left - 1 || r.bottom > a.bottom + 1 || r.top < a.top - 1) return true;
      }
    }
    return false;
  }
  function verifySoon() {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!isClipped()) return;
      log('bouton rogné, emplacement suivant');
      launch.remove();
      if (strat < STRATS.length - 1) { strat++; ensure(); } else lastResort();
    }));
  }
  // Aucun emplacement utilisable : le bouton flottant prend le relais, même si l'utilisateur l'avait désactivé.
  function lastResort() {
    if (!inForums || fab.isConnected) return;
    document.body.append(fab);
    console.warn('[CDJ] Emplacement dans la page introuvable : bouton flottant utilisé.');
  }
  let nextTry = 0;
  function ensure() {
    if (!panel.isConnected && document.body) document.body.append(panel);
    if (!inForums || !document.body) return;
    if (FAB_PREF && !fab.isConnected) document.body.append(fab);
    if (launch.isConnected || Date.now() < nextTry) return;
    if (attach()) return;
    nextTry = Date.now() + 1500; // évite de rescanner la page à chaque mutation si rien n'est trouvé
    if (Date.now() - t0 >= 8000) lastResort();
  }
  let rz = 0;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (isClipped()) verifySoon(); }, 300); });
  let raf = 0;
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; ensure(); }); };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  setTimeout(ensure, 8200);

  // ───────────────────────────── Démarrage ─────────────────────────────
  buildBoard();
  renderMode();
  selected = order[0];
  choose(selected, { focus: false });
  refreshLocks();
  renderDayNav();
  renderTimer(); renderPenalties(); renderResult(); renderStats();
  ensure();
  log('prêt', { date, n, mots: entries.length, version: VERSION });
})();

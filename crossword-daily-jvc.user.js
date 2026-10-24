// ==UserScript==
// @name         Crossword Daily JVC
// @namespace    https://jvscript.fr/
// @version      0.4.0
// @description  Mots croisés quotidiens sur les forums JVC : une grille par jour, identique pour tout le monde. Chrono, série et partage du résultat, 100 % local.
// @match        https://www.jeuxvideo.com/forums/*
// @match        https://jeuxvideo.com/forums/*
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
 * Crossword Daily JVC — v0.4.0
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
  if (document.getElementById('cdj-launch')) return; // garde anti double injection

  /* <pure> — bloc sans accès au DOM, extrait tel quel par les tests Node */
  const VERSION = '0.4.0';
  const EPOCH = '2026-10-23';       // défi n°1
  const HINT_PENALTY = 30;          // secondes ajoutées par indice
  const CHECK_PENALTY = 15;         // secondes ajoutées par vérification
  // Taille de grille selon le jour (0 = dimanche) : courbe de difficulté prévisible.
  const SIZE_BY_WEEKDAY = [11, 7, 7, 9, 9, 11, 13];
  const MIN_WORDS = { 5: 4, 7: 7, 9: 10, 11: 13, 13: 16 };

  const LEGACY_RAW = `CHAT|Félin domestique;CHIEN|Animal qui aboie;LUNE|Satellite de la Terre;SOLEIL|Notre étoile;MER|Étendue d'eau salée;LAC|Étendue d'eau intérieure;RIVE|Bord d'une rivière;PLAGE|Rivage sablonneux;VAGUE|Ondulation de l'eau;ORAGE|Tonnerre et éclairs;NUAGE|Masse de vapeur dans le ciel;PLUIE|Précipitation liquide;NEIGE|Précipitation hivernale en flocons;VENT|Air en mouvement;ARBRE|Végétal à tronc;FORET|Étendue boisée;FLEUR|Partie colorée d'une plante;ROSE|Rosacée à épines;TIGE|Axe d'une plante;RACINE|Partie souterraine;FEUILLE|Organe de la photosynthèse;FRUIT|Se mange, après la floraison;POMME|Se cueille sur un pommier;POIRE|Se cueille sur un poirier;PECHE|Velouté, avec un noyau;PRUNE|Se cueille sur un prunier;RAISIN|Pousse en grappes sur la vigne;CERISE|Petite boule à queue du cerisier;MELON|Cucurbitacée sucrée;CITRON|Agrume très acide;ORANGE|Agrume sucré qui nomme une couleur;TABLE|Meuble pour les repas;CHAISE|Siège à dossier;PORTE|Ouverture mobile;FENETRE|Ouverture vitrée;MAISON|Lieu d'habitation;TOIT|Couverture d'un bâtiment;MUR|Paroi verticale;SALON|Pièce de réception;CUISINE|Pièce des repas;LIVRE|Ouvrage relié à lire;PAGE|Côté d'un feuillet imprimé;STYLO|Instrument à encre;CRAYON|Instrument à mine;PAPIER|Support d'écriture;LETTRE|Signe de l'alphabet;MOT|Unité du dictionnaire;PHRASE|Énoncé complet et ponctué;TEXTE|Contenu écrit d'un document;ECOLE|Lieu d'enseignement;CLASSE|Groupe d'apprenants;ELEVE|Personne qui apprend;PROF|Enseignant familier;COURS|Leçon;EXAMEN|Épreuve d'évaluation;NOTE|Résultat scolaire;MATHS|Discipline des équations;NOMBRE|Objet servant à compter;CHIFFRE|Symbole numérique;CARRE|Quadrilatère régulier;CERCLE|Courbe fermée autour d'un centre;ANGLE|Ouverture entre deux droites;LIGNE|Trait continu;POINT|Lieu sans dimension en géométrie;FORME|Aspect extérieur d'une figure;TEMPS|Ce que mesure l'horloge;HEURE|Vingt-quatrième partie d'une journée;MINUTE|Soixante secondes;JOUR|Durée d'une rotation de la Terre;NUIT|Période d'obscurité;MATIN|Début de journée;SOIR|Fin de journée;SEMAINE|Du lundi au dimanche;MOIS|Un douzième d'an;ANNEE|Période allant de janvier à décembre;HIVER|Saison froide;PRINTEMPS|Saison des bourgeons;AUTOMNE|Saison des vendanges;ETE|Saison chaude;ROUTE|Voie de circulation;TRAIN|Transport sur rails;AVION|Appareil volant;VELO|Deux-roues à pédales;BATEAU|Véhicule flottant;VILLE|Grande agglomération;VILLAGE|Petite agglomération;RUE|Voie urbaine;PLACE|Espace public;PONT|Franchit une rivière;AMI|Personne liée par l'amitié;AMIE|Camarade, au féminin;FAMILLE|Personnes apparentées;ENFANT|Jeune être humain;PARENT|Père ou mère;FRERE|Garçon de la fratrie;SOEUR|Fille de la fratrie;JEU|Activité ludique;JOUEUR|Participant d'une partie;SCORE|Total marqué;REGLE|Consigne à respecter;ENIGME|Question à résoudre;INDICE|Aide à la résolution;REPONSE|Solution à une question;SECRET|Information cachée;IDEE|Pensée;LOGIQUE|Étude du raisonnement;MEMOIRE|Faculté de se souvenir;SAVOIR|Connaissances;ESPRIT|Intelligence, ou fantôme;RAISON|Bon sens, faculté de juger;RIRE|Exprimer sa gaieté;JOIE|Sentiment de bonheur;PEUR|Émotion face au danger;CALME|Absence d'agitation;PAIX|Absence de guerre;FORCE|Capacité d'action;VITESSE|Distance par durée;ENERGIE|Capacité de travail;MUSIQUE|Art de combiner mélodies et rythmes;CHANT|Mélodie exécutée sans instrument;DANSE|Mouvement en rythme;IMAGE|Reflet que renvoie un miroir;PHOTO|Cliché pris avec un appareil;FILM|Œuvre cinématographique;SCENE|Partie d'une pièce;ECRAN|Surface d'affichage;RADIO|Média sonore;VOIX|Instrument de la parole;SON|Vibration audible;BRUIT|Nuisance sonore;MAIN|Extrémité du bras;PIED|Extrémité de la jambe;TETE|Partie supérieure du corps;OEIL|Organe de la vue;NEZ|Organe de l'odorat;BOUCHE|Ouverture du visage;COEUR|Organe central de la circulation;SANG|Liquide des vaisseaux;BLEU|Couleur du ciel clair;ROUGE|Couleur de la tomate mûre;VERT|Couleur de l'herbe;BLANC|Couleur du lait;NOIR|Couleur de l'encre;GRIS|Couleur de la cendre;FER|Métal de l'acier;BOIS|Matière du tronc;PIERRE|Matériau minéral;VERRE|Matériau des vitres`;

  // Dictionnaire étendu (v0.4) : indices variés, tous niveaux. Les anciens mots sont conservés.
  const EXTRA_RAW = `LION|Roi de la savane;TIGRE|Grand félin rayé;LOUP|Il hurle à la pleine lune;RENARD|Roux et rusé dans les fables;OURS|Plantigrade qui hiberne;CHEVAL|Il galope avec un cavalier sur le dos;VACHE|Elle donne du lait;MOUTON|Il donne sa laine;CHEVRE|Elle fournit du fromage frais;COCHON|Il a une queue en tire-bouchon;POULE|Elle pond des oeufs;CANARD|Palmipède qui cancane;OIE|Palmipède du foie gras;LAPIN|Il aime les carottes;SOURIS|Rongeur ou périphérique d'ordinateur;RAT|Rongeur des égouts;SINGE|Primate agile, cousin de l'homme;GIRAFE|Animal au plus long cou;ZEBRE|Équidé rayé d'Afrique;ELEPHANT|Pachyderme à trompe;DAUPHIN|Mammifère marin très joueur;BALEINE|Plus grand mammifère marin;REQUIN|Squale redouté des nageurs;POISSON|Il respire avec des branchies;ABEILLE|Elle butine et fait du miel;FOURMI|Petit insecte travailleur;PAPILLON|Ancienne chenille aux ailes colorées;ARAIGNEE|Elle tisse une toile;SERPENT|Reptile sans pattes;TORTUE|Reptile à carapace;GRENOUILLE|Batracien qui coasse;AIGLE|Rapace symbole de puissance;HIBOU|Rapace nocturne;CORBEAU|Oiseau sombre de la fable du fromage;MOINEAU|Petit oiseau des villes;HERISSON|Boule de piquants;ECUREUIL|Rongeur roux amateur de noisettes;CERF|Mâle portant des bois;CHAMEAU|Bossu du désert à deux bosses;PINGOUIN|Oiseau marin des régions froides;FAUCON|Rapace dressé pour la chasse;PERROQUET|Oiseau coloré qui répète ce qu'il entend;HIRONDELLE|Migratrice à queue en fourche;ESCARGOT|Il porte sa coquille;LIEVRE|Rapide oreillard de la fable;MOUCHE|Insecte bourdonnant;MOUSTIQUE|Il pique en bourdonnant;CRABE|Il marche de côté;PIEUVRE|Mollusque à huit bras;MEDUSE|Elle brûle les baigneurs;LICORNE|Cheval légendaire à une corne;DRAGON|Monstre ailé qui crache du feu;MONTAGNE|Haut relief rocheux;COLLINE|Petite élévation de terrain;VALLEE|Creux entre deux reliefs;VOLCAN|Relief qui crache de la lave;DESERT|Étendue aride de sable;OCEAN|Immense étendue salée;ILE|Terre entourée d'eau;FLEUVE|Grand cours d'eau;RUISSEAU|Petit cours d'eau;CASCADE|Chute d'eau;GLACIER|Rivière de glace;GLACE|Eau solide;CAVERNE|Grotte profonde;FALAISE|Paroi rocheuse abrupte;SABLE|Il compose les dunes;DUNE|Colline de sable;TERRE|Notre planète;PLANETE|Mars ou Vénus, par exemple;ETOILE|Astre scintillant;COMETE|Astre à longue queue lumineuse;GALAXIE|Immense ensemble d'étoiles;UNIVERS|Tout ce qui existe;ECLIPSE|Un astre en cache un autre;AURORE|Première lueur du jour;BROUILLARD|Voile qui limite la visibilité;TEMPETE|Perturbation violente;ECLAIR|Trait de lumière précédant le tonnerre;TONNERRE|Grondement après la foudre;FOUDRE|Décharge électrique du ciel;GRELE|Précipitation de grains durs;BRISE|Souffle léger;ARBUSTE|Petit végétal ligneux;BUISSON|Touffe de branches épineuses;HERBE|Elle pousse dans la prairie;PRAIRIE|Étendue herbeuse;CHAMP|Terre cultivée;JARDIN|Espace cultivé d'agrément;CHENE|Arbre aux glands;SAPIN|Conifère de Noël;PALMIER|Arbre des oasis;BAMBOU|Plante creuse mangée par le panda;MOUSSE|Végétal doux qui tapisse les troncs;CHAMPIGNON|Cèpe ou girolle;TULIPE|Fleur néerlandaise;MARGUERITE|Fleur effeuillée par les amoureux;LILAS|Arbuste à grappes parfumées mauves;ORCHIDEE|Plante exotique délicate;MUGUET|Brin porte-bonheur du premier mai;CACTUS|Plante grasse piquante;LAVANDE|Plante violette de Provence;BRAS|Membre qui va de l'épaule au coude;JAMBE|Membre qui porte le corps;GENOU|Articulation entre cuisse et tibia;COUDE|Articulation entre humérus et radius;DOIGT|L'index en est un;ONGLE|Il se coupe ou se vernit;DENT|Elle mord et se brosse;LANGUE|Organe du goût;OREILLE|Organe de l'ouïe;JOUE|Partie ronde du visage;FRONT|Haut du visage;CHEVEU|Poil de la chevelure;PEAU|Enveloppe du corps;OS|Il compose le squelette;MUSCLE|Il se contracte pour bouger;CERVEAU|Siège de la pensée;POUMON|Organe de la respiration;FOIE|Organe qui produit la bile;RHUME|Infection virale bénigne des voies respiratoires;FIEVRE|Température élevée du corps;MEDECIN|Il soigne les malades;HOPITAL|Lieu de soins;REMEDE|Traitement pour guérir;SOMMEIL|Repos nocturne;REVE|Vision de l'endormi;SANTE|On la souhaite en trinquant;FATIGUE|Besoin de repos;PAIN|Aliment de la baguette;FROMAGE|Camembert ou brie;BEURRE|Il se tartine, issu de la crème;LAIT|Boisson des biberons;OEUF|Il contient un jaune;SUCRE|Il rend le café doux;SEL|Il assaisonne les plats;POIVRE|Épice qui fait éternuer;CAFE|Boisson de l'expresso;THE|Infusion asiatique;CHOCOLAT|Gourmandise tirée du cacao;GATEAU|Dessert d'anniversaire;TARTE|Dessert à fond de pâte;BONBON|Friandise sucrée;SORBET|Dessert glacé sans crème;CREPE|Elle se mange à la Chandeleur;SOUPE|Plat chaud en bouillon;SALADE|Plat vert avec une vinaigrette;TOMATE|Base du ketchup;CAROTTE|Légume orangé croquant;OIGNON|Il fait pleurer quand on l'épluche;AIL|Bulbe qui parfume et éloigne les vampires;RIZ|Céréale asiatique;PATES|Spaghettis et tagliatelles;JAMBON|Charcuterie de porc;SAUCISSE|Charcuterie en boyau;STEAK|Tranche de boeuf grillée;POULET|Volaille rôtie du dimanche;SAUMON|Fumé, il garnit les blinis;HUITRE|Mollusque à avaler vivant;MOULE|Coquillage servi avec des frites;FRAISE|Baie sucrée à pépins externes;BANANE|Jaune et courbée, riche en potassium;ANANAS|Tropical piquant à couronne;NOIX|Elle se casse en deux coques;AMANDE|Elle donne un lait et un massepain;MIEL|Nectar transformé par les butineuses;VINAIGRE|Condiment acide issu du vin;VIN|Boisson du Bordeaux;BIERE|Boisson d'orge et de houblon;CIDRE|Boisson bretonne fermentée;EAU|Elle coule du robinet;JUS|Boisson pressée;RECETTE|Mode d'emploi du cuisinier;FOUR|Appareil de cuisson fermé;POELE|Casserole plate;COUTEAU|Il tranche à table;FOURCHETTE|Elle pique les aliments;CUILLERE|Couvert pour les liquides;ASSIETTE|Elle reçoit le plat;BOUTEILLE|Récipient à goulot;LIT|On s'y couche;CANAPE|Siège pour plusieurs personnes;ARMOIRE|Meuble pour ranger le linge;TIROIR|Boîte coulissante d'un meuble;ETAGERE|Planche murale pour ranger;LAMPE|Elle éclaire une pièce;BOUGIE|Éclairage à la cire;MIROIR|Surface réfléchissante;TAPIS|Il couvre le sol;RIDEAU|Tissu qui masque la vitre;CLE|Elle ouvre la serrure;SERRURE|Mécanisme de verrouillage;ESCALIER|Il monte à l'étage;COULOIR|Passage étroit entre des pièces;GARAGE|Abri pour voiture;CAVE|Pièce en sous-sol;GRENIER|Pièce sous les combles;BALCON|Plateforme sur une façade;CLOCHE|Elle sonne ou couvre un plat;HORLOGE|Elle sonne les quarts;MONTRE|Elle se porte au poignet;BALAI|Il chasse la poussière;SEAU|Il porte l'eau;CORDE|Fil épais tressé;CLOU|Il se plante au marteau;MARTEAU|Outil du menuisier;SCIE|Outil à dents pour couper;PINCEAU|Outil du peintre;PEINTURE|Art du tableau;VALISE|Elle se prépare pour partir;SAC|Contenant à anses;PARAPLUIE|Il s'ouvre quand il pleut;LUNETTES|Elles corrigent la vue;CHAPEAU|Il coiffe;CHAUSSURE|Basket ou mocassin;MANTEAU|Vêtement chaud d'extérieur;ROBE|Vêtement féminin d'une pièce;PANTALON|Vêtement à deux tuyaux;CHEMISE|Elle se boutonne;ECHARPE|Elle réchauffe le cou;BIJOU|Collier ou bague;BAGUE|Anneau de fiançailles;COLLIER|Parure du cou;PARFUM|Fragrance;SAVON|Il lave et mousse;BROSSE|Elle coiffe ou nettoie;PEIGNE|Il démêle;TELEPHONE|Appareil pour appeler;CLAVIER|Il porte les touches;ORDINATEUR|Machine de bureau numérique;VOITURE|Automobile;CAMION|Poids lourd;MOTO|Deux-roues à moteur;BUS|Transport en commun urbain;METRO|Transport souterrain;TAXI|Voiture avec chauffeur à la course;FUSEE|Engin qui décolle vers l'espace;VOILIER|Navire à toile;PORT|Abri des navires;GARE|Lieu d'embarquement ferroviaire;AEROPORT|Lieu d'embarquement aérien;TUNNEL|Passage creusé sous un relief;PHARE|Tour qui guide les navires;CHATEAU|Demeure fortifiée d'un seigneur;EGLISE|Lieu de culte chrétien;MUSEE|Lieu d'expositions;CINEMA|Salle de projection;BIBLIOTHEQUE|Lieu de prêt d'ouvrages;MARCHE|Étals en plein air;MAGASIN|Lieu d'achats;BANQUE|Elle garde l'argent;ARGENT|Monnaie;PRIX|Montant demandé pour un achat;CADEAU|Présent offert;FETE|Jour de réjouissance;NOEL|Fête de la crèche;AIR|Ce qu'on respire;OR|Métal jaune précieux;DOS|Arrière du torse;ROUE|Elle tourne sur un essieu;BOULANGER|Il pétrit la baguette;BOUCHER|Il découpe la viande;MACON|Il bâtit en briques;PLOMBIER|Il répare les canalisations;PEINTRE|Artiste de la toile;POMPIER|Il éteint les feux;POLICIER|Agent de l'ordre;JUGE|Il rend la sentence;AVOCAT|Il plaide;MAIRE|Élu de la commune;ROI|Souverain;REINE|Épouse du souverain;PRINCE|Fils de roi;CHEVALIER|Noble en armure;SOLDAT|Militaire du rang;PILOTE|Commandant de bord;MARIN|Navigateur sur un navire;PAYSAN|Cultivateur de la campagne;CUISINIER|Il prépare les plats;SERVEUR|Il apporte les plats à table;CHANTEUR|Il interprète des chansons;ACTEUR|Il joue un rôle;POETE|Il écrit des vers;AUTEUR|Il écrit une oeuvre;FACTEUR|Il distribue le courrier;CHAUFFEUR|Il conduit les passagers;INGENIEUR|Concepteur technique;ARTISTE|Créateur d'oeuvres;SAVANT|Érudit;FOOTBALL|Sport du ballon rond;TENNIS|Sport de raquette sur court;RUGBY|Sport du ballon ovale;BASKET|Sport du panier;NATATION|Sport pratiqué dans un bassin;COURSE|Épreuve de rapidité;SAUT|Bond;BALLON|Il se lance et se tape;FILET|Il sépare les camps au volley;STADE|Enceinte sportive;ARBITRE|Il siffle les fautes;EQUIPE|Groupe de sportifs;MEDAILLE|Récompense d'un podium;CHAMPION|Vainqueur suprême;VICTOIRE|Succès;DEFAITE|Échec dans un match;BUT|Il fait marquer au foot;RAQUETTE|Elle frappe la balle;GOLF|Sport de trous;BOXE|Sport de gants;JUDO|Art martial japonais;SKI|Glisse sur la poudreuse;ESCRIME|Sport de l'épée;CONSOLE|Machine pour jouer sur téléviseur;MANETTE|On la tient pour jouer;JOYSTICK|Levier d'arcade;ARCADE|Salle de bornes de jeux;NIVEAU|Étape d'un jeu;BOSS|Ennemi final;QUETE|Mission d'un personnage;AVATAR|Alter ego virtuel;PIXEL|Plus petit point affiché;CLAN|Communauté soudée du jeu en ligne;FORUM|Espace de discussion en ligne;TOPIC|Fil de discussion;MESSAGE|Texte envoyé à quelqu'un;PSEUDO|Nom choisi en ligne;MODERATEUR|Il fait respecter la charte;CODE|Instructions d'un programme;BUG|Défaut d'un logiciel;LOGICIEL|Programme informatique;INTERNET|Réseau mondial;SITE|Page web;LIEN|Il mène vers une autre page;CLIC|Appui sur un bouton du pointeur;ROBOT|Machine automatisée;DRONE|Petit aéronef sans pilote;CAMERA|Elle filme;MICRO|Objet tenu par les présentateurs;CASQUE|Audio ou protection moto;LABYRINTHE|Dédale;TRESOR|Coffre de pirate;PIRATE|Écumeur à jambe de bois;SORCIER|Magicien maléfique;MAGIE|Art des sorts;EPEE|Lame de d'Artagnan;BOUCLIER|Il protège des coups;ARC|Arme à flèches;FLECHE|Projectile empenné;POTION|Breuvage magique;DONJON|Tour principale d'une forteresse;ORC|Monstre vert de fantasy;ELFE|Créature forestière immortelle;NAIN|Petit mineur de légende;EXPERIENCE|Savoir acquis par la pratique;VIE|Compteur de chances d'un jeu;VIRTUEL|Non réel;TABLEAU|Oeuvre de peintre;STATUE|Sculpture sur piédestal;ROMAN|Récit en prose;POEME|Texte en vers;CONTE|Histoire pour enfants;FABLE|Récit à morale avec animaux;OPERA|Spectacle chanté;CONCERT|Spectacle musical;GUITARE|Instrument à six cordes;PIANO|Instrument à queue ou droit;VIOLON|Instrument à archet;FLUTE|Instrument à embouchure;TAMBOUR|Instrument frappé;TROMPETTE|Instrument de cuivre;MELODIE|Suite de notes;RYTHME|Cadence;CHORALE|Ensemble vocal;ALBUM|Disque de plusieurs titres;COMEDIE|Pièce légère;DRAME|Genre sombre;HEROS|Personnage principal;BANDIT|Hors-la-loi;DETECTIVE|Enquêteur privé;ENQUETE|Recherche de la vérité;CRIME|Infraction très grave;PRISON|Lieu d'enfermement;LOI|Texte voté par les députés;ATOME|Plus petite part d'un élément chimique;MOLECULE|Assemblage d'éléments;CELLULE|Brique du vivant;GENE|Unité d'hérédité;VIRUS|Microbe responsable d'épidémies;MICROBE|Organisme minuscule;CHIMIE|Science des réactions;PHYSIQUE|Science de la matière;BIOLOGIE|Science du vivant;GEOMETRIE|Science des figures;ALGEBRE|Calcul avec des inconnues;OXYGENE|Gaz respiré;HYDROGENE|Élément le plus léger;CARBONE|Base de la vie;GAZ|Fluide sans forme propre;LIQUIDE|État fluide de la matière;SOLIDE|État rigide;GRAVITE|Attraction terrestre;LUMIERE|Elle voyage à 300 000 km/s;CHALEUR|Sensation du chaud;FROID|Contraire de chaud;ELECTRICITE|Courant qui alimente les prises;AIMANT|Il attire certains métaux;BATTERIE|Réserve d'électricité;MOTEUR|Il fait avancer un véhicule;TELESCOPE|Il observe les astres;MICROSCOPE|Il grossit l'infiniment petit;FOSSILE|Reste ancien dans la roche;DINOSAURE|Reptile géant disparu;SQUELETTE|Charpente osseuse;EVOLUTION|Théorie de Darwin;EMPIRE|Vaste territoire d'un empereur;PHARAON|Souverain égyptien;PYRAMIDE|Monument triangulaire d'Égypte;GUERRE|Conflit armé;BATAILLE|Combat entre armées;REVOLUTION|Bouleversement de 1789;NAPOLEON|Empereur de Waterloo;CLEOPATRE|Reine d'Égypte;ZEUS|Maître de l'Olympe;HERCULE|Héros aux douze travaux;ULYSSE|Roi d'Ithaque;TITAN|Géant mythologique;SPHINX|Gardien du plateau de Gizeh;VIKING|Navigateur scandinave;CROISADE|Expédition médiévale;LEGENDE|Récit transmis oralement;MYTHE|Récit des dieux antiques;FANTOME|Revenant en drap;VAMPIRE|Buveur d'hémoglobine;FEE|Marraine au pouvoir magique;GEANT|Être de taille démesurée;PARIS|Capitale française;LYON|Ville des traboules;MARSEILLE|Cité phocéenne;NICE|Ville de la Promenade des Anglais;LILLE|Capitale des Flandres françaises;TOULOUSE|Ville rose;BORDEAUX|Port de la Lune;NANTES|Ville des ducs de Bretagne;STRASBOURG|Siège du Parlement européen;RENNES|Capitale bretonne;FRANCE|Pays de la Marseillaise;ESPAGNE|Pays de Madrid;ITALIE|Pays en forme de botte;ALLEMAGNE|Pays de Berlin;BELGIQUE|Pays de Bruxelles;SUISSE|Pays neutre aux Alpes;JAPON|Archipel de Tokyo;CHINE|Pays de la Grande Muraille;INDE|Pays du Taj Mahal;BRESIL|Pays du carnaval de Rio;CANADA|Pays de l'érable et du sirop;EGYPTE|Pays du Nil;AFRIQUE|Continent du Sahara;EUROPE|Vieux continent;ASIE|Plus vaste continent;AMERIQUE|Nouveau Monde;ALPES|Massif du Mont-Blanc;PYRENEES|Chaîne frontalière du sud-ouest;SEINE|Fleuve de la capitale;LOIRE|Fleuve des châteaux;RHONE|Fleuve du Valais;CORSE|Île de beauté;BRETAGNE|Région des menhirs;NORMANDIE|Région du débarquement de 1944;PROVENCE|Région des cigales;ALSACE|Région de la choucroute;AMOUR|Sentiment qui lie les amants;HAINE|Aversion extrême;COLERE|Emportement soudain;TRISTESSE|Chagrin;COURAGE|Vertu du brave;SAGESSE|Vertu de la prudence éclairée;BONHEUR|État de félicité;CHANCE|Veine, bonne fortune;DESTIN|Sort écrit d'avance;LIBERTE|Droit de choisir;JUSTICE|Équité rendue par un tribunal;VERITE|Contraire du mensonge;MENSONGE|Fausse affirmation;HONNEUR|Dignité;AVENTURE|Voyage plein d'imprévus;VOYAGE|Déplacement lointain;VACANCES|Congés;REPOS|Pause réparatrice;TRAVAIL|Activité professionnelle;DEFI|Épreuve proposée à un concurrent;HASARD|Ce qui arrive sans raison;RISQUE|Danger possible;SURPRISE|Événement inattendu;PATIENCE|Vertu de l'attente;SILENCE|Quand plus rien ne se dit;MYSTERE|Chose inexplicable;JAUNE|Couleur des tournesols;VIOLET|Couleur de l'aubergine;MARRON|Couleur de la châtaigne;DORE|Qui a l'éclat de l'or`;

  // Mots (≥ 3 lettres, avec et sans pluriel) contenus dans un indice, pour éviter qu'une grille
  // contienne deux mots dont l'un figure dans l'indice de l'autre.
  const clueTokens = (clue) => new Set(clue.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
    .split(/[^A-Z]+/).filter((t) => t.length >= 3).flatMap((t) => [t, t.replace(/[SX]$/, '')]));
  const clash = (a, b) => a.tokens.has(b.w) || b.tokens.has(a.w);
  const parseDict = (raw) => raw.split(';')
    .map((x) => { const [w, clue] = x.split('|'); return { w, clue, tokens: clueTokens(clue || '') }; })
    .filter((e) => /^[A-Z]{2,}$/.test(e.w) && e.clue);
  const dictionaryLegacy = parseDict(LEGACY_RAW).filter((e) => e.w.length >= 3);
  const dictionaryNew = (() => {
    const seen = new Set();
    return [...dictionaryLegacy, ...parseDict(EXTRA_RAW)].filter((e) => !seen.has(e.w) && seen.add(e.w));
  })();
  const dictionary = dictionaryNew; // alias historique
  // Dès cette date, grilles du dictionnaire étendu. Avant : ancien dictionnaire, grilles inchangées.
  const NEW_FROM = '2026-10-28';
  // Chaque mot appartient à 1 « famille » ; une seule famille sert chaque jour (rotation) :
  // un mot ne peut donc jamais revenir avant BUCKETS jours.
  const BUCKETS = 4;
  const bucketOf = (w) => hash('b:' + w) % BUCKETS;

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
  const weekday = (d) => new Date(utcDay(d)).getUTCDay();
  const dayNumber = (d) => Math.round((utcDay(d) - utcDay(EPOCH)) / 864e5) + 1;

  function formatTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0');
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  function generate(s, n, dict) {
    const rnd = random(s);
    const b = Array.from({ length: n }, () => Array(n).fill(''));
    const entries = [];
    const pool = dict
      .filter((e) => e.w.length <= n)
      .sort((a, c) => hash(a.w + s) - hash(c.w + s));

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

    function put(e, y, x, d) {
      for (let i = 0; i < e.w.length; i++) b[y + (d === 'V' ? i : 0)][x + (d === 'H' ? i : 0)] = e.w[i];
      entries.push({ ...e, y, x, d });
    }

    const first = pool.find((e) => e.w.length >= 4);
    if (!first) return null;
    put(first, Math.floor(n / 2), Math.floor((n - first.w.length) / 2), 'H');

    for (let pass = 0; pass < 3; pass++) {
      for (const e of pool) {
        if (entries.some((p) => p.w === e.w || clash(p, e))) continue;
        let best = null;
        for (const d of ['H', 'V']) {
          for (let y = 0; y < n; y++) {
            for (let x = 0; x < n; x++) {
              const cross = fit(e.w, y, x, d);
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
  function buildPuzzle(date) {
    const legacy = date < NEW_FROM;
    const seed = hash((legacy ? 'cdj03:' : 'cdj04:') + date);
    const n = SIZE_BY_WEEKDAY[weekday(date)];
    const target = MIN_WORDS[n];
    const bucket = ((dayNumber(date) % BUCKETS) + BUCKETS) % BUCKETS;
    const dict = legacy ? dictionaryLegacy : dictionaryNew.filter((e) => bucketOf(e.w) === bucket);
    let puzzle = null;
    for (let i = 0; i < 150; i++) {
      const p = generate((seed + Math.imul(i + 1, 2654435761)) >>> 0, n, dict);
      if (p && (!puzzle || p.entries.length > puzzle.entries.length)) puzzle = p;
      if (puzzle && puzzle.entries.length >= target) break;
    }
    return puzzle && { ...puzzle, n, seed, date, legacy };
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
  const DEBUG = (() => { try { return localStorage.getItem('cdj:debug') === '1'; } catch { return false; } })();
  const log = (...a) => { if (DEBUG) console.log('[CDJ]', ...a); };

  let date = parisDate();
  let puzzle;
  try {
    puzzle = buildPuzzle(date);
  } catch (err) {
    console.error('[CDJ] Erreur de génération', err);
    return;
  }
  if (!puzzle) { console.warn('[CDJ] Génération impossible'); return; }

  const { b, entries, numbers, n, legacy } = puzzle;
  const dayNum = dayNumber(date);
  const KEY_DAY = `cdj:${legacy ? 'v03' : 'v04'}:${date}`;
  const KEY_STATS = 'cdj:v03:stats'; // clé conservée : les séries existantes continuent

  const entryId = (e) => `${e.d}-${e.num}`;
  const entriesAt = Array.from({ length: n * n }, () => []);
  for (const e of entries) for (const i of e.cells) entriesAt[i].push(e);
  const order = [...entries].sort((a, c) => (a.d === c.d ? a.num - c.num : a.d === 'H' ? -1 : 1));
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
      s.cells = raw.cells.map((c, i) => (isLetter(i) && typeof c === 'string' && /^[A-Z]$/.test(c) ? c : ''));
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
#cdj-launch{--cdj-accent:#6559d8;display:inline-flex;align-items:center;gap:6px;box-sizing:border-box;min-height:34px;margin:0 0 0 12px;padding:6px 12px;border:0;border-radius:8px;background:var(--cdj-accent);color:#fff;font:600 13px/1.2 Arial,sans-serif;letter-spacing:0;text-transform:none;text-shadow:none;white-space:nowrap;vertical-align:middle;cursor:pointer;float:none;position:static}
#cdj-launch:hover{filter:brightness(1.12)}
#cdj-launch:focus-visible{outline:2px solid #fff;outline-offset:2px;box-shadow:0 0 0 4px var(--cdj-accent)}
#cdj-launch.floating{position:fixed;left:12px;bottom:12px;z-index:2147483645;margin:0;box-shadow:0 4px 14px #0006}
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
#cdj-panel .cluebar .cur{flex:1;margin:0;padding:6px 8px;background:#2b2d36;border-radius:6px;min-height:40px;display:flex;align-items:center}
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
#cdj-panel .clues{display:grid;grid-template-columns:1fr 1fr;gap:12px}
#cdj-panel ol{margin:0;padding-left:27px;line-height:1.45}
#cdj-panel li{padding:4px 3px;cursor:pointer;border-radius:4px}
#cdj-panel li.chosen{background:#45406b}
#cdj-panel li.solved{color:#86e5a5;text-decoration:line-through;text-decoration-thickness:2px}
#cdj-panel li.solved::after{content:' ✓';text-decoration:none;display:inline-block}
#cdj-panel .actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}
#cdj-panel .actions button{min-height:40px;background:var(--cdj-accent);color:#fff;border:0;border-radius:6px;padding:9px 12px;cursor:pointer;font:600 13px Arial,sans-serif}
#cdj-panel .actions button:disabled{opacity:.45;cursor:default}
#cdj-panel .status{min-height:22px;margin-top:8px;color:#b8efc5}
#cdj-panel .result{margin-top:8px;padding:10px;border-radius:8px;background:#1f3b2a;color:#d6f5de}
#cdj-panel .fallback{width:100%;min-height:80px;margin-top:6px;background:#111;color:#fff;border:1px solid #666;border-radius:6px;padding:6px;font:13px monospace}
#cdj-panel details{margin-top:8px;color:var(--cdj-muted);font-size:13px}
#cdj-panel summary{cursor:pointer;color:#fff}
#cdj-panel .stats{margin:8px 0 0;font-size:12px;color:var(--cdj-muted)}
#cdj-panel :focus-visible{outline:2px solid #aaa3ff;outline-offset:1px}
#cdj-panel .cell input:focus-visible{outline:0}
@media(max-width:500px){#cdj-panel{left:8px;right:8px;top:8px;width:auto;max-height:calc(100vh - 16px);padding:12px}#cdj-panel .hd{top:-12px;margin:-12px -12px 4px;padding:10px 12px 6px}#cdj-panel .clues{grid-template-columns:1fr}}`;
  if (typeof GM_addStyle === 'function') GM_addStyle(css);
  else { const st = document.createElement('style'); st.textContent = css; document.head.append(st); }

  // ───────────────────────────── DOM ─────────────────────────────
  const launch = document.createElement('button');
  launch.id = 'cdj-launch';
  launch.type = 'button';
  launch.textContent = '🧩 Mots du jour';
  launch.title = 'Ouvrir le défi de mots croisés du jour';
  launch.setAttribute('aria-expanded', 'false');
  launch.setAttribute('aria-controls', 'cdj-panel');

  const panel = document.createElement('section');
  panel.id = 'cdj-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Mots croisés du jour');
  panel.innerHTML = `
<header class="hd"><h2>🧩 Défi du jour</h2><button type="button" class="close" aria-label="Fermer">×</button></header>
<p class="meta"></p>
<div class="bar"><span class="timer" title="Temps actif (panneau ouvert et onglet visible)">⏱ 00:00</span><span class="pen"></span></div>
<div class="banner" role="alert" hidden>Un nouveau défi est disponible. <button type="button" data-a="reload">Recharger la page</button></div>
<div class="cluebar"><button type="button" data-a="prev" aria-label="Définition précédente">‹</button><p class="cur" aria-live="polite"></p><button type="button" data-a="next" aria-label="Définition suivante">›</button></div>
<div class="gridwrap"><div class="grid" role="group" aria-label="Grille de mots croisés"></div></div>
<div class="clues"><section><h3>Horizontalement</h3><ol class="h"></ol></section><section><h3>Verticalement</h3><ol class="v"></ol></section></div>
<div class="actions"><button type="button" data-a="check">Vérifier (+${CHECK_PENALTY} s)</button><button type="button" data-a="hint">Indice (+${HINT_PENALTY} s)</button><button type="button" data-a="share">Partager</button><button type="button" data-a="reset">Effacer mes erreurs</button></div>
<div class="status" role="status" aria-live="polite"></div>
<div class="result" hidden></div>
<details><summary>Règles et calcul du score</summary>
<p>Une seule grille par jour, identique pour tous les joueurs (calculée d'après la date à Paris). Saisissez les lettres au clavier, les accents sont ignorés. Un mot juste se verrouille. Touches : flèches pour se déplacer, Espace ou Entrée pour changer de sens, Échap pour fermer.</p>
<p><strong>Temps final</strong> = temps actif + ${HINT_PENALTY} s par indice + ${CHECK_PENALTY} s par vérification. Plus bas = meilleur. Le chrono ne tourne que si le panneau est ouvert et l'onglet visible.</p>
<p>Votre progression et vos stats sont stockées uniquement dans ce navigateur. Les scores partagés sont déclaratifs : rien ne peut les vérifier sans serveur.</p>
</details>
<p class="stats"></p>`;
  document.body.append(panel);

  const $ = (sel) => panel.querySelector(sel);
  const gridEl = $('.grid'), statusEl = $('.status'), timerEl = $('.timer'), penEl = $('.pen');
  const curEl = $('.cur'), resultEl = $('.result'), statsEl = $('.stats'), bannerEl = $('.banner');
  const diffNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  $('.meta').textContent = `Défi n°${dayNum > 0 ? dayNum : '–'} · ${diffNames[weekday(date)]} ${date} · grille ${n} × ${n} · ${entries.length} mots`;
  gridEl.style.gridTemplateColumns = `repeat(${n},minmax(22px,1fr))`;

  const inputs = Array(n * n).fill(null);
  const boxes = Array(n * n).fill(null);
  const clueItems = new Map();
  let selected = order[0];
  let pendingDir = null;
  let pointerWasFocused = false;
  let currentIdx = -1;

  const dirLabel = (e) => (e.d === 'H' ? 'Horizontalement' : 'Verticalement');

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
    curEl.textContent = `${e.num} ${dirLabel(e)} — ${e.clue} (${e.w.length})`;
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

  const ARROWS = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] };

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
        input.maxLength = 2; // 2 pour pouvoir remplacer une lettre ; seule la dernière est conservée
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
        input.addEventListener('input', () => {
          if (input.readOnly) { input.value = state.cells[i]; return; }
          const v = input.value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '').slice(-1);
          input.value = v;
          state.cells[i] = v;
          touch();
          refreshLocks();
          if (v) {
            const ids = selected.cells;
            const next = ids.slice(ids.indexOf(i) + 1).find((j) => !inputs[j].readOnly);
            if (next !== undefined) inputs[next].focus();
          }
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
    li.addEventListener('click', () => choose(e));
    li.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); choose(e); } });
    clueItems.set(entryId(e), li);
    $(e.d === 'H' ? '.h' : '.v').append(li);
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
    stats.history[date] = { sec: state.finalSeconds, hints: state.hints, checks: state.checks, n };
    const keep = Object.keys(stats.history).sort().slice(-120);
    stats.history = Object.fromEntries(keep.map((d) => [d, stats.history[d]]));
    writeJSON(KEY_STATS, stats);
    touch();
    stopTimer();
    renderResult();
    renderStats();
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
    const { current, best } = computeStreaks(stats.history, date);
    const secs = Object.values(stats.history).map((r) => r.sec);
    statsEl.textContent = secs.length
      ? `Grilles terminées : ${secs.length} · Série : ${current} 🔥 (record ${best}) · Meilleur temps : ${formatTime(Math.min(...secs))}`
      : 'Aucune grille terminée pour l’instant — la série démarre à votre première victoire.';
  }

  function shareText() {
    const head = `🧩 Crossword Daily JVC #${dayNum > 0 ? dayNum : date} · ${date}`;
    if (finished()) {
      const net = Math.floor(state.activeMs / 1000);
      const { current } = computeStreaks(stats.history, date);
      return `${head}\n${n}×${n} · ⏱ ${formatTime(state.finalSeconds)} (net ${formatTime(net)}, ${state.hints} indice(s), ${state.checks} vérif.)\n🔥 Série : ${current}`;
    }
    return `${head}\n${n}×${n} · en cours : ${solvedSet().size}/${entries.length} mots · ⏱ ${formatTime(scoreSeconds())}`;
  }

  function renderResult() {
    if (!finished()) { resultEl.hidden = true; return; }
    const net = Math.floor(state.activeMs / 1000);
    resultEl.hidden = false;
    resultEl.textContent = `Terminé en ${formatTime(state.finalSeconds)} : ${formatTime(net)} de jeu + ${state.hints * HINT_PENALTY + state.checks * CHECK_PENALTY} s de pénalités. Revenez demain pour le défi n°${dayNum + 1}.`;
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
    if (parisDate() !== date) bannerEl.hidden = false;
  }

  function syncFromStorage() {
    const raw = readJSON(KEY_DAY);
    if (raw && Number.isFinite(raw.rev) && raw.rev > state.rev) { state = sanitize(raw); applyStateToUI(); }
    stats = loadStats();
    renderStats();
  }

  // ───────────────────────────── Actions ─────────────────────────────
  let resetArmed = null;
  const say = (msg) => { statusEl.textContent = msg; };

  function removeFallback() { panel.querySelectorAll('.fallback').forEach((el) => el.remove()); }

  panel.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('[data-a]');
    if (!btn) return;
    const a = btn.dataset.a;
    removeFallback();
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

  // ───────────────────────────── Ouverture / fermeture ─────────────────────────────
  function open(v) {
    panel.hidden = !v;
    launch.setAttribute('aria-expanded', String(v));
    if (v) {
      checkRollover();
      syncFromStorage();
      if (!storageOk) say('Stockage local indisponible : votre progression ne sera pas sauvegardée.');
      choose(selected);
      panel.scrollTop = 0;
      startTimer();
    } else {
      stopTimer();
      launch.focus();
    }
  }
  launch.addEventListener('click', () => open(panel.hidden));
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

  // ───────────────────────────── Intégration au titre du forum ─────────────────────────────
  const t0 = Date.now();
  const titleText = (el) => {
    let t = '';
    el.childNodes.forEach((nd) => { if (nd !== launch) t += nd.textContent; });
    return t.replace(/\s+/g, ' ').trim();
  };
  function findTitle() {
    const cands = [...document.querySelectorAll('h1,h2,[role="heading"]')]
      .filter((el) => !el.closest('#cdj-panel') && el.getClientRects().length > 0 && /^Forum\s+\S/i.test(titleText(el)));
    return cands.find((el) => el.tagName === 'H1') || cands[0] || null;
  }
  function attach() {
    const t = findTitle();
    if (!t) return false;
    launch.classList.remove('floating');
    if (launch.parentElement !== t) t.appendChild(launch);
    log('bouton ancré sur', t);
    return true;
  }
  // Dernier recours (uniquement sur une liste de sujets) si le titre n'est pas trouvé : bouton flottant.
  function floatFallback() {
    if (launch.isConnected || Date.now() - t0 < 8000 || !/^\/forums\/0-/.test(location.pathname)) return;
    launch.classList.add('floating');
    document.body.append(launch);
    console.warn('[CDJ] Titre du forum introuvable : bouton flottant utilisé.');
  }
  function ensure() {
    if (!panel.isConnected && document.body) document.body.append(panel);
    if (launch.isConnected && !launch.classList.contains('floating')) return;
    if (!attach()) floatFallback();
  }
  let raf = 0;
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; ensure(); }); };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  setTimeout(ensure, 8200);

  // ───────────────────────────── Démarrage ─────────────────────────────
  choose(selected, { focus: false });
  refreshLocks();
  renderTimer(); renderPenalties(); renderResult(); renderStats();
  ensure();
  log('prêt', { date, n, mots: entries.length, version: VERSION });
})();

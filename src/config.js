"use strict";

// Les constantes du jeu.
//
// Une zone vaut exactement un écran : ZONE_W x ZONE_H est donc aussi la
// résolution interne du jeu. Tout le reste en est dérivé, y compris les murs
// et les portes. Les chiffres d'équilibrage sont regroupés en bas : ce sont
// eux qu'on ajuste après avoir joué.

// La largeur d'une zone s'adapte à l'écran, pour le remplir sans bandes sur
// les côtés : la hauteur est fixe (26 tuiles), la largeur suit les
// proportions de l'espace disponible, mesurées au lancement. Les décors sont
// dessinés pour la largeur de base, DESIGN_W, et centrés (voir zones.js) :
// un écran plus large a simplement plus de sol sur les côtés.
const SCREEN_W = (() => {
  const DESIGN_W = 192, H = 416, MAX_W = 288;
  const stage = document.getElementById("stage");
  const box = stage ? stage.getBoundingClientRect() : null;
  if (!box || !box.width || !box.height) return DESIGN_W;
  const w = Math.round((H * box.width) / box.height / 2) * 2;
  return Math.min(MAX_W, Math.max(DESIGN_W, w));
})();

const Config = Object.freeze({
  TILE: 16,

  // 26 tuiles de 16 px de haut ; la largeur vaut au moins 12 tuiles (192 px,
  // un ratio 9:19.5 d'iPhone), davantage sur un écran plus large.
  DESIGN_W: 192,
  ZONE_H_TILES: 26,
  ZONE_W: SCREEN_W,
  get ZONE_H() { return this.ZONE_H_TILES * this.TILE; },

  // Épaisseur du mur qui ceinture une zone, et largeur de la porte centrale
  // percée dans chaque côté qui a une voisine.
  get WALL() { return this.TILE; },
  get DOOR() { return this.TILE * 4; },

  // De combien de pixels le joueur est posé à l'intérieur de la nouvelle zone
  // après avoir franchi un bord.
  ENTRY_MARGIN: 8,

  // La physique tourne à pas fixe, indépendamment de la fréquence de l'écran
  // (60 Hz sur PC, jusqu'à 120 Hz sur un iPhone récent).
  STEP: 1 / 60,

  // --- Joueur ---
  // En pixels par seconde : la largeur d'une zone se traverse en un peu plus
  // de deux secondes.
  PLAYER_SPEED: 90,
  PLAYER_SIZE: 12,
  PLAYER_HP: 3,
  // Après un coup, le joueur est intouchable le temps de s'enfuir.
  HURT_INVULN: 1.2,
  HURT_KNOCKBACK: 16,
  // Les réglages de chaque arme et de chaque artefact sont dans items.js.

  // --- Carte ---
  // Une nouvelle carte à chaque expédition : MAP_ZONES écrans qui poussent
  // depuis le camp de base, au centre d'une grille de MAP_SIZE x MAP_SIZE.
  MAP_SIZE: 7,
  MAP_ZONES: 26,
  // Chance d'ouvrir une porte de plus entre deux écrans voisins déjà reliés
  // par un autre chemin : 0 donne un pur labyrinthe, 1 une grille ouverte.
  MAP_LOOP_CHANCE: 0.22,
  // Profondeur maximale d'une carte, en écrans depuis le camp de base. Au-delà,
  // la carte est retirée : la valeur des gemmes double à chaque écran, et un
  // long couloir la ferait exploser.
  MAP_MAX_DISTANCE: 9,

  // --- Stop ou encore ---
  // Une gemme vaut GEM_BASE x (1 + distance) : 2, 3, 4... La distance est le
  // nombre d'écrans à traverser depuis le camp de base, par le plus court
  // chemin. (Elle doublait à chaque écran : une bonne partie rapportait
  // 4 000 gemmes et vidait l'atelier d'un coup.)
  GEM_BASE: 1,
  // Les modes de difficulté, choisis avant chaque expédition : ce que vaut
  // une gemme, et la part du butin porté sauvée à la mort.
  MODES: {
    easy: { name: "facile", gems: 0.5, keep: 1 },
    normal: { name: "normal", gems: 1, keep: 0.25 },
    hard: { name: "difficile", gems: 1.5, keep: 0 },
  },
  GEM_SIZE: 8,
  // À quelle distance du feu de camp le butin est mis à l'abri.
  CAMP_RADIUS: 20,
  // À quelle distance du portail du camp de base on part pour une nouvelle
  // expédition.
  PORTAL_RADIUS: 10,

  // --- Ennemis ---
  // Leur nombre par zone, indexé par la distance au camp de base (au-delà,
  // la dernière valeur).
  ENEMIES_BY_DISTANCE: [0, 1, 1, 2, 2, 3, 3, 4],
  // Toujours plus lents que le joueur : on peut fuir, pas flâner.
  ENEMY_SPEED: 42,
  ENEMY_SPEED_PER_DISTANCE: 5,
  // Temps de réveil à l'entrée dans une zone, pour ne pas être touché avant
  // d'avoir vu l'ennemi.
  ENEMY_WAKE: 0.6,
  // Un ennemi n'apparaît jamais plus près que ça du joueur qui entre.
  SPAWN_SAFE_DISTANCE: 90,

  // Les rôdeurs (fantômes de Pac-Man, impossibles à tuer) : à partir de quelle
  // distance, avec quelle chance par salle, et combien de temps la
  // super-gemme les rend bleus.
  PROWLER_FROM: 2,
  PROWLER_CHANCE: 0.1,
  PROWLER_CHANCE_PER_DISTANCE: 0.06,
  PROWLER_CHANCE_MAX: 0.65,
  FRIGHT_TIME: 6,
  // Un point de vie de plus tous les ENEMY_HP_EVERY écrans de distance.
  ENEMY_HP_EVERY: 3,
  // Touché, un ennemi est repoussé et reste étourdi, donc inoffensif, un
  // court instant.
  ENEMY_KNOCKBACK: 20,
  ENEMY_STUN: 0.4,

  // --- Menace ---
  // Plus on reste dans le donjon, plus il devient dangereux. La menace est le
  // temps passé hors du camp de base, en secondes ; elle monte d'un palier
  // toutes les THREAT_STEP secondes, jusqu'à THREAT_MAX.
  THREAT_STEP: 90,
  THREAT_MAX: 5,
  // Par palier : ennemis en plus par zone (pour 2 paliers, 1 de plus), et
  // vitesse ajoutée.
  THREAT_EXTRA_ENEMY_EVERY: 2,
  THREAT_SPEED: 4,
  // Chance qu'un ennemi soit une élite, par palier (plafonnée), et ce que ça
  // change : points de vie doublés plus un, vitesse, et un objet lâché.
  ELITE_CHANCE: 0.1,
  ELITE_CHANCE_MAX: 0.4,
  ELITE_SPEED: 8,
  // À partir de ce palier, un ennemi tué se relève au bout de REVIVE_TIME
  // secondes de menace.
  REVIVE_LEVEL: 2,
  REVIVE_TIME: 60,
  // Au dernier palier, le Chasseur : invincible, il suit le joueur d'écran
  // en écran et entre HUNTER_DELAY secondes après lui, par la même porte.
  // Il n'entre ni au camp de base ni autour du feu.
  HUNTER_SPEED: 66,
  HUNTER_DELAY: 2.5,
  // Se reposer au camp fait redescendre la menace d'autant de secondes.
  CAMP_THREAT_RELIEF: 60,

  // --- Messages ---
  BANNER_TIME: 2.2,
  DEATH_PAUSE: 2.5,
});

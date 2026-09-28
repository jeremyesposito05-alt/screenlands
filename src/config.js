"use strict";

// Les constantes du jeu.
//
// Une zone vaut exactement un écran : ZONE_W x ZONE_H est donc aussi la
// résolution interne du jeu. Tout le reste en est dérivé, y compris les murs
// et les portes. Les chiffres d'équilibrage sont regroupés en bas : ce sont
// eux qu'on ajuste après avoir joué.

const Config = Object.freeze({
  TILE: 16,

  // 12 x 26 tuiles = 192 x 416 px, soit un ratio 9:19.5 (iPhone portrait
  // moderne). Étroit et haut : c'est la contrainte du format.
  ZONE_W_TILES: 12,
  ZONE_H_TILES: 26,
  get ZONE_W() { return this.ZONE_W_TILES * this.TILE; },
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

  // --- Attaque ---
  // Un coup d'épée devant soi : le joueur s'arrête le temps du coup, puis
  // doit attendre un peu avant le suivant.
  ATTACK_TIME: 0.18,
  ATTACK_COOLDOWN: 0.32,
  // La zone touchée : ATTACK_REACH devant le joueur, ATTACK_WIDTH de large.
  ATTACK_REACH: 14,
  ATTACK_WIDTH: 18,

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
  // Distance minimale, en écrans, d'un camp avancé au camp de base.
  CAMP_MIN_DISTANCE: 3,

  // --- Stop ou encore ---
  // Une gemme vaut GEM_BASE x 2^(distance - 1) : 1, 2, 4, 8... La distance
  // est le nombre d'écrans à traverser depuis le camp de base, par le plus
  // court chemin.
  GEM_BASE: 1,
  GEM_SIZE: 8,
  // À quelle distance du feu de camp le butin est mis à l'abri.
  CAMP_RADIUS: 20,

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
  // Un point de vie de plus tous les ENEMY_HP_EVERY écrans de distance.
  ENEMY_HP_EVERY: 3,
  // Touché, un ennemi est repoussé et reste étourdi, donc inoffensif, un
  // court instant.
  ENEMY_KNOCKBACK: 20,
  ENEMY_STUN: 0.4,

  // --- Messages ---
  BANNER_TIME: 2.2,
  DEATH_PAUSE: 2.5,
});

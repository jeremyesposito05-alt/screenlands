"use strict";

// Les constantes qui définissent la forme du monde.
//
// Une zone vaut exactement un écran : ZONE_W x ZONE_H est donc aussi la
// résolution interne du jeu. Tout le reste en est dérivé, y compris les murs
// et les portes : ce sont les seuls nombres à changer pour essayer une autre
// taille de zone.

const Config = Object.freeze({
  TILE: 16,

  // 12 x 26 tuiles = 192 x 416 px, soit un ratio 9:19.5 (iPhone portrait
  // moderne). Étroit et haut : c'est la contrainte du format.
  ZONE_W_TILES: 12,
  ZONE_H_TILES: 26,
  get ZONE_W() { return this.ZONE_W_TILES * this.TILE; },
  get ZONE_H() { return this.ZONE_H_TILES * this.TILE; },

  // Épaisseur du mur qui ceinture une zone, et largeur de la porte centrale
  // percée dans chacun des quatre côtés.
  get WALL() { return this.TILE; },
  get DOOR() { return this.TILE * 4; },

  // De combien de pixels le joueur est posé à l'intérieur de la nouvelle zone
  // après avoir franchi un bord.
  ENTRY_MARGIN: 8,

  // En pixels par seconde : la largeur d'une zone se traverse en un peu plus
  // de deux secondes.
  PLAYER_SPEED: 90,
  PLAYER_SIZE: 12,

  // La physique tourne à pas fixe, indépendamment de la fréquence de l'écran
  // (60 Hz sur PC, jusqu'à 120 Hz sur un iPhone récent).
  STEP: 1 / 60,
});

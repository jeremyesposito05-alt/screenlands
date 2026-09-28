"use strict";

// Les zones et la carte du monde.
//
// Une zone est une donnée passive : un nom, un fond et des obstacles. Elle ne
// sait pas où elle se trouve dans le monde et ne connaît pas ses voisines.
// Sa ceinture de murs n'est pas décrite ici : elle est calculée depuis Config
// par borderWalls(), pour que toutes les zones aient exactement les mêmes
// portes. World s'appuie sur cette hypothèse pour faire passer le joueur d'un
// écran à l'autre : il ressort du côté opposé en gardant son autre
// coordonnée, ce qui ne tombe dans une porte que si les portes se font face.
//
// Chaque élément porte un `kind` : c'est lui que le rendu lira pour choisir
// un sprite quand les graphismes remplaceront les rectangles.

// Un bloc plein de 2 x 2 tuiles, posé par son centre.
function obstacle(cx, cy) {
  const s = Config.TILE * 2;
  return { kind: "rock", x: cx - s / 2, y: cy - s / 2, w: s, h: s };
}

const ZONES = {
  clearing: {
    name: "Clairière",
    ground: "#161d1b",
    obstacles: [obstacle(48, 96), obstacle(144, 320)],
  },
  rocks: {
    name: "Rochers",
    ground: "#1d1c1f",
    obstacles: [
      obstacle(48, 80), obstacle(144, 80), obstacle(96, 144),
      obstacle(48, 336), obstacle(144, 336),
    ],
  },
  corridor: {
    name: "Couloir",
    ground: "#141821",
    obstacles: [
      obstacle(64, 128), obstacle(96, 128), obstacle(128, 128),
      obstacle(64, 288), obstacle(96, 288), obstacle(128, 288),
    ],
  },
  pillars: {
    name: "Piliers",
    ground: "#211b19",
    obstacles: [
      obstacle(48, 128), obstacle(144, 128),
      obstacle(48, 288), obstacle(144, 288),
    ],
  },
};

// La carte : quelle zone se trouve à quelles coordonnées.
//
// Écrite à la main pour le prototype, avec une grille 2 x 2 qui suffit à
// valider les quatre directions de transition. C'est le point d'entrée unique
// de la génération à venir : un tirage de zones prédéfinies remplacera ce
// tableau, sans que World ait à changer, tant que has() et get() répondent.
const ZoneRegistry = {
  _map: {
    "0,0": "clearing",
    "1,0": "rocks",
    "0,1": "corridor",
    "1,1": "pillars",
  },

  has(cx, cy) {
    return `${cx},${cy}` in this._map;
  },

  get(cx, cy) {
    return ZONES[this._map[`${cx},${cy}`]];
  },
};

// Les huit segments de mur d'une zone : deux par côté, de part et d'autre de
// la porte. Ils sont à l'intérieur de l'écran, sur l'anneau de tuiles du bord,
// pour que le joueur voie où sont les sorties.
function borderWalls() {
  const W = Config.ZONE_W, H = Config.ZONE_H;
  const t = Config.WALL, door = Config.DOOR;
  const sideX = (W - door) / 2;
  const sideY = (H - door) / 2;
  const wall = (x, y, w, h) => ({ kind: "wall", x, y, w, h });

  // Les segments horizontaux s'arrêtent à l'épaisseur du mur pour ne pas
  // recouvrir les coins, que les segments verticaux couvrent déjà.
  return [
    wall(t, 0, sideX - t, t),
    wall(sideX + door, 0, sideX - t, t),
    wall(t, H - t, sideX - t, t),
    wall(sideX + door, H - t, sideX - t, t),
    wall(0, 0, t, sideY),
    wall(0, sideY + door, t, sideY),
    wall(W - t, 0, t, sideY),
    wall(W - t, sideY + door, t, sideY),
  ];
}

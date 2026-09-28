"use strict";

// Les zones et la carte du monde.
//
// Une zone est une donnée passive : un décor (fond, obstacles) et des
// emplacements (gemmes, apparitions d'ennemis, feu de camp). Elle ne sait pas
// où elle se trouve dans le monde. Combien d'ennemis apparaissent et ce que
// vaut une gemme dépendent de la distance au camp de base, et c'est World
// qui en décide.
//
// Sa ceinture de murs n'est pas décrite ici : elle est calculée par
// borderWalls(), pour que toutes les portes soient au même endroit. World
// fait ressortir le joueur du côté opposé en gardant son autre coordonnée,
// ce qui ne tombe dans une porte que si les portes se font face.
//
// Chaque élément porte un `kind` : c'est lui que le rendu lira pour choisir
// un sprite quand les graphismes remplaceront les rectangles.

// Un bloc plein de 2 x 2 tuiles, posé par son centre.
function obstacle(cx, cy) {
  const s = Config.TILE * 2;
  return { kind: "rock", x: cx - s / 2, y: cy - s / 2, w: s, h: s };
}

const p = (x, y) => ({ x, y });

const LAYOUTS = {
  clearing: {
    name: "Clairière",
    ground: "#161d1b",
    obstacles: [obstacle(48, 96), obstacle(144, 320)],
    gems: [p(144, 112), p(48, 300), p(96, 250)],
    spawns: [p(48, 200), p(144, 200), p(96, 60), p(96, 360)],
  },
  rocks: {
    name: "Rochers",
    ground: "#1d1c1f",
    obstacles: [
      obstacle(48, 80), obstacle(144, 80), obstacle(96, 144),
      obstacle(48, 336), obstacle(144, 336),
    ],
    gems: [p(96, 80), p(96, 336), p(152, 208)],
    spawns: [p(40, 150), p(152, 150), p(40, 270), p(152, 270)],
  },
  corridor: {
    name: "Couloir",
    ground: "#141821",
    obstacles: [
      obstacle(64, 128), obstacle(96, 128), obstacle(128, 128),
      obstacle(64, 288), obstacle(96, 288), obstacle(128, 288),
    ],
    gems: [p(96, 208), p(32, 128), p(160, 288)],
    spawns: [p(96, 60), p(96, 360), p(40, 208), p(152, 208)],
  },
  pillars: {
    name: "Piliers",
    ground: "#211b19",
    obstacles: [
      obstacle(48, 128), obstacle(144, 128),
      obstacle(48, 288), obstacle(144, 288),
    ],
    gems: [p(96, 128), p(96, 288), p(48, 208)],
    spawns: [p(144, 208), p(48, 60), p(144, 360), p(40, 360)],
  },
  // Un camp : pas d'obstacle, pas d'ennemi, un feu au centre. S'en approcher
  // met le butin à l'abri et soigne.
  camp: {
    name: "Camp avancé",
    ground: "#221c14",
    camp: true,
    obstacles: [],
    gems: [],
    spawns: [],
    fire: p(96, 208),
  },
  base: {
    name: "Camp de base",
    ground: "#221c14",
    camp: true,
    // Y rentrer termine l'expédition : les gemmes réapparaissent partout.
    base: true,
    obstacles: [],
    gems: [],
    spawns: [],
    fire: p(96, 208),
  },
};

// La carte : quelle zone se trouve à quelles coordonnées.
//
// Écrite à la main pour le prototype : une grille 5 x 5, le camp de base au
// centre, deux camps avancés dans les coins, au plus loin. C'est le point
// d'entrée unique de la génération à venir : un tirage de zones prédéfinies
// remplacera ce tableau sans que World ait à changer, tant que ces méthodes
// répondent.
const ZoneRegistry = (() => {
  const GRID = [
    ["camp",     "rocks",    "corridor", "pillars",  "clearing"],
    ["pillars",  "clearing", "rocks",    "corridor", "rocks"],
    ["corridor", "rocks",    "base",     "clearing", "pillars"],
    ["clearing", "corridor", "pillars",  "rocks",    "corridor"],
    ["rocks",    "pillars",  "clearing", "corridor", "camp"],
  ];
  const BASE = { x: 2, y: 2 };

  function has(cx, cy) {
    return cy >= 0 && cy < GRID.length && cx >= 0 && cx < GRID[cy].length;
  }

  return {
    base: BASE,
    width: GRID[0].length,
    height: GRID.length,
    has,
    get(cx, cy) {
      return LAYOUTS[GRID[cy][cx]];
    },
    // Distance en écrans depuis le camp de base : c'est elle qui fixe la
    // valeur des gemmes et le nombre d'ennemis.
    distance(cx, cy) {
      return Math.abs(cx - BASE.x) + Math.abs(cy - BASE.y);
    },
    // Les côtés de la zone qui donnent sur une voisine, et ont donc une porte.
    exits(cx, cy) {
      return {
        left: has(cx - 1, cy), right: has(cx + 1, cy),
        up: has(cx, cy - 1), down: has(cx, cy + 1),
      };
    },
  };
})();

// Les segments de mur d'une zone : deux par côté, de part et d'autre de la
// porte, plus un bouchon quand le côté n'a pas de voisine. Ils sont à
// l'intérieur de l'écran, sur l'anneau de tuiles du bord, pour que le joueur
// voie où sont les sorties.
function borderWalls(exits) {
  const W = Config.ZONE_W, H = Config.ZONE_H;
  const t = Config.WALL, door = Config.DOOR;
  const sideX = (W - door) / 2;
  const sideY = (H - door) / 2;
  const wall = (x, y, w, h) => ({ kind: "wall", x, y, w, h });

  // Les segments horizontaux s'arrêtent à l'épaisseur du mur pour ne pas
  // recouvrir les coins, que les segments verticaux couvrent déjà.
  const walls = [
    wall(t, 0, sideX - t, t),
    wall(sideX + door, 0, sideX - t, t),
    wall(t, H - t, sideX - t, t),
    wall(sideX + door, H - t, sideX - t, t),
    wall(0, 0, t, sideY),
    wall(0, sideY + door, t, sideY),
    wall(W - t, 0, t, sideY),
    wall(W - t, sideY + door, t, sideY),
  ];
  if (!exits.up) walls.push(wall(sideX, 0, door, t));
  if (!exits.down) walls.push(wall(sideX, H - t, door, t));
  if (!exits.left) walls.push(wall(0, sideY, t, door));
  if (!exits.right) walls.push(wall(W - t, sideY, t, door));
  return walls;
}

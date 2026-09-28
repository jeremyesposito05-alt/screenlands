"use strict";

// Les zones et la carte du monde.
//
// Une zone est une donnée passive : un décor (fond, obstacles) et des
// emplacements (gemmes, apparitions d'ennemis, coffre, feu de camp). Elle ne
// sait pas où elle se trouve dans le monde. Combien d'ennemis apparaissent et
// ce que vaut une gemme dépendent de la distance au camp de base, et c'est
// World qui en décide.
//
// Sa ceinture de murs n'est pas décrite ici : elle est calculée par
// borderWalls(), pour que toutes les portes soient au même endroit. World
// fait ressortir le joueur du côté opposé en gardant son autre coordonnée,
// ce qui ne tombe dans une porte que si les portes se font face.
//
// Règles pour qui dessine une zone :
// - depuis chacune des quatre portes, on doit pouvoir atteindre les trois
//   autres, toutes les gemmes, la cachette du coffre (`chest`) et
//   l'emplacement du feu (`fire`) ;
// - le coffre va dans un recoin, jamais en haut à droite ni en bas à droite :
//   la mini-carte et le bouton d'attaque le cacheraient.
// Le test des décors vérifie tout cela pour chaque zone.
//
// Chaque élément porte un `kind` : c'est lui que le rendu lira pour choisir
// un sprite quand les graphismes remplaceront les rectangles.

// Un bloc plein, posé par son centre ; 2 x 2 tuiles par défaut.
function obstacle(cx, cy, size = Config.TILE * 2) {
  return { kind: "rock", x: cx - size / 2, y: cy - size / 2, w: size, h: size };
}

// Un mur intérieur rectangulaire, posé par son coin.
function block(x, y, w, h) {
  return { kind: "rock", x, y, w, h };
}

const p = (x, y) => ({ x, y });

// `minDistance` : une zone n'apparaît pas plus près du camp de base, pour
// réserver les décors les plus piégeux au loin. `fire` : où s'allume le feu
// quand le camp s'installe dans cette zone.
const LAYOUTS = {
  clearing: {
    name: "Clairière",
    ground: "#161d1b",
    minDistance: 1,
    obstacles: [obstacle(48, 96), obstacle(144, 320)],
    gems: [p(144, 112), p(48, 300), p(96, 250)],
    spawns: [p(48, 200), p(144, 200), p(96, 60), p(96, 360)],
    chest: p(40, 40),
    fire: p(96, 190),
  },
  rocks: {
    name: "Rochers",
    ground: "#1d1c1f",
    minDistance: 1,
    obstacles: [
      obstacle(48, 80), obstacle(144, 80), obstacle(96, 144),
      obstacle(48, 336), obstacle(144, 336),
    ],
    gems: [p(96, 80), p(96, 336), p(152, 208)],
    spawns: [p(40, 150), p(152, 150), p(40, 270), p(152, 270)],
    chest: p(96, 178),
    fire: p(96, 240),
  },
  corridor: {
    name: "Couloir",
    ground: "#141821",
    minDistance: 1,
    obstacles: [
      obstacle(64, 128), obstacle(96, 128), obstacle(128, 128),
      obstacle(64, 288), obstacle(96, 288), obstacle(128, 288),
    ],
    gems: [p(96, 208), p(32, 128), p(160, 288)],
    spawns: [p(96, 60), p(96, 360), p(40, 208), p(152, 208)],
    chest: p(160, 128),
    fire: p(60, 208),
  },
  pillars: {
    name: "Piliers",
    ground: "#211b19",
    minDistance: 1,
    obstacles: [
      obstacle(48, 128), obstacle(144, 128),
      obstacle(48, 288), obstacle(144, 288),
    ],
    gems: [p(96, 128), p(96, 288), p(48, 208)],
    spawns: [p(144, 208), p(48, 60), p(144, 360), p(40, 360)],
    chest: p(40, 40),
    fire: p(96, 208),
  },
  // Deux murs en travers, chacun percé d'un seul passage au centre : pour
  // traverser de haut en bas, on ne peut pas éviter ce qui s'y trouve. Le
  // couloir des portes latérales, entre les deux, reste libre.
  narrows: {
    name: "Étranglement",
    ground: "#1a1a22",
    minDistance: 2,
    obstacles: [
      block(16, 128, 64, 24), block(112, 128, 64, 24),
      block(16, 264, 64, 24), block(112, 264, 64, 24),
    ],
    gems: [p(40, 90), p(152, 330), p(96, 208)],
    spawns: [p(40, 60), p(152, 60), p(40, 360), p(152, 360)],
    chest: p(152, 90),
    fire: p(56, 208),
  },
  // Un bloc central et quatre autour : on circule par les bords.
  crossing: {
    name: "Croisée",
    ground: "#1b1e1a",
    minDistance: 2,
    obstacles: [
      obstacle(56, 150), obstacle(136, 150), obstacle(96, 208),
      obstacle(56, 266), obstacle(136, 266),
    ],
    gems: [p(96, 150), p(96, 266), p(28, 208)],
    spawns: [p(40, 60), p(152, 60), p(40, 360), p(152, 360)],
    chest: p(30, 40),
    fire: p(96, 96),
  },
  // Des pierres d'une tuile éparpillées : beaucoup de recoins pour se faire
  // coincer.
  ruins: {
    name: "Ruines",
    ground: "#1f1b20",
    minDistance: 3,
    obstacles: [
      obstacle(40, 72, 16), obstacle(120, 88, 16), obstacle(72, 152, 16),
      obstacle(152, 176, 16), obstacle(40, 248, 16), obstacle(104, 280, 16),
      obstacle(152, 336, 16), obstacle(64, 360, 16),
    ],
    gems: [p(40, 120), p(152, 240), p(96, 208)],
    spawns: [p(96, 60), p(40, 300), p(152, 120), p(120, 380)],
    chest: p(40, 390),
    fire: p(120, 210),
  },
  // Le point de départ : pas d'ennemi, pas de feu, un portail pour lancer une
  // nouvelle expédition quand on le décide. Le portail est hors des couloirs
  // des portes, pour qu'on ne le prenne pas par mégarde en traversant.
  base: {
    name: "Camp de base",
    ground: "#221c14",
    safe: true,
    obstacles: [],
    gems: [],
    spawns: [],
    portal: p(40, 100),
  },
};

// Les zones que le générateur peut tirer pour un écran ordinaire.
const WILD_LAYOUTS = Object.keys(LAYOUTS).filter((k) => !LAYOUTS[k].safe);

// La carte : quelle zone se trouve à quelles coordonnées, quelles portes la
// relient à ses voisines, et où brûle le camp.
//
// Elle ne fabrique rien : elle sert la carte que Generator lui a confiée par
// load(). World ne connaît de la carte que ces méthodes, et ne sait donc pas
// si elle a été écrite à la main ou tirée au sort.
const ZoneRegistry = (() => {
  let map = null;
  const key = (cx, cy) => `${cx},${cy}`;
  const cell = (cx, cy) => map.cells.get(key(cx, cy));

  return {
    load(m) { map = m; },
    get map() { return map; },
    get seed() { return map.seed; },
    get base() { return map.base; },
    get width() { return map.size; },
    get height() { return map.size; },
    has(cx, cy) { return map.cells.has(key(cx, cy)); },
    get(cx, cy) { return LAYOUTS[cell(cx, cy).layout]; },
    // Nombre d'écrans à traverser depuis le camp de base, par le plus court
    // chemin : c'est lui qui fixe la valeur des gemmes et le danger.
    distance(cx, cy) { return cell(cx, cy).distance; },
    // Les côtés de la zone qui ont une porte vers une voisine.
    exits(cx, cy) { return cell(cx, cy).links; },
    // L'objet caché dans le coffre de cet écran, ou null.
    chest(cx, cy) { return cell(cx, cy).chest; },
    // Le camp brûle-t-il dans cet écran ? Il n'y en a qu'un à la fois.
    isCamp(cx, cy) { return !!map.camp && map.camp.x === cx && map.camp.y === cy; },
    get camp() { return map.camp; },
    // Tous les écrans, pour la mini-carte.
    cells() { return map.cells.values(); },
  };
})();

// Les segments de mur d'une zone : deux par côté, de part et d'autre de la
// porte, plus un bouchon quand le côté n'a pas de porte. Ils sont à
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

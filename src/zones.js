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

// Les décors sont dessinés pour une zone de DESIGN_W de large ; sur un écran
// plus large, ils sont centrés, et le sol s'étend de part et d'autre. Toutes
// les coordonnées ci-dessous passent par ces trois aides, qui ajoutent le
// décalage.
const LAYOUT_OX = (Config.ZONE_W - Config.DESIGN_W) / 2;

// Un bloc plein, posé par son centre ; 2 x 2 tuiles par défaut.
function obstacle(cx, cy, size = Config.TILE * 2) {
  return { kind: "rock", x: cx + LAYOUT_OX - size / 2, y: cy - size / 2, w: size, h: size };
}

// Un mur intérieur rectangulaire, posé par son coin.
function block(x, y, w, h) {
  return { kind: "rock", x: x + LAYOUT_OX, y, w, h };
}

const p = (x, y) => ({ x: x + LAYOUT_OX, y });

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
  // L'arrivée d'un étage inférieur : l'escalier qui remonte, sans ennemi ni
  // feu. On y souffle un instant avant d'explorer.
  landing: {
    name: "Palier",
    ground: "#1c1a22",
    safe: true,
    obstacles: [],
    gems: [],
    spawns: [],
    stairsUp: p(96, 150),
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
    // Les portes de la zone vers ses voisines : {left, right, up, down},
    // chacune false ou sa position 1, 2, 3 (voir borderWalls).
    exits(cx, cy) { return cell(cx, cy).links; },
    // Un esprit errant attend-il dans cet écran ?
    spirit(cx, cy) { return !!cell(cx, cy).spirit; },
    // Le coffre de cet écran, {tier, item}, ou null.
    chest(cx, cy) { return cell(cx, cy).chest; },
    // Le camp brûle-t-il dans cet écran ? Il n'y en a qu'un à la fois.
    isCamp(cx, cy) { return !!map.camp && map.camp.x === cx && map.camp.y === cy; },
    get camp() { return map.camp; },
    // L'étage de cette carte (1 en surface), et l'écran de l'escalier qui
    // descend : celui du Gardien.
    get floor() { return map.floor || 1; },
    get stairs() { return map.stairs; },
    isStairs(cx, cy) { return !!map.stairs && map.stairs.x === cx && map.stairs.y === cy; },
    // L'écran du Gardien, le mini-boss du bout de la carte.
    get boss() { return map.boss; },
    isBoss(cx, cy) { return !!map.boss && map.boss.x === cx && map.boss.y === cy; },
    // Tous les écrans, pour la mini-carte.
    cells() { return map.cells.values(); },
  };
})();

// --- Les portes ---
// Chaque côté d'une zone peut avoir une porte, à l'une de trois positions :
// 1, 2 ou 3. Sur les murs de gauche et de droite, c'est le tiers haut, le
// centre ou le tiers bas ; sur les murs du haut et du bas, la gauche, le
// centre ou la droite. Une porte vaut donc false (pas de porte) ou 1, 2, 3,
// jamais 0, pour que « y a-t-il une porte ? » reste un simple test.
//
// Deux zones voisines partagent la même position pour leur porte commune :
// sortir par le tiers haut du mur de droite fait entrer par le tiers haut du
// mur de gauche, à la même hauteur. C'est Generator qui choisit, parmi les
// positions que les deux décors acceptent (voir doorSlots).
const DOOR_SLOTS = [1, 2, 3];
// Écart d'une position à l'autre : de quoi décaler franchement la porte en
// gardant un bout de mur de chaque côté.
const DOOR_STEP_V = 96;
const DOOR_STEP_H = 40;

// Le centre de la porte de ce côté, à cette position, sur le bord de l'écran.
function doorCenter(side, slot) {
  const W = Config.ZONE_W, H = Config.ZONE_H;
  if (side === "left" || side === "right") {
    return { x: side === "left" ? 0 : W, y: H / 2 + (slot - 2) * DOOR_STEP_V };
  }
  return { x: W / 2 + (slot - 2) * DOOR_STEP_H, y: side === "up" ? 0 : H };
}

// Les segments de mur d'une zone, percés d'une porte là où `exits` en
// indique une ({left, right, up, down} : false ou 1, 2, 3). Ils sont à
// l'intérieur de l'écran, sur l'anneau de tuiles du bord, pour que le joueur
// voie où sont les sorties.
function borderWalls(exits) {
  const W = Config.ZONE_W, H = Config.ZONE_H;
  const t = Config.WALL, half = Config.DOOR / 2;
  const wall = (x, y, w, h) => ({ kind: "wall", x, y, w, h });
  const walls = [];

  // Les côtés verticaux couvrent toute la hauteur, coins compris ; les
  // horizontaux s'arrêtent à l'épaisseur du mur pour ne pas les recouvrir.
  for (const side of ["left", "right"]) {
    const x = side === "left" ? 0 : W - t;
    const slot = exits[side];
    if (!slot) {
      walls.push(wall(x, 0, t, H));
      continue;
    }
    const cy = doorCenter(side, slot).y;
    walls.push(wall(x, 0, t, cy - half), wall(x, cy + half, t, H - cy - half));
  }
  for (const side of ["up", "down"]) {
    const y = side === "up" ? 0 : H - t;
    const slot = exits[side];
    if (!slot) {
      walls.push(wall(t, y, W - 2 * t, t));
      continue;
    }
    const cx = doorCenter(side, slot).x;
    walls.push(wall(t, y, cx - half - t, t), wall(cx + half, y, W - t - cx - half, t));
  }
  return walls;
}

// Les positions de porte praticables pour ce décor, côté par côté :
// {left: [1, 2], right: [2, 3], ...}. Calculées une fois pour toutes plutôt
// que déclarées à la main : un décor ajouté plus tard est pris en compte
// tout seul.
//
// Une position est praticable si l'on peut entrer tout droit sur trois
// tuiles sans heurter d'obstacle, et rejoindre de là le cœur du décor : la
// région où se trouvent gemmes, coffre et feu.
const doorSlots = (() => {
  const cache = new Map();
  const STEP = 4;

  function compute(layout) {
    const W = Config.ZONE_W, H = Config.ZONE_H;
    const half = Config.PLAYER_SIZE / 2, t = Config.WALL;
    const free = (x, y) =>
      x - half >= t && x + half <= W - t && y - half >= t && y + half <= H - t &&
      !layout.obstacles.some((s) => Physics.overlapsRect({ x, y, size: Config.PLAYER_SIZE }, s));
    const snap = (v) => Math.round(v / STEP) * STEP;

    // Le cœur du décor : ce qu'on peut atteindre depuis le feu, le premier
    // point d'intérêt, ou à défaut le centre.
    const anchors = [layout.fire, ...layout.gems, layout.chest].filter(Boolean);
    const start = anchors.map((a) => ({ x: snap(a.x), y: snap(a.y) })).find((a) => free(a.x, a.y)) ||
                  { x: snap(W / 2), y: snap(H / 2) };
    const seen = new Set([`${start.x},${start.y}`]);
    const queue = [start];
    for (let i = 0; i < queue.length; i++) {
      const { x, y } = queue[i];
      for (const [dx, dy] of [[STEP, 0], [-STEP, 0], [0, STEP], [0, -STEP]]) {
        const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
        if (seen.has(k) || !free(nx, ny)) continue;
        seen.add(k);
        queue.push({ x: nx, y: ny });
      }
    }
    const reached = (x, y) => seen.has(`${snap(x)},${snap(y)}`);

    const out = {};
    // Au camp de base, les portes restent au centre : une porte décalée ferait
    // passer le joueur trop près du portail.
    if (layout.safe) return { left: [2], right: [2], up: [2], down: [2] };
    for (const side of ["left", "right", "up", "down"]) {
      out[side] = DOOR_SLOTS.filter((slot) => {
        const c = doorCenter(side, slot);
        const inward = { left: [1, 0], right: [-1, 0], up: [0, 1], down: [0, -1] }[side];
        const lane = [1, 2, 3].map((k) => ({
          x: c.x + inward[0] * (t + half + (k - 1) * Config.TILE),
          y: c.y + inward[1] * (t + half + (k - 1) * Config.TILE),
        }));
        return lane.every((pt) => free(pt.x, pt.y)) && lane.some((pt) => reached(pt.x, pt.y));
      });
    }
    return out;
  }

  return (key) => {
    if (!cache.has(key)) cache.set(key, compute(LAYOUTS[key]));
    return cache.get(key);
  };
})();

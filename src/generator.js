"use strict";

// Le générateur de cartes : une nouvelle carte à chaque expédition.
//
// Il ne fabrique pas de décor : il assemble des zones prédéfinies (LAYOUTS)
// selon quelques règles, ce qui garde chaque écran jouable à coup sûr tout
// en changeant le chemin à chaque partie.
//
// 1. Croissance : partant du camp de base au centre de la grille, on ajoute
//    des écrans un par un, chacun collé à un écran existant et relié à lui
//    par une porte. On obtient un arbre : un labyrinthe sans boucle.
// 2. Boucles : entre deux écrans voisins pas encore reliés, on ouvre parfois
//    une porte, pour qu'il y ait plus d'un chemin et qu'on puisse fuir.
// 3. Distances : le nombre d'écrans à traverser depuis le camp de base, par
//    le plus court chemin.
// 4. Camps : un camp avancé tout au bout, un autre à mi-chemin, loin du
//    premier.
// 5. Décors : tirés au sort parmi ceux permis à cette distance, en évitant
//    de répéter celui d'un voisin.
// 6. Coffres : une arme de mêlée près du camp de base, une arme à distance
//    plus loin, et des artefacts ailleurs, un coffre au plus par écran.

const Generator = (() => {
  const DIRS = [
    { name: "left", back: "right", dx: -1, dy: 0 },
    { name: "right", back: "left", dx: 1, dy: 0 },
    { name: "up", back: "down", dx: 0, dy: -1 },
    { name: "down", back: "up", dx: 0, dy: 1 },
  ];
  const key = (x, y) => `${x},${y}`;

  // Une carte trop profonde est retirée avec une graine dérivée, pour que la
  // même graine de départ redonne toujours la même carte.
  function generate(seed) {
    let map;
    for (let attempt = 0; attempt < 50; attempt++) {
      map = build(attempt ? deriveSeed(seed, attempt) : seed);
      if (map.depth <= Config.MAP_MAX_DISTANCE) break;
    }
    map.seed = seed;
    return map;
  }

  function build(seed) {
    const rng = makeRandom(seed);
    const size = Config.MAP_SIZE;
    const mid = Math.floor(size / 2);
    const base = { x: mid, y: mid };
    const cells = new Map();

    const add = (x, y) => {
      // `chest` : la clé de l'objet caché dans cet écran, ou null.
      const c = { x, y, layout: null, distance: 0, chest: null,
                  links: { left: false, right: false, up: false, down: false } };
      cells.set(key(x, y), c);
      return c;
    };
    const link = (a, b, d) => {
      a.links[d.name] = true;
      b.links[d.back] = true;
    };
    const inside = (x, y) => x >= 0 && y >= 0 && x < size && y < size;

    // 1. Croissance. Tirer l'écran de départ parmi tous les existants donne
    //    une carte en buisson ; parmi les plus récents, des couloirs. Le
    //    mélange des deux donne des branches longues avec des culs-de-sac.
    const order = [add(base.x, base.y)];
    const target = Math.min(Config.MAP_ZONES, size * size);
    let guard = 0;
    while (cells.size < target && guard++ < 10000) {
      const from = rng.chance(0.6)
        ? order[order.length - 1 - rng.int(Math.min(4, order.length))]
        : rng.pick(order);
      const d = rng.pick(DIRS);
      const x = from.x + d.dx, y = from.y + d.dy;
      if (!inside(x, y) || cells.has(key(x, y))) continue;
      const c = add(x, y);
      link(from, c, d);
      order.push(c);
    }

    // 2. Boucles.
    for (const c of cells.values()) {
      for (const d of DIRS) {
        const n = cells.get(key(c.x + d.dx, c.y + d.dy));
        if (n && !c.links[d.name] && rng.chance(Config.MAP_LOOP_CHANCE / 2)) link(c, n, d);
      }
    }

    // 3. Distances, par parcours en largeur depuis le camp de base.
    const start = cells.get(key(base.x, base.y));
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length) {
      const c = queue.shift();
      for (const d of DIRS) {
        if (!c.links[d.name]) continue;
        const n = cells.get(key(c.x + d.dx, c.y + d.dy));
        if (seen.has(n)) continue;
        n.distance = c.distance + 1;
        seen.add(n);
        queue.push(n);
      }
    }

    // 4. Camps.
    start.layout = "base";
    const wild = [...cells.values()].filter((c) => c !== start);
    const far = Math.max(...wild.map((c) => c.distance));
    const camps = [];
    const farthest = wild.filter((c) => c.distance === far);
    camps.push(rng.pick(farthest));
    const middle = wild.filter((c) =>
      c.distance >= Config.CAMP_MIN_DISTANCE && c.distance < far &&
      Math.abs(c.x - camps[0].x) + Math.abs(c.y - camps[0].y) >= 3);
    if (middle.length) camps.push(rng.pick(middle));
    for (const c of camps) c.layout = "camp";

    // 5. Décors.
    for (const c of rng.shuffle(wild)) {
      if (c.layout) continue;
      const allowed = WILD_LAYOUTS.filter((k) => LAYOUTS[k].minDistance <= c.distance);
      const neighbours = new Set(DIRS
        .map((d) => cells.get(key(c.x + d.dx, c.y + d.dy)))
        .filter(Boolean)
        .map((n) => n.layout));
      const fresh = allowed.filter((k) => !neighbours.has(k));
      c.layout = rng.pick(fresh.length ? fresh : allowed);
    }

    // 6. Coffres. Si une carte n'a pas d'écran assez proche ou assez loin, on
    //    prend le plus proche de la règle plutôt que de ne rien cacher.
    const free = () => wild.filter((c) => c.layout !== "camp" && !c.chest);
    const hide = (item, fits, score) => {
      const pool = free();
      if (!pool.length) return;
      const ok = pool.filter(fits);
      const c = ok.length ? rng.pick(ok) : pool.sort((a, b) => score(a) - score(b))[0];
      c.chest = item;
    };
    hide(rng.pick(LOOT.nearWeapons),
      (c) => c.distance <= LOOT.NEAR_MAX, (c) => c.distance);
    hide(rng.pick(LOOT.farWeapons),
      (c) => c.distance >= LOOT.FAR_MIN, (c) => -c.distance);
    for (const item of rng.shuffle(LOOT.artifacts).slice(0, LOOT.ARTIFACTS_PER_MAP)) {
      hide(item, (c) => c.distance >= 2, (c) => -c.distance);
    }

    return { seed, size, base, cells, depth: far };
  }

  // Une graine neuve pour chaque expédition.
  function freshSeed() {
    return (Math.random() * 4294967296) >>> 0;
  }

  return { generate, freshSeed };
})();

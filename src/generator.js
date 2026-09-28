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
// 4. Décors : tirés au sort parmi ceux permis à cette distance, en évitant
//    de répéter celui d'un voisin.
// 5. Coffres : une arme de mêlée près du camp de base, une arme à distance
//    plus loin, et des artefacts ailleurs, un coffre au plus par écran.
// 6. Camp : un seul à la fois, installé dans un écran ordinaire. Quand il a
//    servi, il s'éteint et moveCamp() en allume un autre ailleurs.

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

    start.layout = "base";
    const wild = [...cells.values()].filter((c) => c !== start);
    const far = Math.max(...wild.map((c) => c.distance));

    // 4. Décors.
    for (const c of rng.shuffle(wild)) {
      const allowed = WILD_LAYOUTS.filter((k) => LAYOUTS[k].minDistance <= c.distance);
      const neighbours = new Set(DIRS
        .map((d) => cells.get(key(c.x + d.dx, c.y + d.dy)))
        .filter(Boolean)
        .map((n) => n.layout));
      const fresh = allowed.filter((k) => !neighbours.has(k));
      c.layout = rng.pick(fresh.length ? fresh : allowed);
    }

    // 5. Coffres. Si une carte n'a pas d'écran assez proche ou assez loin, on
    //    prend le plus proche de la règle plutôt que de ne rien cacher.
    const free = () => wild.filter((c) => !c.chest);
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

    // 6. Le premier camp, à portée : ni collé au camp de base, ni au bout.
    //    Les suivants seront tirés par moveCamp(), avec leur propre hasard
    //    à graine, pour qu'une même carte déroule toujours la même suite de
    //    camps.
    const map = { seed, size, base, cells, depth: far, camp: null,
                  campRng: makeRandom(deriveSeed(seed, 7777)) };
    placeCamp(map, (c) => c.distance >= CAMP_FIRST_MIN && c.distance <= CAMP_FIRST_MAX);
    return map;
  }

  const CAMP_FIRST_MIN = 2;
  const CAMP_FIRST_MAX = 4;
  // Un nouveau camp s'allume au moins à cette distance (en ligne droite, en
  // écrans) de celui qu'on vient d'utiliser : il faut repartir le chercher.
  const CAMP_MOVE_MIN = 3;

  function placeCamp(map, fits) {
    const wild = [...map.cells.values()].filter((c) => c.layout !== "base");
    const ok = wild.filter(fits);
    const c = map.campRng.pick(ok.length ? ok : wild);
    map.camp = { x: c.x, y: c.y };
  }

  // Le camp vient de servir : il s'éteint, et un autre s'allume ailleurs, loin
  // de lui et jamais dans l'écran du camp de base.
  function moveCamp(map) {
    const old = map.camp;
    placeCamp(map, (c) => c.distance >= 2 &&
      Math.abs(c.x - old.x) + Math.abs(c.y - old.y) >= CAMP_MOVE_MIN);
  }

  // Une graine neuve pour chaque expédition.
  function freshSeed() {
    return (Math.random() * 4294967296) >>> 0;
  }

  return { generate, moveCamp, freshSeed };
})();

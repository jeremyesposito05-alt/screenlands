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
//    plus loin, et des coffres au hasard, de rareté croissante avec la
//    distance, un par écran au plus.
// 6. Gardien : un mini-boss dans un des écrans les plus éloignés.
// 7. Camp : un seul à la fois, installé dans un écran ordinaire. Quand il a
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
  // `opts.extraChests` : des coffres de plus (l'atelier). `opts.floor` : l'étage ;
  // au-delà du premier, le point de départ est un palier (escalier qui
  // remonte) au lieu du camp de base, et le camp n'apparaît qu'à partir du
  // troisième.
  function generate(seed, opts = {}) {
    let map;
    for (let attempt = 0; attempt < 50; attempt++) {
      map = build(attempt ? deriveSeed(seed, attempt) : seed, opts);
      if (map.depth <= Config.MAP_MAX_DISTANCE) break;
    }
    map.seed = seed;
    map.floor = opts.floor || 1;
    return map;
  }

  function build(seed, opts = {}) {
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

    start.layout = (opts.floor || 1) > 1 ? "landing" : "base";
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

    // 4 bis. Portes : chaque passage reçoit une position (1, 2 ou 3) que les
    //    deux décors acceptent, tirée au hasard. Si aucune position n'est
    //    commune, le centre, que tous les décors acceptent.
    for (const c of cells.values()) {
      for (const d of [DIRS[1], DIRS[3]]) {
        if (!c.links[d.name]) continue;
        const n = cells.get(key(c.x + d.dx, c.y + d.dy));
        const mine = doorSlots(c.layout)[d.name];
        const theirs = doorSlots(n.layout)[d.back];
        const both = mine.filter((s) => theirs.includes(s));
        const slot = both.length ? rng.pick(both) : 2;
        c.links[d.name] = slot;
        n.links[d.back] = slot;
      }
    }

    // 5. Coffres. Chacun est {tier, item} : `item` est fixé pour les deux
    //    armes garanties, et null pour les autres, dont le contenu sera tiré
    //    à l'ouverture (voir Loot). Si une carte n'a pas d'écran assez proche
    //    ou assez loin, on prend le plus proche de la règle plutôt que de ne
    //    rien cacher.
    const free = () => wild.filter((c) => !c.chest);
    const hide = (chest, fits, score) => {
      const pool = free();
      if (!pool.length) return;
      const ok = pool.filter(fits);
      const c = ok.length ? rng.pick(ok) : pool.sort((a, b) => score(a) - score(b))[0];
      c.chest = chest;
    };
    hide({ tier: "rare", item: rng.pick(LOOT.nearWeapons) },
      (c) => c.distance <= LOOT.NEAR_MAX, (c) => c.distance);
    hide({ tier: "rare", item: rng.pick(LOOT.farWeapons) },
      (c) => c.distance >= LOOT.FAR_MIN, (c) => -c.distance);
    for (let i = 0; i < LOOT.RANDOM_CHESTS + (opts.extraChests || 0); i++) {
      const pool = free();
      if (!pool.length) break;
      const c = rng.pick(pool);
      c.chest = { tier: Loot.tierFor(c.distance, rng), item: null };
    }

    // 5 ter. Les salles scellées : en entrant, les portes se ferment, et il
    // faut vaincre toutes les vagues de créatures pour ressortir. Jamais au
    // bout de la carte (le Gardien a la sienne), ni tout près du départ.
    const sealCount = (opts.floor || 1) > 1 ? 2 : 1;
    const sealable = rng.shuffle(wild.filter((c) => c.distance >= 2 && c.distance < far));
    for (const c of sealable.slice(0, sealCount)) c.sealed = true;

    // 5 bis. Les esprits errants : quelques écrans en abritent un. Lequel, c'est
    // World qui le tire, parmi ceux qu'on peut rencontrer.
    const spirits = Config.SPIRITS_PER_MAP + rng.int(Config.SPIRITS_EXTRA + 1);
    for (const c of rng.shuffle(wild).slice(0, spirits)) c.spirit = true;

    // 6. Le Gardien, le mini-boss, dans un des écrans les plus éloignés : le
    //    bout de la carte a toujours quelque chose à défendre.
    const bossCell = rng.pick(wild.filter((c) => c.distance === far));

    // 7. Le premier camp, à portée : ni collé au camp de base, ni au bout.
    //    Les suivants seront tirés par moveCamp(), avec leur propre hasard
    //    à graine, pour qu'une même carte déroule toujours la même suite de
    //    camps. Jamais dans l'écran du Gardien.
    // L'escalier qui descend est dans l'écran du Gardien : il faut le trouver,
    // et passer devant lui.
    const map = { seed, size, base, cells, depth: far, camp: null,
                  boss: { x: bossCell.x, y: bossCell.y },
                  stairs: { x: bossCell.x, y: bossCell.y },
                  campRng: makeRandom(deriveSeed(seed, 7777)) };
    const floor = opts.floor || 1;
    // Pas de camp au deuxième étage : il faut remonter mettre son butin à
    // l'abri. Il en revient un à partir de Config.CAMP_FLOOR.
    if (floor === 1 || floor >= Config.CAMP_FLOOR) {
      placeCamp(map, (c) => c.distance >= CAMP_FIRST_MIN && c.distance <= CAMP_FIRST_MAX);
    }
    return map;
  }

  const CAMP_FIRST_MIN = 2;
  const CAMP_FIRST_MAX = 4;
  // Un nouveau camp s'allume au moins à cette distance (en ligne droite, en
  // écrans) de celui qu'on vient d'utiliser : il faut repartir le chercher.
  const CAMP_MOVE_MIN = 3;

  function placeCamp(map, fits) {
    const isBoss = (c) => map.boss && c.x === map.boss.x && c.y === map.boss.y;
    const wild = [...map.cells.values()].filter((c) => !LAYOUTS[c.layout].safe && !isBoss(c) && !c.sealed);
    const ok = wild.filter(fits);
    const c = map.campRng.pick(ok.length ? ok : wild);
    map.camp = { x: c.x, y: c.y };
  }

  // Le camp vient de servir : il s'éteint, et un autre s'allume ailleurs, loin
  // de lui et jamais dans l'écran du camp de base.
  function moveCamp(map) {
    if (!map.camp) return;
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

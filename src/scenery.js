"use strict";

// L'habillage d'une zone : quel sol, quels petits détails semés dessus, et
// quels arbres et lampadaires plantés dans ses murs, qui débordent sur la
// salle.
//
// Ce n'est que du décor : rien ici n'arrête un corps ni ne change le jeu.
// Arbres et lampadaires sont plantés dans l'épaisseur des murs des côtés,
// qui sont déjà des obstacles ; seul leur feuillage ou leur lanterne passe
// au-dessus de la salle, et le rendu l'efface quand le héros est dessous.
//
// Le tirage dépend de la graine de la carte et de la position de l'écran :
// on retrouve le même habillage en revenant.

const Scenery = (() => {
  // Les sols de terre battue ; les autres sont herbeux.
  const DIRT = new Set(["ruins", "narrows", "base"]);
  // Pas les fleurs : à cette taille, on les prenait pour une bête.
  const DECALS = ["decal_grass", "decal_pebbles", "decal_puddle", "decal_leaves", "decal_root"];
  // Un arbre ou un lampadaire reste à cette distance d'une porte, pour ne
  // pas masquer son encadrement.
  const DOOR_CLEARANCE = 100;
  const PROP_SPACING = 90;

  let seed = null;
  const cache = new Map();

  function dress(state) {
    if (ZoneRegistry.seed !== seed) { seed = ZoneRegistry.seed; cache.clear(); }
    const { x: cx, y: cy } = state.coords;
    const key = `${cx},${cy}`;
    if (!cache.has(key)) cache.set(key, build(state, cx, cy));
    return cache.get(key);
  }

  function build(state, cx, cy) {
    const W = Config.ZONE_W, H = Config.ZONE_H, t = Config.WALL;
    const rng = makeRandom(deriveSeed(seed, cx, cy, 31));
    const layout = Object.keys(LAYOUTS).find((k) => LAYOUTS[k] === state.zone);
    const exits = ZoneRegistry.exits(cx, cy);

    // Les détails du sol, hors des obstacles et loin du feu et du portail.
    const spots = [state.zone.fire, state.zone.portal, state.zone.chest].filter(Boolean);
    const decals = [];
    const wanted = 4 + rng.int(4);
    for (let tries = 0; tries < 80 && decals.length < wanted; tries++) {
      const x = t + 2 + rng.int(W - 2 * t - 20), y = t + 2 + rng.int(H - 2 * t - 20);
      const box = { x: x - 2, y: y - 2, w: 20, h: 20 };
      if (state.solids.some((s) => box.x < s.x + s.w && s.x < box.x + box.w && box.y < s.y + s.h && s.y < box.y + box.h)) continue;
      if (spots.some((p) => Math.hypot(p.x - x - 8, p.y - y - 8) < 22)) continue;
      if (decals.some((d) => Math.hypot(d.x - x, d.y - y) < 18)) continue;
      decals.push({ name: rng.pick(DECALS), x, y, flip: rng.chance(0.5) });
    }

    // Arbres et lampadaires, un ou deux par mur de côté. Le mur de droite
    // commence plus bas : la mini-carte occupe son coin haut.
    const props = [];
    for (const side of ["left", "right"]) {
      const door = exits[side] ? doorCenter(side, exits[side]).y : null;
      const top = side === "right" ? 130 : 96, bottom = H - 40;
      const count = 1 + rng.int(2);
      const ys = [];
      for (const y of rng.shuffle(Array.from({ length: (bottom - top) / 8 }, (_, i) => top + i * 8))) {
        if (ys.length >= count) break;
        if (door !== null && Math.abs(y - door) < DOOR_CLEARANCE) continue;
        if (ys.some((o) => Math.abs(o - y) < PROP_SPACING)) continue;
        ys.push(y);
      }
      for (const y of ys) {
        props.push({ type: rng.chance(layout === "base" ? 0.3 : 0.65) ? "tree" : "lamp", side, y });
      }
    }

    return { ground: DIRT.has(layout) ? "ground_dirt" : "ground_grass", decals, props };
  }

  return { dress };
})();

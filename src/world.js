"use strict";

// Le chef d'orchestre de l'expédition : l'état du jeu et ses règles, sans
// rien dessiner.
//
// Il garde une seule zone chargée à la fois et fait passer le joueur dans la
// zone voisine dès qu'il franchit un bord de l'écran. Le joueur n'appartient
// pas à la zone : il survit au changement d'écran. Une zone est toujours
// posée à l'origine, donc la position du joueur est directement sa position
// dans la zone, et il n'y a aucune caméra.

const World = (() => {
  const START = { x: 0, y: 0 };

  const state = {
    coords: { ...START },
    zone: null,
    // Murs et obstacles de la zone chargée : tout ce qui arrête le joueur.
    solids: [],
    // Position = centre du joueur, en pixels de zone.
    player: {
      kind: "player",
      x: Config.ZONE_W / 2,
      y: Config.ZONE_H / 2,
      size: Config.PLAYER_SIZE,
      // Dernière direction non nulle. Rien ne s'en sert encore : ce sera
      // l'ancrage de l'animation et de la direction des attaques.
      facing: { x: 0, y: 1 },
    },
  };

  function reset() {
    enterZone(START.x, START.y);
    state.player.x = Config.ZONE_W / 2;
    state.player.y = Config.ZONE_H / 2;
  }

  // Remplace la zone chargée. Ne touche pas au joueur : c'est à l'appelant
  // de le placer.
  function enterZone(cx, cy) {
    state.zone = ZoneRegistry.get(cx, cy);
    state.coords = { x: cx, y: cy };
    state.solids = [...borderWalls(), ...state.zone.obstacles];
  }

  function step(dt, dir) {
    const p = state.player;
    if (dir.x || dir.y) p.facing = dir;

    // Le déplacement est cardinal : un seul axe bouge à la fois, donc une
    // collision se résout en recollant le joueur contre la face touchée.
    const dist = Config.PLAYER_SPEED * dt;
    if (dir.x) moveAxis("x", dir.x * dist);
    if (dir.y) moveAxis("y", dir.y * dist);

    const crossed = crossedEdge(p);
    if (!crossed) return;

    const tx = state.coords.x + crossed.x;
    const ty = state.coords.y + crossed.y;
    if (!ZoneRegistry.has(tx, ty)) {
      // Bord du monde connu : on retient le joueur au lieu de le laisser
      // sortir dans le vide. La génération remplacera ça par une vraie
      // limite d'expédition.
      clampInside(p);
      return;
    }
    enterZone(tx, ty);
    placeAtEntry(p, crossed);
  }

  function moveAxis(axis, delta) {
    const p = state.player;
    const half = p.size / 2;
    p[axis] += delta;
    for (const s of state.solids) {
      if (!overlaps(p, s)) continue;
      if (axis === "x") p.x = delta > 0 ? s.x - half : s.x + s.w + half;
      else p.y = delta > 0 ? s.y - half : s.y + s.h + half;
    }
  }

  function overlaps(p, r) {
    const half = p.size / 2;
    return p.x + half > r.x && p.x - half < r.x + r.w &&
           p.y + half > r.y && p.y - half < r.y + r.h;
  }

  // Le bord que le joueur vient de dépasser, ou null tant qu'il est dans la
  // zone.
  function crossedEdge(p) {
    if (p.x < 0) return { x: -1, y: 0 };
    if (p.x > Config.ZONE_W) return { x: 1, y: 0 };
    if (p.y < 0) return { x: 0, y: -1 };
    if (p.y > Config.ZONE_H) return { x: 0, y: 1 };
    return null;
  }

  function clampInside(p) {
    const m = Config.ENTRY_MARGIN;
    p.x = Math.min(Math.max(p.x, m), Config.ZONE_W - m);
    p.y = Math.min(Math.max(p.y, m), Config.ZONE_H - m);
  }

  // Fait ressortir le joueur du bord opposé de la zone qu'il vient d'entrer,
  // en gardant son autre coordonnée : il arrive dans la porte qui fait face à
  // celle qu'il a prise.
  function placeAtEntry(p, dir) {
    const m = Config.ENTRY_MARGIN;
    if (dir.x < 0) p.x = Config.ZONE_W - m;
    else if (dir.x > 0) p.x = m;
    if (dir.y < 0) p.y = Config.ZONE_H - m;
    else if (dir.y > 0) p.y = m;
  }

  return { state, reset, step };
})();

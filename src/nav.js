"use strict";

// La navigation des ennemis : trouver un chemin autour des obstacles.
//
// La zone est découpée en cases de CELL pixels. Une case est praticable si un
// ennemi centré dessus ne touche aucun solide. Pour aller vers sa cible, un
// ennemi cherche le plus court chemin de case en case (parcours en largeur)
// et vise la première case de ce chemin. Si la cible est hors d'atteinte, il
// va au plus près.
//
// Les déplacements restent cardinaux : d'un centre de case au centre voisin,
// un seul axe bouge.

const Nav = (() => {
  const CELL = 8;

  // La grille de la zone, pour des corps de `size` pixels.
  function build(solids, size) {
    const cols = Math.floor(Config.ZONE_W / CELL);
    const rows = Math.floor(Config.ZONE_H / CELL);
    const pass = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const body = { x: c * CELL + CELL / 2, y: r * CELL + CELL / 2, size };
        pass[r * cols + c] = solids.some((s) => Physics.overlapsRect(body, s)) ? 0 : 1;
      }
    }
    return { cols, rows, pass };
  }

  function cellOf(grid, x, y) {
    const c = Math.min(grid.cols - 1, Math.max(0, Math.floor(x / CELL)));
    const r = Math.min(grid.rows - 1, Math.max(0, Math.floor(y / CELL)));
    return r * grid.cols + c;
  }

  function center(grid, i) {
    return { x: (i % grid.cols) * CELL + CELL / 2, y: Math.floor(i / grid.cols) * CELL + CELL / 2 };
  }

  // Le prochain point de passage de `from` vers `to` : le centre de la case
  // suivante sur le plus court chemin, ou `to` lui-même quand on est déjà dans
  // sa case. Hors d'atteinte, le chemin mène à la case la plus proche de `to`.
  function nextStep(grid, from, to) {
    const { cols, rows, pass } = grid;
    const start = cellOf(grid, from.x, from.y);
    const goal = cellOf(grid, to.x, to.y);
    if (start === goal) return { x: to.x, y: to.y };

    const prev = new Int32Array(cols * rows).fill(-1);
    prev[start] = start;
    const queue = [start];
    let best = start;
    let bestDist = Infinity;

    for (let head = 0; head < queue.length; head++) {
      const i = queue[head];
      if (i === goal) {
        best = i;
        break;
      }
      const p = center(grid, i);
      const d = Math.hypot(p.x - to.x, p.y - to.y);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
      const c = i % cols;
      const r = (i - c) / cols;
      const around = [];
      if (c > 0) around.push(i - 1);
      if (c < cols - 1) around.push(i + 1);
      if (r > 0) around.push(i - cols);
      if (r < rows - 1) around.push(i + cols);
      for (const n of around) {
        if (prev[n] !== -1 || !pass[n]) continue;
        prev[n] = i;
        queue.push(n);
      }
    }

    // On remonte le chemin jusqu'à la case qui suit le départ.
    if (best === start) return center(grid, start);
    let step = best;
    while (prev[step] !== start) step = prev[step];
    return center(grid, step);
  }

  return { build, nextStep };
})();

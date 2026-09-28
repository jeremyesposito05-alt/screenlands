"use strict";

// Collisions entre un corps mobile et les rectangles pleins d'une zone.
//
// Un corps est un carré repéré par son centre : {x, y, size}. Un solide est
// un rectangle repéré par son coin : {x, y, w, h}. Joueur et ennemis se
// déplacent un axe à la fois, donc une collision se résout simplement en
// recollant le corps contre la face touchée.

const Physics = {
  // Le corps chevauche-t-il le rectangle ? Des bords qui se touchent ne
  // comptent pas : un corps recollé contre un mur ne le chevauche plus.
  overlapsRect(b, r) {
    const h = b.size / 2;
    return b.x + h > r.x && b.x - h < r.x + r.w &&
           b.y + h > r.y && b.y - h < r.y + r.h;
  },

  // Deux corps se touchent-ils ?
  overlapsBody(a, b) {
    const reach = (a.size + b.size) / 2;
    return Math.abs(a.x - b.x) < reach && Math.abs(a.y - b.y) < reach;
  },

  // Déplace le corps de `delta` sur un seul axe ("x" ou "y") et renvoie true
  // s'il a été arrêté par un solide.
  moveAxis(b, axis, delta, solids) {
    const h = b.size / 2;
    let blocked = false;
    b[axis] += delta;
    for (const s of solids) {
      if (!Physics.overlapsRect(b, s)) continue;
      blocked = true;
      if (axis === "x") b.x = delta > 0 ? s.x - h : s.x + s.w + h;
      else b.y = delta > 0 ? s.y - h : s.y + s.h + h;
    }
    return blocked;
  },
};

"use strict";

// Un générateur pseudo-aléatoire à graine.
//
// Math.random() ne se rejoue pas. Avec une graine, une même carte peut être
// régénérée à l'identique : pour reproduire un bug, pour tester, et plus tard
// pour une « carte du jour » partagée entre joueurs.

// mulberry32 : court, rapide, et largement suffisant pour un jeu.
function makeRandom(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    // Entier dans [0, n[.
    int: (n) => Math.floor(next() * n),
    pick: (list) => list[Math.floor(next() * list.length)],
    chance: (p) => next() < p,
    shuffle(list) {
      const out = [...list];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}

// Une graine dérivée d'une autre et de quelques entiers, pour tirer au sort
// quelque chose de stable par zone sans dépendre de l'ordre de visite.
function deriveSeed(seed, ...parts) {
  let h = seed >>> 0;
  for (const p of parts) {
    h = Math.imul(h ^ (p + 0x9e3779b9), 0x85ebca6b) >>> 0;
    h ^= h >>> 13;
  }
  return h >>> 0;
}

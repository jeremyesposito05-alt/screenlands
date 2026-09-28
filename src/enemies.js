"use strict";

// Les ennemis, construits par assemblage.
//
// L'idée vient des fantômes de Pac-Man : peu de comportements bien distincts
// suffisent à beaucoup d'ennemis. Un type d'ennemi est donc une fiche qui
// combine des statistiques et un comportement de déplacement choisi dans
// BEHAVIOURS. Ajouter un ennemi, c'est écrire une fiche ; ajouter une façon
// de bouger, c'est écrire un comportement, que toutes les fiches peuvent
// ensuite reprendre. Les capacités (tir, invocation...) viendront s'ajouter
// de la même manière.

const Enemies = (() => {
  // Un comportement reçoit l'ennemi et le joueur, et renvoie la direction
  // voulue. Comme le joueur, les ennemis se déplacent en cardinal.
  const BEHAVIOURS = {
    // Fonce vers le joueur par l'axe où l'écart est le plus grand.
    chase(e, player) {
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      if (Math.abs(dx) >= Math.abs(dy)) return { x: Math.sign(dx), y: 0 };
      return { x: 0, y: Math.sign(dy) };
    },
  };

  const TYPES = {
    chaser: { kind: "chaser", size: 10, hp: 1, damage: 1, move: "chase" },
  };

  // Durée maximale d'un contournement : au-delà, l'ennemi reprend sa
  // poursuite, quitte à rebuter et à repartir de l'autre côté.
  const DETOUR_MAX = 2;

  function spawn(type, at, distance) {
    const t = TYPES[type];
    return {
      kind: t.kind,
      type,
      x: at.x,
      y: at.y,
      size: t.size,
      hp: t.hp + Math.floor(distance / Config.ENEMY_HP_EVERY),
      damage: t.damage,
      speed: Config.ENEMY_SPEED + Config.ENEMY_SPEED_PER_DISTANCE * distance,
      wake: Config.ENEMY_WAKE,
      // Étourdi après un coup : immobile et inoffensif.
      stun: 0,
      // Contournement en cours : la direction qui était bloquée, celle qu'on
      // longe, et le temps restant.
      detour: 0,
      blockedDir: null,
      detourDir: null,
    };
  }

  // Un corps pourrait-il avancer d'un pixel dans cette direction ?
  function canMove(e, dir, solids) {
    const probe = { x: e.x, y: e.y, size: e.size };
    return !Physics.moveAxis(probe, dir.x ? "x" : "y", dir.x || dir.y, solids);
  }

  function move(e, dir, dist, solids) {
    return Physics.moveAxis(e, dir.x ? "x" : "y", (dir.x || dir.y) * dist, solids);
  }

  // Un ennemi qui peut faire mal : réveillé et pas étourdi.
  function harmful(e) {
    return e.wake <= 0 && e.stun <= 0;
  }

  // Encaisse un coup venu de `dir` et renvoie true s'il en meurt.
  function hit(e, dir, solids) {
    e.hp -= 1;
    e.stun = Config.ENEMY_STUN;
    e.wake = 0;
    e.detour = 0;
    Physics.moveAxis(e, dir.x ? "x" : "y", (dir.x || dir.y) * Config.ENEMY_KNOCKBACK, solids);
    return e.hp <= 0;
  }

  function step(e, player, dt, solids) {
    if (e.stun > 0) {
      e.stun -= dt;
      return;
    }
    if (e.wake > 0) {
      e.wake -= dt;
      return;
    }
    const dist = e.speed * dt;

    // Contournement, commun à tous les comportements : l'ennemi longe
    // l'obstacle jusqu'à ce que la direction qui était bloquée se libère.
    // S'il bute aussi sur le côté, il repart dans l'autre sens.
    if (e.detour > 0) {
      e.detour -= dt;
      if (canMove(e, e.blockedDir, solids)) {
        e.detour = 0;
      } else {
        if (move(e, e.detourDir, dist, solids)) {
          e.detourDir = { x: -e.detourDir.x, y: -e.detourDir.y };
        }
        return;
      }
    }

    const dir = BEHAVIOURS[TYPES[e.type].move](e, player);
    if (!dir.x && !dir.y) return;
    if (move(e, dir, dist, solids)) {
      // Longer du côté du joueur quand il y en a un, sinon au hasard.
      const other = dir.x ? player.y - e.y : player.x - e.x;
      const side = Math.sign(other) || (Math.random() < 0.5 ? -1 : 1);
      e.blockedDir = dir;
      e.detourDir = dir.x ? { x: 0, y: side } : { x: side, y: 0 };
      e.detour = DETOUR_MAX;
    }
  }

  return { spawn, step, hit, harmful };
})();

"use strict";

// Les compagnons, à la manière des « options » des jeux d'avion.
//
// Ils suivent le joueur en file, sur sa trajectoire exacte, comme les
// options de Gradius : un serpent. Chacun attaque tout seul. Ils servent
// aussi d'armure : un coup reçu fait tomber le dernier de la file au lieu de
// coûter un cœur. Le compagnon tombé reste sonné au sol quelques secondes ;
// repasser dessus le relève et le remet dans la file. Tant qu'on a des
// compagnons, on ne perd pas de cœurs.
//
// Ils font mal, mais moins que le joueur : l'arme en main reste l'essentiel.
// Leurs dégâts, leur cadence et leur portée suivent les caractéristiques
// (Stats). Comme Powers, ce module blesse par `api.damage`, fourni par World.

const Allies = (() => {
  // La file compte BASE_MAX compagnons, davantage avec l'Étendard du roi
  // (voir maxFor) ; LONGEST est la plus longue possible.
  const BASE_MAX = 4;
  const LONGEST = 6;
  // Espacement dans la file, en pixels de trajectoire, et finesse de
  // l'enregistrement de cette trajectoire.
  const SPACING = 12;
  const STEP = 2;
  // Combien de temps un compagnon tombé attend qu'on le relève.
  const DOWN_TIME = 4;

  const TYPES = {
    // Tire sur l'ennemi le plus proche.
    archer: { name: "Archer", cooldown: 0.8, range: 110, damage: 0.75, arrowSpeed: 200 },
    // Frappe ce qui s'approche de lui.
    warrior: { name: "Guerrier", cooldown: 0.7, reach: 16, damage: 1, knockback: 10, targets: 2 },
  };

  const PER = SPACING / STEP;

  // L'état des compagnons est dans state : run.allies (la file, qui dure
  // l'expédition), et, propres à la zone, la trajectoire, les compagnons
  // tombés, les flèches en vol et les coups en cours.
  function clearZone(state) {
    const p = state.player;
    state.trail = Array.from({ length: LONGEST * PER + 2 }, () => ({ x: p.x, y: p.y }));
    state.downed = [];
    state.allyShots = [];
    state.slashes = [];
    for (const a of state.run.allies) {
      a.x = p.x;
      a.y = p.y;
    }
  }

  // Combien de compagnons tiennent dans la file de cette expédition.
  function maxFor(run) {
    return BASE_MAX + Stats.compute(run).allyMax;
  }

  function add(state, type) {
    if (state.run.allies.length >= maxFor(state.run)) return false;
    const p = state.player;
    state.run.allies.push({ type, x: p.x, y: p.y, cooldown: 0 });
    return true;
  }

  // La trajectoire du joueur, un point tous les STEP pixels ; chaque
  // compagnon se place PER points plus loin que le précédent.
  function follow(state) {
    const p = state.player, t = state.trail;
    let last = t[t.length - 1];
    let d = Math.hypot(p.x - last.x, p.y - last.y);
    // Un saut (changement de zone, recul) : on ne trace pas de ligne.
    if (d > 40) {
      clearZone(state);
      return;
    }
    while (d >= STEP) {
      const k = STEP / d;
      last = { x: last.x + (p.x - last.x) * k, y: last.y + (p.y - last.y) * k };
      t.push(last);
      d = Math.hypot(p.x - last.x, p.y - last.y);
    }
    const keep = LONGEST * PER + 2;
    if (t.length > keep) t.splice(0, t.length - keep);
    state.run.allies.forEach((a, i) => {
      const pt = t[Math.max(0, t.length - 1 - (i + 1) * PER)];
      a.x = pt.x;
      a.y = pt.y;
    });
  }

  function update(state, dt, stats, api) {
    follow(state);
    for (const a of state.run.allies) {
      a.cooldown -= dt;
      if (a.cooldown > 0) continue;
      if (a.type === "archer") shoot(state, a, stats);
      else strike(state, a, stats, api);
    }
    updateShots(state, dt, api);
    state.slashes = state.slashes.filter((s) => (s.life -= dt) > 0);
    updateDowned(state, dt);
  }

  function nearest(state, from, range) {
    let best = null, bd = range;
    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      const d = Math.hypot(e.x - from.x, e.y - from.y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  function shoot(state, a, stats) {
    const t = TYPES.archer;
    const e = nearest(state, a, t.range * stats.area);
    if (!e) return;
    const d = Math.hypot(e.x - a.x, e.y - a.y) || 1;
    state.allyShots.push({ x: a.x, y: a.y, vx: ((e.x - a.x) / d) * t.arrowSpeed, vy: ((e.y - a.y) / d) * t.arrowSpeed,
                           size: 3, damage: t.damage * stats.damage, life: 1 });
    a.cooldown = t.cooldown * stats.cooldown;
  }

  function strike(state, a, stats, api) {
    const t = TYPES.warrior;
    const reach = t.reach * stats.area;
    const hit = state.enemies
      .filter((e) => e.hp > 0 && Math.hypot(e.x - a.x, e.y - a.y) < reach + e.size / 2)
      .slice(0, t.targets);
    if (!hit.length) return;
    for (const e of hit) {
      const dx = e.x - a.x, dy = e.y - a.y;
      const dir = Math.abs(dx) >= Math.abs(dy) ? { x: Math.sign(dx) || 1, y: 0 } : { x: 0, y: Math.sign(dy) || 1 };
      state.slashes.push({ x: a.x, y: a.y, tx: e.x, ty: e.y, life: 0.14 });
      api.damage(e, t.damage * stats.damage, dir, t.knockback);
    }
    a.cooldown = t.cooldown * stats.cooldown;
  }

  function updateShots(state, dt, api) {
    state.allyShots = state.allyShots.filter((s) => {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.life <= 0 || state.solids.some((r) => Physics.overlapsRect(s, r))) return false;
      const e = state.enemies.find((o) => o.hp > 0 && Physics.overlapsBody(o, s));
      if (!e) return true;
      const dir = Math.abs(s.vx) >= Math.abs(s.vy) ? { x: Math.sign(s.vx), y: 0 } : { x: 0, y: Math.sign(s.vy) };
      api.damage(e, s.damage, dir, 6);
      return false;
    });
  }

  // Un coup reçu : le dernier compagnon de la file tombe à sa place, et le
  // joueur ne perd pas de cœur. Renvoie false s'il n'y avait personne.
  function absorb(state) {
    const a = state.run.allies.pop();
    if (!a) return false;
    state.downed.push({ type: a.type, x: a.x, y: a.y, time: DOWN_TIME });
    return true;
  }

  // Les compagnons tombés : on les relève en passant dessus, avant qu'ils
  // ne soient perdus.
  function updateDowned(state, dt) {
    const p = state.player;
    state.downed = state.downed.filter((d) => {
      d.time -= dt;
      if (d.time <= 0) return false;
      if (Math.hypot(d.x - p.x, d.y - p.y) < (p.size + 9) / 2 && state.run.allies.length < maxFor(state.run)) {
        state.run.allies.push({ type: d.type, x: d.x, y: d.y, cooldown: 0.3 });
        state.popups.push({ x: d.x, y: d.y - 4, text: "relevé !", time: 0.8 });
        if (state.events) state.events.push({ type: "revive", x: d.x, y: d.y });
        return false;
      }
      return true;
    });
  }

  return { BASE_MAX, TYPES, DOWN_TIME, maxFor, clearZone, add, update, absorb };
})();

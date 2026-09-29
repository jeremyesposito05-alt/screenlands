"use strict";

// Les pouvoirs automatiques, à la Vampire Survivors.
//
// Le joueur frappe lui-même avec son arme ; les pouvoirs, eux, agissent
// seuls, en continu ou à intervalles. Chacun a trois niveaux : en retrouver
// un le fait monter. Leurs dégâts, leur cadence et leur portée suivent les
// caractéristiques (Stats), comme l'arme.
//
// Ce module ne connaît pas les règles de la mort ni du butin : pour blesser
// un ennemi, il passe par `api.damage`, que fournit World.
//
// Les réglages sont des tableaux indexés par niveau - 1.

const Powers = (() => {
  const MAX_LEVEL = 3;

  const TUNING = {
    // Des flammes au sol derrière le joueur, qui brûlent ce qui les traverse.
    fireTrail: { life: [1.2, 1.7, 2.2], radius: 7, damage: 1, tick: 0.5, every: 9 },
    // Des orbes qui tournent autour du joueur.
    orb: { count: [1, 2, 3], radius: 22, spin: 3.2, damage: 1, size: 7, rehit: 0.5 },
    // Un éclair sur l'ennemi le plus proche ; au niveau 3, il rebondit sur un
    // deuxième.
    lightning: { interval: [2.4, 1.9, 1.5], range: 120, damage: 2, chain: [0, 0, 1] },
    // Une onde qui s'étend autour du joueur, ralentit, puis blesse aux
    // niveaux 2 et 3.
    frost: { interval: [4.5, 4, 3.5], radius: [42, 50, 60], slow: 2, damage: [0, 1, 1], speed: 140 },
    // Un bouclier qui absorbe un coup, puis se recharge.
    aegis: { recharge: [12, 9, 6] },
  };

  // L'état des pouvoirs : ce qui est à l'écran et les minuteries. Remis à
  // zéro avec l'expédition ; flammes, éclairs et ondes s'effacent aussi en
  // changeant de zone.
  function fresh() {
    return { flames: [], lastDrop: null, orbAngle: 0, bolts: [], waves: [], timers: {}, aegisReady: true, aegisTimer: 0 };
  }

  function clearZone(fx) {
    fx.flames = [];
    fx.bolts = [];
    fx.waves = [];
    fx.lastDrop = null;
  }

  const lv = (arr, level) => arr[Math.min(level, arr.length) - 1];

  // Fait agir tous les pouvoirs possédés. `powers` : clé -> niveau.
  function update(state, dt, powers, stats, api) {
    const fx = state.fx;
    const p = state.player;

    // Les visuels passagers vieillissent, qu'on ait encore le pouvoir ou non.
    fx.bolts = fx.bolts.filter((b) => (b.life -= dt) > 0);

    if (powers.fireTrail) fireTrail(state, dt, powers.fireTrail, stats, api);
    else fx.flames = fx.flames.filter((f) => (f.life -= dt) > 0);

    if (powers.orb) orbs(state, dt, powers.orb, stats, api);

    if (powers.lightning) {
      const t = TUNING.lightning;
      if (every(fx, "lightning", lv(t.interval, powers.lightning) * stats.cooldown, dt)) {
        lightning(state, powers.lightning, stats, api);
      }
    }

    if (powers.frost) {
      const t = TUNING.frost;
      if (every(fx, "frost", lv(t.interval, powers.frost) * stats.cooldown, dt)) {
        fx.waves.push({ x: p.x, y: p.y, r: 0, max: lv(t.radius, powers.frost) * stats.area,
                        damage: lv(t.damage, powers.frost) * stats.damage, hit: new Set() });
      }
    }
    frostWaves(state, dt, api);

    if (powers.aegis && !fx.aegisReady) {
      fx.aegisTimer -= dt;
      if (fx.aegisTimer <= 0) fx.aegisReady = true;
    }
  }

  // Vrai toutes les `interval` secondes.
  function every(fx, key, interval, dt) {
    fx.timers[key] = (fx.timers[key] ?? interval) - dt;
    if (fx.timers[key] > 0) return false;
    fx.timers[key] += interval;
    return true;
  }

  function fireTrail(state, dt, level, stats, api) {
    const t = TUNING.fireTrail, fx = state.fx, p = state.player;
    const r = t.radius * stats.area;
    // Une flamme tous les `every` pixels parcourus : immobile, on ne sème rien.
    if (!fx.lastDrop || Math.hypot(p.x - fx.lastDrop.x, p.y - fx.lastDrop.y) >= t.every) {
      fx.flames.push({ x: p.x, y: p.y, r, life: lv(t.life, level), max: lv(t.life, level) });
      fx.lastDrop = { x: p.x, y: p.y };
    }
    fx.flames = fx.flames.filter((f) => (f.life -= dt) > 0);
    for (const e of [...state.enemies]) {
      e.burn = Math.max(0, (e.burn || 0) - dt);
      if (e.burn > 0) continue;
      if (!fx.flames.some((f) => Math.hypot(e.x - f.x, e.y - f.y) < f.r + e.size / 2)) continue;
      e.burn = t.tick;
      api.damage(e, t.damage * stats.damage, null, 0);
    }
  }

  function orbs(state, dt, level, stats, api) {
    const t = TUNING.orb, fx = state.fx;
    fx.orbAngle = (fx.orbAngle + t.spin * dt) % (Math.PI * 2);
    const bodies = orbBodies(state, level, stats);
    for (const e of [...state.enemies]) {
      e.orbHit = Math.max(0, (e.orbHit || 0) - dt);
      if (e.orbHit > 0) continue;
      const o = bodies.find((b) => Physics.overlapsBody(b, e));
      if (!o) continue;
      e.orbHit = t.rehit;
      const dx = e.x - state.player.x, dy = e.y - state.player.y;
      const dir = Math.abs(dx) >= Math.abs(dy) ? { x: Math.sign(dx) || 1, y: 0 } : { x: 0, y: Math.sign(dy) || 1 };
      api.damage(e, t.damage * stats.damage, dir, 8);
    }
  }

  // La position des orbes, pour les frapper et pour les dessiner.
  function orbBodies(state, level, stats) {
    const t = TUNING.orb, p = state.player;
    const n = lv(t.count, level);
    const r = t.radius * stats.area;
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = state.fx.orbAngle + (i * Math.PI * 2) / n;
      out.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, size: t.size });
    }
    return out;
  }

  function lightning(state, level, stats, api) {
    const t = TUNING.lightning, p = state.player;
    let from = { x: p.x, y: p.y };
    const struck = new Set();
    for (let hop = 0; hop <= lv(t.chain, level); hop++) {
      const target = state.enemies
        .filter((e) => !struck.has(e) && Math.hypot(e.x - from.x, e.y - from.y) <= t.range * stats.area)
        .sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))[0];
      if (!target) return;
      struck.add(target);
      state.fx.bolts.push({ x1: from.x, y1: from.y, x2: target.x, y2: target.y, life: 0.15 });
      from = { x: target.x, y: target.y };
      api.damage(target, t.damage * stats.damage, null, 0);
    }
  }

  function frostWaves(state, dt, api) {
    const t = TUNING.frost;
    state.fx.waves = state.fx.waves.filter((w) => {
      w.r += t.speed * dt;
      for (const e of [...state.enemies]) {
        if (w.hit.has(e) || Math.hypot(e.x - w.x, e.y - w.y) > w.r) continue;
        w.hit.add(e);
        e.slow = Math.max(e.slow || 0, t.slow);
        if (w.damage > 0) api.damage(e, w.damage, null, 0);
      }
      return w.r < w.max;
    });
  }

  // L'Égide encaisse-t-elle ce coup ? Si oui, elle se vide et se recharge.
  function absorb(state, powers) {
    const fx = state.fx;
    if (!powers.aegis || !fx.aegisReady) return false;
    fx.aegisReady = false;
    fx.aegisTimer = lv(TUNING.aegis.recharge, powers.aegis);
    return true;
  }

  return { MAX_LEVEL, TUNING, fresh, clearZone, update, orbBodies, absorb };
})();

"use strict";

// Les esprits compagnons.
//
// On les rencontre dans le labyrinthe : un esprit errant flotte dans
// certaines salles, et le toucher le fait entrer dans la file qui suit le
// joueur (une bulle dit qui il est, sans arrêter le jeu). Retrouver un
// esprit qu'on a déjà le fait monter d'un niveau ; au niveau 3, il évolue.
//
// Chacun attaque seul, à sa façon. Ils servent aussi d'armure : un coup
// reçu fait tomber le dernier de la file au lieu de coûter un cœur. L'esprit
// tombé reste au sol quelques secondes ; repasser dessus le relève.
//
// Le nombre de places dépend du mode (Config.MODES), plus l'Étendard du roi
// et le Lien spirituel de l'atelier (Stats.allyMax). Leurs dégâts, leur
// cadence et leur portée suivent les caractéristiques du joueur. Comme
// Powers, ce module blesse par `api.damage`, fourni par World.

const Allies = (() => {
  const LONGEST = 8;
  // Espacement dans la file, en unités de trajectoire, et finesse de
  // l'enregistrement de cette trajectoire.
  const SPACING = 20;
  const STEP = 2;
  // Combien de temps un esprit tombé attend qu'on le relève.
  const DOWN_TIME = 5;
  const MAX_LEVEL = 3;

  // Chaque esprit : sa couleur (sa lumière, ses pastilles), ce qu'il dit à la
  // rencontre, le nom de son évolution, son attaque et ses réglages par
  // niveau. Ceux sans `attack` ont leur image mais pas encore leur pouvoir :
  // on ne les rencontre pas.
  const TYPES = {
    sylve: {
      name: "Sylve", color: "#7ddc5a", evolved: "Pluie de flèches",
      says: "Je suis l'esprit de Sylve. Mes flèches veilleront sur toi.",
      attack: "arrows", range: 120, speed: 210,
      levels: [{ cooldown: 0.9, damage: 0.75, arrows: 1 }, { cooldown: 0.85, damage: 0.8, arrows: 3 },
               { cooldown: 0.7, damage: 0.9, arrows: 3, pierce: true }],
    },
    liane: {
      name: "Liane", color: "#3fae4a", evolved: "Ronce",
      says: "Je suis l'esprit de Liane. Mon fouet tiendra tes ennemis à distance.",
      attack: "whip",
      levels: [{ cooldown: 1.0, damage: 1, reach: 30 }, { cooldown: 0.9, damage: 1.1, reach: 32, both: true },
               { cooldown: 0.8, damage: 1.3, reach: 40, both: true, gather: true }],
    },
    braise: {
      name: "Braise", color: "#ff8a3c", evolved: "Brasier",
      says: "Je suis l'esprit de la Braise. Je brûlerai ceux qui te traquent.",
      attack: "fire", range: 140, speed: 75,
      levels: [{ cooldown: 1.4, damage: 1.5, balls: 1 }, { cooldown: 1.3, damage: 1.6, balls: 1, blast: 22 },
               { cooldown: 1.2, damage: 1.8, balls: 3, blast: 26 }],
    },
    petard: { name: "Pétard", color: "#ff4a4a", says: "Je suis l'esprit du Pétard. Boum." },
    givre: { name: "Givre", color: "#8fd8ff", says: "Je suis l'esprit du Givre." },
    orage: { name: "Orage", color: "#ffe26b", says: "Je suis l'esprit de l'Orage." },
    egide: { name: "Égide", color: "#f4f0ff", says: "Je suis l'esprit de l'Égide." },
    gloutonne: { name: "Gloutonne", color: "#ffd23f", says: "Je suis Gloutonne. J'ai faim." },
    ombre: { name: "Ombre", color: "#9a6bd8", says: "Je suis l'esprit de l'Ombre." },
    rosee: { name: "Rosée", color: "#ff8fd0", says: "Je suis l'esprit de la Rosée." },
  };
  // Ceux qu'on peut rencontrer aujourd'hui.
  const POOL = Object.keys(TYPES).filter((k) => TYPES[k].attack);

  const PER = SPACING / STEP;
  const stats = (a) => TYPES[a.type].levels[a.level - 1];

  // L'état propre à la zone : la trajectoire, les esprits tombés, et leurs
  // attaques en cours (flèches, coups de fouet, boules de feu).
  function clearZone(state) {
    const p = state.player;
    state.trail = Array.from({ length: LONGEST * PER + 2 }, () => ({ x: p.x, y: p.y }));
    state.downed = [];
    state.allyShots = [];
    state.whips = [];
    state.fireballs = [];
    for (const a of state.run.allies) {
      a.x = p.x;
      a.y = p.y;
    }
  }

  // Combien d'esprits tiennent dans la file de cette expédition.
  function maxFor(run) {
    const mode = Config.MODES[run.mode] || Config.MODES.normal;
    return Math.min(LONGEST, mode.spirits + Stats.compute(run).allyMax);
  }

  function add(state, type, level = 1) {
    if (!TYPES[type] || state.run.allies.length >= maxFor(state.run)) return false;
    const p = state.player;
    state.run.allies.push({ type, level, x: p.x, y: p.y, cooldown: 0.5 });
    return true;
  }

  // Un esprit rencontré : il rejoint la file, ou fait monter d'un niveau
  // celui qu'on a déjà. Renvoie [titre, détail] pour la bulle, ou null si la
  // file est pleine (l'esprit attend alors qu'on revienne).
  function meet(state, type) {
    const t = TYPES[type];
    const owned = state.run.allies.find((a) => a.type === type);
    if (owned) {
      if (owned.level >= MAX_LEVEL) return [t.name, "Je suis déjà à toi, tout entier."];
      owned.level++;
      return owned.level === MAX_LEVEL ? [`${t.evolved} !`, `${t.name} a évolué.`]
        : [`${t.name} niv. ${owned.level}`, "Je deviens plus fort à tes côtés."];
    }
    if (!add(state, type)) return null;
    return [t.name, t.says];
  }

  // La trajectoire du joueur, un point tous les STEP unités ; chaque esprit
  // se place PER points plus loin que le précédent.
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

  function update(state, dt, st, api) {
    follow(state);
    for (const a of state.run.allies) {
      a.cooldown -= dt;
      if (a.cooldown > 0) continue;
      const kind = TYPES[a.type].attack;
      const done = kind === "arrows" ? shoot(state, a, st)
        : kind === "whip" ? lash(state, a, st, api)
        : kind === "fire" ? throwFire(state, a, st) : false;
      if (done) a.cooldown = stats(a).cooldown * st.cooldown;
    }
    updateShots(state, dt, api);
    updateFire(state, dt, api);
    state.whips = state.whips.filter((w) => (w.life -= dt) > 0);
    updateDowned(state, dt);
  }

  function nearest(state, from, range) {
    let best = null, bd = range;
    for (const e of state.enemies) {
      if (e.hp <= 0 || e.type === "prowler") continue;
      const d = Math.hypot(e.x - from.x, e.y - from.y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  // Sylve : une flèche, puis trois en éventail ; évoluée, elles traversent.
  function shoot(state, a, st) {
    const t = TYPES.sylve, s = stats(a);
    const e = nearest(state, a, t.range * st.area);
    if (!e) return false;
    const base = Math.atan2(e.y - a.y, e.x - a.x);
    const spread = s.arrows > 1 ? 0.26 : 0;
    for (let k = 0; k < s.arrows; k++) {
      const ang = base + (k - (s.arrows - 1) / 2) * spread;
      state.allyShots.push({ x: a.x, y: a.y, vx: Math.cos(ang) * t.speed, vy: Math.sin(ang) * t.speed,
                             size: 3, damage: s.damage * st.damage, life: 1, pierce: !!s.pierce, hit: new Set() });
    }
    return true;
  }

  // Liane : un coup de fouet devant le joueur (et derrière, dès le niveau 2),
  // dès qu'un ennemi est à portée. Évoluée, elle ramène aussi les gemmes.
  function lash(state, a, st, api) {
    const s = stats(a), p = state.player;
    const reach = s.reach * st.area;
    const dirs = [p.facing, ...(s.both ? [{ x: -p.facing.x, y: -p.facing.y }] : [])];
    const inReach = (e, d) => {
      const dx = e.x - p.x, dy = e.y - p.y;
      const along = dx * d.x + dy * d.y, across = Math.abs(dx * d.y - dy * d.x);
      return along > -4 && along < reach + e.size / 2 && across < 10 + e.size / 2;
    };
    const targets = state.enemies.filter((e) => e.hp > 0 && dirs.some((d) => inReach(e, d)));
    if (!targets.length) return false;
    for (const d of dirs) {
      state.whips.push({ x: a.x, y: a.y, tx: p.x + d.x * reach, ty: p.y + d.y * reach, life: 0.2, color: TYPES.liane.color });
    }
    for (const e of targets) {
      const d = dirs.find((dd) => inReach(e, dd));
      api.damage(e, s.damage * st.damage, d, 12);
    }
    if (s.gather) {
      for (const g of state.gems) {
        if (Math.hypot(g.x - p.x, g.y - p.y) < 80) {
          g.x += (p.x - g.x) * 0.6;
          g.y += (p.y - g.y) * 0.6;
        }
      }
    }
    return true;
  }

  // Braise : des boules de feu lentes qui poursuivent l'ennemi le plus
  // proche ; dès le niveau 2, elles explosent à l'impact.
  function throwFire(state, a, st) {
    const t = TYPES.braise, s = stats(a);
    const e = nearest(state, a, t.range * st.area);
    if (!e) return false;
    for (let k = 0; k < s.balls; k++) {
      const ang = Math.atan2(e.y - a.y, e.x - a.x) + (k - (s.balls - 1) / 2) * 0.7;
      state.fireballs.push({ x: a.x, y: a.y, vx: Math.cos(ang) * t.speed, vy: Math.sin(ang) * t.speed, size: 5,
                             damage: s.damage * st.damage, blast: (s.blast || 0) * st.area, life: 3 });
    }
    return true;
  }

  function updateShots(state, dt, api) {
    state.allyShots = state.allyShots.filter((s) => {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.life <= 0 || state.solids.some((r) => Physics.overlapsRect(s, r))) return false;
      const e = state.enemies.find((o) => o.hp > 0 && !s.hit.has(o) && Physics.overlapsBody(o, s));
      if (!e) return true;
      s.hit.add(e);
      const dir = Math.abs(s.vx) >= Math.abs(s.vy) ? { x: Math.sign(s.vx), y: 0 } : { x: 0, y: Math.sign(s.vy) };
      api.damage(e, s.damage, dir, 6);
      return s.pierce;
    });
  }

  function updateFire(state, dt, api) {
    const t = TYPES.braise;
    state.fireballs = state.fireballs.filter((f) => {
      // Elle tourne doucement vers l'ennemi le plus proche.
      const e = nearest(state, f, 200);
      if (e) {
        const want = Math.atan2(e.y - f.y, e.x - f.x), have = Math.atan2(f.vy, f.vx);
        let turn = want - have;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        const ang = have + Math.max(-3 * dt, Math.min(3 * dt, turn));
        f.vx = Math.cos(ang) * t.speed;
        f.vy = Math.sin(ang) * t.speed;
      }
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.life -= dt;
      const wall = state.solids.some((r) => Physics.overlapsRect(f, r));
      const hit = state.enemies.find((o) => o.hp > 0 && Physics.overlapsBody(o, f));
      if (!hit && !wall && f.life > 0) return true;
      if (hit) api.damage(hit, f.damage, null, 0);
      if (f.blast && (hit || wall)) {
        state.blasts.push({ x: f.x, y: f.y, r: f.blast, life: 0.35 });
        for (const o of [...state.enemies]) {
          if (o !== hit && o.hp > 0 && Math.hypot(o.x - f.x, o.y - f.y) < f.blast + o.size / 2) api.damage(o, f.damage * 0.6, null, 0);
        }
      }
      return false;
    });
  }

  // Un coup reçu : le dernier esprit de la file tombe à sa place, et le
  // joueur ne perd pas de cœur. Renvoie false s'il n'y avait personne.
  function absorb(state) {
    const a = state.run.allies.pop();
    if (!a) return false;
    state.downed.push({ type: a.type, level: a.level, x: a.x, y: a.y, time: DOWN_TIME });
    return true;
  }

  // Les esprits tombés : on les relève en passant dessus, avant qu'ils ne
  // s'éteignent.
  function updateDowned(state, dt) {
    const p = state.player;
    state.downed = state.downed.filter((d) => {
      d.time -= dt;
      if (d.time <= 0) return false;
      if (Math.hypot(d.x - p.x, d.y - p.y) < (p.size + 10) / 2 && state.run.allies.length < maxFor(state.run)) {
        state.run.allies.push({ type: d.type, level: d.level, x: d.x, y: d.y, cooldown: 0.3 });
        state.popups.push({ x: d.x, y: d.y - 4, text: "relevé !", time: 0.8 });
        if (state.events) state.events.push({ type: "revive", x: d.x, y: d.y });
        return false;
      }
      return true;
    });
  }

  return { TYPES, POOL, MAX_LEVEL, DOWN_TIME, maxFor, clearZone, add, meet, update, absorb };
})();

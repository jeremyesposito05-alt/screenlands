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
    // Pétard : des bombes à la Bomberman, qui explosent en croix le long des
    // cases, arrêtées par les murs. Évoluées, elles se déclenchent entre elles.
    petard: {
      name: "Pétard", color: "#ff4a4a", evolved: "Chaîne",
      says: "Je suis l'esprit du Pétard. Écarte-toi quand ça fume !",
      attack: "bomb",
      levels: [{ cooldown: 2.4, damage: 2, length: 2, bombs: 1 }, { cooldown: 2.2, damage: 2.2, length: 3, bombs: 1 },
               { cooldown: 2, damage: 2.5, length: 4, bombs: 2, chain: true }],
    },
    // Givre : une onde qui ralentit tout autour du joueur ; évoluée, elle gèle.
    givre: {
      name: "Givre", color: "#8fd8ff", evolved: "Blizzard",
      says: "Je suis l'esprit du Givre. Rien ne te rattrapera.",
      attack: "frost",
      levels: [{ cooldown: 2.6, radius: 38, slow: 1.6 }, { cooldown: 2.4, radius: 52, slow: 2 },
               { cooldown: 2.2, radius: 60, slow: 2, freeze: 1, damage: 0.5 }],
    },
    // Orage : un éclair qui saute d'un ennemi à l'autre.
    orage: {
      name: "Orage", color: "#ffe26b", evolved: "Tempête",
      says: "Je suis l'esprit de l'Orage. Que le ciel gronde !",
      attack: "bolt", range: 130, hop: 64,
      levels: [{ cooldown: 1.6, damage: 1.2, jumps: 1 }, { cooldown: 1.5, damage: 1.2, jumps: 3 },
               { cooldown: 1.3, damage: 1.4, jumps: 6, stun: 0.4 }],
    },
    // Égide : elle quitte la file et tourne autour du joueur ; elle arrête les
    // tirs, puis repousse ce qui la touche, puis renvoie les tirs.
    egide: {
      name: "Égide", color: "#f4f0ff", evolved: "Miroir", orbit: true,
      says: "Je suis l'esprit de l'Égide. Je serai ton bouclier.",
      attack: "guard",
      levels: [{ radius: 16, spin: 3 }, { radius: 17, spin: 3.4, damage: 0.8 }, { radius: 18, spin: 3.8, damage: 1, reflect: true }],
    },
    // Gloutonne : elle gobe les gemmes à portée, et les ennemis assez faibles ;
    // évoluée, même les rôdeurs.
    gloutonne: {
      name: "Gloutonne", color: "#ffd23f", evolved: "Dévoreuse",
      says: "Je suis Gloutonne. J'ai faim, tellement faim…",
      attack: "gobble",
      levels: [{ cooldown: 1.6, pull: 36, eats: 1 }, { cooldown: 1.4, pull: 46, eats: 3 },
               { cooldown: 1.2, pull: 60, eats: 6, prowlers: true }],
    },
    // Ombre : un leurre que les ennemis poursuivent à la place du joueur ;
    // évolué, il explose à la fin.
    ombre: {
      name: "Ombre", color: "#9a6bd8", evolved: "Double",
      says: "Je suis l'esprit de l'Ombre. Qu'ils me suivent, moi.",
      attack: "decoy",
      levels: [{ cooldown: 8, time: 3 }, { cooldown: 7, time: 4.5 }, { cooldown: 6, time: 4.5, blast: 34, damage: 2 }],
    },
    // Rosée : elle relève toute seule les esprits tombés, puis rend des cœurs.
    rosee: {
      name: "Rosée", color: "#ff8fd0", evolved: "Source",
      says: "Je suis l'esprit de la Rosée. Je panserai tes blessures.",
      attack: "heal",
      levels: [{ revive: 2 }, { revive: 1.5, heal: 90 }, { revive: 0.5, heal: 45 }],
    },
  };
  // Tous ceux qui ont un pouvoir.
  const POOL = Object.keys(TYPES).filter((k) => TYPES[k].attack);
  // Où on les rencontre : les trois premiers partout ; les suivants d'abord
  // aux étages profonds (à partir de l'étage `TIER`), puis partout une fois
  // rencontrés (le carnet de Save). Gloutonne ne vient qu'à qui a attrapé
  // 5 rôdeurs.
  const TIER = { sylve: 1, liane: 1, braise: 1, petard: 2, givre: 2, orage: 2, egide: 3, ombre: 3, rosee: 3, gloutonne: 2 };
  function canMeet(type, floor) {
    if (type === "gloutonne" && !Save.data.found.flags.prowlers5) return false;
    return floor >= TIER[type] || Save.data.found.spirits.includes(type);
  }

  const PER = SPACING / STEP;
  const stats = (a) => TYPES[a.type].levels[a.level - 1];

  // L'état propre à la zone : la trajectoire, les esprits tombés, et leurs
  // attaques en cours : flèches, coups de fouet, boules de feu, bombes et
  // leurs croix d'explosion, ondes de givre, éclairs, et le leurre de l'Ombre.
  function clearZone(state) {
    const p = state.player;
    state.trail = Array.from({ length: LONGEST * PER + 2 }, () => ({ x: p.x, y: p.y }));
    state.downed = [];
    state.allyShots = [];
    state.whips = [];
    state.fireballs = [];
    state.bombs = [];
    state.crosses = [];
    state.waves = [];
    state.bolts = [];
    state.decoy = null;
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
    // L'Égide ne prend pas de place dans la file : elle tourne autour du joueur.
    let i = 0;
    for (const a of state.run.allies) {
      const ty = TYPES[a.type];
      if (ty.orbit) {
        a.angle = (a.angle || 0);
        a.x = p.x + Math.cos(a.angle) * stats(a).radius;
        a.y = p.y + 4 + Math.sin(a.angle) * stats(a).radius * 0.7;
        continue;
      }
      const pt = t[Math.max(0, t.length - 1 - (i + 1) * PER)];
      a.x = pt.x;
      a.y = pt.y;
      i++;
    }
  }

  function update(state, dt, st, api) {
    follow(state);
    for (const a of state.run.allies) {
      a.cooldown -= dt;
      if (a.cooldown > 0) continue;
      const kind = TYPES[a.type].attack;
      const done = kind === "arrows" ? shoot(state, a, st)
        : kind === "whip" ? lash(state, a, st, api)
        : kind === "fire" ? throwFire(state, a, st)
        : kind === "bomb" ? dropBomb(state, a, st)
        : kind === "frost" ? chill(state, a, st, api)
        : kind === "bolt" ? strike(state, a, st, api)
        : kind === "gobble" ? gobble(state, a, api)
        : kind === "decoy" ? lure(state, a) : false;
      if (done) a.cooldown = stats(a).cooldown * st.cooldown;
    }
    updateShots(state, dt, api);
    updateFire(state, dt, api);
    updateBombs(state, dt, st, api);
    updateGuards(state, dt, st, api);
    updateDecoy(state, dt, api);
    heal(state, dt);
    state.crosses = state.crosses.filter((c) => (c.life -= dt) > 0);
    state.bolts = state.bolts.filter((b) => (b.life -= dt) > 0);
    state.waves = state.waves.filter((w) => (w.life -= dt) > 0);
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

  // --- Pétard : des bombes à la Bomberman ---
  // La bombe est posée au centre de la case de l'esprit ; à la fin de sa
  // mèche, elle explose en croix, case par case, jusqu'à `length` cases ou au
  // premier mur. Elle ne blesse que les ennemis. Évoluées, les bombes prises
  // dans une croix explosent aussitôt.
  const T = Config.TILE;
  const FUSE = 1.4;
  function dropBomb(state, a, st) {
    const s = stats(a);
    if (!state.enemies.some((e) => e.hp > 0 && e.type !== "prowler")) return false;
    if (state.bombs.filter((b) => b.owner === a).length >= s.bombs) return false;
    const x = Math.floor(a.x / T) * T + T / 2, y = Math.floor(a.y / T) * T + T / 2;
    if (state.bombs.some((b) => b.x === x && b.y === y)) return false;
    state.bombs.push({ owner: a, x, y, fuse: FUSE, length: s.length, damage: s.damage * st.damage, chain: !!s.chain });
    return true;
  }

  function solidAt(state, x, y) {
    return x < 0 || y < 0 || x > Config.ZONE_W || y > Config.ZONE_H ||
      state.solids.some((r) => Physics.overlapsRect({ x, y, size: 6 }, r));
  }

  function explode(state, b, api) {
    const cells = [{ x: b.x, y: b.y }];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let k = 1; k <= b.length; k++) {
        const x = b.x + dx * k * T, y = b.y + dy * k * T;
        if (solidAt(state, x, y)) break;
        cells.push({ x, y });
      }
    }
    state.crosses.push({ cells, life: 0.4 });
    if (state.events) state.events.push({ type: "explode", x: b.x, y: b.y });
    const inCross = (o) => cells.some((c) => Math.abs(o.x - c.x) < T / 2 + o.size / 2 && Math.abs(o.y - c.y) < T / 2 + o.size / 2);
    for (const e of [...state.enemies]) if (e.hp > 0 && inCross(e)) api.damage(e, b.damage, null, 0);
    if (b.chain) for (const o of state.bombs) if (o !== b && o.fuse > 0 && inCross({ x: o.x, y: o.y, size: 4 })) o.fuse = 0.05;
  }

  function updateBombs(state, dt, st, api) {
    const ready = [];
    for (const b of state.bombs) if ((b.fuse -= dt) <= 0) ready.push(b);
    if (!ready.length) return;
    state.bombs = state.bombs.filter((b) => !ready.includes(b));
    for (const b of ready) explode(state, b, api);
  }

  // --- Givre : une onde qui ralentit, puis qui gèle ---
  function chill(state, a, st, api) {
    const s = stats(a), p = state.player, r = s.radius * st.area;
    const near = state.enemies.filter((e) => e.hp > 0 && Math.hypot(e.x - p.x, e.y - p.y) < r + e.size / 2);
    if (!near.length) return false;
    state.waves.push({ x: p.x, y: p.y, r, life: 0.45, max: 0.45, color: TYPES.givre.color });
    for (const e of near) {
      e.slow = Math.max(e.slow || 0, s.slow);
      if (s.freeze && e.type !== "hunter") Enemies.stun(e, s.freeze);
      if (s.damage) api.damage(e, s.damage * st.damage, null, 0);
    }
    return true;
  }

  // --- Orage : un éclair qui saute d'ennemi en ennemi ---
  function strike(state, a, st, api) {
    const t = TYPES.orage, s = stats(a);
    let from = { x: a.x, y: a.y - 9 }, target = nearest(state, a, t.range * st.area);
    if (!target) return false;
    const hit = new Set(), pts = [from];
    for (let k = 0; k < s.jumps && target; k++) {
      hit.add(target);
      pts.push({ x: target.x, y: target.y });
      api.damage(target, s.damage * st.damage, null, 0);
      if (s.stun && target.hp > 0) Enemies.stun(target, s.stun);
      from = target;
      let best = null, bd = t.hop;
      for (const e of state.enemies) {
        if (e.hp <= 0 || hit.has(e) || e.type === "prowler") continue;
        const d = Math.hypot(e.x - from.x, e.y - from.y);
        if (d < bd) { bd = d; best = e; }
      }
      target = best;
    }
    state.bolts.push({ pts, life: 0.18 });
    return true;
  }

  // --- Égide : le bouclier qui tourne ---
  // Elle arrête les tirs qui la touchent ; dès le niveau 2, elle frappe ce
  // qu'elle heurte ; évoluée, elle renvoie les tirs vers l'ennemi le plus
  // proche.
  function updateGuards(state, dt, st, api) {
    for (const a of state.run.allies) {
      if (TYPES[a.type].attack !== "guard") continue;
      const s = stats(a);
      a.angle = (a.angle || 0) + s.spin * dt;
      a.hits = a.hits || new Map();
      state.bullets = (state.bullets || []).filter((b) => {
        if (Math.hypot(b.x - a.x, b.y - (a.y - 9)) > 8) return true;
        if (s.reflect) {
          const e = nearest(state, a, 200);
          if (e) {
            const d = Math.hypot(e.x - a.x, e.y - a.y) || 1;
            state.allyShots.push({ x: a.x, y: a.y - 9, vx: ((e.x - a.x) / d) * 200, vy: ((e.y - a.y) / d) * 200,
                                   size: 3, damage: 1.5 * st.damage, life: 1, pierce: false, hit: new Set() });
          }
        }
        return false;
      });
      if (!s.damage) continue;
      for (const [e, t] of a.hits) {
        if (t - dt <= 0) a.hits.delete(e);
        else a.hits.set(e, t - dt);
      }
      for (const e of state.enemies) {
        if (e.hp <= 0 || a.hits.has(e) || Math.hypot(e.x - a.x, e.y - a.y) > 8 + e.size / 2) continue;
        a.hits.set(e, 0.5);
        const dx = e.x - state.player.x, dy = e.y - state.player.y;
        const dir = Math.abs(dx) >= Math.abs(dy) ? { x: Math.sign(dx) || 1, y: 0 } : { x: 0, y: Math.sign(dy) || 1 };
        api.damage(e, s.damage * st.damage, dir, 10);
      }
    }
  }

  // --- Gloutonne : elle gobe ---
  // Les gemmes à portée filent vers elle et sont ramassées ; un ennemi assez
  // faible à sa portée est avalé d'un coup ; évoluée, elle avale aussi les
  // rôdeurs.
  function gobble(state, a, api) {
    const s = stats(a);
    for (const g of state.gems) {
      if (Math.hypot(g.x - a.x, g.y - a.y) < s.pull) {
        g.x += (a.x - g.x) * 0.5;
        g.y += (a.y - g.y) * 0.5;
      }
    }
    const caught = state.gems.filter((g) => Math.hypot(g.x - a.x, g.y - a.y) < 6);
    if (caught.length) {
      state.gems = state.gems.filter((g) => !caught.includes(g));
      for (const g of caught) api.collect(g);
    }
    const prey = state.enemies.find((e) => e.hp > 0 && Math.hypot(e.x - a.x, e.y - a.y) < 18 &&
      (e.type === "prowler" ? s.prowlers : e.hp <= s.eats && e.slot !== "boss"));
    if (!prey) return caught.length > 0;
    if (prey.type === "prowler") api.devour(prey);
    else api.damage(prey, 999, null, 0);
    if (state.events) state.events.push({ type: "devour", x: prey.x, y: prey.y });
    return true;
  }

  // --- Ombre : le leurre ---
  // Tant qu'il est là, les ennemis le poursuivent à la place du joueur (World
  // le leur donne comme cible). Évolué, il explose en disparaissant.
  function lure(state, a) {
    if (state.decoy || !state.enemies.some((e) => e.hp > 0)) return false;
    const s = stats(a);
    state.decoy = { x: a.x, y: a.y, life: s.time, max: s.time, blast: s.blast || 0, damage: s.damage || 0,
                    facing: { x: 0, y: 1 } };
    return true;
  }

  function updateDecoy(state, dt, api) {
    const d = state.decoy;
    if (!d || (d.life -= dt) > 0) return;
    state.decoy = null;
    if (!d.blast) return;
    state.blasts.push({ x: d.x, y: d.y, r: d.blast, life: 0.35 });
    if (state.events) state.events.push({ type: "explode", x: d.x, y: d.y });
    for (const e of [...state.enemies]) {
      if (e.hp > 0 && Math.hypot(e.x - d.x, e.y - d.y) < d.blast + e.size / 2) api.damage(e, d.damage, null, 0);
    }
  }

  // --- Rosée : elle soigne ---
  // Les esprits tombés se relèvent seuls au bout de `revive` secondes ; dès
  // le niveau 2, un cœur revient toutes les `heal` secondes.
  function heal(state, dt) {
    const a = state.run.allies.find((x) => TYPES[x.type].attack === "heal");
    if (!a) return;
    const s = stats(a), p = state.player;
    for (const d of state.downed) if (DOWN_TIME - d.time >= s.revive) d.rose = true;
    if (!s.heal || p.hp >= p.maxHp) return;
    a.heal = (a.heal || 0) + dt;
    if (a.heal < s.heal) return;
    a.heal = 0;
    p.hp++;
    state.popups.push({ x: p.x, y: p.y - 12, text: "+1 cœur", time: 0.9 });
    if (state.events) state.events.push({ type: "revive", x: p.x, y: p.y });
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
      // Relevé en passant dessus, ou tout seul grâce à la Rosée.
      const touched = d.rose || Math.hypot(d.x - p.x, d.y - p.y) < (p.size + 10) / 2;
      if (touched && state.run.allies.length < maxFor(state.run)) {
        state.run.allies.push({ type: d.type, level: d.level, x: d.x, y: d.y, cooldown: 0.3 });
        state.popups.push({ x: d.x, y: d.y - 4, text: "relevé !", time: 0.8 });
        if (state.events) state.events.push({ type: "revive", x: d.x, y: d.y });
        return false;
      }
      return true;
    });
  }

  return { TYPES, POOL, MAX_LEVEL, DOWN_TIME, canMeet, maxFor, clearZone, add, meet, update, absorb };
})();

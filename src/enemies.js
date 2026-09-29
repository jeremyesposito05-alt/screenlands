"use strict";

// Les ennemis, construits par assemblage.
//
// L'idée vient des fantômes de Pac-Man : ils se déplacent tous de la même
// façon, et ne diffèrent que par le point qu'ils visent. L'un vise le joueur,
// l'autre la case devant lui, le troisième se sert du premier pour prendre
// le joueur en tenaille, le dernier s'approche puis recule. Quatre règles
// d'une ligne suffisent à ce que le groupe semble jouer ensemble.
//
// Un type d'ennemi est donc une fiche (TYPES) qui choisit une règle de visée
// dans TARGETS et règle ses statistiques. Ajouter un ennemi, c'est écrire une
// fiche ; ajouter une façon de viser, c'est écrire une règle, que toutes les
// fiches peuvent ensuite reprendre. Le déplacement, lui, est commun à tous :
// le plus court chemin vers la cible, calculé par Nav.

const Enemies = (() => {
  const SHY_RADIUS = Config.TILE * 4;
  // En deçà, l'Embusqueur et le Tenailleur cessent de manœuvrer et foncent.
  const LUNGE_RADIUS = Config.TILE * 3.5;
  // Un ennemi qui manœuvre (Embusqueur, Tenailleur) et atteint son point de
  // visée est en position : il fonce alors sur le joueur pendant LUNGE_TIME.
  // Sans ça, il resterait planté devant un joueur immobile.
  const LUNGE_TIME = 2.5;
  // Le chemin est recalculé à chaque case atteinte, et au moins aussi souvent
  // que ça : la cible bouge.
  const REPLAN = 0.2;

  const near = (e, p, r) => Math.hypot(p.x - e.x, p.y - e.y) < r;

  // Une règle de visée reçoit l'ennemi, le joueur et les ennemis de la zone,
  // et renvoie le point vers lequel il se dirige.
  const TARGETS = {
    // Le joueur lui-même. Le plus simple, et le plus tenace.
    player(e, p) {
      return { x: p.x, y: p.y };
    },

    // Trois tuiles devant le joueur, dans la direction où il regarde : il
    // cherche à couper la route plutôt qu'à suivre. Une fois en position, il
    // se jette sur lui.
    ahead(e, p) {
      if (near(e, p, LUNGE_RADIUS)) return { x: p.x, y: p.y };
      const lead = Config.TILE * 3;
      return { x: p.x + p.facing.x * lead, y: p.y + p.facing.y * lead };
    },

    // Le symétrique du Traqueur par rapport à un point devant le joueur : quand
    // le Traqueur arrive par derrière, il arrive par devant. Sans Traqueur dans
    // la zone, ou une fois en position, il vise le joueur.
    pincer(e, p, others) {
      const chaser = others.find((o) => o.type === "chaser");
      if (!chaser || near(e, p, LUNGE_RADIUS)) return { x: p.x, y: p.y };
      const pivot = { x: p.x + p.facing.x * Config.TILE * 2,
                      y: p.y + p.facing.y * Config.TILE * 2 };
      return { x: 2 * pivot.x - chaser.x, y: 2 * pivot.y - chaser.y };
    },

    // Fonce sur le joueur de loin, mais recule vers son point d'apparition dès
    // qu'il est à moins de SHY_RADIUS : il tourne autour, imprévisible, et
    // frappe quand on le coince.
    shy(e, p) {
      if (!near(e, p, SHY_RADIUS)) return { x: p.x, y: p.y };
      return { x: e.home.x, y: e.home.y };
    },
  };

  // `from` : distance au camp de base à partir de laquelle il apparaît.
  // `speed` s'ajoute à la vitesse commune, qui croît déjà avec la distance.
  const TYPES = {
    chaser: { name: "Traqueur", kind: "chaser", from: 1, size: 10, hp: 1, damage: 1, speed: 0, target: "player" },
    ambusher: { name: "Embusqueur", kind: "ambusher", from: 2, size: 10, hp: 1, damage: 1, speed: 6, target: "ahead", lunges: true },
    shy: { name: "Craintif", kind: "shy", from: 3, size: 10, hp: 2, damage: 1, speed: 8, target: "shy" },
    pincer: { name: "Tenailleur", kind: "pincer", from: 4, size: 10, hp: 1, damage: 1, speed: 2, target: "pincer", lunges: true },
    // Le Chasseur n'est jamais tiré dans une zone (`from` infini) : World le
    // fait venir au dernier palier de menace. Invincible, il ne se laisse
    // même pas étourdir.
    hunter: { name: "Chasseur", kind: "hunter", from: Infinity, size: 10, hp: Infinity, damage: 1, speed: 0, target: "player" },
  };

  // Tous les ennemis ont la même taille : une seule grille de navigation par
  // zone suffit.
  const SIZE = 10;

  // La composition d'une zone : `count` types tirés parmi ceux permis à
  // cette distance. Le premier est toujours un Traqueur, qui donne son sens
  // au Tenailleur. Tiré avec le générateur de la zone, donc stable : une zone
  // retrouvée aligne les mêmes ennemis.
  function roster(count, distance, rng) {
    const allowed = Object.keys(TYPES).filter((t) => TYPES[t].from <= distance);
    const list = [];
    for (let i = 0; i < count; i++) list.push(i === 0 ? "chaser" : rng.pick(allowed));
    return list;
  }

  // `opts.elite` : une élite a deux fois plus de points de vie, plus un, et
  // court plus vite. `opts.speed` s'ajoute à la vitesse (la menace).
  function spawn(type, at, distance, opts = {}) {
    const t = TYPES[type];
    let hp = t.hp + Math.floor(distance / Config.ENEMY_HP_EVERY);
    let speed = Config.ENEMY_SPEED + t.speed + Config.ENEMY_SPEED_PER_DISTANCE * distance + (opts.speed || 0);
    if (opts.elite) {
      hp = hp * 2 + 1;
      speed += Config.ELITE_SPEED;
    }
    return {
      kind: t.kind,
      type,
      elite: !!opts.elite,
      x: at.x,
      y: at.y,
      home: { x: at.x, y: at.y },
      size: t.size,
      hp,
      damage: t.damage,
      speed,
      wake: Config.ENEMY_WAKE,
      // Étourdi après un coup : immobile et inoffensif.
      stun: 0,
      // Dernière direction prise : le rendu s'en sert pour les yeux.
      look: { x: 0, y: 1 },
      // Le prochain point de passage et le temps avant de le recalculer.
      waypoint: null,
      replan: 0,
      // Temps restant de la charge, une fois en position, et position à
      // l'image précédente, pour savoir s'il est bloqué.
      lunge: 0,
      lastX: null,
      lastY: null,
    };
  }

  // Un ennemi qui peut faire mal : réveillé et pas étourdi.
  function harmful(e) {
    return e.wake <= 0 && e.stun <= 0;
  }

  // Encaisse un coup venu de `dir` et renvoie true s'il en meurt.
  function hit(e, dir, solids, damage = 1, knockback = Config.ENEMY_KNOCKBACK) {
    e.hp -= damage;
    stun(e, Config.ENEMY_STUN);
    Physics.moveAxis(e, dir.x ? "x" : "y", (dir.x || dir.y) * knockback, solids);
    return e.hp <= 0;
  }

  // Étourdi sans être blessé : immobile et inoffensif pendant `time`. Le
  // Chasseur, lui, ne s'arrête jamais.
  function stun(e, time) {
    if (e.type === "hunter") return;
    e.stun = Math.max(e.stun, time);
    e.wake = 0;
    e.lunge = 0;
    e.waypoint = null;
  }

  function step(e, player, others, dt, nav, solids) {
    if (e.stun > 0) {
      e.stun -= dt;
      return;
    }
    if (e.wake > 0) {
      e.wake -= dt;
      return;
    }

    // Une cible hors de l'écran (devant un joueur qui regarde une porte, par
    // exemple) est ramenée à l'intérieur des murs.
    const type = TYPES[e.type];
    let raw;
    if (e.lunge > 0) {
      e.lunge -= dt;
      raw = { x: player.x, y: player.y };
    } else {
      raw = TARGETS[type.target](e, player, others);
    }
    const m = Config.WALL + e.size / 2;
    const target = {
      x: Math.min(Math.max(raw.x, m), Config.ZONE_W - m),
      y: Math.min(Math.max(raw.y, m), Config.ZONE_H - m),
    };
    // En position : son point de visée est atteint, ou aussi près que les
    // obstacles le permettent (il n'avance plus). Il charge.
    if (type.lunges && e.lunge <= 0) {
      const still = e.lastX !== null && Math.abs(e.lastX - e.x) + Math.abs(e.lastY - e.y) < 0.01;
      if (near(e, target, Config.TILE) || (still && e.waypoint)) e.lunge = LUNGE_TIME;
    }
    e.lastX = e.x;
    e.lastY = e.y;

    e.replan -= dt;
    const w = e.waypoint;
    if (!w || e.replan <= 0 || (Math.abs(w.x - e.x) < 0.5 && Math.abs(w.y - e.y) < 0.5)) {
      e.waypoint = Nav.nextStep(nav, e, target);
      e.replan = REPLAN;
    }

    // Vers le point de passage, un seul axe à la fois : l'axe le plus écarté
    // d'abord, l'autre s'il est bloqué. Sans jamais dépasser le point.
    const budget = e.speed * dt;
    const dx = e.waypoint.x - e.x;
    const dy = e.waypoint.y - e.y;
    const axes = Math.abs(dx) >= Math.abs(dy) ? [["x", dx], ["y", dy]] : [["y", dy], ["x", dx]];
    for (const [axis, d] of axes) {
      if (Math.abs(d) < 0.01) continue;
      const s = Math.sign(d);
      e.look = axis === "x" ? { x: s, y: 0 } : { x: 0, y: s };
      if (!Physics.moveAxis(e, axis, s * Math.min(budget, Math.abs(d)), solids)) break;
    }
  }

  return { TYPES, SIZE, roster, spawn, step, hit, stun, harmful };
})();

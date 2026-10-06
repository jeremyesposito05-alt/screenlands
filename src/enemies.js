"use strict";

// Les ennemis, construits par assemblage.
//
// L'idée vient des fantômes de Pac-Man : ils se déplacent tous de la même
// façon, et ne diffèrent que par le point qu'ils visent. L'un vise le joueur,
// l'autre la case devant lui, le troisième se sert du premier pour prendre
// le joueur en tenaille, le dernier s'approche puis recule.
//
// Un type d'ennemi est donc une fiche (TYPES) qui assemble trois briques :
// - une règle de visée, dans TARGETS : où il veut aller ;
// - une capacité facultative, dans ABILITIES : tirer, exploser, charger ;
// - des statistiques : taille, points de vie, vitesse, et `heavy` pour ceux
//   que les coups ne font pas reculer.
// Ajouter un ennemi, c'est écrire une fiche ; ajouter une manœuvre ou une
// capacité, c'est écrire une règle que toutes les fiches peuvent reprendre.
// Le déplacement est commun à tous : le plus court chemin vers la cible,
// calculé par Nav pour leur taille.
//
// Ce module ne sait ni blesser le joueur ni créer de projectile : il passe
// par les crochets `ctx.fire` et `ctx.explode` que fournit World.

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

  // --- Règles de visée ---
  // Chacune reçoit l'ennemi, le joueur et les ennemis de la zone, et renvoie
  // le point vers lequel il se dirige.
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

    // Garde ses distances : recule si le joueur approche, s'avance s'il
    // s'éloigne, et reste en place entre les deux, pour tirer.
    keepAway(e, p) {
      const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
      if (d < 64) return { x: p.x + ((e.x - p.x) / d) * 96, y: p.y + ((e.y - p.y) / d) * 96 };
      if (d > 112) return { x: p.x, y: p.y };
      return { x: e.x, y: e.y };
    },

    // Chaque membre d'un essaim vise un point autour du joueur, sur un cercle
    // qui tourne : ensemble, ils l'encerclent au lieu de s'empiler. Le cercle
    // respire, chacun à son rythme : il se resserre assez pour mordre, puis
    // s'écarte.
    swarm(e, p) {
      const a = e.angle + e.age * 1.6;
      const r = 11 + 9 * Math.sin(e.age * 2.4 + e.angle * 1.7);
      return { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r };
    },

    // La fuite : droit à l'opposé du joueur. C'est ce que font les rôdeurs
    // quand la super-gemme les a rendus bleus.
    flee(e, p) {
      const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
      return { x: e.x + ((e.x - p.x) / d) * 96, y: e.y + ((e.y - p.y) / d) * 96 };
    },
  };

  // --- Capacités ---
  // Chacune est appelée à chaque pas, avant le déplacement ; si elle renvoie
  // true, l'ennemi ne se déplace pas ce pas-ci (il vise, il va exploser, il
  // charge déjà).
  const ABILITIES = {
    // Vise une demi-seconde (il clignote), puis tire vers le joueur.
    shoot(e, ctx, dt, a) {
      e.cooldown -= dt;
      if (e.windup > 0) {
        e.windup -= dt;
        if (e.windup <= 0) {
          const p = ctx.player;
          const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
          ctx.fire(e, { x: (p.x - e.x) / d, y: (p.y - e.y) / d }, a.bulletSpeed);
          e.cooldown = a.cooldown;
        }
        return true;
      }
      if (e.cooldown <= 0 && near(e, ctx.player, a.range)) {
        e.windup = a.windup;
        return true;
      }
      return false;
    },

    // Près du joueur, allume sa mèche, s'arrête, clignote, et explose.
    explode(e, ctx, dt, a) {
      if (e.fuse > 0) {
        e.fuse -= dt;
        if (e.fuse <= 0) ctx.explode(e, a.radius, a.enemyDamage);
        return true;
      }
      if (near(e, ctx.player, a.trigger)) {
        e.fuse = a.fuse;
        return true;
      }
      return false;
    },

    // S'arrête, prévient, puis charge en ligne droite vers le joueur.
    dash(e, ctx, dt, a) {
      e.cooldown -= dt;
      if (e.dashing > 0) {
        e.dashing -= dt;
        const d = e.dashDir;
        if (Physics.moveAxis(e, d.x ? "x" : "y", (d.x || d.y) * a.speed * dt, ctx.solids)) e.dashing = 0;
        return true;
      }
      if (e.windup > 0) {
        e.windup -= dt;
        if (e.windup <= 0) {
          const p = ctx.player;
          const dx = p.x - e.x, dy = p.y - e.y;
          e.dashDir = Math.abs(dx) >= Math.abs(dy) ? { x: Math.sign(dx) || 1, y: 0 } : { x: 0, y: Math.sign(dy) || 1 };
          e.look = e.dashDir;
          e.dashing = a.time;
          e.cooldown = a.every;
        }
        return true;
      }
      if (e.cooldown <= 0) {
        e.windup = a.windup;
        return true;
      }
      return false;
    },
  };

  // `from` : distance au camp de base à partir de laquelle il apparaît.
  // `speed` s'ajoute à la vitesse commune, qui croît déjà avec la distance.
  // `group` : combien d'individus pour une place de la liste (l'essaim).
  const TYPES = {
    chaser: { name: "Traqueur", kind: "chaser", from: 1, size: 10, hp: 1, damage: 1, speed: 0, target: "player" },
    ambusher: { name: "Embusqueur", kind: "ambusher", from: 2, size: 10, hp: 1, damage: 1, speed: 6, target: "ahead", lunges: true },
    shooter: {
      name: "Tireur", kind: "shooter", from: 2, size: 10, hp: 1, damage: 1, speed: -6, target: "keepAway",
      ability: { name: "shoot", cooldown: 2.2, windup: 0.45, range: 150, bulletSpeed: 95 },
    },
    shy: { name: "Craintif", kind: "shy", from: 3, size: 10, hp: 2, damage: 1, speed: 8, target: "shy" },
    bomber: {
      name: "Kamikaze", kind: "bomber", from: 3, size: 9, hp: 1, damage: 1, speed: 14, target: "player",
      ability: { name: "explode", trigger: 22, fuse: 0.7, radius: 28, enemyDamage: 2 },
    },
    // `fragile` : ses points de vie ne grossissent pas avec la distance ; un
    // coup suffit toujours.
    swarm: { name: "Essaim", kind: "swarm", from: 3, size: 6, hp: 0.5, damage: 1, speed: 18, target: "swarm", group: 4, fragile: true },
    pincer: { name: "Tenailleur", kind: "pincer", from: 4, size: 10, hp: 1, damage: 1, speed: 2, target: "pincer", lunges: true },
    brute: { name: "Colosse", kind: "brute", from: 4, size: 12, hp: 5, damage: 1, speed: -14, target: "player", heavy: true },
    // Le Gardien n'est jamais tiré au hasard : Generator en place un au bout
    // de chaque carte.
    guardian: {
      name: "Gardien", kind: "guardian", from: Infinity, size: 14, hp: 16, damage: 1, speed: -10, target: "player", heavy: true,
      ability: { name: "dash", every: 3.2, windup: 0.6, speed: 165, time: 0.45 },
    },
    // Le rôdeur, le fantôme de Pac-Man : rapide, collant, impossible à tuer.
    // Les coups le repoussent et l'étourdissent, sans plus. World en place un
    // ou deux dans certaines salles, avec une super-gemme : ramassée, elle le
    // rend bleu (`frightened`) ; il fuit, et le toucher le dévore.
    prowler: { name: "Rôdeur", kind: "prowler", from: Infinity, size: 10, hp: Infinity, damage: 1, speed: 6, target: "player" },
    // Le Chasseur non plus : World le fait venir au dernier palier de menace.
    // Invincible, il ne se laisse même pas étourdir.
    hunter: { name: "Chasseur", kind: "hunter", from: Infinity, size: 10, hp: Infinity, damage: 1, speed: 0, target: "player" },
  };

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
  // court plus vite. `opts.speed` s'ajoute à la vitesse (la menace). `opts.hp`
  // remplace les points de vie de départ (le Gardien, qui grossit avec la
  // carte).
  function spawn(type, at, distance, opts = {}) {
    const t = TYPES[type];
    let hp = (opts.hp ?? t.hp) + (t.fragile ? 0 : Math.floor(distance / Config.ENEMY_HP_EVERY));
    let speed = Config.ENEMY_SPEED + t.speed + Config.ENEMY_SPEED_PER_DISTANCE * distance + (opts.speed || 0);
    if (opts.elite) {
      hp = hp * 2 + 1;
      speed += Config.ELITE_SPEED;
    }
    return {
      kind: t.kind,
      type,
      elite: !!opts.elite,
      heavy: !!t.heavy,
      // La place qu'il occupe dans la liste de la zone : les membres d'un
      // essaim la partagent, et ne comptent pour un mort qu'au dernier.
      slot: opts.slot,
      x: at.x,
      y: at.y,
      home: { x: at.x, y: at.y },
      size: t.size,
      hp,
      maxHp: hp,
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
      // Capacités : délai avant la prochaine, préparation (le clignotement
      // d'avertissement), mèche, charge en cours.
      cooldown: t.ability ? t.ability.cooldown ?? t.ability.every ?? 0 : 0,
      windup: 0,
      fuse: 0,
      dashing: 0,
      dashDir: null,
      // L'essaim : place sur le cercle, et âge pour le faire tourner.
      angle: 0,
      age: 0,
    };
  }

  // Tous les individus d'une place de la liste : un seul en général, quatre
  // pour un essaim, répartis autour du point d'apparition.
  function spawnGroup(type, at, distance, opts = {}) {
    const n = TYPES[type].group || 1;
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = n > 1 ? 7 : 0;
      const e = spawn(type, { x: at.x + Math.cos(a) * r, y: at.y + Math.sin(a) * r }, distance, opts);
      e.angle = a;
      out.push(e);
    }
    return out;
  }

  // Un ennemi qui peut faire mal : réveillé, pas étourdi, pas apeuré.
  function harmful(e) {
    return e.wake <= 0 && e.stun <= 0 && e.hp > 0 && !(e.frightened > 0);
  }

  // Encaisse un coup venu de `dir` et renvoie true s'il en meurt. Sans
  // direction (flammes, éclair), pas de recul, et un étourdissement bref :
  // juste le temps de clignoter. Les lourds (Colosse, Gardien) ne reculent
  // jamais et ne sont qu'à peine interrompus.
  function hit(e, dir, solids, damage = 1, knockback = Config.ENEMY_KNOCKBACK) {
    e.hp -= damage;
    if (e.heavy) {
      stun(e, 0.12);
    } else if (dir && knockback) {
      stun(e, Config.ENEMY_STUN);
      Physics.moveAxis(e, dir.x ? "x" : "y", (dir.x || dir.y) * knockback, solids);
    } else {
      stun(e, 0.08);
    }
    return e.hp <= 0;
  }

  // Étourdi sans être blessé : immobile et inoffensif pendant `time`. Le
  // Chasseur, lui, ne s'arrête jamais. Un étourdissement coupe aussi une
  // visée, une charge ou une mèche : bien placé, le boomerang sauve la mise.
  function stun(e, time) {
    if (e.type === "hunter") return;
    e.stun = Math.max(e.stun, time);
    e.wake = 0;
    e.lunge = 0;
    e.waypoint = null;
    e.windup = 0;
    e.dashing = 0;
    if (time >= Config.ENEMY_STUN) e.fuse = 0;
  }

  // `ctx` : {player, others, navFor(size), solids, fire, explode}.
  function step(e, ctx, dt) {
    if (e.stun > 0) {
      e.stun -= dt;
      return;
    }
    if (e.wake > 0) {
      e.wake -= dt;
      return;
    }
    e.age += dt;
    const player = ctx.player;
    const type = TYPES[e.type];
    if (type.ability && ABILITIES[type.ability.name](e, ctx, dt, type.ability)) return;

    // Une cible hors de l'écran (devant un joueur qui regarde une porte, par
    // exemple) est ramenée à l'intérieur des murs.
    let raw;
    if (e.frightened > 0) {
      raw = TARGETS.flee(e, player);
    } else if (e.lunge > 0) {
      e.lunge -= dt;
      raw = { x: player.x, y: player.y };
    } else {
      raw = TARGETS[type.target](e, player, ctx.others);
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
      e.waypoint = Nav.nextStep(ctx.navFor(e.size), e, target);
      e.replan = REPLAN;
    }

    // Vers le point de passage, un seul axe à la fois : l'axe le plus écarté
    // d'abord, l'autre s'il est bloqué. Sans jamais dépasser le point. Pris
    // dans le givre, il va deux fois moins vite.
    e.slow = Math.max(0, (e.slow || 0) - dt);
    const budget = e.speed * dt * (e.slow > 0 ? 0.5 : 1) * (e.frightened > 0 ? 0.55 : 1);
    const dx = e.waypoint.x - e.x;
    const dy = e.waypoint.y - e.y;
    const axes = Math.abs(dx) >= Math.abs(dy) ? [["x", dx], ["y", dy]] : [["y", dy], ["x", dx]];
    for (const [axis, d] of axes) {
      if (Math.abs(d) < 0.01) continue;
      const s = Math.sign(d);
      e.look = axis === "x" ? { x: s, y: 0 } : { x: 0, y: s };
      if (!Physics.moveAxis(e, axis, s * Math.min(budget, Math.abs(d)), ctx.solids)) break;
    }
  }

  return { TYPES, roster, spawn, spawnGroup, step, hit, stun, harmful };
})();

"use strict";

// Le chef d'orchestre : l'état de l'expédition et ses règles, sans rien
// dessiner.
//
// Il garde une seule zone chargée à la fois et fait passer le joueur dans la
// zone voisine dès qu'il franchit un bord de l'écran. Le joueur n'appartient
// pas à la zone : il survit au changement d'écran. Une zone est toujours
// posée à l'origine, donc la position du joueur est directement sa position
// dans la zone, et il n'y a aucune caméra.
//
// La boucle du stop ou encore :
// - le joueur part les mains vides ; il trouve armes et artefacts en fouillant
//   les coffres de la carte, et les garde tant qu'il est en vie ;
// - chaque gemme ramassée s'ajoute au butin porté, et vaut le double à
//   chaque écran d'éloignement du camp de base ;
// - un seul camp brûle sur la carte, quelque part : il faut le trouver. S'en
//   approcher met le butin porté à l'abri dans la banque (Save) et rend les
//   cœurs ; puis le feu s'éteint et un autre camp s'allume ailleurs ;
// - mourir fait perdre le butin porté et l'équipement, et ramène au camp de
//   base sur une nouvelle carte ;
// - le portail du camp de base lance une nouvelle expédition quand on le
//   décide (carte vidée) : on garde le butin porté, pas l'équipement ;
// - un ennemi tué lâche une gemme de la valeur de la zone, et reste mort
//   jusqu'à la fin de l'expédition, pour qu'on ne puisse pas en faire
//   réapparaître en repassant une porte.

const World = (() => {
  const state = {
    coords: { x: 0, y: 0 },
    distance: 0,
    zone: null,
    // Murs et obstacles de la zone chargée : tout ce qui arrête un corps.
    solids: [],
    nav: null,
    gems: [],
    enemies: [],
    // Le coffre de la zone s'il n'a pas été ouvert : {x, y, size, item}.
    chest: null,
    // Le feu, si le camp brûle dans cette zone, et le portail du camp de
    // base : {x, y} ou null.
    fire: null,
    portal: null,
    // Les objets posés au sol dans cette zone (armes lâchées) : la liste est
    // celle de run.drops, donc ils y restent quand on revient.
    drops: [],
    // Le coup de mêlée en cours, et les projectiles en vol (voir Weapons).
    swing: null,
    projectiles: [],
    // Repère de centre du joueur, en pixels de zone.
    player: {
      kind: "player",
      x: 0,
      y: 0,
      size: Config.PLAYER_SIZE,
      hp: Config.PLAYER_HP,
      maxHp: Config.PLAYER_HP,
      invuln: 0,
      // Dernière direction non nulle : c'est là que part le coup.
      facing: { x: 0, y: 1 },
      // Temps restant du coup en cours, et avant de pouvoir refrapper.
      attack: 0,
      attackCooldown: 0,
    },
    // L'expédition en cours : tout ce qui meurt avec elle.
    run: {
      carried: 0,
      // L'arme en main (clé de ITEMS) ou null, et les artefacts trouvés.
      weapon: null,
      artifacts: [],
      // Gemmes déjà ramassées, "x,y,index", pour qu'une zone quittée puis
      // retrouvée ne les rende pas deux fois.
      taken: new Set(),
      // Ennemis tués par zone, "x,y" -> nombre : une zone retrouvée en
      // aligne d'autant moins.
      killed: new Map(),
      // Coffres ouverts, "x,y", et objets posés au sol, "x,y" -> liste.
      opened: new Set(),
      drops: new Map(),
    },
    // Zones déjà vues de la carte en cours, pour la mini-carte.
    visited: new Set(),
    // "play", ou "dead" pendant la pause qui suit la mort.
    phase: "play",
    deadTimer: 0,
    // Message central temporaire : {title, detail, time}.
    banner: null,
    // Petits textes qui s'envolent au ramassage : {x, y, text, time}.
    popups: [],
    // Le joueur est-il déjà près du feu, du portail ? L'un et l'autre ne se
    // déclenchent qu'en arrivant, pas à chaque image passée à côté.
    atFire: false,
    atPortal: false,
  };

  const zoneKey = () => `${state.coords.x},${state.coords.y}`;
  const has = (artifact) => state.run.artifacts.includes(artifact);

  // Tire une nouvelle carte, et remet l'expédition à zéro : plus d'arme, plus
  // d'artefact, plus rien de ce qui concernait l'ancienne carte. Le butin
  // porté n'est pas touché ici : la mort le perd, le portail le garde.
  function newMap(seed) {
    ZoneRegistry.load(Generator.generate(seed ?? Generator.freshSeed()));
    const r = state.run;
    r.taken.clear();
    r.killed.clear();
    r.opened.clear();
    r.drops.clear();
    r.weapon = null;
    r.artifacts = [];
    state.visited.clear();
    const p = state.player;
    p.maxHp = Config.PLAYER_HP;
    p.hp = Math.min(p.hp, p.maxHp);
  }

  // Une nouvelle expédition, au camp de base : au lancement et après la mort.
  // `seed` sert à rejouer une carte précise ; sans elle, la carte est neuve.
  function newExpedition(seed) {
    const p = state.player;
    newMap(seed);
    state.run.carried = 0;
    p.hp = p.maxHp;
    p.invuln = 0;
    p.x = Config.ZONE_W / 2;
    p.y = Config.ZONE_H / 2 + 56;
    state.phase = "play";
    enterZone(ZoneRegistry.base.x, ZoneRegistry.base.y);
  }

  // Remplace la zone chargée. Le joueur doit déjà être placé : les ennemis
  // apparaissent loin de lui.
  function enterZone(cx, cy) {
    const zone = ZoneRegistry.get(cx, cy);
    const distance = ZoneRegistry.distance(cx, cy);
    state.zone = zone;
    state.coords = { x: cx, y: cy };
    state.distance = distance;
    state.solids = [...borderWalls(ZoneRegistry.exits(cx, cy)), ...zone.obstacles];
    state.nav = Nav.build(state.solids, Enemies.SIZE);
    state.visited.add(`${cx},${cy}`);
    const campHere = ZoneRegistry.isCamp(cx, cy);
    state.fire = campHere ? zone.fire : null;
    state.portal = zone.portal || null;
    state.atFire = false;
    state.atPortal = false;
    state.popups = [];

    // Coups et projectiles ne suivent pas le joueur d'un écran à l'autre : le
    // boomerang revient aussitôt dans sa main.
    const p = state.player;
    state.swing = null;
    state.projectiles = [];
    p.attack = 0;

    const value = gemValue(distance);
    state.gems = zone.gems
      .map((at, i) => ({ kind: "gem", id: `${cx},${cy},${i}`, x: at.x, y: at.y,
                         size: Config.GEM_SIZE, value }))
      .filter((g) => !state.run.taken.has(g.id));

    const key = `${cx},${cy}`;
    const item = ZoneRegistry.chest(cx, cy);
    state.chest = item && !state.run.opened.has(key)
      ? { kind: "chest", x: zone.chest.x, y: zone.chest.y, size: 12, item }
      : null;
    if (!state.run.drops.has(key)) state.run.drops.set(key, []);
    state.drops = state.run.drops.get(key);

    const table = Config.ENEMIES_BY_DISTANCE;
    // La composition de la zone est tirée avec sa propre graine : la même à
    // chaque retour. Les ennemis déjà tués sont retirés du début de la liste,
    // Traqueur compris.
    // Aucun ennemi au camp de base ni autour du feu. Le camp éteint, la zone
    // retrouve les siens à la visite suivante.
    const planned = zone.safe || campHere ? 0 : table[Math.min(distance, table.length - 1)];
    const rng = makeRandom(deriveSeed(ZoneRegistry.seed, cx, cy));
    const roster = Enemies.roster(planned, distance, rng)
      .slice(state.run.killed.get(key) || 0);
    const spots = zone.spawns
      .filter((at) => Math.hypot(at.x - p.x, at.y - p.y) >= Config.SPAWN_SAFE_DISTANCE)
      .sort((a, b) => Math.hypot(b.x - p.x, b.y - p.y) - Math.hypot(a.x - p.x, a.y - p.y));
    state.enemies = roster
      .slice(0, spots.length)
      .map((type, i) => Enemies.spawn(type, spots[i], distance));
  }

  function gemValue(distance) {
    return Config.GEM_BASE * 2 ** Math.max(0, distance - 1);
  }

  function speed() {
    let bonus = 0;
    for (const a of state.run.artifacts) bonus += ITEMS[a].speedBonus || 0;
    return Config.PLAYER_SPEED * (1 + bonus);
  }

  function step(dt, dir, attack) {
    tickMessages(dt);

    if (state.phase === "dead") {
      state.deadTimer -= dt;
      if (state.deadTimer <= 0) newExpedition();
      return;
    }

    const p = state.player;
    p.invuln = Math.max(0, p.invuln - dt);
    p.attackCooldown = Math.max(0, p.attackCooldown - dt);

    // Le joueur ne s'arrête jamais pour frapper. Il garde seulement la
    // direction de son coup de mêlée tant que celui-ci dure.
    if (dir.x || dir.y) {
      if (!state.swing) p.facing = dir;
      const dist = speed() * dt;
      if (dir.x) Physics.moveAxis(p, "x", dir.x * dist, state.solids);
      if (dir.y) Physics.moveAxis(p, "y", dir.y * dist, state.solids);
    }
    if (attack && state.run.weapon) Weapons.use(state, ITEMS[state.run.weapon]);
    Weapons.update(state, dt, { kill, collect: pickUp });

    attractGems(dt);
    state.gems = state.gems.filter((g) => {
      if (!Physics.overlapsBody(p, g)) return true;
      pickUp(g);
      return false;
    });
    openChest();
    pickUpDrops();
    restAtFire();
    enterPortal();

    for (const e of state.enemies) {
      Enemies.step(e, p, state.enemies, dt, state.nav, state.solids);
      if (p.invuln <= 0 && Enemies.harmful(e) && Physics.overlapsBody(p, e)) hurt(e);
      if (state.phase === "dead") return;
    }

    changeZoneIfNeeded();
  }

  function kill(e) {
    const key = zoneKey();
    state.run.killed.set(key, (state.run.killed.get(key) || 0) + 1);
    state.gems.push({ kind: "gem", id: null, x: e.x, y: e.y,
                      size: Config.GEM_SIZE, value: gemValue(state.distance) });
  }

  // Une gemme ramassée, par le joueur ou par le boomerang.
  function pickUp(g) {
    state.run.carried += g.value;
    // Les gemmes lâchées par un ennemi n'ont pas d'identifiant : elles ne
    // réapparaîtraient de toute façon pas.
    if (g.id) state.run.taken.add(g.id);
    state.popups.push({ x: g.x, y: g.y, text: `+${g.value}`, time: 0.8 });
  }

  // L'aimant tire vers le joueur les gemmes assez proches.
  function attractGems(dt) {
    if (!has("magnet")) return;
    const { radius, pull } = ITEMS.magnet;
    const p = state.player;
    for (const g of state.gems) {
      const dx = p.x - g.x, dy = p.y - g.y;
      const d = Math.hypot(dx, dy);
      if (d > radius || d < 0.01) continue;
      const s = Math.min(d, pull * dt);
      g.x += (dx / d) * s;
      g.y += (dy / d) * s;
    }
  }

  function openChest() {
    const c = state.chest;
    if (!c || !Physics.overlapsBody(state.player, c)) return;
    state.run.opened.add(zoneKey());
    state.chest = null;
    take(c.item);
  }

  // Une arme lâchée n'est reprenable qu'après s'en être éloigné : sinon, en
  // l'échangeant, on la reprendrait aussitôt.
  function pickUpDrops() {
    const p = state.player;
    for (let i = state.drops.length - 1; i >= 0; i--) {
      const d = state.drops[i];
      const touching = Physics.overlapsBody(p, d);
      if (!touching) {
        d.ready = true;
      } else if (d.ready) {
        state.drops.splice(i, 1);
        take(d.item);
      }
    }
  }

  // Le joueur prend un objet : une arme remplace celle qu'il tenait, qui tombe
  // à ses pieds ; un artefact s'ajoute.
  function take(key) {
    const item = ITEMS[key];
    const p = state.player;
    if (item.type === "weapon") {
      if (state.run.weapon) {
        state.drops.push({ kind: "item", item: state.run.weapon, x: p.x, y: p.y, size: 10, ready: false });
      }
      state.run.weapon = key;
      p.attackCooldown = 0;
    } else {
      state.run.artifacts.push(key);
      if (key === "heart") {
        p.maxHp += 1;
        p.hp += 1;
      }
    }
    showBanner(item.name, item.hint);
  }

  function restAtFire() {
    const fire = state.fire;
    if (!fire) return;
    const p = state.player;
    const near = Math.hypot(p.x - fire.x, p.y - fire.y) < Config.CAMP_RADIUS;
    if (near && !state.atFire) rest();
    state.atFire = near;
  }

  // Le camp ne sert qu'une fois : s'il y a du butin à mettre à l'abri ou des
  // cœurs à rendre, il le fait, puis il s'éteint et un autre s'allume
  // ailleurs. Sinon, il attend : on ne le gaspille pas en passant devant.
  function rest() {
    const p = state.player;
    const carried = state.run.carried;
    const healed = p.hp < p.maxHp;
    if (carried === 0 && !healed) return;

    p.hp = p.maxHp;
    if (carried > 0) {
      Save.deposit(carried);
      state.run.carried = 0;
    }
    Generator.moveCamp(ZoneRegistry.map);
    state.fire = null;
    showBanner(carried > 0 ? `+${carried} à l'abri` : "Cœurs rendus",
               "le feu s'éteint, un autre s'allume ailleurs");
  }

  // Le portail du camp de base : une nouvelle carte, quand on a vidé
  // celle-ci. Le butin porté suit, encore à mettre à l'abri ; l'équipement
  // reste derrière, sinon on accumulerait les artefacts de carte en carte.
  function enterPortal() {
    const portal = state.portal;
    if (!portal) return;
    const p = state.player;
    const near = Math.hypot(p.x - portal.x, p.y - portal.y) < Config.PORTAL_RADIUS;
    if (near && !state.atPortal) {
      newMap();
      enterZone(ZoneRegistry.base.x, ZoneRegistry.base.y);
      state.atPortal = true;
      showBanner("Nouvelle expédition", "nouvelle carte, mains vides");
      return;
    }
    state.atPortal = near;
  }

  function hurt(enemy) {
    const p = state.player;
    p.hp -= enemy.damage;
    p.invuln = Config.HURT_INVULN;

    if (p.hp <= 0) {
      die();
      return;
    }

    // Recul : le joueur est repoussé à l'opposé de l'ennemi, sur l'axe où ils
    // sont le plus écartés, sans traverser les murs.
    const dx = p.x - enemy.x;
    const dy = p.y - enemy.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      Physics.moveAxis(p, "x", (Math.sign(dx) || 1) * Config.HURT_KNOCKBACK, state.solids);
    } else {
      Physics.moveAxis(p, "y", (Math.sign(dy) || 1) * Config.HURT_KNOCKBACK, state.solids);
    }
  }

  function die() {
    const lost = state.run.carried;
    state.run.carried = 0;
    state.phase = "dead";
    state.deadTimer = Config.DEATH_PAUSE;
    state.swing = null;
    state.projectiles = [];
    showBanner("Expédition perdue", lost > 0 ? `-${lost} de butin, équipement perdu` : "équipement perdu");
  }

  function changeZoneIfNeeded() {
    const p = state.player;
    const crossed = crossedEdge(p);
    if (!crossed) return;

    const tx = state.coords.x + crossed.x;
    const ty = state.coords.y + crossed.y;
    if (!ZoneRegistry.has(tx, ty)) {
      // Ne devrait pas arriver, les côtés sans voisine étant murés : on
      // retient le joueur par sécurité.
      clampInside(p);
      return;
    }
    placeAtEntry(p, crossed);
    enterZone(tx, ty);
  }

  // Le bord que le joueur vient de dépasser, ou null tant qu'il est dans la
  // zone.
  function crossedEdge(p) {
    if (p.x < 0) return { x: -1, y: 0 };
    if (p.x > Config.ZONE_W) return { x: 1, y: 0 };
    if (p.y < 0) return { x: 0, y: -1 };
    if (p.y > Config.ZONE_H) return { x: 0, y: 1 };
    return null;
  }

  function clampInside(p) {
    const m = Config.ENTRY_MARGIN;
    p.x = Math.min(Math.max(p.x, m), Config.ZONE_W - m);
    p.y = Math.min(Math.max(p.y, m), Config.ZONE_H - m);
  }

  // Fait ressortir le joueur du bord opposé de la zone qu'il vient d'entrer,
  // en gardant son autre coordonnée : il arrive dans la porte qui fait face à
  // celle qu'il a prise.
  function placeAtEntry(p, dir) {
    const m = Config.ENTRY_MARGIN;
    if (dir.x < 0) p.x = Config.ZONE_W - m;
    else if (dir.x > 0) p.x = m;
    if (dir.y < 0) p.y = Config.ZONE_H - m;
    else if (dir.y > 0) p.y = m;
  }

  function showBanner(title, detail) {
    state.banner = { title, detail, time: Config.BANNER_TIME };
  }

  function tickMessages(dt) {
    if (state.banner) {
      state.banner.time -= dt;
      if (state.banner.time <= 0) state.banner = null;
    }
    for (const pop of state.popups) {
      pop.time -= dt;
      pop.y -= 20 * dt;
    }
    state.popups = state.popups.filter((pop) => pop.time > 0);
  }

  return { state, newExpedition, gemValue, step, has };
})();

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
//   réapparaître en repassant une porte ;
// - plus on reste hors du camp de base, plus la menace monte : élites, morts
//   qui se relèvent, ennemis plus nombreux et plus rapides, puis le Chasseur,
//   invincible, qui suit le joueur partout. Le repos au camp la fait
//   redescendre un peu.

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
      // Ennemis tués par zone, "x,y" -> liste des moments (en secondes de
      // menace) où ils sont morts : une zone retrouvée en aligne d'autant
      // moins, jusqu'à ce que la menace les relève.
      killed: new Map(),
      // La menace : secondes passées hors du camp de base (voir Config).
      threat: 0,
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
    // Le palier de menace atteint, pour n'annoncer chaque palier qu'une fois.
    threatLevel: 0,
    // Le Chasseur, quand il est dans la zone, et le compte à rebours de son
    // entrée : {at: {x, y}, time} ou null.
    hunter: null,
    hunterComing: null,
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
    r.threat = 0;
    state.threatLevel = 0;
    state.hunter = null;
    state.hunterComing = null;
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

    spawnEnemies(cx, cy, zone, distance, campHere);

    // Le Chasseur suit le joueur : il entre par la même porte, un peu après
    // lui. Il ne passe ni au camp de base ni autour du feu.
    state.hunter = null;
    state.hunterComing = hunterActive() && !zone.safe && !campHere
      ? { at: { x: p.x, y: p.y }, time: Config.HUNTER_DELAY }
      : null;
  }

  // Les ennemis de la zone. Leur composition est tirée avec la graine de la
  // zone : la même à chaque retour. La menace en ajoute, les accélère et
  // fait apparaître des élites ; les ennemis tués sont retirés du début de la
  // liste tant qu'ils ne se sont pas relevés. Aucun ennemi au camp de base ni
  // autour du feu ; le camp éteint, la zone retrouve les siens.
  function spawnEnemies(cx, cy, zone, distance, campHere) {
    const level = threatLevel();
    const table = Config.ENEMIES_BY_DISTANCE;
    const planned = zone.safe || campHere ? 0
      : table[Math.min(distance, table.length - 1)] + Math.floor(level / Config.THREAT_EXTRA_ENEMY_EVERY);
    const seed = ZoneRegistry.seed;
    const roster = Enemies.roster(planned, distance, makeRandom(deriveSeed(seed, cx, cy)))
      .map((type, i) => ({ type, i }))
      .slice(deadCount(`${cx},${cy}`));

    const p = state.player;
    const spots = zone.spawns
      .filter((at) => Math.hypot(at.x - p.x, at.y - p.y) >= Config.SPAWN_SAFE_DISTANCE)
      .sort((a, b) => Math.hypot(b.x - p.x, b.y - p.y) - Math.hypot(a.x - p.x, a.y - p.y));
    // Être une élite est tiré par ennemi, avec une graine fixe : repasser la
    // porte ne relance pas le dé.
    const eliteChance = Math.min(Config.ELITE_CHANCE_MAX, Config.ELITE_CHANCE * level);
    state.enemies = roster.slice(0, spots.length).map(({ type, i }, n) => {
      const roll = deriveSeed(seed, cx, cy, 100 + i) / 4294967296;
      return Enemies.spawn(type, spots[n], distance, {
        elite: roll < eliteChance,
        speed: Config.THREAT_SPEED * level,
      });
    });
  }

  // Combien d'ennemis de cette zone sont encore morts : à partir du palier
  // REVIVE_LEVEL, ceux tués depuis plus de REVIVE_TIME se relèvent.
  function deadCount(key) {
    const kills = state.run.killed.get(key) || [];
    if (threatLevel() < Config.REVIVE_LEVEL) return kills.length;
    const t = state.run.threat;
    return kills.filter((at) => t - at < Config.REVIVE_TIME).length;
  }

  function threatLevel() {
    return Math.min(Config.THREAT_MAX, Math.floor(state.run.threat / Config.THREAT_STEP));
  }

  const hunterActive = () => threatLevel() >= Config.THREAT_MAX;

  // Ce qu'annonce chaque palier de menace.
  const THREAT_NEWS = [
    null,
    ["Le donjon s'agite", "des élites apparaissent"],
    ["Menace 2", "les morts se relèvent"],
    ["Menace 3", "plus nombreux, plus rapides"],
    ["Quelque chose approche…", "trouve un camp"],
    ["Le Chasseur est là", "il te suivra partout"],
  ];

  // Fait monter la menace, annonce les paliers, et fait entrer le Chasseur.
  function updateThreat(dt) {
    if (!state.zone.safe) state.run.threat += dt;
    const level = threatLevel();
    if (level > state.threatLevel && THREAT_NEWS[level]) {
      showBanner(...THREAT_NEWS[level], 3);
    }
    // Le Chasseur surgit dès le dernier palier, sans attendre qu'on change de
    // zone : il arrive par la porte la plus proche.
    if (level >= Config.THREAT_MAX && state.threatLevel < Config.THREAT_MAX &&
        !state.zone.safe && !state.fire) {
      state.hunterComing = { at: nearestDoor(), time: Config.HUNTER_DELAY };
    }
    state.threatLevel = level;

    const c = state.hunterComing;
    if (c && (c.time -= dt) <= 0) {
      const h = Enemies.spawn("hunter", c.at, 0);
      h.speed = Config.HUNTER_SPEED;
      h.wake = 0;
      state.hunter = h;
      state.hunterComing = null;
    }
  }

  function nearestDoor() {
    const p = state.player, W = Config.ZONE_W, H = Config.ZONE_H, m = Config.ENTRY_MARGIN;
    const exits = ZoneRegistry.exits(state.coords.x, state.coords.y);
    const doors = [
      exits.left && { x: m, y: H / 2 }, exits.right && { x: W - m, y: H / 2 },
      exits.up && { x: W / 2, y: m }, exits.down && { x: W / 2, y: H - m },
    ].filter(Boolean);
    return doors.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
  }

  function gemValue(distance) {
    return Config.GEM_BASE * 2 ** Math.max(0, distance - 1);
  }

  function speed() {
    let bonus = 0;
    for (const a of state.run.artifacts) bonus += ITEMS[a].speedBonus || 0;
    return Config.PLAYER_SPEED * (1 + bonus);
  }

  // Un corps pourrait-il avancer d'un pixel dans cette direction ?
  function canGo(b, dir) {
    const probe = { x: b.x, y: b.y, size: b.size };
    return !Physics.moveAxis(probe, dir.x ? "x" : "y", dir.x || dir.y, state.solids);
  }

  // L'aide aux angles des jeux à la Zelda : bloqué de front, mais à quelques
  // pixels près d'un passage (une porte, l'espace entre deux rochers), le
  // joueur glisse de côté pour s'y aligner au lieu de buter. Renvoie le
  // décalage de côté qui débloque la direction, ou 0 s'il n'y en a pas.
  const CORNER_ASSIST = 7;
  function sideStep(b, dir) {
    const side = dir.x ? "y" : "x";
    for (let off = 1; off <= CORNER_ASSIST; off++) {
      for (const sign of [-1, 1]) {
        const probe = { x: b.x, y: b.y, size: b.size };
        if (!Physics.moveAxis(probe, side, sign * off, state.solids) && canGo(probe, dir)) return sign * off;
      }
    }
    return 0;
  }

  // Le joueur peut-il partir dans cette direction, tout de suite ou avec
  // l'aide aux angles ?
  function canGoSoon(b, dir) {
    return canGo(b, dir) || sideStep(b, dir) !== 0;
  }

  // La voie est-elle libre sur au moins une tuile dans cette direction ?
  // C'est la condition d'un virage demandé d'avance : sans elle, le joueur
  // tournerait dans le moindre renfoncement et buterait aussitôt.
  function isOpen(b, dir) {
    const probe = { x: b.x, y: b.y, size: b.size };
    const s = sideStep(probe, dir);
    if (!canGo(probe, dir) && !s) return false;
    if (s) Physics.moveAxis(probe, dir.x ? "y" : "x", s, state.solids);
    return !Physics.moveAxis(probe, dir.x ? "x" : "y", (dir.x || dir.y) * Config.TILE, state.solids);
  }

  function movePlayer(dir, dist) {
    const p = state.player;
    if (canGo(p, dir)) {
      Physics.moveAxis(p, dir.x ? "x" : "y", (dir.x || dir.y) * dist, state.solids);
      return;
    }
    const s = sideStep(p, dir);
    if (s) Physics.moveAxis(p, dir.x ? "y" : "x", Math.sign(s) * Math.min(dist, Math.abs(s)), state.solids);
  }

  // `intent` vient d'Input : {dir, next}. `next` est un virage demandé
  // d'avance ; il est pris dès que le passage s'ouvre (intent.accepted
  // passe alors à true, et main.js prévient Input).
  function step(dt, intent, attack) {
    tickMessages(dt);

    if (state.phase === "dead") {
      state.deadTimer -= dt;
      if (state.deadTimer <= 0) newExpedition();
      return;
    }

    const p = state.player;
    p.invuln = Math.max(0, p.invuln - dt);
    p.attackCooldown = Math.max(0, p.attackCooldown - dt);
    updateThreat(dt);

    // Un virage demandé est pris tout de suite si le joueur est à l'arrêt ou
    // bloqué ; en pleine course, seulement quand la voie s'ouvre vraiment.
    let dir = intent.dir;
    const next = intent.next;
    if (next) {
      const idle = (!dir.x && !dir.y) || !canGoSoon(p, dir);
      if (idle ? canGoSoon(p, next) : isOpen(p, next)) {
        dir = next;
        intent.accepted = true;
      }
    }

    // Le joueur ne s'arrête jamais pour frapper. Il garde seulement la
    // direction de son coup de mêlée tant que celui-ci dure.
    if (dir.x || dir.y) {
      if (!state.swing) p.facing = dir;
      movePlayer(dir, speed() * dt);
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

    // Le Chasseur n'est pas dans la liste des ennemis : les armes ne le
    // touchent pas, et il ne compte pas parmi les morts de la zone.
    const hunters = state.hunter ? [state.hunter] : [];
    for (const e of [...state.enemies, ...hunters]) {
      Enemies.step(e, p, state.enemies, dt, state.nav, state.solids);
      if (p.invuln <= 0 && Enemies.harmful(e) && Physics.overlapsBody(p, e)) hurt(e);
      if (state.phase === "dead") return;
    }

    changeZoneIfNeeded();
  }

  function kill(e) {
    const key = zoneKey();
    if (!state.run.killed.has(key)) state.run.killed.set(key, []);
    state.run.killed.get(key).push(state.run.threat);
    state.gems.push({ kind: "gem", id: null, x: e.x, y: e.y,
                      size: Config.GEM_SIZE, value: gemValue(state.distance) });
    // Une élite lâche en plus un objet.
    if (e.elite) {
      state.drops.push({ kind: "item", item: eliteLoot(), x: e.x, y: e.y + 10, size: 10, ready: true });
    }
  }

  // L'objet d'une élite : une autre arme que celle en main, ou un artefact
  // qui sert encore (un deuxième aimant ou une deuxième lanterne ne
  // changeraient rien ; cœurs et bottes, si).
  function eliteLoot() {
    const pool = Object.keys(ITEMS).filter((k) => {
      const it = ITEMS[k];
      if (it.type === "weapon") return k !== state.run.weapon;
      return (k !== "magnet" && k !== "lantern") || !has(k);
    });
    return pool[Math.floor(Math.random() * pool.length)];
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

    // Le repos calme aussi le donjon ; sous le dernier palier, le Chasseur
    // perd la trace.
    const r = state.run;
    r.threat = Math.max(0, r.threat - Config.CAMP_THREAT_RELIEF);
    state.threatLevel = threatLevel();
    if (!hunterActive()) {
      state.hunter = null;
      state.hunterComing = null;
    }
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

  function showBanner(title, detail, time = Config.BANNER_TIME) {
    state.banner = { title, detail, time };
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

  return { state, newExpedition, gemValue, step, has, threatLevel, say: showBanner };
})();

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
// - chaque gemme ramassée s'ajoute au butin porté, et vaut le double à
//   chaque écran d'éloignement du camp de base ;
// - s'approcher d'un feu de camp met le butin porté à l'abri dans la banque
//   (Save) et rend tous les cœurs ;
// - mourir fait perdre tout le butin porté et ramène au camp de base ;
// - rentrer au camp de base termine l'expédition : les gemmes réapparaissent.

const World = (() => {
  const state = {
    coords: { ...ZoneRegistry.base },
    distance: 0,
    zone: null,
    // Murs et obstacles de la zone chargée : tout ce qui arrête un corps.
    solids: [],
    gems: [],
    enemies: [],
    // Repère de centre du joueur, en pixels de zone.
    player: {
      kind: "player",
      x: 0,
      y: 0,
      size: Config.PLAYER_SIZE,
      hp: Config.PLAYER_HP,
      maxHp: Config.PLAYER_HP,
      invuln: 0,
      // Dernière direction non nulle : l'ancrage de l'animation et, plus
      // tard, de la direction des attaques.
      facing: { x: 0, y: 1 },
    },
    // L'expédition en cours : tout ce qui meurt avec le joueur.
    run: {
      carried: 0,
      // Gemmes déjà ramassées, "x,y,index", pour qu'une zone quittée puis
      // retrouvée ne les rende pas deux fois.
      taken: new Set(),
    },
    // Zones déjà vues, pour la mini-carte. Survit à la mort : on se souvient
    // du chemin.
    visited: new Set(),
    // "play", ou "dead" pendant la pause qui suit la mort.
    phase: "play",
    deadTimer: 0,
    // Message central temporaire : {title, detail, time}.
    banner: null,
    // Petits chiffres qui s'envolent au ramassage : {x, y, text, time}.
    popups: [],
    // Le joueur est-il déjà près du feu ? Le repos ne se déclenche qu'en
    // arrivant, pas à chaque image passée à côté.
    atFire: false,
  };

  // Une nouvelle expédition, au camp de base : au lancement et après la mort.
  function newExpedition() {
    const p = state.player;
    state.run.carried = 0;
    state.run.taken.clear();
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
    state.visited.add(`${cx},${cy}`);
    state.atFire = false;
    state.popups = [];

    const value = gemValue(distance);
    state.gems = zone.gems
      .map((at, i) => ({ kind: "gem", id: `${cx},${cy},${i}`, x: at.x, y: at.y,
                         size: Config.GEM_SIZE, value }))
      .filter((g) => !state.run.taken.has(g.id));

    const table = Config.ENEMIES_BY_DISTANCE;
    const count = zone.camp ? 0 : table[Math.min(distance, table.length - 1)];
    const p = state.player;
    state.enemies = zone.spawns
      .filter((at) => Math.hypot(at.x - p.x, at.y - p.y) >= Config.SPAWN_SAFE_DISTANCE)
      .sort((a, b) => Math.hypot(b.x - p.x, b.y - p.y) - Math.hypot(a.x - p.x, a.y - p.y))
      .slice(0, count)
      .map((at) => Enemies.spawn("chaser", at, distance));
  }

  function gemValue(distance) {
    return Config.GEM_BASE * 2 ** Math.max(0, distance - 1);
  }

  function step(dt, dir) {
    tickMessages(dt);

    if (state.phase === "dead") {
      state.deadTimer -= dt;
      if (state.deadTimer <= 0) newExpedition();
      return;
    }

    const p = state.player;
    p.invuln = Math.max(0, p.invuln - dt);
    if (dir.x || dir.y) p.facing = dir;
    const dist = Config.PLAYER_SPEED * dt;
    if (dir.x) Physics.moveAxis(p, "x", dir.x * dist, state.solids);
    if (dir.y) Physics.moveAxis(p, "y", dir.y * dist, state.solids);

    pickUpGems();
    restAtFire();

    for (const e of state.enemies) {
      Enemies.step(e, p, dt, state.solids);
      if (p.invuln <= 0 && Physics.overlapsBody(p, e)) hurt(e);
      if (state.phase === "dead") return;
    }

    changeZoneIfNeeded();
  }

  function pickUpGems() {
    const p = state.player;
    state.gems = state.gems.filter((g) => {
      if (!Physics.overlapsBody(p, g)) return true;
      state.run.carried += g.value;
      state.run.taken.add(g.id);
      state.popups.push({ x: g.x, y: g.y, text: `+${g.value}`, time: 0.8 });
      return false;
    });
  }

  function restAtFire() {
    const fire = state.zone.fire;
    if (!fire) return;
    const p = state.player;
    const near = Math.hypot(p.x - fire.x, p.y - fire.y) < Config.CAMP_RADIUS;
    if (near && !state.atFire) rest();
    state.atFire = near;
  }

  function rest() {
    const p = state.player;
    const carried = state.run.carried;
    const healed = p.hp < p.maxHp;
    p.hp = p.maxHp;

    if (carried > 0) {
      Save.deposit(carried);
      state.run.carried = 0;
      showBanner("Butin à l'abri", `+${carried}  ·  banque ${Save.data.bank}`);
    } else if (healed) {
      showBanner("Repos", "cœurs rendus");
    }

    // Au camp de base, l'expédition est terminée : le monde se remplit de
    // nouveau.
    if (state.zone.base && state.run.taken.size > 0) {
      state.run.taken.clear();
      if (carried === 0) showBanner("Nouvelle expédition", "les gemmes sont revenues");
    }
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
    showBanner("Expédition perdue", lost > 0 ? `-${lost} de butin` : "rien à perdre");
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

  return { state, newExpedition, gemValue, step };
})();

"use strict";

// Le rendu : tout ce qui dessine, et rien d'autre.
//
// Il lit l'état de World sans jamais le modifier. Pour l'instant chaque
// élément est une forme de couleur ; quand les graphismes arriveront, c'est
// le seul fichier à réécrire : STYLE deviendra une table `kind` -> sprite, et
// le reste du jeu ne verra pas la différence.
//
// L'interface occupe les bandes de mur du haut et du bas, pour ne pas cacher
// le terrain : cœurs et butin porté en haut, banque et valeur des gemmes en
// bas, mini-carte dans le coin.

const Render = (() => {
  const STYLE = {
    wall: "#2e3342",
    rock: "#4f5463",
    player: "#f2c44d",
    // Les quatre fantômes, dans les couleurs de Pac-Man.
    chaser: "#d8574a",
    ambusher: "#e889c0",
    pincer: "#5f9df0",
    shy: "#e89a4c",
    eye: "#f4f6fa",
    pupil: "#1a1d26",
    // Un ennemi à plusieurs points de vie porte un liseré plus sombre.
    tough: "#7a2620",
    hitFlash: "#ffffff",
    sword: "#e8edf5",
    arrow: "#d9c9a3",
    boomerang: "#d7a45a",
    chest: "#7a4f2a",
    chestLid: "#a36b36",
    chestLock: "#f2c44d",
    gem: "#5fd4e8",
    fire: "#f08a3c",
    portal: "#a98bf0",
    fireCore: "#ffd27a",
    text: "#c9d1dc",
    dim: "#8f9bad",
    heart: "#e0524a",
    heartEmpty: "#4a3036",
    mapSeen: "#56607a",
    mapCamp: "#f08a3c",
    mapHere: "#f2c44d",
    mapFog: "#1d212b",
    shade: "rgba(8, 10, 14, 0.72)",
  };

  let ctx;
  let clock = 0;

  // Le canvas est quatre fois plus fin que la zone : tout est dessiné en
  // pixels de zone, mais le texte de l'interface reste net sur un téléphone.
  // Pour du vrai pixel art, il suffira de repasser à 1.
  const RES = 4;

  function init(canvas) {
    canvas.width = Config.ZONE_W * RES;
    canvas.height = Config.ZONE_H * RES;
    ctx = canvas.getContext("2d");
    ctx.setTransform(RES, 0, 0, RES, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  function draw(state, dt) {
    clock += dt;
    const { zone, solids, player } = state;

    ctx.fillStyle = zone.ground;
    ctx.fillRect(0, 0, Config.ZONE_W, Config.ZONE_H);

    if (state.fire) drawFire(state.fire);
    if (state.portal) drawPortal(state.portal);
    for (const s of solids) {
      ctx.fillStyle = STYLE[s.kind];
      ctx.fillRect(s.x, s.y, s.w, s.h);
    }
    if (state.chest) drawChest(state.chest);
    for (const d of state.drops) drawItemOnGround(d);
    for (const g of state.gems) drawGem(g.x, g.y, g.size);
    for (const e of state.enemies) drawEnemy(e);
    if (state.phase !== "dead") drawPlayer(player);
    if (state.swing) drawSwing(state.swing, player);
    for (const s of state.projectiles) drawProjectile(s);

    for (const pop of state.popups) {
      text(pop.text, pop.x, pop.y - 8, STYLE.gem, "center");
    }

    drawHud(state);
    drawMinimap(state);
    if (state.banner) drawBanner(state.banner, state.phase === "dead");
  }

  function drawFire(f) {
    // Deux carrés qui palpitent : juste de quoi repérer le feu de loin.
    const pulse = Math.sin(clock * 8) > 0 ? 1 : 0;
    ctx.fillStyle = STYLE.fire;
    ctx.fillRect(f.x - 7 - pulse, f.y - 7 - pulse, 14 + pulse * 2, 14 + pulse * 2);
    ctx.fillStyle = STYLE.fireCore;
    ctx.fillRect(f.x - 3, f.y - 3, 6, 6);
    // Le cercle où l'on se repose.
    ctx.strokeStyle = "rgba(240, 138, 60, 0.25)";
    ctx.beginPath();
    ctx.arc(f.x, f.y, Config.CAMP_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Le portail : un anneau qui tourne, pour qu'on ne le confonde pas avec un
  // feu.
  function drawPortal(pt) {
    const r = Config.PORTAL_RADIUS;
    ctx.fillStyle = "rgba(150, 110, 230, 0.18)";
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = STYLE.portal;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const a = clock * 2 + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r - 2, a, a + 1.2);
      ctx.stroke();
    }
  }

  function drawGem(x, y, size) {
    const h = size / 2;
    ctx.fillStyle = STYLE.gem;
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.lineTo(x + h, y);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x - h, y);
    ctx.closePath();
    ctx.fill();
  }

  function drawEnemy(e) {
    const h = e.size / 2;
    const x = Math.round(e.x - h), y = Math.round(e.y - h);
    // Endormi à l'entrée de la zone : dessiné terne.
    ctx.globalAlpha = e.wake > 0 ? 0.45 : 1;
    // Touché : il clignote en blanc pendant qu'il est étourdi.
    const flash = e.stun > 0 && Math.floor(clock * 20) % 2 === 0;
    ctx.fillStyle = flash ? STYLE.hitFlash : STYLE[e.kind];
    ctx.fillRect(x, y, e.size, e.size);
    if (e.hp > 1 && !flash) {
      ctx.strokeStyle = STYLE.tough;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, e.size - 1, e.size - 1);
    }
    // Deux yeux qui regardent où il va, comme les fantômes : c'est ce qui
    // trahit son intention.
    if (!flash) {
      const lx = e.look.x * 1.5, ly = e.look.y * 1.5;
      for (const ox of [-2.5, 2.5]) {
        ctx.fillStyle = STYLE.eye;
        ctx.fillRect(e.x + ox - 1.5, e.y - 3, 3, 3);
        ctx.fillStyle = STYLE.pupil;
        ctx.fillRect(e.x + ox - 0.75 + lx * 0.5, e.y - 2.25 + ly * 0.5, 1.5, 1.5);
      }
    }
    ctx.globalAlpha = 1;
  }

  // Un coffre fermé, qui brille un peu pour attirer l'œil.
  function drawChest(c) {
    const w = 12, h = 9;
    const x = c.x - w / 2, y = c.y - h / 2;
    const glow = 0.25 + 0.2 * Math.sin(clock * 4);
    ctx.fillStyle = `rgba(242, 196, 77, ${glow})`;
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = STYLE.chest;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = STYLE.chestLid;
    ctx.fillRect(x, y, w, 3);
    ctx.fillStyle = STYLE.chestLock;
    ctx.fillRect(c.x - 1, y + 2, 2, 3);
  }

  // Une arme posée au sol, qui flotte légèrement.
  function drawItemOnGround(d) {
    const bob = Math.sin(clock * 3);
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(d.x - 4, d.y + 5, 8, 2);
    drawIcon(d.item, d.x, d.y + bob);
  }

  // Les icônes des objets, centrées en (x, y), dans un carré d'environ 10 px.
  function drawIcon(key, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.lineCap = "round";
    switch (key) {
      case "sword":
        ctx.fillStyle = STYLE.sword;
        ctx.fillRect(-1, -5, 2, 7);
        ctx.fillStyle = STYLE.chestLock;
        ctx.fillRect(-3, 2, 6, 1.5);
        ctx.fillStyle = STYLE.chestLid;
        ctx.fillRect(-0.75, 3.5, 1.5, 2);
        break;
      case "spear":
        ctx.fillStyle = STYLE.chestLid;
        ctx.fillRect(-0.6, -3, 1.2, 9);
        ctx.fillStyle = STYLE.sword;
        ctx.beginPath();
        ctx.moveTo(0, -6); ctx.lineTo(2, -2.5); ctx.lineTo(-2, -2.5);
        ctx.closePath();
        ctx.fill();
        break;
      case "bow":
        ctx.strokeStyle = STYLE.boomerang;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(-2, 0, 5, -Math.PI / 2.4, Math.PI / 2.4);
        ctx.stroke();
        ctx.strokeStyle = STYLE.sword;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(-0.4, -4.6); ctx.lineTo(-0.4, 4.6);
        ctx.stroke();
        break;
      case "boomerang":
        ctx.strokeStyle = STYLE.boomerang;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-4, -3); ctx.lineTo(0, 3); ctx.lineTo(4, -3);
        ctx.stroke();
        break;
      case "heart":
        ctx.fillStyle = STYLE.heart;
        ctx.fillRect(-4, -3, 3.5, 3.5);
        ctx.fillRect(0.5, -3, 3.5, 3.5);
        ctx.beginPath();
        ctx.moveTo(-4, 0); ctx.lineTo(4, 0); ctx.lineTo(0, 4.5);
        ctx.closePath();
        ctx.fill();
        break;
      case "boots":
        ctx.fillStyle = STYLE.pincer;
        ctx.fillRect(-3, -4, 3, 7);
        ctx.fillRect(-3, 1.5, 6.5, 2.5);
        ctx.fillStyle = STYLE.eye;
        ctx.fillRect(-3, -4, 3, 1);
        break;
      case "magnet":
        ctx.strokeStyle = STYLE.heart;
        ctx.lineWidth = 2.2;
        ctx.lineCap = "butt";
        ctx.beginPath();
        ctx.moveTo(-3, -4); ctx.lineTo(-3, 0.5);
        ctx.arc(0, 0.5, 3, Math.PI, 0, true);
        ctx.lineTo(3, -4);
        ctx.stroke();
        ctx.fillStyle = STYLE.eye;
        ctx.fillRect(-4.1, -5, 2.2, 1.6);
        ctx.fillRect(1.9, -5, 2.2, 1.6);
        break;
      case "lantern":
        ctx.fillStyle = "rgba(255, 210, 122, 0.3)";
        ctx.beginPath();
        ctx.arc(0, 0.5, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = STYLE.wall;
        ctx.fillRect(-2.5, -4, 5, 1.5);
        ctx.fillStyle = STYLE.fireCore;
        ctx.fillRect(-2, -2.5, 4, 5);
        ctx.fillStyle = STYLE.wall;
        ctx.fillRect(-2.5, 2.5, 5, 1.5);
        break;
    }
    ctx.restore();
  }

  function drawProjectile(s) {
    if (s.kind === "arrow") {
      ctx.fillStyle = STYLE.arrow;
      if (s.dir.x) ctx.fillRect(s.x - 4, s.y - 0.75, 8, 1.5);
      else ctx.fillRect(s.x - 0.75, s.y - 4, 1.5, 8);
      return;
    }
    // Le boomerang tourne sur lui-même.
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(clock * 18);
    ctx.strokeStyle = STYLE.boomerang;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-4, -2.5); ctx.lineTo(0, 2.5); ctx.lineTo(4, -2.5);
    ctx.stroke();
    ctx.restore();
  }

  // Le coup de mêlée : une lame qui sort du joueur dans la direction du coup,
  // de la longueur de l'arme. La zone réellement frappée (state.swing) est un
  // peu plus large que la lame, pour pardonner un coup légèrement décalé.
  function drawSwing(s, p) {
    const f = s.dir;
    const len = s.weapon.reach;
    const thick = s.weapon.width < 10 ? 2 : 3;
    const bx = p.x + f.x * (p.size / 2);
    const by = p.y + f.y * (p.size / 2);
    ctx.fillStyle = STYLE.sword;
    if (f.x) ctx.fillRect(f.x > 0 ? bx : bx - len, by - thick / 2, len, thick);
    else ctx.fillRect(bx - thick / 2, f.y > 0 ? by : by - len, thick, len);
    ctx.fillStyle = "rgba(232, 237, 245, 0.18)";
    ctx.fillRect(s.x, s.y, s.w, s.h);
  }

  function drawPlayer(p) {
    // Clignote tant qu'il est intouchable après un coup.
    if (p.invuln > 0 && Math.floor(clock * 12) % 2 === 0) return;
    const h = p.size / 2;
    const x = Math.round(p.x - h), y = Math.round(p.y - h);
    ctx.fillStyle = STYLE.player;
    ctx.fillRect(x, y, p.size, p.size);
    // Un repère sur le côté où il regarde.
    ctx.fillStyle = "#6b5317";
    ctx.fillRect(x + h - 2 + p.facing.x * 4, y + h - 2 + p.facing.y * 4, 4, 4);
  }

  function drawHud(state) {
    const p = state.player;
    for (let i = 0; i < p.maxHp; i++) {
      ctx.fillStyle = i < p.hp ? STYLE.heart : STYLE.heartEmpty;
      ctx.fillRect(4 + i * 9, 4, 7, 7);
    }
    // Les artefacts trouvés, au milieu de la bande du bas.
    const arts = state.run.artifacts;
    const ax = Config.ZONE_W / 2 - ((arts.length - 1) * 12) / 2;
    arts.forEach((a, i) => drawIcon(a, ax + i * 12, Config.ZONE_H - 8));

    // Butin porté, en jeu : c'est ce qu'on risque.
    drawGem(Config.ZONE_W - 40, 8, 7);
    text(`${state.run.carried}`, Config.ZONE_W - 33, 4, STYLE.text, "left");

    // En bas : ce que vaut une gemme ici, et ce qui est déjà à l'abri.
    const y = Config.ZONE_H - 12;
    const value = state.zone.safe ? state.zone.name.toLowerCase()
      : state.fire ? "camp" : `gemme ×${World.gemValue(state.distance)}`;
    text(value, 4, y, STYLE.dim, "left");
    text(`banque ${Save.data.bank}`, Config.ZONE_W - 4, y, STYLE.dim, "right");
  }

  // La mini-carte montre ce qu'on sait : le camp de base (violet, comme son
  // portail), les écrans visités et leurs portes, et les écrans entrevus
  // derrière ces portes. Le camp (orange) n'y figure que si on l'a vu : il
  // faut le chercher. Le reste est à découvrir, sauf avec la Lanterne, qui
  // montre tout. Un point doré marque un coffre pas encore ouvert.
  function drawMinimap(state) {
    const cell = 4, step = 6;
    const ox = Config.ZONE_W - Config.WALL - 2 - ZoneRegistry.width * step;
    const oy = Config.WALL + 2;
    const visited = (x, y) => state.visited.has(`${x},${y}`);
    const lantern = World.has("lantern");
    const isBase = (c) => c.x === ZoneRegistry.base.x && c.y === ZoneRegistry.base.y;
    const known = (c) => lantern || visited(c.x, c.y) || isBase(c) ||
      (c.links.left && visited(c.x - 1, c.y)) || (c.links.right && visited(c.x + 1, c.y)) ||
      (c.links.up && visited(c.x, c.y - 1)) || (c.links.down && visited(c.x, c.y + 1));

    ctx.fillStyle = "rgba(8, 10, 14, 0.45)";
    ctx.fillRect(ox - 2, oy - 2, ZoneRegistry.width * step + 2, ZoneRegistry.height * step + 2);

    for (const c of ZoneRegistry.cells()) {
      if (!known(c)) continue;
      const x = ox + c.x * step, y = oy + c.y * step;
      const here = c.x === state.coords.x && c.y === state.coords.y;
      const seen = visited(c.x, c.y);
      ctx.fillStyle = here ? STYLE.mapHere : ZoneRegistry.isCamp(c.x, c.y) ? STYLE.mapCamp
        : isBase(c) ? STYLE.portal : seen ? STYLE.mapSeen : STYLE.mapFog;
      ctx.fillRect(x, y, cell, cell);
      const chestHere = c.chest && !state.run.opened.has(`${c.x},${c.y}`);
      if (chestHere && (seen || lantern) && !here) {
        ctx.fillStyle = STYLE.chestLock;
        ctx.fillRect(x + 1, y + 1, 2, 2);
      }
      // Les portes d'un écran visité, vers la droite et vers le bas : chaque
      // passage n'est dessiné qu'une fois.
      if (!seen && !lantern) continue;
      ctx.fillStyle = STYLE.mapSeen;
      if (c.links.right) ctx.fillRect(x + cell, y + 1, step - cell, 2);
      if (c.links.down) ctx.fillRect(x + 1, y + cell, 2, step - cell);
      if (c.links.left && !visited(c.x - 1, c.y)) ctx.fillRect(x - (step - cell), y + 1, step - cell, 2);
      if (c.links.up && !visited(c.x, c.y - 1)) ctx.fillRect(x + 1, y - (step - cell), 2, step - cell);
    }
  }

  function drawBanner(b, dead) {
    const y = Config.ZONE_H / 2 - 22;
    ctx.fillStyle = STYLE.shade;
    ctx.fillRect(Config.WALL, y, Config.ZONE_W - Config.WALL * 2, 36);
    text(b.title, Config.ZONE_W / 2, y + 7, dead ? STYLE.heart : STYLE.player, "center", 10);
    text(b.detail, Config.ZONE_W / 2, y + 22, STYLE.text, "center");
  }

  function text(str, x, y, color, align, size = 8) {
    ctx.fillStyle = color;
    ctx.font = `${size}px monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = "top";
    ctx.fillText(str, x, y);
  }

  // Dessine l'icône d'un objet dans un autre canvas (le bouton d'attaque),
  // avec les mêmes formes que dans le jeu.
  function iconInto(canvas, key) {
    const saved = ctx;
    const size = canvas.width;
    ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, size, size);
    // L'icône tient dans environ 12 px de zone.
    ctx.setTransform(size / 12, 0, 0, size / 12, 0, 0);
    if (key) drawIcon(key, 6, 6);
    ctx = saved;
  }

  return { init, draw, iconInto };
})();

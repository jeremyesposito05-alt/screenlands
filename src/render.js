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
    // Le reste du bestiaire.
    shooter: "#6fcf8a",
    bomber: "#b8323a",
    swarm: "#e3e05a",
    brute: "#8d6a4c",
    guardian: "#7a1f3d",
    bullet: "#ff7ab8",
    eye: "#f4f6fa",
    hunter: "#2a1236",
    hunterEye: "#ff3b5c",
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
    drawGroundFx(state.fx);
    for (const s of solids) {
      ctx.fillStyle = STYLE[s.kind];
      ctx.fillRect(s.x, s.y, s.w, s.h);
    }
    if (state.chest) drawChest(state.chest);
    for (const d of state.drops) {
      if (d.kind === "chest") drawChest(d);
      else drawItemOnGround(d);
    }
    for (const g of state.gems) drawGem(g.x, g.y, g.size);
    for (const e of state.enemies) drawEnemy(e);
    if (state.hunterComing) drawHunterWarning(state.hunterComing);
    if (state.hunter) drawHunter(state.hunter);
    if (state.phase !== "dead") {
      drawPlayer(player);
      drawPlayerFx(state);
    }
    if (state.swing) drawSwing(state.swing, player);
    for (const s of state.projectiles) drawProjectile(s);
    drawEnemyShots(state);

    for (const pop of state.popups) {
      text(pop.text, pop.x, pop.y - 8, pop.tier ? TIERS[pop.tier] : STYLE.gem, "center");
    }

    drawHud(state);
    drawThreat(state);
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
    // Touché : il clignote en blanc pendant qu'il est étourdi. Mèche allumée,
    // il clignote de plus en plus vite.
    const flash = (e.stun > 0 && Math.floor(clock * 20) % 2 === 0) ||
                  (e.fuse > 0 && Math.floor(clock * (10 + 30 * (1 - e.fuse / 0.7))) % 2 === 0);
    ctx.fillStyle = flash ? STYLE.hitFlash : STYLE[e.kind];
    if (e.kind === "bomber" || e.kind === "swarm") {
      // Les ronds : le Kamikaze et les membres d'essaim.
      ctx.beginPath();
      ctx.arc(e.x, e.y, h, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(x, y, e.size, e.size);
    }
    if (e.kind === "bomber" && !flash) {
      // La mèche, une étincelle qui danse.
      ctx.fillStyle = e.fuse > 0 ? "#fff3a0" : "#f0a040";
      ctx.fillRect(e.x + 1 + Math.sin(clock * 30) * 0.8, e.y - h - 2, 2, 2);
    }
    if (e.kind === "guardian" && !flash) {
      // La couronne du Gardien.
      ctx.fillStyle = "#ffc93d";
      ctx.beginPath();
      ctx.moveTo(x + 2, y + 1); ctx.lineTo(x + 2, y - 4); ctx.lineTo(x + 5, y - 1);
      ctx.lineTo(e.x, y - 5); ctx.lineTo(x + e.size - 5, y - 1);
      ctx.lineTo(x + e.size - 2, y - 4); ctx.lineTo(x + e.size - 2, y + 1);
      ctx.closePath();
      ctx.fill();
    }
    if (e.hp > 1 && !flash && e.kind !== "guardian" && e.kind !== "brute") {
      ctx.strokeStyle = STYLE.tough;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, e.size - 1, e.size - 1);
    }
    // Il prépare quelque chose (un tir, une charge) : un cadre blanc qui
    // clignote, le temps de réagir.
    if (e.windup > 0 && Math.floor(clock * 16) % 2 === 0) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - 2, y - 2, e.size + 4, e.size + 4);
    }
    // En pleine charge, une traînée derrière lui.
    if (e.dashing > 0 && e.dashDir) {
      ctx.fillStyle = "rgba(255, 90, 90, 0.35)";
      ctx.fillRect(x - e.dashDir.x * 10, y - e.dashDir.y * 10, e.size, e.size);
    }
    // Les solides ont une barre de vie, dès qu'ils sont entamés.
    if ((e.kind === "brute" || e.kind === "guardian" || e.maxHp >= 4) && e.hp < e.maxHp) {
      const w = Math.max(12, e.size);
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(e.x - w / 2, y - 5, w, 2);
      ctx.fillStyle = e.kind === "guardian" ? "#ffc93d" : STYLE.heart;
      ctx.fillRect(e.x - w / 2, y - 5, w * Math.max(0, e.hp / e.maxHp), 2);
    }
    // Une élite porte une couronne dorée qui scintille.
    if (e.elite && !flash) {
      ctx.strokeStyle = `rgba(242, 196, 77, ${0.6 + 0.4 * Math.sin(clock * 6)})`;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - 1.5, y - 1.5, e.size + 3, e.size + 3);
    }
    // Deux yeux qui regardent où il va, comme les fantômes : c'est ce qui
    // trahit son intention. Les membres d'essaim sont trop petits pour ça.
    if (!flash && e.kind !== "swarm") {
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

  // Les tirs des Tireurs, des billes roses nimbées, et les explosions des
  // Kamikazes, un anneau qui s'élargit.
  function drawEnemyShots(state) {
    for (const b of state.bullets || []) {
      ctx.fillStyle = "rgba(255, 122, 184, 0.35)";
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = STYLE.bullet;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const x of state.blasts || []) {
      const k = x.life / 0.35;
      ctx.fillStyle = `rgba(255, 150, 60, ${0.45 * k})`;
      ctx.beginPath();
      ctx.arc(x.x, x.y, x.r * (1.1 - 0.4 * k), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 230, 150, ${k})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // Le Chasseur : plus grand que les autres, sombre, entouré d'un halo qui
  // palpite, et des yeux rouges qui le suivent.
  function drawHunter(h) {
    const s = 14, half = s / 2;
    const pulse = 0.25 + 0.15 * Math.sin(clock * 5);
    ctx.fillStyle = `rgba(150, 30, 60, ${pulse})`;
    ctx.beginPath();
    ctx.arc(h.x, h.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = STYLE.hunter;
    ctx.fillRect(h.x - half, h.y - half, s, s);
    const lx = h.look.x * 1.5, ly = h.look.y * 1.5;
    ctx.fillStyle = STYLE.hunterEye;
    for (const ox of [-3.5, 3.5]) ctx.fillRect(h.x + ox - 1.5 + lx, h.y - 3 + ly, 3, 2);
  }

  // L'alerte avant l'entrée du Chasseur : un halo rouge qui clignote sur la
  // porte par laquelle il va passer.
  function drawHunterWarning(c) {
    if (Math.floor(clock * 6) % 2) return;
    ctx.fillStyle = "rgba(220, 40, 70, 0.35)";
    ctx.beginPath();
    ctx.arc(c.at.x, c.at.y, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  // La jauge de menace, dans l'ouverture du mur du haut : cinq crans qui se
  // remplissent, du vert au violet du Chasseur.
  const THREAT_COLORS = ["#6fbf73", "#c9c75a", "#e3a24a", "#e0654a", "#c23a6b", "#8e3ad0"];
  function drawThreat(state) {
    const max = Config.THREAT_MAX;
    const level = World.threatLevel();
    const progress = level >= max ? 1
      : (state.run.threat % Config.THREAT_STEP) / Config.THREAT_STEP;
    const x0 = 66, w = 60, y = 5, h = 5;
    const seg = w / max;
    ctx.fillStyle = "rgba(8, 10, 14, 0.6)";
    ctx.fillRect(x0 - 1, y - 1, w + 2, h + 2);
    for (let i = 0; i < max; i++) {
      const fill = i < level ? 1 : i === level ? progress : 0;
      if (fill <= 0) continue;
      ctx.fillStyle = THREAT_COLORS[Math.min(i + 1, max)];
      ctx.fillRect(x0 + i * seg + 0.5, y, (seg - 1) * fill, h);
    }
    // Au dernier palier, la jauge palpite.
    if (level >= max && Math.floor(clock * 3) % 2 === 0) {
      ctx.strokeStyle = THREAT_COLORS[max];
      ctx.lineWidth = 1;
      ctx.strokeRect(x0 - 1.5, y - 1.5, w + 3, h + 3);
    }
  }

  // Les couleurs des raretés : sur les coffres, la mini-carte et les annonces.
  const TIERS = { common: "#b8b2a6", rare: "#4fa3ff", epic: "#b36bff", legendary: "#ffc93d" };

  // Un coffre fermé, cerclé et nimbé de la couleur de sa rareté, pour qu'on
  // juge de loin si le détour en vaut la peine. Le légendaire scintille.
  function drawChest(c) {
    const w = 12, h = 9;
    const x = c.x - w / 2, y = c.y - h / 2;
    const color = TIERS[c.tier] || TIERS.common;
    const strong = c.tier === "epic" || c.tier === "legendary";
    const glow = (strong ? 0.35 : 0.2) + 0.18 * Math.sin(clock * (strong ? 6 : 4));
    ctx.globalAlpha = glow;
    ctx.fillStyle = color;
    ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
    ctx.globalAlpha = 1;
    ctx.fillStyle = STYLE.chest;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = STYLE.chestLid;
    ctx.fillRect(x, y, w, 3);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = color;
    ctx.fillRect(c.x - 1, y + 2, 2, 3);
    if (c.tier === "legendary") {
      const a = clock * 3;
      ctx.fillStyle = "#fff6c9";
      ctx.fillRect(c.x + Math.cos(a) * 9 - 0.75, c.y + Math.sin(a) * 7 - 0.75, 1.5, 1.5);
      ctx.fillRect(c.x - Math.cos(a) * 9 - 0.75, c.y - Math.sin(a) * 7 - 0.75, 1.5, 1.5);
    }
  }

  // Les effets des pouvoirs posés au sol : flammes et ondes de givre, sous
  // les personnages.
  function drawGroundFx(fx) {
    if (!fx) return;
    // Chaque flamme : un halo orange et un cœur jaune qui scintillent, et
    // qui s'éteignent en rétrécissant. Dessinées en lumière additive, pour
    // qu'elles éclairent le sol au lieu de le salir.
    ctx.globalCompositeOperation = "lighter";
    for (const f of fx.flames) {
      const k = f.life / f.max;
      const flicker = 0.85 + 0.15 * Math.sin(clock * 20 + f.x * 3 + f.y);
      const r = f.r * (0.45 + 0.55 * k) * flicker;
      ctx.fillStyle = `rgba(255, 80, 10, ${0.25 + 0.35 * k})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 200, 70, ${0.2 + 0.6 * k})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y - r * 0.15, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    for (const w of fx.waves) {
      ctx.strokeStyle = `rgba(150, 220, 255, ${0.8 * (1 - w.r / w.max)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Les effets attachés au joueur : orbes, éclairs, Égide prête.
  function drawPlayerFx(state) {
    const fx = state.fx, powers = state.run.powers, p = state.player;
    if (!fx) return;
    if (powers.aegis && fx.aegisReady) {
      ctx.strokeStyle = `rgba(120, 200, 255, ${0.45 + 0.2 * Math.sin(clock * 4)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size / 2 + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (powers.orb) {
      for (const o of Powers.orbBodies(state, powers.orb, state.stats)) {
        ctx.fillStyle = "rgba(190, 150, 255, 0.35)";
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.size / 2 + 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#d9c4ff";
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.size / 2 - 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const b of fx.bolts) {
      // Un éclair en zigzag, redessiné à chaque image.
      ctx.strokeStyle = "#fff4a8";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      const n = 5;
      for (let i = 1; i < n; i++) {
        const t = i / n;
        ctx.lineTo(b.x1 + (b.x2 - b.x1) * t + (Math.random() - 0.5) * 8,
                   b.y1 + (b.y2 - b.y1) * t + (Math.random() - 0.5) * 8);
      }
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
    }
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

      // --- Bonus ---
      case "feather":
        ctx.strokeStyle = "#e8edf5";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-3, 4); ctx.quadraticCurveTo(-1, -2, 4, -5);
        ctx.stroke();
        ctx.strokeStyle = STYLE.dim;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(-4, 5); ctx.lineTo(2, -3);
        ctx.stroke();
        break;
      case "whetstone":
        ctx.fillStyle = "#8a93a6";
        ctx.fillRect(-4.5, -1.5, 9, 4);
        ctx.fillStyle = STYLE.sword;
        ctx.fillRect(-4.5, -1.5, 9, 1);
        ctx.fillStyle = "#ffd27a";
        ctx.fillRect(-1, -4.5, 1, 2);
        ctx.fillRect(1.5, -4, 1, 1.5);
        break;
      case "gauntlet":
        ctx.fillStyle = "#b9c2d3";
        ctx.fillRect(-3.5, -1, 7, 5);
        for (let i = 0; i < 4; i++) ctx.fillRect(-3.5 + i * 1.9, -4.5, 1.4, 3.5);
        ctx.fillStyle = STYLE.chestLid;
        ctx.fillRect(-3.5, 3, 7, 1.5);
        break;
      case "lens":
        ctx.strokeStyle = "#cfd8e6";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(-1, -1, 3.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(150, 200, 255, 0.35)";
        ctx.fill();
        ctx.strokeStyle = STYLE.chestLid;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(1.5, 1.5); ctx.lineTo(4.5, 4.5);
        ctx.stroke();
        break;
      case "clover":
        ctx.fillStyle = "#62c46a";
        for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 1.5], [2, 1.5]]) {
          ctx.beginPath();
          ctx.arc(dx, dy - 0.5, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = "#3d8a44";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 1); ctx.lineTo(1.5, 5);
        ctx.stroke();
        break;
      case "flask":
        ctx.fillStyle = "#cfd8e6";
        ctx.fillRect(-1, -5, 2, 2.5);
        ctx.fillStyle = STYLE.heart;
        ctx.beginPath();
        ctx.arc(0, 1.5, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fillRect(-2, 0, 1, 1.5);
        break;

      // --- Pouvoirs ---
      case "fireTrail":
        ctx.fillStyle = "#ff8a3a";
        ctx.beginPath();
        ctx.moveTo(0, -5.5);
        ctx.quadraticCurveTo(4.5, -0.5, 3, 3);
        ctx.quadraticCurveTo(0, 6, -3, 3);
        ctx.quadraticCurveTo(-4.5, -0.5, 0, -5.5);
        ctx.fill();
        ctx.fillStyle = "#ffe08a";
        ctx.beginPath();
        ctx.arc(0, 2, 1.8, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "orb":
        ctx.strokeStyle = "rgba(190, 150, 255, 0.6)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(0, 0, 4.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#d9c4ff";
        ctx.beginPath();
        ctx.arc(3, -3, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = STYLE.player;
        ctx.fillRect(-1.5, -1.5, 3, 3);
        break;
      case "lightning":
        ctx.fillStyle = "#fff07a";
        ctx.beginPath();
        ctx.moveTo(1.5, -5.5); ctx.lineTo(-3, 0.5); ctx.lineTo(0, 0.5);
        ctx.lineTo(-1.5, 5.5); ctx.lineTo(3, -0.5); ctx.lineTo(0, -0.5);
        ctx.closePath();
        ctx.fill();
        break;
      case "frost":
        ctx.strokeStyle = "#9fdcff";
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 3; i++) {
          const a = (i * Math.PI) / 3;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * -5, Math.sin(a) * -5);
          ctx.lineTo(Math.cos(a) * 5, Math.sin(a) * 5);
          ctx.stroke();
        }
        break;
      case "aegis":
        ctx.fillStyle = "#6fb6ff";
        ctx.beginPath();
        ctx.moveTo(0, -5); ctx.lineTo(4.5, -3); ctx.lineTo(3.5, 2);
        ctx.lineTo(0, 5); ctx.lineTo(-3.5, 2); ctx.lineTo(-4.5, -3);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#e8f4ff";
        ctx.fillRect(-0.75, -3, 1.5, 5);
        break;

      // --- Reliques ---
      case "phoenix":
        ctx.fillStyle = "#ff6a3a";
        ctx.beginPath();
        ctx.moveTo(0, -4); ctx.lineTo(5, -5); ctx.lineTo(2.5, 0);
        ctx.lineTo(0, 5); ctx.lineTo(-2.5, 0); ctx.lineTo(-5, -5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#ffd27a";
        ctx.fillRect(-1, -2, 2, 3);
        break;
      case "hourglass":
        ctx.fillStyle = STYLE.chestLid;
        ctx.fillRect(-4, -5, 8, 1.5);
        ctx.fillRect(-4, 3.5, 8, 1.5);
        ctx.fillStyle = "#e6d3a0";
        ctx.beginPath();
        ctx.moveTo(-3, -3.5); ctx.lineTo(3, -3.5); ctx.lineTo(0, 0);
        ctx.lineTo(3, 3.5); ctx.lineTo(-3, 3.5); ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fill();
        break;
      case "crown":
        ctx.fillStyle = "#ffc93d";
        ctx.beginPath();
        ctx.moveTo(-5, 3.5); ctx.lineTo(-5, -3); ctx.lineTo(-2.5, 0);
        ctx.lineTo(0, -4.5); ctx.lineTo(2.5, 0); ctx.lineTo(5, -3); ctx.lineTo(5, 3.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = STYLE.heart;
        ctx.fillRect(-0.75, 0.5, 1.5, 1.5);
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

  // En haut : les cœurs, l'arme en main (en mode glisser, il n'y a pas de
  // bouton pour la montrer), la menace au milieu, et à droite le butin porté,
  // ce qu'on risque, avec ce que vaut une gemme ici.
  // En bas : les pouvoirs et leur niveau, les reliques, et la banque.
  function drawHud(state) {
    const p = state.player;
    // Au-delà de cinq cœurs, ils se resserrent pour laisser la place à l'arme.
    const step = p.maxHp > 5 ? 7 : 9, size = p.maxHp > 5 ? 6 : 7;
    for (let i = 0; i < p.maxHp; i++) {
      ctx.fillStyle = i < p.hp ? STYLE.heart : STYLE.heartEmpty;
      ctx.fillRect(4 + i * step, 4 + (7 - size) / 2, size, size);
    }
    if (state.run.weapon) drawIcon(state.run.weapon, 4 + p.maxHp * step + 5, 8);

    drawGem(132, 8, 7);
    text(`${state.run.carried}`, 138, 4, STYLE.text, "left");
    if (!state.zone.safe && !state.fire) {
      text(`×${World.gemValue(state.distance)}`, Config.ZONE_W - 4, 4, STYLE.dim, "right");
    }

    const y = Config.ZONE_H - 8;
    let x = 10;
    for (const [key, level] of Object.entries(state.run.powers)) {
      drawIcon(key, x, y - 1);
      for (let i = 0; i < Powers.MAX_LEVEL; i++) {
        ctx.fillStyle = i < level ? STYLE.player : STYLE.heartEmpty;
        ctx.fillRect(x - 4 + i * 3, y + 5, 2, 1.5);
      }
      x += 13;
    }
    if (state.run.relics.length) x += 3;
    for (const key of state.run.relics) {
      drawIcon(key, x, y);
      x += 13;
    }
    text(`banque ${Save.data.bank}`, Config.ZONE_W - 4, Config.ZONE_H - 12, STYLE.dim, "right");
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
    // Le Gardien est connu d'avance, en rouge, tant qu'il vit : c'est le but
    // du bout de la carte.
    const bossAt = (c) => ZoneRegistry.isBoss(c.x, c.y) && !state.run.bossDead;
    const known = (c) => lantern || visited(c.x, c.y) || isBase(c) || bossAt(c) ||
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
        : bossAt(c) ? STYLE.heart : isBase(c) ? STYLE.portal : seen ? STYLE.mapSeen : STYLE.mapFog;
      ctx.fillRect(x, y, cell, cell);
      const chestHere = c.chest && !state.run.opened.has(`${c.x},${c.y}`);
      if (chestHere && (seen || lantern) && !here) {
        ctx.fillStyle = TIERS[c.chest.tier];
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

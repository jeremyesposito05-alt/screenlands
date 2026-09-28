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
    chaser: "#d8574a",
    gem: "#5fd4e8",
    fire: "#f08a3c",
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

    if (zone.fire) drawFire(zone.fire);
    for (const s of solids) {
      ctx.fillStyle = STYLE[s.kind];
      ctx.fillRect(s.x, s.y, s.w, s.h);
    }
    for (const g of state.gems) drawGem(g.x, g.y, g.size);
    for (const e of state.enemies) drawEnemy(e);
    if (state.phase !== "dead") drawPlayer(player);

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
    // Endormi à l'entrée de la zone : dessiné terne.
    ctx.globalAlpha = e.wake > 0 ? 0.45 : 1;
    ctx.fillStyle = STYLE.chaser;
    ctx.fillRect(Math.round(e.x - h), Math.round(e.y - h), e.size, e.size);
    ctx.globalAlpha = 1;
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
    // Butin porté, en jeu : c'est ce qu'on risque.
    drawGem(Config.ZONE_W - 40, 8, 7);
    text(`${state.run.carried}`, Config.ZONE_W - 33, 4, STYLE.text, "left");

    // En bas : ce que vaut une gemme ici, et ce qui est déjà à l'abri.
    const y = Config.ZONE_H - 12;
    const value = state.zone.camp ? state.zone.name.toLowerCase()
      : `gemme ×${World.gemValue(state.distance)}`;
    text(value, 4, y, STYLE.dim, "left");
    text(`banque ${Save.data.bank}`, Config.ZONE_W - 4, y, STYLE.dim, "right");
  }

  function drawMinimap(state) {
    const cell = 4, gap = 1;
    const w = ZoneRegistry.width, h = ZoneRegistry.height;
    const ox = Config.ZONE_W - Config.WALL - 2 - w * (cell + gap);
    const oy = Config.WALL + 2;
    for (let cy = 0; cy < h; cy++) {
      for (let cx = 0; cx < w; cx++) {
        const here = cx === state.coords.x && cy === state.coords.y;
        // Les camps sont connus d'avance : ce sont les destinations.
        const camp = ZoneRegistry.get(cx, cy).camp;
        const seen = state.visited.has(`${cx},${cy}`);
        ctx.fillStyle = here ? STYLE.mapHere : camp ? STYLE.mapCamp
          : seen ? STYLE.mapSeen : STYLE.mapFog;
        ctx.fillRect(ox + cx * (cell + gap), oy + cy * (cell + gap), cell, cell);
      }
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

  return { init, draw };
})();

"use strict";

// Le rendu : tout ce qui dessine, et rien d'autre.
//
// Il lit l'état de World sans jamais le modifier. Le décor et le héros sont
// des images (voir Sprites et Scenery) ; le reste est encore fait de formes
// de couleur, qui serviront aussi de repli tant qu'une image manque.
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

  // Le dessin se fait en couches, de bas en haut :
  // 1. le sol, mis en cache par zone : texture, détails, murs, obstacles,
  //    pieds des arbres et des lampadaires (voir groundLayer) ;
  // 2. ce qui est posé au sol : feu, portail, effets, coffres, gemmes ;
  // 3. les personnages, rangés par profondeur : celui qui est plus bas sur
  //    l'écran passe devant ;
  // 4. le surplomb : feuillages et lanternes, qui s'effacent quand quelqu'un
  //    passe dessous (voir drawOverhang) ;
  // 5. la lumière : la pénombre, et les halos des lanternes, du feu et du
  //    héros (voir drawLighting) ;
  // 6. l'interface.
  // Sans les images (pas encore chargées, ou absentes), les couches 1, 4 et
  // 5 retombent sur les anciennes formes de couleur.
  function draw(state, dt) {
    clock += dt;
    const { zone, solids, player } = state;
    const art = !!Sprites.get("ground_grass");
    const dress = art ? Scenery.dress(state) : null;

    // La secousse décale tout le monde du jeu, jamais l'interface.
    shake = Math.max(0, shake - dt);
    hurtFlash = Math.max(0, hurtFlash - dt);
    const amp = shake > 0 ? shakeAmp * (shake / SHAKE_TIME) : 0;
    ctx.save();
    if (amp) ctx.translate(Math.round((Math.random() - 0.5) * 2 * amp), Math.round((Math.random() - 0.5) * 2 * amp));

    if (art) {
      ctx.drawImage(groundLayer(state, dress), 0, 0);
    } else {
      ctx.fillStyle = zone.ground;
      ctx.fillRect(0, 0, Config.ZONE_W, Config.ZONE_H);
    }

    if (state.fire) drawFire(state.fire);
    if (state.portal) drawPortal(state.portal);
    for (const s of state.stairs) drawStairs(s);
    drawGroundFx(state.fx);
    if (!art) {
      for (const s of solids) {
        ctx.fillStyle = STYLE[s.kind];
        ctx.fillRect(s.x, s.y, s.w, s.h);
      }
    }
    if (state.chest) drawChest(state.chest);
    for (const d of state.drops) {
      if (d.kind === "chest") drawChest(d);
      else drawItemOnGround(d);
    }
    for (const g of state.gems) drawGem(g.x, g.y, g.size);
    if (state.superGem) drawSuperGem(state.superGem);
    drawDowned(state);
    if (state.hunterComing) drawHunterWarning(state.hunterComing);

    // Les personnages, rangés par la hauteur de leurs pieds.
    const actors = state.enemies.map((e) => ({ y: e.y + e.size / 2, draw: () => drawEnemy(e) }));
    if (state.hunter) actors.push({ y: state.hunter.y + 7, draw: () => drawHunter(state.hunter) });
    for (const a of state.run.allies) actors.push({ y: a.y + 4, draw: () => drawAlly(a.type, a.x, a.y) });
    if (state.phase !== "dead") actors.push({ y: player.y + player.size / 2, draw: () => drawPlayer(player, dt) });
    actors.sort((a, b) => a.y - b.y);
    for (const a of actors) a.draw();

    if (state.phase !== "dead") drawPlayerFx(state);
    drawAllyAttacks(state);
    if (state.swing) drawSwing(state.swing, player);
    for (const s of state.projectiles) drawProjectile(s);
    drawEnemyShots(state);

    if (art) {
      drawOverhang(state, dress, dt);
      drawLighting(state, dress);
    }

    ctx.restore();
    // Touché : un voile rouge qui s'efface.
    if (hurtFlash > 0) {
      const W = Config.ZONE_W, H = Config.ZONE_H;
      const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.7);
      v.addColorStop(0, "rgba(200, 30, 40, 0)");
      v.addColorStop(1, `rgba(200, 30, 40, ${(0.45 * hurtFlash / HURT_FLASH).toFixed(3)})`);
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, W, H);
    }

    for (const pop of state.popups) {
      text(pop.text, pop.x, pop.y - 8, pop.tier ? TIERS[pop.tier] : STYLE.gem, "center");
    }

    drawHud(state);
    drawThreat(state);
    drawMinimap(state);
    if (state.banner) drawBanner(state.banner, state.phase === "dead");
  }

  // Un personnage en image, centré sur `cx`, les pieds en `feet`, avec son
  // ombre ; en blanc s'il vient d'être touché, soulevé de `bob` pixels.
  // `rim` : [couleur, opacité] d'un contour autour de lui.
  function drawCharacter(name, cx, feet, flip = false, flash = false, bob = 0, rim = null) {
    const img = flash ? Sprites.white(name) : Sprites.get(name);
    if (!img) return;
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = "rgb(30, 20, 50)";
    ctx.beginPath();
    ctx.ellipse(cx, feet, img.width * 0.35, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;
    const x = Math.round(cx - img.width / 2), y = Math.round(feet - img.height + 1 - bob);
    const ring = rim && Sprites.outline(name, 0, rim[0]);
    if (ring) {
      ctx.globalAlpha = alpha * rim[1];
      drawSprite(ring, x - 1, y - 1, flip);
      ctx.globalAlpha = alpha;
    }
    drawSprite(img, x, y, flip);
  }

  // Une image, éventuellement retournée de gauche à droite.
  function drawSprite(img, x, y, flip = false, c = ctx) {
    if (!flip) { c.drawImage(img, x, y); return; }
    c.save();
    c.translate(x + img.width, y);
    c.scale(-1, 1);
    c.drawImage(img, 0, 0);
    c.restore();
  }

  // --- Couche 1 : le sol ---
  // Tout ce qui ne bouge pas, peint une fois par zone dans un canvas à la
  // taille de la zone, puis recopié à chaque image.
  const HEDGE_DARK = "#20381f";
  let groundCanvas = null, groundKey = "";

  function groundLayer(state, dress) {
    const key = `${ZoneRegistry.seed}|${state.coords.x},${state.coords.y}|${Sprites.version}`;
    if (groundCanvas && key === groundKey) return groundCanvas;
    groundKey = key;
    const W = Config.ZONE_W, H = Config.ZONE_H, t = Config.WALL;
    if (!groundCanvas) groundCanvas = document.createElement("canvas");
    groundCanvas.width = W; groundCanvas.height = H;
    const g = groundCanvas.getContext("2d");
    g.imageSmoothingEnabled = false;
    const S = Sprites.get;

    // La texture n'est pas répétée telle quelle, ce qui dessinerait un motif
    // régulier : le sol est un patchwork de petits carrés pris au hasard dans
    // l'image, retournés au hasard. L'image n'a donc pas besoin de se
    // raccorder sur ses bords.
    const tile = S(dress.ground);
    const rng = makeRandom(deriveSeed(ZoneRegistry.seed, state.coords.x, state.coords.y, 57));
    const P = 12;
    for (let y = 0; y < H; y += P) {
      for (let x = 0; x < W; x += P) {
        const sx = rng.int(tile.width - P + 1), sy = rng.int(tile.height - P + 1);
        const fx = rng.chance(0.5), fy = rng.chance(0.5);
        g.save();
        g.translate(x + (fx ? P : 0), y + (fy ? P : 0));
        g.scale(fx ? -1 : 1, fy ? -1 : 1);
        g.drawImage(tile, sx, sy, P, P, 0, 0, P, P);
        g.restore();
      }
    }
    // Un voile de la couleur moyenne du sol : il le calme, pour que les
    // personnages ressortent dessus.
    g.fillStyle = averageColor(tile, 0.4);
    g.fillRect(0, 0, W, H);
    for (const d of dress.decals) {
      const img = S(d.name);
      if (img) drawSprite(img, d.x, d.y, d.flip, g);
    }

    // Les obstacles : un rocher par bloc carré, de la haie pour les murs
    // intérieurs allongés.
    for (const s of state.solids) {
      if (s.kind === "wall") continue;
      if (s.w === s.h) {
        const big = s.w > Config.TILE;
        const img = S(`${big ? "rock" : "rock_small"}_${(s.x * 7 + s.y * 3) % 2 ? "a" : "b"}`);
        g.fillStyle = "rgba(30, 20, 50, 0.3)";
        g.beginPath();
        g.ellipse(s.x + s.w / 2, s.y + s.h - 1, s.w / 2, s.h / 6, 0, 0, Math.PI * 2);
        g.fill();
        if (img) g.drawImage(img, Math.round(s.x + (s.w - img.width) / 2), s.y + s.h - img.height);
      } else {
        hedgeRun(g, s, true);
      }
    }

    // Les murs de bordure : une haie.
    for (const s of state.solids) if (s.kind === "wall") hedgeRun(g, s, false);

    // Les encadrements de porte.
    const exits = ZoneRegistry.exits(state.coords.x, state.coords.y);
    const half = Config.DOOR / 2;
    for (const side of ["left", "right"]) {
      if (!exits[side]) continue;
      const cy = doorCenter(side, exits[side]).y;
      const x = side === "left" ? 0 : W - t;
      const a = S("door_pillar_a"), b = S("door_pillar_b");
      if (a) g.drawImage(a, x + (t - a.width) / 2, cy - half - a.height + 4);
      if (b) g.drawImage(b, x + (t - b.width) / 2, cy + half - 4);
    }
    for (const side of ["up", "down"]) {
      if (!exits[side]) continue;
      const cx = doorCenter(side, exits[side]).x;
      const l = S("door_left"), r = S("door_right");
      const y = side === "up" ? t - (l ? l.height : 0) : H - (l ? l.height : 0);
      // Les piliers de ces images sont aux 85 % (gauche) et 17 % (droite) de
      // leur largeur : on les cale sur les bords du passage.
      if (l) g.drawImage(l, Math.round(cx - half - l.width * 0.85), y);
      if (r) g.drawImage(r, Math.round(cx + half - r.width * 0.17), y);
    }

    // Les pieds des arbres et des lampadaires, plantés dans les murs.
    for (const prop of dress.props) {
      const parts = propParts(prop);
      if (parts.base) drawSprite(parts.base.img, parts.base.x, parts.base.y, parts.base.flip, g);
    }
    return groundCanvas;
  }

  // La couleur moyenne d'une image, avec cette opacité.
  const averages = new Map();
  function averageColor(img, alpha) {
    if (!averages.has(img)) {
      const c = document.createElement("canvas");
      c.width = c.height = 1;
      const x = c.getContext("2d");
      x.imageSmoothingEnabled = true;
      x.drawImage(img, 0, 0, 1, 1);
      averages.set(img, x.getImageData(0, 0, 1, 1).data.slice(0, 3).join(", "));
    }
    return `rgba(${averages.get(img)}, ${alpha})`;
  }

  // Une haie le long d'un mur, en morceaux qui se chevauchent pour cacher
  // leurs bouts arrondis. Elle déborde un peu vers la salle, jamais dans
  // l'ouverture d'une porte.
  function hedgeRun(g, s, inner) {
    const horizontal = s.w > s.h;
    const img = Sprites.get(horizontal ? "hedge_h" : "hedge_v");
    g.fillStyle = HEDGE_DARK;
    g.fillRect(s.x, s.y, s.w, s.h);
    if (!img) return;
    g.save();
    g.beginPath();
    if (horizontal) g.rect(s.x, s.y - 6, s.w, s.h + 8);
    else g.rect(s.x - 3, s.y, s.w + 6, s.h);
    g.clip();
    if (horizontal) {
      const rows = inner ? [s.y - 2, s.y + s.h - img.height] : [s.y + s.h - img.height + (s.y === 0 ? 1 : 0)];
      for (const y of rows) {
        for (let x = s.x - 6; x < s.x + s.w; x += img.width - 6) g.drawImage(img, x, y);
      }
    } else {
      for (let y = s.y - 6; y < s.y + s.h; y += img.height - 6) g.drawImage(img, s.x + (s.w - img.width) / 2, y);
    }
    g.restore();
  }

  // Les deux morceaux d'un arbre ou d'un lampadaire : le pied, peint avec le
  // sol, et le haut, en surplomb. `light` : où brille la lanterne.
  function propParts(prop) {
    const W = Config.ZONE_W, t = Config.WALL;
    const wallX = prop.side === "left" ? t / 2 : W - t / 2;
    const inward = prop.side === "left" ? 1 : -1;
    const S = Sprites.get;
    if (prop.type === "tree") {
      const trunk = S("tree_trunk"), top = S("tree_top");
      if (!trunk || !top) return {};
      return {
        base: { img: trunk, x: Math.round(wallX - trunk.width / 2), y: prop.y - trunk.height, flip: inward < 0 },
        top: { img: top, x: Math.round(wallX + inward * 14 - top.width / 2), y: prop.y - trunk.height + 8 - top.height,
               flip: inward < 0 },
      };
    }
    const pole = S("lamp_pole"), head = S("lamp_head");
    if (!pole || !head) return {};
    const hx = inward > 0 ? Math.round(wallX - 3) : Math.round(wallX + 3 - head.width);
    const hy = prop.y - pole.height - head.height + 8;
    return {
      base: { img: pole, x: Math.round(wallX - pole.width / 2), y: prop.y - pole.height, flip: false },
      top: { img: head, x: hx, y: hy, flip: inward < 0 },
      light: { x: hx + head.width * (inward > 0 ? 0.8 : 0.2), y: hy + head.height * 0.7 },
    };
  }

  // --- Couche 4 : le surplomb ---
  // Feuillages et lanternes passent au-dessus des personnages. Quand le héros
  // ou un ennemi est dessous, ils deviennent transparents : on ne perd
  // jamais de vue ce qui compte.
  const fade = new Map();
  let fadeKey = "";
  function drawOverhang(state, dress, dt) {
    const key = `${ZoneRegistry.seed}|${state.coords.x},${state.coords.y}`;
    if (key !== fadeKey) { fade.clear(); fadeKey = key; }
    const bodies = [state.player, ...state.enemies, ...(state.hunter ? [state.hunter] : [])];
    dress.props.forEach((prop, i) => {
      const top = propParts(prop).top;
      if (!top) return;
      const under = bodies.some((b) => b.x > top.x - 2 && b.x < top.x + top.img.width + 2 &&
                                       b.y > top.y - 2 && b.y < top.y + top.img.height + 6);
      const target = under ? 0.35 : 1;
      const a = fade.has(i) ? fade.get(i) : target;
      const next = a + Math.sign(target - a) * Math.min(Math.abs(target - a), dt * 4);
      fade.set(i, next);
      ctx.globalAlpha = next;
      drawSprite(top.img, top.x, top.y, top.flip);
      ctx.globalAlpha = 1;
    });
  }

  // --- Couche 5 : la lumière ---
  // Une pénombre bleutée, plus épaisse sur les bords et à mesure que la
  // menace monte, percée par les halos ; puis une lueur chaude par-dessus les
  // lanternes et le feu. Calculée à la taille de la zone et agrandie en
  // douceur : la lumière n'a pas besoin de pixels nets.
  let lightCanvas = null;
  function drawLighting(state, dress) {
    const W = Config.ZONE_W, H = Config.ZONE_H;
    if (!lightCanvas) { lightCanvas = document.createElement("canvas"); lightCanvas.width = W; lightCanvas.height = H; }
    const l = lightCanvas.getContext("2d");
    const night = state.zone.safe ? 0.12 : 0.2 + 0.05 * (state.threatLevel || 0);
    l.globalCompositeOperation = "source-over";
    l.clearRect(0, 0, W, H);
    l.fillStyle = `rgba(16, 12, 38, ${night})`;
    l.fillRect(0, 0, W, H);
    const v = l.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.7);
    v.addColorStop(0, "rgba(16, 12, 38, 0)");
    v.addColorStop(1, "rgba(16, 12, 38, 0.4)");
    l.fillStyle = v;
    l.fillRect(0, 0, W, H);

    const flicker = 1 + 0.06 * Math.sin(clock * 9) + 0.04 * Math.sin(clock * 23);
    const lights = [{ x: state.player.x, y: state.player.y, r: 44, warm: false }];
    for (const prop of dress.props) {
      const light = propParts(prop).light;
      if (light) lights.push({ ...light, r: 52 * flicker, warm: true });
    }
    if (state.fire) lights.push({ x: state.fire.x, y: state.fire.y, r: 72 * flicker, warm: true });
    if (state.portal) lights.push({ x: state.portal.x, y: state.portal.y, r: 46, warm: false });

    l.globalCompositeOperation = "destination-out";
    for (const s of lights) {
      const gr = l.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
      gr.addColorStop(0, "rgba(0, 0, 0, 0.9)");
      gr.addColorStop(1, "rgba(0, 0, 0, 0)");
      l.fillStyle = gr;
      l.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(lightCanvas, 0, 0, W, H);
    ctx.imageSmoothingEnabled = false;

    ctx.globalCompositeOperation = "lighter";
    for (const s of lights) {
      if (!s.warm) continue;
      const gr = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 0.6);
      gr.addColorStop(0, "rgba(255, 170, 80, 0.22)");
      gr.addColorStop(1, "rgba(255, 170, 80, 0)");
      ctx.fillStyle = gr;
      ctx.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
    }
    ctx.globalCompositeOperation = "source-over";

    // Les bandes de l'interface, assombries pour que le texte s'y lise.
    for (const [y0, y1] of [[0, 18], [H, H - 18]]) {
      const gr = ctx.createLinearGradient(0, y0, 0, y1);
      gr.addColorStop(0, "rgba(12, 10, 24, 0.65)");
      gr.addColorStop(1, "rgba(12, 10, 24, 0)");
      ctx.fillStyle = gr;
      ctx.fillRect(0, Math.min(y0, y1), W, 18);
    }
  }

  // --- Réactions de l'écran ---
  // Une secousse quand ça cogne, un voile rouge quand le héros est touché.
  const SHAKE_TIME = 0.25, HURT_FLASH = 0.35;
  const SHAKES = { hurt: 3, allyDown: 2, explode: 3.5, killBig: 1.5, victory: 3, death: 4 };
  let shake = 0, shakeAmp = 0, hurtFlash = 0;
  function react(events) {
    for (const e of events) {
      const a = SHAKES[e.type];
      if (a) {
        shakeAmp = shake > 0 ? Math.max(shakeAmp, a) : a;
        shake = SHAKE_TIME;
      }
      if (e.type === "hurt" || e.type === "death") hurtFlash = HURT_FLASH;
    }
  }

  function drawFire(f) {
    const img = Sprites.get("campfire");
    if (img) {
      drawSprite(img, Math.round(f.x - img.width / 2), Math.round(f.y - img.height / 2 - 3));
    } else {
      // Deux carrés qui palpitent : juste de quoi repérer le feu de loin.
      const pulse = Math.sin(clock * 8) > 0 ? 1 : 0;
      ctx.fillStyle = STYLE.fire;
      ctx.fillRect(f.x - 7 - pulse, f.y - 7 - pulse, 14 + pulse * 2, 14 + pulse * 2);
      ctx.fillStyle = STYLE.fireCore;
      ctx.fillRect(f.x - 3, f.y - 3, 6, 6);
    }
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
    const img = Sprites.get("portal");
    if (img) {
      drawSprite(img, Math.round(pt.x - img.width / 2), Math.round(pt.y - img.height / 2 - 3));
      return;
    }
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

  // Une gemme : en image, elle scintille, chacune à son rythme selon sa
  // place ; l'interface la dessine immobile (`still`).
  function drawGem(x, y, size, still = false) {
    const glint = still ? 0 : Math.floor(clock * 4 + x * 0.37 + y * 0.21) % 6;
    const img = Sprites.get(`gem_${"abcaaa"[glint]}`);
    if (img) {
      drawSprite(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2));
      return;
    }
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

  // --- Le rôdeur : un petit fantôme de Pac-Man, en pixels ---
  // Le corps en deux images (le bas de la robe ondule), contour sombre, et
  // les yeux par-dessus. Violet en chasse, bleu quand il a peur, et il
  // clignote en blanc quand la peur va finir.
  const GHOST_BODY = [
    "....####....",
    "..########..",
    ".##########.",
    ".##########.",
    "############",
    "############",
    "############",
    "############",
    "############",
    "############",
  ];
  const GHOST_SKIRT = [["############", "#.###..###.#"], ["############", ".###.##.###."]];
  const ghosts = new Map();
  function ghostImage(color, frame) {
    const key = `${color}|${frame}`;
    if (!ghosts.has(key)) {
      const rows = [...GHOST_BODY, ...GHOST_SKIRT[frame]];
      const c = document.createElement("canvas");
      c.width = 14; c.height = 14;
      const g = c.getContext("2d");
      const paint = (ox, oy, fill) => {
        g.fillStyle = fill;
        rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === "#") g.fillRect(x + ox, y + oy, 1, 1); }));
      };
      for (const [ox, oy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) paint(ox, oy, "#1d1230");
      paint(1, 1, color);
      ghosts.set(key, c);
    }
    return ghosts.get(key);
  }

  function drawGhost(e) {
    const scared = e.frightened > 0;
    const blink = scared && e.frightened < 1.5 && Math.floor(clock * 8) % 2 === 0;
    const color = !scared ? "#a35cf0" : blink ? "#e8ecff" : "#2c56e0";
    const img = ghostImage(color, Math.floor(clock * 6) % 2);
    const x = Math.round(e.x - 7), y = Math.round(e.y - 8);
    ctx.globalAlpha = e.wake > 0 ? 0.45 : 1;
    ctx.fillStyle = "rgba(30, 20, 50, 0.35)";
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + 6, 5, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(img, x, y);
    if (scared) {
      // Apeuré : deux points pâles et une bouche en zigzag.
      ctx.fillStyle = blink ? "#c0304a" : "#f4d0d8";
      ctx.fillRect(x + 4, y + 5, 2, 2);
      ctx.fillRect(x + 8, y + 5, 2, 2);
      for (let k = 0; k < 4; k++) ctx.fillRect(x + 3 + k * 2, y + 9 + (k % 2), 2, 1);
    } else {
      // En chasse : de grands yeux qui regardent où il va.
      const lx = e.look.x, ly = e.look.y;
      for (const ox of [3, 8]) {
        ctx.fillStyle = "#f4f6fa";
        ctx.fillRect(x + ox, y + 4, 3, 4);
        ctx.fillStyle = "#1e3a8a";
        ctx.fillRect(x + ox + 1 + lx, y + 5 + ly, 2, 2);
      }
    }
    ctx.globalAlpha = 1;
  }

  // Un escalier, en pixels : un trou sombre et ses marches qui s'enfoncent
  // pour descendre, des marches claires qui montent vers la lumière pour
  // remonter. Un halo l'annonce de loin.
  function drawStairs(s) {
    const x = Math.round(s.x - 10), y = Math.round(s.y - 10);
    const down = s.dir === "down";
    const glow = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, 20);
    glow.addColorStop(0, down ? "rgba(120, 200, 255, 0.35)" : "rgba(255, 230, 160, 0.4)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(s.x - 20, s.y - 20, 40, 40);
    ctx.fillStyle = "#1d1230";
    ctx.fillRect(x - 1, y - 1, 22, 22);
    const steps = down ? ["#8c8794", "#5e5866", "#3a3442", "#221c2c", "#120c1a"] : ["#3a3442", "#5e5866", "#8c8794", "#b8b2a6", "#e8e0cc"];
    steps.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(x, y + i * 4, 20, 4);
      ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
      ctx.fillRect(x, y + i * 4 + 3, 20, 1);
    });
    // Une flèche qui palpite indique le sens.
    const bob = Math.round(Math.sin(clock * 4) * 1.5);
    ctx.fillStyle = down ? "#9fdcff" : "#fff3c4";
    const ay = down ? y - 7 + bob : y - 9 - bob;
    for (let k = 0; k < 3; k++) {
      const w = down ? 7 - 2 * k : 1 + 2 * k;
      ctx.fillRect(s.x - Math.floor(w / 2), ay + k, w, 1);
    }
  }

  // La super-gemme : une grosse gemme qui palpite dans un halo blanc.
  function drawSuperGem(g) {
    const pulse = 1 + 0.15 * Math.sin(clock * 6);
    const halo = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, 14 * pulse);
    halo.addColorStop(0, "rgba(255, 255, 255, 0.55)");
    halo.addColorStop(1, "rgba(150, 230, 255, 0)");
    ctx.fillStyle = halo;
    ctx.fillRect(g.x - 16, g.y - 16, 32, 32);
    const img = Sprites.get(`gem_${"abc"[Math.floor(clock * 8) % 3]}`);
    if (img) {
      ctx.drawImage(img, Math.round(g.x - img.width), Math.round(g.y - img.height), img.width * 2, img.height * 2);
    } else {
      drawGem(g.x, g.y, 12);
    }
  }

  // L'ancienne forme de couleur d'un ennemi, tant qu'il n'a pas d'image.
  function drawEnemyShape(e, x, y, h, flash) {
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
  }

  function drawEnemy(e) {
    if (e.kind === "prowler") {
      drawGhost(e);
      return;
    }
    const h = e.size / 2;
    const x = Math.round(e.x - h), y = Math.round(e.y - h);
    // Endormi à l'entrée de la zone : dessiné terne.
    ctx.globalAlpha = e.wake > 0 ? 0.45 : 1;
    // Touché : il clignote en blanc pendant qu'il est étourdi. Mèche allumée,
    // il clignote de plus en plus vite.
    const flash = (e.stun > 0 && Math.floor(clock * 20) % 2 === 0) ||
                  (e.fuse > 0 && Math.floor(clock * (10 + 30 * (1 - e.fuse / 0.7))) % 2 === 0);
    // En image, il regarde où il va et trottine ; sinon, sa forme de couleur.
    const sprite = Sprites.get(`enemy_${e.kind}`);
    if (sprite) {
      const moving = e.wake <= 0 && e.stun <= 0;
      const bob = moving && Math.floor(clock * 8 + e.x * 0.13) % 2 ? 1 : 0;
      // Le contour remplace les anciens cadres : blanc qui clignote quand il
      // prépare un coup, doré qui palpite pour une élite.
      const rim = e.windup > 0 && Math.floor(clock * 16) % 2 === 0 ? ["#ffffff", 1]
        : e.elite && !flash ? ["#f2c44d", 0.6 + 0.4 * Math.sin(clock * 6)] : null;
      if (e.dashing > 0 && e.dashDir) {
        ctx.globalAlpha = 0.35;
        drawCharacter(`enemy_${e.kind}`, e.x - e.dashDir.x * 10, e.y + h - e.dashDir.y * 10, e.look && e.look.x < 0);
        ctx.globalAlpha = e.wake > 0 ? 0.45 : 1;
      }
      drawCharacter(`enemy_${e.kind}`, e.x, e.y + h, e.look && e.look.x < 0, flash, bob, rim);
    } else {
      drawEnemyShape(e, x, y, h, flash);
    }
    // Il prépare quelque chose (un tir, une charge) : un cadre blanc qui
    // clignote, le temps de réagir.
    if (!sprite && e.windup > 0 && Math.floor(clock * 16) % 2 === 0) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - 2, y - 2, e.size + 4, e.size + 4);
    }
    // En pleine charge, une traînée derrière lui.
    if (!sprite && e.dashing > 0 && e.dashDir) {
      ctx.fillStyle = "rgba(255, 90, 90, 0.35)";
      ctx.fillRect(x - e.dashDir.x * 10, y - e.dashDir.y * 10, e.size, e.size);
    }
    // Les solides ont une barre de vie, dès qu'ils sont entamés.
    if ((e.kind === "brute" || e.kind === "guardian" || e.maxHp >= 4) && e.hp < e.maxHp) {
      const w = Math.max(12, e.size);
      const by = sprite ? Math.round(e.y + h - sprite.height) - 3 : y - 5;
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(e.x - w / 2, by, w, 2);
      ctx.fillStyle = e.kind === "guardian" ? "#ffc93d" : STYLE.heart;
      ctx.fillRect(e.x - w / 2, by, w * Math.max(0, e.hp / e.maxHp), 2);
    }
    // Une élite porte une couronne dorée qui scintille.
    if (!sprite && e.elite && !flash) {
      ctx.strokeStyle = `rgba(242, 196, 77, ${0.6 + 0.4 * Math.sin(clock * 6)})`;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - 1.5, y - 1.5, e.size + 3, e.size + 3);
    }
    // Deux yeux qui regardent où il va, comme les fantômes : c'est ce qui
    // trahit son intention. Les membres d'essaim sont trop petits pour ça.
    if (!flash && !sprite && e.kind !== "swarm") {
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

  // Les compagnons : un petit personnage de la couleur du joueur, avec ce
  // qu'il tient. Ceux qui sont à terre clignotent, cerclés du temps qui leur
  // reste pour être relevés. Puis leurs flèches et leurs coups.
  const ALLY_COLORS = { archer: "#7fd0ff", warrior: "#d9dde6" };
  function drawAlly(type, x, y, alpha = 1) {
    ctx.globalAlpha = alpha;
    if (Sprites.get(`ally_${type}`)) {
      const bob = Math.floor(clock * 8 + x * 0.2) % 2 ? 1 : 0;
      drawCharacter(`ally_${type}`, x, y + 4, false, false, bob);
      ctx.globalAlpha = 1;
      return;
    }
    ctx.fillStyle = STYLE.player;
    ctx.fillRect(x - 4, y - 4, 8, 8);
    ctx.fillStyle = ALLY_COLORS[type];
    ctx.fillRect(x - 4, y - 4, 8, 3);
    ctx.globalAlpha = 1;
  }

  // Les compagnons à terre, au sol sous les autres personnages.
  function drawDowned(state) {
    for (const d of state.downed || []) {
      if (Math.floor(clock * 8) % 2 === 0) drawAlly(d.type, d.x, d.y, 0.6);
      ctx.strokeStyle = "rgba(242, 196, 77, 0.8)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (d.time / Allies.DOWN_TIME));
      ctx.stroke();
    }
  }

  function drawAllyAttacks(state) {
    for (const s of state.allyShots || []) {
      const d = Math.hypot(s.vx, s.vy) || 1;
      ctx.strokeStyle = ALLY_COLORS.archer;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(s.x - (s.vx / d) * 4, s.y - (s.vy / d) * 4);
      ctx.lineTo(s.x + (s.vx / d) * 2, s.y + (s.vy / d) * 2);
      ctx.stroke();
    }
    for (const s of state.slashes || []) {
      ctx.strokeStyle = `rgba(232, 237, 245, ${s.life / 0.14})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.tx, s.ty);
      ctx.stroke();
    }
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
    if (Sprites.get("enemy_hunter")) {
      drawCharacter("enemy_hunter", h.x, h.y + half, h.look && h.look.x < 0);
      return;
    }
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
    const w = 60, x0 = Config.ZONE_W / 2 - w / 2, y = 5, h = 5;
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
    const img = Sprites.get(`chest_${c.tier}`) || Sprites.get("chest_common");
    ctx.globalAlpha = glow;
    if (img) {
      // En image, un halo rond au sol plutôt qu'un carré.
      const halo = ctx.createRadialGradient(c.x, c.y + 2, 0, c.x, c.y + 2, 13);
      halo.addColorStop(0, color);
      halo.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = halo;
      ctx.fillRect(c.x - 13, c.y - 11, 26, 26);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
    }
    ctx.globalAlpha = 1;
    if (img) {
      drawSprite(img, Math.round(c.x - img.width / 2), Math.round(c.y + h / 2 - img.height + 2));
    } else {
      ctx.fillStyle = STYLE.chest;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = STYLE.chestLid;
      ctx.fillRect(x, y, w, 3);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      ctx.fillStyle = color;
      ctx.fillRect(c.x - 1, y + 2, 2, 3);
    }
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
    const img = Sprites.get(`icon_${key}`);
    if (img) {
      drawSprite(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2));
      return;
    }
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
      case "banner":
        ctx.fillStyle = STYLE.chestLid;
        ctx.fillRect(-3.5, -5, 1.2, 10);
        ctx.fillStyle = "#4fa3ff";
        ctx.beginPath();
        ctx.moveTo(-2.3, -5); ctx.lineTo(4.5, -5); ctx.lineTo(3, -2.5); ctx.lineTo(4.5, 0);
        ctx.lineTo(-2.3, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#ffc93d";
        ctx.fillRect(0, -3.5, 1.5, 1.5);
        break;
      case "runeBlade":
        ctx.fillStyle = "#9fdcff";
        ctx.fillRect(-1, -5.5, 2, 8);
        ctx.fillStyle = "#b36bff";
        ctx.fillRect(-0.5, -4, 1, 1);
        ctx.fillRect(-0.5, -1.5, 1, 1);
        ctx.fillStyle = "#ffc93d";
        ctx.fillRect(-3, 2.5, 6, 1.5);
        ctx.fillStyle = STYLE.chestLid;
        ctx.fillRect(-0.75, 4, 1.5, 2);
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

  // Le héros en image : de face, de dos ou de profil (retourné vers la
  // gauche), les pieds au bas de son carré de collision, la tête qui dépasse
  // au-dessus. En marche, il joue ses images dans l'ordre immobile, pas A,
  // immobile, pas B ; une image seule sautille d'un pixel à la place.
  const WALK = [0, 1, 0, 2];
  const HERO_RIM = "rgba(248, 225, 185, 0.85)";
  // « En marche » tient un instant après le dernier pas : sur un écran à
  // 120 Hz, certaines images tombent entre deux pas de physique.
  const lastStep = { x: 0, y: 0, moving: false, linger: 0 };
  function drawPlayer(p, dt = 0) {
    if (dt > 0) {
      if (Math.hypot(p.x - lastStep.x, p.y - lastStep.y) > 0.05) lastStep.linger = 0.1;
      else lastStep.linger = Math.max(0, lastStep.linger - dt);
      lastStep.moving = lastStep.linger > 0;
      lastStep.x = p.x; lastStep.y = p.y;
    }
    // Clignote tant qu'il est intouchable après un coup.
    if (p.invuln > 0 && Math.floor(clock * 12) % 2 === 0) return;
    const f = p.facing;
    const name = f.y < 0 && !f.x ? "hero_back" : f.x ? "hero_side" : "hero_front";
    const img = Sprites.get(name);
    if (img) {
      // Pour qu'on le retrouve d'un coup d'œil : une flaque de lumière
      // chaude sous lui, une ombre franche, et en course un liseré crème.
      const feet = p.y + p.size / 2;
      const pool = ctx.createRadialGradient(p.x, feet - 2, 0, p.x, feet - 2, 14);
      pool.addColorStop(0, "rgba(255, 236, 190, 0.32)");
      pool.addColorStop(1, "rgba(255, 236, 190, 0)");
      ctx.fillStyle = pool;
      ctx.fillRect(p.x - 14, feet - 16, 28, 28);
      ctx.fillStyle = "rgba(30, 20, 50, 0.5)";
      ctx.beginPath();
      ctx.ellipse(p.x, feet, 6, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      const fw = Sprites.frameWidth(name), count = Sprites.frames(name);
      const step = Math.floor(clock * 8) % 4;
      const frame = lastStep.moving && count >= 3 ? WALK[step] : 0;
      const bob = lastStep.moving && count < 3 && step % 2 ? 1 : 0;
      const x = Math.round(p.x - fw / 2), y = Math.round(feet - img.height + 1 - bob);
      ctx.save();
      if (f.x < 0) { ctx.translate(x + fw, y); ctx.scale(-1, 1); } else ctx.translate(x, y);
      const rim = lastStep.moving && Sprites.outline(name, frame, HERO_RIM);
      if (rim) ctx.drawImage(rim, -1, -1);
      ctx.drawImage(img, frame * fw, 0, fw, img.height, 0, 0, fw, img.height);
      ctx.restore();
      return;
    }
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
    // Au-delà de cinq cœurs et compagnons, ils se resserrent pour laisser la
    // place à l'arme sans empiéter sur la jauge de menace.
    const units = p.maxHp + state.run.allies.length;
    const step = units > 5 ? 7 : 9, size = units > 5 ? 6 : 7;
    for (let i = 0; i < p.maxHp; i++) {
      ctx.fillStyle = i < p.hp ? STYLE.heart : STYLE.heartEmpty;
      ctx.fillRect(4 + i * step, 4 + (7 - size) / 2, size, size);
    }
    // Les compagnons comptent comme des cœurs de plus : ils s'affichent juste
    // après, puis vient l'arme.
    let hx = 4 + p.maxHp * step;
    for (const a of state.run.allies) {
      ctx.fillStyle = ALLY_COLORS[a.type];
      ctx.fillRect(hx + 1, 4 + (7 - size) / 2, size - 1, size);
      hx += step - 1;
    }
    if (state.run.weapon) drawIcon(state.run.weapon, hx + 5, 8);

    drawGem(Config.ZONE_W - 60, 8, 7, true);
    text(`${state.run.carried}`, Config.ZONE_W - 54, 4, STYLE.text, "left");
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
    const floor = state.run.floor > 1 ? `étage ${state.run.floor} · ` : "";
    text(`${floor}banque ${Save.data.bank}`, Config.ZONE_W - 4, Config.ZONE_H - 12, STYLE.dim, "right");
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
    // Le Gardien et l'escalier qui descend ne sont plus connus d'avance : il
    // faut les trouver. Une fois vu, l'écran est rouge tant que le Gardien
    // vit, et l'escalier y est marqué d'un point blanc.
    const bossAt = (c) => ZoneRegistry.isBoss(c.x, c.y) && !state.run.bossDead;
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
        : bossAt(c) ? STYLE.heart : isBase(c) ? STYLE.portal : seen ? STYLE.mapSeen : STYLE.mapFog;
      ctx.fillRect(x, y, cell, cell);
      const chestHere = c.chest && !state.run.opened.has(`${c.x},${c.y}`);
      if (chestHere && (seen || lantern) && !here) {
        ctx.fillStyle = TIERS[c.chest.tier];
        ctx.fillRect(x + 1, y + 1, 2, 2);
      }
      if (ZoneRegistry.isStairs(c.x, c.y) && (seen || lantern) && !here) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x + 1, y + 2, 2, 2);
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
    ctx.imageSmoothingEnabled = false;
    if (key) drawIcon(key, 6, 6);
    ctx = saved;
  }

  return { init, draw, react, iconInto };
})();

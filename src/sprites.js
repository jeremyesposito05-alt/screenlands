"use strict";

// Les images du jeu, chargées une fois au démarrage depuis assets/sprites.
//
// Elles sont fabriquées par tools/pixelizer.html à partir des planches de
// assets/concepts (voir tools/recipes.js). Une image manquante ou pas encore
// chargée n'est pas une erreur : get() rend null, et le rendu dessine alors
// l'ancienne forme de couleur à sa place. On peut donc ajouter les images
// une par une.

const Sprites = (() => {
  const NAMES = [
    "hero_front", "hero_side", "hero_back",
    ...["front", "side", "back"].flatMap((v) => ["", "_idle", "_attack", "_hurt"].map((a) => `hero3d_${v}${a}`)),
    "hero3d_death",
    "ground_grass", "ground_dirt",
    "decal_grass", "decal_flowers", "decal_pebbles", "decal_puddle", "decal_leaves", "decal_root",
    "rock_a", "rock_b", "rock_small_a", "rock_small_b",
    "hedge_h", "hedge_corner", "hedge_v",
    "door_arch", "door_left", "door_right", "door_pillar_a", "door_pillar_b",
    "tree_trunk", "tree_top", "lamp_pole", "lamp_head",
    "enemy_chaser", "enemy_ambusher", "enemy_pincer", "enemy_shy", "enemy_shooter",
    "enemy_bomber", "enemy_swarm", "enemy_brute", "enemy_guardian", "enemy_hunter",
    ...["sylve", "liane", "braise", "petard", "givre", "orage", "egide", "gloutonne", "ombre", "rosee"].map((k) => `spirit_${k}`),
    "chest_common", "chest_rare", "chest_epic", "chest_legendary",
    "gem_a", "gem_b", "gem_c", "campfire", "portal",
    ...["sword", "spear", "bow", "boomerang", "feather", "whetstone", "gauntlet", "lens", "clover",
        "magnet", "heart", "boots", "lantern", "flask", "fireTrail", "orb", "lightning", "frost"]
      .map((k) => `icon_${k}`),
  ];
  // Les images animées sont des bandes d'images côte à côte : la largeur
  // d'une image. Les autres n'en ont qu'une.
  const FRAME_W = { hero_front: 40, hero_side: 40, hero_back: 40 };
  // La chevalière 3D : 48 pixels par image, 112 pour l'attaque et la chute
  // (l'épée et ses traînées, le corps allongé).
  for (const v of ["front", "side", "back"]) {
    FRAME_W[`hero3d_${v}`] = FRAME_W[`hero3d_${v}_idle`] = FRAME_W[`hero3d_${v}_hurt`] = 48;
    FRAME_W[`hero3d_${v}_attack`] = 112;
  }
  FRAME_W.hero3d_death = 112;
  const images = {};
  // Augmente à chaque image arrivée : le rendu s'en sert pour savoir que ce
  // qu'il a mis en cache est à refaire.
  let version = 0;

  function load() {
    for (const name of NAMES) {
      const img = new Image();
      img.onload = () => {
        // La taille à l'écran, en unités de zone : Config.ART pixels de dessin
        // par unité.
        img.w = img.width / Config.ART;
        img.h = img.height / Config.ART;
        images[name] = img;
        version++;
      };
      img.src = `assets/sprites/${name}.png`;
    }
  }

  // La silhouette blanche d'une image, pour le clignotement d'un coup reçu.
  const whites = {};
  function white(name) {
    if (!whites[name] && images[name]) {
      const img = images[name];
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const x = c.getContext("2d");
      x.drawImage(img, 0, 0);
      x.globalCompositeOperation = "source-in";
      x.fillStyle = "#ffffff";
      x.fillRect(0, 0, c.width, c.height);
      c.w = img.w; c.h = img.h;
      whites[name] = c;
    }
    return whites[name] || null;
  }

  // Le contour extérieur d'une image de la bande : les pixels transparents
  // qui touchent l'image, dans une toile plus grande d'un pixel de chaque
  // côté. Sert à détacher le héros du sol quand il court.
  const outlines = {};
  function outline(name, frame, color) {
    const key = `${name}|${frame}|${color}`;
    if (!outlines[key] && images[name]) {
      const img = images[name], fw = FRAME_W[name] || img.width, h = img.height;
      const src = document.createElement("canvas");
      src.width = fw; src.height = h;
      const s = src.getContext("2d");
      s.drawImage(img, frame * fw, 0, fw, h, 0, 0, fw, h);
      const a = s.getImageData(0, 0, fw, h).data;
      const solid = (x, y) => x >= 0 && y >= 0 && x < fw && y < h && a[(y * fw + x) * 4 + 3] > 127;
      const c = document.createElement("canvas");
      c.width = fw + 2; c.height = h + 2;
      const o = c.getContext("2d");
      o.fillStyle = color;
      for (let y = -1; y <= h; y++) {
        for (let x = -1; x <= fw; x++) {
          if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) {
            o.fillRect(x + 1, y + 1, 1, 1);
          }
        }
      }
      c.w = c.width / Config.ART; c.h = c.height / Config.ART;
      outlines[key] = c;
    }
    return outlines[key] || null;
  }

  return {
    load,
    white,
    outline,
    get: (name) => images[name] || null,
    // Largeur d'une image dans la bande, et nombre d'images.
    frameWidth: (name) => FRAME_W[name] || (images[name] ? images[name].width : 0),
    frames: (name) => (images[name] ? Math.round(images[name].width / (FRAME_W[name] || images[name].width)) : 0),
    get version() { return version; },
    // Toutes les images sont là.
    get complete() { return Object.keys(images).length === NAMES.length; },
  };
})();

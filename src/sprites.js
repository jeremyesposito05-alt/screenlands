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
    "ground_grass", "ground_dirt",
    "decal_grass", "decal_flowers", "decal_pebbles", "decal_puddle", "decal_leaves", "decal_root",
    "rock_a", "rock_b", "rock_small_a", "rock_small_b",
    "hedge_h", "hedge_corner", "hedge_v",
    "door_arch", "door_left", "door_right", "door_pillar_a", "door_pillar_b",
    "tree_trunk", "tree_top", "lamp_pole", "lamp_head",
    "enemy_chaser", "enemy_ambusher", "enemy_pincer", "enemy_shy", "enemy_shooter",
    "enemy_bomber", "enemy_swarm", "enemy_brute", "enemy_guardian", "enemy_hunter",
    "ally_archer", "ally_warrior",
    "chest_common", "chest_rare", "chest_epic", "chest_legendary",
    "gem_a", "gem_b", "gem_c", "campfire", "portal",
    ...["sword", "spear", "bow", "boomerang", "feather", "whetstone", "gauntlet", "lens", "clover",
        "magnet", "heart", "boots", "lantern", "flask", "fireTrail", "orb", "lightning", "frost"]
      .map((k) => `icon_${k}`),
  ];
  // Les images animées sont des bandes d'images côte à côte : la largeur
  // d'une image. Les autres n'en ont qu'une.
  const FRAME_W = { hero_front: 18, hero_side: 18, hero_back: 18 };
  const images = {};
  // Augmente à chaque image arrivée : le rendu s'en sert pour savoir que ce
  // qu'il a mis en cache est à refaire.
  let version = 0;

  function load() {
    for (const name of NAMES) {
      const img = new Image();
      img.onload = () => { images[name] = img; version++; };
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
      whites[name] = c;
    }
    return whites[name] || null;
  }

  return {
    load,
    white,
    get: (name) => images[name] || null,
    // Largeur d'une image dans la bande, et nombre d'images.
    frameWidth: (name) => FRAME_W[name] || (images[name] ? images[name].width : 0),
    frames: (name) => (images[name] ? Math.round(images[name].width / (FRAME_W[name] || images[name].width)) : 0),
    get version() { return version; },
    // Toutes les images sont là.
    get complete() { return Object.keys(images).length === NAMES.length; },
  };
})();

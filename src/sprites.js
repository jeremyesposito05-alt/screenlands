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

  return {
    load,
    get: (name) => images[name] || null,
    // Largeur d'une image dans la bande, et nombre d'images.
    frameWidth: (name) => FRAME_W[name] || (images[name] ? images[name].width : 0),
    frames: (name) => (images[name] ? Math.round(images[name].width / (FRAME_W[name] || images[name].width)) : 0),
    get version() { return version; },
    // Toutes les images sont là.
    get complete() { return Object.keys(images).length === NAMES.length; },
  };
})();

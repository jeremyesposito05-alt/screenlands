"use strict";

// Les recettes des sprites du jeu : quelle planche de assets/concepts, quel
// élément (numéroté de haut en bas puis de gauche à droite, comme le montre
// le convertisseur), à quelle taille maximale, sous quel nom dans
// assets/sprites. Ouvrir tools/pixelizer.html?build pour tout refabriquer.
//
// palette : "hero" pour la palette validée du héros, sinon une palette de
//   `colors` couleurs tirée de l'élément lui-même.
// fill : étire l'élément à la taille exacte (les textures de sol).
// link : écart de liaison entre taches (1 sépare des éléments très proches).
// crop : [x0, y0, x1, y1] en fractions, pour ne garder qu'une partie.
const RECIPES = [
  // Le héros, en attendant la retouche à la main.
  { src: "hero_sheet.webp", pick: 0, w: 20, h: 28, out: "hero_front", palette: "hero" },
  { src: "hero_sheet.webp", pick: 1, w: 20, h: 28, out: "hero_side", palette: "hero" },
  { src: "hero_sheet.webp", pick: 2, w: 20, h: 28, out: "hero_back", palette: "hero" },

  // Le sol de la forêt : deux textures qui se répètent.
  { src: "ground_sheet.webp", pick: 0, w: 48, h: 48, out: "ground_grass", fill: true, colors: 12 },
  { src: "ground_sheet.webp", pick: 1, w: 48, h: 48, out: "ground_dirt", fill: true, colors: 12 },

  // Les petits détails semés sur le sol.
  { src: "decals_sheet.webp", pick: 0, w: 16, h: 16, out: "decal_grass", colors: 10 },
  { src: "decals_sheet.webp", pick: 1, w: 16, h: 16, out: "decal_flowers", colors: 10 },
  { src: "decals_sheet.webp", pick: 2, w: 16, h: 16, out: "decal_pebbles", colors: 10 },
  { src: "decals_sheet.webp", pick: 3, w: 16, h: 16, out: "decal_puddle", colors: 10 },
  { src: "decals_sheet.webp", pick: 4, w: 16, h: 16, out: "decal_leaves", colors: 10 },
  { src: "decals_sheet.webp", pick: 5, w: 16, h: 16, out: "decal_root", colors: 10 },

  // Les obstacles : gros rochers de 2 tuiles, petits d'une tuile.
  { src: "rock_sheet.webp", pick: 0, w: 32, h: 32, out: "rock_a" },
  { src: "rock_sheet.webp", pick: 1, w: 32, h: 32, out: "rock_b" },
  { src: "rock_sheet.webp", pick: 0, w: 16, h: 16, out: "rock_small_a" },
  { src: "rock_sheet.webp", pick: 1, w: 16, h: 16, out: "rock_small_b" },

  // La haie qui borde les salles.
  { src: "hedge_sheet.webp", pick: 0, w: 32, h: 18, out: "hedge_h" },
  { src: "hedge_sheet.webp", pick: 1, w: 22, h: 24, out: "hedge_corner" },
  { src: "hedge_sheet.webp", pick: 2, w: 14, h: 30, out: "hedge_v" },

  // Les encadrements de porte.
  { src: "door_sheet.webp", pick: 0, w: 96, h: 34, out: "door_arch" },
  { src: "door_sheet.webp", pick: 1, w: 40, h: 33, out: "door_left" },
  { src: "door_sheet.webp", pick: 2, w: 40, h: 33, out: "door_right" },
  { src: "door_sheet.webp", pick: 3, w: 16, h: 50, out: "door_pillar_a" },
  { src: "door_sheet.webp", pick: 4, w: 16, h: 50, out: "door_pillar_b" },

  // Ce qui déborde sur la salle : arbre (tronc et feuillage) et lampadaire
  // (pied et potence).
  { src: "tree_sheet.webp", pick: 0, w: 30, h: 29, out: "tree_trunk", link: 1 },
  { src: "tree_sheet.webp", pick: 1, w: 56, h: 52, out: "tree_top", link: 1 },
  { src: "lamp_sheet.webp", pick: 0, w: 12, h: 44, out: "lamp_pole" },
  { src: "lamp_sheet.webp", pick: 1, w: 24, h: 38, out: "lamp_head" },
];

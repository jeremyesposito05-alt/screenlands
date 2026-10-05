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
  // Le héros n'est plus tiré d'une planche : il est dessiné à la main dans
  // assets/pixel/hero.js (voir tools/paint.html).

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

  // Vague 2 : le bestiaire, chacun un peu plus grand que son carré de collision.
  { src: "enemies_a_sheet.webp", pick: 0, w: 16, h: 16, out: "enemy_chaser", link: 1 },
  { src: "enemies_a_sheet.webp", pick: 1, w: 16, h: 16, out: "enemy_ambusher", link: 1 },
  { src: "enemies_a_sheet.webp", pick: 2, w: 16, h: 16, out: "enemy_pincer", link: 1 },
  { src: "enemies_a_sheet.webp", pick: 3, w: 16, h: 16, out: "enemy_shy", link: 1 },
  { src: "enemies_b_sheet.webp", pick: 0, w: 16, h: 16, out: "enemy_shooter" },
  { src: "enemies_b_sheet.webp", pick: 1, w: 14, h: 16, out: "enemy_bomber" },
  { src: "enemies_b_sheet.webp", pick: 2, w: 10, h: 10, out: "enemy_swarm" },
  { src: "enemies_b_sheet.webp", pick: 3, w: 22, h: 20, out: "enemy_brute" },
  { src: "bosses_sheet.webp", pick: 0, w: 28, h: 30, out: "enemy_guardian" },
  { src: "bosses_sheet.webp", pick: 1, w: 20, h: 22, out: "enemy_hunter" },

  // Les compagnons, un peu plus petits que le héros.
  { src: "allies_sheet.webp", pick: 0, w: 16, h: 22, out: "ally_archer" },
  { src: "allies_sheet.webp", pick: 1, w: 16, h: 22, out: "ally_warrior" },

  // Coffres fermés, gemme en trois reflets, feu de camp et portail.
  { src: "chest_sheet.webp", pick: 0, w: 16, h: 14, out: "chest_common" },
  { src: "chest_sheet.webp", pick: 1, w: 16, h: 14, out: "chest_rare" },
  { src: "chest_sheet.webp", pick: 2, w: 16, h: 14, out: "chest_epic" },
  { src: "chest_sheet.webp", pick: 3, w: 16, h: 14, out: "chest_legendary" },
  { src: "gem_sheet.webp", pick: 0, w: 9, h: 9, out: "gem_a" },
  { src: "gem_sheet.webp", pick: 1, w: 9, h: 9, out: "gem_b" },
  { src: "gem_sheet.webp", pick: 2, w: 9, h: 9, out: "gem_c" },
  { src: "camp_sheet.webp", pick: 0, w: 22, h: 22, out: "campfire" },
  { src: "camp_sheet.webp", pick: 2, w: 30, h: 28, out: "portal" },

  // Les icônes des objets (pas encore : égide et reliques).
  { src: "icons_a_sheet.webp", pick: 0, w: 12, h: 12, out: "icon_lantern" },
  { src: "icons_a_sheet.webp", pick: 1, w: 12, h: 12, out: "icon_flask" },
  { src: "icons_a_sheet.webp", pick: 2, w: 12, h: 12, out: "icon_fireTrail" },
  { src: "icons_a_sheet.webp", pick: 3, w: 12, h: 12, out: "icon_orb" },
  { src: "icons_a_sheet.webp", pick: 4, w: 12, h: 12, out: "icon_lightning" },
  { src: "icons_a_sheet.webp", pick: 5, w: 12, h: 12, out: "icon_frost" },
  { src: "icons_b_sheet.webp", pick: 0, w: 12, h: 12, out: "icon_sword" },
  { src: "icons_b_sheet.webp", pick: 1, w: 12, h: 12, out: "icon_spear" },
  { src: "icons_b_sheet.webp", pick: 2, w: 12, h: 12, out: "icon_bow" },
  { src: "icons_b_sheet.webp", pick: 3, w: 12, h: 12, out: "icon_boomerang" },
  { src: "icons_b_sheet.webp", pick: 4, w: 12, h: 12, out: "icon_feather" },
  { src: "icons_b_sheet.webp", pick: 5, w: 12, h: 12, out: "icon_whetstone" },
  { src: "icons_c_sheet.webp", pick: 0, w: 12, h: 12, out: "icon_gauntlet" },
  { src: "icons_c_sheet.webp", pick: 1, w: 12, h: 12, out: "icon_lens" },
  { src: "icons_c_sheet.webp", pick: 2, w: 12, h: 12, out: "icon_clover" },
  { src: "icons_c_sheet.webp", pick: 3, w: 12, h: 12, out: "icon_magnet" },
  { src: "icons_c_sheet.webp", pick: 4, w: 12, h: 12, out: "icon_heart" },
  { src: "icons_c_sheet.webp", pick: 5, w: 12, h: 12, out: "icon_boots" },
];

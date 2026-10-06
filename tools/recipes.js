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
  // L'héroïne, la chevalière : une grille de 4 × 4 cases à fond blanc
  // (lignes : trois quarts dos, face, dos, profil ; 4 images de marche par
  // ligne). On lit chaque case sans ses bords et on y garde la plus grande
  // forme, pour laisser de côté les étiquettes de texte. (L'ancien héros à
  // capuche, hero_walk_sheet.png, reste dans assets/concepts.)
  ...[["hero_front", 1], ["hero_back", 2], ["hero_side", 3]].flatMap(([out, row]) => [0, 1, 2, 3].map((frame) => {
    const xs = [0, 226, 450, 673, 896], ys = [0, 302, 603, 902, 1200];
    return { src: "knight_walk_sheet.jpg", pick: "largest", frame, w: 20, h: 30, out, colors: 24,
             // La première colonne porte l'étiquette en bas : on s'arrête au-dessus.
             area: [xs[frame] + 6, ys[row] + 6, xs[frame + 1] - 6, ys[row + 1] - (frame === 0 ? 30 : 6)] };
  })),

  // La chevalière en 3D : une grande planche à fond blanc et lignes de grille
  // grises, 13 rangées (face, dos, profil : immobile 4, marche 9, attaque 6,
  // coup reçu 2 ; puis la chute, 5). Les cases n'ont pas toutes la même
  // largeur : leurs bords sont relevés à la main (l'épée et ses traînées
  // masquent certaines lignes). Toutes les bandes partagent la même échelle
  // (`scale`), pour que la chevalière garde sa taille d'une animation à
  // l'autre ; l'attaque et la chute ont des cases plus larges.
  ...(() => {
    const IDLE = [1, 148, 291, 433, 577], WALK = [1, 148, 265, 383, 490, 594, 702, 825, 956, 1084];
    const rows = [
      ["hero3d_front_idle", 1, 110, IDLE], ["hero3d_front", 110, 220, WALK],
      ["hero3d_front_attack", 220, 335, [1, 213, 395, 566, 718, 876, 1084]], ["hero3d_front_hurt", 335, 450, [1, 201, 392]],
      ["hero3d_back_idle", 455, 568, IDLE], ["hero3d_back", 568, 690, WALK],
      ["hero3d_back_attack", 690, 814, [1, 215, 399, 566, 718, 876, 1084]], ["hero3d_back_hurt", 814, 928, [1, 206, 390]],
      ["hero3d_side_idle", 933, 1046, IDLE], ["hero3d_side", 1046, 1155, WALK],
      ["hero3d_side_attack", 1155, 1271, [1, 220, 400, 595, 718, 876, 1084]], ["hero3d_side_hurt", 1271, 1370, [1, 191, 374]],
      ["hero3d_death", 1370, 1446, [1, 194, 396, 628, 847, 1084]],
    ];
    return rows.flatMap(([out, y0, y1, xs]) => xs.slice(0, -1).map((x, frame) => {
      const wide = /attack|death/.test(out);
      return { src: "knight3d_full_sheet.png", pick: "largest", frame, w: wide ? 56 : 24, h: 32, out, colors: 32,
               scale: 0.3, area: [x + 4, y0 + 4, xs[frame + 1] - 4, y1 - 4] };
    }));
  })(),

  // Les esprits compagnons : 10 rangées de 3 images de flottement, sur fond
  // vert dans un cadre sombre. Les étincelles relient parfois deux rangées :
  // leurs limites sont fixées à la main, et on garde la plus grande forme.
  ...["sylve", "liane", "braise", "petard", "givre", "orage", "egide", "gloutonne", "ombre", "rosee"]
    .flatMap((name, row) => [0, 1, 2].map((frame) => {
      const xs = [80, 330, 600, 860], ys = [44, 200, 363, 508, 656, 806, 951, 1108, 1253, 1464, 1620];
      return { src: "spirits_sheet.webp", pick: "largest", frame, w: 14, h: 14, out: `spirit_${name}`, colors: 16,
               bgAt: [[60, 60]], area: [xs[frame], ys[row], xs[frame + 1], ys[row + 1]] };
    })),

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

// Les tailles ci-dessus sont en unités de zone ; les images sont fabriquées
// avec ART_SCALE pixels de dessin par unité (la même valeur que Config.ART).
const ART_SCALE = 2;
for (const r of RECIPES) {
  r.w *= ART_SCALE;
  r.h *= ART_SCALE;
  if (r.scale) r.scale *= ART_SCALE;
}

"use strict";

// Les objets qu'on trouve en fouillant la carte : armes et artefacts.
//
// Le joueur part de chaque expédition les mains vides. Les objets sont cachés
// dans des coffres que Generator répartit sur la carte ; ils sont perdus à la
// fin de l'expédition, comme le butin porté. Seule la banque survit.
//
// Une arme se tient à une main : en ramasser une autre fait tomber l'ancienne
// au sol, où l'on peut revenir la chercher. Les artefacts, eux, s'ajoutent.
//
// Tout est décrit ici par des données : deux mécaniques d'arme seulement
// (`melee`, un coup devant soi, et `shot`, un projectile), et une nouvelle
// arme est une fiche de plus.

const ITEMS = {
  // --- Armes ---
  sword: {
    name: "Épée",
    hint: "un coup rapide devant soi",
    type: "weapon",
    mode: "melee",
    // Durée du coup, délai avant le suivant, portée devant le joueur,
    // largeur en travers, recul infligé.
    time: 0.15, cooldown: 0.28, reach: 14, width: 18, knockback: 20, damage: 1,
  },
  spear: {
    name: "Lance",
    hint: "longue portée, coup plus lent",
    type: "weapon",
    mode: "melee",
    time: 0.2, cooldown: 0.42, reach: 28, width: 8, knockback: 28, damage: 1,
  },
  bow: {
    name: "Arc",
    hint: "une flèche jusqu'au premier obstacle",
    type: "weapon",
    mode: "shot",
    projectile: "arrow",
    cooldown: 0.45, speed: 220, size: 4, damage: 1, knockback: 10,
  },
  boomerang: {
    name: "Boomerang",
    hint: "étourdit, rapporte les gemmes",
    type: "weapon",
    mode: "shot",
    projectile: "boomerang",
    // Il ne blesse pas : il étourdit longtemps, ramasse les gemmes qu'il
    // touche, et revient. On ne peut pas le relancer avant son retour.
    cooldown: 0.2, speed: 170, size: 8, damage: 0, stun: 1.4, range: 84, returns: true, collects: true,
  },

  // --- Artefacts ---
  heart: {
    name: "Réceptacle",
    hint: "un cœur de plus",
    type: "artifact",
  },
  boots: {
    name: "Bottes de vent",
    hint: "vitesse +15 %",
    type: "artifact",
    speedBonus: 0.15,
  },
  magnet: {
    name: "Aimant",
    hint: "les gemmes viennent à toi",
    type: "artifact",
    radius: 44, pull: 110,
  },
  lantern: {
    name: "Lanterne",
    hint: "révèle la carte et ses coffres",
    type: "artifact",
  },
};

// Ce que Generator peut cacher, et où.
const LOOT = {
  // Une arme de mêlée, toujours près du camp de base : on ne reste pas
  // désarmé longtemps.
  nearWeapons: ["sword", "spear"],
  // Une arme à distance, plus loin.
  farWeapons: ["bow", "boomerang"],
  artifacts: ["heart", "boots", "magnet", "lantern"],
  // Distance maximale de l'arme de départ, et minimale de l'arme lointaine.
  NEAR_MAX: 2,
  FAR_MIN: 3,
  // Nombre d'artefacts par carte, tous différents : moins qu'il n'en existe,
  // pour que chaque expédition ait sa couleur.
  ARTIFACTS_PER_MAP: 3,
};

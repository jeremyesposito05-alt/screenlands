"use strict";

// Tout ce qu'on trouve en fouillant la carte.
//
// Le joueur part de chaque expédition les mains vides. Les objets sont dans
// des coffres, de quatre raretés (voir Loot), et sont perdus à la mort. Seule
// la banque survit.
//
// Cinq sortes d'objets :
// - `weapon` : l'arme en main, une seule à la fois ; en ramasser une autre
//   fait tomber l'ancienne au sol. Deux mécaniques : `melee` (un coup devant
//   soi) et `shot` (un projectile), voir Weapons ;
// - `boost` : un bonus de caractéristique, qui se cumule (voir Stats) ;
// - `power` : un pouvoir qui agit tout seul, à la Vampire Survivors, et qui
//   monte de niveau quand on en retrouve un (voir Powers) ;
// - `relic` : un objet légendaire unique, à l'effet spécial ;
// - `consumable` : pris et consommé aussitôt ;
// - `ally` : un compagnon qui rejoint la file derrière le joueur, attaque
//   seul, et tombe à sa place quand il est touché (voir Allies).
//
// Les effets sur les caractéristiques sont décrits par `mods`, que Stats
// additionne : speed et damage en fraction (+0,1 = +10 %), haste pour la
// cadence, area pour la portée, magnet en pixels, luck en points, maxHp en
// cœurs, gemMul pour la valeur des gemmes, weaponDamage pour les seuls
// dégâts de l'arme, allyMax pour la longueur de la file de compagnons.

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
  // Plus lente et plus étroite que l'épée, mais deux fois plus forte, deux
  // fois plus longue, et elle embroche tout ce qui est aligné : l'arme des
  // couloirs.
  spear: {
    name: "Lance",
    hint: "2 dégâts, transperce en ligne",
    type: "weapon",
    mode: "melee",
    time: 0.18, cooldown: 0.36, reach: 30, width: 8, knockback: 28, damage: 2,
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

  // --- Bonus (coffres communs) ---
  feather: { name: "Plume", hint: "vitesse +8 %", type: "boost", mods: { speed: 0.08 } },
  whetstone: { name: "Pierre à aiguiser", hint: "dégâts +25 %", type: "boost", mods: { damage: 0.25 } },
  gauntlet: { name: "Gantelet", hint: "cadence +12 %", type: "boost", mods: { haste: 0.12 } },
  lens: { name: "Loupe", hint: "portée +15 %", type: "boost", mods: { area: 0.15 } },
  clover: { name: "Trèfle", hint: "chance +1 : de plus beaux coffres", type: "boost", mods: { luck: 1 } },
  magnet: { name: "Aimant", hint: "les gemmes viennent à toi", type: "boost", mods: { magnet: 40 } },
  flask: { name: "Fiole", hint: "un cœur rendu", type: "consumable" },

  // --- Artefacts (coffres rares) ---
  heart: { name: "Réceptacle", hint: "un cœur de plus", type: "boost", mods: { maxHp: 1 } },
  boots: { name: "Bottes de vent", hint: "vitesse +15 %", type: "boost", mods: { speed: 0.15 } },
  lantern: { name: "Lanterne", hint: "révèle la carte et ses coffres", type: "boost", unique: true, mods: {} },

  // --- Pouvoirs (coffres rares et épiques), réglés dans Powers ---
  fireTrail: { name: "Traînée de feu", hint: "le sol brûle derrière toi", type: "power" },
  orb: { name: "Orbe", hint: "des orbes tournent autour de toi", type: "power" },
  lightning: { name: "Éclair", hint: "frappe l'ennemi le plus proche", type: "power" },
  frost: { name: "Onde de givre", hint: "ralentit tout autour de toi", type: "power" },
  aegis: { name: "Égide", hint: "absorbe un coup, puis se recharge", type: "power" },

  // --- Compagnons (coffres rares), réglés dans Allies ---
  archer: { name: "Archer", hint: "te suit et tire sur l'ennemi proche", type: "ally" },
  warrior: { name: "Guerrier", hint: "te suit et frappe ce qui approche", type: "ally" },

  // --- Reliques (coffres légendaires), uniques ---
  phoenix: { name: "Cœur de phénix", hint: "tu reviendras une fois de la mort", type: "relic" },
  hourglass: { name: "Sablier", hint: "menace −2 min, puis figée 1 min", type: "relic" },
  crown: { name: "Couronne d'avarice", hint: "toutes les gemmes valent double", type: "relic", mods: { gemMul: 1 } },
  // Deux compagnons tout de suite, et deux places de plus dans la file.
  banner: { name: "Étendard du roi", hint: "2 compagnons, file de 6", type: "relic", mods: { allyMax: 2 } },
  // L'arme en main frappe deux fois plus fort (pas les pouvoirs ni les
  // compagnons : c'est la relique de ceux qui jouent au contact).
  runeBlade: { name: "Lame runique", hint: "dégâts de l'arme ×2", type: "relic", mods: { weaponDamage: 1 } },
};

// Ce qui peut sortir de chaque sorte de coffre, et où les coffres se
// trouvent (voir Loot pour les règles du tirage).
const LOOT = {
  // Deux armes sont toujours cachées : une de mêlée près du camp de base,
  // pour qu'on ne reste pas désarmé longtemps, et une à distance, plus loin.
  nearWeapons: ["sword", "spear"],
  farWeapons: ["bow", "boomerang"],
  NEAR_MAX: 2,
  FAR_MIN: 3,
  // En plus, des coffres au hasard, un par écran au plus.
  RANDOM_CHESTS: 8,

  commons: ["feather", "whetstone", "gauntlet", "lens", "clover", "magnet", "flask"],
  rareArtifacts: ["heart", "boots", "lantern"],
  powers: ["fireTrail", "orb", "lightning", "frost", "aegis"],
  allies: ["archer", "warrior"],
  relics: ["phoenix", "hourglass", "crown", "banner", "runeBlade"],
  weapons: ["sword", "spear", "bow", "boomerang"],

  TIERS: ["common", "rare", "epic", "legendary"],
  // Poids de chaque rareté selon la distance au camp de base : au loin, les
  // coffres sont plus beaux.
  TIER_WEIGHTS: [
    { upTo: 2, weights: [80, 20, 0, 0] },
    { upTo: 4, weights: [50, 40, 10, 0] },
    { upTo: Infinity, weights: [30, 44, 20, 6] },
  ],
  // À l'ouverture, chance qu'un coffre monte d'une rareté : par point de
  // chance, et par palier de menace. Rester longtemps paie aussi.
  UPGRADE_PER_LUCK: 0.1,
  UPGRADE_PER_THREAT: 0.06,
};

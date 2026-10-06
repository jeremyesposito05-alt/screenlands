"use strict";

// Les caractéristiques du joueur, calculées à un seul endroit.
//
// Chaque objet décrit ses effets par `mods` (voir ITEMS) ; Stats les
// additionne et en tire des multiplicateurs que tout le jeu lit : World pour
// la vitesse, les cœurs, l'aimant et les gemmes, Weapons et Powers pour les
// dégâts, la cadence et la portée. Ajouter un bonus, c'est écrire une fiche :
// personne n'a à savoir d'où vient un +10 %.

const Stats = (() => {
  // Au-delà, la cadence ne s'améliore plus : un délai ne descend jamais sous
  // 40 % de sa valeur de départ.
  const MIN_COOLDOWN = 0.4;

  function compute(run) {
    const sum = { speed: 0, damage: 0, haste: 0, area: 0, magnet: 0, luck: 0, maxHp: 0, gemMul: 0, weaponDamage: 0, allyMax: 0, calm: 0, dodge: 0 };
    // Les achats de l'atelier comptent comme des objets portés en permanence.
    for (const [k, v] of Object.entries(Upgrades.mods())) sum[k] += v;
    for (const key of [...run.artifacts, ...run.relics]) {
      const mods = ITEMS[key].mods || {};
      for (const k in mods) sum[k] += mods[k];
    }
    return {
      speed: 1 + sum.speed,
      damage: 1 + sum.damage,
      cooldown: Math.max(MIN_COOLDOWN, 1 - sum.haste),
      area: 1 + sum.area,
      magnet: sum.magnet,
      luck: sum.luck,
      maxHp: sum.maxHp,
      gemMul: 1 + sum.gemMul,
      weaponDamage: 1 + sum.weaponDamage,
      allyMax: sum.allyMax,
      // Vitesse de montée de la menace.
      threatRate: 1 - sum.calm,
      // Chance d'éviter un coup (au plus 60 %).
      dodge: Math.min(0.6, sum.dodge),
    };
  }

  // L'arme telle que les caractéristiques la rendent : plus forte, plus
  // rapide, plus longue.
  function weapon(w, s) {
    return {
      ...w,
      damage: w.damage * s.damage * s.weaponDamage,
      cooldown: w.cooldown * s.cooldown,
      time: w.time && w.time * Math.min(1, s.cooldown + 0.2),
      reach: w.reach && w.reach * s.area,
      width: w.width && w.width * s.area,
      range: w.range && w.range * s.area,
    };
  }

  return { compute, weapon };
})();

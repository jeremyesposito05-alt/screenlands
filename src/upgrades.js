"use strict";

// L'atelier : ce qu'on achète avec la banque, pour toutes les expéditions à
// venir. C'est ce qui donne envie de relancer une partie, comme dans
// Vampire Survivors.
//
// Chaque amélioration a quelques niveaux, de plus en plus chers. Ses effets
// sont des `mods`, les mêmes que ceux des objets (voir Stats), ou un
// équipement de départ (`start`). Tout peut être remboursé, en entier, pour
// essayer autre chose.

const Upgrades = (() => {
  const LIST = {
    swift: { name: "Pas léger", hint: "vitesse +5 %", costs: [40, 120, 300], mods: { speed: 0.05 } },
    might: { name: "Force", hint: "dégâts +10 %", costs: [50, 150, 400], mods: { damage: 0.1 } },
    reflex: { name: "Réflexes", hint: "cadence +6 %", costs: [50, 150, 400], mods: { haste: 0.06 } },
    pull: { name: "Attraction", hint: "les gemmes viennent de plus loin", costs: [30, 100], mods: { magnet: 15 } },
    vigor: { name: "Vigueur", hint: "un cœur de plus", costs: [150, 500], mods: { maxHp: 1 } },
    fortune: { name: "Fortune", hint: "chance +1 : de plus beaux coffres", costs: [120, 400], mods: { luck: 1 } },
    greed: { name: "Avidité", hint: "gemmes +15 %", costs: [80, 250, 700], mods: { gemMul: 0.15 } },
    calm: { name: "Sang-froid", hint: "la menace monte 10 % moins vite", costs: [100, 300], mods: { calm: 0.1 } },
    armed: { name: "Paquetage", hint: "partir avec une épée", costs: [150], start: { weapon: "sword" } },
    escort: { name: "Escorte", hint: "partir avec un archer", costs: [300], start: { ally: "archer" } },
  };

  const level = (key) => Save.data.upgrades[key] || 0;
  const maxed = (key) => level(key) >= LIST[key].costs.length;
  // Le prix du prochain niveau, ou null s'il n'y en a plus.
  const cost = (key) => (maxed(key) ? null : LIST[key].costs[level(key)]);
  const affordable = (key) => cost(key) !== null && Save.data.bank >= cost(key);

  function buy(key) {
    if (!affordable(key)) return false;
    Save.buyUpgrade(key, cost(key));
    return true;
  }

  // Tout ce qui a été dépensé, rendu à la banque.
  function spent() {
    let total = 0;
    for (const key in LIST) total += LIST[key].costs.slice(0, level(key)).reduce((a, b) => a + b, 0);
    return total;
  }
  function refund() { Save.refundUpgrades(spent()); }

  // Les effets cumulés de tous les niveaux achetés, à ajouter à ceux des
  // objets.
  function mods() {
    const sum = {};
    for (const key in LIST) {
      const n = level(key), m = LIST[key].mods;
      if (!n || !m) continue;
      for (const k in m) sum[k] = (sum[k] || 0) + m[k] * n;
    }
    return sum;
  }

  // L'équipement de départ d'une carte neuve.
  function equip(state) {
    for (const key in LIST) {
      const s = LIST[key].start;
      if (!s || !level(key)) continue;
      if (s.weapon) state.run.weapon = s.weapon;
      if (s.ally) Allies.add(state, s.ally);
    }
  }

  return { LIST, level, maxed, cost, affordable, buy, spent, refund, mods, equip };
})();

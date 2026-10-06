"use strict";

// L'atelier : ce qu'on achète avec la banque, pour toutes les expéditions à
// venir. C'est ce qui donne envie de relancer une partie, comme dans
// Vampire Survivors.
//
// Chaque amélioration a plusieurs niveaux, de plus en plus chers : le prix
// du niveau n vaut `base` × `growth`^n, arrondi à 5. Ses effets sont des
// `mods`, les mêmes que ceux des objets (voir Stats), par niveau ; ou un
// effet propre (`start`, `keep`, `chests`) que le jeu demande par une
// fonction ci-dessous. `hard` : réservé à qui a mis assez de butin à l'abri
// en mode difficile. Tout peut être remboursé, en entier.

const Upgrades = (() => {
  const LIST = {
    swift: { name: "Pas léger", hint: "vitesse +4 %", max: 5, base: 30, growth: 1.7, mods: { speed: 0.04 } },
    might: { name: "Force", hint: "dégâts +8 %", max: 8, base: 40, growth: 1.6, mods: { damage: 0.08 } },
    reflex: { name: "Réflexes", hint: "cadence +5 %", max: 6, base: 40, growth: 1.6, mods: { haste: 0.05 } },
    pull: { name: "Attraction", hint: "les gemmes viennent de plus loin", max: 4, base: 25, growth: 1.7, mods: { magnet: 12 } },
    vigor: { name: "Vigueur", hint: "un cœur de plus", max: 3, base: 120, growth: 2.5, mods: { maxHp: 1 } },
    dodge: { name: "Esquive", hint: "6 % de chances d'éviter un coup", max: 5, base: 80, growth: 1.8, mods: { dodge: 0.06 } },
    fortune: { name: "Fortune", hint: "chance +1 : de plus beaux coffres", max: 3, base: 100, growth: 2.2, mods: { luck: 1 } },
    greed: { name: "Avidité", hint: "gemmes +10 %", max: 8, base: 60, growth: 1.6, mods: { gemMul: 0.1 } },
    calm: { name: "Sang-froid", hint: "la menace monte 6 % moins vite", max: 5, base: 70, growth: 1.7, mods: { calm: 0.06 } },
    vault: { name: "Coffre-fort", hint: "mode normal : +7 % du butin sauvé à la mort", max: 5, base: 100, growth: 1.8, keep: 0.07 },
    cartographer: { name: "Cartographe", hint: "un coffre de plus par carte", max: 3, base: 150, growth: 2.2, chests: 1 },
    armed: { name: "Paquetage", hint: "partir avec une épée", max: 1, base: 150, growth: 1, start: ["weapon", "sword"] },
    escort: { name: "Escorte", hint: "partir avec un archer, puis un guerrier", max: 2, base: 300, growth: 2, start: ["ally", "archer", "warrior"] },
    abyss: { name: "Lame des profondeurs", hint: "dégâts de l'arme +20 %", max: 3, base: 400, growth: 2, mods: { weaponDamage: 0.2 }, hard: 300 },
  };

  const level = (key) => Save.data.upgrades[key] || 0;
  const maxed = (key) => level(key) >= LIST[key].max;
  // Réservé au mode difficile et pas encore ouvert ?
  const locked = (key) => !!LIST[key].hard && Save.data.hardBanked < LIST[key].hard;
  const price = (u, n) => Math.round((u.base * u.growth ** n) / 5) * 5;
  // Le prix du prochain niveau, ou null s'il n'y en a plus.
  const cost = (key) => (maxed(key) ? null : price(LIST[key], level(key)));
  const affordable = (key) => !locked(key) && cost(key) !== null && Save.data.bank >= cost(key);

  function buy(key) {
    if (!affordable(key)) return false;
    Save.buyUpgrade(key, cost(key));
    return true;
  }

  // Tout ce qui a été dépensé, rendu à la banque.
  function spent() {
    let total = 0;
    for (const key in LIST) for (let n = 0; n < level(key); n++) total += price(LIST[key], n);
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

  // La part du butin porté sauvée à la mort, selon le mode.
  function keepOnDeath(mode) {
    const base = (Config.MODES[mode] || Config.MODES.normal).keep;
    return mode === "normal" ? Math.min(1, base + LIST.vault.keep * level("vault")) : base;
  }

  const extraChests = () => LIST.cartographer.chests * level("cartographer");

  // L'équipement de départ d'une carte neuve : chaque niveau donne l'élément
  // suivant de sa liste.
  function equip(state) {
    for (const key in LIST) {
      const s = LIST[key].start;
      if (!s) continue;
      const [kind, ...items] = s;
      for (const item of items.slice(0, level(key))) {
        if (kind === "weapon") state.run.weapon = item;
        if (kind === "ally") Allies.add(state, item);
      }
    }
  }

  // Le prix total de tout l'atelier (pour l'équilibrage).
  const total = () => Object.values(LIST).reduce((t, u) => {
    for (let n = 0; n < u.max; n++) t += price(u, n);
    return t;
  }, 0);

  return { LIST, level, maxed, locked, cost, affordable, buy, spent, refund, mods, keepOnDeath, extraChests, equip, total };
})();

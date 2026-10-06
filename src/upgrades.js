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
    swift: { name: "Pas léger", hint: "vitesse +4 %", max: 5, base: 30, growth: 1.7, mods: { speed: 0.04 }, unlock: { rank: 1 } },
    might: { name: "Force", hint: "dégâts +8 %", max: 8, base: 40, growth: 1.6, mods: { damage: 0.08 }, unlock: { rank: 1 } },
    reflex: { name: "Réflexes", hint: "cadence +5 %", max: 6, base: 40, growth: 1.6, mods: { haste: 0.05 }, unlock: { rank: 2 } },
    pull: { name: "Attraction", hint: "les gemmes viennent de plus loin", max: 4, base: 25, growth: 1.7, mods: { magnet: 12 }, unlock: { rank: 1 } },
    vigor: { name: "Vigueur", hint: "un cœur de plus", max: 3, base: 120, growth: 2.5, mods: { maxHp: 1 }, unlock: { rank: 3 } },
    dodge: { name: "Esquive", hint: "6 % de chances d'éviter un coup", max: 5, base: 80, growth: 1.8, mods: { dodge: 0.06 }, unlock: { flag: "hunter30", hint: "survis 30 secondes au Chasseur" } },
    fortune: { name: "Fortune", hint: "chance +1 : de plus beaux coffres", max: 3, base: 100, growth: 2.2, mods: { luck: 1 }, unlock: { rank: 4 } },
    greed: { name: "Avidité", hint: "gemmes +10 %", max: 8, base: 60, growth: 1.6, mods: { gemMul: 0.1 }, unlock: { rank: 2 } },
    calm: { name: "Sang-froid", hint: "la menace monte 6 % moins vite", max: 5, base: 70, growth: 1.7, mods: { calm: 0.06 }, unlock: { flag: "camps3", hint: "repose-toi à 3 camps" } },
    vault: { name: "Coffre-fort", hint: "mode normal : +7 % du butin sauvé à la mort", max: 5, base: 100, growth: 1.8, keep: 0.07, unlock: { flag: "deathRich", hint: "meurs en portant plus de 200 💎" } },
    cartographer: { name: "Cartographe", hint: "un coffre de plus par carte", max: 3, base: 150, growth: 2.2, chests: 1, unlock: { flag: "floor2", hint: "descends au 2e étage" } },
    armed: { name: "Paquetage", hint: "partir avec une épée", max: 1, base: 150, growth: 1, start: ["weapon", "sword"], unlock: { rank: 1 } },
    escort: { name: "Escorte", hint: "partir avec Sylve, puis avec Liane", max: 2, base: 300, growth: 2, start: ["ally", "sylve", "liane"], unlock: { spirits: 3, hint: "rencontre 3 esprits différents" } },
    bond: { name: "Lien spirituel", hint: "une place d'esprit de plus", max: 2, base: 200, growth: 2.2, mods: { allyMax: 1 }, unlock: { spirits: 5, hint: "rencontre 5 esprits différents" } },
    abyss: { name: "Lame des profondeurs", hint: "dégâts de l'arme +20 %", max: 3, base: 400, growth: 2, mods: { weaponDamage: 0.2 }, hard: 300, unlock: { flag: "boss", hint: "bats un Gardien" } },
  };

  // --- L'atelier qui se dévoile ---
  // Le rang monte avec tout ce qui a été mis à l'abri depuis le début (même
  // dépensé) ; il ouvre des lignes (`unlock.rank`) et des niveaux : une ligne
  // de plus de deux niveaux n'en propose que rang + 1. Les autres lignes
  // s'ouvrent par des découvertes en jeu (`unlock.flag`, voir le carnet de
  // Save) ou en rencontrant assez d'esprits (`unlock.spirits`).
  const RANKS = [0, 150, 400, 800, 1400, 2200, 3200, 4500, 6000, 8000];
  const total = () => Save.data.totalBanked || 0;
  const rank = () => RANKS.filter((t) => total() >= t).length;
  const nextRank = () => RANKS[rank()] ?? null;

  const level = (key) => Save.data.upgrades[key] || 0;
  function unlocked(key) {
    const u = LIST[key].unlock || {};
    if (level(key) > 0) return true;
    if (u.rank && rank() < u.rank) return false;
    if (u.flag && !Save.data.found.flags[u.flag]) return false;
    if (u.spirits && Save.data.found.spirits.length < u.spirits) return false;
    return true;
  }
  // Ce qui manque pour l'ouvrir, en clair.
  function unlockHint(key) {
    const u = LIST[key].unlock || {};
    return u.hint || (u.rank ? `atteins le rang ${u.rank}` : "");
  }
  const levelCap = (key) => (LIST[key].max <= 2 ? LIST[key].max : Math.min(LIST[key].max, rank() + 1));
  const maxed = (key) => level(key) >= LIST[key].max;
  // Le prochain niveau attend-il un rang de plus ?
  const capped = (key) => !maxed(key) && level(key) >= levelCap(key);
  // Réservé au mode difficile et pas encore ouvert ?
  const locked = (key) => !!LIST[key].hard && Save.data.hardBanked < LIST[key].hard;
  // Les lignes ouvertes qu'on n'a pas encore annoncées.
  const newUnlocks = () => Object.keys(LIST).filter((k) => unlocked(k) && !(Save.data.seenUnlocks || []).includes(k));
  const price = (u, n) => Math.round((u.base * u.growth ** n) / 5) * 5;
  // Le prix du prochain niveau, ou null s'il n'y en a plus.
  const cost = (key) => (maxed(key) ? null : price(LIST[key], level(key)));
  const affordable = (key) => unlocked(key) && !locked(key) && !capped(key) && cost(key) !== null && Save.data.bank >= cost(key);

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
  const shopTotal = () => Object.values(LIST).reduce((t, u) => {
    for (let n = 0; n < u.max; n++) t += price(u, n);
    return t;
  }, 0);

  // Première ouverture avec le carnet (voir Save.initProgress).
  Save.initProgress(Save.data.bank + spent(), Object.keys(LIST).filter((k) => level(k) > 0 || unlocked(k)));

  return { LIST, RANKS, rank, nextRank, totalBanked: total, level, maxed, capped, levelCap, unlocked, unlockHint, newUnlocks,
           locked, cost, affordable, buy, spent, refund, mods, keepOnDeath, extraChests, equip, shopTotal };
})();

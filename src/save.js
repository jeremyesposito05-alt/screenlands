"use strict";

// La progression permanente : ce qui survit à la mort et à la fermeture du
// jeu.
//
// Elle est volontairement séparée de l'expédition en cours, qui vit dans
// World et meurt avec le joueur. Pour l'instant elle ne contient que la
// banque (le butin mis à l'abri), le record du plus gros butin sécurisé
// d'un coup, le mode de commande choisi et les achats de l'atelier.
//
// Stockée dans le navigateur. Le stockage peut être indisponible (navigation
// privée, données effacées) : le jeu marche alors quand même, il oublie
// simplement la banque en fermant.

const Save = (() => {
  const KEY = "screenlands.save.v1";
  // `controls` : "swipe" (glisser) ou "stick" (joystick), voir Input.
  // `upgrades` : le niveau acheté de chaque amélioration de l'atelier.
  // `sound`, `music` : bruitages et musique, réglables dans les menus.
  // `mode` : la difficulté choisie (voir Config.MODES) ; `hardBanked` : tout ce
  // qui a été mis à l'abri en mode difficile, qui ouvre des achats réservés.
  const data = { bank: 0, best: 0, controls: "swipe", upgrades: {}, sound: true, music: true,
                 mode: "normal", hardBanked: 0, shopVersion: 2, refundNotice: 0,
                 // `heroStyle` : la chevalière en pixel art ("pixel") ou en 3D ("3d").
                 heroStyle: "pixel",
                 // Le carnet de découvertes : esprits rencontrés, exploits (`flags`) et
                 // compteurs ; `totalBanked` : tout ce qui a été mis à l'abri depuis le
                 // début, même dépensé, qui fait le rang ; `seenUnlocks` : les lignes de
                 // l'atelier déjà annoncées.
                 found: { spirits: [], flags: {}, counts: {} }, totalBanked: null, seenUnlocks: null };

  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(KEY));
    Object.assign(data, saved || {});
  } catch (e) { /* stockage indisponible : on part de zéro */ }

  // L'atelier a changé de prix et de niveaux le 6 octobre 2026 : les achats
  // de l'ancienne version sont remboursés à leur prix d'alors, une fois, et
  // le menu le signale.
  const OLD_PRICES = {
    swift: [40, 120, 300], might: [50, 150, 400], reflex: [50, 150, 400], pull: [30, 100],
    vigor: [150, 500], fortune: [120, 400], greed: [80, 250, 700], calm: [100, 300],
    armed: [150], escort: [300],
  };
  if (saved && !saved.shopVersion) {
    let refund = 0;
    for (const [key, n] of Object.entries(data.upgrades || {})) {
      refund += (OLD_PRICES[key] || []).slice(0, n).reduce((a, b) => a + b, 0);
    }
    data.bank += refund;
    data.upgrades = {};
    data.shopVersion = 2;
    data.refundNotice = refund;
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* idem */ }
  }

  function write() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) { /* idem */ }
  }

  return {
    data,
    deposit(amount, mode) {
      data.bank += amount;
      data.best = Math.max(data.best, amount);
      if (mode === "hard") data.hardBanked += amount;
      data.totalBanked = (data.totalBanked || 0) + amount;
      write();
    },
    clearNotice() {
      data.refundNotice = 0;
      write();
    },
    setHeroStyle(style) {
      data.heroStyle = style;
      write();
    },
    // --- Le carnet de découvertes ---
    discover(flag) {
      if (data.found.flags[flag]) return false;
      data.found.flags[flag] = true;
      write();
      return true;
    },
    count(name, n = 1) {
      data.found.counts[name] = (data.found.counts[name] || 0) + n;
      write();
      return data.found.counts[name];
    },
    meetSpirit(type) {
      if (data.found.spirits.includes(type)) return false;
      data.found.spirits.push(type);
      write();
      return true;
    },
    markSeen(keys) {
      data.seenUnlocks = [...new Set([...(data.seenUnlocks || []), ...keys])];
      write();
    },
    // Première ouverture avec le carnet : le total mis à l'abri est estimé
    // (banque + achats), et ce qui est déjà ouvert ne sera pas annoncé.
    initProgress(total, unlocked) {
      if (data.totalBanked === null) data.totalBanked = total;
      if (data.seenUnlocks === null) data.seenUnlocks = unlocked;
      write();
    },
    setMode(mode) {
      data.mode = mode;
      write();
    },
    setControls(mode) {
      data.controls = mode;
      write();
    },
    toggle(key) {
      data[key] = !data[key];
      write();
    },
    buyUpgrade(key, cost) {
      data.bank -= cost;
      data.upgrades[key] = (data.upgrades[key] || 0) + 1;
      write();
    },
    refundUpgrades(amount) {
      data.bank += amount;
      data.upgrades = {};
      write();
    },
  };
})();

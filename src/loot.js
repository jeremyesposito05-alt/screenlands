"use strict";

// Le butin des coffres : leur rareté, et ce qu'ils contiennent.
//
// La rareté d'un coffre est tirée à la génération de la carte, selon sa
// distance au camp de base, et se voit de loin à sa couleur : c'est au joueur
// de juger si le détour en vaut la peine. Son contenu, lui, est tiré à
// l'ouverture, pour tenir compte de ce que le joueur a déjà ; et à ce moment
// la chance et la menace peuvent le faire monter d'une rareté.
//
// - commun : un bonus ;
// - rare : un pouvoir nouveau ou son niveau suivant, un artefact, ou une
//   arme qu'on n'a pas en main ;
// - épique : un pouvoir monté de deux niveaux, et un bonus en prime ;
// - légendaire : une relique qu'on n'a pas.
// Quand une rareté n'a plus rien à offrir, on descend d'un cran.

const Loot = (() => {
  // La rareté d'un coffre caché à cette distance.
  function tierFor(distance, rng) {
    const row = LOOT.TIER_WEIGHTS.find((r) => distance <= r.upTo);
    const total = row.weights.reduce((a, b) => a + b, 0);
    let roll = rng.next() * total;
    for (let i = 0; i < row.weights.length; i++) {
      roll -= row.weights[i];
      if (roll < 0) return LOOT.TIERS[i];
    }
    return LOOT.TIERS[0];
  }

  // La rareté réelle à l'ouverture : une chance de monter d'un cran.
  function upgrade(tier, luck, threatLevel, random = Math.random) {
    const i = LOOT.TIERS.indexOf(tier);
    const chance = LOOT.UPGRADE_PER_LUCK * luck + LOOT.UPGRADE_PER_THREAT * threatLevel;
    if (i < LOOT.TIERS.length - 1 && random() < chance) return LOOT.TIERS[i + 1];
    return tier;
  }

  // Le contenu d'un coffre de cette rareté, en clés de ITEMS, pour un joueur
  // qui possède déjà `run` (weapon, artifacts, powers, relics). Un pouvoir
  // présent deux fois dans la liste monte de deux niveaux.
  function open(tier, run, random = Math.random) {
    const pick = (list) => list[Math.floor(random() * list.length)];
    const powerLevel = (k) => run.powers[k] || 0;
    const openPowers = LOOT.powers.filter((k) => powerLevel(k) < Powers.MAX_LEVEL);
    const artifacts = LOOT.rareArtifacts.filter((k) => !(ITEMS[k].unique && run.artifacts.includes(k)));
    const weapons = LOOT.weapons.filter((k) => k !== run.weapon);
    const relics = LOOT.relics.filter((k) => !run.relics.includes(k));
    const common = () => pick(LOOT.commons);

    switch (tier) {
      case "legendary":
        if (relics.length) return [pick(relics)];
        return open("epic", run, random);
      case "epic": {
        if (!openPowers.length) return [pick(artifacts.length ? artifacts : LOOT.commons), common()];
        // De préférence un pouvoir qu'on a déjà : c'est là qu'un coffre épique
        // se sent.
        const owned = openPowers.filter((k) => powerLevel(k) > 0);
        const p = pick(owned.length ? owned : openPowers);
        const twice = powerLevel(p) + 2 <= Powers.MAX_LEVEL ? [p, p] : [p];
        return [...twice, common()];
      }
      case "rare": {
        const roll = random();
        if (roll < 0.6 && openPowers.length) return [pick(openPowers)];
        if (roll < 0.85 && artifacts.length) return [pick(artifacts)];
        if (weapons.length) return [pick(weapons)];
        return [common()];
      }
      default:
        return [common()];
    }
  }

  return { tierFor, upgrade, open };
})();

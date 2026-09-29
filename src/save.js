"use strict";

// La progression permanente : ce qui survit à la mort et à la fermeture du
// jeu.
//
// Elle est volontairement séparée de l'expédition en cours, qui vit dans
// World et meurt avec le joueur. Pour l'instant elle ne contient que la
// banque (le butin mis à l'abri), le record du plus gros butin sécurisé
// d'un coup et le mode de commande choisi ; les déblocages viendront ici.
//
// Stockée dans le navigateur. Le stockage peut être indisponible (navigation
// privée, données effacées) : le jeu marche alors quand même, il oublie
// simplement la banque en fermant.

const Save = (() => {
  const KEY = "screenlands.save.v1";
  // `controls` : "swipe" (glisser) ou "stick" (joystick), voir Input.
  const data = { bank: 0, best: 0, controls: "swipe" };

  try {
    Object.assign(data, JSON.parse(localStorage.getItem(KEY)) || {});
  } catch (e) { /* stockage indisponible : on part de zéro */ }

  function write() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) { /* idem */ }
  }

  return {
    data,
    deposit(amount) {
      data.bank += amount;
      data.best = Math.max(data.best, amount);
      write();
    },
    setControls(mode) {
      data.controls = mode;
      write();
    },
  };
})();

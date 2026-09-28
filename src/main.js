"use strict";

// Le point d'entrée : branche l'entrée, le monde et le rendu, et fait tourner
// la boucle.
//
// La physique avance à pas fixe (Config.STEP) quel que soit le rythme de
// l'écran, pour que le jeu se comporte pareil sur un PC à 60 Hz et sur un
// iPhone à 120 Hz. Le rendu, lui, suit l'écran.

(() => {
  const canvas = document.getElementById("game");
  const attackButton = document.getElementById("attack");
  Input.init(document.getElementById("joystick"), attackButton);
  Render.init(canvas);
  World.newExpedition();

  // Le bouton d'attaque n'apparaît qu'avec une arme en main, et porte son
  // icône. On ne le retouche que quand l'arme change.
  const buttonIcon = document.createElement("canvas");
  buttonIcon.width = buttonIcon.height = 96;
  buttonIcon.style.cssText = "display:block;width:100%;height:100%";
  attackButton.appendChild(buttonIcon);
  let shownWeapon;
  function syncAttackButton() {
    const weapon = World.state.run.weapon;
    if (weapon === shownWeapon) return;
    shownWeapon = weapon;
    attackButton.hidden = !weapon;
    attackButton.setAttribute("aria-label", weapon ? ITEMS[weapon].name : "Attaquer");
    Render.iconInto(buttonIcon, weapon);
  }

  // Au-delà, on considère que le jeu était en pause (onglet caché,
  // téléphone verrouillé) et on ne rattrape pas le temps perdu.
  const MAX_FRAME = 0.25;
  let last = performance.now();
  let acc = 0;

  function frame(now) {
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    acc += dt;
    while (acc >= Config.STEP) {
      World.step(Config.STEP, Input.direction(), Input.takeAttack());
      acc -= Config.STEP;
    }
    Render.draw(World.state, dt);
    syncAttackButton();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // La zone garde le ratio 9:19.5 et remplit l'écran au mieux, sans jamais
  // passer sous l'encoche ni la barre d'accueil de l'iPhone.
  function fit() {
    const box = document.getElementById("stage").getBoundingClientRect();
    const scale = Math.min(box.width / Config.ZONE_W, box.height / Config.ZONE_H);
    canvas.style.width = `${Math.floor(Config.ZONE_W * scale)}px`;
    canvas.style.height = `${Math.floor(Config.ZONE_H * scale)}px`;
  }
  addEventListener("resize", fit);
  fit();

  syncAttackButton();

  // Accès pour les tests et le débogage depuis la console.
  window.Screenlands = { World, Input, Render, Config, Save, ZoneRegistry, Generator, Enemies, Weapons, syncAttackButton };
})();

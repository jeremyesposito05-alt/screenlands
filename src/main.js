"use strict";

// Le point d'entrée : branche l'entrée, le monde, le rendu et les menus, et
// fait tourner la boucle.
//
// La physique avance à pas fixe (Config.STEP) quel que soit le rythme de
// l'écran, pour que le jeu se comporte pareil sur un PC à 60 Hz et sur un
// iPhone à 120 Hz. Le rendu, lui, suit l'écran. Tant qu'un menu est ouvert,
// le jeu ne bouge plus mais reste dessiné derrière.

(() => {
  const canvas = document.getElementById("game");
  const attackButton = document.getElementById("attack");
  Input.init(document.getElementById("joystick"), attackButton,
             [document.getElementById("overlay"), document.getElementById("pause")]);
  Sprites.load();
  Render.init(canvas);
  World.newExpedition();
  Menu.init();

  // --- Bouton d'attaque ---
  // En mode joystick seulement (en mode glisser, on frappe en touchant
  // l'écran), et seulement avec une arme en main, dont il porte l'icône.
  const buttonIcon = document.createElement("canvas");
  buttonIcon.width = buttonIcon.height = 96;
  buttonIcon.style.cssText = "display:block;width:100%;height:100%";
  attackButton.appendChild(buttonIcon);
  let shownWeapon;
  function syncButtons() {
    const weapon = Input.mode === "stick" && !Menu.isOpen() ? World.state.run.weapon : null;
    if (weapon === shownWeapon) return;
    shownWeapon = weapon;
    attackButton.hidden = !weapon;
    attackButton.setAttribute("aria-label", weapon ? ITEMS[weapon].name : "Attaquer");
    Render.iconInto(buttonIcon, weapon);
  }

  // --- Boucle ---
  // Au-delà, on considère que le jeu était en pause (onglet caché,
  // téléphone verrouillé) et on ne rattrape pas le temps perdu.
  const MAX_FRAME = 0.25;
  let last = performance.now();
  let acc = 0;
  let phase = World.state.phase;

  function frame(now) {
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (Menu.isOpen()) {
      acc = 0;
    } else {
      acc += dt;
      while (acc >= Config.STEP) {
        const intent = Input.intent();
        World.step(Config.STEP, intent, Input.takeAttack());
        if (intent.accepted) Input.acceptTurn();
        acc -= Config.STEP;
      }
    }
    // À la mort, la course s'arrête : on ne repart pas tout seul du camp.
    if (World.state.phase !== phase) {
      phase = World.state.phase;
      if (phase === "dead") Input.stop();
    }
    Render.draw(World.state, Menu.isOpen() ? 0 : dt);
    syncButtons();
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
  syncButtons();

  // Accès pour les tests et le débogage depuis la console.
  window.Screenlands = { World, Input, Render, Config, Save, ZoneRegistry, Generator, Enemies, Weapons, Menu, syncButtons };
})();

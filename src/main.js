"use strict";

// Le point d'entrée : branche l'entrée, le monde et le rendu, fait tourner
// la boucle, et tient à jour les deux boutons posés par-dessus le jeu.
//
// La physique avance à pas fixe (Config.STEP) quel que soit le rythme de
// l'écran, pour que le jeu se comporte pareil sur un PC à 60 Hz et sur un
// iPhone à 120 Hz. Le rendu, lui, suit l'écran.

(() => {
  const canvas = document.getElementById("game");
  const attackButton = document.getElementById("attack");
  const controlsButton = document.getElementById("controls");
  Input.init(document.getElementById("joystick"), attackButton, [controlsButton]);
  Render.init(canvas);
  World.newExpedition();

  // --- Mode de commande ---
  const MODES = {
    swipe: {
      label: "Commandes : glisser",
      help: ["Glisse pour courir", "touche : frapper · maintiens : stop"],
    },
    stick: {
      label: "Commandes : joystick",
      help: ["Joystick sous le pouce", "bouton à droite pour frapper"],
    },
  };
  function applyMode(mode, explain) {
    Input.setMode(mode);
    Save.setControls(mode);
    controlsButton.textContent = MODES[mode].label;
    shownWeapon = undefined;
    if (explain) World.say(...MODES[mode].help, 4);
  }
  controlsButton.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    applyMode(Input.mode === "swipe" ? "stick" : "swipe", true);
  });

  // --- Bouton d'attaque ---
  // En mode joystick seulement (en mode glisser, on frappe en touchant
  // l'écran), et seulement avec une arme en main, dont il porte l'icône.
  const buttonIcon = document.createElement("canvas");
  buttonIcon.width = buttonIcon.height = 96;
  buttonIcon.style.cssText = "display:block;width:100%;height:100%";
  attackButton.appendChild(buttonIcon);
  let shownWeapon;
  function syncButtons() {
    controlsButton.hidden = !World.state.zone.safe || World.state.phase === "dead";
    const weapon = Input.mode === "stick" ? World.state.run.weapon : null;
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
    acc += dt;
    while (acc >= Config.STEP) {
      const intent = Input.intent();
      World.step(Config.STEP, intent, Input.takeAttack());
      if (intent.accepted) Input.acceptTurn();
      acc -= Config.STEP;
    }
    // À la mort, la course s'arrête : on ne repart pas tout seul du camp.
    if (World.state.phase !== phase) {
      phase = World.state.phase;
      if (phase === "dead") Input.stop();
    }
    Render.draw(World.state, dt);
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

  applyMode(Save.data.controls in MODES ? Save.data.controls : "swipe", true);
  syncButtons();

  // Accès pour les tests et le débogage depuis la console.
  window.Screenlands = { World, Input, Render, Config, Save, ZoneRegistry, Generator, Enemies, Weapons, syncButtons, applyMode };
})();

"use strict";

// Le point d'entrée : branche l'entrée, le monde et le rendu, et fait tourner
// la boucle.
//
// La physique avance à pas fixe (Config.STEP) quel que soit le rythme de
// l'écran, pour que le jeu se comporte pareil sur un PC à 60 Hz et sur un
// iPhone à 120 Hz. Le rendu, lui, suit l'écran.

(() => {
  const canvas = document.getElementById("game");
  Input.init(document.getElementById("joystick"));
  Render.init(canvas);
  World.reset();

  // Au-delà, on considère que le jeu était en pause (onglet caché,
  // téléphone verrouillé) et on ne rattrape pas le temps perdu.
  const MAX_FRAME = 0.25;
  let last = performance.now();
  let acc = 0;

  function frame(now) {
    acc += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    while (acc >= Config.STEP) {
      World.step(Config.STEP, Input.direction());
      acc -= Config.STEP;
    }
    Render.draw(World.state);
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

  // Accès pour les tests et le débogage depuis la console.
  window.Screenlands = { World, Input, Config };
})();

"use strict";

// L'entrée : clavier, joystick tactile et bouton d'attaque.
//
// Le reste du jeu ne lit jamais une touche ni un doigt. Il demande
// Input.direction(), qui renvoie {x, y} avec au plus un des deux non nul, et
// Input.takeAttack(), qui dit si une attaque a été demandée depuis la
// dernière fois. Le déplacement est strictement cardinal, à la manière des
// premiers Zelda : l'axe le plus poussé gagne, donc un joystick en diagonale
// donne la cardinale la plus proche.

const Input = (() => {
  // Clavier : lu par position physique (event.code), donc ZQSD sur un
  // clavier français et WASD sur un clavier anglais tombent sur les mêmes
  // touches.
  const KEYS = {
    ArrowLeft: "left", KeyA: "left",
    ArrowRight: "right", KeyD: "right",
    ArrowUp: "up", KeyW: "up",
    ArrowDown: "down", KeyS: "down",
  };
  const ATTACK_KEYS = new Set(["Space", "KeyJ", "KeyK", "Enter"]);
  const held = new Set();

  // Une attaque demandée et pas encore prise en compte par le jeu. Un
  // drapeau plutôt qu'un état « enfoncé » : un appui très bref, entre deux
  // pas de physique, compte quand même.
  let attackQueued = false;

  // Joystick flottant : il apparaît là où le doigt se pose, et la direction
  // est l'écart entre ce point et la position courante du doigt.
  const DEADZONE = 10; // px d'écran avant qu'un mouvement compte
  const RADIUS = 48; // px d'écran : course maximale du bouton
  let touchId = null;
  let origin = null;
  let stick = { x: 0, y: 0 };
  let base, knob, attackButton;

  function init(joystickEl, attackEl) {
    base = joystickEl;
    knob = joystickEl.querySelector(".knob");
    attackButton = attackEl;

    addEventListener("keydown", (e) => {
      if (ATTACK_KEYS.has(e.code)) {
        if (!e.repeat) attackQueued = true;
        e.preventDefault();
        return;
      }
      const dir = KEYS[e.code];
      if (!dir) return;
      held.add(dir);
      e.preventDefault();
    });
    addEventListener("keyup", (e) => held.delete(KEYS[e.code]));
    // Une touche relâchée pendant que la fenêtre n'a pas le focus ne
    // déclenche jamais keyup : on oublie tout en perdant le focus.
    addEventListener("blur", () => held.clear());

    // Le bouton répond au doigt comme à la souris.
    attackButton.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      attackQueued = true;
      attackButton.classList.add("pressed");
    });
    const release = () => attackButton.classList.remove("pressed");
    attackButton.addEventListener("pointerup", release);
    attackButton.addEventListener("pointercancel", release);
    attackButton.addEventListener("pointerleave", release);

    const opts = { passive: false };
    addEventListener("touchstart", onTouchStart, opts);
    addEventListener("touchmove", onTouchMove, opts);
    addEventListener("touchend", onTouchEnd, opts);
    addEventListener("touchcancel", onTouchEnd, opts);
  }

  function onTouchStart(e) {
    e.preventDefault();
    // Plusieurs doigts peuvent se poser à la fois : un pouce sur le joystick,
    // l'autre sur le bouton d'attaque, que ce dernier gère lui-même.
    for (const t of e.changedTouches) {
      if (touchId !== null) return;
      if (attackButton.contains(t.target)) continue;
      touchId = t.identifier;
      origin = { x: t.clientX, y: t.clientY };
      stick = { x: 0, y: 0 };
      base.style.left = `${origin.x}px`;
      base.style.top = `${origin.y}px`;
      knob.style.transform = "translate(-50%, -50%)";
      base.hidden = false;
    }
  }

  function onTouchMove(e) {
    e.preventDefault();
    const t = findTouch(e.changedTouches);
    if (!t) return;
    let dx = t.clientX - origin.x;
    let dy = t.clientY - origin.y;
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) {
      dx *= RADIUS / len;
      dy *= RADIUS / len;
    }
    stick = len < DEADZONE ? { x: 0, y: 0 } : { x: dx, y: dy };
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  function onTouchEnd(e) {
    if (!findTouch(e.changedTouches)) return;
    touchId = null;
    stick = { x: 0, y: 0 };
    base.hidden = true;
  }

  function findTouch(list) {
    for (const t of list) if (t.identifier === touchId) return t;
    return null;
  }

  function direction() {
    let x = (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0);
    let y = (held.has("down") ? 1 : 0) - (held.has("up") ? 1 : 0);
    if (x === 0 && y === 0) {
      x = stick.x;
      y = stick.y;
    }
    if (x === 0 && y === 0) return { x: 0, y: 0 };
    if (Math.abs(x) >= Math.abs(y)) return { x: Math.sign(x), y: 0 };
    return { x: 0, y: Math.sign(y) };
  }

  // Vrai une seule fois par appui.
  function takeAttack() {
    const queued = attackQueued;
    attackQueued = false;
    return queued;
  }

  return { init, direction, takeAttack };
})();

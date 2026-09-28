"use strict";

// L'entrée : clavier et joystick tactile, réduits à une seule direction
// cardinale.
//
// Le reste du jeu ne lit jamais une touche ni un doigt : il demande
// Input.direction() et reçoit {x, y} avec au plus un des deux non nul. Le
// déplacement est strictement cardinal, à la manière des premiers Zelda :
// l'axe le plus poussé gagne, donc un joystick en diagonale donne la
// cardinale la plus proche.

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
  const held = new Set();

  // Joystick flottant : il apparaît là où le doigt se pose, et la direction
  // est l'écart entre ce point et la position courante du doigt.
  const DEADZONE = 10; // px d'écran avant qu'un mouvement compte
  const RADIUS = 48; // px d'écran : course maximale du bouton
  let touchId = null;
  let origin = null;
  let stick = { x: 0, y: 0 };
  let base, knob;

  function init(joystickEl) {
    base = joystickEl;
    knob = joystickEl.querySelector(".knob");

    addEventListener("keydown", (e) => {
      const dir = KEYS[e.code];
      if (!dir) return;
      held.add(dir);
      e.preventDefault();
    });
    addEventListener("keyup", (e) => held.delete(KEYS[e.code]));
    // Une touche relâchée pendant que la fenêtre n'a pas le focus ne
    // déclenche jamais keyup : on oublie tout en perdant le focus.
    addEventListener("blur", () => held.clear());

    const opts = { passive: false };
    addEventListener("touchstart", onTouchStart, opts);
    addEventListener("touchmove", onTouchMove, opts);
    addEventListener("touchend", onTouchEnd, opts);
    addEventListener("touchcancel", onTouchEnd, opts);
  }

  function onTouchStart(e) {
    e.preventDefault();
    if (touchId !== null) return;
    const t = e.changedTouches[0];
    touchId = t.identifier;
    origin = { x: t.clientX, y: t.clientY };
    stick = { x: 0, y: 0 };
    base.style.left = `${origin.x}px`;
    base.style.top = `${origin.y}px`;
    knob.style.transform = "translate(-50%, -50%)";
    base.hidden = false;
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

  return { init, direction };
})();

"use strict";

// L'entrée : clavier et écran tactile, en deux modes au choix.
//
// - "swipe" (glisser) : le personnage court tout seul dans la dernière
//   direction donnée, et s'arrête contre un mur. On glisse le doigt pour
//   changer de direction, on touche sans glisser pour frapper, on maintient
//   le doigt immobile pour s'arrêter. Un pouce suffit, rien ne cache l'écran.
// - "stick" (joystick) : un joystick flottant apparaît sous le doigt, et un
//   bouton d'attaque sous l'autre pouce.
//
// Le reste du jeu ne lit jamais une touche ni un doigt. Il demande
// Input.intent(), qui renvoie la direction courante et, en mode glisser, le
// virage demandé mais pas encore possible ; et Input.takeAttack(), qui dit si
// une attaque a été demandée depuis la dernière fois. Le déplacement est
// strictement cardinal, à la manière des premiers Zelda.

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
  const DIRS = {
    left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
    up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
  };
  const ATTACK_KEYS = new Set(["Space", "KeyJ", "KeyK", "Enter"]);
  const NONE = { x: 0, y: 0 };

  // --- Mode glisser ---
  // Un glissement compte au-delà de SWIPE_MIN pixels d'écran. Un doigt qui
  // continue de glisser peut enchaîner les virages : chaque virage reprend
  // la mesure depuis là où il a eu lieu.
  const SWIPE_MIN = 18;
  // Un toucher est une frappe s'il bouge de moins de TAP_MOVE pixels et se
  // relâche en moins de TAP_TIME ; immobile plus de HOLD_TIME, il arrête le
  // personnage.
  const TAP_MOVE = 10;
  const TAP_TIME = 250;
  const HOLD_TIME = 220;
  // Un virage demandé contre un mur attend qu'un passage s'ouvre, à la
  // manière de Pac-Man, pendant TURN_BUFFER millisecondes au plus.
  const TURN_BUFFER = 800;

  // --- Mode joystick ---
  const DEADZONE = 8; // px d'écran avant qu'un mouvement compte
  const RADIUS = 44; // px d'écran : course maximale du bouton
  // Pour quitter l'axe en cours, l'autre axe doit être poussé HYSTERESIS fois
  // plus fort : près de la diagonale, la direction ne papillote plus.
  const HYSTERESIS = 1.3;

  let mode = "swipe";
  const held = new Set();
  let attackQueued = false;

  // Mode glisser : direction de course, et virage en attente {dir, until}.
  let heading = NONE;
  let pending = null;
  // Doigts posés, par identifiant : {x, y, t, moved, used}.
  const touches = new Map();

  // Mode joystick.
  let stickId = null;
  let origin = null;
  let stick = { x: 0, y: 0 };
  let stickAxis = null;
  let base, knob, attackButton, ignored;

  function init(joystickEl, attackEl, ignoredEls = []) {
    base = joystickEl;
    knob = joystickEl.querySelector(".knob");
    attackButton = attackEl;
    ignored = [attackEl, ...ignoredEls];

    addEventListener("keydown", (e) => {
      if (ATTACK_KEYS.has(e.code)) {
        if (!e.repeat) attackQueued = true;
        e.preventDefault();
        return;
      }
      const dir = KEYS[e.code];
      if (!dir) return;
      e.preventDefault();
      held.add(dir);
      if (mode === "swipe" && !e.repeat) turn(DIRS[dir]);
    });
    addEventListener("keyup", (e) => held.delete(KEYS[e.code]));
    // Une touche relâchée pendant que la fenêtre n'a pas le focus ne
    // déclenche jamais keyup : on oublie tout en perdant le focus.
    addEventListener("blur", () => held.clear());

    // Le bouton d'attaque répond au doigt comme à la souris.
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

  function setMode(m) {
    mode = m;
    stop();
    stickId = null;
    stick = { x: 0, y: 0 };
    base.hidden = true;
    touches.clear();
  }

  // Plus de course ni de virage en attente : à la mort, au changement de mode.
  function stop() {
    heading = NONE;
    pending = null;
  }

  // Mode glisser : demi-tour et virage possible tout de suite s'appliquent
  // directement ; les autres attendent (voir intent / acceptTurn).
  function turn(dir) {
    if (heading.x === -dir.x && heading.y === -dir.y && (dir.x || dir.y)) {
      heading = dir;
      pending = null;
      return;
    }
    pending = { dir, until: performance.now() + TURN_BUFFER };
  }

  const isIgnored = (target) => ignored.some((el) => el && el.contains(target));

  function onTouchStart(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (isIgnored(t.target)) continue;
      if (mode === "swipe") {
        touches.set(t.identifier, { x: t.clientX, y: t.clientY, t: performance.now(), moved: 0, used: false });
      } else if (stickId === null) {
        stickId = t.identifier;
        origin = { x: t.clientX, y: t.clientY };
        stick = { x: 0, y: 0 };
        stickAxis = null;
        placeBase();
        knob.style.transform = "translate(-50%, -50%)";
        base.hidden = false;
      }
    }
  }

  function onTouchMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (mode === "swipe") swipeMove(t);
      else if (t.identifier === stickId) stickMove(t);
    }
  }

  function onTouchEnd(e) {
    for (const t of e.changedTouches) {
      if (mode === "swipe") {
        const s = touches.get(t.identifier);
        touches.delete(t.identifier);
        if (s && !s.used && s.moved < TAP_MOVE && performance.now() - s.t < TAP_TIME) {
          attackQueued = true;
        }
      } else if (t.identifier === stickId) {
        stickId = null;
        stick = { x: 0, y: 0 };
        base.hidden = true;
      }
    }
  }

  function swipeMove(t) {
    const s = touches.get(t.identifier);
    if (!s) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    s.moved = Math.max(s.moved, Math.hypot(dx, dy));
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
    turn(Math.abs(dx) >= Math.abs(dy)
      ? { x: Math.sign(dx), y: 0 }
      : { x: 0, y: Math.sign(dy) });
    s.used = true;
    s.x = t.clientX;
    s.y = t.clientY;
    s.t = performance.now();
  }

  // Un doigt resté immobile assez longtemps arrête la course.
  function checkHolds() {
    const now = performance.now();
    for (const s of touches.values()) {
      if (!s.used && s.moved < TAP_MOVE && now - s.t > HOLD_TIME) {
        s.used = true;
        stop();
      }
    }
  }

  function stickMove(t) {
    let dx = t.clientX - origin.x;
    let dy = t.clientY - origin.y;
    const len = Math.hypot(dx, dy);
    // Tiré au-delà de sa course, le joystick suit le doigt : on n'a jamais à
    // revenir en arrière pour changer de direction.
    if (len > RADIUS) {
      origin.x += (dx / len) * (len - RADIUS);
      origin.y += (dy / len) * (len - RADIUS);
      dx = t.clientX - origin.x;
      dy = t.clientY - origin.y;
      placeBase();
    }
    stick = Math.hypot(dx, dy) < DEADZONE ? { x: 0, y: 0 } : { x: dx, y: dy };
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  function placeBase() {
    base.style.left = `${origin.x}px`;
    base.style.top = `${origin.y}px`;
  }

  // Du joystick à une direction cardinale, avec hystérésis.
  function stickDirection() {
    const ax = Math.abs(stick.x), ay = Math.abs(stick.y);
    if (!ax && !ay) {
      stickAxis = null;
      return NONE;
    }
    if (stickAxis === "x") stickAxis = ay > ax * HYSTERESIS ? "y" : "x";
    else if (stickAxis === "y") stickAxis = ax > ay * HYSTERESIS ? "x" : "y";
    else stickAxis = ax >= ay ? "x" : "y";
    return stickAxis === "x" ? { x: Math.sign(stick.x), y: 0 } : { x: 0, y: Math.sign(stick.y) };
  }

  function keyboardDirection() {
    const x = (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0);
    const y = (held.has("down") ? 1 : 0) - (held.has("up") ? 1 : 0);
    if (x) return { x, y: 0 };
    if (y) return { x: 0, y };
    return NONE;
  }

  // Ce que veut le joueur : `dir`, la direction courante, et `next`, un virage
  // demandé que World prendra dès que le passage le permet (il appelle alors
  // acceptTurn). En mode joystick, il n'y a jamais de virage en attente.
  function intent() {
    if (mode === "stick") {
      const k = keyboardDirection();
      const dir = k.x || k.y ? k : stickDirection();
      markStick(dir);
      return { dir, next: null };
    }
    checkHolds();
    if (pending && performance.now() > pending.until) pending = null;
    return { dir: heading, next: pending ? pending.dir : null };
  }

  function acceptTurn() {
    if (!pending) return;
    heading = pending.dir;
    pending = null;
  }

  // Allume sur la base du joystick la direction retenue : on voit à quelle
  // cardinale le pouce correspond.
  let lit = null;
  function markStick(dir) {
    const name = dir.x > 0 ? "right" : dir.x < 0 ? "left" : dir.y > 0 ? "down" : dir.y < 0 ? "up" : null;
    if (name === lit) return;
    if (lit) base.querySelector(`.arrow.${lit}`).classList.remove("on");
    if (name) base.querySelector(`.arrow.${name}`).classList.add("on");
    lit = name;
  }

  // Vrai une seule fois par appui.
  function takeAttack() {
    const queued = attackQueued;
    attackQueued = false;
    return queued;
  }

  return {
    init, setMode, stop, intent, acceptTurn, takeAttack,
    get mode() { return mode; },
  };
})();

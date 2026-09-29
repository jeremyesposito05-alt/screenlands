"use strict";

// Les menus, posés par-dessus le jeu : menu principal, pause, et panneau du
// bac à sable. Tant qu'un menu est ouvert, le jeu est en pause (main.js lit
// Menu.isOpen()).
//
// Chaque écran est un gabarit HTML ; les boutons portent un `data-action`,
// et un seul écouteur sur le panneau répartit les clics. Après chaque action
// du bac à sable, le panneau est redessiné pour montrer l'état à jour
// (niveaux, nombres d'exemplaires, cran de menace).

const Menu = (() => {
  let overlay, panel, pauseButton;
  let screen = null;
  // Bac à sable : les ennemis qu'on fait apparaître sont-ils des élites ?
  let eliteSpawn = false;
  // Abandonner demande une confirmation : un second appui.
  let confirmQuit = false;

  // --- Modes de commande ---
  const MODES = {
    swipe: {
      label: "glisser",
      help: ["Glisse pour courir", "touche : frapper · maintiens : stop"],
    },
    stick: {
      label: "joystick",
      help: ["Joystick sous le pouce", "bouton à droite pour frapper"],
    },
  };

  function applyMode(mode, explain) {
    Input.setMode(mode);
    Save.setControls(mode);
    if (explain) World.say(...MODES[mode].help, 4);
  }

  function init() {
    overlay = document.getElementById("overlay");
    panel = document.getElementById("panel");
    pauseButton = document.getElementById("pause");
    applyMode(Save.data.controls in MODES ? Save.data.controls : "swipe", false);

    panel.addEventListener("click", (e) => {
      const b = e.target.closest("[data-action]");
      if (b) act(b.dataset.action, b.dataset);
    });
    pauseButton.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      open(World.state.sandbox ? "sandbox" : "pause");
    });
    // L'application passe en arrière-plan (appel, verrouillage) : pause.
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && !screen) open(World.state.sandbox ? "sandbox" : "pause");
    });
    open("main");
  }

  const isOpen = () => screen !== null;

  function open(name) {
    screen = name;
    confirmQuit = false;
    Input.stop();
    overlay.hidden = false;
    pauseButton.hidden = true;
    render();
  }

  function close() {
    // Un appui d'attaque fait pendant le menu ne doit pas partir à la reprise.
    Input.takeAttack();
    screen = null;
    overlay.hidden = true;
    pauseButton.hidden = false;
    pauseButton.textContent = World.state.sandbox ? "🛠" : "II";
  }

  function start(sandbox) {
    World.sandbox.enable(sandbox);
    World.newExpedition();
    close();
    if (sandbox) World.say("Bac à sable", "invincible · 🛠 pour les outils", 4);
    else World.say(...MODES[Input.mode].help, 4);
  }

  function act(action, data) {
    const S = World.sandbox;
    switch (action) {
      case "play": return start(false);
      case "sandbox": return start(true);
      case "resume": return close();
      case "controls":
        applyMode(Input.mode === "swipe" ? "stick" : "swipe", false);
        break;
      case "quit":
        if (!confirmQuit) {
          confirmQuit = true;
          render();
          return;
        }
        World.sandbox.enable(false);
        World.newExpedition();
        return open("main");
      case "god": S.setGod(!World.state.god); break;
      case "heal": S.heal(); break;
      case "give": S.give(data.key); break;
      case "power": S.setPower(data.key, (World.state.run.powers[data.key] || 0) + Number(data.step)); break;
      case "relic": S.toggleRelic(data.key); break;
      case "ally": S.addAlly(data.key); break;
      case "clearAllies": S.clearAllies(); break;
      case "clear": S.clearGear(); break;
      case "elite": eliteSpawn = !eliteSpawn; break;
      case "spawn": S.spawnEnemy(data.key, eliteSpawn); break;
      case "killAll": S.killAll(); break;
      case "threat": S.setThreat(Number(data.level)); break;
      case "freeze": S.freezeThreat(World.state.run.threatFrozen !== Infinity); break;
      case "chest": S.spawnChest(data.tier); return close();
      case "camp": S.goToCamp(); return close();
      case "newMap": S.newMap(); return close();
    }
    render();
  }

  // --- Gabarits ---
  const btn = (action, label, extra = "", cls = "") =>
    `<button type="button" class="${cls}" data-action="${action}" ${extra}>${label}</button>`;

  function render() {
    if (screen === "main") panel.innerHTML = mainScreen();
    else if (screen === "pause") panel.innerHTML = pauseScreen();
    else if (screen === "sandbox") panel.innerHTML = sandboxScreen();
  }

  function mainScreen() {
    const d = Save.data;
    return `
      <h1>Screenlands</h1>
      <p class="sub">roguelite écran par écran</p>
      <div class="stack">
        ${btn("play", "Jouer", "", "big primary")}
        ${btn("sandbox", "Bac à sable", "", "big")}
        ${btn("controls", `Commandes : ${MODES[Input.mode].label}`)}
      </div>
      <p class="note">Banque ${d.bank} · meilleur butin ${d.best}</p>
      <p class="note dim">Le bac à sable permet de tout essayer : armes, pouvoirs, ennemis, menace. Ce qu'on y gagne ne va pas à la banque.</p>`;
  }

  function pauseScreen() {
    return `
      <h2>Pause</h2>
      <div class="stack">
        ${btn("resume", "Reprendre", "", "big primary")}
        ${btn("controls", `Commandes : ${MODES[Input.mode].label}`)}
        ${btn("quit", confirmQuit ? "Confirmer : butin et équipement perdus" : "Abandonner l'expédition", "", confirmQuit ? "danger" : "")}
      </div>`;
  }

  function sandboxScreen() {
    const st = World.state, r = st.run;
    const count = (k) => r.artifacts.filter((a) => a === k).length;
    const keysOf = (type) => Object.keys(ITEMS).filter((k) => ITEMS[k].type === type);
    const level = World.threatLevel();
    const frozen = r.threatFrozen === Infinity;

    const weapons = keysOf("weapon").map((k) =>
      btn("give", ITEMS[k].name, `data-key="${k}"`, r.weapon === k ? "on" : "")).join("");
    const powers = keysOf("power").map((k) => `
      <div class="row"><span>${ITEMS[k].name}</span>
        ${btn("power", "−", `data-key="${k}" data-step="-1"`, "small")}
        <b>${r.powers[k] || 0}</b>
        ${btn("power", "+", `data-key="${k}" data-step="1"`, "small")}
      </div>`).join("");
    const boosts = [...keysOf("boost"), ...keysOf("consumable")].map((k) =>
      btn("give", `${ITEMS[k].name}${count(k) ? ` ×${count(k)}` : ""}`, `data-key="${k}"`, count(k) ? "on" : "")).join("");
    const allies = keysOf("ally").map((k) => {
      const n = r.allies.filter((a) => a.type === k).length;
      return btn("ally", `${ITEMS[k].name}${n ? ` ×${n}` : ""}`, `data-key="${k}"`, n ? "on" : "");
    }).join("");
    const relics = keysOf("relic").map((k) =>
      btn("relic", ITEMS[k].name, `data-key="${k}"`, r.relics.includes(k) ? "on" : "")).join("");
    const enemies = Object.keys(Enemies.TYPES).map((k) =>
      btn("spawn", Enemies.TYPES[k].name, `data-key="${k}"`, k === "hunter" ? "danger" : "")).join("");
    const threat = [0, 1, 2, 3, 4, 5].map((n) =>
      btn("threat", String(n), `data-level="${n}"`, n === level ? "on small" : "small")).join("");
    const chests = [["common", "Commun"], ["rare", "Rare"], ["epic", "Épique"], ["legendary", "Légendaire"]]
      .map(([t, name]) => btn("chest", name, `data-tier="${t}"`, `tier-${t}`)).join("");

    return `
      <div class="head">
        <h2>Bac à sable</h2>
        ${btn("resume", "Reprendre", "", "primary")}
      </div>
      <section><h3>Joueur</h3><div class="grid">
        ${btn("god", `Invincible : ${st.god ? "oui" : "non"}`, "", st.god ? "on" : "")}
        ${btn("heal", "Soigner")}
        ${btn("clear", "Tout retirer")}
      </div></section>
      <section><h3>Arme</h3><div class="grid">${weapons}</div></section>
      <section><h3>Pouvoirs</h3>${powers}</section>
      <section><h3>Bonus et artefacts</h3><div class="grid">${boosts}</div></section>
      <section><h3>Reliques</h3><div class="grid">${relics}</div></section>
      <section><h3>Compagnons (${r.allies.length}/${Allies.MAX})</h3><div class="grid">${allies}
        ${btn("clearAllies", "Renvoyer")}
      </div><p class="note dim">Un coup reçu fait tomber le dernier de la file au lieu d'un cœur ; repasse dessus pour le relever.</p></section>
      <section><h3>Ennemis</h3><div class="grid">
        ${btn("elite", `Élite : ${eliteSpawn ? "oui" : "non"}`, "", eliteSpawn ? "on" : "")}
        ${enemies}
        ${btn("killAll", "Tout tuer")}
      </div><p class="note dim">Ils apparaissent quand tu reprends.</p></section>
      <section><h3>Menace</h3><div class="grid threat">${threat}
        ${btn("freeze", frozen ? "Figée" : "Figer", "", frozen ? "on" : "")}
      </div></section>
      <section><h3>Coffre devant toi</h3><div class="grid">${chests}</div></section>
      <section><h3>Carte</h3><div class="grid">
        ${btn("camp", "Aller au camp")}
        ${btn("newMap", "Nouvelle carte")}
      </div></section>
      <div class="stack foot">${btn("quit", confirmQuit ? "Confirmer : retour au menu" : "Menu principal", "", confirmQuit ? "danger" : "")}</div>`;
  }

  return { init, isOpen, open };
})();

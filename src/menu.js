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
  // Abandonner, et tout rembourser à l'atelier, demandent une confirmation :
  // un second appui.
  let confirmQuit = false;
  let confirmRefund = false;

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
    confirmRefund = false;
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
    Sound.play(action === "buy" ? "buy" : "click");
    switch (action) {
      case "play": Save.clearNotice(); return start(false);
      case "sandbox": return start(true);
      case "shop": return open("shop");
      case "heroStyle":
        Save.setHeroStyle(Save.data.heroStyle === "3d" ? "pixel" : "3d");
        break;
      case "mode":
        Save.setMode(MODE_ORDER[(MODE_ORDER.indexOf(Save.data.mode) + 1) % MODE_ORDER.length]);
        break;
      case "back": return open("main");
      case "buy": Upgrades.buy(data.key); confirmRefund = false; break;
      case "refund":
        if (!confirmRefund) { confirmRefund = true; break; }
        Upgrades.refund();
        confirmRefund = false;
        break;
      case "resume": return close();
      case "controls":
        applyMode(Input.mode === "swipe" ? "stick" : "swipe", false);
        break;
      case "sound":
      case "music":
        Save.toggle(action);
        Sound.applySettings();
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
      case "floor": S.nextFloor(); return close();
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
    else if (screen === "shop") panel.innerHTML = shopScreen();
  }

  // Bruitages et musique, côte à côte.
  function audioButtons() {
    const d = Save.data;
    return `<div class="grid" style="justify-content:center">
      ${btn("sound", `Sons : ${d.sound ? "oui" : "non"}`, "", d.sound ? "on" : "")}
      ${btn("music", `Musique : ${d.music ? "oui" : "non"}`, "", d.music ? "on" : "")}
    </div>`;
  }

  // Ce que change chaque mode, en une ligne.
  const MODE_HELP = {
    easy: "à la mort, tu gardes tout le butin porté · gemmes ×0,5",
    normal: "à la mort, tu gardes 25 % du butin porté (plus avec le coffre-fort)",
    hard: "à la mort, tu perds tout · gemmes ×1,5 · ouvre des achats réservés",
  };
  const MODE_ORDER = ["easy", "normal", "hard"];

  function mainScreen() {
    const d = Save.data;
    return `
      <h1>LabyRun</h1>
      <p class="sub">survivor</p>
      ${d.refundNotice ? `<p class="note gold">L'atelier a changé : tes ${d.refundNotice} 💎 d'achats t'ont été rendus.</p>` : ""}
      <div class="stack">
        ${btn("play", "Jouer", "", "big primary")}
        ${btn("mode", `Mode : ${Config.MODES[d.mode].name}`, "", d.mode === "hard" ? "danger" : "")}
        <p class="note dim" style="margin:0">${MODE_HELP[d.mode]}</p>
        ${btn("shop", `Atelier · ${d.bank} 💎`, "", "big")}
        ${btn("sandbox", "Bac à sable", "", "big")}
        ${btn("heroStyle", `Héroïne : ${d.heroStyle === "3d" ? "3D" : "pixel"}`)}
        ${btn("controls", `Commandes : ${MODES[Input.mode].label}`)}
        ${audioButtons()}
      </div>
      <p class="note">Banque ${d.bank} · meilleur butin ${d.best}</p>
      <p class="note dim">Le bac à sable permet de tout essayer : armes, pouvoirs, ennemis, menace. Ce qu'on y gagne ne va pas à la banque.</p>`;
  }

  // L'atelier : une ligne par amélioration, ses niveaux en pastilles, et le
  // prix du suivant. Un achat trop cher reste visible, grisé : on sait ce
  // qu'on vise.
  function shopScreen() {
    const rows = Object.entries(Upgrades.LIST).map(([key, u]) => {
      const n = Upgrades.level(key), price = Upgrades.cost(key);
      const pips = Array.from({ length: u.max }, (_, i) => `<i class="${i < n ? "on" : ""}"></i>`).join("");
      const hint = Upgrades.locked(key)
        ? `🔒 mets ${u.hard} 💎 à l'abri en mode difficile (${Save.data.hardBanked}/${u.hard})`
        : u.hint;
      const action = price === null
        ? `<button type="button" class="small" disabled>max</button>`
        : btn("buy", `${price} 💎`, `data-key="${key}"${Upgrades.affordable(key) ? "" : " disabled"}`, "small");
      return `<div class="row upgrade"><span><b>${u.name}</b> <em class="pips">${pips}</em><br><small>${hint}</small></span>${action}</div>`;
    }).join("");
    const spent = Upgrades.spent();
    return `
      <div class="head">
        <h2>Atelier</h2>
        ${btn("back", "Retour", "", "primary")}
      </div>
      <p class="note">Banque <b class="gold">${Save.data.bank} 💎</b> · pour toutes les expéditions à venir</p>
      <section>${rows}</section>
      <div class="stack foot">${spent ? btn("refund", confirmRefund ? `Confirmer : rendre ${spent} 💎` : "Tout rembourser", "", confirmRefund ? "danger" : "") : ""}</div>`;
  }

  function pauseScreen() {
    return `
      <h2>Pause</h2>
      <div class="stack">
        ${btn("resume", "Reprendre", "", "big primary")}
        ${btn("controls", `Commandes : ${MODES[Input.mode].label}`)}
        ${audioButtons()}
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
    // Un appui : l'esprit rejoint la file, puis monte d'un niveau.
    const allies = Allies.POOL.map((k) => {
      const a = r.allies.find((x) => x.type === k);
      return btn("ally", `${Allies.TYPES[k].name}${a ? ` niv. ${a.level}` : ""}`, `data-key="${k}"`, a ? "on" : "");
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
      <section><h3>Esprits (${r.allies.length}/${Allies.maxFor(r)})</h3><div class="grid">${allies}
        ${btn("clearAllies", "Renvoyer")}
      </div><p class="note dim">Un coup reçu fait tomber le dernier esprit de la file au lieu d'un cœur ; repasse dessus pour le relever.</p></section>
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
        ${btn("floor", `Étage suivant (${World.state.run.floor + 1})`)}
        ${btn("newMap", "Nouvelle carte")}
      </div></section>
      <div class="stack foot">${btn("quit", confirmQuit ? "Confirmer : retour au menu" : "Menu principal", "", confirmQuit ? "danger" : "")}</div>`;
  }

  return { init, isOpen, open };
})();

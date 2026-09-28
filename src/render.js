"use strict";

// Le rendu : tout ce qui dessine, et rien d'autre.
//
// Il lit l'état de World sans jamais le modifier. Pour l'instant chaque
// élément est un rectangle de couleur ; quand les graphismes arriveront, c'est
// le seul fichier à réécrire : STYLE deviendra une table `kind` -> sprite, et
// le reste du jeu ne verra pas la différence.

const Render = (() => {
  const STYLE = {
    wall: "#2e3342",
    rock: "#4f5463",
    player: "#f2c44d",
    label: "#8f9bad",
  };

  let ctx;

  function init(canvas) {
    canvas.width = Config.ZONE_W;
    canvas.height = Config.ZONE_H;
    ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
  }

  function draw(state) {
    const { zone, solids, player, coords } = state;

    ctx.fillStyle = zone.ground;
    ctx.fillRect(0, 0, Config.ZONE_W, Config.ZONE_H);

    for (const s of solids) {
      ctx.fillStyle = STYLE[s.kind];
      ctx.fillRect(s.x, s.y, s.w, s.h);
    }

    const half = player.size / 2;
    ctx.fillStyle = STYLE.player;
    ctx.fillRect(Math.round(player.x - half), Math.round(player.y - half),
                 player.size, player.size);

    // Pastille de debug : nom et coordonnées de la zone, pour vérifier les
    // transitions. Elle disparaîtra.
    ctx.fillStyle = STYLE.label;
    ctx.font = "8px monospace";
    ctx.textBaseline = "top";
    ctx.fillText(`${zone.name} (${coords.x}, ${coords.y})`, 20, 4);
  }

  return { init, draw };
})();

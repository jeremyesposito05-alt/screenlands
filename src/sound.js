"use strict";

// Le son : bruitages et musique, tirés du pack Ninja Adventure (CC0, voir
// assets/audio/SOURCE.txt).
//
// Il écoute les événements de World (state.events) et ne change rien au jeu.
// Les bruitages sont décodés une fois dans des tampons Web Audio ; chacun est
// joué avec un léger écart de hauteur, pour qu'une rafale de coups ne sonne
// pas comme une mitraillette. Les gemmes ramassées d'affilée montent la
// gamme.
//
// Sur iPhone, le son ne peut démarrer qu'après un geste du joueur : tout est
// créé au premier toucher. La musique passe aussi par Web Audio, seul moyen
// d'y régler le volume sur iOS.

const Sound = (() => {
  // Volume et hauteur de chaque bruitage. `vary` : écart de hauteur au hasard.
  const SFX = {
    swing: { volume: 0.45, vary: 0.12 },
    thrust: { volume: 0.45, vary: 0.1 },
    shoot: { volume: 0.4, vary: 0.1 },
    throw: { volume: 0.4, vary: 0.08 },
    hit: { volume: 0.5, vary: 0.15 },
    kill: { volume: 0.55, vary: 0.15 },
    killBig: { volume: 0.7, vary: 0.05 },
    hurt: { volume: 0.8 },
    block: { volume: 0.6 },
    allyDown: { volume: 0.7 },
    revive: { volume: 0.6 },
    gem: { volume: 0.35 },
    chest: { volume: 0.6 },
    chestRare: { volume: 0.65 },
    item: { volume: 0.55 },
    bank: { volume: 0.7 },
    portal: { volume: 0.6 },
    door: { volume: 0.18, vary: 0.1 },
    threat: { volume: 0.6 },
    hunter: { volume: 0.75 },
    enemyShot: { volume: 0.3, vary: 0.15 },
    explode: { volume: 0.7, vary: 0.08 },
    click: { volume: 0.35 },
    buy: { volume: 0.55 },
    death: { volume: 0.7 },
    phoenix: { volume: 0.7 },
    legendary: { volume: 0.7 },
    victory: { volume: 0.7 },
    superGem: { volume: 0.7 },
    devour: { volume: 0.65, vary: 0.05 },
  };
  // Un même bruitage n'est pas rejoué plus souvent (en secondes).
  const MIN_GAP = 0.05;
  const MUSIC = {
    base: "music_base.ogg",
    explore: "music_explore.ogg",
    danger: "music_danger.ogg",
    boss: "music_boss.ogg",
  };
  const MUSIC_VOLUME = 0.32;
  const FADE = 0.8;

  let ctx = null, sfxGain = null, musicGain = null, musicEl = null;
  const buffers = {};
  const lastPlayed = {};
  let track = null, wanted = null;
  // La série de gemmes : chaque gemme ramassée peu après la précédente sonne
  // un demi-ton plus haut.
  let gemStreak = 0, gemTimer = 0;

  function init() {
    const start = () => {
      unlock();
      for (const t of ["pointerdown", "touchend", "keydown"]) removeEventListener(t, start, true);
    };
    for (const t of ["pointerdown", "touchend", "keydown"]) addEventListener(t, start, true);
  }

  function unlock() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    sfxGain = ctx.createGain();
    sfxGain.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0;
    musicGain.connect(ctx.destination);
    musicEl = new Audio();
    musicEl.loop = true;
    musicEl.preload = "auto";
    ctx.createMediaElementSource(musicEl).connect(musicGain);
    // iOS ne laisse démarrer la musique que pendant ce geste : on lance
    // celle du camp tout de suite, le volume monte ensuite en fondu.
    if (Save.data.music) {
      track = "base";
      musicEl.src = `assets/audio/${MUSIC.base}`;
      musicEl.play().catch(() => { track = null; });
    }
    // Revenu d'un appel ou d'un verrouillage, le son reprend au toucher.
    addEventListener("pointerdown", () => { if (ctx.state !== "running") ctx.resume(); }, true);
    applySettings();
    for (const name in SFX) {
      fetch(`assets/audio/${name}.wav`)
        .then((r) => r.arrayBuffer())
        .then((data) => new Promise((ok, ko) => ctx.decodeAudioData(data, ok, ko)))
        .then((buffer) => { buffers[name] = buffer; })
        .catch(() => { /* un son manquant ne bloque rien */ });
    }
  }

  function applySettings() {
    if (!ctx) return;
    sfxGain.gain.value = Save.data.sound ? 1 : 0;
    if (!Save.data.music) {
      musicGain.gain.value = 0;
      musicEl.pause();
      track = null;
    }
  }

  function play(name, rate = 1) {
    if (!ctx || !buffers[name] || !Save.data.sound) return;
    const now = ctx.currentTime;
    if (now - (lastPlayed[name] || -1) < MIN_GAP) return;
    lastPlayed[name] = now;
    const s = SFX[name];
    const src = ctx.createBufferSource();
    src.buffer = buffers[name];
    src.playbackRate.value = rate * (1 + (Math.random() - 0.5) * (s.vary || 0));
    const g = ctx.createGain();
    g.gain.value = s.volume;
    src.connect(g).connect(sfxGain);
    src.start();
  }

  // Les événements d'un ou plusieurs pas de jeu.
  function handle(events) {
    for (const e of events) {
      if (e.type === "gem") {
        play("gem", 2 ** (Math.min(gemStreak, 12) / 12));
        gemStreak++;
        gemTimer = 0.9;
      } else if (e.type === "stairs") {
        play("portal", 0.8);
      } else if (SFX[e.type]) {
        play(e.type);
      }
    }
  }

  // La musique suit la situation : calme au camp de base, exploration,
  // danger quand la menace monte ou que le Chasseur rôde, combat devant le
  // Gardien. Un changement passe par un fondu.
  function update(state, dt, menuOpen) {
    gemTimer -= dt;
    if (gemTimer <= 0) gemStreak = 0;
    if (!ctx || !Save.data.music) return;
    const bossHere = state.enemies.some((e) => e.slot === "boss");
    wanted = menuOpen || state.zone.safe ? "base"
      : bossHere ? "boss"
      : state.hunter || state.hunterComing || state.threatLevel >= 3 ? "danger"
      : "explore";
    const g = musicGain.gain;
    if (wanted !== track) {
      g.value = Math.max(0, g.value - dt / FADE * MUSIC_VOLUME);
      if (g.value <= 0.001 || !track) {
        track = wanted;
        musicEl.src = `assets/audio/${MUSIC[track]}`;
        musicEl.play().catch(() => { track = null; });
      }
    } else if (g.value < MUSIC_VOLUME) {
      g.value = Math.min(MUSIC_VOLUME, g.value + dt / FADE * MUSIC_VOLUME);
    }
  }

  return { init, play, handle, update, applySettings };
})();

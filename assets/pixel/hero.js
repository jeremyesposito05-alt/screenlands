"use strict";

// Le héros, dessiné pixel par pixel. Une lettre = un pixel, dans la palette
// PIXEL_PALETTE ; un point = transparent. Chaque vue est une suite d'images
// de même taille : [immobile, pas A, pas B]. La marche les joue dans l'ordre
// immobile, A, immobile, B.
//
// tools/paint.html?build en fait les images de assets/sprites (une bande
// horizontale par vue), calées en bas d'un cadre de PIXEL_FRAME.h pixels.

const PIXEL_PALETTE = {
  o: "#2E1A47", // contour
  p: "#452B6C", // ombre dans la capuche
  r: "#B8333F", // rouge sombre
  R: "#E65C52", // rouge
  O: "#F28B3C", // bord de la capuche
  y: "#F2C14E", // or : boucle, revers des bottes, mèches
  c: "#F8E1B9", // crème : cheveux, tunique
  k: "#D7B98C", // tunique dans l'ombre
  s: "#F2B48C", // peau
  S: "#C9876A", // peau dans l'ombre
  b: "#A57B52", // cuir clair
  B: "#7B4E33", // cuir
  t: "#2B7A8E", // écharpe dans l'ombre
  T: "#4AA7A8", // écharpe
  E: "#6FD1D0", // reflet de l'écharpe
};

const PIXEL_FRAME = { w: 18, h: 28 };

// Le haut du corps, commun aux trois images d'une vue.
const HERO_FRONT_TOP = [
  ".......ooo........",
  ".....ooRRRoo......",
  "....oRRRRRRRoo....",
  "...oRRRRRRRRRRo...",
  "..oRRRRRRRRRRRro..",
  "..oRRROOOOOORrro..",
  ".oRRROyccyycOrrro.",
  ".oRROpcsssscpOrro.",
  ".oRROpsossospOrro.",
  ".oRROpsossospOrro.",
  "..oRROpSssSpOrro..",
  ".oRrrTTETTETTrrro.",
  ".oRrtTTTTTTTTtrro.",
  ".oRRotTccccTtorro.",
  ".oRRockcBBckcorro.",
  "oRRrockccBkckorrro",
  "oRrbBoBByBBBoBbrro",
  "orrbBocckkkcoBbrro",
  ".orrookkkkkkoorro.",
  "..orroBBooBBorro..",
];

const HERO_BACK_TOP = [
  ".......ooo........",
  ".....ooRRRoo......",
  "....oRRRRRRRoo....",
  "...oRRRRRRRRRRo...",
  "..oRRRRRRRRRRRro..",
  "..oRRRRRRRRRRrro..",
  ".oRRRRRRrRRRRrrro.",
  ".oRRRRRRrRRRRrrro.",
  ".oRRRRRrRRRRRrrro.",
  ".orRRRRrRRRRrrrro.",
  "..orrRRrRRRrrrro..",
  ".orTTTTTTTTTTTTro.",
  ".oRtTTTTTTTTTTtRo.",
  ".oRRoRBBBBBBRoRRo.",
  ".oRRRoBbbbbBoRRRo.",
  "oRRrRoBbyybBoRrRRo",
  "oRrbRoBbbbbBoRbrRo",
  "orrbBRoBBBBoRBbrro",
  ".orrrRRooooRRrrro.",
  "..orrrrrrrrrrrro..",
];

const HERO_SIDE_TOP = [
  "......oooo........",
  "....ooRRRRoo......",
  "...oRRRRRRRRo.....",
  "..oRRRRRRRRRRo....",
  "..oRRRRRRRRROOo...",
  ".orRRRRRRROyccOo..",
  ".orrRRRRROcccssOo.",
  ".orrrRRRRpkssosso.",
  ".orrrrRRRpkssossso",
  "..orrrrrRppsssso..",
  "..orrrrrrpSssSo...",
  "..orrrrTTTTTTTo...",
  "..orrrrtTTETTTto..",
  "..oRRRRotTTttco...",
  "..oRRRRRockcko....",
  "..oRrRRRockcco....",
  "..orRRRrobBbBo....",
  "..orrRRrocBByo....",
  "..orrrrrokkkko....",
  "...oorrroBBoo.....",
];

// Les jambes de face et de dos : immobile, puis un pied levé, puis l'autre.
const LEGS_FRONT = [
  [
    "...oooBBo.oBBooo..",
    ".....oBBo.oBBo....",
    ".....oyyo.oyyo....",
    "....oBBBo.oBBBo...",
    "....ooooo.ooooo...",
  ],
  [
    "...oooBBo.oBBooo..",
    ".....oBBo.oyyo....",
    ".....oyyo.oBBBo...",
    "....oBBBo.ooooo...",
    "....ooooo.........",
  ],
  [
    "...oooBBo.oBBooo..",
    ".....oyyo.oBBo....",
    "....oBBBo.oyyo....",
    "....ooooo.oBBBo...",
    "..........ooooo...",
  ],
];

const LEGS_SIDE = [
  [
    ".......oBBBo......",
    ".......oBBBo......",
    ".......oyyyo......",
    ".......oBBBBo.....",
    ".......oooooo.....",
  ],
  [
    "......oBBooBBo....",
    ".....oBBo.oBBo....",
    ".....oyyo..oyyo...",
    "....oBBBo..oBBBo..",
    "....ooooo..ooooo..",
  ],
  [
    ".......oBBBo......",
    "......oBBoBBo.....",
    "......oyyoyyo.....",
    ".....oBBBoBBBo....",
    ".....ooooooooo....",
  ],
];

const PIXEL_ART = {
  hero_front: LEGS_FRONT.map((legs) => [...HERO_FRONT_TOP, ...legs]),
  hero_back: LEGS_FRONT.map((legs) => [...HERO_BACK_TOP, ...legs]),
  hero_side: LEGS_SIDE.map((legs) => [...HERO_SIDE_TOP, ...legs]),
};

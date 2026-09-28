# Architecture envisagée

> Ce document décrit le prototype Godot, mis de côté le 28 septembre 2026 au
> profit de la version HTML à la racine du dépôt. Les idées restent valables :
> elles ont été transposées telles quelles dans `src/`.

Ce document explique pourquoi le code est découpé comme il l'est, et où
viendront se brancher les systèmes pas encore écrits. Il est volontairement
court : il décrit des intentions, pas un plan figé.

## Ce que le concept impose

Quatre points du concept ont des conséquences directes sur le code, et ce sont
eux qui ont dicté le découpage actuel.

**Une zone vaut un écran.** C'est la contrainte la plus structurante. Elle
signifie que la taille du viewport est une donnée de game design et pas un
réglage d'affichage : une zone occupe exactement l'écran, donc il n'y a aucune
caméra à déplacer, aucun scrolling, et le repère d'une zone est le repère de
l'écran. Toutes ces tailles vivent dans `core/game_config.gd`, et tout le reste
en est dérivé.

**Le joueur survit au changement de zone, la zone non.** Le joueur est donc un
enfant de `World` et pas de la zone. Une zone est une scène passive : elle
décrit un décor et ses collisions, elle ne sait pas où elle est dans le monde
et ne charge jamais sa voisine. Une seule zone est chargée à la fois.

**Le monde sera semi-procédural.** Ce qui veut dire que la carte doit être
derrière une seule porte, remplaçable. C'est le rôle de `ZoneRegistry` : il
répond à « quelle scène se trouve en (x, y) ? », aujourd'hui depuis un
dictionnaire écrit à la main. Le générateur remplacera ce dictionnaire sans que
`World` change, parce que `World` ne connaît de la carte que `has_zone()` et
`get_zone_scene()`.

**Le stop ou encore est une mécanique de run, pas de zone.** Le multiplicateur,
les récompenses en attente et la distance parcourue appartiennent à
l'expédition en cours, pas à l'écran affiché. Ils vivront donc dans un objet de
run séparé, détruit à la fin de l'expédition, distinct de la progression
permanente qui, elle, survit.

## Comment le passage d'un écran à l'autre marche

Le monde est une grille de coordonnées entières (`Vector2i`). `World` retient
les coordonnées courantes et, à chaque frame physique, regarde si le joueur a
dépassé un bord de la zone.

Si oui, et si le registre connaît une zone voisine dans cette direction, il
libère la zone courante, instancie la voisine, et fait ressortir le joueur du
bord opposé en gardant son autre coordonnée. Sortir par la porte de gauche à
mi-hauteur fait donc entrer par la porte de droite à la même hauteur.

Cela repose sur une hypothèse : **les portes de deux zones voisines se font
face.** C'est garanti aujourd'hui parce que la ceinture de murs vient d'une
scène unique, `zone_border.tscn`, qui construit ses huit segments et ses quatre
portes par code depuis `GameConfig`. Toutes les zones ont donc exactement la
même ouverture.

Cette hypothèse est le principal point à surveiller quand la génération
arrivera : des zones aux sorties différentes devront soit déclarer leurs portes,
soit être assemblées par des règles qui garantissent que les sorties
correspondent. C'est la raison pour laquelle la géométrie des murs est calculée
et pas dessinée à la main.

Si le registre ne connaît pas de voisine, le joueur est simplement retenu au
bord. C'est un bouchon : la vraie limite d'expédition viendra avec la
génération.

La transition est instantanée. Le glissement d'écran à la Zelda est isolé dans
`World._enter_zone()` et pourra être ajouté là sans toucher au reste.

## Ce qui viendra, et où

Rien de ce qui suit n'est écrit. C'est la place prévue, pour que l'ordre
d'ajout soit clair.

**Génération semi-procédurale.** Derrière `ZoneRegistry`. Un générateur tire
des zones prédéfinies selon des règles (distance au départ, sorties
compatibles, densité de danger) et répond aux deux mêmes méthodes. `World` ne
bouge pas. Les zones auront probablement besoin de déclarer des étiquettes
(biome, sorties, difficulté) : `Zone` est là pour accueillir ces champs, il n'a
pour l'instant qu'un `display_name`.

**Ennemis à comportements modulaires.** L'idée des fantômes de Pac-Man est que
peu de comportements bien distincts suffisent à beaucoup d'ennemis.
Concrètement, cela veut dire séparer trois choses : les statistiques (points de
vie, vitesse, dégâts), le comportement de déplacement (poursuivre, couper la
route, patrouiller, fuir à distance) et les capacités (attaque de contact, tir,
invocation). Un ennemi devient une composition de ces trois briques plutôt
qu'une classe par type, pour qu'un nouvel ennemi soit une combinaison à
déclarer et pas du code à écrire. Le déplacement en particulier gagne à être
une brique remplaçable, les comportements étant nombreux et les ennemis peu
profonds.

**Run et progression permanente.** Deux états séparés, parce qu'ils ont des
durées de vie opposées : l'un meurt avec l'expédition, l'autre est sauvegardé.
Le stop ou encore (multiplicateur, récompenses non sécurisées) et les camps qui
les sécurisent appartiennent au premier. La monnaie permanente et les
déblocages appartiennent au second.

**Tactile et portrait.** L'entrée passe déjà par des actions nommées et jamais
par des touches en dur, donc un joystick à l'écran alimentera les mêmes actions
sans toucher au joueur. L'orientation forcée et les réglages d'export mobile ne
sont pas encore dans `project.godot` : on développe sur PC d'abord, ce sera une
passe à part.

## Choix à valider

Ces trois points sont des paris, pas des certitudes. Ils sont faits pour être
faciles à défaire.

**La taille de zone.** 12 x 26 tuiles respecte le ratio iPhone au pixel, mais
c'est étroit et haut : un écran se traverse vite en largeur et lentement en
hauteur, et les transitions verticales seront plus fréquentes que les
horizontales. À jouer avant de trancher. Deux constantes à changer dans
`game_config.gd`.

**Une porte centrée par côté.** Simple, et ça rend les zones interchangeables
sans effort. Mais ça fige la circulation : toutes les zones se traversent
pareil, et le level design ne peut pas jouer sur la position des sorties. À
reconsidérer quand la génération arrivera.

**Le déplacement strictement cardinal.** Fidèle aux premiers Zelda et adapté au
tactile, mais plus raide que la 8 directions. Un seul endroit à changer,
`Player._read_direction()`.

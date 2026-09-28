class_name GameConfig
extends RefCounted

## Les constantes qui définissent la forme du monde.
##
## Une zone vaut exactement un écran : ZONE_SIZE est donc aussi la taille du
## viewport. Si tu la changes, mets à jour display/window/size dans
## project.godot pour que les deux restent d'accord.


const TILE_SIZE := 16

## 12 x 26 tuiles = 192 x 416 px, soit un ratio 9:19.5 (iPhone portrait
## moderne). C'est volontairement étroit et haut : c'est la contrainte du
## format portrait. Tout est dérivé d'ici, donc ces deux nombres sont le seul
## endroit à toucher pour essayer une autre taille de zone.
const ZONE_WIDTH_TILES := 12
const ZONE_HEIGHT_TILES := 26
const ZONE_SIZE := Vector2i(ZONE_WIDTH_TILES * TILE_SIZE, ZONE_HEIGHT_TILES * TILE_SIZE)

## Épaisseur du mur qui ceinture une zone, et largeur de la porte centrale
## percée dans chacun des quatre côtés.
const WALL_THICKNESS := TILE_SIZE
const DOORWAY_SIZE := TILE_SIZE * 4

## De combien de pixels le joueur est posé à l'intérieur de la nouvelle zone
## après avoir franchi un bord.
const ZONE_ENTRY_MARGIN := 8.0

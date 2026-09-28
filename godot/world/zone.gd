class_name Zone
extends Node2D

## Un écran du monde.
##
## Une zone reste une scène passive : elle décrit un décor et ses collisions,
## elle ne sait pas où elle se trouve dans le monde et ne charge jamais sa
## voisine. C'est World qui l'instancie et la libère.
##
## Elle est toujours posée à l'origine et occupe exactement
## GameConfig.ZONE_SIZE. Sa ceinture de murs vient de zone_border.tscn, ce qui
## garantit que ses quatre portes sont au même endroit que celles des autres
## zones : World s'appuie sur cette hypothèse pour faire passer le joueur d'un
## écran à l'autre.


## Affiché dans la pastille de debug. Servira aussi de nom lisible aux règles
## de génération.
@export var display_name: String = "Zone"

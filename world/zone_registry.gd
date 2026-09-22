class_name ZoneRegistry
extends RefCounted

## La carte du monde : quelle scène de zone se trouve à quelles coordonnées.
##
## Écrite à la main pour le prototype, avec une grille 2x2 qui suffit à valider
## les quatre directions de transition.
##
## C'est le point d'entrée unique de la génération à venir : le semi-procédural
## remplacera ce dictionnaire fixe par un tirage de zones prédéfinies, sans que
## World ait à changer. Tant que has_zone() et get_zone_scene() répondent, le
## reste du jeu ne sait pas si le monde est écrit à la main ou généré.


var _zones: Dictionary = {
	Vector2i(0, 0): preload("res://zones/zone_clearing.tscn"),
	Vector2i(1, 0): preload("res://zones/zone_rocks.tscn"),
	Vector2i(0, 1): preload("res://zones/zone_corridor.tscn"),
	Vector2i(1, 1): preload("res://zones/zone_pillars.tscn"),
}


func has_zone(coords: Vector2i) -> bool:
	return _zones.has(coords)


func get_zone_scene(coords: Vector2i) -> PackedScene:
	return _zones.get(coords, null) as PackedScene

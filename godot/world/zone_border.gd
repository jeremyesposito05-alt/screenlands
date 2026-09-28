class_name ZoneBorder
extends StaticBody2D

## La ceinture de murs d'une zone : les quatre bords, percés d'une porte
## centrale chacun.
##
## Elle est construite par code à partir de GameConfig plutôt que placée à la
## main dans la scène, pour deux raisons :
##
## 1. changer la taille d'une zone ou la largeur des portes ne demande alors de
##    toucher qu'à game_config.gd ;
## 2. toutes les zones partagent exactement la même ouverture. World fait
##    ressortir le joueur du côté opposé en gardant son autre coordonnée, ce
##    qui ne tombe dans un couloir que si les portes se font face.
##
## Les murs sont à l'intérieur de l'écran (ils occupent l'anneau de tuiles du
## bord) pour que le joueur les voie et comprenne où sont les sorties.


const WALL_COLOR := Color(0.180392, 0.200000, 0.258824)


func _ready() -> void:
	for rect in wall_rects():
		_add_wall(rect)


## Les huit segments de mur, en pixels locaux à la zone : deux par côté, de
## part et d'autre de la porte.
static func wall_rects() -> Array[Rect2]:
	var size := Vector2(GameConfig.ZONE_SIZE)
	var thickness := float(GameConfig.WALL_THICKNESS)
	var door := float(GameConfig.DOORWAY_SIZE)

	# Longueur de mur entre un coin et le bord de la porte.
	var side_x := (size.x - door) * 0.5
	var side_y := (size.y - door) * 0.5

	# Les segments horizontaux s'arrêtent à l'épaisseur du mur pour ne pas
	# recouvrir les coins, que les segments verticaux couvrent déjà.
	var rects: Array[Rect2] = []
	rects.append(Rect2(thickness, 0.0, side_x - thickness, thickness))
	rects.append(Rect2(side_x + door, 0.0, side_x - thickness, thickness))
	rects.append(Rect2(thickness, size.y - thickness, side_x - thickness, thickness))
	rects.append(Rect2(side_x + door, size.y - thickness, side_x - thickness, thickness))
	rects.append(Rect2(0.0, 0.0, thickness, side_y))
	rects.append(Rect2(0.0, side_y + door, thickness, side_y))
	rects.append(Rect2(size.x - thickness, 0.0, thickness, side_y))
	rects.append(Rect2(size.x - thickness, side_y + door, thickness, side_y))
	return rects


func _add_wall(rect: Rect2) -> void:
	var shape := RectangleShape2D.new()
	shape.size = rect.size

	var collider := CollisionShape2D.new()
	collider.shape = shape
	collider.position = rect.get_center()
	add_child(collider)

	var visual := ColorRect.new()
	visual.color = WALL_COLOR
	visual.position = rect.position
	visual.size = rect.size
	visual.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(visual)

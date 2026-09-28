extends Node2D

## Le chef d'orchestre de l'expédition.
##
## Il garde une seule zone chargée à la fois et fait passer le joueur dans la
## zone voisine dès qu'il franchit un bord de l'écran.
##
## Le joueur n'est volontairement pas un enfant de la zone : il survit au
## changement d'écran. Zones et joueur vivent dans le même repère, et une zone
## est toujours posée à l'origine, donc la position du joueur est directement
## sa position dans la zone. C'est aussi pourquoi il n'y a aucune Camera2D : le
## viewport fait exactement la taille d'une zone.


const START_COORDS := Vector2i.ZERO

@onready var _zone_container: Node2D = %ZoneContainer
@onready var _player: Player = %Player
@onready var _debug_label: Label = %DebugLabel

var _registry := ZoneRegistry.new()
var _coords := START_COORDS
var _zone: Zone = null


func _ready() -> void:
	_enter_zone(START_COORDS)
	_player.position = Vector2(GameConfig.ZONE_SIZE) * 0.5


func _physics_process(_delta: float) -> void:
	var crossed := _crossed_edge(_player.position)
	if crossed == Vector2i.ZERO:
		return

	var target := _coords + crossed
	if not _registry.has_zone(target):
		# Bord du monde connu : on retient le joueur au lieu de le laisser
		# sortir dans le vide. La génération remplacera ça par une vraie
		# limite d'expédition.
		_player.position = _clamp_inside(_player.position)
		return

	_enter_zone(target)
	_player.position = _entry_position(_player.position, crossed)


## Remplace la zone chargée. Ne touche pas au joueur : c'est à l'appelant de le
## placer.
func _enter_zone(coords: Vector2i) -> void:
	if _zone != null:
		# remove_child() avant queue_free() : sans ça l'ancienne zone reste
		# dans l'arbre jusqu'à la fin de la frame, et ses murs pousseraient le
		# joueur qui vient d'arriver.
		_zone_container.remove_child(_zone)
		_zone.queue_free()
		_zone = null

	_zone = _registry.get_zone_scene(coords).instantiate() as Zone
	_zone_container.add_child(_zone)
	_coords = coords
	_debug_label.text = "%s %s" % [_zone.display_name, _coords]


## Le bord que le joueur vient de dépasser, ou ZERO tant qu'il est dans la zone.
static func _crossed_edge(pos: Vector2) -> Vector2i:
	var size := Vector2(GameConfig.ZONE_SIZE)
	if pos.x < 0.0:
		return Vector2i.LEFT
	if pos.x > size.x:
		return Vector2i.RIGHT
	if pos.y < 0.0:
		return Vector2i.UP
	if pos.y > size.y:
		return Vector2i.DOWN
	return Vector2i.ZERO


static func _clamp_inside(pos: Vector2) -> Vector2:
	var size := Vector2(GameConfig.ZONE_SIZE)
	var margin := GameConfig.ZONE_ENTRY_MARGIN
	return Vector2(
		clampf(pos.x, margin, size.x - margin),
		clampf(pos.y, margin, size.y - margin),
	)


## Fait ressortir le joueur du bord opposé de la zone qu'il vient d'entrer, en
## gardant son autre coordonnée : il arrive donc dans la porte qui fait face à
## celle qu'il a prise.
static func _entry_position(pos: Vector2, direction: Vector2i) -> Vector2:
	var size := Vector2(GameConfig.ZONE_SIZE)
	var margin := GameConfig.ZONE_ENTRY_MARGIN
	var result := pos
	if direction.x < 0:
		result.x = size.x - margin
	elif direction.x > 0:
		result.x = margin
	if direction.y < 0:
		result.y = size.y - margin
	elif direction.y > 0:
		result.y = margin
	return result

class_name Player
extends CharacterBody2D

## Le joueur : quatre directions, pas de diagonale.
##
## L'entrée passe par les actions move_* et jamais par une touche en dur, pour
## qu'un joystick tactile puisse les alimenter plus tard sans toucher à ce
## fichier.


## En pixels par seconde. 90 traverse la largeur d'une zone en un peu plus de
## deux secondes.
@export var speed: float = 90.0

## Dernière direction non nulle. Rien ne s'en sert encore : ce sera l'ancrage
## de l'animation et de la direction des attaques.
var facing: Vector2i = Vector2i.DOWN


func _physics_process(_delta: float) -> void:
	var direction := _read_direction()
	if direction != Vector2i.ZERO:
		facing = direction
	velocity = Vector2(direction) * speed
	move_and_slide()


## Lit l'entrée et n'en garde qu'une seule direction cardinale : l'axe le plus
## poussé gagne. Un stick en diagonale donne donc la cardinale la plus proche,
## ce qui est aussi le comportement voulu pour le tactile.
static func _read_direction() -> Vector2i:
	var input := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	if input == Vector2.ZERO:
		return Vector2i.ZERO
	if absf(input.x) >= absf(input.y):
		return Vector2i(int(signf(input.x)), 0)
	return Vector2i(0, int(signf(input.y)))

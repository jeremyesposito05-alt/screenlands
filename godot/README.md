# Screenlands

Roguelite d'exploration en 2D vue de dessus, fait avec Godot 4.

Le monde est découpé en écrans fixes : une zone vaut exactement un écran, et
atteindre un bord fait passer dans la zone voisine, comme dans les premiers
Zelda. Le joueur part en expédition, s'éloigne de son point de départ, et plus
il avance sans sécuriser sa progression, plus sa récompense grandit et plus il
risque de tout perdre.

La cible est l'iPhone en orientation portrait. Le développement et les tests se
font d'abord sur PC.

## État actuel

C'est le premier prototype. Il contient exactement ce qu'il faut pour valider
le déplacement et le passage d'un écran à l'autre, et rien de plus :

- un joueur qui se déplace dans les quatre directions ;
- quatre zones fixes disposées en grille 2x2 ;
- des collisions : les murs de bordure et quelques obstacles ;
- les quatre bords d'écran, avec une porte au milieu de chacun ;
- le passage d'une zone à la zone voisine en franchissant une porte.

Ne sont **pas** implémentés, volontairement : la génération semi-procédurale,
les camps, l'XP, le loot, la progression permanente, les ennemis, le combat.
Chaque système sera validé avant d'ajouter le suivant.

## Lancer le projet

Il faut Godot 4. Le projet se déclare pour la 4.3 ; avec une autre version 4.x,
Godot proposera simplement de mettre cette mention à jour.

1. Ouvrir Godot, `Importer`, choisir le `project.godot` de ce dépôt.
2. Lancer avec F5. La scène principale est `world/world.tscn`.

La fenêtre s'ouvre en 384x832, soit la zone de 192x416 affichée à l'échelle 2 :
à l'échelle 3 (1248 px de haut), elle dépassait l'écran d'un portable.

### Commandes

Flèches directionnelles, ou ZQSD sur clavier français et WASD sur clavier
anglais (les touches sont lues par position physique, donc les deux marchent).

Le déplacement est strictement cardinal : pas de diagonale, l'axe le plus
poussé gagne.

Les actions s'appellent `move_left`, `move_right`, `move_up` et `move_down`, et
sont définies dans `Projet > Paramètres du projet > Contrôles`. Rien ne lit une
touche en dur, pour qu'un joystick tactile puisse alimenter les mêmes actions
plus tard.

La pastille en haut à gauche affiche le nom de la zone et ses coordonnées :
elle est là pour vérifier les transitions, elle disparaîtra.

## Structure

```
core/    game_config.gd   les constantes qui définissent la forme du monde
player/  player.gd/.tscn  le joueur
world/   world.gd/.tscn   charge les zones, fait passer le joueur d'un écran à l'autre
         zone.gd          la classe de base d'une zone
         zone_border.gd   la ceinture de murs et ses quatre portes
         zone_registry.gd la carte du monde : coordonnées -> scène de zone
         obstacle.tscn    un bloc plein réutilisable
zones/   les quatre zones du prototype
docs/    architecture.md  l'architecture envisagée et les choix à valider
```

## Taille d'une zone

Une zone fait 12 x 26 tuiles de 16 px, soit 192 x 416 px : un ratio 9:19.5,
exactement celui d'un iPhone récent en portrait.

C'est étroit et haut, et c'est la contrainte du format. Si ça se révèle
désagréable à jouer, les deux nombres à changer sont `ZONE_WIDTH_TILES` et
`ZONE_HEIGHT_TILES` dans `core/game_config.gd` ; tout le reste en découle, y
compris les murs et les portes. Il faut juste penser à remettre
`display/window/size` dans `project.godot` d'accord avec eux.

## Architecture

Voir [docs/architecture.md](docs/architecture.md).

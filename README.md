# Screenlands

Roguelite d'exploration en 2D vue de dessus, jouable dans le navigateur.

Le monde est découpé en écrans fixes : une zone vaut exactement un écran, et
atteindre un bord fait passer dans la zone voisine, comme dans les premiers
Zelda. Le joueur part en expédition, s'éloigne de son point de départ, et plus
il avance sans sécuriser sa progression, plus sa récompense grandit et plus il
risque de tout perdre.

La cible est l'iPhone en orientation portrait.

**Jouer :** https://jeremyesposito05-alt.github.io/screenlands/

## Pourquoi du HTML

Le premier prototype était fait avec Godot 4. Il est conservé dans
[godot/](godot/). Le jeu est passé en HTML et JavaScript pour une raison
pratique : une page web tourne telle quelle dans Safari sur iPhone, sans Mac,
sans compte développeur Apple et sans outil de compilation. On teste donc sur
le vrai téléphone à chaque modification.

## État actuel

C'est le premier prototype. Il contient exactement ce qu'il faut pour valider
le déplacement et le passage d'un écran à l'autre, et rien de plus :

- un joueur qui se déplace dans les quatre directions ;
- quatre zones fixes disposées en grille 2x2 ;
- des collisions : les murs de bordure et quelques obstacles ;
- les quatre bords d'écran, avec une porte au milieu de chacun ;
- le passage d'une zone à la zone voisine en franchissant une porte.

Les graphismes sont des rectangles de couleur, en attendant les vrais.

Ne sont **pas** implémentés, volontairement : la génération semi-procédurale,
les camps, l'XP, le loot, la progression permanente, les ennemis, le combat.
Chaque système sera validé avant d'ajouter le suivant.

## Sur iPhone

Ouvrir le lien dans Safari, puis `Partager > Sur l'écran d'accueil`. Lancé
depuis l'icône, le jeu s'ouvre en plein écran, sans la barre de Safari.

On pose le doigt n'importe où : un joystick apparaît sous le doigt, et le
joueur part dans la direction où on le fait glisser.

## Sur PC

Double-cliquer sur `index.html` suffit. Flèches directionnelles, ou ZQSD sur
clavier français et WASD sur clavier anglais : les touches sont lues par
position physique, donc les deux marchent.

Pour tester dans les conditions du site publié, `tools/serve.pl` est un petit
serveur local en Perl :

```
perl tools/serve.pl
```

puis ouvrir http://localhost:8080.

## Structure

Des scripts classiques, sans module ni compilation, chargés dans l'ordre par
`index.html`. Chacun a un rôle et un seul.

```
index.html           la page, le canvas et le joystick
src/config.js        les constantes qui définissent la forme du monde
src/zones.js         les zones, la carte du monde et la ceinture de murs
src/input.js         clavier et joystick, réduits à une direction cardinale
src/world.js         l'état du jeu et ses règles : déplacement, collisions, transitions
src/render.js        tout ce qui dessine, et rien d'autre
src/main.js          la boucle de jeu
tools/serve.pl       serveur local pour les tests
godot/               l'ancien prototype Godot, archivé
```

## Architecture

Les choix du prototype Godot sont repris tels quels ; ils sont expliqués en
détail dans [godot/docs/architecture.md](godot/docs/architecture.md).

**Une zone vaut un écran.** La résolution interne du jeu est la taille d'une
zone, 192 x 416 px. Il n'y a ni caméra ni défilement, et le repère d'une zone
est le repère de l'écran.

**Le joueur survit au changement de zone, la zone non.** `World` garde une
seule zone chargée et fait ressortir le joueur du bord opposé en gardant son
autre coordonnée. Ça ne marche que si les portes se font face, d'où la
ceinture de murs calculée par `borderWalls()` plutôt que dessinée à la main.

**La carte est derrière une seule porte.** `ZoneRegistry` répond à « quelle
zone se trouve en (x, y) ? ». La génération semi-procédurale le remplacera
sans que `World` change.

**Le rendu est séparé des règles.** `World` ne dessine rien et `Render` ne
modifie rien. Chaque élément porte un `kind` (`wall`, `rock`, `player`) :
c'est ce que le rendu lira pour choisir un sprite. Améliorer les graphismes
revient donc à réécrire `render.js`, et seulement lui.

**L'entrée passe par une direction, jamais par une touche.** `World` reçoit
`{x, y}` de `Input.direction()` et ne sait pas si elle vient du clavier ou
du doigt.

**La physique tourne à pas fixe**, 60 fois par seconde, pour que le jeu se
comporte pareil sur un écran à 60 Hz et sur un iPhone à 120 Hz.

## Taille d'une zone

Une zone fait 12 x 26 tuiles de 16 px, soit 192 x 416 px : un ratio 9:19.5,
exactement celui d'un iPhone récent en portrait.

C'est étroit et haut, et c'est la contrainte du format. Si ça se révèle
désagréable à jouer, les deux nombres à changer sont `ZONE_W_TILES` et
`ZONE_H_TILES` dans `src/config.js` ; tout le reste en découle, y compris les
murs et les portes.

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

Le deuxième prototype : la plus petite version jouable du stop ou encore,
pour savoir si la tension entre « je continue » et « je rentre » fonctionne
avant d'investir dans les graphismes et la génération.

- **Une carte de 5 x 5 écrans**, écrite à la main. Le camp de base est au
  centre, deux camps avancés sont dans les coins, au plus loin.
- **Des gemmes** dont la valeur double à chaque écran d'éloignement du camp
  de base : 1, 2, 4, 8. Elles s'ajoutent au butin porté, affiché en haut à
  droite.
- **Des ennemis qui poursuivent**, plus lents que le joueur, mais plus
  nombreux et plus rapides à mesure qu'on s'éloigne. Aucun près du camp.
- **Trois cœurs.** Mourir fait perdre tout le butin porté et ramène au camp
  de base.
- **Les feux de camp** mettent le butin porté à l'abri dans la banque et
  rendent les cœurs. Rentrer au camp de base termine l'expédition : les
  gemmes réapparaissent partout.
- **La banque** est conservée d'une partie à l'autre, dans le navigateur.
- **Une mini-carte** en haut à droite : zones vues, camps, position.

Les graphismes sont des formes de couleur, en attendant les vrais. Il n'y a
pas encore d'attaque : on esquive.

Ne sont **pas** implémentés, volontairement : la génération semi-procédurale,
l'XP, le combat, les dépenses de la banque, la progression permanente.
Chaque système sera validé avant d'ajouter le suivant.

Tous les chiffres d'équilibrage sont regroupés en bas de `src/config.js`.

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
src/physics.js       collisions entre corps et murs
src/zones.js         les zones, la carte du monde et la ceinture de murs
src/enemies.js       les ennemis : des fiches qui combinent des comportements
src/save.js          la progression permanente (la banque)
src/input.js         clavier et joystick, réduits à une direction cardinale
src/world.js         l'expédition et ses règles : gemmes, coups, camps, transitions
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

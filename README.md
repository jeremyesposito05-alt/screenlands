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

Un prototype jouable du stop ou encore, pour savoir si la tension entre
« je continue » et « je rentre » fonctionne avant d'investir dans les
graphismes.

- **Une nouvelle carte à chaque expédition.** Environ 26 écrans poussent
  depuis le camp de base, au centre d'une grille de 7 x 7, reliés par des
  portes comme un labyrinthe avec quelques boucles. Sept décors, dont
  certains réservés au loin.
- **Des portes à trois positions** : au tiers haut, au centre ou au tiers bas
  des murs latéraux, à gauche, au centre ou à droite des murs du haut et du
  bas. Deux écrans voisins partagent la position de leur porte commune : on
  ressort toujours en face. Les positions praticables de chaque décor sont
  calculées par le jeu (`doorSlots()` dans `src/zones.js`) : un décor ajouté
  plus tard est pris en compte tout seul. Le camp de base garde ses portes au
  centre, loin du portail.
- **Un seul camp à la fois, qu'il faut trouver.** Il brûle dans un écran
  quelconque, à deux à quatre écrans du départ pour le premier, et n'apparaît
  sur la mini-carte qu'une fois vu. S'en approcher met le butin porté à
  l'abri et rend les cœurs ; puis le feu s'éteint et un autre s'allume
  ailleurs, à au moins trois écrans. Passer devant sans rien à y faire ne le
  gaspille pas. Aucun ennemi autour du feu.
- **Des gemmes** dont la valeur double à chaque écran d'éloignement du camp
  de base, compté par le plus court chemin : 1, 2, 4, 8... Elles s'ajoutent
  au butin porté, affiché en haut à droite.
- **Quatre ennemis inspirés des fantômes de Pac-Man**, qui se déplacent tous
  de la même façon mais ne visent pas le même point :
  - le **Traqueur** (rouge) vise le joueur ;
  - l'**Embusqueur** (rose, dès 2 écrans) vise trois tuiles devant lui, pour
    lui couper la route, puis charge ;
  - le **Craintif** (orange, dès 3 écrans) fonce de loin mais recule vers son
    coin quand il est trop près ;
  - le **Tenailleur** (bleu, dès 4 écrans) se place à l'opposé du Traqueur,
    pour prendre le joueur en tenaille, puis charge.

  Ils trouvent leur chemin autour des obstacles, sont plus lents que le
  joueur, et plus nombreux et plus rapides à mesure qu'on s'éloigne. Aucun
  près des camps.
- **Le reste du bestiaire**, qui change la façon de jouer :
  - le **Tireur** (vert, dès 2 écrans) garde ses distances, vise une
    demi-seconde en clignotant, puis tire ; ses tirs s'arrêtent aux murs ;
  - le **Kamikaze** (rouge sombre, dès 3 écrans) fonce, allume sa mèche près
    du joueur et explose ; l'explosion blesse aussi les ennemis autour, et
    tué avant, il n'explose pas ;
  - l'**Essaim** (jaune, dès 3 écrans) : quatre petits ennemis rapides qui
    encerclent le joueur ; un coup suffit à chacun, et il ne compte que pour
    un mort et une gemme ;
  - le **Colosse** (brun, dès 4 écrans) : lent, 5 points de vie, et les
    coups ne le font pas reculer ;
  - le **Gardien**, le mini-boss : un par carte, dans un des écrans les plus
    éloignés, marqué en rouge sur la mini-carte dès le départ. Il prévient,
    puis charge en ligne droite ; vaincu, il lâche un coffre légendaire.

  Chaque ennemi assemble une règle de visée, une capacité (tirer, exploser,
  charger) et ses statistiques (`src/enemies.js`).
- **On part les mains vides**, et on fouille la carte. Dix coffres y sont
  cachés, un par écran au plus, dans un recoin du décor. Deux contiennent
  toujours une arme :
  - une arme de mêlée, à un ou deux écrans du camp de base : **Épée** (coup
    rapide et large) ou **Lance** (deux fois plus longue et plus forte,
    transperce tout ce qui est aligné, mais plus lente) ;
  - une arme à distance, à trois écrans ou plus : **Arc** (une flèche
    jusqu'au premier obstacle) ou **Boomerang** (étourdit sans blesser,
    rapporte les gemmes qu'il touche, revient dans la main).

  On tient une seule arme : en ramasser une autre fait tomber l'ancienne,
  qu'on peut revenir chercher. On frappe sans s'arrêter ; le coup suit le
  joueur. Un ennemi touché est repoussé et étourdi ; tué, il lâche une gemme
  de la valeur de la zone, et reste mort jusqu'à la fin de l'expédition.
  Au-delà de trois écrans, les ennemis encaissent deux coups.
- **Quatre raretés de coffres**, visibles de loin à leur couleur, et plus
  belles avec la distance. À l'ouverture, la chance et la menace peuvent
  faire monter un coffre d'un cran. Les élites lâchent un coffre épique.

  | Coffre | Contenu |
  |---|---|
  | Commun (gris) | un bonus : Plume (vitesse +8 %), Pierre à aiguiser (dégâts +25 %), Gantelet (cadence +12 %), Loupe (portée +15 %), Trèfle (chance +1), Aimant, Fiole (un cœur rendu) |
  | Rare (bleu) | un pouvoir, ou son niveau suivant ; un compagnon ; un artefact : Réceptacle (un cœur de plus), Bottes de vent (vitesse +15 %), Lanterne (révèle la carte et les coffres) ; ou une arme |
  | Épique (violet) | un pouvoir monté de deux niveaux, et un bonus en prime |
  | Légendaire (or) | une relique, **et un objet rare en prime** : Cœur de phénix (on revient une fois de la mort, cœurs pleins, butin gardé), Sablier (menace −2 min, puis figée 1 min), Couronne d'avarice (gemmes ×2), Étendard du roi (deux compagnons tout de suite, file de 6), Lame runique (dégâts de l'arme ×2) |

  Les bonus se cumulent ; tout passe par les caractéristiques du joueur
  (`src/stats.js`), que l'arme et les pouvoirs suivent.
- **Cinq pouvoirs automatiques**, à la Vampire Survivors, de trois niveaux
  chacun : **Traînée de feu** (le sol brûle derrière soi), **Orbe** (des
  orbes tournent autour de soi), **Éclair** (frappe l'ennemi le plus proche,
  rebondit au niveau 3), **Onde de givre** (ralentit, puis blesse),
  **Égide** (absorbe un coup, puis se recharge). Ils s'affichent en bas avec
  leur niveau.
- **Des compagnons** (prototype), à la manière des options des jeux d'avion :
  l'**Archer** tire sur l'ennemi le plus proche, le **Guerrier** frappe ce
  qui approche. Jusqu'à quatre (six avec l'Étendard du roi) suivent le joueur
  en file, sur sa trajectoire exacte, comme un serpent. Ils font mal, mais
  moins que le joueur. On les trouve dans les coffres rares.

  Ils servent aussi d'armure : **un coup reçu fait tomber le dernier de la
  file au lieu de coûter un cœur**. Le compagnon tombé reste sonné quatre
  secondes ; repasser dessus le relève, sinon il est perdu. Armes, pouvoirs
  et reliques, eux, ne se perdent jamais sur un coup.
- **Trois cœurs**, qui ne comptent que quand il n'y a plus de compagnon. On
  garde son équipement tant qu'on est en vie. Mourir fait perdre le butin
  porté et tout l'équipement, et ramène au camp de base sur une nouvelle
  carte.
- **Le camp de base** n'est qu'un point de départ, sans feu. Son portail
  lance une nouvelle expédition quand on a vidé la carte : on y garde le
  butin porté, pas l'équipement, sinon on accumulerait les artefacts de
  carte en carte.
- **Une menace qui monte.** Plus on reste hors du camp de base, plus le
  donjon devient dangereux. La jauge du haut monte d'un cran toutes les
  90 secondes :
  1. des **élites** apparaissent (couronne dorée, deux fois plus solides,
     elles lâchent un objet en plus de leur gemme) ;
  2. les ennemis tués **se relèvent** au bout d'une minute ;
  3. et 4. ils sont plus nombreux et plus rapides à chaque cran ;
  5. le **Chasseur** arrive : invincible, insensible au boomerang, il suit
     le joueur d'écran en écran et entre par la même porte que lui. Il ne
     passe ni au camp de base ni autour du feu.

  Se reposer au camp fait redescendre la menace d'une minute ; sous le
  dernier cran, le Chasseur perd la trace.
- **La banque** est conservée d'une partie à l'autre, dans le navigateur.
- **Une mini-carte** en haut à droite : camp de base, écrans visités et leurs
  portes, écrans entrevus derrière, camp s'il a été vu, coffres non ouverts,
  position.

Les graphismes sont des formes de couleur, en attendant les vrais.

Ne sont **pas** implémentés, volontairement : l'XP, les dépenses de la
banque, la progression permanente, le glissement d'écran.
Chaque système sera validé avant d'ajouter le suivant.

Tous les chiffres d'équilibrage sont regroupés en bas de `src/config.js`.

## Menus et bac à sable

Le jeu s'ouvre sur un **menu principal** : Jouer, Bac à sable, choix des
commandes, banque et meilleur butin. En jeu, le bouton **II** en haut à
gauche met en pause : reprendre, changer de commandes, abandonner
l'expédition (avec confirmation). Le jeu se met aussi en pause tout seul
quand le téléphone passe à autre chose.

Le **bac à sable** sert à tout essayer sans avoir à le trouver. On y est
invincible, et ce qu'on y gagne ne va pas à la banque. Le bouton 🛠 ouvre
les outils : invincibilité, soin, n'importe quelle arme, le niveau de chaque
pouvoir, bonus et reliques à volonté, apparition de chaque ennemi (en élite
si on veut) et du Chasseur, « tout tuer », cran de menace et menace figée,
un coffre de chaque rareté, aller au camp, nouvelle carte. Les outils
passent par les mêmes règles que le jeu : ce qu'on y teste est ce qu'on
joue.

## Sur iPhone

Ouvrir le lien dans Safari, puis `Partager > Sur l'écran d'accueil`. Lancé
depuis l'icône, le jeu s'ouvre en plein écran, sans la barre de Safari.

Deux modes de commande, au choix, dans le menu principal ou la pause (le
choix est retenu) :

- **Glisser** (par défaut). Le personnage court tout seul dans la dernière
  direction donnée et s'arrête contre un mur, à la manière de *Tomb of the
  Mask*. On glisse le doigt pour changer de direction, on touche l'écran
  sans glisser pour frapper, on maintient le doigt immobile pour s'arrêter.
  Un virage demandé contre un mur est gardé en mémoire 0,8 s et pris dès que
  le passage s'ouvre, comme dans Pac-Man.
- **Joystick**. Un joystick apparaît sous le doigt ; tiré trop loin, il suit
  le doigt, et la flèche de la direction retenue s'allume. Dès qu'on a trouvé
  une arme, un bouton à son image apparaît en bas à droite.

Dans les deux modes, une aide aux angles aligne le personnage sur une porte
ou un passage quand il arrive à quelques pixels près.

## Sur PC

Double-cliquer sur `index.html` suffit. Flèches directionnelles, ou ZQSD sur
clavier français et WASD sur clavier anglais : les touches sont lues par
position physique, donc les deux marchent. Espace, J ou Entrée pour
frapper. En mode glisser, une flèche donne la direction de course ; en mode
joystick, on maintient la flèche.

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
src/random.js        hasard à graine : une même graine redonne la même carte
src/zones.js         les décors, la carte chargée et la ceinture de murs
src/generator.js     tire une carte neuve à chaque expédition, et y cache les coffres
src/items.js         tous les objets, décrits par des données, et les tables de butin
src/stats.js         les caractéristiques du joueur, calculées à un seul endroit
src/powers.js        les pouvoirs automatiques
src/loot.js          la rareté des coffres et le tirage de leur contenu
src/nav.js           plus court chemin des ennemis autour des obstacles
src/enemies.js       les ennemis : visée, capacité et statistiques assemblées
src/save.js          la progression permanente (la banque)
src/input.js         clavier et tactile : modes glisser et joystick
src/weapons.js       les armes en action : coups de mêlée et projectiles
src/allies.js        les compagnons : la file, leurs attaques, la chute et le relèvement
src/world.js         l'expédition et ses règles : gemmes, coups, camps, transitions
src/render.js        tout ce qui dessine, et rien d'autre
src/menu.js          menu principal, pause et outils du bac à sable
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
zone se trouve en (x, y), à quelle distance, avec quelles portes ? ».
`Generator` lui confie une carte neuve à chaque expédition ; `World` ne sait
pas d'où elle vient. Le générateur n'invente pas de décor : il assemble des
décors dessinés à la main, ce qui garde chaque écran jouable à coup sûr.

**Les ennemis ne diffèrent que par leur cible.** Comme les fantômes de
Pac-Man, tous se déplacent pareil (le plus court chemin, calculé par `Nav`) ;
chaque type choisit seulement le point qu'il vise. Un nouvel ennemi est une
fiche de plus dans `Enemies.TYPES`, et une nouvelle manœuvre une règle de
plus dans `TARGETS`.

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

Une zone fait 26 tuiles de 16 px de haut (416 px). Sa largeur **s'adapte à
l'écran** au lancement, pour le remplir sans bandes sur les côtés : au moins
192 px (un ratio 9:19.5), 216 px sur un iPhone récent une fois l'encoche et
la barre d'accueil retirées, au plus 288 px. Sous l'encoche et la barre
d'accueil, la couleur des murs prolonge le jeu jusqu'au bord de l'écran.

Les décors sont dessinés pour 192 px et centrés : un écran plus large a
simplement plus de sol sur les côtés. Toutes leurs coordonnées passent par
`obstacle()`, `block()` et `p()` dans `src/zones.js`, qui ajoutent ce
décalage ; murs et portes sont calculés depuis la largeur réelle.

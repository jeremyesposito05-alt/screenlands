# Screenlands — audit complet et feuille de route (6 octobre 2026)

Le concept est verrouillé : un roguelite écran par écran, à une main, où l'on
s'enfonce dans un labyrinthe pour ramener du butin avant que la menace ne
monte trop. Cet audit dit ce qui tient, ce qui casse, et propose la suite en
phases, de la plus rentable à la plus longue.

## 1. Diagnostic

### Ce qui tient

- **Le moteur.** 100 ennemis à l'écran coûtent moins de 1 ms de physique et
  2,5 ms de dessin sur PC (mesuré) : de la marge pour des hordes, même sur
  téléphone.
- **La boucle « stop ou encore »**, la menace, le camp qui se déplace, les
  compagnons, l'atelier : chaque système marche et se combine aux autres.
- **Les deux modes de commande**, et le passage des portes.
- **La chaîne graphique** : planche dessinée, convertisseur, sprites, rendu en
  couches avec lumière. Ajouter une image ne demande plus de code.

### Ce qui casse

| Problème | Constat | Effet |
|---|---|---|
| **Économie** | Une gemme vaut 2^(distance−1) : 1 près du camp de base, 256 au bout. L'atelier entier coûte 4 840 💎. | Une bonne partie (4 000 💎) achète presque tout : plus rien à viser. |
| **Atelier trop court** | 10 améliorations, 1 à 3 niveaux. | La progression permanente s'arrête au bout de 2 parties. |
| **Difficulté plate** | 0 à 4 ennemis par salle, une seule carte de 26 écrans, aucun palier au-delà de la menace. | Une fois équipé, plus rien ne résiste, mais sans la jubilation de tout raser. |
| **Peu de variété** | 8 décors, un seul biome, 10 ennemis, 4 armes, 5 pouvoirs. | Au bout de quelques parties, on a tout vu. |
| **Animation** | Le héros a 3 images par vue, presque identiques. Les ennemis n'ont qu'une image, ils sautillent. | Le jeu paraît figé dès qu'on regarde de près. |
| **Lisibilité** | Les ennemis à 16 px se reconnaissent surtout à leur couleur. Certaines icônes sont brouillonnes. Il manque l'égide et les 5 reliques. | Sur iPhone, on devine plus qu'on ne voit. |
| **Code** | `render.js` fait plus de 1 300 lignes et `world.js` 1 000. | Ça tient, mais chaque ajout coûtera plus cher si on ne découpe pas. |

## 2. La vision : « le labyrinthe qu'on finit par raser »

Le modèle de Vampire Survivors tient en une courbe : **faible et traqué au
début, monstrueux à la fin, et on y prend plaisir.** Pour Screenlands :

1. **Une descente par étages** plutôt qu'une carte unique. Chaque étage est une
   carte (un biome), avec un Gardien qui garde l'escalier. Plus on descend,
   plus les gemmes valent cher, plus les ennemis sont nombreux et solides.
   Le « stop ou encore » devient : *je remonte mettre mon butin à l'abri, ou
   je descends encore ?*
2. **Des hordes.** Beaucoup d'ennemis faibles (« fourrage ») en plus des
   ennemis à comportement. On les fauche par dizaines, les gemmes giclent :
   c'est ça, la satisfaction de tout casser.
3. **Une puissance qui explose en cours de partie** (pouvoirs qui montent
   jusqu'au niveau 5, évolutions quand on combine certains objets), et **une
   progression permanente longue** (atelier profond, déblocages).

## 3. Les chantiers

### Phase A — Économie et difficulté (court, gros effet immédiat)

- **Courbe des gemmes adoucie** : par exemple 1 + distance, multipliée par
  l'étage, au lieu de doubler à chaque écran.
- **Atelier profond** : 5 à 10 niveaux par amélioration, prix qui montent
  vite. Nouvelles lignes : armure (réduit les coups), récupération (soin au
  camp), rayon de ramassage, cadence des compagnons, coffres en plus par
  carte, relance du contenu d'un coffre, durée de la menace.
- **Déblocages** dans l'atelier : nouvelles armes et nouveaux pouvoirs à
  ajouter au butin des coffres, personnages de départ, biomes. On achète du
  contenu, pas seulement des chiffres.
- **Difficulté par étage** : nombre, vitesse et points de vie des ennemis
  indexés sur l'étage. Plus de fourrage à mesure qu'on descend.
- **Réglage de la mort** : perdre le butin porté reste la règle, mais un
  « coffre-fort » de l'atelier permet d'en sauver une part.

### Phase B — Plus de jeu (le cœur du contenu)

**Ennemis** : passer de 10 à environ 25, répartis par biome. Chacun doit
changer la façon de jouer.

| Idée | Ce qu'il impose |
|---|---|
| Fourrage (rats, slimes) | des hordes à faucher |
| Porte-bouclier | invulnérable de face : il faut le contourner |
| Mage | se téléporte et lance une zone au sol |
| Assassin | vise le dernier compagnon de la file |
| Nid / générateur | fait naître des ennemis tant qu'on ne le casse pas |
| Tourelle | fixe, tire en éventail : on traverse ses angles morts |
| Fantôme | traverse les murs, lent |
| Mimique | un faux coffre qui mord |
| Sangsue | colle au héros et le ralentit |
| Un boss par biome | une salle verrouillée, des phases |

**Armes et pouvoirs** : fouet, hache qui tourne, bâton de foudre, dagues en
éventail, bombe. Pouvoirs jusqu'au niveau 5, et **évolutions** : une arme et
une relique précises combinées donnent une version ultime, comme dans
Vampire Survivors.

**Salles spéciales** (déjà esquissées ensemble), signalées sur la mini-carte :

- arène verrouillée (vagues) ;
- traînée de Snake ;
- dalles à colorier ;
- glace ;
- marchand (dépenser le butin porté) ;
- autel (sacrifier un cœur contre une relique) ;
- cage de prisonnier (un compagnon à libérer) ;
- salle au trésor piégée.

### Phase C — Le monde

- **Biomes** : Forêt (l'actuel), Ruines englouties, Village de nuit, Crypte,
  Cavernes de cristal. Chacun a son sol, ses bordures, ses éléments qui
  débordent, sa lumière, ses ennemis et sa musique.
- **Beaucoup plus de salles** : passer de 8 à 25–30 décors, et les varier
  automatiquement (miroir, obstacles déplacés, éléments semés), pour qu'aucune
  salle ne se répète à l'identique.
- **Une structure en étages** : camp de base, puis étage 1, Gardien, étage 2…
  Le portail du camp de base mène au plus profond étage déjà atteint.

### Phase D — Les graphismes

**Le héros**, priorité absolue : une vraie fiche d'animations.

| Animation | Images | Vues |
|---|---|---|
| Immobile (respiration) | 2–4 | face, dos, profil |
| Marche | 4–6 | face, dos, profil |
| Attaque | 3–4 | face, dos, profil |
| Coup reçu | 2 | une suffit |
| Mort | 4–6 | une suffit |
| Ruée ou roulade (si on l'ajoute) | 4 | 3 |

Méthode : planches ChatGPT en grille sur fond uni, comme la dernière (qui a
marché), puis retouche à la main des images qui bavent. Le moteur doit
d'abord apprendre à jouer des animations nommées (voir phase E).

**Les ennemis** : 2 à 4 images de marche chacun, et une pose de préparation
pour ceux qui tirent ou chargent. Des silhouettes plus marquées, pour qu'on
les distingue à la forme et pas seulement à la couleur.

**Le décor** : par biome, une planche de bordures (haies, murs, falaises),
6 à 10 éléments qui débordent sur la salle, 6 détails de sol, 2 sols. Des
éléments animés : herbe qui ondule, torches, lucioles, eau.

**Les effets**, qui font la moitié du plaisir de casser :

- éclats et poussière à l'impact ;
- chiffres de dégâts ;
- arrêt sur image à chaque ennemi abattu ;
- gemmes qui jaillissent ;
- glissement d'écran au passage des portes ;
- traînée de course.

**L'interface** : une police pixel, des cœurs et une jauge dessinés, et un
écran titre illustré.

### Phase E — Technique (au fil de l'eau, invisible mais nécessaire)

- **Découper le rendu** : décor, personnages, effets, interface.
- **Un système d'animation générique** : chaque personnage décrit ses
  animations (nom, images, vitesse, boucle ou non) dans une fiche, et le
  rendu les joue sans code spécial.
- **Des données de biome** : décors, ennemis, sprites et musique déclarés par
  biome.
- **Une page de tests automatiques** : génération de 500 cartes, salles
  atteignables, partie au hasard. Aujourd'hui je les relance à la main.
- **Vérifier la tenue sur iPhone** avec 100 ennemis et la lumière.

## 4. Ordre recommandé

1. **Phase A** (une ou deux séances) : on répare l'économie et la difficulté
   tout de suite, puisque tu viens de vider l'atelier.
2. **Système d'animation (E) + héros complet (D)** : l'effet visuel le plus
   fort, et ça prépare le terrain pour les ennemis.
3. **Effets d'impact et hordes (D + B)** : le plaisir de tout raser.
4. **Étages et 2ᵉ biome (C)**, avec ses ennemis et son boss.
5. **Salles spéciales et nouvelles armes (B)**, puis les biomes suivants.

## 5. Décisions à prendre

1. **Étages successifs ou une seule grande carte ?** Je recommande les étages :
   ils donnent la difficulté qui monte et la descente comme « stop ou encore ».
2. **Des hordes de fourrage ?** Je recommande oui, c'est le cœur du plaisir de
   casser.
3. **La mort** : on garde la perte totale du butin porté, avec un coffre-fort
   à acheter, ou on adoucit dès le départ ?
4. **Le titre** : on garde Screenlands pendant le développement, et on tranche
   avant toute diffusion.

## 6. Décisions de Jeremy (6 octobre 2026)

- **Étages : oui.** L'escalier qui descend est à trouver, celui qui remonte à
  retrouver. Chaque étage est nettement plus dur. Revenir sur un étage quitté
  fait réapparaître **tous** ses monstres.
- **Camps** : le camp de base reste à la surface ; un nouveau camp à partir du
  troisième étage. Un bonus à débloquer : **un camp portatif**, utilisable une
  fois où l'on veut (la salle devient sûre, la menace recule).
- **Hordes : oui**, et surtout **multiplier le ressenti Pac-Man** : des rôdeurs
  collants qu'on fuit. **Super-gemme** : les rôdeurs deviennent bleus, fuient,
  et on peut les attraper.
- **Mort** : trois modes choisis avant chaque expédition — facile (on garde
  tout, gemmes ×0,5), normal (on garde 25 %, jusqu'à 60 % avec le
  coffre-fort), difficile (on perd tout, gemmes ×1,5, améliorations réservées).
- **Titre de travail : LabyRun Survivor.**

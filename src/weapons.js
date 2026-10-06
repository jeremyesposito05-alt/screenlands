"use strict";

// Les armes en action : coups de mêlée et projectiles.
//
// World décide quand on attaque et avec quoi ; ce module fait le reste. Deux
// mécaniques couvrent toutes les armes décrites dans ITEMS :
//
// - `melee` : une zone de coup devant le joueur, qui le suit s'il bouge. Le
//   joueur ne s'arrête jamais pour frapper ; seule la direction du coup est
//   fixée le temps du mouvement.
// - `shot` : un projectile qui file tout droit. La flèche s'arrête au premier
//   mur ou au premier ennemi ; le boomerang va jusqu'à sa portée ou au premier
//   mur, puis revient vers le joueur en traversant tout, et il étourdit et
//   ramasse les gemmes au passage.
//
// Un ennemi n'est touché qu'une fois par coup ou par projectile.

const Weapons = (() => {
  // Lance l'arme `w` (une fiche de ITEMS). Renvoie false si elle n'est pas
  // prête : délai du coup précédent, ou boomerang pas encore revenu.
  function use(state, w) {
    const p = state.player;
    if (p.attackCooldown > 0) return false;
    if (w.returns && state.projectiles.some((s) => s.returns)) return false;
    p.attackCooldown = w.cooldown;

    if (w.mode === "melee") {
      p.attack = w.time;
      state.swing = { kind: "swing", weapon: w, dir: { ...p.facing }, hit: new Set(), x: 0, y: 0, w: 0, h: 0 };
      placeSwing(state);
    } else {
      state.projectiles.push({
        kind: w.projectile,
        weapon: w,
        x: p.x + p.facing.x * (p.size / 2),
        y: p.y + p.facing.y * (p.size / 2),
        size: w.size,
        dir: { ...p.facing },
        travelled: 0,
        back: false,
        returns: !!w.returns,
        hit: new Set(),
      });
    }
    return true;
  }

  // La zone du coup, recalculée à chaque image depuis la position du joueur :
  // on peut frapper en courant.
  function placeSwing(state) {
    const s = state.swing, p = state.player, w = s.weapon, f = s.dir;
    const cx = p.x + f.x * (p.size / 2 + w.reach / 2);
    const cy = p.y + f.y * (p.size / 2 + w.reach / 2);
    s.w = f.x ? w.reach : w.width;
    s.h = f.x ? w.width : w.reach;
    s.x = cx - s.w / 2;
    s.y = cy - s.h / 2;
  }

  // Fait avancer coups et projectiles. `events` reçoit ce qui intéresse World :
  // kill(enemy) quand un ennemi meurt, collect(gem) quand le boomerang ramasse
  // une gemme.
  function update(state, dt, events) {
    const p = state.player;

    if (state.swing) {
      p.attack -= dt;
      placeSwing(state);
      const s = state.swing;
      strikeAll(state, s, s.dir, s.weapon, (e) => Physics.overlapsRect(e, s), events);
      if (p.attack <= 0) state.swing = null;
    }

    state.projectiles = state.projectiles.filter((s) => {
      const w = s.weapon;
      const step = w.speed * dt;

      if (s.back) {
        // Retour : droit vers le joueur, à travers tout.
        const dx = p.x - s.x, dy = p.y - s.y;
        const d = Math.hypot(dx, dy);
        if (d <= step + p.size / 2) return false;
        s.x += (dx / d) * step;
        s.y += (dy / d) * step;
      } else {
        s.x += s.dir.x * step;
        s.y += s.dir.y * step;
        s.travelled += step;
        const inWall = state.solids.some((r) => Physics.overlapsRect(s, r));
        const outside = s.x < 0 || s.y < 0 || s.x > Config.ZONE_W || s.y > Config.ZONE_H;
        if (inWall || outside || (w.range && s.travelled >= w.range)) {
          if (!s.returns) return false;
          s.back = true;
        }
      }

      const hitSomeone = strikeAll(state, s, s.dir, w, (e) => Physics.overlapsBody(e, s), events);
      // La flèche s'arrête dans le premier ennemi touché.
      if (hitSomeone && !s.returns) return false;

      if (w.collects) {
        state.gems = state.gems.filter((g) => {
          if (!Physics.overlapsBody(g, s)) return true;
          events.collect(g);
          return false;
        });
      }
      return true;
    });
  }

  // Frappe tous les ennemis que `touches` désigne et que ce coup n'a pas déjà
  // frappés. Renvoie true si au moins un a été touché.
  function strikeAll(state, source, dir, w, touches, events) {
    let any = false;
    state.enemies = state.enemies.filter((e) => {
      if (source.hit.has(e) || !touches(e)) return true;
      source.hit.add(e);
      any = true;
      if (!w.damage) {
        Enemies.stun(e, w.stun);
        return true;
      }
      if (!Enemies.hit(e, dir, state.solids, w.damage, w.knockback)) {
        if (events.hit) events.hit(e);
        return true;
      }
      events.kill(e);
      return false;
    });
    return any;
  }

  return { use, update };
})();

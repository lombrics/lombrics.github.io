// Simulation du jeu. L'hôte (ou la partie locale) fait autorité ;
// les invités reçoivent des instantanés et des événements.
(function () {
  const { W, WATER } = L;
  const R = 10;          // rayon d'un lombric
  const G = 0.22;        // gravité (px/tick²)
  const TURN_TIME = 45;
  const RETREAT_TIME = 4;
  L.R = R;

  L.WEAPONS = [
    { id: 'baguette', name: 'Lance-Baguette', icon: '🥖', mode: 'charge', ammo: -1, desc: 'Roquette boulangère croustillante. Sensible au vent.' },
    { id: 'poule', name: 'Poule Grenade', icon: '🐔', mode: 'charge', ammo: -1, desc: 'Rebondit en caquetant puis explose (3 s).' },
    { id: 'pasteque', name: 'Pastèque à Pépins', icon: '🍉', mode: 'charge', ammo: 3, desc: 'Éclate en pépins explosifs. Très juteux.' },
    { id: 'confettis', name: 'Pistolet à Confettis', icon: '🎉', mode: 'instant', ammo: -1, desc: 'Tir direct festif. Vise, appuie, c\'est la fête.' },
    { id: 'poisson', name: 'Baffe de Poisson', icon: '🐟', mode: 'instant', ammo: -1, desc: 'Une claque humide au corps à corps.' },
    { id: 'fromage', name: 'Raclette Roulante', icon: '🧀', mode: 'instant', ammo: 2, desc: 'Roule toute seule. Rappuie sur Espace pour la faire fondre.' },
    { id: 'saucisse', name: 'Saucisse-Dynamite', icon: '🌭', mode: 'instant', ammo: 2, desc: 'Pose-la à tes pieds et cours ! (4 s)' },
    { id: 'escargot', name: 'Escargot à Réaction', icon: '🐌', mode: 'homing', ammo: 2, desc: 'Clique une cible, puis tire : il la poursuit.' },
    { id: 'chaussettes', name: 'Pluie de Chaussettes', icon: '🧦', mode: 'target', ammo: 2, desc: 'Bombardement odorant. Clique sur la cible.' },
    { id: 'piano', name: 'Piano à Queue', icon: '🎹', mode: 'target', ammo: 1, desc: 'Tombe du ciel. Fortissimo garanti.' },
    { id: 'trounoir', name: 'Trou Noir de Poche', icon: '🌀', mode: 'charge', ammo: 1, desc: 'Aspire tout le monde… puis PLOP.' },
    { id: 'disco', name: 'Boule Disco', icon: '🪩', mode: 'charge', ammo: 2, desc: 'Rebondit en rythme. Souffle énorme.' },
    { id: 'teleport', name: 'Téléporteur à Pizza', icon: '🍕', mode: 'target', ammo: 2, desc: 'Clique pour te téléporter (livraison express).' },
    { id: 'sieste', name: 'Sieste', icon: '😴', mode: 'instant', ammo: -1, desc: 'Passer son tour. Zzz…' },
  ];
  L.WEAPON = Object.fromEntries(L.WEAPONS.map((w) => [w.id, w]));

  // comportement des projectiles
  const PROJ = {
    baguette: { r: 4, wind: 1, bounce: -1, boom: [50, 45], rot: 'vel', icon: '🥖', size: 22 },
    poule: { r: 6, wind: 0.4, bounce: 0.5, fuse: 180, boom: [55, 50], icon: '🐔', size: 20 },
    pasteque: { r: 7, wind: 0.4, bounce: 0.4, fuse: 150, boom: [40, 25], frag: true, icon: '🍉', size: 22 },
    pepin: { r: 3, wind: 0.3, bounce: -1, boom: [24, 18], icon: '🫘', size: 10, kind: 'pepin' },
    fromage: { r: 8, walker: true, fuse: 480, boom: [70, 60], icon: '🧀', size: 22, kind: 'fromage' },
    saucisse: { r: 6, wind: 0, bounce: 0.15, fuse: 240, boom: [75, 65], icon: '🌭', size: 22 },
    escargot: { r: 5, wind: 0.2, bounce: -1, fuse: 420, boom: [50, 45], homing: true, rot: 'vel', icon: '🐌', size: 20 },
    chaussette: { r: 5, wind: 2.2, bounce: -1, grav: 0.12, boom: [34, 22], icon: '🧦', size: 20, kind: 'chaussette' },
    piano: { r: 16, wind: 0, bounce: -1, grav: 0.3, boom: [80, 70], icon: '🎹', size: 40, kind: 'piano' },
    trounoir: { r: 7, wind: 0.3, bounce: 0.3, fuse: 90, vortex: 150, boom: [60, 40], icon: '🌀', size: 20, kind: 'trounoir' },
    disco: { r: 7, wind: 0.3, bounce: 0.82, fuse: 240, boom: [55, 30], force: 2.3, icon: '🪩', size: 22, kind: 'disco' },
  };
  L.PROJ = PROJ;

  const NAMES = ['Gluglu', 'Spaghetto', 'Mme Patate', 'Raoul', 'Biscotte', 'Tonton Ver', 'Cornichon', 'Zézette',
    'Moustache', 'Pistache', 'Croûton', 'Gédéon', 'Brioche', 'Nougat', 'Choupette', 'Bidule', 'Ratatouille',
    'Paillasson', 'Cacahuète', 'Gaston', 'Mimolette', 'Pépito', 'Saperlipopette', 'Tartiflette'];
  L.TEAM_COLORS = ['#ff4d6d', '#3a86ff', '#2fbf4a', '#ffbe0b'];
  L.TEAM_NAMES = ['Équipe Fraise', 'Équipe Myrtille', 'Équipe Pistache', 'Équipe Banane'];

  const QUIPS = {
    turn: ['À toi, {n} !', '{n}, montre-leur !', 'Allez {n}, fais-nous rêver !', '{n} entre en piste !', '{n} a faim de victoire !'],
    death: ['{n} part manger les pissenlits par la racine.', '{n} a rejoint le grand compost.', 'Adieu {n}, tu étais un bon lombric.', '{n} se transforme en engrais bio.'],
    drown: ['{n} a bu la tasse !', '{n} part faire de la plongée… pour toujours.', 'Glou glou, {n}.', '{n} nage comme une enclume.'],
    sieste: ['{n} fait la sieste. Zzz…', '{n} a besoin d\'un câlin et d\'une sieste.'],
  };
  L.QUIPS = QUIPS;

  // offsets précalculés pour tester un cercle contre le terrain
  const OFF = {};
  function offs(r) {
    if (OFF[r]) return OFF[r];
    const n = Math.max(8, Math.round(r * 1.6)), a = [];
    for (let i = 0; i < n; i++) a.push([Math.cos((i / n) * Math.PI * 2) * r, Math.sin((i / n) * Math.PI * 2) * r]);
    return (OFF[r] = a);
  }
  const SUPPORT = [];
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI * (0.18 + (0.64 * i) / 8);
    SUPPORT.push([Math.cos(a), Math.sin(a)]);
  }

  const r1 = (v) => Math.round(v * 10) / 10;
  const r2 = (v) => Math.round(v * 100) / 100;

  L.Game = class {
    constructor(cfg, role) {
      this.role = role;
      this.auth = role !== 'client';
      this.seed = cfg.seed;
      this.perTeam = cfg.perTeam || 3;
      this.terrain = new L.Terrain(cfg.seed);
      this.theme = this.terrain.theme;
      this.teams = cfg.teams.map((t) => ({
        name: t.name, color: t.color, owner: t.owner, gone: false, last: -1, weapon: 'baguette',
        ammo: Object.fromEntries(L.WEAPONS.map((w) => [w.id, w.ammo])),
      }));
      this.worms = [];
      this.proj = [];
      this.pid = 0;
      this.frame = 0;
      this.inputs = {};
      this.prevIn = {};
      this.events = [];
      this.onFx = () => {};
      this.wind = 0;
      if (cfg.worms) cfg.worms.forEach((w) => this.addWorm(w.team, w.name, w.x, w.y));
      else this.spawnWorms(this.perTeam);
      this.turn = { team: 0, worm: 0, phase: 'wait', timer: TURN_TIME, retreat: 0, weapon: 'baguette', charge: 0, charging: false, target: null, winner: -1 };
    }

    // ---------- création ----------
    addWorm(team, name, x, y) {
      this.worms.push({
        id: this.worms.length, team, name, x, y, tx: x, ty: y, vx: 0, vy: 0, hp: 100,
        dead: false, drowned: false, facing: x < W / 2 ? 1 : -1, aim: -0.4, grounded: false, walking: false,
      });
    }

    spawnWorms(per) {
      const names = L.shuffle(NAMES);
      let ni = 0;
      for (let k = 0; k < per; k++) {
        for (let t = 0; t < this.teams.length; t++) {
          const p = this.findSpot();
          this.addWorm(t, names[ni++ % names.length], p.x, p.y);
        }
      }
    }

    findSpot() {
      for (let tries = 0; tries < 1500; tries++) {
        const x = 150 + Math.random() * (W - 300);
        let y = 0;
        while (y < WATER && !this.circleSolid(x, y, R)) y += 2;
        if (y < 30 || y > WATER - 80) continue;
        const minD = tries < 1000 ? 90 : 30;
        if (this.worms.some((w) => Math.hypot(w.x - x, w.y - y) < minD)) continue;
        return { x, y: y - 2 };
      }
      return { x: W / 2, y: 100 };
    }

    start() {
      this.turn.team = Math.floor(Math.random() * this.teams.length) - 1;
      if (this.turn.team < 0) this.turn.team = this.teams.length - 1;
      this.nextTurn();
    }

    // ---------- outils ----------
    emit(ev) {
      this.onFx(ev);
      if (this.role === 'host') this.events.push(ev);
    }
    hint(owner, s) { this.emit({ t: 'hint', o: owner, s }); }

    circleSolid(x, y, r) {
      const t = this.terrain;
      if (t.isSolid(x, y)) return true;
      for (const [dx, dy] of offs(r)) if (t.isSolid(x + dx, y + dy)) return true;
      return false;
    }
    supportedAt(x, y, r) {
      const t = this.terrain;
      for (const [cx, cy] of SUPPORT) if (t.isSolid(x + cx * (r + 2), y + cy * (r + 2))) return true;
      return false;
    }
    aimDir(w) {
      const a = w.facing > 0 ? w.aim : Math.PI - w.aim;
      return { x: Math.cos(a), y: Math.sin(a) };
    }
    activeWorm() { return this.worms[this.turn.worm]; }
    teamAlive(i) { return !this.teams[i].gone && this.worms.some((w) => w.team === i && !w.dead && w.hp > 0); }

    reflect(o, nm, e, fr = 0.85) {
      const vn = o.vx * nm.x + o.vy * nm.y;
      if (vn < 0) { o.vx -= (1 + e) * vn * nm.x; o.vy -= (1 + e) * vn * nm.y; }
      o.vx *= fr; o.vy *= fr;
    }

    // ---------- actions ----------
    action(owner, a) {
      const T = this.turn, team = this.teams[T.team];
      if (!team || team.owner !== owner || !a) return;
      const w = this.activeWorm();
      if (a.a === 'weapon') {
        if (T.phase !== 'aim' || T.charging || !L.WEAPON[a.id]) return;
        T.weapon = a.id; team.weapon = a.id; T.target = null;
        return;
      }
      if (a.a === 'click') {
        if (T.phase !== 'aim' || !w || w.dead) return;
        const x = +a.x, y = +a.y;
        if (!isFinite(x) || !isFinite(y)) return;
        const wp = L.WEAPON[T.weapon];
        if (team.ammo[wp.id] === 0) return this.hint(owner, 'Plus de munitions !');
        if (wp.mode === 'target') this.fire(wp, w, 1, { x, y });
        else if (wp.mode === 'homing') {
          T.target = { x: Math.round(x), y: Math.round(y) };
          this.hint(owner, 'Cible verrouillée ! Maintiens Espace pour tirer.');
        }
      }
    }

    markGone(ti) {
      if (!this.teams[ti] || this.teams[ti].gone) return;
      this.teams[ti].gone = true;
      this.emit({ t: 'gone', i: ti });
      this.emit({ t: 'msg', s: `${this.teams[ti].name} a quitté la partie 👋` });
      if (this.turn.team === ti && (this.turn.phase === 'aim' || this.turn.phase === 'retreat')) this.toSettle();
    }

    // ---------- boucle ----------
    tick() {
      this.frame++;
      const T = this.turn;
      if (T.phase === 'over' || T.phase === 'wait') { this.physics(); return; }
      const team = this.teams[T.team];
      const w = this.activeWorm();
      const inp = this.inputs[team.owner] || {};
      const prev = this.prevIn[team.owner] || {};
      const pressed = (k) => inp[k] && !prev[k];

      if (T.phase === 'aim' || T.phase === 'retreat') {
        if (T.phase === 'aim') T.timer -= 1 / 60; else T.retreat -= 1 / 60;
        if (w && !w.dead && w.hp > 0) this.control(w, team, inp, pressed);
        if (T.phase === 'aim' && T.timer <= 0) this.toSettle();
        else if (T.phase === 'retreat' && T.retreat <= 0) this.toSettle();
      }
      this.prevIn[team.owner] = Object.assign({}, inp);

      this.physics();
      if (T.phase === 'settle') this.updateSettle();
    }

    control(w, team, inp, pressed) {
      const T = this.turn;
      w.walking = false;
      if (w.grounded) {
        if (!T.charging) {
          if (inp.l) { this.walk(w, -1); w.walking = true; }
          else if (inp.r) { this.walk(w, 1); w.walking = true; }
        }
        if (w.grounded && !T.charging) {
          if (pressed('jump')) { w.vx = w.facing * 2.6; w.vy = -4.6; w.grounded = false; this.emit({ t: 'sfx', n: 'jump' }); }
          else if (pressed('bjump')) { w.vx = -w.facing * 1.1; w.vy = -6.6; w.grounded = false; this.emit({ t: 'sfx', n: 'jump2' }); }
        }
      }
      if (T.phase === 'retreat') {
        if (pressed('fire')) {
          const ch = this.proj.find((p) => p.type === 'fromage' && p.owner === w.id);
          if (ch) this.detonate(ch);
        }
        return;
      }
      // visée
      if (inp.u) w.aim = Math.max(-1.55, w.aim - 0.025);
      if (inp.d) w.aim = Math.min(1.55, w.aim + 0.025);
      const wp = L.WEAPON[T.weapon];
      if (team.ammo[wp.id] === 0) { if (pressed('fire')) this.hint(team.owner, 'Plus de munitions ! Change d\'arme.'); return; }
      if (wp.mode === 'charge' || wp.mode === 'homing') {
        if (wp.mode === 'homing' && !T.target) {
          if (pressed('fire')) this.hint(team.owner, 'Clique d\'abord sur une cible !');
          return;
        }
        if (pressed('fire') && !T.charging) { T.charging = true; T.charge = 0; }
        if (T.charging) {
          T.charge += 1 / 80;
          if (!inp.fire || T.charge >= 1) this.fire(wp, w, Math.min(1, T.charge));
        }
      } else if (wp.mode === 'instant') {
        if (pressed('fire')) this.fire(wp, w, 1);
      } else if (wp.mode === 'target') {
        if (pressed('fire')) this.hint(team.owner, 'Clique sur la carte pour viser !');
      }
    }

    walk(w, dir) {
      w.facing = dir;
      const nx = w.x + dir * 0.9;
      let moved = false;
      for (let dy = 0; dy <= 6; dy++) {
        if (!this.circleSolid(nx, w.y - dy, R)) { w.x = nx; w.y -= dy; moved = true; break; }
      }
      if (!moved) return;
      let fell = 0;
      while (!this.supportedAt(w.x, w.y, R) && fell < 5 && !this.circleSolid(w.x, w.y + 1, R)) { w.y += 1; fell++; }
      if (!this.supportedAt(w.x, w.y, R)) { w.grounded = false; w.vx = dir * 0.9; w.vy = 0; }
    }

    // ---------- tir ----------
    fire(wp, w, power, target) {
      const T = this.turn, team = this.teams[T.team];
      const dir = this.aimDir(w);
      const sx = w.x + dir.x * 14, sy = w.y - 2 + dir.y * 14;
      const pw = Math.max(0.08, power);
      T.charging = false; T.charge = 0;
      const shoot = (type, speed, extra) => {
        const p = this.spawn(type, sx, sy, dir.x * speed * pw, dir.y * speed * pw, w.id);
        return Object.assign(p, extra || {});
      };
      switch (wp.id) {
        case 'baguette': shoot('baguette', 15); this.emit({ t: 'sfx', n: 'shoot' }); break;
        case 'poule': shoot('poule', 12); this.emit({ t: 'sfx', n: 'cluck' }); break;
        case 'pasteque': shoot('pasteque', 12); this.emit({ t: 'sfx', n: 'throw' }); break;
        case 'trounoir': shoot('trounoir', 12); this.emit({ t: 'sfx', n: 'throw' }); break;
        case 'disco': shoot('disco', 12); this.emit({ t: 'sfx', n: 'disco' }); break;
        case 'escargot': shoot('escargot', 10, { tx: T.target.x, ty: T.target.y }); this.emit({ t: 'sfx', n: 'shoot' }); break;
        case 'saucisse': this.spawn('saucisse', w.x + w.facing * 6, w.y, w.facing * 0.5, -1, w.id); this.emit({ t: 'sfx', n: 'fuse' }); break;
        case 'fromage': {
          const p = this.spawn('fromage', w.x + w.facing * 16, w.y - 2, 0, 0, w.id);
          p.dir = w.facing; p.air = true; p.jumps = 0;
          this.emit({ t: 'sfx', n: 'throw' });
          break;
        }
        case 'confettis': this.hitscan(w, sx, sy, dir); break;
        case 'poisson': this.slap(w); break;
        case 'chaussettes': {
          for (let i = 0; i < 5; i++) this.spawn('chaussette', target.x + (i - 2) * 34, -60 - i * 28, this.wind * 25, 2, -1);
          this.emit({ t: 'msg', s: 'Alerte odeur ! 🧦🧦🧦' });
          this.emit({ t: 'sfx', n: 'plane' });
          break;
        }
        case 'piano': {
          this.spawn('piano', target.x, -120, 0, 4, -1);
          this.emit({ t: 'sfx', n: 'piano' });
          break;
        }
        case 'teleport': {
          if (target.y > WATER - 20 || target.y < -200 || target.x < 10 || target.x > W - 10 || this.circleSolid(target.x, target.y, R + 1)) {
            this.hint(team.owner, 'Impossible de livrer ici !');
            return;
          }
          this.emit({ t: 'fx', k: 'tp', x: r1(w.x), y: r1(w.y), x2: r1(target.x), y2: r1(target.y) });
          w.x = target.x; w.y = target.y; w.vx = 0; w.vy = 0; w.grounded = false;
          break;
        }
        case 'sieste': {
          this.emit({ t: 'msg', s: L.fmt(L.pick(QUIPS.sieste), w.name) });
          this.emit({ t: 'fx', k: 'zzz', x: r1(w.x), y: r1(w.y) });
          this.emit({ t: 'sfx', n: 'zzz' });
          this.toSettle();
          return;
        }
      }
      if (team.ammo[wp.id] > 0) team.ammo[wp.id]--;
      T.phase = 'retreat';
      T.retreat = RETREAT_TIME;
    }

    spawn(type, x, y, vx, vy, owner) {
      const p = { id: ++this.pid, type, x, y, vx, vy, owner, age: 0, rot: 0, fuse: PROJ[type].fuse || 0, vortexT: 0 };
      this.proj.push(p);
      return p;
    }

    hitscan(w, sx, sy, dir) {
      let x = sx, y = sy, hitW = null, hit = false;
      for (let i = 0; i < 500; i++) {
        x += dir.x * 2; y += dir.y * 2;
        if (x < -50 || x > W + 50 || y > WATER) break;
        if (this.terrain.isSolid(x, y)) { hit = true; break; }
        hitW = this.worms.find((o) => o !== w && !o.drowned && Math.hypot(o.x - x, o.y - y) < R);
        if (hitW) { hit = true; break; }
      }
      this.emit({ t: 'ray', x1: r1(sx), y1: r1(sy), x2: r1(x), y2: r1(y) });
      this.emit({ t: 'sfx', n: 'pop' });
      if (hit) {
        this.explode(x, y, 16, 6, 0.4, 'confetti');
        if (hitW) {
          hitW.vx += dir.x * 5; hitW.vy += dir.y * 5 - 2; hitW.grounded = false;
          if (!hitW.dead) this.hurt(hitW, 26);
        }
      }
    }

    slap(w) {
      const hx = w.x + w.facing * 20, hy = w.y;
      this.emit({ t: 'fx', k: 'slap', x: r1(hx), y: r1(hy), f: w.facing });
      this.emit({ t: 'sfx', n: 'slap' });
      for (const o of this.worms) {
        if (o === w || o.drowned) continue;
        if (Math.hypot(o.x - hx, o.y - hy) < 26) {
          o.vx = w.facing * 7.5; o.vy = -6.5; o.grounded = false;
          if (!o.dead) this.hurt(o, 22);
        }
      }
    }

    // ---------- explosions & dégâts ----------
    explode(x, y, r, dmg, force = 1, kind = 'boom') {
      this.terrain.carve(x, y, r);
      this.emit({ t: 'boom', x: r1(x), y: r1(y), r, k: kind });
      const RR = r + 25;
      for (const w of this.worms) {
        if (w.drowned) continue;
        const dx = w.x - x, dy = w.y - y, d = Math.hypot(dx, dy);
        if (d > RR) continue;
        const f = 1 - d / RR;
        const kn = force * (2 + 7 * f);
        const nx = d > 1 ? dx / d : 0, ny = d > 1 ? dy / d : -1;
        w.vx += nx * kn; w.vy += ny * kn - 2.2 * f * force; w.grounded = false;
        if (!w.dead) this.hurt(w, Math.round(dmg * Math.min(1, f * 1.3)));
      }
      for (const p of this.proj) {
        const pd = PROJ[p.type];
        if (pd.bounce > 0 && !p.vortexT) {
          const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy);
          if (d < RR && d > 1) { p.vx += (dx / d) * 4 * (1 - d / RR); p.vy += (dy / d) * 4 * (1 - d / RR) - 1; }
        }
      }
    }

    hurt(w, dm) {
      if (dm <= 0 || w.dead) return;
      w.hp = Math.max(0, w.hp - dm);
      this.emit({ t: 'pop', x: r1(w.x), y: r1(w.y - 24), s: '-' + dm, c: this.teams[w.team].color });
      const T = this.turn;
      if (w.id === T.worm && (T.phase === 'aim' || T.phase === 'retreat')) this.toSettle();
    }

    detonate(p) {
      if (p.dead) return;
      const d = PROJ[p.type];
      p.dead = true;
      this.explode(p.x, p.y, d.boom[0], d.boom[1], d.force || 1, d.kind || 'boom');
      if (d.frag) {
        for (let i = 0; i < 6; i++) this.spawn('pepin', p.x, p.y - 6, (Math.random() - 0.5) * 7, -3 - Math.random() * 4, -1);
      }
    }

    // ---------- physique ----------
    physics() {
      for (const w of this.worms) this.updateWorm(w);
      for (const p of this.proj) if (!p.dead) this.updateProj(p);
      if (this.proj.some((p) => p.dead)) this.proj = this.proj.filter((p) => !p.dead);
    }

    land(w) { w.grounded = true; w.vx = 0; w.vy = 0; }

    updateWorm(w) {
      if (w.drowned) return;
      if (w.grounded) {
        if (this.supportedAt(w.x, w.y, R)) { w.vx = 0; w.vy = 0; return; }
        w.grounded = false;
      }
      w.walking = false;
      if (this.circleSolid(w.x, w.y, R)) {
        w.y -= 1.5;
        if (this.supportedAt(w.x, w.y, R)) { this.land(w); return; }
      }
      w.vy = Math.min(w.vy + G, 14);
      w.vx *= 0.997;
      const sp = Math.hypot(w.vx, w.vy);
      const n = Math.max(1, Math.ceil(sp / 1.5));
      for (let i = 0; i < n; i++) {
        const nx = w.x + w.vx / n, ny = w.y + w.vy / n;
        if (this.circleSolid(nx, ny, R)) {
          const nm = this.terrain.normal(nx, ny, R);
          const vn = w.vx * nm.x + w.vy * nm.y;
          if (nm.y < -0.4) {
            const impact = -vn;
            if (impact > 8.5 && !w.dead) this.hurt(w, Math.round((impact - 8.5) * 6));
            if (sp > 5 && impact < 5) this.reflect(w, nm, 0.3, 0.75);
            else this.land(w);
          } else {
            this.reflect(w, nm, 0.4, 0.8);
            if (sp < 2.5 && this.supportedAt(w.x, w.y, R)) this.land(w);
          }
          break;
        }
        w.x = nx; w.y = ny;
      }
      if (!w.grounded && Math.hypot(w.vx, w.vy) < 0.4 && this.supportedAt(w.x, w.y, R)) this.land(w);
      if (w.y > WATER - 4 || w.x < -150 || w.x > W + 150) this.drown(w);
    }

    drown(w) {
      const wasAlive = !w.dead;
      w.drowned = true; w.dead = true; w.hp = 0; w.grounded = true;
      this.emit({ t: 'splash', x: r1(w.x), y: WATER });
      if (wasAlive) this.emit({ t: 'msg', s: L.fmt(L.pick(QUIPS.drown), w.name) });
      const T = this.turn;
      if (w.id === T.worm && (T.phase === 'aim' || T.phase === 'retreat')) this.toSettle();
    }

    updateProj(p) {
      const d = PROJ[p.type];
      p.age++;
      if (p.vortexT > 0) {
        p.vortexT--;
        this.vortex(p);
        if (p.vortexT === 0) this.detonate(p);
        return;
      }
      if (d.walker) this.walkerStep(p, d);
      else this.ballistic(p, d);
      if (p.dead) return;
      if (d.rot === 'vel') p.rot = Math.atan2(p.vy, p.vx);
      else if (!d.walker) p.rot += p.vx * 0.06;
      if (d.fuse && p.fuse > 0) {
        p.fuse--;
        if (p.fuse === 0) {
          if (d.vortex) { p.vortexT = d.vortex; p.vx = 0; p.vy = 0; this.emit({ t: 'sfx', n: 'vortex' }); }
          else this.detonate(p);
        }
      }
      if (!p.dead && (p.y > WATER || p.x < -400 || p.x > W + 400)) {
        p.dead = true;
        if (p.y > WATER) this.emit({ t: 'splash', x: r1(p.x), y: WATER, s: 1 });
      }
    }

    hitsWorm(p, x, y, r) {
      for (const w of this.worms) {
        if (w.drowned) continue;
        if (w.id === p.owner && p.age < 18) continue;
        if (Math.hypot(w.x - x, w.y - y) < R + r) return true;
      }
      return false;
    }

    ballistic(p, d) {
      const grav = d.homing && p.age > 20 ? 0 : (d.grav != null ? d.grav : G);
      p.vy += grav;
      p.vx += this.wind * (d.wind || 0);
      if (d.homing && p.age > 20) {
        const dx = p.tx - p.x, dy = p.ty - p.y, dd = Math.hypot(dx, dy) || 1;
        p.vx += ((dx / dd) * 5.5 - p.vx) * 0.06;
        p.vy += ((dy / dd) * 5.5 - p.vy) * 0.06;
      }
      const impact = d.bounce < 0;
      const sp = Math.hypot(p.vx, p.vy);
      const n = Math.max(1, Math.ceil(sp / 2));
      for (let i = 0; i < n; i++) {
        const nx = p.x + p.vx / n, ny = p.y + p.vy / n;
        if (impact && this.hitsWorm(p, nx, ny, d.r)) { p.x = nx; p.y = ny; this.detonate(p); return; }
        if (this.circleSolid(nx, ny, d.r)) {
          if (impact) { p.x = nx; p.y = ny; this.detonate(p); return; }
          const nm = this.terrain.normal(nx, ny, d.r + 2);
          if (sp > 2.5) {
            if (p.type === 'poule' && Math.random() < 0.6) this.emit({ t: 'sfx', n: 'cluck' });
            if (p.type === 'disco') this.emit({ t: 'sfx', n: 'bling' });
            if (p.type === 'poule') this.emit({ t: 'fx', k: 'feather', x: r1(p.x), y: r1(p.y) });
          }
          this.reflect(p, nm, d.bounce, 0.9);
          return;
        }
        p.x = nx; p.y = ny;
      }
    }

    walkerStep(p, d) {
      const r = d.r;
      if (p.age > 25 && this.hitsWorm(p, p.x, p.y, r)) {
        const hit = this.worms.find((w) => !w.drowned && w.id !== p.owner && Math.hypot(w.x - p.x, w.y - p.y) < R + r);
        if (hit) { this.detonate(p); return; }
      }
      p.rot += p.dir * 0.15;
      if (p.air) {
        p.vy = Math.min(p.vy + G, 12);
        const n = Math.max(1, Math.ceil(Math.hypot(p.vx, p.vy) / 1.5));
        for (let i = 0; i < n; i++) {
          const nx = p.x + p.vx / n, ny = p.y + p.vy / n;
          if (this.circleSolid(nx, ny, r)) {
            if (this.supportedAt(p.x, p.y, r)) { p.air = false; p.vx = 0; p.vy = 0; }
            else { p.vx = 0; p.vy = Math.max(0, p.vy * 0.3); }
            return;
          }
          p.x = nx; p.y = ny;
        }
        return;
      }
      const nx = p.x + p.dir * 1.6;
      let moved = false;
      for (let dy = 0; dy <= 7; dy++) {
        if (!this.circleSolid(nx, p.y - dy, r)) { p.x = nx; p.y -= dy; moved = true; break; }
      }
      if (!moved) {
        p.air = true; p.vy = -4.5; p.vx = p.dir * 1.6; p.jumps++;
        if (p.jumps > 3) { p.dir *= -1; p.jumps = 0; }
        return;
      }
      let f = 0;
      while (!this.supportedAt(p.x, p.y, r) && f < 6 && !this.circleSolid(p.x, p.y + 1, r)) { p.y++; f++; }
      if (!this.supportedAt(p.x, p.y, r)) { p.air = true; p.vx = p.dir * 1.6; p.vy = 0; }
    }

    vortex(p) {
      for (const w of this.worms) {
        if (w.drowned) continue;
        const dx = p.x - w.x, dy = p.y - w.y, d = Math.hypot(dx, dy);
        if (d < 230 && d > 6) {
          const f = (1 - d / 230) * 0.6;
          w.vx = (w.vx + (dx / d) * f) * 0.97;
          w.vy = (w.vy + (dy / d) * f - G * 0.6) * 0.97;
          w.grounded = false;
        }
      }
      for (const o of this.proj) {
        if (o === p || o.dead || o.vortexT) continue;
        const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy);
        if (d < 230 && d > 6) { o.vx += (dx / d) * 0.4; o.vy += (dy / d) * 0.4; }
      }
    }

    // ---------- tours ----------
    toSettle() {
      const T = this.turn;
      if (T.phase === 'settle' || T.phase === 'over') return;
      T.phase = 'settle'; T.settleT = 0; T.quiet = 0; T.charging = false;
    }

    isSettled() {
      return this.proj.length === 0 && this.worms.every((w) => w.drowned || w.grounded);
    }

    updateSettle() {
      const T = this.turn;
      T.settleT++;
      if (!this.isSettled()) {
        if (T.settleT < 60 * 12) { T.quiet = 0; return; }
        this.proj = [];
        for (const w of this.worms) if (!w.drowned) this.land(w);
      }
      T.quiet++;
      if (T.quiet < 30) return;
      const dying = this.worms.find((w) => !w.dead && w.hp <= 0);
      if (dying) {
        dying.dead = true;
        this.emit({ t: 'msg', s: L.fmt(L.pick(QUIPS.death), dying.name) });
        this.explode(dying.x, dying.y, 22, 10, 0.6, 'death');
        T.quiet = 0; T.settleT = 0;
        return;
      }
      const alive = this.teams.map((_, i) => i).filter((i) => this.teamAlive(i));
      if (alive.length <= 1) {
        T.phase = 'over';
        T.winner = alive.length ? alive[0] : -1;
        this.emit({ t: 'over', w: T.winner });
        return;
      }
      this.nextTurn();
    }

    nextTurn() {
      const T = this.turn, n = this.teams.length;
      let ti = -1;
      for (let k = 1; k <= n; k++) {
        const c = (((T.team + k) % n) + n) % n;
        if (this.teamAlive(c)) { ti = c; break; }
      }
      if (ti < 0) { T.phase = 'over'; T.winner = -1; this.emit({ t: 'over', w: -1 }); return; }
      const team = this.teams[ti];
      const mine = this.worms.filter((w) => w.team === ti);
      let wi = -1;
      const start = mine.findIndex((w) => w.id === team.last);
      for (let k = 1; k <= mine.length; k++) {
        const c = mine[(start + k + mine.length) % mine.length];
        if (!c.dead && c.hp > 0) { wi = c.id; break; }
      }
      team.last = wi;
      let weapon = team.weapon;
      if (team.ammo[weapon] === 0) weapon = 'baguette';
      Object.assign(T, { team: ti, worm: wi, phase: 'aim', timer: TURN_TIME, retreat: 0, weapon, charge: 0, charging: false, target: null });
      this.wind = Math.round((Math.random() * 2 - 1) * 0.06 * 1000) / 1000;
      const w = this.worms[wi];
      w.aim = -0.4;
      this.emit({ t: 'turn', team: ti, worm: wi, s: L.fmt(L.pick(QUIPS.turn), w.name) });
    }

    // ---------- réseau ----------
    snapshot() {
      const T = this.turn;
      return {
        t: 's',
        w: this.worms.map((w) => [r1(w.x), r1(w.y), w.hp, (w.dead ? 1 : 0) | (w.drowned ? 2 : 0) | (w.grounded ? 4 : 0) | (w.walking ? 8 : 0) | (w.facing > 0 ? 16 : 0), r2(w.aim)]),
        p: this.proj.map((p) => [p.id, p.type, r1(p.x), r1(p.y), r2(p.rot), p.fuse, p.vortexT]),
        T: { team: T.team, worm: T.worm, phase: T.phase, timer: r2(T.timer), retreat: r2(T.retreat), weapon: T.weapon, charge: r2(T.charge), charging: T.charging, target: T.target, winner: T.winner },
        wind: this.wind,
        am: this.teams[T.team] ? this.teams[T.team].ammo : null,
        ev: this.events.splice(0),
      };
    }

    apply(s) {
      s.w.forEach((a, i) => {
        const w = this.worms[i];
        if (!w) return;
        w.tx = a[0]; w.ty = a[1]; w.hp = a[2];
        const fl = a[3];
        w.dead = !!(fl & 1); w.drowned = !!(fl & 2); w.grounded = !!(fl & 4); w.walking = !!(fl & 8);
        w.facing = fl & 16 ? 1 : -1; w.aim = a[4];
        if (Math.hypot(w.tx - w.x, w.ty - w.y) > 120) { w.x = w.tx; w.y = w.ty; }
      });
      const old = new Map(this.proj.map((p) => [p.id, p]));
      this.proj = s.p.map((a) => {
        const p = old.get(a[0]) || { id: a[0], type: a[1], x: a[2], y: a[3], age: 0 };
        p.tx = a[2]; p.ty = a[3]; p.rot = a[4]; p.fuse = a[5]; p.vortexT = a[6];
        return p;
      });
      Object.assign(this.turn, s.T);
      this.wind = s.wind;
      if (s.am && this.teams[s.T.team]) this.teams[s.T.team].ammo = s.am;
      for (const ev of s.ev || []) {
        if (ev.t === 'boom') this.terrain.carve(ev.x, ev.y, ev.r);
        if (ev.t === 'gone' && this.teams[ev.i]) this.teams[ev.i].gone = true;
        this.onFx(ev);
      }
    }

    clientUpdate() {
      for (const w of this.worms) { w.x += (w.tx - w.x) * 0.4; w.y += (w.ty - w.y) * 0.4; }
      for (const p of this.proj) { p.age = (p.age || 0) + 1; p.x += (p.tx - p.x) * 0.5; p.y += (p.ty - p.y) * 0.5; }
    }
  };
})();

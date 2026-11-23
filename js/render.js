// Rendu cartoon sur canvas : ciel, collines, terrain, lombrics, particules, HUD
(function () {
  const { W, H, WATER } = L;
  const EF = L.EMOJI_FONT;
  const TITLE = '"Luckiest Guy","Fredoka",system-ui,sans-serif';
  const UI = '"Fredoka",system-ui,sans-serif';

  const WORDS = {
    boom: ['BOUM !', 'PAF !', 'KABOUM !', 'BAM !', 'VLAN !'],
    death: ['POUF !'], piano: ['FORTISSIMO !', 'PLONG !'], disco: ['PARTY !', 'DISCO !'],
    fromage: ['RACLETTE !', 'FONDUE !'], chaussette: ['PFOUAH !', 'BERK !'], trounoir: ['PLOP !'],
    pepin: ['PIF !', 'POF !'], confetti: ['YOUPI !'],
  };
  const FIRE = ['#fff3b0', '#ffd166', '#ff9f1c', '#ff595e'];
  const PARTY = ['#ff4d6d', '#ffbe0b', '#3a86ff', '#2fbf4a', '#b5179e', '#00f5d4'];

  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function outlinedText(ctx, s, x, y, fill, stroke, lw) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.strokeText(s, x, y);
    ctx.fillStyle = fill; ctx.fillText(s, x, y);
  }

  L.Renderer = class {
    constructor(cv) {
      this.cv = cv;
      this.ctx = cv.getContext('2d');
      this.parts = [];
      this.cam = { x: W / 2, y: 700 };
      this.userZoom = 1;
      this.shake = 0;
      this.banner = null;
      this.hintMsg = null;
      this.manualT = 0;
      this.time = 0;
      this.me = 'local';
      this.lastTimer = 99;
      window.addEventListener('resize', () => this.resize());
      this.resize();
    }

    resize() {
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
      this.vw = window.innerWidth; this.vh = window.innerHeight;
      this.cv.width = Math.floor(this.vw * this.dpr);
      this.cv.height = Math.floor(this.vh * this.dpr);
    }

    zoom() { return L.clamp(Math.min(this.vh / 720, this.vw / 1000) * 1.05, 0.45, 1.6) * this.userZoom; }

    toWorld(sx, sy) {
      const z = this.zoom();
      return { x: (sx - this.vw / 2) / z + this.cam.x, y: (sy - this.vh / 2) / z + this.cam.y };
    }

    pan(dx, dy) {
      const z = this.zoom();
      this.cam.x -= dx / z; this.cam.y -= dy / z;
      this.manualT = 2500;
    }

    setGame(g, me) {
      this.g = g; this.me = me; this.parts = []; this.banner = null; this.hintMsg = null;
      const rng = L.rng(g.seed + 7);
      this.clouds = [];
      for (let i = 0; i < 12; i++) this.clouds.push({ x: rng() * (W + 800) - 400, y: 40 + rng() * 380, s: 0.6 + rng() * 1.0 });
      const w = g.worms[0];
      if (w) { this.cam.x = w.x; this.cam.y = w.y; }
    }

    isMine(teamIdx) {
      const t = this.g.teams[teamIdx];
      return t && (t.owner === this.me || this.me === 'local');
    }

    // ---------- particules ----------
    part(o) {
      this.parts.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, life: 1, max: 1, g: 0, size: 4, color: '#fff', kind: 'dot', drag: 0.98, rot: 0, vr: 0 }, o));
      const p = this.parts[this.parts.length - 1];
      p.max = p.life;
      if (this.parts.length > 900) this.parts.splice(0, this.parts.length - 900);
    }

    word(x, y, list, size, color = '#ffe14d') {
      this.part({ kind: 'text', x, y, vy: -0.6, life: 1.1, size, text: L.pick(list), color, drag: 0.97, rot: (Math.random() - 0.5) * 0.4 });
    }

    fx(ev) {
      const th = this.g.theme;
      switch (ev.t) {
        case 'boom': {
          const { x, y, r, k } = ev;
          const small = k === 'pepin' || k === 'confetti' || k === 'death';
          this.shake = Math.min(20, this.shake + r * 0.22);
          this.part({ kind: 'flash', x, y, size: r * 1.7, life: 0.22 });
          this.part({ kind: 'ring', x, y, size: r * 0.6, grow: r * 2.6, life: 0.4, color: '#ffffff' });
          for (let i = 0; i < (small ? 6 : 14); i++) {
            const a = Math.random() * Math.PI * 2, s = Math.random() * r * 0.09;
            this.part({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, size: 6 + Math.random() * r * 0.25, color: L.pick(FIRE), life: 0.35 + Math.random() * 0.3, kind: 'fire', drag: 0.9 });
          }
          for (let i = 0; i < (small ? 4 : 10); i++) {
            this.part({ kind: 'smoke', x: x + (Math.random() - 0.5) * r, y: y + (Math.random() - 0.5) * r, vx: (Math.random() - 0.5) * 0.8, vy: -0.4 - Math.random() * 0.8, size: 10 + Math.random() * r * 0.35, color: '#5a5260', life: 1 + Math.random(), drag: 0.99 });
          }
          for (let i = 0; i < (small ? 6 : 18); i++) {
            const a = -Math.PI * Math.random(), s = 2 + Math.random() * 6;
            this.part({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.25, size: 2 + Math.random() * 4, color: L.pick([th.dirt, th.dirt2, th.grass, th.outline]), life: 1.2, drag: 0.99 });
          }
          if (k === 'disco' || k === 'confetti') {
            for (let i = 0; i < (k === 'disco' ? 60 : 20); i++) {
              const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 7;
              this.part({ kind: 'confetti', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, g: 0.12, size: 5, color: L.pick(PARTY), life: 2, drag: 0.97, vr: (Math.random() - 0.5) * 0.5 });
            }
          }
          if (k === 'chaussette') {
            for (let i = 0; i < 6; i++) this.part({ kind: 'smoke', x: x + (Math.random() - 0.5) * 50, y: y - Math.random() * 30, vy: -0.3, size: 20 + Math.random() * 20, color: '#8fd14f', life: 2.4 });
          }
          if (k === 'piano') {
            L.Audio.play('pianocrash');
            for (let i = 0; i < 10; i++) {
              const a = -Math.PI * Math.random();
              this.part({ kind: 'emoji', text: L.pick(['🎵', '🎶', '🎼']), x, y, vx: Math.cos(a) * 4, vy: Math.sin(a) * 4, g: 0.05, size: 22, life: 1.8 });
            }
          }
          if (k === 'fromage') {
            for (let i = 0; i < 16; i++) {
              const a = -Math.PI * Math.random(), s = 2 + Math.random() * 5;
              this.part({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.2, size: 4 + Math.random() * 5, color: '#ffd23f', life: 1.6 });
            }
          }
          if (k === 'trounoir') {
            this.part({ kind: 'ring', x, y, size: r * 2.5, grow: -r * 2.4, life: 0.4, color: '#b388ff' });
          }
          this.word(x, y - r * 0.6, WORDS[k] || WORDS.boom, small ? 20 : 26 + r * 0.25);
          L.Audio.play('boom', Math.min(1, r / 80));
          break;
        }
        case 'pop':
          this.part({ kind: 'text', x: ev.x, y: ev.y, vy: -0.8, life: 1.6, size: 22, text: ev.s, color: ev.c, drag: 0.97 });
          break;
        case 'msg':
          this.banner = { s: ev.s, t: 3200 };
          break;
        case 'hint':
          if (ev.o === this.me || this.me === 'local') this.hintMsg = { s: ev.s, t: 2200 };
          break;
        case 'turn':
          this.banner = { s: ev.s, t: 2600, c: this.g.teams[ev.team].color };
          this.manualT = 0;
          L.Audio.play('turn');
          break;
        case 'sfx':
          L.Audio.play(ev.n);
          break;
        case 'splash':
          for (let i = 0; i < (ev.s ? 8 : 18); i++) {
            const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.4, s = 2 + Math.random() * 5;
            this.part({ x: ev.x, y: ev.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.25, size: 3 + Math.random() * 3, color: '#cfefff', life: 1 });
          }
          this.part({ kind: 'ring', x: ev.x, y: ev.y, size: 6, grow: 50, life: 0.6, color: '#ffffff', flat: true });
          L.Audio.play('splash');
          break;
        case 'ray':
          this.part({ kind: 'line', x: ev.x1, y: ev.y1, x2: ev.x2, y2: ev.y2, life: 0.3, color: '#ffe14d' });
          for (let i = 0; i < 14; i++) {
            const t = Math.random();
            this.part({ kind: 'confetti', x: L.lerp(ev.x1, ev.x2, t), y: L.lerp(ev.y1, ev.y2, t), vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 2, g: 0.08, size: 4, color: L.pick(PARTY), life: 1.4, vr: 0.3 });
          }
          break;
        case 'fx':
          if (ev.k === 'slap') {
            this.part({ kind: 'emoji', text: '🐟', x: ev.x, y: ev.y, vx: ev.f * 1.5, vy: -0.5, size: 30, life: 0.5, rot: -ev.f * 0.8, vr: ev.f * 0.25 });
            this.word(ev.x, ev.y - 20, ['SPLAF !', 'SCHLAK !'], 26, '#7fe0ff');
            for (let i = 0; i < 10; i++) this.part({ x: ev.x, y: ev.y, vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 4, g: 0.2, size: 3, color: '#9be7ff', life: 0.8 });
          } else if (ev.k === 'tp') {
            for (const [x, y] of [[ev.x, ev.y], [ev.x2, ev.y2]]) {
              this.part({ kind: 'emoji', text: '🍕', x, y, vy: -1, size: 26, life: 0.9, vr: 0.2 });
              for (let i = 0; i < 16; i++) {
                const a = Math.random() * Math.PI * 2;
                this.part({ kind: 'confetti', x, y, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, size: 4, color: L.pick(['#ffd166', '#ff595e', '#ffffff']), life: 0.9, vr: 0.4 });
              }
            }
            L.Audio.play('tp');
          } else if (ev.k === 'zzz') {
            for (let i = 0; i < 3; i++) this.part({ kind: 'text', text: 'Z', x: ev.x + i * 8, y: ev.y - 20 - i * 12, vx: 0.3, vy: -0.5, size: 16 + i * 6, color: '#ffffff', life: 2 + i * 0.3 });
          } else if (ev.k === 'feather') {
            for (let i = 0; i < 3; i++) this.part({ kind: 'feather', x: ev.x, y: ev.y, vx: (Math.random() - 0.5) * 2, vy: -1 - Math.random(), g: 0.02, size: 6, color: '#ffffff', life: 2, drag: 0.96, vr: 0.1 });
          }
          break;
        case 'over':
          L.Audio.play('win');
          for (let i = 0; i < 120; i++) {
            this.part({ kind: 'confetti', x: this.cam.x + (Math.random() - 0.5) * 1400, y: this.cam.y - 500 - Math.random() * 300, vx: (Math.random() - 0.5) * 2, vy: Math.random() * 2, g: 0.05, size: 6, color: L.pick(PARTY), life: 6, drag: 0.995, vr: 0.2 });
          }
          break;
      }
    }

    // ---------- caméra ----------
    updateCam(dt) {
      const g = this.g, z = this.zoom();
      if (this.manualT > 0) this.manualT -= dt;
      else {
        let tx, ty;
        const p = g.proj[g.proj.length - 1];
        if (p) { tx = p.x; ty = p.y; }
        else {
          const w = g.worms[g.turn.worm];
          if (w) { tx = w.x; ty = w.y - 40; }
        }
        if (tx != null) {
          const k = 1 - Math.pow(0.02, dt / 1000 * (p ? 3 : 1.6));
          this.cam.x += (tx - this.cam.x) * k;
          this.cam.y += (ty - this.cam.y) * k;
        }
      }
      const hw = this.vw / 2 / z, hh = this.vh / 2 / z;
      this.cam.x = L.clamp(this.cam.x, Math.min(W / 2, hw - 300), Math.max(W / 2, W - hw + 300));
      this.cam.y = L.clamp(this.cam.y, -600 + hh, Math.max(-600 + hh, WATER + 70 - hh));
    }

    // ---------- dessin ----------
    draw(dt) {
      const g = this.g;
      if (!g) return;
      this.time += dt;
      const ctx = this.ctx, dpr = this.dpr, z = this.zoom(), th = g.theme;
      this.updateCam(dt);
      for (const c of this.clouds) {
        c.x += (g.wind * 25 + 0.05) * c.s * dt / 16;
        if (c.x > W + 500) c.x = -500;
        if (c.x < -500) c.x = W + 500;
      }

      // ciel
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sky = ctx.createLinearGradient(0, 0, 0, this.vh);
      sky.addColorStop(0, th.sky[0]); sky.addColorStop(1, th.sky[1]);
      ctx.fillStyle = sky; ctx.fillRect(0, 0, this.vw, this.vh);
      this.drawSun(ctx);
      this.drawHills(ctx, z);

      // monde
      let sx = 0, sy = 0;
      if (this.shake > 0.3) {
        sx = (Math.random() - 0.5) * this.shake; sy = (Math.random() - 0.5) * this.shake;
        this.shake *= Math.pow(0.88, dt / 16);
      } else this.shake = 0;
      const s = dpr * z;
      ctx.setTransform(s, 0, 0, s, dpr * (this.vw / 2 - this.cam.x * z + sx), dpr * (this.vh / 2 - this.cam.y * z + sy));

      this.drawClouds(ctx);
      this.drawWater(ctx, false);
      ctx.drawImage(g.terrain.canvas, 0, 0);

      const T = g.turn;
      for (const w of g.worms) this.drawWorm(ctx, w, g.teams[w.team], w.id === T.worm && T.phase !== 'over');
      this.drawAim(ctx);
      for (const p of g.proj) this.drawProj(ctx, p, dt);
      for (const w of g.worms) this.drawLabel(ctx, w, g.teams[w.team], w.id === T.worm);
      this.drawParts(ctx, dt);
      this.drawWater(ctx, true);

      // HUD
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.drawHUD(ctx, dt);
    }

    drawSun(ctx) {
      const x = this.vw - 120 - this.cam.x * 0.02, y = 110 - this.cam.y * 0.02, t = this.time / 1000;
      const sc = Math.min(1, this.vh / 650);
      ctx.save();
      ctx.translate(x, y); ctx.scale(sc, sc);
      ctx.rotate(t * 0.15);
      ctx.fillStyle = 'rgba(255,230,120,0.45)';
      for (let i = 0; i < 12; i++) {
        ctx.rotate(Math.PI / 6);
        ctx.beginPath(); ctx.moveTo(0, -48); ctx.lineTo(10, -70); ctx.lineTo(-10, -70); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      ctx.save();
      ctx.translate(x, y); ctx.scale(sc, sc);
      ctx.fillStyle = '#ffe066'; ctx.strokeStyle = '#e0a800'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#5a3a00';
      ctx.beginPath(); ctx.arc(-13, -6, 4, 0, Math.PI * 2); ctx.arc(13, -6, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#5a3a00'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 4, 16, 0.2, Math.PI - 0.2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,120,120,0.5)';
      ctx.beginPath(); ctx.arc(-24, 8, 6, 0, Math.PI * 2); ctx.arc(24, 8, 6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    drawHills(ctx, z) {
      const th = this.g.theme;
      for (let i = 0; i < 2; i++) {
        const f = 0.25 + i * 0.2;
        const baseY = this.vh / 2 + ((WATER - 330 + i * 110) - this.cam.y) * z * (0.45 + i * 0.2);
        ctx.fillStyle = th.hills[i];
        ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, this.vh);
        for (let x = 0; x <= this.vw + 10; x += 10) {
          const hx = x / z / 1.5 + this.cam.x * f + i * 500;
          const y = baseY + (Math.sin(hx * 0.006 + i * 2) * 55 + Math.sin(hx * 0.0145 + i) * 22) * z;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(this.vw, this.vh);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }

    drawClouds(ctx) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.strokeStyle = 'rgba(80,110,150,0.25)';
      ctx.lineWidth = 3;
      for (const c of this.clouds) {
        const x = c.x, y = c.y, s = c.s * 30;
        ctx.beginPath();
        ctx.arc(x, y, s, 0, Math.PI * 2);
        ctx.arc(x + s * 1.1, y - s * 0.4, s * 1.2, 0, Math.PI * 2);
        ctx.arc(x + s * 2.3, y, s * 0.9, 0, Math.PI * 2);
        ctx.arc(x + s * 1.2, y + s * 0.3, s, 0, Math.PI * 2);
        ctx.stroke(); ctx.fill();
      }
    }

    drawWater(ctx, front) {
      const th = this.g.theme, t = this.time / 1000;
      ctx.fillStyle = front ? L.rgba(th.water, 0.55) : th.water;
      ctx.beginPath();
      ctx.moveTo(-3000, H + 1200);
      const off = front ? 7 : 0;
      for (let x = -3000; x <= W + 3000; x += 24) ctx.lineTo(x, WATER + off + Math.sin(x * 0.018 + t * (front ? 2.2 : 1.6) + (front ? 2 : 0)) * 5);
      ctx.lineTo(W + 3000, H + 1200);
      ctx.closePath();
      ctx.fill();
      if (front) {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3;
        ctx.beginPath();
        for (let x = -3000; x <= W + 3000; x += 24) {
          const y = WATER + off + Math.sin(x * 0.018 + t * 2.2 + 2) * 5;
          if (x === -3000) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    drawWorm(ctx, w, team, active) {
      if (w.drowned) return;
      const t = this.time;
      if (w.dead) { this.drawGrave(ctx, w, team); return; }
      const f = w.facing;
      const bob = w.walking ? Math.sin(t * 0.025) * 1.6 : Math.sin(t * 0.004 + w.id) * 0.7;
      const wig = w.walking ? Math.sin(t * 0.025) * 2 : 0;
      ctx.save();
      ctx.translate(w.x, w.y);
      const parts = [
        [-f * 10, 6 + wig * 0.5, 5],
        [-f * 4, 4 - wig * 0.3, 7.5],
        [f * 2, -4 + bob, 9.5],
      ];
      // contour commun
      ctx.fillStyle = '#5b1f2b';
      for (const [x, y, r] of parts) { ctx.beginPath(); ctx.arc(x, y, r + 2, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#ff9eb5';
      for (const [x, y, r] of parts) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
      // ventre & anneaux
      ctx.fillStyle = '#ffd3de';
      ctx.beginPath(); ctx.ellipse(f * 4, 1 + bob, 4, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(160,50,80,0.45)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(-f * 4, 4 - wig * 0.3, 5, -1, 1); ctx.stroke();
      const hx = f * 2, hy = -4 + bob;
      // bandeau aux couleurs de l'équipe
      ctx.strokeStyle = team.color; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(hx, hy, 8.5, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
      ctx.fillStyle = team.color;
      ctx.beginPath();
      ctx.moveTo(hx - f * 7, hy - 6);
      ctx.lineTo(hx - f * 15, hy - 9 + Math.sin(t * 0.012) * 2);
      ctx.lineTo(hx - f * 14, hy - 2 + Math.sin(t * 0.012 + 1) * 2);
      ctx.closePath(); ctx.fill();
      // yeux
      let lx = f, ly = 0;
      if (active && this.g.turn.phase === 'aim') { const d = this.g.aimDir ? this.g.aimDir(w) : { x: f, y: 0 }; lx = d.x; ly = d.y; }
      const blink = (Math.floor(t / 100) + w.id * 7) % 40 === 0;
      for (const ex of [hx + f * 1.5, hx + f * 7]) {
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#5b1f2b'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(ex, hy - 3, 3.4, blink ? 0.8 : 4.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        if (!blink) {
          ctx.fillStyle = '#1b1b1b';
          ctx.beginPath(); ctx.arc(ex + lx * 1.4, hy - 3 + ly * 1.8, 1.8, 0, Math.PI * 2); ctx.fill();
        }
      }
      // bouche
      ctx.strokeStyle = '#5b1f2b'; ctx.lineWidth = 1.6;
      ctx.beginPath();
      if (w.hp < 30) ctx.arc(hx + f * 4.5, hy + 6.5, 2.6, Math.PI + 0.3, -0.3);
      else ctx.arc(hx + f * 4.5, hy + 2.5, 3, 0.3, Math.PI - 0.3);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,90,120,0.45)';
      ctx.beginPath(); ctx.arc(hx + f * 9.5, hy + 2, 2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    drawGrave(ctx, w, team) {
      ctx.save();
      ctx.translate(w.x, w.y + 2);
      ctx.fillStyle = '#a7adba'; ctx.strokeStyle = '#3d4150'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, 8); ctx.lineTo(-8, -6); ctx.arc(0, -6, 8, Math.PI, 0); ctx.lineTo(8, 8); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3d4150'; ctx.font = `bold 6px ${UI}`; ctx.textAlign = 'center';
      ctx.fillText('RIP', 0, -2);
      ctx.fillStyle = team.color;
      ctx.beginPath(); ctx.arc(-6, 8, 3, 0, Math.PI * 2); ctx.arc(6, 8, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    drawLabel(ctx, w, team, active) {
      if (w.dead) return;
      const T = this.g.turn;
      ctx.save();
      ctx.font = `600 11px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const y = w.y - 30;
      const tw = ctx.measureText(w.name).width + 10;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      rrect(ctx, w.x - tw / 2, y - 16, tw, 13, 6); ctx.fill();
      ctx.fillStyle = team.color;
      ctx.fillText(w.name, w.x, y - 9.5);
      const hs = String(w.hp);
      const hw = ctx.measureText(hs).width + 10;
      rrect(ctx, w.x - hw / 2, y - 1, hw, 13, 6);
      ctx.fillStyle = team.color; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillText(hs, w.x, y + 5.5);
      if (active && T.phase === 'aim' && T.timer > 40) {
        const by = y - 30 + Math.sin(this.time * 0.01) * 5;
        ctx.fillStyle = team.color; ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(w.x - 9, by - 8); ctx.lineTo(w.x + 9, by - 8); ctx.lineTo(w.x, by + 4); ctx.closePath();
        ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }

    drawAim(ctx) {
      const g = this.g, T = g.turn, w = g.worms[T.worm];
      if (!w || w.dead || T.phase !== 'aim') return;
      const team = g.teams[T.team];
      const wp = L.WEAPON[T.weapon];
      const d = g.aimDir(w);
      // arme tenue
      ctx.save();
      ctx.translate(w.x + d.x * 15, w.y - 2 + d.y * 15);
      ctx.rotate(Math.atan2(d.y, d.x));
      if (w.facing < 0) ctx.scale(1, -1);
      ctx.font = `18px ${EF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(wp.icon, 0, 0);
      ctx.restore();
      if (wp.mode === 'target') return;
      if (wp.mode === 'charge' || wp.mode === 'homing' || wp.id === 'confettis') {
        const cx = w.x + d.x * 70, cy = w.y - 2 + d.y * 70;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = team.color; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - 12, cy); ctx.lineTo(cx - 4, cy); ctx.moveTo(cx + 4, cy); ctx.lineTo(cx + 12, cy);
        ctx.moveTo(cx, cy - 12); ctx.lineTo(cx, cy - 4); ctx.moveTo(cx, cy + 4); ctx.lineTo(cx, cy + 12); ctx.stroke();
      }
      if (T.charging) {
        const n = Math.ceil(T.charge * 14);
        for (let i = 0; i < n; i++) {
          const k = i / 14, dist = 22 + k * 70;
          ctx.fillStyle = `hsl(${60 - k * 60},100%,55%)`;
          ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(w.x + d.x * dist, w.y - 2 + d.y * dist, 2.5 + k * 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
      }
      if (T.target) {
        const { x, y } = T.target, t = this.time * 0.005;
        ctx.save(); ctx.translate(x, y); ctx.rotate(t);
        ctx.strokeStyle = '#ff2d55'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.moveTo(-20, 0); ctx.lineTo(20, 0); ctx.moveTo(0, -20); ctx.lineTo(0, 20); ctx.stroke();
        ctx.restore();
      }
    }

    drawProj(ctx, p, dt) {
      const d = L.PROJ[p.type];
      if (!d) return;
      const t = this.time;
      // traînées
      if (Math.random() < dt / 30) {
        if (p.type === 'baguette') this.part({ kind: 'smoke', x: p.x, y: p.y, vy: -0.2, size: 6 + Math.random() * 4, color: '#e8e0d0', life: 0.8 });
        if (p.type === 'escargot') this.part({ x: p.x, y: p.y, size: 3, color: '#9be15d', life: 1.2, g: 0.05 });
        if (p.type === 'chaussette') this.part({ kind: 'smoke', x: p.x, y: p.y, vy: -0.3, size: 8, color: '#9be15d', life: 1.1 });
        if (p.type === 'piano') this.part({ kind: 'emoji', text: L.pick(['🎵', '🎶']), x: p.x + (Math.random() - 0.5) * 30, y: p.y - 20, vy: -0.6, size: 16, life: 1.2 });
        if (p.type === 'disco') this.part({ kind: 'confetti', x: p.x, y: p.y, vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 2, size: 3, color: L.pick(PARTY), life: 0.8, vr: 0.3 });
        if (p.type === 'saucisse' || p.type === 'poule') this.part({ x: p.x + 4, y: p.y - 8, vx: (Math.random() - 0.5), vy: -1.5, g: 0.1, size: 2, color: '#ffd166', life: 0.4 });
      }
      if (p.vortexT > 0) {
        ctx.save(); ctx.translate(p.x, p.y);
        const k = 1 - p.vortexT / 150;
        for (let i = 0; i < 5; i++) {
          ctx.rotate(t * 0.01 + i);
          ctx.strokeStyle = `hsla(${270 + i * 15},90%,${55 + i * 6}%,0.75)`;
          ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(0, 0, 18 + i * 22 * (0.6 + k * 0.5), 0, Math.PI * 1.2); ctx.stroke();
        }
        ctx.fillStyle = '#12002b';
        ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        if (Math.random() < 0.5) {
          const a = Math.random() * Math.PI * 2;
          this.part({ x: p.x + Math.cos(a) * 160, y: p.y + Math.sin(a) * 160, vx: -Math.cos(a) * 5, vy: -Math.sin(a) * 5, size: 2.5, color: '#d0b3ff', life: 0.5, drag: 1 });
        }
        return;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      let rot = p.rot || 0;
      if (p.type === 'baguette') rot += Math.PI / 4;
      if (p.type === 'escargot') { if (Math.cos(p.rot) > 0) ctx.scale(-1, 1); rot = Math.sin(t * 0.02) * 0.15; }
      if (p.type === 'piano' || p.type === 'chaussette') rot = Math.sin(t * 0.01 + p.id) * 0.25;
      ctx.rotate(rot);
      ctx.font = `${d.size}px ${EF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (p.type === 'disco') { ctx.shadowColor = L.pick(PARTY); ctx.shadowBlur = 14; }
      ctx.fillText(d.icon, 0, 0);
      ctx.restore();
      if (d.fuse && p.fuse > 0 && p.type !== 'escargot') {
        ctx.save();
        ctx.font = `700 13px ${UI}`; ctx.textAlign = 'center';
        outlinedText(ctx, String(Math.ceil(p.fuse / 60)), p.x, p.y - d.size * 0.7 - 4, '#fff', '#222', 3);
        ctx.restore();
      }
    }

    drawParts(ctx, dt) {
      const k = dt / 16.67;
      const alive = [];
      for (const p of this.parts) {
        p.life -= dt / 1000;
        if (p.life <= 0) continue;
        alive.push(p);
        p.vy += p.g * k;
        const dr = Math.pow(p.drag, k);
        p.vx *= dr; p.vy *= dr;
        p.x += p.vx * k; p.y += p.vy * k;
        p.rot += p.vr * k;
        const a = L.clamp(p.life / p.max, 0, 1);
        switch (p.kind) {
          case 'dot':
            ctx.fillStyle = p.color; ctx.globalAlpha = Math.min(1, a * 2);
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
            break;
          case 'fire':
            ctx.fillStyle = p.color; ctx.globalAlpha = a;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + a * 0.6), 0, Math.PI * 2); ctx.fill();
            break;
          case 'smoke':
            ctx.fillStyle = p.color; ctx.globalAlpha = a * 0.45;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.6 - a * 0.6), 0, Math.PI * 2); ctx.fill();
            break;
          case 'flash':
            ctx.fillStyle = '#fffbe0'; ctx.globalAlpha = a;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.2 - a * 0.2), 0, Math.PI * 2); ctx.fill();
            break;
          case 'ring': {
            const r = Math.max(0.1, p.size + p.grow * (1 - a));
            ctx.strokeStyle = p.color; ctx.globalAlpha = a; ctx.lineWidth = 4 * a + 1;
            ctx.beginPath();
            if (p.flat) ctx.ellipse(p.x, p.y, r, r * 0.25, 0, 0, Math.PI * 2);
            else ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.stroke();
            break;
          }
          case 'line':
            ctx.strokeStyle = p.color; ctx.globalAlpha = a; ctx.lineWidth = 3;
            ctx.setLineDash([8, 6]);
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x2, p.y2); ctx.stroke();
            ctx.setLineDash([]);
            break;
          case 'confetti':
            ctx.save(); ctx.globalAlpha = Math.min(1, a * 2);
            ctx.translate(p.x, p.y); ctx.rotate(p.rot);
            ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
            ctx.restore();
            break;
          case 'feather':
            ctx.save(); ctx.globalAlpha = a;
            ctx.translate(p.x, p.y); ctx.rotate(Math.sin(p.rot) * 0.8);
            ctx.fillStyle = '#fff'; ctx.strokeStyle = '#c9c9c9'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.ellipse(0, 0, 7, 2.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.restore();
            break;
          case 'emoji':
            ctx.save(); ctx.globalAlpha = Math.min(1, a * 2);
            ctx.translate(p.x, p.y); ctx.rotate(p.rot);
            ctx.font = `${p.size}px ${EF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(p.text, 0, 0);
            ctx.restore();
            break;
          case 'text': {
            ctx.save(); ctx.globalAlpha = Math.min(1, a * 2.5);
            ctx.translate(p.x, p.y); ctx.rotate(p.rot);
            const sc = a > 0.85 ? 1 + (a - 0.85) * 3 : 1;
            ctx.scale(sc, sc);
            ctx.font = `${p.size}px ${TITLE}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            outlinedText(ctx, p.text, 0, 0, p.color, '#2a1830', Math.max(3, p.size / 6));
            ctx.restore();
            break;
          }
        }
        ctx.globalAlpha = 1;
      }
      this.parts = alive;
    }

    drawHUD(ctx, dt) {
      const g = this.g, T = g.turn, vw = this.vw, vh = this.vh;
      const team = g.teams[T.team], w = g.worms[T.worm];
      ctx.textBaseline = 'middle';
      // bandeau du tour
      if (team && w && T.phase !== 'over' && T.phase !== 'wait') {
        const label = `${w.name}  •  ${team.name}`;
        ctx.font = `600 16px ${UI}`;
        const bw = Math.max(220, ctx.measureText(label).width + 90);
        const bx = vw / 2 - bw / 2, by = 12;
        rrect(ctx, bx, by, bw, 44, 22);
        ctx.fillStyle = team.color; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = '#2a1830'; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
        ctx.fillText(label, bx + 62, by + 22);
        // chrono
        const retreat = T.phase === 'retreat';
        const tv = retreat ? T.retreat : T.phase === 'aim' ? T.timer : 0;
        ctx.beginPath(); ctx.arc(bx + 24, by + 22, 26, 0, Math.PI * 2);
        ctx.fillStyle = retreat ? '#ff9f1c' : tv < 6 && T.phase === 'aim' ? '#ff2d55' : '#fff'; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = '#2a1830'; ctx.stroke();
        ctx.font = `26px ${TITLE}`; ctx.textAlign = 'center';
        ctx.fillStyle = retreat || (tv < 6 && T.phase === 'aim') ? '#fff' : '#2a1830';
        ctx.fillText(T.phase === 'settle' ? '…' : String(Math.max(0, Math.ceil(tv))), bx + 24, by + 25);
        const ct = Math.ceil(tv);
        if (T.phase === 'aim' && ct <= 5 && ct !== this.lastTimer && ct > 0) L.Audio.play('tick');
        this.lastTimer = ct;
        // à qui le tour ?
        if (T.phase === 'aim') {
          const mine = this.isMine(T.team);
          const s = this.me === 'local' ? '' : mine ? '⭐ C\'est ton tour ! ⭐' : `Tour de ${team.name}…`;
          if (s) {
            ctx.font = `600 14px ${UI}`;
            const pulse = mine ? 1 + Math.sin(this.time * 0.008) * 0.06 : 1;
            ctx.save(); ctx.translate(vw / 2, by + 62); ctx.scale(pulse, pulse);
            outlinedText(ctx, s, 0, 0, mine ? '#ffe14d' : '#fff', '#2a1830', 4);
            ctx.restore();
          }
        }
      }
      // vent
      {
        const bw = 150, bx = vw - bw - 14, by = 14;
        rrect(ctx, bx, by, bw, 34, 12);
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = '#2a1830'; ctx.stroke();
        ctx.font = `12px ${TITLE}`; ctx.textAlign = 'center'; ctx.fillStyle = '#2a1830';
        ctx.fillText('VENT', bx + bw / 2, by + 10);
        const cx = bx + bw / 2, len = (g.wind / 0.06) * 62;
        ctx.fillStyle = '#ddd'; ctx.fillRect(bx + 10, by + 19, bw - 20, 8);
        ctx.fillStyle = len > 0 ? '#3a86ff' : '#ff4d6d';
        ctx.fillRect(Math.min(cx, cx + len), by + 19, Math.abs(len), 8);
        ctx.fillStyle = '#2a1830'; ctx.fillRect(cx - 1, by + 16, 2, 14);
        const n = Math.round(Math.abs(len) / 14), dir = Math.sign(len);
        ctx.fillStyle = '#fff';
        for (let i = 0; i < n; i++) {
          const ax = cx + dir * (6 + i * 13 + ((this.time * 0.03) % 13));
          if (Math.abs(ax - cx) > Math.abs(len)) continue;
          ctx.beginPath(); ctx.moveTo(ax, by + 23); ctx.lineTo(ax - dir * 4, by + 19.5); ctx.lineTo(ax - dir * 4, by + 26.5); ctx.fill();
        }
      }
      // santé des équipes
      {
        const maxHp = g.perTeam * 100;
        const rows = g.teams.length, bw = Math.min(260, vw * (this.touchPad ? 0.28 : 0.4));
        const by = vh - 12 - rows * 20;
        ctx.font = `600 12px ${UI}`;
        g.teams.forEach((t, i) => {
          const hp = g.worms.filter((w) => w.team === i && !w.dead).reduce((s, w) => s + w.hp, 0);
          const y = by + i * 20, x = vw / 2 - bw / 2 + 40;
          ctx.textAlign = 'right';
          outlinedText(ctx, t.name + (t.gone ? ' 💤' : ''), x - 8, y + 7, '#fff', '#2a1830', 3);
          rrect(ctx, x, y, bw, 14, 7); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
          if (hp > 0) { rrect(ctx, x, y, Math.max(14, (bw * hp) / maxHp), 14, 7); ctx.fillStyle = t.color; ctx.fill(); }
          ctx.lineWidth = 2; ctx.strokeStyle = '#2a1830'; rrect(ctx, x, y, bw, 14, 7); ctx.stroke();
        });
      }
      // annonces
      if (this.banner) {
        this.banner.t -= dt;
        const b = this.banner;
        const a = L.clamp(b.t / 400, 0, 1), sc = b.t > 2300 ? 1 + (b.t - 2300) / 1200 : 1;
        ctx.save(); ctx.globalAlpha = a;
        ctx.translate(vw / 2, 118); ctx.scale(sc, sc);
        ctx.font = `${Math.min(34, vw / 18)}px ${TITLE}`; ctx.textAlign = 'center';
        outlinedText(ctx, b.s, 0, 0, b.c || '#ffe14d', '#2a1830', 7);
        ctx.restore();
        if (b.t <= 0) this.banner = null;
      }
      if (this.hintMsg) {
        this.hintMsg.t -= dt;
        ctx.save(); ctx.globalAlpha = L.clamp(this.hintMsg.t / 300, 0, 1);
        ctx.font = `600 15px ${UI}`; ctx.textAlign = 'center';
        const tw = ctx.measureText(this.hintMsg.s).width + 30;
        rrect(ctx, vw / 2 - tw / 2, 160, tw, 32, 16); ctx.fillStyle = '#2a1830'; ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillText(this.hintMsg.s, vw / 2, 176);
        ctx.restore();
        if (this.hintMsg.t <= 0) this.hintMsg = null;
      }
    }
  };
})();

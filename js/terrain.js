// Terrain destructible généré à partir d'une graine (identique chez tous les joueurs)
(function () {
  const { W, H, WATER } = L;

  const THEMES = [
    {
      name: 'Prairie Joyeuse', sky: ['#6cc8ff', '#dff6ff'], grass: '#5cc23a', grassHi: '#9be86a', grassDark: '#3f8f27',
      dirt: '#b0703d', dirt2: '#9a5e32', pebble: '#d6a06a', outline: '#3b2414', water: '#2b8fd6', hills: ['#a8e08a', '#7fcf63'],
    },
    {
      name: 'Planète Fromage', sky: ['#ff9f5a', '#ffe8c2'], grass: '#ffe066', grassHi: '#fff6b8', grassDark: '#e0b52a',
      dirt: '#f6c62c', dirt2: '#eab51a', pebble: '#c48e00', outline: '#6b4300', water: '#3fa7a3', hills: ['#ffd08a', '#f5b25c'],
    },
    {
      name: 'Royaume Bonbon', sky: ['#b7a4ff', '#ffe0f3'], grass: '#ff7eb6', grassHi: '#ffc6df', grassDark: '#d94f8f',
      dirt: '#9b5de5', dirt2: '#8749d3', pebble: '#ffd166', outline: '#35115c', water: '#45d6c4', hills: ['#f2b8f7', '#d996ef'],
    },
    {
      name: 'Banquise Rigolote', sky: ['#86b9f2', '#f2f9ff'], grass: '#ffffff', grassHi: '#ffffff', grassDark: '#cfe4f5',
      dirt: '#82b6dd', dirt2: '#6fa3cc', pebble: '#bfe0f6', outline: '#1d3b57', water: '#1f6fb2', hills: ['#dbeefc', '#bcdcf4'],
    },
  ];
  L.THEMES = THEMES;

  L.Terrain = class {
    constructor(seed) {
      this.seed = seed >>> 0;
      const rng = L.rng(this.seed);
      this.theme = THEMES[Math.floor(rng() * THEMES.length)];
      this.solid = new Uint8Array(W * H);
      this.canvas = document.createElement('canvas');
      this.canvas.width = W;
      this.canvas.height = H;
      this.ctx = this.canvas.getContext('2d');
      this.generate(rng);
    }

    isSolid(x, y) {
      x = Math.floor(x); y = Math.floor(y);
      if (x < 0 || x >= W || y < 0 || y >= H) return false;
      return this.solid[y * W + x] === 1;
    }

    setCircle(cx, cy, r, v) {
      const s = this.solid, r2 = r * r;
      const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
      const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
      for (let y = y0; y <= y1; y++) {
        const dy = y - cy;
        for (let x = x0; x <= x1; x++) {
          const dx = x - cx;
          if (dx * dx + dy * dy <= r2) s[y * W + x] = v;
        }
      }
    }

    generate(rng) {
      const s = this.solid;
      const hgt = new Float32Array(W);
      const base = H * 0.5 + rng() * 90;
      const waves = [[110, 0.0022], [65, 0.0052], [28, 0.012], [10, 0.03], [4, 0.07]]
        .map(([a, f]) => [a * (0.6 + rng() * 0.8), f * (0.7 + rng() * 0.6), rng() * Math.PI * 2]);
      const gap = rng() < 0.55 ? { x: W * (0.3 + rng() * 0.4), w: 50 + rng() * 60 } : null;

      for (let x = 0; x < W; x++) {
        let y = base;
        for (const [a, f, p] of waves) y += a * Math.sin(x * f + p);
        const e = Math.min(x, W - 1 - x);
        if (e < 260) y += ((260 - e) * (260 - e)) / 90;
        if (gap) {
          const d = Math.abs(x - gap.x);
          if (d < gap.w * 2) y += Math.pow(1 - d / (gap.w * 2), 1.5) * 650;
        }
        hgt[x] = Math.max(220, y);
        for (let yy = Math.ceil(hgt[x]); yy < H; yy++) s[yy * W + x] = 1;
      }

      // îles flottantes
      const nIsl = Math.floor(rng() * 3);
      for (let k = 0; k < nIsl; k++) {
        const cx = 350 + rng() * (W - 700), cy = 230 + rng() * 170;
        const rw = 80 + rng() * 90, rh = 35 + rng() * 30;
        for (let x = Math.floor(cx - rw); x <= cx + rw; x++) {
          const t = (x - cx) / rw;
          if (Math.abs(t) > 1) continue;
          const top = cy - 10 * Math.sqrt(1 - t * t) + Math.sin(x * 0.08) * 3;
          const bot = cy + rh * (1 - t * t);
          if (bot > hgt[x] - 50) continue;
          for (let y = Math.floor(top); y <= bot; y++) s[y * W + x] = 1;
        }
      }

      // grottes
      const nCaves = 3 + Math.floor(rng() * 5);
      for (let k = 0; k < nCaves; k++) {
        let x = 250 + rng() * (W - 500);
        let y = hgt[Math.floor(x)] + 70 + rng() * 200;
        let ang = rng() * Math.PI * 2;
        const steps = 8 + Math.floor(rng() * 18);
        const r = 16 + rng() * 14;
        for (let i = 0; i < steps; i++) {
          if (y < WATER - 30) this.setCircle(x, y, r * (0.8 + rng() * 0.4), 0);
          x += Math.cos(ang) * r * 0.8;
          y += Math.sin(ang) * r * 0.45;
          ang += (rng() - 0.5) * 1.2;
        }
      }

      this.paint();
    }

    paint() {
      const th = this.theme, s = this.solid, seed = this.seed;
      const C = {};
      for (const k of ['grass', 'grassHi', 'grassDark', 'dirt', 'dirt2', 'pebble', 'outline']) C[k] = L.hexToRgb(th[k]);
      const img = this.ctx.createImageData(W, H);
      const d = img.data;
      const CELL = 28;
      for (let x = 0; x < W; x++) {
        let depth = 0;
        const gd = 13 + Math.sin(x * 0.09) * 3 + Math.sin(x * 0.023) * 2;
        for (let y = 0; y < H; y++) {
          const i = y * W + x;
          if (!s[i]) { depth = 0; continue; }
          depth++;
          let c;
          if (depth < gd) c = depth < 5 ? C.grassHi : C.grass;
          else if (depth < gd + 3) c = C.grassDark;
          else {
            const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
            const h = L.hash2(cx, cy, seed);
            c = null;
            if (h < 0.45) {
              const px = cx * CELL + 7 + L.hash2(cx, cy, seed + 1) * 14;
              const py = cy * CELL + 7 + L.hash2(cx, cy, seed + 2) * 14;
              const pr = 3 + h * 12;
              const dd = (x - px) * (x - px) + (y - py) * (y - py);
              if (dd < pr * pr) c = dd > (pr - 1.6) * (pr - 1.6) ? C.dirt2 : C.pebble;
            }
            if (!c) c = (Math.floor((y + Math.sin(x * 0.05) * 7) / 18) & 1) ? C.dirt : C.dirt2;
          }
          const o = i * 4;
          d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
        }
      }
      // contour cartoon
      const oc = C.outline;
      for (let y = 2; y < H - 2; y++) {
        for (let x = 2; x < W - 2; x++) {
          const i = y * W + x;
          if (s[i] && (!s[i - 2] || !s[i + 2] || !s[i - 2 * W] || !s[i + 2 * W])) {
            const o = i * 4;
            d[o] = oc[0]; d[o + 1] = oc[1]; d[o + 2] = oc[2];
          }
        }
      }
      this.ctx.putImageData(img, 0, 0);
    }

    carve(cx, cy, r) {
      this.setCircle(cx, cy, r, 0);
      const ctx = this.ctx;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.lineWidth = 16;
      ctx.beginPath(); ctx.arc(cx, cy, r + 8, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = this.theme.outline;
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(cx, cy, r + 2, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    normal(x, y, r = 6) {
      let nx = 0, ny = 0;
      for (let dy = -r; dy <= r; dy += 2) {
        for (let dx = -r; dx <= r; dx += 2) {
          if (this.isSolid(x + dx, y + dy)) { nx -= dx; ny -= dy; }
        }
      }
      const l = Math.hypot(nx, ny);
      if (l < 0.001) return { x: 0, y: -1 };
      return { x: nx / l, y: ny / l };
    }
  };
})();

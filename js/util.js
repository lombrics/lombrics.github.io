// Utilitaires partagés
window.L = window.L || {};

L.W = 2560;        // largeur du monde
L.H = 1200;        // hauteur du monde
L.WATER = 1110;    // niveau de l'eau

L.EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';

L.rng = function (seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

L.hash2 = function (x, y, s) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

L.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
L.lerp = (a, b, t) => a + (b - a) * t;
L.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
L.shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
L.hexToRgb = (c) => {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
L.rgba = (c, a) => {
  const [r, g, b] = L.hexToRgb(c);
  return `rgba(${r},${g},${b},${a})`;
};
L.fmt = (s, n) => s.replace(/\{n\}/g, n);

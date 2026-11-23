// Menus, salon, entrées clavier/souris/tactile et boucle principale
(function () {
  const $ = (id) => document.getElementById(id);
  const Net = L.Net;
  const MAX_PLAYERS = 4;

  let game = null;
  let role = null;          // 'local' | 'host' | 'client'
  let myOwner = 'local';
  let players = [];         // salon (hôte) : [{id, name}]
  let inGame = false;
  let localTeams = 2;
  let tickCount = 0;
  const renderer = new L.Renderer($('cv'));
  const keys = { l: 0, r: 0, u: 0, d: 0, fire: 0, jump: 0, bjump: 0 };

  // ---------- utilitaires UI ----------
  function show(id) {
    for (const s of ['menu', 'lobby', 'game']) $(s).classList.toggle('hidden', s !== id);
  }
  let toastT = 0;
  function toast(s) {
    const t = $('toast');
    t.textContent = s; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3000);
  }
  const cleanName = (s) => (String(s || '').replace(/[<>]/g, '').trim().slice(0, 14)) || 'Lombric';
  const myName = () => cleanName($('name').value || 'Lombric');
  const perTeam = () => parseInt($('perTeam').value, 10) || 3;

  try { $('name').value = localStorage.getItem('lombrics.name') || ''; } catch (e) { /* ignore */ }
  $('name').addEventListener('change', () => { try { localStorage.setItem('lombrics.name', $('name').value); } catch (e) { /* ignore */ } });

  const params = new URLSearchParams(location.search);
  const inviteCode = (params.get('join') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  if (inviteCode) {
    $('joinBox').classList.remove('hidden');
    $('joinCodeShow').textContent = inviteCode;
    $('joinCode').value = inviteCode;
  }

  // ---------- démarrage d'une partie ----------
  function beginGame(g) {
    game = g;
    inGame = true;
    tickCount = 0;
    game.onFx = (ev) => {
      renderer.fx(ev);
      if (ev.t === 'over') setTimeout(() => showOver(ev.w), 1500);
      if (ev.t === 'turn') { refreshWeaponPanel(); hidePanel(); }
    };
    if (game.auth) game.inputs[myOwner] = keys;
    renderer.setGame(game, myOwner);
    $('overlay').classList.add('hidden');
    hidePanel();
    show('game');
    updateWeaponBtn(true);
  }

  function startLocal() {
    role = 'local'; myOwner = 'local';
    Net.close();
    const n = localTeams;
    const teams = [];
    for (let i = 0; i < n; i++) teams.push({ name: L.TEAM_NAMES[i], color: L.TEAM_COLORS[i], owner: 'local' });
    const g = new L.Game({ seed: (Math.random() * 2 ** 31) | 0, teams, perTeam: perTeam() }, 'local');
    beginGame(g);
    g.start();
  }

  function hostStart() {
    if (players.length < 2) { toast('Il faut au moins 2 joueurs !'); return; }
    const teams = players.map((p, i) => ({ name: p.name, color: L.TEAM_COLORS[i], owner: p.id }));
    const seed = (Math.random() * 2 ** 31) | 0;
    const g = new L.Game({ seed, teams, perTeam: perTeam() }, 'host');
    const cfg = { seed, teams, perTeam: g.perTeam, worms: g.worms.map((w) => ({ team: w.team, name: w.name, x: w.x, y: w.y })) };
    Net.broadcast({ t: 'start', cfg });
    beginGame(g);
    g.start();
  }

  function showOver(winner) {
    if (!game) return;
    const t = game.teams[winner];
    $('overTitle').textContent = t ? `${t.name} gagne ! 🏆` : 'Match nul ! 🤝';
    $('overTitle').style.color = t ? t.color : '';
    $('overSub').textContent = t ? L.pick(['Quel carnage fruité !', 'Les vers de terre s\'en souviendront.', 'Une victoire croustillante !']) : 'Tout le monde a fini au compost.';
    $('btnAgain').classList.toggle('hidden', role === 'client');
    if (role === 'client') $('overSub').textContent += ' En attente de l\'hôte pour rejouer…';
    $('overlay').classList.remove('hidden');
  }

  function backToMenu() {
    if (role === 'client') Net.send({ t: 'bye' });
    inGame = false; game = null; role = null; players = [];
    Net.close();
    renderer.g = null;
    $('overlay').classList.add('hidden');
    show('menu');
  }

  // ---------- salon (hôte) ----------
  function renderPlayers(list, isHost) {
    const ul = $('players');
    ul.innerHTML = '';
    list.forEach((p, i) => {
      const li = document.createElement('li');
      const dot = document.createElement('span');
      dot.className = 'dot'; dot.style.background = L.TEAM_COLORS[i];
      const nm = document.createElement('span'); nm.textContent = p.name;
      const tag = document.createElement('span'); tag.className = 'tag';
      tag.textContent = i === 0 ? '👑 hôte' : (p.id === Net.myId() ? 'toi' : 'invité');
      li.append(dot, nm, tag);
      ul.appendChild(li);
    });
    for (let i = list.length; i < MAX_PLAYERS; i++) {
      const li = document.createElement('li');
      li.style.opacity = 0.45; li.textContent = '… place libre';
      ul.appendChild(li);
    }
    if (isHost) {
      $('btnStart').classList.remove('hidden');
      $('btnStart').disabled = list.length < 2;
    }
  }

  function broadcastLobby() {
    renderPlayers(players, true);
    Net.broadcast({ t: 'lobby', players });
  }

  const lastSeen = {};
  function dropPlayer(id) {
    const p = players.find((x) => x.id === id);
    if (!p || id === 'host') return;
    players = players.filter((x) => x.id !== id);
    toast(`${p.name} est parti.`);
    if (inGame && game) {
      const ti = game.teams.findIndex((t) => t.owner === id);
      if (ti >= 0) game.markGone(ti);
    } else broadcastLobby();
  }
  // battement de cœur : un invité muet depuis 10 s est considéré comme parti
  setInterval(() => {
    if (role === 'client') Net.send({ t: 'ping' });
    if (role === 'host') {
      const now = Date.now();
      for (const p of players.slice()) {
        if (p.id !== 'host' && lastSeen[p.id] && now - lastSeen[p.id] > 10000) dropPlayer(p.id);
      }
    }
  }, 2000);
  window.addEventListener('pagehide', () => { if (role === 'client') Net.send({ t: 'bye' }); });

  function createOnline() {
    if (!Net.available()) { $('menuError').textContent = 'PeerJS n\'a pas pu être chargé (connexion internet ?).'; return; }
    L.Audio.init();
    role = 'host'; myOwner = 'host';
    players = [{ id: 'host', name: myName() }];
    show('lobby');
    $('lobbyStatus').textContent = 'Création de la partie…';
    $('inviteBox').classList.add('hidden');
    $('btnStart').classList.add('hidden');
    renderPlayers(players, true);
    Net.host({
      onReady(code) {
        $('lobbyStatus').textContent = 'En attente de joueurs…';
        $('inviteBox').classList.remove('hidden');
        $('codeShow').textContent = code;
        const base = location.href.split('?')[0].split('#')[0];
        const q = new URLSearchParams(location.search);
        q.delete('join'); q.set('join', code);
        $('inviteLink').value = `${base}?${q.toString()}`;
        $('btnShare').classList.toggle('hidden', !navigator.share);
        $('btnStart').classList.remove('hidden');
        renderPlayers(players, true);
      },
      onData(conn, msg) {
        if (!msg || typeof msg !== 'object') return;
        lastSeen[conn.peer] = Date.now();
        if (msg.t === 'bye') { dropPlayer(conn.peer); try { conn.close(); } catch (e) { /* ignore */ } return; }
        if (msg.t === 'hello') {
          if (inGame || players.length >= MAX_PLAYERS) {
            conn.send({ t: 'full', s: inGame ? 'La partie a déjà commencé.' : 'La partie est pleine.' });
            setTimeout(() => conn.close(), 300);
            return;
          }
          if (!players.some((p) => p.id === conn.peer)) players.push({ id: conn.peer, name: cleanName(msg.name) });
          broadcastLobby();
          toast(`${cleanName(msg.name)} a rejoint le salon !`);
        } else if (msg.t === 'in' && game) {
          const k = msg.k || {};
          game.inputs[conn.peer] = { l: !!k.l, r: !!k.r, u: !!k.u, d: !!k.d, fire: !!k.fire, jump: !!k.jump, bjump: !!k.bjump };
        } else if (msg.t === 'act' && game) {
          game.action(conn.peer, msg.a);
        }
      },
      onClose(conn) { dropPlayer(conn.peer); },
      onError(e) {
        $('lobbyStatus').textContent = 'Erreur réseau : ' + (e.message || e.type || e);
      },
    });
  }

  function joinOnline(code) {
    code = (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 5) { $('menuError').textContent = 'Le code fait 5 caractères.'; return; }
    if (!Net.available()) { $('menuError').textContent = 'PeerJS n\'a pas pu être chargé (connexion internet ?).'; return; }
    L.Audio.init();
    role = 'client';
    show('lobby');
    $('inviteBox').classList.add('hidden');
    $('btnStart').classList.add('hidden');
    $('players').innerHTML = '';
    $('lobbyStatus').textContent = `Connexion à la partie ${code}…`;
    Net.join(code, {
      onOpen(id) {
        myOwner = id;
        $('lobbyStatus').textContent = 'Connecté ! En attente que l\'hôte lance la partie…';
        Net.send({ t: 'hello', name: myName() });
      },
      onData(msg) {
        if (!msg || typeof msg !== 'object') return;
        if (msg.t === 'lobby') renderPlayers(msg.players, false);
        else if (msg.t === 'full') { toast(msg.s); backToMenu(); }
        else if (msg.t === 'start') {
          const g = new L.Game(msg.cfg, 'client');
          beginGame(g);
        } else if (msg.t === 's' && game) game.apply(msg);
      },
      onClose() {
        if (role === 'client') { toast('L\'hôte a quitté la partie.'); backToMenu(); }
      },
      onError(e) {
        $('lobbyStatus').textContent = (e && e.message) || 'Impossible de se connecter.';
      },
    });
  }

  // ---------- armes ----------
  function act(a) {
    if (!game) return;
    if (game.auth) game.action(myOwner, a);
    else Net.send({ t: 'act', a });
  }
  function canControl() {
    if (!game) return false;
    const t = game.teams[game.turn.team];
    return t && (t.owner === myOwner);
  }

  let selDesc = null;
  function refreshWeaponPanel() {
    const pnl = $('weaponPanel');
    pnl.innerHTML = '<h3>🎒 Arsenal complètement délirant</h3>';
    if (!game) return;
    const team = game.teams[game.turn.team];
    for (const w of L.WEAPONS) {
      const b = document.createElement('button');
      const am = team ? team.ammo[w.id] : -1;
      b.className = 'wpn' + (game.turn.weapon === w.id ? ' sel' : '') + (am === 0 ? ' empty' : '');
      b.innerHTML = `<span class="ic"></span><span class="nm"></span>${am > 0 ? `<span class="am">×${am}</span>` : ''}`;
      b.querySelector('.ic').textContent = w.icon;
      b.querySelector('.nm').textContent = w.name;
      b.title = w.desc;
      b.addEventListener('mouseenter', () => { if (selDesc) selDesc.textContent = `${w.icon} ${w.desc}`; });
      b.addEventListener('click', () => { act({ a: 'weapon', id: w.id }); hidePanel(); });
      pnl.appendChild(b);
    }
    selDesc = document.createElement('p');
    selDesc.className = 'desc';
    selDesc.textContent = 'Survole une arme pour voir ce qu\'elle fait.';
    pnl.appendChild(selDesc);
  }
  function togglePanel() {
    if (!game) return;
    const pnl = $('weaponPanel');
    if (pnl.classList.contains('hidden')) {
      if (!canControl()) { renderer.hintMsg = { s: 'Ce n\'est pas ton tour !', t: 1500 }; return; }
      if (game.turn.phase !== 'aim') { renderer.hintMsg = { s: 'Patience, attends ton prochain tour…', t: 1500 }; return; }
      refreshWeaponPanel();
      pnl.classList.remove('hidden');
    } else hidePanel();
  }
  function hidePanel() { $('weaponPanel').classList.add('hidden'); }

  let lastWeaponKey = '';
  function updateWeaponBtn(force) {
    if (!game) return;
    const T = game.turn, team = game.teams[T.team];
    const wp = L.WEAPON[T.weapon];
    const am = team ? team.ammo[wp.id] : -1;
    const key = wp.id + am;
    if (!force && key === lastWeaponKey) return;
    lastWeaponKey = key;
    $('wIcon').textContent = wp.icon;
    $('wName').textContent = wp.name;
    $('wAmmo').textContent = am > 0 ? '×' + am : '';
  }

  // ---------- entrées ----------
  let lastSent = '';
  function keysChanged() {
    if (role === 'client') {
      const s = JSON.stringify(keys);
      if (s !== lastSent) { lastSent = s; Net.send({ t: 'in', k: Object.assign({}, keys) }); }
    }
  }
  const KEYMAP = {
    ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd',
    Space: 'fire', Enter: 'jump', NumpadEnter: 'jump', Backspace: 'bjump',
  };
  window.addEventListener('keydown', (e) => {
    L.Audio.init();
    if (!inGame || e.target.tagName === 'INPUT') return;
    if (e.code === 'Tab') { e.preventDefault(); togglePanel(); return; }
    if (e.code === 'Escape') { hidePanel(); $('helpPanel').classList.add('hidden'); return; }
    const k = KEYMAP[e.code];
    if (k) { e.preventDefault(); if (!keys[k]) { keys[k] = 1; keysChanged(); } }
  });
  window.addEventListener('keyup', (e) => {
    const k = KEYMAP[e.code];
    if (k && keys[k]) { keys[k] = 0; keysChanged(); }
  });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = 0; keysChanged(); });

  // souris / doigt sur le canvas
  const cv = $('cv');
  let drag = null;
  cv.addEventListener('pointerdown', (e) => {
    L.Audio.init();
    if (e.button === 2) return;
    drag = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 8) drag.moved = true;
    if (drag.moved) { renderer.pan(dx, dy); drag.x = e.clientX; drag.y = e.clientY; }
  });
  cv.addEventListener('pointerup', (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    if (!drag.moved && game) {
      hidePanel();
      const w = renderer.toWorld(e.clientX, e.clientY);
      act({ a: 'click', x: Math.round(w.x), y: Math.round(w.y) });
    }
    drag = null;
  });
  cv.addEventListener('pointercancel', () => { drag = null; });
  cv.addEventListener('contextmenu', (e) => { e.preventDefault(); togglePanel(); });
  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    renderer.userZoom = L.clamp(renderer.userZoom * (e.deltaY > 0 ? 0.9 : 1.1), 0.5, 2.2);
  }, { passive: false });

  // contrôles tactiles
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (isTouch) {
    $('touch').classList.remove('hidden');
    document.body.classList.add('touch');
    renderer.touchPad = true;
  }
  for (const b of document.querySelectorAll('#touch button')) {
    const k = b.dataset.k;
    const on = (e) => { e.preventDefault(); L.Audio.init(); keys[k] = 1; b.classList.add('on'); keysChanged(); };
    const off = (e) => { e.preventDefault(); keys[k] = 0; b.classList.remove('on'); keysChanged(); };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointerleave', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // ---------- boutons ----------
  $('btnLocal').onclick = () => { L.Audio.init(); localTeams = parseInt($('localTeams').value, 10) || 2; startLocal(); };
  $('btnOnline').onclick = () => { $('menuError').textContent = ''; createOnline(); };
  $('btnJoin').onclick = () => { $('menuError').textContent = ''; joinOnline($('joinCode').value); };
  $('btnJoinInvite').onclick = () => { $('menuError').textContent = ''; joinOnline(inviteCode); };
  $('joinCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnJoin').click(); });
  $('btnStart').onclick = hostStart;
  $('btnLeave').onclick = backToMenu;
  $('btnCopy').onclick = async () => {
    const v = $('inviteLink').value;
    try { await navigator.clipboard.writeText(v); toast('Lien copié ! Envoie-le à tes potes 🪱'); }
    catch (e) { $('inviteLink').select(); document.execCommand('copy'); toast('Lien copié !'); }
  };
  $('btnShare').onclick = () => {
    navigator.share({ title: 'Lombrics !', text: 'Viens te battre à coups de baguette et de poules explosives !', url: $('inviteLink').value }).catch(() => {});
  };
  $('btnWeapons').onclick = togglePanel;
  $('btnMute').onclick = () => { L.Audio.muted = !L.Audio.muted; $('btnMute').textContent = L.Audio.muted ? '🔇' : '🔊'; };
  const openHelp = () => $('helpPanel').classList.remove('hidden');
  $('btnHelp').onclick = openHelp;
  $('btnHelpMenu').onclick = openHelp;
  $('btnHelpClose').onclick = () => $('helpPanel').classList.add('hidden');
  $('btnQuit').onclick = () => { if (confirm('Quitter la partie ?')) backToMenu(); };
  $('btnMenu').onclick = backToMenu;
  $('btnAgain').onclick = () => {
    if (role === 'local') startLocal();
    else if (role === 'host') hostStart();
  };

  // ---------- boucle ----------
  let last = performance.now(), acc = 0;
  const STEP = 1000 / 60;
  function loop(t) {
    requestAnimationFrame(loop);
    const dt = Math.min(100, t - last);
    last = t;
    if (!game) return;
    if (game.auth) {
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 6) {
        game.tick();
        acc -= STEP; n++; tickCount++;
        if (role === 'host' && tickCount % 2 === 0) Net.broadcast(game.snapshot());
      }
      if (n === 6) acc = 0;
    } else game.clientUpdate();
    updateWeaponBtn(false);
    renderer.draw(dt);
  }
  requestAnimationFrame(loop);

  // l'hôte continue de simuler quand son onglet est en arrière-plan
  setInterval(() => {
    if (document.hidden && game && role === 'host') {
      for (let i = 0; i < 15; i++) {
        game.tick(); tickCount++;
        if (tickCount % 2 === 0) Net.broadcast(game.snapshot());
      }
    }
  }, 250);

  window.__lombrics = { get game() { return game; }, renderer, keys };
})();

// Réseau pair-à-pair avec PeerJS. L'hôte relaie tout : topologie en étoile.
(function () {
  const PREFIX = 'lombrics-v1-';
  const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const makeCode = () => Array.from({ length: 5 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');

  // Serveur de signalisation personnalisé possible : ?peerhost=monserveur.fr&peerport=443&peerpath=/myapp
  function peerOpts() {
    const q = new URLSearchParams(location.search);
    const o = { debug: 1 };
    if (q.get('peerhost')) {
      o.host = q.get('peerhost');
      o.port = parseInt(q.get('peerport') || '443', 10);
      o.path = q.get('peerpath') || '/';
      o.secure = q.get('peersecure') ? q.get('peersecure') === '1' : o.port === 443;
    }
    return o;
  }

  L.Net = {
    peer: null, conns: [], hostConn: null, isHost: false, code: null,

    available() { return typeof window.Peer === 'function'; },

    host(h) {
      this.close();
      this.isHost = true;
      const tryOpen = (attempt) => {
        const code = makeCode();
        const peer = new Peer(PREFIX + code, peerOpts());
        this.peer = peer;
        peer.on('open', () => { this.code = code; h.onReady(code); });
        peer.on('connection', (c) => {
          c.on('open', () => { this.conns.push(c); h.onConn && h.onConn(c); });
          c.on('data', (d) => h.onData(c, d));
          c.on('close', () => { this.conns = this.conns.filter((x) => x !== c); h.onClose(c); });
          c.on('error', () => {});
        });
        peer.on('error', (e) => {
          if (e.type === 'unavailable-id' && attempt < 5) { peer.destroy(); tryOpen(attempt + 1); return; }
          if (e.type === 'peer-unavailable') return;
          h.onError(e);
        });
        peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { /* ignore */ } });
      };
      tryOpen(0);
    },

    join(code, h) {
      this.close();
      this.isHost = false;
      const peer = new Peer(peerOpts());
      this.peer = peer;
      let opened = false;
      peer.on('open', (id) => {
        const c = peer.connect(PREFIX + code.toUpperCase(), { reliable: true, serialization: 'json' });
        this.hostConn = c;
        c.on('open', () => { opened = true; h.onOpen(id); });
        c.on('data', (d) => h.onData(d));
        c.on('close', () => h.onClose());
        c.on('error', (e) => h.onError(e));
      });
      peer.on('error', (e) => {
        if (e.type === 'peer-unavailable') h.onError({ message: 'Partie introuvable. Vérifie le code !' });
        else if (!opened) h.onError(e);
      });
      setTimeout(() => { if (!opened && this.peer === peer) h.onError({ message: 'Connexion trop longue… réessaie.' }); }, 15000);
    },

    broadcast(msg) { for (const c of this.conns) if (c.open) { try { c.send(msg); } catch (e) { /* ignore */ } } },
    sendTo(id, msg) { const c = this.conns.find((x) => x.peer === id); if (c && c.open) c.send(msg); },
    send(msg) { if (this.hostConn && this.hostConn.open) { try { this.hostConn.send(msg); } catch (e) { /* ignore */ } } },
    myId() { return this.peer ? this.peer.id : null; },

    close() {
      try { if (this.peer) this.peer.destroy(); } catch (e) { /* ignore */ }
      this.peer = null; this.conns = []; this.hostConn = null; this.code = null;
    },
  };
})();

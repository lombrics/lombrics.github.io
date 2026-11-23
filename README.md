# 🪱 Lombrics !

Jeu d'artillerie au tour par tour dans le navigateur : des équipes de vers de terre cartoon s'affrontent sur un terrain destructible avec un arsenal complètement délirant. Multijoueur en **pair-à-pair** grâce à [PeerJS](https://peerjs.com/), sans serveur de jeu.

## Jouer en ligne

👉 **https://lombrics.github.io/lombrics/**

Le site est publié automatiquement sur GitHub Pages à chaque push (workflow `.github/workflows/pages.yml`). Si la page n'apparaît pas après le premier push, active Pages une fois pour toutes : *Settings → Pages → Build and deployment → Source : GitHub Actions*, puis relance le workflow depuis l'onglet *Actions*.

## Jouer en local

C'est un site 100 % statique : il suffit de le servir en HTTP.

```bash
python3 -m http.server 8000
```

Puis ouvrir <http://localhost:8000>. Pour jouer à distance, il faut l'héberger quelque part (GitHub Pages, Netlify…), car le lien d'invitation pointe vers l'adresse de la page.

- **Partie locale** : 2 à 4 équipes sur le même écran, chacun son tour.
- **Partie en ligne** : « Créer une partie en ligne » donne un code et un lien d'invitation à envoyer (4 joueurs max). Les amis ouvrent le lien, cliquent sur « Rejoindre », et l'hôte lance la partie.

## Commandes

| Action | Clavier |
| --- | --- |
| Ramper | ← → ou Q D (A D en QWERTY) |
| Viser | ↑ ↓ ou Z S (W S) |
| Tirer | Espace : maintenir pour charger, relâcher pour tirer |
| Sauter / salto arrière | Entrée / Retour arrière |
| Armes | Tab ou clic droit |
| Cibler | Clic sur la carte |
| Caméra | Glisser pour déplacer, molette pour zoomer |

Sur mobile, des boutons tactiles apparaissent automatiquement.

## Arsenal

🥖 Lance-Baguette · 🐔 Poule Grenade · 🍉 Pastèque à Pépins · 🎉 Pistolet à Confettis · 🐟 Baffe de Poisson · 🧀 Raclette Roulante · 🌭 Saucisse-Dynamite · 🐌 Escargot à Réaction · 🧦 Pluie de Chaussettes · 🎹 Piano à Queue · 🌀 Trou Noir de Poche · 🪩 Boule Disco · 🍕 Téléporteur à Pizza · 😴 Sieste

## Architecture

- `js/terrain.js` : génération du terrain à partir d'une graine (identique chez tous les joueurs) et destruction pixel par pixel.
- `js/game.js` : simulation (physique, armes, tours). L'hôte fait autorité : il simule et envoie ~30 instantanés par seconde ; les explosions sont envoyées comme événements, et chaque client creuse son terrain localement.
- `js/net.js` : PeerJS en topologie étoile (les invités se connectent à l'hôte).
- `js/render.js` : rendu canvas cartoon, particules et interface.
- `js/audio.js` : bruitages synthétisés en WebAudio.

Par défaut, la mise en relation passe par le serveur public de PeerJS (`0.peerjs.com`). Pour utiliser son propre serveur de signalisation : `?peerhost=mon.serveur&peerport=443&peerpath=/`.

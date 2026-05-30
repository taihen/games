# 🎮 games

**Mostly vibe coded for educational purposes**

Some simple browser games, implemented in vanilla HTML/CSS/JS - no build step, no framework.

Live: https://taihen.org/games/

## Run locally

ES modules need HTTP (not `file://`), so serve the folder:

```sh
python3 -m http.server
# open http://localhost:8000
```

## Add a game

1. Create a folder `mygame/` with its own `index.html` + JS.
2. Link back to the menu with `<a href="../">← All games</a>`.
3. Add one entry to `games.js`:

   ```js
   { id: "mygame", title: "My Game", desc: "…", icon: "🎯", path: "mygame/" }
   ```

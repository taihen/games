# 🎮 games

Simple browser games. Vanilla HTML/CSS/JS — no build step, no framework.

Live: https://taihen.github.io/games/

## Layout

```
.
├── index.html        # landing page, renders game cards
├── app.js            # reads the registry, builds the grid
├── games.js          # GAME REGISTRY — add games here
└── snake/            # one self-contained folder per game
    ├── index.html
    └── snake.js
```

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

Push to `main` — GitHub Actions deploys to Pages automatically.

## Styling

Tailwind via play-CDN (`<script src="https://cdn.tailwindcss.com">`). No build.
Note: the CDN logs a "not for production" console warning — fine for this hobby site.

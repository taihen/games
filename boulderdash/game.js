// Boulder Dash — vanilla canvas, tile physics + fireflies. No deps.
(() => {
  // ---- tiles ----
  const EMPTY = " ";
  const DIRT = ".";
  const WALL = "W";
  const BOULDER = "r";
  const DIAMOND = "d";
  const EXIT_C = "E"; // closed
  const EXIT_O = "o"; // open
  const PLAYER = "P";
  const FIRE = "f";
  const EXPL = "*"; // transient explosion

  const SPRITE = {
    [EMPTY]: "",
    [DIRT]: "🟫",
    [WALL]: "🧱",
    [BOULDER]: "🪨",
    [DIAMOND]: "💎",
    [EXIT_C]: "🚪",
    [EXIT_O]: "🚪",
    [PLAYER]: "😀",
    [FIRE]: "👾",
    [EXPL]: "💥",
  };

  // ===========================================================
  // LEVELS come from levels.js (window.BD_LEVELS), loaded before this script.
  // Each: { name, time, need, map } where map is a newline-joined grid.
  // Legend: W steel  . dirt  (space) empty  r boulder  d diamond
  //         P player(one)  E exit  f firefly.  Rows are equal width.
  // ===========================================================
  const LEVELS = window.BD_LEVELS || [];

  // ---- DOM ----
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const els = {
    level: document.getElementById("level"),
    levels: document.getElementById("levels"),
    diamonds: document.getElementById("diamonds"),
    need: document.getElementById("need"),
    time: document.getElementById("time"),
    lives: document.getElementById("lives"),
    overlay: document.getElementById("overlay"),
    reset: document.getElementById("reset"),
  };
  els.levels.textContent = LEVELS.length;

  // ---- runtime state ----
  const CELL = 34;
  const TICK = 130; // ms world tick
  const FIRE_EVERY = 2; // fireflies move every N ticks

  let W, H, grid, px, py;
  let need, collected, timeLeft, lives = 3, levelIdx = 0;
  let wasFalling = new Set();
  let tickCount = 0;
  let state = "play"; // "play" | "dead" | "won" | "complete"
  let acc = 0, secAcc = 0, last = 0;
  let frozenUntil = 0; // pause physics briefly after death

  const pressed = []; // stack of held directions
  const DIRS = {
    ArrowUp: [0, -1], w: [0, -1],
    ArrowDown: [0, 1], s: [0, 1],
    ArrowLeft: [-1, 0], a: [-1, 0],
    ArrowRight: [1, 0], d: [1, 0],
  };

  const idx = (x, y) => y * W + x;
  const inB = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const get = (x, y) => (inB(x, y) ? grid[idx(x, y)] : WALL);
  const set = (x, y, t) => { if (inB(x, y)) grid[idx(x, y)] = t; };
  const rounded = (t) => t === BOULDER || t === DIAMOND || t === WALL;

  function loadLevel(n) {
    const lvl = LEVELS[n];
    const rows = lvl.map.split("\n");
    W = Math.max(...rows.map((r) => r.length));
    H = rows.length;
    grid = new Array(W * H).fill(EMPTY);
    for (let y = 0; y < H; y++) {
      const row = rows[y];
      for (let x = 0; x < W; x++) {
        const ch = x < row.length ? row[x] : WALL;
        if (ch === PLAYER) { px = x; py = y; grid[idx(x, y)] = PLAYER; }
        else grid[idx(x, y)] = ch === EXIT_O ? EXIT_C : ch;
      }
    }
    need = lvl.need;
    collected = 0;
    timeLeft = lvl.time;
    wasFalling = new Set();
    tickCount = 0;
    state = "play";
    hideOverlay();

    canvas.width = W * CELL;
    canvas.height = H * CELL;
    canvas.style.maxWidth = "100%";

    syncHud();
    render();

    if (lvl.name) {
      showOverlay(`Level ${n + 1}: ${lvl.name}`);
      setTimeout(() => { if (state === "play") hideOverlay(); }, 1400);
    }
  }

  function syncHud() {
    els.level.textContent = levelIdx + 1;
    els.diamonds.textContent = collected;
    els.need.textContent = need;
    els.time.textContent = timeLeft;
    els.lives.textContent = lives;
  }

  // ---- player ----
  function tryMove(dx, dy) {
    if (state !== "play") return;
    const nx = px + dx, ny = py + dy;
    const t = get(nx, ny);

    if (t === WALL || t === EXIT_C) return;
    if (t === FIRE) return killPlayer();

    if (t === EMPTY || t === DIRT) {
      step(nx, ny);
    } else if (t === DIAMOND) {
      collected++;
      if (collected >= need) openExit();
      step(nx, ny);
      syncHud();
    } else if (t === EXIT_O) {
      step(nx, ny);
      completeLevel();
    } else if (t === BOULDER && dy === 0) {
      // push horizontally if the cell beyond is empty
      if (get(nx + dx, ny) === EMPTY) {
        set(nx + dx, ny, BOULDER);
        step(nx, ny);
      }
    }
  }

  function step(nx, ny) {
    set(px, py, EMPTY);
    set(nx, ny, PLAYER);
    px = nx; py = ny;
  }

  function openExit() {
    for (let i = 0; i < grid.length; i++) if (grid[i] === EXIT_C) grid[i] = EXIT_O;
  }

  // ---- physics ----
  function physics() {
    const newFalling = new Set();
    for (let y = H - 2; y >= 0; y--) {
      for (let x = 0; x < W; x++) {
        const t = get(x, y);
        if (t !== BOULDER && t !== DIAMOND) continue;
        const below = get(x, y + 1);
        const falling = wasFalling.has(idx(x, y));

        if (below === EMPTY) {
          set(x, y, EMPTY);
          set(x, y + 1, t);
          newFalling.add(idx(x, y + 1));
        } else if (below === PLAYER && falling) {
          killPlayer();
        } else if (below === FIRE && falling) {
          explode(x, y + 1);
        } else if (rounded(below)) {
          // roll off to a side if side and the diagonal-below are both empty
          if (get(x - 1, y) === EMPTY && get(x - 1, y + 1) === EMPTY) {
            set(x, y, EMPTY); set(x - 1, y, t);
            newFalling.add(idx(x - 1, y));
          } else if (get(x + 1, y) === EMPTY && get(x + 1, y + 1) === EMPTY) {
            set(x, y, EMPTY); set(x + 1, y, t);
            newFalling.add(idx(x + 1, y));
          }
        }
      }
    }
    wasFalling = newFalling;
  }

  // ---- fireflies ----
  // left-hand rule patrol; only move into empty cells. Per facing: try left, forward, right, back.
  const FIRE_RULE = {
    "0,-1": [[-1, 0], [0, -1], [1, 0], [0, 1]],
    "1,0": [[0, -1], [1, 0], [0, 1], [-1, 0]],
    "0,1": [[1, 0], [0, 1], [-1, 0], [0, -1]],
    "-1,0": [[0, 1], [-1, 0], [0, -1], [1, 0]],
  };
  let fireDir = new Map(); // idx -> [dx,dy]

  function moveFireflies() {
    const flies = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) if (get(x, y) === FIRE) flies.push([x, y]);

    for (const [x, y] of flies) {
      if (get(x, y) !== FIRE) continue; // exploded mid-loop
      const key = idx(x, y);
      let dir = fireDir.get(key) || [0, 1];
      const opts = FIRE_RULE[dir.join(",")] || FIRE_RULE["0,1"];
      let moved = false;
      for (const [dx, dy] of opts) {
        const tx = x + dx, ty = y + dy;
        const tt = get(tx, ty);
        if (tt === EMPTY) {
          set(x, y, EMPTY); set(tx, ty, FIRE);
          fireDir.delete(key);
          fireDir.set(idx(tx, ty), [dx, dy]);
          moved = true;
          break;
        }
        if (tt === PLAYER) return killPlayer();
      }
      if (!moved) fireDir.set(key, dir);
    }

    // explode if a firefly is adjacent to the player (8-neighborhood)
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        if (get(px + dx, py + dy) === FIRE) return killPlayer();
  }

  function explode(cx, cy) {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx, y = cy + dy;
        if (!inB(x, y) || get(x, y) === WALL) continue;
        set(x, y, EXPL);
      }
    // explosions clear to empty next physics pass
    setTimeout(() => {
      for (let i = 0; i < grid.length; i++) if (grid[i] === EXPL) grid[i] = EMPTY;
      if (state === "play") render();
    }, 250);
  }

  // ---- life cycle ----
  function killPlayer() {
    if (state !== "play") return;
    state = "dead";
    explode(px, py);
    frozenUntil = perfNow() + 900;
    render();
    setTimeout(() => {
      lives--;
      syncHud();
      if (lives <= 0) {
        lives = 3;
        levelIdx = 0;
        showOverlay("Out of lives — back to level 1. Press Restart or move.");
      }
      loadLevel(levelIdx);
    }, 900);
  }

  function completeLevel() {
    state = "complete";
    if (levelIdx + 1 >= LEVELS.length) {
      state = "won";
      showOverlay("🏆 You cleared all levels! Press Restart to play again.");
      levelIdx = 0;
      return;
    }
    levelIdx++;
    showOverlay(`Level ${levelIdx} cleared! Loading next…`);
    setTimeout(() => loadLevel(levelIdx), 900);
  }

  function timeUp() {
    showOverlay("⏱ Out of time!");
    killPlayer();
  }

  // ---- render ----
  function render() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${CELL - 4}px sans-serif`;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = get(x, y);
        const s = SPRITE[t];
        if (!s) continue;
        ctx.globalAlpha = t === EXIT_C ? 0.45 : 1;
        ctx.fillText(s, x * CELL + CELL / 2, y * CELL + CELL / 2 + 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- loop ----
  // performance.now wrapper (avoids direct Date use)
  function perfNow() { return performance.now(); }

  function loop(ts) {
    requestAnimationFrame(loop);
    if (!last) last = ts;
    const dt = ts - last;
    last = ts;

    if (state !== "play") { render(); return; }
    if (perfNow() < frozenUntil) { render(); return; }

    acc += dt;
    secAcc += dt;

    while (secAcc >= 1000) {
      secAcc -= 1000;
      timeLeft--;
      syncHud();
      if (timeLeft <= 0) { timeUp(); return; }
    }

    while (acc >= TICK) {
      acc -= TICK;
      tickCount++;
      // consume held direction
      const dir = pressed[pressed.length - 1];
      if (dir) tryMove(dir[0], dir[1]);
      if (state !== "play") break;
      physics();
      if (state !== "play") break;
      if (tickCount % FIRE_EVERY === 0) moveFireflies();
      if (state !== "play") break;
    }
    render();
  }

  // ---- overlay ----
  function showOverlay(msg) { els.overlay.textContent = msg; els.overlay.classList.remove("hidden"); }
  function hideOverlay() { els.overlay.classList.add("hidden"); }

  // ---- input ----
  window.addEventListener("keydown", (e) => {
    const d = DIRS[e.key];
    if (!d) return;
    e.preventDefault();
    // de-dupe, push to top of held stack
    removeDir(d);
    pressed.push(d);
    if (state === "won") { lives = 3; loadLevel(0); }
  });
  window.addEventListener("keyup", (e) => {
    const d = DIRS[e.key];
    if (d) removeDir(d);
  });
  function removeDir(d) {
    for (let i = pressed.length - 1; i >= 0; i--)
      if (pressed[i][0] === d[0] && pressed[i][1] === d[1]) pressed.splice(i, 1);
  }

  // touch: tap a direction relative to player on canvas
  canvas.addEventListener("pointerdown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    const cx = (e.clientX - rect.left) * scale;
    const cy = (e.clientY - rect.top) * scale;
    const dx = cx - (px * CELL + CELL / 2);
    const dy = cy - (py * CELL + CELL / 2);
    if (Math.abs(dx) > Math.abs(dy)) tryMove(dx > 0 ? 1 : -1, 0);
    else tryMove(0, dy > 0 ? 1 : -1);
    if (state === "won") { lives = 3; loadLevel(0); }
  });

  els.reset.addEventListener("click", () => { loadLevel(levelIdx); });

  loadLevel(0);
  requestAnimationFrame(loop);
})();

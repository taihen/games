// 2048 — vanilla, DOM-rendered. No deps.
(() => {
  const SIZE = 4;
  const GAP = 12; // px, must match board padding/gap
  const CELL = 72; // px per tile

  const boardEl = document.getElementById("board");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const overlay = document.getElementById("overlay");
  const newBtn = document.getElementById("new");

  const BEST_KEY = "2048.best";
  let best = Number(localStorage.getItem(BEST_KEY) || 0);
  bestEl.textContent = best;

  // value -> {bg, text} tailwind-ish colors
  const COLORS = {
    2: ["#eee4da", "#776e65"],
    4: ["#ede0c8", "#776e65"],
    8: ["#f2b179", "#f9f6f2"],
    16: ["#f59563", "#f9f6f2"],
    32: ["#f67c5f", "#f9f6f2"],
    64: ["#f65e3b", "#f9f6f2"],
    128: ["#edcf72", "#f9f6f2"],
    256: ["#edcc61", "#f9f6f2"],
    512: ["#edc850", "#f9f6f2"],
    1024: ["#edc53f", "#f9f6f2"],
    2048: ["#edc22e", "#f9f6f2"],
  };
  const bigColor = ["#3c3a32", "#f9f6f2"];

  let grid; // SIZE*SIZE array of numbers (0 = empty)
  let score;
  let won;
  let over;

  // ---- board sizing ----
  const dim = SIZE * CELL + (SIZE + 1) * GAP;
  boardEl.style.width = dim + "px";
  boardEl.style.height = dim + "px";
  boardEl.style.padding = "0";

  // static background cells
  for (let i = 0; i < SIZE * SIZE; i++) {
    const c = document.createElement("div");
    c.className = "tile";
    c.style.position = "absolute";
    c.style.width = CELL + "px";
    c.style.height = CELL + "px";
    c.style.background = "rgba(255,255,255,0.05)";
    const { x, y } = cellPos(i % SIZE, Math.floor(i / SIZE));
    c.style.left = x + "px";
    c.style.top = y + "px";
    boardEl.appendChild(c);
  }
  const tileLayer = document.createElement("div");
  tileLayer.style.position = "absolute";
  tileLayer.style.inset = "0";
  boardEl.appendChild(tileLayer);

  function cellPos(col, row) {
    return { x: GAP + col * (CELL + GAP), y: GAP + row * (CELL + GAP) };
  }

  function idx(col, row) {
    return row * SIZE + col;
  }

  function emptyCells() {
    const out = [];
    for (let i = 0; i < grid.length; i++) if (grid[i] === 0) out.push(i);
    return out;
  }

  function spawn() {
    const empty = emptyCells();
    if (empty.length === 0) return;
    const at = empty[Math.floor(Math.random() * empty.length)];
    grid[at] = Math.random() < 0.9 ? 2 : 4;
    return at;
  }

  // Slide+merge one line (array of 4) toward index 0. Returns {line, gained, moved}.
  function collapse(line) {
    const nums = line.filter((n) => n !== 0);
    const out = [];
    let gained = 0;
    for (let i = 0; i < nums.length; i++) {
      if (i + 1 < nums.length && nums[i] === nums[i + 1]) {
        const merged = nums[i] * 2;
        out.push(merged);
        gained += merged;
        i++; // skip the consumed neighbor
      } else {
        out.push(nums[i]);
      }
    }
    while (out.length < SIZE) out.push(0);
    const moved = out.some((v, i) => v !== line[i]);
    return { line: out, gained, moved };
  }

  // Extract a line from grid given direction. Returns array oriented so index 0 = where tiles move toward.
  function getLine(i, dir) {
    const line = [];
    for (let k = 0; k < SIZE; k++) {
      if (dir === "left") line.push(grid[idx(k, i)]);
      else if (dir === "right") line.push(grid[idx(SIZE - 1 - k, i)]);
      else if (dir === "up") line.push(grid[idx(i, k)]);
      else line.push(grid[idx(i, SIZE - 1 - k)]); // down
    }
    return line;
  }

  function setLine(i, dir, line) {
    for (let k = 0; k < SIZE; k++) {
      if (dir === "left") grid[idx(k, i)] = line[k];
      else if (dir === "right") grid[idx(SIZE - 1 - k, i)] = line[k];
      else if (dir === "up") grid[idx(i, k)] = line[k];
      else grid[idx(i, SIZE - 1 - k)] = line[k];
    }
  }

  function move(dir) {
    if (over) return;
    let moved = false;
    let gained = 0;
    for (let i = 0; i < SIZE; i++) {
      const res = collapse(getLine(i, dir));
      if (res.moved) moved = true;
      gained += res.gained;
      setLine(i, dir, res.line);
    }
    if (!moved) return;

    score += gained;
    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
    }
    const spawned = spawn();
    render(spawned);

    if (!won && grid.includes(2048)) {
      won = true;
      showOverlay("You hit 2048! 🎉 Keep going.");
    }
    if (!hasMoves()) {
      over = true;
      showOverlay(`Game over — score ${score}. Press New game.`);
    }
  }

  function hasMoves() {
    if (emptyCells().length > 0) return true;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const v = grid[idx(c, r)];
        if (c + 1 < SIZE && grid[idx(c + 1, r)] === v) return true;
        if (r + 1 < SIZE && grid[idx(c, r + 1)] === v) return true;
      }
    }
    return false;
  }

  function render(popAt) {
    scoreEl.textContent = score;
    bestEl.textContent = best;
    tileLayer.innerHTML = "";
    for (let i = 0; i < grid.length; i++) {
      const v = grid[i];
      if (v === 0) continue;
      const el = document.createElement("div");
      el.className = "tile" + (i === popAt ? " pop" : "");
      el.textContent = v;
      const [bg, fg] = COLORS[v] || bigColor;
      const { x, y } = cellPos(i % SIZE, Math.floor(i / SIZE));
      el.style.position = "absolute";
      el.style.left = x + "px";
      el.style.top = y + "px";
      el.style.width = CELL + "px";
      el.style.height = CELL + "px";
      el.style.background = bg;
      el.style.color = fg;
      el.style.fontSize = v >= 1024 ? "1.4rem" : v >= 128 ? "1.7rem" : "2rem";
      tileLayer.appendChild(el);
    }
  }

  function showOverlay(msg) {
    overlay.textContent = msg;
    overlay.classList.remove("hidden");
  }
  function hideOverlay() {
    overlay.classList.add("hidden");
  }

  function reset() {
    grid = new Array(SIZE * SIZE).fill(0);
    score = 0;
    won = false;
    over = false;
    spawn();
    spawn();
    hideOverlay();
    render();
  }

  // ---- input ----
  const KEYS = {
    ArrowLeft: "left", a: "left",
    ArrowRight: "right", d: "right",
    ArrowUp: "up", w: "up",
    ArrowDown: "down", s: "down",
  };
  window.addEventListener("keydown", (e) => {
    const dir = KEYS[e.key];
    if (!dir) return;
    e.preventDefault();
    move(dir);
  });

  // swipe
  let tStart = null;
  boardEl.addEventListener("pointerdown", (e) => {
    tStart = { x: e.clientX, y: e.clientY };
  });
  boardEl.addEventListener("pointerup", (e) => {
    if (!tStart) return;
    const dx = e.clientX - tStart.x;
    const dy = e.clientY - tStart.y;
    tStart = null;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? "right" : "left");
    else move(dy > 0 ? "down" : "up");
  });

  newBtn.addEventListener("click", reset);

  reset();
})();

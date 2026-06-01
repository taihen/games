// Jewels — match-3, vanilla DOM. No deps.
(() => {
  const N = 8; // grid size
  const GEMS = ["🔴", "🟠", "🟡", "🟢", "🔵", "🟣"];
  const K = GEMS.length;
  const CELL = 42; // px

  const boardEl = document.getElementById("board");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const newBtn = document.getElementById("new");

  const BEST_KEY = "jewels.best";
  let best = Number(localStorage.getItem(BEST_KEY) || 0);
  bestEl.textContent = best;

  let grid; // N*N of type index (0..K-1), -1 = empty
  let cells; // DOM nodes
  let score;
  let busy = false; // block input during cascades
  let sel = null; // {r,c} selected gem

  const idx = (r, c) => r * N + c;
  const inB = (r, c) => r >= 0 && c >= 0 && r < N && c < N;
  const rnd = () => Math.floor(Math.random() * K);

  // ---- build DOM ----
  boardEl.style.gridTemplateColumns = `repeat(${N}, ${CELL}px)`;
  cells = [];
  for (let i = 0; i < N * N; i++) {
    const el = document.createElement("div");
    el.className = "gem";
    el.style.width = CELL + "px";
    el.style.height = CELL + "px";
    el.style.fontSize = CELL * 0.62 + "px";
    const r = Math.floor(i / N), c = i % N;
    el.addEventListener("click", () => onTap(r, c));
    attachSwipe(el, r, c);
    cells.push(el);
    boardEl.appendChild(el);
  }

  // ---- generate a board with no initial matches ----
  function fillNoMatch() {
    grid = new Array(N * N);
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        let t;
        do {
          t = rnd();
        } while (
          (c >= 2 && grid[idx(r, c - 1)] === t && grid[idx(r, c - 2)] === t) ||
          (r >= 2 && grid[idx(r - 1, c)] === t && grid[idx(r - 2, c)] === t)
        );
        grid[idx(r, c)] = t;
      }
    }
  }

  function newGame() {
    score = 0;
    sel = null;
    busy = false;
    scoreEl.textContent = 0;
    do {
      fillNoMatch();
    } while (!hasMove());
    render();
  }

  // ---- matching ----
  function findMatches() {
    const m = new Set();
    // horizontal
    for (let r = 0; r < N; r++) {
      let run = 1;
      for (let c = 1; c <= N; c++) {
        const same = c < N && grid[idx(r, c)] === grid[idx(r, c - 1)] && grid[idx(r, c)] !== -1;
        if (same) run++;
        else {
          if (run >= 3) for (let k = 1; k <= run; k++) m.add(idx(r, c - k));
          run = 1;
        }
      }
    }
    // vertical
    for (let c = 0; c < N; c++) {
      let run = 1;
      for (let r = 1; r <= N; r++) {
        const same = r < N && grid[idx(r, c)] === grid[idx(r - 1, c)] && grid[idx(r, c)] !== -1;
        if (same) run++;
        else {
          if (run >= 3) for (let k = 1; k <= run; k++) m.add(idx(r - k, c));
          run = 1;
        }
      }
    }
    return m;
  }

  // does any single adjacent swap create a match?
  function hasMove() {
    const swap = (a, b) => { const t = grid[a]; grid[a] = grid[b]; grid[b] = t; };
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        for (const [dr, dc] of [[0, 1], [1, 0]]) {
          const nr = r + dr, nc = c + dc;
          if (!inB(nr, nc)) continue;
          const a = idx(r, c), b = idx(nr, nc);
          swap(a, b);
          const ok = findMatches().size > 0;
          swap(a, b);
          if (ok) return true;
        }
      }
    }
    return false;
  }

  // ---- input ----
  function onTap(r, c) {
    if (busy) return;
    if (!sel) {
      sel = { r, c };
      paintSel();
      return;
    }
    if (sel.r === r && sel.c === c) {
      sel = null;
      paintSel();
      return;
    }
    const adjacent = Math.abs(sel.r - r) + Math.abs(sel.c - c) === 1;
    if (adjacent) {
      const from = { ...sel };
      sel = null;
      paintSel();
      attemptSwap(from, { r, c });
    } else {
      sel = { r, c }; // reselect
      paintSel();
    }
  }

  function attachSwipe(el, r, c) {
    let start = null;
    el.addEventListener("pointerdown", (e) => { start = { x: e.clientX, y: e.clientY }; });
    el.addEventListener("pointerup", (e) => {
      if (!start || busy) { start = null; return; }
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      start = null;
      if (Math.abs(dx) < 14 && Math.abs(dy) < 14) return; // treat as click
      let tr = r, tc = c;
      if (Math.abs(dx) > Math.abs(dy)) tc += dx > 0 ? 1 : -1;
      else tr += dy > 0 ? 1 : -1;
      if (inB(tr, tc)) {
        sel = null;
        paintSel();
        attemptSwap({ r, c }, { r: tr, c: tc });
      }
    });
  }

  function attemptSwap(a, b) {
    busy = true;
    const ia = idx(a.r, a.c), ib = idx(b.r, b.c);
    [grid[ia], grid[ib]] = [grid[ib], grid[ia]];
    render();

    if (findMatches().size === 0) {
      // invalid — swap back with a shake
      cells[ia].classList.add("shake");
      cells[ib].classList.add("shake");
      setTimeout(() => {
        [grid[ia], grid[ib]] = [grid[ib], grid[ia]];
        cells[ia].classList.remove("shake");
        cells[ib].classList.remove("shake");
        render();
        busy = false;
      }, 220);
      return;
    }
    setTimeout(() => resolve(1), 140);
  }

  // ---- cascade resolution ----
  function resolve(chain) {
    const m = findMatches();
    if (m.size === 0) {
      if (!hasMove()) {
        // deadlock — reshuffle keeping score
        do { fillNoMatch(); } while (!hasMove());
        render();
      }
      busy = false;
      return;
    }

    // score: 10 per gem, scaled by chain depth
    score += m.size * 10 * chain;
    scoreEl.textContent = score;
    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
      bestEl.textContent = best;
    }

    m.forEach((i) => cells[i].classList.add("clear"));

    setTimeout(() => {
      m.forEach((i) => { grid[i] = -1; cells[i].classList.remove("clear"); });
      gravity();
      render();
      setTimeout(() => resolve(chain + 1), 160);
    }, 180);
  }

  function gravity() {
    for (let c = 0; c < N; c++) {
      let write = N - 1;
      for (let r = N - 1; r >= 0; r--) {
        if (grid[idx(r, c)] !== -1) {
          grid[idx(write, c)] = grid[idx(r, c)];
          if (write !== r) grid[idx(r, c)] = -1;
          write--;
        }
      }
      for (let r = write; r >= 0; r--) grid[idx(r, c)] = rnd(); // refill top
    }
  }

  // ---- render ----
  function render() {
    for (let i = 0; i < grid.length; i++) {
      cells[i].textContent = grid[i] === -1 ? "" : GEMS[grid[i]];
    }
    paintSel();
  }
  function paintSel() {
    cells.forEach((el) => el.classList.remove("sel"));
    if (sel) cells[idx(sel.r, sel.c)].classList.add("sel");
  }

  newBtn.addEventListener("click", newGame);
  newGame();
})();

// Minesweeper — vanilla, DOM grid. No deps.
(() => {
  const LEVELS = {
    easy: { rows: 9, cols: 9, mines: 10 },
    medium: { rows: 16, cols: 16, mines: 40 },
    hard: { rows: 16, cols: 30, mines: 99 },
  };
  const CELL = 30; // px

  const boardEl = document.getElementById("board");
  const minesEl = document.getElementById("mines");
  const timeEl = document.getElementById("time");
  const resetBtn = document.getElementById("reset");
  const diffSel = document.getElementById("difficulty");

  let rows, cols, mineCount;
  let mine, revealed, flagged, adj; // flat boolean/number arrays
  let cells; // DOM nodes
  let started, dead, won, flags;
  let timer = null;
  let seconds = 0;

  const idx = (r, c) => r * cols + c;
  const inBounds = (r, c) => r >= 0 && c >= 0 && r < rows && c < cols;

  function neighbors(r, c) {
    const out = [];
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        if (inBounds(r + dr, c + dc)) out.push([r + dr, c + dc]);
      }
    return out;
  }

  function startTimer() {
    stopTimer();
    timer = setInterval(() => {
      seconds++;
      timeEl.textContent = seconds;
    }, 1000);
  }
  function stopTimer() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function newGame() {
    const lvl = LEVELS[diffSel.value];
    rows = lvl.rows;
    cols = lvl.cols;
    mineCount = lvl.mines;

    const n = rows * cols;
    mine = new Array(n).fill(false);
    revealed = new Array(n).fill(false);
    flagged = new Array(n).fill(false);
    adj = new Array(n).fill(0);

    started = false;
    dead = false;
    won = false;
    flags = 0;
    seconds = 0;
    stopTimer();
    timeEl.textContent = "0";
    minesEl.textContent = mineCount;
    resetBtn.textContent = "🙂";

    buildBoard();
  }

  function buildBoard() {
    boardEl.style.gridTemplateColumns = `repeat(${cols}, ${CELL}px)`;
    boardEl.innerHTML = "";
    cells = [];
    for (let i = 0; i < rows * cols; i++) {
      const el = document.createElement("div");
      el.className = "cell bg-slate-500 hover:bg-slate-400";
      el.style.width = CELL + "px";
      el.style.height = CELL + "px";
      el.style.fontSize = CELL * 0.55 + "px";
      const r = Math.floor(i / cols);
      const c = i % cols;
      el.addEventListener("click", () => reveal(r, c));
      el.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        toggleFlag(r, c);
      });
      attachLongPress(el, r, c);
      cells.push(el);
      boardEl.appendChild(el);
    }
  }

  // long-press = flag on touch
  function attachLongPress(el, r, c) {
    let t = null;
    let longFired = false;
    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse") return;
      longFired = false;
      t = setTimeout(() => {
        longFired = true;
        toggleFlag(r, c);
      }, 350);
    });
    const cancel = () => t && (clearTimeout(t), (t = null));
    el.addEventListener("pointerup", (e) => {
      if (e.pointerType === "mouse") return;
      cancel();
      if (longFired) e.preventDefault();
    });
    el.addEventListener("pointerleave", cancel);
    el.addEventListener("pointercancel", cancel);
  }

  function placeMines(safeR, safeC) {
    // exclude first-clicked cell and its neighbors so first click opens space
    const banned = new Set([idx(safeR, safeC)]);
    neighbors(safeR, safeC).forEach(([r, c]) => banned.add(idx(r, c)));

    let placed = 0;
    while (placed < mineCount) {
      const i = Math.floor(Math.random() * rows * cols);
      if (mine[i] || banned.has(i)) continue;
      mine[i] = true;
      placed++;
    }
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        if (mine[idx(r, c)]) continue;
        adj[idx(r, c)] = neighbors(r, c).filter(([nr, nc]) => mine[idx(nr, nc)]).length;
      }
  }

  function reveal(r, c) {
    if (dead || won) return;
    const i = idx(r, c);
    if (flagged[i] || revealed[i]) return;

    if (!started) {
      started = true;
      placeMines(r, c);
      startTimer();
    }

    if (mine[i]) {
      revealed[i] = true;
      dead = true;
      stopTimer();
      resetBtn.textContent = "💀";
      revealAllMines(i);
      return;
    }

    floodFill(r, c);
    checkWin();
  }

  function floodFill(r, c) {
    const stack = [[r, c]];
    while (stack.length) {
      const [cr, cc] = stack.pop();
      const ci = idx(cr, cc);
      if (revealed[ci] || flagged[ci]) continue;
      revealed[ci] = true;
      paint(ci, cr, cc);
      if (adj[ci] === 0) {
        neighbors(cr, cc).forEach(([nr, nc]) => {
          if (!revealed[idx(nr, nc)]) stack.push([nr, nc]);
        });
      }
    }
  }

  function paint(i, r, c) {
    const el = cells[i];
    el.className = "cell bg-slate-800";
    el.textContent = "";
    const a = adj[i];
    if (a > 0) {
      el.textContent = a;
      el.classList.add("n" + a);
    }
  }

  function toggleFlag(r, c) {
    if (dead || won) return;
    const i = idx(r, c);
    if (revealed[i]) return;
    flagged[i] = !flagged[i];
    flags += flagged[i] ? 1 : -1;
    cells[i].textContent = flagged[i] ? "🚩" : "";
    minesEl.textContent = mineCount - flags;
  }

  function revealAllMines(hitIndex) {
    for (let i = 0; i < mine.length; i++) {
      if (mine[i]) {
        cells[i].textContent = "💣";
        cells[i].className = "cell " + (i === hitIndex ? "bg-red-600" : "bg-slate-800");
      } else if (flagged[i]) {
        cells[i].textContent = "❌"; // wrong flag
      }
    }
  }

  function checkWin() {
    const safe = rows * cols - mineCount;
    let openCount = 0;
    for (let i = 0; i < revealed.length; i++) if (revealed[i]) openCount++;
    if (openCount === safe) {
      won = true;
      stopTimer();
      resetBtn.textContent = "😎";
      // flag remaining mines for clarity
      for (let i = 0; i < mine.length; i++) {
        if (mine[i] && !flagged[i]) {
          cells[i].textContent = "🚩";
          flagged[i] = true;
        }
      }
      minesEl.textContent = 0;
    }
  }

  resetBtn.addEventListener("click", newGame);
  diffSel.addEventListener("change", newGame);
  // block page context menu over board area
  boardEl.addEventListener("contextmenu", (e) => e.preventDefault());

  newGame();
})();

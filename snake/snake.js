// Snake — vanilla canvas. No deps.
(() => {
  const COLS = 20;
  const ROWS = 20;
  const CELL = 20; // px
  const SPEED = 8; // moves per second

  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  canvas.width = COLS * CELL;
  canvas.height = ROWS * CELL;

  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const overlay = document.getElementById("overlay");

  const BEST_KEY = "snake.best";
  let best = Number(localStorage.getItem(BEST_KEY) || 0);
  bestEl.textContent = best;

  let snake, dir, nextDir, food, score, alive, running;
  let acc = 0; // time accumulator
  let last = 0;

  function reset() {
    snake = [{ x: 10, y: 10 }];
    dir = { x: 1, y: 0 };
    nextDir = dir;
    score = 0;
    alive = true;
    placeFood();
    scoreEl.textContent = score;
    hideOverlay();
  }

  function placeFood() {
    do {
      food = {
        x: Math.floor(Math.random() * COLS),
        y: Math.floor(Math.random() * ROWS),
      };
    } while (snake.some((s) => s.x === food.x && s.y === food.y));
  }

  function step() {
    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    // wall or self collision = death
    const hitWall =
      head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS;
    const hitSelf = snake.some((s) => s.x === head.x && s.y === head.y);
    if (hitWall || hitSelf) {
      alive = false;
      gameOver();
      return;
    }

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
      score += 1;
      scoreEl.textContent = score;
      placeFood();
    } else {
      snake.pop();
    }
  }

  function draw() {
    ctx.fillStyle = "#0f172a"; // slate-900
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // food
    ctx.fillStyle = "#f87171"; // red-400
    fillCell(food.x, food.y);

    // snake
    snake.forEach((s, i) => {
      ctx.fillStyle = i === 0 ? "#4ade80" : "#22c55e"; // green head/body
      fillCell(s.x, s.y);
    });
  }

  function fillCell(x, y) {
    ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
  }

  function gameOver() {
    running = false;
    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
      bestEl.textContent = best;
    }
    showOverlay(`Game over — score ${score}. Press Space to play again.`);
  }

  function showOverlay(msg) {
    overlay.textContent = msg;
    overlay.classList.remove("hidden");
  }
  function hideOverlay() {
    overlay.classList.add("hidden");
  }

  function loop(ts) {
    if (!running) return;
    const dt = (ts - last) / 1000;
    last = ts;
    acc += dt;
    const interval = 1 / SPEED;
    while (acc >= interval) {
      acc -= interval;
      if (alive) step();
    }
    draw();
    requestAnimationFrame(loop);
  }

  function start() {
    reset();
    running = true;
    acc = 0;
    last = performance.now();
    requestAnimationFrame(loop);
  }

  const DIRS = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    w: { x: 0, y: -1 },
    s: { x: 0, y: 1 },
    a: { x: -1, y: 0 },
    d: { x: 1, y: 0 },
  };

  window.addEventListener("keydown", (e) => {
    if (e.key === " ") {
      e.preventDefault();
      if (!running) start();
      return;
    }
    const nd = DIRS[e.key];
    if (!nd) return;
    e.preventDefault();
    // block 180° reversal
    if (nd.x === -dir.x && nd.y === -dir.y) return;
    nextDir = nd;
  });

  // tap to start/restart on touch devices
  canvas.addEventListener("pointerdown", () => {
    if (!running) start();
  });

  // initial idle frame
  reset();
  draw();
  showOverlay("Press Space or tap to start.");
})();

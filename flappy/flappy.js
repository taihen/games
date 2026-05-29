// Flap — vanilla canvas, one-button arcade. No deps.
(() => {
  const W = 400;
  const H = 600;
  const GROUND = 80;

  // physics (px, px/s)
  const GRAVITY = 1400;
  const FLAP_V = -430;
  const PIPE_SPEED = 170;
  const PIPE_GAP = 160;
  const PIPE_W = 64;
  const PIPE_INTERVAL = 1.5; // seconds between spawns
  const BIRD_X = 110;
  const BIRD_R = 16;

  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  canvas.width = W;
  canvas.height = H;
  canvas.style.maxWidth = "100%";

  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");

  const BEST_KEY = "flappy.best";
  let best = Number(localStorage.getItem(BEST_KEY) || 0);
  bestEl.textContent = best;

  // state: "idle" | "playing" | "dead"
  let state, birdY, birdV, pipes, score, spawnAcc, last, wingT;

  function reset() {
    state = "idle";
    birdY = H / 2;
    birdV = 0;
    pipes = [];
    score = 0;
    spawnAcc = PIPE_INTERVAL; // spawn first pipe soon
    wingT = 0;
    scoreEl.textContent = 0;
  }

  function flap() {
    if (state === "idle") {
      state = "playing";
      last = performance.now();
      requestAnimationFrame(loop);
    }
    if (state === "playing") {
      birdV = FLAP_V;
      wingT = 0.12;
    } else if (state === "dead") {
      reset();
      draw();
    }
  }

  function spawnPipe() {
    const margin = 60;
    const gapY =
      margin + Math.random() * (H - GROUND - PIPE_GAP - margin * 2) + margin;
    pipes.push({ x: W, gapY, passed: false });
  }

  function die() {
    state = "dead";
    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
      bestEl.textContent = best;
    }
  }

  function update(dt) {
    birdV += GRAVITY * dt;
    birdY += birdV * dt;
    if (wingT > 0) wingT -= dt;

    spawnAcc += dt;
    if (spawnAcc >= PIPE_INTERVAL) {
      spawnAcc -= PIPE_INTERVAL;
      spawnPipe();
    }

    for (const p of pipes) {
      p.x -= PIPE_SPEED * dt;
      if (!p.passed && p.x + PIPE_W < BIRD_X) {
        p.passed = true;
        score++;
        scoreEl.textContent = score;
      }
    }
    pipes = pipes.filter((p) => p.x + PIPE_W > -10);

    // collisions
    const floor = H - GROUND;
    if (birdY + BIRD_R >= floor || birdY - BIRD_R <= 0) {
      birdY = Math.min(birdY, floor - BIRD_R);
      die();
      return;
    }
    for (const p of pipes) {
      const inX = BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + PIPE_W;
      if (!inX) continue;
      const inGap = birdY - BIRD_R > p.gapY && birdY + BIRD_R < p.gapY + PIPE_GAP;
      if (!inGap) {
        die();
        return;
      }
    }
  }

  function draw() {
    // sky
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, W, H);

    // pipes
    ctx.fillStyle = "#22c55e";
    const floor = H - GROUND;
    for (const p of pipes) {
      ctx.fillRect(p.x, 0, PIPE_W, p.gapY);
      ctx.fillRect(p.x, p.gapY + PIPE_GAP, PIPE_W, floor - (p.gapY + PIPE_GAP));
      // lips
      ctx.fillStyle = "#16a34a";
      ctx.fillRect(p.x - 4, p.gapY - 16, PIPE_W + 8, 16);
      ctx.fillRect(p.x - 4, p.gapY + PIPE_GAP, PIPE_W + 8, 16);
      ctx.fillStyle = "#22c55e";
    }

    // ground
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, floor, W, GROUND);
    ctx.fillStyle = "#334155";
    ctx.fillRect(0, floor, W, 6);

    // bird
    ctx.save();
    ctx.translate(BIRD_X, birdY);
    const tilt = Math.max(-0.5, Math.min(1.2, birdV / 600));
    ctx.rotate(tilt);
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2);
    ctx.fill();
    // wing
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(-6, wingT > 0 ? -2 : 4, 12, 6);
    // eye + beak
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(6, -5, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fb923c";
    ctx.fillRect(BIRD_R - 2, -3, 8, 6);
    ctx.restore();

    // text overlays
    ctx.fillStyle = "#f8fafc";
    ctx.textAlign = "center";
    if (state === "idle") {
      ctx.font = "bold 24px sans-serif";
      ctx.fillText("Tap / Space to start", W / 2, H / 2 - 40);
    } else if (state === "dead") {
      ctx.font = "bold 32px sans-serif";
      ctx.fillText("Game over", W / 2, H / 2 - 50);
      ctx.font = "20px sans-serif";
      ctx.fillText(`Score ${score} · Best ${best}`, W / 2, H / 2 - 16);
      ctx.fillText("Tap / Space to retry", W / 2, H / 2 + 16);
    }
  }

  function loop(ts) {
    if (state !== "playing") {
      draw();
      return;
    }
    let dt = (ts - last) / 1000;
    last = ts;
    if (dt > 0.05) dt = 0.05; // clamp tab-switch jumps
    update(dt);
    draw();
    if (state === "playing") requestAnimationFrame(loop);
    else draw(); // render dead frame
  }

  window.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "ArrowUp") {
      e.preventDefault();
      flap();
    }
  });
  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    flap();
  });

  reset();
  draw();
})();

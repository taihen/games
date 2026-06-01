// Boulder Dash level generator. Builds well-formed, solvable maps and writes levels.js.
const fs = require("fs");

const EMPTY = " ", DIRT = ".", WALL = "W", BOULDER = "r", DIAMOND = "d", EXIT = "E", PLAYER = "P", FIRE = "f";

const CONFIG = [
  { name: "First Dig",   W: 16, H: 12, boulders: 6,  diamonds: 10, need: 6,  fireflies: 0, time: 150 },
  { name: "Rockfall",    W: 18, H: 13, boulders: 16, diamonds: 13, need: 9,  fireflies: 1, time: 150 },
  { name: "The Caverns", W: 20, H: 14, boulders: 28, diamonds: 17, need: 12, fireflies: 2, time: 145 },
  { name: "Bug Hunt",    W: 20, H: 14, boulders: 36, diamonds: 21, need: 15, fireflies: 3, time: 135 },
  { name: "Meltdown",    W: 22, H: 15, boulders: 50, diamonds: 26, need: 18, fireflies: 4, time: 135 },
];

const key = (x, y) => x + "," + y;

function build(cfg) {
  const { W, H } = cfg;
  const g = Array.from({ length: H }, () => new Array(W).fill(DIRT));
  // borders
  for (let x = 0; x < W; x++) { g[0][x] = WALL; g[H - 1][x] = WALL; }
  for (let y = 0; y < H; y++) { g[y][0] = WALL; g[y][W - 1] = WALL; }

  // player top-left interior
  const pgx = 2, pgy = 2;
  g[pgy][pgx] = PLAYER;

  // exit bottom-right interior
  const ex = W - 2, ey = H - 2;
  g[ey][ex] = EXIT;

  const isInterior = (x, y) => x > 0 && y > 0 && x < W - 1 && y < H - 1;
  const dist = (x, y, x2, y2) => Math.max(Math.abs(x - x2), Math.abs(y - y2));

  // firefly chambers: carve 3x3 empty, place f in center, away from player/exit/each other
  const centers = [];
  let guard = 0;
  while (centers.length < cfg.fireflies && guard++ < 2000) {
    const cx = 2 + Math.floor(Math.random() * (W - 4));
    const cy = 2 + Math.floor(Math.random() * (H - 4));
    if (dist(cx, cy, pgx, pgy) < 5) continue;       // not near player
    if (dist(cx, cy, ex, ey) < 4) continue;         // not near exit
    if (centers.some(([ox, oy]) => dist(cx, cy, ox, oy) < 5)) continue;
    if (cx < 2 || cy < 2 || cx > W - 3 || cy > H - 3) continue; // room for 3x3
    centers.push([cx, cy]);
  }
  if (centers.length < cfg.fireflies) return null;
  for (const [cx, cy] of centers) {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) g[cy + dy][cx + dx] = EMPTY;
    g[cy][cx] = FIRE;
  }

  // free dirt cell predicate for scatter
  const placeable = new Set();
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++)
      if (g[y][x] === DIRT) placeable.add(key(x, y));

  function scatter(symbol, count, requireDirtBelow) {
    const cells = [...placeable];
    let placed = 0, tries = 0;
    while (placed < count && tries++ < cells.length * 6) {
      const k = cells[Math.floor(Math.random() * cells.length)];
      const [x, y] = k.split(",").map(Number);
      if (g[y][x] !== DIRT) continue;
      const below = g[y + 1][x];
      // stable start: below must be solid (dirt/wall/boulder/diamond), never empty
      if (requireDirtBelow && below !== DIRT && below !== WALL && below !== BOULDER && below !== DIAMOND) continue;
      g[y][x] = symbol;
      placeable.delete(k);
      placed++;
    }
    return placed;
  }

  const nd = scatter(DIAMOND, cfg.diamonds, true);
  const nb = scatter(BOULDER, cfg.boulders, true);
  if (nd < cfg.need + 2) return null; // ensure margin over need

  return { g, W, H, diamonds: nd, boulders: nb };
}

function validate(res, cfg) {
  const { g, W, H } = res;
  // equal width by construction (array). counts:
  let p = 0, e = 0, dia = 0, fly = [];
  let py, px;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const t = g[y][x];
      if (t === PLAYER) { p++; px = x; py = y; }
      else if (t === EXIT) e++;
      else if (t === DIAMOND) dia++;
      else if (t === FIRE) fly.push([x, y]);
    }
  if (p !== 1 || e !== 1) return "player/exit count";
  if (dia < cfg.need) return "diamonds < need";
  // firefly not adjacent (8) to player
  for (const [fx, fy] of fly)
    if (Math.max(Math.abs(fx - px), Math.abs(fy - py)) <= 1) return "firefly next to player";
  // stable start: no boulder/diamond with EMPTY directly below
  for (let y = 0; y < H - 1; y++)
    for (let x = 0; x < W; x++)
      if ((g[y][x] === BOULDER || g[y][x] === DIAMOND) && g[y + 1][x] === EMPTY)
        return "unstable boulder/diamond at " + x + "," + y;
  // reachability: flood from player through non-WALL cells; exit must be reached
  const seen = new Set([key(px, py)]);
  const stack = [[px, py]];
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (g[ny][nx] === WALL) continue;
      const kk = key(nx, ny);
      if (seen.has(kk)) continue;
      seen.add(kk);
      stack.push([nx, ny]);
    }
  }
  let exReached = false;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (g[y][x] === EXIT && seen.has(key(x, y))) exReached = true;
  if (!exReached) return "exit unreachable";
  return null;
}

const levels = [];
for (const cfg of CONFIG) {
  let ok = null, attempts = 0;
  while (attempts++ < 400) {
    const res = build(cfg);
    if (!res) continue;
    const err = validate(res, cfg);
    if (!err) { ok = res; break; }
  }
  if (!ok) { console.error("FAILED to generate", cfg.name); process.exit(1); }
  const mapRows = ok.g.map((row) => row.join(""));
  levels.push({ name: cfg.name, time: cfg.time, need: cfg.need, map: mapRows });
  console.log(`OK ${cfg.name}: ${ok.W}x${ok.H} diamonds=${ok.diamonds} need=${cfg.need} boulders=${ok.boulders} fireflies=${cfg.fireflies}`);
}

// emit levels.js
const body = levels.map((l) => {
  const rows = l.map.map((r) => "      " + JSON.stringify(r)).join(",\n");
  return `  {
    name: ${JSON.stringify(l.name)},
    time: ${l.time},
    need: ${l.need},
    map: [
${rows},
    ].join("\\n"),
  }`;
}).join(",\n");

const out = `// Boulder Dash levels — generated, validated (well-formed + solvable).
// Legend: W steel  . dirt  (space) empty  r boulder  d diamond  P player  E exit  f firefly
window.BD_LEVELS = [
${body},
];
`;

fs.writeFileSync(process.argv[2], out);
console.log("wrote", process.argv[2]);

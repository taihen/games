// Game registry — single source of truth for the landing page.
// Add a game: drop a folder, then push one entry here.
export const GAMES = [
  {
    id: "snake",
    title: "Snake",
    desc: "Eat, grow, don't bite yourself. Arrow keys or WASD.",
    icon: "🐍",
    path: "snake/",
  },
  {
    id: "2048",
    title: "2048",
    desc: "Slide tiles, merge equal numbers, reach 2048. Arrows or swipe.",
    icon: "🔢",
    path: "2048/",
  },
  {
    id: "minesweeper",
    title: "Minesweeper",
    desc: "Clear the field without hitting a mine. Click reveal, flag the rest.",
    icon: "💣",
    path: "minesweeper/",
  },
];

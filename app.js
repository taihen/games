import { GAMES } from "./games.js";

const grid = document.getElementById("grid");

if (GAMES.length === 0) {
  grid.innerHTML = `<p class="text-slate-500">No games yet.</p>`;
} else {
  grid.innerHTML = GAMES.map(
    (g) => `
    <a href="${g.path}"
       class="group rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-slate-600 hover:bg-slate-800">
      <div class="text-5xl">${g.icon ?? "🎲"}</div>
      <h2 class="mt-4 text-xl font-semibold group-hover:text-white">${g.title}</h2>
      <p class="mt-1 text-sm text-slate-400">${g.desc ?? ""}</p>
    </a>`,
  ).join("");
}

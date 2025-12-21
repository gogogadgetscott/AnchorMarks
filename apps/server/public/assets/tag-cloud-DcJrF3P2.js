const __vite__mapDeps = (
  i,
  m = __vite__mapDeps,
  d = m.f ||
    (m.f = [
      "assets/bookmarks-hgxSTBhD.js",
      "assets/auth-CtF7wfY5.js",
      "assets/ui-DJeZlV46.js",
    ]),
) => i.map((i) => d[i]);
import {
  o as M,
  q as x,
  f as z,
  _ as v,
  d as O,
  c as A,
  ao as y,
} from "./auth-CtF7wfY5.js";
import { u as B, e as f } from "./bookmarks-hgxSTBhD.js";
import "./ui-DJeZlV46.js";
const b = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#a855f7",
  "#10b981",
];
function C(e, t) {
  return y[e]?.color ? y[e].color : b[t % b.length];
}
function I(e) {
  const t = Math.min(1, e / 600);
  return [14, 18, 24, 32, 40, 48, 56].map((s) => Math.max(12, s * t));
}
function S(e, t, a, s) {
  if (a === t) return s[Math.floor(s.length / 2)];
  const o = a - t,
    c = (e - t) / o,
    m = Math.floor(c * (s.length - 1));
  return s[m];
}
function V(e, t, a) {
  return a === t ? (0.6 + 1) / 2 : 0.6 + ((e - t) / (a - t)) * (1 - 0.6);
}
function F() {
  const e = {};
  return (
    O.forEach((a) => {
      a.tags &&
        a.tags.split(",").forEach((s) => {
          const o = s.trim();
          o && (e[o] = (e[o] || 0) + 1);
        });
    }),
    Object.keys(e)
      .map((a, s) => ({ name: a, count: e[a], color: C(a, s) }))
      .sort((a, s) => s.count - a.count)
  );
}
function H(e) {
  const t = [...e];
  for (let a = t.length - 1; a > 0; a--) {
    const s = Math.floor(Math.random() * (a + 1));
    [t[a], t[s]] = [t[s], t[a]];
  }
  return t;
}
function R() {
  B();
  const e = document.getElementById("bookmarks-container"),
    t = document.getElementById("empty-state"),
    a = document.getElementById("bulk-bar");
  if (!e) return;
  (document.querySelector(".view-toggle")?.classList.add("hidden"),
    a?.classList.add("hidden"));
  const s = F();
  if (s.length === 0) {
    ((e.className = "tag-cloud-container"),
      (e.innerHTML = `
      <div class="tag-cloud-empty">
        <div class="tag-cloud-empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
            <line x1="7" y1="7" x2="7.01" y2="7"/>
          </svg>
        </div>
        <h3>No Tags Yet</h3>
        <p>Add tags to your bookmarks to see them visualized here</p>
      </div>
    `),
      t && t.classList.add("hidden"));
    return;
  }
  t && t.classList.add("hidden");
  const o = Math.min(...s.map((n) => n.count)),
    c = Math.max(...s.map((n) => n.count)),
    m = H(s),
    w = window.innerHeight - 300,
    _ = I(w),
    T = `
    <div class="tag-cloud-view">
      <div class="tag-cloud-header">
        <div class="tag-cloud-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
            <line x1="7" y1="7" x2="7.01" y2="7"/>
          </svg>
          <h2>Tag Cloud</h2>
          <span class="tag-cloud-count">${s.length} tags</span>
        </div>
        <div class="tag-cloud-stats">
          <div class="tag-cloud-stat">
            <span class="stat-number">${s.reduce((n, l) => n + l.count, 0)}</span>
            <span class="stat-label">total usages</span>
          </div>
          <div class="tag-cloud-stat">
            <span class="stat-number">${c}</span>
            <span class="stat-label">most used</span>
          </div>
        </div>
      </div>
      
      <div class="tag-cloud-canvas" id="tag-cloud-canvas">
        ${m
          .map((n, l) => {
            const d = S(n.count, o, c, _),
              u = V(n.count, o, c),
              g = (l * 0.03).toFixed(2),
              p =
                Math.random() > 0.85
                  ? Math.random() > 0.5
                    ? "rotate(-3deg)"
                    : "rotate(3deg)"
                  : "rotate(0deg)";
            return `
              <button class="tag-cloud-tag" 
                      data-tag="${f(n.name)}"
                      data-count="${n.count}"
                      style="
                        --tag-color: ${n.color};
                        --tag-size: ${d}px;
                        --tag-opacity: ${u};
                        --tag-delay: ${g}s;
                        --tag-rotation: ${p};
                      "
                      title="${f(n.name)} (${n.count} bookmark${n.count !== 1 ? "s" : ""})">
                ${f(n.name)}
                <span class="tag-cloud-tag-count">${n.count}</span>
              </button>
            `;
          })
          .join("")}
      </div>

      <div class="tag-cloud-legend">
        <div class="legend-item">
          <span class="legend-size legend-small">A</span>
          <span>Less used</span>
        </div>
        <div class="legend-gradient"></div>
        <div class="legend-item">
          <span class="legend-size legend-large">A</span>
          <span>Most used</span>
        </div>
      </div>
    </div>
  `;
  ((e.className = "tag-cloud-container"),
    (e.innerHTML = T),
    e.querySelectorAll(".tag-cloud-tag").forEach((n) => {
      n.addEventListener("click", async (l) => {
        l.preventDefault();
        const d = n.dataset.tag;
        if (!d) return;
        (M("all"), x(null), (z.tags = [d]));
        const u = document.getElementById("search-input");
        u && (u.value = "");
        const g = document.getElementById("view-title");
        g && (g.textContent = `Tag: ${d}`);
        const [
            { renderActiveFilters: p, renderSidebarTags: k },
            { loadBookmarks: E },
          ] = await Promise.all([
            v(
              () => import("./bookmarks-hgxSTBhD.js").then((r) => r.s),
              __vite__mapDeps([0, 1, 2]),
            ),
            v(
              () => import("./bookmarks-hgxSTBhD.js").then((r) => r.c),
              __vite__mapDeps([0, 1, 2]),
            ),
          ]),
          { updateActiveNav: $ } = await v(
            async () => {
              const { updateActiveNav: r } =
                await import("./ui-DJeZlV46.js").then((L) => L.e);
              return { updateActiveNav: r };
            },
            __vite__mapDeps([2, 0, 1]),
          );
        ($(), p(), k(), E());
      });
    }));
  let i = null;
  const h = () => {
    (i && clearTimeout(i),
      (i = setTimeout(() => {
        A === "tag-cloud" && e.querySelector(".tag-cloud-view") && R();
      }, 300)));
  };
  (window.addEventListener("resize", h),
    (window.__tagCloudResizeCleanup = () => {
      (window.removeEventListener("resize", h), i && clearTimeout(i));
    }));
}
export { R as renderTagCloud };
//# sourceMappingURL=tag-cloud-DcJrF3P2.js.map

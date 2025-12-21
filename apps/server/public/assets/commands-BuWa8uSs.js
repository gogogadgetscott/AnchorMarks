const __vite__mapDeps = (
  i,
  m = __vite__mapDeps,
  d = m.f ||
    (m.f = [
      "assets/bookmarks-hgxSTBhD.js",
      "assets/auth-CtF7wfY5.js",
      "assets/ui-DJeZlV46.js",
      "assets/tag-cloud-DcJrF3P2.js",
      "assets/extras-DCuDXSmT.js",
      "assets/dashboard-C1Pj_fLe.js",
    ]),
) => i.map((i) => d[i]);
import {
  ad as _,
  ae as w,
  af as E,
  D as P,
  o as h,
  q as k,
  _ as u,
  d as C,
  c as T,
  ag as L,
  ah as I,
} from "./auth-CtF7wfY5.js";
import { e as v } from "./bookmarks-hgxSTBhD.js";
import { b as y, o as b } from "./ui-DJeZlV46.js";
(function () {
  const e = document.querySelector(".command-palette"),
    i = document.querySelector(".command-palette-backdrop");
  if (!i) return;
  function n() {
    try {
      if (typeof window.closeCommandPalette == "function") {
        window.closeCommandPalette();
        return;
      }
    } catch {}
    (e && (e.style.display = "none"), (i.style.display = "none"));
  }
  function l() {
    if (!e || !i) return;
    const d = e.getBoundingClientRect();
    ((i.style.top = `${d.top}px`),
      (i.style.left = `${d.left}px`),
      (i.style.width = `${d.width}px`),
      (i.style.height = `${d.height}px`));
    const m = window.getComputedStyle(e).borderRadius;
    i.style.borderRadius = m || "8px";
  }
  let c = null;
  function r() {
    c || (l(), (c = window.setInterval(l, 100)));
  }
  function f() {
    c && (window.clearInterval(c), (c = null));
  }
  const g = new MutationObserver(() => {
    e && e.offsetParent !== null && e.style.display !== "none" ? r() : f();
  });
  (e &&
    (g.observe(e, { attributes: !0, attributeFilter: ["style", "class"] }),
    e.offsetParent !== null && e.style.display !== "none" && r()),
    window.addEventListener("resize", l, { passive: !0 }),
    i.addEventListener(
      "click",
      function (m) {
        (e && e.contains(m.target)) || n();
      },
      { passive: !0 },
    ),
    window.addEventListener(
      "keydown",
      function (m) {
        m.key === "Escape" && n();
      },
      { passive: !0 },
    ));
})();
function B(a = "") {
  const e = a.toLowerCase().trim(),
    i = e.startsWith(">"),
    n = e.startsWith("@"),
    l = e.startsWith("#"),
    c = !i && !n && !l && e.length > 0,
    r = e.replace(/^[>#@]/, "").trim(),
    f = [
      {
        label: "Add bookmark",
        action: () => b("bookmark-modal"),
        icon: "➕",
        category: "command",
        description: "Create a new bookmark",
      },
      {
        label: "Focus search",
        action: () => document.getElementById("search-input")?.focus(),
        icon: "🔍",
        category: "command",
        description: "Focus the search input",
      },
      {
        label: "Show dashboard",
        action: () => {
          (h("dashboard"), k(null), y());
          const t = document.getElementById("view-title");
          (t && (t.textContent = "Dashboard"),
            u(
              async () => {
                const { loadBookmarks: o } =
                  await import("./bookmarks-hgxSTBhD.js").then((s) => s.c);
                return { loadBookmarks: o };
              },
              __vite__mapDeps([0, 1, 2]),
            ).then(({ loadBookmarks: o }) => o()));
        },
        icon: "📊",
        category: "command",
        description: "Go to dashboard view",
      },
      {
        label: "View tag cloud",
        action: () => {
          (h("tag-cloud"), k(null), y());
          const t = document.getElementById("view-title");
          (t && (t.textContent = "Tag Cloud"),
            u(
              async () => {
                const { renderTagCloud: o } =
                  await import("./tag-cloud-DcJrF3P2.js");
                return { renderTagCloud: o };
              },
              __vite__mapDeps([3, 1, 2, 0]),
            ).then(({ renderTagCloud: o }) => o()));
        },
        icon: "☁️",
        category: "command",
        description: "View interactive tag cloud",
      },
      {
        label: "View favorites",
        action: () => {
          (h("favorites"), k(null), y());
          const t = document.getElementById("view-title");
          (t && (t.textContent = "Favorites"),
            u(
              async () => {
                const { loadBookmarks: o } =
                  await import("./bookmarks-hgxSTBhD.js").then((s) => s.c);
                return { loadBookmarks: o };
              },
              __vite__mapDeps([0, 1, 2]),
            ).then(({ loadBookmarks: o }) => o()));
        },
        icon: "⭐",
        category: "command",
        description: "View favorite bookmarks",
      },
      {
        label: "View all bookmarks",
        action: () => {
          (h("all"), k(null), y());
          const t = document.getElementById("view-title");
          (t && (t.textContent = "Bookmarks"),
            u(
              async () => {
                const { loadBookmarks: o } =
                  await import("./bookmarks-hgxSTBhD.js").then((s) => s.c);
                return { loadBookmarks: o };
              },
              __vite__mapDeps([0, 1, 2]),
            ).then(({ loadBookmarks: o }) => o()));
        },
        icon: "📚",
        category: "command",
        description: "Show all bookmarks",
      },
      {
        label: "Open settings",
        action: () => b("settings-modal"),
        icon: "⚙️",
        category: "command",
        description: "Open application settings",
      },
      {
        label: "Import bookmarks",
        action: () => {
          (b("settings-modal"),
            setTimeout(() => {
              document
                .querySelector('[data-settings-tab="import-export"]')
                ?.click();
            }, 100));
        },
        icon: "📥",
        category: "command",
        description: "Import bookmarks from file",
      },
      {
        label: "Export bookmarks",
        action: () => {
          u(
            async () => {
              const { exportJson: t } =
                await import("./extras-DCuDXSmT.js").then((o) => o.i);
              return { exportJson: t };
            },
            __vite__mapDeps([4, 1, 2, 0, 5]),
          ).then(({ exportJson: t }) => t());
        },
        icon: "📤",
        category: "command",
        description: "Export bookmarks to file",
      },
      {
        label: "Toggle fullscreen",
        action: () => {
          T === "dashboard"
            ? u(
                async () => {
                  const { toggleFullscreen: t } =
                    await import("./dashboard-C1Pj_fLe.js");
                  return { toggleFullscreen: t };
                },
                __vite__mapDeps([5, 1, 2, 0]),
              ).then(({ toggleFullscreen: t }) => t())
            : (h("dashboard"),
              y(),
              u(
                async () => {
                  const { renderDashboard: t, toggleFullscreen: o } =
                    await import("./dashboard-C1Pj_fLe.js");
                  return { renderDashboard: t, toggleFullscreen: o };
                },
                __vite__mapDeps([5, 1, 2, 0]),
              ).then(({ renderDashboard: t, toggleFullscreen: o }) => {
                (t(), setTimeout(() => o(), 100));
              }));
        },
        icon: "⛶",
        category: "command",
        description: "Toggle fullscreen mode (dashboard)",
      },
      {
        label: "Open maintenance settings",
        action: () => {
          (b("settings-modal"),
            setTimeout(() => {
              document
                .querySelector('[data-settings-tab="maintenance"]')
                ?.click();
            }, 100));
        },
        icon: "🔧",
        category: "command",
        description: "Check links, find duplicates, refresh favicons",
      },
    ],
    g = P.filter((t) => !t.parent_id).map((t) => ({
      label: t.name,
      action: () => {
        (h("folder"), k(t.id));
        const o = document.getElementById("view-title");
        (o && (o.textContent = t.name),
          y(),
          u(
            async () => {
              const { loadBookmarks: s } =
                await import("./bookmarks-hgxSTBhD.js").then((p) => p.c);
              return { loadBookmarks: s };
            },
            __vite__mapDeps([0, 1, 2]),
          ).then(({ loadBookmarks: s }) => s()));
      },
      icon: "📁",
      category: "folder",
      description: "Go to folder",
    })),
    d = C.slice(0, 100).map((t) => ({
      label: t.title || t.url,
      action: () => {
        (window.open(t.url, "_blank"),
          u(
            async () => {
              const { api: o } = await import("./auth-CtF7wfY5.js").then(
                (s) => s.aE,
              );
              return { api: o };
            },
            __vite__mapDeps([1, 2, 0]),
          ).then(({ api: o }) => {
            o(`/bookmarks/${t.id}/click`, { method: "POST" }).catch(() => {});
          }));
      },
      icon: "",
      category: "bookmark",
      description: t.url,
      url: t.url,
      favicon: t.favicon || "",
    }));
  let m = [];
  if (i) m = f.filter((t) => t.label.toLowerCase().includes(r));
  else if (n) m = g.filter((t) => t.label.toLowerCase().includes(r));
  else if (l)
    m = d.filter((t) =>
      C.find((s) => s.url === t.url)
        ?.tags?.toLowerCase()
        .includes(r),
    );
  else if (c && r.length >= 1) {
    const t = d.filter(
        (p) =>
          p.label.toLowerCase().includes(r) ||
          p.description?.toLowerCase().includes(r),
      ),
      o = f.filter((p) => p.label.toLowerCase().includes(r)),
      s = g.filter((p) => p.label.toLowerCase().includes(r));
    m = [...t.slice(0, 10), ...s, ...o];
  } else {
    const t = d.slice(0, 5);
    m = [...f, ...g, ...t];
  }
  return m;
}
function O() {
  const a = document.getElementById("quick-launch"),
    e = document.getElementById("quick-launch-input");
  a &&
    (I(!0),
    a.classList.remove("hidden"),
    e && (e.value = ""),
    E(0),
    x(""),
    e?.focus());
}
function V() {
  const a = document.getElementById("quick-launch"),
    e = document.getElementById("quick-launch-input");
  if (a) {
    (I(!1), a.classList.add("hidden"));
    try {
      e?.blur();
    } catch {}
  }
}
function x(a) {
  const e = document.getElementById("quick-launch-list");
  if (!e) return;
  const i = B(a);
  if ((L(i), E(0), i.length === 0)) {
    const n = (a || "").trim(),
      l = n.startsWith(">")
        ? "No matching commands"
        : n.startsWith("@")
          ? "No matching folders"
          : n.startsWith("#")
            ? "No bookmarks with matching tags"
            : "No matches found";
    e.innerHTML = `<div class="command-item empty">${l}</div>`;
    return;
  }
  e.innerHTML = i
    .map((n, l) => {
      let c = "";
      n.category === "bookmark" && n.favicon
        ? (c = `<img class="command-favicon" src="${v(n.favicon)}" alt="" onerror="this.style.display='none'" />`)
        : n.icon
          ? (c = `<span class="command-icon">${n.icon}</span>`)
          : n.category === "bookmark" &&
            (c = '<span class="command-icon">🔗</span>');
      let r = "";
      if (n.description && n.category !== "bookmark") {
        const g =
          n.description.length > 50
            ? n.description.substring(0, 50) + "..."
            : n.description;
        r = `<span class="command-desc">${v(g)}</span>`;
      }
      const f =
        n.category && n.category !== "command"
          ? `<span class="command-category ${n.category}">${n.category}</span>`
          : "";
      return `
        <div class="command-item ${l === _ ? "active" : ""} ${n.category || ""}" data-index="${l}">
          <div class="command-item-left">
            ${c}
            <span class="command-label">${v(n.label)}</span>
          </div>
          <div class="command-item-right">
            ${r}
            ${f}
          </div>
        </div>
      `;
    })
    .join("");
}
function q(a) {
  const e = document.getElementById("quick-launch-list");
  if (!e || w.length === 0) return;
  const i = Math.max(0, Math.min(w.length - 1, _ + a));
  (E(i),
    e.querySelectorAll(".command-item").forEach((l, c) => {
      l.classList.toggle("active", c === i);
    }));
  const n = e.querySelector(".command-item.active");
  n && n.scrollIntoView({ block: "nearest" });
}
function D() {
  const a = w[_];
  a && (V(), a.action());
}
function R() {
  const a = document.getElementById("shortcuts-popup");
  a && a.classList.remove("hidden");
}
function F() {
  const a = document.getElementById("shortcuts-popup");
  a && a.classList.add("hidden");
}
export { R as a, V as b, F as c, x as d, B as g, O as o, D as r, q as u };
//# sourceMappingURL=commands-BuWa8uSs.js.map

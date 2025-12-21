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
  h as c,
  as as l,
  at as d,
  au as k,
  av as r,
  aw as g,
  ax as u,
  ay as b,
  az as p,
  aA as w,
  aB as v,
  aC as m,
  ak as y,
  p as E,
  f as S,
  o as B,
  a5 as I,
  a6 as C,
  aD as h,
  U as L,
  ar as V,
  r as T,
  i as A,
  _,
  c as n,
} from "./auth-CtF7wfY5.js";
import "./ui-DJeZlV46.js";
import "./bookmarks-hgxSTBhD.js";
async function D() {
  try {
    const e = await c("/settings");
    (l(e.view_mode || "grid"),
      d(e.hide_favicons || !1),
      k(e.hide_sidebar || !1),
      r(e.ai_suggestions_enabled !== !1),
      g(!!e.rich_link_previews_enabled),
      u(e.include_child_bookmarks === 1),
      b(e.snap_to_grid !== !1),
      p({
        mode: e.dashboard_mode || "folder",
        tags: e.dashboard_tags || [],
        bookmarkSort: e.dashboard_sort || "recently_added",
      }),
      w(e.widget_order || {}),
      v(e.dashboard_widgets || []),
      m(e.collapsed_sections || []),
      y(e.tour_completed || !1),
      e.tag_sort && E({ ...S, tagSort: e.tag_sort }),
      e.current_view && B(e.current_view),
      e.current_dashboard_view_id && I(e.current_dashboard_view_id),
      e.current_dashboard_view_name && C(e.current_dashboard_view_name));
    const t = e.theme || localStorage.getItem("anchormarks_theme") || "dark";
    (f(t, !1),
      localStorage.getItem("anchormarks_sidebar_collapsed") === "true" &&
        window.innerWidth > 768 &&
        document.body.classList.add("sidebar-collapsed"),
      h.forEach((o) => {
        const i = document.getElementById(o);
        i && i.classList.add("collapsed");
      }));
  } catch (e) {
    console.error("Failed to load settings:", e);
  }
}
async function a(e) {
  try {
    await c("/settings", { method: "PUT", body: JSON.stringify(e) });
  } catch (t) {
    console.error("Failed to save settings:", t);
  }
}
function F() {}
function f(e, t = !0) {
  if (!e) return;
  (document.documentElement.setAttribute("data-theme", e),
    localStorage.setItem("anchormarks_theme", e));
  const s = document.getElementById("theme-select");
  (s && (s.value = e), t && a({ theme: e }));
}
function P() {
  const e = document.getElementById("hide-favicons-toggle");
  e && (e.checked = L);
  const t = document.getElementById("ai-suggestions-toggle");
  t && (t.checked = V);
  const s = document.getElementById("rich-link-previews-toggle");
  s && (s.checked = T);
  const o = document.getElementById("include-children-toggle");
  o && (o.checked = A);
}
function M() {
  const t = document.getElementById("hide-favicons-toggle")?.checked || !1;
  (d(t), a({ hide_favicons: t }));
}
function O() {
  const t = document.getElementById("ai-suggestions-toggle")?.checked !== !1;
  (r(t), a({ ai_suggestions_enabled: t ? 1 : 0 }));
}
function R() {
  const t = document.getElementById("rich-link-previews-toggle")?.checked || !1;
  (console.log("[Settings] Toggling rich link previews:", t),
    g(t),
    a({ rich_link_previews_enabled: t ? 1 : 0 }),
    _(
      async () => {
        const { renderBookmarks: s } =
          await import("./bookmarks-hgxSTBhD.js").then((o) => o.c);
        return { renderBookmarks: s };
      },
      __vite__mapDeps([0, 1, 2]),
    ).then(({ renderBookmarks: s }) => {
      s();
    }));
}
function G() {
  const t = document.getElementById("include-children-toggle")?.checked || !1;
  (u(t),
    a({ include_child_bookmarks: t ? 1 : 0 }),
    (n === "folder" || n === "dashboard") &&
      _(
        async () => {
          const { loadBookmarks: s } =
            await import("./bookmarks-hgxSTBhD.js").then((o) => o.c);
          return { loadBookmarks: s };
        },
        __vite__mapDeps([0, 1, 2]),
      )
        .then(({ loadBookmarks: s }) => {
          s();
        })
        .catch(console.error));
}
function W() {
  if (window.innerWidth <= 768)
    document.body.classList.toggle("mobile-sidebar-open");
  else {
    const t = document.body.classList.toggle("sidebar-collapsed");
    localStorage.setItem("anchormarks_sidebar_collapsed", String(t));
  }
}
function x(e) {
  (l(e),
    a({ view_mode: e }),
    document.querySelectorAll(".view-btn").forEach((o) => {
      o.classList.toggle("active", o.dataset.viewMode === e);
    }));
  const t = {
      grid: "bookmarks-grid",
      list: "bookmarks-list",
      compact: "bookmarks-compact",
    },
    s = document.getElementById("bookmarks-container");
  s && (s.className = t[e] || "bookmarks-grid");
}
function H(e) {
  const t = document.getElementById(e);
  if (t) {
    t.classList.toggle("collapsed");
    const s = t.classList.contains("collapsed");
    let o = [...h];
    (s ? o.includes(e) || o.push(e) : (o = o.filter((i) => i !== e)),
      m(o),
      a({ collapsed_sections: o }));
  }
}
const J = {
  loadSettings: D,
  saveSettings: a,
  applyTheme: F,
  setTheme: f,
  applyFaviconSetting: P,
  toggleFavicons: M,
  toggleAiSuggestions: O,
  toggleRichLinkPreviews: R,
  toggleSidebar: W,
  setViewMode: x,
  toggleSection: H,
};
export {
  P as applyFaviconSetting,
  F as applyTheme,
  J as default,
  D as loadSettings,
  a as saveSettings,
  f as setTheme,
  x as setViewMode,
  O as toggleAiSuggestions,
  M as toggleFavicons,
  G as toggleIncludeChildBookmarks,
  R as toggleRichLinkPreviews,
  H as toggleSection,
  W as toggleSidebar,
};
//# sourceMappingURL=settings-B0ZpC5LD.js.map

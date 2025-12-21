const __vite__mapDeps = (
  i,
  m = __vite__mapDeps,
  d = m.f ||
    (m.f = [
      "assets/dashboard-C1Pj_fLe.js",
      "assets/auth-CtF7wfY5.js",
      "assets/ui-DJeZlV46.js",
      "assets/tag-cloud-DcJrF3P2.js",
      "assets/extras-DCuDXSmT.js",
      "assets/main-BnFaXbWJ.js",
      "assets/commands-BuWa8uSs.js",
      "assets/main-BOkpivqf.css",
      "assets/settings-B0ZpC5LD.js",
    ]),
) => i.map((i) => d[i]);
import {
  c as h,
  f as d,
  a as S,
  b as q,
  _ as m,
  d as k,
  e as A,
  s as fe,
  i as rt,
  g as he,
  h as v,
  j as x,
  k as nt,
  l as B,
  v as j,
  r as ge,
  m as at,
  B as st,
  n as pe,
  o as C,
  p as O,
  q as L,
  t as g,
  u as ne,
  w as te,
  x as it,
  y as ct,
  z as ve,
  A as Z,
  C as ye,
  D as _,
  E as we,
  F as _e,
  G as U,
  H as dt,
  I as ee,
  J as lt,
  K as oe,
  L as ut,
  M as mt,
  N as ft,
  O as be,
} from "./auth-CtF7wfY5.js";
import {
  g as gt,
  B as W,
  u as K,
  a as b,
  b as M,
  s as u,
  R as vt,
  S as kt,
  c as G,
  o as Ee,
  I as ke,
  d as Q,
} from "./ui-DJeZlV46.js";
function p(t) {
  const e = document.createElement("div");
  return ((e.textContent = t), e.innerHTML);
}
function zt(t) {
  try {
    return new URL(t).hostname;
  } catch {
    return t;
  }
}
function Ht(t) {
  try {
    return new URL(t).origin;
  } catch {
    return t;
  }
}
function N(t) {
  return t
    ? t
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean)
    : [];
}
function jt(t, e) {
  const o = URL.createObjectURL(t),
    n = document.createElement("a");
  ((n.href = o), (n.download = e), n.click(), URL.revokeObjectURL(o));
}
function ht() {
  let t = 0;
  d.tags && d.tags.length > 0 && (t += d.tags.length);
  const e = document.getElementById("search-input");
  return (
    e && e.value.trim() && (t += 1),
    S && (t += 1),
    h === "collection" && q && (t += 1),
    t
  );
}
function pt() {
  const t = document.getElementById("filter-dropdown-btn");
  if (!t) return;
  const e = ht(),
    o = t.querySelector(".filter-btn-text");
  o &&
    (e > 0 ? (o.textContent = `Filters (${e})`) : (o.textContent = "Filters"));
}
function yt() {
  const t = document.getElementById("filter-dropdown-btn");
  if (!t) return;
  ["all", "folder", "collection"].includes(h)
    ? ((t.style.display = ""), pt())
    : ((t.style.display = "none"), Te());
}
function wt(t) {
  const e = document.getElementById("filter-dropdown"),
    o = document.getElementById("bookmarks-filter-btn");
  e &&
    !e.contains(t.target) &&
    t.target !== o &&
    !o?.contains(t.target) &&
    Te();
}
function Te() {
  const t = document.getElementById("filter-dropdown");
  t && (t.remove(), document.removeEventListener("click", wt));
}
function Be() {
  const t = document.getElementById("bookmarks-container");
  if (!t) return;
  const e = {
    grid: "bookmarks-grid",
    list: "bookmarks-list",
    compact: "bookmarks-compact",
  };
  ((t.className = e[j] || "bookmarks-grid"),
    (t.innerHTML = Array(8)
      .fill(null)
      .map(() => kt())
      .join("")));
}
async function ae() {
  try {
    (fe(!0), Be());
    let t = "/bookmarks";
    const e = new URLSearchParams();
    if (
      (h === "collection" && q && (t = `/collections/${q}/bookmarks`),
      h === "favorites" && e.append("favorites", "true"),
      h === "archived" && e.append("archived", "true"),
      S &&
        h !== "dashboard" &&
        h !== "collection" &&
        (e.append("folder_id", S), rt && e.append("include_children", "true")),
      t === "/bookmarks")
    ) {
      const i = d.sort || he.bookmarkSort || "recently_added";
      e.append("sort", i);
    }
    const o = e.toString();
    o && (t += `?${o}`);
    const n = await v(t);
    x(n);
    try {
      const i = await v("/tags"),
        c = {};
      (i.forEach((l) => {
        c[l.name] = {
          color: l.color || "#f59e0b",
          icon: l.icon || "tag",
          id: l.id,
          count: l.count || 0,
        };
      }),
        nt(c));
    } catch (i) {
      B.error("Failed to load tag metadata", i);
    }
    if (h === "dashboard") {
      const { renderDashboard: i } = await m(
        async () => {
          const { renderDashboard: c } =
            await import("./dashboard-C1Pj_fLe.js");
          return { renderDashboard: c };
        },
        __vite__mapDeps([0, 1, 2]),
      );
      i();
    } else if (h === "tag-cloud") {
      const { renderTagCloud: i } = await m(
        async () => {
          const { renderTagCloud: c } = await import("./tag-cloud-DcJrF3P2.js");
          return { renderTagCloud: c };
        },
        __vite__mapDeps([3, 1, 2]),
      );
      i();
    } else E();
    (await b(), M(), h !== "dashboard" && h !== "tag-cloud" && Oe());
    const { renderSidebarTags: r } = await m(
        async () => {
          const { renderSidebarTags: i } = await Promise.resolve().then(
            () => R,
          );
          return { renderSidebarTags: i };
        },
        void 0,
      ),
      { checkWelcomeTour: a } = await m(
        async () => {
          const { checkWelcomeTour: i } =
            await import("./extras-DCuDXSmT.js").then((c) => c.t);
          return { checkWelcomeTour: i };
        },
        __vite__mapDeps([4, 1, 2, 0]),
      ),
      { renderFolders: s } = await m(
        async () => {
          const { renderFolders: i } = await Promise.resolve().then(() => Ot);
          return { renderFolders: i };
        },
        void 0,
      );
    (r(), s(), a());
  } catch {
    u("Failed to load bookmarks", "error");
  } finally {
    fe(!1);
  }
}
function E() {
  yt();
  const t = document.getElementById("bookmarks-container"),
    e = document.getElementById("empty-state"),
    o = document.getElementById("search-input");
  if (!t) return;
  (document.querySelector(".view-toggle")?.classList.remove("hidden"),
    m(
      async () => {
        const { attachViewToggleListeners: f } =
          await import("./main-BnFaXbWJ.js").then((w) => w.A);
        return { attachViewToggleListeners: f };
      },
      __vite__mapDeps([5, 2, 1, 6, 7]),
    ).then(({ attachViewToggleListeners: f }) => f()));
  let r =
    {
      grid: "bookmarks-grid",
      list: "bookmarks-list",
      compact: "bookmarks-compact",
    }[j] || "bookmarks-grid";
  (ge && j === "grid" && (r += " rich-link-previews"), (t.className = r));
  const a = o?.value.toLowerCase() || "";
  let s = [...k];
  if (
    (h === "archived"
      ? (s = s.filter((f) => f.is_archived === 1))
      : (s = s.filter((f) => !f.is_archived)),
    a &&
      (s = s.filter(
        (f) =>
          f.title.toLowerCase().includes(a) ||
          f.url.toLowerCase().includes(a) ||
          (f.tags && f.tags.toLowerCase().includes(a)),
      )),
    h === "recent")
  )
    s = s
      .sort(
        (f, w) =>
          new Date(w.created_at || 0).getTime() -
          new Date(f.created_at || 0).getTime(),
      )
      .slice(0, 20);
  else {
    d.tags.length > 0 &&
      (s = s.filter((w) => {
        if (!w.tags) return !1;
        const T = w.tags.split(",").map((I) => I.trim());
        return d.tagMode === "AND"
          ? d.tags.every((I) => T.includes(I))
          : d.tags.some((I) => T.includes(I));
      }));
    const f = d.sort;
    s.sort((w, T) => {
      switch (f) {
        case "a_z":
        case "a-z":
        case "alpha":
          return w.title.localeCompare(T.title);
        case "z_a":
        case "z-a":
          return T.title.localeCompare(w.title);
        case "most_visited":
          return (T.click_count || 0) - (w.click_count || 0);
        case "oldest_first":
        case "created_asc":
          return (
            new Date(w.created_at || 0).getTime() -
            new Date(T.created_at || 0).getTime()
          );
        case "recently_added":
        case "created_desc":
        default:
          return (
            new Date(T.created_at || 0).getTime() -
            new Date(w.created_at || 0).getTime()
          );
      }
    });
  }
  if ((it(s), s.length === 0)) {
    ((t.innerHTML = ""),
      e && ((e.innerHTML = gt()), e.classList.remove("hidden")));
    return;
  }
  e && e.classList.add("hidden");
  const i = s.slice(0, A),
    c = s.length > A,
    l = ge && j === "grid" ? vt : W;
  ((t.innerHTML = i.map((f, w) => l(f, w)).join("")),
    c &&
      ((t.innerHTML += `
            <div id="load-more-sentinel" class="load-more-sentinel">
                <div class="loading-spinner"></div>
                <span>Loading more bookmarks...</span>
            </div>
        `),
      _t(s)),
    X(),
    K());
}
function X() {
  const t = document.getElementById("bookmarks-container");
  t &&
    t.querySelectorAll(".bookmark-card, .rich-bookmark-card").forEach((e) => {
      if (e.dataset.listenerAttached) return;
      ((e.dataset.listenerAttached = "true"),
        e.addEventListener("click", (r) => {
          const a = e.dataset.id || "",
            s = parseInt(e.dataset.index || "0", 10);
          if (
            r.target.closest(".bookmark-actions") ||
            r.target.closest(".bookmark-select") ||
            r.target.closest(".bookmark-tags")
          )
            return;
          if (ct) {
            J(a, s, r.shiftKey, !0);
            return;
          }
          const i = k.find((l) => l.id === a);
          if (!i) return;
          const c = i.url;
          if (c.startsWith("view:")) {
            const l = c.substring(5);
            h === "dashboard" &&
              m(
                async () => {
                  const { restoreView: f } =
                    await import("./dashboard-C1Pj_fLe.js");
                  return { restoreView: f };
                },
                __vite__mapDeps([0, 1, 2]),
              ).then(({ restoreView: f }) => {
                f(l);
              });
            return;
          }
          if (c.startsWith("bookmark-view:")) {
            const l = c.substring(14);
            ce(l);
            return;
          }
          (ie(i.id), window.open(c, "_blank", "noopener,noreferrer"));
        }));
      const o = e.querySelector(".bookmark-select");
      o &&
        o.addEventListener("click", (r) => {
          r.stopPropagation();
          const a = e.dataset.id || "",
            s = parseInt(e.dataset.index || "0", 10);
          J(a, s, r.shiftKey, !0);
        });
      const n = e.querySelector(".bookmark-favicon-img");
      n &&
        n.dataset.fallback === "true" &&
        n.addEventListener("error", (r) => {
          const a = r.target.parentElement;
          a &&
            (a.innerHTML =
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>');
        });
    });
}
function _t(t) {
  const e = document.getElementById("load-more-sentinel");
  if (!e) return;
  new IntersectionObserver(
    (n) => {
      n[0].isIntersecting && !pe && bt(t);
    },
    { rootMargin: "100px" },
  ).observe(e);
}
function bt(t) {
  pe ||
    A >= t.length ||
    (ve(!0),
    setTimeout(() => {
      const e = A;
      at(Math.min(A + st, t.length));
      const o = t.slice(e, A),
        n = document.getElementById("load-more-sentinel"),
        r = o.map((a, s) => W(a, e + s)).join("");
      (n && n.insertAdjacentHTML("beforebegin", r),
        X(),
        A >= t.length && n && n.remove(),
        ve(!1));
    }, 100));
}
function J(t, e, o, n) {
  if (o && Z !== null && te.length > 0) {
    const r = Math.min(Z, e),
      a = Math.max(Z, e);
    for (let s = r; s <= a; s++) g.add(te[s].id);
  } else (g.has(t) ? g.delete(t) : (n || g.clear(), g.add(t)), ye(e));
  (ne(g.size > 0), K(), E());
}
function Ie() {
  (g.clear(), ne(!1), ye(null), K(), E());
}
function Le() {
  (te.forEach((t) => g.add(t.id)), g.size > 0 && ne(!0), K(), E());
}
async function se(t) {
  try {
    const e = await v("/bookmarks", {
      method: "POST",
      body: JSON.stringify(t),
    });
    (k.unshift(e), E(), await b(), G(), u("Bookmark added!", "success"));
  } catch (e) {
    u(e.message, "error");
  }
}
async function Se(t, e) {
  try {
    const o = await v(`/bookmarks/${t}`, {
        method: "PUT",
        body: JSON.stringify(e),
      }),
      n = k.findIndex((r) => r.id === t);
    if ((n !== -1 && (k[n] = o), h === "dashboard")) {
      const { renderDashboard: r } = await m(
        async () => {
          const { renderDashboard: a } =
            await import("./dashboard-C1Pj_fLe.js");
          return { renderDashboard: a };
        },
        __vite__mapDeps([0, 1, 2]),
      );
      r();
    } else E();
    (await b(), G(), u("Bookmark updated", "success"));
  } catch (o) {
    (B.error("Failed to update bookmark", o),
      u("Failed to update bookmark", "error"));
  }
}
async function Et(t) {
  try {
    await v(`/bookmarks/${t}/archive`, { method: "POST" });
    const e = k.find((o) => o.id === t);
    (e && (e.is_archived = 1),
      E(),
      await b(),
      u("Bookmark archived", "success"));
  } catch (e) {
    (B.error("Failed to archive bookmark", e),
      u("Failed to archive bookmark", "error"));
  }
}
async function Tt(t) {
  try {
    await v(`/bookmarks/${t}/unarchive`, { method: "POST" });
    const e = k.find((o) => o.id === t);
    (e && (e.is_archived = 0),
      E(),
      await b(),
      u("Bookmark unarchived", "success"));
  } catch (e) {
    (B.error("Failed to unarchive bookmark", e),
      u("Failed to unarchive bookmark", "error"));
  }
}
async function xe(t) {
  if (confirm("Delete this bookmark?"))
    try {
      if (
        (await v(`/bookmarks/${t}`, { method: "DELETE" }),
        x(k.filter((e) => e.id !== t)),
        h === "dashboard")
      ) {
        const { renderDashboard: e } = await m(
          async () => {
            const { renderDashboard: o } =
              await import("./dashboard-C1Pj_fLe.js");
            return { renderDashboard: o };
          },
          __vite__mapDeps([0, 1, 2]),
        );
        e();
      } else E();
      (await b(), u("Bookmark deleted", "success"));
    } catch (e) {
      u(e.message, "error");
    }
}
async function Ce(t) {
  const e = k.find((o) => o.id === t);
  if (e)
    try {
      (await v(`/bookmarks/${t}`, {
        method: "PUT",
        body: JSON.stringify({ is_favorite: e.is_favorite ? 0 : 1 }),
      }),
        (e.is_favorite = !e.is_favorite),
        E(),
        await b());
    } catch (o) {
      u(o.message, "error");
    }
}
async function ie(t) {
  try {
    await v(`/bookmarks/${t}/click`, { method: "POST" });
  } catch {}
}
async function Pe(t) {
  const e = k.find((r) => r.id === t);
  if (!e) return;
  ((document.getElementById("bookmark-modal-title").textContent =
    "Edit Bookmark"),
    (document.getElementById("bookmark-id").value = t),
    (document.getElementById("bookmark-url").value = e.url),
    (document.getElementById("bookmark-title").value = e.title),
    (document.getElementById("bookmark-description").value =
      e.description || ""),
    (document.getElementById("bookmark-folder").value = e.folder_id || ""),
    (document.getElementById("bookmark-tags").value = e.tags || ""));
  const o = document.getElementById("bookmark-color");
  (o && (o.value = e.color || ""),
    document.querySelectorAll(".color-option-bookmark").forEach((r) => {
      const a = r.dataset.color || "";
      r.classList.toggle("active", a === (e.color || ""));
    }));
  const { loadTagsFromInput: n } = await m(
    async () => {
      const { loadTagsFromInput: r } = await import("./main-BnFaXbWJ.js").then(
        (a) => a.t,
      );
      return { loadTagsFromInput: r };
    },
    __vite__mapDeps([5, 2, 1, 6, 7]),
  );
  (n(e.tags || ""), Ee("bookmark-modal"));
}
function $e(t) {
  const e = document.getElementById("search-input"),
    o = document.getElementById("view-title");
  (e && (e.value = t),
    L(null),
    C("all"),
    o && (o.textContent = `Tag: ${t}`),
    M(),
    E());
}
function Ae(t) {
  const e = he.bookmarkSort || "recently_added";
  return [...t].sort((o, n) => {
    switch (e) {
      case "a_z":
      case "a-z":
      case "alpha":
        return o.title.localeCompare(n.title);
      case "z_a":
      case "z-a":
        return n.title.localeCompare(o.title);
      case "most_visited":
        return (n.click_count || 0) - (o.click_count || 0);
      case "oldest_first":
      case "created_asc":
        return (
          new Date(o.created_at || 0).getTime() -
          new Date(n.created_at || 0).getTime()
        );
      case "recently_added":
      case "created_desc":
      default:
        return (
          new Date(n.created_at || 0).getTime() -
          new Date(o.created_at || 0).getTime()
        );
    }
  });
}
function Oe() {
  const t = document.querySelector(".content-header .header-right");
  if (
    !t ||
    (document.getElementById("dashboard-views-btn")?.remove(),
    document.getElementById("bookmark-views-btn"))
  )
    return;
  const e = document.createElement("button");
  ((e.id = "bookmark-views-btn"),
    (e.className = "btn btn-secondary"),
    (e.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
        Views
    `),
    e.addEventListener("click", (o) => {
      (o.stopPropagation(), Bt());
    }),
    t.insertBefore(e, t.firstChild));
}
async function Bt() {
  document.getElementById("bookmark-views-dropdown")?.remove();
  const t = await Lt(),
    e = document.createElement("div");
  ((e.id = "bookmark-views-dropdown"),
    (e.className = "dropdown-menu"),
    (e.style.cssText =
      "position:absolute;top:3rem;right:1rem;z-index:1000;min-width:250px"));
  let o = `
        <div style="font-weight:600;padding:0.5rem;border-bottom:1px solid var(--border-color);margin-bottom:0.5rem">
            Bookmark Views
        </div>
        <div class="views-list" style="max-height:200px;overflow-y:auto">
    `;
  (t.length === 0
    ? (o +=
        '<div style="padding:0.5rem;color:var(--text-tertiary);text-align:center">No saved views</div>')
    : t.forEach((r) => {
        o += `
                <div class="dropdown-item view-item" data-view-id="${r.id}" style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem;cursor:pointer;border-radius:4px">
                    <span class="view-name" style="flex:1">${p(r.name)}</span>
                    <button class="btn-icon small text-danger delete-view-btn" data-view-id="${r.id}" title="Delete">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
            `;
      }),
    (o += `
        </div>
        <div style="border-top:1px solid var(--border-color);margin-top:0.5rem;padding-top:0.5rem">
            <button class="btn btn-primary btn-sm btn-full" id="save-bookmark-view-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;margin-right:4px">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/>
                    <polyline points="7 3 7 8 15 8"/>
                </svg>
                Save Current View
            </button>
        </div>
    `),
    (e.innerHTML = o),
    document.body.appendChild(e),
    e.querySelectorAll(".view-item").forEach((r) => {
      const a = r.dataset.viewId || "",
        s = r.querySelector(".view-name"),
        i = r.querySelector(".delete-view-btn");
      (s &&
        s.addEventListener("click", async (c) => {
          (c.preventDefault(), c.stopPropagation(), await ce(a));
        }),
        i &&
          i.addEventListener("click", async (c) => {
            (c.preventDefault(), c.stopPropagation(), await St(a));
          }));
    }));
  const n = e.querySelector("#save-bookmark-view-btn");
  (n &&
    n.addEventListener("click", async (r) => {
      (r.preventDefault(), r.stopPropagation(), await It());
    }),
    setTimeout(() => {
      document.addEventListener("click", Me);
    }, 0));
}
function Me(t) {
  const e = document.getElementById("bookmark-views-dropdown");
  e &&
    !e.contains(t.target) &&
    t.target.id !== "bookmark-views-btn" &&
    (e.remove(), document.removeEventListener("click", Me));
}
async function It() {
  try {
    const t = prompt("Enter a name for this view:");
    if (!t) return;
    const e = {
      search_query: d.search || "",
      filter_tags: d.tags || [],
      filter_folder: d.folder || null,
      sort_order: d.sort || "recently_added",
      tag_sort: d.tagSort || "count_desc",
      tag_mode: d.tagMode || "OR",
    };
    B.debug("Saving bookmark view", { config: e, filterConfig: d });
    const o = await v("/bookmark/views", {
      method: "POST",
      body: JSON.stringify({ name: t, config: e }),
    });
    (B.debug("Bookmark view saved", { viewId: o.id }),
      u("View saved!", "success"),
      document.getElementById("bookmark-views-dropdown")?.remove(),
      confirm("Create a bookmark shortcut for this view?") &&
        (await se({
          title: t,
          url: `bookmark-view:${o.id}`,
          description: "Bookmark View Shortcut",
          tags: "bookmark-views",
        })));
  } catch (t) {
    u(t.message, "error");
  }
}
async function Lt() {
  try {
    return await v("/bookmark/views");
  } catch {
    return [];
  }
}
async function St(t) {
  if (confirm("Delete this view?"))
    try {
      (await v(`/bookmark/views/${t}`, { method: "DELETE" }),
        u("View deleted", "success"),
        document.getElementById("bookmark-views-dropdown")?.remove());
    } catch (e) {
      u(e.message, "error");
    }
}
async function ce(t) {
  try {
    B.debug("Restoring bookmark view", { viewId: t });
    const o = (await v(`/bookmark/views/${t}/restore`, { method: "POST" }))
      .config;
    (B.debug("Received bookmark view config", { config: o, filterConfig: d }),
      h === "dashboard" && C("all"),
      O({
        search: o.search_query || "",
        tags: o.filter_tags || [],
        folder: o.filter_folder || null,
        sort: o.sort_order || "recently_added",
        tagSort: o.tag_sort || "count_desc",
        tagMode: o.tag_mode || "OR",
      }),
      B.debug("Filter config after restore", { filterConfig: d }),
      o.filter_folder ? L(o.filter_folder) : L(null));
    const n = document.getElementById("search-input");
    n && (n.value = o.search_query || "");
    const r = document.getElementById("sidebar-filter-tag-sort");
    (r && (r.value = o.tag_sort || "count_desc"),
      B.debug("Reloading bookmarks after view restore"),
      await ae());
    const { saveSettings: a } = await m(
      async () => {
        const { saveSettings: s } = await import("./settings-B0ZpC5LD.js");
        return { saveSettings: s };
      },
      __vite__mapDeps([8, 1, 2]),
    );
    (await a({ current_view: h }),
      u("View restored!", "success"),
      document.getElementById("bookmark-views-dropdown")?.remove());
  } catch (e) {
    B.error("Error restoring bookmark view", e);
    const o = e instanceof Error ? e.message : "Failed to restore view";
    u(o, "error");
  }
}
window.restoreBookmarkView = ce;
const xt = {
    loadBookmarks: ae,
    renderBookmarks: E,
    createBookmarkCard: W,
    attachBookmarkCardListeners: X,
    toggleBookmarkSelection: J,
    clearSelections: Ie,
    selectAllBookmarks: Le,
    createBookmark: se,
    updateBookmark: Se,
    deleteBookmark: xe,
    toggleFavorite: Ce,
    trackClick: ie,
    editBookmark: Pe,
    filterByTag: $e,
    sortBookmarks: Ae,
  },
  y = Object.freeze(
    Object.defineProperty(
      {
        __proto__: null,
        archiveBookmark: Et,
        attachBookmarkCardListeners: X,
        clearSelections: Ie,
        createBookmark: se,
        createBookmarkCard: W,
        default: xt,
        deleteBookmark: xe,
        editBookmark: Pe,
        filterByTag: $e,
        initBookmarkViews: Oe,
        loadBookmarks: ae,
        renderBookmarks: E,
        renderSkeletons: Be,
        selectAllBookmarks: Le,
        sortBookmarks: Ae,
        toggleBookmarkSelection: J,
        toggleFavorite: Ce,
        trackClick: ie,
        unarchiveBookmark: Tt,
        updateBookmark: Se,
      },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  );
function P() {
  const t = document.getElementById("sidebar-tags-list"),
    e = document.getElementById("tags-count"),
    o = document.getElementById("tags-show-more");
  if (!t) return;
  const n = {};
  k.forEach((i) => {
    i.tags &&
      i.tags.split(",").forEach((c) => {
        const l = c.trim();
        l && (n[l] = (n[l] || 0) + 1);
      });
  });
  const r = Object.keys(n).map((i) => ({ name: i, count: n[i] })),
    a = d.tagSort || "count_desc";
  (r.sort((i, c) => {
    switch (a) {
      case "count_asc":
        return i.count - c.count;
      case "name_asc":
        return i.name.localeCompare(c.name);
      case "name_desc":
        return c.name.localeCompare(i.name);
      case "count_desc":
      default:
        return c.count - i.count;
    }
  }),
    lt(r),
    e && (e.innerHTML = Q(r.length, { id: "tags-count" })),
    o &&
      (r.length > 15 && !oe
        ? (o.classList.remove("hidden"),
          (o.textContent = `Show all ${r.length} tags`))
        : o.classList.add("hidden")));
  const s = oe ? r.slice(0, 100) : r.slice(0, 15);
  z(s);
}
function de(t) {
  (C("all"), L(null));
  const e = document.getElementById("search-input");
  e && (e.value = "");
  const o = d.tags.indexOf(t);
  o === -1 ? d.tags.push(t) : d.tags.splice(o, 1);
  const n = document.getElementById("view-title");
  (n &&
    (d.tags.length === 0
      ? (n.textContent = "Bookmarks")
      : (n.textContent = `Tags: ${d.tags.join(", ")}`)),
    M(),
    $(),
    m(
      async () => {
        const { renderBookmarks: r } = await Promise.resolve().then(() => y);
        return { renderBookmarks: r };
      },
      void 0,
    ).then(({ renderBookmarks: r }) => r()),
    P());
}
function De(t) {
  if (!document.getElementById("sidebar-tags-list")) return;
  const o = we.filter((r) => r.name.toLowerCase().includes(t.toLowerCase())),
    n = d.tagSort || "count_desc";
  (o.sort((r, a) => {
    switch (n) {
      case "count_asc":
        return r.count - a.count;
      case "name_asc":
        return r.name.localeCompare(a.name);
      case "name_desc":
        return a.name.localeCompare(r.name);
      case "count_desc":
      default:
        return a.count - r.count;
    }
  }),
    z(o.slice(0, oe ? 100 : 15)));
}
function Re() {
  ut(!0);
  const t = document.getElementById("tags-show-more");
  (t && t.classList.add("hidden"), z(we.slice(0, 100)));
}
function z(t) {
  const e = document.getElementById("sidebar-tags-list");
  if (e) {
    if (t.length === 0) {
      e.innerHTML =
        '<div style="padding: 0.5rem; font-size: 0.75rem; color: var(--text-tertiary);">No tags found</div>';
      return;
    }
    ((e.innerHTML = ""),
      t.forEach((o) => {
        const n = document.createElement("div");
        ((n.className = `sidebar-tag-item ${d.tags.includes(o.name) ? "active" : ""}`),
          (n.draggable = !0),
          (n.style.cursor = "grab"),
          (n.dataset.tagName = o.name),
          (n.dataset.tagCount = String(o.count)),
          (n.innerHTML = `
            <span class="tag-name">${p(o.name)}</span>
            ${Q(o.count, { className: "tag-count" })}
        `),
          n.addEventListener("click", (r) => {
            if (!r.defaultPrevented) {
              if (h === "dashboard") {
                m(
                  async () => {
                    const { addDashboardWidget: a } =
                      await import("./dashboard-C1Pj_fLe.js");
                    return { addDashboardWidget: a };
                  },
                  __vite__mapDeps([0, 1, 2]),
                ).then(({ addDashboardWidget: a }) => {
                  const s = _e.length,
                    i = 50 + ((s * 30) % 300),
                    c = 50 + ((s * 30) % 200);
                  a("tag", o.name, i, c);
                });
                return;
              }
              de(o.name);
            }
          }),
          n.addEventListener("dragstart", (r) => {
            (U({ type: "tag", id: o.name, name: o.name, color: "#10b981" }),
              r.dataTransfer &&
                ((r.dataTransfer.effectAllowed = "copy"),
                r.dataTransfer.setData("text/plain", o.name)));
          }),
          n.addEventListener("dragend", () => {
            U(null);
          }),
          e.appendChild(n));
      }));
  }
}
function Fe() {
  ((d.tags = []), (d.sort = "recently_added"));
  const t = document.getElementById("search-input"),
    e = document.getElementById("view-title");
  (t && (t.value = ""),
    C("all"),
    L(null),
    dt(null),
    e && (e.textContent = "Bookmarks"),
    M(),
    $(),
    m(
      async () => {
        const { loadBookmarks: o } = await Promise.resolve().then(() => y);
        return { loadBookmarks: o };
      },
      void 0,
    ).then(({ loadBookmarks: o }) => o()),
    P());
}
function $() {
  const t = document.getElementById("active-filters-section"),
    e = document.getElementById("active-filters-chips");
  if (!t || !e) return;
  const o = document.getElementById("search-input"),
    n = S,
    r = n ? _.find((l) => l.id === n)?.name : null,
    a = h === "collection" ? q : null,
    s = a ? mt.find((l) => l.id === a)?.name : null;
  if (!(d.tags.length > 0 || (o && o.value.trim()) || n || a)) {
    t.classList.add("hidden");
    return;
  }
  t.classList.remove("hidden");
  let c = "";
  (n &&
    r &&
    (c += `
            <div class="filter-chip folder-chip">
                ${ke("folder", { size: 12 })}
                <span>${p(r)}</span>
                <button data-action="clear-folder-filter" title="Remove">
                    ${ke("close", { size: 12 })}
                </button>
            </div>
        `),
    a &&
      s &&
      (c += `
        <div class="filter-chip folder-chip">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px">
            <path d="M3 6h18"/><path d="M7 12h10"/><path d="M9 18h6"/>
          </svg>
          <span>${p(s)}</span>
          <button data-action="clear-collection-filter" title="Remove">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      `),
    d.tags.length > 0 &&
      (c += `
            <div style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center; flex-wrap: wrap;">
                <button id="filter-tag-mode-btn" data-action="toggle-tag-mode" class="tag-mode-btn ${d.tagMode === "AND" ? "and-mode" : "or-mode"}">
                    Match: ${d.tagMode}
                </button>
                <span style="font-size: 12px; color: var(--text-muted);">${d.tags.length} tag${d.tags.length !== 1 ? "s" : ""} selected</span>
            </div>
        `),
    d.tags.forEach((l) => {
      c += `
            <div class="filter-chip">
            <svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                  <line x1="7" y1="7" x2="7.01" y2="7" />
                </svg>
                <span>${p(l)}</span>
                <button data-action="remove-tag-filter" data-tag="${p(l)}" title="Remove">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
        `;
    }),
    o?.value.trim() &&
      (c += `
            <div class="filter-chip tag-chip">
                <span>Search: ${p(o.value)}</span>
                <button data-action="clear-search" title="Remove">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
        `),
    (e.innerHTML = c));
}
function Ve(t) {
  (d.tags.includes(t)
    ? O({ ...d, tags: d.tags.filter((n) => n !== t) })
    : O({ ...d, tags: [...d.tags, t] }),
    C("all"),
    L(null));
  const e = document.getElementById("search-input"),
    o = document.getElementById("view-title");
  (e && (e.value = ""),
    o &&
      (d.tags.length === 0
        ? (o.textContent = "Bookmarks")
        : (o.textContent = `Tags: ${d.tags.join(", ")} (${d.tagMode})`)),
    M(),
    $(),
    P(),
    m(
      async () => {
        const { renderBookmarks: n } = await Promise.resolve().then(() => y);
        return { renderBookmarks: n };
      },
      void 0,
    ).then(({ renderBookmarks: n }) => n()));
}
function Ne() {
  O({ ...d, tagMode: d.tagMode === "OR" ? "AND" : "OR" });
  const t = document.getElementById("view-title");
  (t &&
    d.tags.length > 0 &&
    (t.textContent = `Tags: ${d.tags.join(", ")} (${d.tagMode})`),
    $(),
    m(
      async () => {
        const { renderBookmarks: e } = await Promise.resolve().then(() => y);
        return { renderBookmarks: e };
      },
      void 0,
    ).then(({ renderBookmarks: e }) => e()));
}
function ze(t) {
  if (
    (O({ ...d, tags: d.tags.filter((e) => e !== t) }),
    $(),
    m(
      async () => {
        const { renderBookmarks: e } = await Promise.resolve().then(() => y);
        return { renderBookmarks: e };
      },
      void 0,
    ).then(({ renderBookmarks: e }) => e()),
    P(),
    d.tags.length === 0)
  ) {
    const e = document.getElementById("view-title");
    e && (e.textContent = "Bookmarks");
  }
}
function He() {
  const t = document.getElementById("search-input");
  (t && (t.value = ""),
    m(
      async () => {
        const { renderBookmarks: e } = await Promise.resolve().then(() => y);
        return { renderBookmarks: e };
      },
      void 0,
    ).then(({ renderBookmarks: e }) => e()),
    $());
}
async function je(t, e) {
  !t ||
    !e ||
    (await v("/tags/rename", {
      method: "POST",
      body: JSON.stringify({ from: t, to: e }),
    }),
    x(
      k.map((o) => {
        if (!o.tags) return o;
        const n = N(o.tags).map((a) => (a === t ? e : a)),
          r = Array.from(new Set(n)).join(", ");
        return { ...o, tags: r };
      }),
    ),
    m(
      async () => {
        const { renderBookmarks: o } = await Promise.resolve().then(() => y);
        return { renderBookmarks: o };
      },
      void 0,
    ).then(({ renderBookmarks: o }) => o()),
    P(),
    await H(),
    ft({ from: t, to: e }),
    D(),
    u(`Renamed ${t} → ${e}`, "success"));
}
async function H() {
  const t = document.getElementById("tag-stats-list");
  if (t)
    try {
      const e = await v("/tags");
      if (!e || e.length === 0) {
        ((t.innerHTML =
          '<div class="text-tertiary" style="font-size:0.9rem;">No tags yet</div>'),
          D());
        return;
      }
      const o = d.tagSort || "count_desc";
      (e.sort((n, r) => {
        switch (o) {
          case "count_asc":
            return n.count - r.count;
          case "name_asc":
            return n.name.localeCompare(r.name);
          case "name_desc":
            return r.name.localeCompare(n.name);
          case "count_desc":
          default:
            return r.count - n.count;
        }
      }),
        (t._allTags = e),
        re(e),
        D());
    } catch {
      ((t.innerHTML =
        '<div class="text-tertiary" style="font-size:0.9rem;">Failed to load tags</div>'),
        D());
    }
}
function re(t) {
  const e = document.getElementById("tag-stats-list");
  e &&
    ((e.innerHTML = t
      .map((o) => {
        const n = o.parent ? `<div class="tag-path">${p(o.parent)}</div>` : "";
        return `
                <div class="tag-stat-item">
                    <div style="flex:1">
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                            <span class="tag-dot" style="background-color: ${o.color || "var(--text-secondary)"}"></span>
                            ${p(o.name)}
                        </div>
                        ${n}
                    </div>
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                         ${Q(o.count)}
                         <button class="btn-icon btn-sm edit-tag-btn" data-id="${o.id}" data-name="${p(o.name)}" data-color="${o.color || ""}" title="Edit Tag">
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                         </button>
                    </div>
                </div>`;
      })
      .join("")),
    e.querySelectorAll(".edit-tag-btn").forEach((o) => {
      o.addEventListener("click", () => {
        const n = {
          id: o.dataset.id,
          name: o.dataset.name,
          color: o.dataset.color,
        };
        le(n);
      });
    }));
}
function Ct(t) {
  const e = document.getElementById("tag-stats-list");
  if (!e || !e._allTags) return;
  const o = t.toLowerCase().trim();
  if (!o) {
    re(e._allTags);
    return;
  }
  const n = e._allTags.filter(
    (r) =>
      r.name.toLowerCase().includes(o) ||
      (r.parent && r.parent.toLowerCase().includes(o)),
  );
  n.length === 0
    ? (e.innerHTML =
        '<div class="text-tertiary" style="font-size:0.9rem;">No tags found</div>')
    : re(n);
}
function D() {
  const t = document.getElementById("tag-rename-undo-btn");
  t &&
    (ee
      ? ((t.disabled = !1), (t.textContent = `Undo ${ee.from} → ${ee.to}`))
      : ((t.disabled = !0), (t.textContent = "Undo last rename")));
}
async function qe(t) {
  if (!t) return;
  const e = {};
  k.forEach((r) => {
    r.tags &&
      r.tags.split(",").forEach((a) => {
        const s = a.trim();
        s && (e[s] = (e[s] || 0) + 1);
      });
  });
  const o = Object.keys(e).map((r) => ({ name: r, count: e[r] }));
  o.sort((r, a) => a.count - r.count);
  const n = o.slice(0, 50);
  if (n.length === 0) {
    t.innerHTML =
      '<div style="padding:0.5rem;color:var(--text-tertiary);text-align:center;font-size:0.85rem">No tags yet</div>';
    return;
  }
  ((t.innerHTML = n
    .map((r) => {
      const a = d.tags.includes(r.name);
      return `
            <div class="tag-item ${a ? "active" : ""}" data-tag="${p(r.name)}" 
                 style="display:inline-flex;align-items:center;gap:0.25rem;padding:0.35rem 0.6rem;
                        background:${a ? "var(--primary-500)" : "var(--bg-tertiary)"};
                        color:${a ? "white" : "var(--text-primary)"};
                        border-radius:var(--radius-md);margin:0.25rem;cursor:pointer;font-size:0.85rem">
                <span>${p(r.name)}</span>
                <span style="opacity:0.7;font-size:0.75rem">${r.count}</span>
            </div>
        `;
    })
    .join("")),
    t.querySelectorAll(".tag-item").forEach((r) => {
      r.addEventListener("click", async (a) => {
        a.stopPropagation();
        const s = r.dataset.tag,
          i = [...d.tags],
          c = i.indexOf(s);
        (c > -1
          ? (i.splice(c, 1),
            r.classList.remove("active"),
            (r.style.background = "var(--bg-tertiary)"),
            (r.style.color = "var(--text-primary)"))
          : (i.push(s),
            r.classList.add("active"),
            (r.style.background = "var(--primary-500)"),
            (r.style.color = "white")),
          O({ ...d, tags: i }));
        const { loadBookmarks: l } = await m(
          async () => {
            const { loadBookmarks: f } = await Promise.resolve().then(() => y);
            return { loadBookmarks: f };
          },
          void 0,
        );
        await l();
      });
    }));
}
function le(t) {
  const e = document.getElementById("tag-modal"),
    o = document.getElementById("tag-form"),
    n = document.getElementById("tag-id"),
    r = document.getElementById("tag-name"),
    a = document.getElementById("tag-color");
  if (!e || !o || !n || !r || !a) return;
  ((n.value = t.id || ""), (r.value = t.name || ""));
  const s = t.color || "#f59e0b";
  ((a.value = s),
    document.querySelectorAll(".color-option-tag").forEach((i) => {
      i.dataset.color === s
        ? i.classList.add("active")
        : i.classList.remove("active");
    }),
    e.classList.remove("hidden"),
    r.focus());
}
async function Ue(t) {
  t.preventDefault();
  const e = document.getElementById("tag-id").value,
    o = document.getElementById("tag-name").value.trim(),
    n = document.getElementById("tag-color").value;
  if (o)
    try {
      await v(`/tags/${e}`, {
        method: "PUT",
        body: JSON.stringify({ name: o, color: n }),
      });
      const r = document.getElementById("tag-modal");
      (r && r.classList.add("hidden"), H());
      const a = new CustomEvent("tag-updated");
      (window.dispatchEvent(a), u("Tag updated successfully", "success"));
    } catch (r) {
      u(r.message || "Failed to update tag", "error");
    }
}
async function Je(t, e) {
  if (!t || !t.trim()) return (u("Tag name is required", "error"), !1);
  try {
    return (
      await v("/tags", {
        method: "POST",
        body: JSON.stringify({ name: t.trim(), color: e || "#f59e0b" }),
      }),
      await H(),
      P(),
      u(`Tag "${t}" created successfully`, "success"),
      !0
    );
  } catch (o) {
    const n = o.message || "Failed to create tag";
    return (u(n, "error"), !1);
  }
}
const Pt = {
    renderSidebarTags: P,
    sidebarFilterTag: de,
    filterSidebarTags: De,
    showAllTags: Re,
    renderTagsList: z,
    clearAllFilters: Fe,
    renderActiveFilters: $,
    toggleFilterTag: Ve,
    toggleTagMode: Ne,
    removeTagFilter: ze,
    clearSearch: He,
    loadTagStats: H,
    renameTagAcross: je,
    updateTagRenameUndoButton: D,
    renderTagsForFilter: qe,
    openTagModal: le,
    handleTagSubmit: Ue,
    createNewTag: Je,
  },
  R = Object.freeze(
    Object.defineProperty(
      {
        __proto__: null,
        clearAllFilters: Fe,
        clearSearch: He,
        createNewTag: Je,
        default: Pt,
        filterSidebarTags: De,
        filterTagStats: Ct,
        handleTagSubmit: Ue,
        loadTagStats: H,
        openTagModal: le,
        removeTagFilter: ze,
        renameTagAcross: je,
        renderActiveFilters: $,
        renderSidebarTags: P,
        renderTagsForFilter: qe,
        renderTagsList: z,
        showAllTags: Re,
        sidebarFilterTag: de,
        toggleFilterTag: Ve,
        toggleTagMode: Ne,
        updateTagRenameUndoButton: D,
      },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  );
async function We() {
  try {
    const t = await v("/folders");
    (be(t), F(), V(), me());
  } catch {
    u("Failed to load folders", "error");
  }
}
function F() {
  const t = document.getElementById("folders-list");
  if (!t) return;
  const e = _.filter((r) => !r.parent_id),
    o = (r, a) => {
      const s = k.filter((c) => c.folder_id === r.id).length,
        i = k.filter((c) => c.folder_id === a.id).length;
      return s > 0 && i === 0
        ? -1
        : s === 0 && i > 0
          ? 1
          : r.name.localeCompare(a.name);
    };
  e.sort(o);
  function n(r, a = 0) {
    return r
      .map((s) => {
        const i = _.filter((I) => I.parent_id === s.id).sort(o),
          c = Y(s.id),
          l = new Set([s.id, ...c]),
          f = k.filter((I) => I.folder_id && l.has(I.folder_id)).length,
          w = f === 0,
          T = a * 12;
        return `
            <div class="nav-item folder-item ${S === s.id ? "active" : ""} ${w ? "empty" : ""}" 
                 data-folder="${s.id}" 
                 data-folder-name="${p(s.name)}"
                 data-folder-color="${s.color || ""}"
                 draggable="true"
                 style="padding-left: ${12 + T}px; cursor: grab;">
                <span class="folder-color" style="background: ${s.color || "var(--primary-500)"}"></span>
                <span class="folder-name">${p(s.name)}</span>
                ${f > 0 ? Q(f) : ""}
                <div class="folder-actions">
                    <button class="btn-icon" data-action="edit-folder" data-id="${s.id}" title="Edit">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                    </button>
                    <button class="btn-icon" data-action="delete-folder" data-id="${s.id}" title="Delete">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                    </button>
                </div>
            </div>
            ${n(i, a + 1)}
            `;
      })
      .join("");
  }
  ((t.innerHTML = n(e)),
    t.querySelectorAll(".folder-item").forEach((r) => {
      (r.addEventListener("click", (a) => {
        if (a.defaultPrevented || a.target.closest(".folder-actions")) return;
        if ((a.stopPropagation(), h === "dashboard")) {
          m(
            async () => {
              const { addDashboardWidget: c } =
                await import("./dashboard-C1Pj_fLe.js");
              return { addDashboardWidget: c };
            },
            __vite__mapDeps([0, 1, 2]),
          ).then(({ addDashboardWidget: c }) => {
            const l = _e.length,
              f = 50 + ((l * 30) % 300),
              w = 50 + ((l * 30) % 200);
            try {
              c("folder", r.dataset.folder, f, w);
            } catch (T) {
              u("Error adding widget: " + T.message, "error");
            }
          });
          return;
        }
        (L(r.dataset.folder),
          C("folder"),
          M(),
          m(
            async () => {
              const { renderActiveFilters: c } = await Promise.resolve().then(
                () => R,
              );
              return { renderActiveFilters: c };
            },
            void 0,
          ).then(({ renderActiveFilters: c }) => c()),
          m(
            async () => {
              const { loadBookmarks: c } = await Promise.resolve().then(
                () => y,
              );
              return { loadBookmarks: c };
            },
            void 0,
          ).then(({ loadBookmarks: c }) => c()));
        const s = _.find((c) => c.id === S),
          i = document.getElementById("view-title");
        i && (i.textContent = s ? s.name : "Folder");
      }),
        r.getAttribute("draggable") === "true" &&
          (r.addEventListener("dragstart", (a) => {
            (U({
              type: "folder",
              id: r.dataset.folder,
              name: r.dataset.folderName,
              color: r.dataset.folderColor,
            }),
              a.dataTransfer &&
                ((a.dataTransfer.effectAllowed = "copy"),
                a.dataTransfer.setData("text/plain", r.dataset.folderName)));
          }),
          r.addEventListener("dragend", () => {
            U(null);
          })));
    }));
}
function V() {
  const t = document.getElementById("bookmark-folder");
  if (!t) return;
  let e = '<option value="">None</option>';
  const o = (r, a) => r.name.localeCompare(a.name);
  function n(r, a = 0) {
    _.filter((i) => i.parent_id === r)
      .sort(o)
      .forEach((i) => {
        const c = "&nbsp;&nbsp;&nbsp;".repeat(a);
        ((e += `<option value="${i.id}">${c}${p(i.name)}</option>`),
          n(i.id, a + 1));
      });
  }
  (n(null), (t.innerHTML = e));
}
function ue(t = null) {
  const e = document.getElementById("folder-parent");
  if (!e) return;
  let o = '<option value="">None (Top Level)</option>';
  function n(s) {
    if (!t) return !1;
    if (s === t) return !0;
    let i = _.find((c) => c.id === s);
    for (; i; ) {
      if (i.id === t) return !0;
      i = _.find((c) => c.id === i.parent_id);
    }
    return !1;
  }
  const r = (s, i) => s.name.localeCompare(i.name);
  function a(s, i = 0) {
    _.filter((l) => l.parent_id === s)
      .sort(r)
      .forEach((l) => {
        if (t && (l.id === t || n(l.id))) return;
        const f = "&nbsp;&nbsp;&nbsp;".repeat(i);
        ((o += `<option value="${l.id}">${f}${p(l.name)}</option>`),
          a(l.id, i + 1));
      });
  }
  (a(null), (e.innerHTML = o));
}
function me() {
  const t = document.getElementById("bulk-move-select");
  t &&
    (t.innerHTML =
      '<option value="">Choose folder</option>' +
      _.map((e) => `<option value="${e.id}">${p(e.name)}</option>`).join(""));
}
async function Ke(t, e = {}) {
  const { closeModal: o = !0 } = e;
  try {
    const n = await v("/folders", { method: "POST", body: JSON.stringify(t) });
    return (_.push(n), F(), V(), o && G(), u("Folder created!", "success"), n);
  } catch (n) {
    return (u(n.message, "error"), null);
  }
}
async function Ge(t, e) {
  try {
    const o = await v(`/folders/${t}`, {
        method: "PUT",
        body: JSON.stringify(e),
      }),
      n = _.findIndex((r) => r.id === t);
    (n !== -1 && (_[n] = o), F(), V(), G(), u("Folder updated!", "success"));
  } catch (o) {
    u(o.message, "error");
  }
}
async function Qe(t) {
  if (confirm("Delete this folder? Bookmarks will be moved to uncategorized."))
    try {
      if (
        (await v(`/folders/${t}`, { method: "DELETE" }),
        be(_.filter((e) => e.id !== t)),
        S === t)
      ) {
        (L(null), C("all"));
        const e = document.getElementById("view-title");
        (e && (e.textContent = "Bookmarks"),
          m(
            async () => {
              const { renderActiveFilters: o } = await Promise.resolve().then(
                () => R,
              );
              return { renderActiveFilters: o };
            },
            void 0,
          ).then(({ renderActiveFilters: o }) => o()));
      }
      (F(),
        V(),
        m(
          async () => {
            const { loadBookmarks: e } = await Promise.resolve().then(() => y);
            return { loadBookmarks: e };
          },
          void 0,
        ).then(({ loadBookmarks: e }) => e()),
        u("Folder deleted", "success"));
    } catch (e) {
      u(e.message, "error");
    }
}
function Xe(t) {
  const e = _.find((c) => c.id === t);
  if (!e) return;
  const o = document.getElementById("folder-modal-title");
  o && (o.textContent = "Edit Folder");
  const n = document.getElementById("folder-id");
  n && (n.value = t);
  const r = document.getElementById("folder-name");
  r && (r.value = e.name);
  const a = document.getElementById("folder-color");
  (a && (a.value = e.color || ""),
    document.querySelectorAll(".color-option").forEach((c) => {
      c.dataset.color === e.color
        ? c.classList.add("active")
        : c.classList.remove("active");
    }),
    ue(t));
  const s = document.getElementById("folder-parent");
  s && (s.value = e.parent_id || "");
  const i = document.getElementById("folder-form");
  if (i) {
    const c = i.querySelector('button[type="submit"]');
    c && (c.textContent = "Save");
  }
  Ee("folder-modal");
}
function Ye(t) {
  const e = _.filter((r) => !r.parent_id);
  if (t < 0 || t >= e.length) return;
  const o = e[t];
  (L(o.id), C("folder"));
  const n = document.getElementById("view-title");
  (n && (n.textContent = o.name),
    M(),
    m(
      async () => {
        const { renderActiveFilters: r } = await Promise.resolve().then(
          () => R,
        );
        return { renderActiveFilters: r };
      },
      void 0,
    ).then(({ renderActiveFilters: r }) => r()),
    m(
      async () => {
        const { loadBookmarks: r } = await Promise.resolve().then(() => y);
        return { loadBookmarks: r };
      },
      void 0,
    ).then(({ loadBookmarks: r }) => r()));
}
function Y(t) {
  const e = [t];
  return (
    _.filter((n) => n.parent_id === t).forEach((n) => {
      e.push(...Y(n.id));
    }),
    e
  );
}
async function $t(t) {
  if (!t) return;
  const e = _;
  if (e.length === 0) {
    t.innerHTML =
      '<div style="padding:0.5rem;color:var(--text-tertiary);text-align:center;font-size:0.85rem">No folders yet</div>';
    return;
  }
  const o = (n = null, r = 0) =>
    e
      .filter((a) => a.parent_id === n)
      .map((a) => {
        const s = S === a.id,
          i = e.some((l) => l.parent_id === a.id),
          c = r * 1.25;
        return `
                    <div class="folder-item ${s ? "active" : ""}" data-folder-id="${a.id}" style="padding-left: ${c}rem">
                        <span class="folder-icon" style="color: ${p(a.color || "#6b7280")}">📁</span>
                        <span class="folder-name">${p(a.name)}</span>
                        <span class="folder-count">${a.bookmark_count || 0}</span>
                    </div>
                    ${i ? o(a.id, r + 1) : ""}
                `;
      })
      .join("");
  ((t.innerHTML = o()),
    t.querySelectorAll(".folder-item").forEach((n) => {
      n.addEventListener("click", async (r) => {
        r.stopPropagation();
        const a = n.dataset.folderId;
        (t
          .querySelectorAll(".folder-item")
          .forEach((i) => i.classList.remove("active")),
          n.classList.add("active"),
          L(a),
          O({ ...d, folder: a }));
        const { loadBookmarks: s } = await m(
          async () => {
            const { loadBookmarks: i } = await Promise.resolve().then(() => y);
            return { loadBookmarks: i };
          },
          void 0,
        );
        await s();
      });
    }));
}
const At = {
    loadFolders: We,
    renderFolders: F,
    updateFolderSelect: V,
    updateFolderParentSelect: ue,
    populateBulkMoveSelect: me,
    createFolder: Ke,
    updateFolder: Ge,
    deleteFolder: Qe,
    editFolder: Xe,
    navigateToFolderByIndex: Ye,
    getAllChildFolderIds: Y,
  },
  Ot = Object.freeze(
    Object.defineProperty(
      {
        __proto__: null,
        createFolder: Ke,
        default: At,
        deleteFolder: Qe,
        editFolder: Xe,
        getAllChildFolderIds: Y,
        loadFolders: We,
        navigateToFolderByIndex: Ye,
        populateBulkMoveSelect: me,
        renderFolders: F,
        renderFoldersForFilter: $t,
        updateFolder: Ge,
        updateFolderParentSelect: ue,
        updateFolderSelect: V,
      },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  );
async function Mt() {
  if (g.size === 0 || !confirm(`Delete ${g.size} bookmark(s)?`)) return;
  const t = Array.from(g);
  for (const o of t) await v(`/bookmarks/${o}`, { method: "DELETE" });
  x(k.filter((o) => !g.has(o.id)));
  const { clearSelections: e } = await m(
    async () => {
      const { clearSelections: o } = await Promise.resolve().then(() => y);
      return { clearSelections: o };
    },
    void 0,
  );
  (e(), await b(), u("Bookmarks deleted", "success"));
}
async function Dt() {
  if (g.size === 0) return;
  const t = Array.from(g);
  for (const o of t) {
    await v(`/bookmarks/${o}`, {
      method: "PUT",
      body: JSON.stringify({ is_favorite: 1 }),
    });
    const n = k.find((r) => r.id === o);
    n && (n.is_favorite = !0);
  }
  const { renderBookmarks: e } = await m(
    async () => {
      const { renderBookmarks: o } = await Promise.resolve().then(() => y);
      return { renderBookmarks: o };
    },
    void 0,
  );
  (e(), await b(), u("Marked as favorite", "success"));
}
async function Rt() {
  const t = document.getElementById("bulk-move-select");
  if (!t) return;
  const e = t.value || null;
  if (e === null) return;
  const o = Array.from(g);
  for (const r of o) {
    await v(`/bookmarks/${r}`, {
      method: "PUT",
      body: JSON.stringify({ folder_id: e }),
    });
    const a = k.find((s) => s.id === r);
    a && (a.folder_id = e);
  }
  const { clearSelections: n } = await m(
    async () => {
      const { clearSelections: r } = await Promise.resolve().then(() => y);
      return { clearSelections: r };
    },
    void 0,
  );
  (n(), await b(), u("Bookmarks moved", "success"));
}
async function Ze() {
  if (g.size === 0) return;
  const t = prompt("Add tags (comma separated):"),
    e = N(t || "");
  if (e.length === 0) return;
  const o = Array.from(g);
  (await v("/tags/bulk-add", {
    method: "POST",
    body: JSON.stringify({ bookmark_ids: o, tags: e }),
  }),
    x(
      k.map((s) => {
        if (!g.has(s.id)) return s;
        const i = new Set([...N(s.tags || ""), ...e]);
        return { ...s, tags: Array.from(i).join(", "), tags_detailed: void 0 };
      }),
    ));
  const { clearSelections: n, renderBookmarks: r } = await m(
      async () => {
        const { clearSelections: s, renderBookmarks: i } =
          await Promise.resolve().then(() => y);
        return { clearSelections: s, renderBookmarks: i };
      },
      void 0,
    ),
    { renderSidebarTags: a } = await m(
      async () => {
        const { renderSidebarTags: s } = await Promise.resolve().then(() => R);
        return { renderSidebarTags: s };
      },
      void 0,
    );
  (n(), await b(), r(), a(), u("Tags added to selection", "success"));
}
async function et() {
  if (g.size === 0) return;
  const t = prompt("Remove tags (comma separated):"),
    e = N(t || "");
  if (e.length === 0) return;
  const o = Array.from(g);
  await v("/tags/bulk-remove", {
    method: "POST",
    body: JSON.stringify({ bookmark_ids: o, tags: e }),
  });
  const n = new Set(e.map((i) => i.toLowerCase()));
  x(
    k.map((i) => {
      if (!g.has(i.id) || !i.tags) return i;
      const c = N(i.tags).filter((l) => !n.has(l.toLowerCase()));
      return { ...i, tags: c.join(", "), tags_detailed: void 0 };
    }),
  );
  const { clearSelections: r, renderBookmarks: a } = await m(
      async () => {
        const { clearSelections: i, renderBookmarks: c } =
          await Promise.resolve().then(() => y);
        return { clearSelections: i, renderBookmarks: c };
      },
      void 0,
    ),
    { renderSidebarTags: s } = await m(
      async () => {
        const { renderSidebarTags: i } = await Promise.resolve().then(() => R);
        return { renderSidebarTags: i };
      },
      void 0,
    );
  (r(), await b(), a(), s(), u("Tags removed from selection", "success"));
}
async function tt() {
  if (g.size === 0) return;
  const t = Array.from(g);
  try {
    await v("/bookmarks/bulk/archive", {
      method: "POST",
      body: JSON.stringify({ ids: t }),
    });
  } catch (n) {
    (console.error("[bulkArchive] API call failed:", n),
      u("Failed to archive bookmarks", "error"));
    return;
  }
  x(k.map((n) => (g.has(n.id) ? { ...n, is_archived: 1 } : n)));
  const { clearSelections: e, renderBookmarks: o } = await m(
    async () => {
      const { clearSelections: n, renderBookmarks: r } =
        await Promise.resolve().then(() => y);
      return { clearSelections: n, renderBookmarks: r };
    },
    void 0,
  );
  (e(), o(), await b(), u(`${t.length} bookmarks archived`, "success"));
}
async function ot() {
  if (g.size === 0) return;
  const t = Array.from(g);
  (await v("/bookmarks/bulk/unarchive", {
    method: "POST",
    body: JSON.stringify({ ids: t }),
  }),
    x(k.map((n) => (g.has(n.id) ? { ...n, is_archived: 0 } : n))));
  const { clearSelections: e, renderBookmarks: o } = await m(
    async () => {
      const { clearSelections: n, renderBookmarks: r } =
        await Promise.resolve().then(() => y);
      return { clearSelections: n, renderBookmarks: r };
    },
    void 0,
  );
  (e(), o(), await b(), u(`${t.length} bookmarks unarchived`, "success"));
}
const Ft = {
    bulkAddTags: Ze,
    bulkRemoveTags: et,
    bulkArchive: tt,
    bulkUnarchive: ot,
  },
  qt = Object.freeze(
    Object.defineProperty(
      {
        __proto__: null,
        bulkAddTags: Ze,
        bulkArchive: tt,
        bulkDelete: Mt,
        bulkFavorite: Dt,
        bulkMove: Rt,
        bulkRemoveTags: et,
        bulkUnarchive: ot,
        default: Ft,
      },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  );
export {
  Ht as a,
  pt as b,
  y as c,
  jt as d,
  p as e,
  Ot as f,
  zt as g,
  qt as h,
  R as s,
  yt as u,
};
//# sourceMappingURL=bookmarks-hgxSTBhD.js.map

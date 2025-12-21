import { c as U, s as f } from "./ui-DJeZlV46.js";
const F = "modulepreload",
  N = function (e) {
    return "/" + e;
  },
  C = {},
  W = function (r, t, a) {
    let s = Promise.resolve();
    if (t && t.length > 0) {
      let l = function (u) {
        return Promise.all(
          u.map((m) =>
            Promise.resolve(m).then(
              (g) => ({ status: "fulfilled", value: g }),
              (g) => ({ status: "rejected", reason: g }),
            ),
          ),
        );
      };
      document.getElementsByTagName("link");
      const i = document.querySelector("meta[property=csp-nonce]"),
        o = i?.nonce || i?.getAttribute("nonce");
      s = l(
        t.map((u) => {
          if (((u = N(u)), u in C)) return;
          C[u] = !0;
          const m = u.endsWith(".css"),
            g = m ? '[rel="stylesheet"]' : "";
          if (document.querySelector(`link[href="${u}"]${g}`)) return;
          const d = document.createElement("link");
          if (
            ((d.rel = m ? "stylesheet" : F),
            m || (d.as = "script"),
            (d.crossOrigin = ""),
            (d.href = u),
            o && d.setAttribute("nonce", o),
            document.head.appendChild(d),
            m)
          )
            return new Promise((E, z) => {
              (d.addEventListener("load", E),
                d.addEventListener("error", () =>
                  z(new Error(`Unable to preload CSS for ${u}`)),
                ));
            });
        }),
      );
    }
    function n(i) {
      const o = new Event("vite:preloadError", { cancelable: !0 });
      if (((o.payload = i), window.dispatchEvent(o), !o.defaultPrevented))
        throw i;
    }
    return s.then((i) => {
      for (const o of i || []) o.status === "rejected" && n(o.reason);
      return r().catch(n);
    });
  },
  j = "/api";
let I = null,
  c = null,
  q = !1,
  K = [],
  V = [],
  G = [],
  Fe = [],
  x = "dashboard",
  J = null,
  H = null,
  X = "grid",
  Y = !1,
  Q = !0,
  Z = !1,
  ee = !0,
  te = !1,
  re = !1,
  ae = { mode: "folder", tags: [], bookmarkSort: "recently_added" },
  se = {},
  ne = [],
  oe = [],
  ie = null,
  le = !1,
  de = {
    sort: "recently_added",
    tags: [],
    tagSort: "count_desc",
    tagMode: "OR",
  },
  ue = {},
  Ne = new Set(),
  ce = null,
  fe = !1,
  ge = !1,
  me = [],
  ye = 0,
  We = {
    active: !1,
    currentStep: 0,
    steps: [
      {
        title: "✨ Add Your First Bookmark",
        description: 'Click the "Add Bookmark" button to save your first link.',
        target: "sidebar-add-bookmark-btn",
        position: "bottom",
      },
      {
        title: "🔍 Search in Seconds",
        description: "Use Ctrl+K to search all your bookmarks instantly.",
        target: "search-input",
        position: "bottom",
      },
      {
        title: "🏷️ Organize with Tags",
        description:
          "Add tags to bookmarks for flexible filtering and organization.",
        target: "bookmark-tags",
        position: "bottom",
      },
    ],
  },
  he = null,
  be = !0;
const pe = 50;
let Ae = pe,
  we = !1,
  ve = !1,
  Se = null,
  ke = null,
  Ee = !1,
  Ie = { x: 0, y: 0 },
  Pe = { x: 0, y: 0 },
  Ce = !1,
  xe = null,
  Te = { w: 0, h: 0 },
  _e = [],
  Be = !1;
function p(e) {
  I = e;
}
function A(e) {
  c = e;
}
function w(e) {
  q = e;
}
function je(e) {
  K = e;
}
function qe(e) {
  V = e;
}
function Ke(e) {
  G = e;
}
function Ve(e) {
  (x === "tag-cloud" &&
    e !== "tag-cloud" &&
    typeof window.__tagCloudResizeCleanup == "function" &&
    (window.__tagCloudResizeCleanup(),
    (window.__tagCloudResizeCleanup = void 0)),
    (x = e));
}
function Ge(e) {
  J = e;
}
function Je(e) {
  H = e;
}
function He(e) {
  X = e;
}
function Xe(e) {
  ue = e;
}
function Ye(e) {
  Y = e;
}
function Qe(e) {}
function Ze(e) {
  Q = e;
}
function et(e) {
  Z = e;
}
function tt(e) {
  ee = e;
}
function rt(e) {
  te = e;
}
function at(e) {
  re = e;
}
function st(e) {
  ae = e;
}
function nt(e) {
  se = e;
}
function ot(e) {
  ne = e;
}
function it(e) {
  oe = e;
}
function lt(e) {
  ie = e;
}
function dt(e) {}
function ut(e) {
  le = e;
}
function ct(e) {}
function ft(e) {
  de = e;
}
function gt(e) {
  ce = e;
}
function mt(e) {
  fe = e;
}
function yt(e) {
  ge = e;
}
function ht(e) {
  me = e;
}
function bt(e) {
  ye = e;
}
function pt(e) {
  he = e;
}
function At(e) {
  be = e;
}
function wt(e) {
  Ae = e;
}
function vt(e) {
  we = e;
}
function St(e) {
  ve = e;
}
function kt(e) {
  Se = e;
}
function Et(e) {
  ke = e;
}
function It(e) {
  Ee = e;
}
function Pt(e) {
  Ie = e;
}
function Ct(e) {
  Pe = e;
}
function xt(e) {
  Ce = e;
}
function Tt(e) {
  xe = e;
}
function _t(e) {
  Te = e;
}
function Bt(e) {
  _e = e;
}
function Ot(e) {
  Be = e;
}
(function () {
  const r = "anchormarks_",
    t = "anchormarks_",
    a = [];
  for (let s = 0; s < localStorage.length; s++) {
    const n = localStorage.key(s);
    n && n.startsWith(r) && a.push(n);
  }
  a.forEach((s) => {
    const n = s.slice(r.length),
      i = `${t}${n}`;
    (localStorage.getItem(i) ||
      localStorage.setItem(i, localStorage.getItem(s) || ""),
      localStorage.removeItem(s));
  });
})();
const b = new Map();
function Oe(e, r) {
  const t = r.method || "GET",
    a = r.body ? String(r.body) : "";
  return `${t}:${e}:${a}`;
}
async function y(e, r = {}) {
  const a = !r.method || r.method === "GET" ? Oe(e, r) : null;
  if (a && b.has(a)) {
    const l = b.get(a);
    if (r.signal && r.signal.aborted) b.delete(a);
    else return l;
  }
  const s = { "Content-Type": "application/json" };
  I && (s["X-CSRF-Token"] = I);
  const n = r.signal ? void 0 : new AbortController(),
    i = r.signal || n?.signal,
    o = (async () => {
      try {
        const l = await fetch(`${j}${e}`, {
          ...r,
          signal: i,
          credentials: "include",
          headers: { ...s, ...r.headers },
        });
        if (l.status === 401) {
          (p(null), A(null), w(!1));
          const { showAuthScreen: d } = await W(
            async () => {
              const { showAuthScreen: E } = await Promise.resolve().then(
                () => ze,
              );
              return { showAuthScreen: E };
            },
            void 0,
          );
          throw (d(), new Error("Session expired"));
        }
        const u = l.headers.get("content-type"),
          m = u?.includes("application/json");
        let g;
        try {
          if (m) g = await l.json();
          else {
            const d = await l.text();
            throw new Error(
              `Invalid response format (expected JSON, got ${u || "unknown"}): ${d.substring(0, 100)}`,
            );
          }
        } catch (d) {
          throw d instanceof SyntaxError
            ? new Error(
                `Failed to parse JSON response: ${l.status} ${l.statusText}`,
              )
            : d;
        }
        if (!l.ok) {
          const d = g?.error || `API Error: ${l.status} ${l.statusText}`;
          throw new Error(d);
        }
        return g;
      } catch (l) {
        throw l instanceof Error && l.name === "AbortError"
          ? new Error("Request cancelled")
          : l;
      } finally {
        a && b.delete(a);
      }
    })();
  return (
    a && b.set(a, o),
    n &&
      a &&
      (o.abort = () => {
        (n.abort(), b.delete(a));
      }),
    o
  );
}
const Lt = Object.freeze(
  Object.defineProperty({ __proto__: null, api: y }, Symbol.toStringTag, {
    value: "Module",
  }),
);
class Le {
  isDevelopment() {
    return localStorage.getItem("anchormarks_debug") === "true";
  }
  shouldLog(r) {
    return this.isDevelopment() ? !0 : r === "warn" || r === "error";
  }
  formatMessage(r, t) {
    return t ? `[${t}] ${r}` : r;
  }
  debug(r, ...t) {
    this.shouldLog("debug") && console.debug(this.formatMessage(r), ...t);
  }
  info(r, ...t) {
    this.shouldLog("info") && console.info(this.formatMessage(r), ...t);
  }
  warn(r, ...t) {
    this.shouldLog("warn") && console.warn(this.formatMessage(r), ...t);
  }
  error(r, t, ...a) {
    if (this.shouldLog("error")) {
      const s = this.formatMessage(r);
      t instanceof Error
        ? console.error(s, t, ...a)
        : t
          ? console.error(s, t, ...a)
          : console.error(s, ...a);
    }
  }
  log(r, ...t) {
    this.info(r, ...t);
  }
}
const h = new Le();
function Me(e) {
  const r = e.message.toLowerCase();
  return (
    r.includes("failed to fetch") ||
    r.includes("networkerror") ||
    r.includes("unexpected token") ||
    r.includes("json") ||
    /5\d\d/.test(r)
  );
}
function Re(e) {
  return e.message.match(/5\d\d/)
    ? "Server error. Please try again later."
    : "Server is unreachable. Please check your connection.";
}
function $e(e) {
  const r = document.getElementById("server-status-banner"),
    t = document.getElementById("server-status-message");
  r && (r.classList.remove("hidden"), t && (t.textContent = e));
}
function T() {
  const e = document.getElementById("server-status-banner");
  e && e.classList.add("hidden");
}
function v(e, r = !0) {
  const t = e instanceof Error ? e : new Error(String(e)),
    a = t.message || "An unexpected error occurred";
  return (r && Me(t) ? $e(Re(t)) : r && T(), a);
}
function S() {
  U();
  const e = document.getElementById("auth-screen"),
    r = document.getElementById("main-app");
  if (e) {
    e.classList.remove("hidden");
    const t = document.getElementById("login-form"),
      a = document.getElementById("register-form"),
      s = document.getElementById("login-email"),
      n = document.getElementById("login-password"),
      i = document.getElementById("register-email"),
      o = document.getElementById("register-password");
    (t &&
      (t.removeAttribute("data-bitwarden-watching"),
      t.removeAttribute("aria-hidden"),
      t.removeAttribute("inert"),
      (t.style.display = "")),
      a &&
        (a.removeAttribute("data-bitwarden-watching"),
        a.removeAttribute("aria-hidden"),
        a.removeAttribute("inert"),
        (a.style.display = "")),
      t &&
        (t.removeAttribute("data-bitwarden-watching"),
        t.removeAttribute("data-lpignore"),
        t.removeAttribute("data-form-type"),
        t.removeAttribute("aria-hidden"),
        t.removeAttribute("inert"),
        (t.style.display = ""),
        (t.style.visibility = ""),
        (t.style.position = ""),
        (t.style.left = "")),
      a &&
        (a.removeAttribute("data-bitwarden-watching"),
        a.removeAttribute("data-lpignore"),
        a.removeAttribute("data-form-type"),
        a.removeAttribute("aria-hidden"),
        a.removeAttribute("inert"),
        (a.style.display = ""),
        (a.style.visibility = ""),
        (a.style.position = ""),
        (a.style.left = "")),
      s &&
        (s.setAttribute("autocomplete", "username"),
        s.removeAttribute("data-form-type"),
        s.removeAttribute("data-lpignore"),
        s.removeAttribute("tabindex"),
        (s.disabled = !1),
        (s.readOnly = !1),
        (s.style.display = "")),
      n &&
        (n.setAttribute("autocomplete", "current-password"),
        n.removeAttribute("data-form-type"),
        n.removeAttribute("data-lpignore"),
        n.removeAttribute("tabindex"),
        (n.disabled = !1),
        (n.readOnly = !1),
        (n.style.display = ""),
        (n.type = "password")),
      i &&
        (i.setAttribute("autocomplete", "username"),
        i.removeAttribute("data-form-type"),
        i.removeAttribute("data-lpignore"),
        i.removeAttribute("tabindex"),
        (i.disabled = !1),
        (i.readOnly = !1),
        (i.style.display = "")),
      o &&
        (o.setAttribute("autocomplete", "new-password"),
        o.removeAttribute("data-form-type"),
        o.removeAttribute("data-lpignore"),
        o.removeAttribute("tabindex"),
        (o.disabled = !1),
        (o.readOnly = !1),
        (o.style.display = ""),
        (o.type = "password")));
  }
  r && r.classList.add("hidden");
}
function k() {
  const e = document.getElementById("auth-screen"),
    r = document.getElementById("main-app");
  if (e) {
    e.classList.add("hidden");
    const t = document.getElementById("login-form"),
      a = document.getElementById("register-form"),
      s = document.getElementById("login-email"),
      n = document.getElementById("login-password"),
      i = document.getElementById("register-email"),
      o = document.getElementById("register-password");
    (t &&
      (t.setAttribute("data-bitwarden-watching", "false"),
      t.setAttribute("data-lpignore", "true"),
      t.setAttribute("data-form-type", "other"),
      t.setAttribute("aria-hidden", "true"),
      t.setAttribute("inert", "true"),
      (t.style.display = "none"),
      (t.style.visibility = "hidden"),
      (t.style.position = "absolute"),
      (t.style.left = "-9999px")),
      a &&
        (a.setAttribute("data-bitwarden-watching", "false"),
        a.setAttribute("data-lpignore", "true"),
        a.setAttribute("data-form-type", "other"),
        a.setAttribute("aria-hidden", "true"),
        a.setAttribute("inert", "true"),
        (a.style.display = "none"),
        (a.style.visibility = "hidden"),
        (a.style.position = "absolute"),
        (a.style.left = "-9999px")),
      s &&
        (s.removeAttribute("autocomplete"),
        s.setAttribute("data-form-type", "other"),
        s.setAttribute("data-lpignore", "true"),
        s.setAttribute("tabindex", "-1"),
        (s.disabled = !0),
        (s.readOnly = !0),
        (s.style.display = "none")),
      n &&
        (n.removeAttribute("autocomplete"),
        n.setAttribute("data-form-type", "other"),
        n.setAttribute("data-lpignore", "true"),
        n.setAttribute("tabindex", "-1"),
        (n.disabled = !0),
        (n.readOnly = !0),
        (n.style.display = "none"),
        (n.type = "text")),
      i &&
        (i.removeAttribute("autocomplete"),
        i.setAttribute("data-form-type", "other"),
        i.setAttribute("data-lpignore", "true"),
        i.setAttribute("tabindex", "-1"),
        (i.disabled = !0),
        (i.readOnly = !0),
        (i.style.display = "none")),
      o &&
        (o.removeAttribute("autocomplete"),
        o.setAttribute("data-form-type", "other"),
        o.setAttribute("data-lpignore", "true"),
        o.setAttribute("tabindex", "-1"),
        (o.disabled = !0),
        (o.readOnly = !0),
        (o.style.display = "none"),
        (o.type = "text")));
  }
  r && r.classList.remove("hidden");
}
async function _(e, r) {
  try {
    const t = await y("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: e, password: r }),
    });
    return (
      p(t.csrfToken),
      A(t.user),
      w(!0),
      k(),
      f("Welcome back!", "success"),
      !0
    );
  } catch (t) {
    h.error("Login failed", t);
    const a = v(t, !0);
    return (f(a, "error"), !1);
  }
}
async function B(e, r) {
  try {
    const t = await y("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: e, password: r }),
    });
    return (
      p(t.csrfToken),
      A(t.user),
      w(!0),
      k(),
      f("Account created successfully!", "success"),
      !0
    );
  } catch (t) {
    h.error("Register failed", t);
    const a = v(t, !0);
    return (f(a, "error"), !1);
  }
}
function O() {
  y("/auth/logout", { method: "POST" })
    .catch((e) => {
      h.error("Logout failed", e);
    })
    .finally(() => {
      (p(null), A(null), w(!1), S());
    });
}
async function L() {
  try {
    const e = await y("/auth/me");
    return (A(e.user), p(e.csrfToken), w(!0), T(), !0);
  } catch (e) {
    return (
      h.error("Auth check failed", e),
      p(null),
      A(null),
      w(!1),
      S(),
      v(e, !0),
      !1
    );
  }
}
function P() {
  if (c) {
    const e = document.querySelectorAll(".header-user-name"),
      r = document.querySelectorAll(".header-user-avatar"),
      t = document.querySelectorAll(".header-user-avatar-large"),
      a = document.getElementById("api-key-value"),
      s = (c.email || "U").charAt(0).toUpperCase();
    (e.forEach((n) => (n.textContent = c.email)),
      r.forEach((n) => (n.textContent = s)),
      t.forEach((n) => (n.textContent = s)),
      a && (a.textContent = c.api_key || ""));
  }
}
async function M() {
  if (confirm("Regenerate API key? Old keys will stop working."))
    try {
      const e = await y("/auth/regenerate-key", { method: "POST" });
      c && (c.api_key = e.api_key);
      const r = document.getElementById("api-key-value");
      (r && (r.textContent = e.api_key), f("API key regenerated!", "success"));
    } catch (e) {
      h.error("Regenerate API key failed", e);
      const r = v(e, !1);
      f(r, "error");
    }
}
function R() {
  c?.api_key &&
    (navigator.clipboard.writeText(c.api_key), f("API key copied!", "success"));
}
async function $(e) {
  try {
    const r = await y("/auth/profile", {
      method: "PUT",
      body: JSON.stringify({ email: e }),
    });
    return (
      c && (c.email = r.email),
      P(),
      f("Profile updated!", "success"),
      !0
    );
  } catch (r) {
    h.error("Update profile failed", r);
    const t = v(r, !1);
    return (f(t, "error"), !1);
  }
}
async function D(e, r) {
  try {
    return (
      await y("/auth/password", {
        method: "PUT",
        body: JSON.stringify({ currentPassword: e, newPassword: r }),
      }),
      f("Password updated successfully!", "success"),
      !0
    );
  } catch (t) {
    h.error("Update password failed", t);
    const a = v(t, !1);
    return (f(a, "error"), !1);
  }
}
const De = {
    showAuthScreen: S,
    showMainApp: k,
    login: _,
    register: B,
    logout: O,
    checkAuth: L,
    updateUserInfo: P,
    regenerateApiKey: M,
    copyApiKey: R,
    updateProfile: $,
    updatePassword: D,
  },
  ze = Object.freeze(
    Object.defineProperty(
      {
        __proto__: null,
        checkAuth: L,
        copyApiKey: R,
        default: De,
        login: _,
        logout: O,
        regenerateApiKey: M,
        register: B,
        showAuthScreen: S,
        showMainApp: k,
        updatePassword: D,
        updateProfile: $,
        updateUserInfo: P,
      },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  );
export {
  xe as $,
  ce as A,
  pe as B,
  gt as C,
  V as D,
  _e as E,
  ne as F,
  Et as G,
  Je as H,
  he as I,
  Bt as J,
  Be as K,
  Ot as L,
  Fe as M,
  pt as N,
  qe as O,
  ve as P,
  ke as Q,
  Pt as R,
  Ct as S,
  _t as T,
  Y as U,
  Ee as V,
  Se as W,
  Ie as X,
  Pe as Y,
  Ce as Z,
  W as _,
  J as a,
  Te as a0,
  It as a1,
  kt as a2,
  xt as a3,
  Tt as a4,
  dt as a5,
  lt as a6,
  se as a7,
  ee as a8,
  le as a9,
  nt as aA,
  ot as aB,
  it as aC,
  oe as aD,
  Lt as aE,
  ze as aF,
  ct as aa,
  ut as ab,
  ie as ac,
  ye as ad,
  me as ae,
  bt as af,
  ht as ag,
  yt as ah,
  j as ai,
  te as aj,
  rt as ak,
  We as al,
  be as am,
  At as an,
  ue as ao,
  ge as ap,
  q as aq,
  Q as ar,
  He as as,
  Ye as at,
  Qe as au,
  Ze as av,
  at as aw,
  et as ax,
  tt as ay,
  st as az,
  H as b,
  x as c,
  K as d,
  Ae as e,
  de as f,
  ae as g,
  y as h,
  Z as i,
  je as j,
  Xe as k,
  h as l,
  wt as m,
  we as n,
  Ve as o,
  ft as p,
  Ge as q,
  re as r,
  St as s,
  Ne as t,
  mt as u,
  X as v,
  G as w,
  Ke as x,
  fe as y,
  vt as z,
};
//# sourceMappingURL=auth-CtF7wfY5.js.map

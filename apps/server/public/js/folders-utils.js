"use strict";
(() => {
  var d = Object.defineProperty;
  var h = Object.getOwnPropertyDescriptor;
  var w = Object.getOwnPropertyNames;
  var b = Object.prototype.hasOwnProperty;
  var v = (r, e, t, o) => {
    if ((e && typeof e == "object") || typeof e == "function")
      for (let n of w(e))
        !b.call(r, n) &&
          n !== t &&
          d(r, n, {
            get: () => e[n],
            enumerable: !(o = h(e, n)) || o.enumerable,
          });
    return r;
  };
  var L = (r) => v(d({}, "__esModule", { value: !0 }), r);
  var x = {};
  var f = {},
    u = class {
      isDevelopment() {
        return (
          f.env.DEV ||
          f.env.MODE === "development" ||
          g.getItem("anchormarks_debug") === "true"
        );
      }
      shouldLog(e) {
        return this.isDevelopment() ? !0 : e === "warn" || e === "error";
      }
      formatMessage(e, t) {
        return t ? `[${t}] ${e}` : e;
      }
      debug(e, ...t) {
        this.shouldLog("debug") && console.debug(this.formatMessage(e), ...t);
      }
      info(e, ...t) {
        this.shouldLog("info") && console.info(this.formatMessage(e), ...t);
      }
      warn(e, ...t) {
        this.shouldLog("warn") && console.warn(this.formatMessage(e), ...t);
      }
      error(e, t, ...o) {
        if (this.shouldLog("error")) {
          let n = this.formatMessage(e);
          t instanceof Error
            ? console.error(n, t, ...o)
            : t
              ? console.error(n, t, ...o)
              : console.error(n, ...o);
        }
      }
      log(e, ...t) {
        this.info(e, ...t);
      }
    },
    a = new u();
  function c(r) {
    let e = document.createElement("div");
    return ((e.textContent = r), e.innerHTML);
  }
  var g = {
    getItem(r) {
      try {
        return localStorage.getItem(r);
      } catch (e) {
        return (a.warn(`localStorage.getItem failed for key "${r}"`, e), null);
      }
    },
    setItem(r, e) {
      try {
        return (localStorage.setItem(r, e), !0);
      } catch (t) {
        return (a.warn(`localStorage.setItem failed for key "${r}"`, t), !1);
      }
    },
    removeItem(r) {
      try {
        return (localStorage.removeItem(r), !0);
      } catch (e) {
        return (a.warn(`localStorage.removeItem failed for key "${r}"`, e), !1);
      }
    },
  };
  function m(r, e = "None") {
    let t = (l, s) => l.name.localeCompare(s.name),
      o = `<option value="">${c(e)}</option>`;
    function n(l = null, s = 0) {
      r.filter((i) => (i.parent_id || null) === l)
        .sort(t)
        .forEach((i) => {
          let p = "&nbsp;&nbsp;&nbsp;".repeat(s);
          ((o += `<option value="${i.id}">${p}${c(i.name)}</option>`),
            n(i.id, s + 1));
        });
    }
    return (n(null, 0), o);
  }
  window.anchormarks = window.anchormarks || {};
  window.anchormarks.buildFolderOptionsHTML = m;
  return L(x);
})();

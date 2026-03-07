import { describe, expect, it, vi, afterEach } from "vitest";

import {
  sanitizeHtml,
  safeRender,
  safeLocalStorage,
  debounce,
  asyncHandler,
} from "../index.ts";
import { logger } from "../logger.ts";

describe("utils index", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("sanitizes HTML by stripping disallowed tags and attributes", () => {
    const dirty =
      '<script>alert(1)</script><a href="javascript:evil()" onclick="x">ok</a><b>bold</b>';
    const result = sanitizeHtml(dirty, {
      allowedTags: ["a", "b"],
      allowedAttributes: ["href", "target", "rel"],
    });
    expect(result).toContain("<a");
    expect(result).not.toContain("script");
    expect(result).toContain("<b>bold</b>");
    expect(result).not.toContain("javascript:evil");
  });

  it("safeRender warns and avoids writing when container is missing", () => {
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});
    safeRender(null as any, "content");
    expect(warnSpy).toHaveBeenCalledWith(
      "safeRender called with null/undefined container",
    );
  });

  it("safeRender escapes text unless allowHtml is true", () => {
    const container = document.createElement("div");
    safeRender(container, "<strong>bold</strong>");
    expect(container.textContent).toBe("<strong>bold</strong>");

    safeRender(container, "<strong>bold</strong>", { allowHtml: true });
    expect(container.innerHTML).toBe("<strong>bold</strong>");
  });

  it("safeLocalStorage handles quota errors gracefully", () => {
    const error = new Error("Quota");
    const setSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw error;
      });
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});

    const result = safeLocalStorage.setItem("key", "value");
    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      'localStorage.setItem failed for key "key"',
      error,
    );

    setSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("debounce delays executions and coalesces calls", async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    await Promise.resolve();
    expect(fn).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("asyncHandler catches errors and shows toast if available", async () => {
    const handler = vi.fn().mockRejectedValue(new Error("boom"));
    const showToast = vi.fn();
    (window as any).showToast = showToast;
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});
    const wrapped = asyncHandler(handler, "Oops");
    wrapped(new Event("click"));
    await Promise.resolve();
    expect(handler).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("Oops", "error");
  });
});

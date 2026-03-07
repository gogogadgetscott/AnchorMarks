import { beforeEach, describe, expect, it, vi } from "vitest";

const loggerSpies = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

vi.mock("@utils/logger.ts", () => ({
  logger: loggerSpies,
}));

let eventCleanup: typeof import("../event-cleanup.ts");

beforeEach(async () => {
  vi.resetModules();
  Object.values(loggerSpies).forEach((mock) => mock.mockReset());
  eventCleanup = await import("../event-cleanup.ts");
});

describe("event cleanup helpers", () => {
  it("registers view cleanup controllers and aborts previous ones", () => {
    const firstController = eventCleanup.registerViewCleanup("dashboard");
    const abortSpy = vi.spyOn(firstController, "abort");

    const secondController = eventCleanup.registerViewCleanup("dashboard");

    expect(abortSpy).toHaveBeenCalledTimes(1);
    expect(secondController).not.toBe(firstController);
    expect(eventCleanup.getViewSignal("dashboard")).toBe(
      secondController.signal,
    );
  });

  it("cleans up specific views and removes them from the registry", () => {
    const controller = eventCleanup.registerViewCleanup("tags");
    const abortSpy = vi.spyOn(controller, "abort");

    eventCleanup.cleanupView("tags");

    expect(abortSpy).toHaveBeenCalledTimes(1);
    expect(eventCleanup.hasViewCleanup("tags")).toBe(false);
  });

  it("cleans all registered views at once", () => {
    const dashboards = eventCleanup.registerViewCleanup("dashboard");
    const tags = eventCleanup.registerViewCleanup("tags");
    const dashAbort = vi.spyOn(dashboards, "abort");
    const tagsAbort = vi.spyOn(tags, "abort");

    eventCleanup.cleanupAllViews();

    expect(dashAbort).toHaveBeenCalledTimes(1);
    expect(tagsAbort).toHaveBeenCalledTimes(1);
    expect(eventCleanup.hasViewCleanup("dashboard")).toBe(false);
    expect(eventCleanup.hasViewCleanup("tags")).toBe(false);
  });

  it("manages global cleanup controller lifecycle", () => {
    const firstGlobal = eventCleanup.registerGlobalCleanup();
    const abortSpy = vi.spyOn(firstGlobal, "abort");

    const secondGlobal = eventCleanup.registerGlobalCleanup();

    expect(abortSpy).toHaveBeenCalledTimes(1);
    expect(eventCleanup.getGlobalSignal()).toBe(secondGlobal.signal);

    eventCleanup.cleanupGlobal();
    expect(eventCleanup.getGlobalSignal()).toBeNull();
  });

  it("attaches managed listeners and removes them when aborted", () => {
    const controller = new AbortController();
    const button = document.createElement("button");
    document.body.appendChild(button);
    const handler = vi.fn();

    eventCleanup.addManagedListener(
      button,
      "click",
      handler,
      controller.signal,
    );

    button.click();
    expect(handler).toHaveBeenCalledTimes(1);

    controller.abort();
    button.click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("warns when attempting to add a listener to a null element", () => {
    const controller = new AbortController();
    const handler = () => {};

    eventCleanup.addManagedListener(null, "click", handler, controller.signal);

    expect(loggerSpies.warn).toHaveBeenCalledWith(
      "[EventCleanup] Attempted to add listener to null element",
    );
  });

  it("reports cleanup stats for debugging", () => {
    eventCleanup.registerViewCleanup("dashboard");
    eventCleanup.registerViewCleanup("bookmarks");
    eventCleanup.registerGlobalCleanup();

    const stats = eventCleanup.getCleanupStats();
    expect(stats.viewCount).toBe(2);
    expect(stats.hasGlobal).toBe(true);
    expect(stats.registeredViews).toEqual(
      expect.arrayContaining(["dashboard", "bookmarks"]),
    );
  });
});

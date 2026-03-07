import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loggerSpies = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

vi.mock("@utils/logger.ts", () => ({
  logger: loggerSpies,
}));

let focusTrapModule: typeof import("../focus-trap.ts");

beforeEach(async () => {
  vi.resetModules();
  document.body.innerHTML = "";
  Object.values(loggerSpies).forEach((mock) => mock.mockReset());
  focusTrapModule = await import("../focus-trap.ts");
});

afterEach(() => {
  focusTrapModule.removeAllFocusTraps();
  document.body.innerHTML = "";
  vi.useRealTimers();
});

function buildModal(id = "modal") {
  const container = document.createElement("div");
  container.id = id;
  container.innerHTML = `
    <button id="${id}-first">First</button>
    <button id="${id}-second">Second</button>
  `;
  document.body.appendChild(container);

  const first = container.querySelector(`#${id}-first`) as HTMLElement;
  const second = container.querySelector(`#${id}-second`) as HTMLElement;
  [first, second].forEach((el) => {
    Object.defineProperty(el, "offsetParent", {
      configurable: true,
      get: () => container,
    });
  });

  return container;
}

describe("focus trap utilities", () => {
  it("throws when container is not found", () => {
    expect(() => focusTrapModule.createFocusTrap("missing")).toThrow(
      "[FocusTrap] Container not found: missing",
    );
  });

  it("focuses first element and registers trap", () => {
    buildModal();
    const trap = focusTrapModule.createFocusTrap("modal");
    expect(trap).toBeDefined();
    expect(focusTrapModule.hasFocusTrap("modal")).toBe(true);
    expect(document.activeElement?.id).toBe("modal-first");
  });

  it("loops tab navigation within the container", () => {
    const container = buildModal();
    focusTrapModule.createFocusTrap(container);
    const first = document.getElementById("modal-first") as HTMLElement;
    const second = document.getElementById("modal-second") as HTMLElement;

    second.focus();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
    expect(document.activeElement).toBe(first);

    first.focus();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", shiftKey: true }),
    );
    expect(document.activeElement).toBe(second);
  });

  it("invokes onEscape callback when Escape is pressed", () => {
    const container = buildModal();
    const onEscape = vi.fn();
    focusTrapModule.createFocusTrap(container, { onEscape });

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("restores focus to previous target on deactivate", () => {
    const outsideButton = document.createElement("button");
    outsideButton.id = "outside";
    document.body.appendChild(outsideButton);
    outsideButton.focus();

    const container = buildModal();
    const trap = focusTrapModule.createFocusTrap(container);

    vi.useFakeTimers();
    trap.deactivate();
    vi.runAllTimers();
    expect(document.activeElement).toBe(outsideButton);
  });

  it("respects explicit returnFocusElement option", () => {
    const fallback = document.createElement("button");
    fallback.id = "fallback";
    document.body.appendChild(fallback);

    const container = buildModal();
    const trap = focusTrapModule.createFocusTrap(container, {
      returnFocusElement: fallback,
    });

    vi.useFakeTimers();
    trap.deactivate();
    vi.runAllTimers();
    expect(document.activeElement).toBe(fallback);
  });

  it("removes individual traps and clears registry", () => {
    const container = buildModal();
    focusTrapModule.createFocusTrap(container);

    focusTrapModule.removeFocusTrap("modal");

    expect(focusTrapModule.hasFocusTrap("modal")).toBe(false);
  });

  it("clears all traps and logs the cleanup", () => {
    buildModal("modal-a");
    buildModal("modal-b");
    focusTrapModule.createFocusTrap("modal-a");
    focusTrapModule.createFocusTrap("modal-b");

    focusTrapModule.removeAllFocusTraps();

    expect(focusTrapModule.hasFocusTrap("modal-a")).toBe(false);
    expect(focusTrapModule.hasFocusTrap("modal-b")).toBe(false);
    expect(loggerSpies.debug).toHaveBeenCalledWith(
      "[FocusTrap] Removed all traps",
    );
  });
});

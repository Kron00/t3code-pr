// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { ComposerHandleContext } from "~/composerHandleContext";
import type { ChatComposerHandle } from "./ChatComposer";
import { SendLaterControl } from "./SendLaterControl";

let root: Root;
let container: HTMLDivElement;
const onSendLater = vi.fn();
const onComposerSubmit = vi.fn();
const focusAtEnd = vi.fn();

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
  Object.defineProperty(Element.prototype, "getAnimations", {
    configurable: true,
    value: () => [],
  });
  onSendLater.mockClear();
  onComposerSubmit.mockClear();
  focusAtEnd.mockClear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function render(canSend = true) {
  const composerRef = { current: { focusAtEnd } as unknown as ChatComposerHandle };
  await act(() =>
    root.render(
      <ComposerHandleContext value={composerRef}>
        {/* The composer form: the popover's form must never submit it. */}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onComposerSubmit();
          }}
        >
          <SendLaterControl canSend={canSend} onSendLater={onSendLater} />
        </form>
      </ComposerHandleContext>,
    ),
  );
}

function trigger() {
  return document.querySelector<HTMLButtonElement>('[aria-label="Send later"]')!;
}

function isOpen() {
  return trigger().getAttribute("aria-expanded") === "true";
}

async function openPopover() {
  await act(async () => {
    trigger().click();
  });
}

function popover() {
  return document.querySelector<HTMLElement>('[role="dialog"]');
}

function button(name: string) {
  return [...(popover()?.querySelectorAll("button") ?? [])].find(
    (element) => element.textContent?.trim() === name,
  )!;
}

function minutesInput() {
  return popover()!.querySelector<HTMLInputElement>("input")!;
}

async function typeMinutes(value: string) {
  const input = minutesInput();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function click(element: HTMLElement) {
  await act(async () => element.click());
}

describe("SendLaterControl", () => {
  it("schedules a preset immediately and returns focus to the composer", async () => {
    await render();
    await openPopover();

    await click(button("In 2 minutes"));

    expect(onSendLater).toHaveBeenCalledExactlyOnceWith(2 * 60_000);
    expect(onComposerSubmit).not.toHaveBeenCalled();
    expect(isOpen()).toBe(false);
    await act(() => vi.waitFor(() => expect(popover()).toBeNull()));
    expect(focusAtEnd).toHaveBeenCalled();
  });

  it("opens Custom inline at 10 minutes without scheduling", async () => {
    await render();
    await openPopover();
    expect(popover()!.querySelector("input")).toBeNull();

    await click(button("Custom…"));

    expect(onSendLater).not.toHaveBeenCalled();
    expect(minutesInput().value).toBe("10");
    expect(document.activeElement).toBe(minutesInput());
  });

  it("schedules only a valid custom delay and never submits the composer", async () => {
    await render();
    await openPopover();
    await click(button("Custom…"));

    await typeMinutes("0");
    await click(button("Schedule"));
    expect(onSendLater).not.toHaveBeenCalled();
    expect(popover()?.textContent).toContain("Enter a whole number from 1–60.");

    await typeMinutes("7");
    await click(button("Schedule"));
    expect(onSendLater).toHaveBeenCalledExactlyOnceWith(7 * 60_000);
    expect(onComposerSubmit).not.toHaveBeenCalled();
    expect(isOpen()).toBe(false);
  });

  it("closes on Escape without sending", async () => {
    await render();
    await openPopover();
    await click(button("Custom…"));

    await act(async () => {
      minutesInput().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(isOpen()).toBe(false);
    expect(onSendLater).not.toHaveBeenCalled();
    expect(onComposerSubmit).not.toHaveBeenCalled();
  });

  it("disables scheduling while open once sending becomes unavailable", async () => {
    await render();
    await openPopover();
    await click(button("Custom…"));

    await render(false);

    expect(button("In 1 minute").disabled).toBe(true);
    expect(button("Schedule").disabled).toBe(true);
    expect(popover()?.querySelector('[role="status"]')?.textContent).toContain(
      "Your message stays in the composer.",
    );
  });
});

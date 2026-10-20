import { describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { ComposerHandleContext } from "~/composerHandleContext";
import { render, type Screen } from "../../../test/render";
import type { ChatComposerHandle } from "./ChatComposer";
import { SendLaterControl } from "./SendLaterControl";

async function renderControl() {
  const onSendLater = vi.fn();
  const onComposerSubmit = vi.fn();
  const focusAtEnd = vi.fn();
  const composerRef = { current: { focusAtEnd } as unknown as ChatComposerHandle };
  const ui = (canSend: boolean) => (
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
    </ComposerHandleContext>
  );
  const screen = await render(ui(true));
  return Object.assign(screen, {
    onSendLater,
    onComposerSubmit,
    focusAtEnd,
    setCanSend: (canSend: boolean) => screen.rerender(ui(canSend)),
  });
}

const trigger = (view: Screen) =>
  view.getByRole("button", { name: "Send later", exact: true }).element() as HTMLButtonElement;
const popover = () => page.getByRole("dialog", { name: "Send later", exact: true });
const button = (name: string) =>
  popover().getByRole("button", { name, exact: true }).element() as HTMLButtonElement;
const minutesInput = () =>
  popover().getByRole("textbox", { name: "minutes", exact: true }).element() as HTMLInputElement;

async function openCustom(view: Screen) {
  await userEvent.click(trigger(view));
  await userEvent.click(button("Custom…"));
}

async function expectClosed(view: Screen) {
  expect(trigger(view).getAttribute("aria-expanded")).toBe("false");
  await vi.waitFor(() => expect(popover().query()).toBeNull());
}

describe("SendLaterControl", () => {
  it("schedules a preset immediately and returns focus to the composer", async () => {
    await using view = await renderControl();
    await userEvent.click(trigger(view));

    await userEvent.click(button("In 2 minutes"));

    expect(view.onSendLater).toHaveBeenCalledExactlyOnceWith(2 * 60_000);
    expect(view.onComposerSubmit).not.toHaveBeenCalled();
    await expectClosed(view);
    expect(view.focusAtEnd).toHaveBeenCalled();
  });

  it("opens Custom inline at 10 minutes, focused, without scheduling", async () => {
    await using view = await renderControl();
    await userEvent.click(trigger(view));
    expect(popover().getByRole("textbox").query()).toBeNull();

    await userEvent.click(button("Custom…"));

    expect(view.onSendLater).not.toHaveBeenCalled();
    expect(minutesInput().value).toBe("10");
    expect(document.activeElement).toBe(minutesInput());
  });

  it("schedules only a whole-minute delay in range and never submits the composer", async () => {
    await using view = await renderControl();
    await openCustom(view);

    for (const invalid of ["0", "61", "1.5"]) {
      await userEvent.fill(minutesInput(), invalid);
      await userEvent.keyboard("{Enter}");
      expect(minutesInput().getAttribute("aria-invalid")).toBe("true");
    }
    expect(popover().element().textContent).toContain("Enter a whole number from 1–60.");
    expect(view.onSendLater).not.toHaveBeenCalled();

    await userEvent.fill(minutesInput(), "60");
    await userEvent.keyboard("{Enter}");

    expect(view.onSendLater).toHaveBeenCalledExactlyOnceWith(60 * 60_000);
    expect(view.onComposerSubmit).not.toHaveBeenCalled();
    await expectClosed(view);
  });

  it("schedules a custom delay from the Schedule button", async () => {
    await using view = await renderControl();
    await openCustom(view);

    await userEvent.fill(minutesInput(), "7");
    await userEvent.click(button("Schedule"));

    expect(view.onSendLater).toHaveBeenCalledExactlyOnceWith(7 * 60_000);
    expect(view.onComposerSubmit).not.toHaveBeenCalled();
    await expectClosed(view);
  });

  it("closes on Escape without sending", async () => {
    await using view = await renderControl();
    await openCustom(view);

    await userEvent.keyboard("{Escape}");

    await expectClosed(view);
    expect(view.onSendLater).not.toHaveBeenCalled();
    expect(view.onComposerSubmit).not.toHaveBeenCalled();
  });

  it("stops scheduling while open once sending becomes unavailable", async () => {
    await using view = await renderControl();
    await openCustom(view);

    await view.setCanSend(false);

    expect(button("In 1 minute").disabled).toBe(true);
    expect(button("Schedule").disabled).toBe(true);
    expect(popover().getByRole("status").element().textContent).toContain(
      "Your message stays in the composer.",
    );
    // The field keeps Enter, but the held send must not go out.
    await userEvent.click(minutesInput());
    await userEvent.keyboard("{Enter}");
    expect(view.onSendLater).not.toHaveBeenCalled();
    expect(view.onComposerSubmit).not.toHaveBeenCalled();
  });
});

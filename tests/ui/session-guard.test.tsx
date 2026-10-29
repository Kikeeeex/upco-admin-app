// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionGuard } from "../../src/components/session-guard";

const signedInAt = "2026-10-29T12:00:00.000Z";
const start = Date.parse(signedInAt);

describe("SessionGuard", () => {
  const submit = vi.spyOn(HTMLFormElement.prototype, "requestSubmit").mockImplementation(() => {});

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(start);
    window.localStorage.clear();
    submit.mockClear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, redirected: false }));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("submits local signout after 30 minutes without interaction", () => {
    render(<SessionGuard signedInAt={signedInAt} />);
    act(() => vi.advanceTimersByTime(30 * 60_000));
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("keeps the session active after interaction and sends an activity heartbeat", async () => {
    render(<SessionGuard signedInAt={signedInAt} />);
    act(() => vi.advanceTimersByTime(20 * 60_000));
    fireEvent.keyDown(window);
    await act(async () => vi.advanceTimersByTime(60_000));
    expect(fetch).toHaveBeenCalledWith("/auth/activity", expect.objectContaining({ method: "POST" }));
    act(() => vi.advanceTimersByTime(9 * 60_000));
    expect(submit).not.toHaveBeenCalled();
  });

  it("submits signout at the eight-hour maximum", () => {
    vi.setSystemTime(start + 8 * 60 * 60_000 - 30_000);
    render(<SessionGuard signedInAt={signedInAt} />);
    act(() => vi.advanceTimersByTime(30_000));
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("shares activity between tabs before closing an idle tab", () => {
    render(<SessionGuard signedInAt={signedInAt} />);
    act(() => vi.advanceTimersByTime(20 * 60_000));
    window.localStorage.setItem("upco-admin-last-interaction", String(Date.now()));
    act(() => vi.advanceTimersByTime(20 * 60_000));
    expect(submit).not.toHaveBeenCalled();
  });

  it("treats mouse movement as activity", () => {
    render(<SessionGuard signedInAt={signedInAt} />);
    act(() => vi.advanceTimersByTime(20 * 60_000));
    fireEvent.pointerMove(window);
    act(() => vi.advanceTimersByTime(20 * 60_000));
    expect(submit).not.toHaveBeenCalled();
  });

  it("closes the view when the server rejects the activity heartbeat", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, redirected: true }));
    render(<SessionGuard signedInAt={signedInAt} />);
    act(() => vi.advanceTimersByTime(60_000));
    fireEvent.keyDown(window);
    await act(async () => vi.advanceTimersByTime(30_000));
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("renews the server marker immediately when activity resumes near the idle deadline", async () => {
    render(<SessionGuard signedInAt={signedInAt} />);
    act(() => vi.advanceTimersByTime(29 * 60_000));
    await act(async () => fireEvent.pointerDown(window));
    expect(fetch).toHaveBeenCalledWith("/auth/activity", expect.objectContaining({ method: "POST" }));
  });

  it("renews a valid session when the protected layout mounts after navigation", async () => {
    render(<SessionGuard signedInAt={signedInAt} />);
    await act(async () => Promise.resolve());
    expect(fetch).toHaveBeenCalledWith("/auth/activity", expect.objectContaining({ method: "POST" }));
  });

  it("does not close a newer login opened in another tab", () => {
    vi.setSystemTime(start + 8 * 60 * 60_000 - 30_000);
    render(<SessionGuard signedInAt={signedInAt} />);
    window.localStorage.setItem("upco-admin-session-started", new Date(Date.now()).toISOString());
    window.localStorage.setItem("upco-admin-last-interaction", String(Date.now()));
    act(() => vi.advanceTimersByTime(30_000));
    expect(submit).not.toHaveBeenCalled();
  });
});

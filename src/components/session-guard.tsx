"use client";

import { useEffect, useRef } from "react";
import { SESSION_IDLE_MS, SESSION_MAX_MS, sessionExpiryReason } from "../features/auth/session-policy";

const ACTIVITY_STORAGE_KEY = "upco-admin-last-interaction";
const SESSION_STORAGE_KEY = "upco-admin-session-started";

export function SessionGuard({ signedInAt }: { signedInAt: string }) {
  const signoutForm = useRef<HTMLFormElement>(null);

  useEffect(() => {
    let currentSessionStartedAt = signedInAt;
    let lastActivity = Date.now();
    let lastHeartbeatActivity = 0;
    let lastHeartbeatAt = 0;
    let lastStoredAt = 0;
    let lastExpiryScheduledAt = 0;
    let expiryTimer: number | undefined;
    let checking = false;
    let closing = false;

    function latestSessionStartedAt() {
      try {
        const shared = window.localStorage.getItem(SESSION_STORAGE_KEY);
        if (shared && Date.parse(shared) > Date.parse(currentSessionStartedAt)) currentSessionStartedAt = shared;
      } catch { /* Use this tab's session start. */ }
      return currentSessionStartedAt;
    }

    try {
      const shared = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (!shared || Date.parse(signedInAt) > Date.parse(shared)) window.localStorage.setItem(SESSION_STORAGE_KEY, signedInAt);
    } catch { /* Session deadlines still work in this tab. */ }

    function rememberActivity() {
      lastActivity = Date.now();
      if (lastActivity - lastStoredAt >= 5000) {
        lastStoredAt = lastActivity;
        try { window.localStorage.setItem(ACTIVITY_STORAGE_KEY, String(lastActivity)); }
        catch { /* Browser storage can be disabled; this tab still has its own timer. */ }
      }
      scheduleExpiryCheck();
      if (lastActivity - lastHeartbeatAt >= 60_000) void checkSession();
    }

    function latestActivity(now: number) {
      try {
        const shared = Number(window.localStorage.getItem(ACTIVITY_STORAGE_KEY));
        if (Number.isSafeInteger(shared) && shared > 0 && shared <= now + 60_000) return Math.max(lastActivity, shared);
      } catch { /* Use the activity recorded in this tab. */ }
      return lastActivity;
    }

    function scheduleExpiryCheck() {
      const now = Date.now();
      // Pointer movement can fire many times per second. Rearm at most every
      // five seconds; an older timer will recheck and reschedule if needed.
      if (expiryTimer !== undefined && now - lastExpiryScheduledAt < 5000) return;

      const startedAt = Date.parse(latestSessionStartedAt());
      const activityAt = latestActivity(now);
      const maxExpiry = Number.isFinite(startedAt) && startedAt <= now + 60_000
        ? startedAt + SESSION_MAX_MS : now;
      const idleExpiry = Number.isSafeInteger(activityAt) && activityAt > 0 && activityAt <= now + 60_000
        ? activityAt + SESSION_IDLE_MS : now;

      window.clearTimeout(expiryTimer);
      lastExpiryScheduledAt = now;
      expiryTimer = window.setTimeout(() => {
        expiryTimer = undefined;
        void checkSession();
      }, Math.max(0, Math.min(maxExpiry, idleExpiry) - now));
    }

    function closeSession() {
      if (closing) return;
      closing = true;
      signoutForm.current?.requestSubmit();
    }

    async function checkSession() {
      if (closing) return;
      scheduleExpiryCheck();
      const now = Date.now();
      const activity = latestActivity(now);
      if (sessionExpiryReason(latestSessionStartedAt(), String(activity), now)) {
        closeSession();
        return;
      }
      if (checking || activity <= lastHeartbeatActivity || now - lastHeartbeatAt < 60_000) return;
      checking = true;
      lastHeartbeatAt = now;
      lastHeartbeatActivity = activity;
      try {
        const response = await fetch("/auth/activity", { method: "POST", credentials: "same-origin", cache: "no-store" });
        if (!response.ok || response.redirected) closeSession();
      } catch {
        lastHeartbeatActivity = 0;
      } finally {
        checking = false;
      }
    }

    function onStorage(event: StorageEvent) {
      if (event.key === ACTIVITY_STORAGE_KEY || event.key === null) void checkSession();
      else if (event.key === SESSION_STORAGE_KEY) scheduleExpiryCheck();
    }

    rememberActivity();
    window.addEventListener("pointerdown", rememberActivity);
    window.addEventListener("pointermove", rememberActivity);
    window.addEventListener("keydown", rememberActivity);
    window.addEventListener("wheel", rememberActivity, { passive: true });
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", checkSession);
    return () => {
      window.clearTimeout(expiryTimer);
      window.removeEventListener("pointerdown", rememberActivity);
      window.removeEventListener("pointermove", rememberActivity);
      window.removeEventListener("keydown", rememberActivity);
      window.removeEventListener("wheel", rememberActivity);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", checkSession);
    };
  }, [signedInAt]);

  return <form ref={signoutForm} action="/auth/signout?expired=1" method="post" hidden />;
}

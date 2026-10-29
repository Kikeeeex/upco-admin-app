"use client";

import { useEffect, useRef } from "react";
import { sessionExpiryReason } from "../features/auth/session-policy";

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
      if (lastActivity - lastHeartbeatAt >= 60_000) void checkSession();
    }

    function latestActivity(now: number) {
      try {
        const shared = Number(window.localStorage.getItem(ACTIVITY_STORAGE_KEY));
        if (Number.isSafeInteger(shared) && shared > 0 && shared <= now + 60_000) return Math.max(lastActivity, shared);
      } catch { /* Use the activity recorded in this tab. */ }
      return lastActivity;
    }

    function closeSession() {
      if (closing) return;
      closing = true;
      signoutForm.current?.requestSubmit();
    }

    async function checkSession() {
      if (closing) return;
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

    rememberActivity();
    const timer = window.setInterval(checkSession, 30_000);
    window.addEventListener("pointerdown", rememberActivity);
    window.addEventListener("pointermove", rememberActivity);
    window.addEventListener("keydown", rememberActivity);
    window.addEventListener("wheel", rememberActivity, { passive: true });
    document.addEventListener("visibilitychange", checkSession);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pointerdown", rememberActivity);
      window.removeEventListener("pointermove", rememberActivity);
      window.removeEventListener("keydown", rememberActivity);
      window.removeEventListener("wheel", rememberActivity);
      document.removeEventListener("visibilitychange", checkSession);
    };
  }, [signedInAt]);

  return <form ref={signoutForm} action="/auth/signout?expired=1" method="post" hidden />;
}

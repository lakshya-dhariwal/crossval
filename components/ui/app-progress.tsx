"use client";

import { useEffect, useState } from "react";
import {
  AppProgressBar,
  startProgress,
  stopProgress,
} from "next-nprogress-bar";

export function AppProgress() {
  const [apiPending, setApiPending] = useState(false);

  useEffect(() => {
    const originalFetch = window.fetch;
    let pendingRequests = 0;
    let startedAt = 0;
    let stopTimer: number | undefined;

    const scheduleStop = () => {
      if (stopTimer !== undefined) window.clearTimeout(stopTimer);
      const remaining = Math.max(0, 350 - (Date.now() - startedAt));
      stopTimer = window.setTimeout(() => {
        stopTimer = undefined;
        if (pendingRequests === 0) {
          stopProgress();
          setApiPending(false);
        }
      }, remaining);
    };

    window.fetch = async (...args) => {
      const input = args[0];
      const url = new URL(
        input instanceof Request ? input.url : String(input),
        window.location.href,
      );
      const tracksRequest =
        url.origin === window.location.origin &&
        url.pathname.startsWith("/api/");

      if (tracksRequest && pendingRequests++ === 0) {
        if (stopTimer !== undefined) window.clearTimeout(stopTimer);
        startedAt = Date.now();
        setApiPending(true);
        startProgress();
      }
      try {
        return await originalFetch(...args);
      } finally {
        if (tracksRequest && --pendingRequests === 0) scheduleStop();
      }
    };

    return () => {
      window.fetch = originalFetch;
      if (stopTimer !== undefined) window.clearTimeout(stopTimer);
      if (pendingRequests > 0) stopProgress(true);
      setApiPending(false);
    };
  }, []);

  return (
    <>
      <AppProgressBar
        color="#168a4a"
        height="5px"
        options={{ showSpinner: false }}
        shallowRouting
        delay={120}
        stopDelay={120}
      />
      <div
        className={`api-progress${apiPending ? " visible" : ""}`}
        aria-hidden="true"
      />
    </>
  );
}

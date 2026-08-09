"use client";

import { useEffect } from "react";
import {
  AppProgressBar,
  startProgress,
  stopProgress,
} from "next-nprogress-bar";

export function AppProgress() {
  useEffect(() => {
    const originalFetch = window.fetch;
    let pendingRequests = 0;

    window.fetch = async (...args) => {
      const input = args[0];
      const url = new URL(
        input instanceof Request ? input.url : String(input),
        window.location.href,
      );
      const tracksRequest =
        url.origin === window.location.origin &&
        url.pathname.startsWith("/api/");

      if (tracksRequest && pendingRequests++ === 0) startProgress();
      try {
        return await originalFetch(...args);
      } finally {
        if (tracksRequest && --pendingRequests === 0) stopProgress();
      }
    };

    return () => {
      window.fetch = originalFetch;
      if (pendingRequests > 0) stopProgress(true);
    };
  }, []);

  return (
    <AppProgressBar
      color="#168a4a"
      height="3px"
      options={{ showSpinner: false }}
      shallowRouting
      delay={120}
      stopDelay={120}
    />
  );
}

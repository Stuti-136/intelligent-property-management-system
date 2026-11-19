"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

// Loads a GET endpoint. Pass null to skip loading. Changing `path` loads again.
// Keeps the previous data on screen while a new request is in flight.
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: path !== null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (path === null) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    api(path)
      .then((data) => {
        if (!cancelled) setState({ data, error: null, loading: false });
      })
      .catch((error) => {
        if (!cancelled) setState({ data: null, error, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [path, tick]);

  return { ...state, reload: () => setTick((t) => t + 1) };
}

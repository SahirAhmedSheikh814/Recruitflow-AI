"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  getPipeline,
  openPipelineSocket,
  type PipelineFilters,
  type PipelineRow,
} from "@/lib/api";

/**
 * Live ATS pipeline data (Module 12).
 *
 * Loads the joined pipeline via REST, then opens the `/ats/ws` WebSocket and
 * refetches whenever the backend broadcasts a domain event, so the recruiter
 * and admin boards stay in sync in real time as agents advance applications.
 * The socket reconnects automatically on drop.
 */
export function useLivePipeline(filters: PipelineFilters = {}) {
  const [rows, setRows] = useState<PipelineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filterKey = JSON.stringify(filters);

  const refetch = useCallback(() => {
    return getPipeline(filters)
      .then(setRows)
      .catch(() => setError("Failed to load the pipeline."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  const socketRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    let closed = false;

    function connect() {
      if (closed) return;
      let socket: WebSocket;
      try {
        socket = openPipelineSocket();
      } catch {
        return;
      }
      socketRef.current = socket;
      socket.onmessage = () => refetch();
      socket.onclose = () => {
        if (closed) return;
        retryRef.current = setTimeout(connect, 3000); // auto-reconnect
      };
    }

    connect();
    return () => {
      closed = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      socketRef.current?.close();
    };
  }, [refetch]);

  return { rows, loading, error, refetch };
}

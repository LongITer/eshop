"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import Breadcrumbs from "../../shared/component/breadcrumbs";
import {
  Download,
  Trash2,
  Circle,
  Search,
  Terminal,
  Wifi,
  WifiOff,
  PauseCircle,
  PlayCircle,
} from "lucide-react";

type LogType = "success" | "error" | "warn" | "info" | "debug";

type LogItem = {
  type: LogType;
  message: string;
  timestamp: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

const TYPE_STYLES: Record<
  LogType,
  { dot: string; text: string; badge: string; label: string }
> = {
  success: {
    dot: "bg-green-400",
    text: "text-green-400",
    badge: "bg-green-400/10 text-green-400 border-green-400/30",
    label: "SUCCESS",
  },
  error: {
    dot: "bg-red-500",
    text: "text-red-400",
    badge: "bg-red-500/10 text-red-400 border-red-500/30",
    label: "ERROR",
  },
  warn: {
    dot: "bg-yellow-400",
    text: "text-yellow-300",
    badge: "bg-yellow-400/10 text-yellow-300 border-yellow-400/30",
    label: "WARN",
  },
  info: {
    dot: "bg-blue-400",
    text: "text-blue-300",
    badge: "bg-blue-400/10 text-blue-300 border-blue-400/30",
    label: "INFO",
  },
  debug: {
    dot: "bg-gray-500",
    text: "text-gray-400",
    badge: "bg-gray-500/10 text-gray-400 border-gray-500/30",
    label: "DEBUG",
  },
};

const FILTERS: { label: string; value: LogType | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Info", value: "info" },
  { label: "Success", value: "success" },
  { label: "Warn", value: "warn" },
  { label: "Error", value: "error" },
  { label: "Debug", value: "debug" },
];

const formatTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return "--:--:--";
  }
};

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
    });
  } catch {
    return "";
  }
};

const page = () => {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<LogType | "all">("all");
  const [search, setSearch] = useState("");
  const [paused, setPaused] = useState(false);
  const [connected, setConnected] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const logContainerRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Sync pausedRef with state
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // WebSocket connection
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL || "ws://localhost:6008";

    const connect = () => {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        // Reconnect after 3s
        setTimeout(connect, 3000);
      };
      ws.onerror = () => setConnected(false);

      ws.onmessage = (event) => {
        if (pausedRef.current) return;
        try {
          const parsed: LogItem = JSON.parse(event.data);
          setLogs((prev) => {
            const next = [...prev, parsed];
            // Keep max 1000 logs in memory
            return next.length > 1000 ? next.slice(-1000) : next;
          });
        } catch {
          // Plain-text fallback
          setLogs((prev) => [
            ...prev,
            {
              type: "info",
              message: event.data,
              timestamp: new Date().toISOString(),
              source: "raw",
            },
          ]);
        }
      };
    };

    connect();
    return () => wsRef.current?.close();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Detect manual scroll up to disable auto-scroll
  const handleScroll = () => {
    const el = logContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(atBottom);
  };

  // Filtered logs
  const filteredLogs = logs.filter((log) => {
    const matchType = activeFilter === "all" || log.type === activeFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      log.message.toLowerCase().includes(q) ||
      (log.source?.toLowerCase().includes(q) ?? false);
    return matchType && matchSearch;
  });

  // Counts per type
  const counts = logs.reduce(
    (acc, l) => {
      acc[l.type] = (acc[l.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const clearLogs = () => {
    setLogs([]);
    setExpandedIndex(null);
  };

  const downloadLogs = () => {
    const content = filteredLogs
      .map(
        (log) =>
          `[${formatDate(log.timestamp)} ${formatTime(log.timestamp)}] [${log.type.toUpperCase()}] ${log.source ? `[${log.source}]` : ""} ${log.message}`,
      )
      .join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${new Date().toISOString().slice(0, 10)}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full min-h-screen bg-[#0d0d0d] text-white p-6 flex flex-col gap-5">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Loggers" },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Terminal size={18} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">System Logs</h1>
            <p className="text-xs text-gray-500">
              Real-time application event stream
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Connection badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
              connected
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border-red-500/20"
            }`}
          >
            {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {connected ? "Live" : "Disconnected"}
            {connected && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
            )}
          </div>

          {/* Pause / Resume */}
          <button
            onClick={() => setPaused((p) => !p)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              paused
                ? "bg-yellow-500/10 text-yellow-300 border-yellow-500/20 hover:bg-yellow-500/20"
                : "bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700"
            }`}
          >
            {paused ? <PlayCircle size={13} /> : <PauseCircle size={13} />}
            {paused ? "Resume" : "Pause"}
          </button>

          {/* Download */}
          <button
            onClick={downloadLogs}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={13} />
            Export
          </button>

          {/* Clear */}
          <button
            onClick={clearLogs}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border bg-gray-800 text-red-400 border-gray-700 hover:bg-red-500/10 hover:border-red-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 size={13} />
            Clear
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-3">
        {(["info", "success", "warn", "error", "debug"] as LogType[]).map(
          (type) => (
            <button
              key={type}
              onClick={() =>
                setActiveFilter(activeFilter === type ? "all" : type)
              }
              className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-150 ${
                activeFilter === type
                  ? `${TYPE_STYLES[type].badge} border-opacity-60`
                  : "bg-[#111] border-[#222] hover:border-[#333]"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${TYPE_STYLES[type].dot}`}
                />
                <span className="text-xs font-medium capitalize text-gray-300">
                  {type}
                </span>
              </div>
              <span className={`text-sm font-bold ${TYPE_STYLES[type].text}`}>
                {counts[type] || 0}
              </span>
            </button>
          ),
        )}
      </div>

      {/* Terminal panel */}
      <div className="flex-1 rounded-xl border border-[#1e1e1e] overflow-hidden flex flex-col bg-[#0a0a0a]">
        {/* Terminal top bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#111] border-b border-[#1e1e1e]">
          <div className="flex items-center gap-2">
            {/* macOS-style dots */}
            <span className="w-3 h-3 rounded-full bg-red-500/70" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
            <span className="w-3 h-3 rounded-full bg-green-500/70" />
            <span className="ml-3 text-xs text-gray-500 font-mono">
              logger@eshop ~ {filteredLogs.length} event
              {filteredLogs.length !== 1 ? "s" : ""}
              {paused && <span className="ml-2 text-yellow-400">[PAUSED]</span>}
            </span>
          </div>

          {/* Filter tabs + search */}
          <div className="flex items-center gap-2">
            {/* Filter tabs */}
            <div className="flex items-center bg-[#0d0d0d] rounded-lg border border-[#222] p-0.5 gap-0.5">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setActiveFilter(f.value)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    activeFilter === f.value
                      ? "bg-[#1e1e1e] text-white"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {f.label}
                  {f.value !== "all" && counts[f.value] > 0 && (
                    <span
                      className={`ml-1.5 text-[10px] font-bold ${TYPE_STYLES[f.value as LogType].text}`}
                    >
                      {counts[f.value]}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search logs..."
                className="pl-7 pr-3 py-1.5 text-xs bg-[#0d0d0d] border border-[#222] rounded-lg text-gray-300 placeholder-gray-600 outline-none focus:border-[#333] focus:ring-1 focus:ring-emerald-500/20 w-44 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Log entries */}
        <div
          ref={logContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto font-mono text-xs min-h-[60vh] max-h-[65vh] scroll-smooth"
        >
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-700 py-20">
              <Terminal size={32} className="opacity-30" />
              <p className="text-sm">
                {connected
                  ? "Waiting for log events…"
                  : "Connecting to logger service…"}
              </p>
              {!connected && (
                <p className="text-xs text-gray-600">ws://localhost:6008</p>
              )}
            </div>
          ) : (
            filteredLogs.map((log, i) => {
              const style = TYPE_STYLES[log.type] || TYPE_STYLES.info;
              const isExpanded = expandedIndex === i;
              const hasMetadata =
                log.metadata && Object.keys(log.metadata).length > 0;

              return (
                <div
                  key={i}
                  onClick={() => setExpandedIndex(isExpanded ? null : i)}
                  className={`group flex items-start gap-3 px-4 py-2 border-b border-[#111] transition-colors cursor-pointer ${
                    isExpanded ? "bg-[#111]" : "hover:bg-[#0f0f0f]"
                  }`}
                >
                  {/* Index */}
                  <span className="text-[10px] text-gray-700 w-8 text-right flex-shrink-0 select-none pt-px">
                    {i + 1}
                  </span>

                  {/* Dot */}
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${style.dot}`}
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Timestamp */}
                      <span className="text-gray-600 flex-shrink-0">
                        {formatDate(log.timestamp)}{" "}
                        <span className="text-gray-500">
                          {formatTime(log.timestamp)}
                        </span>
                      </span>

                      {/* Type badge */}
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${style.badge} flex-shrink-0`}
                      >
                        {style.label}
                      </span>

                      {/* Source */}
                      {log.source && (
                        <span className="text-purple-400/70 text-[10px] flex-shrink-0">
                          [{log.source}]
                        </span>
                      )}

                      {/* Message */}
                      <span className={`${style.text} break-all`}>
                        {log.message}
                      </span>
                    </div>

                    {/* Expanded metadata */}
                    {isExpanded && hasMetadata && (
                      <div className="mt-2 ml-0 p-3 rounded-lg bg-[#0d0d0d] border border-[#1e1e1e] text-gray-400">
                        <pre className="whitespace-pre-wrap break-all text-[11px]">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Terminal footer */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#111] border-t border-[#1e1e1e] text-[10px] text-gray-600">
          <span className="font-mono">
            {filteredLogs.length} / {logs.length} logs
            {search && ` · filter: "${search}"`}
            {activeFilter !== "all" && ` · type: ${activeFilter}`}
          </span>
          <div className="flex items-center gap-3">
            {!autoScroll && (
              <button
                onClick={() => {
                  setAutoScroll(true);
                  if (logContainerRef.current) {
                    logContainerRef.current.scrollTop =
                      logContainerRef.current.scrollHeight;
                  }
                }}
                className="text-emerald-400 hover:underline"
              >
                ↓ Scroll to bottom
              </button>
            )}
            <span>Click a row to expand metadata</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default page;

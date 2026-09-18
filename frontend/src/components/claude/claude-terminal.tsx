"use client";

import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Play, Square, RotateCcw, Terminal as TerminalIcon } from "lucide-react";
import { TopicInfo } from "@/types";
import { getWebSocketUrl } from "@/lib/api";

interface ClaudeTerminalProps {
  topic: TopicInfo;
}

export function ClaudeTerminal({ topic }: ClaudeTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");

  const connectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsUrl = getWebSocketUrl(`/ws/topics/${topic.id}/claude`);
    setStatus("connecting");
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      xtermRef.current?.writeln("\x1b[32m[Connected to Claude Code CLI session]\x1b[0m");
      if (xtermRef.current) {
        ws.send(JSON.stringify({
          type: "resize",
          cols: xtermRef.current.cols,
          rows: xtermRef.current.rows
        }));
      }
      // Auto-start CLI process
      ws.send(JSON.stringify({ type: "start" }));
      setIsRunning(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "output" && xtermRef.current) {
          xtermRef.current.write(msg.data);
        } else if (msg.type === "error" && xtermRef.current) {
          xtermRef.current.writeln(`\x1b[31m[Error: ${msg.message}]\x1b[0m`);
        }
      } catch {
        xtermRef.current?.write(event.data);
      }
    };

    ws.onclose = () => {
      setStatus("disconnected");
      setIsRunning(false);
      xtermRef.current?.writeln("\r\n\x1b[33m[Disconnected from backend]\x1b[0m");
    };

    ws.onerror = (err) => {
      setStatus("disconnected");
      console.error("WebSocket error:", err);
    };
  };

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      theme: {
        background: "#090d16",
        foreground: "#f8fafc",
        cursor: "#38bdf8",
        selectionBackground: "rgba(56, 189, 248, 0.3)",
        black: "#0f172a",
        red: "#f87171",
        green: "#4ade80",
        yellow: "#facc15",
        blue: "#60a5fa",
        magenta: "#c084fc",
        cyan: "#38bdf8",
        white: "#f8fafc",
      },
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    term.onData((data) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "input", data }));
      }
    });

    connectWebSocket();

    const handleResize = () => {
      try {
        fitAddon.fit();
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: "resize",
            cols: term.cols,
            rows: term.rows
          }));
        }
      } catch {}
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      wsRef.current?.close();
      term.dispose();
    };
  }, [topic.id]);

  const handleStart = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "start" }));
      setIsRunning(true);
    } else {
      connectWebSocket();
    }
  };

  const handleStop = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "stop" }));
      setIsRunning(false);
    }
  };

  const handleRestart = () => {
    xtermRef.current?.clear();
    connectWebSocket();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#090d16] overflow-hidden">
      {/* Terminal Toolbar */}
      <div className="h-11 bg-secondary/30 border-b border-border/60 px-4 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-semibold text-foreground">Claude Code CLI Web Terminal</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
              status === "connected"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : status === "connecting"
                ? "bg-amber-500/20 text-amber-400"
                : "bg-destructive/20 text-destructive"
            }`}
          >
            {status === "connected" ? "LIVE" : status.toUpperCase()}
          </span>
          <span className="text-xs font-mono text-muted-foreground ml-2">
            CWD: ~/{topic.name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isRunning ? (
            <button
              onClick={handleStart}
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-medium transition"
            >
              <Play className="w-3 h-3" />
              <span>실행</span>
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="flex items-center gap-1.5 px-3 py-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-md text-xs font-medium transition"
            >
              <Square className="w-3 h-3" />
              <span>중지</span>
            </button>
          )}

          <button
            onClick={handleRestart}
            title="세션 재시작"
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* XTerm Container */}
      <div className="flex-1 p-3 overflow-hidden" ref={terminalRef} />
    </div>
  );
}

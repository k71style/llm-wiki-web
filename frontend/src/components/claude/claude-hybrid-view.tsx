"use client";

import { useState } from "react";
import { MessageSquare, Terminal as TerminalIcon } from "lucide-react";
import { TopicInfo } from "@/types";
import { ClaudeChat } from "./claude-chat";
import { ClaudeTerminal } from "./claude-terminal";

interface ClaudeHybridViewProps {
  topic: TopicInfo;
}

export function ClaudeHybridView({ topic }: ClaudeHybridViewProps) {
  const [mode, setMode] = useState<"chat" | "terminal">("chat");

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Sub-mode navigation bar */}
      <div className="h-10 border-b border-border bg-card/60 px-4 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
          <span>Claude Code 인터페이스:</span>
          <span className="text-foreground">{mode === "chat" ? "대화형 채팅 모드" : "웹 터미널 모드 (xterm.js)"}</span>
        </div>

        <div className="flex items-center bg-secondary p-0.5 rounded-lg border border-border text-xs">
          <button
            onClick={() => setMode("chat")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition font-medium ${
              mode === "chat"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-primary" />
            <span>채팅 모드</span>
          </button>
          <button
            onClick={() => setMode("terminal")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition font-medium ${
              mode === "terminal"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <TerminalIcon className="w-3.5 h-3.5 text-sky-400" />
            <span>터미널 모드</span>
          </button>
        </div>
      </div>

      {/* View Container */}
      <div className="flex-1 flex overflow-hidden">
        {mode === "chat" ? (
          <ClaudeChat topic={topic} onSwitchToTerminal={() => setMode("terminal")} />
        ) : (
          <ClaudeTerminal topic={topic} />
        )}
      </div>
    </div>
  );
}

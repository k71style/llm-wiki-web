"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Send, Bot, User, Sparkles, Terminal, Loader2 } from "lucide-react";
import { TopicInfo } from "@/types";
import { getWebSocketUrl } from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  timestamp: string;
}

interface ClaudeChatProps {
  topic: TopicInfo;
  onSwitchToTerminal: () => void;
}

export function ClaudeChat({ topic, onSwitchToTerminal }: ClaudeChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "system",
      text: `안녕하세요! **${topic.title}** (${topic.name}) 위키 지식 저장소와 연동된 Claude Code 에이전트입니다. 위키 문서 분석, 새로운 개념 정리, 위키링크 연결 작업을 요청하세요.`,
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const wsUrl = getWebSocketUrl(`/ws/topics/${topic.id}/claude`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "start_stream") {
          setIsGenerating(true);
        } else if (msg.type === "output" && msg.data) {
          const cleanText = msg.data.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
          if (cleanText) {
            setMessages((prev) => {
              const lastMsg = prev[prev.length - 1];
              if (lastMsg && lastMsg.role === "assistant") {
                return [
                  ...prev.slice(0, -1),
                  { ...lastMsg, text: lastMsg.text + cleanText },
                ];
              } else {
                return [
                  ...prev,
                  {
                    id: String(Date.now()),
                    role: "assistant",
                    text: cleanText,
                    timestamp: new Date().toLocaleTimeString(),
                  },
                ];
              }
            });
          }
        } else if (msg.type === "done") {
          setIsGenerating(false);
        }
      } catch {
        // Fallback
      }
    };

    return () => {
      ws.close();
    };
  }, [topic.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  const handleSend = (textToSend?: string) => {
    const prompt = textToSend || input;
    if (!prompt.trim() || isGenerating) return;

    // Append user message
    setMessages((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        role: "user",
        text: prompt.trim(),
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);

    setIsGenerating(true);

    // Send prompt to backend
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "prompt", prompt: prompt.trim() }));
    }

    setInput("");
  };

  const PRESETS = [
    { label: "위키 전체 개요 요약", prompt: "현재 위키 저장소의 모든 문서를 읽고 전체적인 지식 구조와 핵심 주제를 요약해줘." },
    { label: "양방향 링크 점검 및 보완", prompt: "개념 문서들을 분석해서 서로 연관되어 있으나 [[위키링크]]가 빠져 있는 곳들을 찾고 연결을 제안해줘." },
    { label: "새로운 종합 페이지 작성", prompt: "주요 개념 문서들을 종합하여 새로운 심화 학습 가이드 문서를 concepts/ 폴더에 작성해줘." },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="h-11 sm:h-12 border-b border-border bg-card px-3 sm:px-4 flex items-center justify-between shrink-0 select-none gap-2">
        <div className="flex items-center gap-2 truncate">
          <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0">
            <Bot className="w-3.5 h-3.5" />
          </div>
          <div className="truncate">
            <span className="text-xs font-semibold text-foreground">Claude Code Agent</span>
            <span className="text-[11px] text-muted-foreground ml-1.5 hidden sm:inline">
              (저장소: {topic.title})
            </span>
          </div>
        </div>

        <button
          onClick={onSwitchToTerminal}
          className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 bg-secondary text-foreground text-xs font-medium rounded-lg hover:bg-secondary/80 border border-border transition shrink-0"
        >
          <Terminal className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden sm:inline">터미널 뷰로 전환</span>
          <span className="sm:hidden">터미널</span>
        </button>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3 sm:space-y-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex items-start gap-2.5 sm:gap-3 max-w-[92%] sm:max-w-3xl ${
              m.role === "user" ? "ml-auto flex-row-reverse" : ""
            }`}
          >
            <div
              className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center shrink-0 text-xs ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : m.role === "system"
                  ? "bg-purple-600 text-white"
                  : "bg-secondary text-foreground border border-border"
              }`}
            >
              {m.role === "user" ? (
                <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              ) : m.role === "system" ? (
                <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              ) : (
                <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400" />
              )}
            </div>

            <div
              className={`rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-xs"
                  : m.role === "system"
                  ? "bg-purple-500/10 border border-purple-500/30 text-foreground"
                  : "bg-card border border-border text-foreground rounded-tl-xs markdown-body text-xs"
              }`}
            >
              {m.role === "assistant" ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {m.text}
                </ReactMarkdown>
              ) : (
                <p className="whitespace-pre-wrap">{m.text}</p>
              )}
              <div className="text-[10px] opacity-50 mt-1 text-right">
                {m.timestamp}
              </div>
            </div>
          </div>
        ))}

        {isGenerating && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/30 px-3 py-2 rounded-lg w-fit border border-border/60 animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
            <span>Claude Code가 응답을 생성하고 있습니다...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Preset Suggestions */}
      <div className="px-3 sm:px-4 py-2 border-t border-border/60 bg-secondary/10 flex items-center gap-1.5 sm:gap-2 overflow-x-auto select-none no-scrollbar">
        <span className="text-[11px] font-semibold text-muted-foreground shrink-0 hidden sm:inline">추천 작업:</span>
        {PRESETS.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(p.prompt)}
            disabled={isGenerating}
            className="text-[11px] sm:text-xs px-2.5 py-1 bg-secondary hover:bg-secondary/80 border border-border/60 rounded-full text-foreground/90 whitespace-nowrap transition disabled:opacity-50 shrink-0"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div className="p-2.5 sm:p-4 border-t border-border bg-card">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2 bg-secondary/50 border border-border rounded-xl px-3 sm:px-3.5 py-1.5 sm:py-2 focus-within:ring-2 focus-within:ring-primary"
        >
          <input
            type="text"
            placeholder={
              isGenerating
                ? "응답 생성 중입니다..."
                : "Claude에게 위키 작업을 요청하세요..."
            }
            value={input}
            disabled={isGenerating}
            onChange={(e) => setInput(e.target.value)}
            className="w-full bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isGenerating}
            className="p-1.5 sm:p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition disabled:opacity-40 shrink-0"
          >
            {isGenerating ? (
              <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, Sparkles, FileText } from "lucide-react";
import { searchPages } from "@/lib/api";
import { SearchResultItem } from "@/types";

interface SearchDialogProps {
  isOpen: boolean;
  topicId: string | null;
  onClose: () => void;
  onSelectResult: (path: string) => void;
}

export function SearchDialog({
  isOpen,
  topicId,
  onClose,
  onSelectResult,
}: SearchDialogProps) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"hybrid" | "keyword" | "semantic">("hybrid");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !topicId || !query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchPages(topicId, query.trim(), mode);
        setResults(res);
        setSelectedIndex(0);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, mode, topicId, isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      onSelectResult(results[selectedIndex].path);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-3 sm:pt-20 bg-black/60 backdrop-blur-xs p-2 sm:p-4">
      <div className="bg-card border border-border w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] sm:max-h-[75vh]">
        {/* Search Header Input */}
        <div className="p-3 sm:p-3.5 border-b border-border flex items-center gap-2.5 sm:gap-3 bg-secondary/30">
          <Search className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="위키 문서 검색 (키워드 또는 질문)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent text-foreground placeholder:text-muted-foreground text-xs sm:text-sm focus:outline-none"
          />
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Mode Filter Bar */}
        <div className="px-3 sm:px-4 py-2 border-b border-border/60 bg-secondary/10 flex items-center justify-between text-xs gap-2">
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setMode("hybrid")}
              className={`px-2 sm:px-2.5 py-1 rounded-md font-medium transition flex items-center gap-1 whitespace-nowrap text-[11px] sm:text-xs ${
                mode === "hybrid"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>하이브리드</span>
            </button>
            <button
              onClick={() => setMode("keyword")}
              className={`px-2 sm:px-2.5 py-1 rounded-md font-medium transition whitespace-nowrap text-[11px] sm:text-xs ${
                mode === "keyword"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <span>키워드 (FTS5)</span>
            </button>
            <button
              onClick={() => setMode("semantic")}
              className={`px-2 sm:px-2.5 py-1 rounded-md font-medium transition whitespace-nowrap text-[11px] sm:text-xs ${
                mode === "semantic"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <span>시맨틱 (Vector)</span>
            </button>
          </div>

          <span className="text-muted-foreground text-[10px] sm:text-[11px] shrink-0">
            {loading ? "검색 중..." : `${results.length}개`}
          </span>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {results.length === 0 ? (
            <div className="p-6 sm:p-8 text-center text-xs text-muted-foreground">
              {query.trim()
                ? "검색 결과가 없습니다."
                : "키워드 또는 질문을 입력하여 주제 위키를 검색하세요."}
            </div>
          ) : (
            results.map((r, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={r.page_id}
                  onClick={() => {
                    onSelectResult(r.path);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`p-2.5 sm:p-3 rounded-lg cursor-pointer transition border ${
                    isSelected
                      ? "bg-secondary border-primary/40 shadow-xs"
                      : "border-transparent hover:bg-secondary/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 sm:gap-2 font-medium text-xs sm:text-sm text-foreground truncate">
                      <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400 shrink-0" />
                      <span className="truncate">{r.title}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded font-mono ${
                          r.match_type === "hybrid"
                            ? "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                            : r.match_type === "semantic"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                        }`}
                      >
                        {r.match_type}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] sm:text-xs text-muted-foreground font-mono mt-0.5 truncate">
                    {r.path}
                  </div>

                  {r.snippet && (
                    <div
                      className="text-[11px] sm:text-xs text-foreground/80 mt-1 sm:mt-1.5 line-clamp-2 leading-relaxed bg-background/40 p-1.5 sm:p-2 rounded border border-border/40 [&_mark]:bg-amber-400/30 [&_mark]:text-amber-200 [&_mark]:px-0.5 [&_mark]:rounded"
                      dangerouslySetInnerHTML={{ __html: r.snippet }}
                    />
                  )}

                  {r.tags && r.tags.length > 0 && (
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {r.tags.map((t) => (
                        <span
                          key={t}
                          className="text-[9px] sm:text-[10px] text-muted-foreground bg-muted px-1.5 py-0.2 rounded"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="p-2 sm:p-2.5 border-t border-border bg-card/70 text-[10px] sm:text-[11px] text-muted-foreground flex items-center justify-between px-3 sm:px-4">
          <div className="hidden sm:flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 bg-secondary rounded border border-border">↑↓</kbd> 이동
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-secondary rounded border border-border">Enter</kbd> 열기
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-secondary rounded border border-border">ESC</kbd> 닫기
            </span>
          </div>
          <span className="text-[10px] text-primary/80 ml-auto sm:ml-0">LLM-Wiki Hybrid Search</span>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Save, X, Eye, Columns, Trash2, Edit3 } from "lucide-react";
import { PageDetail } from "@/types";

interface WikiEditorProps {
  page: PageDetail | { path: string; raw_content?: string; title?: string };
  onSave: (content: string) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
}

export function WikiEditor({
  page,
  onSave,
  onCancel,
  onDelete,
}: WikiEditorProps) {
  const [content, setContent] = useState(page.raw_content || "");
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"split" | "edit" | "preview">("split");

  // On mount or small screens, default to edit mode if screen width < 768
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setViewMode("edit");
    }
  }, []);

  useEffect(() => {
    setContent(page.raw_content || "");
  }, [page.raw_content]);

  // Keyboard shortcut Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [content]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(content);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Editor Header Bar */}
      <div className="h-12 border-b border-border bg-card px-3 sm:px-4 flex items-center justify-between shrink-0 select-none gap-2">
        <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground truncate">
          <span className="hidden sm:inline">문서 편집:</span>
          <span className="text-foreground font-semibold truncate max-w-[140px] sm:max-w-none">{page.path}</span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* View mode toggle */}
          <div className="flex items-center bg-secondary/80 p-0.5 rounded-lg border border-border text-xs">
            <button
              onClick={() => setViewMode("split")}
              className={`hidden md:flex px-2 py-1 rounded items-center gap-1 ${
                viewMode === "split" ? "bg-card text-foreground font-medium shadow-xs" : "text-muted-foreground"
              }`}
            >
              <Columns className="w-3 h-3" />
              <span>분할</span>
            </button>
            <button
              onClick={() => setViewMode("edit")}
              className={`px-2 py-1 rounded flex items-center gap-1 ${
                viewMode === "edit" ? "bg-card text-foreground font-medium shadow-xs" : "text-muted-foreground"
              }`}
            >
              <Edit3 className="w-3 h-3 md:hidden" />
              <span>편집</span>
            </button>
            <button
              onClick={() => setViewMode("preview")}
              className={`px-2 py-1 rounded flex items-center gap-1 ${
                viewMode === "preview" ? "bg-card text-foreground font-medium shadow-xs" : "text-muted-foreground"
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>미리보기</span>
            </button>
          </div>

          {onDelete && (
            <button
              onClick={onDelete}
              title="문서 삭제"
              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onCancel}
            className="px-2.5 sm:px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground font-medium rounded-lg hover:bg-secondary transition"
          >
            취소
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 transition shadow-sm disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? "저장..." : "저장"}</span>
          </button>
        </div>
      </div>

      {/* Editor Content Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Pane */}
        {(viewMode === "split" || viewMode === "edit") && (
          <div className="flex-1 flex flex-col h-full border-r border-border bg-card/40">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="마크다운 내용을 작성하세요. [[위키링크]]와 YAML Frontmatter를 지원합니다."
              className="w-full flex-1 p-4 sm:p-6 bg-transparent text-foreground font-mono text-sm leading-relaxed resize-none focus:outline-none"
              spellCheck={false}
            />
          </div>
        )}

        {/* Live Preview Pane */}
        {(viewMode === "split" || viewMode === "preview") && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-background/50">
            <div className="markdown-body max-w-3xl">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
              >
                {content}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

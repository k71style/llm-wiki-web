"use client";

import { useState } from "react";
import { X, Plus, FolderPlus } from "lucide-react";
import { createTopic } from "@/lib/api";
import { TopicInfo } from "@/types";

interface CreateTopicDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onTopicCreated: (topic: TopicInfo) => void;
}

export function CreateTopicDialog({
  isOpen,
  onClose,
  onTopicCreated,
}: CreateTopicDialogProps) {
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !title.trim()) {
      setError("저장소 ID(Slug)와 제목은 필수입니다.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const topic = await createTopic({
        name: name.trim(),
        title: title.trim(),
        description: description.trim() || undefined,
        system_prompt: systemPrompt.trim() || undefined,
      });
      setName("");
      setTitle("");
      setDescription("");
      setSystemPrompt("");
      onTopicCreated(topic);
      onClose();
    } catch (err: any) {
      setError(err.message || "주제 저장소 생성 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border w-full max-w-lg rounded-xl shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1 rounded-md"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <FolderPlus className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">새 주제 저장소 생성</h2>
            <p className="text-sm text-muted-foreground">
              독립된 위키 디렉토리 및 Claude Code 작업 환경을 생성합니다.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/15 border border-destructive/30 text-destructive text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              저장소 ID / 디렉토리명 (Slug) *
            </label>
            <input
              type="text"
              placeholder="예: ai-research, system-architecture"
              value={name}
              onChange={(e) => {
                setName(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, "-"));
                if (!title) setTitle(e.target.value);
              }}
              required
              className="w-full px-3.5 py-2 bg-secondary/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              주제 표시 제목 (Title) *
            </label>
            <input
              type="text"
              placeholder="예: 인공지능 에이전트 연구 위키"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3.5 py-2 bg-secondary/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              주제 개요 / 설명
            </label>
            <textarea
              placeholder="이 위키 저장소에서 다룰 주요 주제와 목표를 기술하세요."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3.5 py-2 bg-secondary/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Claude Code 전용 시스템 지침 (선택사항)
            </label>
            <textarea
              placeholder="CLAUDE.md에 추가될 주제 맞춤형 프롬프트 규칙"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={3}
              className="w-full px-3.5 py-2 bg-secondary/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground font-medium"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-primary text-primary-foreground font-medium rounded-lg text-sm hover:bg-primary/90 transition flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>생성 중...</span>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>저장소 만들기</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

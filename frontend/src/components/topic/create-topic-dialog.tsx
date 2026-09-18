"use client";

import { useState } from "react";
import { X, Plus, FolderPlus, GitBranch, Download, Loader2, Key, User, ShieldAlert, Globe, Lock, Shield } from "lucide-react";
import { createTopic, importTopicFromGit } from "@/lib/api";
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
  const [tab, setTab] = useState<"blank" | "git">("blank");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [assignedUsersInput, setAssignedUsersInput] = useState("");
  
  // Git import state
  const [gitUrl, setGitUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [authUsername, setAuthUsername] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [insecureSsl, setInsecureSsl] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Auto-fill slug & title from Git URL
  const handleGitUrlChange = (url: string) => {
    setGitUrl(url);
    if (!name || name === "my-wiki") {
      try {
        const cleanUrl = url.trim().replace(/\.git$/, "").replace(/\/$/, "");
        const parts = cleanUrl.split("/");
        const lastPart = parts[parts.length - 1];
        if (lastPart) {
          const slug = lastPart.toLowerCase().replace(/[^a-z0-9-_]/g, "-");
          setName(slug);
          if (!title) {
            setTitle(lastPart);
          }
        }
      } catch {}
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !title.trim()) {
      setError("저장소 ID(Slug)와 제목은 필수입니다.");
      return;
    }

    if (tab === "git" && !gitUrl.trim()) {
      setError("Git 저장소 URL을 입력해 주세요.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const assignedList = assignedUsersInput
        .split(",")
        .map((u) => u.trim().toLowerCase())
        .filter(Boolean);

      let topic: TopicInfo;
      if (tab === "git") {
        topic = await importTopicFromGit({
          git_url: gitUrl.trim(),
          name: name.trim(),
          title: title.trim(),
          description: description.trim() || undefined,
          branch: branch.trim() || undefined,
          auth_username: authUsername.trim() || undefined,
          auth_token: authToken.trim() || undefined,
          insecure_ssl: insecureSsl,
          depth: 1,
          is_public: isPublic,
          assigned_users: assignedList,
        });
      } else {
        topic = await createTopic({
          name: name.trim(),
          title: title.trim(),
          description: description.trim() || undefined,
          system_prompt: systemPrompt.trim() || undefined,
          is_public: isPublic,
          assigned_users: assignedList,
        });
      }

      setName("");
      setTitle("");
      setDescription("");
      setSystemPrompt("");
      setIsPublic(false);
      setAssignedUsersInput("");
      setGitUrl("");
      setBranch("");
      setAuthUsername("");
      setAuthToken("");
      setInsecureSsl(false);
      onTopicCreated(topic);
      onClose();
    } catch (err: any) {
      setError(err.message || "주제 저장소 생성/가져오기 실패");
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

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            {tab === "blank" ? <FolderPlus className="w-6 h-6" /> : <GitBranch className="w-6 h-6" />}
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {tab === "blank" ? "새 주제 저장소 생성" : "기존 Git 저장소 가져오기"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {tab === "blank"
                ? "독립된 위키 디렉토리 및 Claude Code 작업 환경을 생성합니다."
                : "GitHub, GitLab 등의 마크다운 위키 저장소를 클론하고 자동 인덱싱합니다."}
            </p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex p-1 bg-secondary/50 rounded-lg mb-4 border border-border/60">
          <button
            type="button"
            onClick={() => {
              setTab("blank");
              setError(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition ${
              tab === "blank"
                ? "bg-card text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>새로 만들기 (Blank)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("git");
              setError(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition ${
              tab === "git"
                ? "bg-card text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Git 저장소 가져오기</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/15 border border-destructive/30 text-destructive text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === "git" && (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Git 저장소 Clone URL *
              </label>
              <input
                type="text"
                placeholder="예: https://github.com/username/my-wiki.git"
                value={gitUrl}
                onChange={(e) => handleGitUrlChange(e.target.value)}
                required
                className="w-full px-3.5 py-2 bg-secondary/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                저장소 ID (Slug) *
              </label>
              <input
                type="text"
                placeholder="예: ai-research"
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
                placeholder="예: 인공지능 연구 위키"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3.5 py-2 bg-secondary/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {tab === "git" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    브랜치 (선택사항)
                  </label>
                  <input
                    type="text"
                    placeholder="기본값 (main / master)"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full px-3.5 py-2 bg-secondary/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                    <User className="w-3 h-3 text-muted-foreground" />
                    <span>계정 ID (선택사항)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="사내 GitLab/Git ID"
                    value={authUsername}
                    onChange={(e) => setAuthUsername(e.target.value)}
                    className="w-full px-3.5 py-2 bg-secondary/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Key className="w-3 h-3 text-muted-foreground" />
                    <span>Access Token / 비밀번호</span>
                  </label>
                  <input
                    type="password"
                    placeholder="PAT 토큰 또는 비밀번호"
                    value={authToken}
                    onChange={(e) => setAuthToken(e.target.value)}
                    className="w-full px-3.5 py-2 bg-secondary/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-secondary/30 border border-border/50 text-xs text-muted-foreground">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={insecureSsl}
                    onChange={(e) => setInsecureSsl(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                  />
                  <span className="flex items-center gap-1 text-zinc-300">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                    <span>사설 SSL 인증서 검증 건너뛰기 (--insecure)</span>
                  </span>
                </label>
                <span className="text-[11px] text-zinc-400">
                  사내 GitLab은 <strong>계정 ID</strong>와 <strong>토큰/비밀번호</strong>를 함께 입력하세요.
                </span>
              </div>
            </div>
          )}

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

          {tab === "blank" && (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Claude Code 전용 시스템 지침 (선택사항)
              </label>
              <textarea
                placeholder="CLAUDE.md에 추가될 주제 맞춤형 프롬프트 규칙"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={2}
                className="w-full px-3.5 py-2 bg-secondary/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
          )}

          {/* 위키 접근 권한 설정 */}
          <div className="p-3 rounded-lg border border-border bg-secondary/20 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                {isPublic ? (
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span>위키 접근 권한</span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-xs select-none">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                />
                <span className="text-zinc-300">전체 공개 (모든 사용자 열람 가능)</span>
              </label>
            </div>
            {!isPublic && (
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                  접근 허용 일반 사용자 (쉼표로 구분, 예: user1, user2)
                </label>
                <input
                  type="text"
                  placeholder="비어있으면 관리자만 접근 가능"
                  value={assignedUsersInput}
                  onChange={(e) => setAssignedUsersInput(e.target.value)}
                  className="w-full px-3 py-1.5 bg-secondary/50 border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}
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
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{tab === "git" ? "저장소 클론 및 색인 중..." : "생성 중..."}</span>
                </>
              ) : tab === "git" ? (
                <>
                  <Download className="w-4 h-4" />
                  <span>Git 저장소 가져오기</span>
                </>
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

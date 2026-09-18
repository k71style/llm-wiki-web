"use client";

import { useState } from "react";
import {
  Folder,
  FolderOpen,
  FileText,
  Plus,
  ChevronRight,
  ChevronDown,
  BookOpen,
  Search,
  Network,
  Terminal,
  Trash2,
  RefreshCw,
  FolderPlus,
  X,
  User,
  LogOut,
  Shield,
  ShieldCheck,
  GitBranch,
  Download,
  Upload,
} from "lucide-react";
import { TopicInfo, TopicTreeItem } from "@/types";
import { useAuth } from "@/contexts/auth-context";
import { pullTopic } from "@/lib/api";

interface SidebarProps {
  topics: TopicInfo[];
  currentTopic: TopicInfo | null;
  tree: TopicTreeItem[];
  currentPath: string | null;
  onSelectTopic: (topic: TopicInfo) => void;
  onSelectPage: (path: string) => void;
  onOpenCreateTopic: () => void;
  onOpenCreatePage: (parentDir?: string) => void;
  onOpenUpload?: () => void;
  onOpenSearch: () => void;
  onRefresh: () => void;
  onDeleteTopic: (topicId: string) => void;
  activeTab: "wiki" | "graph" | "claude";
  onTabChange: (tab: "wiki" | "graph" | "claude") => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({
  topics,
  currentTopic,
  tree,
  currentPath,
  onSelectTopic,
  onSelectPage,
  onOpenCreateTopic,
  onOpenCreatePage,
  onOpenUpload,
  onOpenSearch,
  onRefresh,
  onDeleteTopic,
  activeTab,
  onTabChange,
  isMobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const { user, login, logout } = useAuth();
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    concepts: true,
    sources: true,
  });
  const [pulling, setPulling] = useState(false);
  const [pullMsg, setPullMsg] = useState<string | null>(null);

  const handleGitPull = async () => {
    if (!currentTopic || !currentTopic.is_git_repo || pulling) return;
    setPulling(true);
    setPullMsg(null);
    try {
      const res = await pullTopic(currentTopic.id);
      setPullMsg(res.message || "동기화 완료");
      onRefresh();
      setTimeout(() => setPullMsg(null), 3000);
    } catch (err: any) {
      setPullMsg(err.message || "Git pull 실패");
      setTimeout(() => setPullMsg(null), 4000);
    } finally {
      setPulling(false);
    }
  };

  const toggleFolder = (path: string) => {
    setOpenFolders((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const handleSelectTopicInternal = (topic: TopicInfo) => {
    onSelectTopic(topic);
    if (onCloseMobile) onCloseMobile();
  };

  const handleSelectPageInternal = (path: string) => {
    onSelectPage(path);
    onTabChange("wiki");
    if (onCloseMobile) onCloseMobile();
  };

  const handleTabChangeInternal = (tab: "wiki" | "graph" | "claude") => {
    onTabChange(tab);
    if (onCloseMobile) onCloseMobile();
  };

  const renderTreeItem = (item: TopicTreeItem, depth: number = 0) => {
    if (item.type === "directory") {
      const isOpen = openFolders[item.path] ?? true;
      return (
        <div key={item.path} className="select-none">
          <div
            onClick={() => toggleFolder(item.path)}
            className="flex items-center gap-1.5 py-2 md:py-1.5 px-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-md cursor-pointer group"
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            {isOpen ? (
              <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            )}
            {isOpen ? (
              <FolderOpen className="w-4 h-4 text-amber-500/90 shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-amber-500/90 shrink-0" />
            )}
            <span className="font-medium text-xs truncate flex-1">{item.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenCreatePage(item.path);
                if (onCloseMobile) onCloseMobile();
              }}
              title="이 폴더에 새 문서 만들기"
              className="opacity-80 md:opacity-0 group-hover:opacity-100 p-1 md:p-0.5 hover:text-primary transition"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          {isOpen && item.children && (
            <div>
              {item.children.map((child) => renderTreeItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    const isSelected = currentPath === item.path && activeTab === "wiki";
    return (
      <div
        key={item.path}
        onClick={() => handleSelectPageInternal(item.path)}
        className={`flex items-center gap-2 py-2 md:py-1.5 px-2 text-xs rounded-md cursor-pointer transition ${
          isSelected
            ? "bg-primary text-primary-foreground font-medium shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
        }`}
        style={{ paddingLeft: `${depth * 12 + 20}px` }}
      >
        <FileText className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-primary-foreground" : "text-sky-400"}`} />
        <span className="truncate">{item.title || item.name}</span>
      </div>
    );
  };

  const sidebarContent = (isMobile: boolean = false) => (
    <div className="flex flex-col h-full w-full select-none">
      {/* Brand Header & Topic Selector */}
      <div className="p-3 border-b border-border space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm tracking-tight text-foreground">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white shadow-sm">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
            <span>LLM-Wiki</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                onOpenCreateTopic();
                if (onCloseMobile) onCloseMobile();
              }}
              title="새 주제 저장소 추가"
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
            {isMobile && onCloseMobile && (
              <button
                onClick={onCloseMobile}
                title="메뉴 닫기"
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Topic dropdown */}
        <div className="relative">
          <select
            value={currentTopic?.id || ""}
            onChange={(e) => {
              const selected = topics.find((t) => t.id === e.target.value);
              if (selected) handleSelectTopicInternal(selected);
            }}
            className="w-full bg-secondary/80 border border-border/80 rounded-lg py-1.5 px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer pr-7 truncate"
          >
            {topics.length === 0 ? (
              <option value="">저장소 없음</option>
            ) : (
              topics.map((t) => (
                <option key={t.id} value={t.id}>
                  📁 {t.title} ({t.name})
                </option>
              ))
            )}
          </select>
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
            <ChevronDown className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Global Navigation Tabs (Desktop / Drawer) */}
        <div className="grid grid-cols-3 gap-1 bg-secondary/50 p-1 rounded-lg">
          <button
            onClick={() => handleTabChangeInternal("wiki")}
            className={`flex items-center justify-center gap-1 py-1 rounded text-xs font-medium transition ${
              activeTab === "wiki"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>위키</span>
          </button>
          <button
            onClick={() => handleTabChangeInternal("graph")}
            className={`flex items-center justify-center gap-1 py-1 rounded text-xs font-medium transition ${
              activeTab === "graph"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>그래프</span>
          </button>
          <button
            onClick={() => handleTabChangeInternal("claude")}
            className={`flex items-center justify-center gap-1 py-1 rounded text-xs font-medium transition ${
              activeTab === "claude"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Claude</span>
          </button>
        </div>

        {/* Search trigger button */}
        <button
          onClick={() => {
            onOpenSearch();
            if (onCloseMobile) onCloseMobile();
          }}
          className="w-full flex items-center justify-between px-2.5 py-1.5 bg-secondary/30 hover:bg-secondary/60 border border-border/60 rounded-md text-xs text-muted-foreground transition group"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground" />
            <span>하이브리드 검색...</span>
          </div>
          <kbd className="px-1.5 py-0.5 bg-muted text-[10px] rounded border border-border/80 font-mono">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Explorer Tree */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          <span>문서 탐색기</span>
          <div className="flex items-center gap-1">
            {onOpenUpload && currentTopic && (
              <button
                onClick={onOpenUpload}
                title="저장소에 파일 직접 올리기"
                className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onRefresh}
              title="동기화 및 새로고침"
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
            <button
              onClick={() => {
                onOpenCreatePage();
                if (onCloseMobile) onCloseMobile();
              }}
              title="새 마크다운 문서 생성"
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {tree.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            {currentTopic ? "문서가 없습니다." : "주제를 선택하세요."}
          </div>
        ) : (
          tree.map((item) => renderTreeItem(item, 0))
        )}
      </div>

      {/* Footer / Topic Info & User Profile */}
      <div className="border-t border-border bg-card/60 divide-y divide-border/60">
        {currentTopic && (
          <div>
            <div className="p-2.5 text-xs flex items-center justify-between text-muted-foreground gap-2">
              <div className="truncate flex-1 flex items-center gap-1.5">
                <span className="font-semibold text-foreground">{currentTopic.page_count}</span>개 문서
                {currentTopic.is_git_repo && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    <GitBranch className="w-2.5 h-2.5" />
                    <span>Git</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {currentTopic.is_git_repo && (
                  <button
                    onClick={handleGitPull}
                    disabled={pulling}
                    title="원격 Git 저장소에서 최신 변경사항 가져오기 (Git Pull)"
                    className={`p-1 hover:text-sky-400 transition rounded ${pulling ? "text-sky-400 animate-spin" : ""}`}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => {
                    if (confirm(`'${currentTopic.title}' 주제 저장소를 삭제하시겠습니까?`)) {
                      onDeleteTopic(currentTopic.id);
                      if (onCloseMobile) onCloseMobile();
                    }
                  }}
                  title="저장소 삭제"
                  className="p-1 hover:text-destructive transition rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {pullMsg && (
              <div className="px-2.5 py-1 text-[10px] bg-sky-500/10 text-sky-300 border-t border-sky-500/20 truncate">
                {pullMsg}
              </div>
            )}
          </div>
        )}

        {/* User Auth Profile Card */}
        <div className="p-2.5 flex items-center justify-between gap-2">
          {user ? (
            <>
              <div className="flex items-center gap-2 truncate flex-1">
                <div className="w-7 h-7 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div className="truncate flex flex-col">
                  <span className="text-xs font-semibold text-foreground truncate">{user.username}</span>
                  <div className="flex items-center gap-1">
                    {user.isAdmin ? (
                      <span className="text-[10px] px-1 py-0.2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded font-medium">
                        ADMIN
                      </span>
                    ) : (
                      <span className="text-[10px] px-1 py-0.2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-medium">
                        USER
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={logout}
                title="로그아웃"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={login}
              className="w-full py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5"
            >
              <User className="w-3.5 h-3.5" />
              <span>k71style.xyz 로그인</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Permanent) */}
      <aside className="hidden md:flex w-64 bg-card border-r border-border flex-col h-full shrink-0">
        {sidebarContent(false)}
      </aside>

      {/* Mobile Drawer (Overlay) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          {/* Drawer Panel */}
          <div className="relative w-72 max-w-[85vw] bg-card border-r border-border h-full shadow-2xl z-10 flex flex-col animate-in slide-in-from-left duration-200">
            {sidebarContent(true)}
          </div>
        </div>
      )}
    </>
  );
}

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
} from "lucide-react";
import { TopicInfo, TopicTreeItem } from "@/types";

interface SidebarProps {
  topics: TopicInfo[];
  currentTopic: TopicInfo | null;
  tree: TopicTreeItem[];
  currentPath: string | null;
  onSelectTopic: (topic: TopicInfo) => void;
  onSelectPage: (path: string) => void;
  onOpenCreateTopic: () => void;
  onOpenCreatePage: (parentDir?: string) => void;
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
  onOpenSearch,
  onRefresh,
  onDeleteTopic,
  activeTab,
  onTabChange,
  isMobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    concepts: true,
    sources: true,
  });

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
            <button
              onClick={onRefresh}
              title="동기화 및 새로고침"
              className="p-1 hover:text-foreground rounded"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
            <button
              onClick={() => {
                onOpenCreatePage();
                if (onCloseMobile) onCloseMobile();
              }}
              title="새 마크다운 문서 생성"
              className="p-1 hover:text-foreground rounded"
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

      {/* Footer / Info */}
      {currentTopic && (
        <div className="p-2.5 border-t border-border bg-card/50 text-xs flex items-center justify-between text-muted-foreground">
          <div className="truncate flex-1">
            <span className="font-semibold text-foreground">{currentTopic.page_count}</span>개 문서
          </div>
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
      )}
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

"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  fetchTopics,
  fetchTopicTree,
  fetchPage,
  savePage,
  deletePage,
  deleteTopic,
  fetchKnowledgeGraph,
  getWebSocketUrl,
} from "@/lib/api";
import { TopicInfo, TopicTreeItem, PageDetail, KnowledgeGraphData, GraphNode } from "@/types";
import { Sidebar } from "@/components/layout/sidebar";
import { WikiEditor } from "@/components/wiki/wiki-editor";
import { BacklinksPanel } from "@/components/wiki/backlinks-panel";
import { CreateTopicDialog } from "@/components/topic/create-topic-dialog";
import { SearchDialog } from "@/components/search/search-dialog";
import { BookOpen, Menu, Search, Plus, Network, Terminal, User as UserIcon } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

// Client-only dynamic imports for canvas / terminal / markdown rendering
const WikiViewer = dynamic(
  () => import("@/components/wiki/wiki-viewer").then((mod) => mod.WikiViewer),
  { ssr: false }
);

const KnowledgeGraph = dynamic(
  () => import("@/components/graph/knowledge-graph").then((mod) => mod.KnowledgeGraph),
  { ssr: false }
);

const ClaudeHybridView = dynamic(
  () => import("@/components/claude/claude-hybrid-view").then((mod) => mod.ClaudeHybridView),
  { ssr: false }
);

export default function Home() {
  const { user } = useAuth();
  const [topics, setTopics] = useState<TopicInfo[]>([]);
  const [currentTopic, setCurrentTopic] = useState<TopicInfo | null>(null);
  const [tree, setTree] = useState<TopicTreeItem[]>([]);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<PageDetail | null>(null);
  const [graphData, setGraphData] = useState<KnowledgeGraphData>({ nodes: [], links: [] });
  
  const [activeTab, setActiveTab] = useState<"wiki" | "graph" | "claude">("wiki");
  const [isEditing, setIsEditing] = useState(false);
  const [isCreateTopicOpen, setIsCreateTopicOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load topics on mount
  const loadTopics = useCallback(async (selectId?: string) => {
    try {
      setLoading(true);
      const list = await fetchTopics();
      setTopics(list);
      if (list.length > 0) {
        const target = selectId
          ? list.find((t) => t.id === selectId) || list[0]
          : currentTopic
          ? list.find((t) => t.id === currentTopic.id) || list[0]
          : list[0];
        setCurrentTopic(target);
      } else {
        setCurrentTopic(null);
      }
    } catch (err) {
      console.error("Error loading topics:", err);
    } finally {
      setLoading(false);
    }
  }, [currentTopic]);

  useEffect(() => {
    loadTopics();
  }, []);

  // Load topic contents when currentTopic changes
  const loadTopicContents = useCallback(async () => {
    if (!currentTopic) {
      setTree([]);
      setCurrentPage(null);
      setGraphData({ nodes: [], links: [] });
      return;
    }

    try {
      const treeData = await fetchTopicTree(currentTopic.id);
      setTree(treeData);

      const graph = await fetchKnowledgeGraph(currentTopic.id);
      setGraphData(graph);

      // Select INDEX.md by default if nothing selected or topic changed
      if (!currentPath || !treeData.some((i) => i.path === currentPath)) {
        const defaultPage = "INDEX.md";
        setCurrentPath(defaultPage);
        const page = await fetchPage(currentTopic.id, defaultPage);
        setCurrentPage(page);
      } else {
        const page = await fetchPage(currentTopic.id, currentPath);
        setCurrentPage(page);
      }
    } catch (err) {
      console.error("Error loading topic contents:", err);
    }
  }, [currentTopic, currentPath]);

  useEffect(() => {
    loadTopicContents();
  }, [currentTopic]);

  // Real-time Event Feed WebSocket
  useEffect(() => {
    const ws = new WebSocket(getWebSocketUrl("/ws/events"));
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "file_change" && currentTopic && data.topic_id === currentTopic.id) {
          // Refresh tree & graph
          fetchTopicTree(currentTopic.id).then(setTree);
          fetchKnowledgeGraph(currentTopic.id).then(setGraphData);
          if (currentPath && data.path.endsWith(currentPath)) {
            fetchPage(currentTopic.id, currentPath).then(setCurrentPage);
          }
        }
      } catch {}
    };
    return () => ws.close();
  }, [currentTopic, currentPath]);

  // Global Ctrl+K Shortcut for Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Select page
  const handleSelectPage = async (path: string) => {
    if (!currentTopic) return;
    try {
      setCurrentPath(path);
      setIsEditing(false);
      const page = await fetchPage(currentTopic.id, path);
      setCurrentPage(page);
    } catch (err) {
      console.error("Error selecting page:", err);
    }
  };

  // Save page
  const handleSavePage = async (content: string) => {
    if (!currentTopic || !currentPath) return;
    try {
      const updated = await savePage(currentTopic.id, currentPath, content);
      setCurrentPage(updated);
      setIsEditing(false);
      const treeData = await fetchTopicTree(currentTopic.id);
      setTree(treeData);
      const graph = await fetchKnowledgeGraph(currentTopic.id);
      setGraphData(graph);
    } catch (err) {
      console.error("Error saving page:", err);
      alert("페이지 저장 실패: " + err);
    }
  };

  // Delete page
  const handleDeletePage = async () => {
    if (!currentTopic || !currentPath) return;
    if (confirm(`'${currentPath}' 문서를 삭제하시겠습니까?`)) {
      await deletePage(currentTopic.id, currentPath);
      setIsEditing(false);
      handleSelectPage("INDEX.md");
    }
  };

  // Create page
  const handleOpenCreatePage = (parentDir: string = "concepts") => {
    const title = prompt("새 마크다운 문서 이름을 입력하세요 (예: rag-evaluation):");
    if (!title) return;
    const cleanSlug = title.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-");
    const newPath = `${parentDir}/${cleanSlug}.md`;
    const initialContent = `---\ntitle: ${title.trim()}\ntags: [new]\n---\n\n# ${title.trim()}\n\n새로운 지식 내용을 작성하세요. [[INDEX.md]]\n`;
    
    if (currentTopic) {
      savePage(currentTopic.id, newPath, initialContent).then((page) => {
        setCurrentPath(newPath);
        setCurrentPage(page);
        setIsEditing(true);
        setActiveTab("wiki");
        fetchTopicTree(currentTopic.id).then(setTree);
      });
    }
  };

  // Delete Topic
  const handleDeleteTopic = async (topicId: string) => {
    await deleteTopic(topicId, true);
    await loadTopics();
  };

  // Navigate to wikilink target
  const handleNavigateWikilink = (target: string) => {
    if (!currentTopic) return;
    const cleanTarget = target.endsWith(".md") ? target : `${target}.md`;
    const found = tree.find(
      (item) =>
        item.path === target ||
        item.path === cleanTarget ||
        item.path.endsWith(`/${cleanTarget}`) ||
        item.title?.toLowerCase() === target.toLowerCase()
    );

    if (found) {
      handleSelectPage(found.path);
    } else {
      if (confirm(`'${target}' 문서를 새로 만드시겠습니까?`)) {
        handleOpenCreatePage("concepts");
      }
    }
  };

  // Handle Graph Node Click
  const handleGraphNodeClick = (node: GraphNode) => {
    handleSelectPage(node.path);
    setActiveTab("wiki");
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-background">
      {/* Mobile Top Header */}
      <header className="md:hidden h-12 bg-card border-b border-border flex items-center justify-between px-3 shrink-0 z-30 select-none">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition"
            aria-label="탐색기 열기"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1.5 font-bold text-xs truncate max-w-[200px]">
            <div className="w-5 h-5 rounded bg-primary/20 text-primary flex items-center justify-center shrink-0">
              <BookOpen className="w-3 h-3" />
            </div>
            <span className="truncate text-foreground">
              {currentTopic ? currentTopic.title : "LLM-Wiki"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {user && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/80 border border-border text-[11px] text-foreground font-medium">
              <UserIcon className="w-3 h-3 text-indigo-400" />
              <span className="truncate max-w-[60px]">{user.username}</span>
            </div>
          )}
          <button
            onClick={() => handleOpenCreatePage()}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition"
            title="새 문서 작성"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsSearchOpen(true)}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition"
            title="검색"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Sidebar (Desktop Permanent + Mobile Slide Drawer) */}
      <Sidebar
        topics={topics}
        currentTopic={currentTopic}
        tree={tree}
        currentPath={currentPath}
        onSelectTopic={(t) => setCurrentTopic(t)}
        onSelectPage={handleSelectPage}
        onOpenCreateTopic={() => setIsCreateTopicOpen(true)}
        onOpenCreatePage={handleOpenCreatePage}
        onOpenSearch={() => setIsSearchOpen(true)}
        onRefresh={loadTopicContents}
        onDeleteTopic={handleDeleteTopic}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Center & Right Workspace */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {!currentTopic ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
              <BookOpen className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-foreground mb-2">
              주제별 위키 저장소를 생성해 보세요
            </h2>
            <p className="text-xs max-w-sm mb-6 text-muted-foreground leading-relaxed">
              LLM과 함께 주제별 지식 베이스를 구축하고 Claude Code CLI와 연동하여 자율적으로 지식을 확장하세요.
            </p>
            <button
              onClick={() => setIsCreateTopicOpen(true)}
              className="px-4 py-2 bg-primary text-primary-foreground font-semibold text-xs rounded-lg hover:bg-primary/90 transition shadow-md"
            >
              새 주제 저장소 만들기
            </button>
          </div>
        ) : activeTab === "wiki" ? (
          <div className="flex-1 flex h-full overflow-hidden">
            {isEditing && currentPage ? (
              <WikiEditor
                page={currentPage}
                onSave={handleSavePage}
                onCancel={() => setIsEditing(false)}
                onDelete={handleDeletePage}
              />
            ) : currentPage ? (
              <>
                <WikiViewer
                  page={currentPage}
                  onEdit={() => setIsEditing(true)}
                  onNavigateWikilink={handleNavigateWikilink}
                />
                <BacklinksPanel
                  page={currentPage}
                  onNavigate={handleNavigateWikilink}
                />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
                문서를 선택해 주세요.
              </div>
            )}
          </div>
        ) : activeTab === "graph" ? (
          <KnowledgeGraph
            data={graphData}
            onNodeClick={handleGraphNodeClick}
            onRefresh={() => fetchKnowledgeGraph(currentTopic.id).then(setGraphData)}
          />
        ) : (
          <ClaudeHybridView topic={currentTopic} />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden h-14 bg-card border-t border-border flex items-center justify-around shrink-0 z-30 select-none">
        <button
          onClick={() => setActiveTab("wiki")}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[11px] font-medium transition ${
            activeTab === "wiki"
              ? "text-primary font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookOpen className="w-4 h-4 mb-0.5" />
          <span>위키</span>
        </button>

        <button
          onClick={() => setActiveTab("graph")}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[11px] font-medium transition ${
            activeTab === "graph"
              ? "text-primary font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Network className="w-4 h-4 mb-0.5" />
          <span>그래프</span>
        </button>

        <button
          onClick={() => setActiveTab("claude")}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[11px] font-medium transition ${
            activeTab === "claude"
              ? "text-primary font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Terminal className="w-4 h-4 mb-0.5" />
          <span>Claude</span>
        </button>

        <button
          onClick={() => setIsSearchOpen(true)}
          className="flex flex-col items-center justify-center flex-1 h-full py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition"
        >
          <Search className="w-4 h-4 mb-0.5" />
          <span>검색</span>
        </button>
      </nav>

      {/* Modals */}
      <CreateTopicDialog
        isOpen={isCreateTopicOpen}
        onClose={() => setIsCreateTopicOpen(false)}
        onTopicCreated={(topic) => loadTopics(topic.id)}
      />

      <SearchDialog
        isOpen={isSearchOpen}
        topicId={currentTopic?.id || null}
        onClose={() => setIsSearchOpen(false)}
        onSelectResult={handleSelectPage}
      />
    </div>
  );
}

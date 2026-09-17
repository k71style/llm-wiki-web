import {
  TopicInfo,
  TopicTreeItem,
  PageDetail,
  SearchResultItem,
  KnowledgeGraphData,
} from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

export function getWebSocketUrl(path: string): string {
  if (typeof window === "undefined") {
    return `ws://127.0.0.1:8000${path}`;
  }
  const isHttps = window.location.protocol === "https:";
  const wsProtocol = isHttps ? "wss:" : "ws:";
  
  // In local dev without reverse proxy on port 3000
  if (window.location.port === "3000") {
    return `${wsProtocol}//${window.location.hostname}:8000${path}`;
  }
  
  // In production (e.g. wiki.k71style.xyz)
  return `${wsProtocol}//${window.location.host}${path}`;
}

export async function fetchTopics(): Promise<TopicInfo[]> {
  const res = await fetch(`${API_BASE}/topics`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch topics");
  return res.json();
}

export async function createTopic(data: {
  name: string;
  title: string;
  description?: string;
  system_prompt?: string;
}): Promise<TopicInfo> {
  const res = await fetch(`${API_BASE}/topics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to create topic");
  }
  return res.json();
}

export async function deleteTopic(topicId: string, deleteFiles: boolean = false): Promise<void> {
  const res = await fetch(`${API_BASE}/topics/${topicId}?delete_files=${deleteFiles}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete topic");
}

export async function fetchTopicTree(topicId: string): Promise<TopicTreeItem[]> {
  const res = await fetch(`${API_BASE}/topics/${topicId}/tree`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch topic tree");
  return res.json();
}

export async function fetchPage(topicId: string, path: string): Promise<PageDetail> {
  const res = await fetch(`${API_BASE}/topics/${topicId}/pages?path=${encodeURIComponent(path)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch page ${path}`);
  return res.json();
}

export async function savePage(
  topicId: string,
  path: string,
  content: string
): Promise<PageDetail> {
  const res = await fetch(`${API_BASE}/topics/${topicId}/pages?path=${encodeURIComponent(path)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to save page");
  }
  return res.json();
}

export async function deletePage(topicId: string, path: string): Promise<void> {
  const res = await fetch(`${API_BASE}/topics/${topicId}/pages?path=${encodeURIComponent(path)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to delete page ${path}`);
}

export async function searchPages(
  topicId: string,
  query: string,
  mode: "hybrid" | "keyword" | "semantic" = "hybrid"
): Promise<SearchResultItem[]> {
  const res = await fetch(
    `${API_BASE}/topics/${topicId}/search?q=${encodeURIComponent(query)}&mode=${mode}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Search request failed");
  return res.json();
}

export async function fetchKnowledgeGraph(topicId: string): Promise<KnowledgeGraphData> {
  const res = await fetch(`${API_BASE}/topics/${topicId}/graph`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch knowledge graph");
  return res.json();
}

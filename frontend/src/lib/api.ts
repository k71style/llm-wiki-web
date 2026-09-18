import {
  TopicInfo,
  TopicGitImport,
  TopicTreeItem,
  PageDetail,
  SearchResultItem,
  KnowledgeGraphData,
} from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("jwtToken");
}

export function setStoredToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("jwtToken", token);
  // Also set cookie if not already set
  document.cookie = `jwtToken=${token}; path=/; max-age=604800; SameSite=Lax; Secure`;
}

export function clearStoredToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("jwtToken");
  document.cookie = "jwtToken=; path=/; max-age=0";
}

export function getWebSocketUrl(path: string): string {
  if (typeof window === "undefined") {
    return `ws://127.0.0.1:8000${path}`;
  }
  const isHttps = window.location.protocol === "https:";
  const wsProtocol = isHttps ? "wss:" : "ws:";
  
  const token = getStoredToken();
  const separator = path.includes("?") ? "&" : "?";
  const authQuery = token ? `${separator}token=${encodeURIComponent(token)}` : "";
  
  // In local dev without reverse proxy on port 3000
  if (window.location.port === "3000") {
    return `${wsProtocol}//${window.location.hostname}:8000${path}${authQuery}`;
  }
  
  // In production (e.g. wiki.k71style.xyz)
  return `${wsProtocol}//${window.location.host}${path}${authQuery}`;
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  
  const res = await fetch(url, {
    ...options,
    headers,
    credentials: "include", // Pass cookies (jwtToken) across requests
  });
  
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("UNAUTHORIZED");
    }
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || `Request failed with status ${res.status}`);
  }
  
  return res.json();
}

export interface AuthMeResponse {
  authenticated: boolean;
  user: {
    username: string;
    roles: string[];
    isAdmin: boolean;
  } | null;
  loginUrl: string;
}

export async function fetchAuthMe(): Promise<AuthMeResponse> {
  return apiFetch<AuthMeResponse>(`${API_BASE}/auth/me`, { cache: "no-store" });
}

export async function fetchTopics(): Promise<TopicInfo[]> {
  return apiFetch<TopicInfo[]>(`${API_BASE}/topics`, { cache: "no-store" });
}

export async function createTopic(data: {
  name: string;
  title: string;
  description?: string;
  system_prompt?: string;
}): Promise<TopicInfo> {
  return apiFetch<TopicInfo>(`${API_BASE}/topics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function importTopicFromGit(data: TopicGitImport): Promise<TopicInfo> {
  return apiFetch<TopicInfo>(`${API_BASE}/topics/import/git`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function pullTopic(topicId: string): Promise<{ success: boolean; output: string; message: string }> {
  return apiFetch<{ success: boolean; output: string; message: string }>(`${API_BASE}/topics/${topicId}/pull`, {
    method: "POST",
  });
}

export async function deleteTopic(topicId: string, deleteFiles: boolean = false): Promise<void> {
  return apiFetch<void>(`${API_BASE}/topics/${topicId}?delete_files=${deleteFiles}`, {
    method: "DELETE",
  });
}

export async function fetchTopicTree(topicId: string): Promise<TopicTreeItem[]> {
  return apiFetch<TopicTreeItem[]>(`${API_BASE}/topics/${topicId}/tree`, { cache: "no-store" });
}

export async function fetchPage(topicId: string, path: string): Promise<PageDetail> {
  return apiFetch<PageDetail>(`${API_BASE}/topics/${topicId}/pages?path=${encodeURIComponent(path)}`, {
    cache: "no-store",
  });
}

export async function savePage(
  topicId: string,
  path: string,
  content: string
): Promise<PageDetail> {
  return apiFetch<PageDetail>(`${API_BASE}/topics/${topicId}/pages?path=${encodeURIComponent(path)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

export async function deletePage(topicId: string, path: string): Promise<void> {
  return apiFetch<void>(`${API_BASE}/topics/${topicId}/pages?path=${encodeURIComponent(path)}`, {
    method: "DELETE",
  });
}

export async function searchPages(
  topicId: string,
  query: string,
  mode: "hybrid" | "keyword" | "semantic" = "hybrid"
): Promise<SearchResultItem[]> {
  return apiFetch<SearchResultItem[]>(
    `${API_BASE}/topics/${topicId}/search?q=${encodeURIComponent(query)}&mode=${mode}`,
    { cache: "no-store" }
  );
}

export async function fetchKnowledgeGraph(topicId: string): Promise<KnowledgeGraphData> {
  return apiFetch<KnowledgeGraphData>(`${API_BASE}/topics/${topicId}/graph`, { cache: "no-store" });
}

export interface UploadResultItem {
  filename: string;
  path: string;
  size: number;
  is_markdown: boolean;
  asset_url: string | null;
  markdown_link: string;
}

export interface UploadResponse {
  success: boolean;
  uploaded: UploadResultItem[];
  errors: { filename: string; error: string }[];
  message: string;
}

export async function uploadTopicFiles(
  topicId: string,
  files: File[],
  targetDir: string = "assets",
  overwrite: boolean = true
): Promise<UploadResponse> {
  const token = getStoredToken();
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const formData = new FormData();
  files.forEach((file) => {
    formData.append("files", file);
  });
  formData.append("target_dir", targetDir);
  formData.append("overwrite", String(overwrite));

  const res = await fetch(`${API_BASE}/topics/${topicId}/upload`, {
    method: "POST",
    headers,
    body: formData,
    credentials: "include",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Upload failed: ${res.statusText}`);
  }

  return res.json();
}


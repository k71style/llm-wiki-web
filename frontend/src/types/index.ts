export interface TopicInfo {
  id: string;
  name: string;
  title: string;
  description?: string;
  path: string;
  page_count: number;
  is_git_repo?: boolean;
  git_url?: string;
  owner?: string;
  assigned_users?: string[];
  is_public?: boolean;
  created_at: string;
  updated_at: string;
}

export interface TopicPermissionsUpdate {
  is_public: boolean;
  assigned_users: string[];
}

export interface TopicCreate {
  name: string;
  title: string;
  description?: string;
  system_prompt?: string;
  is_public?: boolean;
  assigned_users?: string[];
}

export interface TopicGitImport {
  git_url: string;
  name: string;
  title: string;
  description?: string;
  branch?: string;
  auth_username?: string;
  auth_token?: string;
  insecure_ssl?: boolean;
  depth?: number;
  is_public?: boolean;
  assigned_users?: string[];
}

export interface TopicTreeItem {
  name: string;
  path: string;
  type: "file" | "directory";
  title?: string;
  size?: number;
  children?: TopicTreeItem[];
}

export interface BacklinkItem {
  source_page_id: string;
  source_path: string;
  source_title: string;
  context_snippet?: string;
}

export interface PageDetail {
  id: string;
  topic_id: string;
  path: string;
  title: string;
  tags: string[];
  frontmatter: Record<string, any>;
  content: string;
  raw_content: string;
  outgoing_links: string[];
  incoming_links: BacklinkItem[];
  created_at?: string;
  updated_at?: string;
  word_count: number;
}

export interface SearchResultItem {
  page_id: string;
  topic_id: string;
  path: string;
  title: string;
  snippet: string;
  score: number;
  match_type: "keyword" | "semantic" | "hybrid";
  tags: string[];
}

export interface GraphNode {
  id: string;
  title: string;
  path: string;
  group: number;
  val: number;
  tags: string[];
}

export interface GraphLink {
  source: string;
  target: string;
  label?: string;
}

export interface KnowledgeGraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface ChatMessageItem {
  id: string;
  topic_id: string;
  username: string;
  role: "user" | "assistant" | "system";
  text: string;
  created_at: string;
}

export interface ChatHistoryResponse {
  topic_id: string;
  messages: ChatMessageItem[];
}


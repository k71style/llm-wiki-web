from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field

class TopicCreate(BaseModel):
    name: str = Field(..., description="Unique slug for the topic repository, e.g. ai-research")
    title: str = Field(..., description="Human readable title for the topic")
    description: Optional[str] = Field(None, description="Topic description")
    system_prompt: Optional[str] = Field(None, description="System prompt for Claude Code in this topic")
    is_public: Optional[bool] = Field(False, description="Whether this topic is accessible to all users")
    assigned_users: Optional[list[str]] = Field(default_factory=list, description="List of usernames assigned to this topic")

class TopicGitImport(BaseModel):
    git_url: str = Field(..., description="Git repository clone URL (e.g. https://github.com/user/repo.git)")
    name: str = Field(..., description="Unique slug for the topic repository, e.g. ai-research")
    title: str = Field(..., description="Human readable title for the topic")
    description: Optional[str] = Field(None, description="Topic description")
    branch: Optional[str] = Field(None, description="Branch to checkout (defaults to default branch)")
    auth_username: Optional[str] = Field(None, description="Optional username for Git authentication")
    auth_token: Optional[str] = Field(None, description="Optional GitHub/GitLab personal access token or password for private repos")
    insecure_ssl: Optional[bool] = Field(False, description="Disable SSL verification for self-signed certificates")
    depth: Optional[int] = Field(1, description="Git clone depth (1 for shallow clone)")
    is_public: Optional[bool] = Field(False, description="Whether this topic is accessible to all users")
    assigned_users: Optional[list[str]] = Field(default_factory=list, description="List of usernames assigned to this topic")

class TopicPermissionsUpdate(BaseModel):
    assigned_users: list[str] = Field(default_factory=list, description="List of usernames assigned to this topic")
    is_public: bool = Field(False, description="Whether this topic is accessible to all users")

class TopicInfo(BaseModel):
    id: str
    name: str
    title: str
    description: Optional[str] = None
    path: str
    page_count: int = 0
    is_git_repo: bool = False
    git_url: Optional[str] = None
    owner: Optional[str] = None
    assigned_users: list[str] = []
    is_public: bool = False
    created_at: datetime
    updated_at: datetime

class TopicTreeItem(BaseModel):
    name: str
    path: str
    type: str  # "file" | "directory"
    title: Optional[str] = None
    size: Optional[int] = None
    children: Optional[list["TopicTreeItem"]] = None

class PageMeta(BaseModel):
    id: str
    topic_id: str
    path: str  # relative path e.g. "concepts/rag.md"
    title: str
    tags: list[str] = []
    frontmatter: dict[str, Any] = {}
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    word_count: int = 0

class PageDetail(PageMeta):
    content: str
    raw_content: str
    outgoing_links: list[str] = []  # list of target page paths or titles
    incoming_links: list["BacklinkItem"] = []  # backlinks referencing this page

class BacklinkItem(BaseModel):
    source_page_id: str
    source_path: str
    source_title: str
    context_snippet: Optional[str] = None

class PageSaveRequest(BaseModel):
    content: str
    title: Optional[str] = None
    tags: Optional[list[str]] = None
    frontmatter: Optional[dict[str, Any]] = None

class SearchResultItem(BaseModel):
    page_id: str
    topic_id: str
    path: str
    title: str
    snippet: str
    score: float
    match_type: str  # "keyword" | "semantic" | "hybrid"
    tags: list[str] = []

class GraphNode(BaseModel):
    id: str
    title: str
    path: str
    group: int = 1
    val: int = 1  # node size based on connections
    tags: list[str] = []

class GraphLink(BaseModel):
    source: str
    target: str
    label: Optional[str] = None

class KnowledgeGraphData(BaseModel):
    nodes: list[GraphNode]
    links: list[GraphLink]

class MCPToolCall(BaseModel):
    name: str
    arguments: dict[str, Any]

class MCPRequest(BaseModel):
    jsonrpc: str = "2.0"
    id: Optional[Any] = None
    method: str
    params: Optional[dict[str, Any]] = None

class MCPResponse(BaseModel):
    jsonrpc: str = "2.0"
    id: Optional[Any] = None
    result: Optional[Any] = None
    error: Optional[dict[str, Any]] = None

class ChatMessageItem(BaseModel):
    id: str
    topic_id: str
    username: str
    role: str  # 'user' | 'assistant' | 'system'
    text: str
    created_at: datetime

class ChatHistoryResponse(BaseModel):
    topic_id: str
    messages: list[ChatMessageItem]


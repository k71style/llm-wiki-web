# [시스템 아키텍처 및 기술 설계서] LLM-Wiki Web & Claude Code CLI 연동

**문서 버전:** v1.0.0  
**작성일자:** 2026-09-15  
**상태:** 초안 (Draft)

---

## 1. 시스템 아키텍처 다이어그램

```mermaid
graph TD
    subgraph Frontend ["Frontend (Next.js / React)"]
        UI_Shell["App Shell & Navigation"]
        Topic_Explorer["Topic Repository Explorer"]
        Markdown_View["Markdown Viewer & Editor (GFM + KaTeX + Mermaid)"]
        Graph_View["Interactive Knowledge Graph (Force Graph)"]
        Terminal_View["Claude CLI Web Terminal (xterm.js + WebSockets)"]
        Chat_View["Structured Claude Chat UI"]
    end

    subgraph Backend ["Backend Core (FastAPI / Node.js)"]
        Router_API["REST API Router"]
        WS_Handler["WebSocket Manager (CLI Streaming)"]
        
        subgraph Services ["Core Services"]
            Topic_Svc["Topic Storage Service (FS/Git)"]
            Wiki_Parser["Wiki Parser (Frontmatter, [[Wikilinks]], Tags)"]
            Index_Svc["Indexing & Search Service (FTS5 + Embeddings)"]
            Claude_PTY["Claude Code CLI Process Manager (node-pty / pywinpty)"]
            MCP_Server["Built-in MCP Server (Tools for Claude Code)"]
        end
    end

    subgraph Storage ["Local Storage Engine"]
        Markdown_Files["Markdown Files (.md, assets)"]
        SQLite_DB["SQLite (Metadata, Links, FTS5)"]
        Vector_DB["Vector Store (Chroma / sqlite-vec)"]
    end

    subgraph CLI ["Host Environment"]
        Claude_Executable["claude (Claude Code CLI binary)"]
    end

    %% Connections
    Frontend <-->|HTTP / JSON| Router_API
    Frontend <-->|WebSocket Stream| WS_Handler
    
    Router_API --> Topic_Svc
    Router_API --> Wiki_Parser
    Router_API --> Index_Svc
    
    WS_Handler --> Claude_PTY
    Claude_PTY <-->|Stdio / PTY Stream| Claude_Executable
    Claude_Executable <-->|MCP Protocol (JSON-RPC)| MCP_Server
    
    Topic_Svc --> Markdown_Files
    Wiki_Parser --> SQLite_DB
    Index_Svc --> SQLite_DB
    Index_Svc --> Vector_DB
    MCP_Server --> Index_Svc
    MCP_Server --> Topic_Svc
```

---

## 2. Claude Code CLI 연동 메커니즘 (상세 설계)

Claude Code CLI와의 연동은 **2가지 방식의 듀얼 아키텍처**로 설계합니다:

### 2.1 가상 터미널 스트리밍 (PTY Bridge)
- **원리**: 백엔드에서 `node-pty` (Node.js) 또는 `winpty/pywinpty` (Python)를 사용하여 Claude Code CLI(`claude`) 프로세스를 자식 프로세스로 스폰.
- **작업 디렉토리(CWD)**: 선택된 특정 주제 저장소 디렉토리(`~/llm-wikis/[topic-name]/`).
- **상호작용**:
  - 사용자 터미널 키 입력 및 화면 크기(Resize) 이벤트를 WebSocket을 통해 PTY로 전달.
  - ANSI 컬러 코드 및 TUI 출력을 브라우저의 `xterm.js`로 초저지연 실시간 스트리밍.
  - Claude Code의 대화형 프롬프트(Tool 승인, 질문 선택 등)를 웹에서 원활하게 조작 가능.

### 2.2 Built-in MCP (Model Context Protocol) Server 연동
- **원리**: LLM-Wiki 백엔드 자체가 MCP 서버 엔드포인트를 노출.
- **Claude Code 구성**: 주제 저장소의 `.claude.json` 또는 `CLAUDE.md`에 MCP 서버를 등록.
- **제공 툴(Tools)**:
  - `list_wiki_pages()`: 현재 주제의 모든 위키 문서 목록 및 태그 반환
  - `search_wiki(query, mode="hybrid")`: 키워드 및 의미 기반 검색 수행
  - `get_wiki_page(path)`: 특정 위키 문서 내용 및 양방향 링크 반환
  - `save_wiki_page(path, content)`: 위키 문서 신규 생성 또는 업데이트
  - `get_graph_neighbors(page_name)`: 연관 개념 노드 반환

---

## 3. 추천 기술 스택 (Tech Stack Options)

### 3.1 옵션 A: [추천] Python FastAPI + Next.js (하이브리드 모던 스택)
- **Backend**:
  - **Framework**: Python FastAPI (비동기 처리, 빠른 WebSocket, OpenAPI 자동화)
  - **CLI 연동**: `winpty` / `asyncio.subprocess` + WebSocket
  - **검색/임베딩**: SQLite (FTS5 + sqlite-vec) 또는 FastEmbed / ChromaDB
  - **장점**: AI/LLM 생태계 라이브러리(LangChain, LlamaIndex, Sentence-Transformers, MCP Python SDK)와의 결합이 가장 수월함.
- **Frontend**:
  - **Framework**: Next.js (App Router, TypeScript, React 19)
  - **UI Component**: Tailwind CSS + Shadcn UI + Lucide Icons
  - **터미널**: `@xterm/xterm` + `@xterm/addon-fit` + `@xterm/addon-web-links`
  - **그래프**: `react-force-graph` (2D/3D 지원)
  - **마크다운**: `react-markdown` + `remark-gfm` + `remark-math` + `rehype-katex` + `rehype-prism-plus`

### 3.2 옵션 B: Full TypeScript 스택 (Node.js / Express or Fastify + Next.js)
- **Backend**: Node.js (Fastify / NestJS) + `node-pty`
- **장점**: 단일 언어(TypeScript)로 프론트엔드와 백엔드를 일관되게 관리, `node-pty`의 풍부한 레퍼런스.

---

## 4. 데이터 플로우 (Data Flow)

### 4.1 위키 페이지 탐색 및 렌더링 플로우
1. 사용자가 웹에서 주제(`topic`) 선택
2. 백엔드가 해당 주제 디렉토리의 파일 트리 및 인덱스 캐시 반환
3. 사용자가 특정 마크다운 파일(`concept.md`) 선택
4. 백엔드가 Frontmatter 메타데이터, 마크다운 본문, 연결된 Backlinks 목록 응답
5. 프론트엔드가 수식, 위키링크, 다이어그램을 포함하여 실시간 렌더링

### 4.2 Claude Code CLI 질의 플로우
1. 사용자가 웹의 "Claude Code 대화" 탭 활성화
2. WebSocket 연결 생성 (`/ws/topics/:id/claude-cli`)
3. 백엔드가 `claude` CLI 프로세스 기동 (해당 위키 디렉토리를 CWD로 지정)
4. 사용자가 `"최근 추가된 RAG 논문들을 바탕으로 요약 위키 문서를 작성해줘"` 입력
5. Claude Code가 위키 디렉토리 내의 파일들을 직접 탐색/수정하거나 MCP 툴을 활용하여 신규 문서 작성
6. 파일시스템 감시자(File Watcher)가 파일 변경을 감지하고 웹 UI에 즉시 반영

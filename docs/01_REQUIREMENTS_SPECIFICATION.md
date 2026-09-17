# [요구사항 정의서] LLM-Wiki Web & Claude Code CLI 연동 서비스

**문서 버전:** v1.1.0 (사용자 선택 요구사항 확정본)  
**작성일자:** 2026-09-16  
**상태:** 승인 및 구현 대기 (Approved for Implementation)  

---

## 1. 프로젝트 개요 (Overview)

### 1.1 배경 및 목적
- **개념**: `llm-wiki`는 LLM과 사용자가 함께 구축하고 지속적으로 발전시키는 개인/팀 주제별 지식 베이스(Topic Knowledge Base)입니다.
- **목적**:
  1. 여러 **주제(Topic)별 위키 저장소**를 생성, 탐색, 관리할 수 있는 중앙 백엔드 및 웹 UI 제공.
  2. 마크다운 기반의 위키 문서, 양방향 링크(Backlinks), 목차, 태그, 지식 그래프(Knowledge Graph) 등을 직관적으로 시각화 및 검색.
  3. **Claude Code CLI**와의 유기적 연동을 통해, 위키 저장소를 컨텍스트로 삼아 대화를 나누고 지식을 생성·요약·수정할 수 있는 하이브리드(채팅+터미널) 인터페이스 구축.

---

## 2. 확정된 기술 스택 및 아키텍처 결정사항 (Confirmed Decisions)

| 구분 | 확정 사양 | 세부 내용 |
| :--- | :--- | :--- |
| **Backend** | **Python FastAPI** | 고성능 비동기 API, WebSocket 터미널 스트리밍, AI/임베딩 처리 및 내장 MCP 서버 |
| **Frontend** | **Next.js (App Router) + TypeScript** | React 19, Tailwind CSS, Shadcn UI, Lucide Icons |
| **CLI 상호작용** | **하이브리드 모드 (Hybrid View)** | 기본: 대화형 메신저 채팅 UI / 원클릭 전환: `xterm.js` 풀 컬러 CLI 터미널 |
| **위키 핵심 기능** | **Full Feature Set** | - 로컬 파일 실시간 감시 (File Watcher)<br>- `[[위키링크]]` & 역방향 링크(Backlinks) 자동 분석<br>- 인터랙티브 2D/3D 지식 그래프<br>- Claude Code 전용 내장 MCP 서버 |
| **검색 엔진** | **하이브리드 검색 (Hybrid Search)** | SQLite FTS5 (키워드/BM25) + 경량 시맨틱 벡터 임베딩 결합 |

---

## 3. 기능적 요구사항 (Functional Requirements)

### 3.1 주제별 저장소 관리 (Topic Repository Management)
- **FR-1.1 (저장소 CRUD)**: 사용자는 주제(Topic, 예: `ai-research`, `system-architecture`, `project-wiki`)별 독립된 위키 저장소를 생성, 조회, 수정, 삭제할 수 있어야 합니다.
- **FR-1.2 (로컬 디렉토리 매핑 & 실시간 감시)**: 각 주제 저장소는 로컬 파일시스템 상의 독립된 디렉토리로 관리되며, `watchdog` 기반 파일 감시자를 통해 외부 편집기(VS Code, Obsidian 등)에서 발생한 파일 추가/수정/삭제를 웹 UI에 실시간(SSE/WebSocket) 반영합니다.
- **FR-1.3 (주제별 설정 관리)**: 주제별 시스템 프롬프트, 인덱싱 규칙, 임베딩 설정 등을 `.wiki/config.json`으로 격리 관리합니다.

### 3.2 llm-wiki 웹 뷰어 및 에디터 (Wiki Viewer & Editor)
- **FR-2.1 (마크다운 렌더링)**: GFM(GitHub Flavored Markdown), 수식(KaTeX), 다이어그램(Mermaid), 코드 하이라이팅, 콜아웃(Alerts) 완벽 지원.
- **FR-2.2 (위키링크 및 양방향 링크)**: `[[문서명]]` 위키링크 파싱 및 클릭 이동, 현재 문서를 참조하는 역방향 링크(Backlinks) 목록 실시간 표시.
- **FR-2.3 (지식 그래프 시각화)**: 문서와 개념 간의 연결 관계를 인터랙티브 2D/3D 노드-링크 포스 그래프(Force-directed Graph)로 시각화.
- **FR-2.4 (하이브리드 검색)**:
  - FTS5 기반 키워드 전문 검색
  - 로컬 임베딩 모델 기반 의미론적 시맨틱 검색
  - RRF(Reciprocal Rank Fusion) 기반 하이브리드 랭킹 결과 반환
- **FR-2.5 (에디터 기능)**: 분할 뷰(Split View) 마크다운 실시간 편집 및 이미지/첨부파일 지원.

### 3.3 Claude Code CLI 연동 (Claude Code CLI Integration)
- **FR-3.1 (가상 터미널 스트리밍)**: 백엔드에서 `winpty`/`pywinpty`(또는 서브프로세스 파이프)를 통해 Claude Code CLI(`claude`) 프로세스를 스폰하고, 웹소켓으로 브라우저의 `xterm.js` 터미널에 양방향 I/O 스트리밍.
- **FR-3.2 (하이브리드 UI 지원)**:
  - **채팅 모드**: CLI의 텍스트/코드 출력을 파싱하여 읽기 쉬운 메신저 형태 말풍선으로 렌더링.
  - **터미널 모드**: Claude Code의 대화형 프롬프트(Tool 승인, 화살표 선택지 등)를 직접 조작할 수 있는 풀 터미널 화면 제공.
- **FR-3.3 (내장 MCP 서버)**:
  - 백엔드가 Claude Code와 통신할 수 있는 MCP(Model Context Protocol) 엔드포인트를 제공하여, Claude Code가 `search_wiki`, `read_wiki_page`, `write_wiki_page`, `get_backlinks` 도구를 자율적으로 호출 가능하도록 지원.

---

## 4. 데이터베이스 및 스토리지 구조

### 4.1 메타데이터 및 인덱스 (SQLite)
```sql
-- 문서 메타데이터
CREATE TABLE pages (
    id TEXT PRIMARY KEY,
    topic_id TEXT NOT NULL,
    path TEXT NOT NULL,
    title TEXT NOT NULL,
    tags TEXT,
    updated_at TIMESTAMP
);

-- 양방향 링크 관계
CREATE TABLE wiki_links (
    source_page_id TEXT NOT NULL,
    target_page_id TEXT NOT NULL,
    link_text TEXT,
    PRIMARY KEY (source_page_id, target_page_id)
);

-- 전문 검색 테이블 (FTS5)
CREATE VIRTUAL TABLE pages_fts USING fts5(
    page_id UNINDEXED,
    topic_id UNINDEXED,
    title,
    content,
    tags
);
```

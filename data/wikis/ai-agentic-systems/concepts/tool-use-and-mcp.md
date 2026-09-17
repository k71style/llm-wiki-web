---
title: Tool Use and MCP (Model Context Protocol)
tags: [mcp, tools, claude-code]
---

# Tool Use and MCP (Model Context Protocol)

**MCP (Model Context Protocol)** 는 LLM 및 AI 에이전트가 로컬 또는 원격 시스템의 도구(Tools), 리소스(Resources), 프롬프트(Prompts)를 표준화된 JSON-RPC 프로토콜을 통해 안전하게 활용할 수 있도록 지원하는 개방형 프로토콜입니다.

## 🛠️ LLM-Wiki의 내장 MCP 도구
- `list_wiki_pages`: 위키 내 모든 문서 목록 탐색
- `read_wiki_page`: 특정 마크다운 본문 및 메타데이터 조회
- `write_wiki_page`: 신규 위키 문서 작성 및 업데이트
- `search_wiki`: 하이브리드(키워드 + 시맨틱) 검색
- `get_backlinks`: 양방향 역참조 링크 분석

Claude Code CLI는 위 도구들을 자율적으로 활용하여 [[자율형 에이전트 시스템 (Autonomous Agents)]] 구축을 가속화합니다.

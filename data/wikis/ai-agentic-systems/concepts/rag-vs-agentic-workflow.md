---
title: RAG vs Agentic Workflow 비교
tags: [rag, vector-search, comparison]
---

# RAG vs Agentic Workflow

단순 검색 증강 생성(Naive RAG)과 에이전틱 워크플로우(Agentic RAG)의 차이점을 분석합니다.

| 구분 | Naive RAG | Agentic Workflow |
| :--- | :--- | :--- |
| **검색 횟수** | 1회성 정적 검색 | 다단계 동적 검색 및 재시도 |
| **질의 변형** | 원본 질의 그대로 임베딩 | 질의 분해(Query Decomposition) 및 재작성 |
| **오류 수정** | 불가 (환각 가능성) | 자가 수정(Self-Correction) 및 검증 |
| **도구 연동** | 문서 검색 전용 | [[Tool Use and MCP]] 기반 다중 도구 실행 |

## 💡 연관 개념
- [[자율형 에이전트 시스템 (Autonomous Agents)]]
- [[INDEX.md]]

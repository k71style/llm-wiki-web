import asyncio
import os
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.core.config import settings
from backend.app.db.database import db
from backend.app.models.schemas import TopicCreate
from backend.app.services.topic_service import topic_service

SAMPLE_AGENTS_MD = """---
title: 자율형 에이전트 시스템 (Autonomous Agents)
tags: [agent, architecture, llm, planning]
---

# 자율형 에이전트 시스템 (Autonomous Agents)

자율형 에이전트는 목표(Goal)가 주어졌을 때 환경을 인지(Perception)하고, 계획을 수립(Planning)하며, 도구를 활용(Action/Tool Use)하여 스스로 문제를 해결하는 AI 시스템입니다.

## 🏗️ 핵심 구성 요소
1. **Planning (계획 수립)**: 작업을 세부 하위 작업으로 분해하고 반성(Reflection)을 수행.
2. **Memory (메모리)**: 단기 메모리(대화 컨텍스트) 및 장기 메모리(벡터 DB / [[RAG vs Agentic Workflow]]).
3. **Tool Use (도구 활용)**: 외부 API 및 CLI, [[Tool Use and MCP|MCP(Model Context Protocol)]] 도구 호출.

## 🔄 에이전트 추론 루프 (ReAct Loop)

```mermaid
graph TD
    Goal["사용자 목표 (Goal)"] --> Plan["계획 수립 (Planner)"]
    Plan --> Action["도구 실행 (Tool Execution)"]
    Action --> Observe["결과 관찰 (Observation)"]
    Observe --> Reflect{"목표 달성 여부"}
    Reflect -- "미완료" --> Plan
    Reflect -- "완료" --> Final["최종 응답 (Final Answer)"]
```

## 📐 최적화 수식 (KaTeX)
에이전트의 목표 기대 효용 함수는 다음과 같이 표현할 수 있습니다:
$$E[U] = \\sum_{t=0}^{T} \\gamma^t R(s_t, a_t)$$

여기서 $\\gamma \\in [0, 1)$ 는 감가율(discount factor)이며, $R(s_t, a_t)$ 는 상태 $s_t$ 에서 행동 $a_t$ 를 취했을 때의 보상입니다.

## 🔗 연관 문서
- [[INDEX.md|위키 홈으로 돌아가기]]
- [[RAG vs Agentic Workflow]]
- [[Tool Use and MCP]]
"""

SAMPLE_RAG_MD = """---
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
"""

SAMPLE_MCP_MD = """---
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
"""

async def seed():
    print("Initializing DB for seed...", flush=True)
    await db.init_db()
    existing = await topic_service.get_topic("ai-agentic-systems")
    if not existing:
        print("Creating topic 'ai-agentic-systems'...", flush=True)
        topic_in = TopicCreate(
            name="ai-agentic-systems",
            title="AI Agentic Systems & LLM Wiki",
            description="자율형 AI 에이전트, RAG, 지식 그래프 및 MCP 아키텍처 연구 위키 저장소",
            system_prompt="Always create structured markdown pages with KaTeX math and Mermaid diagrams."
        )
        topic = await topic_service.create_topic(topic_in)
        print("Saving concept pages...", flush=True)
        await topic_service.save_page(topic.id, "concepts/autonomous-agents.md", SAMPLE_AGENTS_MD)
        await topic_service.save_page(topic.id, "concepts/rag-vs-agentic-workflow.md", SAMPLE_RAG_MD)
        await topic_service.save_page(topic.id, "concepts/tool-use-and-mcp.md", SAMPLE_MCP_MD)
        print(f"Sample topic seeded successfully: {topic.title} ({topic.id})", flush=True)
    else:
        print(f"Sample topic already exists: {existing.title}", flush=True)
    await db.close()

if __name__ == "__main__":
    asyncio.run(seed())

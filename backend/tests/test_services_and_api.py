import shutil
import tempfile
import pytest
from pathlib import Path

from backend.app.core.config import settings
from backend.app.db.database import db
from backend.app.models.schemas import TopicCreate, MCPRequest
from backend.app.services.topic_service import topic_service
from backend.app.services.index_service import index_service
from backend.app.services.mcp_server import mcp_server

@pytest.fixture(scope="module")
def temp_dir():
    d = Path(tempfile.mkdtemp())
    yield d
    shutil.rmtree(d, ignore_errors=True)

@pytest.mark.asyncio
async def test_full_wiki_flow(temp_dir):
    # Setup isolated test database & data dir
    test_db_path = temp_dir / "test.db"
    settings.DATA_DIR = temp_dir / "wikis"
    settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    # Close any existing connection and re-point
    await db.close()
    db.db_path = test_db_path
    await db.init_db()
    
    # 1. Create Topic
    topic_in = TopicCreate(
        name="test-ai",
        title="AI Research Wiki",
        description="Testing knowledge base flow"
    )
    topic = await topic_service.create_topic(topic_in)
    assert topic.name == "test-ai"
    assert topic.page_count >= 2  # INDEX.md and getting-started.md
    
    # 2. Add New Page with bidirectional link
    page_content = """---
title: Agentic Architectures
tags: [agents, llm]
---

# Agentic Architectures

Agentic architectures use [[Getting Started]] and [[INDEX.md]] to structure workflows.
"""
    saved_page = await topic_service.save_page(topic.id, "concepts/agentic.md", page_content)
    assert saved_page.title == "Agentic Architectures"
    assert "agents" in saved_page.tags
    assert len(saved_page.outgoing_links) == 2
    
    # 3. Check Backlinks on Getting Started
    getting_started = await topic_service.get_page_detail(topic.id, "concepts/getting-started.md")
    assert getting_started is not None
    source_titles = [b.source_title for b in getting_started.incoming_links]
    assert "Agentic Architectures" in source_titles
    
    # 4. Test Search
    results = await index_service.search(topic.id, "Agentic workflows", mode="hybrid")
    assert len(results) > 0
    assert any("Agentic" in r.title for r in results)
    
    # 5. Test MCP Tools
    mcp_req = MCPRequest(
        id=1,
        method="tools/call",
        params={
            "name": "search_wiki",
            "arguments": {
                "topic_id": topic.id,
                "query": "Agentic",
                "mode": "hybrid"
            }
        }
    )
    mcp_resp = await mcp_server.handle_jsonrpc(mcp_req)
    assert mcp_resp.error is None
    assert mcp_resp.result is not None
    
    # Close db connection
    await db.close()

import json
import logging
from typing import Any
from backend.app.models.schemas import MCPRequest, MCPResponse
from backend.app.services.topic_service import topic_service
from backend.app.services.index_service import index_service

logger = logging.getLogger("llm_wiki.mcp")

TOOLS = [
    {
        "name": "list_wiki_pages",
        "description": "Lists all markdown pages in the current topic repository along with their paths, titles, and tags.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "topic_id": {"type": "string", "description": "The topic ID or topic name"}
            },
            "required": ["topic_id"]
        }
    },
    {
        "name": "read_wiki_page",
        "description": "Reads the markdown content, frontmatter metadata, and incoming backlinks for a specific wiki page.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "topic_id": {"type": "string", "description": "The topic ID or topic name"},
                "path": {"type": "string", "description": "Relative path of the page (e.g. concepts/rag.md or INDEX.md)"}
            },
            "required": ["topic_id", "path"]
        }
    },
    {
        "name": "write_wiki_page",
        "description": "Creates or updates a markdown page in the wiki repository.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "topic_id": {"type": "string", "description": "The topic ID or topic name"},
                "path": {"type": "string", "description": "Relative path of the page (e.g. concepts/agent-patterns.md)"},
                "content": {"type": "string", "description": "Markdown content including frontmatter and [[WikiLinks]]"}
            },
            "required": ["topic_id", "path", "content"]
        }
    },
    {
        "name": "search_wiki",
        "description": "Performs hybrid keyword + semantic search across the topic wiki repository.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "topic_id": {"type": "string", "description": "The topic ID or topic name"},
                "query": {"type": "string", "description": "Search query or natural language question"},
                "mode": {"type": "string", "enum": ["hybrid", "keyword", "semantic"], "default": "hybrid"}
            },
            "required": ["topic_id", "query"]
        }
    },
    {
        "name": "get_backlinks",
        "description": "Retrieves all wiki pages that link to the specified page or concept.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "topic_id": {"type": "string", "description": "The topic ID or topic name"},
                "page_name": {"type": "string", "description": "Title or path of the target page"}
            },
            "required": ["topic_id", "page_name"]
        }
    }
]

class MCPServer:
    async def handle_jsonrpc(self, req: MCPRequest) -> MCPResponse:
        req_id = req.id
        method = req.method
        params = req.params or {}

        try:
            if method == "initialize":
                return MCPResponse(
                    id=req_id,
                    result={
                        "protocolVersion": "2024-11-05",
                        "serverInfo": {
                            "name": "llm-wiki-mcp-server",
                            "version": "1.0.0"
                        },
                        "capabilities": {
                            "tools": {}
                        }
                    }
                )

            elif method == "tools/list":
                return MCPResponse(
                    id=req_id,
                    result={"tools": TOOLS}
                )

            elif method == "tools/call":
                tool_name = params.get("name")
                args = params.get("arguments", {})
                result_content = await self.execute_tool(tool_name, args)
                return MCPResponse(
                    id=req_id,
                    result={
                        "content": [
                            {"type": "text", "text": json.dumps(result_content, ensure_ascii=False, indent=2)}
                        ]
                    }
                )

            elif method == "ping":
                return MCPResponse(id=req_id, result={})

            else:
                return MCPResponse(
                    id=req_id,
                    error={"code": -32601, "message": f"Method not found: {method}"}
                )
        except Exception as e:
            logger.error(f"Error handling MCP method {method}: {e}", exc_info=True)
            return MCPResponse(
                id=req_id,
                error={"code": -32603, "message": str(e)}
            )

    async def execute_tool(self, name: str, args: dict[str, Any]) -> Any:
        topic_id = args.get("topic_id")
        topic = await topic_service.get_topic(topic_id)
        if not topic:
            return {"error": f"Topic '{topic_id}' not found"}

        if name == "list_wiki_pages":
            tree = await topic_service.get_topic_tree(topic.id)
            return {"topic": topic.name, "tree": [item.model_dump() for item in tree]}

        elif name == "read_wiki_page":
            path = args.get("path")
            page = await topic_service.get_page_detail(topic.id, path)
            if not page:
                return {"error": f"Page '{path}' not found in topic '{topic.name}'"}
            return page.model_dump(mode="json")

        elif name == "write_wiki_page":
            path = args.get("path")
            content = args.get("content")
            page = await topic_service.save_page(topic.id, path, content)
            return {"success": True, "page": page.model_dump(mode="json")}

        elif name == "search_wiki":
            query = args.get("query")
            mode = args.get("mode", "hybrid")
            results = await index_service.search(topic.id, query, mode=mode)
            return {"query": query, "results": [r.model_dump(mode="json") for r in results]}

        elif name == "get_backlinks":
            page_name = args.get("page_name")
            page = await topic_service.get_page_detail(topic.id, page_name)
            if page:
                return {"page": page_name, "incoming_links": [b.model_dump(mode="json") for b in page.incoming_links]}
            return {"error": f"Page '{page_name}' not found"}

        else:
            return {"error": f"Unknown tool name: {name}"}

mcp_server = MCPServer()

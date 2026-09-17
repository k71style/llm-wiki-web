import json
from collections import defaultdict
from fastapi import APIRouter, HTTPException, Depends
from backend.app.db.database import db
from backend.app.models.schemas import KnowledgeGraphData, GraphNode, GraphLink
from backend.app.services.topic_service import topic_service
from backend.app.security.jwt_auth import User, get_current_user

router = APIRouter(prefix="/topics/{topic_id}/graph", tags=["graph"])

@router.get("", response_model=KnowledgeGraphData)
async def get_knowledge_graph(topic_id: str, user: User = Depends(get_current_user)):
    topic = await topic_service.get_topic(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    database = await db.get_db()

    # 1. Fetch all pages
    nodes_map: dict[str, GraphNode] = {}
    connections = defaultdict(int)

    async with database.execute("""
        SELECT id, path, title, tags
        FROM pages
        WHERE topic_id = ?
    """, (topic.id,)) as cursor:
        pages = await cursor.fetchall()
        for p in pages:
            tags = []
            try:
                tags = json.loads(p["tags"]) if p["tags"].startswith("[") else p["tags"].split()
            except Exception:
                tags = p["tags"].split() if p["tags"] else []

            # Assign group based on directory
            parts = p["path"].split("/")
            group_id = hash(parts[0]) % 10 if len(parts) > 1 else 1

            nodes_map[p["id"]] = GraphNode(
                id=p["id"],
                title=p["title"],
                path=p["path"],
                group=group_id,
                val=1,
                tags=tags
            )

    # 2. Fetch all resolved links
    links: list[GraphLink] = []
    async with database.execute("""
        SELECT source_page_id, target_page_id, target_ref
        FROM wiki_links
        WHERE topic_id = ? AND target_page_id IS NOT NULL
    """, (topic.id,)) as cursor:
        rows = await cursor.fetchall()
        for r in rows:
            src = r["source_page_id"]
            tgt = r["target_page_id"]
            if src in nodes_map and tgt in nodes_map:
                links.append(GraphLink(
                    source=src,
                    target=tgt,
                    label=r["target_ref"]
                ))
                connections[src] += 1
                connections[tgt] += 1

    # Update node sizes based on connection degree
    for node_id, count in connections.items():
        if node_id in nodes_map:
            nodes_map[node_id].val = max(1, count * 2)

    return KnowledgeGraphData(
        nodes=list(nodes_map.values()),
        links=links
    )

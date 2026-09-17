import json
import logging
import os
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from backend.app.core.config import settings
from backend.app.db.database import db
from backend.app.models.schemas import TopicCreate, TopicInfo, TopicTreeItem, PageDetail, BacklinkItem
from backend.app.services.wiki_parser import parse_markdown

logger = logging.getLogger("llm_wiki.topic_service")

CLAUDE_MD_TEMPLATE = """# Claude Code Guidelines for Topic: {title}

You are an expert AI knowledge curator working on the `{name}` wiki repository.

## Repository Structure
- `INDEX.md`: Main index of the repository.
- `concepts/`: Deep-dive conceptual documentation and architectural explanations.
- `sources/`: Summaries of original papers, articles, transcriptions, and reference materials.
- `assets/`: Images, charts, and attachments.

## Wiki Linking Conventions
- Always link related concepts using bidirectional wiki links: `[[Concept Name]]` or `[[concepts/filename.md|Display Label]]`.
- Add meaningful tags using hashtags `#tag-name` or YAML frontmatter:
  ```yaml
  ---
  title: Page Title
  tags: [topic1, topic2]
  ---
  ```
- Keep `INDEX.md` updated with references to newly created concept pages.

## Custom Topic Instructions
{system_prompt}
"""

DEFAULT_INDEX_MD = """---
title: {title} - Index
tags: [index, {name}]
---

# {title}

Welcome to the **{title}** knowledge base.

## 📌 Overview
{description}

## 📚 Core Concepts
- [[Getting Started]]

## 🔗 Sources & References
- Add raw references in `sources/`

---
*Created automatically with LLM-Wiki Web.*
"""

DEFAULT_GETTING_STARTED_MD = """---
title: Getting Started
tags: [guide, onboarding]
---

# Getting Started with {title}

This is the first concept page in the `{name}` topic repository.

## 💡 How to use this Wiki
- You can create new markdown files in `concepts/` or `sources/`.
- Use `[[WikiLinks]]` to connect concepts (e.g. [[{title} - Index]]).
- Use Claude Code CLI in this directory or via the Web interface to automatically synthesize and expand knowledge.
"""

class TopicService:
    async def create_topic(self, topic_in: TopicCreate) -> TopicInfo:
        database = await db.get_db()
        topic_id = str(uuid.uuid4())
        topic_name = topic_in.name.strip().lower().replace(" ", "-")
        topic_dir = settings.DATA_DIR / topic_name
        
        # Check if topic already exists in DB
        async with database.execute("SELECT id FROM topics WHERE name = ?", (topic_name,)) as cursor:
            if await cursor.fetchone():
                raise ValueError(f"Topic with name '{topic_name}' already exists.")
                
        # Create directory structure
        topic_dir.mkdir(parents=True, exist_ok=True)
        (topic_dir / "concepts").mkdir(exist_ok=True)
        (topic_dir / "sources").mkdir(exist_ok=True)
        (topic_dir / "assets").mkdir(exist_ok=True)
        (topic_dir / ".wiki").mkdir(exist_ok=True)
        
        # Write config
        config_data = {
            "id": topic_id,
            "name": topic_name,
            "title": topic_in.title,
            "description": topic_in.description or "",
            "system_prompt": topic_in.system_prompt or ""
        }
        with open(topic_dir / ".wiki" / "config.json", "w", encoding="utf-8") as f:
            json.dump(config_data, f, indent=2, ensure_ascii=False)
            
        # Write CLAUDE.md
        claude_content = CLAUDE_MD_TEMPLATE.format(
            title=topic_in.title,
            name=topic_name,
            system_prompt=topic_in.system_prompt or "Maintain clarity and well-structured Markdown."
        )
        with open(topic_dir / "CLAUDE.md", "w", encoding="utf-8") as f:
            f.write(claude_content)
            
        # Write INDEX.md
        index_content = DEFAULT_INDEX_MD.format(
            title=topic_in.title,
            name=topic_name,
            description=topic_in.description or "A curated topic repository."
        )
        with open(topic_dir / "INDEX.md", "w", encoding="utf-8") as f:
            f.write(index_content)
            
        # Write Getting Started
        getting_started_content = DEFAULT_GETTING_STARTED_MD.format(
            title=topic_in.title,
            name=topic_name
        )
        with open(topic_dir / "concepts" / "getting-started.md", "w", encoding="utf-8") as f:
            f.write(getting_started_content)

        # Insert into DB
        now = datetime.now(timezone.utc).isoformat()
        await database.execute(
            """
            INSERT INTO topics (id, name, title, description, path, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (topic_id, topic_name, topic_in.title, topic_in.description, str(topic_dir), now, now)
        )
        await database.commit()
        
        # Scan and index the initial files
        await self.sync_topic(topic_id)
        
        return await self.get_topic(topic_id)

    async def list_topics(self) -> list[TopicInfo]:
        database = await db.get_db()
        async with database.execute("""
            SELECT t.id, t.name, t.title, t.description, t.path, t.created_at, t.updated_at,
                   COUNT(p.id) as page_count
            FROM topics t
            LEFT JOIN pages p ON t.id = p.topic_id
            GROUP BY t.id
            ORDER BY t.updated_at DESC
        """) as cursor:
            rows = await cursor.fetchall()
            return [
                TopicInfo(
                    id=row["id"],
                    name=row["name"],
                    title=row["title"],
                    description=row["description"],
                    path=row["path"],
                    page_count=row["page_count"],
                    created_at=datetime.fromisoformat(row["created_at"]) if isinstance(row["created_at"], str) else row["created_at"],
                    updated_at=datetime.fromisoformat(row["updated_at"]) if isinstance(row["updated_at"], str) else row["updated_at"],
                )
                for row in rows
            ]

    async def get_topic(self, topic_id: str) -> Optional[TopicInfo]:
        database = await db.get_db()
        async with database.execute("""
            SELECT t.id, t.name, t.title, t.description, t.path, t.created_at, t.updated_at,
                   COUNT(p.id) as page_count
            FROM topics t
            LEFT JOIN pages p ON t.id = p.topic_id
            WHERE t.id = ? OR t.name = ?
            GROUP BY t.id
        """, (topic_id, topic_id)) as cursor:
            row = await cursor.fetchone()
            if not row:
                return None
            return TopicInfo(
                id=row["id"],
                name=row["name"],
                title=row["title"],
                description=row["description"],
                path=row["path"],
                page_count=row["page_count"],
                created_at=datetime.fromisoformat(row["created_at"]) if isinstance(row["created_at"], str) else row["created_at"],
                updated_at=datetime.fromisoformat(row["updated_at"]) if isinstance(row["updated_at"], str) else row["updated_at"],
            )

    async def delete_topic(self, topic_id: str, delete_files: bool = False):
        topic = await self.get_topic(topic_id)
        if not topic:
            return
        database = await db.get_db()
        await database.execute("DELETE FROM topics WHERE id = ?", (topic.id,))
        await database.execute("DELETE FROM pages WHERE topic_id = ?", (topic.id,))
        await database.execute("DELETE FROM wiki_links WHERE topic_id = ?", (topic.id,))
        await database.execute("DELETE FROM pages_fts WHERE topic_id = ?", (topic.id,))
        await database.commit()
        
        if delete_files and Path(topic.path).exists():
            shutil.rmtree(topic.path, ignore_errors=True)

    async def sync_topic(self, topic_id: str):
        topic = await self.get_topic(topic_id)
        if not topic:
            return
        topic_path = Path(topic.path)
        if not topic_path.exists():
            return
            
        database = await db.get_db()
        
        # 1. Collect all markdown files
        existing_files: dict[str, Path] = {}
        for root, dirs, files in os.walk(topic_path):
            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ('node_modules', '__pycache__', 'venv', '.venv')]
            for file in files:
                if file.lower().endswith(('.md', '.markdown')):
                    full_p = Path(root) / file
                    rel_p = full_p.relative_to(topic_path).as_posix()
                    existing_files[rel_p] = full_p
                    
        # 2. Sync database records for pages
        for rel_path, full_path in existing_files.items():
            try:
                with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                    raw_content = f.read()
            except Exception as e:
                logger.error(f"Error reading {full_path}: {e}")
                continue
                
            parsed = parse_markdown(raw_content, fallback_name=full_path.stem)
            page_id = f"{topic.id}:{rel_path}"
            now = datetime.now(timezone.utc).isoformat()
            
            # Upsert into pages
            await database.execute("""
                INSERT INTO pages (id, topic_id, path, title, tags, frontmatter_json, word_count, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(topic_id, path) DO UPDATE SET
                    title = excluded.title,
                    tags = excluded.tags,
                    frontmatter_json = excluded.frontmatter_json,
                    word_count = excluded.word_count,
                    updated_at = excluded.updated_at
            """, (
                page_id,
                topic.id,
                rel_path,
                parsed.title,
                json.dumps(parsed.tags, ensure_ascii=False),
                json.dumps(parsed.frontmatter_data, ensure_ascii=False),
                parsed.word_count,
                now
            ))
            
            # Refresh FTS
            await database.execute("DELETE FROM pages_fts WHERE page_id = ?", (page_id,))
            await database.execute("""
                INSERT INTO pages_fts (page_id, topic_id, title, content, tags)
                VALUES (?, ?, ?, ?, ?)
            """, (
                page_id,
                topic.id,
                parsed.title,
                parsed.content,
                " ".join(parsed.tags)
            ))
            
            # Refresh outgoing links
            await database.execute("DELETE FROM wiki_links WHERE source_page_id = ?", (page_id,))
            for link in parsed.outgoing_links:
                await database.execute("""
                    INSERT INTO wiki_links (topic_id, source_page_id, target_ref, context_snippet)
                    VALUES (?, ?, ?, ?)
                """, (
                    topic.id,
                    page_id,
                    link["target"],
                    link["snippet"]
                ))

        # 3. Clean up deleted pages
        async with database.execute("SELECT id, path FROM pages WHERE topic_id = ?", (topic.id,)) as cursor:
            rows = await cursor.fetchall()
            for r in rows:
                if r["path"] not in existing_files:
                    await database.execute("DELETE FROM pages WHERE id = ?", (r["id"],))
                    await database.execute("DELETE FROM pages_fts WHERE page_id = ?", (r["id"],))
                    await database.execute("DELETE FROM wiki_links WHERE source_page_id = ? OR target_page_id = ?", (r["id"], r["id"]))
                    
        # 4. Resolve target_page_id in wiki_links
        await database.execute("""
            UPDATE wiki_links
            SET target_page_id = (
                SELECT p.id FROM pages p
                WHERE p.topic_id = wiki_links.topic_id
                AND (
                    p.title = wiki_links.target_ref
                    OR p.path = wiki_links.target_ref
                    OR p.path = wiki_links.target_ref || '.md'
                    OR LOWER(p.title) = LOWER(wiki_links.target_ref)
                )
                LIMIT 1
            )
            WHERE topic_id = ?
        """, (topic.id,))

        await database.commit()
        logger.info(f"Synchronized topic {topic.name}: {len(existing_files)} pages indexed.")

    async def get_topic_tree(self, topic_id: str) -> list[TopicTreeItem]:
        topic = await self.get_topic(topic_id)
        if not topic:
            return []
            
        topic_path = Path(topic.path)
        if not topic_path.exists():
            return []
            
        database = await db.get_db()
        page_titles = {}
        async with database.execute("SELECT path, title FROM pages WHERE topic_id = ?", (topic.id,)) as cursor:
            for row in await cursor.fetchall():
                page_titles[row["path"]] = row["title"]

        def build_tree(current_dir: Path) -> list[TopicTreeItem]:
            items = []
            try:
                entries = sorted(list(current_dir.iterdir()), key=lambda e: (not e.is_dir(), e.name.lower()))
            except Exception:
                return []
                
            for entry in entries:
                if entry.name.startswith('.') or entry.name in ('node_modules', '__pycache__', 'venv', '.venv'):
                    continue
                    
                rel_path = entry.relative_to(topic_path).as_posix()
                if entry.is_dir():
                    children = build_tree(entry)
                    items.append(TopicTreeItem(
                        name=entry.name,
                        path=rel_path,
                        type="directory",
                        children=children
                    ))
                elif entry.is_file():
                    if entry.suffix.lower() in ('.md', '.markdown', '.txt', '.json'):
                        items.append(TopicTreeItem(
                            name=entry.name,
                            path=rel_path,
                            type="file",
                            title=page_titles.get(rel_path, entry.name),
                            size=entry.stat().st_size
                        ))
            return items

        return build_tree(topic_path)

    async def get_page_detail(self, topic_id: str, page_path: str) -> Optional[PageDetail]:
        topic = await self.get_topic(topic_id)
        if not topic:
            return None
            
        file_path = Path(topic.path) / page_path
        if not file_path.exists():
            return None
            
        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                raw_content = f.read()
        except Exception as e:
            logger.error(f"Error reading {file_path}: {e}")
            return None

        parsed = parse_markdown(raw_content, fallback_name=file_path.stem)
        page_id = f"{topic.id}:{page_path}"
        
        database = await db.get_db()
        # Find incoming backlinks
        incoming = []
        async with database.execute("""
            SELECT l.source_page_id, l.context_snippet, p.path as source_path, p.title as source_title
            FROM wiki_links l
            JOIN pages p ON l.source_page_id = p.id
            WHERE l.target_page_id = ? OR l.target_ref = ? OR l.target_ref = ?
        """, (page_id, parsed.title, page_path)) as cursor:
            for row in await cursor.fetchall():
                incoming.append(BacklinkItem(
                    source_page_id=row["source_page_id"],
                    source_path=row["source_path"],
                    source_title=row["source_title"],
                    context_snippet=row["context_snippet"]
                ))

        stat = file_path.stat()
        return PageDetail(
            id=page_id,
            topic_id=topic.id,
            path=page_path,
            title=parsed.title,
            tags=parsed.tags,
            frontmatter=parsed.frontmatter_data,
            content=parsed.content,
            raw_content=parsed.raw_content,
            outgoing_links=[link["target"] for link in parsed.outgoing_links],
            incoming_links=incoming,
            created_at=datetime.fromtimestamp(stat.st_ctime),
            updated_at=datetime.fromtimestamp(stat.st_mtime),
            word_count=parsed.word_count
        )

    async def save_page(self, topic_id: str, page_path: str, content: str) -> PageDetail:
        topic = await self.get_topic(topic_id)
        if not topic:
            raise ValueError(f"Topic {topic_id} not found.")
            
        file_path = Path(topic.path) / page_path
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
            
        await self.sync_topic(topic_id)
        return await self.get_page_detail(topic_id, page_path)

    async def delete_page(self, topic_id: str, page_path: str):
        topic = await self.get_topic(topic_id)
        if not topic:
            return
        file_path = Path(topic.path) / page_path
        if file_path.exists():
            file_path.unlink()
        await self.sync_topic(topic_id)

topic_service = TopicService()

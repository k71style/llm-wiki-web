import json
import logging
import aiosqlite
from pathlib import Path
from backend.app.core.config import settings

logger = logging.getLogger("llm_wiki.db")

TABLE_SCHEMAS = [
    """
    CREATE TABLE IF NOT EXISTS topics (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        path TEXT NOT NULL,
        owner TEXT,
        assigned_users TEXT DEFAULT '[]',
        is_public INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS pages (
        id TEXT PRIMARY KEY,
        topic_id TEXT NOT NULL,
        path TEXT NOT NULL,
        title TEXT NOT NULL,
        tags TEXT,
        frontmatter_json TEXT,
        word_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(topic_id) REFERENCES topics(id) ON DELETE CASCADE,
        UNIQUE(topic_id, path)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS wiki_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic_id TEXT NOT NULL,
        source_page_id TEXT NOT NULL,
        target_page_id TEXT,
        target_ref TEXT NOT NULL,
        context_snippet TEXT,
        FOREIGN KEY(topic_id) REFERENCES topics(id) ON DELETE CASCADE,
        FOREIGN KEY(source_page_id) REFERENCES pages(id) ON DELETE CASCADE
    );
    """,
    "CREATE INDEX IF NOT EXISTS idx_pages_topic ON pages(topic_id);",
    "CREATE INDEX IF NOT EXISTS idx_pages_path ON pages(topic_id, path);",
    "CREATE INDEX IF NOT EXISTS idx_links_topic ON wiki_links(topic_id);",
    "CREATE INDEX IF NOT EXISTS idx_links_target ON wiki_links(topic_id, target_ref);",
    "CREATE INDEX IF NOT EXISTS idx_links_target_id ON wiki_links(target_page_id);",
    """
    CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(
        page_id UNINDEXED,
        topic_id UNINDEXED,
        title,
        content,
        tags,
        tokenize = 'unicode61'
    );
    """
]

class Database:
    def __init__(self, db_path: Path = settings.DATABASE_PATH):
        self.db_path = db_path
        self._connection: aiosqlite.Connection | None = None

    async def get_db(self) -> aiosqlite.Connection:
        if self._connection is None:
            self.db_path.parent.mkdir(parents=True, exist_ok=True)
            self._connection = await aiosqlite.connect(self.db_path, timeout=30.0)
            self._connection.row_factory = aiosqlite.Row
            await self._connection.execute("PRAGMA foreign_keys = ON;")
            await self._connection.execute("PRAGMA busy_timeout = 10000;")
        return self._connection

    async def init_db(self):
        db_conn = await self.get_db()
        for statement in TABLE_SCHEMAS:
            try:
                await db_conn.execute(statement)
            except Exception as e:
                logger.warning(f"Error executing schema statement: {e}")

        # Safe schema migration for topics permissions
        for col_def in [
            "ALTER TABLE topics ADD COLUMN owner TEXT;",
            "ALTER TABLE topics ADD COLUMN assigned_users TEXT DEFAULT '[]';",
            "ALTER TABLE topics ADD COLUMN is_public INTEGER DEFAULT 0;"
        ]:
            try:
                await db_conn.execute(col_def)
            except Exception:
                pass  # Column already exists

        await db_conn.commit()
        logger.info(f"Database initialized at {self.db_path}")

    async def close(self):
        if self._connection is not None:
            await self._connection.close()
            self._connection = None

db = Database()

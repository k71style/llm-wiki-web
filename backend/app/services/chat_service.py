import uuid
import logging
from datetime import datetime, timezone
from typing import Optional
from backend.app.db.database import db
from backend.app.models.schemas import ChatMessageItem

logger = logging.getLogger("llm_wiki.chat_service")

class ChatService:
    async def get_chat_history(
        self, topic_id: str, username: str, limit: int = 100
    ) -> list[ChatMessageItem]:
        """Fetches chat history for a specific topic and user, sorted chronologically."""
        database = await db.get_db()
        async with database.execute(
            """
            SELECT id, topic_id, username, role, text, created_at
            FROM chat_messages
            WHERE topic_id = ? AND username = ?
            ORDER BY created_at ASC
            LIMIT ?
            """,
            (topic_id, username, limit),
        ) as cursor:
            rows = await cursor.fetchall()
            return [
                ChatMessageItem(
                    id=row["id"],
                    topic_id=row["topic_id"],
                    username=row["username"],
                    role=row["role"],
                    text=row["text"],
                    created_at=datetime.fromisoformat(row["created_at"])
                    if isinstance(row["created_at"], str)
                    else row["created_at"],
                )
                for row in rows
            ]

    async def save_chat_message(
        self, topic_id: str, username: str, role: str, text: str
    ) -> ChatMessageItem:
        """Saves a single chat message to the database."""
        database = await db.get_db()
        msg_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        await database.execute(
            """
            INSERT INTO chat_messages (id, topic_id, username, role, text, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (msg_id, topic_id, username, role, text, now),
        )
        await database.commit()

        return ChatMessageItem(
            id=msg_id,
            topic_id=topic_id,
            username=username,
            role=role,
            text=text,
            created_at=datetime.fromisoformat(now),
        )

    async def clear_chat_history(self, topic_id: str, username: str):
        """Clears all chat history for a topic and user."""
        database = await db.get_db()
        await database.execute(
            """
            DELETE FROM chat_messages
            WHERE topic_id = ? AND username = ?
            """,
            (topic_id, username),
        )
        await database.commit()
        logger.info("Cleared chat history for topic=%s, username=%s", topic_id, username)

chat_service = ChatService()

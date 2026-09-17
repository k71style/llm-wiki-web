import asyncio
import logging
from pathlib import Path
from typing import Set
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileSystemEvent
from backend.app.core.config import settings

logger = logging.getLogger("llm_wiki.watcher")

class WikiFileChangeHandler(FileSystemEventHandler):
    def __init__(self, callback, loop: asyncio.AbstractEventLoop):
        super().__init__()
        self.callback = callback
        self.loop = loop
        self._pending_tasks = {}

    def _should_ignore(self, path: str) -> bool:
        p = Path(path)
        parts = p.parts
        for part in parts:
            if part.startswith('.') and part != '.wiki':
                return True
            if part in ('__pycache__', 'node_modules', 'venv', '.venv', '.git'):
                return True
        return not p.name.lower().endswith(('.md', '.markdown', '.txt', '.json'))

    def on_any_event(self, event: FileSystemEvent):
        if event.is_directory:
            return
        if self._should_ignore(event.src_path):
            return
            
        src_path = event.src_path
        # Schedule debounced callback on asyncio loop
        if src_path in self._pending_tasks:
            self._pending_tasks[src_path].cancel()
            
        async def debounced():
            await asyncio.sleep(0.4)
            await self.callback(src_path, event.event_type)
            self._pending_tasks.pop(src_path, None)
            
        self._pending_tasks[src_path] = asyncio.run_coroutine_threadsafe(debounced(), self.loop)

class WatcherService:
    def __init__(self):
        self.observer: Observer | None = None
        self.active_subscribers: Set[asyncio.Queue] = set()
        self._running = False

    def subscribe(self) -> asyncio.Queue:
        q = asyncio.Queue()
        self.active_subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        self.active_subscribers.discard(q)

    async def broadcast(self, message: dict):
        for q in list(self.active_subscribers):
            try:
                await q.put(message)
            except Exception as e:
                logger.error(f"Error putting to subscriber queue: {e}")

    async def handle_file_change(self, file_path: str, event_type: str):
        path_obj = Path(file_path)
        # Find which topic this belongs to
        try:
            rel = path_obj.relative_to(settings.DATA_DIR)
            topic_name = rel.parts[0]
            
            # Import topic_service dynamically to avoid circular import
            from backend.app.services.topic_service import topic_service
            topic = await topic_service.get_topic(topic_name)
            if topic:
                await topic_service.sync_topic(topic.id)
                await self.broadcast({
                    "type": "file_change",
                    "event": event_type,
                    "topic_id": topic.id,
                    "topic_name": topic.name,
                    "path": rel.as_posix()
                })
        except Exception as e:
            logger.error(f"Error handling file change for {file_path}: {e}")

    def start(self, loop: asyncio.AbstractEventLoop):
        if self._running:
            return
        self.observer = Observer()
        handler = WikiFileChangeHandler(self.handle_file_change, loop)
        self.observer.schedule(handler, str(settings.DATA_DIR), recursive=True)
        self.observer.start()
        self._running = True
        logger.info(f"File watcher started on {settings.DATA_DIR}")

    def stop(self):
        if self.observer:
            self.observer.stop()
            self.observer.join()
            self._running = False
            logger.info("File watcher stopped")

watcher_service = WatcherService()

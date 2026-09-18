import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.core.config import settings
from backend.app.db.database import db
from backend.app.services.watcher_service import watcher_service
from backend.app.services.topic_service import topic_service

from backend.app.api.routers import topics, pages, search, graph, mcp, ws_claude, ws_events, auth, upload

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("llm_wiki")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing database...")
    await db.init_db()
    
    # Start file watcher
    loop = asyncio.get_running_loop()
    watcher_service.start(loop)
    
    # Resync all existing topics
    try:
        existing_topics = await topic_service.list_topics()
        for t in existing_topics:
            await topic_service.sync_topic(t.id)
    except Exception as e:
        logger.error(f"Error resyncing topics on startup: {e}")
        
    logger.info("LLM-Wiki backend started successfully.")
    yield
    
    # Shutdown
    logger.info("Shutting down LLM-Wiki backend...")
    watcher_service.stop()
    await db.close()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for local dev flexibility
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(topics.router, prefix=settings.API_V1_STR)
app.include_router(pages.router, prefix=settings.API_V1_STR)
app.include_router(search.router, prefix=settings.API_V1_STR)
app.include_router(graph.router, prefix=settings.API_V1_STR)
app.include_router(mcp.router, prefix=settings.API_V1_STR)
app.include_router(upload.router, prefix=settings.API_V1_STR)

# WebSockets
app.include_router(ws_claude.router)
app.include_router(ws_events.router)

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "version": settings.VERSION,
        "data_dir": str(settings.DATA_DIR)
    }

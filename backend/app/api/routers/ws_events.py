import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.app.services.watcher_service import watcher_service

logger = logging.getLogger("llm_wiki.ws_events")

router = APIRouter(tags=["events_ws"])

@router.websocket("/ws/events")
async def websocket_events_feed(websocket: WebSocket):
    await websocket.accept()
    queue = watcher_service.subscribe()
    
    try:
        while True:
            event = await queue.get()
            await websocket.send_text(json.dumps(event))
    except WebSocketDisconnect:
        logger.info("Events feed WebSocket client disconnected")
    except Exception as e:
        logger.error(f"Error in events feed WebSocket: {e}")
    finally:
        watcher_service.unsubscribe(queue)

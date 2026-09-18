import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.app.services.topic_service import topic_service
from backend.app.services.claude_pty import claude_pty_manager
from backend.app.security.jwt_auth import authenticate_websocket

logger = logging.getLogger("llm_wiki.ws_claude")

router = APIRouter(tags=["claude_ws"])

@router.websocket("/ws/topics/{topic_id}/claude")
async def websocket_claude_session(websocket: WebSocket, topic_id: str):
    user = await authenticate_websocket(websocket)
    if not user:
        await websocket.accept()
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": "인증되지 않은 연결입니다. 로그인 후 다시 시도해 주세요."
        }))
        await websocket.close(code=4001)
        return

    await websocket.accept()
    
    topic = await topic_service.get_topic(topic_id)
    if not topic:
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": f"Topic '{topic_id}' not found"
        }))
        await websocket.close()
        return

    if not topic_service.can_access_topic(topic, user):
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": "해당 위키에 대한 접근 권한이 없습니다."
        }))
        await websocket.close(code=4003)
        return

    async def send_output(data: str):
        try:
            await websocket.send_text(json.dumps({
                "type": "output",
                "data": data
            }))
        except Exception:
            pass

    session = claude_pty_manager.get_or_create_session(topic.id, topic.path, send_output)

    try:
        while True:
            raw_msg = await websocket.receive_text()
            try:
                msg = json.loads(raw_msg)
                msg_type = msg.get("type", "input")
                
                if msg_type == "prompt":
                    prompt_text = msg.get("prompt", "")
                    if prompt_text:
                        await websocket.send_text(json.dumps({"type": "start_stream"}))
                        await session.execute_prompt(prompt_text)
                        await websocket.send_text(json.dumps({"type": "done"}))

                elif msg_type == "start":
                    custom_cmd = msg.get("command")
                    await session.start_interactive(custom_command=custom_cmd)
                    
                elif msg_type == "input":
                    data = msg.get("data", "")
                    await session.write_input(data)
                    
                elif msg_type == "resize":
                    cols = msg.get("cols", 80)
                    rows = msg.get("rows", 24)
                    session.set_window_size(rows, cols)

                elif msg_type == "stop":
                    await session.stop()
                    
            except json.JSONDecodeError:
                # Raw text input fallback
                await session.write_input(raw_msg)
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected from Claude session: {topic_id}")
    except Exception as e:
        logger.error(f"Error in Claude WebSocket session: {e}")

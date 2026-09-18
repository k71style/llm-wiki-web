import json
import logging
import re
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends
from backend.app.services.topic_service import topic_service
from backend.app.services.claude_pty import claude_pty_manager
from backend.app.services.chat_service import chat_service
from backend.app.security.jwt_auth import authenticate_websocket, User, get_current_user
from backend.app.models.schemas import ChatHistoryResponse

logger = logging.getLogger("llm_wiki.ws_claude")

router = APIRouter(tags=["claude_ws"])
chat_router = APIRouter(prefix="/topics/{topic_id}/chat", tags=["claude_chat"])

@chat_router.get("/history", response_model=ChatHistoryResponse)
async def get_topic_chat_history(topic_id: str, user: User = Depends(get_current_user)):
    """Fetches chat history for the current user in this topic."""
    topic = await topic_service.get_topic(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    if not topic_service.can_access_topic(topic, user):
        raise HTTPException(status_code=403, detail="해당 위키에 대한 접근 권한이 없습니다.")

    messages = await chat_service.get_chat_history(topic.id, user.username)
    return ChatHistoryResponse(topic_id=topic.id, messages=messages)

@chat_router.delete("/history")
async def clear_topic_chat_history(topic_id: str, user: User = Depends(get_current_user)):
    """Clears chat history for the current user in this topic."""
    topic = await topic_service.get_topic(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    if not topic_service.can_access_topic(topic, user):
        raise HTTPException(status_code=403, detail="해당 위키에 대한 접근 권한이 없습니다.")

    await chat_service.clear_chat_history(topic.id, user.username)
    return {"success": True, "message": "대화 기록이 삭제되었습니다."}

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
                        # 1. Save user message in DB
                        await chat_service.save_chat_message(
                            topic_id=topic.id,
                            username=user.username,
                            role="user",
                            text=prompt_text
                        )

                        # Collect assistant chunks to persist complete reply
                        assistant_chunks: list[str] = []
                        async def capture_and_send(chunk: str):
                            assistant_chunks.append(chunk)
                            await send_output(chunk)

                        old_callback = session.output_callback
                        session.output_callback = capture_and_send
                        try:
                            await websocket.send_text(json.dumps({"type": "start_stream"}))
                            await session.execute_prompt(prompt_text)
                            await websocket.send_text(json.dumps({"type": "done"}))
                        finally:
                            session.output_callback = old_callback

                        # 2. Save assistant reply in DB
                        full_reply = "".join(assistant_chunks)
                        clean_reply = re.sub(r"\x1b\[[0-9;]*[a-zA-Z]", "", full_reply).strip()
                        if clean_reply:
                            await chat_service.save_chat_message(
                                topic_id=topic.id,
                                username=user.username,
                                role="assistant",
                                text=clean_reply
                            )

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
        logger.error(f"Error in Claude WebSocket session: {e}", exc_info=True)

        logger.error(f"Error in Claude WebSocket session: {e}")

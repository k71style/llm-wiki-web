import asyncio
import os
import shutil
import tempfile
from pathlib import Path

# Set test environment
os.environ["AUTH_ENABLED"] = "true"
os.environ["DATA_DIR"] = tempfile.mkdtemp()
os.environ["DATABASE_PATH"] = str(Path(os.environ["DATA_DIR"]) / "wiki.db")

from backend.app.db.database import db
from backend.app.services.chat_service import chat_service
from backend.app.models.schemas import TopicCreate
from backend.app.services.topic_service import topic_service
from backend.app.security.jwt_auth import User

async def run_chat_tests():
    print("=== [1] DB 초기화 ===")
    await db.init_db()

    admin_user = User(username="admin_user", roles=["ROLE_ADMIN"], is_admin=True)
    user1 = User(username="user1", roles=["ROLE_USER"], is_admin=False)

    topic_in = TopicCreate(
        name="chat-test-wiki",
        title="채팅 테스트 위키",
        description="대화 기록 보존 테스트",
        is_public=True
    )
    topic = await topic_service.create_topic(topic_in, user=admin_user)
    print(f"토픽 생성: {topic.title} (ID: {topic.id})")

    print("=== [2] 사용자 질문 메시지 저장 ===")
    user_msg = await chat_service.save_chat_message(
        topic_id=topic.id,
        username="user1",
        role="user",
        text="이 위키의 주요 문서 요약을 알려줘."
    )
    assert user_msg.role == "user"
    assert "주요 문서" in user_msg.text

    print("=== [3] 어시스턴트 답변 메시지 저장 ===")
    assistant_msg = await chat_service.save_chat_message(
        topic_id=topic.id,
        username="user1",
        role="assistant",
        text="현재 위키 저장소에는 INDEX.md와 Getting Started 문서가 있습니다."
    )
    assert assistant_msg.role == "assistant"

    print("=== [4] 대화 기록 조회 검증 (시간순 정렬) ===")
    history = await chat_service.get_chat_history(topic.id, "user1")
    print(f"조회된 메시지 수: {len(history)}")
    assert len(history) == 2
    assert history[0].role == "user"
    assert history[1].role == "assistant"
    assert history[0].text == "이 위키의 주요 문서 요약을 알려줘."

    print("=== [5] 다른 사용자와의 대화 격리 검증 ===")
    user2_history = await chat_service.get_chat_history(topic.id, "user2")
    assert len(user2_history) == 0
    print("user2에게는 user1의 대화 기록이 노출되지 않음 확인!")

    print("=== [6] 대화 기록 비우기(Clear) 검증 ===")
    await chat_service.clear_chat_history(topic.id, "user1")
    cleared_history = await chat_service.get_chat_history(topic.id, "user1")
    assert len(cleared_history) == 0
    print("대화 기록 삭제 후 비어있음 확인!")

    await db.close()
    shutil.rmtree(os.environ["DATA_DIR"], ignore_errors=True)
    print("🎉 대화 기록 DB 영속화 단위 테스트 전체 통과!")

if __name__ == "__main__":
    asyncio.run(run_chat_tests())

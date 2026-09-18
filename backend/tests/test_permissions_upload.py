import asyncio
import os
import shutil
import tempfile
from pathlib import Path

# Set dummy env before importing app
os.environ["AUTH_ENABLED"] = "true"
os.environ["DATA_DIR"] = tempfile.mkdtemp()
os.environ["DATABASE_PATH"] = str(Path(os.environ["DATA_DIR"]) / "wiki.db")

from backend.app.core.config import settings
from backend.app.db.database import db
from backend.app.models.schemas import TopicCreate, TopicPermissionsUpdate
from backend.app.security.jwt_auth import User
from backend.app.services.topic_service import topic_service

async def run_tests():
    print("=== [1] DB 초기화 ===")
    await db.init_db()

    admin_user = User(username="admin_user", roles=["ROLE_ADMIN"], is_admin=True)
    user1 = User(username="user1", roles=["ROLE_USER"], is_admin=False)
    user2 = User(username="user2", roles=["ROLE_USER"], is_admin=False)

    print("=== [2] 관리자가 비공개 토픽 생성 (user1만 할당) ===")
    topic_in = TopicCreate(
        name="private-wiki",
        title="비공개 연구 위키",
        description="user1에게만 허용된 위키",
        is_public=False,
        assigned_users=["user1"]
    )
    created = await topic_service.create_topic(topic_in, user=admin_user)
    print(f"생성 완료: {created.title} (ID: {created.id}, is_public: {created.is_public}, assigned: {created.assigned_users})")
    assert created.is_public is False
    assert "user1" in created.assigned_users

    print("=== [3] 사용자별 목록 조회 검증 ===")
    admin_topics = await topic_service.list_topics(admin_user)
    print(f"관리자 조회 목록 수: {len(admin_topics)}")
    assert any(t.id == created.id for t in admin_topics)

    user1_topics = await topic_service.list_topics(user1)
    print(f"user1 조회 목록 수: {len(user1_topics)}")
    assert any(t.id == created.id for t in user1_topics)

    user2_topics = await topic_service.list_topics(user2)
    print(f"user2 조회 목록 수: {len(user2_topics)}")
    assert not any(t.id == created.id for t in user2_topics)

    print("=== [4] can_access_topic 검증 ===")
    assert topic_service.can_access_topic(created, admin_user) is True
    assert topic_service.can_access_topic(created, user1) is True
    assert topic_service.can_access_topic(created, user2) is False

    print("=== [5] 권한 업데이트 검증 (user2 추가) ===")
    updated = await topic_service.update_topic_permissions(
        topic_id=created.id,
        is_public=False,
        assigned_users=["user1", "user2"]
    )
    assert topic_service.can_access_topic(updated, user2) is True
    user2_topics_after = await topic_service.list_topics(user2)
    assert any(t.id == created.id for t in user2_topics_after)
    print("user2 권한 부여 성공 및 목록 조회 확인")

    print("=== [6] 전체 공개(is_public=True) 변경 검증 ===")
    public_topic = await topic_service.update_topic_permissions(
        topic_id=created.id,
        is_public=True,
        assigned_users=[]
    )
    user3 = User(username="user3", roles=["ROLE_USER"], is_admin=False)
    assert topic_service.can_access_topic(public_topic, user3) is True
    user3_topics = await topic_service.list_topics(user3)
    assert any(t.id == created.id for t in user3_topics)
    print("전체 공개 전환 후 임의의 일반 사용자(user3) 접근 확인")

    print("=== [7] 파일 저장 및 자동 색인 검증 ===")
    upload_res = await topic_service.save_uploaded_file(
        topic_id=created.id,
        filename="notes.md",
        file_bytes=b"---\ntitle: Uploaded Note\n---\n# Uploaded\nThis is uploaded content.",
        target_dir="sources",
        overwrite=True
    )
    print(f"파일 업로드 결과: {upload_res['filename']}, size: {upload_res['size']}")
    assert upload_res["is_markdown"] is True

    # Check page detail
    page = await topic_service.get_page_detail(created.id, "sources/notes.md")
    assert page is not None
    assert "Uploaded" in page.title or "Uploaded" in page.content
    print("업로드된 마크다운 문서 자동 색인 및 상세 조회 성공!")

    await db.close()
    shutil.rmtree(os.environ["DATA_DIR"], ignore_errors=True)
    print("🎉 모든 권한 및 파일 업로드 단위 테스트 통과!")

if __name__ == "__main__":
    asyncio.run(run_tests())

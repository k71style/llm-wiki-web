import shutil
import subprocess
import tempfile
import pytest
from pathlib import Path

from backend.app.core.config import settings
from backend.app.db.database import db
from backend.app.models.schemas import TopicGitImport
from backend.app.services.topic_service import topic_service

@pytest.fixture(scope="module")
def temp_dir():
    d = Path(tempfile.mkdtemp())
    yield d
    shutil.rmtree(d, ignore_errors=True)

@pytest.mark.asyncio
async def test_git_import_flow(temp_dir):
    test_db_path = temp_dir / "test_git.db"
    settings.DATA_DIR = temp_dir / "wikis"
    settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    await db.close()
    db.db_path = test_db_path
    await db.init_db()

    source_git_dir = temp_dir / "source_repo"
    source_git_dir.mkdir(parents=True, exist_ok=True)
    (source_git_dir / "concepts").mkdir(exist_ok=True)

    with open(source_git_dir / "README.md", "w", encoding="utf-8") as f:
        f.write("# Sample Git Wiki\n\nWelcome to imported wiki. See [[concepts/deep-learning.md]].\n")

    with open(source_git_dir / "concepts" / "deep-learning.md", "w", encoding="utf-8") as f:
        f.write("---\ntitle: Deep Learning\ntags: [ai, neural-net]\n---\n\n# Deep Learning\n\nDeep learning neural network architecture.\n")

    subprocess.run(["git", "init"], cwd=str(source_git_dir), check=True, capture_output=True)
    subprocess.run(["git", "config", "user.name", "Test User"], cwd=str(source_git_dir), check=True, capture_output=True)
    subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=str(source_git_dir), check=True, capture_output=True)
    subprocess.run(["git", "add", "."], cwd=str(source_git_dir), check=True, capture_output=True)
    subprocess.run(["git", "commit", "-m", "Initial commit"], cwd=str(source_git_dir), check=True, capture_output=True)

    git_in = TopicGitImport(
        git_url=str(source_git_dir),
        name="imported-wiki",
        title="Imported AI Wiki",
        description="Cloned from local Git repo"
    )
    topic = await topic_service.import_from_git(git_in)
    assert topic is not None
    assert topic.name == "imported-wiki"
    assert topic.is_git_repo is True
    assert topic.page_count >= 2

    detail = await topic_service.get_page_detail(topic.id, "concepts/deep-learning.md")
    assert detail is not None
    assert detail.title == "Deep Learning"
    assert "neural-net" in detail.tags

    subprocess.run(["git", "config", "receive.denyCurrentBranch", "updateInstead"], cwd=str(source_git_dir), check=True, capture_output=True)

    pull_res = await topic_service.pull_topic(topic.id)
    assert pull_res["success"] is True

    # Test git push flow
    # 1. Modify or add a file in the imported topic directory
    topic_path = Path(topic.path)
    new_doc_path = topic_path / "concepts" / "pushed-topic.md"
    with open(new_doc_path, "w", encoding="utf-8") as f:
        f.write("# Pushed Topic\n\nContent pushed back to remote.\n")

    push_res = await topic_service.push_topic(topic.id, commit_message="Add pushed-topic doc")
    assert push_res["success"] is True
    assert push_res["pushed"] is True

    # 2. Verify source repo got the new file
    assert (source_git_dir / "concepts" / "pushed-topic.md").exists()
    with open(source_git_dir / "concepts" / "pushed-topic.md", "r", encoding="utf-8") as f:
        assert "Content pushed back to remote" in f.read()

    # 3. Test push again when no changes
    push_again_res = await topic_service.push_topic(topic.id)
    assert push_again_res["success"] is True
    assert push_again_res["pushed"] is False

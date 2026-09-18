from fastapi import APIRouter, HTTPException, Query, Depends
from backend.app.models.schemas import TopicCreate, TopicGitImport, TopicInfo, TopicTreeItem, TopicPermissionsUpdate
from backend.app.services.topic_service import topic_service
from backend.app.security.jwt_auth import User, get_current_user, require_admin

router = APIRouter(prefix="/topics", tags=["topics"])

@router.get("", response_model=list[TopicInfo])
async def list_topics(user: User = Depends(get_current_user)):
    """Returns topics accessible to the current user. Admins see all; users see assigned or public topics."""
    return await topic_service.list_topics(user)

@router.post("", response_model=TopicInfo)
async def create_topic(topic_in: TopicCreate, user: User = Depends(require_admin)):
    """Admin only: Creates a new topic."""
    try:
        return await topic_service.create_topic(topic_in, user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create topic: {e}")

@router.post("/import/git", response_model=TopicInfo)
async def import_topic_from_git(git_in: TopicGitImport, user: User = Depends(require_admin)):
    """Admin only: Clones a Git repository as a topic."""
    try:
        return await topic_service.import_from_git(git_in, user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to import Git topic: {e}")

@router.get("/{topic_id}", response_model=TopicInfo)
async def get_topic(topic_id: str, user: User = Depends(get_current_user)):
    """Returns topic details if the user has access."""
    topic = await topic_service.get_topic(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    if not topic_service.can_access_topic(topic, user):
        raise HTTPException(status_code=403, detail="해당 위키에 대한 접근 권한이 없습니다.")
    return topic

@router.put("/{topic_id}/permissions", response_model=TopicInfo)
async def update_topic_permissions(
    topic_id: str,
    perm_in: TopicPermissionsUpdate,
    user: User = Depends(require_admin)
):
    """Admin only: Updates access permissions (public/private, assigned users) for a topic."""
    try:
        return await topic_service.update_topic_permissions(
            topic_id=topic_id,
            is_public=perm_in.is_public,
            assigned_users=perm_in.assigned_users
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update permissions: {e}")

@router.delete("/{topic_id}")
async def delete_topic(topic_id: str, delete_files: bool = Query(False), user: User = Depends(require_admin)):
    """Admin only: Deletes a topic."""
    await topic_service.delete_topic(topic_id, delete_files=delete_files)
    return {"success": True, "message": f"Topic {topic_id} deleted"}

@router.get("/{topic_id}/tree", response_model=list[TopicTreeItem])
async def get_topic_tree(topic_id: str, user: User = Depends(get_current_user)):
    """Returns file tree for topic if user has access."""
    topic = await topic_service.get_topic(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    if not topic_service.can_access_topic(topic, user):
        raise HTTPException(status_code=403, detail="해당 위키에 대한 접근 권한이 없습니다.")
    return await topic_service.get_topic_tree(topic.id)

@router.post("/{topic_id}/sync")
async def sync_topic(topic_id: str, user: User = Depends(require_admin)):
    """Admin only: Resyncs knowledge base indexing for topic."""
    topic = await topic_service.get_topic(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    await topic_service.sync_topic(topic.id)
    return {"success": True, "message": f"Topic {topic.name} synced"}

@router.post("/{topic_id}/pull")
async def pull_topic(topic_id: str, user: User = Depends(require_admin)):
    """Admin only: Pulls latest Git changes for topic."""
    try:
        return await topic_service.pull_topic(topic_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to pull topic: {e}")

from fastapi import APIRouter, HTTPException, Query, Depends
from backend.app.models.schemas import TopicCreate, TopicGitImport, TopicInfo, TopicTreeItem
from backend.app.services.topic_service import topic_service
from backend.app.security.jwt_auth import User, get_current_user

router = APIRouter(prefix="/topics", tags=["topics"])

@router.get("", response_model=list[TopicInfo])
async def list_topics(user: User = Depends(get_current_user)):
    return await topic_service.list_topics()

@router.post("", response_model=TopicInfo)
async def create_topic(topic_in: TopicCreate, user: User = Depends(get_current_user)):
    try:
        return await topic_service.create_topic(topic_in)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create topic: {e}")

@router.post("/import/git", response_model=TopicInfo)
async def import_topic_from_git(git_in: TopicGitImport, user: User = Depends(get_current_user)):
    try:
        return await topic_service.import_from_git(git_in)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to import Git topic: {e}")

@router.get("/{topic_id}", response_model=TopicInfo)
async def get_topic(topic_id: str, user: User = Depends(get_current_user)):
    topic = await topic_service.get_topic(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic

@router.delete("/{topic_id}")
async def delete_topic(topic_id: str, delete_files: bool = Query(False), user: User = Depends(get_current_user)):
    await topic_service.delete_topic(topic_id, delete_files=delete_files)
    return {"success": True, "message": f"Topic {topic_id} deleted"}

@router.get("/{topic_id}/tree", response_model=list[TopicTreeItem])
async def get_topic_tree(topic_id: str, user: User = Depends(get_current_user)):
    topic = await topic_service.get_topic(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    return await topic_service.get_topic_tree(topic.id)

@router.post("/{topic_id}/sync")
async def sync_topic(topic_id: str, user: User = Depends(get_current_user)):
    topic = await topic_service.get_topic(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    await topic_service.sync_topic(topic.id)
    return {"success": True, "message": f"Topic {topic.name} synced"}

@router.post("/{topic_id}/pull")
async def pull_topic(topic_id: str, user: User = Depends(get_current_user)):
    try:
        return await topic_service.pull_topic(topic_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to pull topic: {e}")

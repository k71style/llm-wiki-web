from fastapi import APIRouter, HTTPException, Query, Depends
from backend.app.models.schemas import SearchResultItem
from backend.app.services.index_service import index_service
from backend.app.services.topic_service import topic_service
from backend.app.security.jwt_auth import User, get_current_user

router = APIRouter(prefix="/topics/{topic_id}/search", tags=["search"])

@router.get("", response_model=list[SearchResultItem])
async def search_pages(
    topic_id: str,
    q: str = Query(..., description="Search query"),
    mode: str = Query("hybrid", description="Search mode: hybrid, keyword, or semantic"),
    limit: int = Query(15, ge=1, le=50),
    user: User = Depends(get_current_user)
):
    topic = await topic_service.get_topic(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
        
    return await index_service.search(topic.id, q, mode=mode, limit=limit)

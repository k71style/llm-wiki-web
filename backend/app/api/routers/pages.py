from fastapi import APIRouter, HTTPException, Query, Depends
from backend.app.models.schemas import PageDetail, PageSaveRequest
from backend.app.services.topic_service import topic_service
from backend.app.security.jwt_auth import User, get_current_user, get_current_user_optional

router = APIRouter(prefix="/topics/{topic_id}/pages", tags=["pages"])

@router.get("", response_model=PageDetail)
async def get_page(
    topic_id: str, 
    path: str = Query(..., description="Relative path of the page"),
    user: User = Depends(get_current_user)
):
    topic = await topic_service.get_topic(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    if not topic_service.can_access_topic(topic, user):
        raise HTTPException(status_code=403, detail="해당 위키에 대한 접근 권한이 없습니다.")

    page = await topic_service.get_page_detail(topic_id, path)
    if not page:
        raise HTTPException(status_code=404, detail=f"Page '{path}' not found")
    return page

@router.post("", response_model=PageDetail)
async def save_page(
    topic_id: str, 
    path: str = Query(..., description="Relative path of the page"), 
    req: PageSaveRequest = ...,
    user: User = Depends(get_current_user)
):
    topic = await topic_service.get_topic(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    if not topic_service.can_access_topic(topic, user):
        raise HTTPException(status_code=403, detail="해당 위키에 대한 수정 권한이 없습니다.")

    try:
        page = await topic_service.save_page(topic_id, path, req.content)
        return page
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save page: {e}")

@router.delete("")
async def delete_page(
    topic_id: str, 
    path: str = Query(...),
    user: User = Depends(get_current_user)
):
    topic = await topic_service.get_topic(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    if not topic_service.can_access_topic(topic, user):
        raise HTTPException(status_code=403, detail="해당 위키에 대한 삭제 권한이 없습니다.")

    await topic_service.delete_page(topic_id, path)
    return {"success": True, "message": f"Page '{path}' deleted"}

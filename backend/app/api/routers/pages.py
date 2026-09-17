from fastapi import APIRouter, HTTPException, Query
from backend.app.models.schemas import PageDetail, PageSaveRequest
from backend.app.services.topic_service import topic_service

router = APIRouter(prefix="/topics/{topic_id}/pages", tags=["pages"])

@router.get("", response_model=PageDetail)
async def get_page(topic_id: str, path: str = Query(..., description="Relative path of the page")):
    page = await topic_service.get_page_detail(topic_id, path)
    if not page:
        raise HTTPException(status_code=404, detail=f"Page '{path}' not found")
    return page

@router.post("", response_model=PageDetail)
async def save_page(topic_id: str, path: str = Query(..., description="Relative path of the page"), req: PageSaveRequest = ...):
    try:
        page = await topic_service.save_page(topic_id, path, req.content)
        return page
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save page: {e}")

@router.delete("")
async def delete_page(topic_id: str, path: str = Query(...)):
    await topic_service.delete_page(topic_id, path)
    return {"success": True, "message": f"Page '{path}' deleted"}

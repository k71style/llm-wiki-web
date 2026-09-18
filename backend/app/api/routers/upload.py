from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from fastapi.responses import FileResponse
from backend.app.services.topic_service import topic_service
from backend.app.security.jwt_auth import User, get_current_user, get_current_user_optional

router = APIRouter(prefix="/topics/{topic_id}", tags=["upload"])

@router.post("/upload")
async def upload_files(
    topic_id: str,
    files: list[UploadFile] = File(...),
    target_dir: str = Form("assets"),
    overwrite: bool = Form(True),
    user: User = Depends(get_current_user)
):
    """
    Uploads one or more files to the specified topic directory.
    Markdown files (.md) are automatically indexed into FTS5 and knowledge graph.
    """
    topic = await topic_service.get_topic(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail=f"Topic '{topic_id}' not found")

    results = []
    errors = []

    for file in files:
        try:
            content = await file.read()
            res = await topic_service.save_uploaded_file(
                topic_id=topic_id,
                filename=file.filename or "uploaded_file",
                file_bytes=content,
                target_dir=target_dir,
                overwrite=overwrite
            )
            results.append(res)
        except Exception as e:
            errors.append({"filename": file.filename, "error": str(e)})

    return {
        "success": len(errors) == 0,
        "uploaded": results,
        "errors": errors,
        "message": f"{len(results)}개 파일이 성공적으로 업로드되었습니다." if not errors else f"{len(results)}개 성공, {len(errors)}개 실패"
    }

@router.get("/assets/{filename}")
async def get_topic_asset(
    topic_id: str,
    filename: str,
    user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Serves static assets (images, pdfs) stored in the topic's assets directory.
    """
    topic = await topic_service.get_topic(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    safe_name = Path(filename).name
    file_path = Path(topic.path) / "assets" / safe_name

    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Asset not found")

    return FileResponse(path=str(file_path))

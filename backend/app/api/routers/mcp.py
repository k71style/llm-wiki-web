from fastapi import APIRouter
from backend.app.models.schemas import MCPRequest, MCPResponse
from backend.app.services.mcp_server import mcp_server

router = APIRouter(prefix="/mcp", tags=["mcp"])

@router.post("", response_model=MCPResponse)
async def handle_mcp_jsonrpc(req: MCPRequest):
    return await mcp_server.handle_jsonrpc(req)

@router.get("/tools")
async def list_mcp_tools():
    from backend.app.services.mcp_server import TOOLS
    return {"tools": TOOLS}

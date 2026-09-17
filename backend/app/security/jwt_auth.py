import logging
from typing import Optional, List
import jwt
from fastapi import Request, HTTPException, status, Depends, WebSocket
from pydantic import BaseModel
from backend.app.core.config import settings

logger = logging.getLogger("llm_wiki.auth")

class User(BaseModel):
    username: str
    roles: List[str] = ["ROLE_USER"]
    is_admin: bool = False

def decode_token(token: str) -> Optional[dict]:
    """
    Validates and decodes the JWT token using zzooni4's shared HMAC-SHA256 secret key.
    """
    if not token:
        return None
    try:
        secret_bytes = settings.JWT_SECRET_KEY.encode("utf-8")
        payload = jwt.decode(
            token,
            secret_bytes,
            algorithms=["HS512", "HS256", settings.JWT_ALGORITHM],
            options={"verify_exp": True}
        )
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("JWT Token has expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid JWT Token: {e}")
        return None
    except Exception as e:
        logger.error(f"Error decoding JWT token: {e}")
        return None

def extract_token(request: Request) -> Optional[str]:
    """
    Extracts JWT from:
    1. Authorization header (Bearer <token>)
    2. HTTP Cookie (jwtToken)
    3. Query parameter (?token=<token>)
    """
    # 1. Authorization header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:].strip()

    # 2. Cookie (jwtToken)
    cookie_token = request.cookies.get("jwtToken")
    if cookie_token:
        return cookie_token.strip()

    # 3. Query param
    query_token = request.query_params.get("token")
    if query_token:
        return query_token.strip()

    return None

def extract_user_from_token(token: str) -> Optional[User]:
    payload = decode_token(token)
    if not payload:
        return None

    username = payload.get("sub") or payload.get("username")
    if not username:
        return None

    auth_claim = payload.get("auth") or payload.get("roles") or "ROLE_USER"
    if isinstance(auth_claim, list):
        roles = auth_claim
    elif isinstance(auth_claim, str):
        roles = [r.strip() for r in auth_claim.split(",") if r.strip()]
    else:
        roles = ["ROLE_USER"]

    is_admin = "ROLE_ADMIN" in roles or "ADMIN" in roles or username.lower() == "admin"

    return User(
        username=username,
        roles=roles,
        is_admin=is_admin
    )

async def get_current_user_optional(request: Request) -> Optional[User]:
    """
    Returns the authenticated user, or None if not authenticated.
    """
    if not settings.AUTH_ENABLED:
        # If auth is disabled in dev mode, return mock admin
        return User(username="dev_user", roles=["ROLE_USER", "ROLE_ADMIN"], is_admin=True)

    token = extract_token(request)
    if not token:
        return None

    return extract_user_from_token(token)

async def get_current_user(request: Request) -> User:
    """
    FastAPI dependency requiring a valid authenticated user.
    Raises HTTP 401 Unauthorized if missing or invalid.
    """
    user = await get_current_user_optional(request)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="인증이 필요합니다. zzooni4(k71style.xyz) 계정으로 로그인해 주세요.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    return user

async def require_admin(user: User = Depends(get_current_user)) -> User:
    """
    FastAPI dependency requiring ROLE_ADMIN privilege.
    """
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자(ROLE_ADMIN) 권한이 필요한 작업입니다."
        )
    return user

async def authenticate_websocket(websocket: WebSocket) -> Optional[User]:
    """
    Validates token during WebSocket handshake.
    """
    if not settings.AUTH_ENABLED:
        return User(username="dev_user", roles=["ROLE_USER", "ROLE_ADMIN"], is_admin=True)

    token = websocket.query_params.get("token")
    if not token:
        token = websocket.cookies.get("jwtToken")

    if not token:
        return None

    return extract_user_from_token(token)

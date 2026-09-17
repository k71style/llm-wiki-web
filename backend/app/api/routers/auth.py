from fastapi import APIRouter, Depends, Response, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional, List
from backend.app.core.config import settings
from backend.app.security.jwt_auth import User, get_current_user_optional

router = APIRouter(prefix="/auth", tags=["auth"])

class UserResponse(BaseModel):
    username: str
    roles: List[str]
    isAdmin: bool

class AuthMeResponse(BaseModel):
    authenticated: bool
    user: Optional[UserResponse] = None
    loginUrl: str

@router.get("/me", response_model=AuthMeResponse)
async def get_current_auth_state(
    user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Returns current authentication status and user information.
    """
    if user:
        return AuthMeResponse(
            authenticated=True,
            user=UserResponse(
                username=user.username,
                roles=user.roles,
                isAdmin=user.is_admin
            ),
            loginUrl=settings.SSO_LOGIN_URL
        )
    return AuthMeResponse(
        authenticated=False,
        user=None,
        loginUrl=settings.SSO_LOGIN_URL
    )

@router.get("/login")
async def sso_login_redirect():
    """
    Redirects user to zzooni4 main SSO login page.
    """
    return RedirectResponse(url=settings.SSO_LOGIN_URL)

@router.get("/logout")
async def sso_logout(response: Response):
    """
    Clears local jwtToken cookie and redirects to SSO logout / main site.
    """
    response.delete_cookie(key="jwtToken", path="/", domain="k71style.xyz")
    response.delete_cookie(key="jwtToken", path="/", domain=".k71style.xyz")
    response.delete_cookie(key="jwtToken", path="/")
    return RedirectResponse(url=settings.SSO_LOGOUT_URL)

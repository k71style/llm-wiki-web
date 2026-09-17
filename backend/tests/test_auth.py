import time
import jwt
import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.core.config import settings
from backend.app.security.jwt_auth import decode_token, extract_user_from_token

SECRET = settings.JWT_SECRET_KEY

def create_test_jwt(username="snoopy", roles="ROLE_USER,ROLE_ADMIN", expired=False):
    exp = int(time.time()) - 3600 if expired else int(time.time()) + 3600
    payload = {
        "sub": username,
        "auth": roles,
        "exp": exp
    }
    return jwt.encode(payload, SECRET.encode("utf-8"), algorithm="HS256")

def test_jwt_decode_and_roles():
    # Valid token
    token = create_test_jwt("snoopy", "ROLE_USER,ROLE_ADMIN")
    user = extract_user_from_token(token)
    assert user is not None
    assert user.username == "snoopy"
    assert "ROLE_ADMIN" in user.roles
    assert user.is_admin is True

    # Regular user token
    token_user = create_test_jwt("charlie", "ROLE_USER")
    user2 = extract_user_from_token(token_user)
    assert user2 is not None
    assert user2.username == "charlie"
    assert user2.is_admin is False

    # Expired token
    token_expired = create_test_jwt("snoopy", "ROLE_ADMIN", expired=True)
    assert extract_user_from_token(token_expired) is None

    # Invalid secret
    fake_token = jwt.encode({"sub": "hacker"}, b"wrong-secret", algorithm="HS256")
    assert extract_user_from_token(fake_token) is None

@pytest.mark.asyncio
async def test_auth_me_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Unauthenticated request
        resp = await client.get("/api/auth/me")
        assert resp.status_code == 200
        data = resp.json()
        assert data["authenticated"] is False
        assert data["user"] is None

        # 2. Authenticated with Cookie
        token = create_test_jwt("snoopy", "ROLE_ADMIN")
        resp_cookie = await client.get("/api/auth/me", cookies={"jwtToken": token})
        assert resp_cookie.status_code == 200
        data_cookie = resp_cookie.json()
        assert data_cookie["authenticated"] is True
        assert data_cookie["user"]["username"] == "snoopy"
        assert data_cookie["user"]["isAdmin"] is True

        # 3. Authenticated with Authorization Bearer header
        resp_header = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp_header.status_code == 200
        data_header = resp_header.json()
        assert data_header["authenticated"] is True
        assert data_header["user"]["username"] == "snoopy"

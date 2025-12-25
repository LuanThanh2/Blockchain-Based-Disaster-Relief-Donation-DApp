# backend/app/dependencies/auth.py

from fastapi import Depends, HTTPException, status
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Callable, List
from app.utils.jwt import decode_access_token
from app.utils.roles import ADMIN_ROLES

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    Decode bearer token and return user dict with at least 'sub' and 'role'.
    Raises 401 on invalid token.
    """
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    token = credentials.credentials
    try:
        payload = decode_access_token(token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = {"sub": payload.get("sub"), "role": payload.get("role")}
    if user["sub"] is None or user["role"] is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    return user

def require_roles(*roles: List[str]) -> Callable:
    """
    Dependency factory: Require caller to have one of the specified roles.
    Usage: Depends(require_roles("admin"))
    """
    def dependency(user: dict = Depends(get_current_user)):
        if user.get("role") not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return user
    return dependency

def admin_required(user: dict = Depends(get_current_user)):
    if user.get("role") not in ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return user

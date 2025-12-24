from fastapi import APIRouter
from app.utils.jwt import create_access_token

router = APIRouter()

# DEMO user giả
USERS = {
    "admin": {"password": "admin123", "role": "admin"},
    "user": {"password": "user123", "role": "user"}
}

@router.post("/login")
def login(username: str, password: str):
    user = USERS.get(username)
    if not user or user["password"] != password:
        return {"error": "Invalid credentials"}

    token = create_access_token({
        "sub": username,
        "role": user["role"]
    })

    return {
        "access_token": token,
        "role": user["role"]
    }

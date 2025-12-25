# backend/app/routes/admin.py

from fastapi import APIRouter, HTTPException, Depends, Query
from sqlmodel import Session, select
from sqlalchemy import or_, and_, func
from typing import Optional, List
from pydantic import BaseModel
from app.database import get_session
from app.models import User, AuditLog
from app.dependencies.auth import admin_required, get_current_user
from app.crud import create_audit_log
from app.utils.roles import ROLE_ADMIN, ROLE_USER
import logging

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


# =========================================================
# Schemas
# =========================================================
class UserRead(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    role: str
    wallet_address: Optional[str] = None
    is_active: bool = True
    created_at: str

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    role: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None


class UserListResponse(BaseModel):
    users: List[UserRead]
    total: int


# =========================================================
# ADMIN: List all users
# =========================================================
@router.get("/users", response_model=UserListResponse)
def list_users_api(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    role: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_session),
    admin_user=Depends(admin_required),
):
    """List all users with filters"""
    try:
        query = select(User)
        
        # Filter by role
        if role:
            query = query.where(User.role == role)
        
        # Filter by is_active
        if is_active is not None:
            query = query.where(User.is_active == is_active)
        
        # Search by username or email
        if search:
            search_term = f"%{search.lower()}%"
            query = query.where(
                (User.username.ilike(search_term)) | 
                (User.email.ilike(search_term) if User.email else False)
            )
        
        # Get total count
        total_query = select(User).where(query.where_clause) if hasattr(query, 'where_clause') else select(User)
        total = len(list(db.exec(total_query).all()))
        
        # Get paginated results
        users = list(db.exec(query.offset(skip).limit(limit)).all())
        
        # Convert to UserRead
        user_reads = []
        for user in users:
            user_reads.append(UserRead(
                id=user.id,
                username=user.username,
                email=user.email,
                role=user.role,
                wallet_address=user.wallet_address,
                is_active=getattr(user, 'is_active', True),  # Default True if field doesn't exist
                created_at=user.created_at.isoformat() if user.created_at else "",
            ))
        
        return UserListResponse(users=user_reads, total=total)
        
    except Exception as e:
        logger.exception(f"Error listing users: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list users: {str(e)}")


# =========================================================
# ADMIN: Get user detail
# =========================================================
@router.get("/users/{user_id}", response_model=UserRead)
def get_user_api(
    user_id: int,
    db: Session = Depends(get_session),
    admin_user=Depends(admin_required),
):
    """Get user detail by ID"""
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return UserRead(
        id=user.id,
        username=user.username,
        email=user.email,
        role=user.role,
        wallet_address=user.wallet_address,
        is_active=getattr(user, 'is_active', True),
        created_at=user.created_at.isoformat() if user.created_at else "",
    )


# =========================================================
# ADMIN: Update user
# =========================================================
@router.put("/users/{user_id}", response_model=UserRead)
def update_user_api(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_session),
    admin_user=Depends(admin_required),
):
    """Update user (role, email, is_active)"""
    username = admin_user.get("sub")
    
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent admin from modifying themselves (optional safety check)
    if user.username == username:
        # Allow self-update but log it
        logger.warning(f"Admin {username} is updating their own account")
    
    # Validate role
    if payload.role and payload.role not in [ROLE_ADMIN, ROLE_USER]:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be '{ROLE_ADMIN}' or '{ROLE_USER}'")
    
    # Update fields
    update_details = []
    if payload.role is not None and payload.role != user.role:
        old_role = user.role
        user.role = payload.role
        update_details.append(f"role: {old_role} -> {payload.role}")
    
    if payload.email is not None:
        old_email = user.email
        user.email = payload.email.lower().strip() if payload.email else None
        update_details.append(f"email: {old_email} -> {user.email}")
    
    if payload.is_active is not None:
        old_active = getattr(user, 'is_active', True)
        user.is_active = payload.is_active
        update_details.append(f"is_active: {old_active} -> {payload.is_active}")
    
    if not update_details:
        # No changes
        return UserRead(
            id=user.id,
            username=user.username,
            email=user.email,
            role=user.role,
            wallet_address=user.wallet_address,
            is_active=getattr(user, 'is_active', True),
            created_at=user.created_at.isoformat() if user.created_at else "",
        )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Audit log
    try:
        audit = AuditLog(
            action="update_user",
            username=username,
            details=f"user_id={user_id}, username={user.username}, changes={', '.join(update_details)}"
        )
        create_audit_log(db, audit_log=audit)
    except Exception as e:
        logger.warning(f"Failed to write audit log for update_user: {e}")
    
    return UserRead(
        id=user.id,
        username=user.username,
        email=user.email,
        role=user.role,
        wallet_address=user.wallet_address,
        is_active=getattr(user, 'is_active', True),
        created_at=user.created_at.isoformat() if user.created_at else "",
    )


# =========================================================
# ADMIN: Delete user
# =========================================================
@router.delete("/users/{user_id}")
def delete_user_api(
    user_id: int,
    db: Session = Depends(get_session),
    admin_user=Depends(admin_required),
):
    """Delete user (soft delete by setting is_active=False)"""
    username = admin_user.get("sub")
    
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent admin from deleting themselves
    if user.username == username:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    # Prevent deleting the last admin
    admin_count = len(list(db.exec(select(User).where(User.role == ROLE_ADMIN)).all()))
    if user.role == ROLE_ADMIN and admin_count <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the last admin")
    
    # Soft delete: set is_active=False instead of actually deleting
    user.is_active = False
    db.add(user)
    db.commit()
    
    # Audit log
    try:
        audit = AuditLog(
            action="delete_user",
            username=username,
            details=f"user_id={user_id}, username={user.username} (soft delete)"
        )
        create_audit_log(db, audit_log=audit)
    except Exception as e:
        logger.warning(f"Failed to write audit log for delete_user: {e}")
    
    return {"message": "User deleted successfully", "user_id": user_id}


# =========================================================
# ADMIN: Ban/Unban user
# =========================================================
@router.post("/users/{user_id}/toggle-active")
def toggle_user_active_api(
    user_id: int,
    db: Session = Depends(get_session),
    admin_user=Depends(admin_required),
):
    """Toggle user active status (ban/unban)"""
    username = admin_user.get("sub")
    
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent admin from banning themselves
    if user.username == username:
        raise HTTPException(status_code=400, detail="Cannot ban your own account")
    
    old_active = getattr(user, 'is_active', True)
    user.is_active = not old_active
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Audit log
    try:
        action_name = "unban_user" if user.is_active else "ban_user"
        audit = AuditLog(
            action=action_name,
            username=username,
            details=f"user_id={user_id}, username={user.username}, is_active: {old_active} -> {user.is_active}"
        )
        create_audit_log(db, audit_log=audit)
    except Exception as e:
        logger.warning(f"Failed to write audit log for toggle_user_active: {e}")
    
    return {
        "message": f"User {'activated' if user.is_active else 'banned'} successfully",
        "user_id": user_id,
        "username": user.username,
        "is_active": user.is_active,
    }


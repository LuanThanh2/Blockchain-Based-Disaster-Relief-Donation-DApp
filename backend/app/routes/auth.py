# backend/app/routes/auth.py

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from app.utils.jwt import create_access_token
from app.utils.roles import (
    ROLE_ADMIN,
    ROLE_USER,
)
from app.utils.security import hash_password, verify_password
from app.database import get_session
from app.models import User, PasswordResetOTP, AuditLog
from app.services.email_service import send_otp_email
from app.dependencies.auth import get_current_user
from app.crud import create_audit_log
from datetime import datetime, timedelta
import secrets
import logging

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

# DEMO USERS (in-memory) - Chỉ có 2 role: user và admin
# Giữ lại để backward compatibility
USERS = {
    "admin": {"password": "admin123", "role": ROLE_ADMIN},
    "user": {"password": "user123", "role": ROLE_USER},
}

class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str
    email: str  # Email để reset password sau này

class ForgotPasswordRequest(BaseModel):
    username: str
    email: str

class ResetPasswordRequest(BaseModel):
    username: str
    email: str
    otp_code: str
    new_password: str


@router.post("/register")
def register(payload: RegisterRequest, db: Session = Depends(get_session)):
    """Đăng ký user mới"""
    
    # Validate tối thiểu
    if len(payload.username) < 3:
        raise HTTPException(status_code=400, detail="Username phải có ít nhất 3 ký tự")
    
    if len(payload.username) > 50:
        raise HTTPException(status_code=400, detail="Username không được quá 50 ký tự")
    
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password phải có ít nhất 6 ký tự")
    
    # Validate email
    if not payload.email or "@" not in payload.email:
        raise HTTPException(status_code=400, detail="Email không hợp lệ")
    
    # Check username
    existed = db.exec(select(User).where(User.username == payload.username)).first()
    if existed:
        raise HTTPException(status_code=400, detail="Username đã tồn tại")
    
    if payload.username in USERS:
        raise HTTPException(status_code=400, detail="Username đã tồn tại")
    
    # Hash
    try:
        pw_hash = hash_password(payload.password)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Hash password failed: {str(e)}")
    
    # Save
    user = User(
        username=payload.username,
        password_hash=pw_hash,
        role=ROLE_USER,
        email=payload.email.lower().strip(),  # Lưu email dạng lowercase và trim
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Audit log
    try:
        audit = AuditLog(
            action="register",
            username=payload.username,
            details=f"email={payload.email}, role={ROLE_USER}"
        )
        create_audit_log(db, audit_log=audit)
    except Exception as e:
        logger.warning(f"Failed to write audit log for register: {e}")
    
    # Auto login after registration
    token = create_access_token({
        "sub": payload.username,
        "role": ROLE_USER,
    })
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "username": payload.username,
        "role": ROLE_USER,
        "message": "Đăng ký thành công",
    }

@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_session)):
    """Đăng nhập - check cả database và demo users"""
    # First check database
    user = db.exec(select(User).where(User.username == payload.username)).first()
    
    if user:
        # Verify password from database
        if not verify_password(payload.password, user.password_hash):
            # Audit log failed login
            try:
                audit = AuditLog(
                    action="login_failed",
                    username=payload.username,
                    details="Invalid password"
                )
                create_audit_log(db, audit_log=audit)
            except Exception:
                pass
            raise HTTPException(status_code=401, detail="Sai username hoặc password")
        
        token = create_access_token({
            "sub": payload.username,
            "role": user.role,
        })
        
        # Audit log successful login
        try:
            audit = AuditLog(
                action="login",
                username=payload.username,
                details=f"role={user.role}"
            )
            create_audit_log(db, audit_log=audit)
        except Exception as e:
            logger.warning(f"Failed to write audit log for login: {e}")
        
        return {
            "access_token": token,
            "token_type": "bearer",
            "username": payload.username,
            "role": user.role,
        }
    
    # Fallback to demo users (backward compatibility)
    demo_user = USERS.get(payload.username)
    if not demo_user or demo_user["password"] != payload.password:
        # Audit log failed login
        try:
            audit = AuditLog(
                action="login_failed",
                username=payload.username,
                details="Invalid credentials"
            )
            create_audit_log(db, audit_log=audit)
        except Exception:
            pass
        raise HTTPException(status_code=401, detail="Sai username hoặc password")

    token = create_access_token({
        "sub": payload.username,
        "role": demo_user["role"],
    })
    
    # Audit log successful login
    try:
        audit = AuditLog(
            action="login",
            username=payload.username,
            details=f"role={demo_user['role']} (demo user)"
        )
        create_audit_log(db, audit_log=audit)
    except Exception as e:
        logger.warning(f"Failed to write audit log for login: {e}")

    return {
        "access_token": token,
        "token_type": "bearer",
        "username": payload.username,
        "role": demo_user["role"],
    }


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_session)):
    """Gửi OTP qua email để reset password"""
    
    # Validate
    if not payload.email or "@" not in payload.email:
        raise HTTPException(status_code=400, detail="Email không hợp lệ")
    
    # Tìm user
    user = db.exec(select(User).where(User.username == payload.username)).first()
    if not user:
        # Không tiết lộ user không tồn tại (security best practice)
        return {"message": "Nếu username và email hợp lệ, bạn sẽ nhận được mã OTP qua email"}
    
    # Kiểm tra email có khớp không (nếu user có email trong DB)
    if user.email and user.email.lower() != payload.email.lower():
        # Không tiết lộ email không khớp (security best practice)
        return {"message": "Nếu username và email hợp lệ, bạn sẽ nhận được mã OTP qua email"}
    
    # Tạo OTP code (6 chữ số)
    otp_code = f"{secrets.randbelow(1000000):06d}"
    
    # Thời gian hết hạn: 15 phút
    expires_at = datetime.utcnow() + timedelta(minutes=15)
    
    # Lưu OTP vào database
    otp_record = PasswordResetOTP(
        username=payload.username,
        email=payload.email.lower(),
        otp_code=otp_code,
        expires_at=expires_at,
        used=False,
    )
    
    db.add(otp_record)
    db.commit()
    
    # Gửi email OTP
    email_sent = send_otp_email(
        to_email=payload.email,
        username=payload.username,
        otp_code=otp_code,
    )
    
    if not email_sent:
        # Xóa OTP record nếu không gửi được email
        db.delete(otp_record)
        db.commit()
        raise HTTPException(status_code=500, detail="Không thể gửi email. Vui lòng thử lại sau.")
    
    # Cập nhật email cho user nếu chưa có
    if not user.email:
        user.email = payload.email.lower()
        db.add(user)
        db.commit()
    
    # Audit log
    try:
        audit = AuditLog(
            action="forgot_password",
            username=payload.username,
            details=f"email={payload.email}"
        )
        create_audit_log(db, audit_log=audit)
    except Exception as e:
        logger.warning(f"Failed to write audit log for forgot_password: {e}")
    
    return {
        "message": "Mã OTP đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư (có thể trong thư mục Spam).",
        "expires_in_minutes": 15,
    }


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_session)):
    """Reset password bằng OTP code"""
    
    # Validate
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password mới phải có ít nhất 6 ký tự")
    
    if not payload.otp_code or len(payload.otp_code) != 6:
        raise HTTPException(status_code=400, detail="Mã OTP không hợp lệ")
    
    # Tìm OTP record
    otp_record = db.exec(
        select(PasswordResetOTP).where(
            PasswordResetOTP.username == payload.username,
            PasswordResetOTP.email == payload.email.lower(),
            PasswordResetOTP.otp_code == payload.otp_code,
            PasswordResetOTP.used == False,
        )
    ).first()
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="Mã OTP không hợp lệ hoặc đã được sử dụng")
    
    # Kiểm tra OTP đã hết hạn chưa
    if datetime.utcnow() > otp_record.expires_at:
        # Đánh dấu là đã sử dụng để tránh reuse
        otp_record.used = True
        db.add(otp_record)
        db.commit()
        raise HTTPException(status_code=400, detail="Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.")
    
    # Tìm user
    user = db.exec(select(User).where(User.username == payload.username)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User không tồn tại")
    
    # Hash password mới
    try:
        new_password_hash = hash_password(payload.new_password)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Hash password failed: {str(e)}")
    
    # Cập nhật password
    user.password_hash = new_password_hash
    db.add(user)
    
    # Đánh dấu OTP đã sử dụng
    otp_record.used = True
    db.add(otp_record)
    
    db.commit()
    
    # Audit log
    try:
        audit = AuditLog(
            action="reset_password",
            username=payload.username,
            details=f"email={payload.email}"
        )
        create_audit_log(db, audit_log=audit)
    except Exception as e:
        logger.warning(f"Failed to write audit log for reset_password: {e}")
    
    return {
        "message": "Đặt lại mật khẩu thành công. Vui lòng đăng nhập với mật khẩu mới.",
    }


@router.get("/me", dependencies=[Depends(get_current_user)])
def get_current_user_profile(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """Lấy thông tin profile của user hiện tại"""
    username = user.get("sub")
    if not username:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Tìm user trong database
    db_user = db.exec(select(User).where(User.username == username)).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "id": db_user.id,
        "username": db_user.username,
        "email": db_user.email,
        "role": db_user.role,
        "wallet_address": db_user.wallet_address,
        "created_at": db_user.created_at.isoformat() if db_user.created_at else None,
    }


class UpdateWalletRequest(BaseModel):
    wallet_address: str


@router.put("/me/wallet", dependencies=[Depends(get_current_user)])
def update_wallet_address(
    payload: UpdateWalletRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """Cập nhật địa chỉ ví Ethereum cho user"""
    username = user.get("sub")
    if not username:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Validate wallet address format
    wallet_address = payload.wallet_address.strip()
    if not wallet_address.startswith("0x"):
        raise HTTPException(status_code=400, detail="Địa chỉ ví phải bắt đầu bằng 0x")
    
    if len(wallet_address) != 42:
        raise HTTPException(status_code=400, detail="Địa chỉ ví phải có 42 ký tự")
    
    # Convert to lowercase for consistency
    wallet_address = wallet_address.lower()
    
    # Tìm user trong database
    db_user = db.exec(select(User).where(User.username == username)).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Cập nhật wallet address
    old_wallet = db_user.wallet_address
    db_user.wallet_address = wallet_address
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Audit log
    try:
        audit = AuditLog(
            action="update_wallet",
            username=username,
            details=f"old_wallet={old_wallet}, new_wallet={wallet_address}"
        )
        create_audit_log(db, audit_log=audit)
    except Exception as e:
        logger.warning(f"Failed to write audit log for update_wallet: {e}")
    
    return {
        "message": "Đã liên kết ví thành công",
        "wallet_address": db_user.wallet_address,
    }


@router.delete("/me/wallet", dependencies=[Depends(get_current_user)])
def remove_wallet_address(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """Xóa liên kết ví Ethereum của user"""
    username = user.get("sub")
    if not username:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Tìm user trong database
    db_user = db.exec(select(User).where(User.username == username)).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Xóa wallet address
    old_wallet = db_user.wallet_address
    db_user.wallet_address = None
    db.add(db_user)
    db.commit()
    
    # Audit log
    try:
        audit = AuditLog(
            action="delete_wallet",
            username=username,
            details=f"removed_wallet={old_wallet}"
        )
        create_audit_log(db, audit_log=audit)
    except Exception as e:
        logger.warning(f"Failed to write audit log for delete_wallet: {e}")
    
    return {
        "message": "Đã xóa liên kết ví thành công",
    }

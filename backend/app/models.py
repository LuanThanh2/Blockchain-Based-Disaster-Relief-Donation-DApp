from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship

class Campaign(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    short_desc: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    target_amount: float = 0.0
    currency: str = "ETH"
    beneficiary: Optional[str] = None
    deadline: Optional[datetime] = None
    owner: Optional[str] = None
    contract_tx_hash: Optional[str] = None
    onchain_id: Optional[int] = None  
    status: str = Field(default="active")
    is_visible: bool = Field(default=True)  # Quản lý hiển thị cho public
    auto_disburse: bool = Field(default=False)  # Tự động rút tiền khi đạt threshold
    disburse_threshold: float = Field(default=0.8)  # 80% target_amount
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Donation(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    campaign_id: int = Field(foreign_key="campaign.id")
    onchain_campaign_id: Optional[int] = None
    donor_address: str
    amount_eth: float
    amount_wei: str  # Store as string to avoid precision issues
    tx_hash: str = Field(unique=True, index=True)
    block_number: int
    timestamp: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AuditLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    action: str
    user_address: Optional[str] = None
    username: Optional[str] = None  # Thêm username để dễ query
    details: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class WithdrawLog(SQLModel, table=True):
    """Lưu lịch sử rút tiền từ blockchain"""
    id: Optional[int] = Field(default=None, primary_key=True)
    campaign_id: int = Field(foreign_key="campaign.id")
    onchain_campaign_id: Optional[int] = None
    owner_address: str
    amount_eth: float
    amount_wei: str
    tx_hash: str = Field(unique=True, index=True)
    block_number: int
    timestamp: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)


class User(SQLModel, table=True):
    """Người dùng hệ thống"""
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    password_hash: str  # Hashed password
    role: str = Field(default="user")  # "user" or "admin"
    email: Optional[str] = None  # Email để reset password
    wallet_address: Optional[str] = None  # Địa chỉ ví Ethereum đã liên kết
    is_active: bool = Field(default=True)  # Ban/unban user
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PasswordResetOTP(SQLModel, table=True):
    """OTP code để reset password"""
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True)
    email: str
    otp_code: str = Field(index=True)  # 6-digit OTP code
    expires_at: datetime  # Thời gian hết hạn (15 phút)
    used: bool = Field(default=False)  # Đã sử dụng chưa
    created_at: datetime = Field(default_factory=datetime.utcnow)


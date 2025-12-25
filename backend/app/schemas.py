from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field

class CampaignCreate(BaseModel):
    title: str = Field(..., min_length=3)
    short_desc: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    target_amount: float = 0.0
    currency: str = "ETH"
    beneficiary: Optional[str] = None
    deadline: Optional[datetime] = None
    createOnChain: bool = False
    auto_disburse: bool = False
    disburse_threshold: float = Field(default=0.8, ge=0.0, le=1.0)

class CampaignRead(BaseModel):
    id: int
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
    status: str
    is_visible: bool = True
    auto_disburse: bool = False
    disburse_threshold: float = 0.8
    created_at: datetime

    class Config:
        from_attributes = True  # pydantic v2
        # For Pydantic v1 compatibility
        orm_mode = True


class CampaignUpdate(BaseModel):
    """Schema for updating campaign metadata"""
    title: Optional[str] = Field(None, min_length=3)
    short_desc: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    target_amount: Optional[float] = None
    beneficiary: Optional[str] = None
    deadline: Optional[datetime] = None
    is_visible: Optional[bool] = None
    auto_disburse: Optional[bool] = None
    disburse_threshold: Optional[float] = None


class DonationRead(BaseModel):
    id: int
    campaign_id: int
    donor_address: str
    amount_eth: float
    tx_hash: str
    timestamp: datetime

    class Config:
        from_attributes = True


class CampaignWithStats(CampaignRead):
    """Campaign với thống kê donations"""
    total_raised: float = 0.0  # Tổng số tiền đã quyên góp (ETH)
    donor_count: int = 0  # Số lượng donors
    donation_count: int = 0  # Số lượng donations
    recent_donations: list[DonationRead] = []  # 5 donations gần nhất

class WithdrawRead(BaseModel):
    """Thông tin giao dịch rút tiền"""
    id: Optional[int] = None
    campaign_id: int
    onchain_campaign_id: Optional[int] = None  # Match với model WithdrawLog
    owner_address: str
    amount_eth: float
    amount_wei: Optional[str] = None
    tx_hash: str
    block_number: int
    timestamp: datetime
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AuditLogRead(BaseModel):
    """Audit log entry"""
    id: int
    action: str
    user_address: Optional[str] = None
    username: Optional[str] = None
    details: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True


class ReportSummary(BaseModel):
    """Tổng hợp báo cáo cho admin"""
    total_campaigns: int
    active_campaigns: int
    total_raised: float
    total_withdrawn: float
    total_donors: int
    total_donations: int
    recent_campaigns: list[CampaignRead] = []
    top_campaigns: list[CampaignWithStats] = []
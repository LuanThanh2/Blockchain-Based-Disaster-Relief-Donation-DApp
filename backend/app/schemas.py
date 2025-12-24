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
    created_at: datetime

    class Config:
        from_attributes = True  # pydantic v2


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
    campaign_id: int
    campaign_onchain_id: int
    owner: str
    amount_eth: float
    tx_hash: str
    block_number: int
    timestamp: int  # Unix timestamp

    class Config:
        from_attributes = True
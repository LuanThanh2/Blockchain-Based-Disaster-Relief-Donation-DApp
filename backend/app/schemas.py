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


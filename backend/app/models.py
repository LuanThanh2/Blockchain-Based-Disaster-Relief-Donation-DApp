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


from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field

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


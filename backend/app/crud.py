from sqlmodel import Session, select
from .models import Campaign

def create_campaign(db: Session, *, campaign: Campaign) -> Campaign:
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign

def get_campaign(db: Session, campaign_id: int) -> Campaign | None:
    return db.get(Campaign, campaign_id)

def list_campaigns(db: Session) -> list[Campaign]:
    return list(db.exec(select(Campaign).order_by(Campaign.id.desc())).all())

def update_contract_tx_hash(db: Session, campaign_id: int, tx_hash: str) -> None:
    c = db.get(Campaign, campaign_id)
    if not c:
        return
    c.contract_tx_hash = tx_hash
    db.add(c)
    db.commit()

def update_onchain_info(
    db: Session,
    campaign_id: int,
    tx_hash: str,
    onchain_id: int,
) -> None:
    c = db.get(Campaign, campaign_id)
    if not c:
        return
    c.contract_tx_hash = tx_hash
    c.onchain_id = onchain_id
    db.add(c)
    db.commit()

from sqlmodel import Session, select
from sqlalchemy import func
from .models import Campaign, Donation

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

def create_donation(db: Session, *, donation: Donation) -> Donation:
    db.add(donation)
    db.commit()
    db.refresh(donation)
    return donation

def get_donations_by_campaign_id(db: Session, campaign_id: int, limit: int = 100) -> list[Donation]:
    return list(
        db.exec(
            select(Donation)
            .where(Donation.campaign_id == campaign_id)
            .order_by(Donation.timestamp.desc())
            .limit(limit)
        ).all()
    )

def get_donation_by_tx_hash(db: Session, tx_hash: str) -> Donation | None:
    return db.exec(select(Donation).where(Donation.tx_hash == tx_hash)).first()

def get_campaign_stats(db: Session, campaign_id: int):
    total_raised = db.exec(
        select(func.sum(Donation.amount_eth))
        .where(Donation.campaign_id == campaign_id)
    ).first() or 0.0

    donor_count = db.exec(
        select(func.count(func.distinct(Donation.donor_address)))
        .where(Donation.campaign_id == campaign_id)
    ).first() or 0

    donation_count = db.exec(
        select(func.count(Donation.id))
        .where(Donation.campaign_id == campaign_id)
    ).first() or 0
    
    return {
        "total_raised": total_raised,
        "donor_count": donor_count,
        "donation_count": donation_count,
    }

def update_campaign_status(db: Session, campaign_id: int, status: str) -> None:
    """Update campaign status (active/closed)"""
    c = db.get(Campaign, campaign_id)
    if not c:
        return
    c.status = status
    db.add(c)
    db.commit()
